// Preparation records reference the canonical engagement and deployment evidence.
// They do not grant access, accept a report, or certify a deployment.
export const CONSULTANCY_OPERATION_CHECKS = Object.freeze([
  {id:'mandate_rights', label:'Mandate, scope and source rights', evidence:['Client/mandate reference, ToR and applicable editions', 'Exact original/version rights for possession, processing, AI and handover', 'Deliverables, exclusions, client acceptance and retention agreement']},
  {id:'deployment_boundary', label:'Deployment and client boundary', evidence:['Exact source/artifact and configuration hashes; deployment owner/profile', 'Local trusted-owner/device boundary OR actual authenticated JWT/IAM/storage scope', 'Client A/B same-project negative read/search/export and current permission evidence']},
  {id:'onboarding_roles', label:'Client onboarding and authority', evidence:['Approved named user/role/grant register and identity verification reference', 'Least-privilege invitation/expiry and client-access scope', 'Client acknowledgement of workflow, limitations, support and incident route']},
  {id:'protected_stakeholders', label:'Protected stakeholder and case records', evidence:['Field-group permissions, encryption/passphrase custody and protected original scope', 'Unauthorized case summary/detail/original/history/export denial; current revocation', 'Sanitized views, masking and allowed client disclosure reviewed; no identifying test bytes in logs']},
  {id:'ai_retrieval', label:'Retrieval and optional AI disclosure', evidence:['AI disabled OR exact approved provider/model/route/evaluation, processing rights and retention', 'Unauthorized lexical/semantic/hybrid index, context, history and export denial', 'Rights revoked after selection and before dispatch/output; protected passages withheld; request/cost stop limits']},
  {id:'key_custody', label:'Encryption and credential key management', evidence:['Key owner and protected secret-manager reference; no key values in this packet', 'Device/volume/backup encryption and separate recovery-key custody', 'Vault master-key recovery/rotation or credential re-entry exercise; provider revoke reference; case-passphrase recovery limitations']},
  {id:'backup_recovery', label:'Backup, restore and rollback', evidence:['Stopped/consistent backup, encryption, custody, cadence, retention and separate key reference', 'Actual fresh restore timestamp, original/output hashes and account/grant checks', 'Measured recovery time/data-loss window against agreed RTO/RPO; rollback target and decision owner']},
  {id:'revocation', label:'Access and processing revocation', evidence:['Exact user/grant/token/provider reference and effective revocation time', 'Current denial for original, case, index/search, AI context/history, issued output and export', 'Pending jobs/credential routes reviewed; already downloaded bytes and remote-provider retention limits disclosed']},
  {id:'retention_closeout', label:'Retention and client closeout', evidence:['Client-authorized editable outputs plus complete manifest and permitted exact originals', 'Destination restore and receipt by client custodian, with unresolved external references', 'Access/credential revocation, local/cache/AI retention/deletion or legal-hold decision, backups expiry and residual copies']},
  {id:'incident_response', label:'Incident handling and external security review', evidence:['Named incident decision owner, private contact, escalation and notification agreement', 'Deployment-specific threat review and independent assessor scope/findings/disposition', 'Logs minimized, privileged access reviewed and incident/recovery exercise reference']},
  {id:'technical_briefing', label:'Client technical security briefing', evidence:['Exact profile/version, data flow and trust boundaries explained', 'AI/source rights, protected records, roles, key/backup custody, incident/exit limits', 'Briefing recipient/date, questions/corrections and acknowledged remaining risks']},
  {id:'retrospective', label:'Authorized retrospective comparison', evidence:['Completed lawful case, original professional outputs and unchanged governing editions', 'All findings denominator, source/citation/fabrication/omission review and correction work/time', 'Independent professional review reference and disagreements; no synthetic acceptance']},
  {id:'longitudinal', label:'Monitoring continuity', evidence:['Actual baseline and later reporting period/site evidence with exact retained versions', 'Action history and separate substantive closure/effectiveness review', 'Later practitioner/client feedback and restore check; synthetic rehearsal clearly separated']}
].map(row=>Object.freeze({...row,evidence:Object.freeze(row.evidence)})));

export function createConsultancyOperationsPacket() {
  return {format:'esia-consultancy-operations-preparation',schemaVersion:1,
    scope:{accountId:null,projectId:null,engagementId:null,sourceCommit:null,deploymentProfile:null,deploymentConfigurationSha256:null},
    observationMode:'preparation_only',
    checks:CONSULTANCY_OPERATION_CHECKS.map(({id})=>({id,status:'pending',ownerReference:null,notes:'',notApplicableReason:null,evidence:[]})),
    deploymentAccepted:false,professionalApprovalGranted:false,independentReviewEstablished:false};
}

export function validateConsultancyOperationsPacket(input) {
  const text=(value,label,max=4000)=>{if(typeof value!=='string'||!value.trim()||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))throw Error(`${label} needs bounded nonempty text.`);return value.trim();};
  const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  if(input?.format!=='esia-consultancy-operations-preparation'||input.schemaVersion!==1||input.observationMode!=='preparation_only')throw Error('Use the preparation-only consultancy operations format.');
  if(input.deploymentAccepted!==false||input.professionalApprovalGranted!==false||input.independentReviewEstablished!==false)throw Error('This instrument cannot grant deployment, professional or independent-review acceptance.');
  const scope=input.scope;
  if(!scope||!Array.isArray(input.checks)||input.checks.length!==CONSULTANCY_OPERATION_CHECKS.length||new Set(input.checks.map(row=>row?.id)).size!==CONSULTANCY_OPERATION_CHECKS.length)throw Error('Retain every canonical operations check exactly once.');
  const missingScope=['accountId','projectId','engagementId','sourceCommit','deploymentProfile','deploymentConfigurationSha256'].filter(key=>scope[key]===null||scope[key]==='');
  for(const key of ['accountId','projectId','engagementId','deploymentProfile'])if(!missingScope.includes(key))text(scope[key],key,300);
  if(!missingScope.includes('sourceCommit')&&!/^[a-f0-9]{40}$/.test(scope.sourceCommit||''))throw Error('Pin the exact 40-character source commit.');
  if(!missingScope.includes('deploymentConfigurationSha256')&&!digest(scope.deploymentConfigurationSha256))throw Error('Pin the actual deployment configuration hash.');
  const pending=[],reported=[],notApplicable=[];
  for(const definition of CONSULTANCY_OPERATION_CHECKS){
    const row=input.checks.find(row=>row.id===definition.id);
    if(!row||!['pending','evidence_reported','not_applicable'].includes(row.status)||!Array.isArray(row.evidence)||row.evidence.length>100)throw Error('Each operations check needs a supported status and bounded evidence list.');
    if(row.notes!==''&&row.notes!==undefined)text(row.notes,'Operations notes');
    for(const evidence of row.evidence){
      text(evidence.reference,'Private evidence reference',2000);text(evidence.observerReference,'Evidence observer reference',300);text(evidence.result,'Observed result');
      if(!digest(evidence.sha256)||typeof evidence.observedAt!=='string'||!Number.isFinite(Date.parse(evidence.observedAt)))throw Error('Every evidence reference needs its exact digest and observation time.');
      if(evidence.mode!=='actual'&&evidence.mode!=='synthetic')throw Error('Label every evidence item actual or synthetic.');
    }
    if(row.status==='evidence_reported'){
      text(row.ownerReference,'Responsible owner reference',300);
      if(missingScope.length||!row.evidence.length)throw Error('Reported evidence requires the complete engagement/deployment scope and an evidence reference.');
      reported.push(row.id);
    }else if(row.status==='not_applicable'){
      text(row.ownerReference,'Responsible owner reference',300);text(row.notApplicableReason,'Not-applicable rationale');notApplicable.push(row.id);
    }else pending.push(row.id);
  }
  return {format:'esia-consultancy-operations-validation',schemaVersion:1,structurallyValid:true,missingScope,pending,reported,notApplicable,evidenceCompleteForReview:missingScope.length===0&&pending.length===0,actualEvidenceItems:input.checks.flatMap(row=>row.evidence).filter(row=>row.mode==='actual').length,syntheticEvidenceItems:input.checks.flatMap(row=>row.evidence).filter(row=>row.mode==='synthetic').length,deploymentAccepted:false,professionalApprovalGranted:false,independentReviewEstablished:false,authority:'Format and completeness checks only. Inspect referenced evidence and obtain the separate responsible decisions; no evidence content, identity or outcome is verified here.'};
}
