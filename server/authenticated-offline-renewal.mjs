// Explicit foreground renewal grants access to an unchanged encrypted copy.
// Historical validation is private routing/integrity work, never current permission.
import {createHash, webcrypto} from 'node:crypto';
import {createAuthenticatedFieldContext, assertAuthenticatedFieldContext, assertAuthenticatedFieldIdentity} from '../src/lib/authenticated-field-context.js';
import {stableJson, uuidPattern} from '../src/lib/engagement-domain.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, fields) => object(value) && Object.keys(value).length === fields.length && Object.keys(value).every(key => fields.includes(key));
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const bindings = ['packageId', 'sourceSelectionId', 'originalAuthoritySha256', 'reviewSha256', 'sourceManifestSha256', 'previousRenewalId'];
const proofKeys = ['format','schemaVersion','id',...bindings,'identity','selection','sensitivity','currentContext','currentHead','issuedAt','expiresAt','sourceAuthorizations','statement','sha256'];
const withoutSha = value => Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'sha256'));
const sign = value => ({...value, sha256: hash(stableJson(value))});
const canonicalDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const maxBytes = 1024 * 1024;
export function createAuthenticatedOfflineRenewalOperations(deps) {
  const {objects, authority, leaseFor, context, response, sameHead, mergeAuthority, reservation, get, commit, record, instant, fail, checked, expectedIdentity, currentSelection, recheckSelection, currentSourceAccess, selectedRights, rejectProtectedSelection, selectionManifest, assertManifest} = deps;
  const now = () => instant().getTime();
  const keyFor = (engagementId, id, review = false) => ({pk:`ENGAGEMENT#${engagementId}`, sk:`OFFLINE_RENEWAL${review ? '_REVIEW' : ''}#${id}`});
  function bodyOf(body, extra) {
    if (!exact(body, ['request_id','leaseId',...bindings,...extra]) || !uuidPattern.test(body.request_id || '') || !uuidPattern.test(body.leaseId || '') || !uuidPattern.test(body.packageId || '') || !uuidPattern.test(body.sourceSelectionId || '') || ![null,undefined].includes(body.previousRenewalId) && !uuidPattern.test(body.previousRenewalId) || body.previousRenewalId === undefined || !['originalAuthoritySha256','reviewSha256','sourceManifestSha256'].every(key => sha(body[key]))) fail(400, 'Use the exact encrypted-copy bindings and current field permission.');
  }
  function assertBindings(body, payload) {
    if (body.sourceSelectionId !== payload.authority.id || body.originalAuthoritySha256 !== hash(stableJson(payload.authority)) || body.reviewSha256 !== payload.authority.reviewSha256 || body.sourceManifestSha256 !== hash(stableJson(payload.authority.sources))) fail(409, 'The encrypted copy differs from the original retained review and source manifest.');
  }
  function rowIdentity(state, row, id, review = false) {
    const key = keyFor(state.target.value.engagement_id,id,review), v = row?.value, i = expectedIdentity(state);
    if (row?.pk !== key.pk || row.sk !== key.sk || !Number.isSafeInteger(row.revision) || row.revision < 1 || v?.object_type !== (review ? 'engagement_offline_renewal_review' : 'engagement_offline_renewal') || !['active',...(review?['consumed']:[])].includes(v.status) || v.id !== id || v.actor_id !== i.userId || v.issuer !== i.issuer || v.subject !== i.subject || v.engagement_id !== i.engagementId || v.project_id !== i.projectId || v.account_id !== i.accountId || v.workspace_id !== i.workspaceId) fail(403, 'This access review belongs to another verified practitioner or engagement.');
    return v;
  }
  function identityValue(state, id, review = false) {
    const i = expectedIdentity(state);
    return {object_type:review?'engagement_offline_renewal_review':'engagement_offline_renewal',status:'active',id,actor_id:i.userId,issuer:i.issuer,subject:i.subject,engagement_id:i.engagementId,project_id:i.projectId,account_id:i.accountId,workspace_id:i.workspaceId};
  }
  async function readImmutable(state, id, manifest, pinned = true) {
    assertManifest(state,id,manifest,pinned);
    if (manifest.sizeBytes > maxBytes) fail(413, 'An access renewal exceeds its one MiB metadata bound.');
    const saved = await objects.read(manifest);
    if (!(saved.bytes instanceof Uint8Array) || saved.bytes.length !== manifest.sizeBytes || hash(saved.bytes) !== manifest.sha256 || saved.sha256 !== manifest.sha256 || saved.sizeBytes !== manifest.sizeBytes || saved.contentType !== manifest.contentType || typeof saved.versionId !== 'string' || !saved.versionId || saved.versionId === 'null' || pinned && saved.versionId !== manifest.versionId) fail(409, 'The retained access renewal differs from its immutable bytes.');
    let proof;try {proof=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(saved.bytes));} catch {fail(409,'The retained access renewal must be complete UTF-8 JSON.');}
    if (manifest.dataClassification !== proof?.sensitivity) fail(409,'The access renewal classification changed.');
    return {proof, manifest:{...manifest,versionId:saved.versionId}};
  }
  async function validateProof(state, payload, proof, {historical=false}={}) {
    if (!exact(proof,proofKeys) || proof.format !== 'esia-authenticated-offline-assessment-renewal' || proof.schemaVersion !== 1 || !uuidPattern.test(proof.id||'') || !uuidPattern.test(proof.packageId||'') || proof.previousRenewalId !== null && !uuidPattern.test(proof.previousRenewalId||'') || !sha(proof.sha256) || hash(stableJson(withoutSha(proof))) !== proof.sha256 || !canonicalDate(proof.issuedAt) || !canonicalDate(proof.expiresAt) || Date.parse(proof.issuedAt)>now() || Date.parse(proof.expiresAt)<=Date.parse(proof.issuedAt) || !historical && Date.parse(proof.expiresAt)<=now() || typeof proof.statement !== 'string' || proof.statement.trim().length<20 || proof.statement.length>4000 || !['confidential','restricted'].includes(proof.sensitivity) || !exact(proof.currentHead,['engagementRevision','configurationRevision','headRevision','headSha256']) || !['engagementRevision','configurationRevision','headRevision'].every(key=>Number.isSafeInteger(proof.currentHead[key])&&proof.currentHead[key]>0) || !sha(proof.currentHead.headSha256)) fail(409,'The access renewal is incomplete, changed or expired. Review current access again.');
    assertBindings(proof,payload);
    await checked(()=>assertAuthenticatedFieldIdentity(proof.identity,expectedIdentity(state)));
    if(stableJson(proof.identity)!==stableJson(payload.authority.identity)||stableJson(proof.selection)!==stableJson(payload.authority.selection)||proof.currentContext.revision!==proof.currentHead.engagementRevision||proof.currentContext.configurationRevision!==proof.currentHead.configurationRevision)fail(409,'The access renewal belongs to another prepared scope.');
    await checked(()=>assertAuthenticatedFieldContext(proof.currentContext,{expected:proof.identity,selection:proof.selection,crypto:webcrypto,now:historical?Date.parse(proof.issuedAt):now()}));
    if(Date.parse(proof.expiresAt)>Date.parse(proof.currentContext.deviceLease.expiresAt)||!Array.isArray(proof.sourceAuthorizations)||proof.sourceAuthorizations.length!==payload.authority.sources.length)fail(409,'The access renewal exceeds its exact device or source scope.');
    for(const [index,a] of proof.sourceAuthorizations.entries()){
      const source=payload.authority.sources[index], fields=['key','sha256','size','sensitivity',...(source.kind==='policy'?['frameworkId','edition','sourcePackSha256','entitlementRevision','expiresAt']:[])];
      if(!exact(a,fields)||['key','sha256','size'].some(key=>a[key]!==source[key])||!['internal','confidential','restricted'].includes(a.sensitivity)||source.sensitivity==='restricted'&&a.sensitivity!=='restricted'||proof.sensitivity==='confidential'&&a.sensitivity==='restricted')fail(409,'The renewal must retain every original source identity and its governed sensitivity.');
      if(source.kind==='policy'&&(['frameworkId','edition','sourcePackSha256'].some(key=>a[key]!==source[key])||!Number.isSafeInteger(a.entitlementRevision)||a.entitlementRevision<1||!canonicalDate(a.expiresAt)||Date.parse(proof.expiresAt)>Date.parse(a.expiresAt)))fail(409,'The renewal needs exact independent policy original permissions.');
    }
    return proof;
  }
  async function currentRenewal(state,payload,id,{historical=false}={}){
    if(!uuidPattern.test(id||''))fail(400,'Use an exact retained access-renewal UUID.');
    const key=keyFor(state.target.value.engagement_id,id),row=await get(state.auth.ctx,key.pk,key.sk),v=rowIdentity(state,row,id);
    const {proof}=await readImmutable(state,id,v.payload);await validateProof(state,payload,proof,{historical});
    if(v.package_id!==proof.packageId||v.source_selection_id!==proof.sourceSelectionId||v.renewal_sha256!==proof.sha256||v.previous_renewal_id!==proof.previousRenewalId||!Number.isSafeInteger(v.chain_depth)||v.chain_depth<1||v.chain_depth>100)fail(409,'The canonical access renewal differs from its immutable scope.');
    return {row,proof};
  }
  async function recheckRenewal(state,payload,access){
    const row=await get(state.auth.ctx,access.row.pk,access.row.sk);rowIdentity(state,row,access.proof.id);
    if(stableJson(row)!==stableJson(access.row))fail(409,'The retained access renewal changed.');
    return selectedRights(state,payload,{access:access.proof});
  }
  async function selectionAndPredecessor(state,body){
    const selected=await currentSelection(state,body.sourceSelectionId,{historical:true});assertBindings(body,selected.payload);
    let depth=1;
    if(body.previousRenewalId){const previous=await currentRenewal(state,selected.payload,body.previousRenewalId,{historical:true});if(previous.proof.packageId!==body.packageId)fail(403,'The preceding renewal belongs to another encrypted copy.');depth=previous.row.value.chain_depth+1;}
    if(depth>100)fail(413,'This encrypted copy reached its explicit one hundred renewal history bound. Keep its retained work and prepare a new governed copy.');
    return {...selected,depth};
  }
  async function freshState(principal,engagementId,body,issuedAt){
    const initial=await authority(principal,engagementId),selected=await selectionAndPredecessor(initial,body);
    await currentSourceAccess(initial,selected.payload,body.leaseId);
    await rejectProtectedSelection(initial,selected.payload.authority.sources.filter(row=>row.kind==='project').map(row=>row.versionId));
    const prepared=await context(principal,engagementId),state=prepared.state;sameHead(initial,state);mergeAuthority(state.auth.ctx,initial.auth.ctx);
    await recheckSelectionRow(state,selected);
    const access=await currentSourceAccess(state,selected.payload,body.leaseId);prepared.result.selection=clone(selected.payload.authority.selection);
    const currentContext=await checked(()=>createAuthenticatedFieldContext({context:prepared.result,leaseId:body.leaseId,leaseRevision:access.lease.proof.revision,deviceLease:access.lease.proof.deviceLease},{apiOrigin:selected.payload.authority.identity.apiOrigin,selection:selected.payload.authority.selection,crypto:webcrypto,now:Date.parse(issuedAt)}));
    const pins={headRevision:state.head.revision,headSha256:state.head.value.snapshot.sha256,configurationRevision:state.target.revision,sourceSha256:state.sourceSha256,sourceViewSha256:state.sourceViewSha256,projectRevision:state.projectRow.revision,contextSha256:hash(stableJson(currentContext)),sourceAccessSha256:hash(stableJson(access.sourceAuthorizations)),leaseId:body.leaseId,leaseRevision:access.lease.proof.revision,policySha256:access.lease.proof.policySha256,sensitivity:access.sensitivity};
    return {state,selected,access,currentContext,pins};
  }
  async function recheckSelectionRow(state,selected){
    const row=await get(state.auth.ctx,selected.row.pk,selected.row.sk);
    if(stableJson(row)!==stableJson(selected.row)||row?.value.status!=='active')fail(403,'This prepared source selection changed or was revoked.');
  }
  function inspection(body){return Object.fromEntries(bindings.map(key=>[key,body[key]]));}
  function reviewProof(body,fresh,at){
    const {selected,state,access}=fresh, expiresAt=new Date(Math.min(Date.parse(at)+120000,Date.parse(access.expiresAt))).toISOString();
    if(Date.parse(expiresAt)<=now())fail(409,'This access review expired. Start a new explicit review.');
    return sign({format:'esia-authenticated-offline-renewal-review',schemaVersion:1,id:body.request_id,...inspection(body),issuedAt:at,expiresAt,summary:{originalPreparedAt:selected.payload.authority.issuedAt,originalExpiresAt:selected.payload.authority.expiresAt,preparedRevision:selected.payload.authority.engagementRevision,currentRevision:state.head.value.core_revision,currentAccessExpiresAt:access.expiresAt,sensitivity:access.sensitivity,sourceCount:selected.payload.authority.sources.length,assessmentChanged:selected.payload.authority.headSha256!==state.head.value.snapshot.sha256||selected.payload.authority.configurationRevision!==state.target.revision}});
  }
  async function guardState(previous,selected,leaseId,accessProof,reviewRow){
    const state=await authority(previous.auth.principal,previous.target.value.engagement_id);sameHead(previous,state);await recheckSelectionRow(state,selected);
    if(accessProof)await recheckRenewal(state,selected.payload,accessProof);else await currentSourceAccess(state,selected.payload,leaseId);
    if(reviewRow){const current=await get(state.auth.ctx,reviewRow.pk,reviewRow.sk);if(stableJson(current)!==stableJson(reviewRow)||current?.value.status!=='active'||Date.parse(current.value.proof.expiresAt)<=now())fail(409,'This access review changed, expired or was consumed. Check current access again.');state.auth.ctx.authorityDeadlines.set(`offline-renewal-review:${current.value.id}`,Date.parse(current.value.proof.expiresAt));}
    mergeAuthority(previous.auth.ctx,state.auth.ctx);
  }
  async function engagementReviewOfflineRenewal(principal,engagementId,body){
    bodyOf(body,[]);
    // Read and authorize before reserving any persistent review identity.
    const before=await authority(principal,engagementId),selected=await selectionAndPredecessor(before,body);await currentSourceAccess(before,selected.payload,body.leaseId);
    const request=await reservation(principal,body.request_id,{engagementId,operation:'offline-assessment-renewal-review',leaseId:body.leaseId,...inspection(body)});
    const fresh=await freshState(principal,engagementId,body,request.value.at);sameHead(before,fresh.state);const proof=reviewProof(body,fresh,request.value.at),key=keyFor(engagementId,body.request_id,true),previous=await get(fresh.state.auth.ctx,key.pk,key.sk);
    let savedReview=previous;
    if(previous){const v=rowIdentity(fresh.state,previous,body.request_id,true);if(v.status!=='active'||stableJson(v.proof)!==stableJson(proof)||stableJson(v.pins)!==stableJson(fresh.pins))fail(409,'This access review changed or has already been used. Start a new explicit review.');}
    else{
      if(request.value.status==='promoted')fail(409,'The retained access review is unavailable.');
      const v={...identityValue(fresh.state,body.request_id,true),proof,pins:fresh.pins};if(Buffer.byteLength(JSON.stringify(v))>300*1024)fail(413,'The bounded access-review record is too large.');
      const active=await get(fresh.state.auth.ctx,request.pk,'PROFILE');if(active?.revision!==request.revision||active.value.status!=='pending')fail(409,'The access-review reservation changed.');
      savedReview=record(key.pk,key.sk,v);await commit(fresh.state.auth.ctx,[savedReview,record(request.pk,'PROFILE',{...active.value,status:'promoted',engagement_id:engagementId,offline_renewal_review_id:proof.id},active.revision+1)]);
    }
    if(previous)await commit(fresh.state.auth.ctx);
    const result={renewalReview:proof,currentContext:fresh.currentContext};await response(fresh.state,result,previous=>guardState(previous,fresh.selected,body.leaseId,null,savedReview));return result;
  }
  async function renewalResult(principal,engagementId,selected,access){
    const state=await authority(principal,engagementId);await recheckSelectionRow(state,selected);await recheckRenewal(state,selected.payload,access);
    await rejectProtectedSelection(state,selected.payload.authority.sources.filter(row=>row.kind==='project').map(row=>row.versionId));
    const result={renewal:clone(access.proof)};await response(state,result,previous=>guardState(previous,selected,access.proof.currentContext.leaseId,access));await commit(state.auth.ctx);return result;
  }
  async function engagementRenewOfflineAssessment(principal,engagementId,body){
    bodyOf(body,['currentReview','statement']);
    if(!exact(body.currentReview,['reviewId','reviewSha256'])||!uuidPattern.test(body.currentReview.reviewId||'')||!sha(body.currentReview.reviewSha256)||typeof body.statement!=='string'||body.statement.trim().length<20||body.statement.length>4000||body.statement!==body.statement.trim())fail(400,'Confirm the exact current access review and explain the renewal in at least twenty characters.');
    const initial=await authority(principal,engagementId),selected=await selectionAndPredecessor(initial,body);await currentSourceAccess(initial,selected.payload,body.leaseId);
    let request=await reservation(principal,body.request_id,{engagementId,operation:'renew-offline-assessment',leaseId:body.leaseId,...inspection(body),currentReview:body.currentReview,statement:body.statement});
    if(request.value.status==='promoted'){const saved=await currentRenewal(initial,selected.payload,body.request_id);if(saved.proof.packageId!==body.packageId)fail(409,'This renewal identifies another encrypted copy.');return renewalResult(principal,engagementId,selected,saved);}
    const reviewKey=keyFor(engagementId,body.currentReview.reviewId,true),reviewRow=await get(initial.auth.ctx,reviewKey.pk,reviewKey.sk),review=rowIdentity(initial,reviewRow,body.currentReview.reviewId,true);
    if(review.status!=='active'||review.proof.sha256!==body.currentReview.reviewSha256||hash(stableJson(withoutSha(review.proof)))!==review.proof.sha256||bindings.some(key=>review.proof[key]!==body[key])||Date.parse(review.proof.expiresAt)<=now()||review.pins.leaseId!==body.leaseId)fail(409,'The current access review changed or expired. Review it again.');
    const fresh=await freshState(principal,engagementId,body,review.proof.issuedAt);sameHead(initial,fresh.state);
    if(stableJson(review.pins)!==stableJson(fresh.pins))fail(409,'The assessment, sources or device rules changed after the current access review. Review them again.');
    let proof,manifest;
    if(request.value.offlineRenewalCandidate){
      const recovered=await readImmutable(fresh.state,body.request_id,request.value.offlineRenewalCandidate,false).catch(error=>{if(error.statusCode===404)fail(409,'Renewal stopped before its permission bytes were retained. Keep the encrypted copy and start a new explicit review.');throw error;});proof=recovered.proof;manifest=recovered.manifest;
      if(bindings.some(key=>proof[key]!==body[key])||proof.statement!==body.statement||stableJson(proof.currentContext)!==stableJson(fresh.currentContext))fail(409,'The pending renewal candidate differs from this reviewed copy.');
    }else{
      proof=sign({format:'esia-authenticated-offline-assessment-renewal',schemaVersion:1,id:body.request_id,...inspection(body),identity:clone(selected.payload.authority.identity),selection:clone(selected.payload.authority.selection),sensitivity:fresh.access.sensitivity,currentContext:fresh.currentContext,currentHead:{engagementRevision:fresh.state.head.value.core_revision,configurationRevision:fresh.state.target.revision,headRevision:fresh.state.head.revision,headSha256:fresh.state.head.value.snapshot.sha256},issuedAt:request.value.at,expiresAt:fresh.access.expiresAt,sourceAuthorizations:fresh.access.sourceAuthorizations,statement:body.statement});
      const bytes=Buffer.from(JSON.stringify(proof));if(bytes.length>maxBytes)fail(413,'This access renewal exceeds its one MiB bound.');
      const description=selectionManifest(fresh.state,body.request_id,bytes,proof.sensitivity),staging=await authority(principal,engagementId);sameHead(fresh.state,staging);await recheckSelectionRow(staging,selected);await selectedRights(staging,selected.payload,{access:proof});mergeAuthority(staging.auth.ctx,fresh.state.auth.ctx);
      const active=await get(staging.auth.ctx,request.pk,'PROFILE');if(active?.revision!==request.revision||active.value.status!=='pending')fail(409,'The renewal reservation changed.');
      request=record(request.pk,'PROFILE',{...active.value,offlineRenewalCandidate:description},active.revision+1);await commit(staging.auth.ctx,[request]);
      const saved=await objects.write({...description,bytes});if(saved.sha256!==description.sha256||saved.sizeBytes!==description.sizeBytes||saved.contentType!==description.contentType||typeof saved.versionId!=='string'||!saved.versionId||saved.versionId==='null')fail(409,'The access renewal has no exact immutable receipt.');manifest={...description,versionId:saved.versionId};
    }
    await validateProof(fresh.state,selected.payload,proof);await selectedRights(fresh.state,selected.payload,{access:proof});
    const current=await authority(principal,engagementId);sameHead(fresh.state,current);await recheckSelectionRow(current,selected);await selectedRights(current,selected.payload,{access:proof});mergeAuthority(current.auth.ctx,fresh.state.auth.ctx);
    const finalReview=await get(current.auth.ctx,reviewKey.pk,reviewKey.sk);if(stableJson(finalReview)!==stableJson(reviewRow)||Date.parse(review.proof.expiresAt)<=now())fail(409,'This current access review changed before renewal was saved.');
    const active=await get(current.auth.ctx,request.pk,'PROFILE');if(active?.revision!==request.revision||active.value.status!=='pending')fail(409,'The renewal request changed before promotion.');
    const key=keyFor(engagementId,body.request_id);if(await get(current.auth.ctx,key.pk,key.sk))fail(409,'This access-renewal identity is already retained.');
    const row=record(key.pk,key.sk,{...identityValue(current,body.request_id),package_id:body.packageId,source_selection_id:body.sourceSelectionId,previous_renewal_id:body.previousRenewalId,renewal_sha256:proof.sha256,chain_depth:selected.depth,payload:manifest});
    await commit(current.auth.ctx,[row,record(reviewKey.pk,reviewKey.sk,{...review,status:'consumed',renewal_id:body.request_id,consumed_at:request.value.at},reviewRow.revision+1),record(request.pk,'PROFILE',{...active.value,status:'promoted',engagement_id:engagementId,offline_renewal_id:body.request_id},active.revision+1)]);
    return renewalResult(principal,engagementId,selected,{row,proof});
  }
  const unavailable=async()=>fail(503,'Customer offline renewal requires a separately qualified customer issuer and frontend adapter.');
  return {engagementReviewOfflineRenewal:unavailable,engagementRenewOfflineAssessment:unavailable,currentRenewal,recheckRenewal};
}
