import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createPublicPs5EvaluationWorkbench} from './public-ps5-workbench.mjs';
import {evaluateResourceRight} from '../src/lib/resource-library.js';
import {publicProjectRecordFiles,validatePublicProjectRecords,isPublishedProjectRecord} from '../src/lib/public-project-records.js';

const IFC_SHA='831cfba9482fdd210603cf493e92a098baad8d22561c251aad0d2dc04daa5068';
const requiredActions=['store','index','ai','derive','excerpt'];
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};

/** Evaluation artifacts reference existing permitted originals. They never
 * become a second project, document, finding or professional approval store. */
export function createLocalPublicPs5Evaluation({workspace,directory,sourceRoot,appRoot,resourceLibrary,archiveCollections,archive,projectAi}={}){
 let curatedGroups;
 const projectGroups=()=>{if(curatedGroups)return curatedGroups;const result=new Map();for(const [projectId,filename]of Object.entries(publicProjectRecordFiles)){const catalog=validatePublicProjectRecords(JSON.parse(readFileSync(join(appRoot,'src/data/public-project-records',filename))),{projectId});for(const record of catalog.records)if(isPublishedProjectRecord(record)&&record.recordKind==='document'&&/^[a-f0-9]{64}$/.test(record.sourceSha256||'')){const groups=result.get(record.sourceSha256)||new Set();groups.add(projectId);result.set(record.sourceSha256,groups);}}curatedGroups=result;return result;};
 const accountFor=scope=>{const account=workspace.listAccounts().find(row=>row.custodyId===scope.accountId);if(!account)fail('The current evaluation account no longer exists.');return account;};
 const authorize=async({scope,actorId})=>{
  const account=accountFor(scope),store=workspace.forAccount(account.id),project=store.getProject(scope.projectId),engagement=store.engagements().get(scope.engagementId);
  if(engagement.projectId!==project.id||typeof actorId!=='string'||!actorId.trim()||actorId.length>200)fail('Choose an exact current assignment and named practitioner.');
  const roles=['preparer','reviewer','approver'].filter(role=>engagement.roles?.[role]?.includes(actorId));if(!roles.length)fail('This practitioner has no current responsibility in the selected assignment.');
  return {actorId,name:actorId,roles,project,engagement};
 };
 const listSources=async()=>{
  const library=await resourceLibrary(),catalog=await library.exportCatalog(),versions=new Map(catalog.versions.map(row=>[row.id,row])),resources=new Map(catalog.resources.map(row=>[row.id,row])),result=[],archived=[],groups=new Map([...projectGroups()].map(([sha,value])=>[sha,new Set(value)])),permittedByHash=new Map();
  for(const collection of archiveCollections())for(const resource of archive(collection.id).manifest().resources)for(const version of resource.versions){if(!/^application\/pdf(?:;|$)/i.test(version.mediaType||'')||!/^[a-f0-9]{64}$/.test(version.sha256||''))continue;archived.push({collection,resource,version});if(Object.hasOwn(publicProjectRecordFiles,collection.id)){const values=groups.get(version.sha256)||new Set();values.add(collection.id);groups.set(version.sha256,values);}}
  const projectIdentity=sha=>{const known=groups.get(sha);return known?.size===1?[...known][0]:'project_identity_unverified';};
  for(const file of catalog.files){
   const version=versions.get(file.resourceVersionId),resource=version&&resources.get(version.resourceId);
   if(!version||version.curation?.audience!=='public'||!/^application\/pdf(?:;|$)/i.test(file.mediaType||'')||!/^[a-f0-9]{64}$/.test(file.sha256||'')||!requiredActions.every(action=>evaluateResourceRight(version,action,{audience:'practitioner'}).allowed&&(!file.rights||evaluateResourceRight({...version,rights:file.rights},action,{audience:'practitioner'}).allowed)))continue;
   const permitted=permittedByHash.get(file.sha256)||[];permitted.push({file,version,resource});permittedByHash.set(file.sha256,permitted);
   const relative=file.storage?.kind==='local_sha256'?`resource-library/objects/${file.sha256}`:file.sha256===IFC_SHA?`policy-library/sources/${IFC_SHA}.pdf`:null;
   if(!relative||!existsSync(join(sourceRoot,relative)))continue;
   result.push({id:file.id,documentVersionId:version.id,sourceSha256:file.sha256,sourceUrl:file.sourceUrl||version.downloadUrl||version.officialUrl,retainedRelativePath:relative,sourceClassification:file.sha256===IFC_SHA?'policy_original':file.sourceClassification||version.sourceClassification||resource?.type||'public_institutional_publication',projectIdentity:file.sha256===IFC_SHA?'institutional-policy':projectIdentity(file.sha256),title:version.title||resource.title,downloadAllowed:evaluateResourceRight(version,'download',{audience:'practitioner'}).allowed&&(!file.rights||evaluateResourceRight({...version,rights:file.rights},'download',{audience:'practitioner'}).allowed)});
   if(result.length>=5000)fail('The public evaluation source directory exceeds its5000-source bound. Select a smaller retained collection.',413);
  }
  for(const {collection,resource,version}of archived){
   const permissions=permittedByHash.get(version.sha256);if(!permissions?.length)continue;
   result.push({id:`archive:${collection.id}:${version.id}`,documentVersionId:version.id,sourceSha256:version.sha256,sourceUrl:resource.url,retainedRelativePath:`research-archive/${collection.id}/objects/${version.sha256}`,sourceClassification:'retained_public_research_original_with_current_recorded_processing_permission',projectIdentity:projectIdentity(version.sha256),title:resource.title||version.filename,downloadAllowed:permissions.some(({file,version:parent})=>evaluateResourceRight(parent,'download',{audience:'practitioner'}).allowed&&(!file.rights||evaluateResourceRight({...parent,rights:file.rights},'download',{audience:'practitioner'}).allowed))});
   if(result.length>=5000)fail('The public evaluation source directory exceeds its5000-source bound. Select a smaller retained collection.',413);
  }
  return result;
 };
 const service=createPublicPs5EvaluationWorkbench({directory,sourceRoot,seedDatasetPath:join(appRoot,'docs/evaluation/ps5-public-v1.dataset.json'),seedRubricPath:join(appRoot,'docs/evaluation/ps5-public-v1.hidden-rubric.json'),authorize,listSources,listModels:async({scope,actor})=>projectAi.evaluationModels({...scope,actorId:actor.id})});
 return {async handle({accountId,engagementId,actorId,operation='read',body={}}){if(operation==='create')fail('The community source contains no independently authorized public-project evaluation corpus. Prepare your own permitted dataset through the open evaluation interfaces.',409);const store=workspace.forAccount(accountId),engagement=store.engagements().get(engagementId),scope={accountId:store.account.custodyId,projectId:engagement.projectId,engagementId};return service.handle({scope,actorId,operation,body});},close:()=>service.close()};
}
