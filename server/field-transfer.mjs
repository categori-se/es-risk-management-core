import {mkdirSync,writeFileSync,readdirSync,lstatSync,renameSync,rmSync,openSync,closeSync,fstatSync,readSync,constants} from "node:fs";
import {join} from "node:path";
import {createHash,randomUUID} from "node:crypto";

export const fieldTransferLimits = Object.freeze({chunkBytes:1024*1024,maxBytes:32*1024*1024,maxActive:4});
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function transferLease(value,scope){
  if(value===undefined)return undefined;
  const object=item=>item!==null&&typeof item==="object"&&!Array.isArray(item);
  if(!object(value)||Object.keys(value).some(key=>!["format","schemaVersion","scope","policySha256","issuedAt","expiresAt","retentionReviewAt"].includes(key))||value.format!=="esia-local-field-device-lease"||value.schemaVersion!==1||!object(value.scope)||Object.keys(value.scope).some(key=>!["accountId","projectId","engagementId"].includes(key))||["accountId","projectId","engagementId"].some(key=>typeof value.scope[key]!=="string"||!/^[A-Za-z0-9_.:-]{1,192}$/.test(value.scope[key]))||value.scope.projectId!==scope.projectId||!/^[a-f0-9]{64}$/.test(value.policySha256)||["issuedAt","expiresAt","retentionReviewAt"].some(key=>typeof value[key]!=="string"||value[key].length>40||!Number.isFinite(Date.parse(value[key]))))fail("Use a bounded device lease for this field transfer.");
  if(value.scope.accountId!==scope.accountId)fail("This field transfer lease belongs to another account.",403);
  // This is shape validation only; the commit rechecks current repository
  // policy, exact logical account/engagement scope and expiry before applying.
  return structuredClone(value);
}
const regular=path=>{const info=lstatSync(path);if(!info.isFile()||info.nlink!==1)fail("Transfer storage requires an ordinary private file.");return info;};
function privateBytes(path,maximum,expected){
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{
    const before=fstatSync(fd);
    if(!before.isFile()||before.nlink!==1||before.size>maximum||expected!==undefined&&before.size!==expected)fail("The staged field transfer file has changed.",409);
    const buffer=Buffer.alloc(maximum+1),length=readSync(fd,buffer,0,buffer.length,0),after=fstatSync(fd);
    if(length!==before.size||length>maximum||after.size!==before.size||after.mtimeMs!==before.mtimeMs)fail("The staged field transfer file changed while reading.",409);
    return buffer.subarray(0,length);
  }finally{closeSync(fd);}
}

// Explicit, bounded local transfers. No worker, timer, background retry or cloud.
export function createFieldTransferStore({directory}) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  const root=lstatSync(directory);if(!root.isDirectory()||root.isSymbolicLink())fail("Choose ordinary local transfer storage.");
  const scopeKey=scope=>hash(Buffer.from(JSON.stringify([scope.accountId,scope.projectId])));
  const paths=(scope,id)=>{if(!/^[a-f0-9]{64}$/.test(id))fail("Choose a valid field transfer identity.");const base=join(directory,scopeKey(scope));return {base,folder:join(base,id)};};
  function read(scope,id){
    const {base,folder}=paths(scope,id),path=join(folder,"manifest.json");
    try{for(const dir of [base,folder]){const info=lstatSync(dir);if(!info.isDirectory()||info.isSymbolicLink())fail("Transfer storage requires an ordinary private directory.");}regular(path);}catch(error){if(error.code==="ENOENT")fail("This field transfer is unavailable in the selected account and project.",404);throw error;}
    let value;try{value=JSON.parse(privateBytes(path,4096).toString("utf8"));}catch(error){if(error.status)throw error;fail("The staged transfer manifest is invalid.",409);}
    if(value===null||typeof value!=="object"||Array.isArray(value)||value.schemaVersion!==1||value.accountId!==scope.accountId||value.projectId!==scope.projectId||value.sha256!==id||!Number.isSafeInteger(value.bytes)||value.bytes<1||value.bytes>fieldTransferLimits.maxBytes||value.chunks!==Math.ceil(value.bytes/fieldTransferLimits.chunkBytes)||!Number.isSafeInteger(value.expectedRevision)||value.expectedRevision<1)fail("The transfer ownership, bounds or content identity changed.",409);
    transferLease(value.deviceLease,scope);
    return {folder,value};
  }
  function write(folder,value){const next=join(folder,`${randomUUID()}.tmp`);writeFileSync(next,JSON.stringify(value),{mode:0o600,flag:"wx"});renameSync(next,join(folder,"manifest.json"));}
  function status(scope,id){
    const {folder,value}=read(scope,id),received=[];
    for(let index=0;index<value.chunks;index++){const path=join(folder,`${index}.part`);try{const info=regular(path),expected=Math.min(fieldTransferLimits.chunkBytes,value.bytes-index*fieldTransferLimits.chunkBytes);if(info.size!==expected)fail("A staged chunk changed. Remove this transfer and resend its encrypted device record.",409);received.push(index);}catch(error){if(error.code!=="ENOENT")throw error;}}
    return {id,bytes:value.bytes,chunks:value.chunks,chunkBytes:fieldTransferLimits.chunkBytes,received,expectedRevision:value.expectedRevision};
  }
  return {
    begin(scope,{sha256,bytes,expectedRevision,deviceLease}){
      if(!/^[a-f0-9]{64}$/.test(sha256)||!Number.isSafeInteger(bytes)||bytes<1||bytes>fieldTransferLimits.maxBytes)fail("A field transfer requires a SHA256 and at most 32 MiB.",413);
      if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)fail("Review the current project revision before transferring a field record.");
      const lease=transferLease(deviceLease,scope);
      const {base,folder}=paths(scope,sha256);mkdirSync(base,{recursive:true,mode:0o700});
      if(lstatSync(base).isSymbolicLink()||!lstatSync(base).isDirectory())fail("Transfer storage requires an ordinary private directory.");
      try{const old=read(scope,sha256);if(old.value.bytes!==bytes)fail("The existing transfer identifies different bytes.",409);if(lease!==undefined){old.value.deviceLease=lease;write(old.folder,old.value);}return status(scope,sha256);}catch(error){if(error.status!==404)throw error;}
      if(readdirSync(base).filter(name=>/^[a-f0-9]{64}$/.test(name)).length>=fieldTransferLimits.maxActive)fail("Four field transfers are already retained for this project. Resume or remove one before starting another.",409);
      mkdirSync(folder,{mode:0o700});write(folder,{schemaVersion:1,accountId:scope.accountId,projectId:scope.projectId,sha256,bytes,chunks:Math.ceil(bytes/fieldTransferLimits.chunkBytes),expectedRevision,createdAt:new Date().toISOString(),...(lease?{deviceLease:lease}:{})});
      return status(scope,sha256);
    },
    status,
    chunk(scope,id,{index,contentBase64,sha256}){
      const {folder,value}=read(scope,id);
      if(!Number.isSafeInteger(index)||index<0||index>=value.chunks||typeof contentBase64!=="string"||contentBase64.length>Math.ceil(fieldTransferLimits.chunkBytes/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(contentBase64))fail("Choose one valid bounded transfer chunk.");
      const bytes=Buffer.from(contentBase64,"base64"),expected=Math.min(fieldTransferLimits.chunkBytes,value.bytes-index*fieldTransferLimits.chunkBytes);
      if(bytes.length!==expected||hash(bytes)!==sha256)fail("Transfer chunk size or SHA256 does not match.",409);
      const path=join(folder,`${index}.part`);
      try{writeFileSync(path,bytes,{flag:"wx",mode:0o600});}catch(error){if(error.code!=="EEXIST")throw error;if(hash(privateBytes(path,fieldTransferLimits.chunkBytes,expected))!==sha256)fail("This chunk identity already contains different bytes.",409);}
      return {id,index,acknowledged:true};
    },
    rebase(scope,id,{previousRevision,expectedRevision}){
      const {folder,value}=read(scope,id);
      if(value.expectedRevision!==previousRevision||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)fail("The field transfer revision changed. Review it before reconciling.",409);
      value.expectedRevision=expectedRevision;write(folder,value);return status(scope,id);
    },
    commit(scope,id,apply){
      const {folder,value}=read(scope,id),progress=status(scope,id);
      if(progress.received.length!==value.chunks)fail("Resume the remaining chunks before saving this field record.",409);
      const bytes=Buffer.concat(Array.from({length:value.chunks},(_,index)=>privateBytes(join(folder,`${index}.part`),fieldTransferLimits.chunkBytes,Math.min(fieldTransferLimits.chunkBytes,value.bytes-index*fieldTransferLimits.chunkBytes))));
      if(bytes.length!==value.bytes||hash(bytes)!==id)fail("The complete field record failed its byte integrity check.",409);
      let record;try{record=JSON.parse(bytes.toString("utf8"));}catch{fail("The field record must contain valid JSON.");}
      if(record===null||typeof record!=="object"||Array.isArray(record))fail("Choose a structured field record.");
      return apply(record,value.expectedRevision,...(value.deviceLease?[{deviceLease:value.deviceLease}]:[]));
    },
    remove(scope,id){const {folder}=read(scope,id);rmSync(folder,{recursive:true});return {removed:true};}
  };
}
