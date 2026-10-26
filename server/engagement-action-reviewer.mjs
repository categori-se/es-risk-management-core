// One action reviewer assignment shared by ordinary and monitoring closure.
// Authority comes from the current command or the retained mandate/audit event;
// assignment labels never create authentication or a professional attestation.
import {actionReviewerFields,assertEngagement as assert,boundedText as text,stableJson} from '../src/lib/engagement-domain.js';
export const retainedActionReviewer=record=>Object.fromEntries(actionReviewerFields.filter(key=>record?.[key]!==undefined).map(key=>[key,record[key]]));
const states=record=>[...(record.history||[]),record];
export const actionRecordEvent=(view,record)=>view.audit?.filter(event=>event.changedIds?.includes(record.id))[record.revision-1-(record.origin?1:0)];
const eventFor=actionRecordEvent;
export const actionMandateAt=(view,event)=>event?(view.mandateHistory||view.engagement?.mandateHistory||[]).find(entry=>entry.revision>=event.revision)?.mandate||view.engagement||view:view.engagement||view;
export function assignActionReviewer({command,previous,core,actorId,provenance,at}){
 for(const key of actionReviewerFields.slice(1))assert(command[key]===undefined||previous&&command[key]===previous[key],'Action reviewer assignment attribution is server-owned.',403);
 const retained=retainedActionReviewer(previous);if(command.reviewer===undefined||command.reviewer===previous?.reviewer)return retained;
 const reviewer=text(command.reviewer,'Assigned action reviewer',{required:true,max:300});assert(core.roles.reviewer.includes(reviewer),'Choose a current assigned engagement reviewer for this action.',403);
 assert(provenance.kind==='human','AI action candidates cannot assign or replace human reviewer authority.',403);
 assert(previous?.status!=='closed','A closed action retains its original reviewer assignment.',409);
 if(previous?.reviewer)assert(core.roles.reviewer.includes(actorId),'Only a current engagement reviewer may explicitly reassign an action reviewer.',403);
 const statement=text(command.reviewerStatement,'Action reviewer assignment rationale',{required:true,max:4000});assert(statement.length>=20,'Record the reason for this action reviewer assignment in at least20 characters.');
 return {reviewer,reviewerAssignedBy:actorId,reviewerAssignedAt:at,reviewerAssignmentStatement:statement};
}
export function validateActionReviewer(action,view){
 let previous;
 for(const state of states(action)){
  const value=retainedActionReviewer(state),present=Object.keys(value).length;
  if(!present){assert(!previous?.reviewer,'Retain an assigned action reviewer; use an explicit authorized replacement.');previous=state;continue;}
  assert(present===actionReviewerFields.length,'Keep complete action reviewer assignment attribution.');text(state.reviewer,'Assigned action reviewer',{required:true,max:300});text(state.reviewerAssignedBy,'Action reviewer assigner',{required:true,max:300});text(state.reviewerAssignmentStatement,'Action reviewer assignment rationale',{required:true,max:4000});assert(state.reviewerAssignmentStatement.trim().length>=20&&typeof state.reviewerAssignedAt==='string'&&Number.isFinite(Date.parse(state.reviewerAssignedAt))&&new Date(state.reviewerAssignedAt).toISOString()===state.reviewerAssignedAt,'Retain the substantive action reviewer assignment statement and timestamp.');
  if(previous?.reviewer===state.reviewer)assert(stableJson(value)===stableJson(retainedActionReviewer(previous)),'Unchanged action reviewer assignment attribution remains immutable.');
  else{
   const event=eventFor(view,state),authority=actionMandateAt(view,event),by=state.reviewerAssignedBy;assert(authority.roles.reviewer.includes(state.reviewer),'An action reviewer must have belonged to the engagement reviewer role when assigned.');assert((previous?.reviewer?authority.roles.reviewer:[...authority.roles.preparer,...authority.roles.reviewer]).includes(by),'Action reviewer reassignment requires its retained authorized practitioner role.');assert(state.provenance?.kind==='human'&&by===state.updatedBy&&(!event||event.actorId===by&&['action-save','action-consolidate'].includes(event.command)),'Reviewer assignment must retain its actual human author and assignment command.');assert(previous?.status!=='closed','A closed action retains its original reviewer assignment.');assert(Date.parse(state.reviewerAssignedAt)>=Date.parse(previous?.updatedAt||view.engagement?.createdAt||view.createdAt)&&Date.parse(state.reviewerAssignedAt)<=Date.parse(state.updatedAt)&&(!event||Date.parse(state.reviewerAssignedAt)<=Date.parse(event.at)),'Action reviewer assignment time differs from its retained working revision.');
  }
  previous=state;
 }
 if(action.status==='closed'&&action.reviewer){const closed=states(action).find(state=>state.status==='closed'&&state.closedAt===action.closedAt&&state.closedBy===action.closedBy),authority=actionMandateAt(view,eventFor(view,closed));assert(action.closedBy===action.reviewer&&authority.roles.reviewer.includes(action.closedBy),'The assigned action reviewer must perform the human closure review.');}
}
export function assertAssignedActionReviewer(action,actorId){assert(!action.reviewer||action.reviewer===actorId,'The assigned action reviewer must verify this action before closure.',403);}
export function actionAtVerification(view,verification){
 const action=view.actions.find(row=>row.id===verification.targetId);if(!action)return;
 const decision=eventFor(view,verification);if(!decision)return action;
 return states(action).filter(state=>{const event=eventFor(view,state);return event&&event.revision<=decision.revision;}).at(-1)||action;
}
