// Trusted adapter helpers. Engagement access and third-party library rights are
// separate decisions; no public provisioning or storage ownership is inferred.
import {createHash} from "node:crypto";
import {getFramework} from "../src/lib/framework-register.js";
import {validateRequirementTarget} from "./requirement-library.mjs";

export const engagementLibraryLimits = Object.freeze({originalBytes:64*1024*1024,retainedBytes:32*1024*1024,retainedNodes:500000,retainedDepth:128,closureBytes:256*1024,uses:1000,sources:100});
const actions = ["requirements","source_preview","source_download"], sha = /^[a-f0-9]{64}$/;
const fail = (statusCode,message) => {throw Object.assign(new Error(message),{statusCode});};
const object = value => value && typeof value === "object" && !Array.isArray(value);
const keys = (value,allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
const text = (value,max=192) => typeof value === "string" && value.length>0 && value.length<=max && !/[\x00-\x1f\x7f]/.test(value);
const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const stable = value => JSON.stringify(value,(_key,item) => object(item) ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])) : item);
const scopeFields = ["engagementId","projectId","workspaceId","accountId","userId"];
function scopeOf(scope) {
  if (!keys(scope,scopeFields) || !scopeFields.every(key=>text(scope[key]))) fail(403,"Use the exact verified User and engagement resource scope for library access.");
  return scope;
}
export function engagementLibraryEntitlementKey({engagementId,frameworkId,userId}) {
  if (![engagementId,frameworkId,userId].every(value=>text(value)) || !getFramework(frameworkId)) fail(403,"Invalid engagement library entitlement identity.");
  return {pk:`ENGAGEMENT#${engagementId}`,sk:`LIBRARY#${frameworkId}#USER#${userId}`};
}

/** Validate a freshly read operator-managed AccessStore row. This function does
 * not authenticate a User, grant engagement access, or establish source rights. */
export function validateEngagementLibraryEntitlement(row,{scope,frameworkId,action="requirements",sourcePackSha256,sourceSha256s=[],now=Date.now()}={}) {
  scopeOf(scope);const framework=getFramework(frameworkId), expected=engagementLibraryEntitlementKey({...scope,frameworkId});
  const grant=row?.value;
  if (!object(row) || row.pk!==expected.pk || row.sk!==expected.sk || !Number.isSafeInteger(row.revision) || row.revision<1 ||
      !keys(grant,["object_type",...scopeFields,"frameworkId","edition","sourcePackSha256","sourceAccess","historicalPackAccess","status","expiresAt","rightsBasis","grantedBy","grantedAt"]) ||
      grant.object_type!=="engagement_library_entitlement" || !scopeFields.every(key=>grant[key]===scope[key]) || grant.frameworkId!==frameworkId || grant.edition!==framework?.edition ||
      !sha.test(grant.sourcePackSha256||"") || !Array.isArray(grant.sourceAccess) || !grant.sourceAccess.length || grant.sourceAccess.length>engagementLibraryLimits.sources ||
      !["active","revoked"].includes(grant.status) || !instant(grant.expiresAt) || !instant(grant.grantedAt) || !text(grant.grantedBy,300) || !text(grant.rightsBasis,4000)) fail(403,"A separate exact engagement, User, edition and source library entitlement is required.");
  const validateSources=(sources,historical=false)=>{
    const seen=new Set();
    if (!Array.isArray(sources) || !sources.length || sources.length>engagementLibraryLimits.sources) fail(403,"The library entitlement requires a bounded explicit source allowlist.");
    for (const source of sources) {
      if (!keys(source,["sha256","actions"]) || !sha.test(source.sha256||"") || seen.has(source.sha256) || !Array.isArray(source.actions) || !source.actions.length || source.actions.length>actions.length || new Set(source.actions).size!==source.actions.length || !source.actions.every(value=>historical?value==="requirements":actions.includes(value))) fail(403,"The library entitlement requires an explicit source hash and action allowlist; historical packs permit retained requirement use only.");
      seen.add(source.sha256);
    }
  };
  validateSources(grant.sourceAccess);
  const historical=Object.hasOwn(grant,"historicalPackAccess")?grant.historicalPackAccess:[];
  if (!Array.isArray(historical) || historical.length>32) fail(403,"Historical policy library rights require a bounded explicit pack allowlist.");
  const packIds=new Set([grant.sourcePackSha256]);
  for (const pack of historical) {
    if (!keys(pack,["sourcePackSha256","sourceAccess"]) || !sha.test(pack.sourcePackSha256||"") || packIds.has(pack.sourcePackSha256)) fail(403,"Historical policy library rights require unique exact source pack hashes.");
    packIds.add(pack.sourcePackSha256);validateSources(pack.sourceAccess,true);
  }
  const nowMs=now instanceof Date ? now.getTime() : typeof now==="string" ? Date.parse(now) : now;
  if (!Number.isFinite(nowMs) || grant.status!=="active" || Date.parse(grant.expiresAt)<=nowMs || Date.parse(grant.grantedAt)>nowMs || Date.parse(grant.expiresAt)<=Date.parse(grant.grantedAt)) fail(403,"The separate source library entitlement is revoked, expired or not yet valid.");
  const access=sourcePackSha256===undefined || sourcePackSha256===grant.sourcePackSha256 ? grant.sourceAccess : historical.find(pack=>pack.sourcePackSha256===sourcePackSha256)?.sourceAccess;
  if (!actions.includes(action) || !access?.some(source=>source.actions.includes(action)) || !Array.isArray(sourceSha256s) || sourceSha256s.length>engagementLibraryLimits.sources || !sourceSha256s.every(value=>sha.test(value) && access.some(source=>source.sha256===value && source.actions.includes(action)))) fail(403,"The library entitlement does not authorize this exact pack, source or action.");
  return structuredClone(row);
}

/** Conservative closure over the entire portable package, including historical
 * entity rows, frozen baselines and retained definitions. Legacy unknown pack
 * pins are reported for explicit migration, never inferred from today's pack. */
export function engagementLibraryUse(packages) {
  if (!Array.isArray(packages) || packages.length>1000) fail(413,"Supply a bounded engagement package list for source library closure.");
  let encoded;try {encoded=JSON.stringify(packages);} catch {fail(400,"Source library closure requires portable JSON packages.");}
  if (Buffer.byteLength(encoded)>engagementLibraryLimits.retainedBytes) fail(413,"Retained source library closure exceeds its package byte bound.");
  const uses=new Map();let nodes=0;
  const visit=(value,depth)=>{
    if (++nodes>engagementLibraryLimits.retainedNodes || depth>engagementLibraryLimits.retainedDepth) fail(413,"Retained source library closure exceeds its structural bound.");
    if (!value || typeof value!=="object") return;
    if (object(value) && ["detailed","diagnostic"].includes(value.checkSet) && value.frameworkId!=="project" && value.checkId) {
      const framework=getFramework(value.frameworkId), definition=value.definition;
      if (!framework || value.edition!==framework.edition || !object(definition) || definition.frameworkId!==value.frameworkId || definition.edition!==value.edition || definition.id!==value.checkId) fail(409,"A retained source requirement has no verifiable framework edition definition.");
      const sourceHashes=new Set();
      for (const source of value.sources||[]) if (sha.test(source?.sha256||"")) sourceHashes.add(source.sha256);
      if (sha.test(definition.detail?.sourceSha256||"")) sourceHashes.add(definition.detail.sourceSha256);
      for (const member of definition.members||[]) if (sha.test(member.detail?.sourceSha256||"")) sourceHashes.add(member.detail.sourceSha256);
      if (!sourceHashes.size || sourceHashes.size>engagementLibraryLimits.sources) fail(409,"A retained source requirement has no exact bounded source hash closure.");
      const sourcePackSha256=sha.test(definition.sourcePackSha256||"") ? definition.sourcePackSha256 : null;
      if (definition.sourcePackSha256!==undefined && !sourcePackSha256) fail(409,"A retained source pack pin is invalid.");
      const key=stable([value.frameworkId,value.edition,sourcePackSha256]);
      if (!uses.has(key)) uses.set(key,{frameworkId:value.frameworkId,edition:value.edition,sourcePackSha256,sourceSha256s:[],requiresMigration:sourcePackSha256===null});
      const use=uses.get(key);use.sourceSha256s=[...new Set([...use.sourceSha256s,...sourceHashes])].sort();
      if (use.sourceSha256s.length>engagementLibraryLimits.sources) fail(413,"The retained policy pack source closure exceeds its bound.");
      if (uses.size>engagementLibraryLimits.uses) fail(413,"Too many retained source library identities in one engagement.");
    }
    for (const child of Object.values(value)) visit(child,depth+1);
  };
  visit(packages,0);return validateEngagementLibraryUse([...uses.values()].sort((a,b)=>stable(a).localeCompare(stable(b))));
}

export function validateEngagementLibraryUse(uses) {
  if (!Array.isArray(uses) || uses.length>engagementLibraryLimits.uses || Buffer.byteLength(JSON.stringify(uses))>engagementLibraryLimits.closureBytes) fail(413,"The retained policy library use summary exceeds its bounded metadata size.");
  const seen=new Set();
  for (const use of uses) {
    if (!keys(use,["frameworkId","edition","sourcePackSha256","sourceSha256s","requiresMigration"]) || !getFramework(use.frameworkId) || use.edition!==getFramework(use.frameworkId).edition || !(use.sourcePackSha256===null||sha.test(use.sourcePackSha256||"")) || use.requiresMigration!==(use.sourcePackSha256===null) || !Array.isArray(use.sourceSha256s) || !use.sourceSha256s.length || use.sourceSha256s.length>engagementLibraryLimits.sources || !use.sourceSha256s.every(value=>sha.test(value)) || new Set(use.sourceSha256s).size!==use.sourceSha256s.length) fail(409,"The retained policy library use summary has an invalid exact edition, source hash or migration marker.");
    const key=stable([use.frameworkId,use.edition,use.sourcePackSha256]);
    if (seen.has(key)) fail(409,"The retained policy library use summary repeats a source pack identity.");
    seen.add(key);
  }
  return structuredClone(uses);
}

export function createEngagementLibrary({library,authorize,originals=[],readOriginal,resolveOriginal,now=Date.now}={}) {
  if (typeof authorize!=="function") throw new Error("Supply the independent, freshly checked engagement library entitlement reader.");
  if (!Array.isArray(originals) || originals.length>6400) throw new Error("Supply a bounded explicit original policy target manifest.");
  const targets=new Map();
  for (const entry of originals) {
    if (!keys(entry,["frameworkId","sourceSha256","target","filename","mediaType"]) || !getFramework(entry.frameworkId) || !sha.test(entry.sourceSha256||"") || !text(entry.filename,180) || !/^[A-Za-z0-9_.-]+$/.test(entry.filename) || entry.mediaType!=="application/pdf") throw new Error("Policy originals require an explicit known edition, source hash and safe PDF descriptor.");
    const target=validateRequirementTarget(entry.target,{maxBytes:engagementLibraryLimits.originalBytes});
    if (target.sha256!==entry.sourceSha256 || targets.has(`${entry.frameworkId}:${entry.sourceSha256}`)) throw new Error("Policy original targets require unique exact source hashes.");
    targets.set(`${entry.frameworkId}:${entry.sourceSha256}`,{...entry,target});
  }
  const originalEntry=async(frameworkId,sourceSha256)=>{
    const installed=targets.get(`${frameworkId}:${sourceSha256}`);if(installed)return installed;
    if(typeof resolveOriginal!=="function")return undefined;const entry=await resolveOriginal(frameworkId,sourceSha256);if(entry===undefined)return undefined;
    if(!keys(entry,["frameworkId","sourceSha256","target","filename","mediaType"])||entry.frameworkId!==frameworkId||entry.sourceSha256!==sourceSha256||!text(entry.filename,180)||!/^[A-Za-z0-9_.-]+$/.test(entry.filename)||entry.mediaType!=="application/pdf")fail(503,"The installed catalog returned another policy original identity.");
    const target=validateRequirementTarget(entry.target,{maxBytes:engagementLibraryLimits.originalBytes});if(target.sha256!==sourceSha256)fail(503,"The installed policy original differs from its exact source SHA256.");return {...entry,target};
  };
  const guard=async (scope,frameworkId,action,pins={},previous)=>{
    scopeOf(scope);
    const row=validateEngagementLibraryEntitlement(await authorize({...scope,frameworkId,action,...pins}),{scope,frameworkId,action,...pins,now:now()});
    if (previous && (previous.revision!==row.revision || stable(previous.value)!==stable(row.value))) fail(409,"The source library entitlement changed during this operation; review the current authority and retry.");
    return row;
  };
  const manifest=async (scope,frameworkId,action="requirements",sourceSha256s)=>{
    const before=await guard(scope,frameworkId,action,sourceSha256s?{sourceSha256s}:{});
    if (typeof library?.manifest!=="function") fail(503,"The exact protected requirement library is not installed.");
    const value=await library.manifest(frameworkId);
    if (value.frameworkId!==frameworkId || value.edition!==getFramework(frameworkId)?.edition || !sha.test(value.sourcePack?.sha256||"") || !Array.isArray(value.sources)) fail(503,"The installed source manifest does not match the requested framework edition.");
    const hashes=value.sources.map(source=>source.sha256);
    if (!hashes.length || hashes.length>engagementLibraryLimits.sources || !hashes.every(value=>sha.test(value)) || sourceSha256s?.some(value=>!hashes.includes(value))) fail(403,"The requested original is outside the exact installed source manifest.");
    const pins={sourcePackSha256:value.sourcePack.sha256,sourceSha256s:sourceSha256s||hashes};
    const row=await guard(scope,frameworkId,action,pins,before);return {value,row,pins};
  };
  const authorizeUseClosure=async(scope,closure)=>{
    scopeOf(scope);const uses=validateEngagementLibraryUse(closure),proof=[];
    for (const use of uses) {
      if (use.requiresMigration) fail(409,"A retained source requirement lacks its exact source pack pin; an operator must review and migrate its library authority without rewriting historical bytes.");
      const pins={sourcePackSha256:use.sourcePackSha256,sourceSha256s:use.sourceSha256s};
      proof.push(await guard(scope,use.frameworkId,"requirements",pins));
    }
    // Recheck earlier grants after the final awaited read as well.
    for (let i=0;i<uses.length;i++) await guard(scope,uses[i].frameworkId,"requirements",{sourcePackSha256:uses[i].sourcePackSha256,sourceSha256s:uses[i].sourceSha256s},proof[i]);
    return proof;
  };
  return Object.freeze({
    async page(scope,frameworkId,query={}) {
      if (!keys(query,["after"])) fail(400,"Only the exact requirement page cursor is supported.");
      const auth=await manifest(scope,frameworkId);
      const page=await library.page(frameworkId,query);
      if (page.sourcePack?.sha256!==auth.pins.sourcePackSha256) fail(409,"The source pack changed during its protected read.");
      await guard(scope,frameworkId,"requirements",auth.pins,auth.row);return page;
    },
    async context(scope,frameworkId,checkId,{checkSet="detailed"}={}) {
      if (!text(checkId) || !["detailed","diagnostic"].includes(checkSet)) fail(400,"Choose an exact retained source statement or conceptual group.");
      const auth=await manifest(scope,frameworkId);
      if (typeof library.context!=="function") fail(503,"The protected requirement context reader is not installed.");
      const context=await library.context(frameworkId,checkId,{checkSet});
      if (context.definition?.sourcePackSha256!==auth.pins.sourcePackSha256 || context.definition?.edition!==auth.value.edition) fail(409,"The source definition changed during its protected read.");
      await guard(scope,frameworkId,"requirements",auth.pins,auth.row);return context;
    },
    authorizeUseClosure,
    async authorizeUses(scope,packages) {return authorizeUseClosure(scope,engagementLibraryUse(packages));},
    async originalOptions(scope,frameworkId) {
      const first=await guard(scope,frameworkId,'source_download');
      const selected=first.value.sourceAccess.filter(source=>['source_preview','source_download'].every(action=>source.actions.includes(action))).map(source=>source.sha256);
      if(!selected.length)fail(403,'This source entitlement does not permit preparing policy originals for offline reading.');
      const auth=await manifest(scope,frameworkId,'source_download',selected);await guard(scope,frameworkId,'source_preview',auth.pins,first);if(first.revision!==auth.row.revision||stable(first.value)!==stable(auth.row.value))fail(409,'The policy original entitlement changed while opening its selection.');
      const result=[];
      for(const sourceSha256 of selected){const entry=await originalEntry(frameworkId,sourceSha256);if(!entry)fail(503,'An authorized policy original has no installed immutable target.');result.push({target:{...entry.target},version:{id:`policy:${frameworkId}:${sourceSha256}`,sha256:sourceSha256,size:entry.target.size,filename:entry.filename,mediaType:entry.mediaType},policy:{frameworkId,edition:auth.value.edition,sourcePackSha256:auth.pins.sourcePackSha256,title:auth.value.sources.find(source=>source.sha256===sourceSha256)?.title||'Retained standard original'},entitlement:{revision:auth.row.revision,expiresAt:auth.row.value.expiresAt,actions:['source_preview','source_download']}});}
      for(const action of ['source_preview','source_download'])await guard(scope,frameworkId,action,auth.pins,auth.row);return result;
    },
    async originalDescriptor(scope,frameworkId,sourceSha256,{actions:requested=["source_download"]}={}) {
      if(!sha.test(sourceSha256||"")||!Array.isArray(requested)||!requested.length||requested.length>2||new Set(requested).size!==requested.length||requested.some(action=>!["source_preview","source_download"].includes(action)))fail(400,"Choose the exact retained policy source and explicit read rights.");
      let auth;for(const action of requested){const checked=await manifest(scope,frameworkId,action,[sourceSha256]);if(auth&&(auth.row.revision!==checked.row.revision||stable(auth.row.value)!==stable(checked.row.value)))fail(409,"The policy source entitlement changed during selection.");auth=checked;}
      const entry=await originalEntry(frameworkId,sourceSha256);if(!entry)fail(503,"No independently authorized immutable policy target is installed for this original.");
      for(const action of requested)await guard(scope,frameworkId,action,auth.pins,auth.row);
      return {target:{...entry.target},version:{id:`policy:${frameworkId}:${sourceSha256}`,sha256:sourceSha256,size:entry.target.size,filename:entry.filename,mediaType:entry.mediaType},policy:{frameworkId,edition:auth.value.edition,sourcePackSha256:auth.pins.sourcePackSha256},entitlement:{revision:auth.row.revision,expiresAt:auth.row.value.expiresAt,actions:[...requested]}};
    },
    async original(scope,frameworkId,sourceSha256,{download=false}={}) {
      if (!sha.test(sourceSha256||"") || typeof download!=="boolean") fail(400,"Choose an exact retained policy original and read action.");
      const action=download?"source_download":"source_preview", auth=await manifest(scope,frameworkId,action,[sourceSha256]);
      const entry=await originalEntry(frameworkId,sourceSha256);
      if (!entry || typeof readOriginal!=="function") fail(503,"No separately authorized immutable policy original target is installed for this source.");
      const receipt=await readOriginal(entry.target);
      if (!keys(receipt,["bytes","versionId","sha256","size"]) || !(receipt.bytes instanceof Uint8Array) || receipt.versionId!==entry.target.versionId || receipt.sha256!==sourceSha256 || receipt.size!==entry.target.size || receipt.bytes.byteLength!==entry.target.size) fail(503,"The policy original failed its exact provider version and length check.");
      const bytes=Buffer.from(receipt.bytes);
      if (hash(bytes)!==sourceSha256 || bytes.subarray(0,5).toString()!=="%PDF-") fail(503,"The policy original failed its exact PDF and source hash check.");
      await guard(scope,frameworkId,action,auth.pins,auth.row);
      return {bytes,version:{id:`policy:${frameworkId}:${sourceSha256}`,sha256:sourceSha256,size:entry.target.size,filename:entry.filename,mediaType:entry.mediaType},policy:{frameworkId,edition:auth.value.edition,title:auth.value.sources.find(source=>source.sha256===sourceSha256)?.title||"Retained policy original",rights:auth.value.sources.find(source=>source.sha256===sourceSha256)?.rights||"Source retention does not establish redistribution rights."}};
    }
  });
}
