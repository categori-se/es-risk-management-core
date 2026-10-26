// Authored publication content only. Private source files, access grants and
// account credentials are never part of this portable content record.
export const publicationContentMaxBytes = 100 * 1024;
export const publicationBodyMaxLength = 64000;
export const publicationVisibilities = Object.freeze(["private", "unlisted", "public"]);
export const publicationSubjectTypes = Object.freeze(["client", "company", "project", "topic"]);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = message => {throw Object.assign(new TypeError(message), {status: 400});};
const keys = (value, allowed, label) => {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(`${label} contains unsupported fields.`);
};
function text(value, label, maximum, required = false, multiline = false) {
  if (value === undefined && !required) return "";
  if (typeof value !== "string" || value.length > maximum || (required && !value.trim()) ||
      (multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/).test(value)) fail(`${label} must be ${required ? "non-empty " : ""}text of at most ${maximum} characters.`);
  return multiline ? value : value.trim();
}
function list(value, label, maximum) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximum) fail(`${label} must contain at most ${maximum} entries.`);
  return value;
}
function url(value, label, optional = false) {
  const source = text(value, label, 4000, !optional);
  if (!source && optional) return "";
  let parsed;
  try {parsed = new URL(source);} catch {fail(`${label} must be an HTTP(S) reference.`);}
  const credentials = /^(?:token|.*[_-]token|auth|authorization|code|bearer|jwt|.*[_-]key|key|password|passwd|secret|.*[_-]secret|session(?:id|[_-]id|[_-]token)?|sid|signature|sig|credential|credentials|x-amz-.+|x-goog-.+|awsaccesskeyid|googleaccessid|key-pair-id|policy|rlkey|resourcekey)$/i;
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
      [...parsed.searchParams.keys(), ...new URLSearchParams(parsed.hash.slice(1)).keys()].some(key => credentials.test(key.replace(/\[\d*\]$/, "").replace(/[.\s]/g, "-")))) fail(`${label} must omit credentials and signed download parameters.`);
  return source;
}

export function normalizePublicationContent(value) {
  keys(value, ["title", "subtitle", "summary", "authors", "body", "subjects", "tags", "citations"], "Publication content");
  const content = {title: text(value.title, "Title", 500, true), subtitle: text(value.subtitle, "Subtitle", 1000),
    summary: text(value.summary, "Summary", 4000, false, true), authors: list(value.authors, "Authors", 30).map(item => text(item, "Author", 300, true)),
    body: text(value.body, "Publication body", publicationBodyMaxLength, false, true),
    subjects: list(value.subjects, "Publication subjects", 40).map(item => {
      keys(item, ["type", "name", "url"], "Publication subject");
      if (!publicationSubjectTypes.includes(item.type)) fail("Choose a supported publication subject type.");
      const reference = url(item.url, "Subject URL", true);
      return {type: item.type, name: text(item.name, "Subject name", 500, true), ...(reference ? {url: reference} : {})};
    }), tags: [...new Set(list(value.tags, "Publication tags", 30).map(item => text(item, "Tag", 100, true)))],
    citations: list(value.citations, "Publication citations", 100).map(item => {
      keys(item, ["title", "url", "locator"], "Publication citation");
      return {title: text(item.title, "Citation title", 1000, true), url: url(item.url, "Citation URL"), locator: text(item.locator, "Citation locator", 2000)};
    })};
  if (new TextEncoder().encode(JSON.stringify(content)).byteLength > publicationContentMaxBytes) fail("Publication content is limited to 100 KiB of normalized JSON.");
  return content;
}
