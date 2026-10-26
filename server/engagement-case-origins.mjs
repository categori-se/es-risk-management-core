// Historical ciphertext stays bound to its original AAD. This reference grants
// no native access; adapters separately authorize the current mapped case.
import {createHash} from 'node:crypto';
import {assertEngagement as assert,exactKeys,stableJson,uuidPattern} from '../src/lib/engagement-domain.js';
import {monitoringCaseReferences,protectedMonitoringSourceClosure} from '../src/lib/monitoring-protection.js';
const hash=value=>createHash('sha256').update(stableJson(value)).digest('hex');
const revisions=row=>[row,...(row.history||[])];
const references=monitoringCaseReferences;
export function normalizeMonitoringCaseOrigin(ref){
 exactKeys(ref,['format','schemaVersion','archiveSha256','engagementId','caseId','revision','restrictedSha256'],'Archived protected case reference');
 assert(ref.format==='esia-monitoring-case-origin'&&ref.schemaVersion===1&&/^[a-f0-9]{64}$/.test(ref.archiveSha256||'')&&/^[a-f0-9]{64}$/.test(ref.restrictedSha256||'')&&uuidPattern.test(ref.engagementId||'')&&uuidPattern.test(ref.caseId||'')&&Number.isSafeInteger(ref.revision)&&ref.revision>0,'Retain the exact immutable archive, case revision and protected ciphertext digest.');return structuredClone(ref);
}
export function monitoringCaseOriginReference(event,{archiveSha256,engagementId}){
 if(event.restricted?.schemaVersion===2)return normalizeMonitoringCaseOrigin({format:'esia-monitoring-case-origin',schemaVersion:1,archiveSha256,engagementId,caseId:event.id,revision:event.revision,restrictedSha256:hash(event.restricted)});
 if(event.restrictedOrigin)return normalizeMonitoringCaseOrigin(event.restrictedOrigin);
}
export function resolveMonitoringCaseOrigin(ref,{context}={}){
 const reference=normalizeMonitoringCaseOrigin(ref),archive=context?.read(reference.archiveSha256),pack=archive?.packages.find(row=>row.engagement.id===reference.engagementId),event=pack?.entities.events.find(row=>row.id===reference.caseId),selected=event&&revisions(event).find(row=>row.revision===reference.revision);
 assert(selected?.restricted?.schemaVersion===2&&hash(selected.restricted)===reference.restrictedSha256,'The protected case reference differs from its exact retained original ciphertext.',409);
 const scope={accountId:pack.engagement.accountId,projectId:pack.engagement.projectId,engagementId:pack.engagement.id,caseId:event.id};
 for(const [group,envelope]of Object.entries(selected.restricted.groups))assert(envelope.context.accountId===scope.accountId&&envelope.context.projectId===scope.projectId&&envelope.context.engagementId===scope.engagementId&&envelope.context.caseId===scope.caseId&&envelope.context.fieldGroup===group,'Archived case ciphertext must retain its verified original scope.');
 return {reference,scope,groups:structuredClone(selected.restricted.groups),details:structuredClone(selected.restricted),event:selected,engagement:pack.engagement};
}
export function successorMonitoringCaseProtection(event,{pack,project,sourceMappings,recordMappings}){
 const sourceVersions=project.resources.flatMap(resource=>resource.versions),events=[event,...(pack.baselines||[]).flatMap(row=>row.events||[]).filter(row=>row.id===event.id)],assertions=[...(pack.entities.assertions||[]),...(pack.baselines||[]).flatMap(row=>row.assertions||[])],combined={events,assertions,sourceVersions},closure=protectedMonitoringSourceClosure(combined),withoutBindings=row=>({...row,restricted:row.restricted?{...row.restricted,sourceBindings:[]}:undefined,restrictedProtection:row.restrictedProtection?{...row.restrictedProtection,sourceBindings:[]}:undefined}),defaults=protectedMonitoringSourceClosure({...combined,events:events.map(row=>({...withoutBindings(row),history:(row.history||[]).map(withoutBindings)}))}),explicit=new Map(),sourceMap=new Map(sourceMappings.map(row=>[row.sourceVersionId,row.destinationVersionId])),recordMap=new Map(recordMappings.filter(row=>row.destinationId).map(row=>[row.sourceId,row.destinationId]));
 const sourceBindings=[];for(const candidate of events)for(const row of revisions(candidate))for(const binding of references(row).sourceBindings||[]){const prior=explicit.get(binding.sha256)||new Set();for(const group of binding.groups)prior.add(group);explicit.set(binding.sha256,prior);}
 for(const source of sourceVersions)if(closure.versionIds.has(source.id)||closure.sha256s.has(source.sha256)){assert(sourceMap.has(source.id),'Every protected historical original needs its exact destination mapping.');sourceBindings.push({versionId:sourceMap.get(source.id),sha256:source.sha256,groups:[...(defaults.sha256s.has(source.sha256)?['identities','location','investigation']:explicit.get(source.sha256)||['identities','location','investigation'])].sort()});}
 const geometries=new Map();for(const candidate of events)for(const row of revisions(candidate))for(const ref of references(row).geometryBindings||[]){
  // Imported field captures remain exact archive records. Their complete
  // manifest/media SHA closure above protects geometry in those originals;
  // no new native capture identity is fabricated for an archived observation.
  if(ref.kind==='field_capture')continue;const mapped=Object.fromEntries(Object.entries(ref).map(([key,value])=>[key,key==='kind'?value:recordMap.get(value)]));assert(Object.values(mapped).every(Boolean),'Every current protected geometry relationship needs an exact successor record mapping.');geometries.set(stableJson(mapped),mapped);
 }
 return {format:'esia-monitoring-case-protection',schemaVersion:1,sourceBindings:[...new Map(sourceBindings.map(row=>[row.versionId,row])).values()],geometryBindings:[...geometries.values()]};
}
export function validateMonitoringCaseOrigin(record,source,core,context,archive){
 const expected=monitoringCaseOriginReference(source,{archiveSha256:core.successor.archiveSha256,engagementId:core.successor.engagementId});
 if(!expected){assert(record.restrictedOrigin===undefined,'A successor cannot invent an archived protected case reference.');return;}
 assert(stableJson(record.restrictedOrigin)===stableJson(expected),'The imported protected case must retain its exact archive-bound ciphertext reference.');resolveMonitoringCaseOrigin(record.restrictedOrigin,{context});
 for(const past of record.history||[])assert(stableJson(past.restrictedOrigin)===stableJson(expected),'Protected case origin references remain immutable through current edits and resealing.');
 const protection=successorMonitoringCaseProtection(source,{pack:archive.packages.find(row=>row.engagement.id===core.successor.engagementId),project:archive.project,sourceMappings:core.successor.sourceMappings,recordMappings:core.successor.recordMappings}),retained=[record.restrictedProtection,record.restricted].filter(Boolean);
 for(const source of protection.sourceBindings)assert(retained.some(row=>(row.sourceBindings||[]).some(item=>item.versionId===source.versionId&&item.sha256===source.sha256&&source.groups.every(group=>item.groups.includes(group)))),'Retain every mapped protected source group across successor resealing.');
 for(const geometry of protection.geometryBindings)assert(retained.some(row=>(row.geometryBindings||[]).some(item=>stableJson(item)===stableJson(geometry))),'Retain every mapped protected geometry relationship across successor resealing.');
}
