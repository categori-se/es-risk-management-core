import {sealMonitoringPayload,unlockMonitoringPayload} from '../components/monitoring-private.js';
import {normalizeFieldDevicePolicy,validateFieldDeviceLease,fieldDevicePolicySha256} from './field-device-policy.js';
import {sha256Bytes} from './field-drafts.js';
import {getCognitoAuthConfig} from './auth-config.js';
import {validateAuthenticatedFieldLinks} from './engagement-field-evidence.js';
import {additionalFieldLinks} from './field-record-details.js';

const clone=value=>structuredClone(value),object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=message=>{throw Error(message);};
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes('..');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const configured=getCognitoAuthConfig();
export const authenticatedFieldIssuer=`https://cognito-idp.${configured.region}.amazonaws.com/${configured.userPoolId}`;
const scopeKeys=['apiOrigin','issuer','subject','userId','accountId','workspaceId','projectId','engagementId'];
const linkNames=Object.keys(additionalFieldLinks),selectionKeys=['programId','cycleId','missionId','siteId','grievanceId','commitmentId','requirementId'];
const bounded=value=>String(value||'').slice(0,500);
const rows=(values,title)=>(values||[]).slice(0,100).map(item=>({id:item.id,label:bounded(title(item))}));

export function assertAuthenticatedFieldIdentity(value,expected={}){
 if(!object(value)||Object.keys(value).some(key=>!scopeKeys.includes(key))||scopeKeys.some(key=>typeof value[key]!=='string'||!value[key]||value[key].length>2048)||value.issuer!==authenticatedFieldIssuer||!['userId','accountId','workspaceId','projectId','engagementId'].every(key=>id(value[key]))||/[\u0000-\u001f\u007f]/.test(value.subject))fail('The prepared field identity is incomplete or belongs to another sign-in provider.');
 let origin;try{origin=new URL(value.apiOrigin);}catch{fail('The field API origin is invalid.');}
 if(origin.origin!==value.apiOrigin||origin.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(origin.hostname))fail('The field API origin is invalid.');
 if(Object.keys(expected).some(key=>value[key]!==expected[key]))fail('This prepared copy belongs to another signed-in identity, account, project or engagement.');
 return clone(value);
}

export async function authenticatedFieldScopeHash(identity,crypto=globalThis.crypto){assertAuthenticatedFieldIdentity(identity);return sha256Bytes(new TextEncoder().encode(JSON.stringify(scopeKeys.map(key=>identity[key]))),crypto);}
export async function authenticatedFieldRoutingPrefix({apiOrigin,accountId,projectId,engagementId,selection={}},crypto=globalThis.crypto){
 if(![accountId,projectId,engagementId].every(id))fail('Open field capture from the exact signed-in engagement.');
 return 'esia.authenticated-field-context.v1.'+await sha256Bytes(new TextEncoder().encode(JSON.stringify([apiOrigin,accountId,projectId,engagementId,normalizeAuthenticatedFieldSelection(selection)])),crypto)+'.';
}
export function normalizeAuthenticatedFieldSelection(value={}){if(!object(value)||Object.keys(value).some(key=>!selectionKeys.includes(key))||Object.values(value).some(value=>!id(value)))fail('Use exact field mission and related-record identifiers.');return Object.fromEntries(selectionKeys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));}
export function normalizeAuthenticatedFieldCaseScope(value){
 if(value===undefined)return;const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
 if(!object(value)||Object.keys(value).length!==2||!Object.hasOwn(value,'caseIds')||!Object.hasOwn(value,'aclRevision')||!Array.isArray(value.caseIds)||!value.caseIds.length||value.caseIds.length>16||new Set(value.caseIds).size!==value.caseIds.length||!value.caseIds.every(uuid)||!Number.isSafeInteger(value.aclRevision)||value.aclRevision<1)fail('Choose the exact server-prepared case scope before uploading.');
 return {caseIds:[...value.caseIds].sort(),aclRevision:value.aclRevision};
}
export async function authenticatedFieldSelectionHash(selection={},crypto=globalThis.crypto){return sha256Bytes(new TextEncoder().encode(JSON.stringify(normalizeAuthenticatedFieldSelection(selection))),crypto);}

export async function readAuthenticatedFieldContext(value,{apiOrigin,expected={},crypto=globalThis.crypto,selection={},requireServerSelection=false}={}){
 const e=value?.engagement,a=value?.serverAuthority||e?.serverAuthority,p=value?.project,u=value?.uploadProject;
 if(!object(e)||!object(a)||!object(p)||!object(u)||!id(e.id)||p.id!==e.projectId||a.projectId!==e.projectId||a.accountId!==e.accountId||!Number.isSafeInteger(e.revision)||e.revision<1||!Number.isSafeInteger(a.configurationRevision)||a.configurationRevision<1||!Array.isArray(a.permissions)||!a.permissions.some(x=>['edit','owner'].includes(x))||!Array.isArray(a.roles)||!a.roles.some(role=>['preparer','reviewer'].includes(role)))fail('Current engagement authoring and project access are required for field capture.');
 if(u.project_id!==e.projectId||u.account_id!==e.accountId||!id(u.workspace_id)||!Number.isSafeInteger(u.revision)||u.revision<1||!Array.isArray(u.permissions)||!u.permissions.some(x=>['write','owner'].includes(x))||u.field_capture_policy?.uploadAllowed===false)fail('This project does not currently permit field uploads.');
 const identity=assertAuthenticatedFieldIdentity({apiOrigin,issuer:a.issuer,subject:a.subject,userId:a.userId,accountId:a.accountId,workspaceId:u.workspace_id,projectId:a.projectId,engagementId:e.id},expected);
 if(!Number.isSafeInteger(a.headRevision)||a.headRevision<1||!hash(a.headSha256))fail('The current engagement did not identify its exact retained revision.');
 const devicePolicy=normalizeFieldDevicePolicy(value.devicePolicy);if(!devicePolicy||!devicePolicy.offlineAllowed||!devicePolicy.allowedSensitivities.includes('internal'))fail('Current field device rules do not allow internal offline records.');
 if(await fieldDevicePolicySha256(devicePolicy,{crypto})!==value.policySha256)fail('The current field policy checksum is inconsistent.');
 if(!['app_defaults','configured_intersection'].includes(value.policySource)||!object(value.capabilities))fail('The server did not describe the current field policy and capabilities.');
 selection=normalizeAuthenticatedFieldSelection(selection);if(requireServerSelection&&!same(normalizeAuthenticatedFieldSelection(value.selection),selection))fail('The prepared field mission changed during server policy review.');
 const baseLinks={assessmentIds:[],actionIds:[],requirement:null,context:{engagementId:e.id,...selection}};validateAuthenticatedFieldLinks(baseLinks,e);
 const candidates={requirementIds:rows(e.requirements,item=>item.title),findingIds:rows(e.findings,item=>item.rationale),commitmentIds:rows(e.obligations,item=>item.text||item.title),engagementActionIds:rows(e.actions,item=>item.description),observationIds:rows((e.assertions||[]).filter(item=>item.fieldCapture).map(item=>({id:item.fieldCapture.captureId,label:item.note||item.locator})),item=>item.label),grievanceIds:rows((e.events||[]).filter(item=>item.kind==='grievance'),item=>item.code||item.publicSummary),monitoringObligationIds:rows(e.monitoringObligations,item=>item.title||item.description),siteIds:rows([...new Map((e.missions||[]).flatMap(item=>item.monitoringPoints||[]).map(item=>[item.id,item])).values()],item=>item.label)};
 let budget=160000;const linkOptions={};for(const name of linkNames)linkOptions[name]=candidates[name].filter(item=>{try{validateAuthenticatedFieldLinks({...baseLinks,[name]:[item.id]},e);const size=new TextEncoder().encode(JSON.stringify(item)).length;if(size>budget)return false;budget-=size;return true;}catch{return false;}});
 return {identity,name:bounded(e.name),projectName:bounded(p.name||a.projectName),missionName:bounded((e.missions||[]).find(item=>item.id===selection.missionId)?.name),selection,revision:e.revision,configurationRevision:a.configurationRevision,uploadProject:clone(u),devicePolicy,policySha256:value.policySha256,policySource:value.policySource,linkOptions};
}

export async function createAuthenticatedFieldContext(response,options={}){
 const current=await readAuthenticatedFieldContext(response?.context,{...options,requireServerSelection:true});
 if(!id(response.leaseId)||!object(response.deviceLease))fail('The server did not issue an exact field device lease.');
 if(!Number.isSafeInteger(response.leaseRevision)||response.leaseRevision<1)fail('The server did not identify the current field lease revision.');
 const caseScope=normalizeAuthenticatedFieldCaseScope(response.caseScope),value={format:'esia-authenticated-field-context',schemaVersion:1,...current,leaseId:response.leaseId,leaseRevision:response.leaseRevision,deviceLease:clone(response.deviceLease),preparedAt:new Date(options.now??Date.now()).toISOString(),...(caseScope?{caseScope}:{})};
 await assertAuthenticatedFieldContext(value,options);return value;
}
export async function assertAuthenticatedFieldContext(value,{expected={},selection,crypto=globalThis.crypto,now=Date.now(),allowExpiredForRenewal=false}={}){
 const allowed=['format','schemaVersion','identity','name','projectName','missionName','selection','revision','configurationRevision','uploadProject','devicePolicy','policySha256','policySource','linkOptions','leaseId','leaseRevision','deviceLease','preparedAt','caseScope'];
 if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key))||value.format!=='esia-authenticated-field-context'||value.schemaVersion!==1||!id(value.leaseId)||!Number.isSafeInteger(value.leaseRevision)||value.leaseRevision<1||!Number.isSafeInteger(value.revision)||value.revision<1||!Number.isSafeInteger(value.configurationRevision)||value.configurationRevision<1||!hash(value.policySha256)||!Number.isFinite(Date.parse(value.preparedAt)))fail('Choose a supported prepared signed-in field context.');
 assertAuthenticatedFieldIdentity(value.identity,expected);
 const caseScope=normalizeAuthenticatedFieldCaseScope(value.caseScope);if(!same(caseScope,value.caseScope)||caseScope&&!caseScope.caseIds.includes(value.selection?.grievanceId))fail('The prepared case scope differs from its selected case.');
 if(selection!==undefined&&!same(normalizeAuthenticatedFieldSelection(value.selection),normalizeAuthenticatedFieldSelection(selection)))fail('This prepared copy belongs to another field mission or selected record.');
 for(const name of ['name','projectName','missionName'])if(typeof value[name]!=='string'||value[name].length>500)fail('Prepared labels exceed their bounds.');normalizeAuthenticatedFieldSelection(value.selection);
 if(!object(value.linkOptions)||Object.keys(value.linkOptions).some(key=>!linkNames.includes(key)))fail('Prepared field links are invalid.');
 for(const name of linkNames){const items=value.linkOptions[name];if(!Array.isArray(items)||items.length>100||new Set(items.map(item=>item?.id)).size!==items.length||items.some(item=>!object(item)||Object.keys(item).some(key=>!['id','label'].includes(key))||!id(item.id)||typeof item.label!=='string'||item.label.length>500))fail('Prepared field links are invalid.');}
 const u=value.uploadProject,i=value.identity;if(!object(u)||u.project_id!==i.projectId||u.account_id!==i.accountId||u.workspace_id!==i.workspaceId||u.field_capture_policy?.uploadAllowed===false)fail('The prepared upload destination has changed.');
 if(await fieldDevicePolicySha256(value.devicePolicy,{crypto})!==value.policySha256)fail('The prepared device policy changed.');
 await validateFieldDeviceLease(value.devicePolicy,value.deviceLease,{scope:{accountId:i.accountId,projectId:i.projectId,engagementId:i.engagementId},crypto,now:allowExpiredForRenewal?Date.parse(value.deviceLease?.issuedAt)+1:now,sensitivity:'internal'});return value;
}
export async function sealAuthenticatedFieldContext(context,passphrase,{crypto=globalThis.crypto,now=Date.now()}={}){
 await assertAuthenticatedFieldContext(context,{crypto,now});return {format:'esia-encrypted-authenticated-field-context',schemaVersion:1,restricted:await sealMonitoringPayload(context,passphrase,crypto)};
}
export async function openAuthenticatedFieldContext(pack,passphrase,options={}){
 if(!object(pack)||Object.keys(pack).some(key=>!['format','schemaVersion','restricted'].includes(key))||pack.format!=='esia-encrypted-authenticated-field-context'||pack.schemaVersion!==1||JSON.stringify(pack).length>512000)fail('Choose a bounded encrypted signed-in field context.');
 return assertAuthenticatedFieldContext(await unlockMonitoringPayload(pack.restricted,passphrase,options.crypto),options);
}
export function assertFreshAuthenticatedFieldContext(prepared,current){
 assertAuthenticatedFieldIdentity(current.identity,prepared.identity);
 if(prepared.policySha256!==current.policySha256||!same(prepared.devicePolicy,current.devicePolicy)||!same(prepared.selection,current.selection)||prepared.uploadProject.revision!==current.uploadProject.revision)fail('Field permissions or device rules changed. Keep the encrypted draft and explicitly prepare current access before uploading.');
 return true;
}
