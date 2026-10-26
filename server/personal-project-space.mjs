import {DatabaseSync} from 'node:sqlite';
import {lstatSync, mkdirSync, mkdtempSync, readdirSync, rmSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {isDeepStrictEqual} from 'node:util';
import {createLocalWorkspaceStore, localWorkspaceMaxJsonBytes} from './local-workspace-store.mjs';
import {validateProjectIdentityDescriptor} from './project-identities.mjs';
import {privateStorageDirectory} from './private-storage-path.mjs';
import {normalizeProjectStakeholders} from './project-stakeholders.mjs';

const originOwnership = 'practitioner_project';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (status, message) => {throw Object.assign(new Error(message), {status});};
const identityId = value => typeof value === 'string' && uuid.test(value) ? value : fail(400, 'Use an exact canonical project identity.');
const clone = value => structuredClone(value);
function fields(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(400, 'The private project record contains unsupported fields.');
}
function text(value, maximum) {
  if (typeof value !== 'string' || value.length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) fail(400, 'Private project text is invalid or too long.');
  return value;
}
function profile(value) {
  fields(value, ['revision', 'summary', 'notes', 'lifecycle', 'stakeholders']);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) fail(400, 'A private project profile revision is required.');
  return {revision: value.revision, summary: text(value.summary, 4000), notes: text(value.notes, 64000),
    ...normalizeProjectStakeholders(Object.fromEntries(['lifecycle', 'stakeholders'].filter(key => value[key] !== undefined).map(key => [key, value[key]])))};
}
function privateDirectory(path, recursive = false) {
  try {const stat = lstatSync(path);if (!stat.isDirectory() || stat.isSymbolicLink()) fail(409, 'Private project storage cannot use directory links.');}
  catch (error) {if (error.code !== 'ENOENT') throw error;mkdirSync(path, {recursive, mode: 0o700});}
}
function privateFile(path) {
  try {const stat = lstatSync(path);if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail(409, 'Private project storage cannot use linked files.');}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
}
function checkVault(path) {
  privateDirectory(path);
  for (const name of ['workspace.sqlite', 'workspace.sqlite-wal', 'workspace.sqlite-shm']) privateFile(join(path, name));
  privateDirectory(join(path, 'objects'));privateDirectory(join(path, 'objects', 'sha256'));
  for (const name of readdirSync(join(path, 'objects', 'sha256'))) privateFile(join(path, 'objects', 'sha256', name));
}
function size(value) {
  let serialized;try {serialized = JSON.stringify(value);} catch {fail(400, 'The personal project package must be JSON.');}
  if (Buffer.byteLength(serialized) > localWorkspaceMaxJsonBytes) fail(413, 'Personal project packages are limited to 48 MiB of JSON.');
}

/** Private working records associated with real-world identities, outside all
 * client account vaults. Public identity metadata never receives these files,
 * profile notes, evidence or drafts. This is a local OS-owner store, not hosted
 * multi-user authorization. */
export function createPersonalProjectSpaces({directory, getIdentity, identities} = {}) {
  if (typeof directory !== 'string' || !directory.trim()) fail(400, 'A private storage directory is required.');
  const lookupIdentity = getIdentity ?? (id => (typeof identities === 'function' ? identities() : identities)?.get(id));
  if (typeof lookupIdentity !== 'function') fail(400, 'A canonical project directory is required.');
  const requested = resolve(directory), root = privateStorageDirectory(requested);
  privateDirectory(requested, true);
  const spaces = join(root, 'project-spaces');privateDirectory(spaces);
  for (const name of ['personal-project-spaces.sqlite', 'personal-project-spaces.sqlite-wal', 'personal-project-spaces.sqlite-shm']) privateFile(join(root, name));
  const db = new DatabaseSync(join(root, 'personal-project-spaces.sqlite')), stores = new Map();
  try {
    const schema = db.prepare('PRAGMA user_version').get().user_version;
    if (![0, 1].includes(schema)) fail(409, 'Unsupported personal project storage schema.');
    db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS personal_projects(identity_id TEXT PRIMARY KEY,project_id TEXT NOT NULL UNIQUE,profile_json TEXT NOT NULL); PRAGMA user_version=1;');
  } catch (error) {db.close();throw error;}
  const transaction = work => {db.exec('BEGIN IMMEDIATE');try {const result = work();db.exec('COMMIT');return result;} catch (error) {db.exec('ROLLBACK');throw error;}};
  function identity(id) {
    id = identityId(id);const found = lookupIdentity(id);
    if (!found) fail(404, 'Real-world project identity was not found.');
    const descriptor = validateProjectIdentityDescriptor(Object.fromEntries(['id', 'name', 'createdAt', 'publicReferences'].filter(key => found[key] !== undefined).map(key => [key, found[key]])));
    if (descriptor.id !== id) fail(409, 'The project directory returned a different identity.');return descriptor;
  }
  const row = id => db.prepare('SELECT project_id,profile_json FROM personal_projects WHERE identity_id=?').get(id);
  function openStore(id) {
    if (!stores.has(id)) {const path = join(spaces, id);checkVault(path);stores.set(id, createLocalWorkspaceStore({directory: path}));}
    return stores.get(id);
  }
  function ensure(id) {
    const descriptor = identity(id), store = openStore(descriptor.id);let saved = row(id);
    if (!saved) {
      const records = store.listProjects();
      if (records.length > 1) fail(409, 'A personal project vault contains more than one working record.');
      const project = records[0] ?? store.createProject({name: descriptor.name, client: 'Practitioner project records', phase: 'Research and project management', period: 'Not specified'});
      transaction(() => db.prepare('INSERT INTO personal_projects(identity_id,project_id,profile_json) VALUES (?,?,?)').run(id, project.id, JSON.stringify({revision: 1, summary: '', notes: ''})));
      saved = row(id);
    }
    return {descriptor, store, saved};
  }
  function projection(id, context = ensure(id)) {
    return {identityId: id, originOwnership, profile: JSON.parse(context.saved.profile_json), project: context.store.getProject(context.saved.project_id)};
  }
  // Validate bytes, immutable report graphs and metadata in an isolated scratch
  // store before either the target vault or its registry is changed.
  function validateImport(value) {
    fields(value, ['format', 'packageVersion', 'originOwnership', 'identity', 'profile', 'recordPackage']);
    if (value.format !== 'esia-personal-project' || value.packageVersion !== 1 || value.originOwnership !== originOwnership) fail(400, 'Unsupported personal project package.');
    size(value);const descriptor = validateProjectIdentityDescriptor(value.identity), incomingProfile = profile(value.profile), current = identity(descriptor.id);
    if (['id', 'name', 'createdAt'].some(key => current[key] !== descriptor[key]) || descriptor.publicReferences.some(reference => !current.publicReferences.some(prior => isDeepStrictEqual(prior, reference)))) fail(409, 'Restore the matching canonical project identity metadata before importing its private records.');
    const temporary = mkdtempSync(join(tmpdir(), 'esia-personal-project-'));let validator, recordPackage;
    try {validator = createLocalWorkspaceStore({directory: temporary});validator.importProject(value.recordPackage);recordPackage = validator.exportProject(value.recordPackage.project.id);}
    finally {validator?.close();rmSync(temporary, {recursive: true, force: true});}
    const claimed = db.prepare('SELECT identity_id FROM personal_projects WHERE project_id=?').get(recordPackage.project.id);
    if (claimed && claimed.identity_id !== descriptor.id) fail(409, 'This private working record already belongs to a different canonical project identity.');
    const saved = row(descriptor.id);
    if (saved && (saved.project_id !== recordPackage.project.id || !isDeepStrictEqual(JSON.parse(saved.profile_json), incomingProfile))) fail(409, 'This personal project already has different private records or profile revisions.');
    if (saved) {
      const existing = openStore(descriptor.id).exportProject(saved.project_id);
      if (!isDeepStrictEqual(existing.project, recordPackage.project)) fail(409, 'This personal project already contains a different working record.');
    }
    return {format: 'esia-personal-project', packageVersion: 1, originOwnership, identity: descriptor, profile: incomingProfile, recordPackage};
  }
  return {
    list() {return db.prepare('SELECT identity_id FROM personal_projects ORDER BY rowid').all().map(item => projection(item.identity_id));},
    get(id) {return projection(identityId(id));},
    getStore(id) {return ensure(identityId(id)).store;},
    mutate(id, expectedRevision, command) {const context = ensure(identityId(id));context.store.mutate(context.saved.project_id, expectedRevision, command);return projection(id, context);},
    readVersion(id, versionId) {const context = ensure(identityId(id));return context.store.readVersion(context.saved.project_id, versionId);},
    updateProfile(id, value) {
      id = identityId(id);fields(value, ['expectedRevision', 'summary', 'notes', 'lifecycle', 'stakeholders']);
      if (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 1) fail(400, 'An expected private profile revision is required.');
      const incoming = Object.fromEntries(['summary', 'notes'].filter(key => value[key] !== undefined).map(key => [key, text(value[key], key === 'summary' ? 4000 : 64000)]));ensure(id);
      transaction(() => {const saved = row(id), previous = JSON.parse(saved.profile_json);
        if (previous.revision !== value.expectedRevision) fail(409, 'The private project profile changed. Refresh before saving.');
        const metadata = normalizeProjectStakeholders(Object.fromEntries(['lifecycle', 'stakeholders'].filter(key => value[key] !== undefined || previous[key] !== undefined).map(key => [key, value[key] !== undefined ? value[key] : previous[key]])));
        const next = {summary: incoming.summary ?? previous.summary, notes: incoming.notes ?? previous.notes, ...metadata};
        if (isDeepStrictEqual({...previous, revision: undefined}, {...next, revision: undefined})) return;
        db.prepare('UPDATE personal_projects SET profile_json=? WHERE identity_id=?').run(JSON.stringify({...next, revision: previous.revision + 1}), id);
      });return projection(id);
    },
    exportProject(id) {
      id = identityId(id);const context = ensure(id), result = {format: 'esia-personal-project', packageVersion: 1, originOwnership,
        identity: context.descriptor, profile: JSON.parse(context.saved.profile_json), recordPackage: context.store.exportProject(context.saved.project_id)};
      size(result);return clone(result);
    },
    validateImport,
    importProject(value) {
      const incoming = validateImport(value), id = incoming.identity.id, store = openStore(id), saved = row(id);
      if (!saved && store.listProjects().length) fail(409, 'This personal project vault already contains an unregistered working record.');
      store.importProject(incoming.recordPackage);
      if (!saved) transaction(() => db.prepare('INSERT INTO personal_projects(identity_id,project_id,profile_json) VALUES (?,?,?)').run(id, incoming.recordPackage.project.id, JSON.stringify(incoming.profile)));
      return projection(id);
    },
    close() {for (const store of stores.values()) store.close();stores.clear();db.close();}
  };
}
