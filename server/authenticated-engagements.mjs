// Foreground authenticated adapter for the existing engagement domain. Immutable
// objects hold the package; conditional metadata transactions hold its head and
// authority. A scratch database evaluates commands and is never durable storage.
import {createHash} from "node:crypto";
import {createAuthenticatedClientTemplateOperations} from "./authenticated-client-templates.mjs";
import {isDeepStrictEqual} from "node:util";
import {assertCollaborationResource} from "@categori/workspace-contracts";
import {evaluate} from "./engagement-engine.mjs";
import {analyze} from "./engagement-analysis.mjs";
import {applyEngagementSourceMetadata,appendEngagementSourceMetadata} from "./engagement-source-metadata.mjs";
import {projectSourceProjection,sourceVersionIdsForInput,loadEngagementOriginals,createEngagementSourceCache} from "./engagement-sources.mjs";
import {createEngagementPolicyTransfer} from "./engagement-policy-transfer.mjs";
import {createAuthenticatedFieldOperations} from "./authenticated-field-operations.mjs";
import {createAuthenticatedSuccessorOperations} from "./authenticated-successor-operations.mjs";
import {createAuthenticatedCaseOperations} from './authenticated-case-operations.mjs';
import {collectEngagementCaseProtection} from './engagement-case-protection.mjs';
import {resolveMonitoringCaseOrigin} from './engagement-case-origins.mjs';
import {createEngagementOriginArchiveContext} from './engagement-origin-archives.mjs';
import {registerEngagementRetainedSourceProof,advanceEngagementRetainedSourceProof} from './engagement-retained-source-proof.mjs';
import {engagementCaseAccessKey,engagementCaseSourceKey,validateEngagementCaseSources,assertEngagementCaseAccess} from './engagement-case-access.mjs';
import {projectMonitoringDisclosure,monitoringProtectionClosure,isProtectedMonitoringAssertion,monitoringCaseReferences} from '../src/lib/monitoring-protection.js';
import {validateEngagementOriginManifests,loadEngagementOriginArchives,createEngagementOriginCache} from "./engagement-origin-storage.mjs";
import {buildDocumentPreview,buildDocumentPassagePreview,normalizeDocumentPassageRequest} from "./document-preview.mjs";
import {compareEngagementDocuments,prepareEngagementDocumentRelation,documentComparisonLimits} from "./document-relations.mjs";
import {createEngagementJsonTransfer,engagementJsonTransferPin} from "./engagement-json-transfer.mjs";
import {createEngagementLibrary,engagementLibraryEntitlementKey,engagementLibraryUse} from "./engagement-library.mjs";
import {stableJson,uuidPattern,monitoringAttention,validDate} from "../src/lib/engagement-domain.js";

const hash=value=>createHash("sha256").update(value).digest("hex");
const roles=["preparer","reviewer","approver","client"];
const requestUuid=value=>{const h=hash(value);return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-${((parseInt(h[16],16)&3)|8).toString(16)}${h.slice(17,20)}-${h.slice(20,32)}`;};
const authOf=auth=>({mode:"authenticated_user",userId:auth.userId,issuer:auth.principal.issuer,subject:auth.principal.subject});
function commandResponsibility(command,view){
  if(command?.type==="update-engagement")return {action:"edit",roles:Object.hasOwn(command.changes||{},"devicePolicy")?["approver"]:["preparer","approver"]};
  const reviewed=command?.type==="finding-review"||command?.type==="mapping-save"||command?.type==="action-save"&&command.status==="closed"||
    command?.type==="verification-save"&&["accepted","rejected","reopen"].includes(command.decision)||
    command?.type==="measurement-save"&&command.dataQuality==="verified"||
    command?.type==="submission-save"&&(command.completeness||"pending")!=="pending"||
    ["request-save","mission-save"].includes(command?.type)&&command.status==="closed";
  if(reviewed)return {action:"review",roles:["reviewer"]};
  if(command?.type==="monitoring-obligation-decision"){
    const previous=view?.monitoringObligations?.find(row=>row.id===command.obligationId);
    if(["waive","extend"].includes(command.decision))return {action:"review",roles:["approver"]};
    if(previous?.dueDate&&command.dueDate>previous.dueDate)return {action:"edit",roles:["preparer","reviewer"],additionalRoles:[["approver"]]};
  }
  if(["attest","cycle-attest"].includes(command?.type)){const role={assessor:"preparer",technical:"reviewer",client_acceptance:"client"}[command.kind];return {action:role==="preparer"?"edit":"review",roles:role?[role]:[]};}
  if(["transition","cycle-transition"].includes(command?.type)){const role={ready:"preparer",under_review:"reviewer",reviewed:"reviewer",approved:"approver",published:"approver",superseded:"approver"}[command.status];return {action:role==="preparer"?"edit":"review",roles:role?[role]:[]};}
  return {action:"edit",roles:["preparer","reviewer"]};
}

export function createAuthenticatedEngagementOperations({objects,assistant,clientTemplateNativeFactory,clientTemplateAssistant,policyOriginals=[],readPolicyOriginal,readPolicyOriginalRange,resolvePolicyOriginal}={}){
  if(!objects||typeof objects.read!=="function"||typeof objects.write!=="function")throw Error("Authenticated engagement execution requires immutable object storage.");
  const sourceCache=createEngagementSourceCache(),originCache=createEngagementOriginCache();
  return deps=>{
    const {resourceAuthority,authenticate,resourceAccess,artifactAccess,caseSourceAuthority,verifyCaseParticipant,verifyEngagementReviewer,engagementSourceAccess,assertEngagementRole,assertEngagementProfile,entitlement,get,commit,record,store,storage,iso,instant,fail,id,requirementLibrary,projectProjection}=deps;
    const responsePins=new WeakMap(),responseGuards=new WeakMap(),legacyLibraryUses=new Map(),legacyFieldPolicies=new Map(),issuedCustodyClosures=new Map(),historyCustodyClosures=new Map();
    const requireBody=(value,allowed)=>{if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail(400,"Use the exact authenticated engagement request fields.");};
    const domain=work=>{try{return work();}catch(error){if(Number.isInteger(error.status))fail(error.status,error.message);throw error;}};
    const asyncDomain=async work=>{try{return await work();}catch(error){if(Number.isInteger(error.status))fail(error.status,error.message);throw error;}};
    function mergeAuthority(destination,source){
      for(const [key,entry]of source.reads){const prior=destination.reads.get(key);if(prior&&!isDeepStrictEqual(prior.row,entry.row))fail(409,"Invitation authority changed while the engagement was being prepared.");if(!prior)destination.reads.set(key,structuredClone(entry));}
      for(const [key,principal]of source.providerPrincipals)destination.providerPrincipals.set(key,principal);
      for(const [key,until]of source.authorityDeadlines)destination.authorityDeadlines.set(key,Math.min(destination.authorityDeadlines.get(key)??Infinity,until));
      const principal=source.principal,key=`engagement-session:${principal.issuer}:${principal.subject}`;destination.authorityDeadlines.set(key,Math.min(destination.authorityDeadlines.get(key)??Infinity,principal.expiresAt));
    }
    async function sourceProjection(auth,target){
      const projectRow=await get(auth.ctx,`PROJECT#${id(target.project_id)}`,"PROFILE");
      if(projectRow?.value.status!=="active"||projectRow.value.account_id!==target.account_id||projectRow.value.workspace_id!==target.workspace_id)fail(404,"The engagement's source project is unavailable.");
      const documentRows=await engagementSourceAccess(auth,{projectId:target.project_id,workspaceId:target.workspace_id,accountId:target.account_id,artifactIds:target.source_artifact_ids},{retainedDescriptors:true});
      const projected=domain(()=>projectSourceProjection({projectRow,documentRows,accountStorage:storage,resourceAuthority}));
      const caseKey=engagementCaseSourceKey(target.project_id),caseSourceRegistry=await get(auth.ctx,caseKey.pk,caseKey.sk);if(caseSourceRegistry)validateEngagementCaseSources(caseSourceRegistry,{scope:{accountId:target.account_id,projectId:target.project_id,workspaceId:target.workspace_id}});
      return {...projected,documentRows,caseSourceRegistry,sourceSha256:hash(stableJson([...projected.sources])),sourceViewSha256:hash(stableJson({project:projected.project,caseSourceRegistry:caseSourceRegistry??null})),projectRow};
    }
    const libraryScope=state=>({engagementId:state.target.value.engagement_id,projectId:state.target.value.project_id,workspaceId:state.target.value.workspace_id,accountId:state.target.value.account_id,userId:state.auth.userId});
    function libraryFor(state){return createEngagementLibrary({library:requirementLibrary,originals:policyOriginals,readOriginal:readPolicyOriginal,resolveOriginal:resolvePolicyOriginal,now:()=>instant().getTime(),authorize:async request=>{
      if(!Object.entries(libraryScope(state)).every(([key,value])=>request[key]===value))fail(403,"The library request changed its verified engagement scope.");
      const fresh=await metadata(state.auth.principal,state.target.value.engagement_id,{skipLibrary:true});sameHead(state,fresh);
      const key=engagementLibraryEntitlementKey(request),row=await get(fresh.auth.ctx,key.pk,key.sk);
      if(row?.value.expiresAt)fresh.auth.ctx.authorityDeadlines.set(`engagement-library:${key.pk}:${key.sk}`,Date.parse(row.value.expiresAt));
      mergeAuthority(state.auth.ctx,fresh.auth.ctx);return row;
    }});}
    async function metadata(principal,engagementId,{action="view",requiredRoles=[],skipLibrary=false,maximumSnapshotBytes}={}){
      const auth=await authenticate(principal,{enroll:false}),scoped=await resourceAccess(auth,"engagement",id(engagementId),action),target=scoped.target;
      assertEngagementProfile(target);if(requiredRoles.length)await assertEngagementRole(auth,target,requiredRoles);if(action!=="view")await entitlement(auth,target.value.workspace_id,"storage_writes");
      const head=await get(auth.ctx,target.pk,"HEAD");if(!head?.value.snapshot||head.value.engagement_id!==engagementId)fail(404,"The authenticated engagement has no retained assessment head.");
      const snapshot=head.value.snapshot,expectedKey=`tenants/${target.value.account_id}/projects/${target.value.project_id}/engagements/${engagementId}/revisions/${head.value.request_id}.json`;
      if(maximumSnapshotBytes!==undefined&&snapshot.sizeBytes>maximumSnapshotBytes)fail(413,'This saved assessment exceeds the remaining attention-view byte limit.');
      if(!uuidPattern.test(head.value.request_id||"")||snapshot.kind!=="snapshot"||snapshot.key!==expectedKey||snapshot.bucket!==storage.forAccount(target.value.account_id).bucket)fail(409,"The engagement head is outside its exact immutable storage scope.");
      const state={auth,scoped,target,head,...await sourceProjection(auth,target.value)};
      state.originManifests=validateEngagementOriginManifests(head.value.origin_archives,{scope:libraryScope(state),storage,project:state.project,sources:state.sources});
      await successorOperations.authorizeOrigins(state,state.originManifests);
      if(!skipLibrary){
        let uses=head.value.library_uses;
        if(uses===undefined){
          uses=legacyLibraryUses.get(head.value.snapshot.sha256);
          if(!uses){const retained=await objects.read(head.value.snapshot);let envelope;try{envelope=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(retained.bytes));}catch{fail(409,"The retained engagement is not valid assessment data.");}uses=domain(()=>engagementLibraryUse(envelope.packages));if(legacyLibraryUses.size>=16)legacyLibraryUses.delete(legacyLibraryUses.keys().next().value);legacyLibraryUses.set(head.value.snapshot.sha256,uses);}
        }
        state.libraryUses=uses;await asyncDomain(()=>libraryFor(state).authorizeUseClosure(libraryScope(state),uses));
      }
      return state;
    }
    function sameHead(before,after){
      if(before.target.revision!==after.target.revision||!isDeepStrictEqual(before.target.value,after.target.value)||before.head.revision!==after.head.revision||!isDeepStrictEqual(before.head.value,after.head.value)||before.sourceSha256!==after.sourceSha256||before.sourceViewSha256!==after.sourceViewSha256||!isDeepStrictEqual(before.caseSourceRegistry??null,after.caseSourceRegistry??null))fail(409,"Engagement configuration, sources, privacy permissions or assessment changed. Reopen before continuing.");
    }
    async function load(principal,engagementId,options={}){
      const state=await metadata(principal,engagementId,options),retained=await objects.read(state.head.value.snapshot);let envelope;
      try{envelope=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(retained.bytes));}catch{fail(409,"The retained engagement is not valid UTF-8 assessment data.");}
      if(envelope?.format!=="esia-authenticated-engagement-state"||envelope.schemaVersion!==1||!Array.isArray(envelope.packages)||envelope.packages.length!==1||envelope.packages[0].engagement.id!==engagementId||envelope.project?.id!==state.project.id||envelope.project.accountId!==state.project.accountId||envelope.sourceSha256!==state.sourceSha256)fail(409,"The retained assessment does not match its exact engagement and source authority.");
      const core=envelope.packages[0].engagement;
      if(stableJson(envelope.originArchives||[])!==stableJson(state.originManifests))fail(409,"The retained origin ancestry differs from its exact authorized engagement head.");
      state.originArchives=options.attentionOnly?new Map():await loadEngagementOriginArchives({manifests:state.originManifests,read:target=>objects.read(target),cache:originCache});
      if(Boolean(core.successor)!==Boolean(state.originManifests.length))fail(409,"A successor must retain its complete exact archive ancestry.");
      if(Object.hasOwn(state.head.value,"field_device_policy")&&stableJson(core.devicePolicy??null)!==stableJson(state.head.value.field_device_policy))fail(409,"The retained field policy differs from its exact engagement head.");
      if(stableJson(domain(()=>engagementLibraryUse(envelope.packages)))!==stableJson(state.libraryUses))fail(409,"The retained library source closure differs from its exact engagement head.");
      if(core.executionAuthority?.mode!=="authenticated_user"||core.executionAuthority.issuer!==principal.issuer)fail(409,"Historical local assessments need an explicit authenticated successor.");
      for(const role of roles)if(state.target.value.professional_roles[role].some(user=>!core.roles[role].includes(user)))fail(409,"Current professional responsibility differs from the retained mandate.");
      state.rawProject=state.project;state.sourceMetadata=envelope.sourceMetadata||[];
      state.project=domain(()=>applyEngagementSourceMetadata({project:state.rawProject,engagementId,sourceMetadata:state.sourceMetadata}));
      if(options.attentionOnly)return {...state,packages:envelope.packages,originals:new Map()};
      const selected=domain(()=>sourceVersionIdsForInput({project:state.project,packages:envelope.packages,input:options.input||{},sources:state.sources,originArchives:state.originArchives}));
      state.packages=envelope.packages;
      if(options.metadataOnly)return {...state,originals:new Map()};
      const protection=collectEngagementCaseProtection(state),privateHashes=new Set([...protection.bindings,...(state.caseSourceRegistry?.value.bindings||[])].map(row=>row.sourceSha256)),privateVersions=new Set([...state.sources].filter(([,source])=>privateHashes.has(source.sha256)).map(([versionId])=>versionId));
      if(options.custody)await assertCaseCustody(state,protection);
      const explicit=domain(()=>sourceVersionIdsForInput({project:state.project,packages:[],input:options.input||{},sources:state.sources,originArchives:state.originArchives}));for(const versionId of explicit)await authorizeSource(state,versionId);
      const requested=options.allSources?[...state.sources.keys()]:selected,readable=options.custody||options.review?requested:requested.filter(versionId=>!privateVersions.has(versionId)||explicit.includes(versionId));
      // Ciphertext detail reads need no private original bodies. Every actual
      // read still passes current case AND document permission before cache use.
      for(const versionId of readable)await authorizeSource(state,versionId);
      const originals=await asyncDomain(()=>loadEngagementOriginals({sources:state.sources,versionIds:readable,readSource:target=>objects.read(target),cache:sourceCache}));
      if(privateVersions.size&&!options.custody&&!options.review)state.retainedSourceProof=domain(()=>registerEngagementRetainedSourceProof({snapshot:{...state.head.value.snapshot,bytes:retained.bytes},project:state.project,packages:state.packages,sources:state.sources,scope:libraryScope(state),identity:{userId:state.auth.userId,issuer:principal.issuer,subject:principal.subject},registry:state.caseSourceRegistry,originArchives:state.originArchives,mutation:options.caseMutation}));
      return {...state,originals,privateVersions,caseProtection:protection,retainedSnapshot:{...state.head.value.snapshot,bytes:retained.bytes}};
    }
    async function authorizeSource(state,versionId){const source=state.sources.get(versionId),resource=state.project.resources.find(row=>row.versions.some(version=>version.id===versionId));if(!source||!resource)fail(404,'Choose an exact source in this engagement.');const checked=await artifactAccess(state.auth,resource.id,'view');if(checked.target.value.original.sha256!==source.sha256||checked.target.value.original.size_bytes!==source.sizeBytes)fail(409,'The original source changed before its authorized read.');return checked;}
    function disclosureFor(state,view,options={}){const bindings=state.caseSourceRegistry?.value.bindings||[],caseIds=new Set(bindings.filter(row=>row.engagementId===state.target.value.engagement_id).map(row=>row.caseId)),mark=records=>(records||[]).map(row=>caseIds.has(row.id)?{...row,restrictedAvailable:true}:row),marked={...view,events:mark(view.events),baselines:(view.baselines||[]).map(snapshot=>({...snapshot,events:mark(snapshot.events)}))},closure=monitoringProtectionClosure(marked);for(const binding of bindings)closure.sha256s.add(binding.sourceSha256);for(const resource of state.project.resources)for(const version of resource.versions)if(closure.sha256s.has(version.sha256))closure.versionIds.add(version.id);return projectMonitoringDisclosure(view,{...options,closure,hideSourcePins:true,includeInternalBibliography:["preparer","reviewer","approver"].some(role=>state.target.value.professional_roles[role]?.includes(state.auth.userId))});}
    function proofForExpansion(state,{project,sources,mutation}={}){return state.retainedSourceProof?domain(()=>registerEngagementRetainedSourceProof({snapshot:state.retainedSnapshot,project,packages:state.packages,sources,retainedSources:state.sources,scope:libraryScope(state),identity:{userId:state.auth.userId,issuer:state.auth.principal.issuer,subject:state.auth.principal.subject},registry:state.caseSourceRegistry,originArchives:state.originArchives,mutation})):undefined;}
    function externalReferenceHashes(records=[]){return records.flatMap(reference=>[reference,...(reference.history||[])]).flatMap(reference=>[reference.claimedSha256,reference.linkedOriginal?.sha256]).filter(value=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value));}
    async function authorizeReferenceClaims(state,hashes){
      if(!hashes.size)return;
      for(const binding of state.caseSourceRegistry?.value.bindings||[]){if(!hashes.has(binding.sourceSha256))continue;const scoped=await resourceAccess(state.auth,"engagement",binding.engagementId,"view");if(scoped.target.value.account_id!==state.project.accountId||scoped.target.value.project_id!==state.project.id||scoped.target.value.workspace_id!==state.target.value.workspace_id)fail(403,"The registered document belongs to another exact case scope.");const key=engagementCaseAccessKey(binding.engagementId),policy=await get(state.auth.ctx,key.pk,key.sk),permission=assertEngagementCaseAccess(policy,{scope:{accountId:state.project.accountId,projectId:state.project.id,workspaceId:state.target.value.workspace_id,engagementId:binding.engagementId},caseId:binding.caseId,userId:state.auth.userId,groups:binding.groups,action:"read",now:instant().getTime()});state.auth.ctx.authorityDeadlines.set(`case-reference:${binding.engagementId}:${binding.caseId}:${state.auth.userId}`,Date.parse(permission.expiresAt));}
    }
    async function assertCustodyBindings(state,bindings){const unique=new Map(bindings.map(row=>[`${row.engagementId}:${row.caseId}`,row]));for(const {engagementId,caseId}of unique.values()){const access=await resourceAccess(state.auth,'engagement',engagementId,'view');if(access.target.value.project_id!==state.project.id||access.target.value.account_id!==state.project.accountId||access.target.value.workspace_id!==state.target.value.workspace_id)fail(403,'The protected record belongs to another exact custody scope.');const key=engagementCaseAccessKey(engagementId),policy=await get(state.auth.ctx,key.pk,key.sk),permission=assertEngagementCaseAccess(policy,{scope:{accountId:state.project.accountId,projectId:state.project.id,workspaceId:state.target.value.workspace_id,engagementId},caseId,userId:state.auth.userId,action:'custody',now:instant().getTime()});state.auth.ctx.authorityDeadlines.set(`case-custody:${engagementId}:${caseId}`,Date.parse(permission.expiresAt));}}
    async function assertCaseCustody(state,protection=state.caseProtection||collectEngagementCaseProtection(state)){const hashes=new Set([...state.sources.values()].map(row=>row.sha256));for(const pack of state.packages||[])for(const value of [pack.entities,...(pack.baselines||[])])for(const hash of externalReferenceHashes(value?.externalReferences))hashes.add(hash);await assertCustodyBindings(state,[...protection.caseIds.map(caseId=>({caseId,engagementId:state.target.value.engagement_id})),...(state.caseSourceRegistry?.value.bindings||[]).filter(row=>hashes.has(row.sourceSha256))]);}
    function retainClosure(cache,key,value){if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(key,structuredClone(value));}
    async function authorizeHistory(state){const key=state.head.value.snapshot.sha256;let protection=historyCustodyClosures.get(key);if(!protection){const loaded=await load(state.auth.principal,state.target.value.engagement_id,{metadataOnly:true});sameHead(state,loaded);protection=collectEngagementCaseProtection(loaded);retainClosure(historyCustodyClosures,key,{caseIds:protection.caseIds,bindings:[]});mergeAuthority(state.auth.ctx,loaded.auth.ctx);}await assertCaseCustody(state,protection);}
    async function authorizeIssued(state,output){if(state.head.value.case_protection?.caseCount===0&&!state.caseSourceRegistry?.value.bindings.length)return;const key=`${state.head.value.snapshot.sha256}:${output.baselineId}`;let closure=issuedCustodyClosures.get(key);if(!closure){const loaded=await load(state.auth.principal,state.target.value.engagement_id,{attentionOnly:true});sameHead(state,loaded);const baseline=loaded.packages[0].baselines.find(row=>row.id===output.baselineId);if(!baseline)fail(409,'The issued file has no exact retained source baseline.');closure={hashes:[...baseline.sourceVersions.map(row=>row.sha256),...externalReferenceHashes(baseline.externalReferences)],caseIds:[...monitoringProtectionClosure(baseline).eventIds]};retainClosure(issuedCustodyClosures,key,closure);mergeAuthority(state.auth.ctx,loaded.auth.ctx);}const hashes=new Set(closure.hashes);await assertCustodyBindings(state,[...closure.caseIds.map(caseId=>({caseId,engagementId:state.target.value.engagement_id})),...(state.caseSourceRegistry?.value.bindings||[]).filter(row=>hashes.has(row.sourceSha256))]);}
    async function authorityView(state,result){
      const assigned=[];for(const role of roles){try{await assertEngagementRole(state.auth,state.target,[role]);assigned.push(role);}catch(error){if(error.statusCode!==403)throw error;}}
      return {...result,serverAuthority:{userId:state.auth.userId,issuer:state.auth.principal.issuer,subject:state.auth.principal.subject,accountId:state.target.value.account_id,projectId:state.project.id,projectName:state.project.name,roles:assigned,permissions:state.scoped.access.allowed_actions,configurationRevision:state.target.revision,headRevision:state.head.revision,headSha256:state.head.value.snapshot.sha256}};
    }
    async function pinFor(state){const {serverAuthority}=await authorityView(state,{});return engagementJsonTransferPin({engagementId:state.target.value.engagement_id,serverAuthority,sourceSha256:state.sourceSha256,sourceViewSha256:state.sourceViewSha256});}
    async function response(state,result,guard){if(result&&typeof result==="object"){responsePins.set(result,await pinFor(state));if(guard)responseGuards.set(result,guard);}return result;}
    function compoundResponse(result){
      const pin=responsePins.get(result.engagement),projectPin=result.project&&responsePins.get(result.project);
      if(!pin||projectPin&&stableJson(projectPin)!==stableJson(pin))fail(409,"The engagement changed while its source register was opening. Refresh the saved record.");
      responsePins.set(result,pin);return result;
    }
    const jsonTransfer=createEngagementJsonTransfer({now:()=>instant().getTime(),authorize:async(principal,engagementId)=>{const state=await metadata(principal,engagementId);return {...state,pin:await pinFor(state)};},finish:state=>commit(state.auth.ctx),project:(principal,engagementId,projection)=>({engagement:getEngagement,project:engagementProject,exchange:engagementExchange}[projection])(principal,engagementId)});
    async function engagementJsonTransfer(principal,engagementId,projection,body){return body===undefined?jsonTransfer.manifest(principal,engagementId,projection):jsonTransfer.range(principal,engagementId,projection,body);}
    async function engagementJsonResponse(principal,engagementId,result,projection="response"){const pin=responsePins.get(result);if(!pin)fail(409,"The completed response has no exact retained engagement authority. Refresh the saved record.");return jsonTransfer.prepare(principal,engagementId,projection,result,pin,responseGuards.get(result));}
    function assess(state,input,actor=state.auth,execution){return domain(()=>evaluate({project:state.project,packages:state.packages,originals:state.originals,originArchives:state.originArchives||new Map(),retainedSourceProof:state.retainedSourceProof,actorId:actor.userId,input,authority:authOf(actor),...(execution?{execution}:{})}));}
    function analysis(state,input,execution,requirementContext){return asyncDomain(()=>analyze({project:state.project,packages:state.packages,originals:state.originals,originArchives:state.originArchives||new Map(),retainedSourceProof:state.retainedSourceProof,actorId:state.auth.userId,authority:authOf(state.auth),input,...(execution?{execution}:{}),...(assistant?{assistant}:{}),...(requirementContext?{requirementContext}:{})}));}
    async function getEngagement(principal,engagementId){
      const state=await load(principal,engagementId),result=assess(state,{operation:"get",engagementId}).result,current=await metadata(principal,engagementId);sameHead(state,current);
      mergeAuthority(current.auth.ctx,state.auth.ctx);const disclosed=disclosureFor(state,result),view=await authorityView(current,{...disclosed,disclosure:{format:'esia-native-engagement-disclosure',schemaVersion:1}});await response(current,view);await commit(current.auth.ctx);return view;
    }
    async function engagementProject(principal,engagementId){
      const state=await load(principal,engagementId),current=await metadata(principal,engagementId);sameHead(state,current);const result=disclosureFor(state,assess(state,{operation:'get',engagementId}).result,{project:state.project}).project;mergeAuthority(current.auth.ctx,state.auth.ctx);await response(current,result);await commit(current.auth.ctx);return result;
    }
    async function intakeAuthority(principal,engagementId){
      const state=await metadata(principal,engagementId,{action:"edit",requiredRoles:["preparer","reviewer"]});
      const projectAccess=await resourceAccess(state.auth,"project",state.target.value.project_id,"edit"),project=projectAccess.target;
      if(project.revision!==state.projectRow.revision||!isDeepStrictEqual(project.value,state.projectRow.value))fail(409,"The project changed while opening document intake.");
      return {...state,projectAccess,uploadProject:projectProjection(project,projectAccess.access)};
    }
    async function engagementIntakeContext(principal,engagementId){
      const state=await intakeAuthority(principal,engagementId);await commit(state.auth.ctx);
      return {engagementId,projectId:state.project.id,accountId:state.project.accountId,projectConfigurationRevision:state.projectRow.revision,maximumFiles:10,maximumFileBytes:25*1024*1024};
    }
    async function engagementAttachSources(principal,engagementId,body){
      requireBody(body,["request_id","expectedRevision","artifact_ids"]);
      if(!Array.isArray(body.artifact_ids)||!body.artifact_ids.length||body.artifact_ids.length>10||new Set(body.artifact_ids).size!==body.artifact_ids.length)fail(400,"Select one to ten exact verified project documents.");
      body.artifact_ids.forEach(value=>id(value));
      const initial=await intakeAuthority(principal,engagementId),request=await reservation(principal,body.request_id,{engagementId,operation:"attach-sources",expectedRevision:body.expectedRevision,artifact_ids:body.artifact_ids});
      if(request.value.status==="promoted")return compoundResponse({project:await engagementProject(principal,engagementId),engagement:await getEngagement(principal,engagementId)});
      const state=await load(principal,engagementId,{action:"edit",requiredRoles:["preparer","reviewer"]});sameHead(initial,state);
      if(body.artifact_ids.some(value=>state.target.value.source_artifact_ids.includes(value)))fail(409,"A selected document is already part of this engagement. Refresh its source register.");
      const artifactIds=[...state.target.value.source_artifact_ids,...body.artifact_ids],expanded=await sourceProjection(state.auth,{...state.target.value,source_artifact_ids:artifactIds});
      const newVersions=expanded.project.resources.filter(resource=>body.artifact_ids.includes(resource.id)).flatMap(resource=>resource.versions.map(version=>version.id));
      const project=domain(()=>applyEngagementSourceMetadata({project:expanded.project,engagementId,sourceMetadata:state.sourceMetadata}));
      for(const versionId of newVersions)await authorizeSource({...state,...expanded,project},versionId);
      const newOriginals=await asyncDomain(()=>loadEngagementOriginals({sources:expanded.sources,versionIds:newVersions,readSource:target=>objects.read(target),cache:sourceCache}));
      const retainedSourceProof=state.retainedSourceProof?domain(()=>registerEngagementRetainedSourceProof({snapshot:state.retainedSnapshot,project,packages:state.packages,sources:expanded.sources,retainedSources:state.sources,scope:libraryScope(state),identity:{userId:state.auth.userId,issuer:principal.issuer,subject:principal.subject},registry:state.caseSourceRegistry,originArchives:state.originArchives})):undefined;
      const evaluated=domain(()=>evaluate({project,packages:state.packages,originals:new Map([...state.originals,...newOriginals]),retainedSourceProof,originArchives:state.originArchives||new Map(),actorId:state.auth.userId,authority:authOf(state.auth),execution:{requestId:body.request_id,at:request.value.at},input:{operation:"command",engagementId,expectedRevision:body.expectedRevision,command:{type:"register-sources",versionIds:newVersions}},commandOptions:{sourceRegistration:true}}));
      const prepared=await preparedObject({...state,...expanded,project},evaluated,request),current=await intakeAuthority(principal,engagementId);sameHead(state,current);
      const freshExpanded=await sourceProjection(current.auth,{...current.target.value,source_artifact_ids:artifactIds});
      if(expanded.sourceSha256!==freshExpanded.sourceSha256||expanded.sourceViewSha256!==freshExpanded.sourceViewSha256)fail(409,"A selected source changed before its engagement registration was saved.");
      const profile=record(current.target.pk,"PROFILE",{...current.target.value,source_artifact_ids:artifactIds},current.target.revision+1);assertEngagementProfile(profile);
      mergeAuthority(current.auth.ctx,state.auth.ctx);await commit(current.auth.ctx,[profile,...await promotedWrites(current.auth,current,prepared,request)]);
      return compoundResponse({project:await engagementProject(principal,engagementId),engagement:await getEngagement(principal,engagementId)});
    }
    async function reservation(principal,requestId,descriptor){
      if(!uuidPattern.test(requestId||""))fail(400,"Use an exact request UUID for an explicit engagement operation.");
      const auth=await authenticate(principal,{enroll:false}),pk=`ENGAGEMENT_REQUEST#${requestId}`,existing=await get(auth.ctx,pk,"PROFILE"),inputSha256=hash(stableJson(descriptor));
      if(existing){if(existing.value.actor_id!==auth.userId||existing.value.issuer!==principal.issuer||existing.value.subject!==principal.subject||existing.value.input_sha256!==inputSha256)fail(409,"That request UUID already identifies different work or another identity.");if(existing.value.status==="superseded")fail(409,"A reviewed replacement superseded this pending save. Check its saved record.");if(existing.value.status!=="promoted"&&Date.parse(existing.value.expires_at)<=instant().getTime())fail(409,"This pending operation expired. Reopen and start a new explicit operation.");await commit(auth.ctx);return existing;}
      const row=record(pk,"PROFILE",{object_type:"engagement_operation_request",request_id:requestId,status:"pending",actor_id:auth.userId,issuer:principal.issuer,subject:principal.subject,input_sha256:inputSha256,at:iso(),expires_at:new Date(instant().getTime()+3600000).toISOString()});await commit(auth.ctx,[row]);return row;
    }
    function describeObject(state,evaluated,request){
      const core=evaluated.packages[0].engagement,bucket=storage.forAccount(core.accountId).bucket,key=`tenants/${core.accountId}/projects/${core.projectId}/engagements/${core.id}/revisions/${request.value.request_id}.json`;
      const bytes=Buffer.from(JSON.stringify({format:"esia-authenticated-engagement-state",schemaVersion:1,requestId:request.value.request_id,sourceSha256:state.sourceSha256,sourceMetadata:state.sourceMetadata||[],...(state.originManifests?.length?{originArchives:state.originManifests}:{}),project:state.project,packages:evaluated.packages}));
      if(bytes.length>32*1024*1024)fail(413,"The engagement state exceeds its bounded 32 MiB object limit.");
      return {manifest:{kind:"snapshot",bucket,key,sha256:hash(bytes),sizeBytes:bytes.length,contentType:"application/json"},bytes,core,packages:evaluated.packages,project:state.project,originArchives:state.originArchives||new Map(),caseProtection:collectEngagementCaseProtection({project:state.project,packages:evaluated.packages,originArchives:state.originArchives||new Map()}),originManifests:state.originManifests||[],libraryUses:domain(()=>engagementLibraryUse(evaluated.packages)),issuedIds:(evaluated.packages[0].issuedRenditions||[]).map(item=>item.id)};
    }
    async function writeExactObject(manifest,bytes){
      const written=await objects.write({...manifest,bytes});
      if(written.sha256!==manifest.sha256||written.sizeBytes!==manifest.sizeBytes||written.contentType!==manifest.contentType||typeof written.versionId!=="string"||!written.versionId||written.versionId==="null")fail(409,"The immutable engagement write receipt differs from its prepared assessment.");
      return {...manifest,versionId:written.versionId};
    }
    async function preparedObject(state,evaluated,request){
      const prepared=describeObject(state,evaluated,request);return {...prepared,manifest:await writeExactObject(prepared.manifest,prepared.bytes)};
    }
    async function promotedWrites(auth,state,prepared,request){
      const actualHead=await get(auth.ctx,state.target.pk,"HEAD"),actualProfile=await get(auth.ctx,state.target.pk,"PROFILE");
      if((actualHead?.revision||0)!==(state.head?.revision||0)||state.head&&!isDeepStrictEqual(actualHead.value,state.head.value)||state.head&&(actualProfile?.revision!==state.target.revision||!isDeepStrictEqual(actualProfile.value,state.target.value))||!state.head&&actualProfile)fail(409,"The engagement head or configuration changed before promotion.");
      const currentRequest=await get(auth.ctx,request.pk,"PROFILE");if(!currentRequest||currentRequest.revision!==request.revision||currentRequest.value.status!=="pending")fail(409,"This operation changed while its assessment was being prepared.");
      if(state.head)await asyncDomain(()=>libraryFor({...state,auth}).authorizeUseClosure(libraryScope({...state,auth}),prepared.libraryUses||state.libraryUses||[]));
      const origins=prepared.originManifests||state.originManifests||[];
      if(origins.length)await successorOperations.authorizeOrigins({...state,auth},origins);
      const caseWrites=await caseOperations.protectionWrites({state,prepared,auth}),requestId=request.value.request_id,head=record(state.target.pk,"HEAD",{object_type:"engagement_head",engagement_id:prepared.core.id,request_id:requestId,core_revision:prepared.core.revision,issued_ids:prepared.issuedIds||state.head?.value.issued_ids||[],library_uses:prepared.libraryUses||state.libraryUses||[],...(origins.length?{origin_archives:origins}:{}),field_device_policy:prepared.core.devicePolicy??null,case_protection:{schemaVersion:1,caseCount:prepared.caseProtection.caseIds.length,protectedSources:prepared.caseProtection.bindings.length,sha256:prepared.caseProtection.sha256},snapshot:prepared.manifest},(state.head?.revision||0)+1);
      await get(auth.ctx,`ENGAGEMENT_REVISION#${requestId}`,"PROFILE");
      const revision=record(`ENGAGEMENT_REVISION#${requestId}`,"PROFILE",{object_type:"engagement_revision",engagement_id:prepared.core.id,project_id:prepared.core.projectId,account_id:prepared.core.accountId,request_id:requestId,actor_id:auth.userId,snapshot:prepared.manifest});
      return [...caseWrites,head,revision,record(request.pk,"PROFILE",{...currentRequest.value,status:"promoted",engagement_id:prepared.core.id,head_revision:head.revision,snapshot:prepared.manifest},currentRequest.revision+1)];
    }
    async function engagementCommand(principal,engagementId,body){
      requireBody(body,["request_id","expectedRevision","command"]);let responsibility=commandResponsibility(body.command);
      if(body.command?.type==='source-review-save'){
        // Practitioners with edit responsibility and independently assigned
        // reviewers with review permission can each retain their own work.
        try{await metadata(principal,engagementId,{action:'edit',requiredRoles:['preparer','reviewer']});}
        catch(error){if(error.statusCode!==403)throw error;responsibility={action:'review',roles:['reviewer']};}
      }
      if(body.command?.type==='monitoring-case-details-save'||body.command?.type==='event-save'&&['restricted','restrictedProtection','restrictedOrigin','restrictedAvailable','restrictedSha256'].some(key=>Object.hasOwn(body.command,key)))fail(403,'Use the case permissions and protected detail controls to change sensitive case fields.');
      if(!responsibility.roles.length)fail(400,"Choose an explicit supported professional review responsibility.");
      const state=await load(principal,engagementId,{...responsibility,requiredRoles:responsibility.roles,input:body.command,allSources:body.command.type==='source-review-save'&&body.command.mode==='search',review:['transition','attest','cycle-transition','cycle-attest'].includes(body.command.type)});
      const referenceSources=new Set(),referenceClaims=new Set();if(body.command.type==="external-reference-save"){
        const prior=state.packages[0].entities.externalReferences?.find(reference=>reference.id===body.command.id),records=[...(prior?[prior,...(prior.history||[])]:[]),body.command],protectedHashes=new Set([...(state.caseProtection?.bindings||[]),...(state.caseSourceRegistry?.value.bindings||[])].map(binding=>binding.sourceSha256));
        for(const reference of records){if(reference.linkedOriginal?.versionId)referenceSources.add(reference.linkedOriginal.versionId);if(protectedHashes.has(reference.claimedSha256)){referenceClaims.add(reference.claimedSha256);for(const [versionId,source]of state.sources)if(source.sha256===reference.claimedSha256)referenceSources.add(versionId);}}
        for(const versionId of referenceSources)await authorizeSource(state,versionId);
        await authorizeReferenceClaims(state,referenceClaims);
      }
      const requirementContext=body.command?.type==="requirement-add"&&["detailed","diagnostic"].includes(body.command.checkSet)?await asyncDomain(()=>libraryFor(state).context(libraryScope(state),body.command.frameworkId,body.command.checkId,{checkSet:body.command.checkSet})):undefined;
      const finalResponsibility=body.command.type==='source-review-save'?responsibility:commandResponsibility(body.command,assess(state,{operation:"get",engagementId}).result);
      if(!isDeepStrictEqual(finalResponsibility,responsibility)){
        const checked=await metadata(principal,engagementId,{action:finalResponsibility.action,requiredRoles:finalResponsibility.roles});for(const group of finalResponsibility.additionalRoles||[])await assertEngagementRole(checked.auth,checked.target,group);sameHead(state,checked);
      }
      const request=await reservation(principal,body.request_id,{engagementId,expectedRevision:body.expectedRevision,command:body.command});
      await entitlement(state.auth,state.target.value.workspace_id,"storage_writes");
      if(request.value.status==="promoted")return getEngagement(principal,engagementId);
      const consolidating=body.command.type==="action-consolidate",originalActions=consolidating&&Array.isArray(body.command.actionIds)?body.command.actionIds.map(actionId=>state.packages[0].entities.actions.find(action=>action.id===actionId)):[],assignedReviewer=body.command.reviewer||(consolidating&&originalActions.length>1&&originalActions.every(action=>action&&action.reviewer===originalActions[0]?.reviewer)?originalActions[0].reviewer:undefined);
      if(["action-save","action-consolidate"].includes(body.command.type)&&assignedReviewer){
        const previous=body.command.type==="action-save"?state.packages[0].entities.actions.find(action=>action.id===body.command.id):undefined;
        if(previous?.reviewer!==assignedReviewer){
          if(!state.target.value.professional_roles.reviewer.includes(assignedReviewer))fail(403,"Choose a reviewer with a current review assignment for this engagement.");
          if(typeof verifyEngagementReviewer!=="function")fail(503,"Current reviewer identity and assignment checks are unavailable.");
          await verifyEngagementReviewer(state,assignedReviewer);
        }
      }
      const evaluated=await analysis(state,{operation:"command",engagementId,expectedRevision:body.expectedRevision,command:body.command},{requestId:body.request_id,at:request.value.at},requirementContext),prepared=await preparedObject(state,evaluated,request),current=await metadata(principal,engagementId,{action:finalResponsibility.action,requiredRoles:finalResponsibility.roles});for(const group of finalResponsibility.additionalRoles||[])await assertEngagementRole(current.auth,current.target,group);sameHead(state,current);
      for(const versionId of referenceSources)await authorizeSource(current,versionId);
      await authorizeReferenceClaims(current,referenceClaims);
      mergeAuthority(current.auth.ctx,state.auth.ctx);await commit(current.auth.ctx,await promotedWrites(current.auth,current,prepared,request));return getEngagement(principal,engagementId);
    }
    async function createEngagement(principal,body){
      requireBody(body,["request_id","projectId","source_artifact_ids","fields"]);
      const auth=await authenticate(principal,{enroll:false}),parent=await resourceAccess(auth,"project",id(body.projectId),"manage_access"),sourceIds=body.source_artifact_ids||[];
      await entitlement(auth,parent.target.value.workspace_id,"storage_writes");
      if(!Array.isArray(sourceIds)||sourceIds.length>100||new Set(sourceIds).size!==sourceIds.length)fail(400,"Select up to 100 exact source artifacts explicitly.");
      const fields=structuredClone(body.fields);if(!fields||roles.some(role=>(fields.roles?.[role]||[]).some(user=>user!==auth.userId)))fail(403,"Initial responsibilities must name the verified creator. Invite other practitioners explicitly.");
      const targetValue={project_id:parent.target.value.project_id,account_id:parent.target.value.account_id,workspace_id:parent.target.value.workspace_id,source_artifact_ids:sourceIds},projection=await sourceProjection(auth,targetValue),state={auth,...projection,packages:[]};
      for(const versionId of state.sources.keys())await authorizeSource(state,versionId);
      state.originals=await loadEngagementOriginals({sources:state.sources,versionIds:domain(()=>sourceVersionIdsForInput({project:state.project,packages:[],input:fields,sources:state.sources})),readSource:target=>objects.read(target),cache:sourceCache});
      const request=await reservation(principal,body.request_id,{projectId:body.projectId,source_artifact_ids:sourceIds,fields});if(request.value.status==="promoted")return getEngagement(principal,request.value.engagement_id);
      const evaluated=assess(state,{operation:"create",fields},auth,{requestId:body.request_id,at:request.value.at}),prepared=await preparedObject(state,evaluated,request),core=prepared.core;
      const currentAuth=await authenticate(principal,{enroll:false}),currentParent=await resourceAccess(currentAuth,"project",body.projectId,"manage_access"),currentSources=await sourceProjection(currentAuth,targetValue);
      await entitlement(currentAuth,currentParent.target.value.workspace_id,"storage_writes");
      if(currentParent.target.revision!==parent.target.revision||!isDeepStrictEqual(currentParent.target.value,parent.target.value)||currentSources.sourceSha256!==state.sourceSha256||currentSources.sourceViewSha256!==state.sourceViewSha256)fail(409,"Project or source authority changed before engagement creation.");
      for(const versionId of currentSources.sources.keys())await authorizeSource({...currentSources,auth:currentAuth},versionId);
      const pk=`ENGAGEMENT#${core.id}`;if(await get(currentAuth.ctx,pk,"PROFILE"))fail(409,"This engagement identity is already registered.");await get(currentAuth.ctx,pk,"HEAD");
      const value={object_type:"engagement_resource",engagement_id:core.id,...targetValue,name:core.name,status:"active",owner_user_id:auth.userId,professional_roles:core.roles,resource:assertCollaborationResource({schema_version:1,resource_type:"engagement",resource_id:core.id,workspace_id:targetValue.workspace_id,project_id:targetValue.project_id,owner_id:auth.userId,creator_id:auth.userId,access_policy:{inheritance:"restricted",allow_public_links:false}})};
      const profile=record(pk,"PROFILE",value);assertEngagementProfile(profile);
      const projectedState={target:profile,head:null};
      const hints=[record(`USER#${auth.userId}`,`RESOURCE#engagement#${core.id}`,{resource_id:core.id}),record(`PROJECT#${body.projectId}`,`ENGAGEMENT#${core.id}`,{resource_id:core.id})];for(const hint of hints)await get(currentAuth.ctx,hint.pk,hint.sk);
      await commit(currentAuth.ctx,[profile,...hints,...await promotedWrites(currentAuth,projectedState,prepared,request)]);return getEngagement(principal,core.id);
    }
    async function listEngagements(principal,query={}){
      requireBody(query,["projectId","project_id"]);const auth=await authenticate(principal,{enroll:false}),hints=await store.list(`USER#${auth.userId}`,"RESOURCE#engagement#");if(hints.length>100)fail(413,"Use a bounded engagement navigation page.");const entries=[];
      for(const hint of hints){try{const {target}=await resourceAccess(auth,"engagement",hint.value.resource_id,"view");assertEngagementProfile(target);if(query.projectId&&query.projectId!==target.value.project_id||query.project_id&&query.project_id!==target.value.project_id)continue;entries.push({id:target.value.engagement_id,projectId:target.value.project_id,name:target.value.name,status:target.value.status});}catch(error){if(![403,404].includes(error.statusCode))throw error;}}
      await commit(auth.ctx);return entries;
    }
    async function invitationChange({stage,auth,inviterAuth,target,invitation,role,professionalRole,recipientUserId}){
      if(stage==="revoke")return {extraWrites:[]};
      const current=await load((inviterAuth||auth).principal,target.value.engagement_id,{action:"manage_access"});
      await entitlement(current.auth,current.target.value.workspace_id,"storage_writes");
      const core=current.packages[0].engagement;if(current.packages[0].entities.approvals.length||current.packages[0].baselines.length)fail(409,"Professional assignments are frozen after formal attestation. Use an explicit successor engagement.");
      if(stage==="issue"){
        const fresh=await metadata((inviterAuth||auth).principal,core.id,{action:"manage_access"});sameHead(current,fresh);mergeAuthority(auth.ctx,fresh.auth.ctx);return {extraWrites:[]};
      }
      if(stage!=="accept"||recipientUserId!==auth.userId)fail(403,"Only the verified recipient can accept this professional responsibility.");
      const selectedRole=professionalRole||role,requestId=requestUuid(stableJson(["engagement-role-accept",invitation.invitation_id,auth.userId,selectedRole])),request=await reservation(auth.principal,requestId,{invitationId:invitation.invitation_id,engagementId:core.id,role:selectedRole,userId:auth.userId});
      const evaluated=assess(current,{operation:"bind-role",engagementId:core.id,expectedRevision:core.revision,role:selectedRole,acceptedUserId:auth.userId},auth,{requestId,at:request.value.at}),prepared=await preparedObject(current,evaluated,request),fresh=await metadata((inviterAuth||auth).principal,core.id,{action:"manage_access"});sameHead(current,fresh);
      mergeAuthority(auth.ctx,fresh.auth.ctx);
      // The access layer will condition and commit these domain rows together
      // with the accepted invitation, exact guest/grant and live role binding.
      return {extraWrites:await promotedWrites(auth,fresh,prepared,request)};
    }
    async function invitationPreview({target}){assertEngagementProfile(target);return {engagement_name:target.value.name,engagement_id:target.value.engagement_id,project_id:target.value.project_id,account_id:target.value.account_id};}
    async function engagementSource(principal,engagementId,versionId,{preview=false,page=1}={}){
      const state=await metadata(principal,engagementId),source=state.sources.get(versionId);if(!source)fail(404,"The exact source version is outside this engagement.");
      await authorizeSource(state,versionId);
      const retained=await objects.read(source),current=await metadata(principal,engagementId);sameHead(state,current);
      const version=state.project.resources.flatMap(resource=>resource.versions).find(item=>item.id===versionId),result=preview?await buildDocumentPreview({version,bytes:retained.bytes},{page}):{bytes:retained.bytes,mediaType:"application/octet-stream",filename:version.filename,sha256:version.sha256};
      const final=await metadata(principal,engagementId);sameHead(current,final);await authorizeSource(final,versionId);mergeAuthority(final.auth.ctx,state.auth.ctx);await commit(final.auth.ctx);return result;
    }
    async function engagementSourcePassage(principal,engagementId,versionId,body){
      const request=domain(()=>normalizeDocumentPassageRequest(body)),state=await metadata(principal,engagementId),source=state.sources.get(versionId);
      if(!source)fail(404,"The exact source version is outside this engagement.");
      if(source.sha256!==request.expectedSha256)fail(409,"Reopen the citation from its exact retained original.");
      if(source.sizeBytes>16*1024*1024)fail(413,"Passage review supports one original up to 16 MiB. Open its exact page or download the original.");
      await authorizeSource(state,versionId);
      const retained=await objects.read(source),current=await metadata(principal,engagementId);sameHead(state,current);await authorizeSource(current,versionId);
      const version=state.project.resources.flatMap(resource=>resource.versions).find(item=>item.id===versionId),result=await asyncDomain(()=>buildDocumentPassagePreview({version,bytes:retained.bytes},request));
      const final=await metadata(principal,engagementId);sameHead(current,final);await authorizeSource(final,versionId);mergeAuthority(final.auth.ctx,state.auth.ctx);mergeAuthority(final.auth.ctx,current.auth.ctx);await commit(final.auth.ctx);return result;
    }
    async function engagementSourceTransfer(principal,engagementId,versionId,body){
      const state=await metadata(principal,engagementId),source=state.sources.get(versionId);if(!source)fail(404,"The exact source version is outside this engagement.");
      await authorizeSource(state,versionId);
      const version=state.project.resources.flatMap(resource=>resource.versions).find(item=>item.id===versionId);
      const manifest={mediated:true,version_id:source.versionId,sha256:source.sha256,size_bytes:source.sizeBytes,filename:version.filename,content_type:source.contentType,head_sha256:state.head.value.snapshot.sha256,configuration_revision:state.target.revision};
      if(body===undefined){await commit(state.auth.ctx);return manifest;}
      requireBody(body,["version_id","sha256","size_bytes","head_sha256","configuration_revision","offset","length"]);
      for(const key of ["version_id","sha256","size_bytes","head_sha256","configuration_revision"])if(body[key]!==manifest[key])fail(409,"The exact source download or engagement changed. Reopen the original before downloading it.");
      if(!Number.isSafeInteger(body.offset)||body.offset<0||!Number.isSafeInteger(body.length)||body.length<1||body.length>512*1024||body.offset+body.length>source.sizeBytes)fail(400,"Select a source range of at most 512 KiB within its exact retained original.");
      if(typeof objects.readRange!=="function")fail(503,"Bounded authenticated original transfers are not configured.");
      const bytes=await objects.readRange({...source,offset:body.offset,length:body.length}),current=await metadata(principal,engagementId);sameHead(state,current);
      if(!(bytes instanceof Uint8Array)||bytes.byteLength!==body.length)fail(409,"The immutable original range is incomplete.");
      await authorizeSource(current,versionId);mergeAuthority(current.auth.ctx,state.auth.ctx);await commit(current.auth.ctx);return {version_id:manifest.version_id,sha256:manifest.sha256,size_bytes:manifest.size_bytes,offset:body.offset,length:body.length,bytes_base64:Buffer.from(bytes).toString("base64")};
    }
    async function engagementRequirementLibrary(principal,engagementId,frameworkId,query={}){
      requireBody(query,["after"]);const state=await metadata(principal,engagementId),result=await asyncDomain(()=>libraryFor(state).page(libraryScope(state),frameworkId,query)),current=await metadata(principal,engagementId);sameHead(state,current);mergeAuthority(current.auth.ctx,state.auth.ctx);await commit(current.auth.ctx);return result;
    }
    async function engagementPolicySource(principal,engagementId,frameworkId,sourceSha256,{download=false,page=1}={}){
      const state=await metadata(principal,engagementId),original=await asyncDomain(()=>libraryFor(state).original(libraryScope(state),frameworkId,sourceSha256,{download}));
      const result=download?{bytes:original.bytes,filename:original.version.filename,sha256:original.version.sha256,mediaType:"application/octet-stream"}:await buildDocumentPreview({version:original.version,bytes:original.bytes},{page});
      const current=await metadata(principal,engagementId);sameHead(state,current);mergeAuthority(current.auth.ctx,state.auth.ctx);await commit(current.auth.ctx);return result;
    }
    async function engagementExchange(principal,engagementId){const state=await load(principal,engagementId,{custody:true}),result=assess(state,{operation:"export"}).result,current=await metadata(principal,engagementId);sameHead(state,current);await assertCaseCustody(current,state.caseProtection);mergeAuthority(current.auth.ctx,state.auth.ctx);const output=await response(current,{format:"esia-engagement-project-exchange",schemaVersion:1,project:state.project,sourceMetadata:state.sourceMetadata,engagements:result},async fresh=>assertCaseCustody(fresh,state.caseProtection));await commit(current.auth.ctx);return output;}
    async function engagementDocumentClassification(principal,engagementId,body){
      requireBody(body,["request_id","expectedRevision","expectedProjectRevision","command"]);
      const responsibility={action:"edit",requiredRoles:["preparer","reviewer"]},state=await load(principal,engagementId,{...responsibility,input:body.command}),request=await reservation(principal,body.request_id,{engagementId,operation:"document-classification",expectedRevision:body.expectedRevision,expectedProjectRevision:body.expectedProjectRevision,command:body.command});
      if(request.value.status==="promoted")return compoundResponse({project:await engagementProject(principal,engagementId),engagement:await getEngagement(principal,engagementId)});
      const evaluated=await analysis(state,{operation:"document-classification",engagementId,expectedRevision:body.expectedRevision,expectedProjectRevision:body.expectedProjectRevision,command:body.command},{requestId:body.request_id,at:request.value.at});
      if(evaluated.sourceMetadataChanges?.length!==1)fail(409,"A document classification must retain one exact source change.");
      const appended=domain(()=>appendEngagementSourceMetadata({project:state.rawProject,engagementId,sourceMetadata:state.sourceMetadata,change:evaluated.sourceMetadataChanges[0],requestId:body.request_id,at:request.value.at,authentication:{userId:state.auth.userId,issuer:principal.issuer,subject:principal.subject}}));
      const prepared=await preparedObject({...state,project:appended.project,sourceMetadata:appended.sourceMetadata},evaluated,request),current=await metadata(principal,engagementId,responsibility);sameHead(state,current);
      mergeAuthority(current.auth.ctx,state.auth.ctx);await commit(current.auth.ctx,await promotedWrites(current.auth,current,prepared,request));return compoundResponse({project:await engagementProject(principal,engagementId),engagement:await getEngagement(principal,engagementId),classification:evaluated.result.classification});
    }
    async function documentComparisonContext(principal,engagementId,body,responsibility={}){
      const state=await load(principal,engagementId,{...responsibility,metadataOnly:true}),engagement=state.packages[0].engagement;
      if(body.expectedRevision!==engagement.revision||body.expectedProjectRevision!==state.project.revision)fail(409,"The engagement or document descriptions changed. Compare the current saved originals.");
      const {leftVersionId,rightVersionId}=body.command||body;
      if(typeof leftVersionId!=="string"||typeof rightVersionId!=="string"||leftVersionId===rightVersionId)fail(400,"Choose two distinct exact source versions.");
      const versionIds=[leftVersionId,rightVersionId];for(const versionId of versionIds){const source=state.sources.get(versionId);if(!source)fail(404,"Choose two exact original versions in this engagement.");if(source.sizeBytes>documentComparisonLimits.sourceBytes)fail(413,"Compare originals of at most 16 MiB each.");await authorizeSource(state,versionId);}
      const readVersion=async versionId=>{
        if(!versionIds.includes(versionId))fail(403,"This comparison covers only its two selected originals.");
        const before=await metadata(principal,engagementId,responsibility);sameHead(state,before);await authorizeSource(before,versionId);
        const retained=await objects.read(state.sources.get(versionId)),after=await metadata(principal,engagementId,responsibility);sameHead(state,after);await authorizeSource(after,versionId);mergeAuthority(state.auth.ctx,before.auth.ctx);mergeAuthority(state.auth.ctx,after.auth.ctx);
        return {bytes:retained.bytes,version:state.project.resources.flatMap(resource=>resource.versions).find(version=>version.id===versionId)};
      };
      const finish=async()=>{const current=await metadata(principal,engagementId,responsibility);sameHead(state,current);for(const versionId of versionIds)await authorizeSource(current,versionId);mergeAuthority(current.auth.ctx,state.auth.ctx);return current;};
      return {state,engagement,readVersion,finish};
    }
    async function engagementDocumentComparison(principal,engagementId,body){
      requireBody(body,["leftVersionId","rightVersionId","expectedRevision","expectedProjectRevision"]);
      const {state,engagement,readVersion,finish}=await documentComparisonContext(principal,engagementId,body),result=await asyncDomain(()=>compareEngagementDocuments({engagement,project:state.project,leftVersionId:body.leftVersionId,rightVersionId:body.rightVersionId,readVersion})),current=await finish();await commit(current.auth.ctx);return result;
    }
    async function engagementDocumentRelation(principal,engagementId,body){
      requireBody(body,["request_id","expectedRevision","expectedProjectRevision","command"]);
      const responsibility={action:"edit",requiredRoles:["preparer","reviewer"]},initial=await metadata(principal,engagementId,responsibility),request=await reservation(principal,body.request_id,{engagementId,operation:"document-relation-review",expectedRevision:body.expectedRevision,expectedProjectRevision:body.expectedProjectRevision,command:body.command});
      if(request.value.status==="promoted")return compoundResponse({project:await engagementProject(principal,engagementId),engagement:await getEngagement(principal,engagementId)});
      const {state,engagement,readVersion,finish}=await documentComparisonContext(principal,engagementId,body,responsibility);sameHead(initial,state);
      const change=await asyncDomain(()=>prepareEngagementDocumentRelation({engagement,project:state.project,command:body.command,actorId:state.auth.userId,at:request.value.at,readVersion})),appended=domain(()=>appendEngagementSourceMetadata({project:state.rawProject,engagementId,sourceMetadata:state.sourceMetadata,change,requestId:body.request_id,at:request.value.at,authentication:{userId:state.auth.userId,issuer:principal.issuer,subject:principal.subject}}));
      await finish();const prepared=await preparedObject({...state,project:appended.project,sourceMetadata:appended.sourceMetadata},{packages:state.packages},request),current=await finish();mergeAuthority(current.auth.ctx,initial.auth.ctx);await commit(current.auth.ctx,await promotedWrites(current.auth,current,prepared,request));return compoundResponse({project:await engagementProject(principal,engagementId),engagement:await getEngagement(principal,engagementId)});
    }
    async function issuedState(principal,engagementId,renditionId){
      const state=await metadata(principal,engagementId),row=await get(state.auth.ctx,`ENGAGEMENT_ISSUED#${id(renditionId)}`,"PROFILE"),value=row?.value,output=value?.metadata,target=value?.object;
      if(!uuidPattern.test(renditionId)||row?.revision!==1||value?.object_type!=="engagement_issued_rendition"||value.engagement_id!==engagementId||value.project_id!==state.project.id||value.account_id!==state.project.accountId||output?.id!==renditionId||output.engagementId!==engagementId||output.projectId!==state.project.id||output.accountId!==state.project.accountId||!state.head.value.issued_ids?.includes(renditionId))fail(404,"The exact issued output is unavailable in this engagement.");
      const key=`tenants/${state.project.accountId}/projects/${state.project.id}/engagements/${engagementId}/issued/${renditionId}.${output.format}`;
      if(!["html","pdf","docx","xlsx","csv","json"].includes(output.format)||target?.kind!=="issued"||target.key!==key||target.bucket!==storage.forAccount(state.project.accountId).bucket||target.sha256!==output.sha256||target.sizeBytes!==output.size||target.contentType!==output.mediaType||typeof target.versionId!=="string"||!target.versionId||target.versionId==="null")fail(409,"The issued output differs from its exact retained descriptor.");
      await authorizeIssued(state,output);return {...state,issuedRow:row,output,object:target};
    }
    async function engagementIssued(principal,engagementId,renditionId){
      const state=await issuedState(principal,engagementId,renditionId),retained=await objects.read(state.object),current=await issuedState(principal,engagementId,renditionId);sameHead(state,current);await commit(current.auth.ctx);return {metadata:state.output,bytes:retained.bytes};
    }
    async function engagementIssuedTransfer(principal,engagementId,renditionId,body){
      const state=await issuedState(principal,engagementId,renditionId),manifest={mediated:true,version_id:state.object.versionId,sha256:state.object.sha256,size_bytes:state.object.sizeBytes,filename:state.output.filename,content_type:state.output.mediaType,head_sha256:state.head.value.snapshot.sha256,configuration_revision:state.target.revision};
      if(body===undefined){await commit(state.auth.ctx);return manifest;}
      requireBody(body,["version_id","sha256","size_bytes","head_sha256","configuration_revision","offset","length"]);
      if(["version_id","sha256","size_bytes","head_sha256","configuration_revision"].some(key=>body[key]!==manifest[key]))fail(409,"The exact issued output or engagement changed. Reopen the issued file.");
      if(!Number.isSafeInteger(body.offset)||body.offset<0||!Number.isSafeInteger(body.length)||body.length<1||body.length>512*1024||body.offset+body.length>manifest.size_bytes)fail(400,"Select a bounded range of the exact issued output.");
      if(typeof objects.readRange!=="function")fail(503,"Bounded issued output transfers are not configured.");
      const bytes=await objects.readRange({...state.object,offset:body.offset,length:body.length}),current=await issuedState(principal,engagementId,renditionId);sameHead(state,current);
      if(!(bytes instanceof Uint8Array)||bytes.byteLength!==body.length)fail(409,"The exact issued output range is incomplete.");
      await commit(current.auth.ctx);return {version_id:manifest.version_id,sha256:manifest.sha256,size_bytes:manifest.size_bytes,offset:body.offset,length:body.length,bytes_base64:Buffer.from(bytes).toString("base64")};
    }
    async function engagementExport(principal,engagementId,baselineId,body){
      requireBody(body,["request_id","format","selection"]);
      const state=await load(principal,engagementId),input={operation:"baseline-export",engagementId,baselineId,format:body.format||"json",...(body.selection?{selection:body.selection}:{})};await authorizeIssued(state,{baselineId});
      await entitlement(state.auth,state.target.value.workspace_id,"storage_writes");
      let request=await reservation(principal,body.request_id,{engagementId,baselineId,format:input.format,selection:input.selection||{}});
      if(request.value.status==="promoted")return compoundResponse({rendition:(await issuedState(principal,engagementId,request.value.output.id)).output,engagement:await getEngagement(principal,engagementId)});
      let prepared,issued,issuedObject;
      if(request.value.outputCandidate){
        const candidate=request.value.outputCandidate;if(candidate.parent_head_sha256!==state.head.value.snapshot.sha256)fail(409,"The engagement changed before this prepared output was issued. Start a new explicit export.");
        let retained;try{retained=await objects.read(candidate.snapshot);}catch(error){if(error.statusCode===404)fail(409,"The prepared report was interrupted before its bytes were retained. Start a new explicit export request.");throw error;}
        let envelope;try{envelope=JSON.parse(Buffer.from(retained.bytes).toString("utf8"));}catch{fail(409,"The prepared issued package is invalid.");}
        if(envelope?.format!=="esia-authenticated-engagement-state"||envelope.requestId!==request.value.request_id||envelope.sourceSha256!==state.sourceSha256||!isDeepStrictEqual(envelope.sourceMetadata,state.sourceMetadata)||!Array.isArray(envelope.packages)||envelope.packages.length!==1)fail(409,"The prepared output does not match its exact reserved engagement.");
        const withoutIssued=pack=>Object.fromEntries(Object.entries(pack).filter(([key])=>key!=="issuedRenditions"));
        if(!isDeepStrictEqual(withoutIssued(envelope.packages[0]),withoutIssued(state.packages[0])))fail(409,"The prepared output changed its underlying signed assessment records.");
        const archive=envelope.packages[0].issuedRenditions||[],prior=state.packages[0].issuedRenditions||[];
        if(archive.length!==prior.length+1||prior.some(row=>!archive.some(item=>isDeepStrictEqual(item,row))))fail(409,"The prepared output does not preserve the earlier issued archive.");
        if(stableJson(envelope.originArchives||[])!==stableJson(state.originManifests||[]))fail(409,"The prepared output changed its retained origin ancestry.");
        const retainedSourceProof=state.retainedSourceProof?domain(()=>advanceEngagementRetainedSourceProof(state.retainedSourceProof,{project:state.project,packages:envelope.packages,input:{operation:'issued-retain',engagementId},authority:authOf(state.auth),originArchives:state.originArchives||new Map()})):undefined;
        const recovered=await asyncDomain(()=>analyze({project:state.project,packages:envelope.packages,originals:state.originals,retainedSourceProof,originArchives:state.originArchives||new Map(),actorId:state.auth.userId,authority:authOf(state.auth),input:{operation:"issued-get",engagementId,renditionId:candidate.metadata.id}}));
        issued=recovered.result;if(!isDeepStrictEqual(issued.metadata,candidate.metadata))fail(409,"The prepared issued metadata changed.");
        prepared={manifest:{...candidate.snapshot,versionId:retained.versionId},core:envelope.packages[0].engagement,packages:envelope.packages,project:state.project,originArchives:state.originArchives||new Map(),caseProtection:collectEngagementCaseProtection({project:state.project,packages:envelope.packages,originArchives:state.originArchives||new Map()}),originManifests:state.originManifests||[],libraryUses:domain(()=>engagementLibraryUse(envelope.packages)),issuedIds:archive.map(item=>item.id)};
        issuedObject=await writeExactObject(candidate.object,issued.bytes);
      }else{
        const evaluated=await analysis(state,input,{requestId:body.request_id,at:request.value.at});issued=evaluated.result;
        if((state.packages[0].issuedRenditions||[]).some(row=>row.id===issued.metadata.id)){
          const current=await issuedState(principal,engagementId,issued.metadata.id),pending=await get(current.auth.ctx,request.pk,"PROFILE");if(pending?.revision!==request.revision)fail(409,"The existing output request changed.");await commit(current.auth.ctx,[record(request.pk,"PROFILE",{...pending.value,status:"promoted",engagement_id:engagementId,head_revision:current.head.revision,snapshot:current.head.value.snapshot,output:current.output},pending.revision+1)]);return compoundResponse({rendition:current.output,engagement:await getEngagement(principal,engagementId)});
        }
        const description=describeObject(state,evaluated,request),output=issued.metadata,object={kind:"issued",bucket:storage.forAccount(state.project.accountId).bucket,key:`tenants/${state.project.accountId}/projects/${state.project.id}/engagements/${engagementId}/issued/${output.id}.${output.format}`,sha256:output.sha256,sizeBytes:output.size,contentType:output.mediaType};
        const staging=await metadata(principal,engagementId);sameHead(state,staging);await entitlement(staging.auth,staging.target.value.workspace_id,"storage_writes");const currentRequest=await get(staging.auth.ctx,request.pk,"PROFILE");if(currentRequest?.revision!==request.revision)fail(409,"The output reservation changed while rendering.");
        request=record(request.pk,"PROFILE",{...request.value,output:output,outputCandidate:{parent_head_sha256:state.head.value.snapshot.sha256,snapshot:description.manifest,metadata:output,object}},request.revision+1);await commit(staging.auth.ctx,[request]);
        // Retain the package containing the exact first rendered bytes before
        // writing the downloadable copy. A lost acknowledgement resumes this
        // checksummed candidate and never invokes the renderer again.
        prepared={...description,manifest:await writeExactObject(description.manifest,description.bytes)};issuedObject=await writeExactObject(object,issued.bytes);
      }
      const current=await metadata(principal,engagementId);sameHead(state,current);await entitlement(current.auth,current.target.value.workspace_id,"storage_writes");
      const outputRow=record(`ENGAGEMENT_ISSUED#${issued.metadata.id}`,"PROFILE",{object_type:"engagement_issued_rendition",engagement_id:engagementId,project_id:state.project.id,account_id:state.project.accountId,request_id:request.value.request_id,metadata:issued.metadata,object:issuedObject});await get(current.auth.ctx,outputRow.pk,outputRow.sk);
      mergeAuthority(current.auth.ctx,state.auth.ctx);await commit(current.auth.ctx,[...await promotedWrites(current.auth,current,prepared,request),outputRow]);return compoundResponse({rendition:issued.metadata,engagement:await getEngagement(principal,engagementId)});
    }
    async function engagementAnalysis(principal,engagementId,operation,body={}){
      if(!["assistant","index","search","assist","issued-list","issued-get"].includes(operation))fail(400,"Choose a configured engagement analysis operation.");
      requireBody(body,["versionIds","pageRanges","ocrPages","maxSourceBytes","continueIndexId","query","retrieval","limit","indexId","task","cycleId","renditionId"]);
      const responsibility=operation==="assist"?{action:"edit",requiredRoles:["preparer","reviewer"]}:{};
      const state=await load(principal,engagementId,{...responsibility,input:body,allSources:["index","search","assist"].includes(operation)&&(!Array.isArray(body.versionIds)||body.continueIndexId!==undefined)}),selection=['index','assist'].includes(operation)&&body.versionIds===undefined&&body.indexId===undefined?{versionIds:[...state.originals.keys()]}:{},evaluated=await analysis(state,{operation,engagementId,...body,...selection}),current=await metadata(principal,engagementId,responsibility);sameHead(state,current);mergeAuthority(current.auth.ctx,state.auth.ctx);await response(current,evaluated.result);await commit(current.auth.ctx);return evaluated.result;
    }
    async function saveCaseDetails(principal,engagementId,body,{authorization,policyRow,registryRow,authorityState}){
      const command={type:'monitoring-case-details-save',eventId:body.eventId,groups:body.groups,statement:body.statement,...Object.fromEntries(['sourceBindings','geometryBindings','legacyMigration','originMigration'].filter(key=>body[key]!==undefined).map(key=>[key,body[key]]))},state=await load(principal,engagementId,{action:'edit',requiredRoles:['preparer','reviewer'],input:command,caseMutation:command});
      if(authorization.userId!==state.auth.userId||authorization.scope.engagementId!==engagementId||authorization.caseId!==body.eventId||authorization.aclRevision!==policyRow.revision)fail(403,'The case update differs from its current native permission.');
      mergeAuthority(state.auth.ctx,authorityState.auth.ctx);const request=await reservation(principal,body.request_id,{engagementId,operation:'case-details',expectedRevision:body.expectedRevision,expectedAclRevision:body.expectedAclRevision,command});if(request.value.status==='promoted')return getEngagement(principal,engagementId);
      const evaluated=domain(()=>evaluate({project:state.project,packages:state.packages,originals:state.originals,retainedSourceProof:state.retainedSourceProof,originArchives:state.originArchives,actorId:state.auth.userId,authority:authOf(state.auth),execution:{requestId:body.request_id,at:request.value.at},input:{operation:'command',engagementId,expectedRevision:body.expectedRevision,command},commandOptions:{caseProtection:true}})),prepared=await preparedObject(state,evaluated,request),current=await metadata(principal,engagementId,{action:'edit',requiredRoles:['preparer','reviewer']});sameHead(state,current);
      for(const expected of [policyRow,registryRow]){const fresh=await get(current.auth.ctx,expected.pk,expected.sk);if(!fresh||fresh.revision!==expected.revision||!isDeepStrictEqual(fresh.value,expected.value))fail(409,'Case permissions or protected source coverage changed while saving.');}
      const permission=assertEngagementCaseAccess(policyRow,{scope:authorization.scope,caseId:body.eventId,userId:current.auth.userId,groups:authorization.groups,action:'update',now:instant().getTime()});current.auth.ctx.authorityDeadlines.set(`case-update:${body.eventId}`,Date.parse(permission.expiresAt));mergeAuthority(current.auth.ctx,state.auth.ctx);await commit(current.auth.ctx,await promotedWrites(current.auth,current,prepared,request));return getEngagement(principal,engagementId);
    }
    async function initializationBindings({auth,project}){
      const hints=await store.list(project.pk,'ENGAGEMENT#');if(hints.length>100)fail(413,'Initialize privacy for a bounded project of up to100 engagements.');const bindings=[];
      for(const hint of hints){const state=await load(auth.principal,hint.value.resource_id,{metadataOnly:true});if(state.project.id!==project.value.project_id||state.project.accountId!==project.value.account_id)fail(409,'A privacy initialization hint crosses project custody.');const current=await metadata(auth.principal,hint.value.resource_id);sameHead(state,current);mergeAuthority(auth.ctx,state.auth.ctx);mergeAuthority(auth.ctx,current.auth.ctx);bindings.push(...collectEngagementCaseProtection(state).bindings);}return bindings;
    }
    async function authorizeSharedCaseGeometry(state,event,refs){
      const pack=state.packages[0],all=[{...pack.engagement,...pack.entities},...pack.baselines],events=all.flatMap(view=>view.events||[]),ids=new Set(events.filter(row=>row.restricted||row.restrictedAvailable||row.history?.some(value=>value.restricted||value.restrictedAvailable)).map(row=>row.id)),key=engagementCaseAccessKey(pack.engagement.id),policy=await get(state.auth.ctx,key.pk,key.sk),assertions=all.flatMap(view=>view.assertions||[]),missions=all.flatMap(view=>view.missions||[]),measurements=all.flatMap(view=>view.measurements||[]),sourceVersions=state.project.resources.flatMap(resource=>resource.versions);
      for(const binding of state.caseSourceRegistry?.value.bindings||[])if(binding.engagementId===pack.engagement.id)ids.add(binding.caseId);
      for(const caseId of ids){const cases=events.filter(row=>row.id===caseId).map(row=>({...row,restrictedAvailable:true})),closure=monitoringProtectionClosure({events:cases,assertions,missions,measurements,sourceVersions}),privateAssertions=new Set(assertions.filter(row=>[row,...row.history].some(value=>isProtectedMonitoringAssertion(value,closure))).map(row=>row.id)),applies=refs.some(ref=>ref.kind==='mission_point'&&(closure.missionPointIds.has(ref.pointId)||missions.some(row=>row.id===ref.missionId&&[row,...row.history].some(value=>value.monitoringPoints.some(point=>point.id===ref.pointId&&point.photoAssertionIds.some(id=>privateAssertions.has(id))))))||ref.kind==='indicator'&&closure.indicatorIds.has(ref.indicatorId)||ref.kind==='measurement'&&(closure.measurementIds.has(ref.measurementId)||measurements.some(row=>row.id===ref.measurementId&&(closure.indicatorIds.has(row.indicatorId)||row.assertionIds.some(id=>privateAssertions.has(id)))))||ref.kind==='field_capture'&&closure.captureIds.has(ref.captureId));
       if(applies){const permission=assertEngagementCaseAccess(policy,{scope:libraryScope(state),caseId,userId:state.auth.userId,groups:['location'],action:'read',now:instant().getTime()});state.auth.ctx.authorityDeadlines.set(`case-shared-location:${caseId}`,Date.parse(permission.expiresAt));}}
    }
    async function authorizeSharedCaseLocationSources(state,event){
      const bindings=[...collectEngagementCaseProtection(state).bindings,...(state.caseSourceRegistry?.value.bindings||[])],engagementId=state.target.value.engagement_id,hashes=new Set(bindings.filter(row=>row.engagementId===engagementId&&row.caseId===event.id&&row.groups.includes('location')).map(row=>row.sourceSha256)),seen=new Set();
      for(const binding of bindings){if(!hashes.has(binding.sourceSha256)||!binding.groups.includes('location')||binding.engagementId===engagementId&&binding.caseId===event.id)continue;const key=`${binding.engagementId}:${binding.caseId}`;if(seen.has(key))continue;seen.add(key);const current=binding.engagementId===engagementId?state:await metadata(state.auth.principal,binding.engagementId);if(current.project.id!==state.project.id||current.target.value.workspace_id!==state.target.value.workspace_id)fail(409,'Shared protected location evidence must retain its exact project and workspace.');const policyKey=engagementCaseAccessKey(binding.engagementId),policy=await get(current.auth.ctx,policyKey.pk,policyKey.sk),permission=assertEngagementCaseAccess(policy,{scope:libraryScope(current),caseId:binding.caseId,userId:current.auth.userId,groups:['location'],action:'read',now:instant().getTime()});current.auth.ctx.authorityDeadlines.set(`case-shared-location-source:${key}`,Date.parse(permission.expiresAt));mergeAuthority(state.auth.ctx,current.auth.ctx);}
    }
    async function assertProtectedSuccessorSources(state,{sources}={}){
      if(!Array.isArray(sources)||sources.length>100)fail(413,'Review a bounded set of exact protected case originals before starting this successor.');if(!sources.length)return;
      const scope={accountId:state.project.accountId,projectId:state.project.id,workspaceId:state.target.value.workspace_id},key=engagementCaseSourceKey(scope.projectId),registry=await get(state.auth.ctx,key.pk,key.sk);validateEngagementCaseSources(registry,{scope});
      for(const source of sources){const bindings=registry?.value.bindings.filter(row=>row.sourceSha256===source.sha256)||[],covered=new Set(bindings.flatMap(row=>row.groups));if(!bindings.length||!Array.isArray(source.groups)||source.groups.some(group=>!covered.has(group)))fail(403,'These case originals need protected intake before this review can be created. Importing private case originals into a new project is currently unavailable.');
        if(!Array.isArray(source.versionIds)||!source.versionIds.length)fail(409,'Each protected original needs an exact retained destination mapping.');for(const versionId of source.versionIds){if(state.sources.get(versionId)?.sha256!==source.sha256)fail(409,'The protected original differs from its retained destination mapping.');await authorizeSource(state,versionId);}
      }
    }
    const caseOperations=createAuthenticatedCaseOperations({...deps,metadata,load,sameHead,mergeAuthority,requireBody,getEngagement,saveCaseDetails,initializationBindings,
      assertCaseParticipant:verifyCaseParticipant,
      protectionOf:({prepared})=>prepared.caseProtection,
      caseOriginFor:async({state,event,groups})=>{if(groups.includes('location')){await authorizeSharedCaseGeometry(state,event,[event,...(event.history||[])].flatMap(row=>monitoringCaseReferences(row).geometryBindings||[]));await authorizeSharedCaseLocationSources(state,event);}const resolved=domain(()=>resolveMonitoringCaseOrigin(event.restrictedOrigin,{context:createEngagementOriginArchiveContext(state.originArchives)}));return {reference:resolved.reference,scope:resolved.scope,groups:Object.fromEntries(groups.filter(group=>resolved.groups[group]).map(group=>[group,resolved.groups[group]]))};},
      caseGeometryFor:async({state,event})=>{const refs=[event,...(event.history||[])].flatMap(row=>monitoringCaseReferences(row).geometryBindings||[]);await authorizeSharedCaseGeometry(state,event,refs);await authorizeSharedCaseLocationSources(state,event);const entities=state.packages[0].entities,rows=[];for(const ref of refs){if(ref.kind==='mission_point'){const mission=entities.missions.find(row=>row.id===ref.missionId);for(const revision of mission?[mission,...mission.history]:[])for(const point of revision.monitoringPoints||[])if(point.id===ref.pointId)if(rows.length<100)rows.push({kind:ref.kind,missionId:ref.missionId,revision:revision.revision,...structuredClone(point)});}else if(['indicator','measurement'].includes(ref.kind)){const name=ref.kind==='indicator'?'indicators':'measurements',row=entities[name].find(row=>row.id===ref[`${ref.kind}Id`]);for(const revision of row?[row,...row.history]:[])if(rows.length<100)rows.push({kind:ref.kind,id:row.id,revision:revision.revision,location:revision.location});}}return rows;},
      caseSourceDescriptions:async({state,event})=>{
        const protection=collectEngagementCaseProtection(state),byHash=new Map(),sources=[];
        for(const binding of [...protection.bindings,...(state.caseSourceRegistry?.value.bindings||[])])if(binding.engagementId===state.target.value.engagement_id&&binding.caseId===event.id){const groups=byHash.get(binding.sourceSha256)||new Set();for(const group of binding.groups)groups.add(group);byHash.set(binding.sourceSha256,groups);}
        for(const [versionId,target]of state.sources){const groups=byHash.get(target.sha256);if(!groups)continue;try{await authorizeSource(state,versionId);}catch(error){if([403,404].includes(error.statusCode))continue;throw error;}const version=state.project.resources.flatMap(row=>row.versions).find(row=>row.id===versionId);sources.push({groups:[...groups].sort(),versionId,sha256:version.sha256,size:version.size,filename:version.filename,mediaType:version.mediaType});}
        return sources;
      }
    });
    async function engagementMonitoringAttention(principal,engagementId,query={}){
      requireBody(query,['asOf']);const asOf=domain(()=>validDate(query.asOf||iso().slice(0,10),'Monitoring attention date')),anchor=await metadata(principal,engagementId),entries=await listEngagements(principal),engagements=[];let unavailable=0;
      entries.sort((a,b)=>Number(b.id===engagementId)-Number(a.id===engagementId));let retainedBytes=0,remaining=0;for(const entry of entries){if(engagements.length>=10){remaining++;continue;}let state;try{const before=await metadata(principal,entry.id,{maximumSnapshotBytes:16*1024*1024-retainedBytes});if(before.project.accountId!==anchor.project.accountId)continue;state=await load(principal,entry.id,{attentionOnly:true,maximumSnapshotBytes:16*1024*1024-retainedBytes});sameHead(before,state);retainedBytes+=state.head.value.snapshot.sizeBytes;}catch(error){if([403,404].includes(error.statusCode)){unavailable++;continue;}if(error.statusCode===413){remaining++;continue;}throw error;}
       const pack=state.packages[0],canonical={...pack.engagement,...pack.entities,baselines:pack.baselines,audit:pack.audit,sourceVersions:state.project.resources.flatMap(resource=>resource.versions.map(version=>({...version,resourceId:resource.id})))},view=disclosureFor(state,canonical),current=await metadata(principal,entry.id);sameHead(state,current);mergeAuthority(anchor.auth.ctx,state.auth.ctx);mergeAuthority(anchor.auth.ctx,current.auth.ctx);engagements.push({engagementId:entry.id,projectId:state.project.id,projectName:state.project.name,name:view.name,attention:monitoringAttention(view,{asOf}),cycles:view.cycles.map(cycle=>({id:cycle.id,name:cycle.name,programId:cycle.programId,attention:monitoringAttention(view,{asOf,cycleId:cycle.id})}))});}
      const current=await metadata(principal,engagementId);sameHead(anchor,current);mergeAuthority(anchor.auth.ctx,current.auth.ctx);const result=await response(current,{accountId:anchor.project.accountId,asOf,engagements,coverage:{included:engagements.length,unavailable,remaining,maximumEngagements:10,retainedBytes,description:remaining?'This view includes up to 10 available engagements within a 16 MiB saved-record limit. Open another assignment for its project and cycle priorities.':'Priorities use the latest saved review records available to your signed-in account. Refresh when you need an updated view.'}});await commit(anchor.auth.ctx);return result;
    }
    const fieldOperations=createAuthenticatedFieldOperations({resourceAuthority,objects,storage,libraryFor,libraryScope,metadata,intakeAuthority,load,assess,authorityView,disclosureFor,authorizeSource,proofForExpansion,response,sameHead,mergeAuthority,requireBody,domain,asyncDomain,reservation,preparedObject,promotedWrites,sourceProjection,get,commit,record,instant,iso,fail,id,requestUuid,authOf,evaluate,assertEngagementProfile,engagementProject,getEngagement,compoundResponse,
      async fieldPolicy(state){if(Object.hasOwn(state.head.value,"field_device_policy"))return state.head.value.field_device_policy;const key=state.head.value.snapshot.sha256;if(legacyFieldPolicies.has(key))return legacyFieldPolicies.get(key);const retained=await objects.read(state.head.value.snapshot);let envelope;try{envelope=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(retained.bytes));}catch{fail(409,"The retained field policy is unavailable.");}if(envelope?.format!=="esia-authenticated-engagement-state"||envelope.packages?.length!==1||envelope.packages[0].engagement.id!==state.target.value.engagement_id)fail(409,"The retained field policy belongs to another engagement.");const policy=envelope.packages[0].engagement.devicePolicy??null;if(legacyFieldPolicies.size>=16)legacyFieldPolicies.delete(legacyFieldPolicies.keys().next().value);legacyFieldPolicies.set(key,policy);return policy;}});
    const successorOperations=createAuthenticatedSuccessorOperations({authenticate,resourceAccess,entitlement,sourceProjection,get,commit,record,storage,objects,instant,iso,fail,id,requireBody,requestUuid,reservation,evaluate,authOf,loadOriginals:async state=>{for(const versionId of state.sources.keys())await authorizeSource(state,versionId);return loadEngagementOriginals({sources:state.sources,versionIds:[...state.sources.keys()],readSource:target=>objects.read(target),cache:sourceCache});},assertProtectedSuccessorSources,preparedObject,promotedWrites,getEngagement,metadata,load,authorizeHistory,mergeAuthority,assertEngagementProfile,domain});
    const {authorizeOrigins,...successorMethods}=successorOperations;
    const policyTransfer=createEngagementPolicyTransfer({metadata,libraryFor,libraryScope,sameHead,asyncDomain,requireBody,commit,readRange:readPolicyOriginalRange,fail});
    const {protectionWrites,...caseMethods}=caseOperations;
    const clientTemplates=createAuthenticatedClientTemplateOperations({...deps,objects,nativeFactory:clientTemplateNativeFactory,assistant:clientTemplateAssistant,load,metadata,sameHead,mergeAuthority,disclosureFor,authorizeHistory,response});
    return {...clientTemplates,...policyTransfer,...fieldOperations,...successorMethods,...caseMethods,createEngagement,getEngagement,engagementCommand,listEngagements,engagementProject,engagementIntakeContext,engagementAttachSources,engagementJsonTransfer,engagementJsonResponse,engagementRequirementLibrary,engagementPolicySource,engagementSource,engagementSourcePassage,engagementSourceTransfer,engagementExchange,engagementAnalysis,engagementDocumentClassification,engagementDocumentComparison,engagementDocumentRelation,engagementMonitoringAttention,engagementExport,engagementIssued,engagementIssuedTransfer,invitationChange,invitationPreview};
  };
}
