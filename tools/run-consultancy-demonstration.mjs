// A bounded, isolated software acceptance journey. Every document, provider
// response and declared human role is synthetic. No provider/network is used.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import ExcelJS from 'exceljs';
import {JSDOM} from 'jsdom';
import {createAccountWorkspace} from '../server/local-account-workspace.mjs';
import {createConsultancyDemonstration} from '../server/consultancy-demonstration.mjs';
import {createEsAiWorkspaceApi} from '../server/es-ai-workspace-api.mjs';
import {exportEngagementSnapshot,verifyEngagementSnapshot} from '../server/engagement-exports.mjs';
import {boundedZip} from '../server/office-preview.mjs';
import {prepareEngagementDocumentClassification} from '../server/engagement-analysis.mjs';
import {normalizeTags} from '../src/lib/concept-tags.js';

const digest=value=>createHash('sha256').update(value).digest('hex');
const roles={preparer:'Demo preparer',reviewer:'Demo reviewer',approver:'Demo approver'};
const ids=['draft-10','draft-1','draft-2','draft-3'];

/** Creates fresh custody only. Callers must supply an unused acceptance root;
 * the public sample creator never invokes these simulated reviews/approvals. */
export async function runConsultancyDemonstration({directory,outputDirectory}={}) {
  directory=directory?resolve(directory):await mkdtemp(join(tmpdir(),'esia-consultancy-acceptance-'));
  const workspace=createAccountWorkspace({directory:join(directory,'workspace')}),restored=createAccountWorkspace({directory:join(directory,'restored')});
  let ai;const steps=[],providerCalls=[];
  const passed=(number,title,evidence)=>steps.push({number,title,status:'passed',evidence});
  try {
    const seed=createConsultancyDemonstration(workspace,{confirmedSynthetic:true}),a=seed.clients.find(row=>row.key==='A'),b=seed.clients.find(row=>row.key==='B');
    const store=workspace.forAccount(a.accountId),other=workspace.forAccount(b.accountId),engagements=store.engagements();
    let project=store.getProject(a.projectId),engagement=engagements.get(a.engagementId);
    const command=(value,actor=roles.preparer)=>engagement=engagements.mutate(engagement.id,engagement.revision,value,actor);
    const mandateText='SYNTHETIC CLIENT A TERMS OF REFERENCE. Commission a source-cited due-diligence review of the four authored Riverbridge studies, a requirements matrix and corrective-action plan, then demonstrate monitoring and portable handover. Reviewers must disclose missing information and retain exact originals. No real professional assignment or client agreement is represented.';
    project=store.mutate(project.id,project.revision,{type:'intake',mode:'managed',filename:'synthetic-consultancy-mandate.txt',title:'Synthetic client A terms of reference',mediaType:'text/plain',contentBase64:Buffer.from(mandateText).toString('base64')});const mandateVersion=project.resources.at(-1).versions[0];
    command({type:'update-engagement',changes:{agreementVersionIds:[mandateVersion.id]}});
    assert.notEqual(a.custodyId,b.custodyId);assert.equal(project.projectContext.identity.id,other.getProject(b.projectId).projectContext.identity.id);
    passed(1,'Create a client engagement',{accountId:a.accountId,custodyId:a.custodyId,engagementId:engagement.id,mandate:engagement.scope,agreementVersionId:mandateVersion.id,declaredRoles:engagement.roles});
    const ledger=store.lifecycle().get('demo-preparer');assert.equal(ledger.entities.organizations.length,2);assert.equal(ledger.entities.components.length,2);assert.equal(ledger.entities.investments.length,1);
    passed(2,'Register project, organizations and financing',{physicalIdentityId:seed.identityId,projectId:project.id,organizationIds:ledger.entities.organizations.map(row=>row.id),componentIds:ledger.entities.components.map(row=>row.id),investmentId:ledger.entities.investments[0].id,frameworkIds:engagement.frameworkIds});
    const versions=project.resources.map(resource=>resource.versions[0]).filter(version=>version.id!==mandateVersion.id),sourceProof=versions.map(version=>{
      const bytes=store.readVersion(project.id,version.id).bytes;assert.equal(digest(bytes),version.sha256);assert.match(bytes.toString(),/SYNTHETIC/);return {id:version.id,sha256:version.sha256,size:bytes.length,filename:version.filename};
    });assert.equal(sourceProof.length,4);
    passed(3,'Import authorized synthetic client documents',{sourceVersions:sourceProof,meaning:'Application-authored ESIA, RAP, SEP and biodiversity teaching texts; not real studies.'});

    const permissions=Object.fromEntries(versions.map(version=>[version.id,{aiAllowed:true,remoteAllowed:false,sensitivity:'internal',pii:'none'}]));
    const route={id:'consultancy-synthetic-only',revision:'synthetic-1',provider:'synthetic',model:'authored-teaching-response',enabled:true,processingBoundary:'local',allowedSensitivities:['internal'],capabilities:['conversation','classification','assessment','multidocument','drafting'],evaluation:{id:'synthetic-workflow-only',status:'approved'},pricing:{currency:'USD',inputPerMillion:0,outputPerMillion:0,verifiedAt:new Date().toISOString()},limits:{maxInputTokens:64000,maxOutputTokens:3000,maxMilliseconds:10000,maxChargeMinorUnits:0},budgets:{monthlyMinorUnits:0,projectMinorUnits:0,enterpriseMinorUnits:0},allowedScope:{accountId:a.custodyId,projectId:project.id,engagementId:engagement.id}};
    const synthetic=async({payload})=>{
      assert.equal(payload.input.requirements.length,4);assert.ok(payload.input.passages.length>=4);
      const schema=/output schema ([\w.-]+):/.exec(payload.system)?.[1];
      const items=payload.input.requirements.map((requirement,index)=>{
        const source=payload.input.passages.find(passage=>passage.versionId===requirement.sourceVersionId);assert.ok(source);
        if(schema==='es.document-classification.v1')return {id:`classification-${index+1}`,kind:'document_classification',text:`SYNTHETIC classification: ${requirement.title.replace(/ commitment$/,'')}.`,supportingPassageIds:[source.id],contradictoryPassageIds:[],missingEvidence:false,fields:{title:requirement.title.replace(/ commitment$/,''),documentType:['esia','resettlement_action_plan','stakeholder_engagement_plan','biodiversity_study'][index],description:'Application-authored synthetic teaching text; not an actual client study.',topics:requirement.topics,requirementIds:[requirement.id]}};
        return {id:ids[index],kind:'finding',requirementId:requirement.id,frameworkId:requirement.frameworkId,edition:requirement.edition,coverage:'partial',adequacy:'deficient',judgment:'undetermined',uncertainty:'Authored simulation: implementation and outcomes remain unverified.',text:`SYNTHETIC AI DRAFT: ${requirement.title} needs further source and implementation review.`,supportingPassageIds:[source.id],contradictoryPassageIds:[],missingEvidence:true,fields:{deficiency:'The selected source identifies missing implementation or outcome evidence.',recommendation:'Obtain and inspect dated implementation and outcome records.'}};
      });
      providerCalls.push({routeId:route.id,schema,sourcePins:payload.input.passages.map(passage=>({id:passage.id,versionId:passage.versionId,sha256:passage.sourceSha256})),requirementIds:payload.input.requirements.map(item=>item.id),inference:'transport_simulation'});
      return {output:{schema,state:'ai_draft',citations:payload.input.passages.filter(passage=>items.some(item=>item.supportingPassageIds.includes(passage.id))).map(passage=>({passageId:passage.id,quote:passage.quote})),items},usage:{inputTokens:1000,outputTokens:700},inference:'transport_simulation'};
    };
    ai=createEsAiWorkspaceApi({directory:join(directory,'ai'),workspace,routes:[route],adapters:{synthetic},sourcePermissions:permissions,simulation:true});
    const context={accountId:a.accountId,projectId:project.id,engagementId:engagement.id,actorId:roles.preparer};
    const call=(operation,body,changes={})=>ai.handle({...context,...changes,operation,body});
    const classificationTask={question:'Classify the ESIA, RAP, SEP and biodiversity study documents using their exact source text; leave unknown metadata blank.',skillId:'es.document.classification',routeId:route.id,executionProfile:'local-only',versionIds:versions.map(version=>version.id),filters:{}};
    const classificationEstimate=await call('estimate',classificationTask);assert.equal(providerCalls.length,0);
    const classificationRun=await call('run',{...classificationTask,estimateDigest:classificationEstimate.estimateDigest});assert.equal(classificationRun.validation.valid,true,JSON.stringify(classificationRun.validation));assert.equal(classificationRun.output.items.length,4);
    for(const item of classificationRun.output.items){
      await call('review',{runId:classificationRun.id,itemId:item.id,decision:'accepted',comment:'SIMULATED source review accepts the document description only as a retained proposal.'},{actorId:roles.reviewer});
      const saved=await call('handoff',{runId:classificationRun.id,itemId:item.id,expectedRevision:engagement.revision},{actorId:roles.preparer});project=saved.project;engagement=saved.engagement;
    }
    const classifications=[];
    for(const version of versions){
      const current=project.resources.flatMap(resource=>resource.versions).find(row=>row.id===version.id),metadata=current.effectiveMetadata,proposal=metadata.classification.proposal;
      assert.equal(metadata.classification.status,'suggested');assert.equal(metadata.classification.sourceSha256,version.sha256);
      const edited={...metadata,...Object.fromEntries(Object.entries(proposal).filter(([key])=>!['topics','requirementIds'].includes(key))),tags:normalizeTags(proposal.topics)};
      const change=await prepareEngagementDocumentClassification({engagement,project,actorId:roles.reviewer,at:new Date().toISOString(),readVersion:versionId=>store.readVersion(project.id,versionId),command:{type:'review',versionId:version.id,metadata:edited,requirementIds:proposal.requirementIds,statement:'SIMULATED reviewer inspected the authored original and checked its document type, topics, unknown fields and exact requirement link.'}});
      project=store.mutate(project.id,project.revision,{type:'document-classification',versionId:version.id,metadata:change.metadata},{classificationAuthority:{projectId:project.id,versionId:version.id,sourceSha256:version.sha256,engagementId:engagement.id,classification:change.classification}});
      const reviewed=project.resources.flatMap(resource=>resource.versions).find(row=>row.id===version.id).effectiveMetadata.classification;
      assert.equal(reviewed.status,'human_confirmed');assert.equal(reviewed.review.actorId,roles.reviewer);assert.ok(reviewed.evidence.every(row=>row.versionId===version.id&&row.sourceSha256===version.sha256));assert.equal(digest(store.readVersion(project.id,version.id).bytes),version.sha256);
      classifications.push({sourceVersionId:version.id,sourceSha256:version.sha256,status:reviewed.status,documentType:reviewed.reviewedProfile.documentType,topics:reviewed.reviewedProfile.topics,requirementIds:reviewed.reviewedProfile.requirementIds,review:reviewed.review,proposalProvenance:reviewed.provenance,evidence:reviewed.evidence.map(row=>({passageId:row.passageId,versionId:row.versionId,sourceSha256:row.sourceSha256,locator:row.locator}))});
    }
    assert.equal(new Set(classifications.map(row=>row.documentType)).size,4);assert.ok(classifications.every(row=>row.topics.length&&row.requirementIds.length===1));
    passed(4,'Classify and organize exact evidence',{runId:classificationRun.id,inference:classificationRun.inference,classifications,meaning:'Source-bound retained AI document proposals followed by separate simulated human metadata confirmation; no professional or institutional classification acceptance.'});
    const task={question:'Identify gaps in noise measurements, compensation, consultation and seasonal biodiversity evidence against each supplied project commitment.',skillId:'es.requirement.gap-review',routeId:route.id,executionProfile:'local-only',versionIds:versions.map(version=>version.id),filters:{}};
    const estimate=await call('estimate',task);assert.equal(providerCalls.length,1);
    const run=await call('run',{...task,estimateDigest:estimate.estimateDigest});assert.equal(run.validation.valid,true,JSON.stringify(run.validation));assert.equal(run.inference,'transport_simulation');assert.equal(run.professionalApproval,false);assert.equal(run.output.items.length,4);
    assert.equal(engagement.requirements.every(row=>row.frameworkId==='project'&&row.textKind==='project_source_text'),true);
    passed(5,'Apply selected E&S requirements',{frameworkContext:engagement.frameworkIds,requirements:engagement.requirements.map(row=>({id:row.id,frameworkId:row.frameworkId,edition:row.edition,textKind:row.textKind,sourceVersionId:row.sourceVersionId,locator:row.locator})),meaning:'Four authored project commitments are assessed. This does not qualify or apply a complete IFC or World Bank policy corpus.'});
    passed(6,'Run structured AI-assisted gap analysis',{runId:run.id,skill:run.skill,evidenceManifestSha256:run.evidenceManifestSha256,requestDigest:run.requestDigest,outputDigest:run.outputDigest,draftIds:run.output.items.map(row=>row.id),inference:run.inference,professionalApproval:false,providerRequests:0,simulatedAdapterCalls:providerCalls.length});

    const originalOutput=JSON.stringify(run.output);
    for(const item of run.output.items){
      await call('review',{runId:run.id,itemId:item.id,decision:'corrected',comment:'SIMULATED human inspection of the exact authored original; no independent practitioner acceptance.',correction:{text:`SIMULATED SOURCE-REVIEWED CORRECTION: ${item.text} Preserve undetermined performance; the missing records must be obtained and checked.`}},{actorId:roles.reviewer});
      const result=await call('handoff',{runId:run.id,itemId:item.id,expectedRevision:engagement.revision},{actorId:roles.preparer});engagement=result.engagement;
    }
    assert.equal(engagement.findings.length,4);assert.equal(engagement.assertions.length,4);assert.ok(engagement.assertions.every(row=>row.reviewStatus==='suggested'&&row.provenance.kind==='ai'));
    await assert.rejects(call('handoff',{runId:run.id,itemId:'draft-1',expectedRevision:engagement.revision}),{status:409});
    for(const assertion of [...engagement.assertions]){
      const bytes=store.readVersion(project.id,assertion.versionId).bytes;assert.ok(bytes.toString().includes(assertion.quote));assert.equal(digest(bytes),assertion.sourceSha256);
      command({type:'assertion-save',id:assertion.id,versionId:assertion.versionId,locator:assertion.locator,quote:assertion.quote,note:'SIMULATED original-source review; quotation checked against retained authored text.',topics:[],requirementIds:assertion.requirementIds,classification:'ai_suggested',reviewStatus:'confirmed',provenance:{kind:'human',method:'Simulated source inspection of the authored teaching text'}},roles.reviewer);
    }
    for(const finding of [...engagement.findings]){
      command({type:'finding-save',id:finding.id,requirementId:finding.requirementId,applicability:'applicable',applicabilityRationale:'This exact project-source commitment is within the synthetic client mandate.',coverage:'partial',adequacy:'deficient',performance:'undetermined',supportingAssertionIds:finding.supportingAssertionIds,contradictoryAssertionIds:[],rationale:finding.rationale,deficiency:'Implementation or outcome evidence identified by the original is missing.',recommendation:'Obtain dated records and independently inspect the applicable outcome.',uncertainty:'Synthetic source evidence only; no actual project or professional opinion.',riskSignificance:'Moderate',provenance:{kind:'human',method:'Simulated human correction of an AI-proposed finding; original AI provenance remains in history'}},roles.preparer);
      command({type:'finding-review',findingId:finding.id,decision:'revised',statement:'SIMULATED technical source review: checked exact quotations, retained missing information and undetermined performance.'},roles.reviewer);
    }
    await assert.rejects(call('handoff',{runId:run.id,itemId:'draft-10',expectedRevision:engagement.revision}),{status:409});
    assert.equal(JSON.stringify((await call('open',{runId:run.id})).output),originalOutput);
    for(const finding of [...engagement.findings])command({type:'action-save',findingIds:[finding.id],description:`Obtain dated implementation and outcome evidence for ${engagement.requirements.find(row=>row.id===finding.requirementId).title}`,owner:'Synthetic sponsor E&S manager',organization:'Synthetic Riverbridge sponsor',priority:'high',trigger:'ongoing',triggerDetail:'Before accepting the relevant construction or operational outcome',deliverables:['Dated original evidence and substantive verification'],verificationCriteria:'Reviewer checks exact implementation records and outcome evidence for this requirement; completing a plan alone is insufficient.',status:'open',provenance:{kind:'human',method:'Simulated practitioner action planning'}},roles.preparer);
    passed(7,'Review sources and correct findings',{findingIds:engagement.findings.map(row=>row.id),assertionIds:engagement.assertions.map(row=>row.id),verifiedBy:roles.reviewer,correctedProvenanceRetained:true,originalAiOutputUnchanged:true,multiItemRunAccepted:true,prefixCollisionAndHistoricalReplayBlocked:true,independentProfessionalAcceptance:false});

    const transition=(status,actor)=>command({type:'transition',status,statement:`SIMULATED declared ${actor}: ${status} for this exact synthetic teaching assignment.`,...(status==='published'?{formats:['html','docx','xlsx']}: {})},actor);
    transition('ready',roles.preparer);transition('under_review',roles.reviewer);
    command({type:'attest',kind:'assessor',statement:'SIMULATED assessor: complete scoped synthetic analysis with uncertainties disclosed.'},roles.preparer);
    command({type:'attest',kind:'technical',statement:'SIMULATED technical reviewer: exact sources and separate judgment dimensions checked.'},roles.reviewer);
    transition('reviewed',roles.reviewer);transition('approved',roles.approver);
    const baseline=structuredClone(engagement.baselines.at(-1));verifyEngagementSnapshot(baseline);assert.equal(baseline.findings.length,4);assert.equal(baseline.actions.length,4);assert.ok(baseline.findings.every(row=>row.status==='verified'));transition('published',roles.approver);
    passed(8,'Obtain explicit human approval',{baselineId:baseline.id,baselineSha256:baseline.sha256,actors:baseline.approvals.map(row=>({kind:row.kind,actorId:row.actorId})),authority:'Declared local roles simulated by acceptance code; not separately authenticated users or professional acceptance.'});

    const publication=engagement.publications.at(-1),artifacts=[];
    for(const format of ['html','docx','xlsx']){
      const output=await exportEngagementSnapshot(baseline,format),retained=engagements.retainIssuedRendition(engagement.id,{baselineId:baseline.id,publicationId:publication.id,format,selection:{},...output});
      assert.equal(retained.metadata.baselineId,baseline.id);assert.equal(retained.metadata.baselineSha256,baseline.sha256);assert.equal(digest(output.bytes),retained.metadata.sha256);
      if(format==='html') {const dom=new JSDOM(output.bytes.toString());assert.ok(dom.window.document.body.textContent.includes(baseline.sha256));for(const finding of baseline.findings)assert.ok(dom.window.document.body.textContent.includes(finding.rationale));for(const action of baseline.actions)assert.ok(dom.window.document.body.textContent.includes(action.description));dom.window.close();}
      if(format==='docx'){const xml=boundedZip(output.bytes).get('word/document.xml').bytes.toString();assert.ok(xml.includes(baseline.sha256));for(const finding of baseline.findings)assert.ok(xml.includes(finding.rationale));for(const action of baseline.actions)assert.ok(xml.includes(action.description));}
      if(format==='xlsx'){
        const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(output.bytes);const matrix=workbook.getWorksheet('Requirements matrix'),cap=workbook.getWorksheet('Action plan');assert.ok(matrix&&cap);
        const values=sheet=>sheet.getSheetValues().flat(3).filter(value=>typeof value==='string');const m=values(matrix),c=values(cap);
        for(const finding of baseline.findings)assert.ok(m.includes(finding.id));for(const action of baseline.actions)assert.ok(c.includes(action.id));assert.ok(m.includes(baseline.sha256)&&c.includes(baseline.sha256));
      }
      artifacts.push({...retained.metadata,bytesVerified:true});if(outputDirectory){await mkdir(resolve(outputDirectory),{recursive:true,mode:0o700});await writeFile(join(resolve(outputDirectory),`consultancy-approved.${format}`),output.bytes,{mode:0o600});}
    }
    passed(9,'Generate report, matrix and corrective-action plan',{sharedBaselineId:baseline.id,sharedBaselineSha256:baseline.sha256,artifacts,assessmentMatrixFindingIds:baseline.findings.map(row=>row.id),correctiveActionIds:baseline.actions.map(row=>row.id),nativeOfficeBytesInspected:true});

    command({type:'program-save',name:'Synthetic construction noise follow-up',baselineId:baseline.id,scope:'Check dated boundary measurement and calibration evidence',requirementIds:[engagement.requirements[0].id],topics:['pollution'],owner:roles.preparer,reviewer:roles.reviewer,frequency:'Monthly',reportingRequirements:'Synthetic monitoring report',supervisionIntensity:'enhanced'});
    const program=engagement.programs.at(-1);command({type:'cycle-save',programId:program.id,name:'Synthetic November implementation and outcome review',periodStart:'2026-11-01',periodEnd:'2026-11-30',dueDate:'2026-12-05',requirementIds:[engagement.requirements[0].id],owner:roles.preparer,reviewer:roles.reviewer,reportType:'periodic'});
    const cycle=engagement.cycles.at(-1),observation='SYNTHETIC FOLLOW-UP OBSERVATION. On 20 November 2026 an independent site observer inspected the boundary-noise meter calibration record and observed a repeat reading of 49 dBA at Boundary A. Calibration record CAL-SYN-01 was valid for that measurement. Noise control was installed and effective for the observed operating condition only; this source makes no livelihood, consultation or habitat conclusion.';
    project=store.mutate(project.id,project.revision,{type:'intake',mode:'managed',filename:'synthetic-followup-observation.txt',title:'Synthetic dated site observation and calibrated measurement',mediaType:'text/plain',contentBase64:Buffer.from(observation).toString('base64')});const observedVersion=project.resources.at(-1).versions[0];
    command({type:'assertion-save',versionId:observedVersion.id,locator:'Source text line 1',quote:observation,note:'SIMULATED source inspection of the authored later observation.',topics:['pollution'],requirementIds:[engagement.requirements[0].id],classification:'manual',reviewStatus:'confirmed',provenance:{kind:'human'}},roles.reviewer);const observationAssertion=engagement.assertions.at(-1);
    command({type:'mission-save',programId:program.id,cycleId:cycle.id,name:'Synthetic boundary observation',scope:'Inspect dated calibrated boundary measurement',team:[roles.reviewer],startDate:'2026-11-20',endDate:'2026-11-20',locations:['Boundary A'],itinerary:'Observe measurement and inspect calibration record',protocols:['Retain dated exact-source context'],requirementIds:cycle.requirementIds,obligationIds:[],priorFindingIds:[baseline.findings[0].id],eventIds:[],assertionIds:[observationAssertion.id],captureVersionIds:[observedVersion.id],status:'closed',report:observation,reviewStatement:'SIMULATED checked original observation and measurement context.',monitoringPoints:[]},roles.reviewer);
    command({type:'indicator-save',programId:program.id,name:'Synthetic Boundary A noise',topic:'pollution',unit:'dBA',method:'Calibrated repeat observation',frequency:'Monthly',location:'Boundary A',lab:'Synthetic field observation',detectionLimit:'1 dBA',threshold:{operator:'none'},requirementIds:cycle.requirementIds,obligationIds:[]});
    command({type:'measurement-save',indicatorId:engagement.indicators.at(-1).id,cycleId:cycle.id,value:49,observedAt:'2026-11-20T12:00:00.000Z',periodStart:cycle.periodStart,periodEnd:cycle.periodEnd,location:'Boundary A',method:'Calibrated repeat observation',lab:'Synthetic field observation',unit:'dBA',detectionLimit:'1 dBA',dataQuality:'verified',assertionIds:[observationAssertion.id],note:'Synthetic measured condition, not an inferred regulatory limit.',provenance:{kind:'human'}},roles.reviewer);
    const targetAction=baseline.actions.find(row=>row.findingIds.includes(baseline.findings.find(finding=>finding.requirementId===cycle.requirementIds[0]).id));
    command({type:'verification-save',cycleId:cycle.id,targetType:'action',targetId:targetAction.id,assertionIds:[observationAssertion.id],implementation:'implemented',effectiveness:'effective',decision:'accepted',statement:'SIMULATED calibrated dated original establishes this noise action implemented and effective for the observed condition.',independence:'independent',reviewStatement:'SIMULATED reviewer inspected exact source; no actual field inspection or professional assurance claimed.'},roles.reviewer);
    assert.equal(engagement.actions.find(row=>row.id===targetAction.id).status,'closed');assert.deepEqual(engagement.baselines.find(row=>row.id===baseline.id),baseline);
    assert.equal(engagement.actions.filter(row=>row.status==='open').length,3,'Other unresolved topics must not inherit the observed noise closure.');
    passed(10,'Create monitoring cycle and verify later evidence',{programId:program.id,cycleId:cycle.id,observationVersion:{id:observedVersion.id,sha256:observedVersion.sha256},assertionId:observationAssertion.id,missionId:engagement.missions.at(-1).id,measurementId:engagement.measurements.at(-1).id,verificationId:engagement.verifications.at(-1).id,closedActionId:targetAction.id,otherActionsRemainOpen:3,originalApprovedBaselineUnchanged:true});

    const foreignContext={accountId:b.accountId,projectId:b.projectId,engagementId:b.engagementId,actorId:roles.preparer};
    assert.throws(()=>other.readVersion(b.projectId,versions[0].id),error=>[403,404].includes(error.status));assert.throws(()=>other.getProject(project.id),error=>[403,404].includes(error.status));assert.throws(()=>other.engagements().get(engagement.id),error=>[403,404].includes(error.status));
    await assert.rejects(ai.handle({...foreignContext,operation:'estimate',body:task}),{status:400});await assert.rejects(ai.handle({...foreignContext,operation:'open',body:{runId:run.id}}),{status:404});
    const otherHistory=await ai.handle({...foreignContext,operation:'',body:{}});assert.equal(otherHistory.runs.length,0);assert.equal(otherHistory.conversations.length,0);const bPack=other.exportProject(b.projectId);assert.equal(JSON.stringify(bPack).includes(versions[0].sha256),false);assert.equal(JSON.stringify(bPack).includes(baseline.sha256),false);assert.equal(providerCalls.length,2);
    passed(11,'Demonstrate cross-client confidentiality',{samePhysicalIdentityId:seed.identityId,separateCustodyIds:[a.custodyId,b.custodyId],denied:['foreign document version','foreign project','foreign engagement','foreign AI source selection','foreign AI run/history','foreign export contents'],unauthorizedProviderDispatches:0,scope:'Local custody and actual AI API; remote multi-user isolation requires the separate authenticated security suite.'});

    const pack=store.exportProject(project.id),business=store.lifecycle().get('demo-preparer'),restoration=restored.restorePackage(pack),restoredStore=restored.forAccount(restoration.account.id),restoredEngagement=restoredStore.engagements().get(engagement.id);
    assert.equal(restoredStore.account.custodyId,a.custodyId);assert.deepEqual(restoredEngagement.baselines,engagement.baselines);assert.equal(restoredEngagement.actions.find(row=>row.id===targetAction.id).status,'closed');assert.deepEqual(restoredEngagement.issuedRenditions,artifacts.map(({bytesVerified,...metadata})=>metadata));
    for(const classification of classifications){const metadata=restoration.project.resources.flatMap(resource=>resource.versions).find(row=>row.id===classification.sourceVersionId).effectiveMetadata;assert.equal(metadata.classification.status,'human_confirmed');assert.equal(metadata.classification.sourceSha256,classification.sourceSha256);assert.equal(metadata.documentType,classification.documentType);}
    for(const source of [...sourceProof,{id:mandateVersion.id,sha256:mandateVersion.sha256},{id:observedVersion.id,sha256:observedVersion.sha256}])assert.equal(digest(restoredStore.readVersion(project.id,source.id).bytes),source.sha256);
    for(const artifact of artifacts)assert.equal(digest(restoredStore.engagements().getIssuedRendition(engagement.id,artifact.id).bytes),artifact.sha256);
    const restoredBusiness=restoredStore.lifecycle().import(0,business,'demo-preparer');assert.deepEqual(restoredBusiness,business);assert.deepEqual(restoredEngagement.baselines.find(row=>row.id===baseline.id),baseline);
    passed(12,'Export and restore into a fresh installation',{packageVersion:pack.packageVersion,recordPackageVersion:pack.recordPackageVersion,packageSha256:digest(JSON.stringify(pack)),sameCustodyId:a.custodyId,exactSourcesRestored:6,issuedArtifactsRestored:artifacts.length,approvedBaselinesRestored:restoredEngagement.baselines.length,businessLedgerSeparateExchange:true,businessExchangeSha256:digest(JSON.stringify(business)),importedApprovalGrantsNewAuthority:false,automaticSynchronization:false});
    const sourceFiles=['server/consultancy-demonstration.mjs','server/es-ai-workspace-api.mjs','server/es-ai-knowledge.mjs','src/lib/es-ai-skills.js','src/data/consultancy-demo.json','tools/run-consultancy-demonstration.mjs'];
    const receipt={format:'esia-consultancy-journey-proof',schemaVersion:1,passed:true,synthetic:true,recordedAt:new Date().toISOString(),steps,inference:'transport_simulation',providerRequests:0,simulatedAdapterCalls:providerCalls.length,independentPractitionerAcceptance:false,authenticatedRemoteTenantAcceptance:false,notice:'All source documents, provider outputs, human review and field observations are authored simulations. This proves software workflow mechanics and stated local custody boundaries only.',sources:await Promise.all(sourceFiles.map(async path=>({path,sha256:digest(await readFile(new URL('../'+path,import.meta.url)))})))};
    if(outputDirectory){await writeFile(join(resolve(outputDirectory),'consultancy-project-package.json'),JSON.stringify(pack,null,2)+'\n',{mode:0o600});await writeFile(join(resolve(outputDirectory),'consultancy-business-exchange.json'),JSON.stringify(business,null,2)+'\n',{mode:0o600});await writeFile(join(resolve(outputDirectory),'consultancy-journey.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});}
    return receipt;
  } finally {ai?.close();workspace.close();restored.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);if(args.length>1)throw Error('Usage: node tools/run-consultancy-demonstration.mjs [OUTPUT_DIRECTORY]');
  const proof=await runConsultancyDemonstration({outputDirectory:args[0]||'.build/open-core-evidence'});console.log(JSON.stringify({passed:proof.passed,steps:proof.steps.length,inference:proof.inference,providerRequests:proof.providerRequests,independentPractitionerAcceptance:false}));
}
