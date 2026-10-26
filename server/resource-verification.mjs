import http from 'node:http';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {captureSource} from './source-intake.mjs';

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status,statusCode:status});};
export const resourceVerificationLimits=Object.freeze({resources:20,requests:100,milliseconds:300000,responseBytes:8*1024*1024,totalBytes:32*1024*1024});
export function createVerificationBudget({now=Date.now,signal}={}){return{startedAt:now(),requests:0,bytes:0,signal,now,stopped:false,blockedHosts:new Set()};}
function checkBudget(budget){if(budget?.signal?.aborted)fail('The explicit resource verification was cancelled.',499);if(budget&&(budget.stopped||budget.requests>=100||budget.bytes>=resourceVerificationLimits.totalBytes||budget.now()-budget.startedAt>=resourceVerificationLimits.milliseconds)){budget.stopped=true;fail('The resource verification reached its request, byte or five minute bound.',413);}}

/** The existing capture helper performs public-DNS pinning and revalidates every
 * redirect. This adapter adds conditional headers without weakening that fence.
 * A 304 is carried through its complete-body envelope using a private sentinel;
 * that sentinel is never exposed as original bytes or persisted as a file. */
export async function probeResourceSource(url,{etag,lastModified,budget=createVerificationBudget(),capture=captureSource,transport}={}){
  checkBudget(budget);if(budget.blockedHosts?.has(new URL(url).hostname))fail('This source host was stopped after an access challenge or rate limit.',429);let observation;
  const request=transport||((target,addresses,{signal,maximumBytes})=>new Promise((resolve,reject)=>{
    let finished=false;const done=(error,value)=>{if(finished)return;finished=true;error?reject(error):resolve(value);};
    const headers={'User-Agent':'ESIA resource verification (explicit bounded local run)','Accept-Encoding':'identity',Accept:'application/pdf,text/html,*/*'};
    if(etag&&typeof etag==='string'&&etag.length<2000&&!/[\r\n]/.test(etag))headers['If-None-Match']=etag;
    if(lastModified&&typeof lastModified==='string'&&lastModified.length<2000&&!/[\r\n]/.test(lastModified))headers['If-Modified-Since']=lastModified;
    const req=(target.protocol==='https:'?https:http).request(target,{method:'GET',agent:false,signal,maxHeaderSize:32768,headers,lookup:(_host,options,callback)=>options?.all?callback(null,addresses):callback(null,addresses[0].address,addresses[0].family)},response=>{
      if(response.statusCode===304||response.statusCode>=300&&response.statusCode<400){response.destroy();done(null,{status:response.statusCode,headers:response.headers,bytes:Buffer.alloc(0)});return;}
      if(Number(response.headers['content-length'])>maximumBytes){response.destroy();done(Error('Oversized verification response.'));return;}
      const chunks=[];let bytes=0;response.on('data',chunk=>{bytes+=chunk.length;if(bytes>maximumBytes){response.destroy();done(Error('Oversized verification response.'));}else chunks.push(chunk);});
      response.on('end',()=>done(null,{status:response.statusCode,headers:response.headers,bytes:Buffer.concat(chunks)}));response.on('error',error=>done(error));response.on('aborted',()=>done(Error('Interrupted verification response.')));
    });req.setTimeout(15000,()=>req.destroy());req.on('error',error=>done(error));req.end();
  }));
  const remaining=Math.max(1,resourceVerificationLimits.milliseconds-(budget.now()-budget.startedAt));
  const result=await capture(url,{maximumBytes:resourceVerificationLimits.responseBytes,timeoutMs:Math.min(30000,remaining),inspect:({contentBase64,...value})=>({...value,metadata:{title:'',extraction:{warnings:[]}},size:Buffer.from(contentBase64,'base64').length,sha256:createHash('sha256').update(Buffer.from(contentBase64,'base64')).digest('hex')}),transport:async(target,addresses,options)=>{
    checkBudget(budget);if(budget.blockedHosts?.has(target.hostname))fail('This redirected source host was stopped after an access challenge or rate limit.',429);budget.requests++;const response=await request(target,addresses,options);budget.bytes+=(response.bytes?.length||0);if(budget.bytes>resourceVerificationLimits.totalBytes){budget.stopped=true;fail('The verification response exceeded the aggregate byte bound.',413);}
    observation={status:response.status,headers:response.headers};if([401,403,429].includes(response.status)||/^(?:just a moment|access denied|attention required|request rejected|403 forbidden)/i.test(Buffer.from(response.bytes||[]).subarray(0,2000).toString('utf8').replace(/<[^>]+>/g,'').trim()))budget.blockedHosts?.add(target.hostname);
    if(response.status===304)return{status:200,headers:{'content-length':'1','content-type':'application/octet-stream'},bytes:Buffer.from([0])};
    return response;
  }});
  if(observation.status===304)return{status:304,changed:false,etag,lastModified,checkedAt:new Date().toISOString(),requests:budget.requests};
  const headers=result.http?.headers||{},status=observation.status;
  return{status,sha256:result.sha256,size:result.size,changed:null,etag:headers.etag||null,lastModified:headers['last-modified']||null,finalUrl:result.source.finalUrl,redirects:result.http.redirects,checkedAt:new Date().toISOString(),requests:budget.requests};
}

export function interpretResourceObservation(previous,observation){
  if(!observation||!Number.isInteger(observation.status)||observation.status!==304&&(!/^[a-f0-9]{64}$/.test(observation.sha256||'')||!Number.isSafeInteger(observation.size)||observation.size<1))fail('Verification requires an actual bounded HTTP observation.');
  if(observation.status===304)return{...observation,outcome:'unchanged',editionChanged:false,requiresReview:false};
  const changed=Boolean(previous.sha256&&observation.sha256!==previous.sha256);
  return{...observation,outcome:changed?'changed_bytes':previous.sha256?'unchanged':'reference_observed',editionChanged:false,requiresReview:changed,note:changed?'Changed source bytes require publication-edition and rights review. Existing editions remain unchanged.':'HTTP timestamps and validators are observations, not publication edition dates.'};
}
