import {createFieldDraftStore, bytesToBase64, sha256Bytes} from "../lib/field-drafts.js";
import {createFieldDisclosure} from "../lib/field-disclosure.js";
import {additionalFieldLinks, normalizeAdditionalFieldLinks, normalizeFieldDetails, normalizeFieldGeometry, fieldPointGeometry, reviseFieldGeometry} from "../lib/field-record-details.js";
import {validateFieldDeviceLease, createFieldDevicePolicyTimer} from "../lib/field-device-policy.js";

const MAX_FILES = 3, MAX_BYTES = 10 * 1024 * 1024;
const kinds = ["observation", "photo", "note", "interview", "measurement", "incident", "document"];
const consentNames = {interview: "Interview", photograph: "Photograph", audio: "Audio recording", retention: "Retain this information", sharing: "Share", disclosure: "Disclose"};
const consentValues = ["not_recorded", "granted", "declined", "not_applicable"];
const contextKeys = ["requirementId", "siteId", "grievanceId", "commitmentId", "activityId", "engagementId", "programId", "cycleId", "missionId"];
const h = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const label = value => String(value).replaceAll("_", " ").replace(/^./, c => c.toUpperCase());
const option = (value, actual, text = label(value)) => `<option value="${h(value)}"${value === actual ? " selected" : ""}>${h(text)}</option>`;
const clone = value => structuredClone(value);
function preparedLinkOptions(value) {
  if(value===undefined||value===null)return {};
  if(typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(additionalFieldLinks,key)))throw Error("Prepared field links contain unsupported record kinds.");
  const result={};
  for(const[name,items]of Object.entries(value)){
    if(!Array.isArray(items))throw Error("Prepared field links require an array of labeled choices.");
    const ids=new Set();result[name]=items.slice(0,100).map(item=>{
      if(!item||typeof item!=="object"||Array.isArray(item)||Object.keys(item).some(key=>!["id","label"].includes(key))||typeof item.id!=="string"||!/^[A-Za-z0-9_.:-]{1,192}$/.test(item.id)||ids.has(item.id)||typeof item.label!=="string")throw Error("Prepared field links require distinct bounded identifiers and labels.");
      ids.add(item.id);return {id:item.id,label:item.label.slice(0,500)};
    });
  }
  return result;
}
const timestamp = () => new Date().toISOString();
const base64Size = value => Math.floor(value.length * 3 / 4) - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
function geometryPreview(geometry) {
  if (!geometry) return "<p>No current geometry attached.</p>";
  const points = geometry.type === "Point" ? [geometry.coordinates] : geometry.type === "LineString" ? geometry.coordinates : geometry.coordinates.flat();
  const xs = points.map(point => point[0]), ys = points.map(point => point[1]), minX = Math.min(...xs), minY = Math.min(...ys), dx = Math.max(...xs) - minX || 0.01, dy = Math.max(...ys) - minY || 0.01;
  const screen = point => `${5 + (point[0] - minX) / dx * 90},${95 - (point[1] - minY) / dy * 90}`;
  const shape = geometry.type === "Point" ? `<circle cx="50" cy="50" r="3" fill="currentColor"/>` : geometry.type === "LineString" ? `<polyline points="${geometry.coordinates.map(screen).join(" ")}" fill="none" stroke="currentColor" stroke-width="1"/>` : geometry.coordinates.map(ring => `<polygon points="${ring.map(screen).join(" ")}" fill="none" stroke="currentColor" stroke-width="1"/>`).join("");
  return `<figure><svg class="fc-offline-map" viewBox="0 0 100 100" role="img" aria-label="Current ${h(geometry.type)} geometry preview">${shape}</svg><figcaption>Current WGS84 geometry · relative preview without a basemap</figcaption></figure><details><summary>Coordinate list (${points.length})</summary><ol>${points.map(point => `<li>Longitude ${h(point[0])}; latitude ${h(point[1])}</li>`).join("")}</ol></details>`;
}
let sequence = 0;

async function fileBytes(file, view) {
  if (typeof file.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    const reader = new view.FileReader();
    reader.onerror = () => reject(Error("The selected file could not be read. Your draft has been retained."));
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.readAsArrayBuffer(file);
  });
}

function contextLinks(context) {
  return Object.fromEntries(contextKeys.filter(key => context[key]).map(key => [key, String(context[key]).slice(0, 192)]));
}

function initialRecord(context, crypto) {
  return {type: "field-capture", captureId: crypto.randomUUID(), kind: kinds.includes(context.kind) ? context.kind : "observation", title: "", note: "", capturedAt: timestamp(), author: "", sensitivity: "internal", site: String(context.site || ""),
    location: {original: null, current: null, disclosure: "suppressed"},
    consent: Object.fromEntries(Object.keys(consentNames).map(key => [key, "not_recorded"])),
    links: {assessmentIds: context.assessmentId ? [String(context.assessmentId)] : [], actionIds: context.actionId ? [String(context.actionId)] : [], requirement: context.requirement ? clone(context.requirement) : null, context: contextLinks(context)}, attachments: []};
}

function recordSummary(record) {
  const {attachments, ...fields} = record;
  return {...fields, attachments: attachments.map(({filename, mediaType, sha256}) => ({filename, mediaType, sha256}))};
}

async function validateImport(source, crypto) {
  if (source?.format !== "esia-field-capture-export" || source.version !== 1 || !source.draft?.record) throw Error("Choose a version 1 E&S field capture export.");
  const record = source.draft.record;
  const keys = (value, allowed, name) => {if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key))) throw Error(`The exported ${name} contains unsupported fields.`);};
  keys(record, ["type", "captureId", "kind", "title", "note", "capturedAt", "author", "sensitivity", "site", "location", "consent", "links", "attachments", "details"], "record");
  if (record.type !== "field-capture" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(record.captureId || "") || !kinds.includes(record.kind) || !["internal", "confidential", "restricted"].includes(record.sensitivity)) throw Error("The exported capture identity or record type is invalid.");
  for (const [name, max] of [["title", 2000], ["note", 16000], ["author", 1000], ["site", 2000]]) if (typeof record[name] !== "string" || record[name].length > max) throw Error(`The exported ${name} is invalid.`);
  if (!Number.isFinite(Date.parse(record.capturedAt))) throw Error("The original capture timestamp is invalid.");
  keys(record.consent, Object.keys(consentNames), "consent");
  for (const key of Object.keys(consentNames)) if ((key !== "disclosure" || Object.hasOwn(record.consent, key)) && !consentValues.includes(record.consent[key])) throw Error("The exported consent controls are invalid.");
  if (record.location !== null) {
    keys(record.location, ["original", "current", "disclosure"], "location");
    if (!record.location || !["precise", "generalized", "suppressed"].includes(record.location.disclosure)) throw Error("The exported location controls are invalid.");
    for (const key of ["original", "current"]) {
      const point = record.location[key];
      if (point === null) continue;
      keys(point, ["latitude", "longitude", "accuracy", "source", "capturedAt", "crs"], "location point");
      if (!point || !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 || !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180 || point.crs !== "EPSG:4326" || !["device", "manual"].includes(point.source) || (key === "original" && point.source !== "device") || !Number.isFinite(Date.parse(point.capturedAt)) || (point.accuracy != null && (!Number.isFinite(point.accuracy) || point.accuracy < 0))) throw Error("The exported location metadata is invalid.");
    }
  }
  keys(record.links, ["assessmentIds", "actionIds", "requirement", "context", ...Object.keys(additionalFieldLinks)], "links");
  if (!record.links || !Array.isArray(record.links.assessmentIds) || !Array.isArray(record.links.actionIds)) throw Error("The exported assessment links are invalid.");
  for (const key of ["assessmentIds", "actionIds"]) if (record.links[key].length > 30 || record.links[key].some(value => typeof value !== "string" || value.length > 192)) throw Error("The exported assessment links exceed their limits.");
  if (record.links.requirement != null && (typeof record.links.requirement !== "object" || ["authority", "name", "edition", "clause"].some(key => typeof record.links.requirement[key] !== "string" || record.links.requirement[key].length > 2000))) throw Error("The exported requirement context is invalid.");
  if (record.links.requirement) keys(record.links.requirement, ["authority", "name", "edition", "clause"], "requirement");
  if (record.links.context != null) {keys(record.links.context, contextKeys, "context"); if (Object.values(record.links.context).some(value => typeof value !== "string" || value.length > 192)) throw Error("The exported context is invalid.");}
  normalizeAdditionalFieldLinks(record.links); normalizeFieldDetails(record.details);
  if (!Array.isArray(record.attachments) || record.attachments.length > MAX_FILES) throw Error(`An import can include up to ${MAX_FILES} original files.`);
  let size = 0;
  for (const attachment of record.attachments) {
    keys(attachment, ["filename", "mediaType", "contentBase64", "sha256"], "attachment");
    if (typeof attachment.filename !== "string" || !attachment.filename || attachment.filename.length > 255 || /[\\/\x00-\x1f]/.test(attachment.filename) || typeof attachment.mediaType !== "string" || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(attachment.mediaType) || attachment.mediaType.length > 200 || typeof attachment.contentBase64 !== "string" || attachment.contentBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.contentBase64) || !/^[a-f0-9]{64}$/.test(attachment.sha256)) throw Error("An exported attachment is invalid.");
    size += base64Size(attachment.contentBase64);
    if (size > MAX_BYTES) throw Error("Original files must total no more than 10 MiB.");
    const bytes = Uint8Array.from(atob(attachment.contentBase64), character => character.charCodeAt(0));
    if (bytesToBase64(bytes) !== attachment.contentBase64) throw Error("An exported attachment has invalid base64 encoding.");
    if (await sha256Bytes(bytes, crypto) !== attachment.sha256) throw Error(`The original file hash does not match: ${attachment.filename}`);
    attachment.mediaType = attachment.mediaType.toLowerCase();
  }
  return clone(record);
}

/** One browser-only capture form. Only an explicitly supplied adapter can write
 * to a project, and only its acknowledged response changes repository status. */
export function mountFieldCapture(root, {projects = [], context = {}, linkOptions = {}, devicePolicyContext, now = Date.now, saveToProject, reviewProjectSave, restartProjectSave, invalidation, store, crypto = globalThis.crypto, onExport, onDisclosure} = {}) {
  linkOptions=preparedLinkOptions(linkOptions);
  if (!root?.ownerDocument) throw TypeError("Field capture requires a DOM root.");
  const view = root.ownerDocument.defaultView, document = root.ownerDocument;
  store ??= createFieldDraftStore({indexedDB: view.indexedDB, crypto, devicePolicyContext, now});
  const prefix = `field-capture-${++sequence}`;
  let disposed = false, busy = false, locked = true, initialized = false, dirty = false, drafts = [], message = "", error = false, gpsToken = 0, session = 0;
  let current = {id: "", record: null, projectId: String(context.projectId || ""), accountId: String(context.accountId || ""), revision: 0, history: [], repositoryReceipt: null};
  let lastSaved = null, pendingOpen = "", deleting = "", focusMemory = null, focusNew = false, projectSaveReview = null;
  const emptyDisclosure = () => ({title: "", summary: "", recipient: "", purpose: "", permissionBasis: "recorded_consent", permissionExplanation: "", reviewer: "", locationMode: "suppressed", legacyDisclosureConsent: "", noPersonalData: false, reviewed: false});
  let disclosureReview = emptyDisclosure(), disclosurePreview = null;
  let deviceContext = devicePolicyContext ? clone(devicePolicyContext) : null, deviceTimer = null;
  const currentDeviceContext = () => deviceContext?.policy !== undefined ? deviceContext : current?.devicePolicyContext || deviceContext;
  async function checkDevicePolicy(record) {
    const selected = currentDeviceContext();
    if (!selected) return;
    await validateFieldDeviceLease(selected.policy,selected.lease,{scope:selected.scope,now,crypto,sensitivity:record?.sensitivity,includesOriginals:Boolean(record?.attachments?.length)});
    if(record&&current.devicePolicyContext?.policy!==undefined&&selected.policy!==undefined&&["accountId","projectId","engagementId"].some(key=>current.devicePolicyContext.scope?.[key]!==selected.scope?.[key]))throw Error("This retained draft belongs to another device-policy custody or mission. Reopen its owning mission to renew access.");
    if (record && selected.policy !== undefined && (current.projectId !== selected.scope.projectId || record.links?.context?.engagementId !== selected.scope.engagementId)) throw Error("Open this record's owning mission before saving or sharing it under its local device policy.");
  }
  function armDeviceTimer() {
    deviceTimer?.stop();deviceTimer=null;const selected=currentDeviceContext();
    if (!locked && selected?.policy !== undefined) deviceTimer=createFieldDevicePolicyTimer({policy:selected.policy,lease:selected.lease,now,schedule:(callback,delay)=>view.setTimeout(callback,delay),cancel:id=>view.clearTimeout(id),onLock:message=>lock(message)});
  }
  const urls = new Set(), pendingFiles = [];
  const project = () => projects.find(item => item.id === current.projectId && (!current.accountId || !item.accountId || item.accountId === current.accountId));
  function announce(value, failed = false) {message = value; error = failed;}
  function fresh() {
    projectSaveReview = null;
    gpsToken++;
    focusNew = true;
    const record = initialRecord(context, crypto);
    current = {id: record.captureId, record, projectId: String(context.projectId || ""), accountId: String(context.accountId || ""), revision: 0, history: [], repositoryReceipt: null};
    lastSaved = null; dirty = false;
    disclosureReview = emptyDisclosure(); disclosurePreview = null;
  }
  function remember() {
    const form = root.querySelector("[data-field-form]");
    if (!form || !current.record) return;
    const value = name => String(form.elements.namedItem(name)?.value || "");
    const record = current.record;
    for (const name of ["title", "note", "author", "site", "kind", "sensitivity"]) record[name] = value(name);
    current.projectId = value("projectId");
    const selected = projects.find(item => item.id === current.projectId);
    current.accountId = selected?.accountId || String(context.accountId || "");
    const hasDisclosure = Object.hasOwn(record.consent, "disclosure"), disclosure = value("consent_disclosure");
    record.consent = Object.fromEntries(Object.keys(consentNames).filter(key => key !== "disclosure" || hasDisclosure || disclosure !== "").map(key => [key, value(`consent_${key}`)]));
    if (record.location || value("disclosure") !== "suppressed") {record.location ??= {original: null, current: null, disclosure: "suppressed"};record.location.disclosure = value("disclosure");}
    record.links.assessmentIds = value("assessmentIds").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    record.links.actionIds = value("actionIds").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const requirement = Object.fromEntries(["authority", "name", "edition", "clause"].map(key => [key, value(`requirement_${key}`)]));
    record.links.requirement = Object.values(requirement).some(Boolean) ? requirement : null;
    for (const name of Object.keys(additionalFieldLinks)) {
      const entries = value(`links_${name}`).split(/\r?\n/).map(item => item.trim()).filter(Boolean);
      if (entries.length || Object.hasOwn(record.links, name)) record.links[name] = entries;
    }
    if (form.elements.namedItem("consultation_purpose")) {
      const consultation = {purpose: value("consultation_purpose"), method: value("consultation_method"), participantContext: value("consultation_participantContext"), issues: value("consultation_issues").split(/\r?\n/).map(item => item.trim()).filter(Boolean),
        commitments: [...form.querySelectorAll("[data-field-commitment]")].map(row => ({description: row.querySelector('[data-commitment-description]').value, owner: row.querySelector('[data-commitment-owner]').value, dueDate: row.querySelector('[data-commitment-date]').value || null})).filter(item => item.description || item.owner || item.dueDate)};
      if (record.details?.consultation || consultation.purpose || consultation.method || consultation.participantContext || consultation.issues.length || consultation.commitments.length) {record.details ??= {schemaVersion: 1};record.details.consultation = consultation;}
    }
    if (form.elements.namedItem("measurement_value")) {
      current.measurementInput = value("measurement_value");
      const measurement = {value: current.measurementInput.trim() ? Number(current.measurementInput) : null, unit: value("measurement_unit"), method: value("measurement_method"), instrument: value("measurement_instrument"), conditions: value("measurement_conditions"), takenAt: value("measurement_takenAt") || null};
      if (record.details?.measurement || Object.values(measurement).some(item => item !== null && item !== "")) {record.details ??= {schemaVersion: 1};record.details.measurement = measurement;}
    }
    // Manual coordinates are applied by their own explicit button so an
    // incomplete coordinate pair can still be saved as an incomplete draft.
    current.manualInput = {latitude: value("latitude"), longitude: value("longitude")};
    for (const name of ["title", "summary", "recipient", "purpose", "permissionBasis", "permissionExplanation", "reviewer", "locationMode", "legacyDisclosureConsent"]) disclosureReview[name] = value(`share_${name}`);
    for (const name of ["reviewed", "noPersonalData"]) disclosureReview[name] = form.elements.namedItem(`share_${name}`)?.checked === true;
    current.successorReason = value("successorReason");
    current.locationReason = value("locationReason");current.geometryInput = value("geometryInput");current.geometryType = value("geometryType");
  }
  function markDirty() {
    projectSaveReview = null;
    dirty = true;
    disclosurePreview = null; disclosureReview.reviewed = false;
    const reviewed = root.querySelector('[name="share_reviewed"]'); if (reviewed) reviewed.checked = false;
    root.querySelector('[data-field-disclosure-preview-content]')?.closest('[role="region"]')?.remove();
    if (current) current.repositoryReceipt = null;
    const status = root.querySelector("[data-field-save-state]");
    if (status) status.textContent = "Unsaved changes in this tab";
  }
  function render() {
    if (disposed) return;
    const oldDetails = new Map(Array.from(root.querySelectorAll("details")).map(detail => [detail.querySelector("summary")?.textContent, detail.open]));
    const active = document.activeElement;
    if (root.contains(active)) focusMemory = {name: active.name, data: Array.from(active?.attributes || []).find(attribute => attribute.name.startsWith("data-field-")), selection: active.name && typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null};
    const {name: focusedName, data: focusedData, selection} = focusMemory || {};
    root.classList.add("field-capture");
    root.setAttribute("aria-busy", String(busy));
    const policyState=currentDeviceContext(),policyCopy=policyState?.policy!==undefined?`Local engagement device policy applies. ${policyState.lease?.expiresAt?`Cached lease expires ${policyState.lease.expiresAt}. `:"Unlock requires a current scoped lease. "}This local setting does not provide remote device management.`:"No local engagement device policy is configured. Passphrase encryption and visibility locking apply; policy-based expiry is not configured.";
    const status = `<p class="fc-status${error ? " fc-error" : ""}" role="${error ? "alert" : "status"}" aria-live="polite" data-field-status>${h(message)}</p><p class="fc-help" data-field-policy-state>${h(policyCopy)}</p>`;
    if (locked) {
      root.innerHTML = `<section class="fc-panel fc-vault"><p class="fc-eyebrow">Private field capture</p><h1>${initialized ? "Unlock device drafts" : "Set up encrypted device drafts"}</h1><p>Capture notes and original files without a network connection. Drafts stay in this browser until you explicitly delete them. Clearing browser data or losing this device can destroy them.</p><form data-field-unlock><label><span>${initialized ? "Vault passphrase" : "Choose a vault passphrase (at least 10 characters)"}</span><input name="passphrase" type="password" autocomplete="${initialized ? "current-password" : "new-password"}" maxlength="1024"${initialized ? "" : ' minlength="10"'} required></label>${initialized ? "" : '<label><span>Repeat passphrase</span><input name="confirmation" type="password" autocomplete="new-password" maxlength="1024" required></label>'}<button type="submit"${busy ? " disabled" : ""}>${initialized ? "Unlock drafts" : "Create device vault"}</button></form><p class="fc-help">AES-GCM encryption protects saved drafts with your passphrase. It cannot be recovered if forgotten. This browser vault does not provide account access controls or a project backup.</p>${dirty ? '<p class="fc-notice">Unsaved work is retained in this tab. Unlock to continue; closing this tab loses unsaved changes.</p>' : ""}${status}</section>`;
      if (!busy && document.visibilityState !== "hidden") root.querySelector('[name="passphrase"]').focus();
      return;
    }
    const r = current.record, point = r.location?.current, original = r.location?.original;
    const disabled = busy ? " disabled" : "";
    const legacyDisclosure = !Object.hasOwn(r.consent, "disclosure");
    const consentFields = Object.entries(consentNames).map(([key, text]) => `<label><span>${h(text)}</span><select name="consent_${key}">${key === "disclosure" && legacyDisclosure ? option("", "", "Not recorded in legacy original; choose only after review") : ""}${consentValues.map(value => option(value, r.consent[key])).join("")}</select></label>`).join("");
    const legacyDisclosureField = legacyDisclosure ? `<div class="fc-notice"><p>This legacy original has no separate disclosure permission. Its absence is preserved. For this sharing copy only, review the original permissions and record your conclusion for the named recipient and purpose; explain the basis below.</p><label><span>Legacy disclosure permission for this recipient and purpose</span><select name="share_legacyDisclosureConsent">${option("", disclosureReview.legacyDisclosureConsent, "Not reviewed — sharing blocked")}${option("granted", disclosureReview.legacyDisclosureConsent, "Reviewed: disclosure permission granted")}${option("not_applicable", disclosureReview.legacyDisclosureConsent, "Reviewed: no personal data; disclosure permission not applicable")}</select></label><p class="fc-help">This attestation accompanies the derivative and does not add a consent choice to the original.</p></div>` : "";
    const contextText = Object.entries(r.links.context || {}).map(([key, value]) => `${key}: ${value}`).join(" · ");
    const consultation = r.details?.consultation || {purpose: "", method: "", participantContext: "", issues: [], commitments: []};
    const measurement = r.details?.measurement || {value: null, unit: "", method: "", instrument: "", conditions: "", takenAt: null};
    const retainedOrigin = current.retainedOrigin || current.repositoryReceipt;
    const geometry = r.details?.spatial?.currentGeometry ?? fieldPointGeometry(point);
    root.innerHTML = `<header class="fc-heading"><div><p class="fc-eyebrow">Capture first, enrich later</p><h1>New field record</h1><p>Save an incomplete record now, then add its project and assessment links later.</p></div><button type="button" data-field-lock>Lock drafts</button></header>${status}
      <div class="fc-layout"><section class="fc-panel"><form data-field-form novalidate><fieldset${disabled}><legend>What are you recording?</legend><div class="fc-kinds" role="group" aria-label="Field record type">${kinds.map(kind => `<button type="button" data-field-kind="${kind}" aria-pressed="${r.kind === kind}">${label(kind)}</button>`).join("")}</div><select class="fc-sr" name="kind" aria-label="Record type">${kinds.map(kind => option(kind, r.kind)).join("")}</select>
      <div class="fc-fields"><label class="fc-wide"><span>Title (optional for a device draft)</span><input name="title" maxlength="2000" value="${h(r.title)}"></label><label class="fc-wide"><span>${r.kind === "interview" ? "De-identified interview notes" : "Field notes"}</span><textarea name="note" rows="5" maxlength="16000" placeholder="${r.kind === "measurement" ? "Value, unit, instrument, method and observed conditions" : r.kind === "incident" ? "Observed facts, time, immediate response and unresolved questions" : "What did you observe? What needs follow-up?"}">${h(r.note)}</textarea><small>${r.kind === "interview" ? "Use a participant code or group. Avoid names, contact details and details that could identify someone indirectly. Consent choices below are independent." : "Keep observed facts separate from professional conclusions."}</small></label>
      <label><span>Project</span><select name="projectId"><option value="">Unassigned — choose later</option>${projects.map(item => option(item.id, current.projectId, item.name || item.title || item.id)).join("")}</select><small>${saveToProject ? "Repository saves require an available project." : "Context only. This page saves device drafts and exports; project repository saving is unavailable here."}</small></label><label><span>Site / activity (optional)</span><input name="site" maxlength="2000" value="${h(r.site)}"></label><label><span>Recorded by</span><input name="author" maxlength="1000" value="${h(r.author)}" autocomplete="name"><small>Self-reported attribution; not a verified identity.</small></label><label><span>Record sensitivity</span><select name="sensitivity">${["internal", "confidential", "restricted"].map(value => option(value, r.sensitivity)).join("")}</select><small>A classification label; it does not grant or enforce access.</small></label></div>
      <p class="fc-help">Original capture: <time datetime="${h(r.capturedAt)}">${h(r.capturedAt)}</time> · ${h(r.captureId)}</p>
      <details${r.kind === "interview" ? " open" : ""}><summary>Consent and purpose</summary><p>Record each permission separately. An unknown or granted choice does not establish legal authority. Do not retain information when permission has been declined.</p><div class="fc-fields">${consentFields}</div><p class="fc-help">This form accepts files; it does not record microphone audio. Obtain the relevant permission before taking photographs or making recordings.</p></details>
      ${r.kind === "interview" || r.details?.consultation ? `<details open><summary>Consultation record</summary><p>Use participant codes or group descriptions. Keep names, contacts and identifying accounts in an authorized separate record.</p><div class="fc-fields">${[["purpose", "Consultation purpose", 2000], ["method", "Consultation method", 2000], ["participantContext", "Deidentified participant or group context", 4000]].map(([name, title, max]) => `<label><span>${title}</span><textarea name="consultation_${name}" maxlength="${max}" rows="2">${h(consultation[name])}</textarea></label>`).join("")}<label class="fc-wide"><span>Issues raised (one per line)</span><textarea name="consultation_issues" maxlength="16000" rows="3">${h(consultation.issues.join("\n"))}</textarea></label></div><h2>Commitments made during this consultation</h2>${(consultation.commitments.length ? consultation.commitments : [{description: "", owner: "", dueDate: null}]).map((item, index) => `<div class="fc-fields" data-field-commitment><label><span>Commitment ${index + 1}</span><input data-commitment-description name="commitment_description_${index}" maxlength="2000" value="${h(item.description)}"></label><label><span>Responsible person or role</span><input data-commitment-owner name="commitment_owner_${index}" maxlength="500" value="${h(item.owner)}"></label><label><span>Due date (if agreed)</span><input data-commitment-date name="commitment_dueDate_${index}" type="date" value="${h(item.dueDate || "")}"></label></div>`).join("")}<button type="button" data-field-commitment-add>Add another commitment</button><p class="fc-help">These are captured statements; confirming a client obligation or creating a corrective action requires a separate professional review.</p></details>` : ""}
      ${r.kind === "measurement" || r.details?.measurement ? `<details open><summary>Measurement record</summary><div class="fc-fields"><label><span>Measured value (optional for an incomplete draft)</span><input name="measurement_value" inputmode="decimal" maxlength="100" value="${h(current.measurementInput ?? measurement.value ?? "")}"></label>${[["unit", "Unit", 200], ["method", "Method", 2000], ["instrument", "Instrument", 1000], ["conditions", "Observed conditions", 4000], ["takenAt", "Measurement time (ISO timestamp, optional)", 100]].map(([name, title, max]) => `<label><span>${title}</span><input name="measurement_${name}" maxlength="${max}" value="${h(measurement[name] || "")}"></label>`).join("")}</div><p class="fc-help">Recording a value does not establish compliance or data quality. Keep method, unit and original evidence available for review.</p></details>` : ""}
      <details><summary>Optional location</summary><p>Precise location can expose people and sensitive sites. GPS is requested only when you press the button.</p><button type="button" data-field-gps>Ask for device GPS</button><div class="fc-location">${point ? `<p>Current: ${h(point.latitude)}, ${h(point.longitude)} · ${h(point.source)} · ${h(point.crs)}${point.accuracy != null ? ` · accuracy ±${h(point.accuracy)} m` : ""}<br>${h(point.capturedAt)}</p>` : "<p>No location attached.</p>"}${original ? `<p>Original GPS retained separately: ${h(original.latitude)}, ${h(original.longitude)} · ±${h(original.accuracy)} m · ${h(original.capturedAt)} · EPSG:4326</p>` : ""}</div><div class="fc-fields"><label><span>Manual latitude</span><input name="latitude" inputmode="decimal" value="${h(current.manualInput?.latitude ?? point?.latitude ?? "")}" placeholder="−90 to 90"></label><label><span>Manual longitude</span><input name="longitude" inputmode="decimal" value="${h(current.manualInput?.longitude ?? point?.longitude ?? "")}" placeholder="−180 to 180"></label></div><div class="fc-actions"><button type="button" data-field-manual>Apply manual location</button><button type="button" data-field-no-location>Clear current location</button></div><label><span>Location disclosure in a sharing copy</span><select name="disclosure">${["suppressed", "generalized", "precise"].map(value => option(value, r.location?.disclosure || "suppressed")).join("")}</select></label><p class="fc-help">Original GPS stays in the original record and backup. A sharing copy below suppresses location or uses an approximate 0.1° area; it never includes the precise point.</p></details>
      <details><summary>Point, line or area and location history</summary><p>Use WGS84 longitude, latitude pairs. Keep precise geometry within authorized custody. Corrections and clearing retain earlier coordinates and require a reason.</p><label><span>Reason for correction or clearing</span><textarea name="locationReason" maxlength="2000" rows="2">${h(current.locationReason || "")}</textarea></label><div class="fc-fields"><label><span>Geometry type</span><select name="geometryType">${["Point", "LineString", "Polygon"].map(type => option(type, current.geometryType || geometry?.type || "Point", type === "Polygon" ? "Area (polygon)" : type === "LineString" ? "Line" : "Point")).join("")}</select></label><label class="fc-wide"><span>Coordinates or GeoJSON geometry</span><textarea name="geometryInput" maxlength="64000" rows="4" placeholder='{"type":"LineString","coordinates":[[30.1,0.4],[30.2,0.5]]}'>${h(current.geometryInput || "")}</textarea></label></div><div class="fc-actions"><button type="button" data-field-geometry-apply>Apply point, line or area</button><button type="button" data-field-geometry-clear>Clear current geometry</button></div><p class="fc-help">Up to 256 coordinate pairs, 8 closed area rings and 30 attributed revisions per capture. Original GPS and the first recorded geometry remain separate from corrections.</p>${geometryPreview(geometry)}${r.details?.spatial ? `<details><summary>Location revision history (${r.details.spatial.revisions.length})</summary><p>Original recorded geometry</p><pre class="fc-offline-text">${h(JSON.stringify(r.details.spatial.originalGeometry))}</pre><ol>${r.details.spatial.revisions.map(item => `<li>${h(item.changedAt)} · ${h(item.changedBy)} · ${h(item.reason)}<pre class="fc-offline-text">${h(JSON.stringify({before: item.before, after: item.after}))}</pre></li>`).join("")}</ol></details>` : ""}</details>
      <details><summary>Link to requirements and follow-up</summary>${contextText ? `<p class="fc-notice">Inherited context: ${h(contextText)}. These references are contextual assertions; the project verifies applicable links when saving.</p>` : ""}<div class="fc-fields">${["authority", "name", "edition", "clause"].map(key => `<label><span>Requirement ${key === "name" ? "framework / instrument" : key}</span><input name="requirement_${key}" maxlength="2000" value="${h(r.links.requirement?.[key])}"></label>`).join("")}<label><span>Assessment identifiers (one per line)</span><textarea name="assessmentIds" rows="2">${h(r.links.assessmentIds.join("\n"))}</textarea></label><label><span>Corrective action identifiers (one per line)</span><textarea name="actionIds" rows="2">${h(r.links.actionIds.join("\n"))}</textarea></label></div><p class="fc-help">Evidence is not a compliance finding. Human assessment and professional reasoning remain separate.</p></details>
      <details><summary>Related sites and engagement records</summary><p>Link this capture to several existing records. Choose available records or keep identifiers in an incomplete draft; the repository checks every reference when saving.</p><div class="fc-fields">${Object.entries(additionalFieldLinks).map(([name, title]) => `<div><label><span>${h(title)} (one per line)</span><textarea name="links_${name}" maxlength="6000" rows="2">${h((r.links[name] || []).join("\n"))}</textarea></label>${Array.isArray(linkOptions[name]) && linkOptions[name].length ? `<label><span>Choose ${h(title.toLowerCase())}</span><select name="choose_${name}"><option value="">Choose a record</option>${linkOptions[name].slice(0,100).map(item => option(item.id, "", item.label || item.id)).join("")}</select></label><button type="button" data-field-link-add="${name}">Add selected record</button>` : ""}</div>`).join("")}</div></details>
      <details open><summary>Original files</summary><label><span>Add photo, document or existing audio file</span><input type="file" name="attachments" multiple data-field-files></label><p class="fc-help">Up to 3 files, 10 MiB total. Originals are preserved byte for byte with SHA256; they may contain identity or location metadata. Photos are not automatically redacted.</p><ul class="fc-attachments">${r.attachments.map((item, index) => `<li><strong>${h(item.filename)}</strong><span>${h(item.mediaType)}</span><code>SHA256 ${h(item.sha256)}</code><button type="button" data-field-remove="${index}">Remove<span class="fc-sr"> ${h(item.filename)}</span></button></li>`).join("") || "<li>No original files attached.</li>"}</ul></details>
      <p data-field-save-state class="fc-save-state">${dirty ? "Unsaved changes in this tab" : current.savedAt ? `Saved on this device at ${h(current.savedAt)}` : "New record — not yet saved"}</p><div class="fc-actions"><button type="submit" class="fc-primary">Save encrypted device draft</button>${saveToProject ? '<button type="button" data-field-project-save>Save to selected project</button>' : ""}<button type="button" data-field-new>New record</button></div>${current.repositoryReceipt ? `<p class="fc-notice">Project acknowledged this capture at ${h(current.repositoryReceipt.acknowledgedAt)}. ${dirty ? "Later edits still need an explicit project save." : "The device draft is retained until you delete it."}</p>` : '<p class="fc-help">Saved on device means this browser only. A project repository save is confirmed only after its explicit acknowledgement.</p>'}
      ${reviewProjectSave&&current.transferState?.commit?`<section class="fc-notice" data-field-project-recovery><h3>Check a pending engagement save</h3><p>The original files and this device draft are retained. Check whether the engagement already saved the record, or review the current engagement before starting a replacement request.</p><button type="button" data-field-project-review${disabled}>Check current save status</button>${projectSaveReview?`<p data-field-project-review-summary>${h(projectSaveReview.status==='pending'?'The original request can still be retried. Use Save to selected project to retry its exact request.':projectSaveReview.status==='restart_required'?'The engagement changed or the earlier request expired. Review the current state before saving this same record again.':'The engagement already retained this record.')}</p><p>Earlier engagement revision ${h(projectSaveReview.priorRevision)} · current revision ${h(projectSaveReview.currentRevision)}.</p><ul>${projectSaveReview.reasons.map(reason=>`<li>${h(reason)}</li>`).join('')}</ul><details><summary>Changes since the earlier save</summary>${projectSaveReview.changes.map(change=>`<p>${h(change.command)} · ${h(change.actorId)} · ${h(change.at)} · revision ${h(change.revision)}</p>`).join('')||'<p>No intervening engagement commands were recorded.</p>'}</details>${projectSaveReview.status==='restart_required'?`<label class="fc-check"><input type="checkbox" name="projectRestartReviewed"><span>I reviewed the current engagement and want to save this exact retained record against it.</span></label><button type="button" data-field-project-restart${disabled}>Save against the reviewed current engagement</button>`:''}`:''}</section>`:''}
      <details data-field-disclosure><summary>Prepare a sharing copy</summary><p>Write only the facts this recipient may receive. Original notes, names, sites, internal links, edit history, files and embedded metadata are excluded. Review your own text for indirect identification; this form does not anonymize it automatically.</p><div class="fc-fields">${[["recipient", "Intended recipient", 1000], ["purpose", "Permitted purpose", 1000], ["reviewer", "Disclosure reviewed by", 1000], ["title", "Sharing title", 2000]].map(([name, title, max]) => `<label><span>${title}</span><input name="share_${name}" maxlength="${max}" value="${h(disclosureReview[name])}"></label>`).join("")}<label class="fc-wide"><span>Reviewed summary for this recipient</span><textarea name="share_summary" maxlength="16000" rows="4">${h(disclosureReview.summary)}</textarea></label><label><span>Permission basis</span><select name="share_permissionBasis">${option("recorded_consent", disclosureReview.permissionBasis, "Recorded retention, sharing and disclosure consent")}${option("no_personal_data", disclosureReview.permissionBasis, "No personal data; permissions not applicable")}</select></label><label><span>Location in sharing copy</span><select name="share_locationMode">${option("suppressed", disclosureReview.locationMode, "Suppress location")}${option("generalized", disclosureReview.locationMode, "Approximate 0.1° area (roughly 11 km north–south)")}</select></label><label class="fc-wide"><span>Permission scope or no-personal-data explanation</span><textarea name="share_permissionExplanation" maxlength="2000" rows="2">${h(disclosureReview.permissionExplanation)}</textarea></label></div>${legacyDisclosureField}<label class="fc-check"><input type="checkbox" name="share_noPersonalData"${disclosureReview.noPersonalData ? " checked" : ""}><span>For the no-personal-data basis, I verified that no personal data or interview material is included.</span></label><label class="fc-check"><input type="checkbox" name="share_reviewed"${disclosureReview.reviewed ? " checked" : ""}><span>I reviewed this text for identifying details and verified that the permissions cover this recipient and purpose.</span></label><button type="button" data-field-disclosure-preview>Preview sharing copy</button>${disclosurePreview ? `<div role="region" aria-label="Sharing copy preview"><h2>Review the exact sharing copy</h2><pre data-field-disclosure-preview-content>${h(JSON.stringify(disclosurePreview.packet, null, 2))}</pre><label class="fc-check"><input type="checkbox" name="share_confirm"><span>I reviewed this exact copy and authorize its disclosure to the named recipient for the stated purpose.</span></label><button type="button" data-field-disclosure-download>Download reviewed sharing copy</button></div>` : ""}</details>
      <details><summary>Keep a revised observation as a new record</summary><p>The retained original remains unchanged. A successor receives a new capture identity and links to the exact original manifest and your reason for the change.</p><label><span>Reason for a revised record</span><textarea name="successorReason" maxlength="2000" rows="2">${h(current.successorReason || "")}</textarea></label><button type="button" data-field-successor${retainedOrigin?.sha256 && retainedOrigin?.versionId ? "" : " disabled"}>Create successor record</button>${retainedOrigin?.sha256 && retainedOrigin?.versionId ? "" : '<p class="fc-help">First save the original to its project and receive its exact version acknowledgement.</p>'}</details>
      <details><summary>Original backup / repository handoff</summary><p class="fc-notice">This decrypted JSON contains sensitive notes, original GPS, consent choices, and complete original files including embedded metadata. Keep it within authorized custody. It is an original backup or repository handoff, not a sharing copy. Export does not synchronize or delete your draft.</p><label class="fc-check"><input type="checkbox" name="exportConsent"><span>I understand that this export contains unredacted sensitive information and original files.</span></label><button type="button" data-field-export>Export original backup / handoff</button></details>${current.history.length ? `<details><summary>Device edit history (${current.history.length})</summary><ul>${current.history.map(item => `<li>${h(item.editedAt)} · ${h(item.author || "Unattributed")} · ${h(item.changedFields?.join(", ") || "Saved revision")}</li>`).join("")}</ul></details>` : ""}</fieldset></form></section>
      <aside class="fc-panel"><h2>Device drafts</h2><p>${drafts.length} encrypted ${drafts.length === 1 ? "record" : "records"} saved in this browser. No automatic uploads or background synchronization.</p>${pendingOpen ? '<div class="fc-notice"><p>Save or explicitly discard this tab’s unsaved edits before opening another record.</p><button type="button" data-field-save-open>Save draft and continue</button><button type="button" data-field-discard-open>Discard unsaved edits and continue</button><button type="button" data-field-cancel-open>Keep editing</button></div>' : ""}<ul class="fc-drafts">${drafts.map(draft => `<li><strong>${h(draft.record.title || "Untitled field record")}</strong><span>${h(label(draft.record.kind))} · ${h(draft.savedAt)}</span><span>${draft.repositoryReceipt ? "Project acknowledgement recorded" : "Device only"}</span><div class="fc-actions"><button type="button" data-field-open="${h(draft.id)}"${disabled}>Reopen / edit</button><button type="button" data-field-delete="${h(draft.id)}"${disabled}>Delete device draft</button></div>${deleting === draft.id ? '<p>Delete this encrypted device copy? This cannot be undone.</p><button type="button" data-field-delete-confirm>Delete permanently</button><button type="button" data-field-delete-cancel>Keep draft</button>' : ""}</li>`).join("") || "<li>No device drafts saved yet.</li>"}</ul><details><summary>Import a portable record</summary><p>Import an E&S field capture JSON, verify its original file hashes, then review its destination. Import retains original timestamps and consent choices.</p><form data-field-import><label><span>Field capture JSON (up to 15 MiB)</span><input type="file" name="importFile" accept=".json,application/json" required></label><button type="submit"${disabled}>Import into device vault</button></form></details><p class="fc-help">Locking hides notes and releases the encryption key when this tab is hidden. This is a browser safeguard; operating-system previews and device protection still depend on the device. Unsaved work remains in this tab’s memory.</p></aside></div>`;
    Array.from(root.querySelectorAll("details")).forEach(detail => {const key = detail.querySelector("summary")?.textContent; if (oldDetails.has(key)) detail.open = oldDetails.get(key);});
    const upload = root.querySelector("[data-field-files]");
    const kindSelect = root.querySelector('[name="kind"]'); kindSelect.hidden = true; kindSelect.tabIndex = -1; kindSelect.setAttribute("aria-hidden", "true");
    if (r.kind === "photo") {upload.setAttribute("accept", "image/*"); upload.setAttribute("capture", "environment");}
    // A native camera/file picker may hide this tab and trigger the privacy
    // lock before returning. Retain its File objects in memory for unlocking,
    // even though the original input has been removed from the visible DOM.
    const pickerCaptureId = current.id;
    upload.addEventListener("change", event => {
      event.stopPropagation();
      if (disposed || current?.id !== pickerCaptureId) return;
      const files = Array.from(upload.files || []);
      if (!files.length) return;
      if (locked) {pendingFiles.push(...files); markDirty(); announce("Selected original files are retained in this tab. Unlock to add them to your unsaved record."); render();}
      else operate(() => attach(files));
    });
    for (const name of ["assessmentIds", "actionIds"]) root.querySelector(`[name="${name}"]`).maxLength = 6000;
    if (current.projectId && !projects.some(item => item.id === current.projectId)) {
      const select = root.querySelector('[name="projectId"]'), contextual = document.createElement("option");
      contextual.value = current.projectId; contextual.textContent = `Unverified project context: ${current.projectId}`; contextual.selected = true; select.append(contextual);
    }
    let nextFocus = focusedName ? Array.from(root.querySelectorAll("[name]")).find(node => node.name === focusedName) : null;
    if (!nextFocus && focusedData) nextFocus = Array.from(root.querySelectorAll(`[${focusedData.name}]`)).find(node => node.getAttribute(focusedData.name) === focusedData.value);
    if (focusNew && !busy) {nextFocus = root.querySelector('[name="title"]'); focusNew = false; focusMemory = null;}
    if (nextFocus && !nextFocus.disabled) {nextFocus.focus({preventScroll: true}); if (selection && typeof nextFocus.setSelectionRange === "function") nextFocus.setSelectionRange(...selection);}
  }
  function validateRetention() {
    if (current.record.consent.retention === "declined") throw Error("Retention permission is declined. Change the consent record only if the permission has changed, or remove this information.");
    if (current.record.attachments.some(item => item.mediaType.toLowerCase().startsWith("audio/")) && current.record.consent.audio === "declined") throw Error("Audio permission is declined. Remove the audio file before saving.");
    if (current.record.attachments.some(item => item.mediaType.toLowerCase().startsWith("image/")) && current.record.consent.photograph === "declined") throw Error("Photograph permission is declined. Remove the image file before saving.");
    normalizeFieldDetails(current.record.details); normalizeAdditionalFieldLinks(current.record.links);
    for (const name of ["assessmentIds", "actionIds"]) if (current.record.links[name].length > 30 || current.record.links[name].some(value => value.length > 192)) throw Error("Use up to 30 assessment or action identifiers, each no more than 192 characters.");
  }
  async function saveDraft() {
    remember(); validateRetention();
    await checkDevicePolicy(current.record);
    const saving = clone(current);
    if (currentDeviceContext()?.policy !== undefined) saving.devicePolicyContext=clone(currentDeviceContext());
    if (lastSaved && (JSON.stringify(lastSaved.record) !== JSON.stringify(current.record) || lastSaved.projectId !== current.projectId || lastSaved.accountId !== current.accountId)) saving.repositoryReceipt = null;
    if (lastSaved && JSON.stringify(lastSaved.record) !== JSON.stringify(current.record)) {
      const changedFields = Object.keys(current.record).filter(key => JSON.stringify(lastSaved.record[key]) !== JSON.stringify(current.record[key]));
      saving.history.push({editedAt: timestamp(), author: current.record.author, changedFields, previous: recordSummary(lastSaved.record)});
    }
    current = await store.put(saving);
    lastSaved = clone(current); dirty = false;
    if (!locked) drafts = await store.list();
    return current;
  }
  async function operate(action) {
    if (busy || disposed || locked) return;
    remember(); busy = true; render();
    try {await checkDevicePolicy(current.record);await action();} catch (failure) {announce(`${failure.message || "The operation failed."} Your device draft and current work have been retained. Retry only when ready.`, true);}
    finally {busy = false; render();}
  }
  async function openDraft(id) {
    gpsToken++;
    const draft = await store.get(id);
    if (!draft) throw Error("This device draft is no longer available.");
    projectSaveReview=null;current = draft; lastSaved = clone(draft); dirty = false; pendingOpen = ""; deleting = ""; focusNew = true;
    disclosureReview = emptyDisclosure(); disclosurePreview = null;
    announce("Device draft reopened. Changes require another explicit save.");
  }
  function requestOpen(id) {
    remember();
    if (dirty) {pendingOpen = id; render(); return;}
    operate(async () => {if (id === "new") {fresh(); announce("New unsaved field record.");} else await openDraft(id);});
  }
  function lock(reason = "Draft vault locked. Unlock to continue.") {
    if (disposed) return;
    projectSaveReview=null;remember(); gpsToken++; session++; locked = true; drafts = []; pendingOpen = ""; deleting = ""; focusMemory = null; disclosureReview = emptyDisclosure(); disclosurePreview = null; linkOptions = {};deviceTimer?.stop();deviceTimer=null; store.lock();
    announce(reason); render();
  }
  async function attach(files) {
    const attachments = current.record.attachments;
    if (files.length + attachments.length > MAX_FILES) throw Error("Attach no more than 3 original files per record.");
    const existingSize = attachments.reduce((sum, file) => sum + base64Size(file.contentBase64), 0);
    if (existingSize + files.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES) throw Error("Original files must total no more than 10 MiB.");
    const additions = [];
    for (const file of files) {
      if (!file.name || file.name.length > 255 || /[\\/\x00-\x1f]/.test(file.name)) throw Error("Original filenames must be at most 255 characters and cannot include directory separators or control characters.");
      const bytes = await fileBytes(file, view);
      if (existingSize + additions.reduce((sum, item) => sum + item.size, 0) + bytes.length > MAX_BYTES) throw Error("Original files must total no more than 10 MiB.");
      additions.push({filename: String(file.name), mediaType: String(file.type || "application/octet-stream").split(";", 1)[0].toLowerCase(), contentBase64: bytesToBase64(bytes), sha256: await sha256Bytes(bytes, crypto), size: bytes.length});
    }
    attachments.push(...additions.map(({size, ...attachment}) => attachment)); markDirty(); announce("Original files added in memory. Save the device draft to retain them.");
  }
  async function projectInputs() {
    const token = session;
    if (!project()) throw Error("Select an available project before saving to its repository.");
    if (!current.record.title.trim() || !current.record.author.trim()) throw Error("Add a title and recorded-by attribution before saving to a project. Incomplete device drafts are allowed.");
    await saveDraft();
    if (locked || disposed || token !== session) throw Error("The vault was locked before the project save. No repository request was sent; unlock and retry explicitly.");
    const submitted = clone(current.record), selection = {projectId: current.projectId, accountId: current.accountId,...(currentDeviceContext()?.policy!==undefined?{devicePolicy:clone(currentDeviceContext().policy),deviceLease:clone(currentDeviceContext().lease)}:{})};
    const captureId=current.id,submittedJson=JSON.stringify(submitted);
    const assertCurrent=()=>{if(locked||disposed||token!==session||current.id!==captureId||JSON.stringify(current.record)!==submittedJson)throw Error("The capture or vault session changed during transfer. Its encrypted state is retained; resume explicitly.");};
    const persistTransferState=async state=>{assertCurrent();current.transferState=clone(state);await saveDraft();assertCurrent();};
    return {submitted,selection,hooks:{transferState:clone(current.transferState),persistTransferState,assertCurrent},assertCurrent};
  }
  async function acknowledgeProject(result,selection,submitted) {
    if (result?.acknowledged !== true) throw Error("The project did not acknowledge this capture. Repository synchronization has not been confirmed.");
    current.repositoryReceipt = {acknowledgedAt: timestamp(), projectId: selection.projectId, accountId: selection.accountId};
    if (result.resourceId === `field:${submitted.captureId}` && typeof result.versionId === "string" && /^[a-f0-9]{64}$/.test(result.sha256 || "")) {
      Object.assign(current.repositoryReceipt, {resourceId: result.resourceId, versionId: result.versionId, sha256: result.sha256, captureId: submitted.captureId});
      current.retainedOrigin = clone(current.repositoryReceipt);
    }
    if(result.authority&&result.resourceType==="document_original")current.repositoryReceipt.providerReceipt=clone(result);
    if (!locked) await saveDraft();
    announce("Project repository acknowledged the capture. The encrypted device draft is retained until you delete it.");
  }
  async function saveProject() {
    if(!saveToProject)throw Error("Project repository saving is unavailable on this page.");
    projectSaveReview=null;const input=await projectInputs();const result=await saveToProject(input.submitted,input.selection,input.hooks);input.assertCurrent();await acknowledgeProject(result,input.selection,input.submitted);
  }
  async function reviewProject() {
    if(!reviewProjectSave)throw Error("Pending save review is unavailable on this page.");
    projectSaveReview=null;const input=await projectInputs(),result=await reviewProjectSave(input.submitted,input.selection,input.hooks);input.assertCurrent();
    const review=result?.review;if(!review||!['saved','pending','restart_required'].includes(review.status)||!Array.isArray(review.reasons)||!Array.isArray(review.changes))throw Error("The engagement did not return a readable pending-save review.");
    if(review.status==='saved'){await acknowledgeProject(result.receipt,input.selection,input.submitted);announce("The engagement already saved this exact record. Its acknowledgement is now retained in the encrypted device draft.");}
    else{projectSaveReview=clone(review);announce(review.status==='pending'?"The original request remains pending. Retry its exact save when ready.":"Review the current engagement changes, then explicitly choose whether to save this retained record against the reviewed revision.");}
  }
  async function restartProject(confirmed) {
    if(!restartProjectSave||!confirmed||projectSaveReview?.status!=='restart_required')throw Error("Check the current save status and acknowledge its current changes before starting a replacement request.");
    const reviewed=projectSaveReview,input=await projectInputs();input.assertCurrent();if(projectSaveReview!==reviewed)throw Error("The field record or review changed. Check current save status again.");
    projectSaveReview=null;const result=await restartProjectSave(input.submitted,input.selection,input.hooks,clone(reviewed));input.assertCurrent();await acknowledgeProject(result,input.selection,input.submitted);
  }

  function gps() {
    if (busy || locked) return;
    remember();
    if (!view.navigator.geolocation) {announce("Device geolocation is unavailable. You can enter coordinates manually or leave location empty.", true); render(); return;}
    const token = ++gpsToken, captureId = current.record.captureId;
    announce("Waiting for your device location permission (up to 10 seconds)…"); render();
    view.navigator.geolocation.getCurrentPosition(position => {
      if (disposed || locked || token !== gpsToken || current.record.captureId !== captureId) return;
      remember();
      const point = {latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, source: "device", capturedAt: new Date(position.timestamp || Date.now()).toISOString(), crs: "EPSG:4326"};
      try {applyGeometry(fieldPointGeometry(point), point, current.locationReason || (!current.record.location?.current && !current.record.details?.spatial?.currentGeometry ? "Initial device GPS capture following requested permission." : ""));current.record.location.original ??= clone(point);announce("Device GPS attached with accuracy and timestamp. Original GPS and location history are retained separately.");}catch(failure){announce(failure.message,true);}render();
    }, () => {if (!disposed && !locked && token === gpsToken) {remember(); announce("Location was denied, timed out, or unavailable. Your record is retained without a new GPS location.", true); render();}}, {enableHighAccuracy: true, timeout: 10000, maximumAge: 0});
  }
  function applyGeometry(geometry, point = null, reason = current.locationReason) {
    const record = current.record, changedAt = timestamp(), spatial = reviseFieldGeometry(record, geometry, {reason, changedBy: record.author, changedAt, source: point?.source || "manual", accuracyMetres: point?.accuracy ?? null});
    record.details ??= {schemaVersion: 1};record.details.spatial = spatial;record.location ??= {original: null, current: null, disclosure: "suppressed"};
    record.location.current = geometry?.type === "Point" ? point || {longitude: geometry.coordinates[0], latitude: geometry.coordinates[1], accuracy: null, source: "manual", capturedAt: changedAt, crs: "EPSG:4326"} : null;
    if (!geometry) record.location.disclosure = "suppressed";
    current.manualInput = undefined;current.locationReason = "";current.geometryInput = "";current.geometryType = geometry?.type || "Point";markDirty();
  }
  async function exportRecord() {
    validateRetention();
    const consent = root.querySelector('[name="exportConsent"]')?.checked;
    if (!consent) throw Error("Confirm that the decrypted export contains sensitive information and original files.");
    const exported = {format: "esia-field-capture-export", version: 1, exportedAt: timestamp(), warning: "Unredacted sensitive record, original coordinates and complete original files. Protect this decrypted export.", draft: clone(current)};
    if (onExport) await onExport(exported);
    else {
      const blob = new view.Blob([JSON.stringify(exported, null, 2)], {type: "application/json"});
      const url = view.URL.createObjectURL(blob); urls.add(url);
      const link = document.createElement("a"); link.href = url; link.download = `field-record-${current.id}.json`; root.append(link); link.click(); link.remove();
      view.URL.revokeObjectURL(url); urls.delete(url);
    }
    announce("Decrypted original record exported. Device and repository status are unchanged.");
  }
  async function previewDisclosure() {
    const token = session, record = clone(current.record), review = clone(disclosureReview);
    const packet = await createFieldDisclosure(record, review, {crypto});
    if (locked || disposed || token !== session || JSON.stringify(current.record) !== JSON.stringify(record) || JSON.stringify(disclosureReview) !== JSON.stringify(review)) throw Error("The record or review changed while the preview was prepared. Unlock and review a fresh copy.");
    disclosurePreview = {packet, sourceJson: JSON.stringify(record), reviewJson: JSON.stringify(review)};
    announce("Sharing preview prepared. Review the exact copy and confirm before downloading.");
  }
  async function createSuccessor() {
    const origin = current.retainedOrigin || current.repositoryReceipt;
    if (!origin?.versionId || !/^[a-f0-9]{64}$/.test(origin.sha256 || "") || origin.projectId !== current.projectId || origin.accountId !== current.accountId) throw Error("First obtain the exact retained original acknowledgement in this account and project.");
    const reason = current.successorReason?.trim();if (!reason) throw Error("Record why this observation needs a successor.");
    const record = clone(current.record), id = crypto.randomUUID();
    record.details = {...record.details, schemaVersion: 1, successor: {captureId: origin.captureId || record.captureId, reason, sourceRecordSha256: origin.sha256, sourceVersionId: origin.versionId, pinKind: "retained_manifest"}};
    normalizeFieldDetails(record.details);record.captureId = id;record.capturedAt = timestamp();
    current = {id, record, projectId: current.projectId, accountId: current.accountId, revision: 0, history: [], repositoryReceipt: null};lastSaved = null;disclosureReview = emptyDisclosure();disclosurePreview = null;gpsToken++;dirty = true;focusNew = true;
    announce("New successor created in this tab. The earlier device and project records remain unchanged; save this new record explicitly.");
  }
  async function downloadDisclosure(confirmed) {
    if (!disclosurePreview || disclosurePreview.sourceJson !== JSON.stringify(current.record) || disclosurePreview.reviewJson !== JSON.stringify(disclosureReview)) throw Error("Prepare a fresh sharing preview after changes to the record or disclosure review.");
    if (!confirmed) throw Error("Review the exact sharing preview and authorize disclosure before downloading.");
    const packet = clone(disclosurePreview.packet);
    if (onDisclosure) await onDisclosure(packet);
    else {
      const blob = new view.Blob([JSON.stringify(packet, null, 2)], {type: "application/json"});
      const url = view.URL.createObjectURL(blob); urls.add(url);
      const link = document.createElement("a"); link.href = url; link.download = `field-disclosure-${current.id}.json`; root.append(link); link.click(); link.remove();
      view.URL.revokeObjectURL(url); urls.delete(url);
    }
    announce("Reviewed sharing copy downloaded for the named recipient and purpose. Original records are unchanged.");
  }
  const submit = event => {
    if (event.target.matches("[data-field-unlock]")) {
      event.preventDefault(); event.stopPropagation();
      if (busy) return;
      const passphrase = event.target.elements.namedItem("passphrase").value;
      if (!initialized && passphrase !== event.target.elements.namedItem("confirmation").value) {announce("The two passphrases do not match.", true); render(); return;}
      const token = ++session;
      busy = true; render();
      (async () => {try {if(currentDeviceContext()?.policy!==undefined)await checkDevicePolicy(current.record);await store.unlock(passphrase); if (disposed || token !== session) return; const saved = await store.list(); if (disposed || token !== session) return; initialized = true; if (!current.record) fresh(); if (pendingFiles.length) await attach(pendingFiles.splice(0)); if (disposed || token !== session) return; locked = false; drafts = saved;armDeviceTimer(); announce("Device vault unlocked. Nothing is uploaded automatically.");} catch (failure) {if (!disposed && token === session) announce(failure.message, true);} finally {busy = false; render();}})();
    } else if (event.target.matches("[data-field-form]")) {
      event.preventDefault(); event.stopPropagation(); operate(async () => {await saveDraft(); announce("Encrypted draft saved on this device. It has not been synchronized with a project repository.");});
    } else if (event.target.matches("[data-field-import]")) {
      event.preventDefault(); event.stopPropagation();
      const file = event.target.elements.namedItem("importFile").files?.[0];
      operate(async () => {
        if (!file) throw Error("Choose a field capture JSON file first.");
        if (file.size > 15 * 1024 * 1024) throw Error("A field capture import must be no more than 15 MiB.");
        const bytes = await fileBytes(file, view);
        let imported; try {imported = JSON.parse(new TextDecoder().decode(bytes));} catch {throw Error("The field capture file must contain valid JSON.");}
        const record = await validateImport(imported, crypto);
        if (await store.get(record.captureId)) throw Error("This capture already exists in this vault. Reopen the saved draft instead.");
        const importedDraft = {id: record.captureId, record, projectId: "", accountId: "", revision: 0, history: [{editedAt: timestamp(), author: record.author, changedFields: ["imported from portable original record"]}], repositoryReceipt: null};
        if (record.consent.retention === "declined") throw Error("This record declines retention and cannot be imported into device storage.");
        if (record.attachments.some(item => item.mediaType.startsWith("audio/")) && record.consent.audio === "declined") throw Error("This record declines audio recording and cannot import an audio file.");
        if (record.attachments.some(item => item.mediaType.startsWith("image/")) && record.consent.photograph === "declined") throw Error("This record declines photographs and cannot import an image file.");
        await store.put(importedDraft); drafts = await store.list();
        announce("Original record imported into the encrypted device vault. Reopen it and review its project destination; no repository save has occurred.");
      });
    }
  };
  const input = event => {
    deviceTimer?.activity();
    if (!event.target.closest("[data-field-form]") || event.target.type === "file" || ["exportConsent","successorReason","locationReason","geometryType","geometryInput","projectRestartReviewed"].includes(event.target.name) || event.target.name?.startsWith("choose_")) return;
    if (event.target.name?.startsWith("share_")) {
      if (event.target.name === "share_confirm") return;
      remember(); disclosurePreview = null;
      if (event.target.name !== "share_reviewed") {disclosureReview.reviewed = false; const reviewed = root.querySelector('[name="share_reviewed"]'); if (reviewed) reviewed.checked = false;}
      root.querySelector('[data-field-disclosure-preview-content]')?.closest('[role="region"]')?.remove();
    } else markDirty();
  };
  const click = event => {
    deviceTimer?.activity();
    const button = event.target.closest("button");
    if (!button || !root.contains(button)) return;
    if (button.hasAttribute("data-field-lock")) return lock();
    if (busy || locked) return;
    if (button.hasAttribute("data-field-kind")) {remember(); current.record.kind = button.dataset.fieldKind; markDirty(); render();}
    else if (button.hasAttribute("data-field-gps")) gps();
    else if (button.hasAttribute("data-field-manual")) {remember(); const lat = current.manualInput.latitude.trim(), lon = current.manualInput.longitude.trim(); const latitude = Number(lat), longitude = Number(lon);try {if (!lat || !lon || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) throw Error("Enter a latitude from −90 to 90 and a longitude from −180 to 180.");applyGeometry({type:"Point",coordinates:[longitude,latitude]});announce("Manual correction applied. Original GPS and every location revision are retained.");}catch(failure){announce(failure.message,true);}render();}
    else if (button.hasAttribute("data-field-no-location") || button.hasAttribute("data-field-geometry-clear")) {remember();try{applyGeometry(null);announce("Current geometry cleared. Original GPS and earlier coordinates remain in the protected original history.");}catch(failure){announce(failure.message,true);}render();}
    else if (button.hasAttribute("data-field-geometry-apply")) {remember();try{let value;try{value=JSON.parse(current.geometryInput);}catch{throw Error("Enter valid GeoJSON geometry or a coordinates array.");}const geometry=normalizeFieldGeometry(Array.isArray(value)?{type:current.geometryType,coordinates:value}:value);if(!geometry)throw Error("Use Clear current geometry to remove a location with its reason retained.");if(geometry.type!==current.geometryType)throw Error("Choose the same geometry type as the supplied GeoJSON.");applyGeometry(geometry);announce("Geometry applied with its original and attributed correction history retained.");}catch(failure){announce(failure.message,true);}render();}
    else if (button.hasAttribute("data-field-remove")) {remember(); current.record.attachments.splice(Number(button.dataset.fieldRemove), 1); markDirty(); render();}
    else if (button.hasAttribute("data-field-project-save")) operate(saveProject);
    else if (button.hasAttribute("data-field-project-review")) operate(reviewProject);
    else if (button.hasAttribute("data-field-project-restart")) {const reviewed=root.querySelector('[name="projectRestartReviewed"]')?.checked;operate(()=>restartProject(reviewed));}
    else if (button.hasAttribute("data-field-export")) {remember(); const confirmed = root.querySelector('[name="exportConsent"]')?.checked; operate(async () => {const control = root.querySelector('[name="exportConsent"]'); if (control) control.checked = confirmed; await exportRecord();});}
    else if (button.hasAttribute("data-field-disclosure-preview")) operate(previewDisclosure);
    else if (button.hasAttribute("data-field-disclosure-download")) {const confirmed = root.querySelector('[name="share_confirm"]')?.checked === true; operate(() => downloadDisclosure(confirmed));}
    else if (button.hasAttribute("data-field-successor")) operate(createSuccessor);
    else if (button.hasAttribute("data-field-commitment-add")) {remember();const consultation = current.record.details?.consultation;if (consultation && consultation.commitments.length < 20) {consultation.commitments.push({description: "", owner: "", dueDate: null});markDirty();render();}else {announce("A consultation supports up to 20 commitments.", true);render();}}
    else if (button.hasAttribute("data-field-link-add")) {remember();const name = button.dataset.fieldLinkAdd, id = root.querySelector(`[name="choose_${name}"]`)?.value;if (Object.hasOwn(additionalFieldLinks, name) && id && linkOptions[name]?.some(item => item.id === id)) {current.record.links[name] = [...new Set([...(current.record.links[name] || []), id])];markDirty();render();}}
    else if (button.hasAttribute("data-field-new")) requestOpen("new");
    else if (button.hasAttribute("data-field-open")) requestOpen(button.dataset.fieldOpen);
    else if (button.hasAttribute("data-field-save-open")) operate(async () => {const next = pendingOpen; await saveDraft(); if (next === "new") {fresh(); pendingOpen = "";} else await openDraft(next);});
    else if (button.hasAttribute("data-field-discard-open")) {const next = pendingOpen; pendingOpen = ""; dirty = false; operate(async () => {if (next === "new") fresh(); else await openDraft(next);});}
    else if (button.hasAttribute("data-field-cancel-open")) {remember(); pendingOpen = ""; render();}
    else if (button.hasAttribute("data-field-delete")) {remember(); deleting = button.dataset.fieldDelete; render();}
    else if (button.hasAttribute("data-field-delete-cancel")) {remember(); deleting = ""; render();}
    else if (button.hasAttribute("data-field-delete-confirm")) operate(async () => {const draft = drafts.find(item => item.id === deleting); if (!draft) return; await store.delete(draft.id, draft.revision); if (current.id === draft.id) {current.revision = 0; current.savedAt = undefined; current.repositoryReceipt = null; lastSaved = null; dirty = true;} deleting = ""; drafts = await store.list(); announce("Encrypted device copy deleted. The current form, exports, and any project repository copy are not deleted.");});
  };
  const activity = () => deviceTimer?.activity();
  const visibility = () => {if (document.visibilityState === "hidden") lock();};
  const beforeUnload = event => {if (dirty) {event.preventDefault(); event.returnValue = "";}};
  root.addEventListener("submit", submit); root.addEventListener("input", input); root.addEventListener("click", click);root.addEventListener("keydown",activity);
  document.addEventListener("visibilitychange", visibility); view.addEventListener("beforeunload", beforeUnload);
  const ready = (async () => {try {initialized = await store.isInitialized(); announce(initialized ? "Unlock to access encrypted device drafts." : "Create a passphrase to protect drafts saved in this browser.");} catch (failure) {announce(failure.message, true);} render();})();
  render();
  const dispose = () => {if (disposed) return; disposed = true; gpsToken++; session++;linkOptions={};deviceTimer?.stop();root.removeEventListener("keydown",activity); root.removeEventListener("submit", submit); root.removeEventListener("input", input); root.removeEventListener("click", click); document.removeEventListener("visibilitychange", visibility); view.removeEventListener("beforeunload", beforeUnload); for (const url of urls) view.URL.revokeObjectURL(url); pendingFiles.length = 0; store.lock(); Promise.resolve(store.close?.()).catch(() => {}); drafts = []; current = null; lastSaved = null; root.replaceChildren();};
  invalidation?.then(dispose);
  // Mission tools switch the current capture without creating a second record
  // or discarding unsaved notes, attachments or inherited source context.
  const sameMission=()=>["engagementId","programId","cycleId","missionId"].every(key=>!context[key]||current.record?.links.context?.[key]===String(context[key]));
  const selectKind = kind => {if(disposed||locked||busy||!kinds.includes(kind)||!sameMission())return false;remember();current.record.kind=kind;markDirty();render();return true;};
  const appendNote = note => {if(disposed||locked||busy||typeof note!=="string"||!sameMission())return false;remember();const combined=[current.record.note,note].filter(Boolean).join("\n\n");if(combined.length>16000)return false;current.record.note=combined;markDirty();render();return true;};
  // An explicitly unlocked DD/mission context may prepare labels before the
  // separate draft vault unlock. Locked rendering exposes none of them; lock
  // and disposal clear the staged copy. These choices never grant authority.
  const updateLinkOptions = next => {if (disposed) return false;const prepared=preparedLinkOptions(next);if(!locked)remember();linkOptions=prepared;render();return true;};
  const configureDevicePolicy = async next => {
    projectSaveReview=null;deviceContext=next?clone(next):null;session++;deviceTimer?.stop();deviceTimer=null;
    try{await store.configureDevicePolicy?.(deviceContext);await checkDevicePolicy(current?.record);if(current?.record&&deviceContext?.policy!==undefined)current.devicePolicyContext=clone(deviceContext);armDeviceTimer();return true;}
    catch(error){lock(error.message);throw error;}
  };
  return {ready, dispose, hasUnsavedChanges: () => dirty, lock, selectKind, appendNote, updateLinkOptions, configureDevicePolicy};
}
