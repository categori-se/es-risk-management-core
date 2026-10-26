import {getCognitoAuthConfig} from "./auth-config.js";
import {readPrivateDownload} from '@categori/app-connections-streams/download';
import {isEngagementJsonTransfer,readEngagementJsonTransfer} from './engagement-json-transfer.js';

const verifiedRecoveryContexts = new WeakMap();
const authSessionKey = "esia.auth.session.v1";
const originalIdentity = {region: "", userPoolId: "", clientId: ""};
const originalIssuer = `https://cognito-idp.${originalIdentity.region}.amazonaws.com/${originalIdentity.userPoolId}`;
const recoveryDeploymentPattern = /^aws:apigateway:(us-east-1):([a-z0-9]{1,64}):(\$default|[A-Za-z0-9_-]{1,128}):([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/;

export function isVerifiedEsiaRecoveryContext(value) {
  const current = value && typeof value === "object" ? verifiedRecoveryContexts.get(value) : null;
  if (!current) return false;
  try { current(); return true; } catch { return false; }
}

function frozenJson(value) {
  let nodes = 0;
  function copy(item, depth) {
    if (++nodes > 400_000 || depth > 64) throw new EsiaApiError(0, "The ESIA authority projection exceeds its structural bound.");
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (!item || typeof item !== "object" || ![Object.prototype, null, Array.prototype].includes(Object.getPrototypeOf(item))) throw new EsiaApiError(0, "The ESIA authority projection is not ordinary JSON.");
    const array = Array.isArray(item), descriptors = Object.getOwnPropertyDescriptors(item), output = array ? [] : {};
    for (const key of Reflect.ownKeys(descriptors)) {
      if (array && key === "length") continue;
      const descriptor = descriptors[key];
      if (typeof key !== "string" || !descriptor.enumerable || !Object.hasOwn(descriptor, "value") ||
          (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= item.length))) throw new EsiaApiError(0, "The ESIA authority projection is not ordinary JSON.");
      Object.defineProperty(output, key, {value: copy(descriptor.value, depth + 1), enumerable: true, writable: true, configurable: true});
    }
    if (array && output.length !== item.length) throw new EsiaApiError(0, "The ESIA authority projection contains a sparse array.");
    if (array) for (let index = 0; index < item.length; index++) if (!Object.hasOwn(output, index)) throw new EsiaApiError(0, "The ESIA authority projection contains a sparse array.");
    return Object.freeze(output);
  }
  return copy(value, 0);
}

export class EsiaApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function esiaApiBase(baseUrl = "", origin = globalThis.location?.origin) {
  const url = new URL(baseUrl || origin, origin);
  const sameOrigin = url.origin === origin;
  const gateway = /^https:\/\/[a-z0-9]+\.execute-api\.us-east-1\.amazonaws\.com$/.test(url.origin);
  if ((!sameOrigin && !gateway && url.origin !== "https://api.community.invalid") || url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) {
    throw new EsiaApiError(0, "The ESIA API origin is not configured.");
  }
  if (url.protocol !== "https:" && !(sameOrigin && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new EsiaApiError(0, "The ESIA API requires HTTPS.");
  return url.origin;
}

export function createEsiaApiClient({baseUrl = "", origin = globalThis.location?.origin, getSession, fetchImpl = globalThis.fetch, now = Date.now,cryptoImpl=globalThis.crypto,
  getAuthConfig = getCognitoAuthConfig, getSessionStorage}) {
  const base = esiaApiBase(baseUrl, origin);
  if (typeof getSession !== "function" || typeof fetchImpl !== "function") throw new Error("An authenticated session and transport are required.");
  const initialWindow = globalThis.window;
  const initialWindowOrigin = initialWindow?.location?.origin;
  const initialApiSetting = initialWindow?.ESIA_API_BASE_URL;
  // Nonbrowser transports have no ambient browser session. Fixtures can inject
  // storage explicitly; browser clients always bind their original stored auth.
  const sessionStorageAccess = getSessionStorage ?? (initialWindow ? () => globalThis.sessionStorage : () => undefined);
  let originalSessionContext = null;
  const configuration = () => {
    const current = getAuthConfig();
    if (!current || Object.keys(originalIdentity).some(name => current[name] !== originalIdentity[name])) throw new EsiaApiError(401, "The original ESIA sign-in configuration changed.");
    return JSON.stringify(current);
  };
  const originalConfiguration = configuration();
  const stale = () => { const error = new EsiaApiError(401, "The ESIA session or API changed. Its earlier response was ignored."); error.code = "STALE_REVIEW_CONTEXT"; return error; };
  function storedSession() {
    try {
      const storage = sessionStorageAccess();
      if (storage === undefined || storage === null) return {storage: null, raw: null};
      const raw = storage.getItem(authSessionKey);
      if (typeof raw !== "string" || raw.length > 256 * 1024) throw stale();
      return {storage, raw};
    } catch { throw stale(); }
  }
  const sessionFields = ["accessToken", "idToken", "refreshToken", "expiresAt"];
  function assertCaptured(captured) {
    const current = getSession(), stored = storedSession();
    if (current !== captured.session || sessionFields.some(name => current?.[name] !== captured.fields[name]) ||
        !Number.isFinite(current?.expiresAt) || current.expiresAt <= now() || configuration() !== originalConfiguration ||
        (initialWindow && (globalThis.window !== initialWindow || initialWindow.location?.origin !== initialWindowOrigin || initialWindow.ESIA_API_BASE_URL !== initialApiSetting)) ||
        stored.storage !== captured.stored.storage || stored.raw !== captured.stored.raw) throw stale();
    // Accessors and callbacks above can change the initiating session. Fence that final change too.
    if (getSession() !== captured.session || sessionFields.some(name => captured.session?.[name] !== captured.fields[name]) || captured.fields.expiresAt <= now()) throw stale();
  }
  function captureSession() {
    if (originalSessionContext) { assertCaptured(originalSessionContext); return originalSessionContext; }
    const session = getSession();
    if (!session?.accessToken || typeof session.accessToken !== "string" || !Number.isFinite(session.expiresAt) || session.expiresAt <= now()) throw new EsiaApiError(401, "Sign in again before accessing the ESIA workspace.");
    const captured = {session, fields: Object.fromEntries(sessionFields.map(name => [name, session[name]])), stored: storedSession()};
    if (captured.stored.storage) {
      let persisted;
      try { persisted = JSON.parse(captured.stored.raw); } catch { throw stale(); }
      if (!persisted || sessionFields.some(name => persisted[name] !== captured.fields[name])) throw stale();
    }
    assertCaptured(captured); originalSessionContext = captured; return captured;
  }
  function assertCurrentSession() { captureSession(); return true; }
  async function perform(path, {method = "GET", body, binary = false, signal} = {}) {
    if (typeof path !== "string" || !path.startsWith("/api/") || path.includes("#") || path.includes("\\") || path.includes("..")) throw new EsiaApiError(0, "Invalid ESIA API path.");
    if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");
    const captured = captureSession(), rawBody = body === undefined ? undefined : JSON.stringify(body);
    assertCaptured(captured);
    let response;
    try { response = await fetchImpl(`${base}${path}`, {method, credentials: "omit", redirect: "error", cache: "no-store", ...(signal ? {signal} : {}),
      headers: {authorization: `Bearer ${captured.fields.accessToken}`, ...(body === undefined ? {} : {"content-type": "application/json"})},
      ...(body === undefined ? {} : {body: rawBody})}); }
    catch (error) { assertCaptured(captured); throw error; }
    assertCaptured(captured);
    let result;
    if (response.ok && binary) {
      result = await response.blob();assertCaptured(captured);return {result, captured};
    }
    try { result = await response.json(); } catch { assertCaptured(captured); throw new EsiaApiError(response.status, "The authenticated ESIA API is unavailable at this origin."); }
    assertCaptured(captured);
    if (!response.ok) throw new EsiaApiError(response.status, result?.error || `ESIA request failed (${response.status}).`);
    return {result, captured};
  }
  async function request(path, options={}) {const {result,captured}=await perform(path,options);if(options.binary||!isEngagementJsonTransfer(result))return result;return readEngagementJsonTransfer({manifest:result,path,method:options.method||'GET',request:async(next,nextOptions)=>(await perform(next,nextOptions)).result,assertCurrent:()=>assertCaptured(captured),cryptoImpl,now,signal:options.signal,expectedIssuer:originalIssuer,expectedSubject:typeof captured.session.user?.sub==='string'?captured.session.user.sub:undefined});}
  const artifactPagePath = (projectId, after) => {
    const query = new URLSearchParams();
    if (projectId) query.set("project_id", projectId);
    if (after) query.set("after", after);
    return `/api/artifacts${query.size ? `?${query}` : ""}`;
  };
  async function artifacts(projectId, {signal, firstPage} = {}) {
    const captured = captureSession(), records = [], seen = new Set(), cursors = new Set();
    let page = firstPage, after = null, bytes = 0;
    const current = () => {assertCaptured(captured); if (signal?.aborted) throw new DOMException("The document list load was aborted.", "AbortError");};
    for (let count = 0; count < 250; count++) {
      current();
      page ??= await request(artifactPagePath(projectId, after), {signal});
      current();
      bytes += new TextEncoder().encode(JSON.stringify(page)).byteLength;
      if (!Array.isArray(page?.artifacts) || page.artifacts.length > 100 || bytes > 32 * 1024 * 1024) throw new EsiaApiError(0, "The document directory exceeds its page bounds.");
      for (const artifact of page.artifacts) {
        if (typeof artifact?.artifact_id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(artifact.artifact_id) || seen.has(artifact.artifact_id)) throw new EsiaApiError(0, "The document directory returned an invalid or repeated document.");
        seen.add(artifact.artifact_id); records.push(artifact);
      }
      if (records.length > 10000) throw new EsiaApiError(0, "The document directory exceeds its document limit.");
      if (page.next_cursor === null || page.next_cursor === undefined) return {artifacts: records, next_cursor: null};
      if (typeof page.next_cursor !== "string" || !/^[A-Za-z0-9_-]{1,2048}$/.test(page.next_cursor) || cursors.has(page.next_cursor)) throw new EsiaApiError(0, "The document directory returned an invalid or repeated page cursor.");
      cursors.add(page.next_cursor); after = page.next_cursor; page = null;
    }
    throw new EsiaApiError(0, "The document directory exceeded its page limit.");
  }
  async function completeSession(result, options = {}) {
    if (result?.sharedDocumentsNextCursor === null || result?.sharedDocumentsNextCursor === undefined) return result;
    const shared = await artifacts(undefined, {...options, firstPage: {artifacts: result.sharedDocuments, next_cursor: result.sharedDocumentsNextCursor}});
    return {...result, sharedDocuments: shared.artifacts, sharedDocumentsNextCursor: null};
  }
  async function requirementLibrary(projectId, frameworkId, {signal} = {}) {
    if (typeof projectId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(projectId) || projectId.includes("..") || typeof frameworkId !== "string" || !/^[A-Za-z0-9_]{1,100}$/.test(frameworkId)) throw new EsiaApiError(0, "An exact project and framework edition are required.");
    const captured = captureSession(), records = [], seen = new Set(), cursors = new Set();
    let after = null, manifest, identity, bytes = 0;
    const current = () => {assertCaptured(captured);if (signal?.aborted) throw new DOMException("The source library load was aborted.", "AbortError");};
    for (let pages = 0; pages < 30001; pages++) {
      current();
      const page = await request(`/api/projects/${encodeURIComponent(projectId)}/requirements/${encodeURIComponent(frameworkId)}${after ? `?after=${encodeURIComponent(after)}` : ""}`, {signal});
      current();
      const serialized = JSON.stringify(page), length = new TextEncoder().encode(serialized).byteLength;
      bytes += length;
      if (length > 1024 * 1024 || bytes > 64 * 1024 * 1024 || !page || page.frameworkId !== frameworkId || !page.parserVersion || typeof page.edition !== "string" || !Array.isArray(page.sources) || !Array.isArray(page.records) || page.records.length > 50 ||
          !Number.isSafeInteger(page.counts?.recordCount) || page.counts.recordCount < 0 || page.counts.recordCount > 30000 || page.offset !== records.length ||
          typeof page.sourcePack?.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(page.sourcePack.sha256) || !Number.isSafeInteger(page.sourcePack.size) || page.sourcePack.size < 1 || page.sourcePack.size > 16 * 1024 * 1024) throw new EsiaApiError(0, "The protected source library exceeds its bounds or has a mismatched manifest.");
      const {records: pageRecords, offset, nextCursor, sourcePack, ...metadata} = page;
      const nextIdentity = JSON.stringify({metadata, sourcePack});
      if (identity !== undefined && identity !== nextIdentity) throw new EsiaApiError(0, "The source library version or manifest changed between pages.");
      identity = nextIdentity;manifest = metadata;
      for (const record of pageRecords) {
        if (typeof record?.id !== "string" || !record.id || seen.has(record.id)) throw new EsiaApiError(0, "The source library contains duplicate or invalid statement identities.");
        seen.add(record.id);records.push(record);
      }
      if (records.length > page.counts.recordCount) throw new EsiaApiError(0, "The source library record count exceeds its retained manifest.");
      if (nextCursor === null) {
        if (records.length !== page.counts.recordCount) throw new EsiaApiError(0, "The source library ended before its retained record count.");
        current();return {...manifest, sourcePack, records};
      }
      if (typeof nextCursor !== "string" || !/^[A-Za-z0-9_-]{1,512}$/.test(nextCursor) || cursors.has(nextCursor) || !pageRecords.length) throw new EsiaApiError(0, "The source library returned an invalid or repeated page cursor.");
      cursors.add(nextCursor);after = nextCursor;
    }
    throw new EsiaApiError(0, "The source library exceeded its page limit.");
  }
  async function recoveryContext() {
    const {result, captured} = await perform("/api/recovery-context");
    const safe = frozenJson({...result, context: await completeSession(result.context)}), deployment = typeof safe.deployment === "string" && safe.deployment.match(recoveryDeploymentPattern);
    if (Object.keys(safe).sort().join(",") !== "context,deployment,expiresAt,issuer,subject" || !deployment || safe.issuer !== originalIssuer ||
        typeof safe.subject !== "string" || !safe.subject || safe.subject.trim() !== safe.subject || safe.subject.length > 512 || /[\u0000-\u001f\u007f-\u009f]/.test(safe.subject) ||
        Array.from(safe.subject).some(character => character.length === 1 && /[\ud800-\udfff]/.test(character)) ||
        !Number.isFinite(safe.expiresAt) || safe.expiresAt <= now() + 30_000 || safe.expiresAt > captured.fields.expiresAt) throw new EsiaApiError(0, "The backend did not return an exact current ESIA recovery authority.");
    const gateway = new URL(base).hostname.match(/^([a-z0-9]+)\.execute-api\.(us-east-1)\.amazonaws\.com$/);
    if (gateway && (deployment[2] !== gateway[1] || deployment[1] !== gateway[2] || deployment[3] !== "$default")) throw new EsiaApiError(0, "The recovery namespace does not match the configured ESIA API origin.");
    const context = frozenJson(authoritativeContext(safe.context));
    if (context.user.cognito_sub !== undefined && context.user.cognito_sub !== safe.subject) throw new EsiaApiError(0, "The ESIA authority projection belongs to another identity.");
    assertCaptured(captured);
    const proof = Object.freeze({scope: Object.freeze({deployment: safe.deployment, issuer: safe.issuer, subject: safe.subject}), expiresAt: safe.expiresAt, context});
    verifiedRecoveryContexts.set(proof, () => { assertCaptured(captured); if (proof.expiresAt <= now()) throw stale(); });
    return proof;
  }
  return {request, requirementLibrary,
    readPrivateBytes: (manifest, selector, {assertCurrent = () => {}, cryptoImpl = globalThis.crypto} = {}) => readPrivateDownload({manifest, selector,
      request: body => request('/api/downloads/chunk', {method: 'POST', body}), maximumBytes: 25 * 1024 * 1024, cryptoImpl,
      assertCurrent: () => {assertCurrentSession(); assertCurrent();}}),
    assertCurrentSession,
    recoveryContext,
    session: async (options = {}) => completeSession(await request("/api/session-context", options), options),
    createProject: body => request("/api/projects", {method: "POST", body}),
    engagements: (query, options) => request(`/api/engagements${query ? `?${new URLSearchParams(query)}` : ""}`, options),
    engagement: (engagementId, options) => request(`/api/engagements/${encodeURIComponent(engagementId)}`, options),
    createEngagement: (body, options = {}) => request("/api/engagements", {...options, method:"POST", body}),
    engagementCommand: (engagementId, body, options = {}) => request(`/api/engagements/${encodeURIComponent(engagementId)}/commands`, {...options, method:"POST", body}),
    teams: query => request(`/api/teams${query ? `?${new URLSearchParams(query)}` : ""}`),
    createTeam: body => request("/api/teams", {method: "POST", body}),
    team: teamId => request(`/api/teams/${encodeURIComponent(teamId)}`),
    updateTeam: (teamId, body) => request(`/api/teams/${encodeURIComponent(teamId)}`, {method: "PATCH", body}),
    teamMembers: teamId => request(`/api/teams/${encodeURIComponent(teamId)}/members`),
    updateTeamMember: (teamId, body) => request(`/api/teams/${encodeURIComponent(teamId)}/members`, {method: "PATCH", body}),
    grants: (type, resourceId) => request(`/api/${resourceCollection(type)}/${encodeURIComponent(resourceId)}/grants`),
    updateGrant: (type, resourceId, body) => request(`/api/${resourceCollection(type)}/${encodeURIComponent(resourceId)}/grants`, {method: "PUT", body}),
    artifacts,
    artifactPage: (projectId, {after, signal} = {}) => request(artifactPagePath(projectId, after), {signal}),
    createArtifact: body => request("/api/artifacts", {method: "POST", body}),
    finalizeArtifact: (artifactId, body) => request(`/api/artifacts/${encodeURIComponent(artifactId)}/finalize`, {method: "POST", body}),
    invitation: body => request("/api/invitations", {method: "POST", body}),
    invitationPreview: invitationId => request(`/api/invitations/${encodeURIComponent(invitationId)}`),
    acceptInvitation: (invitationId, body) => request(`/api/invitations/${encodeURIComponent(invitationId)}/accept`, {method: "POST", body}),
    revokeInvitation: (invitationId, body) => request(`/api/invitations/${encodeURIComponent(invitationId)}/revoke`, {method: "POST", body}),
    registerReview: body => request("/api/policy-audits/edition-requests", {method: "POST", body}),
    presignReview: (id, body) => request(`/api/policy-audits/edition-requests/${encodeURIComponent(id)}/presign`, {method: "POST", body}),
    promoteReview: (id, body) => request(`/api/policy-audits/edition-requests/${encodeURIComponent(id)}/promote`, {method: "POST", body}),
    reviewEditions: body => request("/api/policy-audits/editions", {method: "POST", body}),
    readReview: body => request("/api/policy-audits/read", {method: "POST", body}),
    presignAudit: body => request("/api/policy-audits/presign", {method: "POST", body})};
}

function resourceCollection(type) {
  if (!["project", "document", "engagement"].includes(type)) throw new EsiaApiError(0, "A project, document or engagement grant target is required.");
  return type === "project" ? "projects" : type === "document" ? "documents" : "engagements";
}

export function authoritativeContext(value) {
  if (!value?.user?.user_id || value.user.status !== "active" || value.user.server_authoritative !== true || !Array.isArray(value.projects) || !Array.isArray(value.projectGrants)) {
    throw new EsiaApiError(0, "The backend did not return a current ESIA access context.");
  }
  const arrays = ["accounts", "accountMembers", "teams", "teamMembers", "projects", "projectGrants", "sharedDocuments", "invitations"];
  const context = {...value};
  for (const name of arrays) context[name] = Array.isArray(value[name]) ? value[name] : [];
  context.user = {...value.user, groups: [], cognito_groups: [], deployment_roles: [...(value.user.deployment_roles || [])]};
  return context;
}

export function configuredObjectUrl(value, {bucket, key} = {}) {
  const url = new URL(value);
  if (typeof bucket !== "string" || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9](?![\s\S])/.test(bucket) || url.port || url.protocol !== "https:" || url.username || url.password || url.hash ||
      ![`${bucket}.s3.us-east-1.amazonaws.com`, `${bucket}.s3.amazonaws.com`].includes(url.hostname) ||
      decodeURIComponent(url.pathname.slice(1)) !== key) throw new EsiaApiError(0, "The private object URL does not match the configured ESIA storage target.");
  return url.href;
}
// Compatibility with the reviewed older Lambda: it omitted bucket from PUT
// replies but returned its authoritative storage_prefix on protected projects.
// Never infer a bucket from an upload URL, client labels or a global constant.
export async function resolveUploadBucket(apiClient, target, {projectId, accountId, configurationRevision} = {}) {
  const scope = account => `tenants/${account}/projects/${projectId}/`;
  if (typeof target?.key !== "string" || typeof projectId !== "string") throw new EsiaApiError(0, "The upload has no exact project storage target.");
  if (target.bucket !== undefined) {
    if (accountId && !target.key.startsWith(scope(accountId))) throw new EsiaApiError(0, "The upload target crosses account or project scope.");
    configuredObjectUrl(target.put_url, {bucket: target.bucket, key: target.key});return target.bucket;
  }
  if (typeof apiClient?.request !== "function") throw new EsiaApiError(0, "Reopen the authorized project to resolve its storage target.");
  const {project} = await apiClient.request(`/api/projects/${encodeURIComponent(projectId)}`);
  if (!project || project.project_id !== projectId || typeof project.account_id !== "string" ||
      accountId && project.account_id !== accountId || project.revision !== configurationRevision || !target.key.startsWith(scope(project.account_id))) throw new EsiaApiError(0, "The current server project does not match this upload's custody or revision.");
  const match = typeof project.storage_prefix === "string" && /^s3:\/\/([a-z0-9][a-z0-9-]{1,61}[a-z0-9])\//.exec(project.storage_prefix);
  if (!match || project.storage_prefix !== `s3://${match[1]}/${scope(project.account_id)}`) throw new EsiaApiError(0, "The server project has no exact reviewed private storage prefix.");
  configuredObjectUrl(target.put_url, {bucket: match[1], key: target.key});return match[1];
}
export function objectPutHeaders(headers = {}, contentType = "application/json") {
  if (Object.keys(headers).some(name => !["content-type", "x-amz-tagging", "if-none-match", "x-amz-checksum-sha256", "x-amz-server-side-encryption", "x-amz-server-side-encryption-aws-kms-key-id"].includes(name.toLowerCase()))) throw new EsiaApiError(0, "Unexpected private upload headers.");
  const encryption = Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase().startsWith("x-amz-server-side-encryption")).map(([name, value]) => [name.toLowerCase(), value]));
  if (Object.keys(encryption).length && (encryption["x-amz-server-side-encryption"] !== "aws:kms" ||
      !/^arn:aws:kms:us-east-1:[0-9]{12}:key\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?![\s\S])/.test(encryption["x-amz-server-side-encryption-aws-kms-key-id"] || ""))) throw new EsiaApiError(0, "Unexpected private encryption headers.");
  return {...headers, "content-type": contentType};
}

export function restorePolicyReviewPayload(saved, projectId, reviewId = "project_document_review") {
  if (!["project_document_review", "ifc_ps_me_matrix"].includes(reviewId) || !saved || saved.schema_version !== "project_document_review.v1" || saved.project?.project_id !== projectId || saved.policy_review?.id !== reviewId) {
    throw new EsiaApiError(0, "The saved review does not match this project and assessment.");
  }
  const indexed = (items, name) => {
    if (!Array.isArray(items)) throw new EsiaApiError(0, "The saved review result collection is invalid.");
    const values = Object.fromEntries(items.map(item => [item[name], item]));
    if (Object.keys(values).length !== items.length || items.some(item => !item[name])) throw new EsiaApiError(0, "Saved review result identities are ambiguous.");
    return values;
  };
  return {...saved, policy_review_id: saved.policy_review.id, template_id: saved.policy_review.template_id,
    frameworks: saved.selected_frameworks, standards: saved.standards_applicability,
    requirement_results: indexed(saved.requirement_results, "requirement_id"), diagnostic_results: indexed(saved.diagnostic_results, "diagnostic_id")};
}
