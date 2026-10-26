// Foreground, read-only tasks at the owning service. This is deliberately not
// a general job executor: no original reads, provider execution or write-back.
import {createHash} from 'node:crypto';
import {assertResourceReference, resourceReferenceKey, validatePortableData} from '@categori/workspace-contracts';
import {stableJson} from '../src/lib/engagement-domain.js';

const hash = value => createHash('sha256').update(stableJson(value)).digest('hex');
const sha = /^[a-f0-9]{64}(?![\s\S])/;
const requestId = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/;
const fail = (statusCode, message) => {throw Object.assign(new Error(message), {statusCode});};
const exact = (value, names) => value && !Array.isArray(value) && typeof value === 'object' &&
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const operation = 'document.describe.v1';

function input(body, execute) {
  if (validatePortableData(body).length) fail(400, 'Use bounded portable task data without credentials.');
  const fields = ['schemaVersion','requestId','operation','inputs','expectedIndexSha256','traffic','budget'];
  if (!exact(body, execute ? [...fields, 'expectedPlanSha256'] : fields) || body.schemaVersion !== 1 ||
      typeof body.requestId !== 'string' || !requestId.test(body.requestId) ||
      typeof body.expectedIndexSha256 !== 'string' || !sha.test(body.expectedIndexSha256) ||
      execute && (typeof body.expectedPlanSha256 !== 'string' || !sha.test(body.expectedPlanSha256))) {
    fail(400, 'Use the exact versioned task request and reviewed index or plan digest.');
  }
  if (body.operation !== operation) fail(422, 'This service supports only document.describe.v1 by reference.');
  if (!exact(body.traffic, ['mode','maxAssetBytes','maxMetadataBytes']) || body.traffic.mode !== 'references-only' ||
      body.traffic.maxAssetBytes !== 0 || !Number.isSafeInteger(body.traffic.maxMetadataBytes) ||
      body.traffic.maxMetadataBytes < 1 || body.traffic.maxMetadataBytes > 65536) {
    fail(422, 'This adapter requires references-only traffic, zero asset bytes and at most 64 KiB of response metadata.');
  }
  if (!exact(body.budget, ['maxCostMicros','maxDurationMs']) || body.budget.maxCostMicros !== 0 ||
      !Number.isSafeInteger(body.budget.maxDurationMs) || body.budget.maxDurationMs < 1 || body.budget.maxDurationMs > 10000) {
    fail(422, 'This read adapter permits no charged execution and a response deadline of at most ten seconds.');
  }
  if (!Array.isArray(body.inputs) || !body.inputs.length || body.inputs.length > 8) fail(400, 'Select one to eight exact immutable inputs.');
  let inputs;
  try {inputs = body.inputs.map(reference => assertResourceReference(reference, {immutable:true}));}
  catch {fail(400, 'Task inputs must use existing immutable resource references.');}
  if (new Set(inputs.map(reference => resourceReferenceKey(reference))).size !== inputs.length) fail(400, 'Select distinct exact task inputs.');
  return {...structuredClone(body), inputs};
}

/** Current index authorization is mandatory for both planning and execution.
 * requestId identifies a repeatable read; it is not an exactly-once job claim.
 * maxCostMicros covers charged task execution, not the normal cost of the
 * existing authenticated API and metadata store.
 */
export function createIntegrationReferenceTasks({resourceIndex, now = Date.now} = {}) {
  if (typeof resourceIndex !== 'function') throw new TypeError('Current owning-service resource authorization is required.');
  async function prepare(principal, raw, execute) {
    const started = now(), body = input(raw, execute);
    const checkDeadline = () => {
      const current = now();
      if (!Number.isFinite(current) || current < started || current - started >= body.budget.maxDurationMs) fail(408, 'The metadata task response deadline elapsed.');
      return current;
    };
    // The index service rechecks the native identity, protected source rules,
    // exact versions and all current authority rows in a conditional transaction.
    const index = await resourceIndex(principal, {schemaVersion:1, resources:body.inputs});
    const current = checkDeadline();
    if (index?.format !== 'esia-permission-version-index' || index.schemaVersion !== 1 || index.changed !== true ||
        !Array.isArray(index.entries) || index.entries.length !== body.inputs.length ||
        typeof index.indexSha256 !== 'string' || !sha.test(index.indexSha256) ||
        typeof index.actorId !== 'string' || typeof index.workspaceId !== 'string' || typeof index.expiresAt !== 'string' ||
        !Number.isFinite(Date.parse(index.expiresAt)) || Date.parse(index.expiresAt) <= current) {
      fail(503, 'A current complete owning-service index is required.');
    }
    const keys = new Set(body.inputs.map(reference => resourceReferenceKey(reference)));
    for (const entry of index.entries) {
      let key;
      try {key = resourceReferenceKey(assertResourceReference(entry.reference, {immutable:true}));}
      catch {fail(503, 'The owning-service index returned an invalid immutable input.');}
      if (!keys.delete(key) || entry.reference.workspace_id !== index.workspaceId || !entry.permissions?.includes('view')) {
        fail(503, 'The owning-service index differs from the selected authorized inputs.');
      }
    }
    if (index.indexSha256 !== body.expectedIndexSha256) fail(409, 'Permissions or versions changed; review a fresh index before planning this task.');
    const descriptor = {schemaVersion:1, requestId:body.requestId, operation, actorId:index.actorId, workspaceId:index.workspaceId,
      inputs:body.inputs, indexSha256:index.indexSha256, placement:'owning-service', traffic:body.traffic, budget:body.budget,...(index.connection?{connection:index.connection}:{})};
    const planSha256 = hash(descriptor);
    if (execute && body.expectedPlanSha256 !== planSha256) fail(409, 'The reviewed plan differs from the current task inputs or budgets.');
    const plan = {format:'esia-reference-task-plan', ...descriptor, planSha256,
      expiresAt:index.expiresAt, assetBytes:0, output:'document-metadata', idempotence:'repeatable-read'};
    function bounded(value) {
      checkDeadline();
      if (Date.parse(index.expiresAt) <= now()) fail(403, 'The current resource observation expired before return.');
      if (Buffer.byteLength(JSON.stringify(value)) > body.traffic.maxMetadataBytes) fail(413, 'The complete task response exceeds the selected metadata byte budget.');
      return value;
    }
    return {body, index, plan, bounded};
  }
  return {
    async plan(principal, body) {const state = await prepare(principal, body, false); return state.bounded(state.plan);},
    async describe(principal, body) {
      const state = await prepare(principal, body, true);
      // Explicit projection prevents an adapter from accidentally returning
      // provider paths, connection details or original bytes in a result.
      const results = state.index.entries.map(({reference,recordRevision,sha256,sizeBytes,contentType,filename}) =>
        ({reference,recordRevision,sha256,sizeBytes,contentType,filename}));
      return state.bounded({format:'esia-reference-task-result', schemaVersion:1, requestId:state.body.requestId,
        operation, actorId:state.index.actorId, workspaceId:state.index.workspaceId, planSha256:state.plan.planSha256,
        indexSha256:state.index.indexSha256, results, resultsSha256:hash(results),
        provenance:{inputs:state.body.inputs, processor:operation, placement:'owning-service'},
        observedAt:state.index.observedAt, expiresAt:state.index.expiresAt, assetBytes:0, chargedExecutionCostMicros:0,...(state.index.connection?{connection:state.index.connection}:{})});
    }
  };
}
