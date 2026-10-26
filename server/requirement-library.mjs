import {createHash} from "node:crypto";
import {getFramework, frameworkTopics, getRequirementContextFromPack} from "../src/lib/framework-register.js";

export const requirementLibraryLimits = Object.freeze({indexBytes: 256 * 1024, packBytes: 16 * 1024 * 1024, pageBytes: 1024 * 1024 - 1024, recordsPerPage: 50, records: 30000, cacheBytes: 80 * 1024 * 1024});
const fail = (statusCode, message) => {throw Object.assign(new Error(message), {statusCode});};
const object = value => value && typeof value === "object" && !Array.isArray(value);
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const freeze = value => {if (value && typeof value === "object" && !Object.isFrozen(value)) {Object.freeze(value);Object.values(value).forEach(freeze);}return value;};

export function validateRequirementTarget(value, {maxBytes = requirementLibraryLimits.packBytes, bucket} = {}) {
  if (!object(value) || Object.keys(value).sort().join(",") !== "bucket,key,sha256,size,versionId" ||
      typeof value.bucket !== "string" || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value.bucket) || bucket && value.bucket !== bucket ||
      typeof value.key !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_./=-]{0,1023}$/.test(value.key) || value.key.includes("..") || value.key.startsWith("tenants/") ||
      typeof value.versionId !== "string" || !value.versionId || value.versionId === "null" || value.versionId.length > 500 || /[\x00-\x1f\x7f]/.test(value.versionId) ||
      !/^[a-f0-9]{64}$/.test(value.sha256) || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > maxBytes) fail(503, "The private requirement library target is not configured with exact bounded version/hash metadata.");
  return Object.freeze({...value});
}

export function parseRequirementLibraryIndex(value, {reservedBuckets = []} = {}) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || Buffer.byteLength(value) > 600) fail(503, "The private requirement index configuration exceeds its bound.");
  let parsed;try {parsed = JSON.parse(value);} catch {fail(503, "The private requirement index configuration must be JSON.");}
  const target = validateRequirementTarget(parsed, {maxBytes: requirementLibraryLimits.indexBytes});
  if (reservedBuckets.includes(target.bucket) || ["esia-analysis-public", "esia-analysis-public-archive"].includes(target.bucket)) fail(503, "Reference libraries, private accounts and public/deployment storage require separate buckets.");
  return target;
}

export function validateRequirementIndex(value, target) {
  if (!object(value) || !Object.keys(value).length || Object.keys(value).length > 64) fail(503, "The pinned requirement index is invalid.");
  const result = {};
  for (const [frameworkId, entry] of Object.entries(value)) {
    if (!getFramework(frameworkId)) fail(503, "The pinned requirement index contains an unknown framework.");
    result[frameworkId] = validateRequirementTarget(entry, {bucket: target.bucket});
  }
  return Object.freeze(result);
}

function jsonBytes(bytes, target) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== target.size || hash(bytes) !== target.sha256) fail(503, "The private requirement source failed its exact version integrity check.");
  try {return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(bytes));} catch {fail(503, "The pinned requirement source is not valid UTF-8 JSON.");}
}

function validatePack(pack, frameworkId) {
  const framework = getFramework(frameworkId), sourceIds = new Map(), ids = new Set();
  if (!object(pack) || pack.frameworkId !== frameworkId || pack.edition !== framework.edition || !pack.parserVersion || !Array.isArray(pack.sources) || !pack.sources.length || pack.sources.length > 100 ||
      !Array.isArray(pack.records) || pack.records.length > requirementLibraryLimits.records || pack.counts?.recordCount !== pack.records.length || !object(pack.coverage)) fail(503, "The pinned requirement pack has a mismatched edition or invalid record manifest.");
  for (const source of pack.sources) {
    let url;try {url = new URL(source.url);} catch {fail(503, "Invalid requirement source citation.");}
    if (typeof source.id !== "string" || !source.id || sourceIds.has(source.id) || !/^[a-f0-9]{64}$/.test(source.sha256) || !["http:", "https:"].includes(url.protocol) || url.username || url.password) fail(503, "Invalid requirement source citation or hash.");
    sourceIds.set(source.id, source.sha256);
  }
  for (const record of pack.records) {
    if (!object(record) || typeof record.id !== "string" || !record.id || record.id.length > 192 || ids.has(record.id) ||
        sourceIds.get(record.detail?.sourceId) !== record.detail?.sourceSha256 || !sourceIds.has(record.detail?.sourceId) ||
        !frameworkTopics.some(topic => topic.id === record.topic) || typeof record.detail.sourceText !== "string" || !object(record.detail.context) || !Array.isArray(record.evidence)) fail(503, "The pinned requirement pack contains an invalid source statement identity.");
    ids.add(record.id);
  }
  return freeze(pack);
}

export function createRequirementLibrary({index, readVersion, maxCacheBytes = requirementLibraryLimits.cacheBytes} = {}) {
  const configured = index ? validateRequirementTarget(index, {maxBytes: requirementLibraryLimits.indexBytes}) : null;
  if (!Number.isSafeInteger(maxCacheBytes) || maxCacheBytes < requirementLibraryLimits.packBytes || maxCacheBytes > requirementLibraryLimits.cacheBytes) throw Error("Invalid immutable reference cache bound.");
  let indexPromise;const cache = new Map(), pending = new Map();let cacheBytes = 0;
  const loadIndex = async () => {
    if (!configured || typeof readVersion !== "function") fail(503, "The protected requirement library is not installed.");
    if (!indexPromise) indexPromise = Promise.resolve().then(async () => validateRequirementIndex(jsonBytes(await readVersion(configured), configured), configured)).catch(error => {indexPromise = null;throw error;});
    return indexPromise;
  };
  const load = async frameworkId => {
    if (!getFramework(frameworkId)) fail(404, "Unknown framework edition.");
    const target = (await loadIndex())[frameworkId];if (!target) fail(404, "This framework has no installed protected source library.");
    const key = `${frameworkId}:${target.sha256}`;
    if (cache.has(key)) {const cached = cache.get(key);cache.delete(key);cache.set(key, cached);return cached;}
    if (!pending.has(key)) pending.set(key, Promise.resolve().then(async () => {
      const pack = validatePack(jsonBytes(await readVersion(target), target), frameworkId);
      const {records, ...manifest} = pack;
      const entry = {pack, manifest, target};
      while (cacheBytes + target.size > maxCacheBytes && cache.size) {const first = cache.keys().next().value;cacheBytes -= cache.get(first).target.size;cache.delete(first);}
      cache.set(key, entry);cacheBytes += target.size;return entry;
    }).finally(() => pending.delete(key)));
    return pending.get(key);
  };
  return Object.freeze({
  async manifest(frameworkId) {
    const {manifest, target} = await load(frameworkId);
    return structuredClone({...manifest, sourcePack: {sha256: target.sha256, size: target.size}});
  },
  async context(frameworkId, checkId, {checkSet = "detailed"} = {}) {
    const {pack, target} = await load(frameworkId);let context;
    try {context = getRequirementContextFromPack(pack, checkId, checkSet, {sourcePackSha256: target.sha256});}
    catch {fail(404, "Choose a source statement or conceptual group from the installed exact framework edition.");}
    if (Buffer.byteLength(JSON.stringify(context)) > requirementLibraryLimits.pageBytes) fail(503, "The retained requirement context exceeds the protected response limit.");
    return context;
  },
  async page(frameworkId, {after} = {}) {
    const {pack, manifest, target} = await load(frameworkId);let offset = 0;
    if (after !== undefined && after !== null && after !== "") {
      if (typeof after !== "string" || after.length > 512 || !/^[A-Za-z0-9_-]+$/.test(after)) fail(400, "Invalid requirement page cursor.");
      let cursor;try {cursor = JSON.parse(Buffer.from(after, "base64url").toString("utf8"));} catch {fail(400, "Invalid requirement page cursor.");}
      if (!object(cursor) || Object.keys(cursor).sort().join(",") !== "frameworkId,offset,sha256" || cursor.frameworkId !== frameworkId || !Number.isSafeInteger(cursor.offset) || cursor.offset < 1 || cursor.offset >= pack.records.length) fail(400, "Invalid requirement page cursor scope or offset.");
      if (cursor.sha256 !== target.sha256) fail(409, "The requirement source pack changed; reopen from its first page.");
      offset = cursor.offset;
    }
    const response = {...manifest, sourcePack: {sha256: target.sha256, size: target.size}, offset, records: [], nextCursor: null};
    for (const record of pack.records.slice(offset, offset + requirementLibraryLimits.recordsPerPage)) {
      response.records.push(record);
      const next = offset + response.records.length;
      response.nextCursor = next < pack.records.length ? Buffer.from(JSON.stringify({frameworkId, sha256: target.sha256, offset: next})).toString("base64url") : null;
      if (Buffer.byteLength(JSON.stringify(response)) > requirementLibraryLimits.pageBytes) {
        response.records.pop();const accepted = offset + response.records.length;
        response.nextCursor = accepted < pack.records.length ? Buffer.from(JSON.stringify({frameworkId, sha256: target.sha256, offset: accepted})).toString("base64url") : null;
        if (!response.records.length) fail(503, "A retained source statement exceeds the protected page response limit.");
        break;
      }
    }
    if (Buffer.byteLength(JSON.stringify(response)) > requirementLibraryLimits.pageBytes) fail(503, "The protected requirement manifest exceeds its response bound.");
    return response;
  }});
}
