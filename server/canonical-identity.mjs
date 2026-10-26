import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {externalIdentityKey, resolveIdentityUser, validateIdentityUser, validateExternalIdentityLink} from '@categori/workspace-contracts';

// App-owned authority adapter; reuse the existing neutral identity validators.
export class CanonicalIdentityError extends Error {
  constructor(statusCode, message) {super(message);this.statusCode=statusCode;}
}
const fail=(status,message)=>{throw new CanonicalIdentityError(status,message);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value);
const operation=new AsyncLocalStorage();
export const withCanonicalIdentityOperation=callback=>operation.run({rows:new Map(),deadlines:[]},callback);
export function canonicalDeadline(expiresAt,now=Date.now) {
  if(!Number.isSafeInteger(expiresAt)||expiresAt<=now())fail(401,'The original sign-in session expired.');
  operation.getStore()?.deadlines.push({expiresAt,now});
}
export function assertCanonicalDeadline() {
  if(operation.getStore()?.deadlines.some(({expiresAt,now})=>expiresAt<=now()))fail(401,'The original sign-in session expired.');
}
function observe(rows,registryTable) {
  const scope=operation.getStore();if(!scope)return;
  if(scope.registryTable&&scope.registryTable!==registryTable)fail(409,'The original ecosystem identity authority changed.');
  scope.registryTable=registryTable;
  for(const row of rows){const key=JSON.stringify([row.pk,row.sk]),old=scope.rows.get(key);
    if(old&&!isDeepStrictEqual(old,row))fail(409,'Current ecosystem identity changed. Reopen before continuing.');
    if(!old)scope.rows.set(key,structuredClone(row));}
}
export function canonicalOperationChecks(operations,registryTable) {
  const scope=operation.getStore();if(!scope?.rows.size)return operations;
  if(scope.registryTable!==registryTable)fail(409,'The original ecosystem identity authority changed.');
  assertCanonicalDeadline();const result=[...operations];
  for(const row of scope.rows.values()){
    const index=result.findIndex(op=>op.pk===row.pk&&op.sk===row.sk),old=result[index];
    if(old&&(old.put||old.delete||old.expected!==row.revision||old.expectedValue!==undefined&&!isDeepStrictEqual(old.expectedValue,row.value)))fail(409,'The original ecosystem identity snapshot changed.');
    const check={pk:row.pk,sk:row.sk,expected:row.revision,expectedValue:structuredClone(row.value)};
    if(old)result[index]=check;else result.push(check);
  }
  if(result.length>100)fail(413,'The requested identity and access change exceeds the transaction limit.');
  return result;
}
export const canonicalKey=(pk,sk)=>
  /^APP_IDENTITY#GROUP_ALIAS#[a-f0-9]{64}$/.test(pk)&&sk==='PROFILE'||
  /^(APP_IDENTITY#TEAM#|APP_IDENTITY#ORGANIZATION#)[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(pk)&&(sk==='PROFILE'||/^MEMBER#[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(sk))||
  pk==='APP_IDENTITY#REGISTRY'&&sk==='PROFILE'||
  /^APP_IDENTITY#ALIAS#[a-f0-9]{64}(?![\s\S])/.test(pk)&&sk==='PROFILE'||
  /^APP_IDENTITY#LINK#[a-f0-9]{64}(?![\s\S])/.test(pk)&&sk==='LINK'||
  pk.startsWith('APP_IDENTITY#USER#')&&opaque(pk.slice('APP_IDENTITY#USER#'.length))&&sk==='PROFILE';
export function canonicalRow(row,pk,sk) {
  if(!row&&pk!=='APP_IDENTITY#REGISTRY')fail(403,'The reviewed ecosystem identity is not enrolled.');
  if(!row||!canonicalKey(pk,sk)||row.pk!==pk||row.sk!==sk||Object.keys(row).some(k=>!['pk','sk','revision','value','version'].includes(k))||
    !Number.isSafeInteger(row.revision)||row.revision<1||row.version!==undefined&&row.version!==row.revision||
    !row.value||row.value.schema_version!==1||row.value.revision!==row.revision)fail(503,'Current ecosystem identity records are unavailable.');
  return row;
}
export function canonicalConfiguration(env){
  if(env.CANONICAL_IDENTITY_TABLE||env.CANONICAL_IDENTITY_AUTHORITY_ID||env.CANONICAL_IDENTITY_NATIVE_AUTHORITY)fail(503,'The customer shared identity registry requires a separately reviewed adapter; native authenticated users remain available.');
  return null;
}
export function createCanonicalIdentity(){fail(503,'No customer shared identity registry adapter is configured.');}
export function createCanonicalCurrentVerifier({verifyCurrentIdentity,store,identity,issuer,now=Date.now}) {
  return async principal=>{
    canonicalDeadline(principal?.expiresAt,now);
    const profile=await verifyCurrentIdentity(principal);
    if(profile?.active!==true||profile.subject!==principal.subject)return profile;
    if(principal.issuer!==issuer)fail(403,'The original native identity issuer is required.');
    const identityId='identity_'+hash(externalIdentityKey(principal)).slice(0,48);
    const link=await store.get('IDENTITY#'+identityId,'LINK');
    if(!link||!opaque(link.value?.user_id))fail(403,'The native identity must be enrolled before canonical admission.');
    const nativeUserId=link.value.user_id,user=await store.get('USER#'+nativeUserId,'PROFILE');
    const native=resolveIdentityUser({verifiedIdentity:{issuer,subject:principal.subject},identityLinks:[link.value],users:user?[user.value.identity]:[]});
    if(!native.allowed||native.user_id!==nativeUserId||user?.value.status!=='active'||user.value.user_id!==nativeUserId||user.value.cognito_sub!==principal.subject)fail(403,'Current native User or link access is inactive.');
    const canonical=await identity.resolve({issuer,subject:principal.subject},nativeUserId);
    canonicalDeadline(principal.expiresAt,now);
    return {...profile,canonicalUser:canonical.reference,canonicalChecks:canonical.checks};
  };
}
