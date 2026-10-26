import {createHash} from 'node:crypto';
import {stableJson} from '../src/lib/engagement-domain.js';
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fail = (message, status = 409) => {throw Object.assign(Error(message), {status, statusCode:status});};
const terminal = new Set(['completed','failed','timed_out','cancelled','expired']);
export const clientTemplateNativeJobLimits = Object.freeze({maximumMilliseconds:150000,maximumWorkerSeconds:180,maximumEventAgeSeconds:60,maximumAuthorityPins:128,idleRequests:0,automaticRetries:0,eventDispatchCount:1,maximumConversionClaims:1,maximumJobsPerExplicitRequest:1,maximumAttempts:3,maximumDailyAccountJobs:12,retentionMilliseconds:7*86400000,maximumRecentJobs:96,maximumPhaseChecks:256,maximumStagingObjects:256,maximumStagingBytes:96*1024*1024});
function scopeOf(value) {
 if (!value || Object.keys(value).some(key => !['accountId','projectId','engagementId','bucket'].includes(key)) || !/^[a-f0-9-]{36}$/.test(value.engagementId || '') || ![value.accountId,value.projectId,value.bucket].every(v => typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(v))) fail('Use the exact native job account, project, engagement and owning bucket.',403);
 return {accountId:value.accountId,projectId:value.projectId,engagementId:value.engagementId,bucket:value.bucket};
}
export const nativeJobIdentity = (scope,idempotencyKey) => hash({scope:scopeOf(scope),idempotencyKey});
export const nativeJobStagingPrefix = (scope,id) => {if(!sha(id))fail('Use an exact native staging identity.',400);return `tenants/${scopeOf(scope).accountId}/projects/${scope.projectId}/engagements/${scope.engagementId}/client-template-studio/native-jobs/${id}/`;};
function inputOf(value,scope) {
 const prefix=`tenants/${scope.accountId}/projects/${scope.projectId}/engagements/${scope.engagementId}/client-template-studio/`;
 if(value?.kind!=='client_template'||value.bucket!==scope.bucket||!sha(value.sha256)||!(value.key===prefix+'objects/'+value.sha256+'.bin'||new RegExp('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'native-jobs/[a-f0-9]{64}/objects/'+value.sha256+'[.]bin$').test(value.key))||!value.versionId||!Number.isSafeInteger(value.sizeBytes)||value.sizeBytes<1||value.sizeBytes>32*1024*1024||value.contentType!=='application/json')fail('Native jobs require an exact immutable scoped request manifest.',403);
 return structuredClone(value);
}
// remoteStopAt is the retained legacy storage name for admission lease expiry.
// It does not confirm provider termination; expose that distinction publicly.
const descriptor=job=>({format:'esia-native-template-job',schemaVersion:2,id:job.id,rootId:job.rootId||job.id,attempt:job.attempt||1,previousJobId:job.previousJobId||null,status:job.status,operation:job.operation,sourceSha256:job.sourceSha256,definitionSha256:job.definitionSha256,createdAt:job.createdAt,startedAt:job.startedAt||null,completedAt:job.completedAt||null,deadlineAt:job.deadlineAt,admissionLeaseUntil:job.remoteStopAt||job.deadlineAt,expiresAt:job.expiresAt,error:job.error||null,automaticRetries:0,idleRequests:0,manualStatusRequired:true,retryAllowed:!!job.input?.versionId&&(job.attempt||1)<3,cancellation:job.status==='cancelled'?{publicationPrevented:true,admissionLeaseUntil:job.remoteStopAt||job.deadlineAt,stopConfirmation:'not_confirmed',message:'The result cannot be applied. Remote termination is not confirmed.'}:null});
export function createClientTemplateNativeJobRepository({store}={}) {
 if(!store?.get||!store?.transact)throw Error('Native job metadata requires the existing conditional access store.');
 const key=id=>{if(!sha(id))fail('Use an exact native job identity.',400);return {pk:`CLIENT_TEMPLATE_NATIVE_JOB#${id}`,sk:'PROFILE'};};
 const put=(k,value,row)=>({...k,expected:row?.revision??null,put:{...k,revision:(row?.revision||0)+1,value}});
 const indexKey=scope=>({pk:`CLIENT_TEMPLATE_NATIVE_JOB#INDEX#${hash(scope)}`,sk:'PROFILE'}),leaseKey={pk:'CLIENT_TEMPLATE_NATIVE_JOB#ADMISSION',sk:'PROFILE'};
 const read=async k=>store.get(k.pk,k.sk);
 const api={
  async get(id){const row=await read(key(id));if(!row)return null;if(row.value?.format!=='esia-native-template-job-record'||row.value.id!==id)fail('Native job metadata is corrupt.');return {...structuredClone(row.value),storeRevision:row.revision};},
  async save(job,expected=null){const k=key(job.id),{storeRevision,...value}=job;await store.transact([put(k,value,expected===null?null:{revision:expected})]);return {...structuredClone(value),storeRevision:expected===null?1:expected+1};},
  async recent(scope){const row=await read(indexKey(scope));return row?.value?.ids||[];},
  async admit(job,{root,previous}={}){
   const index=await read(indexKey(job.scope)),lease=await read(leaseKey),day=job.createdAt.slice(0,10),quotaKey={pk:`CLIENT_TEMPLATE_NATIVE_JOB#QUOTA#${job.scope.accountId}`,sk:day},quota=await read(quotaKey),instant=Date.parse(job.createdAt);
   if(lease?.value?.jobId&&Date.parse(lease.value.until)>instant)fail('A native conversion is already admitted. Check or cancel that job; no work was queued.',429);
   if((quota?.value?.count||0)>=clientTemplateNativeJobLimits.maximumDailyAccountJobs)fail('This account reached its daily native conversion quota. No worker was invoked.',429);
   const ids=index?.value?.ids||[];if(!root&&ids.length>=clientTemplateNativeJobLimits.maximumRecentJobs)fail('Clean up expired native jobs before submitting more work.',429);
   const ops=[put(key(job.id),job,null),put(leaseKey,{jobId:job.id,until:job.remoteStopAt||new Date(Date.parse(job.deadlineAt)+90000).toISOString()},lease),put(quotaKey,{accountId:job.scope.accountId,day,count:(quota?.value?.count||0)+1},quota)];
   if(root){const {storeRevision,...value}=root;ops.push(put(key(root.id),{...value,latestAttemptId:job.id,attemptIds:[...root.attemptIds,job.id]}, {revision:storeRevision}));if(previous.id!==root.id)ops.push({...key(previous.id),expected:previous.storeRevision,expectedValue:(()=>{const {storeRevision,...v}=previous;return v;})()});}
   else ops.push(put(indexKey(job.scope),{scope:job.scope,ids:[...ids,job.id]},index));
   await store.transact(ops);return {...structuredClone(job),storeRevision:1};
  },
  async release(job){const lease=await read(leaseKey);if(lease?.value?.jobId!==job.id)return;try{await store.transact([put(leaseKey,{jobId:null,until:job.deadlineAt},lease)]);}catch(error){if((error.statusCode||error.status)!==409)throw error;}},
  async forget(scope,id){const k=indexKey(scope),row=await read(k);if(!row)return;await store.transact([put(k,{...row.value,ids:row.value.ids.filter(v=>v!==id)},row)]);}
 };return api;
}
export async function verifyNativeTemplateJobAuthority({store, job} = {}) {
  if (!Array.isArray(job?.authorityPins) || !job.authorityPins.length || job.authorityPins.length > clientTemplateNativeJobLimits.maximumAuthorityPins) return false;
  for (let offset = 0; offset < job.authorityPins.length; offset += 8) {
    const rows = await Promise.allSettled(job.authorityPins.slice(offset, offset + 8).map(async pin => {
      if (typeof pin.pk !== 'string' || typeof pin.sk !== 'string' || !sha(pin.valueSha256) || !(pin.revision === null || Number.isSafeInteger(pin.revision) && pin.revision > 0)) return false;
      const row = await store.get(pin.pk, pin.sk);return (row?.revision ?? null) === pin.revision && hash(row?.value ?? null) === pin.valueSha256;
    }));
    if (rows.some(value => value.status !== 'fulfilled' || value.value !== true)) return false;
  }
  return true;
}


/** All work is explicit. No poller, scheduler, queue receiver or automatic retry. */
export function createClientTemplateNativeJobs({repository,invokeOnce,authorize,verifyCurrent,execute,cleanup,now=()=>new Date()}={}) {
 if(!repository?.get||!repository?.save||typeof authorize!=='function'||typeof verifyCurrent!=='function')throw Error('Configure durable job metadata and current authorization/authority checks.');
 const clock=()=>new Date(now()).getTime(),stamp=()=>new Date(clock()).toISOString();
 async function authorized(scope,operation,actor){scope=scopeOf(scope);if(await authorize({scope,operation,actor})!==true)fail('Native job access was denied.',403);return scope;}
 async function load(scope,id,actor,operation='status',{follow=true,verify=true}={}){
  scope=await authorized(scope,operation,actor);let job=await repository.get(id);if(!job||stableJson(job.scope)!==stableJson(scope))fail('The native job is unavailable in this exact scope.',404);
  if(follow&&job.latestAttemptId&&job.latestAttemptId!==job.id)job=await repository.get(job.latestAttemptId);
  if(!job||stableJson(job.scope)!==stableJson(scope))fail('The native job is unavailable in this exact scope.',404);
  if(verify&&await verifyCurrent(job)!==true)fail('Native job source, definition or current authority changed. Reopen the assignment.',409);
  if(!terminal.has(job.status)&&clock()>=Date.parse(job.deadlineAt)){
   const mayStillRun=job.status==='running';let expiredHere=false;try{job=await repository.save({...job,status:'timed_out',completedAt:stamp(),error:{code:'deadline',message:'The bounded native job deadline expired; no retry was scheduled.'}},job.storeRevision);expiredHere=true;}catch(error){if((error.statusCode||error.status)!==409)throw error;job=await repository.get(job.id);}if(expiredHere&&!mayStillRun)await repository.release?.(job);
  }
  return job;
 }
 const fresh=job=>clock()<Date.parse(job.expiresAt||job.createdAt)&&job.status!=='expired';
 async function dispatch(job){try{await invokeOnce({format:'esia-native-template-job-invocation',schemaVersion:1,scope:job.scope,jobId:job.id,requestFingerprint:job.requestFingerprint});return descriptor(job);}catch{return {...descriptor(job),dispatchAcknowledgement:'unknown',message:'The worker acknowledgement was not received. Check this same job manually; it will not be dispatched again.'};}}
 async function submit(request){
  const scope=await authorized(request.scope,'submit',request.actor),deferred=typeof request.prepareInput==='function',input=inputOf(deferred?{...request.input,versionId:'pending-retention'}:request.input,scope);if(deferred)delete input.versionId;
  if(!['reference','render'].includes(request.operation)||!sha(request.sourceSha256)||!sha(request.definitionSha256)||typeof request.idempotencyKey!=='string'||!request.idempotencyKey||request.idempotencyKey.length>300||!Array.isArray(request.authorityPins)||!request.authorityPins.length||request.authorityPins.length>clientTemplateNativeJobLimits.maximumAuthorityPins)fail('Pin the native operation, source/definition, current authority and explicit request identity.',400);
  const id=nativeJobIdentity(scope,request.idempotencyKey),fingerprint=hash({scope,input,operation:request.operation,sourceSha256:request.sourceSha256,definitionSha256:request.definitionSha256,authorityPins:request.authorityPins});let job=await repository.get(id);
  if(job){if(job.requestFingerprint!==fingerprint)fail('This idempotency key already identifies different exact native inputs.');job=await load(scope,id,request.actor);if(!fresh(job))fail('This native job expired. Its retained result cannot be applied.',410);return descriptor(job);}
  if(typeof invokeOnce!=='function')fail('The explicitly configured one-shot native worker is unavailable.',503);
  const createdMilliseconds=clock(),createdAt=new Date(createdMilliseconds).toISOString(),authorizationDeadline=request.authorizationExpiresAt?Date.parse(request.authorizationExpiresAt):Infinity;if(Number.isNaN(authorizationDeadline)||authorizationDeadline<=clock())fail('Native job authority expired before submission.',403);
  const deadlineAt=new Date(Math.min(createdMilliseconds+clientTemplateNativeJobLimits.maximumMilliseconds,authorizationDeadline)).toISOString();
  job={format:'esia-native-template-job-record',schemaVersion:2,id,rootId:id,attempt:1,attemptIds:[id],latestAttemptId:id,scope,input,operation:request.operation,sourceSha256:request.sourceSha256,definitionSha256:request.definitionSha256,authorityPins:structuredClone(request.authorityPins),requestFingerprint:fingerprint,status:deferred?'preparing':'accepted',createdAt,deadlineAt,remoteStopAt:new Date(createdMilliseconds+240000).toISOString(),expiresAt:new Date(createdMilliseconds+clientTemplateNativeJobLimits.retentionMilliseconds).toISOString(),authorizationExpiresAt:request.authorizationExpiresAt||null,actorId:request.actor?.id||null,dispatchAttemptedAt:createdAt,...(request.resume?{resume:structuredClone(request.resume)}:{})};
  if(await verifyCurrent(job)!==true)fail('Native job authority changed before submission.',409);
  try{job=repository.admit?await repository.admit(job):await repository.save(job);}catch(error){if((error.statusCode||error.status)!==409)throw error;const retained=await repository.get(id);if(!retained||retained.requestFingerprint!==fingerprint)fail('Native admission changed concurrently; no worker was invoked.');return descriptor(await load(scope,id,request.actor));}
  if(deferred){try{const retained=inputOf(await request.prepareInput(),scope),{versionId,...content}=retained;if(clock()>=Date.parse(job.deadlineAt))fail('Native input retention exceeded the original job deadline.',504);if(stableJson(content)!==stableJson(input)||await verifyCurrent(job)!==true)fail('Native input retention changed its exact bytes or authority.');job=await repository.save({...job,input:retained,status:'accepted'},job.storeRevision);}catch(error){const latest=await repository.get(job.id);if(latest.status==='preparing')try{await repository.save({...latest,status:'failed',completedAt:stamp(),error:{code:'input_retention_failed',message:'The exact native input was not committed. Reopen the operation with a new explicit request.'}},latest.storeRevision);}catch{}await repository.release?.(job);throw error;}}
  return dispatch(job);
 }
 async function run(event){
  if(event?.format!=='esia-native-template-job-invocation'||event.schemaVersion!==1||!sha(event.jobId)||!sha(event.requestFingerprint)||typeof execute!=='function')fail('Use the private one-shot native job invocation.',403);
  const scope=scopeOf(event.scope);let job=await repository.get(event.jobId);
  if(!job||job.requestFingerprint!==event.requestFingerprint||stableJson(job.scope)!==stableJson(scope))fail('The native invocation differs from its exact retained job.',403);
  if(job.status!=='accepted')return descriptor(job);
  if(await verifyCurrent(job)!==true||clock()>=Date.parse(job.deadlineAt)){
   const timedOut=clock()>=Date.parse(job.deadlineAt);let rejectedHere=false;try{job=await repository.save({...job,status:timedOut?'timed_out':'failed',completedAt:stamp(),error:{code:timedOut?'deadline':'authority_changed',message:'The job expired or current source/definition authority changed before execution.'}},job.storeRevision);rejectedHere=true;}catch(error){if((error.statusCode||error.status)!==409)throw error;job=await repository.get(job.id);}if(rejectedHere)await repository.release?.(job);return descriptor(job);
  }
  try{job=await repository.save({...job,status:'running',startedAt:stamp()},job.storeRevision);}catch(error){if((error.statusCode||error.status)!==409)throw error;return descriptor(await repository.get(job.id));}
  const controller=new AbortController();let timer,checks=0,executionSettled=false;
  const checkpoint=async()=>{if(++checks>clientTemplateNativeJobLimits.maximumPhaseChecks)fail('The native job exceeded its bounded phase-check limit.',413);const current=await repository.get(job.id);if(current?.status!=='running'||current.storeRevision!==job.storeRevision){controller.abort();fail('The native conversion was cancelled or superseded.',499);}if(clock()>=Date.parse(job.deadlineAt)){controller.abort();fail('Native deadline expired.',504);}};
  try{
   const stopped=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('Native deadline expired.'),{status:504}));},Math.max(1,Date.parse(job.deadlineAt)-clock()));});
   const response=await Promise.race([Promise.resolve().then(()=>execute({format:'esia-native-template-invocation',schemaVersion:1,scope,input:job.input,expected:{sourceSha256:job.sourceSha256,definitionSha256:job.definitionSha256},stagingJobId:job.id},{signal:controller.signal,deadlineAt:job.deadlineAt,checkpoint})).finally(()=>{executionSettled=true;}),stopped]);
   if(response?.error)throw Object.assign(Error(response.error.message||'Native conversion failed.'),{status:response.error.status||422});inputOf(response?.result,scope);await checkpoint();if(controller.signal.aborted||await verifyCurrent(job)!==true)fail('Current native job authority changed during conversion.',409);
   job=await repository.save({...job,status:'completed',result:response.result,completedAt:stamp()},job.storeRevision);
  }catch(error){const latest=await repository.get(job.id);if(latest.status!=='running'||latest.storeRevision!==job.storeRevision){job=latest;return descriptor(job);}const timedOut=error.status===504||controller.signal.aborted||clock()>=Date.parse(job.deadlineAt);try{job=await repository.save({...job,status:timedOut?'timed_out':'failed',completedAt:stamp(),error:{code:timedOut?'deadline':'conversion_failed',message:timedOut?'The bounded native job deadline expired; no retry was scheduled.':'Native conversion did not produce a verified result. No retry was scheduled.'}},job.storeRevision);}catch(conflict){if((conflict.statusCode||conflict.status)!==409)throw conflict;job=await repository.get(job.id);}}
  finally{clearTimeout(timer);controller.abort();if(executionSettled)await repository.release?.(job);}
  return descriptor(job);
 }
 return {submit,run,
  async status(scope,id,actor){return descriptor(await load(scope,id,actor));},
  async result(scope,id,actor){const job=await load(scope,id,actor,'result');if(!fresh(job))fail('The native job result expired.',410);if(job.status!=='completed')fail(`The native job is ${job.status}; a completed exact result is required.`,terminal.has(job.status)?job.status==='timed_out'?504:422:409);return {result:structuredClone(job.result)};},
  async discover(scope,actor){scope=await authorized(scope,'discover',actor);if(!actor?.id)fail('Use the current assigned practitioner.',403);const rows=[];for(const id of await repository.recent(scope)){const root=await repository.get(id);if(root?.actorId!==actor.id)continue;const job=await load(scope,id,actor,'discover',{verify:false});if(job.status==='expired'&&(root.cleanedAttemptIds||[]).length===(root.attemptIds||[root.id]).length)continue;const verified=await verifyCurrent(job)===true;rows.push({...descriptor(job),staleAuthority:!verified,resumable:verified&&!!root.resume&&fresh(job),canReopen:!!root.resume&&fresh(job)});}return {format:'esia-native-template-job-directory',jobs:rows};},
  async resume(scope,id,actor){const job=await load(scope,id,actor,'resume',{verify:false}),root=await repository.get(job.rootId||job.id);if(root.actorId!==actor?.id||!root.resume)fail('This conversion belongs to another practitioner or has no retained request.',403);if(!fresh(job))fail('This native request expired.',410);return {request:structuredClone(root.resume),job:descriptor(job)};},
  async cancel(scope,id,actor){
   for(let attempt=0;attempt<2;attempt++){
    const job=await load(scope,id,actor,'cancel',{verify:false});if(job.actorId!==actor?.id)fail('Only the submitting practitioner can cancel this conversion.',403);if(terminal.has(job.status))return descriptor(job);
    try{const cancelled=await repository.save({...job,status:'cancelled',completedAt:stamp(),cancelledBy:actor.id,error:{code:'cancelled',message:'The result cannot be applied. Remote termination is not confirmed.'}},job.storeRevision);if(['preparing','accepted'].includes(job.status))await repository.release?.(cancelled);return descriptor(cancelled);}
    catch(error){if((error.statusCode||error.status)!==409)throw error;if(attempt===1)fail('The conversion changed while cancellation was applied. Check this same job and cancel explicitly again.');}
   }
  },
  async retry(scope,id,actor,retryKey){let previous=await load(scope,id,actor,'retry'),root=await repository.get(previous.rootId||previous.id);if(previous.actorId!==actor?.id||!sha(retryKey))fail('Use the original practitioner and one exact manual retry identity.',403);const retryId=hash({previousJobId:id,retryKey});if(previous.id!==id){if(previous.id===retryId)return descriptor(previous);fail('The previous attempt changed. Reopen its current status.');}if(root.latestAttemptId&&root.latestAttemptId!==previous.id)fail('A later native attempt already exists. Reopen its status.');if(!['failed','timed_out','cancelled'].includes(previous.status))fail('Only an observed terminal conversion can be retried; uncertain dispatch is never retried.');if(!previous.input.versionId)fail('The original input was not retained. Reopen the operation with a new explicit request.');if(!fresh(root)||previous.attempt>=clientTemplateNativeJobLimits.maximumAttempts)fail('This job expired or reached its three-attempt limit.',410);if(typeof invokeOnce!=='function')fail('The one-shot native worker is unavailable.',503);
   const authorizationDeadline=previous.authorizationExpiresAt?Date.parse(previous.authorizationExpiresAt):Infinity;if(authorizationDeadline<=clock())fail('The original native authority expired. Reopen the assignment.',403);const createdMilliseconds=clock(),createdAt=new Date(createdMilliseconds).toISOString(),{storeRevision,latestAttemptId,attemptIds,...retained}=previous,job={...retained,id:retryId,rootId:root.id,previousJobId:previous.id,attempt:previous.attempt+1,status:'accepted',createdAt,remoteStopAt:new Date(createdMilliseconds+240000).toISOString(),deadlineAt:new Date(Math.min(createdMilliseconds+clientTemplateNativeJobLimits.maximumMilliseconds,authorizationDeadline)).toISOString(),startedAt:null,completedAt:null,error:null,result:undefined,dispatchAttemptedAt:createdAt};
   try{return dispatch(await repository.admit(job,{root,previous}));}catch(error){if((error.statusCode||error.status)!==409)throw error;const existing=await repository.get(retryId);if(existing)return descriptor(existing);throw error;}
  },
  async cleanup(scope,id,actor){const selected=await load(scope,id,actor,'cleanup',{verify:false}),root=await repository.get(selected.rootId||selected.id);if(root.actorId!==actor?.id)fail('Only the original practitioner can clean up this conversion.',403);if(clock()<Date.parse(root.expiresAt))fail('Retain native conversion staging for seven days before cleanup.');if(typeof cleanup!=='function')fail('Exact native staging cleanup is not configured.',503);const ids=root.attemptIds||[root.id];for(const attemptId of ids){const attempt=await repository.get(attemptId);if(!attempt||!terminal.has(attempt.status)||clock()<Date.parse(attempt.remoteStopAt||attempt.deadlineAt))fail('Every attempt in this job family must be past its admission lease before cleanup.');}const cleaned=root.cleanedAttemptIds||[],next=ids.find(v=>!cleaned.includes(v));if(!next)return {status:'expired',complete:true,deletedObjects:0};const job=await repository.get(next);if(clock()<Date.parse(job.remoteStopAt||job.deadlineAt)||!terminal.has(job.status))fail('The conversion is still within its admission lease.');const result=await cleanup({scope:root.scope,jobId:next,maximumObjects:clientTemplateNativeJobLimits.maximumStagingObjects});const latest=await repository.get(root.id);await repository.save({...latest,status:latest.id===next?'expired':latest.status,cleanedAttemptIds:[...(latest.cleanedAttemptIds||[]),next]},latest.storeRevision);if(ids.every(v=>[...cleaned,next].includes(v)))await repository.forget?.(root.scope,root.id);return {status:'expired',complete:ids.every(v=>[...cleaned,next].includes(v)),deletedObjects:result.deletedObjects||0,maximumObjects:clientTemplateNativeJobLimits.maximumStagingObjects};}
 };
}
export function nativeTemplateJobPending(job){return Object.assign(Error('Native conversion is running as a bounded job. Check its status manually, then apply the completed result.'),{status:202,statusCode:202,nativeJob:job});}
