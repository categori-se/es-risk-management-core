// Common case content and provenance only. Native identities, permissions and
// revocation belong to the repository adapter, never to a portable package.
import {createHash} from 'node:crypto';
import {assertEngagement as assert,exactKeys,isObject,stableJson,uuidPattern,boundedText} from '../src/lib/engagement-domain.js';
import {monitoringCaseFieldGroups,validateMonitoringCaseGroupEnvelope} from '../src/lib/monitoring-case-model.js';
import {resolveMonitoringCaseOrigin} from './engagement-case-origins.mjs';

const hash=value=>createHash('sha256').update(stableJson(value)).digest('hex');
const list=(value,label,max=100)=>{assert(Array.isArray(value)&&value.length<=max,`${label} must be a bounded list.`);return value;};
const fieldGroups=value=>{list(value,'Protected source field groups',3);assert(value.length>0&&new Set(value).size===value.length&&value.every(group=>monitoringCaseFieldGroups.includes(group)),'Select explicit protected source field groups.');return [...value].sort();};
const scopeFor=(view,eventId,group)=>({format:'esia-monitoring-case-context',schemaVersion:2,accountId:view.accountId||view.engagement?.accountId,projectId:view.projectId||view.engagement?.projectId,engagementId:view.engagement?.id||view.id,caseId:eventId,fieldGroup:group,payloadVersion:1});
function validateGroup(envelope,context){try{return validateMonitoringCaseGroupEnvelope(envelope,context);}catch(error){assert(false,error.message);}}

export function normalizeMonitoringCaseProtection(input,{view,project}={}){
 exactKeys(input,['format','schemaVersion','sourceBindings','geometryBindings'],'Protected case references');assert(input.format==='esia-monitoring-case-protection'&&input.schemaVersion===1,'Use the versioned protected source and geometry references.');
 const sourceBindings=list(input.sourceBindings,'Protected original source bindings').map(binding=>{
  exactKeys(binding,['versionId','sha256','groups'],'Protected original binding');assert(typeof binding.versionId==='string'&&binding.versionId.length<=192&&/^[a-f0-9]{64}$/.test(binding.sha256),'Keep an exact protected original identity and SHA256.');
  if(project){const version=project.resources.flatMap(resource=>resource.versions).find(row=>row.id===binding.versionId);assert(version&&version.sha256===binding.sha256,'Protected original bindings must match the exact retained source project.',409);}
  return {versionId:binding.versionId,sha256:binding.sha256,groups:fieldGroups(binding.groups)};
 });
 const geometryBindings=list(input.geometryBindings,'Protected geometry bindings').map(ref=>{
  const fields={mission_point:['kind','missionId','pointId'],indicator:['kind','indicatorId'],measurement:['kind','measurementId'],field_capture:['kind','captureId']}[ref?.kind];assert(fields,'Choose a typed protected geometry relationship.');exactKeys(ref,fields,'Protected geometry binding');for(const key of fields.slice(1))assert(typeof ref[key]==='string'&&ref[key].length<=192&&/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(ref[key])&&!ref[key].includes('..'),'Use exact protected geometry identifiers.');
  if(view){const record=(name,id)=>(view[name]||[]).find(row=>row.id===id);if(ref.kind==='mission_point')assert(record('missions',ref.missionId)?.monitoringPoints?.some(row=>row.id===ref.pointId),'Select a retained monitoring point in this engagement.');if(ref.kind==='indicator')assert(record('indicators',ref.indicatorId),'Select a retained indicator in this engagement.');if(ref.kind==='measurement')assert(record('measurements',ref.measurementId),'Select a retained measurement in this engagement.');if(ref.kind==='field_capture')assert((view.assertions||[]).some(row=>[row,...(row.history||[])].some(value=>value.fieldCapture?.captureId===ref.captureId)),'Select a retained field capture in this engagement.');}
  return structuredClone(ref);
 });
 assert(new Set(sourceBindings.map(row=>row.versionId)).size===sourceBindings.length,'Protect each source version once; combine its field groups.');assert(new Set(geometryBindings.map(stableJson)).size===geometryBindings.length,'Protect each typed geometry relationship once.');
 return {format:input.format,schemaVersion:1,sourceBindings,geometryBindings};
}
export function normalizeMonitoringCaseDetails(input,{view,eventId,project}={}){
 exactKeys(input,['format','schemaVersion','groups','sourceBindings','geometryBindings'],'Protected case details');assert(input.format==='esia-monitoring-case-details'&&input.schemaVersion===2&&isObject(input.groups),'Use the versioned protected case details container.');exactKeys(input.groups,monitoringCaseFieldGroups,'Protected case field groups');assert(Object.keys(input.groups).length>0,'Seal at least one explicit case field group.');const groups={};for(const [group,envelope]of Object.entries(input.groups))groups[group]=validateGroup(envelope,view?scopeFor(view,eventId,group):undefined);const refs=normalizeMonitoringCaseProtection({format:'esia-monitoring-case-protection',schemaVersion:1,sourceBindings:input.sourceBindings,geometryBindings:input.geometryBindings},{view,project});return {format:input.format,schemaVersion:2,groups,sourceBindings:refs.sourceBindings,geometryBindings:refs.geometryBindings};
}

const union=(prior,next,key)=>{const values=new Map(prior.map(row=>[key(row),structuredClone(row)]));for(const row of next){const id=key(row),old=values.get(id);values.set(id,old&&row.groups?{...row,groups:[...new Set([...old.groups,...row.groups])].sort()}:structuredClone(row));}return [...values.values()];};
export function applyMonitoringCaseDetails(ctx){
 const {command,core,view,project,actorId,save,previousFor,assertRole,assertAvailable}=ctx;if(command.type!=='monitoring-case-details-save')return {handled:false};
 exactKeys(command,['type','eventId','groups','sourceBindings','geometryBindings','statement','legacyMigration','originMigration'],'Protected case detail update');assert(!ctx.authenticated||ctx.caseProtection===true,'Native case updates require separately verified field permission.',403);assertRole(core,actorId,['preparer','reviewer']);
 const previous=previousFor('events',command.eventId);assert(previous&&uuidPattern.test(previous.id),'Choose a retained monitoring case.');
 const statement=boundedText(command.statement,'Protected case update review',{required:true,max:12000});assert(statement.length>=20,'Describe the protected case update and its evidence in at least20 characters.');
 exactKeys(command.groups,monitoringCaseFieldGroups,'Updated protected field groups');assert(Object.keys(command.groups).length,'Select protected field groups to update.');
 const prior=previous.restricted,legacy=prior?.version===1?prior:!prior?previous.history?.findLast(row=>row.restricted?.version===1)?.restricted:undefined;
 if(legacy){exactKeys(command.legacyMigration,['legacySha256','reviewed','statement'],'Legacy protected case migration');assert(command.legacyMigration.reviewed===true&&command.legacyMigration.legacySha256===hash(legacy)&&typeof command.legacyMigration.statement==='string'&&command.legacyMigration.statement.trim().length>=20,'Review the exact legacy ciphertext before resealing all three field groups.',409);assert(monitoringCaseFieldGroups.every(group=>Object.hasOwn(command.groups,group)),'Reseal every legacy field group explicitly; the original envelope remains in history.');}
 else assert(command.legacyMigration===undefined,'Migration applies only to an exact retained legacy envelope.');
 if(previous.restrictedOrigin&&!prior){const archived=resolveMonitoringCaseOrigin(previous.restrictedOrigin,{context:ctx.originArchiveContext});exactKeys(command.originMigration,['reference','reviewed','statement'],'Archived protected case resealing');assert(command.originMigration.reviewed===true&&stableJson(command.originMigration.reference)===stableJson(previous.restrictedOrigin)&&typeof command.originMigration.statement==='string'&&command.originMigration.statement.trim().length>=20&&command.originMigration.statement.length<=4000,'Review the exact archived protected case before resealing its original groups.',409);assert(Object.keys(archived.groups).every(group=>Object.hasOwn(command.groups,group)),'Reseal every original protected group explicitly in the new case scope.');}
 else assert(command.originMigration===undefined,'Archive resealing applies only to the exact imported protected case candidate.');
 const retained=previous.restrictedProtection||{},initial=prior?.schemaVersion===2?normalizeMonitoringCaseDetails(prior,{view,eventId:previous.id,project}):{groups:{},sourceBindings:retained.sourceBindings||[],geometryBindings:retained.geometryBindings||[]};
 const incoming=normalizeMonitoringCaseDetails({format:'esia-monitoring-case-details',schemaVersion:2,groups:command.groups,sourceBindings:command.sourceBindings===undefined?[]:command.sourceBindings,geometryBindings:command.geometryBindings===undefined?[]:command.geometryBindings},{view,eventId:previous.id,project});
 const next=normalizeMonitoringCaseDetails({format:'esia-monitoring-case-details',schemaVersion:2,groups:{...initial.groups,...incoming.groups},sourceBindings:union(initial.sourceBindings,incoming.sourceBindings,row=>row.versionId),geometryBindings:union(initial.geometryBindings,incoming.geometryBindings,stableJson)},{view,eventId:previous.id,project});
 const added=next.sourceBindings.filter(row=>!initial.sourceBindings.some(prior=>prior.versionId===row.versionId&&prior.sha256===row.sha256));if(added.length)assertAvailable(core.projectId,added.map(row=>row.versionId));
 const fields=Object.fromEntries(Object.entries(previous).filter(([key])=>!['id','revision','history','createdAt','updatedAt','createdBy','updatedBy'].includes(key)));
 save('events',previous,{...fields,restricted:next,restrictedAvailable:true,restrictedSha256:hash(next)});return {handled:true,material:true};
}
