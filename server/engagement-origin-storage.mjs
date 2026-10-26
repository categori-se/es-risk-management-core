// Exact archive manifests are authority inputs, never an access grant. Callers
// authorize the complete declared source/policy closure before invoking reads.
import {createHash} from 'node:crypto';
import {stableJson,uuidPattern,sha256Pattern} from '../src/lib/engagement-domain.js';
import {validateEngagementLibraryUse} from './engagement-library.mjs';
import {inspectEngagementSuccessorArchive} from './engagement-successor.mjs';
import {engagementOriginArchiveLimits} from './engagement-origin-archives.mjs';

export const engagementSuccessorStorageLimits=Object.freeze({...engagementOriginArchiveLimits,partBytes:512*1024,manifestBytes:128*1024,stageHours:1});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=(message,statusCode=409)=>{throw Object.assign(Error(message),{statusCode});};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes('..');
const version=value=>typeof value==='string'&&value.length>0&&value.length<=500&&value!=='null'&&!/[\x00-\x1f\x7f]/.test(value);
export const engagementOriginKey=({accountId,projectId},sha256)=>`tenants/${accountId}/projects/${projectId}/engagement-origins/${sha256}.json`;
export const engagementSuccessorPartKey=({accountId,projectId},stageId,sha256,offset)=>`tenants/${accountId}/projects/${projectId}/successor-staging/${stageId}/${sha256}/parts/${offset}.bin`;

export function validateSuccessorArchiveDeclarations(rows,{project,sources}={}){
 if(!Array.isArray(rows)||!rows.length||rows.length>engagementOriginArchiveLimits.entries||Buffer.byteLength(JSON.stringify(rows))>engagementSuccessorStorageLimits.manifestBytes)fail('Declare the complete bounded origin archive and source/policy closure.',413);
 const versions=new Map((project?.resources||[]).flatMap(resource=>(resource.versions||[]).map(row=>[row.id,row]))),seen=new Set();let total=0;
 for(const row of rows){
  if(!exact(row,['sha256','sizeBytes','sourceMappings','policyUses'])||!sha256Pattern.test(row.sha256||'')||seen.has(row.sha256)||!Number.isSafeInteger(row.sizeBytes)||row.sizeBytes<1||row.sizeBytes>engagementOriginArchiveLimits.archiveBytes||(total+=row.sizeBytes)>engagementOriginArchiveLimits.totalBytes)fail('Origin archives require unique exact SHA256 and bounded complete byte sizes.',413);seen.add(row.sha256);
  if(!Array.isArray(row.sourceMappings)||row.sourceMappings.length>1000)fail('Declare every original source mapping explicitly.',413);
  const ids=new Set();for(const mapping of row.sourceMappings){
   if(!exact(mapping,['sourceVersionId','destinationVersionId','sha256','size'])||!opaque(mapping.sourceVersionId)||ids.has(mapping.sourceVersionId)||!opaque(mapping.destinationVersionId)||!sha256Pattern.test(mapping.sha256||'')||!Number.isSafeInteger(mapping.size)||mapping.size<0)fail('Origin source mappings must retain exact unique version identities, SHA256 and size.');
   const target=versions.get(mapping.destinationVersionId);if(!target||sources&&!sources.has(mapping.destinationVersionId)||target.sha256!==mapping.sha256||target.size!==mapping.size)fail('Every origin source requires independently authorized destination originals with the same SHA256 and size.',403);ids.add(mapping.sourceVersionId);
  }
  validateEngagementLibraryUse(row.policyUses);
 }
 return structuredClone(rows);
}

export function validateEngagementOriginManifests(rows,{scope,storage,project,sources}={}){
 if(rows===undefined)return [];
 if(!Array.isArray(rows)||rows.length>engagementOriginArchiveLimits.entries||Buffer.byteLength(JSON.stringify(rows))>engagementSuccessorStorageLimits.manifestBytes)fail('Origin manifests exceed their bounded whole-ancestry metadata limit.',413);
 if(!rows.length)return [];
 const declarations=rows.map(row=>({sha256:row.sha256,sizeBytes:row.sizeBytes,sourceMappings:row.sourceMappings,policyUses:row.policyUses}));validateSuccessorArchiveDeclarations(declarations,{project,sources});
 for(const row of rows){
  if(!exact(row,['sha256','sizeBytes','sourceMappings','policyUses','archive','object'])||!exact(row.archive,['format','schemaVersion','sha256','size','accountId','projectId','engagementIds'])||row.archive.format!=='esia-engagement-successor-archive'||row.archive.schemaVersion!==1||row.archive.sha256!==row.sha256||row.archive.size!==row.sizeBytes||!opaque(row.archive.accountId)||!opaque(row.archive.projectId)||!Array.isArray(row.archive.engagementIds)||!row.archive.engagementIds.length||row.archive.engagementIds.length>1000||new Set(row.archive.engagementIds).size!==row.archive.engagementIds.length||!row.archive.engagementIds.every(id=>uuidPattern.test(id)))fail('Retain each exact verified archive identity and its original custody scope.');
  const target=row.object;
  if(!exact(target,['kind','bucket','key','versionId','sha256','sizeBytes','contentType'])||target.kind!=='origin'||target.bucket!==storage.forAccount(scope.accountId).bucket||target.key!==engagementOriginKey(scope,row.sha256)||!version(target.versionId)||target.sha256!==row.sha256||target.sizeBytes!==row.sizeBytes||target.contentType!=='application/json')fail('The origin manifest differs from its configured immutable account/project storage scope.');
 }
 return structuredClone(rows);
}

export function createEngagementOriginCache(){
 const entries=new Map();let size=0;const remove=key=>{const value=entries.get(key);if(value){size-=value.byteLength;entries.delete(key);}};
 return Object.freeze({
  get(target){const key=stableJson(target),bytes=entries.get(key);if(!bytes)return null;if(bytes.byteLength!==target.sizeBytes||hash(bytes)!==target.sha256)fail('Cached origin bytes differ from their immutable target.');entries.delete(key);entries.set(key,bytes);return Buffer.from(bytes);},
  set(target,bytes){if(!(bytes instanceof Uint8Array)||bytes.byteLength!==target.sizeBytes||bytes.byteLength>engagementOriginArchiveLimits.archiveBytes||hash(bytes)!==target.sha256)fail('Cache only exact independently verified bounded origin bytes.');const key=stableJson(target);remove(key);while(entries.size>=engagementOriginArchiveLimits.entries||size+bytes.byteLength>engagementOriginArchiveLimits.totalBytes)remove(entries.keys().next().value);entries.set(key,Buffer.from(bytes));size+=bytes.byteLength;},
  clear(){entries.clear();size=0;},stats(){return {entries:entries.size,bytes:size};}
 });
}

export async function loadEngagementOriginArchives({manifests,read,cache}={}){
 if(!Array.isArray(manifests)||manifests.length>engagementOriginArchiveLimits.entries||typeof read!=='function')fail('Use the bounded already-authorized origin manifest closure.');
 const archives=new Map();let size=0;
 for(const row of manifests){
  if((size+=row.sizeBytes)>engagementOriginArchiveLimits.totalBytes||row.sizeBytes>engagementOriginArchiveLimits.archiveBytes)fail('Origin archive bytes exceed the complete ancestry bound.',413);
  let bytes=cache?.get(row.object);
  if(!bytes){const result=await read(row.object);
   if(!(result?.bytes instanceof Uint8Array)||result.bytes.byteLength!==row.sizeBytes||hash(result.bytes)!==row.sha256||result.sha256!==row.sha256||result.versionId!==row.object.versionId||result.sizeBytes!==row.sizeBytes||result.contentType!=='application/json')fail('The retained origin archive differs from its exact immutable receipt.');
   bytes=result.bytes;cache?.set(row.object,bytes);
  }
  if(!(bytes instanceof Uint8Array)||bytes.byteLength!==row.sizeBytes||hash(bytes)!==row.sha256)fail('The retained origin bytes failed their exact size or SHA256 check.');archives.set(row.sha256,{bytes:Buffer.from(bytes)});
 }
 for(const row of manifests){const inspected=inspectEngagementSuccessorArchive({...archives.get(row.sha256),expectedSha256:row.sha256,originArchives:archives});assertEngagementOriginInventory(row,inspected);}
 return archives;
}

export function assertEngagementOriginInventory(row,inspected){
 const ordered=value=>[...value].sort((a,b)=>a.sourceVersionId.localeCompare(b.sourceVersionId));
 const actual=inspected.sources.map(source=>({sourceVersionId:source.versionId,sha256:source.sha256,size:source.size})),declared=row.sourceMappings.map(({destinationVersionId,...source})=>source);
 if(stableJson(ordered(actual))!==stableJson(ordered(declared))||stableJson(row.policyUses)!==stableJson(inspected.policyUses)||row.archive&&stableJson(row.archive)!==stableJson(inspected.archive))fail('The actual archive source/policy inventory differs from the closure authorized before its private bytes were read.');
 return inspected;
}
