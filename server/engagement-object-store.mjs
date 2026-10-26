// Explicit immutable object I/O for authenticated engagements. Authorization is
// supplied by the service before and after every awaited operation. This module
// never discovers resources, lists a bucket, polls, retries in a loop or signs a
// client URL. The configured account prefix is the only provider target.
import {createHash} from "node:crypto";
import {GetObjectCommand,PutObjectCommand,ListObjectVersionsCommand,DeleteObjectsCommand} from "@aws-sdk/client-s3";
import {createAccountStorage} from "./account-storage.mjs";

export const engagementObjectLimits=Object.freeze({snapshotBytes:32*1024*1024,sourceBytes:32*1024*1024,issuedBytes:8*1024*1024,selectionBytes:10*1024*1024,originBytes:40*1024*1024,successorPartBytes:512*1024,clientTemplateBytes:32*1024*1024,timeoutMs:20000});
export const engagementRangeBytes=512*1024;
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const uuid="[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}";
const safeId="[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}";
const snapshotKey=new RegExp(`^tenants/(${safeId})/projects/(${safeId})/engagements/(${uuid})/revisions/(${uuid})\\.json$`);
const issuedKey=new RegExp(`^tenants/(${safeId})/projects/(${safeId})/engagements/(${uuid})/issued/(${uuid})\\.(html|pdf|docx|xlsx|csv|json)$`);
const selectionKey=new RegExp(`^tenants/(${safeId})/projects/(${safeId})/engagements/(${uuid})/offline-selections/(${uuid})\\.json$`);
const sourceKey=new RegExp(`^tenants/(${safeId})/projects/(${safeId})/documents/(${safeId})/original$`);
const originKey=new RegExp(`^tenants/(${safeId})/projects/(${safeId})/engagement-origins/([a-f0-9]{64})\\.json$`);
const successorPartKey=new RegExp(`^tenants/(${safeId})/projects/(${safeId})/successor-staging/(${uuid})/([a-f0-9]{64})/parts/(0|[1-9][0-9]{0,8})\\.bin$`);
const clientTemplateKey=new RegExp(`^tenants/(${safeId})/projects/(${safeId})/engagements/(${uuid})/client-template-studio/(?:objects/([a-f0-9]{64})\\.bin|revisions/(${uuid})\\.json|uploads/(${uuid})/parts/(0|[1-9][0-9]{0,8})\\.bin|native-jobs/[a-f0-9]{64}/objects/[a-f0-9]{64}\\.bin)$`);
const conflict=message=>Object.assign(Error(message),{statusCode:409});
const bad=message=>Object.assign(Error(message),{statusCode:400});
const validVersion=value=>typeof value==="string"&&value.length>0&&value.length<=500&&value!=="null"&&!/[\x00-\x1f\x7f]/.test(value);

export function createS3EngagementObjectStore({client,accountStorage}={}){
  if(!client||typeof client.send!=="function")throw Error("Engagement object I/O requires a configured provider.");
  const storage=createAccountStorage(accountStorage);
  function targetOf(target,writing=false){
    if(!target||typeof target!=="object"||typeof target.key!=="string"||target.key.includes(".."))throw bad("Use an exact bounded engagement object target.");
    const kind=target.kind||"snapshot",match=(kind==="snapshot"?snapshotKey:kind==="issued"?issuedKey:kind==="selection"?selectionKey:kind==="origin"?originKey:kind==="successor_part"?successorPartKey:kind==="client_template"?clientTemplateKey:kind==="source"&&!writing?sourceKey:null)?.exec(target.key);
    if(!match)throw bad("This object is outside the supported engagement storage namespace.");
    const configured=storage.forKey(target.key);
    if(target.bucket!==configured.bucket||configured.accountId!==match[1]||configured.projectId!==match[2])throw bad("Engagement storage must match its configured account and project.");
    const limit=engagementObjectLimits[kind==="client_template"?"clientTemplateBytes":kind==="source"?"sourceBytes":kind==="issued"?"issuedBytes":kind==="selection"?"selectionBytes":kind==="origin"?"originBytes":kind==="successor_part"?"successorPartBytes":"snapshotBytes"];
    if(!/^[a-f0-9]{64}$/.test(target.sha256||"")||!Number.isSafeInteger(target.sizeBytes)||target.sizeBytes<1||target.sizeBytes>limit)throw bad("Use a bounded byte size and exact SHA256 manifest.");
    if(typeof target.contentType!=="string"||!target.contentType||target.contentType.length>200||/[\r\n\x00]/.test(target.contentType)||["snapshot","selection","origin"].includes(kind)&&target.contentType!=="application/json"||kind==="successor_part"&&target.contentType!=="application/octet-stream")throw bad("The engagement object media type is invalid.");
    if(kind==="client_template"&&(match[4]&&match[4]!==target.sha256||target.key.includes("/native-jobs/")&&!target.key.endsWith("/"+target.sha256+".bin")))throw bad("A client template object key must pin its exact SHA256.");
    if(kind==="origin"&&match[3]!==target.sha256)throw bad("An origin object's key must pin its exact archive SHA256.");
    if(kind==="successor_part"&&(Number(match[5])%engagementRangeBytes!==0||Number(match[5])>=engagementObjectLimits.originBytes))throw bad("A successor part must start at its fixed bounded part offset.");
    if(kind==="selection"&&!["confidential","restricted"].includes(target.dataClassification))throw bad("Retain the complete offline review's governed storage classification.");
    if(target.versionId!==undefined&&!validVersion(target.versionId)||kind==="source"&&!validVersion(target.versionId))throw bad("Source reads require their exact immutable provider version.");
    return {configured,kind,accountId:match[1],projectId:match[2],engagementId:["source","origin"].includes(kind)?null:match[3]};
  }
  async function read(target){
    const {configured}=targetOf(target),checksum=Buffer.from(target.sha256,"hex").toString("base64");
    let object;
    try{object=await client.send(new GetObjectCommand({Bucket:configured.bucket,Key:target.key,...(target.versionId?{VersionId:target.versionId}:{}),ChecksumMode:"ENABLED"}),{abortSignal:AbortSignal.timeout(engagementObjectLimits.timeoutMs)});}
    catch(error){if(["NoSuchKey","NoSuchVersion","NotFound"].includes(error.name)||error.$metadata?.httpStatusCode===404)throw Object.assign(Error("The retained engagement object is unavailable."),{statusCode:404});throw error;}
    try{
      if(!validVersion(object.VersionId)||target.versionId&&object.VersionId!==target.versionId||object.ContentLength!==target.sizeBytes||object.ContentType!==target.contentType||object.ChecksumSHA256!==checksum)throw conflict("The engagement provider receipt differs from its exact manifest.");
      if(configured.kmsKeyArn&&(object.ServerSideEncryption!=="aws:kms"||object.SSEKMSKeyId!==configured.kmsKeyArn))throw conflict("The engagement object needs its configured account encryption key.");
      const chunks=object.Body instanceof Uint8Array?[object.Body]:object.Body,retained=[];let size=0;
      if(!chunks||!(Symbol.asyncIterator in Object(chunks)||Symbol.iterator in Object(chunks)))throw conflict("The engagement provider returned no bounded bytes.");
      for await(const chunk of chunks){if(!(chunk instanceof Uint8Array))throw conflict("The engagement provider returned an invalid byte stream.");size+=chunk.byteLength;if(size>target.sizeBytes)throw conflict("The engagement byte stream exceeds its manifest.");retained.push(Buffer.from(chunk));}
      const bytes=Buffer.concat(retained);
      if(size!==target.sizeBytes||hash(bytes)!==target.sha256)throw conflict("The engagement original failed its exact size or SHA256 check.");
      return {bytes,versionId:object.VersionId,sha256:target.sha256,sizeBytes:size,contentType:target.contentType,...(typeof object.ETag==="string"?{etag:object.ETag}:{})};
    }finally{object.Body?.destroy?.();}
  }
  async function write(target){
    const {configured,kind,accountId,projectId,engagementId}=targetOf(target,true),bytes=target.bytes;
    if(!(bytes instanceof Uint8Array)||bytes.byteLength!==target.sizeBytes||hash(bytes)!==target.sha256)throw bad("Write the exact server-validated engagement bytes.");
    const tags={account_id:accountId,project_id:projectId,...(engagementId?{[kind==="successor_part"?"successor_stage_id":"engagement_id"]:engagementId}:{}),data_classification:kind==="selection"?target.dataClassification:["origin","successor_part"].includes(kind)?"restricted":"confidential",data_type:kind==="client_template"?"client_template":kind==="issued"?"engagement_issued":kind==="selection"?"engagement_offline_selection":kind==="origin"?"engagement_origin":kind==="successor_part"?"engagement_successor_part":"engagement_revision"};
    let receipt;
    try{receipt=await client.send(new PutObjectCommand({Bucket:configured.bucket,Key:target.key,Body:bytes,ContentLength:bytes.byteLength,ContentType:target.contentType,ChecksumSHA256:Buffer.from(target.sha256,"hex").toString("base64"),IfNoneMatch:"*",Tagging:new URLSearchParams(tags).toString(),...(configured.kmsKeyArn?{ServerSideEncryption:"aws:kms",SSEKMSKeyId:configured.kmsKeyArn}:{})}),{abortSignal:AbortSignal.timeout(engagementObjectLimits.timeoutMs)});}
    catch(error){
      // A caller explicitly retrying a lost acknowledgement can recover only
      // the already retained exact bytes. This never overwrites an old object.
      if(error.name==="PreconditionFailed"||error.$metadata?.httpStatusCode===412)return read(target);
      throw error;
    }
    if(!validVersion(receipt.VersionId))throw conflict("Engagement storage requires a versioned write receipt.");
    return read({...target,versionId:receipt.VersionId});
  }
  async function readRange(target){
    const {configured}=targetOf(target),{offset,length}=target;
    if(!validVersion(target.versionId)||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>engagementRangeBytes||offset+length>target.sizeBytes)throw bad("Use an exact bounded range of a pinned immutable engagement object.");
    const object=await client.send(new GetObjectCommand({Bucket:configured.bucket,Key:target.key,VersionId:target.versionId,Range:`bytes=${offset}-${offset+length-1}`}),{abortSignal:AbortSignal.timeout(engagementObjectLimits.timeoutMs)});
    try{
      if(object.VersionId!==target.versionId||object.ContentLength!==length||object.ContentRange!==`bytes ${offset}-${offset+length-1}/${target.sizeBytes}`||object.ContentType!==target.contentType)throw conflict("The immutable engagement range receipt differs from its manifest.");
      if(configured.kmsKeyArn&&(object.ServerSideEncryption!=="aws:kms"||object.SSEKMSKeyId!==configured.kmsKeyArn))throw conflict("The engagement range needs its configured account encryption key.");
      const chunks=object.Body instanceof Uint8Array?[object.Body]:object.Body,retained=[];let size=0;
      if(!chunks||!(Symbol.asyncIterator in Object(chunks)||Symbol.iterator in Object(chunks)))throw conflict("The provider returned no bounded engagement range.");
      for await(const chunk of chunks){if(!(chunk instanceof Uint8Array))throw conflict("The provider returned an invalid engagement range.");size+=chunk.byteLength;if(size>length)throw conflict("The provider exceeded the engagement range.");retained.push(Buffer.from(chunk));}
      if(size!==length)throw conflict("The engagement range is incomplete.");
      // Immutable version and exact range are pinned here. The consumer checks
      // the complete original SHA256 after assembling its bounded ranges.
      return Buffer.concat(retained);
    }finally{object.Body?.destroy?.();}
  }
  // Explicit, version-pinned cleanup of one expired job prefix. No bucket scan,
  // current-source deletion, timer, worker or automatic retry is introduced.
  async function cleanupNativeJob({scope,jobId,maximumObjects=256,recheck}={}){
    if(!scope||typeof recheck!=='function'||!/^[a-f0-9]{64}$/.test(jobId||'')||maximumObjects!==256)throw bad('Use one exact bounded native staging cleanup.');
    const prefix=`tenants/${scope.accountId}/projects/${scope.projectId}/engagements/${scope.engagementId}/client-template-studio/native-jobs/${jobId}/objects/`,configured=storage.forKey(prefix);
    if(configured.accountId!==scope.accountId||configured.projectId!==scope.projectId||configured.bucket!==scope.bucket)throw bad('Native staging cleanup crossed its configured custody.');
    await recheck();const listed=await client.send(new ListObjectVersionsCommand({Bucket:configured.bucket,Prefix:prefix,MaxKeys:maximumObjects+1}),{abortSignal:AbortSignal.timeout(engagementObjectLimits.timeoutMs)}),versions=[...(listed.Versions||[]),...(listed.DeleteMarkers||[])];
    if(listed.IsTruncated||versions.length>maximumObjects||versions.some(v=>!v.Key?.startsWith(prefix)||!new RegExp('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'[a-f0-9]{64}[.]bin$').test(v.Key)||!validVersion(v.VersionId)))throw conflict('Native staging cleanup exceeded its exact finite object bound; nothing was deleted.');
    if(!versions.length)return {deletedObjects:0};
    await recheck();const result=await client.send(new DeleteObjectsCommand({Bucket:configured.bucket,Delete:{Objects:versions.map(v=>({Key:v.Key,VersionId:v.VersionId})),Quiet:true}}),{abortSignal:AbortSignal.timeout(engagementObjectLimits.timeoutMs)});
    if(result.Errors?.length)throw conflict('Some exact staging versions were not deleted. Explicitly repeat this same bounded cleanup; approved objects are unchanged.');
    return {deletedObjects:versions.length};
  }
  return Object.freeze({read,write,readRange,cleanupNativeJob});
}
