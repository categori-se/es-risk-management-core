import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildLifecycleInstitutionView, selectLifecycleAssessmentProjection} from '../server/project-lifecycle-report.mjs';
import {snapshotDigestInput} from '../src/lib/engagement-domain.js';

const digest = 'a'.repeat(64);
function fixture() {
  const graph = {revision: 7, projects: [{projectId: 'p1', identityId: 'identity-1'}], entities: {
    components: [], sites: [{id: 'site-1', projectId: 'p1', name: 'Boundary', countryCode: 'KE', latitude: 1.2, longitude: 36.4}], activities: [],
    organizations: [{id: 'fi-1', name: 'Synthetic financial intermediary', kind: 'financial_intermediary'}], roleAssignments: [],
    investments: [{id: 'fund-1', name: 'Fund', kind: 'fund', amount: {amount: '1000', currency: 'USD'}}, {id: 'sub-1', parentInvestmentId: 'fund-1', name: 'Subinvestment', kind: 'subinvestment'}],
    financialFacilities: [], transactions: [{id: 'tx-1', investmentId: 'sub-1', kind: 'disbursement', status: 'executed', amount: {amount: '100', currency: 'USD'}}], financingParticipants: [],
    allocations: [{id: 'allocation-1', investmentId: 'sub-1', projectId: 'p1', amount: {amount: '100', currency: 'USD'}}], agreements: [], covenants: [],
    engagementScopes: [{id: 'scope-1', engagementId: 'e1', projectId: 'p1'}],
    requirementApplicabilities: [{id: 'app-ifc', projectId: 'p1', frameworkEditionId: 'ifc_ps_2012', decision: 'applicable', requirementRef: {engagementId: 'e1', id: 'req-ifc'}}, {id: 'app-adb', projectId: 'p1', frameworkEditionId: 'adb_esf_2024', decision: 'uncertain', requirementRef: {engagementId: 'e1', id: 'req-adb'}}],
    lifecycleEvents: [{id: 'stage-1', projectId: 'p1', phase: 'operational_supervision', status: 'in_progress', title: 'Recorded supervision', eventAt: '2026-10-01T00:00:00.000Z'}]
  }};
  const projects = [{id: 'p1', name: 'Synthetic shared project', projectContext: {identity: {id: 'identity-1'}}}];
  const engagements = [{id: 'e1', projectId: 'p1', requirements: [{id: 'req-ifc', frameworkId: 'ifc_ps_2012'}, {id: 'req-adb', frameworkId: 'adb_esf_2024'}],
    findings: [{id: 'finding-ifc', requirementId: 'req-ifc', performance: 'compliant', rationale: 'SOURCE_QUOTE_MUST_NOT_ESCAPE'}],
    cycles: [{id: 'cycle-1', periodStart: '2026-10-01', periodEnd: '2026-10-31'}],
    indicators: [{id: 'noise-1', name: 'Boundary noise', unit: 'dBA', method: 'Calibrated meter', requirementIds: ['req-ifc']}],
    measurements: [{id: 'reading-1', indicatorId: 'noise-1', cycleId: 'cycle-1', value: 48, unit: 'dBA', method: 'Calibrated meter', dataQuality: 'verified'}],
    actions: [{id: 'action-1', status: 'open', dueDate: '2026-11-01', description: 'PERSONAL_NAME_MUST_NOT_ESCAPE', extensions: {secret: 'SECRET_EXTENSION'}}],
    events: [{id: 'event-1', kind: 'incident', status: 'investigating', occurredAt: '2026-10-02T00:00:00.000Z', publicSummary: 'PRIVATE_SUMMARY', victimName: 'PRIVATE_NAME', investigation: 'PRIVATE_INVESTIGATION', restricted: {ciphertext: 'PRIVATE_CIPHERTEXT'}, assertionIds: ['protected-assertion']}],
    assertions: [{id: 'protected-assertion', versionId: 'protected-version', quote: 'PRIVATE_QUOTE'}, {id: 'alias', versionId: 'protected-version', quote: 'PRIVATE_ALIAS_QUOTE'}],
    monitoringObligations: [{id: 'obligation-1', title: 'Periodic report', frequency: 'Monthly', status: 'open'}]
  }];
  return {graph, projects, engagements, datasetSha256: digest};
}
const build = (f, view) => buildLifecycleInstitutionView({...f, view});

test('IFC, World Bank and ADB field exchanges reuse actual action identity and values from one dataset', () => {
  const f = fixture(), original = structuredClone(f);
  const reports = ['ifc', 'world_bank', 'adb'].map(view => build(f, view));
  for (const r of reports) {
    assert.equal(r.datasetSha256, digest);
    assert.equal(r.coverageStatus, 'partial');
    assert.equal(r.outputKind, 'json_field_exchange');
    assert.equal(r.complianceEstablished, false);
    assert.ok(r.coverage.resolved > 0);
    const action = r.fields.find(field => field.canonicalPath === 'CorrectiveAction.status');
    assert.deepEqual(action.values, [{entity: 'CorrectiveAction', recordId: 'action-1', value: 'open', engagementId: 'e1', projectId: 'p1'}]);
    assert.ok(action.sourceId && action.templateId && action.section && action.field && action.transformation && action.validation && action.officialUrl);
  }
  assert.deepEqual(reports[0].canonicalRecords, reports[1].canonicalRecords);
  assert.deepEqual(reports[1].canonicalRecords, reports[2].canonicalRecords);
  assert.deepEqual(f, original, 'reporting is a pure projection');
});

test('measurement selection does not populate workforce or injury fields with unrelated noise readings', () => {
  const report = build(fixture(), 'ifc');
  const noise = report.fields.find(f => f.field === 'Noise/air/effluent observations');
  assert.equal(noise.status, 'partially_resolved');
  assert.equal(noise.values[0].recordId, 'reading-1');
  assert.equal(noise.values[0].value.value, 48);
  assert.equal(noise.values[0].value.unit, 'dBA');
  for (const name of ['Direct/contract worker counts', 'Women among direct workers', 'Injury and fatality counts']) {
    const field = report.fields.find(f => f.field === name);
    assert.equal(field.status, 'unresolved');assert.deepEqual(field.values, []);
  }
  assert.equal(report.fields.find(f => f.canonicalEntity === 'Approval').status, 'unresolved');
});

test('all views omit private case bodies, identity, ciphertext, source quotes and arbitrary extensions', () => {
  const f = fixture();
  f.engagements[0].measurements.push({id: 'private-reading', indicatorId: 'noise-1', value: 987654321, assertionIds: ['alias']});
  for (const view of ['canonical', 'ifc', 'world_bank', 'adb', 'ebrd', 'eib', 'fmo']) {
    const report = build(f, view), bytes = JSON.stringify(report);
    for (const forbidden of ['PRIVATE_', 'PERSONAL_NAME_MUST_NOT_ESCAPE', 'SOURCE_QUOTE_MUST_NOT_ESCAPE', 'SECRET_EXTENSION', 'protected-version', 'protected-assertion']) assert.equal(bytes.includes(forbidden), false, `${view}: ${forbidden}`);
    const event = report.canonicalRecords.find(r => r.entity === 'Event');
    assert.deepEqual(Object.keys(event).sort(), ['id', 'kind', 'status', 'occurredAt', 'entity', 'engagementId', 'projectId', 'restrictedDetailsOmitted'].sort());
    assert.equal(event.restrictedDetailsOmitted, true);
    assert.equal(bytes.includes('987654321'), false, 'restricted assertion aliases also protect derived readings');
  }
});

test('institution applicability and assessment status remain distinct with unknown coverage explicit', () => {
  const f = fixture(), ifc = build(f, 'ifc'), adb = build(f, 'adb'), ebrd = build(f, 'ebrd');
  const ifcStatus = ifc.assessmentStatusByFramework.find(r => r.frameworkId === 'ifc_ps_2012');
  const adbStatus = adb.assessmentStatusByFramework.find(r => r.frameworkId === 'adb_esf_2024');
  assert.deepEqual(ifcStatus.performanceCounts, {compliant: 1});
  assert.deepEqual(adbStatus.performanceCounts, {});
  assert.deepEqual(adbStatus.unassessedRequirements, [{engagementId: 'e1', requirementId: 'req-adb'}]);
  for (const field of ebrd.fields.filter(f => f.canonicalEntity === 'RequirementApplicability')) assert.deepEqual(field.values, []);
  assert.ok(ebrd.fields.every(f => f.complianceEstablished === false));
  assert.deepEqual(ifc.portfolio.amounts, [{currency: 'USD', amount: '100'}]);
  assert.deepEqual(ifc.sectorCoverage.unknownLeafInvestmentIds, ['sub-1']);
});

test('only caller-selected engagement facts are used and unrelated projections are rejected', () => {
  const f = fixture();
  f.engagements[0].baselines = [{measurements: [{id: 'not-selected', indicatorId: 'noise-1', value: 999}]}];
  const r = build(f, 'ifc');
  assert.equal(r.canonicalRecords.some(record => record.id === 'not-selected'), false);
  assert.equal(r.canonicalRecords.find(record => record.id === 'reading-1').value, 48);
  assert.throws(() => build({...f, engagements: [{id: 'other', projectId: 'other-project'}]}, 'ifc'), /selected project graph/);
  assert.throws(() => build({...f, datasetSha256: undefined}, 'ifc'), /SHA256/);
  const baseline = {...f.engagements[0], id: 'baseline-1', engagement: {id: 'e1', projectId: 'p1'}};
  const pinned = build({...f, engagements: [baseline]}, 'ifc');
  assert.equal(pinned.canonicalRecords.find(record => record.id === 'reading-1').engagementId, 'e1');
});

function periodAuthority() {
  const f = fixture(), e = f.engagements[0];
  e.programs = [{id: 'program', baselineActionIds: ['action-dd']}];
  e.cycles = [{id: 'july', programId: 'program', periodStart: '2026-07-01', periodEnd: '2026-07-31', requirementIds: ['req-ifc']}, {id: 'september', programId: 'program', periodStart: '2026-09-01', periodEnd: '2026-09-30', requirementIds: ['req-ifc']}];
  e.findings = [{id: 'finding-dd', requirementId: 'req-ifc', performance: 'undetermined'}, {id: 'finding-july', cycleId: 'july', requirementId: 'req-ifc', performance: 'compliant'}, {id: 'finding-september', cycleId: 'september', requirementId: 'req-ifc', performance: 'noncompliant', residualRisk: 'high', riskTrajectory: 'increasing'}];
  e.indicators[0].programId = 'program';
  e.measurements = [{id: 'july-reading', cycleId: 'july', indicatorId: 'noise-1', value: 48}, {id: 'september-reading', cycleId: 'september', indicatorId: 'noise-1', value: 68}];
  e.actions = [{id: 'action-dd', status: 'open'}, {id: 'old-open-action', cycleId: 'july', status: 'open'}, {id: 'old-closed-action', cycleId: 'july', status: 'closed'}, {id: 'september-action', cycleId: 'september', status: 'open'}];
  const baseline = {...structuredClone(e), format: 'esia-engagement-snapshot', schemaVersion: 1, id: 'september-baseline', engagement: {id: 'e1', projectId: 'p1', status: 'approved'}, obligations: [], approvals: [], sourceVersions: [],
    scope: {kind: 'monitoring_cycle', cycleId: 'september', programId: 'program', findingIds: ['finding-september']}};
  baseline.sha256 = createHash('sha256').update(snapshotDigestInput(baseline)).digest('hex');e.baselines = [baseline];
  return {f, e, baseline};
}

test('an exact cycle baseline reports its own judgments and observations while prior contradictory periods stay historical', () => {
  const {f, e, baseline} = periodAuthority();
  const {projection, context} = selectLifecycleAssessmentProjection(e, {baselineId: baseline.id, baselineSha256: baseline.sha256});
  assert.deepEqual(projection.findings.map(f => f.id), ['finding-september']);
  assert.deepEqual(projection.cycles.map(c => c.id), ['september']);
  assert.deepEqual(projection.measurements.map(m => m.id), ['september-reading']);
  assert.deepEqual(projection.actions.map(a => a.id), ['action-dd', 'old-open-action', 'september-action']);
  assert.deepEqual(context.historicalRecordIds.findings, ['finding-dd', 'finding-july']);
  assert.equal(context.historicalCounts.measurements, 1);
  assert.equal(projection.sha256, undefined, 'filtered content does not carry the immutable baseline digest as its own hash');
  const report = build({...f, engagements: [projection]}, 'ifc');
  assert.deepEqual(report.assessmentStatusByFramework[0].performanceCounts, {noncompliant: 1});
  assert.throws(() => selectLifecycleAssessmentProjection(e, {baselineId: baseline.id, baselineSha256: '0'.repeat(64)}), /exact ID and SHA256/);
  const working = selectLifecycleAssessmentProjection(e);
  assert.equal(working.context.approvalStatus, 'current_unapproved');
  assert.deepEqual(working.projection.findings.map(f => f.id), ['finding-september']);
});

test('protection closure covers v2 geometry, historic restrictions and duplicate-byte source aliases before period filtering', () => {
  const {f, e} = periodAuthority(), protectedHash = 'd'.repeat(64);
  e.sourceVersions = [{id: 'private-original', sha256: protectedHash}, {id: 'byte-alias', sha256: protectedHash}];
  e.assertions = [{id: 'byte-alias-assertion', versionId: 'byte-alias', sourceSha256: protectedHash, locator: 'PRIVATE_LOCATOR', quote: 'PRIVATE_QUOTE'}];
  e.events = [{id: 'old-private-event', kind: 'incident', status: 'closed', cycleId: 'july', programId: 'program', history: [{restrictedProtection: {sourceBindings: [{versionId: 'private-original', sha256: protectedHash}], geometryBindings: [{kind: 'indicator', indicatorId: 'noise-1'}]}}]}];
  e.indicators[0].location = 'PRIVATE_INDICATOR_LOCATION';
  e.measurements[1].location = 'PRIVATE_MEASUREMENT_LOCATION';e.measurements[1].assertionIds = ['byte-alias-assertion'];
  const selected = selectLifecycleAssessmentProjection(e);
  assert.equal(selected.projection.events.length, 0, 'historic restricted event is outside the selected period');
  const report = build({...f, engagements: [selected.projection]}, 'ifc'), bytes = JSON.stringify(report);
  for (const forbidden of ['PRIVATE_INDICATOR_LOCATION', 'PRIVATE_MEASUREMENT_LOCATION', 'PRIVATE_LOCATOR', 'PRIVATE_QUOTE']) assert.equal(bytes.includes(forbidden), false, forbidden);
  assert.equal(selected.projection.indicators[0].location, 'Protected monitoring location');
  const redacted = build({...f, engagements: [{...e, events: [{id: 'already-redacted', kind: 'incident', status: 'investigating', restrictedAvailable: true}]}]}, 'ifc');
  assert.equal(redacted.canonicalRecords.find(r => r.id === 'already-redacted').restrictedDetailsOmitted, true);
});

test('reviewed sector profiles aggregate active leaf exposure by currency without guessing mixed or unknown activity scopes', () => {
  const f = fixture();
  f.graph.entities.activities = [{id: 'activity', projectId: 'p1', sectorProfileId: 'agriculture', provenance: {reviewStatus: 'verified'}}];
  f.graph.entities.allocations.push({id: 'expired-allocation', investmentId: 'sub-1', projectId: 'p1', effectiveTo: '2026-01-01', amount: {amount: '999', currency: 'USD'}});
  let report = buildLifecycleInstitutionView({...f, view: 'fmo', asOf: '2026-10-25'});
  assert.deepEqual(report.sectorCoverage.groups[0].amounts, [{currency: 'USD', amount: '100'}]);
  assert.deepEqual(report.sectorCoverage.groups[0].allocationIds, ['allocation-1']);
  assert.equal(report.portfolioMonitoring.rows[0].investmentId, 'sub-1');
  assert.equal(report.portfolioMonitoring.rows[0].counts.measurements, 1);
  assert.equal(report.sectorCoverage.status, 'complete');
  f.graph.entities.activities.push({id: 'unreviewed', projectId: 'p1', sectorProfileId: 'agriculture', provenance: {reviewStatus: 'unreviewed'}});
  report = buildLifecycleInstitutionView({...f, view: 'fmo', asOf: '2026-10-25'});
  assert.deepEqual(report.sectorCoverage.unknownAllocationIds, ['allocation-1']);
  f.graph.entities.activities[1] = {id: 'mixed', projectId: 'p1', sectorProfileId: 'power_generation', provenance: {reviewStatus: 'verified'}};
  report = buildLifecycleInstitutionView({...f, view: 'fmo', asOf: '2026-10-25'});
  assert.deepEqual(report.sectorCoverage.mixedAllocationIds, ['allocation-1']);
  assert.deepEqual(report.sectorCoverage.groups, []);
});
