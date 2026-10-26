// Installed acceptance; synthetic bytes only, no model or external services.
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, readdir,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {once} from 'node:events';
import {createHash} from 'node:crypto';

export function assertCommunityPublication(manifest,{packageJson,packageLock,licenseBytes}={}) {
  assert.equal(typeof manifest.publicationApproved,'boolean');
  assert.equal(packageLock.packages[''].license,packageJson.license);assert.equal(packageLock.name,packageJson.name);
  if(!manifest.publicationApproved){assert.equal(packageJson.license,'UNLICENSED');return;}
  assert.equal(manifest.status,'approved-community-source-preview');assert.match(manifest.sourceCommit,/^[a-f0-9]{40}$/);assert.equal(manifest.license,'Apache-2.0');
  assert.equal(manifest.licenseAuthorization?.repository,'categori-se/es-risk-management-core');assert.equal(manifest.licenseAuthorization?.license,'Apache-2.0');assert.equal(manifest.licenseAuthorization?.selectedOn,'2026-10-26');
  assert.equal(packageJson.name,'es-risk-management-core');assert.equal(packageJson.license,'Apache-2.0');assert.equal(packageLock.packages[''].name,packageJson.name);
  assert.equal(createHash('sha256').update(licenseBytes).digest('hex'),'c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4','The complete adopted Apache-2.0 text is required.');
  assert.ok(manifest.files.some(row=>row.path==='LICENSE'));assert.ok(!manifest.files.some(row=>row.path==='LICENSE.proposed'));
}

export async function assertCommunitySourceInventory(installation,manifest) {
  const listed=new Set(manifest.files.map(file=>file.path));
  async function inspectDirectory(path=''){
    for(const name of await readdir(join(installation,path))){const next=path?`${path}/${name}`:name,stat=await lstat(join(installation,next));
      assert.ok(!stat.isSymbolicLink(),`Unexpected source link: ${next}`);
      if(next==='.git'){assert.ok(stat.isDirectory(),'Git metadata must be an exact real directory.');continue;}
      if(next==='node_modules'){assert.ok(stat.isDirectory());continue;}
      if(stat.isDirectory()){assert.ok([...listed].some(value=>value.startsWith(next+'/')),`Unlisted source directory: ${next}`);await inspectDirectory(next);}
      else {assert.ok(stat.isFile(),`Unexpected source entry: ${next}`);assert.ok(next==='community-source-manifest.json'||listed.has(next),`Unlisted source file: ${next}. Verify a fresh candidate; keep private data, caches and generated build evidence outside its source tree.`);}
    }
  }
  await inspectDirectory();
  for(const file of manifest.files){assert.ok(!file.path.startsWith('/')&&!file.path.split('/').includes('..'));const bytes=await readFile(join(installation,file.path));assert.equal(bytes.length,file.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256,`Changed installed source: ${file.path}`);}
}

export async function checkCommunityHttp(origin) {
  const destination=new URL(origin);assert.equal(destination.protocol,'http:');assert.equal(destination.hostname,'127.0.0.1');
  async function request(path, body, {account='local-default',method=body===undefined?'GET':'POST'}={}) {
    assert.ok(path.startsWith('/')&&!path.startsWith('//'));
    const response=await fetch(new URL(path,destination),{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json','x-esia-workspace':'local','x-esia-account':account},...(body===undefined?{}:{body:JSON.stringify(body)})});
    assert.ok(response.ok,`${method} ${path}: ${await response.clone().text()}`);
    return response.headers.get('content-type')?.includes('json')?response.json():response.text();
  }
  assert.match(await request('/'),/E&amp;S Review/);
  for(const path of ['/engagements','/lifecycle','/local-workspace.js','/project-lifecycle-workspace.js','/schemas/engagement-exchange.schema.json'])assert.ok(await request(path));
  const demo=await request('/api/demonstrations/consultancy',{confirmedSynthetic:true});assert.equal(demo.synthetic,true);assert.equal(demo.clients.length,2);assert.equal(demo.automaticApproval,false);assert.equal(demo.automaticAi,false);
  const [clientA,clientB]=demo.clients;assert.equal(clientA.sourceCount,4);assert.equal(clientB.sourceCount,1);
  const business=await request('/api/project-lifecycle',undefined,{account:clientA.accountId});assert.equal(business.entities.investments.length,1);assert.equal(business.entities.components.length,2);
  const demoForeign=await fetch(new URL(`/api/projects/${clientA.projectId}`,destination),{headers:{'x-esia-workspace':'local','x-esia-account':clientB.accountId},signal:AbortSignal.timeout(10000)});assert.ok([403,404].includes(demoForeign.status));
  const other=await request('/api/storage-accounts',{name:'Synthetic isolated client B',organization:'Example client B',dataOwner:'Synthetic client B'});
  let project=await request('/api/projects',{name:'Synthetic community acceptance',client:'Example client A',phase:'Due diligence',period:'2026'});
  const base=`/api/projects/${project.id}`;
  const command=async value=>project=await request(`${base}/commands`,{expectedRevision:project.revision,command:value});
  await command({type:'intake',mode:'managed',title:'Synthetic ESIA protocol',filename:'esia.txt',mediaType:'text/plain',contentBase64:Buffer.from('Synthetic ESIA protocol: retain dated consultations and verify the response timetable.').toString('base64')});
  const version=project.resources[0].versions[0];
  await command({type:'evidence',versionId:version.id,locator:'Line 1',note:'Synthetic exact retained source inspected.'});
  await command({type:'assessment',framework:{authority:'Synthetic client',name:'Review protocol',edition:'2026 synthetic',clause:'1'},applicability:{decision:'applies',rationale:'Synthetic mandate',scope:'Due diligence',period:'2026'},conclusion:'gap',reviewer:'Synthetic practitioner',rationale:'The synthetic timetable lacks dates.',evidenceIds:[project.evidence[0].id]});
  await command({type:'action',assessmentId:project.assessments[0].id,description:'Provide a dated timetable',owner:'Synthetic client liaison',dueDate:'2026-12-01',status:'open',closureEvidence:'A dated timetable reviewed against the recorded criterion',reviewer:'Synthetic practitioner'});
  await command({type:'issue',title:'Synthetic client report',reviewer:'Synthetic practitioner',presentation:{paperSize:'A4'}});
  const engagement=await request('/api/engagements',{projectId:project.id,actorId:'Synthetic preparer',name:'Synthetic client E&S due diligence',client:'Example client A',type:'due_diligence',scope:['Exact-source gap review'],exclusions:'Synthetic acceptance only',agreementVersionIds:[version.id],roles:{preparer:['Synthetic preparer'],reviewer:['Synthetic reviewer'],approver:['Synthetic approver'],client:[]},frameworkIds:['ifc_ps_2012'],clientAcceptanceRequired:false,dataRules:'Private synthetic workspace; no external transmission.'});
  assert.equal((await request(`/api/engagements/${engagement.id}/assistant`)).available,false);
  const index=await request(`/api/engagements/${engagement.id}/index`,{});assert.equal(index.aiUsed,false);assert.equal(index.documents[0].sha256,version.sha256);assert.ok(index.passages.length);
  const blocked=await fetch(new URL(base,destination),{headers:{'x-esia-workspace':'local','x-esia-account':other.id},signal:AbortSignal.timeout(10000)});assert.ok([403,404].includes(blocked.status));
  const exportDenied=await fetch(new URL(`${base}/export`,destination),{headers:{'x-esia-workspace':'local','x-esia-account':other.id},signal:AbortSignal.timeout(10000)});assert.ok([403,404].includes(exportDenied.status));
  const pack=await request(`${base}/export`);assert.equal(pack.project.id,project.id);assert.ok(pack.engagements.length);
  const report=await request(`${base}/reports/${project.reports[0].id}?format=json`);assert.equal(report.summary.actions.open,1);
  return {project,pack,report,engagement,exactSourceSha256:version.sha256,accountIsolation:true};
}

export async function checkCommunitySource(installation=resolve('.')) {
  installation=resolve(installation);const start=performance.now(),manifest=JSON.parse(await readFile(join(installation,'community-source-manifest.json')));
  assert.equal(manifest.format,'esia-community-source-candidate');
  assertCommunityPublication(manifest,{packageJson:JSON.parse(await readFile(join(installation,'package.json'))),packageLock:JSON.parse(await readFile(join(installation,'package-lock.json'))),...(manifest.publicationApproved?{licenseBytes:await readFile(join(installation,'LICENSE'))}:{})});
  assert.equal(createHash('sha256').update(JSON.stringify(manifest.files,null,2)+'\n').digest('hex'),manifest.sourceTreeSha256);
  await assertCommunitySourceInventory(installation,manifest);
  const {createLocalWorkspaceServer}=await import(pathToFileURL(join(installation,'server/local-workspace.mjs')));
  const {createEngagementAssistant}=await import(pathToFileURL(join(installation,'server/engagement-assistance.mjs')));
  const directory=await mkdtemp(join(tmpdir(),'esia-community-acceptance-')),servers=[];let externalCalls=0;
  const startServer=async path=>{const server=createLocalWorkspaceServer({directory:path,engagementAssistant:createEngagementAssistant({fetchImpl(){externalCalls++;throw Error('No external transport in community acceptance.');}}),capture:async()=>{externalCalls++;throw Error('No external source intake in community acceptance.');},inspect:async()=>{externalCalls++;throw Error('No external source inspection in community acceptance.');}});servers.push(server);server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;};
  try{
    const result=await checkCommunityHttp(await startServer(join(directory,'first')));
    const restoredOrigin=await startServer(join(directory,'restored'));
    const response=await fetch(`${restoredOrigin}/api/storage-accounts/restore`,{method:'POST',headers:{'content-type':'application/json','x-esia-workspace':'local'},body:JSON.stringify({package:result.pack}),signal:AbortSignal.timeout(10000)});assert.ok(response.ok,await response.clone().text());const restored=await response.json();
    const read=await fetch(`${restoredOrigin}/api/projects/${result.project.id}/reports/${result.project.reports[0].id}?format=json`,{headers:{'x-esia-workspace':'local','x-esia-account':restored.account.id},signal:AbortSignal.timeout(10000)});assert.ok(read.ok);const report=await read.json();assert.equal(report.summary.actions.open,1);assert.equal(externalCalls,0);
    return {result:'passed',format:'esia-community-installed-acceptance',schemaVersion:1,sourceTreeSha256:manifest.sourceTreeSha256,elapsedMilliseconds:Math.round(performance.now()-start),exactSourceSha256:result.exactSourceSha256,accountIsolation:true,freshInstallationRestore:true,externalProductServices:0,aiRequests:0,publicationApproved:manifest.publicationApproved};
  }finally{for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await checkCommunitySource(process.argv[2]),null,2));
