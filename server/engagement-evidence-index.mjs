import {createHash,randomUUID} from "node:crypto";
import {writeFileSync,readdirSync,lstatSync,renameSync,rmSync,existsSync,mkdirSync,openSync,fstatSync,readSync,closeSync,constants} from "node:fs";
import {join} from "node:path";
import {privateStorageDirectory} from "./private-storage-path.mjs";
import {stableJson} from "../src/lib/engagement-domain.js";
import {summarizePdfCoverage} from "./engagement-assistance.mjs";
import {validatePdfOcrDerivative} from './pdf-evidence-derivatives.mjs';

export const latentIndexVersion="esia-local-lsa-tfidf-1";
export const evidenceIndexLimits=Object.freeze({passages:2000,terms:192,tokensPerPassage:256,dimensions:12,iterations:24,milliseconds:12000,entries:16,cacheBytes:64*1024*1024,entryBytes:12*1024*1024});
const hash=value=>createHash("sha256").update(value).digest("hex"),fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value),hex=value=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value),indexIdentity=value=>typeof value==="string"&&/^index_[a-f0-9]{64}$/.test(value);
const stopWords=new Set("the and for with that this from have has was were are shall should must may any all each their there those which when where into than then project requirement requirements assessment assess evidence review document documents standard standards applicable ensure relevant appropriate according including also only under against using provide record records its they them these been were will can not but our your such through between within after before about during over per both other more most some one two three".split(" "));
export function semanticTerms(value){return (String(value).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]).filter(word=>!stopWords.has(word)).map(word=>word.length>5?word.replace(/(?:ing|ed|s)$/u,""):word);}
const dot=(a,b)=>{let sum=0;for(let i=0;i<a.length;i++)sum+=a[i]*b[i];return sum;};
const normalize=value=>{const norm=Math.sqrt(dot(value,value));if(norm>1e-12)for(let i=0;i<value.length;i++)value[i]/=norm;return norm;};
const timed=(started,now)=>{if(now()-started>evidenceIndexLimits.milliseconds)fail("The explicit local semantic operation exceeded its 12 second budget. Select fewer source versions and rebuild.",413);};

/** Actual truncated latent semantic analysis. No model or transport adapter. */
export function fitLatentIndex(passages,{dimensions,now=Date.now}={}){
 if(!Array.isArray(passages)||passages.length>evidenceIndexLimits.passages||passages.some(p=>typeof p.id!=="string"||typeof p.quote!=="string"||p.quote.length>2000))fail("Fit at most 2,000 bounded exact passages.",413);
 if(dimensions!==undefined&&(!Number.isSafeInteger(dimensions)||dimensions<1||dimensions>evidenceIndexLimits.dimensions))fail("Choose between 1 and 12 local latent dimensions.");
 const started=now(),counts=[],frequency=new Map();let omittedTokens=0;
 for(const passage of passages){timed(started,now);const all=semanticTerms(passage.quote),terms=all.slice(0,evidenceIndexLimits.tokensPerPassage),count=new Map();omittedTokens+=all.length-terms.length;for(const term of terms)count.set(term,(count.get(term)||0)+1);for(const term of count.keys())frequency.set(term,(frequency.get(term)||0)+1);counts.push(count);}
 const vocabulary=[...frequency].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,evidenceIndexLimits.terms).map(([term])=>term),lookup=new Map(vocabulary.map((term,i)=>[term,i])),idf=vocabulary.map(term=>1+Math.log((1+passages.length)/(1+frequency.get(term)))),width=vocabulary.length;
 const rows=counts.map(count=>{const row=new Float64Array(width);for(const [term,counted]of count)if(lookup.has(term)){const i=lookup.get(term);row[i]=(1+Math.log(counted))*idf[i];}normalize(row);return row;});
 const covariance=new Float64Array(width*width);let trace=0;
 for(const row of rows){timed(started,now);const used=[];for(let i=0;i<width;i++)if(row[i])used.push(i);for(const i of used)for(const j of used)covariance[i*width+j]+=row[i]*row[j];}
 for(let i=0;i<width;i++)trace+=covariance[i*width+i];
 const wanted=Math.min(dimensions??Math.max(2,Math.floor(Math.sqrt(passages.length))),evidenceIndexLimits.dimensions,Math.max(0,width-1),Math.max(0,passages.length-1));
 let basis=[];let seed=0x6d2b79f5;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296-.5;};
 const orthogonalize=vectors=>{const result=[];for(const vector of vectors){for(let pass=0;pass<2;pass++)for(const prior of result){const amount=dot(vector,prior);for(let j=0;j<width;j++)vector[j]-=amount*prior[j];}if(normalize(vector)>1e-10)result.push(vector);}return result;};
 for(let k=0;k<wanted;k++)basis.push(Float64Array.from({length:width},random));basis=orthogonalize(basis);
 for(let iteration=0;iteration<evidenceIndexLimits.iterations&&basis.length;iteration++){timed(started,now);basis=orthogonalize(basis.map(vector=>{const projected=new Float64Array(width);for(let i=0;i<width;i++){let sum=0;for(let j=0;j<width;j++)sum+=covariance[i*width+j]*vector[j];projected[i]=sum;}return projected;}));}
 const components=basis.map(vector=>{let energy=0;for(let i=0;i<width;i++)for(let j=0;j<width;j++)energy+=vector[i]*covariance[i*width+j]*vector[j];return {vector,energy};}).filter(item=>item.energy>1e-10).sort((a,b)=>b.energy-a.energy);basis=components.map(item=>item.vector);
 const documents=rows.map((row,i)=>{const vector=Float64Array.from(basis.map(component=>dot(row,component)));normalize(vector);return {passageId:passages[i].id,vector:Array.from(vector)};});timed(started,now);
 return {algorithm:latentIndexVersion,method:"local_latent_semantic_analysis",vocabulary,idf,basis:basis.map(component=>Array.from(component)),dimensions:basis.length,documents,
  coverage:{passages:passages.length,vocabularyTerms:width,omittedVocabularyTerms:Math.max(0,frequency.size-width),omittedTokens,retainedVariance:trace?Math.min(1,components.reduce((sum,item)=>sum+item.energy,0)/trace):0},
  limits:evidenceIndexLimits,warnings:["Latent similarity is a corpus-dependent retrieval candidate, not verified evidence, an applicability decision or a compliance conclusion.",...(omittedTokens||frequency.size>width?["The explicit token/vocabulary caps omit some text features; retain lexical search and inspect original sources."]:[]),...(!basis.length?["This source batch has insufficient independent vocabulary for a latent representation; use lexical or manual review."]:[])]};
}

function validateModel(model,passages){
 if(!Array.isArray(model?.warnings)||model.warnings.length>100||model.warnings.some(value=>typeof value!=="string"||value.length>4000)||model.method!=="local_latent_semantic_analysis")fail("The derived latent descriptor is invalid. Rebuild this index.",409);
 if(!object(model)||model.algorithm!==latentIndexVersion||!Array.isArray(model.vocabulary)||model.vocabulary.length>evidenceIndexLimits.terms||new Set(model.vocabulary).size!==model.vocabulary.length||model.vocabulary.some(term=>typeof term!=="string"||term.length>2000)||!Array.isArray(model.idf)||model.idf.length!==model.vocabulary.length||model.idf.some(value=>!Number.isFinite(value)||value<1||value>20)||!Number.isSafeInteger(model.dimensions)||model.dimensions<0||model.dimensions>evidenceIndexLimits.dimensions||!Array.isArray(model.basis)||model.basis.length!==model.dimensions||model.basis.some(vector=>!Array.isArray(vector)||vector.length!==model.vocabulary.length||vector.some(value=>!Number.isFinite(value)||Math.abs(value)>1.000001))||!Array.isArray(model.documents)||model.documents.length!==passages.length||model.documents.some((record,i)=>record.passageId!==passages[i].id||!Array.isArray(record.vector)||record.vector.length!==model.dimensions||record.vector.some(value=>!Number.isFinite(value)||Math.abs(value)>1.000001)))fail("The derived latent representation has invalid identities, dimensions or finite values. Rebuild this index.",409);
 return model;
}
export function rankLatentPassages(passages,model,query,{limit=12,now=Date.now}={}){
 if(typeof query!=="string"||query.length>12000||!Number.isSafeInteger(limit)||limit<1||limit>50)fail("Use a bounded semantic query and a result limit from 1 to 50.");validateModel(model,passages);const started=now(),terms=semanticTerms(query),counts=new Map(),lookup=new Map(model.vocabulary.map((term,i)=>[term,i])),row=new Float64Array(model.vocabulary.length);for(const term of terms)counts.set(term,(counts.get(term)||0)+1);let matched=0;for(const [term,count]of counts)if(lookup.has(term)){const i=lookup.get(term);row[i]=(1+Math.log(count))*model.idf[i];matched++;}normalize(row);const vector=Float64Array.from(model.basis.map(component=>dot(row,component)));const norm=normalize(vector),candidates=[];
 if(norm)for(let i=0;i<passages.length;i++){timed(started,now);const score=Math.max(-1,Math.min(1,dot(vector,model.documents[i].vector)));if(score>1e-8)candidates.push({...passages[i],score,scores:{semantic:score}});}
 candidates.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));return {method:"local_latent_semantic_analysis",algorithm:latentIndexVersion,aiUsed:false,status:"candidates_for_human_review",queryCoverage:{queryTerms:counts.size,matchedVocabularyTerms:matched},candidates:candidates.slice(0,limit),warnings:[...model.warnings,...(!matched?["No query vocabulary is represented in this bounded latent index; no absence or compliance inference is warranted."]:[])]};
}

function validateIndex(index){
 if(!object(index)||index.format!=="esia-engagement-source-index"||index.schemaVersion!==1||typeof index.projectId!=="string"||typeof index.extractorVersion!=="string"||index.extractorVersion.length>200||!Array.isArray(index.documents)||index.documents.length>100||!Array.isArray(index.passages)||index.passages.length>2000||!Array.isArray(index.warnings)||index.warnings.length>2000||index.warnings.some(value=>typeof value!=="string"||value.length>4000))fail("The source extraction index is invalid or exceeds its scope.",409);
 const versions=new Set();for(const document of index.documents){if(!object(document)||typeof document.versionId!=="string"||versions.has(document.versionId)||!hex(document.sha256)||!["indexed","error","unavailable","unsupported"].includes(document.status)||!Array.isArray(document.passageIds)||document.passageIds.length>2000||document.passageIds.some(value=>typeof value!=="string"))fail("The cached original manifest is invalid.",409);versions.add(document.versionId);}
 for(const document of index.documents)if(document.ocrDerivatives!==undefined){if(!Array.isArray(document.ocrDerivatives)||document.ocrDerivatives.length>20000)fail('Retain bounded OCR derivatives.',409);const seen=new Set();for(const derivative of document.ocrDerivatives){validatePdfOcrDerivative(derivative,{versionId:document.versionId,sha256:document.sha256,page:derivative.page});if(seen.has(derivative.page))fail('Retain one exact OCR derivative per original page.',409);seen.add(derivative.page);}}
 const passagesByPage = new Map();for (const passage of index.passages) {let version = passagesByPage.get(passage.versionId);if (!version) passagesByPage.set(passage.versionId, version = new Map());const ids = version.get(passage.page) || [];ids.push(passage.id);version.set(passage.page, ids);}
 for (const document of index.documents) if (document.coverage !== undefined) {
  const coverage = document.coverage;
  if (!object(coverage) || coverage.format !== "esia-pdf-extraction-coverage" || coverage.schemaVersion !== 1 || !Number.isSafeInteger(coverage.totalPages) || coverage.totalPages < 1 || !Array.isArray(coverage.pages) || coverage.pages.length > 20000 || !coverage.pages.length || !Array.isArray(coverage.excludedRanges)) fail("The cached PDF page coverage is invalid.", 409);
  const seen = new Set();
  for (const page of coverage.pages) {
   if (!object(page) || !Number.isSafeInteger(page.page) || page.page < 1 || page.page > coverage.totalPages || seen.has(page.page) || !["extracted", "empty_or_ocr_needed", "truncated", "error"].includes(page.status) || !Number.isSafeInteger(page.extractedCharacters) || page.extractedCharacters < 0 || !Number.isSafeInteger(page.indexedCharacters) || page.indexedCharacters < 0 || page.indexedCharacters > page.extractedCharacters || page.indexedCharacters > 256000 || !Array.isArray(page.passageIds) || page.passageIds.some(id => !document.passageIds.includes(id)) || (page.status === "extracted" && page.indexedCharacters !== page.extractedCharacters) || (page.status === "truncated" && page.indexedCharacters >= page.extractedCharacters) || (page.status === "error" && (page.indexedCharacters || page.passageIds.length))) fail("The cached PDF page state or passage coverage is invalid.", 409);
   const actual = passagesByPage.get(document.versionId)?.get(page.page) || [];
   if (stableJson(actual) !== stableJson(page.passageIds)) fail("The cached PDF page passages differ from their coverage manifest.", 409);
   seen.add(page.page);
  }
  if (index.passages.some(passage => passage.versionId === document.versionId && !seen.has(passage.page))) fail("The cached PDF passage has no exact page-coverage state.", 409);
  const range = coverage.requestedRange;
  if (range !== null && (!object(range) || Object.keys(range).length !== 2 || !Number.isSafeInteger(range.startPage) || range.startPage < 1 || !Number.isSafeInteger(range.endPage) || range.endPage < range.startPage || range.endPage > coverage.totalPages || range.endPage - range.startPage >= 200)) fail("The cached PDF extraction window is invalid.", 409);
  if (stableJson(coverage) !== stableJson(summarizePdfCoverage(coverage.totalPages, coverage.pages, range))) fail("The cached PDF excluded pages or continuation differ from their exact coverage states.", 409);
 }
 const ids=new Set();for(const passage of index.passages){const source=index.documents.find(item=>item.versionId===passage.versionId);if(typeof passage.id!=="string"||ids.has(passage.id)||typeof passage.quote!=="string"||!passage.quote.trim()||passage.quote.length>2000||!hex(passage.sha256)||source?.sha256!==passage.sha256||passage.sourceSha256!==passage.sha256||!source.passageIds.includes(passage.id)||typeof passage.locator!=="string"||passage.locator.length>4000||typeof passage.method!=="string"||passage.method.length>200||!(passage.page===null||Number.isSafeInteger(passage.page)&&passage.page>0)||passage.extraction?.page!==passage.page||passage.extraction?.extractorVersion!==index.extractorVersion||passage.extraction.method!==passage.method||passage.extraction.range?.basis!==(passage.method==='tesseract-ocr-derivative'?'ocr_derivative_utf16_code_units':'extracted_text_utf16_code_units')||!Number.isSafeInteger(passage.extraction.range.start)||!Number.isSafeInteger(passage.extraction.range.end)||passage.extraction.range.start<0||passage.extraction.range.end>256000||passage.extraction.range.end-passage.extraction.range.start!==passage.quote.length)fail("The cached passage identity or extraction span is invalid.",409);if(passage.method==='tesseract-ocr-derivative'){
 const derivative=source.ocrDerivatives?.find(row=>row.page===passage.page&&row.derivativeSha256===passage.derivative?.derivativeSha256),value=passage.derivative;
 if(!derivative||passage.citationEligibility!=='requires_original_page_confirmation'||!object(value)||value.format!=='esia-ocr-passage-provenance'||value.schemaVersion!==1||value.sourceVersionId!==passage.versionId||value.sourceSha256!==passage.sha256||value.page!==passage.page||value.textSha256!==derivative.textSha256||value.engine!==derivative.engine||value.language!==derivative.language||stableJson(value.confidence)!==stableJson(derivative.confidence)||derivative.text.slice(passage.extraction.range.start,passage.extraction.range.end)!==passage.quote)fail('The OCR candidate differs from its exact page derivative.',409);
 }else if(passage.derivative!==undefined||passage.citationEligibility!==undefined)fail('Canonical extraction cannot claim OCR provenance.',409);
 const expected=`passage:${hash(`${index.extractorVersion}:${passage.versionId}:${passage.sha256}:${passage.page}:${passage.method==='tesseract-ocr-derivative'?`ocr:${passage.derivative.derivativeSha256}:`:''}${passage.extraction.range.start}:${passage.quote}`).slice(0,48)}`;if(passage.id!==expected)fail("The derived passage identity differs from its retained extraction.",409);ids.add(passage.id);}return index;
}
/** Continue only an unchanged retained PDF corpus. Repeating a window replaces
 * those pages atomically and deterministically; it never duplicates passages. */
export function mergeEngagementSourceIndexes(previous, next) {
 validateIndex(previous);validateIndex(next);
 if (previous.projectId !== next.projectId || previous.extractorVersion !== next.extractorVersion) fail("Continue an index for the same project and extraction method. Rebuild older indexes explicitly.", 409);
 const replacements = new Map();
 for (const document of next.documents) {
  const original = previous.documents.find(item => item.versionId === document.versionId);
  if (!original || original.sha256 !== document.sha256 || !original.coverage || !document.coverage || original.coverage.totalPages !== document.coverage.totalPages || document.status !== "indexed") fail("Continue only successfully extracted exact PDF versions already present in this index.", 409);
  replacements.set(document.versionId, new Set(document.coverage.pages.map(item => item.page)));
 }
 const passages = [...previous.passages.filter(passage => !replacements.get(passage.versionId)?.has(passage.page)), ...next.passages]
  .sort((a, b) => a.versionId.localeCompare(b.versionId) || (a.page || 0) - (b.page || 0) || a.extraction.range.start - b.extraction.range.start);
 if (passages.length > 2000) fail("The continued index exceeds 2,000 passages. Start a separate explicit page-window index.", 413);
 const documents = previous.documents.map(original => {
  const document = next.documents.find(item => item.versionId === original.versionId);if (!document) return structuredClone(original);
  const pages = [...original.coverage.pages.filter(page => !replacements.get(original.versionId).has(page.page)), ...document.coverage.pages];
  if (pages.length > 20000) fail("The continued index exceeds 20,000 retained page states. Start a separate page-window index.", 413);
  const coverage = summarizePdfCoverage(original.coverage.totalPages, pages, null);
  const hasText = passages.some(passage => passage.versionId === document.versionId), stillTruncated = coverage.pages.some(page => page.status === "truncated");
  const warnings = [...new Set([...original.warnings, ...document.warnings])].filter(warning => !(hasText && warning.startsWith("No readable passage text")) && !(!stillTruncated && warning.startsWith("Extracted text exceeded 256,000")));
  const ocrDerivatives=[...(original.ocrDerivatives||[]).filter(row=>!replacements.get(original.versionId).has(row.page)),...(document.ocrDerivatives||[])].sort((a,b)=>a.page-b.page);
  return {...document,...(ocrDerivatives.length?{ocrDerivatives}:{}), passageIds: passages.filter(passage => passage.versionId === document.versionId).map(passage => passage.id), coverage, warnings};
 });
 // Coverage page-passage IDs follow canonical page order after replacement.
 const result = {format:previous.format,schemaVersion:previous.schemaVersion,projectId:previous.projectId,extractorVersion:previous.extractorVersion,method:documents.some(doc=>doc.ocrDerivatives?.length)?'exact_source_extraction_with_explicit_ocr_derivatives':previous.method,aiUsed:previous.aiUsed,documents,passages:passages.map(({indexId,extractionReference,...passage})=>passage),warnings:previous.warnings,limits:{...previous.limits,maxSourceBytes:Math.max(previous.limits?.maxSourceBytes||16*1024*1024,next.limits?.maxSourceBytes||16*1024*1024)}};validateIndex(result);return result;
}
const corpusIdentity=index=>hash(stableJson({extractorVersion:index.extractorVersion,documents:index.documents,passages:index.passages}));
const indexKey=(accountId,project,corpusSha256)=>`index_${hash(stableJson({accountId,projectId:project.id,projectRevision:project.revision,corpusSha256,algorithm:latentIndexVersion}))}`;
const envelope=payload=>({format:"esia-derived-evidence-index",schemaVersion:1,payload,sha256:hash(stableJson(payload))});
const statFile=path=>{const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail("Derived evidence cache files cannot use linked filesystem targets.",409);return stat;};
function readCacheBytes(path){
 let descriptor;
 try{
  descriptor=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const before=fstatSync(descriptor);
  if(!before.isFile()||before.nlink!==1)fail("Derived evidence cache files cannot use linked filesystem targets.",409);
  if(!Number.isSafeInteger(before.size)||before.size<0||before.size>evidenceIndexLimits.entryBytes)fail("The derived cache exceeds its entry limit. Rebuild a smaller batch.",413);
  // Read only the opened regular file, with one bounded extra byte to detect
  // growth. Pathname swaps cannot redirect this read after descriptor checks.
  const bytes=Buffer.alloc(before.size+1);let offset=0;
  while(offset<bytes.length){const count=readSync(descriptor,bytes,offset,bytes.length-offset,offset);if(count===0)break;offset+=count;}
  const after=fstatSync(descriptor);
  if(after.size>evidenceIndexLimits.entryBytes||offset>evidenceIndexLimits.entryBytes)fail("The derived cache exceeds its entry limit. Rebuild a smaller batch.",413);
  if(!after.isFile()||after.nlink!==1||after.size!==before.size||offset!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)fail("The derived cache changed while reading. Rebuild it explicitly.",409);
  return bytes.subarray(0,offset);
 }catch(error){if(error.code==="ENOENT")fail("This derived index is unavailable; explicitly rebuild the selected sources.",404);if(error.code==="ELOOP")fail("Derived evidence cache files cannot use linked filesystem targets.",409);throw error;}
 finally{if(descriptor!==undefined)closeSync(descriptor);}
}

export function createEngagementEvidenceIndexCache({directory,storage}={}){
 if(storage&&!["read","write","has"].every(key=>typeof storage[key]==="function"))fail("Use an internal bounded derived-index storage adapter.");
 const root=storage?null:privateStorageDirectory(directory),pathFor=id=>{if(!indexIdentity(id))fail("Choose an exact retained index identifier.");return join(root,`${id}.json`);};if(!storage)mkdirSync(root,{recursive:true,mode:0o700});
 const has=id=>storage?storage.has(id):existsSync(pathFor(id));
 function read(id){if(!indexIdentity(id))fail("Choose an exact retained index identifier.");const bytes=storage?storage.read(id):readCacheBytes(pathFor(id));if(!(bytes instanceof Uint8Array)||bytes.byteLength>evidenceIndexLimits.entryBytes)fail("The derived cache exceeds its entry limit. Rebuild a smaller batch.",413);let value;try{value=JSON.parse(Buffer.from(bytes).toString("utf8"));}catch{fail("The derived index JSON is corrupt; rebuild it explicitly.",409);}if(value?.format!=="esia-derived-evidence-index"||value.schemaVersion!==1||!object(value.payload)||value.payload.indexId!==id||!hex(value.sha256)||value.sha256!==hash(stableJson(value.payload)))fail("The derived evidence index failed its SHA256 integrity check.",409);validateIndex(value.payload.index);if(value.payload.semantic)validateModel(value.payload.semantic,value.payload.index.passages);return value.payload;}
 function write(payload){const bytes=Buffer.from(JSON.stringify(envelope(payload)));if(bytes.length>evidenceIndexLimits.entryBytes)fail("This derived index exceeds 12 MiB; choose fewer versions.",413);if(storage){storage.write(payload.indexId,bytes);return payload;}const path=pathFor(payload.indexId),entries=readdirSync(root).filter(name=>/^index_[a-f0-9]{64}\.json$/.test(name)).map(name=>({path:join(root,name),...statFile(join(root,name))})).filter(entry=>entry.path!==path).sort((a,b)=>a.mtimeMs-b.mtimeMs||a.path.localeCompare(b.path));let total=entries.reduce((sum,item)=>sum+item.size,0),count=entries.length;while(entries.length&&(total+bytes.length>evidenceIndexLimits.cacheBytes||count+1>evidenceIndexLimits.entries)){const oldest=entries.shift();rmSync(oldest.path);total-=oldest.size;count--;}if(existsSync(path))statFile(path);const temporary=join(root,`.pending-${randomUUID()}.json`);try{writeFileSync(temporary,bytes,{mode:0o600,flag:"wx"});renameSync(temporary,path);}finally{if(existsSync(temporary))rmSync(temporary);}return payload;}
 function scope(payload,{accountId,project}){if(payload.accountId!==accountId||payload.projectId!==project.id)fail("This index is outside the selected account/project.",404);if(payload.projectRevision!==project.revision)fail("The project changed after indexing. Explicitly rebuild its current source selection.",409);if(payload.corpusSha256!==corpusIdentity(payload.index)||payload.indexId!==indexKey(accountId,project,payload.corpusSha256))fail("The index source manifest or identity changed. Rebuild it explicitly.",409);}
 async function originals(payload,{project,readVersion}){let total=0;for(const document of payload.index.documents){const version=project.resources.flatMap(item=>item.versions).find(item=>item.id===document.versionId);if(!version||version.sha256!==document.sha256)fail("An indexed source version or hash changed; rebuild the source index.",409);if(document.status!=="indexed")continue;if(!Number.isSafeInteger(version.size)||version.size<0||version.size>Math.min(64*1024*1024,payload.index.limits?.maxSourceBytes||16*1024*1024)||(total+=version.size)>64*1024*1024)fail("The retained-index original recheck exceeds its bounded source-byte budget.",413);const retained=await readVersion(version.id),bytes=retained?.bytes??retained;if(!(bytes instanceof Uint8Array)||bytes.length!==version.size||hash(bytes)!==version.sha256)fail("An indexed original is unavailable or changed; restore exact bytes before reuse.",409);}}
 const publicIndex=payload=>({...payload.index,indexId:payload.indexId,corpusSha256:payload.corpusSha256,projectRevision:payload.projectRevision,passages:payload.index.passages.map(passage=>({...passage,indexId:payload.indexId,extractionReference:{indexId:payload.indexId,passageId:passage.id}})),semantic:payload.semantic?{method:payload.semantic.method,algorithm:payload.semantic.algorithm,dimensions:payload.semantic.dimensions,coverage:payload.semantic.coverage,limits:evidenceIndexLimits,warnings:payload.semantic.warnings}:null});
 return Object.freeze({
  store({accountId,project,index,semantic=false}){validateIndex(index);if(index.projectId!==project.id||typeof accountId!=="string"||!accountId)fail("Scope a derived index to its owning project and account.");const corpusSha256=corpusIdentity(index),indexId=indexKey(accountId,project,corpusSha256);let payload;if(has(indexId)){payload=read(indexId);scope(payload,{accountId,project});}else payload={accountId,projectId:project.id,projectRevision:project.revision,indexId,corpusSha256,index:structuredClone(index),semantic:null};if(semantic&&!payload.semantic)payload.semantic=fitLatentIndex(index.passages);write(payload);return publicIndex(payload);},
  async load({accountId,project,indexId,readVersion,semantic=false}){const payload=read(indexId);scope(payload,{accountId,project});await originals(payload,{project,readVersion});if(semantic&&!payload.semantic){payload.semantic=fitLatentIndex(payload.index.passages);write(payload);}return publicIndex(payload);},
  async sourcePassages({accountId,project,indexId,versionId,readVersion}) {
   const payload = read(indexId);
   // Metadata candidates may be saved sequentially after the owning project
   // acquires newer descriptive revisions. Verify the retained corpus/key under
   // its original revision, then independently verify this source in the current
   // project below. Whole-index search/reopen keeps the stricter current head.
   if (!Number.isSafeInteger(payload.projectRevision) || payload.projectRevision < 1) fail("The retained source index has an invalid project revision.",409);
   scope(payload,{accountId,project:{...project,revision:payload.projectRevision}});
   const document = payload.index.documents.find(item => item.versionId === versionId);
   if (!document || document.status !== "indexed") fail("The retained index has no available extraction for this exact source version.",409);
   // This source-specific metadata operation returns no other original's text.
   // Recheck only its currently authorized exact bytes; do not require unrelated
   // source access merely because the index was built from a larger batch.
   await originals({...payload,index:{...payload.index,documents:[document]}},{project,readVersion});
   return {extractorVersion:payload.index.extractorVersion,passages:payload.index.passages.filter(passage=>passage.versionId===versionId)};
  },
  async search({accountId,project,indexId,readVersion,query,retrieval="semantic",limit=12,lexical}){
   if(!["lexical","semantic","hybrid"].includes(retrieval)||typeof lexical!=="function")fail("Choose lexical, semantic or hybrid retrieval.");
   const index=await this.load({accountId,project,indexId,readVersion,semantic:retrieval!=="lexical"}),payload=read(indexId),latent=retrieval!=="lexical"?rankLatentPassages(index.passages,payload.semantic,query,{limit}):null,token=retrieval!=="semantic"?lexical(index,{query,limit}):null;
   let result;if(retrieval==="lexical")result={...token,indexId,corpusSha256:index.corpusSha256,projectRevision:index.projectRevision};
   else if(retrieval==="semantic")result={...latent,indexId,corpusSha256:index.corpusSha256,projectRevision:index.projectRevision,semantic:index.semantic};
   else{const merged=new Map(),maxToken=Math.max(1,...token.candidates.map(item=>item.score));for(const candidate of [...token.candidates,...latent.candidates]){const scores={lexical:token.candidates.find(item=>item.id===candidate.id)?.score/maxToken||0,semantic:latent.candidates.find(item=>item.id===candidate.id)?.score||0};merged.set(candidate.id,{...candidate,scores,score:.5*scores.lexical+.5*scores.semantic});}result={method:"local_hybrid_lexical_latent",algorithm:latentIndexVersion,aiUsed:false,status:"candidates_for_human_review",indexId,corpusSha256:index.corpusSha256,projectRevision:index.projectRevision,semantic:index.semantic,queryCoverage:latent.queryCoverage,candidates:[...merged.values()].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,limit),warnings:latent.warnings};}
   const uniquePages=rows=>[...new Set(rows.map(row=>row.page).filter(Number.isSafeInteger))].sort((a,b)=>a-b);
   const searched=retrieval==='semantic'&&!latent.queryCoverage.matchedVocabularyTerms?[]:index.passages;
   result.searchCoverage={extractorVersion:index.extractorVersion,passageSetSha256:hash(stableJson(searched.map(row=>row.id).sort())),searchedPassages:searched.length,candidatePassageIds:result.candidates.map(row=>row.id),sources:index.documents.map(document=>{
    const rows=searched.filter(row=>row.versionId===document.versionId),candidates=result.candidates.filter(row=>row.versionId===document.versionId),coverage=document.coverage;
    return {versionId:document.versionId,sourceSha256:document.sha256,totalPages:coverage?.totalPages??null,extractedPages:uniquePages((coverage?.pages||[]).filter(row=>row.status==='extracted')),unreadablePages:uniquePages((coverage?.pages||[]).filter(row=>['empty_or_ocr_needed','error'].includes(row.status))),truncatedPages:uniquePages((coverage?.pages||[]).filter(row=>row.status==='truncated')),ocrPages:uniquePages(document.ocrDerivatives||[]),excludedRanges:coverage?.excludedRanges||[],searchedPages:uniquePages(rows),candidatePages:uniquePages(candidates),searchedPassages:rows.length};
   })};return result;
  },
  async resolveExtraction({accountId,project,indexId,passageId,sourceReviewId,sourceReviews=[],actorId,readVersion,quote,versionId,locator}){
   const index=await this.load({accountId,project,indexId,readVersion}),passage=index.passages.find(item=>item.id===passageId);
   if(!passage||passage.versionId!==versionId||passage.locator!==locator)fail("The citation must retain the selected passage's exact version and locator.",409);
   const ocr=passage.method==='tesseract-ocr-derivative';let originalPageReview;
   if(ocr){
    const review=sourceReviews.find(row=>row.id===sourceReviewId&&row.mode==='full_page_review'&&row.createdBy===actorId&&row.review.versionId===passage.versionId&&row.review.sourceSha256===passage.sha256&&row.review.fullPageOriginalReviewed===true&&row.review.pages.includes(passage.page));
    if(!review)fail('OCR text requires a retained complete original-page review by the acting practitioner for this exact version, hash and page.',409);
    originalPageReview={recordId:review.id,actorId:review.createdBy,at:review.createdAt};
   }else if(sourceReviewId!==undefined)fail('Original-page confirmation references apply only to OCR derivative candidates.');
   const excerpt=typeof quote==='string'?quote.trim():'',start=passage.quote.indexOf(excerpt);
   if(!excerpt||start<0)fail("The citation quote must be an exact contiguous excerpt of the selected passage.",409);
   const binding={format:'esia-extraction-binding',schemaVersion:1,indexId,corpusSha256:index.corpusSha256,passageId,accountId,projectId:project.id,projectRevision:project.revision,method:passage.method,extractorVersion:index.extractorVersion,sourceVersionId:passage.versionId,sourceSha256:passage.sha256,page:passage.page,range:{start:passage.extraction.range.start+start,end:passage.extraction.range.start+start+excerpt.length,basis:ocr?'ocr_derivative_utf16_code_units':'extracted_text_utf16_code_units'},locator,quoteSha256:hash(excerpt),...(ocr?{derivative:structuredClone(passage.derivative),originalPageReview}: {})};
   return {...binding,bindingSha256:hash(stableJson(binding))};
  }
 });
}

/** Same index/model/binding validation, with bounded rebuildable memory only.
 * Current document authorization and exact original rechecks remain required. */
export function createEngagementEvidenceIndexMemoryCache(){
 const entries=new Map();let size=0;
 const remove=id=>{const value=entries.get(id);if(value){size-=value.byteLength;entries.delete(id);}};
 const storage={has:id=>entries.has(id),read(id){const value=entries.get(id);if(!value)fail("This derived index is unavailable; explicitly rebuild the selected sources.",404);entries.delete(id);entries.set(id,value);return Buffer.from(value);},write(id,bytes){if(bytes.byteLength>evidenceIndexLimits.entryBytes)fail("This derived index exceeds its entry bound.",413);remove(id);while(entries.size>=evidenceIndexLimits.entries||size+bytes.byteLength>evidenceIndexLimits.cacheBytes)remove(entries.keys().next().value);const copy=Buffer.from(bytes);entries.set(id,copy);size+=copy.byteLength;}};
 return Object.freeze({...createEngagementEvidenceIndexCache({storage}),clear(){entries.clear();size=0;},stats(){return {entries:entries.size,bytes:size};}});
}

export function validateAssertionExtraction(extraction,assertion,{accountId,projectId,sourceReviews=[]}={}){
 if(extraction===undefined)return;
 const ocr=extraction?.method==='tesseract-ocr-derivative',keys=["format","schemaVersion","indexId","corpusSha256","passageId","accountId","projectId","projectRevision","method","extractorVersion","sourceVersionId","sourceSha256","page","range","locator","quoteSha256","bindingSha256",...(ocr?['derivative','originalPageReview']:[])];
 if(!object(extraction)||Object.keys(extraction).length!==keys.length||Object.keys(extraction).some(key=>!keys.includes(key))||extraction.format!=="esia-extraction-binding"||extraction.schemaVersion!==1||!indexIdentity(extraction.indexId)||!hex(extraction.corpusSha256)||!hex(extraction.sourceSha256)||!hex(extraction.quoteSha256)||!hex(extraction.bindingSha256)||extraction.accountId!==accountId||extraction.projectId!==projectId||!Number.isSafeInteger(extraction.projectRevision)||extraction.projectRevision<1||extraction.sourceVersionId!==assertion.versionId||extraction.sourceSha256!==assertion.sourceSha256||extraction.locator!==assertion.locator||typeof extraction.method!=="string"||!extraction.method||extraction.method.length>200||typeof extraction.extractorVersion!=="string"||!extraction.extractorVersion||extraction.extractorVersion.length>200||typeof extraction.passageId!=="string"||extraction.passageId.length>192||!(extraction.page===null||Number.isSafeInteger(extraction.page)&&extraction.page>0)||!object(extraction.range)||Object.keys(extraction.range).sort().join(",")!=="basis,end,start"||extraction.range.basis!==(ocr?'ocr_derivative_utf16_code_units':"extracted_text_utf16_code_units")||!Number.isSafeInteger(extraction.range.start)||!Number.isSafeInteger(extraction.range.end)||extraction.range.start<0||extraction.range.end>256000||extraction.range.end-extraction.range.start!==assertion.quote.length||extraction.quoteSha256!==hash(assertion.quote))fail("The retained extraction binding does not match this exact citation, source or custody.",409);
 if(ocr){
  const derivative=extraction.derivative,confirmation=extraction.originalPageReview,review=sourceReviews.find(row=>row.id===confirmation?.recordId);
  const derivativeKeys=['format','schemaVersion','derivativeSha256','sourceVersionId','sourceSha256','page','textSha256','engine','language','confidence'];
  if(!object(derivative)||Object.keys(derivative).length!==derivativeKeys.length||Object.keys(derivative).some(key=>!derivativeKeys.includes(key))||derivative.format!=='esia-ocr-passage-provenance'||derivative.schemaVersion!==1||!hex(derivative.derivativeSha256)||!hex(derivative.textSha256)||derivative.sourceVersionId!==extraction.sourceVersionId||derivative.sourceSha256!==extraction.sourceSha256||derivative.page!==extraction.page||derivative.engine!=='tesseract-tsv'||derivative.language!=='eng'||!(derivative.confidence===null||Number.isFinite(derivative.confidence)&&derivative.confidence>=0&&derivative.confidence<=100))fail('Retain exact OCR derivative provenance without relabelling it canonical PDF text.',409);
  if(!object(confirmation)||Object.keys(confirmation).sort().join(',')!=='actorId,at,recordId'||review?.mode!=='full_page_review'||review.createdBy!==confirmation.actorId||review.createdAt!==confirmation.at||review.review.versionId!==extraction.sourceVersionId||review.review.sourceSha256!==extraction.sourceSha256||review.review.fullPageOriginalReviewed!==true||!review.review.pages.includes(extraction.page)||assertion.createdAt&&Date.parse(confirmation.at)>Date.parse(assertion.createdAt))fail('The OCR citation requires its exact retained human original-page review.',409);
 }
 const {bindingSha256,...content}=extraction;if(bindingSha256!==hash(stableJson(content)))fail("The retained extraction binding failed its SHA256 integrity check.",409);
}
