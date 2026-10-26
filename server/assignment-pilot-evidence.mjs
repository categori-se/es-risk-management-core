import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {validatePilotMeasurement, comparePilotMeasurements, validatePractitionerObservation} from '../src/lib/professional-qualification.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const scoped = value => {if (!value || ['accountId', 'projectId', 'engagementId'].some(key => typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 192)) throw Error('Pilot evidence requires exact account, canonical project and engagement identities.');return Object.fromEntries(['accountId', 'projectId', 'engagementId'].map(key => [key, value[key]]));};

// Stores study observations and restore receipts only. Projects, documents,
// findings, reports and approval decisions remain in their existing stores.
export function createAssignmentPilotEvidence({directory, authorize, readRestoredArtifact, verificationScope = 'declared_exact_artifact_versions', now = () => new Date()} = {}) {
  if (typeof authorize !== 'function') throw Error('Pilot evidence requires the existing workspace authorization boundary.');
  mkdirSync(directory, {recursive:true, mode:0o700});
  const db = new DatabaseSync(join(directory, 'assignment-pilot-evidence.sqlite'));
  db.exec('CREATE TABLE IF NOT EXISTS observations (id TEXT PRIMARY KEY, scope_key TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS observations_scope ON observations(scope_key, created_at);');
  async function boundary(scope, operation, actor) {const selected = scoped(scope);if (await authorize({scope:selected, operation, actor}) !== true) throw Object.assign(Error('Assignment pilot evidence access was denied.'), {status:403});return {scope:selected, key:hash(JSON.stringify(selected))};}
  function insert(key, kind, body) {const id = randomUUID(), createdAt = now().toISOString();const value = {...body, id, createdAt};db.prepare('INSERT INTO observations(id,scope_key,kind,body,created_at) VALUES(?,?,?,?,?)').run(id, key, kind, JSON.stringify(value), createdAt);return value;}
  async function list(scope, actor) {const {key} = await boundary(scope, 'read', actor);const records = db.prepare('SELECT body FROM observations WHERE scope_key=? ORDER BY created_at,id LIMIT 1000').all(key).map(row => JSON.parse(row.body));const measurements = records.filter(v => v.format === 'esia-assignment-pilot-measurement');const comparisons = [];for (const app of measurements.filter(v => v.method === 'esia_review')) {const baseline = measurements.find(v => v.method === 'word_excel' && v.assignmentId === app.assignmentId && v.datasetSha256 === app.datasetSha256 && v.acceptanceCriteriaSha256 === app.acceptanceCriteriaSha256);if (baseline) comparisons.push({appMeasurementId:app.id, baselineMeasurementId:baseline.id, ...comparePilotMeasurements(app, baseline)});}return {records, comparisons, storedCanonicalRecords:false};}
  async function recordMeasurement(scope, input, actor) {
    const {key} = await boundary(scope, 'write', actor);
    if (typeof actor?.id !== 'string' || !actor.id.trim()) throw Error('Record the actual practitioner identity.');
    let handoverReceipt = null;
    if (input.handoverReceiptId) {const row = db.prepare('SELECT body FROM observations WHERE id=? AND scope_key=? AND kind=?').get(input.handoverReceiptId, key, 'handover');handoverReceipt = row ? JSON.parse(row.body) : null;if (!handoverReceipt || handoverReceipt.datasetSha256 !== input.datasetSha256) throw Error('Select a verified handover receipt for this exact assignment dataset and scope.');}
    const measurement = validatePilotMeasurement({...input, operatorId:actor.id, measuredAt:input.measuredAt || now().toISOString(), handoverReceipt});
    return insert(key, 'measurement', {...measurement, operatorIdentityBasis:actor.identityBasis || 'operator_supplied_attestation'});
  }
  async function recordObservation(scope, input, actor) {
    const {key} = await boundary(scope, 'write', actor);
    const observation = validatePractitionerObservation({...input, recorderId:actor?.id});
    return insert(key, 'task-observation', {...observation, recorderIdentityBasis:actor.identityBasis || 'operator_supplied_attestation'});
  }
  async function verifyHandover(scope, input, actor) {
    const {scope:selected, key} = await boundary(scope, 'verify-handover', actor);
    if (typeof readRestoredArtifact !== 'function') throw Error('Connect the canonical restored-artifact reader before verifying handover.');
    if (!/^[a-f0-9]{64}$/.test(input?.datasetSha256 || '') || !Array.isArray(input.artifacts) || !input.artifacts.length || input.artifacts.length > 100 || new Set(input.artifacts.map(v => `${v?.canonicalId}\0${v?.versionId}`)).size !== input.artifacts.length) throw Error('Handover requires a pinned dataset and bounded distinct canonical artifact versions.');
    const artifacts = [];
    for (const item of input.artifacts) {
      if (!item?.canonicalId || !item.versionId || !/^[a-f0-9]{64}$/.test(item.sha256 || '')) throw Error('Pin every canonical artifact identity, version and hash.');
      const restored = await readRestoredArtifact({scope:selected, actor, canonicalId:item.canonicalId, versionId:item.versionId});
      if (!restored || restored.canonicalId !== item.canonicalId || restored.versionId !== item.versionId || !(restored.bytes instanceof Uint8Array) || restored.bytes.byteLength > 128 * 1024 * 1024 || restored.reopened !== true) throw Error('Reopen each restored exact canonical record or report version before handover verification.');
      const observedSha256 = hash(restored.bytes);
      artifacts.push({canonicalId:item.canonicalId, versionId:item.versionId, expectedSha256:item.sha256, observedSha256, byteCount:restored.bytes.byteLength, reopened:true, passed:observedSha256 === item.sha256});
    }
    await boundary(scope, 'verify-handover', actor);
    return insert(key, 'handover', {format:'esia-verified-pilot-handover', schemaVersion:1, datasetSha256:input.datasetSha256, verifiedBy:actor.id, artifacts, passed:artifacts.every(v => v.passed), verifiedAt:now().toISOString(), verificationScope, fullAssignmentHandoverProven:false, verificationBasis:'Canonical restored artifact reader reopened each declared version and returned bytes for independent SHA-256 comparison.'});
  }
  return {list, recordMeasurement, recordObservation, verifyHandover, close:() => db.close()};
}
