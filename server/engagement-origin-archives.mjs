// Exact retained origin proofs. This cache exists only for one foreground
// evaluation; it grants no source, policy-library or archive access.
import {createHash} from "node:crypto";
import {inspectEngagementSuccessorArchive} from "./engagement-successor.mjs";
import {engagementEntityNames,stableJson,uuidPattern} from "../src/lib/engagement-domain.js";
import {validateMonitoringCaseOrigin} from './engagement-case-origins.mjs';

export const engagementOriginArchiveLimits=Object.freeze({entries:8,totalBytes:64*1024*1024,archiveBytes:40*1024*1024});
const fail=message=>{throw Object.assign(new Error(message),{status:409,statusCode:409});};
const hash=bytes=>createHash("sha256").update(bytes).digest("hex");
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const exact=(value,keys)=>object(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
export function createEngagementOriginArchiveContext(originArchives=new Map()){
  if(!(originArchives instanceof Map)||originArchives.size>engagementOriginArchiveLimits.entries)fail("Supply at most8 explicit exact origin archives.");
  const inputs=new Map();let total=0;
  for(const[sha256,value]of originArchives){
    if(!/^[a-f0-9]{64}$/.test(sha256)||!exact(value,["bytes"])||!(value.bytes instanceof Uint8Array)||!value.bytes.byteLength||value.bytes.byteLength>engagementOriginArchiveLimits.archiveBytes||(total+=value.bytes.byteLength)>engagementOriginArchiveLimits.totalBytes||hash(value.bytes)!==sha256)fail("Origin archive bytes exceed their whole-closure bounds or differ from their exact SHA256.");
    inputs.set(sha256,{bytes:Buffer.from(value.bytes)});
  }
  const verified=new Map(),visiting=new Set();
  const context={read(sha256){
    if(verified.has(sha256))return verified.get(sha256);
    if(visiting.has(sha256))fail("Origin archive ancestry must not contain a cycle.");
    const input=inputs.get(sha256);if(!input)fail("The exact retained origin archive proof is unavailable; restore its verified bytes before continuing.");
    visiting.add(sha256);
    try{const inspected=inspectEngagementSuccessorArchive({...input,expectedSha256:sha256,originArchives:inputs,originArchiveContext:context});verified.set(sha256,inspected);return inspected;}finally{visiting.delete(sha256);}
  },descriptors(){return [...verified.values()].map(value=>({...value.archive})).sort((a,b)=>a.sha256.localeCompare(b.sha256));}};
  return context;
}

export function validateEngagementSuccessorOrigin(core,project,context,view){
  const value=core.successor;if(value===undefined)return;
  if(!exact(value,["format","schemaVersion","archiveSha256","archiveSize","engagementId","projectId","accountId","createdBy","createdAt","recordMappings","sourceMappings","policyMappings"])||value.format!=="esia-engagement-successor-origin"||value.schemaVersion!==1||!core.executionAuthority||value.createdBy!==core.createdBy||value.createdAt!==core.createdAt||!uuidPattern.test(value.engagementId||""))fail("A successor must retain its exact source archive and new authenticated constructor identity.");
  const archive=context?.read(value.archiveSha256),original=archive?.packages.find(pack=>pack.engagement.id===value.engagementId);
  if(!archive||archive.archive.size!==value.archiveSize||archive.archive.projectId!==value.projectId||archive.archive.accountId!==value.accountId||!original)fail("Successor lineage differs from its exact retained source archive.");
  if(!Array.isArray(value.recordMappings)||value.recordMappings.length>100000||!Array.isArray(value.sourceMappings)||value.sourceMappings.length!==archive.sources.length||!Array.isArray(value.policyMappings)||value.policyMappings.length!==archive.policyUses.length)fail("Retain the complete bounded original record, source and policy mappings.");
  const sourceRows=new Map(archive.sources.map(row=>[row.versionId,row])),target=new Map((project.resources||[]).flatMap(resource=>(resource.versions||[]).map(version=>[version.id,version]))),seenSources=new Set();
  for(const mapping of value.sourceMappings){
    if(!exact(mapping,["sourceVersionId","destinationVersionId","sha256","size"])||seenSources.has(mapping.sourceVersionId))fail("Successor source mappings must be exact and unique.");
    const from=sourceRows.get(mapping.sourceVersionId),to=target.get(mapping.destinationVersionId);
    if(!from||!to||mapping.sha256!==from.sha256||mapping.size!==from.size||to.sha256!==from.sha256||to.size!==from.size)fail("A successor source mapping substituted original bytes or omitted its exact version.");seenSources.add(mapping.sourceVersionId);
  }
  const originals=new Map(archive.records.filter(row=>row.path.startsWith(`/engagements/${archive.packages.indexOf(original)}/`)).map(row=>[`${row.kind}:${row.id}`,row]));
  for(const[kind,rows]of [["deliverables",original.engagement.deliverables],["amendments",original.engagement.amendments],["occurrences",original.entities.monitoringObligations?.flatMap(row=>row.occurrences||[])],["monitoringPoints",original.entities.missions?.flatMap(row=>row.monitoringPoints||[])]])for(const row of rows||[])originals.set(`${kind}:${row.id}`,{kind,id:row.id});
  const seenRecords=new Set(),destinations=new Set();
  const historicalKinds=new Set(["approvals","publications","baselines","audit","issuedRenditions","sourceReviews"]);
  for(const mapping of value.recordMappings){
    if(!exact(mapping,["kind","sourceId","destinationId","disposition"])||!originals.has(`${mapping.kind}:${mapping.sourceId}`)||seenRecords.has(`${mapping.kind}:${mapping.sourceId}`)||!["working_candidate","historical_only"].includes(mapping.disposition))fail("A successor record mapping differs from its exact original archive.");
    seenRecords.add(`${mapping.kind}:${mapping.sourceId}`);
    if((mapping.disposition==="historical_only")!==historicalKinds.has(mapping.kind))fail("Original working records must remain candidates, while original approvals, audit and issued records remain historical only.");
    if(mapping.disposition==="historical_only"){if(mapping.destinationId!==null)fail("Historical approvals and issued records cannot become current authenticated entities.");}
    else if(!uuidPattern.test(mapping.destinationId||"")||destinations.has(mapping.destinationId)){fail("Successor working identities must be new distinct UUIDs.");}else destinations.add(mapping.destinationId);
    if(mapping.disposition==="working_candidate"&&engagementEntityNames.includes(mapping.kind)&&!view?.[mapping.kind]?.some(row=>row.id===mapping.destinationId&&row.origin?.recordId===mapping.sourceId))fail("The successor must retain every mapped original working entity and its exact archive origin.");
  }
  if(seenRecords.size!==originals.size)fail("Every original entity and nested working identity must retain its explicit successor disposition.");
  const currentId=value.recordMappings.find(row=>row.kind==="engagement"&&row.sourceId===value.engagementId);if(currentId?.destinationId!==core.id)fail("The successor engagement identity differs from its origin map.");
  for(const use of archive.policyUses){
    const rows=value.policyMappings.filter(row=>row.frameworkId===use.frameworkId&&row.edition===use.edition&&row.sourcePackSha256===use.sourcePackSha256),row=rows[0];
    if(rows.length!==1||!exact(row,["frameworkId","edition","sourcePackSha256","destinationSourcePackSha256","sourceSha256s",...(row.legacyReview===undefined?[]:["legacyReview"])])||!/^[a-f0-9]{64}$/.test(row.destinationSourcePackSha256||"")||use.sourcePackSha256&&row.destinationSourcePackSha256!==use.sourcePackSha256||stableJson(row.sourceSha256s)!==stableJson(use.sourceSha256s))fail("Retain the explicit original policy-source pins and separately reviewed legacy migration.");
    if(use.requiresMigration){const review=row.legacyReview;if(!exact(review,["archiveSha256","frameworkId","edition","sourceSha256s","destinationSourcePackSha256","reviewedBy","reviewedAt","statement"])||review.archiveSha256!==value.archiveSha256||review.frameworkId!==use.frameworkId||review.edition!==use.edition||review.destinationSourcePackSha256!==row.destinationSourcePackSha256||stableJson(review.sourceSha256s)!==stableJson(use.sourceSha256s)||typeof review.reviewedBy!=="string"||!review.reviewedBy.trim()||review.reviewedBy.length>192||typeof review.reviewedAt!=="string"||!Number.isFinite(Date.parse(review.reviewedAt))||Date.parse(review.reviewedAt)>Date.parse(value.createdAt)||typeof review.statement!=="string"||review.statement.trim().length<20||review.statement.length>4000)fail("The legacy policy review must retain its exact archive, source pins, operator and explicit rights statement.");}
    else if(row.legacyReview!==undefined)fail("Known policy pins cannot be relabelled as an invented legacy migration.");
  }
  return {archive,original};
}

export function validateEngagementRecordOrigin(record,kind,core,context){
  if(record.origin===undefined)return;
  const origin=record.origin;
  if(!exact(origin,["archiveSha256","engagementId","kind","recordId"])||origin.archiveSha256!==core.successor?.archiveSha256||origin.engagementId!==core.successor.engagementId||origin.kind!==kind)fail("A working candidate origin must identify its exact retained source engagement and entity kind.");
  const mapping=core.successor.recordMappings.find(row=>row.kind===kind&&row.sourceId===origin.recordId);
  if(mapping?.disposition!=="working_candidate"||mapping.destinationId!==record.id)fail("The working candidate differs from its explicit original-to-successor identity map.");
  const archive=context.read(origin.archiveSha256),source=archive.packages.find(pack=>pack.engagement.id===origin.engagementId)?.entities[kind]?.find(row=>row.id===origin.recordId);
  if(!source)fail("The candidate's original record is absent from its exact retained archive.");
  if(kind==='events')validateMonitoringCaseOrigin(record,source,core,context,archive);
  if(kind==="monitoringObligations")for(const old of source.occurrences||[]){
    const mapping=core.successor.recordMappings.find(row=>row.kind==="occurrences"&&row.sourceId===old.id),current=record.occurrences?.find(row=>row.id===mapping?.destinationId),expected={archiveSha256:origin.archiveSha256,engagementId:origin.engagementId,kind:"occurrences",recordId:old.id};
    if(!current||stableJson(current.origin)!==stableJson(expected)||!["draft","reviewed"].includes(current.reviewStatus))fail("Every imported trigger occurrence must retain its exact origin and explicit new review state.");
    for(const past of record.history||[]){const previous=past.occurrences?.find(row=>row.id===current.id);if(previous&&stableJson(previous.origin)!==stableJson(current.origin))fail("Retain the imported trigger origin through every occurrence review.");}
  }
  if(kind==="requirements"&&record.frameworkId!=="project"){
    const fields=["frameworkId","checkId","checkSet","authority","frameworkName","edition","standard","clause","title","text","textKind","coverageNote","topics","sources","catalogDefinition"];
    if(fields.some(key=>stableJson(record[key])!==stableJson(source[key])))fail("Imported institutional wording, source references and edition context must remain exact.");
    const definition=structuredClone(record.definition),original=source.definition;
    if(original&&!original.sourcePackSha256&&definition?.sourcePackSha256){const policy=core.successor.policyMappings.find(row=>row.frameworkId===record.frameworkId&&row.edition===record.edition&&row.sourcePackSha256===null&&row.destinationSourcePackSha256===definition.sourcePackSha256&&row.legacyReview);if(!policy)fail("An imported unpinned source definition requires its explicit archive-bound operator review.");delete definition.sourcePackSha256;}
    if(stableJson(definition)!==stableJson(original))fail("Imported institutional source definitions must retain their original wording and context.");
  }
}

export function validateEngagementOriginBaseline(program,core,view,context){
  const ref=program.originBaselineRef;
  if(!exact(ref,["archiveSha256","engagementId","baselineId","baselineSha256"])||!core.successor||program.baselineId||program.sourceBaselineSha256)fail("An imported monitoring anchor must remain an explicit historical baseline reference, not a new authenticated DD approval.");
  const immediate=context?.read(core.successor.archiveSha256),source=immediate?.packages.find(pack=>pack.engagement.id===core.successor.engagementId),old=source?.entities.programs?.find(row=>row.id===program.origin?.recordId);
  const expectedRef=old?.originBaselineRef||{archiveSha256:core.successor.archiveSha256,engagementId:core.successor.engagementId,baselineId:old?.baselineId,baselineSha256:old?.sourceBaselineSha256};
  if(stableJson(ref)!==stableJson(expectedRef))fail("The monitoring origin reference does not match its archived program anchor.");
  const archive=context?.read(ref.archiveSha256),original=archive?.packages.find(pack=>pack.engagement.id===ref.engagementId),baseline=original?.baselines.find(row=>row.id===ref.baselineId&&row.sha256===ref.baselineSha256&&!row.scope);
  if(!baseline)fail("The monitoring origin baseline differs from its exact approved archive.");
  const oldActions=old.baselineActionIds||baseline.actions.map(row=>row.id),expected=oldActions.map(actionId=>core.successor.recordMappings.find(row=>row.kind==="actions"&&row.sourceId===actionId)?.destinationId);
  if(expected.some(value=>!value)||stableJson(program.baselineActionIds)!==stableJson(expected)||!expected.every(value=>view.actions.some(row=>row.id===value&&!row.cycleId)))fail("Imported monitoring must keep the original DD action identities through its explicit successor map.");
  return baseline;
}
