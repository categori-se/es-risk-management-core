// Foreground JSON transport. The adapter supplies verified current identity,
// engagement + ALL source authority before/after each operation and commits its
// read fences. Cache IDs are navigation identities, never bearer capabilities.
import {createHash, randomUUID} from 'node:crypto';
import {stableJson, uuidPattern, sha256Pattern} from '../src/lib/engagement-domain.js';

export const engagementJsonTransferLimits = Object.freeze({bytes:40*1024*1024,cacheBytes:40*1024*1024,entries:2,ttlMs:120_000,chunkBytes:512*1024,ranges:80});
const projections = new Set(['engagement','project','exchange','response']);
const pinFields = ['engagement_id','account_id','project_id','user_id','issuer','subject','configuration_revision','head_revision','head_sha256','source_sha256','source_view_sha256','authority_sha256'];
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (statusCode,message) => { throw Object.assign(new Error(message),{statusCode}); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const exact = (value,fields) => plain(value) && Object.keys(value).length === fields.length && Object.keys(value).every(key=>fields.includes(key));
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value);
const boundedText = (value,max) => typeof value === 'string' && value.length>0 && value.length<=max && !/[\x00-\x1f\x7f]/.test(value);
function normalizedPin(value) {
  if (!exact(value,pinFields) || !uuidPattern.test(value.engagement_id||'') || !['account_id','project_id','user_id'].every(key=>id(value[key])) ||
      !boundedText(value.issuer,2048) || !boundedText(value.subject,1024) ||
      !['configuration_revision','head_revision'].every(key=>Number.isSafeInteger(value[key])&&value[key]>0) ||
      !['head_sha256','source_sha256','source_view_sha256','authority_sha256'].every(key=>sha256Pattern.test(value[key]||'')))
    fail(400,'Use the exact current engagement JSON authority pin.');
  return Object.fromEntries(pinFields.map(key=>[key,value[key]]));
}

/** The adapter derives serverAuthority through verified service helpers; this
 * function only canonicalizes the transport pin, never authenticates a user. */
export function engagementJsonTransferPin({engagementId,serverAuthority,sourceSha256,sourceViewSha256}={}) {
  if (!plain(serverAuthority)) fail(503,'Current authenticated engagement authority is required for JSON transfer.');
  return normalizedPin({engagement_id:engagementId,account_id:serverAuthority.accountId,project_id:serverAuthority.projectId,
    user_id:serverAuthority.userId,issuer:serverAuthority.issuer,subject:serverAuthority.subject,
    configuration_revision:serverAuthority.configurationRevision,head_revision:serverAuthority.headRevision,
    head_sha256:serverAuthority.headSha256,source_sha256:sourceSha256,source_view_sha256:sourceViewSha256,authority_sha256:hash(stableJson(serverAuthority))});
}

/** authorize(principal,id) -> {pin,...adapterState}; finish(state) commits all
 * current read fences. project(principal,id,projection,state) builds the normal
 * existing JSON response once. It must not introduce new decision rules. */
export function createEngagementJsonTransfer({authorize,finish,project,now=()=>Date.now(),newId=()=>randomUUID()}={}) {
  if (![authorize,finish,project,now,newId].every(value=>typeof value==='function')) throw new TypeError('Configure JSON projection and current authority callbacks.');
  const entries = new Map(); let retainedBytes = 0;
  const instant = () => { const value=now(),time=value instanceof Date?value.getTime():value; if (!Number.isFinite(time)) throw new TypeError('Use a valid JSON transfer clock.'); return time; };
  const remove = transferId => {const entry=entries.get(transferId);if(entry){retainedBytes-=entry.bytes.length;entries.delete(transferId);}};
  const expire = () => {const time=instant();for(const [key,entry] of entries)if(entry.expires<=time)remove(key);};
  const projectionOf = value => {if(!projections.has(value))fail(400,'Choose an exact supported engagement JSON projection.');return value;};
  const same = (left,right) => {if(stableJson(left)!==stableJson(right))fail(409,'The engagement, source permissions or JSON projection changed. Reopen before transferring.');};
  async function current(principal,engagementId) {
    if(!uuidPattern.test(engagementId||''))fail(400,'Use an exact engagement UUID.');
    const state=await authorize(principal,engagementId),pin=normalizedPin(state?.pin);
    if(pin.engagement_id!==engagementId||pin.issuer!==principal?.issuer||pin.subject!==principal?.subject)fail(403,'The verified JSON transfer principal or engagement scope differs.');
    return {...state,pin};
  }
  const descriptor = entry => structuredClone(entry.manifest);
  function serializedResponse(result) {
    let serialized;try{serialized=JSON.stringify(result);}catch{fail(409,'The retained response is not complete JSON.');}
    if(typeof serialized!=='string')fail(409,'The retained response is not complete JSON.');
    const size=Buffer.byteLength(serialized);
    if(size<1||size>engagementJsonTransferLimits.bytes)fail(413,'This JSON response exceeds the explicit 40 MiB transfer limit; no records were omitted.');
    return {serialized,size,sha256:hash(serialized)};
  }
  function cache({serialized,size,sha256},projection,pin,guard) {
    expire();
    for(const [key,entry]of entries)if(entry.manifest.projection===projection&&entry.manifest.sha256===sha256&&stableJson(entry.manifest.pin)===stableJson(pin)){
      entries.delete(key);if(guard)entry.guard=guard;entries.set(key,entry);return descriptor(entry);
    }
    while(entries.size>=engagementJsonTransferLimits.entries||retainedBytes+size>engagementJsonTransferLimits.cacheBytes)remove(entries.keys().next().value);
    const transferId=newId();if(!uuidPattern.test(transferId||'')||entries.has(transferId))fail(503,'A unique JSON transfer identity could not be allocated.');
    const expires=instant()+engagementJsonTransferLimits.ttlMs;
    const manifest={format:'esia-engagement-json-transfer',schemaVersion:1,projection,transfer_id:transferId,sha256,size_bytes:size,
      content_type:'application/json',chunk_bytes:engagementJsonTransferLimits.chunkBytes,expires_at:new Date(expires).toISOString(),pin:structuredClone(pin)};
    entries.set(transferId,{bytes:Buffer.from(serialized),manifest,expires,...(guard?{guard}:{})});retainedBytes+=size;
    return structuredClone(manifest);
  }
  async function manifest(principal,engagementId,projection) {
    projectionOf(projection);if(projection==='response')fail(400,'A compound response transfer must be prepared by its committed operation.');
    const before=await current(principal,engagementId);expire();
    let hit;
    for(const entry of entries.values())if(entry.manifest.projection===projection&&stableJson(entry.manifest.pin)===stableJson(before.pin)){hit=entry;break;}
    const encoded=hit?undefined:serializedResponse(await project(principal,engagementId,projection,before));
    const after=await current(principal,engagementId);same(before.pin,after.pin);await finish(after);
    if(hit){if(hit.expires<=instant()||!entries.has(hit.manifest.transfer_id))fail(409,'The JSON transfer expired or was evicted. Restart explicitly.');entries.delete(hit.manifest.transfer_id);entries.set(hit.manifest.transfer_id,hit);return descriptor(hit);}
    return cache(encoded,projection,after.pin);
  }
  async function prepare(principal,engagementId,projection,result,expectedPin,guard) {
    if(guard!==undefined&&typeof guard!=="function")throw new TypeError("Use an internal current response authority guard.");
    projectionOf(projection);const before=await current(principal,engagementId);same(normalizedPin(expectedPin),before.pin);if(guard)await guard(before);
    // Serialize before the final authority fence, so a long serialization cannot
    // make a current receipt outlive a changed head or source permission.
    const encoded=serializedResponse(result);
    const after=await current(principal,engagementId);same(before.pin,after.pin);if(guard)await guard(after);await finish(after);
    return cache(encoded,projection,after.pin,guard);
  }
  async function range(principal,engagementId,projection,body) {
    projectionOf(projection);
    const fields=['transfer_id','sha256','size_bytes','expires_at','pin','offset','length'];
    if(!exact(body,fields)||!uuidPattern.test(body.transfer_id||'')||!sha256Pattern.test(body.sha256||'')||
        !Number.isSafeInteger(body.size_bytes)||body.size_bytes<1||body.size_bytes>engagementJsonTransferLimits.bytes||
        !Number.isSafeInteger(body.offset)||body.offset<0||!Number.isSafeInteger(body.length)||body.length<1||body.length>engagementJsonTransferLimits.chunkBytes||body.offset+body.length>body.size_bytes)
      fail(400,'Select an exact JSON transfer range of at most 512 KiB.');
    const requested=normalizedPin(body.pin),before=await current(principal,engagementId);same(requested,before.pin);expire();
    const entry=entries.get(body.transfer_id);
    if(!entry)fail(409,'The JSON transfer expired or was evicted. Restart explicitly.');
    const stored=entry.manifest;
    if(stored.projection!==projection||stored.sha256!==body.sha256||stored.size_bytes!==body.size_bytes||stored.expires_at!==body.expires_at)fail(409,'The exact JSON transfer identity or range manifest differs.');
    same(stored.pin,before.pin);if(entry.guard)await entry.guard(before);
    const bytes=entry.bytes.subarray(body.offset,body.offset+body.length),after=await current(principal,engagementId);same(before.pin,after.pin);if(entry.guard)await entry.guard(after);await finish(after);
    if(entry.expires<=instant()||entries.get(body.transfer_id)!==entry)fail(409,'The JSON transfer expired or was evicted. Restart explicitly.');
    entries.delete(body.transfer_id);entries.set(body.transfer_id,entry);
    return {...descriptor(entry),offset:body.offset,length:body.length,bytes_base64:bytes.toString('base64')};
  }
  return Object.freeze({manifest,prepare,range,clear(){entries.clear();retainedBytes=0;},stats(){expire();return {entries:entries.size,bytes:retainedBytes};}});
}
