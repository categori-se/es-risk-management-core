// A separately labelled application-authored document. Source outline labels
// become headings; none of its response controls claims to be an original field.
import {createHash} from 'node:crypto';
import {stableJson} from '../src/lib/engagement-domain.js';
import {createClientTemplateDocx,nativeWordParagraph} from './client-template-baseline.mjs';

const hash=value=>createHash('sha256').update(typeof value==='string'||value instanceof Uint8Array?value:stableJson(value)).digest('hex');
const xml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fail=message=>{throw Object.assign(Error(message),{status:422});};
export const monitoringReconstructionVersion=1;
export const monitoringReconstructionLimits=Object.freeze({sourceHeadings:60,bytes:1024*1024,repeatColumns:8});
export function monitoringReconstructionEligibility(inspection){
 const count=inspection?.manifest?.structuralFields?.length||0;
 return {eligible:inspection?.analysis?.format==='pdf'&&count>0&&count<=monitoringReconstructionLimits.sourceHeadings,representation:'reconstructed_docx',sourceHeadingCount:count,generatorVersion:monitoringReconstructionVersion,
  classification:'application_authored_reconstruction_from_source_structure',notice:'Printed source labels become headings only. Response controls, repeated tables and expanding layout are application-authored; the PDF original and its exact anchors remain the source reference. Every mapping and output requires separate Studio review.'};
}
export function buildMonitoringOutlineReconstruction(inspection){
 const eligibility=monitoringReconstructionEligibility(inspection);if(!eligibility.eligible)fail('A bounded verified PDF structure with 1 to 60 exact source headings is required for labelled reconstruction.');
 const source=inspection.manifest.source;if(inspection.analysis.sourceSha256!==source.templateSha256||!/^[a-f0-9]{64}$/.test(source.sourceSha256||''))fail('Reconstruction requires the exact verified PDF original/annex structure.');
 const fields=inspection.manifest.structuralFields,sourceManifestSha256=hash(inspection.manifest),rows=[];
 const p=nativeWordParagraph;let body=p('APPLICATION-AUTHORED RECONSTRUCTION · PDF SOURCE STRUCTURE','Heading1')+p(eligibility.notice)+p('The source may be an outline or contents page. Its labels are not blank answer fields. All response areas and table columns below are E&S Review proposals.')+
  p(`Source: ${source.title||inspection.family.label}. ${source.edition||''}. ${source.officialUrl||''}`)+p(`Unchanged complete original SHA-256: ${source.sourceSha256}`)+p(`Selected PDF source SHA-256: ${source.templateSha256}${source.annex?`; complete original file pages ${source.annex.startPage}–${source.annex.endPage}`:''}`)+p(source.rights?.attribution||'Retain the source-owner attribution and permission conditions with any issued derivative.')+p(source.rights?.adaptationNotice||'Adapted by E&S Review. This response layout is not an institutional original or institutional endorsement.');
 for(const [index,field]of fields.entries()){
  const key=`source_${index+1}`,crosswalk=inspection.crosswalk.find(row=>row.fieldId===field.id),proposed=crosswalk?.binding,repeat=proposed?.type==='repeat'&&proposed.columns&&Object.keys(proposed.columns).length>0&&Object.keys(proposed.columns).length<=monitoringReconstructionLimits.repeatColumns,
   columns=repeat?Object.keys(proposed.columns).map(name=>({key:name,label:name.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,char=>char.toUpperCase()),type:'text'})):[];
  rows.push({sourceFieldId:field.id,derivativeKey:key,originalLabel:field.label,originalPage:field.sourceEvidence.originalPage,originalNativeElement:field.sourceEvidence.nativeElement,sourceSha256:source.sourceSha256,sourceTemplateSha256:source.templateSha256,representation:repeat?'application_authored_repeating_table':'application_authored_response_control',columns,proposedBinding:proposed,reviewStatus:'proposed',sourceInputRegion:false});
  body+=p(field.label,'Heading1')+p(`Source heading: complete original page ${field.sourceEvidence.originalPage??'unknown'}; ${field.id}. Response layout proposed by E&S Review.`);
  if(repeat){const widths=columns.map(column=>({description:2600,owner:1500,dueDate:1400,status:1000,verificationCriteria:2500,publicSummary:5000,receivedAt:3000}[column.key]||1800)),total=widths.reduce((sum,width)=>sum+width,0),sizes=widths.map(width=>Math.floor(9000*width/total)),cell=(value,index)=>`<w:tc><w:tcPr><w:tcW w:w="${sizes[index]}" w:type="dxa"/></w:tcPr>${p(value)}</w:tc>`;body+=`<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCaption w:val="${xml(field.label)}"/></w:tblPr><w:tblGrid>${sizes.map(width=>`<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>${columns.map((column,index)=>cell(column.label,index)).join('')}</w:tr><w:tr><w:trPr><w:cantSplit/></w:trPr>${columns.map((column,index)=>cell(`{{${key}.${column.key}}}`,index)).join('')}</w:tr></w:tbl>`;}
  else body+=`<w:sdt><w:sdtPr><w:id w:val="${10000+index}"/><w:tag w:val="${key}"/><w:alias w:val="${xml(field.label)}"/></w:sdtPr><w:sdtContent>${p('[Awaiting practitioner-authored or authorized canonical report content]')}</w:sdtContent></w:sdt>`;
 }
 const bytes=createClientTemplateDocx(body,{header:'RECONSTRUCTED RESPONSE LAYOUT · source outline retained separately',footer:'Application-authored derivative · professional/source-layout acceptance remains required'});if(bytes.length>monitoringReconstructionLimits.bytes)fail('The labelled reconstructed template exceeds its one MiB budget.');
 const manifest={format:'esia-monitoring-outline-reconstruction',schemaVersion:1,generatorVersion:monitoringReconstructionVersion,familyId:inspection.family.id,classification:eligibility.classification,sourceSha256:source.sourceSha256,sourceTemplateSha256:source.templateSha256,sourceManifestSha256,derivativeSha256:hash(bytes),fields:rows,masterUnchanged:true,sourceLayoutPreserved:false,responseLayout:'application_authored_expanding_docx',sourceFieldsAreHeadingsOnly:true,reviewStatus:'proposed',professionalAcceptance:false};
 return {bytes,filename:`${inspection.family.id}-reconstructed-outline.docx`,mediaType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',manifest,manifestSha256:hash(manifest)};
}

export function proposeMonitoringReconstructionBindings({analysis,manifest,templateId='pending'}={}){
 if(analysis?.fields?.length!==manifest?.fields?.length)fail('The reconstructed document contains unexpected or missing response controls.');
 return analysis.fields.map(field=>{const source=manifest.fields.find(row=>row.derivativeKey===(field.anchor.key||field.anchor.group)),proposed=source?.proposedBinding;if(!proposed)fail('The reconstructed response control has no exact original heading relationship.');const binding={...structuredClone(proposed),id:`binding:${field.id}`,fieldId:field.id,anchor:structuredClone(field.anchor),review:{status:'proposed'},origin:'source_structure_reconstruction_proposal'};if(binding.type==='extension')binding.namespace=`template.${templateId}.${field.id}`;else delete binding.namespace;return binding;});
}
