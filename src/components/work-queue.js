const h=value=>String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labels={project_action:"Project action",engagement_action:"Corrective action",information_request:"Information request",field_mission:"Field mission",reporting_cycle:"Reporting period"};
const date=value=>{const parsed=new Date(`${value}T00:00:00Z`);return Number.isFinite(parsed.getTime())?new Intl.DateTimeFormat("en",{dateStyle:"medium",timeZone:"UTC"}).format(parsed):"Date to be set";};

export function workQueueHref(item,accountId) {
  const query=new URLSearchParams({account:accountId,project:item.projectId});
  if(item.recordType==="project_action")return `/?${query}#lw-action-${encodeURIComponent(item.id)}`;
  query.set("engagement",item.engagementId);query.set("tab",item.recordType==="engagement_action"?"actions":"monitoring");
  if(item.cycleId)query.set("cycleId",item.cycleId);
  if(item.recordType==="engagement_action")query.set("actionId",item.id);
  if(item.recordType==="information_request"){query.set("view","requests");query.set("requestId",item.id);}
  if(item.recordType==="reporting_cycle")query.set("view","overview");
  if(item.missionId)query.set("missionId",item.missionId);
  return `/engagements?${query}`;
}

/** One bounded metadata request on entry, then explicit refresh/pagination.
 * The outer workspace retains this small state across its ordinary rerenders.
 * No file availability check, original fetch, timer, or background sync runs. */
export function mountWorkQueue(root,{request,getAccountId,accountLabel="Selected account",state={},enabled=true}={}) {
  let disposed=false;
  const accountId=getAccountId();state.items ??= [];state.accountId ??= accountId;
  function render() {
    if(disposed||getAccountId()!==accountId)return;
    root.innerHTML=`<header class="lw-section-heading"><div><h2>Your open work</h2><p>${h(accountLabel)} · actions, information requests, missions and reporting periods.</p></div><div class="lw-actions"><a class="lw-report-link" href="/fieldwork?account=${h(encodeURIComponent(accountId))}">Capture field record</a><button type="button" data-work-queue-refresh${state.loading||!enabled?" disabled":""}>Refresh work</button></div></header><p data-work-queue-status role="${state.error?"alert":"status"}">${h(!enabled?"Choose an available account to open its work.":state.loading?"Opening saved work…":state.error || (state.loaded?state.items.length?`Showing ${state.items.length} open work items, ordered by the recorded date.${state.hasMore?" More work is available on the next page.":""}`:"Your saved work is up to date. No open actions, requests, missions or reporting periods are recorded.":"Opening saved work…"))}</p>${state.stale?'<p class="lw-note">Project records changed. Refresh work to show the latest saved status.</p>':""}<div class="lw-record-list">${state.items.map(item=>`<article class="lw-record" data-work-queue-record="${h(item.id)}"><p class="lw-eyebrow">${h(labels[item.recordType] || "Saved work")} · ${h(String(item.status || "open").replaceAll("_"," "))}</p><h3><a class="lw-report-link" href="${h(workQueueHref(item,accountId))}">${h(item.title)}</a></h3><p>${h(item.projectName)}${item.engagementName?` · ${h(item.engagementName)}`:""}</p><p>${h(item.owner || "Owner to be set")} · ${item.dueDate?`${item.dueDate<state.asOf?"Overdue · ":""}${item.recordType==="field_mission"?"Starts":"Due"} ${h(date(item.dueDate))}`:"Date to be set"}</p></article>`).join("")}</div>${state.hasMore?'<button type="button" data-work-queue-next'+(state.loading?' disabled':'')+'>Next work page</button>':""}${state.after?'<button type="button" data-work-queue-first'+(state.loading?' disabled':'')+'>First work page</button>':""}`;
  }
  async function load(after="") {
    if(!enabled||state.pending)return state.pending;
    state.attempted=true;state.loading=true;state.error="";state._render?.();
    const query=new URLSearchParams({limit:"6",...(after?{after}:{})});
    state.pending=(async()=>{
      try {
        const result=await Promise.resolve().then(()=>request(`/api/work-queue?${query}`));
        if(getAccountId()!==accountId||state.accountId!==accountId){state.attempted=false;return;}
        if(result?.format!=="esia-local-work-queue"||result.accountId!==accountId||!Array.isArray(result.items)||result.items.length>6||result.items.some(item=>!Object.hasOwn(labels,item.recordType)||typeof item.id!=="string"||typeof item.projectId!=="string"))throw Error("The saved work response does not match this account.");
        Object.assign(state,{items:result.items,loaded:true,after,hasMore:result.hasMore===true,nextCursor:result.nextCursor,asOf:result.asOf,stale:false});
      }catch(error){if(getAccountId()===accountId)state.error=error.message || "Saved work could not be opened. Use Refresh work to try again.";else state.attempted=false;}
      finally{state.pending=null;state.loading=false;state._render?.();}
    })();
    return state.pending;
  }
  const fromControl=async after=>{await load(after);if(!disposed&&getAccountId()===accountId){const status=root.querySelector('[data-work-queue-status]');if(status){status.tabIndex=-1;status.focus({preventScroll:true});}}};
  const onClick=event=>{if(event.target.closest("[data-work-queue-refresh],[data-work-queue-first]"))void fromControl();else if(event.target.closest("[data-work-queue-next]")&&state.nextCursor)void fromControl(state.nextCursor);};
  state._render=render;root.addEventListener("click",onClick);render();
  const ready=enabled&&!state.attempted?load():state.pending || Promise.resolve();
  return {ready,refresh:()=>load(),dispose(){disposed=true;if(state._render===render)delete state._render;root.removeEventListener("click",onClick);}};
}
