// JSON transport only. Professional judgments and retained schema validation
// remain with the shared engagement engine and its authorized repository.
import {readPrivateDownload} from '@categori/app-connections-streams/download';
export const engagementJsonTransferLimits=Object.freeze({jsonBytes:40*1024*1024,chunkBytes:512*1024,ranges:80,jsonDepth:64,jsonNodes:1000000});
const format='esia-engagement-json-transfer',uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}',uuidPattern=new RegExp('^'+uuid+'$'),opaque=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes('..'),hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const manifestKeys=['format','schemaVersion','projection','transfer_id','sha256','size_bytes','content_type','chunk_bytes','expires_at','pin'],pinKeys=['engagement_id','account_id','project_id','user_id','issuer','subject','configuration_revision','head_revision','head_sha256','source_sha256','source_view_sha256','authority_sha256'];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value),exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
const invalid=message=>{throw Object.assign(Error(message||'The engagement JSON transfer changed or exceeds its bounds.'),{code:'ENGAGEMENT_JSON_TRANSFER_INVALID'});};
export const isEngagementJsonTransfer=value=>object(value)&&value.format===format;
function originRequest(path,method){
 if(typeof path!=='string'||path.includes('\\')||path.includes('..')||path.includes('?')||path.includes('#'))invalid('Use an exact engagement JSON request.');
 const get=new RegExp('^/api/engagements/('+uuid+')(?:/(project|exchange|field-context))?$').exec(path);if(method==='GET'&&get)return {engagementId:get[1],projection:get[2]==='field-context'?'response':get[2]||'engagement',operation:get[2]};
 const caseSave=new RegExp('^/api/engagements/('+uuid+')/cases/'+uuid+'/details$').exec(path);if(method==='PUT'&&caseSave)return {engagementId:caseSave[1],projection:'response',operation:'case-details'};
 const mutation=new RegExp('^/api/engagements/('+uuid+')/(commands|document-classifications|source-attachments|field-context/prepare|field-captures|field-captures/review|offline-assessments/prepare|offline-assessments/commands|offline-assessments/renewal-review|offline-assessments/renew|index|baselines/'+uuid+'/exports)$').exec(path);if(method==='POST'&&mutation)return {engagementId:mutation[1],projection:'response',operation:mutation[2]};
 if(method==='POST'&&path==='/api/engagements')return {engagementId:null,projection:'response'};
 if(method==='POST'&&new RegExp('^/api/engagement-successors/'+uuid+'/create$').test(path))return {engagementId:null,projection:'response',operation:'successor'};
 invalid('This request does not support an engagement JSON transfer.');
}
function checkedManifest(value,{origin,now,expectedIssuer,expectedSubject,chunk=false}){
 if(!exact(value,chunk?[...manifestKeys,'offset','length','bytes_base64']:manifestKeys)||value.format!==format||value.schemaVersion!==1||value.projection!==origin.projection||!uuidPattern.test(value.transfer_id||'')||!hash(value.sha256)||!Number.isSafeInteger(value.size_bytes)||value.size_bytes<1||value.size_bytes>engagementJsonTransferLimits.jsonBytes||value.content_type!=='application/json'||value.chunk_bytes!==engagementJsonTransferLimits.chunkBytes||!exact(value.pin,pinKeys))invalid();
 const pin=value.pin;if(!uuidPattern.test(pin.engagement_id||'')||origin.engagementId&&pin.engagement_id!==origin.engagementId||!['account_id','project_id','user_id'].every(key=>opaque(pin[key]))||typeof pin.issuer!=='string'||!pin.issuer.startsWith('https://')||pin.issuer.length>1024||expectedIssuer&&pin.issuer!==expectedIssuer||typeof pin.subject!=='string'||!pin.subject.trim()||pin.subject.length>512||/[\u0000-\u001f\u007f]/.test(pin.subject)||expectedSubject&&pin.subject!==expectedSubject||!['configuration_revision','head_revision'].every(key=>Number.isSafeInteger(pin[key])&&pin[key]>0)||!['head_sha256','source_sha256','source_view_sha256','authority_sha256'].every(key=>hash(pin[key])))invalid('The engagement transfer does not match its exact signed-in scope.');
 const expiry=Date.parse(value.expires_at);if(typeof value.expires_at!=='string'||!Number.isFinite(expiry)||new Date(expiry).toISOString()!==value.expires_at||expiry>now()+125000)invalid('The engagement transfer expiry is invalid.');if(expiry<=now())throw Object.assign(Error('This engagement transfer expired. Reopen the saved record to start a fresh transfer.'),{status:409,code:'ENGAGEMENT_JSON_TRANSFER_EXPIRED'});return structuredClone(value);
}
function sameManifest(value,manifest){for(const key of manifestKeys)if(key==='pin'?pinKeys.some(field=>value.pin[field]!==manifest.pin[field]):value[key]!==manifest[key])invalid('The engagement transfer identity or assessment changed between ranges.');}
function checkedResult(value,manifest,origin){
 const pin=manifest.pin,kind=manifest.projection,core=kind==='response'?(value?.engagement||value?.context?.engagement||value):value;
 if(kind==='response'&&origin.operation==='index'){
  if(value?.format!=='esia-engagement-source-index'||value.schemaVersion!==1||value.projectId!==pin.project_id||!Number.isSafeInteger(value.projectRevision)||value.projectRevision<1||!/^index_[a-f0-9]{64}$/.test(value.indexId||'')||!hash(value.corpusSha256)||value.aiUsed!==false||!Array.isArray(value.documents)||value.documents.length>100||!Array.isArray(value.passages)||value.passages.length>2000)invalid('The transferred source index differs from its exact project scope.');
  const sources=new Map();for(const document of value.documents){if(!opaque(document?.versionId)||sources.has(document.versionId)||!hash(document.sha256)||!['indexed','error','unavailable','unsupported'].includes(document.status)||!Array.isArray(document.passageIds)||document.passageIds.length>2000||document.passageIds.some(id=>!opaque(id)))invalid('The transferred index has an invalid exact-source manifest.');sources.set(document.versionId,document);}
  const passages=new Set();for(const passage of value.passages){const source=sources.get(passage?.versionId);if(!opaque(passage?.id)||passages.has(passage.id)||!source||passage.sha256!==source.sha256||passage.sourceSha256!==source.sha256||!source.passageIds.includes(passage.id)||typeof passage.quote!=='string'||passage.quote.length>2000)invalid('The transferred index passage differs from its source manifest.');passages.add(passage.id);}return value;
 }
 if(kind==='project'){if(!object(value)||value.id!==pin.project_id||value.accountId!==pin.account_id||!Array.isArray(value.resources))invalid('The transferred source register differs from its exact scope.');return value;}
 if(kind==='exchange'){if(value?.format!=='esia-engagement-project-exchange'||value.schemaVersion!==1||value.project?.id!==pin.project_id||value.project.accountId!==pin.account_id||!Array.isArray(value.engagements)||value.engagements.length!==1||value.engagements[0]?.engagement?.id!==pin.engagement_id)invalid('The transferred engagement exchange differs from its exact scope.');return value;}
 const authority=core?.serverAuthority;if(!object(core)||core.id!==pin.engagement_id||core.accountId!==pin.account_id||core.projectId!==pin.project_id||!object(authority)||Object.entries({userId:pin.user_id,issuer:pin.issuer,subject:pin.subject,accountId:pin.account_id,projectId:pin.project_id,configurationRevision:pin.configuration_revision,headRevision:pin.head_revision,headSha256:pin.head_sha256}).some(([key,item])=>authority[key]!==item))invalid('The transferred assessment differs from its current signed-in authority.');
 const project=kind==='response'&&(value.project||value.context?.project);if(project&&(project.id!==pin.project_id||project.accountId!==pin.account_id||!Array.isArray(project.resources)))invalid('The transferred response contains another source project.');return value;
}

/** One foreground, authenticated transfer. Every range repeats current authority
 * checks; expiry or failure returns to the caller without replay or retry. */
export async function readEngagementJsonTransfer({manifest,path,method='GET',request,assertCurrent=()=>{},cryptoImpl=globalThis.crypto,now=Date.now,signal,expectedIssuer,expectedSubject}={}){
 if(typeof request!=='function'||typeof assertCurrent!=='function'||typeof now!=='function')throw new TypeError('An authenticated engagement JSON transport is required.');
 const origin=originRequest(path,method),current=()=>{assertCurrent();if(signal?.aborted)throw new DOMException('The engagement record transfer was interrupted.','AbortError');};current();const pinned=checkedManifest(manifest,{origin,now,expectedIssuer,expectedSubject}),base='/api/engagements/'+pinned.pin.engagement_id+'/json-transfer/'+pinned.projection;
 const bytes=await readPrivateDownload({manifest:{mediated:true,version_id:pinned.transfer_id,sha256:pinned.sha256,size_bytes:pinned.size_bytes},selector:{},maximumBytes:engagementJsonTransferLimits.jsonBytes,cryptoImpl,assertCurrent:current,request:async range=>{
  current();checkedManifest(pinned,{origin,now,expectedIssuer,expectedSubject});const {offset,length}=range,result=await request(base,{method:'POST',body:{transfer_id:pinned.transfer_id,sha256:pinned.sha256,size_bytes:pinned.size_bytes,expires_at:pinned.expires_at,pin:structuredClone(pinned.pin),offset,length},signal});current();checkedManifest(result,{origin,now,expectedIssuer,expectedSubject,chunk:true});sameManifest(result,pinned);return {version_id:result.transfer_id,sha256:result.sha256,size_bytes:result.size_bytes,offset:result.offset,length:result.length,bytes_base64:result.bytes_base64};
 }});
 try{current();const value=decodeEngagementJsonBytes(bytes,{assertCurrent:current});checkedManifest(pinned,{origin,now,expectedIssuer,expectedSubject});const result=checkedResult(value,pinned,origin);current();return result;}finally{bytes.fill(0);}
}

/** Decode only after the caller verifies exact retained bytes and current
 * authority. Parsing never publishes a partial or lossy UTF-8 record. */
export function decodeEngagementJsonBytes(bytes,{maximumBytes=engagementJsonTransferLimits.jsonBytes,assertCurrent=()=>{}}={}){
 assertCurrent();
 if(!(bytes instanceof Uint8Array)||!Number.isSafeInteger(maximumBytes)||maximumBytes<1||maximumBytes>engagementJsonTransferLimits.jsonBytes||bytes.length<1||bytes.length>maximumBytes)throw Error('The engagement JSON exceeds its bounded transfer size.');
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw Error('The retained engagement transfer is not complete UTF-8 JSON.');}
 const stack=[{value,depth:0}];let nodes=0;
 while(stack.length){const item=stack.pop();if(++nodes>engagementJsonTransferLimits.jsonNodes||item.depth>engagementJsonTransferLimits.jsonDepth)throw Error('The engagement JSON exceeds its structural transfer bound.');
  if(item.value===null||typeof item.value==='string'||typeof item.value==='boolean')continue;
  if(typeof item.value==='number'){if(!Number.isFinite(item.value))throw Error('The engagement JSON contains an invalid number.');continue;}
  if(!item.value||typeof item.value!=='object')throw Error('The engagement transfer must contain ordinary JSON.');
  for(const entry of Object.values(item.value)){if(nodes+stack.length>=engagementJsonTransferLimits.jsonNodes)throw Error('The engagement JSON exceeds its structural transfer bound.');stack.push({value:entry,depth:item.depth+1});}
 }
 assertCurrent();return value;
}
