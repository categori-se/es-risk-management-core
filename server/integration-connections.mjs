import {assertConfiguredResourceAuthority} from '../src/lib/hosted-field-capture-model.js';
// Owner-issued connection-use permission is separate from native User access.
// Keys authenticate possession of this explicit owner capability, not app
// attestation or a new federated identity. Provider bindings remain owner-side.
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {types} from 'node:util';
import {assertResourceReference, resourceReferenceKey} from '@categori/workspace-contracts';
import {record} from './access-store.mjs';

export const integrationConnectionPartition = 'INTEGRATION_CONNECTION#';
const operation = 'document.describe.v1';
const opaque = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value);
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}(?![\s\S])/.test(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const error = (fail, message) => fail(400, message);

function fields(value, required, fail) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) error(fail, 'Use exact owner connection fields.');
  const keys = Reflect.ownKeys(value), result = Object.create(null);
  if (keys.length !== required.length || required.some(key => !Object.hasOwn(value, key))) error(fail, 'Use exact owner connection fields.');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !required.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) error(fail, 'Use ordinary owner connection data.');
    result[key] = descriptor.value;
  }
  return result;
}
function list(value, maximum, fail) {
  if (!Array.isArray(value) || types.isProxy(value) || !value.length || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) error(fail, 'Use a bounded dense owner connection list.');
  return Array.from({length:value.length}, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) error(fail, 'Use ordinary owner connection list items.');
    return descriptor.value;
  });
}
function stableResources(value, workspaceId, fail, authority) {
  const values = list(value, 8, fail).map(item => {
    const data = fields(item, ['schema_version','authority','resource_id','resource_type','workspace_id'], fail);
    let reference;
    try {reference = assertResourceReference(data);} catch {error(fail, 'Use stable shared resource references without version_id.');}
    if (reference.authority !== authority || reference.resource_type !== 'document_original' || reference.workspace_id !== workspaceId || !opaque(reference.resource_id)) error(fail, 'Use exact owner document references in the selected workspace.');
    return reference;
  });
  if (new Set(values.map(value => resourceReferenceKey(value, {includeVersion:false}))).size !== values.length) error(fail, 'Select distinct owner document identities.');
  return values.sort((a, b) => resourceReferenceKey(a).localeCompare(resourceReferenceKey(b)));
}
function operations(value, fail) {
  const values = list(value, 1, fail);
  if (values.length !== 1 || values[0] !== operation) error(fail, 'Only document.describe.v1 connection use is supported.');
  return [operation];
}

// Only the trusted Gateway parses raw headers. No raw key is attached to a
// principal, persisted in a row, returned in observations or sent to audit.
export function integrationConnectionProof(headers, fail) {
  const selected = new Map();
  for (const [name, value] of Object.entries(headers || {})) {
    const lower = name.toLowerCase();
    if (!['x-categori-connection-id','x-categori-connection-key'].includes(lower)) continue;
    if (selected.has(lower)) error(fail, 'Use one owner connection proof header pair.');
    selected.set(lower, value);
  }
  if (!selected.size) return undefined;
  const id = selected.get('x-categori-connection-id'), key = selected.get('x-categori-connection-key');
  if (selected.size !== 2 || !opaque(id) || !hex(key)) error(fail, 'Both exact owner connection proof headers are required.');
  return Object.freeze({id, keySha256:hash(key)});
}

export function createIntegrationConnections({resourceAuthority, authenticate, artifactAccess, memberWorkspace, get, commit, instant, newId, fail}) {
  const authority = assertConfiguredResourceAuthority(resourceAuthority);
  if ([authenticate, artifactAccess, memberWorkspace, get, commit, instant, newId, fail].some(value => typeof value !== 'function')) throw new TypeError('Current owner connection authority hooks are required.');
  const project = row => {
    const {id,recipientAppId,actorId,workspaceId,resources,operations,expiresAt,enabled} = row.value;
    return {id,revision:row.revision,recipientAppId,actorId,workspaceId,resources:structuredClone(resources),operations:[...operations],expiresAt,enabled,authority};
  };
  function validRow(row) {
    if (!row || row.sk !== 'PROFILE' || !Number.isSafeInteger(row.revision) || row.revision < 1) fail(403, 'The owner connection is unavailable.');
    let value;
    try {
      value = fields(row.value, ['object_type','schemaVersion','id','recipientAppId','actorId','workspaceId','resources','operations','expiresAt','enabled','keySha256','createdAt'], fail);
      if (value.object_type !== 'integration_connection' || value.schemaVersion !== 1 || ![value.id,value.recipientAppId,value.actorId,value.workspaceId].every(opaque) ||
          row.pk !== integrationConnectionPartition + value.id || !hex(value.keySha256) || typeof value.enabled !== 'boolean' ||
          typeof value.expiresAt !== 'string' || new Date(value.expiresAt).toISOString() !== value.expiresAt ||
          typeof value.createdAt !== 'string' || new Date(value.createdAt).toISOString() !== value.createdAt) throw new Error('Invalid connection row');
      stableResources(value.resources, value.workspaceId, fail, authority);operations(value.operations, fail);
    } catch {fail(403, 'The owner connection is unavailable.');}
    return value;
  }
  function horizon(auth, name, until) {
    if (until === null || until === undefined || until === Infinity) return;
    if (!Number.isFinite(until) || until <= instant().getTime()) fail(403, 'Current owner connection authority expired.');
    auth.ctx.authorityDeadlines.set(name, until);
  }
  async function scoped(auth, reference, action) {
    const value = await artifactAccess(auth, reference.resource_id, action), document = value.target?.value;
    if (document?.workspace_id !== reference.workspace_id || document.artifact_id !== reference.resource_id ||
        document.original?.reference?.authority !== authority || document.original.reference.resource_type !== 'document_original' ||
        document.original.reference.resource_id !== reference.resource_id || document.original.reference.workspace_id !== reference.workspace_id) fail(403, 'The exact owner source is unavailable.');
    horizon(auth, 'integration-source:' + reference.resource_id + ':' + action, value.authorityUntil);
    return value;
  }
  async function workspaceOwner(auth, workspaceId) {
    const value = await memberWorkspace(auth, workspaceId, {owner:true});
    if (value.member.value.identity.expires_at !== null) horizon(auth, 'integration-workspace-owner:' + workspaceId, Date.parse(value.member.value.identity.expires_at));
    return value;
  }
  return {
    async create(principal, raw) {
      const body = fields(raw, ['schemaVersion','recipientAppId','workspaceId','resources','operations','expiresInSeconds'], fail);
      if (body.schemaVersion !== 1 || !opaque(body.recipientAppId) || !opaque(body.workspaceId) || !Number.isSafeInteger(body.expiresInSeconds) || body.expiresInSeconds < 60 || body.expiresInSeconds > 86400) error(fail, 'Choose an exact recipient, workspace and connection lifetime from sixty seconds to one day.');
      const resources = stableResources(body.resources, body.workspaceId, fail, authority), allowed = operations(body.operations, fail);
      const auth = await authenticate(principal, {enroll:false});
      for (const reference of resources) await scoped(auth, reference, 'view');
      let owner = false;
      try {await workspaceOwner(auth, body.workspaceId);owner = true;} catch (error) {if (error.statusCode !== 403) throw error;}
      if (!owner) for (const reference of resources) await scoped(auth, reference, 'manage_access');
      const id = newId();if (!opaque(id)) fail(503, 'The owner connection identifier is unavailable.');
      const pk = integrationConnectionPartition + id;if (await get(auth.ctx, pk, 'PROFILE')) fail(409, 'The owner connection identifier already exists.');
      const key = randomBytes(32).toString('hex'), created = instant().getTime();
      const row = record(pk, 'PROFILE', {object_type:'integration_connection',schemaVersion:1,id,recipientAppId:body.recipientAppId,actorId:auth.userId,
        workspaceId:body.workspaceId,resources,operations:allowed,expiresAt:new Date(created + body.expiresInSeconds * 1000).toISOString(),enabled:true,keySha256:hash(key),createdAt:new Date(created).toISOString()});
      await commit(auth.ctx, [row]);
      return {format:'esia-integration-connection',schemaVersion:1,connection:project(row),connectionKey:key};
    },
    async revoke(principal, raw) {
      const body = fields(raw, ['schemaVersion','connectionId','workspaceId','expectedRevision'], fail);
      if (body.schemaVersion !== 1 || !opaque(body.connectionId) || !opaque(body.workspaceId) || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1) error(fail, 'Use the exact current owner connection and revision.');
      const auth = await authenticate(principal, {enroll:false}), row = await get(auth.ctx, integrationConnectionPartition + body.connectionId, 'PROFILE'), value = validRow(row);
      if (value.workspaceId !== body.workspaceId) fail(403, 'The owner connection belongs to another workspace.');
      if (value.actorId !== auth.userId) await workspaceOwner(auth, value.workspaceId);
      if (row.revision !== body.expectedRevision) fail(409, 'The owner connection revision changed.');
      const changed = value.enabled ? record(row.pk, row.sk, {...row.value,enabled:false}, row.revision + 1) : row;
      if (!Number.isSafeInteger(changed.revision)) fail(413, 'The owner connection revision limit was reached.');
      await commit(auth.ctx, value.enabled ? [changed] : []);
      return {format:'esia-integration-connection',schemaVersion:1,connection:project(changed)};
    },
    async authorize(auth, requested) {
      if (auth.principal.integrationConnection === undefined) return undefined;
      const proof = fields(auth.principal.integrationConnection, ['id','keySha256'], fail);
      if (!opaque(proof.id) || !hex(proof.keySha256)) fail(403, 'The owner connection proof is unavailable.');
      const row = await get(auth.ctx, integrationConnectionPartition + proof.id, 'PROFILE'), value = validRow(row);
      if (!timingSafeEqual(Buffer.from(value.keySha256, 'hex'), Buffer.from(proof.keySha256, 'hex')) || !value.enabled || value.actorId !== auth.userId ||
          requested.some(reference => reference.workspace_id !== value.workspaceId || !value.resources.some(allowed => resourceReferenceKey(allowed,{includeVersion:false}) === resourceReferenceKey(reference,{includeVersion:false})))) fail(403, 'Current owner connection use does not permit these resources.');
      horizon(auth, 'integration-connection:' + value.id, Date.parse(value.expiresAt));
      return {id:value.id,revision:row.revision,recipientAppId:value.recipientAppId,expiresAt:value.expiresAt};
    }
  };
}
