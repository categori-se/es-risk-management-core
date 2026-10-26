// Local, declared-role device policy. These receipts are not central identity,
// device management, a trusted device clock or a promise of offline remote wipe.
const fail = message => {throw Object.assign(Error(message), {code: "FIELD_DEVICE_POLICY", status: 403});};
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, names, label) => {if (!object(value) || Object.keys(value).some(key => !names.includes(key))) fail(`${label} contains unsupported fields.`);};
const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const clock = value => {const result = value === undefined ? Date.now() : typeof value === "function" ? value() : value;const milliseconds = result instanceof Date ? result.getTime() : typeof result === "string" ? Date.parse(result) : result;if (!Number.isFinite(milliseconds)) fail("The device policy clock is unavailable.");return milliseconds;};
const scopeOf = value => {keys(value,["accountId","projectId","engagementId"],"Device lease scope");for (const key of ["accountId","projectId","engagementId"]) if (typeof value[key] !== "string" || !/^[A-Za-z0-9_.:-]{1,192}$/.test(value[key])) fail("A device lease needs its exact account, project and engagement.");return {...value};};
export function normalizeFieldDevicePolicy(value) {
  if (value === undefined) return undefined;
  keys(value,["schemaVersion","offlineAllowed","allowSourceOriginals","allowedSensitivities","maxOfflineHours","autoLockMinutes","retentionHours"],"Local device policy");
  if (value.schemaVersion !== 1 || typeof value.offlineAllowed !== "boolean" || typeof value.allowSourceOriginals !== "boolean") fail("Use device policy version 1 and explicit offline and original-file choices.");
  if (!Array.isArray(value.allowedSensitivities) || !value.allowedSensitivities.length || value.allowedSensitivities.length > 3 || value.allowedSensitivities.some(item => !["internal","confidential","restricted"].includes(item)) || new Set(value.allowedSensitivities).size !== value.allowedSensitivities.length) fail("Choose distinct permitted record sensitivities.");
  for (const [name,max] of [["maxOfflineHours",720],["autoLockMinutes",120],["retentionHours",8760]]) if (!Number.isSafeInteger(value[name]) || value[name] < 1 || value[name] > max) fail(`Set ${name} between 1 and ${max}.`);
  return {schemaVersion:1,offlineAllowed:value.offlineAllowed,allowSourceOriginals:value.allowSourceOriginals,allowedSensitivities:[...value.allowedSensitivities].sort(),maxOfflineHours:value.maxOfflineHours,autoLockMinutes:value.autoLockMinutes,retentionHours:value.retentionHours};
}
export const fieldDevicePolicyDigestInput = policy => {const normalized=normalizeFieldDevicePolicy(policy);return normalized===undefined?null:JSON.stringify(canonical(normalized));};
export async function fieldDevicePolicySha256(policy,{crypto=globalThis.crypto}={}) {
  const input=fieldDevicePolicyDigestInput(policy);if(input===null)return null;
  if(!crypto?.subtle)fail("Device policy integrity needs Web Crypto on HTTPS or localhost.");
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input)))].map(value=>value.toString(16).padStart(2,"0")).join("");
}
export function assertFieldDeviceLease(policy,lease,{scope,now,policySha256,sensitivity,includesOriginals=false}={}) {
  const normalized=normalizeFieldDevicePolicy(policy);
  if(normalized===undefined){if(lease!==undefined&&lease!==null)fail("This engagement has no configured local device policy for that lease.");return {status:"legacy_unconfigured"};}
  if(!normalized.offlineAllowed)fail("The local engagement device policy prohibits offline storage and work.");
  if(includesOriginals&&!normalized.allowSourceOriginals)fail("The local engagement device policy prohibits cached source originals.");
  if(sensitivity&&!normalized.allowedSensitivities.includes(sensitivity))fail("This record's sensitivity is not permitted on the device by the local engagement policy.");
  keys(lease,["format","schemaVersion","scope","policySha256","issuedAt","expiresAt","retentionReviewAt"],"Local device lease");
  if(lease.format!=="esia-local-field-device-lease"||lease.schemaVersion!==1||typeof policySha256!=="string"||!/^[a-f0-9]{64}$/.test(policySha256)||lease.policySha256!==policySha256)fail("The local device policy changed. Reconnect, review the current policy and prepare a fresh lease.");
  const expected=scopeOf(scope),actual=scopeOf(lease.scope);if(Object.keys(expected).some(key=>expected[key]!==actual[key]))fail("This device lease belongs to another account, project or engagement.");
  const times=[lease.issuedAt,lease.expiresAt,lease.retentionReviewAt].map(value=>typeof value==="string"&&/^\d{4}-\d\d-\d\dT/.test(value)?Date.parse(value):NaN),[issued,expires,retention]=times,time=clock(now);
  if(times.some(value=>!Number.isFinite(value))||issued>time+60000||expires<=issued||retention<=issued||expires>issued+normalized.maxOfflineHours*3600000||retention>issued+normalized.retentionHours*3600000||expires>retention)fail("The device lease dates exceed the approved local policy.");
  if(time>=expires||time>=retention)fail("This cached device lease has expired. Its encrypted originals are retained; reconnect for policy review or explicitly clear the cached mission.");
  return {status:"configured",expiresAt:lease.expiresAt,retentionReviewAt:lease.retentionReviewAt,autoLockMinutes:normalized.autoLockMinutes};
}
export async function validateFieldDeviceLease(policy,lease,options={}) {const policySha256=await fieldDevicePolicySha256(policy,options);return assertFieldDeviceLease(policy,lease,{...options,policySha256});}
export async function createFieldDeviceLease(policy,scope,{now,crypto=globalThis.crypto}={}) {
  const normalized=normalizeFieldDevicePolicy(policy);if(normalized===undefined)return null;
  const issued=clock(now),retention=issued+normalized.retentionHours*3600000;
  const lease={format:"esia-local-field-device-lease",schemaVersion:1,scope:scopeOf(scope),policySha256:await fieldDevicePolicySha256(normalized,{crypto}),issuedAt:new Date(issued).toISOString(),expiresAt:new Date(Math.min(issued+normalized.maxOfflineHours*3600000,retention)).toISOString(),retentionReviewAt:new Date(retention).toISOString()};
  assertFieldDeviceLease(normalized,lease,{scope,now:issued,policySha256:lease.policySha256});return lease;
}

/** One resettable deadline, never a polling loop. Expiry/idle lock retains the
 * encrypted records; it only releases the session key and visible work. */
export function createFieldDevicePolicyTimer({policy,lease,onLock,now=Date.now,schedule=setTimeout,cancel=clearTimeout}={}) {
  const normalized=normalizeFieldDevicePolicy(policy);let timer=null,stopped=false;
  const stop=()=>{stopped=true;if(timer!==null)cancel(timer);timer=null;};
  const activity=()=>{
    if(stopped||!normalized)return;
    if(timer!==null)cancel(timer);
    const time=clock(now),expiry=Math.min(Date.parse(lease?.expiresAt),Date.parse(lease?.retentionReviewAt)),idle=time+normalized.autoLockMinutes*60000;
    if(!Number.isFinite(expiry))fail("A configured session requires a valid cached device lease.");
    const delay=Math.max(0,Math.min(expiry,idle)-time);
    timer=schedule(()=>{timer=null;stopped=true;onLock?.(clock(now)>=expiry?"The cached device lease expired; encrypted records are retained for policy review.":"Device drafts locked after the configured idle period.");},delay);
  };
  activity();return {activity,stop};
}
