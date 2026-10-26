// Foreground reads of an explicitly installed immutable reference catalog.
// Authorization remains with engagement-library; this provider grants no rights.
import {createHash} from 'node:crypto';
import {GetObjectCommand} from '@aws-sdk/client-s3';
import {createPolicyOriginalCatalog} from './policy-original-catalog.mjs';
import {validateRequirementTarget} from './requirement-library.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=message=>{throw Object.assign(Error(message),{statusCode:503});};
const targetFields=['bucket','key','versionId','sha256','size'];
const same=(a,b)=>targetFields.every(key=>a[key]===b[key]);
export function createS3PolicyOriginalProvider({client,index,reservedBuckets=[],timeoutMs=20000}={}){
 if(!index)return {};
 const configured=validateRequirementTarget(index,{maxBytes:1024*1024});
 if(!client||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>20000)throw Error('Configure a bounded immutable policy-original provider.');
 async function read(target,{range=false}={}){
  const allowed=range?[...targetFields,'offset','length']:targetFields;
  if(!target||Object.keys(target).length!==allowed.length||Object.keys(target).some(key=>!allowed.includes(key)))fail('Use the exact installed policy object target.');
  const base=Object.fromEntries(targetFields.map(key=>[key,target[key]]));validateRequirementTarget(base,{maxBytes:64*1024*1024});
  const {offset,length}=target,expected=range?length:base.size;
  if(range&&(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>512*1024||offset+length>base.size))fail('Read a bounded exact policy-original range.');
  const controller=new AbortController();let rejectTimeout,body,iterator,finished=false;
  const destroy=value=>{try{value?.destroy?.();}catch{}};
  const deadline=new Promise((_,reject)=>{rejectTimeout=reject;}),timer=setTimeout(()=>{controller.abort();destroy(body);rejectTimeout(Object.assign(Error('The policy-original provider exceeded its deadline.'),{statusCode:503}));},timeoutMs);
  const bounded=promise=>Promise.race([Promise.resolve(promise),deadline]);
  try{
   const pending=Promise.resolve(client.send(new GetObjectCommand({Bucket:base.bucket,Key:base.key,VersionId:base.versionId,...(range?{Range:`bytes=${offset}-${offset+length-1}`}:{})}),{abortSignal:controller.signal}));
   pending.then(response=>{if(finished||controller.signal.aborted)destroy(response?.Body);},()=>{});
   const response=await bounded(pending);body=response.Body;
   if(response.VersionId!==base.versionId||response.ContentLength!==expected||range&&response.ContentRange!==`bytes ${offset}-${offset+length-1}/${base.size}`)fail('The policy provider version, length or range changed.');
   const iterable=body instanceof Uint8Array?[body]:body;iterator=iterable?.[Symbol.asyncIterator]?.()||iterable?.[Symbol.iterator]?.();if(!iterator)fail('The policy provider returned no bounded byte stream.');
   let size=0;const chunks=[];
   while(true){const part=await bounded(iterator.next());if(part.done)break;if(!(part.value instanceof Uint8Array)||(size+=part.value.length)>expected)fail('The policy original exceeded its exact byte limit.');chunks.push(Buffer.from(part.value));}
   if(size!==expected)fail('The policy original is incomplete.');const bytes=Buffer.concat(chunks,size);if(!range&&hash(bytes)!==base.sha256)fail('The immutable policy object differs from its exact SHA256.');return bytes;
  }finally{finished=true;clearTimeout(timer);controller.abort();destroy(body);try{const returned=iterator?.return?.();returned?.catch?.(()=>{});}catch{}}
 }
 const catalog=createPolicyOriginalCatalog({index:configured,reservedBuckets,readVersion:async target=>{if(!same(target,configured))fail('Only the installed policy catalog may be read as metadata.');return read(target);}});
 return {
  resolvePolicyOriginal:(frameworkId,sourceSha256)=>catalog.resolveOriginal(frameworkId,sourceSha256),
  async readPolicyOriginal(target){const permitted=await catalog.assertTarget(target),bytes=await read(permitted);if(bytes.subarray(0,5).toString()!=='%PDF-')fail('The retained policy original is not the configured PDF.');return {bytes,versionId:permitted.versionId,sha256:permitted.sha256,size:permitted.size};},
  async readPolicyOriginalRange(target){if(!target||Object.keys(target).some(key=>![...targetFields,'offset','length'].includes(key)))fail('Use the exact policy-original range fields.');const base=Object.fromEntries(targetFields.map(key=>[key,target[key]])),permitted=await catalog.assertTarget(base);return read({...permitted,offset:target.offset,length:target.length},{range:true});}
 };
}
