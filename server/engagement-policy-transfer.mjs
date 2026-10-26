// Exact policy-original transfers use provider ranges, never per-Lambda full-file
// cache assumptions. Every range checks independent source rights before/after.
import {stableJson} from '../src/lib/engagement-domain.js';
export function createEngagementPolicyTransfer({metadata,libraryFor,libraryScope,sameHead,asyncDomain,requireBody,commit,readRange,fail}={}){
 async function describe(principal,engagementId,frameworkId,sha256){
  const state=await metadata(principal,engagementId),original=await asyncDomain(()=>libraryFor(state).originalDescriptor(libraryScope(state),frameworkId,sha256));
  const manifest={mediated:true,version_id:original.target.versionId,sha256,size_bytes:original.target.size,filename:original.version.filename,content_type:original.version.mediaType,head_sha256:state.head.value.snapshot.sha256,configuration_revision:state.target.revision,source_pack_sha256:original.policy.sourcePackSha256,entitlement_revision:original.entitlement.revision,entitlement_expires_at:original.entitlement.expiresAt};return {state,original,manifest};
 }
 async function engagementPolicySourceTransfer(principal,engagementId,frameworkId,sha256,body){
  const before=await describe(principal,engagementId,frameworkId,sha256);
  if(body===undefined){await commit(before.state.auth.ctx);return before.manifest;}
  const fields=['version_id','sha256','size_bytes','head_sha256','configuration_revision','source_pack_sha256','entitlement_revision','entitlement_expires_at'];requireBody(body,[...fields,'offset','length']);
  if(fields.some(key=>body[key]!==before.manifest[key]))fail(409,'The policy source, entitlement or engagement changed. Reopen its original manifest.');
  if(!Number.isSafeInteger(body.offset)||body.offset<0||!Number.isSafeInteger(body.length)||body.length<1||body.length>512*1024||body.offset+body.length>before.original.target.size)fail(400,'Read at most512KiB within this exact authorized policy original.');
  if(typeof readRange!=='function')fail(503,'Bounded immutable policy-original reading is not configured.');
  const bytes=await readRange({...before.original.target,offset:body.offset,length:body.length}),after=await describe(principal,engagementId,frameworkId,sha256);sameHead(before.state,after.state);
  if(stableJson(before.original)!==stableJson(after.original))fail(409,'The immutable policy target or independent source rights changed during the range read.');
  if(!(bytes instanceof Uint8Array)||bytes.byteLength!==body.length)fail(409,'The policy original range is incomplete.');
  await commit(after.state.auth.ctx);return {...after.manifest,offset:body.offset,length:body.length,bytes_base64:Buffer.from(bytes).toString('base64')};
 }
 return {engagementPolicySourceTransfer};
}
