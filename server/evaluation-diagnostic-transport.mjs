// Explicit evaluation-only response retention. The ordinary application gateway
// never installs this observer and never starts logging private model output.
import {request as httpRequest} from 'node:http';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {mkdir, writeFile, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {esAiProviderConfiguration} from './es-ai-providers.mjs';

const maximumBytes = 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function createEvaluationDiagnosticTransport({directory, endpoint} = {}) {
  const config = esAiProviderConfiguration({provider:'local', endpoint});
  if (!config.configured || typeof directory !== 'string' || !directory) throw Error('Evaluation diagnostics require a private directory and explicit credential-free loopback endpoint.');
  let observation = {providerResponded:false, actualInferenceObserved:false, rawResponse:null};
  async function capture({status, contentType, bytes, complete, truncated}) {
    const sha256 = hash(bytes);await mkdir(directory, {recursive:true, mode:0o700});
    const path = join(directory, `response-${sha256}.${complete ? 'body' : 'prefix'}`);
    try {await writeFile(path, bytes, {flag:'wx', mode:0o600});} catch (error) {if (error.code !== 'EEXIST') throw error;const retained = await readFile(path);if (retained.length > maximumBytes || hash(retained) !== sha256) throw Error('Retained evaluation diagnostic bytes changed.');}
    let parsed;try {if (complete) parsed = JSON.parse(bytes.toString('utf8'));} catch {}
    const generated = status >= 200 && status < 300 && Array.isArray(parsed?.choices) && parsed.choices.some(v => v.message?.role === 'assistant' && typeof v.message.content === 'string');
    observation = {providerResponded:true, providerHttpStatus:status, actualInferenceObserved:generated, usage:generated && Number.isSafeInteger(parsed.usage?.prompt_tokens) && parsed.usage.prompt_tokens >= 0 && Number.isSafeInteger(parsed.usage?.completion_tokens) && parsed.usage.completion_tokens >= 0 ? {inputTokens:parsed.usage.prompt_tokens, outputTokens:parsed.usage.completion_tokens} : null, rawResponse:{path, sha256, retainedBytes:bytes.length, maximumBytes, complete, truncated, digestBasis:complete ? 'exact_complete_provider_response_body' : 'retained_response_prefix_only', contentType:contentType || null}, responseRetentionScope:'Explicit local public-document evaluation only; never enabled for ordinary private application runs.'};
  }
  async function fetchImpl(value, options = {}) {
    const url = new URL(value);if (url.href !== config.endpoint) throw Error('Evaluation response diagnostics cannot change the exact loopback endpoint.');
    const host = url.hostname.replace(/^\[|\]$/g, ''), addresses = isIP(host) ? [{address:host, family:isIP(host)}] : await lookup(host, {all:true, verbatim:true});
    if (!addresses.length || addresses.some(v => !['127.0.0.1', '::1'].includes(v.address))) throw Error('The explicit local evaluation endpoint resolved outside loopback.');
    return new Promise((resolve, reject) => {
      let response, finished = false, size = 0;const chunks = [];
      const finish = async (error, complete = false, truncated = false) => {
        if (finished) return;finished = true;
        try {if (response) await capture({status:response.statusCode, contentType:response.headers['content-type'], bytes:Buffer.concat(chunks), complete, truncated});} catch (failure) {reject(failure);return;}
        if (error) reject(error);else resolve(new Response(Buffer.concat(chunks), {status:response.statusCode, headers:{'content-type':response.headers['content-type'] || 'application/json'}}));
      };
      const request = httpRequest(url, {method:'POST', agent:false, maxHeaderSize:32768, signal:options.signal, headers:{...options.headers, 'accept-encoding':'identity'}, lookup:(_name, settings, callback) => settings?.all ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family)}, value => {
        response = value;
        if (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') {void finish(Error('Compressed evaluation responses are not accepted.'));response.destroy();return;}
        response.on('data', chunk => {
          if (finished) return;const remaining = maximumBytes - size;if (remaining > 0) chunks.push(Buffer.from(chunk.subarray(0, remaining)));size += chunk.length;
          if (size > maximumBytes) {void finish(Object.assign(Error('The evaluation response exceeded its one MiB retention bound.'), {status:413}), false, true);response.destroy();}
        });
        response.once('end', () => void finish(null, true));response.once('error', error => void finish(error));response.once('aborted', () => void finish(Error('The evaluation response was interrupted.')));
      });
      request.once('error', error => void finish(error));request.end(options.body);
    });
  }
  return {fetchImpl, observation:() => structuredClone(observation)};
}
