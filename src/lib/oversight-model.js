// Portable practitioner oversight records. Institutional appointment, source
// access and storage authority are supplied by the owning service, not labels.
export const oversightSchemaVersion = 1;
const field = (name, label, type = 'text', options) => ({name, label, type, ...(options ? {options} : {})});
const common = [field('title', 'Title / case code'), field('asOf', 'As of', 'date')];
const assignment = [field('owner', 'Responsible officer / team'), field('dueDate', 'Follow-up due', 'date')];
export const oversightRecordDefinitions = Object.freeze({
  opinion: {label: 'Technical opinion', fields: [...common,
    field('documentKind', 'Material reviewed', 'select', ['due_diligence','esia','rap','specialist_study','monitoring_report','ssv','disclosure','board_paper','legal_agreement','grievance_response','other']),
    field('scope', 'Scope of technical review', 'textarea'), field('criteriaBasis', 'Governing framework edition / legal provision', 'textarea'),
    field('opinion', 'Technical opinion', 'textarea'), field('risks', 'Risks and impacts', 'textarea'), field('mitigants', 'Mitigants and adequacy', 'textarea'),
    field('limitations', 'Evidence gaps, uncertainty and scope limits', 'textarea'), field('recommendation', 'Recommendation', 'textarea'),
    field('decisionNeeded', 'Decision / specialist input needed', 'textarea'), field('specialist', 'Specialist and discipline'), field('regionalTeam', 'Regional E&S team'), ...assignment]},
  rating: {label: 'Risk rating', fields: [...common, field('dimension', 'Rating dimension', 'select', ['performance','inherent']),
    field('scaleId', 'Scale', 'select', ['practitioner_performance_v1','institution_native']), field('scaleName', 'Institutional scale name'),
    field('scaleVersion', 'Scale edition / version'), field('scaleSource', 'Scale reference URL'), field('value', 'Original rating value'),
    field('basis', 'Rating rationale and change drivers', 'textarea'), ...assignment]},
  issue: {label: 'Risk / corrective follow-up', fields: [...common, field('theme', 'Theme'),
    field('severity', 'Priority', 'select', ['low','moderate','high','critical']), field('state', 'Follow-up state', 'select', ['open','in_progress','resolved']),
    field('risk', 'Risk / non-compliance', 'textarea'), field('mitigants', 'Mitigants / corrective action', 'textarea'), ...assignment,
    field('progress', 'Progress and outstanding barriers', 'textarea'), field('closureEvidence', 'Closure evidence', 'textarea'), field('verificationNote', 'Verification conclusion', 'textarea')]},
  visit: {label: 'Site supervision visit', fields: [...common, field('state', 'Visit state', 'select', ['planned','completed']),
    field('plannedDate', 'Planned visit', 'date'), field('completedDate', 'Actual visit', 'date'), field('region', 'Region'),
    field('objectives', 'Objectives / priority issues', 'textarea'), field('findings', 'Observed findings', 'textarea'),
    field('followUp', 'Follow-up and regional-team coordination', 'textarea'), field('nextVisitDate', 'Next supervision', 'date'), ...assignment]},
  grievance: {label: 'Complaint / accountability case', fields: [...common,
    field('channel', 'Channel', 'select', ['cao','direct','inspection_panel','other']), field('caseReference', 'External case reference'), field('caseUrl', 'Public case URL'),
    field('receivedDate', 'Received', 'date'), field('caseStatus', 'Case stage', 'select', ['received','assessment','active','monitoring','closed']),
    field('theme', 'Theme'), field('summary', 'Case summary without identifying details', 'textarea'), field('managementResponse', 'Management response', 'textarea'),
    field('responseDueDate', 'Response due', 'date'), field('commitments', 'Agreed commitments and solution pathway', 'textarea'),
    field('resolution', 'Resolution / outstanding non-compliance', 'textarea'), field('verificationNote', 'Resolution verification', 'textarea'),
    field('retaliationRisk', 'Reprisal risk', 'select', ['unknown','yes','no']), field('consent', 'Disclosure consent', 'select', ['unknown','withheld','limited','granted']), ...assignment]},
  review: {label: 'Management / complex-project review', fields: [...common,
    field('reviewKind', 'Review purpose', 'select', ['senior_management','complex_project','regional_supervision','technical_specialist']),
    field('periodStart', 'Period start', 'date'), field('periodEnd', 'Period end', 'date'), field('participants', 'Officers / regional specialists'),
    field('riskSummary', 'Concise risk framing', 'textarea'), field('mitigants', 'Mitigants and remaining exposure', 'textarea'),
    field('decisions', 'Management decisions / dissent', 'textarea'), field('escalation', 'Escalation and decision required', 'textarea'), ...assignment]},
  program: {label: 'Regional supervision program', fields: [...common, field('region', 'Region'),
    field('periodStart', 'Program starts', 'date'), field('periodEnd', 'Program ends', 'date'), field('priorities', 'Regional / sector / theme priorities', 'textarea'),
    field('coverage', 'Planned coverage and gaps', 'textarea'), field('resources', 'Specialists / resources and constraints', 'textarea'),
    field('coordination', 'Regional team coordination', 'textarea'), field('recommendation', 'Program review conclusion', 'textarea'), ...assignment]}
});
export const oversightRatingScales = Object.freeze([
  {id:'practitioner_performance_v1', name:'Practitioner performance assessment', version:'1', dimension:'performance', values:['on_track','attention_required','critical','unknown'],
    description:'Application working scale; not an official World Bank, IFC or MIGA rating.'},
  {id:'institution_native', name:'Original institutional scale', description:'Retain the original value, dimension, named scale, edition and source. No cross-institution equivalence is inferred.'}
]);
export const oversightProfileFields = Object.freeze([
  field('institution','WBG institution / window','select',['IBRD_IDA','IFC','MIGA','other']), field('country','Country'), field('region','Region'), field('sector','Sector'),
  field('themes','Themes (comma separated)','list'), field('leadOfficer','Lead / senior risk officer'), field('regionalTeam','Regional E&S team'),
  field('complexity','Project complexity','select',['routine','complex']), field('nextReviewDate','Next oversight review','date')
]);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => {throw Object.assign(new TypeError(message), {status:400});};
const id = value => {if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value))fail('Use an exact oversight record, project or account identifier.');return value;};
const actor = value => {if(typeof value!=='string'||!value.trim()||value.length>200||/[\x00-\x1f\x7f]/.test(value))fail('Use a bounded oversight actor identity.');return value.trim();};
const text = (value, maximum=8000) => {if(value===undefined||value===null)return '';if(typeof value!=='string'||value.length>maximum||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))fail('Oversight text is invalid or exceeds its limit.');return value.trim();};
export function oversightDate(value) {if(!value)return '';if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail('Use a valid YYYY-MM-DD oversight date.');return value;}
function sourceUrl(value) {if(!value)return '';let u;try{u=new URL(text(value,4000));}catch{fail('Use a credential-free HTTP(S) source reference.');}
  const secret=/^(?:token|.*[_-]token|auth|authorization|code|bearer|jwt|.*[_-]key|key|password|passwd|secret|.*[_-]secret|session(?:id|[_-]id|[_-]token)?|sid|signature|sig|credential|credentials|x-amz-.+|x-goog-.+|awsaccesskeyid|googleaccessid|key-pair-id|policy|rlkey|resourcekey)$/i;
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||[...u.searchParams.keys(),...new URLSearchParams(u.hash.slice(1)).keys()].some(k=>secret.test(k.replace(/\[\d*\]$/, '').replace(/[.\s]/g, '-'))))fail('Source references must omit credentials and signed links.');return u.href;}
function fields(input, definitions, extras=[]) {
  if(!object(input)||Object.keys(input).some(key=>!definitions.some(f=>f.name===key)&&!extras.includes(key)))fail('Unsupported oversight fields.');
  const result={};for(const f of definitions){const value=input[f.name];
    if(f.type==='list'){const values=Array.isArray(value)?value:text(value).split(',');if(values.length>30)fail('Use at most30 themes.');result[f.name]=[...new Set(values.map(v=>text(v,120)).filter(Boolean))];}
    else if(f.type==='date')result[f.name]=oversightDate(value);
    else{result[f.name]=text(value,f.type==='textarea'?8000:1000);if(f.options&&result[f.name]&&!f.options.includes(result[f.name]))fail(`Choose a valid ${f.label}.`);}
  }return result;
}
export function normalizeOversightValues(type, input) {
  const definition=Object.hasOwn(oversightRecordDefinitions,type)?oversightRecordDefinitions[type]:null;if(!definition)fail('Unknown oversight record type.');
  const value=fields(input,definition.fields,['evidencePins','relatedIds']);
  if(!value.title||!value.asOf)fail('Record a title/case code and as-of date.');
  for(const name of ['caseUrl','scaleSource'])if(Object.hasOwn(value,name))value[name]=sourceUrl(value[name]);
  const pins=input.evidencePins||[];if(!Array.isArray(pins)||pins.length>32)fail('Use at most32 exact evidence pins.');
  value.evidencePins=pins.map(pin=>{if(!object(pin)||Object.keys(pin).some(k=>!['resourceId','versionId','sha256','locator','label'].includes(k))||!/^[a-f0-9]{64}$/.test(pin.sha256||''))fail('An evidence pin needs exact resource/version IDs, SHA256 and locator.');
    const locator=text(pin.locator,2000);if(!locator)fail('Record a page, section, sheet, feature or other evidence locator.');return {resourceId:id(pin.resourceId),versionId:id(pin.versionId),sha256:pin.sha256,locator,label:text(pin.label,500)};});
  if(new Set(value.evidencePins.map(p=>JSON.stringify([p.resourceId,p.versionId,p.locator]))).size!==pins.length)fail('Duplicate evidence pin.');
  if(!Array.isArray(input.relatedIds||[])||(input.relatedIds||[]).length>32)fail('Use bounded related oversight IDs.');value.relatedIds=[...new Set((input.relatedIds||[]).map(id))];
  if(type==='rating'){
    if(!['performance','inherent'].includes(value.dimension)||!oversightRatingScales.some(s=>s.id===value.scaleId)||!value.value||!value.scaleVersion)fail('A rating needs its dimension, scale, edition and original value.');
    if(value.scaleId==='practitioner_performance_v1'&&(value.dimension!=='performance'||value.scaleVersion!=='1'||!oversightRatingScales[0].values.includes(value.value)))fail('The working performance scale uses version1 and its declared values only.');
    if(value.scaleId==='institution_native'&&(!value.scaleName||!value.scaleSource))fail('Native institutional ratings require a named/versioned scale and source reference.');
  }
  if(value.periodStart&&value.periodEnd&&value.periodStart>value.periodEnd)fail('A review/program period cannot end before it starts.');
  return value;
}
export function emptyOversightBundle({accountId,projectId}) {return {schemaVersion:1,accountId:id(accountId),projectId:id(projectId),revision:0,profile:{institution:'other',country:'',region:'',sector:'',themes:[],leadOfficer:'',regionalTeam:'',complexity:'routine',nextReviewDate:''},records:[]};}
function approvalReady(record){const v=record.values;
  const required={opinion:['scope','criteriaBasis','opinion','risks','mitigants','limitations','recommendation'],rating:['basis'],issue:['risk','mitigants','owner'],visit:['objectives','owner'],grievance:['channel','caseStatus','summary','owner'],review:['riskSummary','decisions','owner'],program:['region','periodStart','periodEnd','priorities','coverage','owner']}[record.type];
  if(required.some(key=>!v[key]))fail('Complete the rationale, responsibility and review fields before approval.');
  if(['opinion','rating'].includes(record.type)&&!v.evidencePins.length)fail('An approved opinion or rating needs at least one verified, located source version.');
  if(record.type==='issue'&&v.state==='resolved'&&(!v.closureEvidence||!v.verificationNote||!v.evidencePins.length))fail('Resolved corrective follow-up requires closure evidence and a verification conclusion.');
  if(record.type==='grievance'&&v.caseStatus==='closed'&&(!v.resolution||!v.verificationNote||!v.evidencePins.length))fail('Case closure needs evidence and verification; administrative closure alone is insufficient.');
  if(record.type==='visit'&&v.state==='completed'&&(!v.completedDate||!v.findings||!v.followUp))fail('Completed supervision visits need an actual date, findings and follow-up.');
}
/** Pure transition; the owning service verifies evidence, permissions, CAS and
 * immutable persistence. A workflow approval is not an institutional appointment. */
export function applyOversightCommand(bundle, command, {actorId,now=new Date().toISOString(),canApprove=false,approvalAuthority='local_practitioner'}={}) {
  actorId=actor(actorId);if(!object(bundle)||bundle.schemaVersion!==1||!Number.isSafeInteger(bundle.revision)||bundle.revision<0||bundle.revision>=Number.MAX_SAFE_INTEGER||!Array.isArray(bundle.records)||!object(command))fail('Invalid oversight state or command.');
  const next=structuredClone(bundle);if(next.records.length>500)fail('Project oversight record limit reached.');
  if(command.op==='profile')next.profile={...next.profile,...fields(command.values,oversightProfileFields)};
  else if(command.op==='upsert'){
    const existing=command.recordId?next.records.find(r=>r.id===command.recordId):null;
    if(command.recordId&&!existing)fail('Oversight record was not found in this project.');
    if(!existing&&next.records.length>=500)fail('Project oversight record limit reached.');
    if(existing&&(existing.revision!==command.recordRevision||existing.type!==command.type))throw Object.assign(new Error('This oversight record changed; reload before saving.'),{status:409});
    const values=normalizeOversightValues(command.type,command.values);
    for(const related of values.relatedIds)if(!next.records.some(r=>r.id===related&&r.id!==existing?.id))fail('Related oversight records must belong to this project.');
    const record={id:existing?.id||crypto.randomUUID(),type:command.type,institution:next.profile.institution,revision:(existing?.revision||0)+1,status:'draft',author:existing?.author||actorId,contentAuthor:actorId,
      updatedBy:actorId,createdAt:existing?.createdAt||now,updatedAt:now,values};
    if(existing)next.records[next.records.findIndex(r=>r.id===record.id)]=record;else next.records.push(record);
  }else{
    if(!['submit','approve','return','supersede'].includes(command.op))fail('Unknown oversight transition.');
    const record=next.records.find(r=>r.id===command.recordId);if(!record)fail('Oversight record was not found in this project.');
    if(record.revision!==command.recordRevision)throw Object.assign(new Error('This oversight record changed; reload before deciding.'),{status:409});
    const expected={submit:['draft'],approve:['in_review'],return:['in_review','approved'],supersede:['draft','in_review','approved']}[command.op];
    if(!expected.includes(record.status))fail('This oversight transition is not available for the current record status.');
    if(['approve','return'].includes(command.op)&&!canApprove)throw Object.assign(new Error('Current review authority is required.'),{status:403});
    const note=text(command.note);if(['approve','return','supersede'].includes(command.op)&&!note)fail('Record the decision rationale.');
    if(command.op==='approve')approvalReady(record);
    record.status={submit:'in_review',approve:'approved',return:'draft',supersede:'superseded'}[command.op];record.revision++;record.updatedBy=actorId;record.updatedAt=now;
    record.decision={action:command.op,actorId,at:now,note,authority:text(approvalAuthority,200),independentReview:actorId!==record.author&&actorId!==(record.contentAuthor||record.author)};
  }
  next.revision++;return next;
}

/** Only supplied authorized projects are projected. Complaint free text,
 * response text, case URLs, consent/reprisal details and evidence are omitted. */
export function buildOversightPortfolio({projects=[],bundles=[],filters={},asOf=new Date().toISOString().slice(0,10)}={}) {
  oversightDate(asOf);if(!Array.isArray(projects)||!Array.isArray(bundles)||projects.length>5000||bundles.length>5000||projects.some(p=>!object(p))||bundles.some(b=>!object(b)||b.schemaVersion!==1||!Array.isArray(b.records)||!object(b.profile)))fail('Choose a bounded portfolio of valid project scopes and oversight bundles.');
  if(!object(filters)||Object.keys(filters).some(key=>!['institution','region','sector','theme','q'].includes(key))||Object.values(filters).some(value=>typeof value!=='string'||value.length>500))fail('Choose bounded institution, region, sector, theme or search filters.');
  const byProject=new Map(bundles.map(b=>[b.projectId,b])),rows=[];
  for(const project of projects){const projectId=project.id||project.project_id,b=byProject.get(projectId);if(!b)continue;
    if([project.accountId,project.account_id].filter(Boolean).some(account=>account!==b.accountId))continue;
    const p=b.profile,records=b.records.filter(r=>r.status!=='superseded'&&r.values.asOf<=asOf);
    if(['institution','region','sector'].some(k=>filters[k]&&filters[k]!=='all'&&p[k]!==filters[k])||filters.theme&&!p.themes.includes(filters.theme))continue;
    if(filters.q&&![project.name,project.title,projectId,p.country,p.region,p.sector,...p.themes].some(v=>String(v||'').toLowerCase().includes(filters.q.toLowerCase())))continue;
    const ratings=records.filter(r=>r.type==='rating'&&r.status==='approved').sort((a,b)=>a.values.asOf.localeCompare(b.values.asOf)||a.updatedAt.localeCompare(b.updatedAt));
    const latestRatings=[];for(const r of ratings){const key=JSON.stringify([r.institution||'other',r.values.dimension,r.values.scaleId,r.values.scaleName,r.values.scaleVersion,r.values.scaleSource]);const old=latestRatings.findIndex(x=>x.scaleKey===key);const item={recordId:r.id,recordRevision:r.revision,institution:r.institution||'other',scaleKey:key,...Object.fromEntries(['asOf','dimension','scaleId','scaleName','scaleVersion','scaleSource','value'].map(k=>[k,r.values[k]])),decidedBy:r.decision?.actorId||null};if(old>=0)latestRatings[old]=item;else latestRatings.push(item);}
    const issues=records.filter(r=>r.type==='issue'&&r.status==='approved').map(r=>({recordId:r.id,revision:r.revision,title:r.values.title,theme:r.values.theme,severity:r.values.severity,state:r.values.state,risk:r.values.risk,mitigants:r.values.mitigants,owner:r.values.owner,dueDate:r.values.dueDate,progress:r.values.progress}));
    const visits=records.filter(r=>r.type==='visit').map(r=>({recordId:r.id,revision:r.revision,status:r.status,state:r.values.state,plannedDate:r.values.plannedDate,completedDate:r.values.completedDate,nextVisitDate:r.values.nextVisitDate,owner:r.values.owner}));
    // Explicitly reviewed work products only. Direct complaint records never
    // enter this projection; authored text still needs a distribution review.
    const workProducts=records.filter(r=>r.status==='approved'&&['opinion','review','program','visit','rating','issue'].includes(r.type)).map(r=>({recordId:r.id,revision:r.revision,type:r.type,institution:r.institution||'other',status:r.status,author:r.author,contentAuthor:r.contentAuthor||r.author,updatedAt:r.updatedAt,decision:structuredClone(r.decision||null),values:structuredClone(r.values)}));
    const cases=records.filter(r=>r.type==='grievance'),overdue=issues.filter(i=>i.state!=='resolved'&&i.dueDate&&i.dueDate<asOf).length;
    rows.push({projectId,accountId:b.accountId,name:project.name||project.title||projectId,revision:b.revision,profile:structuredClone(p),latestRatings,
      ratingHistory:ratings.map(r=>({recordId:r.id,revision:r.revision,asOf:r.values.asOf,institution:r.institution||'other',dimension:r.values.dimension,scaleId:r.values.scaleId,scaleName:r.values.scaleName,scaleVersion:r.values.scaleVersion,scaleSource:r.values.scaleSource,value:r.values.value})),issues,visits,workProducts,
      grievanceSummary:{total:cases.length,open:cases.filter(r=>!(r.status==='approved'&&r.values.caseStatus==='closed')).length,overdueResponses:cases.filter(r=>!(r.status==='approved'&&r.values.caseStatus==='closed')&&r.values.responseDueDate&&r.values.responseDueDate<asOf).length},
      pendingReviews:records.filter(r=>r.status==='in_review').length,overdueActions:overdue,unrated:!latestRatings.some(r=>r.dimension==='performance'),
      sourceRevisions:records.map(r=>({id:r.id,type:r.type,revision:r.revision,status:r.status}))});
  }
  const dimensions={};for(const dimension of ['institution','region','sector'])dimensions[dimension]=[...new Set(rows.map(r=>r.profile[dimension]).filter(Boolean))].sort();dimensions.themes=[...new Set(rows.flatMap(r=>r.profile.themes))].sort();
  const ratingGroups=[];for(const row of rows)for(const rating of row.latestRatings){const key=[rating.scaleKey,rating.value].join(':');let group=ratingGroups.find(g=>g.key===key);if(!group){group={key,institution:rating.institution,scaleId:rating.scaleId,scaleName:rating.scaleName,scaleSource:rating.scaleSource,scaleVersion:rating.scaleVersion,dimension:rating.dimension,value:rating.value,projects:0};ratingGroups.push(group);}group.projects++;}
  return {schemaVersion:1,asOf,filters:structuredClone(filters),projects:rows,summary:{projects:rows.length,unrated:rows.filter(r=>r.unrated).length,pendingReviews:rows.reduce((n,r)=>n+r.pendingReviews,0),overdueActions:rows.reduce((n,r)=>n+r.overdueActions,0),openGrievances:rows.reduce((n,r)=>n+r.grievanceSummary.open,0),overdueResponses:rows.reduce((n,r)=>n+r.grievanceSummary.overdueResponses,0)},dimensions,ratingGroups,
    limitations:['Institutional scales remain separate; categories are not performance ratings.','Only supplied authorized project scopes are included; missing or unreviewed ratings remain unknown.','As-of filters effective observation dates in current records. Reopen an issued snapshot for its frozen earlier knowledge state.','Direct grievance record fields are omitted. Sensitive information copied into other authored narratives requires separate review before distribution.','Application workflow decisions do not establish an institutional appointment or Board/ERC clearance.']};
}
export function createOversightSnapshot({portfolio,kind,title,periodStart,periodEnd,decisions,actorId,now=new Date().toISOString(),id:snapshotId=crypto.randomUUID()}={}){
  if(!['senior_management','regional_program','integrated_risk'].includes(kind)||!object(portfolio)||portfolio.schemaVersion!==1)fail('Choose a management, regional or integrated-risk snapshot.');
  const start=oversightDate(periodStart),end=oversightDate(periodEnd);if(!start||!end||start>end)fail('Record a valid reporting period.');
  const name=text(title,1000),decision=text(decisions);if(!name||!decision)fail('Record a report title and decision / recommendation narrative.');
  return {schemaVersion:1,id:id(snapshotId),kind,title:name,periodStart:start,periodEnd:end,decisions:decision,createdAt:now,createdBy:actor(actorId),status:'practitioner_snapshot',
    portfolio:structuredClone(portfolio),sourceRevisions:portfolio.projects.map(p=>({accountId:p.accountId,projectId:p.projectId,revision:p.revision,records:structuredClone(p.sourceRevisions)})),
    clearance:'Prepared practitioner work product; institutional review and delivery are separate.'};
}
