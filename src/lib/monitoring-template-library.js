import {proposeTemplateBindings, validateTemplateBindings, resolveTemplateReport, templateCanonicalFields, templateBindingVersion} from './client-template-bindings.js';

const freeze = value => {if(value && typeof value === 'object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const copy = value => structuredClone(value);
const fail = (message, status=400) => {throw Object.assign(Error(message),{status});};
export const monitoringTemplateLibraryVersion = 1;
export const monitoringTemplateSpecializations = freeze([
  {id:'integrated_project',label:'Integrated project E&S monitoring',scope:'Project components, agreed commitments, site evidence, environmental and social performance.'},
  {id:'environmental_construction',label:'Environmental construction monitoring',scope:'Contract and component scope, mitigation, inspections, methods, units and contextual observations.'},
  {id:'social_safeguards',label:'Social safeguard implementation',scope:'Entitlement delivery, livelihood outcomes, Indigenous Peoples safeguards and protected source evidence; separate from environmental indicators.'},
  {id:'direct_investment',label:'Direct investment annual monitoring',scope:'Investment-specific requirements, covenants, ESAP commitments and annual performance; no generic institutional rating.'},
  {id:'financial_intermediary',label:'Financial intermediary portfolio monitoring',scope:'Defined portfolio perimeter, product and sector exposure, currency and denominator, risk categories and ESMS; separate from site inspections.'},
  {id:'completion_assessment',label:'Completion-stage institutional assessment',scope:'Completion evidence, unresolved measures and continuing duties; an application review cannot create a lender opinion.'}
]);
const families = [
 ['world_bank_periodic','World Bank periodic E&S report','world_bank','app-world-bank-periodic',['integrated_project','social_safeguards'],['a2d7eb25-e399-5593-93c7-fe481643a55b'],'wb-annex7-periodic','Editable World Bank project annex; confirm project-specific reporting agreement.'],
 ['adb_environmental','ADB semiannual environmental monitoring report','adb','app-adb-environmental-semiannual',['environmental_construction'],['aad98a18-8190-542e-9c6f-10ebb11646a5'],'adb-fieldkit-semiannual','Editable ADB reporting form; field-kit form remains a project-specific sample.'],
 ['adb_social','ADB social safeguards monitoring report','adb','app-adb-social-monitoring',['social_safeguards'],['2b65e1e1-fd86-5fb6-af69-d84c91b99c44'],'adb-social-appendix10','Editable ADB social reporting form and project-applicable land/livelihood/IP schedules.'],
 ['ebrd_aesr','EBRD Annual Environmental and Social Report','ebrd','app-ebrd-aesr',['direct_investment'],['3305f877-eebb-527e-83c8-ad5206b7cfd5'],null,'Agreed direct-investment blank AESR and current contractual requirements.'],
 ['ifc_amr','IFC Annual Monitoring Report','ifc','app-ifc-amr',['direct_investment','financial_intermediary'],['9887812d-0e91-56d4-92f5-3745d964e163','4bc95758-de0f-55b5-bdc7-ce4d4a907887'],null,'Contractual direct-investment AMR and separate FI AEPR originals; procedures are guidance.'],
 ['fmo_annual','FMO annual E&S performance report','fmo','app-fmo-fi-annual',['financial_intermediary'],['f9cad727-f287-5fac-ba03-a9b0f133099d'],'fmo-mfi-annual','Current FMO reporting variant and its investment/portfolio perimeter; MFI example is undated.'],
 ['aiib_monitoring','AIIB E&S monitoring report','aiib','app-aiib-integrated-monitoring',['integrated_project','environmental_construction'],['fe1ec2bd-2c3a-5204-8261-0dac48af9a73'],'aiib-n5-annex3b','Finalized project-agreed AIIB template; the disclosed N5 draft is project-specific.'],
 ['eib_completion','EIB Environmental and Social Completion Sheet','eib','app-eib-completion',['completion_assessment'],['cebd51d3-428b-539e-939e-f09f110717c4'],null,'Editable EIB completion master and authorized institutional review; published example is a completed Bank opinion.']
];
export const monitoringTemplateFamilies = freeze(families.map(([id,label,institutionId,workingProfileId,specializationIds,sourceVersionIds,defaultUnitId,missingSource]) => ({id,label,institutionId,workingProfileId,specializationIds,sourceVersionIds,defaultUnitId,version:1,status:'provisional',missingSource,authority:'application_authored_mapping_profile'})));
export function getMonitoringTemplateFamily(id){return monitoringTemplateFamilies.find(row=>row.id===id||row.workingProfileId===id)||null;}

// Paths are views over existing E&S Review records. Empty bindings are explicit
// extension proposals and never additions to the authoritative domain schema.
export const monitoringCanonicalAreas = freeze([
 {id:'projects_components',label:'Projects and components',paths:['project.id','project.name'],extension:'component_and_contract_identity'},
 {id:'organizations_financing',label:'Organizations and financing',paths:['project.engagement.client'],extension:'financing_and_organization_roles'},
 {id:'engagement_cycles',label:'Engagements and reporting cycles',paths:['engagement.id','engagement.scope','cycles.periodStart','cycles.periodEnd']},
 {id:'requirements',label:'Applicable E&S requirements',paths:['requirements.frameworkId','requirements.edition','requirements.standard','requirements.clause','requirements.text']},
 {id:'commitments',label:'Legal covenants and commitments',paths:['monitoringObligations.title','monitoringObligations.sourceVersionId','monitoringObligations.locator','monitoringObligations.verificationCriteria']},
 {id:'plans_measures',label:'Management plans and measures',paths:['actions.description','actions.owner','actions.dueDate','actions.verificationCriteria']},
 {id:'indicators_observations',label:'Monitoring indicators and observations',paths:['indicators.name','indicators.unit','indicators.method','measurements.value','measurements.dataQuality']},
 {id:'inspections_evidence',label:'Field inspections and evidence',paths:['missions.scope','missions.assertionIds','assertions.versionId','assertions.sourceSha256','assertions.locator','assertions.quote']},
 {id:'labor_ohs',label:'Labor and OHS performance',paths:['events.publicSummary','findings.rationale'],extension:'workforce_exposure_denominators'},
 {id:'environmental_measurements',label:'Environmental measurements',paths:['measurements.value','measurements.unit','measurements.method','measurements.location','measurements.observedAt']},
 {id:'resettlement_livelihoods',label:'Resettlement and livelihoods',paths:['actions.description','verifications.statement'],extension:'protected_entitlement_delivery_outcomes'},
 {id:'indigenous_safeguards',label:'Indigenous Peoples safeguards',paths:['requirements.text','findings.rationale','assertions.locator'],extension:'protected_collective_decision_evidence'},
 {id:'engagement_grievances',label:'Stakeholder engagement and grievances',paths:['events.kind','events.status','events.publicSummary','missions.assertionIds']},
 {id:'incidents_nonconformities',label:'Incidents and nonconformities',paths:['events.kind','events.severity','events.publicSummary','findings.deficiency']},
 {id:'corrective_verification',label:'Corrective actions and verification',paths:['actions.description','actions.status','actions.closureAssertionIds','verifications.decision','verifications.statement']},
 {id:'completion_approvals',label:'Completion assessments and approvals',paths:['verifications.decision','verifications.reviewedBy','verifications.reviewedAt'],extension:'institutional_completion_opinion'},
 {id:'fi_portfolio',label:'Financial intermediary portfolio',paths:[],extension:'portfolio_exposure_currency_denominators'},
 {id:'institutional_scores',label:'Institutional scores and formulas',paths:[],extension:'source_specific_rating_methodology'}
]);

function sourceEvidence(source,anchor={}) {
 const reconstructed=source.reconstruction?.fields?.find(row=>row.derivativeKey===(anchor.key||anchor.group)),page=Number.isSafeInteger(anchor.page)?anchor.page:null,originalPage=reconstructed?.originalPage??(page!==null?page+(source.annex?.startPage||1)-1:null);
 return {resourceVersionId:source.resourceVersionId,fileId:source.fileId,sourceSha256:source.sourceSha256,templateSha256:source.templateSha256||source.sourceSha256,
  originalPage,nativeElement:copy(anchor),...(reconstructed?{originalNativeElement:copy(reconstructed.originalNativeElement),sourceHeadingOnly:true,responseLayout:'application_authored_reconstruction'}:{}),...(source.annex?{annex:copy(source.annex)}:{})};
}
const identity=value=>{let digest=2166136261;for(const character of value)digest=Math.imul(digest^character.charCodeAt(0),16777619);return (digest>>>0).toString(16).padStart(8,'0');};
/** Exact printed labels become structural proposals, never automatic fillable
 * PDF inputs. Rectangle placement and meaning still belong to Studio review. */
export function extractMonitoringStructuralFields(source) {
 const fields=[];
 const startsLabel=text=>/^(?:\d+(?:\.\d+)*[.)]?\s+|[IVXLCDM]{1,8}\s+(?![–—-]))/.test(text)||/(?:loan[-. ]*\.{3,}|date\.{3,})/i.test(text);
 for(const page of source.layout?.pages||[]){
  // Numbering is sometimes emitted in a separate Poppler block. Join only
  // coincident visual baselines, then retain every contributing native line.
  const rows=[];for(const [index,line]of (page.lines||[]).entries()){
   const row=rows.find(item=>Math.abs(item.y-line.y)<=Math.min(item.height,line.height)*.4);
   if(row){row.segments.push({...line,index});row.x=Math.min(row.x,line.x);row.width=Math.max(...row.segments.map(item=>item.x+item.width))-row.x;row.y=Math.min(row.y,line.y);row.height=Math.max(...row.segments.map(item=>item.y+item.height))-row.y;}
   else rows.push({...line,segments:[{...line,index}]});
  }
  rows.sort((a,b)=>a.y-b.y||a.x-b.x);for(const row of rows){row.segments.sort((a,b)=>a.x-b.x);row.text=row.segments.map(item=>item.text.trim()).join(' ');}
  for(let rowIndex=0;rowIndex<rows.length;rowIndex++){
  const line=rows[rowIndex];let label=line.text?.trim()||'';
  if(!label||label.length>2000||/^\d+\s+(?:ENVIRONMENTAL SAFEGUARD|ANNEX I:)/i.test(label))continue;
  if(!startsLabel(label))continue;
  const fragments=[line];
  for(let next=rowIndex+1;next<rows.length&&fragments.length<6;next++){
   const candidate=rows[next],prior=fragments.at(-1),text=candidate.text.trim();
   if(startsLabel(text)||/^[A-Z][A-Z\s:]+$/.test(text)||candidate.y-prior.y-prior.height>Math.max(6,prior.height*.9)||candidate.x<line.x-2||label.length+text.length+1>2000)break;
   fragments.push(candidate);label+=' '+text;rowIndex=next;
  }
  const x=Math.min(...fragments.map(row=>row.x)),y=Math.min(...fragments.map(row=>row.y)),nativeLines=fragments.flatMap(row=>row.segments.map(segment=>segment.index));
  const anchor={kind:'pdf_structure_label',page:page.page,line:nativeLines[0],nativeLines,rect:[x,y,Math.max(...fragments.map(row=>row.x+row.width)),Math.max(...fragments.map(row=>row.y+row.height))],coordinateBasis:'pdf_points_top_left',sourceText:label};
  fields.push({id:`structure_${page.page}_${identity(`${nativeLines.join(',')}:${label}`)}`,label,type:'text',required:false,anchor,structuralOnly:true,inputRegionVerified:false});
  if(fields.length>=1000)return fields;
 }}
 return fields;
}
function structuralBinding(field,templateId,accountId) {
 const proposed=proposeTemplateBindings({analysis:{templateId,fields:[field]},accountId})[0],label=field.label.replace(/^\d+(?:\.\d+)*[.)]?\s+|^[IVXLCDM]{1,8}\s+/,'');
 const narrative=/\b(compliance|status|conclusion|recommendation|methodology|approach|key issues)\b/i.test(label);
 if(narrative)return {...proposed,type:'narrative',namespace:undefined,path:undefined,meaning:'Source-specific reviewed narrative supported by canonical evidence; no automatic institutional conclusion.',origin:'source_label_semantic_proposal',confidence:0.5};
 if(/corrective action plan|corrective actions/i.test(label))return {...proposed,type:'repeat',namespace:undefined,path:'actions',columns:{description:{path:'description'},owner:{path:'owner'},dueDate:{path:'dueDate'},status:{path:'status'},verificationCriteria:{path:'verificationCriteria'}},origin:'source_label_semantic_proposal',meaning:'Repeat canonical corrective actions; preserve original source wording and review scope.',confidence:0.7};
 if(/complaints received|table of grievance/i.test(label))return {...proposed,type:'repeat',namespace:undefined,path:'events',columns:{publicSummary:{path:'publicSummary'},status:{path:'status'},receivedAt:{path:'receivedAt'}},filter:{op:'eq',path:'kind',value:'grievance'},origin:'source_label_semantic_proposal',meaning:'Authorized aggregate grievance events only; sensitive identities remain protected.',confidence:0.65};
 const profile=/project background|project.*objectives/i.test(label)?'project.description':/capacity building/i.test(label)?'management.capacityPlan':/training/i.test(label)?'management.trainingPlan':/grievance redress mechanism/i.test(label)?'stakeholderEngagement.grievanceChannels':/compensation/i.test(label)?'resettlement.budget':null;
 return profile?{...proposed,type:'extension',extensionProfile:profile,meaning:`Report-only specialist narrative: ${profile}; citations and substantive review required.`,origin:'source_label_semantic_proposal',confidence:0.55}:proposed;
}
export function buildMonitoringFormDefinition({definition,familyId}={}) {
 const family=getMonitoringTemplateFamily(familyId);if(!family||!Array.isArray(definition?.fields)||definition.fields.length>1000)fail('Select one monitoring family and a bounded native definition.');
 return {format:'esia-monitoring-form-definition',schemaVersion:1,familyId:family.id,definitionVersion:definition.version||1,dataScope:'existing_canonical_records_and_report_values',canonicalWrites:false,
  controls:definition.fields.map(field=>{const binding=definition.bindings?.find(row=>row.fieldId===field.id),editable=['narrative','extension'].includes(binding?.type),approved=binding?.review?.status==='approved';return {fieldId:field.id,label:field.label,type:field.type||'text',valueType:field.valueType||field.type||'text',required:field.required===true,
   control:binding?.type==='repeat'||['repeat_table','array'].includes(field.type)?'repeating_table':field.type==='boolean'?'checkbox':field.type==='date'?'date':['number','integer'].includes(field.type)?'number':editable?'narrative':'canonical_preview',readOnly:!editable,enabled:approved,
   ...(field.columns?{columns:copy(field.columns)}:{}),...(binding?.condition?{condition:copy(binding.condition)}:{}),bindingType:binding?.type||'unmapped',canonicalPath:binding?.path||null,review:copy(binding?.review||{status:'proposed'}),
   evidenceLinks:true,authorshipRequired:editable,humanReviewRequired:editable||!approved,writeOperation:editable?'existing_studio_report_value_save':null};}),
  notice:'Canonical values are prefilled through existing authorization and read-only bindings. Report-specific capture uses existing Studio values and never overwrites project monitoring records.'};
}

export function buildMonitoringTemplateMapping({familyId,analysis,source,templateId='pending',accountId,bindings}={}) {
 const family=getMonitoringTemplateFamily(familyId);
 if(!family||!analysis||!['pdf','docx','xlsx'].includes(analysis.format)||!Array.isArray(analysis.fields)||analysis.fields.length>1000||!Array.isArray(analysis.sections)||
    !source||!/^[a-f0-9]{64}$/.test(source.sourceSha256||'')||analysis.sourceSha256!==(source.templateSha256||source.sourceSha256)||source.institutionId&&source.institutionId!==family.institutionId)fail('Mapping requires an exact verified native source in the selected institutional family.',409);
 const proposed=bindings?copy(bindings):proposeTemplateBindings({analysis:{...analysis,templateId},accountId});
 const definition={id:templateId,version:1,accountId,format:analysis.format,sourceSha256:analysis.sourceSha256,fields:copy(analysis.fields),sections:copy(analysis.sections),bindings:proposed};
 const validation=validateTemplateBindings({definition});if(!validation.valid)fail(`Native mapping proposals failed typed canonical validation: ${validation.errors.map(row=>row.message).join(' ')}`,422);
 const structuralFields=analysis.format==='pdf'?extractMonitoringStructuralFields(source):[],structuralBindings=structuralFields.map(field=>structuralBinding(field,templateId,accountId));
 const crosswalk=analysis.fields.map(field=>{const binding=proposed.find(row=>row.fieldId===field.id);return {fieldId:field.id,originalLabel:field.label,sourceEvidence:sourceEvidence(source,field.anchor),originalType:field.type||'text',binding:copy(binding),
  transformationVersion:templateBindingVersion,canonicalSemantics:binding?.path&&templateCanonicalFields[binding.path]?copy(templateCanonicalFields[binding.path]):null,consequential:true,approvalRequired:true,outputRepresentation:field.anchor?.kind||analysis.format};});
 crosswalk.push(...structuralFields.map((field,index)=>({fieldId:field.id,originalLabel:field.label,sourceEvidence:sourceEvidence(source,field.anchor),originalType:'printed_source_structure',binding:copy(structuralBindings[index]),transformationVersion:templateBindingVersion,consequential:true,approvalRequired:true,structuralOnly:true,inputRegionVerified:false,outputRepresentation:'requires_human_defined_overlay_or_labelled_reconstruction'})));
 const extensionProposals=monitoringCanonicalAreas.filter(area=>area.extension).map(area=>({id:`proposal:${family.id}:${area.extension}`,areaId:area.id,label:area.label,
  proposedConcept:area.extension,existingCanonicalPaths:copy(area.paths),status:'domain_review_required',scope:'report_only_until_separate_schema_approval',automaticallyPromoted:false,
  rationale:area.id==='fi_portfolio'?'Portfolio perimeter, exposure, currency and denominators must be defined independently of site inspection and project measurements.':area.id==='resettlement_livelihoods'||area.id==='indigenous_safeguards'?'Protected specialist identities and outcomes remain in separately authorized sources; aggregate report narratives require citations and substantive review.':'Review shared identity, semantics, protection and migration before any canonical schema addition.'}));
 const staticPdf=analysis.format==='pdf'&&!analysis.fields.some(field=>['pdf_overlay','pdf_form'].includes(field.anchor?.kind));
 const manifest={format:'esia-institutional-template-structure',schemaVersion:1,familyId:family.id,source:copy(source),templateSha256:analysis.sourceSha256,parser:analysis.parser||'existing_deterministic_native_analyzer',
  sourceClassification:source.sourceClassification||'unverified',sections:copy(analysis.sections),fields:analysis.fields.map(field=>({...copy(field),sourceEvidence:sourceEvidence(source,field.anchor)})),
  structure:copy(analysis.structure||{}),parts:copy(analysis.parts||[]),structuralFields:structuralFields.map(field=>({...copy(field),sourceEvidence:sourceEvidence(source,field.anchor)})),...(source.layout?{layout:copy(source.layout)}:{}),
  extractionStatus:staticPdf?'geometry_and_text_retained_input_regions_require_human_definition':'native_structural_extraction',semanticInterpretation:'proposals_require_human_review',
  limitations:[...(analysis.warnings||[]),...(staticPdf?['Static PDF text and table geometry do not establish editable input fields. Review original labels and create explicit controlled overlay regions in Publication Studio.']:[]),
   'Field labels, source elements and institutional meaning remain separate from canonical facts. Automated structure extraction does not provide institutional acceptance.']};
 return {format:'esia-monitoring-template-mapping',schemaVersion:1,family:copy(family),manifest,definition,crosswalk,canonicalAreas:copy(monitoringCanonicalAreas),extensionProposals,
  formDefinition:buildMonitoringFormDefinition({definition,familyId:family.id}),proposedStructuralForm:buildMonitoringFormDefinition({definition:{...definition,fields:structuralFields,bindings:structuralBindings},familyId:family.id}),renderingSpec:{format:'esia-monitoring-rendering-specification',schemaVersion:1,sourceFormat:analysis.format,
   mode:source.reconstruction?'labelled_application_authored_reconstruction':analysis.format==='pdf'?'controlled_pdf_derivative':'source_preserving_native',nativeOriginalAvailable:analysis.format!=='pdf'&&!source.reconstruction,pdfOnlyDerivative:analysis.format==='pdf'||!!source.reconstruction,
   originalLayout:source.reconstruction?'not_preserved_source_headings_only_response_layout_is_application_authored':'preserved_within_existing_renderer_capabilities',dataset:'one_pinned_existing_studio_canonical_snapshot',machineReadable:'same_resolved_field_dataset',
   generatedOfficeForPdf:'separately_labelled_reconstruction_requires_approved_definition',humanVisualReviewRequired:true,sourceHash:analysis.sourceSha256,
   limitations:['Native DOCX/XLSX population preserves source features within renderer limits. PDF-only originals do not imply an editable Office master.','Cross-format exports must retain the same pinned dataset identity; output layout equivalence requires visual review.']},
  compatibility:{status:staticPdf?'source_structure_only_input_regions_required':'provisional_until_current_studio_approval',familyVersion:family.version,bindingVersion:templateBindingVersion,sourceVersionId:source.resourceVersionId,sourceSha256:source.sourceSha256,
   templateSha256:analysis.sourceSha256,approved:false,institutionalAcceptance:false,blockingReasons:[staticPdf?'No actual controlled PDF input regions exist; printed source labels are not fillable fields.':'Every current native field mapping and reference still requires existing Studio human approval.'],missingSource:family.missingSource,requiresNativeReference:true,requiresEveryMappingReview:true,staticPdfNeedsOverlayFields:staticPdf},validation};
}

/** Pure authorized views; Studio remains responsible for persistence, roles,
 * current mapping reviews and report approval. No canonical write is exposed. */
export function projectMonitoringTemplateReport({familyId,definition,project,engagement,cycleId,values,accountId}={}) {
 const family=getMonitoringTemplateFamily(familyId);if(!family)fail('Choose an institutional monitoring family.');
 if(definition?.format==='pdf'&&!definition.fields?.some(field=>['pdf_overlay','pdf_form'].includes(field.anchor?.kind)&&definition.bindings?.some(binding=>binding.fieldId===field.id&&binding.review?.status==='approved')))fail('Define and explicitly review at least one controlled PDF input region before populating an institutional report. Source-only reference approval supplies no report inputs.',409);
 const resolved=resolveTemplateReport({definition,project,engagement,cycleId,values,accountId});
 return {format:'esia-monitoring-institutional-projection',schemaVersion:1,familyId:family.id,institutionId:family.institutionId,resolved,
  dataset:{format:'esia-monitoring-field-dataset',schemaVersion:1,projectId:project?.id,engagementId:engagement?.id,cycleId:cycleId||null,templateId:definition?.id,templateVersion:definition?.version||1,
   fields:resolved.values.map(row=>({fieldId:row.fieldId,label:definition.fields.find(field=>field.id===row.fieldId)?.label||row.fieldId,value:copy(row.value),visible:row.visible,provenance:copy(row.provenance),diagnostics:copy(row.diagnostics)})),
   populationValid:resolved.validation.valid,publicationReady:false,approvalAuthority:'existing_studio_template_baseline_and_report_workflow',canonicalWrites:false},formDefinition:buildMonitoringFormDefinition({definition,familyId:family.id})};
}
