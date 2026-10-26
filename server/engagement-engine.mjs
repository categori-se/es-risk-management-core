// Trusted repository adapter boundary, not an HTTP authentication endpoint.
// The caller verifies the identity, current engagement/source permissions and
// durable package authority, then commits returned packages with its own CAS.
import {DatabaseSync} from "node:sqlite";
import {createHash} from "node:crypto";
import {createEngagementStore,engagementPackageSourceVersionIds} from "./engagement-store.mjs";
import {validateAuthenticatedFieldCaptureOriginals} from "./engagement-field-capture.mjs";
import {constructEngagementSuccessor} from "./engagement-successor-constructor.mjs";
import {createEngagementOriginArchiveContext} from "./engagement-origin-archives.mjs";
import {assertEngagementRetainedSourceProof,advanceEngagementRetainedSourceProof,retainedEngagementSourceVersion,retainedEngagementFieldBinding} from './engagement-retained-source-proof.mjs';
import {assertEngagement as assert,exactKeys,isObject,boundedText,normalizeEngagementAuthentication,stableJson,uuidPattern} from "../src/lib/engagement-domain.js";

export const engagementEngineLimits = Object.freeze({projectBytes:8*1024*1024,originalBytes:64*1024*1024,totalOriginalBytes:64*1024*1024,originals:1000});
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
function executionOptions(execution) {
  if (execution === undefined) return {};
  exactKeys(execution,["requestId","at"],"Trusted engagement execution reservation");
  assert(uuidPattern.test(execution.requestId||"") && typeof execution.at === "string" && Number.isFinite(Date.parse(execution.at)) && new Date(execution.at).toISOString() === execution.at,"Reserve an exact UUID request and canonical timestamp before evaluating a durable operation.");
  let counter = 0;
  return {now:() => execution.at,newId:() => {
    const value = hash(stableJson(["esia-engagement-engine-uuid-v1",execution.requestId,counter++]));
    return `${value.slice(0,8)}-${value.slice(8,12)}-8${value.slice(13,16)}-${((parseInt(value[16],16)&3)|8).toString(16)}${value.slice(17,20)}-${value.slice(20,32)}`;
  }};
}
function rejectActorOverride(value,actorId) {
  assert(isObject(value),"Use an explicit engagement command or mandate.");
  for (const key of ["actorId","createdBy","updatedBy","reviewedBy","confirmedBy","closedBy","publishedBy","supersededByActor"]) assert(!Object.hasOwn(value,key),"Authenticated actor attribution is supplied by the verified service, not command fields.",403);
  if (value.provenance !== undefined) {
    assert(isObject(value.provenance),"Use structured contribution provenance.");
    assert(!Object.hasOwn(value.provenance,"actorId") && !Object.hasOwn(value.provenance,"at"),"The verified service supplies contribution actor and timestamp.",403);
  }
}
function originalAuthority(project,originals) {
  const descriptors = new Map();
  assert(Array.isArray(project.resources) && project.resources.length <= engagementEngineLimits.originals,"Supply a bounded authorized source project.",413);
  for (const resource of project.resources) {
    assert(Array.isArray(resource.versions),"Source resources require exact retained version descriptors.");
    for (const version of resource.versions) {
      boundedText(version.id,"Original source version ID",{required:true,max:192});
      assert(!descriptors.has(version.id),"Original source version identities must be unique.");descriptors.set(version.id,version);
    }
  }
  assert(descriptors.size <= engagementEngineLimits.originals,"The authorized source descriptor set exceeds its bound.",413);
  assert(originals instanceof Map || isObject(originals),"Supply the exact preauthorized original version/bytes map.");
  const entries = originals instanceof Map ? [...originals] : Object.entries(originals);
  assert(entries.length <= engagementEngineLimits.originals,"Too many original versions in one engine evaluation.",413);
  const verified = new Map();let total = 0;
  for (const [versionId,original] of entries) {
    const descriptor = descriptors.get(versionId);assert(descriptor,"Original bytes do not belong to the authorized source project.",403);
    exactKeys(original,["bytes"],"Preverified original bytes");
    assert(original.bytes instanceof Uint8Array,"Supply original bytes as a Buffer or Uint8Array.");
    const bytes = original.bytes;
    total += bytes.byteLength;
    assert(bytes.byteLength <= engagementEngineLimits.originalBytes && total <= engagementEngineLimits.totalOriginalBytes,"Original bytes exceed the bounded engine evaluation limit.",413);
    assert(Number.isSafeInteger(descriptor.size) && descriptor.size === bytes.byteLength && descriptor.sha256 === hash(bytes),"Original source bytes do not match their exact version size and SHA256.",409);
    verified.set(versionId,{bytes:Buffer.from(bytes)});
  }
  return {versionIds:new Set(verified.keys()),readVersion:(projectId,versionId) => {
    assert(projectId === project.id,"Original source project scope differs.",403);
    const original = verified.get(versionId);assert(original,"The exact authorized original bytes are unavailable; resolve source access before continuing.",409);return original;
  }};
}

function validateOriginFieldOriginals(context,project,readVersion,retainedBinding){
  const bySha=new Map(project.resources.flatMap(resource=>resource.versions.map(version=>[version.sha256,version.id])));
  for(const descriptor of context.descriptors()){
    const archived=context.read(descriptor.sha256),sources=new Map(archived.sources.map(row=>[row.versionId,row]));
    validateAuthenticatedFieldCaptureOriginals({project:archived.project,packages:archived.packages,retainedBinding,readVersion:versionId=>{const source=sources.get(versionId),current=bySha.get(source?.sha256);assert(current,"A retained origin field original is absent from the current exact-byte source mapping.",409);return readVersion(project.id,current);}});
  }
}

/** Evaluate one explicit operation without durable files, workers or network.
 * `authority` and bind-role inputs are INTERNAL trusted-adapter values. Portable
 * authentication descriptors are historical assertions, not token verification.
 * No package is committed until the repository rechecks current authority/CAS. */
export function evaluate({project,packages=[],originals=new Map(),actorId,input,authority,execution,commandOptions,originArchives=new Map(),retainedSourceProof,currentTime=Date.now()}={}) {
  assert(Number.isSafeInteger(currentTime)&&currentTime>=0,"Use the trusted current server clock separately from the durable execution reservation.");
  assert(isObject(project) && Buffer.byteLength(JSON.stringify(project)) <= engagementEngineLimits.projectBytes,"Supply a bounded authorized source-project projection.",413);
  project = structuredClone(project);
  boundedText(project.id,"Source project ID",{required:true,max:192});
  const accountId = boundedText(project.accountId,"Owning account ID",{required:true,max:192});
  exactKeys(input,["operation","fields","engagementId","expectedRevision","command","role","acceptedUserId","renditionId","rendered","baselineId","publicationId","format","selection","archive","workspaceId","sourceEngagementId","sourceMappings","policyAuthorizations"],"Engagement engine operation");
  assert(["create","successor","command","get","export","bind-role","issued-list","issued-get","issued-retain"].includes(input.operation),"Choose an explicit supported engagement engine operation.");
  if(commandOptions!==undefined)exactKeys(commandOptions,["extractionBinding","sourceReviewBinding","offlineOperation","sourceRegistration","requirementContext","fieldCaptureBinding","authenticatedOfflineLease","caseProtection"],"Trusted engagement command options");
  if(commandOptions?.sourceReviewBinding!==undefined)assert(input.operation==='command'&&input.command?.type==='source-review-save','Trusted source coverage applies only to its explicit retained-review command.',403);
  if(commandOptions?.caseProtection!==undefined)assert(authority&&input.operation==='command'&&input.command?.type==='monitoring-case-details-save'&&commandOptions.caseProtection===true,'Trusted case field permission applies only to the exact native protected detail operation.',403);
  if(commandOptions?.fieldCaptureBinding!==undefined)assert(authority&&input.operation==="command"&&input.command?.type==="assertion-save","Trusted field capture provenance is limited to authenticated citation attachment.",403);
  if(commandOptions?.authenticatedOfflineLease!==undefined)assert(authority&&input.operation==="command"&&commandOptions.offlineOperation&&["finding-save","action-save"].includes(input.command?.type),"Trusted authenticated offline permission applies only to explicit native human draft reconciliation.",403);
  if (authority !== undefined) {
    exactKeys(authority,["mode","userId","issuer","subject"],"Trusted engagement authority");
    assert(authority.mode === "authenticated_user","Use externally verified User authority.");
    normalizeEngagementAuthentication({userId:authority.userId,issuer:authority.issuer,subject:authority.subject},actorId);
  }
  if (["create","successor","command","bind-role"].includes(input.operation)) boundedText(actorId,"Verified acting User",{required:true,max:300});
  assert(originArchives instanceof Map,"Supply exact internal origin archive proofs.");
  originArchives=new Map(originArchives);
  if(input.operation==="successor"){
    assert(authority&&packages.length===0,"Construct a successor only as a new authenticated engagement with an empty current head.",403);
    exactKeys(input,["operation","engagementId","workspaceId","sourceEngagementId","archive","sourceMappings","policyAuthorizations"],"Successor engine operation");
    exactKeys(input.archive,["bytes","sha256"],"Exact successor archive");
    assert(input.archive.bytes instanceof Uint8Array&&hash(input.archive.bytes)===input.archive.sha256,"Successor archive bytes differ from their exact SHA256.",409);
    const prior=originArchives.get(input.archive.sha256);assert(!prior||prior.bytes instanceof Uint8Array&&Buffer.from(prior.bytes).equals(Buffer.from(input.archive.bytes)),"The supplied origin archive differs from its retained proof.",409);
    originArchives.set(input.archive.sha256,{bytes:input.archive.bytes});
  }
  const originArchiveContext=createEngagementOriginArchiveContext(originArchives),timing=executionOptions(execution);
  const source = originalAuthority(project,originals), database = new DatabaseSync(":memory:");
  const checkOriginal=versionId=>retainedSourceProof&&retainedEngagementSourceVersion(retainedSourceProof,versionId,project)||source.readVersion(project.id,versionId),retainedBinding=retainedSourceProof?binding=>retainedEngagementFieldBinding(retainedSourceProof,binding):undefined;
  let store;
  try {
    if(retainedSourceProof){assert(authority?.mode==='authenticated_user','Retained private history proofs apply only to trusted native execution.',403);assertEngagementRetainedSourceProof(retainedSourceProof,{project,packages,input,authority,originArchives,availableVersionIds:source.versionIds});}
    store = createEngagementStore({database,accountId,authority,originArchiveContext,currentTime:()=>currentTime,getProject:id => {assert(id === project.id,"Engagement project scope differs.",403);return structuredClone(project);},readVersion:source.readVersion,...timing});
    store.importProject(project.id,packages);
    // Check every retained citation before returning its aggregate content.
    const priorSources = engagementPackageSourceVersionIds(project,packages,{originArchiveContext});
    priorSources.forEach(checkOriginal);
    validateAuthenticatedFieldCaptureOriginals({project,packages,readVersion:versionId=>source.readVersion(project.id,versionId),retainedBinding});
    validateOriginFieldOriginals(originArchiveContext,project,source.readVersion,retainedBinding);
    let result;
    switch (input.operation) {
      case "successor": {
        originArchiveContext.read(input.archive.sha256);
        const authentication=normalizeEngagementAuthentication({userId:authority.userId,issuer:authority.issuer,subject:authority.subject},actorId);
        const constructed=constructEngagementSuccessor({bytes:input.archive.bytes,expectedSha256:input.archive.sha256,destination:{engagementId:input.engagementId,workspaceId:input.workspaceId,sourceEngagementId:input.sourceEngagementId,project,sourceMappings:input.sourceMappings},authentication,at:timing.now?.()||new Date().toISOString(),policyAuthorizations:input.policyAuthorizations||[],originArchiveContext,newId:timing.newId});
        store.importProject(project.id,[constructed.package]);result=store.get(input.engagementId);break;
      }
      case "create":
        exactKeys(input,["operation","fields"],"Create engine operation");
        if (authority) rejectActorOverride(input.fields,actorId);
        assert(!Object.hasOwn(input.fields,"projectId"),"The trusted source projection supplies the engagement project.");
        result = store.create({...input.fields,projectId:project.id,actorId});break;
      case "command":
        exactKeys(input,["operation","engagementId","expectedRevision","command"],"Command engine operation");
        assert(input.command?.type !== "accept-role-assignment","Role acceptance requires the trusted invitation operation.",403);
        if (authority) rejectActorOverride(input.command,actorId);
        result = store.mutate(input.engagementId,input.expectedRevision,input.command,actorId,commandOptions);break;
      case "bind-role":
        exactKeys(input,["operation","engagementId","expectedRevision","role","acceptedUserId"],"Trusted assignment engine operation");
        assert(authority && input.acceptedUserId === actorId,"Bind only the verified recipient accepting this exact invitation.",403);
        result = store.mutate(input.engagementId,input.expectedRevision,{type:"accept-role-assignment",role:input.role,acceptedUserId:input.acceptedUserId},actorId,{roleAssignment:true});break;
      case "get":
        exactKeys(input,["operation","engagementId"],"Get engine operation");result = store.get(input.engagementId);break;
      case "export":
        exactKeys(input,["operation"],"Export engine operation");result = store.exportProject(project.id);break;
      case "issued-list":
        exactKeys(input,["operation","engagementId"],"Issued-list engine operation");result={format:"esia-engagement-issued-renditions",schemaVersion:1,renditions:store.get(input.engagementId).issuedRenditions};break;
      case "issued-get":
        exactKeys(input,["operation","engagementId","renditionId"],"Issued-read engine operation");result=store.getIssuedRendition(input.engagementId,input.renditionId);break;
      case "issued-retain": {
        // INTERNAL only: bytes have just been produced by the shared renderer,
        // never supplied as an authenticated browser command or public import.
        exactKeys(input,["operation","engagementId","expectedRevision","baselineId","publicationId","format","selection","rendered"],"Trusted issued-retention engine operation");
        exactKeys(input.rendered,["bytes","filename","mediaType"],"Shared rendered output");
        const engagement=store.get(input.engagementId);
        assert(authority&&engagement.executionAuthority?.issuer===authority.issuer,"Retain authenticated outputs only in their original verified execution authority.",403);
        assert(input.expectedRevision===engagement.revision,"The engagement changed before retaining the issued output.",409);
        result=store.retainIssuedRendition(input.engagementId,{baselineId:input.baselineId,publicationId:input.publicationId,format:input.format,selection:input.selection,...input.rendered});break;
      }
    }
    const nextPackages = store.exportProject(project.id), sourceVersionIds = engagementPackageSourceVersionIds(project,nextPackages,{originArchiveContext});
    sourceVersionIds.forEach(checkOriginal);
    validateAuthenticatedFieldCaptureOriginals({project,packages:nextPackages,readVersion:versionId=>source.readVersion(project.id,versionId),retainedBinding});
    validateOriginFieldOriginals(originArchiveContext,project,source.readVersion,retainedBinding);
    const nextProof=retainedSourceProof?advanceEngagementRetainedSourceProof(retainedSourceProof,{project,packages:nextPackages,input,authority,originArchives,availableVersionIds:source.versionIds}):undefined;
    return {result,packages:nextPackages,sourceVersionIds,...(nextProof?{retainedSourceProof:nextProof}:{}),...(originArchiveContext.descriptors().length?{originArchiveDescriptors:originArchiveContext.descriptors()}:{})};
  } finally {if (store) store.close();else database.close();}
}
