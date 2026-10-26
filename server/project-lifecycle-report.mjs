import catalog from '../src/data/project-lifecycle-template-views.json' with {type: 'json'};
import {lifecyclePortfolio, lifecycleDecimal} from '../src/lib/project-lifecycle.js';
import {monitoringActionBelongsToProgram} from '../src/lib/engagement-domain.js';
import {monitoringProtectionClosure, projectMonitoringDisclosure, isProtectedMonitoringEvent} from '../src/lib/monitoring-protection.js';
import {getSectorProfile} from '../src/lib/sector-risk-profiles.js';
import {verifyEngagementSnapshot} from './engagement-exports.mjs';

const families = Object.freeze({ifc: 'IFC', world_bank: 'WorldBank', adb: 'ADB', ebrd: 'EBRD', eib: 'EIB', fmo: 'EuropeanDFI'});
const own = (value, key) => Object.hasOwn(value || {}, key);
const list = value => Array.isArray(value) ? value : [];
const scalar = value => typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
const pick = (value, keys) => Object.fromEntries(keys.filter(key => own(value, key) && scalar(value[key])).map(key => [key, value[key]]));
const money = value => value && typeof value.amount === 'string' && /^[A-Z]{3}$/.test(value.currency || '') ? {amount: value.amount, currency: value.currency} : undefined;
const idOf = e => e.engagement?.id || e.id;
const projectOf = e => e.engagement?.projectId || e.projectId;
const familyOf = id => /^ifc/i.test(id || '') ? 'IFC' : /^(world_bank|wb_|worldbank)/i.test(id || '') ? 'WorldBank' : /^adb/i.test(id || '') ? 'ADB' : /^ebrd/i.test(id || '') ? 'EBRD' : /^eib/i.test(id || '') ? 'EIB' : /^fmo/i.test(id || '') ? 'EuropeanDFI' : null;
const recordValue = (entity, row, value, extra = {}) => ({entity, recordId: row.id, value, ...extra});
const strings = value => list(value).filter(v => typeof v === 'string');

/** Verify the actual authority first; disclosure and period projection never
 * pretend their filtered bytes retain an approved snapshot's original hash. */
export function selectLifecycleAssessmentProjection(authority, {baselineId, baselineSha256} = {}) {
  if (!authority || typeof idOf(authority) !== 'string' || typeof projectOf(authority) !== 'string') throw new TypeError('Use an existing engagement authority.');
  if (Boolean(baselineId) !== Boolean(baselineSha256)) throw new TypeError('An exact baseline requires both its ID and SHA256.');
  const baseline = baselineId ? list(authority.baselines).find(b => b.id === baselineId) : authority.format === 'esia-engagement-snapshot' ? authority : null;
  if (baselineId && (!baseline || baseline.sha256 !== baselineSha256)) throw Object.assign(new Error('The selected immutable baseline does not match its exact ID and SHA256.'), {status: 409});
  if (baseline) {
    verifyEngagementSnapshot(baseline);
    if (baseline.engagement.id !== idOf(authority) || baseline.engagement.projectId !== projectOf(authority)) throw new Error('The selected baseline belongs to another engagement or project.');
  }
  // The union includes historic case restrictions and byte aliases before any
  // period is removed. Later unlinking cannot release an earlier protected pin.
  const closure = monitoringProtectionClosure(authority);
  const source = projectMonitoringDisclosure(baseline || authority, {closure});
  let selectedCycles;
  if (baseline) {
    if (baseline.scope && baseline.scope.kind !== 'monitoring_cycle') throw new Error('Unsupported approved assessment scope.');
    selectedCycles = baseline.scope ? list(source.cycles).filter(c => c.id === baseline.scope.cycleId) : [];
    if (baseline.scope && (selectedCycles.length !== 1 || selectedCycles[0].programId !== baseline.scope.programId)) throw new Error('The approved monitoring period is missing or belongs to another program.');
  } else {
    const latest = new Map();
    for (const c of list(source.cycles)) {
      const previous = latest.get(c.programId);
      if (!previous || String(c.periodEnd).localeCompare(String(previous.periodEnd)) > 0 || (c.periodEnd === previous.periodEnd && String(c.id).localeCompare(String(previous.id)) > 0)) latest.set(c.programId, c);
    }
    selectedCycles = [...latest.values()].sort((a, b) => String(a.programId).localeCompare(String(b.programId)));
  }
  const cycleIds = new Set(selectedCycles.map(c => c.id)), programIds = new Set(selectedCycles.map(c => c.programId));
  const findingIds = baseline?.scope ? new Set(baseline.scope.findingIds) : null;
  const findings = list(source.findings).filter(f => selectedCycles.length ? cycleIds.has(f.cycleId) && (!findingIds || findingIds.has(f.id)) : !f.cycleId);
  if (findingIds && [...findingIds].some(id => !findings.some(f => f.id === id))) throw new Error('An approved period finding is missing or belongs to another period.');
  const requirementIds = new Set(selectedCycles.length ? selectedCycles.flatMap(c => list(c.requirementIds)) : list(source.requirements).map(r => r.id));
  const actionView = {...source, baselines: list(authority.baselines)};
  const actions = list(source.actions).filter(a => selectedCycles.length ? cycleIds.has(a.cycleId) || [...programIds].some(id => monitoringActionBelongsToProgram(actionView, a, id)) && (!a.cycleId || !['closed', 'superseded'].includes(a.status)) : !a.cycleId);
  const collections = {
    requirements: list(source.requirements).filter(r => requirementIds.has(r.id)), findings, actions,
    cycles: selectedCycles, measurements: list(source.measurements).filter(m => cycleIds.has(m.cycleId)),
    programs: list(source.programs).filter(p => programIds.has(p.id)), indicators: list(source.indicators).filter(i => programIds.has(i.programId)),
    monitoringObligations: list(source.monitoringObligations).filter(o => programIds.has(o.programId)),
    events: list(source.events).filter(e => selectedCycles.length ? cycleIds.has(e.cycleId) || !e.cycleId && programIds.has(e.programId) : !e.cycleId && !e.programId),
    verifications: list(source.verifications).filter(v => cycleIds.has(v.cycleId))
  };
  const historical = Object.fromEntries(['cycles', 'findings', 'measurements', 'actions', 'events'].map(name => {
    const kept = new Set(collections[name].map(r => r.id));return [name, list(source[name]).filter(r => !kept.has(r.id)).map(r => r.id)];
  }));
  const projection = {format: 'esia-lifecycle-assessment-projection', schemaVersion: 1, id: idOf(authority), projectId: projectOf(authority),
    ...(Number.isInteger(authority.revision) ? {revision: authority.revision} : {}), ...collections,
    // Required for reapplying the shared protection closure in the renderer;
    // their bodies are never included in its output whitelist.
    assertions: list(source.assertions), sourceVersions: list(source.sourceVersions)};
  const context = {engagementId: projection.id, projectId: projection.projectId, mode: baseline ? 'approved_baseline' : 'working_review',
    approvalStatus: baseline ? 'approved_source_projection' : 'current_unapproved',
    ...(baseline ? {baselineId: baseline.id, baselineSha256: baseline.sha256} : {revision: authority.revision}),
    selectedCycleId: selectedCycles.length === 1 ? selectedCycles[0].id : null, selectedCycleIds: [...cycleIds], programIds: [...programIds],
    periods: selectedCycles.map(c => pick(c, ['id', 'programId', 'periodStart', 'periodEnd'])),
    selection: baseline ? baseline.scope ? 'exact_approved_cycle_scope' : 'approved_due_diligence_only' : selectedCycles.length ? 'latest_period_end_per_program; ties_by_stable_id; unapproved' : 'working_due_diligence_only; unapproved',
    historicalRecordIds: historical, historicalCounts: Object.fromEntries(Object.entries(historical).map(([name, ids]) => [name, ids.length]))};
  return {projection, context};
}

/**
 * A read-only, partial JSON field exchange. The caller selects and authorizes
 * exact engagement authority projections before calling; this function never
 * chooses a newer working assessment or reads a source/private case body.
 */
export function buildLifecycleInstitutionView({graph, projects = [], engagements = [], view = 'canonical', datasetSha256, asOf} = {}) {
  if (!graph?.entities || !Array.isArray(graph.projects) || !['canonical', ...Object.keys(families)].includes(view)) throw new TypeError('Use a selected lifecycle graph and supported institution view.');
  if (!/^[a-f0-9]{64}$/.test(datasetSha256 || '')) throw new TypeError('Supply the SHA256 of the exact authorized dataset and its authority pins.');
  const projectIds = new Set(graph.projects.map(p => p.projectId));
  if (engagements.some(e => !projectIds.has(projectOf(e)) || typeof idOf(e) !== 'string')) throw new TypeError('Engagement authority projections must belong to the selected project graph.');
  const entities = graph.entities;
  const portfolio = lifecyclePortfolio(graph, undefined, {asOf});
  const activeAllocationIds = new Set(portfolio.allocationIds);
  const scopedProjects = graph.projects.map(binding => {
    const p = projects.find(p => p.id === binding.projectId);
    return {id: binding.projectId, identityId: binding.identityId, ...(typeof p?.name === 'string' ? {name: p.name} : {})};
  });
  const rows = (collection, entity, keys) => list(entities[collection]).map(r => ({...pick(r, ['id', ...keys]), entity}));
  const contextRows = [];
  for (const [collection, entity, keys] of [
    ['components', 'ProjectComponent', ['projectId', 'name', 'kind', 'parentComponentId']],
    ['sites', 'Site', ['projectId', 'name', 'countryCode', 'latitude', 'longitude']],
    ['activities', 'Activity', ['projectId', 'name', 'kind', 'componentId', 'sectorProfileId']],
    ['organizations', 'Organization', ['name', 'kind']],
    ['roleAssignments', 'OrganizationRoleAssignment', ['organizationId', 'role', 'projectId', 'componentId', 'investmentId']],
    ['lifecycleEvents', 'LifecycleEvent', ['projectId', 'phase', 'status', 'title', 'eventAt', 'engagementId', 'cycleId', 'eventId', 'actionId']],
    ['engagementScopes', 'EngagementScope', ['engagementId', 'projectId', 'periodStart', 'periodEnd']],
    ['requirementApplicabilities', 'RequirementApplicability', ['projectId', 'frameworkEditionId', 'decision', 'assessedAt']],
    ['agreements', 'Agreement', ['name', 'kind', 'status', 'signedOn']],
    ['covenants', 'Covenant', ['agreementId', 'projectId', 'title', 'dueDate']],
    ['investments', 'Investment', ['name', 'kind', 'status', 'parentInvestmentId']],
    ['financialFacilities', 'FinancialFacility', ['name', 'kind', 'borrowerOrganizationId']],
    ['transactions', 'Transaction', ['investmentId', 'kind', 'transactionDate', 'status']],
    ['financingParticipants', 'FinancingParticipant', ['financialFacilityId', 'organizationId', 'role']],
    ['allocations', 'InvestmentAllocation', ['investmentId', 'projectId', 'componentId']]
  ]) contextRows.push(...rows(collection, entity, keys));
  for (const r of contextRows) {
    const sourceCollection = {Investment: 'investments', Transaction: 'transactions', InvestmentAllocation: 'allocations', FinancialFacility: 'financialFacilities', FinancingParticipant: 'financingParticipants'}[r.entity];
    const original = list(entities[sourceCollection]).find(value => value.id === r.id);
    for (const attribute of ['amount', 'commitment']) {
      const safeAmount = money(original?.[attribute]);
      if (safeAmount) r[attribute] = safeAmount;
    }
  }
  const reviewRows = [];
  for (const authority of engagements) {
    const e = projectMonitoringDisclosure(authority, {closure: monitoringProtectionClosure(authority)});
    const base = {engagementId: idOf(e), projectId: projectOf(e)};
    const requirementById = new Map(list(e.requirements).map(r => [r.id, r]));
    const protectedAssertions = new Set(list(e.events).filter(isProtectedMonitoringEvent).flatMap(event => strings(event.assertionIds)));
    const protectedVersions = new Set(list(e.assertions).filter(a => protectedAssertions.has(a.id)).map(a => a.versionId));
    for (const a of list(e.assertions)) if (protectedVersions.has(a.versionId)) protectedAssertions.add(a.id);
    for (const [collection, entity, keys] of [
      ['cycles', 'MonitoringCycle', ['programId', 'periodStart', 'periodEnd', 'dueDate', 'status']],
      ['indicators', 'Indicator', ['name', 'topic', 'unit', 'method', 'frequency', 'location']],
      ['measurements', 'IndicatorMeasurement', ['indicatorId', 'cycleId', 'value', 'unit', 'method', 'location', 'lab', 'observedAt', 'periodStart', 'periodEnd', 'dataQuality']],
      ['actions', 'CorrectiveAction', ['cycleId', 'status', 'dueDate', 'priority']],
      ['monitoringObligations', 'MonitoringObligation', ['programId', 'title', 'frequency', 'dueDate', 'status', 'trigger']],
      ['events', 'Event', ['kind', 'status', 'severity', 'occurredAt', 'receivedAt', 'cycleId']],
      ['requirements', 'Requirement', ['frameworkId', 'edition', 'standard', 'clause']],
      ['findings', 'AssessmentFinding', ['requirementId', 'cycleId', 'applicability', 'coverage', 'adequacy', 'performance', 'implementation', 'effectiveness', 'evidenceSufficiency', 'riskSignificance', 'residualRisk', 'riskTrajectory']]
    ]) for (const r of list(e[collection])) {
      if (entity === 'IndicatorMeasurement' && (r.restricted || strings(r.assertionIds).some(id => protectedAssertions.has(id)))) continue;
      // Quotes, narrative case summaries, personal identities, ciphertext and
      // arbitrary extensions never enter the projection through object spreads.
      const safe = {...pick(r, ['id', ...keys]), entity, ...base};
      if (entity === 'AssessmentFinding') safe.frameworkId = requirementById.get(r.requirementId)?.frameworkId || null;
      if (entity === 'Indicator') safe.requirementIds = strings(r.requirementIds);
      if (entity === 'Event') safe.restrictedDetailsOmitted = isProtectedMonitoringEvent(r) || Boolean(r.restrictedCaseRef);
      reviewRows.push(safe);
    }
  }
  const canonicalRecords = [
    ...scopedProjects.map(p => ({...p, entity: 'Project'})), ...contextRows, ...reviewRows
  ];
  const records = entity => canonicalRecords.filter(r => r.entity === entity);
  const lookupOriginal = (entity, id) => {
    const collection = {InvestmentAllocation: 'allocations', Transaction: 'transactions', Investment: 'investments', FinancialFacility: 'financialFacilities', FinancingParticipant: 'financingParticipants'}[entity];
    return list(entities[collection]).find(r => r.id === id);
  };
  const family = families[view];
  const frameworkMatches = value => view === 'canonical' || familyOf(value) === family;
  const values = (entity, attribute, filter = () => true) => records(entity).filter(filter).filter(r => own(r, attribute)).map(r => recordValue(entity, r, r[attribute], pick(r, ['engagementId', 'projectId', 'cycleId'])));
  const measurementConcept = field => /displacement|entitlement|compensation/i.test(field) ? /displac|resettle|compensat|entitle|household/i : /women/i.test(field) ? /female|women/i : /hires|terminations/i.test(field) ? /hire|terminat/i : /worked hours/i.test(field) ? /hours|man.hours|person.hours/i : /lost working days/i.test(field) ? /lost.*days|days.*lost/i : /injury|fatality/i.test(field) ? /injur|fatal/i : /worker counts/i.test(field) ? /worker|employee|headcount/i : /noise\/air\/effluent/i.test(field) ? /noise|air|effluent|water.quality/i : /power\/fuel\/water/i.test(field) ? /power|fuel|electric|energy|water.consum/i : /waste/i.test(field) ? /waste/i : /benefits/i.test(field) ? /benefit|outcome/i : null;
  function resolve(field) {
    const {canonicalEntity: entity, attribute} = field;
    if (!entity) return {values: [], reason: field.gapId || 'No safe canonical mapping.'};
    if (entity === 'Project' && attribute === 'reference') {
      if (!/title|project\/country\/date/i.test(field.field)) return {values: [], reason: 'Project narrative must be resolved from its shared authority; a name is insufficient.'};
      return {values: values('Project', 'name'), ...(field.field.includes('/') ? {partial: true, reason: 'Title supplied; grouped country/date fields require separate records.'} : {})};
    }
    if (entity === 'ExternalReference') {
      const refs = [];
      const namespaceMatch = {IFC: /ifc/i, WorldBank: /worldbank|world.bank/i, ADB: /adb/i, EBRD: /ebrd/i, EIB: /eib/i, EuropeanDFI: /fmo/i}[family];
      for (const [collection, sourceRows] of Object.entries(entities)) for (const r of list(sourceRows)) for (const ref of list(r.externalReferences)) if (namespaceMatch?.test(ref.namespace || '')) refs.push(recordValue(entity, r, pick(ref, ['namespace', 'value']), {sourceCollection: collection}));
      return {values: refs, ...(refs.length ? {partial: true, reason: 'Namespaced external references retained; verify project versus loan/investment identifier semantics before submission.'} : {})};
    }
    if (entity === 'IndicatorMeasurement') {
      const concept = measurementConcept(field.field);
      if (!concept) return {values: [], reason: 'No implemented measurement selector for this template field.'};
      const measurements = records(entity).filter(m => {
        const indicator = records('Indicator').find(i => i.id === m.indicatorId && i.engagementId === m.engagementId);
        return indicator && concept.test(indicator.name || '');
      });
      return {values: measurements.map(m => recordValue(entity, m, pick(m, ['value', 'unit', 'method', 'location', 'lab', 'observedAt', 'periodStart', 'periodEnd', 'dataQuality']), pick(m, ['engagementId', 'projectId', 'cycleId', 'indicatorId']))), partial: true, reason: 'Indicator-name selector supplies candidate observations; practitioner confirmation of metric definition, unit and scope remains required.'};
    }
    if (entity === 'ProfessionalJudgment') return {values: [], reason: 'A prose judgment, source-specific score or lender opinion cannot be reconstructed from status enums.'};
    if (entity === 'Approval') return {values: [], reason: 'Actual signed client/professional/institutional attestation required; business context approval does not supply it.'};
    if (entity === 'EvidenceAssertion' || entity === 'ExactSourceVersion' || entity === 'Study') return {values: [], reason: 'Evidence passages and source content are not exported in this minimized field exchange.'};
    if (['Incident', 'Grievance'].includes(entity)) {
      const kind = entity === 'Incident' ? 'incident' : 'grievance';
      return {values: records('Event').filter(e => e.kind === kind).map(e => recordValue(entity, e, pick(e, ['id', 'kind', 'status', 'severity', 'occurredAt', 'receivedAt', 'restrictedDetailsOmitted']), pick(e, ['engagementId', 'projectId', 'cycleId']))), partial: true, reason: 'Event metadata only; private identities, narratives, case bodies and encrypted data omitted.'};
    }
    if (entity === 'MonitoringProgram' && attribute === 'obligationRefs') {
      return {values: records('MonitoringObligation').map(o => recordValue('MonitoringObligation', o, pick(o, ['title', 'frequency', 'dueDate', 'status', 'trigger']), pick(o, ['engagementId', 'projectId']))), partial: true, reason: 'Recorded monitoring obligations supplied; verify template timing and verification criteria against actual agreement.'};
    }
    if (entity === 'RequirementApplicability') {
      const v = list(entities.requirementApplicabilities).filter(r => frameworkMatches(r.frameworkEditionId)).map(r => recordValue(entity, r, {frameworkEditionId: r.frameworkEditionId, decision: r.decision, requirementRef: pick(r.requirementRef, ['engagementId', 'id', 'revision']), ...pick(r, ['assessedAt', 'effectiveFrom', 'effectiveTo'])}, pick(r, ['projectId', 'investmentId', 'financialFacilityId', 'agreementId'])));
      return {values: v};
    }
    if (['InvestmentAllocation', 'Transaction'].includes(entity) && attribute === 'amount') return {values: records(entity).filter(r => entity !== 'InvestmentAllocation' || activeAllocationIds.has(r.id)).flatMap(r => {
      const amount = money(lookupOriginal(entity, r.id)?.amount);
      return amount ? [recordValue(entity, r, amount, pick(r, ['projectId', 'investmentId']))] : [];
    }), ...(entity === 'Transaction' ? {partial: true, reason: 'Individual amounts supplied; mean/max require a declared cohort, as-of date and currency basis.'} : {})};
    if (entity === 'Organization' && family === 'EuropeanDFI') return {values: values(entity, attribute, r => r.kind === 'financial_intermediary'), partial: true, reason: 'FI organization candidates only; reporting issuer selection is engagement-specific.'};
    if (entity === 'OrganizationRoleAssignment') return {values: [], reason: 'Business-party roles do not establish the named reporting analyst or implementing-agency role.'};
    if (entity === 'CorrectiveAction' && ['status', 'dueDate'].includes(attribute)) return {values: values(entity, attribute)};
    if (entity === 'CorrectiveAction') return {values: [], reason: 'Narratives and source-specific action classifications require an authorized mapped report profile.'};
    if (entity === 'Covenant') return {values: [], reason: 'Exact covenant wording requires separate authorized source-content export; no clause text is copied here.'};
    if (entity === 'Indicator' && ['name', 'method', 'scope'].includes(attribute)) return {values: records(entity).map(r => recordValue(entity, r, pick(r, ['name', 'unit', 'method', 'frequency', 'location']), pick(r, ['engagementId', 'projectId']))), partial: true, reason: 'Existing indicator definitions retained; template parameterization and specialist applicability need review.'};
    if (entity === 'MonitoringCycle' && attribute === 'periodStart') return {values: records(entity).map(r => recordValue(entity, r, pick(r, ['periodStart', 'periodEnd']), pick(r, ['engagementId', 'projectId'])))};
    if (entity === 'Site' && attribute === 'geometrySource') return {values: records(entity).filter(r => own(r, 'latitude') && own(r, 'longitude')).map(r => recordValue(entity, r, {latitude: r.latitude, longitude: r.longitude, coordinateSystem: 'EPSG:4326'}, pick(r, ['projectId']))), partial: true, reason: 'Recorded point coordinates only; no facility boundary geometry or map certification inferred.'};
    if (entity === 'Engagement' && attribute === 'scopeIds') return {values: values('EngagementScope', 'id'), partial: true, reason: 'Business scope links do not establish completion or independent professional acceptance.'};
    if (['LifecycleEvent', 'Activity', 'Site'].includes(entity)) return {values: values(entity, attribute)};
    return {values: [], reason: 'Proposed logical profile is not implemented by this runtime field exchange.'};
  }
  const selectedFields = view === 'canonical' ? [] : catalog.fields.filter(f => f.family === family);
  const fields = selectedFields.map(f => {
    const result = resolve(f);
    return {...f, canonicalPath: f.canonicalEntity ? `${f.canonicalEntity}.${f.attribute}` : null,
      status: result.values.length ? (result.partial ? 'partially_resolved' : 'resolved') : 'unresolved',
      values: result.values, ...(result.reason ? {resolutionNote: result.reason} : {}), complianceEstablished: false};
  });
  const assessmentStatusByFramework = [];
  for (const frameworkId of [...new Set(records('Requirement').map(r => r.frameworkId).filter(Boolean))].sort()) {
    const requirements = records('Requirement').filter(r => r.frameworkId === frameworkId);
    const findings = records('AssessmentFinding').filter(r => r.frameworkId === frameworkId);
    const counts = {};
    for (const f of findings) counts[f.performance || 'unknown'] = (counts[f.performance || 'unknown'] || 0) + 1;
    assessmentStatusByFramework.push({frameworkId, requirementIds: requirements.map(r => r.id), findingIds: findings.map(r => r.id), performanceCounts: counts,
      unassessedRequirements: requirements.filter(r => !findings.some(f => f.requirementId === r.id && f.engagementId === r.engagementId)).map(r => ({engagementId: r.engagementId, requirementId: r.id})),
      unknownPerformanceFindingIds: findings.filter(r => !r.performance || ['unknown', 'undetermined', 'not_assessed'].includes(r.performance)).map(r => r.id),
      meaning: 'Recorded dimensions in the caller-selected current assessment scope; historical periods are separate traceability. No institutional risk category or portfolio compliance conclusion is inferred.'});
  }
  const sectorGroups = new Map(), unknownAllocationIds = [], mixedAllocationIds = [], unpricedAllocationIds = [], unknownLeafInvestmentIds = new Set();
  const decimalText = amount => `${amount / 1000000000000n}.${String(amount % 1000000000000n).padStart(12, '0')}`.replace(/\.?0+$/, '');
  const activeAllocations = list(entities.allocations).filter(a => activeAllocationIds.has(a.id));
  for (const a of activeAllocations) {
    const activities = list(entities.activities).filter(activity => activity.projectId === a.projectId && (!a.componentId || activity.componentId === a.componentId) && (!activity.effectiveFrom || activity.effectiveFrom <= portfolio.asOf) && (!activity.effectiveTo || activity.effectiveTo >= portfolio.asOf));
    const valid = activities.filter(activity => activity.provenance?.reviewStatus === 'verified' && getSectorProfile(activity.sectorProfileId));
    const sectorIds = [...new Set(valid.map(activity => activity.sectorProfileId))];
    if (sectorIds.length > 1) {mixedAllocationIds.push(a.id);unknownLeafInvestmentIds.add(a.investmentId);continue;}
    if (!activities.length || valid.length !== activities.length || sectorIds.length !== 1) {unknownAllocationIds.push(a.id);unknownLeafInvestmentIds.add(a.investmentId);continue;}
    const sector = getSectorProfile(sectorIds[0]);
    if (!sectorGroups.has(sector.id)) sectorGroups.set(sector.id, {sectorProfileId: sector.id, sectorName: sector.name, allocationIds: [], projectIds: new Set(), leafInvestmentIds: new Set(), sums: new Map()});
    const group = sectorGroups.get(sector.id);group.allocationIds.push(a.id);group.projectIds.add(a.projectId);group.leafInvestmentIds.add(a.investmentId);
    if (a.amount) group.sums.set(a.amount.currency, (group.sums.get(a.amount.currency) || 0n) + lifecycleDecimal(a.amount.amount));
    else {unpricedAllocationIds.push(a.id);unknownLeafInvestmentIds.add(a.investmentId);}
  }
  for (const id of portfolio.leafInvestmentIds) if (!activeAllocations.some(a => a.investmentId === id)) unknownLeafInvestmentIds.add(id);
  const sectorCoverage = {status: unknownAllocationIds.length || mixedAllocationIds.length || unpricedAllocationIds.length || unknownLeafInvestmentIds.size ? 'partial' : 'complete',
    ...(portfolio.asOf ? {asOf: portfolio.asOf} : {}),
    groups: [...sectorGroups.values()].sort((a, b) => a.sectorProfileId.localeCompare(b.sectorProfileId)).map(g => ({sectorProfileId: g.sectorProfileId, sectorName: g.sectorName, allocationIds: g.allocationIds, projectIds: [...g.projectIds], leafInvestmentIds: [...g.leafInvestmentIds], amounts: [...g.sums].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => ({currency, amount: decimalText(amount)}))})),
    unknownAllocationIds, mixedAllocationIds, unpricedAllocationIds, unknownLeafInvestmentIds: [...unknownLeafInvestmentIds],
    meaning: 'Recorded verified activity application profiles; no inferred institutional risk category, allocation split, currency conversion or parent-investment exposure.'};
  const monitoringRows = [];
  const projectsForLeaves = new Map();
  for (const a of activeAllocations) {const key = `${a.investmentId}\0${a.projectId}`;if (!projectsForLeaves.has(key)) projectsForLeaves.set(key, {investmentId: a.investmentId, projectId: a.projectId, allocationIds: []});projectsForLeaves.get(key).allocationIds.push(a.id);}
  for (const row of projectsForLeaves.values()) {
    const byProject = entity => records(entity).filter(r => r.projectId === row.projectId);
    const requirements = byProject('Requirement'), findings = byProject('AssessmentFinding');
    const frameworks = [...new Set(requirements.map(r => r.frameworkId).filter(Boolean))].sort().map(frameworkId => {
      const selectedRequirements = requirements.filter(r => r.frameworkId === frameworkId), selectedFindings = findings.filter(r => r.frameworkId === frameworkId), performanceCounts = {};
      for (const finding of selectedFindings) performanceCounts[finding.performance || 'unknown'] = (performanceCounts[finding.performance || 'unknown'] || 0) + 1;
      return {frameworkId, requirementIds: selectedRequirements.map(r => r.id), findingIds: selectedFindings.map(r => r.id), performanceCounts,
        unassessedRequirementIds: selectedRequirements.filter(r => !selectedFindings.some(f => f.requirementId === r.id && f.engagementId === r.engagementId)).map(r => r.id),
        unknownPerformanceFindingIds: selectedFindings.filter(f => !f.performance || ['undetermined', 'unknown', 'not_assessed'].includes(f.performance)).map(f => f.id),
        recordedRiskDimensions: selectedFindings.map(f => ({findingId: f.id, ...pick(f, ['requirementId', 'engagementId', 'cycleId', 'riskSignificance', 'residualRisk', 'riskTrajectory'])}))};
    });
    const cycles = byProject('MonitoringCycle'), actions = byProject('CorrectiveAction'), events = byProject('Event');
    monitoringRows.push({...row, counts: {cycles: cycles.length, measurements: byProject('IndicatorMeasurement').length, actions: actions.length, openActions: actions.filter(a => !['closed', 'superseded', 'verified'].includes(a.status)).length, incidents: events.filter(e => e.kind === 'incident').length, grievances: events.filter(e => e.kind === 'grievance').length}, frameworks, monitoringStatus: cycles.length ? 'recorded_current_period' : 'not_recorded'});
  }
  const portfolioMonitoring = {rows: monitoringRows, meaning: 'Current selected-period records joined to active leaf investment/project allocations. Repeated project rows are reporting relationships, not additive unique portfolio counts. Framework judgments and recorded risk dimensions remain separate; no institutional category is inferred.'};
  return {format: 'esia-project-lifecycle-institution-field-exchange', schemaVersion: 1, view, datasetSha256,
    mappingCatalog: {schemaVersion: catalog.schemaVersion, verifiedAt: catalog.verifiedAt, sourceRegister: catalog.sourceRegister, coverageSource: catalog.coverageSource},
    coverageStatus: 'partial', outputKind: 'json_field_exchange', professionalAcceptance: 'unrecorded', complianceEstablished: false,
    ...(portfolio.asOf ? {asOf: portfolio.asOf} : {}), canonicalRecords, portfolio, assessmentStatusByFramework, sectorCoverage, portfolioMonitoring,
    fields, unresolvedFields: fields.filter(f => f.status === 'unresolved').map(f => ({id: f.id, canonicalPath: f.canonicalPath, reason: f.resolutionNote})),
    coverage: {total: fields.length, resolved: fields.filter(f => f.status === 'resolved').length, partiallyResolved: fields.filter(f => f.status === 'partially_resolved').length, unresolved: fields.filter(f => f.status === 'unresolved').length},
    sources: catalog.sources.filter(s => selectedFields.some(f => f.sourceId === s.id)), templates: catalog.templates.filter(t => selectedFields.some(f => f.templateId === t.id)),
    notices: ['Partial JSON field exchange of a caller-selected authorized dataset; not a completed native institutional form.', 'All views retain the same canonical record IDs and dataset SHA256. Institution-specific applicability and findings remain separate.', 'Logical-only profiles, signatures and lender opinions remain unresolved. No source quotes or restricted case bodies are exported.']};
}
