// Exact-version source metadata in the same immutable engagement envelope.
// This validates retained attribution, not identity tokens or resource grants.
// Always pass the RAW authorized project projection; overlays are derived views.
import {createHash} from "node:crypto";
import {normalizeEngagementSourceMetadata} from "./local-workspace-store.mjs";
import {normalizeExtractionFacts} from "../src/lib/source-metadata.js";
import {documentComparisonMetadata,documentMetadataBaseline,validateDocumentRevisionGraph} from "../src/lib/document-relations.js";
import {assertEngagement as assert,exactKeys,isObject,stableJson,uuidPattern,sha256Pattern,normalizeEngagementAuthentication} from "../src/lib/engagement-domain.js";

export const engagementSourceMetadataLimits=Object.freeze({versions:100,revisions:1000,bytes:32*1024*1024});
const hash=value=>createHash("sha256").update(value).digest("hex");
const clone=value=>structuredClone(value);
const timestamp=value=>{assert(typeof value==="string"&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value,"Source metadata history requires an exact canonical timestamp.");return value;};
const metadataHash=metadata=>hash(stableJson(metadata));
function versionMap(project){
  assert(isObject(project)&&typeof project.id==="string"&&typeof project.accountId==="string"&&Number.isSafeInteger(project.revision)&&project.revision>0&&Array.isArray(project.resources),"Use the raw authorized source-project projection.");
  const versions=new Map();
  for(const resource of project.resources){assert(typeof resource.id==="string"&&Array.isArray(resource.versions),"Use exact retained source resources.");for(const version of resource.versions){assert(typeof version.id==="string"&&version.id.length<=192&&sha256Pattern.test(version.sha256||"")&&!versions.has(version.id),"Source metadata requires unique exact source versions and SHA256 pins.");versions.set(version.id,{resource,version});}}
  assert(versions.size<=engagementSourceMetadataLimits.versions,"Source metadata supports at most 100 explicitly selected original versions.",413);return versions;
}
function registeredMetadata(resource,version){return documentMetadataBaseline(resource,version);}
function canonicalMetadata(value,version){
  assert(isObject(value),"Retain standard structured source metadata.");
  const stack=[{value,depth:0}];let nodes=0;
  while(stack.length){const item=stack.pop();assert(++nodes<=8192&&item.depth<=24,"Source metadata exceeds its portable structural bounds.",413);const child=item.value;
    if(child===null||typeof child==="string"||typeof child==="boolean"||typeof child==="number"&&Number.isFinite(child))continue;
    assert(Array.isArray(child)||isObject(child)&&[Object.prototype,null].includes(Object.getPrototypeOf(child)),"Retained source metadata must contain portable JSON values only.");
    const add=entry=>{assert(nodes+stack.length<8192,"Source metadata exceeds its portable structural bounds.",413);stack.push({value:entry,depth:item.depth+1});};
    if(Array.isArray(child))for(const entry of child)add(entry);else for(const key in child)if(Object.hasOwn(child,key))add(child[key]);
  }
  const normalized=normalizeEngagementSourceMetadata(value,version.sha256,version.id);
  assert(stableJson(normalized)===stableJson(value)&&Object.keys(normalized).sort().join("\0")===Object.keys(value).sort().join("\0"),"Retained source metadata must use the exact normalized existing schema without ignored or rewritten fields.");return normalized;
}
const proposal=value=>Object.fromEntries(["schemaVersion","engagementId","sourceVersionId","sourceSha256","proposal","evidence","provenance","proposedBy","proposedAt"].map(key=>[key,value[key]]));
function checkTransition(previous,metadata,entry,engagementId,version){
  const classification=metadata.classification;
  const facts=normalizeExtractionFacts(version.intakeMetadata?.extraction||{});
  assert(!facts.sourceSha256||stableJson(facts)===stableJson(normalizeExtractionFacts(metadata.extraction)),"Source metadata history cannot replace original extraction observations.",409);
  if(stableJson(metadata.revisionRelation)!==stableJson(previous.revisionRelation)){
    const relation=metadata.revisionRelation;
    assert(entry.operation==="document-relation-review"&&relation&&relation.engagementId===engagementId&&relation.sourceVersionId===version.id&&relation.sourceSha256===version.sha256&&relation.review.actorId===entry.actorId&&relation.review.at===entry.at,"Document relationship changes require the trusted review operation and their exact engagement, original and verified reviewer/time.",409);
    assert(stableJson(documentComparisonMetadata(previous))===stableJson(documentComparisonMetadata(metadata)),"A relationship review cannot replace descriptive metadata or classification.",409);
    assert(relation.rightMetadataSha256===metadataHash(documentComparisonMetadata(previous)),"A document relationship must retain the descriptive metadata actually compared.",409);
  }
  // A human description can be corrected before assistance is used. Retaining
  // exactly the preceding decision cannot create, erase or renew a judgment.
  // canonicalMetadata independently requires any reviewed profile to continue
  // matching its recorded effective fields.
  if(stableJson(classification)===stableJson(previous.classification))return;
  assert(classification&&classification.engagementId===engagementId&&classification.sourceVersionId===version.id&&classification.sourceSha256===version.sha256,"Source metadata decisions must retain their own engagement and exact original version/hash.",409);
  for(const evidence of classification.evidence){
    const expected=`passage:${hash(`${evidence.extractorVersion}:${evidence.versionId}:${evidence.sourceSha256}:${evidence.page}:${evidence.range.start}:${evidence.quote}`).slice(0,48)}`;
    assert(evidence.passageId===expected,"Classification passage identity must retain its exact extractor, original, page, span and quotation.",409);
  }
  if(classification.status==="suggested"){
    assert(classification.proposedBy===entry.actorId&&classification.proposedAt===entry.at&&classification.provenance.actorId===entry.actorId&&classification.provenance.at===entry.at,"Document proposals require their exact verified contributing User and timestamp.",409);
    const {classification:oldDecision,...before}=previous,{classification:newDecision,...after}=metadata;
    assert(stableJson(before)===stableJson(after),"A suggested document description cannot replace effective accepted source metadata.",409);
  }else{
    assert(previous.classification?.engagementId===engagementId&&stableJson(proposal(previous.classification))===stableJson(proposal(classification)),"Human review must retain the exact preceding proposal and original evidence/provenance.",409);
    assert(classification.review.actorId===entry.actorId&&classification.review.at===entry.at,"Document review must retain its exact verified reviewing User and timestamp.",409);
  }
}

export function validateEngagementSourceMetadata({project,engagementId,sourceMetadata=[]}={}){
  assert(uuidPattern.test(engagementId||""),"Source metadata needs its exact engagement UUID.");
  const versions=versionMap(project);
  assert(Array.isArray(sourceMetadata)&&sourceMetadata.length<=engagementSourceMetadataLimits.versions,"Retain at most 100 version-scoped source metadata histories.",413);
  const records=new Set(),requestIds=new Set();let count=0,issuer;
  for(const record of sourceMetadata){
    exactKeys(record,["versionId","sourceSha256","resourceId","revisions"],"Version-scoped source metadata");
    const source=versions.get(record.versionId);assert(source&&source.resource.id===record.resourceId&&source.version.sha256===record.sourceSha256&&!records.has(record.versionId),"Source metadata history differs from its authorized immutable resource/version/hash.",409);records.add(record.versionId);
    assert(Array.isArray(record.revisions)&&record.revisions.length>0&&(count+=record.revisions.length)<=engagementSourceMetadataLimits.revisions,"Retain at most 1,000 source metadata revisions in one engagement envelope.",413);
    let previous=registeredMetadata(source.resource,source.version);assert(isObject(previous),"Retain the registered source metadata before describing or classifying its original.");
    for(const [index,entry]of record.revisions.entries()){
      exactKeys(entry,["id","revision","metadata","actorId","at","authentication","operation"],"Source metadata revision");
      assert(entry.operation===undefined||entry.operation==="document-relation-review","Source metadata history contains an unsupported trusted operation marker.");
      assert(uuidPattern.test(entry.id||"")&&!requestIds.has(entry.id)&&entry.revision===index+1,"Source metadata requests/revisions must have unique UUIDs and complete ordered history.",409);requestIds.add(entry.id);timestamp(entry.at);
      assert(!source.resource.metadataHistory?.some(item=>item.id===entry.id),"Apply source overlays to the raw registered source projection, not an already overlaid view.",409);
      const authentication=normalizeEngagementAuthentication(entry.authentication,entry.actorId);issuer??=authentication.issuer;assert(authentication.issuer===issuer,"One source metadata history must retain its original verified identity issuer.",409);
      const metadata=canonicalMetadata(entry.metadata,source.version);checkTransition(previous,metadata,entry,engagementId,source.version);previous=metadata;
    }
  }
  assert(Number.isSafeInteger(project.revision+count),"The source metadata revision token exceeds its integer bound.",413);
  for(const record of sourceMetadata)for(const entry of record.revisions){const relation=entry.metadata.revisionRelation;if(!relation||relation.engagementId!==engagementId)continue;const predecessor=versions.get(relation.predecessor.versionId);assert(predecessor&&predecessor.version.sha256===relation.predecessor.sha256,"A retained document relationship must identify its exact original predecessor.",409);const descriptions=[registeredMetadata(predecessor.resource,predecessor.version),...(predecessor.resource.metadataHistory||[]).filter(row=>row.versionId===relation.predecessor.versionId).map(row=>row.metadata),...(sourceMetadata.find(row=>row.versionId===relation.predecessor.versionId)?.revisions||[]).map(row=>row.metadata)];assert(descriptions.some(metadata=>metadata&&metadataHash(documentComparisonMetadata(metadata))===relation.leftMetadataSha256),"A retained document relationship must pin an actual retained description of the earlier exact version.",409);}
  const relationView=clone(project);for(const record of sourceMetadata){const source=relationView.resources.find(row=>row.id===record.resourceId)?.versions.find(row=>row.id===record.versionId);if(source)source.effectiveMetadata=clone(record.revisions.at(-1).metadata);}validateDocumentRevisionGraph(relationView,engagementId);
  let encoded;try{encoded=JSON.stringify(sourceMetadata);}catch{assert(false,"Source metadata history must remain portable JSON.");}
  assert(Buffer.byteLength(encoded)<=engagementSourceMetadataLimits.bytes,"Source metadata histories exceed the 32 MiB envelope limit.",413);
  return clone(sourceMetadata);
}

export function applyEngagementSourceMetadata({project,engagementId,sourceMetadata=[]}={}){
  const retained=validateEngagementSourceMetadata({project,engagementId,sourceMetadata}),view=clone(project),versions=versionMap(view);let count=0;
  for(const record of retained){const {resource,version}=versions.get(record.versionId);resource.metadataHistory??=[];for(const entry of record.revisions){resource.metadataHistory.push({id:entry.id,versionId:record.versionId,at:entry.at,metadata:clone(entry.metadata)});count++;}version.effectiveMetadata=clone(record.revisions.at(-1).metadata);}
  view.revision=project.revision+count;return view;
}

export function appendEngagementSourceMetadata({project,engagementId,sourceMetadata=[],change,requestId,at,authentication}={}){
  const retained=validateEngagementSourceMetadata({project,engagementId,sourceMetadata}),versions=versionMap(project),verified=normalizeEngagementAuthentication(authentication);
  assert(uuidPattern.test(requestId||""),"Source metadata changes require the reserved request UUID.");timestamp(at);
  exactKeys(change,["versionId","resourceId","sourceSha256","engagementId","expectedProjectRevision","previousMetadataSha256","metadata","classification","operation"],"Prepared source metadata change");
  assert(change.operation===undefined||change.operation==="document-relation-review","Use a trusted prepared document relationship operation.");
  const source=versions.get(change.versionId);assert(source&&source.resource.id===change.resourceId&&source.version.sha256===change.sourceSha256&&change.engagementId===engagementId,"The prepared source metadata change differs from its exact engagement/resource/version/hash.",409);
  assert(sha256Pattern.test(change.previousMetadataSha256||"")&&stableJson(change.classification)===stableJson(change.metadata?.classification),"The prepared change must retain its exact prior metadata hash and classification.",409);
  const normalized=canonicalMetadata(change.metadata,source.version),entry={id:requestId,revision:1,metadata:clone(normalized),actorId:verified.userId,at,authentication:verified,...(change.operation?{operation:change.operation}:{})};
  const existing=retained.find(record=>record.versionId===change.versionId);
  for(const record of retained){const index=record.revisions.findIndex(revision=>revision.id===requestId);if(index<0)continue;
    const previous=index?record.revisions[index-1].metadata:registeredMetadata(source.resource,source.version),prior=record.revisions[index];
    assert(record.versionId===change.versionId&&record.sourceSha256===change.sourceSha256&&metadataHash(previous)===change.previousMetadataSha256&&stableJson({...entry,revision:prior.revision})===stableJson(prior),"This reserved metadata request already belongs to different retained source work.",409);
    return {sourceMetadata:retained,project:applyEngagementSourceMetadata({project,engagementId,sourceMetadata:retained}),revision:prior.revision,duplicate:true};
  }
  const view=applyEngagementSourceMetadata({project,engagementId,sourceMetadata:retained}),currentSource=versionMap(view).get(change.versionId),previous=registeredMetadata(currentSource.resource,currentSource.version);
  assert(change.expectedProjectRevision===view.revision&&metadataHash(previous)===change.previousMetadataSha256,"Source metadata changed. Refresh the exact current document before appending its review.",409);
  entry.revision=(existing?.revisions.length||0)+1;checkTransition(previous,normalized,entry,engagementId,source.version);
  if(existing)existing.revisions.push(entry);else retained.push({versionId:change.versionId,sourceSha256:change.sourceSha256,resourceId:change.resourceId,revisions:[entry]});
  const checked=validateEngagementSourceMetadata({project,engagementId,sourceMetadata:retained});
  return {sourceMetadata:checked,project:applyEngagementSourceMetadata({project,engagementId,sourceMetadata:checked}),revision:entry.revision,duplicate:false};
}
