import {randomUUID} from 'node:crypto';
import demo from '../src/data/consultancy-demo.json' with {type:'json'};

/** Explicit local sample creation. No model, remote intake or simulated approval
 * is enabled in the operator's workspace. Existing client records are untouched. */
export function createConsultancyDemonstration(workspace, {confirmedSynthetic = false} = {}) {
  if (confirmedSynthetic !== true) throw Object.assign(Error('Confirm creation of separate synthetic client accounts.'), {status:400});
  const runId = randomUUID(), identity = workspace.createProjectIdentity({name: demo.projectName});
  const clients = [];
  for (const key of ['A','B']) {
    const account = workspace.createAccount({name:`Synthetic client ${key} · ${runId.slice(0,8)}`,organization:`Synthetic client ${key}`,dataOwner:'Synthetic demonstration; computer owner'});
    const store = workspace.forAccount(account.id);
    let project = store.createProject({name:demo.projectName,client:`Synthetic client ${key}`,phase:'Due diligence',period:'Synthetic exercise'});
    project = store.linkProjectContext(project.id, {identityId:identity.id});
    project = store.setProjectFrameworks(project.id, {expectedRevision:project.projectContext.linkRevision,frameworkIds:['ifc_ps_2012','wb_esf_2016']});
    const documents = key === 'A' ? demo.documents : [demo.secondClientDocument];
    for (const row of documents) project = store.mutate(project.id,project.revision,{type:'intake',mode:'managed',filename:row.filename,title:row.title,mediaType:'text/plain',contentBase64:Buffer.from(row.content).toString('base64')});
    const roles={preparer:['Demo preparer'],reviewer:['Demo reviewer'],approver:['Demo approver'],client:[]};
    const engagements=store.engagements();let engagement=engagements.create({projectId:project.id,actorId:roles.preparer[0],name:`Synthetic client ${key} due diligence`,client:`Synthetic client ${key}`,contractingParties:[`Synthetic client ${key}`,'Synthetic practitioner'],type:'due_diligence',scope:['Evidence review','Gap assessment','Corrective-action plan','Monitoring handover'],exclusions:'Authored synthetic material only; no professional or institutional acceptance.',agreementVersionIds:[],amendments:[],deliverables:[{id:'demo-report',title:'Cited report, requirements matrix and corrective-action plan',description:'One approved dataset and exact source references',dueDate:''}],roles,dataRules:'Separate client custody. Local declared roles do not authenticate separate users. No external AI permission is granted by creating this sample.',clientAcceptanceRequired:false,frameworkIds:['ifc_ps_2012','wb_esf_2016']});
    if (key==='A') for (const [index,row] of demo.documents.entries()) engagement=engagements.mutate(engagement.id,engagement.revision,{type:'requirement-add',frameworkId:'project',title:row.title+' commitment',text:row.commitment,sourceVersionId:project.resources[index].versions[0].id,locator:'Synthetic source, line 2',topics:[row.topic]},roles.preparer[0]);
    if (key==='A') {
      const ledger=store.lifecycle();ledger.command(0,{type:'batch',commands:[{type:'projects-set',projects:[{projectId:project.id,identityId:identity.id}]},{type:'upsert',collection:'organizations',records:[{id:'demo-sponsor',name:'Synthetic Riverbridge sponsor',kind:'company'},{id:'demo-lender',name:'Synthetic development lender',kind:'dfi'}]},{type:'upsert',collection:'components',records:[{id:'demo-generation',projectId:project.id,name:'Generation site',kind:'component'},{id:'demo-road',projectId:project.id,name:'Access road',kind:'associated_facility'}]},{type:'upsert',collection:'investments',records:[{id:'demo-investment',name:'Synthetic development investment',kind:'direct',investorOrganizationId:'demo-lender',investeeOrganizationId:'demo-sponsor',amount:{amount:'10000000',currency:'USD'},status:'proposed'}]},{type:'upsert',collection:'allocations',records:[{id:'demo-allocation',investmentId:'demo-investment',projectId:project.id,componentId:'demo-generation',amount:{amount:'10000000',currency:'USD'}}]},{type:'upsert',collection:'engagementScopes',records:[{id:'demo-scope',projectId:project.id,engagementId:engagement.id,componentIds:['demo-generation','demo-road'],siteIds:[],periodStart:'2026-01-01',periodEnd:'2026-12-31'}]}]},'demo-preparer');
    }
    clients.push({key,accountId:account.id,custodyId:store.account.custodyId,projectId:project.id,engagementId:engagement.id,sourceCount:project.resources.length});
  }
  return {format:'esia-synthetic-consultancy-run',schemaVersion:1,runId,identityId:identity.id,synthetic:true,notice:demo.notice,clients,automaticApproval:false,automaticAi:false,authority:'Local accounts partition one computer owner; remote confidentiality is tested separately through authenticated APIs.'};
}
