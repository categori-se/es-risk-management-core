import {metadataFields, readMetadata} from "./source-intake.js";
import {openFileViewer} from "./file-viewer.js";
import {canonicalDocumentValue,documentProfileFromMetadata} from "../lib/document-classification.js";
import {documentRelationSummary,documentRelationLabels} from "../lib/document-relations.js";
import {mountDocumentComparison} from "./document-comparison.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const sizeLabel = size => size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1048576).toFixed(1)} MB`;
const availabilityLabel = value => ({available: "Available", changed: "Source changed", unavailable: "Unavailable"}[value] || "Not checked");
const tabs = [["preview", "Preview"], ["metadata", "Metadata and tags"], ["provenance", "Source and custody"], ["history", "Metadata history"], ["comparison", "Compare versions"]];
const sortColumns = {name: "Name", type: "Type", size: "Size"};
const editableNames = form => [...form.elements].filter(control => control.name && !["submit", "button", "file"].includes(control.type));
const options = (values, selected) => values.map(([value, label]) => `<option value="${h(value)}"${value === selected ? " selected" : ""}>${h(label)}</option>`).join("");
const fact = (label, value, fallback = "Not recorded") => `<dt>${h(label)}</dt><dd>${h(value || fallback)}</dd>`;
let sequence = 0;

function kind(version) {
  const type = version.mediaType || "", name = version.filename.toLowerCase();
  if (/\.(?:geojson|topojson|shp|shx|dbf|cpg|gpkg|gml|kml|kmz|gpx|tif|tiff|prj)$/.test(name) || /geo\+json|geopackage|geotiff/.test(type)) return "Spatial";
  if (/\.(?:zip|7z|rar|tar|gz)$/.test(name)) return "Archive";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "PDF";
  if (/html/.test(type) || /\.html?$/.test(name)) return "Web capture";
  if (/spreadsheet|excel|csv/.test(type) || /\.(?:xlsx?|ods|csv|tsv)$/.test(name)) return "Table / spreadsheet";
  if (type.startsWith("image/")) return "Image";
  if (/wordprocessing|msword|opendocument.text/.test(type) || /\.(?:docx?|odt|rtf)$/.test(name)) return "Document";
  if (type.startsWith("text/") || /\.(?:txt|md|json|xml)$/.test(name)) return "Text / data";
  return "Other";
}

function currentMetadata(resource, version) {
  return version.effectiveMetadata || resource.metadataHistory?.findLast(entry => entry.versionId === version.id)?.metadata || version.intakeMetadata ||
    {title: resource.title || version.filename, authors: [], documentDate: "", description: "", language: "", tags: [], receivedVia: "file_upload",
      extraction: {method: "manual", status: "unavailable", warnings: []}};
}

function citation({resource, version, metadata}) {
  const ref = version.reference;
  return [metadata.title, metadata.authors?.join("; "), metadata.documentDate, metadata.publisher,
    ...(metadata.identifier ? [`Identifier: ${metadata.identifier}`] : []), `File: ${version.filename}`,
    `Resource: ${resource.id}`, `Version: ${version.id}`, `SHA256: ${version.sha256}`,
    ...(ref ? [`Qualified reference: ${JSON.stringify(ref)}`] : []),
    ...(version.source?.originalUrl ? [`Original source: ${version.source.originalUrl}`] : []),
    ...(metadata.sourceUrl && metadata.sourceUrl !== version.source?.originalUrl ? [`Reference URL: ${metadata.sourceUrl}`] : [])].filter(Boolean).join("\n");
}

/** Account-scoped document descriptions and previews. All source text is inert;
 * the parent owns persistence, account routing and exact-original downloads. */
export function mountProjectDocuments(root, {getProject, getAccountId, request, saveMetadata, download, capture, relink, saveSpatialEdit,
  onBusyChange, state = {}, invalidation,classificationScope="",requirementChoices=[],readSourcePassage,compareDocuments,saveDocumentRelation,canReviewDocumentRelation=true} = {}) {
  if (!root || typeof root.addEventListener !== "function" || ![getProject, getAccountId, request, saveMetadata, download].every(value => typeof value === "function")) {
    throw new TypeError("Project documents require a root, project/account readers and document operations.");
  }
  const scope = {accountId: String(getAccountId() || ""), projectId: getProject()?.id || ""};
  const scopeKey = JSON.stringify(scope);
  state.scope ??= scopeKey;
  if (state.scope !== scopeKey) {
    root.textContent = "Open the account and project used for this document space.";
    return {dispose() {}, hasDraft: () => Boolean(state.drafts?.size), hasPendingWork: () => false};
  }
  state.search ??= ""; state.type ??= "all"; state.tag ??= "all"; state.availability ??= "all"; state.includeEarlier ??= false;
  if (!Object.hasOwn(sortColumns, state.sortBy)) state.sortBy = "name";
  if (!["ascending", "descending"].includes(state.sortDirection)) state.sortDirection = "ascending";
  state.tab ??= "preview"; state.selectedVersionId ??= ""; state.message ??= "Select a document to inspect its exact version."; state.error ??= false;
  state.drafts ??= new Map(); state.editing ??= new Set(); state.previews ??= new Map(); state.relinkPaths ??= new Map();
  const id = `project-documents-${++sequence}`;
  let disposed = false, renderedVersionId = "", spatialMount, spatialGeneration = 0, fileViewer,comparisonMount,spatialEditor;
  const scopeMatches = () => String(getAccountId() || "") === scope.accountId && getProject()?.id === scope.projectId;
  const pending = () => Boolean(state.saving || state.downloading || state.previewLoading || state.custodySaving || state.spatialOpening || state.spatialBusy || comparisonMount?.hasPendingWork());
  const notify = () => state._render?.();
  const announce = (message, error = false) => {state.message = message; state.error = error;};
  const setPending = (name, value) => {state[name] = value;state._onBusyChange?.(pending());};
  const entries = () => {const all=(getProject()?.resources || []).flatMap(resource => resource.versions.map((version, index) =>
    ({resource, version, ordinal: index + 1, latest: index === resource.versions.length - 1, metadata: currentMetadata(resource, version), type: kind(version)})));for(const row of all){row.relation=documentRelationSummary(all,row,classificationScope);if(row.relation.superseded)row.latest=false;}return all;};
  const selected = () => entries().find(entry => entry.version.id === state.selectedVersionId);
  const canEditSpatial = entry => typeof saveSpatialEdit === 'function' && entry.latest && entry.version.mode === 'managed' &&
    entry.version.reference?.authority === 'urn:esia:local' && !entry.version.externalReference &&
    !entry.resource.id.startsWith('field:') && !entry.resource.versions.some(version => version.externalReference) &&
    (/\.geojson$/i.test(entry.version.filename) || entry.version.mediaType === 'application/geo+json') &&
    entry.version.availability === 'available';
  function classificationStatus(metadata){const value=metadata.classification;if(!value)return "unrecorded";return value.engagementId!==classificationScope?"other_engagement":value.reviewedProfile&&canonicalDocumentValue(documentProfileFromMetadata(metadata,value.reviewedProfile.requirementIds))!==canonicalDocumentValue(value.reviewedProfile)?"needs_review":value.status;}
  function classificationSummary(metadata){const value=metadata.classification;if(!value)return '<p class="pd-row-note" data-document-classification-status="unrecorded">No document classification review recorded.</p>';const own=value.engagementId===classificationScope,changed=value.reviewedProfile&&canonicalDocumentValue(documentProfileFromMetadata(metadata,value.reviewedProfile.requirementIds))!==canonicalDocumentValue(value.reviewedProfile),status=!own?"other_engagement":changed?"needs_review":value.status;return `<p class="pd-row-note" data-document-classification-status="${status}">${h(!own?`Classification for engagement ${value.engagementId}; no decision for the current engagement`:changed?"Descriptive fields changed; review needs renewal":status==="suggested"?"Suggested document classification; not accepted":status.replaceAll("_"," "))}${value.review?` · ${h(value.review.actorId)} · ${h(value.review.at)}`:""}</p>`;}
  function classificationDetails(metadata){const value=metadata.classification;if(!value)return "";return `<details data-document-classification-details><summary>Classification proposal, sources and human decision</summary><p>Engagement ${h(value.engagementId)} · source version ${h(value.sourceVersionId)} · SHA256 <code>${h(value.sourceSha256)}</code>.</p><p>Proposal: ${h(value.provenance.model||value.provenance.method)} · ${h(value.proposedBy)} · ${h(value.proposedAt)}. Suggested fields remain separately retained after correction.</p><dl class="pd-facts">${Object.entries(value.proposal).map(([key,item])=>fact(key.replace(/([A-Z])/g," $1"),Array.isArray(item)?item.join("; "):item)).join("")}</dl>${value.review?`<p>Human decision: ${h(value.status.replaceAll("_"," "))} · ${h(value.review.actorId)} · ${h(value.review.at)}</p><blockquote>${h(value.review.statement)}</blockquote>`:"<p>No human classification decision recorded.</p>"}${value.evidence.map((source,index)=>`<article><p>${h(source.locator)} · ${h(source.method)} · ${h(source.extractorVersion)}</p><blockquote>${h(source.quote)}</blockquote>${readSourcePassage?`<button type="button" data-document-action="classification-source" data-document-source-index="${index}">Read classification source passage</button>`:""}</article>`).join("")}</details>`;}

  function remember() {
    const form = root.querySelector('[data-document-form="metadata"]');
    if (!form || !renderedVersionId || !state.editing.has(renderedVersionId)) return;
    const values={};for(const control of editableNames(form)){if(control.type==="checkbox"){values[control.name]??=[];if(control.checked)values[control.name].push(control.value);}else values[control.name]=control.value;}state.drafts.set(renderedVersionId,values);
  }

  function matches(entry) {
    if (!state.includeEarlier && !entry.latest) return false;
    if (state.type !== "all" && entry.type !== state.type) return false;
    if (state.availability !== "all" && entry.version.availability !== state.availability) return false;
    if (state.tag === "untagged" && entry.metadata.tags?.length) return false;
    if (!["all", "untagged"].includes(state.tag) && !entry.metadata.tags?.some(tag => tag.id === state.tag)) return false;
    const term = state.search.trim().toLocaleLowerCase();
    return !term || [entry.metadata.title, entry.version.filename, entry.metadata.authors?.join(" "), entry.metadata.publisher,
      entry.metadata.identifier, entry.metadata.documentType, entry.metadata.description, ...((entry.metadata.tags || []).map(tag => tag.label))]
      .join(" ").toLocaleLowerCase().includes(term);
  }

  function sortedEntries(all) {
    const compareText = (left, right) => String(left || "").localeCompare(String(right || ""), undefined, {numeric: true, sensitivity: "base"});
    return all.filter(matches).sort((left, right) => {
      const comparison = state.sortBy === "size" ? left.version.size - right.version.size :
        compareText(state.sortBy === "type" ? left.type : left.metadata.title, state.sortBy === "type" ? right.type : right.metadata.title);
      return comparison * (state.sortDirection === "descending" ? -1 : 1) ||
        compareText(left.metadata.title, right.metadata.title) || compareText(left.version.filename, right.version.filename) || left.version.id.localeCompare(right.version.id);
    });
  }

  function sortHeader(column) {
    const active = state.sortBy === column, next = active && state.sortDirection === "ascending" ? "descending" : "ascending";
    return `<th scope="col"${active ? ` aria-sort="${state.sortDirection}"` : ""}><button type="button" class="pd-sort" data-document-sort="${column}" aria-label="Sort by ${sortColumns[column].toLowerCase()}, ${next}">${sortColumns[column]}${active ? `<span aria-hidden="true">${state.sortDirection === "ascending" ? "↑" : "↓"}</span>` : ""}</button></th>`;
  }

  function listMarkup() {
    const all = entries(), shown = sortedEntries(all);
    return `<p class="pd-result-count" data-document-count role="status">${shown.length} of ${state.includeEarlier ? all.length : all.filter(entry => entry.latest).length} ${state.includeEarlier ? "source versions" : "documents"} shown · ${h(sortColumns[state.sortBy])}, ${state.sortDirection}</p><p class="pd-keyboard-hint">Use ↑ / ↓ to select a file; Enter opens its viewer.</p>
      <div class="pd-table-region" role="region" aria-label="Project documents; scroll horizontally on narrow screens" tabindex="0"><table class="pd-table pd-file-table"><caption class="pd-sr-only">Files and exact source versions. Select a name to inspect it; use arrow keys to select and Enter to open its viewer.</caption><thead><tr>${sortHeader("name")}${sortHeader("type")}${sortHeader("size")}<th scope="col">Document date</th><th scope="col">Concept tags</th><th scope="col">Availability</th></tr></thead><tbody>${shown.length ? shown.map(entry => `<tr${entry.version.id === state.selectedVersionId ? ' class="pd-selected"' : ""} data-document-row="${h(entry.version.id)}"><th scope="row"><button type="button" data-document-select="${h(entry.version.id)}" data-document-classification-status="${h(classificationStatus(entry.metadata))}" title="${h(entry.metadata.title)}"${entry.version.id === state.selectedVersionId ? ' aria-current="true"' : ""}>${h(entry.metadata.title)}</button><span class="pd-filename" title="${h(entry.version.filename)}">${h(entry.version.filename)}</span></th><td class="pd-file-type">${h(entry.type)}</td><td class="pd-file-size">${h(sizeLabel(entry.version.size))}</td><td>${h(entry.metadata.documentDate || "Not recorded")}</td><td><div class="pd-tags">${(entry.metadata.tags || []).slice(0,2).map(tag => `<span title="${h(tag.label)}">${h(tag.label)}</span>`).join("") || '<span class="pd-no-tags">—</span>'}${entry.metadata.tags?.length>2?`<span title="${h(entry.metadata.tags.map(tag=>tag.label).join("; "))}">+${entry.metadata.tags.length-2}</span>`:""}</div></td><td><span class="pd-availability pd-availability-${h(entry.version.availability || "unknown")}">${h(availabilityLabel(entry.version.availability))}</span></td></tr>`).join("") : '<tr><td colspan="6"><div class="pd-empty"><strong>No documents match these filters.</strong><p>Change the search or clear the filters to see the project library.</p><button type="button" data-document-action="clear-filters">Clear filters</button></div></td></tr>'}</tbody></table></div>`;
  }

  function relationMarkup(entry){const all=entries(),summary=documentRelationSummary(all,entry,classificationScope),duplicates=all.filter(row=>row.version.id!==entry.version.id&&row.version.sha256===entry.version.sha256&&row.version.size===entry.version.size);return `<div data-document-relations>${summary.relation?`<p>${h(documentRelationLabels[summary.relation.decision])}: ${h(summary.earlier.metadata.title)} · reviewed by ${h(summary.relation.review.actorId)} on ${h(summary.relation.review.at)}.</p><blockquote>${h(summary.relation.review.statement)}</blockquote>`:''}${summary.superseded?`<p>Earlier document in a reviewed revision family. Successor: ${h(summary.successors[0].metadata.title)}. Existing citations still refer to this exact original.</p>`:''}${duplicates.length?`<p data-document-duplicate-candidates>Potential duplicates: ${duplicates.map(row=>h(row.metadata.title)).join('; ')} have the same registered SHA256 and size. Compare the originals to record a reviewed relationship.</p>`:''}</div>`;}

  function metadataMarkup(entry) {
    const metadata = entry.metadata;
    if (state.editing.has(entry.version.id)) return `<form data-document-form="metadata" class="pd-edit-form"><p class="pd-note">Save a correction to this version's descriptive record. Original bytes and issued reports retain their history.</p>${classificationDetails(metadata)}${metadataFields(metadata, {idPrefix: `${id}-${entry.version.id}`,classificationScope,requirementChoices})}<div class="pd-actions"><button type="submit">Save metadata and tags</button><button type="button" data-document-action="cancel-edit">Cancel edit</button></div></form>`;
    const spatial = metadata.spatial;
    return `<div class="pd-metadata-heading"><h4>Current document description</h4><button type="button" data-document-action="edit">Edit metadata and tags</button></div>${classificationSummary(metadata)}${classificationDetails(metadata)}<dl class="pd-facts">${fact("Title", metadata.title)}${fact("Authors / organisations", metadata.authors?.join("; "))}${fact("Document date", metadata.documentDate)}${fact("Publisher", metadata.publisher)}${fact("Document type", metadata.documentType)}${fact("Document revision", metadata.documentRevision)}${fact("Reporting period", metadata.reportingPeriod)}${fact("Document status", metadata.documentStatus)}${fact("Locations covered", metadata.locations?.join("; "))}${fact("Project components", metadata.projectComponents?.join("; "))}${fact("Identifier", metadata.identifier)}${fact("Language", metadata.language)}${fact("Source URL", metadata.sourceUrl)}${fact("Last recorded access", metadata.lastAccessedAt || entry.version.source?.capturedAt)}${fact("Rights", metadata.rights)}${fact("License", metadata.license)}${fact("Rights statement URI", metadata.rightsURI)}${fact("Licence URI", metadata.licenseURI)}${fact("Permission evidence", metadata.rightsEvidenceURL)}${fact("Attribution", metadata.attribution)}${fact("Description", metadata.description)}${fact("Concept tags", metadata.tags?.map(tag => tag.label).join("; "), "No tags")}${spatial ? fact("Spatial reference / CRS", spatial.crs) + fact("Spatial source date", spatial.sourceDate) + fact("Spatial coverage", spatial.coverage) + fact("Transformations", spatial.transformations) + fact("Spatial limitations", spatial.limitations) : ""}</dl><p class="pd-note">Unknown dates stay unrecorded. A file creation date is separate from its publication date.</p>`;
  }

  function provenanceMarkup(entry) {
    const {version, resource, metadata} = entry;
    const available = !["changed", "unavailable"].includes(version.availability);
    const extraction = metadata.extraction || {}, observed = extraction.detected || {};
    const observedFields = [["pageCount", "Page count"], ["createdAt", "File creation date"], ["modifiedAt", "File modification date"],
      ["format", "Observed format"], ["crs", "Observed coordinate reference"], ["bounds", "Coordinate extent"],
      ["featureCount", "Feature count"], ["coordinateCount", "Coordinate count"], ["width", "Raster width"], ["height", "Raster height"], ["bands", "Raster bands"]];
    const observedFacts = observedFields.filter(([key]) => observed[key] !== undefined && observed[key] !== "")
      .map(([key, label]) => fact(label, Array.isArray(observed[key]) ? observed[key].join(", ") : String(observed[key]))).join("");
    return `<dl class="pd-facts">${fact("Logical resource", resource.title)}${fact("Resource ID", resource.id)}${fact("Exact version ID", version.id)}${fact("SHA256", version.sha256)}${fact("Filename", version.filename)}${fact("Media type", version.mediaType)}${fact("Original size", `${version.size} bytes`)}${fact("Intake time", version.capturedAt)}${fact("Custody", version.mode === "registered" ? "Registered reference; historical bytes were not captured" : "Managed original")}${fact("Availability", availabilityLabel(version.availability))}${fact("Received via", metadata.receivedVia?.replaceAll("_", " "))}</dl>
      ${version.source ? `<h4>Capture provenance</h4><dl class="pd-facts">${Object.entries(version.source).map(([name, value]) => fact(name.replace(/([a-z])([A-Z])/g, "$1 $2"), value)).join("")}</dl>` : ""}
      <h4>Observed file properties</h4><dl class="pd-facts pd-observed-facts">${fact("Extraction status", extraction.status)}${fact("Observed at", extraction.observedAt)}${observedFacts}</dl><p class="pd-note">Creation and modification dates describe the file; they do not establish its publication date. These retained observations are separate from the curated document description.</p>
      <details><summary>Inspect parser record and field provenance</summary><pre class="pd-provenance">${h(JSON.stringify(extraction, null, 2))}</pre></details>
      ${version.externalReference ? `<details><summary>Upstream resource identity</summary><pre class="pd-provenance">${h(JSON.stringify(version.externalReference, null, 2))}</pre></details>` : ""}
      ${version.externalReference?.authority === "urn:esia:local-share" ? '<p class="pd-note">Shared reference: the source owner retains the original. Access follows the exact version registration and can be revoked. Use the sharing panel to inspect ownership and permitted use.</p>' : ""}${version.mode === "registered" && version.externalReference?.authority !== "urn:esia:local-share" && (capture || relink) ? `<details${state.relinkPaths.has(version.id) ? " open" : ""}><summary>Advanced: capture or relink this registered version</summary><p class="pd-note">Relinking verifies the original SHA256. A matching filename is insufficient. Capturing preserves the exact historical bytes in this account.</p>${capture ? `<button type="button" data-document-action="capture"${available ? "" : " disabled"}>Capture historical copy</button>` : ""}${relink ? `<form data-document-form="relink" class="pd-relink"><label><span>New absolute local path</span><input name="path" required value="${h(state.relinkPaths.get(version.id) || "")}" placeholder="/path/to/the/original-version.pdf"></label><button type="submit">Verify hash and relink</button></form>` : ""}</details>` : ""}`;
  }

  function historyMarkup(entry) {
    const history = entry.resource.metadataHistory?.filter(item => item.versionId === entry.version.id) || [];
    return `<p class="pd-note">Corrections extend the descriptive record. Captured content and previously issued report snapshots remain fixed.</p><ol class="pd-history"><li><strong>Initial metadata</strong><span>${h(entry.version.capturedAt)}</span><p>${h(entry.version.intakeMetadata?.title || "No reviewed intake metadata was recorded.")}</p>${entry.version.intakeMetadata ? `<details><summary>Inspect initial metadata</summary><pre class="pd-provenance">${h(JSON.stringify(entry.version.intakeMetadata, null, 2))}</pre></details>` : ""}</li>${history.map((item, index) => `<li><strong>Correction ${index + 1}</strong><span>${h(item.at)}</span><p>${h(item.metadata.title)}</p><p class="pd-small">${h(item.metadata.authors?.join("; ") || "Author not recorded")} · ${h(item.metadata.documentDate || "Document date not recorded")}</p><div class="pd-tags">${(item.metadata.tags || []).map(tag => `<span>${h(tag.label)}</span>`).join("")}</div><details><summary>Inspect retained correction</summary><pre class="pd-provenance">${h(JSON.stringify(item.metadata, null, 2))}</pre></details></li>`).join("")}</ol>`;
  }

  function previewMarkup(entry) {
    const preview = state.previews.get(entry.version.id);
    const available = !["changed", "unavailable"].includes(entry.version.availability);
    if (!preview || preview.status === "error") return `<div class="pd-preview-empty"><span class="pd-preview-type">${h(entry.type)}</span><h4>${preview?.status === "error" ? "Preview could not be loaded" : "Preview this exact source version"}</h4><p>${h(preview?.error || "Load an extracted text preview or an offline spatial view. The original file stays unchanged.")}</p><button type="button" data-document-action="preview"${available ? "" : " disabled"}>${preview?.status === "error" ? "Retry preview" : "Load preview"}</button>${!available ? entry.version.externalReference?.authority === "urn:esia:local-share" ? '<p class="pd-note">This registered source is unavailable. Check its current sharing grant with the source owner.</p>' : '<p class="pd-note">Restore or relink the matching original before previewing it.</p>' : ""}</div>`;
    if (preview.status === "loading") return '<div class="pd-preview-empty"><p role="status">Loading the exact source version…</p></div>';
    const payload = preview.payload;
    const image = typeof payload.imageDataUrl === "string" && payload.imageDataUrl.length <= 8 * 1024 * 1024 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(payload.imageDataUrl) ? payload.imageDataUrl : "";
    return `<div class="pd-preview-toolbar"><span>${h(payload.kind === "pdf" ? image ? "PDF first-page preview" : "PDF properties" : payload.kind === "spatial" ? "Offline spatial preview" : payload.kind === "unsupported" ? "Preview unavailable" : "Extracted text preview")}</span><button type="button" data-document-action="preview">Refresh preview</button></div>${payload.warnings?.length ? `<ul class="pd-warnings">${payload.warnings.map(warning => `<li>${h(warning)}</li>`).join("")}</ul>` : ""}${image ? `<figure class="pd-page-image"><img src="${h(image)}" alt="First page image of ${h(entry.version.filename)}"><figcaption>First page preview. Download the original to inspect the full document.</figcaption></figure>` : ""}${payload.kind === "spatial" && payload.spatial ? '<div data-document-spatial></div>' : ""}${payload.text ? `<pre class="pd-text-preview">${h(payload.text)}</pre>` : payload.kind === "unsupported" ? '<p class="pd-note">Download the exact original to inspect this file in a suitable application.</p>' : ""}${payload.detected && Object.keys(payload.detected).length ? `<details><summary>File properties observed for this preview</summary><p class="pd-note">Detected file dates do not establish a publication date. Preview observations do not overwrite curated metadata.</p><pre class="pd-provenance">${h(JSON.stringify(payload.detected, null, 2))}</pre></details>` : ""}<p class="pd-note">Previews can omit formatting or content. Saved webpages and PDF scripts are not executed here.</p>`;
  }

  function inspectorMarkup(entry) {
    const {resource, version, metadata} = entry;
    const available = !["changed", "unavailable"].includes(version.availability);
    return `<section class="pd-inspector" aria-labelledby="${id}-selection"><header class="pd-inspector-heading"><div><p class="pd-eyebrow">Selected source version</p><h3 id="${id}-selection" data-document-heading tabindex="-1">${h(metadata.title)}</h3><p class="pd-small">${h(version.filename)} · ${h(sizeLabel(version.size))} · ${h(availabilityLabel(version.availability))}</p></div><div class="pd-actions"><button type="button" data-document-action="open"${available ? "" : " disabled"}>Open in app</button>${canEditSpatial(entry) ? `<button type="button" data-document-action="map-edit">Edit map</button>` : ""}<button type="button" data-document-action="download"${available ? "" : " disabled"}>Download exact original</button></div></header><label class="pd-version-choice"><span>Resource version</span><select data-document-version>${options(resource.versions.map((candidate, index) => [candidate.id, `Version ${index + 1}${index === resource.versions.length - 1 ? " · latest" : ""} · ${candidate.filename} · ${candidate.sha256.slice(0, 10)}`]).reverse(), version.id)}</select></label>
      <details class="pd-source-details"><summary>Version, custody and review details</summary><p class="pd-row-note">Version ${entry.ordinal} of ${resource.versions.length}${entry.latest ? " · latest" : " · earlier"}${state.editing.has(version.id) ? " · metadata draft" : ""} · ${version.mode === "registered" ? "Registered reference" : "Managed original"}</p>${classificationSummary(metadata)}${relationMarkup(entry)}</details>
      <div class="pd-tabs" role="tablist" aria-label="Selected document information">${tabs.map(([name, label]) => `<button type="button" role="tab" id="${id}-tab-${name}" data-document-tab="${name}" aria-controls="${id}-panel-${name}" aria-selected="${state.tab === name}" tabindex="${state.tab === name ? "0" : "-1"}">${label}${name === "metadata" && state.editing.has(version.id) ? ' <span class="pd-draft-badge">Draft</span>' : ""}</button>`).join("")}</div><div class="pd-tab-panel" role="tabpanel" id="${id}-panel-${state.tab}" aria-labelledby="${id}-tab-${state.tab}" tabindex="0">${state.tab === "comparison" ? (compareDocuments && saveDocumentRelation ? '<div data-document-comparison-mount></div>' : '<p>Open this document register from an engagement to compare exact originals and record a reviewed relationship.</p>') : state.tab === "metadata" ? metadataMarkup(entry) : state.tab === "provenance" ? provenanceMarkup(entry) : state.tab === "history" ? historyMarkup(entry) : previewMarkup(entry)}</div>
      ${tabs.filter(([name]) => name !== state.tab).map(([name]) => `<div hidden role="tabpanel" id="${id}-panel-${name}" aria-labelledby="${id}-tab-${name}"></div>`).join("")}<details class="pd-citation"><summary>Cite this exact source version</summary><p class="pd-note">Use a precise page, paragraph, sheet/range or spatial feature locator when adding project evidence.</p><label><span>Version identity and document citation</span><textarea rows="5" readonly data-document-citation>${h(citation(entry))}</textarea></label><button type="button" data-document-action="select-citation">Select citation</button></details></section>`;
  }

  function renderList() {
    root.querySelector("[data-document-list]").innerHTML = listMarkup();
    if (pending()) for (const control of root.querySelectorAll("[data-document-list] button")) control.disabled = true;
  }

  async function renderSpatial(target, payload, generation) {
    try {
      const {mountSpatialPreview} = await import("./spatial-preview.js");
      if (disposed || generation !== spatialGeneration || !root.contains(target)) return;
      spatialMount = mountSpatialPreview(target, payload);
    } catch {
      if (!disposed && generation === spatialGeneration && root.contains(target)) target.textContent = "The spatial view could not be opened. Inspect the extracted summary or download the original.";
    }
  }

  function render() {
    if (disposed) return;
    remember(); comparisonMount?.dispose(); comparisonMount=undefined; spatialMount?.dispose(); spatialMount = undefined; spatialGeneration++;
    root.classList.add("project-documents"); root.setAttribute("aria-busy", String(pending()));
    if (!scopeMatches()) {root.innerHTML = '<p role="alert">Open the account and project used for this document space.</p>'; return;}
    const all = entries(), latest = all.filter(entry => entry.latest);
    if (!selected()) state.selectedVersionId = latest[0]?.version.id || "";
    const entry = selected();
    const types = [...new Set(all.map(item => item.type))].sort();
    const tags = new Map(all.flatMap(item => (item.metadata.tags || []).map(tag => [tag.id, tag.label])));
    if (state.type !== "all" && !types.includes(state.type)) state.type = "all";
    if (!["all", "untagged"].includes(state.tag) && !tags.has(state.tag)) state.tag = "all";
    root.innerHTML = `<div class="pd-library-heading"><div><p class="pd-eyebrow">Project document space</p><h2>Documents and evidence files</h2><p>${latest.length} ${latest.length === 1 ? "document" : "documents"} · ${all.length} exact source ${all.length === 1 ? "version" : "versions"}</p></div><span class="pd-scope-label">${h(getProject().storageAccount?.name || "Current storage account")}</span></div><p class="pd-status${state.error ? " pd-error" : ""}" data-document-status role="${state.error ? "alert" : "status"}">${h(state.message)}</p>
      ${all.length ? `<div class="pd-filters"><label class="pd-search"><span>Find documents</span><input type="search" data-document-filter="search" value="${h(state.search)}" placeholder="Title, filename, author, identifier or tag"></label><label><span>File type</span><select data-document-filter="type">${options([["all", "All file types"], ...types.map(type => [type, type])], state.type)}</select></label><label><span>Concept tag</span><select data-document-filter="tag">${options([["all", "All tags"], ["untagged", "Untagged"], ...[...tags].sort((left, right) => left[1].localeCompare(right[1]))], state.tag)}</select></label><label><span>Availability</span><select data-document-filter="availability">${options([["all", "Any availability"], ["available", "Available"], ["changed", "Source changed"], ["unavailable", "Unavailable"]], state.availability)}</select></label><label class="pd-earlier"><input type="checkbox" data-document-filter="includeEarlier"${state.includeEarlier ? " checked" : ""}><span>Include earlier versions</span></label><button type="button" data-document-action="clear-filters">Clear filters</button></div><div class="pd-browser"><div class="pd-list-pane" data-document-list>${listMarkup()}</div>${entry ? inspectorMarkup(entry) : ""}</div>` : '<div class="pd-empty pd-library-empty"><strong>Your project document space is ready.</strong><p>Add client files, research captures or spatial resources using Add sources. They will appear here for review, preview and tagging.</p></div>'}`;
    renderedVersionId = entry?.version.id || "";
    const comparisonRoot=root.querySelector("[data-document-comparison-mount]");if(comparisonRoot)comparisonMount=mountDocumentComparison(comparisonRoot,{getEntries:entries,rightVersionId:entry.version.id,canReview:canReviewDocumentRelation,compare:compareDocuments,saveRelation:saveDocumentRelation,readSourcePassage,onBusyChange:value=>state._onBusyChange?.(value),onSaved:()=>{announce("Reviewed relationship saved. Both original identities and earlier citations remain available.");queueMicrotask(notify);}});
    const form = root.querySelector('[data-document-form="metadata"]'), draft = state.drafts.get(renderedVersionId);
    if (form && draft) for (const control of editableNames(form)) if (Object.hasOwn(draft, control.name)){if(control.type==="checkbox")control.checked=Array.isArray(draft[control.name])&&draft[control.name].includes(control.value);else control.value=draft[control.name];}
    if (pending()) for (const control of root.querySelectorAll("button,input,select,textarea")) control.disabled = true;
    const spatial = root.querySelector("[data-document-spatial]");
    if (spatial) void renderSpatial(spatial, state.previews.get(renderedVersionId).payload.spatial, spatialGeneration);
  }

  function focusSelection() {state._root?.querySelector("[data-document-heading]")?.focus({preventScroll: true});}
  function assertScope() {if (!scopeMatches()) throw new Error("Open the account and project used for this document before continuing.");}

  function selectVersion(versionId, {focusFile = false} = {}) {
    if (!scopeMatches()) {notify();return false;}
    if (!entries().some(entry => entry.version.id === versionId)) return false;
    remember();state.selectedVersionId = versionId;notify();
    if (focusFile) [...root.querySelectorAll("[data-document-select]")].find(button => button.dataset.documentSelect === versionId)?.focus({preventScroll: true});
    else focusSelection();
    return true;
  }

  function openVersion(entry) {
    if (disposed || pending()) return;
    if (!scopeMatches()) {notify();return;}
    if (["changed", "unavailable"].includes(entry.version.availability)) {
      announce("Restore or relink this exact original before opening its viewer.", true);notify();
      [...root.querySelectorAll("[data-document-select]")].find(button => button.dataset.documentSelect === entry.version.id)?.focus();
      return;
    }
    assertScope();fileViewer?.close();
    fileViewer = openFileViewer({document: root.ownerDocument, title: entry.metadata.title, version: entry.version, metadata: entry.metadata,
      loadPreview: async (page, {signal} = {}) => {const payload = await request(`/api/projects/${encodeURIComponent(scope.projectId)}/versions/${encodeURIComponent(entry.version.id)}/preview?page=${page}`, {method: "GET", signal});if (disposed) throw new Error("This file context has closed.");assertScope();return payload;},
      download: async ({signal} = {}) => {assertScope();if (!disposed && !signal?.aborted) await download(entry.version.id, {signal});},
      renderSpatial: async (host, payload) => {const {mountSpatialPreview} = await import("./spatial-preview.js");return mountSpatialPreview(host, payload.spatial);}});
  }

  async function editSpatialVersion(entry) {
    if (disposed || pending() || !canEditSpatial(entry)) return;
    try {
      assertScope();setPending('spatialOpening', true);notify();
      const {openSpatialEditor} = await import('./spatial-editor.js');
      if (disposed) return;
      assertScope();if (spatialEditor && !spatialEditor.close()) return;fileViewer?.close();
      spatialEditor = openSpatialEditor({document:root.ownerDocument, styleSource:root, title:entry.metadata.title,
        loadContext:async () => {
          assertScope();
          const context = await request(`/api/projects/${encodeURIComponent(scope.projectId)}/versions/${encodeURIComponent(entry.version.id)}/spatial-edit-context`, {method:'GET'});
          if (disposed) throw Error('This file context has closed.');
          assertScope();
          if (context.projectId !== scope.projectId || context.resourceId !== entry.resource.id ||
              context.baseVersionId !== entry.version.id || context.baseSha256 !== entry.version.sha256) throw Error('The editable source differs from the selected exact version.');
          return context;
        },
        save:async (payload, options) => {
          assertScope();
          const result = await saveSpatialEdit(payload, options);
          if (disposed) throw Error('This file context has closed.');
          assertScope();return result;
        },
        onSaved:result => {
          if (disposed || !scopeMatches()) return;
          state.selectedVersionId = result.receipt.versionId;
          announce('Map saved as a new source version. Earlier originals and evidence remain available.');notify();
        },
        onBusyChange:value => {if (!disposed) {state.spatialBusy = value;state._onBusyChange?.(pending());}},
        onClose:() => {
          spatialEditor = undefined;
          if (!disposed) {state.spatialBusy = false;state._onBusyChange?.(pending());notify();root.querySelector('[data-document-action="map-edit"]')?.focus();}
        }});
    } catch (error) {if (!disposed) {announce(error.message || 'This spatial source could not be opened for editing.', true);notify();}}
    finally {if (!disposed) {setPending('spatialOpening', false);notify();}}
  }

  async function perform(field, work) {
    if (pending() || disposed) return;
    try {assertScope();setPending(field, true);notify();await work();}
    catch (error) {announce(error.message || "The document operation could not be completed. Your metadata draft remains on this page.", true);}
    finally {setPending(field, false);notify();}
  }

  async function loadPreview(entry) {
    await perform("previewLoading", async () => {
      state.previews.set(entry.version.id, {status: "loading"}); notify();
      try {
        const payload = await request(`/api/projects/${encodeURIComponent(scope.projectId)}/versions/${encodeURIComponent(entry.version.id)}/preview`, {method: "GET"});
        assertScope();
        if (!payload || payload.versionId !== entry.version.id || payload.sha256 !== entry.version.sha256 || !["spatial", "text", "table", "image", "pdf", "unsupported"].includes(payload.kind) ||
            payload.text !== undefined && typeof payload.text !== "string" || payload.warnings !== undefined && (!Array.isArray(payload.warnings) || payload.warnings.some(warning => typeof warning !== "string"))) {
          throw new Error("The preview does not identify this exact source version. Nothing in the document record changed.");
        }
        state.previews.delete(entry.version.id); state.previews.set(entry.version.id, {status: "ready", payload});
        while (state.previews.size > 5) state.previews.delete(state.previews.keys().next().value);
        announce(`Preview loaded for ${entry.version.filename}. Original bytes and metadata are unchanged.`);
      } catch (error) {state.previews.set(entry.version.id, {status: "error", error: error.message});throw error;}
    });
  }

  const onInput = event => {
    const filter = event.target.dataset.documentFilter;
    if (filter === "search") {state.search = event.target.value;renderList();return;}
    if (event.target.closest('[data-document-form="metadata"]')) {if(event.target.name!=="classificationReviewed"){const control=event.target.form?.elements.namedItem("classificationReviewed");if(control)control.checked=false;}remember();}
    if (event.target.closest('[data-document-form="relink"]')) state.relinkPaths.set(renderedVersionId, event.target.value);
  };
  const onChange = event => {
    const filter = event.target.dataset.documentFilter;
    if (filter && filter !== "search") {state[filter] = filter === "includeEarlier" ? event.target.checked : event.target.value;renderList();return;}
    if (event.target.matches("[data-document-version]")) {remember();state.selectedVersionId = event.target.value;notify();focusSelection();}
  };
  const onClick = event => {
    const button = event.target.closest("button");
    if (!button || !root.contains(button)) {
      const row = event.target.closest("[data-document-row]");
      if (row && root.contains(row) && !pending()) selectVersion(row.dataset.documentRow);
      return;
    }
    event.stopPropagation();
    if (pending()) return;
    if (!scopeMatches()) {notify();return;}
    if (button.dataset.documentSort) {
      const column = button.dataset.documentSort;
      if (!Object.hasOwn(sortColumns, column)) return;
      state.sortDirection = state.sortBy === column && state.sortDirection === "ascending" ? "descending" : "ascending";
      state.sortBy = column;renderList();root.querySelector(`[data-document-sort="${column}"]`)?.focus({preventScroll: true});return;
    }
    if (button.dataset.documentSelect) {selectVersion(button.dataset.documentSelect);return;}
    if (button.dataset.documentTab) {remember();state.tab = button.dataset.documentTab;notify();state._root?.querySelector(`[data-document-tab="${state.tab}"]`)?.focus({preventScroll: true});return;}
    const action = button.dataset.documentAction, entry = selected();
    if (action === "clear-filters") {state.search = "";state.type = state.tag = state.availability = "all";state.includeEarlier = false;notify();root.querySelector('[data-document-filter="search"]')?.focus();return;}
    if (!entry) return;
    if (action === "edit") {state.tab = "metadata";state.editing.add(entry.version.id);notify();root.querySelector('[data-document-form="metadata"] input[name="title"]')?.focus();}
    else if (action === 'map-edit') void editSpatialVersion(entry);
    else if(action==="classification-source"&&readSourcePassage){const source=entry.metadata.classification?.evidence[Number(button.dataset.documentSourceIndex)];if(source){remember();void Promise.resolve(readSourcePassage(source)).catch(error=>announce(error.message,true));}}
    else if (action === "cancel-edit") {state.editing.delete(entry.version.id);state.drafts.delete(entry.version.id);announce("Metadata edit cancelled.");notify();root.querySelector('[data-document-action="edit"]')?.focus();}
    else if (action === "open") openVersion(entry);
    else if (action === "preview") void loadPreview(entry);
    else if (action === "download") void perform("downloading", async () => {await download(entry.version.id);announce(`Downloaded the exact original: ${entry.version.filename}.`);});
    else if (action === "capture" && capture) void perform("custodySaving", async () => {await capture(entry.version.id);announce("Historical bytes captured. The exact source version is now managed in this account.");});
    else if (action === "select-citation") {const textarea = root.querySelector("[data-document-citation]");textarea.focus();textarea.select();}
  };
  const onSubmit = event => {
    const form = event.target.closest("form[data-document-form]");
    if (!form || !root.contains(form)) return;
    event.preventDefault();event.stopPropagation();
    if (pending()) return;
    const entry = selected(); if (!entry) return;
    if (form.dataset.documentForm === "metadata") {
      remember();
      let metadata;
      try {metadata = readMetadata(form, entry.metadata);} catch (error) {announce(error.message, true);notify();return;}
      void perform("saving", async () => {await saveMetadata(entry.version.id, metadata);state.drafts.delete(entry.version.id);state.editing.delete(entry.version.id);announce("Metadata and tags saved. The original file and issued reports retain their history.");});
    } else if (form.dataset.documentForm === "relink" && relink) {
      const path = form.elements.namedItem("path").value.trim();state.relinkPaths.set(entry.version.id, path);
      void perform("custodySaving", async () => {await relink(entry.version.id, path);state.relinkPaths.delete(entry.version.id);announce("Original SHA256 verified and the registered file relinked.");});
    }
  };
  const onKeyDown = event => {
    const file = event.target.closest("[data-document-select]");
    if (file && root.contains(file) && ["ArrowUp", "ArrowDown", "Home", "End", "Enter"].includes(event.key)) {
      event.preventDefault();event.stopPropagation();
      if (pending()) return;
      if (!scopeMatches()) {notify();return;}
      const files = [...root.querySelectorAll("[data-document-select]")], index = files.indexOf(file);
      const next = event.key === "Home" ? 0 : event.key === "End" ? files.length - 1 : event.key === "ArrowDown" ? Math.min(index + 1, files.length - 1) : event.key === "ArrowUp" ? Math.max(0, index - 1) : index;
      const versionId = files[next]?.dataset.documentSelect;
      if (versionId && selectVersion(versionId, {focusFile: true}) && event.key === "Enter") openVersion(selected());
      return;
    }
    const tab = event.target.closest("[data-document-tab]");
    if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (pending()) return;
    const index = tabs.findIndex(([name]) => name === tab.dataset.documentTab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    remember();state.tab = tabs[next][0];notify();root.querySelector(`[data-document-tab="${state.tab}"]`)?.focus();
  };
  const listeners = {input: onInput, change: onChange, click: onClick, submit: onSubmit, keydown: onKeyDown};
  for (const [name, handler] of Object.entries(listeners)) root.addEventListener(name, handler);
  state._render = render;state._root = root;state._onBusyChange = onBusyChange;
  render();state._onBusyChange?.(pending());
  function dispose() {
    if (disposed) return;
    remember();disposed = true;comparisonMount?.dispose();fileViewer?.close();spatialEditor?.close({force:true});state.spatialOpening = state.spatialBusy = false;spatialGeneration++;spatialMount?.dispose();
    for (const [name, handler] of Object.entries(listeners)) root.removeEventListener(name, handler);
    if (state._render === render) {delete state._render;delete state._root;delete state._onBusyChange;}
  }
  if (invalidation?.then) invalidation.then(dispose, dispose);
  return {dispose, hasDraft: () => Boolean(state.drafts.size || state.editing.size || spatialEditor?.hasDraft()), hasPendingWork: pending};
}
