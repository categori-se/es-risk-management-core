import {prepareEsAiClassificationHandoff} from './es-ai-classification-handoff.mjs';
import {createEsAiCredentialVault} from './es-ai-credential-vault.mjs';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createEsAiGateway} from './es-ai-gateway.mjs';
import {createEsAiKnowledge} from './es-ai-knowledge.mjs';
import {createEsAiService} from './es-ai-service.mjs';
import {indexEngagementSources} from './engagement-assistance.mjs';
import {createGatewayClientTemplateAssistant,configuredLocalEvaluationModels} from './client-template-ai-gateway.mjs';

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const hash=value=>createHash('sha256').update(value).digest('hex');
const keys=(value,allowed)=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('Use the selected task controls without scope, policy or credential overrides.');};
const member=(engagement,actor,roles)=>roles.some(role=>engagement.roles[role]?.includes(actor));
// One run may propose several independent records. Pin the complete item token,
// including retained revisions, so draft-1 is not confused with draft-10 and a
// later human correction cannot make the original proposal available again.
const handedOff=(record,runId,itemId)=>[...(record.history||[]),record].some(value=>value.provenance?.method?.includes(`AI run ${runId}; item ${itemId};`));

/** Local-owner composition. Hosted callers must supply verified server authority to the same service. */
export function createEsAiWorkspaceApi({directory,workspace,routes,adapters,resolveCredential,sourcePermissions,gateway,service,getLibrary,simulation=false,templateRouteId}={}) {
  mkdirSync(directory,{recursive:true,mode:0o700});
  const configPath=join(directory,'routes.json');
  let configuration={};
  if(existsSync(configPath)){const bytes=readFileSync(configPath);if(bytes.length>128*1024)fail('The server AI route configuration exceeds its limit.');configuration=JSON.parse(bytes);}
  const configuredRoutes=routes||configuration.routes||[];
  const permissions=sourcePermissions||configuration.sourcePermissions||{};
  const vault=resolveCredential?undefined:createEsAiCredentialVault({directory:join(directory,'credential-vault')});
  const resolver=resolveCredential||(vault?.describe().available?async input=>{const route=configuredRoutes.find(route=>route.id===input.route.id&&route.revision===input.route.revision);if(!route)fail('The credential route changed.',409);return vault.resolve({...input,route});}:undefined);
  gateway ||= createEsAiGateway({directory:join(directory,'gateway'),routes:configuredRoutes,adapters,resolveCredential:resolver});
  const knowledge=createEsAiKnowledge({authorize:async()=>true});
  service ||= createEsAiService({directory:join(directory,'runs'),gateway,knowledge});
  const indexes=new Map();

  async function handle({operation='',accountId,projectId,engagementId,actorId,body={}}) {
    const store=workspace.forAccount(accountId),project=store.getProject(projectId),engagements=store.engagements(),engagement=engagementId?engagements.get(engagementId):undefined;
    if(engagement&&engagement.projectId!==project.id)fail('Choose an engagement belonging to this source project.',404);
    const actor=actorId||(engagement?engagement.roles.preparer[0]:'local-owner');
    if(engagement&&!member(engagement,actor,['preparer','reviewer','approver']))fail('Choose an assigned local engagement team member.',403);
    const scope={accountId:store.account.custodyId,projectId:project.id,...(engagement?{engagementId:engagement.id}:{}),actorId:actor};
    const sourceMap=new Map(project.resources.flatMap(resource=>resource.versions.map(version=>[version.id,version])));
    const authorize=async({stage,route,passages=[]}={})=>{
      const current=store.getProject(project.id);
      if(current.revision!==project.revision)return false;
      if(engagement){const currentEngagement=engagements.get(engagement.id);if(currentEngagement.revision!==engagement.revision||!member(currentEngagement,actor,['preparer','reviewer','approver']))return false;}
      const registeredRoute=route&&configuredRoutes.find(item=>item.id===route.id);
      if(route?.processingBoundary==='remote'&&registeredRoute?.allowedScope?.projectId!==project.id&&!(registeredRoute?.allowedProjectIds||[]).includes(project.id))return false;
      if(passages.some(p=>Boolean(p.resourceVersionId)!==(p.sourceKind==='institutional_resource')))return false;
      const resourcePassages=passages.filter(p=>p.sourceKind==='institutional_resource');
      if(resourcePassages.length){
        if(!getLibrary||resourcePassages.some(p=>p.fileId!==p.versionId))return false;
        if(route?.processingBoundary==='remote'&&resourcePassages.some(p=>configuration.librarySourcePermissions?.[p.resourceVersionId]?.remoteAllowed!==true))return false;
        try{if(await (await getLibrary()).authorizeAiPassages({passages:resourcePassages})!==true)return false;}catch{return false;}
      }
      for(const passage of passages.filter(p=>!p.resourceVersionId)){
        const source=sourceMap.get(passage.versionId||passage.documentVersionId),policy=permissions[source?.id];
        if(!source||source.sha256!==(passage.sourceSha256||passage.sha256)||policy?.aiAllowed!==true||policy.allowedActorIds&&!policy.allowedActorIds.includes(actor))return false;
        if(route?.processingBoundary==='remote'&&policy.remoteAllowed!==true)return false;
      }
      return true;
    };
    const base={scope,project:{...project,accountId:scope.accountId},engagement,requirements:engagement?.requirements||[],authorize,sensitivity:'internal'};
    async function visibleRuns(){const result=[];for(const run of await service.runs(scope))if(await authorize({stage:'history-read',passages:run.passages||[]}))result.push(run);return result;}
    if(!operation){keys(body,[]);const description=await service.describe(scope),runs=await visibleRuns(),visibleIds=new Set(runs.map(run=>run.id||run.runId));return {...description,simulation:simulation===true,routes:description.routes||description.gateway?.routes||gateway.describe()?.routes||[],libraryVersions:getLibrary?(await (await getLibrary()).catalog({audience:'practitioner'})).versions.map(version=>({id:version.resourceVersionId||version.id,title:version.title,edition:version.edition})):[],runs,conversations:(await service.conversations(scope)).map(conversation=>({...conversation,title:'Project AI conversation',runIds:conversation.runIds.filter(id=>visibleIds.has(id))})).filter(conversation=>conversation.runIds.length)};}
    if(operation==='open'){keys(body,['runId']);const run=(await visibleRuns()).find(item=>(item.runId||item.id)===body.runId);if(!run)fail('This AI run is outside the selected project and engagement.',404);return run;}
    if(operation==='purge'){keys(body,['conversationContent']);if(engagement&&!member(engagement,actor,['preparer','reviewer','approver']))fail('An assigned project practitioner must clear AI content.',403);return service.purge(scope,{conversationContent:true});}
    if(operation==='retention'){keys(body,['contentRetentionDays']);if(engagement&&!member(engagement,actor,['preparer','reviewer','approver']))fail('An assigned practitioner must set AI history retention.',403);return service.setRetention({scope,contentRetentionDays:body.contentRetentionDays,redactOnExport:true,authorize});}
    if(operation==='review'){
      keys(body,['runId','itemId','decision','comment','correction']);
      if(engagement&&!member(engagement,actor,['preparer','reviewer']))fail('An assigned preparer or reviewer must review AI proposals.',403);
      await service.review({scope,...body,actorId:actor,authorize});
      return (await service.runs(scope)).find(item=>(item.runId||item.id)===body.runId);
    }
    if(operation==='handoff'){
      keys(body,['runId','itemId','expectedRevision']);
      if(!engagement||!member(engagement,actor,['preparer','reviewer']))fail('Choose an engagement and an assigned preparer or reviewer to save a review draft.',403);
      if(body.expectedRevision!==engagement.revision)fail('The engagement changed. Reopen its current review context.',409);
      const run=(await service.runs(scope)).find(item=>(item.runId||item.id)===body.runId);
      const handoff=await service.handoff({scope,runId:body.runId,itemId:body.itemId,authorize}),item=handoff.item;
      if(!item||!await authorize({stage:'handoff',passages:run.passages||[]})||run.validation?.valid!==true)fail('Choose a validated proposal in this engagement.',409);
      const reviews=run.reviews||run.review||[],review=reviews.filter(entry=>entry.itemId===item.id).at(-1);
      if(!review||!['accepted','corrected'].includes(review.decision))fail('Inspect the evidence and record an acceptance or correction before saving this draft.',409);
      const text=item.text,provenance={kind:'ai',model:run.route?.model||'explicit provider',method:`E&S skill ${run.skillId||run.skill?.id}; version ${run.skill?.version||'1.0.0'}; AI run ${body.runId}; item ${item.id}; reviewed draft handoff by ${actor}`,promptHash:run.requestDigest||hash(JSON.stringify({runId:body.runId,skill:run.skill}))};
      if(['classification','document_classification'].includes(item.kind)){
        const change=await prepareEsAiClassificationHandoff({run,item,engagement,project,actorId:actor,readVersion:versionId=>store.readVersion(project.id,versionId),at:new Date().toISOString()});
        if(!await authorize({stage:'classification-handoff',passages:run.passages||[]}))fail('The source scope changed before classification handoff.',409);
        const updated=store.mutate(project.id,project.revision,{type:'document-classification',versionId:change.versionId,metadata:change.metadata},{classificationAuthority:{projectId:project.id,versionId:change.versionId,sourceSha256:change.sourceSha256,engagementId:engagement.id,classification:change.classification}});
        return {project:updated,engagement,message:'Document classification draft saved with its source evidence. Review its metadata in the engagement Evidence tab.'};
      }
      if(['finding','assessment'].includes(item.kind)){
        if(!engagement.requirements.some(requirement=>requirement.id===item.requirementId))fail('The proposal requirement is outside this engagement.',409);
        if(engagement.findings.some(finding=>handedOff(finding,body.runId,item.id)))fail('This proposal already has a review draft. Continue reviewing that finding.',409);
        let working=engagement;const assertions={};
        const selected=[...new Set([...(item.supportingPassageIds||[]),...(item.contradictoryPassageIds||[])])];
        const passages=run.passages||run.knowledge?.passages||[];
        provenance.sources=selected.map(id=>{const p=passages.find(value=>value.id===id);return `${p?.sourceKind||'project_document'}:${p?.resourceVersionId||project.id}:${p?.versionId}:${p?.sourceSha256||p?.sha256}:${p?.locator}`.slice(0,1000);});
        for(const passageId of selected){const p=passages.find(value=>value.id===passageId);if(!p||p.masked)fail('Confirm exact original excerpts before saving this finding.',409);if(p.sourceKind==='institutional_resource')continue;const original=store.readVersion(project.id,p.versionId);if(hash(original.bytes)!==p.sha256)fail('A cited original changed before handoff.',409);}
        // Re-read every original and recheck its hash before draft persistence.
        for(const passageId of selected){
          const passage=passages.find(p=>p.id===passageId);if(!passage||passage.masked)fail('A proposed citation needs an exact original excerpt before it can be saved as source evidence.',409);
          if(passage.sourceKind==='institutional_resource')continue;
          const source=sourceMap.get(passage.versionId),bytes=store.readVersion(project.id,passage.versionId).bytes;
          if(!source||hash(bytes)!==passage.sha256)fail('The cited original differs from this proposal.',409);
          const previous=working.assertions.find(assertion=>assertion.versionId===passage.versionId&&assertion.quote===passage.quote&&assertion.locator===passage.locator);
          if(previous){assertions[passageId]=previous.id;continue;}
          working=engagements.mutate(engagement.id,working.revision,{type:'assertion-save',versionId:passage.versionId,locator:passage.locator,quote:passage.quote,note:`AI run ${body.runId}; inspect original before confirming.`,topics:[],requirementIds:[item.requirementId],classification:'ai_suggested',reviewStatus:'suggested',provenance},actor);
          assertions[passageId]=working.assertions.at(-1).id;
        }
        const coverage=['complete','partial','missing','not_determined'].includes(item.coverage)?item.coverage:'not_determined',adequacy=['adequate','deficient','insufficient_evidence','not_determined'].includes(item.adequacy)?item.adequacy:'insufficient_evidence';
        working=engagements.mutate(engagement.id,working.revision,{type:'finding-save',requirementId:item.requirementId,applicability:'uncertain',applicabilityRationale:'Confirm applicability against the engagement scope and exact framework edition.',coverage,adequacy,performance:'undetermined',supportingAssertionIds:(item.supportingPassageIds||[]).filter(id=>assertions[id]).map(id=>assertions[id]),contradictoryAssertionIds:(item.contradictoryPassageIds||[]).filter(id=>assertions[id]).map(id=>assertions[id]),rationale:text,deficiency:item.missingEvidence?'Further evidence is required.':item.fields?.deficiency||'',recommendation:item.fields?.recommendation||'Review the cited evidence and determine the appropriate professional conclusion.',uncertainty:item.uncertainty||'AI draft awaiting source confirmation and professional review.',riskSignificance:item.fields?.riskSignificance||'Requires reviewer judgment',provenance},actor);
        return {engagement:working,message:'Finding draft and its suggested source citations saved. Confirm each source and review the finding in the engagement workspace.'};
      }
      if(item.kind==='action'){
        if(engagement.actions.some(action=>handedOff(action,body.runId,item.id)))fail('This proposal already has an open action draft. Continue editing that action.',409);
        const fields=item.fields||{};if(!Array.isArray(fields.findingIds)||!fields.findingIds.length||fields.findingIds.some(id=>!engagement.findings.some(finding=>finding.id===id)||!run.context?.findings?.some(finding=>finding.id===id)))fail('Choose the exact existing findings addressed by this action draft.',409);
        const working=engagements.mutate(engagement.id,engagement.revision,{type:'action-save',findingIds:(fields.findingIds||[]).filter(id=>engagement.findings.some(finding=>finding.id===id)),description:text,owner:fields.owner||'Assign responsible owner',organization:fields.organization||engagement.client,priority:['low','medium','high','critical'].includes(fields.priority)?fields.priority:'medium',trigger:'ongoing',triggerDetail:fields.triggerDetail||'Schedule following professional review',deliverables:fields.deliverables||['Evidence of implementation and effectiveness'],verificationCriteria:fields.verificationCriteria||'An assigned reviewer inspects exact implementation and outcome evidence.',status:'open',provenance},actor);
        return {engagement:working,message:'Open action draft saved for assignment, scheduling and verification in the engagement workspace.'};
      }
      fail('This proposal can be reviewed in AI history. Findings and action proposals can also be saved as engagement drafts.');
    }
    if(!['estimate','run'].includes(operation))fail('Choose a supported project assistant operation.',404);
    keys(body,['question','skillId','routeId','executionProfile','assistantProfile','versionIds','filters','estimateDigest','resourceVersionIds']);
    if(typeof body.question!=='string'||body.question.length>4000||!body.question.trim())fail('Enter a question or task instruction of up to 4,000 characters.');
    if(!Array.isArray(body.versionIds)||!body.versionIds.length||body.versionIds.length>100||new Set(body.versionIds).size!==body.versionIds.length||body.versionIds.some(id=>!sourceMap.has(id)))fail('Select distinct retained source versions in this project.');
    if(body.filters)keys(body.filters,['collection','period','component','topic','standard','edition','assessmentStatus','retrieval']);
    const inputKey=hash(JSON.stringify({accountId:scope.accountId,projectId:project.id,revision:project.revision,versionIds:body.versionIds}));
    let index=indexes.get(inputKey);
    if(!index){index=await indexEngagementSources({project,versionIds:body.versionIds,readVersion:id=>store.readVersion(project.id,id)});if(indexes.size>=8)indexes.delete(indexes.keys().next().value);indexes.set(inputKey,index);}
    else for(const id of body.versionIds){if(hash(store.readVersion(project.id,id).bytes)!==sourceMap.get(id).sha256)fail('An original changed after indexing. Restore the exact source before reuse.',409);}
    index={...index,passages:index.passages.map(passage=>({...passage,...(permissions[passage.versionId]||{aiAllowed:false,sensitivity:'restricted',pii:'withhold'})}))};
    let resources=[];if(body.resourceVersionIds?.length){if(!getLibrary||!Array.isArray(body.resourceVersionIds)||body.resourceVersionIds.length>20||new Set(body.resourceVersionIds).size!==body.resourceVersionIds.length)fail('Choose a bounded set of exact institutional resource editions.');resources=(await (await getLibrary()).aiKnowledge({versionIds:body.resourceVersionIds,query:body.question,limit:40})).resources;}
    const input={...base,...body,index,resources,...(body.skillId==='conversation'?{skillId:'conversation'}:{})};
    if(!await authorize())fail('The project or engagement changed before processing.',409);
    if(operation==='run'){const estimate=await service.estimate(input);if(typeof body.estimateDigest!=='string'||body.estimateDigest!==estimate.estimateDigest)fail('Review a current estimate for this exact task and source selection before running it.',409);}
    return service[operation](input);
  }
  return {handle,gateway,service,
    templateAssistant(account){return createGatewayClientTemplateAssistant({gateway,routes:configuredRoutes,routeId:templateRouteId??configuration.templateRouteId,account,workspace});},
    evaluationModels(scope){return configuredLocalEvaluationModels({routes:configuredRoutes,gateway,scope});},
    close(){indexes.clear();gateway.close?.();vault?.close();}};
}
