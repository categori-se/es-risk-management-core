import {sha256Bytes} from "./field-drafts.js";

const text = (value, name, max) => {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw Error(`Add ${name} (up to ${max} characters).`);
  return value.trim();
};
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;

/** A deliberately separate disclosure derivative. Nothing from a free-text
 * source field, original file, filename, edit history or original GPS is copied.
 * The source hash binds canonical UTF-8 record JSON, not repository file bytes.
 * The reviewer must write and review the recipient-specific text themselves. */
export async function createFieldDisclosure(record, review, {crypto = globalThis.crypto, now = () => new Date().toISOString()} = {}) {
  if (record?.type !== "field-capture" || typeof record.captureId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(record.captureId) || !["observation", "photo", "note", "interview", "measurement", "incident", "document"].includes(record.kind)) throw Error("Choose a valid original field record before preparing a disclosure.");
  if (record.consent?.retention === "declined" || record.consent?.sharing === "declined") throw Error("Retention or sharing permission is declined. A disclosure cannot be prepared.");
  if (record.consent?.disclosure === "declined") throw Error("Disclosure permission is declined. A disclosure cannot be prepared.");
  const recordedDisclosure = Object.hasOwn(record.consent || {}, "disclosure");
  const basis = review?.permissionBasis;
  if (basis === "recorded_consent") {
    if (record.consent?.retention !== "granted" || record.consent?.sharing !== "granted" || (record.kind === "interview" && record.consent?.interview !== "granted")) throw Error("Recorded consent must grant retention, sharing and any interview before this disclosure can be prepared.");
    if (recordedDisclosure ? record.consent.disclosure !== "granted" : review.legacyDisclosureConsent !== "granted") throw Error(recordedDisclosure ? "Disclosure permission must be recorded as granted before this sharing copy can be prepared." : "This legacy original has no separate disclosure permission. Explicitly review and attest disclosure permission for this recipient and purpose; the original consent record remains unchanged.");
  } else if (basis === "no_personal_data") {
    if (record.kind === "interview" || review.noPersonalData !== true || record.consent?.retention !== "not_applicable" || record.consent?.sharing !== "not_applicable") throw Error("The no-personal-data basis requires an explicit review and retention and sharing marked not applicable; it cannot be used for an interview.");
    if (recordedDisclosure ? record.consent.disclosure !== "not_applicable" : review.legacyDisclosureConsent !== "not_applicable") throw Error(recordedDisclosure ? "The no-personal-data basis also requires disclosure marked not applicable." : "This legacy original has no separate disclosure permission. Explicitly attest why disclosure permission is not applicable for this recipient and purpose; the original consent record remains unchanged.");
  } else throw Error("Choose the permission basis for this recipient and purpose.");
  if (review.reviewed !== true) throw Error("Review the text, permissions, purpose and recipient before preparing a disclosure.");
  const reviewed = {
    recipient: text(review.recipient, "the intended recipient", 1000),
    purpose: text(review.purpose, "the permitted purpose", 1000),
    permissionBasis: basis,
    disclosurePermission: {status: basis === "recorded_consent" ? "granted" : "not_applicable", source: recordedDisclosure ? "source_record" : "legacy_recipient_purpose_review"},
    permissionExplanation: text(review.permissionExplanation, "the permission scope or no-personal-data explanation", 2000),
    reviewer: text(review.reviewer, "the disclosure reviewer", 1000)
  };
  const content = {kind: record.kind, title: text(review.title, "a disclosure title", 2000), summary: text(review.summary, "a reviewed disclosure summary", 16000), location: null};
  const mode = review.locationMode || "suppressed";
  if (!["suppressed", "generalized"].includes(mode)) throw Error("A disclosure may suppress location or include a generalized area; precise locations stay in the original.");
  if (mode === "generalized") {
    if (!["generalized", "precise"].includes(record.location?.disclosure)) throw Error("The original record suppresses location. Keep the disclosure location suppressed.");
    const point = record.location?.current;
    if (!point || point.crs !== "EPSG:4326" || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180) throw Error("Apply a valid current WGS84 location before including a generalized area.");
    const lower = (value, maximum) => Math.min(Math.floor(value * 10) / 10, maximum - 0.1);
    const south = lower(point.latitude, 90), west = lower(point.longitude, 180);
    content.location = {disclosure: "generalized", crs: "EPSG:4326", cellDegrees: 0.1, bounds: {south, west, north: Number((south + 0.1).toFixed(1)), east: Number((west + 0.1).toFixed(1))}};
  }
  const captureId = record.captureId, sourceJson = JSON.stringify(canonical(record));
  if (sourceJson.length > 16 * 1024 * 1024) throw Error("The original record exceeds the bounded disclosure review limit.");
  const recordSha256 = await sha256Bytes(new TextEncoder().encode(sourceJson), crypto);
  const createdAt = now();
  if (!Number.isFinite(Date.parse(createdAt))) throw Error("The disclosure review timestamp is invalid.");
  return {format: "esia-field-disclosure", version: 1, createdAt,
    source: {captureId, recordSha256, encoding: "canonical-record-json-v1"},
    review: {...reviewed, reviewedAt: createdAt}, content,
    omitted: ["original notes and titles", "author and stakeholder identities", "site and internal links", "original GPS and precise location", "edit history", "original files, filenames and embedded metadata"],
    notice: "Recipient-specific human-reviewed derivative. Original records remain unchanged. Review free text for indirect identification before sharing; this is not automatic anonymization."};
}
