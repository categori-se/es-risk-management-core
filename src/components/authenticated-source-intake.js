const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value);
export const authenticatedSourceIntakeLimits=Object.freeze({files:10,fileBytes:25*1024*1024,totalBytes:64*1024*1024});
export function createAuthenticatedSourceIntakeState(){return {items:[],busy:false,message:'',error:false,attempt:null,conflict:false,epoch:0,sequence:0};}
export function clearAuthenticatedSourceIntakeState(state){state.epoch=(state.epoch||0)+1;for(const item of state.items||[])item.file=null;state.items=[];state.attempt=null;state.conflict=false;state.busy=false;state.message='';state.error=false;}

/** Files and successful receipts stay in this page's memory only. Upload and
 * source attachment are separate acknowledged operations; every retry is explicit. */
export function mountAuthenticatedSourceIntake(root,{authority,getEngagement,getProject,request,state=createAuthenticatedSourceIntakeState(),onSaved=()=>{},onBusyChange=()=>{}}={}){
 if(!root?.ownerDocument||authority?.mode!=='authenticated'||![getEngagement,getProject,request,authority.assertCurrent].every(fn=>typeof fn==='function'))throw new TypeError('Use a fixed authenticated engagement intake context.');
 const scope={userId:authority.userId,accountId:authority.accountId,projectId:authority.projectId,engagementId:authority.engagementId};
 if(!Object.values(scope).every(id))throw new TypeError('Use exact authenticated source intake identities.');
 let disposed=false;
 const canUpload=()=>{authority.assertCurrent();return typeof authority.uploadDocument==='function'&&authority.permissions?.includes('edit')&&authority.roles?.some(role=>['preparer','reviewer'].includes(role));};
 const assertScope=epoch=>{authority.assertCurrent();if(epoch!==state.epoch)throw Error('This document batch has closed.');const e=getEngagement(),p=getProject();if(e?.id!==scope.engagementId||e.projectId!==scope.projectId||e.accountId!==scope.accountId||p?.id!==scope.projectId||p.accountId!==scope.accountId)throw Error('The authenticated document context changed.');if(!canUpload())throw Error('Document intake requires the assigned preparer or reviewer with edit access.');};
 const show=()=>state._render?.();
 const pending=()=>state.items.filter(item=>item.status!=='added');
 const status=(message,error=false)=>{state.message=message;state.error=error;show();};
 const canUseRefreshedRevision=()=>state.conflict&&state.attempt&&(getEngagement()?.revision!==state.attempt.expectedRevision||(getEngagement()?.serverAuthority?.headSha256||'')!==state.attempt.headSha256);
 const inProject=item=>getProject()?.resources?.some(resource=>resource.id===item.receipt?.artifactId&&resource.versions?.some(version=>version.sha256===item.receipt.sha256));
 function rendered(){
  if(disposed)return;
  let permitted=false;try{permitted=canUpload();}catch{root.replaceChildren();return;}
  root.innerHTML=`<section class="ew-form" aria-label="Add original documents"><h3>Add original documents</h3><p>Upload up to ten files per batch, 25 MiB per file and 64 MiB in total. Add the retained originals to this engagement, then review their descriptions and index their evidence in the existing register.</p>${permitted?`<label><span>Choose original documents</span><input type="file" multiple data-authenticated-source-files${state.busy||state.attempt?' disabled':''}></label><ol class="ew-records">${state.items.map(item=>`<li class="ew-record" data-authenticated-source-item="${item.key}"><strong>${h(item.name)}</strong><p>${(item.size/1024/1024).toFixed(2)} MiB · ${h({pending:'Ready to upload',uploading:'Uploading',uploaded:'Uploaded; ready to add',added:'Added to this engagement'}[item.status]||'Ready to upload')}</p>${item.receipt?`<p class="ew-small">SHA256 <code>${h(item.receipt.sha256)}</code></p>`:''}${item.status!=='added'?`<button type="button" data-authenticated-source-action="remove" data-key="${item.key}"${state.busy||state.attempt?' disabled':''}>Remove from batch</button>`:''}</li>`).join('')}</ol><div class="ew-toolbar"><button type="button" data-authenticated-source-action="upload-add"${state.busy||!pending().length?' disabled':''}>Upload and add originals</button>${state.items.some(item=>item.status==='uploaded')?`<button type="button" data-authenticated-source-action="attach-ready"${state.busy?' disabled':''}>Add ready originals</button>`:''}${canUseRefreshedRevision()?`<p>Review the refreshed saved record before retrying: previous assessment revision ${h(state.attempt.expectedRevision)}; current revision ${h(getEngagement().revision)}. The retained upload receipts stay the same.</p><button type="button" data-authenticated-source-action="use-refreshed-revision"${state.busy?' disabled':''}>Use refreshed revision and add ready originals</button>`:''}</div>`:'<p>Document intake is available to assigned preparers and reviewers with edit access.</p>'}<p role="${state.error?'alert':'status'}" data-authenticated-source-status>${h(state.message)}</p></section>`;
 }
 state._render=rendered;
 function choose(files){
  if(disposed||state.busy)return;assertScope(state.epoch);
  const chosen=[...files];if(!chosen.length)return;
  const existing=state.items.every(item=>item.status==='added')?[]:state.items;
  if(state.attempt)throw Error('Retry the ready originals before changing this batch.');
  const additions=chosen.filter(file=>!existing.some(item=>item.file===file));
  if(existing.length+additions.length>authenticatedSourceIntakeLimits.files)throw Error('Choose up to ten files in this batch.');
  let total=existing.reduce((sum,item)=>sum+item.size,0);
  for(const file of additions){if(typeof file.name!=='string'||!file.name.length||file.name.length>180||/[\x00-\x1f\x7f]/.test(file.name)||!Number.isSafeInteger(file.size)||file.size<1||file.size>authenticatedSourceIntakeLimits.fileBytes)throw Error('Choose named original files from 1 byte to 25 MiB each.');total+=file.size;}
  if(total>authenticatedSourceIntakeLimits.totalBytes)throw Error('Keep this batch within 64 MiB.');
  state.items=[...existing,...additions.map(file=>({key:++state.sequence,name:file.name,size:file.size,file,receipt:null,status:'pending'}))];
  status(`${state.items.length} original${state.items.length===1?'':'s'} ready for an explicit upload.`);
 }
 function acknowledge(result,items){
  const e=result?.engagement,p=result?.project;
  if(e?.id!==scope.engagementId||e.projectId!==scope.projectId||e.accountId!==scope.accountId||p?.id!==scope.projectId||p.accountId!==scope.accountId||!Number.isSafeInteger(e.revision)||e.revision<1||
    items.some(item=>!p.resources?.some(resource=>resource.id===item.receipt.artifactId&&resource.versions?.some(version=>version.sha256===item.receipt.sha256))))throw Error('The server acknowledgement did not contain these exact originals in this engagement.');
 }
 async function attach(epoch){
  assertScope(epoch);
  for(const item of state.items.filter(item=>item.status==='uploaded'&&inProject(item))){item.status='added';item.file=null;}
  const ready=state.items.filter(item=>item.status==='uploaded');
  if(!ready.length){state.attempt=null;state.conflict=false;status('The uploaded originals are already in this engagement’s register.');return;}
  const ids=[...new Set(ready.map(item=>item.receipt.artifactId))];
  if(!state.attempt)state.attempt={expectedRevision:getEngagement().revision,artifact_ids:ids,headSha256:getEngagement().serverAuthority?.headSha256||''};
  if(JSON.stringify(state.attempt.artifact_ids)!==JSON.stringify(ids))throw Error('Continue the same ready-original batch before adding another selection.');
  status(`Adding ${ids.length} retained original${ids.length===1?'':'s'} to this engagement…`);
  const result=await request(`/api/engagements/${encodeURIComponent(scope.engagementId)}/source-attachments`,{method:'POST',body:{expectedRevision:state.attempt.expectedRevision,artifact_ids:[...ids]}});
  assertScope(epoch);if(disposed)throw Error('The batch is paused. Continue when the document panel is open.');acknowledge(result,ready);
  for(const item of ready){item.status='added';item.file=null;}state.attempt=null;state.conflict=false;
  status(`${ids.length} original${ids.length===1?'':'s'} added. Review their metadata and index the evidence when ready.`);
  await onSaved(result);
 }
 async function start(onlyReady=false){
  if(disposed||state.busy)return;
  const epoch=state.epoch;assertScope(epoch);state.busy=true;onBusyChange(true);show();
  try{
   if(!onlyReady&&!state.attempt)for(const item of pending()){
    if(item.receipt)continue;assertScope(epoch);if(disposed)throw Error('The batch is paused. Continue when the document panel is open.');
    item.status='uploading';status(`Uploading ${item.name}…`);
    const receipt=await authority.uploadDocument(item.file);assertScope(epoch);
    if(!id(receipt?.artifactId)||receipt.filename!==item.name||!/^[a-f0-9]{64}$/.test(receipt.sha256||''))throw Error('The upload did not return an exact verified original receipt.');
    item.receipt={artifactId:receipt.artifactId,filename:receipt.filename,sha256:receipt.sha256};item.status='uploaded';
    if(disposed)throw Error('The batch is paused. Its uploaded original is ready to add.');show();
   }
   await attach(epoch);
  }catch(error){if(epoch===state.epoch){const adjustable=Boolean(state.attempt&&[400,413].includes(error.status));if(adjustable)state.attempt=null;state.conflict=error.status===409;for(const item of state.items)if(item.status==='uploading')item.status='pending';status(`${error.message||'The batch stopped.'} Successful uploads remain ready for an explicit retry.${adjustable?' Remove originals to choose a smaller batch, then explicitly add the ready originals.':state.conflict?' Refresh the saved record and review its changes before choosing a revised attachment attempt.':''}`,true);}}
  finally{if(epoch===state.epoch){state.busy=false;onBusyChange(false);show();}}
 }
 const change=event=>{if(!event.target.matches('[data-authenticated-source-files]'))return;try{choose(event.target.files);}catch(error){status(error.message,true);}event.target.value='';};
 const click=event=>{const button=event.target.closest('[data-authenticated-source-action]');if(!button||!root.contains(button)||button.disabled)return;event.preventDefault();const action=button.dataset.authenticatedSourceAction;
  if(action==='remove'){if(state.busy||state.attempt)return;const index=state.items.findIndex(item=>String(item.key)===button.dataset.key);if(index>=0){state.items[index].file=null;state.items.splice(index,1);status('Original removed from this batch.');}}
  else if(action==='use-refreshed-revision'){if(state.busy||!canUseRefreshedRevision())return;state.attempt=null;state.conflict=false;void start(true).catch(error=>status(error.message,true));}
  else if(action==='upload-add'||action==='attach-ready')void start(action==='attach-ready').catch(error=>status(error.message,true));
 };
 root.addEventListener('change',change);root.addEventListener('click',click);rendered();
 return {choose,dispose({retainQueue=false}={}){if(disposed)return;disposed=true;root.removeEventListener('change',change);root.removeEventListener('click',click);if(state._render===rendered)delete state._render;if(!retainQueue){clearAuthenticatedSourceIntakeState(state);onBusyChange(false);}root.replaceChildren();}};
}
