// Frozen, already-authorized practitioner packets only. This module reads no
// source stores and establishes neither access nor institutional clearance.
const MAX_BYTES = 4 * 1024 * 1024;
const PROFILE_FIELDS = ['institution', 'country', 'region', 'sector', 'themes', 'leadOfficer', 'regionalTeam', 'complexity', 'nextReviewDate'];
const CLASSIFICATIONS = ['institution', 'country', 'region', 'sector', 'themes', 'complexity'];
const SCALE_FIELDS = ['institution', 'dimension', 'scaleId', 'scaleName', 'scaleVersion', 'scaleSource'];
const PRODUCT_TYPES = ['opinion', 'rating', 'issue', 'visit', 'review', 'program'];
const KINDS = ['senior_management', 'regional_program', 'integrated_risk'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fail = (message, status = 400) => {throw Object.assign(new TypeError(message), {status});};
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value) ? value : fail('Use exact frozen snapshot, project and record identifiers.');
const custody = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/.test(value) ? value : fail('A comparison needs exact permanent custody identities.');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}(?![\s\S])/.test(value) ? value : fail('A frozen snapshot or source digest is invalid.');
const text = (value, maximum = 1000, required = false) => typeof value === 'string' && value.length <= maximum && (!required || value.trim()) && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ? value : fail('Frozen comparison metadata must be bounded text.');
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : fail('Frozen comparison revisions and counters must be non-negative integers.');
const counter = value => count(value) <= 500 ? value : fail('A frozen project counter exceeds the bounded record limit.');
const revision = value => count(value) > 0 ? value : fail('A reviewed record needs a positive revision.');
const oneOf = (value, values) => values.includes(value) ? value : fail('Frozen comparison metadata has an unsupported value.');
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail('Use valid frozen YYYY-MM-DD dates.');
  return value;
}
function timestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('Use a complete frozen UTC observation timestamp.');
  return value;
}
function boundedJson(value, label) {
  let serialized;try {serialized = JSON.stringify(value);} catch {fail(`${label} must contain finite JSON records.`);}
  if (typeof serialized !== 'string') fail(`${label} must contain JSON records.`);
  if (new TextEncoder().encode(serialized).byteLength > MAX_BYTES) fail(`${label} exceeds the 4 MiB comparison limit.`, 413);
}
function list(value, maximum, label) {if (!Array.isArray(value) || value.length > maximum) fail(`${label} must be a bounded array.`);return value;}
function unique(values, key, label) {
  const seen = new Set();for (const value of values) {const identity = key(value);if (seen.has(identity)) fail(`Duplicate ${label} in a frozen snapshot.`);seen.add(identity);}return values;
}
const scopeKey = (accountId, projectId) => JSON.stringify([accountId, projectId]);
const equal = (before, after) => JSON.stringify(before) === JSON.stringify(after);
const sortedKeys = values => [...values].sort();
function filters(value) {
  if (!object(value) || Object.keys(value).some(key => !['institution', 'region', 'sector', 'theme', 'q'].includes(key))) fail('Frozen comparison filters are invalid.');
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, text(value[key], 500)]));
}
function sourceUrl(value) {
  text(value, 4000);if (!value) return value;
  let url;try {url = new URL(value);} catch {fail('Rating source references must be credential-free HTTP(S) URLs.');}
  const secret = /^(?:token|.*[_-]token|auth|authorization|code|bearer|jwt|.*[_-]key|key|password|passwd|secret|.*[_-]secret|session(?:id|[_-]id|[_-]token)?|sid|signature|sig|credential|credentials|x-amz-.+|x-goog-.+|awsaccesskeyid|googleaccessid|key-pair-id|policy|rlkey|resourcekey)$/i;
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()].some(key => secret.test(key.replace(/\[\d*\]$/, '').replace(/[.\s]/g, '-')))) fail('Rating source references must omit credentials and signed links.');
  return value; // Preserve the exact frozen scale identity; do not normalize it.
}
function profile(value) {
  if (!object(value)) fail('A frozen project profile is required.');
  const result = {};
  for (const field of PROFILE_FIELDS) result[field] = field === 'themes' ? unique(list(value.themes, 30, 'Profile themes').map(theme => text(theme, 120, true)), theme => theme, 'theme') : text(value[field], 1000);
  oneOf(result.institution, ['', 'IFC', 'MIGA', 'IBRD_IDA', 'other']);oneOf(result.complexity, ['', 'routine', 'complex']);if (result.nextReviewDate) date(result.nextReviewDate);
  return result;
}
function rating(value) {
  if (!object(value)) fail('A frozen rating must be a record.');
  const result = {recordId: id(value.recordId), recordRevision: revision(value.recordRevision ?? value.revision), asOf: date(value.asOf),
    institution: oneOf(value.institution, ['IFC', 'MIGA', 'IBRD_IDA', 'other']), dimension: oneOf(value.dimension, ['performance', 'inherent']), scaleId: id(value.scaleId),
    scaleName: text(value.scaleName), scaleVersion: text(value.scaleVersion, 1000, true), scaleSource: sourceUrl(value.scaleSource), value: text(value.value, 1000, true)};
  result.key = JSON.stringify(SCALE_FIELDS.map(field => result[field]));
  if (value.scaleKey !== undefined && value.scaleKey !== result.key) fail('A frozen rating has a conflicting scale identity.');
  return result;
}
function issue(value) {
  if (!object(value)) fail('A frozen issue must be a record.');
  return {recordId: id(value.recordId), title: text(value.title, 1000, true), state: oneOf(value.state, ['', 'open', 'in_progress', 'resolved']), severity: oneOf(value.severity, ['', 'low', 'moderate', 'high', 'critical'])};
}
function product(value) {
  if (!object(value)) fail('A reviewed work product must be a record.');
  if (value.type === 'grievance') return null; // No direct case metadata enters a comparison.
  oneOf(value.type, PRODUCT_TYPES);if (value.status !== 'approved' || !object(value.values)) fail('Only reviewed work product metadata can be compared.');
  return {recordId: id(value.recordId), type: value.type, title: text(value.values.title, 1000, true), revision: revision(value.revision)};
}
function project(value) {
  if (!object(value)) fail('A frozen project must be a record.');
  const accountId = custody(value.accountId), projectId = id(value.projectId), key = scopeKey(accountId, projectId);
  if (value.scopeKey !== key) fail('A project comparison scope must match its exact custody and project IDs.');
  if (!object(value.grievanceSummary) || typeof value.unrated !== 'boolean') fail('Frozen project counters are invalid.');
  const canonicalProjectId = value.canonicalProjectId == null ? null : custody(value.canonicalProjectId);
  const summary = {accountId, projectId, accountName: text(value.accountName, 500, true), name: text(value.name, 2000, true), canonicalProjectId,
    canonicalProjectName: canonicalProjectId && value.canonicalProjectName != null ? text(value.canonicalProjectName, 2000, true) : null,
    revision: count(value.revision), profile: profile(value.profile), pendingReviews: counter(value.pendingReviews), overdueActions: counter(value.overdueActions), unrated: value.unrated,
    grievanceSummary: Object.fromEntries(['total', 'open', 'overdueResponses'].map(field => [field, counter(value.grievanceSummary[field])]))};
  if (summary.grievanceSummary.open > summary.grievanceSummary.total || summary.grievanceSummary.overdueResponses > summary.grievanceSummary.open) fail('Frozen complaint counters are inconsistent.');
  const ratings = unique(list(value.latestRatings, 500, 'Latest ratings').map(rating), item => item.key, 'rating scale');
  unique(ratings, item => item.recordId, 'rating record');
  if (summary.unrated !== !ratings.some(item => item.dimension === 'performance')) fail('The frozen performance-rating availability counter is inconsistent.');
  const issues = unique(list(value.issues, 500, 'Reviewed issues').map(issue), item => item.recordId, 'issue record');
  const products = unique(list(value.workProducts, 500, 'Reviewed work products').map(product).filter(Boolean), item => item.recordId, 'work product record');
  summary.issueCount = issues.length;summary.workProductCount = products.length;
  return {scopeKey: key, summary, ratings, issues, products, runtimeAccountId: id(value.runtimeAccountId)};
}
function observation(value) {
  if (!object(value)) fail('A frozen source observation is required.');
  const accountId = id(value.accountId), custodyId = custody(value.custodyId), projectId = id(value.projectId), key = scopeKey(custodyId, projectId);
  if (value.scopeKey !== key) fail('Frozen source observation custody is inconsistent.');
  const canonicalProjectId = value.canonicalProjectId == null ? null : custody(value.canonicalProjectId);
  return {scopeKey: key, accountId, custodyId, projectId, status: oneOf(value.status, ['included', 'excluded']), accountName: text(value.accountName, 500, true), canonicalProjectId,
    canonicalProjectName: canonicalProjectId && value.canonicalProjectName != null ? text(value.canonicalProjectName, 2000, true) : null,
    revision: count(value.revision), sha256: sha(value.sha256), observedAt: timestamp(value.observedAt)};
}
function packet(value) {
  boundedJson(value, 'Frozen snapshot');
  if (!object(value) || value.schemaVersion !== 1 || value.originOwnership !== 'practitioner_consolidation' || value.status !== 'practitioner_snapshot' || !object(value.portfolio) || value.portfolio.schemaVersion !== 1) fail('Compare complete frozen practitioner consolidation snapshots.');
  const start = date(value.periodStart), end = date(value.periodEnd);if (start > end) fail('A frozen reporting period cannot end before it starts.');
  const portfolio = value.portfolio, observations = unique(list(value.scopeProvenance, 100, 'Selected source scope').map(observation), item => item.scopeKey, 'selected custody/project scope');
  if (!observations.length) fail('A frozen packet must retain its selected source scope.');
  const selection = unique(list(portfolio.selection, 100, 'Frozen selection').map(item => {
    if (!object(item)) fail('A frozen selection must identify its source scope.');return scopeKey(id(item.accountId), id(item.projectId));
  }), item => item, 'selection');
  if (selection.length !== observations.length || observations.some(item => !selection.includes(scopeKey(item.accountId, item.projectId)))) fail('Frozen selected scope and retained source provenance do not match.');
  unique(observations, item => scopeKey(item.accountId, item.projectId), 'runtime selection');
  if (portfolio.scopeObservations !== undefined && !equal(list(portfolio.scopeObservations, 100, 'Portfolio scope observations').map(observation), observations)) fail('The packet contains conflicting retained source observations.');
  const projects = unique(list(portfolio.projects, 100, 'Included projects').map(project), item => item.scopeKey, 'included project scope');
  const included = observations.filter(item => item.status === 'included');
  if (!projects.length || projects.length !== included.length || projects.some(item => !included.some(source => source.scopeKey === item.scopeKey && source.accountId === item.runtimeAccountId && source.accountName === item.summary.accountName && source.revision === item.summary.revision && source.canonicalProjectId === item.summary.canonicalProjectId && source.canonicalProjectName === item.summary.canonicalProjectName))) fail('Frozen included projects must match their retained source observations.');
  if (!object(portfolio.summary) || portfolio.summary.projects !== projects.length || portfolio.summary.selectedScopes !== observations.length || portfolio.summary.includedScopes !== included.length || portfolio.summary.excludedScopes !== observations.length - included.length || portfolio.summary.unavailableScopes !== 0) fail('Frozen portfolio scope counts are inconsistent.');
  const asOf = date(portfolio.asOf);if (projects.some(project => project.ratings.some(rating => rating.asOf > asOf))) fail('A frozen latest rating cannot postdate its effective observation cutoff.');
  return {header: {id: id(value.id), sha256: sha(value.sha256), title: text(value.title, 1000, true), kind: oneOf(value.kind, KINDS), periodStart: start, periodEnd: end,
    createdAt: timestamp(value.createdAt), asOf, filters: filters(portfolio.filters), selectedScopes: observations.length, includedScopes: projects.length}, projects, observations};
}
const keysOf = values => new Map(values.map(value => [value.scopeKey, value]));
const statusOf = (before, after, same) => !before ? 'added' : !after ? 'removed' : same(before, after) ? 'unchanged' : 'changed';
function changes(before, after, key, render, same) {
  const left = new Map(before.map(value => [value[key], value])), right = new Map(after.map(value => [value[key], value]));
  return sortedKeys(new Set([...left.keys(), ...right.keys()])).map(identity => render(left.get(identity), right.get(identity), statusOf(left.get(identity), right.get(identity), same)));
}
const ratingPoint = value => value ? Object.fromEntries(['value', 'recordId', 'recordRevision', 'asOf'].map(key => [key, value[key]])) : null;
function compareProject(before, after) {
  const preferred = after || before, left = before?.summary, right = after?.summary;
  const classifications = before && after ? CLASSIFICATIONS.filter(field => !equal(field === 'themes' ? sortedKeys(left.profile[field]) : left.profile[field], field === 'themes' ? sortedKeys(right.profile[field]) : right.profile[field])).map(field => ({field, before: structuredClone(left.profile[field]), after: structuredClone(right.profile[field])})) : [];
  const ratings = changes(before?.ratings || [], after?.ratings || [], 'key', (a, b, status) => ({...Object.fromEntries(['key', ...SCALE_FIELDS].map(field => [field, (b || a)[field]])), status, baseline: ratingPoint(a), followup: ratingPoint(b)}), (a, b) => a.value === b.value);
  const issueChanges = changes(before?.issues || [], after?.issues || [], 'recordId', (a, b, status) => ({recordId: (b || a).recordId, title: (b || a).title, status, beforeState: a?.state ?? null, afterState: b?.state ?? null, beforeSeverity: a?.severity ?? null, afterSeverity: b?.severity ?? null}), equal);
  const workProductChanges = changes(before?.products || [], after?.products || [], 'recordId', (a, b, status) => {
    if (a && b && a.type !== b.type) fail('An exact work product ID cannot change record type between frozen periods.');
    return {recordId: (b || a).recordId, type: (b || a).type, title: (b || a).title, status, beforeRevision: a?.revision ?? null, afterRevision: b?.revision ?? null};
  }, equal);
  return {scopeKey: preferred.scopeKey, accountId: preferred.summary.accountId, projectId: preferred.summary.projectId, accountName: preferred.summary.accountName, name: preferred.summary.name,
    membership: before && after ? 'common' : after ? 'added' : 'removed', baseline: left ? structuredClone(left) : null, followup: right ? structuredClone(right) : null, classifications, ratings, issueChanges, workProductChanges};
}
const METRICS = [
  ['accountRecords', 'Included account project records', () => 1], ['unrated', 'Records without an approved performance rating', project => Number(project.summary.unrated)],
  ['pendingReviews', 'Records awaiting review', project => project.summary.pendingReviews], ['overdueActions', 'Overdue corrective follow-ups', project => project.summary.overdueActions],
  ['openGrievances', 'Open complaint account records', project => project.summary.grievanceSummary.open], ['overdueResponses', 'Overdue complaint responses', project => project.summary.grievanceSummary.overdueResponses],
  ['approvedIssues', 'Approved risk / corrective follow-ups', project => project.issues.length], ['reviewedWorkProducts', 'Approved non-grievance work products', project => project.products.length]
];
function metricRows(before, after, commonBefore, commonAfter, only) {
  const sum = (rows, extract) => rows.reduce((total, project) => total + extract(project), 0);
  return METRICS.filter(([key]) => !only || only.includes(key)).map(([key, label, extract]) => {
    const baseline = sum(before, extract), followup = sum(after, extract), commonBaseline = sum(commonBefore, extract), commonFollowup = sum(commonAfter, extract);
    return {key, label, baseline, followup, delta: followup - baseline, commonBaseline, commonFollowup, commonDelta: commonFollowup - commonBaseline};
  });
}
function breakdown(before, after, field) {
  const left = keysOf(before), right = keysOf(after), members = (project, value) => (field === 'theme' ? project.summary.profile.themes.length ? project.summary.profile.themes : [''] : [project.summary.profile[field]]).includes(value);
  const values = sortedKeys(new Set([...before, ...after].flatMap(project => field === 'theme' ? project.summary.profile.themes.length ? project.summary.profile.themes : [''] : [project.summary.profile[field]])));
  return values.map(value => {
    const baselineScopeKeys = before.filter(project => members(project, value)).map(project => project.scopeKey).sort(), followupScopeKeys = after.filter(project => members(project, value)).map(project => project.scopeKey).sort();
    const commonBaselineScopeKeys = baselineScopeKeys.filter(key => right.has(key)), commonFollowupScopeKeys = followupScopeKeys.filter(key => left.has(key));
    const addedScopeKeys = followupScopeKeys.filter(key => !left.has(key)), removedScopeKeys = baselineScopeKeys.filter(key => !right.has(key));
    const reassignedInScopeKeys = commonFollowupScopeKeys.filter(key => !baselineScopeKeys.includes(key)), reassignedOutScopeKeys = commonBaselineScopeKeys.filter(key => !followupScopeKeys.includes(key));
    return {value, label: value || 'Not recorded', baseline: baselineScopeKeys.length, followup: followupScopeKeys.length, commonBaseline: commonBaselineScopeKeys.length, commonFollowup: commonFollowupScopeKeys.length,
      added: addedScopeKeys.length, removed: removedScopeKeys.length, reassignedIn: reassignedInScopeKeys.length, reassignedOut: reassignedOutScopeKeys.length,
      baselineScopeKeys, followupScopeKeys, commonBaselineScopeKeys, commonFollowupScopeKeys, addedScopeKeys, removedScopeKeys, reassignedInScopeKeys, reassignedOutScopeKeys,
      metrics: metricRows(before.filter(project => members(project, value)), after.filter(project => members(project, value)), before.filter(project => members(project, value) && right.has(project.scopeKey)), after.filter(project => members(project, value) && left.has(project.scopeKey)), ['overdueActions', 'openGrievances', 'unrated', 'pendingReviews'])};
  });
}

/** Compare frozen account observations, never current source stores. Authorization
 * and retained SHA verification belong to the caller; this is not an access grant. */
export function buildOversightComparison({baseline, followup} = {}) {
  const before = packet(baseline), after = packet(followup), left = keysOf(before.projects), right = keysOf(after.projects);
  const projects = sortedKeys(new Set([...left.keys(), ...right.keys()])).map(key => compareProject(left.get(key), right.get(key)));
  const sameKind = before.header.kind === after.header.kind, sameFilters = equal(before.header.filters, after.header.filters), sameSelection = equal(sortedKeys(before.observations.map(item => item.scopeKey)), sortedKeys(after.observations.map(item => item.scopeKey)));
  const chronology = after.header.asOf === before.header.asOf ? 'same' : after.header.asOf > before.header.asOf ? 'forward' : 'reverse';
  const overlappingPeriods = before.header.periodStart <= after.header.periodEnd && after.header.periodStart <= before.header.periodEnd, warnings = [];
  if (!sameKind) warnings.push('The reporting purposes differ; review the two packet mandates before interpreting changes.');
  if (!sameFilters) warnings.push('The frozen filters differ. Full-portfolio deltas include scope and filter changes; inspect the exact common cohort separately.');
  if (!sameSelection) warnings.push('The explicitly selected account/project scopes differ. Added or removed observations do not establish project entry, exit or resolution.');
  if (chronology !== 'forward') warnings.push(chronology === 'same' ? 'Both packets have the same effective observation date; differences do not establish a later observation period.' : 'The follow-up effective observation date precedes the baseline date; no forward time trend is implied.');
  if (overlappingPeriods) warnings.push('The reporting periods overlap; counts are frozen observations, not independent incident totals.');
  if (chronology === 'forward' && after.header.periodEnd < before.header.periodEnd || chronology === 'reverse' && after.header.periodEnd > before.header.periodEnd) warnings.push('Reporting-period end dates run opposite to the effective observation chronology.');
  const summary = {baselineRecords: before.projects.length, followupRecords: after.projects.length, commonRecords: projects.filter(project => project.membership === 'common').length,
    addedRecords: projects.filter(project => project.membership === 'added').length, removedRecords: projects.filter(project => project.membership === 'removed').length,
    changedRatings: projects.reduce((sum, project) => sum + project.ratings.filter(value => value.status === 'changed').length, 0), addedScales: projects.reduce((sum, project) => sum + project.ratings.filter(value => value.status === 'added').length, 0),
    removedScales: projects.reduce((sum, project) => sum + project.ratings.filter(value => value.status === 'removed').length, 0), changedClassifications: projects.reduce((sum, project) => sum + project.classifications.length, 0)};
  const commonBefore = before.projects.filter(project => right.has(project.scopeKey)), commonAfter = after.projects.filter(project => left.has(project.scopeKey));
  const metrics = metricRows(before.projects, after.projects, commonBefore, commonAfter);
  const observationSide = value => value ? Object.fromEntries(['status', 'accountName', 'canonicalProjectId', 'canonicalProjectName', 'revision', 'sha256', 'observedAt'].map(key => [key, value[key]])) : null;
  const scopeChanges = changes(before.observations, after.observations, 'scopeKey', (a, b, status) => ({scopeKey: (b || a).scopeKey, accountId: (b || a).custodyId, projectId: (b || a).projectId, baseline: observationSide(a), followup: observationSide(b), status}), (a, b) => a.status === b.status);
  const result = {schemaVersion: 1, kind: 'oversight_period_comparison', baseline: before.header, followup: after.header,
    comparability: {sameKind, sameFilters, sameSelection, chronology, overlappingPeriods, warnings}, summary, metrics, projects, scopeChanges,
    breakdowns: Object.fromEntries(['institution', 'region', 'sector', 'theme'].map(field => [field, breakdown(before.projects, after.projects, field)])),
    limitations: ['Only supplied, already-authorized frozen packets are compared. This model establishes no source access or institutional clearance.',
      'Account records match only by permanent custody ID and project ID. Names, runtime aliases and shared canonical physical-project links never merge records.',
      'Rating values are compared only within the exact original institution, dimension, scale ID, name, edition and source. No direction, equivalence or aggregate score is inferred.',
      'Missing or superseded ratings, issues and work products are absent observations; absence does not establish improvement, closure or resolution.',
      'Classification breakdown changes may reflect reassignment of the same account record. Themes overlap, so theme counts do not add up to a unique project total.',
      'Complaint counters describe account observations and may overlap across institutions; no unique case count is inferred. Direct complaint fields and work product narratives are not copied.',
      'Effective dates describe observations in frozen knowledge states; reporting-period overlap and changes in scope or filters limit trend interpretation.']};
  boundedJson(result, 'Frozen period comparison');return result;
}
