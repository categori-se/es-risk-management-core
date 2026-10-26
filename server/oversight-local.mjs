import {DatabaseSync} from 'node:sqlite';
import {createHash, randomUUID} from 'node:crypto';
import {lstatSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {privateStorageDirectory} from './private-storage-path.mjs';
import {
  emptyOversightBundle, applyOversightCommand, buildOversightPortfolio, createOversightSnapshot
} from '../src/lib/oversight-model.js';
import {oversightBackupLimits, oversightBackupOmissions, boundOversightBackup, validateOversightProjectBackup, validateOversightImportReceipt} from './oversight-backup.mjs';

export const oversightStorageLimits = Object.freeze({bundleBytes: 4 * 1024 * 1024,
  projectHistoryBytes: 128 * 1024 * 1024, projectRevisions: 10000,
  snapshotBytes: 4 * 1024 * 1024, snapshots: 500, portfolioProjects: 1000,
  portfolioInputBytes: 16 * 1024 * 1024, portfolioBytes: 4 * 1024 * 1024});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (status, message) => {throw Object.assign(new Error(message), {status});};
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value) ? value : fail(400, 'An exact oversight record or project identifier is required.');
const custody = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/.test(value) ? value : fail(400, 'An exact local storage custody identity is required.');
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const actorIdentifier = value => typeof value === 'string' && value.trim() && value.length <= 200 && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : fail(400, 'A bounded oversight actor identity is required.');
function fields(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(400, 'The oversight request contains unsupported fields.');
}
function serialized(value, maximum, label) {
  let json;try {json = JSON.stringify(value);} catch {fail(400, `${label} must contain JSON records only.`);}
  if (typeof json !== 'string' || Buffer.byteLength(json) > maximum) fail(413, `${label} exceeds its local storage limit.`);
  return json;
}
function privateDirectory(directory) {
  try {const stat = lstatSync(directory);if (!stat.isDirectory() || stat.isSymbolicLink()) fail(409, 'Oversight storage cannot use directory links.');}
  catch (error) {if (error.code !== 'ENOENT') throw error;mkdirSync(directory, {recursive: true, mode: 0o700});}
}
function privateFile(path) {
  try {const stat = lstatSync(path);if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail(409, 'Oversight storage cannot use shared file links.');}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
}

function projectPortfolio(project, bundle, asOf) {
  const portfolio = buildOversightPortfolio({projects: [{id: project.id, name: project.name, title: project.title, accountId: bundle.accountId}], bundles: [bundle], asOf});
  serialized(portfolio, oversightStorageLimits.portfolioBytes, 'Oversight portfolio');
  return {portfolio, bundleSha256: digest(bundle)};
}

/** Observe one source without initializing a lender's oversight store. SQLite
 * read-only connections can read a live WAL; no schema or logical data writes
 * are performed here. Missing databases remain absent. */
export function readLocalOversightProject({directory, accountId, getProjectSummary, projectId, asOf = new Date().toISOString().slice(0, 10)} = {}) {
  accountId = custody(accountId);projectId = identifier(projectId);
  if (typeof directory !== 'string' || !directory.trim() || typeof getProjectSummary !== 'function') fail(400, 'Read-only oversight needs an account-scoped project summary.');
  const project = getProjectSummary(projectId);
  if (!object(project) || project.id !== projectId) fail(404, 'Project oversight is unavailable in this account.');
  const requested = resolve(directory), root = privateStorageDirectory(requested);
  try {const stat = lstatSync(requested);if (!stat.isDirectory() || stat.isSymbolicLink()) fail(409, 'Oversight storage cannot use directory links.');}
  catch (error) {if (error.code === 'ENOENT') return projectPortfolio(project, emptyOversightBundle({accountId, projectId}), asOf);throw error;}
  for (const name of ['oversight.sqlite', 'oversight.sqlite-wal', 'oversight.sqlite-shm']) privateFile(join(root, name));
  try {lstatSync(join(root, 'oversight.sqlite'));}
  catch (error) {if (error.code === 'ENOENT') return projectPortfolio(project, emptyOversightBundle({accountId, projectId}), asOf);throw error;}
  let db;
  try {
    db = new DatabaseSync(join(root, 'oversight.sqlite'), {readOnly: true});
    if (![1, 2].includes(db.prepare('PRAGMA user_version').get().user_version)) fail(409, 'Unsupported local oversight storage schema.');
    const owner = db.prepare('SELECT account_id FROM oversight_scope WHERE id=1').get();
    if (!owner || owner.account_id !== accountId) fail(409, 'This oversight database belongs to a different storage account.');
    const row = db.prepare('SELECT revision,json,sha256 FROM oversight_heads WHERE project_id=?').get(projectId);
    if (row && (Buffer.byteLength(row.json) > oversightStorageLimits.bundleBytes || digest(row.json) !== row.sha256)) fail(409, 'Oversight records failed their stored integrity check.');
    const bundle = row ? JSON.parse(row.json) : emptyOversightBundle({accountId, projectId});
    if (!object(bundle) || bundle.schemaVersion !== 1 || bundle.accountId !== accountId || bundle.projectId !== projectId || !Number.isSafeInteger(bundle.revision) || bundle.revision < 0 || !Array.isArray(bundle.records) || !object(bundle.profile) || row && bundle.revision !== row.revision) fail(409, 'Oversight records have a different project or account scope.');
    return projectPortfolio(project, bundle, asOf);
  } catch (error) {if (error.status) throw error;fail(409, 'Private oversight records could not be read safely.');}
  finally {db?.close();}
}

/** Persisted, account-bound oversight for the local OS owner. This adapter does
 * not establish hosted roles or confer official institutional approval. All
 * project authority comes from the injected account-scoped project resolver. */
export function createLocalOversightStore({directory, accountId, getProject, getProjectSummary = getProject, listProjects, actor = 'local-owner'} = {}) {
  accountId = custody(accountId);
  actor = actorIdentifier(actor);
  if (typeof directory !== 'string' || !directory.trim() || typeof getProject !== 'function' || typeof getProjectSummary !== 'function' || typeof listProjects !== 'function') fail(400, 'Private oversight storage needs an account-scoped project resolver.');
  const requested = resolve(directory), root = privateStorageDirectory(requested);
  privateDirectory(requested);
  for (const name of ['oversight.sqlite', 'oversight.sqlite-wal', 'oversight.sqlite-shm']) privateFile(join(root, name));
  let db;
  try {db = new DatabaseSync(join(root, 'oversight.sqlite'));}
  catch {fail(500, 'Private oversight storage could not be opened.');}
  let closed = false;
  try {
    const schema = db.prepare('PRAGMA user_version').get().user_version;
    if (![0, 1, 2].includes(schema)) fail(409, 'Unsupported local oversight storage schema.');
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS oversight_scope (id INTEGER PRIMARY KEY CHECK(id=1),account_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS oversight_heads (project_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,json TEXT NOT NULL,sha256 TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS oversight_checkpoints (project_id TEXT NOT NULL,revision INTEGER NOT NULL,json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(project_id,revision));
      CREATE TABLE IF NOT EXISTS oversight_record_versions (project_id TEXT NOT NULL,record_id TEXT NOT NULL,revision INTEGER NOT NULL,project_revision INTEGER NOT NULL,json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(project_id,record_id,revision));
      CREATE TABLE IF NOT EXISTS oversight_snapshots (id TEXT PRIMARY KEY,json TEXT NOT NULL,sha256 TEXT NOT NULL,projects_json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS oversight_import_receipts (id TEXT PRIMARY KEY,project_id TEXT NOT NULL,json TEXT NOT NULL,sha256 TEXT NOT NULL);
      PRAGMA user_version=2;`);
    db.exec('BEGIN IMMEDIATE');
    try {
      const owner = db.prepare('SELECT account_id FROM oversight_scope WHERE id=1').get();
      if (owner && owner.account_id !== accountId) fail(409, 'This oversight database belongs to a different storage account.');
      if (!owner) db.prepare('INSERT INTO oversight_scope(id,account_id) VALUES(1,?)').run(accountId);
      for (const table of ['oversight_checkpoints', 'oversight_record_versions', 'oversight_snapshots', 'oversight_import_receipts']) {
        for (const operation of ['UPDATE', 'DELETE']) db.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_${operation.toLowerCase()}_blocked BEFORE ${operation} ON ${table} BEGIN SELECT RAISE(ABORT,'Oversight history is append-only'); END;`);
      }
      db.exec('COMMIT');
    } catch (error) {db.exec('ROLLBACK');throw error;}
  } catch (error) {db.close();throw error;}
  function transaction(work) {
    if (closed) fail(409, 'The local oversight store is closed.');
    db.exec('BEGIN IMMEDIATE');
    try {const result = work();db.exec('COMMIT');return result;}
    catch (error) {db.exec('ROLLBACK');throw error;}
  }
  function projectScope(value, verifySources = false) {
    const id = identifier(value), project = (verifySources ? getProject : getProjectSummary)(id);
    if (!object(project) || project.id !== id) fail(404, 'Project oversight is unavailable in this account.');
    return project;
  }
  function checkedJSON(row, label) {
    if (digest(row.json) !== row.sha256) fail(409, `${label} failed its stored integrity check.`);
    try {return JSON.parse(row.json);} catch {fail(409, `${label} cannot be read.`);}
  }
  function readBundle(projectId) {
    const row = db.prepare('SELECT revision,json,sha256 FROM oversight_heads WHERE project_id=?').get(projectId);
    const bundle = row ? checkedJSON(row, 'Oversight records') : emptyOversightBundle({accountId, projectId});
    if (!object(bundle) || bundle.accountId !== accountId || bundle.projectId !== projectId || !Number.isSafeInteger(bundle.revision) || bundle.revision < 0 || !Array.isArray(bundle.records) || row && bundle.revision !== row.revision) fail(409, 'Oversight records have a different project or account scope.');
    return bundle;
  }
  function evidence(project, pins) {
    if (!Array.isArray(pins)) fail(400, 'Oversight evidence pins must be an array.');
    for (const pin of pins) {
      if (!object(pin)) fail(400, 'Oversight evidence pins must identify exact source versions.');
      const resource = project.resources?.find(resource => resource.id === pin.resourceId);
      const version = resource?.versions?.find(version => version.id === pin.versionId);
      if (!version || version.sha256 !== pin.sha256) fail(400, 'Oversight evidence must identify an exact document resource, version and SHA256 in this project.');
      if (version.availability === 'unavailable' || version.availability === 'changed' || version.shareStatus === 'unavailable') fail(409, 'The pinned oversight source is unavailable or changed. Reopen the source before saving its evidence.');
    }
  }
  function portfolioInputs(query = {}) {
    fields(query, ['filters', 'asOf']);
    const filters = query.filters ?? {};
    fields(filters, ['institution', 'region', 'sector', 'theme', 'q']);
    if (Object.values(filters).some(value => typeof value !== 'string' || value.length > 500)) fail(400, 'Oversight portfolio filters must be bounded labels.');
    const visible = listProjects();
    if (!Array.isArray(visible) || visible.length > oversightStorageLimits.portfolioProjects) fail(413, 'The oversight portfolio exceeds its bounded project limit.');
    const seen = new Set(), projects = [], bundles = [];let bundleBytes = 0;
    for (const hint of visible) {
      const project = projectScope(hint.id);
      if (seen.has(project.id)) continue;seen.add(project.id);
      // The local wrapper's accountId is a device routing ID. Portfolio custody
      // is this permanently bound canonical account identity, never that label.
      const bundle = readBundle(project.id);
      // Apply the same profile selectors before retaining full bundles, so a
      // narrower selected portfolio can fit without loading excluded records.
      if (['institution', 'region', 'sector'].some(key => filters[key] && filters[key] !== 'all' && bundle.profile[key] !== filters[key]) || filters.theme && !bundle.profile.themes.includes(filters.theme)) continue;
      if (filters.q && ![project.name, project.title, project.id, bundle.profile.country, bundle.profile.region, bundle.profile.sector, ...bundle.profile.themes].some(value => String(value || '').toLowerCase().includes(filters.q.toLowerCase()))) continue;
      bundleBytes += Buffer.byteLength(JSON.stringify(bundle));
      if (bundleBytes > oversightStorageLimits.portfolioInputBytes) fail(413, 'Narrow the oversight portfolio scope before loading this volume of retained records.');
      projects.push({id: project.id, name: project.name, title: project.title, accountId});bundles.push(bundle);
    }
    return {projects, bundles, filters, asOf: query.asOf ?? new Date().toISOString().slice(0, 10)};
  }
  function boundedPortfolio(inputs) {
    const result = buildOversightPortfolio(inputs);
    serialized(result, oversightStorageLimits.portfolioBytes, 'Oversight portfolio');
    return result;
  }
  function backupRows(projectId) {
    // Bound SQL byte totals and counts before fetching full private histories.
    // JSON escaping can enlarge the portable form; bound that form afterwards.
    let bytes = 0;
    for (const table of ['oversight_heads', 'oversight_checkpoints', 'oversight_record_versions', 'oversight_import_receipts']) {
      const stats = db.prepare(`SELECT COUNT(*) AS count,COALESCE(SUM(length(CAST(json AS BLOB))),0) AS bytes FROM ${table} WHERE project_id=?`).get(projectId);
      bytes += stats.bytes;
      if (stats.count > (table === 'oversight_import_receipts' ? oversightBackupLimits.imports : oversightBackupLimits.checkpoints) || bytes > oversightBackupLimits.bytes) fail(413, 'This project oversight history exceeds the 16 MiB portable archive limit. No retained history was removed.');
    }
    const snapshots = db.prepare('SELECT id,length(CAST(json AS BLOB)) AS bytes,projects_json FROM oversight_snapshots ORDER BY rowid').all().filter(row => row.projects_json === JSON.stringify([projectId]));
    bytes += snapshots.reduce((sum, row) => sum + row.bytes, 0);
    if (snapshots.length > oversightBackupLimits.snapshots || bytes > oversightBackupLimits.bytes) fail(413, 'This project oversight history exceeds the 16 MiB portable archive limit. No retained history was removed.');
    return {
      head: (() => {const row = db.prepare('SELECT revision,json,sha256 FROM oversight_heads WHERE project_id=?').get(projectId);return row ? {...row} : null;})(),
      checkpoints: db.prepare('SELECT revision,json,sha256 FROM oversight_checkpoints WHERE project_id=? ORDER BY revision').all(projectId).map(row => ({...row})),
      recordVersions: db.prepare('SELECT record_id AS recordId,revision,project_revision AS projectRevision,json,sha256 FROM oversight_record_versions WHERE project_id=? ORDER BY project_revision,record_id').all(projectId).map(row => ({...row})),
      snapshots: snapshots.map(row => ({...db.prepare('SELECT id,json,sha256 FROM oversight_snapshots WHERE id=?').get(row.id)})),
      importReceipts: db.prepare('SELECT id,json,sha256 FROM oversight_import_receipts WHERE project_id=? ORDER BY rowid').all(projectId).map(row => ({...row}))
    };
  }
  const service = {
    get(projectId) {projectScope(projectId);return readBundle(projectId);},
    mutate(projectId, body, context = {}) {
      fields(body, ['expectedRevision', 'command']);fields(context, ['actorId', 'canApprove', 'approvalAuthority']);
      if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || !object(body.command) || context.canApprove !== undefined && typeof context.canApprove !== 'boolean') fail(400, 'A current oversight revision and command are required.');
      if (context.approvalAuthority !== undefined && context.approvalAuthority !== 'local_practitioner') fail(400, 'Local workflow approval cannot claim institutional authority.');
      const actorId = actorIdentifier(context.actorId ?? actor);
      return transaction(() => {
        const project = projectScope(projectId, true), previous = readBundle(projectId);
        if (body.expectedRevision !== previous.revision) fail(409, 'Project oversight changed. Refresh it before saving; keep the working draft.');
        if (body.command.op === 'upsert') evidence(project, body.command.values?.evidencePins ?? []);
        if (body.command.op === 'approve') evidence(project, previous.records.find(record => record.id === body.command.recordId)?.values?.evidencePins ?? []);
        const bundle = applyOversightCommand(structuredClone(previous), body.command, {actorId, now: new Date().toISOString(), canApprove: context.canApprove ?? true, approvalAuthority: 'local_practitioner'});
        if (bundle.accountId !== accountId || bundle.projectId !== projectId || bundle.revision !== previous.revision + 1 || !Array.isArray(bundle.records)) fail(409, 'The oversight mutation did not preserve its scope and next revision.');
        const json = serialized(bundle, oversightStorageLimits.bundleBytes, 'Project oversight'), sha256 = digest(json);
        const prior = new Map(previous.records.map(record => [record.id, record]));
        if (previous.records.some(record => !bundle.records.some(next => next.id === record.id))) fail(409, 'Oversight revisions cannot discard retained records.');
        const changed = bundle.records.filter(record => !isDeepStrictEqual(prior.get(record.id), record));
        const versions = changed.map(record => {
          const earlier = prior.get(record.id);
          if (earlier ? record.revision !== earlier.revision + 1 || record.type !== earlier.type : record.revision !== 1) fail(409, 'Oversight record versions must advance without changing their type.');
          return {record, json: serialized(record, oversightStorageLimits.bundleBytes, 'Oversight record')};
        });
        const used = db.prepare('SELECT COALESCE(SUM(length(CAST(json AS BLOB))),0) AS bytes,COUNT(*) AS count FROM oversight_checkpoints WHERE project_id=?').get(projectId);
        const recordBytes = db.prepare('SELECT COALESCE(SUM(length(CAST(json AS BLOB))),0) AS bytes FROM oversight_record_versions WHERE project_id=?').get(projectId).bytes;
        if (used.count >= oversightStorageLimits.projectRevisions || used.bytes + recordBytes + Buffer.byteLength(json) + versions.reduce((sum, version) => sum + Buffer.byteLength(version.json), 0) > oversightStorageLimits.projectHistoryBytes) fail(413, 'Retained oversight history reached its local storage limit. No history was removed.');
        db.prepare('INSERT INTO oversight_heads(project_id,revision,json,sha256) VALUES(?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET revision=excluded.revision,json=excluded.json,sha256=excluded.sha256').run(projectId, bundle.revision, json, sha256);
        db.prepare('INSERT INTO oversight_checkpoints(project_id,revision,json,sha256) VALUES(?,?,?,?)').run(projectId, bundle.revision, json, sha256);
        for (const version of versions) db.prepare('INSERT INTO oversight_record_versions(project_id,record_id,revision,project_revision,json,sha256) VALUES(?,?,?,?,?,?)').run(projectId, identifier(version.record.id), version.record.revision, bundle.revision, version.json, digest(version.json));
        return bundle;
      });
    },
    history(projectId, recordId) {
      projectScope(projectId);recordId = identifier(recordId);
      if (!readBundle(projectId).records.some(record => record.id === recordId)) fail(404, 'Oversight record history is unavailable in this project.');
      return {recordId, versions: db.prepare('SELECT json,sha256 FROM oversight_record_versions WHERE project_id=? AND record_id=? ORDER BY revision').all(projectId, recordId).map(row => checkedJSON(row, 'Oversight record history'))};
    },
    portfolio(query = {}) {return boundedPortfolio(portfolioInputs(query));},
    getProjectPortfolio(projectId, query = {}) {
      fields(query, ['asOf']);
      return projectPortfolio(projectScope(projectId), readBundle(projectId), query.asOf ?? new Date().toISOString().slice(0, 10));
    },
    exportProjectBackup(projectId) {
      projectScope(projectId);
      return transaction(() => {
        const payload = {format: 'esia-oversight-project-backup', packageVersion: 1, accountId, projectId, exportedAt: new Date().toISOString(),
          ...backupRows(projectId), omissions: [...oversightBackupOmissions]};
        const archive = {...payload, sha256: digest(payload)};
        validateOversightProjectBackup(archive, {accountId, projectId});return archive;
      });
    },
    restoreProjectBackup(projectId, body) {
      fields(body, ['archive', 'expectedRevision']);
      if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0) fail(400, 'Review the current oversight revision before restoring a backup.');
      boundOversightBackup(body.archive);projectScope(projectId);
      return transaction(() => {
        const current = readBundle(projectId);
        if (current.revision !== body.expectedRevision) fail(409, 'Project oversight changed. Refresh it before restoring the archive.');
        const validated = validateOversightProjectBackup(body.archive, {accountId, projectId, project: projectScope(projectId, true)}), incoming = body.archive, existing = backupRows(projectId);
        const same = ['head', 'checkpoints', 'recordVersions', 'snapshots'].every(key => isDeepStrictEqual(existing[key], incoming[key]));
        const empty = existing.head === null && !existing.checkpoints.length && !existing.recordVersions.length && !existing.snapshots.length;
        if (!empty && !same) fail(409, 'Existing oversight history differs from this archive. Restore into the empty original-custody project or use its identical backup.');
        for (const row of incoming.snapshots) {
          const collision = db.prepare('SELECT json,sha256 FROM oversight_snapshots WHERE id=?').get(row.id);
          if (collision && (collision.json !== row.json || collision.sha256 !== row.sha256)) fail(409, 'A retained snapshot identifier already has different content.');
        }
        for (const row of incoming.importReceipts) {
          const collision = db.prepare('SELECT project_id,json,sha256 FROM oversight_import_receipts WHERE id=?').get(row.id);
          if (collision && (collision.project_id !== projectId || collision.json !== row.json || collision.sha256 !== row.sha256)) fail(409, 'A historical import receipt identifier already has different content.');
        }
        const currentCount = db.prepare('SELECT COUNT(*) AS count FROM oversight_snapshots').get().count;
        if (currentCount + incoming.snapshots.filter(row => !db.prepare('SELECT id FROM oversight_snapshots WHERE id=?').get(row.id)).length > oversightStorageLimits.snapshots) fail(413, 'The account snapshot limit would be exceeded by this backup.');
        if (empty) {
          for (const row of incoming.checkpoints) db.prepare('INSERT INTO oversight_checkpoints(project_id,revision,json,sha256) VALUES(?,?,?,?)').run(projectId, row.revision, row.json, row.sha256);
          for (const row of incoming.recordVersions) db.prepare('INSERT INTO oversight_record_versions(project_id,record_id,revision,project_revision,json,sha256) VALUES(?,?,?,?,?,?)').run(projectId, row.recordId, row.revision, row.projectRevision, row.json, row.sha256);
          if (incoming.head) db.prepare('INSERT INTO oversight_heads(project_id,revision,json,sha256) VALUES(?,?,?,?)').run(projectId, incoming.head.revision, incoming.head.json, incoming.head.sha256);
          for (const row of incoming.snapshots) if (!db.prepare('SELECT id FROM oversight_snapshots WHERE id=?').get(row.id)) db.prepare('INSERT INTO oversight_snapshots(id,json,sha256,projects_json) VALUES(?,?,?,?)').run(row.id, row.json, row.sha256, JSON.stringify([projectId]));
        }
        for (const row of incoming.importReceipts) if (!db.prepare('SELECT id FROM oversight_import_receipts WHERE id=?').get(row.id)) db.prepare('INSERT INTO oversight_import_receipts(id,project_id,json,sha256) VALUES(?,?,?,?)').run(row.id, projectId, row.json, row.sha256);
        let importReceipt;
        for (const row of db.prepare('SELECT json,sha256 FROM oversight_import_receipts WHERE project_id=? ORDER BY rowid').iterate(projectId)) {
          const value = checkedJSON(row, 'Oversight import provenance');if (value.archiveSha256 === incoming.sha256) {importReceipt = value;break;}
        }
        if (!importReceipt) {
          if (db.prepare('SELECT COUNT(*) AS count FROM oversight_import_receipts WHERE project_id=?').get(projectId).count >= oversightBackupLimits.imports) fail(413, 'The project historical import receipt limit has been reached.');
          importReceipt = {id: randomUUID(), accountId, projectId, archiveSha256: incoming.sha256, importedAt: new Date().toISOString(), importedBy: actor,
            assertionStatus: 'historical_assertions_not_independently_verified', summary: validated.summary, verification: validated.verification};
          validateOversightImportReceipt(importReceipt, {accountId, projectId});
          const json = serialized(importReceipt, oversightBackupLimits.bytes, 'Oversight import provenance');
          db.prepare('INSERT INTO oversight_import_receipts(id,project_id,json,sha256) VALUES(?,?,?,?)').run(importReceipt.id, projectId, json, digest(json));
        }
        return {bundle: validated.bundle, restored: empty && !same, summary: validated.summary, verification: validated.verification, importReceipt};
      });
    },
    listProjectImports(projectId) {
      projectScope(projectId);
      return {imports: db.prepare('SELECT json,sha256 FROM oversight_import_receipts WHERE project_id=? ORDER BY rowid DESC').all(projectId).map(row => {
        const receipt = checkedJSON(row, 'Oversight import provenance');return validateOversightImportReceipt(receipt, {accountId, projectId});
      })};
    },
    issueSnapshot(input) {
      fields(input, ['kind', 'title', 'periodStart', 'periodEnd', 'decisions', 'filters', 'asOf', 'expectedRevisions']);
      return transaction(() => {
        const inputs = portfolioInputs({filters: input.filters, asOf: input.asOf}), portfolio = boundedPortfolio(inputs);
        if (!object(input.expectedRevisions) || Object.keys(input.expectedRevisions).length !== portfolio.projects.length ||
            Object.keys(input.expectedRevisions).some(id => !portfolio.projects.some(project => project.projectId === id)) ||
            portfolio.projects.some(project => !Object.hasOwn(input.expectedRevisions, project.projectId) || !Number.isSafeInteger(input.expectedRevisions[project.projectId]) || input.expectedRevisions[project.projectId] < 0)) fail(400, 'Review the current oversight revision of every included portfolio project before issuing a snapshot.');
        for (const project of portfolio.projects) if (input.expectedRevisions[project.projectId] !== project.revision) fail(409, 'Project oversight changed before the snapshot was issued. Refresh the portfolio.');
        if (db.prepare('SELECT COUNT(*) AS count FROM oversight_snapshots').get().count >= oversightStorageLimits.snapshots) fail(413, 'This account reached its retained oversight snapshot limit.');
        const sourceRevisions = inputs.bundles.filter(bundle => portfolio.projects.some(project => project.projectId === bundle.projectId)).map(bundle => ({projectId: bundle.projectId, revision: bundle.revision, sha256: digest(bundle)}));
        const snapshot = {...createOversightSnapshot({portfolio, kind: input.kind, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, decisions: input.decisions,
          actorId: actor, now: new Date().toISOString(), id: randomUUID()}), accountId, provenance: {projects: sourceRevisions}};
        const json = serialized(snapshot, oversightStorageLimits.snapshotBytes, 'Oversight snapshot'), sha256 = digest(json);
        db.prepare('INSERT INTO oversight_snapshots(id,json,sha256,projects_json) VALUES(?,?,?,?)').run(identifier(snapshot.id), json, sha256, JSON.stringify(sourceRevisions.map(value => value.projectId)));
        return {...snapshot, sha256};
      });
    },
    listSnapshots(query = {}) {
      fields(query, ['kind']);
      if (query.kind !== undefined && !['senior_management', 'regional_program', 'integrated_risk'].includes(query.kind)) fail(400, 'Choose a supported oversight snapshot kind.');
      const snapshots = [];
      for (const row of db.prepare('SELECT id FROM oversight_snapshots ORDER BY rowid DESC').iterate()) {
        let snapshot;
        try {snapshot = service.getSnapshot(row.id);}
        catch (error) {if ([403, 404].includes(error.status)) continue;throw error;}
        if (query.kind && snapshot.kind !== query.kind) continue;
        snapshots.push({...Object.fromEntries(['id', 'kind', 'title', 'periodStart', 'periodEnd', 'createdAt', 'createdBy', 'status', 'sha256'].map(key => [key, snapshot[key]])),
          sourceRevisions: snapshot.sourceRevisions.map(project => ({accountId: project.accountId, projectId: project.projectId, revision: project.revision,
            records: project.records.map(record => ({id: record.id, revision: record.revision}))}))});
      }
      return {snapshots};
    },
    getSnapshot(id) {
      const row = db.prepare('SELECT json,sha256,projects_json FROM oversight_snapshots WHERE id=?').get(identifier(id));
      if (!row) fail(404, 'Oversight snapshot is unavailable in this account.');
      const snapshot = checkedJSON(row, 'Oversight snapshot');
      if (snapshot.accountId !== accountId || !Array.isArray(snapshot.provenance?.projects)) fail(409, 'Oversight snapshot custody is invalid.');
      for (const project of snapshot.provenance.projects) projectScope(project.projectId);
      return {...snapshot, sha256: row.sha256};
    },
    close() {if (!closed) {closed = true;db.close();}}
  };
  return service;
}
