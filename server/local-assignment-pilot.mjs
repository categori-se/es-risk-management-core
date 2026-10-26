import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {createAssignmentPilotEvidence} from './assignment-pilot-evidence.mjs';
import {stableJson} from '../src/lib/engagement-domain.js';
import {PRACTITIONER_TASKS} from '../src/lib/professional-qualification.js';

const hash=value=>createHash('sha256').update(stableJson(value)).digest('hex');
const deny=message=>Object.assign(Error(message),{status:403});

/** Observations live beside the owning local account. All project and original
 * reads go through its existing canonical repository. */
export function createLocalAssignmentPilot({workspace,directory}) {
 const services=new Map();
 function context(accountId,engagementId,actorId){
  const store=workspace.forAccount(accountId),engagement=store.engagements().get(engagementId),project=store.getProject(engagement.projectId);
  if(typeof actorId!=='string'||![...engagement.roles.preparer,...engagement.roles.reviewer,...engagement.roles.approver].includes(actorId))throw deny('Choose an assigned practitioner to record or read assignment measurements.');
  return {store,project,engagement,scope:{accountId:store.account.custodyId,projectId:project.id,engagementId},actor:{id:actorId,identityBasis:'Declared local practitioner; OS-owner repository'}};
 }
 function service(store){
  const account=store.account;if(!services.has(account.id))services.set(account.id,createAssignmentPilotEvidence({directory:join(directory,account.id,'pilot-evidence'),verificationScope:'declared_original_document_versions',
   authorize:async({scope,actor})=>{try{const current=context(account.id,scope.engagementId,actor?.id);return current.scope.accountId===scope.accountId&&current.scope.projectId===scope.projectId;}catch{return false;}},
   readRestoredArtifact:async({scope,actor,canonicalId,versionId})=>{const current=context(account.id,scope.engagementId,actor?.id);if(current.scope.projectId!==scope.projectId||current.scope.accountId!==scope.accountId)throw deny('The handover original changed its current authorized assignment scope.');const project=current.project,resource=project.resources.find(row=>row.id===canonicalId);if(!resource?.versions.some(version=>version.id===versionId))throw deny('The restored original does not belong to the declared canonical document.');const retained=store.readVersion(scope.projectId,versionId);return {canonicalId,versionId,bytes:retained.bytes,reopened:true};}
  }));return services.get(account.id);
 }
 function pins({engagement,project}){
  return {assignmentId:engagement.id,datasetSha256:hash({project,engagement}),observationProtocolSha256:hash({version:1,tasks:PRACTITIONER_TASKS,criteria:'Ten observed tasks; active time includes corrections and assistance, wait time separate; failures and qualitative feedback; no automatic acceptance.'}),acceptanceCriteriaSha256:hash({mandate:{frameworks:engagement.frameworks,reviewDepth:engagement.reviewDepth,clientAcceptanceRequired:engagement.clientAcceptanceRequired},requirements:engagement.requirements.map(row=>({id:row.id,revision:row.revision,text:row.text,frameworkId:row.frameworkId})),criteria:'Equivalent independently accepted cited findings, corrective actions, issued outputs and exact-original handover; measure all six active phases.'})};
 }
 return {
  async handle({accountId,engagementId,actorId,operation='read',body={}}){
   const current=context(accountId,engagementId,actorId),repo=service(current.store),pilotContext=pins(current);
   if(operation==='read')return {...await repo.list(current.scope,current.actor),pilotContext,authority:'Local measurements are practitioner attestations. No novice success, time saving or handover is claimed without recorded observations.'};
   if(operation==='measurement'||operation==='task-observation'){
    if(body.datasetSha256!==pilotContext.datasetSha256||body.acceptanceCriteriaSha256!==pilotContext.acceptanceCriteriaSha256||body.assignmentId!==pilotContext.assignmentId)throw Object.assign(Error('The assignment dataset or acceptance criteria changed. Reopen the current measurement context.'),{status:409});
    if(operation==='task-observation'){
     if(body.observationProtocolSha256!==pilotContext.observationProtocolSha256)throw Object.assign(Error('The ten-task observation protocol changed. Reopen its current context.'),{status:409});
     return repo.recordObservation(current.scope,body,current.actor);
    }
    return repo.recordMeasurement(current.scope,body,current.actor);
   }
   if(operation==='verify-handover'){
    if(body.datasetSha256!==pilotContext.datasetSha256)throw Object.assign(Error('Verify handover against the current exact assignment dataset.'),{status:409});
    return repo.verifyHandover(current.scope,body,current.actor);
   }
   throw Object.assign(Error('Choose a supported assignment measurement operation.'),{status:404});
  },close(){for(const value of services.values())value.close();}
 };
}
