import {resourceReferenceUrl} from './resource-library.js';
import {assertEngagement as assert, boundedText as text, exactKeys, uuidPattern} from './engagement-domain.js';

export const bibliographyFields = Object.freeze(['resourceId','resourceVersionId','instrumentId','citation','locator','purpose','authorityKind','rightsSnapshot','clientVisible','statement']);
const citationFields = ['title','subtitle','authors','publisher','institution','publicationDate','edition','officialUrl','doi','isbn','issn','language','type'];
const rightsFields = ['category','licenseUri','evidenceUrl','attribution','reviewedAt'];
const authorityKinds = ['institutional_requirement','official_guidance','project_commitment','example','practitioner_recommendation'];
const url=(value,label)=>resourceReferenceUrl(value,label);

// A portable bibliographic snapshot pins the edition used in a report. It holds
// citation metadata, never source bodies, credentials or storage locations.
export function normalizeBibliographyReference(value) {
  exactKeys(value,bibliographyFields,'Working bibliography reference');
  assert(uuidPattern.test(value.resourceId||'')&&uuidPattern.test(value.resourceVersionId||''),'Select an exact library publication and edition.');
  if(value.instrumentId)assert(uuidPattern.test(value.instrumentId),'Select an exact source-linked instrument.');
  const source=value.citation;exactKeys(source,citationFields,'Bibliographic snapshot');
  const citation={title:text(source.title,'Publication title',{required:true,max:4000}),authors:[]};
  assert(Array.isArray(source.authors)&&source.authors.length<=100,'Retain a bounded author list.');
  citation.authors=source.authors.map(author=>text(author,'Author',{required:true,max:1000}));
  for(const key of citationFields.filter(key=>!['title','authors','officialUrl'].includes(key)))if(source[key])citation[key]=text(source[key],`Citation ${key}`,{max:4000});
  citation.edition=text(source.edition,'Publication edition',{required:true,max:1000});citation.officialUrl=url(source.officialUrl,'Official publication URL');
  const rights=value.rightsSnapshot||{};exactKeys(rights,rightsFields,'Bibliography rights snapshot');
  const rightsSnapshot={};for(const key of rightsFields)if(rights[key])rightsSnapshot[key]=['licenseUri','evidenceUrl'].includes(key)?url(rights[key],`Rights ${key}`):text(rights[key],`Rights ${key}`,{max:4000});
  assert(authorityKinds.includes(value.authorityKind),'Identify how this publication is used.');
  assert(typeof value.clientVisible==='boolean','Record whether this reference is suitable for the client report.');
  return {resourceId:value.resourceId,resourceVersionId:value.resourceVersionId,...(value.instrumentId?{instrumentId:value.instrumentId}:{}),citation,rightsSnapshot,
    locator:text(value.locator,'Source page or section',{max:4000}),purpose:text(value.purpose,'Use in this engagement',{required:true,max:8000}),authorityKind:value.authorityKind,clientVisible:value.clientVisible,
    statement:text(value.statement,'Edition and citation review',{required:true,max:8000})};
}

export function bibliographyText(reference) {
  const c=reference.citation;
  return `${c.authors?.join('; ')||c.institution||c.publisher||''}${c.publicationDate?` (${c.publicationDate})`:''}. ${c.title}. ${c.edition}.${reference.locator?` ${reference.locator}.`:''}${c.officialUrl?` ${c.officialUrl}`:''}`.trim();
}

export function bibliographyFromResource(resource,{purpose,locator='',instrumentId,clientVisible=false,authorityKind='official_guidance',statement}={}) {
  const original=resource.citation||resource,authors=original.authors||original.author||resource.authors||[];
  return normalizeBibliographyReference({resourceId:resource.resourceId,resourceVersionId:resource.resourceVersionId||resource.id,...(instrumentId?{instrumentId}:{}),
    citation:{title:original.title||resource.title,authors:authors.map(author=>typeof author==='string'?author:author.literal||[author.given,author.family].filter(Boolean).join(' ')),
      publisher:original.publisher||resource.publisher||'',institution:original.institution||resource.institution||'',publicationDate:original.publicationDate||resource.publicationDate||'',edition:original.edition||resource.edition,officialUrl:original.officialUrl||resource.officialUrl||'',language:original.language||resource.language||'',type:original.type||resource.type||'',...Object.fromEntries(['doi','isbn','issn'].flatMap(type=>{const id=(original.identifiers||resource.identifiers||[]).find(item=>String(item.type).toLowerCase()===type)?.value||original[type];return id?[[type,id]]:[];}))},
    rightsSnapshot:Object.fromEntries(rightsFields.filter(key=>resource.rights?.[key]).map(key=>[key,resource.rights[key]])),locator,purpose,authorityKind,clientVisible,statement});
}
