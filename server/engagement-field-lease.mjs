// Canonical foreground field permissions. Offline decryption cannot observe a
// remote revocation; repository writes always recheck current server authority.
import {createHash} from 'node:crypto';
import {normalizeFieldDevicePolicy,fieldDevicePolicyDigestInput,assertFieldDeviceLease} from '../src/lib/field-device-policy.js';
import {stableJson,uuidPattern} from '../src/lib/engagement-domain.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status,statusCode:status});};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes('..');
const scopeKeys=['accountId','projectId','workspaceId','engagementId','userId'];
const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export const defaultAuthenticatedFieldPolicy=Object.freeze({schemaVersion:1,offlineAllowed:true,allowSourceOriginals:true,allowedSensitivities:['internal'],maxOfflineHours:8,autoLockMinutes:10,retentionHours:72});
export function authenticatedFieldPolicies({engagementPolicy,projectPolicy}={}){
 if(projectPolicy!==undefined&&(!object(projectPolicy)||Object.keys(projectPolicy).some(key=>!['schemaVersion','uploadAllowed','devicePolicy'].includes(key))||projectPolicy.schemaVersion!==1||typeof projectPolicy.uploadAllowed!=='boolean'))fail(403,'The project field policy needs an explicit supported configuration.');
 if(projectPolicy?.uploadAllowed===false)fail(403,'This project’s current policy prevents field uploads.');
 const configured=[engagementPolicy,projectPolicy?.devicePolicy].filter(value=>value!==undefined&&value!==null).map(normalizeFieldDevicePolicy);
 const source=configured.length?configured:[defaultAuthenticatedFieldPolicy],allowed=source[0].allowedSensitivities.filter(value=>source.every(policy=>policy.allowedSensitivities.includes(value)));
 if(!allowed.length)fail(403,'The project and engagement device policies have no common permitted sensitivity.');
 const devicePolicy=normalizeFieldDevicePolicy({schemaVersion:1,offlineAllowed:source.every(policy=>policy.offlineAllowed),allowSourceOriginals:source.every(policy=>policy.allowSourceOriginals),allowedSensitivities:allowed,maxOfflineHours:Math.min(...source.map(policy=>policy.maxOfflineHours)),autoLockMinutes:Math.min(...source.map(policy=>policy.autoLockMinutes)),retentionHours:Math.min(...source.map(policy=>policy.retentionHours))});
 return {devicePolicy,policySha256:hash(fieldDevicePolicyDigestInput(devicePolicy)),policySource:configured.length?'configured_intersection':'app_defaults',engagementPolicySha256:hash(stableJson(engagementPolicy??null)),projectPolicySha256:hash(stableJson(projectPolicy??null))};
}
function checkedScope(scope){if(!exact(scope,scopeKeys)||!scopeKeys.every(key=>id(scope[key]))||!uuidPattern.test(scope.engagementId))fail(403,'Use the exact verified user and field engagement scope.');return scope;}
export function engagementFieldLeaseKey(engagementId,leaseId){if(!uuidPattern.test(engagementId||'')||!uuidPattern.test(leaseId||''))fail(400,'Use the exact engagement and server field lease identities.');return {pk:`ENGAGEMENT#${engagementId}`,sk:`FIELD_LEASE#${leaseId}`};}
const valueKeys=['object_type','schemaVersion','id','scope','issuer','subject','status','devicePolicy','deviceLease','policySha256','engagementPolicySha256','projectPolicySha256','issuedAt','expiresAt','retentionReviewAt','history'];
function caseScopeOf(value){if(value===undefined)return;if(!exact(value,['caseIds','aclRevision'])||!Array.isArray(value.caseIds)||!value.caseIds.length||value.caseIds.length>16||new Set(value.caseIds).size!==value.caseIds.length||!value.caseIds.every(id=>uuidPattern.test(id||''))||!Number.isSafeInteger(value.aclRevision)||value.aclRevision<1)fail(409,'Retain the exact bounded native case scope and reviewed access revision.');return {caseIds:[...value.caseIds].sort(),aclRevision:value.aclRevision};}
export const normalizeEngagementFieldLeaseCaseScope=caseScopeOf;
const leaseKeys=value=>[...valueKeys,...(Object.hasOwn(value||{},'caseScope')?['caseScope']:[])];
function checkRow(row,{scope,issuer,subject,policies}={}){
 checkedScope(scope);const value=row?.value;if(!uuidPattern.test(value?.id||''))fail(403,'The exact server field permission is unavailable.');const key=engagementFieldLeaseKey(scope.engagementId,value.id);
 if(row?.pk!==key.pk||row.sk!==key.sk||!Number.isSafeInteger(row.revision)||row.revision<1||!exact(value,leaseKeys(value))||value.object_type!=='engagement_field_lease'||value.schemaVersion!==1||stableJson(value.scope)!==stableJson(scope)||value.issuer!==issuer||value.subject!==subject||!['active','revoked'].includes(value.status)||!timestamp(value.issuedAt)||!timestamp(value.expiresAt)||!timestamp(value.retentionReviewAt)||!Array.isArray(value.history)||value.history.length!==row.revision-1||value.history.length>100)fail(403,'The server field permission belongs to another identity or has an invalid history.');
 const caseScope=caseScopeOf(value.caseScope);if(stableJson(caseScope)!==stableJson(value.caseScope))fail(409,'Retain the canonical native case scope.');
 if(policies&&['policySha256','engagementPolicySha256','projectPolicySha256'].some(key=>value[key]!==policies[key]))fail(409,'Field device rules changed. Review the current policy and explicitly renew this field permission.');
 if(stableJson(value.devicePolicy)!==stableJson(normalizeFieldDevicePolicy(value.devicePolicy))||hash(fieldDevicePolicyDigestInput(value.devicePolicy))!==value.policySha256)fail(409,'The retained field policy differs from its exact digest.');
 if(value.deviceLease?.issuedAt!==value.issuedAt||value.deviceLease.expiresAt!==value.expiresAt||value.deviceLease.retentionReviewAt!==value.retentionReviewAt)fail(409,'The server field permission dates differ from its device copy.');
 if(!['policySha256','engagementPolicySha256','projectPolicySha256'].every(key=>/^[a-f0-9]{64}$/.test(value[key]||'')))fail(409,'Retain exact field policy hashes.');
 try{assertFieldDeviceLease(value.devicePolicy,value.deviceLease,{scope:{accountId:scope.accountId,projectId:scope.projectId,engagementId:scope.engagementId},policySha256:value.policySha256,now:Date.parse(value.issuedAt)});}catch(error){fail(409,error.message);}
 for(const [index,entry]of value.history.entries()){
  if(!exact(entry,['revision','permission'])||entry.revision!==index+1||!exact(entry.permission,leaseKeys(entry.permission).filter(key=>key!=='history'))||entry.permission.id!==value.id||stableJson(entry.permission.scope)!==stableJson(scope)||entry.permission.issuer!==issuer||entry.permission.subject!==subject||stableJson(caseScopeOf(entry.permission.caseScope)?.caseIds)!==stableJson(caseScope?.caseIds))fail(409,'Retain the complete earlier field permission history without changing its identity or case scope.');
  if(!timestamp(entry.permission.issuedAt)||!timestamp(entry.permission.expiresAt)||!timestamp(entry.permission.retentionReviewAt)||Date.parse(entry.permission.issuedAt)>Date.parse(value.issuedAt))fail(409,'Earlier field permission dates must remain canonical and precede renewal.');
 }
 return value;
}
export function issueEngagementFieldLease({leaseId,scope,issuer,subject,policies,at,authorityUntil=Infinity,previous,caseScope}={}){
 checkedScope(scope);engagementFieldLeaseKey(scope.engagementId,leaseId);
 if(typeof issuer!=='string'||!issuer.startsWith('https://')||typeof subject!=='string'||!subject||!timestamp(at)||!policies?.devicePolicy)fail(400,'Use the server field identity, reviewed policy and exact issuance time.');
 const time=Date.parse(at),policy=policies.devicePolicy;
 if(!policy.offlineAllowed)fail(403,'The current field device policy prevents storing records offline.');
 const retention=time+policy.retentionHours*3600000,expiry=Math.min(time+policy.maxOfflineHours*3600000,retention,authorityUntil);
 if(!Number.isFinite(expiry)||expiry<=time)fail(403,'Current field authority expires before a device permission can be prepared.');
 let revision=1,history=[];
 const boundCaseScope=caseScopeOf(caseScope);
 if(previous){const old=checkRow(previous,{scope,issuer,subject});if(old.id!==leaseId||old.status!=='active')fail(403,'A revoked field permission cannot be renewed. Prepare a new authorized capture.');if(stableJson(old.caseScope?.caseIds)!==stableJson(boundCaseScope?.caseIds))fail(409,'A field permission cannot change its case scope. Prepare a separate case context before capturing originals.');if(old.history.length>=100)fail(413,'This field permission reached its renewal history limit. Prepare a new field context.');revision=previous.revision+1;const {history:prior,...permission}=old;history=[...prior,{revision:previous.revision,permission}];}
 const deviceLease={format:'esia-local-field-device-lease',schemaVersion:1,scope:{accountId:scope.accountId,projectId:scope.projectId,engagementId:scope.engagementId},policySha256:policies.policySha256,issuedAt:at,expiresAt:new Date(expiry).toISOString(),retentionReviewAt:new Date(retention).toISOString()};
 const value={object_type:'engagement_field_lease',schemaVersion:1,id:leaseId,scope:structuredClone(scope),issuer,subject,status:'active',devicePolicy:structuredClone(policy),deviceLease,policySha256:policies.policySha256,engagementPolicySha256:policies.engagementPolicySha256,projectPolicySha256:policies.projectPolicySha256,issuedAt:at,expiresAt:deviceLease.expiresAt,retentionReviewAt:deviceLease.retentionReviewAt,history,...(boundCaseScope?{caseScope:boundCaseScope}:{})};
 const row={...engagementFieldLeaseKey(scope.engagementId,leaseId),revision,value};validateEngagementFieldLease(row,{scope,issuer,subject,policies,now:time});return row;
}
export function validateEngagementFieldLease(row,{scope,issuer,subject,policies,now=Date.now(),sensitivity,includesOriginals=false}={}){
 const value=checkRow(row,{scope,issuer,subject,policies});if(value.status!=='active')fail(403,'This field permission was revoked. Keep the encrypted device draft and reconnect for review.');
 try{assertFieldDeviceLease(value.devicePolicy,value.deviceLease,{scope:{accountId:scope.accountId,projectId:scope.projectId,engagementId:scope.engagementId},policySha256:value.policySha256,now,sensitivity,includesOriginals});}catch(error){fail(403,error.message);}
 return {id:value.id,revision:row.revision,scope:structuredClone(scope),policySha256:value.policySha256,expiresAt:value.expiresAt,retentionReviewAt:value.retentionReviewAt,devicePolicy:structuredClone(value.devicePolicy),deviceLease:structuredClone(value.deviceLease),...(value.caseScope?{caseScope:structuredClone(value.caseScope)}:{})};
}
