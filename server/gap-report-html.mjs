const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const text = (value, fallback = "Not recorded") => h(value === undefined || value === null || value === "" ? fallback : value);
const statusLabels = {gap: "Gap", conforms: "Conforms", insufficient_evidence: "Insufficient evidence", not_applicable: "Not applicable", open: "Open", in_progress: "In progress", closed: "Closed"};
const applicabilityLabels = {applies: "Applies", does_not_apply: "Does not apply", uncertain: "Uncertain"};
const object = value => value && typeof value === "object" && !Array.isArray(value);
const credentialKey = /^(?:access[_-]?token|id[_-]?token|refresh[_-]?token|oauth[_-]?token|token|auth|authorization|authorization[_-]?code|code|bearer|jwt|api[_-]?key|key|password|passwd|secret|client[_-]?secret|session(?:id|[_-]id|[_-]token)?|sid|signature|sig|credential|credentials|x-amz-.+|x-goog-.+|awsaccesskeyid|googleaccessid|key-pair-id|policy|rlkey|resourcekey)$/i;

function sourceHref(value) {
  if (typeof value !== "string" || value.length > 4000 || /[\x00-\x20\x7f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    const keys = [...url.searchParams.keys(), ...new URLSearchParams(url.hash.replace(/^#/, "")).keys()];
    if (keys.some(key => credentialKey.test(key.replace(/\[\d*\]$/, "").replace(/[.\s]/g, "-"))) || /(?:token|password|secret|signature|credential)\s*(?:=|%3d)/i.test(url.hash)) return null;
    return url.href;
  } catch {return null;}
}

function stylesheetPath(value) {
  if (typeof value !== "string" || value.length > 2048 || !/^\/(?!\/)[A-Za-z0-9_./-]+\.css(?:\?[A-Za-z0-9_=&.%-]*)?$/.test(value) || /(?:^|\/)\.\.(?:\/|$)/.test(value)) {
    throw new TypeError("The report stylesheet must be a same-origin root-relative CSS path.");
  }
  return value;
}

const status = (value, label) => `<span class="gr-status${Object.hasOwn(statusLabels, value) ? ` gr-status-${value}` : ""}">${text(label || statusLabels[value] || value)}</span>`;
const fact = (label, value, fallback) => `<dt>${h(label)}</dt><dd>${text(value, fallback)}</dd>`;
const tagText = tag => typeof tag === "string" ? tag : tag?.label || tag?.id || "";

function renderSources(sources) {
  if (!sources?.length) return '<p class="gr-empty">No framework source references were recorded.</p>';
  return `<ul class="gr-source-list">${sources.map(source => {
    const href = sourceHref(source.url);
    return `<li><strong>${text(source.title)}</strong>${href ? ` — <a href="${h(href)}" target="_blank" rel="noopener noreferrer">Open source<span class="gr-sr-only"> (new tab)</span></a>` : ' — <span class="gr-muted">Source link withheld: invalid or credential-bearing URL.</span>'}${source.locator ? `<br>${h(source.locator)}` : ""}${source.sha256 ? `<br>SHA256 <code>${h(source.sha256)}</code>` : ""}</li>`;
  }).join("")}</ul>`;
}

function renderEvidence(evidence) {
  const authors = evidence.authors || [], tags = evidence.tags || [], source = evidence.source;
  const sourceUrl = source?.originalUrl ? sourceHref(source.originalUrl) : null;
  const finalUrl = source?.finalUrl ? sourceHref(source.finalUrl) : null;
  return `<article class="gr-evidence" data-evidence-id="${h(evidence.id)}"><p class="gr-evidence-title">${text(evidence.title)} <span class="gr-muted">— ${text(evidence.locator)}</span></p>
    ${evidence.note ? `<p>${h(evidence.note)}</p>` : ""}<p>${h(evidence.filename)} · ${evidence.mode === "registered" ? "Registered reference at issue; historical bytes are not preserved by this report." : "Managed source version recorded at issue; original files belong in the portable project package."}</p>
    ${authors.length || evidence.documentDate || tags.length ? `<p class="gr-small">${authors.length ? `Authors: ${authors.map(h).join("; ")}. ` : ""}${evidence.documentDate ? `Document date: ${h(evidence.documentDate)}. ` : ""}${tags.length ? `Tags: ${tags.map(tagText).filter(Boolean).map(h).join("; ")}.` : ""}</p>` : ""}
    <p class="gr-reference">Evidence <code>${h(evidence.id)}</code> · Resource <code>${h(evidence.resourceId)}</code> · Version <code>${h(evidence.versionId)}</code><br>SHA256 <code>${h(evidence.sha256)}</code></p>
    ${evidence.reference ? `<p class="gr-reference">Qualified identity: <code>${h(JSON.stringify(evidence.reference))}</code></p>` : ""}${evidence.externalReference ? `<p class="gr-reference">Upstream identity: <code>${h(JSON.stringify(evidence.externalReference))}</code></p>` : ""}
    ${source ? `<p class="gr-small">${sourceUrl ? `Original source: <a href="${h(sourceUrl)}" target="_blank" rel="noopener noreferrer">${h(sourceUrl)}</a>. ` : source.originalUrl ? "Original source link withheld. " : ""}${finalUrl && finalUrl !== sourceUrl ? `Final source: <a href="${h(finalUrl)}" target="_blank" rel="noopener noreferrer">${h(finalUrl)}</a>. ` : ""}${source.capturedAt ? `Captured: ${h(source.capturedAt)}. ` : ""}${source.method ? `Method: ${h(source.method)}. ` : ""}${source.result ? `Result: ${h(source.result)}.` : ""}</p>` : ""}</article>`;
}

function renderAction(action) {
  return `<article class="gr-action" data-action-id="${h(action.id)}"><p><strong>${h(action.description)}</strong> ${status(action.status)}${action.overdue ? ' <span class="gr-status gr-status-gap">Overdue at issue</span>' : ""}</p><p>Accountable party: ${text(action.owner)} · Due: ${text(action.dueDate)}</p><p><strong>Required closure evidence:</strong> ${text(action.closureEvidence)}</p><p><strong>Verification:</strong> ${text(action.verification, "Not recorded; a status alone does not verify closure.")}</p><p class="gr-reference">Action <code>${h(action.id)}</code> · Assessment <code>${h(action.assessmentId)}</code></p></article>`;
}

function renderDefinitionReview(review) {
  if (!review) return '<p class="gr-coverage-note">No separate practitioner review of the source definition was recorded. A project conclusion does not approve an extraction or its classifications.</p>';
  return `<section class="gr-definition-review"><h5>Practitioner requirement interpretation</h5><p class="gr-small">${text(review.reviewStatus, "Practitioner reviewed")} · ${text(review.reviewer)} · ${text(review.reviewedAt)}</p><dl class="gr-finding-facts">${fact("Responsible actor", review.actor)}${fact("Interpreted requirement", review.requirement)}${fact("Conditions", review.conditions)}${fact("Exceptions", review.exceptions, "None recorded")}${fact("Verification evidence", review.verificationEvidence)}</dl></section>`;
}

function renderDefinition(definition) {
  if (!definition) return "";
  const members = definition.memberIds || [];
  return `<details class="gr-source-definition"><summary>Retained source definition${members.length ? ` — ${members.length} group members` : ""}</summary><p class="gr-small">Definition status: <strong>${text(definition.reviewStatus, "Unreviewed")}</strong> · Parser: <code>${text(definition.parserVersion)}</code>. Extraction status is separate from this project's finding.</p>${definition.detail?.sourceText ? `<blockquote class="gr-source-statement">${h(definition.detail.sourceText)}</blockquote><p class="gr-reference">PDF file page ${text(definition.detail.page)} · SHA256 <code>${text(definition.detail.sourceSha256)}</code></p>` : ""}${members.length ? `<p class="gr-coverage-note">This conceptual group retains ${members.length} source statement IDs. Its assessment does not create or transfer conclusions for individual members.</p><ol class="gr-member-list">${members.map(id => `<li><code>${h(id)}</code></li>`).join("")}</ol>` : ""}</details>`;
}

function renderFinding(finding, {anchor, ordinal}) {
  return `<article class="gr-finding" id="${h(anchor)}" data-assessment-id="${h(finding.id)}"><header class="gr-finding-header"><div><p class="gr-eyebrow">Finding ${ordinal} · ${text(finding.standard)}</p><h4>${text(finding.framework.clause)}</h4><p>${text(finding.framework.authority)} · ${text(finding.framework.edition)}</p></div>${status(finding.conclusion, finding.conclusionLabel)}</header><div class="gr-finding-body">
    <p class="gr-requirement"><strong>Requirement / review prompt:</strong> ${text(finding.requirement)}</p><dl class="gr-finding-facts">${fact("Conclusion and rationale", finding.rationale)}${fact("Applicability", applicabilityLabels[finding.applicability.decision] || finding.applicability.decision)}${fact("Applicability rationale", finding.applicability.rationale)}${fact("Scope", finding.applicability.scope)}${fact("Relevant period", finding.applicability.period)}${fact("Missing evidence", finding.missingEvidence, "None recorded")}${fact("Uncertainty", finding.uncertainty, "None recorded")}${fact("Risk significance", finding.riskSignificance)}${fact("Reviewed by", finding.reviewer)}${fact("Reviewed at", finding.reviewedAt)}</dl>
    <p class="gr-coverage-note"><strong>Coverage:</strong> ${text(finding.coverage, "No complete requirement coverage claim was retained.")}</p>${finding.historyNote ? `<p class="gr-note">${h(finding.historyNote)}</p>` : ""}${finding.sector ? `<p class="gr-small"><strong>Sector screening context:</strong> ${text(finding.sector.name)}. Attention prompts do not determine applicability or compliance.</p>` : ""}
    <h5>Supporting or contradictory project evidence</h5>${finding.evidence?.length ? finding.evidence.map(renderEvidence).join("") : '<p class="gr-empty">No project evidence is cited for this assessment.</p>'}
    <h5>Actions and commitments</h5>${finding.actions?.length ? finding.actions.map(renderAction).join("") : '<p class="gr-empty">No action is linked to this assessment.</p>'}
    <h5>Governing source references</h5>${renderSources(finding.sources)}${finding.definition?.memberIds?.length ? `<p class="gr-coverage-note">Diagnostic group: ${finding.definition.memberIds.length} retained source statements. The group outcome does not assign conclusions to its members.</p>` : ""}${renderDefinition(finding.definition)}${finding.definition ? renderDefinitionReview(finding.definitionReview) : finding.definitionReview ? renderDefinitionReview(finding.definitionReview) : ""}
    ${finding.detailBlocks?.length ? `<details class="gr-disclosure-details"><summary>Full retained detail and qualifications</summary><p class="gr-small gr-muted">Expand before printing to include this full source and provenance appendix. Closed disclosures stay out of the printed report.</p>${finding.detailBlocks.map(block => `<section class="gr-detail-block"><h6>${text(block.label)}</h6><p class="gr-narrative">${text(block.value)}</p></section>`).join("")}</details>` : ""}
    <p class="gr-reference">Assessment <code>${h(finding.id)}</code>${finding.checkId ? ` · Check <code>${h(finding.checkId)}</code> · Collection <code>${h(finding.checkSet)}</code>` : ""}</p></div></article>`;
}

/** Render only a frozen model supplied by buildGapReportModel. No source HTML,
 * Markdown, script, URL parameter or document instruction is evaluated here. */
export function renderGapReportHtml(model, {stylesheetHref = "/gap-report.css"} = {}) {
  if (!object(model) || model.schemaVersion !== 1 || !object(model.project) || !object(model.summary) || !Array.isArray(model.findings) || !Array.isArray(model.standards)) throw new TypeError("A supported frozen gap-report model is required.");
  const css = stylesheetPath(stylesheetHref), project = model.project, summary = model.summary, counts = summary.conclusions, actions = summary.actions;
  const findingAnchors = new Map(model.findings.map((finding, index) => [finding.id, {anchor: `finding-${index + 1}`, ordinal: index + 1}]));
  const editions = new Map(), used = new Set(["report-summary", "findings-overview", "report-notes"]);
  for (const [index, standard] of model.standards.entries()) {
    const key = JSON.stringify([standard.authority, standard.frameworkName, standard.edition]);
    if (!editions.has(key)) editions.set(key, {authority: standard.authority, name: standard.frameworkName, edition: standard.edition, anchor: `edition-${editions.size + 1}`, standards: []});
    let anchor = /^[A-Za-z][A-Za-z0-9_.:-]{0,191}$/.test(standard.anchorId || "") && !used.has(standard.anchorId) ? standard.anchorId : `standard-${index + 1}`;
    while (used.has(anchor)) anchor += "-section";
    used.add(anchor); editions.get(key).standards.push({...standard, reportAnchor: anchor});
  }
  const editionGroups = [...editions.values()];
  const summaryItems = [["assessmentRecords", "Assessment records", summary.assessmentRecords], ["gap", "Gap records", counts.gap], ["insufficient_evidence", "Insufficient evidence", counts.insufficient_evidence], ["conforms", "Conforms records", counts.conforms], ["not_applicable", "Not applicable", counts.not_applicable]];
  const paperClass = model.paperSize === "Letter" ? " paper-letter" : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${h(model.title)} — ${h(project.name)}</title><link rel="stylesheet" href="${h(css)}"></head>
<body class="gap-report${paperClass}"><main class="gap-report gr-document${paperClass}"><header class="gr-masthead"><p class="gr-eyebrow">Environmental &amp; social · Issued gap analysis</p><h1>${h(model.title)}</h1><p class="gr-subtitle">${h(project.name)}</p><div class="gr-masthead-meta"><span>Client: ${text(project.client)}</span><span>Period: ${text(project.period)}</span><span>Issued: ${text(model.issuedAt)}</span><span>Reviewer: ${text(model.reviewer)}</span></div></header><div class="gr-content">
<section class="gr-section" id="report-summary" aria-labelledby="report-summary-heading"><h2 id="report-summary-heading">Findings summary</h2><dl class="gr-meta"><div><dt>Project phase</dt><dd>${text(project.phase)}</dd></div><div><dt>Project revision at issue</dt><dd>${text(project.revision)}</dd></div><div><dt>Template</dt><dd>${text(model.template?.id)} · v${text(model.template?.version)}</dd></div><div><dt>Report ID</dt><dd><code>${h(model.id)}</code></dd></div></dl><div class="gr-summary">${summaryItems.map(([key, label, value]) => `<div class="gr-summary-item gr-summary-${key}" data-summary-key="${key}"><strong>${h(value)}</strong><span>${label}</span></div>`).join("")}</div><div class="gr-summary-secondary"><span>${h(summary.requirementReferences)} check/scope references</span><span>${h(summary.frameworkCount)} framework editions</span><span>${h(summary.standardCount)} standards in report scope</span><span>${h(actions.total)} actions · ${h(actions.open)} open · ${h(actions.in_progress)} in progress · ${h(actions.closed)} closed</span><span data-summary-key="overdue">${h(actions.overdue)} overdue at issue</span><span data-summary-key="gapsWithoutActions">${h(summary.gapsWithoutActions)} gap records without linked actions</span></div><p class="gr-note">Counts describe assessment records in this issued snapshot, including any retained history. They are not compliance percentages or an assertion that every requirement has been assessed.</p></section>
${model.narrative ? `<section class="gr-section"><h2>Practitioner narrative</h2><div class="gr-narrative">${h(model.narrative)}</div></section>` : ""}
${model.notes?.length ? `<section class="gr-section" id="report-notes"><h2>Scope and reading notes</h2><ul class="gr-source-list">${model.notes.map(note => `<li>${h(note)}</li>`).join("")}</ul></section>` : ""}
<nav class="gr-navigation" aria-label="Report institutions, editions and standards"><p>Navigate this report</p><ul><li><a href="#report-summary">Summary</a></li><li><a href="#findings-overview">Findings register</a></li>${editionGroups.map(edition => `<li><a href="#${h(edition.anchor)}">${h(edition.authority)} · ${h(edition.edition)}</a><ul>${edition.standards.map(standard => `<li class="gr-nav-standard"><a href="#${h(standard.reportAnchor)}" aria-label="${h(standard.label)}">${h(standard.standard)}</a></li>`).join("")}</ul></li>`).join("")}</ul></nav>
<section class="gr-section" id="findings-overview"><h2>Findings register</h2>${model.findings.length ? `<div class="gr-table-region" role="region" aria-label="Findings register; scroll horizontally on narrow screens" tabindex="0"><table class="gr-overview"><caption>Reviewed assessment records, with links to evidence and action details below</caption><thead><tr><th scope="col" class="gr-col-ref">Ref</th><th scope="col">Institution / edition</th><th scope="col">Standard / clause</th><th scope="col" class="gr-col-outcome">Conclusion</th><th scope="col" class="gr-col-count">Evidence</th><th scope="col" class="gr-col-count">Actions</th></tr></thead><tbody>${model.findings.map(finding => {
    const position = findingAnchors.get(finding.id);
    return `<tr><td><a href="#${h(position.anchor)}">F${position.ordinal}</a></td><td>${h(finding.framework.authority)}<br>${h(finding.framework.edition)}</td><td>${h(finding.standard)}<br>${h(finding.framework.clause)}</td><td>${status(finding.conclusion, finding.conclusionLabel)}</td><td>${finding.evidence?.length || 0}</td><td>${finding.actions?.length || 0}</td></tr>`;
  }).join("")}</tbody></table></div>` : '<p class="gr-empty">No reviewed assessment records were retained at issue.</p>'}</section>
${editionGroups.map(edition => `<section class="gr-edition gr-section" id="${h(edition.anchor)}"><div class="gr-edition-title"><h2>${h(edition.authority)} · ${h(edition.edition)}</h2><p>${h(edition.name)}</p></div>${edition.standards.map(standard => `<section class="gr-standard-section" id="${h(standard.reportAnchor)}" data-standard-id="${h(standard.id)}"><h3 class="gr-standard">${h(standard.standard)}</h3><p class="gr-small gr-muted">${standard.scopeBasis === "retained_scope" ? "Standard roster retained at report issue." : "This legacy scope is derived from recorded assessments; complete standard coverage was not retained."} ${standard.findings.length} assessment records · ${h(standard.actions)} linked actions.</p>${standard.findings.length ? standard.findings.map(finding => renderFinding(finding, findingAnchors.get(finding.id))).join("") : '<p class="gr-empty">No reviewed assessment is recorded for this standard. This is an unassessed scope item, not a conformance conclusion.</p>'}</section>`).join("")}</section>`).join("")}
<footer class="gr-footer"><p>Private issued report view · ${h(model.title)} · Report <code>${h(model.id)}</code></p><p>Project <code>${h(project.id)}</code> · Workspace <code>${h(project.workspaceId)}</code> · Revision ${h(project.revision)} · Renderer ${h(model.rendererVersion)}</p><p>Source versions, review records and authored narrative are taken from the issued snapshot. Later project changes do not regenerate this report. Share only through a deliberate client handover or publication decision.</p></footer></div></main></body></html>`;
}
