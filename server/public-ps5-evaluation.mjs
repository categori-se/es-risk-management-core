import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, stat, realpath} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve, join, sep} from 'node:path';
import {execFile} from 'node:child_process';
import {createEsAiGateway} from './es-ai-gateway.mjs';
import {esAiProviderConfiguration, createEsAiAdapters} from './es-ai-providers.mjs';
import {createEvaluationDiagnosticTransport} from './evaluation-diagnostic-transport.mjs';
import {getEsAiSkill} from '../src/lib/es-ai-skills.js';
import {validatePublicPs5Dataset, blindPs5EvaluationInput, scorePublicPs5Evaluation} from '../src/lib/ps5-evaluation.js';

export const evaluationDigest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const boundedRead = async (path, maximum = 2 * 1024 * 1024) => {const info = await stat(path);if (!info.isFile() || info.size > maximum) throw Error('Evaluation input is not a bounded regular file.');return readFile(path);};
async function hashOriginal(path) {const info = await stat(path);if (!info.isFile() || info.size > 128 * 1024 * 1024) throw Error('Evaluation originals must be retained regular PDFs below 128 MiB.');const hash = createHash('sha256');for await (const chunk of createReadStream(path)) hash.update(chunk);return hash.digest('hex');}
const pdfPage = (path, page) => new Promise((accept, reject) => execFile('pdftotext', ['-f', String(page), '-l', String(page), '-layout', '-enc', 'UTF-8', path, '-'], {timeout:20000, maxBuffer:256 * 1024, encoding:'utf8'}, (error, text) => error ? reject(Error('Exact retained PDF page extraction failed; install pdftotext and inspect the source.')) : accept(text.replace(/\f\s*$/, ''))));

/** Trusted source-custody descriptors only. This does not acquire a source. */
export async function inspectPublicPs5EvaluationPage({sourceRoot,source,page}={}){
 if(!source?.retainedRelativePath||source.retainedRelativePath.startsWith('/')||source.retainedRelativePath.split(/[\\/]/).includes('..')||!Number.isSafeInteger(page)||page<1||page>10000)throw Error('Select a retained original and a bounded exact PDF page.');
 const root=await realpath(sourceRoot),path=await realpath(resolve(root,source.retainedRelativePath));if(!path.startsWith(root+sep))throw Error('Evaluation originals must remain inside their existing source custody.');if(await hashOriginal(path)!==source.sourceSha256)throw Error('The exact retained original changed.');if((await boundedReadPrefix(path,5)).toString('ascii')!=='%PDF-')throw Error('Select a complete retained PDF original.');const text=await pdfPage(path,page);if(await hashOriginal(path)!==source.sourceSha256)throw Error('The exact retained original changed during extraction.');if(!text.trim())throw Error('This page has no extracted text. Inspect its original/OCR before authoring an evaluation excerpt.');return {sourceId:source.id,documentVersionId:source.documentVersionId,sourceSha256:source.sourceSha256,page,locator:`PDF page ${page}`,text};
}

export async function readPublicPs5EvaluationOriginal({sourceRoot,source}={}){
 if(!source?.retainedRelativePath||source.retainedRelativePath.startsWith('/')||source.retainedRelativePath.split(/[\\/]/).includes('..'))throw Error('Choose an existing exact retained original.');
 const root=await realpath(sourceRoot),path=await realpath(resolve(root,source.retainedRelativePath));if(!path.startsWith(root+sep))throw Error('Evaluation originals must remain in existing custody.');if(await hashOriginal(path)!==source.sourceSha256)throw Error('The retained original changed.');const bytes=await boundedRead(path,128*1024*1024);if(evaluationDigest(bytes)!==source.sourceSha256)throw Error('The retained original changed while opening it.');if(bytes.subarray(0,5).toString('ascii')!=='%PDF-')throw Error('Choose a complete retained PDF original.');return bytes;
}

export async function preparePublicPs5Evaluation({datasetPath, rubricPath, sourceRoot, caseId} = {}) {
  const datasetBytes = await boundedRead(datasetPath), rubricBytes = await boundedRead(rubricPath), dataset = validatePublicPs5Dataset(JSON.parse(datasetBytes)), rubric = JSON.parse(rubricBytes);
  if (rubric.format !== 'esia-hidden-ps5-gold-rubric' || rubric.datasetId !== dataset.id || rubric.datasetRevision !== dataset.revision || !rubric.preparedBy) throw Error('The hidden rubric must identify the exact dataset revision and its preparer.');
  const item = dataset.cases.find(v => v.id === caseId);
  if (!item || !rubric.cases?.find(v => v.caseId === caseId)) throw Error('Select a declared case with a separate hidden rubric.');
  const root = await realpath(sourceRoot), verified = new Map(), passages = [];
  for (const requirement of item.requirements) {
    const source = requirement.policySource;
    if (!source.retainedRelativePath || source.retainedRelativePath.startsWith('/') || source.retainedRelativePath.split(/[\\/]/).includes('..')) throw Error('Pin each policy criterion to the retained policy original.');
    const path = await realpath(resolve(root, source.retainedRelativePath));
    if (!path.startsWith(root + sep)) throw Error('The policy original must remain within the retained source root.');
    if (!verified.has(path)) verified.set(path, await hashOriginal(path));
    if (verified.get(path) !== source.sha256) throw Error('The selected PS5 policy original hash does not match the dataset.');
  }
  for (const spec of item.passages) {
    const path = await realpath(resolve(root, spec.retainedRelativePath));
    if (!path.startsWith(root + sep)) throw Error('Evaluation originals must remain inside the operator-selected retained source root.');
    if (!verified.has(path)) {
      const observed = await hashOriginal(path);if (observed !== spec.sourceSha256) throw Error(`Retained original hash mismatch for ${spec.id}.`);
      const prefix = (await boundedReadPrefix(path, 5)).toString('ascii');if (prefix !== '%PDF-') throw Error('Evaluation source is not a complete-original PDF candidate.');
      verified.set(path, observed);
    }
    if (verified.get(path) !== spec.sourceSha256) throw Error('Conflicting retained source pins.');
    let quote = await pdfPage(path, spec.page);
    // Excerpts are bounded by deterministic offsets, never expected-answer text.
    const start = spec.characterStart ?? 0, end = spec.characterEnd ?? quote.length;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > quote.length) throw Error('A deterministic passage excerpt exceeds its exact PDF page.');
    quote = quote.slice(start, end);
    if (!quote.trim() || quote.length > 16000) throw Error('The evaluation page has no text or exceeds its passage bound; source/OCR review is required.');
    passages.push({id:spec.id, documentVersionId:spec.documentVersionId, sourceSha256:spec.sourceSha256, locator:spec.locator, quote});
  }
  for(const [path,pin] of verified)if(await hashOriginal(path)!==pin)throw Error('The retained policy or project original changed during extraction.');
  const input = blindPs5EvaluationInput({dataset, caseId, passages});
  return {dataset, rubric, case:item, input, datasetSha256:evaluationDigest(datasetBytes), rubricSha256:evaluationDigest(rubricBytes), inputSha256:evaluationDigest(input), originals:verified.size, pages:new Set(item.passages.map(v => `${v.sourceSha256}:${v.page}`)).size, excerpts:passages.length};
}

async function boundedReadPrefix(path, length) {const {open} = await import('node:fs/promises');const file = await open(path, 'r');try {const buffer = Buffer.alloc(length);await file.read(buffer, 0, length, 0);return buffer;} finally {await file.close();}}

export async function runPublicPs5Evaluation({prepared, endpoint, model, modelDigest, directory, timeoutMilliseconds = 90000, outputTokens = 2500, inputTokens = 64000, holdout = false, configurationSha256, goldReview = null, authorize = async()=>true} = {}) {
  if (!prepared?.input || !prepared.datasetSha256 || !prepared.rubricSha256) throw Error('Prepare and hash the real sources before running inference.');
  await mkdir(directory, {recursive:true, mode:0o700});
  const base = {format:'esia-public-ps5-evaluation-run', schemaVersion:1, caseId:prepared.case.id, split:prepared.case.split, datasetSha256:prepared.datasetSha256, rubricSha256:prepared.rubricSha256, inputSha256:prepared.inputSha256, realPublicDocuments:true, syntheticOnly:false, startedAt:new Date().toISOString(), sourceFilesVerified:prepared.originals, pagesVerified:prepared.pages, cloudRequests:0, modelDownloads:0};
  if (!endpoint || !model || !modelDigest) return {...base, status:'provider_unavailable', providerResponded:false, actualInference:false, acceptedTypedOutput:false, reason:'Explicit loopback endpoint, retained model name and model digest are required. No inference, model download or cloud fallback was attempted.'};
  const provider = esAiProviderConfiguration({provider:'local', endpoint, model});
  if (!provider.configured) throw Error(provider.reason);
  if (!/^[a-f0-9]{64}$/.test(modelDigest) || !Number.isSafeInteger(timeoutMilliseconds) || timeoutMilliseconds < 1000 || timeoutMilliseconds > 90000 || !Number.isSafeInteger(outputTokens) || outputTokens < 128 || outputTokens > 3000 || !Number.isSafeInteger(inputTokens) || inputTokens < 1 || inputTokens > 64000 || typeof authorize!=='function') throw Error('Use an exact retained model SHA-256 and bounded local evaluation limits.');
  if (prepared.case.split === 'holdout') {
    if (!holdout || !/^[a-f0-9]{64}$/.test(configurationSha256 || '')) throw Error('Holdout execution requires an explicit holdout flag and frozen development configuration SHA-256.');
    // Persist the attempt before dispatch. An observation timeout cannot release
    // the holdout or silently turn it into tuning data. Re-run with a new corpus.
    const lock = join(directory, `holdout-${prepared.datasetSha256}-${modelDigest}.json`);
    try {await writeFile(lock, JSON.stringify({...base, modelDigest, configurationSha256}) + '\n', {flag:'wx', mode:0o600});} catch (error) {if (error.code === 'EEXIST') throw Error('This retained model already attempted the sealed holdout dataset. Keep the record and use a new independently adjudicated holdout for further tuning.');throw error;}
  }
  const route = {id:'bounded-public-ps5-evaluation', revision:'1', provider:'local', model, endpoint, enabled:true, processingBoundary:'local', allowedSensitivities:['public'], capabilities:['assessment'], evaluation:{id:'real-public-research-candidate', status:'approved'}, pricing:{currency:'USD', inputPerMillion:0, outputPerMillion:0, verifiedAt:new Date().toISOString()}, limits:{maxInputTokens:inputTokens, maxOutputTokens:outputTokens, maxMilliseconds:timeoutMilliseconds, maxChargeMinorUnits:0}, budgets:{monthlyMinorUnits:0, projectMinorUnits:0, enterpriseMinorUnits:0}};
  const diagnostic = createEvaluationDiagnosticTransport({directory:join(directory, 'private-provider-diagnostics'), endpoint});
  const gateway = createEsAiGateway({directory:join(directory, 'gateway'), routes:[route], adapters:{local:createEsAiAdapters({fetchImpl:diagnostic.fetchImpl}).local}}), started = Date.now();
  try {
    const run = await gateway.execute({scope:{accountId:'local-research-evaluation', projectId:prepared.case.projectIdentity, engagementId:prepared.case.id, actorId:'bounded-evaluation-operator'}, routeId:route.id, executionProfile:'local-only', skill:getEsAiSkill('es.ps5.gap-review'), input:prepared.input, sensitivity:'public', evidenceManifestSha256:prepared.inputSha256, authorize});
    const elapsedMilliseconds = Date.now() - started, labels = prepared.rubric.cases.find(v => v.caseId === prepared.case.id), score = scorePublicPs5Evaluation({output:run.output, input:prepared.input, labels,caseSplit:prepared.case.split,inputSha256:prepared.inputSha256, inference:run.inference, outputSha256:run.outputDigest, goldReview, datasetSha256:prepared.datasetSha256, rubricSha256:prepared.rubricSha256, elapsedMilliseconds, usage:run.usage, cost:{...run.cost, localEnergyAndHardwareCost:'not_measured'}});
    return {...base, status:'completed', providerResponded:true, actualInference:run.inference === 'actual', acceptedTypedOutput:true, providerDiagnostic:diagnostic.observation(), model, modelDigest, endpoint, configurationSha256:configurationSha256 || null, elapsedMilliseconds, run, score};
  } catch (error) {
    const providerDiagnostic = diagnostic.observation();
    return {...base, status:'inference_failed', providerResponded:providerDiagnostic.providerResponded, actualInference:providerDiagnostic.actualInferenceObserved, acceptedTypedOutput:false, providerDiagnostic, actualInferenceAttempted:true, model, modelDigest, elapsedMilliseconds:Date.now() - started, error:{status:error.status || 502, message:error.message}, substantivePass:false};
  } finally {gateway.close();}
}
