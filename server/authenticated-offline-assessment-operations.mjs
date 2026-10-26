// Foreground preparation and reconciliation of one exact encrypted device copy.
// Selection IDs and cached device permissions never replace current authority.
import {createHash, webcrypto} from 'node:crypto';
import {createAuthenticatedFieldContext, assertAuthenticatedFieldContext, assertAuthenticatedFieldIdentity, normalizeAuthenticatedFieldSelection} from '../src/lib/authenticated-field-context.js';
import {authenticatedOfflineAssessmentLimits as limits, projectAuthenticatedOfflineAssessmentReview, validateAuthenticatedOfflineAuthority, setAuthenticatedOfflineDraft} from '../src/lib/authenticated-offline-assessment.js';
import {engagementLibraryEntitlementKey, validateEngagementLibraryEntitlement} from './engagement-library.mjs';
import {getFramework} from '../src/lib/framework-register.js';
import {protectedMonitoringSourceClosure, isProtectedMonitoringSource} from '../src/lib/monitoring-protection.js';
import {stableJson, uuidPattern} from '../src/lib/engagement-domain.js';
import {createAuthenticatedOfflineRenewalOperations} from './authenticated-offline-renewal.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const severity = {internal: 0, confidential: 1, restricted: 2};
const selectionBytes = 10 * 1024 * 1024;
const authors = {action: 'edit', requiredRoles: ['preparer', 'reviewer']};

export function createAuthenticatedOfflineAssessmentOperations(deps) {
  const {objects, storage, authority, leaseFor, context, load, assess, authorityView, response, sameHead, mergeAuthority, reservation, preparedObject, promotedWrites, get, commit, record, instant, fail, id, authOf, evaluate, getEngagement, libraryFor, libraryScope,authorizeSource} = deps;
  const now = () => instant().getTime();
  const selectionKey = (engagementId, selectionId) => {
    if (!uuidPattern.test(engagementId || '') || !uuidPattern.test(selectionId || '')) fail(400, 'Use exact engagement and prepared source-selection UUIDs.');
    return {pk: `ENGAGEMENT#${engagementId}`, sk: `OFFLINE_SELECTION#${selectionId}`};
  };
  const expectedIdentity = state => ({issuer: state.auth.principal.issuer, subject: state.auth.principal.subject, userId: state.auth.userId, accountId: state.target.value.account_id, workspaceId: state.target.value.workspace_id, projectId: state.target.value.project_id, engagementId: state.target.value.engagement_id});
  const checked = async work => {try {return await work();} catch (error) {if (Number.isInteger(error.statusCode)) throw error;if (Number.isInteger(error.status)) fail(error.status, error.message);fail(409, error.message);}};
  function bodyOf(body, fields) {if (!exact(body, fields)) fail(400, 'Use every exact supported offline-assessment request field.');}
  function requestOf(body) {
    if (!uuidPattern.test(body.request_id || '') || !uuidPattern.test(body.leaseId || '') || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1) fail(400, 'Use an exact request, current revision and server-issued field permission.');
  }
  function originOf(value) {
    let parsed;try {parsed = new URL(value);} catch {fail(400, 'Use an exact HTTPS or loopback API origin.');}
    if (typeof value !== 'string' || value.length > 2048 || parsed.origin !== value || parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) fail(400, 'Use an exact HTTPS or loopback API origin.');
    return value; // Routing label only; never used for provider I/O or authority.
  }
  function sensitivityOf(value) {if (!['confidential', 'restricted'].includes(value)) fail(403, 'The complete professional review is at least confidential. Prepare a device policy that permits its actual sensitivity.');return value;}
  const sourceName = value => typeof value === 'string' && value.length > 0 && value.length <= 180 && !/[\\/\x00-\x1f\x7f]/.test(value);
  function policySource(original, sensitivity = 'confidential') {
    const {policy, target, version, entitlement} = original;
    if (!getFramework(policy?.frameworkId) || policy.edition !== getFramework(policy.frameworkId).edition || !sha(policy.sourcePackSha256) || !sha(version?.sha256) || version.sha256 !== target?.sha256 || version.size !== target.size || !Number.isSafeInteger(target.size) || target.size < 1 || target.size > limits.sourceBytes || !sourceName(version.filename) || version.mediaType !== 'application/pdf' || !Number.isSafeInteger(entitlement?.revision) || entitlement.revision < 1 || !['source_preview', 'source_download'].every(action => entitlement.actions?.includes(action)) || !Number.isFinite(Date.parse(entitlement.expiresAt))) fail(409, 'The separately entitled policy original has an inconsistent immutable descriptor.');
    return {key: `policy:${policy.frameworkId}:${version.sha256}`, kind: 'policy', frameworkId: policy.frameworkId, edition: policy.edition, sourcePackSha256: policy.sourcePackSha256, sha256: version.sha256, size: target.size, filename: version.filename, mediaType: 'application/pdf', sensitivity, access: ['source_preview', 'source_download'], entitlementRevision: entitlement.revision, expiresAt: entitlement.expiresAt};
  }
  async function policyOriginal(state, frameworkId, sourceSha256) {return checked(() => libraryFor(state).originalDescriptor(libraryScope(state), frameworkId, sourceSha256, {actions: ['source_preview', 'source_download']}));}
  async function projectSource(state, engagement, versionId) {
    await rejectProtectedSelection(state,[versionId],{inspectSnapshot:false});await authorizeSource(state,versionId);
    const source = state.sources.get(versionId), version = engagement.sourceVersions.find(row => row.id === versionId);
    if (!source || !version || source.sha256 !== version.sha256 || source.sizeBytes !== version.size || source.contentType !== version.mediaType || !Number.isSafeInteger(version.size) || version.size < 1 || version.size > limits.projectSourceBytes || !sourceName(version.filename)) fail(403, 'Choose exact currently authorized project originals within the supported size and filename limits.');
    const document = await get(state.auth.ctx, `DOCUMENT#${id(version.resourceId)}`, 'PROFILE');
    const sensitivity = document?.value.data_classification ?? 'confidential';
    if (!Object.hasOwn(severity, sensitivity)) fail(403, 'The selected original needs a supported governed sensitivity.');
    return {description: {key: `project:${versionId}`, kind: 'project', versionId, resourceId: version.resourceId, sha256: version.sha256, size: version.size, filename: version.filename, mediaType: version.mediaType, sensitivity}, protected: {kind: 'project', versionId, resourceId: version.resourceId, sensitivity, target: clone(source)}};
  }
  async function rejectProtectedSelection(state, versionIds,{inspectSnapshot=true}={}) {
    if (!versionIds.length) return;
    const privateHashes=new Set((state.caseSourceRegistry?.value.bindings||[]).map(row=>row.sourceSha256));for(const versionId of versionIds)if(privateHashes.has(state.sources.get(versionId)?.sha256))fail(403,'Protected case originals cannot be copied into a general offline assessment, including byte aliases and pending case reservations.');
    if(!inspectSnapshot)return;
    const target = state.head.value.snapshot, retained = await objects.read(target);
    if (!(retained.bytes instanceof Uint8Array) || retained.bytes.length !== target.sizeBytes || hash(retained.bytes) !== target.sha256 || retained.versionId !== target.versionId) fail(409, 'The retained assessment differs from its exact protected-source inventory.');
    let envelope;try {envelope = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(retained.bytes));} catch {fail(409, 'The protected-source inventory must remain complete UTF-8 assessment data.');}
    const pack = envelope?.packages?.[0];
    if (envelope.format !== 'esia-authenticated-engagement-state' || envelope.schemaVersion !== 1 || envelope.packages.length !== 1 || pack.engagement?.id !== state.target.value.engagement_id || envelope.sourceSha256 !== state.sourceSha256) fail(409, 'The protected-source inventory belongs to another retained assessment head.');
    const sourceVersions = (state.project.resources || []).flatMap(resource => resource.versions.map(version => ({...version, resourceId: resource.id})));
    const closure = protectedMonitoringSourceClosure({...pack.engagement, ...pack.entities, sourceVersions});
    for (const versionId of versionIds) if (isProtectedMonitoringSource({versionId, sha256: state.sources.get(versionId)?.sha256}, closure)) fail(403, 'Protected case originals require their own authorized case workflow and cannot be copied into a general offline assessment.');
  }
  function selectionManifest(state, selectionId, bytes, sensitivity) {return {kind: 'selection', bucket: storage.forAccount(state.project.accountId).bucket, key: `tenants/${state.project.accountId}/projects/${state.project.id}/engagements/${state.target.value.engagement_id}/offline-selections/${selectionId}.json`, sha256: hash(bytes), sizeBytes: bytes.length, contentType: 'application/json', dataClassification: sensitivity};}
  function assertManifest(state, selectionId, value, pinned = true) {
    const fields = ['kind', 'bucket', 'key', 'sha256', 'sizeBytes', 'contentType', 'dataClassification', ...(pinned ? ['versionId'] : [])];
    const expected = selectionManifest(state, selectionId, Buffer.from('x'), 'confidential');
    if (!exact(value, fields) || ['kind', 'bucket', 'key', 'contentType'].some(key => value[key] !== expected[key]) || !['confidential', 'restricted'].includes(value.dataClassification) || !sha(value.sha256) || !Number.isSafeInteger(value.sizeBytes) || value.sizeBytes < 1 || value.sizeBytes > selectionBytes || pinned && (typeof value.versionId !== 'string' || !value.versionId || value.versionId === 'null' || value.versionId.length > 500 || /[\x00-\x1f\x7f]/.test(value.versionId))) fail(409, 'The prepared review object differs from its exact immutable account and engagement scope.');
  }
  async function readPayload(state, selectionId, manifest, pinned = true) {
    assertManifest(state, selectionId, manifest, pinned);
    const retained = await objects.read(manifest);
    if (!(retained.bytes instanceof Uint8Array) || retained.bytes.length !== manifest.sizeBytes || hash(retained.bytes) !== manifest.sha256 || retained.sha256 !== manifest.sha256 || retained.sizeBytes !== manifest.sizeBytes || retained.contentType !== manifest.contentType || typeof retained.versionId !== 'string' || !retained.versionId || pinned && retained.versionId !== manifest.versionId) fail(409, 'The prepared review bytes differ from their exact retained object.');
    let payload;try {payload = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(retained.bytes));} catch {fail(409, 'The complete prepared review must remain valid UTF-8 JSON.');}
    if (manifest.dataClassification !== payload?.authority?.sensitivity) fail(409, 'The retained selection storage classification differs from the complete professional review sensitivity.');
    return {payload, manifest: {...manifest, versionId: retained.versionId}};
  }
  function syntheticEngagement(payload) {
    const a = payload.authority;
    return {...payload.review.engagement, sourceVersions: a.sources.filter(row => row.kind === 'project').map(row => ({...row, id: row.versionId})), serverAuthority: {...a.identity, configurationRevision: a.configurationRevision, headRevision: a.headRevision, headSha256: a.headSha256}};
  }
  async function validatePayload(state, selectionId, payload, {historical = false} = {}) {
    if (!exact(payload, ['format', 'schemaVersion', 'context', 'authority', 'review', 'policyContexts', 'protectedSources', 'preparationPin']) || payload.format !== 'esia-authenticated-offline-selection' || payload.schemaVersion !== 1 || payload.authority?.id !== selectionId || !Array.isArray(payload.protectedSources) || payload.protectedSources.length !== payload.authority.sources?.length || hash(stableJson(payload.review)) !== payload.authority.reviewSha256 || Buffer.byteLength(JSON.stringify({context: payload.context, authority: payload.authority, review: payload.review, policyContexts: payload.policyContexts})) > limits.metadataBytes) fail(409, 'The complete retained source selection or common review changed.');
    const validationTime = historical ? Date.parse(payload.authority.issuedAt) : now();
    if (!Number.isFinite(validationTime) || validationTime > now()) fail(409, 'The original preparation time must be a valid retained past instant.');
    await checked(() => assertAuthenticatedFieldContext(payload.context, {expected: expectedIdentity(state), crypto: webcrypto, now: validationTime}));
    await checked(() => validateAuthenticatedOfflineAuthority(payload.authority, payload.context, syntheticEngagement(payload), {now: validationTime, policyContexts: payload.policyContexts}));
    if (payload.authority.sensitivity !== sensitivityOf(payload.authority.sensitivity) || stableJson(payload.review.policyContexts) !== stableJson(payload.policyContexts)) fail(409, 'The retained complete-review sensitivity or independent policy contexts changed.');
    if (!exact(payload.preparationPin, ['sourceSha256', 'sourceViewSha256', 'projectConfigurationRevision']) || !sha(payload.preparationPin.sourceSha256) || !sha(payload.preparationPin.sourceViewSha256) || !Number.isSafeInteger(payload.preparationPin.projectConfigurationRevision) || payload.preparationPin.projectConfigurationRevision !== payload.context.uploadProject.revision) fail(409, 'Retain the exact source-view and project-configuration preparation pins.');
    for (const name of ['requirements', 'assertions', 'currentFindings', 'priorFindings', 'actions', 'obligations']) if (!Array.isArray(payload.review[name]) || payload.review[name].length > 5000) fail(413, 'The complete prepared common-record review exceeds its explicit bound.');
  }
  async function currentSourceAccess(state, payload, leaseId) {
    const a = payload.authority, sourceAuthorizations = [];let sensitivity = a.sensitivity;
    await checked(() => assertAuthenticatedFieldIdentity(a.identity, expectedIdentity(state)));
    for (const [index, selected] of payload.protectedSources.entries()) {
      const description = a.sources[index];
      if (selected.kind === 'project') {
        await rejectProtectedSelection(state,[selected.versionId],{inspectSnapshot:false});await authorizeSource(state,selected.versionId);
        const current = state.sources.get(selected.versionId), document = await get(state.auth.ctx, `DOCUMENT#${id(selected.resourceId)}`, 'PROFILE'), classification = document?.value.data_classification ?? 'confidential';
        if (!exact(selected, ['kind', 'versionId', 'resourceId', 'sensitivity', 'target']) || description.kind !== 'project' || selected.versionId !== description.versionId || selected.resourceId !== description.resourceId || selected.sensitivity !== description.sensitivity || stableJson(current) !== stableJson(selected.target) || !Object.hasOwn(severity, classification)) fail(403, 'A selected original no longer matches its exact authorized source.');
        const governed = severity[classification] > severity[description.sensitivity] ? classification : description.sensitivity;
        if (severity[governed] > severity[sensitivity]) sensitivity = governed;
        sourceAuthorizations.push({key: description.key, sha256: description.sha256, size: description.size, sensitivity: governed});
      } else {
        if (!exact(selected, ['kind', 'original']) || description.kind !== 'policy' || stableJson(policySource(selected.original)) !== stableJson(description)) fail(409, 'The prepared policy original differs from its exact protected descriptor.');
        const scope = libraryScope(state), key = engagementLibraryEntitlementKey({...scope, frameworkId: description.frameworkId}), row = await get(state.auth.ctx, key.pk, key.sk);
        for (const action of ['source_preview', 'source_download']) await checked(() => validateEngagementLibraryEntitlement(row, {scope, frameworkId: description.frameworkId, action, sourcePackSha256: description.sourcePackSha256, sourceSha256s: [description.sha256], now: now()}));
        state.auth.ctx.authorityDeadlines.set(`offline-policy:${key.sk}`, Date.parse(row.value.expiresAt));
        sourceAuthorizations.push({key: description.key, sha256: description.sha256, size: description.size, sensitivity: description.sensitivity, frameworkId: description.frameworkId, edition: description.edition, sourcePackSha256: description.sourcePackSha256, entitlementRevision: row.revision, expiresAt: row.value.expiresAt});
      }
    }
    const lease = await leaseFor(state, leaseId, {sensitivity, includesOriginals: a.sources.length > 0});
    const expiry = Math.min(Date.parse(lease.proof.expiresAt), state.auth.principal.expiresAt, ...state.auth.ctx.authorityDeadlines.values());
    if (!Number.isFinite(expiry) || expiry <= now()) fail(403, 'Current source and device permissions must remain active.');
    return {lease, sourceAuthorizations, sensitivity, expiresAt: new Date(expiry).toISOString()};
  }
  async function selectedRights(state, payload, {preparedHead = false, exactPolicyRevision = false, access} = {}) {
    const a = payload.authority;
    await checked(() => assertAuthenticatedFieldIdentity(a.identity, expectedIdentity(state)));
    const activeExpiry = access?.expiresAt || a.expiresAt;
    if (Date.parse(activeExpiry) <= now()) fail(403, 'This prepared source selection expired. Keep its encrypted work and explicitly review current preparation rights.');
    state.auth.ctx.authorityDeadlines.set(`offline-selection:${a.id}`, Date.parse(activeExpiry));
    if (preparedHead && (a.configurationRevision !== state.target.revision || a.headRevision !== state.head.revision || a.headSha256 !== state.head.value.snapshot.sha256 || a.engagementRevision !== state.head.value.core_revision || payload.preparationPin.sourceSha256 !== state.sourceSha256 || payload.preparationPin.sourceViewSha256 !== state.sourceViewSha256 || payload.preparationPin.projectConfigurationRevision !== state.projectRow.revision)) fail(409, 'The engagement or source context changed after this source preparation. Start a new explicit selection against its current review.');
    const current = await currentSourceAccess(state, payload, access?.currentContext.leaseId || a.leaseId), lease = current.lease;
    if (access) {
      if (lease.proof.revision !== access.currentContext.leaseRevision || lease.proof.policySha256 !== access.currentContext.policySha256 || current.sensitivity !== access.sensitivity || stableJson(current.sourceAuthorizations) !== stableJson(access.sourceAuthorizations) || Date.parse(access.expiresAt) > Date.parse(current.expiresAt)) fail(409, 'Current source or device permissions changed after this access renewal. Review them again.');
    } else {
      if (lease.proof.revision !== a.leaseRevision || lease.proof.policySha256 !== a.policySha256) fail(409, 'The prepared source selection needs its exact current device permission and policy.');
      if (current.sensitivity !== a.sensitivity || current.sourceAuthorizations.some((row, index) => row.sensitivity !== a.sources[index].sensitivity)) fail(403, 'A selected original now requires a stronger governed classification. Review current access.');
      if (exactPolicyRevision && current.sourceAuthorizations.some((row, index) => a.sources[index].kind === 'policy' && (row.entitlementRevision !== a.sources[index].entitlementRevision || row.expiresAt !== a.sources[index].expiresAt))) fail(409, 'The independent policy original permissions changed during preparation.');
    }
    return lease;
  }
  function assertRow(state, selectionId, row) {
    const key = selectionKey(state.target.value.engagement_id, selectionId), value = row?.value, identity = expectedIdentity(state);
    if (row?.pk !== key.pk || row.sk !== key.sk || !Number.isSafeInteger(row.revision) || row.revision < 1 || !value || value.object_type !== 'engagement_offline_selection' || value.status !== 'active' || value.id !== selectionId || value.actor_id !== identity.userId || value.issuer !== identity.issuer || value.subject !== identity.subject || value.engagement_id !== identity.engagementId || value.project_id !== identity.projectId || value.account_id !== identity.accountId || value.workspace_id !== identity.workspaceId) fail(403, 'This prepared source selection belongs to another verified practitioner or engagement.');
    assertManifest(state, selectionId, value.payload);
  }
  async function currentSelection(state, selectionId, options) {
    const key = selectionKey(state.target.value.engagement_id, selectionId), row = await get(state.auth.ctx, key.pk, key.sk);assertRow(state, selectionId, row);
    const {payload} = await readPayload(state, selectionId, row.value.payload);await validatePayload(state, selectionId, payload, options);
    if (row.value.lease_id !== payload.authority.leaseId || row.value.expires_at !== payload.authority.expiresAt) fail(409, 'The canonical selected source permission differs from its retained device scope and expiry.');
    return {row, payload};
  }
  async function recheckSelection(state, row, payload, options) {
    const current = await get(state.auth.ctx, row.pk, row.sk);assertRow(state, payload.authority.id, current);
    if (stableJson(current) !== stableJson(row)) fail(409, 'The retained source selection changed. Reopen it before continuing.');
    return selectedRights(state, payload, options);
  }
  function guardFor(engagementId, row, payload, options) {
    return async previous => {const current = await authority(previous.auth.principal, engagementId);sameHead(previous, current);await recheckSelection(current, row, payload, options);mergeAuthority(previous.auth.ctx, current.auth.ctx);};
  }
  async function preparedResult(state, preparedContext, row, payload) {
    await recheckSelection(state, row, payload, {preparedHead: true, exactPolicyRevision: true});
    const result = {context: clone(payload.context), authority: clone(payload.authority), engagement: preparedContext.engagement, policyContexts: clone(payload.policyContexts)};
    await response(state, result, guardFor(state.target.value.engagement_id, row, payload, {preparedHead: true, exactPolicyRevision: true}));return result;
  }

  async function engagementPrepareOfflineAssessment(principal, engagementId, body) {
    bodyOf(body, ['request_id', 'expectedRevision', 'leaseId', 'apiOrigin', 'selection', 'projectVersionIds', 'policySources', 'sensitivity']);requestOf(body);originOf(body.apiOrigin);sensitivityOf(body.sensitivity);
    const selection = await checked(() => normalizeAuthenticatedFieldSelection(body.selection));
    if (!Array.isArray(body.projectVersionIds) || body.projectVersionIds.length > limits.projectSources || new Set(body.projectVersionIds).size !== body.projectVersionIds.length || !Array.isArray(body.policySources) || body.policySources.length > limits.policySources || body.policySources.some(row => !exact(row, ['frameworkId', 'sha256']) || !getFramework(row.frameworkId) || !sha(row.sha256)) || new Set(body.policySources.map(row => `${row.frameworkId}:${row.sha256}`)).size !== body.policySources.length) fail(400, 'Explicitly select distinct bounded project versions and exact independent policy sources.');
    body.projectVersionIds.forEach(value => id(value));
    const initial = await authority(principal, engagementId);await leaseFor(initial, body.leaseId, {sensitivity: body.sensitivity, includesOriginals: body.projectVersionIds.length + body.policySources.length > 0});
    for (const versionId of body.projectVersionIds) if (!initial.sources.has(versionId)) fail(403, 'Select only exact project versions authorized for this engagement.');
    await rejectProtectedSelection(initial, body.projectVersionIds);
    let request = await reservation(principal, body.request_id, {engagementId, operation: 'prepare-offline-assessment', ...Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'request_id'))});
    const prepared = await context(principal, engagementId), state = prepared.state;sameHead(initial, state);
    const key = selectionKey(engagementId, body.request_id);
    if (request.value.status === 'promoted') {const saved = await currentSelection(state, body.request_id);const result = await preparedResult(state, prepared.result, saved.row, saved.payload);await commit(state.auth.ctx);return result;}
    if (prepared.result.engagement.revision !== body.expectedRevision) fail(409, 'The engagement changed. Review its current assessment before preparing this exact source selection.');
    let payload, manifest;
    if (request.value.offlineSelectionCandidate) {
      const recovered = await readPayload(state, body.request_id, request.value.offlineSelectionCandidate, false).catch(error => {if (error.statusCode === 404) fail(409, 'Preparation stopped before its selected review bytes were retained. Start a new explicit preparation request.');throw error;});
      payload = recovered.payload;manifest = recovered.manifest;await validatePayload(state, body.request_id, payload);await selectedRights(state, payload, {preparedHead: true, exactPolicyRevision: true});
    } else {
      const lease = await leaseFor(state, body.leaseId, {sensitivity: body.sensitivity, includesOriginals: body.projectVersionIds.length + body.policySources.length > 0});
      prepared.result.selection = selection;
      const clientContext = await checked(() => createAuthenticatedFieldContext({context: prepared.result, leaseId: body.leaseId, leaseRevision: lease.proof.revision, deviceLease: lease.proof.deviceLease,...(lease.proof.caseScope?{caseScope:lease.proof.caseScope}:{})}, {apiOrigin: body.apiOrigin, selection, crypto: webcrypto, now: Date.parse(request.value.at)}));
      const sources = [], protectedSources = [], contexts = new Map();let total = 0;
      for (const versionId of body.projectVersionIds) {const original = await projectSource(state, prepared.result.engagement, versionId);sources.push(original.description);protectedSources.push(original.protected);}
      for (const selected of body.policySources) {const original = await policyOriginal(state, selected.frameworkId, selected.sha256), description = policySource(original);sources.push(description);protectedSources.push({kind: 'policy', original: clone(original)});const key = `${description.frameworkId}:${description.sourcePackSha256}`;if (!contexts.has(key)) contexts.set(key, {frameworkId: description.frameworkId, edition: description.edition, sourcePackSha256: description.sourcePackSha256, sourceHashes: []});contexts.get(key).sourceHashes.push(description.sha256);}
      for (const source of sources) {total += source.size;if (severity[source.sensitivity] > severity[body.sensitivity]) fail(403, 'The complete package sensitivity must include every selected original.');}
      if (total > limits.totalSourceBytes) fail(413, 'Select original bytes within the 64 MiB combined preparation limit.');
      const policyContexts = [...contexts.values()], review = await checked(() => projectAuthenticatedOfflineAssessmentReview(prepared.result.engagement, clientContext, sources, policyContexts));
      const expiry = Math.min(Date.parse(lease.proof.expiresAt), principal.expiresAt, ...state.auth.ctx.authorityDeadlines.values(), ...sources.filter(row => row.kind === 'policy').map(row => Date.parse(row.expiresAt)));
      if (!Number.isFinite(expiry) || expiry <= now()) fail(403, 'The current source and device permissions expire before this preparation can complete.');
      const a = prepared.result.engagement.serverAuthority;
      const preparedAuthority = {format: 'esia-authenticated-offline-assessment-authority', schemaVersion: 1, id: body.request_id, identity: clone(clientContext.identity), selection: clone(selection), leaseId: body.leaseId, leaseRevision: lease.proof.revision, engagementRevision: body.expectedRevision, configurationRevision: a.configurationRevision, headRevision: a.headRevision, headSha256: a.headSha256, reviewSha256: hash(stableJson(review)), policySha256: clientContext.policySha256, sensitivity: body.sensitivity, issuedAt: request.value.at, expiresAt: new Date(expiry).toISOString(), sources};
      payload = {format: 'esia-authenticated-offline-selection', schemaVersion: 1, context: clientContext, authority: preparedAuthority, review, policyContexts, protectedSources, preparationPin: {sourceSha256: state.sourceSha256, sourceViewSha256: state.sourceViewSha256, projectConfigurationRevision: state.projectRow.revision}};await validatePayload(state, body.request_id, payload);
      const bytes = Buffer.from(JSON.stringify(payload));if (bytes.length > selectionBytes) fail(413, 'The complete prepared selection exceeds its 10 MiB immutable metadata object limit.');
      const description = selectionManifest(state, body.request_id, bytes, payload.authority.sensitivity), staging = await authority(principal, engagementId);sameHead(state, staging);await selectedRights(staging, payload, {preparedHead: true, exactPolicyRevision: true});mergeAuthority(staging.auth.ctx, state.auth.ctx);
      const active = await get(staging.auth.ctx, request.pk, 'PROFILE');if (active?.revision !== request.revision || active.value.status !== 'pending') fail(409, 'The preparation reservation changed before retaining its exact review.');
      request = record(request.pk, 'PROFILE', {...active.value, offlineSelectionCandidate: description}, active.revision + 1);await commit(staging.auth.ctx, [request]);
      const receipt = await objects.write({...description, bytes});
      if (receipt.sha256 !== description.sha256 || receipt.sizeBytes !== description.sizeBytes || receipt.contentType !== description.contentType || typeof receipt.versionId !== 'string' || !receipt.versionId || receipt.versionId === 'null') fail(409, 'The retained selected review has no exact immutable provider receipt.');
      manifest = {...description, versionId: receipt.versionId};
    }
    const current = await authority(principal, engagementId);sameHead(state, current);await selectedRights(current, payload, {preparedHead: true, exactPolicyRevision: true});mergeAuthority(current.auth.ctx, state.auth.ctx);
    if (await get(current.auth.ctx, key.pk, key.sk)) fail(409, 'This prepared source-selection identity is already retained. Reopen its acknowledged result.');
    const active = await get(current.auth.ctx, request.pk, 'PROFILE');if (active?.revision !== request.revision || active.value.status !== 'pending') fail(409, 'The preparation reservation changed before promotion.');
    const i = expectedIdentity(current), row = record(key.pk, key.sk, {object_type: 'engagement_offline_selection', schemaVersion: 1, id: body.request_id, status: 'active', actor_id: i.userId, issuer: i.issuer, subject: i.subject, engagement_id: i.engagementId, project_id: i.projectId, account_id: i.accountId, workspace_id: i.workspaceId, lease_id: payload.authority.leaseId, expires_at: payload.authority.expiresAt, payload: manifest});
    await commit(current.auth.ctx, [row, record(request.pk, 'PROFILE', {...active.value, status: 'promoted', engagement_id: engagementId, offline_selection_id: body.request_id}, active.revision + 1)]);
    const final = await context(principal, engagementId);sameHead(current, final.state);const result = await preparedResult(final.state, final.result, row, payload);await commit(final.state.auth.ctx);return result;
  }

  function commandScope(payload, engagement, command) {
    if (!['finding-save', 'action-save'].includes(command?.type)) fail(400, 'Reconcile only common human finding drafts or open action drafts.');
    const review = payload.review, cycleId = payload.context.selection.cycleId || '', requirements = new Set(review.requirements.map(row => row.id));
    const closure = protectedMonitoringSourceClosure(engagement);
    if (payload.authority.sources.some(source => source.kind === 'project' && isProtectedMonitoringSource(source, closure))) fail(403, 'A prepared original now belongs to a protected case. Keep its encrypted work and use the separately authorized case workflow.');
    if ((command.cycleId || '') !== cycleId) fail(403, 'This offline draft belongs to another prepared reporting scope.');
    if (command.type === 'finding-save') {
      const before = review.requirements.find(row => row.id === command.requirementId), current = engagement.requirements.find(row => row.id === command.requirementId);
      if (!before || stableJson(before) !== stableJson(current)) fail(409, 'The exact prepared requirement changed. Prepare current source context before reconciling this judgment.');
      for (const assertionId of [...(command.supportingAssertionIds || []), ...(command.contradictoryAssertionIds || [])]) {const before = review.assertions.find(row => row.id === assertionId), current = engagement.assertions.find(row => row.id === assertionId);if (!before || !current || ['id', 'versionId', 'sourceSha256', 'quote', 'locator'].some(key => before[key] !== current[key])) fail(409, 'Cite only unchanged exact passages from this prepared original selection.');}
    } else {
      for (const findingId of command.findingIds || []) {const finding = engagement.findings.find(row => row.id === findingId);if (!finding || !requirements.has(finding.requirementId) || (finding.cycleId || '') !== cycleId) fail(403, 'An offline action may link only findings in its prepared requirement and reporting scope.');}
      for (const actionId of command.dependencies || []) if (!engagement.actions.some(row => row.id === actionId && (row.cycleId || '') === cycleId)) fail(403, 'Action dependencies must stay in the same prepared reporting scope.');
      const owningCycle = engagement.cycles.find(row => row.id === cycleId && row.programId === payload.context.selection.programId);
      for (const obligationId of command.monitoringObligationIds || []) if (!owningCycle || !engagement.monitoringObligations.some(row => row.id === obligationId && row.programId === owningCycle.programId)) fail(403, 'Monitoring links must stay in the program that owns the selected prepared cycle.');
    }
    return checked(() => setAuthenticatedOfflineDraft({context: payload.context, review: {...review, currentFindings: engagement.findings.filter(row => (row.cycleId || '') === cycleId)}, draft: {record: {entries: []}}}, command, webcrypto));
  }
  async function recheckAccess(state, row, payload, renewal) {
    await recheckSelection(state, row, payload, renewal ? {access: renewal.proof} : undefined);
    if (renewal) await renewals.recheckRenewal(state, payload, renewal);
  }
  function commandGuard(engagementId, row, payload, renewal) {
    return async previous => {const current = await authority(previous.auth.principal, engagementId);sameHead(previous, current);await recheckAccess(current, row, payload, renewal);mergeAuthority(previous.auth.ctx, current.auth.ctx);};
  }
  async function commandResult(principal, engagementId, row, payload, receipt, renewal) {
    const view = await getEngagement(principal, engagementId), current = await authority(principal, engagementId);await recheckAccess(current, row, payload, renewal);
    if (view.serverAuthority.headSha256 !== current.head.value.snapshot.sha256) fail(409, 'The saved judgment changed before its acknowledgement opened. Reopen its current record.');
    const result = {...view, offlineReceipt: receipt};await response(current, result, commandGuard(engagementId, row, payload, renewal));await commit(current.auth.ctx);return result;
  }
  async function engagementOfflineAssessmentCommand(principal, engagementId, body) {
    bodyOf(body, ['request_id', 'expectedRevision', 'command', 'offlineOperation', 'leaseId', 'sourceSelectionId', ...(Object.hasOwn(body || {}, 'renewalId') ? ['renewalId'] : [])]);requestOf(body);
    if (Object.hasOwn(body, 'renewalId') && !uuidPattern.test(body.renewalId || '')) fail(400, 'Use the exact retained access-renewal UUID.');
    if (!exact(body.offlineOperation, ['id', 'sha256']) || body.offlineOperation.id !== body.request_id || !sha(body.offlineOperation.sha256) || hash(stableJson(body.command)) !== body.offlineOperation.sha256 || !uuidPattern.test(body.sourceSelectionId || '')) fail(400, 'Retain the exact identified offline command bytes and operation UUID.');
    const initial = await authority(principal, engagementId), selected = await currentSelection(initial, body.sourceSelectionId, body.renewalId ? {historical: true} : undefined);
    const renewal = body.renewalId ? await renewals.currentRenewal(initial, selected.payload, body.renewalId) : null;
    if (body.leaseId !== selected.payload.authority.leaseId) fail(403, 'This command selects another prepared device permission.');
    await recheckAccess(initial, selected.row, selected.payload, renewal);
    await rejectProtectedSelection(initial, selected.payload.authority.sources.filter(row => row.kind === 'project').map(row => row.versionId));
    const request = await reservation(principal, body.request_id, {engagementId, operation: 'offline-assessment-command', expectedRevision: body.expectedRevision, command: body.command, offlineOperation: body.offlineOperation, leaseId: body.leaseId, sourceSelectionId: body.sourceSelectionId});
    const state = await load(principal, engagementId, {...authors, input: body.command});sameHead(initial, state);state.fieldPolicies = initial.fieldPolicies;
    const view = assess(state, {operation: 'get', engagementId}).result;
    // A promoted reservation already pins the exact original command. Let the
    // common engine recover its real retained marker/history; later edits must
    // not turn a lost acknowledgement into a fresh target or another mutation.
    if (request.value.status !== 'promoted') await commandScope(selected.payload, view, body.command);
    const lease = await recheckSelection(state, selected.row, selected.payload, renewal ? {access: renewal.proof} : undefined);
    if (renewal) await renewals.recheckRenewal(state, selected.payload, renewal);
    const evaluated = await checked(() => evaluate({project: state.project, packages: state.packages, originals: state.originals, retainedSourceProof:state.retainedSourceProof,originArchives: state.originArchives || new Map(), actorId: state.auth.userId, authority: authOf(state.auth), currentTime: now(), execution: {requestId: body.request_id, at: request.value.at}, input: {operation: 'command', engagementId, expectedRevision: body.expectedRevision, command: body.command}, commandOptions: {offlineOperation: {...body.offlineOperation, deviceLease: lease.proof.deviceLease}, authenticatedOfflineLease: {format: 'esia-authenticated-offline-lease', schemaVersion: 1, issuer: principal.issuer, subject: principal.subject, sensitivity: renewal?.proof.sensitivity || selected.payload.authority.sensitivity, includesOriginals: selected.payload.authority.sources.length > 0, lease: lease.proof}}}));
    if (!evaluated.result.offlineReceipt?.acknowledged) fail(409, 'The common engine returned no exact retained offline draft acknowledgement.');
    const unchanged = evaluated.packages[0].engagement.revision === state.packages[0].engagement.revision;
    if (request.value.status === 'promoted' && !unchanged) fail(409, 'The promoted offline request has no matching retained judgment.');
    const prepared = unchanged ? null : await preparedObject(state, evaluated, request), current = await authority(principal, engagementId);sameHead(state, current);await recheckAccess(current, selected.row, selected.payload, renewal);mergeAuthority(current.auth.ctx, initial.auth.ctx);mergeAuthority(current.auth.ctx, state.auth.ctx);
    if (request.value.status === 'promoted') await commit(current.auth.ctx);
    else if (unchanged) {const active = await get(current.auth.ctx, request.pk, 'PROFILE');if (active?.revision !== request.revision || active.value.status !== 'pending') fail(409, 'This offline acknowledgement changed.');await commit(current.auth.ctx, [record(request.pk, 'PROFILE', {...active.value, status: 'promoted', engagement_id: engagementId, head_revision: current.head.revision, snapshot: current.head.value.snapshot}, active.revision + 1)]);}
    else await commit(current.auth.ctx, await promotedWrites(current.auth, current, prepared, request));
    return commandResult(principal, engagementId, selected.row, selected.payload, evaluated.result.offlineReceipt, renewal);
  }

  async function engagementOfflineSourceOptions(principal, engagementId, body) {
    bodyOf(body, ['leaseId', 'frameworkId']);if (!uuidPattern.test(body.leaseId || '') || !getFramework(body.frameworkId)) fail(400, 'Select an exact field permission and known policy framework.');
    const before = await authority(principal, engagementId);await leaseFor(before, body.leaseId, {sensitivity: 'confidential', includesOriginals: true});
    const options = await checked(() => libraryFor(before).originalOptions(libraryScope(before), body.frameworkId));
    const describe = values => values.map(original => ({...policySource(original), ...(original.policy.title ? {title: String(original.policy.title).slice(0, 4000)} : {})}));
    if (!Array.isArray(options) || options.length > limits.policySources) fail(413, 'The independent policy original options exceed the explicit selection bound.');
    const current = await authority(principal, engagementId);sameHead(before, current);await leaseFor(current, body.leaseId, {sensitivity: 'confidential', includesOriginals: true});
    const after = await checked(() => libraryFor(current).originalOptions(libraryScope(current), body.frameworkId));if (stableJson(options) !== stableJson(after)) fail(409, 'Independent policy original permissions changed while their options opened.');mergeAuthority(current.auth.ctx, before.auth.ctx);
    const result = {policySources: describe(options)};
    await response(current, result, async previous => {const fresh = await authority(previous.auth.principal, engagementId);sameHead(previous, fresh);await leaseFor(fresh, body.leaseId, {sensitivity: 'confidential', includesOriginals: true});if (stableJson(await libraryFor(fresh).originalOptions(libraryScope(fresh), body.frameworkId)) !== stableJson(options)) fail(409, 'The independent policy original options changed.');mergeAuthority(previous.auth.ctx, fresh.auth.ctx);});
    await commit(current.auth.ctx);return result;
  }
  async function engagementValidateOfflineAssessment(principal, engagementId, body) {
    bodyOf(body, ['sourceSelectionId', 'leaseId']);if (!uuidPattern.test(body.sourceSelectionId || '') || !uuidPattern.test(body.leaseId || '')) fail(400, 'Select the exact prepared source copy and current field permission.');
    const before = await authority(principal, engagementId), selected = await currentSelection(before, body.sourceSelectionId);
    if (selected.payload.authority.leaseId !== body.leaseId) fail(403, 'This validation belongs to another prepared device permission.');
    await selectedRights(before, selected.payload, {preparedHead: true, exactPolicyRevision: true});
    const current = await authority(principal, engagementId);sameHead(before, current);await recheckSelection(current, selected.row, selected.payload, {preparedHead: true, exactPolicyRevision: true});mergeAuthority(current.auth.ctx, before.auth.ctx);
    const result = {validated: true, sourceSelectionId: body.sourceSelectionId, reviewSha256: selected.payload.authority.reviewSha256, expiresAt: selected.payload.authority.expiresAt};
    await response(current, result, guardFor(engagementId, selected.row, selected.payload, {preparedHead: true, exactPolicyRevision: true}));await commit(current.auth.ctx);return result;
  }
  const renewals = createAuthenticatedOfflineRenewalOperations({...deps, authority, leaseFor, context, checked, expectedIdentity, currentSelection, recheckSelection, currentSourceAccess, selectedRights, rejectProtectedSelection, selectionManifest, assertManifest});
  const unavailable=async()=>deps.fail(503,'Customer offline preparation, reconciliation and renewal require a separately qualified customer issuer and frontend adapter. Online authenticated engagements remain available.');
  return {engagementPrepareOfflineAssessment:unavailable,engagementOfflineAssessmentCommand:unavailable,engagementOfflineSourceOptions:unavailable,engagementValidateOfflineAssessment:unavailable,engagementReviewOfflineRenewal:unavailable,engagementRenewOfflineAssessment:unavailable};
}
