// Source-first capabilities shared by trusted engagement repository adapters.
// Authorization and durable CAS/metadata writes remain the caller's job before
// and after every awaited extraction, model request or rendering operation.
import {createHash} from "node:crypto";
import {evaluate} from "./engagement-engine.mjs";
import {indexEngagementSources,retrieveEngagementPassages,selectEngagementAssistancePassages,createEngagementAssistant} from "./engagement-assistance.mjs";
import {createEngagementEvidenceIndexMemoryCache,mergeEngagementSourceIndexes} from "./engagement-evidence-index.mjs";
import {normalizeEngagementSourceMetadata} from "./local-workspace-store.mjs";
import {exportEngagementSnapshot} from "./engagement-exports.mjs";
import {renditionSelection} from "./engagement-renditions.mjs";
import {normalizeDocumentProfile,normalizeDocumentClassification,documentProfileFromMetadata,canonicalDocumentValue} from "../src/lib/document-classification.js";
import {normalizeExtractionFacts} from "../src/lib/source-metadata.js";
import {assertEngagement as assert,exactKeys,isObject,normalizeProvenance,stableJson} from "../src/lib/engagement-domain.js";
import {projectMonitoringDisclosure} from '../src/lib/monitoring-protection.js';
import {prepareEngagementSourceReview} from './engagement-source-review.mjs';

const hash=value=>createHash("sha256").update(value).digest("hex");
const defaultIndexes=createEngagementEvidenceIndexMemoryCache(),disabledAssistant=createEngagementAssistant();
const author=(engagement,actorId)=>assert([...engagement.roles.preparer,...engagement.roles.reviewer].includes(actorId),"Document and assessment assistance requires an assigned preparer or reviewer.",403);
const noOverride=command=>{assert(isObject(command),"Use a structured document classification command.");if(command.provenance!==undefined)assert(isObject(command.provenance)&&!Object.hasOwn(command.provenance,"actorId")&&!Object.hasOwn(command.provenance,"at"),"The verified service supplies contribution actor and timestamp.",403);};

/** Shared local/authenticated preparation. Retaining a suggestion does not apply
 * its proposed descriptive fields. The source repository stores returned exact
 * metadata plus its prior immutable history under its own authority/CAS. */
export async function prepareEngagementDocumentClassification({engagement,project,command,actorId,at,readVersion,indexes,accountId=project?.accountId}={}){
  author(engagement,actorId);
  exactKeys(command,["type","versionId","sourceSha256","metadata","passageIds","indexId","provenance","requirementIds","statement"],"Document classification command");
  const resource=project.resources.find(item=>item.versions.some(version=>version.id===command.versionId)),version=resource?.versions.find(item=>item.id===command.versionId);
  assert(version,"Choose an exact document version in this engagement's source project.",404);
  const original=await readVersion(version.id),bytes=original?.bytes??original;
  assert(bytes instanceof Uint8Array&&bytes.byteLength===version.size&&hash(bytes)===version.sha256,"Document metadata requires its exact retained original bytes.",409);
  const previous=version.effectiveMetadata||resource.metadataHistory?.findLast(item=>item.versionId===version.id)?.metadata||version.intakeMetadata||{title:resource.title||version.filename,authors:[],documentDate:"",description:"",language:"",tags:[],receivedVia:"file_upload",extraction:{method:"manual",status:"unavailable",warnings:[]}};
  const links=values=>{assert(Array.isArray(values)&&values.length<=100&&new Set(values).size===values.length&&values.every(value=>engagement.requirements.some(item=>item.id===value)),"Document requirement links must belong to the owning engagement.");return values;};
  let metadata,classification;
  if(command.type==="metadata"){
    exactKeys(command,["type","versionId","metadata"],"Manual document metadata correction");
    // Correct ordinary descriptions independently of assistance. Existing
    // proposal/review records remain historical facts. The common normalizer
    // requires an explicit review before previously reviewed fields change.
    assert(canonicalDocumentValue(command.metadata?.classification)===canonicalDocumentValue(previous.classification),"Manual metadata cannot add, replace or erase a retained classification decision. Use its explicit review operation.",409);
    metadata=command.metadata;
    classification=previous.classification;
  }else if(command.type==="suggest"){
    exactKeys(command,["type","versionId","sourceSha256","metadata","passageIds","indexId","provenance"],"Document classification suggestion");
    assert(command.sourceSha256===version.sha256,"The proposed document SHA256 differs from its exact retained source.",409);
    const proposal=normalizeDocumentProfile(command.metadata),ids=command.passageIds;
    links(proposal.requirementIds);assert(Array.isArray(ids)&&ids.length>=1&&ids.length<=8&&new Set(ids).size===ids.length,"Select one to eight distinct exact passages supporting the document description.");
    assert(command.indexId===undefined||typeof indexes?.sourcePassages==="function","This retained source index is unavailable. Reindex before saving its document description.",409);
    const index=command.indexId===undefined?await indexEngagementSources({project,readVersion,versionIds:[version.id]}):await indexes.sourcePassages({accountId,project,indexId:command.indexId,versionId:version.id,readVersion}),selected=ids.map(passageId=>index.passages.find(item=>item.id===passageId&&item.versionId===version.id&&item.sourceSha256===version.sha256));
    assert(selected.every(Boolean),"A document classification passage no longer matches the exact source extraction. Reindex and review the original.",409);
    classification=normalizeDocumentClassification({schemaVersion:1,engagementId:engagement.id,sourceVersionId:version.id,sourceSha256:version.sha256,status:"suggested",proposal,evidence:selected.map(item=>({passageId:item.id,versionId:item.versionId,sourceSha256:item.sourceSha256,locator:item.locator,quote:item.quote,method:item.method,extractorVersion:item.extraction.extractorVersion,page:item.page,range:item.extraction.range})),provenance:normalizeProvenance(command.provenance,actorId,at),proposedBy:actorId,proposedAt:at});
    metadata={...previous,classification};
  }else if(command.type==="review"){
    exactKeys(command,["type","versionId","metadata","requirementIds","statement"],"Document classification human review");
    const prior=previous.classification;assert(prior&&prior.engagementId===engagement.id,"Retain this engagement's own document classification before recording its review. Another engagement's decision is not authority here.",409);
    assert(canonicalDocumentValue(command.metadata?.classification)===canonicalDocumentValue(prior),"The retained document proposal or its earlier review changed. Refresh before reviewing it.",409);
    const reviewedProfile=documentProfileFromMetadata(command.metadata,links(command.requirementIds));
    classification=normalizeDocumentClassification({...prior,status:canonicalDocumentValue(prior.proposal)===canonicalDocumentValue(reviewedProfile)?"human_confirmed":"human_modified",reviewedProfile,review:{actorId,at,statement:command.statement}});
    metadata={...command.metadata,classification};
  }else assert(false,"Choose a manual document correction, suggestion or human review operation.");
  metadata=normalizeEngagementSourceMetadata(metadata,version.sha256,version.id);
  assert(stableJson(metadata.revisionRelation)===stableJson(previous.revisionRelation),"Document metadata and classification preserve the exact reviewed relationship. Use the explicit two-original comparison to change it.",409);
  const originalFacts=normalizeExtractionFacts(version.intakeMetadata?.extraction||{});
  assert(!originalFacts.sourceSha256||stableJson(originalFacts)===stableJson(normalizeExtractionFacts(metadata.extraction)),"Observed extraction facts remain pinned to their original version; correct descriptions without replacing them.");
  return {versionId:version.id,resourceId:resource.id,sourceSha256:version.sha256,engagementId:engagement.id,expectedProjectRevision:project.revision,previousMetadataSha256:hash(stableJson(previous)),metadata,classification};
}

export async function analyze({project,packages,originals,actorId,authority,execution,input,assistant=disabledAssistant,indexes=defaultIndexes,requirementContext,originArchives,retainedSourceProof}={}){
  assert(authority?.mode==="authenticated_user","Shared authenticated analysis requires externally verified User authority.",403);
  exactKeys(input,["operation","engagementId","expectedRevision","expectedProjectRevision","command","versionIds","pageRanges","ocrPages","maxSourceBytes","continueIndexId","query","retrieval","limit","indexId","task","cycleId","baselineId","format","selection","renditionId"],"Engagement analysis operation");
  const base={project,packages,originals,actorId,authority,execution,originArchives,retainedSourceProof},checked=evaluate({...base,input:{operation:"get",engagementId:input.engagementId}}),engagement=checked.result;
  const finish=(result,extra={})=>({...checked,result,...extra});
  const readVersion=versionId=>{const original=originals instanceof Map?originals.get(versionId):originals?.[versionId];assert(original,"Resolve this exact authorized original before analysis.",409);return original;};
  if(input.operation==="assistant")return finish(assistant.describe());
  if(input.operation==="issued-list"||input.operation==="issued-get")return evaluate({...base,input});
  if(input.operation==="command"){
    exactKeys(input,["operation","engagementId","expectedRevision","command"],"Source-bound engagement command");
    let extractionBinding,sourceReviewBinding;
    if(input.command?.type==='source-review-save'){
      const prior=(engagement.sourceReviews||[]).some(row=>row.requestKey===input.command.requestKey);
      assert(prior||input.expectedRevision===engagement.revision,'The engagement changed before retaining source coverage.',409);
      sourceReviewBinding=await prepareEngagementSourceReview({engagement,project,command:input.command,actorId,readVersion,indexes});
    }
    if(input.command?.type==="assertion-save"&&input.command.extractionReference!==undefined){
      assert(input.expectedRevision===engagement.revision,"The engagement changed before resolving this source passage.",409);
      exactKeys(input.command.extractionReference,["indexId","passageId","sourceReviewId"],"Indexed extraction reference");
      extractionBinding=await indexes.resolveExtraction({accountId:project.accountId,project,...input.command.extractionReference,sourceReviews:engagement.sourceReviews||[],actorId,readVersion,quote:input.command.quote,versionId:input.command.versionId,locator:input.command.locator});
    }
    return evaluate({...base,input,commandOptions:{...(extractionBinding?{extractionBinding}:{}),...(sourceReviewBinding?{sourceReviewBinding}:{}),...(requirementContext?{requirementContext}:{})}});
  }
  if(input.operation==="document-classification"){
    exactKeys(input,["operation","engagementId","expectedRevision","expectedProjectRevision","command"],"Document classification request");
    assert(engagement.executionAuthority?.issuer===authority.issuer,"Keep historical local classification separate from authenticated execution.",403);
    assert(input.expectedRevision===engagement.revision&&input.expectedProjectRevision===project.revision,"The engagement or source project changed. Refresh before reviewing document classification.",409);
    noOverride(input.command);
    const change=await prepareEngagementDocumentClassification({engagement,project,command:input.command,actorId,at:execution?.at||new Date().toISOString(),readVersion,indexes,accountId:project.accountId});
    return finish({classification:change.classification,metadata:change.metadata},{sourceMetadataChanges:[change]});
  }
  if(input.operation==="baseline-export"){
    exactKeys(input,["operation","engagementId","baselineId","format","selection"],"Published baseline export");
    const baseline=engagement.baselines.find(item=>item.id===input.baselineId);assert(baseline,"The approved baseline was not found in this engagement.",404);
    const publication=engagement.publications.find(item=>item.baselineId===baseline.id);assert(publication,"Complete the required acceptance and publish this approved baseline before exporting deliverables.",409);
    const selection=renditionSelection(baseline,input.selection),format=input.format||"json",existing=engagement.issuedRenditions.find(item=>item.baselineId===baseline.id&&item.publicationId===publication.id&&item.format===format&&stableJson(item.selection)===stableJson(selection));
    if(existing)return evaluate({...base,input:{operation:"issued-get",engagementId:engagement.id,renditionId:existing.id}});
    const rendered=await exportEngagementSnapshot(baseline,format,selection);
    return evaluate({...base,input:{operation:"issued-retain",engagementId:engagement.id,expectedRevision:engagement.revision,baselineId:baseline.id,publicationId:publication.id,format,selection,rendered}});
  }
  assert(["index","search","assist"].includes(input.operation),"Choose source indexing, search, assistance, classification, a source-bound command or published output.");
  assert(input.query===undefined||typeof input.query==="string"&&input.query.length<=2000,"Use a search query of at most 2,000 characters.");
  const retrieval=input.retrieval||"lexical";assert(["lexical","semantic","hybrid"].includes(retrieval),"Choose lexical, semantic or hybrid retrieval.");
  if(input.operation==="search"){
    exactKeys(input,["operation","engagementId","indexId","query","retrieval","limit"],"Indexed passage search");
    return finish(await indexes.search({accountId:project.accountId,project,indexId:input.indexId,readVersion,query:input.query||"",retrieval,limit:input.limit??40,lexical:retrieveEngagementPassages}));
  }
  exactKeys(input,["operation","engagementId","versionIds","pageRanges","ocrPages","maxSourceBytes","query","retrieval",...(input.operation==="assist"?["task","cycleId","indexId"]:["indexId","continueIndexId"])],"Source index or assistance request");
  assert(input.indexId===undefined||typeof input.indexId==="string"&&/^index_[a-f0-9]{64}$/.test(input.indexId),"Choose an exact retained source index identifier.");
  assert(!(input.indexId!==undefined&&input.continueIndexId!==undefined),"Reopen an exact index or continue its PDF pages in separate explicit requests.");
  assert(input.indexId===undefined||input.pageRanges===undefined&&input.ocrPages===undefined&&input.maxSourceBytes===undefined,"A retained index already defines its exact page ranges.");
  assert(input.continueIndexId===undefined||typeof input.continueIndexId==="string"&&Array.isArray(input.versionIds)&&Array.isArray(input.pageRanges),"Continue an existing index with explicit source versions and PDF page ranges.");
  assert(!(input.indexId!==undefined&&input.versionIds!==undefined),"Select indexed sources or explicit source versions, not both.");
  const cycle=input.cycleId===undefined?null:engagement.cycles.find(item=>item.id===input.cycleId);assert(input.cycleId===undefined||cycle,"Select a monitoring cycle in this engagement.",404);
  if(input.operation==="assist"){
    author(engagement,actorId);
    assert(input.task!=="measurements"||cycle,"Select a monitoring cycle before extracting indicator measurements.");
    if(assistant.available===false)return finish(await assistant.propose({task:input.task}));
  }
  let index;
  if (input.indexId) index = await indexes.load({accountId:project.accountId,project,indexId:input.indexId,readVersion,semantic:retrieval!=="lexical"});
  else {
    const previous = input.continueIndexId ? await indexes.load({accountId:project.accountId,project,indexId:input.continueIndexId,readVersion}) : null;
    const extracted = await indexEngagementSources({project,readVersion,...(input.versionIds===undefined?{}:{versionIds:input.versionIds}),...(input.pageRanges===undefined?{}:{pageRanges:input.pageRanges}),...(input.ocrPages===undefined?{}:{ocrPages:input.ocrPages}),...(input.maxSourceBytes===undefined?{}:{maxSourceBytes:input.maxSourceBytes})});
    index = indexes.store({accountId:project.accountId,project,index:previous?mergeEngagementSourceIndexes(previous,extracted):extracted,semantic:retrieval!=="lexical"});
  }
  const search=query=>indexes.search({accountId:project.accountId,project,indexId:index.indexId,readVersion,query,retrieval,limit:40,lexical:retrieveEngagementPassages});
  if(input.operation==="index")return finish({...index,...(input.query?{matches:await search(input.query)}:{})});
  const assistantView=projectMonitoringDisclosure(engagement,{hideSourcePins:true}),mandate={id:engagement.id,name:engagement.name,scope:engagement.scope,exclusions:engagement.exclusions,client:engagement.client,deliverables:engagement.deliverables},requirements=assistantView.requirements.filter(item=>!item.restrictedAvailable&&(!cycle||cycle.requirementIds.includes(item.id)));
  const selected=selectEngagementAssistancePassages(index,{task:input.task,query:input.query||"",requirements,engagement:mandate});selected.selection.indexId=index.indexId;
  if(retrieval!=="lexical"){
    const matches=await search(input.query||[mandate.name,...mandate.scope,...requirements.slice(0,200).map(item=>item.title+" "+item.text)].join(" ").slice(0,12000));let characters=0;
    selected.passages=matches.candidates.filter(passage=>{if(characters+passage.quote.length>48000)return false;characters+=passage.quote.length;return true;});
    selected.selection={...selected.selection,method:matches.method,algorithm:matches.algorithm,queryCoverage:matches.queryCoverage,indexId:index.indexId,selectedPassages:selected.passages.length,selectedDocuments:new Set(selected.passages.map(item=>item.versionId)).size,characters,requirementCandidates:[],warnings:[...selected.selection.warnings,...(matches.warnings||[]),"Latent retrieval does not establish applicability or source support; human review is required."]};
  }
  const result=await assistant.propose({task:input.task,query:input.query||"",engagement:mandate,requirements,assertions:assistantView.assertions.filter(item=>!item.restrictedAvailable),findings:assistantView.findings.filter(item=>(item.cycleId||null)===(cycle?.id||null)),actions:assistantView.actions.filter(item=>(item.cycleId||null)===(cycle?.id||null)),passages:selected.passages,selection:selected.selection,...(cycle?{cycleId:cycle.id,cycle,program:assistantView.programs.find(item=>item.id===cycle.programId),indicators:assistantView.indicators.filter(item=>item.programId===cycle.programId),priorFindings:assistantView.findings.filter(item=>!item.cycleId||assistantView.cycles.some(previous=>previous.id===item.cycleId&&previous.programId===cycle.programId&&previous.periodEnd<cycle.periodStart))}:{})});
  return finish({...result,selection:selected.selection});
}
