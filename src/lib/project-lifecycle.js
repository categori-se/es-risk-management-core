// The ledger extends account-owned project context. Project, source and review
// identities are resolved by the owning adapters; this module allocates none.
import {getSectorProfile} from './sector-risk-profiles.js';
export const lifecycleCollections = Object.freeze([
  'components', 'sites', 'activities', 'organizations', 'roleAssignments',
  'investments', 'financialFacilities', 'transactions', 'financingParticipants',
  'allocations', 'agreements', 'covenants', 'engagementScopes',
  'requirementApplicabilities', 'lifecycleEvents'
]);
export const lifecyclePhases = Object.freeze(['origination', 'screening', 'due_diligence', 'appraisal', 'commitment', 'construction', 'operations', 'restructuring', 'exit', 'post_closure']);
export const lifecycleLimits = Object.freeze({projects: 100, records: 2000, collection: 500, bytes: 4 * 1024 * 1024, revisions: 250});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function lifecycleAssert(test, message, status = 400) {if (!test) throw Object.assign(new Error(message), {status});}
const check = lifecycleAssert;
export function lifecycleKeys(value, fields, label) {check(object(value) && Object.keys(value).every(key => fields.includes(key)), `${label} contains unsupported fields.`);}
const id = value => check(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$(?![\s\S])/.test(value), 'Use an exact stable application identifier.');
const string = value => check(typeof value === 'string' && value.trim().length > 0 && value.length <= 16000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value), 'Use bounded non-empty text.');
const short = value => {string(value);check(value.length <= 500, 'Use text of at most 500 characters.');};
const sha = value => check(typeof value === 'string' && /^[a-f0-9]{64}$(?![\s\S])/.test(value), 'Use an exact SHA-256.');
export function lifecycleTimestamp(value) {check(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$(?![\s\S])/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'Use an exact ISO UTC timestamp.');}
function date(value) {check(typeof value === 'string' && /^\d{4}-\d\d-\d\d$(?![\s\S])/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Use a real calendar date.');}
const choice = values => value => check(values.includes(value), 'Choose a supported value.');
const ids = value => {check(Array.isArray(value) && value.length <= 500, 'Use at most 500 reference IDs.');value.forEach(id);check(new Set(value).size === value.length, 'Reference IDs must be unique.');};
const uri = value => {short(value);try {const parsed = new URL(value);check(!parsed.username && !parsed.password && ['https:', 'http:', 'urn:'].includes(parsed.protocol), 'Use a credential-free namespaced reference.');} catch {check(false, 'Use an absolute namespace URI.');}};
export function lifecycleDecimal(value, scale = 12) {check(typeof value === 'string' && new RegExp(`^(0|[1-9]\\d{0,17})(\\.\\d{1,${scale}})?$(?![\\s\\S])`).test(value), 'Use a non-negative exact decimal string, not a floating point number.');const [whole, part = ''] = value.split('.');return BigInt(whole) * 10n ** BigInt(scale) + BigInt(part.padEnd(scale, '0'));}
const percent = value => check(lifecycleDecimal(value, 6) <= 100000000n, 'Share percentages must be between zero and 100.');
function money(value) {lifecycleKeys(value, ['amount', 'currency'], 'Money');lifecycleDecimal(value.amount);check(typeof value.currency === 'string' && /^[A-Z]{3}$(?![\s\S])/.test(value.currency), 'Money requires a three-letter currency code.');}
function source(value) {lifecycleKeys(value, ['projectId', 'resourceId', 'versionId', 'sha256'], 'Exact source');for (const key of ['projectId', 'resourceId', 'versionId']) id(value[key]);sha(value.sha256);}
function existing(value) {lifecycleKeys(value, ['engagementId', 'id', 'revision'], 'Existing review reference');id(value.engagementId);id(value.id);if (value.revision !== undefined) check(Number.isSafeInteger(value.revision) && value.revision > 0, 'Use a positive review record revision.');}
const list = validate => value => {check(Array.isArray(value) && value.length <= 500, 'Use a bounded array.');value.forEach(validate);};
function extensions(value, registered = []) {
  check(object(value) && Object.keys(value).length <= 20, 'Use a bounded extension object.');
  for (const [namespace, extension] of Object.entries(value)) {
    check(/^[a-z][a-z0-9_.-]*:[A-Za-z0-9_.-]+$/.test(namespace) && registered.includes(namespace), 'Extension namespaces require an explicitly registered validator.');
    lifecycleKeys(extension, ['schema', 'schemaVersion', 'value'], 'Extension');uri(extension.schema);check(Number.isSafeInteger(extension.schemaVersion) && extension.schemaVersion > 0 && Object.hasOwn(extension, 'value'), 'Use a versioned extension value.');
  }
}
export const lifecycleRecordFields = Object.freeze({
  components: {projectId: id, name: short, kind: choice(['component', 'associated_facility', 'subcomponent']), 'parentComponentId?': id, 'associatedProjectId?': id},
  sites: {projectId: id, name: short, componentIds: ids, 'countryCode?': value => check(/^[A-Z]{2}$/.test(value), 'Use a two-letter country code.'), 'latitude?': value => check(typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90, 'Latitude is outside WGS84 bounds.'), 'longitude?': value => check(typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180, 'Longitude is outside WGS84 bounds.'), 'geometrySource?': source},
  activities: {projectId: id, name: short, kind: short, 'componentId?': id, siteIds: ids, 'sectorProfileId?': value => {id(value);check(Boolean(getSectorProfile(value)), 'Choose an existing application sector profile; this is not an institutional risk category.');}},
  organizations: {name: short, kind: choice(['company', 'government', 'dfi', 'bank', 'fund', 'financial_intermediary', 'cso', 'community', 'other']), 'legalName?': short},
  roleAssignments: {organizationId: id, role: choice(['owner', 'sponsor', 'investor', 'lender', 'borrower', 'operator', 'contractor', 'guarantor', 'advisor', 'regulator', 'intermediary', 'fund_manager', 'other']), 'projectId?': id, 'componentId?': id, 'investmentId?': id, 'financialFacilityId?': id, 'agreementId?': id},
  investments: {name: short, kind: choice(['direct', 'fund', 'intermediary', 'subinvestment']), investorOrganizationId: id, 'investeeOrganizationId?': id, 'parentInvestmentId?': id, 'amount?': money, status: choice(['proposed', 'approved', 'committed', 'active', 'exited', 'cancelled'])},
  financialFacilities: {name: short, kind: choice(['loan', 'equity', 'guarantee', 'grant', 'credit_line', 'fund_commitment', 'other']), borrowerOrganizationId: id, 'parentFacilityId?': id, agreementIds: ids, 'commitment?': money},
  transactions: {investmentId: id, 'financialFacilityId?': id, 'agreementId?': id, kind: choice(['commitment', 'disbursement', 'repayment', 'equity_subscription', 'distribution', 'guarantee', 'fee', 'cancellation']), amount: money, transactionDate: date, status: choice(['proposed', 'approved', 'executed', 'reversed'])},
  financingParticipants: {financialFacilityId: id, organizationId: id, role: choice(['lender', 'investor', 'guarantor', 'agent', 'arranger', 'participant']), 'commitment?': money, 'sharePercent?': percent},
  allocations: {investmentId: id, projectId: id, 'componentId?': id, 'amount?': money, 'sharePercent?': percent},
  agreements: {name: short, kind: choice(['financing', 'engagement', 'concession', 'guarantee', 'grant', 'other']), organizationIds: ids, projectIds: ids, financialFacilityIds: ids, sourceVersions: list(source), 'signedOn?': date, status: choice(['draft', 'signed', 'effective', 'amended', 'terminated'])},
  covenants: {agreementId: id, title: short, text: string, 'projectId?': id, componentIds: ids, 'source?': source, 'locator?': string, 'dueDate?': date, requirementRefs: list(existing), monitoringObligationRefs: list(existing)},
  engagementScopes: {engagementId: id, projectId: id, componentIds: ids, siteIds: ids, 'periodStart?': date, 'periodEnd?': date, 'description?': string},
  requirementApplicabilities: {projectId: id, frameworkEditionId: id, requirementRef: existing, decision: choice(['applicable', 'not_applicable', 'uncertain']), rationale: string, componentIds: ids, 'investmentId?': id, 'financialFacilityId?': id, 'agreementId?': id, assessedAt: lifecycleTimestamp, assessedBy: id},
  lifecycleEvents: {projectId: id, phase: choice(lifecyclePhases), status: choice(['planned', 'in_progress', 'completed', 'cancelled']), title: short, 'engagementId?': id, 'cycleId?': id, 'eventId?': id, 'actionId?': id, 'baselineId?': id, 'baselineSha256?': sha}
});
export const lifecycleCommonFields = Object.freeze(['id', 'revision', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'effectiveFrom', 'effectiveTo', 'eventAt', 'recordedAt', 'provenance', 'externalReferences', 'extensions']);
export function validateLifecycleRecord(collection, record, {registeredExtensions = []} = {}) {
  const fields = lifecycleRecordFields[collection];check(fields, 'Choose a lifecycle collection.');
  lifecycleKeys(record, [...lifecycleCommonFields, ...Object.keys(fields).map(key => key.replace(/\?$/, ''))], 'Lifecycle record');
  id(record.id);check(Number.isSafeInteger(record.revision) && record.revision > 0, 'Use a positive record revision.');
  for (const key of ['createdAt', 'updatedAt', 'recordedAt']) lifecycleTimestamp(record[key]);for (const key of ['createdBy', 'updatedBy']) id(record[key]);
  if (record.eventAt !== undefined) lifecycleTimestamp(record.eventAt);
  for (const key of ['effectiveFrom', 'effectiveTo']) if (record[key] !== undefined) date(record[key]);
  check(!record.effectiveFrom || !record.effectiveTo || record.effectiveFrom <= record.effectiveTo, 'Effective dates are reversed.');
  for (const [field, validate] of Object.entries(fields)) {const key = field.replace(/\?$/, '');if (field.endsWith('?') && record[key] === undefined) continue;validate(record[key]);}
  const p = record.provenance;lifecycleKeys(p, ['kind', 'actorId', 'at', 'method', 'model', 'promptSha256', 'sourceVersions', 'reviewStatus', 'reviewedBy', 'reviewedAt'], 'Provenance');
  choice(['human', 'import', 'extraction', 'ai'])(p.kind);id(p.actorId);lifecycleTimestamp(p.at);list(source)(p.sourceVersions);choice(['unreviewed', 'verified', 'rejected'])(p.reviewStatus);
  if (p.method !== undefined) string(p.method);if (p.model !== undefined) short(p.model);if (p.promptSha256 !== undefined) sha(p.promptSha256);
  check(p.kind !== 'ai' || Boolean(p.model && p.method), 'AI proposals must identify their model and method.');
  if (p.reviewStatus !== 'unreviewed') {id(p.reviewedBy);lifecycleTimestamp(p.reviewedAt);} else check(p.reviewedBy === undefined && p.reviewedAt === undefined, 'Unreviewed proposals cannot claim a reviewer.');
  list(value => {lifecycleKeys(value, ['namespace', 'value', 'label'], 'External reference');uri(value.namespace);short(value.value);if (value.label !== undefined) short(value.label);})(record.externalReferences);
  check(new Set(record.externalReferences.map(ref => `${ref.namespace}\0${ref.value}`)).size === record.externalReferences.length, 'External aliases must be unique.');extensions(record.extensions, registeredExtensions);
  return record;
}

function inspectLifecycleSnapshot(graph, {registeredExtensions = []} = {}) {
  lifecycleKeys(graph, ['context', 'revision', 'projects', 'entities', 'extensions'], 'Lifecycle snapshot');lifecycleKeys(graph.context, ['accountId'], 'Lifecycle account');id(graph.context.accountId);
  check(Number.isSafeInteger(graph.revision) && graph.revision >= 0, 'Use a non-negative ledger revision.');
  check(Array.isArray(graph.projects) && graph.projects.length <= lifecycleLimits.projects, 'Select at most 100 existing projects.');
  const projectIds = new Set();for (const p of graph.projects) {lifecycleKeys(p, ['projectId', 'identityId'], 'Existing project reference');id(p.projectId);id(p.identityId);check(!projectIds.has(p.projectId), 'Project references must be unique.');projectIds.add(p.projectId);}
  lifecycleKeys(graph.entities, lifecycleCollections, 'Lifecycle collections');const records = new Map();let count = 0;
  for (const name of lifecycleCollections) {const rows = graph.entities[name];check(Array.isArray(rows) && rows.length <= lifecycleLimits.collection, 'Use at most 500 records per collection.');count += rows.length;for (const row of rows) {validateLifecycleRecord(name, row, {registeredExtensions});check(!records.has(row.id), 'Record IDs must be unique across the ledger.');records.set(row.id, {collection: name, record: row});}}
  check(count <= lifecycleLimits.records, 'The ledger exceeds its bounded record count.', 413);extensions(graph.extensions, registeredExtensions);
  return {records};
}
export function validateLifecycleSnapshotShape(graph, options) {inspectLifecycleSnapshot(graph, options);return graph;}
export function validateLifecycleGraph(graph, {getProject, getEngagement, getSource, getFramework, registeredExtensions = []} = {}) {
  const {records} = inspectLifecycleSnapshot(graph, {registeredExtensions});
  const projects = new Map();for (const p of graph.projects) {const current = getProject(p.projectId);check(current.projectContext?.identity?.id === p.identityId, 'The existing project identity link changed or is missing.', 409);projects.set(p.projectId, current);}
  const project = key => {check(projects.has(key), 'A relationship names a project outside this account ledger.');return projects.get(key);};
  const ref = (name, key) => {const entry = records.get(key);check(entry?.collection === name, `A relationship names an unknown ${name} record.`);return entry.record;};
  const sameProject = (name, key, projectId) => {const row = ref(name, key);check(row.projectId === projectId, 'A component, site or activity belongs to a different project.');return row;};
  const sourceCache = new Map(), engagementCache = new Map();
  const exact = value => {project(value.projectId);const key = `${value.projectId}\0${value.resourceId}\0${value.versionId}`;if (!sourceCache.has(key)) sourceCache.set(key, getSource(value));const actual = sourceCache.get(key);check(actual?.resourceId === value.resourceId && actual.id === value.versionId && actual.sha256 === value.sha256, 'An exact source reference no longer matches its owning document version.', 409);};
  const engagement = (key, projectId) => {if (!engagementCache.has(key)) engagementCache.set(key, getEngagement(key));const current = engagementCache.get(key);check(projects.has(current.projectId) && (!projectId || current.projectId === projectId), 'The existing engagement belongs to a different project.');return current;};
  const reviewRef = (value, name, projectId) => {const e = engagement(value.engagementId, projectId), row = (e[name] || []).find(item => item.id === value.id), selected = value.revision === undefined ? row : [row, ...(row?.history || [])].find(item => item?.revision === value.revision);check(selected, 'A linked review record or revision does not exist.', 409);return selected;};
  const acyclic = (name, parent) => {for (const row of graph.entities[name]) {const seen = new Set([row.id]);let current = row;while (current[parent]) {check(!seen.has(current[parent]), 'Hierarchy relationships cannot contain a cycle.');seen.add(current[parent]);current = ref(name, current[parent]);}}};
  for (const [name, rows] of Object.entries(graph.entities)) for (const row of rows) {
    if (row.projectId) project(row.projectId);
    for (const src of row.provenance.sourceVersions) exact(src);
    if (name === 'components') {if (row.parentComponentId) sameProject('components', row.parentComponentId, row.projectId);if (row.associatedProjectId) {project(row.associatedProjectId);check(row.kind === 'associated_facility' && row.associatedProjectId !== row.projectId, 'Associated project links require an associated facility and a distinct project identity.');}}
    if (name === 'sites') {check((row.latitude === undefined) === (row.longitude === undefined), 'Record both WGS84 coordinates together.');row.componentIds.forEach(key => sameProject('components', key, row.projectId));if (row.geometrySource) {exact(row.geometrySource);check(row.geometrySource.projectId === row.projectId, 'A geometry source must belong to its project.');}}
    if (name === 'activities') {if (row.componentId) sameProject('components', row.componentId, row.projectId);row.siteIds.forEach(key => sameProject('sites', key, row.projectId));}
    if (name === 'roleAssignments') {ref('organizations', row.organizationId);check(['projectId', 'componentId', 'investmentId', 'financialFacilityId', 'agreementId'].some(key => row[key]), 'Organization roles require an explicit scope.');for (const [key, target] of [['componentId', 'components'], ['investmentId', 'investments'], ['financialFacilityId', 'financialFacilities'], ['agreementId', 'agreements']]) if (row[key]) {const linked = ref(target, row[key]);if (row.projectId && linked.projectId) check(linked.projectId === row.projectId, 'Organization role scopes conflict.');}}
    if (name === 'investments') {ref('organizations', row.investorOrganizationId);if (row.investeeOrganizationId) ref('organizations', row.investeeOrganizationId);if (row.parentInvestmentId) check(['fund', 'intermediary', 'subinvestment'].includes(ref('investments', row.parentInvestmentId).kind), 'A parent investment must represent an intermediary or fund chain.');check(row.kind !== 'subinvestment' || Boolean(row.parentInvestmentId), 'Subinvestments require their parent investment.');}
    if (name === 'financialFacilities') {ref('organizations', row.borrowerOrganizationId);if (row.parentFacilityId) ref('financialFacilities', row.parentFacilityId);row.agreementIds.forEach(key => ref('agreements', key));}
    if (name === 'transactions') {ref('investments', row.investmentId);if (row.financialFacilityId) ref('financialFacilities', row.financialFacilityId);if (row.agreementId) ref('agreements', row.agreementId);}
    if (name === 'financingParticipants') {const facility = ref('financialFacilities', row.financialFacilityId);ref('organizations', row.organizationId);if (facility.commitment && row.commitment) check(facility.commitment.currency === row.commitment.currency, 'Participant and facility commitments require the same currency.');}
    if (name === 'allocations') {const investment = ref('investments', row.investmentId);if (row.componentId) sameProject('components', row.componentId, row.projectId);check(row.amount !== undefined || row.sharePercent !== undefined, 'Record an allocation amount or share.');if (investment.amount && row.amount) check(investment.amount.currency === row.amount.currency, 'Allocation and investment amounts require the same currency.');}
    if (name === 'agreements') {check(row.organizationIds.length && row.projectIds.length, 'Agreements require parties and project scope.');row.organizationIds.forEach(key => ref('organizations', key));row.projectIds.forEach(project);row.financialFacilityIds.forEach(key => ref('financialFacilities', key));row.sourceVersions.forEach(src => {exact(src);check(row.projectIds.includes(src.projectId), 'Agreement originals must belong to its declared project scope.');});}
    if (name === 'covenants') {const agreement = ref('agreements', row.agreementId);if (row.projectId) check(agreement.projectIds.includes(row.projectId), 'A covenant falls outside its agreement.');row.componentIds.forEach(key => {const component = ref('components', key);check(agreement.projectIds.includes(component.projectId) && (!row.projectId || component.projectId === row.projectId), 'A covenant component falls outside its scope.');});check(Boolean(row.source) === Boolean(row.locator), 'Covenants require their exact agreement source and locator together.');if (row.source) {exact(row.source);check(agreement.sourceVersions.some(src => src.projectId === row.source.projectId && src.resourceId === row.source.resourceId && src.versionId === row.source.versionId && src.sha256 === row.source.sha256), 'Covenants require an exact agreement source and locator.');}row.requirementRefs.forEach(value => reviewRef(value, 'requirements', row.projectId));row.monitoringObligationRefs.forEach(value => reviewRef(value, 'monitoringObligations', row.projectId));}
    if (name === 'engagementScopes') {engagement(row.engagementId, row.projectId);row.componentIds.forEach(key => sameProject('components', key, row.projectId));row.siteIds.forEach(key => sameProject('sites', key, row.projectId));check(!row.periodStart || !row.periodEnd || row.periodStart <= row.periodEnd, 'Engagement scope dates are reversed.');}
    if (name === 'requirementApplicabilities') {check(Boolean(getFramework(row.frameworkEditionId)), 'Choose an existing versioned framework edition.');const requirement = reviewRef(row.requirementRef, 'requirements', row.projectId);check(requirement.frameworkId === row.frameworkEditionId, 'A requirement belongs to a different framework edition.');row.componentIds.forEach(key => sameProject('components', key, row.projectId));for (const [key, target] of [['investmentId', 'investments'], ['financialFacilityId', 'financialFacilities'], ['agreementId', 'agreements']]) if (row[key]) ref(target, row[key]);}
    if (name === 'lifecycleEvents') {check(!['cycleId', 'eventId', 'actionId', 'baselineId'].some(key => row[key]) || Boolean(row.engagementId), 'Review references require their owning engagement.');if (row.engagementId) {const e = engagement(row.engagementId, row.projectId);for (const [key, target] of [['cycleId', 'cycles'], ['eventId', 'events'], ['actionId', 'actions'], ['baselineId', 'baselines']]) if (row[key]) {const value = e[target]?.find(item => item.id === row[key]);check(Boolean(value), 'A lifecycle link names an unknown review record.');if (key === 'baselineId') {check(value.sha256 === row.baselineSha256, 'An approved baseline hash must match its immutable original.');check(Boolean(row.eventAt), 'Pin the lifecycle event date when linking an approved assessment baseline.');if (row.cycleId) check(value.scope?.cycleId === row.cycleId, 'A lifecycle cycle must match the exact approved baseline period.');}if (row.cycleId && ['eventId', 'actionId'].includes(key) && value.cycleId) check(value.cycleId === row.cycleId, 'A lifecycle event or action belongs to a different monitoring period.');}}check(Boolean(row.baselineId) === Boolean(row.baselineSha256), 'Approved baseline references require ID and hash together.');}
  }
  acyclic('components', 'parentComponentId');acyclic('investments', 'parentInvestmentId');acyclic('financialFacilities', 'parentFacilityId');
  for (const facility of graph.entities.financialFacilities) for (const agreementId of facility.agreementIds) check(ref('agreements', agreementId).financialFacilityIds.includes(facility.id), 'Facility and agreement relationship views disagree.');
  for (const agreement of graph.entities.agreements) for (const facilityId of agreement.financialFacilityIds) check(ref('financialFacilities', facilityId).agreementIds.includes(agreement.id), 'Agreement and facility relationship views disagree.');
  function totals(rows, parentKey, parents, amountKey, parentAmountKey) {
    for (const parent of parents) {
      const selected = rows.filter(row => row[parentKey] === parent.id), boundaries = new Set(['0001-01-01']);
      for (const row of selected) {if (row.effectiveFrom) boundaries.add(row.effectiveFrom);if (row.effectiveTo && row.effectiveTo !== '9999-12-31') boundaries.add(new Date(Date.parse(row.effectiveTo) + 86400000).toISOString().slice(0, 10));}
      for (const at of boundaries) {
        const active = selected.filter(row => (!row.effectiveFrom || row.effectiveFrom <= at) && (!row.effectiveTo || row.effectiveTo >= at));
        const share = active.reduce((sum, row) => sum + (row.sharePercent === undefined ? 0n : lifecycleDecimal(row.sharePercent, 6)), 0n);check(share <= 100000000n, 'Allocation or participation shares exceed 100 percent in an effective period.');
        const ceiling = parent[parentAmountKey];if (ceiling) {const total = active.reduce((sum, row) => sum + (row[amountKey]?.currency === ceiling.currency ? lifecycleDecimal(row[amountKey].amount) : 0n), 0n);check(total <= lifecycleDecimal(ceiling.amount), 'Allocated or participated amounts exceed their recorded commitment in an effective period.');}
      }
    }
  }
  totals(graph.entities.allocations, 'investmentId', graph.entities.investments, 'amount', 'amount');totals(graph.entities.financingParticipants, 'financialFacilityId', graph.entities.financialFacilities, 'commitment', 'commitment');
  return graph;
}

// Currency groups stay distinct. Parent investment and subinvestment exposures
// are never added together; only leaf investments enter portfolio totals.
export function lifecyclePortfolio(graph, investmentId, {asOf = new Date().toISOString().slice(0, 10)} = {}) {
  date(asOf);
  const children = new Map();for (const row of graph.entities.investments) {const key = row.parentInvestmentId || '';if (!children.has(key)) children.set(key, []);children.get(key).push(row);}
  const selected = investmentId ? graph.entities.investments.filter(row => row.id === investmentId) : children.get('') || [];
  check(!investmentId || selected.length === 1, 'The selected investment is unavailable.', 404);
  const leaves = [];function visit(row) {const nested = children.get(row.id) || [];if (nested.length) nested.forEach(visit);else leaves.push(row);}selected.forEach(visit);
  const leafIds = new Set(leaves.map(row => row.id)), allocations = graph.entities.allocations.filter(row => leafIds.has(row.investmentId) && (!row.effectiveFrom || row.effectiveFrom <= asOf) && (!row.effectiveTo || row.effectiveTo >= asOf)), sums = new Map();
  for (const row of allocations) if (row.amount) sums.set(row.amount.currency, (sums.get(row.amount.currency) || 0n) + lifecycleDecimal(row.amount.amount));
  const decimal = value => `${value / 1000000000000n}.${String(value % 1000000000000n).padStart(12, '0')}`.replace(/\.?0+$/, '');
  return {investmentId: investmentId || null, asOf, leafInvestmentIds: [...leafIds], projectIds: [...new Set(allocations.map(row => row.projectId))], allocationIds: allocations.map(row => row.id), amounts: [...sums].sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => ({currency, amount: decimal(value)})), unpricedAllocationIds: allocations.filter(row => !row.amount).map(row => row.id), meaning: 'Recorded leaf allocations effective on the selected date, grouped by currency; no foreign-exchange conversion, inferred compliance or duplication of parent investment exposure.'};
}
