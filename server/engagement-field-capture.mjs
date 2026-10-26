// Trusted ingestion preparation only. Callers authenticate and independently
// require engagement edit + current author role, project edit, and every exact
// document's view permission before providing rows/bytes, then repeat these
// checks and current server lease validation before their final HEAD CAS.
import {createHash} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import {projectSourceProjection} from "./engagement-sources.mjs";
import {hostedFieldMetadata,assertHostedFieldManifest,assertConfiguredResourceAuthority,assertHostedFieldMetadata,fieldUploadPolicy} from "../src/lib/hosted-field-capture-model.js";
import {normalizeAuthenticatedFieldCaptureBinding,validateAuthenticatedFieldLinks} from "../src/lib/engagement-field-evidence.js";
import {normalizeFieldDevicePolicy,fieldDevicePolicyDigestInput,assertFieldDeviceLease} from "../src/lib/field-device-policy.js";
import {normalizeEngagementAuthentication} from "../src/lib/engagement-domain.js";
import {normalizeEngagementFieldLeaseCaseScope} from './engagement-field-lease.mjs';

export const authenticatedFieldCaptureLimits=Object.freeze({manifestBytes:1024*1024,mediaBytes:10*1024*1024,media:3});
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const fail=(message,statusCode=409)=>{throw Object.assign(new Error(message),{status:statusCode,statusCode});};
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const keys=(value,allowed,label)=>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail(`${label} contains unsupported fields.`);};
const id=value=>typeof value==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes("..");
const time=value=>{const instant=value instanceof Date?value.getTime():typeof value==="string"?Date.parse(value):value;if(!Number.isFinite(instant))fail("Use a valid trusted field ingestion clock.");return instant;};

function leaseAuthority({lease,engagement,projectRow,actorId,now}){
  keys(lease,["id","revision","scope","policySha256","expiresAt","retentionReviewAt","devicePolicy","deviceLease","caseScope"],"Trusted server field lease proof");normalizeEngagementFieldLeaseCaseScope(lease.caseScope);
  if(!id(lease.id)||!Number.isSafeInteger(lease.revision)||lease.revision<1)fail("Use the exact server-issued field lease identity and revision.",403);
  keys(lease.scope,["accountId","projectId","workspaceId","engagementId","userId"],"Trusted field lease scope");
  const expected={accountId:projectRow.value.account_id,projectId:projectRow.value.project_id,workspaceId:projectRow.value.workspace_id,engagementId:engagement.id,userId:actorId};
  if(!isDeepStrictEqual(lease.scope,expected))fail("The server field lease belongs to another User, engagement, account, workspace or project.",403);
  const effective=normalizeFieldDevicePolicy(lease.devicePolicy),current=normalizeFieldDevicePolicy(engagement.devicePolicy);
  if(!effective||lease.policySha256!==hash(fieldDevicePolicyDigestInput(effective)))fail("The trusted field lease must pin its explicit effective device policy.",403);
  if(current&&(!current.offlineAllowed&&effective.offlineAllowed||!current.allowSourceOriginals&&effective.allowSourceOriginals||effective.allowedSensitivities.some(value=>!current.allowedSensitivities.includes(value))||effective.maxOfflineHours>current.maxOfflineHours||effective.autoLockMinutes>current.autoLockMinutes||effective.retentionHours>current.retentionHours))fail("The current engagement device policy is stricter than this field lease. Reconnect for current policy review.",403);
  if(lease.expiresAt!==lease.deviceLease?.expiresAt||lease.retentionReviewAt!==lease.deviceLease?.retentionReviewAt||time(lease.expiresAt)<=now||time(lease.retentionReviewAt)<=now)fail("The server field lease expired or differs from its exact approved device deadline.",403);
  return effective;
}

export function prepareAuthenticatedFieldCapture({resourceAuthority,engagement,projectRow,accountStorage,manifest,media,actorId,authentication,lease,receivedAt,now=Date.now()}={}){
  normalizeEngagementAuthentication(authentication,actorId);const clock=time(now);
  if(!engagement||engagement.executionAuthority?.mode!=="authenticated_user"||engagement.executionAuthority.issuer!==authentication.issuer||![...(engagement.roles?.preparer||[]),...(engagement.roles?.reviewer||[])].includes(actorId))fail("Field ingestion requires an externally verified assigned engagement author.",403);
  if(engagement.projectId!==projectRow?.value.project_id||engagement.accountId!==projectRow?.value.account_id)fail("The field capture must use the engagement's exact source project and account.",403);
  try{fieldUploadPolicy(projectRow.value,{leaseProof:lease});}catch(error){fail(error.message,403);}
  const effective=leaseAuthority({lease,engagement,projectRow,actorId,now:clock});
  if(typeof receivedAt!=="string"||!Number.isFinite(Date.parse(receivedAt))||new Date(receivedAt).toISOString()!==receivedAt||Date.parse(receivedAt)>clock)fail("Use the trusted reserved ingestion timestamp, separate from the original capture date.");
  keys(manifest,["row","bytes"],"Exact retained field manifest");
  if(!Array.isArray(media)||media.length>authenticatedFieldCaptureLimits.media)fail("Select every original from one bounded retained capture.");
  for(const item of media)keys(item,["row","bytes"],"Exact retained field original");
  const projection=projectSourceProjection({projectRow,documentRows:[manifest.row,...media.map(item=>item.row)],accountStorage,resourceAuthority});
  let total=0;
  for(const item of [manifest,...media]){
    const value=item.row.value,limit=item===manifest?authenticatedFieldCaptureLimits.manifestBytes:authenticatedFieldCaptureLimits.mediaBytes;
    if(!(item.bytes instanceof Uint8Array)||item.bytes.byteLength<1||item.bytes.byteLength>limit||item.bytes.byteLength!==value.original.size_bytes||hash(item.bytes)!==value.original.sha256)fail("Retained field bytes do not match their exact verified original size and SHA256.");
    if(item!==manifest&&(total+=item.bytes.byteLength)>authenticatedFieldCaptureLimits.mediaBytes)fail("Captured originals exceed their bounded10MiB aggregate.",413);
    if(value.created_by!==actorId||value.original.finalized_by!==actorId)fail("A new capture's manifest and media must retain the actual verified uploader identity.",403);
  }
  const metadata=manifest.row.value.original_metadata?.[hostedFieldMetadata];
  try{assertHostedFieldMetadata(metadata);}catch(error){fail(error.message);}
  if(metadata.role!=="manifest"||metadata.engagementId!==engagement.id||metadata.leaseId!==lease.id||manifest.row.value.content_type!=="application/json")fail("Use the exact typed manifest registration for this engagement and server field lease.");
  let payload;
  try{payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(manifest.bytes));assertHostedFieldManifest(payload,{resourceAuthority,projectId:engagement.projectId,accountId:engagement.accountId,workspaceId:projectRow.value.workspace_id,forUpload:true});}catch(error){fail(error.message);}
  const record=payload.record;
  if(record.captureId!==metadata.captureId||payload.recordSha256!==metadata.recordSha256||hash(JSON.stringify(record))!==metadata.recordSha256||media.length!==payload.media.length)fail("The retained capture record differs from its immutable manifest registration or media closure.");
  assertFieldDeviceLease(effective,lease.deviceLease,{scope:{accountId:engagement.accountId,projectId:engagement.projectId,engagementId:engagement.id},policySha256:lease.policySha256,now:clock,sensitivity:record.sensitivity,includesOriginals:media.length>0});
  if(record.details?.spatial){const geometry=record.details.spatial.currentGeometry,point=record.location?.current;if(geometry?.type==="Point"?!point||point.longitude!==geometry.coordinates[0]||point.latitude!==geometry.coordinates[1]:Boolean(point))fail("The current field point must match its authored geometry; lines, areas and cleared geometry have no current point.");}
  for(const [index,expected]of payload.media.entries()){
    const value=media[index].row.value,binding=value.original_metadata?.[hostedFieldMetadata];
    try{assertHostedFieldMetadata(binding);}catch(error){fail(error.message);}
    if(binding.role!=="original"||binding.index!==index||binding.captureId!==record.captureId||binding.recordSha256!==payload.recordSha256||binding.engagementId!==engagement.id||binding.leaseId!==lease.id||value.artifact_id!==expected.reference.resource_id||value.filename!==expected.filename||value.content_type!==expected.mediaType||value.original.sha256!==expected.sha256||value.original.size_bytes!==expected.size||!isDeepStrictEqual(value.original.reference,expected.reference))fail("A field original differs from its exact capture registration, provider version or media index.");
  }
  const links=validateAuthenticatedFieldLinks(record.links,engagement,{captureId:record.captureId});
  const sourcePin=item=>{const row=item.row.value;return {resourceId:row.artifact_id,versionId:`hosted:${row.artifact_id}:${row.original.sha256}`,sha256:row.original.sha256};};
  const binding=normalizeAuthenticatedFieldCaptureBinding({format:"esia-authenticated-field-evidence",schemaVersion:1,captureId:record.captureId,recordSha256:payload.recordSha256,manifest:sourcePin(manifest),media:media.map(sourcePin),links,declaredAuthor:record.author,capturedAt:record.capturedAt,uploadedBy:actorId,receivedAt,leaseId:lease.id,leaseRevision:lease.revision,policySha256:lease.policySha256});
  const requirementIds=[...new Set([...(links.requirementIds||[]),...(links.context?.requirementId?[links.context.requirementId]:[])])];
  const assertionCommand={type:"assertion-save",versionId:binding.manifest.versionId,locator:`Field capture ${record.captureId}; retained canonical record`,quote:record.note||record.title,note:"Field observation retained for human evidence review. Recorded related records are context, not verified findings or action closure.",topics:[],requirementIds,reviewStatus:"suggested",classification:"manual",provenance:{kind:"human",method:`Retained signed-in field capture ${record.captureId}; original record SHA256 ${payload.recordSha256}`}};
  return {captureId:record.captureId,recordSha256:payload.recordSha256,manifestSha256:binding.manifest.sha256,sourceArtifactIds:[binding.manifest,...binding.media].map(item=>item.resourceId),sourceVersionIds:[binding.manifest,...binding.media].map(item=>item.versionId),assertionCommand,fieldCaptureBinding:binding,project:projection.project,sources:projection.sources};
}

/** Reopen/import/approval integrity against actual retained originals. Historical
 * policy receipts and captures remain evidence after their device lease expires;
 * this verifies the frozen source assertions, not today's write permission. */
export function validateAuthenticatedFieldCaptureOriginals({project,packages,readVersion,retainedBinding}={}){
  if(!Array.isArray(packages)||typeof readVersion!=="function")fail("Supply exact field evidence packages and their authorized original reader.");
  const versions=new Map((project.resources||[]).flatMap(resource=>(resource.versions||[]).map(version=>[version.id,{...version,resourceId:resource.id}]))),parsed=new Map();
  const original=pin=>{
    const version=versions.get(pin.versionId);if(!version||version.resourceId!==pin.resourceId||version.sha256!==pin.sha256)fail("Retained field source metadata differs from its canonical original pin.");
    const value=readVersion(pin.versionId),bytes=value?.bytes??value;
    if(!(bytes instanceof Uint8Array)||bytes.byteLength!==version.size||hash(bytes)!==pin.sha256)fail("Retained field original bytes differ from their exact manifest or media hash.");
    return {version,bytes};
  };
  for(const pack of packages)for(const view of [{engagement:pack.engagement,assertions:pack.entities?.assertions||[]},...(pack.baselines||[])])for(const assertion of view.assertions||[])for(const record of [...(assertion.history||[]),assertion]){
    if(!record.fieldCapture)continue;const binding=normalizeAuthenticatedFieldCaptureBinding(record.fieldCapture);
    if(retainedBinding?.({engagementId:view.engagement.id,record})===true){for(const pin of [binding.manifest,...binding.media]){const version=versions.get(pin.versionId);if(!version||version.resourceId!==pin.resourceId||version.sha256!==pin.sha256)fail('Retained private field evidence differs from its exact canonical source descriptors.');}continue;}
    let payload=parsed.get(binding.manifest.versionId);
    if(!payload){
      const {version,bytes}=original(binding.manifest);if(bytes.byteLength>authenticatedFieldCaptureLimits.manifestBytes||version.mediaType!=="application/json")fail("Retained field evidence must reference its bounded JSON original manifest.");
      try{payload=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));assertHostedFieldManifest(payload,{resourceAuthority:assertConfiguredResourceAuthority(version.reference?.authority),projectId:view.engagement.projectId,accountId:view.engagement.accountId,workspaceId:version.reference?.workspace_id||payload.media?.[0]?.reference?.workspace_id,forUpload:true});}catch(error){fail(error.message);}
      parsed.set(binding.manifest.versionId,payload);
    }
    if(payload.projectId!==view.engagement.projectId||payload.accountId!==view.engagement.accountId||payload.record.captureId!==binding.captureId||payload.recordSha256!==binding.recordSha256||hash(JSON.stringify(payload.record))!==binding.recordSha256||payload.record.author!==binding.declaredAuthor||payload.record.capturedAt!==binding.capturedAt||!isDeepStrictEqual(payload.record.links,binding.links)||payload.media.length!==binding.media.length)fail("Retained field provenance differs from its exact original capture record, attribution or relationships.");
    for(const [index,pin]of binding.media.entries()){
      const {version}=original(pin),expected=payload.media[index];
      if(expected.reference.resource_id!==pin.resourceId||expected.sha256!==pin.sha256||expected.size!==version.size||expected.filename!==version.filename||expected.mediaType!==version.mediaType||version.reference&&!isDeepStrictEqual(version.reference,expected.reference))fail("Retained field media differs from its exact original manifest and immutable provider reference.");
    }
  }
  return true;
}
