import {createHash,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {stableJson,uuidPattern,sha256Pattern,assertEngagement as assert,exactKeys} from "../src/lib/engagement-domain.js";
import {getEngagementReportTemplate} from "../src/lib/engagement-report-templates.js";

export const issuedRenditionLimits=Object.freeze({artifactBytes:8*1024*1024,engagementBytes:16*1024*1024,accountBytes:64*1024*1024,engagementCount:200,accountCount:1000});
const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
// The backend is a single-file bundle. Its build pins the actual renderer
// source bytes; local unbundled execution reads that same source directly.
// An environment variable never supplies renderer provenance.
export function engagementRendererSourceSha256(){
  const value=typeof __ESIA_ENGAGEMENT_RENDERER_SOURCE_SHA256__==="string"?__ESIA_ENGAGEMENT_RENDERER_SOURCE_SHA256__:digest(readFileSync(new URL("./engagement-exports.mjs",import.meta.url)));
  assert(sha256Pattern.test(value),"The build-pinned engagement renderer SHA256 is invalid.",503);return value;
}
const formats={html:"text/html; charset=utf-8",pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",csv:"text/csv; charset=utf-8",json:"application/json; charset=utf-8"};
const fields=["id","schemaVersion","engagementId","projectId","accountId","baselineId","baselineSha256","publicationId","format","selection","filename","mediaType","sha256","size","issuedAt","renderer"];
const sha=value=>assert(sha256Pattern.test(value||""),"Issued rendition SHA256 is invalid.");
export function renditionSelection(baseline,options={}){
  exactKeys(options,["cycleId","reportType","frameworkId","missionId","eventId","templateId","templateVersion"],"Issued report selection");
  assert(!options.templateVersion || options.templateId,"Choose the report template identity with its version.");
  const template=options.templateId?getEngagementReportTemplate(options.templateId,options.templateVersion||"1"):null;
  const cycleId=options.cycleId||baseline.scope?.cycleId||null,cycle=baseline.cycles?.find(item=>item.id===cycleId);
  const result={cycleId,reportType:options.reportType||(cycle?.reportType==="independent"?"independent":"neutral"),frameworkId:options.frameworkId||null,missionId:options.missionId||null,eventId:options.eventId||null};
  if(template){result.templateId=template.id;result.templateVersion=template.version;}
  assert(["neutral","periodic","independent","institutional","mission","incident"].includes(result.reportType),"Choose a supported issued report type.");
  for(const[key,collection]of [["cycleId","cycles"],["missionId","missions"],["eventId","events"]])if(result[key])assert((baseline[collection]||[]).some(item=>item.id===result[key]),"Issued report selection is outside its approved baseline.");
  if(result.frameworkId)assert(baseline.requirements.some(item=>item.frameworkId===result.frameworkId),"Issued institutional report is outside its approved requirement scope.");
  for(const[key,collection]of [["missionId","missions"],["eventId","events"]])if(result[key]&&cycle){const record=baseline[collection].find(item=>item.id===result[key]);assert(record.cycleId===cycle.id||key==="eventId"&&!record.cycleId&&record.programId===cycle.programId,"Issued report records must belong to their selected cycle or its program-wide event register.");}
  return result;
}
const cacheKey=record=>digest(stableJson([record.engagementId,record.baselineId,record.publicationId,record.format,record.selection]));
function validateMetadata(record,pack){
  exactKeys(record,fields,"Issued rendition metadata");
  for(const key of ["id","engagementId","baselineId","publicationId"])assert(uuidPattern.test(record[key]||""),"Issued rendition identifiers must be stable UUIDs.");
  assert(record.schemaVersion===1&&Object.hasOwn(formats,record.format)&&record.mediaType===formats[record.format],"Issued rendition format or media type is invalid.");
  assert(typeof record.filename==="string"&&/^[A-Za-z0-9_.-]{1,180}$/.test(record.filename)&&record.filename.endsWith("."+record.format),"Issued rendition filename must be a safe format-specific name.");
  assert(Number.isSafeInteger(record.size)&&record.size>0&&record.size<=issuedRenditionLimits.artifactBytes,"Issued rendition exceeds its 8 MiB artifact limit.",413);sha(record.sha256);sha(record.baselineSha256);
  assert(typeof record.issuedAt==="string"&&/^\d{4}-\d\d-\d\dT/.test(record.issuedAt)&&Number.isFinite(Date.parse(record.issuedAt)),"Issued rendition time is invalid.");
  exactKeys(record.renderer,["id","version","sourceSha256","runtime"],"Issued renderer provenance");assert(record.renderer.id==="esia-engagement-exports"&&typeof record.renderer.version==="string"&&record.renderer.version.length>0&&record.renderer.version.length<100&&typeof record.renderer.runtime==="string"&&record.renderer.runtime.length<100,"Issued renderer provenance is incomplete.");sha(record.renderer.sourceSha256);
  const core=pack.engagement,baseline=pack.baselines.find(item=>item.id===record.baselineId),publication=pack.entities.publications.find(item=>item.id===record.publicationId);
  assert(record.engagementId===core.id&&record.projectId===core.projectId&&record.accountId===core.accountId&&baseline&&publication&&publication.baselineId===baseline.id&&record.baselineSha256===baseline.sha256&&publication.snapshotSha256===baseline.sha256,"Issued rendition must identify its owning engagement, exact approved baseline and actual publication.");
  assert(stableJson(renditionSelection(baseline,record.selection))===stableJson(record.selection),"Issued rendition selection must retain its canonical approved scope.");
  return record;
}
export function validateIssuedRenditions(pack,{verifyBytes=true}={}){
  assert(pack&&typeof pack==="object"&&!Array.isArray(pack),"Use an engagement package for issued rendition validation.");
  if(pack.issuedRenditions===undefined)return [];
  assert(Array.isArray(pack.issuedRenditions)&&pack.issuedRenditions.length<=issuedRenditionLimits.engagementCount,"Issued rendition count exceeds the engagement limit.",413);
  assert(pack.engagement&&Array.isArray(pack.baselines)&&Array.isArray(pack.entities?.publications),"Issued renditions require their owning engagement, baselines and publications.");
  const ids=new Set(),keys=new Set();let total=0;
  return pack.issuedRenditions.map(entry=>{
    exactKeys(entry,[...fields,"contentBase64"],"Portable issued rendition");const {contentBase64,...record}=entry;validateMetadata(record,pack);total+=record.size;
    assert(total<=issuedRenditionLimits.engagementBytes,"Issued renditions exceed the 16 MiB engagement limit; existing issued originals are never evicted.",413);
    assert(typeof contentBase64==="string"&&contentBase64.length===4*Math.ceil(record.size/3)&&contentBase64.length<=4*Math.ceil(issuedRenditionLimits.artifactBytes/3)&&/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64),"Portable issued rendition has invalid or oversized encoded bytes.",413);
    assert(!ids.has(record.id)&&!keys.has(cacheKey(record)),"Issued rendition identities and publication representations must be unique.");ids.add(record.id);keys.add(cacheKey(record));
    if(verifyBytes){const bytes=Buffer.from(contentBase64,"base64");assert(bytes.length===record.size&&bytes.toString("base64")===contentBase64&&digest(bytes)===record.sha256,"Portable issued rendition bytes do not match their exact size and SHA256.");}
    return {...record,contentBase64};
  });
}
export function createIssuedRenditionRepository(db,{newId=randomUUID,now=()=>new Date().toISOString()}={}){
  db.exec("CREATE TABLE IF NOT EXISTS engagement_issued_renditions(id TEXT PRIMARY KEY,engagement_id TEXT NOT NULL,cache_key TEXT NOT NULL UNIQUE,size INTEGER NOT NULL,json TEXT NOT NULL,bytes BLOB NOT NULL); CREATE INDEX IF NOT EXISTS issued_renditions_owner ON engagement_issued_renditions(engagement_id)");
  const totals=engagementId=>db.prepare("SELECT coalesce(sum(size),0) bytes,count(*) count FROM engagement_issued_renditions"+(engagementId?" WHERE engagement_id=?":"")).get(...(engagementId?[engagementId]:[]));
  function budget(records){let added=0,count=0;const owners=new Map();for(const record of records){if(db.prepare("SELECT id FROM engagement_issued_renditions WHERE id=?").get(record.id))continue;added+=record.size;count++;const own=owners.get(record.engagementId)||{bytes:0,count:0};own.bytes+=record.size;own.count++;owners.set(record.engagementId,own);}const account=totals();assert(account.bytes+added<=issuedRenditionLimits.accountBytes&&account.count+count<=issuedRenditionLimits.accountCount,"Issued output archive is full (64 MiB / 1,000 artifacts per account); retain the archive and use a successor repository. No issued originals were evicted.",413);for(const[id,added]of owners){const retained=totals(id);assert(retained.bytes+added.bytes<=issuedRenditionLimits.engagementBytes&&retained.count+added.count<=issuedRenditionLimits.engagementCount,"Issued output archive is full for this engagement (16 MiB / 200 artifacts). No issued originals were evicted.",413);}}
  function read(row){assert(row,"Issued rendition is unavailable in this engagement.",404);const record=JSON.parse(row.json),bytes=Buffer.from(row.bytes);assert(bytes.length===record.size&&bytes.length<=issuedRenditionLimits.artifactBytes&&digest(bytes)===record.sha256,"The retained issued bytes are missing or changed; restore the verified archive before reopening.",409);return {metadata:record,bytes};}
  return {
    list:engagementId=>db.prepare("SELECT json FROM engagement_issued_renditions WHERE engagement_id=? ORDER BY rowid").all(engagementId).map(row=>JSON.parse(row.json)),
    find(record){const row=db.prepare("SELECT json,bytes FROM engagement_issued_renditions WHERE cache_key=? AND engagement_id=?").get(cacheKey(record),record.engagementId);return row?read(row):null;},
    get(engagementId,id){return read(db.prepare("SELECT json,bytes FROM engagement_issued_renditions WHERE engagement_id=? AND id=?").get(engagementId,id));},
    export(engagementId){const total=totals(engagementId);assert(total.bytes<=issuedRenditionLimits.engagementBytes&&total.count<=issuedRenditionLimits.engagementCount,"Issued archive exceeds its bounded export limit.",413);return db.prepare("SELECT json,bytes FROM engagement_issued_renditions WHERE engagement_id=? ORDER BY rowid").all(engagementId).map(row=>{const value=read(row);return {...value.metadata,contentBase64:value.bytes.toString("base64")};});},
    validateImport(packs){assert(Array.isArray(packs)&&packs.length<=100,"Use a bounded array of engagement packages.");assert(Buffer.byteLength(JSON.stringify(packs))<=32*1024*1024,"Engagement records and issued outputs exceed the 32 MiB exchange limit.",413);const planned=packs.flatMap(pack=>validateIssuedRenditions(pack,{verifyBytes:false}));budget(planned);const entries=packs.flatMap(pack=>validateIssuedRenditions(pack));for(const entry of entries){const owner=db.prepare("SELECT engagement_id,json FROM engagement_issued_renditions WHERE id=? OR cache_key=?").get(entry.id,cacheKey(entry));assert(!owner||owner.engagement_id===entry.engagementId&&stableJson(JSON.parse(owner.json))===stableJson(Object.fromEntries(Object.entries(entry).filter(([key])=>key!=="contentBase64"))),"An issued rendition identity already belongs to different immutable output bytes or scope.",409);}return entries;},
    import(entries){for(const entry of entries){const {contentBase64,...record}=entry;db.prepare("INSERT OR IGNORE INTO engagement_issued_renditions(id,engagement_id,cache_key,size,json,bytes) VALUES(?,?,?,?,?,?)").run(record.id,record.engagementId,cacheKey(record),record.size,JSON.stringify(record),Buffer.from(contentBase64,"base64"));}},
    retain(pack,{baselineId,publicationId,format,selection,bytes,filename,mediaType}){
      const key={engagementId:pack.engagement.id,baselineId,publicationId,format,selection},existing=this.find(key);if(existing)return existing;
      assert(Buffer.isBuffer(bytes)||bytes instanceof Uint8Array,"Issued output must contain actual rendered bytes.");assert(bytes.length>0&&bytes.length<=issuedRenditionLimits.artifactBytes,"Rendered output exceeds the 8 MiB issued artifact limit; no output was recorded.",413);
      const baseline=pack.baselines.find(item=>item.id===baselineId),record={...key,id:newId(),schemaVersion:1,projectId:pack.engagement.projectId,accountId:pack.engagement.accountId,baselineSha256:baseline?.sha256,filename,mediaType,size:bytes.length,sha256:digest(bytes),issuedAt:now(),renderer:{id:"esia-engagement-exports",version:"esia-engagement-render-1",sourceSha256:engagementRendererSourceSha256(),runtime:process.version}};
      validateMetadata(record,pack);budget([record]);this.import([{...record,contentBase64:Buffer.from(bytes).toString("base64")}]);return this.get(record.engagementId,record.id);
    }
  };
}
