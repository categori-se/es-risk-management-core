// Institutional bibliography and source-bound derivatives. This module carries
// no transport, credentials or project evidence and grants no source entitlement.
import {sourceMappingAcceptanceLabel} from './template-authority.js';
export const resourceLibraryLimits = Object.freeze({resources: 20000, versions: 50000, files: 100000, instruments: 20000, mappings: 100000, collections: 2000, institutions: 500, events: 100000, bytes: 64 * 1024 * 1024, instrumentFields: 500});
export const resourceRightActions = Object.freeze(['retrieve', 'store', 'index', 'ai', 'derive', 'download', 'redistribute', 'excerpt']);
export const resourceTypes = Object.freeze(['policy', 'standard', 'guidance_note', 'guidance', 'handbook', 'toolkit', 'sourcebook', 'template', 'checklist', 'example', 'technical_methodology', 'research_paper', 'monitoring_report', 'brochure', 'collection', 'other']);
export const resourceVersionStatuses = Object.freeze(['current', 'superseded', 'historical', 'withdrawn', 'uncertain']);
export const resourceTaxonomy = Object.freeze({
  topics: Object.freeze(['applicability', 'assessment', 'labor', 'pollution', 'health_safety', 'engagement', 'land', 'indigenous', 'biodiversity', 'cultural_heritage', 'climate', 'financial_intermediaries']),
  lifecycleStages: Object.freeze(['scoping', 'screening', 'applicability_review', 'due_diligence', 'gap_analysis', 'audit', 'planning', 'construction', 'operation', 'field_inspection', 'monitoring', 'corrective_verification', 'closure', 'post_closure']),
  instrumentKinds: Object.freeze(['official_template', 'official_outline', 'sample_form', 'guide_derived_outline', 'project_example', 'checklist', 'matrix', 'form']),
  workProductTypes: Object.freeze(['screening_checklist', 'assessment_methodology', 'management_plan', 'planning_framework', 'self_assessment', 'implementation_register', 'field_inspection', 'monitoring_report', 'verification_document']),
  instrumentWorkflows: Object.freeze(['prepare', 'review', 'monitor']),
  authorityCategories: Object.freeze(['binding_requirement', 'official_guidance', 'project_commitment', 'published_example', 'derived_recommendation'])
});
export const taxonomy = resourceTaxonomy;
// Exact fields in local-workspace-store, engagement-store and monitoring records.
// Instrument-specific concepts outside these records remain extension proposals.
export const canonicalInstrumentPaths = Object.freeze([
  'project.name', 'project.engagement.client', 'project.engagement.phase', 'project.engagement.period',
  'engagement.name', 'engagement.type', 'engagement.scope', 'engagement.client', 'engagement.exclusions', 'engagement.dataRules',
  'requirements.title', 'requirements.text', 'requirements.topics', 'requirements.standard', 'requirements.clause',
  'assertions.quote', 'assertions.locator', 'assertions.note', 'assertions.requirementIds',
  'findings.applicability', 'findings.coverage', 'findings.adequacy', 'findings.performance', 'findings.rationale', 'findings.deficiency', 'findings.recommendation', 'findings.uncertainty', 'findings.riskSignificance', 'findings.requirementId',
  'actions.description', 'actions.owner', 'actions.organization', 'actions.dueDate', 'actions.closureAssertionIds', 'actions.verificationCriteria', 'actions.priority', 'actions.deliverables',
  'indicators.name', 'indicators.unit', 'indicators.method', 'indicators.frequency', 'indicators.threshold',
  'measurements.value', 'measurements.unit', 'measurements.observedAt', 'measurements.method', 'measurements.location', 'measurements.note',
  'monitoringObligations.title', 'monitoringObligations.owner', 'monitoringObligations.organization', 'monitoringObligations.frequency', 'monitoringObligations.verificationCriteria', 'monitoringObligations.dueDate',
  'cycles.name', 'cycles.periodStart', 'cycles.periodEnd', 'cycles.dueDate', 'missions.name', 'missions.scope', 'missions.locations', 'missions.protocols'
]);

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const sha = /^[a-f0-9]{64}$/;
const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fail = (message, status = 400) => {throw Object.assign(new TypeError(message), {status, statusCode: status});};
const assert = (condition, message) => {if (!condition) fail(message);};
const clone = value => structuredClone(value);
const publicAudience = value => value === 'client' || value === 'public';
function text(value, label, max = 4000, required = false) {
  if (value === undefined || value === null) {assert(!required, `${label} is required.`);return '';}
  assert(typeof value === 'string' && value.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value), `${label} must be bounded plain text.`);
  const result = value.trim();assert(!required || result.length, `${label} is required.`);return result;
}
function id(value, label = 'Resource identifier') {assert(typeof value === 'string' && uuid.test(value), `${label} must be a UUID.`);return value.toLowerCase();}
function opaque(value, label = 'Identifier') {const result = text(value, label, 192, true);assert(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(result), `${label} must be an opaque identifier.`);return result;}
function choice(value, values, label, fallback) {const result = value ?? fallback;assert(values.includes(result), `${label} is unsupported.`);return result;}
function list(value, label, maximum = 100) {if (value === undefined) return [];assert(Array.isArray(value) && value.length <= maximum, `${label} exceeds its entry limit.`);return value;}
function strings(value, label, maximum = 100) {const result = list(value, label, maximum).map(item => text(item, label, 1000, true));assert(new Set(result).size === result.length, `${label} must be unique.`);return result;}
function date(value, label, {instant = false, optional = true} = {}) {
  const result = text(value, label, 64, !optional);if (!result) return '';
  const pattern = instant ? /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/ : /^\d{4}(?:-\d\d(?:-\d\d)?)?$/;
  const day = result.slice(0, 10), parsed = Date.parse(result.length === 4 ? result + '-01-01' : result.length === 7 ? result + '-01' : result);
  assert(pattern.test(result) && Number.isFinite(parsed) && (result.length < 10 || new Date(Date.parse(day)).toISOString().slice(0, 10) === day), `${label} must be an actual ISO date${instant ? ' and time' : ''}.`);return result;
}
export function resourceReferenceUrl(value, label = 'Official source URL') {
  const result = text(value, label, 4000);if (!result) return '';
  let url;try {url = new URL(result);} catch {fail(`${label} must be an HTTP(S) URL.`);}
  const secret = /^(?:token|.*[_-]token|auth|authorization|code|bearer|jwt|.*[_-]key|key|password|passwd|secret|.*[_-]secret|session(?:id|[_-]id|[_-]token)?|sid|signature|sig|credential|credentials|x-amz-.+|x-goog-.+|awsaccesskeyid|googleaccessid|key-pair-id|policy|rlkey|resourcekey)$/i;
  assert(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && ![...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()].some(key => secret.test(key.replace(/\[\d*\]$/, '').replace(/[.\s]/g, '-'))), `${label} must omit credentials and temporary access parameters.`);
  return result;
}
function portable(value, depth = 0, state = {nodes: 0}) {
  assert(++state.nodes < 1000000 && depth < 30, 'Catalog metadata exceeds its structural limit.');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number') {assert(Number.isFinite(value), 'Catalog numbers must be finite.');return;}
  assert(Array.isArray(value) || object(value), 'Catalog metadata must be portable JSON.');
  for (const [key, child] of Object.entries(value)) {assert(!['__proto__', 'prototype', 'constructor'].includes(key), 'Catalog metadata contains an unsafe property.');portable(child, depth + 1, state);}
}
function review(value, label, {instrument = false} = {}) {
  assert(value === undefined || object(value), `${label} must be a record.`);const source = value || {};
  const status = choice(source.status, instrument ? ['draft', 'review', 'approved', 'rejected', 'withdrawn'] : ['draft', 'review', 'approved', 'withdrawn'], `${label} status`, 'draft');
  const result = {...clone(source), status, reviewedBy: text(source.reviewedBy, `${label} reviewer`, 300), reviewedAt: date(source.reviewedAt, `${label} review time`, {instant: true})};
  if (!instrument) result.audience = choice(source.audience, ['internal', 'public', 'restricted'], `${label} audience`, 'internal');
  if (status === 'approved') assert(result.reviewedBy && result.reviewedAt, `${label} approval requires a human reviewer and review time.`);
  return result;
}
export function normalizeResourceRights(value = {}) {
  assert(object(value) && (value.actions === undefined || object(value.actions)), 'Resource rights require a structured action record.');
  const actions = {};
  for (const action of Object.keys(value.actions || {})) assert(resourceRightActions.includes(action), 'Resource rights contain an unsupported action.');
  for (const action of resourceRightActions) actions[action] = choice(value.actions?.[action], ['permitted', 'prohibited', 'unknown'], `Resource ${action} rights`, 'unknown');
  const result = {...clone(value), category: text(value.category || 'unknown', 'Rights category', 100, true), actions,
    evidenceUrl: resourceReferenceUrl(value.evidenceUrl, 'Rights evidence URL'), attribution: text(value.attribution, 'Required attribution', 8000),
    reviewedAt: date(value.reviewedAt, 'Rights review time', {instant: true}), reviewedBy: text(value.reviewedBy, 'Rights reviewer', 300),
    expiresAt: date(value.expiresAt, 'Rights expiry', {instant: true})};
  if (value.audiences !== undefined) result.audiences = strings(value.audiences, 'Rights audiences', 10);
  if (value.purposes !== undefined) result.purposes = strings(value.purposes, 'Rights purposes', 30);
  if (value.license !== undefined) result.license = text(value.license, 'Publication license', 1000);
  for (const key of ['licenseUri', 'licenseUrl']) if (value[key] !== undefined) result[key] = resourceReferenceUrl(value[key], 'Official license URL');
  if (value.conditions !== undefined) result.conditions = Array.isArray(value.conditions) ? strings(value.conditions, 'Publication license conditions', 100) : text(value.conditions, 'Publication license conditions', 8000);
  if (result.expiresAt && result.reviewedAt) assert(Date.parse(result.expiresAt) > Date.parse(result.reviewedAt), 'Rights expiry must follow its review.');
  return result;
}

/** A rights decision is separate from source entitlement and storage authority. */
export function evaluateResourceRight(version, action, context = {}) {
  const deny = reason => ({allowed: false, action, reason});
  if (!resourceRightActions.includes(action)) return deny('unsupported_action');
  if (!object(version) || !object(version.rights)) return deny('rights_unknown');
  if (context.authorized === false) return deny('access_denied');
  let rights;try {rights = normalizeResourceRights(version.rights);} catch {return deny('rights_invalid');}
  if (rights.resourceVersionId && rights.resourceVersionId !== version.id) return deny('rights_version_mismatch');
  if (rights.actions?.[action] !== 'permitted') return deny(rights.actions?.[action] === 'prohibited' ? 'rights_prohibited' : 'rights_unknown');
  if (!rights.evidenceUrl || !rights.reviewedAt || !rights.reviewedBy || !Number.isFinite(Date.parse(rights.reviewedAt))) return deny('rights_evidence_required');
  let now = context.now ?? Date.now();if (typeof now === 'function') now = now();if (typeof now === 'string') now = Date.parse(now);
  if (!Number.isFinite(now)) return deny('invalid_decision_time');
  if (Date.parse(rights.reviewedAt) > now) return deny('rights_not_yet_reviewed');
  if (rights.expiresAt && (!Number.isFinite(Date.parse(rights.expiresAt)) || Date.parse(rights.expiresAt) <= now)) return deny('rights_expired');
  if (rights.audiences?.length && !rights.audiences.includes(context.audience || 'practitioner')) return deny('audience_not_permitted');
  if (rights.purposes?.length && !rights.purposes.includes(context.purpose || 'professional_review')) return deny('purpose_not_permitted');
  if (publicAudience(context.audience)) {
    if (!isPublicVersion(version)) return deny('curation_required');
    if (['download', 'derive'].includes(action) && rights.actions.redistribute !== 'permitted') return deny('redistribution_not_permitted');
  }
  return {allowed: true, action, reason: 'permitted_with_recorded_evidence'};
}

function authors(value) {return list(value, 'Authors', 100).map(author => {
  if (typeof author === 'string') return text(author, 'Author', 1000, true);
  assert(object(author), 'Author must be a name or structured person/corporate author.');
  const result = {};
  for (const key of ['literal', 'family', 'given', 'suffix', 'ORCID']) if (author[key] !== undefined) result[key] = text(author[key], `Author ${key}`, 1000);
  assert(result.literal || result.family, 'Author requires a corporate literal name or family name.');return result;
});}
function identifiers(value) {return list(value, 'Bibliographic identifiers', 50).map(item => {assert(object(item), 'Bibliographic identifier must be structured.');return {type: text(item.type, 'Identifier type', 100, true), value: text(item.value, 'Identifier value', 1000, true)};});}
function location(value, label = 'Source location') {
  assert(object(value), `${label} is required.`);const result = clone(value);
  for (const key of ['locator', 'section', 'paragraph', 'table', 'caption', 'sourceId']) if (value[key] !== undefined) result[key] = text(value[key], `${label} ${key}`, 4000);
  for (const key of ['page', 'pageEnd']) if (value[key] !== undefined) assert(Number.isSafeInteger(value[key]) && value[key] > 0 && value[key] <= 100000, `${label} page must be positive.`);
  if (value.pageEnd !== undefined && value.page !== undefined) assert(value.pageEnd >= value.page, `${label} page range is reversed.`);
  if (value.fileId !== undefined) result.fileId = id(value.fileId, `${label} file ID`);
  if (value.sha256 !== undefined) assert(sha.test(value.sha256), `${label} SHA256 must identify exact original bytes.`);
  assert(result.locator || result.section || result.paragraph || result.table || result.page, `${label} requires a precise locator.`);return result;
}
function frameworks(value) {return list(value, 'Applicable frameworks', 100).map(item => {
  if (typeof item === 'string') return {frameworkId: opaque(item, 'Framework identifier'), edition: ''};
  assert(object(item), 'Framework reference must be structured.');return {...clone(item), frameworkId: opaque(item.frameworkId, 'Framework identifier'), edition: text(item.edition, 'Framework edition', 500), standardIds: strings(item.standardIds, 'Standard IDs', 100)};
});}
function isPublicVersion(version) {return version.curation?.status === 'approved' && version.curation?.audience === 'public' && Boolean(version.curation.reviewedAt && version.curation.reviewedBy);}
function visible(version, audience) {return !publicAudience(audience) || isPublicVersion(version);}
function publicReview(value) {return {status: value.status, audience: value.audience, reviewedAt: value.reviewedAt};}
function publicRights(value) {return {category: value.category, actions: clone(value.actions), attribution: value.attribution, expiresAt: value.expiresAt,
  ...(value.license ? {license: value.license} : {}), ...(value.licenseUri || value.licenseUrl ? {licenseUri: value.licenseUri || value.licenseUrl} : {}),
  ...(value.conditions !== undefined ? {conditions: clone(value.conditions)} : {})};}

export function validateInstrument(input, catalog) {
  assert(object(input), 'Instrument must be a structured source-bound record.');portable(input);
  const result = {...clone(input), id: id(input.id, 'Instrument ID'), resourceVersionId: id(input.resourceVersionId, 'Instrument parent version'), title: text(input.title, 'Instrument title', 1000, true),
    kind: choice(input.kind, resourceTaxonomy.instrumentKinds, 'Instrument kind', 'guide_derived_outline'), authorityCategory: choice(input.authorityCategory, resourceTaxonomy.authorityCategories, 'Instrument authority category', 'derived_recommendation'),
    source: location(input.source, 'Instrument source'), approval: review(input.approval, 'Instrument', {instrument: true}), structure: list(input.structure, 'Instrument structure', 1000)};
  if(input.topics!==undefined){result.topics=strings(input.topics,'Instrument topics');assert(result.topics.every(topic=>resourceTaxonomy.topics.includes(topic)),'Instrument topics must be canonical.');}
  if(input.workProductType!==undefined)result.workProductType=choice(input.workProductType,resourceTaxonomy.workProductTypes,'Instrument work product type');
  if(input.sourceClassification!==undefined)result.sourceClassification=choice(input.sourceClassification,['official_template','official_outline','guidance','sample_form','completed_example','derived_instrument'],'Instrument source classification');
  if(input.workflows!==undefined){result.workflows=strings(input.workflows,'Instrument workflows',3);assert(result.workflows.every(workflow=>resourceTaxonomy.instrumentWorkflows.includes(workflow)),'Choose an established instrument workflow.');}
  if(result.approval.status==='approved')assert(result.source.fileId&&sha.test(result.source.sha256||''),'Approved instruments must retain an exact original file ID and SHA256.');
  if (catalog) {
    const parent = catalog.versions?.find(item => item.id === result.resourceVersionId);assert(parent, 'Instrument must retain an existing parent ResourceVersion.');
    if (result.source.fileId) {const file = catalog.files?.find(item => item.id === result.source.fileId);assert(file?.resourceVersionId === parent.id, 'Instrument source file belongs to another publication edition.');if (result.source.sha256) assert(file.sha256 === result.source.sha256, 'Instrument source hash differs from its exact original.');}
    if (result.source.sha256) assert(catalog.files?.some(file => file.resourceVersionId === parent.id && file.sha256 === result.source.sha256) || parent.sourceSha256 === result.source.sha256, 'Instrument source hash is outside its parent edition.');
  }
  const fieldIds = new Set();
  result.fields = list(input.fields, 'Instrument fields', resourceLibraryLimits.instrumentFields).map(field => {
    assert(object(field), 'Instrument fields must be declarative records.');
    const allowed = ['id', 'label', 'type', 'canonicalPath', 'sourceLocator', 'required', 'options', 'description', 'extensionProposal', 'columns'];
    assert(Object.keys(field).every(key => allowed.includes(key)), 'Instrument fields cannot contain code, handlers or unsupported execution properties.');
    const row = {id: opaque(field.id, 'Instrument field ID'), label: text(field.label, 'Instrument field label', 1000, true), type: choice(field.type, ['text', 'textarea', 'number', 'date', 'boolean', 'select', 'table'], 'Instrument field type', 'text'),
      canonicalPath: text(field.canonicalPath, 'Canonical data path', 300), sourceLocator: text(field.sourceLocator, 'Instrument field source location', 4000, true), required: field.required === true};
    assert(!fieldIds.has(row.id), 'Instrument field IDs must be unique.');fieldIds.add(row.id);
    if (row.canonicalPath) assert(canonicalInstrumentPaths.includes(row.canonicalPath), 'Instrument field requires an established canonical data path or an explicit extension proposal.');
    if (field.extensionProposal !== undefined) {
      assert(object(field.extensionProposal) && Object.keys(field.extensionProposal).every(key => ['path', 'rationale', 'status'].includes(key)), 'Domain extensions must be explicit declarative proposals.');
      row.extensionProposal = {path: text(field.extensionProposal.path, 'Proposed domain path', 300, true), rationale: text(field.extensionProposal.rationale, 'Domain extension rationale', 4000, true), status: choice(field.extensionProposal.status, ['proposed', 'approved', 'rejected'], 'Domain extension review', 'proposed')};
      assert(/^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+$/.test(row.extensionProposal.path) && !/(?:^|\.)(?:__proto__|prototype|constructor)(?:\.|$)/.test(row.extensionProposal.path), 'Domain extension path is unsafe.');
    }
    assert(row.canonicalPath || row.extensionProposal || result.approval.status !== 'approved', 'Approved instruments must map each field or retain an explicit domain extension proposal.');
    if (field.options !== undefined) row.options = strings(field.options, 'Instrument field options', 200);
    if (row.type === 'select') assert(row.options?.length, 'Selection fields need a bounded explicit option list.');
    if (field.description !== undefined) row.description = text(field.description, 'Instrument field description', 4000);
    if (field.columns !== undefined) row.columns = strings(field.columns, 'Table field columns', 100);
    return row;
  });
  // Structure is descriptive text, never executable markup or a template engine.
  result.structure = result.structure.map(item => typeof item === 'string' ? text(item, 'Instrument structure', 4000, true) : (() => {assert(object(item) && Object.keys(item).every(key => ['id', 'title', 'description', 'fieldIds', 'sourceLocator', 'level'].includes(key)), 'Instrument structure must be declarative headings and field references.');const row = {id: opaque(item.id, 'Structure ID'), title: text(item.title, 'Structure heading', 1000, true), description: text(item.description, 'Structure description', 4000), fieldIds: strings(item.fieldIds, 'Structure field references', 500), sourceLocator: text(item.sourceLocator, 'Structure source location', 4000, true)};assert(row.fieldIds.every(key => fieldIds.has(key)), 'Instrument structure refers to an unknown field.');if (item.level !== undefined) {assert(Number.isInteger(item.level) && item.level >= 1 && item.level <= 6, 'Structure level must be 1–6.');row.level = item.level;}return row;})());
  return result;
}

/** Normalize one local catalog. Internal extension data never implies disclosure. */
export function normalizeCatalog(input) {
  assert(object(input) && input.schemaVersion === 1, 'Resource catalog schemaVersion must be 1.');portable(input);
  assert(new TextEncoder().encode(JSON.stringify(input)).byteLength <= resourceLibraryLimits.bytes, 'Resource catalog exceeds its byte limit.');
  const result = {...clone(input), schemaVersion: 1};
  const claim = (rows, label) => {const found = new Set();for (const row of rows) {assert(!found.has(row.id), `Duplicate ${label} identity.`);found.add(row.id);}return found;};
  result.institutions = list(input.institutions, 'Institutions', resourceLibraryLimits.institutions).map(item => {assert(object(item), 'Institution must be structured.');return {...clone(item), id: opaque(item.id, 'Institution ID'), name: text(item.name, 'Institution name', 1000, true), officialUrl: resourceReferenceUrl(item.officialUrl)};});
  const institutionIds = claim(result.institutions, 'institution');
  result.resources = list(input.resources, 'Resources', resourceLibraryLimits.resources).map(item => {
    assert(object(item), 'Resource must be structured.');const row = {...clone(item), id: id(item.id), title: text(item.title, 'Resource title', 2000, true), type: choice(item.type, resourceTypes, 'Resource type', 'other'), institutionId: text(item.institutionId, 'Publishing institution', 192),
      subtitle: text(item.subtitle, 'Subtitle', 2000), translatedTitle: text(item.translatedTitle, 'Translated title', 2000), authors: authors(item.authors), publisher: text(item.publisher, 'Publisher', 1000), identifiers: identifiers(item.identifiers)};
    if (row.institutionId) assert(institutionIds.has(row.institutionId), 'Resource publishing institution is outside the catalog.');return row;
  });
  const resourceIds = claim(result.resources, 'resource');
  result.versions = list(input.versions, 'Resource versions', resourceLibraryLimits.versions).map(item => {
    assert(object(item), 'ResourceVersion must be structured.');const row = {...clone(item), id: id(item.id, 'ResourceVersion ID'), resourceId: id(item.resourceId, 'Bibliographic parent ID'), edition: text(item.edition, 'Publication edition', 500, true), status: choice(item.status, resourceVersionStatuses, 'Publication status', 'uncertain'),
      publicationDate: date(item.publicationDate, 'Publication date'), language: text(item.language || 'und', 'Publication language', 100, true), officialUrl: resourceReferenceUrl(item.officialUrl), downloadUrl: resourceReferenceUrl(item.downloadUrl, 'Original download URL'), archiveUrl: resourceReferenceUrl(item.archiveUrl, 'Persistent archive URL'),
      title: text(item.title, 'Edition title', 2000), summary: text(item.summary, 'Curated resource summary', 16000), topics: strings(item.topics, 'Canonical topics'), frameworks: frameworks(item.frameworks), lifecycleStages: strings(item.lifecycleStages, 'Lifecycle stages'), sectors: strings(item.sectors, 'Project sectors'), geographies: strings(item.geographies, 'Geographic coverage'), audiences: strings(item.audiences, 'Intended audiences'), rights: normalizeResourceRights(item.rights), curation: review(item.curation, 'Resource curation')};
    assert(resourceIds.has(row.resourceId), 'ResourceVersion requires an existing bibliographic parent.');
    assert(row.topics.every(topic => resourceTaxonomy.topics.includes(topic)), 'ResourceVersion contains a noncanonical topic.');
    if (item.authors !== undefined) row.authors = authors(item.authors);
    if (item.identifiers !== undefined) row.identifiers = identifiers(item.identifiers);
    for (const name of ['sourceSha256', 'sourcePackSha256']) if (item[name] !== undefined) assert(sha.test(item[name]), `${name} must be exact SHA256.`);
    return row;
  });
  const versionIds = claim(result.versions, 'resource version');
  const editions = new Set();for (const version of result.versions) {const key = `${version.resourceId}:${version.edition}:${version.language}`;assert(!editions.has(key), 'An edition/language already belongs to this resource; register another file representation instead.');editions.add(key);
    if (version.supersededBy !== undefined && version.supersededBy !== null && version.supersededBy !== '') {version.supersededBy = id(version.supersededBy, 'Successor version ID');assert(version.supersededBy !== version.id && versionIds.has(version.supersededBy) && result.versions.find(item => item.id === version.supersededBy).resourceId === version.resourceId, 'Successor must identify another retained ResourceVersion of the same publication.');}
  }
  for (const version of result.versions) {const seen = new Set([version.id]);let row = version;while (row.supersededBy) {assert(!seen.has(row.supersededBy), 'Publication version succession cannot contain a cycle.');seen.add(row.supersededBy);row = result.versions.find(item => item.id === row.supersededBy);}}
  result.files = list(input.files, 'Resource files', resourceLibraryLimits.files).map(item => {
    assert(object(item), 'ResourceFile must be structured.');const row = {...clone(item), id: id(item.id, 'ResourceFile ID'), resourceVersionId: id(item.resourceVersionId, 'ResourceFile parent version'), filename: text(item.filename, 'Original filename', 1000, true), mediaType: text(item.mediaType, 'File MIME type', 256, true), sourceUrl: resourceReferenceUrl(item.sourceUrl, 'File source URL')};
    assert(versionIds.has(row.resourceVersionId) && sha.test(row.sha256) && Number.isSafeInteger(row.size) && row.size > 0 && row.size <= 512 * 1024 * 1024, 'ResourceFile must bind an existing edition and exact bounded SHA256/size.');
    assert(/^[^/\\\x00-\x1f\x7f]+$/.test(row.filename) && row.filename !== '.' && row.filename !== '..' && /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+(?:\s*;[^\r\n]*)?$/.test(row.mediaType), 'ResourceFile filename or media type is unsafe.');
    for (const key of ['downloadedAt', 'capturedAt']) if (item[key] !== undefined) row[key] = date(item[key], `File ${key}`, {instant: true});
    if (item.redirects !== undefined) row.redirects = list(item.redirects, 'Source redirects', 10).map(value => resourceReferenceUrl(value));
    if (item.rights !== undefined) row.rights = normalizeResourceRights(item.rights);
    if (item.storage !== undefined) assert(object(item.storage), 'File storage descriptor must be structured.');return row;
  });claim(result.files, 'resource file');
  result.mappings = list(input.mappings, 'Resource mappings', resourceLibraryLimits.mappings).map(item => {
    assert(object(item), 'ResourceMapping must be structured.');const row = {...clone(item), id: id(item.id, 'Mapping ID'), resourceVersionId: id(item.resourceVersionId, 'Mapping parent version'), frameworkId: text(item.frameworkId, 'Mapped framework', 192), edition: text(item.edition, 'Mapped policy edition', 500), standardIds: strings(item.standardIds, 'Mapped standards'), topics: strings(item.topics, 'Mapped topics'), type: choice(item.type, ['requirement', 'guidance', 'example', 'related'], 'Mapping type', 'related'), rationale: text(item.rationale, 'Mapping rationale', 8000, true), source: location(item.source, 'Mapping source'), verificationStatus: choice(item.verificationStatus, ['unreviewed', 'verified', 'rejected', 'needs_review'], 'Mapping verification status', 'unreviewed')};
    assert(versionIds.has(row.resourceVersionId), 'Mapping requires an existing ResourceVersion.');if (row.frameworkId) assert(row.edition, 'A framework mapping must retain its policy edition.');
    if (item.topic !== undefined) row.topic = choice(item.topic, resourceTaxonomy.topics, 'Mapped topic');assert(row.topics.every(topic => resourceTaxonomy.topics.includes(topic)), 'Mapping contains a noncanonical topic.');
    if (row.source.fileId) {const file = result.files.find(file => file.id === row.source.fileId);assert(file?.resourceVersionId === row.resourceVersionId && (!row.source.sha256 || row.source.sha256 === file.sha256), 'Mapping must cite its exact parent edition and original.');}
    if (row.source.sha256) assert(result.files.some(file => file.resourceVersionId === row.resourceVersionId && file.sha256 === row.source.sha256) || result.versions.find(version => version.id === row.resourceVersionId).sourceSha256 === row.source.sha256, 'Mapping source SHA256 is outside its parent publication edition.');
    if (item.curation !== undefined) row.curation = review(item.curation, 'Mapping curation');
    if (row.verificationStatus === 'verified') assert(text(item.reviewedBy, 'Mapping reviewer', 300) && date(item.reviewedAt, 'Mapping review time', {instant: true}), 'Verified mapping requires human review provenance.');return row;
  });claim(result.mappings, 'mapping');
  result.instruments = list(input.instruments, 'Resource instruments', resourceLibraryLimits.instruments).map(item => validateInstrument(item, result));claim(result.instruments, 'instrument');
  result.collections = list(input.collections, 'Resource collections', resourceLibraryLimits.collections).map(item => {
    assert(object(item), 'ResourceCollection must be structured.');const row = {...clone(item), id: opaque(item.id, 'Collection ID'), title: text(item.title, 'Collection title', 1000, true), description: text(item.description, 'Collection description', 8000), topics: strings(item.topics, 'Collection topics'), resourceVersionIds: list(item.resourceVersionIds, 'Collection versions', 20000).map(value => id(value, 'Collection version reference')), curation: review(item.curation, 'Collection curation')};
    assert(row.topics.every(topic => resourceTaxonomy.topics.includes(topic)) && row.resourceVersionIds.every(value => versionIds.has(value)) && new Set(row.resourceVersionIds).size === row.resourceVersionIds.length, 'Collection requires canonical topics and unique existing version references.');return row;
  });claim(result.collections, 'collection');
  result.events = list(input.events, 'Resource events', resourceLibraryLimits.events).map(item => {assert(object(item), 'Catalog event must be structured.');return clone(item);});
  for (const key of ['links', 'relationships']) if (input[key] !== undefined) result[key] = list(input[key], `Resource ${key}`, resourceLibraryLimits.mappings).map(item => {
    assert(object(item), `Resource ${key} must be structured.`);const row = clone(item);if (row.id !== undefined) row.id = id(row.id, `${key} ID`);
    for (const ref of ['resourceId', 'targetResourceId']) if (row[ref] !== undefined) assert(resourceIds.has(id(row[ref], `${key} resource`)), `${key} requires an existing Resource.`);
    for (const ref of ['resourceVersionId', 'targetVersionId']) if (row[ref] !== undefined) assert(versionIds.has(id(row[ref], `${key} version`)), `${key} requires an existing ResourceVersion.`);
    if (row.url !== undefined) row.url = resourceReferenceUrl(row.url);return row;
  });
  return result;
}

function cardFor(catalog, version, audience) {
  const resource = catalog.resources.find(item => item.id === version.resourceId), institution = catalog.institutions.find(item => item.id === resource.institutionId);
  const card = {id: version.id, resourceId: resource.id, resourceVersionId: version.id, title: version.title || resource.title, translatedTitle: resource.translatedTitle, subtitle: resource.subtitle,
    type: resource.type, institutionId: resource.institutionId, institution: institution?.name || '', authors: clone(version.authors || resource.authors), publisher: version.publisher || resource.publisher || institution?.name || '',
    publicationDate: version.publicationDate, edition: version.edition, status: version.status, language: version.language, summary: version.summary,
    officialUrl: version.officialUrl, identifiers: clone(version.identifiers || resource.identifiers), topics: clone(version.topics), frameworks: publicAudience(audience) ? version.frameworks.map(item => ({frameworkId: item.frameworkId, edition: item.edition, standardIds: clone(item.standardIds || [])})) : clone(version.frameworks), lifecycleStages: clone(version.lifecycleStages), sectors: clone(version.sectors), geographies: clone(version.geographies), audiences: clone(version.audiences),
    rights: publicAudience(audience) ? publicRights(version.rights) : clone(version.rights), curation: publicAudience(audience) ? publicReview(version.curation) : clone(version.curation),
    actions: Object.fromEntries(resourceRightActions.map(action => [action, evaluateResourceRight(version, action, {audience}).allowed]))};
  if (version.supersededBy && catalog.versions.some(item => item.id === version.supersededBy && visible(item, audience))) card.supersededBy = version.supersededBy;
  for (const key of ['series', 'reportNumber', 'abstract', 'copyrightOwner']) {
    // Client descriptions come only from the reviewed summary, not parsed abstracts.
    if (key === 'abstract' && publicAudience(audience)) continue;
    if (version[key] || resource[key]) card[key] = text(version[key] || resource[key], key, 8000);
  }
  if (!publicAudience(audience)) for (const key of ['acquisitionStatus', 'analysisStatus', 'qualityStatus', 'humanVerificationStatus', 'lastVerifiedAt', 'latestKnownEdition', 'sourceErrors', 'aliases']) if (version[key] !== undefined || resource[key] !== undefined) card[key] = clone(version[key] ?? resource[key]);
  return card;
}
function safeInstrument(catalog, instrument, audience) {
  const version = catalog.versions.find(item => item.id === instrument.resourceVersionId);
  if (!visible(version, audience)) return null;
  if(['derive','excerpt'].some(action=>!evaluateResourceRight(version,action,{audience}).allowed))return null;
  const sourceFile=catalog.files.find(file=>file.id===instrument.source.fileId),fileVersion=sourceFile?.rights?{...version,rights:sourceFile.rights}:null;
  if(fileVersion&&['derive','excerpt',...(publicAudience(audience)?['redistribute']:[])].some(action=>!evaluateResourceRight(fileVersion,action,{audience}).allowed))return null;
  if (publicAudience(audience) && (instrument.approval.status !== 'approved' || instrument.approval.audience !== 'public' || !evaluateResourceRight(version, 'derive', {audience}).allowed || !evaluateResourceRight(version, 'excerpt', {audience}).allowed)) return null;
  const result = {id: instrument.id, resourceVersionId: instrument.resourceVersionId, title: instrument.title, kind: instrument.kind, authorityCategory: instrument.authorityCategory,
    source: Object.fromEntries(['locator', 'page', 'pageEnd', 'section', 'paragraph', 'table', 'caption'].filter(key => instrument.source[key] !== undefined).map(key => [key, clone(instrument.source[key])])),
    approval: publicAudience(audience) ? {status: instrument.approval.status, reviewedAt: instrument.approval.reviewedAt} : clone(instrument.approval), fields: clone(instrument.fields), structure: clone(instrument.structure),
    topics: clone(instrument.topics||version.topics), workProductType: instrument.workProductType||'', workflows: clone(instrument.workflows||[])};
  return result;
}
function matchesFilters(card, filters) {
  const many = (field, selected) => !selected || (Array.isArray(selected) ? selected : [selected]).some(value => (card[field] || []).includes(value));
  const equal = (field, selected) => !selected || (Array.isArray(selected) ? selected : [selected]).includes(card[field]);
  return equal('institutionId', filters.institutionId || filters.institution) && equal('publisher', filters.publisher) && equal('type', filters.type || filters.resourceType) && equal('status', filters.status) && equal('language', filters.language) &&
    equal('edition', filters.edition) && many('topics', filters.topic || filters.topics) && many('lifecycleStages', filters.lifecycleStage || filters.lifecycleStages) && many('sectors', filters.sector || filters.sectors) && many('geographies', filters.geography || filters.geographies) &&
    (!filters.frameworkId || card.frameworks.some(item => item.frameworkId === filters.frameworkId && (!filters.policyEdition || item.edition === filters.policyEdition))) &&
    (!filters.standardId || card.frameworks.some(item => item.standardIds?.includes(filters.standardId))) && (filters.includeHistorical !== false || !['historical', 'superseded', 'withdrawn'].includes(card.status));
}
function facetsFor(cards) {
  const fields = {institutions: 'institutionId', publishers: 'publisher', types: 'type', statuses: 'status', topics: 'topics', lifecycleStages: 'lifecycleStages', sectors: 'sectors', geographies: 'geographies', languages: 'language'};
  return Object.fromEntries(Object.entries(fields).map(([facet, field]) => {
    const counts = new Map();for (const card of cards) for (const value of new Set(Array.isArray(card[field]) ? card[field] : [card[field]])) if (value) counts.set(value, (counts.get(value) || 0) + 1);
    return [facet, [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([value, count]) => ({value, count}))];
  }));
}
/** Disclosure filtering precedes query matching, related expansion and facets. */
export function projectResourceCatalog(input, {audience = 'practitioner', query = '', filters = {}} = {}) {
  assert(['practitioner', 'client', 'public', 'internal'].includes(audience), 'Choose a supported resource audience.');
  const catalog = normalizeCatalog(input);assert(object(filters), 'Catalog filters must be structured.');query = text(query, 'Resource search', 2000).toLowerCase();
  const allowed = catalog.versions.filter(version => visible(version, audience)).map(version => cardFor(catalog, version, audience));
  // Descriptive discovery metadata remains useful before source processing rights
  // are confirmed. Source fields, structure and private review notes stay gated.
  const discovery = catalog.instruments.flatMap(item => {
    const parent=allowed.find(card=>card.resourceVersionId===item.resourceVersionId);if(!parent)return [];
    if(publicAudience(audience)&&!safeInstrument(catalog,item,audience))return [];
    return [{id:item.id,resourceVersionId:item.resourceVersionId,title:item.title,kind:item.kind,authorityCategory:item.authorityCategory,
      topics:clone(item.topics||parent.topics),workProductType:item.workProductType||'',workflows:clone(item.workflows||[]),status:item.approval.status,sourceClassification:item.sourceClassification||'',mappingAcceptanceLabel:sourceMappingAcceptanceLabel(item),
      sourceLocator:item.source.locator||item.source.section||'',contentAvailable:Boolean(safeInstrument(catalog,item,audience))}];
  });
  const instrumentMatches=item=>(!filters.workProductType||item.workProductType===filters.workProductType)&&(!filters.workflow||item.workflows.includes(filters.workflow))&&(!filters.instrumentKind||item.kind===filters.instrumentKind);
  const terms = query.split(/\s+/).filter(Boolean);
  const cards = allowed.filter(card => matchesFilters(card, filters) && (!(filters.workProductType||filters.workflow||filters.instrumentKind)||discovery.some(item=>item.resourceVersionId===card.resourceVersionId&&instrumentMatches(item))) && terms.every(term => [card.title, card.subtitle, card.summary, card.edition, card.publisher, card.institution, card.type, ...card.topics, ...card.sectors, ...card.geographies, ...discovery.filter(item=>item.resourceVersionId===card.resourceVersionId&&instrumentMatches(item)).map(item=>[item.title,item.kind,item.workProductType,...item.topics].join(' ')), ...card.authors.map(author => typeof author === 'string' ? author : [author.literal, author.family, author.given].filter(Boolean).join(' ')), ...card.identifiers.map(item => item.value)].join(' ').toLowerCase().includes(term)));
  const versionIds = new Set(cards.map(card => card.resourceVersionId));
  const collections = catalog.collections.filter(collection => !publicAudience(audience) || collection.curation.status === 'approved' && collection.curation.audience === 'public').map(collection => ({id: collection.id, title: collection.title, description: collection.description, topics: clone(collection.topics), resourceVersionIds: collection.resourceVersionIds.filter(value => versionIds.has(value))})).filter(collection => collection.resourceVersionIds.length);
  const matching = filters.collectionId ? cards.filter(card => collections.some(collection => collection.id === filters.collectionId && collection.resourceVersionIds.includes(card.resourceVersionId))) : cards;
  const matchingIds = new Set(matching.map(card => card.resourceVersionId));
  return {schemaVersion: 1, audience, resources: matching, versions: clone(matching), total: matching.length, facets: facetsFor(matching),
    instrumentIndex: discovery.filter(item=>matchingIds.has(item.resourceVersionId)&&instrumentMatches(item)),
    instruments: catalog.instruments.filter(item => matchingIds.has(item.resourceVersionId)).map(item => safeInstrument(catalog, item, audience)).filter(Boolean),
    mappings: catalog.mappings.filter(item => matchingIds.has(item.resourceVersionId) && (!publicAudience(audience) || item.verificationStatus === 'verified')).map(item => ({id: item.id, resourceVersionId: item.resourceVersionId, frameworkId: item.frameworkId, edition: item.edition, standardIds: clone(item.standardIds), topics: clone(item.topics), ...(item.topic ? {topic: item.topic} : {}), type: item.type, ...(!publicAudience(audience) || isPublicVersion({curation: item.curation}) ? {rationale: item.rationale} : {}), verificationStatus: item.verificationStatus, source: Object.fromEntries(['locator', 'page', 'section', 'paragraph', 'table'].filter(key => item.source[key] !== undefined).map(key => [key, clone(item.source[key])]))})),
    collections: collections.map(collection => ({...collection, resourceVersionIds: collection.resourceVersionIds.filter(value => matchingIds.has(value))})).filter(collection => collection.resourceVersionIds.length),
    institutions: catalog.institutions.filter(item => !publicAudience(audience) || matching.some(card => card.institutionId === item.id)).map(item => ({id: item.id, name: item.name, officialUrl: item.officialUrl}))};
}

export function resourceDetail(input, versionId, {audience = 'practitioner'} = {}) {
  const catalog = normalizeCatalog(input), version = catalog.versions.find(item => item.id === versionId);
  if (!version || !visible(version, audience)) return null;
  const projection = projectResourceCatalog(catalog, {audience}), card = projection.resources.find(item => item.resourceVersionId === versionId);
  const files = catalog.files.filter(file => file.resourceVersionId === versionId).flatMap(file => {
    const source = file.rights ? {...version, rights: file.rights} : version;
    const allowed = evaluateResourceRight(version, 'download', {audience}).allowed && evaluateResourceRight(source, 'download', {audience}).allowed;
    if (publicAudience(audience) && !allowed) return [];
    return [{id: file.id, resourceVersionId: versionId, filename: file.filename, mediaType: file.mediaType, size: file.size, sha256: file.sha256, downloadable: allowed, ...(!publicAudience(audience) ? {sourceUrl: file.sourceUrl, extraction: clone(file.extraction || {})} : {})}];
  });
  return {...card, files, instruments: projection.instruments.filter(item => item.resourceVersionId === versionId), instrumentIndex: projection.instrumentIndex.filter(item=>item.resourceVersionId===versionId), mappings: projection.mappings.filter(item => item.resourceVersionId === versionId), relatedVersions: projection.resources.filter(item => item.resourceId === version.resourceId && item.resourceVersionId !== versionId), collections: projection.collections.filter(item => item.resourceVersionIds.includes(versionId))};
}

/** Portable exact-edition citation snapshot. It contains no source body or grant. */
export function bibliographyReference(input, versionId) {
  const catalog = normalizeCatalog(input), version = catalog.versions.find(item => item.id === versionId);assert(version, 'Choose an existing exact ResourceVersion for the bibliography.');
  const card = cardFor(catalog, version, 'practitioner');
  const citation = Object.fromEntries(['resourceId', 'resourceVersionId', 'title', 'subtitle', 'translatedTitle', 'type', 'authors', 'publisher', 'publicationDate', 'edition', 'officialUrl', 'identifiers', 'language', 'series', 'reportNumber'].filter(key => card[key] !== undefined).map(key => [key, clone(card[key])]));
  return {resourceId: card.resourceId, resourceVersionId: card.resourceVersionId, title: card.title, edition: card.edition, officialUrl: card.officialUrl, citation};
}
