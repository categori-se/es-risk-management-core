import {bibliographyText} from '../src/lib/engagement-bibliography.js';
import {createHash} from "node:crypto";
import {mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync, statSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pathToFileURL} from "node:url";
import {spawn} from "node:child_process";
import ExcelJS from "exceljs";
import {snapshotDigestInput, engagementSnapshotMaxBytes, monitoringEntityNames, monitoringAttention, monitoringActionBelongsToProgram, compareMonitoringMeasurements} from "../src/lib/engagement-domain.js";
import {protectedMonitoringSourceClosure,redactProtectedMonitoringAssertion,redactProtectedMonitoringSource,projectMonitoringDisclosure} from "../src/lib/monitoring-protection.js";
import {getEngagementReportTemplate,reportTemplateRequirementMatches} from "../src/lib/engagement-report-templates.js";

const fail = (message, status = 400) => {throw Object.assign(Error(message), {status});};
let activePdfExports = 0;
const human = value => String(value ?? "").replaceAll("_", " ");
const text = value => typeof value === "string" ? value : value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
const h = value => text(value).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const templates = Object.freeze({due_diligence: ["Environmental and social due diligence", "Review scope, evidence sufficiency, findings and proposed commitments."], independent_monitoring: ["Independent monitoring report", "Review the reporting period, implementation evidence, outstanding commitments and follow-up."], annual_performance: ["Annual environmental and social performance review", "Review annual performance, changes, unresolved gaps and the next reporting period."], corrective_verification: ["Corrective-action verification", "Review closure criteria, exact completion evidence and the recorded verification decision."], compliance_audit: ["Client compliance audit", "Review applicable criteria, deficiencies, professional judgments and corrective measures."], institutional_assessment: ["Institutional assessment", "Review institutional arrangements, assigned duties, evidence and required improvements."]});

export function verifyEngagementSnapshot(snapshot) {
  if (!snapshot || snapshot.format !== "esia-engagement-snapshot" || snapshot.schemaVersion !== 1 || typeof snapshot.id !== "string" ||
      !/^[a-f0-9]{64}$/.test(snapshot.sha256 || "") || snapshot.engagement?.status !== "approved") fail("Export requires an approved engagement snapshot with its immutable baseline identity.");
  const encoded = JSON.stringify(snapshot);
  if (Buffer.byteLength(encoded) > engagementSnapshotMaxBytes) fail("This approved snapshot exceeds the 8 MiB export limit.", 413);
  for (const name of ["requirements", "assertions", "findings", "actions", "obligations", "approvals", "sourceVersions"]) if (!Array.isArray(snapshot[name]) || snapshot[name].length > 10000) fail(`The snapshot ${name} register is invalid or exceeds export limits.`);
  if (createHash("sha256").update(snapshotDigestInput(snapshot)).digest("hex") !== snapshot.sha256) fail("The approved snapshot SHA256 does not match its retained records.", 409);
  return snapshot;
}

// Publication views reference the verified baseline; they never replace it or
// claim that its digest was computed over a filtered report.
function publicationView(snapshot, options = {}) {
  const reportTypes = ["neutral", "periodic", "independent", "institutional", "mission", "incident"];
  if (options.reportType && !reportTypes.includes(options.reportType)) fail("Choose a supported monitoring report type.");
  const monitoring = snapshot.scope?.kind === "monitoring_cycle" || monitoringEntityNames.some(name => snapshot[name]?.length);
  const selectedCycleId = options.cycleId || snapshot.scope?.cycleId || null;
  const selectedCycle = (snapshot.cycles || []).find(cycle => cycle.id === selectedCycleId);
  if (options.templateVersion && !options.templateId) fail("Choose the report template identity with its version.");
  const template = options.templateId ? getEngagementReportTemplate(options.templateId, options.templateVersion || "1") : null;
  const selected = {cycleId: selectedCycleId, reportType: options.reportType || (selectedCycle?.reportType === "independent" ? "independent" : "neutral"), frameworkId: options.frameworkId || null, missionId: options.missionId || null, eventId: options.eventId || null};
  if(options.requirementIds!==undefined){const ids=options.requirementIds;if(!Array.isArray(ids)||!ids.length||ids.length>1000||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!snapshot.requirements.some(row=>row.id===id)))fail('Select at most 1,000 distinct existing baseline requirement IDs.');selected.requirementIds=[...ids].sort();}
  for (const [key, register] of [["cycleId", "cycles"], ["frameworkId", "requirements"], ["missionId", "missions"], ["eventId", "events"]]) if (selected[key] && !(snapshot[register] || []).some(record => key === "frameworkId" ? record.frameworkId === selected[key] : record.id === selected[key])) fail(`The selected ${key} is outside this approved baseline.`, 404);
  for (const [key, register] of [["missionId", "missions"], ["eventId", "events"]]) if (selected[key] && selected.cycleId) {const record = snapshot[register].find(record => record.id === selected[key]);if (record.cycleId && record.cycleId !== selected.cycleId) fail(`The selected ${key} belongs to a different reporting cycle.`, 400);}
  const privateKeys = new Set(["restricted", "sealed", "ciphertext"]);
  let withheld = false;
  const strip = value => Array.isArray(value) ? value.map(strip) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key]) => {if (privateKeys.has(key)) {withheld = true;return false;}return true;}).map(([key, child]) => [key, strip(child)])) : value;
  const view = strip(structuredClone(snapshot));
  if(snapshot.sourceReviews)view.sourceReviews=projectMonitoringDisclosure(snapshot).sourceReviews;
  if (template) view.reportTemplate = {...structuredClone(template), definitionSha256: createHash("sha256").update(JSON.stringify(template)).digest("hex")};
  const protection = protectedMonitoringSourceClosure(snapshot), restrictedEvents = (snapshot.events || []).filter(event => protection.eventIds.has(event.id));
  if (restrictedEvents.length) {
    withheld = true;
    view.events = (view.events || []).map(event => restrictedEvents.some(privateEvent => privateEvent.id === event.id) ? {
      ...Object.fromEntries(["id", "programId", "cycleId", "kind", "code", "severity", "occurredAt", "receivedAt", "status", "requirementIds", "obligationIds", "assertionIds", "actionIds", "restrictedSha256"].filter(key => event[key] !== undefined).map(key => [key, event[key]])),
      publicSummary: "Restricted event: investigative details and identities withheld from normal publication.", restrictedAvailable: true
    } : event);
    view.assertions = view.assertions.map(assertion => redactProtectedMonitoringAssertion(assertion,protection));
    view.sourceVersions = view.sourceVersions.map(source => redactProtectedMonitoringSource(source,protection));
    if(snapshot.externalReferences)view.externalReferences=projectMonitoringDisclosure(snapshot,{closure:protection}).externalReferences;
  }
  if (!monitoring && !withheld && !template?.criteria && ![selected.cycleId, selected.frameworkId, selected.missionId, selected.eventId,selected.requirementIds, options.reportType && options.reportType !== "neutral"].some(Boolean)) return {view, projection: Boolean(template)};
  const cycle = (view.cycles || []).find(cycle => cycle.id === selected.cycleId), programId = cycle?.programId || snapshot.scope?.programId;
  view.requirements = view.requirements.filter(record => (!selected.frameworkId || record.frameworkId === selected.frameworkId) && (!selected.requirementIds||selected.requirementIds.includes(record.id)) && (!template || reportTemplateRequirementMatches(template,record)));
  if(selected.requirementIds&&view.requirements.length!==selected.requirementIds.length)fail('The selected requirement IDs fall outside the exact framework or template scope.',409);
  const requirementIds = new Set(view.requirements.map(record => record.id));
  const chosenMission = view.missions?.find(item => item.id === selected.missionId), chosenEvent = view.events?.find(item => item.id === selected.eventId);
  const focusRequirements = new Set([...(chosenMission?.requirementIds || []), ...(chosenEvent?.requirementIds || [])]);
  if (focusRequirements.size) view.requirements = view.requirements.filter(record => focusRequirements.has(record.id));
  const finalRequirements = new Set(view.requirements.map(record => record.id));
  const scopedIds = selected.cycleId === snapshot.scope?.cycleId ? new Set(snapshot.scope?.findingIds || []) : null;
  view.findings = view.findings.filter(record => finalRequirements.has(record.requirementId) && (!selected.cycleId || (scopedIds?.size ? scopedIds.has(record.id) : record.cycleId === selected.cycleId)));
  const priorIds = new Set(view.findings.map(record => record.priorFindingId).filter(Boolean));
  const supervisedActionIds=new Set((view.programs||[]).find(record=>record.id===programId)?.baselineActionIds||[]);
  for(const action of snapshot.actions.filter(record=>supervisedActionIds.has(record.id)))for(const id of action.findingIds||[]){const finding=snapshot.findings.find(record=>record.id===id);if(finding&&!finding.cycleId&&finalRequirements.has(finding.requirementId))priorIds.add(id);}
  let prior = view.findings.map(record => record.priorFindingId).filter(Boolean);
  for (let depth = 0; prior.length && depth < 100; depth++) {const next = snapshot.findings.filter(record => prior.includes(record.id)).map(record => record.priorFindingId).filter(id => id && !priorIds.has(id));next.forEach(id => priorIds.add(id));prior = next;}
  view.priorFindings = strip(snapshot.findings.filter(record => priorIds.has(record.id) && requirementIds.has(record.requirementId)));
  const findingIds = new Set([...view.findings, ...view.priorFindings].map(record => record.id));
  const focused = Boolean(selected.frameworkId || selected.missionId || selected.eventId || selected.requirementIds || template?.criteria);
  view.actions = view.actions.filter(record => (!selected.cycleId || record.cycleId === selected.cycleId || !record.cycleId&&programId&&monitoringActionBelongsToProgram(view,record,programId) || (record.findingIds || []).some(id => findingIds.has(id)) || (chosenEvent?.actionIds || []).includes(record.id)) && (!focused || (record.findingIds || []).some(id => findingIds.has(id)) || (chosenEvent?.actionIds || []).includes(record.id) || template?.criteria && !(record.findingIds || []).length));
  for (const name of ["programs", "monitoringObligations", "indicators"]) view[name] = (view[name] || []).filter(record => !programId || (name === "programs" ? record.id === programId : record.programId === programId));
  if(focused){
    for(const name of ["programs","cycles"])view[name]=(view[name]||[]).map(record=>({...record,requirementIds:(record.requirementIds||[]).filter(id=>finalRequirements.has(id))}));
    view.monitoringObligations=view.monitoringObligations.filter(record=>!(record.requirementIds||[]).length&&!(record.originFindingIds||[]).length||(record.requirementIds||[]).some(id=>finalRequirements.has(id))||(record.originFindingIds||[]).some(id=>findingIds.has(id)));
    const obligationIds=new Set(view.monitoringObligations.map(record=>record.id));
    view.indicators=view.indicators.filter(record=>!(record.requirementIds||[]).length&&!(record.obligationIds||[]).length||(record.requirementIds||[]).some(id=>finalRequirements.has(id))||(record.obligationIds||[]).some(id=>obligationIds.has(id)));
    const relates=record=>![...(record.requirementIds||[]),...(record.findingIds||[]),...(record.obligationIds||[])].length||(record.requirementIds||[]).some(id=>finalRequirements.has(id))||(record.findingIds||[]).some(id=>findingIds.has(id))||(record.obligationIds||[]).some(id=>obligationIds.has(id));
    for(const name of ["requests","missions","events"])view[name]=(view[name]||[]).filter(relates);
    view.submissions=(view.submissions||[]).filter(record=>!(record.obligationIds||[]).length||(record.obligationIds||[]).some(id=>obligationIds.has(id)));
  }
  const indicatorIds = new Set(view.indicators.map(record => record.id));
  view.measurements = (view.measurements || []).filter(record => indicatorIds.has(record.indicatorId) && (!cycle?.periodEnd || String(record.periodEnd || record.observedAt).slice(0, 10) <= cycle.periodEnd));
  for (const name of ["submissions", "requests", "missions", "events", "verifications"]) view[name] = (view[name] || []).filter(record => (!selected.cycleId || record.cycleId === selected.cycleId || name==="events"&&!record.cycleId&&(!programId||record.programId===programId)&&(record.id===selected.eventId||cycle&&record.occurredAt?.slice(0,10)>=cycle.periodStart&&record.occurredAt.slice(0,10)<=cycle.periodEnd)) && (name !== "missions" || !selected.missionId || record.id === selected.missionId) && (name !== "events" || !selected.eventId || record.id === selected.eventId));
  if(focused){
    const targets=new Set([...view.actions,...view.monitoringObligations,...view.events].map(record=>record.id));view.verifications=view.verifications.filter(record=>targets.has(record.targetId));
    const usedAssertions=new Set([...view.findings,...view.priorFindings].flatMap(record=>[...(record.supportingAssertionIds||[]),...(record.contradictoryAssertionIds||[])]).concat([...view.actions,...view.measurements,...view.missions,...view.events,...view.verifications].flatMap(record=>[...(record.assertionIds||[]),...(record.closureAssertionIds||[])]),view.monitoringObligations.flatMap(record=>(record.occurrences||[]).flatMap(occurrence=>occurrence.assertionIds||[]))));
    view.assertions=view.assertions.filter(record=>usedAssertions.has(record.id)||!selected.requirementIds&&!(record.requirementIds||[]).length||(record.requirementIds||[]).some(id=>finalRequirements.has(id)));
    const sourceIds=new Set([...view.assertions.flatMap(record=>[record,...(record.history||[])].map(revision=>revision.versionId)),...view.monitoringObligations.map(record=>record.sourceVersionId),...view.indicators.map(record=>record.threshold?.sourceVersionId),...view.measurements.map(record=>record.threshold?.sourceVersionId),...view.submissions.flatMap(record=>record.versionIds||[]),...view.missions.flatMap(record=>record.captureVersionIds||[]),...(view.engagement.agreementVersionIds||[]),...(view.engagement.amendments||[]).map(record=>record.sourceVersionId),...view.obligations.map(record=>record.sourceVersionId),...view.requirements.map(record=>record.sourceVersionId)]);view.sourceVersions=view.sourceVersions.filter(record=>sourceIds.has(record.id));
    view.mappings=(view.mappings||[]).filter(record=>finalRequirements.has(record.sourceRequirementId)||finalRequirements.has(record.targetRequirementId));
    const keptIds=new Set([...view.requirements,...view.findings,...view.priorFindings,...view.actions,...view.monitoringObligations,...view.indicators,...view.measurements,...view.missions,...view.events,...view.verifications].map(record=>record.id));
    view.audit=(view.audit||[]).filter(entry=>entry.review?keptIds.has(entry.review.findingId):!(entry.changedIds||[]).length||(entry.changedIds||[]).some(id=>keptIds.has(id)));
  }
  view.approvals = view.approvals.filter(record => !selected.cycleId || !record.cycleId || record.cycleId === selected.cycleId);
  view.reportSelection = selected;
  if(template?.criteria)view.reportTemplate.coverageNotice=view.requirements.length?'Institutional criteria are selected by exact framework identity or recorded authority; applicability, edition and field coverage still require review. Shared factual monitoring records do not establish equivalent institutional duties.':'No matching institutional criteria are recorded in this scope. This report cannot supply an institutional compliance conclusion. Shared factual monitoring records do not establish equivalent institutional duties.';
  if(snapshot.bibliography)view.bibliography=projectMonitoringDisclosure(snapshot).bibliography;
  view.disclosure = "Public monitoring projection of the identified approved baseline. Restricted investigation details, sealed payloads and linked restricted quotations/filenames are withheld. Other project notes may remain sensitive; this is not a guarantee of complete anonymization. The source baseline hash identifies the verified retained baseline, not the bytes of this projection." + (selected.cycleId && snapshot.scope?.cycleId && selected.cycleId !== snapshot.scope.cycleId ? " This selection shows prior-period records retained in a later baseline; use the period's own approved baseline to reproduce its originally issued assessment and obligation states." : "");
  view.attention = monitoringAttention(view, {asOf: String(snapshot.createdAt || cycle?.periodEnd || "1970-01-01").slice(0, 10),...(programId?{programId}:{}),...(selected.cycleId&&!(chosenEvent&&!chosenEvent.cycleId)?{cycleId:selected.cycleId}:{})});
  return {view, projection: true};
}

function sections(snapshot) {
  const type = snapshot.engagement.type, aliases = {annual_review: "annual_performance", annual_es_performance_review: "annual_performance", annual_performance_review: "annual_performance", corrective_action_verification: "corrective_verification", client_compliance_audit: "compliance_audit"};
  const template = templates[aliases[type] || type] || templates.due_diligence;
  const reportTitles = {neutral: "Practitioner monitoring report", periodic: "Periodic environmental and social monitoring report", independent: "Independent environmental and social monitoring report", institutional: "Institution-specific monitoring report", mission: "Independent field mission report", incident: "Incident and grievance review report"};
  const perspective=snapshot.reportSelection?.reportType==="institutional"?snapshot.requirements[0]:null;
  const title = snapshot.reportSelection ? `${perspective?.authority?`${perspective.authority} · `:""}${reportTitles[snapshot.reportSelection.reportType]}` : template[0];
  return {title: `${snapshot.engagement.name || template[0]} — ${snapshot.reportTemplate?.name || title}`, purpose: snapshot.reportTemplate?.description || (snapshot.reportSelection ? "Period-specific implementation, effectiveness, compliance and risk judgments from the same approved assessment graph." : template[1]), groups: [
    ["Scope and mandate", [snapshot.engagement]], ["Requirements and framework editions", snapshot.requirements], ["Evidence assertions", snapshot.assertions],
    ["Findings and professional judgments", snapshot.findings], ["Corrective actions and verification", snapshot.actions], ["Contractual scope obligations", snapshot.obligations],
    ...(snapshot.bibliography?[["Working bibliography",snapshot.bibliography]]:[]),
    ...(snapshot.sourceReviews?[["Retained source search and full-page review",snapshot.sourceReviews]]:[]), ["Review and approvals", snapshot.approvals], ["Exact source versions", snapshot.sourceVersions], ...(snapshot.externalReferences?[["Declared external document register",snapshot.externalReferences]]:[]), ["Framework mappings", snapshot.mappings || []], ["Prior publication receipts", snapshot.publications || []], ["Audit history", snapshot.audit || []],
    ...monitoringEntityNames.map(name => [human(name.replace(/([a-z])([A-Z])/g, "$1 $2")), snapshot[name] || []]),
    ["Prior-period findings", snapshot.priorFindings || []], ["Report selection", snapshot.reportSelection ? [snapshot.reportSelection] : []], ["Monitoring attention", snapshot.attention ? [snapshot.attention] : []],
    ...(snapshot.reportTemplate ? [["Application report template", [snapshot.reportTemplate]]] : [])
  ]};
}

// Human reports and the structured appendix are views of the same approved
// snapshot. No separately editable report findings or action records exist.
function narrative(snapshot) {
  const result = [], engagement = snapshot.engagement, add = (title, paragraphs) => result.push({title, paragraphs: paragraphs.filter(value => value !== undefined && value !== null && value !== "").map(text)});
  if (snapshot.reportTemplate) {
    const template = snapshot.reportTemplate;
    add("Report template identity and scope", [`${template.name}; template ${template.id}; version ${template.version}; definition SHA256 ${template.definitionSha256}.`, template.notice,
      template.coverageNotice, template.audience && `Intended audience: ${template.audience}. Reporting frequency: ${template.frequency}. Reference scope: ${template.referenceScope}.`, template.signoffExpectations,
      ...(template.references || []).map(reference=>`Context reference: ${reference.title}; ${reference.url}; ${reference.locator || "locator not recorded"}; source version ${reference.resourceVersionId}; ${reference.classification}. The application-authored outline does not assert retained original bytes, reproduction permission or verified field mappings for this contextual source.`),
      "The approved baseline determines every finding, action and review decision below. These outline prompts organize the report; they do not add unrecorded findings, establish thematic applicability or imply that specialist inputs have been completed."]);
    for (const section of template.sections) add(section.title, [`Outline prompt: ${section.prompt}`, ...section.missingInputs.map(value => `Specialist input to verify: ${value}`),
      `Shared registers: ${section.registers.map(register => `${register} (${register === "engagement" ? 1 : (snapshot[register] || []).length} retained records)`).join("; ")}. See the substantive findings, citations and actions below and the structured appendix for exact identities. The counts do not establish section completeness.`]);
  }
  const editions = [...new Set(snapshot.requirements.map(requirement => `${requirement.authority || ""} ${requirement.frameworkName || requirement.frameworkId || ""} (${requirement.edition || "edition not recorded"})`.trim()))];
  const active = snapshot.actions.filter(action => action.status !== "superseded"), gaps = snapshot.findings.filter(finding => ["deficient", "insufficient_evidence"].includes(finding.adequacy));
  add("Executive summary", [`Client: ${engagement.client || "Not recorded"}. Engagement: ${engagement.name || "Not recorded"}.`,
    `${snapshot.requirements.length} selected requirements; ${snapshot.findings.length} reviewed findings; ${gaps.length} findings identify deficient or insufficient evidence; ${active.length} active corrective actions. These counts describe this approved assessment scope and do not establish an overall compliance percentage.`,
    `Framework editions: ${editions.join("; ") || "Not recorded"}.`,
    `This report represents approved baseline ${snapshot.id}, created ${snapshot.createdAt || "at an unrecorded time"}. SHA256 ${snapshot.sha256}. Later project activity does not change this approved dataset.`]);
  add("Assignment scope and limitations", [`Contracting parties: ${(engagement.contractingParties || []).join("; ") || "Not recorded"}.`,
    `Scope: ${(engagement.scope || []).map(human).join("; ") || "Not recorded"}.`, `Exclusions and limitations: ${engagement.exclusions || "None recorded"}.`,
    `Confidentiality, reuse and disclosure rules: ${engagement.dataRules || "Not recorded"}.`,
    `Client acceptance before publication: ${engagement.clientAcceptanceRequired ? "Required" : "Not required by this recorded mandate"}. Later acceptance and publication receipts remain separate from this immutable approved baseline.`,
    ...((engagement.deliverables || []).map(deliverable => `Agreed deliverable: ${deliverable.title || deliverable.id}. ${deliverable.description || ""} Due: ${deliverable.dueDate || "Not recorded"}.`))]);
  add("Assessment methodology", ["The assessment links each selected, edition-specific requirement or review prompt to exact retained document versions, evidence assertions, professional findings and corrective actions. Coverage describes whether the evidence addresses a requirement; adequacy assesses its sufficiency; performance records the separate project-compliance determination. A submitted document alone does not demonstrate implementation or compliance.",
    "Source quotations, supporting and contradictory evidence, uncertainties and recorded human review decisions are retained below. Curated review prompts are identified by their text kind and coverage notes; they are not represented as a complete authoritative standards corpus. AI contributions remain attributable in source and finding histories and require separate human review.",
    snapshot.disclosure || "This unredacted report can contain sensitive notes, quotations and source metadata. A recorded local approval is a professional attestation, not a cryptographic personal signature or independently verified identity."]);
  if (snapshot.reportSelection) addMonitoringNarrative(snapshot, add);
  for(const record of snapshot.sourceReviews||[])add('Source review coverage',record.mode==='search'?[`Search: ${record.search.query}. Retrieval: ${record.search.retrieval}; ${record.search.searchedPassages} indexed passages searched; ${record.search.candidatePassageIds.length} candidates returned.`,...record.search.sources.map(source=>`Version ${source.versionId}; SHA256 ${source.sourceSha256}; searched file pages ${source.searchedPages.join(', ')||'none'}; candidate pages ${source.candidatePages.join(', ')||'none'}; unreadable pages ${source.unreadablePages.join(', ')||'none'}.`),`${record.createdBy}, ${record.createdAt}. ${record.statement}`]:[`Complete original-file page review of version ${record.review.versionId}; SHA256 ${record.review.sourceSha256}; pages ${record.review.pages.join(', ')} of ${record.review.totalPages}.`,`${record.createdBy}, ${record.createdAt}. ${record.statement}`]);
  for(const reference of snapshot.bibliography||[])add('Bibliography',[bibliographyText(reference),`Use: ${reference.purpose}. Source category: ${human(reference.authorityKind)}. Exact resource edition: ${reference.resourceVersionId}${reference.instrumentId?`; instrument ${reference.instrumentId}`:''}.`,reference.statement]);
  for(const reference of snapshot.externalReferences||[])add('External document reference',reference.restrictedAvailable?['Authorized case evidence; external location and document metadata withheld.']:[`${reference.title} (${reference.filename}). ${reference.status==='original_linked'?'An exact retained original was explicitly linked.':'Registered metadata only; no retained original or evidence citation is established.'}`,`User-declared external location: ${reference.externalURL||reference.accessDetails}. This location is unverified; no remote file was fetched.`,`User-declared metadata: ${JSON.stringify(reference.declaredMetadata)}.`,...(reference.claimedSha256?[`User-declared, unverified checksum: ${reference.claimedSha256}.`]:[]),...(reference.linkedOriginal?[`Verified retained original: version ${reference.linkedOriginal.versionId}; SHA256 ${reference.linkedOriginal.sha256}; ${reference.linkedOriginal.size} bytes; ${reference.linkedOriginal.mediaType}. Linked by ${reference.linkedBy} at ${reference.linkedAt}. ${reference.linkStatement}`]:[])]);
  for (const obligation of snapshot.obligations) add("Contractual scope obligation", [`${obligation.text || "No obligation text recorded"}`, `Source version: ${obligation.sourceVersionId || "Not recorded"}; ${obligation.locator || "locator not recorded"}. Deliverables: ${(obligation.deliverableIds || []).join("; ") || "Not linked"}.`, `Scope-review status: ${human(obligation.status)}. Confirmed by ${obligation.confirmedBy || "Not recorded"}. ${obligation.confirmationStatement || ""}`]);
  const citation = id => {
    const assertion = snapshot.assertions.find(assertion => assertion.id === id);if (!assertion) return [`Unresolved evidence assertion ${id}.`];
    const source = snapshot.sourceVersions.find(source => source.id === assertion.versionId);
    return [`${source?.title || source?.filename || "Retained source"}${source?.filename ? ` (${source.filename})` : ""}. ${assertion.locator || "Locator not recorded"}.`,
      `Assertion ${assertion.id}; version ${assertion.versionId}; SHA256 ${assertion.sourceSha256 || source?.sha256 || "Not recorded"}.`, `Quoted passage: ${assertion.quote || "No quotation recorded"}`, ...(assertion.note ? [`Evidence interpretation: ${assertion.note}`] : [])];
  };
  for (const requirement of snapshot.requirements) {
    const finding = snapshot.findings.find(finding => finding.requirementId === requirement.id);
    const paragraphs = [`${requirement.authority || ""} · ${requirement.frameworkName || requirement.frameworkId || ""} · edition ${requirement.edition || "Not recorded"} · ${requirement.standard || ""} · ${requirement.clause || ""}`,
      `Requirement or review prompt: ${requirement.text || requirement.title || "No text recorded"}`, `Text kind: ${human(requirement.textKind || "not recorded")}. Coverage: ${requirement.coverageNote || "The selected criterion does not establish complete institutional requirement coverage."}`];
    for (const source of requirement.sources || []) paragraphs.push(`Framework source: ${source.title || "Untitled source"}. ${source.url || ""} ${source.locator || ""}${source.sha256 ? ` SHA256 ${source.sha256}.` : ""}`);
    if (requirement.definition?.detail?.context) paragraphs.push(`Retained source context: ${JSON.stringify(requirement.definition.detail.context)}`);
    if (!finding) paragraphs.push("No finding is recorded for this requirement.");
    else paragraphs.push(`Applicability: ${human(finding.applicability)}. ${finding.applicabilityRationale || ""}`, `Evidence coverage: ${human(finding.coverage)}. Evidence adequacy: ${human(finding.adequacy)}. Project performance: ${human(finding.performance)}.`,
      `Professional finding: ${finding.rationale || "Not recorded"}`, `Deficiency: ${finding.deficiency || "None recorded"}`, `Recommendation: ${finding.recommendation || "None recorded"}`, `Uncertainty: ${finding.uncertainty || "None recorded"}. Risk significance: ${finding.riskSignificance || "Not recorded"}.`,
      `Review decision: ${human(finding.reviewDecision || finding.status || "not recorded")}. Reviewed by ${finding.reviewedBy || "Not recorded"} at ${finding.reviewedAt || "Not recorded"}. ${finding.reviewStatement || ""}`,
      ...(Object.hasOwn(finding,"reviewDurationMinutes")?[`Self-reported review duration: ${finding.reviewDurationMinutes} minutes.`]:[]),
      "Supporting evidence", ...(finding.supportingAssertionIds || []).flatMap(citation), "Contradictory or qualifying evidence", ...((finding.contradictoryAssertionIds || []).length ? finding.contradictoryAssertionIds.flatMap(id => {const disposition=finding.contradictionDispositions?.find(item=>item.assertionId===id);return [...citation(id),`Disposition: ${human(disposition?.disposition||"unresolved")}. Reasoning: ${disposition?.rationale||"No disposition reasoning recorded; this contradiction remains unresolved."}`];}) : ["None recorded."]));
    if (finding?.cycleId) {
      paragraphs.push(`Implementation: ${human(finding.implementation || "not_assessed")}. Effectiveness: ${human(finding.effectiveness || "not_assessed")}. Compliance: ${human(finding.performance)}. Evidence sufficiency: ${human(finding.evidenceSufficiency || "inconclusive")}. Residual risk: ${human(finding.residualRisk || "unknown")}. Risk trajectory: ${human(finding.riskTrajectory || "unknown")}.`);
      const prior = (snapshot.priorFindings || []).find(record => record.id === finding.priorFindingId);
      paragraphs.push(prior ? `Prior-period comparison: finding ${prior.id}, cycle ${prior.cycleId || "due diligence baseline"}; performance ${human(prior.performance)}, implementation ${human(prior.implementation || "not_assessed")}, effectiveness ${human(prior.effectiveness || "not_assessed")}, residual risk ${human(prior.residualRisk || "unknown")}. Prior rationale: ${prior.rationale || "Not recorded"}. These are distinct judgments for their respective periods.` : "No explicit prior-period finding link is recorded; no improvement is inferred.");
    }
    add(`Findings — ${requirement.title || requirement.clause || requirement.id}`, paragraphs);
  }
  add("Conclusions and required follow-up", [`${snapshot.findings.filter(finding => finding.performance === "undetermined").length} findings leave project performance undetermined; ${snapshot.findings.filter(finding => ["noncompliant", "partially_compliant"].includes(finding.performance)).length} record an adverse performance determination. These conclusions apply only to the individually identified requirements, scope and evidence above.`, "Resolve each recorded deficiency and uncertainty through its linked actions and substantive verification criteria. New evidence or a revised judgment requires a new reviewed baseline; it does not rewrite this issued assessment."]);
  add("Corrective action plan and verification", ["Actions below address the originating findings and retain responsibility, timing, deliverables and substantive outcome-verification tests. Verified closure of an action does not automatically revise the assessment's performance conclusion."]);
  for (const action of active) add(action.description || "Corrective action", [`Owner: ${action.owner || "Not assigned"}. Responsible organization: ${action.organization || "Not recorded"}. Priority: ${human(action.priority)}.`,
    ...(action.reviewer?[`Assigned action reviewer: ${action.reviewer}. Assigned by ${action.reviewerAssignedBy} at ${action.reviewerAssignedAt}. ${action.reviewerAssignmentStatement}`]:[]),
    `Deadline: ${action.dueDate || "Milestone-based"}. Trigger: ${human(action.trigger)}. ${action.triggerDetail || ""}`, `Required deliverables: ${(action.deliverables || []).join("; ") || "None recorded"}.`,
    `Substantive verification criteria: ${action.verificationCriteria || "Not recorded"}`, `Status: ${human(action.status)}. Progress: ${action.progress || "None recorded"}.`,
    `Source findings: ${(action.findingIds || []).join("; ")}. Dependencies: ${(action.dependencies || []).join("; ") || "None"}.`,
    ...(action.status === "closed" ? [`Closure review: ${action.closureNote || "Not recorded"}. ${action.closureAttestation || ""}`, `Verified by ${action.closedBy || "Not recorded"} at ${action.closedAt || "Not recorded"}.`, ...(action.closureAssertionIds || []).flatMap(citation)] : []),
    ...(action.consolidatedFrom?.length ? [`Consolidated from retained actions: ${action.consolidatedFrom.join("; ")}. Originals remain in the structured appendix.`] : [])]);
  for (const approval of snapshot.approvals) add(`Professional sign-off — ${human(approval.kind)}`, [`${approval.actorId || "Unattributed"} · ${approval.at || "Time not recorded"} · ${approval.authority || "Declared local professional role"}${approval.cycleId ? ` · reporting cycle ${approval.cycleId}` : " · engagement-level attestation"}`, approval.statement || "No attestation recorded"]);
  add("Evidence register and exact source versions", ["The following retained source assertions include any records not cited in the current finding cards. Original bytes remain under the project's source authority; references and hashes do not by themselves grant permission to disclose originals."]);
  for (const assertion of snapshot.assertions) add("Retained evidence", [...citation(assertion.id), `Evidence review: ${human(assertion.reviewStatus)}; contributor ${assertion.provenance?.actorId || "Not recorded"}; method ${assertion.provenance?.method || assertion.provenance?.kind || "Not recorded"}.`]);
  for (const source of snapshot.sourceVersions) add("Source version", [`${source.title || source.filename || source.id} · file ${source.filename || "Not recorded"}. Version ${source.id}; SHA256 ${source.sha256}; ${source.size ?? "unknown"} bytes; media type ${source.mediaType || "Not recorded"}.`]);
  return result;
}

function addMonitoringNarrative(snapshot, add) {
  const selected = snapshot.reportSelection, cycle = (snapshot.cycles || []).find(record => record.id === selected.cycleId), program = (snapshot.programs || []).find(record => record.id === cycle?.programId);
  add("Monitoring program and reporting period", [`Program: ${program?.name || "Not recorded"}. Supervisory scope: ${program?.scope || "Not recorded"}. Responsible owner: ${program?.owner || "Not recorded"}; reviewer: ${program?.reviewer || "Not recorded"}.`,
    `Reporting cycle: ${cycle?.name || "All recorded periods"}. Period: ${cycle?.periodStart || "Not selected"} to ${cycle?.periodEnd || "Not selected"}. Submission deadline: ${cycle?.dueDate || "Not recorded"}. Frequency: ${program?.frequency || "Not recorded"}.`,
    `Report selection: ${human(selected.reportType)}; institution/framework: ${selected.frameworkId || "all separately assessed frameworks"}; mission: ${selected.missionId || "all in selected period"}; event: ${selected.eventId || "all in selected period"}.`,
    "Implementation, effectiveness, evidence sufficiency, compliance and risk are separate judgments. A submitted document, completed task or aggregate risk score does not establish a fulfilled obligation or effective mitigation."]);
  if(selected.reportType==="institutional"){
    const first=snapshot.requirements[0],titles={ifc_ps_2012:"IFC Performance Standards monitoring perspective",wb_esf_2016:"World Bank Environmental and Social Standards monitoring perspective"};
    add(titles[selected.frameworkId]||`${first?.authority||"Selected institution"} monitoring perspective`,[`Selected authority: ${first?.authority||"Not recorded"}; framework ${first?.frameworkName||selected.frameworkId||"Not recorded"}. Editions: ${[...new Set(snapshot.requirements.map(record=>record.edition||"not recorded"))].join("; ")}.`,
      "This practitioner template applies the recorded institution's edition-specific criteria to the shared observations. It retains that framework's own applicability, implementation, effectiveness, substantive compliance, evidence sufficiency and risk judgments. It is not an official lender submission form, certification, or a conclusion for other institutions.",
      ...snapshot.requirements.map(record=>`Institutional assessment scope: ${record.standard||record.frameworkId}; ${record.clause||"clause not recorded"}; ${record.title||"criterion"}. Criterion type ${human(record.textKind||"not recorded")}; ${record.coverageNote||"Only the selected sourced criteria are covered; complete institutional coverage is not asserted."}`),
      ...(snapshot.mappings||[]).map(mapping=>`Recorded cross-framework interpretation: ${mapping.sourceRequirementId} → ${mapping.targetRequirementId}; ${human(mapping.relation)}; ${mapping.rationale||"No rationale recorded"}; mapping version ${mapping.version||"not recorded"}. A topic match or mapping does not establish equivalent duties or substitute another institution's compliance determination.`)]);
  }
  const attention = snapshot.attention;
  if (attention) add("Risk dashboard and required intervention", [`As of approved baseline date ${attention.asOf}: ${attention.openObligations} open obligations; ${attention.overdueObligations.length} overdue obligations; ${attention.activeEvents.length} active events; ${attention.pendingRequests.length} outstanding information requests.`,
    `Supervision priority score: ${attention.priorityScore}. Factors ${JSON.stringify(attention.factors)}; weights ${JSON.stringify(attention.weights)}. ${attention.meaning}`,
    ...(attention.programContributions||[]).map(part=>`Program ${part.programId}: weighted contribution ${part.priorityScore}; factors ${JSON.stringify(part.factors)}; configured weights ${JSON.stringify(part.weights)}.`),
    `Overdue obligation references: ${attention.overdueObligations.join("; ") || "None"}. Significant event and increasing-risk records require individual review regardless of the total score.`]);
  add("Obligations and commitments tracker", ["Legal and continuing obligations remain distinct from their operational actions. Closure of a task does not close an obligation; the recorded verification decision governs."]);
  for (const obligation of snapshot.monitoringObligations || []) add(obligation.title || "Monitoring obligation", [`Owner: ${obligation.owner}; organization: ${obligation.organization || "Not recorded"}. Status: ${human(obligation.status)}. Due date: ${obligation.dueDate || "Event or milestone"}. Trigger: ${human(obligation.trigger)}; ${obligation.triggerDetail || ""}.`,
    `Exact obligation source: version ${obligation.sourceVersionId}; ${obligation.locator || "Locator not recorded"}; SHA256 ${snapshot.sourceVersions.find(source => source.id === obligation.sourceVersionId)?.sha256 || "Not recorded"}.`,
    `Verification criteria: ${obligation.verificationCriteria || "Not recorded"}. Requirements: ${(obligation.requirementIds || []).join("; ")}. Origin findings: ${(obligation.originFindingIds || []).join("; ")}. Expected submissions: ${(obligation.expectedSubmissions || []).join("; ")}.`,
    ...(obligation.recurrence?[`Recurring schedule: every ${obligation.recurrence.every} ${obligation.recurrence.unit}; first due ${obligation.recurrence.firstDueDate}; until ${obligation.recurrence.untilDate||"continuing"}. Settling one occurrence does not close the continuing obligation.`]:[]),
    ...(obligation.occurrences||[]).map(occurrence=>`Occurrence ${occurrence.label||occurrence.id}: due ${occurrence.dueDate}; status ${human(occurrence.status)}; cycle ${occurrence.cycleId||"not assigned"}; event ${occurrence.eventId||"not assigned"}; trigger basis ${occurrence.triggerStatement||"not recorded"}; verification ${occurrence.lastVerificationId||"not complete"}; source assertions ${(occurrence.assertionIds||[]).join("; ")||"not linked"}; resolved by ${occurrence.resolvedBy||"not resolved"} at ${occurrence.resolvedAt||"not recorded"}.`)]);
  for (const submission of snapshot.submissions || []) add("Client submissions and review", [`${submission.title}; received ${submission.receivedAt}; submitted by ${submission.submittedBy || "Not recorded"}; period ${submission.periodStart} to ${submission.periodEnd}.`, `Completeness: ${human(submission.completeness)}. Review: ${submission.reviewNote || "Not recorded"}. Original versions: ${(submission.versionIds || []).join("; ")}. Related obligations: ${(submission.obligationIds || []).join("; ")}.`]);
  for (const request of snapshot.requests || []) add("Client information request", [`${request.title}; owner ${request.owner}; due ${request.dueDate}; status ${human(request.status)}.`, request.description, `Response submissions: ${(request.submissionIds || []).join("; ") || "None"}. Review: ${request.reviewNote || "Not recorded"}.`]);
  for (const indicator of snapshot.indicators || []) {
    const values = (snapshot.measurements || []).filter(record => record.indicatorId === indicator.id), comparison = compareMonitoringMeasurements(values);
    add(`Indicator series — ${indicator.name}`, [`Unit ${indicator.unit}; method ${indicator.method}; frequency ${indicator.frequency}; location ${indicator.location}; laboratory ${indicator.lab || "Not recorded"}; detection limit ${indicator.detectionLimit || "Not recorded"}; threshold ${JSON.stringify(indicator.threshold || {})}.`,
      ...values.map(value => `${value.observedAt}: ${value.value} ${value.unit}; cycle ${value.cycleId}; location ${value.location}; method ${value.method}; laboratory ${value.lab}; detection limit ${value.detectionLimit}; quality ${human(value.dataQuality)}; evidence ${(value.assertionIds || []).join("; ")}. ${value.note || ""}`),
      `Comparability: ${comparison.comparable ? "comparable context" : "not comparable"}. ${comparison.reason}${comparison.comparable ? ` Observed difference ${comparison.delta}; threshold exceeded ${comparison.thresholdExceeded === null ? "not determined" : comparison.thresholdExceeded}. This is a contextual observation, not an automatic compliance finding.` : " No numerical trend conclusion is made."}`]);
  }
  for (const mission of snapshot.missions || []) add(`Field mission — ${mission.name}`, [`Status ${human(mission.status)}; ${mission.startDate} to ${mission.endDate}; team ${(mission.team || []).join("; ")}; locations ${(mission.locations || []).join("; ")}.`, `Scope: ${mission.scope || "Not recorded"}. Itinerary: ${mission.itinerary || "Not recorded"}. Protocols: ${(mission.protocols || []).join("; ")}.`,
    `Mission assessment: ${mission.report || "Not recorded"}. Review: ${mission.reviewStatement || "Not recorded"}. Field originals: ${(mission.captureVersionIds || []).join("; ")}. Evidence assertions: ${(mission.assertionIds || []).join("; ")}.`,
    ...(mission.monitoringPoints || []).map(point => `Monitoring point ${point.label || point.id}; coordinates ${point.latitude}, ${point.longitude}; repeat-photo assertions ${(point.photoAssertionIds || []).join("; ")}.`)]);
  for (const event of snapshot.events || []) add(`Redacted event summary — ${event.code || event.id}`, [`${human(event.kind)}; severity ${human(event.severity)}; status ${human(event.status)}; occurrence ${event.occurredAt}; received ${event.receivedAt}.`, event.publicSummary || "No public summary recorded.", ...(event.restrictedAvailable ? ["Restricted investigative details, identities and linked quotations are withheld. The custody backup retains the protected record."] : [`Immediate measures: ${event.immediateMeasures || "Not recorded"}. Notification obligations: ${event.notificationObligations || "Not recorded"}.`, `Investigation: ${event.investigation || "Not recorded"}. Root cause: ${event.rootCause || "Not recorded"}. Response: ${event.response || "Not recorded"}.`, `Escalation: ${event.escalation || "Not recorded"}. Closure: ${event.closureStatement || "Not recorded"}.`]), `Linked actions: ${(event.actionIds || []).join("; ") || "None"}. An allegation is not automatically a verified noncompliance finding.`]);
  for (const verification of snapshot.verifications || []) add("Independent verification and follow-up decision", [`Target ${verification.targetType} ${verification.targetId}${verification.occurrenceId?`; occurrence ${verification.occurrenceId}`:""}; implementation ${human(verification.implementation)}; effectiveness ${human(verification.effectiveness)}; decision ${human(verification.decision)}; corroboration ${human(verification.independence)}.`, verification.statement, `Reviewer: ${verification.reviewStatement || "Not recorded"}. Exact evidence assertions: ${(verification.assertionIds || []).join("; ")}.`]);
}

function rows(snapshot) {
  const result = [["Baseline", snapshot.id, "format", snapshot.format], ["Baseline", snapshot.id, "schemaVersion", snapshot.schemaVersion], ["Baseline", snapshot.id, "baselineId", snapshot.id], ["Baseline", snapshot.id, "sha256", snapshot.sha256], ["Baseline", snapshot.id, "createdAt", snapshot.createdAt || ""], ["Baseline", snapshot.id, "previousBaselineId", snapshot.previousBaselineId || ""],
    ["Disclosure", snapshot.id, "notice", snapshot.disclosure || "Unredacted approved records and source metadata. This export does not redact stakeholder identities or location data; authorization and secure handling remain necessary."]];
  const visit = (section, id, value, path, depth = 0) => {
    if (depth > 30 || result.length > 150000) fail("This snapshot exceeds the structured export complexity limit.", 413);
    if (value !== null && typeof value === "object" && Object.keys(value).length) for (const [key, child] of Object.entries(value)) visit(section, id, child, path ? `${path}.${key}` : key, depth + 1);
    else result.push([section, id, path, value !== null && typeof value === "object" ? JSON.stringify(value) : text(value)]);
  };
  for (const [name, records] of sections(snapshot).groups) for (const record of records) visit(name, record.id || "", record, "");
  return result;
}

export function renderEngagementSnapshotHtml(snapshot, options = {}) {
  verifyEngagementSnapshot(snapshot);
  return renderPublicationHtml(publicationView(snapshot, options).view);
}
function renderPublicationHtml(snapshot) {
  const report = sections(snapshot), fields = rows(snapshot), groups = report.groups.map(([name]) => name), professional = narrative(snapshot).map(section => `<section><h2>${h(section.title)}</h2>${section.paragraphs.map(paragraph => `<p>${h(paragraph)}</p>`).join("")}</section>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h(report.title)}</title>
    <style>@page{size:A4;margin:16mm}body{font:11pt/1.5 sans-serif;color:#19352c;max-width:1100px;margin:2rem auto;padding:1rem}header{border-top:5px solid #236147}h1{font-size:23pt;line-height:1.2}h2{font-size:17pt;margin-top:2rem;break-after:avoid}table{border-collapse:collapse;width:100%;font-size:10pt}th,td{border:1px solid #cad5ce;padding:.5rem;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#edf2ee}thead{display:table-header-group}p{overflow-wrap:anywhere;white-space:pre-wrap}.notice{padding:.8rem;background:#fff3d8}code{overflow-wrap:anywhere}.structured{margin-top:3rem;border-top:2px solid #cad5ce}summary{font-weight:bold;cursor:pointer}@media print{body{max-width:none;margin:0;padding:0}tr{break-inside:auto}h2{break-after:avoid}.structured{display:none}}</style></head><body>
    <header><p>E&amp;S Review · approved engagement baseline</p><h1>${h(report.title)}</h1><p>${h(report.purpose)}</p><p>Baseline ${h(snapshot.id)}<br>SHA256 ${h(snapshot.sha256)}<br>Approved record created ${h(snapshot.createdAt)}</p></header>
    ${professional}
    <details class="structured"><summary>Structured appendix — ${snapshot.reportSelection ? "selected public records and retained prior findings" : "complete approved records and retained history"}</summary><p>${snapshot.disclosure ? h(snapshot.disclosure) : "This on-screen appendix preserves the complete approved graph, including earlier revisions. Printable reports present the current substantive findings, citations and actions above; JSON and spreadsheets provide the complete structured exchange."}</p>
    ${["Baseline", "Disclosure", ...groups].map(name => `<section><h2>${h(name)}</h2><table><thead><tr><th>Record</th><th>Field / relationship</th><th>Approved value</th></tr></thead><tbody>${fields.filter(row => row[0] === name).map(row => `<tr><td>${h(row[1])}</td><td>${h(human(row[2]))}</td><td>${h(row[3])}</td></tr>`).join("")}</tbody></table></section>`).join("")}</details></body></html>`;
}

const crcTable = Array.from({length: 256}, (_, index) => {let value = index;for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;return value >>> 0;});
function zip(entries) {
  const chunks = [], central = [];let offset = 0;
  for (const [name, source] of Object.entries(entries)) {
    const filename = Buffer.from(name), bytes = Buffer.from(source);let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20, 4);local.writeUInt16LE(0x800, 6);local.writeUInt32LE(crc, 14);local.writeUInt32LE(bytes.length, 18);local.writeUInt32LE(bytes.length, 22);local.writeUInt16LE(filename.length, 26);
    const header = Buffer.alloc(46);header.writeUInt32LE(0x02014b50);header.writeUInt16LE(20, 4);header.writeUInt16LE(20, 6);header.writeUInt16LE(0x800, 8);header.writeUInt32LE(crc, 16);header.writeUInt32LE(bytes.length, 20);header.writeUInt32LE(bytes.length, 24);header.writeUInt16LE(filename.length, 28);header.writeUInt32LE(offset, 42);
    chunks.push(local, filename, bytes);central.push(header, filename);offset += local.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length / 2, 8);end.writeUInt16LE(central.length / 2, 10);end.writeUInt32LE(directory.length, 12);end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}
const xml = value => h(value).replace(/\u0000|[\x01-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, "");
function split(value, size = 30000) {
  const result = [];let remaining = text(value);
  do {let end = Math.min(size, remaining.length);if (end < remaining.length && /[\uD800-\uDBFF]/.test(remaining[end - 1])) end--;result.push(remaining.slice(0, end));remaining = remaining.slice(end);} while (remaining.length);
  return result;
}
function docx(snapshot) {
  const paragraph = (value, style = "Normal") => split(value).map(part => `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${xml(part)}</w:t></w:r></w:p>`).join("");
  const body = paragraph(sections(snapshot).title, "Title") + narrative(snapshot).map(section => paragraph(section.title, "Heading1") + section.paragraphs.map(value => paragraph(value)).join("")).join("") + paragraph(snapshot.reportSelection ? "Structured appendix — selected public records and retained prior findings" : "Structured appendix — complete approved records and retained history", "Heading1") + rows(snapshot).map(([section, id, field, value]) => paragraph(`${section} · ${id} · ${field}`, "Heading2") + paragraph(value)).join("");
  const styles = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:color w:val="19352C"/></w:rPr></w:rPrDefault></w:docDefaults>${[["Normal", 22], ["Title", 44], ["Heading1", 30], ["Heading2", 24]].map(([name, size]) => `<w:style w:type="paragraph" w:styleId="${name}"><w:name w:val="${name}"/><w:pPr><w:spacing w:before="${name === "Normal" ? 0 : 240}" w:after="140"/>${name === "Normal" ? "" : "<w:keepNext/>"}</w:pPr><w:rPr><w:sz w:val="${size}"/>${name === "Normal" ? "" : "<w:b/>"}</w:rPr></w:style>`).join("")}</w:styles>`;
  return zip({"[Content_Types].xml": '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/_rels/document.xml.rels": '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "word/styles.xml": styles,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>`});
}
async function xlsx(snapshot) {
  const workbook = new ExcelJS.Workbook();workbook.creator = "E&S Review";workbook.subject = `Approved baseline ${snapshot.id}; SHA256 ${snapshot.sha256}`;
  const sheet = workbook.addWorksheet("Approved records", {views: [{state: "frozen", ySplit: 1}], pageSetup: {orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1"}});
  sheet.columns = [{width: 28}, {width: 40}, {width: 28}, {width: 38}, {width: 80}, {width: 28}, {width: 70}];
  sheet.addRow(["Register", "Record ID", "Field / relationship", "Part", "Approved value", "Baseline ID", "Baseline SHA256"]);
  for (const [section, id, field, value] of rows(snapshot)) for (const [part, chunk] of split(value).entries()) sheet.addRow([section, id, field, String(part + 1), chunk, snapshot.id, snapshot.sha256]);
  sheet.eachRow(row => {row.alignment = {vertical: "top", wrapText: true};row.eachCell(cell => {cell.numFmt = "@";});});
  sheet.getRow(1).font = {bold: true};sheet.autoFilter = "A1:G1";
  const citation = ids => (ids || []).map(id => {
    const assertion = snapshot.assertions.find(item => item.id === id);
    return assertion ? `${id}; version ${assertion.versionId}; SHA256 ${assertion.sourceSha256}; ${assertion.locator}; ${assertion.quote}` : `Unresolved assertion ${id}`;
  }).join("\n\n");
  const addMatrix = (name, columns, records) => {
    const target = workbook.addWorksheet(name, {views: [{state: "frozen", ySplit: 1}], pageSetup: {orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1"}});
    target.columns = columns.map((_, index) => ({width: index ? 40 : 28}));target.addRow(columns);
    for (const values of records) {
      const parts = values.map(value => split(value));
      for (let index = 0; index < Math.max(...parts.map(part => part.length)); index++) target.addRow(parts.map(part => part[index] || ""));
    }
    target.eachRow(row => {row.alignment = {vertical: "top", wrapText: true};row.eachCell(cell => {cell.numFmt = "@";});});target.getRow(1).font = {bold: true};
  };
  const reviewDurationColumn=snapshot.findings.some(finding=>Object.hasOwn(finding,"reviewDurationMinutes"));
  const contradictionColumn=snapshot.findings.some(finding=>finding.contradictoryAssertionIds?.length);
  const dispositionText=finding=>(finding.contradictoryAssertionIds||[]).map(id=>{const value=finding.contradictionDispositions?.find(item=>item.assertionId===id);return `${id}: ${value?.disposition||"unresolved"}. ${value?.rationale||"No disposition reasoning recorded."}`;}).join("\n\n");
  addMatrix("Requirements matrix", ["Requirement ID", "Framework / edition", "Clause", "Requirement", "Applicability", "Coverage", "Adequacy", "Performance", "Supporting citations", "Contradictory citations", "Rationale", "Deficiency", "Recommendation", "Baseline ID", "Baseline SHA256", "Finding ID", "Review status", "Review decision", "Reviewer", "Reviewed at", "Substantive review statement",...(reviewDurationColumn?["Self-reported review duration (minutes)"]:[]),...(contradictionColumn?["Contradictory citation dispositions and reasoning"]:[])], snapshot.requirements.flatMap(requirement => {
    const findings = snapshot.findings.filter(item => item.requirementId === requirement.id);
    return (findings.length ? findings : [{}]).map(finding => [requirement.id, `${requirement.authority} / ${requirement.frameworkName} / ${requirement.edition}`, requirement.clause, requirement.text || requirement.title,
      finding.applicability || "not assessed", finding.coverage || "not determined", finding.adequacy || "not determined", finding.performance || "not assessed", citation(finding.supportingAssertionIds), citation(finding.contradictoryAssertionIds), finding.rationale, finding.deficiency, finding.recommendation, snapshot.id, snapshot.sha256,finding.id,finding.status,finding.reviewDecision,finding.reviewedBy,finding.reviewedAt,finding.reviewStatement,...(reviewDurationColumn?[finding.reviewDurationMinutes]:[]),...(contradictionColumn?[dispositionText(finding)]:[])]);
  }));
  const actionReviewerColumns=snapshot.actions.some(action=>action.reviewer);
  addMatrix("Action plan", ["Action ID", "Source findings", "Action", "Owner", "Organization", "Priority", "Due date / trigger", "Deliverables", "Verification criteria", "Status", "Progress", "Closure citations", "Baseline ID", "Baseline SHA256", "Approval status", "Closure reviewer", "Closed at", "Closure verification outcome", "Closure attestation", "Dependencies",...(actionReviewerColumns?["Assigned reviewer","Reviewer assigned by","Reviewer assigned at","Reviewer assignment rationale"]:[])], snapshot.actions.map(action =>
    [action.id, (action.findingIds || []).join("; "), action.description, action.owner, action.organization, action.priority, `${action.dueDate || ""} / ${action.trigger || ""} / ${action.triggerDetail || ""}`, (action.deliverables || []).join("; "), action.verificationCriteria, action.status, action.progress, citation(action.closureAssertionIds), snapshot.id, snapshot.sha256,action.approvalStatus,action.closedBy,action.closedAt,action.closureNote,action.closureAttestation,(action.dependencies||[]).join("; "),...(actionReviewerColumns?[action.reviewer,action.reviewerAssignedBy,action.reviewerAssignedAt,action.reviewerAssignmentStatement]:[])]));
  if(snapshot.sourceReviews)addMatrix('Source review history',['Record ID','Mode','Practitioner','Time','Statement','Query','Retrieval','Index ID','Corpus SHA256','Source version','Original SHA256','Total file pages','Searched file pages','Candidate file pages','Reviewed original pages','Unreadable pages','Excluded ranges','Baseline ID'],snapshot.sourceReviews.flatMap(record=>(record.search?.sources||[record.review]).map(source=>[record.id,record.mode,record.createdBy,record.createdAt,record.statement,record.search?.query,record.search?.retrieval,record.search?.indexId,record.search?.corpusSha256,source.versionId,source.sourceSha256,source.totalPages,source.searchedPages?.join(', '),source.candidatePages?.join(', '),source.pages?.join(', '),source.unreadablePages?.join(', '),source.excludedRanges?.map(range=>`${range.startPage}–${range.endPage}`).join(', '),snapshot.id])));
  if(snapshot.bibliography)addMatrix('Bibliography',['Reference ID','Citation','Use in engagement','Source category','Resource ID','Resource version ID','Instrument ID','Edition review','Baseline ID'],snapshot.bibliography.map(reference=>[reference.id,bibliographyText(reference),reference.purpose,reference.authorityKind,reference.resourceId,reference.resourceVersionId,reference.instrumentId,reference.statement,snapshot.id]));
  if(snapshot.externalReferences)addMatrix('External references',['Reference ID','Declared title','Declared filename','External URL (unverified)','Access details (unverified)','Declared metadata','Declared SHA256 (unverified)','Status','Linked original version','Verified original SHA256','Original bytes','Original media type','Linked by','Linked at','Link review','Registration review','Baseline ID','Baseline SHA256'],snapshot.externalReferences.map(reference=>[reference.id,reference.title,reference.filename,reference.externalURL,reference.accessDetails,JSON.stringify(reference.declaredMetadata||{}),reference.claimedSha256,reference.status,reference.linkedOriginal?.versionId,reference.linkedOriginal?.sha256,reference.linkedOriginal?.size,reference.linkedOriginal?.mediaType,reference.linkedBy,reference.linkedAt,reference.linkStatement,reference.registrationStatement,snapshot.id,snapshot.sha256]));
  if (snapshot.reportSelection) {
    addMatrix("Performance compliance", ["Finding", "Cycle", "Framework edition", "Requirement", "Adequacy", "Implementation", "Effectiveness", "Compliance", "Evidence sufficiency", "Residual risk", "Risk trajectory", "Prior finding", "Supporting citations", "Contradictory citations", "Baseline ID", "Source baseline SHA256",...(contradictionColumn?["Contradictory citation dispositions and reasoning"]:[])], snapshot.findings.map(finding => {
      const requirement = snapshot.requirements.find(record => record.id === finding.requirementId) || {};
      return [finding.id, finding.cycleId, `${requirement.authority} / ${requirement.edition}`, requirement.title, finding.adequacy, finding.implementation, finding.effectiveness, finding.performance, finding.evidenceSufficiency, finding.residualRisk, finding.riskTrajectory, finding.priorFindingId, citation(finding.supportingAssertionIds), citation(finding.contradictoryAssertionIds), snapshot.id, snapshot.sha256,...(contradictionColumn?[dispositionText(finding)]:[])];
    }));
    addMatrix("Obligation tracker", ["Obligation", "Title", "Owner", "Organization", "Trigger", "Due date", "Status", "Verification criteria", "Original version", "Locator", "Source SHA256", "Baseline ID", "Recurring schedule", "Occurrence decisions"], (snapshot.monitoringObligations || []).map(record => [record.id, record.title, record.owner, record.organization, `${record.trigger}: ${record.triggerDetail}`, record.dueDate, record.status, record.verificationCriteria, record.sourceVersionId, record.locator, snapshot.sourceVersions.find(source => source.id === record.sourceVersionId)?.sha256, snapshot.id,JSON.stringify(record.recurrence||null),JSON.stringify(record.occurrences||[])]));
    addMatrix("Indicator series", ["Indicator", "Cycle", "Observed", "Value", "Unit", "Method", "Location", "Lab", "Detection limit", "Threshold", "Data quality", "Evidence citations", "Baseline ID"], (snapshot.measurements || []).map(record => [record.indicatorId, record.cycleId, record.observedAt, record.value, record.unit, record.method, record.location, record.lab, record.detectionLimit, JSON.stringify(record.threshold || {}), record.dataQuality, citation(record.assertionIds), snapshot.id]));
    addMatrix("Redacted events", ["Code", "Kind", "Cycle", "Severity", "Status", "Public summary", "Occurred", "Actions", "Restricted details withheld", "Baseline ID"], (snapshot.events || []).map(record => [record.code, record.kind, record.cycleId, record.severity, record.status, record.publicSummary, record.occurredAt, (record.actionIds || []).join("; "), record.restrictedAvailable ? "yes" : "no", snapshot.id]));
    addMatrix("Risk dashboard", ["As of", "Score", "Factors", "Weights", "Overdue obligations", "Active events", "Pending information", "Interpretation", "Baseline ID", "Source baseline SHA256", "Per-program weighted contributions"], [[snapshot.attention.asOf, snapshot.attention.priorityScore, JSON.stringify(snapshot.attention.factors), JSON.stringify(snapshot.attention.weights), snapshot.attention.overdueObligations.join("; "), snapshot.attention.activeEvents.join("; "), snapshot.attention.pendingRequests.join("; "), snapshot.attention.meaning, snapshot.id, snapshot.sha256, JSON.stringify(snapshot.attention.programContributions||[])]]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function pdf(snapshot) {
  if (activePdfExports >= 1) fail("A local PDF export is already running. Retry explicitly after it finishes.", 429);
  const executable = process.env.ESIA_CHROMIUM || ["/usr/lib64/chromium-browser/chromium-browser", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(existsSync);
  if (!executable) fail("PDF export needs an installed Chromium executable. HTML remains available for printing.", 503);
  const directory = mkdtempSync(join(tmpdir(), "esia-engagement-print-"));let child;activePdfExports++;
  try {
    const html = join(directory, "approved.html"), output = join(directory, "approved.pdf");writeFileSync(html, renderPublicationHtml(snapshot), {mode: 0o600});
    await new Promise((resolve, reject) => {
      let diagnostic = "";
      const stop = () => {if (child?.pid) {try {process.kill(-child.pid, "SIGKILL");} catch {try {child.kill("SIGKILL");} catch {}}}};
      child = spawn(executable, ["--headless", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-background-networking", "--disable-component-update", "--disable-default-apps", "--disable-sync", "--no-first-run", "--no-default-browser-check", "--metrics-recording-only", "--host-resolver-rules=MAP * ~NOTFOUND", "--proxy-server=127.0.0.1:9", "--proxy-bypass-list=<-loopback>", `--user-data-dir=${join(directory, "browser")}`, "--no-pdf-header-footer", `--print-to-pdf=${output}`, pathToFileURL(html).href], {detached: true, stdio: ["ignore", "ignore", "pipe"]});
      child.stderr.on("data", chunk => {if (diagnostic.length < 4000) diagnostic += chunk.toString().slice(0, 4000 - diagnostic.length);});
      const timer = setTimeout(() => {stop();reject(Object.assign(Error("PDF rendering exceeded its 20 second limit."), {status: 503}));}, 20000);
      child.once("error", error => {clearTimeout(timer);stop();reject(Object.assign(Error(`PDF renderer unavailable: ${error.code || "execution failed"}`), {status: 503}));});
      child.once("close", (code, signal) => {clearTimeout(timer);stop();code === 0 ? resolve() : reject(Object.assign(Error(`The local PDF renderer did not complete (${code ?? signal}).`), {status: 503, diagnostic}));});
    });
    if (!existsSync(output) || statSync(output).size > 64 * 1024 * 1024) fail("The local PDF exceeds its bounded output limit or was not created.", 413);
    const bytes = readFileSync(output);if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) fail("The PDF renderer did not produce a PDF.", 503);return bytes;
  } finally {activePdfExports--;if (child?.pid) {try {process.kill(-child.pid, "SIGKILL");} catch {}}rmSync(directory, {recursive: true, force: true});}
}

export async function exportEngagementSnapshot(snapshot, format, options = {}) {
  verifyEngagementSnapshot(snapshot);
  const {view, projection} = publicationView(snapshot, options);
  const stem = `engagement-${String(snapshot.id).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100)}${view.reportTemplate ? `-${view.reportTemplate.id}-v${view.reportTemplate.version}` : ""}`;
  const media = {html: "text/html; charset=utf-8", pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv; charset=utf-8", json: "application/json; charset=utf-8"};
  if (!Object.hasOwn(media, format)) fail("Choose html, pdf, docx, xlsx, csv or json export.");
  let bytes;
  if (format === "json") bytes = Buffer.from(JSON.stringify(projection ? {format: view.reportTemplate ? "esia-engagement-template-report" : "esia-monitoring-report", schemaVersion: 1, sourceBaseline: {id: snapshot.id, sha256: snapshot.sha256}, selection: view.reportSelection || null, ...(view.reportTemplate ? {template: view.reportTemplate} : {}), disclosure: view.disclosure || (view.reportTemplate ? "An application-authored report projection of the identified approved baseline. Its source baseline SHA256 identifies the retained assessment records, not this report's bytes." : undefined), records: Object.fromEntries(Object.entries(view).filter(([key]) => !["format", "schemaVersion", "id", "sha256", "reportSelection", "reportTemplate", "disclosure"].includes(key)))} : snapshot, null, 2));
  else if (format === "html") bytes = Buffer.from(renderPublicationHtml(view));
  else if (format === "pdf") bytes = await pdf(view);
  else if (format === "docx") bytes = docx(view);
  else if (format === "xlsx") bytes = await xlsx(view);
  else {
    const safe = value => {let content = text(value);if (/^[\s\x00-\x1f]*[=+@-]/.test(content)) content = `'${content}`;return `"${content.replaceAll('"', '""')}"`;};
    bytes = Buffer.from([["Register", "Record ID", "Field / relationship", "Approved value", "Baseline ID", "Source baseline SHA256"], ...rows(view).map(row => [...row, snapshot.id, snapshot.sha256])].map(row => row.map(safe).join(",")).join("\r\n"));
  }
  return {bytes, mediaType: media[format], filename: `${stem}.${format}`};
}
