import {normalizePublicationContent} from "../lib/publication-records.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const subjectTypes = ["client", "company", "project", "topic"];
const formats = [["html", "Web / HTML"], ["docx", "Word"], ["xlsx", "Excel"], ["json", "Portable JSON"]];
const options = (values, selected) => values.map(([value, label]) => `<option value="${h(value)}"${value === selected ? " selected" : ""}>${h(label)}</option>`).join("");
const emptyContent = () => ({title: "", subtitle: "", summary: "", authors: [], body: "", subjects: [], tags: [], citations: []});
const fieldsFrom = content => ({title: content.title || "", subtitle: content.subtitle || "", summary: content.summary || "", authors: (content.authors || []).join("\n"), body: content.body || "", tags: (content.tags || []).join(", "), subjects: (content.subjects || []).map(subject => ({...structuredClone(subject), url: subject.url || ""})), citations: structuredClone(content.citations || [])});
const projectIdOf = project => project.id || project.project_id;
let sequence = 0;

function safeLink(value) {
  try {const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;} catch {return null;}
}

/** Render a server-produced article fragment without scripts, resource loads,
 * source HTML attributes, or active embeds. Raw authored Markdown stays intact. */
function previewFragment(document, html) {
  const template = document.createElement("template"); template.innerHTML = String(html || "");
  const allowed = new Set(["ARTICLE", "SECTION", "HEADER", "FOOTER", "DIV", "SPAN", "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "BLOCKQUOTE", "PRE", "CODE", "HR", "BR", "TABLE", "CAPTION", "THEAD", "TBODY", "TR", "TH", "TD", "A", "DL", "DT", "DD", "SUP", "SUB"]);
  for (const element of [...template.content.querySelectorAll("*")]) {
    if (!allowed.has(element.tagName)) {element.remove(); continue;}
    const href = element.tagName === "A" ? safeLink(element.getAttribute("href")) : null;
    const className = element.getAttribute("class");
    for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
    if (className && /^[A-Za-z0-9_ -]{1,300}$/.test(className)) element.className = className;
    if (href) {element.setAttribute("href", href); element.setAttribute("target", "_blank"); element.setAttribute("rel", "noopener noreferrer");}
    if (element.tagName === "TH") element.setAttribute("scope", "col");
  }
  return template.content;
}

/** Account-scoped authoring. The injected transport owns authentication and
 * storage routing; only server-issued permissions authorize hosted sharing. */
export function mountPublicationManager(root, {request, accountId, projectId = "", initialPublication, identityIssuer = "", mode = "local", onBusyChange, state = {}, download, invalidation} = {}) {
  if (!root || typeof root.addEventListener !== "function" || typeof request !== "function" || typeof accountId !== "string" || !accountId || !["local", "hosted"].includes(mode)) throw new TypeError("Publications require a root, transport, account ID and local/hosted mode.");
  const view = root.ownerDocument.defaultView, id = `publication-manager-${++sequence}`;
  state.accountId ??= accountId;
  if (state.accountId !== accountId) {root.textContent = "Open the account used for these publication drafts."; return {dispose() {}, hasDraft: () => true, hasPendingWork: () => false};}
  state.projects ??= []; state.projectId ??= projectId; state.publications ??= []; state.records ??= new Map(); state.drafts ??= new Map();
  state.editions ??= new Map(); state.editionSelection ??= new Map(); state.shareLinks ??= new Map(); state.selectedId ??= "";
  state.collaborators ??= new Map(); state.collaborationDrafts ??= new Map(); state.invitationLinks ??= new Map();
  state.search ??= ""; state.tab ??= "write"; state.message ??= "Opening publications…"; state.error ??= false;
  let disposed = false, renderedKey = "";
  const notify = () => state._render?.();
  const pending = () => Boolean(state.busy);
  const announce = (message, error = false) => {state.message = message; state.error = error;};
  const setBusy = value => {state.busy = value; state._onBusyChange?.(value);};
  const key = () => `${state.projectId}:${state.selectedId || "new"}`;
  const record = () => state.records.get(state.selectedId) || state.publications.find(article => article.id === state.selectedId);
  const permitted = action => mode === "local" ? action !== "manage_access" : Boolean(record()?.permissions?.includes(action));
  const canCreate = () => {
    if (!state.projectId || state.sharedOnly) return false;
    if (mode === "local") return true;
    const permissions = state.projects.find(project => projectIdOf(project) === state.projectId)?.permissions || [];
    return permissions.includes("edit") || permissions.includes("write");
  };
  const canEdit = () => Boolean(state.projectId && (state.selectedId ? permitted("edit") : canCreate()));
  const currentEditionId = () => state.editionSelection.get(state.selectedId) || record()?.editions?.at(-1)?.id || "";
  const path = () => `/api/publications/${encodeURIComponent(state.selectedId)}`;
  function draft() {
    if (!state.drafts.has(key())) {
      const fields = fieldsFrom(record()?.content || emptyContent());
      state.drafts.set(key(), {fields, baseline: JSON.stringify(fields), baseRevision: record()?.revision || 0, dirty: false});
    }
    return state.drafts.get(key());
  }
  function remember() {
    if (state._skipRemember) return;
    const invite = root.querySelector('[data-publication-form="invite"]'), team = root.querySelector('[data-publication-form="team"]');
    if (invite || team) {
      const retained = state.collaborationDrafts.get(state.selectedId) || {};
      if (invite) Object.assign(retained, {subject: invite.elements.subject.value, permission: invite.elements.permission.value, days: invite.elements.days.value});
      if (team) Object.assign(retained, {teamId: team.elements.teamId.value, teamPermission: team.elements.permission.value, teamExpires: team.elements.expires.value});
      state.collaborationDrafts.set(state.selectedId, retained);
    }
    const form = root.querySelector('[data-publication-form="write"]'), retained = state.drafts.get(renderedKey);
    if (!form || !retained) return;
    const value = name => String(form.elements.namedItem(name)?.value || "");
    const rows = (selector, names) => [...form.querySelectorAll(selector)].map(row => Object.fromEntries(names.map(name => [name, row.querySelector(`[data-field="${name}"]`).value]))).filter(row => names.some(name => name !== "type" && row[name].trim()));
    retained.fields = {title: value("title"), subtitle: value("subtitle"), summary: value("summary"), authors: value("authors"), body: value("body"), tags: value("tags"), subjects: rows("[data-publication-subject]", ["type", "name", "url"]), citations: rows("[data-publication-citation]", ["title", "url", "locator"])};
    retained.dirty = JSON.stringify(retained.fields) !== retained.baseline;
  }
  function content() {
    const fields = draft().fields;
    return normalizePublicationContent({...fields, authors: fields.authors.split(/\r?\n/).map(value => value.trim()).filter(Boolean), tags: fields.tags.split(/[,;\n]/).map(value => value.trim()).filter(Boolean), subjects: fields.subjects.map(subject => ({...subject, name: subject.name.trim(), url: subject.url?.trim() || ""})), citations: fields.citations.map(citation => ({...citation, title: citation.title.trim(), url: citation.url?.trim() || "", locator: citation.locator?.trim() || ""}))});
  }
  function accept(publication, {replaceDraft = false} = {}) {
    if (!publication?.id || publication.accountId !== accountId || publication.projectId !== state.projectId) throw new Error("The publication response belongs to another account or project.");
    state.records.set(publication.id, publication);
    const position = state.publications.findIndex(article => article.id === publication.id);
    if (position < 0) state.publications.unshift(publication); else state.publications[position] = publication;
    const existing = state.drafts.get(`${state.projectId}:${publication.id}`);
    if (replaceDraft || existing && !existing.dirty) {
      if (existing && renderedKey === `${state.projectId}:${publication.id}`) state._skipRemember = true;
      const fields = fieldsFrom(publication.content); state.drafts.set(`${state.projectId}:${publication.id}`, {fields, baseline: JSON.stringify(fields), baseRevision: publication.revision, dirty: false});
    }
    return publication;
  }
  function focus(selector = "[data-publication-editor-heading]") {
    const target = state._root?.querySelector(selector) || state._root?.querySelector("[data-publication-status]");
    if (target) {if (!target.matches("input,button,select,textarea,a")) target.tabIndex = -1; target.focus({preventScroll: true});}
  }
  async function run(work, {focusSelector} = {}) {
    if (pending()) return;
    remember(); setBusy(true); notify();
    try {await work();}
    catch (error) {announce(error.message || "The publication operation failed. Your draft remains on this page.", true);}
    finally {setBusy(false); notify(); focus(focusSelector);}
  }
  async function loadList({append = false} = {}) {
    const parameters = new URLSearchParams(state.sharedOnly ? {} : {project_id: state.projectId});
    if (append) {if (!state.hasMore || !state.nextCursor) throw new Error("The next publication page is unavailable. Refresh the article list."); parameters.set("after", state.nextCursor);}
    const result = await request(`/api/publications${parameters.size ? `?${parameters}` : ""}`);
    const incoming = state.sharedOnly ? (result.publications || []).filter(article => article.accountId === accountId && article.projectId === state.projectId) : result.publications || [];
    if (!Array.isArray(incoming) || incoming.some(article => !article?.id || article.accountId !== accountId || article.projectId !== state.projectId)) throw new Error("The article list response belongs to another account or project.");
    state.publications = append ? [...new Map([...state.publications, ...incoming].map(article => [article.id, article])).values()] : incoming;
    for (const article of incoming) accept(article);
    state.hasMore = result.hasMore === true;
    state.nextCursor = typeof result.nextCursor === "string" && result.nextCursor.length <= 4000 ? result.nextCursor : "";
    if (state.selectedId && !state.publications.some(article => article.id === state.selectedId) && !state.drafts.get(key())?.dirty) state.selectedId = "";
    if (!state.selectedId && state.publications.length && !state.drafts.get(`${state.projectId}:new`)?.dirty) state.selectedId = state.publications[0].id;
    announce(`${state.publications.length} publications loaded${state.hasMore ? "; more are available" : ""}. Drafts and issued editions stay in ${mode === "local" ? "local storage" : "the authenticated workspace"}.`);
  }
  async function initialize() {
    await run(async () => {
      if (initialPublication) {
        state.sharedOnly = true; state.projectId = initialPublication.projectId;
        state.projects = [{id: initialPublication.projectId, name: "Shared publication", accountId}];
        accept(initialPublication); state.selectedId = initialPublication.id;
        state.initialized = true; announce("Opened the shared publication with your server-granted article permissions. Project collection creation requires project access.");
        return;
      }
      const result = await request("/api/projects"), projects = Array.isArray(result) ? result : result.projects || [];
      state.projects = projects.filter(project => !(project.accountId || project.account_id) || (project.accountId || project.account_id) === accountId);
      if (!state.projects.some(project => projectIdOf(project) === state.projectId)) state.projectId = projectIdOf(state.projects[0] || {}) || "";
      if (state.projectId) await loadList(); else announce("Create a project in this account before writing a publication.");
      state.initialized = true;
    });
  }
  function listMarkup() {
    const search = state.search.trim().toLocaleLowerCase();
    const shown = state.publications.filter(article => !search || [article.content?.title, article.content?.summary, ...(article.content?.tags || []), ...(article.content?.subjects || []).map(subject => subject.name)].join(" ").toLocaleLowerCase().includes(search));
    return `<p class="pm-small" data-publication-count role="status">${shown.length} of ${state.publications.length} ${state.hasMore ? "loaded " : ""}articles</p><ul class="pm-article-list">${shown.map(article => `<li><button type="button" data-publication-select="${h(article.id)}"${article.id === state.selectedId ? ' aria-current="true"' : ""}><strong>${h(article.content?.title || "Untitled article")}</strong><span>${h(article.content?.subtitle || article.content?.summary || "No summary recorded")}</span><small>Revision ${h(article.revision)} · ${article.editions?.length || 0} issued editions · ${h(mode === "local" ? "Local only" : article.sharing?.visibility || "private")}${state.drafts.get(`${state.projectId}:${article.id}`)?.dirty ? " · unsaved draft" : ""}</small></button></li>`).join("") || '<li class="pm-empty">No articles match. Start a new article or change the search.</li>'}</ul>${state.hasMore ? `<button type="button" data-publication-action="load-more"${state.nextCursor ? "" : " disabled"}>Load more articles</button>` : ""}`;
  }
  function subjectRows(fields) {
    const rows = fields.subjects.length ? fields.subjects : [{type: "client", name: "", url: ""}];
    return rows.map((subject, index) => `<div class="pm-subject-row" data-publication-subject><label><span>Subject type</span><select data-field="type">${options(subjectTypes.map(type => [type, type[0].toUpperCase() + type.slice(1)]), subject.type)}</select></label><label><span>Subject name</span><input data-field="name" value="${h(subject.name)}" maxlength="500"></label><label><span>Subject URL (optional)</span><input data-field="url" type="url" value="${h(subject.url)}" maxlength="4000"></label><button type="button" data-publication-remove="subject" data-index="${index}" aria-label="Remove subject ${index + 1}">Remove</button></div>`).join("");
  }
  function citationRows(fields) {
    const rows = fields.citations.length ? fields.citations : [{title: "", url: "", locator: ""}];
    return rows.map((citation, index) => `<div class="pm-citation-row" data-publication-citation><label><span>Source title</span><input data-field="title" value="${h(citation.title)}" maxlength="1000"></label><label><span>Source URL</span><input data-field="url" type="url" value="${h(citation.url)}" maxlength="4000"></label><label><span>Page / paragraph / locator</span><input data-field="locator" value="${h(citation.locator)}" maxlength="2000"></label><button type="button" data-publication-remove="citation" data-index="${index}" aria-label="Remove citation ${index + 1}">Remove</button></div>`).join("");
  }
  function writerMarkup() {
    const retained = draft(), fields = retained.fields;
    return `<form data-publication-form="write" class="pm-writer"><div class="pm-fields"><label class="pm-wide"><span>Article title</span><input name="title" value="${h(fields.title)}" maxlength="500" required></label><label class="pm-wide"><span>Subtitle</span><input name="subtitle" value="${h(fields.subtitle)}" maxlength="1000"></label><label class="pm-wide"><span>Summary / description</span><textarea name="summary" rows="3" maxlength="4000">${h(fields.summary)}</textarea></label><label><span>Authors (one per line)</span><textarea name="authors" rows="3">${h(fields.authors)}</textarea></label><label><span>Tags (comma separated)</span><input name="tags" value="${h(fields.tags)}" maxlength="4000"></label></div><label class="pm-body-label"><span>Article body (Markdown)</span><textarea name="body" rows="22" maxlength="64000" spellcheck="true">${h(fields.body)}</textarea><small>Use headings, paragraphs, lists and links. Preview the article before issuing an edition. Authored HTML and scripts are not executed.</small></label><details class="pm-writer-details" open><summary>Clients, companies, projects and topics</summary><p class="pm-small">Subjects describe the article. They do not grant access to client records.</p><div data-publication-subjects>${subjectRows(fields)}</div><button type="button" data-publication-add="subject">Add subject</button></details><details class="pm-writer-details" open><summary>Sources and citations</summary><p class="pm-small">Use a precise locator. Public editions include these citations; they do not expose the project's private source files.</p><div data-publication-citations>${citationRows(fields)}</div><button type="button" data-publication-add="citation">Add citation</button></details><div class="pm-actions"><button type="submit">${state.selectedId ? "Save article draft" : "Create article draft"}</button>${state.selectedId ? '<button type="button" data-publication-action="check-revision">Check saved revision</button>' : ""}</div>${state.serverRevision !== undefined ? `<p class="pm-note">Saved server revision: ${h(state.serverRevision)}. This draft is based on revision ${h(retained.baseRevision)}. Checking does not overwrite your writing.</p><button type="button" data-publication-action="replace-draft">Replace this draft with the saved version</button>` : ""}</form>`;
  }
  function previewMarkup() {
    return `<div class="pm-panel-heading"><div><h3>Article preview</h3><p class="pm-small">${state.preview?.editionId ? `Issued edition ${h(state.preview.editionId)} — fixed content.` : "Current editor content. This preview does not save or publish the article."}</p></div><button type="button" data-publication-action="preview">Refresh draft preview</button></div><div class="pm-preview" data-publication-preview>${state.preview?.html ? "" : '<p class="pm-empty">Choose Refresh draft preview to render the current writing.</p>'}</div>`;
  }
  function editionsMarkup() {
    const article = record(), editionId = currentEditionId(), edition = state.editions.get(editionId);
    return `<div class="pm-panel-heading"><div><h3>Issued editions</h3><p class="pm-small">Issuing freezes the saved article. Later writing and sharing changes do not rewrite an edition.</p></div><button type="button" data-publication-action="issue"${!state.selectedId || !canEdit() || draft().dirty ? " disabled" : ""}>Issue saved article</button></div>${draft().dirty ? '<p class="pm-note">Save the current draft before issuing it. Unsaved writing is never included automatically.</p>' : ""}${article?.editions?.length ? `<label><span>Select an immutable edition</span><select data-publication-edition>${options(article.editions.map(item => [item.id, `${item.issuedAt} · revision ${item.sourceRevision} · ${item.id}`]).reverse(), editionId)}</select></label><div class="pm-actions pm-export-actions">${formats.map(([format, label]) => `<button type="button" data-publication-export="${format}">Download ${label}</button>`).join("")}<button type="button" data-publication-action="preview-edition">Preview selected edition</button></div><dl class="pm-facts"><dt>Edition ID</dt><dd><code>${h(editionId)}</code></dd><dt>SHA256</dt><dd><code>${h((edition || article.editions.find(item => item.id === editionId))?.sha256 || "Not recorded")}</code></dd><dt>Content</dt><dd>${edition ? h(edition.content.title) : "Edition content loads when selected or previewed."}</dd></dl>${edition ? `<details><summary>Inspect frozen Markdown</summary><pre class="pm-frozen-body">${h(edition.content.body)}</pre></details>` : ""}` : '<div class="pm-empty"><h4>No edition has been issued.</h4><p>Save the article, then issue an edition to create web, Word, Excel and portable exports.</p></div>'}`;
  }
  function sharedUrl(article, token) {
    const relative = `/read/${encodeURIComponent(article.id)}${token ? `#token=${encodeURIComponent(token)}` : ""}`;
    return new URL(relative, view.location.origin).href;
  }
  function collaboratorMarkup(article) {
    if (mode !== "hosted" || !article) return "";
    const privateUrl = new URL(`/publications?${new URLSearchParams({publication: article.id})}`, view.location.origin).href;
    const loaded = state.collaborators.get(article.id), retained = state.collaborationDrafts.get(article.id) || {};
    const invitation = state.invitationLinks.get(article.id), canManage = permitted("manage_access");
    const current = loaded?.configuration_revision === article.revision;
    return `<section class="pm-collaborators"><h3>Named collaborators</h3><p class="pm-small">Private article access is granted to verified users and teams. Public / unlisted audience settings are independent of these grants.</p><div class="pm-share-link"><label><span>Private article link — sign-in and article access required</span><input readonly value="${h(privateUrl)}" data-publication-private-link></label><a href="${h(privateUrl)}" target="_blank" rel="noopener noreferrer">Open private article</a></div>${canManage ? `<button type="button" data-publication-action="load-collaborators">Load collaborators and eligible teams</button>${loaded ? `<p class="pm-small">Resource configuration revision ${h(loaded.configuration_revision)}${current ? "" : "; reload collaborators before changing a team grant"}.</p>${loaded.teamError ? `<p class="pm-note">${h(loaded.teamError)}</p>` : ""}<div class="pm-grant-list">${loaded.grants?.length ? loaded.grants.map(grant => `<article class="pm-grant"><div><strong>${h(grant.subject_type === "team" ? loaded.teams.find(team => team.team_id === grant.subject_id)?.name || grant.subject_id : grant.subject_id)}</strong><p class="pm-small">${h(grant.subject_type)} · ${h(grant.status)} · ${h((grant.actions || []).join(", "))} · ${h(grant.expires_at || "No expiry")}<br>Grant <code>${h(grant.grant_id)}</code> · revision ${h(grant.revision)}</p></div>${grant.status === "active" ? `<button type="button" data-publication-revoke="${h(grant.grant_id)}"${current ? "" : " disabled"}>Revoke this grant</button>` : ""}</article>`).join("") : '<p class="pm-small">No explicit collaborator grants are recorded. Ownership and other server access paths can still apply.</p>'}</div><form data-publication-form="team" class="pm-collaboration-form"><h4>Grant a team article access</h4><label><span>Team in this exact account and workspace</span><select name="teamId"${loaded.teams.length ? "" : " disabled"}>${options(loaded.teams.map(team => [team.team_id, team.name]), retained.teamId)}</select></label><label><span>Team permission</span><select name="permission">${options([["view", "Viewer"], ["edit", "Editor"]], retained.teamPermission || "view")}</select></label><label><span>Expiry (optional ISO date and time)</span><input name="expires" value="${h(retained.teamExpires || "")}" placeholder="YYYY-MM-DDTHH:mm:ssZ"></label><button type="submit"${current && loaded.teams.length ? "" : " disabled"}>Save team grant</button></form>` : '<p class="pm-small">Load current grants before selecting a team.</p>'}<form data-publication-form="invite" class="pm-collaboration-form"><h4>Invite a verified person</h4><p class="pm-small">Copy the recipient's verified subject ID from their identity profile. An email address or display name does not identify the account receiving this access.</p><label class="pm-wide"><span>Identity issuer</span><input readonly value="${h(identityIssuer)}"></label><label class="pm-wide"><span>Recipient verified subject ID</span><input name="subject" maxlength="512" required value="${h(retained.subject || "")}"></label><label><span>Permission</span><select name="permission">${options([["view", "Viewer"], ["edit", "Editor"]], retained.permission || "view")}</select></label><label><span>Invitation expiry (days, 1–7)</span><input type="number" name="days" min="1" max="7" step="1" required value="${h(retained.days || "3")}"></label><button type="submit"${identityIssuer ? "" : " disabled"}>Create invitation link</button>${identityIssuer ? "" : '<p class="pm-note">The verified identity issuer must be configured before creating an invitation.</p>'}</form>${invitation ? `<div class="pm-share-link"><p class="pm-small">Invitation created for ${h(invitation.subject)}. The recipient must sign in as that exact identity and accept it. Share this link deliberately; this action sends no email.</p><label><span>Invitation link — secret shown for this session</span><input readonly value="${h(invitation.url)}" data-publication-invitation-link></label><button type="button" data-publication-action="select-invitation-link">Select invitation link</button></div>` : ""}` : '<p class="pm-note">Your server permissions do not include managing collaborator access.</p>'}</section>`;
  }
  function sharingMarkup() {
    const article = record(), canShare = mode === "hosted" && permitted("manage_access"), editionId = currentEditionId();
    const link = article && (state.shareLinks.get(article.id) || (article.sharing?.visibility === "public" ? sharedUrl(article) : ""));
    return `<h3>Audience and sharing</h3><p class="pm-note">${mode === "local" ? "Local authoring and exports work on this device. Public and unlisted hosting are unavailable here; downloading an edition does not publish it online." : "These controls update the hosted service's actual publication audience. Only the selected issued edition is shared. Project files and unsaved drafts stay separate."}</p>${article ? `<dl class="pm-facts"><dt>Current hosted audience</dt><dd>${h(mode === "local" ? "Local only — not hosted" : article.sharing?.visibility || "private")}</dd><dt>Shared edition</dt><dd><code>${h(article.sharing?.editionId || "None")}</code></dd><dt>Edition selected for sharing</dt><dd><code>${h(editionId || "Issue an edition first")}</code></dd></dl>` : ""}<form data-publication-form="share"><label><span>Audience for the selected edition</span><select name="visibility"${!canShare ? " disabled" : ""}>${options([["private", "Private — remove public / link access"], ["unlisted", "Unlisted — anyone with the link"], ["public", "Public — publicly readable"]], article?.sharing?.visibility || "private")}</select></label><p class="pm-small">An unlisted URL is access for anyone holding that link. Its token is returned once; keep it with intended recipients. Named users and teams need explicit hosted grants, not a subject or author label.</p><button type="submit"${!canShare ? " disabled" : ""}>Apply hosted sharing</button></form>${mode === "hosted" && !permitted("manage_access") ? '<p class="pm-note">The server has not granted you manage access permission for this article.</p>' : ""}${link && mode === "hosted" ? `<div class="pm-share-link"><label><span>${article.sharing?.visibility === "unlisted" ? "Unlisted link — token shown for this session" : "Public article URL"}</span><input readonly value="${h(link)}" data-publication-share-link></label><a href="${h(link)}" target="_blank" rel="noopener noreferrer">Open shared edition</a></div>` : ""}${collaboratorMarkup(article)}`;
  }
  function renderList() {const target = root.querySelector("[data-publication-list]"); if (target) {target.innerHTML = listMarkup(); if (pending()) for (const button of target.querySelectorAll("button")) button.disabled = true;}}
  function render() {
    if (disposed) return;
    remember(); state._skipRemember = false; const article = record(), retained = draft();
    root.classList.add("publication-manager"); root.setAttribute("aria-busy", String(pending()));
    root.innerHTML = `<header class="pm-heading"><div><p class="pm-eyebrow">E&S professional workspace</p><h1>Publication studio</h1><p>Write about clients, companies and projects. Issue a fixed edition for the web and for your documents.</p></div><span class="pm-mode">${mode === "local" ? "Local authoring" : "Hosted workspace"}</span></header><p data-publication-status class="pm-status${state.error ? " pm-error" : ""}" role="${state.error ? "alert" : "status"}">${h(state.message)}</p><div class="pm-layout"><aside class="pm-sidebar"><label><span>Project for this article collection</span><select data-publication-project>${state.projects.length ? options(state.projects.map(project => [projectIdOf(project), project.name]), state.projectId) : '<option value="">No projects available</option>'}</select></label><button type="button" data-publication-action="new"${!canCreate() ? " disabled" : ""}>New article</button><label><span>Search articles and subjects</span><input type="search" data-publication-search value="${h(state.search)}" placeholder="Title, client, company, project or tag"></label><div data-publication-list>${listMarkup()}</div><button type="button" data-publication-action="refresh">Refresh article list</button></aside><section class="pm-editor" aria-labelledby="${id}-heading"><header class="pm-editor-heading"><div><p class="pm-eyebrow">${state.selectedId ? `Saved article · revision ${h(article?.revision)}` : "New article draft"}</p><h2 id="${id}-heading" data-publication-editor-heading tabindex="-1">${h(retained.fields.title || "Untitled article")}</h2><p class="pm-small" data-publication-draft-status>${retained.dirty ? "Unsaved changes — retained on this page" : state.selectedId ? "Saved draft" : "Enter a title and start writing"}</p></div>${state.selectedId ? `<code class="pm-small">${h(state.selectedId)}</code>` : ""}</header><div class="pm-tabs" role="tablist" aria-label="Publication workspace">${[["write", "Write"], ["preview", "Preview"], ["editions", "Editions & exports"], ["sharing", "Sharing"]].map(([tab, label]) => `<button type="button" role="tab" id="${id}-tab-${tab}" aria-controls="${id}-panel-${tab}" aria-selected="${state.tab === tab}" tabindex="${state.tab === tab ? "0" : "-1"}" data-publication-tab="${tab}">${label}</button>`).join("")}</div><div class="pm-tab-panel" role="tabpanel" id="${id}-panel-${state.tab}" aria-labelledby="${id}-tab-${state.tab}">${!state.projectId ? '<p class="pm-empty">Create or select a project to begin.</p>' : state.tab === "write" ? writerMarkup() : state.tab === "preview" ? previewMarkup() : state.tab === "editions" ? editionsMarkup() : sharingMarkup()}</div>${["write", "preview", "editions", "sharing"].filter(tab => tab !== state.tab).map(tab => `<div hidden role="tabpanel" id="${id}-panel-${tab}" aria-labelledby="${id}-tab-${tab}"></div>`).join("")}</section></div>`;
    renderedKey = key();
    if (state.tab === "preview" && state.preview?.html) root.querySelector("[data-publication-preview]").append(previewFragment(root.ownerDocument, state.preview.html));
    if (state.tab === "write" && !canEdit()) {for (const control of root.querySelectorAll('.pm-writer input,.pm-writer textarea,.pm-writer select,.pm-writer button')) control.disabled = true; root.querySelector(".pm-writer")?.insertAdjacentHTML("afterbegin", '<p class="pm-note">The server has not granted editing permission for this article.</p>');}
    if (state.sharedOnly) {root.querySelector('[data-publication-action="new"]').disabled = true; root.querySelector("[data-publication-project]").disabled = true;}
    if (pending()) for (const control of root.querySelectorAll("input,textarea,select,button")) control.disabled = true;
  }
  async function saveDraft() {
    if (!canEdit()) return;
    await run(async () => {
      const retained = draft(), body = content(), creating = !state.selectedId;
      const result = await request(creating ? "/api/publications" : path(), {method: creating ? "POST" : "PATCH", body: creating ? {projectId: state.projectId, content: body} : {expectedRevision: retained.baseRevision, content: body}});
      const publication = accept(result.publication, {replaceDraft: true});
      if (creating) state.drafts.delete(`${state.projectId}:new`);
      state.selectedId = publication.id; state.serverRevision = undefined; state.preview = null;
      state._skipRemember = true;
      announce(`Saved ${publication.content.title} at revision ${publication.revision}. No edition was published.`);
    });
  }
  async function loadEdition(editionId = currentEditionId()) {
    if (!editionId) throw new Error("Issue and select an edition first.");
    if (!state.editions.has(editionId)) {
      const result = await request(`${path()}/editions/${encodeURIComponent(editionId)}`), edition = result.edition;
      if (!edition || edition.id !== editionId || edition.publicationId !== state.selectedId || edition.accountId !== accountId || edition.projectId !== state.projectId || edition.workspaceId !== record()?.workspaceId) throw new Error("The edition response belongs to another publication, project or account.");
      state.editions.set(editionId, edition);
    }
    return state.editions.get(editionId);
  }
  async function preview(issued = false) {
    await run(async () => {
      const edition = issued ? await loadEdition() : null, body = edition?.content || content();
      const result = await request("/api/publication-previews", {method: "POST", body: {content: body}});
      if (typeof result.html !== "string" || result.html.length > 2 * 1024 * 1024) throw new Error("The preview response is unavailable or too large.");
      state.preview = {html: result.html, editionId: edition?.id || ""}; state.tab = "preview";
      announce(issued ? "Previewing the selected immutable edition." : "Previewing the current editor content. Nothing was saved or shared.");
    });
  }
  async function exportEdition(format) {
    if (!formats.some(([value]) => value === format)) return;
    await run(async () => {
      const edition = await loadEdition(), editionId = edition.id;
      const blob = await request(`${path()}/editions/${encodeURIComponent(editionId)}/export?${new URLSearchParams({format})}`, {binary: true});
      const filename = `${String(edition.content.title || "publication").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100)}-${editionId}.${format}`;
      if (download) await download(blob, filename);
      else {const url = view.URL.createObjectURL(blob), link = root.ownerDocument.createElement("a"); link.href = url; link.download = filename; link.hidden = true; root.append(link); link.click(); link.remove(); view.setTimeout(() => view.URL.revokeObjectURL(url), 30000);}
      announce(`Downloaded the selected edition as ${format.toUpperCase()}.`);
    });
  }
  async function share(form) {
    if (mode !== "hosted" || !permitted("manage_access")) {announce("Hosted manage access permission is required to change sharing.", true); notify(); return;}
    const visibility = form.elements.namedItem("visibility").value;
    await run(async () => {
      const editionId = visibility === "private" ? null : currentEditionId();
      if (visibility !== "private" && !editionId) throw new Error("Issue and select an edition before sharing it.");
      const beforeRevision = record().revision;
      const result = await request(`${path()}/share`, {method: "POST", body: {expectedRevision: beforeRevision, editionId, visibility}}), article = accept(result.publication);
      state.shareLinks.delete(article.id);
      if (visibility === "unlisted" && result.token) state.shareLinks.set(article.id, sharedUrl(article, result.token));
      // Sharing changes the profile revision, not the saved authoring content.
      const retained = draft(); if (retained.baseRevision === beforeRevision) retained.baseRevision = article.revision;
      announce(visibility === "private" ? "Hosted public and unlisted access has been removed." : `Hosted ${visibility} access now uses the selected issued edition.`);
    });
  }
  function requireAccessManager() {
    if (mode !== "hosted" || !state.selectedId || !permitted("manage_access")) throw new Error("Hosted manage access permission is required for collaborator changes.");
  }
  async function loadCollaborators() {
    requireAccessManager();
    const fresh = await request(path()); accept(fresh.publication);
    const article = record();
    const results = await Promise.allSettled([request(`/api/notebooks/${encodeURIComponent(article.id)}/grants`), request(`/api/teams?${new URLSearchParams({workspace_id: article.workspaceId})}`)]);
    if (results[0].status !== "fulfilled") throw results[0].reason;
    const grants = results[0].value;
    if (!Array.isArray(grants.grants) || !Number.isSafeInteger(grants.configuration_revision) || grants.grants.some(grant => grant.resource_id && grant.resource_id !== article.id || grant.workspace_id && grant.workspace_id !== article.workspaceId)) throw new Error("The collaborator response does not match this article.");
    const teams = results[1].status === "fulfilled" ? (results[1].value.teams || []).filter(team => team.workspace_id === article.workspaceId && team.account_id === article.accountId && team.status === "active" && team.server_authoritative === true) : [];
    state.collaborators.set(article.id, {...grants, teams, teamError: results[1].status === "rejected" ? "Eligible teams could not be loaded. Named invitations and the grant list remain available; retry to select a team." : ""});
  }
  async function refreshAccessAfterSave(message) {
    try {await loadCollaborators(); announce(message);}
    catch {state.collaborators.delete(state.selectedId); announce(`${message} Reload collaborators to inspect the latest grants; the refresh could not be completed.`, true);}
  }
  async function saveTeam(form) {
    const teamId = form.elements.teamId.value, role = form.elements.permission.value, expiration = form.elements.expires.value.trim();
    await run(async () => {
      requireAccessManager();
      const article = record(), loaded = state.collaborators.get(article.id);
      if (!loaded || loaded.configuration_revision !== article.revision) throw new Error("Reload collaborators before changing this article's team grants.");
      const team = loaded.teams.find(team => team.team_id === teamId);
      if (!team || team.workspace_id !== article.workspaceId || team.account_id !== article.accountId) throw new Error("Choose a current team in this article's exact account and workspace.");
      if (!["view", "edit"].includes(role)) throw new Error("Choose Viewer or Editor access.");
      const expiresAt = expiration ? Date.parse(expiration) : null;
      if (expiration && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) throw new Error("Choose a future ISO expiry or leave it blank.");
      const existing = loaded.grants.filter(grant => grant.subject_type === "team" && grant.subject_id === teamId && grant.status === "active");
      if (existing.length > 1) throw new Error("This team has multiple active explicit grants. Revoke the extra grants before setting one team permission.");
      await request(`/api/notebooks/${encodeURIComponent(article.id)}/grants`, {method: "PUT", body: {configuration_revision: loaded.configuration_revision, subject_type: "team", subject_id: teamId, permissions: role === "edit" ? ["view", "edit"] : ["view"], expires_at: expiration ? new Date(expiresAt).toISOString() : null, ...(existing[0] ? {grant_id: existing[0].grant_id, expected_revision: existing[0].revision} : {})}});
      await refreshAccessAfterSave("Saved the explicit team article grant.");
    });
  }
  async function revokeGrant(grantId) {
    await run(async () => {
      requireAccessManager();
      const article = record(), loaded = state.collaborators.get(article.id), grant = loaded?.grants.find(grant => grant.grant_id === grantId);
      if (!grant || grant.status !== "active" || loaded.configuration_revision !== article.revision) throw new Error("Reload collaborators before revoking this exact grant.");
      await request(`/api/notebooks/${encodeURIComponent(article.id)}/grants`, {method: "PUT", body: {configuration_revision: loaded.configuration_revision, grant_id: grant.grant_id, expected_revision: grant.revision, status: "revoked"}});
      await refreshAccessAfterSave("Revoked the selected grant. Other server-granted access paths still apply.");
    });
  }
  async function invitePerson(form) {
    const subject = form.elements.subject.value.trim(), role = form.elements.permission.value, days = Number(form.elements.days.value);
    await run(async () => {
      requireAccessManager();
      if (!identityIssuer || !safeLink(identityIssuer) || !subject || subject.length > 512 || /[\x00-\x1f\x7f]/.test(subject)) throw new Error("A configured identity issuer and the recipient's exact verified subject ID are required.");
      if (!["view", "edit"].includes(role) || !Number.isInteger(days) || days < 1 || days > 7) throw new Error("Choose Viewer or Editor and an invitation expiry from 1 to 7 days.");
      const result = await request("/api/invitations", {method: "POST", body: {resource_type: "notebook", resource_id: state.selectedId, configuration_revision: record().revision, recipient: {issuer: identityIssuer, subject}, permissions: role === "edit" ? ["view", "edit"] : ["view"], expires_at: new Date(Date.now() + days * 86400000 - 60000).toISOString()}});
      if (!result.invitation?.invitation_id || !Number.isSafeInteger(result.invitation.revision) || typeof result.token !== "string" || !result.token || result.token.length > 4096) throw new Error("The invitation response did not contain a usable one-time handoff. Inspect the hosted invitation list before retrying.");
      const url = new URL(`/me?${new URLSearchParams({invitation: result.invitation.invitation_id})}`, view.location.origin);
      url.hash = new URLSearchParams({invitation_token: result.token, invitation_revision: String(result.invitation.revision)}).toString();
      state.invitationLinks.set(state.selectedId, {url: url.href, subject});
      const retained = state.collaborationDrafts.get(state.selectedId) || {}; retained.subject = ""; state.collaborationDrafts.set(state.selectedId, retained); state._skipRemember = true;
      announce("Created an exact-identity invitation link. The recipient must accept it to receive article access.");
    });
  }
  const onSubmit = event => {const form = event.target.closest("[data-publication-form]"); if (!form || !root.contains(form)) return; event.preventDefault(); event.stopPropagation(); if (form.dataset.publicationForm === "write") void saveDraft(); else if (form.dataset.publicationForm === "invite") void invitePerson(form); else if (form.dataset.publicationForm === "team") void saveTeam(form); else void share(form);};
  const onInput = event => {
    if (pending()) return;
    if (event.target.matches("[data-publication-search]")) {state.search = event.target.value; renderList(); return;}
    if (event.target.closest('[data-publication-form="invite"], [data-publication-form="team"]')) {remember(); return;}
    if (event.target.closest('[data-publication-form="write"]')) {remember(); root.querySelector("[data-publication-draft-status]").textContent = draft().dirty ? "Unsaved changes — retained on this page" : "Saved draft"; root.querySelector("[data-publication-editor-heading]").textContent = draft().fields.title || "Untitled article"; renderList();}
  };
  const onChange = event => {
    if (pending()) return;
    if (event.target.matches("[data-publication-project]")) {const project = event.target.value; remember(); void run(async () => {state.projectId = project; state.selectedId = ""; state.tab = "write"; state.preview = null; state.serverRevision = undefined; await loadList();});}
    else if (event.target.matches("[data-publication-edition]")) {state.editionSelection.set(state.selectedId, event.target.value); void run(async () => {await loadEdition(); announce("Selected immutable edition.");});}
    else onInput(event);
  };
  const onClick = event => {
    const button = event.target.closest("button"); if (!button || !root.contains(button) || pending()) return;
    if (button.dataset.publicationTab) {remember(); state.tab = button.dataset.publicationTab; notify(); focus(`[data-publication-tab="${state.tab}"]`); return;}
    if (button.dataset.publicationSelect) {remember(); const articleId = button.dataset.publicationSelect; void run(async () => {const result = await request(`/api/publications/${encodeURIComponent(articleId)}`); accept(result.publication); state.selectedId = articleId; state.preview = null; state.serverRevision = undefined; state.tab = "write"; announce("Opened article. Any other unsaved drafts remain on this page.");}); return;}
    if (button.dataset.publicationExport) {void exportEdition(button.dataset.publicationExport); return;}
    if (button.dataset.publicationRevoke) {void revokeGrant(button.dataset.publicationRevoke); return;}
    if (button.dataset.publicationAdd || button.dataset.publicationRemove) {remember(); const kind = button.dataset.publicationAdd || button.dataset.publicationRemove, rows = draft().fields[kind === "subject" ? "subjects" : "citations"]; if (button.dataset.publicationAdd) rows.push(kind === "subject" ? {type: "client", name: "", url: ""} : {title: "", url: "", locator: ""}); else rows.splice(Number(button.dataset.index), 1); draft().dirty = JSON.stringify(draft().fields) !== draft().baseline; state._skipRemember = true; notify(); focus(`[data-publication-${kind}]:last-child input`); return;}
    const action = button.dataset.publicationAction;
    if (action === "new") {if (!canCreate()) return; remember(); state.selectedId = ""; state.tab = "write"; state.preview = null; state.serverRevision = undefined; notify(); focus('[name="title"]');}
    else if (action === "refresh") void run(loadList);
    else if (action === "load-more") void run(() => loadList({append: true}), {focusSelector: '[data-publication-action="load-more"]'});
    else if (action === "load-collaborators") void run(async () => {await loadCollaborators(); announce("Loaded the article's current explicit grants and eligible teams.");});
    else if (action === "select-invitation-link") {const link = root.querySelector("[data-publication-invitation-link]"); link?.focus(); link?.select();}
    else if (action === "preview" || action === "preview-edition") void preview(action === "preview-edition");
    else if (action === "issue") {if (!state.selectedId || !canEdit() || draft().dirty) return; void run(async () => {const result = await request(`${path()}/editions`, {method: "POST", body: {expectedRevision: record().revision}}); const article = accept(result.publication); if (result.edition) {state.editions.set(result.edition.id, result.edition); state.editionSelection.set(article.id, result.edition.id);} draft().baseRevision = article.revision; announce("Issued a fixed edition of the saved article. Sharing has not changed.");});}
    else if (action === "check-revision") void run(async () => {const result = await request(path()); const article = accept(result.publication); state.serverRevision = article.revision; announce("Checked the saved revision. Your current draft is unchanged.");});
    else if (action === "replace-draft") {const article = record(); if (article) {accept(article, {replaceDraft: true}); state.serverRevision = undefined; state._skipRemember = true; notify(); focus('[name="title"]');}}
  };
  const onKeyDown = event => {
    const article = event.target.closest("[data-publication-select]");
    if (article && !pending() && ["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      const rows = [...root.querySelectorAll("[data-publication-select]")], index = rows.indexOf(article);
      event.preventDefault(); rows[event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus(); return;
    }
    const tab = event.target.closest("[data-publication-tab]"); if (!tab || pending() || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); const tabs = [...root.querySelectorAll("[data-publication-tab]")], index = tabs.indexOf(tab), next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length; tabs[next].click();
  };
  const listeners = {submit: onSubmit, input: onInput, change: onChange, click: onClick, keydown: onKeyDown};
  for (const [name, listener] of Object.entries(listeners)) root.addEventListener(name, listener);
  state._render = render; state._root = root; state._onBusyChange = onBusyChange; render(); state._onBusyChange?.(pending());
  if (!state.initialized && !pending()) void initialize();
  function dispose() {if (disposed) return; remember(); disposed = true; for (const [name, listener] of Object.entries(listeners)) root.removeEventListener(name, listener); if (state._render === render) {delete state._render; delete state._root; delete state._onBusyChange;}}
  if (invalidation?.then) invalidation.then(dispose, dispose);
  return {dispose, hasDraft: () => [...state.drafts.values()].some(item => item.dirty), hasPendingWork: pending};
}
