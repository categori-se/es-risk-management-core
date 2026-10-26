import {frameworks, frameworkTopics, getFramework, getAuditChecks, auditCheckSets, getFrameworkCoverage, getRequirementManifest, registerDetailedRequirementPack, frameworkRegistryVersion, frameworkSourceCheckDate, comparisonCsv} from "../lib/framework-register.js";
import {professionalWorkflows} from "../lib/professional-workflows.js";
import {sectorProfiles, getSectorProfile} from "../lib/sector-risk-profiles.js";
import {engagementReportTemplates, reportTemplateRequirementMatches} from "../lib/engagement-report-templates.js";
import {mountPolicyCoverageWorkbench} from "./policy-coverage-workbench.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const topicName = id => frameworkTopics.find(topic => topic.id === id)?.label || id;
const labels = {implemented: "Implemented", partial: "Partial", planned: "Planned"};
const option = (value, label, selected) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
const select = (label, key, content) => `<label><span>${escapeHtml(label)}</span><select data-filter="${key}">${content}</select></label>`;
const topicOptions = selected => option("all", "All topics", selected) + frameworkTopics.map(topic => option(topic.id, topic.label, selected)).join("");
const list = values => `<ul>${values.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`;
const views = {compare: {title: "Compare framework editions", subtitle: "Read the differences, keep the governing requirements distinct, and follow the primary sources."}, audits: {title: "Requirements and audit accounting", subtitle: "Inspect exact source statements or conceptual diagnostics, then carry a reviewed definition into your local work."}, workflows: {title: "Your professional workflows", subtitle: "Follow an engagement from client intake and research to reviewed findings, reporting and handover."}, sectors: {title: "Sector risk profiles", subtitle: "Screen the issues, evidence and specialist questions that deserve attention for a project's activities."}};

function safeUrl(value) {
  try {const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;} catch {return null;}
}

function sourceLinks(framework, ids = [], {fallback = false, direct = []} = {}) {
  const available = [...new Map([...(framework.sources || []), ...direct].map(source => [source.id, source])).values()];
  const sources = available.filter(source => ids.includes(source.id));
  const selected = sources.length ? sources : direct.length ? direct : fallback ? available : [];
  return selected.length ? `<ul class="fw-sources" aria-label="Primary sources">${selected.map(source => {
    const url = safeUrl(source.url);
    return `<li>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}<span class="fw-sr-only"> (opens source in a new tab)</span></a>` : escapeHtml(source.title)}</li>`;
  }).join("")}</ul>` : '<p class="fw-muted fw-small">Source mapping is incomplete; verify the instrument.</p>';
}

function editionOptions(selected, {empty = false} = {}) {
  const institutions = [...new Set(frameworks.map(framework => framework.institution))];
  return (empty ? option("", "Choose an edition (optional)", selected) : "") + institutions.map(institution => `<optgroup label="${escapeHtml(institution)}">${frameworks.filter(framework => framework.institution === institution).map(framework => option(framework.id, `${framework.institution} — ${framework.edition} · ${framework.name}`, selected)).join("")}</optgroup>`).join("");
}

export function renderFrameworkWorkspace(view = "compare", {invalidation} = {}) {
  const root = document.createElement("div");
  mountFrameworkWorkspace(root, {view, invalidation});
  return root;
}

export function mountFrameworkWorkspace(root, {view = "compare", local = false, invalidation} = {}) {
  if (!views[view]) view = "compare";
  root.classList.add("framework-workspace");
  const defaults = ["wb_esf_2016", "ifc_ps_2012", "adb_esf_2024"];
  const query = new URLSearchParams(globalThis.location?.search || "");
  const accountInput = query.get("account") || "";
  const hasAccount = /^(?:local-default|[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/.test(accountInput);
  const accountId = hasAccount ? accountInput : "local-default";
  function accountHref(href) {
    if (!local && !hasAccount) return href;
    const url = new URL(href, "http://127.0.0.1:4173");
    url.searchParams.set("account", accountId);
    return /^https?:\/\//.test(href) ? url.href : `${url.pathname}${url.search}${url.hash}`;
  }
  const initialFramework = getFramework(query.get("framework"))?.id || defaults.find(id => getFramework(id)) || frameworks[0]?.id;
  const initialPack = query.get("checkSet") || (getRequirementManifest(initialFramework) ? "detailed" : "curated");
  const state = {view, selected: defaults.map(id => getFramework(id) ? id : ""), topic: "all", framework: initialFramework,
    checkSet: initialPack, accounting: initialPack === "detailed" ? "detailed" : "diagnostic", standard: "all", search: "", page: 0, phase: "all", support: "all", workflowSearch: "",
    sector: getSectorProfile(query.get("sector"))?.id || (view === "sectors" ? sectorProfiles[0]?.id || "" : ""), priority: "all", corpus: new Map(), pending: new Map(), openChecks: new Set()};
  const libraryController = new AbortController();
  let disposed = false;
  let policyWorkbench,policyWorkbenchNode,policyWorkbenchFramework;
  if (!["detailed", "diagnostic"].includes(state.checkSet) && !auditCheckSets(state.framework).some(pack => pack.id === state.checkSet)) state.checkSet = "curated";
  const localOrigin = local ? "" : "http://127.0.0.1:4173";

  function useCheckHref(framework, check, pack) {
    const parameters = new URLSearchParams({framework, check: check.id, checkSet: pack});
    if (state.sector) parameters.set("sector", state.sector);
    return accountHref(`${localOrigin}/?${parameters}#lw-review`);
  }

  function announce(text) {
    const node = root.querySelector("[data-feedback]");
    if (node) node.textContent = text;
  }

  function render() {
    const current = views[state.view];
    root.innerHTML = `<header class="fw-header"><p class="fw-eyebrow">E&S professional workspace</p><h1>${current.title}</h1><p>${current.subtitle}</p><nav class="fw-nav" aria-label="Professional workspace">${[["/practice", "Practice workflows", "workflows"], ["/audits", "Requirements and audits", "audits"], ["/frameworks", "Compare frameworks", "compare"], ["/sectors", "Sector risk profiles", "sectors"]].map(([href, title, name]) => `<a href="${escapeHtml(accountHref(href))}"${state.view === name ? ' aria-current="page"' : ""}>${title}</a>`).join("")}<a href="${escapeHtml(accountHref(local ? "/" : "/local-workspace"))}">Local project records</a><a href="${escapeHtml(accountHref("/library"))}">Resource library</a><a href="${escapeHtml(accountHref("/templates"))}">Template Studio</a><a href="${escapeHtml(accountHref(`${localOrigin}/engagements?tab=matrix`))}">Gap analysis</a><a href="${escapeHtml(accountHref(`${localOrigin}/engagements?tab=monitoring`))}">Monitoring</a><a href="${escapeHtml(accountHref("/files"))}">Files</a><a href="${escapeHtml(accountHref("/publications"))}">Publication studio</a></nav></header>
      <p class="fw-feedback fw-sr-only" data-feedback role="status" aria-live="polite"></p>
      ${state.view === "compare" ? renderCompare() : state.view === "audits" ? renderAudits() : state.view === "sectors" ? renderSectors() : renderWorkflows()}`;
    update();
  }

  function sourceNoteText() {
    const selected = (state.view === "compare" ? state.selected : [state.framework]).map(getFramework).filter(Boolean);
    const dates = selected.map(framework => `${framework.institution} · ${framework.edition}: ${framework.sourceCheckedAt || frameworkSourceCheckDate}`).join("; ");
    return `Primary-source research checks${dates ? ` — ${dates}` : " not selected"} · register ${frameworkRegistryVersion}. Open a source to check its current text and confirm the project’s governing edition.`;
  }
  function sourceNote() {
    return `<p class="fw-source-note" data-source-note>${escapeHtml(sourceNoteText())}</p>`;
  }
  function updateSourceNote() {
    const node = root.querySelector("[data-source-note]");
    if (node) node.textContent = sourceNoteText();
  }

  function renderCompare() {
    return `<section class="fw-panel"><h2>Select up to three editions</h2><div class="fw-edition-selectors">${state.selected.map((id, index) => select(`Edition ${index + 1}`, `edition-${index}`, editionOptions(id, {empty: true}))).join("")}</div><div class="fw-toolbar">${select("Comparison topic", "topic", topicOptions(state.topic))}<button type="button" data-action="export-comparison">Download comparison CSV</button></div><p class="fw-note">This is a sourced summary of selected differences. Similar topics do not establish equivalent requirements. Applicability, evidence and professional conclusions stay specific to each instrument and project.</p>${sourceNote()}</section><div data-comparison-summary></div><section class="fw-panel"><div class="fw-section-heading"><h2>Topic comparison</h2><p class="fw-muted fw-small" data-count></p></div><p class="fw-small fw-muted" id="fw-table-help">On narrow screens, focus the matrix and scroll horizontally to compare columns.</p><div class="fw-table-scroll" role="region" aria-label="Framework edition comparison" aria-describedby="fw-table-help" tabindex="0" data-comparison></div></section>`;
  }

  function updateCompare() {
    updateSourceNote();
    const selected = state.selected.map(getFramework).filter(Boolean);
    for (let index = 0; index < state.selected.length; index++) {
      const control = root.querySelector(`[data-filter="edition-${index}"]`);
      control.value = state.selected[index];
      for (const item of control.options) item.disabled = Boolean(item.value && state.selected.some((value, position) => position !== index && value === item.value));
    }
    root.querySelector('[data-action="export-comparison"]').disabled = selected.length === 0;
    root.querySelector("[data-comparison-summary]").innerHTML = `<div class="fw-summary-grid">${selected.map(framework => `<article class="fw-panel"><p class="fw-eyebrow">${escapeHtml(framework.institution)}</p><h2>${escapeHtml(framework.edition)}</h2><p>${escapeHtml(framework.name)}</p><p class="fw-small">${escapeHtml(framework.applicability)}</p><span class="fw-badge">${escapeHtml(framework.status || "Edition record")}</span></article>`).join("")}</div>`;
    const topics = frameworkTopics.filter(topic => state.topic === "all" || topic.id === state.topic);
    root.querySelector("[data-count]").textContent = `${topics.length} topic${topics.length === 1 ? "" : "s"} · ${selected.length} edition${selected.length === 1 ? "" : "s"}`;
    root.querySelector("[data-comparison]").innerHTML = selected.length ? `<table class="fw-comparison-table"><caption class="fw-sr-only">Topic summaries with their mapped primary sources and practical review implications</caption><thead><tr><th scope="col">Review topic</th>${selected.map(framework => `<th scope="col">${escapeHtml(framework.institution)}<span>${escapeHtml(framework.edition)}</span></th>`).join("")}<th scope="col">What this means for your work</th></tr></thead><tbody>${topics.map(topic => `<tr><th scope="row">${escapeHtml(topic.label)}</th>${selected.map(framework => {
      const cell = framework.comparison?.[topic.id];
      return `<td><p>${escapeHtml(cell?.summary || "Not yet mapped. Verify this topic against the source instrument.")}</p>${sourceLinks(framework, cell?.sourceIds || [])}</td>`;
    }).join("")}<td class="fw-implication">${escapeHtml(topic.implication)}</td></tr>`).join("")}</tbody></table>` : '<p class="fw-empty">Choose an edition to begin the comparison.</p>';
  }

  const sectorOptions = () => option("", "No sector profile selected", state.sector) + sectorProfiles.map(profile => option(profile.id, profile.name, state.sector)).join("");

  function renderSectorProfile(profile, {compact = false} = {}) {
    if (!profile) return '<p class="fw-small fw-muted">A sector profile suggests where to look more closely. Selecting one keeps every source statement and check in the register.</p>';
    const issues = profile.issues || [];
    const content = `<p>${escapeHtml(profile.description)}</p>${profile.subsectors?.length ? `<p class="fw-small"><strong>Activities considered:</strong> ${profile.subsectors.map(escapeHtml).join("; ")}</p>` : ""}<p class="fw-note">These are practitioner screening recommendations, not a formal risk category, a prediction of project impacts or an applicability decision. Site, design, supply chain and affected people can change the priorities. Unmentioned issues still need review.</p><div class="fw-sector-issues">${issues.map(issue => `<article class="fw-sector-issue"><details><summary><span>${escapeHtml(issue.label)}</span><span class="fw-badge">${issue.scrutiny === "heightened" ? "Heightened scrutiny suggested" : "Depends on project context"}</span></summary><p><strong>Why look closely:</strong> ${escapeHtml(issue.reason)}</p><h4>Screening questions</h4>${list(issue.screeningQuestions || [])}<h4>Evidence to seek</h4>${list(issue.evidence || [])}<h4>Explicit standard references</h4><ul class="fw-sector-standards">${Object.entries(issue.standardRefs || {}).map(([id, refs]) => {
      const framework = getFramework(id);
      if (!refs.length) return "";
      const parameters = new URLSearchParams({framework: id, sector: profile.id});
      return `<li><a href="${escapeHtml(accountHref(`/audits?${parameters}`))}">${escapeHtml(framework ? `${framework.institution} — ${framework.edition}` : id)}</a>: ${refs.map(escapeHtml).join("; ")}</li>`;
    }).join("") || "<li>No specific edition mapping is recorded.</li>"}</ul><p class="fw-small fw-muted">These references orient review; they do not transfer clauses or conclusions to other editions.</p>${sourceLinks({sources: profile.sources || []}, issue.sourceIds || [])}</details></article>`).join("")}</div><details><summary>Sector profile sources</summary>${sourceLinks({sources: profile.sources || []}, [], {fallback: true})}</details>`;
    return compact ? `<details class="fw-sector-profile"><summary>${escapeHtml(profile.name)} — ${issues.length} issues and evidence prompts</summary>${content}</details>` : `<article class="fw-panel fw-sector-profile"><h2>${escapeHtml(profile.name)}</h2>${content}<p><a class="fw-button" href="${escapeHtml(accountHref(`/audits?${new URLSearchParams({sector: profile.id})}`))}">Use this profile to prioritize audit topics</a></p></article>`;
  }

  function renderSectors() {
    return `<section class="fw-panel"><h2>Choose the project's sector or activity</h2>${select("Sector profile", "sector", sectorOptions())}<p class="fw-small">Profiles guide questions and evidence collection. They do not exclude requirements or assign compliance results.</p></section><div data-sector-profile></div>`;
  }

  function updateSectorPanel() {
    const profile = getSectorProfile(state.sector), panel = root.querySelector("[data-sector-profile]");
    if (panel) panel.innerHTML = renderSectorProfile(profile, {compact: state.view === "audits"});
    const priorityControl = root.querySelector('[data-filter="priority"]');
    if (priorityControl) {priorityControl.disabled = !profile; if (!profile) {state.priority = "all"; priorityControl.value = "all";}}
  }

  function sectorIssuesFor(check) {return getSectorProfile(state.sector)?.issues.filter(issue => issue.topic === check.topic) || [];}

  function renderAudits() {
    return `${renderEditionReadiness()}<section class="fw-panel"><h2>Choose your review context</h2><div class="fw-audit-controls">${select("Institution and framework edition", "framework", editionOptions(state.framework))}${select("Accounting", "accounting", option("detailed", "Detailed — source statements", state.accounting) + option("diagnostic", "Diagnostic — grouped checks", state.accounting))}${select("Check collection", "checkSet", "")}${select("Review topic", "topic", topicOptions(state.topic))}${select("Standard", "standard", "")}<label class="fw-search"><span>Search requirements and checks</span><input type="search" data-filter="search" placeholder="Source text, actor, clause, evidence or keyword" autocomplete="off"></label>${select("Sector / activity", "sector", sectorOptions())}${select("Sector focus", "priority", option("all", "Keep all checks; suggest sector order", state.priority) + option("focus", "Show suggested sector focus only", state.priority))}</div><div data-audit-context></div><div data-requirement-library aria-live="polite"></div><div data-sector-profile></div>${sourceNote()}</section><div data-policy-coverage></div><section class="fw-panel"><div class="fw-section-heading"><h2 data-audit-heading>Source statements and evidence prompts</h2><p class="fw-small fw-muted" data-count role="status" aria-live="polite"></p></div><p class="fw-small fw-note" data-sector-filter-note hidden></p><div class="fw-check-list" data-checks></div><nav class="fw-pagination" aria-label="Audit check pages" data-pagination></nav></section>`;
  }

  function renderEditionReadiness() {
    return `<section class="fw-panel" data-edition-readiness><h2>Gap analysis, due diligence and monitoring</h2><p>Every registered edition can be used in an engagement coverage matrix. Choose the governing editions and assessment scope, cite evidence, review findings, agree actions and approve the due diligence baseline before monitoring its implementation.</p><div class="fw-toolbar"><a class="fw-button" href="${escapeHtml(accountHref(`${localOrigin}/engagements?tab=matrix`))}">Open gap analysis and due diligence</a><a class="fw-button" href="${escapeHtml(accountHref(`${localOrigin}/engagements?tab=monitoring`))}">Open monitoring programs and reports</a><a class="fw-button" href="${escapeHtml(accountHref("/templates"))}">Browse thematic templates</a></div><details><summary>Review coverage for all ${frameworks.length} registered editions</summary><p class="fw-note">Starter checks are incomplete practitioner prompts. Prepared source units include headings, definitions and context; they are not a count of reviewed obligations. An extraction manifest does not establish that the private text is installed. No edition has complete, professionally verified requirement coverage.</p><div class="fw-table-scroll" tabindex="0" role="region" aria-label="Framework review coverage"><table class="fw-comparison-table"><thead><tr><th scope="col">Institution and edition</th><th scope="col">Starter checks</th><th scope="col">Prepared source extraction</th><th scope="col">Open review collection</th><th scope="col">Monitoring working outlines</th></tr></thead><tbody>${frameworks.map(framework => {
      const coverage = getFrameworkCoverage(framework.id);
      const starterHref = accountHref(`/audits?${new URLSearchParams({framework: framework.id, checkSet: "curated"})}`);
      const detailedHref = accountHref(`/audits?${new URLSearchParams({framework: framework.id, checkSet: "detailed"})}`);
      const reportingProfiles = engagementReportTemplates.filter(template => template.workflow === "monitor" && template.criteria && reportTemplateRequirementMatches(template, {frameworkId: framework.id, authority: framework.institution}));
      const genericProfile = engagementReportTemplates.find(template => template.id === "app-monitoring");
      const reports = (reportingProfiles.length ? reportingProfiles : [genericProfile]).filter(Boolean).map(template => `<a data-monitoring-profile="${escapeHtml(template.id)}" href="${escapeHtml(accountHref(`/templates?${new URLSearchParams({reportTemplate: template.id})}`))}">${escapeHtml(reportingProfiles.length ? template.name : "Generic periodic outline")}</a>`).join("<br>");
      return `<tr data-edition-coverage="${escapeHtml(framework.id)}"><th scope="row">${escapeHtml(framework.institution)}<span>${escapeHtml(framework.edition)}</span></th><td>${coverage.starterCheckCount} · incomplete</td><td>${coverage.sourceCorpusCount ? `${coverage.sourceCorpusCount} source units · ${coverage.libraryStatus === "partial" ? "partial extraction" : "extracted"} · unreviewed` : "Not prepared; starter checks only"}</td><td data-edition-check-links><a href="${escapeHtml(starterHref)}">Starter checks</a>${coverage.sourceCorpusCount ? ` · <a href="${escapeHtml(detailedHref)}">Detailed source accounting</a>` : ""}</td><td>${reports}${!reportingProfiles.length ? "<p>No institution-specific monitoring profile prepared.</p>" : ""}</td></tr>`;
    }).join("")}</tbody></table></div><p>Monitoring outlines are application-authored reporting aids. Their institutional context does not establish an official form or source-field verification. FMO and AIIB reporting profiles are also available in Template Studio with separately recorded institutional criteria. Source-specific thematic outlines and templates have separate permission and content-review states. Approval of an engagement covers its selected, reviewed requirements and evidence.</p></details></section>`;
  }

  const privatePack = () => ["detailed", "diagnostic"].includes(state.checkSet);
  const isLocalOrigin = () => local && globalThis.location?.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(globalThis.location.hostname);

  async function ensureRequirementLibrary({force = false} = {}) {
    if (!privatePack() || !isLocalOrigin() || !getRequirementManifest(state.framework) || disposed) return;
    const frameworkId = state.framework;
    if (!force && (state.corpus.get(frameworkId)?.state === "ready" || getAuditChecks(frameworkId, "detailed").length)) {
      state.corpus.set(frameworkId, {state: "ready"}); return;
    }
    if (state.pending.has(frameworkId)) return state.pending.get(frameworkId);
    state.corpus.set(frameworkId, {state: "loading"});
    updateLibraryStatus(); updateAudits();
    const pending = (async () => {
      try {
        const response = await fetch(`/api/requirements/${encodeURIComponent(frameworkId)}`, {headers: {"X-ESIA-Workspace": "local", "X-ESIA-Account": accountId}, credentials: "omit", redirect: "error", cache: "no-store", signal: libraryController.signal});
        if (!response.ok) {
          let message = `The private source library could not be opened (${response.status}).`;
          try {const result = await response.json(); message = typeof result.error === "string" ? result.error : message;} catch {}
          throw new Error(message);
        }
        const result = await response.json(), pack = result.pack || result;
        if (disposed) return;
        if (pack.frameworkId && pack.frameworkId !== frameworkId) throw new Error("The private source library belongs to another framework edition.");
        registerDetailedRequirementPack(pack);
        if (!getAuditChecks(frameworkId, "detailed").length) throw new Error("The corpus contains no extracted source statements. Inspect its coverage and source errors, then prepare or restore the library.");
        state.corpus.set(frameworkId, {state: "ready"});
      } catch (error) {
        if (error.name === "AbortError" || disposed) return;
        state.corpus.set(frameworkId, {state: "error", message: error.message || "The private source library could not be read."});
      } finally {
        state.pending.delete(frameworkId);
        if (!disposed && state.view === "audits" && state.framework === frameworkId) {updateAuditControls(); updateAudits();}
      }
    })();
    state.pending.set(frameworkId, pending);
    return pending;
  }

  function updateLibraryStatus() {
    const node = root.querySelector("[data-requirement-library]");
    if (!node) return;
    if (!privatePack()) {node.innerHTML = ""; return;}
    const manifest = getRequirementManifest(state.framework), status = state.corpus.get(state.framework);
    if (!manifest) {node.innerHTML = '<p class="fw-note">No detailed source library has been prepared for this edition. Its source text is not silently replaced with starter checks. Diagnostic accounting may provide a separate curated collection.</p>'; return;}
    if (!isLocalOrigin()) {
      const parameters = new URLSearchParams({framework: state.framework, checkSet: state.checkSet});
      if (state.sector) parameters.set("sector", state.sector);
      node.innerHTML = `<div class="fw-private-library"><h3>Detailed text stays in the private local library</h3><p>This published page contains coverage metadata. Original statements and generated groups are loaded only by your local ESIA installation. No connection is made to your local files from this page.</p><a class="fw-button" href="${escapeHtml(accountHref(`http://127.0.0.1:4173/audits?${parameters}`))}">Open this collection locally</a></div>`;
    } else if (status?.state === "error") node.innerHTML = `<div class="fw-private-library fw-library-error" role="alert"><h3>Private source library unavailable</h3><p>${escapeHtml(status.message)}</p><p>Your saved project records are unchanged. Prepare or restore the corpus in the local workspace, then retry.</p><button type="button" data-action="retry-library">Retry source library</button></div>`;
    else if (status?.state === "loading") node.innerHTML = '<p class="fw-note">Opening the private source library…</p>';
    else if (status?.state === "ready" || getAuditChecks(state.framework, "detailed").length) node.innerHTML = '<p class="fw-small fw-muted">Private source library loaded. Definition classifications remain unreviewed until checked against the original source. <button type="button" data-action="retry-library">Reload source library</button></p>';
    else node.innerHTML = '<p class="fw-note">The private corpus is expected for this edition. Opening it from the local workspace does not approve its extraction or classifications.</p>';
    node.insertAdjacentHTML("beforeend", renderCoverageManifest(manifest));
  }

  function renderCoverageManifest(manifest) {
    const coverage = manifest.coverage || {}, sources = coverage.sources || [];
    return `<details class="fw-coverage"><summary>Source coverage, exclusions and hashes</summary><p><strong>Extraction state:</strong> ${escapeHtml(coverage.status || "Unreviewed")} · ${escapeHtml(manifest.counts?.recordCount ?? "Unknown")} source units. ${escapeHtml(coverage.meaning || "Mechanical text coverage is not a reviewed list of obligations.")}</p><p class="fw-small">Complete reviewed obligation coverage: ${coverage.complete ? "Confirm the stated review scope against the sources." : "Not established."}</p>${sources.map(source => `<article class="fw-coverage-source"><h4>${escapeHtml(source.title || source.id)}</h4><p class="fw-small">${escapeHtml(source.status || "Unreviewed")} · ${escapeHtml(source.includedPages?.length ?? 0)} of ${escapeHtml(source.pageCount ?? "unknown")} PDF file pages included · ${escapeHtml(source.excludedPages?.length ?? 0)} pages excluded.</p><p class="fw-small">SHA256 <code>${escapeHtml(source.sha256 || "Original not available")}</code></p>${source.errors?.length ? list(source.errors) : ""}${source.warnings?.length ? list(source.warnings) : ""}${sourceLinks({sources: [source]}, [source.id])}</article>`).join("")}${coverage.missingSources?.length ? `<h4>Missing or failed sources</h4>${list(coverage.missingSources)}` : ""}${coverage.excludedDocuments?.length ? `<h4>Excluded documents</h4>${list(coverage.excludedDocuments.map(asText))}` : ""}${coverage.scopeWarnings?.length ? `<h4>Coverage limits</h4>${list(coverage.scopeWarnings)}` : ""}</details>`;
  }

  function updateAuditControls() {
    updateSourceNote();
    const available = auditCheckSets(state.framework);
    const packs = state.accounting === "detailed" ? available.filter(pack => pack.id === "detailed") : available.filter(pack => pack.id !== "detailed");
    if (state.accounting === "detailed") {
      state.checkSet = "detailed";
      if (!packs.length) packs.push({id: "detailed", label: "Detailed source statements — unavailable", count: 0});
    } else if (!packs.some(pack => pack.id === state.checkSet)) state.checkSet = packs.some(pack => pack.id === "diagnostic") ? "diagnostic" : "curated";
    root.querySelector('[data-filter="checkSet"]').innerHTML = packs.map(pack => option(pack.id, `${pack.label} (${pack.count})`, state.checkSet)).join("");
    const standards = [...new Set(getAuditChecks(state.framework, state.checkSet).map(check => check.standard))].sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));
    if (!standards.includes(state.standard)) state.standard = "all";
    root.querySelector('[data-filter="standard"]').innerHTML = option("all", "All standards", state.standard) + standards.map(standard => option(standard, standard, state.standard)).join("");
    const framework = getFramework(state.framework);
    const coverage = state.checkSet === "workbook" ? "Existing IFC M&E workbook: 524 diagnostics. Original IDs and workbook locations are preserved; clause mappings have not been revalidated." : state.checkSet === "detailed" ? "Detailed accounting retains extracted source statements and their surrounding context. Sentences, headings and definitions are not all obligations. Actor and modality classifications are unreviewed." : state.checkSet === "diagnostic" ? "Conceptual diagnostic groups retain their exact member statement IDs. A group-level finding does not assign a conclusion to its members or prove that every member is satisfied." : framework?.coverage || "Curated starter checks; incomplete";
    root.querySelector("[data-audit-context]").innerHTML = framework ? `<article class="fw-audit-context"><p class="fw-eyebrow">${escapeHtml(framework.institution)} · ${escapeHtml(framework.edition)}</p><h3>${escapeHtml(framework.name)}</h3><p><strong>Applicability:</strong> ${escapeHtml(framework.applicability)}</p><p class="fw-note">${escapeHtml(coverage)} No collection is a complete reviewed register of every applicable obligation.</p><p class="fw-small">Assessment conclusions start unassessed. Using an item only pre-fills local review context. You choose a project, evaluate applicability, add evidence and record your reviewed conclusion.</p><details><summary>Edition sources</summary>${sourceLinks(framework, [], {fallback: true})}</details></article>` : "";
    root.querySelector("[data-audit-heading]").textContent = state.accounting === "detailed" ? "Detailed source accounting" : "Diagnostic checks and conceptual groups";
    const policyNode=root.querySelector('[data-policy-coverage]');
    if(policyNode&&(policyWorkbenchNode!==policyNode||policyWorkbenchFramework!==state.framework)){
      policyWorkbench?.dispose();policyWorkbenchNode=policyNode;policyWorkbenchFramework=state.framework;
      policyWorkbench=mountPolicyCoverageWorkbench(policyNode,{frameworkId:state.framework,accountId,local:local&&isLocalOrigin()});
    }
    updateLibraryStatus();
    updateSectorPanel();
  }

  const asText = value => typeof value === "string" ? value : value === undefined || value === null ? "" : typeof value === "object" ? value.text || value.sourceText || JSON.stringify(value) : String(value);
  const asList = value => Array.isArray(value) ? value.map(asText) : value ? [asText(value)] : [];

  function renderDefinition(check, {member = false} = {}) {
    const detail = check.detail || {}, context = detail.context || {}, framework = getFramework(state.framework);
    const pages = asList(detail.pages?.length ? detail.pages : detail.page).join(", ") || "Not recorded";
    const warnings = asList(detail.extractionWarnings), footnotes = asList(context.footnotes), items = asList(context.listItems);
    return `<div class="fw-definition${member ? " fw-member-definition" : ""}"><div class="fw-section-heading"><h4>${escapeHtml(check.title || check.clause || check.id)}</h4><span class="fw-badge fw-unassessed">Definition: ${escapeHtml(detail.reviewStatus || "unreviewed")}</span></div>
      <blockquote class="fw-source-statement"><p>${escapeHtml(detail.sourceText || "No source sentence is attached to this record. Verify the original source.")}</p></blockquote>
      <dl class="fw-definition-meta"><dt>Actor candidate</dt><dd>${escapeHtml(asText(detail.actor) || "Not classified")}</dd><dt>Detected modality</dt><dd>${escapeHtml(asList(detail.modality).join("; ") || "No modality classified")}</dd><dt>Text classification</dt><dd>${escapeHtml(asText(detail.classification) || "Unreviewed")}</dd><dt>PDF file page(s)</dt><dd>${escapeHtml(pages)}</dd><dt>Paragraph / sentence</dt><dd>${escapeHtml(asText(detail.paragraph) || "Not established")} / ${escapeHtml(asText(detail.sentenceIndex) || "Not recorded")}</dd><dt>Source SHA256</dt><dd><code>${escapeHtml(detail.sourceSha256 || "Not recorded")}</code></dd></dl>
      <details class="fw-definition-context"><summary>Context, qualifications and extraction limits</summary><p class="fw-small">Context and attached footnotes help review conditions and exceptions. Their presence does not establish that every qualification was captured; verify the original pages.</p>${context.section ? `<p><strong>Section:</strong> ${escapeHtml(asText(context.section))}</p>` : ""}${context.parentText ? `<h5>Parent paragraph / list lead-in</h5><p class="fw-preserve-text">${escapeHtml(asText(context.parentText))}</p>` : '<p class="fw-muted">No parent paragraph attached.</p>'}${items.length ? `<h5>Related list items</h5>${list(items)}` : ""}<h5>Footnotes / qualifications</h5>${footnotes.length ? list(footnotes) : '<p class="fw-muted">No footnote text attached. Check the source before interpreting conditions or exceptions.</p>'}${context.previousText ? `<h5>Previous source text</h5><p class="fw-preserve-text">${escapeHtml(asText(context.previousText))}</p>` : ""}${context.nextText ? `<h5>Following source text</h5><p class="fw-preserve-text">${escapeHtml(asText(context.nextText))}</p>` : ""}<h5>Extraction warnings</h5>${warnings.length ? list(warnings) : '<p class="fw-muted">No row-specific warning recorded; extraction and classification remain unreviewed.</p>'}</details>
      ${sourceLinks(framework, check.sourceIds || (detail.sourceId ? [detail.sourceId] : []), {direct: check.sources || []})}<p class="fw-small fw-muted">Statement ID <code>${escapeHtml(check.id)}</code></p></div>`;
  }

  function renderAuditCheck(check) {
    const framework = getFramework(state.framework), members = check.memberIds || [];
    const issues = sectorIssuesFor(check);
    const disclosureKey=JSON.stringify([state.framework,state.checkSet,check.id]);
    return `<article class="fw-check" data-check-id="${escapeHtml(check.id)}"><details class="fw-check-details" data-check-disclosure="${escapeHtml(disclosureKey)}"${state.openChecks.has(disclosureKey)?' open':''}><summary class="fw-check-summary"><span class="fw-check-title"><span class="fw-check-heading" role="heading" aria-level="3">${escapeHtml(check.title)}</span><span class="fw-check-meta">${escapeHtml(check.standard)} · ${escapeHtml(topicName(check.topic))}${check.detail?` · Definition: ${escapeHtml(check.detail.reviewStatus||'unreviewed')}`:''}</span><span class="fw-check-locator" title="${escapeHtml(check.clause||'Verify the source clause')}">${escapeHtml(check.clause||'Verify the source clause')}</span><span class="fw-badge fw-unassessed"><span class="fw-sr-only">Assessment: </span>Unassessed</span></span></summary><div class="fw-check-details-body"><p class="fw-clause"><strong>Clause / source locator:</strong> ${escapeHtml(check.clause || "Verify the source clause")}</p>
      ${issues.length ? `<p class="fw-sector-priority">Sector screening focus: ${issues.map(issue => escapeHtml(issue.label)).join("; ")}. Confirm relevance to the project; this is not an applicability decision.</p>` : ""}${check.detail ? renderDefinition(check) : `<p class="fw-prompt">${escapeHtml(check.prompt)}</p>`}
      ${members.length ? `<p class="fw-note">${members.length} source statements inform this conceptual group. A group conclusion does not determine the conclusions of the member statements.</p>${check.groupingBasis ? `<p class="fw-small"><strong>Grouping basis:</strong> ${escapeHtml(asText(check.groupingBasis))}</p>` : ""}<details data-member-group="${escapeHtml(check.id)}"><summary>Inspect ${members.length} original statement definitions and member IDs</summary><div data-member-content></div></details>` : ""}
      <div class="fw-evidence"><strong>Evidence to consider</strong>${list(check.evidence || [])}</div>${check.workbook ? `<p class="fw-small fw-muted">Workbook: ${escapeHtml(check.workbook.name || "IFC M&E matrix")}; sheet ${escapeHtml(check.workbook.sheet)}; row ${escapeHtml(check.workbook.row)}. ${escapeHtml(check.coverage || "")}</p><details><summary>Framework sources for verification</summary>${sourceLinks(framework, check.sourceIds || [], {fallback: true, direct: check.sources || []})}</details>` : check.detail ? "" : sourceLinks(framework, check.sourceIds || [], {direct: check.sources || []})}
      <p class="fw-check-identity fw-small fw-muted">${members.length?'Group':'Check'} ID <code>${escapeHtml(check.id)}</code></p></div></details><div class="fw-check-actions"><a class="fw-button" href="${escapeHtml(useCheckHref(framework.id, check, state.checkSet))}" aria-label="${escapeHtml(`Use ${check.title} ${members.length?'group':'check'} in local project`)}">Use ${members.length?'group':'check'}</a></div></article>`;
  }

  function updateAudits() {
    const status = state.corpus.get(state.framework);
    const all = privatePack() && (!isLocalOrigin() || ["loading", "error"].includes(status?.state)) ? [] : getAuditChecks(state.framework, state.checkSet), query = state.search.toLocaleLowerCase().trim();
    const baseMatches = all.filter(check => (state.topic === "all" || check.topic === state.topic) && (state.standard === "all" || check.standard === state.standard) &&
      (!query || [check.id, check.standard, check.clause, check.title, check.prompt, check.detail?.sourceText, asText(check.detail?.context?.parentText), asText(check.detail?.actor), ...asList(check.detail?.modality), ...(check.evidence || [])].join(" ").toLocaleLowerCase().includes(query)));
    const profile = getSectorProfile(state.sector);
    const priority = check => {const issues = sectorIssuesFor(check); return issues.some(issue => issue.scrutiny === "heightened") ? 0 : issues.length ? 1 : 2;};
    const matches = state.priority === "focus" && profile ? baseMatches.filter(check => sectorIssuesFor(check).length) : [...baseMatches];
    if (profile) matches.sort((a, b) => priority(a) - priority(b));
    const pageSize = 30, pages = Math.max(1, Math.ceil(matches.length / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const start = state.page * pageSize, visible = matches.slice(start, start + pageSize);
    const expectedCount = auditCheckSets(state.framework).find(pack => pack.id === state.checkSet)?.count || all.length;
    root.querySelector("[data-count]").textContent = privatePack() && !isLocalOrigin() ? `${expectedCount} records reported by local-library metadata` : `${matches.length} of ${all.length || expectedCount} records${matches.length ? ` · showing ${start + 1}–${start + visible.length}` : ""}`;
    const filterNote = root.querySelector("[data-sector-filter-note]");
    filterNote.hidden = !profile;
    filterNote.textContent = !profile ? "" : state.priority === "focus" ? `Suggested sector focus is an explicit display filter. ${baseMatches.length - matches.length} other records matching the topic/search remain in this register; no record has been excluded from applicability review. Choose “Keep all checks” to see them.` : `${profile.name} suggests review order only. All ${all.length || expectedCount} records remain in the register; requirements without a suggested sector issue still need applicability review.`;
    let empty = "No records match these filters. Choose another topic or standard, or clear your search.";
    if (privatePack() && !isLocalOrigin()) empty = "Open this source collection in the local ESIA installation to inspect its statements and diagnostic groups.";
    else if (privatePack() && status?.state === "loading") empty = "Loading source definitions from the private library…";
    else if (privatePack() && status?.state === "error") empty = "The source library could not be loaded. See the error and retry control above; no starter checks have been substituted.";
    else if (privatePack() && !getRequirementManifest(state.framework)) empty = "This edition has no prepared detailed corpus. Select diagnostic accounting to inspect any available starter checks.";
    root.querySelector("[data-checks]").innerHTML = visible.length ? visible.map(renderAuditCheck).join("") : `<p class="fw-empty">${escapeHtml(empty)}</p>`;
    root.querySelector("[data-pagination]").innerHTML = pages > 1 ? `<button type="button" data-action="previous"${state.page === 0 ? " disabled" : ""}>Previous records</button><span>Page ${state.page + 1} of ${pages}</span><button type="button" data-action="next"${state.page + 1 >= pages ? " disabled" : ""}>Next records</button>` : "";
  }

  function renderWorkflows() {
    const phases = [...new Set(professionalWorkflows.flatMap(workflow => workflow.phase))];
    return `<section class="fw-panel"><h2>Find the work you need to do</h2><p>Use this inventory to plan a service, organize its evidence and identify the next useful tool. Inputs, records and outputs describe the full professional workflow; the support label and current gap distinguish what the app can do today.</p><div class="fw-workflow-controls">${select("Engagement phase", "phase", option("all", "All phases", state.phase) + phases.map(phase => option(phase, phase, state.phase)).join(""))}${select("Application support", "support", option("all", "All support levels", state.support) + Object.entries(labels).map(([value, label]) => option(value, label, state.support)).join(""))}<label class="fw-search"><span>Search professional workflows</span><input type="search" data-filter="workflowSearch" placeholder="For example, livelihoods or reporting" autocomplete="off"></label></div><p class="fw-note"><strong>Implemented:</strong> the bounded named local workflow runs. <strong>Partial:</strong> useful pieces run, with gaps. <strong>Planned:</strong> a dedicated workflow is absent. Filing a document does not implement its specialist analysis. Support labels describe this working tree.</p><p class="fw-small">For direct manual work, open <a href="${escapeHtml(accountHref(local ? "/" : "http://127.0.0.1:4173/"))}">local project records</a>. Optional configured AI returns draft proposals for review. Automatic synchronization between local and hosted records remains unavailable.</p></section><section class="fw-workflows-section" aria-labelledby="fw-workflow-title"><div class="fw-section-heading"><h2 id="fw-workflow-title">Workflow inventory</h2><p class="fw-small fw-muted" data-count role="status" aria-live="polite"></p></div><div class="fw-workflow-list" data-workflows></div></section>`;
  }

  function updateWorkflows() {
    const query = state.workflowSearch.toLocaleLowerCase().trim();
    const matches = professionalWorkflows.filter(workflow => (state.phase === "all" || workflow.phase.includes(state.phase)) && (state.support === "all" || workflow.currentSupport === state.support) &&
      (!query || [workflow.name, ...workflow.inputs, ...workflow.records, ...workflow.outputs, ...workflow.reviewControls, workflow.gap, workflow.nextStep].join(" ").toLocaleLowerCase().includes(query)));
    root.querySelector("[data-count]").textContent = `${matches.length} of ${professionalWorkflows.length} workflows`;
    root.querySelector("[data-workflows]").innerHTML = matches.length ? matches.map(workflow => `<article class="fw-panel fw-workflow" data-workflow-id="${escapeHtml(workflow.id)}"><div class="fw-section-heading"><h3>${escapeHtml(workflow.name)}</h3><span class="fw-badge fw-support-${workflow.currentSupport}">${labels[workflow.currentSupport]}</span></div><p class="fw-small fw-muted">${workflow.phase.map(escapeHtml).join(" · ")}</p><details><summary>Scope, records and next steps</summary><div class="fw-workflow-details">${[["Inputs", workflow.inputs], ["Records", workflow.records], ["Outputs", workflow.outputs], ["Review controls", workflow.reviewControls]].map(([title, values]) => `<section><h4>${title}</h4>${list(values)}</section>`).join("")}</div><p class="fw-current-gap"><strong>Current scope and gap:</strong> ${escapeHtml(workflow.gap)}</p><p class="fw-next"><strong>Next useful addition:</strong> ${escapeHtml(workflow.nextStep)}</p></details>${workflow.localPath ? `<p><a class="fw-button" href="${escapeHtml(accountHref(local ? workflow.localPath : `http://127.0.0.1:4173${workflow.localPath}`))}">${escapeHtml(workflow.localLabel || "Open local oversight workspace")}</a></p>` : ""}</article>`).join("") : '<p class="fw-panel fw-empty">No workflows match these filters. Try another phase, support level or search.</p>';
  }

  function update() {
    if (disposed) return;
    if (state.view === "compare") updateCompare();
    else if (state.view === "audits") {updateAuditControls(); updateAudits(); ensureRequirementLibrary();}
    else if (state.view === "sectors") updateSectorPanel();
    else updateWorkflows();
  }

  function onFilter(event) {
    const control = event.target.closest("[data-filter]");
    if (!control || !root.contains(control)) return;
    const key = control.dataset.filter;
    if (key.startsWith("edition-")) {
      const index = Number(key.slice(8));
      if (control.value && state.selected.some((id, position) => position !== index && id === control.value)) {control.value = state.selected[index]; announce("That edition is already selected in another column."); return;}
      state.selected[index] = control.value;
    } else {
      state[key] = control.value;
      if (["framework", "accounting", "checkSet", "topic", "standard", "search", "sector", "priority"].includes(key)) state.page = 0;
      if (key === "framework" || key === "accounting") {state.checkSet = state.accounting === "detailed" ? "detailed" : auditCheckSets(state.framework).some(pack => pack.id === "diagnostic") ? "diagnostic" : "curated"; state.standard = "all";}
      if (key === "checkSet") state.standard = "all";
    }
    if (state.view === "compare") updateCompare();
    else if (state.view === "audits") {
      if (["framework", "accounting", "checkSet"].includes(key)) updateAuditControls();
      if (key === "sector") updateSectorPanel();
      updateAudits();
      ensureRequirementLibrary();
    } else if (state.view === "sectors") updateSectorPanel();
    else updateWorkflows();
  }

  function onInput(event) {if (["search", "workflowSearch"].includes(event.target.dataset.filter)) onFilter(event);}
  function onChange(event) {if (!["search", "workflowSearch"].includes(event.target.dataset.filter)) onFilter(event);}
  function onClick(event) {
    const control = event.target.closest("button[data-action]");
    if (!control || !root.contains(control)) return;
    const action = control.dataset.action;
    if (action === "retry-library") {
      ensureRequirementLibrary({force: true});
    } else if (action === "export-comparison") {
      const csv = comparisonCsv(state.selected.filter(Boolean), state.topic), url = URL.createObjectURL(new Blob(["\ufeff", csv], {type: "text/csv;charset=utf-8"}));
      const link = document.createElement("a"); link.href = url; link.download = "framework-comparison.csv"; root.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000); announce("Comparison CSV downloaded with the selected topics and source URLs.");
    } else if (["previous", "next"].includes(action)) {
      state.page += action === "next" ? 1 : -1;
      updateAudits();
      const summary = root.querySelector("[data-checks] .fw-check-summary");
      if (summary) summary.focus();
    }
  }

  function onToggle(event) {
    const disclosure = event.target;
    if(disclosure.dataset.checkDisclosure&&root.contains(disclosure)){if(disclosure.open)state.openChecks.add(disclosure.dataset.checkDisclosure);else state.openChecks.delete(disclosure.dataset.checkDisclosure);return;}
    if (!disclosure.open || !disclosure.dataset.memberGroup || !root.contains(disclosure)) return;
    const container = disclosure.querySelector("[data-member-content]");
    if (!container || container.dataset.loaded) return;
    const group = getAuditChecks(state.framework, state.checkSet).find(check => check.id === disclosure.dataset.memberGroup);
    if (!group) return;
    const definitions = new Map(getAuditChecks(state.framework, "detailed").map(check => [check.id, check]));
    for (const member of group.members || []) if (typeof member === "object" && member.id) definitions.set(member.id, member);
    container.innerHTML = `<ol class="fw-member-list">${(group.memberIds || []).map(id => `<li><code>${escapeHtml(id)}</code>${definitions.has(id) ? renderDefinition(definitions.get(id), {member: true}) : '<p class="fw-note">This member definition is unavailable. Its ID remains retained; inspect or restore the source library before drawing a conclusion.</p>'}</li>`).join("")}</ol>`;
    container.dataset.loaded = "true";
  }

  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  root.addEventListener("toggle", onToggle, true);
  render();
  const dispose = () => {disposed = true; libraryController.abort();policyWorkbench?.dispose(); root.removeEventListener("input", onInput); root.removeEventListener("change", onChange); root.removeEventListener("click", onClick); root.removeEventListener("toggle", onToggle, true);};
  if (invalidation?.then) invalidation.then(dispose);
  return {dispose};
}
