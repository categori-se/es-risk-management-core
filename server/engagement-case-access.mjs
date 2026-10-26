// Native security metadata. Portable events, local role labels and encryption
// secrets are never authority to grant case access. The caller authenticates
// the native User, reads these rows freshly and commits their CAS conditions.
import {stableJson,uuidPattern,sha256Pattern} from '../src/lib/engagement-domain.js';

export const engagementCaseGroups=Object.freeze(['identities','location','investigation']);
export const engagementCaseAccessLimits=Object.freeze({metadataBytes:128*1024,cases:256,users:64,sources:1000,versions:1000});
const fail=(message,statusCode=409)=>{throw Object.assign(Error(message),{statusCode});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes('..')&&!['__proto__','constructor','prototype','user_unknown'].includes(value);
const instant=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const scopeFields=['accountId','projectId','workspaceId','engagementId'];
const sameScope=(value,scope,fields=scopeFields)=>exact(value,fields)&&fields.every(key=>opaque(value[key])&&value[key]===scope[key]);
const bounded=value=>{if(Buffer.byteLength(JSON.stringify(value))>engagementCaseAccessLimits.metadataBytes)fail('Case security metadata exceeds its explicit128KiB bound.',413);};
const uniqueIds=(value,maximum=engagementCaseAccessLimits.users)=>Array.isArray(value)&&value.length<=maximum&&new Set(value).size===value.length&&value.every(opaque);
export function normalizeEngagementCaseGroups(groups,{allowEmpty=false}={}){
 if(!Array.isArray(groups)||groups.length>3||!allowEmpty&&!groups.length||new Set(groups).size!==groups.length||!groups.every(group=>engagementCaseGroups.includes(group)))fail('Choose explicit distinct protected case field groups.',400);
 return engagementCaseGroups.filter(group=>groups.includes(group));
}
export function engagementCaseAccessKey(engagementId){if(!uuidPattern.test(engagementId||''))fail('Use the exact native engagement UUID.',400);return {pk:`ENGAGEMENT#${engagementId}`,sk:'CASE_ACCESS'};}
export function engagementCaseSourceKey(projectId){if(!opaque(projectId))fail('Use the exact source project identity.',400);return {pk:`PROJECT#${projectId}`,sk:'CASE_SOURCE_SET'};}

function validateRule(rule){
 if(!exact(rule,['caseId','managers','grants','createdBy','createdAt','updatedBy','updatedAt'])||!uuidPattern.test(rule.caseId||'')||!uniqueIds(rule.managers)||!rule.managers.length||!Array.isArray(rule.grants)||rule.grants.length>engagementCaseAccessLimits.users||!opaque(rule.createdBy)||!opaque(rule.updatedBy)||!instant(rule.createdAt)||!instant(rule.updatedAt)||rule.updatedAt<rule.createdAt)fail('Retain exact native case managers, grants and security attribution.');
 const seen=new Set();for(const grant of rule.grants){
  if(!exact(grant,['userId','groups','custodyExport','expiresAt'])||!opaque(grant.userId)||seen.has(grant.userId)||!exact(grant.groups,engagementCaseGroups)||typeof grant.custodyExport!=='boolean'||!instant(grant.expiresAt)||grant.expiresAt<=rule.createdAt)fail('Native case grants require exact Users, separated fields and finite expiry.');seen.add(grant.userId);
  for(const actions of Object.values(grant.groups))if(!Array.isArray(actions)||actions.length>2||new Set(actions).size!==actions.length||actions.some(action=>!['read','update'].includes(action))||actions.includes('update')&&!actions.includes('read'))fail('Case update permission also requires read permission for that same field group.');
  if(grant.custodyExport&&!engagementCaseGroups.every(group=>grant.groups[group].includes('read')))fail('Protected custody export requires explicit read access to all three field groups.');
 }
 return rule;
}
export function validateEngagementCaseAccess(row,{scope}={}){
 if(row===null||row===undefined)return null;const key=engagementCaseAccessKey(scope?.engagementId),value=row.value;
 if(row.pk!==key.pk||row.sk!==key.sk||!Number.isSafeInteger(row.revision)||row.revision<1||!exact(value,['object_type','schemaVersion','scope','cases'])||value.object_type!=='engagement_case_access'||value.schemaVersion!==1||!sameScope(value.scope,scope)||!Array.isArray(value.cases)||value.cases.length>engagementCaseAccessLimits.cases)fail('Case policy differs from its exact native engagement and custody scope.');bounded(value);
 const seen=new Set();for(const rule of value.cases){validateRule(rule);if(seen.has(rule.caseId))fail('A case policy cannot repeat an event identity.');seen.add(rule.caseId);}return structuredClone(row);
}
export function setEngagementCaseRule({row,scope,caseId,managers,grants,actorId,at}={}){
 const prior=validateEngagementCaseAccess(row,{scope}),old=prior?.value.cases.find(rule=>rule.caseId===caseId);if(!opaque(actorId)||!instant(at))fail('Case security changes require trusted current native attribution.');
 const rule=validateRule({caseId,managers:structuredClone(managers),grants:structuredClone(grants),createdBy:old?.createdBy||actorId,createdAt:old?.createdAt||at,updatedBy:actorId,updatedAt:at}),key=engagementCaseAccessKey(scope.engagementId),cases=(prior?.value.cases||[]).filter(rule=>rule.caseId!==caseId);cases.push(rule);cases.sort((a,b)=>a.caseId.localeCompare(b.caseId));
 const result={...key,revision:(prior?.revision||0)+1,value:{object_type:'engagement_case_access',schemaVersion:1,scope:structuredClone(scope),cases}};return validateEngagementCaseAccess(result,{scope});
}
export function engagementCasePermissions(row,{scope,caseId,userId,now=Date.now(),canManageEngagement=false}={}){
 const policy=validateEngagementCaseAccess(row,{scope}),rule=policy?.value.cases.find(rule=>rule.caseId===caseId),grant=rule?.grants.find(grant=>grant.userId===userId),active=Boolean(grant&&Date.parse(grant.expiresAt)>now);
 if(!uuidPattern.test(caseId||'')||!opaque(userId)||!Number.isSafeInteger(now)||now<0)fail('Use verified current case permission inputs.',400);
 const groups=Object.fromEntries(engagementCaseGroups.map(group=>[group,{read:active&&grant.groups[group].includes('read'),update:active&&grant.groups[group].includes('update')}]));
 return {format:'esia-native-case-access',schemaVersion:1,caseId,scope:structuredClone(scope),userId,registered:Boolean(rule),aclRevision:policy?.revision||0,groups,canManageAccess:Boolean(rule?.managers.includes(userId)&&canManageEngagement),canCustodyExport:Boolean(active&&grant.custodyExport&&engagementCaseGroups.every(group=>groups[group].read)),...(active?{expiresAt:grant.expiresAt}:{})};
}
export function assertEngagementCaseAccess(row,options={}){
 const groups=normalizeEngagementCaseGroups(options.groups||engagementCaseGroups),permission=engagementCasePermissions(row,options),action=options.action||'read';
 const allowed=action==='manage_access'?permission.canManageAccess:action==='custody'?permission.canCustodyExport:['read','update'].includes(action)&&groups.every(group=>permission.groups[group][action]);
 if(!allowed)fail('Current separate native case permission is required for these protected fields.',403);
 return permission;
}

export function validateEngagementCaseSources(row,{scope,requireCoverage=true}={}){
 if(row===null||row===undefined){if(requireCoverage)fail('Protected source coverage needs explicit native initialization before private document access.',503);return null;}
 const value=row.value,key=engagementCaseSourceKey(scope?.projectId),fields=['accountId','projectId','workspaceId'];
 if(row.pk!==key.pk||row.sk!==key.sk||!Number.isSafeInteger(row.revision)||row.revision<1||!exact(value,['object_type','schemaVersion','coverageVersion','scope','bindings'])||value.object_type!=='engagement_case_source_set'||value.schemaVersion!==1||value.coverageVersion!==1||!sameScope(value.scope,scope,fields)||!Array.isArray(value.bindings)||value.bindings.length>engagementCaseAccessLimits.sources)fail('Protected source registry differs from its exact account/project/workspace coverage.');bounded(value);
 const seen=new Set();for(const binding of value.bindings){
  if(!exact(binding,['engagementId','caseId','groups','sourceSha256','versionIds'])||!uuidPattern.test(binding.engagementId||'')||!uuidPattern.test(binding.caseId||'')||!sha256Pattern.test(binding.sourceSha256||'')||!uniqueIds(binding.versionIds,engagementCaseAccessLimits.versions)||!binding.versionIds.length)fail('Protected source bindings require exact native cases and immutable source identities.');normalizeEngagementCaseGroups(binding.groups);const key=stableJson([binding.engagementId,binding.caseId,binding.sourceSha256]);if(seen.has(key))fail('Protected source registry repeats a case/hash identity.');seen.add(key);
 }return structuredClone(row);
}
export function mergeEngagementCaseSources({row,scope,bindings=[],initialize=false}={}){
 const prior=validateEngagementCaseSources(row,{scope,requireCoverage:!initialize});if(!Array.isArray(bindings))fail('Supply a bounded explicit protected source binding list.');
 const merged=new Map();for(const binding of [...(prior?.value.bindings||[]),...bindings]){
  const key=stableJson([binding.engagementId,binding.caseId,binding.sourceSha256]),old=merged.get(key);merged.set(key,{...structuredClone(binding),groups:normalizeEngagementCaseGroups([...(old?.groups||[]),...binding.groups].filter((group,index,values)=>values.indexOf(group)===index)),versionIds:[...new Set([...(old?.versionIds||[]),...binding.versionIds])].sort()});
 }
 const value={object_type:'engagement_case_source_set',schemaVersion:1,coverageVersion:1,scope:Object.fromEntries(['accountId','projectId','workspaceId'].map(key=>[key,scope[key]])),bindings:[...merged.values()].sort((a,b)=>stableJson(a).localeCompare(stableJson(b)))};
 const key=engagementCaseSourceKey(scope.projectId),result={...key,revision:(prior?.revision||0)+1,value};return validateEngagementCaseSources(result,{scope});
}
export function protectedEngagementCaseSourceBindings(row,{scope,sha256,versionId,requireCoverage=true}={}){
 const registry=validateEngagementCaseSources(row,{scope,requireCoverage});if(!sha256Pattern.test(sha256||''))fail('Read only an exact immutable source hash.',400);
 return (registry?.value.bindings||[]).filter(binding=>binding.sourceSha256===sha256||versionId&&binding.versionIds.includes(versionId)).map(binding=>structuredClone(binding));
}
