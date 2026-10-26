// Operator-owned routing: client labels, project IDs and request bodies never
// choose a bucket. One canonical hosted account owns one distinct bucket.
const accountIdPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/;
const bucketPattern = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9](?![\s\S])/;
const kmsPattern = /^arn:aws:kms:us-east-1:[0-9]{12}:key\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?![\s\S])/;
const object = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const unavailable = () => Object.assign(new Error('Private storage is not provisioned for this canonical account.'), {statusCode: 503});

export function normalizeAccountStorage(value, {reservedBuckets = []} = {}) {
  if (!object(value) || !Object.keys(value).length || Object.keys(value).length > 128) throw Error('Configure between one and 128 explicit account storage bindings.');
  const result = {}, used = new Set(), usedKeys = new Set();
  for (const [accountId, target] of Object.entries(value)) {
    if (!accountIdPattern.test(accountId) || accountId.includes('..') || ['__proto__', 'constructor', 'prototype'].includes(accountId) || !object(target) || Object.keys(target).some(key => !['bucket', 'kmsKeyArn'].includes(key))) throw Error('Account storage requires exact canonical IDs and operator-owned bucket bindings.');
    const {bucket, kmsKeyArn} = target;
    if (typeof bucket !== 'string' || !bucketPattern.test(bucket) || /^(?:xn--|sthree-|amzn-s3-demo-)/.test(bucket) || /(?:-s3alias|--ol-s3|--x-s3|--table-s3|-an)$/.test(bucket) || ['esia-analysis-public', 'esia-analysis-public-archive'].includes(bucket)) throw Error('Private buckets require reviewed hyphenated S3 bucket names without public-archive or frontend reuse.');
    if (reservedBuckets.includes(bucket)) throw Error("Public archives, deployment artifacts and private accounts require separate buckets.");
    if (used.has(bucket)) throw Error('Each canonical account must use a distinct private S3 bucket.');
    if (kmsKeyArn !== undefined && (typeof kmsKeyArn !== 'string' || !kmsPattern.test(kmsKeyArn))) throw Error('Configure an exact us-east-1 KMS key ARN, not an alias or client value.');
    if (kmsKeyArn && usedKeys.has(kmsKeyArn)) throw Error("Configured account KMS keys must be distinct.");
    if (kmsKeyArn) usedKeys.add(kmsKeyArn);
    used.add(bucket);result[accountId] = Object.freeze({bucket, ...(kmsKeyArn ? {kmsKeyArn} : {})});
  }
  return Object.freeze(result);
}
export function parseAccountStorage(value, options) {
  if (typeof value !== 'string' || value.length > 100_000) throw Error('ESIA_ACCOUNT_STORAGE_JSON requires bounded, explicit JSON account bindings.');
  let parsed;try {parsed = JSON.parse(value);} catch {throw Error('ESIA_ACCOUNT_STORAGE_JSON must contain valid JSON.');}
  return normalizeAccountStorage(parsed, options);
}
export function createAccountStorage(value) {
  const accounts = normalizeAccountStorage(value);
  const forAccount = accountId => {
    if (typeof accountId !== 'string' || !Object.hasOwn(accounts, accountId)) throw unavailable();
    return accounts[accountId];
  };
  const forKey = key => {
    const match = typeof key === 'string' && key.length <= 2048 && !key.includes('..') && /^tenants\/([A-Za-z0-9][A-Za-z0-9_.:-]{0,191})\/projects\/([A-Za-z0-9][A-Za-z0-9_.:-]{0,191})\/[A-Za-z0-9_./:-]+(?![\s\S])/.exec(key);
    if (!match) throw Error('An exact server-selected account/project storage key is required.');
    return {...forAccount(match[1]), accountId: match[1], projectId: match[2]};
  };
  return Object.freeze({accounts, forAccount, forKey});
}
export function storageEncryptionHeaders(binding) {
  return binding.kmsKeyArn ? {'x-amz-server-side-encryption': 'aws:kms', 'x-amz-server-side-encryption-aws-kms-key-id': binding.kmsKeyArn} : {};
}
