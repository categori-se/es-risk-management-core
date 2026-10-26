import {mountOversightWorkspace} from './oversight-workspace.js';
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Same-origin local adapter; a selected account is captured into every API
 * instance. It is never inferred from a project/institution label. */
export function createLocalOversightApi({accountId='local-default',fetchImpl=globalThis.fetch}={}) {
  const request=async(path,{method='GET',body,binary=false}={})=>{
    const response=await fetchImpl(path,{method,cache:'no-store',credentials:'omit',headers:{'X-ESIA-Workspace':'local','X-ESIA-Account':accountId,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok){let detail;try{detail=(await response.json()).error;}catch{}throw Object.assign(new Error(detail||'The local oversight operation failed.'),{status:response.status});}
    return binary?response.blob():response.json();
  };
  const projectPath=id=>`/api/oversight/projects/${encodeURIComponent(id)}`;
  return {
    scopeKey:accountId,
    projectHref:id=>`/?account=${encodeURIComponent(accountId)}&project=${encodeURIComponent(id)}#lw-documents`,
    projects:()=>request('/api/projects'), getProject:id=>request(`/api/projects/${encodeURIComponent(id)}`),
    get:id=>request(projectPath(id)),mutate:(id,body)=>request(`${projectPath(id)}/commands`,{method:'POST',body}),
    history:(id,recordId)=>request(`${projectPath(id)}/history/${encodeURIComponent(recordId)}`),
    portfolio:filters=>request(`/api/oversight/portfolio?${new URLSearchParams(Object.entries(filters||{}).filter(([,v])=>v!==undefined&&v!==null&&v!==''))}`),
    snapshots:async()=>(await request('/api/oversight/snapshots')).snapshots,
    issueSnapshot:body=>request('/api/oversight/snapshots',{method:'POST',body}),getSnapshot:id=>request(`/api/oversight/snapshots/${encodeURIComponent(id)}`),
    exportSnapshot:(id,format)=>request(`/api/oversight/snapshots/${encodeURIComponent(id)}/export?format=${encodeURIComponent(format)}`,{binary:true})
  };
}

export function mountLocalOversight(root,{invalidation,fetchImpl=globalThis.fetch}={}) {
  root.classList.add('local-workspace','local-oversight');
  const query=new URL(root.ownerDocument.defaultView.location.href).searchParams;
  let selected=query.get('account')||'local-default',accounts=[],mounted,disposed=false,pendingAccount;
  root.innerHTML=`<section class="lw-panel"><div class="lw-section-heading"><div><p class="lw-eyebrow">Local E&S workbench</p><h2>Account and evidence</h2><p>Choose the custody account for this oversight review.</p></div><nav aria-label="Oversight views"><a href="/oversight-consolidation" target="_blank" rel="noopener">Consolidated portfolio</a> · <a href="/oversight-comparison" target="_blank" rel="noopener">Period comparisons</a> · <a href="/oversight-backup" target="_blank" rel="noopener">Oversight backups</a> · <a data-oversight-projects-link href="/" target="_blank" rel="noopener">Projects and evidence</a></nav></div><label>Record-owning storage account<select data-oversight-account aria-label="Record-owning storage account"><option>Opening accounts…</option></select></label><p data-oversight-account-status role="status"></p><div data-oversight-account-choice hidden><p>There are unsaved oversight changes in this account.</p><button type="button" data-oversight-account-discard>Discard drafts and switch account</button><button type="button" data-oversight-account-stay>Keep working here</button></div></section><div data-local-oversight-host></div>`;
  const control=root.querySelector('[data-oversight-account]'),status=root.querySelector('[data-oversight-account-status]'),choice=root.querySelector('[data-oversight-account-choice]');
  const select=async(id,discardDrafts=false)=>{
    if(disposed)return;if(!accounts.some(account=>account.id===id))throw Error('Choose an available storage account.');
    if(mounted?.hasUnsavedChanges?.()&&!discardDrafts){pendingAccount=id;control.value=selected;choice.hidden=false;return;}
    selected=id;control.value=id;choice.hidden=true;pendingAccount=null;
    const projectsLink=root.querySelector('[data-oversight-projects-link]');projectsLink.href=`/?account=${encodeURIComponent(id)}`;
    const account=accounts.find(account=>account.id===id);status.textContent=`${account.organization||account.name} · private local account records. Workflow approval records practitioner review; it does not establish an institutional appointment.`;
    const api=createLocalOversightApi({accountId:id,fetchImpl});
    const url=new URL(root.ownerDocument.defaultView.location.href);url.searchParams.set('account',id);if(mounted)url.searchParams.delete('project');root.ownerDocument.defaultView.history.replaceState({},'',url);
    if(mounted)await mounted.setContext({api,discardDrafts,initialProjectId:undefined});
    else mounted=mountOversightWorkspace(root.querySelector('[data-local-oversight-host]'),{api,initialProjectId:query.get('project')||undefined});
  };
  const change=event=>{if(event.target===control)select(control.value).catch(error=>{status.textContent=error.message;});};
  const click=event=>{if(event.target.closest('[data-oversight-account-stay]')){pendingAccount=null;choice.hidden=true;}if(event.target.closest('[data-oversight-account-discard]')&&pendingAccount)select(pendingAccount,true).catch(error=>{status.textContent=error.message;});};
  root.addEventListener('change',change);root.addEventListener('click',click);
  const ready=(async()=>{
    const response=await fetchImpl('/api/storage-accounts',{headers:{'X-ESIA-Workspace':'local'},cache:'no-store',credentials:'omit'});
    if(!response.ok)throw Error('The local account directory could not be opened.');accounts=await response.json();if(disposed)return;
    control.innerHTML=accounts.map(a=>`<option value="${h(a.id)}">${h(a.name)}</option>`).join('');
    if(!accounts.some(a=>a.id===selected))throw Error('This storage account is unavailable.');await select(selected);await mounted.ready;
  })().catch(error=>{if(!disposed)status.textContent=error.message;});
  const result={ready,dispose(){if(disposed)return;disposed=true;mounted?.dispose();root.removeEventListener('change',change);root.removeEventListener('click',click);}};
  invalidation?.then(result.dispose);return result;
}
