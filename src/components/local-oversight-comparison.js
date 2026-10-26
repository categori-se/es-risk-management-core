import {mountOversightComparisonWorkspace} from "./oversight-comparison-workspace.js";

function comparisonIds(input) {
  if (!input || typeof input!=="object" || Array.isArray(input) || Object.keys(input).some(key=>!["baselineId","followupId"].includes(key)) || [input.baselineId,input.followupId].some(value=>typeof value!=="string" || !value.trim() || value.length>192 || /[\x00-\x1f\x7f]/.test(value))) throw new TypeError("Choose exact baseline and follow-up snapshot identifiers.");
  return {baselineId:input.baselineId,followupId:input.followupId};
}

/** Frozen practitioner packets use their own local authority boundary. No
 * selected lender account header or arbitrary resource path is inherited. */
export function createLocalOversightComparisonApi({fetchImpl=globalThis.fetch,signal}={}) {
  if(typeof fetchImpl!=="function")throw new TypeError("A local fetch implementation is required.");
  const current=()=>{if(signal?.aborted)throw new DOMException("The comparison workspace has closed.","AbortError");};
  async function request(path,{body,binary=false}={}) {
    current();const response=await fetchImpl(`/api/oversight/consolidation${path}`,{method:body===undefined?"GET":"POST",credentials:"omit",cache:"no-store",redirect:"error",...(signal?{signal}:{}),headers:{"X-ESIA-Workspace":"local",...(body===undefined?{}:{"Content-Type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)})});current();
    if(!response.ok){let detail;try{detail=(await response.json()).error;}catch{}current();throw Object.assign(new Error(typeof detail==="string"?detail:detail?.message || "The retained-packet comparison operation failed."),{status:response.status});}
    const value=await(binary?response.blob():response.json());current();return value;
  }
  return {
    consolidationHref:()=>"/oversight-consolidation",
    snapshots:async()=>{const value=await request("/snapshots");if(!Array.isArray(value?.snapshots))throw Object.assign(new Error("The service did not return valid retained packet headers."),{status:502});return value.snapshots;},
    compare:input=>request("/comparisons",{body:comparisonIds(input)}),
    exportComparison:(input,format)=>{if(!["json","html","xlsx"].includes(format))throw new TypeError("Choose a JSON, HTML or XLSX comparison export.");return request(`/comparisons/export?format=${format}`,{body:comparisonIds(input),binary:true});}
  };
}

export function mountLocalOversightComparison(root,{fetchImpl=globalThis.fetch,invalidation}={}) {
  const controller=new AbortController(),api=createLocalOversightComparisonApi({fetchImpl,signal:controller.signal}),mounted=mountOversightComparisonWorkspace(root,{api,invalidation}),dispose=mounted.dispose;
  mounted.dispose=()=>{controller.abort();dispose();};return mounted;
}
