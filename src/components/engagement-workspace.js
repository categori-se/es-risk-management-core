import {createEngagementMandateViews} from './engagement-mandate-views.js';
import {createEngagementAssessmentViews} from './engagement-assessment-views.js';
import {createEngagementAssistanceViews} from './engagement-assistance-views.js';
import {engagementReportTemplates,getEngagementReportTemplate} from '../lib/engagement-report-templates.js';
import {mountReportTemplateWorkbench} from './report-template-workbench.js';
import {mountEngagementBibliography} from './engagement-bibliography.js';
import {renderSourceCoverage} from './source-coverage.js';
import {renderSourceReviewWorkbench} from './source-review-workbench.js';
import {mountAssignmentPilot} from './assignment-pilot.js';
import {renderProjectHandover} from './project-handover.js';
import {fieldDevicePolicyDigestInput} from "../lib/field-device-policy.js";
import {catalogMetadataFields,spatialMetadataFields} from "../lib/source-metadata.js";
import {documentRelationForEngagement} from "../lib/document-relations.js";
import {frameworks, getFramework, getAuditChecks, getAuditContext, auditCheckSets, registerDetailedRequirementPack, getFrameworkCoverage} from "../lib/framework-register.js";
import {mountSourceIntake} from "./source-intake.js";
import {mountAuthenticatedSourceIntake,createAuthenticatedSourceIntakeState,clearAuthenticatedSourceIntakeState} from "./authenticated-source-intake.js";
import {mountAuthenticatedSuccessorImport,mountAuthenticatedSuccessorHistory,createAuthenticatedSuccessorImportState,clearAuthenticatedSuccessorImportState} from "./authenticated-successor-import.js";
import {mountProjectDocuments} from "./project-documents.js";
import {mountAuthenticatedMonitoringCase} from "./authenticated-monitoring-case.js";
import {mountAuthenticatedEngagementInvitations} from "./authenticated-engagement-invitations.js";
import {mountExternalReferenceRegister,createExternalReferenceRegisterState,clearExternalReferenceRegisterState} from "./external-reference-register.js";
import {newMonitoringState,renderEngagementMonitoring,readMonitoringCommand,monitoringAction,monitoringFormKey,clearMonitoringPrivateState} from "./engagement-monitoring.js";
import {contradictionDispositionChoices,unresolvedContradictoryAssertionIds} from "../lib/engagement-domain.js";
import {renderAssignmentGuide} from "./assignment-guide.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const human = value => String(value || "").replaceAll("_", " ");
const lines = value => String(value || "").split(/\r?\n/).map(item => item.trim()).filter(Boolean);
const choices = (items, value) => items.map(item => {const [id,label] = Array.isArray(item) ? item : [item,human(item)];return `<option value="${h(id)}"${String(id) === String(value) ? " selected" : ""}>${h(label)}</option>`;}).join("");
const input = (label, name, value = "", {required = false, type = "text", placeholder = "", min, max, step} = {}) => `<label><span>${h(label)}</span><input name="${h(name)}" type="${h(type)}" value="${h(value)}"${required ? " required" : ""}${placeholder ? ` placeholder="${h(placeholder)}"` : ""}${min === undefined ? "" : ` min="${h(min)}"`}${max === undefined ? "" : ` max="${h(max)}"`}${step === undefined ? "" : ` step="${h(step)}"`}></label>`;
const area = (label, name, value = "", {required = false, rows = 3} = {}) => `<label class="ew-wide"><span>${h(label)}</span><textarea name="${h(name)}" rows="${rows}"${required ? " required" : ""}>${h(value)}</textarea></label>`;
const select = (label, name, items, value = "", {required = false, data = ""} = {}) => `<label><span>${h(label)}</span><select name="${h(name)}"${required ? " required" : ""}${data ? ` ${data}` : ""}>${choices(items, value)}</select></label>`;
const check = (label, name, checked = false, {value = "yes", required = false} = {}) => `<label class="ew-check"><input type="checkbox" name="${h(name)}" value="${h(value)}"${checked ? " checked" : ""}${required ? " required" : ""}><span>${h(label)}</span></label>`;
const button = (label, action, attributes = "") => `<button type="button" data-engagement-action="${h(action)}" ${attributes}>${h(label)}</button>`;
const optionsFrom = (items, name = "title") => items.map(item => [item.id, item[name] || item.name || item.id]);
const idOf = item => item?.id || "";
const actorNames = engagement => [...new Set(Object.values(engagement?.roles || {}).flat().filter(Boolean))];
const safeFilename = value => String(value || "engagement").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100);
const reviewDate = value => {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? '<time datetime="'+h(value)+'">'+h(date.toLocaleString())+'</time>' : "Date not recorded";
};
const reviewDecisionLabel = record => ({confirmed:"Confirmed finding",revised:"Accepted revised finding",rejected:"Rejected finding"}[record.reviewDecision] || (record.status==="verified"?"Confirmed finding":"Human review"));
const hasHumanReview = record => Boolean(record?.reviewedBy && record?.reviewStatement);
const findingReviewDuration = record => Number.isFinite(record?.reviewDurationMinutes) && record.reviewDurationMinutes > 0 ? `<p data-finding-review-duration>Self-reported review time: ${h(record.reviewDurationMinutes)} ${record.reviewDurationMinutes === 1 ? "minute" : "minutes"}.</p>` : "";
const historicalContradictions = record => (record.contradictoryAssertionIds||[]).length ? `<div data-finding-past-dispositions><p>Contradictory evidence decisions for this revision:</p><ul>${record.contradictoryAssertionIds.map(id=>{const item=record.contradictionDispositions?.find(value=>value.assertionId===id);return `<li><strong>${h(human(item?.disposition||"unresolved"))}</strong> · citation <code>${h(id)}</code><p>${h(item?.rationale||"No per-citation reasoning was recorded; this contradiction remains unresolved.")}</p></li>`;}).join("")}</ul></div>` : "";
function contributionSummary(record, label) {
  const provenance=record?.provenance;if(!provenance)return "";
  const ai=provenance.kind==="ai",status=record.reviewStatus||record.status||"draft",reviewed=hasHumanReview(record)||Boolean(record.confirmedBy&&status==="confirmed")||Boolean(record.reviewedBy&&["confirmed","modified","verified","approved"].includes(status))||Boolean(status==="closed"&&record.closedBy)||record.approvalStatus==="approved";
  const actor=provenance.actorId||record.updatedBy||record.createdBy,at=provenance.at||record.updatedAt||record.createdAt,sources=provenance.sources||[];
  return `<section class="ew-small" data-engagement-contribution data-contribution-kind="${h(provenance.kind)}" aria-label="Saved ${h(label)} contribution"><p><strong>Saved ${h(label)} contribution: ${ai?"AI contribution":"Human contribution"}</strong> · Saved status: ${h(human(status))}</p>${provenance.model?`<p>Model: ${h(provenance.model)}</p>`:""}${provenance.method?`<p>Method: ${h(provenance.method)}</p>`:""}${actor||at?`<p>${actor?`Recorded by ${h(actor)}`:"Contribution recorded"}${at?` · ${reviewDate(at)}`:""}</p>`:""}${ai&&!reviewed?'<p>Human review is pending.</p>':""}${sources.length||provenance.promptHash?`<details><summary>Contribution audit details</summary>${sources.length?`<p>Retained source references:</p><ul>${sources.map(source=>`<li>${h(source)}</li>`).join("")}</ul>`:""}${provenance.promptHash?`<p>Prompt fingerprint: <code>${h(provenance.promptHash)}</code></p>`:""}</details>`:""}</section>`;
}
function currentFindingReview(finding) {
  if(!hasHumanReview(finding))return '<p data-finding-current-review>No human decision is recorded for this draft. Review the evidence and record a substantive decision below.</p>';
  return '<article class="ew-record" data-finding-current-review><h4>'+h(reviewDecisionLabel(finding))+'</h4><p><strong>'+h(finding.reviewedBy)+'</strong> · '+reviewDate(finding.reviewedAt)+' · finding revision '+h(finding.revision)+'</p><p>'+h(finding.reviewStatement)+'</p>'+findingReviewDuration(finding)+(finding.reviewDecision==="rejected"?'<p><strong>Correction or explicit human reconfirmation is required before this finding can support approval.</strong></p>':"")+'</article>';
}
function findingReviewHistory(finding) {
  const revisions=[...(finding.history || finding.revisions || [])].sort((a,b)=>(Number(a.revision)||0)-(Number(b.revision)||0));
  const reviews=revisions.filter(hasHumanReview);
  const decisions=reviews.map(record=>'<li data-finding-past-review data-finding-revision="'+h(record.revision)+'"><h4>'+h(reviewDecisionLabel(record))+'</h4><p><strong>'+h(record.reviewedBy)+'</strong> · '+reviewDate(record.reviewedAt)+' · finding revision '+h(record.revision)+'</p><p>'+h(record.reviewStatement)+'</p>'+findingReviewDuration(record)+'</li>').join("");
  const judgments=revisions.map(record=>'<li data-finding-past-judgment><h4>Finding revision '+h(record.revision)+'</h4><p>'+(record.provenance?.kind==="ai"?"AI draft candidate":"Human assessment contribution")+(record.updatedBy||record.createdBy?' · Revision recorded by '+h(record.updatedBy||record.createdBy):"")+' · '+reviewDate(record.updatedAt||record.createdAt)+'</p><p>Applicability: '+h(human(record.applicability))+' · Coverage: '+h(human(record.coverage))+' · Adequacy: '+h(human(record.adequacy))+' · Performance: '+h(human(record.performance))+'</p><p>'+h(record.rationale)+'</p>'+(record.uncertainty?'<p>Uncertainty: '+h(record.uncertainty)+'</p>':"")+historicalContradictions(record)+'</li>').join("");
  return '<details data-finding-review-history><summary>Previous human review decisions ('+reviews.length+')</summary>'+(decisions?'<ol>'+decisions+'</ol>':'<p>No earlier human review decisions are recorded.</p>')+'</details><details data-finding-judgment-history><summary>Assessment revision history ('+revisions.length+')</summary>'+(judgments?'<ol>'+judgments+'</ol>':'<p>No earlier finding revisions are recorded.</p>')+'<details><summary>Full retained revision metadata</summary><pre>'+h(JSON.stringify(revisions,null,2))+'</pre></details></details>';
}

/** Priorities are review queues, never compliance scores. */
export function buildEngagementReviewContext(engagement,project,cycleId="") {
  const approved=(engagement?.baselines||[]).filter(item=>!item.scope&&item.engagement?.id===engagement.id&&item.engagement?.status==="approved").map((item,index)=>({item,index})).sort((a,b)=>(a.item.engagement.contentRevision||0)-(b.item.engagement.contentRevision||0)||String(a.item.createdAt||"").localeCompare(String(b.item.createdAt||""))||a.index-b.index).at(-1)?.item;
  const sources=new Map();for(const resource of project?.resources||[])for(const[index,version]of resource.versions.entries()){const metadata=version.effectiveMetadata||resource.metadataHistory?.findLast(item=>item.versionId===version.id)?.metadata||version.intakeMetadata;sources.set(version.id,{version,earlier:index<resource.versions.length-1,status:String(metadata?.documentStatus||"").trim().toLowerCase(),relation:documentRelationForEngagement(resource,version,engagement?.id),reviewedSuccessors:[],inconsistencies:[]});}
  for(const source of sources.values()){const relation=source.relation,earlier=sources.get(relation?.predecessor?.versionId);if(!relation||relation.engagementId!==engagement?.id||relation.sourceVersionId!==source.version.id||relation.sourceSha256!==source.version.sha256||!earlier||earlier.version.sha256!==relation.predecessor.sha256)continue;if(relation.decision==="revision")earlier.reviewedSuccessors.push(source.version);if(relation.decision==="inconsistent"){const reason=`A reviewed document relationship identifies an inconsistency between ${earlier.version.filename||earlier.version.id} and ${source.version.filename||source.version.id}. Review both originals and the recorded relationship before relying on this evidence.`;earlier.inconsistencies.push(reason);source.inconsistencies.push(reason);}}
  return {engagement,approved,sources,cycleId,assertions:new Map((engagement?.assertions||[]).map(item=>[item.id,item])),approvedRequirements:new Map((approved?.requirements||[]).map(item=>[item.id,item])),approvedFindings:new Map((approved?.findings||[]).filter(item=>!item.cycleId).map(item=>[item.requirementId,item])),approvedAssertions:new Map((approved?.assertions||[]).map(item=>[item.id,item]))};
}
const reviewContent=record=>{if(!record)return null;const{history,revision,createdAt,updatedAt,createdBy,updatedBy,...fields}=record;return JSON.stringify(fields,(_,value)=>value&&typeof value==="object"&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);};
export function engagementReviewDetails(finding,requirement,context={}) {
  const flags=finding?[]:["pending","unsupported"],sourceReasons=[],inconsistentReasons=[],changedReasons=[];
  if(finding){
    if (!["confirmed", "revised", "verified", "approved"].includes(finding.reviewStatus || finding.status)) flags.push("pending");
    if (finding.applicability === "uncertain" || finding.uncertainty) flags.push("uncertain");
    if (finding.adequacy === "deficient" || finding.deficiency || ["noncompliant", "partially_compliant"].includes(finding.performance)) flags.push("deficient");
    if (unresolvedContradictoryAssertionIds(finding).length) flags.push("contradictory");
    if (!finding.supportingAssertionIds?.length || finding.coverage === "missing") flags.push("unsupported");
    if (/high|critical|significant/i.test(finding.riskSignificance || "")) flags.push("risk");
  }
  const assertionIds=[...new Set([...(finding?.supportingAssertionIds||[]),...(finding?.contradictoryAssertionIds||[])])],versionIds=[...new Set([requirement?.sourceVersionId,...assertionIds.map(id=>context.assertions?.get(id)?.versionId)].filter(Boolean))];
  for(const versionId of versionIds){const source=context.sources?.get(versionId);if(!source)continue;const name=source.version.filename||versionId;if(source.reviewedSuccessors?.length)sourceReasons.push(`This engagement's reviewed document relationship records ${name} (${versionId}) as revised by ${source.reviewedSuccessors.map(version=>version.filename||version.id).join(", ")}. Check which original applies to this assessment period.`);else if(source.status==="superseded")sourceReasons.push(`Document metadata explicitly records ${name} (${versionId}) as superseded.`);else if(source.earlier)sourceReasons.push(`This conclusion cites an earlier retained version of ${name} (${versionId}); the same resource has a later version.`);for(const reason of source.inconsistencies||[])if(!inconsistentReasons.includes(reason))inconsistentReasons.push(reason);}
  if(sourceReasons.length)flags.push("superseded");
  if(inconsistentReasons.length&&!flags.includes("contradictory"))flags.push("contradictory");
  if(context.approved&&requirement&&!context.cycleId&&!finding?.cycleId){
    const priorRequirement=context.approvedRequirements.get(requirement.id),priorFinding=context.approvedFindings.get(requirement.id);
    if(!priorRequirement)changedReasons.push("This requirement was added after the latest approved due-diligence baseline.");
    else if(reviewContent(requirement)!==reviewContent(priorRequirement))changedReasons.push("The selected requirement differs from the latest approved due-diligence baseline.");
    if(reviewContent(finding)!==reviewContent(priorFinding))changedReasons.push("The current due-diligence finding or its human decision differs from the approved finding.");
    if(assertionIds.some(id=>reviewContent(context.assertions?.get(id))!==reviewContent(context.approvedAssertions.get(id))))changedReasons.push("A cited passage, exact source link or citation review differs from the approved evidence assertion.");
    if(changedReasons.length)flags.push("changed");
  }
  return {flags,sourceReasons,inconsistentReasons,changedReasons,baselineId:context.approved?.id||null};
}
export const engagementReviewFlags=(finding,requirement,context)=>engagementReviewDetails(finding,requirement,context).flags;

/** One source of persisted records; the transport is injectable for local tests. */
export function mountEngagementWorkspace(root, {request: suppliedRequest, authority, invalidation} = {}) {
  if (!root?.ownerDocument) throw new TypeError("An engagement workspace root is required.");
  const authenticated = authority?.mode === "authenticated";
  if (authenticated && (typeof suppliedRequest !== "function" || typeof authority.assertCurrent !== "function" || !authority.userId || !authority.engagementId || !authority.accountId || !authority.projectId)) throw new TypeError("A verified engagement authority and transport are required.");
  const document = root.ownerDocument, view = document.defaultView;
  const address = new URL(view.location.href), initialMonitoringContext={tab:address.searchParams.get("tab"),requirementId:address.searchParams.get("requirementId"),cycleId:address.searchParams.get("cycleId")||address.searchParams.get("cycle"),missionId:address.searchParams.get("missionId"),attention:address.searchParams.get("attention"),view:address.searchParams.get("view"),actionId:address.searchParams.get("actionId"),requestId:address.searchParams.get("requestId"),eventId:address.searchParams.get("eventId")},controller = new view.AbortController();
  const state = {accountId: authenticated ? authority.accountId : address.searchParams.get("account") || "local-default", accounts: [], projects: [], project: null,
    engagements: [], engagement: null, tab: "mandate", actorId: authenticated ? authority.userId : "", busy: false, nestedBusy: false, disposed: false,
    message: "Opening engagement records…", error: false, wizard: 0, drafts: new Map(), intake: {}, authenticatedIntake:createAuthenticatedSourceIntakeState(), authenticatedSuccessor:createAuthenticatedSuccessorImportState(), documents: {},
    selectedRequirement: "", selectedFinding: "", selectedAction: "", queue: "all", search: "", selectedVersion: "", page: 1,
    preview: null, previewError: "", previewBusy: false, frameworkId: "ifc_ps_2012", checkSet: "curated", checkId: "", readerEpoch: 0,
    index: null, assistance: null, assistanceTask: "classify", selectedAssertion: "", sourceStates: new Map(), detailStates: new Map(), renderedScope: "", selectedSourceIds: [], selectedObligation: "", selectedMapping:"", discardedSuggestions: [], passageQuery: "", retrieval: "lexical", policyPreview: null, citationExtraction: null, assessmentCycleId:"",issuedTemplateId:"",monitoring:newMonitoringState()};
  let intakeMount, documentsMount, successorMount, historyMount, caseMount, invitationMount, generation = 0;
  let externalReferenceMount,reportTemplateMount;const externalReferenceStates=new Map(),reportTemplateStates=new Map();
  const api = async (path, options = {}) => {
    if (authenticated) {authority.assertCurrent();const result = await suppliedRequest(path,options);authority.assertCurrent();return result;}
    if (suppliedRequest) return suppliedRequest(path, options);
    const response = await view.fetch(path, {method: options.method || "GET", headers: {"X-ESIA-Workspace": "local", "X-ESIA-Account": state.accountId,
      ...(options.body === undefined ? {} : {"Content-Type": "application/json"})}, credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
      ...(options.body === undefined ? {} : {body: JSON.stringify(options.body)})});
    if (!response.ok) {let result;try {result = await response.json();} catch {}throw Object.assign(new Error(result?.error?.message || result?.error || `The local request failed (${response.status}).`), {status: response.status});}
    return options.binary ? response.blob() : response.json();
  };
  const base = () => `/api/engagements/${encodeURIComponent(state.engagement.id)}`;
  const projectBase = () => `/api/projects/${encodeURIComponent(state.project.id)}`;
  const versionRows = () => state.project?.resources?.flatMap(resource => resource.versions.map(version => ({...version, resourceId: resource.id,
    title: version.effectiveMetadata?.title || version.intakeMetadata?.title || resource.title, latest: version.id === resource.versions.at(-1)?.id}))) || state.engagement?.sourceVersions || [];
  const scopedRequirements=()=>{const cycle=state.engagement?.cycles?.find(item=>item.id===state.assessmentCycleId);return (state.engagement?.requirements||[]).filter(item=>!cycle||cycle.requirementIds.includes(item.id));};
  const findingFor = requirementId => [...(state.engagement?.findings || [])].reverse().find(item => item.requirementId === requirementId && (item.cycleId||"")===state.assessmentCycleId && !item.supersededBy);
  const selectedRequirement = () => state.engagement?.requirements?.find(item => item.id === state.selectedRequirement);
  const selectedFinding = () => state.engagement?.findings?.find(item => item.id === state.selectedFinding&&(item.cycleId||"")===state.assessmentCycleId) || findingFor(state.selectedRequirement);
  const mandateViews = createEngagementMandateViews({
    get area() { return area; },
    get authenticated() { return authenticated; },
    get button() { return button; },
    get check() { return check; },
    get contributionSummary() { return contributionSummary; },
    get draftKey() { return draftKey; },
    get frameworks() { return frameworks; },
    get h() { return h; },
    get human() { return human; },
    get input() { return input; },
    get mandateRows() { return mandateRows; },
    get optionsFrom() { return optionsFrom; },
    get select() { return select; },
    get state() { return state; },
    get versionRows() { return versionRows; }
  });

  const assessmentViews = createEngagementAssessmentViews({
    get area() { return area; },
    get assertionChoices() { return assertionChoices; },
    get authenticated() { return authenticated; },
    get authority() { return authority; },
    get buildEngagementReviewContext() { return buildEngagementReviewContext; },
    get button() { return button; },
    get check() { return check; },
    get contradictionChoices() { return contradictionChoices; },
    get contributionSummary() { return contributionSummary; },
    get currentFindingReview() { return currentFindingReview; },
    get engagementReportTemplates() { return engagementReportTemplates; },
    get engagementReviewDetails() { return engagementReviewDetails; },
    get engagementReviewFlags() { return engagementReviewFlags; },
    get findingFor() { return findingFor; },
    get findingReviewHistory() { return findingReviewHistory; },
    get getFramework() { return getFramework; },
    get getFrameworkCoverage() { return getFrameworkCoverage; },
    get h() { return h; },
    get human() { return human; },
    get input() { return input; },
    get monitoringAssessmentFields() { return monitoringAssessmentFields; },
    get optionsFrom() { return optionsFrom; },
    get requirementAdder() { return requirementAdder; },
    get requirementLabel() { return requirementLabel; },
    get requirementSourceDetails() { return requirementSourceDetails; },
    get reviewDate() { return reviewDate; },
    get scopedRequirements() { return scopedRequirements; },
    get select() { return select; },
    get selectedFinding() { return selectedFinding; },
    get selectedRequirement() { return selectedRequirement; },
    get sourceReader() { return sourceReader; },
    get state() { return state; }
  });

  const assistanceViews = createEngagementAssistanceViews({
    get authenticated() { return authenticated; },
    get button() { return button; },
    get check() { return check; },
    get h() { return h; },
    get human() { return human; },
    get indexedPassages() { return indexedPassages; },
    get input() { return input; },
    get requirementLabel() { return requirementLabel; },
    get select() { return select; },
    get state() { return state; },
    get versionRows() { return versionRows; }
  });
  const draftKey = form => `${state.accountId}:${state.project?.id || ""}:${state.engagement?.id || "new"}:${form.dataset.engagementForm}:${form.dataset.engagementForm.startsWith("monitor-")?monitoringFormKey(form,state.monitoring):["assessment","finding-review"].includes(form.dataset.engagementForm) ? `${state.assessmentCycleId}:${state.selectedRequirement}` : form.dataset.engagementForm === "action" ? state.selectedAction : form.dataset.engagementForm === "evidence" ? state.selectedAssertion : form.dataset.engagementForm === "obligation" ? state.selectedObligation : form.dataset.engagementForm === "mapping" ? state.selectedMapping : ""}`;
  function mandateRowsFromForm(form) {
    const value=(row,name)=>row.querySelector(`[name="${name}"]`)?.value||"";
    return {deliverables:[...form.querySelectorAll('[data-mandate-row="deliverables"]')].map(row=>({id:value(row,"deliverableId"),title:value(row,"deliverableTitle"),dueDate:value(row,"deliverableDueDate"),description:value(row,"deliverableDescription")})),
      amendments:[...form.querySelectorAll('[data-mandate-row="amendments"]')].map(row=>({id:value(row,"amendmentId"),title:value(row,"amendmentTitle"),sourceVersionId:value(row,"amendmentSourceVersionId"),date:value(row,"amendmentDate"),description:value(row,"amendmentDescription")}))};
  }
  const linkedObligations=deliverableId=>(state.engagement?.obligations||[]).filter(item=>[...(item.history||[]),item].some(record=>record.deliverableIds?.includes(deliverableId)));
  function mandateRows(collection,rows) {
    const deliverables=collection==="deliverables",label=deliverables?"deliverable":"amendment";
    return `<section class="ew-mandate-rows ew-wide" data-mandate-collection="${collection}"><h3>${deliverables?"Deliverables":"Engagement amendments"}</h3><p>${deliverables?"Each deliverable keeps its identity when reordered. Changing a linked deliverable requires renewed confirmation of the affected contractual duties.":"Select the exact retained source version for each amendment. Its identity stays attached to the same row."}</p>${rows.map((item,index)=>{const linked=deliverables?linkedObligations(item.id):[];return `<fieldset class="ew-mandate-row ew-grid" data-mandate-row="${collection}" data-row-id="${h(item.id)}"><legend>${deliverables?"Deliverable":"Amendment"} ${index+1}</legend><input type="hidden" name="${label}Id" value="${h(item.id)}">${input(deliverables?"Deliverable title":"Amendment title",`${label}Title`,item.title||"",{required:true})}${deliverables?input("Deliverable due date","deliverableDueDate",item.dueDate||"",{type:"date"}):select("Amendment source version","amendmentSourceVersionId",[["","Select exact source version"],...optionsFrom(versionRows())],item.sourceVersionId||"",{required:true})}${deliverables?"":input("Amendment date","amendmentDate",item.date||"",{type:"date"})}${area(deliverables?"Deliverable description":"Amendment description",`${label}Description`,item.description||"")}<div class="ew-toolbar ew-wide">${button(`Move ${label} up`,"mandate-row-up",`data-collection="${collection}" data-id="${h(item.id)}"${index===0?' disabled data-unavailable="true"':''}`)}${button(`Move ${label} down`,"mandate-row-down",`data-collection="${collection}" data-id="${h(item.id)}"${index===rows.length-1?' disabled data-unavailable="true"':''}`)}${button(`Remove ${label}`,"mandate-row-remove",`data-collection="${collection}" data-id="${h(item.id)}"${linked.length?' disabled data-unavailable="true"':''}`)}</div>${linked.length?`<p class="ew-small ew-wide" data-mandate-linked>Removal is blocked: linked by ${linked.length} contractual obligation record${linked.length===1?"":"s"} or their retained history. ${linked.map(item=>h(item.text)).join("; ")}</p>`:""}</fieldset>`;}).join("")||`<p>No ${collection} recorded.</p>`}${button(`Add ${label}`,"mandate-row-add",`data-collection="${collection}"${rows.length>=100?' disabled data-unavailable="true"':''}`)}</section>`;
  }
  function remember() {
    for (const form of root.querySelectorAll("form[data-engagement-form]")) {
      if(form.dataset.privateForm==="true")continue;
      const values = {};
      for (const field of form.elements) {
        if (!field.name || ["file", "submit", "button", "password"].includes(field.type)) continue;
        values[field.name] ??= [];
        if (["checkbox", "radio"].includes(field.type) && !field.checked) continue;
        if (field.multiple) values[field.name].push(...[...field.selectedOptions].map(item => item.value));else values[field.name].push(field.value);
      }
      if(["create","mandate"].includes(form.dataset.engagementForm))values.__mandateRows=mandateRowsFromForm(form);
      state.drafts.set(draftKey(form), values);
    }
  }
  function restore() {
    for (const form of root.querySelectorAll("form[data-engagement-form]")) {
      if(form.dataset.privateForm==="true")continue;
      const values = state.drafts.get(draftKey(form));if (!values) continue;const offsets={};
      for (const field of form.elements) {
        if (!field.name || field.type === "file" || !Object.hasOwn(values, field.name)||values.__mandateRows&&field.closest("[data-mandate-row]")) continue;
        if (["checkbox", "radio"].includes(field.type)) field.checked = values[field.name].includes(field.value);
        else if (field.multiple) for (const item of field.options) item.selected = values[field.name].includes(item.value);
        else {const offset=offsets[field.name]||0;field.value=values[field.name][offset]??"";offsets[field.name]=offset+1;}
      }
    }
  }
  function announce(message, error = false) {
    if (state.disposed) return;state.message = String(message);state.error = error;
    const status = root.querySelector("[data-engagement-status]");if (status) {status.textContent = state.message;status.setAttribute("role", error ? "alert" : "status");status.classList.toggle("ew-error", error);}
  }
  function locks() {
    root.setAttribute("aria-busy", String(state.busy || state.nestedBusy));
    for (const element of root.querySelectorAll("[data-monitor-action],[data-engagement-action],[data-engagement-tab],[data-engagement-project],[data-engagement-select],[data-engagement-account],[data-engagement-actor],form[data-engagement-form] button,form[data-engagement-form] input,form[data-engagement-form] textarea,form[data-engagement-form] select")) element.disabled = state.busy || state.nestedBusy || element.hasAttribute("data-unpublished") || element.hasAttribute("data-unavailable");
  }
  function download(blob, filename) {
    const url = view.URL.createObjectURL(blob), anchor = document.createElement("a");anchor.href = url;anchor.download = filename;anchor.hidden = true;root.append(anchor);anchor.click();anchor.remove();view.setTimeout(() => view.URL.revokeObjectURL(url), 1000);
  }
  function updateAddress() {
    address.searchParams.set("account", state.accountId);
    for (const [name,value] of [["project",state.project?.id],["engagement",state.engagement?.id]]) {if (value) address.searchParams.set(name,value);else address.searchParams.delete(name);}
    if(state.engagement){address.searchParams.set("tab",state.tab);const cycleId=state.tab==="monitoring"?state.monitoring.cycleId:["matrix","actions"].includes(state.tab)?state.assessmentCycleId:"",missionId=state.tab==="monitoring"&&state.monitoring.view==="missions"?state.monitoring.editing.missions:"";for(const[name,value]of [["cycleId",cycleId],["missionId",missionId]]){if(value)address.searchParams.set(name,value);else address.searchParams.delete(name);}}
    for(const[name,value]of [["eventId",state.tab==="monitoring"&&state.monitoring.view==="events"?state.monitoring.editing.events:""],["view",state.tab==="monitoring"?state.monitoring.view:""],["actionId",state.tab==="actions"?state.selectedAction:""],["requestId",state.tab==="monitoring"&&state.monitoring.view==="submissions"?state.monitoring.editing.requests:""]]){if(value)address.searchParams.set(name,value);else address.searchParams.delete(name);}
    if(state.tab === "matrix" && scopedRequirements().some(item => item.id === state.selectedRequirement)) address.searchParams.set("requirementId", state.selectedRequirement);else address.searchParams.delete("requirementId");
    address.searchParams.delete("cycle");if(state.tab==="monitoring"&&state.monitoring.view==="overview")address.searchParams.set("attention",state.monitoring.attentionLevel||"cycle");else address.searchParams.delete("attention");
    view.history.replaceState(null,"",address.pathname + address.search + address.hash);
  }
  function resetReviewContext() {
    state.policyPreview=null;state.citationExtraction=null;state.selectedRequirement="";state.selectedFinding="";state.selectedAction="";state.selectedAssertion="";state.selectedObligation="";state.selectedMapping="";state.selectedVersion="";state.page=1;
    state.preview=null;state.previewError="";state.previewBusy=false;state.readerEpoch++;state.index=null;state.assistance=null;state.discardedSuggestions=[];state.passageQuery="";state.selectedSourceIds=[];
    clearMonitoringPrivateState(state.monitoring);state.monitoring=newMonitoringState();state.assessmentCycleId="";
  }
  let initialContextApplied=false;
  function applyInitialReviewContext(){
    if(initialContextApplied||!state.engagement)return;initialContextApplied=true;
      if(state.engagement&&["mandate","evidence","matrix","actions","monitoring","approval","outputs","crosswalk"].includes(initialMonitoringContext.tab)){
        state.tab=initialMonitoringContext.tab;if(["portfolio","project","cycle"].includes(initialMonitoringContext.attention))state.monitoring.attentionLevel=initialMonitoringContext.attention;const cycle=state.engagement.cycles?.find(item=>item.id===initialMonitoringContext.cycleId),mission=state.engagement.missions?.find(item=>item.id===initialMonitoringContext.missionId);
        if(cycle){state.monitoring.programId=cycle.programId;state.monitoring.cycleId=cycle.id;state.assessmentCycleId=cycle.id;}
        const requirement=state.tab==="matrix"&&scopedRequirements().find(item=>item.id===initialMonitoringContext.requirementId);if(requirement){state.selectedRequirement=requirement.id;state.selectedFinding="";}
        if(initialMonitoringContext.tab==="monitoring"){
          const viewAlias={requests:"submissions"},requestedView=viewAlias[initialMonitoringContext.view]||initialMonitoringContext.view;
          if(["overview","program","obligations","cycles","submissions","indicators","missions","events","verification","reports"].includes(requestedView))state.monitoring.view=requestedView;
          const selectedEvent=state.engagement.events?.find(item=>item.id===initialMonitoringContext.eventId);if(selectedEvent){state.monitoring.programId=selectedEvent.programId;state.monitoring.editing.events=selectedEvent.id;state.monitoring.view="events";if(selectedEvent.cycleId){state.monitoring.cycleId=selectedEvent.cycleId;state.assessmentCycleId=selectedEvent.cycleId;}}
          const request=state.engagement.requests?.find(item=>item.id===initialMonitoringContext.requestId&&(!cycle||item.cycleId===cycle.id));if(request){const requestCycle=state.engagement.cycles?.find(item=>item.id===request.cycleId);if(requestCycle){state.monitoring.programId=requestCycle.programId;state.monitoring.cycleId=requestCycle.id;state.assessmentCycleId=requestCycle.id;state.monitoring.editing.requests=request.id;state.monitoring.view="submissions";}}
        }
        const action=initialMonitoringContext.tab==="actions"&&state.engagement.actions?.find(item=>item.id===initialMonitoringContext.actionId&&item.status!=="superseded");if(action){state.selectedAction=action.id;if(action.cycleId){const actionCycle=state.engagement.cycles?.find(item=>item.id===action.cycleId);if(actionCycle){state.monitoring.programId=actionCycle.programId;state.monitoring.cycleId=actionCycle.id;state.assessmentCycleId=actionCycle.id;}}}
        if(mission&&(!cycle||mission.cycleId===cycle.id)){state.monitoring.programId=mission.programId;state.monitoring.cycleId=mission.cycleId;state.monitoring.editing.missions=mission.id;state.monitoring.view="missions";}
      }
  }
  function accept(value) {
    const engagement = value.engagement || value;
    const custodyId = state.project?.storageAccount?.id || state.accounts.find(item => item.id === state.accountId)?.custodyId || state.accountId;
    if (!engagement?.id || engagement.projectId !== state.project?.id || engagement.accountId && engagement.accountId !== custodyId) throw new Error("The engagement response belongs to another account or source project.");
    if (authenticated && (engagement.id !== authority.engagementId || engagement.projectId !== authority.projectId || engagement.accountId !== authority.accountId)) throw new Error("The response changed the authorized engagement scope.");
    if(state.engagement?.id!==engagement.id){resetReviewContext();state.tab="mandate";}
    state.engagement = engagement;
    const actors = actorNames(engagement);if (authenticated) state.actorId = authority.userId;else if (!actors.includes(state.actorId)) state.actorId = actors[0] || "";
    if (!engagement.requirements?.some(item => item.id === state.selectedRequirement)) state.selectedRequirement = engagement.requirements?.[0]?.id || "";
    if (!engagement.findings?.some(item => item.id === state.selectedFinding)) state.selectedFinding = "";
    if (!engagement.obligations?.some(item => item.id === state.selectedObligation)) state.selectedObligation = "";
    if (!engagement.mappings?.some(item => item.id === state.selectedMapping)) state.selectedMapping = "";
    if (!engagement.assertions?.some(item => item.id === state.selectedAssertion)) state.selectedAssertion = "";
    if (!engagement.actions?.some(item => item.id === state.selectedAction&&item.status!=="superseded")) state.selectedAction = "";
    const index = state.engagements.findIndex(item => item.id === engagement.id);
    if (index < 0) state.engagements.push(engagement);else state.engagements[index] = engagement;
    applyInitialReviewContext();
    updateAddress();
  }
  async function run(operation) {
    if (state.disposed || state.busy || state.nestedBusy) return;
    remember();state.busy = true;locks();const epoch = generation;
    try {await operation();}
    catch (error) {if (!state.disposed && generation === epoch) announce(`${error.message || "The local operation failed."}${error.status === 409 ? " Refresh the record; your entries remain available." : ""}`,true);}
    finally {if (!state.disposed) {state.busy = false;render();}}
  }
  async function command(command, {form, message = "Engagement record saved."} = {}) {
    const scope = {id: state.engagement.id, accountId: state.accountId, projectId: state.project.id}, key = form && draftKey(form);
    const result = await api(`${base()}/commands`, {method:"POST", body:{expectedRevision:state.engagement.revision, actorId:state.actorId, command}});
    if (state.disposed || state.engagement?.id !== scope.id || state.accountId !== scope.accountId || state.project?.id !== scope.projectId) return;
    accept(result);if (key) state.drafts.delete(key);announce(message);return state.engagement;
  }
  async function sourceCommand(command) {
    const accountId = state.accountId, projectId = state.project.id;
    let classificationCommand=command.type==="document-classification"?command.command:null;
    if(command.type==="metadata"&&command.metadata.classificationReview){const {classificationReview,...metadata}=command.metadata;classificationCommand={type:"review",versionId:command.versionId,metadata,statement:classificationReview.statement,requirementIds:classificationReview.requirementIds};}
    else if(authenticated&&command.type==="metadata")classificationCommand={type:"metadata",versionId:command.versionId,metadata:command.metadata};
    const result = classificationCommand?await api(`${base()}/document-classifications`,{method:"POST",body:{expectedRevision:state.engagement.revision,expectedProjectRevision:state.project.revision,actorId:state.actorId,command:classificationCommand}}):await api(`${projectBase()}/commands`, {method:"POST",body:{expectedRevision:state.project.revision,command}});
    if (state.disposed || state.accountId !== accountId || state.project?.id !== projectId) throw new Error("The source project context changed before acknowledgement.");
    state.project = result.project || result;
    if (state.engagement) accept(await api(base()));
    if(state.disposed||state.accountId!==accountId||state.project?.id!==projectId)return state.project;
    state.documents._render?.();
    for(const field of root.querySelectorAll('[data-engagement-form="evidence"] [name="versionId"],[data-engagement-reader-version]')){
      const previous=field.value;field.innerHTML=choices([["","Select exact source version"],...optionsFrom(versionRows())],previous);
    }
    return state.project;
  }
  async function openProject(id) {
    const epoch = ++generation, accountId = state.accountId;state.engagement = null;resetReviewContext();
    const sourceKey=`${accountId}:${id}`;if(!state.sourceStates.has(sourceKey))state.sourceStates.set(sourceKey,{intake:{},documents:{}});Object.assign(state,state.sourceStates.get(sourceKey));
    const project = await api(`/api/projects/${encodeURIComponent(id)}`);
    if (state.disposed || epoch !== generation || accountId !== state.accountId) return;
    state.project = project;
    const result = await api(`/api/engagements?projectId=${encodeURIComponent(id)}`);
    if (state.disposed || epoch !== generation || accountId !== state.accountId) return;
    state.engagements = Array.isArray(result) ? result : result.engagements || [];
    if (state.engagements.length) {
      const wanted = state.engagements.find(item => item.id === address.searchParams.get("engagement")) || state.engagements[0], record = await api(`/api/engagements/${encodeURIComponent(wanted.id)}`);
      if (state.disposed || epoch !== generation || accountId !== state.accountId) return;accept(record);
    } else updateAddress();
  }
  function devicePolicyFields(...args) { return mandateViews.devicePolicyFields(...args); }
  function mandateFields(...args) { return mandateViews.mandateFields(...args); }
  function setupView(...args) { return mandateViews.setupView(...args); }
  function obligationView(...args) { return mandateViews.obligationView(...args); }
  function mandateView(...args) { return mandateViews.mandateView(...args); }
  let readerSelection=null,readerAnchor=null,pilotMount=null;const handoverStates=new Map(),sourceReviewDrafts=new Map();
  controller.signal.addEventListener("abort",()=>{readerSelection=null;readerAnchor=null;pilotMount?.dispose();});
  function sourceReader() {
    return `<section class="ew-reader ew-panel" aria-label="Exact source passage reader"><div class="ew-heading"><h3>Read the source</h3>${button("Use selected text","quote-selection")}</div><div class="ew-grid">${select("Exact source version","readerVersionId",[["","Choose a source"],...optionsFrom(versionRows())],state.selectedVersion,{data:'data-engagement-reader-version'})}${input("PDF file page","readerPage",state.page,{type:"number"})}</div><div class="ew-toolbar">${button("Open exact page","preview")}${button("Download original","download-original")}</div><p class="ew-small" data-reader-identity></p><p role="status" data-reader-status></p><div data-engagement-reader-content class="ew-reader-content" tabindex="0"></div></section>`;
  }
  function assertionChoices(name, selected = []) {
    return `<div class="ew-evidence-choices">${(state.engagement.assertions || []).map(item => check(`${item.locator} · ${item.note || item.quote || item.id} · ${item.reviewStatus}`,name,selected.includes(item.id),{value:item.id})).join("") || '<p>No passage assertions yet. Add them in Evidence.</p>'}</div>`;
  }
  function contradictionChoices(finding) {
    const selected=finding?.contradictoryAssertionIds||[];
    return `<p>Keep qualifying evidence attached to the conclusion. Each selected citation starts unresolved. Explain why it is superseded, outweighed or otherwise resolved before recording compliance; the reviewer must check that reasoning.</p>${(state.engagement.assertions||[]).map(item=>{
      const disposition=finding?.contradictionDispositions?.find(value=>value.assertionId===item.id);
      return `<div class="ew-record" data-contradiction-citation>${check(`${item.locator} · ${item.note||item.quote||item.id} · ${item.reviewStatus}`,"contradictoryAssertionIds",selected.includes(item.id),{value:item.id})}<div data-contradiction-controls${selected.includes(item.id)?"":" hidden"}>${select("Disposition",`contradiction-disposition-${item.id}`,contradictionDispositionChoices,disposition?.disposition||"unresolved")}${area("Reasoning and effect on this conclusion",`contradiction-rationale-${item.id}`,disposition?.rationale||"")}</div></div>`;
    }).join("")||"<p>No passage assertions yet. Add them in Evidence.</p>"}`;
  }
  function syncContradictionControls() {
    for(const row of root.querySelectorAll("[data-contradiction-citation]")) row.querySelector("[data-contradiction-controls]").hidden=!row.querySelector('[name="contradictoryAssertionIds"]').checked;
  }
  function fieldCaptureDetails(item) {
    const capture=item.fieldCapture;if(!capture)return "";
    const mission=state.engagement.missions?.find(row=>row.id===capture.links?.context?.missionId),related=[...(capture.links?.requirementIds||[]),...(capture.links?.context?.requirementId?[capture.links.context.requirementId]:[])];
    return `<details data-field-evidence><summary>Field observation and original files</summary><p>Recorded by ${h(capture.declaredAuthor)} · ${h(new Date(capture.capturedAt).toLocaleString())}</p><p>Signed-in uploader: ${h(capture.uploadedBy)} · saved ${h(new Date(capture.receivedAt).toLocaleString())}</p>${mission?`<p>Field mission: ${h(mission.name)}</p>`:""}${related.length?`<p>Related requirements: ${[...new Set(related)].map(id=>h(state.engagement.requirements.find(row=>row.id===id)?.title||id)).join("; ")}</p>`:""}<p>Review this observation and its originals before using it in a finding.</p><div class="ew-toolbar">${capture.media.map((pin,index)=>button(`Open ${versionRows().find(row=>row.id===pin.versionId)?.filename||`original ${index+1}`}`,"field-original",`data-id="${h(item.id)}" data-index="${index}"`)).join("")}</div></details>`;
  }
  function evidenceView() {
    const intakePanel=authenticated?'<details><summary>Add original documents</summary><div data-source-intake></div></details>':`<details><summary>Import files, register an external local file or capture a source</summary><div data-source-intake></div><form data-engagement-form="register" class="ew-form ew-grid">${input("External document title","title","",{required:true})}${input("Absolute local file path","path","",{required:true})}<button type="submit">Register existing document</button><p class="ew-small">Registration retains an exact hash and local path. Capture a managed copy before relying on historical bytes.</p></form></details>`;
    const captureHref="/fieldwork?"+new URLSearchParams({account:state.accountId,project:state.project.id,...(authenticated?{mode:"authenticated",engagement:state.engagement.id}:{engagementId:state.engagement.id})});
    return `<p><a data-engagement-field-capture href="${h(captureHref)}">Capture field evidence</a></p>`+`<section class="ew-panel"><h2>Document and evidence register</h2><p>Import mixed documents in bounded batches of ten. Preserve revisions as new versions. The existing library keeps originals, metadata corrections, tags and provenance together.</p>${intakePanel}<div data-project-documents></div></section>${renderSourceCoverage(state.index,{sourceReviews:state.engagement.sourceReviews||[]})}<div class="ew-panel" data-source-review-mount></div>${authenticated?'':'<section class="ew-panel" data-assignment-pilot-mount></section>'}<div data-external-reference-mount></div><div data-bibliography-mount></div><div class="ew-split"><section class="ew-panel"><h2>Passage-level evidence</h2>${state.selectedAssertion?`<p>Correcting existing citation <code>${h(state.selectedAssertion)}</code>. Its earlier contribution remains in history.</p>${button("New passage assertion","new-assertion")}`:""}<form data-engagement-form="evidence" class="ew-form ew-grid"><input type="hidden" name="extractionIndexId" value=""><input type="hidden" name="extractionPassageId" value=""><p class="ew-small ew-wide" data-citation-extraction-status hidden></p><div class="ew-wide" data-citation-manual-control hidden>${button("Use a manual citation","manual-citation")}</div>${select("Exact source version","versionId",[["","Select version"],...optionsFrom(versionRows())],state.selectedVersion,{required:true})}${input("Page, paragraph, table or feature locator","locator","",{required:true})}${area("Exact quotation / passage","quote")}${area("What this evidence supports or contradicts","note","",{required:true})}${input("E&S topics (comma separated)","topics")}${select("Classification status","classification",[["manual","Human classified"],["ai_suggested","AI suggested"]],"manual")}${select("Metadata / citation review","reviewStatus",[["confirmed","Human confirmed"],["modified","Human modified"],["suggested","Awaiting review"]],"confirmed")}${input("Extraction / citation method","method","Manual source review")}${input("Model provenance (if AI)","model")}<fieldset class="ew-wide"><legend>Related project requirements</legend>${(state.engagement.requirements || []).map(item => check(requirementLabel(item),"requirementIds",false,{value:item.id})).join("") || '<p>Add requirements in the matrix.</p>'}</fieldset><button type="submit">Save passage assertion</button></form><div class="ew-records">${(state.engagement.assertions || []).map(item => `<article class="ew-record"><h3>${h(item.locator)}</h3><blockquote>${h(item.quote)}</blockquote><p>${h(item.note)}</p>${contributionSummary(item,"citation")}<p>${h(item.reviewStatus)} · ${h(item.versionId)} · SHA256 <code>${h(item.sha256 || item.sourceSha256 || versionRows().find(version => version.id === item.versionId)?.sha256)}</code></p>${fieldCaptureDetails(item)}${item.extraction?`<p class="ew-small" data-retained-extraction>Extraction: ${h(item.extraction.method)} · ${h(item.extraction.extractorVersion)} · source range ${h(item.extraction.range.start)}–${h(item.extraction.range.end)} (${h(item.extraction.range.basis)}). Exact excerpt binding retained through review.</p>`:""}${button("Verify source passage","assertion-source",`data-id="${h(item.id)}"`)} ${button("Review / correct citation","edit-assertion",`data-id="${h(item.id)}"`)}</article>`).join("")}</div></section>${sourceReader()}</div>`;
  }
  function requirementLabel(item) {return [getFramework(item.frameworkId)?.institution || item.framework?.authority || "Project", item.standard || item.framework?.clause || item.clause, item.title || item.text || item.prompt || item.id].filter(Boolean).join(" · ");}
  function monitoringAssessmentFields(finding) {
    if(!state.assessmentCycleId)return "";
    const previous=(state.engagement.findings||[]).filter(item=>item.requirementId===state.selectedRequirement&&item.cycleId!==state.assessmentCycleId&&(!item.cycleId||state.engagement.cycles.find(cycle=>cycle.id===item.cycleId)?.periodEnd<state.engagement.cycles.find(cycle=>cycle.id===state.assessmentCycleId)?.periodStart));
    return `<fieldset class="ew-wide"><legend>Period-specific implementation, outcomes and continuity</legend><div class="ew-grid">${select("Prior due diligence / monitoring finding","priorFindingId",[["","No prior finding linked"],...previous.map(item=>[item.id,`${item.cycleId?state.engagement.cycles.find(cycle=>cycle.id===item.cycleId)?.name||"Prior period":"Due diligence"} · ${human(item.performance)} · ${item.rationale}`])],finding?.priorFindingId||previous.at(-1)?.id||"")}${select("Implementation","implementation",["not_assessed","not_started","partial","implemented","inconclusive"],finding?.implementation||"inconclusive")}${select("Mitigation effectiveness","effectiveness",["not_assessed","effective","partly_effective","ineffective","inconclusive"],finding?.effectiveness||"inconclusive")}${select("Evidence sufficiency","evidenceSufficiency",["sufficient","limited","insufficient","inconclusive"],finding?.evidenceSufficiency||"inconclusive")}${select("Residual risk","residualRisk",["unknown","low","moderate","high","critical"],finding?.residualRisk||"unknown")}${select("Risk trajectory","riskTrajectory",["unknown","stable","increasing","decreasing"],finding?.riskTrajectory||"unknown")}</div><p>These judgments apply to this reporting period. Prior findings and approved snapshots remain unchanged.</p></fieldset>`;
  }
  function requirementAdder() {
    const permitted = state.engagement.frameworkIds || [], available = frameworks.filter(item => permitted.includes(item.id));
    if (!available.some(item => item.id === state.frameworkId)) state.frameworkId = available[0]?.id || "";
    const sets = auditCheckSets(state.frameworkId), checks = getAuditChecks(state.frameworkId,state.checkSet);
    if (!checks.some(item => item.id === state.checkId)) state.checkId = checks[0]?.id || "";
    return `<details class="ew-panel"><summary>Add applicable requirements</summary><p>Use the selected edition’s sourced checks or load its detailed private library. Starter checks are a screening subset; they are not the complete standards denominator.</p><form data-engagement-form="requirement" class="ew-form ew-grid">${select("Framework edition","frameworkId",available.map(item => [item.id,`${item.institution} · ${item.edition} · ${item.name}`]),state.frameworkId,{required:true,data:'data-engagement-framework'})}${select("Requirement collection","checkSet",sets.map(item => [item.id,item.label]),state.checkSet,{data:'data-engagement-checkset'})}${select("Requirement / source statement","checkId",checks.map(item => [item.id,`${item.standard} · ${item.clause} · ${item.title || item.prompt}`]),state.checkId,{required:true})}<div class="ew-toolbar">${button("Load private source statements","load-library")}<button type="submit">Add selected requirement</button>${button("Add collection to matrix","add-collection")}</div></form><details><summary>Add a project-specific E&S commitment, permit or covenant</summary><p>Source-backed project duties belong here. The practitioner’s contractual scope belongs in the client register.</p><form data-engagement-form="custom-requirement" class="ew-form ew-grid">${input("Requirement title","title","",{required:true})}${select("Source version","sourceVersionId",[["","Select exact original"],...optionsFrom(versionRows())],"",{required:true})}${input("Source locator","locator","",{required:true})}${area("Authoritative source wording","text","",{required:true})}${input("Topics (comma separated)","topics")}<button type="submit">Add project requirement</button></form></details></details>`;
  }
  function requirementSourceDetails(requirement) {
    const detail=requirement.definition?.detail,context=detail?.context||{},sources=requirement.sources||[],page=Number(detail?.page||detail?.pages?.[0]||1);
    const retained=state.policyPreview?.requirementId===requirement.id?state.policyPreview:null;
    const parent=typeof context.parentText==="string"?context.parentText:typeof context.paragraph==="string"?context.paragraph:"";
    return `<details class="ew-requirement-context"${retained?" open":""}><summary>Requirement source and qualification context</summary><p>${h(human(requirement.textKind||"review_prompt"))} · ${h(requirement.coverageNote||"Review the authoritative original and all qualifications.")}</p><p><strong>${h(requirement.authority)} · ${h(requirement.frameworkName)} · ${h(requirement.edition)}</strong></p>${detail?`<p>${h(context.section||requirement.standard)} · PDF file page ${h(page)} · parser ${h(requirement.definition.parserVersion||"not recorded")}. Extracted source candidate: professional interpretation and whole-instrument coverage remain unreviewed.</p>${parent?`<h3>Parent paragraph and conditions</h3><blockquote>${h(parent)}</blockquote>`:""}${Array.isArray(context.listItems)&&context.listItems.length?`<h3>Related list context</h3><ul>${context.listItems.map(item=>`<li>${h(typeof item==="string"?item:item.text||"Review original list structure")}</li>`).join("")}</ul>`:""}<p>Review list structure, exceptions and footnotes in the original. Extraction does not settle their legal meaning or applicability.</p>`:""}${sources.map(source=>`<article class="ew-record"><h3>${h(source.title)}</h3><p>${h(source.locator||requirement.clause)}</p>${source.sha256?`<p>Retained policy SHA256 <code>${h(source.sha256)}</code></p>`:"<p>This diagnostic reference has no retained policy-original hash. Load and inspect the source library before treating it as original requirement wording.</p>"}${requirement.frameworkId!=="project"&&/^[a-f0-9]{64}$/.test(source.sha256||"")?`<div class="ew-toolbar">${button("Read retained policy page","policy-source-preview",`data-framework-id="${h(requirement.frameworkId)}" data-source-sha="${h(source.sha256)}" data-source-page="${h(page)}"`)}${button("Download retained policy original","policy-source-download",`data-framework-id="${h(requirement.frameworkId)}" data-source-sha="${h(source.sha256)}"`)}</div>`:""}</article>`).join("")}${retained?`<section data-policy-source-preview><h3>Exact retained policy original</h3><p>${h(retained.payload.policy?.title)} · ${h(retained.payload.policy?.edition)} · PDF file page ${h(retained.page)}</p><p>SHA256 <code>${h(retained.payload.sha256)}</code></p>${/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(retained.payload.imageDataUrl||"")&&(retained.payload.imageDataUrl||"").length<=12*1024*1024?`<img class="ew-policy-page" src="${h(retained.payload.imageDataUrl)}" alt="Retained policy PDF file page ${h(retained.page)}">`:""}<pre>${h(retained.payload.text||"Preview unavailable; deliberately download the retained original.")}</pre>${(retained.payload.warnings||[]).map(warning=>`<p>${h(warning)}</p>`).join("")}<p class="ew-small">${h(retained.payload.policy?.rights)} Policy originals are retained separately from project evidence and ordinary project backup.</p></section>`:""}<details><summary>Full retained source metadata</summary><pre>${h(JSON.stringify(requirement.definition||requirement.catalogDefinition||sources,null,2))}</pre></details></details>`;
  }
  function matrixView(...args) { return assessmentViews.matrixView(...args); }
  function actionReviewerSummary(...args) { return assessmentViews.actionReviewerSummary(...args); }
  function actionReviewerEditor(...args) { return assessmentViews.actionReviewerEditor(...args); }
  function syncActionReviewerFields(...args) { return assessmentViews.syncActionReviewerFields(...args); }
  function actionReviewerChange(...args) { return assessmentViews.actionReviewerChange(...args); }
  function actionsView(...args) { return assessmentViews.actionsView(...args); }
  function approvalView(...args) { return assessmentViews.approvalView(...args); }
  function outputsView(...args) { return assessmentViews.outputsView(...args); }
  function crosswalkView(...args) { return assessmentViews.crosswalkView(...args); }
  const indexedPassages=()=>state.index?.matches?.candidates||state.index?.passages||[];
  function candidateSources(...args) { return assistanceViews.candidateSources(...args); }
  function candidateCard(...args) { return assistanceViews.candidateCard(...args); }
  function assistanceView(...args) { return assistanceViews.assistanceView(...args); }
  function render() {
    if (state.disposed) return;
    if (state.index?.projectRevision !== undefined && state.index.projectRevision !== state.project?.revision) state.index = null;
    const previousActive=document.activeElement,activeForm=previousActive?.closest?.("[data-engagement-form]");
    const focus=activeForm&&previousActive.name?{form:activeForm.dataset.engagementForm,name:previousActive.name}:null;
    if(state.renderedScope)state.detailStates.set(state.renderedScope,[...root.querySelectorAll("details[open]")].map(item=>item.querySelector(":scope > summary")?.textContent));
    reportTemplateMount?.dispose();reportTemplateMount=null;bibliographyMount?.dispose();bibliographyMount=null;externalReferenceMount?.dispose();externalReferenceMount=null;
    intakeMount?.dispose(authenticated?{retainQueue:true}:undefined);documentsMount?.dispose();successorMount?.dispose({retainState:true});historyMount?.dispose();caseMount?.dispose();invitationMount?.dispose();caseMount=invitationMount=null;successorMount=historyMount=null;intakeMount = documentsMount = null;
    root.classList.add("engagement-workspace");
    const e = state.engagement;
    root.innerHTML = `<header class="ew-header"><div><p class="ew-kicker">E&amp;S Review · professional engagements</p><h1>${h(e?.name || "From assignment to approved assessment")}</h1><p>One linked record of mandate, evidence, professional judgments and commitments.</p></div><a class="ew-link" href="${authenticated?"/workspaces":`/?account=${h(encodeURIComponent(state.accountId))}${state.project ? `&project=${h(encodeURIComponent(state.project.id))}` : ""}`}">${authenticated?"Workspaces":"Project records"}</a></header><p class="ew-status${state.error ? " ew-error" : ""}" data-engagement-status role="${state.error ? "alert" : "status"}">${h(state.message)}</p><section class="ew-context ew-panel">${authenticated?`<dl data-engagement-authenticated-authority><dt>Signed-in user</dt><dd>${h(authority.userId)}</dd><dt>Responsibilities</dt><dd>${h(authority.roles.map(human).join(", ")||"View access")}</dd><dt>Account</dt><dd>${h(authority.accountId)}</dd><dt>Source project</dt><dd>${h(authority.projectName)}</dd><dt>Engagement</dt><dd>${h(e?.name||authority.engagementId)}</dd></dl><p>Upload originals and review shared evidence. Prepare your phone for encrypted offline field notes, then save selected records and photos to this engagement when connected.</p>`:`<label><span>Storage account</span><select data-engagement-account>${choices(state.accounts.map(item => [item.id,item.name]),state.accountId)}</select></label><label><span>Source project</span><select data-engagement-project>${choices([["","Choose a project"],...state.projects.map(item => [item.id,item.name])],state.project?.id)}</select></label>${state.project ? `<label><span>Engagement for this project</span><select data-engagement-select>${choices([["","New engagement"],...state.engagements.map(item => [item.id,`${item.name} · ${item.client}`])],e?.id)}</select></label>` : ""}${e ? `<label><span>Acting local team member</span><select data-engagement-actor>${choices(actorNames(e).map(actor => [actor,`${actor} · ${Object.entries(e.roles).filter(([,members]) => members.includes(actor)).map(([role]) => human(role)).join(", ")}`]),state.actorId)}</select></label><details class="ew-small ew-wide"><summary>Record identity and local responsibility</summary><p>${h(state.project?.name)} · ${h(e.client)} · ${h(human(e.type))} · ${h(human(e.status))} · revision ${h(e.revision)} · <code>${h(e.id)}</code>. Team identities are local declarations.</p></details>` : ""}`}</section>${!state.project ? '<section class="ew-panel"><h2>Start from a project</h2><p>Choose an existing source project, or create one in Project records. Each project can have several separately scoped engagements.</p></section>' : !e ? setupView() : `${renderAssignmentGuide({engagement:e,sourceCount:versionRows().length,authenticated})}<nav class="ew-tabs" aria-label="Engagement workflow">${!authenticated?`<a class="ew-link" href="/assistant?account=${h(encodeURIComponent(state.accountId))}&amp;project=${h(encodeURIComponent(state.project.id))}&amp;engagement=${h(encodeURIComponent(e.id))}&amp;actor=${h(encodeURIComponent(state.actorId))}">Project assistant</a>`:""}${[["mandate","Mandate"],["evidence","Evidence"],["matrix","Requirements"],["actions","Actions"],["monitoring","Monitoring"],["approval","Review & approval"],["outputs","Deliverables"],["crosswalk","Cross-framework"]].map(([id,label]) => `<button type="button" data-engagement-tab="${id}"${id === state.tab ? ' aria-current="page"' : ""}>${label}</button>`).join("")}${button("Refresh saved record","refresh")}</nav><div data-engagement-panel="${h(state.tab)}">${({mandate:mandateView,evidence:evidenceView,matrix:matrixView,actions:actionsView,approval:approvalView,outputs:outputsView,crosswalk:crosswalkView,monitoring:()=>renderEngagementMonitoring({engagement:state.engagement,sourceVersions:versionRows(),state:state.monitoring,actorId:state.actorId,accountId:state.accountId,authorityMode:authenticated?"authenticated":"local"})}[state.tab] || mandateView)()}</div>${assistanceView()}`}`;
    if(authenticated){for(const field of root.querySelectorAll('[data-engagement-form="mandate"] [name="preparer"],[data-engagement-form="mandate"] [name="reviewer"],[data-engagement-form="mandate"] [name="approver"],[data-engagement-form="mandate"] [name="clientRole"]'))field.readOnly=true;for(const link of root.querySelectorAll('a[href^="/fieldwork"]')){const destination=new URL(link.getAttribute("href"),address);destination.searchParams.set("mode","authenticated");destination.searchParams.set("engagement",authority.engagementId);destination.searchParams.set("account",authority.accountId);destination.searchParams.set("project",authority.projectId);destination.searchParams.delete("engagementId");link.setAttribute("href",destination.pathname+destination.search);}}
    restore();syncContradictionControls();for(const form of root.querySelectorAll('[data-engagement-form="action"],[data-engagement-form="consolidate"]'))syncActionReviewerFields(form);
    const citationForm=root.querySelector('[data-engagement-form="evidence"]'),selectedCitation=e?.assertions.find(item=>item.id===state.selectedAssertion);if(citationForm&&selectedCitation&&!state.drafts.has(draftKey(citationForm)))populateEvidenceForm(selectedCitation);
    if (!e && state.project) updateWizard();
    if (state.tab === "evidence" && e) mountSources();
    if(!authenticated&&state.tab==='outputs'&&e){const templateRoot=root.querySelector('[data-engagement-report-template-mount]'),scopeKey=[state.accountId,state.project.id,e.id].join(':'),scopeGeneration=generation;if(!reportTemplateStates.has(scopeKey))reportTemplateStates.set(scopeKey,{templateId:address.searchParams.get('reportTemplate')||'app-due-diligence'});reportTemplateMount=mountReportTemplateWorkbench(templateRoot,{state:reportTemplateStates.get(scopeKey),scope:{accountId:state.accountId,engagement:e},request:api,assertCurrent:()=>{if(state.disposed||generation!==scopeGeneration||state.engagement?.id!==e.id)throw Error('The selected engagement closed.');}});}

    if(!authenticated&&state.tab==='outputs'&&e){
      const key=`${state.accountId}:${state.project.id}:${e.id}`,accountId=state.accountId,projectId=state.project.id,engagementId=e.id,scopeGeneration=generation;
      if(!handoverStates.has(key))handoverStates.set(key,{});
      const assertCurrent=()=>{if(state.disposed||generation!==scopeGeneration||state.accountId!==accountId||state.project?.id!==projectId||state.engagement?.id!==engagementId)throw Error('The project handover context closed. Reopen the selected assignment.');};
      root.querySelector('[data-engagement-panel=outputs]').append(renderProjectHandover({document,project:state.project,engagementId:e.id,actorId:state.actorId,state:handoverStates.get(key),request:async(...args)=>{assertCurrent();const result=await api(...args);assertCurrent();return result;},onRestored:async result=>{assertCurrent();view.location.assign('/engagements?'+new URLSearchParams({account:result.account.id,project:result.project.id,tab:'outputs'}));}}));
    }
    if(state.tab === "evidence" && e) {mountExternalReferences();mountBibliography();}
    if(authenticated&&state.tab==="outputs"&&e&&authority.permissions.some(action=>["manage_access","owner"].includes(action))){
      const scopedProject=state.project.id,scopedEngagement=e.id,sourceGeneration=generation,onBusyChange=value=>{if(state.disposed||generation!==sourceGeneration)return;state.nestedBusy=value;locks();};
      const historyRoot=root.querySelector("[data-successor-history]");if(historyRoot&&e.successor)historyMount=mountAuthenticatedSuccessorHistory(historyRoot,{authority,request:api,onBusyChange});
      const successorRoot=root.querySelector("[data-successor-import]");if(successorRoot)successorMount=mountAuthenticatedSuccessorImport(successorRoot,{authority,getProject:()=>state.project,request:authority.successorRequest,state:state.authenticatedSuccessor,onBusyChange,crypto:view.crypto,onCreated:result=>{authority.assertCurrent();if(state.disposed||generation!==sourceGeneration||state.project.id!==scopedProject||state.engagement.id!==scopedEngagement)throw Error("The successor destination closed.");view.location.assign('/engagements?'+new URLSearchParams({mode:'authenticated',account:authority.accountId,project:authority.projectId,engagement:result.id}));}});
    }
    if(authenticated&&state.tab==="mandate"&&e&&authority.permissions.some(action=>["manage_access","owner"].includes(action))&&typeof authority.invitationRequest==="function"){
      const target=document.createElement('div');target.setAttribute('data-engagement-invitation-mount','');root.querySelector('[data-engagement-panel="mandate"]').append(target);const sourceGeneration=generation,engagementId=e.id;
      invitationMount=mountAuthenticatedEngagementInvitations(target,{authority,getEngagement:()=>state.engagement,cryptoImpl:view.crypto,onChanged:async()=>{authority.assertCurrent();if(state.disposed||generation!==sourceGeneration||state.engagement?.id!==engagementId||!root.contains(target))throw Error("The engagement invitation context closed.");remember();const current=await api(base());if(state.disposed||generation!==sourceGeneration||!root.contains(target))throw Error("The engagement invitation context closed.");accept(current);announce("Invitation access updated. Current assignments and responsibilities are loaded.");render();}});
    }
    if(authenticated&&state.tab==="monitoring"&&e){
      const caseRoot=root.querySelector('[data-authenticated-case-mount]'),caseId=caseRoot?.dataset.caseId,sourceGeneration=generation,engagementId=e.id;
      if(caseRoot&&typeof authority.caseRequest==="function")caseMount=mountAuthenticatedMonitoringCase(caseRoot,{authority,caseId,getEngagement:()=>state.engagement,request:authority.caseRequest,cryptoImpl:view.crypto,onBusyChange:value=>{if(state.disposed||generation!==sourceGeneration)return;state.nestedBusy=value;locks();},refresh:async result=>{const assertCase=()=>{authority.assertCurrent();if(state.disposed||generation!==sourceGeneration||state.engagement?.id!==engagementId||state.monitoring.editing.events!==caseId||!root.contains(caseRoot))throw Error("The selected protected case closed.");};assertCase();remember();const record=result||await api(base()),project=await api(projectBase());assertCase();if(project.id!==authority.projectId||project.accountId&&project.accountId!==authority.accountId)throw Error("The protected case project changed custody.");state.project=project;accept(record);announce("Protected case fields saved with their encrypted revision history. Inspect current case permissions to reopen them.");render();}});
      else if(caseRoot)caseRoot.textContent="Reopen this signed-in assignment to check its current protected field service.";
    }
    pilotMount?.dispose();pilotMount=null;
    const pilotRoot=root.querySelector('[data-assignment-pilot-mount]');
    if(pilotRoot&&e)pilotMount=mountAssignmentPilot(pilotRoot,{
      load:()=>api(`${base()}/pilot-evidence?actorId=${encodeURIComponent(state.actorId)}`),
      save:body=>api(`${base()}/pilot-evidence/measurement`,{method:'POST',body:{...body,actorId:state.actorId}}),
      saveObservation:body=>api(`${base()}/pilot-evidence/task-observation`,{method:'POST',body:{...body,actorId:state.actorId}}),
      verifyHandover:body=>api(`${base()}/pilot-evidence/verify-handover`,{method:'POST',body:{...body,actorId:state.actorId}}),
      getOriginals:()=>state.project.resources.flatMap(resource=>resource.versions.map(version=>({canonicalId:resource.id,versionId:version.id,sha256:version.sha256})))
    });
    const sourceReviewRoot=root.querySelector('[data-source-review-mount]'),sourceReviewKey=`${state.accountId}:${state.project?.id}:${e?.id}:${state.actorId}`;
    if(!sourceReviewDrafts.has(sourceReviewKey))sourceReviewDrafts.set(sourceReviewKey,{});
    if(sourceReviewRoot&&e)sourceReviewRoot.replaceChildren(renderSourceReviewWorkbench({document,draft:sourceReviewDrafts.get(sourceReviewKey),engagement:{...e,sourceVersions:versionRows()},index:state.index,actorId:state.actorId,query:state.passageQuery,retrieval:state.retrieval,selectedVersionId:state.selectedVersion,page:state.page,onSave:async value=>{let saved=false;await run(async()=>{await command(value,{message:"Source search or complete original-page review retained with exact evidence identity."});saved=true;});if(!saved)throw Error(state.message||"The source review could not be saved.");},onOpenPage:async(versionId,page)=>{remember();state.selectedVersion=versionId;state.page=page;await preview(versionId,page);}}));
    if(state.engagement)updateAddress();renderReader();locks();
    state.renderedScope=`${state.accountId}:${state.project?.id||""}:${e?.id||""}:${state.tab}`;
    const open=state.detailStates.get(state.renderedScope)||[];for(const details of root.querySelectorAll("details"))if(open.includes(details.querySelector(":scope > summary")?.textContent))details.open=true;
    if(focus){const form=[...root.querySelectorAll("[data-engagement-form]")].find(item=>item.dataset.engagementForm===focus.form),field=form?.elements.namedItem(focus.name);if(field?.focus&&!field.disabled)field.focus();}
  }
  function updateWizard() {
    const form = root.querySelector('[data-engagement-form="create"]');if (!form) return;
    for (const element of form.querySelectorAll("[data-wizard-step]")) element.hidden = Number(element.dataset.wizardStep) !== state.wizard;
    form.querySelector('[data-engagement-action="wizard-previous"]').hidden = state.wizard === 0;
    form.querySelector('[data-engagement-action="wizard-next"]').hidden = state.wizard === 2;
    form.querySelector('[type="submit"]').hidden = state.wizard !== 2;
  }
  function mountSources() {
    const scopedAccount = state.accountId, scopedProject = state.project.id;
    const relationAttempts=new Map();
    const onBusyChange = value => {if (state.disposed || state.accountId !== scopedAccount || state.project?.id !== scopedProject) return;if(value&&!state.nestedBusy)remember();state.nestedBusy = value;locks();};
    const request = async (...args) => {if (state.disposed || state.accountId !== scopedAccount || state.project?.id !== scopedProject) throw new Error("The source context has closed.");return api(...args);};
    if(authenticated){
      const scopedEngagement=state.engagement.id,sourceGeneration=generation;
      intakeMount=mountAuthenticatedSourceIntake(root.querySelector("[data-source-intake]"),{authority,getEngagement:()=>state.engagement,getProject:()=>state.project,request,state:state.authenticatedIntake,onBusyChange,
        onSaved:result=>{authority.assertCurrent();if(state.disposed||generation!==sourceGeneration||state.accountId!==scopedAccount||state.project?.id!==scopedProject||state.engagement?.id!==scopedEngagement)throw Error("The source context has closed.");
          if(result.project?.id!==scopedProject||result.project.accountId!==authority.accountId||result.engagement?.id!==scopedEngagement)throw Error("The source acknowledgement changed the authenticated scope.");
          state.project=result.project;accept(result.engagement);announce("Original documents added. Review their metadata and index the evidence when ready.");render();}});
    }
    else intakeMount = mountSourceIntake(root.querySelector("[data-source-intake]"),{request,getProject:()=>state.project,getAccountId:()=>state.accountId,state:state.intake,onBusyChange,
      save:sourceCommand,captureBaseUrl:`/engagements?${new URLSearchParams({account:state.accountId,project:state.project.id,engagement:state.engagement.id})}`});
    documentsMount = mountProjectDocuments(root.querySelector("[data-project-documents]"),{request,getProject:()=>state.project,getAccountId:()=>state.accountId,state:state.documents,onBusyChange,
      classificationScope:state.engagement.id,requirementChoices:state.engagement.requirements.map(item=>({id:item.id,label:requirementLabel(item)})),
      readSourcePassage:source=>openSourcePassage(source),
      canReviewDocumentRelation:[...state.engagement.roles.preparer,...state.engagement.roles.reviewer].includes(state.actorId),
      compareDocuments:selection=>request(`${base()}/document-comparisons`,{method:"POST",body:{...selection,expectedRevision:state.engagement.revision,expectedProjectRevision:state.project.revision}}),
      saveDocumentRelation:async command=>{const engagementId=state.engagement.id,key=JSON.stringify(command);if(!relationAttempts.has(key)){if(relationAttempts.size>=64)throw Error("Refresh this register before starting further unacknowledged relationship reviews.");relationAttempts.set(key,view.crypto.randomUUID());}const result=await request(`${base()}/document-relations`,{method:"POST",body:{request_id:relationAttempts.get(key),expectedRevision:state.engagement.revision,expectedProjectRevision:state.project.revision,actorId:state.actorId,command}});if(state.disposed||state.engagement?.id!==engagementId||state.accountId!==scopedAccount||state.project?.id!==scopedProject)throw Error("The document relationship context closed.");if(result.project?.id!==scopedProject)throw Error("The relationship acknowledgment changed the source project.");relationAttempts.delete(key);state.project=result.project;if(result.engagement)accept(result.engagement);},
      saveMetadata:(versionId,metadata)=>sourceCommand({type:"metadata",versionId,metadata}),capture:versionId=>sourceCommand({type:"capture",versionId}),relink:(versionId,path)=>sourceCommand({type:"relink",versionId,path}),
      download:async versionId=>{const version = versionRows().find(item=>item.id===versionId);download(await api(`${projectBase()}/versions/${encodeURIComponent(versionId)}/download`,{method:"POST",binary:true}),safeFilename(version?.filename));}});
  }
  let bibliographyMount;
  function mountBibliography(){
    bibliographyMount?.dispose();
    const account=state.accountId,project=state.project.id,engagement=state.engagement.id;
    bibliographyMount=mountEngagementBibliography(root.querySelector('[data-bibliography-mount]'),{getEngagement:()=>state.engagement,local:!authenticated,
      selectedVersion:new URLSearchParams(address.search).get('libraryVersion')||'',
      assertCurrent:()=>{if(authenticated)authority.assertCurrent();if(state.disposed||state.accountId!==account||state.project?.id!==project||state.engagement?.id!==engagement)throw Error('The engagement bibliography closed.');},
      canEdit:()=>['preparer','reviewer'].some(role=>state.engagement.roles[role]?.includes(state.actorId)),
      onCommand:async value=>{const result=await command(value,{message:'Exact publication edition retained in the working bibliography.'});return result;}});
  }
  function mountExternalReferences(){
    const accountId=state.accountId,projectId=state.project.id,engagementId=state.engagement.id,key=`${accountId}:${projectId}:${engagementId}`;
    if(!externalReferenceStates.has(key))externalReferenceStates.set(key,createExternalReferenceRegisterState());
    const assertCurrent=()=>{if(authenticated)authority.assertCurrent();if(state.disposed||state.accountId!==accountId||state.project?.id!==projectId||state.engagement?.id!==engagementId)throw Error("The external document register closed.");};
    externalReferenceMount=mountExternalReferenceRegister(root.querySelector('[data-external-reference-mount]'),{state:externalReferenceStates.get(key),getEngagement:()=>state.engagement,getProject:()=>state.project,assertCurrent,
      canEdit:()=>authenticated?authority.roles.some(role=>["preparer","reviewer"].includes(role))&&authority.permissions.some(permission=>["edit","owner"].includes(permission)):["preparer","reviewer"].some(role=>state.engagement.roles[role]?.includes(state.actorId)),
      onBusyChange:value=>{if(state.disposed||state.accountId!==accountId||state.project?.id!==projectId||state.engagement?.id!==engagementId)return;if(value)remember();state.nestedBusy=value;locks();},
      onCommand:async value=>{assertCurrent();return command(value,{message:"Reviewed external document register saved."});},onChanged:()=>{assertCurrent();render();}});
  }
  function renderReader() {
    if(readerSelection&&readerSelection.scope!==`${state.accountId}:${state.project?.id}:${state.engagement?.id}`)readerSelection=null;
    root.querySelector('[data-reader-selection-offer]')?.remove();
    if(readerSelection&&state.tab==='evidence'){const form=root.querySelector('[data-engagement-form=evidence]');if(form){const offer=document.createElement('aside');offer.className='ew-record';offer.dataset.readerSelectionOffer='';const title=document.createElement('h3');title.textContent='Selected source passage';const quote=document.createElement('blockquote');quote.textContent=readerSelection.quote;const note=document.createElement('p');note.textContent='Your unfinished citation stays available. Choose whether to use this source passage in its editor.';const use=document.createElement('button');use.type='button';use.dataset.engagementAction='accept-reader-selection';use.textContent='Use selected passage in this citation';const keep=document.createElement('button');keep.type='button';keep.dataset.engagementAction='discard-reader-selection';keep.textContent='Keep the current citation';offer.append(title,quote,note,use,keep);form.before(offer);}}
    const content = root.querySelector("[data-engagement-reader-content]");if (!content) return;
    const status = root.querySelector("[data-reader-status]"), identity = root.querySelector("[data-reader-identity]");
    const version = versionRows().find(item=>item.id===state.selectedVersion);
    identity.textContent = version ? `${version.filename} · version ${version.id} · SHA256 ${version.sha256}` : "Choose the exact version supporting the finding.";
    status.textContent = state.previewBusy ? "Loading exact source page…" : state.previewError || (state.preview?.passage?.status==="matched" ? "Exact source preview ready. Highlighted passage verified against this retained source." : state.preview?.passage?.status==="ambiguous" ? "This quotation occurs more than once. Choose the intended source context." : state.preview ? "Exact source preview ready. Printed page numbering may differ from PDF file pages." : "Open a source page to verify the passage.");
    status.setAttribute("role",state.previewError?"alert":"status");content.replaceChildren();
    const payload = state.preview;if (!payload || payload.versionId !== state.selectedVersion) return;
    if (typeof payload.imageDataUrl === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(payload.imageDataUrl) && payload.imageDataUrl.length <= 12*1024*1024) {const image = document.createElement("img");image.src = payload.imageDataUrl;image.alt = payload.kind==="image"?`Exact retained photograph: ${version?.filename||"source image"}`:`Exact source PDF file page ${state.page}`;content.append(image);}
    if(payload.passage?.status==='ambiguous'){const heading=document.createElement('p');heading.textContent='Choose the cited occurrence; no passage has been selected automatically.';content.append(heading);for(const[index,choice]of payload.passage.choices.entries()){const article=document.createElement('article'),text=document.createElement('pre'),pick=document.createElement('button');text.textContent=choice.text;pick.type='button';pick.dataset.engagementAction='reader-passage-choice';pick.dataset.index=index;pick.textContent=`Read ${choice.page?'PDF file page '+choice.page:'extracted characters '+(choice.range.start+1)+'–'+choice.range.end}`;article.append(text,pick);content.append(article);}if(payload.passage.truncated){const more=document.createElement('p');more.textContent='More matching occurrences exist. Refine the locator or choose the precise source page.';content.append(more);}}
    if (payload.text) {const text = document.createElement("pre");if(payload.passage?.status==='matched'){const{start,end}=payload.passage.match,mark=document.createElement('mark');mark.dataset.readerPassageMatch='';mark.textContent=payload.text.slice(start,end);text.append(document.createTextNode(payload.text.slice(0,start)),mark,document.createTextNode(payload.text.slice(end)));}else text.textContent = String(payload.text).slice(0,120000);content.append(text);}
    if (payload.tables) for (const table of payload.tables.slice(0,5)) {const text = document.createElement("pre");text.textContent = `${table.name || "Table"}\n${(table.rows || []).slice(0,100).map(row=>row.slice(0,40).join("\t")).join("\n")}`;content.append(text);}
    if (!content.childNodes.length) content.textContent = "Preview unavailable. Download the exact original to inspect this passage.";
    if (payload.warnings?.length) {const note = document.createElement("p");note.textContent = payload.warnings.join(" ");content.append(note);}
  }
  async function previewPassage(versionId,anchor){
    const version=versionRows().find(row=>row.id===versionId);if(!version)throw Error('This exact source version is unavailable in the project.');const epoch=++state.readerEpoch,scope=`${state.accountId}:${state.engagement?.id}`;state.selectedVersion=versionId;state.page=anchor.page||1;state.preview=null;state.previewBusy=true;state.previewError='';readerAnchor=structuredClone(anchor);renderReader();
    try{const payload=await api(`${projectBase()}/versions/${encodeURIComponent(versionId)}/passage-preview`,{method:'POST',body:{expectedSha256:version.sha256,anchor}});if(state.disposed||epoch!==state.readerEpoch||scope!==`${state.accountId}:${state.engagement?.id}`)return;const p=payload.passage,valid=choice=>{const r=choice?.range,t=choice?.textRange,m=choice?.match;return r?.basis==='extracted_text_utf16_code_units'&&t?.basis===r.basis&&Number.isSafeInteger(r.start)&&r.start>=0&&Number.isSafeInteger(r.end)&&r.end-r.start===anchor.quote.length&&Number.isSafeInteger(t.start)&&t.start>=0&&Number.isSafeInteger(t.end)&&typeof choice.text==='string'&&choice.text.length<=32000&&t.end-t.start===choice.text.length&&Number.isSafeInteger(m?.start)&&m.start>=0&&Number.isSafeInteger(m.end)&&m.end<=choice.text.length&&m.end-m.start===anchor.quote.length&&t.start+m.start===r.start&&choice.text.slice(m.start,m.end)===anchor.quote&&(choice.page===null||Number.isSafeInteger(choice.page)&&choice.page>0)&&(anchor.page==null||choice.page===anchor.page)&&(!anchor.range||r.start===anchor.range.start&&r.end===anchor.range.end);};
      if(payload.versionId!==versionId||payload.sha256!==version.sha256||p?.format!=='esia-source-passage-preview'||p.schemaVersion!==1||p.quote!==anchor.quote||typeof p.extractorVersion!=='string'||!p.extractorVersion||p.extractorVersion.length>200||anchor.extractorVersion&&p.extractorVersion!==anchor.extractorVersion||p.status==='matched'&&(!valid({...p,text:payload.text})||p.page!==null&&(payload.kind!=='pdf'||payload.pageNumber!==p.page))||p.status==='ambiguous'&&(!Array.isArray(p.choices)||!p.choices.length||p.choices.length>12||p.choices.some(choice=>!valid(choice)))||!['matched','ambiguous'].includes(p.status))throw Error('The source reader returned a different version, quotation or extracted passage range.');state.preview=payload;if(p.status==='matched')state.page=p.page||1;
    }catch(error){if(epoch===state.readerEpoch)state.previewError=error.message;}finally{if(!state.disposed&&epoch===state.readerEpoch){state.previewBusy=false;renderReader();}}
  }
  async function preview(versionId = state.selectedVersion, page = state.page) {
    if (!versionId) throw new Error("Choose an exact source version first.");
    const version = versionRows().find(item=>item.id===versionId);if (!version) throw new Error("This source version is unavailable in the project.");
    if (!Number.isSafeInteger(page) || page < 1) throw new Error("Choose a positive PDF file page.");
    const epoch = ++state.readerEpoch, scope = `${state.accountId}:${state.engagement?.id}`;state.selectedVersion = versionId;state.page = page;state.preview = null;state.previewBusy = true;state.previewError="";renderReader();
    try {const payload = await api(`${projectBase()}/versions/${encodeURIComponent(versionId)}/preview?page=${page}`);
      if (state.disposed || epoch!==state.readerEpoch || scope!==`${state.accountId}:${state.engagement?.id}`) return;
      if (payload.versionId !== versionId || payload.sha256 !== version.sha256 || payload.pageNumber && payload.pageNumber !== page) throw new Error("The preview returned a different source version or PDF file page.");
      state.preview = payload;
    } catch(error) {if (epoch===state.readerEpoch) state.previewError=error.message;}
    finally {if (!state.disposed && epoch===state.readerEpoch) {state.previewBusy=false;renderReader();}}
  }
  const onInput = event => {
    if (event.target.matches('input[name="search"]') && state.tab==="matrix") {remember();state.search=event.target.value;const start=event.target.selectionStart;render();const field=root.querySelector('input[name="search"]');field?.focus();field?.setSelectionRange(start,start);}
  };
  const onChange = event => {
    if(event.target.matches('[name="contradictoryAssertionIds"]')){syncContradictionControls();remember();return;}
    const element=event.target;
    if(element.matches('[name="reviewer"][data-current-reviewer]')){syncActionReviewerFields(element.closest("form"));return;}
    if(authenticated&&["data-engagement-account","data-engagement-project","data-engagement-select","data-engagement-actor"].some(name=>element.hasAttribute(name))){state.actorId=authority.userId;render();announce("This workspace uses the signed-in user and the exact authorized engagement.");return;}
    if(element.hasAttribute("data-issued-report-template")){state.issuedTemplateId=element.value;return;}
    if(element.hasAttribute("data-monitor-program")){remember();clearMonitoringPrivateState(state.monitoring);state.monitoring.programId=element.value;state.monitoring.cycleId="";state.monitoring.editing={};render();return;}
    if(element.hasAttribute("data-monitor-cycle")){remember();clearMonitoringPrivateState(state.monitoring);state.monitoring.cycleId=element.value;state.monitoring.editing={};render();return;}
    if(element.hasAttribute("data-monitor-report-field")){remember();state.monitoring[element.dataset.monitorReportField]=element.value;render();return;}
    if(element.hasAttribute("data-monitor-indicator")){remember();state.monitoring.indicatorId=element.value;render();return;}
    if(element.hasAttribute("data-monitor-target-id")){remember();state.monitoring.verificationTargetId=element.value;for(const key of state.drafts.keys())if(key.includes(":monitor-verification:"))state.drafts.delete(key);render();return;}
    if(element.hasAttribute("data-monitor-target-type")){remember();state.monitoring.targetType=element.value;for(const key of state.drafts.keys())if(key.includes(":monitor-verification:"))state.drafts.delete(key);render();return;}
    if(element.hasAttribute("data-engagement-assessment-cycle")){remember();state.assessmentCycleId=element.value;if(state.assessmentCycleId&&state.queue==="changed")state.queue="all";state.selectedFinding="";state.selectedRequirement=scopedRequirements()[0]?.id||"";render();return;}
    if(element.name==="cycleId"&&element.closest('[data-engagement-form="action"]')){remember();state.assessmentCycleId=element.value;render();return;}
    if(element.name==="assistVersionIds"){state.index=null;state.selectedSourceIds=[...root.querySelectorAll('[name="assistVersionIds"]:checked')].map(item=>item.value);return;}
    if (element.hasAttribute("data-engagement-account")) void run(async()=>{state.accountId=element.value;generation++;resetReviewContext();state.engagement=null;state.project=null;state.engagements=[];state.intake={};state.documents={};state.projects=await api("/api/projects");updateAddress();announce("Account opened. Select a source project. Earlier unsaved entries remain in their original context.");});
    else if (element.hasAttribute("data-engagement-project")) void run(async()=>{if(element.value) await openProject(element.value);else {state.project=null;state.engagement=null;resetReviewContext();updateAddress();}announce("Project engagements opened.");});
    else if (element.hasAttribute("data-engagement-select")) void run(async()=>{if(element.value) accept(await api(`/api/engagements/${encodeURIComponent(element.value)}`));else {state.engagement=null;resetReviewContext();state.wizard=0;updateAddress();}state.preview=null;state.selectedVersion="";announce("Engagement scope selected.");});
    else if (element.hasAttribute("data-engagement-actor")) {remember();clearMonitoringPrivateState(state.monitoring);for(const form of root.querySelectorAll('[data-private-form="true"]'))form.reset();state.actorId=element.value;render();announce(`Acting as ${state.actorId} under the recorded local role.`);}
    else if (element.hasAttribute("data-engagement-queue")) {remember();state.queue=element.value;render();}
    else if (element.hasAttribute("data-engagement-framework")) {remember();state.frameworkId=element.value;state.checkSet="curated";state.checkId="";for(const key of state.drafts.keys())if(key.endsWith(":requirement:"))state.drafts.delete(key);render();}
    else if (element.hasAttribute("data-engagement-checkset")) {remember();state.checkSet=element.value;state.checkId="";for(const key of state.drafts.keys())if(key.endsWith(":requirement:"))state.drafts.delete(key);render();}
    else if (element.hasAttribute("data-engagement-reader-version")) {state.selectedVersion=element.value;state.page=1;state.preview=null;renderReader();}
  };
  function moveRequirement(direction) {
    const buttons=[...root.querySelectorAll("[data-engagement-requirement]")],index=buttons.findIndex(item=>item.dataset.engagementRequirement===state.selectedRequirement),next=buttons[Math.max(0,Math.min(buttons.length-1,index+direction))];
    if(next){remember();state.selectedRequirement=next.dataset.engagementRequirement;state.selectedFinding="";render();root.querySelector(`[data-engagement-requirement="${view.CSS?.escape ? view.CSS.escape(state.selectedRequirement) : state.selectedRequirement}"]`)?.focus();}
  }
  function citationReference(indexId,passageId) {
    const passage=state.index?.passages.find(row=>row.id===passageId),reference={indexId,passageId};
    if(passage?.method==='tesseract-ocr-derivative'){
      const review=[...(state.engagement.sourceReviews||[])].reverse().find(row=>row.mode==='full_page_review'&&row.createdBy===state.actorId&&row.review.versionId===passage.versionId&&row.review.sourceSha256===passage.sha256&&row.review.pages.includes(passage.page));
      if(!review)throw Error('Inspect the complete original PDF page and retain your full-page review in the source activity register before confirming this OCR citation.');
      reference.sourceReviewId=review.id;
    }
    return reference;
  }
  function populateEvidenceForm(item) {
    const form=root.querySelector('[data-engagement-form="evidence"]');if(!form)return;
    for(const [name,value]of Object.entries({versionId:item.versionId,locator:item.locator,quote:item.quote||"",note:item.note||"Review this exact source passage against the requirement.",topics:(item.topics||item.tags||[]).join(", "),classification:"manual",reviewStatus:state.selectedAssertion?"modified":"confirmed",method:item.extraction?.method||item.method||"Human review of extracted passage",model:item.provenance?.model||"",extractionIndexId:item.extractionReference?.indexId||"",extractionPassageId:item.extractionReference?.passageId||""}))form.elements.namedItem(name).value=value;
    const ocr=item.method==='tesseract-ocr-derivative'||item.extraction?.method==='tesseract-ocr-derivative';
    const bound=Boolean(item.extractionReference||item.extraction),status=form.querySelector('[data-citation-extraction-status]');
    status.hidden=!bound;status.textContent=ocr?"OCR derivative: compare every quoted character with the exact original page. Retain a complete original-page review below before saving this derived citation. Correct recognition errors using a manual citation.":bound?`Extraction method: ${item.extraction?.method||item.method||"source extractor"}. Saving a discovered passage verifies the exact original, locator and contiguous excerpt. Earlier extraction bindings remain in revision history.`:"";
    form.querySelector('[data-citation-manual-control]').hidden=!item.extractionReference;
    for(const field of form.querySelectorAll('[name="requirementIds"]'))field.checked=(item.requirementIds||[]).includes(field.value);
  }
  async function openSourcePassage(source) {
    if(!source?.versionId)throw new Error("This suggestion has no direct source passage. Review its unsupported finding before confirmation.");
    state.selectedVersion=source.versionId;const match=/(?:file\s+page|page|p\.)\s*(\d+)/i.exec(source.locator||""),extraction=source.extraction||{},range=extraction.range??source.range,extractorVersion=extraction.extractorVersion??source.extractorVersion,page=Number.isSafeInteger(extraction.page)?extraction.page:Number.isSafeInteger(source.page)?source.page:match?Number(match[1]):null;state.page=page||1;
    if(!["evidence","matrix"].includes(state.tab)||!root.querySelector('[data-engagement-reader-content]')){remember();state.tab="evidence";render();}else{root.querySelector('[data-engagement-reader-version]').value=source.versionId;root.querySelector('[name=readerPage]').value=state.page;renderReader();}if(source.method==='tesseract-ocr-derivative'||source.extraction?.method==='tesseract-ocr-derivative')await preview(source.versionId,state.page);else if(typeof source.quote==='string'&&source.quote.trim())await previewPassage(source.versionId,{quote:source.quote,...(source.locator?{locator:source.locator}:{}),page,...(range?{range:structuredClone(range)}:{}),...(extractorVersion?{extractorVersion}:{})});else await preview(source.versionId,state.page);
  }
  const onClick = event => {
    const monitorControl=event.target.closest("[data-monitor-action]");
    if(monitorControl){
      if(state.busy||state.nestedBusy)return;remember();
      const intent=monitoringAction(monitorControl,{engagement:state.engagement,state:state.monitoring,accountId:state.accountId,authorityMode:authenticated?"authenticated":"local"});if(!intent)return;
      if(intent.comparePhotos){
        const {pointId,photos}=intent.comparePhotos,epoch=state.monitoring.privateEpoch||0,engagementId=state.engagement.id;
        void run(async()=>{if(photos.length<2){state.monitoring.photoComparison={pointId,error:"Link two distinct retained PNG, JPEG or WebP photographs to this point in successive missions before comparing them."};return;}
          const responses=await Promise.allSettled(photos.map(photo=>api(`${projectBase()}/versions/${encodeURIComponent(photo.versionId)}/preview`)));
          if(state.disposed||state.engagement.id!==engagementId||epoch!==(state.monitoring.privateEpoch||0))return;
          const images=[];for(let index=0;index<responses.length;index++){const result=responses[index];if(result.status!=="fulfilled")throw result.reason;const payload=result.value,photo=photos[index];if(payload.versionId!==photo.versionId||payload.sha256!==photo.sha256||typeof payload.imageDataUrl!=="string"||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(payload.imageDataUrl)||payload.imageDataUrl.length>12*1024*1024)throw Error("This exact photograph has no bounded verified preview. Inspect its retained original instead.");images.push({...photo,imageDataUrl:payload.imageDataUrl});}
          state.monitoring.photoComparison={pointId,images};announce("Before and after photographs opened from exact retained originals.");
        });return;
      }
      if(intent.assessmentCycleId!==undefined){state.assessmentCycleId=intent.assessmentCycleId;state.tab="matrix";state.selectedFinding="";state.selectedRequirement=intent.requirementId||scopedRequirements()[0]?.id||"";clearMonitoringPrivateState(state.monitoring);render();return;}
      if(intent.render){render();return;}
      if(intent.navigate){view.location.assign(intent.navigate);return;}
      if(intent.downloadHtml){download(new view.Blob([intent.downloadHtml],{type:"text/html;charset=utf-8"}),intent.filename);announce("Information request exported for deliberate delivery.");return;}
      if(intent.exportPath){void run(async()=>{download(await api(intent.exportPath,{binary:true}),intent.filename);accept(await api(base()));announce("Monitoring output downloaded and retained in the exact issued archive.");});return;}
      return;
    }
    const tab=event.target.closest("[data-engagement-tab]");if(tab){if(state.busy||state.nestedBusy)return;remember();clearMonitoringPrivateState(state.monitoring);state.tab=tab.dataset.engagementTab;render();return;}
    const row=event.target.closest("[data-engagement-requirement]");if(row){remember();state.selectedRequirement=row.dataset.engagementRequirement;state.selectedFinding="";render();return;}
    const control=event.target.closest("[data-engagement-action]");if(!control||control.disabled)return;
    const action=control.dataset.engagementAction,id=control.dataset.id;
    if(action.startsWith("mandate-row-")){
      if(state.busy||state.nestedBusy)return;const form=control.closest("form"),collection=control.dataset.collection;if(!form||!["deliverables","amendments"].includes(collection))return;
      remember();const key=draftKey(form),draft=state.drafts.get(key),rows=draft.__mandateRows[collection],index=rows.findIndex(item=>item.id===id);
      if(action==="mandate-row-add"){if(rows.length>=100){announce("A mandate supports at most 100 rows in this register.",true);return;}rows.push({id:view.crypto.randomUUID(),title:"",description:"",...(collection==="deliverables"?{dueDate:""}:{date:"",sourceVersionId:""})});}
      else if(action==="mandate-row-remove"){if(index<0)return;if(collection==="deliverables"&&linkedObligations(id).length){announce("This deliverable is linked by a contractual obligation or its retained history and cannot be removed.",true);return;}rows.splice(index,1);}
      else {const next=index+(action==="mandate-row-up"?-1:1);if(index<0||next<0||next>=rows.length)return;[rows[index],rows[next]]=[rows[next],rows[index]];}
      render();const wanted=action==="mandate-row-add"?rows.at(-1)?.id:id;const row=[...root.querySelectorAll("[data-mandate-row]")].find(item=>item.dataset.rowId===wanted);row?.querySelector('input:not([type="hidden"]),select')?.focus();return;
    }
    if(action==="edit-mapping"||action==="new-mapping"){remember();state.selectedMapping=action==="edit-mapping"?id:"";if(action==="new-mapping")for(const key of state.drafts.keys())if(key.endsWith(":mapping:"))state.drafts.delete(key);render();return;}
    if(action.startsWith("wizard-")){if(action==="wizard-next"){const active=root.querySelector(`[data-wizard-step="${state.wizard}"]`),invalid=[...active.querySelectorAll("input,textarea,select")].find(field=>!field.checkValidity());if(invalid){invalid.reportValidity();return;}}remember();state.wizard=Math.max(0,Math.min(2,state.wizard+(action==="wizard-next"?1:-1)));updateWizard();return;}
    if(action==="previous-requirement"||action==="next-requirement"){moveRequirement(action==="next-requirement"?1:-1);return;}
    if(action==='reader-passage-choice'){const choice=state.preview?.passage?.choices?.[Number(control.dataset.index)];if(choice&&readerAnchor)void run(()=>previewPassage(state.selectedVersion,{...readerAnchor,page:choice.page,range:choice.range}));return;}
    if(action==='discard-reader-selection'){readerSelection=null;renderReader();announce('Your current citation remains in its editor.');return;}
    if(action==='accept-reader-selection'||action==='quote-selection'){
      if(action==='quote-selection'){const selection=document.getSelection?.(),reader=root.querySelector('[data-engagement-reader-content]');if(!selection?.anchorNode||!selection.focusNode||!reader?.contains(selection.anchorNode)||!reader.contains(selection.focusNode)||!String(selection).trim()){announce('Select text within the exact source reader first.',true);return;}const p=state.preview?.passage;if(p?.status==='ambiguous'){announce('Choose the intended source occurrence before selecting a new citation.',true);return;}remember();const raw=String(selection),quote=raw.trim();let locator=state.preview?.kind==='pdf'?`PDF file page ${state.page}`:'Selected source passage; add the paragraph or section locator';if(p?.status==='matched'){const selected=selection.getRangeAt(0),pre=reader.querySelector('pre');if(!pre?.contains(selected.startContainer)||!pre.contains(selected.endContainer)){announce('Select the passage within the source text.',true);return;}const prefix=document.createRange();prefix.selectNodeContents(pre);prefix.setEnd(selected.startContainer,selected.startOffset);const start=p.textRange.start+prefix.toString().length+raw.indexOf(quote);locator=`${p.page?'PDF file page '+p.page+'; ':''}Extracted source passage, characters ${start+1}–${start+quote.length}`;}readerSelection={scope:`${state.accountId}:${state.project.id}:${state.engagement.id}`,versionId:state.selectedVersion,quote,locator,requirementId:state.tab==='matrix'?state.selectedRequirement:''};if(state.tab==='matrix'){state.selectedAssertion='';state.tab='evidence';render();}const form=root.querySelector('[data-engagement-form=evidence]');if(form?.elements.quote.value.trim()&&form.elements.quote.value!==readerSelection.quote){renderReader();announce('Review the selected passage beside your unfinished citation, then choose which to use.');return;}}
      const form=root.querySelector('[data-engagement-form=evidence]');if(form&&readerSelection){form.elements.versionId.value=readerSelection.versionId;form.elements.quote.value=readerSelection.quote;form.elements.locator.value=readerSelection.locator;form.elements.extractionIndexId.value='';form.elements.extractionPassageId.value='';form.elements.method.value='Manual review of selected exact source text';const status=form.querySelector('[data-citation-extraction-status]');status.hidden=false;status.textContent='Manual citation selected from this exact source. Review the quotation, locator and source context.';form.querySelector('[data-citation-manual-control]').hidden=true;for(const field of form.querySelectorAll('[name=requirementIds]'))if(field.value===readerSelection.requirementId)field.checked=true;readerSelection=null;remember();renderReader();form.elements.note.focus();announce('Selected passage and requirement link are ready for human citation review. Your assessment draft remains in its requirement.');}return;
    }
    if(action==="derive-action"){remember();state.tab="actions";state.selectedAction="";render();const form=root.querySelector('[data-engagement-form="action"]'),finding=state.engagement.findings.find(item=>item.id===id);for(const field of form.querySelectorAll('[name="findingIds"]'))field.checked=field.value===id;form.elements.description.value=finding?.recommendation || finding?.deficiency || "";return;}
    if(action==="monitor-verification"){remember();const e=state.engagement,action=e.actions.find(item=>item.id===id),program=(e.programs||[]).find(program=>(program.baselineActionIds||e.baselines.find(baseline=>baseline.id===program.baselineId)?.actions?.map(action=>action.id)||[]).includes(id)),cycle=e.cycles.find(item=>item.id===action?.cycleId)||e.cycles.find(item=>item.id===state.monitoring.cycleId&&item.programId===program?.id)||e.cycles.filter(item=>item.programId===program?.id).sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd)).at(-1);if(!cycle){announce("Create a reporting cycle in the supervising program before verifying this action.");return;}state.tab="monitoring";state.monitoring.view="verification";state.monitoring.targetType="action";state.monitoring.verificationTargetId=id;state.monitoring.cycleId=cycle.id;state.monitoring.programId=cycle.programId;state.monitoring.editing.verifications="";render();return;}
    if(action==="manual-citation"){const form=root.querySelector('[data-engagement-form="evidence"]');form.elements.extractionIndexId.value="";form.elements.extractionPassageId.value="";form.elements.method.value="Manual source review";form.querySelector('[data-citation-manual-control]').hidden=true;form.querySelector('[data-citation-extraction-status]').textContent="Manual citation: inspect the original and record the precise locator. No new automatic extraction binding is claimed.";remember();announce("Citation changed to manual source review; prior retained bindings remain in history.");return;}
    if(action==="new-assertion"){remember();state.selectedAssertion="";for(const key of state.drafts.keys())if(key.endsWith(":evidence:"))state.drafts.delete(key);render();return;}
    if(action==="edit-obligation"||action==="new-obligation"){remember();state.selectedObligation=action==="edit-obligation"?id:"";if(action==="new-obligation")for(const key of state.drafts.keys())if(key.endsWith(":obligation:"))state.drafts.delete(key);render();return;}
    if(action==="discard-proposal"){remember();const index=Number(control.dataset.index),suggestion=state.assistance?.proposals[index];if(!suggestion)return;state.discardedSuggestions.push({task:state.assistance.task,provenance:suggestion.provenance});state.assistance.proposals=state.assistance.proposals.filter((_,position)=>position!==index);announce("Unsaved suggestion discarded for this session. No assessment finding or retained review decision was changed.");render();return;}
    if(action==="new-action"||action==="edit-action"){remember();state.tab="actions";state.selectedAction=action==="new-action"?"":id;if(action==="new-action"){for(const key of state.drafts.keys())if(key.endsWith(":action:"))state.drafts.delete(key);}render();return;}
    if(action==="edit-assertion"||action==="index-passage"){
      remember();const item=action==="edit-assertion"?state.engagement.assertions.find(item=>item.id===id):indexedPassages()[Number(control.dataset.index)];if(!item)return;
      state.tab="evidence";state.selectedAssertion=action==="edit-assertion"?id:"";state.selectedVersion=item.versionId;render();
      populateEvidenceForm(item);
      if(item.method==='tesseract-ocr-derivative')void run(()=>openSourcePassage(item));
      announce("Review the quotation, locator, topics and requirement links before saving the human citation decision.");return;
    }
    void run(async()=>{
      if(action==="refresh"){accept(await api(base()));state.project=await api(projectBase());announce("Saved engagement refreshed. Unsaved form entries remain available.");}
      else if(action==="policy-source-preview"||action==="policy-source-download"){
        const requirement=selectedRequirement(),sha=control.dataset.sourceSha,frameworkId=control.dataset.frameworkId;
        if(!requirement||requirement.frameworkId!==frameworkId||!requirement.sources?.some(source=>source.sha256===sha))throw new Error("Choose the retained source of the selected requirement.");
        const path=`/api/requirements/${encodeURIComponent(frameworkId)}/sources/${encodeURIComponent(sha)}`;
        if(action==="policy-source-download"){download(await api(`${path}/download`,{method:"POST",binary:true}),`${safeFilename(frameworkId)}-${sha.slice(0,12)}.pdf`);announce("Exact retained policy original downloaded. The policy library remains separate from project-evidence backup.");}
        else {const page=Number(control.dataset.sourcePage||1),payload=await api(`${path}/preview?page=${page}`);if(payload.sha256!==sha||payload.versionId!==`policy:${frameworkId}:${sha}`||payload.pageNumber&&payload.pageNumber!==page)throw new Error("The policy preview does not match the selected source hash and file page.");state.policyPreview={requirementId:requirement.id,page,payload};announce("Retained policy source hash and page verified; inspect its context and qualifications.");}
      }
      else if(action==="preview"){const page=Number(root.querySelector('[name="readerPage"]').value);await preview(root.querySelector("[data-engagement-reader-version]").value,page);}
      else if(action==="field-original"){const item=state.engagement.assertions.find(row=>row.id===id),pin=item?.fieldCapture?.media?.[Number(control.dataset.index)];if(!pin)throw Error("Choose an original attached to this field observation.");await openSourcePassage({versionId:pin.versionId});}
      else if(action==="assertion-source"){await openSourcePassage(state.engagement.assertions.find(item=>item.id===id));}
      else if(action==="proposal-source"){const item=state.assistance?.proposals[Number(control.dataset.index)];await openSourcePassage(candidateSources(item,state.assistance.task||state.assistanceTask)[0]);}
      else if(action==="obligation-source"){const item=state.engagement.obligations.find(item=>item.id===id);await openSourcePassage({versionId:item.sourceVersionId,locator:item.locator});}
      else if(action==="download-original"){const version=versionRows().find(item=>item.id===state.selectedVersion);if(!version)throw new Error("Choose a source version first.");download(await api(`${projectBase()}/versions/${encodeURIComponent(version.id)}/download`,{method:"POST",binary:true}),safeFilename(version.filename));}
      else if(action==="load-library"){const pack=await api(`/api/requirements/${encodeURIComponent(state.frameworkId)}`);registerDetailedRequirementPack(pack);state.checkSet="detailed";state.checkId="";announce("Private source statements loaded. Confirm authoritative wording and applicability before findings.");}
      else if(action==="index"){if(state.selectedSourceIds.length>100)throw new Error("Select at most 100 exact source versions for this bounded batch.");state.index=await api(`${base()}/index`,{method:"POST",body:{retrieval:state.retrieval,...(state.selectedSourceIds.length?{versionIds:state.selectedSourceIds}:{})}});announce(`${state.index.documents.length} exact source versions inspected locally; ${state.index.passages.length} passages available for human review.`);}
      else if(action==="continue-index"){const doc=state.index?.documents.find(row=>row.versionId===control.dataset.versionId),range=doc?.coverage?.continuation;if(!range||!state.index.indexId)throw Error("Inspect the current exact PDF coverage before continuing.");state.index=await api(`${base()}/index`,{method:"POST",body:{retrieval:state.retrieval,versionIds:[doc.versionId],pageRanges:[{versionId:doc.versionId,...range}],continueIndexId:state.index.indexId}});announce("Selected PDF pages extracted and merged. Inspect remaining omissions before relying on a search.");}
      else if(action==="download-coverage"){if(!state.index)throw Error("Inspect source coverage first.");const {passages,matches,...extractionManifest}=state.index,manifest={...extractionManifest,sourceReviews:state.engagement.sourceReviews||[]};download(new view.Blob([JSON.stringify(manifest,null,2)],{type:"application/json"}),"evidence-coverage.json");announce("Exact extraction coverage downloaded. Retained search coverage and original-page review attestations are included; passage text is excluded.");}
      else if(action==="save-proposal"){
        const proposal=state.assistance?.proposals?.[Number(control.dataset.index)];if(!proposal)throw new Error("This AI candidate is unavailable.");
        if((state.assistance.task||state.assistanceTask)==="document_metadata"){
          await sourceCommand({type:"document-classification",command:{type:"suggest",versionId:proposal.versionId,sourceSha256:proposal.sourceSha256,metadata:proposal.metadata,passageIds:proposal.passageIds,...(state.assistance.selection?.indexId?{indexId:state.assistance.selection.indexId}:{}),provenance:proposal.provenance}});
          state.tab="evidence";state.documents.selectedVersionId=proposal.versionId;state.documents.tab="metadata";state.documents.editing??=new Set();state.documents.editing.add(proposal.versionId);state.assistance.proposals=state.assistance.proposals.filter((_,index)=>index!==Number(control.dataset.index));announce("Suggested document classification retained separately from passage assertions. Review the proposed fields against its original, then save an explicit human decision.");return;
        }
        const task=state.assistance.task||state.assistanceTask,type={classify:"assertion-save",obligations:"obligation-save",findings:"finding-save",actions:"action-save",measurements:"measurement-save"}[task];
        const candidate={...proposal,type,...(["findings","actions","measurements"].includes(task)&&state.assessmentCycleId?{cycleId:state.assessmentCycleId}:{})};delete candidate.status;delete candidate.reviewedBy;delete candidate.reviewedAt;
        if(task==="classify"){candidate.reviewStatus="suggested";candidate.classification="ai_suggested";}
        if(task==="obligations")candidate.status="candidate";
        if(task==="measurements")candidate.dataQuality="uncertain";
        if(task==="actions"){candidate.status="open";candidate.closureAttestation="";candidate.closureAssertionIds=[];candidate.closureNote="";}
        await command(candidate,{message:"Unverified AI candidate retained. Human evidence and professional review are still required."});
        if(task==="measurements"){const measurement=state.engagement.measurements.at(-1);state.tab="monitoring";state.monitoring.view="indicators";state.monitoring.editing.measurements=measurement.id;state.monitoring.cycleId=measurement.cycleId;state.monitoring.programId=state.engagement.cycles.find(item=>item.id===measurement.cycleId)?.programId||"";state.monitoring.indicatorId=measurement.indicatorId;}
        if(task==="actions"){state.tab="actions";state.selectedAction=state.engagement.actions.at(-1)?.id||"";}
        if(task==="obligations"){state.tab="mandate";state.selectedObligation=state.engagement.obligations.at(-1)?.id||"";}
        if(task==="classify"){state.tab="evidence";state.selectedAssertion=state.engagement.assertions.at(-1)?.id||"";}
        if(task==="findings"){state.tab="matrix";state.selectedRequirement=candidate.requirementId;state.selectedFinding="";for(const key of state.drafts.keys())if(key.endsWith(`:assessment:${state.assessmentCycleId}:${candidate.requirementId}`))state.drafts.delete(key);}
        state.assistance.proposals=state.assistance.proposals.filter((_,index)=>index!==Number(control.dataset.index));
      }
      else if(action==="add-collection"){const checks=getAuditChecks(state.frameworkId,state.checkSet);if(!checks.length)throw new Error("Load the selected source collection first.");let added=0;for(const item of checks){if(state.engagement.requirements.some(row=>row.frameworkId===state.frameworkId&&row.checkId===item.id))continue;await command({type:"requirement-add",frameworkId:state.frameworkId,checkId:item.id,checkSet:state.checkSet});added++;}announce(`${added} sourced requirements added to the engagement matrix.`);}
      else if(action==="obligation-confirm") await command({type:"obligation-confirm",obligationId:id,statement:"I reviewed the exact agreement passage and confirm this contractual obligation is within the engagement scope."},{message:"Contractual obligation confirmed by the recorded actor."});
      else if(action==="export-baseline"){const format=control.dataset.format,parameters=new URLSearchParams({format});if(!authenticated&&state.issuedTemplateId){const template=getEngagementReportTemplate(state.issuedTemplateId),snapshot=state.engagement.baselines.find(row=>row.id===id);parameters.set('templateId',template.id);parameters.set('templateVersion',template.version);const cycleId=(snapshot?.snapshot||snapshot)?.scope?.cycleId;if(cycleId)parameters.set('cycleId',cycleId);}download(await api(`${base()}/baselines/${encodeURIComponent(id)}/export?${parameters}`,{binary:true}),`${safeFilename(state.engagement.name)}-${safeFilename(id)}${state.issuedTemplateId?'-'+safeFilename(state.issuedTemplateId):''}.${format}`);accept(await api(base()));announce(`${format.toUpperCase()} downloaded and retained as an exact issued rendition of the approved baseline.`);}
      else if(action==="download-issued"){const record=state.engagement.issuedRenditions?.find(item=>item.id===id);if(!record)throw new Error("Choose an issued rendition retained in this engagement.");download(await api(`${base()}/issued/${encodeURIComponent(id)}`,{binary:true}),record.filename);announce("Exact issued bytes reopened from the retained output archive; no report was regenerated.");}
      else if(action==="export-package"){const result=await api(`${base()}/exchange`);download(new view.Blob([JSON.stringify(result,null,2)],{type:"application/json"}),`${safeFilename(state.engagement.name)}-engagement.json`);announce("Portable engagement records exported. Back up original source bytes with the source-project package.");}
      else if(action==="backup-project"){const result=await api(`${projectBase()}/export`);download(new view.Blob([JSON.stringify(result,null,2)],{type:"application/json"}),`${safeFilename(state.project.name)}-project-engagements-originals.json`);announce("Full local project backup exported with engagements and retained originals. Restore it through the local project import workflow.");}
    });
  };
  const onKeydown=event=>{
    if(state.tab!=="matrix"||state.busy||state.nestedBusy||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(["j","k"].includes(event.key.toLowerCase())||event.target.closest("[data-engagement-requirement]")&&["ArrowDown","ArrowUp"].includes(event.key)){event.preventDefault();moveRequirement(event.key.toLowerCase()==="j"||event.key==="ArrowDown"?1:-1);}
    else if(event.key.toLowerCase()==="r"){const field=root.querySelector('[data-engagement-form="finding-review"] [name="statement"]');if(field){event.preventDefault();field.focus();}}
    else if(event.key.toLowerCase()==="e"){event.preventDefault();const finding=selectedFinding(),source=state.engagement.assertions.find(item=>item.id===finding?.supportingAssertionIds?.[0]);void run(()=>openSourcePassage(source));}
  };
  const mandateFrom=(data,form)=>{
    const {deliverables,amendments}=mandateRowsFromForm(form);
    const policy=(data.get("devicePolicyConfigured")||state.engagement?.devicePolicy)?{schemaVersion:1,offlineAllowed:Boolean(data.get("deviceOfflineAllowed")),allowSourceOriginals:Boolean(data.get("deviceAllowOriginals")),allowedSensitivities:data.getAll("deviceSensitivity"),maxOfflineHours:Number(data.get("deviceMaxHours")),autoLockMinutes:Number(data.get("deviceAutoLock")),retentionHours:Number(data.get("deviceRetentionHours"))}:undefined,policyChanged=fieldDevicePolicyDigestInput(policy)!==fieldDevicePolicyDigestInput(state.engagement?.devicePolicy);
    return {name:String(data.get("name")||"").trim(),client:String(data.get("client")||"").trim(),type:data.get("type"),contractingParties:lines(data.get("contractingParties")),scope:data.getAll("scope"),exclusions:String(data.get("exclusions")||""),agreementVersionIds:data.getAll("agreementVersionIds"),amendments,frameworkIds:data.getAll("frameworkIds"),deliverables,
      roles:{preparer:lines(data.get("preparer")),reviewer:lines(data.get("reviewer")),approver:lines(data.get("approver")),client:lines(data.get("clientRole"))},dataRules:String(data.get("dataRules")||""),clientAcceptanceRequired:Boolean(data.get("clientAcceptanceRequired")),...(policyChanged?{devicePolicy:policy}:{})};
  };
  const onSubmit=event=>{
    const form=event.target.closest("form[data-engagement-form]");if(!form)return;event.preventDefault();
    if(["action","consolidate"].includes(form.dataset.engagementForm))syncActionReviewerFields(form);
    const data=new view.FormData(form),name=form.dataset.engagementForm,text=name=>String(data.get(name)||"").trim(),many=name=>data.getAll(name),topics=name=>text(name).split(",").map(item=>item.trim()).filter(Boolean), provenance=()=>({kind:text("provenanceKind")==="ai"||text("classification")==="ai_suggested"?"ai":"human",...(text("model")?{model:text("model")}:{ }),method:text("method")||"Practitioner entry"});
    const submitter=event.submitter;
    void run(async()=>{
      if(name.startsWith("monitor-")){
        const fields=await readMonitoringCommand(form,{engagement:state.engagement,state:state.monitoring,crypto:view.crypto,storage:view.localStorage,indexedDB:view.indexedDB,accountId:state.accountId,formData:data,readOfflineSource:async choice=>{
          const account=state.accountId,project=state.project.id,engagement=state.engagement.id,scopeEpoch=generation;
          const assertScope=()=>{if(state.disposed||state.accountId!==account||state.project?.id!==project||state.engagement?.id!==engagement||generation!==scopeEpoch)throw Error("The mission source context has closed.");};assertScope();
          const path=choice.kind==="policy"?`/api/requirements/${encodeURIComponent(choice.frameworkId)}/sources/${choice.sha256}`:`/api/projects/${encodeURIComponent(project)}/versions/${encodeURIComponent(choice.versionId)}`;
          const original=await api(`${path}/download`,{method:"POST",binary:true});assertScope();let preview;
          try{preview=await api(`${path}/preview?page=${choice.page}`);}catch{preview={text:"A review-page preview was unavailable during preparation. The verified exact original is available for offline download.",warnings:["The original was retained without a prepared preview page."]};}assertScope();
          return {bytes:new Uint8Array(await original.arrayBuffer()),preview};
        }});
        if(fields.local){
          if(fields.attentionAsOf){state.monitoring.asOf=fields.attentionAsOf;state.monitoring.attention=await api(`/api/monitoring/attention?asOf=${encodeURIComponent(fields.attentionAsOf)}`);}
          if(fields.download)download(new view.Blob([JSON.stringify(fields.download,null,2)],{type:"application/json"}),fields.filename);
          state.drafts.delete(draftKey(form));announce(fields.attentionAsOf&&authenticated?"Monitoring attention refreshed from your currently authorized engagements.":fields.message||"Monitoring attention refreshed from current local records.");return;
        }
        const entity=form.dataset.monitorEntity,previousIds=new Set((state.engagement[entity]||[]).map(item=>item.id));await command(fields,{form,message:"Monitoring record saved with its scope, exact evidence links and revision history."});
        if(entity){const created=(state.engagement[entity]||[]).find(item=>!previousIds.has(item.id));if(created){state.monitoring.editing[entity]=created.id;if(entity==="programs")state.monitoring.programId=created.id;if(entity==="cycles")state.monitoring.cycleId=created.id;}}
        return;
      }
      if(name==="create"){const changes=mandateFrom(data,form);if(!changes.roles.preparer.length||!changes.roles.reviewer.length||!changes.roles.approver.length)throw new Error("Record the preparer, technical reviewer and authorized approver.");const result=await api("/api/engagements",{method:"POST",body:{projectId:state.project.id,...changes}});state.drafts.delete(draftKey(form));accept(result);announce("Engagement created with a separate mandate and requirements register.");return;}
      if(name==="register"){await sourceCommand({type:"intake",title:text("title"),path:text("path"),mode:"registered"});state.drafts.delete(draftKey(form));announce("External document registered with exact source identity.");return;}
      if(name==="import"){const file=form.elements.package.files?.[0];if(!file)throw new Error("Choose an engagement exchange package.");const packageValue=JSON.parse(await file.text());await api("/api/engagements/import",{method:"POST",body:packageValue});await openProject(state.project.id);announce("Engagement exchange validated and imported into its owning source project.");return;}
      if(name==="index-reopen"){const indexId=text("indexId");if(!/^index_[a-f0-9]{64}$/.test(indexId))throw Error("Use the exact index reference from a saved coverage manifest.");state.index=await api(`${base()}/index`,{method:"POST",body:{indexId,retrieval:state.retrieval}});state.drafts.delete(draftKey(form));announce("Retained extraction index reopened after exact-original and current-access checks. Continue any remaining page ranges explicitly.");return;}
      if(name==="index-range"){const versionId=text("versionId"),startPage=Number(text("startPage")),endPage=Number(text("endPage")),maxSourceBytes=Number(text("maxSourceMiB")||16)*1024*1024;if(!state.index?.indexId||!Number.isSafeInteger(startPage)||!Number.isSafeInteger(endPage)||startPage<1||endPage<startPage||endPage-startPage>=200)throw Error("Select an exact indexed PDF and a range of 1 to 200 file pages.");state.index=await api(`${base()}/index`,{method:"POST",body:{retrieval:state.retrieval,versionIds:[versionId],pageRanges:[{versionId,startPage,endPage}],maxSourceBytes,continueIndexId:state.index.indexId}});state.drafts.delete(draftKey(form));announce("Selected PDF page range extracted and merged. Inspect coverage and remaining omissions.");return;}
      if(name==="index-ocr"){const versionId=text("versionId"),page=Number(text("page")),maxSourceBytes=Number(text("maxSourceMiB")||16)*1024*1024;if(!state.index?.indexId||!Number.isSafeInteger(page)||page<1)throw Error("Choose an indexed original and its exact PDF file page.");state.index=await api(`${base()}/index`,{method:"POST",body:{retrieval:state.retrieval,versionIds:[versionId],pageRanges:[{versionId,startPage:page,endPage:page}],ocrPages:[{versionId,page}],maxSourceBytes,continueIndexId:state.index.indexId}});state.drafts.delete(draftKey(form));announce("OCR derivative retained. Open the exact original page and retain a full-page review before confirming an OCR citation.");return;}
      if(name==="assist"){state.assistanceTask=text("task");state.assistance=await api(`${base()}/assist`,{method:"POST",body:{task:state.assistanceTask,query:text("query"),retrieval:state.retrieval,...(state.assessmentCycleId?{cycleId:state.assessmentCycleId}:{}),...(state.index?.indexId?{indexId:state.index.indexId}:state.selectedSourceIds.length?{versionIds:state.selectedSourceIds}:{})}});announce(state.assistance.available?`${state.assistance.proposals.length} AI candidates are ready for explicit review.`:state.assistance.reason||"AI assistance is disabled. Manual review and local indexing remain available.");return;}
      if(name==="passage-search"){
        state.passageQuery=text("query");state.retrieval=text("retrieval")||"lexical";
        if(state.index?.indexId){const matches=await api(`${base()}/search`,{method:"POST",body:{indexId:state.index.indexId,query:state.passageQuery,retrieval:state.retrieval,limit:40}});state.index={...state.index,matches,semantic:matches.semantic||state.index.semantic};}
        else state.index=await api(`${base()}/index`,{method:"POST",body:{query:state.passageQuery,retrieval:state.retrieval,...(state.selectedSourceIds.length?{versionIds:state.selectedSourceIds}:{})}});
        announce(`${state.index.documents.length} source versions inspected${authenticated?"":" locally"}; ${indexedPassages().length} relevant passage candidates ready for human review. Reindex retained evidence explicitly if the source collection changes.`);return;
      }
      let value,message;
      if(name==="mandate")value={type:"update-engagement",changes:mandateFrom(data,form)};
      else if(name==="obligation"){value={type:"obligation-save",...(state.selectedObligation?{id:state.selectedObligation}:{}),text:text("text"),sourceVersionId:text("sourceVersionId"),locator:text("locator"),deliverableIds:many("deliverableIds"),status:"candidate",provenance:provenance()};message="Contractual obligation candidate saved for human verification.";}
      else if(name==="requirement"){getAuditContext(text("frameworkId"),text("checkId"),text("checkSet"));value={type:"requirement-add",frameworkId:text("frameworkId"),checkId:text("checkId"),checkSet:text("checkSet")};message="Sourced requirement added to the assessment matrix.";}
      else if(name==="custom-requirement")value={type:"requirement-add",frameworkId:"project",title:text("title"),text:text("text"),sourceVersionId:text("sourceVersionId"),locator:text("locator"),topics:topics("topics")};
      else if(name==="evidence"){value={type:"assertion-save",...(state.selectedAssertion?{id:state.selectedAssertion}:{}),versionId:text("versionId"),locator:text("locator"),quote:text("quote"),note:text("note"),topics:topics("topics"),requirementIds:many("requirementIds"),classification:text("classification"),reviewStatus:text("reviewStatus"),...(text("extractionIndexId")&&text("extractionPassageId")?{extractionReference:citationReference(text("extractionIndexId"),text("extractionPassageId"))}:{}),provenance:provenance()};message="Exact-version passage assertion saved with provenance.";}
      else if(name==="assessment"){value={type:"finding-save",...(selectedFinding()?.id?{id:selectedFinding().id}:{}),requirementId:state.selectedRequirement,...(state.assessmentCycleId?{cycleId:state.assessmentCycleId,priorFindingId:text("priorFindingId"),implementation:text("implementation"),effectiveness:text("effectiveness"),evidenceSufficiency:text("evidenceSufficiency"),residualRisk:text("residualRisk"),riskTrajectory:text("riskTrajectory")}:{ }),applicability:text("applicability"),applicabilityRationale:text("applicabilityRationale"),coverage:text("coverage"),adequacy:text("adequacy"),performance:text("performance"),supportingAssertionIds:many("supportingAssertionIds"),contradictoryAssertionIds:many("contradictoryAssertionIds"),contradictionDispositions:many("contradictoryAssertionIds").map(assertionId=>({assertionId,disposition:text(`contradiction-disposition-${assertionId}`)||"unresolved",rationale:text(`contradiction-rationale-${assertionId}`)})),rationale:text("rationale"),deficiency:text("deficiency"),recommendation:text("recommendation"),uncertainty:text("uncertainty"),riskSignificance:text("riskSignificance"),provenance:provenance()};message="Draft finding saved. Human source review is required before sign-off.";}
      else if(name==="finding-review"){if(!data.get("humanAttestation"))throw new Error("Attest that you reviewed the underlying sources and conclusions.");const duration=text("reviewDurationMinutes"),minutes=Number(duration);if(form.elements.namedItem("reviewDurationMinutes")?.validity.badInput||duration&&(!Number.isFinite(minutes)||minutes<=0||minutes>1440))throw new Error("Enter a review time greater than zero and no more than 1,440 minutes, or leave it blank.");value={type:"finding-review",findingId:selectedFinding()?.id,decision:submitter?.value||"confirmed",statement:text("statement"),...(duration?{reviewDurationMinutes:minutes}:{})};message="Human review decision retained for this finding version.";}

      else if(name==="action")value={type:"action-save",...actionReviewerChange(form),...(state.selectedAction?{id:state.selectedAction}:{}),...(text("cycleId")?{cycleId:text("cycleId")}:{ }),monitoringObligationIds:many("monitoringObligationIds"),findingIds:many("findingIds"),description:text("description"),owner:text("owner"),organization:text("organization"),priority:text("priority"),dueDate:text("dueDate"),trigger:text("trigger"),triggerDetail:text("triggerDetail"),deliverables:lines(text("deliverables")),verificationCriteria:text("verificationCriteria"),dependencies:many("dependencies"),status:text("status"),progress:text("progress"),closureAssertionIds:many("closureAssertionIds"),closureNote:text("closureNote"),closureAttestation:data.get("closureAttestation")?`I verified implementation and the substantive completion test against the cited evidence. ${text("closureNote")}`:"",provenance:{kind:"human",method:"Practitioner action authoring or revision"}};
      else if(name==="attest"||name==="transition"){if(!data.get("attestation"))throw new Error("Record your authority and substantive review attestation.");value=name==="attest"?{type:"attest",kind:text("kind"),statement:text("statement"),...(text("baselineId")?{baselineId:text("baselineId")}:{})}:{type:"transition",status:text("status"),statement:text("statement")};message=name==="attest"?"Separate sign-off recorded.":"Lifecycle decision recorded; approved baselines remain immutable.";}
      else if(name==="consolidate"){if(many("actionIds").length<2)throw new Error("Select at least two compatible actions to consolidate.");value={type:"action-consolidate",actionIds:many("actionIds"),statement:text("statement"),...actionReviewerChange(form)};message="Duplicate actions consolidated with their originating findings and history.";}
      else if(name==="mapping")value={type:"mapping-save",...(state.selectedMapping?{id:state.selectedMapping}:{}),sourceRequirementId:text("sourceRequirementId"),targetRequirementId:text("targetRequirementId"),relation:text("relation"),version:text("version"),rationale:text("rationale")};
      if(!value)throw new Error("Choose a supported engagement operation.");
      const confirmed=name==="mandate"?new Set(state.engagement.obligations.filter(item=>item.status==="confirmed").map(item=>item.id)):null;
      await command(value,{form,message:message||"Engagement record saved."});if(name==="evidence")state.selectedAssertion="";
      if(confirmed){const reset=state.engagement.obligations.filter(item=>confirmed.has(item.id)&&item.status==="candidate").length;if(reset)announce(`Engagement record saved. ${reset} contractual obligation${reset===1?" has":"s have"} returned to candidate review because a linked deliverable changed. Review and confirm the revised client scope.`);}
    });
  };
  const onVisibilityChange=()=>{if(document.hidden){remember();clearMonitoringPrivateState(state.monitoring);for(const form of root.querySelectorAll('[data-private-form="true"]'))form.reset();render();}};
  document.addEventListener("visibilitychange",onVisibilityChange);
  root.addEventListener("click",onClick);root.addEventListener("change",onChange);root.addEventListener("input",onInput);root.addEventListener("submit",onSubmit);root.addEventListener("keydown",onKeydown);
  render();
  const ready=(async()=>{
    state.busy=true;locks();
    try {const results=await Promise.allSettled([api("/api/storage-accounts"),api("/api/projects")]);for(const result of results)if(result.status==="rejected")throw result.reason;if(state.disposed)return;state.accounts=results[0].value.accounts||results[0].value;state.projects=results[1].value.projects||results[1].value;
      const canonical=state.accounts.find(item=>item.id===state.accountId)||(state.accountId==="local-default"?state.accounts[0]:null);if(canonical)state.accountId=canonical.id;
      const requested=authenticated?authority.projectId:address.searchParams.get("project");if(requested&&state.projects.some(item=>item.id===requested))await openProject(requested);
      announce(authenticated?"Signed-in engagement ready. The server checks your identity, assigned responsibilities and source access for each operation.":"Local engagement workspace ready. Sources and assessment records stay on this computer.");
    } catch(error){announce(error.message,true);}finally{if(!state.disposed){state.busy=false;render();}}
  })();
  const dispose=()=>{if(state.disposed)return;reportTemplateMount?.dispose();reportTemplateStates.clear();bibliographyMount?.dispose();clearMonitoringPrivateState(state.monitoring);state.disposed=true;document.removeEventListener("visibilitychange",onVisibilityChange);generation++;state.readerEpoch++;controller.abort();externalReferenceMount?.dispose({retainState:false});for(const externalState of externalReferenceStates.values())clearExternalReferenceRegisterState(externalState);externalReferenceStates.clear();intakeMount?.dispose();successorMount?.dispose();historyMount?.dispose();caseMount?.dispose();invitationMount?.dispose();caseMount=invitationMount=null;clearAuthenticatedSuccessorImportState(state.authenticatedSuccessor);clearAuthenticatedSourceIntakeState(state.authenticatedIntake);documentsMount?.dispose();root.removeEventListener("click",onClick);root.removeEventListener("change",onChange);root.removeEventListener("input",onInput);root.removeEventListener("submit",onSubmit);root.removeEventListener("keydown",onKeydown);};
  invalidation?.then(dispose);
  // Recovery copies contain ordinary unfinished form values only. Credentials,
  // investigative payloads, file bodies and fresh human attestations stay out.
  function exportDraftState(){
    remember();const prefix=`${state.accountId}:${state.project?.id||""}:${state.engagement?.id||""}:`,forms=[];
    const blocked=new Set(["register","import","monitor-private-seal","monitor-private-unlock","monitor-offline-mission"]);
    for(const[key,values]of state.drafts){if(!key.startsWith(prefix))continue;const kind=key.slice(prefix.length).split(":")[0];if(blocked.has(kind))continue;const copy={};
      for(const[name,value]of Object.entries(values)){if(/passphrase|password|token|secret|attestation|classificationReviewed|humanAttestation/i.test(name))continue;if(name==="__mandateRows"||Array.isArray(value)&&value.every(item=>typeof item==="string"))copy[name]=structuredClone(value);}
      forms.push([key,copy]);
    }
    const allowedMetadata=new Set(['title','authors','documentDate','language','description','tags','locations','projectComponents','classificationRequirementIds','classificationReviewStatement',...catalogMetadataFields.map(([name])=>name),...spatialMetadataFields.map(([name])=>'spatial_'+name)]),versions=new Map(versionRows().map(row=>[row.id,row])),documentDrafts=[];
    for(const[versionId,values]of state.documents.drafts||[]){const row=versions.get(versionId);if(!row)continue;const fields={};for(const[name,value]of Object.entries(values)){if(!allowedMetadata.has(name))continue;if(typeof value==='string'||name==='classificationRequirementIds'&&Array.isArray(value)&&value.every(item=>typeof item==='string'))fields[name]=structuredClone(value);}documentDrafts.push({versionId,sha256:row.sha256,fields});}
    return {schemaVersion:1,accountId:state.accountId,projectId:state.project?.id||"",engagementId:state.engagement?.id||"",engagementRevision:state.engagement?.revision||0,headSha256:state.engagement?.serverAuthority?.headSha256||"",tab:state.tab,
      selectedRequirement:state.selectedRequirement,selectedFinding:state.selectedFinding,selectedAction:state.selectedAction,selectedAssertion:state.selectedAssertion,selectedObligation:state.selectedObligation,selectedMapping:state.selectedMapping,assessmentCycleId:state.assessmentCycleId,forms,
      ...(documentDrafts.length?{documents:{tab:state.documents.tab||'metadata',selectedVersionId:versions.has(state.documents.selectedVersionId)?state.documents.selectedVersionId:'',drafts:documentDrafts}}:{})};
  }
  function restoreDraftState(value){
    if(!authenticated||state.disposed)throw Error("Open the exact signed-in engagement before restoring unfinished entries.");authority.assertCurrent();
    if(value.accountId!==state.accountId||value.projectId!==state.project?.id||value.engagementId!==state.engagement?.id||value.engagementRevision!==state.engagement.revision||value.headSha256!==state.engagement.serverAuthority?.headSha256)throw Error("The saved entries refer to another engagement revision. Open them as a reference instead.");
    const prefix=`${state.accountId}:${state.project.id}:${state.engagement.id}:`;for(const[key,fields]of value.forms){if(!key.startsWith(prefix))throw Error("The recovery form belongs to another engagement.");state.drafts.set(key,structuredClone(fields));}
    if(value.documents){const versions=new Map(versionRows().map(row=>[row.id,row]));for(const row of value.documents.drafts)if(versions.get(row.versionId)?.sha256!==row.sha256)throw Error("A source metadata draft refers to another exact original. Read its saved text before editing the current source.");state.documents.drafts=new Map(value.documents.drafts.map(row=>[row.versionId,structuredClone(row.fields)]));state.documents.editing=new Set(value.documents.drafts.map(row=>row.versionId));state.documents.tab=value.documents.tab;state.documents.selectedVersionId=versions.has(value.documents.selectedVersionId)?value.documents.selectedVersionId:value.documents.drafts[0]?.versionId||'';}
    for(const key of ["tab","selectedRequirement","selectedFinding","selectedAction","selectedAssertion","selectedObligation","selectedMapping","assessmentCycleId"])state[key]=value[key]||"";
    render();announce("Unfinished entries restored for your review. Save each form explicitly when ready.");
  }
  return {ready,dispose,exportDraftState,restoreDraftState};
}
