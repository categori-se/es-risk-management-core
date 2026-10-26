import {isIP} from 'node:net';
import {lookup} from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import {isPublicAddress} from './source-intake.mjs';

const MAX_BYTES=1024*1024;
const fail=(message,status=502)=>{throw Object.assign(Error(message),{status,statusCode:status});};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const official={openai:'https://api.openai.com/v1/responses',anthropic:'https://api.anthropic.com/v1/messages',gemini:'https://generativelanguage.googleapis.com/v1beta'};
const textProfiles=['conversation','classification','assessment','multidocument','drafting'];
export const esAiTextCapabilities=Object.freeze(textProfiles);

// Configuration is supplied by the server, never by a model or browser request.
export function esAiProviderConfiguration(route){
  if(route.provider==='synthetic')return{configured:true,protocol:'synthetic'};
  if(route.provider==='bedrock')return{configured:false,reason:'The community profile has no customer AWS AI adapter configured. Supply an explicitly reviewed adapter; local and compatible public providers remain available.'};
  let target;try{target=new URL(route.endpoint||official[route.provider]);}catch{return{configured:false,reason:'An explicit valid provider endpoint is required.'};}
  if(target.username||target.password||target.search||target.hash)return{configured:false,reason:'Provider endpoints cannot contain credentials, query parameters or fragments.'};
  if(route.provider==='local'){
    if(target.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(target.hostname))return{configured:false,reason:'Local inference requires credential-free loopback HTTP.'};
    if(route.credentialRef)return{configured:false,reason:'Local inference does not accept provider credentials.'};
    if(route.protocol&&route.protocol!=='openai-chat')return{configured:false,reason:'The local adapter supports only the explicit OpenAI chat JSON protocol.'};
    return{configured:true,protocol:'openai-chat',endpoint:target.href};
  }
  if(route.provider==='enterprise'){
    // Private enterprise networks require a separately reviewed injected adapter;
    // the generic adapter cannot safely establish their DNS/network boundary.
    if(target.protocol!=='https:'||isIP(target.hostname.replace(/^\[|\]$/g,''))||/(?:^|\.)(localhost|local|internal|localhost\.localdomain)$/.test(target.hostname))return{configured:false,reason:'The generic enterprise adapter requires an approved public HTTPS hostname.'};
    if(!['openai-responses','anthropic-messages','gemini'].includes(route.protocol))return{configured:false,reason:'Select an explicit supported enterprise protocol.'};
    if(!Array.isArray(route.approvedHosts)||!route.approvedHosts.includes(target.hostname))return{configured:false,reason:'The enterprise hostname must be explicitly allowlisted.'};
    return{configured:true,protocol:route.protocol,endpoint:target.href};
  }
  if(!official[route.provider]||target.href!==official[route.provider])return{configured:false,reason:'This provider requires its exact official HTTPS API endpoint.'};
  return{configured:true,protocol:{openai:'openai-responses',anthropic:'anthropic-messages',gemini:'gemini'}[route.provider],endpoint:target.href};
}
async function boundedJson(response,signal){
  const length=response.headers?.get?.('content-length');
  if(length!=null&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))fail('Provider response exceeded its byte bound.',413);
  if(!response.ok)fail('The selected provider rejected the request.');
  if(response.redirected)fail('Provider redirects are prohibited.');
  const type=response.headers?.get?.('content-type');if(type&&!/^application\/(?:json|[a-z0-9.+-]+\+json)(?:\s*;|$)/i.test(type))fail('The provider response was not JSON.',422);
  if(!response.body?.getReader)fail('The provider did not return a bounded readable body.');
  const reader=response.body.getReader(),chunks=[];let size=0;
  const cancel=()=>{try{reader.cancel().catch(()=>{});}catch{}};signal.addEventListener('abort',cancel,{once:true});
  try{for(;;){if(signal.aborted)fail('The provider request was stopped.',499);const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)fail('Provider response exceeded its byte bound.',413);chunks.push(Buffer.from(value));}
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{fail('The provider returned malformed JSON.',422);}
  }finally{signal.removeEventListener('abort',cancel);cancel();reader.releaseLock();}
}
function outputJson(text){if(typeof text!=='string'||Buffer.byteLength(text)>MAX_BYTES)fail('The provider did not return a bounded text result.',422);try{const value=JSON.parse(text);if(!plain(value))fail('AI output must be a JSON object.',422);return value;}catch{fail('The provider did not return a typed JSON result.',422);}}
function usage(input,output){return{inputTokens:input,outputTokens:output};}
function unpack(protocol,response){
  let texts,counts;
  if(protocol==='openai-responses'){
    if(response.status!=='completed'||!Array.isArray(response.output)||response.output.some(item=>item.type!=='message'||item.role!=='assistant'||!Array.isArray(item.content)||item.content.some(part=>part.type!=='output_text')))fail('The provider returned an incomplete result or requested a tool.',422);
    texts=response.output.flatMap(item=>item.content.map(part=>part.text));counts=usage(response.usage?.input_tokens,response.usage?.output_tokens);
  }else if(protocol==='anthropic-messages'){
    if(response.stop_reason!=='end_turn'||!Array.isArray(response.content)||response.content.some(part=>part.type!=='text'))fail('The provider returned an incomplete result or requested a tool.',422);
    texts=response.content.map(part=>part.text);counts=usage((response.usage?.input_tokens??NaN)+(response.usage?.cache_creation_input_tokens??0)+(response.usage?.cache_read_input_tokens??0),response.usage?.output_tokens);
  }else if(protocol==='gemini'){
    if(!Array.isArray(response.candidates)||response.candidates.length!==1||response.candidates[0].finishReason!=='STOP'||!Array.isArray(response.candidates[0].content?.parts)||response.candidates[0].content.parts.some(part=>Object.keys(part).some(key=>key!=='text'&&key!=='thought')||part.thought))fail('The provider returned an incomplete result or requested a tool.',422);
    texts=response.candidates[0].content.parts.map(part=>part.text);counts=usage(response.usageMetadata?.promptTokenCount,(response.usageMetadata?.candidatesTokenCount??NaN)+(response.usageMetadata?.thoughtsTokenCount??0));
  }else if(protocol==='openai-chat'){
    if(!Array.isArray(response.choices)||response.choices.length!==1||response.choices[0].finish_reason!=='stop'||response.choices[0].message?.tool_calls||response.choices[0].message?.function_call)fail('The local provider returned an incomplete result or requested a tool.',422);
    texts=[response.choices[0].message?.content];counts=usage(response.usage?.prompt_tokens,response.usage?.completion_tokens);
  }else{
    if(response.stopReason!=='end_turn'||!Array.isArray(response.output?.message?.content)||response.output.message.content.some(part=>Object.keys(part).some(key=>key!=='text')))fail('Bedrock returned an incomplete result or requested a tool.',422);
    texts=response.output.message.content.map(part=>part.text);counts=usage(response.usage?.inputTokens,response.usage?.outputTokens);
  }
  if(texts.some(value=>typeof value!=='string'))fail('The provider returned invalid text blocks.',422);
  return{output:outputJson(texts.join('')),usage:counts,inference:'actual'};
}
async function boundedProviderRequest(value,options){
  const url=new URL(value),host=url.hostname.replace(/^\[|\]$/g,''),local=url.protocol==='http:';
  const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await lookup(host,{all:true,verbatim:true});
  if(!addresses.length||addresses.length>64||addresses.some(item=>local?!['127.0.0.1','::1'].includes(item.address):!isPublicAddress(item.address)))fail('The selected provider resolved outside its reviewed network boundary.',403);
  if(options.signal.aborted)fail('The provider request was stopped.',499);
  return new Promise((resolve,reject)=>{
    const request=(local?http:https).request(url,{method:'POST',agent:false,signal:options.signal,maxHeaderSize:32768,headers:{...options.headers,'accept-encoding':'identity'},lookup:(_name,settings,callback)=>settings?.all?callback(null,addresses):callback(null,addresses[0].address,addresses[0].family)},response=>{
      if(response.statusCode<200||response.statusCode>=300){response.destroy();reject(Object.assign(Error('The provider rejected the request or redirected.'),{status:502}));return;}
      const encoding=response.headers['content-encoding'];if(encoding&&encoding!=='identity'){response.destroy();reject(Object.assign(Error('Compressed provider responses are not accepted.'),{status:422}));return;}
      let size=0;const chunks=[];response.on('data',chunk=>{size+=chunk.length;if(size>MAX_BYTES){response.destroy();reject(Object.assign(Error('The provider response exceeded its byte bound.'),{status:413}));}else chunks.push(chunk);});
      response.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:response.statusCode,headers:{'content-type':response.headers['content-type']||'application/json'}})));response.on('error',reject);response.on('aborted',()=>reject(Error('The provider response was interrupted.')));
    });request.on('error',reject);request.end(options.body);
  });
}

export function createEsAiAdapters({fetchImpl=boundedProviderRequest,runCommand}={}){
  const http=async({route,payload,credential,signal,maxOutputTokens})=>{
    const config=esAiProviderConfiguration(route);if(!config.configured)fail(config.reason,409);
    const system=payload.system,input=JSON.stringify(payload.input);let endpoint=config.endpoint,body,headers={'content-type':'application/json'};
    if(route.provider!=='local'){
      const secret=typeof credential==='string'?credential:credential?.value;if(typeof secret!=='string'||!secret||/[\r\n]/.test(secret))fail('The provider credential is unavailable.',409);
      if(config.protocol==='anthropic-messages'){headers['x-api-key']=secret;headers['anthropic-version']='2023-06-01';}
      else if(config.protocol==='gemini')headers['x-goog-api-key']=secret;else headers.authorization=`Bearer ${secret}`;
    }
    if(config.protocol==='openai-responses')body={model:route.model,instructions:system,input:[{role:'user',content:input}],max_output_tokens:maxOutputTokens,text:{format:{type:'json_object'}},store:false,stream:false};
    else if(config.protocol==='anthropic-messages')body={model:route.model,system,messages:[{role:'user',content:input}],max_tokens:maxOutputTokens,stream:false};
    else if(config.protocol==='gemini'){endpoint=`${endpoint.replace(/\/$/,'')}/models/${encodeURIComponent(route.model)}:generateContent`;body={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:input}]}],generationConfig:{maxOutputTokens,responseMimeType:'application/json'}};}
    else body={model:route.model,messages:[{role:'system',content:system},{role:'user',content:input}],max_tokens:maxOutputTokens,stream:false,response_format:{type:'json_object'}};
    const serialized=JSON.stringify(body);if(Buffer.byteLength(serialized)>MAX_BYTES)fail('The provider request exceeded its byte bound.',413);
    const response=await fetchImpl(endpoint,{method:'POST',headers,body:serialized,redirect:'error',signal});return unpack(config.protocol,await boundedJson(response,signal));
  };
  const bedrock=async()=>fail('No customer AWS AI adapter is configured.',409);
  return{openai:http,anthropic:http,gemini:http,local:http,enterprise:http,bedrock};
}
