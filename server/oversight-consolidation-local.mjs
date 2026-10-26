import {DatabaseSync} from 'node:sqlite';
import {createHash, randomUUID} from 'node:crypto';
import {lstatSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {privateStorageDirectory} from './private-storage-path.mjs';
import {createOversightSnapshot} from '../src/lib/oversight-model.js';
import {normalizeConsolidationQuery, consolidationProjectProjection, consolidationMatches, mergeOversightConsolidation} from '../src/lib/oversight-consolidation.js';

export const oversightConsolidationLimits = Object.freeze({selectedScopes: 100, inputBytes: 16 * 1024 * 1024, outputBytes: 4 * 1024 * 1024, snapshots: 500});
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (status, message) => {throw Object.assign(new Error(message), {status});};
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/.test(value) ? value : fail(400, 'Use an exact consolidation custody or snapshot identifier.');
const hashPattern = /^[a-f0-9]{64}(?![\s\S])/;
const text = (value, max) => typeof value === 'string' && value.trim() && value.length <= max && !/[\x00-\x1f\x7f]/.test(value) ? value : fail(400, 'Consolidation labels must be bounded text.');
const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
const hash = value => digest(stable(value));
function json(value, maximum, label) {
  let result;try {result = JSON.stringify(value);} catch {fail(400, `${label} must contain JSON records only.`);}
  if (typeof result !== 'string' || Buffer.byteLength(result) > maximum) fail(413, `${label} exceeds its bounded local storage limit.`);
  return result;
}
function fields(value, allowed) {if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(400, 'The consolidation request contains unsupported fields.');}
function safeDirectory(path) {
  try {const stat = lstatSync(path);if (!stat.isDirectory() || stat.isSymbolicLink()) fail(409, 'Consolidation storage cannot use directory links.');}
  catch (error) {if (error.code !== 'ENOENT') throw error;mkdirSync(path, {recursive: true, mode: 0o700});}
}
function safeFile(path) {
  try {const stat = lstatSync(path);if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail(409, 'Consolidation storage cannot use linked files.');}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
}

/** Private local-owner packets, separate from every source lender database.
 * resolveScope is a read-only authority boundary, never a name-based lookup. */
export function createLocalOversightConsolidationStore({directory, resolveScope, resolveScopeAccess = resolveScope, actor = 'local-owner'} = {}) {
  if (typeof directory !== 'string' || !directory.trim() || typeof resolveScope !== 'function' || typeof resolveScopeAccess !== 'function') fail(400, 'Consolidation needs private storage and an exact source resolver.');
  actor = text(actor, 192);
  const requested = resolve(directory), root = privateStorageDirectory(requested);safeDirectory(requested);
  for (const name of ['oversight-consolidation.sqlite', 'oversight-consolidation.sqlite-wal', 'oversight-consolidation.sqlite-shm']) safeFile(join(root, name));
  let db;
  try {
    db = new DatabaseSync(join(root, 'oversight-consolidation.sqlite'));
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (![0, 1].includes(version)) fail(409, 'Unsupported local consolidation schema.');
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS consolidation_snapshots(id TEXT PRIMARY KEY,json TEXT NOT NULL,sha256 TEXT NOT NULL);
      CREATE TRIGGER IF NOT EXISTS consolidation_snapshots_update_blocked BEFORE UPDATE ON consolidation_snapshots BEGIN SELECT RAISE(ABORT,'Consolidation history is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS consolidation_snapshots_delete_blocked BEFORE DELETE ON consolidation_snapshots BEGIN SELECT RAISE(ABORT,'Consolidation history is append-only'); END;
      PRAGMA user_version=1;`);
  } catch (error) {db?.close();if (error.status) throw error;fail(500, 'Private consolidation storage could not be opened.');}
  let closed = false;
  const opened = () => {if (closed) fail(409, 'The local consolidation store is closed.');};
  function observe(input) {
    opened();const query = normalizeConsolidationQuery(input), projects = [], scopeObservations = [], limitations = [];let inputBytes = 0;
    const seenAuthority = new Set();
    for (const selected of query.scopes) {
      let resolved;
      try {resolved = resolveScope({...selected}, {asOf: query.asOf});}
      catch (error) {
        if (![403, 404, 409].includes(error.status)) throw error;
        scopeObservations.push({...selected, status: 'unavailable', reason: 'The selected source is unavailable or cannot be verified.'});continue;
      }
      if (!object(resolved) || resolved.accountId !== selected.accountId || resolved.projectId !== selected.projectId || !object(resolved.portfolio) || resolved.portfolio.schemaVersion !== 1 || resolved.portfolio.asOf !== query.asOf || !Array.isArray(resolved.portfolio.projects) || resolved.portfolio.projects.length !== 1 || !hashPattern.test(resolved.bundleSha256 || '')) fail(409, 'A selected source did not preserve its exact account/project scope.');
      const custodyId = uuid(resolved.custodyId), accountName = text(resolved.accountName, 500), canonicalProjectId = resolved.canonicalProjectId == null ? null : uuid(resolved.canonicalProjectId);
      const canonicalProjectName = canonicalProjectId && resolved.canonicalProjectName != null ? text(resolved.canonicalProjectName, 200) : null;
      inputBytes += Buffer.byteLength(json(resolved, oversightConsolidationLimits.inputBytes, 'Selected oversight source'));
      if (inputBytes > oversightConsolidationLimits.inputBytes) fail(413, 'Narrow the consolidation selection before loading this volume of oversight records.');
      const row = consolidationProjectProjection(resolved.portfolio.projects[0]);
      if (row.projectId !== selected.projectId || row.accountId !== custodyId) fail(409, 'A selected source did not preserve its custody and project identity.');
      const scopeKey = JSON.stringify([custodyId, selected.projectId]);
      if (seenAuthority.has(scopeKey)) fail(400, 'Two selected routes identify the same custody/project scope. Select it once.');seenAuthority.add(scopeKey);
      const metadata = {...selected, custodyId, accountName, canonicalProjectId, canonicalProjectName, scopeKey};
      const sha256 = hash({metadata, portfolio: {...resolved.portfolio, projects: [row]}, bundleSha256: resolved.bundleSha256, sourceContext: resolved.sourceContext ?? null});
      const included = consolidationMatches(row, query.filters);
      scopeObservations.push({...metadata, status: included ? 'included' : 'excluded', ...(included ? {} : {reason: 'The selected source does not match the current filters.'}), revision: row.revision, sha256, observedAt: new Date().toISOString()});
      if (included) projects.push({...row, scopeKey, runtimeAccountId: selected.accountId, accountName, canonicalProjectId, canonicalProjectName});
      if (Array.isArray(resolved.portfolio.limitations)) limitations.push(...resolved.portfolio.limitations.filter(value => typeof value === 'string'));
    }
    const previewToken = hash({selection: query.scopes, asOf: query.asOf, filters: query.filters, observations: scopeObservations.map(({observedAt, ...scope}) => scope)});
    const result = {...mergeOversightConsolidation({selection: query.scopes, asOf: query.asOf, filters: query.filters, projects, scopeObservations, limitations}), previewToken};
    json(result, oversightConsolidationLimits.outputBytes, 'Oversight consolidation');return result;
  }
  function readSnapshot(id, accessCache) {
    opened();id = uuid(id);const row = db.prepare('SELECT json,sha256 FROM consolidation_snapshots WHERE id=?').get(id);
    if (!row) fail(404, 'Consolidation packet is unavailable.');
    if (Buffer.byteLength(row.json) > oversightConsolidationLimits.outputBytes || digest(row.json) !== row.sha256) fail(409, 'Consolidation packet failed its retained integrity check.');
    let snapshot;try {snapshot = JSON.parse(row.json);} catch {fail(409, 'Consolidation packet could not be read.');}
    if (snapshot.id !== id || snapshot.originOwnership !== 'practitioner_consolidation' || !Array.isArray(snapshot.scopeProvenance) || !snapshot.scopeProvenance.length) fail(409, 'Consolidation packet source provenance is invalid.');
    for (const scope of snapshot.scopeProvenance) {
      const key = JSON.stringify([scope.accountId, scope.projectId, snapshot.portfolio.asOf]);let current;
      if (accessCache?.has(key)) current = accessCache.get(key);
      else {
        try {
          const resolved = resolveScopeAccess({accountId: scope.accountId, projectId: scope.projectId}, {asOf: snapshot.portfolio.asOf});
          // Retain only authority identifiers in a request-local cache, even
          // when a backwards-compatible resolver also returns source content.
          current = object(resolved) ? {accountId: resolved.accountId, projectId: resolved.projectId, custodyId: resolved.custodyId} : null;
        } catch (error) {if ([403, 404, 409].includes(error.status)) current = null;else throw error;}
        accessCache?.set(key, current);
      }
      if (!current || current.accountId !== scope.accountId || current.projectId !== scope.projectId || current.custodyId !== scope.custodyId) fail(404, 'Consolidation packet is unavailable for its current source scopes.');
    }
    return {...snapshot, sha256: row.sha256};
  }
  const service = {
    preview: observe,
    issueSnapshot(input) {
      fields(input, ['scopes', 'asOf', 'filters', 'expectedPreviewToken', 'kind', 'title', 'periodStart', 'periodEnd', 'decisions']);
      if (!hashPattern.test(input.expectedPreviewToken || '')) fail(400, 'Review the selected scopes before issuing a consolidation packet.');
      const portfolio = observe({scopes: input.scopes, asOf: input.asOf, filters: input.filters});
      if (portfolio.previewToken !== input.expectedPreviewToken) fail(409, 'A selected source or its context changed. Review a fresh preview before issuing the packet.');
      if (portfolio.summary.unavailableScopes) fail(409, 'Resolve every unavailable selected scope before issuing the consolidation packet.');
      if (!portfolio.summary.includedScopes) fail(400, 'Include at least one reviewed scope before issuing a consolidation packet.');
      const snapshot = {...createOversightSnapshot({portfolio, kind: input.kind, title: input.title, periodStart: input.periodStart, periodEnd: input.periodEnd, decisions: input.decisions, actorId: actor, now: new Date().toISOString(), id: randomUUID()}),
        originOwnership: 'practitioner_consolidation', scopeProvenance: structuredClone(portfolio.scopeObservations)};
      const retained = json(snapshot, oversightConsolidationLimits.outputBytes, 'Oversight consolidation snapshot'), sha256 = digest(retained);
      json({...snapshot, sha256}, oversightConsolidationLimits.outputBytes, 'Oversight consolidation snapshot');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('SELECT COUNT(*) AS count FROM consolidation_snapshots').get().count >= oversightConsolidationLimits.snapshots) fail(413, 'The retained consolidation packet limit has been reached.');
        db.prepare('INSERT INTO consolidation_snapshots(id,json,sha256) VALUES(?,?,?)').run(snapshot.id, retained, sha256);db.exec('COMMIT');
      } catch (error) {db.exec('ROLLBACK');throw error;}
      return {...snapshot, sha256};
    },
    getSnapshot(id) {return readSnapshot(id);},
    listSnapshots(query = {}) {
      opened();fields(query, ['kind']);if (query.kind !== undefined && !['senior_management', 'regional_program', 'integrated_risk'].includes(query.kind)) fail(400, 'Choose a supported consolidation packet kind.');
      const snapshots = [], accessCache = new Map();
      for (const row of db.prepare('SELECT id FROM consolidation_snapshots ORDER BY rowid DESC').iterate()) {
        let snapshot;try {snapshot = readSnapshot(row.id, accessCache);} catch (error) {if ([403, 404].includes(error.status)) continue;throw error;}
        if (query.kind && snapshot.kind !== query.kind) continue;
        snapshots.push({...Object.fromEntries(['id', 'kind', 'title', 'periodStart', 'periodEnd', 'createdAt', 'createdBy', 'status', 'sha256', 'originOwnership'].map(key => [key, snapshot[key]])),
          asOf: snapshot.portfolio.asOf, selection: structuredClone(snapshot.portfolio.selection), summary: structuredClone(snapshot.portfolio.summary),
          sourceRevisions: snapshot.sourceRevisions.map(scope => ({accountId: scope.accountId, projectId: scope.projectId, revision: scope.revision}))});
      }
      const result = {snapshots};json(result, oversightConsolidationLimits.outputBytes, 'Consolidation packet headers');return result;
    },
    close() {if (!closed) {closed = true;db.close();}}
  };
  return service;
}
