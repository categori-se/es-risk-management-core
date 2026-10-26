import {getTemplateExtensionProfile,validateSpecialistTemplateValue} from './client-template-extensions.js';
import {monitoringActionBelongsToProgram} from './engagement-domain.js';
import {projectMonitoringDisclosure} from './monitoring-protection.js';

// A view over existing domain records. This registry grants no read/write authority.
export const templateBindingVersion = 1;
const fields = {
 project: 'id name engagement.client engagement.phase engagement.period',
 engagement: 'id name client type scope exclusions contentRevision revision status',
 cycles: 'id name periodStart periodEnd dueDate owner reviewer reportType status programId',
 requirements: 'id title text standard clause frameworkId edition topics',
 assertions: 'id versionId sourceSha256 locator quote note requirementIds reviewStatus',
 findings: 'id requirementId applicability coverage adequacy performance rationale deficiency recommendation uncertainty riskSignificance cycleId supportingAssertionIds contradictoryAssertionIds implementation effectiveness evidenceSufficiency',
 actions: 'id description owner organization priority dueDate status progress trigger deliverables verificationCriteria findingIds monitoringObligationIds closureAssertionIds cycleId',
 indicators: 'id name topic unit method frequency location threshold requirementIds obligationIds programId',
 measurements: 'id indicatorId cycleId value unit observedAt periodStart periodEnd method location note dataQuality assertionIds',
 monitoringObligations: 'id title owner organization frequency dueDate verificationCriteria requirementIds originFindingIds sourceVersionId sourceSha256 locator programId status',
 missions: 'id name scope startDate endDate cycleId team protocols requirementIds obligationIds assertionIds status report',
 events: 'id kind code publicSummary severity occurredAt receivedAt status cycleId requirementIds obligationIds assertionIds actionIds',
 verifications: 'id cycleId targetType targetId assertionIds implementation effectiveness decision statement independence reviewStatement reviewedBy reviewedAt'
};
const numeric = new Set(['value','contentRevision','revision']);
const dates = new Set(['periodStart','periodEnd','dueDate','observedAt','occurredAt','receivedAt','startDate','endDate','reviewedAt']);
const arrays = new Set(['scope','exclusions','topics','requirementIds','supportingAssertionIds','contradictoryAssertionIds','findingIds','monitoringObligationIds','closureAssertionIds','obligationIds','originFindingIds','team','protocols','assertionIds','actionIds','deliverables']);
export const templateCanonicalFields = Object.freeze(Object.fromEntries(Object.entries(fields).flatMap(([entity,list]) => list.split(' ').map(key => [`${entity}.${key}`, Object.freeze({entity,key,type:numeric.has(key)?'number':dates.has(key)?'date':key==='threshold'?'object':key==='scope'&&entity==='missions'?'text':arrays.has(key)?'array':'text',cardinality:['project','engagement'].includes(entity)?'one':'many'})]))));
const entities = new Set(Object.keys(fields)), collections = new Set(Object.keys(fields).filter(key => !['project','engagement'].includes(key)));
const safeKey = key => typeof key==='string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}$/.test(key) && !key.split('.').some(part=>['__proto__','prototype','constructor'].includes(part));
const plain = value => value!==null && typeof value==='object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const copy = value => value===undefined?undefined:structuredClone(value);
const fail = message => {throw Object.assign(Error(message),{status:422,statusCode:422});};
const empty = value => value===undefined || value===null || value==='' || Array.isArray(value)&&!value.length;
const get = (value,path) => path.split('.').reduce((current,key)=>current!==null&&typeof current==='object'&&Object.hasOwn(current,key)?current[key]:undefined,value);
const approved = review => review?.status==='approved' && typeof review.reviewerId==='string' && review.reviewerId.trim() && typeof review.statement==='string' && review.statement.trim() && Number.isFinite(Date.parse(review.reviewedAt));
const fieldType = field => field.valueType||field.dataType||({repeat_table:'array',selection:'text',signature:'text'}[field.type]||field.type||'text');
const normalized = value => String(value||'').normalize('NFKC').replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().replace(/[_-]/g,' ').replace(/[^\p{L}\p{N} ]/gu,' ').replace(/\s+/g,' ').trim();
const signature = field => {let n=2166136261;for(const character of `${fieldType(field)}|${normalized(field.label)}`)n=Math.imul(n^character.charCodeAt(0),16777619);return `semantic-v1-${(n>>>0).toString(16).padStart(8,'0')}`;};
const allowedPath = (path,entity) => typeof path==='string' && safeKey(path) && (Boolean(templateCanonicalFields[path]) || collections.has(path) || entity&&Boolean(templateCanonicalFields[`${entity}.${path}`]));
const diagnostic = (code,message,fieldId) => ({code,message,...(fieldId?{fieldId}:{})});
const aliases = {
 'project.name':['project name','investment name','project identity','investment'],
 'project.engagement.client':['client name','client','sponsor name'],
 'cycles.periodStart':['period start','reporting period start','monitoring period start'],
 'cycles.periodEnd':['period end','reporting period end','monitoring period end'],
 'missions.startDate':['date of supervision mission','mission date','field visit date'],
 actions:['actions','undertakings','esap actions','outstanding esap actions','corrective actions','esap status table','commitments','esap progress'],
 measurements:['environmental monitoring','monitoring measurements','environmental monitoring data','monitoring data'],
 findings:['monitoring findings','findings','es performance findings'],
 requirements:['applicable requirements','requirements'],
 events:['incidents during reporting period','incident register','incidents','grievances'],
 assertions:['evidence register','evidence'],
 'engagement.scope':['scope','scope of work','scope and methodology']
};
const columnAliases = {description:['action','commitment','description','esap item'],owner:['owner','responsible person','responsibility'],dueDate:['due date','deadline','target date'],status:['status','progress status'],priority:['priority'],value:['result','measurement','value'],unit:['unit','units'],observedAt:['sample date','measurement date'],name:['name','indicator'],rationale:['finding','rationale'],recommendation:['recommendation'],publicSummary:['summary','incident'],severity:['severity']};

/** Recognition is a proposal, including exact aliases. Risk/performance judgments
 * deliberately remain report-only until an explicit reviewer supplies meaning. */
export function proposeTemplateBindings({analysis,learned=[],accountId}={}) {
 if(!analysis||!Array.isArray(analysis.fields)||analysis.fields.length>1000)fail('Analyze a bounded template before proposing mappings.');
 return analysis.fields.map(field=>{
  const name=normalized(field.label),matches=Object.entries(aliases).filter(([,values])=>values.includes(name)).map(([path])=>path);
  const prior=(Array.isArray(learned)?learned:learned?.entries||[]).filter(item=>item.accountId===accountId&&accountId&&item.signature===signature(field)&&item.review?.status==='approved');
  const learnedPaths=[...new Set(prior.map(item=>item.path).filter(path=>allowedPath(path)))];
  const path=matches.length===1?matches[0]:!matches.length&&learnedPaths.length===1?learnedPaths[0]:undefined;
  let binding={id:`binding:${field.id}`,fieldId:field.id,anchor:copy(field.anchor),version:1,type:path&&collections.has(path)?'repeat':path?'direct':'extension',confidence:path?matches.length?0.94:0.8:0,origin:matches.length?'canonical_alias':path?'account_approved_signature':'unmatched',meaning:path?`View of ${path}`:'Report-specific meaning requires review',review:{status:'proposed'}};
  if(['monitoring period','reporting period'].includes(name)){binding={...binding,type:'calculated',confidence:0.94,origin:'canonical_alias',meaning:'Selected canonical reporting period',expression:{op:'concat',separator:' – ',args:[{path:'cycles.periodStart'},{path:'cycles.periodEnd'}]}};return binding;}
  if(path){binding.path=path;if(binding.type==='repeat'){binding.columns={};for(const column of field.columns||[]){const key=column.key||column.id,semantic=Object.entries(columnAliases).find(([,values])=>values.includes(normalized(column.label||key)))?.[0];if(semantic&&allowedPath(semantic,path)&&safeKey(key))binding.columns[key]={path:semantic};}if(name==='outstanding esap actions')binding.filter={op:'ne',path:'status',value:'closed'};if(name==='grievances')binding.filter={op:'eq',path:'kind',value:'grievance'};}}
  else binding.namespace=`template.${String(analysis.templateId||'pending').replace(/[^A-Za-z0-9_-]/g,'_')}.${String(field.id).replace(/[^A-Za-z0-9_-]/g,'_')}`;
  if(/risk|rating|judg|assessment summary|performance summary|conclusion|recommendation|narrative/.test(name)&&!path){binding.type='narrative';delete binding.namespace;binding.confidence=0;binding.meaning='Authored interpretation; approved citations and review required';}
  return binding;
 });
}

const comparisonOps=new Set(['eq','ne','in','gt','gte','lt','lte','exists','and','or','not']);
const expressionOps=new Set(['count','sum','average','join','percentage','add','subtract','multiply','divide','coalesce','concat']);
function checkFilter(filter,entity,depth=0){
 if(depth>12||!plain(filter)||!comparisonOps.has(filter.op))fail('Filters use the bounded typed comparison language.');
 if(['and','or','not'].includes(filter.op)){if(!Array.isArray(filter.args)||!filter.args.length||filter.args.length>20||filter.op==='not'&&filter.args.length!==1)fail('Logical filters require bounded arguments.');filter.args.forEach(item=>checkFilter(item,entity,depth+1));}
 else {if(!allowedPath(filter.path,entity)||collections.has(filter.path))fail(`Unknown filter field ${filter.path}.`);if(filter.op==='in'&&(!Array.isArray(filter.value)||filter.value.length>100))fail('Membership filters require at most 100 literal values.');if(filter.value!==undefined&&JSON.stringify(filter.value).length>4000)fail('Filter literal exceeds its bound.');}
}
function checkExpression(expression,depth=0){
 if(depth>12||!plain(expression))fail('Calculations must be bounded declarative expressions.');
 if(Object.hasOwn(expression,'literal')){if(typeof expression.literal==='object'&&expression.literal!==null||typeof expression.literal==='function'||typeof expression.literal==='number'&&!Number.isFinite(expression.literal)||JSON.stringify(expression.literal??null).length>4000)fail('Expression literals must be bounded scalar values.');return;}
 if(expression.path&&!expression.op){if(!allowedPath(expression.path))fail('Calculation references an unknown canonical path.');return;}
 if(!expressionOps.has(expression.op))fail('Unsupported calculation operation.');
 if(['count','sum','average','join'].includes(expression.op)){if(!collections.has(expression.path))fail('Aggregates require a canonical collection.');if(expression.op!=='count'&&!allowedPath(expression.field,expression.path))fail('Aggregate field is not canonical.');if(expression.where)checkFilter(expression.where,expression.path);if(expression.op==='join'&&(expression.separator!==undefined&&(typeof expression.separator!=='string'||expression.separator.length>20)))fail('Joined views require a bounded text separator.');}
 else {if(!Array.isArray(expression.args)||!expression.args.length||expression.args.length>30)fail('Calculation requires bounded expression arguments.');expression.args.forEach(item=>checkExpression(item,depth+1));if(['percentage','subtract','divide'].includes(expression.op)&&expression.args.length!==2)fail('This calculation requires exactly two arguments.');}
}
const unitConversions=Object.freeze({'kg:t':0.001,'t:kg':1000,'g:kg':0.001,'kg:g':1000,'m:km':0.001,'km:m':1000,'L:m3':0.001,'m3:L':1000,'mg/L:g/L':0.001,'g/L:mg/L':1000});
function checkReference(reference){if(reference!==undefined&&(!plain(reference)||!collections.has(reference.entity)||!allowedPath(reference.field,reference.entity)||Object.keys(reference).some(key=>!['entity','field'].includes(key))))fail('Nested references require an existing canonical entity and field.');}
function checkTransforms(transforms){for(const transform of transforms===undefined?[]:Array.isArray(transforms)?transforms:[transforms]){
 if(!plain(transform)||!['date','unit','vocabulary','join','number'].includes(transform.kind))fail('Unknown declarative transformation.');
 if(transform.kind==='date'&&!['iso','dmy','mdy','year-month'].includes(transform.format))fail('Choose an explicit supported date format.');
 if(transform.kind==='unit'&&transform.from!==transform.to&&!Object.hasOwn(unitConversions,`${transform.from}:${transform.to}`))fail('Unit conversion is not supported or dimensionally compatible.');
 if(transform.kind==='vocabulary'&&(!plain(transform.map)||Object.entries(transform.map).length>100||Object.values(transform.map).some(value=>typeof value!=='string'||value.length>500)||!['error','preserve'].includes(transform.unmapped||'error')))fail('Vocabulary mappings require explicit bounded string values and unmapped behavior.');
}}
export function validateTemplateBindings({definition,bindings=definition?.bindings}={}) {
 const errors=[],warnings=[],fields=definition?.fields||[],seen=new Set();
 if(!Array.isArray(fields)||fields.length>1000||!Array.isArray(bindings)||bindings.length>1000)return {valid:false,errors:[diagnostic('definition','A bounded definition and binding list are required.')],warnings};
 for(const field of fields)try{checkFieldDefinition(field);}catch(error){errors.push(diagnostic('field_definition',error.message,field?.id));}
 for(const binding of bindings){const field=fields.find(item=>item.id===binding?.fieldId);try{
  if(!field||!safeKey(binding.id)||seen.has(binding.fieldId))fail('Each binding must uniquely reference a real template field.');seen.add(binding.fieldId);
  if(!['direct','repeat','calculated','conditional','narrative','extension','presentation'].includes(binding.type))fail('Unknown binding behavior.');
  if(binding.nullHandling!==undefined&&!['blank','error','preserve'].includes(binding.nullHandling))fail('Unknown null handling behavior.');
  if(binding.version!==undefined&&binding.version!==1)fail('Unsupported transformation version.');
  if(binding.type==='direct'&&(!allowedPath(binding.path)||collections.has(binding.path)))fail('Direct bindings require an existing scalar canonical field.');
  if(binding.type==='repeat'){
   if(!collections.has(binding.path))fail('Repeated tables require an existing canonical collection.');
   if(binding.columns!==undefined){if(!plain(binding.columns)||Object.keys(binding.columns).length>100)fail('Repeated column mappings must be bounded.');for(const [key,column]of Object.entries(binding.columns)){if(!safeKey(key)||!plain(column)||!allowedPath(column.path,binding.path)||collections.has(column.path))fail('Repeated columns require canonical row fields.');checkTransforms(column.transform);checkReference(column.reference);}}
  }
  if(binding.filter)checkFilter(binding.filter,binding.path?.split('.')[0]);
  if(binding.type==='calculated')checkExpression(binding.expression);
  if(binding.type==='conditional'){checkFilter(binding.condition);if(binding.path&&!allowedPath(binding.path))fail('Conditional content requires a canonical path.');if(binding.expression)checkExpression(binding.expression);}
  if(binding.type==='extension'&&(!/^template\.[A-Za-z0-9_-]+\.[A-Za-z0-9_.:-]+$/.test(binding.namespace||'')||definition.id&&binding.namespace.split('.')[1]!==String(definition.id).replace(/[^A-Za-z0-9_-]/g,'_')))fail('Extensions must be namespaced to this template, outside canonical stores.');
  if(binding.extensionProfile&&(!['extension','narrative'].includes(binding.type)||!getTemplateExtensionProfile(binding.extensionProfile)))fail('Specialist profiles require a recognized report-only extension or narrative.');
  checkTransforms(binding.transform);checkReference(binding.reference);
  if(!approved(binding.review))warnings.push(diagnostic('mapping_review','Mapping requires explicit reviewer identity, date and statement.',binding.fieldId));
 }catch(error){errors.push(diagnostic('binding',error.message,binding?.fieldId));}}
 for(const field of fields)if(!seen.has(field.id)&&field.required)errors.push(diagnostic('unmapped_required','Required field has no binding.',field.id));
 return {valid:!errors.length,errors,warnings};
}
function compare(filter,context,row,entity){
 if(filter.op==='and')return filter.args.every(item=>compare(item,context,row,entity));if(filter.op==='or')return filter.args.some(item=>compare(item,context,row,entity));if(filter.op==='not')return !compare(filter.args[0],context,row,entity);
 const actual=entities.has(filter.path.split('.')[0])?readPath(context,filter.path):get(row,filter.path),expected=filter.value;
 switch(filter.op){case'eq':return actual===expected;case'ne':return actual!==expected;case'in':return Array.isArray(actual)?actual.some(value=>expected.includes(value)):expected.includes(actual);case'exists':return !empty(actual);case'gt':return actual>expected;case'gte':return actual>=expected;case'lt':return actual<expected;case'lte':return actual<=expected;default:fail('Invalid filter.');}
}
function readPath(context,path){const [entity,...parts]=path.split('.'),rows=context[entity];if(Array.isArray(rows))return parts.length?rows.map(row=>get(row,parts.join('.'))):rows;return parts.length?get(rows,parts.join('.')):rows;}
function expressionValue(expression,context){
 if(Object.hasOwn(expression,'literal'))return expression.literal;if(!expression.op){const value=readPath(context,expression.path);if(Array.isArray(value)){if(value.length>1)fail('Calculation field is ambiguous across records; choose a cycle or use an aggregate.');return value[0]??null;}return value;}
 if(['count','sum','average','join'].includes(expression.op)){const rows=context[expression.path].filter(row=>!expression.where||compare(expression.where,context,row,expression.path));if(expression.op==='count')return rows.length;if(['sum','average'].includes(expression.op)&&expression.path==='measurements'&&expression.field==='value'&&rows.length){const units=new Set(rows.map(row=>typeof row.unit==='string'?row.unit.trim():''));if(units.size!==1||units.has(''))fail('Measurement aggregation requires one explicit consistent unit basis; filter or convert observations through reviewed canonical operations first.');}const values=rows.map(row=>get(row,expression.field));if(expression.op==='join'){if(values.some(value=>!['string','number','boolean','undefined'].includes(typeof value)&&value!==null))fail('Joined views require scalar canonical values.');const joined=values.filter(value=>!empty(value)).join(expression.separator??'; ');if(joined.length>50000)fail('Joined view exceeds its 50,000 character bound.');return joined;}if(values.some(value=>typeof value!=='number'||!Number.isFinite(value)))fail('Aggregate contains missing or nonnumeric values.');return expression.op==='sum'?values.reduce((sum,value)=>sum+value,0):values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;}
 const args=expression.args.map(value=>expressionValue(value,context));if(expression.op==='coalesce')return args.find(value=>!empty(value))??null;if(expression.op==='concat')return args.map(value=>value??'').join(expression.separator??'');
 if(args.some(value=>typeof value!=='number'||!Number.isFinite(value)))fail('Arithmetic requires finite canonical numbers.');let result;
 switch(expression.op){case'add':result=args.reduce((a,b)=>a+b,0);break;case'multiply':result=args.reduce((a,b)=>a*b,1);break;case'subtract':result=args[0]-args[1];break;case'divide':case'percentage':if(args[1]===0)fail('Calculation denominator is zero.');result=args[0]/args[1]*(expression.op==='percentage'?100:1);break;default:fail('Unknown calculation.');}if(!Number.isFinite(result))fail('Calculation exceeds finite range.');return result;
}
function transformValue(input,transforms){let value=input;for(const transform of transforms===undefined?[]:Array.isArray(transforms)?transforms:[transforms]){
 if(empty(value))continue;
 if(transform.kind==='date'){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)||!Number.isFinite(Date.parse(value)))fail('Date transforms require an unambiguous ISO date.');const date=value.slice(0,10),[y,m,d]=date.split('-');if(new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)fail('Date does not exist.');value=transform.format==='iso'?date:transform.format==='dmy'?`${d}/${m}/${y}`:transform.format==='mdy'?`${m}/${d}/${y}`:`${y}-${m}`;}
 if(transform.kind==='unit'){if(typeof value!=='number'||!Number.isFinite(value))fail('Unit conversion requires a finite number.');value*=transform.from===transform.to?1:unitConversions[`${transform.from}:${transform.to}`];}
 if(transform.kind==='vocabulary'){if(Object.hasOwn(transform.map,String(value)))value=transform.map[String(value)];else if((transform.unmapped||'error')==='error')fail(`Canonical value has no approved vocabulary mapping: ${value}`);}
 if(transform.kind==='join'){if(!Array.isArray(value))fail('Join requires an array.');value=value.join(String(transform.separator??'; ').slice(0,20));}
 if(transform.kind==='number'){if(typeof value!=='number'||!Number.isFinite(value)||!Number.isSafeInteger(transform.decimals??2)||(transform.decimals??2)<0||(transform.decimals??2)>10)fail('Number formatting requires finite numbers and bounded precision.');value=Number(value.toFixed(transform.decimals??2));}
 }return value;}
function contextFor(project,engagement,cycleId){
 const safe=projectMonitoringDisclosure(engagement||{}),context={project:copy(project||{}),engagement:safe,_allFindings:safe.findings||[]};for(const entity of collections)context[entity]=copy(safe[entity]||[]);
 if(cycleId){if(!context.cycles.some(row=>row.id===cycleId))fail('Selected cycle is outside this engagement.');const cycle=context.cycles.find(row=>row.id===cycleId),programId=cycle.programId;
  for(const entity of ['cycles','findings','measurements','missions','events','verifications'])context[entity]=context[entity].filter(row=>entity==='cycles'?row.id===cycleId:row.cycleId===cycleId);
  const findingIds=new Set(context.findings.map(row=>row.id)),obligations=new Set(context.monitoringObligations.filter(row=>!programId||!row.programId||row.programId===programId).map(row=>row.id));
  context.actions=context.actions.filter(row=>row.cycleId===cycleId||!row.cycleId&&(monitoringActionBelongsToProgram(safe,row,programId)||(row.findingIds||[]).some(id=>findingIds.has(id))||(row.monitoringObligationIds||[]).some(id=>obligations.has(id))));
  context.monitoringObligations=context.monitoringObligations.filter(row=>obligations.has(row.id));context.indicators=context.indicators.filter(row=>!programId||!row.programId||row.programId===programId);
 }return context;
}
/** Bounded public record projection for explicit optional local AI context. */
export function projectTemplateCanonicalContext({project={},engagement={},cycleId}={}){
 const context=contextFor(project,engagement,cycleId),result={};
 for(const entity of entities){const source=context[entity],select=row=>Object.fromEntries(fields[entity].split(' ').filter(key=>Object.hasOwn(row||{},key)).map(key=>[key,copy(get(row,key))]));result[entity]=Array.isArray(source)?source.map(select):select(source);}
 return result;
}
function provenanceFor(binding,context,rows){
 const refs=[],add=(entity,record)=>{if(!record?.id||refs.some(ref=>ref.entity===entity&&ref.id===record.id))return;refs.push({entity,id:record.id,...(record.revision?{revision:record.revision}:{}),...(record.sourceSha256?{sourceSha256:record.sourceSha256}:{}),...(record.versionId?{sourceVersionId:record.versionId}:{}),...(record.sourceVersionId?{sourceVersionId:record.sourceVersionId}:{}),...(record.locator?{locator:record.locator}:{})});
 for(const id of [...(record.assertionIds||[]),...(record.closureAssertionIds||[]),...(record.supportingAssertionIds||[]),...(record.contradictoryAssertionIds||[])]){const assertion=context.assertions.find(row=>row.id===id);if(assertion)add('assertions',assertion);}if(entity==='actions')for(const id of record.findingIds||[]){const finding=context._allFindings.find(row=>row.id===id);if(finding)add('findings',finding);}};
 if(binding.path){const entity=binding.path.split('.')[0];for(const row of rows||[context[entity]].flat())add(entity,row);}
 if(binding.expression){const walk=node=>{if(node.path){const entity=node.path.split('.')[0],rows=[context[entity]].flat().filter(row=>!node.where||compare(node.where,context,row,entity));for(const row of rows)add(entity,row);}for(const arg of node.args||[])walk(arg);};walk(binding.expression);}
 return refs;
}
function referenceValue(value,reference,context,provenance){if(!reference||empty(value))return value;const one=id=>{const record=context[reference.entity].find(row=>row.id===id);if(!record)return null;provenance.push(...provenanceFor({path:reference.entity},context,[record]));return get(record,reference.field);};return Array.isArray(value)?value.map(one):one(value);}
function reportInput(values,fieldId){if(Array.isArray(values))return values.find(row=>row.fieldId===fieldId);const value=plain(values)?values[fieldId]:undefined;return plain(value)&&Object.hasOwn(value,'value')?value:{fieldId,value};}
const missingValue=value=>empty(value)||typeof value==='string'&&!value.trim();
const manualRepeated=field=>field.manualNative===true||['docx_manual_repeat_row','xlsx_manual_repeat_range'].includes(field.anchor?.kind);
const nativePresentationColumn=(field,column,reportOnly)=>!reportOnly&&!manualRepeated(field)&&['docx_repeat_row','xlsx_repeat_table'].includes(field.anchor?.kind)&&column.type==='text'&&!column.valueType&&!column.dataType;
function checkFieldDefinition(field,{column=false}={}){
 if(!plain(field))fail('Field definitions and columns must be plain records.');
 if(field.required!==undefined&&typeof field.required!=='boolean'||field.integer!==undefined&&typeof field.integer!=='boolean')fail('Required and integer constraints must be explicit booleans.');
 if((field.minimum!==undefined||field.maximum!==undefined||field.integer===true)&&!['number','integer'].includes(fieldType(field)))fail('Numeric bounds and integer constraints require a numeric field type.');
 if(field.minimum!==undefined&&(typeof field.minimum!=='number'||!Number.isFinite(field.minimum))||field.maximum!==undefined&&(typeof field.maximum!=='number'||!Number.isFinite(field.maximum))||field.minimum!==undefined&&field.maximum!==undefined&&field.minimum>field.maximum)fail('Numeric bounds must be finite and ordered.');
 if(field.unit!==undefined&&(typeof field.unit!=='string'||field.unit.length>500))fail('A source unit must be bounded text.');
 if(field.maxLength!==undefined&&(!Number.isSafeInteger(field.maxLength)||field.maxLength<1||field.maxLength>50000))fail('Text length constraints must be between 1 and 50,000 characters.');
 if(field.allowedValues!==undefined&&(!Array.isArray(field.allowedValues)||field.allowedValues.length>100||field.allowedValues.some(value=>value!==null&&!['string','number','boolean'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value)||typeof value==='string'&&value.length>50000)))fail('Controlled vocabulary values must be bounded finite scalar values.');
 if(column){const type=field.valueType||field.dataType||field.type;if(type!==undefined&&!['text','string','number','integer','date','boolean'].includes(type))fail('Repeated column types must be scalar text, number, integer, date or boolean.');return;}
 if(field.maxRows!==undefined&&(!Number.isSafeInteger(field.maxRows)||field.maxRows<1||field.maxRows>(manualRepeated(field)?500:1000)))fail('Repeated row limits must be positive and within the supported table capacity.');
 if(field.capacity!==undefined&&(!Number.isSafeInteger(field.capacity)||field.capacity<1))fail('Native table capacity must be a positive integer.');
 if(field.columns!==undefined){if(!Array.isArray(field.columns)||field.columns.length>100||manualRepeated(field)&&!field.columns.length)fail('Repeated fields need at most 100 declared columns.');const keys=new Set();for(const item of field.columns){const key=item?.key||item?.id;if(!safeKey(key)||keys.has(key))fail('Repeated column keys must be safe and unique.');keys.add(key);checkFieldDefinition(item,{column:true});}}
}
function safeValue(value,depth=0,budget={nodes:0}){
 if(++budget.nodes>100000||depth>12)fail('A repeated value exceeds its bounded structure limit.');
 if(value===null||value===undefined||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value))fail('Repeated values require finite numbers.');return;}
 if(typeof value==='string'){if(value.length>50000)fail('Field value exceeds its length limit.');return;}
 if(!Array.isArray(value)&&!plain(value))fail('Repeated rows and nested values must be plain portable records.');
 const descriptors=Object.getOwnPropertyDescriptors(value);for(const [key,descriptor]of Object.entries(descriptors)){if(Array.isArray(value)&&key==='length')continue;if(!Object.hasOwn(descriptor,'value')||!safeKey(key))fail('Repeated values cannot contain unsafe keys or accessor properties.');safeValue(descriptor.value,depth+1,budget);}
 if(Object.getOwnPropertySymbols(value).length)fail('Repeated values cannot contain symbol properties.');
}
function checkValue(value,field,{reportOnly=false,column=false,presentation=false}={}){
 if(missingValue(value)){if(field.required)fail('Required report value is missing.');return;}
 const type=fieldType(field);
 if(['number','integer'].includes(type)&&(typeof value!=='number'||!Number.isFinite(value)))fail('Field requires a finite number.');
 if((type==='integer'||field.integer===true)&&!Number.isSafeInteger(value))fail('Field requires a safe integer.');
 if(type==='boolean'&&typeof value!=='boolean')fail('Field requires a boolean.');
 if(type==='date'&&(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))fail('Field requires an ISO date.');
 const explicitText=['text','string'].includes(field.valueType||field.dataType||field.type);
 if(explicitText&&(reportOnly||column||manualRepeated(field))&&!presentation&&typeof value!=='string')fail('Field requires scalar text.');
 if(typeof value==='number'&&(field.minimum!==undefined&&value<field.minimum||field.maximum!==undefined&&value>field.maximum))fail('Value is outside the template numeric bounds.');
 if(field.allowedValues&&!field.allowedValues.includes(value))fail('Value is outside the template controlled vocabulary.');
 if(typeof value==='string'&&value.length>(field.maxLength||50000))fail('Field value exceeds its length limit.');
 if(type==='array'){
  if(!Array.isArray(value))fail('Field requires repeated rows.');
  const columns=field.columns||[],typedKeys=new Set(columns.map(item=>item.key||item.id)),manual=manualRepeated(field),boundedCapture=reportOnly||manual,limits=[boundedCapture?500:1000,field.maxRows??1000];
  if(boundedCapture){if(field.capacity!==undefined)limits.push(field.capacity);if(columns.length)limits.push(Math.floor(2000/columns.length));const anchor=field.anchor||{};if(anchor.kind==='xlsx_manual_repeat_range'&&Number.isSafeInteger(anchor.startRow)&&Number.isSafeInteger(anchor.endRow))limits.push(anchor.endRow-anchor.startRow+1);}
  const maximum=Math.min(...limits);if(value.length>maximum)fail(`Repeated field exceeds its ${maximum} row capacity.`);
  safeValue(value);for(const [i,row]of value.entries()){
   if(!plain(row)||Object.keys(row).length>100)fail(`Repeated row ${i+1} must be a plain record with at most 100 columns.`);
   if(columns.length&&(reportOnly||manual)&&Object.keys(row).some(key=>!typedKeys.has(key)))fail(`Repeated row ${i+1} has a column outside the declared report fields.`);
   for(const item of columns){const key=item.key||item.id;if(manual&&!Object.hasOwn(row,key))fail(`Repeated row ${i+1} must retain every declared source column, using null for an absent optional value.`);try{checkValue(row[key],item,{reportOnly,column:true,presentation:nativePresentationColumn(field,item,reportOnly)});}catch(error){fail(`Repeated row ${i+1}, column ${key}: ${error.message}`);}}
  }
 }
}
/** Shared direct-command and resolver validation. This checks data types and
 * declared source constraints; substantive review and canonical writes remain
 * the owning Studio/engagement workflow's responsibility. */
export function validateTemplateFieldValue({field,value,reportOnly=true}={}){
 try{checkFieldDefinition(field);if(Array.isArray(value))safeValue(value);checkValue(value,field,{reportOnly});return {valid:true,errors:[]};}catch(error){return {valid:false,errors:[diagnostic('field_value',error.message,field?.id)]};}
}

export function resolveTemplateReport({definition,project={},engagement={},cycleId,values={},accountId}={}){
 const checked=validateTemplateBindings({definition}),errors=[...checked.errors],warnings=[...checked.warnings],resolved=[],byFieldId=Object.create(null);
 if(accountId&&(((project.storageAccount?.id||project.accountId)&&(project.storageAccount?.id||project.accountId)!==accountId)||(engagement.accountId&&engagement.accountId!==accountId)||(definition?.accountId&&definition.accountId!==accountId)))fail('Template and canonical records must belong to the selected account.');
 if(engagement.projectId&&project.id&&engagement.projectId!==project.id)fail('Engagement belongs to a different project.');
 const context=contextFor(project,engagement,cycleId);
 for(const field of definition?.fields||[]){const binding=definition.bindings?.find(row=>row.fieldId===field.id),diagnostics=[];let value,provenance=[],visibility=true,authorship='canonical';
  try{
   if(!binding){if(field.required)fail('Required field is unmapped.');}
   else if(!approved(binding.review))fail('Mapping must be explicitly approved before population.');
   else if(checked.errors.some(error=>error.fieldId===field.id))fail('Mapping is invalid.');
   else{
    if(binding.type==='conditional')visibility=compare(binding.condition,context);
    if(visibility){
     if(['direct','conditional'].includes(binding.type)&&binding.path){const entity=binding.path.split('.')[0],selectedContext=binding.filter&&collections.has(entity)?{...context,[entity]:context[entity].filter(row=>compare(binding.filter,context,row,entity))}:context;value=readPath(selectedContext,binding.path);provenance=provenanceFor(binding,selectedContext);if(collections.has(entity)&&Array.isArray(value)){if(value.length>1)fail('Direct mapping is ambiguous across multiple records; select a cycle or use a repeated field.');value=value[0];}}
     if(binding.type==='repeat'){const rows=context[binding.path].filter(row=>!binding.filter||compare(binding.filter,context,row,binding.path));if(rows.length>1000)fail('Repeated output exceeds 1,000 records.');value=rows.map(row=>Object.keys(binding.columns||{}).length?Object.fromEntries(Object.entries(binding.columns).map(([key,column])=>[key,transformValue(referenceValue(get(row,column.path),column.reference,context,provenance),column.transform)])):Object.fromEntries(fields[binding.path].split(' ').filter(key=>Object.hasOwn(row,key)).map(key=>[key,copy(row[key])])));provenance.push(...provenanceFor(binding,context,rows));}
     if(binding.type==='calculated'||binding.type==='conditional'&&binding.expression)value=expressionValue(binding.expression,context);
     if(['narrative','extension'].includes(binding.type)){
      const input=reportInput(values,field.id),typed=validateTemplateFieldValue({field,value:input.value,reportOnly:true});if(!typed.valid)fail(typed.errors.map(row=>row.message).join(' '));value=copy(input.value);authorship=input.authorship||'human';if(!['human','ai'].includes(authorship))fail('Report authorship must distinguish human and AI content.');if(!empty(value)){
       if(typeof input.authorId!=='string'||!input.authorId.trim())fail('Report-specific content requires identifiable authorship.');
       if(input.authorship==='ai'&&(!approved(input.review)||!Array.isArray(input.citations)||!input.citations.length))fail('AI narratives require explicit human review and supporting canonical citations.');
       for(const citation of input.citations||[]){if(!entities.has(citation.entity)||!safeKey(citation.id))fail('Citation is not a canonical record reference.');const record=[context[citation.entity]].flat().find(row=>row?.id===citation.id);if(!record)fail('Citation is outside the authorized report context.');provenance.push(...provenanceFor({path:citation.entity},context,[record]));}
       if(binding.extensionProfile){const specialist=validateSpecialistTemplateValue({profileId:binding.extensionProfile,input,hasCanonicalCitations:provenance.length>0});if(!specialist.valid)fail(specialist.errors.join(' '));}
       provenance.push({kind:'report_value',authorId:input.authorId,authorship,...(input.review?{review:copy(input.review)}:{}),...(binding.namespace?{namespace:binding.namespace}:{}),...(binding.extensionProfile?{extensionProfile:binding.extensionProfile,profileVersion:1}:{})});
      }
     }
     if(!provenance.length)provenance=provenanceFor(binding,context);
     value=referenceValue(value,binding.reference,context,provenance);value=transformValue(value,binding.transform);if(empty(value)&&binding.nullHandling==='error')fail('This mapping requires a nonempty canonical source value.');if(empty(value)&&binding.nullHandling==='blank')value='';checkValue(value,field);if(field.required&&empty(value))fail('Required report value is missing.');
    }
   }
  }catch(error){diagnostics.push(diagnostic('population',error.message,field.id));errors.push(...diagnostics);value=undefined;}
  const row={fieldId:field.id,anchor:copy(field.anchor),value:value??null,missing:visibility&&empty(value),visible:visibility,authorship,provenance,diagnostics};resolved.push(row);byFieldId[field.id]=row.value;
 }
 return {format:'esia-client-template-resolution',schemaVersion:1,values:resolved,byFieldId,validation:{valid:!errors.length,errors,warnings},snapshot:{templateId:definition?.id,templateVersion:definition?.version,sourceSha256:definition?.source?.sha256,projectId:project.id,projectRevision:project.revision,engagementId:engagement.id,contentRevision:engagement.contentRevision,cycleId:cycleId||null,transformationVersion:templateBindingVersion}};
}
export function reviewTemplateBinding({definition,bindingId,reviewerId,statement,status='approved',reviewedAt}={}){
 if(!['approved','rejected','proposed'].includes(status)||typeof reviewerId!=='string'||!reviewerId.trim()||typeof statement!=='string'||!statement.trim()||!Number.isFinite(Date.parse(reviewedAt)))fail('A mapping review requires explicit identity, date and statement.');
 const next=copy(definition),binding=next.bindings?.find(row=>row.id===bindingId);if(!binding)fail('Mapping review references an unknown binding.');binding.review={status,reviewerId,statement,reviewedAt};return next;
}
/** Private learning retains typed canonical signatures, never source files,
 * labels, narratives, quotations, literal filters or client vocabulary. */
export function learnApprovedTemplateMappings({definition,accountId,learnedAt}={}){
 if(!accountId||definition.accountId&&definition.accountId!==accountId||!Number.isFinite(Date.parse(learnedAt)))fail('Learning requires an explicit account and timestamp.');
 if(!validateTemplateBindings({definition}).valid)fail('Only valid canonical mappings can contribute learning.');
 return (definition.bindings||[]).filter(binding=>approved(binding.review)&&['direct','repeat'].includes(binding.type)&&allowedPath(binding.path)).map(binding=>({schemaVersion:1,accountId,signature:signature(definition.fields.find(field=>field.id===binding.fieldId)),fieldType:fieldType(definition.fields.find(field=>field.id===binding.fieldId)),type:binding.type,path:binding.path,review:{status:'approved'},learnedAt}));
}
export function measureTemplateLearning(events=[]){
 if(!Array.isArray(events)||events.length>10000)fail('Learning metrics require a bounded real event list.');
 const setup=events.filter(event=>event.kind==='template_setup'&&Number.isFinite(event.startedAt)&&Number.isFinite(event.completedAt)&&event.completedAt>=event.startedAt),reviews=events.filter(event=>event.kind==='mapping_review'&&typeof event.acceptedWithoutCorrection==='boolean'),outputs=events.filter(event=>event.kind==='output_comparison'&&typeof event.consistent==='boolean');
 const times=setup.map(event=>event.completedAt-event.startedAt);
 return {method:'observed_events_only',setupSamples:times.length,meanSetupMilliseconds:times.length?times.reduce((a,b)=>a+b,0)/times.length:null,mappingReviewSamples:reviews.length,acceptedWithoutCorrection:reviews.filter(event=>event.acceptedWithoutCorrection).length,acceptanceRate:reviews.length?reviews.filter(event=>event.acceptedWithoutCorrection).length/reviews.length:null,outputComparisonSamples:outputs.length,consistentOutputs:outputs.filter(event=>event.consistent).length,outputConsistencyRate:outputs.length?outputs.filter(event=>event.consistent).length/outputs.length:null,estimatedTimeSavings:null};
}
