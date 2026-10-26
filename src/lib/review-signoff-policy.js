// Professional titles describe responsibility; resource permissions remain in
// the existing account/project/engagement authorization system.
export const professionalRoleDefaults=Object.freeze([
 {id:'managing_director',label:'Managing Director',rank:100},
 {id:'partner_in_charge',label:'Partner in Charge',rank:90},
 {id:'project_manager',label:'Project Manager',rank:70},
 {id:'team_lead',label:'Team Lead',rank:60},
 {id:'expert',label:'Expert',rank:40},
 {id:'specialist',label:'Specialist',rank:30}
].map(Object.freeze));
const copy=value=>structuredClone(value),object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(value)&&!value.split('.').some(part=>['__proto__','prototype','constructor'].includes(part));
const bounded=(value,max)=>typeof value==='string'&&value.trim()&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value);
const assert=(value,message)=>{if(!value)throw Object.assign(Error(message),{status:422});};
const exact=(value,keys,label)=>assert(object(value)&&Object.keys(value).every(key=>keys.includes(key)),`${label} has unsupported properties.`);
export function defaultReviewSignoffPolicy({id='standard_professional_review',name='Professional review',scope={type:'account',id:'default'}}={}){
 return {format:'esia-review-signoff-policy',schemaVersion:1,id,name,scope:copy(scope),roles:copy(professionalRoleDefaults),assignments:[],stages:[
  {id:'technical_review',label:'Technical review',roleIds:['expert','specialist'],domainRole:'reviewer',required:true,minApprovals:1,distinctFromAuthor:true,distinctFromEarlierStages:false},
  {id:'project_review',label:'Project review',roleIds:['project_manager','team_lead'],domainRole:'reviewer',required:true,minApprovals:1,distinctFromAuthor:true,distinctFromEarlierStages:true},
  {id:'final_approval',label:'Final approval',roleIds:['partner_in_charge','managing_director'],domainRole:'approver',required:true,minApprovals:1,distinctFromAuthor:true,distinctFromEarlierStages:true}
 ]};
}
export function validateReviewSignoffPolicy(policy){
 const errors=[];try{
  exact(policy,['format','schemaVersion','id','name','scope','roles','assignments','stages'],'Sign-off policy');assert(policy.format==='esia-review-signoff-policy'&&policy.schemaVersion===1,'Unsupported sign-off policy format.');assert(validId(policy.id)&&bounded(policy.name,200),'Use a stable policy identifier and descriptive name.');
  exact(policy.scope,['type','id'],'Policy scope');assert(['account','team','institution','engagement'].includes(policy.scope.type)&&validId(policy.scope.id),'Choose the exact account, team, institution or engagement scope.');
  assert(Array.isArray(policy.roles)&&policy.roles.length>0&&policy.roles.length<=30,'Configure from 1 to 30 professional roles.');const ids=new Set();for(const role of policy.roles){exact(role,['id','label','rank','description'],'Professional role');assert(validId(role.id)&&!ids.has(role.id)&&bounded(role.label,100)&&Number.isSafeInteger(role.rank)&&role.rank>=0&&role.rank<=1000,'Each role needs a unique stable identifier, title and hierarchy rank.');if(role.description!==undefined)assert(typeof role.description==='string'&&role.description.length<=1000,'Role description is too long.');ids.add(role.id);}
  assert(Array.isArray(policy.assignments)&&policy.assignments.length<=500,'Use a bounded list of named team assignments.');const people=new Set();for(const row of policy.assignments){exact(row,['userId','name','roleIds'],'Role assignment');assert(validId(row.userId)&&!people.has(row.userId)&&(!row.name||bounded(row.name,200))&&Array.isArray(row.roleIds)&&row.roleIds.length>0&&row.roleIds.length<=30&&new Set(row.roleIds).size===row.roleIds.length&&row.roleIds.every(id=>ids.has(id)),'Assign existing professional roles to each exact user once.');people.add(row.userId);}
  assert(Array.isArray(policy.stages)&&policy.stages.length>0&&policy.stages.length<=20&&policy.stages.some(stage=>stage.required),'Configure an ordered sign-off sequence with at least one required stage.');const stages=new Set();for(const stage of policy.stages){exact(stage,['id','label','roleIds','domainRole','required','minApprovals','distinctFromAuthor','distinctFromEarlierStages'],'Review stage');assert(validId(stage.id)&&!stages.has(stage.id)&&bounded(stage.label,120)&&Array.isArray(stage.roleIds)&&stage.roleIds.length>0&&new Set(stage.roleIds).size===stage.roleIds.length&&stage.roleIds.every(id=>ids.has(id)),'Each stage needs a unique identifier, title and existing eligible roles.');assert(['reviewer','approver'].includes(stage.domainRole)&&['required','distinctFromAuthor','distinctFromEarlierStages'].every(key=>typeof stage[key]==='boolean')&&Number.isSafeInteger(stage.minApprovals)&&stage.minApprovals>=1&&stage.minApprovals<=10,'Review stages require explicit responsibility, quorum and independence rules.');stages.add(stage.id);}
 }catch(error){errors.push(error.message);}return {valid:!errors.length,errors};
}
const matches=(row,subject)=>row.subjectId===subject.id&&row.subjectSha256===subject.sha256;
export function evaluateReviewSignoffs({policy,policyRevision,subject,approvals=[],authorId}={}){
 const checked=validateReviewSignoffPolicy(policy);assert(checked.valid,checked.errors[0]);assert(object(subject)&&validId(subject.id)&&/^[a-f0-9]{64}$/.test(subject.sha256||'')&&Number.isSafeInteger(policyRevision)&&policyRevision>=1,'Evaluate an exact subject digest and policy revision.');assert(Array.isArray(approvals)&&approvals.length<=10000,'Review receipts exceed the bounded limit.');
 assert(authorId===undefined||authorId===null||validId(authorId),'Identify the exact retained author.');assert(!policy.stages.some(stage=>stage.distinctFromAuthor)||validId(authorId),'This review sequence requires the exact retained author identity.');
 const eligible=approvals.filter(row=>object(row)&&validId(row.id)&&row.policyId===policy.id&&row.policyRevision===policyRevision&&matches(row,subject)&&row.decision==='approved'&&row.authorId===(authorId||null)&&row.authorship==='human_attestation'),earlier=new Set(),stages=[];let requiredEarlierComplete=true;
 for(const stage of policy.stages){const accepted=[],seen=new Set();for(const row of eligible.filter(row=>row.stageId===stage.id)){
   const assignment=policy.assignments.find(item=>item.userId===row.actorId);if(!assignment||!assignment.roleIds.includes(row.roleId)||!stage.roleIds.includes(row.roleId)||seen.has(row.actorId)||stage.distinctFromAuthor&&row.actorId===authorId||stage.distinctFromEarlierStages&&earlier.has(row.actorId)||!bounded(row.statement,4000)||!Number.isFinite(Date.parse(row.at)))continue;seen.add(row.actorId);accepted.push(row);
  }const complete=requiredEarlierComplete&&accepted.length>=stage.minApprovals;stages.push({id:stage.id,label:stage.label,required:stage.required,domainRole:stage.domainRole,minApprovals:stage.minApprovals,acceptedApprovals:requiredEarlierComplete?accepted:[],complete,blockedByEarlierStage:!requiredEarlierComplete});if(complete)for(const row of accepted)earlier.add(row.actorId);if(stage.required&&!complete)requiredEarlierComplete=false;
 }
 return {policyId:policy.id,policyRevision,subject:copy(subject),complete:stages.every(stage=>!stage.required||stage.complete),stages,nextStage:stages.find(stage=>stage.required&&!stage.complete)?.id||null,authority:'Configured professional responsibility only; existing resource permissions are required independently.'};
}
export function validateReviewSignoff({policy,policyRevision,subject,approvals=[],authorId,actorId,roleId,stageId,statement,attested,domainRoles}={}){
 const state=evaluateReviewSignoffs({policy,policyRevision,subject,approvals,authorId}),stage=policy.stages.find(row=>row.id===stageId),result=state.stages.find(row=>row.id===stageId);assert(stage&&result&&!result.blockedByEarlierStage,'Complete required earlier review stages first.');assert(attested===true&&bounded(statement,4000),'An explicit substantive sign-off statement is required.');assert(validId(actorId)&&policy.assignments.some(row=>row.userId===actorId&&row.roleIds.includes(roleId))&&stage.roleIds.includes(roleId),'The identified user is not assigned an eligible professional role for this stage.');assert(!stage.distinctFromAuthor||actorId!==authorId,'This stage requires someone other than the author.');const earlierIds=state.stages.slice(0,policy.stages.indexOf(stage)).flatMap(row=>row.acceptedApprovals.map(receipt=>receipt.actorId));assert(!stage.distinctFromEarlierStages||!earlierIds.includes(actorId),'This stage requires an independent person from earlier sign-offs.');if(domainRoles!==undefined)assert(Array.isArray(domainRoles)&&domainRoles.includes(stage.domainRole),'A professional title does not grant the existing reviewer or approver access responsibility.');return {valid:true,stage:copy(stage),state};
}
