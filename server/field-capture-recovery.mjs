// Pure request/review checks. Only the adapter's verified current state and
// canonical rows establish authority; a browser proof cannot grant access.
import {createHash} from 'node:crypto';
import {stableJson,uuidPattern} from '../src/lib/engagement-domain.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(statusCode,message)=>{throw Object.assign(Error(message),{status:statusCode,statusCode});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes('..');
const exact=(value,allowed)=>object(value)&&Object.keys(value).every(key=>allowed.includes(key));
export function assertFieldCaptureCommit(body){
 if(!exact(body,['request_id','expectedRevision','manifest_artifact_id','leaseId','recovery'])||!uuidPattern.test(body.request_id||'')||!uuidPattern.test(body.leaseId||'')||!id(body.manifest_artifact_id)||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<1)fail(400,'Use the exact pending field save identity, revision and immutable manifest.');
 if(body.recovery!==undefined&&(!exact(body.recovery,['reviewId','reviewSha256'])||Object.keys(body.recovery).length!==2||!uuidPattern.test(body.recovery.reviewId||'')||!/^[a-f0-9]{64}$/.test(body.recovery.reviewSha256||'')))fail(400,'Use the exact server review before explicitly restarting this field save.');
 return body;
}
export function fieldCaptureCommitDescriptor(engagementId,body){
 assertFieldCaptureCommit(body);return {engagementId,operation:'field-capture',expectedRevision:body.expectedRevision,manifest_artifact_id:body.manifest_artifact_id,leaseId:body.leaseId,...(body.recovery?{recovery:body.recovery}:{})};
}
export function fieldCaptureReviewKey(engagementId,reviewId){
 if(!uuidPattern.test(engagementId||'')||!uuidPattern.test(reviewId||''))fail(400,'Use the exact engagement and field review identities.');return {pk:`ENGAGEMENT#${engagementId}`,sk:`FIELD_REVIEW#${reviewId}`};
}
export function assertPendingFieldRequest(row,{principal,userId,engagementId,command}={}){
 const descriptor=fieldCaptureCommitDescriptor(engagementId,command);
 if(!row)return null;const value=row.value;
 if(row.pk!==`ENGAGEMENT_REQUEST#${command.request_id}`||row.sk!=='PROFILE'||value?.object_type!=='engagement_operation_request'||value.request_id!==command.request_id||value.actor_id!==userId||value.issuer!==principal.issuer||value.subject!==principal.subject||value.input_sha256!==hash(stableJson(descriptor))||!['pending','promoted','superseded'].includes(value.status))fail(409,'This pending save belongs to another operation or signed-in practitioner.');
 return value;
}
export function buildFieldCaptureSaveReview({id:reviewId,state,lease,command,payload,manifestSha256,pending,captureReceipt,recoveryIssue,at}={}){
 assertFieldCaptureCommit(command);fieldCaptureReviewKey(state.target.value.engagement_id,reviewId);
 const core=state.packages[0].engagement,currentRevision=core.revision,time=Date.parse(at),expiresAt=new Date(Math.min(time+120000,Date.parse(lease.expiresAt),state.auth.principal.expiresAt,...state.auth.ctx.authorityDeadlines.values())).toISOString();
 if(Date.parse(expiresAt)<=time)fail(403,'Field authority expires before this save can be reviewed.');
 const reasons=[];
 if(!pending)reasons.push('The server has no pending save for this device request.');
 else if(pending.status==='superseded')reasons.push('A later explicit save replaced this pending request. Check the saved observation before starting again.');
 else if(pending.status!=='promoted'&&Date.parse(pending.expires_at)<=time)reasons.push('The earlier pending save has expired.');
 if(command.expectedRevision!==currentRevision)reasons.push('The engagement changed after this field save was prepared.');
 if(recoveryIssue)reasons.push('The earlier save review expired or changed. Review the current engagement before replacing this request.');
 const status=captureReceipt?'saved':reasons.length?'restart_required':'pending';
 if(!captureReceipt&&pending?.status==='promoted')fail(409,'The earlier save is marked complete but its capture acknowledgment is unavailable.');
 const changes=(state.packages[0].entities.audit||state.packages[0].audit||[]).filter(row=>Number(row.revision)>command.expectedRevision).slice(-20).map(row=>({command:String(row.command||'engagement update').slice(0,200),actorId:String(row.actorId||'').slice(0,300),at:row.at||row.timestamp||at,revision:Number.isSafeInteger(row.revision)?row.revision:currentRevision}));
 const proof={format:'esia-field-capture-save-review',schemaVersion:1,id:reviewId,status,pendingRequestId:command.request_id,manifestArtifactId:command.manifest_artifact_id,manifestSha256,recordSha256:payload.recordSha256,captureId:payload.record.captureId,leaseId:lease.id,leaseRevision:lease.revision,priorRevision:command.expectedRevision,currentRevision,headRevision:state.head.revision,headSha256:state.head.value.snapshot.sha256,configurationRevision:state.target.revision,projectConfigurationRevision:state.projectRow.revision,policySha256:lease.policySha256,sourceSha256:state.sourceSha256,sourceViewSha256:state.sourceViewSha256,reviewedAt:at,expiresAt,reasons,recordSummary:{title:payload.record.title,note:payload.record.note,capturedAt:payload.record.capturedAt,declaredAuthor:payload.record.author,site:payload.record.site},changes,...(captureReceipt?{captureReceipt}:{})};
 return {...proof,sha256:hash(stableJson(proof))};
}
export function assertFieldCaptureSaveReviewState(row,{principal,userId,engagementId,command,state,lease,manifestSha256,now}={}){
 if(!command.recovery)fail(400,'Review this pending save before restarting it.');
 const key=fieldCaptureReviewKey(engagementId,command.recovery.reviewId),value=row?.value,proof=value?.proof;
 if(row?.pk!==key.pk||row.sk!==key.sk||value?.object_type!=='engagement_field_capture_review'||value.status!=='active'||value.actor_id!==userId||value.issuer!==principal.issuer||value.subject!==principal.subject||proof?.status!=='restart_required'||proof.id!==command.recovery.reviewId||proof.sha256!==command.recovery.reviewSha256||proof.pendingRequestId===command.request_id)fail(409,'This field-save review is unavailable, consumed or belongs to another practitioner.');
 const {sha256,...canonical}=proof;if(sha256!==hash(stableJson(canonical)))fail(409,'The retained field-save review differs from its exact digest.');
 if(!Number.isFinite(Date.parse(proof.expiresAt))||Date.parse(proof.expiresAt)<=now)fail(409,'This field-save review expired. Check the current saved record and changes again.');
 if(proof.manifestArtifactId!==command.manifest_artifact_id||proof.manifestSha256!==manifestSha256||proof.leaseId!==command.leaseId||proof.leaseRevision!==lease.revision||proof.policySha256!==lease.policySha256||proof.currentRevision!==command.expectedRevision||proof.headRevision!==state.head.revision||proof.headSha256!==state.head.value.snapshot.sha256||proof.configurationRevision!==state.target.revision||proof.projectConfigurationRevision!==state.projectRow.revision||proof.sourceSha256!==state.sourceSha256||proof.sourceViewSha256!==state.sourceViewSha256)fail(409,'The engagement, sources, project or field permission changed after review. Check the current record again.');
 return {proof,pendingCommand:assertFieldCaptureCommit(value.pending_command)};
}
