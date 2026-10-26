import {mountSourceIntake} from "./source-intake.js";
import {mountProjectDocuments} from "./project-documents.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const uuid = value => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const stakeholderRoles = ["owner", "sponsor", "investor", "lender", "contractor", "operator", "guarantor", "advisor", "regulator", "community", "other"];
const referenceIds = value => [...new Set(String(value || "").split(",").map(id => id.trim()).filter(Boolean))];
const timelineDate = item => item.date || (item.startYear || item.endYear ? `${item.startYear || "Unknown start"}${item.endYear ? ` – ${item.endYear}` : ""}` : "Date unknown");

/** Practitioner-owned records reuse intake and version viewers without routing
 * through a client account. Destination grants are explicit, exact-version references. */
export function mountPersonalProjectWorkspace(root, {identityId, request: providedRequest, invalidation} = {}) {
  const view = root.ownerDocument.defaultView, controller = new AbortController();
  let disposed = false, record, intake, documents, busy = false, commandPending = false, sharingGeneration = 0, destinations = [], metadataAccounts = [], metadataFacets = [];
  const accountSetups = new Map();
  const intakeState = {}, documentState = {};
  const base = `/api/project-spaces/${encodeURIComponent(identityId || "")}`;
  const closed = () => new DOMException("The project space has closed.", "AbortError");
  const current = () => {if (disposed) throw closed();};
  const announce = (message, error = false) => {
    if (disposed) return;
    const status = root.querySelector("[data-personal-status]");
    if (status) {status.textContent = message;status.setAttribute("role", error ? "alert" : "status");}
  };
  function controls() {
    if (disposed) return;
    for (const control of root.querySelectorAll("[data-personal-profile] button,[data-personal-share] button,[data-revoke-share],[data-personal-export],[data-personal-metadata] button,[data-personal-metadata] input,[data-personal-metadata] select")) control.disabled = busy || commandPending;
  }
  async function request(path, {method = "GET", body, binary = false, accountId} = {}) {
    current();let value;
    if (providedRequest) value = await providedRequest(path, {method, body, binary, ...(accountId ? {accountId} : {}), signal: controller.signal});
    else {
      const response = await view.fetch(path, {method, credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
        headers: {"X-ESIA-Workspace": "local", ...(accountId ? {"X-ESIA-Account": accountId} : {}), ...(body === undefined ? {} : {"Content-Type": "application/json"})}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
      current();
      if (!response.ok) {let message = `Request failed (${response.status}).`;try {const data = await response.json();message = data.error?.message || data.error || data.message || message;} catch {} current();throw Object.assign(new Error(message), {status: response.status});}
      value = await (binary ? response.blob() : response.json());
    }
    current();return value;
  }
  const sharedRequest = (path, options) => request(path.replace(`/api/projects/${encodeURIComponent(record.project.id)}/`, `${base}/`), options);
  const download = (blob, name) => {
    current();const url = view.URL.createObjectURL(blob), link = root.ownerDocument.createElement("a");link.href = url;link.download = name;link.click();view.setTimeout(() => view.URL.revokeObjectURL(url), 1000);
  };
  async function command(command) {
    if (commandPending) throw new Error("Wait for the current source save before saving another change.");
    commandPending = true;controls();
    try {
      const saved = await request(`${base}/commands`, {method: "POST", body: {expectedRevision: record.project.revision, command}});
      record = {...record, project: saved.project};
      documentState._render?.();
      void renderSharing().catch(error => announce(error.message, true));
      announce("Project records saved in your private project vault.");return record.project;
    } finally {commandPending = false;controls();}
  }
  function readMetadata({validate = false} = {}) {
    const host = root.querySelector("[data-personal-metadata]");
    const field = (row, name) => String(row.querySelector(`[name="${name}"]`)?.value || "").trim();
    const years = (row, names) => Object.fromEntries(names.flatMap(name => {
      const value = field(row, name);if (!value) return [];
      if (validate && (!/^\d{4}$/.test(value) || Number(value) < 1700 || Number(value) > 2300)) throw new Error("Use whole years from1700 through2300, or leave unknown years blank.");
      return [[name, validate ? Number(value) : value]];
    }));
    const lifecycle = [...host.querySelectorAll("[data-lifecycle-entry]")].map(row => ({id: row.dataset.lifecycleEntry, label: field(row, "label"), status: field(row, "status"), sourceIds: referenceIds(field(row, "sourceIds")), ...years(row, ["startYear", "endYear"]), ...(field(row, "date") ? {date: field(row, "date")} : {}), dateBasis: field(row, "dateBasis")}));
    const stakeholders = [...host.querySelectorAll("[data-stakeholder-entry]")].map(row => ({id: row.dataset.stakeholderEntry, name: field(row, "name"), accountCustodyIds: [...row.querySelector('[name="accountCustodyIds"]').selectedOptions].map(option => option.value), roles: [...row.querySelectorAll("[data-stakeholder-role]")].map(role => ({role: field(role, "role"), sourceIds: referenceIds(field(role, "sourceIds")), ...years(role, ["fromYear", "toYear"]), ...(field(role, "phaseId") ? {phaseId: field(role, "phaseId")} : {}), ...(field(role, "status") ? {status: field(role, "status")} : {}), ...(field(role, "basis") ? {basis: field(role, "basis")} : {})}))}));
    if (validate) {
      if (lifecycle.some(item => !item.label || !item.status)) throw new Error("Give every timeline entry a label and status; unknown dates may stay blank.");
      if (stakeholders.some(item => !item.name || !item.roles.length)) throw new Error("Give every stakeholder a name and at least one role.");
      if (lifecycle.some(item => item.startYear && item.endYear && item.startYear > item.endYear) || stakeholders.some(item => item.roles.some(role => role.fromYear && role.toYear && role.fromYear > role.toYear))) throw new Error("A start year cannot follow its end year.");
    }
    return {lifecycle, stakeholders};
  }
  function accountOptions(selected = []) {
    const known = new Set(metadataAccounts.map(account => account.custodyId));
    return [...metadataAccounts.map(account => ({id: account.custodyId, name: account.name})), ...selected.filter(id => !known.has(id)).map(id => ({id, name: `Unavailable account · ${id}`}))]
      .map(account => `<option value="${h(account.id)}"${selected.includes(account.id) ? " selected" : ""}>${h(account.name)}</option>`).join("");
  }
  function associatedAccountRecords(custodyId) {
    const account = metadataAccounts.find(item => item.custodyId === custodyId);
    if (!account) return h(`Unavailable account · ${custodyId}`);
    const facets = metadataFacets.filter(facet => facet.accountId === account.id);
    return `${h(account.name)}${facets.map(facet => `<p><a data-personal-account-records href="/?${h(new URLSearchParams({account: account.id, project: facet.projectId}))}">Open project records</a></p>`).join("") || "<p>No linked project records.</p>"}`;
  }
  function createAccountControl(stakeholder) {
    if (stakeholder.accountCustodyIds?.length) return "";
    const saved = record.profile.stakeholders?.find(item => item.id === stakeholder.id);
    if (!saved) return "<p>Save this stakeholder before creating its account.</p>";
    const setup = accountSetups.get(stakeholder.id);
    if (setup?.accountUnconfirmed) return '<p>Account creation returned no confirmed identity. Check the account directory before starting another creation.</p>';
    return `<button type="button" data-personal-create-account="${h(stakeholder.id)}">${setup?.account ? "Retry account and project association" : "Create account and project records"}</button>${setup?.account ? `<p>Created account: ${h(setup.account.name)} · ${h(setup.account.id)}. Retry reuses this exact account.</p>` : `<p>Uses the saved stakeholder name: ${h(saved.name)}. Creates separate empty records, with no file sharing or private notes copied.</p>`}`;
  }
  function updateAssociationChoices() {
    for (const select of root.querySelectorAll('[data-personal-metadata] [name="accountCustodyIds"]')) {
      const selected = [...select.selectedOptions].map(option => option.value);select.innerHTML = accountOptions(selected);
    }
    for (const label of root.querySelectorAll("[data-personal-metadata] [data-custody-label]")) label.innerHTML = associatedAccountRecords(label.dataset.custodyLabel);
  }
  async function createStakeholderAccount(stakeholderId) {
    const saved = record.profile.stakeholders?.find(item => item.id === stakeholderId);
    if (!saved || saved.accountCustodyIds?.length) throw new Error("Choose a saved stakeholder without an associated account.");
    const draft = readMetadata(), draftStakeholder = draft.stakeholders.find(item => item.id === stakeholderId);
    if (!draftStakeholder || draftStakeholder.name !== saved.name) throw new Error("Save this stakeholder’s name before creating its account.");
    const setup = accountSetups.get(stakeholderId) || {};accountSetups.set(stakeholderId, setup);
    if (setup.accountUnconfirmed) throw new Error("Check the account directory: the prior creation returned no confirmed account identity.");
    try {
      if (!setup.account) {
        try {
          setup.account = await request("/api/storage-accounts", {method: "POST", body: {name: saved.name, organization: saved.name, dataOwner: saved.name}});
        } catch (error) {
          setup.accountUnconfirmed = !Number.isInteger(error.status) || error.status >= 500;
          throw new Error(setup.accountUnconfirmed ? `Account creation could not be confirmed. Check the account directory before creating another account. ${error.message}` : `Account creation was rejected. ${error.message}`);
        }
      }
      if (!uuid(setup.account.id) || !uuid(setup.account.custodyId)) throw new Error("The created account did not return valid runtime and custody identities. No project request was sent.");
      if (!setup.projectId) {
        // An interrupted response may follow a successful project creation. Only
        // the exact returned account identity and canonical project can match.
        const directory = await request("/api/project-directory");
        setup.projectId = directory.identities?.find(item => item.id === identityId)?.facets.find(facet => facet.accountId === setup.account.id)?.projectId;
        if (!setup.projectId) {
          const project = await request("/api/projects", {method: "POST", accountId: setup.account.id, body: {name: record.project.name, client: saved.name, phase: "Project stakeholder records", period: "Not specified", realWorldProjectId: identityId}});
          setup.projectId = project.id;
        }
      }
      const stakeholders = record.profile.stakeholders.map(item => item.id === stakeholderId ? {...item, accountCustodyIds: [...new Set([...(item.accountCustodyIds || []), setup.account.custodyId])]} : item);
      const result = await request(`${base}/profile`, {method: "PUT", body: {expectedRevision: record.profile.revision, stakeholders}});
      record = {...record, profile: result.profile};
      draftStakeholder.accountCustodyIds = [...new Set([...(draftStakeholder.accountCustodyIds || []), setup.account.custodyId])];
      if (!metadataAccounts.some(item => item.id === setup.account.id)) metadataAccounts.push(setup.account);
      if (!metadataFacets.some(item => item.accountId === setup.account.id && item.projectId === setup.projectId)) metadataFacets.push({accountId: setup.account.id, projectId: setup.projectId});
      accountSetups.delete(stakeholderId);
      let refreshWarning = "";try {await renderSharing();} catch (error) {refreshWarning = ` Directory refresh failed: ${error.message}`;}
      renderMetadata(draft);
      announce(`Stakeholder account and separate project records created and associated. Notes drafts and file sharing are unchanged.${refreshWarning}`);
    } catch (error) {
      renderMetadata(draft);
      throw new Error(setup.account ? `Account ${setup.account.name} (${setup.account.id}) was created${setup.projectId ? "; its project records exist" : ""}, but association is unfinished. Retry reuses the exact created account and project. If you reload, select this existing account instead of creating another. ${error.message}` : error.message);
    }
  }
  function renderMetadata(draft = {lifecycle: record.profile.lifecycle || [], stakeholders: record.profile.stakeholders || []}) {
    const host = root.querySelector("[data-personal-metadata]");if (!host || disposed) return;
    const input = (name, label, value = "", extra = "") => `<label>${h(label)}<input name="${name}" value="${h(value)}" ${extra}></label>`;
    const phaseOptions = selected => `<option value="">No particular phase</option>${draft.lifecycle.map(item => `<option value="${h(item.id)}"${selected === item.id ? " selected" : ""}>${h(item.label || "Unnamed timeline entry")}</option>`).join("")}`;
    host.innerHTML = `<p>Keep dated project facts and stakeholder roles in your private project record. Unknown dates stay blank. Account associations describe context; sharing a file requires a separate explicit registration.</p><div data-personal-timeline-summary>${draft.lifecycle.length ? `<ol>${draft.lifecycle.map(item => `<li><strong>${h(item.label || "Unnamed milestone")}</strong> · ${h(timelineDate(item))} · ${h(item.status || "Unknown status")}<p>${h(item.dateBasis || "No basis recorded.")}</p>${item.sourceIds?.length ? `<small>References: ${h(item.sourceIds.join(", "))}</small>` : ""}</li>`).join("")}</ol>` : '<p>No project timeline recorded.</p>'}</div><div class="lw-table-scroll"><table class="lw-table"><thead><tr><th>Stakeholder</th><th>Roles, dates and basis</th><th>Associated accounts</th></tr></thead><tbody>${draft.stakeholders.map(item => `<tr><td>${h(item.name || "Unnamed stakeholder")}</td><td>${item.roles.map(role => `<div><strong>${h(role.role)}</strong> · ${h(role.fromYear || role.toYear ? `${role.fromYear || "Unknown start"} – ${role.toYear || "Unknown end"}` : "Dates unknown")} · ${h(role.status || "Status unknown")}${role.phaseId ? `<p>Phase: ${h(draft.lifecycle.find(phase => phase.id === role.phaseId)?.label || "Unresolved phase")}</p>` : ""}<p>${h(role.basis || "No role basis recorded.")}</p>${role.sourceIds?.length ? `<small>References: ${h(role.sourceIds.join(", "))}</small>` : ""}</div>`).join("<br>")}</td><td>${(item.accountCustodyIds || []).map(id => `<span data-custody-label="${h(id)}">${associatedAccountRecords(id)}</span>`).join("<br>") || "None recorded"}${createAccountControl(item)}</td></tr>`).join("") || '<tr><td colspan="3">No stakeholder roles recorded.</td></tr>'}</tbody></table></div><details data-personal-metadata-editor><summary>Edit timeline and stakeholder roles</summary><form data-personal-metadata-form><h3>Project timeline</h3><div data-personal-lifecycle-list>${draft.lifecycle.map(item => `<fieldset data-lifecycle-entry="${h(item.id)}"><legend>${h(item.label || "New timeline entry")}</legend><div class="lw-grid">${input("label", "Milestone or phase", item.label, 'required maxlength="300"')}${input("status", "Status (for example proposed, historical, cancelled, unknown)", item.status, 'required maxlength="100"')}${input("date", "Exact date, if known", item.date, 'type="date" min="1700-01-01" max="2300-12-31"')}${input("startYear", "Start year, if known", item.startYear, 'type="number" min="1700" max="2300" step="1"')}${input("endYear", "End year, if known", item.endYear, 'type="number" min="1700" max="2300" step="1"')}${input("sourceIds", "Reference identifiers (comma separated)", (item.sourceIds || []).join(", "), 'maxlength="12000"')}</div>${input("dateBasis", "Date / status basis and qualifications", item.dateBasis, 'maxlength="2000"')}<button type="button" data-personal-remove-phase="${h(item.id)}">Remove timeline entry</button></fieldset>`).join("")}</div><button type="button" data-personal-add-phase>Add timeline entry</button><h3>Stakeholders</h3><div data-personal-stakeholder-list>${draft.stakeholders.map(item => `<fieldset data-stakeholder-entry="${h(item.id)}"><legend>${h(item.name || "New stakeholder")}</legend>${input("name", "Person or organisation", item.name, 'required maxlength="500"')}<label>Associated accounts (optional; select more than one as needed)<select name="accountCustodyIds" multiple size="${Math.max(2, Math.min(5, metadataAccounts.length || 2))}">${accountOptions(item.accountCustodyIds || [])}</select></label>${createAccountControl(item)}<div data-stakeholder-roles>${item.roles.map((role, index) => `<fieldset data-stakeholder-role="${index}"><legend>Role ${index + 1}</legend><div class="lw-grid"><label>Role<select name="role">${stakeholderRoles.map(name => `<option value="${name}"${name === role.role ? " selected" : ""}>${h(name)}</option>`).join("")}</select></label><label>Project phase<select name="phaseId">${phaseOptions(role.phaseId)}</select></label>${input("fromYear", "From year, if known", role.fromYear, 'type="number" min="1700" max="2300" step="1"')}${input("toYear", "To year, if known", role.toYear, 'type="number" min="1700" max="2300" step="1"')}${input("status", "Role status / qualifications", role.status, 'maxlength="100"')}${input("sourceIds", "Reference identifiers (comma separated)", (role.sourceIds || []).join(", "), 'maxlength="12000"')}</div>${input("basis", "Basis and qualifications", role.basis, 'maxlength="2000"')}<button type="button" data-personal-remove-role="${index}" data-stakeholder-id="${h(item.id)}">Remove role</button></fieldset>`).join("")}</div><button type="button" data-personal-add-role="${h(item.id)}">Add another role</button><button type="button" data-personal-remove-stakeholder="${h(item.id)}">Remove stakeholder</button></fieldset>`).join("")}</div><button type="button" data-personal-add-stakeholder>Add stakeholder</button><p>Reference labels and role descriptions are working metadata. They do not confirm financing, findings or account access. Saving this form does not save changes in the separate notes form.</p><button type="submit">Save timeline and stakeholders</button><button type="button" data-personal-reload-metadata>Reload saved metadata (discard metadata edits)</button></form></details>`;
    controls();
  }
  async function renderSharing() {
    const generation = ++sharingGeneration;
    const [directory, accounts, grants] = await Promise.all([request("/api/project-directory"), request("/api/storage-accounts"), request(`${base}/shares`)]);
    if (disposed || generation !== sharingGeneration) return;
    metadataAccounts = (Array.isArray(accounts) ? accounts : []).filter(account => uuid(account.custodyId));
    metadataFacets = directory.identities?.find(item => item.id === identityId)?.facets || [];updateAssociationChoices();
    const host = root.querySelector("[data-personal-sharing]");if (!host) return;
    const prior = host.querySelector("[data-personal-share]");
    const draft = prior ? Object.fromEntries(new view.FormData(prior)) : {};
    const identity = directory.identities?.find(item => item.id === identityId);
    destinations = (identity?.facets || []).flatMap(facet => {
      const account = Array.isArray(accounts) && accounts.find(item => item.id === facet.accountId);
      return account && uuid(account.custodyId) && facet.projectId ? [{accountId: account.custodyId, projectId: facet.projectId, label: `${facet.accountName || account.name} · ${facet.transactionName || facet.projectId}`}]: [];
    });
    const versions = record.project.resources.flatMap(resource => resource.versions.filter(version => version.mode === "managed" && version.externalReference?.authority !== "urn:esia:local-share").map(version => ({resource, version})));
    host.innerHTML = `<form data-personal-share><label>Exact source version<select name="versionId"><option value="">Choose a version</option>${versions.map(({resource, version}) => `<option value="${h(version.id)}">${h(resource.title)} · ${h(version.filename)} · ${h(version.sha256.slice(0, 12))}</option>`).join("")}</select></label><label>Destination stakeholder account<select name="destination"><option value="">Choose an associated account</option>${destinations.map(item => `<option value="${h(JSON.stringify({accountId: item.accountId, projectId: item.projectId}))}">${h(item.label)}</option>`).join("")}</select></label>${destinations.length ? "" : '<p>No associated account is available for this project. Link an account in the project directory before registering a reference.</p>'}<label>Permitted use / purpose<textarea name="purpose" rows="3" maxlength="2000"></textarea></label><button type="submit">Register selected version</button></form><div data-personal-grants></div>`;
    const form = host.querySelector("[data-personal-share]");
    for (const [name, value] of Object.entries(draft)) {const field = form.elements.namedItem(name);if (field) field.value = value;}
    const shares = Array.isArray(grants.shares) ? grants.shares : Array.isArray(grants) ? grants : [];
    host.querySelector("[data-personal-grants]").innerHTML = shares.map(grant => `<article><p>${h(grant.purpose)} · ${h(grant.status || (grant.revokedAt ? "Revoked" : "Active"))}</p><p>Version ${h(grant.sourceVersionId || grant.versionId)} · ${h(grant.target?.accountId)}</p>${grant.status !== "revoked" && !grant.revokedAt ? `<button type="button" data-revoke-share="${h(grant.id)}" data-share-revision="${h(grant.revision)}">Revoke registration</button>` : ""}</article>`).join("") || '<p>No versions have been registered with an associated account.</p>';
    controls();
  }
  async function render() {
    root.classList.add("local-workspace");
    root.innerHTML = `<header class="lw-panel"><p class="lw-eyebrow">My project records · practitioner ownership</p><h1>${h(record.project.name)}</h1><p>Keep your research, maps and source versions across assignments. Each client and lender account retains its own separate records and findings.</p><a href="/">All projects and associated accounts</a><nav class="lw-steps" aria-label="Personal project records"><a href="/fieldwork?identity=${encodeURIComponent(identityId)}&amp;projectName=${encodeURIComponent(record.project.name)}">Capture field record</a><a href="#personal-introduction">Introduction and research</a><a href="#personal-metadata">Timeline and stakeholders</a><a href="#personal-documents">Documents and GIS</a><a href="#personal-intake">Add sources</a><a href="#personal-sharing">Share with an associated account</a></nav></header><p data-personal-status role="status"></p><section class="lw-panel" id="personal-introduction"><h2>Project introduction and research notes</h2><form data-personal-profile><label>Project introduction<textarea name="summary" maxlength="4000" rows="4">${h(record.profile.summary)}</textarea></label><label>Private research and spatial analysis notes<textarea name="notes" maxlength="64000" rows="8">${h(record.profile.notes)}</textarea></label><p>These notes are private working records. Saving them does not publish or copy them into an account.</p><button type="submit">Save project notes</button></form><button type="button" data-personal-export>Export private project backup</button></section><section class="lw-panel" id="personal-metadata"><h2>Project timeline and stakeholders</h2><div data-personal-metadata></div></section><section class="lw-panel" id="personal-documents"><h2>Project documents and spatial sources</h2><div data-personal-documents></div></section><section class="lw-panel" id="personal-intake"><h2>Add files and capture web sources</h2><div data-personal-intake></div></section><section class="lw-panel" id="personal-sharing"><h2>Register a source for an associated account</h2><p>Select an exact managed source version and an associated account for this project. A reference preserves original ownership and can be revoked here. It does not share other project files or notes.</p><div data-personal-sharing></div></section>`;
    renderMetadata();
    const custody = () => `practitioner-project:${identityId}`;
    intake = mountSourceIntake(root.querySelector("[data-personal-intake]"), {getProject: () => record.project, getAccountId: custody, request: sharedRequest, save: command, state: intakeState,
      captureUrl: new URLSearchParams(view.location.search).get("capture") || "", captureBaseUrl: `/project-space?${new URLSearchParams({identity: identityId})}`});
    // This label is a viewer-only projection, never a persisted storage-account
    // descriptor or an authority identity. All operations use the personal URL.
    documents = mountProjectDocuments(root.querySelector("[data-personal-documents]"), {getProject: () => ({...record.project, storageAccount: {name: "Practitioner project vault"}}), getAccountId: custody, request: sharedRequest, state: documentState,
      saveMetadata: (versionId, metadata) => command({type: "metadata", versionId, metadata}), capture: versionId => command({type: "capture", versionId}), relink: (versionId, path) => command({type: "relink", versionId, path}),
      download: async versionId => {const version = record.project.resources.flatMap(resource => resource.versions).find(item => item.id === versionId);download(await request(`${base}/versions/${encodeURIComponent(versionId)}/download`, {method: "POST", binary: true}), version.filename);}});
    try {await renderSharing();} catch (error) {announce(error.message, true);}
  }
  async function operate(work) {
    if (busy || disposed) return;busy = true;controls();
    try {await work();} catch (error) {announce(error.message, true);} finally {busy = false;controls();}
  }
  const submit = event => {
    const form = event.target;if (!form.matches("[data-personal-profile],[data-personal-share],[data-personal-metadata-form]")) return;
    event.preventDefault();const data = new view.FormData(form);
    void operate(async () => {
      if (form.hasAttribute("data-personal-profile")) {
        const saved = await request(`${base}/profile`, {method: "PUT", body: {expectedRevision: record.profile.revision, summary: String(data.get("summary") || ""), notes: String(data.get("notes") || "")}});
        record = {...record, profile: saved.profile};announce("Private project notes saved.");
      } else if (form.hasAttribute("data-personal-metadata-form")) {
        const metadata = readMetadata({validate: true});
        const saved = await request(`${base}/profile`, {method: "PUT", body: {expectedRevision: record.profile.revision, ...metadata}});
        record = {...record, profile: saved.profile};renderMetadata();announce("Private project timeline and stakeholders saved. Unsaved notes have not been saved.");
      } else {
        const versionId = String(data.get("versionId") || ""), purpose = String(data.get("purpose") || "").trim();
        if (!versionId || !purpose || !data.get("destination")) throw new Error("Choose a version, destination and permitted use.");
        const target = JSON.parse(data.get("destination"));
        if (!destinations.some(item => item.accountId === target.accountId && item.projectId === target.projectId)) throw new Error("Choose an available linked account review for this project.");
        await request(`${base}/shares`, {method: "POST", body: {versionId, target, purpose}});
        form.reset();await renderSharing();announce("Exact source version registered with the selected account.");
      }
    });
  };
  const click = event => {
    const button = event.target.closest?.("button");if (!button) return;
    if (button.hasAttribute("data-personal-create-account")) void operate(() => createStakeholderAccount(button.dataset.personalCreateAccount));
    else if (button.matches("[data-personal-add-phase],[data-personal-remove-phase],[data-personal-add-stakeholder],[data-personal-remove-stakeholder],[data-personal-add-role],[data-personal-remove-role]")) {
      if (busy || commandPending || disposed) return;
      try {
        const draft = readMetadata();
        const newId = prefix => `${prefix}_${(view.crypto?.randomUUID?.() || globalThis.crypto.randomUUID())}`;
        if (button.hasAttribute("data-personal-add-phase")) {
          if (draft.lifecycle.length >= 64) throw new Error("A project may record at most64 timeline entries.");
          draft.lifecycle.push({id: newId("phase"), label: "", status: "unknown", sourceIds: []});
        } else if (button.hasAttribute("data-personal-remove-phase")) {
          const id = button.dataset.personalRemovePhase;
          if (draft.stakeholders.some(item => item.roles.some(role => role.phaseId === id))) throw new Error("Update stakeholder roles that refer to this phase before removing its timeline entry.");
          draft.lifecycle = draft.lifecycle.filter(item => item.id !== id);
        } else if (button.hasAttribute("data-personal-add-stakeholder")) {
          if (draft.stakeholders.length >= 256) throw new Error("A project may record at most256 stakeholders.");
          draft.stakeholders.push({id: newId("stakeholder"), name: "", accountCustodyIds: [], roles: [{role: "other", sourceIds: []}]});
        } else if (button.hasAttribute("data-personal-remove-stakeholder")) draft.stakeholders = draft.stakeholders.filter(item => item.id !== button.dataset.personalRemoveStakeholder);
        else {
          const stakeholder = draft.stakeholders.find(item => item.id === (button.dataset.personalAddRole || button.dataset.stakeholderId));
          if (!stakeholder) throw new Error("Choose an existing stakeholder.");
          if (button.hasAttribute("data-personal-add-role")) {
            if (stakeholder.roles.length >= 16) throw new Error("A stakeholder may record at most16 roles.");
            stakeholder.roles.push({role: "other", sourceIds: []});
          } else stakeholder.roles.splice(Number(button.dataset.personalRemoveRole), 1);
        }
        renderMetadata(draft);root.querySelector("[data-personal-metadata-editor]").open = true;
      } catch (error) {announce(error.message, true);}
    } else if (button.hasAttribute("data-personal-reload-metadata")) void operate(async () => {
      const saved = await request(base);record = {...record, profile: saved.profile};renderMetadata();
      announce("Saved timeline and stakeholder metadata reloaded. Your notes draft is unchanged.");
    });
    else if (button.hasAttribute("data-personal-export")) void operate(async () => download(new view.Blob([JSON.stringify(await request(`${base}/export`), null, 2)], {type: "application/json"}), "personal-project-backup.json"));
    else if (button.hasAttribute("data-revoke-share")) void operate(async () => {await request(`${base}/shares/${encodeURIComponent(button.dataset.revokeShare)}/revoke`, {method: "POST", body: {expectedRevision: Number(button.dataset.shareRevision)}});await renderSharing();announce("Registration revoked. Future reads through this grant are denied; already downloaded copies cannot be recalled.");});
  };
  root.addEventListener("submit", submit);root.addEventListener("click", click);
  const ready = (async () => {try {if (!uuid(identityId)) throw new Error("Choose a real-world project from the project directory.");record = await request(base);await render();} catch (error) {if (!disposed) root.textContent = error.message;}})();
  const dispose = () => {if (disposed) return;disposed = true;sharingGeneration++;controller.abort();intake?.dispose();documents?.dispose();root.removeEventListener("submit", submit);root.removeEventListener("click", click);};
  invalidation?.then(dispose, dispose);
  return {ready, dispose};
}
