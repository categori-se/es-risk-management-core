// Exercise the actual candidate's editable authorization core with synthetic
// provider/object adapters. No real JWT, IAM or cloud deployment is accepted here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const sha=value=>createHash('sha256').update(value).digest('hex');

export async function checkCommunityAuthenticated({directory,receiptPath}={}) {
  directory=resolve(directory||'.');
  const manifestBytes=await readFile(join(directory,'community-source-manifest.json')),manifest=JSON.parse(manifestBytes);
  const sourceFiles=['deploy/community/authenticated/lambda.mjs','server/access-service.mjs','server/access-store.mjs','server/gateway-handler.mjs','server/storage-migrations.mjs'];
  for(const path of sourceFiles){const expected=manifest.files.find(row=>row.path===path);assert.ok(expected,`Candidate manifest is missing ${path}.`);assert.equal(sha(await readFile(join(directory,path))),expected.sha256,`Candidate source changed after export: ${path}.`);}
  const candidateRequire=createRequire(join(directory,'package.json'));
  for(const name of ['@aws-sdk/client-dynamodb','esbuild','jsdom','exceljs'])assert.ok(candidateRequire.resolve(name).startsWith(join(directory,'node_modules')+sep),`Install ${name} inside the candidate; parent checkout dependencies do not prove an independent installation.`);
  const load=path=>import(pathToFileURL(join(directory,path)).href);
  const [{createAccessService},{createMemoryAccessStore},{createGatewayHandler},{customerConfiguration,createCustomerHandler}]=await Promise.all([load('server/access-service.mjs'),load('server/access-store.mjs'),load('server/gateway-handler.mjs'),load('deploy/community/authenticated/lambda.mjs')]);
  const issuer='https://cognito-idp.us-east-1.amazonaws.com/us-east-1_CommunityExample',clientId='syntheticcommunityclient',origin='https://community.example.invalid';
  const now=new Date(),subjects=['synthetic-owner','synthetic-other-client','synthetic-document-reviewer'],blocked=new Set(),providerChecks=[],objectReads=[];
  const account=subject=>`acct_${sha('user_'+sha(JSON.stringify([issuer,subject])).slice(0,40)).slice(0,32)}`;
  const accountStorage=Object.fromEntries(subjects.map((subject,index)=>[account(subject),{bucket:`synthetic-community-client-${index}`} ]));
  const principal=subject=>({issuer,subject,clientId,tokenUse:'access',expiresAt:now.getTime()+3600_000});
  const bytes=Buffer.from('SYNTHETIC CLIENT A ONLY. Exact retained evidence.');let original;
  const store=createMemoryAccessStore(),service=createAccessService({store,expectedIssuer:issuer,expectedClientId:clientId,resourceAuthority:origin,accountStorage,now:()=>new Date(now),
    verifyCurrentIdentity:async actor=>{providerChecks.push(actor.subject);return {subject:actor.subject,active:!blocked.has(actor.subject),email:'same-display-address@example.invalid',name:'Synthetic practitioner'};},
    verifyOriginal:async target=>{assert.equal(target.sha256,sha(bytes));assert.equal(target.sizeBytes,bytes.length);original={...target,versionId:'synthetic-original-v1'};return original;},
    readObjectRange:async target=>{assert.equal(target.bucket,original.bucket);assert.equal(target.key,original.key);assert.equal(target.versionId,original.versionId);objectReads.push({...target});return bytes.subarray(target.offset,target.offset+target.length);}});
  const handler=createGatewayHandler({service,expectedIssuer:issuer,expectedClientId:clientId,allowedOrigins:[origin],now:()=>now.getTime()});
  const request=async(actor,method,path,body,changes={})=>handler({rawPath:path,headers:{origin},requestContext:{http:{method,sourceIp:'192.0.2.1',userAgent:'synthetic-community-check'},requestId:'synthetic-request',...(actor?{authorizer:{jwt:{claims:{iss:actor.issuer,sub:actor.subject,client_id:actor.clientId,token_use:actor.tokenUse,exp:String(actor.expiresAt/1000)}}}}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),...changes});
  const owner=principal(subjects[0]),other=principal(subjects[1]),guest=principal(subjects[2]);
  const customerEnv={AWS_REGION:'us-east-1',ESIA_COGNITO_POOL:'us-east-1_CommunityExample',ESIA_COGNITO_CLIENT:clientId,ESIA_COGNITO_ISSUER:issuer,ESIA_DEPLOYMENT_ACCOUNT_ID:'000000000000',ESIA_ACCESS_TABLE:'synthetic-community-access',ESIA_RESOURCE_AUTHORITY:origin,ESIA_ALLOWED_ORIGINS_JSON:JSON.stringify([origin]),ESIA_ACCOUNT_STORAGE_JSON:JSON.stringify(accountStorage),ESIA_API_ID:'syntheticapi',ESIA_API_STAGE:'$default',ESIA_DEPLOYMENT_GENERATION:'00000000-0000-4000-8000-000000000001'};
  assert.equal(customerConfiguration(customerEnv).resourceAuthority,origin);assert.throws(()=>customerConfiguration({...customerEnv,ESIA_RESOURCE_AUTHORITY:undefined}));assert.throws(()=>customerConfiguration({...customerEnv,ESIA_ALLOWED_ORIGINS_JSON:'["*"]'}));assert.throws(()=>customerConfiguration({...customerEnv,CANONICAL_IDENTITY_TABLE:'unreviewed-registry'}));
  const customer=createCustomerHandler(customerEnv,()=>({store:createMemoryAccessStore(),verifyCurrentIdentity:async actor=>({subject:actor.subject,active:true,email:'synthetic@example.invalid'})}));
  assert.equal((await customer({rawPath:'/api/publication-catalog',requestContext:{http:{method:'GET'}},headers:{origin}})).statusCode,401,'The actual customer wrapper must not inherit anonymous publication routes.');
  const customerSession=await customer({rawPath:'/api/session-context',headers:{origin},requestContext:{http:{method:'GET'},authorizer:{jwt:{claims:{iss:issuer,sub:owner.subject,client_id:clientId,token_use:'access',exp:String(owner.expiresAt/1000)}}}}});assert.equal(customerSession.statusCode,200,customerSession.body);
  const deniedBefore=providerChecks.length;
  for(const bad of [null,{...owner,issuer:'https://untrusted.example.invalid'},{...owner,clientId:'wrong-client'},{...owner,tokenUse:'id'},{...owner,expiresAt:now.getTime()-1}])assert.equal((await request(bad,'GET','/api/session-context')).statusCode,401);
  assert.equal((await request(null,'GET','/api/session-context',undefined,{body:JSON.stringify({claims:{sub:owner.subject}})})).statusCode,401);assert.equal(providerChecks.length,deniedBefore);
  const created=await request(owner,'POST','/api/projects',{name:'Same physical project; separate client A review'});assert.equal(created.statusCode,200,created.body);const project=JSON.parse(created.body).project;
  const alternate=await request(other,'POST','/api/projects',{name:'Same physical project; separate client A review'});assert.equal(alternate.statusCode,200,alternate.body);assert.notEqual(JSON.parse(alternate.body).project.account_id,project.account_id);
  const ownerContext=await service.session(owner),otherContext=await service.session(other);assert.equal(ownerContext.user.email,otherContext.user.email);assert.notEqual(ownerContext.user.user_id,otherContext.user.user_id);
  assert.equal((await request(other,'GET',`/api/projects/${project.project_id}`)).statusCode,403);
  const registration=await service.createArtifact(owner,{project_id:project.project_id,configuration_revision:1,filename:'synthetic-evidence.txt',content_type:'text/plain',registration_id:'upload_synthetic_original',size_bytes:bytes.length,sha256:sha(bytes)});
  const ready=(await service.finalizeArtifact(owner,registration.artifact.artifact_id,{registration_id:registration.artifact.upload.registration_id,expected_revision:1})).artifact;
  assert.equal(ready.original.reference.authority,origin,'Customer source references must retain the explicitly configured application authority.');
  const selector={kind:'document',artifact_id:ready.artifact_id,configuration_revision:ready.revision,version_id:ready.original.reference.version_id,sha256:sha(bytes),size_bytes:bytes.length,offset:0,length:bytes.length};
  const beforeForeign=objectReads.length;await assert.rejects(service.downloadChunk(other,selector),{statusCode:403});assert.equal(objectReads.length,beforeForeign);
  const invitation=await service.invitation(owner,{resource_type:'document',resource_id:ready.artifact_id,recipient:{issuer,subject:guest.subject},permissions:['view'],configuration_revision:ready.revision,expires_at:new Date(now.getTime()+600_000).toISOString()});
  await service.acceptInvitation(guest,invitation.invitation.invitation_id,{token:invitation.token,expected_revision:invitation.invitation.revision});
  const exact=await service.downloadChunk(guest,selector);assert.deepEqual(Buffer.from(exact.bytes_base64,'base64'),bytes);assert.equal(exact.sha256,sha(bytes));
  assert.deepEqual((await service.listProjects(guest)).projects,[]);await assert.rejects(service.getProject(guest,project.project_id),{statusCode:403});await assert.rejects(service.createArtifact(guest,{project_id:project.project_id,configuration_revision:1,filename:'not-authorized.txt',content_type:'text/plain'}),{statusCode:403});
  await service.revokeInvitation(owner,invitation.invitation.invitation_id,{expected_revision:2});const beforeRevoked=objectReads.length;await assert.rejects(service.downloadChunk(guest,selector),{statusCode:403});assert.equal(objectReads.length,beforeRevoked);
  blocked.add(owner.subject);assert.equal((await request(owner,'GET',`/api/projects/${project.project_id}`)).statusCode,403);blocked.delete(owner.subject);
  assert.equal((await request(owner,'GET','/api/session-context',undefined,{headers:{origin:'https://untrusted.example.invalid'}})).statusCode,403);
  assert.ok((await store.list(`AUDIT#${project.workspace_id}`)).length>0,'Gateway project mutations retain actual core audit records.');
  const proof={format:'esia-community-authenticated-core-check',schemaVersion:1,passed:true,recordedAt:new Date().toISOString(),candidate:{sourceTreeSha256:manifest.sourceTreeSha256,manifestSha256:sha(manifestBytes),publicationApproved:manifest.publicationApproved},checks:['Customer entry requires explicit identity, authority and origins; unreviewed canonical registry fails closed','Actual customer wrapper denies anonymous publication and accepts a configured synthetic authorizer context','Gateway denies anonymous, browser-supplied, wrong issuer/client/token-use/expired identities before current-provider checks','Native Users remain distinct despite matching display email and project name','Foreign client cannot read project or original; no object read dispatched','Explicit document view grant permits exact bytes without project access or writes','Revocation prevents new original reads before provider dispatch','Current identity suspension and unapproved origins denied','Customer-qualified original authority and mutation audit preserved'],providerCalls:'Synthetic current-identity and immutable-object adapters only',actualProviderRequests:0,actualJwtOrIamAcceptance:false,independentSecurityAcceptance:false,
    sourceFiles:await Promise.all(sourceFiles.map(async path=>({path,sha256:sha(await readFile(join(directory,path)))})))};
  if(receiptPath){await mkdir(dirname(resolve(receiptPath)),{recursive:true,mode:0o700});await writeFile(resolve(receiptPath),JSON.stringify(proof,null,2)+'\n',{mode:0o600});}return proof;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const args=process.argv.slice(2);if(args.length<1||args.length>2)throw Error('Usage: node tools/check-community-authenticated.mjs CANDIDATE_DIRECTORY [RECEIPT.json]');const proof=await checkCommunityAuthenticated({directory:args[0],receiptPath:args[1]});console.log(JSON.stringify({passed:proof.passed,checks:proof.checks.length,actualProviderRequests:0,actualJwtOrIamAcceptance:false}));}
