import {PILOT_PHASES, PRACTITIONER_TASKS} from '../lib/professional-qualification.js';

/** A foreground measurement form; observations never overwrite canonical work. */
export function mountAssignmentPilot(root,{load,save,saveObservation,verifyHandover,getOriginals=()=>[],onError=()=>{}}={}){
 const document=root.ownerDocument;let disposed=false,busy=false,generation=0;
 const el=(tag,text,parent,props={})=>{const node=document.createElement(tag);if(text!==null)node.textContent=text;Object.assign(node,props);parent?.append(node);return node;};
  const field=(parent,label,type='text',value='')=>{const wrap=el('label',label,parent),node=el(type==='textarea'?'textarea':'input',null,wrap,{...(type==='textarea'?{}:{type})});if(type==='checkbox')node.checked=value===true;else node.value=value;return node;};
 function observationForm(parent,state){
  if(!saveObservation)return;
  const details=el('details',null,parent);el('summary','Observe the ten practitioner tasks',details);
  el('p','Record only work actually observed. Keep private participant references and evidence in this account. Active seconds include correction and assistance time; record waiting separately. This record does not approve work or verify anyone’s identity.',details);
  const form=el('form',null,details);form.dataset.practitionerObservation='';
  const select=(parent,label,choices)=>{const wrap=el('label',label,parent),node=el('select',null,wrap);for(const [value,title] of choices)el('option',title,node,{value});return node;};
  const required=(parent,label,type='text')=>{const node=field(parent,label,type);node.required=true;return node;};
  const mode=select(form,'Observation basis',[['synthetic_rehearsal','Synthetic rehearsal'],['actual_practitioner','Actual observed practitioner']]);
  const participant=required(form,'Participant reference'),observer=required(form,'Observer reference'),consent=field(form,'Consent record reference (required for an actual observation)'),commit=required(form,'Exact source commit (40 lowercase hexadecimal characters)'),profile=required(form,'Observed deployment profile'),start=required(form,'Started at (ISO date/time)'),end=required(form,'Ended at (ISO date/time)'),unfamiliar=field(form,'Participant was unfamiliar with the app','checkbox');
  commit.pattern='[a-f0-9]{40}';mode.addEventListener('change',()=>{consent.required=mode.value==='actual_practitioner';});
  const rows=PRACTITIONER_TASKS.map(({id:taskId,label})=>{
   const group=el('details',null,form);el('summary',label,group);
   const outcome=select(group,'Outcome',[['not_attempted','Not attempted'],['completed','Completed without help'],['assisted','Completed with assistance'],['failed','Failed']]);
   const numbers=Object.fromEntries([['activeSeconds','Active seconds'],['waitSeconds','Waiting seconds'],['correctionSeconds','Correction seconds within active time'],['assistanceSeconds','Assistance seconds within active time'],['corrections','Substantive correction count']].map(([key,label])=>{const node=field(group,label,'number','0');node.min='0';node.step='1';node.required=true;return [key,node];}));
   const evidence=required(group,'Task evidence reference, or reason not attempted'),feedback=required(group,'Task feedback','textarea');
   const failure=el('details',null,group);el('summary','Failure and retest evidence',failure);
   const failureFields=Object.fromEntries([['symptom','Observed failure'],['impact','Impact'],['reproduction','Sanitized reproduction'],['evidenceReference','Failure evidence reference'],['retestReference','Retest reference (if repeated after a fix)']].map(([key,label])=>[key,field(failure,label,key==='reproduction'?'textarea':'text')]));
   return {taskId,outcome,numbers,evidence,feedback,failureFields};
  });
  const overall=required(form,'Overall participant feedback','textarea'),priority=required(form,'Highest priority improvement','textarea'),status=el('p','',form,{role:'status'}),submit=el('button','Retain ten-task observation',form,{type:'submit'});
  form.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();if(busy)return;busy=true;submit.disabled=true;void(async()=>{try{
   await saveObservation({...state.pilotContext,observationMode:mode.value,participantId:participant.value,observerId:observer.value,consentReference:consent.value,sourceCommit:commit.value,deploymentProfile:profile.value,startedAt:start.value,endedAt:end.value,unfamiliarPractitioner:unfamiliar.checked,tasks:rows.map(row=>{const failure=Object.fromEntries(Object.entries(row.failureFields).map(([key,node])=>[key,node.value.trim()]));return {taskId:row.taskId,outcome:row.outcome.value,...Object.fromEntries(Object.entries(row.numbers).map(([key,node])=>[key,Number(node.value)])),evidenceReference:row.evidence.value,feedback:row.feedback.value,failures:Object.values(failure).some(Boolean)?[failure]:[]};}),overallFeedback:overall.value,priorityFix:priority.value});
   if(!disposed)await render();
  }catch(error){if(!disposed){status.textContent=error.message;status.setAttribute('role','alert');onError(error);}}finally{busy=false;submit.disabled=false;}})();});
 }
 async function render(){if(disposed)return;const turn=++generation,state=await load();if(disposed||turn!==generation)return;root.replaceChildren();const details=el('details',null,root);el('summary','Measure assignment effort and verify handover',details);el('p','Record observed active time for the same evidence and acceptance criteria in this app and in Word/Excel. Include corrections, independent review, output production and handover. Measurements are practitioner attestations.',details);
  el('p',`Dataset SHA256 ${state.pilotContext.datasetSha256}`,details);el('p',state.authority||'',details);
  for(const comparison of state.comparisons||[])el('p',comparison.comparable?`Observed active time: app ${comparison.appActiveSeconds}s; Word/Excel ${comparison.baselineActiveSeconds}s; saved ${comparison.savedSeconds}s. Exact originals ${comparison.handoverVerified?'verified':'awaiting verification'}. Full assignment handover requires the separate project, Template Studio and policy-original backups.`:comparison.reason,details);
  const form=el('form',null,details),methodLabel=el('label','Method',form),method=el('select',null,methodLabel);for(const [value,title] of [['esia_review','E&S Review'],['word_excel','Word and Excel']])el('option',title,method,{value});
  const phases=PILOT_PHASES.map(phase=>{const group=el('fieldset',null,form);el('legend',phase.replaceAll('_',' '),group);const seconds=field(group,'Observed active seconds','number'),corrections=field(group,'Substantive corrections','number','0'),evidence=field(group,'Measurement evidence reference');seconds.min='0';seconds.required=true;corrections.min='0';evidence.required=true;return {phase,seconds,corrections,evidence};});
  const accepted=field(form,'Independent review accepted this work','checkbox'),reviewReference=field(form,'Independent review record reference'),unfamiliar=field(form,'Practitioner was unfamiliar with the app','checkbox'),assistance=field(form,'Instruction or assistance seconds','number','0'),receipt=field(form,'Verified handover receipt id (optional)');assistance.min='0';
  const status=el('p','',details,{role:'status'}),submit=el('button','Retain assignment measurement',form,{type:'submit'});
  form.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();if(busy)return;busy=true;submit.disabled=true;void(async()=>{try{await save({...state.pilotContext,method:method.value,phases:phases.map(v=>({phase:v.phase,activeSeconds:Number(v.seconds.value),corrections:Number(v.corrections.value),evidenceReference:v.evidence.value})),reviewAccepted:accepted.checked,reviewEvidenceReference:reviewReference.value,unfamiliarPractitioner:unfamiliar.checked,assistanceSeconds:Number(assistance.value),...(receipt.value?{handoverReceiptId:receipt.value}:{})});if(!disposed)await render();}catch(error){if(disposed)return;status.textContent=error.message;status.setAttribute('role','alert');onError(error);}finally{busy=false;submit.disabled=false;}})();});
  if(verifyHandover){const button=el('button','Reopen originals and verify exact handover hashes',details,{type:'button'});button.addEventListener('click',()=>{if(busy)return;busy=true;button.disabled=true;void(async()=>{try{const value=await verifyHandover({datasetSha256:state.pilotContext.datasetSha256,artifacts:getOriginals()});if(disposed)return;status.textContent=`${value.passed?'Declared original hashes verified':'Original hash verification failed'} · receipt ${value.id}. Verification reopens originals in this account; repeat in the destination workspace after restoring.`;}catch(error){if(disposed)return;status.textContent=error.message;status.setAttribute('role','alert');onError(error);}finally{busy=false;button.disabled=false;}})();});}
  observationForm(details,state);
  for(const record of state.records||[]){
   if(record.format==='esia-practitioner-task-observation'){
    const retained=el('details',null,details);el('summary',`Ten-task observation · ${record.observationMode} · ${record.createdAt}`,retained);
    el('p',`Participant ${record.participantId} · observer ${record.observerId} · recorder ${record.recorderId}. Declared references; no independent identity or professional acceptance.`,retained);
    el('p',`${record.startedAt} – ${record.endedAt} · ${record.deploymentProfile} · source ${record.sourceCommit} · dataset ${record.datasetSha256} · criteria ${record.acceptanceCriteriaSha256} · protocol ${record.observationProtocolSha256}`,retained);
    for(const task of record.tasks){
     const row=el('details',null,retained);el('summary',`${PRACTITIONER_TASKS.find(row=>row.id===task.taskId)?.label||task.taskId}: ${task.outcome}`,row);
     el('p',`${task.activeSeconds}s active, ${task.waitSeconds}s waiting, ${task.correctionSeconds}s corrections, ${task.assistanceSeconds}s assistance; ${task.corrections} corrections. ${task.feedback}`,row);
     el('p',`Evidence/reason: ${task.evidenceReference}`,row);
     for(const failure of task.failures)el('p',`${failure.symptom}. Impact: ${failure.impact}. Reproduction: ${failure.reproduction}. Evidence: ${failure.evidenceReference}.${failure.retestReference?` Retest: ${failure.retestReference}`:''}`,row);
    }
    el('p',`Feedback: ${record.overallFeedback}. Priority: ${record.priorityFix}. Record ${record.id}`,retained);
   }else el('p',`${record.method||'Handover verification'} · ${record.operatorId||record.verifiedBy} · ${record.createdAt} · ${record.id}`,details);
  }
 }
 const ready=render().catch(error=>{if(!disposed)root.textContent=error.message;onError(error);});return {ready,refresh:render,dispose(){disposed=true;generation++;root.replaceChildren();}};
}
