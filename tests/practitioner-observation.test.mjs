import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM} from 'jsdom';
import {PRACTITIONER_TASKS,validatePractitionerObservation} from '../src/lib/professional-qualification.js';
import {createAssignmentPilotEvidence} from '../server/assignment-pilot-evidence.mjs';
import {mountAssignmentPilot} from '../src/components/assignment-pilot.js';

const sha='a'.repeat(64);
export const observedSession=()=>({assignmentId:'synthetic-assignment',datasetSha256:sha,acceptanceCriteriaSha256:sha,observationProtocolSha256:sha,sourceCommit:'1'.repeat(40),deploymentProfile:'isolated synthetic local fixture',observationMode:'synthetic_rehearsal',participantId:'fixture-participant',observerId:'fixture-observer',recorderId:'fixture-recorder',consentReference:null,startedAt:'2026-10-25T12:00:00Z',endedAt:'2026-10-25T13:00:00Z',unfamiliarPractitioner:true,tasks:PRACTITIONER_TASKS.map(({id:taskId})=>({taskId,outcome:'completed',activeSeconds:10,waitSeconds:1,correctionSeconds:2,assistanceSeconds:0,corrections:1,failures:[],evidenceReference:'TEST ONLY task source record',feedback:'TEST ONLY measured fixture; no actual practitioner participated.'})),overallFeedback:'TEST ONLY fixture feedback',priorityFix:'TEST ONLY priority'});

test('ten-task observations preserve failed/skipped work and separate time without granting acceptance',()=>{
 const input=observedSession(),failed=input.tasks[3];failed.outcome='failed';failed.failures=[{symptom:'TEST ONLY blocked assessment',impact:'Cannot issue fixture',reproduction:'Open synthetic task and submit empty criteria',evidenceReference:'TEST ONLY failure reference'}];
 const skipped=input.tasks[4];Object.assign(skipped,{outcome:'not_attempted',activeSeconds:0,waitSeconds:0,correctionSeconds:0,assistanceSeconds:0,corrections:0,evidenceReference:'AI disabled for fixture'});
 const actual=validatePractitionerObservation({...input,observationMode:'actual_practitioner',consentReference:'TEST ONLY consent reference',independentPractitionerAcceptance:true,professionalApprovalGranted:true});
 assert.equal(actual.tasks.length,10);assert.equal(actual.tasks[8].taskId,'subsequent_monitoring');assert.equal(actual.tasks[9].taskId,'restore_backup');assert.equal(actual.totals.activeSeconds,90);assert.equal(actual.totals.correctionSeconds,18);assert.equal(actual.totals.failures,1);assert.equal(actual.independentPractitionerAcceptance,false);assert.equal(actual.professionalApprovalGranted,false);assert.equal(actual.identityVerified,false);
 for(const change of [v=>v.tasks.pop(),v=>v.tasks[1].taskId=v.tasks[0].taskId,v=>v.tasks[0].correctionSeconds=11,v=>v.tasks[3].failures=[],v=>v.tasks[4].activeSeconds=1,v=>v.tasks[0].feedback='',v=>v.endedAt=v.startedAt]){const bad=structuredClone(input);change(bad);assert.throws(()=>validatePractitionerObservation(bad));}
 assert.throws(()=>validatePractitionerObservation({...input,observationMode:'actual_practitioner'}),/Consent/);
 assert.throws(()=>validatePractitionerObservation({...input,observationMode:'actual_practitioner',consentReference:'TEST ONLY',observerId:input.participantId}),/separate observer/);
});

test('observations use existing pilot custody, current recorder authorization and restart persistence',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'esia-observed-pilot-'));let allowed=true;
 const scope={accountId:'synthetic-a',projectId:'same-physical-project',engagementId:'synthetic-engagement'},actor={id:'assigned-recorder',identityBasis:'Declared test recorder'};
 const config={directory,authorize:async({scope,actor})=>allowed&&scope.accountId==='synthetic-a'&&actor?.id==='assigned-recorder'};
 let store=createAssignmentPilotEvidence(config);t.after(()=>{store.close();rmSync(directory,{recursive:true,force:true});});
 const saved=await store.recordObservation(scope,{...observedSession(),recorderId:'forged'},actor);assert.equal(saved.recorderId,actor.id);assert.equal(saved.recorderIdentityBasis,actor.identityBasis);
 assert.deepEqual((await store.list({...scope,engagementId:'other-engagement'},actor)).records,[]);
 await assert.rejects(store.list({...scope,accountId:'synthetic-b'},actor),{status:403});
 allowed=false;await assert.rejects(store.recordObservation(scope,observedSession(),actor),{status:403});await assert.rejects(store.list(scope,actor),{status:403});allowed=true;
 store.close();store=createAssignmentPilotEvidence(config);const state=await store.list(scope,actor);assert.equal(state.records.length,1);assert.equal(state.records[0].id,saved.id);assert.deepEqual(state.comparisons,[]);assert.equal(state.storedCanonicalRecords,false);
});

test('foreground observation form captures ten tasks and explicit actual/session feedback without an approval control',async t=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main'),saved=[],errors=[];
 const state={pilotContext:{assignmentId:'synthetic-assignment',datasetSha256:sha,acceptanceCriteriaSha256:sha,observationProtocolSha256:sha},records:[],comparisons:[]};
 const mount=mountAssignmentPilot(root,{load:async()=>state,save:async()=>{},saveObservation:async input=>{saved.push(validatePractitionerObservation({...input,recorderId:'fixture-recorder'}));},onError:error=>errors.push(error)});t.after(()=>{mount.dispose();dom.window.close();});await mount.ready;
 const form=root.querySelector('[data-practitioner-observation]');assert.ok(form);assert.equal(form.querySelectorAll('select').length,11);assert.equal(form.querySelectorAll('[name=reviewAccepted]').length,0);
 const set=(parent,label,value)=>{const wrap=[...parent.querySelectorAll('label')].find(node=>node.firstChild?.textContent===label);assert.ok(wrap,label);wrap.querySelector('input,textarea,select').value=value;};
 set(form,'Observation basis','actual_practitioner');form.querySelector('select').dispatchEvent(new dom.window.Event('change'));
 set(form,'Participant reference','fixture-participant');set(form,'Observer reference','fixture-observer');set(form,'Consent record reference (required for an actual observation)','TEST ONLY consent');set(form,'Exact source commit (40 lowercase hexadecimal characters)','1'.repeat(40));set(form,'Observed deployment profile','TEST ONLY local');set(form,'Started at (ISO date/time)','2026-10-25T12:00:00Z');set(form,'Ended at (ISO date/time)','2026-10-25T13:00:00Z');
 for(const group of [...form.children].filter(node=>node.tagName==='DETAILS')){set(group,'Outcome','completed');set(group,'Active seconds','10');set(group,'Task evidence reference, or reason not attempted','TEST ONLY evidence');set(group,'Task feedback','TEST ONLY feedback');}
 set(form,'Overall participant feedback','TEST ONLY overall');set(form,'Highest priority improvement','TEST ONLY priority');form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(errors,[]);assert.equal(saved.length,1);assert.equal(saved[0].tasks.length,10);assert.equal(saved[0].observationMode,'actual_practitioner');assert.equal(saved[0].professionalApprovalGranted,false);
});
