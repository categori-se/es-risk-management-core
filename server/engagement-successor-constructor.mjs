// Construct a complete unverified working graph from an already exact archive.
// Historical records remain exclusively in the separately retained archive;
// this module never turns their local names or signatures into native Users.
import {randomUUID,createHash} from "node:crypto";
import {prepareEngagementSuccessor} from "./engagement-successor.mjs";
import {engagementEntityNames,normalizeMandate,normalizeProvenance,stableJson,uuidPattern,actionReviewerFields} from "../src/lib/engagement-domain.js";
import {monitoringCaseOriginReference,successorMonitoringCaseProtection} from './engagement-case-origins.mjs';

const hash=value=>createHash("sha256").update(value).digest("hex");
const fail=message=>{throw Object.assign(new Error(message),{status:409,statusCode:409});};
const clone=value=>structuredClone(value);
const archivedKinds=new Set(["approvals","publications","baselines","audit","issuedRenditions","sourceReviews"]);
const sourceKeys=new Set(["versionId","sourceVersionId"]),sourceLists=new Set(["agreementVersionIds","versionIds","captureVersionIds"]);
const recordKeys=new Set(["requirementId","sourceRequirementId","targetRequirementId","priorFindingId","programId","cycleId","eventId","indicatorId","targetId","lastVerificationId","occurrenceId","supersededBy","findingId","assertionId"]);
const recordLists=new Set(["requirementIds","findingIds","originFindingIds","priorFindingIds","supportingAssertionIds","contradictoryAssertionIds","assertionIds","photoAssertionIds","closureAssertionIds","deliverableIds","dependencies","obligationIds","monitoringObligationIds","actionIds","baselineActionIds","submissionIds","eventIds","consolidatedFrom"]);

export function constructEngagementSuccessor({bytes,expectedSha256,destination,authentication,at,policyAuthorizations=[],originArchives,originArchiveContext,newId=randomUUID}={}){
  const plan=prepareEngagementSuccessor({bytes,expectedSha256,destination,authentication,at,policyAuthorizations,originArchives,originArchiveContext}),source=plan.packages.find(pack=>pack.engagement.id===plan.destination.sourceEngagementId),creator=plan.creator.userId;
  const index=plan.packages.indexOf(source),sourceRecords=plan.records.filter(row=>row.path.startsWith(`/engagements/${index}/`)),recordMappings=[],ids=new Map(),allocated=new Set([destination.engagementId]);
  const originalIds=new Set([...plan.records.map(row=>row.id),...(source.engagement.deliverables||[]).map(row=>row.id),...(source.engagement.amendments||[]).map(row=>row.id),...(source.entities.monitoringObligations||[]).flatMap(row=>(row.occurrences||[]).map(item=>item.id)),...(source.entities.missions||[]).flatMap(row=>(row.monitoringPoints||[]).map(item=>item.id))]);
  const add=(kind,sourceId,{historical=false,destinationId}={})=>{
    const key=`${kind}:${sourceId}`;if(recordMappings.some(row=>`${row.kind}:${row.sourceId}`===key))return;
    if(!historical&&destinationId===undefined){destinationId=newId();if(!uuidPattern.test(destinationId||"")||allocated.has(destinationId)||originalIds.has(destinationId))fail("Successor record allocation must produce distinct new UUIDs.");allocated.add(destinationId);}
    if(!historical){if(ids.has(sourceId)&&ids.get(sourceId)!==destinationId)fail("The archive reuses an ambiguous nested record identity.");ids.set(sourceId,destinationId);}
    recordMappings.push({kind,sourceId,destinationId:historical?null:destinationId,disposition:historical?"historical_only":"working_candidate"});
  };
  for(const row of sourceRecords)add(row.kind,row.id,{historical:archivedKinds.has(row.kind),...(row.kind==="engagement"?{destinationId:destination.engagementId}:{})});
  for(const[kind,rows]of [["deliverables",source.engagement.deliverables],["amendments",source.engagement.amendments],["occurrences",source.entities.monitoringObligations?.flatMap(row=>row.occurrences||[])],["monitoringPoints",source.entities.missions?.flatMap(row=>row.monitoringPoints||[])]])for(const row of rows||[])add(kind,row.id);
  const sourceMap=new Map(plan.sourceMappings.map(row=>[row.versionId,row.destinationVersionId]));
  const mappedSource=value=>{if(!sourceMap.has(value))fail("Every current source reference must retain its explicit exact-byte destination mapping.");return sourceMap.get(value);};
  const mappedId=value=>{if(!ids.has(value))fail("Every working relationship must identify an explicitly mapped original record.");return ids.get(value);};
  const remap=(value,key="")=>{
    if(value===null||value===undefined)return value;
    if(typeof value==="string"){if(sourceKeys.has(key))return value?mappedSource(value):value;if(recordKeys.has(key))return value?mappedId(value):value;return value;}
    if(Array.isArray(value)){if(sourceLists.has(key))return value.map(mappedSource);if(recordLists.has(key))return value.map(mappedId);return value.map(item=>remap(item));}
    if(typeof value!=="object")return value;
    return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,["definition","catalogDefinition","sources","restricted","originBaselineRef","successor","origin"].includes(name)?clone(item):name==="id"&&ids.has(item)?mappedId(item):remap(item,name)]));
  };
  const roles={preparer:[creator],reviewer:[creator],approver:[creator],client:source.engagement.clientAcceptanceRequired?[creator]:[]};
  const mandate=normalizeMandate({...remap(source.engagement),roles});
  const successor={format:"esia-engagement-successor-origin",schemaVersion:1,archiveSha256:expectedSha256,archiveSize:bytes.byteLength,engagementId:source.engagement.id,projectId:plan.archive.projectId,accountId:plan.archive.accountId,createdBy:creator,createdAt:at,recordMappings,
    sourceMappings:plan.sourceMappings.map(row=>({sourceVersionId:row.versionId,destinationVersionId:row.destinationVersionId,sha256:row.sha256,size:row.size})),
    policyMappings:plan.policyMappings.map(({frameworkId,edition,sourcePackSha256,destinationSourcePackSha256,sourceSha256s,...rest})=>({frameworkId,edition,sourcePackSha256,destinationSourcePackSha256,sourceSha256s,...(rest.legacyReview?{legacyReview:clone(rest.legacyReview)}:{})}))};
  const core={id:destination.engagementId,projectId:destination.project.id,accountId:destination.project.accountId,revision:1,contentRevision:1,status:"draft",createdAt:at,updatedAt:at,createdBy:creator,updatedBy:creator,workingBaselineId:null,latestBaselineId:null,mandateHistory:[],...mandate,executionAuthority:{mode:"authenticated_user",issuer:plan.creator.issuer},successor};
  const importedProvenance=old=>normalizeProvenance({kind:"human",method:`Imported unverified working candidate; original ${old?.kind||"declared"} contribution and attribution remain in archive ${expectedSha256}.`},creator,at);
  const entities=Object.fromEntries(engagementEntityNames.map(kind=>[kind,[]]));
  for(const kind of engagementEntityNames){
    if(archivedKinds.has(kind))continue;
    for(const original of source.entities[kind]||[]){
      const {history,createdAt,updatedAt,createdBy,updatedBy,revision,origin,...fields}=original,row=remap(fields);
      for(const key of ["reviewedBy","reviewedAt","reviewStatement","reviewDecision","reviewDurationMinutes","confirmedBy","confirmedAt","confirmationStatement","closedBy","closedAt","supersededBy","supersededAt","supersededByActor","supersededStatement"])delete row[key];
      if(row.provenance)row.provenance=importedProvenance(original.provenance);
      if(kind==="requirements"){
        if(row.frameworkId==="project")row.edition=mappedSource(original.sourceVersionId);
        if(["detailed","diagnostic"].includes(row.checkSet)&&!row.definition.sourcePackSha256){const policy=plan.policyMappings.find(item=>item.frameworkId===row.frameworkId&&item.edition===row.edition&&item.requiresMigration);if(!policy?.legacyReview)fail("An unpinned policy candidate needs its exact archive-bound operator review.");row.definition.sourcePackSha256=policy.destinationSourcePackSha256;}
      }
      if(kind==="assertions"){delete row.extraction;delete row.fieldCapture;row.reviewStatus="suggested";row.classification="manual";row.provenance=importedProvenance(original.provenance);}
      if(kind==="findings"){row.status="draft";if(row.contradictionDispositions)row.contradictionDispositions=row.contradictionDispositions.map(item=>({...item,disposition:"unresolved"}));}
      if(kind==="actions"){row.status="open";row.approvalStatus="draft";row.closureAssertionIds=[];row.closureNote="";row.closureAttestation="";for(const key of actionReviewerFields)delete row[key];}
      if(kind==='bibliography'){row.clientVisible=false;row.statement=`Imported edition-specific bibliography candidate; confirm its use and client suitability in this engagement. Earlier review remains in archive ${expectedSha256}.`;}
      if(kind==='externalReferences'){row.status='registered';for(const key of ['linkedOriginal','linkedBy','linkedAt','linkStatement'])delete row[key];row.registrationStatement=`Imported unverified external document metadata candidate; review its declared location and metadata. The original registration and any retained original link remain in archive ${expectedSha256}.`;}
      if(kind==="obligations")row.status="candidate";
      if(kind==="mappings"){row.reviewStatus="draft";delete row.reviewedBy;delete row.reviewedAt;}
      if(kind==="programs"){
        const baseline=source.baselines.find(item=>item.id===original.baselineId&&!item.scope);
        row.baselineId="";row.sourceBaselineSha256="";row.reviewer=creator;
        row.baselineActionIds=original.baselineActionIds?original.baselineActionIds.map(mappedId):(baseline?.actions||[]).map(action=>mappedId(action.id));
        row.originBaselineRef=original.originBaselineRef?clone(original.originBaselineRef):baseline?{archiveSha256:expectedSha256,engagementId:source.engagement.id,baselineId:baseline.id,baselineSha256:baseline.sha256}:undefined;
        if(!row.originBaselineRef)fail("Every imported monitoring program must retain its exact historical DD baseline anchor.");
      }
      if(kind==="cycles"){row.status="draft";row.contentRevision=1;row.baselineId="";row.reviewer=creator;row.decisions="Imported reporting-period candidate; all source evidence and conclusions require fresh review.";}
      if(kind==="monitoringObligations"){
        row.status="open";row.decisionHistory=[];row.lastVerificationId="";
        if(row.occurrences){row.occurrences=row.occurrences.map((item,index)=>{delete item.resolvedBy;delete item.resolvedAt;return {...item,status:"open",lastVerificationId:"",reviewStatus:"draft",origin:{archiveSha256:expectedSha256,engagementId:source.engagement.id,kind:"occurrences",recordId:original.occurrences[index].id},triggerStatement:"Imported schedule or trigger candidate; verify the retained original evidence before a new outcome decision."};});row.dueDate=[...row.occurrences].sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0]?.dueDate||row.dueDate;}
      }
      if(kind==="submissions"){row.completeness="pending";row.reviewNote="Imported submission; exact originals await current human completeness review.";}
      if(kind==="requests"){row.status="draft";row.reviewNote="Imported information request; response and closure need current review.";}
      if(kind==="measurements"){row.dataQuality="uncertain";row.provenance=importedProvenance(original.provenance);}
      if(kind==="missions"){row.status="prepare";row.team=[creator];row.reviewStatement="";row.report=`Imported mission record for fresh reconciliation. ${row.report||""}`.slice(0,30000);}
      if(kind==="events"){
        row.status="received";row.lastVerificationId="";row.closureStatement="";
        const reference=monitoringCaseOriginReference(original,{archiveSha256:expectedSha256,engagementId:source.engagement.id});
        if(reference){delete row.restricted;delete row.restrictedSha256;row.restrictedOrigin=reference;row.restrictedAvailable=true;row.restrictedProtection=successorMonitoringCaseProtection(original,{pack:source,project:plan.project,sourceMappings:successor.sourceMappings,recordMappings});}
      }
      if(kind==="verifications"){row.decision="pending";row.implementation="inconclusive";row.effectiveness="inconclusive";row.independence="self_reported";row.statement="Imported verification candidate. Review the retained source observations, implementation and effectiveness before recording a new professional decision.";row.reviewStatement="";}
      entities[kind].push({...row,id:mappedId(original.id),revision:1,history:[],createdAt:at,updatedAt:at,createdBy:creator,updatedBy:creator,origin:{archiveSha256:expectedSha256,engagementId:source.engagement.id,kind,recordId:original.id}});
    }
  }
  const audit={id:newId(),engagementId:core.id,sequence:1,revision:1,contentRevision:1,actorId:creator,command:"construct-successor",at,changedIds:[core.id],previousSha256:null,authentication:clone(plan.creator)};
  if(!uuidPattern.test(audit.id)||allocated.has(audit.id)||originalIds.has(audit.id))fail("The successor audit requires a distinct new UUID.");
  const pack={format:"esia-engagement-package",schemaVersion:1,engagement:core,entities,baselines:[],audit:[audit]};
  return {package:pack,archive:{...plan.archive,sha256:hash(plan.bytes)},originArchiveDescriptors:originArchiveContext?originArchiveContext.descriptors():[],sourceVersionIds:[...new Set(plan.sourceMappings.map(row=>row.destinationVersionId))].sort()};
}
