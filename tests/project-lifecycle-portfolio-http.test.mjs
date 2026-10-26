import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createLocalWorkspaceServer} from '../server/local-workspace.mjs';
import {seedMonitoringJourney,monitoringPrivateText} from './fixtures/monitoring-journey.mjs';

function fixture(t) {
  const directory=mkdtempSync(join(tmpdir(),'esia-lifecycle-portfolio-'));let externalCalls=0;
  const server=createLocalWorkspaceServer({directory,capture:async()=>{externalCalls++;throw Error('External capture is blocked in Scenario B.');},inspect:async()=>{externalCalls++;throw Error('External inspection is blocked in Scenario B.');}});server.address=()=>({port:4173});
  t.after(()=>{server.emit('close');rmSync(directory,{recursive:true,force:true});});
  async function request(path,{method='GET',body,account,headers={}}={}) {
    const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);Object.assign(req,{url:path,method,headers:{host:'127.0.0.1:4173','x-esia-workspace':'local','content-type':'application/json',...(account?{'x-esia-account':account}:{}),...headers}});
    return new Promise((resolve,reject)=>{const res=new EventEmitter();res.writeHead=(status,headers)=>Object.assign(res,{status,headers});res.end=bytes=>resolve({status:res.status,headers:res.headers,bytes:Buffer.from(bytes||''),json:()=>JSON.parse(String(bytes))});Promise.resolve(server.listeners('request')[0](req,res)).catch(reject);});
  }
  return {request,get externalCalls(){return externalCalls;}};
}
async function json(api,path,options={},expected=200) {const response=await api.request(path,options);assert.equal(response.status,expected,`${path}: ${response.bytes}`);return response.json();}
async function link(api,project,name) {
  const identity=await json(api,'/api/project-identities',{method:'POST',body:{name}},201);
  await json(api,`/api/projects/${project.id}/context`,{method:'PUT',body:{identityId:identity.id}});
  return {projectId:project.id,identityId:identity.id};
}
async function command(api,command,actorId='Alice') {const ledger=await json(api,'/api/project-lifecycle');return json(api,'/api/project-lifecycle/commands',{method:'POST',body:{expectedRevision:ledger.revision,actorId,command}});}
function retain(value) {if(!process.env.ESIA_LIFECYCLE_EVIDENCE_DIR)return;const directory=resolve(process.env.ESIA_LIFECYCLE_EVIDENCE_DIR);mkdirSync(directory,{recursive:true,mode:0o700});writeFileSync(join(directory,'scenario-b.json'),JSON.stringify(value,null,2)+'\n',{mode:0o600});}
const organization=(id,kind)=>({id,name:`SYNTHETIC ${id}`,kind});

test('Scenario B: real fund and intermediary subprojects retain reviewed sector exposure, actual screening and current monitoring without double counting',async t=>{
  const api=fixture(t);
  // Both monitored projects are built through actual source intake, requirements,
  // human findings and engagement commands. No hand-built assessment arrays enter
  // the reporting adapter. The second project's first monitoring cycle is open.
  const power=await seedMonitoringJourney({request:api.request});
  const farming=await seedMonitoringJourney({request:api.request,stopAfter:'mission'});
  const unknown=await json(api,'/api/projects',{method:'POST',body:{name:'SYNTHETIC unscreened subproject',client:'Synthetic FI',phase:'Screening pending',period:'2026'}},201);
  const bindings=[await link(api,power.project,'SYNTHETIC generation physical project'),await link(api,farming.project,'SYNTHETIC agricultural physical project'),await link(api,unknown,'SYNTHETIC unknown physical project')];
  const originals=await Promise.all(bindings.map(binding=>json(api,`/api/projects/${binding.projectId}`)));
  const assessments=await Promise.all([json(api,power.route),json(api,farming.route)]);
  for(const engagement of assessments){const screening=engagement.findings.filter(finding=>!finding.cycleId);assert.equal(screening.length,2);assert.ok(screening.every(finding=>finding.status==='verified'&&finding.reviewedBy==='Bob'&&finding.riskSignificance==='Moderate'));assert.equal(new Set(screening.map(finding=>engagement.requirements.find(requirement=>requirement.id===finding.requirementId).frameworkId)).size,2);}
  assert.equal(assessments[0].cycles.length,3);assert.equal(assessments[0].measurements.length,3);assert.equal(assessments[1].cycles.length,1);assert.equal(assessments[1].measurements.length,0);
  const source=project=>({projectId:project.id,resourceId:project.resources[0].id,versionId:project.resources[0].versions[0].id,sha256:project.resources[0].versions[0].sha256});
  let ledger=await command(api,{type:'batch',commands:[
    {type:'projects-set',projects:bindings},
    {type:'upsert',collection:'organizations',records:[organization('dfi-investor','dfi'),organization('portfolio-fund','fund'),organization('local-fi','financial_intermediary'),organization('generation-company','company'),organization('farming-company','company'),organization('unknown-company','company')]},
    {type:'upsert',collection:'investments',records:[
      {id:'fund-root',name:'SYNTHETIC DFI investment in fund',kind:'fund',investorOrganizationId:'dfi-investor',investeeOrganizationId:'portfolio-fund',amount:{amount:'1000',currency:'USD'},status:'active'},
      {id:'fi-investment',name:'SYNTHETIC intermediary allocation',kind:'intermediary',parentInvestmentId:'fund-root',investorOrganizationId:'portfolio-fund',investeeOrganizationId:'local-fi',amount:{amount:'1000',currency:'USD'},status:'active'},
      {id:'power-leaf',name:'SYNTHETIC generation subinvestment',kind:'subinvestment',parentInvestmentId:'fi-investment',investorOrganizationId:'local-fi',investeeOrganizationId:'generation-company',amount:{amount:'60',currency:'USD'},status:'active'},
      {id:'farm-leaf',name:'SYNTHETIC agricultural subinvestment',kind:'subinvestment',parentInvestmentId:'fi-investment',investorOrganizationId:'local-fi',investeeOrganizationId:'farming-company',amount:{amount:'40',currency:'EUR'},status:'active'},
      {id:'unknown-leaf',name:'SYNTHETIC not yet screened subinvestment',kind:'subinvestment',parentInvestmentId:'fi-investment',investorOrganizationId:'local-fi',investeeOrganizationId:'unknown-company',amount:{amount:'10',currency:'USD'},status:'active'}
    ]},
    {type:'upsert',collection:'allocations',records:[
      {id:'parent-fund-exposure',investmentId:'fund-root',projectId:power.project.id,amount:{amount:'1000',currency:'USD'}},
      {id:'parent-fi-exposure',investmentId:'fi-investment',projectId:power.project.id,amount:{amount:'1000',currency:'USD'}},
      {id:'power-allocation-one',investmentId:'power-leaf',projectId:power.project.id,amount:{amount:'25',currency:'USD'}},
      {id:'power-allocation-two',investmentId:'power-leaf',projectId:power.project.id,amount:{amount:'35',currency:'USD'}},
      {id:'farm-allocation',investmentId:'farm-leaf',projectId:farming.project.id,amount:{amount:'40',currency:'EUR'}},
      {id:'unknown-allocation',investmentId:'unknown-leaf',projectId:unknown.id,amount:{amount:'10',currency:'USD'}}
    ]},
    {type:'upsert',collection:'activities',records:[
      {id:'power-activity',projectId:power.project.id,name:'SYNTHETIC generation operation',kind:'operation',siteIds:[],sectorProfileId:'power_generation',provenance:{kind:'human',method:'Scoped application sector profile checked against synthetic retained source',sourceVersions:[source(originals[0])]}},
      {id:'farm-activity',projectId:farming.project.id,name:'SYNTHETIC agricultural operation',kind:'operation',siteIds:[],sectorProfileId:'agriculture',provenance:{kind:'human',method:'Scoped application sector profile checked against synthetic retained source',sourceVersions:[source(originals[1])]}},
      {id:'unreviewed-activity',projectId:unknown.id,name:'SYNTHETIC sector candidate awaiting review',kind:'proposal',siteIds:[],sectorProfileId:'mining'}
    ]},
    {type:'upsert',collection:'engagementScopes',records:[
      {id:'power-scope',engagementId:power.engagement.id,projectId:power.project.id,componentIds:[],siteIds:[],periodStart:'2026-01-01',periodEnd:'2026-12-31'},
      {id:'farm-scope',engagementId:farming.engagement.id,projectId:farming.project.id,componentIds:[],siteIds:[],periodStart:'2026-01-01',periodEnd:'2026-12-31'}
    ]},
    {type:'upsert',collection:'requirementApplicabilities',records:assessments.flatMap((engagement,index)=>engagement.requirements.map((requirement,number)=>({id:`portfolio-applicability-${index}-${number}`,projectId:engagement.projectId,frameworkEditionId:requirement.frameworkId,requirementRef:{engagementId:engagement.id,id:requirement.id,revision:requirement.revision},decision:index?'uncertain':'applicable',rationale:index?'Separate agricultural financier scope requires further applicability review.':'Synthetic generation financing scope includes this independently assessed requirement.',componentIds:[],investmentId:index?'farm-leaf':'power-leaf',assessedAt:'2026-10-25T00:00:00.000Z',assessedBy:'Alice'})))}
  ]});
  const unreviewedReport=await json(api,'/api/project-lifecycle/report?investmentId=fund-root&view=fmo');assert.equal(unreviewedReport.institutionView.sectorCoverage.groups.length,0);assert.deepEqual(new Set(unreviewedReport.institutionView.sectorCoverage.unknownAllocationIds),new Set(['power-allocation-one','power-allocation-two','farm-allocation','unknown-allocation']));
  for(const id of ['power-activity','farm-activity'])ledger=await command(api,{type:'verify',collection:'activities',id,statement:'Checked the actual existing project, source and application sector profile; this is not an institutional risk category.'},'Bob');
  const reports=await Promise.all(['ifc','world_bank','fmo'].map(view=>json(api,`/api/project-lifecycle/report?investmentId=fund-root&view=${view}`)));
  assert.equal(new Set(reports.map(report=>report.datasetSha256)).size,1);assert.equal(new Set(reports.map(report=>report.snapshotSha256)).size,1);assert.deepEqual(reports[0].institutionView.canonicalRecords,reports[1].institutionView.canonicalRecords);assert.deepEqual(reports[1].institutionView.canonicalRecords,reports[2].institutionView.canonicalRecords);
  const latestCycle=assessments[0].cycles.slice().sort((a,b)=>a.periodEnd.localeCompare(b.periodEnd)).at(-1),latestMeasurements=assessments[0].measurements.filter(row=>row.cycleId===latestCycle.id),latestFindings=assessments[0].findings.filter(row=>row.cycleId===latestCycle.id);
  for(const report of reports){
    assert.equal(report.approval,null);assert.ok(report.assessmentContexts.every(context=>context.mode==='working_review'&&context.approvalStatus==='current_unapproved'));
    assert.deepEqual(report.portfolio.amounts,[{currency:'EUR',amount:'40'},{currency:'USD',amount:'70'}]);assert.deepEqual(new Set(report.portfolio.leafInvestmentIds),new Set(['power-leaf','farm-leaf','unknown-leaf']));assert.equal(report.portfolio.allocationIds.some(id=>id.startsWith('parent-')),false);
    const sectors=report.institutionView.sectorCoverage;assert.equal(sectors.status,'partial');assert.deepEqual(sectors.unknownAllocationIds,['unknown-allocation']);assert.deepEqual(sectors.unknownLeafInvestmentIds,['unknown-leaf']);assert.deepEqual(sectors.mixedAllocationIds,[]);
    const generation=sectors.groups.find(group=>group.sectorProfileId==='power_generation'),agriculture=sectors.groups.find(group=>group.sectorProfileId==='agriculture');assert.ok(generation&&agriculture);assert.deepEqual(generation.amounts,[{currency:'USD',amount:'60'}]);assert.deepEqual(new Set(generation.allocationIds),new Set(['power-allocation-one','power-allocation-two']));assert.deepEqual(agriculture.amounts,[{currency:'EUR',amount:'40'}]);assert.equal(sectors.groups.some(group=>group.sectorProfileId==='mining'),false,'An unverified sector proposal must remain unknown.');
    const monitoring=report.institutionView.portfolioMonitoring;assert.equal(monitoring.rows.length,3);assert.equal(monitoring.rows.some(row=>['fund-root','fi-investment'].includes(row.investmentId)),false);
    const current=monitoring.rows.find(row=>row.investmentId==='power-leaf');assert.deepEqual(new Set(current.allocationIds),new Set(['power-allocation-one','power-allocation-two']));assert.equal(current.counts.cycles,1);assert.equal(current.counts.measurements,1);assert.equal(current.counts.incidents,1);
    const currentRecords=report.institutionView.canonicalRecords.filter(row=>row.engagementId===power.engagement.id);assert.deepEqual(currentRecords.filter(row=>row.entity==='MonitoringCycle').map(row=>row.id),[latestCycle.id]);assert.deepEqual(currentRecords.filter(row=>row.entity==='IndicatorMeasurement').map(row=>row.id),latestMeasurements.map(row=>row.id));assert.equal(currentRecords.find(row=>row.entity==='IndicatorMeasurement').value,68);assert.deepEqual(new Set(current.frameworks.flatMap(framework=>framework.findingIds)),new Set(latestFindings.map(row=>row.id)));
    for(const framework of current.frameworks){assert.equal(framework.performanceCounts.noncompliant,1);assert.equal(framework.performanceCounts.compliant,undefined,'Earlier compliant cycles are not counted as current performance.');assert.ok(framework.recordedRiskDimensions.some(risk=>risk.residualRisk==='high'&&risk.riskTrajectory==='increasing'));}
    const awaiting=monitoring.rows.find(row=>row.investmentId==='farm-leaf');assert.equal(awaiting.counts.measurements,0);assert.ok(awaiting.frameworks.every(framework=>framework.unassessedRequirementIds.length===1&&framework.findingIds.length===0));
    const unmonitored=monitoring.rows.find(row=>row.investmentId==='unknown-leaf');assert.equal(unmonitored.monitoringStatus,'not_recorded');assert.equal(unmonitored.counts.cycles,0);assert.equal(unmonitored.counts.measurements,0);assert.deepEqual(unmonitored.frameworks,[]);
    assert.equal(monitoring.rows.flatMap(row=>row.frameworks).some(framework=>/^adb/.test(framework.frameworkId)),false,'An institution view cannot invent a screening assessment for another framework.');
    const serialized=JSON.stringify(report);assert.equal(serialized.includes(monitoringPrivateText),false);assert.equal(serialized.includes('ciphertext'),false);
  }
  const afterProjects=await Promise.all(bindings.map(binding=>json(api,`/api/projects/${binding.projectId}`))),afterAssessments=await Promise.all([json(api,power.route),json(api,farming.route)]);
  assert.deepEqual(afterProjects,originals,'Reporting and lifecycle links must preserve the existing project and source authority.');assert.deepEqual(afterAssessments,assessments,'Portfolio projections must preserve every original assessment, evidence version and immutable baseline.');assert.equal(api.externalCalls,0);
  retain({scenario:'B',synthetic:true,meaning:'Actual local API fund/FI/subinvestment journey, reviewed application-sector exposures and existing current-period E&S monitoring. No institutional compliance category is inferred.',ledger,reports,unreviewedSectorCoverage:unreviewedReport.institutionView.sectorCoverage,screeningEvidence:assessments.map(engagement=>({engagementId:engagement.id,projectId:engagement.projectId,baselineIds:engagement.baselines.map(baseline=>({id:baseline.id,sha256:baseline.sha256})),findings:engagement.findings.filter(finding=>!finding.cycleId).map(finding=>({id:finding.id,requirementId:finding.requirementId,riskSignificance:finding.riskSignificance,performance:finding.performance,status:finding.status,reviewedBy:finding.reviewedBy}))})),existingAuthoritiesUnchanged:true,externalCalls:api.externalCalls});
});
