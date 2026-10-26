// Native case authorization for the common event graph. Ciphertext is opaque
// here; browser cryptography and the shared engine validate its exact context.
import {createHash} from 'node:crypto';
import {stableJson,uuidPattern,sha256Pattern} from '../src/lib/engagement-domain.js';
import {engagementCaseGroups,engagementCaseAccessKey,engagementCaseSourceKey,validateEngagementCaseAccess,setEngagementCaseRule,engagementCasePermissions,assertEngagementCaseAccess,mergeEngagementCaseSources,validateEngagementCaseSources} from './engagement-case-access.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const scopeOf=state=>({accountId:state.target.value.account_id,projectId:state.target.value.project_id,workspaceId:state.target.value.workspace_id,engagementId:state.target.value.engagement_id});
const revisions=record=>[record,...(record.history||[])];
const copy=value=>structuredClone(value);

export function createAuthenticatedCaseOperations(d){
 const {authenticate,resourceAccess,metadata,load,get,commit,record,store,instant,iso,fail,requireBody,sameHead,mergeAuthority,saveCaseDetails,protectionOf,initializationBindings}=d;
 async function stateFor(principal,engagementId,caseId,{manage=false,action='view',requiredRoles=[]}={}){
  if(!uuidPattern.test(caseId||''))fail(400,'Choose an exact retained monitoring case UUID.');
  const state=await metadata(principal,engagementId,{action:manage?'manage_access':action,requiredRoles}),scope=scopeOf(state),key=engagementCaseAccessKey(engagementId),policy=await get(state.auth.ctx,key.pk,key.sk);validateEngagementCaseAccess(policy,{scope});
  const permission=engagementCasePermissions(policy,{scope,caseId,userId:state.auth.userId,now:instant().getTime(),canManageEngagement:manage});return {...state,scope,caseId,policy,permission};
 }
 function enforce(state,groups,action='read'){
  const permission=assertEngagementCaseAccess(state.policy,{scope:state.scope,caseId:state.caseId,userId:state.auth.userId,groups,action,now:instant().getTime(),canManageEngagement:state.permission.canManageAccess});
  if(permission.expiresAt)state.auth.ctx.authorityDeadlines.set(`case:${state.caseId}:${state.auth.userId}`,Date.parse(permission.expiresAt));return permission;
 }
 async function canonical(state,groups=[]){const loaded=await load(state.auth.principal,state.scope.engagementId,{caseAccess:{caseId:state.caseId,groups}});sameHead(state,loaded);mergeAuthority(state.auth.ctx,loaded.auth.ctx);const event=loaded.packages?.[0]?.entities?.events?.find(row=>row.id===state.caseId);if(!event)fail(404,'The monitoring case is not part of this exact engagement.');return {...loaded,event};}
 async function request(state,requestId,operation,input){
  if(!uuidPattern.test(requestId||''))fail(400,'Use an explicit native case request UUID.');const pk=`ENGAGEMENT_CASE_REQUEST#${requestId}`,prior=await get(state.auth.ctx,pk,'PROFILE'),inputSha256=hash(stableJson({operation,engagementId:state.scope.engagementId,caseId:state.caseId,input}));
  if(prior&&(prior.value.userId!==state.auth.userId||prior.value.issuer!==state.auth.principal.issuer||prior.value.subject!==state.auth.principal.subject||prior.value.inputSha256!==inputSha256))fail(409,'That case request UUID belongs to different work or another native identity.');return {pk,prior,inputSha256};
 }
 function securityWrites(state,attempt,operation,receipt,review={}){
  const requestId=attempt.pk.slice('ENGAGEMENT_CASE_REQUEST#'.length),auditKey=`AUDIT#case-${requestId}`;
  return [record(attempt.pk,'PROFILE',{object_type:'engagement_case_request',userId:state.auth.userId,issuer:state.auth.principal.issuer,subject:state.auth.principal.subject,inputSha256:attempt.inputSha256,status:'acknowledged',receipt}),record(auditKey,'PROFILE',{object_type:'audit_event',action:operation,scope:state.scope,caseId:state.caseId,userId:state.auth.userId,issuer:state.auth.principal.issuer,subject:state.auth.principal.subject,at:iso(),aclRevision:state.policy?.revision||0,requestId,...review})];
 }
 async function engagementCaseAccess(principal,engagementId,caseId){
  const state=await stateFor(principal,engagementId,caseId);const loaded=await canonical(state);let canManage=false;
  try{const managed=await resourceAccess(state.auth,'engagement',engagementId,'manage_access');canManage=Boolean(managed);}catch(error){if(error.statusCode!==403)throw error;}
  const result=engagementCasePermissions(state.policy,{scope:state.scope,caseId,userId:state.auth.userId,now:instant().getTime(),canManageEngagement:canManage});
  result.canAdopt=false;if(!result.registered&&state.target.value.owner_user_id===state.auth.userId){try{await resourceAccess(state.auth,'project',state.scope.projectId,'manage_access');result.canAdopt=canManage;}catch(error){if(error.statusCode!==403)throw error;}}
  result.eventRevision=loaded.event.revision;await commit(state.auth.ctx);return result;
 }
 async function engagementCaseAcl(principal,engagementId,caseId){
  const state=await stateFor(principal,engagementId,caseId,{manage:true});enforce(state,engagementCaseGroups,'manage_access');await canonical(state);await commit(state.auth.ctx);return {...state.permission,rule:copy(state.policy.value.cases.find(row=>row.caseId===caseId))};
 }
 async function participant(state,userId){
  if(typeof d.verifyCaseParticipant!=='function')fail(503,'Fresh native case participant identity verification is not configured.');return d.verifyCaseParticipant(state,userId);
 }
 async function engagementCaseSetAcl(principal,engagementId,caseId,body){
  requireBody(body,['request_id','expectedAclRevision','managers','grants','statement','adoptLegacy']);const state=await stateFor(principal,engagementId,caseId,{manage:true}),attempt=await request(state,body.request_id,'case-acl',body);
  if(attempt.prior){await commit(state.auth.ctx);return {...attempt.prior.value.receipt,access:state.permission};}
  if(body.expectedAclRevision!==(state.policy?.revision||0))fail(409,'Case permissions changed. Review their current native recipients before saving.');
  if(!state.permission.registered){if(body.adoptLegacy!==true||state.target.value.owner_user_id!==state.auth.userId)fail(403,'The verified engagement owner must explicitly adopt this unregistered case.');await resourceAccess(state.auth,'project',state.scope.projectId,'manage_access');}
  else{enforce(state,engagementCaseGroups,'manage_access');if(body.adoptLegacy!==undefined)fail(400,'A registered native case cannot be relabelled as a new legacy adoption.');}
  if(typeof body.statement!=='string'||body.statement.trim().length<20||body.statement.length>4000)fail(400,'Record the purpose and authorization for this explicit case access change.');
  const next=setEngagementCaseRule({row:state.policy,scope:state.scope,caseId,managers:body.managers,grants:body.grants,actorId:state.auth.userId,at:iso()});
  for(const userId of new Set([...body.managers,...body.grants.map(row=>row.userId)]))await participant(state,userId);
  for(const grant of body.grants)if(Date.parse(grant.expiresAt)<=instant().getTime())fail(400,'New case permissions require a future finite expiry.');
  await canonical(state);const fresh=await stateFor(principal,engagementId,caseId,{manage:true});sameHead(state,fresh);mergeAuthority(state.auth.ctx,fresh.auth.ctx);
  const receipt={acknowledged:true,caseId,scope:state.scope,requestId:body.request_id,aclRevision:next.revision};await commit(state.auth.ctx,[next,...securityWrites(state,attempt,'case-acl-change',receipt,{statement:body.statement.trim(),adoptLegacy:body.adoptLegacy===true,nextAclRevision:next.revision})]);return {...receipt,access:engagementCasePermissions(next,{scope:state.scope,caseId,userId:state.auth.userId,now:instant().getTime(),canManageEngagement:true})};
 }
 async function engagementCaseDetails(principal,engagementId,caseId,body){
  requireBody(body,['request_id','expectedAclRevision','groups','revision','origin']);if(body.origin!==undefined&&typeof body.origin!=='boolean')fail(400,'Choose whether to open the exact archived protected case.');if(body.revision!==undefined&&(!Number.isSafeInteger(body.revision)||body.revision<1))fail(400,'Choose an exact retained positive case revision.');const state=await stateFor(principal,engagementId,caseId),permission=enforce(state,body.groups);if(body.expectedAclRevision!==state.policy.revision)fail(409,'Review current case field permissions before opening protected content.');const attempt=await request(state,body.request_id,'case-read',body),loaded=await canonical(state,body.groups),event=loaded.event,selected=body.revision===undefined?event:revisions(event).find(row=>row.revision===body.revision);if(!selected)fail(404,'That exact protected case revision is unavailable.');const readPin={eventRevision:event.revision,selectedRevision:selected.revision,headSha256:state.head.value.snapshot.sha256,sourceViewSha256:state.sourceViewSha256,groups:copy(body.groups)};
  if(attempt.prior&&Object.entries(readPin).some(([key,value])=>stableJson(attempt.prior.value.receipt[key])!==stableJson(value)))fail(409,'The case or source context changed after that read request. Start a new explicit protected read.');
  if(body.origin===true&&!selected.restrictedOrigin)fail(404,'That case revision has no retained protected origin.');
  const groups=body.origin===true?{}:Object.fromEntries(body.groups.map(group=>[group,selected.restricted?.schemaVersion===2?copy(selected.restricted.groups?.[group]):undefined]).filter(([,value])=>value));
  const all=engagementCaseGroups.every(group=>permission.groups[group].read)&&engagementCaseGroups.every(group=>body.groups.includes(group)),legacy=selected.restricted?.version===1?selected.restricted:undefined;
  if(legacy&&!all)fail(403,'Legacy combined ciphertext requires all three field permissions until explicitly reviewed and resealed.');
  const history=(event.history||[]).slice(-20).reverse().map(row=>({revision:row.revision,updatedAt:row.updatedAt,updatedBy:row.updatedBy,availableGroups:row.restricted?.schemaVersion===2?body.groups.filter(group=>row.restricted.groups?.[group]):[],legacyAvailable:row.restricted?.version===1&&all,protectedAvailable:Boolean(row.restricted||row.restrictedAvailable),...(row.restrictedOrigin?{originAvailable:true}:{})}));
  const result={format:'esia-native-case-details',schemaVersion:1,caseId,scope:state.scope,userId:state.auth.userId,aclRevision:state.policy.revision,eventRevision:event.revision,selectedRevision:selected.revision,groups,history,historyCount:event.history?.length||0,historyTruncated:(event.history?.length||0)>history.length,...(legacy?{legacyEnvelope:copy(legacy)}:{})};
  if(selected.restrictedOrigin){result.originAvailable=true;if(body.origin===true||!selected.restricted){if(typeof d.caseOriginFor!=='function')fail(503,'The verified archived protected case reader is not configured.');const origin=await d.caseOriginFor({state:loaded,event:selected,groups:body.groups});if(stableJson(origin?.reference)!==stableJson(selected.restrictedOrigin)||!origin.groups||Object.keys(origin.groups).some(group=>!body.groups.includes(group)))fail(409,'The archived case response differs from its exact reference or current field permissions.');result.origin=origin;}}
  if(body.groups.includes('location')&&permission.groups.location.read&&typeof d.caseGeometryFor==='function')result.geometry=await d.caseGeometryFor({state:loaded,event});
  if(typeof d.caseSourceDescriptions==='function'){
   const descriptions=await d.caseSourceDescriptions({state:loaded,event,groups:body.groups});if(!Array.isArray(descriptions)||descriptions.length>1000)fail(409,'Protected case sources require a bounded explicit permission descriptor.');
   result.sources=descriptions.filter(source=>Array.isArray(source.groups)&&source.groups.length&&source.groups.every(group=>body.groups.includes(group)&&permission.groups[group]?.read));
  }
  const fresh=await stateFor(principal,engagementId,caseId);enforce(fresh,body.groups);sameHead(state,fresh);mergeAuthority(state.auth.ctx,fresh.auth.ctx);const receipt={acknowledged:true,caseId,scope:state.scope,requestId:body.request_id,aclRevision:state.policy.revision,...readPin};await commit(state.auth.ctx,attempt.prior?[]:securityWrites(state,attempt,'case-fields-read',receipt,readPin));return result;
 }
 async function engagementCaseSaveDetails(principal,engagementId,caseId,body){
  requireBody(body,['request_id','expectedRevision','expectedAclRevision','groups','sourceBindings','geometryBindings','statement','legacyMigration','originMigration']);const state=await stateFor(principal,engagementId,caseId),groups=Object.keys(body.groups||{});enforce(state,groups,'update');if(body.expectedAclRevision!==state.policy?.revision)fail(409,'Review current case field permissions before changing protected content.');
  if(body.legacyMigration)enforce(state,engagementCaseGroups,'update');if(body.geometryBindings?.length&&!groups.includes('location'))fail(403,'Geometry protection changes require explicit location field update permission.');for(const binding of body.sourceBindings||[])enforce(state,binding.groups,'update');
  await canonical(state,groups);if(typeof saveCaseDetails!=='function')fail(503,'Shared protected case mutation is not configured.');
  const registryKey=engagementCaseSourceKey(state.scope.projectId),registryRow=await get(state.auth.ctx,registryKey.pk,registryKey.sk);validateEngagementCaseSources(registryRow,{scope:state.scope});
  return saveCaseDetails(principal,engagementId,{...body,eventId:caseId},{authorization:{caseId,userId:state.auth.userId,scope:state.scope,aclRevision:state.policy.revision,groups,action:'update'},policyRow:state.policy,registryRow,authorityState:state});
 }
 async function engagementCaseRegisterSourceIntent(principal,engagementId,caseId,body){
  requireBody(body,['request_id','expectedAclRevision','sha256','groups']);if(!sha256Pattern.test(body.sha256||''))fail(400,'Reserve the exact SHA256 of the original before uploading protected case evidence.');
  const state=await stateFor(principal,engagementId,caseId,{action:'edit',requiredRoles:['preparer','reviewer']}),permission=enforce(state,body.groups,'update');await resourceAccess(state.auth,'project',state.scope.projectId,'edit');
  if(body.expectedAclRevision!==state.policy.revision)fail(409,'Review current case field permissions before reserving a protected original.');
  const attempt=await request(state,body.request_id,'case-source-intent',body);if(attempt.prior){await commit(state.auth.ctx);return {...attempt.prior.value.receipt,access:permission};}
  await canonical(state);const key=engagementCaseSourceKey(state.scope.projectId),prior=await get(state.auth.ctx,key.pk,key.sk);validateEngagementCaseSources(prior,{scope:state.scope});
  // A pending marker is security metadata only. It is never accepted as an
  // assessment citation or a provider original; matching is already by SHA.
  const next=mergeEngagementCaseSources({row:prior,scope:state.scope,bindings:[{engagementId,caseId,groups:body.groups,sourceSha256:body.sha256,versionIds:[`pending:${body.sha256}`]}]}),changed=stableJson(prior.value)!==stableJson(next.value),fresh=await stateFor(principal,engagementId,caseId,{action:'edit',requiredRoles:['preparer','reviewer']});enforce(fresh,body.groups,'update');sameHead(state,fresh);mergeAuthority(state.auth.ctx,fresh.auth.ctx);
  const receipt={acknowledged:true,caseId,scope:state.scope,requestId:body.request_id,aclRevision:state.policy.revision,sourceSha256:body.sha256,groups:copy(body.groups),registryRevision:changed?next.revision:prior.revision,sourceIntentId:body.request_id};
  await commit(state.auth.ctx,[...(changed?[next]:[]),...securityWrites(state,attempt,'case-source-intent',receipt,{sourceSha256:body.sha256,groups:copy(body.groups)})]);return {...receipt,access:permission};
 }
 async function protectionWrites({state,prepared,auth=state.auth}){
  const scope={accountId:prepared.core.accountId,projectId:prepared.core.projectId,workspaceId:state.target.value.workspace_id,engagementId:prepared.core.id},key=engagementCaseSourceKey(scope.projectId),prior=await get(auth.ctx,key.pk,key.sk),protection=typeof protectionOf==='function'?await protectionOf({state,prepared,auth}):prepared.caseProtection;
  if(!protection||!Array.isArray(protection.bindings))fail(503,'Canonical current/history protected source closure is required before promotion.');
  if(!prior){const hints=await store.list(key.pk,'ENGAGEMENT#');if(hints.some(hint=>hint.value.resource_id!==scope.engagementId))fail(503,'Initialize all existing native engagement privacy coverage before promoting new protection.');}
  const next=mergeEngagementCaseSources({row:prior,scope,bindings:protection.bindings,initialize:!prior});return prior&&stableJson(prior.value)===stableJson(next.value)?[]:[next];
 }
 async function engagementInitializeCasePrivacy(principal,projectId,body){
  requireBody(body,['request_id']);if(!uuidPattern.test(body.request_id||''))fail(400,'Use an explicit privacy-initialization request UUID.');const auth=await authenticate(principal,{enroll:false}),project=(await resourceAccess(auth,'project',projectId,'manage_access')).target,scope={accountId:project.value.account_id,projectId,workspaceId:project.value.workspace_id},key=engagementCaseSourceKey(projectId),prior=await get(auth.ctx,key.pk,key.sk);
  const requestKey=`ENGAGEMENT_CASE_REQUEST#${body.request_id}`,previous=await get(auth.ctx,requestKey,'PROFILE'),inputSha256=hash(stableJson({operation:'case-privacy-initialize',scope,input:body}));
  if(previous&&(previous.value.userId!==auth.userId||previous.value.issuer!==principal.issuer||previous.value.subject!==principal.subject||previous.value.inputSha256!==inputSha256))fail(409,'That privacy-initialization UUID belongs to another project or native identity.');
  if(typeof initializationBindings!=='function')fail(503,'Bounded canonical legacy privacy initialization is not configured.');const bindings=await initializationBindings({auth,project}),next=mergeEngagementCaseSources({row:prior,scope,bindings,initialize:!prior}),changed=!prior||stableJson(prior.value)!==stableJson(next.value),result={initialized:true,projectId,accountId:scope.accountId,workspaceId:scope.workspaceId,registryRevision:changed?next.revision:prior.revision,protectedSources:next.value.bindings.length,caseGrantsCreated:0};
  const writes=changed?[next]:[];if(!previous)writes.push(record(requestKey,'PROFILE',{object_type:'engagement_case_request',userId:auth.userId,issuer:principal.issuer,subject:principal.subject,inputSha256,status:'acknowledged',receipt:result}),record(`AUDIT#case-${body.request_id}`,'PROFILE',{object_type:'audit_event',action:'case-privacy-initialize',scope,userId:auth.userId,issuer:principal.issuer,subject:principal.subject,at:iso(),requestId:body.request_id,registryRevision:result.registryRevision}));await commit(auth.ctx,writes);return result;
 }
 return {engagementCaseAccess,engagementCaseAcl,engagementCaseSetAcl,engagementCaseDetails,engagementCaseSaveDetails,engagementCaseRegisterSourceIntent,engagementInitializeCasePrivacy,protectionWrites};
}
