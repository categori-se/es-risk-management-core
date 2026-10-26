// Bounded exact-original comparison and human relationship preparation. The
// caller supplies fresh source authorization before/after I/O and durable CAS.
import {createHash} from "node:crypto";
import {indexEngagementSources,engagementIndexLimits} from "./engagement-assistance.mjs";
import {normalizeEngagementSourceMetadata} from "./local-workspace-store.mjs";
import {assertEngagement as assert,exactKeys,stableJson} from "../src/lib/engagement-domain.js";
import {documentComparisonMetadata,documentMetadataBaseline,normalizeDocumentRevisionRelation,validateDocumentRevisionGraph} from "../src/lib/document-relations.js";

export const documentComparisonLimits=Object.freeze({sources:2,sourceBytes:16*1024*1024,extractedCharactersPerSource:256000,lineRecords:16000,changedSections:24,quoteCharacters:2000,metadataValueCharacters:1000});
const hash=value=>createHash("sha256").update(value).digest("hex");
const metadataHash=value=>hash(stableJson(documentComparisonMetadata(value)));
function source(project,id){const resource=project.resources.find(item=>item.versions.some(version=>version.id===id)),version=resource?.versions.find(item=>item.id===id);assert(version,"Choose two exact versions in this engagement's source project.",404);assert(Number.isSafeInteger(version.size)&&version.size>=0&&version.size<=documentComparisonLimits.sourceBytes,"Compare originals of at most 16 MiB each.",413);return {resource,version,metadata:documentMetadataBaseline(resource,version)};}
function sourcePin(row){return {versionId:row.version.id,sha256:row.version.sha256,size:row.version.size,metadataSha256:metadataHash(row.metadata)};}
function lines(passages){const result=[];for(const passage of passages){const pieces=passage.quote.match(/[^\n]*\n|[^\n]+$/g)||[];let start=passage.extraction.range.start;for(const quote of pieces){assert(result.length<documentComparisonLimits.lineRecords,"This comparison exceeds 16,000 extracted line fragments. Inspect the exact originals in the reader.",413);result.push({key:quote,source:{versionId:passage.versionId,sha256:passage.sha256,sourceSha256:passage.sourceSha256,page:passage.page,quote,locator:passage.locator,extraction:{...passage.extraction,range:{...passage.extraction.range,start,end:start+quote.length}}}});start+=quote.length;}}return result;}
function anchors(left,right){
  const positions=rows=>{const map=new Map();rows.forEach((row,index)=>map.set(row.key,map.has(row.key)?-1:index));return map;},a=positions(left),b=positions(right),pairs=[];
  for(const [key,i]of a){const j=b.get(key);if(i>=0&&j>=0)pairs.push({i,j});}pairs.sort((a,b)=>a.i-b.i);
  // Longest increasing subsequence of unique unchanged line fragments. This
  // gives bounded text sections, without claiming a semantic contradiction.
  const tails=[],previous=new Int32Array(pairs.length).fill(-1);
  pairs.forEach((pair,index)=>{let lo=0,hi=tails.length;while(lo<hi){const mid=(lo+hi)>>1;if(pairs[tails[mid]].j<pair.j)lo=mid+1;else hi=mid;}if(lo)previous[index]=tails[lo-1];tails[lo]=index;});
  const result=[];let cursor=tails.at(-1);while(cursor!==undefined&&cursor>=0){result.push(pairs[cursor]);cursor=previous[cursor];}return result.reverse();
}
function excerpt(rows){if(!rows.length)return null;const first=rows[0].source;let quote=first.quote;let end=first.extraction.range.end;for(const row of rows.slice(1)){if(row.source.page!==first.page||row.source.extraction.range.start!==end||quote.length+row.key.length>documentComparisonLimits.quoteCharacters)break;quote+=row.key;end=row.source.extraction.range.end;}return {...first,quote,extraction:{...first.extraction,range:{...first.extraction.range,end}},sectionCharacters:rows.reduce((sum,row)=>sum+row.key.length,0),excerptCharacters:quote.length};}
function changedSections(left,right){const unchanged=anchors(left,right),result=[];let a=0,b=0,total=0;for(const next of [...unchanged,{i:left.length,j:right.length}]){const l=left.slice(a,next.i),r=right.slice(b,next.j);if(l.map(row=>row.key).join("")!==r.map(row=>row.key).join("")){total++;if(result.length<documentComparisonLimits.changedSections)result.push({number:total,left:excerpt(l),right:excerpt(r)});}a=next.i+1;b=next.j+1;}return {total,sections:result,omitted:Math.max(0,total-result.length)};}
const metadataKeys=["title","authors","publisher","documentDate","documentRevision","reportingPeriod","documentStatus","documentType","identifier","language","description","tags","locations","projectComponents","sourceUrl","rights","license"];
function display(value){const text=typeof value==="string"?value:value===undefined?"":stableJson(value);return {value:text.slice(0,documentComparisonLimits.metadataValueCharacters),truncated:text.length>documentComparisonLimits.metadataValueCharacters};}

export async function compareEngagementDocuments({engagement,project,leftVersionId,rightVersionId,readVersion}={}){
  assert(engagement?.id&&engagement.projectId===project?.id&&Array.isArray(project.resources)&&typeof readVersion==="function","Compare versions in their exact engagement and source project.");
  assert(typeof leftVersionId==="string"&&typeof rightVersionId==="string"&&leftVersionId!==rightVersionId,"Choose two distinct exact source versions.");
  const left=source(project,leftVersionId),right=source(project,rightVersionId),verified=new Map();
  // Verify BOTH originals even when hashes match. Extraction failures remain
  // explicit coverage limits; authorization and integrity failures propagate.
  for(const row of [left,right]){const retained=await readVersion(row.version.id),bytes=retained?.bytes??retained;assert(bytes instanceof Uint8Array&&bytes.byteLength===row.version.size&&hash(bytes)===row.version.sha256&&(!retained?.version?.id||retained.version.id===row.version.id),"The original no longer matches its exact source version/hash.",409);verified.set(row.version.id,bytes);}
  const index=await indexEngagementSources({project,versionIds:[leftVersionId,rightVersionId],maxDocuments:2,readVersion:id=>verified.get(id)});
  const a=index.documents[0],b=index.documents[1],leftLines=lines(index.passages.filter(row=>row.versionId===leftVersionId)),rightLines=lines(index.passages.filter(row=>row.versionId===rightVersionId));
  const coverage=[a,b].map(document=>({versionId:document.versionId,status:document.status,method:document.method,extractedCharacters:index.passages.filter(row=>row.versionId===document.versionId).reduce((sum,row)=>sum+row.quote.length,0),warnings:document.warnings}));
  const readable=coverage.every(row=>row.status==="indexed"&&row.extractedCharacters>0),changes=readable?changedSections(leftLines,rightLines):{total:0,sections:[],omitted:0};
  const value={format:"esia-document-comparison",schemaVersion:1,engagementId:engagement.id,projectId:project.id,left:sourcePin(left),right:sourcePin(right),sameBytes:left.version.sha256===right.version.sha256&&left.version.size===right.version.size,
    textComparison:!readable?"unavailable":changes.total?"extracted_text_differs":"extracted_text_equal",method:"unique_unchanged_line_sections",extractorVersion:index.extractorVersion,
    metadataDifferences:metadataKeys.filter(key=>stableJson(left.metadata[key])!==stableJson(right.metadata[key])).map(field=>({field,left:display(left.metadata[field]),right:display(right.metadata[field])})),
    changedPassages:changes.sections,changedSectionCount:changes.total,omittedSections:changes.omitted,coverage,
    warnings:["Text sections compare the bounded canonical extraction. Review the originals and their layout when deciding which document to use.","A text difference does not establish an environmental or social inconsistency; the relationship decision records the reviewer's judgment.",...(changes.omitted?[`${changes.omitted} further changed sections are available in the originals; this response shows the first 24.`]:[])],limits:documentComparisonLimits};
  return {...value,comparisonSha256:hash(stableJson(value))};
}

export async function prepareEngagementDocumentRelation({engagement,project,command,actorId,at,readVersion}={}){
  assert([...(engagement?.roles?.preparer||[]),...(engagement?.roles?.reviewer||[])].includes(actorId),"Document relationships require an assigned preparer or reviewer.",403);
  exactKeys(command,["leftVersionId","rightVersionId","leftSha256","rightSha256","leftMetadataSha256","rightMetadataSha256","comparisonSha256","decision","statement"],"Reviewed document relationship");
  const comparison=await compareEngagementDocuments({engagement,project,leftVersionId:command.leftVersionId,rightVersionId:command.rightVersionId,readVersion});
  assert(command.leftSha256===comparison.left.sha256&&command.rightSha256===comparison.right.sha256&&command.leftMetadataSha256===comparison.left.metadataSha256&&command.rightMetadataSha256===comparison.right.metadataSha256&&command.comparisonSha256===comparison.comparisonSha256,"A source or description changed. Compare the two current originals before recording this decision.",409);
  assert(command.decision!=="same_bytes"||comparison.sameBytes,"Only identical verified original bytes can be recorded as the same bytes.",409);
  const right=source(project,command.rightVersionId),relation=normalizeDocumentRevisionRelation({schemaVersion:1,engagementId:engagement.id,sourceVersionId:right.version.id,sourceSha256:right.version.sha256,predecessor:{versionId:comparison.left.versionId,sha256:comparison.left.sha256},leftMetadataSha256:comparison.left.metadataSha256,rightMetadataSha256:comparison.right.metadataSha256,comparisonSha256:comparison.comparisonSha256,decision:command.decision,review:{actorId,at,statement:command.statement}});
  validateDocumentRevisionGraph(project,engagement.id,{candidate:relation});
  const metadata=normalizeEngagementSourceMetadata({...right.metadata,revisionRelation:relation},right.version.sha256,right.version.id);
  return {operation:"document-relation-review",versionId:right.version.id,resourceId:right.resource.id,sourceSha256:right.version.sha256,engagementId:engagement.id,expectedProjectRevision:project.revision,previousMetadataSha256:hash(stableJson(right.metadata)),metadata,classification:metadata.classification};
}
