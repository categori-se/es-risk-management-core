import {conceptTags, normalizeTags} from "../lib/concept-tags.js";
import {catalogMetadataFields, spatialMetadataFields, readCatalogMetadata} from "../lib/source-metadata.js";
import {mountSpatialPreview} from "./spatial-preview.js";
import {documentProfileFromMetadata,canonicalDocumentValue} from "../lib/document-classification.js";

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_QUEUE = 10;
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character =>
  ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const selected = (actual, expected) => actual === expected ? " selected" : "";
const humanSize = size => size < 1024 ? `${size} bytes` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KiB` : `${(size / 1024 / 1024).toFixed(2)} MiB`;
const validAccountId = value => /^(?:local-default|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/.test(value);
let sequence = 0;

/** Shared by initial review and later correction forms. Values are always inert. */
export function metadataFields(metadata = {}, {idPrefix = "source-metadata", suggestions = false,classificationScope="",requirementChoices=[]} = {}) {
  const h = escapeHtml, id = h(idPrefix);
  const classification=metadata.classification,own=Boolean(classification&&classification.engagementId===classificationScope),reviewed=classification?.reviewedProfile;
  const status=classification?.status==="suggested"?"AI-suggested; not accepted":reviewed&&canonicalDocumentValue(documentProfileFromMetadata(metadata,reviewed.requirementIds))!==canonicalDocumentValue(reviewed)?"Earlier review; descriptive fields changed since that decision":String(classification?.status||"").replaceAll("_"," ");
  if(own&&classification.status==="suggested"){const proposal=classification.proposal;metadata={...metadata,...proposal,title:proposal.title||metadata.title,tags:proposal.topics.map(label=>({label}))};}
  return `<div class="si-fields">
    ${classification?`<section class="si-wide" data-document-classification-review><h4>Document classification review</h4><p>${h(status)} · engagement ${h(classification.engagementId)} · exact version ${h(classification.sourceVersionId)} · SHA256 <code>${h(classification.sourceSha256)}</code>.</p><p>Suggested by ${h(classification.provenance.model||classification.provenance.method)}. Original intake fields and earlier classification decisions remain in metadata history.</p>${own?`<p>Review the proposed document fields below against the exact original. They become effective metadata only when you explicitly save this review.</p><fieldset><legend>Requirements addressed by this document</legend>${requirementChoices.map(item=>`<label><input type="checkbox" name="classificationRequirementIds" value="${h(item.id)}"${(classification.reviewedProfile||classification.proposal).requirementIds.includes(item.id)?" checked":""}><span>${h(item.label||item.id)}</span></label>`).join("")||"<p>No requirements configured in this engagement.</p>"}</fieldset><label><span>Document classification review statement</span><textarea name="classificationReviewStatement" rows="2" maxlength="12000" required></textarea></label><label><input type="checkbox" name="classificationReviewed" required><span>I checked the exact original, proposed fields, omissions and requirement links. Save my confirmation or corrections.</span></label>`:"<p>This classification belongs to another engagement or is outside this editor’s review context. It does not establish a classification decision for the current engagement. Open its owning engagement to review it.</p>"}</section>`:""}
    <label class="si-wide"><span>Document title</span><input name="title" maxlength="2000" required value="${h(metadata.title)}"></label>
    <label class="si-wide"><span>Authors / organisations (one per line)</span><textarea name="authors" rows="2" maxlength="25000">${h((metadata.authors || []).join("\n"))}</textarea></label>
    <label><span>Document / publication date</span><input name="documentDate" maxlength="64" placeholder="YYYY-MM-DD; leave blank if unknown" value="${h(metadata.documentDate)}"><small>Confirm the document date; file creation is a separate property.</small></label>
    <label><span>Language</span><input name="language" maxlength="100" placeholder="For example, en or fr" value="${h(metadata.language)}"></label>
    <label class="si-wide"><span>Description</span><textarea name="description" rows="3" maxlength="16000">${h(metadata.description)}</textarea></label>
    <label class="si-wide"><span>Concept tags</span><input name="tags" maxlength="4000" value="${h((metadata.tags || []).map(tag => typeof tag === "string" ? tag : tag.label).join(", "))}" list="${id}-tags" aria-describedby="${id}-tag-help"><small id="${id}-tag-help">Separate up to 20 tags with commas. Choose suggested concepts or add your own. Tags organise sources; they do not establish policy applicability.</small></label>
    ${[["locations","Locations covered"],["projectComponents","Project components covered"]].map(([name,label])=>`<label class="si-wide"><span>${label} (one per line)</span><textarea name="${name}" rows="2" maxlength="30000">${h((metadata[name]||[]).join("\n"))}</textarea></label>`).join("")}
    <datalist id="${id}-tags">${conceptTags.map(tag => `<option value="${h(tag.label)}">${h(tag.kind)}</option>`).join("")}</datalist>
    <details class="si-wide"><summary>Publication, reference and rights details</summary><div class="si-fields">${catalogMetadataFields.map(([name, label, maximum]) => `<label${name === "rights" ? ' class="si-wide"' : ""}><span>${h(label)}</span><input name="${name}" maxlength="${maximum}"${name === "sourceUrl" ? ' type="url"' : ""} value="${h(metadata[name])}"></label>`).join("")}<p class="si-note si-wide">Leave unknown fields blank. Publisher, document rights and the account custodian may be different parties. A licence label does not grant permission.</p></div></details>
    <details class="si-wide"><summary>Spatial source context (when applicable)</summary><div class="si-fields">${spatialMetadataFields.map(([name, label, maximum]) => `<label class="si-wide"><span>${h(label)}</span><${name === "sourceDate" || name === "crs" ? "input" : 'textarea rows="2"'} name="spatial_${name}" maxlength="${maximum}"${name === "sourceDate" || name === "crs" ? ` value="${h(metadata.spatial?.[name])}">` : `>${h(metadata.spatial?.[name])}</textarea>`}</label>`).join("")}<p class="si-note si-wide">Record the source CRS and any known transformations. Editing a CRS label does not reproject coordinates.</p></div></details>
    ${suggestions ? `<div class="si-tag-options si-wide" role="group" aria-label="Suggested concept tags">${conceptTags.map(tag => `<button type="button" data-intake-tag="${h(tag.id)}" aria-pressed="false">${h(tag.label)}</button>`).join("")}</div><p class="si-tag-count si-wide" data-intake-tag-count aria-live="polite"></p>` : ""}
  </div>`;
}

/** Read only editable descriptive fields; retain extraction provenance separately. */
export function readMetadata(form, baseMetadata = {}) {
  const data = new form.ownerDocument.defaultView.FormData(form);
  const metadata=metadataFromValues(name => String(data.get(name) ?? "").trim(), baseMetadata);
  if(form.elements.namedItem("classificationReviewed")){if(!data.get("classificationReviewed"))throw Error("Explicitly confirm that you reviewed this document classification before saving.");const statement=String(data.get("classificationReviewStatement")||"").trim();if(!statement)throw Error("Record a substantive document classification review statement.");metadata.classificationReview={statement,requirementIds:data.getAll("classificationRequirementIds").map(String)};}
  return metadata;
}

function metadataFromValues(value, baseMetadata) {
  const title = value("title");
  if (!title) throw new Error("Enter a document title before saving.");
  const authors = value("authors").split(/\r?\n/).map(author => author.trim()).filter(Boolean);
  if (authors.length > 50 || authors.some(author => author.length > 500)) throw new Error("Use up to 50 authors, each at most 500 characters.");
  const tags = normalizeTags(value("tags"));
  if (tags.length > 20) throw new Error("Use up to 20 distinct concept tags.");
  const documentDate = value("documentDate");
  if (documentDate) {
    const day = documentDate.slice(0, 10);
    if (!/^\d{4}-\d\d-\d\d(?:$|T\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$)/.test(documentDate) ||
        !Number.isFinite(Date.parse(documentDate)) || !Number.isFinite(Date.parse(day)) ||
        new Date(day).toISOString().slice(0, 10) !== day) {
      throw new Error("Use a valid ISO document date or leave it blank when unknown.");
    }
  }
  return {title, authors, documentDate, language: value("language"), description: value("description"), tags, ...readCatalogMetadata(value, baseMetadata),
    receivedVia: baseMetadata.receivedVia || "file_upload",
    extraction: structuredClone(baseMetadata.extraction || {method: "manual", status: "unavailable", warnings: []})};
}

async function fileBase64(file, view) {
  if (typeof file.arrayBuffer === "function") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return view.btoa(binary);
  }
  return new Promise((resolve, reject) => {
    const reader = new view.FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.readAsDataURL(file);
  });
}

/** Stage originals in memory, review their metadata, then explicitly save. */
export function mountSourceIntake(root, {request, save, getProject, getAccountId, onBusyChange, captureUrl = "", captureBaseUrl, capturePublicUrls = true, invalidation, state = {}} = {}) {
  if (!root || typeof root.addEventListener !== "function" || ![request, save, getProject].every(value => typeof value === "function")) {
    throw new TypeError("Source intake requires a root, request, save and getProject.");
  }
  const view = root.ownerDocument.defaultView;
  state.queue ??= [];
  state.activeId ??= state.queue[0]?.id || "";
  state.captureUrl ??= captureUrl;
  state.receivedVia ??= "file_upload";
  state.message ??= "Sources are staged on this page until you review and save them.";
  state.error ??= false;
  state.commonTags ??= "";
  let disposed = false;
  let renderedItemId = "", spatialMount;
  const idPrefix = `source-intake-${++sequence}`;
  const active = () => state.queue.find(item => item.id === state.activeId);
  const accountId = () => String(getAccountId?.() ?? state.accountId ?? getProject()?.accountId ?? "");
  const localOrigin = /^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(view.location.origin) ? view.location.origin : "";
  const bookmarkAccount = validAccountId(accountId()) ? accountId() : "local-default";
  let capturePrefix = `${localOrigin}/?${new URLSearchParams({account: bookmarkAccount})}&capture=`;
  if (captureBaseUrl !== undefined) {
    let destination;try {destination = new URL(captureBaseUrl, view.location.origin);} catch {throw new TypeError("Use a local capture destination URL.");}
    if (!localOrigin || destination.origin !== localOrigin || destination.username || destination.password || destination.hash || destination.searchParams.has("capture")) throw new TypeError("The capture destination must stay on this local workbench and preserve its project context.");
    capturePrefix = `${destination.href}${destination.search ? "&" : "?"}capture=`;
  }
  const bookmarklet = capturePublicUrls && localOrigin ? `javascript:${encodeURIComponent(`window.open(${JSON.stringify(capturePrefix)}+encodeURIComponent(location.href),"_blank","noopener");void 0;`)}` : "";
  for (const item of state.queue) item.accountId ??= accountId();
  const isBound = item => getProject()?.id === item.projectId && accountId() === item.accountId;
  const notify = () => state._render?.();
  const announce = (message, error = false) => {state.message = message; state.error = error;};
  const pending = () => Boolean(state.processing || state.saving);
  const setPending = (key, value) => {state[key] = value; state._onBusyChange?.(pending());};
  const readyItems = () => state.queue.filter(item => item.status === "ready" && item.staged);
  const reviewedItems = () => readyItems().filter(item => item.reviewed);
  const additionalFieldNames = [...catalogMetadataFields.map(([name]) => name),"locations","projectComponents", ...spatialMetadataFields.map(([name]) => `spatial_${name}`)];
  const itemFields = item => ({title: item.staged?.metadata.title || "", authors: (item.staged?.metadata.authors || []).join("\n"),
    documentDate: item.staged?.metadata.documentDate || "", language: item.staged?.metadata.language || "", description: item.staged?.metadata.description || "",
    ...Object.fromEntries(catalogMetadataFields.map(([name]) => [name, item.staged?.metadata[name] || ""])),
    ...Object.fromEntries(["locations","projectComponents"].map(name=>[name,(item.staged?.metadata[name]||[]).join("\n")])),
    ...Object.fromEntries(spatialMetadataFields.map(([name]) => [`spatial_${name}`, item.staged?.metadata.spatial?.[name] || ""])),
    tags: (item.staged?.metadata.tags || []).map(tag => typeof tag === "string" ? tag : tag.label).join(", "), resourceId: "", ...item.fields});
  const itemMetadata = item => {
    const fields = itemFields(item);
    return metadataFromValues(name => String(fields[name] ?? "").trim(), item.staged.metadata);
  };

  function remember(form, item = state.queue.find(candidate => candidate.id === renderedItemId), invalidateReview = false) {
    if (!form || !item?.staged) return;
    // Disabled controls are omitted by FormData during a parent rerender. Read
    // values directly so in-flight saves cannot erase the retained draft.
    item.fields = Object.fromEntries(["title", "authors", "documentDate", "language", "description", "tags", "resourceId", ...additionalFieldNames].map(name => [name, String(form.elements.namedItem(name)?.value || "")]));
    item.reviewed = !invalidateReview && Boolean(form.elements.namedItem("reviewed")?.checked);
    if (invalidateReview) form.elements.namedItem("reviewed").checked = false;
  }

  function restore(form, item) {
    if (!form) return;
    for (const [name, value] of Object.entries(item.fields || {})) {
      const control = form.elements.namedItem(name);
      if (control) control.value = value;
    }
    form.elements.namedItem("reviewed").checked = Boolean(item.reviewed);
    updateTags(form);
  }

  function updateTags(form) {
    const input = form.elements.namedItem("tags");
    if (!input) return;
    let tags = [];
    try { tags = normalizeTags(input.value); } catch {}
    for (const button of form.querySelectorAll("[data-intake-tag]")) button.setAttribute("aria-pressed", String(tags.some(tag => tag.id === button.dataset.intakeTag)));
    const count = form.querySelector("[data-intake-tag-count]");
    if (count) count.textContent = `${tags.length} concept ${tags.length === 1 ? "tag" : "tags"}; maximum 20.`;
  }

  function overviewMarkup(project) {
    const h = escapeHtml;
    return `<div class="si-table-region" role="region" aria-label="Staged file metadata and review confirmations; scroll horizontally on narrow screens" tabindex="0"><table class="si-batch-table"><caption>Review each file's metadata and tags. Inspect / edit opens its full preview and correction form.</caption><thead><tr><th scope="col">Source / status</th><th scope="col">Metadata to save</th><th scope="col">Tags / destination</th><th scope="col">Review confirmation</th></tr></thead><tbody>${state.queue.map(item => {
      const fields = itemFields(item), staged = item.staged;
      const ready = item.status === "ready" && staged;
      const resource = (project?.resources || []).find(resource => resource.id === fields.resourceId);
      const status = item.status === "error" ? "Inspection failed" : item.status !== "ready" ? "Inspecting…" : item.saveError ? "Save failed; retained for retry" : item.reviewed ? "Reviewed; ready to save" : "Needs metadata review";
      return `<tr data-intake-row="${h(item.id)}"><th scope="row"><strong>${h(staged?.filename || item.name)}</strong><p class="si-row-status${item.status === "error" || item.saveError ? " si-error" : ""}">${h(status)}</p>${staged ? `<p>${h(staged.mediaType)} · ${h(humanSize(staged.size))}</p><p class="si-hash">SHA256 <code>${h(staged.sha256)}</code></p>` : ""}${item.error || item.saveError ? `<p class="si-error">${h(item.error || item.saveError)}</p>` : ""}<button type="button" data-intake-select="${h(item.id)}" aria-current="${item.id === state.activeId ? "true" : "false"}">Inspect / edit<span class="si-visually-hidden"> ${h(staged?.filename || item.name)}</span></button></th>
        <td>${ready ? `<dl class="si-row-metadata"><dt>Title</dt><dd>${h(fields.title || "Not recorded")}</dd><dt>Authors / organisations</dt><dd>${h(fields.authors || "Not recorded")}</dd><dt>Document date</dt><dd>${h(fields.documentDate || "Unknown")}</dd><dt>Language</dt><dd>${h(fields.language || "Not recorded")}</dd><dt>Description</dt><dd>${h(fields.description || "Not recorded")}</dd><dt>Received via</dt><dd>${h(staged.metadata.receivedVia.replaceAll("_", " "))}</dd>${staged.source ? `<dt>Original URL</dt><dd>${h(staged.source.originalUrl)}</dd><dt>Final URL</dt><dd>${h(staged.source.finalUrl || staged.source.originalUrl)}</dd><dt>Capture time / method</dt><dd>${h(staged.source.capturedAt)} · ${h(staged.source.method)}</dd><dt>Capture result</dt><dd>${h(staged.source.result)}</dd>` : ""}${staged.detected?.pageCount ? `<dt>PDF pages</dt><dd>${h(staged.detected.pageCount)}</dd>` : ""}${staged.detected?.createdAt ? `<dt>PDF creation</dt><dd>${h(staged.detected.createdAt)}; not a verified publication date</dd>` : ""}${staged.detected?.modifiedAt ? `<dt>PDF modification</dt><dd>${h(staged.detected.modifiedAt)}; not a verified publication date</dd>` : ""}</dl>${staged.metadata.extraction?.warnings?.length ? `<ul class="si-warnings">${staged.metadata.extraction.warnings.map(warning => `<li>${h(warning)}</li>`).join("")}</ul>` : ""}` : '<p>Inspection must finish successfully before this file can be reviewed or saved.</p>'}</td>
        <td>${ready ? `<dl class="si-row-metadata"><dt>Concept tags</dt><dd>${h(fields.tags || "None selected")}</dd><dt>Save as</dt><dd>${h(fields.resourceId ? resource ? `New version of ${resource.title}` : "Selected resource unavailable; choose again" : "New resource")}</dd></dl>` : "—"}</td>
        <td><label class="si-row-confirm"><input type="checkbox" data-intake-reviewed="${h(item.id)}"${item.reviewed ? " checked" : ""}${!ready || pending() || !isBound(item) ? " disabled" : ""}><span>I reviewed this file's metadata and tags.<span class="si-visually-hidden"> ${h(staged?.filename || item.name)}</span></span></label>${ready && !isBound(item) ? '<p class="si-error">Return to the account and project used to stage this file.</p>' : ""}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function queueMarkup(project) {
    const reviewed = reviewedItems().length;
    return `<section class="si-queue" aria-labelledby="${idPrefix}-batch-heading"><h3 id="${idPrefix}-batch-heading" data-intake-batch-heading tabindex="-1">Staged files</h3><p data-intake-batch-count>${state.queue.length} staged · ${readyItems().length} inspected · ${reviewed} reviewed · not yet saved</p><p class="si-note">Confirm each file after checking the metadata below or using Inspect / edit. Inspection never confirms a review. Editing metadata or applying new tags clears that file's confirmation.</p>
      <form data-intake-form="batch-tags" class="si-common-tags"><label><span>Add common tags to all currently inspected files</span><input name="commonTags" maxlength="4000" value="${escapeHtml(state.commonTags)}" list="${idPrefix}-common-tags"><small>Existing tags are preserved; each file can have up to 20 distinct tags. Files still inspecting or with failed inspection are unchanged.</small></label><datalist id="${idPrefix}-common-tags">${conceptTags.map(tag => `<option value="${escapeHtml(tag.label)}"></option>`).join("")}</datalist><button type="submit"${!readyItems().length ? " disabled" : ""}>Apply common tags</button></form>
      <div data-intake-overview>${overviewMarkup(project)}</div><div class="si-batch-actions"><button type="button" data-intake-action="save-batch"${pending() || !reviewed || reviewedItems().some(item => !isBound(item)) ? " disabled" : ""}>Save reviewed files (${reviewed})</button><p class="si-note">Saves reviewed files one at a time. Unreviewed and failed files stay staged. Saving stops at the first error.</p></div>${state.batchProgress ? `<p class="si-batch-progress" data-intake-progress role="status">${escapeHtml(state.batchProgress.completed)} of ${escapeHtml(state.batchProgress.total)} reviewed files saved${state.batchProgress.stopped ? "; stopped — remaining files are staged" : pending() ? "; saving…" : "."}</p>` : ""}</section>`;
  }

  function updateOverview() {
    const overview = root.querySelector("[data-intake-overview]");
    if (!overview) return;
    overview.innerHTML = overviewMarkup(getProject());
    const reviewed = reviewedItems().length;
    root.querySelector("[data-intake-batch-count]").textContent = `${state.queue.length} staged · ${readyItems().length} inspected · ${reviewed} reviewed · not yet saved`;
    const saveButton = root.querySelector('[data-intake-action="save-batch"]');
    saveButton.textContent = `Save reviewed files (${reviewed})`;
    saveButton.disabled = pending() || !reviewed || reviewedItems().some(item => !isBound(item));
  }

  function render() {
    if (disposed) return;
    remember(root.querySelector('[data-intake-form="review"]'));
    spatialMount?.dispose();
    const item = active(), h = escapeHtml, project = getProject();
    const busy = Boolean(state.processing || state.saving);
    root.classList.add("source-intake");
    root.setAttribute("aria-busy", String(busy));
    root.innerHTML = `<div class="si-heading"><h2>Add sources</h2><p>${capturePublicUrls ? 'Upload a client file or email attachment, or capture a webpage/PDF.' : 'Upload a client file or email attachment.'} Review the metadata, then save.</p></div>
      <p class="si-status${state.error ? " si-error" : ""}" data-intake-status role="${state.error ? "alert" : "status"}">${h(state.message)}</p>
      <div class="si-acquire">
        <form data-intake-form="files" class="si-drop" data-intake-drop>
          <h3>File or email attachment</h3><label><span>Received via</span><select name="receivedVia"><option value="file_upload"${selected(state.receivedVia, "file_upload")}>Local file</option><option value="email_attachment"${selected(state.receivedVia, "email_attachment")}>Email attachment</option></select></label>
          <label><span>Choose files, or drop them here</span><input type="file" name="files" multiple required><small>Save attachments from your email client first. Up to 16 MiB per file; review up to 10 sources at a time.</small></label>
          <button type="submit">Review selected files</button>
        </form>
        ${capturePublicUrls ? `<form data-intake-form="url" class="si-url"><h3>Webpage or PDF URL</h3>
          <label><span>Public source URL</span><input type="url" name="url" required maxlength="4000" placeholder="https://…" value="${h(state.captureUrl)}"></label>
          <p class="si-note">Captures the original response. Saved HTML can be incomplete: external images, scripts and browser sessions are not preserved.</p>
          <button type="submit">Capture for review</button>
        </form>` : ''}
      </div>
      ${bookmarklet ? `<details class="si-browser-button"><summary>Capture from your browser</summary><p>Drag <a href="${h(bookmarklet)}" draggable="true" data-intake-bookmarklet>Capture in E&amp;S workspace</a> to your bookmarks bar. While viewing a public webpage or PDF, click that bookmark to open its URL here.</p><p class="si-note">Keep the local workspace running at ${h(localOrigin)}. The browser button prefills the URL; choose Capture for review to retrieve the source, then review and save it.</p></details>` : ""}
      ${state.queue.length ? queueMarkup(project) : ""}
      ${item ? `<section class="si-review" aria-labelledby="${idPrefix}-review-heading"><div class="si-review-heading"><h3 id="${idPrefix}-review-heading" tabindex="-1">Review ${h(item.staged?.filename || item.name)}</h3><button type="button" data-intake-action="discard">Discard staged source</button></div>
        ${item.status === "error" ? `<p class="si-error" role="alert">${h(item.error)}</p><p>Correct the source or choose another file. Nothing from this item has been saved.</p>` : item.staged ? reviewMarkup(item, project) : '<p role="status">Reading and inspecting the source…</p>'}
      </section>` : ""}`;
    for (const control of root.querySelectorAll("input,select,textarea,button")) {
      if (busy) control.disabled = true;
    }
    const review = root.querySelector('[data-intake-form="review"]');
    renderedItemId = item?.id || "";
    restore(review, item);
    if (review) {
      for (const control of review.querySelectorAll("input,select,textarea,button")) control.disabled = busy;
      review.querySelector('button[type="submit"]').disabled = busy || !project || !isBound(item);
    }
    if (item?.staged?.spatial) spatialMount = mountSpatialPreview(root.querySelector("[data-intake-spatial]"), item.staged.spatial);
  }

  function reviewMarkup(item, project) {
    const staged = item.staged, h = escapeHtml;
    const source = staged.source;
    const resourceId = itemFields(item).resourceId;
    const missingResource = resourceId && !(project?.resources || []).some(resource => resource.id === resourceId);
    const warnings = staged.metadata.extraction?.warnings || [];
    return `<dl class="si-properties"><dt>Filename</dt><dd>${h(staged.filename)}</dd><dt>Type / size</dt><dd>${h(staged.mediaType)} · ${h(humanSize(staged.size))}</dd><dt>SHA256</dt><dd><code>${h(staged.sha256)}</code></dd>
      <dt>Received via</dt><dd>${h(staged.metadata.receivedVia.replaceAll("_", " "))}</dd>
      ${source ? `<dt>Source URL</dt><dd>${h(source.originalUrl)}</dd><dt>Final URL</dt><dd>${h(source.finalUrl || source.originalUrl)}</dd><dt>Capture time</dt><dd>${h(source.capturedAt)}</dd><dt>Capture result</dt><dd>${h(source.result)}</dd>` : ""}
      ${staged.detected?.pageCount ? `<dt>PDF pages</dt><dd>${h(staged.detected.pageCount)}</dd>` : ""}
      ${staged.detected?.createdAt ? `<dt>Detected PDF creation</dt><dd>${h(staged.detected.createdAt)} · not a verified publication date</dd>` : ""}
      ${staged.detected?.modifiedAt ? `<dt>Detected PDF modification</dt><dd>${h(staged.detected.modifiedAt)} · not a verified publication date</dd>` : ""}</dl>
      ${warnings.length ? `<ul class="si-warnings">${warnings.map(warning => `<li>${h(warning)}</li>`).join("")}</ul>` : ""}
      <details class="si-preview"><summary>Inspect extracted text preview</summary><pre>${h(staged.preview || "No text preview is available. Inspect the original document before confirming its metadata.")}</pre></details>
      ${staged.spatial ? '<div data-intake-spatial></div>' : ""}
      <form data-intake-form="review" class="si-metadata">
        <label><span>Save as</span><select name="resourceId"><option value="">New resource</option>${missingResource ? `<option value="${h(resourceId)}">Unavailable resource — choose a destination again</option>` : ""}${(project?.resources || []).map(resource => `<option value="${h(resource.id)}">New version of ${h(resource.title)}</option>`).join("")}</select></label>
        ${metadataFields(staged.metadata, {idPrefix, suggestions: true})}
        <label class="si-confirm"><input type="checkbox" name="reviewed" required><span>I have reviewed the metadata and selected tags.</span></label>
        <p class="si-note">Saving captures a managed original in this project. Duplicate bytes within an existing resource keep its earlier metadata; use an explicit metadata correction after save to change it.</p>
        ${!isBound(item) ? '<p class="si-error">Open the account and project used to stage this source before saving it.</p>' : ""}
        <button type="submit">Save reviewed source</button>
      </form>`;
  }

  function focusReview() {
    const currentRoot = state._root;
    const target = currentRoot?.querySelector(".si-review-heading h3") || currentRoot?.querySelector("[data-intake-batch-heading]") || currentRoot?.querySelector("[data-intake-status]");
    if (target) {target.tabIndex = -1; target.focus({preventScroll: true});}
  }

  function stagedResult(result) {
    if (!result || typeof result.contentBase64 !== "string" || !result.metadata || !Number.isSafeInteger(result.size) ||
        result.size < 0 || result.size > MAX_BYTES || !/^[a-f0-9]{64}$/.test(result.sha256)) {
      throw new Error("The local service returned an incomplete source inspection. Nothing was saved.");
    }
    return result;
  }

  function confirmReview(item, checked) {
    if (!item?.staged || item.status !== "ready" || pending()) return;
    remember(root.querySelector('[data-intake-form="review"]'));
    try {
      if (checked) {
        if (!isBound(item)) throw new Error("Open the account and project used to stage this source before reviewing it.");
        itemMetadata(item);
      }
      item.reviewed = checked;
      if (item.id === renderedItemId) root.querySelector('[data-intake-form="review"]').elements.namedItem("reviewed").checked = checked;
    } catch (error) {item.reviewed = false; announce(error.message, true);}
    notify();
    state._root?.querySelector(`[data-intake-reviewed="${item.id}"]`)?.focus({preventScroll: true});
  }

  function applyCommonTags(form) {
    if (pending()) return;
    remember(root.querySelector('[data-intake-form="review"]'));
    state.commonTags = form.elements.namedItem("commonTags").value;
    try {
      const common = normalizeTags(state.commonTags), items = readyItems();
      if (!common.length) throw new Error("Enter at least one common tag to add.");
      if (!items.length) throw new Error("Inspect at least one file before applying common tags.");
      if (items.some(item => !isBound(item))) throw new Error("Return to the account and project used to stage these sources before changing their tags.");
      const changes = items.map(item => {
        const fields = itemFields(item), previous = normalizeTags(fields.tags), tags = normalizeTags([...previous, ...common]);
        if (tags.length > 20) throw new Error(`${fields.title || item.name} would have more than 20 distinct tags. No files were changed.`);
        return {item, fields, tags, changed: JSON.stringify(previous) !== JSON.stringify(tags)};
      });
      let changed = 0;
      for (const change of changes) {
        change.item.fields = {...change.fields, tags: change.tags.map(tag => tag.label).join(", ")};
        if (change.changed) {change.item.reviewed = false; changed++;}
      }
      restore(root.querySelector('[data-intake-form="review"]'), active());
      announce(`Applied common tags to ${items.length} inspected ${items.length === 1 ? "file" : "files"}. ${changed} ${changed === 1 ? "file needs" : "files need"} metadata review after the change.`);
    } catch (error) {announce(error.message || "Common tags could not be applied. No files were changed.", true);}
    notify();
    state._root?.querySelector('[data-intake-form="batch-tags"] input')?.focus({preventScroll: true});
  }

  async function inspectFiles(files, receivedVia) {
    if (state.processing || state.saving) return;
    const project = getProject();
    if (!project) {announce("Open or create a project before adding sources.", true); notify(); return;}
    if (!files.length) {announce("Choose at least one file to review.", true); notify(); return;}
    if (state.queue.length + files.length > MAX_QUEUE) {announce("Review or discard staged sources before adding more than 10 files.", true); notify(); return;}
    const boundAccountId = accountId();
    state.batchProgress = null;
    setPending("processing", true);
    let failures = 0;
    for (const file of files) {
      const item = {id: `staged-${++sequence}`, name: file.name, projectId: project.id, accountId: boundAccountId, status: "inspecting", reviewed: false};
      state.queue.push(item); state.activeId = item.id;
      announce(`Inspecting ${file.name}…`); notify();
      try {
        if (file.size > MAX_BYTES) throw new Error("This file exceeds 16 MiB. Choose a smaller original.");
        const contentBase64 = await fileBase64(file, view);
        if (!isBound(item)) throw new Error("The account or project changed while reading this source. Return to its original project before continuing.");
        item.staged = stagedResult(await request("/api/intake/inspect", {method: "POST", body: {
          filename: file.name, contentBase64, mediaType: file.type || "application/octet-stream", receivedVia
        }}));
        item.status = "ready";
      } catch (error) {item.status = "error"; item.error = error.message || "The source could not be inspected."; failures++;}
      notify();
    }
    setPending("processing", false);
    announce(failures ? `${failures} source inspection${failures === 1 ? "" : "s"} failed. Review the staged items; nothing has been saved.` : "Inspection complete. Review the metadata before saving.", Boolean(failures));
    notify(); focusReview();
  }

  async function capture(url) {
    if (!capturePublicUrls) {announce('Choose a local file or email attachment in this workspace.', true);notify();return;}
    if (state.processing || state.saving) return;
    const project = getProject();
    if (!project) {announce("Open or create a project before capturing a source.", true); notify(); return;}
    if (state.queue.length >= MAX_QUEUE) {announce("Review or discard staged sources before adding more than 10.", true); notify(); return;}
    let parsed;
    try {parsed = new URL(url);} catch {announce("Enter a complete http:// or https:// URL.", true); notify(); return;}
    if (!["http:", "https:"].includes(parsed.protocol)) {announce("Capture accepts HTTP(S) sources.", true); notify(); return;}
    const item = {id: `staged-${++sequence}`, name: "Web capture", projectId: project.id, accountId: accountId(), status: "inspecting", reviewed: false};
    state.batchProgress = null;
    state.queue.push(item); state.activeId = item.id; setPending("processing", true);
    announce("Capturing source bytes for metadata review…"); notify();
    try {
      item.staged = stagedResult(await request("/api/intake/capture", {method: "POST", body: {url}}));
      item.name = item.staged.filename; item.status = "ready";
      announce("Capture is staged. Check its limitations and metadata before saving.");
    } catch (error) {item.status = "error"; item.error = error.message || "The source could not be captured."; announce(item.error, true);}
    finally {setPending("processing", false); notify(); focusReview();}
  }

  function intakeCommand(item) {
    if (!item?.staged || item.status !== "ready" || !item.reviewed) throw new Error("Confirm that you reviewed the source metadata before saving.");
    if (!isBound(item)) throw new Error("Open the account and project used to stage this source before saving it.");
    const metadata = itemMetadata(item), resourceId = itemFields(item).resourceId, staged = item.staged;
    if (resourceId && !(getProject().resources || []).some(resource => resource.id === resourceId)) throw new Error("The selected resource is no longer available. Choose the destination again.");
    return {type: "intake", mode: "managed", title: metadata.title, filename: staged.filename,
      contentBase64: staged.contentBase64, mediaType: staged.mediaType, intakeMetadata: metadata,
      ...(staged.source ? {source: structuredClone(staged.source)} : {}), ...(resourceId ? {resourceId} : {})};
  }

  async function saveItems(items, batch = false) {
    if (pending()) return;
    if (!items.length) {announce("Review and confirm at least one inspected file before saving.", true); notify(); return;}
    const ids = items.map(item => item.id), progress = {completed: 0, total: ids.length, stopped: false};
    state.batchProgress = batch ? progress : null;
    setPending("saving", true);
    let current;
    try {
      for (const id of ids) {
        current = state.queue.find(item => item.id === id);
        const command = intakeCommand(current);
        delete current.saveError;
        announce(batch ? `Saving reviewed files: ${progress.completed} of ${progress.total} saved; saving ${command.title}…` : "Saving the reviewed source…"); notify();
        await save(command);
        // A resolved save confirms this command. Remove it before the next
        // command or parent remount so retries cannot repeat confirmed items.
        state.queue = state.queue.filter(item => item.id !== id);
        if (!state.queue.some(item => item.id === state.activeId)) state.activeId = state.queue[0]?.id || "";
        progress.completed++;
        announce(batch ? `Saved ${progress.completed} of ${progress.total} reviewed files. ${state.queue.length} files remain staged.` : `Saved ${command.title}.`); notify();
      }
    } catch (error) {
      progress.stopped = true;
      const message = error.message || "The source could not be saved.";
      if (current) current.saveError = message;
      announce(batch ? `Saved ${progress.completed} of ${progress.total} reviewed files. Stopped${current ? ` at ${itemFields(current).title || current.name}` : ""}: ${message} Remaining files and their reviews are staged; retry when the problem is resolved.` : message, true);
    } finally {
      setPending("saving", false); notify(); focusReview();
    }
  }

  async function saveReviewed(form) {
    const item = active();
    if (!item?.staged || pending()) return;
    remember(form, item);
    await saveItems([item]);
  }

  async function saveBatch() {
    if (pending()) return;
    remember(root.querySelector('[data-intake-form="review"]'));
    await saveItems(reviewedItems(), true);
  }

  const onSubmit = event => {
    const form = event.target.closest("form[data-intake-form]");
    if (!form || !root.contains(form)) return;
    event.preventDefault(); event.stopPropagation();
    if (form.dataset.intakeForm === "files") {
      state.receivedVia = form.elements.namedItem("receivedVia").value;
      void inspectFiles([...form.elements.namedItem("files").files], state.receivedVia);
    } else if (form.dataset.intakeForm === "url") {
      state.captureUrl = form.elements.namedItem("url").value.trim();
      void capture(state.captureUrl);
    } else if (form.dataset.intakeForm === "batch-tags") applyCommonTags(form);
    else void saveReviewed(form);
  };
  const onInput = event => {
    const reviewToggle = event.target.closest("[data-intake-reviewed]");
    if (reviewToggle) {confirmReview(state.queue.find(item => item.id === reviewToggle.dataset.intakeReviewed), reviewToggle.checked); return;}
    const form = event.target.closest("form[data-intake-form]");
    if (!form) return;
    if (pending()) return;
    if (form.dataset.intakeForm === "review") {remember(form, undefined, event.target.name !== "reviewed"); if (event.target.name === "tags") updateTags(form); updateOverview();}
    else if (event.target.name === "commonTags") state.commonTags = event.target.value;
    else if (event.target.name === "url") state.captureUrl = event.target.value;
    else if (event.target.name === "receivedVia") state.receivedVia = event.target.value;
  };
  const onClick = event => {
    const button = event.target.closest("button");
    if (!button || !root.contains(button) || pending()) return;
    if (button.dataset.intakeSelect) {
      event.stopPropagation();
      remember(root.querySelector('[data-intake-form="review"]'));
      state.activeId = button.dataset.intakeSelect; notify(); focusReview();
    } else if (button.dataset.intakeAction === "save-batch") {
      event.stopPropagation(); void saveBatch();
    } else if (button.dataset.intakeAction === "discard") {
      event.stopPropagation();
      state.queue = state.queue.filter(item => item.id !== state.activeId);
      state.activeId = state.queue[0]?.id || "";
      announce("Staged source discarded."); notify();
    } else if (button.dataset.intakeTag) {
      event.stopPropagation();
      const form = button.closest("form"), input = form.elements.namedItem("tags");
      try {
        const tag = conceptTags.find(tag => tag.id === button.dataset.intakeTag), tags = normalizeTags(input.value);
        const next = tags.some(item => item.id === tag.id) ? tags.filter(item => item.id !== tag.id) : [...tags, tag];
        if (next.length > 20) throw new Error("Use up to 20 distinct concept tags.");
        input.value = next.map(tag => tag.label).join(", "); remember(form, undefined, true); updateTags(form); updateOverview();
      } catch (error) {announce(error.message, true); const status = root.querySelector("[data-intake-status]"); status.textContent = state.message; status.classList.add("si-error"); status.setAttribute("role", "alert");}
    }
  };
  const onDragOver = event => {
    if (!event.target.closest("[data-intake-drop]")) return;
    event.preventDefault(); event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = state.processing || state.saving ? "none" : "copy";
    root.querySelector("[data-intake-drop]")?.classList.add("si-dragging");
  };
  const onDragLeave = event => {if (!event.relatedTarget || !root.querySelector("[data-intake-drop]")?.contains(event.relatedTarget)) root.querySelector("[data-intake-drop]")?.classList.remove("si-dragging");};
  const onDrop = event => {
    if (!event.target.closest("[data-intake-drop]")) return;
    event.preventDefault(); event.stopPropagation();
    root.querySelector("[data-intake-drop]")?.classList.remove("si-dragging");
    const form = root.querySelector('[data-intake-form="files"]');
    state.receivedVia = form.elements.namedItem("receivedVia").value;
    void inspectFiles([...(event.dataTransfer?.files || [])], state.receivedVia);
  };
  const listeners = {submit: onSubmit, input: onInput, change: onInput, click: onClick, dragover: onDragOver, dragleave: onDragLeave, drop: onDrop};
  for (const [name, listener] of Object.entries(listeners)) root.addEventListener(name, listener);
  state._render = render; state._root = root; state._onBusyChange = onBusyChange;
  render();
  state._onBusyChange?.(pending());

  function dispose() {
    if (disposed) return;
    remember(root.querySelector('[data-intake-form="review"]'));
    disposed = true;
    spatialMount?.dispose();
    for (const [name, listener] of Object.entries(listeners)) root.removeEventListener(name, listener);
    if (state._render === render) {delete state._render; delete state._root; delete state._onBusyChange;}
  }
  if (invalidation?.then) invalidation.then(dispose, dispose);
  return {dispose, hasDraft: () => Boolean(state.queue.length || pending()), hasPendingWork: pending};
}
