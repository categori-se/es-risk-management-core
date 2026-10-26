// Only a fresh authored synthetic rehearsal can produce this public projection.
// No input package/path, client transport, provider or existing workspace is accepted.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import ExcelJS from 'exceljs';
import demo from '../src/data/consultancy-demo.js';
import {runConsultancyDemonstration} from './run-consultancy-demonstration.mjs';
import {verifyEngagementSnapshot} from '../server/engagement-exports.mjs';
import {boundedZip} from '../server/office-preview.mjs';
import {consultancyPreviewNotice,consultancyPreviewMeaning,consultancyPreviewNormalization,validateConsultancyOutputPreview,consultancyPreviewDigestInput} from '../src/lib/consultancy-output-preview.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function sheetRecords(sheet){
  assert.ok(sheet,'Issued workbook sheet is required.');const columns=sheet.getRow(1).values.slice(1);assert.equal(new Set(columns).size,columns.length);
  return sheet.getRows(2,sheet.rowCount-1).map(row=>Object.fromEntries(columns.map((name,index)=>[name,String(row.getCell(index+1).value??'')])));
}

export async function buildConsultancyOutputPreview(){
  assert.equal(arguments.length,0,'The preview generator accepts no external data or configuration.');
  const directory=await mkdtemp(join(tmpdir(),'esia-public-synthetic-preview-')),outputDirectory=join(directory,'issued');
  try{
    const receipt=await runConsultancyDemonstration({directory:join(directory,'rehearsal'),outputDirectory});
    assert.equal(receipt.synthetic,true);assert.equal(receipt.inference,'transport_simulation');assert.equal(receipt.providerRequests,0);assert.equal(receipt.independentPractitionerAcceptance,false);
    const pack=JSON.parse(await readFile(join(outputDirectory,'consultancy-project-package.json'),'utf8'));assert.equal(pack.project.name,demo.projectName);assert.equal(pack.engagements.length,1);
    const baseline=pack.engagements[0].baselines[0];verifyEngagementSnapshot(baseline);assert.equal(baseline.requirements.length,4);assert.equal(baseline.findings.length,4);assert.equal(baseline.actions.length,4);
    const issued=receipt.steps.find(step=>step.number===9).evidence;assert.equal(issued.sharedBaselineId,baseline.id);assert.equal(issued.sharedBaselineSha256,baseline.sha256);
    const bytes=Object.fromEntries(await Promise.all(['html','docx','xlsx'].map(async format=>{const body=await readFile(join(outputDirectory,`consultancy-approved.${format}`)),metadata=issued.artifacts.find(row=>row.format===format);assert.equal(metadata.baselineId,baseline.id);assert.equal(metadata.baselineSha256,baseline.sha256);assert.equal(hash(body),metadata.sha256);return[format,body];})));
    const html=new JSDOM(bytes.html.toString()),docx=new JSDOM(boundedZip(bytes.docx).get('word/document.xml').bytes.toString(),{contentType:'application/xml'});
    try{
      const report=html.window.document.body.textContent,word=docx.window.document.documentElement.textContent;assert.ok(report.includes(baseline.sha256)&&word.includes(baseline.sha256));
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes.xlsx);const matrix=sheetRecords(workbook.getWorksheet('Requirements matrix')),cap=sheetRecords(workbook.getWorksheet('Action plan'));assert.equal(matrix.length,4);assert.equal(cap.length,4);
      for(const row of [...matrix,...cap]){assert.equal(row['Baseline ID'],baseline.id);assert.equal(row['Baseline SHA256'],baseline.sha256);}
      const rows=demo.documents.map(original=>{
        const source=baseline.sourceVersions.find(row=>row.filename===original.filename);assert.ok(source);assert.equal(source.sha256,hash(original.content));
        const requirement=baseline.requirements.find(row=>row.sourceVersionId===source.id);assert.ok(requirement);assert.equal(requirement.frameworkId,'project');assert.equal(requirement.text,original.commitment);
        const finding=baseline.findings.find(row=>row.requirementId===requirement.id),action=baseline.actions.find(row=>row.findingIds.includes(finding.id));assert.ok(finding&&action);assert.equal(finding.supportingAssertionIds.length,1);
        const citation=baseline.assertions.find(row=>row.id===finding.supportingAssertionIds[0]);assert.equal(citation.versionId,source.id);assert.equal(citation.sourceSha256,source.sha256);assert.ok(original.content.includes(citation.quote));
        const m=matrix.find(row=>row['Finding ID']===finding.id),a=cap.find(row=>row['Action ID']===action.id);assert.ok(m&&a);assert.equal(m['Requirement ID'],requirement.id);assert.equal(a['Source findings'],finding.id);assert.equal(m.Requirement,original.commitment);assert.equal(m.Rationale,finding.rationale);assert.equal(a.Action,action.description);assert.equal(a.Owner,action.owner);assert.equal(a.Status,action.status);assert.ok(m['Supporting citations'].includes(citation.id)&&m['Supporting citations'].includes(citation.sourceSha256)&&m['Supporting citations'].includes(citation.quote));
        for(const content of [requirement.text,finding.rationale,finding.uncertainty,action.description,citation.quote])assert.ok(report.includes(content)&&word.includes(content),'Actual report and Word text must contain the exact projected records.');
        return{id:original.id,title:original.title,requirement:m.Requirement,source:{filename:source.filename,sha256:source.sha256,locator:citation.locator,quote:citation.quote},finding:{coverage:m.Coverage,adequacy:m.Adequacy,performance:m.Performance,rationale:m.Rationale,uncertainty:finding.uncertainty},action:{description:a.Action,owner:a.Owner,trigger:a['Due date / trigger'].trim(),closureEvidence:a['Verification criteria'],status:a.Status}};
      });
      const rendererHashes=new Set(issued.artifacts.map(row=>row.renderer.sourceSha256));assert.equal(rendererHashes.size,1);
      const preview={format:'esia-synthetic-consultancy-output-preview',schemaVersion:1,synthetic:true,professionalAcceptance:false,inference:'transport_simulation',notice:consultancyPreviewNotice,provenance:{generatorVersion:'1',sameBaselineVerified:true,formats:['html','docx','xlsx'],sourceCatalogSha256:hash(await readFile(new URL('../src/data/consultancy-demo.json',import.meta.url))),rendererSourceSha256:[...rendererHashes][0],normalization:consultancyPreviewNormalization},baseline:{label:'Simulated approved due-diligence baseline',projectionSha256:'0'.repeat(64),meaning:consultancyPreviewMeaning},rows};
      preview.baseline.projectionSha256=hash(consultancyPreviewDigestInput(preview));validateConsultancyOutputPreview(preview);
      const encoded=JSON.stringify(preview,null,2)+'\n';assert.ok(Buffer.byteLength(encoded)<24000);assert.doesNotMatch(encoded,/[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|\d{4}-\d{2}-\d{2}T|\/home\/|contentBase64|accountId|projectId|engagementId/i);
      return preview;
    }finally{html.window.close();docx.window.close();}
  }finally{await rm(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const flags=process.argv.slice(2);if(flags.some(flag=>flag!=='--check')||flags.length>1)throw Error('Usage: node tools/build-consultancy-output-preview.mjs [--check]');
  const contents=JSON.stringify(await buildConsultancyOutputPreview(),null,2)+'\n',path=new URL('../src/data/consultancy-output-preview.json',import.meta.url);
  if(flags.includes('--check'))assert.equal(await readFile(path,'utf8'),contents,'Public preview differs from fresh synthetic issued exports.');else await writeFile(path,contents);
  console.log(flags.includes('--check')?'Public output preview matches fresh synthetic issued exports.':'Generated bounded synthetic output preview; regenerate browser catalogs next.');
}
