// ESIA local operating profile; the loopback runtime owns all records.
import {frameworks, frameworkTopics, getFramework, getAuditChecks, getAuditContext, auditCheckSets, frameworkSourceCheckDate, registerDetailedRequirementPack} from "../lib/framework-register.js";
import {mountSourceIntake, readMetadata} from "./source-intake.js";
import {mountProjectDocuments} from "./project-documents.js";
import {mountProjectDirectory} from "./project-directory.js";
import {mountProjectFileSharing} from "./project-file-sharing.js";
import {mountWorkQueue} from "./work-queue.js";
import {getSectorProfile} from "../lib/sector-risk-profiles.js";
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const options = (items, selected = "") => items.map(([value, label]) => `<option value="${escapeHtml(value)}"${String(value) === String(selected) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
const field = (label, name, {type = "text", value = "", required = false, placeholder = "", wide = false} = {}) => `<label${wide ? ' class="lw-wide"' : ""}><span>${escapeHtml(label)}</span><input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(value)}"${required ? " required" : ""}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ""}></label>`;
const area = (label, name, {required = false, rows = 3, placeholder = ""} = {}) => `<label class="lw-wide"><span>${escapeHtml(label)}</span><textarea name="${escapeHtml(name)}" rows="${rows}"${required ? " required" : ""}${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ""}></textarea></label>`;
const select = (label, name, items, {required = true, selected = ""} = {}) => `<label><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}"${required ? " required" : ""}>${options(items, selected)}</select></label>`;
function captureMetadataFields() {
  return `<details class="lw-wide"><summary>Saved web capture metadata (optional)</summary><p class="lw-small">Describe the saved file you supply. Enter capture time, method and result when adding metadata. This does not fetch or archive a live URL.</p><div class="lw-grid">${field("Original URL", "originalUrl", {type: "url"})}${field("Final URL", "finalUrl", {type: "url"})}${field("Capture time (ISO, including timezone)", "capturedAt", {placeholder: "YYYY-MM-DDTHH:mm:ssZ"})}${field("Capture method", "captureMethod", {placeholder: "For example, browser save or SingleFile"})}${area("Capture result / limitations", "captureResult", {placeholder: "Complete or incomplete; describe missing content."})}</div></details>`;
}
const button = (label, action, extra = "") => `<button type="button" data-action="${action}" ${extra}>${escapeHtml(label)}</button>`;
const displayValue = value => typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "unknown");
const safeFilename = value => String(value || "project").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 150);
const recordTitle = (value, maximum=140) => {const text=String(value??'').replace(/\s+/g,' ').trim();return text.length>maximum?text.slice(0,maximum-3).trimEnd()+'…':text;};

export function mountLocalWorkspace(root, {baseUrl = "", invalidation} = {}) {
  if (!root || typeof root.addEventListener !== "function") throw new TypeError("A workspace root is required.");
  const origin = new URL(globalThis.location.href);
  const target = new URL(baseUrl || origin.origin, origin);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) || origin.protocol !== "http:" ||
      target.origin !== origin.origin || target.username || target.password || target.search || target.hash || target.pathname !== "/") {
    root.textContent = "Start ESIA locally at http://127.0.0.1:4173 to work with local records.";
    return {dispose() {}};
  }
  root.classList.add("local-workspace");
  const controller = new AbortController();
  const query = origin.searchParams;
  let workspaceTask = query.get("task") || ({"#import-project": "import", "#new-project": "create"}[origin.hash] ?? "");
  const initialFramework = getFramework(query.get("framework"))?.id || "wb_esf_2016";
  const initialCheckSet = auditCheckSets(initialFramework).some(item => item.id === query.get("checkSet")) ? query.get("checkSet") : "curated";
  const initialCheck = getAuditChecks(initialFramework, initialCheckSet).find(item => item.id === query.get("check"));
  const state = {accounts: [], accountId: query.get("account") || "local-default", projects: [], project: null, busy: false, intakeBusy: false, documentBusy: false, sharingBusy: false, directoryBusy: false, directory: {}, message: "Opening local records…", error: false, drafts: new Map(),
    auditFramework: initialFramework, auditCheckSet: initialCheckSet, auditTopic: "all", auditCheckId: initialCheck?.id || "",
    sector: getSectorProfile(query.get("sector"))?.id || "", libraryError: "", activeAudit: initialCheck ? getAuditContext(initialFramework, initialCheck.id, initialCheckSet) : null};
  const draftKey = name => `${state.accountId}:${state.project?.id || "global"}:${name}${name === "assessment" ? `:${state.activeAudit?.checkId || "manual"}` : ""}`;
  let disposed = false, selection = 0, intakeMount, documentsMount, directoryMount, sharingMount, workQueueMount;
  const workQueueStates = new Map();
  const intakeDrafts = new Map();
  const documentDrafts = new Map();
  const sharingDrafts = new Map();
  const intakeDisabledByRoot = new WeakMap();
  const auditContext = () => {const context = getAuditContext(state.auditFramework, state.auditCheckId, state.auditCheckSet); const sector = getSectorProfile(state.sector); if (sector) context.sector = structuredClone(sector); return context;};
  async function loadRequirements() {
    if (!["detailed", "diagnostic"].includes(state.auditCheckSet) || getAuditChecks(state.auditFramework, "detailed").length) return;
    const frameworkId = state.auditFramework;
    try {const pack = await request(`/api/requirements/${encodeURIComponent(frameworkId)}`); registerDetailedRequirementPack(pack); state.libraryError = "";}
    catch (error) {state.libraryError = error.message; throw error;}
  }

  async function request(path, {method = "GET", body, binary = false} = {}) {
    const response = await fetch(`${target.origin}${path}`, {method, credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
      headers: {"X-ESIA-Workspace": "local", "X-ESIA-Account": state.accountId, ...(body === undefined ? {} : {"Content-Type": "application/json"})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    if (disposed) throw new Error("The workspace page has closed.");
    if (!response.ok) {
      let message = `The local request failed (${response.status}).`;
      try {const result = await response.json(); message = result.error?.message || result.error || result.message || message;} catch {}
      if (response.status === 409 && /project changed|stale.*revision/i.test(message)) message = `${message} Refresh the project before retrying. Your current form entries remain on this page.`;
      throw Object.assign(new Error(String(message)), {status: response.status});
    }
    return binary ? response.blob() : response.json();
  }

  function announce(message, error = false) {
    state.message = message; state.error = error;
    const status = root.querySelector("[data-status]");
    if (status) {status.textContent = message; status.classList.toggle("lw-error", error); status.setAttribute("role", error ? "alert" : "status");}
  }

  function rememberForms(except) {
    for (const form of root.querySelectorAll("form[data-form]")) {
      const name = form.dataset.form;
      if (name === except) continue;
      const key = draftKey(name), values = {};
      for (const control of form.elements) {
        if (!control.name || ["file", "submit", "button"].includes(control.type)) continue;
        values[control.name] ||= [];
        if (["checkbox", "radio"].includes(control.type) && !control.checked) continue;
        values[control.name].push(control.value);
      }
      state.drafts.set(key, values);
    }
  }

  function restoreForms() {
    for (const form of root.querySelectorAll("form[data-form]")) {
      const values = state.drafts.get(draftKey(form.dataset.form));
      if (!values) continue;
      for (const control of form.elements) {
        if (!control.name || control.type === "file" || !Object.hasOwn(values, control.name)) continue;
        if (control.type === "checkbox" || control.type === "radio") control.checked = values[control.name].includes(control.value);
        else if (values[control.name].length) control.value = values[control.name][0];
      }
    }
  }

  function applyLocks() {
    root.setAttribute("aria-busy", String(state.busy || state.intakeBusy || state.documentBusy || state.sharingBusy || state.directoryBusy));
    for (const control of root.querySelectorAll("button, input, textarea, select")) {
      if (control.closest("[data-local-work-queue]")) continue;
      const intakeControl = control.closest("[data-source-intake]"), documentControl = control.closest("[data-project-documents]"), sharingControl = control.closest("[data-project-file-sharing]");
      if (intakeControl || documentControl || sharingControl) {
        if (state.busy || (intakeControl ? state.documentBusy || state.sharingBusy : documentControl ? state.intakeBusy || state.sharingBusy : state.intakeBusy || state.documentBusy)) {
          if (!intakeDisabledByRoot.has(control)) intakeDisabledByRoot.set(control, control.disabled);
          control.disabled = true;
        } else if (intakeDisabledByRoot.has(control)) {
          control.disabled = intakeDisabledByRoot.get(control);intakeDisabledByRoot.delete(control);
        }
      }
      else control.disabled = state.busy || state.intakeBusy || state.documentBusy || state.sharingBusy || state.directoryBusy;
    }
  }
  function setBusy(value) {state.busy = value; applyLocks();}
  const currentAccount = () => state.accounts.find(account => account.id === state.accountId);
  const accountLabel = () => currentAccount()?.name || "Select an available account";
  function updateAccountAddress() {
    origin.searchParams.set("account", state.accountId);
    if (state.project) origin.searchParams.set("project", state.project.id);
    else origin.searchParams.delete("project");
    root.ownerDocument.defaultView.history.replaceState(null, "", origin.pathname + origin.search + origin.hash);
  }
  function finishWorkspaceTask() {
    workspaceTask = "";
    origin.searchParams.delete("task");
    if (["#import-project", "#new-project"].includes(origin.hash)) origin.hash = "";
  }
  async function refreshAccounts() {state.accounts = await request("/api/storage-accounts");}
  async function switchAccount(id) {
    rememberForms(); ++selection; state.accountId = id; state.projects = []; state.project = null; state.activeAudit = null; state.auditCheckId = "";
    updateAccountAddress(); render(); await refreshList(); render();
    announce(`Opened storage account ${accountLabel()}. Only its projects and files are shown.`);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = filename; link.hidden = true; root.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  function fieldCaptureHref(requirement) {
    const query = new URLSearchParams({account: state.accountId});
    if (state.project) {query.set("project", state.project.id);query.set("projectName", state.project.name);}
    if (requirement) for (const key of ["authority", "name", "edition", "clause"]) if (requirement[key]) query.set(key, requirement[key]);
    return `/fieldwork?${query}`;
  }

  const projectPath = () => `/api/projects/${encodeURIComponent(state.project.id)}`;
  const allVersions = () => (state.project?.resources || []).flatMap(resource => resource.versions.map(version => ({resource, version})));

  async function refreshList() {
    const accountId = state.accountId, result = await request("/api/projects");
    if (state.accountId !== accountId) return;
    state.projects = Array.isArray(result) ? result : result.projects;
    state.directory.loaded = false;
  }

  async function openProject(id, {preserve = true} = {}) {
    if (preserve) rememberForms();
    const current = ++selection, accountId = state.accountId;
    const project = await request(`/api/projects/${encodeURIComponent(id)}`);
    if (current !== selection || accountId !== state.accountId || disposed) return;
    state.project = project.project || project;
    updateAccountAddress();
    if (state.project.projectContext) {
      state.directory.selected = state.project.projectContext.identity.id;
      const selectedFrameworks = state.project.projectContext.frameworkIds;
      if (selectedFrameworks.length && !selectedFrameworks.includes(state.auditFramework)) {state.auditFramework = selectedFrameworks[0];state.auditCheckSet = "curated";state.auditCheckId = "";state.activeAudit = null;}
    }
    announce(`Opened ${state.project.name}. Records are stored by the local service.`);
    render();
    root.querySelector("[data-project-heading]")?.focus();
    let anchor=root.ownerDocument.defaultView.location.hash.slice(1);
    try {anchor=decodeURIComponent(anchor);} catch { /* A malformed fragment remains a harmless unmatched ID. */ }
    if (anchor.startsWith("lw-action-")) root.ownerDocument.getElementById(anchor)?.scrollIntoView?.({block:"start"});
  }

  async function command(fields, formName, {focus = true} = {}) {
    rememberForms();
    const projectId = state.project.id, accountId = state.accountId, result = await request(`${projectPath()}/commands`, {
      method: "POST", body: {expectedRevision: state.project.revision, command: fields}
    });
    if (state.project?.id !== projectId || state.accountId !== accountId) return;
    state.project = result.project || result;
    if (["action","action-update"].includes(fields.type) && workQueueStates.has(accountId)) workQueueStates.get(accountId).stale=true;
    state.drafts.delete(draftKey(formName));
    // The command is already committed. A sidebar refresh failure must not turn
    // a successful save into a retry that creates another resource.
    try {await refreshList();}
    catch {
      state.projects = state.projects.map(item => item.id === state.project.id ? {...item, name: state.project.name, revision: state.project.revision} : item);
    }
    render();
    const savedForm = [...root.querySelectorAll("form[data-form]")].find(form => form.dataset.form === formName);
    const heading = savedForm?.closest("section")?.querySelector("h2") || root.querySelector("[data-project-heading]");
    if (focus && heading) {heading.tabIndex = -1; heading.focus({preventScroll: true});}
  }

  function render() {
    if (disposed) return;
    const project = state.project;
    intakeMount?.dispose();
    documentsMount?.dispose();
    directoryMount?.dispose();
    sharingMount?.dispose();
    workQueueMount?.dispose();
    root.innerHTML = `<header class="lw-header"><div><p class="lw-eyebrow">Environmental &amp; social professional workspace</p><h1>E&amp;S Review</h1><p>Source records, reviewed assessments and reproducible reports.</p></div><span class="lw-badge">ESIA · running locally</span></header>
      <nav class="lw-steps" aria-label="Start a project"><a href="?account=${encodeURIComponent(state.accountId)}&amp;task=create#new-project" data-local-task="create">New project</a><a href="?account=${encodeURIComponent(state.accountId)}&amp;task=import#import-project" data-local-task="import">Import project</a></nav>
      <section class="lw-panel lw-work-queue" data-local-work-queue></section>
      <nav class="lw-steps" aria-label="Professional workspace"><a href="/library">Resource library</a><a href="/engagements?account=${encodeURIComponent(state.accountId)}${state.project ? `&amp;project=${encodeURIComponent(state.project.id)}` : ""}">Professional engagements</a><a href="${escapeHtml(fieldCaptureHref())}">Capture field record</a><a href="/oversight?account=${encodeURIComponent(state.accountId)}">E&amp;S oversight</a><a href="/oversight-consolidation">Consolidated portfolio</a><a href="/oversight-comparison">Period comparisons</a><a href="/oversight-backup?account=${encodeURIComponent(state.accountId)}">Oversight backups</a><a href="/?account=${encodeURIComponent(state.accountId)}">Projects and evidence</a><a href="/files?account=${encodeURIComponent(state.accountId)}">Files</a><a href="/audits?account=${encodeURIComponent(state.accountId)}">Institution audits</a><a href="/frameworks?account=${encodeURIComponent(state.accountId)}">Compare frameworks</a><a href="/publications?account=${encodeURIComponent(state.accountId)}${state.project ? `&project=${encodeURIComponent(state.project.id)}` : ""}">Publication studio</a><a href="/practice?account=${encodeURIComponent(state.accountId)}">Professional workflows</a><a href="/sectors?account=${encodeURIComponent(state.accountId)}">Sector risk profiles</a></nav>
      <p class="lw-mode">Client files stay local. URL capture fetches only the public source you choose. Keep the local service running.</p>
      <section class="lw-panel" data-project-directory></section>
      <section class="lw-account-panel" aria-labelledby="lw-account-title"><div><h2 id="lw-account-title">Storage account</h2><p class="lw-small">Choose the organisation or practitioner account whose records you are working with.</p></div><label><span>Active account</span><select data-account-select>${state.accounts.length ? state.accounts.map(account => `<option value="${escapeHtml(account.id)}"${account.id === state.accountId ? " selected" : ""}>${escapeHtml(account.name)}</option>`).join("") : `<option value="${escapeHtml(state.accountId)}">Opening accounts…</option>`}</select></label><p class="lw-small" data-account-context>${escapeHtml(currentAccount()?.organization || "Organization not recorded")} · Recorded data owner: ${escapeHtml(currentAccount()?.dataOwner || "Not recorded")}. Local accounts separate storage for this device's user; shared-user permissions belong to the hosted workspace.</p><details><summary>Create a separate storage account</summary><form data-form="account" class="lw-form lw-grid">${field("Account name", "name", {required: true, placeholder: "IFC — River Bridge review"})}${field("Organisation / contracting party", "organization")}${field("Recorded data owner", "dataOwner", {placeholder: "Leave blank if ownership is not established"})}<button type="submit">Create storage account</button></form></details></section>
      <p class="lw-feedback${state.error ? " lw-error" : ""}" data-status role="${state.error ? "alert" : "status"}" aria-live="polite">${escapeHtml(state.message)}</p>
      <div class="lw-layout"><aside class="lw-sidebar" aria-label="Projects">
        <section class="lw-panel"><h2>Projects in ${escapeHtml(accountLabel())}</h2>${state.projects.length ? `<ul class="lw-projects">${state.projects.map(item => `<li><button type="button" data-action="open" data-id="${escapeHtml(item.id)}"${item.id === project?.id ? ' aria-current="true"' : ""}><span class="lw-project-name">${escapeHtml(item.name)}</span><small>Revision ${escapeHtml(item.revision)}</small></button></li>`).join("")}</ul>` : "<p>No local projects yet.</p>"}
        ${button("Refresh projects", "refresh-list")}</section>
        <section class="lw-panel" id="new-project"><details${!project || workspaceTask === "create" ? " open" : ""}><summary>Create a project</summary><form data-form="project" class="lw-form">${select("Project identity (optional)", "realWorldProjectId", [["", "Link to a project after creating this review"], ...(state.directory.identities || []).map(item => [item.id, item.name])], {required: false, selected: state.directory.selected || ""})}${field("Project / transaction review name", "name", {required: true})}${field("Client / organization", "client", {required: true})}${select("Engagement phase", "phase", ["Scoping", "Due diligence", "Implementation", "Monitoring", "Post-investment review"].map(value => [value, value]))}${field("Reporting period", "period", {required: true, placeholder: "For example, October 2026"})}<button type="submit">Create project</button></form></details></section>
        <section class="lw-panel" id="import-project"><details${!project || workspaceTask === "import" ? " open" : ""}><summary>Import a project package</summary><p>Choose an E&amp;S Review JSON package to reopen its project, evidence, assessments and saved reports on this computer.</p><form data-form="import" class="lw-form"><label><span>Project package</span><input type="file" name="package" accept=".json,application/json" required></label><label class="lw-checkbox"><input type="checkbox" name="adoptLegacyAccount"><span>Assign a legacy package without an account record to this account.</span></label><label class="lw-checkbox"><input type="checkbox" name="restoreOwningAccount"><span>Restore the package’s owning account and open the project there.</span></label><p class="lw-small">Choose “Restore the package’s owning account” when opening a package from another account. This keeps its original account identity and checks for duplicate projects.</p><button type="submit">Validate and import</button></form></details></section>
      </aside><div class="lw-main">${project ? renderProject(project) : '<section class="lw-panel lw-empty"><h2>Start with a project</h2><p>Create a project and engagement, or import a package. Then register or capture a source, cite its exact version and record your review.</p></section>'}</div></div>`;
    const reviewSection = root.querySelector("#lw-review");
    if(!workQueueStates.has(state.accountId))workQueueStates.set(state.accountId,{});
    workQueueMount=mountWorkQueue(root.querySelector("[data-local-work-queue]"),{request,getAccountId:()=>state.accountId,accountLabel:accountLabel(),state:workQueueStates.get(state.accountId),enabled:Boolean(currentAccount())});
    directoryMount = mountProjectDirectory(root.querySelector("[data-project-directory]"), {request, state: state.directory, getProject: () => state.project, getAccountId: () => state.accountId,
      onBusyChange: value => {state.directoryBusy = value;applyLocks();},
      openFacet: facet => run(async () => {rememberForms();await switchAccount(facet.accountId);await openProject(facet.projectId);}),
      updated: async (id, accountId) => {if (id && state.accountId === accountId) {state.directory.loaded = false;await openProject(id);} else if (!id) {rememberForms();render();}},
      capture: reference => {if (!state.project) return;rememberForms();const key = `${state.accountId}:${state.project.id}`;if (!intakeDrafts.has(key)) intakeDrafts.set(key, {accountId: state.accountId});intakeDrafts.get(key).captureUrl = reference.url;render();root.querySelector("[data-intake-section]").open = true;root.querySelector('[data-intake-form="url"] input[name="url"]')?.focus();announce("Public source URL ready. Capture it for review, verify its metadata and version, then save it in this account.");}});
    if (project && reviewSection) reviewSection.insertAdjacentHTML("beforebegin", renderAuditPanel(project));
    if (project) {
      const intakeKey = `${state.accountId}:${project.id}`;
      if (!sharingDrafts.has(intakeKey)) sharingDrafts.set(intakeKey, {});
      sharingMount = mountProjectFileSharing(root.querySelector("[data-project-file-sharing]"), {request, getProject: () => state.project, getAccountId: () => state.accountId, state: sharingDrafts.get(intakeKey),
        onBusyChange: value => {state.sharingBusy = value;applyLocks();},
        updated: async (id, accountId) => {if (state.accountId === accountId && state.project?.id === id) await openProject(id);},
        openVersion: versionId => {rememberForms();if (!documentDrafts.has(intakeKey)) documentDrafts.set(intakeKey, {});Object.assign(documentDrafts.get(intakeKey), {selectedVersionId: versionId, includeEarlier: true, search: "", type: "all", tag: "all", availability: "all"});render();root.querySelector("#lw-documents")?.scrollIntoView?.({block: "start"});}});
      if (!intakeDrafts.has(intakeKey)) intakeDrafts.set(intakeKey, {accountId: state.accountId});
      intakeMount = mountSourceIntake(root.querySelector("[data-source-intake]"), {request, getProject: () => state.project,
        save: fields => command(fields, "source-intake"), captureUrl: query.get("capture") || "", state: intakeDrafts.get(intakeKey), getAccountId: () => state.accountId, onBusyChange: value => {state.intakeBusy = value; applyLocks();}});
      if (!documentDrafts.has(intakeKey)) documentDrafts.set(intakeKey, {});
      documentsMount = mountProjectDocuments(root.querySelector("[data-project-documents]"), {request, getProject: () => state.project,
        getAccountId: () => state.accountId, state: documentDrafts.get(intakeKey),
        saveMetadata: (versionId, metadata) => command({type: "metadata", versionId, metadata}, "document-metadata", {focus: false}),
        capture: versionId => command({type: "capture", versionId}, "document-capture", {focus: false}),
        relink: (versionId, path) => command({type: "relink", versionId, path}, "document-relink", {focus: false}),
        download: async versionId => {
          const version = allVersions().find(item => item.version.id === versionId)?.version;
          if (!version) throw new Error("The selected source version is unavailable.");
          const blob = await request(`${projectPath()}/versions/${encodeURIComponent(versionId)}/download`, {method: "POST", binary: true});
          download(blob, safeFilename(version.filename));
        }, onBusyChange: value => {state.documentBusy = value; applyLocks();}});
    }
    restoreForms();
    for (const [index, article] of [...root.querySelectorAll("#lw-review > .lw-record-list > article")].entries()) {
      const context = project.assessments[index]?.auditContext;
      if (context) {
        const provenance = document.createElement("p"); provenance.className = "lw-small";
        provenance.textContent = `Check ${context.checkId} · ${context.checkSet} · registry ${context.registryVersion}; source references retained with this assessment.`;
        (article.querySelector('[data-local-assessment-details]')||article).append(provenance);
      }
    }
    const assessmentForm = root.querySelector('form[data-form="assessment"]');
    if (assessmentForm) {
      for (const [name, key] of [["authority", "authority"], ["frameworkName", "name"], ["edition", "edition"], ["clause", "clause"]]) {
        assessmentForm.elements[name].readOnly = Boolean(state.activeAudit);
        if (state.activeAudit) assessmentForm.elements[name].value = state.activeAudit.framework[key];
      }
      if (state.activeAudit) {
        const summary = document.createElement("p"); summary.className = "lw-note";
        summary.textContent = `Currently editing check: ${state.activeAudit.checkId}. ${state.activeAudit.prompt} ${state.activeAudit.coverage || ""} Browsing other checks does not change this form until you choose Use selected check. The framework, edition, prompt and sources will be retained with your review.`;
        assessmentForm.before(summary);
        if (state.activeAudit.definition) {
          const interpretation = document.createElement("fieldset"); interpretation.className = "lw-wide";
          interpretation.innerHTML = `<legend>Requirement definition review</legend><p>Keep the original source statement intact. Record your interpretation of the responsible actor, duty and qualifications for this project. Leave all fields empty to retain an unreviewed definition.</p><div class="lw-grid">${field("Responsible actor", "definitionActor")}${area("Requirement / duty", "definitionRequirement")}${area("Scope, triggers and conditions", "definitionConditions", {placeholder: "Record the conditions, or explicitly state none identified after review."})}${area("Exceptions / exclusions", "definitionExceptions")}${area("Evidence needed to verify the duty", "definitionEvidence")}</div>`;
          assessmentForm.prepend(interpretation);
          const saved = state.drafts.get(draftKey("assessment"));
          if (saved) for (const input of interpretation.querySelectorAll("[name]")) if (saved[input.name]?.length) input.value = saved[input.name][0];
        }
      }
    }
    for (const form of root.querySelectorAll('form[data-form^="action"]')) form.elements.verification.required = form.elements.status.value === "closed";
    setBusy(state.busy);
  }

  function closureEvidenceChoices(selected = []) {
    return `<fieldset class="lw-wide"><legend>Linked closure evidence</legend>${state.project.evidence.map(item => `<label class="lw-checkbox"><input type="checkbox" name="closureEvidenceIds" value="${escapeHtml(item.id)}"${selected.includes(item.id) ? ' checked' : ''}><span>${escapeHtml(item.locator)} — ${escapeHtml(item.note)}<small>${escapeHtml(versionLabel(item.versionId))}</small></span></label>`).join("") || "<p>Add an exact-version evidence reference before closing an action.</p>"}</fieldset>`;
  }

  function renderAction(item) {
    const history = [...(item.history || []), item];
    return `<article class="lw-record" id="lw-action-${escapeHtml(item.id)}" data-action-record="${escapeHtml(item.id)}"><details class="lw-record-details"><summary><strong>${escapeHtml(recordTitle(item.description,100))}</strong><span class="lw-row-meta">${escapeHtml(item.owner)} · due ${escapeHtml(item.dueDate)} · ${escapeHtml(item.status)} · revision ${item.revision || 1}</span></summary><div class="lw-record-detail-body"><p><strong>Action:</strong> ${escapeHtml(item.description)}</p><p><strong>Closure criteria:</strong> ${escapeHtml(item.closureEvidence)}</p><p><strong>Verification:</strong> ${escapeHtml(item.verification || "Not recorded")}</p>${item.status === "closed" && !item.revision ? '<p class="lw-note">Legacy closure: linked evidence and reviewer were not recorded. Record a new closure review to verify it.</p>' : ""}<p class="lw-small">Assessment <code>${escapeHtml(item.assessmentId)}</code> · Action <code>${escapeHtml(item.id)}</code></p></div></details><div class="lw-row-actions"><details><summary>Update action</summary><p>Updates retain earlier action revisions. Issued reports keep their original action state; closing an action leaves the assessment unchanged.</p><form data-form="action-update-${escapeHtml(item.id)}" data-action-id="${escapeHtml(item.id)}" class="lw-form lw-grid">${select("Action status", "status", [["open", "Open"], ["in_progress", "In progress"], ["closed", "Closed after verification"]], {selected: item.status})}${field("Reviewing practitioner", "reviewer", {required: true})}${area("Progress / review note", "updateNote", {required: true})}${closureEvidenceChoices(item.closureEvidenceIds)}${area("Verification / closure review", "verification", {placeholder: "Record the review against the closure criteria."})}<button type="submit">Save action update</button></form></details><details><summary>History (${history.length})</summary><ol>${history.map(entry => `<li>Revision ${entry.revision || 1}: ${escapeHtml(entry.status)}${entry.revision ? ` · ${escapeHtml(entry.reviewer)} · ${escapeHtml(entry.updatedAt)}<p>${escapeHtml(entry.updateNote)}</p><p>${escapeHtml(entry.verification)}</p><p>Closure evidence: ${entry.closureEvidenceIds.map(id => escapeHtml(state.project.evidence.find(e => e.id === id)?.locator || id)).join("; ") || "None recorded"}</p>` : " · Legacy record; original reviewer/time not recorded"}</li>`).join("")}</ol></details></div></article>`;
  }

  function renderProject(project) {
    const engagement = project.engagement || {}, versions = allVersions();
    const versionOptions = [["", "Choose an exact source version"], ...versions.map(({resource, version}, index) => [version.id, `${version.effectiveMetadata?.title || resource.title} · ${version.filename} · ${version.sha256.slice(0, 12)} · ${index + 1}`])];
    return `<section class="lw-panel"><div class="lw-section-heading"><div><p class="lw-eyebrow">${escapeHtml(engagement.phase)} · ${escapeHtml(engagement.period)}</p><h2 tabindex="-1" data-project-heading>${escapeHtml(project.name)}</h2><p>${escapeHtml(engagement.client)} · revision ${escapeHtml(project.revision)}</p></div><div class="lw-actions"><a class="lw-report-link" href="/assistant?account=${encodeURIComponent(state.accountId)}&amp;project=${encodeURIComponent(project.id)}">Project assistant</a><a class="lw-report-link" href="/engagements?account=${encodeURIComponent(state.accountId)}&amp;project=${encodeURIComponent(project.id)}">Engagements and approvals</a><a class="lw-report-link" href="${escapeHtml(fieldCaptureHref())}">Capture field record</a>${button("Refresh project", "refresh")}${button("Export project package", "export")}</div></div><p class="lw-account-badge">${escapeHtml(accountLabel())}</p>${project.resources.some(resource => resource.versions.some(version => version.mediaType === "application/vnd.esia.master+json")) ? `<p><a href="/master?account=${encodeURIComponent(state.accountId)}&project=${encodeURIComponent(project.id)}">Open client master compliance matrix</a></p>` : ""}<p class="lw-small">Project ID: <code>${escapeHtml(project.id)}</code></p><nav class="lw-steps" aria-label="Project workflow">${[["documents", "1 Documents"], ["sources", "Add sources"], ["evidence", "2 Evidence"], ["review", "3 Review"], ["actions", "4 Actions"], ["reports", "5 Reports"]].map(([id, label]) => `<a href="#lw-${id}">${label}</a>`).join("")}</nav></section>
      <section class="lw-panel" id="lw-documents"><div class="lw-document-actions">${button("Add sources", "show-intake")}</div><div data-project-documents data-source-records></div></section>
      <section class="lw-panel" id="lw-sharing" data-project-file-sharing></section>
      <section class="lw-panel" id="lw-sources"><details data-intake-section${!project.resources.length || intakeDrafts.get(`${state.accountId}:${project.id}`)?.queue?.length ? " open" : ""}><summary class="lw-intake-summary">Add sources: files, email attachments, URLs and spatial data</summary><div data-source-intake></div><details><summary>Advanced: register a local path or import a prepared archive</summary><p>Keep an existing folder reference, or supply a previously saved capture.</p><form data-form="intake" class="lw-form lw-grid">${field("Source title", "title", {required: true})}${select("Intake mode", "mode", [["managed", "Managed — preserve a copy"], ["registered", "Registered — reference an existing file"]])}${select("Resource", "resourceId", [["", "Create a new resource"], ...project.resources.map(item => [item.id, `New version of ${item.title}`])], {required: false})}${field("Absolute local path", "path", {placeholder: "/path/to/client/document.pdf"})}<label class="lw-wide"><span>Or select a file for a managed copy</span><input type="file" name="file"><small>Use the path field for registered files. File selection sends bytes only to this local service.</small></label><p class="lw-note lw-wide">A registered reference and its hash do not preserve historical bytes. If the file changes or disappears, the original evidence may be unavailable. Capture the version needed for reproducible reporting.</p>${captureMetadataFields()}<button type="submit">Save source version</button></form></details></details></section>
      <section class="lw-panel" id="lw-evidence"><h2>2. Create an evidence reference</h2><p>Each reference identifies an exact source version and a useful location inside it.</p><form data-form="evidence" class="lw-form lw-grid">${select("Source version", "versionId", versionOptions)}${field("Locator", "locator", {required: true, placeholder: "PDF file page 6; printed p. 3; paragraph 2"})}${area("Evidence note / statement", "note", {required: true, placeholder: "Describe what this source supports or contradicts."})}<button type="submit">Add evidence reference</button></form>
      <ol class="lw-record-list">${project.evidence.map(item => `<li class="lw-record" data-local-evidence="${escapeHtml(item.id)}"><details class="lw-record-details"><summary><strong>${escapeHtml(recordTitle(item.locator))}</strong><span class="lw-row-meta">${escapeHtml(recordTitle(versionLabel(item.versionId)))}</span></summary><div class="lw-record-detail-body"><p><strong>Locator:</strong> ${escapeHtml(item.locator)}</p><p>${escapeHtml(item.note)}</p><p class="lw-small">${escapeHtml(versionLabel(item.versionId))}<br>Evidence <code>${escapeHtml(item.id)}</code></p></div></details></li>`).join("") || "<li>No evidence references yet.</li>"}</ol></section>
      <section class="lw-panel" id="lw-review"><h2>3. Record a reviewed assessment</h2><p>Identify the governing instrument and edition explicitly. The local workflow does not select or interpret policy requirements automatically.</p><form data-form="assessment" class="lw-form lw-grid"><fieldset class="lw-wide"><legend>Framework requirement</legend><div class="lw-grid">${field("Issuing authority", "authority", {required: true, placeholder: "For example, IFC"})}${field("Instrument name", "frameworkName", {required: true, placeholder: "Performance Standards"})}${field("Edition", "edition", {required: true, placeholder: "2012"})}${field("Clause / requirement", "clause", {required: true, placeholder: "PS1, paragraph 5"})}</div></fieldset><fieldset class="lw-wide"><legend>Applicability</legend><div class="lw-grid">${select("Decision", "decision", [["applies", "Applies"], ["does_not_apply", "Does not apply"], ["uncertain", "Uncertain"]])}${field("Scope", "scope", {required: true, placeholder: "Facility, activity or affected group"})}${field("Relevant period", "applicabilityPeriod", {required: true, value: project.engagement?.period})}${area("Applicability rationale", "applicabilityRationale", {required: true})}</div></fieldset>
      <fieldset class="lw-wide lw-evidence-choices"><legend>Supporting or contradictory evidence</legend>${project.evidence.map(item => `<label class="lw-checkbox"><input type="checkbox" name="evidenceIds" value="${escapeHtml(item.id)}"><span>${escapeHtml(item.locator)} — ${escapeHtml(item.note)}<small>${escapeHtml(versionLabel(item.versionId))}</small></span></label>`).join("") || "<p>No evidence yet. An insufficient-evidence assessment may record the missing inputs below.</p>"}</fieldset>${select("Assessment conclusion", "conclusion", [["insufficient_evidence", "Insufficient evidence"], ["gap", "Gap"], ["conforms", "Conforms"], ["not_applicable", "Not applicable"]])}${field("Reviewer", "reviewer", {required: true})}${area("Practitioner rationale", "rationale", {required: true})}${area("Missing evidence", "missingEvidence")}${area("Uncertainty / conflicting information", "uncertainty")}${field("Risk significance", "riskSignificance", {required: true, placeholder: "Describe significance separately from priority"})}<button type="submit">Save reviewed assessment</button></form>
      <div class="lw-record-list">${project.assessments.map(item => `<article class="lw-record" data-local-assessment="${escapeHtml(item.id)}"><details class="lw-record-details"><summary><strong>${escapeHtml(recordTitle(`${item.framework.name} · ${item.framework.edition} · ${item.framework.clause}`))}</strong><span class="lw-row-meta">${escapeHtml(item.conclusion)} · ${escapeHtml(item.reviewer)} · ${escapeHtml(item.reviewedAt)}</span></summary><div class="lw-record-detail-body" data-local-assessment-details><h3>${escapeHtml(item.framework.name)} · ${escapeHtml(item.framework.edition)} · ${escapeHtml(item.framework.clause)}</h3><p>${escapeHtml(item.rationale)}</p><dl class="lw-details"><dt>Applicability</dt><dd>${escapeHtml(item.applicability.decision)} — ${escapeHtml(item.applicability.rationale)}</dd><dt>Scope / period</dt><dd>${escapeHtml(item.applicability.scope)} / ${escapeHtml(item.applicability.period)}</dd><dt>Missing evidence</dt><dd>${escapeHtml(item.missingEvidence || "None recorded")}</dd><dt>Uncertainty</dt><dd>${escapeHtml(item.uncertainty || "None recorded")}</dd><dt>Risk significance</dt><dd>${escapeHtml(item.riskSignificance)}</dd><dt>Evidence</dt><dd>${escapeHtml(item.evidenceIds.join(", ") || "None cited")}</dd><dt>Assessment</dt><dd><code>${escapeHtml(item.id)}</code></dd></dl></div></details></article>`).join("") || "<p>No reviewed assessments yet.</p>"}</div></section>
      <section class="lw-panel" id="lw-actions"><h2>4. Record an action / commitment</h2><form data-form="action" class="lw-form lw-grid">${select("Related assessment", "assessmentId", [["", "Choose an assessment"], ...project.assessments.map(item => [item.id, `${item.framework.name} ${item.framework.edition} · ${item.framework.clause} · ${item.conclusion}`])])}${field("Accountable party", "owner", {required: true})}${area("Action / commitment", "description", {required: true})}${field("Due date", "dueDate", {type: "date", required: true})}${select("Status", "status", [["open", "Open"], ["in_progress", "In progress"], ["closed", "Closed"]])}${area("Required closure evidence", "closureEvidence", {required: true})}${field("Recording reviewer", "reviewer", {required: true})}${closureEvidenceChoices()}${area("Verification / closure review", "verification", {placeholder: "Required with linked evidence and reviewer for closure."})}<button type="submit">Save action</button></form><div class="lw-record-list">${project.actions.map(renderAction).join("") || "<p>No actions yet.</p>"}</div></section>
      <section class="lw-panel" id="lw-reports"><h2>5. Issue a gap analysis report</h2><p>Create a findings summary and separate sections for each standard and edition. Excel, web, HTML and Markdown outputs use the same frozen assessments, actions and citations. Later edits do not rewrite an issued snapshot. Registered files need captured copies to retain their historical bytes. Excel print areas are set; use your browser’s Print command in the web report.</p><form data-form="issue" class="lw-form lw-grid">${field("Report title", "title", {required: true, value: `${project.name} — gap analysis`})}${field("Issuing reviewer", "reviewer", {required: true})}${select("Report paper", "paperSize", [["A4", "A4"], ["Letter", "US Letter"]])}${area("Practitioner narrative", "narrative", {required: true, rows: 6, placeholder: "Add your report narrative. It is preserved verbatim with this issued snapshot."})}<button type="submit">Issue report snapshot</button></form><div class="lw-record-list">${project.reports.map(report => `<article class="lw-record"><div class="lw-section-heading"><div><h3>${escapeHtml(report.title)}</h3><p>${escapeHtml(report.issuedAt)} · ${escapeHtml(report.reviewer)}</p></div><div class="lw-actions"><a class="lw-report-link" data-report-view href="/reports/${encodeURIComponent(project.id)}/${encodeURIComponent(report.id)}?account=${encodeURIComponent(state.accountId)}" target="_blank" rel="noopener">View web report</a>${button("Download Excel", "report-excel", `data-id="${escapeHtml(report.id)}"`)}${button("Download HTML", "report-html", `data-id="${escapeHtml(report.id)}"`)}${button("Download Markdown", "report", `data-id="${escapeHtml(report.id)}"`)}</div></div><details><summary>Inspect issued report and citations</summary><pre class="lw-report">${escapeHtml(report.markdown)}</pre></details><p class="lw-small">Snapshot <code>${escapeHtml(report.id)}</code></p></article>`).join("") || "<p>No issued reports yet.</p>"}</div></section>`;
  }

  function renderAuditPanel(project) {
    const configured = project.projectContext?.frameworkIds;
    if (configured && !configured.length) return `<section class="lw-panel" id="lw-audit-checks"><h2>Framework audit checks</h2><p>No framework editions have been selected for this account review. Set its criteria in the project directory above. Other accounts' criteria and conclusions remain separate.</p>${button("Write a custom assessment", "custom-assessment")}</section>`;
    const framework = getFramework(state.auditFramework);
    const checks = getAuditChecks(framework.id, state.auditCheckSet).filter(check => state.auditTopic === "all" || check.topic === state.auditTopic);
    const selected = checks.find(check => check.id === state.auditCheckId);
    const assessed = new Set(project.assessments.filter(item => item.auditContext?.frameworkId === framework.id && item.auditContext?.checkSet === state.auditCheckSet).map(item => item.auditContext.checkId));
    const choice = (label, name, values, value) => `<label><span>${escapeHtml(label)}</span><select data-audit-control="${name}">${options(values, value)}</select></label>`;
    const links = selected?.sources || framework.sources.filter(source => !selected || !selected.sourceIds?.length || selected.sourceIds.includes(source.id));
    return `<section class="lw-panel" id="lw-audit-checks"><h2>Framework audit checks</h2><p>Select the governing edition, then choose a check to assess. Each saved review retains its own conclusion and sources.</p>
      <div class="lw-grid">${choice("Institution and framework edition", "framework", frameworks.filter(item => !configured || configured.includes(item.id)).map(item => [item.id, `${item.institution} — ${item.edition}`]), framework.id)}
      ${choice("Check coverage", "checkSet", auditCheckSets(framework.id).map(item => [item.id, `${item.label} (${item.count})`]), state.auditCheckSet)}
      ${choice("Audit topic", "topic", [["all", "All topics"], ...frameworkTopics.map(item => [item.id, item.label])], state.auditTopic)}
      ${choice("Check to assess", "check", [["", "Choose a check"], ...checks.map(item => [item.id, `${assessed.has(item.id) ? "Recorded · " : "Unassessed · "}${item.standard}: ${item.title}`])], state.auditCheckId)}</div>
      <p class="lw-note">${escapeHtml(framework.applicability)}</p>${state.libraryError ? `<p class="lw-error" role="alert">${escapeHtml(state.libraryError)}</p>` : ""}${state.sector ? `<p class="lw-note">Sector context: ${escapeHtml(getSectorProfile(state.sector)?.name)}. Screening priorities guide questions; they do not determine applicability.</p>` : ""}<p class="lw-small">${escapeHtml(framework.coverage)} Sources checked ${frameworkSourceCheckDate}. ${checks.filter(item => assessed.has(item.id)).length} of ${checks.length} displayed checks have recorded assessments; this count is not a compliance rating.</p>
      ${state.auditCheckSet === "workbook" ? '<p class="lw-note">Existing workbook diagnostics retain their original row identity. Their paragraph mapping and completeness require practitioner verification.</p>' : ""}
      ${selected ? `<article class="lw-record">${selected.detail ? `<p class="lw-note">Unreviewed source statement · actor ${escapeHtml(selected.detail.actor)} · ${escapeHtml(selected.detail.classification)}</p><blockquote>${escapeHtml(selected.detail.sourceText)}</blockquote><details><summary>Original qualification context</summary><pre class="lw-report">${escapeHtml(selected.detail.context?.parentText)}</pre></details>` : ""}${selected.memberIds ? `<p class="lw-note">Conceptual group of ${selected.memberIds.length} source candidates. A group conclusion does not assign member conclusions.</p>` : ""}<h3>${escapeHtml(selected.standard)} — ${escapeHtml(selected.clause)}</h3><p>${escapeHtml(selected.prompt)}</p><p><strong>Evidence to look for:</strong> ${escapeHtml(selected.evidence.join("; "))}</p></article>` : ""}
      <p class="lw-small">${links.map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a>`).join(" · ")}</p>
      <div class="lw-actions">${button("Use selected check", "use-audit-check")}${selected ? `<a class="lw-report-link" href="${escapeHtml(fieldCaptureHref(getAuditContext(framework.id, selected.id, state.auditCheckSet).framework))}">Capture evidence for this requirement</a>` : ""}${button("Write a custom assessment", "custom-assessment")}</div>
    </section>`;
  }

  function versionLabel(id) {
    const found = allVersions().find(item => item.version.id === id);
    return found ? `${found.version.effectiveMetadata?.title || found.resource.title} · ${found.version.filename} · SHA256 ${found.version.sha256.slice(0, 12)}` : id;
  }

  async function run(work, message) {
    if (state.busy || state.intakeBusy || state.documentBusy || state.sharingBusy || disposed) return;
    setBusy(true);
    try {await work(); if (message) announce(message);}
    catch (error) {if (error.name !== "AbortError") announce(error.message || "The local operation failed.", true);}
    finally {if (!disposed) setBusy(false);}
  }

  async function fileBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
  }

  const onSubmit = event => {
    const form = event.target.closest("form[data-form]");
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    const data = new FormData(form), text = name => String(data.get(name) || "").trim(), formName = form.dataset.form;
    let correction;
    if (formName.startsWith("metadata-")) {
      try {
        const version = allVersions().find(item => item.version.id === text("versionId"))?.version;
        correction = readMetadata(form, version?.effectiveMetadata || version?.intakeMetadata || {receivedVia: "file_upload", extraction: {method: "manual", status: "unavailable", warnings: []}});
      } catch (error) {announce(error.message, true); return;}
    }
    run(async () => {
      if (formName === "account") {
        rememberForms();
        const created = await request("/api/storage-accounts", {method: "POST", body: {name: text("name"), organization: text("organization"), dataOwner: text("dataOwner")}});
        await refreshAccounts(); await switchAccount(created.id);
        announce(`Created storage account ${created.name}. Its project database and managed files are separate.`); return;
      }
      if (formName === "project") {
        rememberForms();
        const result = await request("/api/projects", {method: "POST", body: {name: text("name"), client: text("client"), phase: text("phase"), period: text("period"), ...(text("realWorldProjectId") ? {realWorldProjectId: text("realWorldProjectId")} : {})}});
        const created = result.project || result;
        await refreshList(); finishWorkspaceTask(); await openProject(created.id, {preserve: false});
        announce("Project and engagement created."); return;
      }
      if (formName === "import") {
        const file = data.get("package");
        if (!(file instanceof File) || !file.size) throw new Error("Choose a project package JSON file.");
        const input = JSON.parse(await file.text());
        let imported;
        if (data.get("restoreOwningAccount")) {
          const result = await request("/api/storage-accounts/restore", {method: "POST", body: {package: input}});
          await refreshAccounts(); await switchAccount(result.account.id); imported = result.project;
        } else {
          const result = await request("/api/import", {method: "POST", body: {package: input, adoptLegacyAccount: Boolean(data.get("adoptLegacyAccount"))}});
          imported = result.project || result;
        }
        await refreshList(); finishWorkspaceTask(); await openProject(imported.id);
        announce("Package validated and imported. Account custody, IDs and evidence links are retained."); return;
      }

      if (!state.project) throw new Error("Open a project first.");
      let fields;
      if (formName === "intake") {
        fields = {type: "intake", title: text("title"), mode: text("mode"), ...(text("resourceId") ? {resourceId: text("resourceId")} : {})};
        const file = data.get("file"), hasFile = file instanceof File && file.name !== "";
        if (hasFile && text("path")) throw new Error("Choose a file or enter a path, then save the source version.");
        if (fields.mode === "registered" && hasFile) throw new Error("Registered files require an absolute local path. Choose managed mode to preserve the selected file.");
        if (hasFile) {
          if (file.size > 16 * 1024 * 1024) throw new Error("Source files are limited to 16 MiB for this local workflow.");
          Object.assign(fields, {filename: file.name, contentBase64: await fileBase64(file), mediaType: file.type || "application/octet-stream"});
        } else if (text("path")) fields.path = text("path");
        else throw new Error("Choose a source file or enter its absolute local path.");
        if (["originalUrl", "finalUrl", "capturedAt", "captureMethod", "captureResult"].some(name => text(name))) {
          fields.source = {title: text("title"), capturedAt: text("capturedAt"), method: text("captureMethod"), result: text("captureResult"),
            ...(text("originalUrl") ? {originalUrl: text("originalUrl")} : {}), ...(text("finalUrl") ? {finalUrl: text("finalUrl")} : {})};
        }
      } else if (formName.startsWith("metadata-")) {
        fields = {type: "metadata", versionId: text("versionId"), metadata: correction};
      } else if (formName === "evidence") fields = {type: "evidence", versionId: text("versionId"), locator: text("locator"), note: text("note")};
      else if (formName === "assessment") fields = {type: "assessment", framework: {authority: text("authority"), name: text("frameworkName"), edition: text("edition"), clause: text("clause")},
        applicability: {decision: text("decision"), rationale: text("applicabilityRationale"), scope: text("scope"), period: text("applicabilityPeriod")},
        conclusion: text("conclusion"), reviewer: text("reviewer"), rationale: text("rationale"), evidenceIds: data.getAll("evidenceIds"), missingEvidence: text("missingEvidence"), uncertainty: text("uncertainty"), riskSignificance: text("riskSignificance"),
        ...(state.activeAudit ? {auditContext: structuredClone(state.activeAudit)} : {})};
      else if (formName === "action") fields = {type: "action", assessmentId: text("assessmentId"), description: text("description"), owner: text("owner"), dueDate: text("dueDate"), status: text("status"), closureEvidence: text("closureEvidence"), verification: text("verification"), reviewer: text("reviewer"), closureEvidenceIds: data.getAll("closureEvidenceIds")};
      else if (formName.startsWith("action-update-")) fields = {type: "action-update", actionId: form.dataset.actionId, status: text("status"), reviewer: text("reviewer"), updateNote: text("updateNote"), verification: text("verification"), closureEvidenceIds: data.getAll("closureEvidenceIds")};
      else if (formName === "issue") fields = {type: "issue", title: text("title"), reviewer: text("reviewer"), narrative: String(data.get("narrative") || ""), presentation: {paperSize: text("paperSize") || "A4"}};
      else if (formName.startsWith("relink-")) fields = {type: "relink", versionId: text("versionId"), path: text("path")};
      if (!fields) throw new Error("Unknown local form.");
      if (formName === "assessment" && fields.auditContext?.definition && ["definitionActor", "definitionRequirement", "definitionConditions", "definitionExceptions", "definitionEvidence"].some(name => text(name))) {
        fields.auditContext.definitionReview = {actor: text("definitionActor"), requirement: text("definitionRequirement"), conditions: text("definitionConditions"), exceptions: text("definitionExceptions"), verificationEvidence: text("definitionEvidence")};
      }
      await command(fields, formName);
      announce(formName.startsWith("action-update-") ? "Action update saved with revision history." : formName.startsWith("metadata-") ? "Metadata correction saved. Original bytes and issued reports remain retained." :
        {intake: "Source version saved. Earlier captured bytes remain retained.", evidence: "Evidence reference saved with its exact source version and locator.", assessment: "Reviewed assessment saved.", action: "Action saved.", issue: "Report snapshot issued and retained."}[formName] || "File hash verified and registered location updated.");
    });
  };

  function focusWorkspaceTask(task) {
    if (disposed || !["create", "import"].includes(task)) return;
    const section = root.querySelector(task === "import" ? "#import-project" : "#new-project");
    if (!section) return;
    section.querySelector("details").open = true;
    section.scrollIntoView?.({block: "start"});
    section.querySelector(task === "import" ? 'input[name="package"]' : 'input[name="name"]')?.focus({preventScroll: true});
  }

  const onClick = event => {
    const taskLink = event.target.closest("a[data-local-task]");
    if (taskLink && root.contains(taskLink)) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      workspaceTask = taskLink.dataset.localTask;
      origin.searchParams.set("task", workspaceTask);
      origin.hash = workspaceTask === "import" ? "import-project" : "new-project";
      root.ownerDocument.defaultView.history.replaceState(null, "", origin.pathname + origin.search + origin.hash);
      focusWorkspaceTask(workspaceTask);
      return;
    }
    const control = event.target.closest("button[data-action]");
    if (!control || !root.contains(control)) return;
    const action = control.dataset.action, id = control.dataset.id;
    run(async () => {
      if (action === "use-audit-check" || action === "custom-assessment") {
        const context = action === "use-audit-check" ? auditContext() : null;
        rememberForms(); state.activeAudit = context; render();
        root.querySelector('form[data-form="assessment"] select[name="decision"]')?.focus();
        announce(context ? "Audit check selected. Review applicability and evidence before saving a conclusion." : "Custom assessment opened. Earlier unsaved check entries remain available in this page.");
        return;
      }
      if (action === "open") return openProject(id);
      if (action === "show-intake") {root.querySelector("[data-intake-section]").open = true;root.querySelector('[data-intake-form="files"] input[type="file"]')?.focus();return;}
      if (action === "refresh-list") {rememberForms(); await refreshList(); render(); announce("Project list refreshed."); return;}
      if (action === "refresh") return openProject(state.project.id);
      if (action === "export") {
        const data = await request(`${projectPath()}/export`);
        download(new Blob([JSON.stringify(data)], {type: "application/json"}), `${safeFilename(accountLabel())}-${safeFilename(state.project.name)}.esia-package.json`);
        announce("Project package exported. Treat the package as confidential when it contains client material."); return;
      }
      if (action === "download") {
        const version = allVersions().find(item => item.version.id === id)?.version;
        if (!version) throw new Error("The selected source version is unavailable.");
        const blob = await request(`${projectPath()}/versions/${encodeURIComponent(id)}/download`, {method: "POST", binary: true});
        download(new Blob([blob], {type: "application/octet-stream"}), safeFilename(version.filename));
        announce("Exact source bytes downloaded."); return;
      }
      if (action === "capture") {await command({type: "capture", versionId: id}, "capture"); announce("Original version captured. Historical bytes are now managed by this workspace."); return;}
      if (action === "report-excel" || action === "report-html") {
        const report = state.project.reports.find(item => item.id === id);
        if (!report) throw new Error("This issued report is unavailable.");
        const excel = action === "report-excel", extension = excel ? "xlsx" : "html";
        const blob = await request(`${projectPath()}/reports/${encodeURIComponent(id)}?format=${extension}${excel ? "" : "&download=1"}`, {binary: true});
        download(blob, `${safeFilename(accountLabel())}-${safeFilename(report.title)}.${extension}`);
        announce(excel ? "Styled Excel report downloaded with summary, standard tabs and print settings." : "Standalone web report downloaded with embedded print styling.");
        return;
      }
      if (action === "report") {
        const report = state.project.reports.find(item => item.id === id);
        if (!report) throw new Error("This issued report is unavailable.");
        download(new Blob([report.markdown], {type: "text/markdown;charset=utf-8"}), `${safeFilename(accountLabel())}-${safeFilename(report.title)}.md`);
        announce("Issued report downloaded with its retained citations.");
      }
    });
  };

  const onInput = event => {
    if (!event.target.matches("[data-source-filter]")) return;
    const term = event.target.value.toLowerCase().trim(); let shown = 0;
    for (const node of root.querySelectorAll("[data-resource-id]")) {
      const resource = state.project.resources.find(item => item.id === node.dataset.resourceId);
      const haystack = [resource.title, ...resource.versions.flatMap(version => [version.filename, version.effectiveMetadata?.title, ...(version.effectiveMetadata?.tags || []).map(tag => tag.label)])].join(" ").toLowerCase();
      node.hidden = !haystack.includes(term); if (!node.hidden) shown++;
    }
    root.querySelector("[data-source-count]").textContent = `${shown} of ${state.project.resources.length} source records shown`;
  };
  const onChange = event => {
    if (event.target.matches("[data-account-select]")) {
      const next = event.target.value;
      if (state.busy || state.intakeBusy || state.documentBusy || state.sharingBusy || state.directoryBusy) {event.target.value = state.accountId; return;}
      run(async () => {await switchAccount(next);}); return;
    }
    const control = event.target.dataset.auditControl;
    if (control) {
      rememberForms();
      if (control === "framework") {state.auditFramework = event.target.value; state.auditCheckSet = "curated"; state.auditCheckId = "";}
      if (control === "checkSet") {state.auditCheckSet = event.target.value; state.auditCheckId = "";}
      if (control === "topic") {state.auditTopic = event.target.value; state.auditCheckId = "";}
      if (control === "check") state.auditCheckId = event.target.value;
      render();
      if (["framework", "checkSet"].includes(control)) run(async () => {await loadRequirements(); rememberForms(); render();});
      root.querySelector(`[data-audit-control="${control}"]`)?.focus(); return;
    }
    const form = event.target.closest('form[data-form^="action"]');
    if (form && event.target.name === "status") form.elements.verification.required = event.target.value === "closed";
  };
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("submit", onSubmit);
  root.addEventListener("click", onClick);
  render();
  const ready = run(async () => {await refreshAccounts(); render(); if (!currentAccount()) throw new Error("This storage account is unavailable. Select an available account."); await refreshList(); await loadRequirements(); const check = getAuditChecks(state.auditFramework, state.auditCheckSet).find(item => item.id === query.get("check")); if (check) {state.auditCheckId = check.id; state.activeAudit = auditContext();} render(); await directoryMount.ready; if (query.get("project")) await openProject(query.get("project")); announce(state.project ? `Local workspace ready. Reopened ${state.project.name}.` : "Local workspace ready. Create or open a project.");}).then(() => focusWorkspaceTask(workspaceTask));
  const dispose = () => {disposed = true; controller.abort(); intakeMount?.dispose(); documentsMount?.dispose(); directoryMount?.dispose(); sharingMount?.dispose(); workQueueMount?.dispose(); root.removeEventListener("input", onInput); root.removeEventListener("submit", onSubmit); root.removeEventListener("click", onClick); root.removeEventListener("change", onChange);};
  if (invalidation?.then) invalidation.then(dispose);
  return {ready, dispose};
}
