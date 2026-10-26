import {validateSourceFormAcceptance} from './source-form-acceptance.js';

// Qualification records attest a declared work-product scope. They neither
// certify a person's credentials nor grant publisher rights or project authority.
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const string = (value, label, max = 4000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw Error(`${label} requires bounded nonempty text.`);
  return value.trim();
};
const date = (value, label) => {if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw Error(`${label} requires an ISO date.`);return new Date(value).toISOString();};
export const PILOT_PHASES = Object.freeze(['preparation', 'assessment', 'correction', 'independent_review', 'report_production', 'handover']);
export const PRACTITIONER_TASKS = Object.freeze([
  ['create_engagement', 'Create an engagement'], ['import_documents', 'Import documents'],
  ['select_requirements', 'Select requirements'], ['gap_assessment', 'Perform the gap assessment'],
  ['review_ai_findings', 'Review AI findings or record AI disabled'], ['corrective_actions', 'Create corrective actions'],
  ['approve_report', 'Review and approve a report'], ['export_handover', 'Export a handover'],
  ['subsequent_monitoring', 'Continue a monitoring period'], ['restore_backup', 'Restore the backup']
].map(([id, label]) => Object.freeze({id, label})));

/** An observation is a declared study record, never professional approval. */
export function validatePractitionerObservation(input = {}) {
  if (!['actual_practitioner', 'synthetic_rehearsal'].includes(input.observationMode)) throw Error('Label the observation as an actual practitioner or synthetic rehearsal.');
  if (!digest(input.datasetSha256) || !digest(input.acceptanceCriteriaSha256) || !digest(input.observationProtocolSha256) || !/^[a-f0-9]{40}$/.test(input.sourceCommit || '')) throw Error('Pin the assignment dataset, acceptance criteria, observation protocol and exact source commit.');
  const startedAt = date(input.startedAt, 'Observation start'), endedAt = date(input.endedAt, 'Observation end');
  if (endedAt < startedAt) throw Error('Observation end must follow its start.');
  const participantId = string(input.participantId, 'Participant reference', 300), observerId = string(input.observerId, 'Observer reference', 300);
  if (input.observationMode === 'actual_practitioner' && participantId === observerId) throw Error('An observed practitioner study needs a separate observer. Self-rehearsals must stay labelled as rehearsals.');
  if (!Array.isArray(input.tasks) || input.tasks.length !== PRACTITIONER_TASKS.length || new Set(input.tasks.map(row => row?.taskId)).size !== PRACTITIONER_TASKS.length) throw Error('Record all ten observed tasks exactly once, including tasks not attempted.');
  const seconds = (value, label) => {if (!Number.isSafeInteger(value) || value < 0 || value > 365 * 86400) throw Error(`${label} requires bounded observed seconds.`);return value;};
  const tasks = PRACTITIONER_TASKS.map(({id:taskId}) => {
    const row = input.tasks.find(row => row.taskId === taskId);
    if (!row || !['completed', 'assisted', 'failed', 'not_attempted'].includes(row.outcome)) throw Error('Every task needs a completion outcome.');
    const activeSeconds = seconds(row.activeSeconds, 'Active time'), waitSeconds = seconds(row.waitSeconds, 'Wait time'), correctionSeconds = seconds(row.correctionSeconds, 'Correction time'), assistanceSeconds = seconds(row.assistanceSeconds, 'Assistance time');
    if (correctionSeconds > activeSeconds || assistanceSeconds > activeSeconds) throw Error('Correction and assistance time are included within active time, not added again.');
    if (!Number.isSafeInteger(row.corrections) || row.corrections < 0 || row.corrections > 100000) throw Error('Record a bounded substantive correction count.');
    if (!Array.isArray(row.failures) || row.failures.length > 50 || row.outcome === 'failed' && !row.failures.length) throw Error('A failed task requires a failure record.');
    const failures = row.failures.map(failure => ({symptom:string(failure.symptom, 'Task failure'), impact:string(failure.impact, 'Failure impact'), reproduction:string(failure.reproduction, 'Sanitized reproduction'), evidenceReference:string(failure.evidenceReference, 'Failure evidence reference', 2000), ...(failure.retestReference ? {retestReference:string(failure.retestReference, 'Retest reference', 2000)} : {})}));
    if (row.outcome === 'not_attempted' && (activeSeconds || waitSeconds || correctionSeconds || assistanceSeconds || row.corrections || failures.length)) throw Error('A task not attempted has no measured work; record its reason.');
    return {taskId, outcome:row.outcome, activeSeconds, waitSeconds, correctionSeconds, assistanceSeconds, corrections:row.corrections, failures, evidenceReference:string(row.evidenceReference, row.outcome === 'not_attempted' ? 'Reason task was not attempted' : 'Task evidence reference', 2000), feedback:string(row.feedback, 'Task feedback', 4000)};
  });
  if(tasks.reduce((sum,row)=>sum+row.activeSeconds+row.waitSeconds,0)>(Date.parse(endedAt)-Date.parse(startedAt))/1000)throw Error('Sequential task active and waiting time cannot exceed the observed session duration.');
  return {format:'esia-practitioner-task-observation', schemaVersion:1, assignmentId:string(input.assignmentId, 'Assignment id', 192), observationMode:input.observationMode, participantId, observerId, recorderId:string(input.recorderId, 'Recorder identity', 300), consentReference:input.observationMode === 'actual_practitioner' ? string(input.consentReference, 'Consent/reference for private observation record', 2000) : null, sourceCommit:input.sourceCommit, deploymentProfile:string(input.deploymentProfile, 'Observed deployment profile', 300), datasetSha256:input.datasetSha256, acceptanceCriteriaSha256:input.acceptanceCriteriaSha256, observationProtocolSha256:input.observationProtocolSha256, startedAt, endedAt, unfamiliarPractitioner:input.unfamiliarPractitioner === true, tasks, totals:{activeSeconds:tasks.reduce((sum,row)=>sum+row.activeSeconds,0), waitSeconds:tasks.reduce((sum,row)=>sum+row.waitSeconds,0), correctionSeconds:tasks.reduce((sum,row)=>sum+row.correctionSeconds,0), assistanceSeconds:tasks.reduce((sum,row)=>sum+row.assistanceSeconds,0), corrections:tasks.reduce((sum,row)=>sum+row.corrections,0), failures:tasks.reduce((sum,row)=>sum+row.failures.length,0)}, overallFeedback:string(input.overallFeedback, 'Overall feedback'), priorityFix:string(input.priorityFix, 'Priority improvement'), independentPractitionerAcceptance:false, professionalApprovalGranted:false, identityVerified:false, authority:'Declared observation only; professional qualification, report approval and independently verified identity remain separate.'};
}
export const QUALIFICATION_WORK_PRODUCTS = Object.freeze(['gap_report', 'action_plan', 'periodic_monitoring', 'environmental_monitoring', 'social_safeguards', 'direct_investment_monitoring', 'financial_intermediary_monitoring', 'completion_assessment']);

export function qualificationIdentity({id, revision, frameworkId, edition, workProducts, sources, mappings, rendering, scopeStatement, exclusions = []} = {}) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw Error('A positive qualification revision is required.');
  if (!Array.isArray(workProducts) || !workProducts.length || workProducts.some(v => !QUALIFICATION_WORK_PRODUCTS.includes(v)) || new Set(workProducts).size !== workProducts.length) throw Error('Select distinct supported work products.');
  if (!Array.isArray(sources) || !sources.length || sources.length > 100 || sources.some(v => !digest(v?.sha256) || !v.locator || !v.versionId || !v.classification) || new Set(sources.map(v => v.versionId)).size !== sources.length) throw Error('Pin each exact source version, SHA-256, classification and locator.');
  if (!Array.isArray(mappings) || !mappings.length || mappings.length > 2000 || mappings.some(v => !v?.id || !v.sourceVersionId || !v.sourceLocator || !v.label || !['direct', 'calculated', 'repeating', 'narrative', 'conditional', 'extension'].includes(v.kind)) || new Set(mappings.map(v => v.id)).size !== mappings.length) throw Error('Provide distinct source-linked mapping rows.');
  const sourceIds = new Set(sources.map(v => v.versionId));
  if (mappings.some(v => !sourceIds.has(v.sourceVersionId))) throw Error('Every mapping must refer to an exact declared source version.');
  if (!rendering?.id || !Number.isSafeInteger(rendering.revision) || rendering.revision < 1 || !digest(rendering.specificationSha256)) throw Error('Pin the versioned rendering specification.');
  if (!Array.isArray(exclusions) || exclusions.length > 100 || exclusions.some(value => typeof value !== 'string' || !value.trim() || value.length > 2000)) throw Error('Declare bounded qualification exclusions.');
  return {id:string(id, 'Qualification id', 192), revision, frameworkId:string(frameworkId, 'Framework', 192), edition:string(edition, 'Framework edition', 300), workProducts:[...workProducts], sources:structuredClone(sources), mappings:structuredClone(mappings), rendering:structuredClone(rendering), ...(scopeStatement ? {scopeStatement:string(scopeStatement, 'Declared work-product scope')} : {}), exclusions:[...exclusions]};
}

export function professionalQualificationPacket({definition, definitionSha256, mappingSha256, sourceVerification = [], preparedBy, requiredSourceFormInstrumentIds = [], context = null, outputs = []} = {}) {
  const identity = qualificationIdentity(definition);
  if (!digest(definitionSha256) || !digest(mappingSha256)) throw Error('Pin the exact definition and mapping digests.');
  if (!Array.isArray(requiredSourceFormInstrumentIds) || new Set(requiredSourceFormInstrumentIds).size !== requiredSourceFormInstrumentIds.length || requiredSourceFormInstrumentIds.some(id => typeof id !== 'string' || !id.trim())) throw Error('Required source-form approvals need distinct existing instrument identities.');
  if(!Array.isArray(outputs)||outputs.length>20||new Set(outputs.map(row=>row?.id)).size!==outputs.length||outputs.some(row=>!row?.id||!digest(row.sha256)||!Number.isSafeInteger(row.byteLength)||row.byteLength<1||!['html','docx','xlsx','pdf','json'].includes(row.format)))throw Error('Pin distinct actual generated output byte hashes and formats.');
  if(context!==null&&(!context.accountId||!context.projectId||!context.engagementId||!digest(context.projectSha256)||!digest(context.engagementSha256)||!digest(context.rightsSha256)||!context.baselineId||!digest(context.baselineSha256)))throw Error('Pin the current account, project, engagement, rights and approved baseline context.');
  return {format:'esia-professional-qualification-packet', schemaVersion:1, ...identity, definitionSha256, mappingSha256, context:structuredClone(context),outputs:structuredClone(outputs),requiredSourceFormInstrumentIds:[...requiredSourceFormInstrumentIds], preparedBy:string(preparedBy, 'Packet preparer', 300), sourceVerification:identity.sources.map(source => {
    const result = sourceVerification.find(v => v.versionId === source.versionId && v.sha256 === source.sha256);
    return {versionId:source.versionId, sha256:source.sha256, retained:result?.retained === true, hashVerified:result?.hashVerified === true, rightsAllowed:result?.rightsAllowed === true};
  }), professionalApprovalClaimed:false, credentialsVerified:false};
}

export function validateProfessionalQualificationReview({packet, input, actor, reviewedAt} = {}) {
  if (packet?.format !== 'esia-professional-qualification-packet' || !input || input.definitionSha256 !== packet.definitionSha256 || input.mappingSha256 !== packet.mappingSha256) throw Error('The exact source, mapping or rendering definition changed; reload the qualification packet.');
  const reviewerName = string(actor?.name, 'Named professional reviewer', 300), reviewerId = string(actor?.id, 'Reviewer identity', 300);
  if (reviewerId === packet.preparedBy || reviewerName === packet.preparedBy || input.independenceAttested !== true) throw Error('A reviewer independent of the packet preparer must attest independence.');
  if (actor?.kind === 'simulation' || actor?.kind === 'ai' || input.reviewMode !== 'human') throw Error('Professional qualification requires a named human attestation; simulation and AI decisions do not qualify.');
  if (packet.sourceVerification.some(v => !v.retained || !v.hashVerified || !v.rightsAllowed)) throw Error('Qualification requires every permitted exact retained original, verified by hash.');
  if (input.sourceReviews?.length !== packet.sources.length || new Set(input.sourceReviews?.map(v => v.versionId)).size !== packet.sources.length) throw Error('Inspect and review every exact original once.');
  const sourceReviews = packet.sources.map(source => {
    const row = input.sourceReviews.find(v => v.versionId === source.versionId);
    if (row?.sha256 !== source.sha256 || row.examined !== true || row.classificationConfirmed !== true || row.rightsReviewed !== true) throw Error('Attest original examination, classification and rights for each exact source hash.');
    return {versionId:source.versionId, sha256:source.sha256, examined:true, classificationConfirmed:true, rightsReviewed:true, statement:string(row.statement, 'Source review rationale', 2000)};
  });
  // Keep the existing source-form attestation contract for field/section scope,
  // qualifications and exclusions. A packet can cover all eight report families.
  const sourceForm = validateSourceFormAcceptance({packet:{instrumentId:packet.id, definitionRevision:packet.revision, definitionSha256:packet.definitionSha256, sourceSha256:packet.sources[0].sha256, sourceAvailable:true, rightsAllowed:true, fields:packet.mappings.map(v => ({fieldId:v.id})), sections:packet.workProducts.map(v => ({sectionId:v}))}, input:{...input, sourceSha256:packet.sources[0].sha256}, reviewedBy:reviewerName, reviewedAt:date(reviewedAt, 'Review time')});
  if (input.renderingExamined !== true || input.testOutputsExamined !== true) throw Error('Inspect the pinned rendering specification and representative outputs.');
  if(!packet.outputs?.length||input.renderingSpecificationSha256!==packet.rendering.specificationSha256||input.outputReviews?.length!==packet.outputs.length||new Set(input.outputReviews.map(row=>row.id)).size!==packet.outputs.length)throw Error('Examine every actual hash-pinned output and the exact rendering specification.');
  const outputReviews=packet.outputs.map(output=>{const row=input.outputReviews.find(row=>row.id===output.id);if(row?.sha256!==output.sha256||row.examined!==true)throw Error('Output review must identify the exact generated bytes.');return {id:output.id,sha256:output.sha256,examined:true,statement:string(row.statement,'Output examination rationale',2000)};});
  return {format:'esia-professional-qualification-review', schemaVersion:1, qualificationId:packet.id, revision:packet.revision, definitionSha256:packet.definitionSha256, mappingSha256:packet.mappingSha256,renderingSpecificationSha256:packet.rendering.specificationSha256,outputReviews,context:structuredClone(packet.context||null), reviewerId, reviewerName, identityBasis:actor?.identityBasis || 'operator_supplied_attestation', independenceAttested:true, reviewMode:'human', sourceReviews, renderingExamined:true, testOutputsExamined:true, professionalRole:sourceForm.professionalRole, qualifications:sourceForm.qualifications, scope:sourceForm.scope, scopeStatement:sourceForm.scopeStatement, fieldReviews:sourceForm.fieldReviews, sectionReviews:sourceForm.sectionReviews, exclusionCount:sourceForm.exclusionCount, reviewedAt:sourceForm.reviewedAt, credentialsVerified:false, attestationKind:sourceForm.attestationKind};
}

export function sourceFormApprovalReference({instrument, definitionSha256} = {}) {
  const record = instrument?.approval?.professionalAcceptance;
  if (instrument?.approval?.status !== 'approved' || record?.format !== 'esia-source-form-professional-acceptance' || record.instrumentId !== (instrument.instrumentId || instrument.id) || record.definitionRevision !== (instrument.definitionRevision || 1) || !digest(definitionSha256) || record.definitionSha256 !== definitionSha256 || record.sourceSha256 !== instrument.source?.sha256 || !record.sourceExamined || !record.applicabilityReviewed || !record.reviewerName || !record.reviewedAt) return null;
  return {instrumentId:record.instrumentId, definitionRevision:record.definitionRevision, definitionSha256:record.definitionSha256, sourceSha256:record.sourceSha256, reviewerName:record.reviewerName, reviewedAt:record.reviewedAt, scope:record.scope, authority:'existing_source_form_professional_acceptance', credentialsVerified:false};
}

export function qualificationPreflightFromSourceForm({instrument, definitionSha256, mappingSha256, rendering, frameworkId, edition, workProducts = ['periodic_monitoring'], sourceAvailable = false, rightsAllowed = false, preparedBy = 'existing-source-form-definition'} = {}) {
  if (!instrument?.source?.sha256 || !Array.isArray(instrument.fields) || !instrument.fields.length) throw Error('Select an existing source-form instrument with its exact retained source.');
  const sourceVersionId = instrument.resourceVersionId;
  const mappings = instrument.fields.map(field => ({id:field.id, label:field.label, sourceVersionId, sourceLocator:field.sourceLocator || instrument.source.locator, canonicalPath:field.canonicalPath || null, kind:field.canonicalPath ? field.type === 'table' ? 'repeating' : 'direct' : 'extension', extensionProposal:field.extensionProposal || null}));
  const packet = professionalQualificationPacket({definition:{id:instrument.id, revision:instrument.definitionRevision || 1, frameworkId, edition, workProducts, sources:[{versionId:sourceVersionId, sha256:instrument.source.sha256, classification:instrument.authorityCategory || instrument.kind || 'source_classification_requires_review', locator:instrument.source.locator}], mappings, rendering, scopeStatement:'Preflight projection over the existing source-form definition and approval receipt. Work-product rendering qualification is assessed separately.'}, definitionSha256, mappingSha256, preparedBy, requiredSourceFormInstrumentIds:[instrument.id], sourceVerification:[{versionId:sourceVersionId, sha256:instrument.source.sha256, retained:sourceAvailable, hashVerified:sourceAvailable, rightsAllowed}]});
  const approvalReference = sourceFormApprovalReference({instrument, definitionSha256});
  return {packet, sourceFormApprovalReference:approvalReference, existingMappingAccepted:Boolean(approvalReference), newApprovalGranted:false, workProductQualificationClaimed:false, readiness:professionalQualificationReadiness(packet, [], {sourceFormApprovals:[{instrument, definitionSha256}]})};
}

export function professionalQualificationReadiness(packet, reviews = [], {sourceFormApprovals = []} = {}) {
  const outputsReady=packet.outputs?.length>0;
  const current = reviews.filter(review => review.registryAuthorityCurrent!==false && review.format === 'esia-professional-qualification-review' && review.qualificationId === packet.id && review.revision === packet.revision && review.definitionSha256 === packet.definitionSha256 && review.mappingSha256 === packet.mappingSha256 && review.renderingSpecificationSha256===packet.rendering.specificationSha256 && JSON.stringify(review.context||null)===JSON.stringify(packet.context||null) && outputsReady && review.outputReviews?.length===packet.outputs.length && new Set(review.outputReviews.map(row=>row.id)).size===packet.outputs.length && review.outputReviews.every(row=>row.examined&&row.statement&&packet.outputs.some(output=>output.id===row.id&&output.sha256===row.sha256)) && review.reviewMode === 'human' && review.independenceAttested && review.reviewerId && review.reviewerName && review.reviewedAt && review.reviewerId !== packet.preparedBy && review.sourceReviews?.length === packet.sources.length && review.sourceReviews.every(row => packet.sources.some(source => source.versionId === row.versionId && source.sha256 === row.sha256)));
  const sourcesReady = packet.sourceVerification.every(v => v.retained && v.hashVerified && v.rightsAllowed);
  const references = sourceFormApprovals.map(sourceFormApprovalReference).filter(Boolean), missingSourceFormApprovals = (packet.requiredSourceFormInstrumentIds || []).filter(id => !references.some(v => v.instrumentId === id));
  const accepted = sourcesReady && current.length > 0 && missingSourceFormApprovals.length === 0;
  return {status:accepted ? current.some(v => v.scope === 'complete') ? 'accepted_declared_scope' : 'accepted_limited_scope' : 'awaiting_professional_review', accepted, currentReviewCount:current.length, staleReviewCount:reviews.length - current.length, sourceFormApprovalReferences:references, missingSourceFormApprovals, credentialsVerified:false, templateApprovalGranted:false,projectApprovalGranted:false, blockers:[...(!sourcesReady ? ['Exact source retention, hash verification or permitted use is incomplete.'] : []),...(!outputsReady?['Actual rendered output examples have not been captured and hashed.']:[]), ...(!current.length ? ['No current independent named professional review covers this exact source/mapping/rendering/output revision.'] : []), ...(missingSourceFormApprovals.length ? ['Required current source-form approval receipts are missing from the existing library authority.'] : [])]};
}

export function validatePilotMeasurement(input = {}) {
  const method = input.method;
  if (!['esia_review', 'word_excel'].includes(method) || !digest(input.datasetSha256) || !digest(input.acceptanceCriteriaSha256)) throw Error('Pilot comparison requires a pinned dataset, acceptance criteria and explicit E&S Review or Word/Excel method.');
  if (!Array.isArray(input.phases) || input.phases.length !== PILOT_PHASES.length || new Set(input.phases.map(v => v.phase)).size !== PILOT_PHASES.length) throw Error('Measure each assignment phase exactly once.');
  const phases = PILOT_PHASES.map(phase => {
    const row = input.phases.find(v => v.phase === phase);
    if (!row || !Number.isSafeInteger(row.activeSeconds) || row.activeSeconds < 0 || row.activeSeconds > 365 * 86400 || !Number.isSafeInteger(row.corrections) || row.corrections < 0 || row.corrections > 100000) throw Error('Each phase needs bounded observed active seconds and correction count.');
    return {phase, activeSeconds:row.activeSeconds, corrections:row.corrections, evidenceReference:string(row.evidenceReference, 'Measurement evidence reference', 2000)};
  });
  if (typeof input.reviewAccepted !== 'boolean') throw Error('Record whether independent review accepted the resulting work.');
  return {format:'esia-assignment-pilot-measurement', schemaVersion:1, assignmentId:string(input.assignmentId, 'Assignment id', 192), operatorId:string(input.operatorId, 'Practitioner identity', 300), method, datasetSha256:input.datasetSha256, acceptanceCriteriaSha256:input.acceptanceCriteriaSha256, measuredAt:date(input.measuredAt, 'Measurement date'), phases, activeSeconds:phases.reduce((n, row) => n + row.activeSeconds, 0), corrections:phases.reduce((n, row) => n + row.corrections, 0), reviewAccepted:input.reviewAccepted, reviewEvidenceReference:string(input.reviewEvidenceReference, 'Independent review evidence', 2000), unfamiliarPractitioner:input.unfamiliarPractitioner === true, assistanceSeconds:Number.isSafeInteger(input.assistanceSeconds) && input.assistanceSeconds >= 0 ? input.assistanceSeconds : null, handoverReceipt:input.handoverReceipt || null};
}

export function comparePilotMeasurements(app, baseline) {
  const left = validatePilotMeasurement(app), right = validatePilotMeasurement(baseline);
  const comparable = left.method === 'esia_review' && right.method === 'word_excel' && left.assignmentId === right.assignmentId && left.datasetSha256 === right.datasetSha256 && left.acceptanceCriteriaSha256 === right.acceptanceCriteriaSha256 && left.reviewAccepted && right.reviewAccepted;
  return {comparable, reason:comparable ? null : 'Both methods must complete independent review on the same assignment, dataset and acceptance criteria.', appActiveSeconds:left.activeSeconds, baselineActiveSeconds:right.activeSeconds, savedSeconds:comparable ? right.activeSeconds - left.activeSeconds : null, savedFraction:comparable && right.activeSeconds > 0 ? (right.activeSeconds - left.activeSeconds) / right.activeSeconds : null, appCorrections:left.corrections, baselineCorrections:right.corrections, handoverVerified:left.handoverReceipt?.format === 'esia-verified-pilot-handover' && left.handoverReceipt?.passed === true && left.handoverReceipt.datasetSha256 === left.datasetSha256, handoverVerificationScope:left.handoverReceipt?.verificationScope || 'declared_exact_artifact_versions', fullAssignmentHandoverProven:false, assistanceSeconds:left.assistanceSeconds};
}
