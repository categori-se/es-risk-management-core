// Operator-selected immutable metadata only. Catalog membership supplies a
// storage allowlist; each caller still checks the separate source entitlement.
import {createHash} from "node:crypto";
import {getFramework} from "../src/lib/framework-register.js";
import {validateRequirementTarget} from "./requirement-library.mjs";

export const policyOriginalCatalogLimits = Object.freeze({configurationBytes: 600, catalogBytes: 1024 * 1024, entries: 6400, originalBytes: 64 * 1024 * 1024});
const fail = message => {throw Object.assign(new Error(message), {statusCode: 503});};
const object = value => value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const sha = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const targetKey = target => JSON.stringify([target.bucket, target.key, target.versionId, target.sha256, target.size]);
const storageVersionKey = target => JSON.stringify([target.bucket, target.key, target.versionId]);
const fixedReservedBuckets = ["esia-analysis-public", "esia-analysis-public-archive"];

function reservedSet(reservedBuckets) {
  if (!Array.isArray(reservedBuckets) || reservedBuckets.some(bucket => typeof bucket !== "string" || !bucket)) fail("Supply the explicit private-account, public and deployment bucket exclusions.");
  return new Set([...fixedReservedBuckets, ...reservedBuckets]);
}

function targetOf(value, {maxBytes, reserved}) {
  if (!exact(value, ["bucket", "key", "versionId", "sha256", "size"]) || !sha(value.sha256)) fail("Policy originals require exact immutable bucket, key, version, SHA256 and size metadata.");
  const target = validateRequirementTarget(value, {maxBytes});
  if (reserved.has(target.bucket) || /^(?:xn--|sthree-|amzn-s3-demo-)/.test(target.bucket) || /(?:-s3alias|--ol-s3|--x-s3|--table-s3|-an)$/.test(target.bucket) || target.key.split("/").includes("tenants")) fail("Policy originals, private accounts and public/deployment storage require separate custody.");
  return target;
}

export function parsePolicyOriginalCatalogIndex(value, {reservedBuckets = []} = {}) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > policyOriginalCatalogLimits.configurationBytes) fail("ESIA_POLICY_ORIGINALS_INDEX requires at most 600 bytes of exact target JSON.");
  let parsed;
  try {parsed = JSON.parse(value);} catch {fail("ESIA_POLICY_ORIGINALS_INDEX must contain valid target JSON.");}
  return targetOf(parsed, {maxBytes: policyOriginalCatalogLimits.catalogBytes, reserved: reservedSet(reservedBuckets)});
}

function catalogOf(value, reserved) {
  if (!exact(value, ["format", "schemaVersion", "sources"]) || value.format !== "esia-policy-original-catalog" || value.schemaVersion !== 1 || !Array.isArray(value.sources) || value.sources.length > policyOriginalCatalogLimits.entries) fail("The complete policy-original catalog must have its exact versioned envelope and at most 6400 sources.");
  const entries = new Map(), targets = new Map(), storageVersions = new Map();
  for (const entry of value.sources) {
    if (!exact(entry, ["frameworkId", "sourceSha256", "target", "filename", "mediaType"]) || !getFramework(entry.frameworkId) || !sha(entry.sourceSha256) || typeof entry.filename !== "string" || entry.filename.length > 180 || !/^[A-Za-z0-9][A-Za-z0-9_.-]*\.pdf$/i.test(entry.filename) || entry.filename.includes("..") || entry.mediaType !== "application/pdf") fail("Every policy original needs a known framework, source SHA256 and safe PDF filename and media type.");
    const target = targetOf(entry.target, {maxBytes: policyOriginalCatalogLimits.originalBytes, reserved});
    const key = `${entry.frameworkId}:${entry.sourceSha256}`, identity = targetKey(target), storageVersion = storageVersionKey(target);
    if (target.sha256 !== entry.sourceSha256 || entries.has(key) || storageVersions.has(storageVersion) && storageVersions.get(storageVersion) !== identity) fail("Policy originals require unique framework/source identities and consistent exact immutable storage versions.");
    storageVersions.set(storageVersion, identity);
    targets.set(identity, target);
    entries.set(key, Object.freeze({...entry, target}));
  }
  return {entries, targets};
}

export function createPolicyOriginalCatalog({index, readVersion, reservedBuckets = []} = {}) {
  const reserved = reservedSet(reservedBuckets);
  const configured = index === undefined || index === null ? null : targetOf(index, {maxBytes: policyOriginalCatalogLimits.catalogBytes, reserved});
  let loading;
  const load = async () => {
    if (!configured || typeof readVersion !== "function") fail("The immutable policy-original catalog is not installed.");
    if (!loading) {
      loading = Promise.resolve().then(async () => {
        const bytes = await readVersion(configured);
        if (!(bytes instanceof Uint8Array) || bytes.byteLength !== configured.size || bytes.byteLength > policyOriginalCatalogLimits.catalogBytes || hash(bytes) !== configured.sha256) fail("The policy-original catalog failed its exact SHA256 and byte-size check.");
        let value;
        try {value = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));} catch {fail("The immutable policy-original catalog must be complete UTF-8 JSON.");}
        return catalogOf(value, reserved);
      }).catch(error => {loading = undefined;throw error;});
    }
    return loading;
  };
  return Object.freeze({
    async resolveOriginal(frameworkId, sourceSha256) {
      if (!getFramework(frameworkId) || !sha(sourceSha256) || !configured) return undefined;
      const entry = (await load()).entries.get(`${frameworkId}:${sourceSha256}`);
      return entry ? {...entry, target: {...entry.target}} : undefined;
    },
    async assertTarget(value) {
      const target = targetOf(value, {maxBytes: policyOriginalCatalogLimits.originalBytes, reserved});
      const entry = (await load()).targets.get(targetKey(target));
      if (!entry) fail("The requested policy original is outside the verified immutable catalog allowlist.");
      return {...entry};
    }
  });
}
