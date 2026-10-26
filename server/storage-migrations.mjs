// Exact verified provider-location migration; immutable receipts remain unchanged.
const esiaMigrationRows = Object.freeze([]);
export function esiaMigrationRead(target, configuredBucket) {
  const {bucket, key, versionId, sha256, sizeBytes} = target;
  const row = esiaMigrationRows.find(item => item.new_bucket === configuredBucket && item.key === key && item.old_version_id === versionId && (bucket === item.old_bucket || bucket === item.new_bucket));
  if (row) {
    if ((sha256 !== undefined && sha256 !== row.sha256) || (sizeBytes !== undefined && sizeBytes !== row.bytes)) throw Error("Migrated provider bytes differ from the immutable receipt.");
    return {bucket: row.new_bucket, versionId: row.new_version_id, logicalVersionId: row.old_version_id, migrated: true};
  }
  if (bucket !== configuredBucket) throw Error("Provider location has no exact verified migration.");
  return {bucket, versionId, logicalVersionId: versionId, migrated: false};
}
export function esiaMigrationOriginalMatches(original, configuredBucket) {
  if (original?.bucket === configuredBucket) return true;
  try {return esiaMigrationRead({bucket: original?.bucket, key: original?.key, versionId: original?.reference?.version_id, sha256: original?.sha256, sizeBytes: original?.size_bytes}, configuredBucket).migrated;}
  catch {return false;}
}
