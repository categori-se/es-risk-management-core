export const sourceMetadataSpecifications = Object.freeze([
  {title: 'DCMI Metadata Terms', url: 'https://www.dublincore.org/specifications/dublin-core/dcmi-terms/'},
  {title: 'Schema.org CreativeWork', url: 'https://schema.org/CreativeWork'},
  {title: 'W3C PROV-O', url: 'https://www.w3.org/TR/prov-o/'},
  {title: 'W3C JSON-LD 1.1', url: 'https://www.w3.org/TR/json-ld11/'}
]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const invalid = message => {throw new TypeError(message);};
const text = (value, maximum = 2000) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > maximum || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) invalid('Source metadata must be bounded plain text.');
  return value.trim();
};
const secret = /^(?:token|.*[_-]token|auth|authorization|code|bearer|jwt|.*[_-]key|key|password|passwd|secret|.*[_-]secret|session(?:id|[_-]id|[_-]token)?|sid|signature|sig|credential|credentials|x-amz-.+|x-goog-.+|awsaccesskeyid|googleaccessid|key-pair-id|policy|rlkey|resourcekey)$/i;
export function sourceProvenanceUrl(value) {
  const raw = text(value, 8000);let url;
  try {url = new URL(raw);} catch {invalid('A public HTTP(S) source URL is required.');}
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '::' || /^(?:fc|fd|fe[89ab]|ff)[a-f0-9:]*$/i.test(host) && host.includes(':') || host.startsWith('::ffff:') || !host.includes('.') && !host.includes(':') || host === '0.0.0.0' || /^127\.|^10\.|^192\.168\.|^169\.254\.|^172\.(?:1[6-9]|2[0-9]|3[01])\./.test(host) ||
      [...url.searchParams.keys(), ...new URLSearchParams(url.hash.slice(1)).keys()].some(key => secret.test(key.replace(/\[\d*\]$/, '').replace(/[.\s]/g, '-'))) || /(?:token|password|secret|signature|credential)=/i.test(url.hash)) invalid('Source metadata cannot publish credentials or private service URLs.');
  url.hash = '';return url.href;
}
const optionalUrl = value => value ? sourceProvenanceUrl(value) : null;
function timestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value.slice(0, 10)).toISOString().slice(0, 10) !== value.slice(0, 10)) invalid('Source observations need a real ISO timestamp, or null when unrecorded.');
  return new Date(value).toISOString();
}
function version(value) {
  if (!object(value) || typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256) || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > 512 * 1024 * 1024) invalid('A source version needs an exact SHA256 and bounded byte size.');
  const id = `urn:sha256:${value.sha256}`;
  if (value.id !== undefined && value.id !== id) invalid('Public source version identity must be content-derived.');
  return {id, sha256: value.sha256, size: value.size, mediaType: text(value.mediaType, 200), capturedAt: timestamp(value.capturedAt),
    captureMethod: text(value.captureMethod, 200), captureScope: 'private_local_research'};
}
export function normalizeSourceProvenance(input) {
  const originalUrl = sourceProvenanceUrl(input.originalUrl || input.url || input.sourceUrl);
  const versions = (input.versions || []).map(version);
  if (versions.length > 64 || new Set(versions.map(item => item.id)).size !== versions.length) invalid('Source versions must be distinct and bounded.');
  const rightsStatus = input.rightsStatus || 'unknown';
  if (!['unknown', 'permission_verified', 'licensed', 'public_domain', 'restricted'].includes(rightsStatus)) invalid('Unknown source rights status.');
  const publicRedistribution = input.publicRedistribution || 'unknown';
  if (!['unknown', 'permitted', 'prohibited'].includes(publicRedistribution)) invalid('Unknown source redistribution decision.');
  const rightsURI = optionalUrl(input.rightsURI), licenseURI = optionalUrl(input.licenseURI), rightsEvidenceURL = optionalUrl(input.rightsEvidenceURL), attribution = text(input.attribution, 4000), permissionVerifiedAt = timestamp(input.permissionVerifiedAt);
  const verified = ['permission_verified', 'licensed', 'public_domain'].includes(rightsStatus) && publicRedistribution === 'permitted' && Boolean(rightsEvidenceURL && permissionVerifiedAt && (rightsURI || licenseURI) && attribution);
  const captures = versions.filter(item => item.capturedAt).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const capturedAt = captures.at(-1)?.capturedAt || null;
  // checkedAt, upload time, embedded PDF dates and archive-index timestamps are
  // intentionally ignored. They are not observations of access or capture.
  return {id: originalUrl, originalUrl, title: text(input.title), publisher: text(input.publisher, 1000),
    metadataStatus: input.metadataStatus === 'metadata_missing' || !input.title && !input.publisher && !versions.length ? 'metadata_missing' : 'recorded',
    lastAccessedAt: timestamp(input.lastAccessedAt), capturedAt, versions,
    captureStatus: capturedAt ? 'captured' : versions.length ? 'hash_recorded' : input.captureStatus === 'capture_failed' ? 'capture_failed' : 'not_captured',
    rightsStatus, rightsURI, licenseURI, attribution, rightsEvidenceURL, publicRedistribution, permissionVerifiedAt,
    internalCopyLocked: !verified, internalCopyReason: verified ? 'Redistribution permission has recorded evidence; scope and attribution still apply.' : publicRedistribution === 'prohibited' || rightsStatus === 'restricted' ? 'Public redistribution is restricted. Use the original publisher or an authorized private record.' : 'Public redistribution permission has not been verified. The original publisher link remains available.',
    metadataSources: Array.isArray(input.metadataSources) ? [...new Set(input.metadataSources.map(item => text(item, 200)))].slice(0, 30) : []};
}
/** Resolve caller metadata over a public registry record. Lookup never grants
 * file access or fetches a URL; observations and rights remain explicit. */
export function resolveSourceProvenance(value, lookup) {
  const supplied = typeof value === 'string' ? {originalUrl: value} : value;
  if (!object(supplied)) invalid('A source URL or source metadata object is required.');
  const url = sourceProvenanceUrl(supplied.originalUrl || supplied.url || supplied.sourceUrl);
  return normalizeSourceProvenance({...lookup(url), ...supplied, originalUrl: url});
}
