import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mountProjectLifecycleWorkspace} from '../src/components/project-lifecycle-workspace.js';
import {createLocalWorkspaceServer} from '../server/local-workspace.mjs';
import {mandate} from './fixtures/engagement-journey.mjs';
import {getAuditChecks} from '../src/lib/framework-register.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
async function wait(predicate){for(let n=0;n<250;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,4));}assert.fail('Expected lifecycle UI state did not arrive.');}
async function fixture(t){
  const directory=mkdtempSync(join(tmpdir(),'esia-lifecycle-ui-')),server=createLocalWorkspaceServer({directory});server.address=()=>({port:4173});
  const dom=new JSDOM('<main></main>',{url:'http://127.0.0.1:4173/lifecycle?account=local-default'}),root=dom.window.document.querySelector('main');
  const calls=[],downloads=[];let mounted,gate=null;
  async function raw(path,{method='GET',body,accountId='local-default'}={}){
    const request=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(request,{url:path,method,headers:{host:'127.0.0.1:4173','x-esia-workspace':'local','x-esia-account':accountId,'content-type':'application/json'}});
    return new Promise((resolve,reject)=>{const response=new EventEmitter();response.writeHead=(status,headers)=>{response.status=status;response.headers=headers;};response.end=content=>{const value=JSON.parse(String(content));resolve({ok:response.status<400,status:response.status,json:async()=>structuredClone(value)});};Promise.resolve(server.listeners('request')[0](request,response)).catch(reject);});
  }
  async function request(path,options={}){const response=await raw(path,options),value=await response.json();assert.equal(response.ok,true,JSON.stringify(value));return value;}
  async function fetchImpl(path,options={}){
    const accountId=options.headers['X-ESIA-Account'],method=options.method||'GET',body=options.body===undefined?undefined:JSON.parse(options.body);calls.push({path,method,accountId,body,options});
    const held=gate&&gate.path===path&&gate.method===method?gate:null;if(held)gate=null;
    const response=await raw(path,{method,body,accountId});if(held){held.started=true;await held.promise;}
    return response;
  }
  dom.window.URL.createObjectURL=()=>{downloads.push('created');return 'blob:local-fixture';};dom.window.URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
  const identity=await request('/api/project-identities',{method:'POST',body:{name:'Physical project A'}}),identityB=await request('/api/project-identities',{method:'POST',body:{name:'Physical project B'}});
  const project=await request('/api/projects',{method:'POST',body:{name:'Account A project',client:'Client A',phase:'Review',period:'2026',realWorldProjectId:identity.id}});
  const unlinked=await request('/api/projects',{method:'POST',body:{name:'Unlinked project',client:'Client A',phase:'Review',period:'2026'}});
  const accountB=await request('/api/storage-accounts',{method:'POST',body:{name:'Account B',organization:'Organization B',dataOwner:'Owner B'}});
  const projectB=await request('/api/projects',{method:'POST',accountId:accountB.id,body:{name:'Account B project',client:'Client B',phase:'Operations',period:'2026',realWorldProjectId:identityB.id}});
  const mount=()=>mounted=mountProjectLifecycleWorkspace(root,{fetchImpl});
  t.after(()=>{mounted?.dispose();server.emit('close');dom.window.close();rmSync(directory,{recursive:true,force:true});});
  const change=(selector,value)=>{const node=typeof selector==='string'?root.querySelector(selector):selector;assert.ok(node,`Missing ${selector}`);node.value=value;node.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  const input=(form,name,value)=>{const control=form.elements.namedItem(name);assert.ok(control,`Missing ${name}`);control.value=value;control.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
  const submit=form=>{assert.ok(form);form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));};
  const area=name=>{const node=root.querySelector(`[data-lifecycle-area="${name}"]`);assert.ok(node);node.click();};
  const hold=(path,method='GET')=>{const held={path,method,...deferred(),started:false};gate=held;return held;};
  return {root,dom,calls,downloads,request,raw,project,unlinked,identity,accountB,projectB,mount,change,input,submit,area,hold,get mounted(){return mounted;}};
}

async function selectProject(f){const box=f.root.querySelector(`[name="projectIds"][value="${f.project.id}"]`);box.checked=true;f.submit(f.root.querySelector('[data-lifecycle-projects-form]'));await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent==='Existing project selection saved.');}

test('progressive local forms preserve existing project identity, exact money and explicit verification',async t=>{
  const f=await fixture(t);await f.mount().ready;
  assert.equal(f.root.querySelectorAll('.pl-nav [data-lifecycle-area]').length,9);
  assert.equal(f.root.querySelector(`[name="projectIds"][value="${f.unlinked.id}"]`).disabled,true);
  await selectProject(f);
  const selection=f.calls.findLast(call=>call.method==='POST');assert.deepEqual(selection.body.command,{type:'projects-set',projects:[{projectId:f.project.id,identityId:f.identity.id}]});
  f.area('financing');let form=f.root.querySelector('[data-lifecycle-record-form]');const text='<img src=x onerror="window.executed=true"> lender';
  f.input(form,'name',text);f.change(form.elements.kind,'bank');f.submit(form);
  await wait(()=>f.root.textContent.includes(text));assert.equal(f.root.querySelector('img,script,iframe'),null);assert.equal(f.dom.window.executed,undefined);
  let ledger=await f.request('/api/project-lifecycle');const organization=ledger.entities.organizations[0];assert.equal(organization.provenance.reviewStatus,'unreviewed');
  f.change('[data-lifecycle-collection]','investments');form=f.root.querySelector('[data-lifecycle-record-form]');f.input(form,'name','Precise investment');f.change(form.elements.investorOrganizationId,organization.id);f.input(form,'amount.amount','10000000000000000.000001');f.input(form,'amount.currency','USD');f.submit(form);
  await wait(()=>f.root.textContent.includes('Precise investment'));ledger=await f.request('/api/project-lifecycle');assert.equal(ledger.entities.investments[0].amount.amount,'10000000000000000.000001');
  assert.ok(f.calls.every(call=>call.options.credentials==='omit'&&call.options.redirect==='error'&&call.options.headers['X-ESIA-Workspace']==='local'));
  assert.ok(f.calls.every(call=>call.path.startsWith('/api/')));
  f.area('reports');assert.equal(f.calls.some(call=>call.body?.command?.type==='verify'),false);
  const verify=f.root.querySelector('[data-lifecycle-verify-form]');f.change(verify.elements.target,`organizations~${organization.id}`);f.input(verify,'statement','Checked the exact organization and source context.');f.submit(verify);
  await wait(()=>f.calls.some(call=>call.body?.command?.type==='verify'));await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent.includes('verified by'));
  ledger=await f.request('/api/project-lifecycle');assert.equal(ledger.entities.organizations[0].provenance.reviewStatus,'verified');assert.equal(ledger.entities.investments[0].provenance.reviewStatus,'unreviewed');
  const project=await f.request(`/api/projects/${f.project.id}`);assert.equal(project.revision,f.project.revision,'Lifecycle saves must not edit project or document authority.');
});

test('progressive facility and agreement saves update both relationship views in one unreviewed batch',async t=>{
  const f=await fixture(t);await f.mount().ready;await selectProject(f);f.area('financing');
  let form=f.root.querySelector('[data-lifecycle-record-form]');f.input(form,'name','Borrower organization');f.submit(form);await wait(()=>f.root.textContent.includes('Borrower organization'));
  let ledger=await f.request('/api/project-lifecycle');const organization=ledger.entities.organizations[0];
  f.change('[data-lifecycle-collection]','financialFacilities');form=f.root.querySelector('[data-lifecycle-record-form]');f.input(form,'name','Senior facility');f.change(form.elements.borrowerOrganizationId,organization.id);f.input(form,'commitment.amount','500000.25');f.input(form,'commitment.currency','USD');f.input(form,'effectiveFrom','2026-10-01');f.input(form,'externalNamespace','urn:example:facility');f.input(form,'externalValue','SF-01');f.submit(form);
  await wait(()=>f.root.textContent.includes('Senior facility'));ledger=await f.request('/api/project-lifecycle');const facility=ledger.entities.financialFacilities[0];assert.deepEqual(facility.agreementIds,[]);
  for(const [collection,id] of [['organizations',organization.id],['financialFacilities',facility.id]])ledger=await f.request('/api/project-lifecycle/commands',{method:'POST',body:{expectedRevision:ledger.revision,actorId:'reviewer',command:{type:'verify',collection,id,statement:'Checked recorded identity, dates and financing basis.'}}});
  ledger=await f.request('/api/project-lifecycle/commands',{method:'POST',body:{expectedRevision:ledger.revision,actorId:'approver',command:{type:'approve',statement:'Approved the verified financing context before agreement association.'}}});const priorApproval=structuredClone(ledger.approvedSnapshots[0]);
  f.root.querySelector('[data-lifecycle-action="refresh"]').click();await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent.includes('ready'));f.change('[data-lifecycle-collection]','agreements');
  form=f.root.querySelector('[data-lifecycle-record-form]');f.input(form,'name','Financing agreement');f.change(form.elements.organizationIds,organization.id);f.change(form.elements.financialFacilityIds,facility.id);f.change(form.elements.status,'effective');f.submit(form);
  await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent.includes('matching facility'));
  let save=f.calls.findLast(call=>call.method==='POST').body.command;assert.equal(save.type,'batch');assert.deepEqual(save.commands.map(command=>command.collection),['agreements','financialFacilities']);
  ledger=await f.request('/api/project-lifecycle');let agreement=ledger.entities.agreements[0],changedFacility=ledger.entities.financialFacilities[0];assert.deepEqual(agreement.financialFacilityIds,[facility.id]);assert.deepEqual(changedFacility.agreementIds,[agreement.id]);assert.equal(changedFacility.provenance.reviewStatus,'unreviewed');assert.equal(agreement.provenance.reviewStatus,'unreviewed');assert.deepEqual(changedFacility.commitment,facility.commitment);assert.equal(changedFacility.effectiveFrom,facility.effectiveFrom);assert.deepEqual(changedFacility.externalReferences,facility.externalReferences);assert.deepEqual(changedFacility.provenance.sourceVersions,facility.provenance.sourceVersions);assert.deepEqual(ledger.approvedSnapshots[0],priorApproval);
  const rejected=await f.raw('/api/project-lifecycle/commands',{method:'POST',body:{expectedRevision:ledger.revision,actorId:'approver',command:{type:'approve',statement:'Cannot approve changed relationships before fresh verification.'}}});assert.equal(rejected.status,409);
  // Removing and adding the link from the facility form must explicitly update
  // the agreement too, while retaining its parties, status and project scope.
  f.change('[data-lifecycle-collection]','financialFacilities');f.root.querySelector(`[data-lifecycle-edit="${facility.id}"]`).click();form=f.root.querySelector('[data-lifecycle-record-form]');for(const option of form.elements.agreementIds.options)option.selected=false;f.submit(form);
  await wait(()=>f.calls.filter(call=>call.body?.command?.type==='batch').length===3);await wait(()=>f.root.querySelector('[data-lifecycle-record-form]')?.elements.namedItem('id').value==='');
  ledger=await f.request('/api/project-lifecycle');assert.deepEqual(ledger.entities.financialFacilities[0].agreementIds,[]);assert.deepEqual(ledger.entities.agreements[0].financialFacilityIds,[]);assert.deepEqual(ledger.entities.agreements[0].organizationIds,agreement.organizationIds);assert.equal(ledger.entities.agreements[0].status,'effective');
  f.root.querySelector(`[data-lifecycle-edit="${facility.id}"]`).click();form=f.root.querySelector('[data-lifecycle-record-form]');f.change(form.elements.agreementIds,agreement.id);f.submit(form);await wait(()=>f.calls.filter(call=>call.body?.command?.type==='batch').length===4);await wait(()=>f.root.querySelector('[data-lifecycle-record-form]')?.elements.namedItem('id').value==='');
  ledger=await f.request('/api/project-lifecycle');assert.deepEqual(ledger.entities.financialFacilities[0].agreementIds,[agreement.id]);assert.deepEqual(ledger.entities.agreements[0].financialFacilityIds,[facility.id]);assert.deepEqual(ledger.approvedSnapshots[0],priorApproval);
});

test('account changes suppress late loads, writes, errors and export downloads',async t=>{
  const f=await fixture(t);await f.mount().ready;await selectProject(f);
  let held=f.hold('/api/project-lifecycle');f.root.querySelector('[data-lifecycle-action="refresh"]').click();await wait(()=>held.started);
  f.change('[data-lifecycle-account]',f.accountB.id);await wait(()=>f.root.textContent.includes('Account B project')&&f.root.querySelector('[data-lifecycle-status]').textContent.includes('ready'));
  held.resolve();await new Promise(resolve=>setTimeout(resolve,25));assert.equal(f.root.textContent.includes('Account A project'),false);
  f.change('[data-lifecycle-account]','local-default');await wait(()=>f.root.textContent.includes('Account A project')&&f.root.querySelector('[data-lifecycle-status]').textContent.includes('ready'));f.area('financing');
  const form=f.root.querySelector('[data-lifecycle-record-form]');f.input(form,'name','Late organization from A');held=f.hold('/api/project-lifecycle/commands','POST');f.submit(form);await wait(()=>held.started);
  f.change('[data-lifecycle-account]',f.accountB.id);await wait(()=>f.root.textContent.includes('Account B project')&&f.root.querySelector('[data-lifecycle-status]').textContent.includes('ready'));held.reject(new Error('Old account response failed'));
  await new Promise(resolve=>setTimeout(resolve,25));assert.equal(f.root.textContent.includes('Late organization from A'),false);assert.equal(f.root.textContent.includes('Old account response failed'),false);
  f.area('reports');held=f.hold('/api/project-lifecycle/exchange');f.root.querySelector('[data-lifecycle-action="export"]').click();await wait(()=>held.started);
  f.change('[data-lifecycle-account]','local-default');await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent.includes('ready'));held.resolve();await new Promise(resolve=>setTimeout(resolve,25));assert.deepEqual(f.downloads,[]);
});

test('exchange inspection requires a separate explicit review and rejects cross-account files',async t=>{
  const f=await fixture(t);await f.mount().ready;await selectProject(f);f.area('reports');const exchange=await f.request('/api/project-lifecycle/exchange');
  let form=f.root.querySelector('[data-lifecycle-import-form]');Object.defineProperty(form.elements.exchange,'files',{value:[{size:500,text:async()=>JSON.stringify(exchange)}]});f.submit(form);
  await wait(()=>f.root.querySelector('[data-lifecycle-import-confirm]'));assert.equal(f.calls.some(call=>call.path==='/api/project-lifecycle/import'),false,'Inspection cannot restore automatically.');
  const confirm=f.root.querySelector('[data-lifecycle-import-confirm]');f.submit(confirm);await wait(()=>f.root.querySelector('[data-lifecycle-status]').getAttribute('role')==='alert');assert.equal(f.calls.some(call=>call.path==='/api/project-lifecycle/import'),false);
  confirm.elements.reviewed.checked=true;f.submit(confirm);await wait(()=>f.calls.some(call=>call.path==='/api/project-lifecycle/import'));await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent.includes('Exchange restored'));
  assert.equal(f.calls.some(call=>call.body?.command?.type==='approve'),false);assert.equal(f.calls.some(call=>call.body?.command?.type==='verify'),false);
  const other=await f.request('/api/project-lifecycle/exchange',{accountId:f.accountB.id});form=f.root.querySelector('[data-lifecycle-import-form]');Object.defineProperty(form.elements.exchange,'files',{value:[{size:500,text:async()=>JSON.stringify(other)}]});f.submit(form);await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent.includes('different account'));assert.equal(f.root.querySelector('[data-lifecycle-import-confirm]'),null);
});

test('requirement scope and source selections reuse exact existing engagement and document records',async t=>{
  const f=await fixture(t);
  const project=await f.request(`/api/projects/${f.project.id}/commands`,{method:'POST',body:{expectedRevision:f.project.revision,command:{type:'intake',mode:'managed',filename:'agreement.txt',mediaType:'text/plain',title:'Original project agreement',contentBase64:Buffer.from('Synthetic signed agreement and E&S monitoring requirement.').toString('base64')}}});
  const source=project.resources[0].versions[0];let engagement=await f.request('/api/engagements',{method:'POST',body:mandate(project.id,source.id)});
  engagement=await f.request(`/api/engagements/${engagement.id}/commands`,{method:'POST',body:{expectedRevision:engagement.revision,actorId:'Alice',command:{type:'requirement-add',frameworkId:'ifc_ps_2012',checkId:getAuditChecks('ifc_ps_2012')[0].id}}});
  await f.mount().ready;await selectProject(f);f.area('requirements');
  const form=f.root.querySelector('[data-lifecycle-record-form]');f.change(form.elements.requirementRef,engagement.requirements[0].id);f.change(form.elements.decision,'applicable');f.input(form,'rationale','The original mandate covers this requirement for the selected project.');
  const selectedSource=form.elements.provenanceSources;selectedSource.options[0].selected=true;selectedSource.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));f.submit(form);
  await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent.includes('Entry saved'));
  const ledger=await f.request('/api/project-lifecycle'),row=ledger.entities.requirementApplicabilities[0];assert.deepEqual(row.requirementRef,{engagementId:engagement.id,id:engagement.requirements[0].id,revision:engagement.requirements[0].revision});assert.equal(row.frameworkEditionId,'ifc_ps_2012');assert.deepEqual(row.provenance.sourceVersions,[{projectId:project.id,resourceId:project.resources[0].id,versionId:source.id,sha256:source.sha256}]);
  f.area('evidence');assert.ok(f.root.textContent.includes(source.sha256));assert.ok(f.root.textContent.includes('Original project agreement'));
  const target=new URL(f.root.querySelector('a[href*="#lw-documents"]').href);assert.equal(target.searchParams.get('project'),project.id);assert.equal(target.searchParams.get('account'),'local-default');
  const unchanged=await f.request(`/api/engagements/${engagement.id}`);assert.equal(unchanged.revision,engagement.revision);assert.equal(f.calls.some(call=>call.method==='POST'&&call.path!== '/api/project-lifecycle/commands'),false,'Lifecycle controls must not write sources or assessments.');
});

test('report views distinguish working records from approved historical snapshots',async t=>{
  const f=await fixture(t);await f.mount().ready;await selectProject(f);let ledger=await f.request('/api/project-lifecycle');
  ledger=await f.request('/api/project-lifecycle/commands',{method:'POST',body:{expectedRevision:ledger.revision,actorId:'local-preparer',command:{type:'batch',commands:[
    {type:'upsert',collection:'organizations',records:[{id:'report-investor',name:'Reporting scope investor',kind:'dfi'}]},
    {type:'upsert',collection:'investments',records:[{id:'report-investment',name:'Selected reporting investment',kind:'direct',investorOrganizationId:'report-investor',amount:{amount:'10',currency:'USD'},status:'active'}]},
    {type:'upsert',collection:'allocations',records:[{id:'report-allocation',investmentId:'report-investment',projectId:f.project.id,amount:{amount:'10',currency:'USD'}}]}
  ]}}});
  for(const [collection,id] of [['organizations','report-investor'],['investments','report-investment'],['allocations','report-allocation']])ledger=await f.request('/api/project-lifecycle/commands',{method:'POST',body:{expectedRevision:ledger.revision,actorId:'local-reviewer',command:{type:'verify',collection,id,statement:'Checked this synthetic investment reporting scope.'}}});
  ledger=await f.request('/api/project-lifecycle/commands',{method:'POST',body:{expectedRevision:ledger.revision,actorId:'local-reviewer',command:{type:'approve',statement:'Approved the selected existing project context.'}}});
  f.root.querySelector('[data-lifecycle-action="refresh"]').click();await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent.includes('ready'));f.area('reports');
  let form=f.root.querySelector('[data-lifecycle-report-form]');f.change(form.elements.view,'ifc');f.change(form.elements.investmentId,'report-investment');f.submit(form);await wait(()=>f.root.querySelector('[data-lifecycle-report]'));assert.match(f.root.querySelector('[data-lifecycle-report]').textContent,/unapproved/);
  assert.equal(f.root.querySelector('[data-lifecycle-report-form]').elements.investmentId.value,'report-investment');
  form=f.root.querySelector('[data-lifecycle-report-form]');f.change(form.elements.snapshotId,ledger.approvedSnapshots[0].id);f.change(form.elements.view,'world_bank');f.submit(form);
  await wait(()=>f.root.querySelector('[data-lifecycle-report]').textContent.includes('Approved snapshot projection'));const query=new URL(f.calls.findLast(call=>call.path.includes('/report?')).path,'http://local.test').searchParams;assert.equal(query.get('snapshotId'),ledger.approvedSnapshots[0].id);assert.equal(query.get('view'),'world_bank');
  f.area('overview');f.area('reports');form=f.root.querySelector('[data-lifecycle-report-form]');assert.equal(form.elements.snapshotId.value,ledger.approvedSnapshots[0].id);assert.equal(form.elements.investmentId.value,'report-investment');assert.equal(form.elements.view.value,'world_bank');
  f.change('[data-lifecycle-account]',f.accountB.id);await wait(()=>f.root.querySelector('[data-lifecycle-status]').textContent.includes('ready'));form=f.root.querySelector('[data-lifecycle-report-form]');assert.equal(form.elements.snapshotId.value,'');assert.equal(form.elements.investmentId.value,'');assert.equal(form.elements.view.value,'canonical');
});

test('hosted mounts make no calls and disposed mounts cannot render late records',async t=>{
  const hosted=new JSDOM('<main></main>',{url:'https://esia.categori.se/lifecycle'});let calls=0;const mounted=mountProjectLifecycleWorkspace(hosted.window.document.querySelector('main'),{fetchImpl:async()=>{calls++;throw new Error('Protected API should be blocked.');}});await mounted.ready;assert.equal(calls,0);assert.match(hosted.window.document.body.textContent,/local/);hosted.window.close();
  const f=await fixture(t);await f.mount().ready;const held=f.hold('/api/project-lifecycle');f.root.querySelector('[data-lifecycle-action="refresh"]').click();await wait(()=>held.started);const before=f.root.innerHTML;f.mounted.dispose();held.resolve();await new Promise(resolve=>setTimeout(resolve,25));assert.equal(f.root.innerHTML,before);
});
