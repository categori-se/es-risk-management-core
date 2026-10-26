// Additive common evidence provenance. These checks preserve declared capture
// attribution separately from the authenticated uploader; they grant no access.
import {normalizeAdditionalFieldLinks} from "./field-record-details.js";

const fail=message=>{throw Object.assign(new Error(message),{status:409,statusCode:409});};
const object=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const exact=(value,fields,label)=>{if(!object(value)||Object.keys(value).length!==fields.length||Object.keys(value).some(key=>!fields.includes(key)))fail(`${label} must retain its exact versioned fields.`);};
const id=value=>{if(typeof value!=="string"||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)||value.includes(".."))fail("Use exact retained field evidence identifiers.");return value;};
const sha=value=>{if(typeof value!=="string"||!/^[a-f0-9]{64}$/.test(value))fail("Field evidence requires exact retained SHA256 values.");return value;};
const timestamp=value=>{if(typeof value!=="string"||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail("Field evidence requires exact canonical timestamps.");return value;};
const captureTimestamp=value=>{if(typeof value!=="string"||!/^\d{4}-\d\d-\d\dT/.test(value)||!Number.isFinite(Date.parse(value)))fail("Retain the original ISO capture timestamp.");return value;};
const linkedIds=value=>{if(!Array.isArray(value)||value.length>30||new Set(value).size!==value.length)fail("Use up to30 distinct related field evidence identifiers.");return value.map(id);};
const contextFields=["requirementId","siteId","grievanceId","commitmentId","activityId","engagementId","programId","cycleId","missionId"];

export function normalizeAuthenticatedFieldLinks(value){
  const allowed=["assessmentIds","actionIds","requirement","context","siteIds","observationIds","requirementIds","findingIds","grievanceIds","commitmentIds","monitoringObligationIds","engagementActionIds"];
  if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail("Retain only the defined field evidence relationships.");
  const links={assessmentIds:linkedIds(value.assessmentIds),actionIds:linkedIds(value.actionIds),requirement:null};
  if(value.requirement!==null){exact(value.requirement,["authority","name","edition","clause"],"Declared requirement context");links.requirement={};for(const key of ["authority","name","edition","clause"]){const text=value.requirement[key];if(typeof text!=="string"||text.length>2000)fail("Declared requirement context must remain bounded original text.");links.requirement[key]=text;}}
  if(Object.hasOwn(value,"context")){if(!object(value.context)||Object.keys(value.context).some(key=>!contextFields.includes(key)))fail("Field context must use the existing scoped identifiers.");links.context=Object.fromEntries(Object.entries(value.context).map(([key,value])=>[key,id(value)]));}
  try{Object.assign(links,normalizeAdditionalFieldLinks(value));}catch(error){fail(error.message);}
  return links;
}

export function normalizeAuthenticatedFieldCaptureBinding(value){
  exact(value,["format","schemaVersion","captureId","recordSha256","manifest","media","links","declaredAuthor","capturedAt","uploadedBy","receivedAt","leaseId","leaseRevision","policySha256"],"Authenticated field evidence provenance");
  if(value.format!=="esia-authenticated-field-evidence"||value.schemaVersion!==1)fail("Use authenticated field evidence schema1.");
  const source=value=>{exact(value,["resourceId","versionId","sha256"],"Retained field source");const result={resourceId:id(value.resourceId),versionId:id(value.versionId),sha256:sha(value.sha256)};if(result.versionId!==`hosted:${result.resourceId}:${result.sha256}`)fail("Field source versions must use the canonical exact hosted document/hash identity.");return result;};
  if(!Array.isArray(value.media)||value.media.length>3)fail("Retain up to3 exact field originals.");
  const manifest=source(value.manifest),media=value.media.map(source),claimed=new Set([manifest.resourceId]);
  for(const item of media){if(claimed.has(item.resourceId))fail("The field manifest and original document identities must be distinct.");claimed.add(item.resourceId);}
  if(typeof value.declaredAuthor!=="string"||!value.declaredAuthor.trim()||value.declaredAuthor.length>1000)fail("Retain the capture's declared author without relabelling it as verified identity.");
  if(!Number.isSafeInteger(value.leaseRevision)||value.leaseRevision<1)fail("Retain the exact server lease revision used for field ingestion.");
  return {format:value.format,schemaVersion:1,captureId:id(value.captureId),recordSha256:sha(value.recordSha256),manifest,media,links:normalizeAuthenticatedFieldLinks(value.links),declaredAuthor:value.declaredAuthor,capturedAt:captureTimestamp(value.capturedAt),uploadedBy:id(value.uploadedBy),receivedAt:timestamp(value.receivedAt),leaseId:id(value.leaseId),leaseRevision:value.leaseRevision,policySha256:sha(value.policySha256)};
}

/** Related records remain context. This does not add evidence to a finding,
 * confirm a citation, close an action, or transfer an assessment conclusion. */
export function validateAuthenticatedFieldLinks(links,engagement,{captureId,historical=false}={}){
  links=normalizeAuthenticatedFieldLinks(links);const context=links.context||{};
  if(links.assessmentIds.length||links.actionIds.length)fail("Legacy project assessment/action links cannot select engagement findings or actions. Choose their explicit engagement links.");
  if(context.engagementId&&context.engagementId!==engagement.id)fail("The field capture belongs to another engagement.");
  if(context.activityId)fail("This engagement has no typed activity register for that field link.");
  const find=(collection,identifier,label)=>{const row=(engagement[collection]||[]).find(row=>row.id===identifier);if(!row)fail(`Select ${label} in this exact engagement.`);return row;};
  const versions=row=>row?historical?[row,...(row.history||[]).slice().reverse()]:[row]:[];
  const program=context.programId?find("programs",context.programId,"the monitoring program"):undefined;
  const cycleRecord=context.cycleId?find("cycles",context.cycleId,"the reporting cycle"):undefined;
  const missionRecord=context.missionId?find("missions",context.missionId,"the field mission"):undefined;
  const missionScopes=new Set(versions(missionRecord).map(row=>`${row.programId}:${row.cycleId}`));
  const cycle=versions(cycleRecord).find(row=>(!program||row.programId===program.id)&&(!missionRecord||missionScopes.has(`${row.programId}:${row.id}`)));
  const mission=versions(missionRecord).find(row=>(!program||row.programId===program.id)&&(!cycle||row.cycleId===cycle.id&&row.programId===cycle.programId));
  if(cycleRecord&&!cycle||missionRecord&&!mission)fail("The field program, cycle and mission must have the same owning supervisory scope.");
  const programId=program?.id||cycle?.programId||mission?.programId;
  if(cycle&&programId!==cycle.programId||mission&&(programId!==mission.programId||cycle&&mission.cycleId!==cycle.id))fail("The field program, cycle and mission must have the same owning supervisory scope.");
  const maps={requirementIds:"requirements",findingIds:"findings",grievanceIds:"events",commitmentIds:"obligations",monitoringObligationIds:"monitoringObligations",engagementActionIds:"actions"};
  const targets=Object.fromEntries(Object.keys(maps).map(key=>[key,[...(links[key]||[])]]));
  for(const [contextKey,listKey]of [["requirementId","requirementIds"],["grievanceId","grievanceIds"],["commitmentId","commitmentIds"]])if(context[contextKey])targets[listKey].push(context[contextKey]);
  for(const [key,collection]of Object.entries(maps))for(const identifier of new Set(targets[key])){
    const target=find(collection,identifier,collection),targetVersions=versions(target);
    if(key==="grievanceIds"&&!targetVersions.some(row=>row.kind==="grievance"))fail("A grievance link must select a grievance event.");
    if(programId&&!targetVersions.some(row=>{
      if(row.programId)return row.programId===programId;
      if(!row.cycleId)return true;
      return versions(find("cycles",row.cycleId,"the linked record's cycle")).some(cycle=>cycle.programId===programId);
    }))fail("Related field records must belong to the selected monitoring program.");
    if(key==="requirementIds"&&programId){const scope=find("programs",programId,"the monitoring program");if(!versions(scope).some(row=>row.requirementIds.includes(identifier)))fail("A linked field requirement is outside the selected monitoring program scope.");}
  }
  const siteIds=new Set([...(links.siteIds||[]),...(context.siteId?[context.siteId]:[])]);
  for(const identifier of siteIds)if(!(engagement.missions||[]).some(record=>versions(record).some(row=>(!programId||row.programId===programId)&&(!mission||row.id===mission.id)&&row.monitoringPoints?.some(point=>point.id===identifier))))fail("Select monitoring points in this engagement's field mission and program.");
  for(const priorId of links.observationIds||[]){
    if(priorId===captureId)fail("A field capture cannot cite itself as a prior observation.");
    if(!(engagement.assertions||[]).some(row=>versions(row).some(value=>value.fieldCapture?.captureId===priorId)))fail("A related observation must identify an already retained field capture in this exact engagement.");
  }
  return links;
}
