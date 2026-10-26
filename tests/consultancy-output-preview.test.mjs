import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import previewModule from '../src/data/consultancy-output-preview.js';
import demo from '../src/data/consultancy-demo.js';
import {buildConsultancyOutputPreview} from '../tools/build-consultancy-output-preview.mjs';
import {validateConsultancyOutputPreview,consultancyPreviewDigestInput} from '../src/lib/consultancy-output-preview.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('fresh synthetic issued exports produce the same small public projection without custody identifiers or runtime dates',async()=>{
  const first=await buildConsultancyOutputPreview(),second=await buildConsultancyOutputPreview();
  assert.deepEqual(first,second,'Different rehearsal identities and times must not alter the public teaching projection.');
  assert.deepEqual(first,JSON.parse(await readFile(new URL('../src/data/consultancy-output-preview.json',import.meta.url),'utf8')));
  assert.deepEqual(first,previewModule);
  assert.equal(first.baseline.projectionSha256,hash(consultancyPreviewDigestInput(first)));
  assert.equal(first.provenance.sameBaselineVerified,true);assert.deepEqual(first.provenance.formats,['html','docx','xlsx']);
  assert.equal(first.professionalAcceptance,false);assert.equal(first.inference,'transport_simulation');
  for(const[row,source]of first.rows.map((row,index)=>[row,demo.documents[index]])){assert.equal(row.source.sha256,hash(source.content));assert.ok(source.content.includes(row.source.quote));assert.equal(row.finding.performance,'undetermined');assert.equal(row.action.status,'open');}
  const encoded=JSON.stringify(first);assert.ok(Buffer.byteLength(encoded)<24000);assert.doesNotMatch(encoded,/accountId|projectId|engagementId|contentBase64|\/home\/|\d{4}-\d{2}-\d{2}T|[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/i);
});

test('preview shape rejects private fields, false acceptance, inferred compliance and quotations outside the authored original',()=>{
  for(const corrupt of [value=>value.accountId='private-account',value=>value.rows[0].source.contentBase64='private-bytes',value=>value.professionalAcceptance=true,value=>value.provenance.sameBaselineVerified=false,value=>value.rows[0].finding.performance='compliant',value=>value.rows[0].source.quote=demo.secondClientDocument.content,value=>value.rows.pop()]){
    const input=structuredClone(previewModule);corrupt(input);assert.throws(()=>validateConsultancyOutputPreview(input),/Invalid synthetic consultancy/);
  }
});

test('preview generation refuses arbitrary client data or existing workspace input',async()=>{
  await assert.rejects(buildConsultancyOutputPreview({directory:'/tmp/untrusted-client-workspace'}),/accepts no external data/);
});
