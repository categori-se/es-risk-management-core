import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {assertResourceReference} from '@categori/workspace-contracts';
import {parseGeoJson, validateGeoJson, serializeGeoJson} from '../src/lib/geojson-editing.js';

const fail = (status, message) => {throw Object.assign(new Error(message), {status});};
const identifier = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/;
const sha = /^[a-f0-9]{64}(?![\s\S])/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/;
const canonical = value => typeof value === 'number' && Object.is(value, -0) ? '-0' : Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ?
  '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const hash = value => createHash('sha256').update(value).digest('hex');
const exact = (value, fields) => {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(400, 'Use the exact versioned GeoJSON edit fields.');
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || fields.some(key => !Object.hasOwn(value, key))) fail(400, 'Use the exact versioned GeoJSON edit fields.');
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !fields.includes(key) || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail(400, 'Use portable GeoJSON edit data without accessors.');
  }
};
const commandFields = ['type', 'schemaVersion', 'resourceId', 'baseVersionId', 'baseSha256', 'requestId', 'geojson', 'statement'];
export const geoJsonEditOperation = 'geojson.edit.v1';

export function prepareGeoJsonEdit(command, projectId, expectedRevision) {
  exact(command, commandFields);
  if (command.type !== 'source-geojson-edit' || command.schemaVersion !== 1 ||
      ![projectId, command.resourceId, command.baseVersionId].every(value => typeof value === 'string' && identifier.test(value)) ||
      typeof command.baseSha256 !== 'string' || !sha.test(command.baseSha256) || typeof command.requestId !== 'string' || !uuid.test(command.requestId) ||
      !Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
      typeof command.statement !== 'string' || !command.statement.trim() || command.statement.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(command.statement)) fail(400, 'Select the exact source base, project revision, request UUID and a bounded edit statement.');
  const geojson = validateGeoJson(command.geojson), serialized = serializeGeoJson(geojson);
  const normalized = {...command, geojson};
  return {command:normalized, bytes:Buffer.from(serialized, 'utf8'),
    requestSha256:hash(canonical({projectId, expectedRevision, command:normalized}))};
}

export function assertLocalEditableResource(project, resource, version, {allowRegistered = false} = {}) {
  if (!resource || !version) fail(404, 'The exact source resource and version were not found in this project.');
  if (resource.id.startsWith('field:') || resource.versions.some(candidate => candidate.externalReference !== undefined ||
      candidate.reference?.authority !== 'urn:esia:local') || version.mediaType === 'application/vnd.esia.field-record+json') fail(403, 'This source requires its owning field, sharing or connected-resource workflow.');
  let reference;
  try {reference = assertResourceReference(version.reference, {immutable:true});} catch {fail(409, 'The retained local source identity is inconsistent.');}
  if (reference.authority !== 'urn:esia:local' || reference.resource_type !== 'document' || reference.workspace_id !== project.workspaceId ||
      reference.resource_id !== resource.id || reference.version_id !== version.id ||
      !['managed', ...(allowRegistered ? ['registered'] : [])].includes(version.mode)) fail(403, 'Edit an owned managed local source; registered and connected originals need their explicit owning workflow.');
  return version;
}

export function parseEditableGeoJson(version, bytes) {
  if (!['application/geo+json', 'application/json'].includes(version.mediaType) || !/\.(?:geojson|json)$/i.test(version.filename)) fail(422, 'This editor supports retained GeoJSON files only.');
  return parseGeoJson(bytes);
}

const derivationFields = ['format', 'schemaVersion', 'operation', 'baseReference', 'baseSha256', 'baseProjectRevision', 'requestId',
  'requestSha256', 'savedAt', 'executionContext', 'statement'];
export function normalizeGeoJsonDerivation(value, {project, resource, version, priorVersions}) {
  exact(value, derivationFields);
  const base = priorVersions.at(-1);
  let reference;
  try {reference = assertResourceReference(value.baseReference, {immutable:true});} catch {fail(400, 'Retain the exact immutable GeoJSON edit base reference.');}
  if (value.format !== 'esia-source-derivation' || value.schemaVersion !== 1 || value.operation !== geoJsonEditOperation ||
      value.executionContext !== 'local-workspace' || typeof value.baseSha256 !== 'string' || !sha.test(value.baseSha256) ||
      typeof value.requestId !== 'string' || !uuid.test(value.requestId) || typeof value.requestSha256 !== 'string' || !sha.test(value.requestSha256) ||
      !Number.isSafeInteger(value.baseProjectRevision) || value.baseProjectRevision < 1 || value.baseProjectRevision >= project.revision ||
      typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) || new Date(value.savedAt).toISOString() !== value.savedAt || value.savedAt !== version.capturedAt ||
      typeof value.statement !== 'string' || !value.statement.trim() || value.statement.length > 2000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.statement) ||
      !base || value.baseSha256 !== base.sha256 || canonical(reference) !== canonical(base.reference) ||
      priorVersions.some(candidate => candidate.derivation && candidate.derivation.baseProjectRevision >= value.baseProjectRevision)) fail(400, 'The GeoJSON derivation does not match its exact prior source and project history.');
  assertLocalEditableResource(project, {...resource, versions:[...priorVersions, version]}, base);
  assertLocalEditableResource(project, {...resource, versions:[...priorVersions, version]}, version);
  if (version.mediaType !== 'application/geo+json' || !/\.(?:geojson|json)$/i.test(version.filename)) fail(400, 'A derived GeoJSON version must retain its supported source format.');
  return {format:value.format, schemaVersion:1, operation:value.operation, baseReference:reference, baseSha256:value.baseSha256,
    baseProjectRevision:value.baseProjectRevision, requestId:value.requestId, requestSha256:value.requestSha256,
    savedAt:value.savedAt, executionContext:value.executionContext, statement:value.statement};
}

export function assertGeoJsonDerivationBytes(project, resource, version, bytes) {
  if (!version.derivation) return;
  const derivation = version.derivation, geojson = parseEditableGeoJson(version, bytes);
  const prepared = prepareGeoJsonEdit({type:'source-geojson-edit', schemaVersion:1, resourceId:resource.id,
    baseVersionId:derivation.baseReference.version_id, baseSha256:derivation.baseSha256,
    requestId:derivation.requestId, geojson, statement:derivation.statement}, project.id, derivation.baseProjectRevision);
  if (!prepared.bytes.equals(bytes) || prepared.requestSha256 !== derivation.requestSha256) fail(400, 'The GeoJSON derivation request does not match its exact canonical retained bytes.');
}

export function geoJsonEditReceipt(project, requestId) {
  const matches = project.resources.flatMap(resource => resource.versions.filter(version => version.derivation?.requestId === requestId).map(version => ({resource, version})));
  if (matches.length !== 1) fail(409, 'The exact retained edit receipt is unavailable.');
  const {resource, version} = matches[0];
  return {format:'esia-source-edit-receipt', schemaVersion:1, projectId:project.id, resourceId:resource.id,
    versionId:version.id, reference:structuredClone(version.reference), sha256:version.sha256, sizeBytes:version.size,
    baseVersionId:version.derivation.baseReference.version_id, baseSha256:version.derivation.baseSha256,
    requestId:version.derivation.requestId, projectRevision:version.derivation.baseProjectRevision + 1,
    derivation:structuredClone(version.derivation)};
}
