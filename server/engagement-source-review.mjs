import {createHash} from 'node:crypto';
import {runPdfTool} from './pdf-tools.mjs';
import {assertEngagement as assert,exactKeys,boundedText,stableJson,uuidPattern,sha256Pattern} from '../src/lib/engagement-domain.js';
import {retrieveEngagementPassages} from './engagement-assistance.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
export const sourceReviewFields=['requestKey','commandSha256','mode','statement','search','review'];
const commandFields=['type','requestKey','mode','statement','indexId','query','retrieval','limit','versionId','sourceSha256','startPage','endPage','fullPageOriginalReviewed'];
export function sourceReviewCommandDigest(command){return hash(stableJson(command));}
export function validateSourceReviewCommand(command){
 exactKeys(command,commandFields,'Retained source review command');
 assert(command.type==='source-review-save'&&uuidPattern.test(command.requestKey||''),'Use a unique request UUID for this retained search or original-page review.');
 assert(['search','full_page_review'].includes(command.mode),'Choose a retained search or a full original-page review.');
 const statement=boundedText(command.statement,'Source review statement',{required:true,max:4000});assert(statement.length>=20,'Describe the search purpose or completed original-page review in at least 20 characters.');
 const fields=command.mode==='search'?['type','requestKey','mode','statement','indexId','query','retrieval','limit']:['type','requestKey','mode','statement','versionId','sourceSha256','startPage','endPage','fullPageOriginalReviewed'];exactKeys(command,fields,'Explicit source review mode');
 if(command.mode==='search'){
  assert(/^index_[a-f0-9]{64}$/.test(command.indexId||''),'Choose an exact retained extraction index.');boundedText(command.query,'Retained search query',{required:true,max:2000});
  assert(['lexical','semantic','hybrid'].includes(command.retrieval)&&Number.isSafeInteger(command.limit)&&command.limit>=1&&command.limit<=50,'Choose lexical, semantic or hybrid retrieval and 1–50 candidates.');
 }else{
  boundedText(command.versionId,'Reviewed source version',{required:true,max:192});assert(sha256Pattern.test(command.sourceSha256||''),'Retain the exact original source SHA256.');
  assert(Number.isSafeInteger(command.startPage)&&command.startPage>=1&&Number.isSafeInteger(command.endPage)&&command.endPage>=command.startPage&&command.endPage-command.startPage<200&&command.fullPageOriginalReviewed===true,'Explicitly attest to reviewing each complete original page in a range of at most 200 pages.');
 }
 return command;
}

/** Runs only after current source permission checks. Browser-supplied page
 * coverage is never accepted; this binding is an internal repository value. */
export async function prepareEngagementSourceReview({engagement,project,command,actorId,readVersion,indexes}={}){
 validateSourceReviewCommand(command);
 assert([...engagement.roles.preparer,...engagement.roles.reviewer].includes(actorId),'Source review requires an assigned preparer or reviewer.',403);
 const digest=sourceReviewCommandDigest(command),prior=(engagement.sourceReviews||[]).find(row=>row.requestKey===command.requestKey);
 if(prior){assert(prior.commandSha256===digest&&prior.createdBy===actorId,'This source-review request UUID already identifies different work or another practitioner.',409);return null;}
 const fields={requestKey:command.requestKey,commandSha256:digest,mode:command.mode,statement:command.statement};
 if(command.mode==='search'){
  const result=await indexes.search({accountId:project.accountId,project,indexId:command.indexId,query:command.query,retrieval:command.retrieval,limit:command.limit,readVersion,lexical:retrieveEngagementPassages});
  assert(result.searchCoverage,'The retained index cannot establish exactly which passages were searched.',409);
  fields.search={indexId:result.indexId,corpusSha256:result.corpusSha256,projectRevision:result.projectRevision,query:command.query,retrieval:command.retrieval,limit:command.limit,method:result.method,algorithm:result.algorithm||'esia-lexical-token-1',...result.searchCoverage};
 }else{
  const version=project.resources.flatMap(row=>row.versions).find(row=>row.id===command.versionId);assert(version&&version.sha256===command.sourceSha256,'The reviewed original version or SHA256 changed. Reopen the exact original.',409);
  const original=await readVersion(version.id),bytes=original?.bytes??original;assert(bytes instanceof Uint8Array&&bytes.byteLength===version.size&&hash(bytes)===version.sha256,'The reviewed original bytes are unavailable or changed.',409);
  assert(version.mediaType==='application/pdf'||/\.pdf$/i.test(version.filename),'Full file-page coverage currently requires a PDF original.');
  const info=runPdfTool('pdfinfo',['-'],{input:bytes,maxInputBytes:64*1024*1024,encoding:'utf8',timeout:8000,maxBuffer:256*1024}),totalPages=Number(/^Pages:\s+(\d+)\s*$/m.exec(info)?.[1]);
  assert(Number.isSafeInteger(totalPages)&&totalPages>=command.endPage,'The original-page review range exceeds the verified PDF file-page count.',409);
  fields.review={versionId:version.id,sourceSha256:version.sha256,totalPages,pages:Array.from({length:command.endPage-command.startPage+1},(_,i)=>command.startPage+i),fullPageOriginalReviewed:true};
 }
 return fields;
}

function pages(value,total,label){assert(Array.isArray(value)&&value.length<=20000&&value.every((page,i)=>Number.isSafeInteger(page)&&page>=1&&(total===null||page<=total)&&(i===0||page>value[i-1])),`${label} must be sorted, unique and within the exact original page count.`);}
export function validateEngagementSourceReviews(view,project){
 const requests=new Set(),versions=new Map(project.resources.flatMap(row=>row.versions).map(row=>[row.id,row]));
 for(const record of view.sourceReviews||[]){
  assert(record.revision===1&&record.history.length===0&&record.updatedBy===record.createdBy&&record.updatedAt===record.createdAt,'Source review records are immutable; append a new attestation instead of editing history.');
  assert(uuidPattern.test(record.requestKey||'')&&!requests.has(record.requestKey)&&sha256Pattern.test(record.commandSha256||''),'Retained source-review request identities must be unique.');requests.add(record.requestKey);
  boundedText(record.statement,'Source review statement',{required:true,max:4000});assert(record.statement.length>=20,'Retain a substantive source-review statement.');
  const event=(view.audit||[]).find(entry=>entry.command==='source-review-save'&&entry.changedIds.includes(record.id));
  const mandate=event?(view.mandateHistory||view.engagement?.mandateHistory||[]).find(row=>row.revision>=event.revision)?.mandate||view.engagement||view:view.engagement||view;
  assert([...mandate.roles.preparer,...mandate.roles.reviewer].includes(record.createdBy)&&(!event||event.actorId===record.createdBy),'Source review must retain its actual assigned practitioner.');
  if(record.mode==='search'){
   assert(record.review===undefined&&record.search,'A retained search must keep its exact search manifest.');const search=record.search;
   exactKeys(search,['indexId','corpusSha256','projectRevision','query','retrieval','limit','method','algorithm','extractorVersion','passageSetSha256','searchedPassages','candidatePassageIds','sources'],'Retained search coverage');
   assert(/^index_[a-f0-9]{64}$/.test(search.indexId||'')&&sha256Pattern.test(search.corpusSha256||'')&&sha256Pattern.test(search.passageSetSha256||'')&&Number.isSafeInteger(search.projectRevision)&&search.projectRevision>=1,'Retain the exact extraction and searched passage identities.');
   boundedText(search.query,'Retained search query',{required:true,max:2000});assert(['lexical','semantic','hybrid'].includes(search.retrieval)&&Number.isSafeInteger(search.limit)&&search.limit>=1&&search.limit<=50,'Retain the actual retrieval mode and candidate limit.');
   for(const key of ['method','algorithm','extractorVersion'])boundedText(search[key],`Search ${key}`,{required:true,max:200});
   assert(Number.isSafeInteger(search.searchedPassages)&&search.searchedPassages>=0&&search.searchedPassages<=2000&&Array.isArray(search.candidatePassageIds)&&search.candidatePassageIds.length<=search.limit&&new Set(search.candidatePassageIds).size===search.candidatePassageIds.length&&search.candidatePassageIds.every(value=>typeof value==='string'&&value.length<=192),'Retain bounded actual searched passages and returned candidate IDs.');
   assert(Array.isArray(search.sources)&&search.sources.length>=1&&search.sources.length<=100&&new Set(search.sources.map(row=>row.versionId)).size===search.sources.length,'Retain each searched source exactly once.');
   let count=0;for(const source of search.sources){
    exactKeys(source,['versionId','sourceSha256','totalPages','extractedPages','unreadablePages','truncatedPages','ocrPages','excludedRanges','searchedPages','candidatePages','searchedPassages'],'Retained searched source');
    assert(versions.get(source.versionId)?.sha256===source.sourceSha256,'A retained search differs from its exact source version/hash.',409);assert(source.totalPages===null||Number.isSafeInteger(source.totalPages)&&source.totalPages>=1&&source.totalPages<=20000,'Retain the exact PDF page count or null for unpaginated evidence.');
    for(const key of ['extractedPages','unreadablePages','truncatedPages','ocrPages','searchedPages','candidatePages'])pages(source[key],source.totalPages,key);
    assert(source.candidatePages.every(page=>source.searchedPages.includes(page))&&source.searchedPages.every(page=>source.extractedPages.includes(page)||source.truncatedPages.includes(page)||source.ocrPages.includes(page)),'Candidate pages must have been searched, and searched pages must contain indexed extracted text.');
    assert(Array.isArray(source.excludedRanges)&&source.excludedRanges.length<=20001,'Retain bounded excluded ranges.');for(const range of source.excludedRanges){exactKeys(range,['startPage','endPage','status'],'Excluded PDF range');assert(Number.isSafeInteger(range.startPage)&&Number.isSafeInteger(range.endPage)&&range.startPage>=1&&range.endPage>=range.startPage&&range.endPage<=source.totalPages&&range.status==='excluded','Retain valid excluded PDF ranges.');}
    if(source.totalPages!==null){
     const states=[...source.extractedPages,...source.unreadablePages,...source.truncatedPages].sort((a,b)=>a-b);assert(new Set(states).size===states.length,'Canonical extraction states cannot overlap.');
     let cursor=1;for(const range of [...states.map(page=>({startPage:page,endPage:page})),...source.excludedRanges].sort((a,b)=>a.startPage-b.startPage)){assert(range.startPage===cursor,'Retained extraction states and exclusions must account for every original PDF page exactly once.');cursor=range.endPage+1;}assert(cursor===source.totalPages+1,'Retained extraction coverage omits original PDF pages.');
    }else assert(!source.extractedPages.length&&!source.unreadablePages.length&&!source.truncatedPages.length&&!source.ocrPages.length&&!source.searchedPages.length&&!source.candidatePages.length&&!source.excludedRanges.length,'Unpaginated evidence cannot claim PDF file pages.');
    assert(Number.isSafeInteger(source.searchedPassages)&&source.searchedPassages>=0&&source.searchedPassages<=2000,'Retain the actual searched passage count.');count+=source.searchedPassages;
   }assert(count===search.searchedPassages,'Retained source passage counts differ from the searched corpus.');
  }else{
   assert(record.mode==='full_page_review'&&record.search===undefined&&record.review,'Retain an explicit original full-page review.');const review=record.review;exactKeys(review,['versionId','sourceSha256','totalPages','pages','fullPageOriginalReviewed'],'Original page review');
   assert(versions.get(review.versionId)?.sha256===review.sourceSha256&&Number.isSafeInteger(review.totalPages)&&review.totalPages>=1&&review.totalPages<=20000&&review.fullPageOriginalReviewed===true,'Original-page review must match the exact retained source and page count.',409);pages(review.pages,review.totalPages,'Reviewed original pages');assert(review.pages.length>=1&&review.pages.length<=200,'Attest to one to 200 original pages per review.');
   assert(review.pages.length===review.pages.at(-1)-review.pages[0]+1,'Retain every original page in the explicitly reviewed range.');
  }
  const command=record.mode==='search'?{type:'source-review-save',requestKey:record.requestKey,mode:record.mode,statement:record.statement,indexId:record.search.indexId,query:record.search.query,retrieval:record.search.retrieval,limit:record.search.limit}:{type:'source-review-save',requestKey:record.requestKey,mode:record.mode,statement:record.statement,versionId:record.review.versionId,sourceSha256:record.review.sourceSha256,startPage:record.review.pages[0],endPage:record.review.pages.at(-1),fullPageOriginalReviewed:true};
  assert(sourceReviewCommandDigest(command)===record.commandSha256,'The retained source-review command differs from its immutable request digest.');
 }
}
