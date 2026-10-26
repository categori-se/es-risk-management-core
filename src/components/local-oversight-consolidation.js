import {mountOversightConsolidationWorkspace} from './oversight-consolidation-workspace.js';

/** Practitioner projection requests carry explicit source pairs. They never
 * inherit the selected lender account's routing header. */
export function createLocalOversightConsolidationApi({fetchImpl=globalThis.fetch}={}) {
  const base='/api/oversight/consolidation';
  async function request(path,{body,binary=false}={}) {
    const response=await fetchImpl(base+path,{method:body===undefined?'GET':'POST',cache:'no-store',credentials:'omit',
      headers:{'X-ESIA-Workspace':'local',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(!response.ok){let detail;try{detail=(await response.json()).error;}catch{}throw Object.assign(new Error(detail||'The practitioner portfolio operation failed.'),{status:response.status});}
    return binary?response.blob():response.json();
  }
  return {
    oversightHref:()=>'/oversight',
    sources:()=>request('/sources'),preview:body=>request('/preview',{body}),
    snapshots:async()=>(await request('/snapshots')).snapshots,
    issueSnapshot:body=>request('/snapshots',{body}),getSnapshot:id=>request(`/snapshots/${encodeURIComponent(id)}`),
    exportSnapshot:(id,format)=>request(`/snapshots/${encodeURIComponent(id)}/export?format=${encodeURIComponent(format)}`,{binary:true}),
    projectHref:({accountId,projectId})=>`/oversight?account=${encodeURIComponent(accountId)}&project=${encodeURIComponent(projectId)}`
  };
}

export function mountLocalOversightConsolidation(root,{fetchImpl=globalThis.fetch,invalidation}={}) {
  return mountOversightConsolidationWorkspace(root,{api:createLocalOversightConsolidationApi({fetchImpl}),invalidation});
}
