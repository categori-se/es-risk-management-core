import {assertConfiguredResourceAuthority} from '../src/lib/hosted-field-capture-model.js';
// Pure source projections and explicit bounded reads. Rows MUST already have
// passed current authenticated document/project access checks. Neither this
// module nor its optional byte cache grants authority or refreshes storage.
import {createHash} from "node:crypto";
import {validateResourceReference} from "@categori/workspace-contracts";
import {createAccountStorage} from "./account-storage.mjs";
import {engagementPackageSourceVersionIds,validateEngagementPackages} from "./engagement-store.mjs";
import {assertEngagement as assert,isObject,boundedText,exactKeys,stableJson,sha256Pattern} from "../src/lib/engagement-domain.js";

export const engagementSourceLimits=Object.freeze({documents:100,sourceBytes:32*1024*1024,totalBytes:64*1024*1024,inputBytes:1024*1024,inputNodes:10000,inputDepth:16,cacheEntries:100,cacheBytes:64*1024*1024});
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const opaque=value=>typeof value==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes("..")&&!['__proto__','constructor','prototype'].includes(value);
const identifier=(value,label)=>{assert(opaque(value),`${label} must be an exact opaque identifier.`);return value;};
const text=(value,label,max=2000)=>boundedText(value,label,{required:true,max});
const optional=(value,label,max=2000)=>value===undefined?"":boundedText(value,label,{max});
const validVersion=value=>typeof value==="string"&&value.trim()===value&&value&&value!=="null"&&value.length<=500&&!/[\x00-\x1f\x7f]/.test(value);
function rowValue(row,prefix,idField){
  assert(isObject(row)&&isObject(row.value)&&Number.isSafeInteger(row.revision)&&row.revision>0&&row.sk==="PROFILE", "Source authority requires an exact retained profile row.");
  const value=row.value,id=identifier(value[idField],idField);assert(row.pk===`${prefix}#${id}`,"Source profile key differs from its exact resource identity.");return value;
}
function descriptiveMetadata(document){
  const raw=isObject(document.original_metadata)?document.original_metadata:{},warnings=[];
  // Upload metadata is intentionally arbitrary portable JSON. An unfamiliar
  // descriptive field must not make an otherwise valid immutable source fail.
  const read=(key,max=2000)=>{try{return optional(raw[key],`Registered ${key}`,max);}catch{warnings.push(`Registered ${key} is not a supported descriptive value; inspect the retained original metadata.`);return "";}};
  const result={title:read("title")||document.filename,authors:[],description:read("description",12000),language:read("language",100),tags:[],receivedVia:"file_upload",extraction:{method:"Registered upload metadata; not extracted or independently reviewed",status:"recorded",warnings,sourceSha256:document.original.sha256}};
  if(raw.authors!==undefined){try{assert(Array.isArray(raw.authors)&&raw.authors.length<=50,"Registered authors must be a bounded list.");result.authors=raw.authors.map(value=>text(value,"Registered document author",500));}catch{warnings.push("Registered authors are not a supported descriptive list; inspect the retained original metadata.");}}
  for(const key of ["publisher","documentType","documentRevision","reportingPeriod","documentStatus","identifier"])if(raw[key]!==undefined)result[key]=read(key,1000);
  if(raw.documentDate!==undefined){const value=read("documentDate",64);if(!value||/^\d{4}-\d\d-\d\d(?:$|T)/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value.slice(0,10)).toISOString().slice(0,10)===value.slice(0,10))result.documentDate=value;else warnings.push("Registered document date is not an exact ISO date; inspect the retained original metadata.");}
  return result;
}
function validateTarget(target){
  exactKeys(target,["kind","bucket","key","versionId","sha256","sizeBytes","contentType"],"Immutable engagement source target");
  assert(target.kind==="source"&&typeof target.bucket==="string"&&/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(target.bucket),"Use an exact private source bucket.");
  assert(typeof target.key==="string"&&target.key.length<=2048&&!target.key.includes("..")&&/^tenants\/[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}\/projects\/[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}\/documents\/[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}\/original$/.test(target.key),"Use an exact account/project/document original key.");
  assert(validVersion(target.versionId)&&sha256Pattern.test(target.sha256||"")&&Number.isSafeInteger(target.sizeBytes)&&target.sizeBytes>0&&target.sizeBytes<=engagementSourceLimits.sourceBytes,"Use a bounded exact immutable source version, size and SHA256.",413);
  assert(typeof target.contentType==="string"&&target.contentType.length<=160&&/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+(?:;[^\x00-\x1f\x7f]*)?$/.test(target.contentType),"Retain the exact original content type.");
  return target;
}
const targetKey=target=>stableJson(validateTarget(target));

export function projectSourceProjection({projectRow,documentRows,accountStorage,resourceAuthority}={}){
  const authority=assertConfiguredResourceAuthority(resourceAuthority);
  const owner=rowValue(projectRow,"PROJECT","project_id");
  assert(owner.status==="active","The source project must be active.",409);
  identifier(owner.workspace_id,"Source workspace");identifier(owner.account_id,"Source account");
  assert(owner.resource?.resource_type==="project"&&owner.resource.resource_id===owner.project_id&&owner.resource.workspace_id===owner.workspace_id,"Source project collaboration identity differs from its exact scope.");
  assert(Array.isArray(documentRows)&&documentRows.length<=engagementSourceLimits.documents,"Explicitly select at most 100 authorized source documents.",413);
  const storage=typeof accountStorage?.forAccount==="function"&&typeof accountStorage?.forKey==="function"?accountStorage:createAccountStorage(accountStorage);
  const configured=storage.forAccount(owner.account_id),sources=new Map(),resources=[],seen=new Set();
  for(const row of documentRows){
    const document=rowValue(row,"DOCUMENT","artifact_id");
    assert(document.document_id===document.artifact_id&&!seen.has(document.artifact_id),"Selected source document identities must be exact and unique.");seen.add(document.artifact_id);
    assert(document.status==="active"&&document.content_state==="ready"&&isObject(document.original),"Select only active documents with a verified ready original.",409);
    assert(document.project_id===owner.project_id&&document.workspace_id===owner.workspace_id&&document.account_id===owner.account_id,"A source document crosses the engagement's exact project/workspace/account scope.",403);
    assert(document.resource?.resource_type==="document"&&document.resource.resource_id===document.artifact_id&&document.resource.workspace_id===owner.workspace_id&&document.resource.project_id===owner.project_id,"Source collaboration identity differs from its project/document scope.",403);
    const original=document.original,reference=original.reference;
    assert(validateResourceReference(reference,{immutable:true}).length===0&&reference.authority===authority&&reference.resource_type==="document_original"&&reference.resource_id===document.artifact_id&&reference.workspace_id===owner.workspace_id&&validVersion(reference.version_id),"Original reference must identify this exact hosted authority, document, workspace and immutable provider version.");
    const key=`tenants/${owner.account_id}/projects/${owner.project_id}/documents/${document.artifact_id}/original`;
    assert(original.bucket===configured.bucket&&original.key===key&&document.storage_key===key,"Original storage differs from the operator-configured exact account/project/document target.",409);
    const routed=storage.forKey(key);assert(routed.bucket===configured.bucket&&routed.accountId===owner.account_id&&routed.projectId===owner.project_id,"Configured original storage scope differs.",409);
    assert(isObject(document.upload)&&document.upload.sha256===original.sha256&&document.upload.size_bytes===original.size_bytes&&document.upload.content_type===document.content_type&&original.content_type===document.content_type,"Ready original metadata differs from its immutable registered checksum, size or content type.",409);
    const target=validateTarget({kind:"source",bucket:original.bucket,key,versionId:reference.version_id,sha256:original.sha256,sizeBytes:original.size_bytes,contentType:original.content_type});
    const versionId=`hosted:${document.artifact_id}:${original.sha256}`;assert(versionId.length<=192,"The canonical hosted source version ID exceeds its portable identifier limit.");
    const filename=text(document.filename,"Original filename",1000),metadata=descriptiveMetadata(document);
    sources.set(versionId,Object.freeze({...target}));
    resources.push({id:document.artifact_id,title:metadata.title,kind:"document",mode:"managed",metadataHistory:[],versions:[{id:versionId,filename,sha256:original.sha256,size:original.size_bytes,mediaType:original.content_type,availability:"available",intakeMetadata:metadata,effectiveMetadata:structuredClone(metadata),reference:structuredClone(reference)}]});
  }
  const project={id:owner.project_id,accountId:owner.account_id,name:text(owner.name,"Source project name",500),client:optional(owner.client,"Project client",1000),phase:optional(owner.phase,"Project phase",200),period:optional(owner.period,"Project period",200),revision:projectRow.revision,resources};
  return {project,sources};
}

/** Include old approved/history citations and explicit current-input source IDs.
 * Unknown references are deliberately left to the common engine's graph guard. */
export function sourceVersionIdsForInput({project,packages=[],input,sources,originArchives}={}){
  assert(sources instanceof Map&&sources.size<=engagementSourceLimits.documents,"Use the current authorized source projection.");
  validateEngagementPackages(project,packages,{accountId:project.accountId,originArchives});
  const selected=new Set(engagementPackageSourceVersionIds(project,packages,{originArchives}));
  assert(isObject(input),"Use a structured source-selection command.");
  let nodes=0,contentBytes=0;
  const visit=(value,depth)=>{
    assert(++nodes<=engagementSourceLimits.inputNodes&&depth<=engagementSourceLimits.inputDepth,"The source-selection command exceeds its structural traversal bound.",413);
    if(typeof value==="string"){contentBytes+=Buffer.byteLength(value);assert(contentBytes<=engagementSourceLimits.inputBytes,"The source-selection command exceeds its structural byte bound.",413);if(sources.has(value))selected.add(value);}
    else if(Array.isArray(value))for(const item of value)visit(item,depth+1);
    else if(isObject(value))for(const key in value)if(Object.hasOwn(value,key)){contentBytes+=Buffer.byteLength(key);assert(contentBytes<=engagementSourceLimits.inputBytes,"The source-selection command exceeds its structural byte bound.",413);visit(value[key],depth+1);}
  };
  visit(input,0);
  assert(Buffer.byteLength(JSON.stringify(input))<=engagementSourceLimits.inputBytes,"The source-selection command exceeds its structural byte bound.",413);
  assert(selected.size<=engagementSourceLimits.documents&&[...selected].every(id=>sources.has(id)),"Every retained citation must have its explicitly authorized original source.",403);
  return [...selected].sort();
}

export function createEngagementSourceCache(){
  const entries=new Map();let size=0;
  const remove=key=>{const entry=entries.get(key);if(entry){size-=entry.bytes.byteLength;entries.delete(key);}};
  return {
    get(target){const key=targetKey(target),entry=entries.get(key);if(!entry)return null;assert(entry.bytes.byteLength===target.sizeBytes&&hash(entry.bytes)===target.sha256,"Cached immutable source bytes failed their exact manifest check.",409);entries.delete(key);entries.set(key,entry);return Buffer.from(entry.bytes);},
    set(target,bytes){const key=targetKey(target);assert(bytes instanceof Uint8Array&&bytes.byteLength===target.sizeBytes&&hash(bytes)===target.sha256,"Cache only independently verified exact original bytes.",409);remove(key);while(entries.size>=engagementSourceLimits.cacheEntries||size+bytes.byteLength>engagementSourceLimits.cacheBytes)remove(entries.keys().next().value);const copy=Buffer.from(bytes);entries.set(key,{bytes:copy});size+=copy.byteLength;},
    clear(){entries.clear();size=0;},
    stats(){return {entries:entries.size,bytes:size};}
  };
}
const assertNotAborted=signal=>{if(signal?.aborted)throw Object.assign(new Error("The explicit original-source read was stopped."),{name:"AbortError",status:499,statusCode:499});};
export async function loadEngagementOriginals({sources,versionIds,readSource,signal,cache}={}){
  assert(sources instanceof Map&&Array.isArray(versionIds)&&versionIds.length<=engagementSourceLimits.documents&&new Set(versionIds).size===versionIds.length&&typeof readSource==="function","Use a bounded explicit unique source-version selection.");
  assertNotAborted(signal);
  let declared=0;
  const selected=versionIds.map(id=>{const target=sources.get(id);assert(target,"Selected original source is outside the authorized source projection.",403);validateTarget(target);declared+=target.sizeBytes;return [id,target];});
  assert(declared<=engagementSourceLimits.totalBytes,"Selected original bytes exceed the 64 MiB aggregate limit; choose a smaller authorized engagement source set.",413);
  const originals=new Map();
  for(const [id,target]of selected){
    assertNotAborted(signal);let bytes=cache?.get(target);
    if(!bytes){
      const receipt=await readSource({...target},{signal});assertNotAborted(signal);
      assert(isObject(receipt)&&receipt.bytes instanceof Uint8Array&&receipt.versionId===target.versionId&&receipt.sha256===target.sha256&&receipt.sizeBytes===target.sizeBytes&&receipt.contentType===target.contentType,"The original provider receipt differs from its exact immutable source manifest.",409);
      bytes=receipt.bytes;assert(bytes.byteLength===target.sizeBytes&&hash(bytes)===target.sha256,"Original source bytes failed their exact size or SHA256 check.",409);cache?.set(target,bytes);
    }
    assert(bytes instanceof Uint8Array&&bytes.byteLength===target.sizeBytes&&hash(bytes)===target.sha256,"Original source bytes failed their exact size or SHA256 check.",409);
    originals.set(id,{bytes:Buffer.from(bytes)});
  }
  assertNotAborted(signal);return originals;
}
