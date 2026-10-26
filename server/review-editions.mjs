import {assertConfiguredResourceAuthority} from '../src/lib/hosted-field-capture-model.js';
import {esiaMigrationOriginalMatches} from "./storage-migrations.mjs";
import {storageEncryptionHeaders} from './account-storage.mjs';
import {createHash} from "node:crypto";
import {isDeepStrictEqual} from "node:util";
import {record} from "./access-store.mjs";
import {createResourceReference, assertResourceReference, resourceReferenceKey, assertPreservedRecord} from "@categori/workspace-contracts";
import {assertRetainedEvidenceLinks, retainedEvidenceExtension} from "@categori/workspace-contracts/retained";
import {documentVersionKey} from "@categori/workspace-contracts/documents";
import {documentVersions, documentAddressKey} from "../src/lib/document-versions.js";

const hash = value => createHash("sha256").update(value).digest("hex");
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const reviewIds = new Set(["project_document_review", "ifc_ps_me_matrix"]);
const immutableRequestFields = ["request_id", "edition_id", "manifest", "project_id", "workspace_id", "account_id", "policy_review_id", "created_by", "requested_identity", "created_at", "expires_at", "storage_key"];

export function reviewEvidenceManifests(payload) {
  const invalid = () => {const error = new Error("Retained evidence requires complete, bounded and unambiguous original link manifests."); error.statusCode = 409; throw error;};
  if (payload.extensions !== undefined && !object(payload.extensions)) invalid();
  let links;
  try {links = assertRetainedEvidenceLinks(Object.hasOwn(payload.extensions ?? {}, retainedEvidenceExtension) ? payload.extensions[retainedEvidenceExtension] : []);} catch {invalid();}
  const sources = new Map();
  return links.map(link => {
    const source = resourceReferenceKey(link.reference), manifest = JSON.stringify([link.sha256, link.size_bytes, link.media_type]);
    if (sources.has(source) && sources.get(source) !== manifest) invalid();
    sources.set(source, manifest);
    return {id: hash(JSON.stringify([resourceReferenceKey(link.collection_reference), link.collection_id, source])), link};
  });
}

export function reviewDocumentVersionManifests(payload) {
  try {
    return documentVersions(payload).map(descriptor => {
      if (descriptor.version.reference.resource_id !== `file_${hash(documentAddressKey(descriptor.address))}`) throw Error("Document address changed.");
      return {id: hash(documentVersionKey(descriptor.version)), descriptor};
    });
  } catch {
    throw Object.assign(Error("Document versions require complete, bounded and unambiguous original Docs Manager manifests."), {statusCode: 409});
  }
}

// Review content remains app-owned JSON. Shared contracts govern its scoped reference and preservation.
export function assertReviewSnapshot(payload, {projectId, reviewId}) {
  const invalid = message => { const error = new Error(message); error.statusCode = 409; throw error; };
  if (!object(payload) || payload.object_type !== "policy_review_audit" || payload.schema_version !== "project_document_review.v1" ||
      !object(payload.project) || payload.project.project_id !== projectId || !object(payload.policy_review) || payload.policy_review.id !== reviewId ||
      !object(payload.selected_frameworks) || !object(payload.standards_applicability)) invalid("Review snapshot does not match its project, assessment and complete draft shape.");
  for (const [field, idField] of [["requirement_results", "requirement_id"], ["diagnostic_results", "diagnostic_id"]]) {
    if (!Array.isArray(payload[field]) || payload[field].length > 2000) invalid("Review results must be bounded explicit arrays.");
    const ids = new Set();
    for (const result of payload[field]) {
      const id = result?.[idField];
      if (!object(result) || typeof id !== "string" || !id.trim() || id.length > 192 || /[\x00-\x1f\x7f]/.test(id) || ids.has(id)) invalid("Review result identities must be bounded, nonempty and unique.");
      ids.add(id);
    }
  }
  reviewEvidenceManifests(payload);
  reviewDocumentVersionManifests(payload);
  const references = new Map(), pending = [{value: payload, depth: 0}]; let nodes = 0;
  while (pending.length) {
    const {value, depth} = pending.pop();
    if (++nodes > 400_000 || depth > 64) invalid("Review snapshot exceeds its structural bound.");
    if (object(value) && value.schema_version === 1 && typeof value.authority === "string" &&
        typeof value.resource_id === "string" && typeof value.workspace_id === "string" && typeof value.resource_type === "string" && typeof value.version_id === "string") {
      let reference;
      try { reference = assertResourceReference(value, {immutable: true}); } catch { invalid("A pinned source reference is malformed."); }
      const id = hash(resourceReferenceKey(reference)); references.set(id, {id, reference});
      if (references.size > 128) invalid("Review snapshot has too many distinct pinned source references.");
    }
    if (Array.isArray(value) || object(value)) for (const child of Object.values(value)) pending.push({value: child, depth: depth + 1});
  }
  return [...references.values()];
}

export function createReviewEditionOperations({resourceAuthority, authenticate, resourceAccess, entitlement, get, commit, update, instant, iso, ttl,
  assertSignedHorizon, store, storage, signObject, verifyReviewSnapshot, fail}) {
  const authority = assertConfiguredResourceAuthority(resourceAuthority);
  const headKey = reviewId => `REVIEW_HEAD#${reviewId}`;
  const projection = row => ({...row.value, revision: row.revision});
  function manifest(body) {
    const fields = new Set(["request_id", "project_id", "policy_review_id", "configuration_revision", "expected_head_revision", "base_edition_id", "source_edition_id", "sha256", "size_bytes"]);
    if (Object.keys(body).some(name => !fields.has(name)) || typeof body.request_id !== "string" || !uuid.test(body.request_id) || !reviewIds.has(body.policy_review_id) ||
        !Number.isSafeInteger(body.configuration_revision) || body.configuration_revision < 1 || !Number.isSafeInteger(body.expected_head_revision) || body.expected_head_revision < 0 ||
        typeof body.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(body.sha256) || !Number.isSafeInteger(body.size_bytes) || body.size_bytes < 1 || body.size_bytes > 25 * 1024 * 1024) fail(400, "An exact UUID, bounded snapshot manifest and explicit revisions are required.");
    for (const field of ["base_edition_id", "source_edition_id"]) if (body[field] !== null && (typeof body[field] !== "string" || !body[field].startsWith("review_") || !uuid.test(body[field].slice(7)))) fail(400, "Edition provenance requires an exact saved edition ID or explicit null.");
    return Object.fromEntries([...fields].map(name => [name, body[name]]));
  }
  async function scope(principal, projectId, action = "review") {
    const auth = await authenticate(principal, {enroll: false}), scoped = await resourceAccess(auth, "project", projectId, action);
    if (action === "review") await entitlement(auth, scoped.target.value.workspace_id, "storage_writes");
    return {auth, scoped};
  }
  async function boundEdition(auth, project, reviewId, editionId) {
    const edition = await get(auth.ctx, `REVIEW_EDITION#${editionId}`, "PROFILE");
    if (!edition || edition.value.project_id !== project.value.project_id || edition.value.workspace_id !== project.value.workspace_id ||
        edition.value.account_id !== project.value.account_id || edition.value.policy_review_id !== reviewId) fail(404, "Retained review edition is unavailable in this scope.");
    if (!esiaMigrationOriginalMatches(edition.value.original, storage.forAccount(project.value.account_id).bucket) ||
        edition.value.original?.key !== `tenants/${project.value.account_id}/projects/${project.value.project_id}/assessments/policy_reviews/${reviewId}/editions/${editionId}/snapshot.json`) fail(409, "Retained review storage needs an explicit verified account migration.");
    return edition;
  }
  function expectHead(head, descriptor) {
    if ((head?.revision || 0) !== descriptor.expected_head_revision || (head?.value.edition_id || null) !== descriptor.base_edition_id) fail(409, "Saved review changed. Reopen the current edition before preparing a new save.");
  }
  async function requestScope(principal, requestId) {
    if (typeof requestId !== "string" || !uuid.test(requestId)) fail(400, "Exact review request UUID required.");
    let auth = await authenticate(principal, {enroll: false});
    const request = await get(auth.ctx, `REVIEW_REQUEST#${requestId}`, "PROFILE");
    if (!request || request.value.created_by !== auth.userId || request.value.requested_identity.issuer !== principal.issuer || request.value.requested_identity.subject !== principal.subject) fail(403, "This review request belongs to another current identity.");
    const scoped = await resourceAccess(auth, "project", request.value.project_id, "review");
    await entitlement(auth, scoped.target.value.workspace_id, "storage_writes");
    if (request.value.workspace_id !== scoped.target.value.workspace_id || request.value.account_id !== scoped.target.value.account_id || request.value.manifest.configuration_revision !== scoped.target.revision) fail(409, "Registered review project configuration changed.");
    return {auth, scoped, request};
  }
  const pendingScope = ({scoped, request}) => ({...scoped, authorityUntil: Math.min(scoped.authorityUntil ?? Infinity, Date.parse(request.value.expires_at))});
  async function registerReview(principal, body) {
    const descriptor = manifest(body), {auth, scoped} = await scope(principal, descriptor.project_id), project = scoped.target;
    storage.forAccount(project.value.account_id);
    if (descriptor.configuration_revision !== project.revision) fail(409, "Project configuration changed.");
    const existing = await get(auth.ctx, `REVIEW_REQUEST#${descriptor.request_id}`, "PROFILE");
    if (existing) {
      if (existing.value.created_by !== auth.userId || !isDeepStrictEqual(existing.value.manifest, descriptor)) fail(409, "Review request UUID already selects a different actor or snapshot manifest.");
      await commit(auth.ctx); return {request: projection(existing)};
    }
    const head = await get(auth.ctx, project.pk, headKey(descriptor.policy_review_id)); expectHead(head, descriptor);
    if (descriptor.source_edition_id) await boundEdition(auth, project, descriptor.policy_review_id, descriptor.source_edition_id);
    const editionId = `review_${descriptor.request_id}`;
    const request = record(`REVIEW_REQUEST#${descriptor.request_id}`, "PROFILE", {object_type: "review_save_request", status: "pending",
      request_id: descriptor.request_id, edition_id: editionId, manifest: descriptor, project_id: descriptor.project_id, policy_review_id: descriptor.policy_review_id,
      workspace_id: project.value.workspace_id, account_id: project.value.account_id, created_by: auth.userId,
      requested_identity: {issuer: principal.issuer, subject: principal.subject}, created_at: iso(), expires_at: new Date(instant().getTime() + 3600_000).toISOString(),
      storage_key: `tenants/${project.value.account_id}/projects/${project.value.project_id}/assessments/policy_reviews/${descriptor.policy_review_id}/editions/${editionId}/snapshot.json`});
    ttl(auth, pendingScope({scoped, request})); await commit(auth.ctx, [request]); return {request: projection(request)};
  }
  function expectedRequest(request, body) {
    if (Object.keys(body).some(name => name !== "expected_revision") || ![1, request.revision].includes(body.expected_revision)) fail(409, "Review request revision changed.");
  }
  async function presignReview(principal, requestId, body) {
    let current = await requestScope(principal, requestId); expectedRequest(current.request, body);
    if (current.request.value.status === "promoted") { await commit(current.auth.ctx); return {receipt: current.request.value.receipt}; }
    if (current.request.value.status !== "pending") fail(409, "Review request is not pending.");
    const {request} = current, privateBucket = storage.forAccount(request.value.account_id).bucket, descriptor = request.value.manifest, signedAt = instant(), expiresIn = ttl(current.auth, pendingScope(current), signedAt);
    if (typeof signObject !== "function") fail(503, "Review signing is not configured.");
    const tags = {account_id: request.value.account_id, project_id: request.value.project_id, policy_review_id: request.value.policy_review_id, data_classification: "confidential", data_type: "review_edition"};
    const putUrl = await signObject({mode: "put", bucket: privateBucket, key: request.value.storage_key, contentType: "application/json", createOnly: true,
      sha256: descriptor.sha256, sizeBytes: descriptor.size_bytes, signedAt, expiresIn, tags});
    current = await requestScope(principal, requestId);
    if (current.request.revision !== request.revision || current.request.value.status !== "pending") fail(409, "Review request changed during signing.");
    assertSignedHorizon(current.auth, pendingScope(current), [{signedAt, expiresIn}]); await commit(current.auth.ctx); ttl(current.auth, pendingScope(current));
    return {request_id: requestId, bucket: privateBucket, key: request.value.storage_key, put_url: putUrl, expires_in: expiresIn, put_headers: {"content-type": "application/json", "if-none-match": "*",
      ...storageEncryptionHeaders(storage.forAccount(request.value.account_id)), "x-amz-checksum-sha256": Buffer.from(descriptor.sha256, "hex").toString("base64"), "x-amz-tagging": new URLSearchParams(tags).toString()}};
  }
  async function promoteReview(principal, requestId, body) {
    let current = await requestScope(principal, requestId); expectedRequest(current.request, body);
    if (current.request.value.status === "promoted") { await commit(current.auth.ctx); return current.request.value.receipt; }
    const originalRequest = current.request, privateBucket = storage.forAccount(originalRequest.value.account_id).bucket, descriptor = originalRequest.value.manifest;
    if (originalRequest.value.status !== "pending") fail(409, "Review request is not pending.");
    expectHead(await get(current.auth.ctx, current.scoped.target.pk, headKey(descriptor.policy_review_id)), descriptor);
    ttl(current.auth, pendingScope(current));
    if (typeof verifyReviewSnapshot !== "function") fail(503, "Review byte verification is not configured.");
    const verified = await verifyReviewSnapshot({bucket: privateBucket, key: originalRequest.value.storage_key, sha256: descriptor.sha256, sizeBytes: descriptor.size_bytes, contentType: "application/json"});
    if (!verified || verified.sha256 !== descriptor.sha256 || verified.sizeBytes !== descriptor.size_bytes || verified.contentType !== "application/json" || typeof verified.versionId !== "string" || verified.versionId === "null") fail(409, "Review provider receipt does not match its exact manifest.");
    const sourceReferences = assertReviewSnapshot(verified.payload, {projectId: descriptor.project_id, reviewId: descriptor.policy_review_id}), retainedEvidence = reviewEvidenceManifests(verified.payload), documentVersionManifests = reviewDocumentVersionManifests(verified.payload);
    current = await requestScope(principal, requestId);
    if (current.request.value.status === "promoted") { await commit(current.auth.ctx); return current.request.value.receipt; }
    if (current.request.revision !== originalRequest.revision) fail(409, "Review request changed during verification.");
    let {auth, scoped, request} = current, head = await get(auth.ctx, scoped.target.pk, headKey(descriptor.policy_review_id)); expectHead(head, descriptor);
    const checkedSources = []; let verifiedLegacy = false;
    for (const priorId of new Set([descriptor.base_edition_id, descriptor.source_edition_id].filter(Boolean))) {
      const source = await boundEdition(auth, scoped.target, descriptor.policy_review_id, priorId);
      checkedSources.push(source);
      let sourceEvidence = source.value.retained_evidence, sourceDocuments = source.value.document_versions;
      if (sourceEvidence === undefined || sourceDocuments === undefined) {
        // Older immutable receipts retain references but do not prove their
        // complete byte manifests. Read their exact saved provider version;
        // never infer missing links or rewrite the original receipt.
        const original = source.value.original, versionId = original?.reference?.version_id;
        try {assertResourceReference(original?.reference, {immutable: true});} catch {fail(409, "Original retained review reference is malformed.");}
        if (!esiaMigrationOriginalMatches(original, privateBucket) || original.reference.authority !== authority || original.reference.resource_type !== "review_edition" ||
            original.reference.resource_id !== source.value.edition_id || original.reference.workspace_id !== source.value.workspace_id) fail(409, "Original retained review reference changed scope.");
        const retained = await verifyReviewSnapshot({bucket: privateBucket, key: original.key, versionId,
          sha256: original.sha256, sizeBytes: original.size_bytes, contentType: original.content_type});
        if (!retained || retained.versionId !== versionId || retained.sha256 !== original.sha256 || retained.sizeBytes !== original.size_bytes || retained.contentType !== "application/json") fail(409, "Original retained review bytes do not match the prior immutable receipt.");
        const references = assertReviewSnapshot(retained.payload, {projectId: descriptor.project_id, reviewId: descriptor.policy_review_id});
        try {
          assertPreservedRecord({references: source.value.source_references}, {references}, {appendOnly: {references: "id"}});
          assertPreservedRecord({references}, {references: source.value.source_references}, {appendOnly: {references: "id"}});
        } catch {fail(409, "Original retained review references do not match the prior receipt.");}
        const checkedEvidence = reviewEvidenceManifests(retained.payload), checkedDocuments = reviewDocumentVersionManifests(retained.payload);
        for (const [existing, checked] of [[sourceEvidence, checkedEvidence], [sourceDocuments, checkedDocuments]]) {
          if (existing !== undefined) {
            try {
              assertPreservedRecord({rows: existing}, {rows: checked}, {appendOnly: {rows: "id"}});
              assertPreservedRecord({rows: checked}, {rows: existing}, {appendOnly: {rows: "id"}});
            } catch {fail(409, "Original saved document or evidence manifest does not match its immutable bytes.");}
          }
        }
        sourceEvidence = checkedEvidence; sourceDocuments = checkedDocuments;
        verifiedLegacy = true;
      }
      try { assertPreservedRecord({references: source.value.source_references, retained_evidence: sourceEvidence, document_versions: sourceDocuments},
        {references: sourceReferences, retained_evidence: retainedEvidence, document_versions: documentVersionManifests}, {appendOnly: {references: "id", retained_evidence: "id", document_versions: "id"}}); }
      catch { fail(409, "Original pinned source references and complete evidence manifests cannot be removed or rewritten in a derived edition."); }
    }
    if (verifiedLegacy) {
      // Byte verification is another awaited provider operation. Its earlier
      // app snapshot does not authorize a later publication or commit.
      current = await requestScope(principal, requestId);
      if (current.request.value.status === "promoted") {await commit(current.auth.ctx); return current.request.value.receipt;}
      if (current.request.revision !== originalRequest.revision || current.request.value.status !== "pending") fail(409, "Review request changed during original evidence verification.");
      ({auth, scoped, request} = current); head = await get(auth.ctx, scoped.target.pk, headKey(descriptor.policy_review_id)); expectHead(head, descriptor);
      for (const earlier of checkedSources) {
        const checked = await boundEdition(auth, scoped.target, descriptor.policy_review_id, earlier.value.edition_id);
        if (!isDeepStrictEqual(checked, earlier)) fail(409, "Original retained review receipt changed during verification.");
      }
    }
    ttl(auth, pendingScope(current));
    const reference = assertResourceReference(createResourceReference({authority, resourceId: request.value.edition_id,
      resourceType: "review_edition", workspaceId: request.value.workspace_id, versionId: verified.versionId}), {immutable: true});
    const edition = record(`REVIEW_EDITION#${request.value.edition_id}`, "PROFILE", {object_type: "review_edition", schema_version: 1,
      edition_id: request.value.edition_id, request_id: requestId, project_id: request.value.project_id, policy_review_id: request.value.policy_review_id,
      workspace_id: request.value.workspace_id, account_id: request.value.account_id, created_by: auth.userId, created_at: request.value.created_at, verified_at: iso(),
      configuration_revision: descriptor.configuration_revision, previous_edition_id: descriptor.base_edition_id, source_edition_id: descriptor.source_edition_id, source_references: sourceReferences, retained_evidence: retainedEvidence, document_versions: documentVersionManifests,
      original: {reference, bucket: privateBucket, key: request.value.storage_key, sha256: verified.sha256, size_bytes: verified.sizeBytes, content_type: "application/json"}});
    const changedHead = record(scoped.target.pk, headKey(descriptor.policy_review_id), {object_type: "review_head", project_id: request.value.project_id,
      workspace_id: request.value.workspace_id, policy_review_id: request.value.policy_review_id, edition_id: request.value.edition_id, updated_at: iso()}, (head?.revision || 0) + 1);
    const receipt = {edition: projection(edition), head: projection(changedHead)};
    const changedRequest = update(request, {...request.value, status: "promoted", receipt});
    assertPreservedRecord(request.value, changedRequest.value, {immutableFields: immutableRequestFields});
    await commit(auth.ctx, [edition, changedHead, changedRequest, record(scoped.target.pk, `REVIEW_EDITION#${descriptor.policy_review_id}#${edition.value.edition_id}`, {edition_id: edition.value.edition_id})]);
    ttl(auth, pendingScope(current)); return receipt;
  }
  async function listReviews(principal, body) {
    if (!reviewIds.has(body.policy_review_id)) fail(400, "Configured assessment required.");
    const {auth, scoped} = await scope(principal, body.project_id, "view"), head = await get(auth.ctx, scoped.target.pk, headKey(body.policy_review_id));
    const editions = [];
    // The project index contains immutable edition IDs only; exact rows establish current scope.
    for (const hint of await store.list(scoped.target.pk, `REVIEW_EDITION#${body.policy_review_id}#`)) {
      const edition = await boundEdition(auth, scoped.target, body.policy_review_id, hint.value.edition_id); editions.push(projection(edition));
    }
    return {head: head ? projection(head) : null, editions};
  }
  async function retainedReview(principal, body) {
    if (!reviewIds.has(body.policy_review_id) || body.bucket || body.key || body.legacy) fail(400, "Current assessment and retained edition select the read target.");
    if (body.edition_id !== undefined && (typeof body.edition_id !== "string" || !body.edition_id.startsWith("review_") || !uuid.test(body.edition_id.slice(7)))) fail(400, "An exact retained edition ID is required.");
    let {auth, scoped} = await scope(principal, body.project_id, "view");
    if (body.configuration_revision !== scoped.target.revision) fail(409, "Project configuration changed.");
    const head = await get(auth.ctx, scoped.target.pk, headKey(body.policy_review_id));
    const editionId = body.edition_id || head?.value.edition_id;
    if (!editionId) fail(404, "No retained review edition exists. Legacy draft loading must be selected explicitly.");
    const edition = await boundEdition(auth, scoped.target, body.policy_review_id, editionId);
    const fresh = await scope(principal, body.project_id, "view"); auth = fresh.auth; scoped = fresh.scoped;
    if (body.configuration_revision !== scoped.target.revision) fail(409, "Project configuration changed during signing.");
    const checked = await boundEdition(auth, scoped.target, body.policy_review_id, editionId);
    if (!isDeepStrictEqual(checked, edition)) fail(409, "Retained edition binding changed during signing.");
    await commit(auth.ctx); ttl(auth, scoped);
    return {edition: projection(edition), head: head ? projection(head) : null, key: edition.value.original.key,
      mediated: true, sha256: edition.value.original.sha256, size_bytes: edition.value.original.size_bytes, version_id: edition.value.original.reference.version_id, legacy: false};
  }
  return {registerReview, presignReview, promoteReview, listReviews, retainedReview};
}
