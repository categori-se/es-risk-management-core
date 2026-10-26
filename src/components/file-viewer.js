const activeViewers = new WeakMap();
const zoomLevels = [50, 75, 100, 125, 150, 200, 250, 300];
const textLimit = 120000;
const imageDataLimit = 12 * 1024 * 1024;
let viewerSequence = 0;
const plain = (value, limit = 2000) => String(value ?? "").slice(0, limit);
const integer = value => Number.isSafeInteger(value) && value > 0 && value <= 1000000;

function safeImage(value, document) {
  if (typeof value !== "string" || value.length > imageDataLimit) return null;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return null;
  try {
    const prefix = document.defaultView.atob(match[2].slice(0, 64));
    const octet = position => prefix.charCodeAt(position);
    if (match[1] === "png") {
      if (prefix.length < 24 || [137, 80, 78, 71, 13, 10, 26, 10].some((value, index) => octet(index) !== value) || prefix.slice(12, 16) !== "IHDR") return null;
      const number = start => octet(start) * 16777216 + octet(start + 1) * 65536 + octet(start + 2) * 256 + octet(start + 3);
      if (number(16) < 1 || number(20) < 1 || number(16) > 4096 || number(20) > 4096) return null;
    } else if (match[1] === "jpeg") {
      if (prefix.length < 4 || octet(0) !== 255 || octet(1) !== 216 || octet(2) !== 255) return null;
    } else if (prefix.length < 16 || prefix.slice(0, 4) !== "RIFF" || prefix.slice(8, 12) !== "WEBP") return null;
    return value;
  } catch {return null;}
}

/** Open an inert preview of one exact source version. Parent callbacks own
 * account routing, server preview generation and original-file downloads.
 * loadPreview receives a file page number and an optional {signal} argument.
 */
export function openFileViewer({document = globalThis.document, title = "Source file", loadPreview, download,
  version = {}, versionId = version.id || "", sha256 = version.sha256 || "", metadata, renderSpatial, onClose} = {}) {
  if (!document?.body || typeof loadPreview !== "function") throw new TypeError("A file viewer requires a document and a preview loader.");
  const previous = activeViewers.get(document);
  const restoreTarget = previous?.restoreTarget || document.activeElement;
  previous?.replace();
  const window = document.defaultView;
  const Controller = window.AbortController || globalThis.AbortController;
  const lifetime = new Controller();
  const id = `file-viewer-${++viewerSequence}`;
  let closed = false, generation = 0, previewController, spatialDispose, requestedPage = 1, loadedPage = 1;
  let pageCount = null, canPage = false, busy = false, zoom = 100, kind = "", downloadBusy = false, currentImage;
  let exactVersionId = plain(versionId, 500), exactSha256 = plain(sha256, 500), currentFilename = plain(version.filename, 1000);
  const background = [];
  const hadBodyClass = document.body.classList.contains("fv-modal-open");
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const button = (text, action) => {
    const element = make("button", "fv-button", text);element.type = "button";element.dataset.fileViewerAction = action;return element;
  };
  const overlay = make("div", "fv-overlay"), dialog = make("section", "file-viewer");
  dialog.setAttribute("role", "dialog");dialog.setAttribute("aria-modal", "true");dialog.setAttribute("aria-labelledby", `${id}-title`);dialog.setAttribute("aria-describedby", `${id}-identity`);dialog.tabIndex = -1;
  const themed = restoreTarget?.closest?.("[data-theme], [data-app-theme]") || document.body;
  const theme = themed.dataset.theme || themed.dataset.appTheme;
  if (theme) overlay.dataset.theme = theme;
  const header = make("header", "fv-header"), headingBox = make("div", "fv-heading"), heading = make("h2", "fv-title", plain(title || version.filename || "Source file", 2000));
  heading.id = `${id}-title`;headingBox.append(make("p", "fv-eyebrow", "Source file"), heading);
  const identity = make("p", "fv-identity");identity.id = `${id}-identity`;
  headingBox.append(identity);
  const closeButton = button("Close file", "close");header.append(headingBox, closeButton);
  const toolbar = make("div", "fv-toolbar"), pager = make("form", "fv-pager"), previousButton = button("Previous page", "previous"), nextButton = button("Next page", "next");
  pager.setAttribute("aria-label", "PDF file pages");
  const pageLabel = make("label", "fv-page-label", "File page"), pageInput = make("input", "fv-page-input");
  pageInput.type = "number";pageInput.name = "page";pageInput.min = "1";pageInput.step = "1";pageInput.required = true;pageInput.value = "1";pageInput.id = `${id}-page`;pageLabel.htmlFor = pageInput.id;
  const totalLabel = make("span", "fv-page-total", "of an unknown total");totalLabel.id = `${id}-total`;pageInput.setAttribute("aria-describedby", totalLabel.id);
  const goButton = button("Go to page", "go");goButton.type = "submit";
  pager.append(previousButton, pageLabel, pageInput, totalLabel, goButton, nextButton);
  const zoomBox = make("div", "fv-zoom");zoomBox.setAttribute("role", "group");zoomBox.setAttribute("aria-label", "Preview zoom");
  const zoomOut = button("−", "zoom-out"), zoomIn = button("+", "zoom-in"), fitButton = button("Fit width", "fit"), zoomLabel = make("output", "fv-zoom-label", "100%");
  zoomOut.setAttribute("aria-label", "Zoom out");zoomIn.setAttribute("aria-label", "Zoom in");zoomLabel.setAttribute("aria-label", "Preview zoom level");zoomBox.append(zoomOut, zoomLabel, zoomIn, fitButton);
  const downloadButton = typeof download === "function" ? button("Download original", "download") : null;
  toolbar.append(pager, zoomBox);if (downloadButton) toolbar.append(downloadButton);
  const status = make("p", "fv-status", "Loading preview…");status.setAttribute("role", "status");status.setAttribute("aria-live", "polite");
  const errorBox = make("p", "fv-error");errorBox.setAttribute("role", "alert");errorBox.hidden = true;
  const viewport = make("div", "fv-viewport");viewport.tabIndex = 0;viewport.setAttribute("role", "region");viewport.setAttribute("aria-label", "File preview; scroll to inspect the source");
  const warnings = make("ul", "fv-warnings");warnings.hidden = true;
  const details = make("details", "fv-metadata"), detailsSummary = make("summary", "", "Version and file metadata"), facts = make("dl", "fv-facts"), metadataText = make("pre", "fv-metadata-text");
  details.append(detailsSummary, facts);if (metadata !== undefined) {
    try {metadataText.textContent = JSON.stringify(metadata, null, 2)?.slice(0, 32000) || "No additional metadata.";} catch {metadataText.textContent = "Additional metadata could not be displayed.";}
    details.append(metadataText);
  }
  dialog.append(header, toolbar, status, errorBox, viewport, warnings, details);overlay.append(dialog);document.body.append(overlay);
  closeButton.focus();
  for (const element of [...document.body.children]) if (element !== overlay) {
    background.push({element, inert: element.getAttribute("inert"), ariaHidden: element.getAttribute("aria-hidden")});
    element.setAttribute("inert", "");element.setAttribute("aria-hidden", "true");
  }
  document.body.classList.add("fv-modal-open");

  function updateIdentity(payload = {}) {
    identity.textContent = [currentFilename || plain(payload.filename, 1000), exactVersionId && `Version ${exactVersionId}`, exactSha256 && `SHA256 ${exactSha256}`].filter(Boolean).join(" · ") || "Exact source preview supplied by this workspace.";
    facts.replaceChildren();
    for (const [label, value] of [["Filename", currentFilename || payload.filename], ["Version ID", exactVersionId], ["SHA256", exactSha256], ["Media type", payload.mediaType || version.mediaType], ["Original size", Number.isSafeInteger(payload.size ?? version.size) ? `${payload.size ?? version.size} bytes` : ""]]) if (value) facts.append(make("dt", "", label), make("dd", "", plain(value, 2000)));
  }
  function controls() {
    pager.hidden = kind !== "pdf";
    pageInput.value = String(requestedPage);pageInput.disabled = !canPage;pageInput.max = pageCount ? String(pageCount) : "";
    previousButton.disabled = !canPage || requestedPage <= 1;nextButton.disabled = !canPage || requestedPage >= pageCount;goButton.disabled = !canPage;
    totalLabel.textContent = pageCount ? `of ${pageCount}` : "of an unknown total";
    zoomBox.hidden = !currentImage;zoomLabel.textContent = `${zoom}%`;zoomOut.disabled = zoom === zoomLevels[0];zoomIn.disabled = zoom === zoomLevels.at(-1);
    if (downloadButton) downloadButton.disabled = downloadBusy;
    dialog.setAttribute("aria-busy", String(busy));
  }
  function setError(message) {errorBox.textContent = plain(message, 4000);errorBox.hidden = !message;}
  function clearPreview() {
    try {spatialDispose?.();} catch {}
    spatialDispose = null;currentImage = null;viewport.replaceChildren();
  }
  function applyZoom() {if (currentImage) currentImage.className = `fv-image-sheet fv-zoom-${zoom}`;controls();}
  function showText(value) {
    if (typeof value !== "string" || !value) return false;
    viewport.append(make("h3", "fv-content-heading", "Extracted text"), make("p", "fv-note", "Bounded text preview. Download the original for its complete content and formatting."), make("pre", "fv-text", value.slice(0, textLimit)));
    if (value.length > textLimit) viewport.append(make("p", "fv-note", `Text shown here is limited to ${textLimit.toLocaleString()} characters.`));
    return true;
  }
  function showTables(tables) {
    if (!Array.isArray(tables) || !tables.some(table => Array.isArray(table?.rows) && table.rows.length)) return false;
    let cells = 0, characters = 0, truncated = tables.length > 5;
    viewport.append(make("h3", "fv-content-heading", "Table preview"), make("p", "fv-note", "Values are shown as inert text. Formulas, links and workbook macros do not run in this preview."));
    for (const source of tables.slice(0, 5)) {
      if (!Array.isArray(source?.rows) || !source.rows.length || cells >= 3000 || characters >= textLimit) continue;
      const region = make("div", "fv-table-region"), table = make("table", "fv-table"), tbody = make("tbody");region.tabIndex = 0;region.setAttribute("role", "region");region.setAttribute("aria-label", plain(source.name || "Table", 500));
      table.append(make("caption", "", plain(source.name || "Table", 500)), tbody);
      if (source.rows.length > 100) truncated = true;
      for (const row of source.rows.slice(0, 100)) {
        if (!Array.isArray(row)) continue;
        if (cells >= 3000 || characters >= textLimit) {truncated = true;break;}
        if (row.length > 40) truncated = true;
        const tr = make("tr");
        for (const value of row.slice(0, 40)) {
          if (cells >= 3000 || characters >= textLimit) {truncated = true;break;}
          const valueText = plain(value, Math.min(2000, textLimit - characters));characters += valueText.length;cells++;tr.append(make("td", "", valueText));
        }
        tbody.append(tr);
      }
      region.append(table);viewport.append(region);
    }
    if (truncated) viewport.append(make("p", "fv-note", "This table preview is bounded to five sheets, 100 rows per sheet, 40 columns, 3,000 cells and 120,000 characters. Download the original for all data."));
    return true;
  }
  async function showPreview(payload, epoch) {
    if (!payload || typeof payload !== "object") throw new Error("The preview response is unavailable.");
    if (exactVersionId && payload.versionId !== exactVersionId || exactSha256 && payload.sha256 !== exactSha256) throw new Error("The preview belongs to a different source version. Reopen the intended file.");
    exactVersionId ||= plain(payload.versionId, 500);exactSha256 ||= plain(payload.sha256, 500);currentFilename ||= plain(payload.filename, 1000);
    const responsePage = payload.pageNumber;
    kind = plain(payload.kind, 100);
    if (kind === "pdf" && integer(responsePage) && responsePage !== requestedPage) throw new Error("The preview returned a different file page. Try loading the requested page again.");
    pageCount = integer(payload.pageCount) ? payload.pageCount : integer(payload.detected?.pageCount) ? payload.detected.pageCount : null;
    if (kind === "pdf" && pageCount && integer(responsePage) && responsePage > pageCount) throw new Error("The preview returned inconsistent file page information. Retry the intended file page.");
    canPage = kind === "pdf" && integer(responsePage) && Boolean(pageCount);
    loadedPage = integer(responsePage) ? responsePage : requestedPage;
    updateIdentity(payload);
    const notes = Array.isArray(payload.warnings) ? payload.warnings.slice(0, 20) : [];
    warnings.replaceChildren(...notes.map(note => make("li", "", plain(note, 2000))));warnings.hidden = !notes.length;
    const image = safeImage(payload.imageDataUrl, document);
    if (image) {
      const figure = make("figure", `fv-image-sheet fv-zoom-${zoom}`), img = make("img", "fv-page-image");img.src = image;
      img.alt = kind === "pdf" ? `PDF file page ${loadedPage}${pageCount ? ` of ${pageCount}` : ""}` : plain(payload.imageDescription || "Source image preview", 1000);
      figure.append(img, make("figcaption", "fv-image-caption", kind === "pdf" ? `File page ${loadedPage}${pageCount ? ` of ${pageCount}` : ""}. Printed pagination may differ.` : plain(payload.imageDescription || "Bounded source image preview", 2000)));
      viewport.append(figure);currentImage = figure;
    } else if (payload.imageDataUrl) viewport.append(make("p", "fv-note", "The supplied image could not be displayed safely. Download the original or use its extracted text."));
    if (kind === "spatial") {
      if (typeof renderSpatial === "function") {
        const host = make("div", "fv-spatial");viewport.append(host);
        const mounted = await renderSpatial(host, payload);
        const dispose = typeof mounted === "function" ? mounted : mounted?.dispose?.bind(mounted);
        if (closed || epoch !== generation) {dispose?.();return;}
        spatialDispose = dispose;
      } else {
        viewport.append(make("h3", "fv-content-heading", "Spatial source"), make("p", "fv-note", "Open the workspace's spatial view for an interactive map. The source properties below are a bounded text preview."));
        const properties = payload.spatial;
        if (properties) {let serialized;try {serialized = JSON.stringify(properties, null, 2);} catch {serialized = "Spatial properties unavailable.";}viewport.append(make("pre", "fv-text", serialized.slice(0, 32000)));}
      }
    } else if (!image) {
      const hasTables = Array.isArray(payload.tables) && payload.tables.some(table => Array.isArray(table?.rows) && table.rows.length);
      if (hasTables) showText(payload.text);
      const tableShown = showTables(payload.tables);
      if (!tableShown && !showText(payload.text)) viewport.append(make("h3", "fv-content-heading", "Preview unavailable"), make("p", "fv-note", downloadButton ? "A preview for this file format is not available on this device. Use Download original to open the complete file in a suitable application." : "A preview for this file format is not available on this device. Open the retained original from its document record in a suitable application."));
    } else if (typeof payload.text === "string" && payload.text) {
      const textDetails = make("details", "fv-extracted-text");textDetails.append(make("summary", "", "Extracted text excerpt"), make("pre", "fv-text", payload.text.slice(0, textLimit)));viewport.append(textDetails);
    }
    if (kind === "pdf" && !canPage) viewport.append(make("p", "fv-note", "This response provides a first-page preview only. Open the original for all pages, or retry when full page previews are available."));
    status.textContent = kind === "pdf" ? `PDF file page ${loadedPage}${pageCount ? ` of ${pageCount}` : ""}${image ? " ready." : " — image unavailable."}` : "File preview ready.";
  }
  async function goToPage(value) {
    if (closed) return false;
    const page = typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : value;
    if (!integer(page) || pageCount && page > pageCount || page !== 1 && !canPage) {setError(pageCount ? `Choose a file page from 1 to ${pageCount}.` : "Only the first page is available in this preview.");return false;}
    const epoch = ++generation;previewController?.abort();previewController = new Controller();
    requestedPage = page;busy = true;setError("");clearPreview();warnings.hidden = true;status.textContent = `Loading${kind === "pdf" || page !== 1 ? ` file page ${page}` : " file preview"}…`;viewport.append(make("p", "fv-loading", "Loading the exact source version…"));controls();
    try {
      const payload = await loadPreview(page, {signal: previewController.signal});
      if (closed || epoch !== generation) return false;
      clearPreview();await showPreview(payload, epoch);
      return !closed && epoch === generation;
    } catch (error) {
      if (!closed && epoch === generation) {clearPreview();setError(error?.message || "The file preview could not be loaded.");status.textContent = downloadButton ? "Preview could not be loaded. Close this viewer or download the original." : "Preview could not be loaded. You can close this viewer and return to the source record.";
        const retry = button("Retry preview", "retry");viewport.append(make("p", "fv-note", "Your retained original is unchanged."), retry);}
      return false;
    } finally {if (!closed && epoch === generation) {busy = false;controls();}}
  }
  function focusable() {return [...dialog.querySelectorAll("button,input,select,textarea,a[href],[tabindex],summary")].filter(element => element.tabIndex >= 0 && !element.disabled && !element.closest("[hidden]"));}
  function keydown(event) {
    if (closed) return;
    if (event.key === "Escape") {event.preventDefault();event.stopPropagation();close();return;}
    if (event.key !== "Tab") return;
    const elements = focusable(), first = elements[0], last = elements.at(-1);
    if (!first) {event.preventDefault();dialog.focus();return;}
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {event.preventDefault();last.focus();}
    else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {event.preventDefault();first.focus();}
  }
  function focusin(event) {if (!closed && !dialog.contains(event.target)) closeButton.focus();}
  async function click(event) {
    if (event.target === overlay) {close();return;}
    const action = event.target.closest?.("[data-file-viewer-action]")?.dataset.fileViewerAction;
    if (!action || closed) return;
    if (action === "close") close();
    else if (action === "previous") goToPage(requestedPage - 1);
    else if (action === "next") goToPage(requestedPage + 1);
    else if (action === "retry") goToPage(requestedPage);
    else if (action === "zoom-out" || action === "zoom-in") {zoom = zoomLevels[Math.max(0, Math.min(zoomLevels.length - 1, zoomLevels.indexOf(zoom) + (action === "zoom-in" ? 1 : -1)))];applyZoom();}
    else if (action === "fit") {zoom = 100;applyZoom();}
    else if (action === "download" && !downloadBusy && downloadButton) {
      downloadBusy = true;controls();setError("");
      try {await download({signal: lifetime.signal, versionId: exactVersionId, sha256: exactSha256});}
      catch (error) {if (!closed) setError(error?.message || "The original could not be downloaded.");}
      finally {if (!closed) {downloadBusy = false;controls();}}
    }
  }
  function submit(event) {event.preventDefault();goToPage(pageInput.value);}
  function close(restore = true) {
    if (closed) return false;closed = true;generation++;previewController?.abort();lifetime.abort();clearPreview();
    document.removeEventListener("keydown", keydown, true);document.removeEventListener("focusin", focusin, true);overlay.removeEventListener("click", click);pager.removeEventListener("submit", submit);
    overlay.remove();
    for (const {element, inert, ariaHidden} of background) {
      if (inert === null) element.removeAttribute("inert");else element.setAttribute("inert", inert);
      if (ariaHidden === null) element.removeAttribute("aria-hidden");else element.setAttribute("aria-hidden", ariaHidden);
    }
    if (!hadBodyClass) document.body.classList.remove("fv-modal-open");
    if (activeViewers.get(document)?.overlay === overlay) activeViewers.delete(document);
    if (restore && restoreTarget?.isConnected && typeof restoreTarget.focus === "function") restoreTarget.focus();
    onClose?.();return true;
  }
  document.addEventListener("keydown", keydown, true);document.addEventListener("focusin", focusin, true);overlay.addEventListener("click", click);pager.addEventListener("submit", submit);
  activeViewers.set(document, {overlay, restoreTarget, replace: () => close(false)});updateIdentity();controls();
  const ready = goToPage(1);
  return {ready, close: () => close(), goToPage};
}
