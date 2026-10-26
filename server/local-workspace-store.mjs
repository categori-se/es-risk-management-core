import {DatabaseSync} from "node:sqlite";
import {createHash, randomUUID} from "node:crypto";
import {
  mkdirSync, readFileSync, statSync, writeFileSync, renameSync, unlinkSync, existsSync,
  constants, openSync, closeSync, fstatSync, readSync, realpathSync, lstatSync
} from "node:fs";
import {basename, dirname, isAbsolute, join, resolve} from "node:path";
import {
  createResourceReference, assertResourceReference, assertDocumentVersionLink
} from "@categori/workspace-contracts";
import {createGapReportPresentation, gapReportRendererVersion, reportStandard} from "./gap-report-model.mjs";
import {normalizeCatalogMetadata, normalizeExtractionFacts} from "../src/lib/source-metadata.js";
import {normalizeDocumentClassification,documentProfileFromMetadata,canonicalDocumentValue} from "../src/lib/document-classification.js";
import {normalizeDocumentRevisionRelation,validateDocumentRevisionGraph,documentComparisonMetadata,documentMetadataBaseline} from "../src/lib/document-relations.js";
import {serializeGeoJson} from '../src/lib/geojson-editing.js';
import {additionalFieldLinks, normalizeAdditionalFieldLinks, normalizeFieldDetails} from "../src/lib/field-record-details.js";
import {prepareGeoJsonEdit, assertLocalEditableResource, parseEditableGeoJson, normalizeGeoJsonDerivation, assertGeoJsonDerivationBytes, geoJsonEditOperation, geoJsonEditReceipt} from './geojson-editing.mjs';

const FILE_LIMIT = 16 * 1024 * 1024;
const PACKAGE_LIMIT = 32 * 1024 * 1024;
const HANDOVER_FILE_LIMIT=64*1024*1024,HANDOVER_SOURCE_LIMIT=1024*1024*1024;
// Shared with the HTTP adapter: a successful compact export must fit the exact
// import boundary even when practitioner notes and frozen reports are large.
export const localWorkspaceMaxJsonBytes = 48 * 1024 * 1024;
const AUTHORITY = "urn:esia:local";
const TEMPLATE = Object.freeze({id: "gap-analysis", version: 1});
const STYLED_TEMPLATE = Object.freeze({id: "gap-analysis", version: 2});
const FIELD_ATTACHMENT_LIMIT = 20 * 1024 * 1024;
const FIELD_MEDIA_TYPE = "application/vnd.esia.field-record+json";
const idPattern = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const clone = value => structuredClone(value);
const freezeTree = value => {if (value && typeof value === 'object') {for (const item of Object.values(value)) freezeTree(item);Object.freeze(value);}return value;};
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const now = () => new Date().toISOString();
const newId = () => randomUUID();
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);

function fail(status, message) {
  throw Object.assign(new Error(message), {status});
}

function text(value, label, {optional = false, max = 16000} = {}) {
  if (optional && (value === undefined || value === null)) return "";
  if (typeof value !== "string" || value.length > max || (!optional && !value.trim()) || /\u0000/.test(value)) {
    fail(400, `${label} must be ${optional ? "text" : "non-empty text"} of at most ${max} characters.`);
  }
  return value;
}

function identifier(value, label = "Identifier") {
  if (typeof value !== "string" || !idPattern.test(value)) fail(400, `${label} is invalid.`);
  return value;
}

function choice(value, values, label) {
  if (!values.includes(value)) fail(400, `${label} must be one of: ${values.join(", ")}.`);
  return value;
}

function timestamp(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) {
    fail(400, `${label} must be an ISO timestamp.`);
  }
  return value;
}

function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    fail(400, "Due date must be a valid YYYY-MM-DD date.");
  }
  return value;
}

function items(value, label, max = 10000) {
  if (!Array.isArray(value) || value.length > max) fail(400, `${label} must be an array with at most ${max} entries.`);
  return value;
}

function filename(value) {
  text(value, "Filename", {max: 255});
  if (value === "." || value === ".." || /[\\/\x00-\x1f\x7f]/.test(value)) {
    fail(400, "Filename must be a logical filename without directory components.");
  }
  return value;
}

function sourceUrl(value, label) {
  text(value, label, {max: 4000});
  let url;
  try {url = new URL(value);} catch {fail(400, `${label} must be an HTTP(S) URL.`);}
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) fail(400, `${label} must be a credential-free HTTP(S) URL.`);
  const credentials = /^(?:access[_-]?token|id[_-]?token|refresh[_-]?token|oauth[_-]?token|security[_-]?token|token|auth|authorization|authorization[_-]?code|code|bearer|jwt|api[_-]?key|auth[_-]?key|key|password|passwd|secret|client[_-]?secret|session(?:id|[_-]id|[_-]token)?|sid|signature|sig|credential|credentials|x-amz-.+|x-goog-.+|awsaccesskeyid|googleaccessid|key-pair-id|policy|rlkey|resourcekey)$/i;
  if ([...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()].some(key => credentials.test(key.replace(/\[\d*\]$/, "").replace(/[.\s]/g, "-")))) {
    fail(400, `${label} must omit credentials and signed download parameters.`);
  }
  return value;
}

function sourceMetadata(value) {
  if (value === undefined) return undefined;
  if (!object(value)) fail(400, "Source capture metadata must be an object.");
  const source = {};
  for (const field of ["originalUrl", "finalUrl"]) {
    if (value[field] !== undefined && value[field] !== "") {
      source[field] = sourceUrl(value[field], field);
    }
  }
  source.capturedAt = timestamp(value.capturedAt, "Source capture time");
  source.method = text(value.method, "Capture method", {max: 500});
  source.result = text(value.result, "Capture result", {max: 2000});
  if (value.title !== undefined) source.title = text(value.title, "Source title", {optional: true, max: 2000});
  return source;
}

function intakeMetadata(value, expectedSha256,versionId) {
  if (!object(value) || !object(value.extraction)) fail(400, "Reviewed intake metadata requires extraction details.");
  const metadata = {title: text(value.title, "Document title", {max: 2000}),
    authors: items(value.authors, "Document authors", 50).map(author => text(author, "Document author", {max: 500})),
    description: text(value.description, "Document description", {optional: true}),
    language: text(value.language, "Document language", {optional: true, max: 100}),
    tags: items(value.tags, "Concept tags", 20).map(tag => {
      if (!object(tag)) fail(400, "Concept tag must be an object.");
      return {id: identifier(tag.id, "Concept tag ID"), label: text(tag.label, "Concept tag label", {max: 200}),
        kind: text(tag.kind, "Concept tag kind", {max: 100})};
    }),
    receivedVia: choice(value.receivedVia, ["email_attachment", "file_upload", "web_capture", "pdf_url"], "Intake origin"),
    extraction: {method: text(value.extraction.method, "Metadata extraction method", {max: 200}),
      status: text(value.extraction.status, "Metadata extraction status", {max: 100}),
      warnings: items(value.extraction.warnings, "Extraction warnings", 20).map(warning => text(warning, "Extraction warning", {max: 2000})),
      ...normalizeExtractionFacts(value.extraction, expectedSha256)}, ...normalizeCatalogMetadata(value)};
  if (new Set(metadata.tags.map(tag => tag.id)).size !== metadata.tags.length) fail(400, "Concept tag IDs must be unique.");
  if(metadata.classification)metadata.classification=normalizeDocumentClassification(metadata.classification,{sourceSha256:expectedSha256,versionId});
  if(metadata.revisionRelation)metadata.revisionRelation=normalizeDocumentRevisionRelation(metadata.revisionRelation,{sourceSha256:expectedSha256,versionId});
  if (value.documentDate !== undefined) {
    const candidate = text(value.documentDate, "Document date", {optional: true, max: 64});
    if (candidate !== "") {
      const day = candidate.slice(0, 10);
      if (!/^\d{4}-\d\d-\d\d(?:$|T\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$)/.test(candidate) ||
          !Number.isFinite(Date.parse(candidate)) || !Number.isFinite(Date.parse(day)) ||
          new Date(day).toISOString().slice(0, 10) !== day) {
        fail(400, "Document date must be a valid ISO date or timestamp, or empty when unknown.");
      }
    }
    metadata.documentDate = candidate;
  }
  if(metadata.classification?.reviewedProfile&&canonicalDocumentValue(documentProfileFromMetadata(metadata,metadata.classification.reviewedProfile.requirementIds))!==canonicalDocumentValue(metadata.classification.reviewedProfile))fail(400,"Reviewed document metadata must match the exact fields retained by its classification decision.");
  return metadata;
}
export {intakeMetadata as normalizeEngagementSourceMetadata};

function effectiveMetadata(resource, version) {
  return resource.metadataHistory?.findLast(entry => entry.versionId === version.id)?.metadata ?? version.intakeMetadata;
}

function hasIntakeMetadata(project) {
  return project.resources.some(resource => Object.hasOwn(resource, "metadataHistory") ||
    resource.versions.some(version => Object.hasOwn(version, "intakeMetadata"))) ||
    (project.reports ?? []).some(report => hasIntakeMetadata(report.snapshot));
}

function hasSourceDerivations(project) {
  return project.resources.some(resource => resource.versions.some(version => version.derivation)) ||
    (project.reports ?? []).some(report => hasSourceDerivations(report.snapshot));
}

function hasDefinitions(project) {
  return project.assessments.some(item => item.auditContext?.definition || item.auditContext?.sector || item.auditContext?.definitionReview) ||
    (project.reports ?? []).some(report => hasDefinitions(report.snapshot));
}

function retainedJson(value, label, maximum = 8 * 1024 * 1024) {
  let encoded;
  try {encoded = JSON.stringify(value);} catch {fail(400, `${label} must be portable JSON.`);}
  if (!encoded || Buffer.byteLength(encoded) > maximum) fail(400, `${label} exceeds the supported size.`);
  const visit = (item, depth = 0) => {
    if (depth > 30) fail(400, `${label} is nested too deeply.`);
    if (typeof item === "string" && item.includes("\0")) fail(400, `${label} contains invalid text.`);
    if (item && typeof item === "object") for (const [key, child] of Object.entries(item)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) fail(400, `${label} contains an invalid key.`);
      visit(child, depth + 1);
    }
  };
  visit(value);
  return JSON.parse(encoded);
}

function retainedDefinition(value, context) {
  if (!object(value) || value.id !== context.checkId || value.frameworkId !== context.frameworkId || value.edition !== context.framework.edition ||
      value.reviewStatus !== "unreviewed") fail(400, "Retained definition must match this check and framework edition.");
  text(value.parserVersion, "Definition parser version", {max: 100});
  const checkDetail = detail => {
    if (!object(detail) || !hashPattern.test(detail.sourceSha256) || !context.sources.some(source => source.sha256 === detail.sourceSha256) ||
        !Number.isInteger(detail.page) || detail.page < 1) fail(400, "Definition must retain its exact source hash and page.");
    text(detail.sourceText, "Definition source statement", {max: 1024 * 1024});
    if (!object(detail.context) && !(typeof detail.contextRef === "string" && object(value.contexts?.[detail.contextRef]))) fail(400, "Definition is missing its qualification context.");
  };
  if (context.checkSet === "detailed") checkDetail(value.detail);
  else if (context.checkSet === "diagnostic") {
    const ids = items(value.memberIds, "Diagnostic member IDs").map(id => identifier(id));
    if (!ids.length || new Set(ids).size !== ids.length) fail(400, "Diagnostic members must have unique identities.");
    const members = items(value.members, "Diagnostic member definitions");
    if (members.length !== ids.length || members.some((member, index) => member.id !== ids[index])) fail(400, "Diagnostic member definitions must match their retained IDs.");
    members.forEach(member => checkDetail(member.detail));
  } else fail(400, "Retained definitions require detailed or diagnostic accounting.");
  return retainedJson(value, "Retained requirement definition");
}

function immutableReference(value) {
  try { return clone(assertResourceReference(value, {immutable: true})); }
  catch { fail(400, "External reference must be a valid immutable qualified resource reference."); }
}

function versionLink(project, resource, version) {
  try {
    return clone(assertDocumentVersionLink({
      schema_version: 1,
      reference: createResourceReference({authority: AUTHORITY, workspaceId: project.workspaceId,
        resourceType: "document", resourceId: resource.id, versionId: version.id}),
      size_bytes: version.size,
      media_type: version.mediaType,
      integrity: {algorithm: "SHA256", type: "FULL_OBJECT", value: version.sha256}
    }));
  } catch { fail(400, "Document media type or immutable version identity is invalid."); }
}

function base64Bytes(value, limit = FILE_LIMIT) {
  if (typeof value !== "string") fail(400, "File content must be canonical base64.");
  if (value.length > Math.ceil(limit / 3) * 4) fail(413, "Encoded file exceeds the size limit.");
  // Avoid a repeated-group regexp: valid multi-megabyte files can exhaust the
  // regexp stack. Re-encoding below checks padding and canonical final bits.
  if (value.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(value)) {
    fail(400, "File content must be canonical base64.");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) fail(400, "File content must be canonical base64.");
  if (bytes.length > limit) fail(413, "File exceeds the size limit.");
  return bytes;
}

function readLocalFile(path) {
  if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0")) fail(400, "Choose an absolute local file path.");
  try {
    const stat = statSync(path);
    if (!stat.isFile()) fail(400, "The selected path must be a regular file.");
    if (stat.size > FILE_LIMIT) fail(413, "Files are limited to 16 MiB.");
    const bytes = readFileSync(path);
    if (bytes.length > FILE_LIMIT) fail(413, "Files are limited to 16 MiB.");
    return bytes;
  } catch (error) {
    if (error.status) throw error;
    fail(404, "The local source file is unavailable. Relink the exact version or restore the file.");
  }
}

function normalizeEvidence(value) {
  if (!object(value)) fail(400, "Evidence must be an object.");
  return {id: identifier(value.id), versionId: identifier(value.versionId, "Evidence version"),
    locator: text(value.locator, "Evidence locator", {max: 2000}),
    note: text(value.note, "Evidence note", {optional: true})};
}

// A field record is an immutable source, so existing citations, report snapshots
// and portable packages retain the exact capture without another custody model.

function prepareFieldCapture(command, project, readOriginal) {
  const keys = (value, allowed, label) => {
    if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(400, `${label} contains unsupported fields.`);
  };
  keys(command, ["type", "captureId", "kind", "title", "note", "capturedAt", "author", "sensitivity", "site", "location", "consent", "links", "attachments", "details"], "Field capture");
  const captureId = identifier(command.captureId, "Field capture ID");
  if (captureId.length > 100) fail(400, "Field capture ID is too long.");
  const prefix = `field:${captureId}`;
  const kind = choice(command.kind, ["observation", "photo", "note", "interview", "measurement", "document", "incident"], "Field record kind");
  const sensitivity = choice(command.sensitivity, ["internal", "confidential", "restricted"], "Record sensitivity");
  const record = {format: "esia-field-record", schemaVersion: 1, captureId, projectId: project.id, workspaceId: project.workspaceId,
    kind, title: text(command.title, "Field record title", {max: 2000}), note: text(command.note, "Field notes", {optional: true}),
    capturedAt: timestamp(command.capturedAt, "Field capture time"), author: text(command.author, "Field record author", {max: 1000}),
    sensitivity, site: text(command.site, "Site", {optional: true, max: 2000})};
  if (command.details !== undefined) {try {record.details = normalizeFieldDetails(command.details);} catch (error) {fail(400, error.message);}}
  if (record.details?.successor) {
    const prior = record.details.successor, resource = project.resources.find(item => item.id === `field:${prior.captureId}`), version = resource?.versions.find(item => item.id === prior.sourceVersionId);
    if (prior.captureId === captureId || !version || version.mediaType !== FIELD_MEDIA_TYPE || version.sha256 !== prior.sourceRecordSha256) fail(400, "A successor must identify the exact retained field manifest in this project.");
    const original = JSON.parse(readOriginal(version.id).bytes.toString("utf8"));
    if (original?.format !== "esia-field-record" || original.schemaVersion !== 1 || original.captureId !== prior.captureId) fail(400, "The prior source must be the retained field manifest for this capture identity.");
    const before = original.location?.original ?? null, after = command.location?.original ?? null;
    if (Boolean(before) !== Boolean(after) || before && ["latitude", "longitude", "accuracy", "source", "capturedAt", "crs"].some(key => (before[key] ?? null) !== (after[key] ?? null))) fail(400, "Keep the original GPS unchanged in a successor; apply corrections to its current location.");
    const originalSpatial = original.details?.spatial, nextSpatial = record.details?.spatial;
    if (originalSpatial && (!nextSpatial || stableJson(originalSpatial.originalGeometry) !== stableJson(nextSpatial.originalGeometry) || originalSpatial.revisions.length > nextSpatial.revisions.length || originalSpatial.revisions.some((revision, index) => stableJson(revision) !== stableJson(nextSpatial.revisions[index])))) fail(400, "Keep the original geometry and every retained location revision in a successor.");
    if (originalSpatial && nextSpatial.revisions.length === originalSpatial.revisions.length && stableJson(originalSpatial.currentGeometry) !== stableJson(nextSpatial.currentGeometry)) fail(400, "Append an attributed location revision before changing a successor's geometry.");
  }
  const consent = command.consent ?? {};
  keys(consent, ["interview", "photograph", "audio", "retention", "sharing", "disclosure"], "Consent");
  record.consent = Object.fromEntries(["interview", "photograph", "audio", "retention", "sharing"].map(key =>
    [key, choice(consent[key] ?? "not_recorded", ["not_recorded", "granted", "declined", "not_applicable"], `${key} consent`)]));
  if (Object.hasOwn(consent, "disclosure")) record.consent.disclosure = choice(consent.disclosure, ["not_recorded", "granted", "declined", "not_applicable"], "disclosure consent");
  if (record.consent.retention === "declined") fail(400, "Do not retain this capture when retention consent is recorded as declined.");
  const point = (value, original = false) => {
    if (value === null || value === undefined) return null;
    keys(value, ["latitude", "longitude", "accuracy", "source", "capturedAt", "crs"], "Field location point");
    if (!Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90 ||
        !Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) fail(400, "Field coordinates must be valid WGS84 latitude and longitude.");
    if (value.accuracy !== null && value.accuracy !== undefined && (!Number.isFinite(value.accuracy) || value.accuracy < 0)) fail(400, "Location accuracy must be a non-negative number of metres.");
    return {latitude: value.latitude, longitude: value.longitude, accuracy: value.accuracy ?? null,
      source: choice(value.source, original ? ["device"] : ["device", "manual"], "Location source"),
      capturedAt: timestamp(value.capturedAt, "Location capture time"), crs: choice(value.crs, ["EPSG:4326"], "Location CRS")};
  };
  if (command.location === null || command.location === undefined) record.location = null;
  else {
    keys(command.location, ["original", "current", "disclosure"], "Field location");
    record.location = {original: point(command.location.original, true), current: point(command.location.current),
      disclosure: choice(command.location.disclosure, ["precise", "generalized", "suppressed"], "Location disclosure")};
  }
  if (record.details?.spatial) {
    const geometry = record.details.spatial.currentGeometry, point = record.location?.current;
    if (geometry?.type === "Point" ? !point || point.longitude !== geometry.coordinates[0] || point.latitude !== geometry.coordinates[1] : Boolean(point)) fail(400, "The current point location must match its authored geometry; lines, areas and cleared geometry do not contain a current point.");
  }
  const links = command.links ?? {};
  keys(links, ["assessmentIds", "actionIds", "requirement", "context", ...Object.keys(additionalFieldLinks)], "Field links");
  const ids = (value, records, label) => {
    const result = items(value ?? [], label, 100).map(id => identifier(id, label));
    if (new Set(result).size !== result.length || result.some(id => !records.some(record => record.id === id))) fail(400, `${label} must identify distinct records in this project.`);
    return result;
  };
  record.links = {assessmentIds: ids(links.assessmentIds, project.assessments, "Linked assessments"),
    actionIds: ids(links.actionIds, project.actions, "Linked actions"), requirement: null};
  try {Object.assign(record.links, normalizeAdditionalFieldLinks(links));} catch (error) {fail(400, error.message);}
  for (const priorId of record.links.observationIds || []) {
    const source = project.resources.find(resource => resource.id === `field:${priorId}`)?.versions.find(version => version.mediaType === FIELD_MEDIA_TYPE);
    if (priorId === captureId || !source) fail(400, "Related observations must identify other retained field records in this project.");
    const original = JSON.parse(readOriginal(source.id).bytes.toString("utf8"));
    if (original?.format !== "esia-field-record" || original.schemaVersion !== 1 || original.captureId !== priorId) fail(400, "A related observation must cite its actual retained field manifest.");
  }
  if (Object.keys(additionalFieldLinks).some(key => key !== "observationIds" && record.links[key]?.length) && !links.context?.engagementId) fail(400, "Related engagement records require the owning engagement context.");
  if (links.requirement !== null && links.requirement !== undefined) {
    keys(links.requirement, ["authority", "name", "edition", "clause"], "Requirement context");
    record.links.requirement = Object.fromEntries(["authority", "name", "edition", "clause"].map(key =>
      [key, text(links.requirement[key], `Requirement ${key}`, {max: 2000})]));
  }
  if (links.context !== undefined) {
    keys(links.context, ["requirementId", "siteId", "grievanceId", "commitmentId", "activityId", "engagementId", "programId", "cycleId", "missionId"], "Unverified field context");
    record.links.context = Object.fromEntries(Object.entries(links.context).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) =>
      [key, text(value, `Context ${key}`, {max: 192})]));
  }
  record.contextStatus = "Practitioner-entered context; not an applicability, access or compliance determination.";
  let total = 0;
  const files = items(command.attachments ?? [], "Field attachments", 6).map((value, index) => {
    keys(value, ["filename", "mediaType", "contentBase64", "sha256"], "Field attachment");
    const bytes = base64Bytes(value.contentBase64);
    if (!bytes.length) fail(400, "Field attachments must contain original bytes.");
    total += bytes.length;
    if (total > FIELD_ATTACHMENT_LIMIT) fail(413, "A field capture is limited to 20 MiB of attachment bytes.");
    const mediaType = text(value.mediaType, "Attachment media type", {max: 256}).toLowerCase();
    if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(mediaType)) fail(400, "Attachment media type must be a valid MIME type.");
    if (record.consent.audio === "declined" && mediaType.startsWith("audio/")) fail(400, "Do not retain audio when audio consent is recorded as declined.");
    if (record.consent.photograph === "declined" && mediaType.startsWith("image/")) fail(400, "Do not retain images when photograph consent is recorded as declined.");
    const sha256 = digest(bytes);
    if (value.sha256 !== undefined && value.sha256 !== sha256) fail(400, "Attachment bytes do not match their SHA256.");
    const identity = `${prefix}:attachment:${index + 1}`;
    return {bytes, descriptor: {resourceId: identity, versionId: `${identity}:version`, evidenceId: `${identity}:evidence`,
      filename: filename(value.filename), mediaType, sha256, size: bytes.length}};
  });
  record.attachments = files.map(file => file.descriptor);
  const bytes = Buffer.from(stableJson(record));
  return {record, resourceId: prefix, versionId: `${prefix}:version`, evidenceId: `${prefix}:evidence`, bytes, sha256: digest(bytes), files};
}

function normalizeAssessment(value) {
  if (!object(value) || !object(value.framework) || !object(value.applicability)) fail(400, "Assessment requires a framework and applicability decision.");
  const framework = {};
  for (const key of ["authority", "name", "edition", "clause"]) framework[key] = text(value.framework[key], `Framework ${key}`, {max: 2000});
  const applicability = {decision: choice(value.applicability.decision, ["applies", "does_not_apply", "uncertain"], "Applicability")};
  for (const key of ["rationale", "scope", "period"]) applicability[key] = text(value.applicability[key], `Applicability ${key}`);
  const conclusion = choice(value.conclusion, ["gap", "conforms", "insufficient_evidence", "not_applicable"], "Assessment conclusion");
  if ((applicability.decision === "does_not_apply") !== (conclusion === "not_applicable")) {
    fail(400, "A not-applicable conclusion requires a does-not-apply decision, and vice versa.");
  }
  const evidenceIds = items(value.evidenceIds, "Assessment evidence").map(id => identifier(id, "Assessment evidence ID"));
  if (new Set(evidenceIds).size !== evidenceIds.length) fail(400, "Assessment evidence IDs must be unique.");
  const assessment = {id: identifier(value.id), reviewedAt: timestamp(value.reviewedAt, "Review time"), framework,
    applicability, conclusion, reviewer: text(value.reviewer, "Reviewer", {max: 1000}),
    rationale: text(value.rationale, "Assessment rationale"), evidenceIds,
    missingEvidence: text(value.missingEvidence, "Missing evidence", {optional: true}),
    uncertainty: text(value.uncertainty, "Uncertainty", {optional: true}),
    riskSignificance: text(value.riskSignificance, "Risk significance", {optional: true})};
  if (value.auditContext !== undefined) {
    const context = value.auditContext;
    if (!object(context) || !sameJson(context.framework, framework)) fail(400, "Audit context must retain the assessment's exact framework and clause.");
    assessment.auditContext = {frameworkId: identifier(context.frameworkId), checkId: identifier(context.checkId),
      checkSet: text(context.checkSet, "Check set", {max: 100}), registryVersion: text(context.registryVersion, "Registry version", {max: 100}),
      topic: text(context.topic, "Audit topic", {max: 100}), prompt: text(context.prompt, "Audit prompt"),
      checkedAt: date(context.checkedAt), framework: clone(framework),
      sources: items(context.sources, "Framework sources", 20).map(source => {
        if (!object(source)) fail(400, "Framework source must be an object.");
        if (source.sha256 !== undefined && !hashPattern.test(source.sha256)) fail(400, "Framework source hash must be SHA256.");
        return {title: text(source.title, "Source title", {max: 2000}), url: sourceUrl(source.url, "Framework source URL"),
          locator: text(source.locator, "Framework source locator", {optional: true, max: 2000}), ...(source.sha256 ? {sha256: source.sha256} : {})};
      })};
    if (!assessment.auditContext.sources.length) fail(400, "An audit check requires its source references.");
    if (context.coverage !== undefined) assessment.auditContext.coverage = text(context.coverage, "Audit coverage", {max: 2000});
    if (context.definition !== undefined) assessment.auditContext.definition = retainedDefinition(context.definition, assessment.auditContext);
    if (["detailed", "diagnostic"].includes(context.checkSet) && !assessment.auditContext.definition) fail(400, "Detailed and diagnostic accounting require a frozen definition.");
    if (context.sector !== undefined) {
      if (!object(context.sector) || !context.sector.id || !Array.isArray(context.sector.issues)) fail(400, "Sector context must retain its profile and issue prompts.");
      assessment.auditContext.sector = retainedJson(context.sector, "Sector profile", 256 * 1024);
    }
    if (context.definitionReview !== undefined) {
      if (!assessment.auditContext.definition || !object(context.definitionReview)) fail(400, "Requirement interpretation needs a retained source definition.");
      const review = {reviewStatus: "practitioner_reviewed", reviewer: assessment.reviewer, reviewedAt: assessment.reviewedAt};
      for (const key of ["actor", "requirement", "conditions", "verificationEvidence"]) review[key] = text(context.definitionReview[key], `Requirement interpretation ${key}`);
      review.exceptions = text(context.definitionReview.exceptions, "Requirement exceptions", {optional: true});
      assessment.auditContext.definitionReview = review;
    }
  }
  return assessment;
}

function normalizeActionState(value) {
  if (!object(value)) fail(400, "Action must be an object.");
  const action = {id: identifier(value.id), assessmentId: identifier(value.assessmentId, "Action assessment"),
    description: text(value.description, "Action description"), owner: text(value.owner, "Accountable party", {max: 2000}),
    dueDate: date(value.dueDate), status: choice(value.status, ["open", "in_progress", "closed"], "Action status"),
    closureEvidence: text(value.closureEvidence, "Required closure evidence"),
    verification: text(value.verification, "Closure verification", {optional: true})};
  if (action.status === "closed" && !action.verification.trim()) fail(400, "Closing an action requires recorded verification.");
  if (value.revision !== undefined) {
    if (!Number.isSafeInteger(value.revision) || value.revision < 1) fail(400, "Action revision must be a positive integer.");
    Object.assign(action, {revision: value.revision, updatedAt: timestamp(value.updatedAt, "Action update time"),
      reviewer: text(value.reviewer, "Action reviewer", {max: 1000}), updateNote: text(value.updateNote, "Action update note"),
      closureEvidenceIds: items(value.closureEvidenceIds, "Action closure evidence").map(id => identifier(id, "Closure evidence ID"))});
    if (new Set(action.closureEvidenceIds).size !== action.closureEvidenceIds.length) fail(400, "Closure evidence IDs must be unique.");
    if (action.status === "closed" && !action.closureEvidenceIds.length) fail(400, "Closing an action requires linked closure evidence and a reviewer.");
  }
  return action;
}

function normalizeAction(value) {
  const action = normalizeActionState(value);
  if (action.revision !== undefined) {
    action.history = items(value.history, "Action history").map(normalizeActionState);
    if (action.history.length !== action.revision - 1 || action.history.some((entry, index) =>
      entry.id !== action.id || entry.assessmentId !== action.assessmentId || (entry.revision ?? 1) !== index + 1 || (!entry.revision && index !== 0))) {
      fail(400, "Action history must retain every preceding revision in order.");
    }
  } else if (value.history !== undefined) fail(400, "Action history requires a revision.");
  return action;
}

function actionAtRevision(action, revision) {
  if (!action || (action.revision ?? 1) < revision) return;
  if ((action.revision ?? 1) === revision) return action;
  const state = action.history[revision - 1];
  return state.revision ? {...state, history: action.history.slice(0, revision - 1)} : state;
}

function normalizeReportPresentation(value, snapshot) {
  if (!object(value) || value.schemaVersion !== 1 || value.rendererVersion !== gapReportRendererVersion) fail(400, "Unknown report presentation version.");
  const result = {schemaVersion: 1, rendererVersion: gapReportRendererVersion,
    paperSize: choice(value.paperSize, ["A4", "Letter"], "Report paper size"), frameworks: items(value.frameworks, "Report framework scope", 100).map(entry => {
      if (!object(entry)) fail(400, "Report framework scope must be an object.");
      const framework = {authority: text(entry.authority, "Report framework authority", {max: 2000}), name: text(entry.name, "Report framework name", {max: 2000}), edition: text(entry.edition, "Report framework edition", {max: 2000}),
        standards: items(entry.standards, "Report standard headings", 100).map(value => text(value, "Report standard heading", {max: 2000})), basis: text(entry.basis, "Report scope basis", {max: 2000})};
      if (new Set(framework.standards).size !== framework.standards.length || !framework.standards.length) fail(400, "Report standard headings must be nonempty and unique.");
      return framework;
    })};
  const key = framework => JSON.stringify([framework.authority, framework.name, framework.edition]);
  if (new Set(result.frameworks.map(key)).size !== result.frameworks.length) fail(400, "Report framework editions must be unique.");
  for (const entry of result.frameworks) if (!snapshot.assessments.some(assessment => key(assessment.framework) === key(entry))) fail(400, "Report scope contains an edition outside its assessment snapshot.");
  for (const assessment of snapshot.assessments) {
    const entry = result.frameworks.find(entry => key(entry) === key(assessment.framework));
    if (!entry?.standards.includes(reportStandard(assessment))) fail(400, "Report scope omits a retained assessment's standard.");
  }
  return result;
}

// Construct only portable fields. Physical paths and availability are device-local
// projections and are intentionally never accepted as project records.
function normalizeProject(value, {snapshot = false} = {}) {
  if (!object(value) || ![1, 2].includes(value.schemaVersion) || !object(value.engagement)) fail(400, "Unsupported project schema.");
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) fail(400, "Project revision must be a positive integer.");
  const project = {schemaVersion: value.schemaVersion, id: identifier(snapshot ? value.projectId : value.id, "Project ID"),
    workspaceId: identifier(value.workspaceId, "Workspace ID"), name: text(value.name, "Project name", {max: 2000}),
    engagement: {id: identifier(value.engagement.id, "Engagement ID"),
      client: text(value.engagement.client, "Client", {max: 2000}),
      phase: text(value.engagement.phase, "Lifecycle phase", {max: 1000}),
      period: text(value.engagement.period, "Engagement period", {max: 1000})}, revision: value.revision,
    resources: [], evidence: [], assessments: [], actions: [], reports: []};
  const seen = new Set([project.id, project.workspaceId, project.engagement.id]);
  const claim = id => {
    if (seen.has(id)) fail(400, "Record IDs must be unique within a project.");
    seen.add(id);
  };
  const versionIds = new Set();
  const derivationBaseRevisions = new Set();
  for (const rawResource of items(value.resources, "Resources")) {
    if (!object(rawResource)) fail(400, "Resource must be an object.");
    const resource = {id: identifier(rawResource.id), title: text(rawResource.title, "Resource title", {max: 2000}), versions: []};
    claim(resource.id);
    for (const rawVersion of items(rawResource.versions, "Resource versions")) {
      if (!object(rawVersion)) fail(400, "Version must be an object.");
      if (!Number.isSafeInteger(rawVersion.size) || rawVersion.size < 0 || rawVersion.size > HANDOVER_FILE_LIMIT) fail(400, "Invalid version size.");
      if (typeof rawVersion.sha256 !== "string" || !hashPattern.test(rawVersion.sha256)) fail(400, "Invalid source SHA256.");
      const version = {id: identifier(rawVersion.id), filename: filename(rawVersion.filename),
        sha256: rawVersion.sha256, size: rawVersion.size, mediaType: text(rawVersion.mediaType, "Media type", {max: 256}),
        mode: choice(rawVersion.mode, ["managed", "registered"], "Storage mode"),
        capturedAt: timestamp(rawVersion.capturedAt, "Version time")};
      claim(version.id);
      versionIds.add(version.id);
      const link = versionLink(project, resource, version);
      if (!sameJson(rawVersion.reference, link.reference) ||
          !sameJson(rawVersion.documentVersionLink, link)) fail(400, "Version reference does not match its project, resource, hash or size.");
      version.reference = link.reference;
      version.documentVersionLink = link;
      if (rawVersion.externalReference !== undefined) version.externalReference = immutableReference(rawVersion.externalReference);
      const source = sourceMetadata(rawVersion.source);
      if (source !== undefined) version.source = source;
      if (rawVersion.intakeMetadata !== undefined) version.intakeMetadata = intakeMetadata(rawVersion.intakeMetadata, version.sha256,version.id);
      if (rawVersion.derivation !== undefined) {
        version.derivation = normalizeGeoJsonDerivation(rawVersion.derivation, {project, resource, version, priorVersions:resource.versions});
        claim(version.derivation.requestId);
        if (derivationBaseRevisions.has(version.derivation.baseProjectRevision)) fail(400, 'One project revision cannot contain two source-edit operations.');
        derivationBaseRevisions.add(version.derivation.baseProjectRevision);
      }
      if (resource.versions.some(old => old.sha256 === version.sha256)) fail(400, "A resource cannot contain duplicate content versions.");
      resource.versions.push(version);
    }
    if (!resource.versions.length) fail(400, "A resource must have a version.");
    if (rawResource.metadataHistory !== undefined) {
      const priorMetadata=new Map(resource.versions.map(version=>[version.id,documentMetadataBaseline(resource,version)]));
      resource.metadataHistory = items(rawResource.metadataHistory, "Metadata correction history").map(entry => {
        if (!object(entry)) fail(400, "Metadata history entry must be an object.");
        const result = {id: identifier(entry.id, "Metadata history ID"),
          versionId: identifier(entry.versionId, "Metadata history source version"),
          at: timestamp(entry.at, "Metadata correction time"), metadata: intakeMetadata(entry.metadata, resource.versions.find(version => version.id === entry.versionId)?.sha256,entry.versionId)};
        claim(result.id);
        if (!resource.versions.some(version => version.id === result.versionId)) {
          fail(400, "Metadata correction history points to a version outside its resource.");
        }
        const previous=priorMetadata.get(result.versionId);if(entry.operation!==undefined&&entry.operation!=="document-relation-review")fail(400,"Metadata history contains an unsupported trusted review marker.");
        if(canonicalDocumentValue(previous?.revisionRelation)!==canonicalDocumentValue(result.metadata.revisionRelation)){
          const relation=result.metadata.revisionRelation;if(!relation||entry.operation!=="document-relation-review"||entry.actorId!==relation.review.actorId||result.at!==relation.review.at||canonicalDocumentValue(documentComparisonMetadata(previous))!==canonicalDocumentValue(documentComparisonMetadata(result.metadata)))fail(400,"Retained document relationship changes require their exact trusted review marker, reviewer, time and unchanged description.");
        }
        if(entry.operation){result.operation=entry.operation;result.actorId=text(entry.actorId,"Relationship reviewer",{max:300});}priorMetadata.set(result.versionId,result.metadata);
        return result;
      });
    }
    project.resources.push(resource);
  }
  for(const engagementId of new Set(project.resources.flatMap(resource=>resource.versions.map(version=>effectiveMetadata(resource,version)?.revisionRelation?.engagementId)).filter(Boolean)))validateDocumentRevisionGraph(project,engagementId);
  for (const raw of items(value.evidence, "Evidence")) {
    const evidence = normalizeEvidence(raw);
    claim(evidence.id);
    if (!versionIds.has(evidence.versionId)) fail(400, "Evidence points to a missing source version.");
    project.evidence.push(evidence);
  }
  const evidenceIds = new Set(project.evidence.map(item => item.id));
  for (const raw of items(value.assessments, "Assessments")) {
    const assessment = normalizeAssessment(raw);
    claim(assessment.id);
    if (assessment.evidenceIds.some(id => !evidenceIds.has(id))) fail(400, "Assessment points to missing evidence.");
    project.assessments.push(assessment);
  }
  const assessmentIds = new Set(project.assessments.map(item => item.id));
  for (const raw of items(value.actions, "Actions")) {
    const action = normalizeAction(raw);
    claim(action.id);
    if (!assessmentIds.has(action.assessmentId)) fail(400, "Action points to a missing assessment.");
    for (const entry of [...(action.history || []), action]) {
      if (entry.closureEvidenceIds?.some(id => !evidenceIds.has(id))) fail(400, "Action points to missing closure evidence.");
    }
    project.actions.push(action);
  }
  if (!snapshot) {
    for (const raw of items(value.reports, "Reports", 1000)) {
      if (!object(raw) || !object(raw.snapshot)) fail(400, "Report requires an issued snapshot.");
      const snap = normalizeProject(raw.snapshot, {snapshot: true});
      if (snap.id !== project.id || snap.workspaceId !== project.workspaceId || snap.revision > project.revision) {
        fail(400, "Report snapshot crosses its project or revision boundary.");
      }
      const template = sameJson(raw.template, TEMPLATE) ? TEMPLATE : sameJson(raw.template, STYLED_TEMPLATE) ? STYLED_TEMPLATE : null;
      if (!template || !sameJson(raw.snapshot.template, template)) fail(400, "Unknown report template version.");
      if (template.version === 1 && raw.presentation !== undefined) fail(400, "Styled report presentation requires template version 2.");
      for (const resource of snap.resources) {
        const live = project.resources.find(candidate => candidate.id === resource.id);
        if (!live || live.title !== resource.title) fail(400, "Report snapshot resource does not match the retained project resource.");
        const history = resource.metadataHistory ?? [];
        if (!sameJson(history, (live.metadataHistory ?? []).slice(0, history.length))) {
          fail(400, "Report snapshot metadata history must be an unchanged prefix of retained corrections.");
        }
        for (const version of resource.versions) {
          const liveVersion = live.versions.find(candidate => candidate.id === version.id);
          // Capturing a registered original improves custody after issue. All
          // descriptive version identity and content fields remain immutable.
          const identity = value => value && Object.fromEntries(Object.entries(value).filter(([key]) => key !== "mode"));
          if (!sameJson(identity(liveVersion), identity(version)) || (version.mode === "managed" && liveVersion?.mode !== "managed")) {
            fail(400, "Report snapshot source versions must match retained project sources.");
          }
        }
      }
      for (const key of ["evidence", "assessments", "actions"]) {
        for (const record of snap[key]) {
          const live = project[key].find(candidate => candidate.id === record.id);
          if (!sameJson(key === "actions" ? actionAtRevision(live, record.revision ?? 1) : live, record)) {
            fail(400, `Report snapshot ${key} must match retained project records.`);
          }
        }
      }
      const report = {id: identifier(raw.id), issuedAt: timestamp(raw.issuedAt, "Report issue time"),
        title: text(raw.title, "Report title", {max: 2000}), narrative: text(raw.narrative, "Report narrative", {optional: true}),
        reviewer: text(raw.reviewer, "Report reviewer", {max: 1000}), template: clone(template),
        snapshot: makeSnapshot(snap, template), markdown: text(raw.markdown, "Issued Markdown", {max: 2 * 1024 * 1024}),
        ...(template.version === 2 ? {presentation: normalizeReportPresentation(raw.presentation, snap)} : {})};
      claim(report.id);
      if (report.markdown !== renderReport(report)) fail(400, "Issued Markdown does not match its frozen snapshot.");
      project.reports.push(report);
    }
  }
  if (hasSourceDerivations(project) && project.schemaVersion !== 2) fail(400, 'Typed source derivation history requires project schema version 2.');
  return project;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sameJson(a, b) { return stableJson(a) === stableJson(b); }

function assertPackageJsonSize(value) {
  let serialized;
  try { serialized = JSON.stringify(value); }
  catch { fail(400, "A project package must be serializable JSON."); }
  if (Buffer.byteLength(serialized, "utf8") > localWorkspaceMaxJsonBytes) {
    fail(413, "Project packages are limited to 48 MiB of compact JSON, including source bytes, metadata and frozen reports.");
  }
}

function makeSnapshot(project, template = TEMPLATE) {
  return {schemaVersion: project.schemaVersion, projectId: project.id, workspaceId: project.workspaceId, name: project.name,
    engagement: clone(project.engagement), revision: project.revision, template: clone(template),
    resources: clone(project.resources), evidence: clone(project.evidence),
    assessments: clone(project.assessments), actions: clone(project.actions)};
}

const md = value => String(value).replace(/[\\`*_{}\[\]<>#!|]/g, "\\$&").replace(/\r?\n/g, " ");

function renderReport(report) {
  const snapshot = report.snapshot;
  const lines = [`# ${md(report.title)}`, "", `Project: ${md(snapshot.name)}`, "",
    `Client: ${md(snapshot.engagement.client)} · Phase: ${md(snapshot.engagement.phase)} · Period: ${md(snapshot.engagement.period)}`, "",
    `Issued: ${report.issuedAt} · Reviewer: ${md(report.reviewer)} · Template: gap-analysis v${report.template.version} · Project revision: ${snapshot.revision}`, ""];
  if (report.narrative) lines.push(report.narrative, "");
  const allVersions = new Map(snapshot.resources.flatMap(resource => resource.versions.map(version => [version.id, {resource, version}])));
  const allEvidence = new Map(snapshot.evidence.map(evidence => [evidence.id, evidence]));
  lines.push("## Reviewed assessments", "");
  if (!snapshot.assessments.length) lines.push("No assessments were recorded at issue time.", "");
  for (const assessment of snapshot.assessments) {
    const f = assessment.framework;
    lines.push(`### ${md(f.name)} — ${md(f.edition)}, ${md(f.clause)}`, "",
      `Authority: ${md(f.authority)}`, "",
      `Applicability: ${md(assessment.applicability.decision)}. ${md(assessment.applicability.rationale)}`, "",
      `Scope: ${md(assessment.applicability.scope)} · Period: ${md(assessment.applicability.period)}`, "",
      `Conclusion: ${md(assessment.conclusion)}. ${md(assessment.rationale)}`, "",
      `Reviewed by ${md(assessment.reviewer)} at ${assessment.reviewedAt}.`, "",
      `Missing evidence: ${md(assessment.missingEvidence || "None recorded")}`, "",
      `Uncertainty: ${md(assessment.uncertainty || "None recorded")}`, "",
      `Risk significance: ${md(assessment.riskSignificance || "Not recorded")}`, "");
    if (assessment.auditContext) {
      const context = assessment.auditContext;
      lines.push(`Audit check: \`${context.checkId}\` · ${md(context.checkSet)} · Registry ${md(context.registryVersion)}; sources checked ${context.checkedAt}.`, "",
        `Review prompt: ${md(context.prompt)}`, "");
      if (context.coverage) lines.push(`Check coverage: ${md(context.coverage)}`, "");
      else if (context.checkSet === "workbook") lines.push("Workbook clause mappings have not been revalidated.", "");
      for (const source of context.sources) lines.push(`- Framework source: ${md(source.title)}; ${md(source.locator)}; <${new URL(source.url).href}>`);
      lines.push("");
      if (context.definition) {
        const definition = context.definition;
        lines.push(`Retained definition: ${md(definition.parserVersion)}; ${md(definition.reviewStatus)}. Source statements remain unreviewed definitions, independently of this project finding.`, "");
        if (definition.detail) lines.push(`Source statement (PDF page ${definition.detail.page}; SHA256 ${definition.detail.sourceSha256}): ${md(definition.detail.sourceText)}`, "");
        if (definition.memberIds) lines.push(`Diagnostic member IDs (no automatic member conclusions): ${definition.memberIds.map(id => `\`${id}\``).join(", ")}`, "");
        lines.push("The portable project package retains the definition, qualification context and any member definitions.", "");
      }
      if (context.sector) lines.push(`Sector screening context: ${md(context.sector.name)}. Practitioner attention prompts do not determine applicability or compliance.`, "");
      if (context.definitionReview) {
        const review = context.definitionReview;
        lines.push(`Practitioner requirement interpretation by ${md(review.reviewer)} at ${review.reviewedAt}:`, "",
          `Actor: ${md(review.actor)}`, "", `Requirement: ${md(review.requirement)}`, "", `Conditions: ${md(review.conditions)}`, "",
          `Exceptions: ${md(review.exceptions || "None recorded")}`, "", `Verification evidence: ${md(review.verificationEvidence)}`, "");
      }
    }
    if (!assessment.evidenceIds.length) lines.push("Evidence: none cited.", "");
    for (const id of assessment.evidenceIds) {
      const evidence = allEvidence.get(id);
      const {resource, version} = allVersions.get(evidence.versionId);
      const ref = version.reference;
      const metadata = effectiveMetadata(resource, version);
      lines.push(`- Evidence ${md(id)}: ${md(metadata?.title ?? resource.title)}; ${md(evidence.locator)}. ${md(evidence.note || "")}`,
        `  Exact source: ${ref.authority} / ${ref.workspace_id} / ${ref.resource_id} / ${ref.version_id}; SHA256 ${version.sha256}; ${md(version.filename)}.`,
        ...(metadata ? [`  Document metadata: authors ${md(metadata.authors.join("; ") || "Not recorded")}; date ${md(metadata.documentDate || "Not recorded")}; tags ${md(metadata.tags.map(tag => tag.label).join("; ") || "None recorded")}.`] : []),
        ...(version.externalReference ? [`  External source identity: ${md(JSON.stringify(version.externalReference))}.`] : []),
        ...(version.mode === "registered" ? ["  Availability: registered reference; original bytes are not preserved by this report."] : []));
    }
    lines.push("");
  }
  lines.push("## Corrective actions", "");
  if (!snapshot.actions.length) lines.push("No actions were recorded at issue time.", "");
  for (const action of snapshot.actions) {
    lines.push(`- ${md(action.description)} — Owner: ${md(action.owner)}; due ${action.dueDate}; status ${action.status}.`,
      `  Assessment: ${md(action.assessmentId)}. Required closure evidence: ${md(action.closureEvidence || "Not recorded")}. Verification: ${md(action.verification || "Not recorded")}.`, "");
    if (action.revision) {
      lines.push(`  Action revision ${action.revision}; reviewed by ${md(action.reviewer)} at ${action.updatedAt}. ${md(action.updateNote)}`, "");
      for (const id of action.closureEvidenceIds) {
        const evidence = snapshot.evidence.find(item => item.id === id);
        const resource = snapshot.resources.find(item => item.versions.some(version => version.id === evidence.versionId));
        const version = resource.versions.find(item => item.id === evidence.versionId);
        lines.push(`  Closure evidence ${md(id)}: ${md(evidence.locator)} — ${md(evidence.note)}; source version ${md(version.id)}; SHA256 ${version.sha256}.`, "");
      }
    }
  }
  if (report.presentation) {
    lines.push("## Retained report presentation", "", `Paper: ${report.presentation.paperSize}; renderer: ${report.presentation.rendererVersion}.`, "");
    for (const framework of report.presentation.frameworks) lines.push(`- ${md(framework.authority)} — ${md(framework.name)} — ${md(framework.edition)}: ${framework.standards.map(md).join("; ")}. ${md(framework.basis)}`);
    lines.push("", "Counts describe retained review records, not an overall compliance percentage. Unassessed headings are not an applicability decision or a complete requirement inventory.", "",
      `Presentation SHA256: ${digest(Buffer.from(stableJson(report.presentation)))}`, "");
  }
  return lines.join("\n");
}

/** Pure native projection for trusted stored project records. This validates
 * identity without asserting file availability or granting upstream access. */
export function observeLocalProjectSources(retained) {
  let count = 0;
  for (const resource of items(retained?.resources, 'Resources')) {
    count += items(resource?.versions, 'Resource versions').length;
    if (count > 10000) fail(413, 'A source metadata observation is limited to 10000 retained versions.');
  }
  const project = normalizeProject(retained);
  return freezeTree({format:'esia-local-project-source-observation', schemaVersion:1,
    projectId:project.id, workspaceId:project.workspaceId, projectRevision:project.revision,
    contentReadiness:'not-observed', resources:project.resources.map(resource => ({id:resource.id, title:resource.title,
      versions:resource.versions.map(version => ({id:version.id, reference:clone(version.reference), sha256:version.sha256,
        size:version.size, mediaType:version.mediaType, filename:version.filename, mode:version.mode, capturedAt:version.capturedAt,
        contentReadiness:'not-observed', ...(version.derivation ? {derivation:clone(version.derivation)} : {}),
        ...(version.externalReference ? {externalReference:clone(version.externalReference)} : {})}))}))});
}

/** A bounded, single-user local custody adapter. No remote calls or sync are performed. */
export function createLocalWorkspaceStore({directory} = {}) {
  if (typeof directory !== "string" || !directory.trim()) fail(400, "A private data directory is required.");
  const root = resolve(directory);
  const objects = join(root, "objects", "sha256");
  mkdirSync(objects, {recursive: true, mode: 0o700});
  const db = new DatabaseSync(join(root, "workspace.sqlite"));
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS locations (project_id TEXT NOT NULL REFERENCES projects(id), version_id TEXT NOT NULL, path TEXT NOT NULL,
      PRIMARY KEY (project_id, version_id));`);
  const schema = db.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get();
  if (schema && !["1", "2"].includes(schema.value)) { db.close(); fail(409, "Unsupported local database schema."); }
  db.prepare("INSERT OR IGNORE INTO metadata (key, value) VALUES ('schema_version', '1')").run();
  const readerFloor = () => {
    const value = db.prepare("SELECT value FROM metadata WHERE key = 'schema_version'").get()?.value;
    if (!["1", "2"].includes(value)) fail(409, 'This workspace requires a newer compatible local reader.');
    return value;
  };
  const retainReaderFloor = project => {
    readerFloor();
    // This runs only inside the same transaction as the authoritative project
    // write. A failed edit/import rolls the compatibility floor back as well.
    if (project.schemaVersion === 2) db.prepare("UPDATE metadata SET value = '2' WHERE key = 'schema_version' AND value = '1'").run();
  };
  const read = id => {
    const floor = readerFloor();
    identifier(id, "Project ID");
    const row = db.prepare("SELECT json FROM projects WHERE id = ?").get(id);
    if (!row) fail(404, "Project was not found.");
    const project = JSON.parse(row.json);
    if (project.schemaVersion === 2 && floor !== '2') fail(409, 'This project requires its committed workspace reader floor.');
    return project;
  };
  const save = project => {
    retainReaderFloor(project);
    db.prepare("INSERT INTO projects (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json").run(project.id, JSON.stringify(project));
  };
  const transaction = work => {
    db.exec("BEGIN IMMEDIATE");
    try { readerFloor(); const result = work(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  };
  const physicalPath = (projectId, version) => version.mode === "managed" ? join(objects, version.sha256) :
    db.prepare("SELECT path FROM locations WHERE project_id = ? AND version_id = ?").get(projectId, version.id)?.path;
  // Invocation-private accounting for the receipt-only editor adapter. Existing
  // project views keep their availability semantics; this path never builds one.
  let editorBudget;
  const authorizeEditor = stage => {if(editorBudget.authorize({stage})!==true)fail(403,'Current owner editor authority is required.');};
  const editorRead = path => {
    authorizeEditor('before-source-read');
    let fd;
    try {
      if (typeof constants.O_NOFOLLOW !== 'number' || typeof constants.O_NONBLOCK !== 'number' || !isAbsolute(path) || resolve(path) !== path) fail(409, 'This host cannot provide strict editor original reads.');
      const parents = [];
      for (let cursor = dirname(path);; cursor = dirname(cursor)) {
        const info = lstatSync(cursor, {bigint:true});
        if (!info.isDirectory() || info.isSymbolicLink()) fail(409, 'Editor originals require ordinary directory ancestors.');
        parents.push({path:cursor,info});
        if (cursor === dirname(cursor)) break;
      }
      const namedBefore = lstatSync(path, {bigint:true}), keys = ['dev','ino','size','mtimeNs','ctimeNs','mode','uid','nlink'];
      if (!namedBefore.isFile() || namedBefore.isSymbolicLink() || namedBefore.nlink !== 1n) fail(409, 'Editor originals must be ordinary files with a single link.');
      fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const before = fstatSync(fd, {bigint:true}), remaining = editorBudget.maxReadBytes - editorBudget.readBytes;
      if (!before.isFile() || before.nlink !== 1n || keys.some(key => before[key] !== namedBefore[key])) fail(409, 'The editor original changed before its bounded read.');
      if (before.size > BigInt(remaining)) fail(413, 'The owner original-read budget was exhausted.');
      const bytes = Buffer.alloc(Number(before.size));let at = 0;
      editorBudget.readCount++;
      while (at < bytes.length) {
        const count = readSync(fd, bytes, at, bytes.length - at, at);
        if (!count) fail(409, 'The editor original changed while reading.');
        at += count;editorBudget.readBytes += count;
      }
      const after = fstatSync(fd, {bigint:true}), namedAfter = lstatSync(path, {bigint:true});
      if (!namedAfter.isFile() || namedAfter.isSymbolicLink() || keys.some(key => before[key] !== after[key] || after[key] !== namedAfter[key])) fail(409, 'The editor original changed while reading.');
      for (const parent of parents) {
        const current = lstatSync(parent.path, {bigint:true});
        if (!current.isDirectory() || current.isSymbolicLink() || ['dev','ino','mode','uid'].some(key => parent.info[key] !== current[key])) fail(409, 'The editor original path changed while reading.');
      }
      authorizeEditor('after-source-read');return bytes;
    } catch (error) {
      if (error.status) throw error;
      fail(error.code === 'ENOENT' ? 404 : 409, 'The editor original could not be opened safely.');
    } finally {if (fd !== undefined) closeSync(fd);}
  };
  const editorOperation = (options, work) => {
    if (editorBudget || typeof options?.authorize !== 'function' || !Number.isSafeInteger(options.maxReadBytes) || options.maxReadBytes < 1 || options.maxReadBytes > 6 * 1024 * 1024 || !Number.isSafeInteger(options.maxWriteBytes) || options.maxWriteBytes < 0 || options.maxWriteBytes > 2 * 1024 * 1024) fail(400, 'Use a trusted bounded owner editor invocation.');
    editorBudget = {...options,readBytes:0,readCount:0,writeBytes:0,writeCount:0};
    try {
      authorizeEditor('before-operation');const value = work();
      const {readBytes,readCount,writeBytes,writeCount} = editorBudget;
      return {value,ownerIo:{readBytes,readCount,writeBytes,writeCount,maxReadBytes:options.maxReadBytes,maxWriteBytes:options.maxWriteBytes}};
    } finally {editorBudget = undefined;}
  };
  const availableBytes = (projectId, version) => {
    const path = physicalPath(projectId, version);
    if (!path) return {availability: "unavailable"};
    try {
      const stat = statSync(path);
      if (!stat.isFile()) return {availability: "unavailable"};
      if (stat.size !== version.size || stat.size > HANDOVER_FILE_LIMIT) return {availability: "changed"};
      const bytes = editorBudget ? editorRead(path) : readFileSync(path);
      if (digest(bytes) !== version.sha256) return {availability: "changed"};
      return {availability: "available", bytes};
    } catch (error) {if (editorBudget && error.status) throw error;return {availability: "unavailable"};}
  };
  const projectView = project => {
    const result = clone(project);
    for (const resource of result.resources) for (const version of resource.versions) {
      version.availability = availableBytes(project.id, version).availability;
      const metadata = effectiveMetadata(resource, version);
      if (metadata !== undefined) version.effectiveMetadata = clone(metadata);
    }
    return result;
  };
  const putObject = (sha256, bytes) => {
    const target = join(objects, sha256);
    if (existsSync(target)) {
      if (digest(editorBudget ? editorRead(target) : readFileSync(target)) !== sha256) fail(409, "A managed object failed its integrity check. Restore the private data directory from backup.");
      return;
    }
    const temporary = join(objects, `.incoming-${newId()}`);
    try {
      if (editorBudget) {
        authorizeEditor('before-source-write');
        if (bytes.length > editorBudget.maxWriteBytes - editorBudget.writeBytes) fail(413, 'The owner original-write budget was exhausted.');
      }
      writeFileSync(temporary, bytes, {flag: "wx", mode: 0o600});
      if (editorBudget) {editorBudget.writeBytes += bytes.length;editorBudget.writeCount++;authorizeEditor('after-source-write');}
      renameSync(temporary, target);
    } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  };
  const locate = (project, versionId) => {
    identifier(versionId, "Source version ID");
    for (const resource of project.resources) {
      const version = resource.versions.find(candidate => candidate.id === versionId);
      if (version) return {resource, version};
    }
    fail(404, "Source version was not found in this project.");
  };

  return {
    listProjects() {
      readerFloor();
      return db.prepare("SELECT json FROM projects ORDER BY rowid").all().map(row => {
        const project = JSON.parse(row.json);
        return {id: project.id, workspaceId: project.workspaceId, name: project.name,
          engagement: project.engagement, revision: project.revision,
          counts: Object.fromEntries(["resources", "evidence", "assessments", "actions", "reports"].map(key => [key, project[key].length]))};
      });
    },
    // Homepage work uses SQLite metadata only. It must never turn a directory
    // visit into a read/hash of every retained original.
    listWorkItems({after = "", limit = 30, projectId = ""} = {}) {
      readerFloor();
      if (typeof after !== "string" || after.length > 1000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail(400, "Choose a bounded work page of 1–100 records.");
      if (projectId) {identifier(projectId, "Project ID");if(!db.prepare("SELECT id FROM projects WHERE id=?").get(projectId))fail(404,"Project was not found.");}
      const rows = db.prepare(`WITH work AS (
        SELECT p.id projectId, substr(json_extract(p.json,'$.name'),1,200) projectName,
          json_extract(a.value,'$.id') id, 'project_action' recordType,
          substr(json_extract(a.value,'$.description'),1,500) title,
          substr(json_extract(a.value,'$.owner'),1,240) owner,
          json_extract(a.value,'$.dueDate') dueDate, json_extract(a.value,'$.status') status,
          json_extract(a.value,'$.revision') revision,
          coalesce(nullif(json_extract(a.value,'$.dueDate'),''),'9999-12-31') || '/core/' || p.id || '/' || json_extract(a.value,'$.id') cursor
        FROM projects p, json_each(p.json,'$.actions') a
        WHERE json_extract(a.value,'$.status') != 'closed'
      ) SELECT * FROM work WHERE (? = '' OR projectId = ?) AND cursor > ? ORDER BY cursor LIMIT ?`)
        .all(projectId, projectId, after, limit + 1);
      return {items: rows.slice(0, limit), hasMore: rows.length > limit};
    },
    createProject({name, client, phase, period} = {}) {
      const project = normalizeProject({schemaVersion: 1, id: newId(), workspaceId: newId(), name,
        engagement: {id: newId(), client, phase, period}, revision: 1,
        resources: [], evidence: [], assessments: [], actions: [], reports: []});
      transaction(() => save(project));
      return projectView(project);
    },
    getProject(id) { return projectView(read(id)); },
    // Scope/existence metadata only. This deliberately makes no claim about
    // current file availability and does not read or hash source bytes.
    getProjectSummary(id) {const project=read(id);return {id:project.id,name:project.name,revision:project.revision,workspaceId:project.workspaceId};},
    // Retained native identity/metadata only. Never projectView, physicalPath or
    // availableBytes: an observation is neither a byte-integrity/availability
    // check nor a grant to read a registered, shared or connected original.
    observeProjectSources(id) {
      return observeLocalProjectSources(read(id));
    },
    spatialEditContext(id, versionId) {
      const project = read(id), {resource, version} = locate(project, versionId);
      assertLocalEditableResource(project, resource, version);
      if (resource.versions.at(-1).id !== versionId) fail(409, 'Open the current latest source version before editing.');
      const original = availableBytes(id, version);
      if (original.availability !== 'available') fail(409, 'Restore the exact available managed original before editing.');
      assertGeoJsonDerivationBytes(project, resource, version, original.bytes);
      return {format:'esia-geojson-edit-context', schemaVersion:1, projectId:project.id, resourceId:resource.id,
        baseVersionId:version.id, baseSha256:version.sha256, baseProjectRevision:project.revision,
        geojson:parseEditableGeoJson(version, original.bytes)};
    },
    boundedSpatialEditContext(id, versionId, options) {
      return editorOperation({...options,maxWriteBytes:0}, () => this.spatialEditContext(id,versionId));
    },
    saveGeoJsonEditReceipt(id, expectedRevision, command, options) {
      return editorOperation(options, () => {
        if (command?.type !== 'source-geojson-edit') fail(400, 'Use the exact GeoJSON edit command.');
        const project = this.mutate(id,expectedRevision,command,{editorReceiptOnly:true});
        return geoJsonEditReceipt(project,command.requestId);
      });
    },
    mutate(id, expectedRevision, command,{classificationAuthority,revisionRelationAuthority,metadataRequestId,editorReceiptOnly=false}={}) {
      if (editorReceiptOnly && (!editorBudget || command?.type !== 'source-geojson-edit')) fail(403, 'Receipt-only saves require trusted current owner authority.');
      if (!object(command)) fail(400, "A mutation command is required.");
      return transaction(() => {
        let project = read(id);
        const edit = command.type === 'source-geojson-edit' ? prepareGeoJsonEdit(command, project.id, expectedRevision) : null;
        if (edit) {
          const prior = project.resources.flatMap(resource => resource.versions.filter(version => version.derivation?.requestId === edit.command.requestId).map(version => ({resource, version})));
          if (prior.length) {
            if (prior.length !== 1 || prior[0].resource.id !== edit.command.resourceId || prior[0].version.derivation.requestSha256 !== edit.requestSha256 || prior[0].version.sha256 !== digest(edit.bytes)) fail(409, 'This edit request UUID already identifies a different exact request.');
            const {resource, version} = prior[0], base = resource.versions.find(candidate => candidate.id === edit.command.baseVersionId);
            assertLocalEditableResource(project, resource, version); assertLocalEditableResource(project, resource, base);
            if (base.sha256 !== edit.command.baseSha256) fail(409, 'The retained edit base changed.');
            for (const retained of [base, version]) {
              const original = availableBytes(project.id, retained);
              if (original.availability !== 'available') fail(409, 'Restore the exact retained original before acknowledging this edit.');
              parseEditableGeoJson(retained, original.bytes);
              assertGeoJsonDerivationBytes(project, resource, retained, original.bytes);
            }
            return editorReceiptOnly ? clone(project) : projectView(project);
          }
        }
        const fieldCapture = command.type === "field-capture" ? prepareFieldCapture(command, project, versionId => {
          const {version} = locate(project, versionId), original = availableBytes(project.id, version);
          if (original.availability !== "available") fail(409, "The prior field original is unavailable or changed. Restore its verified bytes before linking or revising it.");
          return {bytes: original.bytes, version};
        }) : null;
        if (fieldCapture && Number.isSafeInteger(expectedRevision) && expectedRevision > 0) {
          const retained = project.resources.find(resource => resource.id === fieldCapture.resourceId);
          if (retained) {
            const expected = [{resourceId: fieldCapture.resourceId, versionId: fieldCapture.versionId, evidenceId: fieldCapture.evidenceId,
              sha256: fieldCapture.sha256, size: fieldCapture.bytes.length, mediaType: FIELD_MEDIA_TYPE}, ...fieldCapture.files.map(file => file.descriptor)];
            if (expected.some(item => {
              const resource = project.resources.find(resource => resource.id === item.resourceId), version = resource?.versions[0];
              return resource?.versions.length !== 1 || version?.id !== item.versionId || version.sha256 !== item.sha256 || version.size !== item.size ||
                version.mediaType !== item.mediaType || !project.evidence.some(evidence => evidence.id === item.evidenceId && evidence.versionId === item.versionId);
            })) fail(409, "This field capture ID already identifies different retained content. Keep both drafts and use a new capture ID for the changed record.");
            for (const item of expected) {
              const {version} = locate(project, item.versionId);
              if (availableBytes(project.id, version).availability !== "available") fail(409, "A retained field original is unavailable or changed. Restore its verified original before acknowledging this capture.");
            }
            return projectView(project);
          }
        }
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision !== project.revision) fail(409, "This project changed. Reload it before saving.");
        let changed = true;
        const verifyClosure = action => {
          for (const id of action.closureEvidenceIds) {
            const evidence = project.evidence.find(item => item.id === id);
            if (!evidence) fail(400, "Closure evidence must belong to this project.");
            const {version} = locate(project, evidence.versionId);
            if (availableBytes(project.id, version).availability !== "available") fail(409, "Closure requires an available, integrity-verified source version.");
          }
        };
        switch (command.type) {
          case 'source-geojson-edit': {
            const resource = project.resources.find(candidate => candidate.id === edit.command.resourceId);
            const base = resource?.versions.find(candidate => candidate.id === edit.command.baseVersionId);
            assertLocalEditableResource(project, resource, base);
            if (resource.versions.at(-1).id !== base.id || base.sha256 !== edit.command.baseSha256) fail(409, 'The exact latest source base changed. Reopen it before saving.');
            const original = availableBytes(project.id, base);
            if (original.availability !== 'available') fail(409, 'Restore the exact available managed original before editing.');
            assertGeoJsonDerivationBytes(project, resource, base, original.bytes);
            const baseGeoJson = parseEditableGeoJson(base, original.bytes);
            if (serializeGeoJson(baseGeoJson) === serializeGeoJson(edit.command.geojson)) fail(422, 'This GeoJSON draft is unchanged; no new version was saved.');
            const savedAt = now(), version = {id:newId(), filename:base.filename, mediaType:'application/geo+json',
              sha256:digest(edit.bytes), size:edit.bytes.length, mode:'managed', capturedAt:savedAt};
            const link = versionLink(project, resource, version); version.reference = link.reference; version.documentVersionLink = link;
            version.derivation = {format:'esia-source-derivation', schemaVersion:1, operation:geoJsonEditOperation,
              baseReference:clone(base.reference), baseSha256:base.sha256, baseProjectRevision:expectedRevision,
              requestId:edit.command.requestId, requestSha256:edit.requestSha256, savedAt, executionContext:'local-workspace', statement:edit.command.statement};
            resource.versions.push(version);
            project.schemaVersion = 2;
            // Validate the complete future graph before the immutable write.
            // A subsequent SQLite failure may leave only a safe unreferenced object.
            normalizeProject({...project, revision:project.revision + 1});
            putObject(version.sha256, edit.bytes);
            break;
          }
          case "field-capture": {
            const {record} = fieldCapture;
            const protectedRecord = record.sensitivity === "restricted";
            const append = ({resourceId, versionId, evidenceId, filename: logicalName, mediaType, sha256, size}, title, locator) => {
              const resource = {id: resourceId, title, versions: []};
              const version = {id: versionId, filename: logicalName, mediaType, sha256, size, mode: "managed", capturedAt: record.capturedAt};
              const link = versionLink(project, resource, version);
              Object.assign(version, {reference: link.reference, documentVersionLink: link});
              resource.versions.push(version);
              project.resources.push(resource);
              project.evidence.push(normalizeEvidence({id: evidenceId, versionId, locator,
                note: `Practitioner field capture; ${record.sensitivity}. Full notes, consent assertions and any location remain in the exact original. Context is not independently verified.`}));
            };
            append({resourceId: fieldCapture.resourceId, versionId: fieldCapture.versionId, evidenceId: fieldCapture.evidenceId,
              filename: `field-${record.captureId}.json`, mediaType: FIELD_MEDIA_TYPE, sha256: fieldCapture.sha256, size: fieldCapture.bytes.length},
              protectedRecord ? `Restricted field record — ${record.kind}` : record.title, `Field record ${record.captureId} (${record.kind})`);
            for (const [index, file] of fieldCapture.files.entries()) append(file.descriptor,
              protectedRecord ? `Restricted field attachment ${index + 1}` : `${record.title} — attachment ${index + 1}`, `Original attachment ${index + 1} of field record ${record.captureId}`);
            // Validate the complete graph before writing any originals. Failed
            // writes roll back SQLite; an unreferenced immutable object is safe.
            project = normalizeProject(project);
            putObject(fieldCapture.sha256, fieldCapture.bytes);
            for (const file of fieldCapture.files) putObject(file.descriptor.sha256, file.bytes);
            break;
          }
          case "intake": {
            const mode = choice(command.mode, ["managed", "registered"], "Storage mode");
            if (command.path !== undefined && command.contentBase64 !== undefined) fail(400, "Choose either a local path or uploaded bytes.");
            if (mode === "registered" && command.path === undefined) fail(400, "Registered references require an absolute local file path.");
            const bytes = command.path !== undefined ? readLocalFile(command.path) : base64Bytes(command.contentBase64);
            const sha256 = digest(bytes);
            let resource;
            if (command.resourceId !== undefined) {
              identifier(command.resourceId, "Resource ID");
              resource = project.resources.find(candidate => candidate.id === command.resourceId);
              if (!resource) fail(404, "Resource was not found in this project.");
              if (resource.id.startsWith("field:")) fail(400, "Field capture originals are immutable. Create another field record to retain changed observations.");
              assertLocalEditableResource(project, resource, resource.versions.at(-1), {allowRegistered:true});
            } else {
              resource = {id: newId(), title: text(command.title, "Resource title", {max: 2000}), versions: []};
              project.resources.push(resource);
            }
            if (resource.versions.some(version => version.sha256 === sha256)) { changed = false; break; }
            const version = {id: newId(), filename: filename(command.filename ?? (command.path === undefined ? "" : basename(command.path))),
              sha256, size: bytes.length, mediaType: command.mediaType || "application/octet-stream", mode, capturedAt: now()};
            const link = versionLink(project, resource, version);
            version.reference = link.reference;
            version.documentVersionLink = link;
            const source = sourceMetadata(command.source);
            if (source !== undefined) version.source = source;
            if (command.intakeMetadata !== undefined) {if(command.intakeMetadata.classification!==undefined||command.intakeMetadata.revisionRelation!==undefined)fail(400,"Retain reviewed document decisions through their owning engagement review.");version.intakeMetadata = intakeMetadata(command.intakeMetadata, sha256,version.id);}
            if (command.externalReference !== undefined) version.externalReference = immutableReference(command.externalReference);
            resource.versions.push(version);
            if (mode === "managed") putObject(sha256, bytes);
            else db.prepare("INSERT INTO locations (project_id, version_id, path) VALUES (?, ?, ?)").run(project.id, version.id, command.path);
            break;
          }
          case "document-classification":
          case "document-relation":
          case "metadata": {
            const {resource, version} = locate(project, command.versionId);
            const metadata = intakeMetadata(command.metadata, version.sha256,version.id),previousMetadata=effectiveMetadata(resource,version),classification=metadata.classification;
            if(command.type==="document-relation"){
              const relation=metadata.revisionRelation;
              if(!relation||!revisionRelationAuthority||revisionRelationAuthority.projectId!==project.id||revisionRelationAuthority.versionId!==version.id||revisionRelationAuthority.sourceSha256!==version.sha256||revisionRelationAuthority.engagementId!==relation.engagementId||canonicalDocumentValue(revisionRelationAuthority.revisionRelation)!==canonicalDocumentValue(relation))fail(403,"Document relationships require their owning engagement's exact comparison and review authority.");
              const {revisionRelation:oldRelation,...before}=previousMetadata||documentMetadataBaseline(resource,version),{revisionRelation:newRelation,...after}=metadata;
              if(canonicalDocumentValue(before)!==canonicalDocumentValue(after))fail(403,"A relationship review preserves the document's descriptive fields and classification.");
              validateDocumentRevisionGraph(project,relation.engagementId,{candidate:relation});
            }else if(canonicalDocumentValue(metadata.revisionRelation??null)!==canonicalDocumentValue(previousMetadata?.revisionRelation??null))fail(403,"Use the explicit two-original comparison to review a document relationship; ordinary edits cannot forge or erase it.");
            if(command.type==="document-classification"){
              if(!classificationAuthority||classificationAuthority.projectId!==project.id||classificationAuthority.versionId!==version.id||classificationAuthority.sourceSha256!==version.sha256||classificationAuthority.engagementId!==classification?.engagementId||canonicalDocumentValue(classificationAuthority.classification)!==canonicalDocumentValue(classification))fail(403,"Document classification requires its owning engagement's exact source and review authority.");
              if(classification.status!=="suggested"&&canonicalDocumentValue(documentProfileFromMetadata(metadata,classification.reviewedProfile.requirementIds))!==canonicalDocumentValue(classification.reviewedProfile))fail(400,"The reviewed classification must exactly match the effective document fields.");
              if(classification.status==="suggested"&&previousMetadata){const {classification:old,...oldFields}=previousMetadata,{classification:next,...newFields}=metadata;if(canonicalDocumentValue(oldFields)!==canonicalDocumentValue(newFields))fail(400,"A suggested classification cannot replace accepted document metadata.");}
            }else{
              if(canonicalDocumentValue(classification??null)!==canonicalDocumentValue(previousMetadata?.classification??null))fail(403,"Create or review document classification through its owning engagement; ordinary metadata edits cannot forge or remove its decision.");
              if(classification?.reviewedProfile&&canonicalDocumentValue(documentProfileFromMetadata(metadata,classification.reviewedProfile.requirementIds))!==canonicalDocumentValue(classification.reviewedProfile))fail(403,"Review changed classified document fields through the owning engagement; an earlier human decision cannot approve different metadata.");
            }
            const originalFacts = normalizeExtractionFacts(version.intakeMetadata?.extraction || {});
            if (originalFacts.sourceSha256 && !sameJson(originalFacts, normalizeExtractionFacts(metadata.extraction))) fail(400, "Observed extraction facts are retained with the original version. Correct descriptive fields without replacing those observations.");
            if (sameJson(effectiveMetadata(resource, version), metadata)) { changed = false; break; }
            if(metadataRequestId!==undefined&&(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(metadataRequestId)||project.resources.some(row=>row.metadataHistory?.some(entry=>entry.id===metadataRequestId))))fail(409,"The metadata request must have a new exact UUID.");
            (resource.metadataHistory ??= []).push({id: metadataRequestId||newId(), versionId: version.id, at:command.type==="document-relation"?metadata.revisionRelation.review.at:now(), metadata,...(command.type==="document-relation"?{operation:"document-relation-review",actorId:metadata.revisionRelation.review.actorId}:{})});
            break;
          }
          case "evidence": project.evidence.push(normalizeEvidence({...command, id: newId()})); break;
          case "assessment": project.assessments.push(normalizeAssessment({...command, id: newId(), reviewedAt: now()})); break;
          case "action": {
            // Old open-action clients remain compatible. All new closure writes
            // require explicit review and exact evidence, including legacy clients.
            const modern = command.reviewer !== undefined || command.status === "closed";
            const action = normalizeAction({...command, id: newId(), ...(modern ? {revision: 1, updatedAt: now(), history: [],
              updateNote: "Action recorded.", closureEvidenceIds: command.closureEvidenceIds ?? []} : {})});
            if (action.status === "closed") verifyClosure(action);
            project.actions.push(action);break;
          }
          case "action-update": {
            const index = project.actions.findIndex(item => item.id === command.actionId);
            if (index < 0) fail(404, "The action was not found in this project.");
            const previous = project.actions[index], {history = [], ...state} = previous;
            const action = normalizeAction({...state, revision: (previous.revision ?? 1) + 1, history: [...history, state],
              updatedAt: now(), reviewer: command.reviewer, updateNote: command.updateNote,
              status: command.status, verification: command.verification, closureEvidenceIds: command.closureEvidenceIds ?? []});
            if (action.status === "closed") verifyClosure(action);
            project.actions[index] = action;break;
          }
          case "capture": {
            const {version} = locate(project, command.versionId);
            if (version.mode === "managed") { changed = false; break; }
            const available = availableBytes(project.id, version);
            if (available.availability !== "available") fail(409, "The registered source is changed or unavailable. Relink the exact version before capturing it.");
            putObject(version.sha256, available.bytes);
            version.mode = "managed";
            db.prepare("DELETE FROM locations WHERE project_id = ? AND version_id = ?").run(project.id, version.id);
            // The issued snapshot keeps the original custody declaration. Its exact
            // bytes/reference remain fixed; later capture only improves availability.
            break;
          }
          case "relink": {
            const {version} = locate(project, command.versionId);
            if (version.mode !== "registered") fail(400, "Only registered versions need relinking.");
            const bytes = readLocalFile(command.path);
            if (bytes.length !== version.size || digest(bytes) !== version.sha256) fail(409, "Relinking requires bytes matching the original SHA256, not only a matching filename.");
            db.prepare("INSERT INTO locations (project_id, version_id, path) VALUES (?, ?, ?) ON CONFLICT(project_id, version_id) DO UPDATE SET path = excluded.path")
              .run(project.id, version.id, command.path);
            break;
          }
          case "issue": {
            if (command.presentation !== undefined && !object(command.presentation)) fail(400, "Report presentation options must be an object.");
            const template = command.presentation === undefined ? TEMPLATE : STYLED_TEMPLATE;
            const report = {id: newId(), issuedAt: now(), title: text(command.title, "Report title", {max: 2000}),
              narrative: text(command.narrative, "Report narrative", {optional: true}),
              reviewer: text(command.reviewer, "Report reviewer", {max: 1000}), template: clone(template), snapshot: makeSnapshot(project, template),
              ...(template.version === 2 ? {presentation: createGapReportPresentation(project, command.presentation)} : {})};
            report.markdown = renderReport(report);
            project.reports.push(report);
            break;
          }
          default: fail(400, "Unknown local workspace command.");
        }
        if (changed) {
          project.revision++;
          project = normalizeProject(project);
          if (editorReceiptOnly) authorizeEditor('before-project-commit');
          save(project);
        }
        return editorReceiptOnly ? clone(project) : projectView(project);
      });
    },
    readVersion(projectId, versionId) {
      const project = read(projectId);
      const {version} = locate(project, versionId);
      const available = availableBytes(projectId, version);
      if (available.availability !== "available") fail(available.availability === "changed" ? 409 : 404,
        "The exact source version is changed or unavailable. Relink matching bytes or restore a managed backup.");
      return {bytes: available.bytes, version: {...clone(version), availability: "available"}};
    },
    // Bounded exact original reader for owner tasks: managed local sources only.
    // Registered, shared, connected and field sources keep their owning workflows.
    readVersionBounded(projectId, versionId, {maxBytes} = {}) {
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > FILE_LIMIT) fail(400, 'Select a positive native source byte budget of at most 16 MiB.');
      const project = normalizeProject(read(projectId)), {resource, version} = locate(project, versionId);
      assertLocalEditableResource(project, resource, version);
      const link = versionLink(project, resource, version);
      if (!sameJson(version.reference, link.reference) || !sameJson(version.documentVersionLink, link) ||
          typeof version.sha256 !== 'string' || version.sha256.length !== 64 || !hashPattern.test(version.sha256)) fail(409, 'The exact retained managed source identity is inconsistent.');
      if (!Number.isSafeInteger(version.size) || version.size < 0) fail(409, 'The retained managed source size is invalid.');
      if (version.size > maxBytes) fail(413, 'The selected source exceeds the explicit owner byte-read budget.');
      let fd;
      try {
        if (realpathSync(objects) !== objects) fail(409, 'The managed source directory cannot traverse symbolic links.');
        fd = openSync(join(objects,version.sha256), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        const before = fstatSync(fd,{bigint:true});
        if (!before.isFile() || before.nlink !== 1n) fail(409, 'The managed original must be an ordinary source object with a single link.');
        if (before.size > BigInt(maxBytes)) fail(413, 'The physical original exceeds the explicit owner byte-read budget.');
        if (before.size !== BigInt(version.size)) fail(409, 'The exact managed source size changed.');
        const bytes = Buffer.alloc(version.size);let offset=0;
        while (offset < bytes.length) {
          const count=readSync(fd,bytes,offset,bytes.length-offset,null);
          if (!count) fail(409, 'The exact managed source ended before its retained size.');
          offset+=count;
        }
        const after = fstatSync(fd,{bigint:true});
        if (['dev','ino','size','mtimeNs','ctimeNs','mode','uid','nlink'].some(key=>before[key]!==after[key]) || digest(bytes)!==version.sha256) fail(409, 'The exact managed source changed during its bounded read.');
        return {bytes,version:{...clone(version),availability:'available'}};
      } catch (error) {
        if (error.status) throw error;
        fail(error.code==='ENOENT'?404:409,'The retained managed source could not be opened safely.');
      } finally {if (fd !== undefined) closeSync(fd);}
    },
    exportProject(id, {includeFiles=true}={}) {
      const project = read(id);
      const files = new Map();
      const unresolved = [];
      let total = 0;
      for (const resource of project.resources) for (const version of resource.versions) {
        const available = includeFiles&&version.mode === "managed" ? availableBytes(project.id, version) : {availability: "unavailable"};
        if (available.availability !== "available") { unresolved.push(version.id); continue; }
        if (!files.has(version.sha256)) {
          total += available.bytes.length;
          if (total > PACKAGE_LIMIT) fail(413, "Project packages are limited to 32 MiB of unique source bytes.");
          files.set(version.sha256, {sha256: version.sha256, contentBase64: available.bytes.toString("base64")});
        }
      }
      // Older package readers discarded unknown assessment fields. Version 2
      // prevents them from silently dropping the retained audit provenance.
      const packageVersion = project.schemaVersion === 2 || hasSourceDerivations(project) ? 10 : project.actions.some(action => action.revision) ? 8 : project.reports.some(report => report.template.version === 2) ? 4 : hasIntakeMetadata(project) || hasDefinitions(project) ? 3 : project.assessments.some(assessment => assessment.auditContext) ? 2 : 1;
      const result = {format: "esia-local-project", packageVersion, project: clone(project), files: [...files.values()], unresolved};
      assertPackageJsonSize(result);
      return result;
    },
    importProject(value, {sourceFiles=[],validateOnly=false}={}) {
      if (!object(value) || value.format !== "esia-local-project" || ![1, 2, 3, 4, 8, 10].includes(value.packageVersion)) fail(400, "Unsupported local project package.");
      assertPackageJsonSize(value);
      const project = normalizeProject(value.project);
      if (value.packageVersion < 10 && (project.schemaVersion === 2 || hasSourceDerivations(project))) fail(400, 'Typed source derivation history requires package version 10.');
      if (value.packageVersion < 8 && project.actions.some(action => action.revision)) fail(400, "Action revision history requires package version 8.");
      if (value.packageVersion < 4 && project.reports.some(report => report.template.version === 2)) fail(400, "Styled report presentation requires package version 4.");
      if (value.packageVersion < 3 && hasIntakeMetadata(project)) {
        fail(400, "Reviewed intake metadata and correction history require package version 3.");
      }
      if (value.packageVersion < 3 && hasDefinitions(project)) fail(400, "Retained requirement definitions and sector profiles require package version 3.");
      if (value.packageVersion === 1 && project.assessments.some(assessment => assessment.auditContext)) {
        fail(400, "Retained framework audit context requires package version 2.");
      }
      const files = new Map();
      let total = 0;
      for (const file of items(value.files, "Package files")) {
        if (!object(file) || typeof file.sha256 !== "string" || !hashPattern.test(file.sha256) || files.has(file.sha256)) fail(400, "Invalid or duplicated package file hash.");
        const bytes = base64Bytes(file.contentBase64);
        total += bytes.length;
        if (total > PACKAGE_LIMIT) fail(413, "Project packages are limited to 32 MiB of unique source bytes.");
        if (digest(bytes) !== file.sha256) fail(400, "Package file bytes do not match their SHA256.");
        files.set(file.sha256, bytes);
      }
      if(!Array.isArray(sourceFiles)||sourceFiles.length>10000)fail(400,'Use bounded internal handover source descriptors.');
      let handoverBytes=0;
      for(const file of sourceFiles){
        if(!object(file)||Object.keys(file).some(key=>!['sha256','size','readBytes'].includes(key))||!hashPattern.test(file.sha256||'')||files.has(file.sha256)||!Number.isSafeInteger(file.size)||file.size<0||file.size>HANDOVER_FILE_LIMIT||typeof file.readBytes!=='function'||(handoverBytes+=file.size)>HANDOVER_SOURCE_LIMIT)fail(400,'The trusted handover source descriptors exceed their exact byte bounds.');
        files.set(file.sha256,file);
      }
      const fileBytes=file=>{if(file instanceof Uint8Array)return file;const bytes=file.readBytes();if(!(bytes instanceof Uint8Array)||bytes.length!==file.size||digest(bytes)!==file.sha256)fail(409,'The staged handover original differs from its exact retained hash or size.');return bytes;};
      const unresolved = items(value.unresolved, "Unresolved versions").map(id => identifier(id));
      if (new Set(unresolved).size !== unresolved.length) fail(400, "Unresolved version IDs must be unique.");
      const expectedUnresolved = new Set();
      const usedFiles = new Set();
      for (const resource of project.resources) for (const version of resource.versions) {
        const file = version.mode === "managed" ? files.get(version.sha256) : undefined,bytes=file===undefined?undefined:fileBytes(file);
        if (bytes) {
          if (bytes.length !== version.size) fail(400, "Package file size does not match its source version.");
          assertGeoJsonDerivationBytes(project, resource, version, bytes);
          usedFiles.add(version.sha256);
        } else expectedUnresolved.add(version.id);
      }
      if (unresolved.length !== expectedUnresolved.size || unresolved.some(id => !expectedUnresolved.has(id))) fail(400, "Package unresolved references do not match missing source versions.");
      if (usedFiles.size !== files.size) fail(400, "Package contains files that are not retained managed versions.");
      if(validateOnly)return clone(project);
      return transaction(() => {
        const existing = db.prepare("SELECT json FROM projects WHERE id = ?").get(project.id);
        if (existing && !sameJson(JSON.parse(existing.json), project)) fail(409, "A different project with this ID already exists. Import into a clean directory to preserve both versions.");
        for (const [sha256, file] of files) putObject(sha256, fileBytes(file));
        if (!existing) save(project); else retainReaderFloor(project);
        return projectView(project);
      });
    },
    close() { db.close(); }
  };
}
