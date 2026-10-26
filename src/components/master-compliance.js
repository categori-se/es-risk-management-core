import {openFileViewer} from "./file-viewer.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const label = value => String(value || "").replaceAll("_", " ");
const safeUrl = value => {try {const url = new URL(value);return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;} catch {return null;}};
const option = (value, title, selected) => `<option value="${h(value)}"${value === selected ? " selected" : ""}>${h(title)}</option>`;

/** A client-account view over its pinned scope pack and append-only assessments. */
export function mountMasterCompliance(root) {
  const query = new URL(root.ownerDocument.defaultView.location.href).searchParams, account = query.get("account"), project = query.get("project");
  if (!account || !project) {root.textContent = "Open a client master from its account review. Both account and project are required.";return {ready: Promise.resolve(), dispose() {}};}
  const controller = new AbortController(), path = `/api/projects/${encodeURIComponent(project)}/master`;
  let disposed = false, busy = false, model, selected = "", institution = "", phase = "", search = "", mode = "rows", draft = {}, message = "", viewer;
  const drafts = new Map();
  root.classList.add("local-workspace");
  async function request(url, {method = "GET", body, binary = false} = {}) {
    const response = await fetch(url, {method, credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal,
      headers: {"X-ESIA-Workspace": "local", "X-ESIA-Account": account, ...(body ? {"Content-Type": "application/json"} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
    if (!response.ok) {const result = await response.json();throw new Error(result.error || "The client master is unavailable.");}
    return binary ? response.blob() : response.json();
  }
  function download(blob, filename) {if (disposed) return;const url = URL.createObjectURL(blob), link = root.ownerDocument.createElement("a");link.href = url;link.download = filename;link.click();setTimeout(() => URL.revokeObjectURL(url), 30000);}
  const visibleRows = () => model.rows.filter(row => (!institution || row.institutionId === institution) && (!phase || row.phaseId === phase) && [row.title, row.standardId, row.frameworkId, row.edition, row.actor, row.rationale].join(" ").toLowerCase().includes(search.toLowerCase()));
  function rowsMarkup() {
    const rows = visibleRows();
    if (mode === "groups") {
      const groups = new Map();
      for (const row of rows) {const key = JSON.stringify([row.institutionId, row.frameworkId, row.edition, row.standardId]);if (!groups.has(key)) groups.set(key, []);groups.get(key).push(row);}
      return [...groups.values()].map(items => `<article class="lw-record"><h3>${h(label(items[0].institutionId))} · ${h(items[0].standardId)} · ${h(items[0].title)}</h3><p>${h(items[0].edition)}</p><p>${items.length} separate phase/component rows; ${items.filter(row => !row.review).length} pending human review.</p>${items.map(row => `<p><button type="button" data-master-row="${h(row.id)}">${h(row.phaseName || row.phaseId)} · ${h(row.component)}</button> ${h(label(row.complianceStatus))}</p>`).join("")}</article>`).join("") || "<p>No matching scope rows.</p>";
    }
    return `<div class="lw-table-scroll"><table class="lw-table"><thead><tr><th>Institution / standard</th><th>Edition / phase</th><th>Source applicability</th><th>Client review</th></tr></thead><tbody>${rows.map(row => `<tr><td><button type="button" data-master-row="${h(row.id)}">${h(label(row.institutionId))} · ${h(row.standardId)}</button><p>${h(row.title)}</p></td><td>${h(row.edition)}<p>${h(row.phaseName || row.phaseId)} · ${h(row.component)}</p></td><td>${h(label(row.applicability))}</td><td>${h(label(row.complianceStatus))}${row.review ? `<p>${h(row.review.reviewer)}</p>` : ""}</td></tr>`).join("")}</tbody></table></div>${rows.length ? "" : "<p>No matching scope rows.</p>"}`;
  }
  function reviewMarkup() {
    const row = model.rows.find(item => item.id === selected);if (!row) return "<p>Select a scope row to inspect its definition, source pages and review record.</p>";
    const sources = row.sourceIds.map(id => model.register.sources.find(source => source.id === id));
    const candidates = model.evidenceIndex.flatMap(resource => resource.versions.map(version => ({resource, version})));
    const get = (name, fallback = "") => draft[name] ?? fallback;
    return `<h2>${h(row.standardId)} · ${h(row.title)}</h2><p>${h(label(row.institutionId))} · ${h(row.edition)}</p><p><strong>Phase:</strong> ${h(row.phaseName || row.phaseId)} · ${h(row.component)}. <strong>Responsible actor:</strong> ${h(row.actor)}</p><p><strong>Source applicability:</strong> ${h(label(row.applicability))}. ${h(row.rationale)}</p><p><strong>Contract basis:</strong> ${h(label(row.contractProof))}</p><h3>Evidence and clarification needed</h3><ul>${row.evidenceRequired.map(item => `<li>${h(item)}</li>`).join("")}</ul><h3>Pinned scope sources</h3><ul>${sources.map(source => `<li>${h(source.title)} <button type="button" data-master-source="${h(source.archiveVersionId)}">Open captured source</button><p>${row.locators.filter(item => item.sourceId === source.id).map(item => h([item.pdfPage ? `PDF p${item.pdfPage}` : "", item.printedPage ? `printed p${item.printedPage}` : "", item.section].filter(Boolean).join("; "))).join(" | ")}</p><code>${h(source.sha256)}</code></li>`).join("")}</ul>
      ${row.review ? `<details><summary>Latest saved review · ${h(row.review.reviewer)} · ${h(row.review.reviewedAt)}</summary><p>${h(label(row.review.conclusion))}: ${h(row.review.rationale)}</p><p>Applicability: ${h(row.review.applicability.rationale)}</p><p>${h(row.review.missingEvidence)}</p><p>${h(row.review.uncertainty)}</p><ul>${(row.review.auditContext?.sources || []).map(source => `<li>${h(source.title)} · ${h(source.locator)} · <code>${h(source.sha256)}</code></li>`).join("")}</ul></details>` : ""}
      <form data-master-review class="lw-form lw-grid"><h3 class="lw-wide">Record a human review</h3><p class="lw-wide">A saved review is an attributed conclusion for this exact row. Source applicability and possession of a report do not establish compliance. Earlier reviews remain in the account record.</p>
      <label><span>Reviewer</span><input name="reviewer" required maxlength="1000" value="${h(get("reviewer"))}"></label>
      <label><span>Review applicability</span><select name="decision">${[["uncertain", "Uncertain"], ["applies", "Applies"], ["does_not_apply", "Does not apply"]].map(([id, title]) => option(id, title, get("decision", "uncertain"))).join("")}</select></label>
      <label class="lw-wide"><span>Applicability rationale</span><textarea name="applicabilityRationale" required>${h(get("applicabilityRationale"))}</textarea></label>
      <label><span>Reviewed scope / responsible actor</span><input name="scope" required value="${h(get("scope", `${row.component}; ${row.actor}`))}"></label><label><span>Review period</span><input name="period" required value="${h(get("period", row.phaseName || row.phaseId))}"></label>
      <label><span>Conclusion</span><select name="conclusion">${[["insufficient_evidence", "Insufficient evidence"], ["gap", "Gap"], ["conforms", "Conforms"], ["not_applicable", "Not applicable"]].map(([id, title]) => option(id, title, get("conclusion", "insufficient_evidence"))).join("")}</select></label>
      <label class="lw-wide"><span>Assessment rationale</span><textarea name="rationale" required>${h(get("rationale"))}</textarea></label>
      <label class="lw-wide"><span>Supporting public archive version (optional)</span><select name="supportVersion"><option value="">No supporting version selected</option>${candidates.map(({resource, version}) => option(version.id, `${resource.title} · ${version.sha256.slice(0, 12)}`, get("supportVersion"))).join("")}</select></label><label class="lw-wide"><span>Reviewed page / section in the supporting version</span><input name="supportLocator" maxlength="1000" value="${h(get("supportLocator"))}"></label>
      <label class="lw-wide"><span>Missing evidence / follow-up</span><textarea name="missingEvidence">${h(get("missingEvidence"))}</textarea></label><label class="lw-wide"><span>Uncertainty and limitations</span><textarea name="uncertainty">${h(get("uncertainty"))}</textarea></label><label><span>Risk significance</span><input name="riskSignificance" value="${h(get("riskSignificance"))}"></label><button type="submit">Save review in client account</button></form>`;
  }
  function render() {
    if (disposed) return;
    const summary = model.summary, href = `/?account=${encodeURIComponent(account)}&project=${encodeURIComponent(project)}`;
    root.innerHTML = `<header class="lw-header"><div><p class="lw-eyebrow">Client master compliance</p><h1>${h(model.project.name)}</h1><p>${h(model.project.accountName)} · ${h(model.project.client)} · revision ${h(model.project.revision)}</p></div><nav><a href="${href}">Open account review</a> · <a href="/files?account=${h(encodeURIComponent(account))}">Files</a></nav></header>
      <p class="lw-mode">${h(model.register.coverage)} Source statements of applicability are separate from human compliance conclusions. This public-source starter does not establish a client mandate or a complete contractual obligation register.</p><section class="lw-panel"><h2>Review progress</h2><p>${summary.reviewed} of ${summary.total} scope rows reviewed; ${summary.pending} pending. ${summary.gap} gaps, ${summary.conforms} conforms, ${summary.insufficient_evidence} insufficient evidence, ${summary.not_applicable} reviewed not applicable.</p><p data-master-message role="status">${h(message)}</p><div class="lw-actions"><button type="button" data-master-export="xlsx">Export styled Excel</button><button type="button" data-master-export="html">Export web report</button><button type="button" data-master-export="json">Export structured JSON</button></div><p class="lw-small">Exports retain the current project revision, source pins, phase/edition boundaries and unreviewed rows. Public archive originals need a separate collection backup.</p></section>
      <section class="lw-panel"><h2>Requirements and applicability</h2><div class="lw-grid"><label><span>Institution</span><select data-master-filter="institution"><option value="">All institutions</option>${[...new Set(model.rows.map(row => row.institutionId))].sort().map(id => option(id, label(id), institution)).join("")}</select></label><label><span>Phase</span><select data-master-filter="phase"><option value="">All phases</option>${model.register.phases.map(item => option(item.id, item.name, phase)).join("")}</select></label><label><span>Search scope</span><input type="search" data-master-filter="search" value="${h(search)}"></label><label><span>Display</span><select data-master-filter="mode">${option("rows", "Individual scope rows", mode)}${option("groups", "Group by institution and standard", mode)}</select></label></div><div data-master-rows>${rowsMarkup()}</div></section><section class="lw-panel" data-master-detail>${reviewMarkup()}</section>
      <section class="lw-panel"><details><summary>Shared public evidence index · ${model.evidenceIndex.length} source locations</summary><p>Candidate material is indexed from all captured institutions. It becomes cited support only when a practitioner selects an exact retained version and records a locator.</p><ul>${model.evidenceIndex.map(resource => `<li>${h(resource.title)} · ${h(resource.institutionIds.join(", "))}${resource.versions.length ? resource.versions.map(version => ` <button type="button" data-master-source="${h(version.id)}">Open retained version · ${h(version.sha256.slice(0, 12))}</button>`).join("") : " · Original not retained"}${safeUrl(resource.url) ? ` <a href="${h(safeUrl(resource.url))}" target="_blank" rel="noopener noreferrer">Source location</a>` : ""}</li>`).join("")}</ul></details><details><summary>Scope and preservation limitations</summary><ul>${model.register.limitations.map(note => `<li>${h(typeof note === "string" ? note : JSON.stringify(note))}</li>`).join("")}</ul></details><p>Master pack SHA256: <code>${h(model.packSha256)}</code></p></section>`;
    for (const control of root.querySelectorAll("button,input,select,textarea")) control.disabled = busy;
  }
  function remember() {const form = root.querySelector("[data-master-review]");if (form) {draft = Object.fromEntries(new root.ownerDocument.defaultView.FormData(form));drafts.set(selected, {...draft});}}
  const onInput = event => {if (event.target.closest("[data-master-review]")) remember();const key = event.target.dataset.masterFilter;if (!key) return;if (key === "institution") institution = event.target.value;if (key === "phase") phase = event.target.value;if (key === "search") search = event.target.value;if (key === "mode") mode = event.target.value;root.querySelector("[data-master-rows]").innerHTML = rowsMarkup();};
  const onClick = async event => {
    const button = event.target.closest("[data-master-row],[data-master-export],[data-master-source]");if (!button || busy) return;
    if (button.dataset.masterRow) {remember();selected = button.dataset.masterRow;draft = {...(drafts.get(selected) || {})};root.querySelector("[data-master-detail]").innerHTML = reviewMarkup();root.querySelector("[data-master-detail]").scrollIntoView?.({behavior: "smooth", block: "start"});return;}
    if (button.dataset.masterSource) {
      const resource = model.evidenceIndex.find(item => item.versions.some(version => version.id === button.dataset.masterSource)), version = resource?.versions.find(item => item.id === button.dataset.masterSource);if (!version) return;
      viewer?.close();const versionPath = `/api/research-archives/${encodeURIComponent(model.archiveCollection || "bujagali")}/versions/${encodeURIComponent(version.id)}`;
      viewer = openFileViewer({document: root.ownerDocument, title: resource.title, version, loadPreview: page => request(`${versionPath}/preview?page=${page}`), download: async () => download(await request(`${versionPath}/download`, {binary: true}), version.filename || "original")});return;
    }
    remember();busy = true;render();
    try {const format = button.dataset.masterExport;download(await request(`${path}/export?format=${encodeURIComponent(format)}`, {binary: true}), `${String(model.register.projectIdentity).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100)}-client-master.${format}`);message = "Export downloaded for the current saved revision.";}
    catch (error) {message = error.message;} finally {busy = false;render();}
  };
  const onSubmit = async event => {
    if (!event.target.matches("[data-master-review]")) return;event.preventDefault();if (busy) return;remember();
    const rowId = selected, values = {...draft};busy = true;render();
    try {
      const body = {expectedRevision: model.project.revision, rowId, reviewer: values.reviewer,
        applicability: {decision: values.decision, rationale: values.applicabilityRationale, scope: values.scope, period: values.period}, conclusion: values.conclusion, rationale: values.rationale,
        missingEvidence: values.missingEvidence, uncertainty: values.uncertainty, riskSignificance: values.riskSignificance,
        supportingSources: values.supportVersion ? [{versionId: values.supportVersion, locator: values.supportLocator}] : []};
      const result = await request(`${path}/reviews`, {method: "POST", body});if (disposed) return;model = result;drafts.delete(rowId);draft = {};message = "Human review saved in this client account. Earlier conclusions remain in its assessment history.";
    } catch (error) {message = error.message;} finally {busy = false;render();}
  };
  root.addEventListener("click", onClick);root.addEventListener("input", onInput);root.addEventListener("change", onInput);root.addEventListener("submit", onSubmit);root.innerHTML = '<p role="status">Opening the client master…</p>';
  const ready = request(path).then(result => {if (!disposed) {model = result;render();}}).catch(error => {if (!disposed) root.textContent = error.message;});
  return {ready, dispose() {disposed = true;viewer?.close();controller.abort();root.removeEventListener("click", onClick);root.removeEventListener("input", onInput);root.removeEventListener("change", onInput);root.removeEventListener("submit", onSubmit);}};
}
