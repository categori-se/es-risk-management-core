import {createProjectHandoverService} from './engagement-handover.mjs';
import {createConsultancyDemonstration} from './consultancy-demonstration.mjs';
import {createEsAiWorkspaceApi} from './es-ai-workspace-api.mjs';
import {createResourceAiProvider} from './resource-ai-provider.mjs';
import {createResourceLibraryScheduler} from './resource-library-scheduler.mjs';
import {createResourceLibrary} from './resource-library.mjs';
import {reconcileResourceSeed} from './resource-library-seed.mjs';
import {projectInstrumentWorkflow,instrumentBibliographyCommand,renderInstrumentWorkflowHtml} from '../src/lib/thematic-instrument-workflows.js';
import {engagementReportTemplates,renderEngagementTemplateScaffold,projectEngagementReportTemplate,renderEngagementReportTemplateHtml} from '../src/lib/engagement-report-templates.js';
import {createServer} from "node:http";
import {createHash,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {realpathSync, readdirSync, lstatSync, existsSync} from "node:fs";
import {resolve, dirname, basename, join, sep} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {localWorkspaceMaxJsonBytes} from "./local-workspace-store.mjs";
import {createAccountWorkspace} from "./local-account-workspace.mjs";
import {createPersonalProjectSpaces} from "./personal-project-space.mjs";
import {createProjectIdentityDirectory} from "./project-identities.mjs";
import {captureSource, inspectSource} from "./source-intake.mjs";
import {getFramework, registerDetailedRequirementPack} from "../src/lib/framework-register.js";
import {buildGapReportModel} from "./gap-report-model.mjs";
import {buildDocumentPreview,buildDocumentPassagePreview,normalizeDocumentPassageRequest} from "./document-preview.mjs";
import {readLocalPolicyOriginal} from "./policy-originals.mjs";
import {createPolicyCoverageReviewStore} from "./policy-coverage-review.mjs";
import {IFC_PS5_COVERAGE_SCOPE,policyStandardSourcePermissions} from "./policy-standard-coverage.mjs";
import {createReviewSignoffPolicyStore} from './review-signoff-policy.mjs';
import {createLocalProfessionalQualification} from './local-professional-qualification.mjs';
import {buildSpatialPreview, isSpatialSource} from "./spatial-preview.mjs";
import {parseGeoJsonData,serializeGeoJsonData} from '../src/lib/geojson-editing.js';
import {publicationReaderCss, renderPublicationFragment, publicationExport} from "./publication-renderers.mjs";
import {createResearchArchive} from "./research-archive.mjs";
import {validateMasterPack, buildMasterCompliance, masterFramework, masterArchiveCollection, masterComplianceExport} from "./master-compliance.mjs";
import {createLocalOversightStore, readLocalOversightProject} from "./oversight-local.mjs";
import {createLocalOversightConsolidationStore} from "./oversight-consolidation-local.mjs";
import {renderOversightReportHtml, renderOversightWorkbook} from "./oversight-report.mjs";
import {createLocalOversightComparisonService} from "./oversight-comparison-local.mjs";
import {renderOversightComparisonHtml, renderOversightComparisonWorkbook} from "./oversight-comparison-report.mjs";
import {exportEngagementSnapshot} from "./engagement-exports.mjs";
import {createEngagementAssistant, indexEngagementSources, retrieveEngagementPassages, selectEngagementAssistancePassages} from "./engagement-assistance.mjs";
import {createEngagementEvidenceIndexCache,mergeEngagementSourceIndexes} from "./engagement-evidence-index.mjs";
import {monitoringAttention} from "../src/lib/engagement-domain.js";
import {prepareEngagementSourceReview} from './engagement-source-review.mjs';
import {prepareEngagementDocumentClassification} from "./engagement-analysis.mjs";
import {compareEngagementDocuments,prepareEngagementDocumentRelation} from "./document-relations.mjs";
import {createFieldTransferStore} from "./field-transfer.mjs";
import {createClientTemplateStudio,clientTemplateLimits} from './client-template-studio.mjs';
import {createLocalAssignmentPilot} from './local-assignment-pilot.mjs';
import {createLocalPublicPs5Evaluation} from './local-public-ps5-evaluation.mjs';
import {createMonitoringTemplateIngestion} from './monitoring-template-ingestion.mjs';
import {evaluateResourceRight} from '../src/lib/resource-library.js';
import {assertFieldDeviceLease, fieldDevicePolicyDigestInput} from "../src/lib/field-device-policy.js";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fail = (message, status = 400) => Object.assign(new Error(message), {status});
const maximumBody = localWorkspaceMaxJsonBytes;
const assets = new Map([
  ["/compact-interface.css", ["src/styles/compact-interface.css", "text/css; charset=utf-8"]],
  ["/product-overview.js", ["src/components/product-overview.js", "text/javascript; charset=utf-8"]],
  ["/consultancy-demo.js", ["src/components/consultancy-demo.js", "text/javascript; charset=utf-8"]],
  ["/product-overview.css", ["src/styles/product-overview.css", "text/css; charset=utf-8"]],
  ["/data/product-editions.json", ["src/data/product-editions.json", "application/json; charset=utf-8"]],
  ["/data/service-offerings.json", ["src/data/service-offerings.json", "application/json; charset=utf-8"]],
  ["/data/consultancy-demo.json", ["src/data/consultancy-demo.json", "application/json; charset=utf-8"]],
  ["/data/product-editions.js", ["src/data/product-editions.js", "text/javascript; charset=utf-8"]],
  ["/data/service-offerings.js", ["src/data/service-offerings.js", "text/javascript; charset=utf-8"]],
  ["/data/consultancy-demo.js", ["src/data/consultancy-demo.js", "text/javascript; charset=utf-8"]],
  ["/data/consultancy-output-preview.js", ["src/data/consultancy-output-preview.js", "text/javascript; charset=utf-8"]],
  ["/lib/consultancy-output-preview.js", ["src/lib/consultancy-output-preview.js", "text/javascript; charset=utf-8"]],
  ["/project-ai-assistant.js", ["src/components/project-ai-assistant.js", "text/javascript; charset=utf-8"]],
  ["/project-ai-assistant.css", ["src/styles/project-ai-assistant.css", "text/css; charset=utf-8"]],
  ["/lib/es-ai-skills.js", ["src/lib/es-ai-skills.js", "text/javascript; charset=utf-8"]],
  ["/lib/es-ai-contracts.js", ["src/lib/es-ai-contracts.js", "text/javascript; charset=utf-8"]],
  ["/resource-library.js", ["src/components/resource-library.js", "text/javascript; charset=utf-8"]],
  ["/public-ps5-evaluation.js", ["src/components/public-ps5-evaluation.js", "text/javascript; charset=utf-8"]],
  ["/engagement-bibliography.js", ["src/components/engagement-bibliography.js", "text/javascript; charset=utf-8"]],
  ["/resource-library.css", ["src/styles/resource-library.css", "text/css; charset=utf-8"]],
  ["/lib/resource-library.js", ["src/lib/resource-library.js", "text/javascript; charset=utf-8"]],
  ["/lib/engagement-bibliography.js", ["src/lib/engagement-bibliography.js", "text/javascript; charset=utf-8"]],
  ["/schemas/resource-library.schema.json", ["schemas/resource-library.schema.json", "application/schema+json; charset=utf-8"]],
  ["/schemas/generic-monitoring-report.schema.json", ["schemas/generic-monitoring-report.schema.json", "application/schema+json; charset=utf-8"]],
  ["/local-workspace.js", ["src/components/local-workspace.js", "text/javascript; charset=utf-8"]],
  ["/project-lifecycle-workspace.js", ["src/components/project-lifecycle-workspace.js", "text/javascript; charset=utf-8"]],
  ["/lib/project-lifecycle.js", ["src/lib/project-lifecycle.js", "text/javascript; charset=utf-8"]],
  ["/project-lifecycle.css", ["src/styles/project-lifecycle.css", "text/css; charset=utf-8"]],
  ["/schemas/project-lifecycle.schema.json", ["schemas/project-lifecycle.schema.json", "application/schema+json; charset=utf-8"]],
  ["/work-queue.js", ["src/components/work-queue.js", "text/javascript; charset=utf-8"]],
  ["/engagement-workspace.js", ["src/components/engagement-workspace.js", "text/javascript; charset=utf-8"]],
  ["/source-coverage.js", ["src/components/source-coverage.js", "text/javascript; charset=utf-8"]],
  ["/lib/template-authority.js", ["src/lib/template-authority.js", "text/javascript; charset=utf-8"]],
  ["/assignment-guide.js", ["src/components/assignment-guide.js", "text/javascript; charset=utf-8"]],
  ["/assignment-pilot.js", ["src/components/assignment-pilot.js", "text/javascript; charset=utf-8"]],
  ["/lib/professional-qualification.js", ["src/lib/professional-qualification.js", "text/javascript; charset=utf-8"]],
  ["/professional-qualification.js", ["src/components/professional-qualification.js", "text/javascript; charset=utf-8"]],
  ["/lib/professional-qualification-workbench.js", ["src/lib/professional-qualification-workbench.js", "text/javascript; charset=utf-8"]],
  ["/lib/source-form-acceptance.js", ["src/lib/source-form-acceptance.js", "text/javascript; charset=utf-8"]],
  ["/report-template-workbench.js", ["src/components/report-template-workbench.js", "text/javascript; charset=utf-8"]],
  ["/monitoring-template-library.js", ["src/components/monitoring-template-library.js", "text/javascript; charset=utf-8"]],
  ["/client-template-studio.js", ["src/components/client-template-studio.js", "text/javascript; charset=utf-8"]],
  ['/review-signoff-settings.js',['src/components/review-signoff-settings.js','text/javascript; charset=utf-8']],
  ['/lib/review-signoff-policy.js',['src/lib/review-signoff-policy.js','text/javascript; charset=utf-8']],
  ["/lib/client-template-bindings.js", ["src/lib/client-template-bindings.js", "text/javascript; charset=utf-8"]],
  ["/lib/client-template-extensions.js", ["src/lib/client-template-extensions.js", "text/javascript; charset=utf-8"]],
  ["/schemas/client-template-studio.schema.json", ["schemas/client-template-studio.schema.json", "application/schema+json; charset=utf-8"]],
  ["/external-reference-register.js", ["src/components/external-reference-register.js", "text/javascript; charset=utf-8"]],
  ["/authenticated-engagement-directory.js", ["src/components/authenticated-engagement-directory.js", "text/javascript; charset=utf-8"]],
  ["/authenticated-monitoring-case.js", ["src/components/authenticated-monitoring-case.js", "text/javascript; charset=utf-8"]],
  ["/authenticated-engagement-invitations.js", ["src/components/authenticated-engagement-invitations.js", "text/javascript; charset=utf-8"]],
  ["/lib/monitoring-case-model.js", ["src/lib/monitoring-case-model.js", "text/javascript; charset=utf-8"]],
  ["/lib/invitation-return.js", ["src/lib/invitation-return.js", "text/javascript; charset=utf-8"]],
  ["/authenticated-source-intake.js", ["src/components/authenticated-source-intake.js", "text/javascript; charset=utf-8"]],
  ["/authenticated-successor-import.js", ["src/components/authenticated-successor-import.js", "text/javascript; charset=utf-8"]],
  ["/lib/authenticated-successor-import.js", ["src/lib/authenticated-successor-import.js", "text/javascript; charset=utf-8"]],
  ["/engagement-workspace.css", ["src/styles/engagement-workspace.css", "text/css; charset=utf-8"]],
  ["/lib/engagement-domain.js", ["src/lib/engagement-domain.js", "text/javascript; charset=utf-8"]],
  ["/lib/engagement-report-templates.js", ["src/lib/engagement-report-templates.js", "text/javascript; charset=utf-8"]],
  ["/schemas/engagement-exchange.schema.json", ["schemas/engagement-exchange.schema.json", "application/schema+json; charset=utf-8"]],
  ["/schemas/document-classification.schema.json", ["schemas/document-classification.schema.json", "application/schema+json; charset=utf-8"]],
  ["/schemas/document-revision-relation.schema.json", ["schemas/document-revision-relation.schema.json", "application/schema+json; charset=utf-8"]],
  ["/schemas/engagement-successor-archive.schema.json", ["schemas/engagement-successor-archive.schema.json", "application/schema+json; charset=utf-8"]],
  ["/data/engagement-concepts.jsonld", ["src/data/engagement-concepts.jsonld", "application/ld+json; charset=utf-8"]],
  ["/field-capture.js", ["src/components/field-capture.js", "text/javascript; charset=utf-8"]],
  ["/local-fieldwork.js", ["src/components/local-fieldwork.js", "text/javascript; charset=utf-8"]],
  ["/engagement-field-context.js", ["src/components/engagement-field-context.js", "text/javascript; charset=utf-8"]],
  ["/fieldwork-sw.js", ["src/components/fieldwork-sw.js", "text/javascript; charset=utf-8"]],
  ["/engagement-monitoring.js", ["src/components/engagement-monitoring.js", "text/javascript; charset=utf-8"]],
  ["/monitoring-private.js", ["src/components/monitoring-private.js", "text/javascript; charset=utf-8"]],
  ["/lib/monitoring-protection.js", ["src/lib/monitoring-protection.js", "text/javascript; charset=utf-8"]],
  ["/lib/field-drafts.js", ["src/lib/field-drafts.js", "text/javascript; charset=utf-8"]],
  ["/lib/field-disclosure.js", ["src/lib/field-disclosure.js", "text/javascript; charset=utf-8"]],
  ["/lib/field-transfer.js", ["src/lib/field-transfer.js", "text/javascript; charset=utf-8"]],
  ["/lib/field-record-details.js", ["src/lib/field-record-details.js", "text/javascript; charset=utf-8"]],
  ["/lib/field-device-policy.js", ["src/lib/field-device-policy.js", "text/javascript; charset=utf-8"]],
  ["/lib/document-classification.js", ["src/lib/document-classification.js", "text/javascript; charset=utf-8"]],
  ["/lib/document-relations.js", ["src/lib/document-relations.js", "text/javascript; charset=utf-8"]],
  ["/lib/engagement-external-reference.js", ["src/lib/engagement-external-reference.js", "text/javascript; charset=utf-8"]],
  ["/document-comparison.js", ["src/components/document-comparison.js", "text/javascript; charset=utf-8"]],
  ["/components/document-comparison.js", ["src/components/document-comparison.js", "text/javascript; charset=utf-8"]],
  ["/offline-review.js", ["src/components/offline-review.js", "text/javascript; charset=utf-8"]],
  ["/lib/offline-review.js", ["src/lib/offline-review.js", "text/javascript; charset=utf-8"]],
  ["/field-capture.css", ["src/styles/field-capture.css", "text/css; charset=utf-8"]],
  ["/local-oversight.js", ["src/components/local-oversight.js", "text/javascript; charset=utf-8"]],
  ["/local-oversight-consolidation.js", ["src/components/local-oversight-consolidation.js", "text/javascript; charset=utf-8"]],
  ["/local-oversight-comparison.js", ["src/components/local-oversight-comparison.js", "text/javascript; charset=utf-8"]],
  ["/oversight-comparison-workspace.js", ["src/components/oversight-comparison-workspace.js", "text/javascript; charset=utf-8"]],
  ["/oversight-comparison.css", ["src/styles/oversight-comparison.css", "text/css; charset=utf-8"]],
  ["/local-oversight-backup.js", ["src/components/local-oversight-backup.js", "text/javascript; charset=utf-8"]],
  ["/oversight-consolidation-workspace.js", ["src/components/oversight-consolidation-workspace.js", "text/javascript; charset=utf-8"]],
  ["/oversight-consolidation.css", ["src/styles/oversight-consolidation.css", "text/css; charset=utf-8"]],
  ["/oversight-workspace.js", ["src/components/oversight-workspace.js", "text/javascript; charset=utf-8"]],
  ["/oversight-workspace.css", ["src/styles/oversight-workspace.css", "text/css; charset=utf-8"]],
  ["/lib/oversight-model.js", ["src/lib/oversight-model.js", "text/javascript; charset=utf-8"]],
  ["/local-workspace.css", ["src/styles/local-workspace.css", "text/css; charset=utf-8"]],
  ["/framework-workspace.js", ["src/components/framework-workspace.js", "text/javascript; charset=utf-8"]],
  ["/policy-coverage-workbench.js", ["src/components/policy-coverage-workbench.js", "text/javascript; charset=utf-8"]],
  ["/framework-workspace.css", ["src/styles/framework-workspace.css", "text/css; charset=utf-8"]],
  ["/source-intake.js", ["src/components/source-intake.js", "text/javascript; charset=utf-8"]],
  ["/source-intake.css", ["src/styles/source-intake.css", "text/css; charset=utf-8"]],
  ["/project-documents.js", ["src/components/project-documents.js", "text/javascript; charset=utf-8"]],
  ["/project-directory.js", ["src/components/project-directory.js", "text/javascript; charset=utf-8"]],
  ["/project-file-sharing.js", ["src/components/project-file-sharing.js", "text/javascript; charset=utf-8"]],
  ["/personal-project-workspace.js", ["src/components/personal-project-workspace.js", "text/javascript; charset=utf-8"]],
  ["/file-manager.js", ["src/components/file-manager.js", "text/javascript; charset=utf-8"]],
  ["/master-compliance.js", ["src/components/master-compliance.js", "text/javascript; charset=utf-8"]],
  ["/file-viewer.js", ["src/components/file-viewer.js", "text/javascript; charset=utf-8"]],
  ["/file-viewer.css", ["src/styles/file-viewer.css", "text/css; charset=utf-8"]],
  ["/engagement-mandate-views.js", ["src/components/engagement-mandate-views.js", "text/javascript; charset=utf-8"]],
  ["/engagement-assessment-views.js", ["src/components/engagement-assessment-views.js", "text/javascript; charset=utf-8"]],
  ["/engagement-assistance-views.js", ["src/components/engagement-assistance-views.js", "text/javascript; charset=utf-8"]],
  ["/project-handover.js", ["src/components/project-handover.js", "text/javascript; charset=utf-8"]],
  ["/source-review-workbench.js", ["src/components/source-review-workbench.js", "text/javascript; charset=utf-8"]],
  ["/research-archive.js", ["src/components/research-archive.js", "text/javascript; charset=utf-8"]],
  ["/project-documents.css", ["src/styles/project-documents.css", "text/css; charset=utf-8"]],
  ["/spatial-preview.js", ["src/components/spatial-preview.js", "text/javascript; charset=utf-8"]],
  ["/spatial-preview.css", ["src/styles/spatial-preview.css", "text/css; charset=utf-8"]],
  ["/spatial-editor.js", ["src/components/spatial-editor.js", "text/javascript; charset=utf-8"]],
  ["/spatial-editor.css", ["src/styles/spatial-editor.css", "text/css; charset=utf-8"]],
  ["/geojson-editing.js", ["src/lib/geojson-editing.js", "text/javascript; charset=utf-8"]],
  ["/lib/geojson-editing.js", ["src/lib/geojson-editing.js", "text/javascript; charset=utf-8"]],
  ["/publication-manager.js", ["src/components/publication-manager.js", "text/javascript; charset=utf-8"]],
  ["/publication-manager.css", ["src/styles/publication-manager.css", "text/css; charset=utf-8"]],
  ["/publication-studio.css", ["src/styles/publication-studio.css", "text/css; charset=utf-8"]],
  ["/publication-studio.js", ["src/components/publication-studio.js", "text/javascript; charset=utf-8"]],
  ["/publication-reader.js", ["src/components/publication-reader.js", "text/javascript; charset=utf-8"]],
  ["/gap-report-view.js", ["src/components/gap-report-view.js", "text/javascript; charset=utf-8"]],
  ["/gap-report.css", ["src/styles/gap-report.css", "text/css; charset=utf-8"]],
  ["/licensing-page.js", ["src/components/licensing-page.js", "text/javascript; charset=utf-8"]],
  ["/licenses.css", ["src/styles/licensing.css", "text/css; charset=utf-8"]],
  ["/data/software-notices.txt", ["src/data/software-notices.txt", "text/plain; charset=utf-8"]],
  ...["framework-register", "framework-afdb-2013", "framework-current-afdb-ebrd", "framework-records-wb-adb", "framework-records-ifc-other", "professional-workflows", "ifc-me-matrix-template", "detailed-requirements-data", "sector-risk-profiles", "concept-tags", "source-metadata", "publication-records", "publication-rendering", "publication-transport", "source-provenance", "source-provenance-core", "source-provenance-records", "source-reference-provenance", "source-reference-records", "software-attributions"].map(name =>
    [`/lib/${name}.js`, [`src/lib/${name}.js`, "text/javascript; charset=utf-8"]]),
  ["/theme.css", ["vendor/app-core/styles/theme.css", "text/css; charset=utf-8"]]
]);

// Distribution tooling follows the actual local routing table rather than
// copying unrelated hosted entry points or private deployment configuration.
export const localWorkspaceAssetPaths = Object.freeze([...new Set([...assets.values()].map(([path]) => path))]);

const shell = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>E&amp;S Review · ESIA local</title><link rel="stylesheet" href="/project-ai-assistant.css"><link rel="stylesheet" href="/resource-library.css"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/local-workspace.css"><link rel="stylesheet" href="/framework-workspace.css"><link rel="stylesheet" href="/source-intake.css"><link rel="stylesheet" href="/project-documents.css"><link rel="stylesheet" href="/spatial-preview.css"><link rel="stylesheet" href="/publication-manager.css"><link rel="stylesheet" href="/publication-studio.css"><link rel="stylesheet" href="/publication-reader.css">
<link rel="stylesheet" href="/file-viewer.css"><link rel="stylesheet" href="/licenses.css"><link rel="stylesheet" href="/oversight-workspace.css"><link rel="stylesheet" href="/oversight-consolidation.css"><link rel="stylesheet" href="/oversight-comparison.css"></head><body class="local-workspace-page"><main id="local-workspace"><h1>E&amp;S Review</h1><p>Loading your local workspace…</p></main><footer><a href="/lifecycle">Project lifecycle and financing</a> · <a href="/licenses">Licensing, attribution and source records</a></footer>
<link rel="stylesheet" href="/field-capture.css"><link rel="stylesheet" href="/engagement-workspace.css"><link rel="stylesheet" href="/project-lifecycle.css"><link rel="stylesheet" href="/product-overview.css"><link rel="stylesheet" href="/compact-interface.css"><script type="module" src="/start.js"></script></body></html>`;
const startup = `const root = document.querySelector('#local-workspace');
const view = {'/frameworks':'compare','/audits':'audits','/practice':'workflows','/sectors':'sectors'}[location.pathname];
if (location.pathname === '/engagements' && new URLSearchParams(location.search).get('mode') === 'authenticated') {root.replaceChildren(); const message=document.createElement('p');message.setAttribute('role','alert');message.textContent='Open this invitation in the signed-in E&S Review workspace where it was issued. This installation keeps your local project records.';root.append(message);}
else if (location.pathname === '/assistant') {const {mountProjectAiAssistant}=await import('/project-ai-assistant.js');mountProjectAiAssistant(root);}
else if (location.pathname === '/product') {const {mountProductOverview}=await import('/product-overview.js');mountProductOverview(root);}
else if (location.pathname === '/demo') {const {mountConsultancyDemo}=await import('/consultancy-demo.js');mountConsultancyDemo(root,{localProfile:true});}
else if (location.pathname === '/lifecycle') {const {mountProjectLifecycleWorkspace}=await import('/project-lifecycle-workspace.js');mountProjectLifecycleWorkspace(root);}
else if (location.pathname === '/engagements') {const {mountEngagementWorkspace} = await import('/engagement-workspace.js'); mountEngagementWorkspace(root);}
else if (['/library','/resource-portal','/templates'].includes(location.pathname)) {const {mountResourceLibrary}=await import('/resource-library.js');mountResourceLibrary(root);}
else if (location.pathname === '/fieldwork') {const {mountLocalFieldwork} = await import('/local-fieldwork.js'); mountLocalFieldwork(root);}
else if (location.pathname === '/oversight') {const {mountLocalOversight} = await import('/local-oversight.js'); mountLocalOversight(root);}
else if (location.pathname === '/oversight-consolidation') {const {mountLocalOversightConsolidation} = await import('/local-oversight-consolidation.js'); mountLocalOversightConsolidation(root);}
else if (location.pathname === '/oversight-comparison') {const {mountLocalOversightComparison} = await import('/local-oversight-comparison.js'); mountLocalOversightComparison(root);}
else if (location.pathname === '/oversight-backup') {const {mountLocalOversightBackup} = await import('/local-oversight-backup.js'); mountLocalOversightBackup(root);}
else if (location.pathname === '/publications') {const {mountPublicationStudio} = await import('/publication-studio.js'); mountPublicationStudio(root);}
else if (location.pathname === '/licenses') {const {renderLicensingPage} = await import('/licensing-page.js'); root.replaceChildren(renderLicensingPage());}
else if (location.pathname === '/files') {const {mountFileManager} = await import('/file-manager.js'); mountFileManager(root);}
else if (location.pathname === '/master') {const {mountMasterCompliance} = await import('/master-compliance.js'); mountMasterCompliance(root);}
else if (location.pathname === '/project-space') {const {mountPersonalProjectWorkspace} = await import('/personal-project-workspace.js'); mountPersonalProjectWorkspace(root, {identityId:new URLSearchParams(location.search).get('identity')});}
else if (location.pathname === '/research-archive') {const {mountResearchArchive} = await import('/research-archive.js'); mountResearchArchive(root);}
else if (view) {const {mountFrameworkWorkspace} = await import('/framework-workspace.js'); mountFrameworkWorkspace(root, {view, local:true});}
else {const {mountLocalWorkspace} = await import('/local-workspace.js'); mountLocalWorkspace(root);}`;
const reportShell = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gap analysis report</title><link rel="stylesheet" href="/gap-report.css"></head><body><main id="gap-report-loading"><h1>Gap analysis report</h1><p role="status">Opening the issued local report…</p></main><script type="module" src="/gap-report-view.js"></script></body></html>`;

function physicalDirectory(directory) {
  try {return realpathSync(directory);}
  catch (error) {
    const parent = dirname(directory);
    if (error.code !== "ENOENT" || parent === directory) throw error;
    return join(physicalDirectory(parent), basename(directory));
  }
}

async function jsonBody(request,limit=maximumBody) {
  if (!request.headers["content-type"]?.startsWith("application/json")) throw fail("Send JSON for this operation.", 415);
  let length = 0;
  const chunks = [];
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw fail(`The local request exceeds ${Math.round(limit/1024/1024*100)/100} MiB.`, 413);
    chunks.push(chunk);
  }
  try {
    const bytes = Buffer.concat(chunks), input = JSON.parse(bytes.toString("utf8"));
    if (input === null || typeof input !== "object" || Array.isArray(input)) throw fail("The request must contain a JSON object.");
    // Peek only to select the new command's strict parser. Parse its original
    // bytes again before using any values: JSON.parse alone can round numeric
    // attributes or discard duplicate members. This covers /commands too.
    if (input.command?.type === 'source-geojson-edit') return parseGeoJsonData(bytes, {maxBytes:3 * 1024 * 1024});
    return input;
  }
  catch (error) {if (error.status === 422) throw error;throw fail("The request must contain valid JSON.");}
}

async function enrichSpatialInspection(staged) {
  if (typeof staged.contentBase64 !== "string" || !isSpatialSource({filename: staged.filename, mediaType: staged.mediaType, bytes: Buffer.from(staged.contentBase64, "base64")})) return staged;
  try {staged.spatial = await buildSpatialPreview(Buffer.from(staged.contentBase64, "base64"), staged);}
  catch (error) {
    const warning = error.status === 422 ? error.message : "This spatial format could not be previewed on this device.";
    staged.spatial = {format: "Spatial source", status: "unavailable", crs: "Not established", bounds: null, features: [], warnings: [warning]};
    staged.metadata.extraction.warnings.push(`Spatial preview unavailable: ${warning} The original can still be saved.`);
  }
  const spatial = staged.spatial;
  const observed = {format: spatial.format, previewStatus: spatial.status,
    ...(typeof spatial.crs === "string" ? {crs: spatial.crs} : {}),
    ...(typeof spatial.crsOrigin === "string" ? {crsOrigin: spatial.crsOrigin} : {}),
    ...(typeof spatial.coordinateBasis === "string" ? {coordinateBasis: spatial.coordinateBasis} : {}),
    ...(typeof spatial.parserVersion === "string" ? {spatialParserVersion: spatial.parserVersion} : {}),
    ...(Array.isArray(spatial.bounds) ? {bounds: spatial.bounds} : {}),
    ...(Number.isSafeInteger(spatial.featureCount) ? {featureCount: spatial.featureCount} : {}),
    ...(Number.isSafeInteger(spatial.coordinateCount) ? {coordinateCount: spatial.coordinateCount} : {}),
    ...(spatial.geometryTypes && !Array.isArray(spatial.geometryTypes) ? {geometryTypes: spatial.geometryTypes} : {})};
  staged.detected = {...staged.detected, ...observed};
  staged.metadata.extraction.detected = {...staged.metadata.extraction.detected, ...observed};
  staged.metadata.extraction.warnings = [...new Set([...staged.metadata.extraction.warnings, ...(spatial.warnings || []).map(warning => `Spatial preview: ${warning}`)])].slice(0, 20);
  staged.metadata.extraction.fieldSources = {...staged.metadata.extraction.fieldSources,
    "spatial.crs": spatial.crsOrigin || "Source CRS not established",
    ...(Array.isArray(spatial.bounds) ? {"spatial.bounds": `${spatial.parserVersion || "esia-spatial-preview/1"}: derived from retained coordinates, without reprojection`} : {})};
  return staged;
}

/** Single local owner. No cross-origin bridge, cloud fallback, or arbitrary static paths. */
export function createLocalWorkspaceServer({directory = join(appRoot, ".local-workspace"), store, capture = captureSource, inspect = inspectSource, engagementAssistant, projectAiOptions,clientTemplateAssistantFactory,clientTemplateNativeFactory} = {}) {
  const dataPath = physicalDirectory(resolve(directory));
  for (const publicationRoot of [join(appRoot, "src"), join(appRoot, "dist")]) {
    const boundary = physicalDirectory(publicationRoot);
    if (dataPath === boundary || dataPath.startsWith(`${boundary}${sep}`)) {
      throw fail("Keep the live workspace outside Framework source and build output.");
    }
  }
  const workspace = createAccountWorkspace({directory: dataPath, defaultStore: store});
  const assignmentPilot=createLocalAssignmentPilot({workspace,directory:join(dataPath,'assignment-pilot')});
  const resourceAi=createResourceAiProvider();
  let resourceService, resourceReady,resourceScheduler;
  async function library({seed=true}={}) {
    if(!resourceReady)resourceReady=(async()=>{
      const shippedResourceCatalog=JSON.parse(await readFile(join(appRoot,'src/data/resource-library-catalog.json'),'utf8'));
      resourceService=createResourceLibrary({directory:join(dataPath,'resource-library'),assistant:resourceAi.propose,shippedInstruments:shippedResourceCatalog.instruments});
      if(seed)await reconcileResourceSeed({library:resourceService,seed:shippedResourceCatalog,requireSeedLineage:true,preserveLocalMappingEditions:true});
      resourceScheduler=createResourceLibraryScheduler({library:resourceService});await resourceScheduler.configure();
      return resourceService;
    })().catch(error=>{resourceReady=undefined;throw error;});
    return resourceReady;
  }
  const projectAi = createEsAiWorkspaceApi({directory:join(dataPath,'project-ai'),workspace,getLibrary:library,...projectAiOptions});
  const fieldTransfers = createFieldTransferStore({directory:join(dataPath,"field-transfers")});
  function applyFieldCapture(scoped,id,expectedRevision,record,{deviceLease}={}){
    const context=record.links?.context || {}, monitored=["engagementId","programId","cycleId","missionId"].some(key=>context[key]);
    const graphFields={requirementIds:"requirements",findingIds:"findings",grievanceIds:"events",commitmentIds:"obligations",monitoringObligationIds:"monitoringObligations",engagementActionIds:"actions"};
    if(deviceLease&&!context.engagementId)throw fail("A device lease requires its owning engagement context.");
    for(const field of [...Object.keys(graphFields),"siteIds","observationIds"])if(record.links?.[field]!==undefined&&(!Array.isArray(record.links[field])||record.links[field].length>30||record.links[field].some(value=>typeof value!=="string")))throw fail("Use bounded lists of existing related field records.");
    if((Object.keys(graphFields).some(key=>record.links?.[key]?.length)||record.links?.siteIds?.length)&&!context.engagementId)throw fail("Related engagement records require the owning engagement context.");
    if(monitored){
      if(!context.engagementId)throw fail("A monitoring capture must identify its owning engagement.");
      const engagement=scoped.engagements().get(context.engagementId);
      if(engagement.projectId!==id)throw fail("This field mission belongs to another source project.",404);
      assertFieldDeviceLease(engagement.devicePolicy,deviceLease,{scope:{accountId:engagement.accountId,projectId:id,engagementId:engagement.id},policySha256:engagement.devicePolicy===undefined?null:createHash("sha256").update(fieldDevicePolicyDigestInput(engagement.devicePolicy)).digest("hex"),sensitivity:record.sensitivity,includesOriginals:Boolean(record.attachments?.length)});
      const program=context.programId&&engagement.programs?.find(item=>item.id===context.programId);
      if(context.programId&&!program)throw fail("Select a monitoring program in this engagement.",404);
      const cycle=context.cycleId&&engagement.cycles?.find(item=>item.id===context.cycleId);
      if(context.cycleId&&(!cycle||context.programId&&cycle.programId!==context.programId))throw fail("Select a reporting cycle in this monitoring program.",404);
      const mission=context.missionId&&engagement.missions?.find(item=>item.id===context.missionId);
      if(context.missionId&&(!mission||context.programId&&mission.programId!==context.programId||context.cycleId&&mission.cycleId!==context.cycleId))throw fail("Select a field mission in this program and cycle.",404);
      const owningProgram=context.programId||cycle?.programId||mission?.programId;
      for(const [field,collection] of Object.entries(graphFields)) for(const linkedId of record.links?.[field]||[]){
        const target=engagement[collection]?.find(item=>item.id===linkedId);
        const targetProgram=target?.programId||(target?.cycleId&&engagement.cycles?.find(item=>item.id===target.cycleId)?.programId);
        if(!target||field==="grievanceIds"&&target.kind!=="grievance"||owningProgram&&targetProgram&&targetProgram!==owningProgram)throw fail("Select related records in this field capture's owning engagement and program.",404);
      }
      const missions=(engagement.missions||[]).filter(item=>(!owningProgram||item.programId===owningProgram)&&(!context.missionId||item.id===context.missionId));
      for(const linkedId of record.links?.siteIds||[])if(!missions.some(item=>item.monitoringPoints?.some(point=>point.id===linkedId)))throw fail("Select monitoring points in this field mission and program.",404);
    }
    // The shared source store verifies exact prior bytes, original GPS and
    // spatial history for observations/successors on account and personal paths.
    return scoped.mutate(id,expectedRevision,{...record,type:"field-capture"});
  }
  const projectHandovers=createProjectHandoverService({directory:join(dataPath,'project-handovers'),workspace});
  const evidenceIndexes=createEngagementEvidenceIndexCache({directory:join(dataPath,"engagement-source-indexes")});
  let assistant = engagementAssistant;
  if (!assistant) {
    try {assistant = createEngagementAssistant({endpoint: process.env.ESIA_ENGAGEMENT_AI_ENDPOINT || undefined, model: process.env.ESIA_ENGAGEMENT_AI_MODEL || undefined});}
    catch (error) {
      const disabled = createEngagementAssistant(), reason = `Optional AI configuration is invalid: ${error.message} Manual assessment and local source indexing remain available. No AI request was sent.`;
      assistant = {...disabled, describe: () => ({...disabled.describe(), reason}),
        async propose(input) {return {...await disabled.propose(input), reason};}};
    }
  }
  const oversightStores = new Map();
  const clientTemplateStores=new Map();
  const templateAiProofs=new WeakMap();
  const reviewPolicyStores=new Map();
  const reviewPolicies=accountId=>{
    const {account}=workspace.forAccount(accountId);
    if(!reviewPolicyStores.has(account.id))reviewPolicyStores.set(account.id,createReviewSignoffPolicyStore({directory:account.isDefault?dataPath:join(dataPath,'accounts',account.id),accountId:account.custodyId}));
    return reviewPolicyStores.get(account.id);
  };
  const policyCoverageStores=new Map();
  const professionalQualification=createLocalProfessionalQualification({workspace,resourceLibrary:library,reviewPolicies,policyDirectory:join(dataPath,'policy-library'),appRoot});
  const policyCoverage=accountId=>{
    const scoped=workspace.forAccount(accountId),account=scoped.account;
    if(!policyCoverageStores.has(account.id))policyCoverageStores.set(account.id,createPolicyCoverageReviewStore({directory:account.isDefault?dataPath:join(dataPath,'accounts',account.id),policyDirectory:join(dataPath,'policy-library'),accountId:account.custodyId,authorizeSignoff:({policyId,policyRevision,subjectId,subjectSha256,stageApprovals,authorId,frameworkId})=>reviewPolicies(account.id).requireCurrentComplete({policyId,policyRevision,subject:{id:subjectId,sha256:subjectSha256},stageApprovals,authorId,context:{institutionId:getFramework(frameworkId||subjectId)?.institutionId}})}));
    return policyCoverageStores.get(account.id);
  };
  const clientTemplates=accountId=>{
    const scoped=workspace.forAccount(accountId),account=scoped.account;
    if(!clientTemplateStores.has(account.id))clientTemplateStores.set(account.id,createClientTemplateStudio({directory:account.isDefault?dataPath:join(dataPath,'accounts',account.id),accountId:account.custodyId,getProject:id=>scoped.getProject(id),getEngagement:id=>scoped.engagements().get(id),approvalPolicy:({subject,authorId,engagement})=>{
      return reviewPolicies(account.id).requireCurrentComplete({subject,authorId,context:{engagementId:engagement.id}},{allowUnconfigured:true});
    },assistant:clientTemplateAssistantFactory?clientTemplateAssistantFactory(account):projectAi.templateAssistant(account),templateAiSourceContext:async({template,version,fieldIds,requestToken})=>{
      if(!template.rights?.statement?.includes('[ESIA_MONITORING_SOURCE_V1]'))return {classification:'privately_retained_native_template',rights:template.rights};
      const sourceLibrary=await library(),catalogHash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');let catalog=await sourceLibrary.exportCatalog(),proof=templateAiProofs.get(requestToken);
      if(!proof){const before=catalogHash(catalog),service=createMonitoringTemplateIngestion({resourceLibrary:sourceLibrary,studio:clientTemplates(account.id),accountId:account.custodyId,getEngagement:id=>scoped.engagements().get(id)}),mapping=await service.inspectTemplate({templateId:template.id,templateVersion:version.version});catalog=await sourceLibrary.exportCatalog();if(catalogHash(catalog)!==before)throw fail('The source catalog changed during structural verification. Reload the exact source.',409);proof={mapping,catalogSha256:before};templateAiProofs.set(requestToken,proof);}
      if(catalogHash(catalog)!==proof.catalogSha256)throw fail('The source catalog or rights changed during semantic assistance.',409);
      const mapping=proof.mapping,source=mapping.manifest.source,publication=catalog.versions.find(row=>row.id===source.resourceVersionId),file=catalog.files.find(row=>row.id===source.fileId);
      if(!publication||!file||!evaluateResourceRight(publication,'ai',{audience:'practitioner'}).allowed||file.rights&&!evaluateResourceRight({...publication,rights:file.rights},'ai',{audience:'practitioner'}).allowed)throw fail('The exact institutional original does not currently permit AI processing.',403);
      const original=await sourceLibrary.file(file.id,{audience:'practitioner'});if(createHash('sha256').update(original.bytes).digest('hex')!==source.sourceSha256)throw fail('The verified institutional original bytes changed during semantic assistance.',409);
      const selected=new Set(fieldIds||version.analysis.fields.map(row=>row.id));
      return {classification:'independently_verified_institutional_template',source:{resourceVersionId:source.resourceVersionId,fileId:source.fileId,sourceSha256:source.sourceSha256,templateSha256:source.templateSha256,edition:source.edition,sourceClassification:source.sourceClassification,officialUrl:source.officialUrl,annex:source.annex||null,reconstruction:source.reconstruction?{generatorVersion:source.reconstruction.generatorVersion,sourceHeadingCount:source.reconstruction.sourceHeadingCount,sourceLayoutPreserved:false}:null,rights:publication.rights,fileRights:file.rights||null},fields:mapping.crosswalk.filter(row=>selected.has(row.fieldId)).map(row=>({fieldId:row.fieldId,originalLabel:row.originalLabel,originalType:row.originalType,sourceEvidence:row.sourceEvidence}))};
    },...(clientTemplateNativeFactory?{native:clientTemplateNativeFactory(account)}:{})}));
    return clientTemplateStores.get(account.id);
  };
  const oversight = accountId => {
    const scoped = workspace.forAccount(accountId), account = scoped.account;
    if (!oversightStores.has(account.id)) oversightStores.set(account.id, createLocalOversightStore({
      directory: account.isDefault ? dataPath : join(dataPath, 'accounts', account.id), accountId: account.custodyId,
      getProject: id => scoped.getProject(id), getProjectSummary: id => scoped.getProjectSummary(id), listProjects: () => scoped.listProjects()
    }));
    return oversightStores.get(account.id);
  };
  let consolidationStore;
  const consolidation = () => consolidationStore ??= createLocalOversightConsolidationStore({
    directory:join(dataPath,'practitioner-oversight'),
    resolveScopeAccess({accountId,projectId}) {
      const account=workspace.getAccountMetadata(accountId),project=workspace.readProjectSummary(account.id,projectId);
      return {accountId:account.id,custodyId:account.custodyId,projectId:project.id};
    },
    resolveScope({accountId,projectId},{asOf}) {
      const account=workspace.getAccountMetadata(accountId),project=workspace.readProjectSummary(accountId,projectId);
      const source=readLocalOversightProject({directory:account.isDefault?dataPath:join(dataPath,'accounts',account.id),accountId:account.custodyId,
        getProjectSummary:id=>workspace.readProjectSummary(account.id,id),projectId,asOf});
      return {accountId:account.id,custodyId:account.custodyId,accountName:account.name,projectId:project.id,
        canonicalProjectId:project.projectContext?.identity?.id||null,canonicalProjectName:project.projectContext?.identity?.name||null,sourceContext:{projectRevision:project.revision,workspaceId:project.workspaceId,projectContext:project.projectContext||null},...source};
    }
  });
  const comparison=createLocalOversightComparisonService({getSnapshot:id=>consolidation().getSnapshot(id)});
  const consolidationSources = () => {
    const accounts=workspace.listAccounts();if(accounts.length>1000)throw fail('The practitioner source directory exceeds its bounded account limit.',413);
    let total=0;const result={accounts:accounts.map(account=>{
      const projects=workspace.readProjectSummaries(account.id);total+=projects.length;if(total>1000)throw fail('The practitioner source directory exceeds its bounded project limit.',413);
      return {id:account.id,name:account.name,organization:account.organization,projects:projects.map(project=>({id:project.id,name:project.name,canonicalProjectId:project.projectContext?.identity?.id||null,canonicalProjectName:project.projectContext?.identity?.name||null}))};
    })};
    if(Buffer.byteLength(JSON.stringify(result))>4*1024*1024)throw fail('The practitioner source directory exceeds its metadata size limit.',413);return result;
  };
  // The same canonical identity provider is shared, while private practitioner
  // records live outside all client-account vaults and never use their routing.
  const projectIdentities = createProjectIdentityDirectory({directory: dataPath});
  const personalSpaces = createPersonalProjectSpaces({directory: dataPath, getIdentity: id => {
    try {return projectIdentities.get(id);} catch (error) {if (error.status === 404) return null;throw error;}
  }});
  workspace.configureFileSharing({resolvePractitionerOwner(owner) {
    const {project} = personalSpaces.get(owner.identityId);
    return {project, readVersion: versionId => personalSpaces.readVersion(owner.identityId, versionId), managedPath(versionId) {
      const version = project.resources.flatMap(resource => resource.versions).find(version => version.id === versionId);
      if (!version || version.mode !== "managed") throw fail("Share an exact managed original from its owning project.", 409);
      return join(dataPath, "project-spaces", owner.identityId, "objects", "sha256", version.sha256);
    }};
  }});
  function createAndRegisterShare(owner, body) {
    if (Object.keys(body).some(key => !["versionId", "target", "purpose"].includes(key))) throw fail("Choose an exact source version, destination and purpose; source ownership is selected by this route.");
    const destination = workspace.listAccounts().find(account => account.custodyId === body.target?.accountId);
    if (!destination) throw fail("The destination account custody was not found.", 404);
    const targetStore = workspace.forAccount(destination.id), project = targetStore.getProject(body.target.projectId);
    const share = workspace.fileSharing().createShare({owner, versionId: body.versionId, target: body.target, purpose: body.purpose});
    try {return targetStore.registerShare(share.id, {projectId: project.id, expectedRevision: project.revision});}
    catch (error) {workspace.fileSharing().revokeShare(share.id, {owner, expectedRevision: share.revision});throw error;}
  }
  const researchArchives = new Map();
  const archive = (id = "bujagali") => {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}(?![\s\S])/.test(id)) throw fail("Choose a valid research collection.");
    if (!existsSync(join(dataPath, "research-archive", id, "archive.sqlite"))) throw fail("This research collection has not been created or captured locally.", 404);
    if (!researchArchives.has(id)) researchArchives.set(id, createResearchArchive({directory: join(dataPath, "research-archive", id), collection: id}));
    return researchArchives.get(id);
  };
  const archiveCollections = () => {
    const path = join(dataPath, "research-archive");if (!existsSync(path)) return [];
    if (lstatSync(path).isSymbolicLink()) throw fail("Research storage cannot use directory links.", 409);
    return readdirSync(path, {withFileTypes: true}).filter(entry => entry.isDirectory() && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(entry.name) && existsSync(join(path, entry.name, "archive.sqlite"))).map(entry => ({id: entry.name, name: entry.name === "cbg" ? "CBG" : entry.name.replace(/[-_]/g, " ").replace(/^./, letter => letter.toUpperCase())}));
  };
  const ps5Evaluation=createLocalPublicPs5Evaluation({workspace,directory:join(dataPath,'public-ps5-evaluation'),sourceRoot:dataPath,appRoot,resourceLibrary:library,archiveCollections,archive,projectAi});
  const server = createServer(async (request, response) => {
    const headers = {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    };
    function send(status, content, mediaType = "application/json; charset=utf-8", extra = {}) {
      response.writeHead(status, {...headers, "content-type": mediaType, ...extra});
      response.end(Buffer.isBuffer(content) ? content : mediaType.startsWith("application/json") ? JSON.stringify(content) : content);
    }
    try {
      const port = server.address().port;
      const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
      if (!hosts.has(request.headers.host)) throw fail("Open this workbench on localhost.", 403);
      const origins = new Set([...hosts].map(host => `http://${host}`));
      if (request.headers.origin && !origins.has(request.headers.origin)) throw fail("Open this operation from the local workbench.", 403);
      const url = new URL(request.url, `http://127.0.0.1:${port}`);
      // encodeURIComponent escapes the colons in retained field-version IDs.
      // Normalize that ID character once; keep encoded separators and escapes
      // outside the route alphabet so they cannot change resource boundaries.
      url.pathname = url.pathname.replace(/%3a/gi, ":");
      if (url.pathname.startsWith("/api/")) {
        if (request.headers["x-esia-workspace"] !== "local" ||
            request.headers["sec-fetch-site"] && request.headers["sec-fetch-site"] !== "same-origin") {
          throw fail("Open this operation from the local workbench.", 403);
        }
        const method = request.method;
        if(url.pathname==='/api/demonstrations/consultancy') {
          if(method!=='POST')throw fail('Create a sample through its explicit local form.',405);
          const body=await jsonBody(request,4096);
          if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='confirmedSynthetic'))throw fail('Confirm synthetic sample creation without client data or routing overrides.');
          return send(201,createConsultancyDemonstration(workspace,body));
        }
        if(url.pathname.startsWith('/api/review-signoff-policies')){
          const service=reviewPolicies(request.headers['x-esia-account']);
          if(url.pathname==='/api/review-signoff-policies'){
            if(method==='GET')return send(200,service.list());
            if(method==='POST')return send(200,service.save(await jsonBody(request,256*1024)));
          }
          if(url.pathname==='/api/review-signoff-policies/backup'&&method==='GET')return send(200,service.backup());
          if(url.pathname==='/api/review-signoff-policies/restore'&&method==='POST')return send(200,service.restore(await jsonBody(request,8*1024*1024)));
          const route=/^\/api\/review-signoff-policies\/([A-Za-z0-9_.:-]+)(?:\/(signoffs|evaluate))?$/.exec(url.pathname);
          if(route&&method==='GET'&&!route[2])return send(200,service.get(route[1],url.searchParams.get('revision')||undefined));
          if(route&&method==='POST'&&route[2]){
            const body=await jsonBody(request,256*1024);if(body.policyId&&body.policyId!==route[1])throw fail('The review policy does not match this route.',409);
            return send(200,route[2]==='signoffs'?service.sign({...body,policyId:route[1]}):service.evaluate({...body,policyId:route[1]}));
          }
          throw fail('This review responsibility route is not available.',404);
        }
        if(url.pathname==='/api/project-ai'||url.pathname.startsWith('/api/project-ai/')) {
          const operation=url.pathname.slice('/api/project-ai'.length).replace(/^\//,'');
          if(method!==(operation?'POST':'GET'))throw fail('Choose a supported project assistant operation.',405);
          const result=await projectAi.handle({operation,accountId:url.searchParams.get('account')||'local-default',projectId:url.searchParams.get('project'),engagementId:url.searchParams.get('engagement')||undefined,actorId:url.searchParams.get('actor')||undefined,body:operation?await jsonBody(request,128*1024):{}});
          return send(200,result);
        }
        if(url.pathname.startsWith('/api/resource')) {
          const service=await library({seed:!(url.pathname==='/api/resource-backup'&&method==='POST')}), audience=url.searchParams.get('audience')||'practitioner';
          if(!['practitioner','client'].includes(audience))throw fail('Choose a library audience.');
          const filters=Object.fromEntries([...url.searchParams].filter(([key])=>!['audience','q','query'].includes(key)));
          if(url.pathname==='/api/resources'&&method==='GET')return send(200,{...await service.catalog({audience,query:url.searchParams.get('q')||url.searchParams.get('query')||'',filters}),...(audience==='practitioner'?{assistance:resourceAi.describe()}:{})});
          if(url.pathname==='/api/resource-citations'&&method==='POST') {
            const body=await jsonBody(request,64*1024),selectedAudience=audience==='client'?'client':body.audience||audience;
            if(!['practitioner','client'].includes(selectedAudience))throw fail('Choose a library audience.');
            const result=await service.citation(body.versionIds,body.format,{audience:selectedAudience});
            const media={'bibtex':'application/x-bibtex','csl-json':'application/vnd.citationstyles.csl+json','ris':'application/x-research-info-systems','csv':'text/csv; charset=utf-8'}[body.format];
            if(!media)throw fail('Choose BibTeX, CSL-JSON, RIS or CSV.');
            const content=result?.bytes||result?.content||result?.text||result;
            return send(200,Buffer.isBuffer(content)?content:Buffer.from(typeof content==='string'?content:JSON.stringify(content,null,2)),media,{'content-disposition':'attachment; filename="bibliography.'+({'bibtex':'bib','csl-json':'json','ris':'ris','csv':'csv'}[body.format])+'"'});
          }
          const fileRoute=/^\/api\/resource-files\/([a-f0-9-]+)\/download$/.exec(url.pathname);
          if(fileRoute&&method==='POST'){const result=await service.file(fileRoute[1],{audience});return send(200,result.bytes,result.mediaType||result.file?.mediaType||'application/octet-stream',{'content-disposition':'attachment; filename="'+String(result.filename||result.file?.filename||'publication').replace(/[^A-Za-z0-9._ -]/g,'_').slice(0,180)+'"','content-security-policy':"sandbox; default-src 'none'"});}
          const clientTemplateRoute=/^\/api\/resource-templates\/([a-f0-9-]+)\/render$/.exec(url.pathname);
          if(audience==='client'&&method!=='GET'&&!clientTemplateRoute)throw fail('Editorial changes use the Practitioner Library.',403);
          if(audience==='client'&&['/api/resource-backup','/api/resource-schedule','/api/resource-schedule/run'].includes(url.pathname))throw fail('Library maintenance is available in the Practitioner Library.',403);
          if(url.pathname==='/api/resource-schedule'&&method==='GET')return send(200,{...await service.scheduleSettings(),runtime:resourceScheduler?.describe()});
          if(url.pathname==='/api/resource-schedule'&&method==='POST'){const result=await service.scheduleSettings(await jsonBody(request,8192));await resourceScheduler.configure();return send(200,{...result,runtime:resourceScheduler.describe()});}
          if(url.pathname==='/api/resource-schedule/run'&&method==='POST')return send(200,await service.runSchedule(await jsonBody(request,8192)));
          if(url.pathname==='/api/resource-backup'&&method==='GET')return send(200,await service.backup());
          if(url.pathname==='/api/resource-backup'&&method==='POST')return send(200,await service.restore(await jsonBody(request,64*1024*1024),{pristineCatalog:JSON.parse(await readFile(join(appRoot,'src/data/resource-library-catalog.json'),'utf8'))}));
          const resourceRoute=/^\/api\/resources\/([a-f0-9-]+)(?:\/(acquire|analyze|verify|versions|review|upload|answer))?$/.exec(url.pathname);
          if(resourceRoute){const [,id,operation]=resourceRoute;if(!operation&&method==='GET')return send(200,await service.detail(id,{audience}));
            if(operation&&method==='POST'){const body=await jsonBody(request,operation==='upload'?48*1024*1024:256*1024),result=operation==='versions'?await service.proposeVersion(id,body):operation==='review'?await service.reviewVersion(id,body):operation==='upload'?await service.ingestUpload({...body,versionId:id}):operation==='answer'?await service.answer({...body,versionIds:[id],audience}):await service[operation](id,body);return send(200,result);}}
          if(url.pathname==='/api/resources'&&method==='POST'){
            const body=await jsonBody(request,64*1024),catalog=await service.exportCatalog();
            if(Object.keys(body).some(key=>!['title','edition','officialUrl','institutionId','type','summary','publicationDate'].includes(key)))throw fail('Add bibliographic publication metadata without storage or permission overrides.');
            if(typeof body.title!=='string'||!body.title.trim()||typeof body.edition!=='string'||!body.edition.trim())throw fail('Enter a publication title and edition.');
            const resourceId=randomUUID(),versionId=randomUUID();catalog.resources.push({id:resourceId,title:body.title,type:body.type||'guidance',institutionId:body.institutionId,authors:[],publisher:catalog.institutions.find(item=>item.id===body.institutionId)?.name||''});
            catalog.versions.push({id:versionId,resourceId,title:body.title,edition:body.edition,status:'uncertain',officialUrl:body.officialUrl,publicationDate:body.publicationDate||'',summary:body.summary||'',language:'en',curation:{status:'draft',audience:'internal'},rights:{category:'unknown',actions:{}}});
            await service.importCatalog(catalog);return send(201,await service.detail(versionId));
          }
          const instrumentRoute=/^\/api\/resource-instruments\/([a-f0-9-]+)\/(review|templates)$/.exec(url.pathname);
          if(instrumentRoute&&method==='POST'){const body=await jsonBody(request,256*1024);return send(200,instrumentRoute[2]==='review'?await service.reviewInstrument(instrumentRoute[1],body,{sourceSignoffs:{requireComplete:input=>reviewPolicies(request.headers['x-esia-account']).requireCurrentComplete(input)}}):await service.createTemplate(instrumentRoute[1],body));}
          const templateRoute=/^\/api\/resource-templates\/([a-f0-9-]+)\/render$/.exec(url.pathname);
          if(templateRoute&&method==='POST'){const body=await jsonBody(request,256*1024),result=await service.renderTemplate(templateRoute[1],body.values,{audience});const escape=value=>String(value??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(result.citation?.title||'Source-linked form')+'</title><body><main><h1>'+escape(result.citation?.title||'Source-linked form')+'</h1>'+result.fields.map(field=>'<section><h2>'+escape(field.label)+'</h2><p>'+escape(field.value).replaceAll('\n','<br>')+'</p></section>').join('')+'<footer><p>Prepared using a source-derived application form. Review its completeness and applicability for this assignment.</p><p>'+escape(result.rightsNotice?.attribution||'')+'</p><p>'+escape(result.rightsNotice?.adaptationNotice||'')+'</p><p>'+escape(result.rightsNotice?.license||'')+' '+escape(result.rightsNotice?.licenseUrl||'')+'</p><p>'+escape((result.rightsNotice?.conditions||[]).join(' '))+'</p><p>Source: '+escape(result.citation?.title)+'; '+escape(result.citation?.edition)+'; '+escape(result.citation?.officialUrl)+'. '+escape(result.source?.locator)+'</p><p>'+escape(result.citation?.citation?.publisher||'')+' · Source SHA256 '+escape(result.source?.sha256)+'</p></footer></main></body></html>';return send(200,html,'text/html; charset=utf-8',{'content-disposition':'attachment; filename="source-linked-template.html"','content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"});}
          throw fail('Library operation not found.',404);
        }

        if(url.pathname.startsWith('/api/oversight/consolidation/')){
          if(request.headers['x-esia-account']!==undefined)throw fail('Consolidation uses explicit source selections in the practitioner workspace; omit the account routing header.');
          const base='/api/oversight/consolidation';
          if([`${base}/comparisons`,`${base}/comparisons/export`].includes(url.pathname)&&method==='POST'){
            const body=await jsonBody(request,4096),result=comparison.compare(body);
            if(url.pathname===`${base}/comparisons`)return send(200,result);
            const format=url.searchParams.get('format')||'json';if(!['json','html','xlsx'].includes(format))throw fail('Choose JSON, web report or Excel.');
            const content=format==='xlsx'?await renderOversightComparisonWorkbook(result):format==='html'?renderOversightComparisonHtml(result):JSON.stringify(result,null,2);
            comparison.authorize(body);
            return send(200,Buffer.isBuffer(content)?content:Buffer.from(content),{json:'application/json; charset=utf-8',html:'text/html; charset=utf-8',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[format],
              {'content-disposition':`attachment; filename="portfolio-comparison-${result.baseline.id}-${result.followup.id}.${format}"`,'content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"});
          }
          if(url.pathname===`${base}/sources`&&method==='GET')return send(200,consolidationSources());
          if(url.pathname===`${base}/preview`&&method==='POST')return send(200,consolidation().preview(await jsonBody(request)));
          if(url.pathname===`${base}/snapshots`){
            if(method==='GET')return send(200,consolidation().listSnapshots(Object.fromEntries(url.searchParams)));
            if(method==='POST')return send(201,consolidation().issueSnapshot(await jsonBody(request)));
          }
          const match=/^\/api\/oversight\/consolidation\/snapshots\/([A-Za-z0-9_.:-]+)(\/export)?$/.exec(url.pathname);
          if(match&&method==='GET'){
            const snapshot=consolidation().getSnapshot(match[1]);if(!match[2])return send(200,snapshot);
            const format=url.searchParams.get('format')||'json';if(!['json','html','xlsx'].includes(format))throw fail('Choose JSON, web report or Excel.');
            const content=format==='xlsx'?await renderOversightWorkbook(snapshot):format==='html'?renderOversightReportHtml(snapshot):JSON.stringify(snapshot,null,2);
            return send(200,Buffer.isBuffer(content)?content:Buffer.from(content),{json:'application/json; charset=utf-8',html:'text/html; charset=utf-8',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[format],
              {'content-disposition':`attachment; filename="practitioner-portfolio-${snapshot.id}.${format}"`,'content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"});
          }
          throw fail('This practitioner consolidation operation is unavailable.',405);
        }
        const personalShares = /^\/api\/project-spaces\/([a-f0-9-]+)\/shares(?:\/([a-f0-9-]+)\/revoke)?$/.exec(url.pathname);
        if (personalShares) {
          const [, identityId, shareId] = personalShares;personalSpaces.get(identityId);
          const owner = {type: "practitioner_project", identityId};
          if (!shareId && method === "GET") return send(200, {shares: workspace.fileSharing().listShares({owner})});
          if (!shareId && method === "POST") return send(201, createAndRegisterShare(owner, await jsonBody(request)));
          if (shareId && method === "POST") {
            const body = await jsonBody(request);if (Object.keys(body).some(key => key !== "expectedRevision")) throw fail("Revoke the selected owning-project share using its expected revision only.");
            return send(200, {share: workspace.fileSharing().revokeShare(shareId, {owner, expectedRevision: body.expectedRevision})});
          }
          throw fail("This personal file-sharing operation is unavailable.", 405);
        }
        if (url.pathname === "/api/project-spaces" && method === "GET") return send(200, {spaces: personalSpaces.list()});
        if (url.pathname === "/api/project-spaces/import" && method === "POST") {
          const body = await jsonBody(request);
          if (Object.keys(body).length !== 1 || !Object.hasOwn(body, "package")) throw fail("Import one explicit personal project package.");
          const value = body.package;
          let known = false;
          try {projectIdentities.get(value?.identity?.id);known = true;} catch (error) {if (error.status !== 404) throw error;}
          if (known) personalSpaces.validateImport(value);
          else {
            // Validate every retained byte and immutable record in temporary
            // storage before the public identity registry receives any metadata.
            let validator;
            try {
              // Use the existing private registry to detect an identity rebind;
              // validateImport itself validates the raw package in isolation.
              validator = createPersonalProjectSpaces({directory: dataPath, getIdentity: id => id === value?.identity?.id ? value.identity : null});
              validator.validateImport(value);
            } finally {validator?.close();}
          }
          projectIdentities.restore(value.identity);
          return send(201, personalSpaces.importProject(value));
        }
        const personalRoute = /^\/api\/project-spaces\/([a-f0-9-]+)(?:\/(commands|profile|export))?$/.exec(url.pathname);
        if (personalRoute) {
          const [, identityId, operation] = personalRoute;
          if (!operation && method === "GET") return send(200, personalSpaces.get(identityId));
          if (operation === "commands" && method === "POST") {
            const body = await jsonBody(request);
            if (Object.keys(body).some(key => !["expectedRevision", "command"].includes(key))) throw fail("Personal project commands accept only an expected record revision and command.");
            if(body.command?.type==="field-capture"&&["requirementIds","findingIds","grievanceIds","commitmentIds","monitoringObligationIds","engagementActionIds","siteIds"].some(key=>body.command.links?.[key]?.length))throw fail("Save engagement-linked field records from the owning account mission. Personal project captures can retain their own observations and typed field details.");
            return send(200, personalSpaces.mutate(identityId, body.expectedRevision, body.command));
          }
          if (operation === "profile" && method === "PUT") return send(200, personalSpaces.updateProfile(identityId, await jsonBody(request)));
          if (operation === "export" && method === "GET") return send(200, personalSpaces.exportProject(identityId), undefined,
            {"content-disposition": `attachment; filename="${identityId}.personal.esia.json"`});
          throw fail("This personal project operation is unavailable.", 405);
        }
        const personalVersion = /^\/api\/project-spaces\/([a-f0-9-]+)\/versions\/([A-Za-z0-9_.:-]+)\/(preview|download|spatial)$/.exec(url.pathname);
        if (personalVersion) {
          const [, identityId, versionId, operation] = personalVersion;
          if (method !== (operation === "download" ? "POST" : "GET")) throw fail("This personal source operation is unavailable.", 405);
          const retained = personalSpaces.readVersion(identityId, versionId);
          if (operation === "preview") return send(200, await buildDocumentPreview(retained, {page: url.searchParams.has("page") ? url.searchParams.get("page") : 1}));
          if (operation === "spatial") return send(200, {versionId: retained.version.id, sha256: retained.version.sha256, spatial: await buildSpatialPreview(retained.bytes, retained.version)});
          const filename = String(retained.version.filename).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 180) || "source";
          return send(200, retained.bytes, "application/octet-stream", {"content-disposition": `attachment; filename="${filename}"`, "content-security-policy": "sandbox; default-src 'none'"});
        }
        if (url.pathname === "/api/research-archives" && method === "GET") return send(200, {collections: archiveCollections()});
        const archiveManifest = /^\/api\/research-archives\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(url.pathname);
        if (archiveManifest && method === "GET") return send(200, archive(archiveManifest[1]).manifest());
        const archivePreview = /^\/api\/research-archives\/([a-z0-9][a-z0-9_-]{0,63})\/versions\/([A-Za-z0-9_.:-]+)\/preview$/.exec(url.pathname);
        if (archivePreview && method === "GET") return send(200, await buildDocumentPreview(archive(archivePreview[1]).readVersion(archivePreview[2]), {page: url.searchParams.has("page") ? url.searchParams.get("page") : 1}));
        const archiveDownload = /^\/api\/research-archives\/([a-z0-9][a-z0-9_-]{0,63})\/versions\/([A-Za-z0-9_.:-]+)\/download$/.exec(url.pathname);
        if (archiveDownload && method === "GET") {
          const {bytes, version, resource} = archive(archiveDownload[1]).readVersion(archiveDownload[2]);
          const filename = (version.filename || resource.filename).replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 200);
          return send(200, bytes, "application/octet-stream", {"content-disposition": `attachment; filename="${filename}"`, "content-security-policy": "sandbox; default-src 'none'"});
        }
        if (url.pathname === "/api/storage-accounts" && method === "GET") return send(200, workspace.listAccounts());
        if (url.pathname === "/api/storage-accounts" && method === "POST") return send(201, workspace.createAccount(await jsonBody(request)));
        if (url.pathname === "/api/storage-accounts/restore" && method === "POST") return send(201, workspace.restorePackage((await jsonBody(request)).package));
        const accountId = request.headers["x-esia-account"] ?? "local-default";
        if (typeof accountId !== "string" || !accountId) throw fail("Select a valid storage account.");
        const store = workspace.forAccount(accountId);
        if (url.pathname === '/api/project-lifecycle' || url.pathname.startsWith('/api/project-lifecycle/')) {
          const service = store.lifecycle(), operation = url.pathname.slice('/api/project-lifecycle'.length), actorId = request.headers['x-esia-actor'] || 'local-owner';
          if ([...url.searchParams.keys()].some(key => !['investmentId', 'snapshotId', 'view', 'asOf'].includes(key))) throw fail('Choose exact lifecycle report selectors.');
          if ((!operation || operation === '/exchange') && method === 'GET') return send(200, service.get(actorId), undefined, operation ? {'content-disposition': 'attachment; filename="project-lifecycle.json"'} : {});
          if (operation === '/report' && method === 'GET') return send(200, service.report({actorId, ...Object.fromEntries(url.searchParams)}));
          if (operation === '/restore-receipts' && method === 'GET') return send(200, service.restoreReceipts(actorId));
          if (['/commands', '/import'].includes(operation) && method === 'POST') {
            const body = await jsonBody(request, 4 * 1024 * 1024), field = operation === '/commands' ? 'command' : 'exchange';
            if (!body || typeof body !== 'object' || Object.keys(body).some(key => !['expectedRevision', 'actorId', field].includes(key))) throw fail('Use the exact local lifecycle command envelope.');
            return send(200, operation === '/commands' ? service.command(body.expectedRevision, body.command, body.actorId) : service.import(body.expectedRevision, body.exchange, body.actorId));
          }
          throw fail('This lifecycle operation is unavailable.', 405);
        }
        const evaluationRoute=/^\/api\/engagements\/([a-f0-9-]+)\/ps5-evaluation\/(read|create|save-case|page|original|prepare|adjudicate|run|reconcile|open-run|review-output|export)$/.exec(url.pathname);
        if(evaluationRoute){
          if(method!=='POST'||[...url.searchParams.keys()].some(key=>key!=='actorId'))throw fail('Use the exact manual evaluation route and current actor.',405);
          const result=await ps5Evaluation.handle({accountId,engagementId:evaluationRoute[1],actorId:url.searchParams.get('actorId'),operation:evaluationRoute[2],body:await jsonBody(request,512*1024)});
          if(evaluationRoute[2]==='original')return send(200,result.bytes,result.contentType,{'content-disposition':`attachment; filename="${String(result.filename).replace(/[^A-Za-z0-9._-]/g,'_').slice(0,160)}"`,'content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"});
          return send(200,result);
        }
        const qualificationRoute=/^\/api\/engagements\/([a-f0-9-]+)\/professional-qualification(?:\/(review|output|original))?$/.exec(url.pathname);
        if(qualificationRoute){
          const operation=qualificationRoute[2]||'read';if(method!==(operation==='read'?'GET':'POST')||[...url.searchParams.keys()].some(key=>key!=='actorId'))throw fail('Use the exact manual professional qualification route and current actor.',405);
          const result=await professionalQualification.handle({accountId,engagementId:qualificationRoute[1],actorId:url.searchParams.get('actorId'),operation,body:operation==='read'?{}:await jsonBody(request,512*1024)});
          if(['output','original'].includes(operation))return send(200,result.bytes,result.mediaType,{'content-disposition':`attachment; filename="${String(result.filename).replace(/[^A-Za-z0-9._-]/g,'_').slice(0,160)}"`,'x-esia-content-sha256':result.sha256,'content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"});
          return send(200,result);
        }
        if(url.pathname==='/api/monitoring-template-library'||url.pathname.startsWith('/api/monitoring-template-library/')){
          const service=createMonitoringTemplateIngestion({resourceLibrary:await library(),studio:clientTemplates(accountId),accountId:store.account.custodyId,getEngagement:id=>store.engagements().get(id)});
          if(url.pathname==='/api/monitoring-template-library'&&method==='GET')return send(200,await service.directory());
          const operation=url.pathname.slice('/api/monitoring-template-library/'.length),handler={'browse-sources':'browseSources','register-source':'registerSource','inspect-source':'inspectSource',import:'importIntoStudio','inspect-template':'inspectTemplate','prepare-report':'prepareReport'}[operation];
          if(method!=='POST'||!handler)throw fail('Choose a supported institutional monitoring template operation.',405);
          return send(200,await service[handler](await jsonBody(request,32*1024)));
        }
        const pilotRoute=/^\/api\/engagements\/([a-f0-9-]+)\/pilot-evidence(?:\/(measurement|verify-handover|task-observation))?$/.exec(url.pathname);
        if(pilotRoute){
          const body=method==='POST'?await jsonBody(request,256*1024):{};
          if(method!==(pilotRoute[2]?'POST':'GET'))throw fail('Choose a supported assignment measurement request.',405);
          const {actorId,...observation}=body;
          return send(200,await assignmentPilot.handle({accountId,engagementId:pilotRoute[1],actorId:actorId||url.searchParams.get('actorId'),operation:pilotRoute[2]||'read',body:observation}));
        }
        if(url.pathname.startsWith('/api/client-templates')||url.pathname.startsWith('/api/template-reports')){
          const studio=clientTemplates(accountId),download=result=>send(200,result.bytes,result.metadata.mediaType,{'content-disposition':`attachment; filename="${result.metadata.filename}"`,'x-esia-content-sha256':result.metadata.sha256,'content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"});
          if(url.pathname==='/api/client-templates/baseline'&&method==='GET'){
            const {genericMonitoringDocx}=await import('./client-template-baseline.mjs'),bytes=await genericMonitoringDocx();
            return download({bytes,metadata:{filename:'esia-generic-monitoring-v2.docx',mediaType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',sha256:createHash('sha256').update(bytes).digest('hex')}});
          }
          if(url.pathname==='/api/client-templates/backup'&&method==='GET')return send(200,studio.backup(),undefined,{'content-disposition':'attachment; filename="client-template-studio-backup.json"'});
          if(url.pathname==='/api/client-templates/restore'&&method==='POST')return send(200,await studio.restore(await jsonBody(request,clientTemplateLimits.backupBytes)));
          if(url.pathname==='/api/client-templates/learning'&&method==='GET')return send(200,await studio.learning(Object.fromEntries(url.searchParams)));
          if(url.pathname==='/api/client-templates/assistant'&&method==='GET')return send(200,studio.describeAssistant());
          if(url.pathname==='/api/client-templates/capabilities'&&method==='GET')return send(200,await studio.capabilities());
          if(url.pathname==='/api/client-templates'){
            if(method==='GET')return send(200,studio.list());
            if(method==='POST')return send(201,await studio.importTemplate(await jsonBody(request,24*1024*1024)));
          }
          const template=/^\/api\/client-templates\/([a-f0-9-]+)(?:\/(commands|source|reference|suggest))?$/.exec(url.pathname);
          if(template){const[,id,operation]=template;if(!operation&&method==='GET')return send(200,studio.getTemplate(id));if(operation==='commands'&&method==='POST')return send(200,await studio.templateCommand(id,await jsonBody(request,24*1024*1024)));if(operation==='suggest'&&method==='POST')return send(200,await studio.suggestTemplate(id,await jsonBody(request,4096)));if(operation==='source'&&method==='GET')return download(studio.readSource(id,url.searchParams.get('sourceId')||undefined));if(operation==='reference'&&method==='GET')return download(studio.readReference(id,url.searchParams.get('version')||undefined,{format:url.searchParams.get('format')||'pdf',page:url.searchParams.get('page')||1}));}
          if(url.pathname==='/api/template-reports'){
            if(method==='GET')return send(200,studio.listReports(Object.fromEntries(url.searchParams)));
            if(method==='POST')return send(201,await studio.createReport(await jsonBody(request,16*1024)));
          }
          const report=/^\/api\/template-reports\/([a-f0-9-]+)(?:\/(commands|render|artifacts|suggest)(?:\/([a-f0-9-]+))?)?$/.exec(url.pathname);
          if(report){const[,id,operation,artifactId]=report;if(!operation&&method==='GET')return send(200,studio.getReport(id));if(operation==='commands'&&method==='POST')return send(200,await studio.reportCommand(id,await jsonBody(request,512*1024)));if(operation==='render'&&method==='POST')return send(200,await studio.renderReport(id,await jsonBody(request,4096)));if(operation==='suggest'&&method==='POST')return send(200,await studio.suggestReport(id,await jsonBody(request,4096)));if(operation==='artifacts'&&artifactId&&method==='GET')return download(studio.readArtifact(id,artifactId,{format:url.searchParams.get('format')||'native',page:url.searchParams.get('page')||1}));}
          throw fail('Choose an available private client template or report operation.',405);
        }
        if (url.pathname === "/api/work-queue" && method === "GET") {
          if ([...url.searchParams.keys()].some(key=>!["after","limit","projectId"].includes(key))) throw fail("Choose a work page and an optional owned project.");
          const result=store.listWorkItems({after:url.searchParams.get("after") || "",limit:url.searchParams.has("limit")?Number(url.searchParams.get("limit")):30,projectId:url.searchParams.get("projectId") || ""});
          if (Buffer.byteLength(JSON.stringify(result)) > 256*1024) throw fail("Narrow this work page; its metadata exceeds 256 KiB.",413);
          return send(200,result);
        }
        const fieldTransferRoute=/^\/api\/projects\/([A-Za-z0-9_.:-]+)\/field-transfers(?:\/([a-f0-9]{64})(?:\/(chunks|commit|reconcile))?)?$/.exec(url.pathname);
        if(fieldTransferRoute){
          const [,projectId,transferId,operation]=fieldTransferRoute,project=store.getProjectSummary(projectId),scope={accountId:store.account.custodyId,projectId};
          if(!transferId&&method==="POST")return send(201,fieldTransfers.begin(scope,await jsonBody(request,4096)));
          if(transferId&&!operation&&method==="GET")return send(200,fieldTransfers.status(scope,transferId));
          if(transferId&&!operation&&method==="DELETE")return send(200,fieldTransfers.remove(scope,transferId));
          if(transferId&&operation==="chunks"&&method==="POST")return send(200,fieldTransfers.chunk(scope,transferId,await jsonBody(request,1450000)));
          if(transferId&&operation==="commit"&&method==="POST")return send(200,fieldTransfers.commit(scope,transferId,(record,revision,options)=>applyFieldCapture(store,projectId,revision,record,options)));
          if(transferId&&operation==="reconcile"&&method==="POST"){
            const body=await jsonBody(request,4096);if(body.expectedRevision!==project.revision||body.reviewed!==true)throw fail("Review the current project before reconciling this field transfer.",409);
            return send(200,fieldTransfers.rebase(scope,transferId,body));
          }
          throw fail("Choose an explicit field transfer operation.",405);
        }
        if (url.pathname === "/api/monitoring/attention" && method === "GET") {
          if ([...url.searchParams.keys()].some(key => !["asOf","projectId","engagementId","programId","cycleId"].includes(key))) throw fail("Choose an attention date and owned monitoring scope.");
          const asOf = url.searchParams.get("asOf") || new Date().toISOString().slice(0,10);
          if (!/^\d{4}-\d\d-\d\d$/.test(asOf) || !Number.isFinite(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0,10)!==asOf) throw fail("Choose a valid monitoring attention date.");
          const projectId=url.searchParams.get("projectId"),engagementId=url.searchParams.get("engagementId"),programId=url.searchParams.get("programId"),cycleId=url.searchParams.get("cycleId");
          if((programId||cycleId)&&!engagementId)throw fail("Select an owning engagement for a program or reporting-period attention view.");
          if(projectId)store.getProject(projectId);
          const service=store.engagements();
          if(engagementId){const selected=service.get(engagementId);if(projectId&&selected.projectId!==projectId)throw fail("This engagement belongs to another source project.",404);}
          const listed=service.list(projectId?{projectId}:{}).engagements.filter(item=>!engagementId||item.id===engagementId);
          if(listed.length>500)throw fail("This account exceeds the bounded 500-engagement attention view.",413);
          const engagements=listed.map(item=>{const current=service.get(item.id);if(programId&&!current.programs.some(program=>program.id===programId))throw fail("This monitoring program is unavailable.",404);if(cycleId&&!current.cycles.some(cycle=>cycle.id===cycleId&&(!programId||cycle.programId===programId)))throw fail("This reporting period is unavailable in the selected monitoring scope.",404);const scope={asOf,...(programId?{programId}:{}),...(cycleId?{cycleId}:{})};return {engagementId:item.id,projectId:item.projectId,projectName:store.getProject(item.projectId).name,name:item.name,attention:monitoringAttention(current,scope),cycles:current.cycles.filter(cycle=>(!programId||cycle.programId===programId)&&(!cycleId||cycle.id===cycleId)).map(cycle=>({id:cycle.id,programId:cycle.programId,name:cycle.name,attention:monitoringAttention(current,{asOf,cycleId:cycle.id})}))};});
          const result={format:"esia-monitoring-attention",schemaVersion:1,asOf,accountId:store.account.custodyId,engagements};
          if(Buffer.byteLength(JSON.stringify(result))>4*1024*1024)throw fail("Narrow this monitoring account; its attention view exceeds 4 MiB.",413);
          return send(200,result);
        }
        if (url.pathname === "/api/engagements/import" && method === "POST") {
          const body = await jsonBody(request);
          if (Object.keys(body).some(key => !["format", "schemaVersion", "projectId", "accountId", "engagements"].includes(key)) || body.format !== "esia-engagement-project-exchange" || body.schemaVersion !== 1 || body.accountId !== store.account.custodyId || !Array.isArray(body.engagements)) throw fail("Import an engagement exchange into its exact owning project and account.");
          const project = store.getProject(body.projectId), service = store.engagements();
          service.validateImport(project, body.engagements);
          service.importProject(project.id, body.engagements);
          return send(200, service.list({projectId: project.id}));
        }
        if (url.pathname === "/api/engagements") {
          const service = store.engagements();
          if (method === "GET") return send(200, service.list({...(url.searchParams.has("projectId") ? {projectId: url.searchParams.get("projectId")} : {})}));
          if (method === "POST") return send(201, service.create(await jsonBody(request, 1024 * 1024)));
          throw fail("Choose an engagement operation.", 405);
        }
        const issuedRoute=/^\/api\/engagements\/([a-f0-9-]+)\/issued(?:\/([a-f0-9-]+))?$/.exec(url.pathname);
        if(issuedRoute){
          const[,engagementId,renditionId]=issuedRoute,service=store.engagements(),engagement=service.get(engagementId);
          if(method!=="GET"||[...url.searchParams.keys()].length)throw fail("Read a retained issued rendition without changing its selection.",405);
          if(!renditionId)return send(200,{format:"esia-engagement-issued-renditions",schemaVersion:1,renditions:engagement.issuedRenditions});
          const retained=service.getIssuedRendition(engagementId,renditionId),record=retained.metadata;
          return send(200,retained.bytes,record.mediaType,{"content-disposition":`attachment; filename="${record.filename}"`, "x-esia-publication-id":record.publicationId,"x-esia-baseline-id":record.baselineId,"x-esia-baseline-sha256":record.baselineSha256,"x-esia-rendition-id":record.id,"x-esia-rendition-sha256":record.sha256,"content-security-policy":"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"});
        }
        if(url.pathname==='/api/engagement-report-templates'){
          if(method!=='GET'||[...url.searchParams.keys()].length)throw fail('Read the application-authored report template catalog.',405);
          return send(200,{format:'esia-engagement-report-template-catalog',schemaVersion:1,templates:engagementReportTemplates});
        }
        const scaffoldRoute=/^\/api\/engagement-report-templates\/([a-z0-9-]+)\/scaffold$/.exec(url.pathname);
        if(scaffoldRoute){
          if(method!=='GET'||[...url.searchParams.keys()].some(key=>key!=='version'))throw fail('Read a blank report template using its exact version.',405);
          const templateVersion=url.searchParams.get('version')||'1',html=renderEngagementTemplateScaffold({templateId:scaffoldRoute[1],templateVersion});
          return send(200,html,'text/html; charset=utf-8',{'content-disposition':`attachment; filename="${scaffoldRoute[1]}-v${templateVersion}-blank.html"`,'content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"});
        }
        const workingTemplateRoute=/^\/api\/engagements\/([a-f0-9-]+)\/report-templates\/([a-z0-9-]+)(?:\/(render))?$/.exec(url.pathname);
        if(workingTemplateRoute){
          const[,engagementId,templateId,operation]=workingTemplateRoute;
          if(method!=='GET'&&method!=='POST'||method==='GET'&&operation||method==='POST'&&!operation)throw fail('Read or render a working report template.',405);
          const body=method==='POST'?await jsonBody(request,4096):Object.fromEntries(url.searchParams),allowed=method==='POST'?['templateVersion','cycleId','expectedRevision']:['templateVersion','cycleId'];
          if(Object.keys(body).some(key=>!allowed.includes(key)))throw fail('Read the shared engagement records without independent template values.');
          const engagement=store.engagements().get(engagementId),project=store.getProject(engagement.projectId);
          if(method==='POST'&&body.expectedRevision!==engagement.revision)throw fail('This engagement changed. Reload the working template before exporting it.',409);
          const projection=projectEngagementReportTemplate({templateId,templateVersion:body.templateVersion||'1',project,engagement,cycleId:body.cycleId||undefined});
          if(method==='GET')return send(200,projection);
          return send(200,renderEngagementReportTemplateHtml(projection),'text/html; charset=utf-8',{'content-disposition':`attachment; filename="${templateId}-v${projection.template.version}-working.html"`,'content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"});
        }
        const thematicRoute=/^\/api\/engagements\/([a-f0-9-]+)\/instruments\/([a-f0-9-]+)(?:\/(render))?$/.exec(url.pathname);
        if(thematicRoute){
          const [,engagementId,instrumentId,operation]=thematicRoute,engagements=store.engagements();let engagement=engagements.get(engagementId);
          if(method!=='GET'&&method!=='POST'||method==='GET'&&operation)throw fail('Choose an instrument workflow read, reference or export operation.',405);
          const body=method==='POST'?await jsonBody(request,64*1024):Object.fromEntries(url.searchParams);
          const allowed=method==='GET'?['workflow','cycleId']:operation?['workflow','cycleId','expectedRevision']:['workflow','cycleId','expectedRevision','actorId','statement'];
          if(Object.keys(body).some(key=>!allowed.includes(key)))throw fail('Use the shared engagement workflow without independent template values.');
          const definition=await (await library()).instrumentWorkflowDefinition(instrumentId);
          engagement=engagements.get(engagementId);const project=store.getProject(engagement.projectId);
          if(method==='POST'&&body.expectedRevision!==engagement.revision)throw fail('This engagement changed. Reload the instrument before using or exporting its current records.',409);
          const workflow=body.workflow||'prepare',cycleId=body.cycleId||undefined;
          let projection=projectInstrumentWorkflow({definition,project,engagement,workflow,cycleId});
          if(method==='GET')return send(200,projection);
          if(operation==='render')return send(200,renderInstrumentWorkflowHtml(projection),'text/html; charset=utf-8',{'content-disposition':'attachment; filename="thematic-'+workflow+'-working-document.html"','content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"});
          const command=instrumentBibliographyCommand(definition,{workflow,statement:body.statement});
          if(![...engagement.roles.preparer,...engagement.roles.reviewer].includes(body.actorId))throw fail('An assigned preparer or reviewer must record instrument use.',403);
          const previous=(engagement.bibliography||[]).find(row=>row.resourceVersionId===definition.instrument.resourceVersionId&&row.instrumentId===instrumentId);
          if(!previous)engagement=engagements.mutate(engagementId,body.expectedRevision,command,body.actorId);
          projection=projectInstrumentWorkflow({definition,project,engagement,workflow,cycleId});
          return send(200,{...projection,referenceAdded:!previous});
        }
        const engagementRoute = /^\/api\/engagements\/([a-f0-9-]+)(?:\/(commands|offline-commands|index|search|assist|assistant|document-classifications|document-comparisons|document-relations|exchange|baselines)(?:\/([a-f0-9-]+)\/export)?)?$/.exec(url.pathname);
        if (engagementRoute) {
          const [, id, operation, baselineId] = engagementRoute, service = store.engagements(), engagement = service.get(id);
          if (!operation && method === "GET") return send(200, engagement);
          if(operation==="offline-commands"&&method==="POST"){
            const body=await jsonBody(request,1024*1024);
            if(Object.keys(body).some(key=>!["expectedRevision","actorId","command","offlineOperation"].includes(key))||!body.offlineOperation)throw fail("Reconcile one identified offline draft using its expected revision and author.");
            return send(200,service.mutate(id,body.expectedRevision,body.command,body.actorId,{offlineOperation:body.offlineOperation}));
          }
          if (operation === "commands" && method === "POST") {
            const body = await jsonBody(request, 4 * 1024 * 1024);
            if (Object.keys(body).some(key => !["expectedRevision", "actorId", "command"].includes(key))) throw fail("Save an engagement command using its actor and expected revision only.");
            let extractionBinding,sourceReviewBinding;
            if(body.command?.type==='source-review-save'){
              const prior=(engagement.sourceReviews||[]).some(row=>row.requestKey===body.command.requestKey);
              if(!prior&&body.expectedRevision!==engagement.revision)throw fail('The engagement changed before retaining source coverage.',409);
              const project={...store.getProject(engagement.projectId),accountId:store.account.custodyId};
              sourceReviewBinding=await prepareEngagementSourceReview({engagement,project,command:body.command,actorId:body.actorId,readVersion:versionId=>store.readVersion(project.id,versionId),indexes:evidenceIndexes});
            }
            if(body.command?.type==="assertion-save"&&body.command.extractionReference!==undefined){
              if(body.expectedRevision!==engagement.revision)throw fail("This engagement changed. Reload before saving your retained draft.",409);
              const reference=body.command.extractionReference;
              if(!reference||typeof reference!=="object"||Array.isArray(reference)||Object.keys(reference).some(key=>!["indexId","passageId","sourceReviewId"].includes(key)))throw fail("Choose an exact indexed passage reference.");
              const project=store.getProject(engagement.projectId);
              extractionBinding=await evidenceIndexes.resolveExtraction({accountId:store.account.custodyId,project,...reference,sourceReviews:engagement.sourceReviews||[],actorId:body.actorId,readVersion:versionId=>store.readVersion(project.id,versionId),quote:body.command.quote,versionId:body.command.versionId,locator:body.command.locator});
            }
            return send(200, service.mutate(id, body.expectedRevision, body.command, body.actorId,{extractionBinding,sourceReviewBinding}));
          }
          if (operation === "assistant" && method === "GET") return send(200, assistant.describe());
          if(["document-comparisons","document-relations"].includes(operation)&&method==="POST"){
            const body=await jsonBody(request,128*1024),allowed=operation==="document-comparisons"?["leftVersionId","rightVersionId","expectedRevision","expectedProjectRevision"]:["request_id","actorId","expectedRevision","expectedProjectRevision","command"];
            if(Object.keys(body).some(key=>!allowed.includes(key)))throw fail("Use an exact document comparison or reviewed relationship request.");
            const project=store.getProject(engagement.projectId);
            if(operation==="document-relations"){
              if(!body.command||typeof body.command!=="object"||Array.isArray(body.command)||Object.keys(body.command).some(key=>!["leftVersionId","rightVersionId","leftSha256","rightSha256","leftMetadataSha256","rightMetadataSha256","comparisonSha256","decision","statement"].includes(key)))throw fail("Use the exact reviewed comparison command without identity or operation overrides.");
              if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.request_id||""))throw fail("A reviewed document relationship requires an exact request UUID.");
              if(![...engagement.roles.preparer,...engagement.roles.reviewer].includes(body.actorId))throw fail("An assigned preparer or reviewer must record the relationship.",403);
              const prior=project.resources.flatMap(row=>row.metadataHistory||[]).find(row=>row.id===body.request_id);
              if(prior){const relation=prior.metadata.revisionRelation,command=body.command;if(prior.operation!=="document-relation-review"||!relation||relation.engagementId!==id||relation.review.actorId!==body.actorId||relation.sourceVersionId!==command?.rightVersionId||relation.sourceSha256!==command?.rightSha256||relation.predecessor.versionId!==command?.leftVersionId||relation.predecessor.sha256!==command?.leftSha256||relation.leftMetadataSha256!==command?.leftMetadataSha256||relation.rightMetadataSha256!==command?.rightMetadataSha256||relation.comparisonSha256!==command?.comparisonSha256||relation.decision!==command?.decision||relation.review.statement!==command?.statement)throw fail("This relationship request already identifies different reviewed work.",409);return send(200,{project,engagement,revisionRelation:relation,duplicate:true});}
            }
            if(body.expectedRevision!==engagement.revision||body.expectedProjectRevision!==project.revision)throw fail("The engagement or source register changed. Refresh before comparing these originals.",409);
            const args={engagement,project,readVersion:versionId=>store.readVersion(project.id,versionId)};
            if(operation==="document-comparisons"){const comparison=await compareEngagementDocuments({...args,leftVersionId:body.leftVersionId,rightVersionId:body.rightVersionId});if(service.get(id).revision!==engagement.revision||store.getProject(project.id).revision!==project.revision)throw fail("The comparison context changed. Compare the current originals again.",409);return send(200,comparison);}
            const change=await prepareEngagementDocumentRelation({...args,command:body.command,actorId:body.actorId,at:new Date().toISOString()});
            if(service.get(id).revision!==engagement.revision)throw fail("The engagement changed before saving this document relationship.",409);
            return send(200,{project:store.mutate(project.id,project.revision,{type:"document-relation",versionId:change.versionId,metadata:change.metadata},{metadataRequestId:body.request_id,revisionRelationAuthority:{projectId:project.id,versionId:change.versionId,sourceSha256:change.sourceSha256,engagementId:id,revisionRelation:change.metadata.revisionRelation}}),engagement,revisionRelation:change.metadata.revisionRelation});
          }
          if(operation==="document-classifications"&&method==="POST"){
            const body=await jsonBody(request,1024*1024),exact=(value,allowed,label)=>{if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw fail(`${label} contains unsupported fields.`);};
            exact(body,["expectedRevision","expectedProjectRevision","actorId","command"],"Document classification request");
            if(body.expectedRevision!==engagement.revision)throw fail("This engagement changed. Refresh before reviewing document classification.",409);
            if(![...engagement.roles.preparer,...engagement.roles.reviewer].includes(body.actorId))throw fail("Document classification needs an assigned engagement preparer or reviewer.",403);
            const project=store.getProject(engagement.projectId),command=body.command;
            if(body.expectedProjectRevision!==project.revision)throw fail("The source project changed. Refresh before applying this document classification.",409);
            const {metadata,classification,versionId}=await prepareEngagementDocumentClassification({engagement,project,command,actorId:body.actorId,at:new Date().toISOString(),readVersion:versionId=>store.readVersion(project.id,versionId),indexes:evidenceIndexes,accountId:store.account.custodyId});
            if(service.get(id).revision!==engagement.revision)throw fail("This engagement changed while its source was being checked. Refresh before saving classification.",409);
            return send(200,{project:store.mutate(project.id,body.expectedProjectRevision,{type:"document-classification",versionId,metadata},{classificationAuthority:{projectId:project.id,versionId,sourceSha256:classification.sourceSha256,engagementId:id,classification}}),classification});
          }
          if(operation==="search"&&method==="POST"){
            const body=await jsonBody(request,4096);
            if(Object.keys(body).some(key=>!["indexId","query","retrieval","limit"].includes(key))||typeof body.query!=="string"||body.query.length>2000)throw fail("Choose a retained index and a bounded search query.");
            const project=store.getProject(engagement.projectId);
            return send(200,await evidenceIndexes.search({accountId:store.account.custodyId,project,indexId:body.indexId,readVersion:versionId=>store.readVersion(project.id,versionId),query:body.query,retrieval:body.retrieval??"lexical",limit:body.limit??40,lexical:retrieveEngagementPassages}));
          }
          if (["index", "assist"].includes(operation) && method === "POST") {
            const body = await jsonBody(request, 32768);
            if (Object.keys(body).some(key => !["versionIds", "pageRanges", "ocrPages", "maxSourceBytes", "query", "retrieval",...(operation === "assist" ? ["task", "cycleId", "indexId"] : ["indexId", "continueIndexId"])].includes(key)) || body.query !== undefined && (typeof body.query !== "string" || body.query.length > 2000)||body.retrieval!==undefined&&!["lexical","semantic","hybrid"].includes(body.retrieval)||body.indexId!==undefined&&(body.versionIds!==undefined||typeof body.indexId!=="string"||!/^index_[a-f0-9]{64}$/.test(body.indexId))) throw fail("Choose source versions and a bounded search or assistance task.");
            const cycle = body.cycleId === undefined ? null : engagement.cycles?.find(item=>item.id===body.cycleId);
            if(body.cycleId!==undefined&&!cycle)throw fail("Select a monitoring cycle in this engagement.",404);
            if(operation==="assist"&&body.task==="measurements"&&!cycle)throw fail("Select a monitoring cycle before extracting indicator measurements.");
            if (operation === "assist" && assistant.available === false) return send(200, await assistant.propose({task: body.task}));
            const project = store.getProject(engagement.projectId);
            const readVersion=versionId=>store.readVersion(project.id,versionId),retrieval=body.retrieval??"lexical";
            if (body.indexId !== undefined && (body.pageRanges !== undefined || body.ocrPages !== undefined || body.maxSourceBytes !== undefined || body.continueIndexId !== undefined) || body.continueIndexId !== undefined && (typeof body.continueIndexId !== "string" || !Array.isArray(body.versionIds) || !Array.isArray(body.pageRanges))) throw fail("Continue an index with explicit source versions and PDF page ranges.");
            let index;
            if (body.indexId) index = await evidenceIndexes.load({accountId:store.account.custodyId,project,indexId:body.indexId,readVersion,semantic:retrieval!=="lexical"});
            else {
              const previous = body.continueIndexId ? await evidenceIndexes.load({accountId:store.account.custodyId,project,indexId:body.continueIndexId,readVersion}) : null;
              const extracted = await indexEngagementSources({project,readVersion,...(body.versionIds===undefined?{}:{versionIds:body.versionIds}),...(body.pageRanges===undefined?{}:{pageRanges:body.pageRanges}),...(body.ocrPages===undefined?{}:{ocrPages:body.ocrPages}),...(body.maxSourceBytes===undefined?{}:{maxSourceBytes:body.maxSourceBytes})});
              index = evidenceIndexes.store({accountId:store.account.custodyId,project,index:previous?mergeEngagementSourceIndexes(previous,extracted):extracted,semantic:retrieval!=="lexical"});
            }
            if (service.get(id).revision !== engagement.revision) throw fail("The engagement changed while its sources were being read. Refresh before applying suggestions.", 409);
            const search=query=>evidenceIndexes.search({accountId:store.account.custodyId,project,indexId:index.indexId,readVersion,query,retrieval,limit:40,lexical:retrieveEngagementPassages});
            if (operation === "index") return send(200, {...index, ...(body.query ? {matches:await search(body.query)} : {})});
            const mandate = {id, name: engagement.name, scope: engagement.scope, exclusions: engagement.exclusions, client: engagement.client, deliverables: engagement.deliverables};
            const requirements=cycle?engagement.requirements.filter(item=>cycle.requirementIds.includes(item.id)):engagement.requirements;
            const selected = selectEngagementAssistancePassages(index, {task: body.task, query: body.query || "", requirements, engagement: mandate});selected.selection.indexId=index.indexId;
            if(retrieval!=="lexical"){
              const matches=await search(body.query||[mandate.name,...mandate.scope,...requirements.slice(0,200).map(item=>item.title+" "+item.text)].join(" ").slice(0,12000));
              let characters=0;selected.passages=matches.candidates.filter(passage=>{if(characters+passage.quote.length>48000)return false;characters+=passage.quote.length;return true;});
              selected.selection={...selected.selection,method:matches.method,algorithm:matches.algorithm,queryCoverage:matches.queryCoverage,indexId:index.indexId,selectedPassages:selected.passages.length,selectedDocuments:new Set(selected.passages.map(item=>item.versionId)).size,characters,requirementCandidates:[],warnings:[...selected.selection.warnings,...(matches.warnings||[]),"Latent retrieval does not establish requirement applicability or source support. The human reviewer must assess each suggested link."]};
            }
            const result = await assistant.propose({task: body.task, query: body.query || "", engagement: mandate,
              requirements, assertions: engagement.assertions, findings: engagement.findings.filter(item=>(item.cycleId||null)===(cycle?.id||null)), actions: engagement.actions.filter(item=>(item.cycleId||null)===(cycle?.id||null)), passages: selected.passages, selection: selected.selection,
              ...(cycle?{cycleId:cycle.id,cycle,program:engagement.programs.find(item=>item.id===cycle.programId),indicators:engagement.indicators.filter(item=>item.programId===cycle.programId),priorFindings:engagement.findings.filter(item=>!item.cycleId||engagement.cycles.some(previous=>previous.id===item.cycleId&&previous.programId===cycle.programId&&previous.periodEnd<cycle.periodStart))}:{})});
            if (service.get(id).revision !== engagement.revision) throw fail("The engagement changed while assistance was running. Refresh and review the current sources.", 409);
            return send(200, {...result, selection: selected.selection});
          }
          if (operation === "exchange" && method === "GET") return send(200, {format: "esia-engagement-project-exchange", schemaVersion: 1, projectId: engagement.projectId, accountId: store.account.custodyId, engagements: service.exportProject(engagement.projectId)}, undefined,
            {"content-disposition": `attachment; filename="engagement-${id}.json"`});
          if (operation === "baselines" && baselineId && method === "GET") {
            const baseline = engagement.baselines.find(item => item.id === baselineId);
            if (!baseline) throw fail("The approved baseline was not found in this engagement.", 404);
            const publication = engagement.publications.find(item => item.baselineId === baselineId);
            if (!publication) throw fail("Complete the required acceptance and publish this approved baseline before exporting deliverables.", 409);
            const snapshot = baseline.snapshot || baseline;
            const reportOptions={};
            if([...url.searchParams.keys()].some(key=>!["format","cycleId","reportType","frameworkId","missionId","eventId","templateId","templateVersion"].includes(key)))throw fail("Choose a supported monitoring report selection.");
            for(const key of ["cycleId","reportType","frameworkId","missionId","eventId","templateId","templateVersion"])if(url.searchParams.has(key))reportOptions[key]=url.searchParams.get(key);
            if(reportOptions.reportType&&!['periodic','independent','neutral','institutional','mission','incident'].includes(reportOptions.reportType))throw fail("Choose a supported monitoring report type.");
            for(const [key,collection] of [["cycleId","cycles"],["missionId","missions"],["eventId","events"]])if(reportOptions[key]&&!(snapshot[collection]||[]).some(item=>item.id===reportOptions[key]))throw fail("This report selection is outside the approved monitoring baseline.",404);
            if(reportOptions.frameworkId&&!snapshot.engagement.frameworkIds.includes(reportOptions.frameworkId))throw fail("This framework is outside the approved engagement scope.",404);
            for(const [key,collection]of [["missionId","missions"],["eventId","events"]])if(reportOptions[key]&&reportOptions.cycleId){const record=snapshot[collection].find(item=>item.id===reportOptions[key]),cycle=snapshot.cycles.find(item=>item.id===reportOptions.cycleId);if(record.cycleId!==cycle.id&&!(key==="eventId"&&!record.cycleId&&record.programId===cycle.programId))throw fail("Choose records from the selected approved monitoring cycle or its program-wide event register.");}
            const format=url.searchParams.get("format")||"json";let retained=service.findIssuedRendition(id,{baselineId,publicationId:publication.id,format,selection:reportOptions});
            if(!retained){const exported=await exportEngagementSnapshot(snapshot,format,reportOptions);retained=service.retainIssuedRendition(id,{baselineId,publicationId:publication.id,format,selection:reportOptions,...exported});}
            const record=retained.metadata;
            return send(200, retained.bytes, record.mediaType, {"content-disposition": `attachment; filename="${record.filename}"`, "x-esia-publication-id": record.publicationId, "x-esia-baseline-id": record.baselineId, "x-esia-baseline-sha256": record.baselineSha256,"x-esia-rendition-id":record.id,"x-esia-rendition-sha256":record.sha256, "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"});
          }
          throw fail("This engagement operation is unavailable.", 405);
        }
        const oversightProject = /^\/api\/oversight\/projects\/([A-Za-z0-9_.:-]+)(?:\/(commands|history|backup|restore|imports)(?:\/([A-Za-z0-9_.:-]+))?)?$/.exec(url.pathname);
        if (oversightProject) {
          const [, projectId, operation, recordId] = oversightProject, service = oversight(accountId);
          if (!operation && method === 'GET') return send(200, service.get(projectId));
          if (operation === 'commands' && !recordId && method === 'POST') return send(200, service.mutate(projectId, await jsonBody(request)));
          if (operation === 'history' && recordId && method === 'GET') return send(200, service.history(projectId, recordId));
          if (operation === 'backup' && !recordId && method === 'GET')return send(200,Buffer.from(JSON.stringify(service.exportProjectBackup(projectId))), 'application/json; charset=utf-8',{'content-disposition':`attachment; filename="oversight-backup-${projectId}.json"`});
          if (operation === 'restore' && !recordId && method === 'POST')return send(200,service.restoreProjectBackup(projectId,await jsonBody(request,17*1024*1024)));
          if (operation === 'imports' && !recordId && method === 'GET')return send(200,service.listProjectImports(projectId));
          throw fail('This oversight operation is unavailable.', 405);
        }
        if (url.pathname === '/api/oversight/portfolio' && method === 'GET') {
          const {asOf, ...filters} = Object.fromEntries(url.searchParams);
          return send(200, oversight(accountId).portfolio({filters, ...(asOf ? {asOf} : {})}));
        }
        if (url.pathname === '/api/oversight/snapshots') {
          if (method === 'GET') return send(200, oversight(accountId).listSnapshots(Object.fromEntries(url.searchParams)));
          if (method === 'POST') return send(201, oversight(accountId).issueSnapshot(await jsonBody(request)));
          throw fail('This oversight snapshot operation is unavailable.', 405);
        }
        const oversightSnapshot = /^\/api\/oversight\/snapshots\/([A-Za-z0-9_.:-]+)(\/export)?$/.exec(url.pathname);
        if (oversightSnapshot && method === 'GET') {
          const snapshot = oversight(accountId).getSnapshot(oversightSnapshot[1]);
          if (!oversightSnapshot[2]) return send(200, snapshot);
          const format = url.searchParams.get('format') || 'json';
          if (!['json','html','xlsx'].includes(format)) throw fail('Choose JSON, web report or Excel.');
          const filename = `oversight-${snapshot.kind}-${snapshot.id}.${format}`;
          const media = {json:'application/json; charset=utf-8',html:'text/html; charset=utf-8',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[format];
          const content = format === 'xlsx' ? await renderOversightWorkbook(snapshot) : format === 'html' ? renderOversightReportHtml(snapshot) : JSON.stringify(snapshot, null, 2);
          return send(200, Buffer.isBuffer(content) ? content : Buffer.from(content), media, {'content-disposition':`attachment; filename="${filename}"`,'content-security-policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"});
        }
        const accountShares = /^\/api\/projects\/([A-Za-z0-9_.:-]+)\/shares(?:\/([a-f0-9-]+)\/(register|revoke))?$/.exec(url.pathname);
        if (accountShares) {
          const [, projectId, shareId, operation] = accountShares;store.getProject(projectId);
          const owner = {type: "account", accountId: store.account.custodyId, projectId};
          if (!shareId && method === "GET") {
            const direction = url.searchParams.get("direction") || "outgoing";
            if (!["outgoing", "incoming"].includes(direction)) throw fail("Choose incoming or outgoing file shares.");
            return send(200, {shares: workspace.fileSharing().listShares(direction === "incoming" ? {target: {accountId: owner.accountId, projectId}} : {owner})});
          }
          if (!shareId && method === "POST") return send(201, createAndRegisterShare(owner, await jsonBody(request)));
          if (shareId && method === "POST") {
            const body = await jsonBody(request);if (Object.keys(body).some(key => key !== "expectedRevision")) throw fail("Use the selected account/project and expected revision only.");
            return send(200, operation === "register" ? store.registerShare(shareId, {projectId, expectedRevision: body.expectedRevision}) : {share: workspace.fileSharing().revokeShare(shareId, {owner, expectedRevision: body.expectedRevision})});
          }
          throw fail("This account file-sharing operation is unavailable.", 405);
        }
        const readMaster = id => {
          const project = store.getProject(id);
          if (!project.projectContext?.identity.id) throw fail("Link this client review to its real-world project identity before using a master.", 409);
          const candidates = project.resources.flatMap(resource => resource.versions.filter(version => version.mediaType === "application/vnd.esia.master+json").slice(-1));
          if (candidates.length !== 1) throw fail(candidates.length ? "Choose one authoritative client master resource for this account review." : "No client master has been installed in this account review.", 409);
          const {bytes, version} = store.readVersion(id, candidates[0].id);
          if (bytes.length > 8 * 1024 * 1024) throw fail("The client master exceeds 8 MiB.", 413);
          let pack;try {pack = JSON.parse(bytes.toString("utf8"));} catch {throw fail("The client master resource contains invalid JSON.");}
          pack = validateMasterPack(pack, {projectId: project.id, accountCustodyId: project.storageAccount.id, identityId: project.projectContext?.identity.id});
          return {project, pack, version};
        };
        const masterRoute = /^\/api\/projects\/([A-Za-z0-9_.:-]+)\/master(?:\/(reviews|export))?$/.exec(url.pathname);
        if (masterRoute) {
          const [, id, operation] = masterRoute, {project, pack, version} = readMaster(id);
          if (!operation && method === "GET") return send(200, {...buildMasterCompliance(project, pack), packVersionId: version.id, packSha256: version.sha256});
          if (operation === "export" && method === "GET") {
            const artifact = await masterComplianceExport(buildMasterCompliance(project, pack), url.searchParams.get("format") || "xlsx");
            return send(200, artifact.bytes, artifact.mediaType, {"content-disposition": `attachment; filename="${artifact.filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`, "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'"});
          }
          if (operation === "reviews" && method === "POST") {
            const body = await jsonBody(request), allowed = ["expectedRevision", "rowId", "reviewer", "applicability", "conclusion", "rationale", "missingEvidence", "uncertainty", "riskSignificance", "supportingSources"];
            if (Object.keys(body).some(key => !allowed.includes(key))) throw fail("Review the selected master row; account routing and framework definitions cannot be supplied here.");
            const row = pack.register.rows.find(item => item.id === body.rowId);
            if (!row) throw fail("This criterion is unavailable in the selected client master.", 404);
            const framework = masterFramework(row), sourceReferences = row.sourceIds.map(sourceId => {
              const source = pack.register.sources.find(item => item.id === sourceId);
              return {title: source.title, url: source.url, sha256: source.sha256, locator: row.locators.filter(item => item.sourceId === sourceId).map(item => [item.pdfPage ? `PDF p${item.pdfPage}` : "", item.printedPage ? `printed p${item.printedPage}` : "", item.section].filter(Boolean).join("; ")).join(" | ")};
            });
            if (body.supportingSources !== undefined && (!Array.isArray(body.supportingSources) || body.supportingSources.length > 10)) throw fail("Select at most ten exact archived source versions for a review.");
            const selected = new Set();
            for (const support of body.supportingSources || []) {
              if (!support || typeof support !== "object" || Object.keys(support).some(key => !["versionId", "locator"].includes(key)) || typeof support.locator !== "string" || !support.locator.trim() || support.locator.length > 1000 || selected.has(support.versionId)) throw fail("Each supporting version needs a unique identity and a reviewed page or section locator.");
              selected.add(support.versionId);
              const resource = pack.evidenceIndex.find(item => item.versions.some(version => version.id === support.versionId));
              const expected = resource?.versions.find(item => item.id === support.versionId);
              if (!expected) throw fail("Supporting evidence must be selected from this master’s pinned public archive index.", 404);
              const retained = archive(masterArchiveCollection(pack)).readVersion(expected.id);
              if (retained.version.sha256 !== expected.sha256 || retained.version.size !== expected.size || retained.resource.id !== resource.id || retained.resource.url !== resource.url) throw fail("The supporting original does not match the pinned master index.", 409);
              sourceReferences.push({title: `Practitioner-selected supporting source: ${resource.title}`, url: resource.url, sha256: expected.sha256, locator: support.locator.trim()});
            }
            if (sourceReferences.length > 20) throw fail("This review exceeds the supported twenty source citations.");
            store.mutate(id, body.expectedRevision, {type: "assessment", framework, applicability: body.applicability, conclusion: body.conclusion,
              reviewer: body.reviewer, rationale: body.rationale, evidenceIds: [], missingEvidence: body.missingEvidence || "", uncertainty: body.uncertainty || "", riskSignificance: body.riskSignificance || "",
              auditContext: {frameworkId: row.frameworkId, checkId: row.id, checkSet: "master", registryVersion: `${pack.register.projectIdentity}-public-scope-v${pack.register.schemaVersion}`,
                topic: row.component, prompt: row.title, checkedAt: new Date().toISOString().slice(0, 10), framework, sources: sourceReferences,
                coverage: `Public-source client master; phase ${row.phaseId}; actor ${row.actor}. Applicability source statements do not establish compliance or complete contract coverage. Supporting sources remain separately retained public archive records.`}});
            return send(201, {...buildMasterCompliance(store.getProject(id), pack), packVersionId: version.id, packSha256: version.sha256});
          }
          throw fail("This master operation is unavailable.", 405);
        }
        if (url.pathname === "/api/files" && method === "GET") return send(200, store.listFiles(Object.fromEntries(url.searchParams)));
        if (url.pathname === "/api/project-directory" && method === "GET") return send(200, workspace.listProjectDirectory());
        if (url.pathname === "/api/project-identities" && method === "GET") return send(200, workspace.listProjectDirectory().identities);
        if (url.pathname === "/api/project-identities" && method === "POST") return send(201, workspace.createProjectIdentity(await jsonBody(request)));
        const sharedReferenceRoute = /^\/api\/project-identities\/([A-Za-z0-9_.:-]+)\/references$/.exec(url.pathname);
        if (sharedReferenceRoute && method === "POST") return send(201, workspace.addProjectReference(sharedReferenceRoute[1], await jsonBody(request)));
        const projectContextRoute = /^\/api\/projects\/([A-Za-z0-9_.:-]+)\/(context|frameworks)$/.exec(url.pathname);
        if (projectContextRoute && method === "PUT") {
          const body = await jsonBody(request);
          return send(200, projectContextRoute[2] === "context" ? store.linkProjectContext(projectContextRoute[1], body) : store.setProjectFrameworks(projectContextRoute[1], body));
        }
        if (url.pathname === "/api/intake/inspect" && method === "POST") return send(200, await enrichSpatialInspection(await inspect(await jsonBody(request))));
        if (url.pathname === "/api/intake/capture" && method === "POST") return send(200, await enrichSpatialInspection(await capture((await jsonBody(request)).url)));
        const policyCoverageRoute = /^\/api\/policy-coverage\/([A-Za-z0-9_]+)(?:\/(commands|packet))?$/.exec(url.pathname);
        if(policyCoverageRoute){
          const [,frameworkId,operation]=policyCoverageRoute,review=policyCoverage(accountId);
          const command=operation==='commands'&&method==='POST'?await jsonBody(request):undefined;
          // Read current permissions after the complete command arrives. Source
          // retention and a cached inspection never confer a processing grant.
          const currentPermissions=frameworkId===IFC_PS5_COVERAGE_SCOPE.frameworkId?policyStandardSourcePermissions(await(await library()).exportCatalog()):undefined;
          if(!operation&&method==='GET')return send(200,review.inspect(frameworkId,{offset:Number(url.searchParams.get('offset')||0),limit:Number(url.searchParams.get('limit')||30),standard:url.searchParams.get('standard')||'',currentPermissions}));
          if(operation==='packet'&&method==='GET')return send(200,review.packet(frameworkId,{currentPermissions}),'application/json; charset=utf-8',{'content-disposition':`attachment; filename="${frameworkId}-policy-review.json"`});
          if(operation==='commands'&&method==='POST')return send(200,review.command(frameworkId,command,{currentPermissions}));
          throw fail('This policy coverage operation is unavailable.',405);
        }
        const policyOriginalRoute = /^\/api\/requirements\/([A-Za-z0-9_]+)\/sources\/([a-f0-9]{64})\/(preview|download)$/.exec(url.pathname);
        if (policyOriginalRoute) {
          const [, frameworkId, sha256, operation] = policyOriginalRoute;
          if (method !== (operation === "download" ? "POST" : "GET")) throw fail("This policy source operation is unavailable.", 405);
          const retained = await readLocalPolicyOriginal({directory: join(dataPath, "policy-library"), frameworkId, sha256});
          if (operation === "preview") return send(200, {...await buildDocumentPreview(retained, {page: url.searchParams.has("page") ? url.searchParams.get("page") : 1}), policy: retained.policy});
          return send(200, retained.bytes, "application/octet-stream", {"content-disposition": `attachment; filename="${retained.version.filename}"`, "content-security-policy": "sandbox; default-src 'none'", "X-ESIA-Source-SHA256": sha256});
        }
        const libraryRoute = /^\/api\/requirements\/([A-Za-z0-9_]+)$/.exec(url.pathname);
        if (libraryRoute && method === "GET") {
          const id = libraryRoute[1];
          if (!getFramework(id)) throw fail("Unknown framework edition.", 404);
          let bytes;
          try {bytes = await readFile(join(dataPath, "policy-library", `${id}.json`));}
          catch {throw fail("The private policy library is not installed in this workspace. Run the requirement extraction command or restore its policy-library folder.", 404);}
          if (bytes.length > 64 * 1024 * 1024) throw fail("The private requirement library exceeds the supported size.", 413);
          const pack = JSON.parse(bytes.toString("utf8"));
          if (pack.frameworkId !== id) throw fail("The private library belongs to a different framework edition.", 422);
          registerDetailedRequirementPack(pack);
          return send(200, pack);
        }
        const handoverExport=/^\/api\/projects\/([A-Za-z0-9_.:-]+)\/handover(?:\/([a-f0-9]{64})(?:\/chunks\/([a-f0-9]{64}))?)?$/.exec(url.pathname);
        if(handoverExport){
          const [,projectId,manifestId,chunkSha256]=handoverExport;
          if(!manifestId&&method==='POST')return send(200,projectHandovers.export(store,projectId,await jsonBody(request,4096)));
          if(manifestId&&chunkSha256&&method==='GET')return send(200,projectHandovers.readChunk(store,projectId,manifestId,chunkSha256),'application/octet-stream');
          if(manifestId&&!chunkSha256&&method==='DELETE')return send(200,projectHandovers.discardExport(store,projectId,manifestId));
          throw fail('Use an explicit manual handover export, exact chunk read or artifact discard.',405);
        }
        const handoverImport=/^\/api\/handover-imports(?:\/([a-f0-9]{64})(?:\/(chunks|finalize))?)?$/.exec(url.pathname);
        if(handoverImport){
          const [,manifestId,operation]=handoverImport,scope=store.account.custodyId;
          if(!manifestId&&method==='POST')return send(200,projectHandovers.begin(scope,await jsonBody(request,4*1024*1024)));
          if(manifestId&&!operation&&method==='GET')return send(200,projectHandovers.progress(scope,manifestId));
          if(manifestId&&operation==='chunks'&&method==='POST')return send(200,projectHandovers.upload(scope,manifestId,await jsonBody(request,2*1024*1024)));
          if(manifestId&&operation==='finalize'&&method==='POST'){const body=await jsonBody(request,4096);if(Object.keys(body).length)throw fail('Finalize the exact retained manual handover without replacing its scope.');return send(200,projectHandovers.finalize(scope,manifestId));}
          if(manifestId&&!operation&&method==='DELETE')return send(200,projectHandovers.discard(scope,manifestId));
          throw fail('Use an explicit manual handover begin, chunk upload, status, finalize or discard operation.',405);
        }
        if (url.pathname === "/api/projects" && method === "GET") return send(200, store.listProjects());
        if (url.pathname === "/api/projects" && method === "POST") return send(201, store.createProject(await jsonBody(request)));
        if (url.pathname === "/api/import" && method === "POST") {
          const input = await jsonBody(request);
          return send(200, store.importProject(input.package ?? input, {adoptLegacyAccount: input.adoptLegacyAccount === true}));
        }
        if (url.pathname === "/api/publication-previews" && method === "POST") return send(200, {html: renderPublicationFragment((await jsonBody(request)).content)});
        if (url.pathname === "/api/publications" && method === "GET") return send(200, store.publications().list(url.searchParams.get("project_id")));
        if (url.pathname === "/api/publications" && method === "POST") return send(201, store.publications().create(await jsonBody(request)));
        const publicationRoute = /^\/api\/publications\/([A-Za-z0-9_.:-]+)(?:\/(editions|share)(?:\/([A-Za-z0-9_.:-]+)(\/export)?)?)?$/.exec(url.pathname);
        if (publicationRoute) {
          const [, id, operation, editionId, exporting] = publicationRoute, publications = store.publications();
          if (!operation && method === "GET") return send(200, publications.get(id));
          if (!operation && method === "PATCH") return send(200, publications.update(id, await jsonBody(request)));
          if (operation === "editions" && !editionId && method === "POST") return send(201, publications.issue(id, await jsonBody(request)));
          if (operation === "editions" && editionId && method === "GET") {
            const {edition} = publications.edition(id, editionId);
            if (!exporting) return send(200, {edition});
            const artifact = await publicationExport(edition, url.searchParams.get("format") || "html");
            const filename = String(edition.content.title).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100);
            return send(200, artifact.bytes, artifact.mediaType, {"content-disposition": `attachment; filename="${filename}.${artifact.extension}"`,
              "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"});
          }
          if (operation === "share" && method === "POST") return publications.share(id);
        }
        const spatialEditContextRoute = /^\/api\/projects\/([A-Za-z0-9_.:-]+)\/versions\/([A-Za-z0-9_.:-]+)\/spatial-edit-context$/.exec(url.pathname);
        if (spatialEditContextRoute) {
          if (method !== 'GET' || url.search) throw fail('Use the exact account-scoped spatial edit context read.', 405);
          return send(200, Buffer.from(serializeGeoJsonData(store.spatialEditContext(spatialEditContextRoute[1], spatialEditContextRoute[2]), {maxBytes:3 * 1024 * 1024}), 'utf8'));
        }
        const spatialEditRoute = /^\/api\/projects\/([A-Za-z0-9_.:-]+)\/spatial-edits$/.exec(url.pathname);
        if (spatialEditRoute) {
          if (method !== 'POST' || url.search) throw fail('Save spatial edits explicitly in the selected account.', 405);
          const body = await jsonBody(request, 3 * 1024 * 1024);
          if (Object.keys(body).length !== 2 || !Object.hasOwn(body, 'expectedRevision') || !Object.hasOwn(body, 'command') || body.command?.type !== 'source-geojson-edit') throw fail('Use the exact new-version spatial edit request.');
          return send(200, store.saveGeoJsonEdit(spatialEditRoute[1], body.expectedRevision, body.command));
        }
        const passageRoute = /^\/api\/projects\/([A-Za-z0-9_.:-]+)\/versions\/([A-Za-z0-9_.:-]+)\/passage-preview$/.exec(url.pathname);
        if(passageRoute&&method==='POST'){if(url.search)throw Object.assign(Error("Passage quotes belong in the request body."),{status:400});const body=normalizeDocumentPassageRequest(await jsonBody(request));return send(200,await buildDocumentPassagePreview(store.readVersion(passageRoute[1],passageRoute[2]),body));}
        const previewRoute = /^\/api\/projects\/([A-Za-z0-9_.:-]+)\/versions\/([A-Za-z0-9_.:-]+)\/preview$/.exec(url.pathname);
        if (previewRoute && method === "GET") return send(200, await buildDocumentPreview(store.readVersion(previewRoute[1], previewRoute[2]), {page: url.searchParams.has("page") ? url.searchParams.get("page") : 1}));
        const reportRoute = /^\/api\/projects\/([A-Za-z0-9_.:-]+)\/reports\/([A-Za-z0-9_.:-]+)$/.exec(url.pathname);
        if (reportRoute && method === "GET") {
          const [, projectId, reportId] = reportRoute;
          const report = store.getProject(projectId).reports.find(report => report.id === reportId);
          if (!report) throw fail("The issued report was not found in this project.", 404);
          const frozen = buildGapReportModel(report);
          const model = {...frozen, storageAccount: {id: store.account.custodyId, name: store.account.name, organization: store.account.organization, dataOwner: store.account.dataOwner},
            notes: [...frozen.notes, `Current local custody account: ${store.account.name}. Organization: ${store.account.organization || "Not recorded"}; recorded data owner: ${store.account.dataOwner || "Not recorded"}. This custody label does not establish document copyright or sharing permission.`]};
          const format = url.searchParams.get("format") || "json";
          const stem = `${store.account.name}-${report.title}`.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 160) || "gap-analysis";
          if (format === "json") return send(200, model);
          if (format === "xlsx") {
            const {renderGapReportXlsx} = await import("./gap-report-xlsx.mjs");
            return send(200, await renderGapReportXlsx(model, {paperSize: model.paperSize}), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", {"content-disposition": `attachment; filename="${stem}.xlsx"`});
          }
          if (format === "html") {
            const {renderGapReportHtml} = await import("./gap-report-html.mjs");
            let html = renderGapReportHtml(model);
            if (url.searchParams.get("download") === "1") {
              const css = await readFile(join(appRoot, "src/styles/gap-report.css"), "utf8");
              html = html.replace(/<link\b[^>]*href="\/gap-report\.css"[^>]*>/, `<style>${css}</style>`);
              return send(200, html, "text/html; charset=utf-8", {"content-disposition": `attachment; filename="${stem}.html"`,
                "content-security-policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"});
            }
            return send(200, html, "text/html; charset=utf-8");
          }
          throw fail("Choose json, xlsx or html report format.");
        }
        const route = /^\/api\/projects\/([A-Za-z0-9_.:-]+)(?:\/(commands|export|versions)(?:\/([A-Za-z0-9_.:-]+)\/download)?)?$/.exec(url.pathname);
        if (route) {
          const [, id, operation, versionId] = route;
          if (!operation && method === "GET") return send(200, store.getProject(id));
          if (operation === "commands" && method === "POST") {
            const input = await jsonBody(request);
            if (Object.hasOwn(input, "accountId") || Object.hasOwn(input, "storageAccount")) throw fail("Select the storage account using the account control.");
            if (input.command?.type === "field-capture") {
              return send(200,applyFieldCapture(store,id,input.expectedRevision,input.command,{deviceLease:input.deviceLease}));
            }
            return send(200, store.mutate(id, input.expectedRevision, input.command));
          }
          if (operation === "export" && method === "GET") return send(200, store.exportProject(id), undefined,
            {"content-disposition": `attachment; filename="${id}.esia.json"`});
          if (operation === "versions" && versionId && method === "POST") {
            const {bytes, version} = store.readVersion(id, versionId);
            // Always download originals. In particular, archived HTML never executes at this origin.
            const filename = String(version.filename).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 180) || "source";
            return send(200, bytes, "application/octet-stream", {"content-disposition": `attachment; filename="${filename}"`,
              "content-security-policy": "sandbox; default-src 'none'"});
          }
        }
        throw fail("Local operation not found.", 404);
      }
      if (request.method !== "GET" && request.method !== "HEAD") throw fail("Method not allowed.", 405);
      if (/^\/reports\/[A-Za-z0-9_.:-]+\/[A-Za-z0-9_.:-]+$/.test(url.pathname)) return send(200, reportShell, "text/html; charset=utf-8");
      if (["/", "/local-workspace", "/product", "/demo", "/lifecycle", "/engagements", "/assistant", "/library", "/resource-portal", "/templates", "/fieldwork", "/frameworks", "/audits", "/practice", "/sectors", "/publications", "/research-archive", "/files", "/master", "/project-space", "/licenses", "/oversight", "/oversight-consolidation", "/oversight-comparison", "/oversight-backup"].includes(url.pathname)) return send(200, shell, "text/html; charset=utf-8");
      if (url.pathname === "/start.js") return send(200, startup, "text/javascript; charset=utf-8");
      if (url.pathname === "/publication-reader.css") return send(200, publicationReaderCss, "text/css; charset=utf-8");
      const asset = assets.get(url.pathname);
      if (!asset) throw fail("Page not found.", 404);
      return send(200, await readFile(join(appRoot, asset[0])), asset[1]);
    } catch (error) {
      const status = [400, 403, 404, 405, 409, 413, 415, 422, 429, 499, 501, 502, 503, 504].includes(error.status) ? error.status : 500;
      // Do not echo physical paths, database errors, or source content.
      return send(status, {error: status === 500 ? "The local operation failed. Your saved workspace remains on disk." : error.message});
    }
  });
  server.on("close", () => {ps5Evaluation.close();assignmentPilot.close();projectAi.close();resourceScheduler?.close();resourceService?.close?.();consolidationStore?.close();for(const service of clientTemplateStores.values())service.close();for(const service of reviewPolicyStores.values())service.close();for(const service of policyCoverageStores.values())service.close();for (const service of oversightStores.values()) service.close();for (const archive of researchArchives.values()) archive.close();personalSpaces.close();projectIdentities.close();workspace.close();});
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argumentsList = process.argv.slice(2);
  if (argumentsList.length % 2 || argumentsList.some((value, index) => index % 2 === 0 && !["--data", "--port"].includes(value))) {
    console.error("Usage: npm run local -- [--data /path/to/workspace] [--port 4173]");
    process.exitCode = 1;
  } else {
    const options = Object.fromEntries(Array.from({length: argumentsList.length / 2}, (_, index) => argumentsList.slice(index * 2, index * 2 + 2)));
    const port = Number(options["--port"] ?? 4173);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw fail("Choose a local port between 1024 and 65535.");
    const server = createLocalWorkspaceServer({...(options["--data"] ? {directory: resolve(options["--data"])} : {})});
    server.on("error", error => {console.error(`Local workbench could not start (${error.code || "error"}).`); process.exitCode = 1;});
    server.listen(port, "127.0.0.1", () => console.log(`E&S Review (ESIA local): http://127.0.0.1:${port}\nStorage: ${resolve(options["--data"] ?? join(appRoot, ".local-workspace"))}`));
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
  }
}
