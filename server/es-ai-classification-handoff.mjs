import {createHash} from 'node:crypto';
import {prepareEngagementDocumentClassification} from './engagement-analysis.mjs';
import {documentProfileScalars,documentProfileLists,normalizeDocumentProfile} from '../src/lib/document-classification.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const sha=/^[a-f0-9]{64}$/;

/** Prepare the existing exact-source suggestion. Durable CAS, current source
 * authorization and classificationAuthority remain the owning adapter's job. */
export async function prepareEsAiClassificationHandoff({run,item,engagement,project,actorId,readVersion,at}={}){
  if(!run?.validation?.valid||typeof run.id!=='string'||!run.id||run.id.length>192||!item?.id||typeof readVersion!=='function')fail('Choose a validated document classification and its retained source reader.');
  if(!engagement||engagement.projectId!==project?.id)fail('Choose the owning engagement and its exact source project.',404);
  const raw=run.output?.items?.find(value=>value.id===item.id),review=(run.reviews||[]).findLast(value=>value.itemId===item.id);
  if(!raw||!review||!['accepted','corrected'].includes(review.decision))fail('Accept or correct the document classification before retaining its suggestion.');
  const reviewed=review.correction||raw;
  if(!['classification','document_classification'].includes(reviewed.kind)||!object(reviewed.fields))fail('Choose reviewed document classification fields.');
  const ids=reviewed.supportingPassageIds;
  if(!Array.isArray(ids)||ids.length<1||ids.length>8||new Set(ids).size!==ids.length||(reviewed.contradictoryPassageIds||[]).length)fail('Use one to eight distinct supporting passages and resolve contradictory classification evidence.');
  const passages=ids.map(id=>(run.passages||[]).find(passage=>passage.id===id));
  if(passages.some(passage=>!passage||passage.masked===true||passage.citationEligible===false||passage.sourceKind&&passage.sourceKind!=='project_document'||passage.resourceVersionId||passage.fileId))fail('Document classification requires exact unmasked project original passages.');
  const versionId=passages[0].versionId||passages[0].documentVersionId,resource=project.resources?.find(value=>value.versions?.some(version=>version.id===versionId)),version=resource?.versions.find(value=>value.id===versionId);
  if(!version||passages.some(passage=>(passage.versionId||passage.documentVersionId)!==versionId||passage.documentVersionId&&passage.documentVersionId!==versionId||(passage.sourceSha256||passage.sha256)!==version.sha256||passage.sha256&&passage.sha256!==version.sha256))fail('Every classification citation must identify the same exact project document and SHA256.');
  const marker=`AI run ${run.id};`;
  const prior=[version.effectiveMetadata,version.intakeMetadata,...(resource.metadataHistory||[]).filter(entry=>entry.versionId===versionId).map(entry=>entry.metadata)];
  if(prior.some(metadata=>metadata?.classification?.provenance?.method?.includes(marker)))fail('This AI run already has a retained document classification. Review that suggestion.');
  const fields=Object.fromEntries([...Object.keys(documentProfileScalars),...Object.keys(documentProfileLists)].filter(key=>key!=='requirementIds'&&Object.hasOwn(reviewed.fields,key)).map(key=>[key,reviewed.fields[key]]));
  if(reviewed.fields.requirementIds!==undefined&&!Array.isArray(reviewed.fields.requirementIds))fail('Document requirement links must be a list.',400);
  const allowed=new Set((engagement.requirements||[]).map(requirement=>requirement.id));
  fields.requirementIds=[...new Set([...(reviewed.fields.requirementIds||[]),...(reviewed.requirementId?[reviewed.requirementId]:[])].filter(id=>allowed.has(id)))];
  const metadata=normalizeDocumentProfile(fields,{defaults:true});
  const provenance={kind:'ai',model:String(run.route?.model||'Explicit AI route').slice(0,1000),method:`E&S skill ${run.skill?.id||run.skillId||'es.document.classification'}; version ${run.skill?.version||'1.0.0'}; ${marker} item ${reviewed.id}; reviewed draft handoff`,promptHash:sha.test(run.requestDigest||'')?run.requestDigest:hash(JSON.stringify({runId:run.id,skill:run.skill,output:run.outputDigest||''}))};
  const change=await prepareEngagementDocumentClassification({engagement,project,actorId,at:at||new Date().toISOString(),readVersion,command:{type:'suggest',versionId,sourceSha256:version.sha256,metadata,passageIds:ids,provenance}});
  // The shared preparer independently extracts IDs. Also bind every retained
  // run quotation and locator to that new exact extraction, not just its hash.
  if(passages.some(passage=>!change.classification.evidence.some(evidence=>evidence.passageId===passage.id&&evidence.versionId===versionId&&evidence.sourceSha256===version.sha256&&evidence.quote===passage.quote&&evidence.locator===passage.locator)))fail('A classification quotation or locator no longer matches its exact original extraction.');
  return change;
}
