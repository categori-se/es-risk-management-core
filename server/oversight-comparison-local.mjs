import {createHash} from 'node:crypto';
import {buildOversightComparison} from '../src/lib/oversight-comparison.js';

const fail = (status,message) => {throw Object.assign(new Error(message),{status});};
const exactId = value => typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}(?![\s\S])/.test(value);
function selection(input) {
  if (!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).length!==2 || Object.keys(input).some(key=>!['baselineId','followupId'].includes(key)) || !exactId(input.baselineId) || !exactId(input.followupId)) fail(400,'Choose exact retained baseline and follow-up packet identifiers.');
  return {baselineId:input.baselineId,followupId:input.followupId};
}

/** A reproducible view over two immutable packets, with current source access
 * checked on every operation. No new database, worker or source fetch. */
export function createLocalOversightComparisonService({getSnapshot}={}) {
  if(typeof getSnapshot!=='function')fail(400,'Period comparisons need an authorized retained-packet reader.');
  const read=input=>{const ids=selection(input);return {baseline:getSnapshot(ids.baselineId),followup:getSnapshot(ids.followupId)};};
  return {
    compare(input) {
      const result=buildOversightComparison(read(input)),json=JSON.stringify(result);
      if(Buffer.byteLength(json)>4*1024*1024-100)fail(413,'The comparison exceeds its bounded report size. Use narrower reporting packets.');
      return {...result,sha256:createHash('sha256').update(json).digest('hex')};
    },
    // Exports may yield during rendering. Recheck authority before delivery.
    authorize(input) {read(input);}
  };
}
