// Portable engagement records. Local role assignments describe the professional
// process; authentication remains the responsibility of the deployment host.
import {normalizeFieldDevicePolicy} from "./field-device-policy.js";
export const engagementSchemaVersion = 1;
export const engagementSnapshotMaxBytes = 8 * 1024 * 1024;
export const engagementStatuses = Object.freeze(["draft", "ready", "under_review", "reviewed", "approved", "published", "superseded"]);
export const monitoringEntityNames = Object.freeze(["programs", "cycles", "monitoringObligations", "submissions", "requests", "indicators", "measurements", "missions", "events", "verifications"]);
export const engagementOptionalEntityNames=Object.freeze(['externalReferences','bibliography','sourceReviews']);
export const engagementEntityNames = Object.freeze(["requirements", "assertions", "findings", "actions", "obligations", "approvals", "mappings", "publications", ...monitoringEntityNames,...engagementOptionalEntityNames]);
export const monitoringFindingChoices = Object.freeze({implementation:["not_assessed","not_started","partial","implemented","inconclusive"],effectiveness:["not_assessed","effective","partly_effective","ineffective","inconclusive"],evidenceSufficiency:["sufficient","limited","insufficient","inconclusive"],residualRisk:["unknown","low","moderate","high","critical"],riskTrajectory:["unknown","stable","increasing","decreasing"]});
export const engagementRoles = Object.freeze(["preparer", "reviewer", "approver", "client"]);
export const actionReviewerFields=Object.freeze(['reviewer','reviewerAssignedBy','reviewerAssignedAt','reviewerAssignmentStatement']);
export const crosswalkRelations = Object.freeze(["equivalent", "overlapping", "broader", "narrower", "related", "conflicting"]);
export const findingReviewDecisions = Object.freeze(["confirmed", "revised", "rejected"]);
export const contradictionDispositionChoices = Object.freeze(["unresolved", "superseded", "outweighed", "resolved"]);
export const findingChoices = Object.freeze({applicability: ["applicable", "not_applicable", "uncertain"], coverage: ["complete", "partial", "missing", "not_determined"], adequacy: ["adequate", "deficient", "insufficient_evidence"], performance: ["compliant", "partially_compliant", "noncompliant", "undetermined", "not_assessed"]});
export const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
export const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export const sha256Pattern = /^[a-f0-9]{64}$/;
export const stableJson = value => JSON.stringify(value, (_, item) => isObject(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const snapshotDigestInput = snapshot => {const {sha256, ...content} = snapshot; return stableJson(content);};
export const engagementError = (message, status = 400) => Object.assign(new Error(message), {status, statusCode: status});
export const assertEngagement = (condition, message, status = 400) => {if (!condition) throw engagementError(message, status);};
export function boundedText(value, label, {required = false, max = 12000} = {}) {
  if (value === undefined && !required) return "";
  assertEngagement(typeof value === "string" && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) && (!required || value.trim()), `${label} must be ${required ? "nonempty " : ""}text of at most ${max} characters.`);
  return value.trim();
}
export function boundedList(value, label, maximum = 5000) {
  if (value === undefined) return [];
  assertEngagement(Array.isArray(value) && value.length <= maximum, `${label} must contain at most ${maximum} records.`);
  return value;
}
export const enumValue = (value, values, label) => {assertEngagement(values.includes(value), `Choose a valid ${label}.`); return value;};
export function stringList(value, label, maximum = 100, length = 2000) {
  const values = boundedList(value, label, maximum).map(item => boundedText(item, label, {required: true, max: length}));
  assertEngagement(new Set(values).size === values.length, `${label} must be unique.`); return values;
}
export function exactKeys(value, allowed, label) {assertEngagement(isObject(value) && Object.keys(value).every(key => allowed.includes(key)), `${label} contains unsupported fields.`);}
// These descriptors record a deployment's verified identity boundary. They do
// not verify tokens, grant access or turn imported local attestations into it.
export const authenticatedEngagementAuthorityLabel = "Verified authenticated User in an assigned professional role; not a legal digital signature.";
export function normalizeEngagementExecutionAuthority(value) {
  exactKeys(value, ["mode", "issuer"], "Engagement execution authority");
  assertEngagement(value.mode === "authenticated_user", "Use the verified authenticated User authority mode.");
  const issuer = boundedText(value.issuer, "Verified identity issuer", {required: true, max: 2048});
  let url;try {url = new URL(issuer);} catch {}
  assertEngagement(url && ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && issuer === value.issuer, "Retain the exact verified HTTP(S) identity issuer.");
  return {mode: "authenticated_user", issuer};
}
export function normalizeEngagementAuthentication(value, actorId) {
  exactKeys(value, ["userId", "issuer", "subject"], "Verified engagement User");
  const userId = boundedText(value.userId, "Verified native User ID", {required: true, max: 300}),
    subject = boundedText(value.subject, "Verified identity subject", {required: true, max: 300}),
    {issuer} = normalizeEngagementExecutionAuthority({mode: "authenticated_user", issuer: value.issuer});
  assertEngagement(userId === value.userId && subject === value.subject && (actorId === undefined || actorId === userId), "The acting User must match the externally verified native User.", 403);
  return {userId, issuer, subject};
}
export function validDate(value, label, {optional = false} = {}) {
  if ((value === undefined || value === "") && optional) return "";
  assertEngagement(typeof value === "string" && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, `${label} requires a valid YYYY-MM-DD date.`); return value;
}
export function normalizeProvenance(value, actorId, at) {
  value ??= {kind: "human"};
  exactKeys(value, ["kind", "model", "method", "promptHash", "actorId", "at", "sources"], "Contribution provenance");
  const result = {kind: enumValue(value.kind || "human", ["human", "ai"], "contributor kind"), actorId: boundedText(actorId ?? value.actorId, "Contributor", {required: true, max: 300}), at: at ?? value.at};
  for (const key of ["model", "method", "promptHash"]) if (value[key]) result[key] = boundedText(value[key], `Provenance ${key}`, {max: 1000});
  if (result.kind === "ai") assertEngagement(result.model || result.method, "Identify the AI model or assessment method; candidate outputs are never professional sign-off.");
  if (result.promptHash) assertEngagement(sha256Pattern.test(result.promptHash), "Prompt provenance must use a SHA256 hash.");
  if (value.sources !== undefined) result.sources = stringList(value.sources, "Contribution source references", 500, 1000);
  return result;
}
export function normalizeMandate(value) {
  const roles = {};
  assertEngagement(isObject(value.roles), "Declare the engagement's local preparer, reviewer and approver roles.");
  exactKeys(value.roles, engagementRoles, "Engagement roles");
  for (const role of engagementRoles) roles[role] = stringList(value.roles[role], `${role} assignments`, 50, 300);
  for (const role of ["preparer", "reviewer", "approver"]) assertEngagement(roles[role].length, `Assign at least one ${role}.`);
  const clientAcceptanceRequired = value.clientAcceptanceRequired === true;
  if (clientAcceptanceRequired) assertEngagement(roles.client.length, "Assign a client acceptance role when acceptance is required.");
  return {name: boundedText(value.name, "Engagement name", {required: true, max: 500}), client: boundedText(value.client, "Client", {required: true, max: 1000}),
    contractingParties: stringList(value.contractingParties, "Contracting parties", 50), type: boundedText(value.type || "due_diligence", "Engagement type", {required: true, max: 200}),
    scope: stringList(value.scope, "Scope activities", 100), exclusions: boundedText(value.exclusions, "Scope exclusions"),
    agreementVersionIds: stringList(value.agreementVersionIds, "Agreement source versions", 100, 192),
    amendments: boundedList(value.amendments, "Engagement amendments", 100).map(item => {exactKeys(item, ["id", "title", "sourceVersionId", "date", "description"], "Engagement amendment");return {id: boundedText(item.id, "Amendment ID", {required: true, max: 192}), title: boundedText(item.title, "Amendment title", {required: true, max: 1000}), sourceVersionId: boundedText(item.sourceVersionId, "Amendment source version", {required: true, max: 192}), date: validDate(item.date, "Amendment date", {optional: true}), description: boundedText(item.description, "Amendment description")};}),
    deliverables: boundedList(value.deliverables, "Engagement deliverables", 100).map(item => {exactKeys(item, ["id", "title", "description", "dueDate"], "Deliverable");return {id: boundedText(item.id, "Deliverable ID", {required: true, max: 192}), title: boundedText(item.title, "Deliverable title", {required: true, max: 1000}), description: boundedText(item.description, "Deliverable description"), dueDate: validDate(item.dueDate, "Deliverable deadline", {optional: true})};}),
    roles, dataRules: boundedText(value.dataRules, "Access, confidentiality, evidence reuse and publication rules"), clientAcceptanceRequired,
    frameworkIds: stringList(value.frameworkIds, "Applicable framework editions", 32, 192),
    ...(value.devicePolicy !== undefined ? {devicePolicy: normalizeFieldDevicePolicy(value.devicePolicy)} : {})};
}
// Absence of an explicit human disposition keeps legacy contradictory evidence
// unresolved. Retaining a citation never implies that its significance is settled.
export function normalizeContradictionDispositions(value, assertionIds = []) {
  const seen = new Set();
  return boundedList(value, "Contradictory citation dispositions", 500).map(item => {
    exactKeys(item, ["assertionId", "disposition", "rationale"], "Contradictory citation disposition");
    const assertionId = boundedText(item.assertionId, "Contradictory citation", {required: true, max: 192});
    assertEngagement(assertionIds.includes(assertionId) && !seen.has(assertionId), "Give each retained contradictory citation at most one disposition.");seen.add(assertionId);
    const disposition = enumValue(item.disposition, contradictionDispositionChoices, "contradictory citation disposition");
    return {assertionId, disposition, rationale: boundedText(item.rationale, "Contradictory citation reasoning", {required: disposition !== "unresolved"})};
  });
}
export function unresolvedContradictoryAssertionIds(finding) {
  return (finding?.contradictoryAssertionIds || []).filter(id => !(finding.contradictionDispositions || []).some(item => item.assertionId === id && contradictionDispositionChoices.includes(item.disposition) && item.disposition !== "unresolved" && item.rationale?.trim()));
}
export function findingReviewIssues(finding, {assertions = []} = {}) {
  const issues = [];
  if (!finding.rationale?.trim()) issues.push("Explain the finding rationale.");
  if (!finding.applicabilityRationale?.trim()) issues.push("Explain applicability with evidence and scope.");
  if (finding.applicability === "uncertain") issues.push("Resolve uncertain applicability before verifying a finding.");
  const support = (finding.supportingAssertionIds || []).map(id => assertions.find(item => item.id === id));
  if (!support.length || support.some(item => !item || !["confirmed", "modified"].includes(item.reviewStatus))) issues.push("Verify direct supporting citations, including the justification for not-applicable findings.");
  if ((finding.contradictoryAssertionIds || []).some(id => !["confirmed", "modified"].includes(assertions.find(item => item.id === id)?.reviewStatus))) issues.push("Review every contradictory citation.");
  const unresolvedContradictions = unresolvedContradictoryAssertionIds(finding);
  if (unresolvedContradictions.length && !finding.uncertainty?.trim()) issues.push("Explain how unresolved contradictory evidence affects the conclusion.");
  if (finding.applicability === "applicable" && finding.coverage === "not_determined") issues.push("Determine evidence coverage.");
  if (["deficient", "insufficient_evidence"].includes(finding.adequacy) && !finding.deficiency?.trim()) issues.push("Describe the deficiency or missing evidence.");
  if (["partially_compliant", "noncompliant"].includes(finding.performance) && !finding.recommendation?.trim()) issues.push("Record a recommendation for the adverse performance finding.");
  if (finding.performance === "compliant" && (finding.coverage !== "complete" || finding.adequacy !== "adequate" || unresolvedContradictions.length)) issues.push("A compliant conclusion requires complete, adequate supporting evidence and a reasoned disposition of every contradictory citation; unresolved contradictions block compliance.");
  if (finding.applicability === "not_applicable" && !["not_assessed", "undetermined"].includes(finding.performance)) issues.push("Do not make a project performance determination for a not-applicable requirement.");
  if(finding.cycleId&&finding.performance==="compliant"&&(finding.implementation!=="implemented"||finding.effectiveness!=="effective"||finding.evidenceSufficiency!=="sufficient"))issues.push("Monitoring compliance requires evidence of implemented, effective measures and sufficient evidence; document submission alone is insufficient.");
  return issues;
}
export function validateSnapshotEnvelope(snapshot) {
  assertEngagement(isObject(snapshot) && snapshot.format === "esia-engagement-snapshot" && snapshot.schemaVersion === 1 && uuidPattern.test(snapshot.id) && sha256Pattern.test(snapshot.sha256) && snapshot.engagement?.status === "approved", "Use an immutable approved engagement snapshot.");
  for (const key of [...engagementEntityNames.filter(name=>!monitoringEntityNames.includes(name)&&!engagementOptionalEntityNames.includes(name)), "sourceVersions", "audit"]) assertEngagement(Array.isArray(snapshot[key]), `Approved snapshot is missing ${key}.`);
  for(const key of engagementOptionalEntityNames)assertEngagement(snapshot[key]===undefined||Array.isArray(snapshot[key]),`Approved ${key} must retain its optional collection.`);
  return snapshot;
}

export function compareMonitoringMeasurements(values) {
  const records=[...values].sort((a,b)=>String(a.observedAt).localeCompare(String(b.observedAt))), previous=records.at(-2),current=records.at(-1);
  if(!previous||!current)return {comparable:false,reason:"At least two observations are required.",previous:previous||null,current:current||null,delta:null,thresholdExceeded:null};
  const keys=["indicatorId","location","method","lab","unit","detectionLimit","threshold"];
  const different=keys.filter(key=>stableJson(previous[key]??null)!==stableJson(current[key]??null));
  if(different.length)return {comparable:false,reason:`Context differs: ${different.join(", ")}.`,previous,current,delta:null,thresholdExceeded:null};
  if(previous.dataQuality!=="verified"||current.dataQuality!=="verified"||["location","method","lab","unit","detectionLimit"].some(key=>!current[key]||/^(unknown|undetermined)$/i.test(current[key])))return {comparable:false,reason:"Evidence quality or sampling context remains unverified or incomplete; obtain human review before interpreting a trend.",previous,current,delta:null,thresholdExceeded:null};
  const threshold=current.threshold||{},v=current.value,exceeded=threshold.operator==="lt"?v>=threshold.value:threshold.operator==="lte"?v>threshold.value:threshold.operator==="gt"?v<=threshold.value:threshold.operator==="gte"?v<threshold.value:threshold.operator==="range"?v<threshold.lower||v>threshold.upper:null;
  return {comparable:true,reason:"Same indicator, location, method, laboratory, unit, detection limit and threshold context; interpretation requires human review.",previous,current,delta:v-previous.value,thresholdExceeded:exceeded};
}
export function monitoringAttention(view,{asOf=new Date().toISOString().slice(0,10),programId,cycleId,weights:configuredWeights}={}) {
  validDate(asOf,"Monitoring attention date");
  const selectedCycle=cycleId?(view.cycles||[]).find(item=>item.id===cycleId):null;
  assertEngagement(!cycleId||selectedCycle,"Select a reporting cycle in this engagement.");
  assertEngagement(!programId||(view.programs||[]).some(item=>item.id===programId),"Select a monitoring program in this engagement.");
  assertEngagement(!selectedCycle||!programId||selectedCycle.programId===programId,"The reporting cycle belongs to a different monitoring program.");
  const selectedProgramId=programId||selectedCycle?.programId,programs=(view.programs||[]).filter(item=>!selectedProgramId||item.id===selectedProgramId);
  const defaults={overdue:2,significantEvents:5,pendingEvidence:1,increasingRisk:3,inherentRisk:1,inherentRiskUncertainty:2,recentPerformance:2,evidenceQuality:2,changedCircumstances:2};
  const checkedWeights=value=>{const weights={...defaults,...value};exactKeys(weights,Object.keys(defaults),"Monitoring attention weights");for(const weight of Object.values(weights))assertEngagement(Number.isFinite(weight)&&weight>=0&&weight<=100,"Monitoring attention weights must be between 0 and 100.");return weights;};
  const reasons=[],contributions=[],openObligations=[],overdueObligations=[],overdueActions=[],activeEvents=[],pendingRequests=[],pendingSubmissions=[],pendingCycles=[],missingEvidence=[];
  const byProgram=programs.length?programs:[{id:null}],allCycles=view.cycles||[];
  for(const program of byProgram){
    const cycles=allCycles.filter(item=>(!program.id||item.programId===program.id)&&(!cycleId||item.id===cycleId)&&item.periodStart<=asOf),cycleIds=new Set(cycles.map(item=>item.id));
    const latest=cycleId?cycles:cycles.slice().sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd)).slice(-1),latestIds=new Set(latest.map(item=>item.id));
    const belongs=item=>item.programId?item.programId===program.id:byProgram.length===1;
    const inCycle=item=>item.cycleId?cycleIds.has(item.cycleId):!cycleId||belongs(item)&&(!item.occurredAt||item.occurredAt.slice(0,10)>=selectedCycle.periodStart&&item.occurredAt.slice(0,10)<=selectedCycle.periodEnd);
    const obligations=(view.monitoringObligations||[]).filter(item=>belongs(item)&&!["closed","waived"].includes(item.status));openObligations.push(...obligations.map(item=>item.id));
    let overdue=0,unresolvedTriggers=0;
    for(const obligation of obligations){const hasOccurrences=Array.isArray(obligation.occurrences)&&obligation.occurrences.length>0,occurrences=hasOccurrences?obligation.occurrences.filter(item=>!["closed"].includes(item.status)&&(!cycleId||!item.cycleId||item.cycleId===cycleId)):[];const missed=occurrences.filter(item=>item.dueDate&&item.dueDate<asOf);if(missed.length||!hasOccurrences&&obligation.dueDate&&obligation.dueDate<asOf){overdue++;overdueObligations.push(obligation.id);reasons.push({entityType:"monitoringObligations",entityId:obligation.id,programId:program.id,...(cycleId?{cycleId}:{}),occurrenceIds:missed.map(item=>item.id),severity:"high",reason:missed.length?`${missed.length} commitment occurrence(s) overdue; earliest ${missed.map(item=>item.dueDate).sort()[0]}.`:`Commitment overdue since ${obligation.dueDate}.`});}}
    for(const obligation of obligations)if(["recurring","milestone","event"].includes(obligation.trigger)&&(!obligation.occurrences?.length||obligation.occurrences.some(item=>item.reviewStatus==="draft"))){unresolvedTriggers++;reasons.push({entityType:"monitoringObligations",entityId:obligation.id,programId:program.id,severity:"moderate",reason:obligation.occurrences?.some(item=>item.reviewStatus==="draft")?"Imported commitment schedule or trigger requires fresh human review; retained deadlines remain visible.":"Commitment trigger or recurring occurrence schedule is unresolved; record its due event or milestone."});}
    const actions=(view.actions||[]).filter(item=>!["closed","superseded"].includes(item.status)&&(item.cycleId?cycleIds.has(item.cycleId):monitoringActionBelongsToProgram(view,item,program.id)||(item.monitoringObligationIds||[]).some(id=>obligations.some(obligation=>obligation.id===id))));
    for(const action of actions.filter(item=>item.dueDate&&item.dueDate<asOf)){overdue++;overdueActions.push(action.id);reasons.push({entityType:"actions",entityId:action.id,cycleId:action.cycleId,programId:program.id,severity:"high",reason:`Corrective action overdue since ${action.dueDate}.`});}
    const events=(view.events||[]).filter(item=>belongs(item)&&inCycle(item)&&item.status!=="closed"&&(!item.occurredAt||item.occurredAt.slice(0,10)<=asOf));activeEvents.push(...events.map(item=>item.id));
    reasons.push(...events.map(item=>({entityType:"events",entityId:item.id,programId:program.id,cycleId:item.cycleId,severity:item.severity||"moderate",reason:`Active ${item.kind||"event"} requires human review.`})));
    const requests=(view.requests||[]).filter(item=>cycleIds.has(item.cycleId)&&item.status!=="closed");pendingRequests.push(...requests.map(item=>item.id));reasons.push(...requests.map(item=>({entityType:"requests",entityId:item.id,cycleId:item.cycleId,programId:program.id,severity:item.dueDate&&item.dueDate<asOf?"high":"moderate",reason:"Information request remains outstanding."})));
    const incomplete=cycles.filter(item=>(item.dueDate||item.periodEnd)<=asOf&&!(view.submissions||[]).some(submission=>submission.cycleId===item.id&&submission.completeness==="complete"));pendingSubmissions.push(...incomplete.map(item=>item.id));
    reasons.push(...incomplete.map(item=>({entityType:"cycles",entityId:item.id,cycleId:item.id,programId:program.id,severity:(item.dueDate||item.periodEnd)<asOf?"high":"moderate",reason:`Reporting period ${item.name||item.id} lacks a human-reviewed complete client submission.`})));
    pendingCycles.push(...cycles.filter(item=>!["approved","published"].includes(item.status)).map(item=>item.id));
    const findings=(view.findings||[]).filter(item=>latestIds.has(item.cycleId)),quality=[];
    for(const finding of findings){const citations=[...(finding.supportingAssertionIds||[]),...(finding.contradictoryAssertionIds||[])],unreviewed=Array.isArray(view.assertions)&&(!citations.length||citations.some(id=>{const assertion=view.assertions.find(item=>item.id===id);return !assertion||!["confirmed","modified"].includes(assertion.reviewStatus)||Array.isArray(view.sourceVersions)&&!view.sourceVersions.some(source=>source.id===assertion.versionId&&source.availability!=="unavailable");}));if(["limited","insufficient","inconclusive"].includes(finding.evidenceSufficiency)||unreviewed)quality.push({entityType:"findings",entityId:finding.id,cycleId:finding.cycleId,programId:program.id,severity:"moderate",reason:"Current-period finding has limited, inconclusive, missing or unreviewed source evidence."});}
    for(const cycle of latest)for(const requirementId of cycle.requirementIds||[])if(!findings.some(item=>item.cycleId===cycle.id&&item.requirementId===requirementId))quality.push({entityType:"cycles",entityId:cycle.id,cycleId:cycle.id,requirementId,programId:program.id,severity:"moderate",reason:"A scoped requirement has no current-period finding or evidence review."});
    for(const measurement of view.measurements||[])if(latestIds.has(measurement.cycleId)&&(measurement.dataQuality!=="verified"||["unit","method","location","lab","detectionLimit"].some(key=>!measurement[key])))quality.push({entityType:"measurements",entityId:measurement.id,cycleId:measurement.cycleId,programId:program.id,severity:"moderate",reason:"Measurement source quality or sampling context remains unverified or incomplete."});
    missingEvidence.push(...quality);reasons.push(...quality);
    reasons.push(...findings.filter(item=>["high","critical"].includes(item.residualRisk)).map(item=>({entityType:"findings",entityId:item.id,cycleId:item.cycleId,programId:program.id,severity:item.residualRisk,reason:"Selected-period assessment records significant residual risk."})));
    if(program.changedCircumstances)reasons.push({entityType:"programs",entityId:program.id,programId:program.id,severity:"moderate",reason:"Changed project circumstances require supervision review."});
    if(["high","critical"].includes(program.inherentRisk))reasons.push({entityType:"programs",entityId:program.id,programId:program.id,severity:program.inherentRisk,reason:"Recorded inherent project risk requires supervisory attention."});
    const inherentRiskUnknown=Boolean(program.id)&&!["low","moderate","high","critical"].includes(program.inherentRisk);
    if(inherentRiskUnknown)reasons.push({entityType:"programs",entityId:program.id,programId:program.id,severity:"moderate",uncertainty:true,reason:"Inherent E&S risk is unknown. Assess the material information gap before setting supervision intensity; missing risk knowledge requires attention."});
    const factors={overdue,significantEvents:events.filter(item=>["high","critical"].includes(item.severity)).length,pendingEvidence:requests.length+incomplete.length+unresolvedTriggers,increasingRisk:findings.filter(item=>item.riskTrajectory==="increasing").length,inherentRisk:{low:1,moderate:2,high:3,critical:4}[program.inherentRisk]||0,inherentRiskUncertainty:inherentRiskUnknown?1:0,recentPerformance:findings.filter(item=>["partially_compliant","noncompliant"].includes(item.performance)||item.effectiveness==="ineffective").length,evidenceQuality:quality.length,changedCircumstances:program.changedCircumstances?1:0};
    const weights=checkedWeights(configuredWeights||program.priorityWeights),priorityScore=Object.keys(factors).reduce((sum,key)=>sum+factors[key]*weights[key],0);contributions.push({programId:program.id,factors,weights,priorityScore});
  }
  const factors=Object.fromEntries(Object.keys(defaults).map(key=>[key,contributions.reduce((sum,item)=>sum+item.factors[key],0)])),severity=reasons.some(item=>item.severity==="critical")?"critical":reasons.some(item=>item.severity==="high")?"high":reasons.length?"moderate":"low";
  return {asOf,scope:{programId:selectedProgramId||null,cycleId:cycleId||null},openObligations:new Set(openObligations).size,overdueObligations:[...new Set(overdueObligations)],overdueActions:[...new Set(overdueActions)],activeEvents:[...new Set(activeEvents)],pendingRequests:[...new Set(pendingRequests)],pendingSubmissions:[...new Set(pendingSubmissions)],pendingCycles:[...new Set(pendingCycles)],missingEvidence,factors,weights:contributions.length===1?contributions[0].weights:configuredWeights?checkedWeights(configuredWeights):null,weightMode:contributions.length>1?"per_program":"selected_program",programContributions:contributions,reasons,severity,priorityScore:contributions.reduce((sum,item)=>sum+item.priorityScore,0),meaning:"Configurable practitioner triage aid. Per-program weighted contributions are shown. Inspect every significant event and source; a score does not determine compliance or override professional judgment. A date filters due periods; current retained states are not a reconstruction of historical approvals."};
}
export const computeMonitoringAttention=monitoringAttention;

// A supervised DD corrective action keeps its original identity and finding
// links. Programs pin the action IDs from their approved DD baseline; a later
// monitoring cycle can verify that same action without moving it into a period.
export function monitoringActionBelongsToProgram(view,action,programId) {
  if(!action)return false;
  if(action.cycleId)return (view.cycles||[]).some(cycle=>cycle.id===action.cycleId&&cycle.programId===programId);
  const program=(view.programs||[]).find(item=>item.id===programId);
  return !!program&&(program.baselineActionIds?.includes(action.id)||(view.baselines||[]).find(item=>item.id===program.baselineId)?.actions?.some(item=>item.id===action.id))===true;
}
