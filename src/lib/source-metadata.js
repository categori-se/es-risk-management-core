// Optional descriptive fields and observed extraction facts shared by local UI/store.
import {normalizeDocumentClassification} from "./document-classification.js";
import {normalizeDocumentRevisionRelation} from "./document-relations.js";
export const catalogMetadataFields = [
  ["publisher", "Publisher / issuing organisation", 1000],
  ["identifier", "DOI / report reference / other identifier", 1000],
  ["documentType", "Document / dataset type", 200],
  ["documentRevision", "Document revision / edition", 200],
  ["reportingPeriod", "Reporting period", 1000],
  ["documentStatus", "Document status (draft, final, superseded or other)", 200],
  ["sourceUrl", "Reference URL", 4000],
  ["lastAccessedAt", "Last accessed date / time (ISO 8601)", 64],
  ["rights", "Rights / permitted use", 4000],
  ["license", "Licence", 1000],
  ["rightsURI", "Rights statement URI", 4000],
  ["licenseURI", "Licence URI", 4000],
  ["rightsEvidenceURL", "Permission / licence evidence URL", 4000],
  ["attribution", "Required attribution / citation", 4000]
];
export const spatialMetadataFields = [
  ["crs", "Source coordinate reference system (CRS)", 2000],
  ["sourceDate", "Spatial source date", 64],
  ["coverage", "Geographic / temporal coverage", 4000],
  ["transformations", "Transformations / processing history", 8000],
  ["limitations", "Spatial limitations / accuracy", 4000]
];
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = message => {throw Object.assign(new Error(message), {status: 400});};
const clean = (value, label, maximum) => {
  if (typeof value !== "string" || value.length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) fail(`${label} must be text of at most ${maximum} characters.`);
  return value.trim();
};
export function validateMetadataDate(value, label = "Document date") {
  if (!value) return value;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d\d-\d\d(?:$|T\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$)/.test(value) ||
      !Number.isFinite(Date.parse(value)) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day) fail(`${label} must be a valid ISO date or timestamp, or empty when unknown.`);
  return value;
}
export function referenceUrl(value) {
  if (!value) return value;
  let url;
  try {url = new URL(value);} catch {fail("Reference URL must be a complete public HTTP(S) reference without credentials.");}
  const secret = /^(?:token|.*[_-]token|auth|authorization|code|bearer|jwt|.*[_-]key|key|password|passwd|secret|.*[_-]secret|session(?:id|[_-]id|[_-]token)?|sid|signature|sig|credential|credentials|x-amz-.+|x-goog-.+|awsaccesskeyid|googleaccessid|key-pair-id|policy|rlkey|resourcekey)$/i;
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()].some(key => secret.test(key.replace(/\[\d*\]$/, "").replace(/[.\s]/g, "-")))) fail("Reference URL must omit credentials and signed download parameters.");
  return value;
}
export function normalizeCatalogMetadata(value) {
  const result = {};
  for (const [name, label, maximum] of catalogMetadataFields) if (value[name] !== undefined) {
    result[name] = clean(value[name], label, maximum);
    if (["sourceUrl","rightsURI","licenseURI","rightsEvidenceURL"].includes(name)) referenceUrl(result[name]);
    if (name === "lastAccessedAt") validateMetadataDate(result[name],label);
  }
  for(const key of ["locations","projectComponents"])if(value[key]!==undefined){if(!Array.isArray(value[key])||value[key].length>30)fail(`Document ${key} must contain at most 30 entries.`);result[key]=value[key].map(item=>clean(item,`Document ${key}`,1000));if(result[key].some(item=>!item)||new Set(result[key]).size!==result[key].length)fail(`Document ${key} must be distinct nonempty values.`);}
  if(value.classification!==undefined)result.classification=normalizeDocumentClassification(value.classification);
  if(value.revisionRelation!==undefined)result.revisionRelation=normalizeDocumentRevisionRelation(value.revisionRelation);
  if (value.spatial !== undefined) {
    if (!object(value.spatial)) fail("Spatial metadata must be an object.");
    result.spatial = {};
    for (const [name, label, maximum] of spatialMetadataFields) if (value.spatial[name] !== undefined) {
      result.spatial[name] = clean(value.spatial[name], label, maximum);
      if (name === "sourceDate") validateMetadataDate(result.spatial[name], label);
    }
  }
  return result;
}
export function readCatalogMetadata(read, base = {}) {
  const value = {};
  for (const [name] of catalogMetadataFields) {
    const field = read(name);
    if (field !== undefined && (field || base[name] !== undefined)) value[name] = field;
  }
  for(const key of ["locations","projectComponents"]){const field=read(key);if(field!==undefined&&(field||base[key]!==undefined))value[key]=String(field).split(/\r?\n/).map(item=>item.trim()).filter(Boolean);}
  if(base.classification!==undefined)value.classification=structuredClone(base.classification);
  if(base.revisionRelation!==undefined)value.revisionRelation=structuredClone(base.revisionRelation);
  const spatial = {};
  for (const [name] of spatialMetadataFields) {
    const field = read(`spatial_${name}`);
    if (field !== undefined && (field || base.spatial?.[name] !== undefined)) spatial[name] = field;
  }
  if (Object.keys(spatial).length) value.spatial = spatial;
  return normalizeCatalogMetadata(value);
}

/** Preserve observed facts as facts, never replace them with reviewed field values. */
export function normalizeExtractionFacts(value, expectedSha256) {
  const result = {};
  if (value.parserVersion !== undefined) result.parserVersion = clean(value.parserVersion, "Parser version", 100);
  if (value.observedAt !== undefined) {
    result.observedAt = clean(value.observedAt, "Metadata observation time", 64);
    if (!result.observedAt.includes("T")) fail("Metadata observation time must include a time and timezone.");
    validateMetadataDate(result.observedAt, "Metadata observation time");
  }
  if (value.sourceSha256 !== undefined) {
    if (typeof value.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceSha256) || expectedSha256 && value.sourceSha256 !== expectedSha256) fail("Observed metadata must identify the exact source SHA256.");
    result.sourceSha256 = value.sourceSha256;
  }
  if (value.detected !== undefined) {
    if (!object(value.detected)) fail("Observed file properties must be an object.");
    const detected = {};
    for (const name of ["createdAt", "modifiedAt", "producer", "documentDate", "canonicalUrl", "siteName", "format", "crs", "crsOrigin", "coordinateBasis", "spatialParserVersion", "previewStatus", "fileType"]) if (value.detected[name] !== undefined) {
      detected[name] = clean(value.detected[name], `Observed ${name}`, 4000);
      if (name === "canonicalUrl") referenceUrl(detected[name]);
    }
    for (const name of ["pageCount", "parsedBytes", "featureCount", "coordinateCount", "width", "height", "bands"]) if (value.detected[name] !== undefined) {
      if (!Number.isSafeInteger(value.detected[name]) || value.detected[name] < 0) fail(`Observed ${name} must be a non-negative integer.`);
      detected[name] = value.detected[name];
    }
    if (value.detected.bounds !== undefined) {
      if (!Array.isArray(value.detected.bounds) || value.detected.bounds.length !== 4 || value.detected.bounds.some(number => typeof number !== "number" || !Number.isFinite(number))) fail("Observed bounds need four finite coordinates.");
      detected.bounds = [...value.detected.bounds];
    }
    if (value.detected.geometryTypes !== undefined) {
      if (!object(value.detected.geometryTypes) || Object.keys(value.detected.geometryTypes).length > 20) fail("Observed geometry counts are invalid.");
      detected.geometryTypes = {};
      for (const [key, count] of Object.entries(value.detected.geometryTypes)) {
        if (!/^[A-Za-z]{1,50}$/.test(key) || !Number.isSafeInteger(count) || count < 0) fail("Observed geometry counts are invalid.");
        detected.geometryTypes[key] = count;
      }
    }
    result.detected = detected;
  }
  if (value.fieldSources !== undefined) {
    if (!object(value.fieldSources) || Object.keys(value.fieldSources).length > 30) fail("Metadata field sources are invalid.");
    result.fieldSources = {};
    for (const [key, source] of Object.entries(value.fieldSources)) {
      if (!/^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(key) || ["constructor", "prototype"].includes(key)) fail("Metadata field source is invalid.");
      result.fieldSources[key] = clean(source, "Metadata field source", 500);
    }
  }
  return result;
}
