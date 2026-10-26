import {createHash} from "node:crypto";
import ExcelJS from "exceljs";

export const masterPackMaxBytes = 8 * 1024 * 1024;
const CONCLUSIONS = Object.freeze({gap: "Gap", conforms: "Conforms", insufficient_evidence: "Insufficient evidence", not_applicable: "Not applicable"});
const APPLICABILITY = Object.freeze({stated_applies: "Source states applies", stated_not_triggered: "Source states not triggered", needs_confirmation: "Needs confirmation"});
const BRAND = Object.freeze({navy: "FF17324D", green: "FF17664B", pale: "FFE8F1EB", stripe: "FFF5F8F6", white: "FFFFFFFF", ink: "FF21342C", muted: "FF58665F", line: "FFD4DFD8"});
const OUTCOMES = Object.freeze({pending_human_review: ["FFFFF1D7", "FF795619"], gap: ["FFFBE6E3", "FF8C2923"], conforms: ["FFE4F1E8", "FF165C3A"], insufficient_evidence: ["FFFFF1D7", "FF795619"], not_applicable: ["FFEAEFF3", "FF435B6C"]});
const WIDTHS = [20, 18, 21, 26, 26, 24, 28];
const HEADINGS = ["Phase / component", "Responsible actor", "Source applicability / basis", "Scope / rationale", "Required / reviewed evidence", "Compliance review", "Supporting references"];
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fail = (message, status = 400) => {throw Object.assign(new Error(message), {status});};
const clone = value => structuredClone(value);
const tuple = (...values) => JSON.stringify(values);
const sha = value => createHash("sha256").update(value).digest("hex");
const freeze = value => {if (value && typeof value === "object" && !Object.isFrozen(value)) {Object.freeze(value);Object.values(value).forEach(freeze);} return value;};
const string = (value, label, max = 2000, optional = false) => {
  if (optional && (value === undefined || value === null || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.length > max) fail(`${label} must be a nonempty string of at most ${max} characters.`);
  return value;
};
const array = (value, label, max = 5000) => {if (!Array.isArray(value) || value.length > max) fail(`${label} must be an array of at most ${max} records.`);return value;};
const id = (value, label) => string(value, label, 512);
const hash = (value, label) => {if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(`${label} requires a lowercase SHA-256 hash.`);return value;};
const size = (value, label) => {if (!Number.isSafeInteger(value) || value < 0) fail(`${label} must be a nonnegative safe integer.`);};
const timestamp = (value, label) => {if (typeof value !== "string" || value.length > 50 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) fail(`${label} requires an ISO timestamp.`);return value;};
function publicUrl(value, label) {
  string(value, label, 8192);
  let parsed;try {parsed = new URL(value);} catch {fail(`${label} requires an HTTP(S) URL.`);}
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) fail(`${label} requires an HTTP(S) URL without credentials.`);
  return value;
}
function unique(records, key, label) {
  const found = new Map();
  for (const record of records) {if (!plain(record)) fail(`${label} records must be objects.`);const value = id(record[key], `${label} ${key}`);if (found.has(value)) fail(`${label} IDs must be unique.`);found.set(value, record);}
  return found;
}
function boundedJson(value) {
  let serialized;try {serialized = JSON.stringify(value);} catch {fail("The master pack must contain JSON data.");}
  if (typeof serialized !== "string") fail("A master pack object is required.");
  if (Buffer.byteLength(serialized, "utf8") > masterPackMaxBytes) fail("The master pack exceeds the 8 MiB JSON limit.", 413);
  const parsed = JSON.parse(serialized);
  let nodes = 0;
  const visit = (entry, depth) => {
    if (++nodes > 180000 || depth > 24) fail("The master pack JSON is too deeply nested or complex.");
    if (typeof entry === "string" && entry.length > 256000) fail("A master pack text field exceeds the 256,000-character limit.");
    if (entry && typeof entry === "object") for (const item of Object.values(entry)) visit(item, depth + 1);
  };
  visit(parsed, 0);return parsed;
}

export function masterFramework(row) {
  if (!plain(row)) fail("A master scope row is required.");
  return {authority: string(row.institutionId, "Master institution"), name: string(row.frameworkId, "Master framework"), edition: string(row.edition, "Master edition"), clause: string(row.standardId, "Master standard")};
}

// Earlier Bujagali packs did not carry an explicit collection. Keep those
// immutable packs readable while new project packs pin their own archive.
export function masterArchiveCollection(pack) {
  const collection = pack?.archiveCollection === undefined ? "bujagali" : pack.archiveCollection;
  if (typeof collection !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}(?![\s\S])/.test(collection)) fail("A master archive collection must be a bounded collection ID.");
  return collection;
}

/** Validate metadata and exact archive pins. This does not attest to document truth or contractual completeness. */
export function validateMasterPack(value, {projectId, accountCustodyId, identityId} = {}) {
  const pack = boundedJson(value);
  if (!plain(pack) || pack.format !== "esia-project-master" || pack.schemaVersion !== 1) fail("Expected esia-project-master schemaVersion 1.");
  if (Object.keys(pack).some(key => !["format", "schemaVersion", "projectId", "accountCustodyId", "identityId", "register", "evidenceIndex", "generatedAt", "archiveCollection"].includes(key))) fail("The master pack contains fields outside its metadata contract.");
  masterArchiveCollection(pack);
  for (const key of ["projectId", "accountCustodyId", "identityId"]) id(pack[key], `Master ${key}`);
  for (const [key, expected] of Object.entries({projectId, accountCustodyId, identityId})) if (expected !== undefined && pack[key] !== expected) fail(`Master pack ${key} does not match the selected project, account custody or real-world identity.`, 409);
  timestamp(pack.generatedAt, "Master generation time");
  const register = pack.register;
  if (!plain(register) || register.schemaVersion !== 1) fail("The master pack requires a schemaVersion 1 applicability register.");
  id(register.projectIdentity, "Register project identity");
  const phases = unique(array(register.phases, "Register phases", 100), "id", "Register phase");
  if (!phases.size) fail("The applicability register requires phase definitions.");
  for (const phase of phases.values()) string(phase.name, "Phase name");
  const sources = unique(array(register.sources, "Register sources"), "id", "Register source");
  if (!sources.size) fail("The applicability register requires pinned sources.");
  const evidence = unique(array(pack.evidenceIndex, "Public archive evidence index"), "id", "Archive resource");
  const versionIds = new Set();
  let versionCount = 0;
  for (const resource of evidence.values()) {
    if (Object.keys(resource).some(key => !["id", "title", "institutionIds", "url", "documentDate", "versions", "captureTarget"].includes(key))) fail("The public evidence index must contain metadata only.");
    string(resource.title, "Archive resource title", 10000);publicUrl(resource.url, "Archive resource URL");
    for (const institution of array(resource.institutionIds, "Archive institution IDs", 100)) id(institution, "Archive institution ID");
    if (resource.documentDate !== undefined && resource.documentDate !== null && typeof resource.documentDate !== "string") fail("Archive document date must be text or null.");
    if (resource.captureTarget !== undefined && typeof resource.captureTarget !== "string") fail("Archive capture target must be text.");
    unique(array(resource.versions, "Archive versions", 1000), "id", "Archive version");
    for (const version of resource.versions) {
      if (Object.keys(version).some(key => !["id", "sha256", "size", "mediaType", "capturedAt", "filename"].includes(key))) fail("Archive versions in a master pack must contain metadata only.");
      if (++versionCount > 10000 || versionIds.has(version.id)) fail("Archive version IDs must be globally unique and bounded to 10,000.");
      versionIds.add(version.id);hash(version.sha256, "Archive version");size(version.size, "Archive version size");
      string(version.mediaType, "Archive version media type", 255);timestamp(version.capturedAt, "Archive capture time");
      if (version.filename !== undefined && typeof version.filename !== "string") fail("Archive filename must be text.");
    }
  }
  for (const source of sources.values()) {
    string(source.title, "Register source title", 10000);publicUrl(source.url, "Register source URL");hash(source.sha256, "Register source");
    id(source.archiveResourceId, "Source archive resource pin");id(source.archiveVersionId, "Source archive version pin");
    const resource = evidence.get(source.archiveResourceId), version = resource?.versions.find(item => item.id === source.archiveVersionId);
    if (!version || version.sha256 !== source.sha256 || (source.size !== undefined && source.size !== version.size) ||
        (source.mediaType !== undefined && source.mediaType !== version.mediaType) || ![resource.url, resource.captureTarget].includes(source.url)) fail("A register source pin does not resolve to the exact public archive resource, version, hash and URL.");
  }
  const rows = unique(array(register.rows, "Register scope rows"), "id", "Register row");
  if (!rows.size) fail("The applicability register requires scope rows.");
  for (const row of rows.values()) {
    masterFramework(row);id(row.phaseId, "Row phase");
    if (!phases.has(row.phaseId)) fail("A master row refers to an unknown phase.");
    string(row.component, "Row component");string(row.title, "Row title", 10000);string(row.actor, "Row responsible actor", 10000);
    if (!Object.hasOwn(APPLICABILITY, row.applicability)) fail("A row requires a stated-applies, stated-not-triggered or needs-confirmation source decision.");
    string(row.basis, "Row applicability basis");string(row.rationale, "Row rationale", 256000);
    const refs = array(row.sourceIds, "Row source references", 100);
    if (!refs.length || new Set(refs).size !== refs.length || refs.some(ref => !sources.has(ref))) fail("Row source references must be nonempty, unique and resolve to pinned register sources.");
    const locations = array(row.locators, "Row source locators", 200);
    if (!locations.length) fail("A master row requires source locators.");
    for (const location of locations) {
      if (!plain(location) || !refs.includes(location.sourceId)) fail("A row locator must refer to one of its pinned sources.");
      if (location.pdfPage !== undefined && (!Number.isSafeInteger(location.pdfPage) || location.pdfPage < 1)) fail("PDF locators use positive one-based file pages.");
      if (location.printedPage !== undefined && typeof location.printedPage !== "string") fail("Printed-page locators must be text.");
      if (location.section !== undefined && typeof location.section !== "string") fail("Section locators must be text.");
      if (!location.pdfPage && !location.section?.trim()) fail("A source locator needs a PDF page or named section.");
    }
    for (const requirement of array(row.evidenceRequired, "Required review evidence", 100)) string(requirement, "Required review evidence", 256000);
    if (row.complianceStatus !== "pending_human_review" || row.isComplianceFinding !== false) fail("Register rows must begin with pending human review and cannot declare compliance findings.");
  }
  if (register.counts && ((register.counts.rowCount !== undefined && register.counts.rowCount !== rows.size) || (register.counts.sourceCount !== undefined && register.counts.sourceCount !== sources.size))) fail("Register counts do not match the retained rows and sources.");
  return pack;
}

const sameFramework = (a, b) => plain(a) && ["authority", "name", "edition", "clause"].every(key => a[key] === b[key]);
const groupKey = row => tuple(row.framework.authority, row.framework.name, row.framework.edition, row.framework.clause);

function reviewedEvidence(project, review) {
  return (review?.evidenceIds || []).map(id => {
    const citation = project.evidence?.find(item => item.id === id);
    const resource = citation && project.resources?.find(item => item.versions?.some(version => version.id === citation.versionId));
    const version = resource?.versions.find(item => item.id === citation.versionId);
    if (!version) return {id, resolution: "unresolved", note: "Citation did not resolve to a retained project version."};
    const metadata = resource.metadataHistory?.findLast(item => item.versionId === version.id)?.metadata || version.intakeMetadata || {};
    return {...clone(citation), resourceId: resource.id, title: metadata.title || resource.title || version.filename,
      versionId: version.id, sha256: version.sha256, filename: version.filename, mode: version.mode, resolution: "project_version",
      ...(version.source ? {source: clone(version.source)} : {})};
  });
}

/** Current-project read model. The latest exact matching review is the last appended record, not the newest timestamp. */
export function buildMasterCompliance(project, value) {
  if (!plain(project)) fail("A selected project is required.");
  id(project.id, "Selected project ID");
  const pack = validateMasterPack(value, {projectId: project.id, accountCustodyId: project.storageAccount?.id, identityId: project.projectContext?.identity?.id});
  const sourceMap = new Map(pack.register.sources.map(source => [source.id, source]));
  const phases = new Map(pack.register.phases.map(phase => [phase.id, phase]));
  const rowMap = new Map(pack.register.rows.map(row => [row.id, row]));
  const histories = new Map(), ignored = [];
  for (const assessment of project.assessments || []) {
    const context = assessment.auditContext;
    if (context?.checkSet !== "master") continue;
    const row = rowMap.get(context.checkId), expected = row && masterFramework(row);
    let reason = "";
    if (!row) reason = "Master row is absent from this pack.";
    else if (!sameFramework(assessment.framework, expected) || !sameFramework(context.framework, expected)) reason = "Framework, edition or clause does not match the retained master row.";
    else if (!Object.hasOwn(CONCLUSIONS, assessment.conclusion) || typeof assessment.reviewer !== "string" || !assessment.reviewer.trim() || !Number.isFinite(Date.parse(assessment.reviewedAt))) reason = "Review has no valid conclusion, reviewer or review time.";
    else if (!Array.isArray(context.sources) || row.sourceIds.some(id => {
      const source = sourceMap.get(id);
      return !context.sources.some(cited => cited?.url === source.url && cited?.sha256 === source.sha256);
    })) reason = "Review does not retain every current normative source URL and SHA-256 pair; historical review is retained but does not satisfy this pack.";
    if (reason) {ignored.push({assessmentId: assessment.id || "", checkId: context.checkId || "", reason, review: clone(assessment)});continue;}
    if (!histories.has(row.id)) histories.set(row.id, []);
    histories.get(row.id).push(clone(assessment));
  }
  const rows = pack.register.rows.map(row => {
    const reviewHistory = histories.get(row.id) || [], review = reviewHistory.at(-1) || null;
    return {...clone(row), framework: masterFramework(row), phaseName: phases.get(row.phaseId).name, review, reviewHistory,
      excludedReviewHistory: clone(ignored.filter(item => item.checkId === row.id)),
      complianceStatus: review?.conclusion || "pending_human_review", complianceLabel: review ? CONCLUSIONS[review.conclusion] : "Pending human review",
      sourceApplicabilityLabel: APPLICABILITY[row.applicability],
      sourceReferences: row.sourceIds.map(id => ({...clone(sourceMap.get(id)), locators: clone(row.locators.filter(location => location.sourceId === id))})),
      reviewedEvidence: reviewedEvidence(project, review),
      actions: review ? clone((project.actions || []).filter(action => action.assessmentId === review.id)) : []};
  });
  const summary = {total: rows.length, pending: rows.filter(row => !row.review).length, reviewed: rows.filter(row => row.review).length,
    conforms: 0, gap: 0, insufficient_evidence: 0, not_applicable: 0,
    assessmentRecords: [...histories.values()].reduce((sum, history) => sum + history.length, 0), ignoredMasterReviews: ignored.length,
    candidateResources: pack.evidenceIndex.length, candidateVersions: pack.evidenceIndex.reduce((sum, item) => sum + item.versions.length, 0),
    uncapturedCandidates: pack.evidenceIndex.filter(item => !item.versions.length).length,
    sourceApplicability: Object.fromEntries(Object.keys(APPLICABILITY).map(key => [key, rows.filter(row => row.applicability === key).length]))};
  for (const row of rows) if (row.review) summary[row.review.conclusion]++;
  const groups = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, {id: sha(key).slice(0, 24), framework: clone(row.framework), rows: []});
    groups.get(key).rows.push(row);
  }
  return freeze({format: "esia-master-compliance-report", schemaVersion: 1, rendererVersion: "master-compliance-1",
    project: {id: project.id, name: project.name || project.id, accountName: project.storageAccount?.name || "", client: project.engagement?.client || pack.register.client?.name || "",
      revision: project.revision ?? null},
    bindings: {projectId: pack.projectId, accountCustodyId: pack.accountCustodyId, identityId: pack.identityId},
    generatedAt: pack.generatedAt, archiveCollection: masterArchiveCollection(pack), register: clone(pack.register), rows, groups: [...groups.values()], sources: clone(pack.register.sources),
    evidenceIndex: clone(pack.evidenceIndex), summary, ignoredReviews: ignored,
    notes: [
      "This is a source-backed applicability starter, not complete clause or contract coverage. Each dated source decision remains separate from a human compliance conclusion.",
      "Pending means no exact matching reviewed assessment. Source says applies/not triggered never creates a compliance or not-applicable conclusion automatically.",
      "The latest appended matching master review is shown per row; earlier reviews remain retained. Every normative source URL/SHA-256 pair must match; another source copy, phase, framework, edition or check cannot satisfy this row.",
      "The public archive inventory contains candidate evidence, not automatically cited proof. Captured means bytes are recorded in the pack index, not that the document demonstrates compliance.",
      "Pins identify retained archive resource, version and SHA-256 metadata. This export embeds no original document bytes and does not re-fetch or validate originals on disk.",
      "Client/physical-project grouping does not grant access to another account or establish responsibility for another actor's obligations."
    ]});
}

// All user strings are literal text. No user-authored HTML, formulas or hyperlink objects are accepted.
const text = value => (value == null ? "" : typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value))
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, char => String.fromCodePoint(0x2400 + char.charCodeAt(0)));
const join = (values, separator = "\n") => values.filter(value => value !== undefined && value !== null && value !== "").map(text).join(separator);
const escape = value => text(value).replace(/[&<>"']/g, char => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
const locationText = value => join([value.pdfPage && `PDF p.${value.pdfPage}`, value.printedPage && `printed p.${value.printedPage}`, value.section], "; ");
const extraScope = row => join(Object.entries(row).filter(([key]) => ["qualification", "editionBasis", "contractProof", "supersessionNote", "extractionWarning"].includes(key)).map(([key, value]) => `${({qualification:"Qualification",editionBasis:"Edition basis",contractProof:"Contract basis",supersessionNote:"Amendments / supersession",extractionWarning:"Extraction limitation"})[key]}: ${text(value).replaceAll("_"," ")}`));
const evidenceText = row => join([...(row.evidenceRequired || []).map(value => `Required: ${value}`),
  ...row.reviewedEvidence.map(item => join([`Cited evidence ${item.id}: ${item.title || item.resolution}`, item.locator, item.note, item.resourceId && `Resource ${item.resourceId}`, item.versionId && `Version ${item.versionId}`, item.sha256 && `SHA256 ${item.sha256}`, item.mode && `Custody ${item.mode}`])),
  row.review?.missingEvidence && `Missing: ${row.review.missingEvidence}`, row.review?.uncertainty && `Uncertainty: ${row.review.uncertainty}`], "\n\n");
const reviewText = row => join([row.complianceLabel, row.review && `Review ${row.review.id}`, row.review && `By ${row.review.reviewer} at ${row.review.reviewedAt}`, row.review?.rationale,
  row.review && `Reviewer applicability: ${text(row.review.applicability)}`, row.review?.riskSignificance && `Risk significance: ${row.review.riskSignificance}`,
  row.reviewHistory.length > 1 && `${row.reviewHistory.length} matching reviews retained; latest appended shown.`,
  ...row.actions.map(action => `Action ${action.id}: ${action.description}\nOwner ${action.owner}; due ${action.dueDate}; ${action.status}\nClosure ${action.closureEvidence || "Not recorded"}\nVerification ${action.verification || "Not recorded"}`)], "\n\n");
const referencesText = row => join(row.sourceReferences.map(source => join([`Source ${source.id}`, ...source.locators.map(locationText), "Exact archive pins and URLs: Sources sheet / source inventory."])), "\n\n");
const rowValues = row => [join([row.phaseName, row.component, `Phase ID: ${row.phaseId}`]), row.actor,
  join([row.sourceApplicabilityLabel, `Basis: ${row.basis.replaceAll("_"," ")}`]), join([row.title, `Scope row: ${row.id}`, row.rationale, extraScope(row)], "\n\n"), evidenceText(row), reviewText(row), referencesText(row)];
const matrixValues = (row, index) => [join([row.phaseName,row.component]),row.actor,
  join([row.sourceApplicabilityLabel,`Basis: ${row.basis.replaceAll("_"," ")}`]),
  join([`Scope ${index+1}: ${row.title}`,row.rationale,extraScope(row)]),
  evidenceText(row),
  join([row.complianceLabel,row.review&&`By ${row.review.reviewer} · ${row.review.reviewedAt.slice(0,10)}`,row.review?.rationale]),
  join(row.locators.map(location=>`[${location.sourceId}] ${locationText(location)}`))].map(value => {
  const chars = Array.from(text(value));
  return chars.length > 200 ? chars.slice(0, 178).join("") + "… [full detail below]" : value;
});

function htmlReport(model) {
  const status = value => `<span class="status ${escape(value.complianceStatus)}">${escape(value.complianceLabel)}</span>`;
  const entries = model.groups.map(group => `<section id="standard-${group.id}"><h2>${escape(join(Object.values(group.framework), " · "))}</h2><p><a href="#summary">Return to summary</a></p><div class="table-wrap"><table><thead><tr>${HEADINGS.map(item => `<th>${escape(item)}</th>`).join("")}</tr></thead><tbody>${group.rows.map(row => `<tr data-master-row="${escape(row.id)}">${rowValues(row).map((value, index) => `<td>${index === 5 ? status(row) + `<div>${escape(value)}</div>` : escape(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${group.rows.filter(row => row.reviewHistory.length > 1).map(row => `<details><summary>Retained review history: ${escape(row.id)}</summary><pre>${escape(JSON.stringify(row.reviewHistory, null, 2))}</pre></details>`).join("")}</section>`).join("");
  const sources = model.sources.map(source => `<tr><th>${escape(source.id)}</th><td>${escape(source.title)}</td><td>${escape(source.url)}</td><td><code>${escape(source.sha256)}</code><br>Resource ${escape(source.archiveResourceId)}<br>Version ${escape(source.archiveVersionId)}</td></tr>`).join("");
  const inventory = model.evidenceIndex.map(resource => `<tr><th>${escape(resource.title)}</th><td>${escape(resource.id)}<br>${escape((resource.institutionIds || []).join(", "))}<br>${escape(resource.url)}<br>Document date: ${escape(resource.documentDate || "Not established")}</td><td>${resource.versions.length ? resource.versions.map(version => `<p>Captured original — candidate evidence<br>Version ${escape(version.id)}<br>SHA256 <code>${escape(version.sha256)}</code><br>${escape(version.filename)} · ${escape(version.size)} bytes · ${escape(version.mediaType)}<br>Captured ${escape(version.capturedAt)}</p>`).join("") : "Candidate — no captured original in pack"}</td></tr>`).join("");
  const excluded = model.ignoredReviews.length ? `<section><h2>Excluded master reviews retained for history</h2><p>These records do not satisfy the current pinned scope. Their original citations and the reason for exclusion remain available.</p><pre>${escape(JSON.stringify(model.ignoredReviews,null,2))}</pre></section>` : "";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>${escape(model.project.name)} — Master compliance</title><style>body{font:15px/1.5 system-ui,sans-serif;color:#21342c;margin:0;background:#f5f8f6}main{max-width:1500px;margin:auto;padding:32px}h1,h2{color:#17324d}h1{margin-bottom:8px}h2{border-bottom:3px solid #17664b;padding-bottom:8px}section{margin:30px 0;background:white;padding:24px;border:1px solid #d4dfd8}a{color:#17664b}p,li{max-width:100ch}.metrics{display:flex;gap:20px;flex-wrap:wrap}.metric{background:#e8f1eb;padding:12px 18px}.metric strong{display:block;font-size:24px}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #d4dfd8;padding:9px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}thead th{background:#17324d;color:white}tbody tr:nth-child(even){background:#f5f8f6}.status{display:inline-block;font-weight:700;padding:3px 7px;background:#fff1d7;color:#795619}.gap{background:#fbe6e3;color:#8c2923}.conforms{background:#e4f1e8;color:#165c3a}.not_applicable{background:#eaeff3;color:#435b6c}code,pre{overflow-wrap:anywhere;white-space:pre-wrap}details{margin-top:12px}@media(max-width:600px){main{padding:12px}section{padding:14px}h1{font-size:26px}}@media print{@page{size:A4 landscape;margin:12mm}body,section{background:white}main{padding:0}section{padding:0;border:0;break-before:page}#summary{break-before:auto}.table-wrap{overflow:visible}thead{display:table-header-group}table{font-size:8pt}th,td{padding:4px}h2{font-size:15pt}details{display:block}a{color:inherit}}</style><main><header><h1>Master compliance — ${escape(model.project.name)}</h1><p>${escape(model.project.client)} · Account ${escape(model.project.accountName || model.bindings.accountCustodyId)} · Project revision ${escape(model.project.revision)}</p></header><section id="summary"><h2>Review summary</h2><div class="metrics">${[["Scope rows",model.summary.total],["Pending human review",model.summary.pending],["Reviewed rows",model.summary.reviewed],["Gaps",model.summary.gap],["Conforms",model.summary.conforms],["Insufficient evidence",model.summary.insufficient_evidence],["Not applicable",model.summary.not_applicable]].map(([label,value])=>`<div class="metric"><strong>${value}</strong>${label}</div>`).join("")}</div><p>${escape(model.register.coverage || "Incomplete source-backed applicability starter.")}</p><ul>${model.notes.map(note => `<li>${escape(note)}</li>`).join("")}</ul><p>Master pack generated ${escape(model.generatedAt)}. This report is a view of project revision ${escape(model.project.revision)}.</p><h3>Institution / edition / standard</h3><ul>${model.groups.map(group => `<li><a href="#standard-${group.id}">${escape(join(Object.values(group.framework), " · "))}</a> — ${group.rows.length} scope row(s)</li>`).join("")}</ul><p><a href="#sources">Pinned source inventory</a> · <a href="#evidence">Public archive candidate evidence</a></p></section>${entries}${excluded}<section id="sources"><h2>Pinned source inventory</h2><table><thead><tr><th>Source ID</th><th>Title</th><th>Retained URL</th><th>Exact archive pins</th></tr></thead><tbody>${sources}</tbody></table></section><section id="evidence"><h2>Public archive candidate evidence</h2><p>Availability is separate from relevance and proof. No original file contents are embedded.</p><table><thead><tr><th>Resource</th><th>Provenance</th><th>Captured versions / candidate status</th></tr></thead><tbody>${inventory}</tbody></table></section></main></html>`;
}

function visualWidth(value) {return Array.from(value).reduce((sum, char) => sum + (char === "\t" ? 4 : char.codePointAt(0) > 0x2e7f ? 2 : 1), 0);}
function lineCount(value, width) {return text(value).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(visualWidth(line) / Math.max(7, width - 4))), 0);}
// No text is truncated. Consecutive chunks join back to the exact displayed value.
function chunks(value, width, maxLines = 12) {
  const chars = Array.from(text(value)), result = [];if (!chars.length) return [""];
  const limit = Math.max(7, Math.floor((width - 4) * .78));let start = 0, column = 0, line = 1;
  for (let index = 0; index < chars.length; index++) {
    const char = chars[index];if (char === "\n") {line++;column = 0;} else {column += visualWidth(char);if (column > limit) {line++;column = visualWidth(char);}}
    if (line > maxLines || index - start >= 15000) {const end = char === "\n" ? index + 1 : index;if (end > start) {result.push(chars.slice(start, end).join(""));start = end;}column = char === "\n" ? 0 : visualWidth(char);line = 1;}
  }
  if (start < chars.length) result.push(chars.slice(start).join(""));return result;
}
const fill = color => ({type: "pattern", pattern: "solid", fgColor: {argb: color}});
function style(cell, {background, color = BRAND.ink, bold = false, size = 10} = {}) {
  cell.font = {name: "Aptos", size, bold, color: {argb: color}};cell.numFmt = "@";
  cell.alignment = {vertical: "top", wrapText: true};cell.border = {bottom: {style: "hair", color: {argb: BRAND.line}}};
  if (background) cell.fill = fill(background);
}
function addRow(sheet, values, options = {}) {
  if (sheet.rowCount >= 1048575) fail("The master report exceeds Excel's worksheet row limit.", 413);
  const row = sheet.addRow(values.map(text));
  for (let column = 1; column <= 7; column++) style(row.getCell(column), options);
  row.height = Math.max(26, 14 * (Math.max(...values.map((value, index) => lineCount(value, sheet.getColumn(index + 1).width))) + 1));
  return row;
}
function band(sheet, value, background = BRAND.green) {
  const row = addRow(sheet, [value, "", "", "", "", "", ""], {background, color: BRAND.white, bold: true, size: 11});
  sheet.mergeCells(row.number, 1, row.number, 7);row.height = Math.max(28, 15 * lineCount(value, WIDTHS.reduce((a,b)=>a+b,0) * .85) + 10);return row;
}
function prose(sheet, label, value) {
  const width = WIDTHS.slice(2).reduce((a,b)=>a+b,0);
  chunks(value, width).forEach((part,index) => {const row = addRow(sheet, [index ? `${label} (continued)` : label, "", part, "", "", "", ""], {size: 9});
    sheet.mergeCells(row.number,1,row.number,2);sheet.mergeCells(row.number,3,row.number,7);row.height=Math.max(27,14*(Math.max(lineCount(part,width),lineCount(label,WIDTHS[0]+WIDTHS[1]))+1));});
}
function configure(sheet, repeat = 5) {
  sheet.columns=WIDTHS.map(width=>({width}));sheet.views=[{state:"frozen",xSplit:1,ySplit:repeat,showGridLines:false,zoomScale:90}];
  sheet.properties.defaultRowHeight=26;
  sheet.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,printTitlesRow:`1:${repeat}`,pageOrder:"downThenOver",
    margins:{left:.3,right:.3,top:.45,bottom:.45,header:.15,footer:.2}};
  sheet.headerFooter.oddHeader='&L&"Aptos,Bold"&9E&&S WORKSPACE&R&9MASTER COMPLIANCE';
  sheet.headerFooter.oddFooter='&L&9&A&C&9Page &P of &N&R&9Human review required';
}
const internalLink = name => `#'${name.replaceAll("'","''")}'!A1`;
function sheetNames(groups) {
  const used=new Set(["summary","sources","evidence inventory"]);
  return groups.map(group=>{
    const framework=group.framework, year=framework.edition.match(/\b(?:19|20)\d{2}\b/)?.[0]||"";
    const raw=join([framework.authority,year,framework.clause]," ").replace(/[\[\]:*?/\\\u0000-\u001f]/g," ").replace(/\s+/g," ").replace(/^'+|'+$/g,"").trim()||"Standard";
    const suffix=sha(tuple(framework.authority,framework.name,framework.edition,framework.clause)).slice(0,6);
    let name=raw.slice(0,31),counter=2;
    if(raw.length>31||used.has(name.toLowerCase())) name=`${raw.slice(0,24)} ${suffix}`;
    while(used.has(name.toLowerCase())) name=`${raw.slice(0,20)} ${suffix}-${counter++}`;
    used.add(name.toLowerCase());return name;
  });
}
function appendValues(sheet, values, {background = BRAND.white, outcome, continuationLabel, outcomeLabel, maxLines = 12} = {}) {
  const parts=values.map((value,index)=>chunks(value,WIDTHS[index],maxLines));const count=Math.max(...parts.map(part=>part.length));
  for(let index=0;index<count;index++) {
    const values=parts.map(part=>part[index]||"");
    if(index && continuationLabel) values[0]=join([continuationLabel,`Continued ${index+1}/${count}`,values[0]]);
    if(index && outcomeLabel) values[5]=join([outcomeLabel,values[5]],"\n\n");
    const row=addRow(sheet,values,{background,size:9});
    if(outcome){const [color,ink]=OUTCOMES[outcome];style(row.getCell(6),{background:color,color:ink,bold:true,size:9});}
  }
}
function finish(sheet, header) {sheet.autoFilter=`A${header}:G${Math.max(header+1,sheet.rowCount)}`;sheet.pageSetup.printArea=`A$1:G$${sheet.rowCount}`;}
function sourceValues(source) {
  return [source.id,source.title,source.authority||"",source.url,
    join([`Resource ${source.archiveResourceId}`,`Version ${source.archiveVersionId}`,`SHA256 ${source.sha256}`]),
    join([`Captured ${source.capturedAt||"Not established"}`,`Document date ${source.documentDate||"Not established"}`,`${source.size??"Unknown"} bytes; ${source.mediaType||""}`]),
    join([source.extractionMethod,source.dateBasis,source.originalUrl && `Original authority URL ${source.originalUrl}`,source.custodian && `Custodian ${source.custodian}`])];
}
function stableZipDates(buffer) {
  let end=buffer.length-22;for(;end>=Math.max(0,buffer.length-65557);end--)if(buffer.readUInt32LE(end)===0x06054b50)break;
  if(end<0)throw new Error("Generated workbook ZIP is incomplete.");const entries=buffer.readUInt16LE(end+10);let offset=buffer.readUInt32LE(end+16);
  for(let index=0;index<entries;index++) {
    if(buffer.readUInt32LE(offset)!==0x02014b50)throw new Error("Generated workbook ZIP directory is invalid.");const local=buffer.readUInt32LE(offset+42);
    if(buffer.readUInt32LE(local)!==0x04034b50)throw new Error("Generated workbook ZIP entry is invalid.");
    buffer.writeUInt16LE(0,offset+12);buffer.writeUInt16LE(33,offset+14);buffer.writeUInt16LE(0,local+10);buffer.writeUInt16LE(33,local+12);
    offset+=46+buffer.readUInt16LE(offset+28)+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32);
  }
  return buffer;
}
async function workbookReport(model) {
  const workbook=new ExcelJS.Workbook();workbook.creator="E&S Workspace";workbook.title=`Master compliance — ${model.project.name}`;
  workbook.created=new Date(model.generatedAt);workbook.modified=new Date(model.generatedAt);workbook.calcProperties.fullCalcOnLoad=false;
  const names=sheetNames(model.groups),summary=workbook.addWorksheet("Summary",{properties:{tabColor:{argb:BRAND.navy}}});configure(summary,2);
  band(summary,"E&S WORKSPACE / MASTER COMPLIANCE",BRAND.navy);band(summary,model.project.name);
  prose(summary,"Project / account",join([model.project.id,model.project.accountName,`Custody ${model.bindings.accountCustodyId}`,`Physical identity ${model.bindings.identityId}`,`Revision ${model.project.revision}`]));
  prose(summary,"Client / scope",join([model.project.client,model.register.coverage]));
  for(const [label,key] of [["Scope rows","total"],["Pending human review","pending"],["Reviewed rows","reviewed"],["Gaps","gap"],["Conforms","conforms"],["Insufficient evidence","insufficient_evidence"],["Not applicable","not_applicable"]])prose(summary,label,String(model.summary[key]));
  prose(summary,"Source pack generated",model.generatedAt);for(const note of model.notes)prose(summary,"Reading this report",note);
  band(summary,"INSTITUTION / EDITION / STANDARD");
  const summaryHeader=addRow(summary,["Institution","Framework","Edition","Standard","Scope rows","Reviewed / pending","Open standard tab"],{background:BRAND.navy,color:BRAND.white,bold:true}).number;
  model.groups.forEach((group,index)=>{
    const r=addRow(summary,[group.framework.authority,group.framework.name,group.framework.edition,group.framework.clause,group.rows.length,`${group.rows.filter(row=>row.review).length} / ${group.rows.filter(row=>!row.review).length}`,names[index]],{size:9,background:index%2?BRAND.stripe:BRAND.white});
    r.getCell(7).value={text:names[index],hyperlink:internalLink(names[index])};
  });finish(summary,summaryHeader);
  for(const [index,group] of model.groups.entries()) {
    const sheet=workbook.addWorksheet(names[index],{properties:{tabColor:{argb:BRAND.green}}});configure(sheet,5);
    band(sheet,"E&S WORKSPACE / MASTER COMPLIANCE",BRAND.navy);band(sheet,join(Object.values(group.framework)," · "));
    const nav=addRow(sheet,["Return to Summary","","","","","",""]);sheet.mergeCells(nav.number,1,nav.number,7);nav.getCell(1).value={text:"Return to Summary",hyperlink:internalLink("Summary")};nav.height=24;
    const note=addRow(sheet,["Matrix excerpts print by default. Source applicability is separate from compliance. Full retained text, metadata and review history follow below the default print area.","","","","","",""] ,{size:9});sheet.mergeCells(note.number,1,note.number,7);note.height=42;
    const header=addRow(sheet,HEADINGS,{background:BRAND.navy,color:BRAND.white,bold:true}).number;
    group.rows.forEach((row,i)=>appendValues(sheet,matrixValues(row,i),{background:i%2?BRAND.stripe:BRAND.white,outcome:row.complianceStatus,continuationLabel:`Scope ${i+1}: ${row.id}`,outcomeLabel:row.complianceLabel,maxLines:24}));
    finish(sheet,header);
    band(sheet,"FULL RETAINED ROWS / BELOW DEFAULT PRINT AREA",BRAND.navy);
    for(const row of group.rows)prose(sheet,row.id,JSON.stringify(row,null,2));
  }
  const sources=workbook.addWorksheet("Sources");configure(sources,3);band(sources,"PINNED SOURCE INVENTORY",BRAND.navy);
  const sourceNote=addRow(sources,["Pins identify captured public copies. They do not establish truth, current legal effect or compliance.","","","","","",""] ,{size:9});sources.mergeCells(sourceNote.number,1,sourceNote.number,7);sourceNote.height=30;
  const sourceHeader=addRow(sources,["Source ID","Title","Authority","Retained URL","Exact archive pins","Dates / file","Provenance"],{background:BRAND.navy,color:BRAND.white,bold:true}).number;
  model.sources.forEach((source,index)=>appendValues(sources,sourceValues(source),{background:index%2?BRAND.stripe:BRAND.white}));finish(sources,sourceHeader);
  if(model.ignoredReviews.length){band(sources,"EXCLUDED REVIEW HISTORY / BELOW DEFAULT PRINT AREA",BRAND.navy);prose(sources,"Historical reviews",JSON.stringify(model.ignoredReviews,null,2));}
  const inventory=workbook.addWorksheet("Evidence inventory");configure(inventory,3);band(inventory,"PUBLIC ARCHIVE / CANDIDATE EVIDENCE",BRAND.navy);
  const inventoryNote=addRow(inventory,["Captured originals and uncaptured candidates remain distinct. This inventory does not cite them as proof and embeds no document bytes.","","","","","",""] ,{size:9});inventory.mergeCells(inventoryNote.number,1,inventoryNote.number,7);inventoryNote.height=30;
  const inventoryHeader=addRow(inventory,["Resource / title","Institutions / date","URL","Candidate status","Version / SHA256","File / capture","Capture target"],{background:BRAND.navy,color:BRAND.white,bold:true}).number;
  model.evidenceIndex.forEach((resource,index)=>{
    for(const version of resource.versions.length?resource.versions:[null])appendValues(inventory,[join([resource.id,resource.title]),join([(resource.institutionIds||[]).join(", "),`Document date ${resource.documentDate||"Not established"}`]),resource.url,
      version?"Captured original — candidate evidence, not assessed":"Candidate — no captured original in pack",version?join([`Version ${version.id}`,`SHA256 ${version.sha256}`]):"No version/hash retained",
      version?join([version.filename,`${version.size} bytes; ${version.mediaType}`,`Captured ${version.capturedAt}`]):"Not captured",resource.captureTarget||""],{background:index%2?BRAND.stripe:BRAND.white});
  });finish(inventory,inventoryHeader);
  return stableZipDates(Buffer.from(await workbook.xlsx.writeBuffer()));
}

export async function masterComplianceExport(model, format) {
  if (!plain(model) || model.format!=="esia-master-compliance-report" || model.schemaVersion!==1 || !Array.isArray(model.rows)) fail("A master compliance report model is required.");
  const name=(text(model.project.name).normalize("NFKD").replace(/[^A-Za-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,70)||"project")+"-master-compliance";
  if(format==="json")return{bytes:Buffer.from(JSON.stringify(model,null,2)+"\n"),mediaType:"application/json; charset=utf-8",filename:name+".json"};
  if(format==="html")return{bytes:Buffer.from(htmlReport(model)),mediaType:"text/html; charset=utf-8",filename:name+".html"};
  if(format==="xlsx")return{bytes:await workbookReport(model),mediaType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",filename:name+".xlsx"};
  fail("Choose html, xlsx or json for the master compliance export.");
}
