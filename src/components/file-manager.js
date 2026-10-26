import {mountProjectDocuments} from "./project-documents.js";
import {mountSourceIntake} from "./source-intake.js";
import {mountResearchArchive} from "./research-archive.js";
import {serializeGeoJsonData,parseGeoJsonData} from '../lib/geojson-editing.js';

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const option = (id, name, selected) => `<option value="${h(id)}"${id === selected ? " selected" : ""}>${h(name)}</option>`;
/** One Files entry point; custody/context are supplied to the shared utilities. */
export function mountFileManager(root, {request:provided, accountId:initialAccountId, projectId:initialProjectId = '', archives = true, embedded = false, capturePublicUrls = true, manageRegisteredFiles = true, allowSpatialEdits = true, onBusyChange} = {}) {
  if (provided !== undefined && typeof provided !== 'function') throw new TypeError('Files requires a request function.');
  const view = root.ownerDocument.defaultView, query = new URL(view.location.href).searchParams, controller = new AbortController();
  const state = {accountId: initialAccountId || query.get("account") || "local-default", accounts: [], collections: [], files: [], projects: [], filter: "", search: "", mode: archives && query.get("collection") ? `archive:${query.get("collection")}` : "account", message: "Opening file collections…", hasMore: false, cursor: null, project: null, versionId: ""};
  const documents = new Map(), intakes = new Map();let disposed = false, busy = false, ownBusy = false, childBusy = false, generation = 0, documentMount, intakeMount, archiveMount;
  let pendingNavigation;
  root.classList.add("local-workspace", "file-manager");
  async function request(path, {method = "GET", body, binary = false, signal} = {}, accountId = state.accountId) {
    if (disposed) throw Error('This Files context has closed.');
    const operation = signal ? new AbortController() : null, requestSignal = operation?.signal || controller.signal;
    const sources = signal ? [...new Set([controller.signal, signal])] : [], cancel = () => operation.abort();
    for (const source of sources) {if (source.aborted) cancel();else source.addEventListener('abort', cancel, {once:true});}
    const assertActive = () => {if (disposed) throw Error('This Files context has closed.');if (requestSignal.aborted) throw Object.assign(Error('This file request was cancelled.'), {name:'AbortError'});};
    try {
      assertActive();
      if (provided) {const result = await provided(path, {method,body,binary,signal:requestSignal}, accountId);assertActive();return result;}
      const response = await fetch(path, {method, credentials: "omit", cache: "no-store", redirect: "error", signal: requestSignal,
        headers: {"X-ESIA-Workspace": "local", "X-ESIA-Account": accountId, ...(body === undefined ? {} : {"Content-Type": "application/json"})}, ...(body === undefined ? {} : {body: body.command?.type === 'source-geojson-edit' ? serializeGeoJsonData(body,{maxBytes:3 * 1024 * 1024}) : JSON.stringify(body)})});
      assertActive();
      if (!response.ok) {const result = await response.json();assertActive();throw Object.assign(new Error(result.error || "File operation unavailable."),{status:response.status});}
      const result = binary ? await response.blob() : path.split('?')[0].endsWith('/spatial-edit-context') ? parseGeoJsonData(await response.text(),{maxBytes:3 * 1024 * 1024}) : await response.json();
      assertActive();return result;
    } finally {for (const source of sources) source.removeEventListener('abort', cancel);}
  }
  function locks(value) {childBusy = value;applyLocks();}
  function applyLocks() {busy = ownBusy || childBusy;root.setAttribute("aria-busy", String(busy));for (const control of root.querySelectorAll("[data-files-navigation] input,[data-files-navigation] select,[data-files-navigation] button,[data-files-index] button,[data-files-index] input,[data-files-index] select,[data-files-location]")) control.disabled = busy;onBusyChange?.(busy);}
  async function run(work) {if (busy || disposed) return;ownBusy = true;applyLocks();try {await work();} catch (error) {if (!disposed) {state.message = error.message;const status = root.querySelector("[data-files-status]");if (status) status.textContent = state.message;}} finally {ownBusy = false;if (!disposed) applyLocks();}}
  function download(blob, filename) {const url = URL.createObjectURL(blob), link = root.ownerDocument.createElement("a");link.href = url;link.download = filename.replace(/[\/\\\x00-\x1f]/g, "_");link.click();setTimeout(() => URL.revokeObjectURL(url), 30000);}
  function disposeChildren() {documentMount?.dispose();intakeMount?.dispose();archiveMount?.dispose();documentMount = intakeMount = archiveMount = null;}
  const hasDraft = () => !disposed && Boolean(documentMount?.hasDraft() || intakeMount?.hasDraft());
  function navigate(work) {
    if (busy || disposed) return;
    if (provided && hasDraft()) {pendingNavigation = work;const choice=root.querySelector('[data-files-leave-choice]');choice.hidden=false;choice.querySelector('[data-files-keep-draft]').focus();return;}
    void run(work);
  }
  async function loadFiles({append = false} = {}) {
    const epoch = ++generation, accountId = state.accountId, params = new URLSearchParams();
    if (state.filter) params.set("project_id", state.filter);if (state.search) params.set("search", state.search);if (append && state.cursor) params.set("after", state.cursor);
    const result = await request(`/api/files?${params}`, {}, accountId);
    if (disposed || epoch !== generation || accountId !== state.accountId) return;
    state.projects = result.projects;state.files = append ? [...state.files, ...result.files] : result.files;state.hasMore = result.hasMore;state.cursor = result.nextCursor;
    state.message = `${state.files.length} ${state.hasMore ? "loaded " : ""}files in this account${state.filter ? " collection" : " across projects"}.`;render();
  }
  async function selectProject(projectId, versionId = "") {
    const epoch = ++generation, accountId = state.accountId, project = await request(`/api/projects/${encodeURIComponent(projectId)}`, {}, accountId);
    if (disposed || epoch !== generation || accountId !== state.accountId) return;
    state.project = project;state.versionId = versionId;render();
    if (view.matchMedia?.("(max-width: 760px)").matches) root.querySelector("[data-files-detail]")?.scrollIntoView?.({block: "start", behavior: "smooth"});
  }
  async function command(fields) {
    const project = state.project, accountId = state.accountId;
    const updated = await request(`/api/projects/${encodeURIComponent(project.id)}/commands`, {method: "POST", body: {expectedRevision: project.revision, command: fields}}, accountId);
    if (disposed || state.accountId !== accountId || state.project?.id !== project.id) return;
    state.project = updated;
    // A committed write is successful even when the independent catalog refresh fails.
    try {await loadFiles();} catch {render();state.message = "Source change saved. Refresh the file catalog to update its listing.";}
  }
  function locationsMarkup() {
    const selected = state.mode === "account" ? state.project?.id || "" : state.mode;
    return `<nav class="fm-locations" aria-label="File locations"><button type="button" data-files-location=""${selected === "" ? ' aria-current="location"' : ""}>All files</button><h2>Projects</h2>${state.projects.map(project => `<button type="button" data-files-location="${h(project.id)}"${selected === project.id ? ' aria-current="location"' : ""}>${h(project.name)}</button>`).join("") || '<p>No projects in this account.</p>'}${state.collections.length ? `<h2>Research archives</h2>${state.collections.map(collection => `<button type="button" data-files-location="archive:${h(collection.id)}"${selected === `archive:${collection.id}` ? ' aria-current="location"' : ""}>${h(collection.name)}</button>`).join("")}` : ""}</nav>`;
  }
  function render() {
    if (disposed) return;disposeChildren();
    const accountId = state.accountId, account = state.accounts.find(item => item.id === accountId);
    root.innerHTML = `<header class="lw-header"><div><p class="lw-eyebrow">Professional workspace</p><h1>Files</h1><p>Browse, preview and organize your project sources.</p></div>${embedded ? '' : `<a href="/?account=${encodeURIComponent(accountId)}">Project workbench</a>`}</header><div data-files-leave-choice class="lw-panel" role="group" aria-label="Unsaved Files draft" hidden><p>Discard the current unsaved source or document edits before changing file context?</p><button type="button" data-files-discard-draft>Discard current draft and continue</button><button type="button" data-files-keep-draft>Keep editing</button></div><div class="fm-layout"><aside class="fm-sidebar"><section class="lw-panel" data-files-navigation><div class="lw-grid"><label><span>File space</span><select data-files-mode>${option("account", "Files", state.mode)}${state.collections.map(collection => option(`archive:${collection.id}`, `${collection.name} — public research archive`, state.mode)).join("")}</select></label><label><span>Account</span><select data-files-account>${state.accounts.map(item => option(item.id, item.name, accountId)).join("")}</select></label></div><p class="lw-small">${h(account?.name || "Select an account")}</p>${locationsMarkup()}</section></aside><div class="fm-main"><nav class="fm-breadcrumbs" aria-label="File location"><button type="button" data-files-location="">Files</button><span aria-hidden="true">/</span><span>${h(account?.name || "Account")}</span>${state.project && state.mode === "account" ? `<span aria-hidden="true">/</span><span aria-current="page">${h(state.project.name)}</span>` : ""}</nav><p data-files-status role="status">${h(state.message)}</p>
      ${state.mode === "account" ? `<section class="lw-panel" data-files-index${state.project ? " hidden" : ""}><h2>Account file catalog</h2><form data-files-search-form class="lw-form lw-grid"><label><span>Project filter</span><select name="projectId">${option("", "All projects", state.filter)}${state.projects.map(project => option(project.id, project.name, state.filter)).join("")}</select></label><label><span>Search titles, metadata and tags</span><input name="search" type="search" value="${h(state.search)}"></label><button type="submit">Search files</button></form><div class="pd-table-region" tabindex="0" role="region" aria-label="Files across the selected account"><table class="pd-table fm-file-table"><caption class="pd-sr-only">Files in this account. Open a name to inspect its exact source version.</caption><thead><tr><th scope="col">File</th><th scope="col">Project context</th><th scope="col">Type / size</th><th scope="col">Tags</th></tr></thead><tbody>${state.files.map(file => `<tr><th scope="row"><button type="button" class="fm-file-name" data-files-open="${h(file.version.id)}" data-files-project="${h(file.projectId)}">${h(file.title)}</button><small class="pd-filename">${h(file.version.filename)}</small></th><td>${h(file.projectName)}</td><td>${h(file.version.mediaType)} · ${Math.round(file.version.size / 1024)} KiB</td><td>${(file.metadata.tags || []).map(tag => h(tag.label)).join(" · ")}</td></tr>`).join("") || '<tr><td colspan="4">No sources match. Select a destination below to add files.</td></tr>'}</tbody></table></div>${state.hasMore ? '<button type="button" data-files-more>Load more files</button>' : ""}<label><span>Destination for incoming sources</span><select data-files-destination><option value="">Choose a project in this account</option>${state.projects.map(project => option(project.id, project.name, state.project?.id)).join("")}</select></label><p class="lw-small">Choose a destination when saving a new source. Metadata, tags, preview and version controls are shared with the project library.</p></section>${state.project ? `<section class="lw-panel" data-files-detail><h2 class="fm-context-heading">${h(state.project.name)}</h2><div data-files-documents></div><details><summary>${capturePublicUrls ? "Add files, email attachments or a public URL" : "Add files or email attachments"}</summary><div data-files-intake></div></details></section>` : ""}` : '<div data-files-archive></div>'}</div></div>`;
    if (state.mode.startsWith("archive:")) archiveMount = mountResearchArchive(root.querySelector("[data-files-archive]"), {collectionId: state.mode.slice(8), embedded: true});
    else if (state.project) {
      const projectId = state.project.id, key = `${accountId}:${projectId}`, scopedRequest = (path, options) => request(path, options, accountId);
      if (!documents.has(key)) documents.set(key, {});if (state.versionId) documents.get(key).selectedVersionId = state.versionId;
      if (!intakes.has(key)) intakes.set(key, {accountId});
      documentMount = mountProjectDocuments(root.querySelector("[data-files-documents]"), {getProject: () => state.project, getAccountId: () => accountId, request: scopedRequest, state: documents.get(key), onBusyChange: locks,
        ...(allowSpatialEdits ? {saveSpatialEdit:async (payload, {expectedRevision}) => {
          const result = await scopedRequest(`/api/projects/${encodeURIComponent(projectId)}/spatial-edits`, {method:'POST',body:{expectedRevision,command:{type:'source-geojson-edit',...payload}}});
          if (disposed || state.accountId !== accountId || state.project?.id !== projectId) throw Error('This file context has closed.');
          if (result.project?.id !== projectId || result.receipt?.resourceId !== payload.resourceId ||
              result.receipt?.baseVersionId !== payload.baseVersionId || result.receipt?.baseSha256 !== payload.baseSha256 ||
              result.receipt?.requestId !== payload.requestId || !result.project.resources?.some(resource => resource.id === payload.resourceId &&
                resource.versions.some(version => version.id === result.receipt.versionId && version.sha256 === result.receipt.sha256))) throw Error('The saved map receipt differs from the selected source.');
          state.project = result.project;state.versionId = result.receipt.versionId;return result;
        }} : {}),
        saveMetadata: (versionId, metadata) => command({type: "metadata", versionId, metadata}), ...(manageRegisteredFiles ? {capture: versionId => command({type: "capture", versionId}), relink: (versionId, path) => command({type: "relink", versionId, path})} : {}),
        download: async (versionId, {signal} = {}) => {const version = state.project.resources.flatMap(resource => resource.versions).find(version => version.id === versionId);const bytes = await scopedRequest(`/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}/download`, {method: "POST", binary: true, signal});if (!disposed && !signal?.aborted && state.accountId === accountId && state.project?.id === projectId) download(bytes, version.filename);}});
      intakeMount = mountSourceIntake(root.querySelector("[data-files-intake]"), {request: scopedRequest, save: command, getProject: () => state.project, getAccountId: () => accountId, state: intakes.get(key), onBusyChange: locks,capturePublicUrls});
    }
    applyLocks();
  }
  const onClick = event => {
    if (event.target.closest('[data-files-keep-draft]')) {pendingNavigation=undefined;root.querySelector('[data-files-leave-choice]').hidden=true;return;}
    if (event.target.closest('[data-files-discard-draft]')) {const work=pendingNavigation;pendingNavigation=undefined;if (!work || busy) return;const key=`${state.accountId}:${state.project?.id}`;documents.delete(key);intakes.delete(key);disposeChildren();void run(work);return;}
    const location = event.target.closest("[data-files-location]");
    if (location) {
      const target = location.dataset.filesLocation;
      navigate(async () => {
        if (target.startsWith("archive:")) {if (!archives || !state.collections.some(item => `archive:${item.id}` === target)) return;state.mode = target;render();return;}
        if (target && !state.projects.some(project => project.id === target)) return;
        state.mode = "account";state.filter = target;state.search = "";state.project = null;state.versionId = "";
        if (target) await selectProject(target);
        await loadFiles();
      });return;
    }
    const open = event.target.closest("[data-files-open]");if (open) {navigate(() => selectProject(open.dataset.filesProject, open.dataset.filesOpen));return;}
    if (event.target.closest("[data-files-more]")) void run(() => loadFiles({append: true}));
  };
  const onChange = event => {
    if (event.target.matches("[data-files-account]")) {const id = event.target.value;event.target.value=state.accountId;if (busy || !state.accounts.some(item=>item.id===id)) return;navigate(async () => {disposeChildren();state.accountId = id;state.project = null;state.versionId = "";state.files = [];state.projects = [];state.filter = "";state.message = "Opening this custody account…";render();await loadFiles();});}
    else if (event.target.matches("[data-files-mode]")) {const mode=event.target.value;event.target.value=state.mode;if (busy || mode!=='account' && (!archives || !state.collections.some(item=>`archive:${item.id}`===mode))) return;navigate(async()=>{state.mode=mode;render();});}
    else if (event.target.matches("[data-files-destination]") && event.target.value) {const id=event.target.value;event.target.value=state.project?.id || '';if (busy) return;navigate(() => selectProject(id));}
  };
  const onSubmit = event => {if (!event.target.matches("[data-files-search-form]")) return;event.preventDefault();const data = new view.FormData(event.target);void run(async () => {state.search = data.get("search");state.filter = data.get("projectId");await loadFiles();});};
  root.addEventListener("click", onClick);root.addEventListener("change", onChange);root.addEventListener("submit", onSubmit);render();
  const ready = run(async () => {
    const [accounts, archiveResult] = await Promise.all([request("/api/storage-accounts"), archives ? request("/api/research-archives") : Promise.resolve({collections:[]})]);
    if (disposed) return;state.accounts = accounts;state.collections = archiveResult.collections;if (!accounts.some(account => account.id === state.accountId)) throw new Error("Select an available custody account.");await loadFiles();if (initialProjectId && !disposed) await selectProject(initialProjectId);
  });
  return {ready,hasDraft,hasPendingWork:()=>!disposed&&busy,getScope:()=>({accountId:state.accountId,projectId:state.project?.id||''}),dispose() {if(disposed)return;disposed = true;++generation;controller.abort();disposeChildren();root.removeEventListener("click", onClick);root.removeEventListener("change", onChange);root.removeEventListener("submit", onSubmit);onBusyChange?.(false);}};
}
