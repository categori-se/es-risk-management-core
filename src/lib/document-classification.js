// Document description proposals are distinct from evidence assertions and
// professional findings. Retained proposals never silently become accepted data.
import {normalizeTags} from "./concept-tags.js";
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const sha=/^[a-f0-9]{64}$/;
const fail=message=>{throw Object.assign(Error(message),{status:400});};
const exact=(value,allowed,label)=>{if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail(`${label} contains unsupported fields.`);};
const text=(value,label,max=2000)=>{if(typeof value!=="string"||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))fail(`${label} must be bounded text.`);return value.trim();};
const list=(value,label,max=30,length=1000)=>{if(!Array.isArray(value)||value.length>max)fail(`${label} must be a bounded list.`);const result=value.map(item=>text(item,label,length));if(result.some(item=>!item)||new Set(result).size!==result.length)fail(`${label} must contain distinct nonempty values.`);return result;};
const date=(value,label)=>{value=text(value,label,100);if(!value.includes("T")||!Number.isFinite(Date.parse(value)))fail(`${label} must include a valid timestamp.`);return value;};
export const documentProfileScalars=Object.freeze({title:2000,publisher:1000,documentDate:64,reportingPeriod:1000,documentRevision:200,language:100,documentStatus:200,documentType:200,description:16000});
export const documentProfileLists=Object.freeze({authors:[50,500],topics:[20,200],locations:[30,1000],projectComponents:[30,1000],requirementIds:[100,192]});
export const canonicalDocumentValue=value=>JSON.stringify(value,(_,item)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export function normalizeDocumentProfile(value,{defaults=false}={}){
 exact(value,[...Object.keys(documentProfileScalars),...Object.keys(documentProfileLists)],"Document classification fields");
 const result={};for(const[key,max]of Object.entries(documentProfileScalars))result[key]=text(value[key]??(defaults?"":undefined),`Document ${key}`,max);
 for(const[key,[max,length]]of Object.entries(documentProfileLists))result[key]=list(value[key]??(defaults?[]:undefined),`Document ${key}`,max,length);
 result.topics=normalizeTags(result.topics).map(tag=>tag.label);
 if(result.documentDate){const day=result.documentDate.slice(0,10);if(!/^\d{4}-\d\d-\d\d(?:$|T)/.test(result.documentDate)||!Number.isFinite(Date.parse(result.documentDate))||new Date(day).toISOString().slice(0,10)!==day)fail("Document classification date must be a valid ISO date, or blank when unknown.");}
 if(result.requirementIds.some(value=>!uuid.test(value)))fail("Document requirement links must use exact requirement identities.");return result;
}
export function documentProfileFromMetadata(metadata,requirementIds=[]){
 return normalizeDocumentProfile({...Object.fromEntries(Object.keys(documentProfileScalars).map(key=>[key,metadata[key]||""])),authors:metadata.authors||[],topics:(metadata.tags||[]).map(tag=>typeof tag==="string"?tag:tag.label),locations:metadata.locations||[],projectComponents:metadata.projectComponents||[],requirementIds});
}
export function normalizeDocumentClassification(value,{versionId,sourceSha256}={}){
 exact(value,["schemaVersion","engagementId","sourceVersionId","sourceSha256","status","proposal","evidence","provenance","proposedBy","proposedAt","reviewedProfile","review"],"Document classification");
 if(value.schemaVersion!==1||!uuid.test(value.engagementId||"")||typeof value.sourceVersionId!=="string"||!value.sourceVersionId||value.sourceVersionId.length>192||!sha.test(value.sourceSha256||"")||versionId&&value.sourceVersionId!==versionId||sourceSha256&&value.sourceSha256!==sourceSha256||!["suggested","human_confirmed","human_modified"].includes(value.status))fail("Document classification must retain its exact engagement, source version, SHA256 and review status.");
 const proposal=normalizeDocumentProfile(value.proposal),proposedBy=text(value.proposedBy,"Classification contributor",300),proposedAt=date(value.proposedAt,"Classification proposal time");if(!proposedBy)fail("Identify the classification contributor.");
 exact(value.provenance,["kind","model","method","promptHash","actorId","at","sources"],"Classification contribution provenance");const provenance=structuredClone(value.provenance);
 if(!["ai","human"].includes(provenance.kind)||!text(provenance.method||provenance.model||"","Classification method",1000)||provenance.promptHash!==undefined&&!sha.test(provenance.promptHash))fail("Identify the document classification contributor and method.");
 for(const key of ["model","method","actorId"])if(provenance[key]!==undefined)text(provenance[key],`Classification provenance ${key}`,1000);
 if(provenance.at!==undefined)date(provenance.at,"Classification contribution time");if(provenance.sources!==undefined)list(provenance.sources,"Classification contribution sources",100,1000);
 if(!Array.isArray(value.evidence)||!value.evidence.length||value.evidence.length>8)fail("Document classification needs one to eight exact supporting passages.");
 const evidence=value.evidence.map(item=>{exact(item,["passageId","versionId","sourceSha256","locator","quote","method","extractorVersion","page","range"],"Classification source passage");
  if(item.versionId!==value.sourceVersionId||item.sourceSha256!==value.sourceSha256||typeof item.passageId!=="string"||!/^passage:[a-f0-9]{48}$/.test(item.passageId)||!(item.page===null||Number.isSafeInteger(item.page)&&item.page>0))fail("Classification evidence must identify its exact source version and passage.");
  const result={passageId:item.passageId,versionId:item.versionId,sourceSha256:item.sourceSha256,locator:text(item.locator,"Classification source locator",4000),quote:text(item.quote,"Classification source passage",2000),method:text(item.method,"Classification extractor method",200),extractorVersion:text(item.extractorVersion,"Classification extractor version",200),page:item.page,range:structuredClone(item.range)};
  result.quote=item.quote;exact(result.range,["start","end","basis"],"Classification extraction range");if(!Number.isSafeInteger(result.range.start)||!Number.isSafeInteger(result.range.end)||result.range.start<0||result.range.end>256000||result.range.end-result.range.start!==item.quote.length||result.range.basis!=="extracted_text_utf16_code_units"||!result.locator||!result.quote.trim()||!result.method||!result.extractorVersion)fail("Classification passage extraction range is invalid.");return result;});
 if(new Set(evidence.map(item=>item.passageId)).size!==evidence.length)fail("Classification source passages must be distinct.");
 const result={schemaVersion:1,engagementId:value.engagementId,sourceVersionId:value.sourceVersionId,sourceSha256:value.sourceSha256,status:value.status,proposal,evidence,provenance,proposedBy,proposedAt};
 if(value.status==="suggested"){if(value.review!==undefined||value.reviewedProfile!==undefined)fail("Suggested metadata cannot claim a human review.");}
 else{const reviewedProfile=normalizeDocumentProfile(value.reviewedProfile);exact(value.review,["actorId","at","statement"],"Document classification human review");const review={actorId:text(value.review.actorId,"Classification reviewer",300),at:date(value.review.at,"Classification review time"),statement:text(value.review.statement,"Classification review statement",12000)};if(!review.actorId||!review.statement)fail("Classification review needs an attributed substantive statement.");if((canonicalDocumentValue(proposal)===canonicalDocumentValue(reviewedProfile)?"human_confirmed":"human_modified")!==value.status)fail("Classification review status must distinguish confirmation from modified document fields.");Object.assign(result,{reviewedProfile,review});}
 return result;
}
