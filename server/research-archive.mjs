import {DatabaseSync} from "node:sqlite";
import {createHash, randomUUID} from "node:crypto";
import {mkdirSync, lstatSync, readFileSync, writeFileSync, renameSync} from "node:fs";
import {join} from "node:path";
import {captureSource, cleanSourceUrl, inspectSource, sourceIntakeMaxBytes} from "./source-intake.mjs";
import {runPdfTool} from "./pdf-tools.mjs";
import {privateStorageDirectory} from "./private-storage-path.mjs";

export const researchArchiveMaxBytes = 256 * 1024 * 1024;
export const nenskraSupplementaryArchiveUrl = "https://www.ebrd.com/content/dam/ebrd_dxp/documents/owcs-archive/Environment/supplementary-es-studies.zip";
export function researchArchiveCandidateMaxBytes(collection, candidate) {
  return collection === "nenskra" && candidate.url === nenskraSupplementaryArchiveUrl && candidate.expectedMediaType === "application/zip" ? 512 * 1024 * 1024 : researchArchiveMaxBytes;
}
const archivePdfInspectionMaxBytes = 64 * 1024 * 1024;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const clone = value => structuredClone(value);
const fail = message => {throw Object.assign(new Error(message), {status: 400});};
const text = (value, maximum = 2000) => String(value ?? "").replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, maximum);
const unique = values => [...new Set(values.filter(Boolean))];
const institutionId = value => {const input = text(value, 200), lower = input.toLowerCase();return ({"world bank": "world_bank", "worldbank": "world_bank", "bujagali energy limited": "bel"})[lower] || (["ifc", "eib", "afdb", "bel", "fmo", "bii", "jica", "miga", "afd"].includes(lower) ? lower : input);};
const safeUrl = value => {const target = new URL(value);target.hash = "";const clean = cleanSourceUrl(target.href);if (clean.removed) fail("Archive source URLs must not contain credentials or signing parameters.");return clean.url;};
const accessChallenge = bytes => /\/_Incapsula_Resource|cdn-cgi\/challenge-platform|_cf_chl_opt/.test(bytes.subarray(0, 256 * 1024).toString("utf8"));
// The original is retained as an opaque archive. Check framing without opening
// entries, expanding members or trusting a supplied member catalogue.
function completeZip(bytes) {
  if (bytes.length < 22 || ![0x04034b50, 0x06054b50].includes(bytes.readUInt32LE(0))) return false;
  for (let offset = bytes.length - 22, lower = Math.max(0, bytes.length - 65557); offset >= lower; offset--) {
    if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) return true;
  }
  return false;
}
function originalIssue(bytes, record, expectedPdf = false) {
  if (record.http?.status === 206) return "The source supplied HTTP206 partial content, not a complete original.";
  const range = Object.entries(record.http?.headers || {}).find(([key]) => key.toLowerCase() === "content-range")?.[1];
  if (range !== undefined) {
    const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(String(range));
    if (!match || Number(match[1]) !== 0 || !Number.isSafeInteger(Number(match[3])) || Number(match[2]) !== Number(match[3]) - 1 || Number(match[3]) !== bytes.length) return "The source supplied an incomplete or invalid Content-Range.";
  }
  const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
  if ((pdf || expectedPdf) && pdf && !/%%EOF[\x00\t\n\f\r ]*$/.test(bytes.subarray(-2048).toString("latin1"))) return "The PDF final %%EOF marker is missing; the retained response may be truncated or damaged.";
  return "";
}

function inspectArchiveSource(input) {
  const bytes = Buffer.from(input.contentBase64, "base64");
  if (bytes.length <= sourceIntakeMaxBytes) return inspectSource(input);
  const metadata = {title: input.filename.replace(/\.pdf$/i, ""), authors: [], documentDate: "", description: "", language: "", tags: [], receivedVia: input.receivedVia,
    extraction: {method: "archive-original", status: "partial", parserVersion: "esia-research-archive/1", observedAt: new Date().toISOString(), sourceSha256: hash(bytes), fieldSources: {title: "filename (unverified)"}, detected: {}, warnings: ["Large original exceeds the workbench's 16 MiB intake limit; retained in the research archive."]}};
  if (bytes.subarray(0, 5).toString() === "%PDF-" && bytes.length > archivePdfInspectionMaxBytes) {
    metadata.extraction.warnings.push("PDF metadata extraction and in-app raster preview are limited to 64 MiB; this larger original is retained for exact download.");
  } else if (bytes.subarray(0, 5).toString() === "%PDF-") {
    try {
      const info = runPdfTool("pdfinfo", ["-"], {input: bytes, encoding: "utf8", timeout: 10000, maxBuffer: 512 * 1024, maxInputBytes: archivePdfInspectionMaxBytes});
      const fields = Object.fromEntries(String(info).split(/\r?\n/).filter(line => line.includes(":")).map(line => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()]));
      if (fields.Title) {metadata.title = text(fields.Title);metadata.extraction.fieldSources.title = "pdfinfo:Title (embedded)";}
      if (fields.Author) metadata.authors = [text(fields.Author, 500)];
      const pageCount = Number(fields.Pages);if (Number.isSafeInteger(pageCount) && pageCount > 0) metadata.extraction.detected.pageCount = pageCount;
      metadata.extraction.detected.createdAt = text(fields.CreationDate);metadata.extraction.detected.modifiedAt = text(fields.ModDate);
    } catch {metadata.extraction.warnings.push("Embedded PDF metadata could not be extracted; original bytes remain retained.");}
  }
  return {...input, size: bytes.length, sha256: hash(bytes), metadata, detected: metadata.extraction.detected};
}

export function normalizeArchiveCandidate(value) {
  if (!value || typeof value !== "object" || !value.url || !value.title) fail("Archive candidates need a title and source URL.");
  return {url: safeUrl(value.url), title: text(value.title, 2000), publisher: text(value.publisher, 500), filename: text(value.filename, 255).replace(/[\/\\]/g, "_"),
    institutionIds: unique((value.institutionIds?.length ? value.institutionIds : [value.institutionId || (value.originalAuthority === "Bujagali Energy Limited" ? "bel" : value.publisher)]).map(institutionId)),
    disclosureUrls: unique([...(value.disclosureUrls || []), value.disclosureUrl].filter(Boolean).map(safeUrl)),
    components: unique([...(value.components || []), value.component].map(value => text(value, 200))),
    financingWindows: unique([...(value.financingWindows || [])].map(value => text(value, 200))),
    documentDate: text(value.documentDate ?? value.date, 100), documentDateBasis: text(value.documentDateBasis || value.dateBasis), captureTarget: text(value.captureTarget, 200),
    originalDocumentUrl: value.originalDocumentUrl || value.originalUrl ? safeUrl(value.originalDocumentUrl || value.originalUrl) : "",
    alternateFor: (value.alternateFor || []).map(safeUrl),
    archiveProvenance: value.archiveProvenance || {custodian: text(value.archiveCustodian, 500), historicalCaptureTime: text(value.archiveCaptureTime, 100), historicalTimestamp: text(value.archiveTimestamp, 100), indexedDigest: value.archiveDigest || null},
    type: text(value.type || value.documentType, 200), expectedMediaType: text(value.expectedMediaType || value.mediaType, 100),
    notes: text(Array.isArray(value.notes) ? value.notes.join("; ") : value.notes, 8000), sourceRecordId: text(value.id || value.sourceRecordId, 500),
    catalogRecords: value.catalogRecords || [{id: text(value.id || value.sourceRecordId, 500), title: text(value.title, 2000), documentDate: text(value.documentDate ?? value.date, 100), disclosureDate: text(value.disclosureDate ?? value.disclosedAt, 100), documentDateBasis: text(value.documentDateBasis || value.dateBasis), type: text(value.type || value.documentType, 200), sourceStatus: text(value.sourceStatus, 200), captureTarget: text(value.captureTarget, 200), notes: text(Array.isArray(value.notes) ? value.notes.join("; ") : value.notes, 8000)}]};
}

export function mergeArchiveCandidates(previous, incoming) {
  if (!previous) return incoming;
  const result = {...previous};
  for (const [key, value] of Object.entries(incoming)) if (typeof value === "string" && value || typeof value === "number") result[key] = value;
  for (const key of ["institutionIds", "disclosureUrls", "components", "financingWindows", "alternateFor"]) result[key] = unique([...(previous[key] || []), ...(incoming[key] || [])]);
  result.institutionIds = result.institutionIds.map(institutionId).filter((value, index, values) => values.indexOf(value) === index);
  result.catalogRecords = [...new Map([...(previous.catalogRecords || []), ...(incoming.catalogRecords || [])].map(record => [JSON.stringify(record), record])).values()];
  result.archiveProvenance = {...previous.archiveProvenance, ...Object.fromEntries(Object.entries(incoming.archiveProvenance || {}).filter(([, value]) => value !== null && value !== ""))};
  return result;
}

/** Local retained public-research collection, independent of private lender stores. */
export function createResearchArchive({directory, collection = "bujagali", captureImpl = captureSource}) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}(?![\s\S])/.test(collection)) fail("Choose a valid research collection identity.");
  directory = privateStorageDirectory(directory);
  mkdirSync(directory, {recursive: true, mode: 0o700});
  const objects = join(directory, "objects");mkdirSync(objects, {recursive: true, mode: 0o700});
  for (const path of [directory, objects]) {const stat = lstatSync(path);if (!stat.isDirectory() || stat.isSymbolicLink()) fail("Archive directories cannot use symlink aliases.");}
  for (const name of ["archive.sqlite", "archive.sqlite-wal", "archive.sqlite-shm", "manifest.json"]) {
    try {const stat = lstatSync(join(directory, name));if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail("Archive storage cannot use linked files.");} catch (error) {if (error.code !== "ENOENT") throw error;}
  }
  const db = new DatabaseSync(join(directory, "archive.sqlite"));
  const schema = db.prepare("PRAGMA user_version").get().user_version;
  if (![0, 1].includes(schema)) {db.close();fail("Unsupported research archive schema.");}
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS resources(url TEXT PRIMARY KEY,json TEXT NOT NULL); PRAGMA user_version=1;");
  const records = () => db.prepare("SELECT json FROM resources ORDER BY rowid").all().map(row => JSON.parse(row.json));
  const usableVersions = resource => resource.versions.filter(version => !(resource.rejectedVersionIds || []).includes(version.id));
  const manifest = () => ({format: "esia-public-research-archive", schemaVersion: 1, collection, generatedAt: new Date().toISOString(), limitations: ["HTTP HTML captures retain response bytes, not complete browser replay.", "A candidate inventory is bounded discovery, not proof that every institutional document has been found.", "Access challenge responses are excluded from retained-original counts.", "Link availability and current outstanding financing are separate from archival retention."], resources: records().map(resource => ({...resource, versions: usableVersions(resource), rejectedVersions: resource.versions.filter(version => (resource.rejectedVersionIds || []).includes(version.id))}))});
  const save = resource => {
    db.prepare("INSERT INTO resources(url,json) VALUES (?,?) ON CONFLICT(url) DO UPDATE SET json=excluded.json").run(resource.url, JSON.stringify(resource));
    const temporary = join(directory, `manifest-${randomUUID()}.tmp`);writeFileSync(temporary, JSON.stringify(manifest(), null, 2) + "\n", {mode: 0o600, flag: "wx"});renameSync(temporary, join(directory, "manifest.json"));
  };
  function original(version) {
    if (!/^[a-f0-9]{64}$/.test(version.sha256)) fail("Archive object identity is invalid.");
    const path = join(objects, version.sha256), stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== version.size) fail("The retained archive object is unavailable or changed.");
    const bytes = readFileSync(path);if (hash(bytes) !== version.sha256) fail("The retained archive object failed its SHA256 verification.");return bytes;
  }
  return {
    manifest,
    async capture(value, {refresh = false} = {}) {
      const candidate = normalizeArchiveCandidate(value), priorRow = db.prepare("SELECT json FROM resources WHERE url=?").get(candidate.url);
      const prior = priorRow ? JSON.parse(priorRow.json) : null;
      const resource = mergeArchiveCandidates(prior || {id: randomUUID(), versions: [], attempts: []}, candidate);
      if (!refresh && usableVersions(resource).length) {
        try {
          const version = usableVersions(resource).at(-1), bytes = original(version);
          const invalidOriginal = originalIssue(bytes, version);
          if (version.mediaType === "text/html" && accessChallenge(bytes) || invalidOriginal) {
            resource.rejectedVersionIds = unique([...(resource.rejectedVersionIds || []), version.id]);
            resource.validationHistory = [...(resource.validationHistory || []), {versionId: version.id, checkedAt: new Date().toISOString(), status: "rejected", reason: invalidOriginal || "Access challenge response is not the requested original."}];
          } else {save(resource);return {status: "retained", resource: clone({...resource, versions: usableVersions(resource)})};}
        } catch {}
      }
      const startedAt = new Date().toISOString();
      try {
        const maximumBytes = researchArchiveCandidateMaxBytes(collection, candidate);
        const timeoutMs = maximumBytes > researchArchiveMaxBytes ? 300000 : 60000;
        const captured = await captureImpl(candidate.url, {maximumBytes, timeoutMs, inspect: inspectArchiveSource}), bytes = Buffer.from(captured.contentBase64, "base64");
        if (!bytes.length || bytes.length > maximumBytes || captured.sha256 !== hash(bytes) || captured.size !== bytes.length) fail("The archive transfer failed its original-byte integrity check.");
        const expectedPdf = candidate.expectedMediaType === "application/pdf" || /\.pdf(?:$|[?#])/i.test(candidate.url);
        if (expectedPdf && bytes.subarray(0, 5).toString() !== "%PDF-") fail("Expected PDF original, but the response was not a PDF (possibly a block/error page).");
        const invalidOriginal = originalIssue(bytes, captured, expectedPdf);if (invalidOriginal) fail(invalidOriginal);
        const expectedZip = candidate.expectedMediaType === "application/zip" || /\.zip(?:$|[?#])/i.test(candidate.url);
        if (expectedZip && !completeZip(bytes)) fail("Expected a complete ZIP original, but its archive signature/framing is missing. No members were extracted.");
        if (expectedZip) {
          captured.metadata ??= {title: candidate.title};captured.metadata.extraction ??= {warnings: []};captured.metadata.extraction.warnings ??= [];
          captured.metadata.extraction.warnings.push("ZIP original retained without extracting, parsing or separately archiving its members. Supplied member titles remain catalogue assertions.");
          captured.metadata.extraction.detected = {...captured.metadata.extraction.detected, format: "ZIP", membersExtracted: false};
        }
        if (captured.mediaType === "text/html" && accessChallenge(bytes)) fail("The source returned an access challenge rather than the requested page.");
        if (captured.mediaType === "text/html" && /^(?:just a moment|access denied|attention required|request rejected|403 forbidden)/i.test(captured.metadata?.title || "")) fail("The source returned an access challenge rather than the requested page.");
        const sha256 = hash(bytes), path = join(objects, sha256);
        try {writeFileSync(path, bytes, {mode: 0o600, flag: "wx"});} catch (error) {if (error.code !== "EEXIST") throw error;original({sha256, size: bytes.length});}
        if (!resource.versions.some(version => version.sha256 === sha256)) resource.versions.push({id: randomUUID(), sha256, size: bytes.length, filename: candidate.filename || captured.filename,
          mediaType: captured.mediaType, capturedAt: captured.source.capturedAt, source: clone(captured.source), http: clone(captured.http || {}), metadata: clone(captured.metadata)});
        resource.attempts.push({startedAt, completedAt: new Date().toISOString(), status: "captured", sha256});resource.status = "captured";save(resource);
        return {status: "captured", resource: clone({...resource, versions: usableVersions(resource)})};
      } catch (error) {
        resource.attempts.push({startedAt, completedAt: new Date().toISOString(), status: "failed", message: text(error.message, 2000)});resource.status = "failed";save(resource);
        return {status: "failed", resource: clone({...resource, versions: usableVersions(resource)})};
      }
    },
    readVersion(id) {
      for (const resource of records()) {const version = usableVersions(resource).find(version => version.id === id);if (version) {const bytes = original(version), issue = originalIssue(bytes, version);if (issue) fail(issue);return {resource, version, bytes};}}
      throw Object.assign(new Error("The retained archive version was not found."), {status: 404});
    },
    auditOriginals() {
      const rejected = [];let checked = 0;
      for (const resource of records()) {
        let changed = false;
        for (const versionId of resource.rejectedVersionIds || []) {
          const prior = resource.validationHistory?.findLast(item => item.versionId === versionId && item.status === "rejected");
          if (prior && !resource.attempts.some(item => item.status === "rejected" && item.versionId === versionId)) {
            resource.attempts.push({startedAt: prior.checkedAt, completedAt: prior.checkedAt, status: "rejected", versionId, message: prior.reason});changed = true;
          }
        }
        for (const version of usableVersions(resource)) {
          checked++;let reason;
          try {const bytes = original(version);reason = originalIssue(bytes, version) || (version.mediaType === "text/html" && accessChallenge(bytes) ? "Access challenge response is not the requested original." : "");}
          catch (error) {reason = text(error.message, 2000);}
          if (!reason) continue;
          resource.rejectedVersionIds = unique([...(resource.rejectedVersionIds || []), version.id]);
          resource.validationHistory = [...(resource.validationHistory || []), {versionId: version.id, checkedAt: new Date().toISOString(), status: "rejected", reason}];
          const checkedAt = resource.validationHistory.at(-1).checkedAt;
          resource.attempts.push({startedAt: checkedAt, completedAt: checkedAt, status: "rejected", versionId: version.id, message: reason});
          rejected.push({resourceId: resource.id, versionId: version.id, title: resource.title, url: resource.url, sha256: version.sha256, size: version.size, reason});changed = true;
        }
        if (changed) {if (!usableVersions(resource).length) resource.status = "rejected";save(resource);}
      }
      return {collection, checked, rejected, note: "Rejected payload bytes and transfer metadata are retained for diagnosis, but excluded from usable-original counts and reads."};
    },
    close() {db.close();}
  };
}
