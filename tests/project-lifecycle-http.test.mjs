import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {mkdtempSync, rmSync, mkdirSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createLocalWorkspaceServer} from '../server/local-workspace.mjs';
import {lifecycleCollections} from '../src/lib/project-lifecycle.js';
import {seedMonitoringJourney, monitoringPrivateText} from './fixtures/monitoring-journey.mjs';
import {mandate} from './fixtures/engagement-journey.mjs';
import {getAuditChecks} from '../src/lib/framework-register.js';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'esia-lifecycle-http-'));let server, externalCalls = 0;
  const start = () => {server = createLocalWorkspaceServer({directory, capture: async () => {externalCalls++;throw Error('Protected external capture blocked');}, inspect: async () => {externalCalls++;throw Error('Protected external inspection blocked');}});server.address = () => ({port: 4173});};start();
  t.after(() => {server.emit('close');rmSync(directory, {recursive: true, force: true});});
  const request = async (path, {method = 'GET', body, account, headers = {}} = {}) => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);Object.assign(req, {url: path, method, headers: {host: '127.0.0.1:4173', 'x-esia-workspace': 'local', 'content-type': 'application/json', ...(account ? {'x-esia-account': account} : {}), ...headers}});
    return new Promise((yes, no) => {const res = new EventEmitter();res.writeHead = (status, headers) => Object.assign(res, {status, headers});res.end = bytes => yes({status: res.status, headers: res.headers, bytes: Buffer.from(bytes || ''), json: () => JSON.parse(String(bytes))});server.listeners('request')[0](req, res).catch(no);});
  };
  return {request, restart() {server.emit('close');start();}, get externalCalls() {return externalCalls;}};
}
async function json(api, path, options = {}, expected = 200) {const response = await api.request(path, options);assert.equal(response.status, expected, `${path}: ${response.bytes}`);return response.json();}
async function link(api, project) {const identity = await json(api, '/api/project-identities', {method: 'POST', body: {name: `${project.name} physical identity`}}, 201);const linked = await json(api, `/api/projects/${project.id}/context`, {method: 'PUT', body: {identityId: identity.id}});return {project: linked, binding: {projectId: project.id, identityId: identity.id}};}
async function command(api, command, actorId = 'Alice', account) {const ledger = await json(api, '/api/project-lifecycle', {account});return json(api, '/api/project-lifecycle/commands', {account, method: 'POST', body: {expectedRevision: ledger.revision, actorId, command}});}
function retain(name, value) {if (!process.env.ESIA_LIFECYCLE_EVIDENCE_DIR) return;const root = resolve(process.env.ESIA_LIFECYCLE_EVIDENCE_DIR);mkdirSync(root, {recursive: true, mode: 0o700});writeFileSync(join(root, `${name}.json`), JSON.stringify(value, null, 2) + '\n', {mode: 0o600});}

test('multi-framework engagements retain distinct applicability and judgments while sharing project, component and source identity', async t => {
  const api = fixture(t);let project = await json(api, '/api/projects', {method: 'POST', body: {name: 'SYNTHETIC multi-lender infrastructure', client: 'Synthetic financiers', phase: 'due_diligence', period: '2026'}}, 201);
  project = await json(api, `/api/projects/${project.id}/commands`, {method: 'POST', body: {expectedRevision: project.revision, command: {type: 'intake', mode: 'managed', title: 'SYNTHETIC agreement and evidence', filename: 'synthetic-mandate.txt', mediaType: 'text/plain', contentBase64: Buffer.from('SYNTHETIC financing and mandate. Assess project risks; retain separate lender conclusions.').toString('base64')}}});
  const {binding} = await link(api, project), source = project.resources[0].versions[0], engagements = [];
  for (const frameworkId of ['ifc_ps_2012', 'wb_esf_2016']) {
    let e = await json(api, '/api/engagements', {method: 'POST', body: {...mandate(project.id, source.id), name: `Synthetic ${frameworkId} assignment`, frameworkIds: [frameworkId]}}, 201);
    e = await json(api, `/api/engagements/${e.id}/commands`, {method: 'POST', body: {expectedRevision: e.revision, actorId: 'Alice', command: {type: 'requirement-add', frameworkId, checkId: getAuditChecks(frameworkId)[0].id, checkSet: 'curated'}}});engagements.push(e);
  }
  const financiers = [{organizationId: 'ifc-lender', amount: '50'}, {organizationId: 'wb-lender', amount: '30'}, {organizationId: 'commercial-lender', amount: '20'}];
  const ledger = await command(api, {type: 'batch', commands: [
    {type: 'projects-set', projects: [binding]},
    {type: 'upsert', collection: 'components', records: [{id: 'main-facility', projectId: project.id, name: 'Same actual facility', kind: 'component'}, {id: 'turbine-unit', projectId: project.id, name: 'Turbine and generation unit', kind: 'subcomponent', parentComponentId: 'main-facility'}, {id: 'access-road', projectId: project.id, name: 'Associated access road', kind: 'associated_facility'}]},
    {type: 'upsert', collection: 'organizations', records: [{id: 'ifc-lender', name: 'SYNTHETIC IFC financier', kind: 'dfi'}, {id: 'wb-lender', name: 'SYNTHETIC World Bank financier', kind: 'dfi'}, {id: 'commercial-lender', name: 'SYNTHETIC commercial cofinancier', kind: 'bank'}, {id: 'project-company', name: 'SYNTHETIC project company', kind: 'company'}]},
    {type: 'upsert', collection: 'investments', records: financiers.map((financier, i) => ({id: `lender-investment-${i}`, name: `SYNTHETIC separate lender investment ${i + 1}`, kind: 'direct', investorOrganizationId: financier.organizationId, investeeOrganizationId: 'project-company', amount: {amount: financier.amount, currency: 'USD'}, status: 'committed'}))},
    {type: 'upsert', collection: 'financialFacilities', records: financiers.map((financier, i) => ({id: `lender-facility-${i}`, name: `SYNTHETIC separate financing facility ${i + 1}`, kind: 'loan', borrowerOrganizationId: 'project-company', agreementIds: [], commitment: {amount: financier.amount, currency: 'USD'}}))},
    {type: 'upsert', collection: 'financingParticipants', records: financiers.map((financier, i) => ({id: `lender-participant-${i}`, financialFacilityId: `lender-facility-${i}`, organizationId: financier.organizationId, role: 'lender', sharePercent: '100'}))},
    {type: 'upsert', collection: 'transactions', records: financiers.map((financier, i) => ({id: `lender-transaction-${i}`, investmentId: `lender-investment-${i}`, financialFacilityId: `lender-facility-${i}`, kind: 'commitment', amount: {amount: financier.amount, currency: 'USD'}, transactionDate: i ? '2026-06-02' : '2026-06-01', status: 'executed'}))},
    {type: 'upsert', collection: 'allocations', records: financiers.map((financier, i) => ({id: `lender-allocation-${i}`, investmentId: `lender-investment-${i}`, projectId: project.id, componentId: i ? 'turbine-unit' : 'main-facility', amount: {amount: financier.amount, currency: 'USD'}}))},
    {type: 'upsert', collection: 'engagementScopes', records: engagements.map((e, i) => ({id: `scope-${i}`, engagementId: e.id, projectId: project.id, componentIds: ['main-facility', 'turbine-unit', 'access-road'], siteIds: [], periodStart: '2026-01-01', periodEnd: '2026-12-31'}))},
    {type: 'upsert', collection: 'requirementApplicabilities', records: engagements.map((e, i) => ({id: `applicability-${i}`, projectId: project.id, frameworkEditionId: e.frameworkIds[0], requirementRef: {engagementId: e.id, id: e.requirements[0].id, revision: e.requirements[0].revision}, decision: i ? 'uncertain' : 'applicable', rationale: i ? 'The second lender requires its own scope review.' : 'The first lender requirement applies to the selected component.', componentIds: ['main-facility'], investmentId: `lender-investment-${i}`, financialFacilityId: `lender-facility-${i}`, assessedAt: '2026-10-01T00:00:00.000Z', assessedBy: 'Alice'}))}
  ]});
  assert.equal(ledger.entities.investments.length, 3);assert.equal(ledger.entities.components.length, 3);assert.equal(ledger.entities.transactions.length, 3);assert.equal(ledger.entities.engagementScopes.length, 2);
  assert.deepEqual(ledger.entities.requirementApplicabilities.map(row => row.decision), ['applicable', 'uncertain']);
  const outputs = await Promise.all(['ifc', 'world_bank', 'adb'].map(view => json(api, `/api/project-lifecycle/report?view=${view}`)));
  assert.equal(new Set(outputs.map(row => row.datasetSha256)).size, 1);assert.equal(new Set(outputs.map(row => row.snapshotSha256)).size, 1);assert.deepEqual(outputs[0].portfolio.amounts, [{currency: 'USD', amount: '100'}]);
  for (const e of engagements) {const current = await json(api, `/api/engagements/${e.id}`);assert.equal(current.revision, e.revision);assert.equal(current.findings.length, 0, 'No framework conclusion is automatically transferred.');}
  const saved = await json(api, `/api/projects/${project.id}`);assert.equal(saved.resources.length, 1);assert.equal(saved.resources[0].versions.length, 1);assert.equal(saved.resources[0].versions[0].id, source.id);
  assert.equal(api.externalCalls, 0);retain('scenario-a', {synthetic: true, binding, ledger, reports: outputs, sourceVersionCount: 1, externalCalls: api.externalCalls});
});

test('Scenario C: screening through three monitoring cycles, serious incident, restructuring and financial closure reuses immutable assessments and open post-closure commitments', async t => {
  const api = fixture(t), started = performance.now(), journey = await seedMonitoringJourney({request: api.request}), {project, engagement, cycles, event, action, baselines, dueDiligenceBaseline} = journey;
  const beforeProject = await json(api, `/api/projects/${project.id}`), beforeEngagement = await json(api, journey.route), {binding} = await link(api, project);
  const exactSource = {projectId: project.id, resourceId: project.resources[0].id, versionId: journey.versions[0].id, sha256: journey.versions[0].sha256};
  const events = [
    ['origination', 'Origination recorded after late entry', '2026-01-01'], ['screening', 'Initial risk screening', '2026-01-15'], ['due_diligence', 'Approved due diligence', '2026-02-01'], ['appraisal', 'Investment appraisal', '2026-03-01'], ['commitment', 'Financial commitment', '2026-04-01'], ['construction', 'Implementation supervision', '2026-05-01']
  ].map(([phase, title, date], i) => ({id: `phase-${i}`, projectId: project.id, phase, title, status: 'completed', eventAt: `${date}T00:00:00.000Z`, ...(phase === 'due_diligence' ? {engagementId: engagement.id, baselineId: dueDiligenceBaseline.id, baselineSha256: dueDiligenceBaseline.sha256} : {})}));
  cycles.forEach((cycle, index) => events.push({id: `operation-${index}`, projectId: project.id, phase: 'operations', title: `Monitoring cycle ${index + 1}`, status: 'completed', eventAt: `${cycle.periodEnd}T00:00:00.000Z`, engagementId: engagement.id, cycleId: cycle.id, baselineId: baselines[index].id, baselineSha256: baselines[index].sha256}));
  events.push({id: 'serious-incident', projectId: project.id, phase: 'operations', title: 'Significant incident and corrective follow-up', status: 'in_progress', eventAt: event.occurredAt, engagementId: engagement.id, eventId: event.id, actionId: action.id}, {id: 'restructuring', projectId: project.id, phase: 'restructuring', title: 'Restructuring retains outstanding corrective actions', status: 'completed', eventAt: '2026-10-01T00:00:00.000Z', engagementId: engagement.id, actionId: action.id}, {id: 'financial-closure', projectId: project.id, phase: 'exit', title: 'Financial closure does not close E&S commitments', status: 'completed', eventAt: '2026-10-15T00:00:00.000Z', engagementId: engagement.id, baselineId: baselines[2].id, baselineSha256: baselines[2].sha256}, {id: 'post-closure', projectId: project.id, phase: 'post_closure', title: 'Post-closure outcome verification remains required', status: 'in_progress', eventAt: '2026-10-20T00:00:00.000Z', engagementId: engagement.id, actionId: action.id});
  let ledger = await command(api, {type: 'batch', commands: [
    {type: 'projects-set', projects: [binding]},
    {type: 'upsert', collection: 'organizations', records: [{id: 'supervising-lender', name: 'Synthetic multi-period lender', kind: 'dfi'}, {id: 'sponsor', name: 'Synthetic sponsor', kind: 'company'}]},
    {type: 'upsert', collection: 'investments', records: [{id: 'supervised-investment', name: 'Synthetic longitudinal financing', kind: 'direct', investorOrganizationId: 'supervising-lender', investeeOrganizationId: 'sponsor', status: 'exited', amount: {amount: '100', currency: 'USD'}}]},
    {type: 'upsert', collection: 'allocations', records: [{id: 'supervised-allocation', investmentId: 'supervised-investment', projectId: project.id, amount: {amount: '100', currency: 'USD'}}]},
    {type: 'upsert', collection: 'agreements', records: [{id: 'monitoring-agreement', name: 'Synthetic sourced monitoring commitment', kind: 'engagement', organizationIds: ['supervising-lender', 'sponsor'], projectIds: [project.id], financialFacilityIds: [], sourceVersions: [exactSource], status: 'effective'}]},
    {type: 'upsert', collection: 'covenants', records: [{id: 'ongoing-covenant', agreementId: 'monitoring-agreement', title: 'Continue monitoring and corrective verification', text: 'Synthetic recurring monitoring duty remains after financial exit.', projectId: project.id, componentIds: [], source: exactSource, locator: 'Synthetic ToR first paragraph', requirementRefs: engagement.requirements.map(row => ({engagementId: engagement.id, id: row.id})), monitoringObligationRefs: [{engagementId: engagement.id, id: engagement.monitoringObligations[0].id}]}]},
    {type: 'upsert', collection: 'engagementScopes', records: [{id: 'supervision-scope', engagementId: engagement.id, projectId: project.id, componentIds: [], siteIds: [], periodStart: '2026-01-01', periodEnd: '2027-12-31'}]},
    {type: 'upsert', collection: 'requirementApplicabilities', records: engagement.requirements.map((row, index) => ({id: `supervised-app-${index}`, projectId: project.id, frameworkEditionId: row.frameworkId, requirementRef: {engagementId: engagement.id, id: row.id}, decision: 'applicable', rationale: 'The exact assignment scopes this requirement throughout supervision.', componentIds: [], agreementId: 'monitoring-agreement', investmentId: 'supervised-investment', assessedAt: '2026-01-01T00:00:00.000Z', assessedBy: 'Alice'}))},
    {type: 'upsert', collection: 'lifecycleEvents', records: events}
  ]});
  const beforeWrong = structuredClone(ledger);
  await json(api, '/api/project-lifecycle/commands', {method: 'POST', body: {expectedRevision: ledger.revision, actorId: 'Alice', command: {type: 'upsert', collection: 'lifecycleEvents', records: [{...events[2], baselineSha256: '0'.repeat(64)}]}}}, 400);
  await json(api, '/api/project-lifecycle/commands', {method: 'POST', body: {expectedRevision: ledger.revision, actorId: 'Alice', command: {type: 'upsert', collection: 'lifecycleEvents', records: [{...events[6], baselineId: baselines[2].id, baselineSha256: baselines[2].sha256}]}}}, 400);
  const undated = {...events[2]};delete undated.eventAt;await json(api, '/api/project-lifecycle/commands', {method: 'POST', body: {expectedRevision: ledger.revision, actorId: 'Alice', command: {type: 'upsert', collection: 'lifecycleEvents', records: [undated]}}}, 400);
  assert.deepEqual(await json(api, '/api/project-lifecycle'), beforeWrong);
  for (const collection of lifecycleCollections) for (const row of ledger.entities[collection]) ledger = await command(api, {type: 'verify', collection, id: row.id, statement: 'Verified synthetic business chronology, exact sources and retained review links.'}, 'Bob');
  ledger = await command(api, {type: 'approve', statement: 'Approve this exact business context. This attestation does not change professional assessments or close outstanding E&S duties.'}, 'Cara');
  const approved = ledger.approvedSnapshots.at(-1), reports = [];
  for (const view of ['canonical', 'ifc', 'world_bank', 'adb', 'ebrd', 'eib', 'fmo']) reports.push(await json(api, `/api/project-lifecycle/report?view=${view}&snapshotId=${approved.id}`));
  assert.equal(new Set(reports.map(row => row.datasetSha256)).size, 1);assert.equal(new Set(reports.map(row => row.snapshotSha256)).size, 1);
  for (const report of reports) {assert.equal(report.assessmentContexts[0].mode, 'approved_baseline');assert.equal(report.assessmentContexts[0].baselineSha256, baselines[2].sha256);assert.equal(report.lifecycle.filter(row => row.phase === 'operations' && row.cycleId).length, 3);if (report.view !== 'canonical') assert.ok(report.institutionView.unresolvedFields.length > 0);const bytes = JSON.stringify(report);assert.equal(bytes.includes(monitoringPrivateText), false);assert.equal(bytes.includes('ciphertext'), false);}
  for (const report of reports.filter(row => ['ifc', 'world_bank', 'adb'].includes(row.view))) {assert.ok(report.institutionView.coverage.resolved > 0);const field = report.institutionView.fields.find(row => row.canonicalPath === 'CorrectiveAction.status');assert.ok(field.values.some(row => row.recordId === action.id));}
  const afterEngagement = await json(api, journey.route);assert.deepEqual(afterEngagement.baselines, beforeEngagement.baselines);assert.equal(afterEngagement.actions.find(row => row.id === action.id).status, 'open');assert.equal(afterEngagement.monitoringObligations[0].status, 'reopened');assert.equal(afterEngagement.events.find(row => row.id === event.id).status, 'investigating');
  const afterProject = await json(api, `/api/projects/${project.id}`);assert.equal(afterProject.revision, beforeProject.revision);assert.deepEqual(afterProject.resources, beforeProject.resources);
  api.restart();assert.deepEqual(await json(api, '/api/project-lifecycle'), ledger);assert.deepEqual(await json(api, `/api/project-lifecycle/report?view=ifc&snapshotId=${approved.id}`), reports[1]);
  const timings = [];for (let index = 0; index < 3; index++) {const at = performance.now();await json(api, `/api/project-lifecycle/report?view=ifc&snapshotId=${approved.id}`);timings.push(performance.now() - at);}assert.ok(Math.max(...timings) < 5000, `Bounded local report latency: ${timings}`);
  assert.equal(api.externalCalls, 0);retain('scenario-c', {synthetic: true, ledger, reports, existingAssessmentBaselinesUnchanged: true, originalVersionCount: project.resources.length, retainedAssessmentBaselineCount: baselines.length + 1, openActionsAfterFinancialExit: afterEngagement.actions.filter(row => row.status === 'open').map(row => row.id), performance: {reportMs: timings, journeyMs: performance.now() - started, limitMs: 5000}, externalCalls: api.externalCalls});
});

test('local account, origin, exact source and revision boundaries guard lifecycle HTTP operations', async t => {
  const api = fixture(t);const account = await json(api, '/api/storage-accounts', {method: 'POST', body: {name: 'Other synthetic owner', organization: 'Other', dataOwner: 'Other'}}, 201);
  const project = await json(api, '/api/projects', {method: 'POST', body: {name: 'SYNTHETIC scoped project', client: 'Fixture', phase: 'screening', period: '2026'}}, 201), {binding} = await link(api, project);
  const saved = await command(api, {type: 'projects-set', projects: [binding]});
  assert.equal((await api.request('/api/project-lifecycle', {headers: {origin: 'https://outside.invalid'}})).status, 403);
  assert.equal((await api.request('/api/project-lifecycle', {headers: {'x-esia-workspace': 'remote'}})).status, 403);
  await json(api, '/api/project-lifecycle/commands', {account: account.id, method: 'POST', body: {expectedRevision: 0, actorId: 'Alice', command: {type: 'projects-set', projects: [binding]}}}, 409);
  const other = await json(api, '/api/project-lifecycle', {account: account.id});assert.equal(other.revision, 0);assert.notEqual(other.context.accountId, saved.context.accountId);
  await json(api, '/api/project-lifecycle/import', {account: account.id, method: 'POST', body: {expectedRevision: 0, actorId: 'Alice', exchange: saved}}, 409);
  await json(api, '/api/project-lifecycle/commands', {method: 'POST', body: {expectedRevision: saved.revision - 1, actorId: 'Alice', command: {type: 'projects-set', projects: []}}}, 409);
  await json(api, '/api/project-lifecycle/report?unexpected=value', {}, 400);assert.deepEqual(await json(api, '/api/project-lifecycle'), saved);assert.equal(api.externalCalls, 0);
});
