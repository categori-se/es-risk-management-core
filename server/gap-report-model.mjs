import {createHash} from "node:crypto";
import {frameworks} from "../src/lib/framework-register.js";

export const gapReportRendererVersion = "gap-report-1";
export const gapReportConclusions = Object.freeze({gap: "Gap", conforms: "Conforms", insufficient_evidence: "Insufficient evidence", not_applicable: "Not applicable"});
const clone = value => structuredClone(value);
const tuple = (...values) => JSON.stringify(values);
const frameworkKey = value => tuple(value.authority, value.name, value.edition);
const stableId = value => createHash("sha256").update(value).digest("hex").slice(0, 24);
const freeze = value => {if (value && typeof value === "object" && !Object.isFrozen(value)) {Object.freeze(value);Object.values(value).forEach(freeze);} return value;};
const counts = () => ({gap: 0, conforms: 0, insufficient_evidence: 0, not_applicable: 0});
const safeText = value => value === undefined || value === null ? "" : typeof value === "string" ? value : JSON.stringify(value, null, 2);

export function reportStandard(assessment) {
  const clause = assessment.framework.clause.trim();
  // Audit handoff stores the exact source section before a colon, including
  // cross-standard checks. Never duplicate such a finding into several tabs.
  if (assessment.auditContext && clause.includes(":")) return clause.slice(0, clause.indexOf(":")).trim();
  const codes = [...clause.matchAll(/\b(?:PS\s*[1-8]|ESS\s*\d{1,2}|SR\s*[1-4]|(?:OP|BP)\s*\d+\.\d+|Standard\s+\d+|Principle\s+\d+)\b/gi)]
    .map(match => match[0].replace(/^(PS|ESS|SR|OP|BP)\s+/i, "$1"));
  if (new Set(codes.map(code => code.toLowerCase())).size > 1) return "Cross-standard";
  if (codes.length) return codes[0].replace(/^(ps|ess|sr|op|bp)/i, value => value.toUpperCase());
  return "General requirements";
}

const standardRoster = profile => {
  if (["ifc_ps_2012", "ifc_ps_2006", "wb_private_ps_2012"].includes(profile.id)) return Array.from({length: 8}, (_, index) => `PS${index + 1}`);
  if (["wb_esf_2016", "adb_esf_2024"].includes(profile.id)) return Array.from({length: 10}, (_, index) => `ESS${index + 1}`);
  if (profile.id === "eib_2022") return Array.from({length: 11}, (_, index) => `Standard ${index + 1}`);
  if (profile.id === "equator_ep4_2020") return Array.from({length: 10}, (_, index) => `Principle ${index + 1}`);
  if (profile.id === "adb_sps_2009") return ["SPS", "SR1", "SR2", "SR3", "SR4"];
  return [...new Set(profile.checks.map(check => check.standard))];
};

/** Called at issue time only. Downloads never expand scope using today's catalog. */
export function createGapReportPresentation(project, {paperSize = "A4"} = {}) {
  if (!["A4", "Letter"].includes(paperSize)) throw Object.assign(new Error("Choose A4 or Letter report paper."), {status: 400});
  const selected = new Map();
  for (const assessment of project.assessments) {
    const key = frameworkKey(assessment.framework);
    if (!selected.has(key)) {
      const matching = frameworks.find(profile => profile.institution === assessment.framework.authority && profile.name === assessment.framework.name && profile.edition === assessment.framework.edition);
      selected.set(key, {authority: assessment.framework.authority, name: assessment.framework.name, edition: assessment.framework.edition,
        standards: matching ? standardRoster(matching) : [], basis: matching ? "Edition-specific standard headings retained at issue; not a complete requirement checklist." : "Only headings represented by recorded assessments; no complete standard roster is known."});
    }
    const entry = selected.get(key), standard = reportStandard(assessment);
    if (!entry.standards.includes(standard)) entry.standards.push(standard);
  }
  return {schemaVersion: 1, rendererVersion: gapReportRendererVersion, paperSize, frameworks: [...selected.values()]};
}

function sourceDetails(detail, definition) {
  const context = detail.context || definition.contexts?.[detail.contextRef] || {};
  return [
    `Source SHA256: ${detail.sourceSha256 || "Not retained"}; PDF file pages: ${(detail.pages || [detail.page]).join(", ")}; paragraph: ${detail.paragraph || "Not established"}; sentence: ${detail.sentenceIndex || "Not established"}`,
    `Source statement: ${detail.sourceText || "Not retained"}`,
    `Actor hint: ${detail.actor || "Unspecified"}; modality hints: ${(detail.modality || []).join(", ") || "None"}; classification: ${detail.classification || "Unreviewed"}; definition review: ${detail.reviewStatus || "unreviewed"}`,
    ...(detail.actorBasis ? [`Actor hint basis: ${detail.actorBasis}`] : []),
    ...(context.parentText ? [`Parent paragraph / qualification context:\n${context.parentText}`] : []),
    ...(context.listItems?.length ? [`Related list items:\n${context.listItems.map(safeText).join("\n")}`] : []),
    ...(context.footnotes?.length ? [`Footnote candidates (associations require review):\n${context.footnotes.map(safeText).join("\n")}`] : []),
    ...(context.previousText ? [`Previous source text:\n${context.previousText}`] : []),
    ...(context.nextText ? [`Following source text:\n${context.nextText}`] : []),
    ...(detail.extractionWarnings?.length ? [`Extraction warnings:\n${detail.extractionWarnings.join("\n")}`] : []),
    ...(detail.textFidelity ? [`Text fidelity: ${detail.textFidelity}`] : [])
  ].join("\n\n");
}

function findingBlocks(finding) {
  const blocks = [], add = (label, value) => {if (value !== undefined && value !== null && value !== "") blocks.push({label, value: safeText(value)});};
  add("Assessment identity", `${finding.id}\n${finding.framework.authority} · ${finding.framework.name} · ${finding.framework.edition}\n${finding.framework.clause}`);
  add("Requirement / review prompt", finding.requirement);
  add("Applicability", `${finding.applicability.decision}\n${finding.applicability.rationale}\nScope: ${finding.applicability.scope}\nPeriod: ${finding.applicability.period}`);
  add("Reviewed outcome", `${finding.conclusionLabel}\n${finding.rationale}`);
  add("Review provenance", `${finding.reviewer} · ${finding.reviewedAt}\nCollection: ${finding.checkSet}\nCheck: ${finding.checkId || "Custom assessment; no stable catalog requirement ID"}`);
  add("Risk significance", finding.riskSignificance || "Not recorded");
  add("Missing evidence", finding.missingEvidence || "None recorded");
  add("Uncertainty / conflicting information", finding.uncertainty || "None recorded");
  add("Repeated reviews", finding.historyNote);
  add("Check coverage", finding.coverage);
  if (finding.definitionReview) for (const [key, label] of Object.entries({actor: "Interpreted actor", requirement: "Interpreted duty", conditions: "Conditions / triggers", exceptions: "Exceptions / exclusions", verificationEvidence: "Verification evidence", reviewer: "Definition reviewer", reviewedAt: "Definition reviewed at"})) add(label, finding.definitionReview[key]);
  if (finding.sector) add("Sector screening context", `${finding.sector.name} (${finding.sector.id}); screening prompts do not determine applicability or compliance.`);
  for (const source of finding.sources) add("Framework source", `${source.title}\n${source.url}\n${source.locator || ""}${source.sha256 ? `\nSHA256: ${source.sha256}` : ""}`);
  if (!finding.evidence.length) add("Evidence", "No evidence cited; see missing evidence and uncertainty.");
  for (const evidence of finding.evidence) add(`Evidence ${evidence.id}`, [
    `${evidence.title}\nLocator: ${evidence.locator}\n${evidence.note}`,
    `Authors: ${evidence.authors.join("; ") || "Not recorded"}; document date: ${evidence.documentDate || "Not recorded"}`,
    `Tags: ${evidence.tags.map(tag => tag.label).join("; ") || "None recorded"}`,
    `Resource: ${evidence.resourceId}; version: ${evidence.versionId}; filename: ${evidence.filename}`,
    `SHA256: ${evidence.sha256}; custody at issue: ${evidence.mode}${evidence.mode === "registered" ? "; original bytes were not preserved at issue" : ""}`,
    `Qualified reference: ${JSON.stringify(evidence.reference)}`,
    ...(evidence.source ? [`Capture provenance: ${JSON.stringify(evidence.source)}`] : []),
    ...(evidence.externalReference ? [`External reference: ${JSON.stringify(evidence.externalReference)}`] : [])
  ].join("\n\n"));
  if (!finding.actions.length) add("Corrective actions", "No action recorded for this assessment at issue.");
  for (const action of finding.actions) {
    add(`Action ${action.id}`, `${action.description}\nOwner: ${action.owner}\nDue: ${action.dueDate}; status: ${action.status}${action.overdue ? "; overdue at issue" : ""}\nClosure evidence: ${action.closureEvidence}\nVerification: ${action.verification || "Not recorded"}`);
    if (action.revision) add("Action review", `Revision ${action.revision}; ${action.reviewer}; ${action.updatedAt}\n${action.updateNote}`);
    for (const cited of action.closureCitations || []) add(`Closure evidence ${cited.id}`, `${cited.locator}\n${cited.note}\nSource version: ${cited.versionId}; SHA256: ${cited.sha256}`);
  }
  const definition = finding.definition;
  if (definition) {
    add("Definition provenance", `Parser: ${definition.parserVersion}; extracted definition: ${definition.reviewStatus}. The project finding is separate from source-definition review.`);
    if (definition.detail) add("Retained source definition", sourceDetails(definition.detail, definition));
    if (definition.members) {
      add("Diagnostic grouping", `${definition.groupingBasis}\nMember IDs:\n${definition.memberIds.join("\n")}\nA group conclusion does not determine member conclusions.`);
      for (const member of definition.members) add(`Diagnostic member ${member.id}`, sourceDetails(member.detail, definition));
    }
  }
  return blocks;
}

/** Pure read of an already issued, validated report. No current project or catalog lookup. */
export function buildGapReportModel(report) {
  if (!report?.snapshot || !Array.isArray(report.snapshot.assessments)) throw new TypeError("An issued report snapshot is required.");
  const snapshot = report.snapshot, presentation = report.presentation;
  const groups = new Map(), notes = [
    "Counts describe retained assessment records, not a compliance percentage or a complete inventory of applicable requirements.",
    "All review records retained at issue are included. Repeated reviews are not automatically superseded; diagnostic group conclusions do not assign member conclusions.",
    "Action status and overdue flags are as of the report issue date. Later reviews, actions, source metadata and catalog changes do not rewrite this report."
  ];
  if (!presentation) notes.push("Legacy report: no standard roster was retained at issue. Only standards represented by recorded assessments can be shown; unassessed requirements and complete coverage are unknown.");
  else notes.push("Unassessed tabs identify retained standard headings without a recorded assessment. They are not a complete requirement checklist or an applicability decision.");
  const addGroup = (framework, standard, scopeBasis) => {
    const key = tuple(framework.authority, framework.name, framework.edition, standard);
    if (!groups.has(key)) {const id = stableId(key);groups.set(key, {id, anchorId: `standard-${id}`, authority: framework.authority, frameworkName: framework.name, edition: framework.edition, standard,
      label: `${framework.authority} · ${framework.edition} · ${standard}`, scopeBasis, findings: [], counts: counts(), actions: 0});}
    return groups.get(key);
  };
  for (const framework of presentation?.frameworks || []) for (const standard of framework.standards) addGroup(framework, standard, "retained_scope");
  const versions = new Map(snapshot.resources.flatMap(resource => resource.versions.map(version => [version.id, {resource, version}])));
  const evidence = new Map(snapshot.evidence.map(item => [item.id, item]));
  const actions = snapshot.actions.map(action => ({...clone(action), overdue: action.status !== "closed" && action.dueDate < report.issuedAt.slice(0, 10),
    ...(action.revision ? {closureCitations: action.closureEvidenceIds.map(id => {
      const cited = evidence.get(id), found = cited && versions.get(cited.versionId);
      if (!found) throw new Error("Action closure does not resolve to a retained source version.");
      return {...clone(cited), sha256: found.version.sha256};
    })} : {})}));
  const reviewKey = assessment => assessment.auditContext ? tuple(frameworkKey(assessment.framework), assessment.auditContext.checkSet, assessment.auditContext.checkId, assessment.applicability.scope, assessment.applicability.period) : `manual:${assessment.id}`;
  const repetitions = new Map();
  for (const assessment of snapshot.assessments) {const key = reviewKey(assessment);repetitions.set(key, (repetitions.get(key) || 0) + 1);}
  const findings = snapshot.assessments.map(assessment => {
    const context = assessment.auditContext, group = addGroup(assessment.framework, reportStandard(assessment), "recorded_assessments");
    const finding = {...clone(assessment), standardId: group.id, standard: group.standard, checkId: context?.checkId || "", checkSet: context?.checkSet || "manual",
      requirement: context?.definitionReview?.requirement || context?.definition?.detail?.sourceText || context?.prompt || assessment.framework.clause,
      conclusionLabel: gapReportConclusions[assessment.conclusion], coverage: context?.coverage || "Custom assessment; no complete catalog coverage recorded.",
      sources: clone(context?.sources || []), definitionReview: clone(context?.definitionReview || null), definition: clone(context?.definition || null),
      sector: context?.sector ? {id: context.sector.id, name: context.sector.name} : null,
      historyNote: repetitions.get(reviewKey(assessment)) > 1 ? `${repetitions.get(reviewKey(assessment))} review records share this framework, collection, check, scope and period. All are shown separately; no automatic supersession.` : "",
      evidence: assessment.evidenceIds.map(id => {
        const cited = evidence.get(id), found = cited && versions.get(cited.versionId);
        if (!found) throw new Error("Report evidence does not resolve to a retained source version.");
        const {resource, version} = found, metadata = resource.metadataHistory?.findLast(entry => entry.versionId === version.id)?.metadata || version.intakeMetadata;
        return {...clone(cited), resourceId: resource.id, title: metadata?.title || resource.title, filename: version.filename, sha256: version.sha256, mode: version.mode,
          authors: clone(metadata?.authors || []), documentDate: metadata?.documentDate || "", tags: clone(metadata?.tags || []), reference: clone(version.reference),
          ...(version.source ? {source: clone(version.source)} : {}), ...(version.externalReference ? {externalReference: clone(version.externalReference)} : {})};
      }), actions: actions.filter(action => action.assessmentId === assessment.id)};
    delete finding.auditContext;
    finding.detailBlocks = findingBlocks(finding);
    group.findings.push(finding);group.counts[finding.conclusion]++;group.actions += finding.actions.length;
    return finding;
  });
  const conclusions = counts();for (const finding of findings) conclusions[finding.conclusion]++;
  const standards = [...groups.values()];
  const summary = {assessmentRecords: findings.length, requirementReferences: new Set(snapshot.assessments.map(reviewKey)).size,
    frameworkCount: new Set(standards.map(group => tuple(group.authority, group.frameworkName, group.edition))).size, standardCount: standards.length, conclusions,
    actions: {total: actions.length, open: actions.filter(action => action.status === "open").length, in_progress: actions.filter(action => action.status === "in_progress").length,
      closed: actions.filter(action => action.status === "closed").length, overdue: actions.filter(action => action.overdue).length},
    gapsWithoutActions: findings.filter(finding => finding.conclusion === "gap" && !finding.actions.length).length};
  return freeze({schemaVersion: 1, rendererVersion: presentation?.rendererVersion || gapReportRendererVersion,
    id: report.id, title: report.title, issuedAt: report.issuedAt, reviewer: report.reviewer, narrative: report.narrative || "", template: clone(report.template),
    project: {id: snapshot.projectId, workspaceId: snapshot.workspaceId, name: snapshot.name, client: snapshot.engagement.client,
      phase: snapshot.engagement.phase, period: snapshot.engagement.period, revision: snapshot.revision},
    paperSize: presentation?.paperSize || "A4", summary, notes, standards, findings, actions});
}
