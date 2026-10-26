import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, writeFileSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createAccountWorkspace} from '../server/local-account-workspace.mjs';
import {createProjectLifecycleStore} from '../server/project-lifecycle-store.mjs';
import {lifecycleCollections, lifecyclePortfolio} from '../src/lib/project-lifecycle.js';
import {performance} from 'node:perf_hooks';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'esia-lifecycle-')), extras = [];
  let workspace = createAccountWorkspace({directory});
  const scoped = () => workspace.forAccount();
  function project(name) {const identity = workspace.createProjectIdentity({name: `SYNTHETIC ${name}`});return scoped().createProject({name: `SYNTHETIC ${name} review`, client: 'Synthetic client', phase: 'screening', period: '2026', realWorldProjectId: identity.id});}
  const projects = [project('Infrastructure'), project('Associated facility')];
  const bindings = projects.map(row => ({projectId: row.id, identityId: row.projectContext.identity.id}));
  const service = () => scoped().lifecycle();
  const command = (body, actorId = 'Alice') => service().command(service().get().revision, body, actorId);
  const upsert = (collection, records) => command({type: 'upsert', collection, records});
  const verifyAll = () => {for (const collection of lifecycleCollections) for (const row of service().get().entities[collection]) command({type: 'verify', collection, id: row.id, statement: 'Checked this synthetic business record against its exact scope and sources.'}, 'Bob');};
  t.after(() => {for (const item of extras) item.close();workspace.close();rmSync(directory, {recursive: true, force: true});});
  return {directory, extras, projects, bindings, service, command, upsert, verifyAll, scoped, restart() {workspace.close();workspace = createAccountWorkspace({directory});}};
}
const org = (id, kind = 'dfi') => ({id, name: `SYNTHETIC ${id}`, kind});
const investment = (id, amount, extra = {}) => ({id, name: `SYNTHETIC ${id}`, kind: 'direct', investorOrganizationId: 'lender-a', amount: {amount, currency: 'USD'}, status: 'committed', ...extra});

test('Scenario A: one coherent multi-lender graph spans projects, hierarchical components, transactions, aliases and immutable business approvals', t => {
  const f = fixture(t), [main, associated] = f.projects, original = f.scoped().getProject(main.id);
  const ledger = f.command({type: 'batch', commands: [
    {type: 'projects-set', projects: f.bindings},
    {type: 'upsert', collection: 'organizations', records: [org('lender-a'), org('lender-b'), org('borrower', 'company')]},
    {type: 'upsert', collection: 'components', records: [
      {id: 'power', projectId: main.id, name: 'Power facility', kind: 'component'},
      {id: 'turbine', projectId: main.id, name: 'Turbine', kind: 'subcomponent', parentComponentId: 'power'},
      {id: 'line', projectId: main.id, name: 'Associated line', kind: 'associated_facility', associatedProjectId: associated.id}
    ]},
    {type: 'upsert', collection: 'sites', records: [{id: 'site', projectId: main.id, name: 'Synthetic monitoring point', componentIds: ['power'], countryCode: 'UG', latitude: 0.5, longitude: 33.1}]},
    {type: 'upsert', collection: 'investments', records: [investment('investment-a', '60.25', {externalReferences: [{namespace: 'urn:synthetic:ifc:project', value: 'SYNTHETIC-001'}]}), investment('investment-b', '40.25', {investorOrganizationId: 'lender-b'})]},
    {type: 'upsert', collection: 'financialFacilities', records: [{id: 'facility-a', name: 'Separate loan A', kind: 'loan', borrowerOrganizationId: 'borrower', agreementIds: ['agreement'], commitment: {amount: '60.25', currency: 'USD'}}, {id: 'facility-b', name: 'Separate loan B', kind: 'loan', borrowerOrganizationId: 'borrower', agreementIds: [], commitment: {amount: '40.25', currency: 'USD'}}]},
    {type: 'upsert', collection: 'agreements', records: [{id: 'agreement', name: 'Synthetic financing terms', kind: 'financing', organizationIds: ['lender-a', 'borrower'], projectIds: [main.id, associated.id], financialFacilityIds: ['facility-a'], sourceVersions: [], status: 'draft'}]},
    {type: 'upsert', collection: 'financingParticipants', records: [{id: 'participation-a', financialFacilityId: 'facility-a', organizationId: 'lender-a', role: 'lender', commitment: {amount: '60.25', currency: 'USD'}, sharePercent: '100'}, {id: 'participation-b', financialFacilityId: 'facility-b', organizationId: 'lender-b', role: 'lender', sharePercent: '100'}]},
    {type: 'upsert', collection: 'transactions', records: [{id: 'transaction-a', investmentId: 'investment-a', financialFacilityId: 'facility-a', agreementId: 'agreement', kind: 'commitment', amount: {amount: '60.25', currency: 'USD'}, transactionDate: '2026-06-01', status: 'executed'}, {id: 'transaction-b', investmentId: 'investment-b', financialFacilityId: 'facility-b', kind: 'disbursement', amount: {amount: '20', currency: 'USD'}, transactionDate: '2026-07-01', status: 'executed'}]},
    {type: 'upsert', collection: 'allocations', records: [{id: 'allocation-a', investmentId: 'investment-a', projectId: main.id, componentId: 'power', amount: {amount: '45.25', currency: 'USD'}}, {id: 'allocation-associated', investmentId: 'investment-a', projectId: associated.id, amount: {amount: '15', currency: 'USD'}}, {id: 'allocation-b', investmentId: 'investment-b', projectId: main.id, componentId: 'turbine', amount: {amount: '40.25', currency: 'USD'}}]},
    {type: 'upsert', collection: 'roleAssignments', records: [{id: 'operator-role', organizationId: 'borrower', role: 'operator', projectId: main.id, effectiveFrom: '2026-01-01', effectiveTo: '2036-12-31'}]}
  ]});
  assert.equal(ledger.revision, 1);assert.equal(ledger.entities.transactions.length, 2);
  assert.deepEqual(lifecyclePortfolio(ledger).amounts, [{currency: 'USD', amount: '100.5'}]);
  assert.equal(lifecyclePortfolio(ledger, 'investment-a').projectIds.length, 2);
  assert.deepEqual(f.scoped().getProject(main.id), original, 'The extension never edits project resources, facts or assessment records.');
  assert.throws(() => f.command({type: 'approve', statement: 'Premature business approval.'}, 'Cara'), /verify/i);
  f.verifyAll();const approved = f.command({type: 'approve', statement: 'Approve exact synthetic business context, without any compliance conclusion.'}, 'Cara');
  const frozen = structuredClone(approved.approvedSnapshots[0]);f.restart();assert.deepEqual(f.service().get().approvedSnapshots[0], frozen);
  f.upsert('organizations', [org('lender-a', 'bank')]);assert.deepEqual(f.service().get().approvedSnapshots[0], frozen);
  assert.equal(f.service().get().entities.organizations[0].provenance.reviewStatus, 'unreviewed');
  assert.throws(() => f.command({type: 'approve', statement: 'Approval cannot carry across changed information.'}, 'Cara'), /verify/i);
  assert.deepEqual(f.scoped().getProject(main.id), original);
});

test('Scenario B: intermediary and nested fund exposures aggregate leaf allocations by currency without duplicate parent exposure', t => {
  const f = fixture(t), [a, b] = f.projects;
  const ledger = f.command({type: 'batch', commands: [
    {type: 'projects-set', projects: f.bindings},
    {type: 'upsert', collection: 'organizations', records: [org('lender-a'), org('manager', 'fund'), org('intermediary', 'financial_intermediary')]},
    {type: 'upsert', collection: 'investments', records: [investment('fund', '100', {kind: 'fund', investeeOrganizationId: 'manager'}), investment('fi', '100', {kind: 'intermediary', parentInvestmentId: 'fund', investeeOrganizationId: 'intermediary'}), investment('solar', '60', {kind: 'subinvestment', parentInvestmentId: 'fi'}), investment('agriculture', '40', {kind: 'subinvestment', parentInvestmentId: 'fi', amount: {amount: '40', currency: 'EUR'}})]},
    {type: 'upsert', collection: 'allocations', records: [{id: 'parent-exposure', investmentId: 'fund', projectId: a.id, amount: {amount: '100', currency: 'USD'}}, {id: 'solar-exposure', investmentId: 'solar', projectId: a.id, amount: {amount: '60', currency: 'USD'}}, {id: 'agriculture-exposure', investmentId: 'agriculture', projectId: b.id, amount: {amount: '40', currency: 'EUR'}}]},
    {type: 'upsert', collection: 'activities', records: [{id: 'solar-activity', projectId: a.id, name: 'Solar generation', kind: 'renewable_energy', siteIds: []}, {id: 'farm-activity', projectId: b.id, name: 'Crop production', kind: 'agriculture', siteIds: []}]}
  ]});
  const portfolio = lifecyclePortfolio(ledger, 'fund');assert.deepEqual(portfolio.amounts, [{currency: 'EUR', amount: '40'}, {currency: 'USD', amount: '60'}]);
  assert.deepEqual(portfolio.leafInvestmentIds, ['solar', 'agriculture']);assert.equal(portfolio.allocationIds.includes('parent-exposure'), false);
  assert.deepEqual(f.service().report({investmentId: 'fund'}).portfolio, portfolio);
  f.restart();assert.deepEqual(lifecyclePortfolio(f.service().get(), 'fund'), portfolio);
});

test('relationship, precision, date, namespace and scope failures roll back the whole batch without changing history', t => {
  const f = fixture(t), [a, b] = f.projects;f.command({type: 'batch', commands: [{type: 'projects-set', projects: f.bindings}, {type: 'upsert', collection: 'organizations', records: [org('lender-a')]}]});
  const before = f.service().get();
  const cases = [
    ['components', [{id: 'a', projectId: a.id, name: 'A', kind: 'component', parentComponentId: 'b'}, {id: 'b', projectId: a.id, name: 'B', kind: 'component', parentComponentId: 'a'}]],
    ['components', [{id: 'a', projectId: a.id, name: 'A', kind: 'component', parentComponentId: 'b'}, {id: 'b', projectId: b.id, name: 'B', kind: 'component'}]],
    ['sites', [{id: 'site', projectId: a.id, name: 'A', componentIds: [], latitude: 20}]],
    ['organizations', [{...org('extra'), authorization: 'admin'}]],
    ['organizations', [{...org('extra'), extensions: {'unregistered:finance': {schema: 'urn:synthetic:schema', schemaVersion: 1, value: {unsafe: true}}}}]],
    ['roleAssignments', [{id: 'role', organizationId: 'lender-a', role: 'lender', projectId: a.id, effectiveFrom: '2026-02-30'}]],
    ['investments', [investment('wrong', 0.1)]],
    ['investments', [investment('orphan', '1', {investorOrganizationId: 'unknown'})]]
  ];
  for (const [collection, records] of cases) {assert.throws(() => f.upsert(collection, records));assert.deepEqual(f.service().get(), before);}
  assert.throws(() => f.service().command(0, {type: 'projects-set', projects: f.bindings}, 'Alice'), /Refresh/i);
  const finance = [{type: 'upsert', collection: 'investments', records: [investment('investment', '0.3')]}, {type: 'upsert', collection: 'allocations', records: [{id: 'one', investmentId: 'investment', projectId: a.id, amount: {amount: '0.1', currency: 'USD'}, sharePercent: '50'}, {id: 'two', investmentId: 'investment', projectId: b.id, amount: {amount: '0.2', currency: 'USD'}, sharePercent: '50'}]}];
  f.command({type: 'batch', commands: finance});const exact = f.service().get();assert.deepEqual(lifecyclePortfolio(exact).amounts, [{currency: 'USD', amount: '0.3'}]);
  assert.throws(() => f.upsert('allocations', [{id: 'third', investmentId: 'investment', projectId: a.id, amount: {amount: '0.000000000001', currency: 'USD'}}]), /exceed/i);assert.deepEqual(f.service().get(), exact);
  assert.throws(() => f.upsert('allocations', [{id: 'third', investmentId: 'investment', projectId: a.id, sharePercent: '0.000001'}]), /100/i);assert.deepEqual(f.service().get(), exact);
});

test('same-account backup round-trip retains exact history but imported verification cannot authorize a new approval', t => {
  const f = fixture(t);f.command({type: 'batch', commands: [{type: 'projects-set', projects: f.bindings}, {type: 'upsert', collection: 'organizations', records: [org('lender-a')]}]});f.verifyAll();f.command({type: 'approve', statement: 'Synthetic local business context approval.'}, 'Cara');const backup = f.service().get();
  const restored = createProjectLifecycleStore({directory: join(f.directory, 'restore'), accountId: backup.context.accountId, getProject: id => f.scoped().getProjectSummary(id), getEngagement: () => assert.fail('No review references'), getSource: () => null, readSource: () => assert.fail('No source read'), authorize: () => true});f.extras.push(restored);
  assert.deepEqual(restored.import(0, backup, 'Restorer'), backup);assert.deepEqual(restored.import(backup.revision, backup, 'Restorer'), backup);assert.equal(restored.restoreReceipts().length, 1);
  assert.throws(() => restored.command(backup.revision, {type: 'approve', statement: 'Imported assertions cannot supply current verification.'}, 'Cara'), /installation/i);
  const verified = restored.command(backup.revision, {type: 'verify', collection: 'organizations', id: 'lender-a', statement: 'I checked this restored business information.'}, 'Bob');assert.ok(restored.command(verified.revision, {type: 'approve', statement: 'I approve this newly verified business context.'}, 'Cara').approvedSnapshots.length === 2);
  const tampered = structuredClone(backup);tampered.approvedSnapshots[0].snapshot.entities.organizations[0].name = 'Changed historical data';assert.throws(() => f.service().import(backup.revision, tampered, 'Restorer'), /snapshot|changed|invalid/i);assert.deepEqual(f.service().get(), backup);
  const other = structuredClone(backup);other.context.accountId = randomUUID();assert.throws(() => restored.import(restored.get().revision, other, 'Restorer'), /account/i);
});

test('verified authorization precedes project resolution and grants remain separate from business roles', t => {
  const f = fixture(t), accountId = f.scoped().account.custodyId;let reads = 0;
  const service = createProjectLifecycleStore({directory: join(f.directory, 'policy'), accountId,
    getProject: id => {reads++;return f.scoped().getProjectSummary(id);}, getEngagement: () => assert.fail(), getSource: () => null, readSource: () => assert.fail(),
    authorize: ({actorId, action, projectIds}) => actorId !== 'denied' && !(actorId === 'writer' && action === 'approve') && !(actorId === 'outsider' && projectIds.length)
  });f.extras.push(service);
  const initial = service.get('writer');const saved = service.command(initial.revision, {type: 'projects-set', projects: f.bindings}, 'writer');
  const beforeReads = reads;assert.throws(() => service.get('denied'), error => error.status === 403);assert.throws(() => service.get('outsider'), error => error.status === 403);assert.equal(reads, beforeReads);
  assert.throws(() => service.command(saved.revision, {type: 'approve', statement: 'Organization label supplies no approval grant.'}, 'writer'), error => error.status === 403);
  const fake = org('administrator');fake.provenance = {kind: 'human', reviewStatus: 'verified', reviewedBy: 'admin'};
  assert.throws(() => service.command(saved.revision, {type: 'upsert', collection: 'organizations', records: [fake]}, 'writer'), /unsupported|verification/i);
  assert.equal(service.get('writer').revision, saved.revision);
});

test('historical business snapshots recheck their own project grants before resolving old authorities', t => {
  const f = fixture(t), accountId = f.scoped().account.custodyId;let reads = 0;
  const service = createProjectLifecycleStore({directory: join(f.directory, 'historical-policy'), accountId,
    getProject: id => {reads++;return f.scoped().getProjectSummary(id);}, getEngagement: () => assert.fail(), getSource: () => null, readSource: () => assert.fail(),
    authorize: ({actorId, action, projectIds}) => !(actorId === 'limited-reader' && action === 'read' && projectIds.includes(f.projects[0].id))
  });f.extras.push(service);
  let value = service.command(0, {type: 'projects-set', projects: f.bindings}, 'owner');value = service.command(value.revision, {type: 'approve', statement: 'Synthetic project-context-only approval.'}, 'owner');const approval = value.approvedSnapshots[0];
  service.command(value.revision, {type: 'projects-set', projects: []}, 'owner');const before = reads;
  assert.throws(() => service.report({actorId: 'limited-reader', snapshotId: approval.id}), error => error.status === 403);assert.equal(reads, before, 'Historical permissions precede any old project metadata read.');
});

test('effective allocation periods retain history without double counting non-overlapping positions', t => {
  const f = fixture(t), [first, second] = f.projects;
  const ledger = f.command({type: 'batch', commands: [{type: 'projects-set', projects: f.bindings}, {type: 'upsert', collection: 'organizations', records: [org('lender-a')]}, {type: 'upsert', collection: 'investments', records: [investment('rolling-investment', '100')]}, {type: 'upsert', collection: 'allocations', records: [{id: 'old-position', investmentId: 'rolling-investment', projectId: first.id, amount: {amount: '100', currency: 'USD'}, sharePercent: '100', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31'}, {id: 'new-position', investmentId: 'rolling-investment', projectId: second.id, amount: {amount: '100', currency: 'USD'}, sharePercent: '100', effectiveFrom: '2026-01-01'}]}]});
  assert.deepEqual(lifecyclePortfolio(ledger, undefined, {asOf: '2025-12-31'}).allocationIds, ['old-position']);assert.deepEqual(lifecyclePortfolio(ledger, undefined, {asOf: '2026-01-01'}).allocationIds, ['new-position']);
  assert.throws(() => f.upsert('allocations', [{id: 'overlapping-position', investmentId: 'rolling-investment', projectId: first.id, sharePercent: '1', effectiveFrom: '2025-12-31', effectiveTo: '2026-01-01'}]), /effective period/i);
  const oldReport = f.service().report({asOf: '2025-12-31'}), currentReport = f.service().report({asOf: '2026-01-01'});assert.notEqual(oldReport.datasetSha256, currentReport.datasetSha256);assert.equal(oldReport.temporalScope.historicalKnowledgeReconstruction, false);
});

test('source withdrawal and changed bytes prevent verification and approval without changing retained business history', t => {
  const f = fixture(t), project = f.projects[0];
  const withSource = f.scoped().mutate(project.id, project.revision, {type: 'intake', mode: 'managed', title: 'Synthetic financing evidence', filename: 'evidence.txt', mediaType: 'text/plain', contentBase64: Buffer.from('SYNTHETIC financing evidence').toString('base64')});
  const resource = withSource.resources[0], version = resource.versions[0], source = {projectId: project.id, resourceId: resource.id, versionId: version.id, sha256: version.sha256};let available = true;
  const service = createProjectLifecycleStore({directory: join(f.directory, 'source-policy'), accountId: f.scoped().account.custodyId, getProject: id => f.scoped().getProjectSummary(id), getEngagement: () => assert.fail(), getSource: () => ({...version, resourceId: resource.id}), readSource: () => {if (!available) throw Object.assign(Error('Source permission withdrawn'), {status: 403});return f.scoped().readVersion(project.id, version.id);}, authorize: () => true});f.extras.push(service);
  let ledger = service.command(0, {type: 'batch', commands: [{type: 'projects-set', projects: [f.bindings[0]]}, {type: 'upsert', collection: 'organizations', records: [{...org('source-backed'), provenance: {kind: 'extraction', method: 'SYNTHETIC extracted proposal', sourceVersions: [source]}}]}]}, 'Alice');
  ledger = service.command(ledger.revision, {type: 'verify', collection: 'organizations', id: 'source-backed', statement: 'Checked the exact original financing record.'}, 'Bob');available = false;
  assert.throws(() => service.command(ledger.revision, {type: 'approve', statement: 'Cannot approve after current source permission withdrawal.'}, 'Cara'), error => error.status === 403);assert.deepEqual(service.get(), ledger);
  assert.throws(() => service.command(ledger.revision, {type: 'verify', collection: 'organizations', id: 'source-backed', statement: 'Cannot reverify an inaccessible original.'}, 'Bob'), error => error.status === 403);assert.deepEqual(service.get(), ledger);
  available = true;writeFileSync(join(f.directory, 'objects', 'sha256', version.sha256), 'CHANGED SOURCE BYTES');assert.throws(() => service.command(ledger.revision, {type: 'approve', statement: 'Cannot approve an altered exact original.'}, 'Cara'));assert.deepEqual(service.get(), ledger);
});

test('the full 2000-record profile has bounded write/read time and memory, and rejects the next record atomically', t => {
  const f = fixture(t), projectId = f.projects[0].id, at = performance.now(), beforeMemory = process.memoryUsage().heapUsed, commands = [{type: 'projects-set', projects: [f.bindings[0]]}];
  const data = {
    organizations: Array.from({length: 500}, (_, i) => org(`organization-${i}`)),
    components: Array.from({length: 500}, (_, i) => ({id: `component-${i}`, projectId, name: `SYNTHETIC component ${i}`, kind: 'component'})),
    sites: Array.from({length: 500}, (_, i) => ({id: `site-${i}`, projectId, name: `SYNTHETIC site ${i}`, componentIds: []})),
    activities: Array.from({length: 500}, (_, i) => ({id: `activity-${i}`, projectId, name: `SYNTHETIC activity ${i}`, kind: 'construction', siteIds: []}))
  };
  for (const [collection, rows] of Object.entries(data)) for (let start = 0; start < rows.length; start += 100) commands.push({type: 'upsert', collection, records: rows.slice(start, start + 100)});
  const ledger = f.command({type: 'batch', commands}), writeMs = performance.now() - at, readAt = performance.now(), reopened = f.service().get(), readMs = performance.now() - readAt, heapDeltaBytes = Math.max(0, process.memoryUsage().heapUsed - beforeMemory), bytes = Buffer.byteLength(JSON.stringify(ledger));
  assert.deepEqual(reopened, ledger);assert.equal(Object.values(ledger.entities).reduce((sum, rows) => sum + rows.length, 0), 2000);assert.ok(writeMs < 10000, `${writeMs} ms write`);assert.ok(readMs < 5000, `${readMs} ms read`);assert.ok(heapDeltaBytes < 256 * 1024 * 1024, `${heapDeltaBytes} heap growth`);assert.ok(bytes < 4 * 1024 * 1024);
  assert.throws(() => f.upsert('investments', [{...investment('overflow', '1'), investorOrganizationId: 'organization-0'}]), error => error.status === 413);assert.deepEqual(f.service().get(), ledger);
  if (process.env.ESIA_LIFECYCLE_EVIDENCE_DIR) {mkdirSync(process.env.ESIA_LIFECYCLE_EVIDENCE_DIR, {recursive: true, mode: 0o700});writeFileSync(join(process.env.ESIA_LIFECYCLE_EVIDENCE_DIR, 'performance.json'), JSON.stringify({synthetic: true, records: 2000, bytes, writeMs, readMs, heapDeltaBytes, profileLimits: {writeMs: 10000, readMs: 5000, heapDeltaBytes: 256 * 1024 * 1024, bytes: 4 * 1024 * 1024}, scope: 'One batch write and read at the limited runtime record ceiling; not a sustained or hosted throughput benchmark.', passed: true}, null, 2) + '\n', {mode: 0o600});}
});
