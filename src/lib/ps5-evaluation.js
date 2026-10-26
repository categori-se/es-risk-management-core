import {validateEsAiOutput} from './es-ai-contracts.js';
import {getEsAiSkill} from './es-ai-skills.js';

const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value, label, maximum = 4000) => {if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw Error(`${label} requires bounded nonempty text.`);return value.trim();};
const judgments = ['compliant', 'partially_compliant', 'noncompliant', 'undetermined'];
export const ps5GoldMetricCoverage=labels=>{
 const rows=labels?.requirements||[];return {requirements:rows.length,materialDeficiencies:rows.filter(row=>row.materialDeficiency===true).length,falseComplianceOpportunities:rows.filter(row=>!row.judgments?.includes('compliant')).length,citationOpportunities:new Set(rows.flatMap(row=>[...(row.supportingPassageIds||[]),...(row.contradictoryPassageIds||[])])).size,contradictoryPassages:rows.reduce((sum,row)=>sum+(row.contradictoryPassageIds||[]).length,0),expectedAbstentions:rows.filter(row=>row.abstentionExpected===true).length,assessableRequirements:rows.filter(row=>row.abstentionExpected===false&&row.judgments?.some(value=>['compliant','partially_compliant','noncompliant'].includes(value))).length};
};
const goldMetricCoverage=ps5GoldMetricCoverage;
function acceptanceCoverage({labels,caseSplit,independentGold,goldReview}){
 const counts=goldMetricCoverage(labels),independentlyAdjudicated=independentGold&&goldReview.caseSplit===caseSplit&&Object.entries(counts).every(([key,value])=>goldReview.metricCoverage?.[key]===value),categories={holdoutCase:caseSplit==='holdout',independentHumanAdjudication:independentlyAdjudicated,materialDeficiencies:independentlyAdjudicated&&counts.materialDeficiencies>0,falseCompliance:independentlyAdjudicated&&counts.falseComplianceOpportunities>0,citations:independentlyAdjudicated&&counts.citationOpportunities>0,contradictions:independentlyAdjudicated&&counts.contradictoryPassages>0,appropriateAbstention:independentlyAdjudicated&&counts.expectedAbstentions>0,nonAbstentionAssessment:independentlyAdjudicated&&counts.assessableRequirements>0},missingCategories=Object.entries(categories).filter(([,covered])=>!covered).map(([key])=>key);
 return {format:'esia-ps5-quality-acceptance-coverage',schemaVersion:1,caseSplit:caseSplit||'unspecified',independentlyAdjudicated,labelCountBasis:independentlyAdjudicated?'independent_human_adjudication_of_exact_dataset_and_rubric':'unadjudicated_or_unpinned_labels_not_acceptance_evidence',counts,categories,missingCategories,complete:missingCategories.length===0,scope:'Every required metric must have a positive independently adjudicated denominator in this held-out case. Missing categories require a new suitable source case; compatible plans and unresolved implementation are not automatically contradictory.'};
}
export function validatePublicPs5Dataset(dataset) {
  if (dataset?.format !== 'esia-public-ps5-evaluation' || dataset.schemaVersion !== 1 || !dataset.id || !Number.isSafeInteger(dataset.revision) || dataset.revision < 1 || !Array.isArray(dataset.cases) || dataset.cases.length < 2 || dataset.cases.length > 20) throw Error('Use a versioned, bounded real-public-document PS5 evaluation dataset.');
  const ids = new Set(), projects = new Map(), sources = new Map();
  for (const item of dataset.cases) {
    if (!item?.id || ids.has(item.id) || !['development', 'holdout'].includes(item.split) || !item.projectIdentity || !Array.isArray(item.passages) || !item.passages.length || item.passages.length > 40 || !Array.isArray(item.requirements) || !item.requirements.length || item.requirements.length > 10) throw Error('Cases need distinct identities, a project-level split and bounded evidence and requirements.');
    ids.add(item.id);
    if (projects.has(item.projectIdentity) && projects.get(item.projectIdentity) !== item.split) throw Error('The same project cannot appear in development and holdout.');
    projects.set(item.projectIdentity, item.split);
    const passageIds = new Set();
    for (const passage of item.passages) {
      if (!passage?.id || passageIds.has(passage.id) || !sha(passage.sourceSha256) || !passage.documentVersionId || !Number.isSafeInteger(passage.page) || passage.page < 1 || !passage.locator || !passage.sourceUrl || !passage.retainedRelativePath || passage.retainedRelativePath.startsWith('/') || passage.retainedRelativePath.split(/[\\/]/).includes('..')) throw Error('Every real passage needs an exact retained relative original, source hash/version, URL and PDF page locator.');
      if (sources.has(passage.sourceSha256) && sources.get(passage.sourceSha256) !== item.split) throw Error('The same original cannot appear in development and holdout.');
      sources.set(passage.sourceSha256, item.split);passageIds.add(passage.id);
    }
    if (new Set(item.requirements.map(v => v.id)).size !== item.requirements.length || item.requirements.some(v => !v.id || v.frameworkId !== 'ifc_ps_2012' || v.edition !== '2012' || v.standard !== 'PS5' || !v.text || !sha(v.policySource?.sha256) || !v.policySource?.locator)) throw Error('Pin each selected IFC PS5 2012 criterion to its exact policy source.');
  }
  if (!dataset.cases.some(v => v.split === 'development') || !dataset.cases.some(v => v.split === 'holdout')) throw Error('Keep separate development and holdout projects.');
  return dataset;
}

// This allowlist is the only model input projection. Labels, adjudication,
// expected outcomes, acceptance thresholds and reviewer records stay separate.
export function blindPs5EvaluationInput({dataset, caseId, passages} = {}) {
  validatePublicPs5Dataset(dataset);
  const item = dataset.cases.find(v => v.id === caseId);
  if (!item) throw Error('Select a declared public-document case.');
  if (!Array.isArray(passages) || passages.length !== item.passages.length || new Set(passages.map(v => v.id)).size !== passages.length) throw Error('Supply each verified exact passage once.');
  const evidence = item.passages.map(spec => {
    const value = passages.find(v => v.id === spec.id);
    if (!value || value.sourceSha256 !== spec.sourceSha256 || value.documentVersionId !== spec.documentVersionId || value.locator !== spec.locator || !value.quote || value.quote.length > 16000) throw Error('The extracted evidence differs from the retained public source manifest.');
    return {id:spec.id, documentVersionId:spec.documentVersionId, sourceSha256:spec.sourceSha256, locator:spec.locator, quote:value.quote, sourceClassification:spec.sourceClassification || 'public_project_source'};
  });
  return {question:'Assess every supplied IFC PS5 criterion using only these exact public source passages. This is a dated evidence-gap research task, not a determination of current project compliance or financing applicability. Separate coverage, adequacy, judgment and uncertainty; preserve contradictory evidence. Plans and promised audits do not establish implementation or outcomes. Return the skill JSON schema and remain ai_draft.', requirements:item.requirements.map(v => ({id:v.id, frameworkId:v.frameworkId, edition:v.edition, standard:v.standard, text:v.text, policySource:{sha256:v.policySource.sha256, locator:v.policySource.locator}})), passages:evidence, context:{realPublicDocuments:true, task:'bounded_ps5_evidence_gap_review', caseId:item.id, asOf:item.asOf, applicabilityDecision:'outside_evaluation_scope'}};
}

export function validatePs5GoldLabels({dataset,caseId,rubric}={}){
  validatePublicPs5Dataset(dataset);
  const item = dataset.cases.find(v => v.id === caseId), labels = rubric?.cases?.find(v => v.caseId === caseId);
  if(!item||!labels)throw Error('Select an exact case and its hidden criterion labels.');
  if (labels.requirements?.length !== item.requirements.length || new Set(labels.requirements.map(v => v.requirementId)).size !== item.requirements.length) throw Error('Gold labels must cover every selected requirement once.');
  const passageIds = new Set(item.passages.map(v => v.id));
  for (const label of labels.requirements) {
    if (!item.requirements.some(v => v.id === label.requirementId) || !Array.isArray(label.judgments) || !label.judgments.length || label.judgments.some(v => !judgments.includes(v)) || typeof label.materialDeficiency !== 'boolean' || typeof label.abstentionExpected !== 'boolean' || !Array.isArray(label.supportingPassageIds) || !Array.isArray(label.contradictoryPassageIds) || [...label.supportingPassageIds, ...label.contradictoryPassageIds].some(v => !passageIds.has(v)) || !label.rationale || !label.goldSource?.sha256 || !sha(label.goldSource.sha256) || !label.goldSource.locator) throw Error('Gold labels need judgments, materiality, abstention and exact supporting/contradictory source locators.');
    if(!item.passages.some(passage=>passage.sourceSha256===label.goldSource.sha256))throw Error('Each gold source must identify an exact original declared in this case.');
    if(new Set(label.judgments).size!==label.judgments.length||new Set(label.supportingPassageIds).size!==label.supportingPassageIds.length||new Set(label.contradictoryPassageIds).size!==label.contradictoryPassageIds.length)throw Error('Criterion judgments and evidence passage labels must be distinct.');
  }
  return {valid:true,metricCoverage:goldMetricCoverage(labels),professionalApprovalClaimed:false};
}

export function validatePs5GoldReview({dataset, caseId, rubric, review, actor, reviewedAt} = {}) {
  const labels=rubric?.cases?.find(v=>v.caseId===caseId),item=dataset?.cases?.find(v=>v.id===caseId);
  if (!item || !labels || !sha(review?.datasetSha256) || !sha(review?.rubricSha256) || !actor?.id || !actor?.name || actor?.kind === 'ai' || actor?.kind === 'simulation' || review.reviewMode !== 'human' || review.independenceAttested !== true || actor.id === (labels.preparedBy||rubric.preparedBy)) throw Error('Independent named human adjudication of exact dataset and hidden rubric revisions is required.');
  if (!review.sourceExamined || !review.policyExamined || !review.qualificationsAttested || typeof review.professionalRole !== 'string' || !review.professionalRole.trim() || typeof review.qualifications !== 'string' || !review.qualifications.trim()) throw Error('The independent reviewer must examine real sources and policy and attest role and qualifications.');
  validatePs5GoldLabels({dataset,caseId,rubric});
  return {format:'esia-independent-ps5-gold-review', schemaVersion:1, datasetId:dataset.id, datasetRevision:dataset.revision, datasetSha256:review.datasetSha256, rubricSha256:review.rubricSha256, caseId,caseSplit:item.split,metricCoverage:goldMetricCoverage(labels), reviewerId:actor.id, reviewerName:text(actor.name, 'Reviewer', 300), professionalRole:text(review.professionalRole, 'Role', 1000), qualifications:text(review.qualifications, 'Qualifications', 2000), reviewMode:'human', independenceAttested:true, sourceExamined:true, policyExamined:true, qualificationsAttested:true, credentialsVerified:false, reviewedAt:new Date(reviewedAt).toISOString(), scopeStatement:text(review.scopeStatement, 'Adjudication scope')};
}

const ratio = (count, total) => total ? count / total : null;
const observedEffort = review => ['correctionActiveSeconds', 'reviewActiveSeconds', 'substantiveCorrections'].every(key => Number.isSafeInteger(review?.[key]) && review[key] >= 0 && review[key] <= 365 * 86400);
const correctionReviewConsistent = review => observedEffort(review) && Array.isArray(review.requirementReviews) && review.requirementReviews.every(row => !(row.accepted && row.correctionNeeded)) && (review.substantiveCorrections === 0 || review.requirementReviews.some(row => row.correctionNeeded));
export function validatePs5OutputReview({run, input, review, actor, reviewedAt} = {}) {
  if (run?.actualInference !== true || run?.run?.inference !== 'actual' || !sha(run.run.outputDigest) || review?.outputSha256 !== run.run.outputDigest || review?.inputSha256 !== run.inputSha256 || review?.datasetSha256 !== run.datasetSha256 || review?.rubricSha256 !== run.rubricSha256) throw Error('Review the exact retained actual model output and blinded source input.');
  if (!actor?.id || !actor?.name || actor.kind === 'ai' || actor.kind === 'simulation' || review.reviewMode !== 'human' || !review.independenceAttested || !review.sourceExamined) throw Error('Citation entailment and correction-effort review require an independent named human examining the originals.');
  const citations = run.run.output.citations;
  if (!Array.isArray(review.citationReviews) || review.citationReviews.length !== citations.length || new Set(review.citationReviews.map(v => v.citationIndex)).size !== citations.length) throw Error('Review semantic support for every retained model citation exactly once.');
  const citationReviews = citations.map((citation, index) => {
    const row = review.citationReviews.find(v => v.citationIndex === index);
    if (!row || row.passageId !== citation.passageId || !['supported', 'unsupported', 'contradicts', 'not_relevant'].includes(row.decision)) throw Error('Record the entailment decision for each exact source citation.');
    return {citationIndex:index, passageId:citation.passageId, decision:row.decision, statement:text(row.statement, 'Citation entailment rationale', 2000)};
  });
  if (!Array.isArray(review.requirementReviews) || review.requirementReviews.length !== input.requirements.length || new Set(review.requirementReviews.map(v => v.requirementId)).size !== input.requirements.length) throw Error('Review substantive corrections for every selected criterion once.');
  const requirementReviews = input.requirements.map(requirement => {const row = review.requirementReviews.find(v => v.requirementId === requirement.id);if (!row || typeof row.accepted !== 'boolean' || typeof row.correctionNeeded !== 'boolean') throw Error('Record acceptance and correction needs for each requirement.');return {requirementId:requirement.id, accepted:row.accepted, correctionNeeded:row.correctionNeeded, statement:text(row.statement, 'Requirement correction rationale', 2000)};});
  if (!observedEffort(review)) throw Error('Record bounded observed correction/review active time and substantive correction count.');
  if (!correctionReviewConsistent(review)) throw Error('Correction counts and criterion decisions must describe the exact original output consistently: a criterion needing correction cannot be accepted, and observed substantive corrections require an affected criterion.');
  return {format:'esia-independent-ps5-output-review', schemaVersion:1, caseId:run.caseId, datasetSha256:run.datasetSha256, rubricSha256:run.rubricSha256, inputSha256:run.inputSha256, outputSha256:run.run.outputDigest, reviewerId:actor.id, reviewerName:text(actor.name, 'Reviewer', 300), reviewMode:'human', independenceAttested:true, sourceExamined:true, credentialsVerified:false, reviewedAt:new Date(reviewedAt).toISOString(), citationReviews, requirementReviews, correctionActiveSeconds:review.correctionActiveSeconds, reviewActiveSeconds:review.reviewActiveSeconds, substantiveCorrections:review.substantiveCorrections, measurementEvidenceReference:text(review.measurementEvidenceReference, 'Observed effort evidence reference', 2000)};
}

export function scorePublicPs5Evaluation({output, input, labels,caseSplit, inference, goldReview, outputReview, outputSha256,inputSha256, datasetSha256, rubricSha256, elapsedMilliseconds, usage, cost} = {}) {
  const validation = validateEsAiOutput(output, {skill:getEsAiSkill('es.ps5.gap-review'), passages:input?.passages || [], requirements:input?.requirements || []});
  const expected = labels?.requirements || [], items = Array.isArray(output?.items) ? output.items : [], citations = Array.isArray(output?.citations) ? output.citations : [];
  let covered = 0, matched = 0, material = 0, missed = 0, falseCompliance = 0, contradictionTotal = 0, contradictionFound = 0, supportingTotal = 0, supportingFound = 0, abstentionTotal = 0, appropriateAbstention = 0, inappropriateAbstention = 0, citationSupported = 0;
  for (const label of expected) {
    const rows = items.filter(v => v.requirementId === label.requirementId), item = rows.length === 1 ? rows[0] : null;
    if (item) covered++;
    if (item && label.judgments.includes(item.judgment)) matched++;
    if (item?.judgment === 'compliant' && !label.judgments.includes('compliant')) falseCompliance++;
    if (label.materialDeficiency) {material++;if (!item || !['partially_compliant', 'noncompliant'].includes(item.judgment) && item.missingEvidence !== true) missed++;}
    for (const id of label.supportingPassageIds || []) {supportingTotal++;if (item?.supportingPassageIds?.includes(id)) supportingFound++;}
    for (const id of label.contradictoryPassageIds || []) {contradictionTotal++;if (item?.contradictoryPassageIds?.includes(id)) contradictionFound++;}
    const abstained = ['undetermined', 'not_assessed', 'insufficient_evidence'].includes(item?.judgment);
    if (label.abstentionExpected) {abstentionTotal++;if (abstained) appropriateAbstention++;} else if (abstained) inappropriateAbstention++;
  }
  for (const citation of citations) {
    const passage = input?.passages?.find(v => v.id === citation.passageId);
    if (passage && typeof citation.quote === 'string' && citation.quote.trim() && passage.quote.includes(citation.quote)) citationSupported++;
  }
  const expectedComplete=expected.length===input?.requirements?.length&&new Set(expected.map(row=>row.requirementId)).size===expected.length&&expected.every(row=>input.requirements.some(requirement=>requirement.id===row.requirementId));
  const independentGold = sha(datasetSha256)&&sha(rubricSha256)&&goldReview?.format === 'esia-independent-ps5-gold-review' && goldReview.reviewMode === 'human' && goldReview.independenceAttested===true&&goldReview.sourceExamined===true&&goldReview.policyExamined===true&&goldReview.qualificationsAttested===true&&Boolean(goldReview.reviewerId&&goldReview.reviewerName) && goldReview.datasetSha256 === datasetSha256 && goldReview.rubricSha256 === rubricSha256 && goldReview.caseId === input?.context?.caseId&&expectedComplete;
  const reviewedCitations=Array.isArray(outputReview?.citationReviews)&&outputReview.citationReviews.length===citations.length&&new Set(outputReview.citationReviews.map(row=>row.citationIndex)).size===citations.length&&citations.every((citation,index)=>outputReview.citationReviews.some(row=>row.citationIndex===index&&row.passageId===citation.passageId));
  const reviewedRequirements=Array.isArray(outputReview?.requirementReviews)&&outputReview.requirementReviews.length===input?.requirements?.length&&new Set(outputReview.requirementReviews.map(row=>row.requirementId)).size===input.requirements.length&&input.requirements.every(requirement=>outputReview.requirementReviews.some(row=>row.requirementId===requirement.id&&typeof row.accepted==='boolean'&&typeof row.correctionNeeded==='boolean'));
  const independentOutputReview = outputReview?.format === 'esia-independent-ps5-output-review' && outputReview.reviewMode === 'human' && outputReview.independenceAttested===true&&outputReview.sourceExamined===true&&Boolean(outputReview.reviewerId&&outputReview.reviewerName)&&reviewedCitations&&reviewedRequirements&&correctionReviewConsistent(outputReview) && sha(outputSha256)&&sha(inputSha256)&&outputReview.inputSha256===inputSha256 && outputReview.outputSha256 === outputSha256 && outputReview.datasetSha256 === datasetSha256 && outputReview.rubricSha256 === rubricSha256 && outputReview.caseId === input?.context?.caseId;
  const semanticSupport = independentOutputReview ? ratio(outputReview.citationReviews.filter(v => v.decision === 'supported').length, citations.length) : null;
  const actualInference = inference === 'actual';
  const coverage=acceptanceCoverage({labels,caseSplit,independentGold,goldReview});
  return {format:'esia-public-ps5-evaluation-score', schemaVersion:1, actualInference, independentGold, independentOutputReview,acceptanceCoverage:coverage, qualification:'research_evidence_only', substantivePass:actualInference && independentGold && independentOutputReview&&coverage.complete && validation.valid && expected.length > 0 && matched === expected.length && missed === 0 && falseCompliance === 0 && contradictionFound === contradictionTotal && supportingFound === supportingTotal && appropriateAbstention === abstentionTotal && inappropriateAbstention === 0 && semanticSupport === 1 && outputReview.substantiveCorrections === 0 && outputReview.requirementReviews.every(v => v.accepted && !v.correctionNeeded), validation, metrics:{requirements:expected.length, requirementCoverage:ratio(covered, expected.length), judgmentAccuracy:ratio(matched, expected.length), materialDeficiencies:material, missedMaterialDeficiencies:missed, missedMaterialDeficiencyRate:ratio(missed, material), falseComplianceConclusions:falseCompliance,falseComplianceOpportunities:coverage.counts.falseComplianceOpportunities,falseComplianceRate:ratio(falseCompliance,coverage.counts.falseComplianceOpportunities), citationExactMatch:ratio(citationSupported, citations.length), citationSupport:semanticSupport, citationCount:citations.length, citationSupportBasis:'independent_human_semantic_entailment_review_of_exact_output; null_if_unreviewed', expectedEvidenceRecall:ratio(supportingFound, supportingTotal), contradictionRecall:ratio(contradictionFound, contradictionTotal), expectedContradictions:contradictionTotal, appropriateAbstention:ratio(appropriateAbstention, abstentionTotal), expectedAbstentions:abstentionTotal, inappropriateAbstentions:inappropriateAbstention, elapsedMilliseconds:elapsedMilliseconds ?? null, usage:usage || null, cost:cost || {currency:'USD', hostedChargeMinorUnits:0, localEnergyAndHardwareCost:'not_measured'}, correctionActiveSeconds:independentOutputReview ? outputReview.correctionActiveSeconds : null, reviewActiveSeconds:independentOutputReview ? outputReview.reviewActiveSeconds : null, substantiveCorrections:independentOutputReview ? outputReview.substantiveCorrections : null}, limitations:[...(!actualInference ? ['Authored or simulated output is excluded from model-quality acceptance.'] : []), ...(!independentGold ? ['Independent human gold-label adjudication of these exact dataset/rubric revisions is missing.'] : []), ...(!independentOutputReview ? ['Semantic citation support and observed correction/review effort have not been independently reviewed.'] : []),...(!coverage.complete?[`Quality acceptance coverage is incomplete: ${coverage.missingCategories.join(', ')}. Zero-denominator metrics do not pass by omission.`]:[]), 'A small bounded PS5 task does not qualify a model for other frameworks, standards, corpora or professional sign-off.']};
}
