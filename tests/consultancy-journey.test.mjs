import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runConsultancyDemonstration} from '../tools/run-consultancy-demonstration.mjs';

test('one synthetic consultancy assignment completes all twelve steps with exact cited outputs, monitoring, custody denial and fresh restore',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'esia-consultancy-test-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const receipt=await runConsultancyDemonstration({directory,outputDirectory:process.env.ESIA_CONSULTANCY_EVIDENCE_DIR});
  assert.equal(receipt.passed,true);assert.equal(receipt.steps.length,12);assert.deepEqual(receipt.steps.map(row=>row.number),Array.from({length:12},(_,index)=>index+1));assert.ok(receipt.steps.every(row=>row.status==='passed'));
  assert.equal(receipt.inference,'transport_simulation');assert.equal(receipt.providerRequests,0);assert.equal(receipt.independentPractitionerAcceptance,false);assert.equal(receipt.authenticatedRemoteTenantAcceptance,false);
});
