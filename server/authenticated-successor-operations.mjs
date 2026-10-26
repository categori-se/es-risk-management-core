// Explicit foreground successor import. All private archive bytes remain exact
// historical originals; the common engine constructs the new working graph.
import {createHash} from 'node:crypto';
import {assertCollaborationResource} from '@categori/workspace-contracts';
import {stableJson,uuidPattern,sha256Pattern} from '../src/lib/engagement-domain.js';
import {engagementLibraryEntitlementKey,validateEngagementLibraryEntitlement} from './engagement-library.mjs';
import {inspectEngagementSuccessorArchive} from './engagement-successor.mjs';
import {collectEngagementCaseProtection} from './engagement-case-protection.mjs';
import {engagementSuccessorStorageLimits as limits,engagementOriginKey,engagementSuccessorPartKey,validateSuccessorArchiveDeclarations,validateEngagementOriginManifests,assertEngagementOriginInventory} from './engagement-origin-storage.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const scopeOf=state=>({engagementId:state.target.value.engagement_id,projectId:state.target.value.project_id,workspaceId:state.target.value.workspace_id,accountId:state.target.value.account_id,userId:state.auth.userId});
const equal=(a,b)=>stableJson(a)===stableJson(b);
export const engagementSuccessorReviewKey=({engagementId,archiveSha256,frameworkId})=>({pk:`ENGAGEMENT#${engagementId}`,sk:`SUCCESSOR_POLICY_REVIEW#${archiveSha256}#${frameworkId}`});

export function createAuthenticatedSuccessorOperations(d){
 const {authenticate,resourceAccess,entitlement,sourceProjection,get,commit,record,storage,objects,instant,iso,fail,id,requireBody,requestUuid,reservation,evaluate,authOf,loadOriginals,preparedObject,promotedWrites,getEngagement,metadata,load,mergeAuthority,assertEngagementProfile,domain}=d;
 async function authorizeOrigins(state,manifests){
  const scope=scopeOf(state),result=new Map();
  for(const archive of manifests){const authorizations=[];
   for(const use of archive.policyUses){
    let destinationSourcePackSha256=use.sourcePackSha256,legacyReview;
    if(use.requiresMigration){
     const key=engagementSuccessorReviewKey({...scope,archiveSha256:archive.sha256,frameworkId:use.frameworkId}),row=await get(state.auth.ctx,key.pk,key.sk),value=row?.value;
     const allowed=['object_type',...Object.keys(scope),'archiveSha256','frameworkId','edition','sourceSha256s','destinationSourcePackSha256','reviewedBy','reviewedAt','statement','status','expiresAt'];
     if(!value||Object.keys(value).length!==allowed.length||Object.keys(value).some(key=>!allowed.includes(key))||value.object_type!=='engagement_successor_policy_review'||Object.entries(scope).some(([key,item])=>value[key]!==item)||value.archiveSha256!==archive.sha256||value.frameworkId!==use.frameworkId||value.edition!==use.edition||!equal(value.sourceSha256s,use.sourceSha256s)||!sha256Pattern.test(value.destinationSourcePackSha256||'')||value.status!=='active'||!Number.isFinite(Date.parse(value.expiresAt))||Date.parse(value.expiresAt)<=instant().getTime()||typeof value.reviewedBy!=='string'||!value.reviewedBy.trim()||typeof value.statement!=='string'||value.statement.trim().length<20||value.statement.length>4000||!Number.isFinite(Date.parse(value.reviewedAt))||Date.parse(value.reviewedAt)>instant().getTime())fail(403,'An operator must record an active archive-bound legacy policy rights review for this exact User and successor.');
     state.auth.ctx.authorityDeadlines.set(`successor-review:${key.pk}:${key.sk}`,Date.parse(value.expiresAt));
     destinationSourcePackSha256=value.destinationSourcePackSha256;
     legacyReview=Object.fromEntries(['archiveSha256','frameworkId','edition','sourceSha256s','destinationSourcePackSha256','reviewedBy','reviewedAt','statement'].map(key=>[key,structuredClone(value[key])]));
    }
    const key=engagementLibraryEntitlementKey({...scope,frameworkId:use.frameworkId}),row=await get(state.auth.ctx,key.pk,key.sk);
    validateEngagementLibraryEntitlement(row,{scope,frameworkId:use.frameworkId,sourcePackSha256:destinationSourcePackSha256,sourceSha256s:use.sourceSha256s,action:'requirements',now:instant().getTime()});
    state.auth.ctx.authorityDeadlines.set(`engagement-library:${key.pk}:${key.sk}`,Date.parse(row.value.expiresAt));
    authorizations.push({...use,destinationSourcePackSha256,entitlement:row,...(legacyReview?{legacyReview}:{})});
   }
   result.set(archive.sha256,authorizations.map(({requiresMigration,sourceSha256s,...row})=>row));
  }
  return result;
 }
 async function projectState(principal,projectId,sourceIds,engagementId){
  const auth=await authenticate(principal,{enroll:false}),parent=await resourceAccess(auth,'project',id(projectId),'manage_access');await entitlement(auth,parent.target.value.workspace_id,'storage_writes');
  if(!Array.isArray(sourceIds)||sourceIds.length>100||new Set(sourceIds).size!==sourceIds.length)fail(400,'Select up to100 exact independently authorized destination documents.');sourceIds.forEach(value=>id(value));
  const value={project_id:parent.target.value.project_id,account_id:parent.target.value.account_id,workspace_id:parent.target.value.workspace_id,engagement_id:engagementId,source_artifact_ids:sourceIds},projection=await sourceProjection(auth,value);
  return {auth,parent,target:{pk:`ENGAGEMENT#${engagementId}`,sk:'PROFILE',value},...projection};
 }
 function summary(row){return {stageId:row.value.stage_id,engagementId:row.value.engagement_id,projectId:row.value.project_id,accountId:row.value.account_id,workspaceId:row.value.workspace_id,inputSha256:row.value.input_sha256,status:row.value.status,revision:row.revision,expiresAt:row.value.expires_at,partBytes:limits.partBytes,archives:row.value.archives.map(archive=>({sha256:archive.sha256,sizeBytes:archive.sizeBytes,receivedParts:(row.value.parts||[]).filter(part=>part.archiveSha256===archive.sha256).map(({offset,sizeBytes,sha256})=>({offset,sizeBytes,sha256}))}))};}
 async function stageState(principal,stageId,{rights=true,allowPromoted=false}={}){
  if(!uuidPattern.test(stageId||''))fail(400,'Choose an exact successor stage UUID.');
  const initial=await authenticate(principal,{enroll:false}),row=await get(initial.ctx,`ENGAGEMENT_SUCCESSOR_STAGE#${stageId}`,'PROFILE'),value=row?.value;
  if(!value||value.object_type!=='engagement_successor_stage'||value.stage_id!==stageId||value.actor_id!==initial.userId||value.issuer!==principal.issuer||value.subject!==principal.subject)fail(404,'The exact successor stage is unavailable to this native identity.');
  if(value.status!=='staging'&&!(allowPromoted&&value.status==='promoted'))fail(409,'This successor stage is no longer open.');
  if(value.status!=='promoted'&&Date.parse(value.expires_at)<=instant().getTime())fail(409,'This successor stage expired. Retain your originals and start a new explicit stage.');
  const state=await projectState(principal,value.project_id,value.source_artifact_ids,value.engagement_id);mergeAuthority(state.auth.ctx,initial.ctx);
  if(value.status==='staging'&&(state.sourceSha256!==value.source_sha256||state.sourceViewSha256!==value.source_view_sha256||state.parent.target.revision!==value.project_revision))fail(409,'Project configuration or destination sources changed; start a newly reviewed successor stage.');
  validateSuccessorArchiveDeclarations(value.archives,{project:state.project,sources:state.sources});
  if(!Array.isArray(value.parts)||value.parts.length>136)fail(409,'The stage contains an invalid bounded immutable part inventory.');
  const seen=new Set();for(const part of value.parts){const archive=value.archives.find(row=>row.sha256===part.archiveSha256),target=part.object,key=`${part.archiveSha256}:${part.offset}`;
   if(!archive||seen.has(key)||!Number.isSafeInteger(part.offset)||part.offset<0||part.offset%limits.partBytes||part.offset>=archive.sizeBytes||part.sizeBytes!==Math.min(limits.partBytes,archive.sizeBytes-part.offset)||!sha256Pattern.test(part.sha256||'')||!target||target.kind!=='successor_part'||target.bucket!==storage.forAccount(state.project.accountId).bucket||target.key!==engagementSuccessorPartKey({accountId:state.project.accountId,projectId:state.project.id},stageId,part.archiveSha256,part.offset)||target.sha256!==part.sha256||target.sizeBytes!==part.sizeBytes||target.contentType!=='application/octet-stream'||typeof target.versionId!=='string'||!target.versionId||target.versionId==='null')fail(409,'A staged part differs from its exact account/project/archive/offset manifest.');seen.add(key);
  }
  state.stage=row;if(rights)state.policyAuthorizations=await authorizeOrigins(state,value.archives);if(value.status==='staging')state.auth.ctx.authorityDeadlines.set(`successor-stage:${stageId}`,Date.parse(value.expires_at));return state;
 }
 async function engagementSuccessorBegin(principal,body){
  requireBody(body,['request_id','projectId','source_artifact_ids','archives']);if(!uuidPattern.test(body.request_id||''))fail(400,'Use an explicit successor stage UUID.');
  const auth=await authenticate(principal,{enroll:false}),engagementId=requestUuid(stableJson(['successor-engagement',auth.userId,body.request_id])),state=await projectState(principal,body.projectId,body.source_artifact_ids||[],engagementId);
  const archives=validateSuccessorArchiveDeclarations(body.archives,{project:state.project,sources:state.sources}),pk=`ENGAGEMENT_SUCCESSOR_STAGE#${body.request_id}`,existing=await get(state.auth.ctx,pk,'PROFILE'),inputSha=hash(stableJson(body));
  if(existing){if(existing.value.actor_id!==auth.userId||existing.value.issuer!==principal.issuer||existing.value.subject!==principal.subject||existing.value.input_sha256!==inputSha)fail(409,'That stage UUID belongs to different inputs or another identity.');await commit(state.auth.ctx);return summary(existing);}
  if(await get(state.auth.ctx,`ENGAGEMENT#${engagementId}`,'PROFILE'))fail(409,'This successor identity is already registered.');
  const row=record(pk,'PROFILE',{object_type:'engagement_successor_stage',stage_id:body.request_id,engagement_id:engagementId,actor_id:auth.userId,issuer:principal.issuer,subject:principal.subject,status:'staging',project_id:body.projectId,account_id:state.project.accountId,workspace_id:state.target.value.workspace_id,source_artifact_ids:body.source_artifact_ids||[],source_sha256:state.sourceSha256,source_view_sha256:state.sourceViewSha256,project_revision:state.parent.target.revision,input_sha256:inputSha,created_at:iso(),expires_at:new Date(instant().getTime()+limits.stageHours*3600000).toISOString(),archives,parts:[]});
  await commit(state.auth.ctx,[row]);return summary(row);
 }
 async function engagementSuccessorStage(principal,stageId){const state=await stageState(principal,stageId,{rights:false,allowPromoted:true});await commit(state.auth.ctx);return summary(state.stage);}
 async function engagementSuccessorPart(principal,stageId,archiveSha256,body){
  requireBody(body,['offset','sha256','bytes_base64']);const state=await stageState(principal,stageId),archive=state.stage.value.archives.find(row=>row.sha256===archiveSha256);
  if(!archive||!Number.isSafeInteger(body.offset)||body.offset<0||body.offset%limits.partBytes||body.offset>=archive.sizeBytes||!sha256Pattern.test(body.sha256||'')||typeof body.bytes_base64!=='string'||body.bytes_base64.length>Math.ceil(limits.partBytes/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.bytes_base64))fail(400,'Use an exact fixed-offset archive part of at most512KiB.');
  const bytes=Buffer.from(body.bytes_base64,'base64'),length=Math.min(limits.partBytes,archive.sizeBytes-body.offset);if(bytes.length!==length||hash(bytes)!==body.sha256)fail(409,'The archive part differs from its expected exact size or SHA256.');
  const prior=state.stage.value.parts.find(row=>row.archiveSha256===archiveSha256&&row.offset===body.offset);
  if(prior){if(prior.sha256!==body.sha256||prior.sizeBytes!==length)fail(409,'This offset already retains different immutable bytes.');await commit(state.auth.ctx);return summary(state.stage);}
  const manifest={kind:'successor_part',bucket:storage.forAccount(state.project.accountId).bucket,key:engagementSuccessorPartKey({accountId:state.project.accountId,projectId:state.project.id},stageId,archiveSha256,body.offset),sha256:body.sha256,sizeBytes:length,contentType:'application/octet-stream'},written=await objects.write({...manifest,bytes});
  if(written.sha256!==manifest.sha256||written.sizeBytes!==length||written.contentType!==manifest.contentType||typeof written.versionId!=='string'||!written.versionId||written.versionId==='null')fail(409,'Archive part storage returned a different immutable receipt.');
  const fresh=await stageState(principal,stageId);if(fresh.stage.revision!==state.stage.revision)fail(409,'Archive staging changed. Reload its receipts before explicitly retrying this part.');mergeAuthority(fresh.auth.ctx,state.auth.ctx);
  const row=record(state.stage.pk,'PROFILE',{...state.stage.value,parts:[...state.stage.value.parts,{archiveSha256,offset:body.offset,sizeBytes:length,sha256:body.sha256,object:{...manifest,versionId:written.versionId}}]},state.stage.revision+1);await commit(fresh.auth.ctx,[row]);return summary(row);
 }
 async function readStageArchives(state){
  const archives=new Map();for(const archive of state.stage.value.archives){const chunks=[];for(let offset=0;offset<archive.sizeBytes;offset+=limits.partBytes){const part=state.stage.value.parts.find(row=>row.archiveSha256===archive.sha256&&row.offset===offset);if(!part||part.sizeBytes!==Math.min(limits.partBytes,archive.sizeBytes-offset))fail(409,'This archive is incomplete. Upload its explicitly missing parts before construction.');const receipt=await objects.read(part.object);if(!(receipt?.bytes instanceof Uint8Array)||receipt.bytes.length!==part.sizeBytes||hash(receipt.bytes)!==part.sha256||receipt.versionId!==part.object.versionId||receipt.sha256!==part.sha256||receipt.sizeBytes!==part.sizeBytes||receipt.contentType!==part.object.contentType)fail(409,'A staged archive part failed its exact immutable receipt check.');chunks.push(Buffer.from(receipt.bytes));}const bytes=Buffer.concat(chunks);if(bytes.length!==archive.sizeBytes||hash(bytes)!==archive.sha256)fail(409,'The assembled archive differs from its exact whole-file SHA256 or size.');archives.set(archive.sha256,{bytes});}
  return archives;
 }
 async function engagementCreateSuccessor(principal,stageId,body){
  requireBody(body,['request_id','expectedRevision','sourceArchiveSha256','sourceEngagementId']);let state=await stageState(principal,stageId,{allowPromoted:true});
  if(state.stage.value.status==='promoted'&&state.stage.value.request_id!==body.request_id)fail(409,'This stage already constructed its one successor. Reopen that saved engagement.');
  const request=await reservation(principal,body.request_id,{operation:'successor',stageId,...body});if(request.value.status==='promoted'){if(request.value.engagement_id!==state.stage.value.engagement_id)fail(409,'This request belongs to another successor.');return getEngagement(principal,request.value.engagement_id);}
  if(state.stage.value.status!=='staging'||body.expectedRevision!==state.stage.revision||!state.stage.value.archives.some(row=>row.sha256===body.sourceArchiveSha256))fail(409,'Review the exact complete stage revision and source archive before construction.');
  const originArchives=await readStageArchives(state),manifests=[],inspections=[];
  for(const declaration of state.stage.value.archives){const inspected=inspectEngagementSuccessorArchive({...originArchives.get(declaration.sha256),expectedSha256:declaration.sha256,originArchives});assertEngagementOriginInventory(declaration,inspected);inspections.push(inspected);const object={kind:'origin',bucket:storage.forAccount(state.project.accountId).bucket,key:engagementOriginKey({accountId:state.project.accountId,projectId:state.project.id},declaration.sha256),sha256:declaration.sha256,sizeBytes:declaration.sizeBytes,contentType:'application/json',versionId:'pending'};manifests.push({...declaration,archive:inspected.archive,object});}
  // Private archive labels never grant intake rights. Existing native case
  // protection must precede any mapped original read or retained origin write.
  const protection=collectEngagementCaseProtection({project:inspections[0].project,packages:inspections.flatMap(row=>row.packages),originArchives}),protectedHashes=new Map();
  for(const binding of protection.bindings){if(!protectedHashes.has(binding.sourceSha256))protectedHashes.set(binding.sourceSha256,new Set());for(const group of binding.groups)protectedHashes.get(binding.sourceSha256).add(group);}
  const protectedSources={sources:[...protectedHashes].map(([sha256,groups])=>({sha256,groups:[...groups].sort(),versionIds:[...new Set(manifests.flatMap(row=>row.sourceMappings.filter(source=>source.sha256===sha256).map(source=>source.destinationVersionId)))].sort()})),archiveSha256s:manifests.map(row=>row.sha256).sort()};
  async function admit(current){if(!protectedSources.sources.length)return;if(typeof d.assertProtectedSuccessorSources!=='function')fail(503,'Protected case originals need current native protected intake before this review can be created.');await d.assertProtectedSuccessorSources(current,protectedSources);}
  await admit(state);
  validateEngagementOriginManifests(manifests,{scope:scopeOf(state),storage,project:state.project,sources:state.sources});
  for(const manifest of manifests){const {versionId:pending,...object}=manifest.object,receipt=await objects.write({...object,bytes:originArchives.get(manifest.sha256).bytes});if(receipt.sha256!==object.sha256||receipt.sizeBytes!==object.sizeBytes||receipt.contentType!==object.contentType||typeof receipt.versionId!=='string'||!receipt.versionId||receipt.versionId==='null')fail(409,'The retained origin differs from its exact immutable archive manifest.');manifest.object={...object,versionId:receipt.versionId};}
  const selected=state.stage.value.archives.find(row=>row.sha256===body.sourceArchiveSha256);
  const originals=await loadOriginals(state),evaluated=domain(()=>evaluate({project:state.project,packages:[],originals,originArchives,actorId:state.auth.userId,authority:authOf(state.auth),currentTime:instant().getTime(),execution:{requestId:body.request_id,at:request.value.at},input:{operation:'successor',engagementId:state.stage.value.engagement_id,workspaceId:state.target.value.workspace_id,...(body.sourceEngagementId?{sourceEngagementId:body.sourceEngagementId}:{}),archive:{bytes:originArchives.get(selected.sha256).bytes,sha256:selected.sha256},sourceMappings:selected.sourceMappings.map(({sourceVersionId,destinationVersionId})=>({sourceVersionId,destinationVersionId})),policyAuthorizations:state.policyAuthorizations.get(selected.sha256)}}));
  // Reject unrelated extra archives; the complete proof closure is exact.
  if(!equal(evaluated.originArchiveDescriptors.map(row=>row.sha256).sort(),manifests.map(row=>row.sha256).sort()))fail(409,'Stage exactly the required origin ancestry; unrelated archives cannot be attached.');
  state={...state,originArchives,originManifests:manifests,packages:[],originals,sourceMetadata:[]};const prepared=await preparedObject(state,evaluated,request),core=prepared.core,fresh=await stageState(principal,stageId);
  if(fresh.stage.revision!==state.stage.revision)fail(409,'The stage changed while constructing the successor. Review its latest receipts.');mergeAuthority(fresh.auth.ctx,state.auth.ctx);
  await admit(fresh);
  const pk=`ENGAGEMENT#${core.id}`;if(await get(fresh.auth.ctx,pk,'PROFILE'))fail(409,'This successor identity is already registered.');await get(fresh.auth.ctx,pk,'HEAD');
  const value={...state.target.value,object_type:'engagement_resource',name:core.name,status:'active',owner_user_id:state.auth.userId,professional_roles:core.roles,resource:assertCollaborationResource({schema_version:1,resource_type:'engagement',resource_id:core.id,workspace_id:state.target.value.workspace_id,project_id:state.project.id,owner_id:state.auth.userId,creator_id:state.auth.userId,access_policy:{inheritance:'restricted',allow_public_links:false}})},profile=record(pk,'PROFILE',value);assertEngagementProfile(profile);
  const hints=[record(`USER#${state.auth.userId}`,`RESOURCE#engagement#${core.id}`,{resource_id:core.id}),record(`PROJECT#${state.project.id}`,`ENGAGEMENT#${core.id}`,{resource_id:core.id})];for(const hint of hints)await get(fresh.auth.ctx,hint.pk,hint.sk);
  const writes=await promotedWrites(fresh.auth,{target:profile,head:null,originManifests:manifests},prepared,request);
  await commit(fresh.auth.ctx,[profile,...hints,...writes,record(state.stage.pk,'PROFILE',{...state.stage.value,status:'promoted',request_id:body.request_id},state.stage.revision+1)]);return getEngagement(principal,core.id);
 }
 async function engagementOrigin(principal,engagementId,archiveSha256,{engagementId:historicalEngagementId,renditionId}={}){
  // The full original may contain protected cases. Only the current resource
  // manager can retrieve it; an invitation's view grant never reveals it.
  const state=await load(principal,engagementId,{action:'manage_access'});await d.authorizeHistory?.(state);const archive=state.originManifests.find(row=>row.sha256===archiveSha256);if(!archive)fail(404,'This exact origin archive is not part of the engagement ancestry.');
  const bytes=state.originArchives.get(archiveSha256).bytes;let result;
  if(renditionId){const inspected=inspectEngagementSuccessorArchive({bytes,expectedSha256:archiveSha256,originArchives:state.originArchives}),pack=inspected.packages.find(row=>row.engagement.id===historicalEngagementId),issued=pack?.issuedRenditions?.find(row=>row.id===renditionId);if(!issued)fail(404,'The exact historical issued rendition is unavailable.');const output=Buffer.from(issued.contentBase64,'base64');if(hash(output)!==issued.sha256||output.length!==issued.size)fail(409,'The historical issued bytes differ from their original manifest.');result={bytes:output,sha256:issued.sha256,filename:issued.filename,mediaType:issued.mediaType,metadata:Object.fromEntries(Object.entries(issued).filter(([key])=>key!=='contentBase64'))};}
  else result={bytes:Buffer.from(bytes),sha256:archiveSha256,filename:`engagement-origin-${archiveSha256}.json`,mediaType:'application/json',archive:archive.archive};
  const fresh=await metadata(principal,engagementId,{action:'manage_access'});if(!equal(fresh.head,state.head)||!equal(fresh.target,state.target)||fresh.sourceSha256!==state.sourceSha256||fresh.sourceViewSha256!==state.sourceViewSha256)fail(409,'Current successor authority changed while opening historical records.');await d.authorizeHistory?.(fresh);mergeAuthority(fresh.auth.ctx,state.auth.ctx);await commit(fresh.auth.ctx);return result;
 }
 async function engagementOriginTransfer(principal,engagementId,archiveSha256,body){
  const state=await metadata(principal,engagementId,{action:'manage_access'});await d.authorizeHistory?.(state);const archive=state.originManifests.find(row=>row.sha256===archiveSha256);if(!archive)fail(404,'The exact original archive is outside this successor ancestry.');
  const manifest={mediated:true,version_id:archive.object.versionId,sha256:archive.sha256,size_bytes:archive.sizeBytes,filename:`engagement-origin-${archive.sha256}.json`,content_type:'application/json',head_sha256:state.head.value.snapshot.sha256,configuration_revision:state.target.revision,archive:archive.archive};
  if(body===undefined){await commit(state.auth.ctx);return manifest;}
  requireBody(body,['version_id','sha256','size_bytes','head_sha256','configuration_revision','offset','length']);
  if(['version_id','sha256','size_bytes','head_sha256','configuration_revision'].some(key=>body[key]!==manifest[key])||!Number.isSafeInteger(body.offset)||body.offset<0||!Number.isSafeInteger(body.length)||body.length<1||body.length>limits.partBytes||body.offset+body.length>archive.sizeBytes)fail(409,'Use an exact bounded range of the reviewed immutable archive manifest.');
  if(typeof objects.readRange!=='function')fail(503,'Bounded historical archive transfer is not configured.');const bytes=await objects.readRange({...archive.object,offset:body.offset,length:body.length});if(!(bytes instanceof Uint8Array)||bytes.length!==body.length)fail(409,'The historical archive range is incomplete.');
  const fresh=await metadata(principal,engagementId,{action:'manage_access'});if(!equal(fresh.head,state.head)||!equal(fresh.target,state.target)||fresh.sourceSha256!==state.sourceSha256||fresh.sourceViewSha256!==state.sourceViewSha256)fail(409,'Current successor authority changed while transferring historical bytes.');await d.authorizeHistory?.(fresh);mergeAuthority(fresh.auth.ctx,state.auth.ctx);await commit(fresh.auth.ctx);return {version_id:archive.object.versionId,sha256:archive.sha256,size_bytes:archive.sizeBytes,offset:body.offset,length:body.length,bytes_base64:Buffer.from(bytes).toString('base64')};
 }
 async function engagementOrigins(principal,engagementId){const state=await metadata(principal,engagementId,{action:'manage_access'});await d.authorizeHistory?.(state);await commit(state.auth.ctx);return state.originManifests.map(({sha256,sizeBytes,archive,sourceMappings,policyUses})=>({sha256,sizeBytes,archive,sourceMappings,policyUses}));}
 return {authorizeOrigins,engagementSuccessorBegin,engagementSuccessorStage,engagementSuccessorPart,engagementCreateSuccessor,engagementOrigin,engagementOriginTransfer,engagementOrigins};
}
