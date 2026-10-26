// User-initiated field preparation and ingestion. Canonical permissions and
// metadata CAS remain in the access store; bytes use the existing original path.
import {createHash} from 'node:crypto';
import {createAuthenticatedOfflineAssessmentOperations} from './authenticated-offline-assessment-operations.mjs';
import {authenticatedFieldPolicies,engagementFieldLeaseKey,issueEngagementFieldLease,validateEngagementFieldLease} from './engagement-field-lease.mjs';
import {prepareAuthenticatedFieldCapture,authenticatedFieldCaptureLimits} from './engagement-field-capture.mjs';
import {assertFieldCaptureCommit,fieldCaptureCommitDescriptor,fieldCaptureReviewKey,assertPendingFieldRequest,buildFieldCaptureSaveReview,assertFieldCaptureSaveReviewState} from './field-capture-recovery.mjs';
import {applyEngagementSourceMetadata} from './engagement-source-metadata.mjs';
import {loadEngagementOriginals} from './engagement-sources.mjs';
import {hostedFieldMetadata,assertHostedFieldManifest,fieldUploadPolicy} from '../src/lib/hosted-field-capture-model.js';
import {validateAuthenticatedFieldLinks} from '../src/lib/engagement-field-evidence.js';
import {stableJson,uuidPattern} from '../src/lib/engagement-domain.js';
import {engagementCaseAccessKey,engagementCaseSourceKey,engagementCaseGroups,assertEngagementCaseAccess,mergeEngagementCaseSources,validateEngagementCaseSources} from './engagement-case-access.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function createAuthenticatedFieldOperations(deps){
 const {resourceAuthority,objects,storage,intakeAuthority,load,assess,authorityView,response,sameHead,mergeAuthority,requireBody,domain,asyncDomain,reservation,preparedObject,promotedWrites,sourceProjection,get,commit,record,instant,fail,id,requestUuid,authOf,evaluate,assertEngagementProfile,engagementProject,getEngagement,compoundResponse,fieldPolicy,disclosureFor,authorizeSource,proofForExpansion}=deps;
 const authors={action:'edit',requiredRoles:['preparer','reviewer']};
 const scope=state=>({accountId:state.target.value.account_id,projectId:state.target.value.project_id,workspaceId:state.target.value.workspace_id,engagementId:state.target.value.engagement_id,userId:state.auth.userId});
 async function authority(principal,engagementId){
  const state=await intakeAuthority(principal,engagementId),policy=await fieldPolicy(state);
  state.fieldPolicies=domain(()=>authenticatedFieldPolicies({engagementPolicy:policy,projectPolicy:state.projectRow.value.field_capture_policy}));return state;
 }
 async function caseAuthority(state,caseIds){
  if(!caseIds?.length)return;const key=engagementCaseAccessKey(state.target.value.engagement_id),policy=await get(state.auth.ctx,key.pk,key.sk),nativeScope=scope(state);delete nativeScope.userId;
  for(const caseId of caseIds){const permission=assertEngagementCaseAccess(policy,{scope:nativeScope,caseId,userId:state.auth.userId,groups:engagementCaseGroups,action:'update',now:instant().getTime()});state.auth.ctx.authorityDeadlines.set(`field-case:${caseId}`,Date.parse(permission.expiresAt));}
  return {caseIds:[...caseIds].sort(),aclRevision:policy.revision};
 }
 function assertCaseLinks(record,proof){if(!record)return;const linked=[...new Set([...(record.links?.grievanceIds||[]),record.links?.context?.grievanceId].filter(Boolean))].sort(),bound=proof.caseScope?.caseIds||[];if(stableJson(linked)!==stableJson(bound))fail(403,'Prepare a separate case-specific field context before uploading case-linked originals. A general field permission cannot add or change protected cases.');}
 async function leaseFor(state,leaseId,{sensitivity,includesOriginals=false}={}){
  const key=domain(()=>engagementFieldLeaseKey(state.target.value.engagement_id,leaseId)),row=await get(state.auth.ctx,key.pk,key.sk);
  const proof=domain(()=>validateEngagementFieldLease(row,{scope:scope(state),issuer:state.auth.principal.issuer,subject:state.auth.principal.subject,policies:state.fieldPolicies,now:instant().getTime(),sensitivity,includesOriginals}));
  await caseAuthority(state,proof.caseScope?.caseIds);
  state.auth.ctx.authorityDeadlines.set(`engagement-field-lease:${key.pk}:${key.sk}`,Date.parse(proof.expiresAt));return {row,proof};
 }
 async function fieldRegistrationAuthority({auth,project,field,captureRecord,source}){
  if(!uuidPattern.test(field.engagementId||'')||!uuidPattern.test(field.leaseId||''))fail(400,'Use the exact engagement and server field permission.');
  const state=await authority(auth.principal,field.engagementId);
  if(state.auth.userId!==auth.userId||state.projectRow.pk!==project?.pk||state.projectRow.revision!==project.revision||stableJson(state.projectRow.value)!==stableJson(project.value))fail(403,'The field registration belongs to another current project or identity.');
  const {proof}=await leaseFor(state,field.leaseId,{sensitivity:captureRecord?.sensitivity,includesOriginals:field.role==='original'||Boolean(captureRecord?.attachments?.length)});
  assertCaseLinks(captureRecord,proof);const extraWrites=[];
  if(proof.caseScope){
   if(!source||!/^([a-f0-9]{64})$/.test(source.sha256||'')||typeof source.artifactId!=='string')fail(403,'A case original requires its exact security reservation before upload.');
   const key=engagementCaseSourceKey(state.project.id),prior=await get(state.auth.ctx,key.pk,key.sk);validateEngagementCaseSources(prior,{scope:scope(state)});
   if(source.register){const next=mergeEngagementCaseSources({row:prior,scope:scope(state),bindings:proof.caseScope.caseIds.map(caseId=>({engagementId:state.target.value.engagement_id,caseId,groups:engagementCaseGroups,sourceSha256:source.sha256,versionIds:[`pending:${source.sha256}`]}))});if(stableJson(prior.value)!==stableJson(next.value))extraWrites.push(next);}
   else for(const caseId of proof.caseScope.caseIds)if(!prior.value.bindings.some(binding=>binding.engagementId===state.target.value.engagement_id&&binding.caseId===caseId&&binding.sourceSha256===source.sha256&&engagementCaseGroups.every(group=>binding.groups.includes(group))))fail(403,'Register this case original with its exact protected scope before requesting an upload or finalization.');
  }
  domain(()=>fieldUploadPolicy(project.value,{leaseProof:proof}));mergeAuthority(auth.ctx,state.auth.ctx);return {...proof,extraWrites};
 }
 function responseGuard(engagementId,leaseId){return async state=>{const current=await authority(state.auth.principal,engagementId);sameHead(state,current);if(leaseId)await leaseFor(current,leaseId);mergeAuthority(state.auth.ctx,current.auth.ctx);};}
 async function context(principal,engagementId){
  const initial=await authority(principal,engagementId),state=await load(principal,engagementId,authors);sameHead(initial,state);
  const view=assess(state,{operation:'get',engagementId}).result,current=await authority(principal,engagementId);sameHead(state,current);
  const disclosed=disclosureFor(state,view,{project:state.project}),engagement=await authorityView(current,disclosed.view),result={engagement,project:disclosed.project,uploadProject:current.uploadProject,serverAuthority:engagement.serverAuthority,devicePolicy:current.fieldPolicies.devicePolicy,policySha256:current.fieldPolicies.policySha256,policySource:current.fieldPolicies.policySource,capabilities:{offline:current.fieldPolicies.devicePolicy.offlineAllowed,originals:current.fieldPolicies.devicePolicy.allowSourceOriginals,save:true}};mergeAuthority(current.auth.ctx,state.auth.ctx);
  await response(current,engagement);await response(current,result,responseGuard(engagementId));return {state:current,result};
 }
 async function engagementFieldContext(principal,engagementId){const prepared=await context(principal,engagementId);await commit(prepared.state.auth.ctx);return prepared.result;}
 async function engagementPrepareFieldContext(principal,engagementId,body){
  requireBody(body,['request_id','reviewedPolicySha256','renewLeaseId','selection']);
  const initial=await authority(principal,engagementId);
  if(body.reviewedPolicySha256!==initial.fieldPolicies.policySha256)fail(409,'Review the current field device rules before preparing this device.');
  const request=await reservation(principal,body.request_id,{engagementId,operation:'prepare-field-context',reviewedPolicySha256:body.reviewedPolicySha256,...(body.renewLeaseId?{renewLeaseId:body.renewLeaseId}:{}),...(body.selection?{selection:body.selection}:{})}),leaseId=body.renewLeaseId||body.request_id;
  const key=domain(()=>engagementFieldLeaseKey(engagementId,leaseId)),prepared=await context(principal,engagementId),current=prepared.state;sameHead(initial,current);
  requireBody(body.selection||{},['programId','cycleId','missionId','siteId','grievanceId','commitmentId','requirementId']);
  const links=domain(()=>validateAuthenticatedFieldLinks({assessmentIds:[],actionIds:[],requirement:null,context:{engagementId,...(body.selection||{})}},prepared.result.engagement));prepared.result.selection=Object.fromEntries(Object.entries(links.context).filter(([key])=>key!=='engagementId'));
  const caseScope=await caseAuthority(current,links.context.grievanceId?[links.context.grievanceId]:undefined);
  const previous=await get(current.auth.ctx,key.pk,key.sk);let row;
  if(request.value.status==='promoted'){
   if(request.value.field_lease_id!==leaseId)fail(409,'This operation identifies another field permission.');
   await leaseFor(current,leaseId);row=previous;
  }else{
   if(previous&&!body.renewLeaseId)fail(409,'This field permission already exists. Explicitly review and renew it.');
   if(body.renewLeaseId&&!previous)fail(404,'The field permission selected for renewal is unavailable.');
   const authorityUntil=Math.min(principal.expiresAt,current.projectAccess.authorityUntil??Infinity,...current.auth.ctx.authorityDeadlines.values());
   row=domain(()=>issueEngagementFieldLease({leaseId,scope:scope(current),issuer:principal.issuer,subject:principal.subject,policies:current.fieldPolicies,at:request.value.at,authorityUntil,previous,caseScope}));
   current.auth.ctx.authorityDeadlines.set(`prepared-field:${leaseId}`,Date.parse(row.value.expiresAt));
   const pending=await get(current.auth.ctx,request.pk,'PROFILE');if(pending?.revision!==request.revision||pending.value.status!=='pending')fail(409,'Field preparation changed. Review its saved result before retrying.');
   await commit(current.auth.ctx,[row,record(request.pk,'PROFILE',{...pending.value,status:'promoted',field_lease_id:leaseId,engagement_id:engagementId},pending.revision+1)]);
  }
  if(request.value.status==='promoted')await commit(current.auth.ctx);
  const result={context:prepared.result,leaseId,leaseRevision:row.revision,deviceLease:row.value.deviceLease,...(row.value.caseScope?{caseScope:structuredClone(row.value.caseScope)}:{})};await response(current,result,responseGuard(engagementId,leaseId));return result;
 }
 async function original(state,artifactId,maxBytes){
  id(artifactId);const expanded=await sourceProjection(state.auth,{...state.target.value,source_artifact_ids:[artifactId]}),source=[...expanded.sources.values()][0];
  if(!source||source.sizeBytes<1||source.sizeBytes>maxBytes)fail(413,'This field original exceeds its supported transfer size.');
  await authorizeSource({...state,...expanded},[...expanded.sources.keys()][0]);
  const row=await get(state.auth.ctx,`DOCUMENT#${artifactId}`,'PROFILE'),retained=await objects.read(source);
  if(!(retained.bytes instanceof Uint8Array)||retained.bytes.byteLength!==source.sizeBytes||hash(retained.bytes)!==source.sha256)fail(409,'The field original differs from its verified byte identity.');return {row,bytes:retained.bytes};
 }
 async function readManifest(state,artifactId){
  const manifest=await original(state,artifactId,authenticatedFieldCaptureLimits.manifestBytes);let payload;
  try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(manifest.bytes));assertHostedFieldManifest(payload,{resourceAuthority,projectId:state.project.id,accountId:state.project.accountId,workspaceId:state.target.value.workspace_id,forUpload:true});}catch(error){fail(409,error.message);}
  const field=manifest.row.value.original_metadata?.[hostedFieldMetadata];
  if(field?.engagementId!==state.target.value.engagement_id||field?.leaseId===undefined||field.captureId!==payload.record.captureId||field.recordSha256!==payload.recordSha256||manifest.row.value.created_by!==state.auth.userId||manifest.row.value.original.finalized_by!==state.auth.userId)fail(403,'This field manifest belongs to another engagement or verified uploader.');
  return {manifest,payload,field};
 }
 async function engagementReviewFieldCapture(principal,engagementId,body){
  requireBody(body,['request_id','pendingCommand']);const command=domain(()=>assertFieldCaptureCommit(body.pendingCommand));
  const initial=await authority(principal,engagementId);await leaseFor(initial,command.leaseId);
  const request=await reservation(principal,body.request_id,{engagementId,operation:'field-capture-review',pendingCommand:command}),state=await load(principal,engagementId,authors);sameHead(initial,state);state.fieldPolicies=initial.fieldPolicies;
  const {manifest,payload,field}=await readManifest(state,command.manifest_artifact_id);if(field.leaseId!==command.leaseId)fail(409,'The pending save selects another field permission.');
  assertCaseLinks(payload.record,(await leaseFor(state,command.leaseId)).proof);
  const pendingRow=await get(state.auth.ctx,`ENGAGEMENT_REQUEST#${command.request_id}`,'PROFILE'),pending=domain(()=>assertPendingFieldRequest(pendingRow,{principal,userId:state.auth.userId,engagementId,command})),markerKey={pk:state.target.pk,sk:`FIELD_CAPTURE#${id(payload.record.captureId)}`},marker=await get(state.auth.ctx,markerKey.pk,markerKey.sk);
  if(marker&&(marker.value.manifest_artifact_id!==command.manifest_artifact_id||marker.value.manifest_sha256!==hash(manifest.bytes)||marker.value.lease_id!==command.leaseId||marker.value.actor_id!==state.auth.userId))fail(409,'This capture identity selects another retained observation.');
  const media=[];for(const item of payload.media)media.push(await original(state,item.reference.resource_id,authenticatedFieldCaptureLimits.mediaBytes));
  const checked=await leaseFor(state,command.leaseId,{sensitivity:payload.record.sensitivity,includesOriginals:media.length>0});
  if(!marker)domain(()=>prepareAuthenticatedFieldCapture({resourceAuthority,engagement:assess(state,{operation:'get',engagementId}).result,projectRow:state.projectRow,accountStorage:storage,manifest,media,actorId:state.auth.userId,authentication:{userId:state.auth.userId,issuer:principal.issuer,subject:principal.subject},lease:checked.proof,receivedAt:request.value.at,now:instant().getTime()}));
  const prepared=await context(principal,engagementId),current=prepared.state;sameHead(state,current);mergeAuthority(current.auth.ctx,state.auth.ctx);
  const finalLease=await leaseFor(current,command.leaseId,{sensitivity:payload.record.sensitivity,includesOriginals:media.length>0});if(finalLease.row.revision!==checked.row.revision)fail(409,'Field permission changed while this save was reviewed.');
  let recoveryIssue=false;if(command.recovery&&!marker){const priorKey=domain(()=>fieldCaptureReviewKey(engagementId,command.recovery.reviewId)),priorReview=await get(current.auth.ctx,priorKey.pk,priorKey.sk);try{assertFieldCaptureSaveReviewState(priorReview,{principal,userId:current.auth.userId,engagementId,command,state:current,lease:finalLease.proof,manifestSha256:hash(manifest.bytes),now:instant().getTime()});}catch(error){if(error.statusCode!==409)throw error;recoveryIssue=true;}}
  const key=domain(()=>fieldCaptureReviewKey(engagementId,body.request_id)),previous=await get(current.auth.ctx,key.pk,key.sk);
  let proof;
  if(previous){
   if(previous.value.actor_id!==current.auth.userId||previous.value.issuer!==principal.issuer||previous.value.subject!==principal.subject||stableJson(previous.value.pending_command)!==stableJson(command)||previous.value.proof.headSha256!==current.head.value.snapshot.sha256||Date.parse(previous.value.proof.expiresAt)<=instant().getTime())fail(409,'This field-save review changed or expired. Check the saved record again.');proof=previous.value.proof;
  }else{
   if(request.value.status==='promoted')fail(409,'The saved field review is unavailable.');
   proof=domain(()=>buildFieldCaptureSaveReview({id:body.request_id,state:{...state,...current,packages:state.packages},lease:finalLease.proof,command,payload,manifestSha256:hash(manifest.bytes),pending,captureReceipt:marker?.value.receipt,recoveryIssue,at:request.value.at}));
   const review=record(key.pk,key.sk,{object_type:'engagement_field_capture_review',status:'active',actor_id:current.auth.userId,issuer:principal.issuer,subject:principal.subject,pending_command:command,pending_request:pendingRow,proof});
   const activeRequest=await get(current.auth.ctx,request.pk,'PROFILE');if(activeRequest?.revision!==request.revision||activeRequest.value.status!=='pending')fail(409,'The field review request changed.');
   await commit(current.auth.ctx,[review,record(request.pk,'PROFILE',{...activeRequest.value,status:'promoted',engagement_id:engagementId,field_review_id:proof.id},activeRequest.revision+1)]);
  }
  if(previous)await commit(current.auth.ctx);
  prepared.result.selection=Object.fromEntries(Object.entries(payload.record.links.context||{}).filter(([key])=>['programId','cycleId','missionId','siteId','grievanceId','commitmentId','requirementId'].includes(key)));
  const result={context:prepared.result,captureReview:proof};await response(current,result,responseGuard(engagementId,command.leaseId));return result;
 }
 async function recoveryState(state,body,manifestSha256,lease){
  if(!body.recovery)return null;
  const key=domain(()=>fieldCaptureReviewKey(state.target.value.engagement_id,body.recovery.reviewId)),row=await get(state.auth.ctx,key.pk,key.sk),reviewed=domain(()=>assertFieldCaptureSaveReviewState(row,{principal:state.auth.principal,userId:state.auth.userId,engagementId:state.target.value.engagement_id,command:body,state,lease,manifestSha256,now:instant().getTime()}));
  const pending=await get(state.auth.ctx,`ENGAGEMENT_REQUEST#${reviewed.pendingCommand.request_id}`,'PROFILE');domain(()=>assertPendingFieldRequest(pending,{principal:state.auth.principal,userId:state.auth.userId,engagementId:state.target.value.engagement_id,command:reviewed.pendingCommand}));
  if(stableJson(pending)!==stableJson(row.value.pending_request))fail(409,'The earlier save changed after review. Check whether the observation has already been saved.');
  state.auth.ctx.authorityDeadlines.set(`field-save-review:${reviewed.proof.id}`,Date.parse(reviewed.proof.expiresAt));return {row,pending,...reviewed};
 }
 async function resultFor(principal,engagementId,captureReceipt){return compoundResponse({project:await engagementProject(principal,engagementId),engagement:await getEngagement(principal,engagementId),captureReceipt});}
 async function engagementAttachFieldCapture(principal,engagementId,body){
  domain(()=>assertFieldCaptureCommit(body));
  const initial=await authority(principal,engagementId);await leaseFor(initial,body.leaseId);
  const request=await reservation(principal,body.request_id,domain(()=>fieldCaptureCommitDescriptor(engagementId,body)));
  const state=await load(principal,engagementId,authors);sameHead(initial,state);state.fieldPolicies=initial.fieldPolicies;
  const {manifest,payload}=await readManifest(state,body.manifest_artifact_id);
  assertCaseLinks(payload.record,(await leaseFor(state,body.leaseId)).proof);
  const markerKey={pk:state.target.pk,sk:`FIELD_CAPTURE#${id(payload.record.captureId)}`},marker=await get(state.auth.ctx,markerKey.pk,markerKey.sk);
  if(marker){
   if(marker.value.manifest_artifact_id!==body.manifest_artifact_id||marker.value.manifest_sha256!==hash(manifest.bytes)||marker.value.lease_id!==body.leaseId||marker.value.actor_id!==state.auth.userId)fail(409,'This capture identity already selects another immutable record.');
   const current=await authority(principal,engagementId);sameHead(state,current);await leaseFor(current,body.leaseId,{sensitivity:payload.record.sensitivity,includesOriginals:payload.media.length>0});const currentMarker=await get(current.auth.ctx,markerKey.pk,markerKey.sk);if(stableJson(currentMarker)!==stableJson(marker))fail(409,'The saved capture acknowledgement changed.');const pending=await get(current.auth.ctx,request.pk,'PROFILE');await commit(current.auth.ctx,pending?.value.status==='pending'?[record(request.pk,'PROFILE',{...pending.value,status:'promoted',engagement_id:engagementId,capture_id:payload.record.captureId},pending.revision+1)]:[]);return resultFor(principal,engagementId,marker.value.receipt);
  }
  if(request.value.status==='promoted')fail(409,'The acknowledged capture marker is unavailable.');
  const media=[];for(const item of payload.media)media.push(await original(state,item.reference.resource_id,authenticatedFieldCaptureLimits.mediaBytes));
  const {proof}=await leaseFor(state,body.leaseId,{sensitivity:payload.record.sensitivity,includesOriginals:media.length>0});
  const recovery=await recoveryState(state,body,hash(manifest.bytes),proof);
  const view=assess(state,{operation:'get',engagementId}).result,preparedCapture=domain(()=>prepareAuthenticatedFieldCapture({resourceAuthority,engagement:view,projectRow:state.projectRow,accountStorage:storage,manifest,media,actorId:state.auth.userId,authentication:{userId:state.auth.userId,issuer:principal.issuer,subject:principal.subject},lease:proof,receivedAt:request.value.at,now:instant().getTime()}));
  const artifactIds=[...new Set([...state.target.value.source_artifact_ids,...preparedCapture.sourceArtifactIds])],expanded=await sourceProjection(state.auth,{...state.target.value,source_artifact_ids:artifactIds}),project=domain(()=>applyEngagementSourceMetadata({project:expanded.project,engagementId,sourceMetadata:state.sourceMetadata}));
  for(const versionId of preparedCapture.sourceVersionIds)await authorizeSource({...state,...expanded,project},versionId);
  const newOriginals=await asyncDomain(()=>loadEngagementOriginals({sources:expanded.sources,versionIds:preparedCapture.sourceVersionIds,readSource:target=>objects.read(target)})),originals=new Map([...state.originals,...newOriginals]);
  let retainedSourceProof=proofForExpansion(state,{project,sources:expanded.sources});
  const versionIds=preparedCapture.sourceVersionIds.filter(version=>!state.sources.has(version));let packages=state.packages,expectedRevision=body.expectedRevision;
  if(versionIds.length){const registered=domain(()=>evaluate({project,packages,originals,originArchives:state.originArchives||new Map(),retainedSourceProof,actorId:state.auth.userId,authority:authOf(state.auth),execution:{requestId:requestUuid(stableJson([body.request_id,'field-register'])),at:request.value.at},input:{operation:'command',engagementId,expectedRevision,command:{type:'register-sources',versionIds}},commandOptions:{sourceRegistration:true}}));packages=registered.packages;expectedRevision=packages[0].engagement.revision;retainedSourceProof=registered.retainedSourceProof;}
  const evaluated=domain(()=>evaluate({project,packages,originals,originArchives:state.originArchives||new Map(),retainedSourceProof,actorId:state.auth.userId,authority:authOf(state.auth),execution:{requestId:requestUuid(stableJson([body.request_id,'field-assertion'])),at:request.value.at},input:{operation:'command',engagementId,expectedRevision,command:preparedCapture.assertionCommand},commandOptions:{fieldCaptureBinding:preparedCapture.fieldCaptureBinding}}));
  const assertion=evaluated.packages[0].entities.assertions.find(row=>row.fieldCapture?.captureId===preparedCapture.captureId);if(!assertion)fail(409,'The retained field assertion was not created.');
  const prepared=await preparedObject({...state,...expanded,project},evaluated,request),current=await authority(principal,engagementId);sameHead(state,current);
  const finalLease=await leaseFor(current,body.leaseId,{sensitivity:payload.record.sensitivity,includesOriginals:media.length>0});if(finalLease.row.revision!==proof.revision)fail(409,'The field permission changed while this record was being saved.');
  const finalRecovery=await recoveryState(current,body,hash(manifest.bytes),finalLease.proof);if(Boolean(recovery)!==Boolean(finalRecovery))fail(409,'Field recovery changed while saving.');
  const freshExpanded=await sourceProjection(current.auth,{...current.target.value,source_artifact_ids:artifactIds});if(expanded.sourceSha256!==freshExpanded.sourceSha256||expanded.sourceViewSha256!==freshExpanded.sourceViewSha256)fail(409,'A field original changed while this capture was being saved.');
  if(await get(current.auth.ctx,markerKey.pk,markerKey.sk))fail(409,'This capture was saved by another operation. Reopen its saved record.');
  const value=manifest.row.value,binding=preparedCapture.fieldCaptureBinding,receipt={acknowledged:true,captureId:preparedCapture.captureId,manifestArtifactId:body.manifest_artifact_id,manifestVersionId:binding.manifest.versionId,sha256:binding.manifest.sha256,sourceVersionIds:preparedCapture.sourceVersionIds,assertionId:assertion.id,leaseId:proof.id,leaseRevision:proof.revision,engagementId,projectId:state.project.id,accountId:state.project.accountId,resourceId:body.manifest_artifact_id,versionId:value.original.reference.version_id,authority:resourceAuthority,resourceType:'document_original',reference:value.original.reference,media:payload.media};
  const profile=record(current.target.pk,'PROFILE',{...current.target.value,source_artifact_ids:artifactIds},current.target.revision+(artifactIds.length!==state.target.value.source_artifact_ids.length?1:0));
  assertEngagementProfile(profile);
  const captureMarker=record(markerKey.pk,markerKey.sk,{object_type:'engagement_field_capture',capture_id:preparedCapture.captureId,manifest_artifact_id:body.manifest_artifact_id,manifest_sha256:binding.manifest.sha256,record_sha256:binding.recordSha256,lease_id:proof.id,actor_id:state.auth.userId,receipt});
  const recoveryWrites=finalRecovery?[record(finalRecovery.row.pk,finalRecovery.row.sk,{...finalRecovery.row.value,status:'consumed',replacement_request_id:body.request_id,consumed_at:request.value.at},finalRecovery.row.revision+1),...(finalRecovery.pending?[record(finalRecovery.pending.pk,finalRecovery.pending.sk,{...finalRecovery.pending.value,status:'superseded',replacement_request_id:body.request_id,field_review_id:finalRecovery.proof.id},finalRecovery.pending.revision+1)]:[])]:[];
  await commit(current.auth.ctx,[...(profile.revision!==current.target.revision?[profile]:[]),captureMarker,...recoveryWrites,...await promotedWrites(current.auth,current,prepared,request)]);return resultFor(principal,engagementId,receipt);
 }
 const offlineOperations=createAuthenticatedOfflineAssessmentOperations({...deps,authority,leaseFor,context,responseGuard});
 return {...offlineOperations,engagementFieldContext,engagementPrepareFieldContext,engagementAttachFieldCapture,engagementReviewFieldCapture,fieldRegistrationAuthority};
}
