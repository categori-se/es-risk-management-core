// Pure metadata access. Project catalog JSON is loaded separately on demand.
export const publicProjectRecordFiles=Object.freeze({});
export const publicProjectRecordFormat="esia-curated-public-project-records";
export function isPublishedProjectRecord(record){return Boolean(record&&record.publicationStatus==="curated_public_demo"&&record.visibility==="public"&&record.publicationScope==="public_source_metadata_only"&&record.private!==true&&record.confidential!==true&&record.public!==false&&record.access!=="private");}
export function validatePublicProjectRecords(catalog,{projectId=catalog?.projectId}={}){
 if(!catalog||catalog.format!==publicProjectRecordFormat||catalog.schemaVersion!==1||!Object.hasOwn(publicProjectRecordFiles,projectId)||catalog.projectId!==projectId||catalog.publication?.status!=="curated_public_demo"||catalog.publication.visibility!=="public"||catalog.publication.scope!=="public_source_metadata_only"||!Array.isArray(catalog.records)||catalog.records.length>5000)throw Error("Choose an explicitly curated public project metadata catalog.");
 const ids=new Set();for(const record of catalog.records){if(!record||typeof record.id!=="string"||ids.has(record.id)||record.projectId!==projectId||!["document","discussion"].includes(record.recordKind)||!["retained","reference_only"].includes(record.retentionStatus)||typeof record.title!=="string"||!Array.isArray(record.institutionIds)||!Array.isArray(record.relatedInstitutionIds))throw Error("The public project record identities or categories are invalid.");ids.add(record.id);}
 return catalog;
}
export function publicProjectRecords(catalog,{projectId,recordKind,query="",ownerName,includeReferences=true,institutionIds}={}){
 validatePublicProjectRecords(catalog,projectId?{projectId}:{});
 const words=String(query).toLocaleLowerCase().trim().split(/\s+/u).filter(Boolean),institutions=institutionIds?new Set(institutionIds):null;
 return catalog.records.filter(record=>isPublishedProjectRecord(record)&&(!recordKind||record.recordKind===recordKind)&&(includeReferences||record.retentionStatus==="retained")&&(!ownerName||record.ownerName===ownerName)&&(!institutions||record.relatedInstitutionIds.some(id=>institutions.has(id)))&&words.every(word=>[record.title,record.description,record.documentType,record.ownerName,record.publisherName,record.publishedAt,...record.institutionIds,...(record.aliases||[]).flatMap(alias=>[alias.title,alias.sourceRecordId,alias.documentType])].join(" ").toLocaleLowerCase().includes(word)));
}
