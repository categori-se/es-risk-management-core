import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CONSULTANCY_OPERATION_CHECKS,createConsultancyOperationsPacket,validateConsultancyOperationsPacket} from '../src/lib/consultancy-operations.js';
import {prepareConsultancyReview} from '../tools/prepare-consultancy-review.mjs';

test('operations packet preserves pending boundaries and never promotes reported synthetic evidence into acceptance',()=>{
 const packet=createConsultancyOperationsPacket(),draft=validateConsultancyOperationsPacket(packet);assert.equal(draft.pending.length,13);assert.equal(draft.evidenceCompleteForReview,false);assert.equal(draft.actualEvidenceItems,0);
 packet.scope={accountId:'test-account',projectId:'test-project',engagementId:'test-engagement',sourceCommit:'1'.repeat(40),deploymentProfile:'TEST ONLY local',deploymentConfigurationSha256:'a'.repeat(64)};
 for(const row of packet.checks){row.status='evidence_reported';row.ownerReference='TEST ONLY owner';row.evidence=[{reference:'TEST ONLY private evidence',sha256:'b'.repeat(64),observedAt:'2026-10-25T12:00:00Z',observerReference:'TEST ONLY recorder',mode:'synthetic',result:'TEST ONLY fixture; no independent acceptance'}];}
 const result=validateConsultancyOperationsPacket(packet);assert.equal(result.evidenceCompleteForReview,true);assert.equal(result.syntheticEvidenceItems,13);assert.equal(result.actualEvidenceItems,0);assert.equal(result.deploymentAccepted,false);assert.equal(result.professionalApprovalGranted,false);assert.equal(result.independentReviewEstablished,false);
 for(const change of [v=>v.checks.pop(),v=>v.checks[0].id=v.checks[1].id,v=>v.checks[0].evidence[0].sha256='unverified',v=>v.checks[0].evidence[0].mode='accepted',v=>v.scope.engagementId=null,v=>v.deploymentAccepted=true,v=>v.checks[0].evidence=[]]){const bad=structuredClone(packet);change(bad);assert.throws(()=>validateConsultancyOperationsPacket(bad));}
 assert.ok(CONSULTANCY_OPERATION_CHECKS.find(row=>row.id==='protected_stakeholders'));assert.ok(CONSULTANCY_OPERATION_CHECKS.find(row=>row.id==='ai_retrieval'));
});

test('private preparation CLI refuses overwrite and incomplete evidence while opening no referenced resources',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'esia-client-preparation-'));t.after(()=>rm(directory,{recursive:true,force:true}));const path=join(directory,'operations.json');
 assert.equal((await prepareConsultancyReview(['--template',path])).acceptanceGranted,false);assert.equal((await stat(path)).mode&0o777,0o600);await assert.rejects(prepareConsultancyReview(['--template',path]),{code:'EEXIST'});
 const before=await readFile(path,'utf8'),result=await prepareConsultancyReview(['--check',path,'--require-evidence']);assert.equal(result.exitCode,2);assert.equal(result.pending.length,13);assert.equal(await readFile(path,'utf8'),before);
 const packet=JSON.parse(before);packet.checks[0]={...packet.checks[0],status:'not_applicable',ownerReference:'TEST ONLY owner',notApplicableReason:'TEST ONLY explicitly limited scope'};await writeFile(path,JSON.stringify(packet));assert.equal((await prepareConsultancyReview(['--check',path])).notApplicable.length,1);
});
