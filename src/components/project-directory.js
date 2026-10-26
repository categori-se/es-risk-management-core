import {frameworks} from "../lib/framework-register.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const publicUrl = value => {try {const url = new URL(value);return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;} catch {return null;}};
const option = (id, name, selected) => `<option value="${h(id)}"${id === selected ? " selected" : ""}>${h(name)}</option>`;

/** Local directory holds public project identity; account stores own the reviews. */
export function mountProjectDirectory(root, {request, getProject, getAccountId, openFacet, updated, capture, onBusyChange, state = {}}) {
  state.identities ??= [];state.selected ??= "";state.message ??= "";
  let disposed = false, busy = false;
  const current = () => state.identities.find(item => item.id === (state.selected || getProject()?.projectContext?.identity.id));
  function render() {
    if (disposed) return;
    const identity = current(), project = getProject(), context = project?.projectContext;
    root.innerHTML = `<header><h2>Projects</h2><p>Open your project records for research, documents and maps. Choose a client or lender engagement when you need its separate review.</p></header><p data-directory-status role="status">${h(state.message)}</p>
      <ul class="lw-directory-projects" aria-label="Projects">${state.identities.map(item => `<li><button type="button" data-directory-project="${h(item.id)}"${item.id === identity?.id ? ' aria-current="true"' : ""}><strong>${h(item.name)}</strong><small>${item.facets.length} account review${item.facets.length === 1 ? "" : "s"}</small></button></li>`).join("") || '<li>No linked project identities yet. Create a project identity below or link an existing account review.</li>'}</ul>
      ${identity ? `<section class="lw-directory-selected"><h3>${h(identity.name)}</h3><p><a class="lw-primary" data-directory-personal href="/project-space?identity=${h(encodeURIComponent(identity.id))}">Open project records</a></p><p class="lw-small">Your project introduction, research, documents and spatial sources stay in your practitioner vault. Account reviews keep their own criteria, evidence and findings.</p><label><span>Client / lender account review</span><select data-directory-facet><option value="">Choose an account review</option>${identity.facets.map(facet => option(facet.projectId, `${facet.accountName} — ${facet.transactionName}`, facet.projectId === project?.id ? project.id : "")).join("")}</select></label>${!identity.facets.length ? '<p>Create an account review below, then link it to this project.</p>' : ""}
        <h4>Shared public project references</h4><p class="lw-small">These links describe the same project for all its accounts. They do not share private account files. Capture and review an exact version in the selected account before citing it as retained evidence.</p>
        <ul class="lw-shared-references">${identity.publicReferences.map(reference => `<li><strong>${h(reference.title)}</strong><p>${h(reference.publisher || "Publisher not recorded")}${reference.locator ? ` · ${h(reference.locator)}` : ""}</p>${publicUrl(reference.url) ? `<a href="${h(publicUrl(reference.url))}" target="_blank" rel="noopener noreferrer">Open public source</a>` : "<span>Public source URL unavailable</span>"}${publicUrl(reference.url) && context?.identity.id === identity.id ? ` <button type="button" data-directory-capture="${h(reference.id)}">Capture into this account</button>` : ""}${reference.sha256 ? `<p class="lw-small">Recorded source SHA256: <code>${h(reference.sha256)}</code>. Verify the captured version before relying on it.</p>` : ""}</li>`).join("") || '<li>No public source links recorded.</li>'}</ul>
        <details><summary>Add a public project reference</summary><form data-directory-form="reference" class="lw-form lw-grid"><label><span>Source title</span><input name="title" maxlength="500" required></label><label><span>Public webpage or document URL</span><input name="url" type="url" maxlength="4000" required></label><label><span>Publisher / source owner</span><input name="publisher" maxlength="500" placeholder="For example, World Bank"></label><label><span>Section, page or version description</span><input name="locator" maxlength="2000"></label><label class="lw-checkbox lw-wide"><input name="publicConfirmed" type="checkbox" required><span>I intend to share this public reference across the project's account reviews.</span></label><button type="submit">Add shared public reference</button></form></details></section>` : ""}
      <details><summary>Create a project identity</summary><form data-directory-form="create" class="lw-form"><label><span>Real-world project name</span><input name="name" maxlength="500" required placeholder="For example, Bujagali Energy"></label><button type="submit">Create project identity</button></form></details>
      ${project && !context ? `<details open><summary>Link this account review to its project</summary><p>${h(project.name)} stays in its current account. Linking identifies the same physical project; no files or assessments move.</p><form data-directory-form="link" class="lw-form"><label><span>Project identity</span><select name="identityId" required><option value="">Choose a project</option>${state.identities.map(item => option(item.id, item.name, state.selected)).join("")}</select></label><button type="submit">Link account review</button></form></details>` : ""}
      ${context ? `<details><summary>Framework editions for this account review</summary><p class="lw-small">${h(context.identity.name)} · ${h(project.engagement.client)}. Selection defines review scope; applicability still needs a separate rationale for each assessment.</p><form data-directory-form="frameworks" class="lw-form"><div class="lw-directory-frameworks">${frameworks.map(framework => `<label class="lw-checkbox"><input type="checkbox" name="frameworkIds" value="${h(framework.id)}"${context.frameworkIds.includes(framework.id) ? " checked" : ""}><span>${h(framework.institution)} — ${h(framework.edition)} · ${h(framework.name)}</span></label>`).join("")}</div><button type="submit">Save this account's review criteria</button></form></details>` : ""}`;
    for (const control of root.querySelectorAll("button,input,select")) control.disabled = busy;
  }
  async function refresh() {
    const result = await request("/api/project-directory");
    if (disposed) return;
    state.identities = result.identities;
    if (getProject()?.projectContext && !state.selected) state.selected = getProject().projectContext.identity.id;
    state.loaded = true;render();
  }
  async function run(work) {
    if (busy) return;busy = true;onBusyChange?.(true);render();
    try {await work();}
    catch (error) {if (!disposed) {state.message = error.message || "Project directory unavailable.";render();}}
    finally {busy = false;onBusyChange?.(false);if (!disposed) render();}
  }
  const onClick = event => {
    const selected = event.target.closest("[data-directory-project]");
    if (selected) {
      state.selected = selected.dataset.directoryProject;state.message = "Open your project records, or choose an account engagement for its separate review.";render();
      [...root.querySelectorAll('[data-directory-project]')].find(button => button.dataset.directoryProject === state.selected)?.focus();return;
    }
    const button = event.target.closest("[data-directory-capture]");
    if (button) {const reference = current()?.publicReferences.find(item => item.id === button.dataset.directoryCapture);if (reference && publicUrl(reference.url)) capture(reference);}
  };
  const onChange = event => {
    if (!event.target.matches("[data-directory-facet]") || !event.target.value) return;
    const facet = current()?.facets.find(item => item.projectId === event.target.value);
    if (facet) void run(() => openFacet(facet));
  };
  const onSubmit = event => {
    const form = event.target.closest("[data-directory-form]");if (!form) return;event.preventDefault();
    const data = new root.ownerDocument.defaultView.FormData(form), kind = form.dataset.directoryForm;
    const project = getProject(), accountId = getAccountId(), identity = current();
    void run(async () => {
      if (kind === "create") {
        const result = await request("/api/project-identities", {method: "POST", body: {name: String(data.get("name") || "").trim()}});
        state.selected = result.id;state.message = "Project identity created. Link each lender's account review to it.";
      } else if (kind === "link") {
        await request(`/api/projects/${encodeURIComponent(project.id)}/context`, {method: "PUT", body: {identityId: data.get("identityId")}});
        state.selected = data.get("identityId");await updated(project.id, accountId);
      } else if (kind === "frameworks") {
        await request(`/api/projects/${encodeURIComponent(project.id)}/frameworks`, {method: "PUT", body: {expectedRevision: project.projectContext.linkRevision, frameworkIds: data.getAll("frameworkIds")}});
        await updated(project.id, accountId);
      } else if (kind === "reference") {
        if (!data.get("publicConfirmed")) throw new Error("Confirm this reference is intended for the shared public shelf.");
        await request(`/api/project-identities/${encodeURIComponent(identity.id)}/references`, {method: "POST", body: {title: data.get("title"), url: data.get("url"), publisher: data.get("publisher"), locator: data.get("locator")}});
        state.message = "Shared public reference saved. Account evidence remains independently versioned.";
      }
      if (!disposed) {await refresh();await updated?.();}
    });
  };
  root.addEventListener("click", onClick);root.addEventListener("change", onChange);root.addEventListener("submit", onSubmit);render();
  const ready = state.loaded ? Promise.resolve() : run(refresh);
  return {ready, refresh, dispose() {disposed = true;root.removeEventListener("click", onClick);root.removeEventListener("change", onChange);root.removeEventListener("submit", onSubmit);onBusyChange?.(false);}};
}
