// E&S-owned draft contracts. Source entitlement, provider dispatch and approved
// persistence remain server responsibilities; a valid draft grants no authority.
const freeze = value => {if (value && typeof value === 'object' && !Object.isFrozen(value)) {Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const ES_AI_CONTRACT_VERSION = '1.0.0';
export const ES_AI_CONVERSATION_SCHEMA = 'es.project-answer.v1';
export const ES_AI_TASK_PROFILES = freeze([
  {id: 'conversation', label: 'Conversational retrieval', capabilities: ['text', 'structured_output'], purpose: 'Answer scoped project questions with exact evidence citations.'},
  {id: 'classification', label: 'Classification and extraction', capabilities: ['text', 'structured_output'], purpose: 'Describe documents and extract source-supported structured candidates.'},
  {id: 'assessment', label: 'Requirements assessment', capabilities: ['text', 'structured_output', 'reasoning'], purpose: 'Assess each selected criterion with supporting and contradictory evidence.'},
  {id: 'multidocument', label: 'Multidocument reasoning', capabilities: ['text', 'structured_output', 'reasoning'], purpose: 'Compare authorized documents, periods and unresolved contradictions.'},
  {id: 'drafting', label: 'Professional drafting', capabilities: ['text', 'structured_output'], purpose: 'Draft evidence-grounded actions and report sections for review.'},
  {id: 'multimodal', label: 'Multimodal evidence interpretation', capabilities: ['text', 'structured_output', 'vision'], purpose: 'Interpret explicitly selected authorized visual evidence; preserve uncertainty.'},
  {id: 'embedding', label: 'Embedding and search', capabilities: ['embedding'], purpose: 'Produce reusable derived search representations within source permissions.'}
]);
export const ES_AI_EXECUTION_PROFILES = freeze([
  {id: 'economy', label: 'Economy', description: 'Prefer local parsing and retrieval with an explicitly approved economical route.', placement: 'policy_selected', fallback: 'deny', maxInputTokens: 12000, maxOutputTokens: 2000, maxCostUsd: 0.02, maxMilliseconds: 60000, costAuthorizationRequired: true},
  {id: 'balanced', label: 'Balanced', description: 'Use an explicitly selected route suited to the substantive task.', placement: 'policy_selected', fallback: 'deny', maxInputTokens: 24000, maxOutputTokens: 4000, maxCostUsd: 0.05, maxMilliseconds: 90000, costAuthorizationRequired: true},
  {id: 'deep', label: 'Deep review', description: 'Use expanded retrieval and contradiction review within an explicit run ceiling.', placement: 'policy_selected', fallback: 'deny', maxInputTokens: 48000, maxOutputTokens: 6000, maxCostUsd: 0.10, maxMilliseconds: 120000, costAuthorizationRequired: true},
  {id: 'local-only', label: 'Local only', description: 'Use authorized local inference and prohibit remote dispatch or fallback.', placement: 'local_only', fallback: 'deny', maxInputTokens: 16000, maxOutputTokens: 3000, maxCostUsd: 0, maxMilliseconds: 90000, costAuthorizationRequired: false}
]);
export const ES_AI_ASSISTANT_PROFILES = freeze([
  {id: 'project-assistant', label: 'Project Assistant', purpose: 'Explore selected project sources and prepare traceable professional drafts.', suggestedQuestions: ['What evidence supports the selected requirement?', 'Which evidence is missing or contradictory?', 'Which publication edition applies to this scope?'], tools: ['search_evidence', 'read_document_passage', 'read_requirement', 'propose_assessment'], humanReviewRequired: true},
  {id: 'ps5-reviewer', label: 'Land and livelihoods reviewer', purpose: 'Review scoped IFC PS5 evidence without inferring outcomes from a plan.', suggestedQuestions: ['Is replacement-cost compensation evidenced before displacement?', 'Which livelihood restoration outcomes remain unverified?'], tools: ['search_evidence', 'read_document_passage', 'read_requirement', 'propose_assessment'], skillIds: ['es.requirement.evidence-identification', 'es.ps5.gap-review', 'es.esap.action-drafting'], humanReviewRequired: true},
  {id: 'monitoring-reviewer', label: 'Monitoring reviewer', purpose: 'Compare reporting periods, commitments and evidence quality.', suggestedQuestions: ['What changed since the approved baseline?', 'Which reported measures have independent implementation evidence?'], tools: ['search_evidence', 'read_document_passage', 'read_requirement', 'propose_assessment'], skillIds: ['es.monitoring.comparison', 'es.incident-grievance.synthesis', 'es.report.narrative-drafting'], humanReviewRequired: true}
]);
export const ES_AI_OUTPUT_LIMITS = freeze({bytes: 1024 * 1024, items: 500, citations: 1000, text: 16000, quote: 2000, fieldNodes: 10000, depth: 12});
export const ES_AI_OUTPUT_STATUSES = freeze({coverage: ['complete', 'partial', 'missing', 'not_determined'], adequacy: ['adequate', 'deficient', 'insufficient_evidence'], judgment: ['compliant', 'partially_compliant', 'noncompliant', 'undetermined', 'not_assessed', 'not_applicable', 'supported', 'insufficient_evidence']});
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const text = (value, max = ES_AI_OUTPUT_LIMITS.text) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value);
const identity = value => text(value, 192) && value === value.trim() && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const baseKeys = new Set(['schema', 'state', 'answer', 'citations', 'items']);
const itemKeys = new Set(['id', 'kind', 'requirementId', 'frameworkId', 'edition', 'coverage', 'adequacy', 'judgment', 'uncertainty', 'text', 'supportingPassageIds', 'contradictoryPassageIds', 'missingEvidence', 'fields']);
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'tools', 'toolcalls', 'tool_calls', 'function_call', 'credentials', 'authorization', 'password', 'apikey', 'api_key', 'approved', 'reviewedby', 'reviewedat', 'rights', 'providerfallback', 'endpoint', 'script', 'onload', 'onclick']);
function sourcePin(passage) {
  if (!plain(passage) || !identity(passage.id) || !text(passage.quote, 256000) || !text(passage.locator, 4000)) return false;
  const versionId = passage.documentVersionId || passage.versionId || passage.resourceVersionId;
  const digest = passage.sourceSha256 || passage.sha256;
  return identity(versionId) && sha(digest) && (!passage.sha256 || !passage.sourceSha256 || passage.sha256 === passage.sourceSha256) && (!passage.documentVersionId || !passage.versionId || passage.documentVersionId === passage.versionId);
}
function portableFields(value, report, path, depth = 0, state = {nodes: 0}) {
  if (++state.nodes > ES_AI_OUTPUT_LIMITS.fieldNodes || depth > ES_AI_OUTPUT_LIMITS.depth) {report(path, 'fields_limit', 'Structured fields exceed the bounded JSON limit.');return;}
  if (value === null || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value === 'string') {if (value.length > ES_AI_OUTPUT_LIMITS.text || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) report(path, 'fields_text', 'Structured field text exceeds its bound.');return;}
  if (!plain(value) && !Array.isArray(value)) {report(path, 'fields_json', 'Structured fields must be portable JSON data.');return;}
  for (const [key, child] of Object.entries(value)) {if (forbidden.has(key.toLowerCase())) report(`${path}.${key}`, 'authority_field', 'AI output cannot carry tools, credentials, execution policy or human approval.');else portableFields(child, report, `${path}.${key}`, depth + 1, state);}
}

/** Deterministic structural/evidence validation, not a substantive correctness
 * certification. Canonical source pins are supplied by the authorized server. */
export function validateEsAiOutput(value, {skill, passages = [], requirements = []} = {}) {
  const errors = [], report = (path, code, message) => {if (errors.length < 200) errors.push({path, code, message});};
  const invalid = () => ({valid: false, errors, output: null});
  if (!plain(skill) || !text(skill.outputSchema, 200)) {report('$context.skill', 'skill_required', 'Select a versioned E&S skill before validating its output.');return invalid();}
  if (!Array.isArray(passages) || !Array.isArray(requirements) || passages.length > 10000 || requirements.length > 5000) {report('$context', 'context_limit', 'Supply bounded authorized passages and requirements.');return invalid();}
  if (!plain(value)) {report('$', 'object_required', 'AI output must be a structured draft object.');return invalid();}
  let encoded;try {encoded = JSON.stringify(value);} catch {report('$', 'invalid_json', 'AI output must be portable JSON.');return invalid();}
  if (new TextEncoder().encode(encoded).byteLength > ES_AI_OUTPUT_LIMITS.bytes) {report('$', 'output_limit', 'AI output exceeds one MiB.');return invalid();}
  for (const key of Object.keys(value)) if (!baseKeys.has(key)) report(`$.${key}`, 'unknown_field', 'The draft contains an unsupported top-level field.');
  if (value.schema !== skill.outputSchema) report('$.schema', 'schema_mismatch', 'The output schema differs from the selected skill.');
  if (value.state !== 'ai_draft') report('$.state', 'human_authority', 'AI output must remain ai_draft; it cannot approve or publish.');
  if (value.answer !== undefined && !text(value.answer)) report('$.answer', 'answer_text', 'An answer must be bounded plain text.');
  if (!Array.isArray(value.citations) || value.citations.length > ES_AI_OUTPUT_LIMITS.citations) report('$.citations', 'citation_limit', 'Provide a bounded explicit citation list.');
  if (!Array.isArray(value.items) || value.items.length > ES_AI_OUTPUT_LIMITS.items) report('$.items', 'item_limit', 'Provide a bounded explicit draft item list.');
  if (!Array.isArray(value.citations) || !Array.isArray(value.items)) return invalid();
  const sources = new Map(), criterion = new Map(), used = new Set(), cited = new Set();
  for (const passage of passages) {if (!sourcePin(passage) || sources.has(passage.id)) report('$context.passages', 'source_pin', 'Every authorized passage must retain a unique identity, exact document version/hash and locator.');else sources.set(passage.id, passage);}
  for (const requirement of requirements) {if (!plain(requirement) || !identity(requirement.id) || criterion.has(requirement.id)) report('$context.requirements', 'requirement_identity', 'Scoped requirements need unique canonical identities.');else criterion.set(requirement.id, requirement);}
  const frameworkRules = skill.frameworks || [];
  if (frameworkRules.length) for (const requirement of criterion.values()) if (!frameworkRules.some(rule => (rule.frameworkId === requirement.frameworkId || rule.aliases?.includes(requirement.frameworkId)) && (rule.edition === requirement.edition || rule.editionAliases?.includes(requirement.edition)) && (!rule.standards?.length || rule.standards.includes(requirement.standard)))) report('$context.requirements', 'skill_applicability', 'A supplied requirement is outside the selected skill framework, edition or standard.');
  const citationPairs = new Set();
  value.citations.forEach((citation, index) => {
    const path = `$.citations[${index}]`;
    if (!plain(citation) || Object.keys(citation).some(key => !['passageId', 'quote'].includes(key)) || !identity(citation.passageId) || !text(citation.quote, ES_AI_OUTPUT_LIMITS.quote)) {report(path, 'citation_shape', 'A citation contains only a known passageId and exact source quotation.');return;}
    const passage = sources.get(citation.passageId), pair = JSON.stringify([citation.passageId, citation.quote]);
    if (passage?.masked === true || passage?.citationEligible === false) report(path, 'transformed_citation', 'Masked or transformed context is not an exact original-source quotation; obtain a separately authorized original excerpt.');
    if (!passage || !passage.quote.includes(citation.quote)) report(path, 'citation_mismatch', 'The quotation must occur exactly in the supplied authorized passage.');
    if (citationPairs.has(pair)) report(path, 'duplicate_citation', 'Duplicate citations are not independent evidence.');citationPairs.add(pair);cited.add(citation.passageId);
  });
  const ids = new Set(), assessed = new Set();
  value.items.forEach((item, index) => {
    const path = `$.items[${index}]`;
    if (!plain(item)) {report(path, 'item_shape', 'Each draft item must be a structured record.');return;}
    for (const key of Object.keys(item)) if (!itemKeys.has(key)) report(`${path}.${key}`, 'unknown_field', 'Draft items cannot add execution or human approval fields.');
    if (!identity(item.id) || ids.has(item.id)) report(`${path}.id`, 'item_identity', 'Draft item identities must be bounded and unique.');ids.add(item.id);
    if (!identity(item.kind) || skill.outputKinds?.length && !skill.outputKinds.includes(item.kind)) report(`${path}.kind`, 'item_kind', 'The draft kind differs from the selected professional skill.');
    if (!text(item.text)) report(`${path}.text`, 'item_text', 'Describe the source-grounded draft or explicit missing evidence.');
    if (typeof item.missingEvidence !== 'boolean') report(`${path}.missingEvidence`, 'missing_evidence_required', 'Every draft must explicitly state whether required evidence is missing.');
    if (item.uncertainty !== undefined && (typeof item.uncertainty !== 'string' || item.uncertainty.length > ES_AI_OUTPUT_LIMITS.text)) report(`${path}.uncertainty`, 'uncertainty_text', 'Record uncertainty as bounded plain text.');
    for (const name of ['coverage', 'adequacy', 'judgment']) if (item[name] !== undefined && !ES_AI_OUTPUT_STATUSES[name].includes(item[name])) report(`${path}.${name}`, 'invalid_status', `Choose an explicit supported ${name} determination.`);
    const supporting = Array.isArray(item.supportingPassageIds) ? item.supportingPassageIds : [], contradictory = Array.isArray(item.contradictoryPassageIds) ? item.contradictoryPassageIds : [];
    for (const name of ['supportingPassageIds', 'contradictoryPassageIds']) {
      const list = item[name];if (!Array.isArray(list) || list.length > 100 || new Set(list).size !== list.length) {report(`${path}.${name}`, 'evidence_list', 'Provide a bounded unique list of exact supplied evidence passages.');continue;}
      for (const passageId of list) {if (!sources.has(passageId) || !cited.has(passageId)) report(`${path}.${name}`, 'uncited_evidence', 'Every supporting or contradictory reference needs an exact quotation from an authorized supplied passage.');else used.add(passageId);}
    }
    if (supporting.some(id => contradictory.includes(id))) report(path, 'contradiction_overlap', 'Distinguish supporting and contradictory evidence explicitly.');
    const evidenceCount = supporting.length + contradictory.length;
    if (!evidenceCount && (!item.missingEvidence || !text(item.uncertainty))) report(path, 'unsupported_item', 'An uncited item must explicitly identify missing evidence and explain the resulting uncertainty.');
    if (!evidenceCount && item.judgment && !['undetermined', 'not_assessed', 'insufficient_evidence'].includes(item.judgment)) report(`${path}.judgment`, 'unsupported_judgment', 'Absence of source evidence cannot establish compliance, noncompliance or nonapplicability.');
    if (item.fields !== undefined) {if (!plain(item.fields)) report(`${path}.fields`, 'fields_object', 'Structured fields must be a bounded data object.');else portableFields(item.fields, report, `${path}.fields`);}
    const requirement = criterion.get(item.requirementId);
    if (item.requirementId !== undefined && !requirement) report(`${path}.requirementId`, 'foreign_requirement', 'The item must identify an exact supplied requirement.');
    if (skill.requiresRequirementCoverage && !requirement) report(`${path}.requirementId`, 'requirement_required', 'Every assessment item must identify a scoped criterion.');
    if (requirement) {
      if (assessed.has(item.requirementId) && skill.requiresRequirementCoverage) report(`${path}.requirementId`, 'duplicate_requirement', 'Keep one explicit result per scoped criterion.');assessed.add(item.requirementId);
      if (requirement.frameworkId && item.frameworkId !== requirement.frameworkId) report(`${path}.frameworkId`, 'framework_mismatch', 'Retain the criterion exact framework identity.');
      if (requirement.edition && item.edition !== requirement.edition) report(`${path}.edition`, 'edition_mismatch', 'Retain the criterion exact applicable edition.');
      if (skill.requiresRequirementCoverage) for (const name of ['coverage', 'adequacy', 'judgment']) if (item[name] === undefined) report(`${path}.${name}`, 'assessment_dimension', 'Requirement assessments must retain coverage, adequacy and professional judgment separately.');
    }
    if (item.judgment === 'compliant' && (item.coverage !== 'complete' || item.adequacy !== 'adequate' || item.missingEvidence !== false || !supporting.length || contradictory.length)) report(`${path}.judgment`, 'false_compliance_guard', 'A compliance draft needs complete adequate supporting evidence with no unresolved missing or contradictory evidence. Topic matches or plan terminology cannot substitute.');
    if (skill.requiresRequirementCoverage && item.coverage === 'missing' && item.missingEvidence !== true) report(`${path}.missingEvidence`, 'coverage_conflict', 'Missing criterion coverage must retain an explicit missing-evidence flag.');
    if (contradictory.length && !text(item.uncertainty)) report(`${path}.uncertainty`, 'contradiction_uncertainty', 'Explain how contradictory evidence affects this draft judgment.');
  });
  if (skill.requiresRequirementCoverage) for (const requirementId of criterion.keys()) if (!assessed.has(requirementId)) report('$.items', 'omitted_requirement', `The selected criterion ${requirementId} needs an evidence assessment or explicit missing-evidence result.`);
  if (value.answer && !value.citations.length && (!value.items.length || value.items.some(item => !item?.missingEvidence || !text(item?.uncertainty)))) report('$.answer', 'unsupported_answer', 'An answer without evidence must be accompanied by explicit missing-evidence drafts and uncertainty.');
  for (const passageId of cited) if (value.items.length && !used.has(passageId)) report('$.citations', 'unattached_citation', 'Attach each citation to its supporting or contradictory draft item.');
  if (errors.length) return invalid();
  return {valid: true, errors: [], output: structuredClone(value)};
}

/** Score known benchmark labels independently of schema validity. These scores
 * compare fixtures; they do not certify a model for professional use. */
export function scoreEsAiBenchmark(output, fixture) {
  const expected = fixture?.expected?.requirements || [], items = Array.isArray(output?.items) ? output.items : [];
  let matches = 0, falseCompliance = 0, missedDeficiencies = 0, contradictions = 0, expectedContradictions = 0, sourceHits = 0, expectedSources = 0;
  for (const criterion of expected) {
    const item = items.find(row => row.requirementId === criterion.requirementId);
    if (item && criterion.judgments.includes(item.judgment)) matches++;
    if (item?.judgment === 'compliant' && !criterion.judgments.includes('compliant')) falseCompliance++;
    if (criterion.deficiencyExpected && (!item || !item.missingEvidence && !['noncompliant', 'partially_compliant', 'insufficient_evidence'].includes(item.judgment))) missedDeficiencies++;
    for (const passageId of criterion.contradictoryPassageIds || []) {expectedContradictions++;if (item?.contradictoryPassageIds?.includes(passageId)) contradictions++;}
    for (const passageId of criterion.supportingPassageIds || []) {expectedSources++;if (item?.supportingPassageIds?.includes(passageId)) sourceHits++;}
  }
  return {criteria: expected.length, requirementCoverage: expected.length ? new Set(items.filter(item => expected.some(row => row.requirementId === item.requirementId)).map(item => item.requirementId)).size / expected.length : 1, judgmentAccuracy: expected.length ? matches / expected.length : 1, falseCompliance, missedDeficiencies, contradictionRecall: expectedContradictions ? contradictions / expectedContradictions : 1, expectedSourceRecall: expectedSources ? sourceHits / expectedSources : 1, substantivePass: matches === expected.length && falseCompliance === 0 && missedDeficiencies === 0 && contradictions === expectedContradictions && sourceHits === expectedSources, certification: 'synthetic_fixture_comparison_only'};
}
