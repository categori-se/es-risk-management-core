import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {applyOversightCommand, emptyOversightBundle, buildOversightPortfolio, createOversightSnapshot} from '../src/lib/oversight-model.js';

export const oversightBackupLimits = Object.freeze({bytes: 16 * 1024 * 1024, checkpoints: 10000, records: 500, snapshots: 500, imports: 1000});
export const oversightBackupOmissions = Object.freeze([
  'Source files and project metadata are not included; restore the same-custody project package separately.',
  'Account snapshots involving multiple projects are omitted.',
  'Cross-account consolidation packets are omitted; they belong to the separate practitioner store.',
  'SHA256 hashes establish portable integrity, not signatures, independently verified authorship or institutional authority.'
]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message, status = 400) => {throw Object.assign(new Error(message), {status});};
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value) ? value : fail('Backup records need exact identifiers.');
const actor = value => typeof value === 'string' && value.trim() && value.length <= 200 && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : fail('Historical oversight actors must be bounded text.');
export const oversightBackupDigest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}(?![\s\S])/.test(value) ? value : fail('Backup hashes must contain exact SHA256 values.');
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z(?![\s\S])/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('Backup historical timestamps must be exact ISO UTC dates.');return value;
}
function keys(value, allowed) {if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail('Unsupported oversight backup fields.');}
export function boundOversightBackup(value) {
  let json;try {json = JSON.stringify(value);} catch {fail('Oversight backups must contain JSON records only.');}
  if (typeof json !== 'string' || Buffer.byteLength(json) > oversightBackupLimits.bytes) fail('This project oversight backup exceeds the 16 MiB portable archive limit.', 413);
  return json;
}
function parsed(row, fields, maximum = 4 * 1024 * 1024) {
  keys(row, [...fields, 'json', 'sha256']);
  if (typeof row.json !== 'string' || Buffer.byteLength(row.json) > maximum) fail('An oversight backup row exceeds its bounded size.', 413);
  if (oversightBackupDigest(row.json) !== hash(row.sha256)) fail('An oversight backup row failed its integrity check.');
  try {const value = JSON.parse(row.json);if (!object(value)) fail('An oversight backup row is invalid.');return value;} catch {fail('An oversight backup row is invalid.');}
}
function rowEqual(actual, expected) {if (!isDeepStrictEqual(actual, expected)) fail('Oversight checkpoint and record histories do not describe a complete valid lifecycle.');}

function replay(previous, current) {
  if (!object(current) || current.schemaVersion !== 1 || current.accountId !== previous.accountId || current.projectId !== previous.projectId || current.revision !== previous.revision + 1 || !Array.isArray(current.records) || current.records.some(record => !object(record)) || current.records.length > oversightBackupLimits.records) fail('Oversight checkpoint scope or sequence is invalid.');
  const prior = new Map(previous.records.map(record => [record.id, record]));
  if (current.records.length < previous.records.length || previous.records.some((record, index) => current.records[index]?.id !== record.id)) fail('Oversight history cannot discard or reorder retained records.');
  const changed = current.records.filter(record => !isDeepStrictEqual(prior.get(record.id), record));
  let command, actorId, now;
  if (!changed.length) {
    command = {op: 'profile', values: current.profile};actorId = 'backup-profile-replay';now = '2000-01-01T00:00:00.000Z';
  } else {
    if (changed.length !== 1 || !isDeepStrictEqual(current.profile, previous.profile)) fail('An oversight checkpoint must describe exactly one retained command.');
    const record = changed[0], earlier = prior.get(record.id);id(record.id);actorId = actor(record.updatedBy);now = timestamp(record.updatedAt);
    timestamp(record.createdAt);if (record.createdAt > now || earlier && (record.updatedAt < earlier.updatedAt || record.type !== earlier.type)) fail('Oversight historical record chronology is invalid.');
    if (record.status === 'draft' && !Object.hasOwn(record, 'decision')) {
      command = {op: 'upsert', type: record.type, values: record.values, ...(earlier ? {recordId: record.id, recordRevision: earlier.revision} : {})};
    } else {
      if (!earlier || !object(record.decision) || !['submit', 'approve', 'return', 'supersede'].includes(record.decision.action) || record.decision.authority !== 'local_practitioner') fail('Imported workflow decisions must remain local practitioner historical assertions.');
      command = {op: record.decision.action, recordId: record.id, recordRevision: earlier.revision, note: record.decision.note};
    }
  }
  let result;
  try {result = applyOversightCommand(previous, command, {actorId, now, canApprove: true, approvalAuthority: 'local_practitioner'});}
  catch {fail('An oversight historical transition is invalid or incomplete.');}
  if (changed.length && !prior.has(changed[0].id)) result.records.at(-1).id = changed[0].id;
  rowEqual(current, result);return changed;
}

function verifyEvidence(project, bundles) {
  if (!project) return {status: 'not_checked', verified: 0, unresolved: 0, pins: []};
  const pins = new Map();
  for (const bundle of bundles) for (const record of bundle.records) for (const pin of record.values.evidencePins) pins.set(JSON.stringify([pin.resourceId, pin.versionId, pin.sha256, pin.locator]), pin);
  const results = [];
  for (const pin of pins.values()) {
    const resource = project.resources?.find(value => value.id === pin.resourceId), version = resource?.versions?.find(value => value.id === pin.versionId);
    if (version && version.sha256 !== pin.sha256 || !version && project.resources?.some(value => value.versions?.some(version => version.id === pin.versionId))) fail('A historical evidence pin conflicts with the exact destination resource, version or SHA256.');
    if (version?.availability === 'changed') fail('A pinned source has changed bytes. Resolve the source mismatch before restoring oversight history.', 409);
    const status = !version ? 'missing' : version.availability === 'unavailable' || version.shareStatus === 'unavailable' ? 'unavailable' : 'verified';
    results.push({...pin, status});
  }
  return {status: results.some(value => value.status !== 'verified') ? 'historical_sources_unresolved' : 'verified', verified: results.filter(value => value.status === 'verified').length, unresolved: results.filter(value => value.status !== 'verified').length, pins: results};
}

export function validateOversightImportReceipt(value, {accountId, projectId}) {
  keys(value, ['id', 'accountId', 'projectId', 'archiveSha256', 'importedAt', 'importedBy', 'assertionStatus', 'summary', 'verification']);
  id(value.id);actor(value.importedBy);timestamp(value.importedAt);hash(value.archiveSha256);
  if (value.accountId !== accountId || value.projectId !== projectId || value.assertionStatus !== 'historical_assertions_not_independently_verified') fail('Historical oversight import provenance has a different scope or authority.');
  keys(value.summary, ['revision', 'checkpoints', 'recordVersions', 'records', 'snapshots', 'priorImports']);
  if (['revision', 'checkpoints', 'recordVersions', 'records', 'snapshots', 'priorImports'].some(key => !Number.isSafeInteger(value.summary[key]) || value.summary[key] < 0)) fail('Historical oversight import counts are invalid.');
  keys(value.verification, ['status', 'verified', 'unresolved', 'pins']);
  if (!['verified', 'historical_sources_unresolved'].includes(value.verification.status) || !Number.isSafeInteger(value.verification.verified) || value.verification.verified < 0 || !Number.isSafeInteger(value.verification.unresolved) || value.verification.unresolved < 0 || !Array.isArray(value.verification.pins) || value.verification.pins.length > oversightBackupLimits.checkpoints * 32) fail('Historical source verification provenance is invalid.');
  for (const pin of value.verification.pins) {
    keys(pin, ['resourceId', 'versionId', 'sha256', 'locator', 'label', 'status']);id(pin.resourceId);id(pin.versionId);hash(pin.sha256);
    if (!['verified', 'missing', 'unavailable'].includes(pin.status) || typeof pin.locator !== 'string' || !pin.locator.trim() || pin.locator.length > 2000 || pin.label !== undefined && (typeof pin.label !== 'string' || pin.label.length > 500)) fail('Historical source verification pins are invalid.');
  }
  if (value.verification.pins.length !== value.verification.verified + value.verification.unresolved || value.verification.verified !== value.verification.pins.filter(pin => pin.status === 'verified').length || (value.verification.unresolved > 0) !== (value.verification.status === 'historical_sources_unresolved')) fail('Historical source verification counts are inconsistent.');
  return value;
}

/** This validates internal consistency, not authorship. A caller with the JSON
 * can rehash it; imported decisions must remain explicitly historical claims. */
export function validateOversightProjectBackup(archive, {accountId, projectId, project} = {}) {
  boundOversightBackup(archive);
  keys(archive, ['format', 'packageVersion', 'accountId', 'projectId', 'exportedAt', 'head', 'checkpoints', 'recordVersions', 'snapshots', 'importReceipts', 'omissions', 'sha256']);
  if (archive.format !== 'esia-oversight-project-backup' || archive.packageVersion !== 1 || archive.accountId !== accountId || archive.projectId !== projectId) fail('Restore requires the exact original project and canonical account custody.');
  timestamp(archive.exportedAt);const {sha256, ...payload} = archive;if (oversightBackupDigest(payload) !== hash(sha256)) fail('The oversight backup failed its portable integrity check.');
  if (!isDeepStrictEqual(archive.omissions, oversightBackupOmissions)) fail('The oversight archive must state its scope and authority limitations.');
  for (const [key, max] of [['checkpoints', oversightBackupLimits.checkpoints], ['recordVersions', oversightBackupLimits.checkpoints], ['snapshots', oversightBackupLimits.snapshots], ['importReceipts', oversightBackupLimits.imports]]) if (!Array.isArray(archive[key]) || archive[key].length > max) fail('The oversight backup exceeds its retained row limit.', 413);
  let bundle = emptyOversightBundle({accountId, projectId});const bundles = [bundle], expectedVersions = [];
  for (const row of archive.checkpoints) {
    const current = parsed(row, ['revision']);if (row.revision !== current.revision) fail('Oversight checkpoint revisions do not match.');
    const changed = replay(bundle, current);
    for (const record of changed) {const json = JSON.stringify(record);expectedVersions.push({recordId: record.id, revision: record.revision, projectRevision: current.revision, json, sha256: oversightBackupDigest(json)});}
    bundle = current;bundles.push(bundle);
  }
  if (archive.head === null) {if (bundle.revision !== 0) fail('Oversight backup head is missing.');}
  else {
    const head = parsed(archive.head, ['revision']);
    if (archive.head.revision !== bundle.revision || !bundle.revision || archive.head.json !== archive.checkpoints.at(-1)?.json || archive.head.sha256 !== archive.checkpoints.at(-1)?.sha256) fail('Oversight backup head does not match its complete checkpoint history.');
    rowEqual(head, bundle);
  }
  rowEqual(archive.recordVersions, expectedVersions);
  for (const current of bundles) for (const record of current.records) if (record.updatedAt > archive.exportedAt) fail('An oversight archive cannot predate its retained history.');
  const seenSnapshots = new Set();
  for (const row of archive.snapshots) {
    const snapshot = parsed(row, ['id']);id(row.id);timestamp(snapshot.createdAt);
    if (seenSnapshots.has(row.id) || snapshot.id !== row.id || snapshot.accountId !== accountId || snapshot.createdAt > archive.exportedAt || !object(snapshot.provenance) || !Array.isArray(snapshot.provenance.projects) || snapshot.provenance.projects.length !== 1 || !Array.isArray(snapshot.portfolio?.projects) || snapshot.portfolio.projects.length !== 1) fail('Only complete single-project oversight snapshots belong in this backup.');seenSnapshots.add(row.id);
    const source = snapshot.provenance.projects[0];if (!object(source) || !object(snapshot.portfolio.projects[0])) fail('Snapshot source provenance is invalid.');
    const checkpoint = bundles[source.revision];
    if (!checkpoint || source.projectId !== projectId || source.sha256 !== oversightBackupDigest(checkpoint)) fail('A snapshot source checkpoint is missing or has a different hash.');
    const name = snapshot.portfolio.projects[0].name;
    if (typeof name !== 'string' || name.length > 2000) fail('Snapshot project metadata is invalid.');
    let expected;
    try {
      const portfolio = buildOversightPortfolio({projects: [{id: projectId, name, accountId}], bundles: [checkpoint], filters: snapshot.portfolio.filters, asOf: snapshot.portfolio.asOf});
      expected = {...createOversightSnapshot({portfolio, kind: snapshot.kind, title: snapshot.title, periodStart: snapshot.periodStart, periodEnd: snapshot.periodEnd, decisions: snapshot.decisions, actorId: snapshot.createdBy, now: snapshot.createdAt, id: snapshot.id}), accountId, provenance: {projects: [{projectId, revision: checkpoint.revision, sha256: oversightBackupDigest(checkpoint)}]}};
    } catch {fail('The retained oversight snapshot is invalid.');}
    rowEqual(snapshot, expected);
  }
  const receipts = new Set();
  for (const row of archive.importReceipts) {
    const receipt = parsed(row, ['id'], oversightBackupLimits.bytes);validateOversightImportReceipt(receipt, {accountId, projectId});
    if (receipt.id !== row.id || receipts.has(row.id) || receipt.importedAt > archive.exportedAt) fail('Historical import receipt identity or chronology is invalid.');receipts.add(row.id);
  }
  return {bundle, verification: verifyEvidence(project, bundles), summary: {revision: bundle.revision, checkpoints: archive.checkpoints.length, recordVersions: archive.recordVersions.length, records: bundle.records.length, snapshots: archive.snapshots.length, priorImports: archive.importReceipts.length}};
}
