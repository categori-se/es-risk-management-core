import {oversightRecordDefinitions, oversightProfileFields, oversightRatingScales} from "../lib/oversight-model.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
const human = value => String(value ?? "").replaceAll("_", " ");
const tabs = [["portfolio", "Portfolio"], ["dossier", "Project dossier"], ["reviews", "Management reviews"], ["program", "Regional program"], ["reporting", "Institutional reporting"]];
const projectId = project => String(project?.id || project?.projectId || project?.project_id || "");
const projectName = project => project?.name || project?.projectName || project?.project_name || projectId(project);
const labelFor = type => oversightRecordDefinitions[type]?.label || human(type);
const optionPairs = options => (options || []).map(option => typeof option === "object" ? [option.value, option.label || human(option.value)] : [option, human(option)]);
const optionsMarkup = (options, selected, empty = "Choose…") => `<option value="">${h(empty)}</option>${optionPairs(options).map(([value,label]) => `<option value="${h(value)}"${String(value) === String(selected ?? "") ? " selected" : ""}>${h(label)}</option>`).join("")}`;
const valuesText = value => Array.isArray(value) ? value.map(item => typeof item === "object" ? JSON.stringify(item) : item).join(", ") : typeof value === "object" && value !== null ? JSON.stringify(value, null, 2) : String(value ?? "");
const errorMessage = error => error?.message || "The request could not be completed.";
const recordFields = type => oversightRecordDefinitions[type]?.fields || [];
const countMetric = (count, label) => `<div class="ow-metric"><strong>${h(count)}</strong><span>${h(label)}</span></div>`;
const comparable = value => JSON.stringify(value,(_,item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
let nextWorkspaceId = 0;
const validApi = api => api && ["projects", "get", "getProject", "mutate", "portfolio", "issueSnapshot", "getSnapshot", "history"].every(name => typeof api[name] === "function");

/** Persisted oversight records, supplied through an already scoped API adapter.
 * No account discovery, automatic ratings, polling or approval is performed here. */
export function mountOversightWorkspace(root, {api, initialProjectId, invalidation} = {}) {
  if (!root?.ownerDocument || !validApi(api)) throw new Error("The oversight workspace needs a scoped API adapter.");
  const view = root.ownerDocument.defaultView,instanceId = `ow-${++nextWorkspaceId}`;
  let disposed = false, context = 0, projectSequence = 0, portfolioSequence = 0, currentApi = api, busy = false, loading = false, portfolioLoading = false;
  let projects = [], portfolio = null, bundle = null, sourceProject = null, selectedProjectId = "", section = initialProjectId ? "dossier" : "portfolio", editor = null, conflict = false;
  let filters = {}, dossierType = "", snapshot = null, snapshotBusy = false;
  const drafts = new Map(), profileDrafts = new Map(), decisionDrafts = new Map(), dirtyKeys = new Set(), issuedSnapshots = [], downloadUrls = new Set();let reportingDraft = {};
  const token = () => ({context, projectSequence, projectId: selectedProjectId, api: currentApi});
  const active = captured => !disposed && captured.context === context && captured.api === currentApi;
  const activeProject = captured => active(captured) && captured.projectSequence === projectSequence && captured.projectId === selectedProjectId;
  const panel = () => root.querySelector("[data-oversight-panel]");
  const announce = (message, error = false) => {if (disposed) return;const node = root.querySelector("[data-oversight-status]");if (node) {node.textContent = message;node.setAttribute("role", error ? "alert" : "status");}};
  const draftKey = () => `${selectedProjectId}:${editor?.recordId || `new:${editor?.type || ""}`}`;
  const currentRecord = () => bundle?.records?.find(record => record.id === editor?.recordId);
  const definitionFields = type => recordFields(type);
  function evidenceLibraryLink() {
    if (typeof currentApi.projectHref !== "function") return "";
    try {const href = new URL(currentApi.projectHref(selectedProjectId),view.location.href);if (href.origin !== view.location.origin || href.username || href.password || !["http:","https:"].includes(href.protocol)) return "";return `<a class="ow-button" href="${h(href.pathname + href.search + href.hash)}" target="_blank" rel="noopener noreferrer">Open project evidence library</a>`;} catch {return "";}
  }
  function controls() {
    if (disposed) return;
    root.setAttribute("aria-busy", String(loading || busy || snapshotBusy));
    for (const node of root.querySelectorAll("[data-oversight-editor] fieldset,[data-oversight-profile] fieldset,[data-oversight-transition] fieldset")) node.disabled = busy;
    for (const node of root.querySelectorAll("[data-oversight-write],[data-oversight-project],[data-oversight-new],[data-oversight-edit],[data-oversight-reload]")) node.disabled = busy || loading;
    for (const node of root.querySelectorAll("[data-oversight-issue]")) node.disabled = snapshotBusy || busy || portfolioLoading || !portfolio;
    for (const node of root.querySelectorAll("[data-oversight-snapshot] fieldset")) node.disabled = snapshotBusy;
    for (const node of root.querySelectorAll("[data-oversight-export],[data-oversight-open-snapshot] button")) node.disabled = snapshotBusy;
  }
  function renderShell() {
    root.classList.add("oversight-workspace");
    root.innerHTML = `<header class="ow-heading"><div><p class="ow-eyebrow">Environmental and social oversight</p><h1>Oversight workspace</h1><p>Connect project evidence, technical judgment and management follow-up across the portfolio.</p></div><button type="button" data-oversight-refresh>Refresh portfolio</button></header><p class="ow-context">Ratings and technical opinions are attributed professional judgments. A saved draft, source reference or review approval does not automatically establish project compliance.</p><nav class="ow-tabs" role="tablist" aria-label="Oversight workspace">${tabs.map(([id,label]) => `<button type="button" role="tab" id="${instanceId}-tab-${id}" aria-controls="${instanceId}-panel-${id}" aria-selected="${section === id}" tabindex="${section === id ? 0 : -1}" data-oversight-tab="${id}">${label}</button>`).join("")}</nav><div data-oversight-status class="ow-status" role="status" aria-live="polite"></div><div data-oversight-context></div><section class="ow-panel" data-oversight-panel role="tabpanel" id="${instanceId}-panel-${section}" aria-labelledby="${instanceId}-tab-${section}"></section>`;
    renderContext();renderPanel();controls();
  }
  function renderContext() {
    const host = root.querySelector("[data-oversight-context]");if (!host) return;
    host.innerHTML = section === "portfolio" || section === "reporting" ? "" : `<label><span>Project account record</span><select data-oversight-project>${optionsMarkup(projects.map(project => ({value:projectId(project),label:projectName(project)})),selectedProjectId,"Choose a project")}</select><small>Evidence and oversight records stay within this authorized project and account context.</small></label>`;
    controls();
  }
  function readEditor() {
    const form = root.querySelector("[data-oversight-editor]");if (!form || !editor) return null;
    const values = {};
    for (const field of definitionFields(editor.type)) {
      const input = form.elements.namedItem(field.name);if (!input) continue;
      if (field.type === "boolean") values[field.name] = input.checked;
      else if (field.type === "multi" || input.multiple) values[field.name] = [...input.selectedOptions].map(option => option.value);
      else if (field.type === "number") {if (input.value !== "") values[field.name] = Number(input.value);}
      else if (field.type === "list") values[field.name] = input.value.split(",").map(value => value.trim()).filter(Boolean);
      else values[field.name] = input.value;
    }
    values.evidencePins = [...form.querySelectorAll("[data-oversight-pin]")].filter(node => node.querySelector("input[type=checkbox]").checked).map(node => {
      const pin = JSON.parse(node.dataset.oversightPin);
      return {...pin,locator:node.querySelector("[data-oversight-pin-locator]").value.trim()};
    });
    values.relatedIds = [...form.querySelectorAll('[name="relatedIds"]:checked')].map(input => input.value);
    return values;
  }
  function readFields(form, fields) {return Object.fromEntries(fields.map(field => {const input = form.elements.namedItem(field.name);return [field.name,field.type === "list" ? input.value.split(",").map(value => value.trim()).filter(Boolean) : input.value];}));}
  function editorBaseline() {const record = currentRecord();return {...Object.fromEntries(definitionFields(editor.type).map(field => [field.name,record?.values?.[field.name] ?? ""])),evidencePins:record?.values?.evidencePins || [],relatedIds:record?.values?.relatedIds || []};}
  function editorChanged(values = readEditor()) {return Boolean(values && comparable(values) !== comparable(editorBaseline()));}
  function hasUnsavedChanges() {
    if (disposed) return false;
    const profile = root.querySelector("[data-oversight-profile]"),transition = root.querySelector("[data-oversight-transition]"),report = root.querySelector("[data-oversight-snapshot]");
    return Boolean(dirtyKeys.size || editorChanged() || profile && comparable(readFields(profile,oversightProfileFields)) !== comparable(bundle.profile) || transition?.elements.note.value.trim() || report && ["title","periodStart","periodEnd","decisions"].some(name => report.elements[name].value.trim()));
  }
  function rememberEditor() {
    const mark = (key,changed) => changed ? dirtyKeys.add(key) : dirtyKeys.delete(key);
    const values = readEditor();if (values) {drafts.set(draftKey(),values);mark(draftKey(),editorChanged(values));}
    const profile = root.querySelector("[data-oversight-profile]");if (profile) {const values = readFields(profile,oversightProfileFields);profileDrafts.set(selectedProjectId,values);mark(`profile:${selectedProjectId}`,comparable(values) !== comparable(bundle.profile));}
    const transition = root.querySelector("[data-oversight-transition]");if (transition && editor?.recordId) {const key = `${selectedProjectId}:${editor.recordId}`;decisionDrafts.set(key,transition.elements.note.value);mark(`decision:${key}`,Boolean(transition.elements.note.value.trim()));}
    const report = root.querySelector("[data-oversight-snapshot]");if (report) {reportingDraft = Object.fromEntries(["title","kind","periodStart","periodEnd","decisions"].map(name => [name,report.elements[name].value]));mark("report",["title","periodStart","periodEnd","decisions"].some(name => reportingDraft[name]?.trim()));}
  }
  function renderPanel() {
    if (disposed || !panel()) return;
    const target = panel();target.id = `${instanceId}-panel-${section}`;target.setAttribute("aria-labelledby",`${instanceId}-tab-${section}`);
    for (const button of root.querySelectorAll("[data-oversight-tab]")) {const chosen = button.dataset.oversightTab === section;button.setAttribute("aria-selected",String(chosen));button.tabIndex = chosen ? 0 : -1;}
    if (section === "portfolio") target.innerHTML = portfolioMarkup();
    else if (section === "reporting") target.innerHTML = reportingMarkup();
    else if (loading) target.innerHTML = '<p class="ow-empty" role="status">Loading the selected project’s saved oversight records and evidence…</p>';
    else if (!bundle) target.innerHTML = '<div class="ow-empty"><h2>Select a project</h2><p>Choose an authorized project account record to review evidence or record oversight work.</p></div>';
    else target.innerHTML = dossierMarkup();
    controls();
  }
  function portfolioMarkup() {
    const rows = Array.isArray(portfolio?.projects) ? portfolio.projects : [];
    return `<header class="ow-section-heading"><div><h2>Portfolio oversight</h2><p>Find projects and plan the next review using recorded context and follow-up needs.</p></div></header>${portfolioFiltersMarkup()}<div data-oversight-portfolio-results>${portfolioResultsMarkup(rows)}</div>`;
  }
  function portfolioFiltersMarkup() {
    return `<form class="ow-filters" data-oversight-filters><label><span>Find projects</span><input type="search" name="q" value="${h(filters.q || "")}" placeholder="Project, country or theme"></label>${[["region","Region"],["sector","Sector"],["theme","Theme"],["institution","WBG window"]].map(([name,label]) => `<label><span>${label}</span><input name="${name}" value="${h(filters[name] || "")}" placeholder="All ${name === "institution" ? "windows" : label.toLowerCase() + "s"}" list="ow-filter-${name}"><datalist id="ow-filter-${name}">${(portfolio?.dimensions?.[name === "theme" ? "themes" : name] || []).map(value => `<option value="${h(value)}"></option>`).join("")}</datalist></label>`).join("")}<button type="submit" class="ow-primary">Apply filters</button><button type="button" data-oversight-clear-filters>Clear</button></form>`;
  }
  function portfolioResultsMarkup(rows) {
    const summary = portfolio?.summary || {};
    const metricLabels = {unrated:"Without an approved performance rating",pendingReviews:"Records awaiting review",overdueActions:"Overdue corrective follow-ups",openGrievances:"Open complaint cases",overdueResponses:"Overdue complaint responses"};
    return `<div class="ow-metrics">${countMetric(rows.length,"Project records shown")}${Object.entries(metricLabels).filter(([key]) => Number.isFinite(summary[key])).map(([key,label]) => countMetric(summary[key],label)).join("")}</div><p class="ow-small" data-oversight-result-count>${rows.length} authorized project records match the current filters. Missing oversight records are unassessed. As of ${h(portfolio?.asOf || "date not recorded")}.</p>${ratingGroupsMarkup()}<div class="ow-grid">${rows.map(row => {
      const project = row.project || row, profile = row.profile || row.oversight?.profile || {}, id = projectId(project);
      return `<article class="ow-card" data-oversight-project-card="${h(id)}"><p class="ow-eyebrow">${h(human(profile.institution || "Window not recorded"))}</p><h3>${h(projectName(project))}</h3><p>${h([profile.country,profile.region,profile.sector].filter(Boolean).join(" · ") || "Portfolio context not recorded")}</p><p class="ow-small">${h((profile.themes || []).join(" · "))}</p><p class="ow-small">${h(row.pendingReviews || 0)} awaiting review · ${h(row.overdueActions || 0)} overdue follow-ups · ${h(row.grievanceSummary?.open || 0)} open complaint cases</p><p>${row.unrated ? "<strong>No approved performance rating</strong><br>" : ""}${(row.latestRatings || []).map(rating => `${h(human(rating.dimension))}: ${h(rating.value)} (${h(rating.scaleName || human(rating.scaleId))}, ${h(rating.scaleVersion)})<br><span class="ow-small">Rating institution: <span data-oversight-rating-institution>${h(rating.institution || "Not recorded")}</span> · ${h(rating.scaleSource || "Scale source not recorded")}</span>`).join("<br>") || "No approved rating recorded"}</p>${profile.nextReviewDate ? `<p>Next review: <strong>${h(profile.nextReviewDate)}</strong></p>` : '<p class="ow-small">Next review date not recorded.</p>'}<button type="button" data-oversight-open="${h(id)}">Open project dossier</button></article>`;
    }).join("") || '<div class="ow-empty"><h3>No matching project records</h3><p>Clear the filters or add oversight context to an authorized project. No project rating has been inferred.</p></div>'}</div><details><summary>Portfolio scope and limits</summary><ul>${(portfolio?.limitations || []).map(value => `<li>${h(value)}</li>`).join("")}</ul></details>`;
  }
  function ratingGroupsMarkup() {
    const groups = portfolio?.ratingGroups || [];if (!groups.length) return "";
    return `<details><summary>Approved ratings by original scale</summary><p class="ow-small">Inherent risk and performance remain distinct. Institution, scale, source and edition remain separate; these groups do not imply equivalent risk levels.</p><div class="ow-table-region" role="region" tabindex="0" aria-label="Approved ratings by original scale"><table><thead><tr><th>Dimension / institution</th><th>Scale, edition and source</th><th>Original value</th><th>Project records</th></tr></thead><tbody>${groups.map(group => `<tr><td>${h(human(group.dimension))}<p>${h(group.institution || "Institution not recorded")}</p></td><td>${h(group.scaleName || human(group.scaleId))} · ${h(group.scaleVersion)}<p class="ow-small">${h(group.scaleSource || "Scale source not recorded")}</p></td><td>${h(group.value)}</td><td>${h(group.projects)}</td></tr>`).join("")}</tbody></table></div></details>`;
  }
  function dossierMarkup() {
    const types = section === "reviews" ? ["review"] : section === "program" ? ["program"] : ["opinion","rating","issue","visit","grievance"];
    const records = (bundle.records || []).filter(record => types.includes(record.type) && (!dossierType || !types.includes(dossierType) || record.type === dossierType));
    return `<header class="ow-section-heading"><div><p class="ow-eyebrow">${h(projectName(projects.find(project => projectId(project) === selectedProjectId)) || selectedProjectId)}</p><h2>${section === "reviews" ? "Management reviews" : section === "program" ? "Regional program" : "Project dossier"}</h2><p class="ow-small">Saved revision ${h(bundle.revision)} · ${h(bundle.accountId || "Scoped account")}</p></div><div class="ow-actions">${evidenceLibraryLink()}<button type="button" data-oversight-reload>Reload saved records; keep draft</button><button type="button" data-oversight-discard>Discard local project form drafts</button></div></header>${section === "dossier" ? profileMarkup() : ""}${section === "reviews" ? reviewQueueMarkup() : ""}<div class="ow-actions">${types.map(type => `<button type="button" data-oversight-new="${h(type)}">Add ${h(labelFor(type).toLowerCase())}</button>`).join("")}</div>${types.length > 1 ? `<label><span>Record type</span><select data-oversight-record-filter>${optionsMarkup(types.map(type => ({value:type,label:labelFor(type)})),dossierType,"All dossier records")}</select></label>` : ""}${editor && types.includes(editor.type) ? editorMarkup() : ""}<div class="ow-record-list" data-oversight-records>${records.map(record => recordMarkup(record)).join("") || '<div class="ow-empty">No saved records in this view. Add an attributed draft to start the review workflow.</div>'}</div>`;
  }
  function fieldMarkup(field, value, prefix = "") {
    const name = field.name, required = ["title","asOf"].includes(name), attributes = `name="${h(name)}"${required ? " required" : ""}`;
    let input;
    if (field.type === "textarea") input = `<textarea ${attributes} maxlength="8000" rows="4">${h(value || "")}</textarea>`;
    else if (field.type === "select") input = `<select ${attributes}>${optionsMarkup(field.options,value)}</select>`;
    else input = `<input ${attributes} type="${field.type === "date" ? "date" : "text"}"${field.type === "date" ? "" : ' maxlength="1000"'} value="${h(Array.isArray(value) ? value.join(", ") : value || "")}">`;
    return `<label class="${field.type === "textarea" || field.type === "list" ? "ow-wide" : ""}"><span>${h(field.label)}</span>${input}${name === "criteriaBasis" ? "<small>Record the applicable edition, phase and legal or policy provision. A current catalog alone does not prove project applicability.</small>" : ""}${name === "summary" && prefix === "grievance" ? "<small>Use a case code. Omit complainant names, identifying details and confidential allegations from this field.</small>" : ""}</label>`;
  }
  function profileMarkup() {
    const values = profileDrafts.get(selectedProjectId) || bundle.profile;
    return `<details class="ow-card"><summary>Portfolio context and oversight assignment</summary><form data-oversight-profile><fieldset><legend>Project oversight profile</legend><div class="ow-form-grid">${oversightProfileFields.map(field => fieldMarkup(field,values?.[field.name])).join("")}</div><div class="ow-actions"><button type="submit" class="ow-primary">Save portfolio context</button></div></fieldset></form></details>`;
  }
  function reviewQueueMarkup() {
    const queue = (bundle.records || []).filter(record => record.status === "in_review");
    return `<section class="ow-card"><h3>Awaiting review</h3><p>${queue.length} saved records are in review. Approve or return the exact saved revision after inspecting its basis and evidence.</p>${queue.map(record => `<button type="button" data-oversight-edit="${h(record.id)}">Review ${h(record.values?.title || labelFor(record.type))}</button>`).join(" ")}</section>`;
  }
  function evidenceChoices(values) {
    const retained = values.evidencePins || [], choices = (sourceProject?.resources || []).flatMap(resource => (resource.versions || []).flatMap(version => {
      const matching = retained.filter(pin => pin.resourceId === resource.id && pin.versionId === version.id && pin.sha256 === version.sha256);
      const choice = {resourceId:resource.id,versionId:version.id,sha256:version.sha256,label:version.metadata?.title || resource.title || version.filename || resource.id,filename:version.filename,availability:version.availability};
      return matching.length ? matching.map(existing => ({...choice,existing})) : [choice];
    }));
    for (const pin of retained) if (!choices.some(choice => !choice.missing && choice.resourceId === pin.resourceId && choice.versionId === pin.versionId && choice.sha256 === pin.sha256)) choices.push({...pin,availability:"unavailable",missing:true});
    return `<fieldset><legend>Evidence and source locators</legend><p class="ow-small">Select exact project source versions and record a page, section, sheet or feature locator. An approved opinion or rating requires at least one verified source reference.</p>${choices.length ? `<ul class="ow-pins">${choices.map(choice => {
      const existing = choice.existing || (choice.missing ? choice : null),pin = {resourceId:choice.resourceId,versionId:choice.versionId,sha256:choice.sha256,label:existing?.label ?? choice.label};
      return `<li class="ow-pin" data-oversight-pin="${h(JSON.stringify(pin))}"><label class="ow-pin-choice"><input type="checkbox"${existing ? " checked" : ""}><span>${h(choice.label)}${choice.filename && choice.filename !== choice.label ? ` · ${h(choice.filename)}` : ""}<small>Version ${h(choice.versionId)} · ${h(choice.availability || "Availability not recorded")}</small></span></label><code>SHA256 ${h(choice.sha256)}</code><label><span>Evidence locator</span><input data-oversight-pin-locator maxlength="2000" value="${h(existing?.locator || "")}" placeholder="PDF page 18; section 4.2; worksheet and cell; feature ID"></label><button type="button" data-oversight-add-locator>Add another locator for this version</button>${choice.missing ? '<p class="ow-evidence-limit">This retained reference is absent from the current project source list. Availability must be resolved before approval.</p>' : ""}</li>`;
    }).join("")}</ul>` : '<p class="ow-empty">No project source versions are available. Add evidence in the project document workspace before approving a technical opinion or rating.</p>'}</fieldset>`;
  }
  function editorMarkup() {
    const record = currentRecord(),values = drafts.get(draftKey()) || record?.values || {},definition = oversightRecordDefinitions[editor.type];
    const transitions = record ? {draft:["submit","supersede"],in_review:["approve","return","supersede"],approved:["return","supersede"],superseded:[]}[record.status] || [] : [];
    const transitionLabels = {submit:"Submit for review",approve:"Approve reviewed record",return:"Return to draft",supersede:"Mark superseded"};
    const related = (bundle.records || []).filter(item => item.id !== record?.id && (item.status !== "superseded" || (values.relatedIds || []).includes(item.id)));
    return `<section class="ow-card ow-editor" data-oversight-editor-host><header class="ow-record-heading"><div><p class="ow-eyebrow">${record ? `Saved revision ${h(record.revision)} · ${h(human(record.status))}` : "New draft"}</p><h3>${h(definition.label)}</h3><p class="ow-small">Saving edits creates a draft. Review decisions apply to the exact saved record, with actor and rationale retained.</p></div><button type="button" data-oversight-cancel-edit>Close editor; keep draft</button></header>${editor.type === "rating" ? `<aside class="ow-context">${oversightRatingScales.map(scale => `<p><strong>${h(scale.name)}</strong>: ${h(scale.description)}${scale.values ? ` Values: ${h(scale.values.join(", "))}. Edition ${h(scale.version)}.` : ""}</p>`).join("")}<button type="button" data-oversight-working-scale>Use working performance scale</button></aside>` : ""}${editor.type === "grievance" ? '<p class="ow-context">Complaint details remain in the selected project dossier. Portfolio summaries and issued snapshots use counts for direct complaint records. Identifying details entered into other records are not automatically removed. Record consent and reprisal concerns before preparing any separate response.</p>' : ""}<form data-oversight-editor><fieldset><legend>${h(record ? "Edit retained record as a draft" : "Record a professional draft")}</legend><div class="ow-form-grid">${definition.fields.map(field => fieldMarkup(field,values[field.name],editor.type)).join("")}</div>${evidenceChoices(values)}${related.length ? `<details><summary>Related oversight records</summary>${related.map(item => `<label class="ow-pin-choice"><input type="checkbox" name="relatedIds" value="${h(item.id)}"${(values.relatedIds || []).includes(item.id) ? " checked" : ""}><span>${h(item.values.title)} · ${h(labelFor(item.type))} · ${h(human(item.status))}</span></label>`).join("")}</details>` : ""}<div class="ow-actions"><button type="submit" class="ow-primary">Save draft</button></div></fieldset></form>${transitions.length ? `<form data-oversight-transition><fieldset><legend>Review the saved revision</legend><p class="ow-small">These actions use saved revision ${h(record.revision)}. Save any changes first. Approval records the configured practitioner authority; it does not establish institutional clearance or independent review.</p>${record.decision ? `<p class="ow-small">Last decision: ${h(record.decision.action)} · ${h(record.decision.actorId)} · ${h(record.decision.authority)} · ${record.decision.independentReview ? "different reviewer recorded" : "self-review or independence not established"}</p>` : ""}<label><span>Decision rationale</span><textarea name="note" rows="3" maxlength="8000" placeholder="Record the basis, scope, unresolved limitations and any hand-off.">${h(decisionDrafts.get(`${selectedProjectId}:${record.id}`) || "")}</textarea></label><div class="ow-actions">${transitions.map(op => `<button type="submit" name="op" value="${op}" data-oversight-write>${transitionLabels[op]}</button>`).join("")}</div></fieldset></form>` : ""}</section>`;
  }
  function recordMarkup(record, history = false) {
    const fields = definitionFields(record.type);
    return `<article class="ow-card ow-record-row" data-oversight-record="${h(record.id)}"><header class="ow-record-heading"><div><p class="ow-eyebrow">${h(labelFor(record.type))}${history ? " · retained history" : ""}</p><h3>${h(record.values?.title || record.values?.subject || labelFor(record.type))}</h3></div><span class="ow-badge ow-badge-${h(record.status)}">${h(human(record.status))}</span></header><p class="ow-record-meta">Record revision ${h(record.revision)} · Author ${h(typeof record.author === "object" ? record.author.name || record.author.id : record.author || "Not recorded")} · Updated ${h(record.updatedAt || "Not recorded")}${record.type === "rating" ? `<br>Rating institution: <span data-oversight-rating-institution>${h(record.institution || "Not recorded")}</span>` : ""}</p>${history ? "" : `<details class="ow-record-details"><summary>Record details and evidence<span class="ow-sr-only"> for ${h(record.values?.title || record.values?.subject || labelFor(record.type))}</span></summary>`}<dl class="ow-values">${fields.filter(field => record.values?.[field.name] !== undefined && record.values?.[field.name] !== "").map(field => `<dt>${h(field.label || human(field.name))}</dt><dd>${h(valuesText(record.values[field.name]))}</dd>`).join("")}</dl>${pinsMarkup(record.values?.evidencePins || [])}${record.decision ? `<p class="ow-small">Decision: ${h(record.decision.action)} · ${h(record.decision.actorId)} · ${h(record.decision.authority)} · ${record.decision.independentReview ? "Different content reviewer recorded" : "Self-review or independence not established"}</p><p>${h(record.decision.note)}</p>` : ""}${history ? "" : `</details><div class="ow-actions"><button type="button" data-oversight-edit="${h(record.id)}">${record.status === "draft" ? "Edit draft" : "Inspect and review"}</button><button type="button" data-oversight-history="${h(record.id)}">Version history</button></div><div data-oversight-history-host="${h(record.id)}"></div>`}</article>`;
  }
  function pinsMarkup(pins) {return pins.length ? `<details><summary>Evidence references (${pins.length})</summary><ul class="ow-pins">${pins.map(pin => `<li class="ow-pin"><strong>${h(pin.label || "Project source version")}</strong><p>${h(pin.locator || "Locator not recorded")}</p><p class="ow-small">Resource ${h(pin.resourceId)} · Version ${h(pin.versionId)}</p><code>SHA256 ${h(pin.sha256)}</code></li>`).join("")}</ul></details>` : '<p class="ow-small">No evidence version references are recorded.</p>';}
  function reportingMarkup() {
    return `<header><h2>Institutional reporting</h2><p>Prepare senior-management, regional-program or integrated-risk reporting from the filtered portfolio. Issuance freezes saved source revisions; institutional clearance and delivery remain separate.</p></header><p class="ow-context">Current scope: ${h(portfolio?.projects?.length || 0)} project records. Portfolio filters ${Object.keys(filters).length ? Object.entries(filters).map(([key,value]) => `${h(human(key))}: ${h(value)}`).join(" · ") : "are not restricted"}. Direct complaint-record narratives and evidence are excluded. Other authored text may contain identifying details; review it before distribution.</p><form data-oversight-snapshot><fieldset><legend>Issue a practitioner reporting snapshot</legend><div class="ow-form-grid"><label class="ow-wide"><span>Report title</span><input name="title" required maxlength="1000" value="${h(reportingDraft.title || "")}"></label><label><span>Report purpose</span><select name="kind" required>${optionsMarkup(["senior_management","regional_program","integrated_risk"],reportingDraft.kind || "integrated_risk")}</select></label><label><span>Period start</span><input type="date" name="periodStart" required value="${h(reportingDraft.periodStart || "")}"></label><label><span>Period end</span><input type="date" name="periodEnd" required value="${h(reportingDraft.periodEnd || "")}"></label><label class="ow-wide"><span>Decisions, recommendations and remaining exposure</span><textarea name="decisions" required maxlength="8000" rows="5">${h(reportingDraft.decisions || "")}</textarea></label></div><div class="ow-actions"><button type="submit" class="ow-primary" data-oversight-issue>Issue frozen snapshot</button></div></fieldset></form><section><h3>Reopen an issued snapshot</h3><form class="ow-filters" data-oversight-open-snapshot><label><span>Snapshot ID</span><input name="snapshotId" required maxlength="192" autocomplete="off"></label><button type="submit">Open saved snapshot</button></form>${issuedSnapshots.length ? `<ul>${issuedSnapshots.map(item => `<li><button type="button" data-oversight-snapshot-open="${h(item.id)}">${h(item.title)} · ${h(item.createdAt)}</button></li>`).join("")}</ul>` : ""}</section><div data-oversight-snapshot-view>${snapshotMarkup()}</div>`;
  }
  function snapshotMarkup() {
    if (!snapshot) return '<p class="ow-small">No issued snapshot is open. Issued snapshots can be reopened by their retained ID after reloading.</p>';
    return `<article class="ow-card"><p class="ow-eyebrow">${h(human(snapshot.kind))} · frozen practitioner snapshot</p><h3>${h(snapshot.title)}</h3><p>${h(snapshot.periodStart)} to ${h(snapshot.periodEnd)} · Issued ${h(snapshot.createdAt)} by ${h(snapshot.createdBy)}</p><p style="white-space:pre-wrap">${h(snapshot.decisions)}</p><p class="ow-small">${h(snapshot.clearance)}</p><p><code>Snapshot ${h(snapshot.id)}</code></p><p>${h(snapshot.portfolio?.projects?.length || 0)} scoped project records with retained source revisions.</p><details><summary>Frozen project and record revisions</summary><ul>${(snapshot.sourceRevisions || []).map(project => `<li>${h(project.projectId)} · Project oversight revision ${h(project.revision)} · ${h(project.records?.length || 0)} records</li>`).join("")}</ul></details>${typeof currentApi.exportSnapshot === "function" ? `<div class="ow-actions">${["html","xlsx","json"].map(format => `<button type="button" data-oversight-export="${format}">Download ${format.toUpperCase()}</button>`).join("")}</div>` : '<p class="ow-small">This adapter does not provide file exports.</p>'}</article>`;
  }
  async function refreshPortfolio({quiet = false} = {}) {
    const captured = token(), sequence = ++portfolioSequence;
    portfolioLoading = true;controls();
    if (!quiet) announce("Loading the authorized portfolio…");
    try {
      const result = await captured.api.portfolio({...filters});
      if (!active(captured) || sequence !== portfolioSequence) return;
      portfolio = result;
      if (section === "portfolio") {
        const results = root.querySelector("[data-oversight-portfolio-results]");if (results) results.innerHTML = portfolioResultsMarkup(result.projects || []);else renderPanel();
        for (const [key,values] of Object.entries(result.dimensions || {})) {const list = root.querySelector(`#ow-filter-${key === "themes" ? "theme" : key}`);if (list) list.innerHTML = values.map(value => `<option value="${h(value)}"></option>`).join("");}
      }
      if (!quiet) announce("Portfolio loaded from saved oversight records.");
    } catch (error) {if (active(captured) && sequence === portfolioSequence) {portfolio = null;announce(errorMessage(error),true);}}
    finally {if (active(captured) && sequence === portfolioSequence) {portfolioLoading = false;controls();}}
  }
  async function selectProject(id, {keepDraft = true} = {}) {
    if (busy || disposed) return;
    if (!projects.some(project => projectId(project) === id)) {announce("This project is unavailable in the current authorized scope.",true);return;}
    if (keepDraft) rememberEditor();
    selectedProjectId = id;projectSequence++;bundle = null;sourceProject = null;editor = null;conflict = false;loading = true;
    const captured = token();renderContext();renderPanel();announce("Loading project oversight and source versions…");
    try {
      const [saved,project] = await Promise.all([captured.api.get(id),captured.api.getProject(id)]);
      if (!activeProject(captured)) return;
      if (saved.projectId !== id || projectId(project?.project || project) !== id) throw new Error("The response does not match the selected project.");
      bundle = saved;sourceProject = project?.project || project;announce("Saved project records loaded.");
    } catch (error) {if (activeProject(captured)) announce(errorMessage(error),true);}
    finally {if (activeProject(captured)) {loading = false;renderPanel();controls();}}
  }
  async function reloadProject() {
    if (!bundle || busy) return;rememberEditor();const previous = editor,captured = token();busy = true;controls();
    try {const [saved,project] = await Promise.all([captured.api.get(selectedProjectId),captured.api.getProject(selectedProjectId)]);if (!activeProject(captured)) return;if (saved.projectId !== selectedProjectId || projectId(project?.project || project) !== selectedProjectId) throw new Error("The response does not match the selected project.");bundle = saved;sourceProject = project?.project || project;editor = previous;conflict = false;renderPanel();announce("Saved records reloaded. Your draft is retained; compare it with the current record before saving.");}
    catch (error) {if (activeProject(captured)) announce(errorMessage(error),true);}
    finally {if (activeProject(captured)) {busy = false;controls();}}
  }
  async function mutate(command, success, {clearDraft = false} = {}) {
    if (busy || !bundle) return;
    const captured = token(), key = draftKey();busy = true;controls();announce("Saving the exact oversight revision…");
    try {
      const saved = await captured.api.mutate(selectedProjectId,{expectedRevision:bundle.revision,command});
      if (!activeProject(captured)) return;
      if (saved.projectId !== selectedProjectId) throw new Error("The saved response does not match the selected project.");
      rememberEditor();bundle = saved;conflict = false;
      if (clearDraft) {drafts.delete(key);dirtyKeys.delete(key);editor = null;}
      if (command.op === "profile") {profileDrafts.delete(selectedProjectId);dirtyKeys.delete(`profile:${selectedProjectId}`);}
      if (["submit","approve","return","supersede"].includes(command.op)) {drafts.delete(key);dirtyKeys.delete(key);decisionDrafts.delete(`${selectedProjectId}:${command.recordId}`);dirtyKeys.delete(`decision:${selectedProjectId}:${command.recordId}`);}
      renderPanel();announce(success);void refreshPortfolio({quiet:true});
    } catch (error) {if (activeProject(captured)) {conflict = error?.status === 409;announce(`${errorMessage(error)}${conflict ? " Your draft is retained. Reload saved records before comparing and retrying." : " Your entries are still available."}`,true);}}
    finally {if (activeProject(captured)) {busy = false;controls();}}
  }
  async function loadHistory(id) {
    const captured = token(), host = [...root.querySelectorAll("[data-oversight-history-host]")].find(node => node.dataset.oversightHistoryHost === id);if (!host) return;host.innerHTML = '<p role="status">Loading immutable record history…</p>';
    try {const result = await captured.api.history(selectedProjectId,id);if (!activeProject(captured) || !host.isConnected) return;if (result.recordId !== id) throw new Error("The history response does not match this record.");host.innerHTML = `<div class="ow-history">${(result.versions || []).map(record => recordMarkup(record,true)).join("") || '<p>No retained history was returned.</p>'}</div>`;}
    catch (error) {if (activeProject(captured) && host.isConnected) {host.textContent = errorMessage(error);host.setAttribute("role","alert");}}
  }
  async function openSnapshot(id) {
    if (snapshotBusy || !id) return;const captured = token();snapshotBusy = true;controls();announce("Loading the retained reporting snapshot…");
    try {const saved = await captured.api.getSnapshot(id);if (!active(captured)) return;if (saved.id !== id || saved.schemaVersion !== 1) throw new Error("The returned snapshot does not match the requested retained version.");snapshot = saved;const host = root.querySelector("[data-oversight-snapshot-view]");if (host) host.innerHTML = snapshotMarkup();announce("Issued snapshot reopened from its retained source revisions.");}
    catch (error) {if (active(captured)) announce(errorMessage(error),true);}
    finally {if (active(captured)) {snapshotBusy = false;controls();}}
  }
  async function issueSnapshot(form) {
    if (snapshotBusy || portfolioLoading || !portfolio || busy) return;
    if (!form.checkValidity()) {form.reportValidity();return;}
    const input = Object.fromEntries(new view.FormData(form));
    if (input.periodStart > input.periodEnd) {announce("The reporting period cannot end before it starts.",true);return;}
    rememberEditor();const captured = token();snapshotBusy = true;controls();announce("Issuing a frozen snapshot of the saved portfolio revisions…");
    const expectedRevisions = Object.fromEntries(portfolio.projects.map(project => [project.projectId,project.revision]));
    try {
      const saved = await captured.api.issueSnapshot({...input,filters:{...portfolio.filters},asOf:portfolio.asOf,expectedRevisions});if (!active(captured)) return;
      if (!saved?.id || saved.schemaVersion !== 1) throw new Error("The service did not return a confirmed issued snapshot. Check retained history before issuing again.");
      snapshot = saved;if (!issuedSnapshots.some(item => item.id === saved.id)) issuedSnapshots.unshift(saved);reportingDraft = {};dirtyKeys.delete("report");if (section === "reporting") renderPanel();announce("Snapshot issued. Its scope and source revisions are frozen; institutional clearance is separate.");
    } catch (error) {if (active(captured)) announce(`${errorMessage(error)} Your reporting draft is retained.${error?.status === 409 ? " Refresh the portfolio and compare the current revisions before issuing again." : ""}`,true);}
    finally {if (active(captured)) {snapshotBusy = false;controls();}}
  }
  async function exportSnapshot(format) {
    if (snapshotBusy || !snapshot || typeof currentApi.exportSnapshot !== "function") return;
    const captured = token(), saved = snapshot;snapshotBusy = true;controls();announce(`Preparing the retained ${format.toUpperCase()} snapshot…`);
    try {
      const blob = await captured.api.exportSnapshot(saved.id,format);if (!active(captured)) return;
      if (!blob || typeof blob.size !== "number") throw new Error("The export service did not return a downloadable file.");
      const url = view.URL.createObjectURL(blob);downloadUrls.add(url);const link = root.ownerDocument.createElement("a");link.href = url;link.download = `${String(saved.title || "oversight-report").replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,80)}-${saved.id.replace(/[^a-zA-Z0-9_-]/g,"")}.${format}`;link.click();announce(`Retained ${format.toUpperCase()} snapshot downloaded.`);
    } catch (error) {if (active(captured)) announce(errorMessage(error),true);}
    finally {if (active(captured)) {snapshotBusy = false;controls();}}
  }
  function navigate(next) {
    if (!tabs.some(([id]) => id === next)) return;rememberEditor();section = next;renderContext();renderPanel();
  }
  function click(event) {
    const button = event.target.closest("button");if (!button || !root.contains(button) || button.disabled) return;
    if (button.dataset.oversightTab) navigate(button.dataset.oversightTab);
    else if (button.hasAttribute("data-oversight-refresh")) void refreshPortfolio();
    else if (button.hasAttribute("data-oversight-clear-filters")) {filters = {};renderPanel();void refreshPortfolio();}
    else if (button.dataset.oversightOpen) {navigate("dossier");void selectProject(button.dataset.oversightOpen);}
    else if (button.dataset.oversightNew) {rememberEditor();editor = {type:button.dataset.oversightNew};renderPanel();root.querySelector("[data-oversight-editor] :is(input,select,textarea)")?.focus();}
    else if (button.dataset.oversightEdit) {rememberEditor();const record = bundle?.records?.find(item => item.id === button.dataset.oversightEdit);if (record) {editor = {type:record.type,recordId:record.id};section = record.type === "review" ? "reviews" : record.type === "program" ? "program" : "dossier";renderContext();renderPanel();root.querySelector("[data-oversight-editor]")?.scrollIntoView?.({block:"nearest"});}}
    else if (button.hasAttribute("data-oversight-cancel-edit")) {rememberEditor();editor = null;renderPanel();}
    else if (button.hasAttribute("data-oversight-reload")) void reloadProject();
    else if (button.hasAttribute("data-oversight-discard")) {if (busy) return;for (const key of drafts.keys()) if (key.startsWith(`${selectedProjectId}:`)) drafts.delete(key);profileDrafts.delete(selectedProjectId);for (const key of decisionDrafts.keys()) if (key.startsWith(`${selectedProjectId}:`)) decisionDrafts.delete(key);for (const key of dirtyKeys) if (key.startsWith(`${selectedProjectId}:`) || key === `profile:${selectedProjectId}` || key.startsWith(`decision:${selectedProjectId}:`)) dirtyKeys.delete(key);editor = null;renderPanel();announce("Local project form drafts discarded. Saved records and their history are unchanged.");}
    else if (button.dataset.oversightHistory) void loadHistory(button.dataset.oversightHistory);
    else if (button.hasAttribute("data-oversight-add-locator")) {const existing = button.closest("[data-oversight-pin]");if (!existing || busy) return;const clone = existing.cloneNode(true);clone.querySelector("input[type=checkbox]").checked = true;clone.querySelector("[data-oversight-pin-locator]").value = "";existing.after(clone);clone.querySelector("[data-oversight-pin-locator]").focus();}
    else if (button.hasAttribute("data-oversight-working-scale")) {const form = root.querySelector("[data-oversight-editor]");if (!form || busy) return;form.elements.dimension.value = "performance";form.elements.scaleId.value = "practitioner_performance_v1";form.elements.scaleName.value = oversightRatingScales[0].name;form.elements.scaleVersion.value = "1";form.elements.scaleSource.value = "";announce(`Working performance scale selected. Record one of: ${oversightRatingScales[0].values.join(", ")}, with rationale and evidence.`);form.elements.value.focus();}
    else if (button.dataset.oversightSnapshotOpen) void openSnapshot(button.dataset.oversightSnapshotOpen);
    else if (button.dataset.oversightExport) void exportSnapshot(button.dataset.oversightExport);
  }
  function change(event) {
    if (event.target.matches("[data-oversight-project]")) void selectProject(event.target.value);
    else if (event.target.matches("[data-oversight-record-filter]")) {rememberEditor();dossierType = event.target.value;renderPanel();}
  }
  function input(event) {if (event.target.matches("[data-oversight-pin-locator]") && event.target.value.trim()) event.target.closest("[data-oversight-pin]").querySelector("input[type=checkbox]").checked = true;}
  function beforeUnload(event) {if (hasUnsavedChanges()) {event.preventDefault();event.returnValue = "";}}
  function submit(event) {
    const form = event.target;if (!root.contains(form)) return;
    if (form.matches("[data-oversight-filters]")) {event.preventDefault();filters = Object.fromEntries([...new view.FormData(form)].filter(([,value]) => String(value).trim()).map(([key,value]) => [key,String(value).trim()]));void refreshPortfolio();}
    else if (form.matches("[data-oversight-editor]")) {
      event.preventDefault();if (busy || !editor || !form.checkValidity()) {form.reportValidity();return;}rememberEditor();const values = readEditor();
      if (values.evidencePins.some(pin => !pin.locator)) {announce("Record a page, section, sheet or feature locator for each selected source version.",true);return;}
      const record = currentRecord();void mutate({op:"upsert",type:editor.type,...(record ? {recordId:record.id,recordRevision:record.revision} : {}),values},"Professional draft saved. Submit the exact saved revision when it is ready for review.",{clearDraft:true});
    } else if (form.matches("[data-oversight-profile]")) {
      event.preventDefault();if (busy) return;rememberEditor();void mutate({op:"profile",values:readFields(form,oversightProfileFields)},"Portfolio context saved in the selected project account.");
    } else if (form.matches("[data-oversight-transition]")) {
      event.preventDefault();if (busy) return;const record = currentRecord(),op = event.submitter?.value;if (!record || !["submit","approve","return","supersede"].includes(op)) return;
      if (editorChanged()) {announce("Save the edited draft before submitting or deciding on this saved revision.",true);return;}
      const note = form.elements.note.value.trim();if (op !== "submit" && !note) {announce("Record the decision rationale before completing this review action.",true);form.elements.note.focus();return;}
      rememberEditor();void mutate({op,recordId:record.id,recordRevision:record.revision,note},({submit:"Saved record submitted for review.",approve:"Saved revision approved under the configured practitioner review authority.",return:"Saved record returned to draft with the review rationale retained.",supersede:"Saved record marked superseded; its version history is retained."})[op]);
    } else if (form.matches("[data-oversight-snapshot]")) {event.preventDefault();void issueSnapshot(form);}
    else if (form.matches("[data-oversight-open-snapshot]")) {event.preventDefault();void openSnapshot(form.elements.snapshotId.value.trim());}
  }
  function keydown(event) {
    const button = event.target.closest("[data-oversight-tab]");if (!button || !["ArrowRight","ArrowLeft","Home","End"].includes(event.key)) return;
    const index = tabs.findIndex(([id]) => id === button.dataset.oversightTab), next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();navigate(tabs[next][0]);root.querySelector(`[data-oversight-tab="${tabs[next][0]}"]`)?.focus();
  }
  async function initialize(id) {
    const captured = token();loading = true;renderShell();announce("Loading authorized project records…");
    try {
      const result = await captured.api.projects();if (!active(captured)) return;projects = Array.isArray(result) ? result : result.projects || [];loading = false;renderContext();renderPanel();
      await refreshPortfolio({quiet:true});if (!active(captured)) return;
      let historyError = "";
      if (typeof captured.api.snapshots === "function") {try {const saved = await captured.api.snapshots();if (!active(captured)) return;issuedSnapshots.push(...(Array.isArray(saved) ? saved : saved.snapshots || []));} catch (error) {if (!active(captured)) return;historyError = `Reporting history could not be loaded: ${errorMessage(error)}`;}}
      if (id) await selectProject(id);else if (portfolio) announce("Portfolio ready. Select a project to start an oversight review.");if (historyError && active(captured)) announce(historyError,true);
    }
    catch (error) {if (active(captured)) {loading = false;renderPanel();announce(errorMessage(error),true);}}
  }
  root.addEventListener("click",click);root.addEventListener("change",change);root.addEventListener("input",input);root.addEventListener("submit",submit);root.addEventListener("keydown",keydown);view.addEventListener("beforeunload",beforeUnload);
  const mounted = {ready:initialize(initialProjectId),hasUnsavedChanges,dispose() {if (disposed) return;disposed = true;context++;projectSequence++;portfolioSequence++;drafts.clear();profileDrafts.clear();decisionDrafts.clear();dirtyKeys.clear();for (const url of downloadUrls) view.URL.revokeObjectURL(url);downloadUrls.clear();root.removeEventListener("click",click);root.removeEventListener("change",change);root.removeEventListener("input",input);root.removeEventListener("submit",submit);root.removeEventListener("keydown",keydown);view.removeEventListener("beforeunload",beforeUnload);},setContext({api:nextApi,initialProjectId:nextId,discardDrafts = false} = {}) {
    if (disposed) return Promise.resolve();
    if (hasUnsavedChanges() && !discardDrafts) return Promise.reject(new Error("Unsaved oversight drafts are open. Explicitly keep this context or discard the drafts before switching accounts."));
    if (nextApi && !validApi(nextApi)) return Promise.reject(new Error("The new oversight context needs a scoped API adapter."));
    context++;projectSequence++;portfolioSequence++;currentApi = nextApi || currentApi;projects = [];portfolio = null;bundle = null;sourceProject = null;selectedProjectId = "";editor = null;snapshot = null;busy = false;snapshotBusy = false;portfolioLoading = false;drafts.clear();profileDrafts.clear();decisionDrafts.clear();dirtyKeys.clear();reportingDraft = {};issuedSnapshots.length = 0;filters = {};dossierType = "";section = nextId ? "dossier" : "portfolio";for (const url of downloadUrls) view.URL.revokeObjectURL(url);downloadUrls.clear();mounted.ready = initialize(nextId);return mounted.ready;
  }};
  if (invalidation?.then) invalidation.then(() => mounted.dispose(),() => mounted.dispose());
  return mounted;
}
