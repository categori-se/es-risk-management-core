import {DatabaseSync} from 'node:sqlite';
import {createReviewSignoffPolicyStore} from './review-signoff-policy.mjs';
import {clientTemplateApprovalSubject} from './client-template-studio.mjs';
const copy=value=>structuredClone(value),fail=(message,status=409)=>{throw Object.assign(Error(message),{status,statusCode:status});};

export function retainedTemplateSubject(state,subject){
 if(!subject||typeof subject.id!=='string')fail('Select an exact retained template or report subject.');
 let found;for(const template of state.templates)for(const version of template.versions){const candidate=clientTemplateApprovalSubject({kind:'template',template,version});if(candidate?.id===subject.id)found=candidate;}
 for(const report of state.reports){const candidate=clientTemplateApprovalSubject({kind:'report',report});if(candidate?.id===subject.id)found=candidate;}
 if(!found||found.sha256!==subject.sha256)fail('The requested sign-off subject differs from its retained source, values or artifact.');return found;
}

/** Same responsibility model and receipt validation as local custody. Hosted
 * configuration is confined to the actual authorized engagement. */
export function openHostedTemplatePolicies({accountId,engagement,actorId,state,activePolicyId,now,newId}={}){
 const database=new DatabaseSync(':memory:'),roles=Object.keys(engagement.roles||{}).filter(role=>(engagement.roles[role]||[]).includes(actorId)),context={engagementId:engagement.id};
 const service=createReviewSignoffPolicyStore({database,accountId,now,newId,authorizeActor:({actorId:acting,operation})=>acting===actorId&&(operation==='configure'?roles.includes('approver'):roles.some(role=>['reviewer','approver'].includes(role)))});
 if(state){if(state.accountId!==accountId)fail('Responsibility state belongs to another account.',403);database.prepare('UPDATE review_policy_state SET json=? WHERE id=1').run(JSON.stringify(state));}
 const validateScope=policy=>{if(policy?.scope?.type!=='engagement'||policy.scope.id!==engagement.id)fail('Hosted responsibility configuration requires this exact authorized engagement scope.',403);};
 for(const policy of service.list().policies)for(const version of policy.versions)validateScope(version.definition);
 return {
  execute(operation,body,templateState){
   if(operation==='policy-list')return service.list();
   if(operation==='policy-save'){validateScope(body.policy);return service.save({...body,actorId});}
   if(operation==='policy-backup')return service.backup();
   if(operation==='policy-restore'){for(const policy of body.state?.policies||[])for(const version of policy.versions||[])validateScope(version.definition);return service.restore(body);}
   if(!['policy-sign','policy-evaluate'].includes(operation))fail('Select an explicit responsibility operation.',400);
   const subject=retainedTemplateSubject(templateState,body.subject),input={...body,subject:{id:subject.id,sha256:subject.sha256},authorId:subject.authorId,context};
   if(operation==='policy-sign')return service.sign({...input,actorId},{domainRoles:roles,context});
   return service.evaluate(input);
  },
  requireComplete({subject,authorId}){
   return service.requireCurrentComplete({subject,authorId,context},{allowUnconfigured:true});
  },
  snapshot:()=>copy(service.backup().state),
  close(){service.close();database.close();}
 };
}
