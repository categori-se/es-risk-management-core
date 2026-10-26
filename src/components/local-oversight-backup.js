const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const archiveLimit=16*1024*1024;

export function createLocalOversightBackupApi({fetchImpl=globalThis.fetch}={}) {
  async function request(path,{accountId,body,binary=false}={}) {
    const response=await fetchImpl(path,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'omit',headers:{'X-ESIA-Workspace':'local',...(accountId?{'X-ESIA-Account':accountId}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok){let detail;try{detail=(await response.json()).error;}catch{}throw Object.assign(Error(detail||'The oversight backup operation failed.'),{status:response.status});}
    return binary?response.blob():response.json();
  }
  const path=projectId=>`/api/oversight/projects/${encodeURIComponent(projectId)}`;
  return {
    accounts:()=>request('/api/storage-accounts'),projects:accountId=>request('/api/projects',{accountId}),
    get:(accountId,projectId)=>request(path(projectId),{accountId}),
    imports:(accountId,projectId)=>request(`${path(projectId)}/imports`,{accountId}),
    backup:(accountId,projectId)=>request(`${path(projectId)}/backup`,{accountId,binary:true}),
    restore:(accountId,projectId,body)=>request(`${path(projectId)}/restore`,{accountId,body})
  };
}

/** Private project history handover. Uploaded metadata is a preview; the server
 * validates all retained history and current custody before any write. */
export function mountLocalOversightBackup(root,{api,fetchImpl=globalThis.fetch,invalidation}={}) {
  api??=createLocalOversightBackupApi({fetchImpl});
  const view=root.ownerDocument.defaultView,query=new URL(view.location.href).searchParams;
  let disposed=false,sequence=0,fileSequence=0,busy=false,loading=false,accounts=[],projects=[],accountId='',projectId='',bundle=null,archive=null,imports=[];
  const urls=new Set();
  root.classList.add('local-workspace','oversight-workspace');
  root.innerHTML=`<header class="ow-heading"><div><p class="ow-eyebrow">Private oversight history</p><h1>Back up and restore</h1><p>Carry a project's review history and single-project reporting packets to the same custody account.</p></div><nav aria-label="Oversight views"><a href="/oversight" target="_blank" rel="noopener">Project oversight</a> · <a href="/oversight-comparison" target="_blank" rel="noopener">Period comparisons</a></nav></header><p class="ow-context">These private backups include complaint records and historical review assertions. Keep them in protected storage. Source files and project metadata use the separate project package; consolidated and multi-project packets require a full workspace backup.</p><section class="ow-panel"><h2>Choose the owning account and project</h2><label><span>Storage account</span><select data-backup-account><option value="">Choose an account…</option></select></label><label><span>Project account record</span><select data-backup-project><option value="">Choose a project…</option></select></label><div data-backup-destination></div><button type="button" data-backup-refresh>Refresh destination</button><p role="status" aria-live="polite" data-backup-status></p></section><section class="ow-panel"><h2>Save a private history backup</h2><p>Download the exact checkpoint and record history, single-project packets and import receipts. No source document bytes are included.</p><button type="button" data-backup-export>Download oversight backup</button></section><section class="ow-panel"><h2>Review a backup for restoration</h2><p>Restore the account and project package first. Select its matching project above, then review this backup. Restoration accepts an empty oversight history or an identical retained history and checks the saved revision.</p><label><span>Oversight backup JSON (up to 16 MiB)</span><input type="file" accept=".json,application/json" data-backup-file></label><div data-backup-preview></div><button type="button" data-backup-restore>Restore reviewed history</button><div data-backup-result></div></section><section class="ow-panel"><h2>Historical import provenance</h2><p>Imported authorship and review decisions remain historical assertions; an import does not establish institutional authority.</p><div data-backup-imports></div></section>`;
  const accountControl=root.querySelector('[data-backup-account]'),projectControl=root.querySelector('[data-backup-project]'),fileControl=root.querySelector('[data-backup-file]');
  const active=token=>!disposed&&token===sequence;
  const account=()=>accounts.find(item=>item.id===accountId);
  const matching=()=>Boolean(archive&&bundle&&archive.format==='esia-oversight-project-backup'&&archive.packageVersion===1&&archive.accountId===account()?.custodyId&&archive.projectId===projectId);
  function announce(message,error=false){if(disposed)return;const node=root.querySelector('[data-backup-status]');node.textContent=message;node.setAttribute('role',error?'alert':'status');}
  function controls(){if(disposed)return;root.setAttribute('aria-busy',String(busy||loading));for(const node of [accountControl,projectControl,fileControl,root.querySelector('[data-backup-refresh]')])node.disabled=busy;root.querySelector('[data-backup-export]').disabled=busy||loading||!bundle;root.querySelector('[data-backup-restore]').disabled=busy||loading||!matching();}
  function render(){if(disposed)return;
    const project=projects.find(item=>item.id===projectId),destination=root.querySelector('[data-backup-destination]');
    destination.innerHTML=bundle?`<p><strong>${h(account()?.name)} · ${h(project?.name||projectId)}</strong></p><p>Custody <code>${h(account()?.custodyId)}</code><br>Project <code>${h(projectId)}</code> · Current oversight revision ${h(bundle.revision)}</p>`:'<p>Choose a project to inspect its current oversight revision.</p>';
    root.querySelector('[data-backup-preview]').innerHTML=archive?`<dl class="ow-values"><dt>Backup custody</dt><dd><code>${h(archive.accountId)}</code></dd><dt>Project record</dt><dd>${h(archive.projectId)}</dd><dt>Exported</dt><dd>${h(archive.exportedAt)}</dd><dt>Head revision</dt><dd>${h(archive.head?.revision??0)}</dd><dt>Retained checkpoints / record versions / packets</dt><dd>${h(archive.checkpoints?.length??0)} / ${h(archive.recordVersions?.length??0)} / ${h(archive.snapshots?.length??0)}</dd><dt>Archive SHA256</dt><dd><code>${h(archive.sha256)}</code></dd><dt>Omissions</dt><dd>${h((archive.omissions||[]).join('; '))}</dd></dl><p>${matching()?'The destination custody and project identifiers match. The server will validate history, integrity and evidence references before writing.':'Select the account and project with these exact identifiers. This backup cannot be reassigned to another custody account.'}</p>`:'<p>No backup file selected.</p>';
    root.querySelector('[data-backup-imports]').innerHTML=imports.length?imports.map(receipt=>`<article><p>Imported ${h(receipt.importedAt)} by ${h(receipt.importedBy)}<br>Archive <code>${h(receipt.archiveSha256)}</code></p><p>${h(receipt.assertionStatus)}</p><details><summary>Import scope and source verification</summary><pre>${h(JSON.stringify({summary:receipt.summary,verification:receipt.verification},null,2))}</pre></details></article>`).join(''):'<p>No historical imports recorded in this project.</p>';
    controls();
  }
  async function loadProject(){const token=++sequence;root.querySelector('[data-backup-result]').replaceChildren();bundle=null;imports=[];loading=true;render();if(!projectId){loading=false;render();return;}
    try{const [current,history]=await Promise.all([api.get(accountId,projectId),api.imports(accountId,projectId)]);if(!active(token))return;bundle=current;imports=history.imports||[];announce('Destination revision and import history loaded.');}
    catch(error){if(active(token))announce(error.message,true);}finally{if(active(token)){loading=false;render();}}
  }
  async function loadAccount(id,initialProject=''){const token=++sequence;root.querySelector('[data-backup-result]').replaceChildren();accountId=id;projectId='';projects=[];bundle=null;imports=[];loading=true;projectControl.innerHTML='<option value="">Choose a project…</option>';render();if(!id){loading=false;render();return;}
    try{const result=await api.projects(id);if(!active(token))return;projects=result;projectControl.innerHTML='<option value="">Choose a project…</option>'+projects.map(project=>`<option value="${h(project.id)}">${h(project.name)}</option>`).join('');if(initialProject&&projects.some(item=>item.id===initialProject)){projectId=initialProject;projectControl.value=initialProject;await loadProject();}else announce('Choose the project that owns this oversight history.');}
    catch(error){if(active(token))announce(error.message,true);}finally{if(active(token)){loading=false;render();}}
  }
  async function readFile(){const token=++fileSequence;archive=null;root.querySelector('[data-backup-result]').replaceChildren();render();const file=fileControl.files?.[0];if(!file)return;
    try{if(file.size>archiveLimit)throw Error('The oversight backup exceeds 16 MiB.');let source;if(typeof file.text==='function')source=await file.text();else source=await new Promise((resolve,reject)=>{const reader=new view.FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('The backup file could not be read.'));reader.readAsText(file);});
      if(disposed||token!==fileSequence)return;const parsed=JSON.parse(source);if(!parsed||parsed.format!=='esia-oversight-project-backup'||parsed.packageVersion!==1||typeof parsed.accountId!=='string'||typeof parsed.projectId!=='string'||!Array.isArray(parsed.omissions)||parsed.omissions.some(value=>typeof value!=='string'))throw Error('Choose a version 1 ESIA oversight project backup.');archive=parsed;announce('Backup metadata loaded. Review its scope before restoration.');
    }catch(error){if(!disposed&&token===fileSequence)announce(error instanceof SyntaxError?'The backup must contain valid JSON.':error.message,true);}finally{if(!disposed&&token===fileSequence)render();}
  }
  async function download(){if(busy||loading||!bundle)return;busy=true;controls();const token=sequence;
    try{const blob=await api.backup(accountId,projectId);if(!active(token))return;const url=view.URL.createObjectURL(blob);urls.add(url);const link=root.ownerDocument.createElement('a');link.href=url;link.download=`oversight-backup-${projectId}.json`;root.append(link);link.click();link.remove();announce('Private oversight history backup downloaded.');}
    catch(error){if(active(token))announce(error.message,true);}finally{if(active(token)){busy=false;controls();}}
  }
  async function restore(){if(busy||loading||!matching())return;busy=true;controls();const token=sequence;
    try{const result=await api.restore(accountId,projectId,{archive,expectedRevision:bundle.revision});if(!active(token))return;bundle=result.bundle;archive=null;fileControl.value='';fileSequence++;root.querySelector('[data-backup-result]').innerHTML=`<p>${result.restored?'History restored.':'Identical retained history verified; no records replaced.'}</p><p>Historical assertions remain attributed to their recorded authors and reviewers.</p><details open><summary>Source verification and receipt</summary><pre>${h(JSON.stringify({summary:result.summary,verification:result.verification,importReceipt:result.importReceipt},null,2))}</pre></details>`;announce('Restoration verified. Source availability findings are recorded in the import receipt.');
      try{const history=await api.imports(accountId,projectId);if(active(token))imports=history.imports||[];}catch(error){if(active(token))announce(`History restored; import receipt refresh failed: ${error.message}`,true);}
    }catch(error){if(active(token))announce(`${error.message} The selected backup is retained for review.`,true);}finally{if(active(token)){busy=false;render();}}
  }
  const change=event=>{if(busy)return;if(event.target===accountControl)loadAccount(accountControl.value);else if(event.target===projectControl){projectId=projectControl.value;loadProject();}else if(event.target===fileControl)readFile();};
  const click=event=>{if(event.target.closest('[data-backup-export]'))download();else if(event.target.closest('[data-backup-restore]'))restore();else if(event.target.closest('[data-backup-refresh]')&&!busy)loadProject();};
  root.addEventListener('change',change);root.addEventListener('click',click);
  const ready=(async()=>{loading=true;controls();try{accounts=await api.accounts();if(disposed)return;accountControl.innerHTML='<option value="">Choose an account…</option>'+accounts.map(item=>`<option value="${h(item.id)}">${h(item.name)}</option>`).join('');const requested=query.get('account');if(requested&&accounts.some(item=>item.id===requested)){accountControl.value=requested;await loadAccount(requested,query.get('project')||'');}else announce('Choose a custody account and project.');}catch(error){if(!disposed)announce(error.message,true);}finally{if(!disposed){loading=false;render();}}})();
  const dispose=()=>{if(disposed)return;disposed=true;sequence++;fileSequence++;root.removeEventListener('change',change);root.removeEventListener('click',click);for(const url of urls)view.URL.revokeObjectURL(url);urls.clear();archive=null;bundle=null;imports=[];root.replaceChildren();};
  invalidation?.then(dispose);return {ready,dispose};
}
