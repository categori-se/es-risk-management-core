import {DatabaseSync} from 'node:sqlite';
import {createHash, randomUUID} from 'node:crypto';
import {lstatSync, readFileSync, mkdirSync} from 'node:fs';
import {join, isAbsolute} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {createResourceReference} from '@categori/workspace-contracts';
import {privateStorageDirectory} from './private-storage-path.mjs';

export const projectFileShareAuthority = 'urn:esia:local-share';
export const isSharedFileVersion = version => version?.externalReference?.authority === projectFileShareAuthority;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/;
const hashPattern = /^[a-f0-9]{64}(?![\s\S])/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (status, message) => {throw Object.assign(new Error(message), {status});};
const uuid = value => typeof value === 'string' && uuidPattern.test(value) ? value : fail(400, 'Use an exact project or account custody identity.');
const id = value => typeof value === 'string' && idPattern.test(value) ? value : fail(400, 'Use an exact project, source version or share identifier.');
function fields(value, allowed) {if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(400, 'The file sharing request contains unsupported fields.');}
function owner(value) {
  if (value?.type === 'practitioner_project') {fields(value, ['type', 'identityId']);return {type: value.type, identityId: uuid(value.identityId)};}
  if (value?.type === 'account') {fields(value, ['type', 'accountId', 'projectId']);return {type: value.type, accountId: uuid(value.accountId), projectId: id(value.projectId)};}
  fail(400, 'Choose an explicit file-owning project context.');
}
function target(value) {fields(value, ['accountId', 'projectId']);return {accountId: uuid(value.accountId), projectId: id(value.projectId)};}
function locate(project, versionId) {
  for (const resource of project.resources) {const version = resource.versions.find(version => version.id === versionId);if (version) return {resource, version};}
  fail(404, 'The source version was not found in its owning project.');
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** Explicit local reference grants. The marker in each destination version is
 * deliberately permanent: an absent registry/binding is denied after restore,
 * and a failed registration cannot leave an unguarded readable reference.
 * Revocation stops future service reads; it cannot recall bytes already read. */
export function createProjectFileSharing({directory, resolveOwner, resolveTarget}) {
  if (typeof resolveOwner !== 'function' || typeof resolveTarget !== 'function') fail(400, 'File sharing requires server-owned context resolvers.');
  if (typeof directory !== 'string' || !directory.trim()) fail(400, 'A private file sharing directory is required.');
  try {if (lstatSync(directory).isSymbolicLink()) fail(409, 'File sharing storage cannot use directory links.');} catch (error) {if (error.code !== 'ENOENT') throw error;}
  const root = privateStorageDirectory(directory);mkdirSync(root, {recursive: true, mode: 0o700});
  if (lstatSync(root).isSymbolicLink()) fail(409, 'File sharing storage cannot use directory links.');
  for (const name of ['project-file-sharing.sqlite', 'project-file-sharing.sqlite-wal', 'project-file-sharing.sqlite-shm']) {
    try {const stat = lstatSync(join(root, name));if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail(409, 'File sharing storage cannot use linked files.');}
    catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  const db = new DatabaseSync(join(root, 'project-file-sharing.sqlite'));
  try {
    const schema = db.prepare('PRAGMA user_version').get().user_version;if (![0, 1].includes(schema)) fail(409, 'Unsupported file sharing registry schema.');
    db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS file_shares(id TEXT PRIMARY KEY,json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS shared_versions(account_id TEXT NOT NULL,project_id TEXT NOT NULL,version_id TEXT NOT NULL,share_id TEXT NOT NULL REFERENCES file_shares(id),PRIMARY KEY(account_id,project_id,version_id),UNIQUE(share_id,account_id,project_id)); PRAGMA user_version=1;');
  } catch (error) {db.close();throw error;}
  const transaction = work => {db.exec('BEGIN IMMEDIATE');try {const result = work();db.exec('COMMIT');return result;} catch (error) {db.exec('ROLLBACK');throw error;}};
  const read = shareId => {const row = db.prepare('SELECT json FROM file_shares WHERE id=?').get(uuid(shareId));if (!row) fail(404, 'File share was not found.');return JSON.parse(row.json);};
  const write = share => db.prepare('INSERT INTO file_shares(id,json) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(share.id, JSON.stringify(share));
  function source(context, versionId, pin) {
    const resolved = resolveOwner(context), {resource, version} = locate(resolved.project, versionId);
    if (version.mode !== 'managed' || isSharedFileVersion(version)) fail(409, 'Share an original managed file from its owning project. Referenced files cannot be shared onward.');
    if (!hashPattern.test(version.sha256) || pin && (version.sha256 !== pin.sha256 || version.size !== pin.size || resolved.project.id !== pin.sourceProjectId || resolved.project.workspaceId !== pin.sourceWorkspaceId)) fail(409, 'The source file no longer matches the exact shared version.');
    const original = resolved.readVersion(versionId), bytes = original.bytes;
    if (!(bytes instanceof Uint8Array) || original.version?.id !== versionId || digest(bytes) !== version.sha256 || bytes.length !== version.size) fail(409, 'The source file failed its pinned integrity check.');
    const path = resolved.managedPath(versionId);
    if (typeof path !== 'string' || !isAbsolute(path)) fail(409, 'The owning file location is unavailable.');
    try {const stat = lstatSync(path);if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== version.size || digest(readFileSync(path)) !== version.sha256) fail(409, 'The owning file location failed its pinned integrity check.');}
    catch (error) {if (error.status) throw error;fail(409, 'The owning file location is unavailable.');}
    return {resolved, resource, version, path};
  }
  function active(share) {if (share.status !== 'active') fail(403, 'This file reference is no longer authorized.');}
  function targetMatches(share, selected) {if (!isDeepStrictEqual(share.target, selected)) fail(404, 'File share was not found for this destination project.');}
  const service = {
    createShare(value) {
      fields(value, ['owner', 'versionId', 'target', 'purpose']);const sourceOwner = owner(value.owner), destination = target(value.target), versionId = id(value.versionId);
      if (typeof value.purpose !== 'string' || !value.purpose.trim() || value.purpose.length > 2000 || /[\x00-\x1f\x7f]/.test(value.purpose)) fail(400, 'Record a sharing purpose of at most 2000 characters.');
      resolveTarget(destination).getProject();
      if (sourceOwner.type === 'account' && sourceOwner.accountId === destination.accountId && sourceOwner.projectId === destination.projectId) fail(400, 'The owning project already has this file.');
      const original = source(sourceOwner, versionId), {version, resource, resolved} = original;
      const share = {id: randomUUID(), owner: sourceOwner, sourceProjectId: resolved.project.id, sourceWorkspaceId: resolved.project.workspaceId,
        sourceVersionId: version.id, sha256: version.sha256, size: version.size, filename: version.filename, mediaType: version.mediaType,
        title: version.effectiveMetadata?.title || version.intakeMetadata?.title || resource.title, sourceReference: version.reference,
        ...(version.effectiveMetadata || version.intakeMetadata ? {metadata: structuredClone(version.effectiveMetadata || version.intakeMetadata)} : {}),
        target: destination, purpose: value.purpose.trim(), mode: 'reference', status: 'active', revision: 1, createdAt: new Date().toISOString()};
      transaction(() => write(share));return share;
    },
    getShare(shareId) {return read(shareId);},
    listShares(query = {}) {
      fields(query, ['owner', 'target']);const ownerFilter = query.owner === undefined ? null : owner(query.owner), targetFilter = query.target === undefined ? null : target(query.target);
      return db.prepare('SELECT json FROM file_shares ORDER BY rowid').all().map(row => JSON.parse(row.json)).filter(share => (!ownerFilter || isDeepStrictEqual(share.owner, ownerFilter)) && (!targetFilter || isDeepStrictEqual(share.target, targetFilter)));
    },
    registerShare(shareId, value) {
      fields(value, ['targetAccountId', 'targetProjectId', 'expectedRevision']);const selected = target({accountId: value.targetAccountId, projectId: value.targetProjectId});
      if (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 1) fail(400, 'An expected destination project revision is required.');
      return transaction(() => {
        const share = read(shareId);active(share);targetMatches(share, selected);const original = source(share.owner, share.sourceVersionId, share), destination = resolveTarget(selected);
        let project = destination.getProject();
        const binding = db.prepare('SELECT version_id FROM shared_versions WHERE share_id=? AND account_id=? AND project_id=?').get(share.id, selected.accountId, selected.projectId);
        if (binding) {
          const found = locate(project, binding.version_id).version;service.authorizeVersion({...selected, version: found});
          if (found.availability !== 'available') {
            if (project.revision !== value.expectedRevision) fail(409, 'The destination project changed. Refresh before restoring its shared reference.');
            project = destination.mutate(project.revision, {type: 'relink', versionId: found.id, path: original.path});
          }
          return {share, project, versionId: found.id};
        }
        if (project.revision !== value.expectedRevision) fail(409, 'The destination project changed. Refresh before registering the shared file.');
        // Recover a committed reference left by an interrupted prior attempt.
        // It was unreadable while its required binding was absent.
        const existing = project.resources.flatMap(resource => resource.versions).filter(version => isSharedFileVersion(version) && version.externalReference.resource_id === share.id);
        if (existing.length > 1) fail(409, 'This destination contains ambiguous references for the same share.');
        let version = existing[0];
        if (!version) {
          const marker = createResourceReference({authority: projectFileShareAuthority, workspaceId: share.sourceWorkspaceId, resourceType: 'document', resourceId: share.id, versionId: share.sourceVersionId});
          project = destination.mutate(project.revision, {type: 'intake', mode: 'registered', path: original.path, filename: share.filename, title: share.title,
            mediaType: share.mediaType, externalReference: marker, ...(share.metadata ? {intakeMetadata: share.metadata} : {})});
          version = project.resources.flatMap(resource => resource.versions).find(version => isSharedFileVersion(version) && version.externalReference.resource_id === share.id);
        }
        if (!version || version.mode !== 'registered' || version.sha256 !== share.sha256 || version.externalReference.version_id !== share.sourceVersionId || version.externalReference.workspace_id !== share.sourceWorkspaceId) fail(409, 'The destination reference does not match the pinned grant.');
        if (version.availability !== 'available') project = destination.mutate(project.revision, {type: 'relink', versionId: version.id, path: original.path});
        db.prepare('INSERT INTO shared_versions(account_id,project_id,version_id,share_id) VALUES (?,?,?,?)').run(selected.accountId, selected.projectId, version.id, share.id);
        return {share, project, versionId: version.id};
      });
    },
    revokeShare(shareId, value) {
      fields(value, ['owner', 'expectedRevision']);const selected = owner(value.owner);
      if (!Number.isSafeInteger(value.expectedRevision) || value.expectedRevision < 1) fail(400, 'An expected share revision is required.');
      return transaction(() => {const share = read(shareId);if (!isDeepStrictEqual(share.owner, selected)) fail(404, 'File share was not found in the owning project.');
        if (share.revision !== value.expectedRevision) fail(409, 'This file share changed. Refresh before revoking it.');
        if (share.status === 'revoked') return share;
        const changed = {...share, status: 'revoked', revision: share.revision + 1, revokedAt: new Date().toISOString()};write(changed);return changed;
      });
    },
    authorizeVersion(value) {
      fields(value, ['accountId', 'projectId', 'version']);const selected = target({accountId: value.accountId, projectId: value.projectId}), version = value.version;
      if (!isSharedFileVersion(version)) return;
      const reference = version.externalReference;
      let share;try {share = read(reference.resource_id);} catch {fail(403, 'This file reference is not authorized in the current sharing registry.');}
      active(share);targetMatches(share, selected);
      const binding = db.prepare('SELECT share_id FROM shared_versions WHERE account_id=? AND project_id=? AND version_id=?').get(selected.accountId, selected.projectId, id(version.id));
      if (!binding || binding.share_id !== share.id || version.mode !== 'registered' || version.sha256 !== share.sha256 || version.size !== share.size || reference.version_id !== share.sourceVersionId || reference.workspace_id !== share.sourceWorkspaceId) fail(403, 'This destination reference does not match its exact file grant.');
      source(share.owner, share.sourceVersionId, share);
    },
    close() {db.close();}
  };
  return service;
}
