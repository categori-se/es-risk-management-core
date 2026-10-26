import {bibliographyFields,normalizeBibliographyReference} from '../src/lib/engagement-bibliography.js';
import {DatabaseSync} from "node:sqlite";
import {createHash, randomUUID} from "node:crypto";
import {join} from "node:path";
import {lstatSync, mkdirSync} from "node:fs";
import {getFramework, getAuditContext, getAuditChecks,frameworkRegistryVersion} from "../src/lib/framework-register.js";
import {privateStorageDirectory} from "./private-storage-path.mjs";
import {validateAssertionExtraction} from "./engagement-evidence-index.mjs";
import {createIssuedRenditionRepository,validateIssuedRenditions,renditionSelection} from "./engagement-renditions.mjs";
import {assertFieldDeviceLease, fieldDevicePolicyDigestInput} from "../src/lib/field-device-policy.js";
import {normalizeAuthenticatedFieldCaptureBinding,validateAuthenticatedFieldLinks} from "../src/lib/engagement-field-evidence.js";
import {createEngagementOriginArchiveContext,validateEngagementSuccessorOrigin,validateEngagementRecordOrigin,validateEngagementOriginBaseline} from "./engagement-origin-archives.mjs";
import {assertAuthenticatedOfflineLease} from "./engagement-offline-lease.mjs";
import {assignActionReviewer,validateActionReviewer,assertAssignedActionReviewer} from './engagement-action-reviewer.mjs';
import {sourceReviewFields,validateSourceReviewCommand,sourceReviewCommandDigest,validateEngagementSourceReviews} from './engagement-source-review.mjs';
import {externalReferenceFields,externalReferenceLimits,normalizeExternalReferenceFields,externalReferenceStatement,validateExternalReference,retainedExternalReferenceOriginal} from '../src/lib/engagement-external-reference.js';
import {applyMonitoringCommand,monitoringEntityFields,validateMonitoringGraph,redactMonitoringSnapshot} from "./engagement-monitoring.mjs";
import {engagementSnapshotMaxBytes, engagementEntityNames, monitoringEntityNames, monitoringFindingChoices, engagementRoles, engagementStatuses, crosswalkRelations, findingChoices, findingReviewDecisions, isObject,
  uuidPattern, sha256Pattern, stableJson, snapshotDigestInput, assertEngagement as assert, boundedText as text,
  boundedList as list, stringList, exactKeys, enumValue as choice, validDate, normalizeMandate,
  normalizeProvenance, normalizeContradictionDispositions, findingReviewIssues, validateSnapshotEnvelope,monitoringActionBelongsToProgram,actionReviewerFields,engagementOptionalEntityNames} from "../src/lib/engagement-domain.js";
import {normalizeEngagementExecutionAuthority,normalizeEngagementAuthentication,authenticatedEngagementAuthorityLabel} from "../src/lib/engagement-domain.js";

const hash = value => createHash("sha256").update(value).digest("hex");
const clone = value => structuredClone(value);
const instant = () => new Date().toISOString();
const id = value => {assert(typeof value === "string" && uuidPattern.test(value), "Engagement records require stable UUID identifiers."); return value;};
const sourceId = value => text(value, "Source/project identifier", {required: true, max: 192});
const at = value => {assert(typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) && Number.isFinite(Date.parse(value)), "Record timestamp is invalid."); return value;};
const tables = Object.fromEntries(engagementEntityNames.map(name => [name, `engagement_${name}`]));
const mandateFields = ["name", "client", "contractingParties", "type", "scope", "exclusions", "agreementVersionIds", "amendments", "deliverables", "roles", "dataRules", "clientAcceptanceRequired", "frameworkIds", "devicePolicy"];
const recordFields = ["id", "revision", "history", "createdAt", "updatedAt", "createdBy", "updatedBy", "origin"];
const provenanceFields = ["kind", "actorId", "at", "model", "method", "promptHash", "sources"];
const entityFields = {
  requirements: ["frameworkId", "checkId", "checkSet", "authority", "frameworkName", "edition", "standard", "clause", "title", "text", "textKind", "coverageNote", "definition", "catalogDefinition", "topics", "sources", "sourceVersionId", "locator"],
  assertions: ["versionId", "sourceSha256", "locator", "quote", "note", "topics", "requirementIds", "classification", "reviewStatus", "provenance", "extraction", "fieldCapture", "reviewedBy", "reviewedAt"],
  findings: ["requirementId", "applicability", "applicabilityRationale", "coverage", "adequacy", "performance", "supportingAssertionIds", "contradictoryAssertionIds", "contradictionDispositions", "rationale", "deficiency", "recommendation", "uncertainty", "riskSignificance", "provenance", "status", "reviewedBy", "reviewedAt", "reviewStatement", "reviewDecision", "reviewDurationMinutes", "cycleId", "priorFindingId", ...Object.keys(monitoringFindingChoices)],
  actions: ["findingIds", "description", "owner", "organization", "priority", "dueDate", "trigger", "triggerDetail", "deliverables", "verificationCriteria", "dependencies", "status", "progress", "closureAssertionIds", "closureNote", "closureAttestation", "closedBy", "closedAt", "approvalStatus", "provenance", "consolidatedFrom", "supersededBy", "supersededAt", "supersededByActor", "supersededStatement", "cycleId", "monitoringObligationIds",...actionReviewerFields],
  obligations: ["text", "sourceVersionId", "sourceSha256", "locator", "deliverableIds", "status", "provenance", "confirmedBy", "confirmedAt", "confirmationStatement"],
  approvals: ["kind", "actorId", "statement", "at", "contentRevision", "baselineId", "authority", "role", "cycleId"],
  mappings: ["sourceRequirementId", "targetRequirementId", "relation", "rationale", "version", "reviewedBy", "reviewedAt", "reviewStatus"],
  publications: ["baselineId", "formats", "publishedBy", "publishedAt", "statement", "snapshotSha256", "contentRevision", "cycleId"],externalReferences:externalReferenceFields,bibliography:bibliographyFields,sourceReviews:sourceReviewFields, ...monitoringEntityFields
};
function sourceVersions(project) {
  return (project.resources || []).flatMap(resource => (resource.versions || []).map(version => ({id: version.id, resourceId: resource.id,
    title: version.effectiveMetadata?.title || version.intakeMetadata?.title || resource.title, filename: version.filename,
    sha256: version.sha256, size: version.size, mediaType: version.mediaType, availability: version.availability || "unverified"})));
}
const sourceMap = project => new Map(sourceVersions(project).map(version => [version.id, version]));
const catalogContentFields=["frameworkId","checkId","checkSet","authority","frameworkName","edition","standard","clause","title","text","topics","sources","textKind","coverageNote"];
const catalogContent=requirement=>Object.fromEntries(catalogContentFields.map(key=>[key,clone(requirement[key])]));
function pinCatalogDefinition(requirement){
 const definition={format:"esia-catalog-requirement-definition",schemaVersion:1,registryVersion:frameworkRegistryVersion,content:catalogContent(requirement)};
 return {...definition,sha256:hash(stableJson(definition))};
}
function validateCatalogDefinition(requirement){
 const definition=requirement.catalogDefinition;exactKeys(definition,["format","schemaVersion","registryVersion","content","sha256"],"Retained catalogue definition");
 assert(definition.format==="esia-catalog-requirement-definition"&&definition.schemaVersion===1,"Use the retained catalogue definition format.");text(definition.registryVersion,"Retained catalogue version",{required:true,max:200});exactKeys(definition.content,catalogContentFields,"Retained catalogue content");
 const {sha256,...content}=definition;assert(sha256Pattern.test(sha256)&&sha256===hash(stableJson(content)),"Retained catalogue definition failed its SHA256 integrity check.");
 assert(requirement.textKind==="review_prompt"&&stableJson(definition.content)===stableJson(catalogContent(requirement)),"A sourced diagnostic must retain its pinned wording, edition and source references without relabelling it as authoritative requirement text.");
}
const requirementSemantics=requirement=>Object.fromEntries(entityFields.requirements.filter(key=>Object.hasOwn(requirement,key)).map(key=>[key,requirement[key]]));
function approvedCatalogAnchor(view,requirement){
 return (view.baselines||[]).some(snapshot=>snapshot.sha256===hash(snapshotDigestInput(snapshot))&&(snapshot.requirements||[]).some(record=>record.id===requirement.id&&stableJson(requirementSemantics(record))===stableJson(requirementSemantics(requirement))));
}
function matchesCurrentCatalog(requirement){
 try {const framework=getFramework(requirement.frameworkId),context=getAuditContext(requirement.frameworkId,requirement.checkId,requirement.checkSet),check=getAuditChecks(requirement.frameworkId,requirement.checkSet).find(item=>item.id===requirement.checkId);
  return stableJson(catalogContent(requirement))===stableJson({frameworkId:framework.id,checkId:context.checkId,checkSet:context.checkSet,authority:framework.institution,frameworkName:framework.name,edition:framework.edition,standard:check.standard,clause:context.framework.clause,title:check.title||context.framework.clause,text:check.prompt||context.prompt,topics:[context.topic],sources:context.sources,textKind:"review_prompt",coverageNote:context.coverage||"Selected requirement scope; verify the full institutional instrument before concluding coverage."});
 }catch{return false;}
}
function sourceFor(project, versionId) {
  const version = sourceMap(project).get(sourceId(versionId)); assert(version, "A cited original version does not belong to the engagement's source project.", 404); return version;
}
function recordHistory(record, name) {
  exactKeys(record, [...recordFields, ...entityFields[name]], `${name} record`);
  id(record.id); assert(Number.isSafeInteger(record.revision) && record.revision > 0, "Entity revision must be a positive integer.");
  at(record.createdAt); at(record.updatedAt); text(record.createdBy, "Record creator", {required: true, max: 300}); text(record.updatedBy, "Record editor", {required: true, max: 300});
  assert(Array.isArray(record.history) && record.history.length === record.revision - 1, "Record history must contain every previous revision.");
  for (const [index, previous] of record.history.entries()) {
    exactKeys(previous, [...recordFields.filter(key => key !== "history"), ...entityFields[name]], `${name} history`);
    assert(previous.id === record.id && previous.revision === index + 1 && previous.createdAt === record.createdAt && previous.createdBy === record.createdBy, "Entity history is inconsistent.");
    at(previous.updatedAt);
  }
}
function validateProvenance(value) {exactKeys(value, provenanceFields, "Contribution provenance"); normalizeProvenance(value, value.actorId, at(value.at));}
function reviewDurationMinutes(value) {
  assert(typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1440, "Self-reported human review duration must be a finite number greater than 0 and at most 1440 minutes.");
  return value;
}
function references(values, records, label) {
  const ids = stringList(values, label, 500, 192); for (const value of ids) assert(records.some(record => record.id === value), `${label} contains an unknown linked record.`); return ids;
}
function assertRole(engagement, actorId, roles) {
  text(actorId, "Acting local practitioner", {required: true, max: 300});
  assert(roles.some(role => engagement.roles[role]?.includes(actorId)), `This command requires an assigned ${roles.join(" or ")} role.${engagement.executionAuthority ? "" : " Local declared roles are not remote authentication."}`, 403);
}
function validateMandateSources(engagement, project) {
  normalizeMandate(engagement);
  for (const frameworkId of engagement.frameworkIds) assert(getFramework(frameworkId), "Choose known, versioned framework editions.");
  for (const versionId of [...engagement.agreementVersionIds, ...engagement.amendments.map(item => item.sourceVersionId)]) sourceFor(project, versionId);
  for (const name of ["deliverables", "amendments"]) assert(new Set(engagement[name].map(item => item.id)).size === engagement[name].length, `Engagement ${name} identifiers must be unique.`);
}
function validateGraph(view, project, {snapshot = false, checkHistory = true, historicalProgramScopes,historicalCycleScopes,originArchiveContext} = {}) {
  view={...Object.fromEntries([...monitoringEntityNames,...engagementOptionalEntityNames].map(name=>[name,[]])),...view};
  const engagement = snapshot ? view.engagement : view;
  validateEngagementSuccessorOrigin(engagement,project,originArchiveContext,view);
  if (engagement.executionAuthority !== undefined) normalizeEngagementExecutionAuthority(engagement.executionAuthority);
  id(engagement.id); sourceId(engagement.projectId); sourceId(engagement.accountId);
  assert(engagement.projectId === project.id, "Engagement belongs to another source project.");
  assert(Number.isSafeInteger(engagement.revision) && engagement.revision > 0 && Number.isSafeInteger(engagement.contentRevision) && engagement.contentRevision > 0, "Engagement revision is invalid.");
  choice(engagement.status, engagementStatuses, "engagement status"); validateMandateSources(engagement, project);
  let previousMandateRevision = 0;
  for (const entry of list(engagement.mandateHistory, "Mandate amendment history", 500)) {
    exactKeys(entry, ["revision", "at", "actorId", "mandate"], "Historical mandate");at(entry.at);text(entry.actorId, "Mandate editor", {required: true, max: 300});
    assert(Number.isSafeInteger(entry.revision) && entry.revision > previousMandateRevision && entry.revision < engagement.revision, "Mandate revision history is out of order.");previousMandateRevision = entry.revision;validateMandateSources(normalizeMandate(entry.mandate), project);
  }
  const initialMandate = engagement.mandateHistory[0]?.mandate || engagement;
  if (initialMandate.devicePolicy !== undefined) assert(initialMandate.roles.approver.includes(engagement.createdBy), "An initial device policy requires the declared local approver authority.", 403);
  for (const [index, entry] of engagement.mandateHistory.entries()) {
    const next = engagement.mandateHistory[index + 1]?.mandate || engagement;
    if (fieldDevicePolicyDigestInput(entry.mandate.devicePolicy) !== fieldDevicePolicyDigestInput(next.devicePolicy)) assert(entry.mandate.roles.approver.includes(entry.actorId), "A device policy amendment must retain its declared approver authority.", 403);
    assert(entry.mandate.devicePolicy === undefined || next.devicePolicy !== undefined, "Keep configured device policy history; disable offline work explicitly instead of removing its controls.");
  }
  const claimed = new Set([engagement.id]);
  for (const name of engagementEntityNames) {
    assert(Array.isArray(view[name]), `Engagement ${name} must be an explicit bounded array.`);
    for (const record of list(view[name], name, 5000)) {
      recordHistory(record, name); assert(!claimed.has(record.id), "Engagement entity IDs must be unique."); claimed.add(record.id);
      if(name==='events'&&record.restrictedOrigin)assert(record.origin&&engagement.successor,'An archived protected case reference requires its verified successor lineage.');
      validateEngagementRecordOrigin(record,name,engagement,originArchiveContext);
      for(const previous of record.history)assert(stableJson(previous.origin)===stableJson(record.origin),"Retain each candidate's immutable original archive identity through its working revisions.");
    }
  }
  const requirementKeys = new Set();
  assert(view.externalReferences.length<=externalReferenceLimits.records,'Keep the external document register within1,000 records.',413);for(const reference of view.externalReferences)validateExternalReference(reference,{project,view});
  assert(view.bibliography.length<=1000,'Keep the working bibliography within 1,000 references.',413);for(const reference of view.bibliography){normalizeBibliographyReference(Object.fromEntries(bibliographyFields.filter(key=>Object.hasOwn(reference,key)).map(key=>[key,reference[key]])));for(const historical of reference.history||[]){normalizeBibliographyReference(Object.fromEntries(bibliographyFields.filter(key=>Object.hasOwn(historical,key)).map(key=>[key,historical[key]])));assert(['resourceId','resourceVersionId','instrumentId'].every(key=>historical[key]===reference[key]),'Retain each bibliography reference exact parent publication, edition and instrument through every revision.');}}
  for (const requirement of view.requirements) {
    assert(!requirement.catalogDefinition||["curated","workbook"].includes(requirement.checkSet)&&requirement.frameworkId!=="project","Catalogue pins describe sourced diagnostic prompts only; they cannot replace original source definitions.");
    assert(requirement.frameworkId === "project" || engagement.frameworkIds.includes(requirement.frameworkId), "Requirement framework is outside engagement scope.");
    for (const field of ["frameworkId", "checkId", "checkSet", "authority", "frameworkName", "edition", "standard", "clause", "title", "text"]) text(requirement[field], `Requirement ${field}`, {required: true, max: field === "text" ? 30000 : 4000});
    choice(requirement.textKind, ["review_prompt", "source_text", "project_source_text", "group"], "requirement text provenance");text(requirement.coverageNote, "Requirement scope and library coverage", {required: true});
    if (requirement.definition !== undefined) assert(isObject(requirement.definition) && requirement.definition.id === requirement.checkId && requirement.definition.frameworkId === requirement.frameworkId && requirement.definition.edition === requirement.edition && Buffer.byteLength(JSON.stringify(requirement.definition)) <= 512 * 1024, "Retained requirement definition does not match its exact instrument and source.");
    stringList(requirement.topics, "Requirement topics", 100);
    assert(Array.isArray(requirement.sources) && requirement.sources.length, "Retain the requirement's authoritative source references.");
    for (const source of requirement.sources) {
      exactKeys(source, ["title", "url", "locator", "sha256"], "Requirement source"); text(source.title, "Requirement source title", {required: true, max: 4000}); text(source.locator, "Requirement source locator", {max: 4000});
      if (source.url) {let url;try {url = new URL(source.url);} catch {} assert(url && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password, "Requirement source URL must be a stable HTTP(S) reference.");}
      if (source.sha256) assert(sha256Pattern.test(source.sha256), "Requirement source hash is invalid.");
    }
    if (requirement.frameworkId === "project") {const version = sourceFor(project, requirement.sourceVersionId);assert(requirement.sources.some(source => source.sha256 === version.sha256), "Project-specific requirement must identify its exact original source.");}
    else {
      const framework = getFramework(requirement.frameworkId), key = stableJson([requirement.frameworkId, requirement.checkId, requirement.checkSet]);
      assert(!requirementKeys.has(key), "A requirement identity and edition can appear only once in the current register.");requirementKeys.add(key);
      assert(framework && framework.edition === requirement.edition, "Institutional requirement identity must match its authoritative framework edition.");
      if (["curated", "workbook"].includes(requirement.checkSet)) {
        if(requirement.catalogDefinition)validateCatalogDefinition(requirement);
        const retainedSnapshot=snapshot||view.format==="esia-engagement-snapshot";
        if(!retainedSnapshot)assert(requirement.catalogDefinition||!(view.baselines||[]).some(baseline=>baseline.requirements?.some(record=>record.id===requirement.id&&record.catalogDefinition)),"Retain the catalogue definition already pinned by this requirement's approved baseline.");
        const current=matchesCurrentCatalog(requirement);
        assert(requirement.textKind==="review_prompt"&&(retainedSnapshot||approvedCatalogAnchor(view,requirement)||requirement.origin||current),"A sourced starter check must retain its exact approved, archived or current catalogue wording and cited edition; it cannot be relabelled as authoritative requirement wording.");
      } else if (requirement.checkSet === "detailed") {
        assert(framework.institution===requirement.authority&&framework.name===requirement.frameworkName,"Detailed source definitions retain their known institutional identity.");
        const detail = requirement.definition?.detail;
        assert(detail && requirement.textKind === "source_text" && detail.sourceText === requirement.text && detail.context && requirement.sources.some(source => source.sha256 === detail.sourceSha256), "Detailed institutional wording must retain its exact source text, context and original source hash.");
      } else {assert(framework.institution===requirement.authority&&framework.name===requirement.frameworkName,"Grouped source definitions retain their known institutional identity.");assert(requirement.checkSet === "diagnostic" && requirement.textKind === "group" && requirement.definition?.memberIds?.length && Array.isArray(requirement.definition.members), "Grouped diagnostics must retain their explicit source membership without substituting legal equivalence.");}
    }
  }
  for (const assertion of view.assertions) {
    const version = sourceFor(project, assertion.versionId); assert(version.sha256 === assertion.sourceSha256, "An evidence assertion's exact source hash changed.");
    validateAssertionExtraction(assertion.extraction,assertion,{accountId:engagement.accountId,projectId:engagement.projectId,sourceReviews:view.sourceReviews||[]});
    if(assertion.fieldCapture!==undefined){
      const binding=normalizeAuthenticatedFieldCaptureBinding(assertion.fieldCapture);
      assert(engagement.executionAuthority?.mode==="authenticated_user"&&stableJson(binding)===stableJson(assertion.fieldCapture),"Keep authenticated field evidence in its exact original execution authority.");
      assert(binding.manifest.versionId===assertion.versionId&&binding.manifest.sha256===assertion.sourceSha256&&binding.uploadedBy===assertion.createdBy&&binding.receivedAt===assertion.createdAt,"Field evidence must retain its exact original manifest, verified uploader and receipt time.");
      for(const pin of [binding.manifest,...binding.media]){const source=sourceFor(project,pin.versionId);assert(source.resourceId===pin.resourceId&&source.sha256===pin.sha256,"Field evidence media or manifest source identity changed.");}
      validateAuthenticatedFieldLinks(binding.links,{...view,id:engagement.id},{captureId:binding.captureId,historical:true});
      for(const previous of assertion.history)assert(stableJson(previous.fieldCapture)===stableJson(binding),"Field capture provenance is immutable through every citation revision.");
    }else assert(!assertion.history.some(previous=>previous.fieldCapture!==undefined),"Retain field capture provenance already recorded in citation history.");
    text(assertion.locator, "Evidence page or passage locator", {required: true, max: 4000}); text(assertion.quote, "Evidence passage", {max: 30000}); text(assertion.note, "Evidence note");
    stringList(assertion.topics, "Evidence topics", 100); references(assertion.requirementIds, view.requirements, "Evidence requirements");
    choice(assertion.classification, ["manual", "ai_suggested"], "evidence classification"); choice(assertion.reviewStatus, ["suggested", "confirmed", "modified"], "evidence review status"); validateProvenance(assertion.provenance);
    if (assertion.reviewStatus !== "suggested") {assert(engagement.roles.reviewer.includes(assertion.reviewedBy) || engagement.roles.preparer.includes(assertion.reviewedBy), "Evidence metadata confirmation needs an assigned human preparer or reviewer.");at(assertion.reviewedAt);}
  }
  const findingRequirements = new Set();
  for (const finding of view.findings) {
    const findingKey=stableJson([finding.requirementId,finding.cycleId||null]);references([finding.requirementId], view.requirements, "Finding requirement"); assert(!findingRequirements.has(findingKey), "Keep one current, versioned finding per requirement and monitoring cycle."); findingRequirements.add(findingKey);
    if(finding.cycleId){references([finding.cycleId],view.cycles,"Finding monitoring cycle");for(const [field,values]of Object.entries(monitoringFindingChoices))choice(finding[field],values,`monitoring ${field}`);}
    for (const [field, values] of Object.entries(findingChoices)) choice(finding[field], values, `finding ${field}`);
    for (const field of ["applicabilityRationale", "rationale", "deficiency", "recommendation", "uncertainty", "riskSignificance"]) text(finding[field], `Finding ${field}`);
    references(finding.supportingAssertionIds, view.assertions, "Supporting assertions"); references(finding.contradictoryAssertionIds, view.assertions, "Contradictory assertions");
    if (finding.contradictionDispositions !== undefined) normalizeContradictionDispositions(finding.contradictionDispositions, finding.contradictoryAssertionIds);
    assert(!finding.supportingAssertionIds.some(value => finding.contradictoryAssertionIds.includes(value)), "An assertion cannot both support and contradict one finding.");
    validateProvenance(finding.provenance); choice(finding.status, ["draft", "verified"], "finding review status");
    if (finding.reviewDecision !== undefined) {
      choice(finding.reviewDecision, findingReviewDecisions, "human review decision");assert(engagement.roles.reviewer.includes(finding.reviewedBy), "Finding review decisions require an assigned human reviewer.");at(finding.reviewedAt);text(finding.reviewStatement, "Substantive human review decision", {required: true});
      if (finding.reviewDecision === "rejected") assert(finding.status === "draft", "A rejected finding remains a blocking draft until human correction or reconfirmation.");
    }
    if (Object.hasOwn(finding, "reviewDurationMinutes")) {reviewDurationMinutes(finding.reviewDurationMinutes);assert(finding.reviewDecision !== undefined, "Self-reported review duration belongs to a substantive human finding-review decision.");}
    if (finding.status === "verified") {
      assert(engagement.roles.reviewer.includes(finding.reviewedBy), "Finding verification needs an assigned human reviewer."); at(finding.reviewedAt); text(finding.reviewStatement, "Reviewer substantive attestation", {required: true});
      if (checkHistory) assert(!findingReviewIssues(finding, view).length, findingReviewIssues(finding, view).join(" "));
    }
  }
  for (const action of view.actions) {
    validateActionReviewer(action,{...view,...engagement});
    if(action.cycleId)references([action.cycleId],view.cycles,"Action monitoring cycle");if(action.monitoringObligationIds)references(action.monitoringObligationIds,view.monitoringObligations,"Action monitoring commitments");
    validateProvenance(action.provenance);
    assert(references(action.findingIds, view.findings, "Action findings").length, "An action must address at least one finding.");
    for (const field of ["description", "owner", "organization", "verificationCriteria"]) text(action[field], `Action ${field}`, {required: true});
    choice(action.priority, ["critical", "high", "medium", "low"], "action priority");choice(action.trigger, ["date", "pre_commitment", "pre_disbursement", "pre_construction", "ongoing", "other"], "action obligation trigger");
    validDate(action.dueDate, "Action due date", {optional: action.trigger !== "date"}); if (action.trigger !== "date") text(action.triggerDetail, "Action milestone / obligation trigger", {required: true});
    stringList(action.deliverables, "Action deliverables", 100); references(action.dependencies, view.actions, "Action dependencies"); assert(!action.dependencies.includes(action.id), "An action cannot depend on itself.");
    choice(action.status, ["open", "in_progress", "closed", "superseded"], "action status"); choice(action.approvalStatus, ["draft", "approved"], "action plan approval status"); references(action.closureAssertionIds, view.assertions, "Action closure assertions");
    if (action.consolidatedFrom) assert(references(action.consolidatedFrom, view.actions, "Consolidated original actions").length >= 2 && !action.consolidatedFrom.includes(action.id), "A consolidation must retain at least two separate originating actions.");
    if (action.status === "superseded") {
      const replacement = view.actions.find(item => item.id === action.supersededBy);assert(replacement && replacement.consolidatedFrom?.includes(action.id), "A superseded action must retain its exact consolidation replacement.");
      at(action.supersededAt);assert(engagement.roles.preparer.includes(action.supersededByActor) || engagement.roles.reviewer.includes(action.supersededByActor), "Consolidation requires an assigned practitioner.");text(action.supersededStatement, "Action consolidation decision", {required: true});
    }
    if (action.status === "closed") {
      assert(action.closureAssertionIds.length && (!checkHistory || action.closureAssertionIds.every(value => ["confirmed", "modified"].includes(view.assertions.find(record => record.id === value)?.reviewStatus))), "Action closure requires human-confirmed exact-source evidence.");
      assert(action.reviewer||engagement.roles.reviewer.includes(action.closedBy), "Closing an action requires an assigned human reviewer."); at(action.closedAt); text(action.closureNote, "Closure verification", {required: true}); text(action.closureAttestation, "Substantive human closure attestation", {required: true});
      if (checkHistory) assert(action.dependencies.every(value => view.actions.find(record => record.id === value)?.status === "closed"), "Close action dependencies before closing this action.");
    }
  }
  const visit = (action, stack = new Set()) => {assert(!stack.has(action.id), "Action dependencies cannot contain a cycle.");const next = new Set([...stack, action.id]);for (const dependency of action.dependencies) visit(view.actions.find(item => item.id === dependency), next);};
  for (const action of view.actions) visit(action);
  for (const obligation of view.obligations) {
    const version = sourceFor(project, obligation.sourceVersionId); assert(version.sha256 === obligation.sourceSha256, "Contractual obligation source hash changed.");
    text(obligation.text, "Contractual obligation", {required: true}); text(obligation.locator, "Agreement / ToR passage locator", {required: true});
    stringList(obligation.deliverableIds, "Obligation deliverables", 100).forEach(value => assert(engagement.deliverables.some(item => item.id === value), "A contractual obligation refers to an unknown deliverable."));
    choice(obligation.status, ["candidate", "confirmed"], "contractual obligation review status"); validateProvenance(obligation.provenance);
    if (obligation.status === "confirmed") {assert(engagement.roles.preparer.includes(obligation.confirmedBy) || engagement.roles.reviewer.includes(obligation.confirmedBy), "A person assigned to scope review must confirm contractual obligations.");at(obligation.confirmedAt);text(obligation.confirmationStatement, "Contractual obligation verification", {required: true});}
  }
  for (const approval of view.approvals) {
    if (engagement.executionAuthority) assert(approval.authority === authenticatedEngagementAuthorityLabel, "Authenticated attestations must retain their verified User authority description.");
    else assert(approval.authority !== authenticatedEngagementAuthorityLabel, "Local attestations cannot be relabelled as authenticated User authority.");
    if(approval.cycleId)references([approval.cycleId],view.cycles,"Approval monitoring cycle");
    choice(approval.kind, ["assessor", "technical", "authorization", "client_acceptance"], "approval kind"); at(approval.at); text(approval.statement, "Approval statement", {required: true});
    const role = {assessor: "preparer", technical: "reviewer", authorization: "approver", client_acceptance: "client"}[approval.kind];
    assert(approval.role === role && engagement.roles[role].includes(approval.actorId), "An approval is outside its declared authority.");
    assert(Number.isSafeInteger(approval.contentRevision) && approval.contentRevision > 0 && approval.contentRevision <= engagement.contentRevision, "An approval refers to an invalid content revision.");
    if (approval.baselineId) id(approval.baselineId);
  }
  for (const mapping of view.mappings) {
    references([mapping.sourceRequirementId, mapping.targetRequirementId], view.requirements, "Cross-framework mapping requirements"); assert(mapping.sourceRequirementId !== mapping.targetRequirementId, "Map separate requirements.");
    choice(mapping.relation, crosswalkRelations, "crosswalk relation"); text(mapping.rationale, "Crosswalk rationale", {required: true});text(mapping.version, "Mapping version", {required: true, max: 100});
    if(mapping.reviewStatus==="draft"){assert(mapping.origin&&mapping.reviewedBy===undefined&&mapping.reviewedAt===undefined,"Imported mapping candidates require fresh human review without inherited reviewer identity.");continue;}
    assert(mapping.reviewStatus===undefined||mapping.reviewStatus==="reviewed","Mapping review state is invalid.");
    const reviewEvent=(view.audit||[]).filter(event=>event.command==="mapping-save"&&event.changedIds?.includes(mapping.id))[mapping.revision-1-(mapping.origin?1:0)];
    const authority=reviewEvent?(engagement.mandateHistory||[]).find(entry=>entry.revision>=reviewEvent.revision)?.mandate||engagement:engagement;
    assert(authority.roles.reviewer.includes(mapping.reviewedBy)&&(!reviewEvent||reviewEvent.actorId===mapping.reviewedBy),"A requirement mapping must retain the reviewer assigned when that revision was recorded.");at(mapping.reviewedAt);
  }
  for (const publication of view.publications) {
    id(publication.baselineId);assert(sha256Pattern.test(publication.snapshotSha256), "Publication must identify its immutable source snapshot hash.");
    const formats = stringList(publication.formats, "Publication representations", 10, 20);assert(formats.length && formats.every(format => ["pdf", "html", "docx", "xlsx", "csv", "json"].includes(format)), "Choose supported publication representations.");
    assert(engagement.roles.approver.includes(publication.publishedBy), "Publication requires a declared approver.");at(publication.publishedAt);text(publication.statement, "Publication attestation", {required: true});
    assert(Number.isSafeInteger(publication.contentRevision) && publication.contentRevision > 0 && publication.contentRevision <= engagement.contentRevision, "Publication must retain its exact assessed content revision.");
  }
  validateEngagementSourceReviews({...view,...engagement},project);
  validateMonitoringGraph({...view,...engagement},project,{historical:!checkHistory,historicalProgramScopes,historicalCycleScopes});
  for(const program of view.programs||[])if(program.originBaselineRef)validateEngagementOriginBaseline(program,engagement,view,originArchiveContext);
  const pastAndPresent = name => view[name].flatMap(record => [...record.history, record]);
  const usedVersions = new Set([...engagement.agreementVersionIds, ...engagement.amendments.map(item => item.sourceVersionId), ...pastAndPresent("requirements").map(item => item.sourceVersionId).filter(Boolean), ...pastAndPresent("assertions").map(item => item.versionId), ...pastAndPresent("obligations").map(item => item.sourceVersionId),...pastAndPresent("monitoringObligations").map(item=>item.sourceVersionId),...pastAndPresent("submissions").flatMap(item=>item.versionIds),...pastAndPresent("missions").flatMap(item=>item.captureVersionIds),...[...pastAndPresent("indicators"),...pastAndPresent("measurements")].map(item=>item.threshold?.sourceVersionId).filter(Boolean)]);
  for(const mapping of engagement.successor?.sourceMappings||[])usedVersions.add(mapping.destinationVersionId);
  for(const assertion of pastAndPresent("assertions"))if(assertion.fieldCapture)for(const pin of [assertion.fieldCapture.manifest,...assertion.fieldCapture.media])usedVersions.add(pin.versionId);
  for(const event of pastAndPresent('events'))for(const binding of event.restricted?.sourceBindings||event.restrictedProtection?.sourceBindings||[])usedVersions.add(binding.versionId);
  for(const reference of pastAndPresent('externalReferences'))if(reference.linkedOriginal)usedVersions.add(reference.linkedOriginal.versionId);
  for(const review of pastAndPresent('sourceReviews'))for(const source of review.search?.sources||[review.review])if(source)usedVersions.add(source.versionId);
  // Preserve each program/cycle's retained scope while replaying one entity at
  // a time beside newer cycles/findings. An earlier scope revision must not
  // undo a valid amendment. The current graph above stays strict.
  const retainedProgramScopes=checkHistory?new Map(view.programs.map(program=>[program.id,[...new Set([...program.history,program].flatMap(item=>item.requirementIds))]])):historicalProgramScopes;
  const retainedCycleScopes=checkHistory?new Map(view.cycles.map(cycle=>[cycle.id,[...new Set([...cycle.history,cycle].flatMap(item=>item.requirementIds))]])):historicalCycleScopes;
  if (checkHistory) for (const name of engagementEntityNames) for (const record of view[name]) for (const [index, previous] of record.history.entries()) {
    const historical = {...previous, history: record.history.slice(0, index)};
    validateGraph({...view, ...(snapshot ? engagement : {}), [name]: view[name].map(item => item.id === record.id ? historical : item)}, project, {checkHistory: false,historicalProgramScopes:retainedProgramScopes,historicalCycleScopes:retainedCycleScopes,originArchiveContext});
  }
  if (snapshot) {
    assert(view.sourceVersions.length === usedVersions.size, "Snapshot source manifest must exactly cover its linked sources.");
    for (const version of view.sourceVersions) {const expected = sourceFor(project, version.id);assert(usedVersions.has(version.id) && expected.sha256 === version.sha256 && expected.size === version.size && expected.mediaType === version.mediaType, "Snapshot source identity or hash differs from the original source project.");}
  }
  return usedVersions;
}

function validateAudit(audit, engagement, records, project) {
  assert(Array.isArray(audit) && audit.length > 0 && audit.length <= 10000, "Engagement audit history must be retained and bounded.");
  let previous;
  for (const [index, entry] of audit.entries()) {
    exactKeys(entry, ["id", "engagementId", "sequence", "revision", "contentRevision", "actorId", "command", "at", "changedIds", "previousSha256", "review", "authentication", "assignment", "sourceRegistration"], "Audit entry");id(entry.id);at(entry.at);
    if (engagement.executionAuthority) {
      const verified = normalizeEngagementAuthentication(entry.authentication, entry.actorId);
      assert(verified.issuer === engagement.executionAuthority.issuer, "An authenticated audit must retain its engagement's exact verified issuer.");
    } else assert(entry.authentication === undefined, "Local history cannot be relabelled as authenticated User history.");
    if (entry.assignment !== undefined) {
      exactKeys(entry.assignment, ["role", "userId"], "Accepted professional assignment");choice(entry.assignment.role, engagementRoles, "accepted professional role");
      assert(engagement.executionAuthority && entry.command === "accept-role-assignment" && entry.assignment.userId === entry.actorId && entry.changedIds?.includes(engagement.id), "Accepted assignments require the verified recipient's own exact audit.");
      const retained = engagement.mandateHistory.find(item => item.revision === entry.revision - 1), next = engagement.mandateHistory.find(item => item.revision >= entry.revision)?.mandate || engagement;
      assert(retained?.actorId === entry.actorId && !retained.mandate.roles[entry.assignment.role].includes(entry.actorId) && next.roles[entry.assignment.role].includes(entry.actorId), "An accepted assignment must append its recipient to the retained mandate history.");
    } else assert(entry.command !== "accept-role-assignment", "Keep the exact accepted professional assignment in its audit.");
    if (entry.sourceRegistration !== undefined) {
      assert(engagement.executionAuthority && entry.command === "register-sources" && entry.changedIds?.includes(engagement.id) && Array.isArray(entry.sourceRegistration) && entry.sourceRegistration.length > 0 && entry.sourceRegistration.length <= 10, "Retain the verified source registration in its exact authenticated audit.");
      const seen = new Set();
      for (const source of entry.sourceRegistration) {exactKeys(source,["versionId","sha256"],"Audited source registration");sourceId(source.versionId);assert(sha256Pattern.test(source.sha256) && !seen.has(source.versionId),"Source registration must retain unique exact version hashes.");if(project)assert(sourceFor(project,source.versionId).sha256===source.sha256,"The audited registration differs from its exact retained original.",409);seen.add(source.versionId);}
    } else assert(entry.command !== "register-sources", "Keep the exact source registration in its audit.");
    assert(entry.engagementId === engagement.id && entry.sequence === index + 1 && entry.revision === index + 1 && entry.revision <= engagement.revision, "Engagement audit sequence is invalid.");
    assert(Number.isSafeInteger(entry.contentRevision) && entry.contentRevision > 0 && entry.contentRevision <= engagement.contentRevision && (!previous || entry.contentRevision >= previous.contentRevision), "Audit content revision is invalid.");
    text(entry.actorId, "Audit actor", {required: true, max: 300});text(entry.command, "Audit command", {required: true, max: 200});
    const changedIds = stringList(entry.changedIds, "Audited changed records", 5000, 192);changedIds.forEach(id);
    if (records) assert(changedIds.every(value => value === engagement.id || engagementEntityNames.some(name => records[name]?.some(record => record.id === value))), "Audit history refers to a missing linked record.");
    if (entry.review) {
      exactKeys(entry.review, ["findingId", "findingRevision", "decision", "statement"], "Audited human finding decision");id(entry.review.findingId);choice(entry.review.decision, findingReviewDecisions, "audited human review decision");text(entry.review.statement, "Audited review statement", {required: true});
      assert(entry.command === "finding-review" && changedIds.includes(entry.review.findingId) && Number.isSafeInteger(entry.review.findingRevision) && entry.review.findingRevision > 0, "Audit review must identify its exact changed finding revision.");
      if (records) {const finding = records.findings.find(record => record.id === entry.review.findingId), reviewed = [...(finding?.history || []), finding].find(record => record?.revision === entry.review.findingRevision);assert(reviewed && reviewed.reviewDecision === entry.review.decision && reviewed.reviewStatement === entry.review.statement && reviewed.reviewedBy === entry.actorId, "Audited review does not match its retained human finding decision.");}
    }
    assert(entry.previousSha256 === (previous ? hash(stableJson(previous)) : null), "Engagement audit chain failed its integrity check.");previous = entry;
  }
  assert(audit.at(-1).revision === engagement.revision, "Engagement audit does not cover the current revision.");
  if (records) for (const finding of records.findings) for (const state of [...finding.history, finding]) if (Object.hasOwn(state, "reviewDurationMinutes")) {
    const event = audit.find(entry => entry.review?.findingId === finding.id && entry.review.findingRevision === state.revision);
    assert(event?.command === "finding-review" && event.actorId === state.reviewedBy && state.updatedBy === state.reviewedBy, "Self-reported review duration must retain its exact human finding-review audit event.");
  }
  if (engagement.executionAuthority) assert(audit[0].actorId === engagement.createdBy && audit.at(-1).actorId === engagement.updatedBy, "Verified engagement creator/editor must match their retained audit identities.");
  if(records)for(const record of records.sourceReviews||[]){const event=audit.find(entry=>entry.command==='source-review-save'&&entry.changedIds.includes(record.id));assert(event&&event.actorId===record.createdBy&&record.createdBy===record.updatedBy&&Date.parse(event.at)>=Date.parse(record.createdAt),'Retained source review needs its exact actual practitioner command and audit event.');}
}

/** Pure preflight for a source-package restore: no database, account creation,
 * original-byte reads or writes. The source-package validator verifies bytes. */
export function validateEngagementPackages(project, packages, {accountId,originArchives,originArchiveContext=createEngagementOriginArchiveContext(originArchives)} = {}) {
  sourceId(accountId);
  assert(Array.isArray(packages) && packages.length <= 100, "Engagement exchange packages must be a bounded array.");
  assert(Buffer.byteLength(JSON.stringify(packages)) <= 32 * 1024 * 1024, "Engagement records exceed their 32 MiB exchange limit.", 413);
  const claimed = new Set(), globalIds = new Set();
  const claim = value => {id(value);assert(!globalIds.has(value), "Different engagement records cannot reuse the same UUID.");globalIds.add(value);};
  for (const pack of packages) {
    exactKeys(pack, ["format", "schemaVersion", "engagement", "entities", "baselines", "audit", "issuedRenditions"], "Engagement exchange package");
    assert(pack.format === "esia-engagement-package" && pack.schemaVersion === 1, "Unsupported engagement exchange schema.");
    const core = pack.engagement;exactKeys(core, ["id", "projectId", "accountId", "revision", "contentRevision", "status", "createdAt", "updatedAt", "createdBy", "updatedBy", "workingBaselineId", "latestBaselineId", "mandateHistory", "executionAuthority", "successor", ...mandateFields], "Engagement mandate");
    assert(core.accountId === accountId && core.projectId === project.id && !claimed.has(core.id), "Engagement exchange custody or identity differs from its source project."); claimed.add(core.id);at(core.createdAt);at(core.updatedAt);
    exactKeys(pack.entities, engagementEntityNames, "Linked engagement entities");for (const name of engagementEntityNames) assert(Array.isArray(pack.entities[name])||[...monitoringEntityNames,...engagementOptionalEntityNames].includes(name)&&pack.entities[name]===undefined, `Exchange package is missing ${name}.`);
    assert(Array.isArray(pack.audit), "Engagement audit must be an explicit bounded array.");claim(core.id);for (const name of engagementEntityNames) for (const entity of pack.entities[name]||[]) claim(entity.id);for (const event of pack.audit) claim(event.id);
    const baselineIds = new Set();let prior = null;
    for (const snapshot of list(pack.baselines, "Approved baselines", 100)) {
      exactKeys(snapshot, ["format", "schemaVersion", "id", "sha256", "createdAt", "previousBaselineId", "engagement", ...engagementEntityNames, "sourceVersions", "audit", "scope"], "Approved snapshot");claim(snapshot.id);
      validateSnapshotEnvelope(snapshot); assert(!baselineIds.has(snapshot.id) && snapshot.engagement.id === core.id && snapshot.engagement.accountId === accountId && snapshot.previousBaselineId === prior, "Approved baseline sequence is invalid.");
      assert(stableJson(snapshot.engagement.executionAuthority) === stableJson(core.executionAuthority), "Keep the original execution authority of every approved baseline.");
      assert(Buffer.byteLength(JSON.stringify(snapshot)) <= engagementSnapshotMaxBytes, "An immutable approved snapshot exceeds the 8 MiB bounded export limit.", 413);
      assert(snapshot.sha256 === hash(snapshotDigestInput(snapshot)), "Approved baseline failed its SHA256 integrity check.");
      validateGraph(snapshot, project, {snapshot: true,originArchiveContext}); validateAudit(snapshot.audit, snapshot.engagement, snapshot, project);
      const cycle=snapshot.scope?.kind==="monitoring_cycle"?snapshot.cycles?.find(item=>item.id===snapshot.scope.cycleId):null;
      if(snapshot.scope)assert(cycle&&cycle.programId===snapshot.scope.programId&&cycle.status==="approved"&&snapshot.scope.findingIds.every(value=>snapshot.findings.some(item=>item.id===value&&item.cycleId===cycle.id&&item.status==="verified")),"Approved monitoring scope must identify its verified exact reporting cycle.");
      for (const kind of ["assessor", "technical", "authorization"]) assert(snapshot.approvals.some(approval => approval.kind === kind && approval.contentRevision === (cycle?.contentRevision||snapshot.engagement.contentRevision) && (cycle?approval.cycleId===cycle.id:!approval.cycleId) && (kind !== "authorization" || approval.baselineId === snapshot.id)), "Approved baseline is missing a substantive role attestation for that exact version.");
      assert((cycle?.requirementIds||snapshot.requirements.map(item=>item.id)).every(requirementId => snapshot.findings.some(finding => finding.requirementId === requirementId && (cycle?finding.cycleId===cycle.id:!finding.cycleId) && finding.status === "verified")), "Approved baseline contains unverified requirements.");
      baselineIds.add(snapshot.id);prior = snapshot.id;
    }
    // Authenticate the retained hash/source/review graph before using an exact
    // approved requirement as the authority for an older catalogue definition.
    validateGraph({...core,...pack.entities,baselines:pack.baselines,audit:pack.audit},project,{originArchiveContext});validateAudit(pack.audit,core,pack.entities,project);
    assert((core.latestBaselineId || null) === prior && (!core.workingBaselineId || baselineIds.has(core.workingBaselineId)), "Current baseline pointer does not match retained history.");
    if (["approved", "published", "superseded"].includes(core.status)) assert(core.workingBaselineId && pack.baselines.some(snapshot => snapshot.id === core.workingBaselineId && snapshot.engagement.contentRevision === core.contentRevision), "Approved or published working status requires its exact immutable content baseline.");
    for (const publication of pack.entities.publications) {
      assert(baselineIds.has(publication.baselineId) && pack.baselines.find(item => item.id === publication.baselineId).sha256 === publication.snapshotSha256, "Publication does not reference an approved immutable baseline.");
      const baseline = pack.baselines.find(item => item.id === publication.baselineId);
      assert(publication.contentRevision === baseline.engagement.contentRevision, "A publication's content revision must match its immutable approved baseline.");
      if (baseline.engagement.clientAcceptanceRequired) assert(pack.entities.approvals.some(item => item.kind === "client_acceptance" && item.baselineId === publication.baselineId && item.contentRevision === (baseline.scope?baseline.cycles.find(cycle=>cycle.id===baseline.scope.cycleId).contentRevision:baseline.engagement.contentRevision)), "Published output requires the separately retained client acceptance of that exact baseline.");
    }
    if (core.status === "published") assert(pack.entities.publications.some(item => item.baselineId === core.workingBaselineId), "Published status requires a retained publication record.");
    for(const cycle of pack.entities.cycles||[])if(["approved","published"].includes(cycle.status)){assert(pack.baselines.some(baseline=>baseline.id===cycle.baselineId&&baseline.scope?.cycleId===cycle.id&&baseline.cycles.find(item=>item.id===cycle.id)?.contentRevision===cycle.contentRevision),"An approved monitoring cycle must retain its exact period and content baseline.");if(cycle.status==="published")assert(pack.entities.publications.some(item=>item.cycleId===cycle.id&&item.baselineId===cycle.baselineId),"A published monitoring cycle requires its retained publication receipt.");}
    for(const program of pack.entities.programs||[]){if(program.originBaselineRef){validateEngagementOriginBaseline(program,core,pack.entities,originArchiveContext);continue;}const baseline=pack.baselines.find(item=>item.id===program.baselineId&&!item.scope&&item.sha256===program.sourceBaselineSha256);assert(baseline,"Monitoring must retain its exact approved due-diligence baseline anchor.");if(program.baselineActionIds)assert(stableJson(program.baselineActionIds)===stableJson(baseline.actions.filter(item=>!item.cycleId).map(item=>item.id)),"Monitoring must retain the exact original action identities from its approved due-diligence baseline.");}
    for(const rendition of validateIssuedRenditions(pack))claim(rendition.id);
  }
  return clone(packages);
}

/** Resolve the source closure with the same graph rules used for approval.
 * Callers validate the complete portable packages before using this projection. */
export function engagementPackageSourceVersionIds(project, packages, {originArchives,originArchiveContext=createEngagementOriginArchiveContext(originArchives)}={}) {
  const versions = new Set();
  for (const pack of packages) {
    for (const versionId of validateGraph({...pack.engagement, ...pack.entities, baselines: pack.baselines, audit: pack.audit}, project,{originArchiveContext})) versions.add(versionId);
    for (const snapshot of pack.baselines) for (const versionId of validateGraph(snapshot, project, {snapshot: true,originArchiveContext})) versions.add(versionId);
  }
  return [...versions].sort();
}

/** One local OS-owner repository. Declared role IDs preserve the professional
 * workflow and are deliberately not an authentication or signature service. */
export function createEngagementStore({directory, accountId, getProject, getProjectSummary, readVersion, database, authority, originArchives, originArchiveContext=createEngagementOriginArchiveContext(originArchives), now = instant, newId = randomUUID, currentTime=Date.now} = {}) {
  assert(typeof getProject === "function" && typeof readVersion === "function", "Engagement storage requires the existing source project authority.");
  assert(typeof now === "function" && typeof newId === "function" && typeof currentTime==="function", "Use internal engagement clock and identifier callbacks.");
  const instant = () => at(now()), nextId = () => id(newId());
  sourceId(accountId);
  const authentication = authority === undefined ? undefined : normalizeEngagementAuthentication({userId: authority.userId, issuer: authority.issuer, subject: authority.subject});
  if (authority !== undefined) {exactKeys(authority, ["mode", "userId", "issuer", "subject"], "Trusted engagement authority");assert(authority.mode === "authenticated_user", "Use externally verified authenticated User authority.");}
  if (database === undefined) {
    directory = privateStorageDirectory(directory);mkdirSync(directory, {recursive: true, mode: 0o700});
    for (const name of ["engagements.sqlite", "engagements.sqlite-wal", "engagements.sqlite-shm"]) {try {const stat = lstatSync(join(directory, name));assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, "Engagement storage cannot use shared filesystem links.", 409);} catch (error) {if (error.code !== "ENOENT") throw error;}}
  }
  const db = database ?? new DatabaseSync(join(directory, "engagements.sqlite"));
  assert(db instanceof DatabaseSync, "Inject an actual SQLite DatabaseSync authority.");
  const version = db.prepare("PRAGMA user_version").get().user_version;
  if (![0, 1].includes(version)) {db.close();assert(false, "Unsupported engagement database schema.", 409);}
  db.exec("PRAGMA user_version=1; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS engagements(id TEXT PRIMARY KEY,project_id TEXT NOT NULL,revision INTEGER NOT NULL,json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS engagement_baselines(id TEXT PRIMARY KEY,engagement_id TEXT NOT NULL,json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS engagement_audit(id TEXT PRIMARY KEY,engagement_id TEXT NOT NULL,sequence INTEGER NOT NULL,json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS engagements_project ON engagements(project_id);");
  for (const table of Object.values(tables)) db.exec(`CREATE TABLE IF NOT EXISTS ${table}(id TEXT PRIMARY KEY,engagement_id TEXT NOT NULL,revision INTEGER NOT NULL,json TEXT NOT NULL); CREATE INDEX IF NOT EXISTS ${table}_owner ON ${table}(engagement_id);`);
  db.exec('CREATE TABLE IF NOT EXISTS engagement_optional_registers(engagement_id TEXT NOT NULL,name TEXT NOT NULL,PRIMARY KEY(engagement_id,name));');
  const issued=createIssuedRenditionRepository(db,{newId:nextId,now:instant});
  const transaction = work => {db.exec("BEGIN IMMEDIATE");try {const result = work();db.exec("COMMIT");return result;} catch (error) {db.exec("ROLLBACK");throw error;}};
  const readCore = engagementId => {const row = db.prepare("SELECT json FROM engagements WHERE id=?").get(id(engagementId));assert(row, "Engagement is unavailable in this local account.", 404);const value = JSON.parse(row.json);assert(value.accountId === accountId, "Engagement account custody differs.", 403);value.mandateHistory ??= [];return value;};
  const entities = engagementId => Object.fromEntries(engagementEntityNames.map(name => [name, db.prepare(`SELECT json FROM ${tables[name]} WHERE engagement_id=? ORDER BY rowid`).all(engagementId).map(row => JSON.parse(row.json))]).filter(([name,rows])=>!engagementOptionalEntityNames.includes(name)||rows.length||db.prepare('SELECT name FROM engagement_optional_registers WHERE engagement_id=? AND name=?').get(engagementId,name)));
  const auditRows = engagementId => db.prepare("SELECT json FROM engagement_audit WHERE engagement_id=? ORDER BY sequence").all(engagementId).map(row => JSON.parse(row.json));
  const baselines = engagementId => db.prepare("SELECT json FROM engagement_baselines WHERE engagement_id=? ORDER BY rowid").all(engagementId).map(row => JSON.parse(row.json));
  function viewOf(core, project = getProject(core.projectId)) {return {...clone(core), ...entities(core.id), baselines: baselines(core.id), audit: auditRows(core.id), sourceVersions: sourceVersions(project), issuedRenditions:issued.list(core.id), roleAuthority: core.executionAuthority ? (authentication ? authenticatedEngagementAuthorityLabel : "Retained authenticated User attribution from the originating repository; the current local session has not authenticated those Users.") : "Declared local professional roles; the signed-in OS owner controls this repository. These attestations are not legally binding digital signatures."};}
  function assertExecution(core, actorId) {
    assert(Boolean(core.executionAuthority) === Boolean(authentication), "Keep local declared history separate from authenticated execution; create an explicitly linked successor instead of relabelling it.", 403);
    if (authentication) assert(actorId === authentication.userId && core.executionAuthority.issuer === authentication.issuer, "The acting User must match the engagement's verified identity authority.", 403);
  }
  function writeCore(core) {db.prepare("INSERT INTO engagements(id,project_id,revision,json) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,json=excluded.json").run(core.id, core.projectId, core.revision, JSON.stringify(core));}
  function putEntity(name, engagementId, value) {db.prepare(`INSERT INTO ${tables[name]}(id,engagement_id,revision,json) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,json=excluded.json`).run(value.id, engagementId, value.revision, JSON.stringify(value));}
  function appendAudit(core, actorId, command, changedIds = [], review, assignment, sourceRegistration) {
    const previous = db.prepare("SELECT sequence,json FROM engagement_audit WHERE engagement_id=? ORDER BY sequence DESC LIMIT 1").get(core.id);
    const entry = {id: nextId(), engagementId: core.id, sequence: (previous?.sequence || 0) + 1, revision: core.revision, contentRevision: core.contentRevision, actorId, command,
      at: instant(), changedIds, previousSha256: previous ? hash(stableJson(JSON.parse(previous.json))) : null, ...(review ? {review} : {}), ...(authentication ? {authentication: clone(authentication)} : {}), ...(assignment ? {assignment} : {}), ...(sourceRegistration ? {sourceRegistration: clone(sourceRegistration)} : {})};
    db.prepare("INSERT INTO engagement_audit(id,engagement_id,sequence,json) VALUES(?,?,?,?)").run(entry.id, core.id, entry.sequence, JSON.stringify(entry)); return entry;
  }
  function savedRecord(name, previous, fields, actorId) {
    const time = instant(), history = previous ? [...previous.history, Object.fromEntries(Object.entries(previous).filter(([key]) => key !== "history"))] : [];
    return {...fields, id: previous?.id || fields.id || nextId(), revision: (previous?.revision || 0) + 1, createdAt: previous?.createdAt || time, updatedAt: time, createdBy: previous?.createdBy || actorId, updatedBy: actorId, history};
  }
  function assertAvailable(projectId, versionIds) {
    const project = getProject(projectId);
    for (const versionId of versionIds) {
      const expected = sourceFor(project, versionId), original = readVersion(projectId, versionId);
      assert(original && !original.then, "Source authority must return synchronous locally retained bytes.");
      const bytes = original.bytes;assert(bytes && hash(bytes) === expected.sha256 && bytes.length === expected.size, "The exact original source bytes are missing or changed; restore their verified version before approval.", 409);
    }
  }
  function material(core, command) {core.contentRevision++;if (!(command.type === "finding-review" && core.status === "under_review")) core.status = "draft";core.workingBaselineId = null;}
  function assertReviewed(view) {
    assert(view.requirements.length, "Select and assess the engagement's applicable requirements before review.", 409);
    assert(view.agreementVersionIds.length, "Attach the client's agreement or terms of reference before approving the engagement.", 409);
    assert(view.requirements.every(requirement => view.findings.some(finding => finding.requirementId === requirement.id && !finding.cycleId && finding.status === "verified")), "Every selected requirement needs a verified, cited human-reviewed due-diligence finding; a monitoring-period conclusion cannot substitute for it.", 409);
    assert(view.obligations.every(obligation => obligation.status === "confirmed"), "Review and confirm every candidate contractual obligation before approval.", 409);
    assert(view.mappings.every(mapping=>mapping.reviewStatus!=="draft"),"Review every imported requirement mapping before approving the assessment.",409);
    for (const kind of ["assessor", "technical"]) assert(view.approvals.some(approval => !approval.cycleId&&approval.kind === kind && approval.contentRevision === view.contentRevision), `Obtain the separate ${kind} attestation for this exact working revision.`, 409);
  }
  function fullSnapshot(core, view, baselineId, previousBaselineId, scope) {
    const used = validateGraph({...view,audit:auditRows(core.id)}, getProject(core.projectId),{originArchiveContext});
    const snapshot = redactMonitoringSnapshot({format: "esia-engagement-snapshot", schemaVersion: 1, id: baselineId, createdAt: instant(), previousBaselineId: previousBaselineId || null,...(scope?{scope}:{}),
      engagement: {...clone(core), status: "approved",workingBaselineId:baselineId}, ...Object.fromEntries(engagementEntityNames.filter(name=>!engagementOptionalEntityNames.includes(name)||Object.hasOwn(view,name)).map(name => [name, clone(view[name]||[])])),
      sourceVersions: sourceVersions(getProject(core.projectId)).filter(version => used.has(version.id)), audit: auditRows(core.id)});
    snapshot.sha256 = hash(snapshotDigestInput(snapshot));assert(Buffer.byteLength(JSON.stringify(snapshot)) <= engagementSnapshotMaxBytes, "This immutable assessment snapshot exceeds the 8 MiB export limit; reduce duplicated narrative or start a successor scope before approval.", 413);validateSnapshotEnvelope(snapshot); validateGraph(snapshot, getProject(core.projectId), {snapshot: true,originArchiveContext}); return snapshot;
  }
  function validatePackage(project, packages) {
    issued.validateImport(packages);
    validateEngagementPackages(project, packages, {accountId,originArchiveContext});
    for (const pack of packages) {
      const incomingIds = [pack.engagement.id, ...engagementEntityNames.flatMap(name => (pack.entities[name]||[]).map(entity => entity.id)), ...pack.baselines.map(entity => entity.id), ...pack.audit.map(entity => entity.id),...(pack.issuedRenditions||[]).map(item=>item.id)];
      for (const incomingId of incomingIds) {
        const existingCore = db.prepare("SELECT id FROM engagements WHERE id=?").get(incomingId);assert(!existingCore || existingCore.id === pack.engagement.id, "An imported UUID already belongs to another engagement.", 409);
        for (const table of [...Object.values(tables), "engagement_baselines", "engagement_audit","engagement_issued_renditions"]) {const owner = db.prepare(`SELECT engagement_id FROM ${table} WHERE id=?`).get(incomingId);assert(!owner || owner.engagement_id === pack.engagement.id, "An imported UUID already belongs to another engagement's linked record or history.", 409);}
      }
      for (const name of engagementEntityNames) for (const entity of pack.entities[name]||[]) {
        const existingOwner = db.prepare(`SELECT engagement_id FROM ${tables[name]} WHERE id=?`).get(entity.id);
        assert(!existingOwner || existingOwner.engagement_id === pack.engagement.id, "An imported linked record already belongs to a different engagement.", 409);
      }
      for (const [table, records] of [["engagement_baselines", pack.baselines], ["engagement_audit", pack.audit]]) for (const entity of records) {
        const existingOwner = db.prepare(`SELECT engagement_id FROM ${table} WHERE id=?`).get(entity.id);
        assert(!existingOwner || existingOwner.engagement_id === pack.engagement.id, "Imported history already belongs to another engagement.", 409);
      }
      const existing = db.prepare("SELECT json FROM engagements WHERE id=?").get(pack.engagement.id);
      if (existing) {
        const retained = exportOne(pack.engagement.id);
        const comparable=value=>({...value,entities:{...Object.fromEntries(monitoringEntityNames.map(name=>[name,[]])),...value.entities}});
        assert(stableJson(comparable(retained)) === stableJson(comparable(pack)), "An existing engagement differs from this imported record; retain it and import a successor deliberately.", 409);
      }
    }
    return clone(packages);
  }
  function exportOne(engagementId) {const core = readCore(engagementId),renditions=issued.export(core.id);return {format: "esia-engagement-package", schemaVersion: 1, engagement: core, entities: entities(core.id), baselines: baselines(core.id), audit: auditRows(core.id),...(renditions.length?{issuedRenditions:renditions}:{})};}
  const service = {
    listWorkItems({after = "", limit = 30, projectId = ""} = {}) {
      assert(typeof getProjectSummary === "function", "The work queue needs a metadata-only project authority.", 503);
      assert(typeof after === "string" && after.length <= 1000 && Number.isSafeInteger(limit) && limit > 0 && limit <= 100, "Choose a bounded work page of 1–100 records.");
      if (projectId) getProjectSummary(sourceId(projectId));
      const rows = db.prepare(`WITH owned AS (
        SELECT id,project_id,substr(json_extract(json,'$.name'),1,200) engagementName
        FROM engagements WHERE json_extract(json,'$.accountId') = ?
      ), work AS (
        SELECT e.project_id projectId,e.id engagementId,e.engagementName,a.id,'engagement_action' recordType,
          substr(json_extract(a.json,'$.description'),1,500) title,substr(json_extract(a.json,'$.owner'),1,240) owner,
          json_extract(a.json,'$.dueDate') dueDate,json_extract(a.json,'$.status') status,a.revision,
          json_extract(a.json,'$.cycleId') cycleId,NULL missionId
        FROM owned e JOIN engagement_actions a ON a.engagement_id=e.id WHERE json_extract(a.json,'$.status') NOT IN ('closed','superseded')
        UNION ALL SELECT e.project_id,e.id,e.engagementName,a.id,'information_request',
          substr(json_extract(a.json,'$.title'),1,500),substr(json_extract(a.json,'$.owner'),1,240),
          json_extract(a.json,'$.dueDate'),json_extract(a.json,'$.status'),a.revision,json_extract(a.json,'$.cycleId'),NULL
        FROM owned e JOIN engagement_requests a ON a.engagement_id=e.id WHERE json_extract(a.json,'$.status') != 'closed'
        UNION ALL SELECT e.project_id,e.id,e.engagementName,a.id,'field_mission',
          substr(json_extract(a.json,'$.name'),1,500),substr((SELECT group_concat(value,'; ') FROM json_each(a.json,'$.team')),1,240),
          json_extract(a.json,'$.startDate'),json_extract(a.json,'$.status'),a.revision,json_extract(a.json,'$.cycleId'),a.id
        FROM owned e JOIN engagement_missions a ON a.engagement_id=e.id WHERE json_extract(a.json,'$.status') != 'closed'
        UNION ALL SELECT e.project_id,e.id,e.engagementName,a.id,'reporting_cycle',
          substr(json_extract(a.json,'$.name'),1,500),substr(json_extract(a.json,'$.owner'),1,240),
          json_extract(a.json,'$.dueDate'),json_extract(a.json,'$.status'),a.revision,a.id,NULL
        FROM owned e JOIN engagement_cycles a ON a.engagement_id=e.id WHERE json_extract(a.json,'$.status') != 'published'
      ), ordered AS (SELECT *,coalesce(nullif(dueDate,''),'9999-12-31') || '/engagement/' || projectId || '/' || engagementId || '/' || recordType || '/' || id cursor FROM work)
      SELECT * FROM ordered WHERE (? = '' OR projectId = ?) AND cursor > ? ORDER BY cursor LIMIT ?`)
        .all(accountId, projectId, projectId, after, limit + 1);
      const projects = new Map();
      for (const row of rows) if (!projects.has(row.projectId)) projects.set(row.projectId, getProjectSummary(row.projectId));
      return {items: rows.slice(0, limit).map(row => ({...row, projectName: projects.get(row.projectId).name})), hasMore: rows.length > limit};
    },
    list({projectId} = {}) {if (projectId) getProject(sourceId(projectId));const rows = projectId ? db.prepare("SELECT json FROM engagements WHERE project_id=? ORDER BY rowid").all(projectId) : db.prepare("SELECT json FROM engagements ORDER BY rowid").all();return {engagements: rows.map(row => {const core = JSON.parse(row.json);getProject(core.projectId);return {...core, requirementCount: db.prepare(`SELECT COUNT(*) n FROM ${tables.requirements} WHERE engagement_id=?`).get(core.id).n};})};},
    create(input) {
      exactKeys(input, ["projectId", "actorId", ...mandateFields], "New engagement");const project = getProject(sourceId(input.projectId)), mandate = normalizeMandate(input);
      const actorId = input.actorId || mandate.roles.preparer[0];assertRole(mandate, actorId, ["preparer"]);validateMandateSources(mandate, project);
      if (authentication) assert(actorId === authentication.userId, "Engagement creation must use the externally verified acting User.", 403);
      if (mandate.devicePolicy !== undefined) assertRole(mandate, actorId, ["approver"]);
      const time = instant(), core = {id: nextId(), projectId: project.id, accountId, revision: 1, contentRevision: 1, status: "draft", createdAt: time, updatedAt: time, createdBy: actorId, updatedBy: actorId, workingBaselineId: null, latestBaselineId: null, mandateHistory: [], ...mandate, ...(authentication ? {executionAuthority: {mode: "authenticated_user", issuer: authentication.issuer}} : {})};
      return transaction(() => {writeCore(core);appendAudit(core, actorId, "create-engagement");return viewOf(core, project);});
    },
    get(engagementId) {return viewOf(readCore(engagementId));},
    getMandate(engagementId) {const core=readCore(engagementId);if(getProjectSummary)getProjectSummary(core.projectId);else getProject(core.projectId);return clone(core);},
    findIssuedRendition(engagementId,{baselineId,publicationId,format,selection}) {const core=readCore(engagementId),baseline=baselines(core.id).find(item=>item.id===baselineId);assert(baseline,"Approved baseline is unavailable.",404);return issued.find({engagementId,baselineId,publicationId,format,selection:renditionSelection(baseline,selection)});},
    getIssuedRendition(engagementId,renditionId) {readCore(engagementId);return issued.get(engagementId,id(renditionId));},
    retainIssuedRendition(engagementId,input) {readCore(engagementId);return transaction(()=>{const pack=exportOne(engagementId);return issued.retain(pack,{...input,selection:renditionSelection(pack.baselines.find(item=>item.id===input.baselineId),input.selection)});});},
    mutate(engagementId, expectedRevision, command, actorId, {extractionBinding,sourceReviewBinding,offlineOperation,roleAssignment,sourceRegistration,requirementContext,fieldCaptureBinding,authenticatedOfflineLease,caseProtection} = {}) {
      assert(isObject(command) && typeof command.type === "string", "An explicit engagement command is required.");assert(command.origin===undefined&&command.originBaselineRef===undefined,"Original archive provenance is constructor-owned, not a browser command field.",403);
      assert(command.authenticatedOfflineLease===undefined,"Authenticated offline authority is supplied only by the trusted repository adapter.",403);
      if(authenticatedOfflineLease!==undefined)assert(authentication&&offlineOperation&&["finding-save","action-save"].includes(command.type),"Authenticated offline permission applies only to explicitly reconciled native human findings and open actions.",403);
      return transaction(() => {
        const core = readCore(engagementId), project = getProject(core.projectId), view = viewOf(core, project);
        assertExecution(core, actorId);
        if(command.type==='source-review-save'){
          validateSourceReviewCommand(command);assertRole(core,actorId,['preparer','reviewer']);
          const prior=(view.sourceReviews||[]).find(row=>row.requestKey===command.requestKey);
          if(prior){assert(prior.createdBy===actorId&&prior.commandSha256===sourceReviewCommandDigest(command),'This source-review request UUID already identifies different work or another practitioner.',409);return view;}
        }
        let offline;
        if(offlineOperation){
          exactKeys(offlineOperation,["id","sha256","deviceLease"],"Offline draft operation");id(offlineOperation.id);id(command.id);
          assert(["finding-save","action-save"].includes(command.type),"Offline reconciliation saves human draft findings or open corrective actions only.");
          assertRole(core,actorId,["preparer","reviewer"]);
          if(authenticatedOfflineLease!==undefined)assertAuthenticatedOfflineLease(authenticatedOfflineLease,{authentication,actorId,core,project,deviceLease:offlineOperation.deviceLease,now:currentTime()});
          else assertFieldDeviceLease(core.devicePolicy,offlineOperation.deviceLease,{scope:{accountId:core.accountId,projectId:core.projectId,engagementId:core.id},policySha256:core.devicePolicy===undefined?null:hash(fieldDevicePolicyDigestInput(core.devicePolicy)),sensitivity:"internal"});
          const findingCommand=command.type==="finding-save";
          exactKeys(command,findingCommand?["type","id","requirementId",...Object.keys(findingChoices),...Object.keys(monitoringFindingChoices),"supportingAssertionIds","contradictoryAssertionIds","contradictionDispositions","applicabilityRationale","rationale","deficiency","recommendation","uncertainty","riskSignificance","cycleId","priorFindingId","provenance","status"]:["type","id","findingIds","description","owner","organization","priority","dueDate","trigger","triggerDetail","deliverables","verificationCriteria","dependencies","status","progress","provenance","cycleId","monitoringObligationIds"],"Offline review command");
          assert(command.provenance?.kind==="human"&&(!command.status||command.status===(findingCommand?"draft":"open")),"Offline work remains a human draft requiring normal review.");
          exactKeys(command.provenance,["kind","method"],"Offline human provenance");
          const choices=findingCommand?{...findingChoices,...monitoringFindingChoices,status:["draft"]}:{status:["open"],priority:["low","medium","high","critical"],trigger:["date","pre_commitment","pre_disbursement","pre_construction","ongoing","other"]};
          for(const [key,values]of Object.entries(choices))if(Object.hasOwn(command,key))choice(command[key],values,`Offline ${key}`);
          for(const key of ["cycleId","priorFindingId"])if(Object.hasOwn(command,key))id(command[key]);
          if(findingCommand&&!command.cycleId)assert(!["priorFindingId",...Object.keys(monitoringFindingChoices)].some(key=>Object.hasOwn(command,key)),"Select a reporting cycle before saving monitoring dimensions in an offline finding.");
          for(const key of ["supportingAssertionIds","contradictoryAssertionIds","findingIds","deliverables","dependencies","monitoringObligationIds"])if(Object.hasOwn(command,key))assert(Array.isArray(command[key]),`Offline ${key} must be an explicit list.`);
          assert(sha256Pattern.test(offlineOperation.sha256)&&hash(stableJson(command))===offlineOperation.sha256,"The offline operation does not match its reviewed draft bytes.",409);
          const name=command.type==="finding-save"?"findings":"actions",marker=`Offline draft ${offlineOperation.id}; SHA256 ${offlineOperation.sha256}`;
          const owned=db.prepare(`SELECT engagement_id FROM ${tables[name]} WHERE id=?`).get(command.id);
          assert(!owned||owned.engagement_id===core.id,"This offline record identity belongs to another engagement.",403);
          if(!owned)for(const table of ["engagements",...Object.values(tables),"engagement_baselines","engagement_audit"])assert(!db.prepare(`SELECT id FROM ${table} WHERE id=?`).get(command.id),"This offline record identity is already retained by another record.",409);
          const target=view[name].find(record=>record.id===command.id),versions=target?[...target.history,target]:[];
          const sameOperation=[...view.findings,...view.actions].flatMap(record=>[...record.history,record]).filter(record=>record.provenance?.method?.startsWith(`Offline draft ${offlineOperation.id};`));
          assert(sameOperation.every(record=>record.id===command.id&&record.provenance.method===marker),"This offline operation already belongs to another retained draft or payload.",409);
          const comparable=value=>typeof value==="string"?value.trim():Array.isArray(value)?value.map(comparable):value;
          const applied=versions.find(record=>record.provenance?.method===marker&&record.provenance.actorId===actorId&&record.provenance.kind==="human"&&Object.entries(command).every(([key,value])=>["type","id","provenance"].includes(key)||stableJson(comparable(record[key]))===stableJson(comparable(value))));
          const receipt={operationId:offlineOperation.id,sha256:offlineOperation.sha256,recordId:command.id,recordType:name};
          if(applied)return {...view,offlineReceipt:{...receipt,revision:applied.revision,acknowledged:true}};
          assert(!versions.some(record=>record.provenance?.method?.startsWith(`Offline draft ${offlineOperation.id};`)),"This offline operation already identifies different retained work. Keep both drafts and reconcile a new revision explicitly.",409);
          offline={name,marker,receipt};
        }
        assert(view.audit.length < 10000, "This engagement has reached its 10,000-entry audit limit; retain it and start a successor engagement.", 413);
        assert(Number.isSafeInteger(expectedRevision) && expectedRevision === core.revision, "This engagement changed. Reload before saving your retained draft.", 409);
        const authorRoles = ["preparer", "reviewer"], changed = [], pending = [];
        const save = (name, previous, fields) => {if(previous?.origin)fields={...fields,origin:clone(previous.origin)};if (name === "approvals" && authentication) fields = {...fields, authority: authenticatedEngagementAuthorityLabel};const record = savedRecord(name, previous,offline&&name===offline.name?{...fields,id:command.id}:fields, actorId);view[name]??=[];const index = view[name].findIndex(item => item.id === record.id);if (index < 0) view[name].push(record);else view[name][index] = record;pending.push([name, record]);changed.push(record.id);return record;};
        const previousFor = (name, recordId) => {if (!recordId) return;const previous = view[name]?.find(item => item.id === id(recordId));assert(previous||offline&&name===offline.name&&recordId===command.id, `The ${name} record is unavailable in this engagement.`, 404);return previous;};
        const contribution = provenance => normalizeProvenance(offline?{...provenance,method:offline.marker}:provenance, actorId, instant());
        let materialChange = true, newSnapshot;
        switch (command.type) {
          case 'source-review-save': {
            assertRole(core,actorId,authorRoles);
            assert(sourceReviewBinding&&sourceReviewBinding.commandSha256===sourceReviewCommandDigest(command)&&sourceReviewBinding.requestKey===command.requestKey,'Retained source coverage requires the trusted original/index recheck operation.',403);
            save('sourceReviews',undefined,clone(sourceReviewBinding));break;
          }
          case "register-sources": {
            exactKeys(command,["type","versionIds"],"Verified source registration");
            assert(authentication && sourceRegistration === true,"Source registration requires the trusted verified-original attachment operation.",403);
            assertRole(core,actorId,authorRoles);
            assert(Array.isArray(command.versionIds) && command.versionIds.length > 0 && command.versionIds.length <= 10 && new Set(command.versionIds).size === command.versionIds.length,"Register one to ten exact new source versions.");
            assertAvailable(core.projectId,command.versionIds);
            const prior=new Set(view.audit.flatMap(entry=>(entry.sourceRegistration||[]).map(source=>source.versionId)));
            assert(command.versionIds.every(versionId=>!prior.has(versionId)),"These source versions were already registered in this engagement.",409);
            changed.push(core.id);break;
          }
          case "accept-role-assignment": {
            exactKeys(command, ["type", "role", "acceptedUserId"], "Accepted engagement assignment");
            assert(authentication && roleAssignment === true && command.acceptedUserId === actorId, "Only a trusted invitation acceptance may bind its verified recipient's role.", 403);
            choice(command.role, engagementRoles, "accepted professional role");
            assert(!view.approvals.length && !view.baselines.length, "Create a successor engagement to assign roles after formal attestation.", 409);
            assert(!core.roles[command.role].includes(actorId), "This User already holds the accepted professional role.", 409);
            core.mandateHistory.push({revision: core.revision, at: instant(), actorId, mandate: normalizeMandate(core)});
            core.roles[command.role].push(actorId);changed.push(core.id);validateMandateSources(core, project);break;
          }
          case "update-engagement": {
            assertRole(core, actorId, ["preparer", "approver"]);exactKeys(command, ["type", "changes"], "Mandate update");exactKeys(command.changes, mandateFields, "Mandate changes");
            if (authentication && Object.hasOwn(command.changes,"roles")) assert(stableJson(command.changes.roles) === stableJson(core.roles), "Authenticated role assignments require the trusted resource invitation/configuration path.", 403);
            if (Object.hasOwn(command.changes,"devicePolicy")) {assertRole(core,actorId,["approver"]);assert(command.changes.devicePolicy !== undefined, "Set an explicit device policy; disable offline work instead of removing its controls.");}
            // Earlier role attestations must remain attributable. Authority changes
            // require a successor engagement instead of rewriting old assignments.
            if (command.changes.roles && stableJson(command.changes.roles) !== stableJson(core.roles)) assert(!view.approvals.length && !view.baselines.length, "Create a successor engagement to change roles after a formal attestation.", 409);
            const mandate=normalizeMandate({...core,...command.changes}),nextDeliverables=new Map(mandate.deliverables.map(item=>[item.id,item]));
            for(const obligation of view.obligations)for(const record of [...obligation.history,obligation])assert(record.deliverableIds.every(value=>nextDeliverables.has(value)),"A deliverable linked by a contractual obligation or its retained history cannot be removed; retain that identified deliverable.",409);
            const revisedDeliverables=new Set(core.deliverables.filter(item=>nextDeliverables.has(item.id)&&stableJson(item)!==stableJson(nextDeliverables.get(item.id))).map(item=>item.id));
            for(const obligation of view.obligations)if(obligation.status==="confirmed"&&obligation.deliverableIds.some(value=>revisedDeliverables.has(value))){const {history,confirmedBy,confirmedAt,confirmationStatement,...fields}=obligation;save("obligations",obligation,{...fields,status:"candidate",provenance:contribution({kind:"human",method:"Mandate deliverable revised; confirm this contractual obligation against the changed scope."})});}
            core.mandateHistory.push({revision: core.revision, at: instant(), actorId, mandate: normalizeMandate(core)});
            Object.assign(core,mandate);validateMandateSources(core, project);break;
          }
          case "requirement-add": {
            assertRole(core, actorId, authorRoles);let requirement;
            if (command.frameworkId === "project") {
              const source = sourceFor(project, command.sourceVersionId), locator = text(command.locator, "Project obligation source passage", {required: true});
              requirement = {frameworkId: "project", checkId: `project:${nextId()}`, checkSet: "project", authority: "Project-specific commitment", frameworkName: "Project requirements", edition: source.id, standard: "Project commitment", clause: locator,
                title: text(command.title, "Project requirement title", {required: true, max: 1000}), text: text(command.text, "Original project requirement wording", {required: true, max: 30000}),
                sourceVersionId: source.id, locator, textKind: "project_source_text", coverageNote: "Project-specific commitment interpreted from the cited original; does not replace institutional requirements.", topics: stringList(command.topics, "Requirement topics", 100), sources: [{title: source.title, url: "", locator, sha256: source.sha256}]};
            } else {
              assert(core.frameworkIds.includes(command.frameworkId), "Select this framework edition in the engagement mandate first.");
              const protectedSelection=authentication&&["detailed","diagnostic"].includes(command.checkSet);
              if(protectedSelection)assert(isObject(requirementContext)&&requirementContext.checkId===command.checkId&&requirementContext.checkSet===command.checkSet&&requirementContext.definition?.frameworkId===command.frameworkId&&requirementContext.definition?.edition===getFramework(command.frameworkId)?.edition&&sha256Pattern.test(requirementContext.definition?.sourcePackSha256||"")&&isObject(requirementContext.selection),"Authenticated source requirements need a separately entitled exact pinned library context.",403);
              const context = protectedSelection?requirementContext:getAuditContext(command.frameworkId, command.checkId, command.checkSet || "curated"), framework = getFramework(command.frameworkId), check = protectedSelection?{standard:context.selection.standard,title:context.selection.title,prompt:context.selection.text,...(context.selection.textKind==="source_text"?{detail:{sourceText:context.selection.text}}:{}),...(context.selection.textKind==="group"?{memberIds:context.definition.memberIds}:{})}:getAuditChecks(command.frameworkId, command.checkSet || "curated").find(item => item.id === command.checkId);
              requirement = {frameworkId: framework.id, checkId: context.checkId, checkSet: context.checkSet, authority: framework.institution, frameworkName: framework.name, edition: framework.edition, standard: check.standard,
                clause: context.framework.clause, title: check.title || context.framework.clause, text: check.detail?.sourceText || check.prompt || context.prompt,
                textKind: check.detail ? "source_text" : check.memberIds ? "group" : "review_prompt", coverageNote: context.coverage || "Selected requirement scope; verify the full institutional instrument before concluding coverage.", ...(context.definition ? {definition: clone(context.definition)} : {}), topics: [context.topic], sources: clone(context.sources)};
            }
            if(["curated","workbook"].includes(requirement.checkSet))requirement.catalogDefinition=pinCatalogDefinition(requirement);
            assert(!view.requirements.some(item => item.frameworkId === requirement.frameworkId && item.checkId === requirement.checkId && item.checkSet === requirement.checkSet), "This requirement already belongs to the engagement.", 409);
            save("requirements", null, requirement);break;
          }
          case "assertion-save": {
            assertRole(core, actorId, authorRoles);const previous = previousFor("assertions", command.id), source = sourceFor(project, command.versionId), provenance = contribution(command.provenance);
            assert(command.fieldCapture===undefined,"Field capture provenance is server-owned; choose the verified hosted capture attachment operation.",403);
            let fieldCapture=previous?.fieldCapture;
            if(fieldCaptureBinding!==undefined){
              assert(authentication&&!previous&&provenance.kind==="human"&&(command.reviewStatus||"suggested")==="suggested","Attach verified field provenance only to a new authenticated human citation awaiting review.",403);
              fieldCapture=normalizeAuthenticatedFieldCaptureBinding(fieldCaptureBinding);
              assert(stableJson(fieldCapture)===stableJson(fieldCaptureBinding)&&fieldCapture.uploadedBy===actorId&&fieldCapture.receivedAt===instant()&&fieldCapture.manifest.versionId===source.id&&fieldCapture.manifest.sha256===source.sha256,"The trusted field capture differs from this exact source, uploader or reserved receipt time.",409);
              validateAuthenticatedFieldLinks(fieldCapture.links,view,{captureId:fieldCapture.captureId});
              assertAvailable(core.projectId,[fieldCapture.manifest,...fieldCapture.media].map(pin=>pin.versionId));
            }
            if(fieldCapture)assert(fieldCapture.manifest.versionId===source.id&&fieldCapture.manifest.sha256===source.sha256,"Keep the original field manifest on this citation; create a new citation for another source.",409);
            assert(command.extraction===undefined||previous?.extraction&&stableJson(command.extraction)===stableJson(previous.extraction),"Extraction metadata is server-owned. Choose an indexed passage reference or retain the existing exact binding.",409);
            const locator=text(command.locator,"Evidence page / passage locator",{required:true,max:4000}),quote=text(command.quote,"Evidence passage",{max:30000});
            let extraction;
            if(command.extractionReference!==undefined){exactKeys(command.extractionReference,["indexId","passageId","sourceReviewId"],"Indexed extraction reference");assert(extractionBinding&&extractionBinding.indexId===command.extractionReference.indexId&&extractionBinding.passageId===command.extractionReference.passageId,"Resolve this indexed passage through the owning source reader before saving extraction provenance.",409);assert(extractionBinding.originalPageReview?.recordId===command.extractionReference.sourceReviewId,'Retain the exact selected OCR original-page review.',409);extraction=clone(extractionBinding);}
            else if(previous?.extraction&&previous.versionId===source.id&&previous.locator===locator&&previous.quote===quote)extraction=clone(previous.extraction);
            if(extraction?.method==='tesseract-ocr-derivative'&&command.extractionReference!==undefined)assert(provenance.kind==='human'&&['confirmed','modified'].includes(command.reviewStatus)&&extraction.originalPageReview.actorId===actorId,'An OCR-derived citation requires the acting human to confirm the exact original-page quotation.',403);
            validateAssertionExtraction(extraction,{versionId:source.id,sourceSha256:source.sha256,locator,quote},{accountId:core.accountId,projectId:core.projectId,sourceReviews:view.sourceReviews||[]});
            if(previous)assert(!view.verifications.some(record=>[...record.history,record].some(value=>value.decision==="accepted"&&value.assertionIds.includes(previous.id)))&&!view.measurements.some(record=>[...record.history,record].some(value=>value.dataQuality==="verified"&&value.assertionIds.includes(previous.id)))&&!view.monitoringObligations.some(record=>[...record.history,record].some(value=>(value.occurrences||[]).some(occurrence=>occurrence.reviewStatus!=="draft"&&(occurrence.assertionIds||[]).includes(previous.id)))),"A monitoring verification or resolved trigger already pins this citation. Create a new citation for corrected or later evidence; retained verification sources remain unchanged.",409);
            const reviewStatus = choice(command.reviewStatus || "suggested", ["suggested", "confirmed", "modified"], "citation review status");
            assert(provenance.kind !== "ai" || reviewStatus === "suggested", "AI citation suggestions must remain unconfirmed until a separate human review.");
            const assertion = save("assertions", previous, {versionId: source.id, sourceSha256: source.sha256, locator, quote, note: text(command.note, "Evidence note"), topics: stringList(command.topics, "Evidence topics", 100), requirementIds: references(command.requirementIds, view.requirements, "Evidence requirements"), classification: choice(command.classification || (provenance.kind === "ai" ? "ai_suggested" : "manual"), ["manual", "ai_suggested"], "evidence classification"), reviewStatus, provenance,...(extraction?{extraction}:{}),
              ...(fieldCapture?{fieldCapture:clone(fieldCapture)}:{}),...(reviewStatus !== "suggested" ? {reviewedBy: actorId, reviewedAt: instant()} : {})});
            if (previous) for (const finding of [...view.findings]) if ([...finding.supportingAssertionIds, ...finding.contradictoryAssertionIds].includes(assertion.id) && (finding.status === "verified" || finding.contradictionDispositions?.some(item => item.assertionId === assertion.id && item.disposition !== "unresolved"))) {
              const {history, reviewedBy, reviewedAt, reviewStatement, reviewDecision, reviewDurationMinutes, ...fields} = finding;
              if (fields.contradictionDispositions) fields.contradictionDispositions = fields.contradictionDispositions.map(item => item.assertionId === assertion.id ? {...item, disposition: "unresolved"} : item);
              save("findings", finding, {...fields, status: "draft"});
            }
            break;
          }
          case "finding-save": {
            assertRole(core, actorId, authorRoles);const previous = command.id ? previousFor("findings", command.id) : view.findings.find(item => item.requirementId === command.requirementId&&(item.cycleId||null)===(command.cycleId||null));
            const finding = {requirementId: sourceId(command.requirementId), supportingAssertionIds: references(command.supportingAssertionIds, view.assertions, "Supporting assertions"), contradictoryAssertionIds: references(command.contradictoryAssertionIds, view.assertions, "Contradictory assertions"), provenance: contribution(command.provenance), status: "draft"};
            if (command.contradictionDispositions !== undefined || previous?.contradictionDispositions !== undefined) {
              finding.contradictionDispositions = normalizeContradictionDispositions(command.contradictionDispositions ?? previous.contradictionDispositions.filter(item => finding.contradictoryAssertionIds.includes(item.assertionId)), finding.contradictoryAssertionIds);
              assert(finding.provenance.kind !== "ai" || finding.contradictionDispositions.every(item => item.disposition === "unresolved"), "AI draft candidates cannot resolve contradictory evidence; record a human disposition with reasoning.", 403);
            }
            for (const [field, values] of Object.entries(findingChoices)) finding[field] = choice(command[field] || ({applicability: "uncertain", coverage: "not_determined", adequacy: "insufficient_evidence", performance: "undetermined"}[field]), values, `finding ${field}`);
            for (const field of ["applicabilityRationale", "rationale", "deficiency", "recommendation", "uncertainty", "riskSignificance"]) finding[field] = text(command[field], `Finding ${field}`);
            if(command.cycleId||previous?.cycleId){finding.cycleId=command.cycleId||previous.cycleId;for(const [field,values]of Object.entries(monitoringFindingChoices))finding[field]=choice(command[field]||(field==="evidenceSufficiency"?"inconclusive":values[0]),values,`monitoring ${field}`);if(command.priorFindingId||previous?.priorFindingId)finding.priorFindingId=command.priorFindingId||previous.priorFindingId;}
            save("findings", previous, finding);break;
          }
          case "finding-review": {
            assertRole(core, actorId, ["reviewer"]);const previous = previousFor("findings", command.findingId);assert(previous, "Choose a draft finding.");
            const duration = Object.hasOwn(command, "reviewDurationMinutes") ? {reviewDurationMinutes: reviewDurationMinutes(command.reviewDurationMinutes)} : {};
            if (Object.hasOwn(command, "reviewDurationMinutes")) assert(command.provenance === undefined || command.provenance?.kind === "human", "AI candidates cannot report human finding-review duration.", 403);
            const decision = choice(command.decision || "confirmed", findingReviewDecisions, "review decision");
            if (decision !== "rejected") {const errors = findingReviewIssues(previous, view);assert(!errors.length, errors.join(" "), 409);}
            const {history, reviewDurationMinutes: previousDuration, ...fields} = previous;
            save("findings", previous, {...fields, ...duration, status: decision === "rejected" ? "draft" : "verified", reviewedBy: actorId, reviewedAt: instant(), reviewDecision: decision, reviewStatement: text(command.statement, "Substantive source and conclusion review attestation", {required: true})});break;
          }
          case "action-save": {
            assertRole(core, actorId, authorRoles);const previous = previousFor("actions", command.id), status = command.status || "open", trigger = command.trigger || "date", provenance = contribution(command.provenance);
            if(command.cycleId||previous?.cycleId||previous&&view.programs.some(program=>monitoringActionBelongsToProgram(view,previous,program.id)))assert(status!=="closed"&&previous?.status!=="closed","Close or reopen a monitoring action through its explicit implementation/effectiveness verification record.",409);
            assert(!previous || previous.status !== "superseded", "A consolidated original action is retained unchanged; edit its replacement action.", 409);
            choice(status, ["open", "in_progress", "closed"], "action progress status");
            assert(provenance.kind !== "ai" || (status === "open" && !(command.closureAssertionIds || []).length && !command.closureNote && !command.closureAttestation), "AI action candidates cannot close an action or claim verified completion.");
            const action = {findingIds: references(command.findingIds, view.findings, "Action findings"), description: text(command.description, "Action description", {required: true}), owner: text(command.owner, "Action owner", {required: true}), organization: text(command.organization, "Responsible organization", {required: true}), priority: command.priority || "medium",
              dueDate: validDate(command.dueDate, "Action due date", {optional: trigger !== "date"}), trigger, triggerDetail: text(command.triggerDetail, "Obligation trigger"), deliverables: stringList(command.deliverables, "Action deliverables", 100), verificationCriteria: text(command.verificationCriteria, "Substantive completion and verification criteria", {required: true}), dependencies: references(command.dependencies, view.actions, "Action dependencies"), status, progress: text(command.progress, "Action progress"), closureAssertionIds: references(command.closureAssertionIds, view.assertions, "Closure evidence"), closureNote: text(command.closureNote, "Closure verification note"), closureAttestation: text(command.closureAttestation, "Human closure attestation"), approvalStatus: "draft", provenance, ...(previous?.consolidatedFrom ? {consolidatedFrom: previous.consolidatedFrom} : {})};
            Object.assign(action,assignActionReviewer({command,previous,core,actorId,provenance,at:instant()}));
            if (status === "closed") {assertRole(core, actorId, ["reviewer"]);assertAssignedActionReviewer(action,actorId);assertAvailable(core.projectId, action.closureAssertionIds.map(value => view.assertions.find(item => item.id === value).versionId));Object.assign(action, {closedBy: actorId, closedAt: instant()});}
            if(command.cycleId||previous?.cycleId)action.cycleId=command.cycleId||previous.cycleId;if(command.monitoringObligationIds||previous?.monitoringObligationIds)action.monitoringObligationIds=references(command.monitoringObligationIds||previous.monitoringObligationIds,view.monitoringObligations,"Action monitoring commitments");
            save("actions", previous, action);break;
          }
          case 'bibliography-save': {
            assertRole(core,actorId,authorRoles);exactKeys(command,['type','id',...bibliographyFields],'Working bibliography command');
            const previous=previousFor('bibliography',command.id),fields=normalizeBibliographyReference(Object.fromEntries(bibliographyFields.filter(key=>Object.hasOwn(command,key)).map(key=>[key,command[key]])));
            if(previous)assert(previous.resourceId===fields.resourceId&&previous.resourceVersionId===fields.resourceVersionId&&previous.instrumentId===fields.instrumentId,'Keep earlier publication editions pinned; register a new reference for a different edition or instrument.',409);
            if(!view.bibliography)view.bibliography=[];assert(previous||view.bibliography.length<1000,'Keep the working bibliography within 1,000 references.',413);
            save('bibliography',previous,fields);break;
          }
          case 'external-reference-save': {
            assertRole(core,actorId,authorRoles);exactKeys(command,['type','id','title','filename','externalURL','accessDetails','declaredMetadata','claimedSha256','statement'],'External document registration');const previous=previousFor('externalReferences',command.id),fields=normalizeExternalReferenceFields(command),registrationStatement=externalReferenceStatement(command.statement);
            if(!view.externalReferences)view.externalReferences=[];assert(previous||view.externalReferences.length<externalReferenceLimits.records,'Keep the external document register within1,000 records.',413);
            save('externalReferences',previous,{...fields,registrationStatement,status:previous?.status||'registered',...Object.fromEntries(['linkedOriginal','linkedBy','linkedAt','linkStatement'].filter(key=>previous?.[key]!==undefined).map(key=>[key,clone(previous[key])]))});break;
          }
          case 'external-reference-link': {
            assertRole(core,actorId,authorRoles);exactKeys(command,['type','referenceId','sourceVersionId','statement'],'External reference original link');const previous=previousFor('externalReferences',command.referenceId);assert(previous,'Select a retained external document reference.');const source=sourceFor(project,command.sourceVersionId),statement=externalReferenceStatement(command.statement,'Retained original linking review');
            retainedExternalReferenceOriginal(project,source.id);assertAvailable(core.projectId,[source.id]);if(previous.linkedOriginal){assert(previous.linkedOriginal.versionId===source.id&&previous.linkedOriginal.sha256===source.sha256,'An external reference retains its exact first linked original; register another reference for another version.',409);materialChange=false;break;}
            const fields=Object.fromEntries(Object.entries(previous).filter(([key])=>!recordFields.includes(key)));save('externalReferences',previous,{...fields,status:'original_linked',linkedOriginal:{versionId:source.id,sha256:source.sha256,size:source.size,mediaType:source.mediaType},linkedBy:actorId,linkedAt:instant(),linkStatement:statement});break;
          }
          case "action-consolidate": {
            for(const key of actionReviewerFields.slice(1))assert(command[key]===undefined,'Action reviewer assignment attribution is server-owned.',403);
            assertRole(core, actorId, authorRoles);const actionIds = references(command.actionIds, view.actions, "Actions to consolidate");assert(actionIds.length >= 2, "Select at least two actions for consolidation.");
            const originals = actionIds.map(value => view.actions.find(item => item.id === value)), first = originals[0], statement = text(command.statement, "Auditable consolidation rationale", {required: true});
            assert(originals.every(item => !["closed", "superseded"].includes(item.status)), "Closed or already superseded actions cannot be consolidated.", 409);
            for (const field of ["owner", "organization", "trigger", "dueDate", "triggerDetail", "cycleId"]) assert(originals.every(item => item[field] === first[field]), "Consolidate only actions with matching owner, responsible organization, reporting cycle and obligation deadline or trigger.", 409);
            const sameReviewer=originals.every(item=>item.reviewer===first.reviewer);assert(sameReviewer||command.reviewer!==undefined,'Choose an explicit reviewed action reviewer before consolidating incompatible reviewer assignments.',409);if(!sameReviewer||command.reviewer!==undefined&&originals.some(item=>item.reviewer&&item.reviewer!==command.reviewer))assertRole(core,actorId,['reviewer']);
            const reviewer=command.reviewer!==undefined?command.reviewer:first.reviewer;if(reviewer!==undefined)assert(command.provenance===undefined||command.provenance.kind==='human','AI candidates cannot choose a consolidated action reviewer.',403);const reviewerAssignment=reviewer===undefined?{}:assignActionReviewer({command:{reviewer,reviewerStatement:command.reviewerStatement||statement},core,actorId,provenance:{kind:'human'},at:instant()});
            const union = field => [...new Set(originals.flatMap(item => item[field] || []))], replacementId = nextId(), priorityOrder = ["critical", "high", "medium", "low"];
            const replacement = save("actions", null, {id: replacementId, findingIds: union("findingIds"), description: [...new Set(originals.map(item => item.description))].join("\n"), owner: first.owner, organization: first.organization, priority: priorityOrder[Math.min(...originals.map(item => priorityOrder.indexOf(item.priority)))], dueDate: first.dueDate, trigger: first.trigger, triggerDetail: first.triggerDetail,
              deliverables: union("deliverables"), verificationCriteria: [...new Set(originals.map(item => item.verificationCriteria))].join("\n"), dependencies: union("dependencies").filter(value => !actionIds.includes(value)), status: "open", progress: `Consolidated by ${actorId}: ${statement}\n${originals.map(item => item.progress).filter(Boolean).join("\n")}`,
              closureAssertionIds: [], closureNote: "", closureAttestation: "", approvalStatus: "draft", provenance: contribution({kind: "human", method: "Auditable consolidation of duplicate corrective actions"}), consolidatedFrom: actionIds,...reviewerAssignment,...(first.cycleId?{cycleId:first.cycleId}:{}),...(originals.some(item=>item.monitoringObligationIds)?{monitoringObligationIds:union("monitoringObligationIds")}:{} )});
            for (const previous of originals) {const {history, ...fields} = previous;save("actions", previous, {...fields, status: "superseded", approvalStatus: "draft", supersededBy: replacement.id, supersededAt: instant(), supersededByActor: actorId, supersededStatement: statement});}
            for (const dependent of [...view.actions]) if (!actionIds.includes(dependent.id) && dependent.id !== replacement.id && dependent.dependencies.some(value => actionIds.includes(value))) {
              const {history, ...fields} = dependent;save("actions", dependent, {...fields, dependencies: [...new Set(dependent.dependencies.map(value => actionIds.includes(value) ? replacement.id : value))], approvalStatus: "draft"});
            }
            break;
          }
          case "obligation-save": {
            assertRole(core, actorId, authorRoles);const previous = previousFor("obligations", command.id), source = sourceFor(project, command.sourceVersionId), provenance = contribution(command.provenance);
            assert(command.status !== "confirmed", "Contractual candidates require a separate human obligation-confirm decision.");
            save("obligations", previous, {text: text(command.text, "Contractual scope obligation", {required: true}), sourceVersionId: source.id, sourceSha256: source.sha256, locator: text(command.locator, "Agreement / ToR locator", {required: true}), deliverableIds: stringList(command.deliverableIds, "Obligation deliverables", 100), status: "candidate", provenance});break;
          }
          case "obligation-confirm": {
            assertRole(core, actorId, authorRoles);const previous = previousFor("obligations", command.obligationId);assert(previous, "Choose a contractual candidate.");const {history, ...fields} = previous;
            save("obligations", previous, {...fields, status: "confirmed", confirmedBy: actorId, confirmedAt: instant(), confirmationStatement: text(command.statement, "Human contractual scope verification", {required: true})});break;
          }
          case "mapping-save": {
            assertRole(core, actorId, ["reviewer"]);const previous = previousFor("mappings", command.id);
            save("mappings", previous, {sourceRequirementId: command.sourceRequirementId, targetRequirementId: command.targetRequirementId, relation: command.relation, rationale: text(command.rationale, "Crosswalk relationship rationale", {required: true}), version: text(command.version || "1", "Crosswalk version", {required: true, max: 100}),...(previous?.reviewStatus!==undefined?{reviewStatus:"reviewed"}:{}), reviewedBy: actorId, reviewedAt: instant()});break;
          }
          case "attest": {
            materialChange = false;const kind = choice(command.kind, ["assessor", "technical", "client_acceptance"], "attestation kind"), role = {assessor: "preparer", technical: "reviewer", client_acceptance: "client"}[kind];assertRole(core, actorId, [role]);
            if(command.cycleId){const cycle=view.cycles.find(item=>item.id===command.cycleId);assert(cycle,"Select the monitoring cycle.");assert(kind==="client_acceptance"?["approved","published"].includes(cycle.status)&&command.baselineId===cycle.baselineId:["under_review","reviewed"].includes(cycle.status),"Attest to the cycle's exact current review or approved baseline.");save("approvals",null,{kind,role,actorId,statement:text(command.statement,"Cycle professional attestation",{required:true}),at:instant(),contentRevision:cycle.contentRevision,cycleId:cycle.id,authority:"Declared local professional role; monitoring cycle",...(kind==="client_acceptance"?{baselineId:cycle.baselineId}:{})});break;}
            if (kind === "client_acceptance") assert(["approved", "published"].includes(core.status) && command.baselineId === core.workingBaselineId, "Client acceptance must identify the current approved baseline.", 409);
            else assert(["under_review", "reviewed"].includes(core.status), "Complete source review before submitting professional attestations.", 409);
            save("approvals", null, {kind, role, actorId, statement: text(command.statement, "Substantive professional attestation", {required: true}), at: instant(), contentRevision: core.contentRevision, authority: "Declared local professional role; OS-owner repository", ...(kind === "client_acceptance" ? {baselineId: command.baselineId} : {})});break;
          }
          case "transition": {
            materialChange = false;const next = choice(command.status, engagementStatuses.filter(value => value !== "draft"), "workflow transition"), allowed = {draft: "ready", ready: "under_review", under_review: "reviewed", reviewed: "approved", approved: "published", published: "superseded"};
            assert(allowed[core.status] === next, `Move from ${core.status} to ${allowed[core.status] || "a successor draft"} in the controlled review lifecycle.`, 409);
            const role = {ready: "preparer", under_review: "reviewer", reviewed: "reviewer", approved: "approver", published: "approver", superseded: "approver"}[next];assertRole(core, actorId, [role]);
            text(command.statement, "Workflow transition attestation", {required: true});
            if (next === "ready") {assert(view.requirements.length && view.requirements.every(requirement => view.findings.some(finding => finding.requirementId === requirement.id && !finding.cycleId)), "Prepare a due-diligence finding for every selected requirement before review; monitoring-period findings remain separate.", 409);}
            if (["reviewed", "approved"].includes(next)) assertReviewed({...view, ...core});
            if (next === "approved") {
              assert(view.baselines.length < 100, "This engagement has reached its 100-baseline limit; retain and start a successor engagement.", 413);
              assertAvailable(core.projectId, [...validateGraph({...view, ...core}, project,{originArchiveContext})]);
              const baselineId = nextId(), previousBaselineId = core.latestBaselineId;
              save("approvals", null, {kind: "authorization", role: "approver", actorId, statement: text(command.statement, "Authorization attestation", {required: true}), at: instant(), contentRevision: core.contentRevision, baselineId, authority: "Declared local approver role; OS-owner repository"});
              for (const action of view.actions) if (action.approvalStatus !== "approved") {const {history, ...fields} = action;save("actions", action, {...fields, approvalStatus: "approved"});}
              core.workingBaselineId = baselineId;core.latestBaselineId = baselineId;newSnapshot = {id: baselineId, previousBaselineId};
            }
            if (next === "published") {
              assert(core.workingBaselineId && (!core.clientAcceptanceRequired || view.approvals.some(item => item.kind === "client_acceptance" && item.baselineId === core.workingBaselineId)), "Obtain separately recorded client acceptance of the approved version before publication.", 409);
              const baseline = view.baselines.find(item => item.id === core.workingBaselineId);
              save("publications", null, {baselineId: baseline.id, contentRevision: baseline.engagement.contentRevision, formats: stringList(command.formats || ["pdf", "docx", "xlsx", "csv", "json"], "Publication formats", 10, 20), publishedBy: actorId, publishedAt: instant(), statement: command.statement, snapshotSha256: baseline.sha256});
            }
            core.status = next;break;
          }
          default: {const result=applyMonitoringCommand({command,core,view,project,actorId,save,previousFor,contribution,assertRole,assertAvailable,authenticated:Boolean(authentication),caseProtection,originArchiveContext,now:instant,newId:nextId});assert(result.handled,"Unknown engagement command.");materialChange=result.material;newSnapshot=result.newSnapshot;}
        }
        if(materialChange&&command.type!=="cycle-save"){
          const cycleIds=new Set([command.cycleId,...pending.filter(([name])=>["findings","actions","submissions","requests","measurements","missions","events","verifications"].includes(name)).map(([,record])=>record.cycleId)].filter(Boolean));
          const changedPrograms=new Set(pending.filter(([name])=>["programs","monitoringObligations","indicators","events"].includes(name)).map(([name,record])=>name==="programs"?record.id:record.programId).filter(Boolean));
          for(const cycle of view.cycles)if(changedPrograms.has(cycle.programId)&&!["approved","published"].includes(cycle.status))cycleIds.add(cycle.id);
          for(const cycleId of cycleIds){const cycle=view.cycles.find(item=>item.id===cycleId);if(cycle){const {history,...fields}=cycle;save("cycles",cycle,{...fields,contentRevision:cycle.contentRevision+1,status:command.type==="finding-review"&&cycle.status==="under_review"?"under_review":"draft"});}}
        }
        if (materialChange) material(core, command);
        core.revision++;core.updatedAt = instant();core.updatedBy = actorId;
        const complete = {...view, ...core};validateGraph(complete, project,{originArchiveContext});
        assert(Buffer.byteLength(JSON.stringify(complete)) <= 24 * 1024 * 1024, "Engagement working records exceed 24 MiB; retain and start a successor engagement.", 413);
        for (const [name, record] of pending) putEntity(name, core.id, record);
        writeCore(core);
        const reviewedFinding = command.type === "finding-review" ? view.findings.find(record => record.id === command.findingId) : null;
        appendAudit(core, actorId, command.type, changed, reviewedFinding ? {findingId: reviewedFinding.id, findingRevision: reviewedFinding.revision, decision: reviewedFinding.reviewDecision, statement: reviewedFinding.reviewStatement} : undefined, command.type === "accept-role-assignment" ? {role: command.role, userId: actorId} : undefined, command.type === "register-sources" ? command.versionIds.map(versionId=>({versionId,sha256:sourceFor(project,versionId).sha256})) : undefined);
        if (newSnapshot) {
          const snapshot = fullSnapshot(core, {...entities(core.id), ...core}, newSnapshot.id, newSnapshot.previousBaselineId,newSnapshot.scope);
          db.prepare("INSERT INTO engagement_baselines(id,engagement_id,json) VALUES(?,?,?)").run(snapshot.id, core.id, JSON.stringify(snapshot));
        }
        const result=viewOf(core,project);
        return offline?{...result,offlineReceipt:{...offline.receipt,revision:result[offline.name].find(record=>record.id===command.id).revision,acknowledged:true}}:result;
      });
    },
    exportProject(projectId) {getProject(sourceId(projectId));return db.prepare("SELECT id FROM engagements WHERE project_id=? ORDER BY rowid").all(projectId).map(row => exportOne(row.id));},
    validateImport(project, packages) {return validatePackage(project, packages);},
    importProject(projectId, packages) {
      const project = getProject(sourceId(projectId)), checked = validatePackage(project, packages);
      return transaction(() => {for (const pack of checked) {
        if (db.prepare("SELECT id FROM engagements WHERE id=?").get(pack.engagement.id)) continue;
        writeCore(pack.engagement);for(const name of engagementOptionalEntityNames)if(Object.hasOwn(pack.entities,name))db.prepare('INSERT OR IGNORE INTO engagement_optional_registers(engagement_id,name) VALUES(?,?)').run(pack.engagement.id,name);for (const name of engagementEntityNames) for (const record of pack.entities[name]||[]) putEntity(name, pack.engagement.id, record);
        for (const snapshot of pack.baselines) db.prepare("INSERT INTO engagement_baselines(id,engagement_id,json) VALUES(?,?,?)").run(snapshot.id, pack.engagement.id, JSON.stringify(snapshot));
        for (const entry of pack.audit) db.prepare("INSERT INTO engagement_audit(id,engagement_id,sequence,json) VALUES(?,?,?,?)").run(entry.id, pack.engagement.id, entry.sequence, JSON.stringify(entry));
        issued.import(pack.issuedRenditions||[]);
      }return {engagements: checked.map(pack => viewOf(pack.engagement, project))};});
    },
    close() {db.close();}
  };
  return service;
}
