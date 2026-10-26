// Server-internal proof of unchanged, already committed private history. This
// never returns source bytes and is never accepted from HTTP or portable JSON.
import {createHash} from 'node:crypto';
import {assertEngagement as assert,isObject,stableJson} from '../src/lib/engagement-domain.js';
import {monitoringProtectionClosure,isProtectedMonitoringAssertion} from '../src/lib/monitoring-protection.js';
import {createEngagementOriginArchiveContext} from './engagement-origin-archives.mjs';
import {validateEngagementCaseSources} from './engagement-case-access.mjs';

const proofs=new WeakMap(),digest=value=>createHash('sha256').update(stableJson(value)).digest('hex'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const views=packages=>packages.flatMap(pack=>[{...pack.engagement,...pack.entities},...(pack.baselines||[])]);
const sourceVersions=project=>project.resources.flatMap(resource=>resource.versions.map(version=>({...version,resourceId:resource.id})));
function protection(project,packages,origins=[],registry){
 const all=[...views(packages),...origins.flatMap(origin=>views(origin.packages))],combined={events:all.flatMap(view=>view.events||[]),assertions:all.flatMap(view=>view.assertions||[]),missions:all.flatMap(view=>view.missions||[]),indicators:all.flatMap(view=>view.indicators||[]),measurements:all.flatMap(view=>view.measurements||[]),sourceVersions:[...sourceVersions(project),...origins.flatMap(origin=>sourceVersions(origin.project))]};
 const closure=monitoringProtectionClosure(combined);for(const binding of registry?.value.bindings||[]){closure.sha256s.add(binding.sourceSha256);if(packages.some(pack=>pack.engagement.id===binding.engagementId))closure.eventIds.add(binding.caseId);}for(const version of sourceVersions(project))if(closure.sha256s.has(version.sha256))closure.versionIds.add(version.id);
 const ids=new Set([...closure.eventIds,...closure.directAssertionIds,...closure.versionIds,...closure.sha256s,...closure.missionIds,...closure.missionPointIds,...closure.indicatorIds,...closure.measurementIds,...closure.captureIds]);
 const rows=[];for(const pack of packages)for(const [kind,records]of Object.entries(pack.entities))for(const row of records)rows.push({kind,id:row.id,row});
 const refers=value=>{if(typeof value==='string')return ids.has(value);if(Array.isArray(value))return value.some(refers);if(isObject(value))return Object.entries(value).some(([key,item])=>!['createdBy','updatedBy','reviewedBy','actorId','engagementId','programId','cycleId'].includes(key)&&refers(item));return false;};
 let changed=true;while(changed){changed=false;for(const item of rows)if(!ids.has(item.id)&&refers(item.row)){ids.add(item.id);changed=true;}}
 const protectedRows=rows.filter(item=>ids.has(item.id)),bindings=new Set();
 for(const view of all)for(const assertion of view.assertions||[])for(const row of [assertion,...(assertion.history||[])])if(row.fieldCapture&&isProtectedMonitoringAssertion(row,closure))bindings.add(digest({engagementId:view.engagement?.id||view.id,record:row}));
 return {closure,ids,protectedRows,bindings};
}
const originDigest=origins=>digest([...(origins||new Map())].map(([sha,value])=>{assert(value.bytes instanceof Uint8Array&&hash(value.bytes)===sha,'Retained origin proof bytes differ from their exact archive.',409);return [sha,value.bytes.byteLength];}).sort(([a],[b])=>a.localeCompare(b)));
function lookup(token){const proof=token&&proofs.get(token);assert(proof,'Use a registered internal retained-source proof, never portable proof fields.',403);return proof;}

/** Call only after the adapter verifies the exact current canonical HEAD,
 * snapshot/provider receipt, ordinary document rights and fresh case policy.
 * `mutation` is a separately case-authorized exact command, not browser proof. */
export function registerEngagementRetainedSourceProof({snapshot,project,packages,sources,retainedSources=sources,scope,identity,registry,originArchives=new Map(),mutation}={}){
 assert(isObject(identity)&&['userId','issuer','subject'].every(key=>typeof identity[key]==='string'&&identity[key].length>0&&identity[key].length<=1000),'Bind retained private integrity to the currently verified native identity.',403);
 assert(snapshot?.bytes instanceof Uint8Array&&snapshot.bytes.byteLength===snapshot.sizeBytes&&hash(snapshot.bytes)===snapshot.sha256&&typeof snapshot.versionId==='string'&&snapshot.versionId&&snapshot.versionId!=='null','Pin a verified immutable retained snapshot and provider version.',409);
 assert(snapshot.bytes.byteLength<=32*1024*1024&&sources instanceof Map&&sources.size<=100&&Array.isArray(packages)&&packages.length===1,'Use one bounded canonical native engagement head.');
 let stored;try{stored=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(snapshot.bytes));}catch{assert(false,'The retained proof snapshot is invalid.');}
 const core=packages[0]?.engagement;assert(stored.format==='esia-authenticated-engagement-state'&&stored.schemaVersion===1&&digest(stored.packages)===digest(packages)&&core.accountId===scope.accountId&&core.projectId===scope.projectId&&core.id===scope.engagementId&&project.accountId===scope.accountId&&project.id===scope.projectId,'Retained proof scope differs from the exact committed packages.',409);
 assert(retainedSources instanceof Map&&stored.sourceSha256===digest([...retainedSources]),'The retained source proof differs from current exact original receipts.',409);
 assert(sources.size>=retainedSources.size&&sources.size-retainedSources.size<=10&&[...retainedSources].every(([id,pin])=>sources.has(id)&&digest(sources.get(id))===digest(pin)),'Source registration may add up to10 verified originals while preserving every retained exact original receipt.',409);
 if(registry)validateEngagementCaseSources(registry,{scope});const originContext=createEngagementOriginArchiveContext(originArchives),origins=[...originArchives.keys()].map(sha=>originContext.read(sha)),part=protection(project,packages,origins,registry),descriptors=new Map(sourceVersions(project).map(row=>[row.id,row])),versions=new Map();
 for(const [id,receipt]of sources)if(part.closure.versionIds.has(id)||part.closure.sha256s.has(receipt.sha256)){
  const descriptor=descriptors.get(id);assert(descriptor&&descriptor.sha256===receipt.sha256&&descriptor.size===receipt.sizeBytes&&receipt.kind==='source'&&receipt.versionId&&receipt.versionId!=='null'&&typeof receipt.bucket==='string'&&typeof receipt.key==='string'&&receipt.key.startsWith(`tenants/${scope.accountId}/projects/${scope.projectId}/documents/`),'A retained private source needs its exact current immutable original receipt.',409);versions.set(id,structuredClone(receipt));
 }
 assert(versions.size>0,'Use retained proof only for unchanged protected originals.');
 if(mutation)assert(mutation.type==='monitoring-case-details-save'&&part.closure.eventIds.has(mutation.eventId),'A retained case-write proof applies only to an exact protected detail update.',403);
 const token=Object.freeze({});proofs.set(token,{identity:structuredClone(identity),projectSha256:digest(project),packagesSha256:digest(packages),originSha256:originDigest(originArchives),origins,registry:registry?structuredClone(registry):undefined,depth:0,part,versions,baselinesSha256:digest(packages.map(pack=>pack.baselines)),scope:structuredClone(scope),mutation:mutation?structuredClone(mutation):undefined,sourcePinsSha256:digest([...sources]),snapshotSha256:snapshot.sha256});return token;
}

export function retainedEngagementSourceVersionIds(token){return [...lookup(token).versions.keys()];}
export function retainedEngagementSourceVersion(token,versionId,project){const proof=lookup(token),pin=proof.versions.get(versionId);if(!pin)return false;assert(digest(project)===proof.projectSha256,'The current source project differs from its retained proof.',409);return true;}
export function retainedEngagementFieldBinding(token,{engagementId,record}){return lookup(token).part.bindings.has(digest({engagementId,record}));}
/** A bounded in-memory continuation after the common engine validates a step.
 * The original immutable HEAD remains the adapter's final CAS authority. */
export function advanceEngagementRetainedSourceProof(token,options){assertEngagementRetainedSourceProof(token,{...options,phase:'after'});const prior=lookup(token);assert(prior.depth<4,'Commit this bounded native preparation before starting further operations.',409);const next=Object.freeze({});proofs.set(next,{...prior,depth:prior.depth+1,packagesSha256:digest(options.packages),part:protection(options.project,options.packages,prior.origins,prior.registry),mutation:undefined});return next;}
export function assertEngagementRetainedSourceProof(token,{project,packages,input,authority,originArchives=new Map(),availableVersionIds=new Set(),phase='before'}={}){
 const proof=lookup(token);assert(digest(project)===proof.projectSha256&&originDigest(originArchives)===proof.originSha256,'The retained proof belongs to a different source project or origin ancestry.',409);
 assert(authority?.mode==='authenticated_user'&&['userId','issuer','subject'].every(key=>authority[key]===proof.identity[key]),'The retained private-source proof belongs to another verified native identity.',403);
 // Rendering a fixed approved baseline preserves its retained graph. The
 // native adapter separately checks current custody before issuing any bytes.
 assert(input.engagementId===proof.scope.engagementId&&['get','command','baseline-export','issued-list','issued-get','issued-retain'].includes(input.operation),'Retained private-source integrity cannot authorize whole exchanges, new engagements or global approvals.',403);
 const evidenceMutation=input.operation==='command'&&input.command?.type==='assertion-save'&&availableVersionIds.has(input.command.versionId);
 const registrationMutation=input.operation==='command'&&input.command?.type==='register-sources'&&Array.isArray(input.command.versionIds)&&input.command.versionIds.every(id=>availableVersionIds.has(id));
 if(input.operation==='command'){
  const command=input.command,authorizedMutation=proof.mutation&&digest(command)===digest(proof.mutation);
  assert(!['transition','attest','monitoring-cycle-transition','cycle-transition'].includes(command.type),'Review current protected evidence permission before formal assessment approval.',403);
  const visit=value=>typeof value==='string'?proof.part.ids.has(value):Array.isArray(value)?value.some(visit):isObject(value)?Object.values(value).some(visit):false;
  assert(authorizedMutation||evidenceMutation||registrationMutation||!visit(command),'This change uses protected case evidence; recheck the required case field permissions.',403);
 }
 if(phase==='before'){assert(digest(packages)===proof.packagesSha256,'Retained proof packages changed before evaluation.',409);return true;}
 assert(phase==='after'&&digest(packages.map(pack=>pack.baselines))===proof.baselinesSha256,'Retained approved history must remain byte-equivalent.',409);
 const after=packages.flatMap(pack=>Object.entries(pack.entities).flatMap(([kind,rows])=>rows.map(row=>({kind,id:row.id,row}))));
 for(const before of proof.part.protectedRows){const next=after.find(row=>row.kind===before.kind&&row.id===before.id);assert(next,'A protected retained record was removed.',409);
  if(evidenceMutation&&before.kind==='assertions'&&before.id===input.command.id){const old=before.row,current=next.row;assert(current.revision===old.revision+1&&digest(current.history)===digest([...(old.history||[]),Object.fromEntries(Object.entries(old).filter(([key])=>key!=='history'))]),'A new authorized citation revision must preserve every original retained private revision.',409);}
  else if(proof.mutation&&input.operation==='command'&&before.kind==='events'&&before.id===proof.mutation.eventId){
   const old=before.row,current=next.row,meta=new Set(['restricted','restrictedAvailable','restrictedSha256','revision','updatedAt','updatedBy','history']),publicFields=row=>Object.fromEntries(Object.entries(row).filter(([key])=>!meta.has(key)));
   assert(current.revision===old.revision+1&&digest(current.history)===digest([...(old.history||[]),Object.fromEntries(Object.entries(old).filter(([key])=>key!=='history'))])&&digest(publicFields(current))===digest(publicFields(old)),'A case detail update must preserve its exact public record and complete prior private history.',409);
  }else assert(digest(next.row)===digest(before.row),'A retained private record changed without its actual authorized source evidence.',409);
 }
 return true;
}
