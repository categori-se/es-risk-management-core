// Merge only already-authorized, sanitized project projections. A name or an
// institutional label never joins records or grants access to another scope.
import {oversightDate, normalizeOversightValues} from './oversight-model.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => {throw Object.assign(new TypeError(message), {status: 400});};
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value) ? value : fail('Select exact account and project identifiers.');
const copy = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, structuredClone(value[key])]));
const rowFields = ['projectId', 'accountId', 'name', 'revision', 'pendingReviews', 'overdueActions', 'unrated'];
const profileFields = ['institution', 'country', 'region', 'sector', 'themes', 'leadOfficer', 'regionalTeam', 'complexity', 'nextReviewDate'];
const ratingFields = ['recordId', 'recordRevision', 'revision', 'institution', 'scaleKey', 'asOf', 'dimension', 'scaleId', 'scaleName', 'scaleVersion', 'scaleSource', 'value', 'decidedBy'];
const issueFields = ['recordId', 'revision', 'title', 'theme', 'severity', 'state', 'risk', 'mitigants', 'owner', 'dueDate', 'progress'];
const visitFields = ['recordId', 'revision', 'status', 'state', 'plannedDate', 'completedDate', 'nextVisitDate', 'owner'];
const allowedProducts = ['opinion', 'rating', 'issue', 'visit', 'review', 'program'];

export function normalizeConsolidationSelection(value) {
  if (!Array.isArray(value) || !value.length || value.length > 100) fail('Explicitly select between one and 100 account/project scopes.');
  const seen = new Set();
  return value.map(scope => {
    if (!object(scope) || Object.keys(scope).some(key => !['accountId', 'projectId'].includes(key))) fail('Select exact account/project scopes only.');
    const result = {accountId: id(scope.accountId), projectId: id(scope.projectId)}, key = JSON.stringify([result.accountId, result.projectId]);
    if (seen.has(key)) fail('Select each account/project scope once.');seen.add(key);return result;
  });
}
export function normalizeConsolidationQuery(input) {
  if (!object(input) || Object.keys(input).some(key => !['scopes', 'asOf', 'filters'].includes(key))) fail('Unsupported consolidation selection fields.');
  const asOf = oversightDate(input.asOf ?? new Date().toISOString().slice(0, 10));
  if (!asOf) fail('Choose an as-of date for the selected scopes.');
  const filters = input.filters ?? {};
  if (!object(filters) || Object.keys(filters).some(key => !['institution', 'region', 'sector', 'theme', 'q'].includes(key)) || Object.values(filters).some(value => typeof value !== 'string' || value.length > 500)) fail('Choose bounded institution, region, sector, theme or search filters.');
  return {scopes: normalizeConsolidationSelection(input.scopes), asOf, filters: {...filters}};
}

/** Deliberate allowlists ensure direct complaint fields cannot be carried into
 * a cross-account packet, even if a resolver supplies extra source fields. */
export function consolidationProjectProjection(source) {
  if (!object(source) || !object(source.profile) || !object(source.grievanceSummary) || !Array.isArray(source.profile.themes) || !Number.isSafeInteger(source.revision) || source.revision < 0) fail('The selected project projection is invalid.');
  const result = {...copy(source, rowFields), profile: copy(source.profile, profileFields)};
  id(result.projectId);id(result.accountId);
  for (const [key, allowed] of [['latestRatings', ratingFields], ['ratingHistory', ratingFields], ['issues', issueFields], ['visits', visitFields], ['sourceRevisions', ['id', 'type', 'revision', 'status']]]) {
    if (!Array.isArray(source[key]) || source[key].some(value => !object(value))) fail('The selected project projection is invalid.');
    result[key] = source[key].map(value => copy(value, allowed));
  }
  for (const key of ['pendingReviews', 'overdueActions']) if (!Number.isSafeInteger(result[key]) || result[key] < 0) fail('The selected project counters are invalid.');
  if (typeof result.name !== 'string' || result.name.length > 2000 || typeof result.unrated !== 'boolean') fail('The selected project metadata is invalid.');
  result.grievanceSummary = {};
  for (const key of ['total', 'open', 'overdueResponses']) {
    const count = source.grievanceSummary[key];if (!Number.isSafeInteger(count) || count < 0) fail('The selected complaint counters are invalid.');result.grievanceSummary[key] = count;
  }
  if (!Array.isArray(source.workProducts)) fail('The selected reviewed work products are invalid.');
  result.workProducts = source.workProducts.filter(value => object(value) && value.status === 'approved' && allowedProducts.includes(value.type)).map(value => ({
    ...copy(value, ['recordId', 'revision', 'type', 'institution', 'status', 'author', 'contentAuthor', 'updatedAt']),
    decision: object(value.decision) ? copy(value.decision, ['action', 'actorId', 'at', 'note', 'authority', 'independentReview']) : null,
    values: normalizeOversightValues(value.type, value.values)
  }));
  return result;
}

export function consolidationMatches(row, filters) {
  const profile = row.profile;
  return !(['institution', 'region', 'sector'].some(key => filters[key] && filters[key] !== 'all' && profile[key] !== filters[key]) ||
    filters.theme && !profile.themes.includes(filters.theme) ||
    filters.q && ![row.name, row.projectId, profile.country, profile.region, profile.sector, ...profile.themes].some(value => String(value || '').toLowerCase().includes(filters.q.toLowerCase())));
}

export function mergeOversightConsolidation({selection, asOf, filters, projects, scopeObservations, limitations = []}) {
  const dimensions = {};
  for (const key of ['institution', 'region', 'sector']) dimensions[key] = [...new Set(projects.map(project => project.profile[key]).filter(Boolean))].sort();
  dimensions.themes = [...new Set(projects.flatMap(project => project.profile.themes))].sort();
  const groups = new Map();
  for (const project of projects) for (const rating of project.latestRatings) {
    const scaleKey = JSON.stringify([rating.institution || 'other', rating.dimension, rating.scaleId, rating.scaleName, rating.scaleVersion, rating.scaleSource]);
    const key = JSON.stringify([scaleKey, rating.value]);
    if (!groups.has(key)) groups.set(key, {key, ...copy(rating, ['institution', 'scaleId', 'scaleName', 'scaleSource', 'scaleVersion', 'dimension', 'value']), projects: 0});
    groups.get(key).projects++;
  }
  const count = status => scopeObservations.filter(scope => scope.status === status).length;
  return {schemaVersion: 1, asOf, filters: {...filters}, selection: structuredClone(selection), scopeObservations: structuredClone(scopeObservations), projects,
    summary: {projects: projects.length, physicalProjects: new Set(projects.map(project => project.canonicalProjectId).filter(Boolean)).size,
      unlinkedRecords: projects.filter(project => !project.canonicalProjectId).length, selectedScopes: selection.length, includedScopes: count('included'), excludedScopes: count('excluded'), unavailableScopes: count('unavailable'),
      unrated: projects.filter(project => project.unrated).length, pendingReviews: projects.reduce((sum, project) => sum + project.pendingReviews, 0),
      overdueActions: projects.reduce((sum, project) => sum + project.overdueActions, 0), openGrievances: projects.reduce((sum, project) => sum + project.grievanceSummary.open, 0), overdueResponses: projects.reduce((sum, project) => sum + project.grievanceSummary.overdueResponses, 0)},
    dimensions, ratingGroups: [...groups.values()], limitations: [...new Set([...limitations,
      'Selected account records remain distinct. Physical-project counts use explicit canonical identity links only; unlinked records are not inferred to be distinct projects.',
      'Complaint totals count account records and may describe overlapping cases; no unique cross-institution case count is inferred.',
      'Source accounts are observed sequentially. Per-source times and revisions are retained; this is not an atomic cross-database snapshot.',
      'This is a local practitioner consolidation, not an institutional clearance or cross-account access grant.'])]};
}
