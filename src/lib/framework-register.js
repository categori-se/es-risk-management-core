import {wbAdbFrameworks} from "./framework-records-wb-adb.js";
import {ifcOtherFrameworks} from "./framework-records-ifc-other.js";
import {ifcMeMatrixDiagnostics, ifcMeMatrixMetadata} from "./ifc-me-matrix-template.js";
import {detailedRequirementManifests} from "./detailed-requirements-data.js";
import {currentAfdbEbrdFrameworks} from "./framework-current-afdb-ebrd.js";

export const frameworkRegistryVersion = "2026-10-23.1";
export const frameworkSourceCheckDate = "2026-10-18";
export const frameworkTopics = [
  {id: "applicability", label: "Which instrument applies", implication: "Record the financing instrument, dates and contractual applicability before assessment."},
  {id: "assessment", label: "Assessment and commitments", implication: "Identify whose duties are assessed and which management or commitment records are needed."},
  {id: "labor", label: "Labor and occupational safety", implication: "Keep worker records, contractor controls and OHS evidence distinct from community safety."},
  {id: "pollution", label: "Pollution and resource efficiency", implication: "Retain sampling methods, permits, applicable limits and versions of technical guidelines."},
  {id: "health_safety", label: "Community health, safety and security", implication: "Separate worker and community exposures, emergency arrangements and security responsibilities."},
  {id: "engagement", label: "Engagement and grievances", implication: "Track disclosure, consultation, feedback and responses throughout the engagement."},
  {id: "land", label: "Land and livelihoods", implication: "Trace displacement, eligibility, entitlements, compensation and livelihood outcomes."},
  {id: "indigenous", label: "Indigenous Peoples and consent", implication: "Check the applicable consultation/consent trigger and evidence; similar terms can have different tests."},
  {id: "biodiversity", label: "Biodiversity and natural resources", implication: "Locate affected habitats, assess impacts and document management and monitoring outcomes."},
  {id: "cultural_heritage", label: "Cultural heritage", implication: "Retain field evidence, consultation, chance-find procedures and relevant consent or access arrangements."},
  {id: "climate", label: "Climate and emissions", implication: "Preserve the applicable trigger, inventory boundary and methodology; safeguards are distinct from corporate reporting."},
  {id: "financial_intermediaries", label: "Financial intermediaries", implication: "Assess the intermediary system and portfolio/subproject duties separately from direct project duties."}
];

function freeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {Object.freeze(value); Object.values(value).forEach(freeze);}
  return value;
}

export const frameworks = freeze([...wbAdbFrameworks, ...ifcOtherFrameworks, ...currentAfdbEbrdFrameworks]);
export const getFramework = id => frameworks.find(framework => framework.id === id);
export const getRequirementManifest = id => detailedRequirementManifests.find(item => item.frameworkId === id);
const privatePacks = new Map();
// This identifies a grouping rule, not file integrity. Original integrity uses SHA256.
const groupingId = value => {let hash = 2166136261; for (const char of value) {hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619);} return (hash >>> 0).toString(16);};

export function prepareDetailedRequirementPack(value) {
  const framework = getFramework(value?.frameworkId);
  if (!framework || value.edition !== framework.edition || !Array.isArray(value.records) || value.records.length > 30000 ||
      !Array.isArray(value.sources) || !value.parserVersion) throw new Error("Invalid or mismatched private requirement library.");
  const pack = structuredClone(value), ids = new Set();
  for (const source of pack.sources) {
    const url = new URL(source.url);
    if (!/^[a-f0-9]{64}$/.test(source.sha256) || !["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid requirement source identity.");
  }
  for (const record of pack.records) {
    const source = pack.sources.find(source => source.id === record.detail?.sourceId);
    if (!record.id || record.id.length > 192 || ids.has(record.id) || !source || source.sha256 !== record.detail.sourceSha256 ||
        !frameworkTopics.some(topic => topic.id === record.topic) || typeof record.detail.sourceText !== "string" ||
        !record.detail.context || !Array.isArray(record.evidence)) throw new Error("Invalid source statement or duplicate identity.");
    ids.add(record.id);
  }
  const groups = new Map();
  // Context-only text remains in the detailed register. Diagnostics group candidate
  // duties by instrument section and topic; membership never transfers conclusions.
  for (const record of pack.records.filter(record => record.detail.classification === "normative_candidate")) {
    const key = `${record.standard}\u0000${record.topic}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  const identity = pack.sources.map(source => source.sha256).sort().join(":") + pack.parserVersion;
  const diagnostics = [...groups.values()].map(members => {
    const first = members[0], topic = frameworkTopics.find(topic => topic.id === first.topic);
    const sourceIds = [...new Set(members.flatMap(member => member.sourceIds))];
    return {id: `diagnostic:${framework.id}:${groupingId(identity + first.standard + first.topic)}`, topic: first.topic,
      standard: first.standard, clause: `conceptual group · ${topic.label}`, title: `${first.standard} · ${topic.label}`,
      prompt: `Assess ${topic.label.toLowerCase()} for this instrument section. Review the individual statements, actors, exceptions and evidence before recording a group conclusion.`,
      evidence: [...new Set(members.flatMap(member => member.evidence))], sourceIds, sources: pack.sources.filter(source => sourceIds.includes(source.id)),
      memberIds: members.map(member => member.id), groupingBasis: "Candidate duties grouped by source standard/section and extraction topic; unreviewed classification. Context is retained in each member definition. No equivalence or automatic member conclusion.",
      coverage: "Conceptual diagnostic of unreviewed source candidates; not complete obligation coverage."};
  });
  return freeze({...pack, diagnostics});
}

export function registerDetailedRequirementPack(value) {
  const pack = prepareDetailedRequirementPack(value);
  privatePacks.set(pack.frameworkId, pack);
  return {records: pack.records.length, groups: pack.diagnostics.length};
}
const topicForIfc = {PS1: "assessment", PS2: "labor", PS3: "pollution", PS4: "health_safety", PS5: "land", PS6: "biodiversity", PS7: "indigenous", PS8: "cultural_heritage"};

const ifcWorkbookChecks = freeze(ifcMeMatrixDiagnostics.map(diagnostic => ({
  id: `ifc_ps_2012:${diagnostic.diagnostic_id}`, topic: topicForIfc[diagnostic.performance_standard] || "assessment",
  standard: diagnostic.performance_standard, clause: diagnostic.paragraph ? `paragraph ${diagnostic.paragraph}` : diagnostic.section,
  title: `${diagnostic.performance_standard} · ${diagnostic.section || diagnostic.diagnostic_id}`,
  prompt: diagnostic.audit_question, evidence: ["Identify dated project evidence and a precise source locator; verify the workbook's clause mapping."],
  sourceIds: [`ifc2012_ps${diagnostic.performance_standard.slice(2)}`], workbook: {name: diagnostic.source_workbook, sheet: diagnostic.source_sheet, row: diagnostic.source_row},
  coverage: "Existing workbook diagnostic; clause mapping has not been revalidated."
})));

export function getAuditChecks(frameworkId, checkSet = "curated") {
  if (checkSet === "detailed") return privatePacks.get(frameworkId)?.records || [];
  if (checkSet === "diagnostic") return privatePacks.get(frameworkId)?.diagnostics || [];
  if (frameworkId === "ifc_ps_2012" && checkSet === "workbook") return ifcWorkbookChecks;
  return checkSet === "curated" ? getFramework(frameworkId)?.checks || [] : [];
}

/** Metadata counts and runtime load state, never a completeness claim. No source text. */
export function getFrameworkCoverage(frameworkId, checkSet = "curated") {
  const framework = getFramework(frameworkId);
  if (!framework || !["curated", "detailed", "diagnostic", "workbook"].includes(checkSet)) throw new Error("Choose a known framework edition and assessment collection.");
  const manifest = getRequirementManifest(frameworkId), pack = privatePacks.get(frameworkId), sourceCoverage = manifest?.coverage || {};
  const supported = checkSet === "curated" || checkSet === "workbook" && frameworkId === "ifc_ps_2012" || ["detailed", "diagnostic"].includes(checkSet) && Boolean(manifest);
  const loaded = supported && (!["detailed", "diagnostic"].includes(checkSet) || Boolean(pack));
  const sourceCorpusCount = manifest?.counts.recordCount || 0, loadedSourceCorpusCount = pack?.records.length || 0;
  const manifestMatchesLoaded = pack && manifest ? loadedSourceCorpusCount === sourceCorpusCount && pack.sources.length === sourceCoverage.sources.length && pack.sources.every(source => sourceCoverage.sources.some(expected => expected.sha256 === source.sha256)) : null;
  const meaning = {curated: "Sourced starter review prompts; these are an incomplete screening collection, not original institutional requirement wording.",
    detailed: "Extracted sentence units include headings, context, definitions and footnotes. Interpretation remains unreviewed; sentence counts are not counts of atomic obligations.",
    diagnostic: "Conceptual groups of unreviewed source candidates. A group conclusion does not assess its individual members or establish cross-framework equivalence.",
    workbook: "Existing IFC M&E workbook diagnostics. Their clause mappings have not been revalidated; these questions are not a complete authoritative requirement library."}[checkSet];
  const warnings = [...new Set([framework.coverage, ...(sourceCoverage.scopeWarnings || []), ...(sourceCoverage.sources || []).flatMap(source => source.warnings || []),
    ...(!supported ? ["This assessment collection has no prepared corpus for the selected framework edition."] : []),
    ...(["detailed", "diagnostic"].includes(checkSet) && !loaded ? ["Published extraction metadata does not prove that a private source pack is installed or loaded in this workspace."] : []),
    ...(manifestMatchesLoaded === false ? ["The loaded pack differs from the public extraction manifest. Confirm its exact source hashes, parser and scope before relying on the published counts."] : [])].filter(Boolean))];
  return freeze({frameworkId, edition: framework.edition, checkSet, supported, selectedSetCount: getAuditChecks(frameworkId, checkSet).length,
    loaded, libraryStatus: sourceCoverage.status || "not_extracted", complete: false, textKind: checkSet === "detailed" ? "source_text" : checkSet === "diagnostic" ? "group" : "review_prompt",
    reviewStatus: "unreviewed", starterCheckCount: framework.checks.length, workbookDiagnosticCount: getAuditChecks(frameworkId, "workbook").length,
    sourceCorpusCount, loadedSourceCorpusCount, normativeCandidateCount: manifest?.counts.normative_candidate || 0,
    loadedNormativeCandidateCount: pack?.records.filter(record => record.detail.classification === "normative_candidate").length || 0,
    sourceDocumentCount: sourceCoverage.sources?.length || 0, sourcePageCount: (sourceCoverage.sources || []).reduce((total, source) => total + (source.pageCount || 0), 0),
    manifestMatchesLoaded, missingSources: structuredClone(sourceCoverage.missingSources || []), excludedDocuments: structuredClone(sourceCoverage.excludedDocuments || []),
    warnings, meaning, conclusionScope: "Approval covers only the engagement's explicitly selected, human-reviewed requirements. It does not certify the full framework or the completeness of this library."});
}

export function getAuditContext(frameworkId, checkId, checkSet = "curated") {
  const framework = getFramework(frameworkId), check = getAuditChecks(frameworkId, checkSet).find(item => item.id === checkId);
  if (!framework || !check) throw new Error("Choose an audit check from the selected framework edition.");
  return requirementContext(framework, check, checkSet, privatePacks.get(frameworkId));
}

/** Build the same retained definition from an explicitly supplied, verified pack.
 * This does not install a process-global library or confer permission to read it. */
export function getRequirementContextFromPack(value, checkId, checkSet = "detailed", {sourcePackSha256} = {}) {
  if (!["detailed", "diagnostic"].includes(checkSet)) throw new Error("Choose a source statement or conceptual group from the exact supplied pack.");
  if (sourcePackSha256 !== undefined && !/^[a-f0-9]{64}$/.test(sourcePackSha256)) throw new Error("Retain the exact source pack SHA256.");
  const pack = prepareDetailedRequirementPack(value), framework = getFramework(pack.frameworkId);
  const check = (checkSet === "detailed" ? pack.records : pack.diagnostics).find(item => item.id === checkId);
  if (!check) throw new Error("Choose an audit check from the selected framework edition.");
  const context = requirementContext(framework, check, checkSet, pack);
  if (sourcePackSha256 !== undefined) context.definition.sourcePackSha256 = sourcePackSha256;
  context.selection = {standard: check.standard, title: check.title || context.framework.clause,
    text: check.detail?.sourceText || check.prompt || context.prompt, textKind: check.detail ? "source_text" : "group"};
  return context;
}

function requirementContext(framework, check, checkSet, pack) {
  const frameworkId = framework.id, checkId = check.id;
  const sourceIds = check.sourceIds?.length ? check.sourceIds : framework.sources.map(source => source.id);
  const workbook = check.workbook ? `Workbook ${check.workbook.name}; sheet ${check.workbook.sheet}; row ${check.workbook.row}. ` : "";
  const context = {
    frameworkId, checkId, checkSet, registryVersion: frameworkRegistryVersion, topic: check.topic,
    prompt: check.prompt, checkedAt: framework.sourceCheckedAt || frameworkSourceCheckDate, coverage: check.coverage || framework.coverage,
    framework: {authority: framework.institution, name: framework.name, edition: framework.edition, clause: `${check.standard}: ${check.clause}`},
    sources: (check.sources || (["detailed", "diagnostic"].includes(checkSet) ? pack.sources : framework.sources).filter(source => sourceIds.includes(source.id))).map(source => ({
      title: source.title, url: source.url, locator: `${workbook}${check.standard}: ${check.clause}`, ...(source.sha256 ? {sha256: source.sha256} : {})
    }))
  };
  if (["detailed", "diagnostic"].includes(checkSet)) {
    const contexts = {};
    context.definition = {id: check.id, frameworkId, edition: framework.edition, parserVersion: pack.parserVersion,
      reviewStatus: "unreviewed", ...(check.detail ? {detail: structuredClone(check.detail)} : {
        groupingBasis: check.groupingBasis, memberIds: [...check.memberIds],
        members: check.memberIds.map(id => {
          const member = pack.records.find(record => record.id === id), detail = structuredClone(member.detail);
          const key = detail.context.parentId;
          if (key) {contexts[key] = detail.context; delete detail.context; detail.contextRef = key;}
          return {id: member.id, detail};
        }), contexts})};
  }
  return context;
}

export const auditCheckSets = frameworkId => [{id: "curated", label: "Sourced starter checks", count: getAuditChecks(frameworkId).length},
  ...(getRequirementManifest(frameworkId) ? [{id: "detailed", label: "Detailed source statements (unreviewed)", count: getRequirementManifest(frameworkId).counts.recordCount},
    {id: "diagnostic", label: "Conceptual groups of candidate duties", count: getAuditChecks(frameworkId, "diagnostic").length || "local library"}] : []),
  ...(frameworkId === "ifc_ps_2012" ? [{id: "workbook", label: "Existing IFC M&E workbook diagnostics", count: ifcMeMatrixMetadata.diagnostic_count}] : [])];

const csvCell = value => {
  const text = String(value ?? "");
  // Spreadsheet applications must treat exported source content as text.
  return `"${(/^[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
};
export function comparisonCsv(ids, topic = "all") {
  const selected = ids.map(getFramework).filter(Boolean);
  const rows = [["Topic", ...selected.map(framework => `${framework.institution} — ${framework.edition}`), "Practical implication"]];
  for (const item of frameworkTopics.filter(item => topic === "all" || item.id === topic)) {
    rows.push([item.label, ...selected.map(framework => {
      const cell = framework.comparison[item.id];
      const sources = framework.sources.filter(source => cell?.sourceIds?.includes(source.id)).map(source => source.url);
      return `${cell?.summary || "Not yet mapped; verify the source."} | ${sources.join("; ")}`;
    }), item.implication]);
  }
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
