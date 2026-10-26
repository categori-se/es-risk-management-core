import {DatabaseSync} from 'node:sqlite';
import {createHash, randomUUID} from 'node:crypto';
import {mkdirSync, lstatSync, chmodSync} from 'node:fs';
import {join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {stableJson} from '../src/lib/engagement-domain.js';
import {getFramework} from '../src/lib/framework-register.js';
import {lifecycleCollections, lifecycleCommonFields, lifecycleRecordFields, lifecycleLimits,
  lifecycleAssert as check, lifecycleKeys, lifecycleTimestamp, validateLifecycleGraph, validateLifecycleSnapshotShape, lifecyclePortfolio} from '../src/lib/project-lifecycle.js';
import {privateStorageDirectory} from './private-storage-path.mjs';
import {buildLifecycleInstitutionView, selectLifecycleAssessmentProjection} from './project-lifecycle-report.mjs';

const clone = value => structuredClone(value);
const hash = value => createHash('sha256').update(stableJson(value)).digest('hex');
const snapshot = ledger => clone(Object.fromEntries(['context', 'revision', 'projects', 'entities', 'extensions'].map(key => [key, ledger[key]])));
const empty = accountId => ({format: 'esia-project-lifecycle-exchange', schemaVersion: 1, context: {accountId}, revision: 0,
  projects: [], entities: Object.fromEntries(lifecycleCollections.map(key => [key, []])), extensions: {}, history: [], audit: [], approvedSnapshots: []});
const actor = value => check(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$(?![\s\S])/.test(value), 'Use an explicit acting practitioner identifier.');

/** Additive business relationships; existing projects, sources and assessments remain authoritative. */
export function createProjectLifecycleStore({directory, accountId, getProject, getEngagement, getSource, readSource, authorize, clock = () => new Date().toISOString()} = {}) {
  check(typeof accountId === 'string' && /^[a-f0-9-]{36}$/.test(accountId), 'Use the existing account custody ID.');
  check([getProject, getEngagement, getSource, readSource, authorize].every(value => typeof value === 'function'), 'Verified authority and authorization adapters are required.');
  const root = privateStorageDirectory(directory);mkdirSync(root, {recursive: true, mode: 0o700});check(!lstatSync(root).isSymbolicLink(), 'Lifecycle storage cannot use a linked directory.', 409);
  for (const suffix of ['', '-wal', '-shm']) {try {const stat = lstatSync(join(root, 'project-lifecycle.sqlite' + suffix));check(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1, 'Lifecycle storage cannot use linked files.', 409);} catch (error) {if (error.code !== 'ENOENT') throw error;}}
  const db = new DatabaseSync(join(root, 'project-lifecycle.sqlite'));
  try {const floor = db.prepare('PRAGMA user_version').get().user_version;check([0, 1].includes(floor), 'Unsupported lifecycle database version.', 409);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS lifecycle_ledgers(account_id TEXT PRIMARY KEY,json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS lifecycle_verifications(account_id TEXT NOT NULL,record_id TEXT NOT NULL,record_sha256 TEXT NOT NULL,PRIMARY KEY(account_id,record_id)); CREATE TABLE IF NOT EXISTS lifecycle_restore_receipts(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,actor_id TEXT NOT NULL,recorded_at TEXT NOT NULL,exchange_sha256 TEXT NOT NULL); PRAGMA user_version=1;');chmodSync(join(root, 'project-lifecycle.sqlite'), 0o600);} catch (error) {db.close();throw error;}
  const adapters = {getProject, getEngagement, getSource, getFramework};
  const permission = (actorId, action, projects = []) => {actor(actorId);check(authorize({accountId, actorId, action, projectIds: projects.map(value => value.projectId)}) === true, 'The current authority does not permit this lifecycle operation.', 403);};
  function validate(ledger, {current = true} = {}) {
    lifecycleKeys(ledger, ['format', 'schemaVersion', 'context', 'revision', 'projects', 'entities', 'extensions', 'history', 'audit', 'approvedSnapshots'], 'Lifecycle exchange');
    check(ledger.format === 'esia-project-lifecycle-exchange' && ledger.schemaVersion === 1 && ledger.context?.accountId === accountId, 'A lifecycle exchange belongs to its exact existing account.', 409);
    check(Buffer.byteLength(JSON.stringify(ledger)) <= lifecycleLimits.bytes, 'The lifecycle exchange exceeds four MiB.', 413);
    check(Array.isArray(ledger.history) && Array.isArray(ledger.audit) && Array.isArray(ledger.approvedSnapshots) && ledger.history.length === ledger.revision && ledger.audit.length === ledger.revision && ledger.revision <= lifecycleLimits.revisions, 'Lifecycle history must retain every bounded revision.');
    if (current) validateLifecycleGraph(snapshot(ledger), adapters);
    let previous = null;
    for (const [index, entry] of ledger.history.entries()) {
      lifecycleKeys(entry, ['revision', 'sha256', 'snapshot', 'actorId', 'recordedAt'], 'Historical lifecycle revision');
      validateLifecycleSnapshotShape(entry.snapshot);
      check(entry.revision === index && entry.snapshot.revision === index && entry.snapshot.context.accountId === accountId && entry.sha256 === hash(entry.snapshot), 'Historical lifecycle bytes or revision have changed.');actor(entry.actorId);lifecycleTimestamp(entry.recordedAt);
      const event = ledger.audit[index];lifecycleKeys(event, ['id', 'sequence', 'revision', 'command', 'actorId', 'recordedAt', 'previousSha256', 'sha256'], 'Lifecycle audit event');
      const {sha256, ...body} = event;actor(event.id);actor(event.actorId);lifecycleTimestamp(event.recordedAt);check(event.sequence === index + 1 && event.revision === index + 1 && event.previousSha256 === previous && sha256 === hash(body), 'Lifecycle audit hash chain or sequence has changed.');previous = sha256;
      // Each event commits its resulting snapshot hash. The next entry is the
      // exact prior result, or the current snapshot for the final event.
      const result = index + 1 < ledger.history.length ? ledger.history[index + 1].snapshot : snapshot(ledger);
      check(event.command?.resultSha256 === hash(result) && event.actorId === entry.actorId && event.recordedAt === entry.recordedAt, 'A lifecycle audit event does not bind its actual result.');
    }
    const ids = new Set();
    for (const approval of ledger.approvedSnapshots) {
      lifecycleKeys(approval, ['id', 'revision', 'sha256', 'snapshot', 'approvedBy', 'approvedAt', 'statement'], 'Approved business snapshot');actor(approval.id);actor(approval.approvedBy);lifecycleTimestamp(approval.approvedAt);
      validateLifecycleSnapshotShape(approval.snapshot);
      check(!ids.has(approval.id) && approval.revision <= ledger.revision && approval.revision === approval.snapshot.revision && approval.sha256 === hash(approval.snapshot) && typeof approval.statement === 'string' && approval.statement.trim().length >= 8 && approval.statement.length <= 4000, 'Approved business snapshot identity, bytes or attestation is invalid.');ids.add(approval.id);
      const source = approval.revision === ledger.revision ? snapshot(ledger) : ledger.history[approval.revision]?.snapshot;
      check(source && isDeepStrictEqual(approval.snapshot, source), 'Approved business context must retain its exact historical snapshot.');
    }
    return ledger;
  }
  function read(actorId, action = 'read') {const row = db.prepare('SELECT json FROM lifecycle_ledgers WHERE account_id=?').get(accountId), ledger = row ? JSON.parse(row.json) : empty(accountId);permission(actorId, action, ledger.projects);return validate(ledger);}
  function transaction(work) {db.exec('BEGIN IMMEDIATE');try {const result = work();db.exec('COMMIT');return result;} catch (error) {db.exec('ROLLBACK');throw error;}}
  function sourceProofs(graph) {
    const seen = new Map();for (const name of lifecycleCollections) for (const record of graph.entities[name]) for (const value of [...record.provenance.sourceVersions, ...(record.sourceVersions || []), ...[record.source, record.geometrySource].filter(Boolean)]) seen.set(`${value.projectId}\0${value.versionId}`, value);
    for (const value of seen.values()) {const result = readSource(value);check(result?.version?.id === value.versionId && result.version.sha256 === value.sha256 && createHash('sha256').update(result.bytes).digest('hex') === value.sha256, 'A cited original is unavailable or changed; verify the exact source before approval.', 409);}
  }
  function normalizeRecord(name, input, old, actorId, at) {
    const allowed = [...Object.keys(lifecycleRecordFields[name] || {}).map(key => key.replace(/\?$/, '')), 'id', 'effectiveFrom', 'effectiveTo', 'eventAt', 'provenance', 'externalReferences', 'extensions'];
    lifecycleKeys(input, allowed, 'Lifecycle proposal');
    const data = clone(input), supplied = data.provenance;
    if (supplied !== undefined) {lifecycleKeys(supplied, ['kind', 'method', 'model', 'promptSha256', 'sourceVersions'], 'Proposed provenance');check(!['actorId', 'at', 'reviewStatus', 'reviewedBy', 'reviewedAt'].some(key => Object.hasOwn(supplied, key)), 'A proposal cannot invent verification.');}
    return {...data, id: old?.id || input.id || randomUUID(), revision: (old?.revision || 0) + 1,
      createdAt: old?.createdAt || at, createdBy: old?.createdBy || actorId, updatedAt: at, updatedBy: actorId, recordedAt: at,
      provenance: {kind: supplied?.kind || 'human', actorId, at, ...(supplied?.method ? {method: supplied.method} : {}), ...(supplied?.model ? {model: supplied.model} : {}), ...(supplied?.promptSha256 ? {promptSha256: supplied.promptSha256} : {}), sourceVersions: supplied?.sourceVersions || [], reviewStatus: 'unreviewed'}, externalReferences: data.externalReferences || [], extensions: data.extensions || {}};
  }
  function apply(next, command, actorId, at) {
    check(command && typeof command.type === 'string', 'Choose a lifecycle command.');
    if (command.type === 'projects-set') {lifecycleKeys(command, ['type', 'projects'], 'Project selection');next.projects = clone(command.projects);return;}
    if (command.type === 'upsert') {
      lifecycleKeys(command, ['type', 'collection', 'records'], 'Lifecycle proposal');check(lifecycleCollections.includes(command.collection) && Array.isArray(command.records) && command.records.length > 0 && command.records.length <= 100, 'Save 1–100 records in one known collection.');
      const rows = next.entities[command.collection], seen = new Set();
      for (const input of command.records) {check(input !== null && typeof input === 'object' && !Array.isArray(input), 'A lifecycle proposal must be an object.');check(!input.id || !seen.has(input.id), 'A batch cannot update the same record twice.');seen.add(input.id);const index = input.id ? rows.findIndex(row => row.id === input.id) : -1;const normalized = normalizeRecord(command.collection, input, index < 0 ? null : rows[index], actorId, at);if (index < 0) rows.push(normalized);else rows[index] = normalized;}return;
    }
    if (command.type === 'verify') {
      lifecycleKeys(command, ['type', 'collection', 'id', 'statement'], 'Explicit verification');check(lifecycleCollections.includes(command.collection), 'Choose a known collection.');check(typeof command.statement === 'string' && command.statement.trim().length >= 8 && command.statement.length <= 4000, 'Record what you checked before verifying this information.');permission(actorId, 'review', next.projects);
      const record = next.entities[command.collection].find(row => row.id === command.id);check(record, 'The selected business record was not found.', 404);
      sourceProofs({entities: Object.fromEntries(lifecycleCollections.map(name => [name, name === command.collection ? [record] : []]))});
      record.revision++;record.updatedAt = at;record.updatedBy = actorId;record.provenance = {...record.provenance, reviewStatus: 'verified', reviewedBy: actorId, reviewedAt: at};
      db.prepare('INSERT INTO lifecycle_verifications(account_id,record_id,record_sha256) VALUES(?,?,?) ON CONFLICT(account_id,record_id) DO UPDATE SET record_sha256=excluded.record_sha256').run(accountId, record.id, hash(record));return;
    }
    check(false, 'This lifecycle command is unavailable.');
  }
  function commit(old, next, actorId, command, at) {
    check(old.revision < lifecycleLimits.revisions, 'This ledger reached its bounded revision limit; export it before a planned archival transition.', 413);
    next.revision = old.revision + 1;const resultSha256 = hash(snapshot(next));
    next.history.push({revision: old.revision, sha256: hash(snapshot(old)), snapshot: snapshot(old), actorId, recordedAt: at});
    const body = {id: randomUUID(), sequence: next.revision, revision: next.revision, command: {...command, resultSha256}, actorId, recordedAt: at, previousSha256: old.audit.at(-1)?.sha256 || null};next.audit.push({...body, sha256: hash(body)});
    validate(next);db.prepare('INSERT INTO lifecycle_ledgers(account_id,json) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET json=excluded.json').run(accountId, JSON.stringify(next));return clone(next);
  }
  const service = {
    get(actorId = 'local-owner') {permission(actorId, 'read');return clone(read(actorId));},
    command(expectedRevision, command, actorId) {
      actor(actorId);permission(actorId, 'write');
      return transaction(() => {
        const old = read(actorId, 'write');check(Number.isSafeInteger(expectedRevision) && expectedRevision === old.revision, 'The business context changed. Refresh before saving.', 409);const next = clone(old), at = clock();lifecycleTimestamp(at);
        if (command?.type === 'approve') {
          lifecycleKeys(command, ['type', 'statement'], 'Business context approval');permission(actorId, 'approve', next.projects);check(next.projects.length > 0 && typeof command.statement === 'string' && command.statement.trim().length >= 8 && command.statement.length <= 4000, 'Select project context and attest to the business information being approved.');
          check(lifecycleCollections.every(name => next.entities[name].every(row => row.provenance.reviewStatus === 'verified' && db.prepare('SELECT record_sha256 FROM lifecycle_verifications WHERE account_id=? AND record_id=?').get(accountId, row.id)?.record_sha256 === hash(row))), 'Explicitly verify every business proposal in this installation before approving its snapshot; imported verification claims are retained history only.', 409);sourceProofs(next);
          const saved = snapshot(old);next.approvedSnapshots.push({id: randomUUID(), revision: old.revision, sha256: hash(saved), snapshot: saved, approvedBy: actorId, approvedAt: at, statement: command.statement});
        } else if (command?.type === 'batch') {
          lifecycleKeys(command, ['type', 'commands'], 'Lifecycle batch');check(Array.isArray(command.commands) && command.commands.length > 0 && command.commands.length <= 30 && command.commands.every(row => ['projects-set', 'upsert'].includes(row?.type)), 'Batch only bounded project selections and proposals.');const touched = new Set();for (const row of command.commands) {for (const value of row.records || []) if (value?.id) {check(!touched.has(value.id), 'Update each record at most once in one atomic batch.');touched.add(value.id);}apply(next, row, actorId, at);}
        } else apply(next, command, actorId, at);
        permission(actorId, 'write', next.projects);
        return commit(old, next, actorId, {type: command.type, ...(command.collection ? {collection: command.collection} : {}), ...(command.id ? {recordId: command.id} : {}), ...(command.statement ? {statement: command.statement} : {})}, at);
      });
    },
    import(expectedRevision, incoming, actorId) {
      permission(actorId, 'import');
      return transaction(() => {const old = read(actorId, 'write');check(Number.isSafeInteger(expectedRevision) && expectedRevision === old.revision, 'The business context changed. Refresh before importing.', 409);permission(actorId, 'write', incoming.projects || []);validate(incoming);
        // Restore only into an empty same-account ledger, or accept exact replay.
        // Another history is never silently rebased, merged or auto-verified.
        if (isDeepStrictEqual(old, incoming)) return clone(old);
        check(old.revision === 0 && old.projects.length === 0, 'The imported ledger conflicts with retained business history; review an explicit migration instead.', 409);permission(actorId, 'write', incoming.projects);sourceProofs(incoming);
        db.prepare('INSERT INTO lifecycle_ledgers(account_id,json) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET json=excluded.json').run(accountId, JSON.stringify(incoming));
        db.prepare('INSERT INTO lifecycle_restore_receipts(id,account_id,actor_id,recorded_at,exchange_sha256) VALUES(?,?,?,?,?)').run(randomUUID(), accountId, actorId, clock(), hash(incoming));return clone(incoming);
      });
    },
    report({actorId = 'local-owner', investmentId, snapshotId, view = 'canonical', asOf = clock().slice(0, 10)} = {}) {
      check(['canonical', 'ifc', 'world_bank', 'adb', 'ebrd', 'eib', 'fmo'].includes(view), 'Choose a supported institution view.');const ledger = service.get(actorId), approved = snapshotId ? ledger.approvedSnapshots.find(row => row.id === snapshotId) : null;check(!snapshotId || approved, 'The approved business snapshot was not found.', 404);
      const current = approved?.snapshot || snapshot(ledger);permission(actorId, 'read', current.projects);validateLifecycleGraph(current, adapters);
      const portfolio = lifecyclePortfolio(current, investmentId, {asOf});
      const projects = current.projects.map(row => getProject(row.projectId));
      const ids = new Set([...current.entities.engagementScopes.map(row => row.engagementId), ...current.entities.lifecycleEvents.map(row => row.engagementId), ...current.entities.requirementApplicabilities.map(row => row.requirementRef.engagementId), ...current.entities.covenants.flatMap(row => [...row.requirementRefs, ...row.monitoringObligationRefs].map(ref => ref.engagementId))].filter(Boolean));
      check(ids.size <= 30, 'This bounded report supports up to 30 linked engagements; use a reviewed portfolio reporting adapter for larger datasets.', 413);
      const assessmentContexts = [], engagements = [];
      for (const id of [...ids].sort()) {
        const authority = getEngagement(id), requested = current.entities.lifecycleEvents.filter(row => row.engagementId === id && row.baselineId && row.status === 'completed').sort((a, b) => (b.eventAt || b.recordedAt).localeCompare(a.eventAt || a.recordedAt) || b.id.localeCompare(a.id))[0];
        const selected = selectLifecycleAssessmentProjection(authority, requested ? {baselineId: requested.baselineId, baselineSha256: requested.baselineSha256} : {});
        engagements.push(selected.projection);assessmentContexts.push({...selected.context, projectionSha256: hash(selected.projection)});
      }
      const datasetSha256 = hash({businessSnapshotSha256: hash(current), asOf, projectContexts: projects.map(row => ({id: row.id, revision: row.revision, identityId: row.projectContext.identity.id})), assessmentContexts});
      const institutionView = buildLifecycleInstitutionView({graph: current, projects, engagements, view, asOf, datasetSha256});
      return {format: 'esia-project-lifecycle-report', schemaVersion: 1, view, revision: current.revision, accountId, snapshotSha256: hash(current), approval: approved ? {id: approved.id, approvedBy: approved.approvedBy, approvedAt: approved.approvedAt} : null,
        asOf, temporalScope: {allocationEffectiveDate: asOf, assessmentSelection: 'explicit_retained_baseline_or_current_review', historicalKnowledgeReconstruction: false}, datasetSha256, assessmentContexts, institutionView, projects: current.projects, portfolio, lifecycle: current.entities.lifecycleEvents, applicability: current.entities.requirementApplicabilities,
        sourceVersionReferences: [...new Map(lifecycleCollections.flatMap(name => current.entities[name].flatMap(row => [...row.provenance.sourceVersions, ...(row.sourceVersions || []), ...[row.source, row.geometrySource].filter(Boolean)])).map(row => [`${row.projectId}:${row.versionId}`, row])).values()],
        notices: ['Institution views reuse the same business snapshot; they are not a completed native institutional template.', 'An applicability decision or business approval is not an institutional compliance conclusion.', 'Assessment findings, restricted incidents, evidence and approved reports retain their existing authority.']};
    },
    restoreReceipts(actorId = 'local-owner') {permission(actorId, 'read');return db.prepare('SELECT id,actor_id AS actorId,recorded_at AS recordedAt,exchange_sha256 AS exchangeSha256 FROM lifecycle_restore_receipts WHERE account_id=? ORDER BY recorded_at,id').all(accountId);},
    close() {db.close();}
  };
  return service;
}
