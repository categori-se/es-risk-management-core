import {assertConfiguredResourceAuthority} from '../src/lib/hosted-field-capture-model.js';
// A short-lived metadata observation, never a transferable access grant.
// Original bytes, provider locations and connection bindings stay with ESIA.
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {assertResourceReference, resourceReferenceKey} from '@categori/workspace-contracts';

const sha256 = /^[a-f0-9]{64}(?![\s\S])/;
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' :
  value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function createIntegrationResourceIndex({resourceAuthority, authenticate, artifactAccess, commit, instant, fail, authorizeConnection} = {}) {
  const authority = assertConfiguredResourceAuthority(resourceAuthority);
  if ([authenticate, artifactAccess, commit, instant, fail].some(value => typeof value !== 'function')) throw new TypeError('Native resource-index authority hooks are required.');
  function dataObject(value, required, optional = []) {
    if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(400, 'Use exact portable resource-index data.');
    const keys = Reflect.ownKeys(value), allowed = new Set([...required, ...optional]), copy = Object.create(null);
    if (required.some(key => !Object.hasOwn(value, key))) fail(400, 'Use the exact resource-index request fields.');
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !allowed.has(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(400, 'Use only the supported resource-index data fields.');
      copy[key] = descriptor.value;
    }
    return copy;
  }
  function request(raw) {
    const body = dataObject(raw, ['schemaVersion', 'resources'], ['ifIndexSha256']);
    if (body.schemaVersion !== 1 || Object.hasOwn(body, 'ifIndexSha256') && (typeof body.ifIndexSha256 !== 'string' || !sha256.test(body.ifIndexSha256))) fail(400, 'Use schemaVersion 1 and an exact optional index digest.');
    const values = body.resources;
    if (!Array.isArray(values) || types.isProxy(values) || values.length < 1 || values.length > 8 ||
        Reflect.ownKeys(values).length !== values.length + 1) fail(400, 'Select one to eight distinct document references.');
    const resources = [];
    for (let index = 0; index < values.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(values, String(index));
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail(400, 'Use a dense array of document references.');
      const value = dataObject(descriptor.value, ['schema_version', 'authority', 'resource_id', 'resource_type', 'workspace_id'], ['version_id']);
      let reference;
      try {reference = assertResourceReference(value);} catch {fail(400, 'Use the shared exact resource-reference contract.');}
      if (reference.authority !== authority) fail(403, 'This index observes only its owning ESIA authority.');
      if (reference.resource_type !== 'document_original') fail(400, 'This index supports document_original references only.');
      resources.push(reference);
    }
    if (new Set(resources.map(reference => reference.workspace_id)).size !== 1) fail(400, 'Select references from one exact workspace.');
    if (new Set(resources.map(reference => resourceReferenceKey(reference, {includeVersion:false}))).size !== resources.length) fail(400, 'Select distinct document resources.');
    return {resources, ifIndexSha256:body.ifIndexSha256};
  }
  function entry(scoped, requested) {
    const row = scoped?.target, document = row?.value, original = document?.original;
    // artifactAccess has already checked current view, case protection and
    // field-media release. These checks bind the retained metadata identity.
    if (document?.artifact_id !== requested.resource_id || document.workspace_id !== requested.workspace_id ||
        document.resource?.resource_type !== 'document' || document.resource.resource_id !== requested.resource_id ||
        document.resource.workspace_id !== requested.workspace_id) fail(403, 'The document does not match the exact requested scope.');
    let reference;
    try {reference = assertResourceReference(original?.reference, {immutable:true});} catch {fail(409, 'The retained original reference is unavailable.');}
    if (reference.authority !== authority || reference.resource_type !== 'document_original' ||
        reference.resource_id !== requested.resource_id || reference.workspace_id !== requested.workspace_id ||
        reference.version_id !== reference.version_id.trim() || reference.version_id === 'null') fail(409, 'The retained original identity is inconsistent.');
    if (requested.version_id !== undefined && requested.version_id !== reference.version_id) fail(409, 'The requested retained original version is no longer current.');
    if (!Number.isSafeInteger(row.revision) || row.revision < 1 || typeof original.sha256 !== 'string' || !sha256.test(original.sha256) ||
        !Number.isSafeInteger(original.size_bytes) || original.size_bytes < 1 || original.size_bytes > 25 * 1024 * 1024 ||
        typeof original.content_type !== 'string' || !original.content_type || original.content_type.length > 255 || /[\x00-\x1f\x7f]/.test(original.content_type) ||
        original.content_type !== document.content_type || original.sha256 !== document.upload?.sha256 ||
        original.size_bytes !== document.upload?.size_bytes || original.content_type !== document.upload?.content_type ||
        typeof document.filename !== 'string' || !document.filename.trim() || document.filename.length > 180 || /[\x00-\x1f\x7f]/.test(document.filename)) fail(409, 'The retained original metadata is inconsistent.');
    return {reference, recordRevision:row.revision, sha256:original.sha256, sizeBytes:original.size_bytes,
      contentType:original.content_type, filename:document.filename, permissions:['view']};
  }
  return async function integrationResourceIndex(principal, raw) {
    const body = request(raw), observed = instant().getTime(), auth = await authenticate(principal, {enroll:false});
    let connection;
    if (principal.integrationConnection !== undefined) {
      if (typeof authorizeConnection !== 'function') fail(503, 'Owner connection authorization is not configured.');
      connection = await authorizeConnection(auth, body.resources);
    }
    const entries = [];
    let expires = Math.min(observed + 30_000, auth.principal.expiresAt);
    for (const reference of body.resources) {
      const scoped = await artifactAccess(auth, reference.resource_id, 'view');
      entries.push(entry(scoped, reference));
      if (scoped.authorityUntil !== null && scoped.authorityUntil !== undefined) {
        if (typeof scoped.authorityUntil !== 'number' || Number.isNaN(scoped.authorityUntil)) fail(403, 'The document authority horizon is invalid.');
        expires = Math.min(expires, scoped.authorityUntil);
        auth.ctx.authorityDeadlines.set('integration-document:' + resourceReferenceKey(reference, {includeVersion:false}), scoped.authorityUntil);
      }
    }
    for (const until of auth.ctx.authorityDeadlines.values()) {
      if (typeof until !== 'number' || Number.isNaN(until)) fail(403, 'The current authority horizon is invalid.');
      expires = Math.min(expires, until);
    }
    const current = instant().getTime();
    if (!Number.isFinite(expires) || current < observed || expires <= current) fail(403, 'The resource observation expired before completion.');
    auth.ctx.authorityDeadlines.set('integration-resource-index', expires);
    entries.sort((a, b) => compare(resourceReferenceKey(a.reference), resourceReferenceKey(b.reference)));
    // Commitments cover exactly the native rows read, including missing rows
    // and grant/team generation markers. Their identities and contents are not
    // disclosed; every later observation performs the full authorization again.
    const reads = [...auth.ctx.reads.values()].map(({pk, sk, row}) => {
      if (typeof pk !== 'string' || typeof sk !== 'string' || row && (!Number.isSafeInteger(row.revision) || row.revision < 1)) fail(503, 'The current authority revision is unavailable.');
      return {pk, sk, revision:row?.revision ?? null,
        // Canonical identity conditions additionally compare exact values even
        // when their lifecycle revision is unchanged. Commit to that same proof.
        ...(pk.startsWith('APP_IDENTITY#') || pk.startsWith('INTEGRATION_CONNECTION#') ? {expectedValueSha256:digest(row?.value ?? null)} : {})};
    }).sort((a, b) => compare(canonical([a.pk, a.sk]), canonical([b.pk, b.sk])));
    const authorizationRevision = digest(reads), actorId = auth.userId, workspaceId = body.resources[0].workspace_id;
    const indexSha256 = digest({format:'esia-permission-version-index', schemaVersion:1, actorId, workspaceId, authorizationRevision, entries,...(connection?{connection}:{})});
    await commit(auth.ctx);
    const returned = instant().getTime();
    if (returned < observed || returned >= expires || auth.principal.expiresAt <= returned) fail(403, 'The resource observation expired before return.');
    const changed = body.ifIndexSha256 !== indexSha256;
    return {format:'esia-permission-version-index', schemaVersion:1, actorId, workspaceId, indexSha256, authorizationRevision,
      observedAt:new Date(observed).toISOString(), expiresAt:new Date(expires).toISOString(), changed, entries:changed ? entries : [],...(connection?{connection}:{})};
  };
}
