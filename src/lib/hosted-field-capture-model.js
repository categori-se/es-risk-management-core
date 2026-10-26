import {assertResourceReference} from "@categori/workspace-contracts";
import {additionalFieldLinks, normalizeAdditionalFieldLinks, normalizeFieldDetails} from "./field-record-details.js";
import {normalizeFieldDevicePolicy} from "./field-device-policy.js";

export function assertConfiguredResourceAuthority(value) {
  if (typeof value !== "string") throw Error("Configure the exact customer HTTPS resource authority.");
  let url;try {url = new URL(value);} catch {throw Error("Configure the exact customer HTTPS resource authority.");}
  if (url.protocol !== "https:" || url.origin !== value || url.username || url.password) throw Error("Configure the exact customer HTTPS resource authority.");
  return value;
}

export const hostedFieldMetadata = "esia_field_capture";
export const hostedFieldFormat = "esia-hosted-field-capture";
export const hostedFieldMaximumBytes = 10 * 1024 * 1024;
export const hostedFieldMediaTypes = Object.freeze(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "application/pdf", "text/plain", "text/csv", "text/html", "application/json", "application/octet-stream", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value, allowed, label) => {if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) throw Error(`${label} contains unsupported fields.`);};
const text = (value, max, label, required = false) => {if (typeof value !== "string" || value.length > max || required && !value.trim()) throw Error(`${label} needs ${required ? "nonempty " : ""}text of at most ${max} characters.`);return value;};
const id = value => {if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(value) || value.includes("..")) throw Error("An exact record identity is required.");return value;};
const hash = value => {if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw Error("An exact SHA256 is required.");return value;};
const date = value => {if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value) || !Number.isFinite(Date.parse(value))) throw Error("An original ISO capture timestamp is required.");return value;};
const choice = (value, choices) => {if (!choices.includes(value)) throw Error("An unsupported field capture value was supplied.");return value;};
const ids = value => {if (!Array.isArray(value) || value.length > 30) throw Error("Use up to30 linked identifiers.");const result = value.map(id);if (new Set(result).size !== result.length) throw Error("Linked identifiers must be distinct.");return result;};

export function fieldUploadPolicy(project, {leaseProof} = {}) {
  const policy = project?.field_capture_policy;
  if (policy !== undefined) keys(policy, ["schemaVersion", "uploadAllowed", "devicePolicy"], "Field upload policy");
  if (policy !== undefined && (!object(policy) || policy.schemaVersion !== 1 || typeof policy.uploadAllowed !== "boolean")) throw Error("The configured field upload policy is unsupported.");
  if (policy?.uploadAllowed === false) throw Error("This project's policy disables field uploads.");
  if (policy?.devicePolicy !== undefined && policy.devicePolicy !== null) {
    const required=normalizeFieldDevicePolicy(policy.devicePolicy),effective=leaseProof?.devicePolicy&&normalizeFieldDevicePolicy(leaseProof.devicePolicy);
    // This pure shape/policy check grants no authority. Server callers supply
    // a freshly validated canonical lease; browser copies remain declarations.
    if(!effective||leaseProof.scope?.projectId!==project.project_id||leaseProof.scope?.accountId!==project.account_id||leaseProof.scope?.workspaceId!==project.workspace_id||effective.offlineAllowed&&!required.offlineAllowed||effective.allowSourceOriginals&&!required.allowSourceOriginals||effective.allowedSensitivities.some(value=>!required.allowedSensitivities.includes(value))||['maxOfflineHours','autoLockMinutes','retentionHours'].some(key=>effective[key]>required[key]))throw Error("This project requires a current scoped server device permission matching its field policy.");
  }
  // Project document permissions are the supported hosted boundary. A stronger
  // classification cannot be enforced by attaching a label to an ordinary file.
  return {schemaVersion: 1, allowedSensitivity: "internal", devicePolicy: policy?.devicePolicy ?? null};
}

export function normalizeHostedFieldRecord(input, {forUpload = false} = {}) {
  keys(input, ["type", "captureId", "kind", "title", "note", "capturedAt", "author", "sensitivity", "site", "location", "consent", "links", "attachments", "details"], "Capture");
  if (input.type !== "field-capture") throw Error("A field capture is required.");
  const record = {type: "field-capture", captureId: id(input.captureId), kind: choice(input.kind, ["observation", "photo", "note", "interview", "measurement", "incident", "document"]), title: text(input.title, 2000, "Title", true), note: text(input.note, 16000, "Notes"), capturedAt: date(input.capturedAt), author: text(input.author, 1000, "Recorded by", true), sensitivity: choice(input.sensitivity, ["internal"]), site: text(input.site, 2000, "Site")};
  keys(input.consent, ["interview", "photograph", "audio", "retention", "sharing", "disclosure"], "Consent");
  record.consent = Object.fromEntries(["interview", "photograph", "audio", "retention", "sharing"].map(key => [key, choice(input.consent[key], ["not_recorded", "granted", "declined", "not_applicable"])]));
  // Historical manifests retain their original five keys and canonical hash.
  if (Object.hasOwn(input.consent, "disclosure")) record.consent.disclosure = choice(input.consent.disclosure, ["not_recorded", "granted", "declined", "not_applicable"]);
  if (forUpload && ["disclosure", "sharing"].some(key => !["granted", "not_applicable"].includes(record.consent[key]))) throw Error("Hosted saving makes this record and its originals available to authorized project participants. Record permission for both disclosure and sharing with this audience before uploading.");
  if (!["granted", "not_applicable"].includes(record.consent.retention)) throw Error("Record permission to retain this information before a hosted upload.");
  if (record.kind === "interview" && !["granted", "not_applicable"].includes(record.consent.interview)) throw Error("Record interview permission before uploading consultation notes.");
  const point = (value, original = false) => {
    if (value === null) return null;
    keys(value, ["latitude", "longitude", "accuracy", "source", "capturedAt", "crs"], "Location");
    if (!Number.isFinite(value.latitude) || Math.abs(value.latitude) > 90 || !Number.isFinite(value.longitude) || Math.abs(value.longitude) > 180 || value.accuracy !== null && (!Number.isFinite(value.accuracy) || value.accuracy < 0)) throw Error("Location needs valid WGS84 coordinates and known accuracy or null.");
    return {latitude: value.latitude, longitude: value.longitude, accuracy: value.accuracy, source: choice(value.source, original ? ["device"] : ["device", "manual"]), capturedAt: date(value.capturedAt), crs: choice(value.crs, ["EPSG:4326"])};
  };
  if (input.location === null) record.location = null;
  else {keys(input.location, ["original", "current", "disclosure"], "Location history");record.location = {original: point(input.location.original, true), current: point(input.location.current), disclosure: choice(input.location.disclosure, ["suppressed", "generalized", "precise"])};}
  keys(input.links, ["assessmentIds", "actionIds", "requirement", "context", ...Object.keys(additionalFieldLinks)], "Links");
  record.links = {assessmentIds: ids(input.links.assessmentIds), actionIds: ids(input.links.actionIds), requirement: null};
  if (input.links.requirement !== null) {keys(input.links.requirement, ["authority", "name", "edition", "clause"], "Requirement context");record.links.requirement = Object.fromEntries(["authority", "name", "edition", "clause"].map(key => [key, text(input.links.requirement[key], 2000, key)]));}
  if (input.links.context !== undefined) {keys(input.links.context, ["requirementId", "siteId", "grievanceId", "commitmentId", "activityId", "engagementId", "programId", "cycleId", "missionId"], "Context");record.links.context = Object.fromEntries(Object.entries(input.links.context).map(([key, value]) => [key, id(value)]));}
  Object.assign(record.links, normalizeAdditionalFieldLinks(input.links));
  if (input.details !== undefined) {record.details = normalizeFieldDetails(input.details);if (record.details.successor) throw Error("Hosted captures require a new capture identity; local successor pins cannot select a hosted parent.");}
  if (!Array.isArray(input.attachments) || input.attachments.length > 3) throw Error("A capture supports up to3 original files.");
  let total = 0;
  record.attachments = input.attachments.map(attachment => {
    keys(attachment, ["filename", "mediaType", "sha256", "size", "contentBase64"], "Original descriptor");
    const filename = text(attachment.filename, 180, "Original filename", true);
    if (/[\\/\x00-\x1f\x7f]/.test(filename)) throw Error("Original filenames cannot contain paths or controls.");
    const mediaType = choice(attachment.mediaType, hostedFieldMediaTypes);
    if (/^(image|audio)\//.test(mediaType) && !["granted", "not_applicable"].includes(record.consent[mediaType.startsWith("image/") ? "photograph" : "audio"])) throw Error("Record the relevant image or audio permission before uploading originals.");
    const size = attachment.size ?? (typeof attachment.contentBase64 === "string" ? Math.floor(attachment.contentBase64.length * 3 / 4) - (attachment.contentBase64.endsWith("==") ? 2 : attachment.contentBase64.endsWith("=") ? 1 : 0) : NaN);
    if (!Number.isSafeInteger(size) || size < 1 || (total += size) > hostedFieldMaximumBytes) throw Error("Originals must total at most10MiB.");
    return {filename, mediaType, sha256: hash(attachment.sha256), size};
  });
  return record;
}

export function assertHostedFieldMetadata(value) {
  keys(value, ["schemaVersion", "captureId", "recordSha256", "role", "index", "engagementId", "leaseId"], "Field registration");
  if (value.schemaVersion !== 1 || !["manifest", "original"].includes(value.role)) throw Error("Use field registration schema1 and an explicit role.");
  id(value.captureId);hash(value.recordSha256);
  if(Object.hasOwn(value,'engagementId')||Object.hasOwn(value,'leaseId')){id(value.engagementId);id(value.leaseId);}
  if (value.role === "original" ? !Number.isSafeInteger(value.index) || value.index < 0 || value.index > 2 : value.index !== undefined) throw Error("Invalid original index.");
  return value;
}

export function assertHostedFieldManifest(value, {projectId, accountId, workspaceId, resourceAuthority, forUpload = false} = {}) {
  resourceAuthority = assertConfiguredResourceAuthority(resourceAuthority);
  keys(value, ["format", "schemaVersion", "projectId", "accountId", "recordSha256", "record", "media", "linkInterpretation"], "Field manifest");
  if (value.format !== hostedFieldFormat || value.schemaVersion !== 1 || value.projectId !== projectId || value.accountId !== accountId || value.linkInterpretation !== "recorded_context") throw Error("Capture manifest does not match its selected project and account.");
  hash(value.recordSha256);
  const record = normalizeHostedFieldRecord(value.record, {forUpload});
  if (JSON.stringify(record) !== JSON.stringify(value.record) || !Array.isArray(value.media) || value.media.length !== record.attachments.length) throw Error("Capture manifest must retain its exact canonical record and every original.");
  const seen = new Set();
  value.media.forEach((media, index) => {
    keys(media, ["filename", "mediaType", "sha256", "size", "reference"], "Original receipt");
    const reference = assertResourceReference(media.reference, {immutable: true});
    if (reference.authority !== resourceAuthority || reference.resource_type !== "document_original" || reference.workspace_id !== workspaceId || seen.has(reference.resource_id) || JSON.stringify(record.attachments[index]) !== JSON.stringify(Object.fromEntries(["filename", "mediaType", "sha256", "size"].map(key => [key, media[key]])))) throw Error("An original receipt changed its exact source or manifest.");
    seen.add(reference.resource_id);
  });
  return value;
}
