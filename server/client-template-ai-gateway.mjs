import {createHash} from 'node:crypto';
import {createClientTemplateAssistant} from './client-template-ai.mjs';
import {getEsAiSkill} from '../src/lib/es-ai-skills.js';
import {validateEsAiOutput} from '../src/lib/es-ai-contracts.js';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status,statusCode:status});};
const includes=(constraint,value)=>Array.isArray(constraint)?constraint.includes(value):constraint===value;
const assigned=(engagement,actor)=>['preparer','reviewer','approver'].some(role=>engagement.roles?.[role]?.includes(actor));
const localRoute=(route,description)=>route?.provider==='local'&&route.processingBoundary==='local'&&route.enabled===true&&route.evaluation?.status==='approved'&&description?.configured===true&&description.enabled===true&&description.evaluation?.status==='approved';

/** Only explicit, installed AI Studio routes are candidates. Public evaluation
 * callers receive these private descriptors server-side, never from the UI. */
export function configuredLocalEvaluationModels({routes,gateway,scope}){
 const described=gateway.describe().routes||[];
 return routes.filter(route=>{const description=described.find(row=>row.id===route.id);return localRoute(route,description)&&description.pricing?.inputPerMillion===0&&description.pricing?.outputPerMillion===0&&/^[a-f0-9]{64}$/.test(route.modelDigest||'')&&route.allowedSensitivities?.includes('public')&&route.capabilities?.includes('assessment')&&route.limits?.maxChargeMinorUnits===0&&route.limits.maxMilliseconds>=1000&&route.limits.maxOutputTokens>=128&&Object.entries(route.allowedScope||{}).every(([key,value])=>includes(value,scope[key]));}).map(route=>({id:route.id,revision:route.revision,model:route.model,modelDigest:route.modelDigest,endpoint:route.endpoint,limits:{maxInputTokens:Math.min(route.limits.maxInputTokens,64000),maxMilliseconds:Math.min(route.limits.maxMilliseconds,90000),maxOutputTokens:Math.min(route.limits.maxOutputTokens,3000)}}));
}

/** Connect source-grounded Studio proposals to the existing AI Studio ledger.
 * No new provider, account approval, credential store or retry path is created. */
export function createGatewayClientTemplateAssistant({gateway,routes,routeId,account,workspace}={}){
 const selected=()=>routes?.find(row=>row.id===routeId);
 const describe=()=>{
  const route=selected(),description=gateway.describe().routes?.find(row=>row.id===routeId);
  const allowed=localRoute(route,description)&&description.pricing?.inputPerMillion===0&&description.pricing?.outputPerMillion===0&&route.capabilities?.includes('classification')&&route.allowedSensitivities?.includes('internal')&&includes(route.allowedScope?.accountId,account.custodyId)&&route.limits?.maxChargeMinorUnits===0;
  return {available:Boolean(allowed),supportedTasks:['mappings'],routeId:allowed?route.id:null,model:allowed?route.model:null,location:'approved_loopback_endpoint',accountId:account.custodyId,manualWorkflowAvailable:true,reason:allowed?'Uses the explicitly configured local AI Studio mapping route. Every proposal requires source and mapping review.':'Configure an evaluated local AI Studio templateRouteId, explicitly scoped to this account, before requesting semantic mapping. Manual mapping remains available.'};
 };
 return createClientTemplateAssistant({describe,timeoutMs:20000,execute:async({input,request,signal})=>{
  if(!describe().available)fail(describe().reason);
  const route=selected(),routePin=digest(route),scope={accountId:account.custodyId,projectId:request.project?.id,engagementId:request.engagement?.id,actorId:request.actorId};
  if(request.task!=='mappings'||request.accountId!==account.custodyId||request.routeId!==undefined&&request.routeId!==route.id||typeof request.authorize!=='function'||!scope.actorId||!input.sourceContext)fail('Use an exact current source-grounded mapping request in this account.',403);
  const store=workspace.forAccount(account.id),projectRevision=request.project.revision,engagementRevision=request.engagement.revision;
  const authorize=async()=>{
   try{
    if(!describe().available||digest(selected())!==routePin)return false;
    const project=store.getProject(scope.projectId),engagement=store.engagements().get(scope.engagementId);
    if(project.revision!==projectRevision||engagement.revision!==engagementRevision||engagement.projectId!==project.id||!assigned(engagement,scope.actorId))return false;
    return await request.authorize()===true;
   }catch{return false;}
  };
  if(!await authorize())fail('The template source or current assignment authority changed.',403);
  const manifest=input.sourceContext.manifest,fields=manifest.fields;
  if(!Array.isArray(fields)||!fields.length||fields.length!==input.fields.length||fields.some(field=>!input.fields.some(selected=>selected.id===field.id)))fail('Select exact deterministic source fields for semantic interpretation.');
  const passages=fields.map((field,index)=>({id:`template-field-${index+1}`,documentVersionId:input.sourceContext.sourceId,sourceSha256:input.sourceContext.sourceSha256,sourceKind:'deterministic_template_structure',locator:`${input.sourceContext.sourceFormat} native field ${field.id}`,quote:JSON.stringify(field)}));
  const passageByField=new Map(fields.map((field,index)=>[field.id,passages[index].id]));
  const skill={...getEsAiSkill('es.template.semantic-mapping')};
  skill.instructions+=' Interpret the supplied deterministic native structure. These manifest entries retain original source locations; they are not literal PDF quotations. Keep application-authored reconstruction controls separate from original headings. Return one template_mapping item per proposed field. Its fields object is exactly {fieldId,type,path?,columns?,filter?,expression?,transform?,condition?,confidence,meaning}; supported types are direct,repeat,calculated,conditional,narrative. Use only supplied canonical paths. Cite that field\'s own template-field passage using an exact substring, explain ambiguity and leave uncertain mappings for human correction. No approvals or canonical edits.';
  const sourceInput={question:'Propose unapproved canonical bindings for the explicitly selected original template fields.',passages,requirements:[],context:{task:'template_semantic_mapping',canonicalFieldRegistry:input.canonicalRegistry||input.canonicalPaths,sourcePins:{sourceId:input.sourceContext.sourceId,sourceSha256:input.sourceContext.sourceSha256,definitionSha256:input.sourceContext.definitionSha256,manifestSha256:input.sourceContext.manifestSha256},sections:manifest.sections,nativeContext:manifest.nativeContext,verifiedSourceContext:manifest.verifiedSourceContext}};
  const run=await gateway.execute({scope,routeId:route.id,executionProfile:'local-only',skill,input:sourceInput,sensitivity:'internal',evidenceManifestSha256:digest(sourceInput),signal,authorize});
  if(!await authorize())fail('The source or assignment changed before the mapping proposal could be retained.',403);
  const validation=validateEsAiOutput(run.output,{skill,passages,requirements:[]});
  if(!validation.valid)fail('The semantic mapping output has invalid source citations or draft fields.',422);
  for(const item of run.output.items)if(!item.fields||!passageByField.has(item.fields.fieldId)||!item.supportingPassageIds?.includes(passageByField.get(item.fields.fieldId)))fail('Each proposed mapping must cite its own exact deterministic source field.',422);
  return {output:{proposals:run.output.items.map(item=>item.fields)},provider:{kind:'ai',model:run.route.model,location:'approved_loopback_endpoint',evaluationId:route.evaluation.id,routeId:run.route.id,routeRevision:run.route.revision,runId:run.runId,inference:run.inference,requestSha256:run.requestDigest,outputSha256:run.outputDigest,cost:run.cost}};
 }});
}
