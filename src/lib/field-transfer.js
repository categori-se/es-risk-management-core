// One deliberate operation sends only missing chunks. Reconnect by invoking it
// again; no polling, background work, automatic rebase or hidden retry.
const digest=async(bytes,crypto)=>[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(value=>value.toString(16).padStart(2,"0")).join("");
function base64(bytes){let text="";for(let offset=0;offset<bytes.length;offset+=32768)text+=String.fromCharCode(...bytes.subarray(offset,offset+32768));return btoa(text);}

export async function transferFieldRecord({record,projectId,accountId,expectedRevision,request,crypto=globalThis.crypto,onProgress=()=>{},signal,reviewedRevision,verify,deviceLease}) {
  const bytes=new TextEncoder().encode(JSON.stringify(record));
  if(!bytes.length||bytes.length>32*1024*1024)throw Error("A field record transfer supports up to 32 MiB. Keep the encrypted device draft and split larger activities into separate records.");
  const check=()=>{if(signal?.aborted)throw new DOMException("Field transfer stopped. Its acknowledged chunks remain available for explicit resume.","AbortError");};
  check();const sha256=await digest(bytes,crypto),base=`/api/projects/${encodeURIComponent(projectId)}/field-transfers`;
  const call=(path,method="GET",body)=>{check();return request(path,{accountId,method,signal,...(body===undefined?{}:{body})});};
  let progress=await call(base,"POST",{sha256,bytes:bytes.length,expectedRevision,...(deviceLease?{deviceLease}:{})});
  const validate=()=>{
    if(progress.id!==sha256||progress.bytes!==bytes.length||progress.chunkBytes!==1024*1024||progress.chunks!==Math.ceil(bytes.length/progress.chunkBytes)||!Array.isArray(progress.received)||progress.received.some(index=>!Number.isInteger(index)||index<0||index>=progress.chunks)||!Number.isSafeInteger(progress.expectedRevision))throw Error("The repository returned a field transfer receipt for different bytes or scope.");
  };
  validate();
  if(reviewedRevision!==undefined){
    if(!Number.isSafeInteger(reviewedRevision)||reviewedRevision<1)throw Error("Review the current project revision before reconciling.");
    progress=await call(`${base}/${sha256}/reconcile`,"POST",{previousRevision:progress.expectedRevision,expectedRevision:reviewedRevision,reviewed:true});validate();
  }
  const received=new Set(progress.received);let sent=[...received].reduce((sum,index)=>sum+Math.min(progress.chunkBytes,bytes.length-index*progress.chunkBytes),0);
  onProgress({state:"transferring",bytes:bytes.length,sent,chunks:progress.chunks,acknowledgedChunks:received.size,id:sha256});
  for(let index=0;index<progress.chunks;index++){
    if(received.has(index))continue;
    const chunk=bytes.subarray(index*progress.chunkBytes,Math.min(bytes.length,(index+1)*progress.chunkBytes));
    const receipt=await call(`${base}/${sha256}/chunks`,"POST",{index,contentBase64:base64(chunk),sha256:await digest(chunk,crypto)});
    if(receipt.id!==sha256||receipt.index!==index||receipt.acknowledged!==true)throw Error("The repository did not acknowledge this exact field chunk. Resume explicitly from the encrypted draft.");
    sent+=chunk.length;received.add(index);onProgress({state:"transferring",bytes:bytes.length,sent,chunks:progress.chunks,acknowledgedChunks:received.size,id:sha256});
  }
  let result;
  try{result=await call(`${base}/${sha256}/commit`,"POST",{});}
  catch(error){
    if(error.status===409){error.transferId=sha256;error.expectedRevision=progress.expectedRevision;onProgress({state:"conflict",id:sha256,expectedRevision:progress.expectedRevision,message:"Review the latest project and choose how to retain this field observation. Its transferred bytes remain available."});}
    throw error;
  }
  check();
  if(typeof verify!=="function"||!verify(result))throw Error("The repository response does not confirm this exact capture. Keep the encrypted draft and resume explicitly.");
  onProgress({state:"acknowledged",id:sha256,bytes:bytes.length,sent:bytes.length});
  // Cleanup follows a verified acknowledgement. If it is interrupted, a later
  // manual resume uses the same identity and idempotent capture command.
  try{await call(`${base}/${sha256}`,"DELETE");}catch{}
  return result;
}
