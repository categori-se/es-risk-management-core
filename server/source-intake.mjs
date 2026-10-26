import {lookup} from "node:dns/promises";
import {isIP} from "node:net";
import http from "node:http";
import https from "node:https";
import {createHash} from "node:crypto";
import {JSDOM, VirtualConsole} from "jsdom";
import {runPdfTool} from "./pdf-tools.mjs";

export const sourceIntakeMaxBytes = 16 * 1024 * 1024;
export const sourceIntakeHtmlParseBytes = 256 * 1024;
const MAX_URL = 16_000;
const internalError = Symbol("sourceIntakeError");
const fail = (message, status = 400) => Object.assign(new Error(message), {status, [internalError]: true});
const short = (value, maximum = 2000) => String(value || "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
const credentialParameter = /^(?:access[_-]?token|id[_-]?token|refresh[_-]?token|oauth[_-]?token|security[_-]?token|token|auth|authorization|authorization[_-]?code|code|bearer|jwt|api[_-]?key|auth[_-]?key|key|password|passwd|secret|client[_-]?secret|session(?:id|[_-]id|[_-]token)?|sid|signature|sig|credential|credentials|x-amz-.+|x-goog-.+|awsaccesskeyid|googleaccessid|key-pair-id|policy|rlkey|resourcekey)$/i;
const signedCompanion = /^(?:expires|expiry|expiration|state|nonce|se|sp|sr|sv|st|skoid|sktid|skt|ske|sks|skv|ss|srt)$/i;
const parameterName = key => key.replace(/\[\d*\]$/, "").replace(/[.\s]/g, "-");

function parseUrl(value) {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_URL || /[\x00-\x20\x7f]/.test(value)) throw fail("Enter a complete http:// or https:// URL without spaces or control characters.");
  let url;
  try {url = new URL(value);} catch {throw fail("Enter a complete http:// or https:// URL.");}
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) throw fail("Enter a complete http:// or https:// URL.");
  return url;
}

// Sanitize saved provenance, never the retrieval URL. Known signing/authentication
// fields are removed together; unrelated query identifiers remain useful citations.
export function cleanSourceUrl(value) {
  const url = parseUrl(value);
  let removed = 0;
  if (url.username || url.password) {url.username = ""; url.password = ""; removed++;}
  const signed = [...url.searchParams.keys()].some(key => credentialParameter.test(parameterName(key)));
  for (const key of [...new Set(url.searchParams.keys())]) {
    if (credentialParameter.test(parameterName(key)) || signed && signedCompanion.test(key)) {url.searchParams.delete(key); removed++;}
  }
  // OAuth and application fragments can contain credentials outside conventional
  // query names. Keep simple document anchors; discard parameterized fragments.
  if (url.hash && (!/^#[A-Za-z][A-Za-z0-9_.:-]{0,199}$/.test(url.hash) || /token|password|secret|signature|credential/i.test(url.hash))) {url.hash = ""; removed++;}
  if (url.href.length > 4000) throw fail("The saved source reference is too long. Supply a stable public source URL instead.");
  return {url: url.href, removed};
}

function ipv6Words(address) {
  const halves = address.toLowerCase().split("::");
  const words = side => side ? side.split(":").flatMap(part => part.includes(".") ? (() => {
    const bytes = part.split(".").map(Number); return [(bytes[0] << 8 | bytes[1]).toString(16), (bytes[2] << 8 | bytes[3]).toString(16)];
  })() : [part]) : [];
  const left = words(halves[0]), right = words(halves[1]);
  return [...left, ...Array(halves.length === 2 ? 8 - left.length - right.length : 0).fill("0"), ...right].map(word => parseInt(word, 16));
}

export function isPublicAddress(address) {
  if (typeof address !== "string" || address.includes("%")) return false;
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 100 && b >= 64 && b <= 127 ||
      a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && (b === 168 || b === 0 && (c === 0 || c === 2) || b === 88 && c === 99) ||
      a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) || a === 203 && b === 0 && c === 113);
  }
  if (family === 6) {
    const [first, second] = ipv6Words(address);
    // Only ordinary global unicast; exclude protocol, documentation and tunnel
    // blocks. IPv4-mapped, local, link-local, multicast and NAT64 are rejected.
    return (first & 0xe000) === 0x2000 && !(first === 0x2001 && (second < 0x200 || second === 0xdb8) ||
      first === 0x2002 || first === 0x3ffe || first === 0x3fff);
  }
  return false;
}

async function checkedTarget(value, lookupImpl) {
  const url = parseUrl(value);
  if (url.username || url.password || url.port && !["80", "443"].includes(url.port)) throw fail("Capture accepts public HTTP(S) URLs without embedded credentials or nonstandard ports.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.+$/, "").toLowerCase();
  if (hostname === "localhost" || /\.(?:localhost|local|internal|lan|home)$/.test(hostname)) throw fail("Use file upload for local or private-network sources.");
  let addresses;
  try {addresses = isIP(hostname) ? [{address: hostname, family: isIP(hostname)}] : await lookupImpl(hostname, {all: true, verbatim: true});}
  catch {throw fail("The source hostname could not be resolved.", 422);}
  if (!Array.isArray(addresses) || !addresses.length || addresses.length > 64 || addresses.some(item => !item ||
      !isPublicAddress(item.address) || Number(item.family) !== isIP(item.address))) throw fail("Capture cannot access local, private, reserved or invalid network addresses.");
  addresses = Object.freeze(addresses.map(({address, family}) => Object.freeze({address, family: Number(family)})));
  return {url, addresses};
}

const header = (headers, name) => typeof headers?.get === "function" ? headers.get(name) : Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name)?.[1];

function requestOriginal(url, addresses, {signal, maximumBytes = sourceIntakeMaxBytes} = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, result) => {if (settled) return; settled = true; error ? reject(error) : resolve(result);};
    const request = (url.protocol === "https:" ? https : http).request(url, {
      method: "GET", agent: false, signal, maxHeaderSize: 32 * 1024,
      headers: {"User-Agent": "Mozilla/5.0 (compatible; ESIA local source capture)", "Accept-Encoding": "identity", Accept: "application/pdf,text/html;q=0.9,*/*;q=0.5"},
      // Connections use exactly the already verified addresses; TLS still checks
      // the original hostname. No second DNS query or reusable pooled socket.
      lookup: (_hostname, options, callback) => options?.all ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family)
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400) {response.destroy(); finish(null, {status: response.statusCode, headers: response.headers, bytes: Buffer.alloc(0)}); return;}
      const encoding = header(response.headers, "content-encoding");
      if (encoding && String(encoding).toLowerCase() !== "identity") {response.destroy(); finish(fail("The server returned a compressed response. Download it in your browser and upload the original instead.", 422)); return;}
      const declaredLength = header(response.headers, "content-length");
      if (declaredLength !== undefined && /^\d+$/.test(String(declaredLength)) && Number(declaredLength) > maximumBytes) {
        response.destroy(); finish(fail(`Sources are limited to ${maximumBytes / 1024 / 1024} MiB.`, 413)); return;
      }
      let length = 0; const chunks = [];
      response.on("data", chunk => {
        length += chunk.length;
        if (length > maximumBytes) {response.destroy(); finish(fail(`Sources are limited to ${maximumBytes / 1024 / 1024} MiB.`, 413));}
        else if (!settled) chunks.push(chunk);
      });
      response.on("end", () => finish(null, {status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks)}));
      const interrupted = () => finish(fail("The source transfer was interrupted. Nothing has been saved.", 422));
      response.on("aborted", interrupted); response.on("error", interrupted);
    });
    request.setTimeout(15_000, () => request.destroy());
    request.on("error", () => finish(fail("The source could not be captured. It may require a browser session; download and upload it instead.", 422)));
    request.end();
  });
}

function documentDate(value, warnings, detected) {
  if (!value) return "";
  const candidate = short(value, 200);
  const day = candidate.slice(0, 10);
  if (candidate.length <= 64 && /^\d{4}-\d\d-\d\d(?:$|T\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$)/.test(candidate) &&
      Number.isFinite(Date.parse(candidate)) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day) return candidate;
  detected.documentDate = candidate;
  warnings.push("The page's publication-date field needs review; no validated document date was set.");
  return "";
}

export function inspectSource(input, {pdfInfo = runPdfTool, now = () => new Date().toISOString()} = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw fail("Supply a source filename and original bytes.");
  let {filename, contentBase64, mediaType = "application/octet-stream", receivedVia = "file_upload"} = input;
  if (typeof filename !== "string" || !filename || filename.length > 255 || filename === "." || filename === ".." || /[\/\\\x00-\x1f\x7f]/.test(filename)) throw fail("Supply a logical filename without directory components.");
  if (typeof contentBase64 !== "string") throw fail("Supply source bytes as canonical base64.");
  if (contentBase64.length > Math.ceil(sourceIntakeMaxBytes / 3) * 4) throw fail("Upload a source of up to 16 MiB.", 413);
  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.length > sourceIntakeMaxBytes) throw fail("Sources are limited to 16 MiB.", 413);
  if (bytes.toString("base64") !== contentBase64) throw fail("The source bytes are not valid canonical base64.");
  if (!new Set(["file_upload", "email_attachment", "web_capture", "pdf_url"]).has(receivedVia)) throw fail("Choose a supported source intake origin.");
  if (typeof mediaType !== "string" || mediaType.length > 256 || /[\x00-\x1f\x7f]/.test(mediaType)) throw fail("Supply a valid source media type.");
  mediaType = mediaType.split(";")[0].trim().toLowerCase();
  if (!/^[!#$%&'*+.^_`|~0-9a-z-]+\/[!#$%&'*+.^_`|~0-9a-z-]+$/.test(mediaType)) throw fail("Supply a valid source media type.");
  const warnings = [], metadata = {title: short(filename.replace(/\.[^.]+$/, "") || filename), authors: [], documentDate: "", description: "", language: "", tags: [], receivedVia};
  let preview = "", method = "filename", status = "partial", detected = {};
  const sha256 = createHash("sha256").update(bytes).digest("hex"), fieldSources = {title: "filename (unverified fallback)"};
  const prefix = bytes.subarray(0, 512).toString("utf8").replace(/^\uFEFF/, "").trimStart();
  if (bytes.subarray(0, 5).toString() === "%PDF-") {
    mediaType = "application/pdf"; method = "pdfinfo";
    try {
      const info = String(pdfInfo("pdfinfo", ["-"], {input: bytes, encoding: "utf8", timeout: 8000, maxBuffer: 256 * 1024, windowsHide: true, stdio: ["pipe", "pipe", "pipe"]}));
      const fields = {};
      for (const line of info.split(/\r?\n/)) {const index = line.indexOf(":"); if (index > 0) fields[line.slice(0, index).trim()] = line.slice(index + 1).trim();}
      if (fields.Title) {metadata.title = short(fields.Title);fieldSources.title = "pdfinfo:Title (embedded)";}
      if (fields.Author) {metadata.authors = [short(fields.Author, 500)];fieldSources.authors = "pdfinfo:Author (embedded)";}
      if (fields.Subject) {metadata.description = short(fields.Subject);fieldSources.description = "pdfinfo:Subject (embedded)";}
      const pageCount = Number(fields.Pages);
      detected = {...(Number.isSafeInteger(pageCount) && pageCount > 0 ? {pageCount} : {}), createdAt: short(fields.CreationDate), modifiedAt: short(fields.ModDate), ...(fields.Producer ? {producer: short(fields.Producer)} : {})};
      warnings.push("PDF creation/modification dates are not a verified publication date."); status = "extracted";
    } catch {warnings.push("PDF metadata could not be extracted on this device. Original bytes are retained; confirm the filename-derived title and enter missing fields."); status = "unavailable";}
    preview = "Original PDF bytes are preserved. Download the original to inspect it in your document viewer; this preview does not execute PDF content.";
  } else if (mediaType === "text/html" || /^<!doctype\s+html|^<html[\s>]/i.test(prefix) || /\.html?$/i.test(filename)) {
    mediaType = "text/html"; method = "html-head";
    const input = bytes.subarray(0, sourceIntakeHtmlParseBytes);
    detected.parsedBytes = input.length;
    if (input.length < bytes.length) warnings.push("HTML metadata and text parsing was limited to the first 256 KiB. Preview and extracted fields may be incomplete; the full original bytes are retained.");
    let dom;
    try {
      // No runScripts/resources options: jsdom's defaults execute no scripts and
      // fetch no subresources. A private virtual console never logs client text.
      const decoded = input.toString("utf8");
      if (decoded.includes("\uFFFD")) warnings.push("HTML text contains UTF-8 replacement characters. Review the extracted fields against the original; its character encoding may differ.");
      dom = new JSDOM(decoded, {url: "about:blank", virtualConsole: new VirtualConsole()});
      const document = dom.window.document;
      const meta = selector => short(document.querySelector(selector)?.getAttribute("content"));
      const pick = (field, selectors) => {
        for (const selector of selectors) {const value = meta(selector); if (value) {metadata[field] = value; fieldSources[field] = `HTML ${selector} (embedded)`; return value;}}
        return "";
      };
      if (!pick("title", ['meta[name="citation_title"]', 'meta[property="og:title"]', 'meta[name="DC.title"]']) && short(document.title)) {metadata.title = short(document.title);fieldSources.title = "HTML title (embedded)";}
      metadata.authors = [...new Set([...document.querySelectorAll('meta[name="author"],meta[name="DC.creator"],meta[property="article:author"],meta[name="citation_author"]')]
        .map(node => short(node.getAttribute("content"), 500)).filter(Boolean))].slice(0, 20);
      if (metadata.authors.length) fieldSources.authors = "HTML author / DC.creator / article:author / citation_author (embedded)";
      const proposedDate = pick("documentDate", ['meta[name="citation_publication_date"]', 'meta[property="article:published_time"]', 'meta[name="DC.date"]']);
      metadata.documentDate = documentDate(proposedDate, warnings, detected);
      pick("description", ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="DC.description"]']);
      pick("publisher", ['meta[name="citation_publisher"]', 'meta[name="DC.publisher"]', 'meta[name="dcterms.publisher"]']);
      pick("identifier", ['meta[name="citation_doi"]', 'meta[name="DC.identifier"]', 'meta[name="citation_isbn"]']);
      pick("rights", ['meta[name="DC.rights"]', 'meta[name="dcterms.rights"]']);
      pick("license", ['meta[name="dcterms.license"]']);
      const canonical = document.querySelector('link[rel~="canonical"]')?.getAttribute("href");
      if (canonical) {
        try {const clean = cleanSourceUrl(canonical); detected.canonicalUrl = clean.url;metadata.sourceUrl = clean.url;fieldSources.sourceUrl = "HTML link[rel=canonical] (embedded, not fetched)";if (clean.removed) warnings.push("Credentials were removed from the declared canonical reference.");}
        catch {warnings.push("The declared canonical URL is not an absolute, safe HTTP(S) reference; review it in the original.");}
      }
      const siteName = meta('meta[property="og:site_name"]');if (siteName) detected.siteName = siteName;
      metadata.language = short(document.documentElement.lang, 100);
      if (metadata.language) fieldSources.language = "HTML html[lang] (embedded)";
      document.querySelectorAll("script,style,noscript,iframe,object,embed,template,svg").forEach(node => node.remove());
      preview = short(document.body?.textContent, 6000); status = input.length < bytes.length ? "partial" : "extracted";
    } catch {status = "unavailable"; warnings.push("HTML metadata parsing failed. Original bytes are retained; enter descriptive fields manually.");}
    finally {dom?.window.close();}
    warnings.push("This is the HTML response, not a full browser replay. External images, styles, scripts and authenticated state are not captured.");
  } else if (/^(?:text\/|application\/(?:json|geo\+json)$)/.test(mediaType)) {
    method = "text-file"; preview = bytes.subarray(0, 24_000).toString("utf8").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ").slice(0, 6000);
    warnings.push("Bibliographic fields are not verified from file contents.");
  } else warnings.push("This file type is retained as original bytes. Enter and confirm its descriptive metadata.");
  metadata.extraction = {method, status, warnings, parserVersion: "esia-source-inspection/2", observedAt: now(), sourceSha256: sha256, detected: structuredClone(detected), fieldSources};
  // Preview is inert text, never a document/HTML renderer. Clients must use
  // textContent or a text form control; original bytes remain a separate download.
  return {filename, mediaType, size: bytes.length, sha256, contentBase64, metadata, detected, preview, previewMediaType: "text/plain"};
}

export async function captureSource(value, {lookupImpl = lookup, transport = requestOriginal, now = () => new Date().toISOString(), inspect = inspectSource, timeoutMs = 30_000, maximumBytes = sourceIntakeMaxBytes} = {}) {
  // Validate first: malformed user input must be a 400, not a URL TypeError/500.
  const original = cleanSourceUrl(value);
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 512 * 1024 * 1024 || maximumBytes > sourceIntakeMaxBytes && inspect === inspectSource) throw fail("Choose a bounded original-byte limit and a suitable metadata inspector.");
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > (inspect === inspectSource ? 60_000 : 300_000)) throw fail("Choose a bounded capture timeout.");
  const controller = new AbortController();
  let timeout;
  const expired = new Promise((_, reject) => {timeout = setTimeout(() => {controller.abort(); reject(fail("The source capture timed out. Download and upload the original instead.", 422));}, timeoutMs);});
  const bounded = promise => Promise.race([promise, expired]);
  let current = value;
  const seen = new Set();
  try {
    for (let redirects = 0; redirects <= 4; redirects++) {
      const {url, addresses} = await bounded(checkedTarget(current, lookupImpl));
      const target = new URL(url); target.hash = "";
      if (seen.has(target.href)) throw fail("The source supplied a redirect loop. Nothing has been saved.", 422);
      seen.add(target.href);
      let result;
      try {result = await bounded(Promise.resolve().then(() => transport(url, addresses, {signal: controller.signal, maximumBytes})));}
      catch (error) {throw error?.[internalError] ? error : fail("The source could not be transferred. Download and upload the original instead.", 422);}
      if (!result || !Number.isInteger(result.status) || result.status < 100 || result.status > 599) throw fail("The source supplied an invalid HTTP response.", 422);
      if (result.status >= 300 && result.status < 400) {
        const destination = header(result.headers, "location");
        if (typeof destination !== "string" || !destination || redirects === 4) throw fail("The source redirected too many times or supplied no destination.", 422);
        try {current = new URL(destination, url).href;} catch {throw fail("The source supplied an invalid redirect destination.", 422);}
        continue;
      }
      if (result.status < 200 || result.status >= 300) throw fail(`The source returned HTTP ${result.status}. Nothing has been saved.`, 422);
      if (result.status === 206) throw fail("The source returned partial content, not a complete original. Nothing has been saved.", 422);
      const encoding = header(result.headers, "content-encoding");
      if (encoding && String(encoding).toLowerCase() !== "identity") throw fail("The source returned a compressed response. Download and upload the original instead.", 422);
      if (!(result.bytes instanceof Uint8Array)) throw fail("The source did not return complete original bytes.", 422);
      const bytes = Buffer.from(result.bytes);
      const range = header(result.headers, "content-range");
      if (range !== undefined && range !== null) {
        const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(String(range));
        if (!match || Number(match[1]) !== 0 || !Number.isSafeInteger(Number(match[3])) || Number(match[2]) !== Number(match[3]) - 1 || Number(match[3]) !== bytes.length) throw fail("The source returned an incomplete or invalid Content-Range. Nothing has been saved.", 422);
      }
      const length = header(result.headers, "content-length");
      if (bytes.length > maximumBytes || Number(length) > maximumBytes) throw fail(`Sources are limited to ${maximumBytes / 1024 / 1024} MiB.`, 413);
      if (length !== undefined && length !== null && (!/^\d+$/.test(String(length)) || Number(length) !== bytes.length)) throw fail("The source response length does not match its complete bytes. Nothing has been saved.", 422);
      let filename;
      try {filename = decodeURIComponent(url.pathname.split("/").pop() || "web-capture.html");} catch {filename = "web-capture.html";}
      filename = filename.replace(/[\/\\\x00-\x1f\x7f]/g, "_").slice(0, 240) || "web-capture.html";
      if (filename === "." || filename === "..") filename = "web-capture.html";
      const type = String(header(result.headers, "content-type") || "application/octet-stream").split(";")[0].trim();
      const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
      if (pdf && !/\.pdf$/i.test(filename)) filename += ".pdf";
      const staged = inspect({filename, contentBase64: bytes.toString("base64"), mediaType: type, receivedVia: pdf ? "pdf_url" : "web_capture"});
      const final = cleanSourceUrl(url.href);
      staged.source = {originalUrl: original.url, finalUrl: final.url, capturedAt: now(), method: staged.mediaType === "text/html" ? "http-html-original" : "http-original", result: staged.mediaType === "text/html" ? "partial: external assets and browser-rendered state excluded" : "original response captured", title: staged.metadata.title};
      staged.metadata.lastAccessedAt = staged.source.capturedAt;
      staged.http = {status: result.status, redirects: [...seen].map(value => cleanSourceUrl(value).url), headers: Object.fromEntries(["content-type", "content-length", "content-range", "content-disposition", "last-modified", "etag"].flatMap(name => {
        const value = header(result.headers, name);return value === undefined || value === null ? [] : [[name, short(value, 2000)]];
      }))};
      if (original.removed || final.removed) staged.metadata.extraction.warnings.push("Temporary access parameters were used only for retrieval and removed from the saved source reference.");
      return staged;
    }
    throw fail("Capture could not complete.", 422);
  } finally {clearTimeout(timeout); controller.abort();}
}
