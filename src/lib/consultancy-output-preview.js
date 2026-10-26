import demo from '../data/consultancy-demo.js';

export const consultancyPreviewNotice='Authored synthetic teaching example. AI responses, human review and approval were simulated. These project commitments are not qualified lender-standard clauses, real client findings or professional acceptance.';
export const consultancyPreviewMeaning='SHA256 of this normalized public presentation, not the original approval hash or authority. Actual HTML, DOCX and XLSX were checked against one simulated approved baseline before identifiers and runtime dates were omitted.';
export const consultancyPreviewNormalization='Only four authored study rows; random custody, project, engagement, finding, action and approval identifiers and runtime timestamps are omitted.';
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=()=>{throw Error('Invalid synthetic consultancy output preview.');};
function keys(value,expected){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==expected.length||expected.some(key=>!Object.hasOwn(value,key)))fail();}
const text=(value,max=4000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail();};

/** Fixed, reviewed teaching data only; this is not a client-package renderer. */
export function validateConsultancyOutputPreview(value){
  keys(value,['format','schemaVersion','synthetic','professionalAcceptance','inference','notice','provenance','baseline','rows']);
  if(value.format!=='esia-synthetic-consultancy-output-preview'||value.schemaVersion!==1||value.synthetic!==true||value.professionalAcceptance!==false||value.inference!=='transport_simulation'||value.notice!==consultancyPreviewNotice)fail();
  keys(value.provenance,['generatorVersion','sameBaselineVerified','formats','sourceCatalogSha256','rendererSourceSha256','normalization']);
  const p=value.provenance;if(p.generatorVersion!=='1'||p.sameBaselineVerified!==true||JSON.stringify(p.formats)!==JSON.stringify(['html','docx','xlsx'])||!digest(p.sourceCatalogSha256)||!digest(p.rendererSourceSha256)||p.normalization!==consultancyPreviewNormalization)fail();
  keys(value.baseline,['label','projectionSha256','meaning']);if(value.baseline.label!=='Simulated approved due-diligence baseline'||!digest(value.baseline.projectionSha256)||value.baseline.meaning!==consultancyPreviewMeaning)fail();
  if(!Array.isArray(value.rows)||value.rows.length!==demo.documents.length)fail();
  value.rows.forEach((row,index)=>{
    const original=demo.documents[index];keys(row,['id','title','requirement','source','finding','action']);
    if(row.id!==original.id||row.title!==original.title||row.requirement!==original.commitment)fail();
    keys(row.source,['filename','sha256','locator','quote']);if(row.source.filename!==original.filename||!digest(row.source.sha256)||!original.content.includes(row.source.quote)||row.source.quote.length<20)fail();text(row.source.locator,500);text(row.source.quote,2000);
    keys(row.finding,['coverage','adequacy','performance','rationale','uncertainty']);if(row.finding.coverage!=='partial'||row.finding.adequacy!=='deficient'||row.finding.performance!=='undetermined')fail();text(row.finding.rationale);text(row.finding.uncertainty);if(!row.finding.rationale.startsWith('SIMULATED SOURCE-REVIEWED CORRECTION:')||!row.finding.uncertainty.startsWith('Synthetic source evidence only;'))fail();
    keys(row.action,['description','owner','trigger','closureEvidence','status']);for(const key of ['description','owner','trigger','closureEvidence'])text(row.action[key]);if(row.action.status!=='open'||row.action.owner!=='Synthetic sponsor E&S manager')fail();
  });
  return value;
}

export function consultancyPreviewDigestInput(value){validateConsultancyOutputPreview(value);return JSON.stringify({...value,baseline:{label:value.baseline.label,meaning:value.baseline.meaning}});}
