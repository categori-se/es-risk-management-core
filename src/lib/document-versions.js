import {assertDocumentVersionLink, documentVersionKey, verifyDocumentVersionBytes, documentVersionChunkBytes} from "@categori/workspace-contracts/documents";
import {appUrls} from "./platform-config.js";

export const documentVersionsExtension = "docs-manager:document_versions";
export const docsManagerOrigin = appUrls.docsManagerEvidenceOrigin;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value, fields) => object(value) && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const safeId = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
const stable = value => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(stable).join(",")}]` : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const documentAddressKey = address => JSON.stringify([address.workspaceId, address.type, address.id, address.path]);

function trustedOrigin(origin) {
  const url = new URL(origin);
  if (url.origin !== origin || url.username || url.password || !(url.protocol === "https:" || url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw Error("Use the exact configured Docs Manager origin.");
  return origin;
}

// The app-owned address routes only to the configured application. It supplies
// no provider location, credential, membership or permission.
export function assertDocsDocumentDescriptor(input, {origin = appUrls.docsManagerEvidenceOrigin} = {}) {
  trustedOrigin(origin);
  if (!exact(input, ["schema_version", "source_application", "version", "address"]) || input.schema_version !== 1 || input.source_application !== "docs-manager" ||
      !exact(input.address, ["workspaceId", "type", "id", "path"])) throw Error("Use a complete Docs Manager document version reference.");
  const version = assertDocumentVersionLink(input.version), address = input.address;
  if (!safeId(address.workspaceId) || !safeId(address.id) || !["project", "repository"].includes(address.type) ||
      typeof address.path !== "string" || !address.path || new TextEncoder().encode(address.path).byteLength > 1024 || address.path.startsWith("/") || address.path.includes("\\") ||
      /[\x00-\x1f\x7f]/.test(address.path) || address.path.split("/").some(part => !part || part === "." || part === "..") ||
      version.reference.authority !== `${origin}/api` || version.reference.workspace_id !== address.workspaceId || version.reference.resource_type !== "document" ||
      !/^file_[a-f0-9]{64}$/.test(version.reference.resource_id)) throw Error("The document version must retain its exact Docs Manager address and authority.");
  return {schema_version: 1, source_application: "docs-manager", version, address: {...address}};
}

export async function assertDocumentAddress(descriptor, {cryptoImpl = globalThis.crypto} = {}) {
  const hash = await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(documentAddressKey(descriptor.address)));
  const resourceId = "file_" + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  if (descriptor.version.reference.resource_id !== resourceId) throw Error("The document address does not match its original resource identity.");
  return descriptor;
}

export function documentVersions(audit, options) {
  if (audit?.extensions !== undefined && !object(audit.extensions)) throw Error("Document version extensions must preserve an object of original metadata.");
  const inputs = Object.hasOwn(audit?.extensions ?? {}, documentVersionsExtension) ? audit.extensions[documentVersionsExtension] : [];
  if (!Array.isArray(inputs) || inputs.length > 24) throw Error("A review can link at most 24 explicit document versions.");
  const versions = [], seen = new Set();
  for (const input of inputs) {
    const descriptor = assertDocsDocumentDescriptor(input, options), key = documentVersionKey(descriptor.version);
    if (seen.has(key)) throw Error("One original document version cannot select duplicate or conflicting manifests.");
    seen.add(key); versions.push(descriptor);
  }
  return versions;
}

export function attachDocumentVersion(audit, input, options) {
  const descriptor = assertDocsDocumentDescriptor(input, options), versions = documentVersions(audit, options), key = documentVersionKey(descriptor.version);
  const prior = versions.find(value => documentVersionKey(value.version) === key);
  if (prior) {
    if (stable(prior) !== stable(descriptor)) throw Error("The original linked document version cannot be rewritten.");
    return structuredClone(audit);
  }
  const next = {...structuredClone(audit), extensions: {...structuredClone(audit?.extensions ?? {}), [documentVersionsExtension]: [...versions, descriptor]}};
  documentVersions(next, options); return next;
}

function decodeChunk(base64) {
  if (typeof base64 !== "string" || base64.length > Math.ceil(documentVersionChunkBytes / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw Error("The document chunk encoding is invalid.");
  const raw = atob(base64), bytes = Uint8Array.from(raw, value => value.charCodeAt(0));
  if (btoa(raw) !== base64) throw Error("The document chunk encoding is not canonical.");
  return bytes;
}

// Open runs synchronously from the user's gesture. Both applications authorize
// their own original sessions independently; no token or provider URL crosses.
export function createDocsDocumentClient({windowImpl = globalThis.window, origin = appUrls.docsManagerEvidenceOrigin,
  now = Date.now, cryptoImpl = globalThis.crypto, lifetimeMs = 300000, pollMs = 250} = {}) {
  trustedOrigin(origin);
  if (!Number.isSafeInteger(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 300000 || !Number.isSafeInteger(pollMs) || pollMs < 1 || pollMs > 1000) throw Error("Use a finite document verification window of at most five minutes.");
  function open(input, {signal, assertCurrent = () => {}, recheck = async () => {}} = {}) {
    const descriptor = assertDocsDocumentDescriptor(input, {origin});
    signal?.throwIfAborted(); assertCurrent();
    const requestId = cryptoImpl.randomUUID(); if (!uuid.test(requestId)) throw Error("An exact evidence request UUID is required.");
    const receiver = trustedOrigin(windowImpl.location.origin), startedAt = now(), deadline = startedAt + lifetimeMs;
    const popup = windowImpl.open(`${origin}/#document-evidence=${requestId}&receiver=${encodeURIComponent(receiver)}`, "_blank", "popup=yes,width=900,height=720");
    if (!popup) throw Error("Allow the Docs Manager window, then verify this version again.");
    let resolve, reject, settled = false, ready = false, authorized = false, requested = false, received = 0, finishing = false;
    let bytes = new Uint8Array(descriptor.version.size_bytes);
    const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
    const send = value => popup.postMessage({request_id: requestId, ...value}, origin);
    function active() {
      signal?.throwIfAborted(); assertCurrent();
      if (!Number.isFinite(now()) || now() >= deadline || now() < startedAt) throw Error("The document verification expired. Start it again.");
      if (popup.closed) throw Error("The Docs Manager window closed. Verify the version again.");
    }
    function cleanup() {
      windowImpl.removeEventListener("message", message); signal?.removeEventListener("abort", abort);
      clearInterval(timer); clearTimeout(expiry);
    }
    function fail(error) {
      if (settled) return; settled = true;
      try {send({type: "docs-document-cancel"});} catch {}
      cleanup(); bytes?.fill(0); bytes = null; reject(error);
    }
    function request() {
      if (!ready || !authorized || finishing || settled) return;
      active(); requested = true; send({type: "docs-document-request", descriptor});
    }
    function abort() {fail(signal?.reason instanceof Error ? signal.reason : Error("Document verification cancelled."));}
    async function complete() {
      finishing = true;
      let verified;
      try {
        active(); if (received !== descriptor.version.size_bytes) throw Error("The complete original document bytes were not received.");
        verified = await verifyDocumentVersionBytes(descriptor.version, bytes, {cryptoImpl}); active();
        await recheck(); active();
        if (settled) {verified.fill(0); return;}
        settled = true; cleanup(); bytes.fill(0); bytes = null;
        resolve({descriptor: structuredClone(descriptor), bytes: verified}); verified = null;
      } catch (error) {verified?.fill(0); fail(error);}
    }
    function message(event) {
      if (event.source !== popup || event.origin !== origin || event.data?.request_id !== requestId || settled) return;
      try {
        active(); const data = event.data;
        if (data.type === "docs-document-ready") {
          if (!exact(data, ["type", "request_id"])) throw Error("The document connection message is invalid.");
          if (!received && !finishing) {ready = true; request();} return;
        }
        if (data.type === "docs-document-error") {
          if (!exact(data, ["type", "request_id", "message"])) throw Error("The document connection message is invalid.");
          throw Error("Docs Manager could not send this original version. Sign in there and verify it again.");
        }
        if (!["docs-document-chunk", "docs-document-complete"].includes(data.type)) return;
        if (!requested || finishing || stable(assertDocsDocumentDescriptor(data.descriptor, {origin})) !== stable(descriptor)) throw Error("The evidence request or selected document version changed.");
        if (data.type === "docs-document-complete") {
          if (!exact(data, ["type", "request_id", "descriptor"])) throw Error("The document completion message is invalid.");
          void complete(); return;
        }
        if (!exact(data, ["type", "request_id", "descriptor", "offset", "total_bytes", "base64", "next_offset"])) throw Error("The document chunk message is invalid.");
        const chunk = decodeChunk(data.base64), next = received + chunk.byteLength;
        if (data.offset !== received || data.total_bytes !== descriptor.version.size_bytes || !chunk.byteLength || next > bytes.length ||
            chunk.byteLength !== Math.min(documentVersionChunkBytes, bytes.length - received) || data.next_offset !== (next === bytes.length ? null : next)) throw Error("The document chunks do not match their original sequence and size.");
        bytes.set(chunk, received); received = next; active(); send({type: "docs-document-ack", offset: next});
      } catch (error) {fail(error);}
    }
    windowImpl.addEventListener("message", message); signal?.addEventListener("abort", abort, {once: true});
    const timer = setInterval(() => {try {active();} catch (error) {fail(error);}}, pollMs);
    const expiry = setTimeout(() => fail(Error("The document verification expired. Start it again.")), lifetimeMs);
    void (async () => {
      try {await assertDocumentAddress(descriptor, {cryptoImpl}); active(); await recheck(); active(); authorized = true; request();}
      catch (error) {fail(error);}
    })();
    return {promise, popup, requestId, cancel: () => fail(Error("Document verification cancelled."))};
  }
  return {open};
}
