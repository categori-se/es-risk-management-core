import {createCipheriv,createDecipheriv,createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,chmodSync,lstatSync,existsSync,openSync,closeSync,fstatSync,readFileSync,writeFileSync,renameSync,unlinkSync,fsyncSync,constants} from 'node:fs';
import {resolve,join} from 'node:path';

const MAX_SECRET_BYTES=16*1024,MAX_RECORD_BYTES=64*1024;
const providers=['openai','anthropic','gemini','enterprise'];
const defaults={openai:'https://api.openai.com/v1/responses',anthropic:'https://api.anthropic.com/v1/messages',gemini:'https://generativelanguage.googleapis.com/v1beta'};
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status,statusCode:status});};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function id(value,label){if(typeof value!=='string'||!value||value.length>300||value!==value.trim()||/[\x00-\x1f\x7f]/.test(value))fail(`${label} must be an explicit bounded identity.`);return value;}
function endpoint(value,provider){
  if(value!==undefined&&(typeof value!=='string'||value.length>4000||/[\x00-\x20\x7f]/.test(value)))fail('Credential endpoints must be bounded HTTPS URLs without whitespace.');
  let url;try{url=new URL(value||defaults[provider]);}catch{fail('Store an explicit credential-free HTTPS endpoint for this provider.');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)fail('Credential endpoints require HTTPS without user information, query parameters or fragments.');
  if(provider!=='enterprise'&&url.href!==defaults[provider])fail('The credential endpoint must match the official provider API.');
  return url.href;
}
function expiration(value){if(typeof value!=='string'||value.length>40||!Number.isFinite(Date.parse(value)))fail('An explicit credential expiry timestamp is required.');return new Date(value).toISOString();}
function decodeKey(value){
  if(value instanceof Uint8Array&&value.byteLength===32)return Buffer.from(value);
  if(typeof value==='string'&&value.length===44){const bytes=Buffer.from(value,'base64');if(bytes.length===32&&bytes.toString('base64')===value)return bytes;}
  return null;
}
function binding(input){
  if(!plain(input)||Object.keys(input).some(key=>!['reference','provider','accountId','projectId','routeId','routeRevision','endpoint','expiresAt','value'].includes(key)))fail('Use only explicit credential binding fields.');
  const reference=id(input.reference,'Credential reference');if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,191}$/.test(reference))fail('Use a bounded opaque credential reference without paths.');
  if(!providers.includes(input.provider))fail('The vault accepts OpenAI, Anthropic, Gemini and enterprise API credentials. AWS uses its separately reviewed named profile.');
  return{reference,provider:input.provider,accountId:id(input.accountId,'Account identity'),projectId:id(input.projectId,'Project identity'),routeId:id(input.routeId,'Route identity'),routeRevision:id(input.routeRevision,'Route revision'),endpoint:endpoint(input.endpoint,input.provider),expiresAt:expiration(input.expiresAt)};
}

/** This is a server-only credential resolver. Keep its master key outside the
 * data directory and all project exports; no key is generated or persisted. */
export function createEsAiCredentialVault({directory,key=process.env.ESIA_AI_VAULT_KEY,now=()=>new Date()}={}){
  let master=decodeKey(key),disabledReason=master?null:key===undefined||key===null||key===''?'Credential vault is disabled: configure the separate ESIA_AI_VAULT_KEY server environment secret.':'Credential vault is disabled: the server key must be exactly 32 bytes in canonical base64.';
  const root=typeof directory==='string'&&directory?resolve(directory):null;
  if(!root){master?.fill(0);master=null;disabledReason='Credential vault is disabled: select a private local vault directory.';}
  const describe=()=>({available:master!==null,storage:'aes_256_gcm_private_local_files',...(disabledReason?{reason:disabledReason}:{})});
  const ready=()=>{if(!master)fail(disabledReason||'The server credential vault is closed.',409);};
  const timestamp=()=>{const time=new Date(now()).getTime();if(!Number.isFinite(time))fail('The credential vault clock is invalid.',500);return time;};
  const fileFor=reference=>{const name=createHash('sha256').update(reference).digest('hex');return{path:join(root,`${name}.json`),aad:Buffer.from(`ESIA_AI_VAULT/v1/${name}`)};};
  function checkDirectory(create=false){
    if(!existsSync(root)){if(!create)return false;mkdirSync(root,{recursive:true,mode:0o700});}
    const stat=lstatSync(root);if(!stat.isDirectory()||stat.isSymbolicLink())fail('The credential vault requires an ordinary private directory.',409);
    if(create)chmodSync(root,0o700);else if((stat.mode&0o077)!==0)fail('The credential vault directory must be private.',409);
    return true;
  }
  function read(reference){
    if(!checkDirectory())fail('The requested provider credential is unavailable.',409);
    const {path,aad}=fileFor(reference);let descriptor;
    try{
      descriptor=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);const stat=fstatSync(descriptor);
      if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o077)!==0||stat.size>MAX_RECORD_BYTES)fail('The requested provider credential is unavailable.',409);
      const envelope=JSON.parse(readFileSync(descriptor,'utf8'));
      if(!plain(envelope)||Object.keys(envelope).sort().join(',')!=='ciphertext,iv,schemaVersion,tag'||envelope.schemaVersion!==1)fail('The requested provider credential is unavailable.',409);
      const bytes=(value,length)=>{if(typeof value!=='string'||value.length>MAX_RECORD_BYTES)throw Error();const result=Buffer.from(value,'base64');if(result.toString('base64')!==value||length!==undefined&&result.length!==length)throw Error();return result;};
      const iv=bytes(envelope.iv,12),tag=bytes(envelope.tag,16),ciphertext=bytes(envelope.ciphertext);if(!ciphertext.length||ciphertext.length>MAX_RECORD_BYTES)throw Error();
      const decipher=createDecipheriv('aes-256-gcm',master,iv);decipher.setAAD(aad);decipher.setAuthTag(tag);const decrypted=Buffer.concat([decipher.update(ciphertext),decipher.final()]);let record;
      try{record=JSON.parse(decrypted.toString('utf8'));}finally{decrypted.fill(0);}
      const normalized=binding(record);if(normalized.reference!==reference||typeof record.value!=='string'||!record.value||Buffer.byteLength(record.value)>MAX_SECRET_BYTES||/[\x00-\x20\x7f]/.test(record.value))throw Error();
      return{...normalized,value:record.value};
    }catch{fail('The requested provider credential is unavailable or failed integrity verification.',409);}finally{if(descriptor!==undefined)closeSync(descriptor);}
  }
  function store(input){
    ready();const normalized=binding(input);
    if(typeof input.value!=='string'||!input.value||Buffer.byteLength(input.value)>MAX_SECRET_BYTES||/[\x00-\x20\x7f]/.test(input.value))fail('Provide one API credential value of at most 16 KiB without whitespace or control characters.');
    if(Date.parse(normalized.expiresAt)<=timestamp())fail('The credential expiry must be in the future.');
    checkDirectory(true);const {path,aad}=fileFor(normalized.reference);
    if(existsSync(path)){
      const previous=read(normalized.reference);for(const field of ['reference','provider','accountId','projectId','routeId','routeRevision','endpoint'])if(previous[field]!==normalized[field])fail('An existing reference cannot be rebound to another owner, route, provider or endpoint. Use a new opaque reference.',409);
    }
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master,iv);cipher.setAAD(aad);
    const plaintext=Buffer.from(JSON.stringify({...normalized,value:input.value}));let ciphertext;try{ciphertext=Buffer.concat([cipher.update(plaintext),cipher.final()]);}finally{plaintext.fill(0);}
    const bytes=Buffer.from(JSON.stringify({schemaVersion:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));if(bytes.length>MAX_RECORD_BYTES)fail('The credential record exceeds its encrypted byte bound.',413);
    const temporary=join(root,`.pending-${randomUUID()}.json`);let descriptor;
    try{descriptor=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);writeFileSync(descriptor,bytes);fsyncSync(descriptor);closeSync(descriptor);descriptor=undefined;renameSync(temporary,path);const directoryDescriptor=openSync(root,constants.O_RDONLY|constants.O_DIRECTORY);try{fsyncSync(directoryDescriptor);}finally{closeSync(directoryDescriptor);}}
    finally{if(descriptor!==undefined)closeSync(descriptor);if(existsSync(temporary))unlinkSync(temporary);}
    return{stored:true};
  }
  function resolveCredential({reference,route,scope}={}){
    ready();id(reference,'Credential reference');
    if(!plain(route)||!plain(scope))fail('Credential resolution requires a trusted route and current scope.',403);
    const record=read(reference);
    if(record.accountId!==scope.accountId||record.projectId!==scope.projectId||record.provider!==route.provider||record.routeId!==route.id||record.routeRevision!==route.revision||route.processingBoundary!=='remote'||route.enabled===false||route.credentialRef!==undefined&&route.credentialRef!==reference||Date.parse(record.expiresAt)<=timestamp())fail('The requested provider credential is unavailable for this scope or route.',403);
    let selectedEndpoint;try{selectedEndpoint=endpoint(route.endpoint,route.provider);}catch{fail('The requested provider credential is unavailable for this scope or route.',403);}
    if(selectedEndpoint!==record.endpoint)fail('The requested provider credential is unavailable for this scope or route.',403);
    return record.value;
  }
  return{describe,store,resolve:resolveCredential,close:()=>{master?.fill(0);master=null;disabledReason='The server credential vault is closed.';}};
}
