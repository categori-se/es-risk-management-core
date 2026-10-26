// Pure import planning, not an authenticated execution or storage adapter.
// Callers must supply freshly authorized destination originals/entitlement rows
// and commit their current authority fences with the successor constructor.
import {createHash} from 'node:crypto';
import {engagementEntityNames,normalizeEngagementAuthentication,stableJson,uuidPattern,sha256Pattern} from '../src/lib/engagement-domain.js';
import {validateEngagementPackages,engagementPackageSourceVersionIds} from './engagement-store.mjs';
import {engagementLibraryUse,validateEngagementLibraryEntitlement} from './engagement-library.mjs';
import {validateEngagementSourceMetadata} from './engagement-source-metadata.mjs';

export const engagementSuccessorLimits=Object.freeze({archiveBytes:40*1024*1024,projectBytes:8*1024*1024,packageBytes:32*1024*1024,versions:1000,sourceArtifacts:100,nodes:1000000,depth:128});
const digest=value=>createHash('sha256').update(value).digest('hex');
const fail=(message,statusCode=400)=>{throw Object.assign(Error(message),{statusCode});};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const opaque=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value)&&!value.includes('..');
const exact=(value,keys,label)=>{if(!object(value)||Object.keys(value).some(key=>!keys.includes(key)))fail(`${label} contains unsupported fields.`);};
const pointer=value=>String(value).replaceAll('~','~0').replaceAll('/','~1');
const sourceScalar=new Set(['versionId','sourceVersionId']),sourceArrays=new Set(['agreementVersionIds','versionIds','captureVersionIds']);
const recordScalar=new Set(['engagementId','requirementId','sourceRequirementId','targetRequirementId','priorFindingId','baselineId','workingBaselineId','latestBaselineId','previousBaselineId','publicationId','programId','cycleId','eventId','indicatorId','targetId','lastVerificationId','occurrenceId','supersededBy','findingId','assertionId']);
const recordArrays=new Set(['requirementIds','findingIds','originFindingIds','priorFindingIds','supportingAssertionIds','contradictoryAssertionIds','assertionIds','photoAssertionIds','closureAssertionIds','deliverableIds','dependencies','obligationIds','monitoringObligationIds','actionIds','baselineActionIds','submissionIds','eventIds','consolidatedFrom','changedIds']);

function versions(project){
 if(!object(project)||!opaque(project.id)||!Array.isArray(project.resources)||Buffer.byteLength(JSON.stringify(project))>engagementSuccessorLimits.projectBytes)fail('Use the complete bounded source project.',413);
 const rows=new Map(),resources=new Set();
 for(const resource of project.resources){if(!opaque(resource?.id)||resources.has(resource.id)||!Array.isArray(resource.versions))fail('Source resources require distinct retained identities and version lists.');resources.add(resource.id);
  for(const version of resource.versions){if(!opaque(version?.id)||rows.has(version.id)||!sha256Pattern.test(version.sha256||'')||!Number.isSafeInteger(version.size)||version.size<0||typeof version.mediaType!=='string'||!version.mediaType.length)fail('Source versions require exact unique IDs, SHA256, byte sizes and media types.');
   if(Object.hasOwn(version,'contentBase64')||Object.hasOwn(version,'bytesBase64'))fail('Stage evidence originals independently; the exchange contains version descriptors.');
   rows.set(version.id,{versionId:version.id,resourceId:resource.id,sha256:version.sha256,size:version.size,mediaType:version.mediaType,filename:version.filename||''});
  }
 }
 if(rows.size>engagementSuccessorLimits.versions)fail('The archive exceeds its explicit source-version bound.',413);return rows;
}
function portable(bytes){
 if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>engagementSuccessorLimits.archiveBytes)fail('Stage a complete exchange of at most 40 MiB.',413);
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('The archive must be complete UTF-8 JSON.');}
 let nodes=0;const stack=[{value,depth:0}];while(stack.length){const item=stack.pop();if(++nodes>engagementSuccessorLimits.nodes||item.depth>engagementSuccessorLimits.depth)fail('The archive exceeds its structural import bound.',413);if(typeof item.value==='number'&&!Number.isFinite(item.value))fail('The archive contains a nonfinite JSON number.');if(item.value&&typeof item.value==='object')for(const child of Object.values(item.value)){if(stack.length+nodes>=engagementSuccessorLimits.nodes)fail('The archive exceeds its structural import bound.',413);stack.push({value:child,depth:item.depth+1});}}
 return value;
}

/** Exact archive bytes are retained separately from this derived inventory.
 * Both current and historical references are covered; no archive IDs, wording,
 * attestations, extraction scopes, hashes or issued bytes are rewritten. */
export function inspectEngagementSuccessorArchive({bytes,expectedSha256,originArchives,originArchiveContext}={}){
 if(!(bytes instanceof Uint8Array)||!bytes.byteLength||bytes.byteLength>engagementSuccessorLimits.archiveBytes)fail('Stage a complete exchange of at most 40 MiB.',413);
 if(!sha256Pattern.test(expectedSha256||'')||digest(bytes)!==expectedSha256)fail('The staged archive differs from its exact SHA256.',409);
 const envelope=portable(bytes);exact(envelope,['format','schemaVersion','project','engagements','sourceMetadata'],'Successor archive');
 if(!['esia-engagement-successor-archive','esia-engagement-project-exchange'].includes(envelope.format)||envelope.schemaVersion!==1||!Array.isArray(envelope.engagements)||!envelope.engagements.length)fail('Use the full project and engagement archive envelope.');
 const project=envelope.project,sources=versions(project),accountId=project.storageAccount?.id||project.accountId||envelope.engagements[0]?.engagement?.accountId;
 if(!opaque(accountId))fail('Retain the original source-project custody identity.');
 validateEngagementPackages(project,envelope.engagements,{accountId,originArchives,originArchiveContext});
 const sourceMetadata=envelope.sourceMetadata===undefined?[]:envelope.sourceMetadata;
 if(!Array.isArray(sourceMetadata))fail('Source metadata history must be an explicit array.');
 if(sourceMetadata.length){
  if(envelope.engagements.length!==1)fail('Version-scoped metadata history must identify one original engagement envelope.');
  const raw=structuredClone(project),overlayIds=new Set(sourceMetadata.flatMap(row=>(row.revisions||[]).map(revision=>revision.id)));
  for(const resource of raw.resources){resource.metadataHistory=(resource.metadataHistory||[]).filter(row=>!overlayIds.has(row.id));for(const version of resource.versions)delete version.effectiveMetadata;}
  validateEngagementSourceMetadata({project:raw,engagementId:envelope.engagements[0].engagement.id,sourceMetadata});
 }
 const linkedSources=new Set(engagementPackageSourceVersionIds(project,envelope.engagements,{originArchives,originArchiveContext})),sourceReferences=[],recordReferences=[],records=[];
 const walk=(value,path)=>{
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){value.forEach((child,index)=>walk(child,`${path}/${index}`));return;}
  for(const[key,child]of Object.entries(value)){
   // An origin map points into its separately validated archive ancestry, not
   // into this project's current source register. Never rewrite those pins.
   if(['successor','origin','originBaselineRef'].includes(key))continue;
   const at=`${path}/${pointer(key)}`;
   if(sourceScalar.has(key)&&typeof child==='string'&&child){const source=sources.get(child);if(!source)fail(`An archived source reference is missing at ${at}.`,409);sourceReferences.push({path:at,...source});}
   if(sourceArrays.has(key)&&Array.isArray(child))child.forEach((id,index)=>{const source=sources.get(id);if(!source)fail(`An archived source reference is missing at ${at}/${index}.`,409);sourceReferences.push({path:`${at}/${index}`,...source});});
   if(key==='sourceVersions'&&Array.isArray(child))child.forEach((row,index)=>{const source=sources.get(row.id);if(!source||source.sha256!==row.sha256||source.size!==row.size)fail('An archived baseline source manifest changed.',409);sourceReferences.push({path:`${at}/${index}/id`,...source});});
   if(recordScalar.has(key)&&typeof child==='string'&&uuidPattern.test(child))recordReferences.push({path:at,id:child,field:key});
   if(recordArrays.has(key)&&Array.isArray(child))child.forEach((id,index)=>{if(typeof id==='string'&&uuidPattern.test(id))recordReferences.push({path:`${at}/${index}`,id,field:key});});
   walk(child,at);
  }
 };
 envelope.engagements.forEach((pack,index)=>{
  const base=`/engagements/${index}`;records.push({kind:'engagement',id:pack.engagement.id,path:`${base}/engagement`,current:true});
  for(const kind of engagementEntityNames)for(const[rowIndex,row]of(pack.entities[kind]||[]).entries())records.push({kind,id:row.id,path:`${base}/entities/${kind}/${rowIndex}`,current:true,historyCount:row.history.length,historicalOnly:['approvals','publications','sourceReviews'].includes(kind)});
  for(const[kind,rows]of[['baselines',pack.baselines],['audit',pack.audit],['issuedRenditions',pack.issuedRenditions||[]]])for(const[rowIndex,row]of rows.entries())records.push({kind,id:row.id,path:`${base}/${kind}/${rowIndex}`,current:false,historicalOnly:true});
  walk(pack,base);
 });walk(sourceMetadata,'/sourceMetadata');walk(project,'/project');
 return {archive:{format:'esia-engagement-successor-archive',schemaVersion:1,sha256:expectedSha256,size:bytes.byteLength,accountId,projectId:project.id,engagementIds:envelope.engagements.map(pack=>pack.engagement.id)},bytes:Buffer.from(bytes),project,packages:envelope.engagements,sourceMetadata,sources:[...sources.values()].map(row=>({...row,linked:linkedSources.has(row.versionId)})),policyUses:engagementLibraryUse(envelope.engagements),records,sourceReferences,recordReferences};
}

/** The mappings are data, not access grants. Every source in the retained
 * archive must map, including an uncited descriptor. Policy rows and any legacy
 * rights review are trusted, freshly read adapter inputs, never browser claims. */
export function prepareEngagementSuccessor({bytes,expectedSha256,destination,authentication,at,policyAuthorizations=[],originArchives,originArchiveContext}={}){
 const inspected=inspectEngagementSuccessorArchive({bytes,expectedSha256,originArchives,originArchiveContext});
 exact(destination,['engagementId','sourceEngagementId','workspaceId','project','sourceMappings'],'Successor destination');
 const auth=normalizeEngagementAuthentication(authentication),project=destination.project,target=versions(project),sourceEngagementId=destination.sourceEngagementId||(inspected.packages.length===1?inspected.packages[0].engagement.id:null),original=inspected.packages.find(pack=>pack.engagement.id===sourceEngagementId);
 if(!uuidPattern.test(destination.engagementId||'')||inspected.records.some(row=>row.id===destination.engagementId)||!opaque(destination.workspaceId)||!opaque(project.accountId)||!original||typeof at!=='string'||!Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)fail('Choose an exact new successor, original engagement and verified destination scope.');
 if(new Set([...target.values()].map(row=>row.resourceId)).size>engagementSuccessorLimits.sourceArtifacts)fail('The authenticated destination exceeds its 100 explicit document authority bound.',413);
 if(!Array.isArray(destination.sourceMappings)||destination.sourceMappings.length!==inspected.sources.length)fail('Map every archived source version explicitly, including uncited originals.');
 const mapping=new Map(),sources=new Map(inspected.sources.map(row=>[row.versionId,row]));
 for(const item of destination.sourceMappings){exact(item,['sourceVersionId','destinationVersionId'],'Original mapping');const source=sources.get(item.sourceVersionId),to=target.get(item.destinationVersionId);if(!source||!to||mapping.has(item.sourceVersionId)||source.sha256!==to.sha256||source.size!==to.size)fail('Map each original to independently authorized destination bytes with the same SHA256 and size.',409);mapping.set(source.versionId,{...source,destinationVersionId:to.versionId,destinationResourceId:to.resourceId});}
 if(!Array.isArray(policyAuthorizations)||policyAuthorizations.some(item=>!object(item))||policyAuthorizations.length!==inspected.policyUses.length)fail('Resolve every retained current and historical policy-library use independently.',403);
 const scope={engagementId:destination.engagementId,projectId:project.id,workspaceId:destination.workspaceId,accountId:project.accountId,userId:auth.userId},policies=[];
 const useKey=value=>stableJson([value.frameworkId,value.edition,value.sourcePackSha256]);
 for(const use of inspected.policyUses){const matches=policyAuthorizations.filter(item=>useKey(item)===useKey(use));if(matches.length!==1)fail('Each retained policy use requires one explicit destination entitlement.',403);const grant=matches[0];exact(grant,['frameworkId','edition','sourcePackSha256','destinationSourcePackSha256','entitlement','legacyReview'],'Policy migration authority');
  const destinationPin=grant.destinationSourcePackSha256;if(!sha256Pattern.test(destinationPin||'')||use.sourcePackSha256&&destinationPin!==use.sourcePackSha256)fail('Retain a known original policy pack pin; do not substitute today’s policy edition or pack.',403);
  const entitlement=validateEngagementLibraryEntitlement(grant.entitlement,{scope,frameworkId:use.frameworkId,sourcePackSha256:destinationPin,sourceSha256s:use.sourceSha256s,action:'requirements',now:at});
  if(use.requiresMigration){const review=grant.legacyReview;exact(review,['archiveSha256','frameworkId','edition','sourceSha256s','destinationSourcePackSha256','reviewedBy','reviewedAt','statement'],'Legacy policy rights review');if(review.archiveSha256!==expectedSha256||review.frameworkId!==use.frameworkId||review.edition!==use.edition||review.destinationSourcePackSha256!==destinationPin||!Array.isArray(review.sourceSha256s)||stableJson([...review.sourceSha256s||[]].sort())!==stableJson([...use.sourceSha256s].sort())||!opaque(review.reviewedBy)||typeof review.reviewedAt!=='string'||!Number.isFinite(Date.parse(review.reviewedAt))||Date.parse(review.reviewedAt)>Date.parse(at)||typeof review.statement!=='string'||review.statement.trim().length<20||review.statement.length>4000)fail('An operator must explicitly review this archive’s unpinned legacy policy sources and destination rights; preserve the archive unchanged.',403);}
  else if(grant.legacyReview!==undefined)fail('A pinned policy use does not require an invented legacy migration review.');
  policies.push({...use,destinationSourcePackSha256:destinationPin,entitlementRevision:entitlement.revision,...(grant.legacyReview?{legacyReview:structuredClone(grant.legacyReview)}:{})});
 }
 return {...inspected,format:'esia-engagement-successor-plan',schemaVersion:1,destination:{...scope,sourceEngagementId},creator:auth,at,sourceMappings:[...mapping.values()],policyMappings:policies,mappedSourceReferences:inspected.sourceReferences.map(reference=>({...reference,destinationVersionId:mapping.get(reference.versionId).destinationVersionId})),
  workingGraph:structuredClone(original.entities),origin:{archiveSha256:expectedSha256,projectId:inspected.archive.projectId,accountId:inspected.archive.accountId,engagementId:original.engagement.id,authority:original.engagement.executionAuthority?'retained_authenticated_history':'local_declared_history',baselines:original.baselines.map(row=>({id:row.id,sha256:row.sha256})),issuedRenditions:(original.issuedRenditions||[]).map(({contentBase64,...metadata})=>metadata)},
  constructionRequired:{currentRoles:'verified_creator_then_explicit_invitations',humanReviews:'new_unverified_candidates',approvalsAndPublications:'historical_archive_only',monitoringAnchors:'explicit_originBaselineRef',extractionBindings:'retain_original_scope_as_historical_provenance',recordIds:'new_successor_scoped_ids_with_explicit_origin_map'}};
}
