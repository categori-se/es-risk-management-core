// Human-reviewed relationships between exact versions. Physical resources and
// original citations keep their existing identities.
export const documentRelationDecisions = Object.freeze(["revision", "same_bytes", "inconsistent", "independent"]);
export const documentRelationLabels = Object.freeze({revision:"Revises the earlier document",same_bytes:"Same original bytes",inconsistent:"Inconsistency needs attention",independent:"Separate documents"});
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const id=/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/;
const sha=/^[a-f0-9]{64}$/;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail=message=>{throw Object.assign(Error(message),{status:400});};
const exact=(value,keys,label)=>{if(!object(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(key=>!keys.includes(key)))fail(`${label} requires its exact structured fields.`);};
export function normalizeDocumentRevisionRelation(value,{versionId,sourceSha256}={}){
  exact(value,["schemaVersion","engagementId","sourceVersionId","sourceSha256","predecessor","leftMetadataSha256","rightMetadataSha256","comparisonSha256","decision","review"],"Document relationship");
  exact(value.predecessor,["versionId","sha256"],"Earlier document pin");exact(value.review,["actorId","at","statement"],"Document relationship review");
  if(value.schemaVersion!==1||!uuid.test(value.engagementId)||![value.sourceVersionId,value.predecessor.versionId].every(item=>typeof item==="string"&&id.test(item))||typeof value.review.actorId!=="string"||!value.review.actorId.trim()||value.review.actorId.length>300||/[\x00-\x1f\x7f]/.test(value.review.actorId)||value.sourceVersionId===value.predecessor.versionId||![value.sourceSha256,value.predecessor.sha256,value.leftMetadataSha256,value.rightMetadataSha256,value.comparisonSha256].every(item=>typeof item==="string"&&sha.test(item))||versionId&&value.sourceVersionId!==versionId||sourceSha256&&value.sourceSha256!==sourceSha256)fail("A document relationship must retain its own engagement and two distinct exact version/hash pins.");
  if(!documentRelationDecisions.includes(value.decision)||typeof value.review.statement!=="string"||value.review.statement.trim().length<20||value.review.statement.length>4000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value.review.statement)||typeof value.review.at!=="string"||!Number.isFinite(Date.parse(value.review.at))||new Date(value.review.at).toISOString()!==value.review.at)fail("Record a document relationship decision, canonical review time and meaningful review statement of 20–4,000 characters.");
  return structuredClone(value);
}
export function documentComparisonMetadata(metadata){const {revisionRelation,...rest}=metadata||{};return rest;}
export function documentVersionMetadata(resource,version){return version.effectiveMetadata||resource.metadataHistory?.findLast(item=>item.versionId===version.id)?.metadata||version.intakeMetadata;}
export function documentMetadataBaseline(resource,version){return documentVersionMetadata(resource,version)||{title:resource.title||version.filename,authors:[],documentDate:"",description:"",language:"",tags:[],receivedVia:"file_upload",extraction:{method:"manual",status:"unavailable",warnings:[]}};}
export function documentRelationForEngagement(resource,version,engagementId){const current=documentVersionMetadata(resource,version)?.revisionRelation;return current?.engagementId===engagementId?current:resource.metadataHistory?.findLast(row=>row.versionId===version.id&&row.metadata?.revisionRelation?.engagementId===engagementId)?.metadata.revisionRelation;}
/** Validate only explicit relationships, never infer a family from a filename. */
export function validateDocumentRevisionGraph(project,engagementId,{candidate}={}){
  const rows=new Map();for(const resource of project.resources||[])for(const version of resource.versions||[])rows.set(version.id,{version,relation:candidate?.sourceVersionId===version.id?candidate:documentRelationForEngagement(resource,version,engagementId)});
  const children=new Map();
  for(const [versionId,row]of rows){const relation=row.relation;if(!relation||relation.engagementId!==engagementId)continue;normalizeDocumentRevisionRelation(relation,{versionId,sourceSha256:row.version.sha256});const parent=rows.get(relation.predecessor.versionId);if(!parent||parent.version.sha256!==relation.predecessor.sha256)fail("The reviewed earlier version must remain in this project's exact source register.");if(relation.decision==="same_bytes"&&(parent.version.sha256!==row.version.sha256||parent.version.size!==row.version.size))fail("A same-bytes relationship requires equal original hashes and sizes.");if(relation.decision!=="revision")continue;
    if(children.has(relation.predecessor.versionId)&&children.get(relation.predecessor.versionId)!==versionId)fail("This earlier version already has a reviewed successor. Resolve that relationship explicitly before creating a competing revision.");children.set(relation.predecessor.versionId,versionId);
    const visited=new Set([versionId]);let cursor=relation.predecessor.versionId;while(cursor){if(visited.has(cursor))fail("A document revision family cannot contain a cycle.");visited.add(cursor);const next=rows.get(cursor)?.relation;cursor=next?.engagementId===engagementId&&next.decision==="revision"?next.predecessor.versionId:null;}
  }return true;
}
/** Display overlay only. Hidden/revoked versions never supply a name or count. */
export function documentRelationSummary(entries,entry,engagementId){
  const visible=new Map(entries.map(row=>[row.version.id,row])),relation=documentRelationForEngagement(entry.resource,entry.version,engagementId);
  const children=entries.filter(row=>{const item=documentRelationForEngagement(row.resource,row.version,engagementId);return item?.engagementId===engagementId&&item.decision==="revision"&&item.predecessor.versionId===entry.version.id&&item.predecessor.sha256===entry.version.sha256;});
  const earlier=relation?.engagementId===engagementId?visible.get(relation.predecessor.versionId):undefined;
  return {relation:earlier&&earlier.version.sha256===relation.predecessor.sha256?relation:undefined,earlier,successors:children,superseded:children.length===1};
}
