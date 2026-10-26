import {openFileViewer} from "./file-viewer.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const publicUrl = value => {try {const url = new URL(value);return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;} catch {return null;}};
const retentionLabel = (resource, version) => !version ? "Capture not completed" : resource.captureTarget === "disclosure_page_original_unresolved" ? "Disclosure page retained; original unresolved" : version.mediaType === "text/html" ? "Source page retained (HTML response)" : "Original retained";
export function mountResearchArchive(root, {collectionId = new URL(root.ownerDocument.defaultView.location.href).searchParams.get("collection") || "bujagali", embedded = false} = {}) {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}(?![\s\S])/.test(collectionId)) {root.textContent = "Choose a valid research collection.";return {ready: Promise.resolve(), dispose() {}};}
  const collectionPath = `/api/research-archives/${encodeURIComponent(collectionId)}`, collectionName = collectionId === "cbg" ? "CBG" : collectionId.replace(/[-_]/g, " ").replace(/^./, letter => letter.toUpperCase());
  root.classList.add("local-workspace", "research-archive");
  const controller = new AbortController();let disposed = false, manifest, institution = "", term = "", status = "", fileViewer;
  const request = async (path, binary = false) => {
    const response = await fetch(path, {credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal, headers: {"X-ESIA-Workspace": "local"}});
    if (!response.ok) {const result = await response.json();throw new Error(result.error || "Archive unavailable.");}return binary ? response.blob() : response.json();
  };
  function rows() {
    const selected = manifest.resources.filter(resource => (!institution || resource.institutionIds.includes(institution)) && (!status || (status === "retained" ? resource.versions.length : !resource.versions.length)) && [resource.title, resource.publisher, ...resource.institutionIds, ...resource.components].join(" ").toLowerCase().includes(term.toLowerCase()));
    return selected.map(resource => {
      const version = resource.versions.at(-1), source = publicUrl(resource.url);
      return `<article class="lw-record"><h3>${h(resource.title)}</h3><p>${h(resource.publisher)} · ${h(resource.type || "Document type not recorded")} · ${h(resource.components.join(", "))}</p><p>${h(resource.institutionIds.join(" · "))}</p><p><strong>${retentionLabel(resource, version)}</strong>${version ? ` · ${Math.round(version.size / 1024).toLocaleString()} KiB · ${h(version.mediaType)} · ${h(version.capturedAt)}` : ` · ${h(resource.attempts.at(-1)?.message || "Not attempted")}`}</p>${source ? `<a href="${h(source)}" target="_blank" rel="noopener noreferrer">Open source location</a>` : ""}${version ? ` <button type="button" data-archive-open="${h(version.id)}">Open in app</button> <button type="button" data-archive-download="${h(version.id)}">Download retained original</button>` : ""}
        <details><summary>Metadata, provenance and capture history</summary><dl class="lw-details"><dt>Catalog date</dt><dd>${h(resource.documentDate || "Not established")}</dd><dt>Date basis</dt><dd>${h(resource.documentDateBasis || "Not recorded")}</dd><dt>Source identity</dt><dd><code>${h(resource.id)}</code></dd><dt>Notes</dt><dd>${h(resource.notes)}</dd></dl>${version ? `<p>SHA256 <code>${h(version.sha256)}</code></p><p>${h(version.source.result)}</p><p>Embedded title: ${h(version.metadata.title)}. Embedded metadata needs practitioner review.</p><pre class="lw-report">${h(JSON.stringify({originalDocumentUrl: resource.originalDocumentUrl, archiveProvenance: resource.archiveProvenance, source: version.source, http: version.http, extracted: version.metadata, catalogRecords: resource.catalogRecords, attempts: resource.attempts}, null, 2))}</pre>${resource.versions.length > 1 ? `<h4>All retained versions</h4><ul>${resource.versions.map(item => `<li>${h(item.capturedAt)} · ${h(item.sha256)} <button type="button" data-archive-open="${h(item.id)}">Open this version</button> <button type="button" data-archive-download="${h(item.id)}">Download this version</button></li>`).join("")}</ul>` : ""}` : `<pre class="lw-report">${h(JSON.stringify({catalogRecords: resource.catalogRecords, attempts: resource.attempts}, null, 2))}</pre>`}</details></article>`;
    }).join("") || "<p>No sources match these filters.</p>";
  }
  function render() {
    const retained = manifest.resources.filter(resource => resource.versions.length).length, institutions = [...new Set(manifest.resources.flatMap(resource => resource.institutionIds))].sort();
    root.innerHTML = `<header class="lw-header"><div><p class="lw-eyebrow">Public project research</p><${embedded ? "h2" : "h1"}>${h(collectionName)} document archive</${embedded ? "h2" : "h1"}><p>One project, retained source versions and institution-specific provenance.</p></div><a href="/files">Open Files</a></header><p class="lw-mode">${retained} of ${manifest.resources.length} inventoried source locations have retained originals. Downloaded copies are available locally. Failed transfers and discovery limits remain visible.</p><section class="lw-panel"><div class="lw-grid"><label><span>Institution / source</span><select data-archive-institution><option value="">All institutions</option>${institutions.map(id => `<option value="${h(id)}">${h(id)}</option>`).join("")}</select></label><label><span>Capture state</span><select data-archive-status><option value="">All sources</option><option value="retained">Retained originals</option><option value="missing">Not captured</option></select></label><label><span>Search documents</span><input type="search" data-archive-search></label></div><p data-archive-message role="status"></p><button type="button" data-archive-manifest>Download metadata manifest</button></section><section class="lw-panel"><h2>Documents and disclosures</h2><div data-archive-list>${rows()}</div></section><section class="lw-panel"><h2>Coverage and preservation limits</h2><ul>${manifest.limitations.map(note => `<li>${h(note)}</li>`).join("")}</ul><p>These public research captures are separate from confidential lender account stores. Add a reviewed source to the intended account before using it in an assessment. The archive is backed up as a collection; it is not bundled automatically into a project package.</p></section>`;
  }
  function download(blob, filename) {const url = URL.createObjectURL(blob), link = root.ownerDocument.createElement("a");link.href = url;link.download = filename;link.click();setTimeout(() => URL.revokeObjectURL(url), 30000);}
  const onFilter = event => {
    if (event.target.matches("[data-archive-institution]")) institution = event.target.value;
    else if (event.target.matches("[data-archive-status]")) status = event.target.value;
    else if (event.target.matches("[data-archive-search]")) term = event.target.value;else return;
    root.querySelector("[data-archive-list]").innerHTML = rows();
  };
  const onClick = async event => {
    const button = event.target.closest("[data-archive-download],[data-archive-manifest],[data-archive-open]");if (!button) return;
    if (button.hasAttribute("data-archive-manifest")) {download(new Blob([JSON.stringify(manifest, null, 2)], {type: "application/json"}), `${collectionId}-archive-manifest.json`);return;}
    button.disabled = true;
    try {
      const id = button.dataset.archiveOpen || button.dataset.archiveDownload, resource = manifest.resources.find(resource => resource.versions.some(version => version.id === id)), version = resource.versions.find(version => version.id === id);
      const downloadVersion = async () => {
        const blob = await request(`${collectionPath}/versions/${encodeURIComponent(id)}/download`, true);
        if (!disposed) download(blob, (version.filename || resource.filename).replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 200));
      };
      if (button.hasAttribute("data-archive-open")) {
        fileViewer?.close();
        fileViewer = openFileViewer({document: root.ownerDocument, title: resource.title, version,
          metadata: {...version.metadata, sourceUrl: resource.url},
          loadPreview: page => request(`${collectionPath}/versions/${encodeURIComponent(id)}/preview?page=${page}`),
          download: downloadVersion,
          renderSpatial: async (host, payload) => {const {mountSpatialPreview} = await import("./spatial-preview.js");return mountSpatialPreview(host, payload.spatial);}});
        return;
      }
      await downloadVersion();
    } catch (error) {if (!disposed) root.querySelector("[data-archive-message]").textContent = error.message;}
    finally {if (!disposed) button.disabled = false;}
  };
  root.addEventListener("change", onFilter);root.addEventListener("input", onFilter);root.addEventListener("click", onClick);root.innerHTML = '<p role="status">Opening retained research metadata…</p>';
  const ready = request(collectionPath).then(value => {if (!disposed) {manifest = value;render();}}).catch(error => {if (!disposed) root.textContent = error.message;});
  return {ready, dispose() {disposed = true;fileViewer?.close();controller.abort();root.removeEventListener("change", onFilter);root.removeEventListener("input", onFilter);root.removeEventListener("click", onClick);}};
}
