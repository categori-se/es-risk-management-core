// Exact-edition policy review. Technical checks and proposed definitions never
// confer professional approval or a project compliance finding.
import {createHash, randomUUID} from 'node:crypto';
import {readFileSync, writeFileSync, renameSync, mkdirSync, lstatSync} from 'node:fs';
import {join} from 'node:path';
import {getFramework, prepareDetailedRequirementPack} from '../src/lib/framework-register.js';
import {inspectPolicyStandardCoverage,IFC_PS5_COVERAGE_SCOPE} from './policy-standard-coverage.mjs';

export const policyReviewVersion = 'esia-policy-review-1';
export const policyReviewLimits = Object.freeze({packBytes:64*1024*1024, ledgerBytes:32*1024*1024, criteria:30000, history:60000});
const hash = value => createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const fail = (message,status=400) => {throw Object.assign(Error(message),{status});};
const object = value => value && typeof value==='object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const text = (value,label,max=8000) => {if(typeof value!=='string'||!value.trim()||value.length>max)fail(`Provide ${label} (at most ${max} characters).`);return value.trim();};
const exactKeys = (value,allowed) => {if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('Unexpected policy review fields.');};
const classifications = ['obligation','definition','guidance','context','heading','footnote','duplicate','exclude'];
const actors = ['borrower','institution','intermediary','third_party','multiple','not_applicable','unresolved'];
const rowsOf = pack => pack.records || [];
const scopedAuthorityMatches=(authority,actor,roleId)=>{
  const assignment=authority?.definition?.assignments?.find(row=>row.userId===actor.id);
  return Boolean(authority?.complete&&roleId&&assignment?.name===actor.name&&assignment.roleIds?.includes(roleId)&&authority.approvals?.some(receipt=>receipt.actorId===actor.id&&receipt.roleId===roleId));
};

function unique(values) {return [...new Set(values)];}
function verifyRow(row,source) {
  const d=row.detail||{}, c=d.context||{}, errors=[];
  if(!source||source.sha256!==d.sourceSha256)errors.push('source_identity_mismatch');
  if(!d.sourceText?.trim()||!c.parentText?.trim())errors.push('source_or_parent_missing');
  if(!Array.isArray(d.pages)||!d.pages.length||d.pages.some(page=>!Number.isInteger(page)||page<1||page>source?.pageCount))errors.push('page_outside_original');
  const start=d.sourceOffsets?.start,end=d.sourceOffsets?.end;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||Array.from(c.parentText||'').slice(start,end).join('')!==d.sourceText)errors.push('parent_span_mismatch');
  if(d.layout?.some(item=>!d.pages?.includes(item.page)||!Array.isArray(item.bbox)||item.bbox.length!==4||item.bbox.some(v=>!Number.isFinite(v))))errors.push('invalid_layout_anchor');
  return errors;
}

/** Full deterministic accounting, including non-candidate text. No source is
 * fetched and no sentence is silently removed or labelled a reviewed duty. */
export function inspectPolicyPack(pack,{packSha256,sources=[]}={}) {
  const prepared=prepareDetailedRequirementPack(pack), bySource=new Map((pack.coverage?.sources||pack.sources).map(source=>[source.id,source]));
  const sourceResults=pack.sources.map(source=>{
    const declaration=bySource.get(source.id),verified=sources.find(item=>item.sha256===source.sha256);
    const included=unique(declaration?.includedPages||[]),pageCount=declaration?.pageCount||0;
    return {id:source.id,sha256:source.sha256,title:source.title,url:source.url,pageCount,includedPages:included.length,
      pageCoverageVerified:Boolean(pageCount&&included.length===pageCount&&Array.from({length:pageCount},(_,index)=>index+1).every(page=>included.includes(page))),
      bytesVerified:verified?.verified===true,size:verified?.size||null,errors:[...(declaration?.errors||[]),...(verified?.error?[verified.error]:[])],
      provenance:declaration?.provenance||null,warnings:declaration?.warnings||[]};
  });
  const rowChecks=prepared.records.map(row=>({id:row.id,errors:verifyRow(row,bySource.get(row.detail.sourceId))}));
  const errors=rowChecks.filter(item=>item.errors.length);
  const issues={footnoteAssociation:0,actorAmbiguity:0,qualifiers:0,lists:0,sourceFontControls:0};
  for(const row of prepared.records){
    const d=row.detail,c=d.context;
    if(c.footnotes?.length||d.footnoteReferences?.length)issues.footnoteAssociation++;
    if(['unspecified','unresolved'].includes(d.actor)||!d.actor||d.actorBasis!=='explicit_actor_candidate')issues.actorAmbiguity++;
    if(/\b(?:unless|except|where|provided|subject to|if|when|including|excluding)\b/i.test(c.parentText))issues.qualifiers++;
    if(c.listItems?.length)issues.lists++;
    if(/[\u2400-\u2426]/u.test(c.parentText))issues.sourceFontControls++;
  }
  return {format:'esia-policy-technical-review',schemaVersion:1,reviewVersion:policyReviewVersion,frameworkId:pack.frameworkId,edition:pack.edition,
    parserVersion:pack.parserVersion,packSha256,method:'Deterministic inspection of every source statement, retained parent span, source identity, page and layout anchor; SHA256 verification of installed originals.',
    sourceResults,counts:{sourceStatements:prepared.records.length,normativeCandidates:prepared.records.filter(row=>row.detail.classification==='normative_candidate').length,
      checkedStatementAnchors:rowChecks.length,validStatementAnchors:rowChecks.length-errors.length,invalidStatementAnchors:errors.length,preparedDiagnosticGroups:prepared.diagnostics.length},
    checks:{sourceBytesVerified:sourceResults.every(source=>source.bytesVerified),allDeclaredPagesIncluded:sourceResults.every(source=>source.pageCoverageVerified),
      statementAnchorsVerified:errors.length===0,missingSources:(pack.coverage?.missingSources||[]).length===0},
    sourceIssues:errors,reviewAttention:issues,excludedDocuments:pack.coverage?.excludedDocuments||[],scopeWarnings:pack.coverage?.scopeWarnings||[],
    professionalApproval:false,completeObligationCoverage:false};
}

/** One proposal per exact source parent, with all sentence IDs retained. This
 * avoids approving a sentence without its list, qualifications or context. */
export function proposePolicyCriteria(pack) {
  const groups=new Map();
  for(const row of rowsOf(pack)){
    const d=row.detail,c=d.context||{},key=[d.sourceSha256,row.standard,c.parentId||row.id].join('\0');
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }
  return [...groups.values()].map(members=>{
    const first=members[0],d=first.detail,c=d.context,memberIds=members.map(row=>row.id),candidate=members.some(row=>row.detail.classification==='normative_candidate');
    const hints=unique(members.map(row=>row.detail.actor));
    const attention=[];
    if(hints.length!==1||hints.includes('unspecified')||members.some(row=>row.detail.actorBasis!=='explicit_actor_candidate'))attention.push('responsible_actor_requires_review');
    if(c.footnotes?.length||members.some(row=>row.detail.footnoteReferences?.length))attention.push('verify_original_footnote_association');
    if(c.listItems?.length)attention.push('verify_complete_list_and_reading_order');
    if(/\b(?:unless|except|provided|subject to|if|when|where)\b/i.test(c.parentText))attention.push('review_scope_conditions_and_exceptions');
    if(/[\u2400-\u2426]/u.test(c.parentText))attention.push('verify_source_font_controls_against_original');
    return {id:`criterion:${hash([pack.frameworkId,pack.edition,pack.parserVersion,keyOf(first),memberIds,c.parentText]).slice(0,40)}`,
      frameworkId:pack.frameworkId,edition:pack.edition,sourceId:d.sourceId,sourceSha256:d.sourceSha256,standard:first.standard,topic:first.topic,
      paragraph:d.paragraph,memberIds,pages:unique(members.flatMap(row=>row.detail.pages||[row.detail.page])).sort((a,b)=>a-b),
      sourceText:c.parentText,sourceTextSha256:hash(c.parentText),context:{section:c.section,listItems:c.listItems||[],footnotes:c.footnotes||[],previousText:c.previousText,nextText:c.nextText},
      proposal:{classification:candidate?'obligation':unique(members.map(row=>row.detail.classification)).length===1?d.classification:'context',actor:hints.length===1&&actors.includes(hints[0])?hints[0]:'unresolved',
        duty:c.parentText,
        conditions:'Check source paragraph, list lead-in, cross-references and associated notes.',exceptions:'Verify every exception against the original; absence of an extracted note does not establish absence of exceptions.',
        verification:first.evidence.join('; '),method:'deterministic_source_context_proposal',status:'proposed',attention},
      origin:{kind:'automated',model:null,method:policyReviewVersion,semanticApproval:false},review:null};
  });
}
function keyOf(row){return [row.detail.sourceSha256,row.standard,row.detail.context?.parentId||row.id];}

export function policyCoverageSummary({pack,criteria,ledger,technical}) {
  const reviews=ledger?.reviews||{},reviewed=criteria.filter(item=>reviews[item.id]?.status==='approved'),rejected=criteria.filter(item=>reviews[item.id]?.status==='needs_correction');
  const covered=new Set(reviewed.flatMap(item=>item.memberIds)),pages=new Set(Object.keys(ledger?.pages||{})),allPages=pack.sources.flatMap(source=>{
    const declaration=pack.coverage.sources.find(item=>item.id===source.id);return Array.from({length:declaration?.pageCount||0},(_,i)=>`${source.sha256}:${i+1}`);
  });
  const complete=Boolean(ledger?.signoff&&reviewed.length===criteria.length&&allPages.length&&allPages.every(page=>pages.has(page))&&technical&&Object.values(technical.checks).every(Boolean)&&!technical.excludedDocuments.length);
  return {frameworkId:pack.frameworkId,edition:pack.edition,packSha256:ledger?.packSha256||technical?.packSha256,
    sourceStatements:pack.records.length,proposedCriteria:criteria.length,proposedObligationCriteria:criteria.filter(item=>item.proposal.classification==='obligation').length,
    reviewedCriteria:reviewed.length,reviewedStatements:covered.size,unresolvedCriteria:criteria.length-reviewed.length,needsCorrection:rejected.length,
    originalPages:allPages.length,reviewedOriginalPages:allPages.filter(page=>pages.has(page)).length,professionalSignoff:ledger?.signoff||null,
    technicalChecksPassed:Boolean(technical&&Object.values(technical.checks).every(Boolean)),completeObligationCoverage:complete,
    reviewStatus:complete?'professionally_reviewed':reviewed.length?'in_review':'proposals_prepared',
    blockers:[...(!technical||!Object.values(technical.checks).every(Boolean)?['Resolve technical source integrity or page coverage errors.']:[]),
      ...(reviewed.length<criteria.length?[`Review ${criteria.length-reviewed.length} complete source paragraphs, including context and non-candidate material.`]:[]),
      ...(allPages.some(page=>!pages.has(page))?['Verify every original page for missed paragraphs, tables, reading order and note associations.']:[]),
      ...(technical?.excludedDocuments?.length?['Resolve the explicitly excluded documents; this corpus cannot certify the full policy family.']:[]),
      ...(!ledger?.signoff?['Record an independent qualified professional signoff for this exact edition and source pack.']:[])],
    projectApplicability:'Each project must separately establish its financing instrument, applicable edition, national law, permits, contracts and incorporated standards.'};
}

export function newPolicyCoverageLedger({pack,packSha256,accountId}) {
  if(!/^[a-f0-9]{64}$/.test(packSha256)||typeof accountId!=='string'||!accountId)fail('Pin the account and exact source pack SHA256.');
  return {format:'esia-policy-coverage-ledger',schemaVersion:1,reviewVersion:policyReviewVersion,frameworkId:pack.frameworkId,edition:pack.edition,
    accountId,packSha256,revision:1,reviews:{},pages:{},signoff:null,history:[]};
}

export function applyPolicyCoverageCommand({ledger,pack,packSha256,criteria,technical,input,authorizeSignoff,currentPermissions,now=new Date().toISOString()}) {
  exactKeys(input,['expectedRevision','actor','command']);
  if(input.expectedRevision!==ledger.revision)fail('The policy review changed; reload its current revision.',409);
  if(ledger.packSha256!==packSha256||ledger.frameworkId!==pack.frameworkId||ledger.edition!==pack.edition)fail('This review belongs to a different exact source pack; start a separate review.',409);
  exactKeys(input.actor,['id','name','kind','qualification','roleId','policyId','policyRevision']);
  const actor={id:text(input.actor.id,'reviewer identity',192),name:text(input.actor.name,'reviewer name',200),kind:input.actor.kind};
  if(!['human','qualified_professional'].includes(actor.kind))fail('Automated proposals cannot be signed as human policy review.');
  if(actor.kind==='qualified_professional')actor.qualification=text(input.actor.qualification,'professional qualification and scope',2000);
  for(const key of ['roleId','policyId','policyRevision'])if(input.actor[key]!==undefined)actor[key]=input.actor[key];
  const result=structuredClone(ledger),command=input.command;
  if(!object(command))fail('Choose a policy review command.');
  if(command.type==='review-criterion'){
    exactKeys(command,['type','criterionId','status','classification','actor','duty','conditions','exceptions','verification','rationale','originalVisualReviewed']);
    const criterion=criteria.find(item=>item.id===command.criterionId);if(!criterion)fail('Choose a criterion from this exact edition and pack.',404);
    if(!['approved','needs_correction'].includes(command.status))fail('Approve the reviewed definition or request correction.');
    if(!classifications.includes(command.classification)||!actors.includes(command.actor))fail('Choose a reviewed classification and responsible actor.');
    if(command.status==='approved'&&command.classification==='obligation'&&['unresolved','not_applicable'].includes(command.actor))fail('Resolve the actor before approving an obligation.');
    if(command.originalVisualReviewed!==true)fail('Inspect the exact original page, including tables and note associations, before saving a definition review.');
    const decision={status:command.status,classification:command.classification,actor:command.actor,duty:text(command.duty,'reviewed duty or contextual meaning'),
      conditions:text(command.conditions,'reviewed conditions (or explicit none identified)'),exceptions:text(command.exceptions,'reviewed exceptions (or explicit none identified)'),
      verification:text(command.verification,'verification evidence'),rationale:text(command.rationale,'review rationale'),originalVisualReviewed:true,
      sourceTextSha256:criterion.sourceTextSha256,sourceSha256:criterion.sourceSha256,memberIds:[...criterion.memberIds],reviewer:actor,reviewedAt:now};
    result.reviews[criterion.id]=decision;result.signoff=null;
  }else if(command.type==='review-page'){
    exactKeys(command,['type','sourceSha256','page','rationale','noMissingContent']);
    const source=pack.coverage.sources.find(item=>item.sha256===command.sourceSha256);
    if(!source||!Number.isSafeInteger(command.page)||command.page<1||command.page>source.pageCount)fail('Choose a page from the exact retained original.');
    if(command.noMissingContent!==true)fail('Record any omitted content as a correction before confirming page coverage.');
    result.pages[`${source.sha256}:${command.page}`]={sourceSha256:source.sha256,page:command.page,rationale:text(command.rationale,'page coverage rationale'),reviewer:actor,reviewedAt:now};result.signoff=null;
  }else if(command.type==='signoff-standard'){
    exactKeys(command,['type','standard','statement','crossReferenceStatement','crossReferencesReviewed','incorporatedDocumentsReviewed','policyId','policyRevision','roleId','stageId','stageApprovals']);
    if(pack.frameworkId!==IFC_PS5_COVERAGE_SCOPE.frameworkId||command.standard!==IFC_PS5_COVERAGE_SCOPE.standard)fail('Choose the declared full IFC2012 PS5 source-review scope.');
    const coverage=inspectPolicyStandardCoverage({pack,packSha256,criteria,ledger,technical,currentPermissions});
    if(!coverage.readyForProfessionalSignoff)fail(`Complete this exact standard's source, paragraph, note, page and permission gates first: ${coverage.blockers.join(', ')}.`,409);
    if(actor.kind!=='qualified_professional')fail('Full-standard source review needs an independent qualified professional with a stated scope.');
    const reviewActors=[...coverage.parents.map(row=>ledger.reviews[row.criterionId]?.reviewer?.id),...coverage.pages.map(row=>ledger.pages[`${row.sourceSha256}:${row.page}`]?.reviewer?.id)];
    if(reviewActors.includes(actor.id))fail('The final standard reviewer must be independent of its definition and page reviewers.',409);
    if(command.crossReferencesReviewed!==true||command.incorporatedDocumentsReviewed!==true)fail('Examine all source notes, cross-references, incorporated documents and their explicit scope before full-standard signoff.');
    let configuredSignoff;
    if(authorizeSignoff){configuredSignoff=authorizeSignoff({actor,frameworkId:pack.frameworkId,standard:command.standard,policyId:command.policyId,policyRevision:command.policyRevision,roleId:command.roleId,stageId:command.stageId,subjectId:coverage.subject.id,subjectSha256:coverage.subject.sha256,stageApprovals:command.stageApprovals,authorId:'source-analysis'});if(!scopedAuthorityMatches(configuredSignoff,actor,command.roleId))fail('The independent final reviewer needs its current named assignment, role and exact-scope receipt in every configured signoff stage.',409);}
    result.standardSignoffs||={};result.standardSignoffs[command.standard]={standard:command.standard,subject:coverage.subject,packSha256,sourceSha256s:[IFC_PS5_COVERAGE_SCOPE.sourceSha256],reviewer:actor,reviewedAt:now,statement:text(command.statement,'standard review scope and signoff statement'),crossReferenceStatement:text(command.crossReferenceStatement,'source-note and cross-reference dispositions, including separately reviewed or excluded applicability'),crossReferencesReviewed:true,incorporatedDocumentsReviewed:true,...(configuredSignoff?{configuredSignoff,authorization:{policyId:command.policyId,policyRevision:command.policyRevision,roleId:command.roleId,stageId:command.stageId,stageApprovals:structuredClone(command.stageApprovals)}}:{})};
  }else if(command.type==='signoff'){
    exactKeys(command,['type','statement','incorporatedDocumentsReviewed','policyId','policyRevision','roleId','stageId','stageApprovals','authorId']);
    if(actor.kind!=='qualified_professional')fail('Complete edition review needs a qualified professional with a stated scope.');
    const summary=policyCoverageSummary({pack,criteria,ledger,technical});
    if(pack.frameworkId===IFC_PS5_COVERAGE_SCOPE.frameworkId&&!inspectPolicyStandardCoverage({pack,packSha256,criteria,ledger,technical,currentPermissions}).checks.currentSourcePermissions)fail('Current exact IFC source storage, derivation and excerpt permissions are required; a retained legacy edition review supplies no source permission.',409);
    if(summary.unresolvedCriteria||summary.reviewedOriginalPages!==summary.originalPages||!summary.technicalChecksPassed||technical.excludedDocuments.length)fail('Resolve every definition, original page, source-integrity error and excluded document before complete signoff.',409);
    let configuredSignoff;
    if(authorizeSignoff){
      configuredSignoff=authorizeSignoff({actor,policyId:command.policyId,policyRevision:command.policyRevision,roleId:command.roleId,stageId:command.stageId,
        subjectId:pack.frameworkId,subjectSha256:packSha256,stageApprovals:command.stageApprovals,authorId:'source-analysis'});
      if(!configuredSignoff?.complete)fail('Complete the configured review responsibility stages for this exact source pack.',409);
      if(!configuredSignoff.approvals?.some(receipt=>receipt.actorId===actor.id))fail('The identified final reviewer must have a retained signoff in the configured review chain.',403);
    }else if(Object.values(ledger.reviews).some(review=>review.reviewer.id===actor.id)||Object.values(ledger.pages).some(review=>review.reviewer.id===actor.id))fail('The final professional signoff must be independent of the definition and page reviewer.',409);
    if(command.incorporatedDocumentsReviewed!==true)fail('Confirm the applicable incorporated documents and their explicit scope.');
    result.signoff={reviewer:actor,statement:text(command.statement,'edition signoff statement'),reviewedAt:now,packSha256,sourceSha256s:pack.sources.map(source=>source.sha256),...(configuredSignoff?{configuredSignoff:structuredClone(configuredSignoff)}:{})};
  }else fail('Unsupported policy review command.');
  if(result.history.length>=policyReviewLimits.history)fail('This bounded review ledger is full; export it and start a new explicit review revision.',413);
  result.revision++;result.history.push({id:randomUUID(),at:now,actor,command:structuredClone(command),revision:result.revision});return result;
}

function readRegular(path,max) {const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>max)fail('Policy review data must be bounded unlinked regular files.',409);return readFileSync(path);}
export function createPolicyCoverageReviewStore({directory,policyDirectory,accountId,authorizeSignoff}) {
  const output=join(directory,'policy-reviews');mkdirSync(output,{recursive:true,mode:0o700});
  const load=frameworkId=>{
    const framework=getFramework(frameworkId);if(!framework)fail('Choose a known framework edition.',404);
    let bytes;try{bytes=readRegular(join(policyDirectory,`${frameworkId}.json`),policyReviewLimits.packBytes);}catch(error){if(error.code==='ENOENT')fail('This exact edition has no installed policy source pack.',404);throw error;}
    const pack=JSON.parse(bytes.toString('utf8')),packSha256=hash(bytes);prepareDetailedRequirementPack(pack);
    const sourceChecks=pack.sources.map(source=>{try{const original=readRegular(join(policyDirectory,'sources',`${source.sha256}.pdf`),policyReviewLimits.packBytes);return{sha256:source.sha256,verified:hash(original)===source.sha256&&original.subarray(0,5).toString()==='%PDF-',size:original.length};}catch(error){return{sha256:source.sha256,verified:false,error:error.message};}});
    const technical=inspectPolicyPack(pack,{packSha256,sources:sourceChecks}),criteria=proposePolicyCriteria(pack);
    const path=join(output,`${frameworkId}-${packSha256}.json`);let ledger;
    try{ledger=JSON.parse(readRegular(path,policyReviewLimits.ledgerBytes).toString('utf8'));}catch(error){if(error.code!=='ENOENT')throw error;ledger=newPolicyCoverageLedger({pack,packSha256,accountId});}
    if(ledger.accountId!==accountId||ledger.packSha256!==packSha256||ledger.frameworkId!==pack.frameworkId||ledger.edition!==pack.edition||!object(ledger.reviews)||!object(ledger.pages)||!Array.isArray(ledger.history))fail('Policy review ledger scope or provenance is invalid.',409);
    return {pack,packSha256,technical,criteria,ledger,path};
  };
  const standardCoverage=(entry,currentPermissions)=>{
    if(entry.pack.frameworkId!==IFC_PS5_COVERAGE_SCOPE.frameworkId)return null;
    const receipt=entry.ledger.standardSignoffs?.PS5;let signoffAuthorityCurrent=!authorizeSignoff;
    if(receipt&&authorizeSignoff)try{const current=authorizeSignoff({actor:receipt.reviewer,frameworkId:entry.pack.frameworkId,standard:'PS5',...receipt.authorization,subjectId:receipt.subject.id,subjectSha256:receipt.subject.sha256,authorId:'source-analysis'});signoffAuthorityCurrent=scopedAuthorityMatches(current,receipt.reviewer,receipt.authorization?.roleId);}catch{signoffAuthorityCurrent=false;}
    return inspectPolicyStandardCoverage({...entry,currentPermissions,signoffAuthorityCurrent});
  };
  const summary=(entry,scoped)=>{
    const result=policyCoverageSummary(entry);if(!scoped)return result;
    result.editionReviewRecordedComplete=result.completeObligationCoverage;result.scopedStandardAcceptanceCurrent=scoped.accepted;
    if(!scoped.accepted){result.completeObligationCoverage=false;if(result.editionReviewRecordedComplete)result.reviewStatus='awaiting_current_scoped_standard_acceptance';result.blockers.push('The separate full PS5 source scope needs current permissions and independent exact-scope professional acceptance.');}
    return result;
  };
  return Object.freeze({
    inspect(frameworkId,{offset=0,limit=30,standard='',currentPermissions}={}){const entry=load(frameworkId);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>100)fail('Choose a bounded criterion page.');const availableStandards=unique(entry.criteria.map(row=>row.standard));if(standard&&!availableStandards.includes(standard))fail('Choose a standard present in this exact source pack.');const selected=standard?entry.criteria.filter(row=>row.standard===standard):entry.criteria,scoped=standardCoverage(entry,currentPermissions);return{frameworkId,institutionId:getFramework(frameworkId).institutionId,revision:entry.ledger.revision,summary:summary(entry,scoped),standardCoverage:scoped,technical:entry.technical,offset,total:selected.length,availableStandards,selectedStandard:standard,
      criteria:selected.slice(offset,offset+limit).map(item=>({...item,review:entry.ledger.reviews[item.id]||null})),pages:entry.ledger.pages};},
    packet(frameworkId,{currentPermissions}={}){const entry=load(frameworkId),scoped=standardCoverage(entry,currentPermissions);return{format:'esia-policy-review-packet',schemaVersion:1,accountId,frameworkId,institutionId:getFramework(frameworkId).institutionId,edition:entry.pack.edition,packSha256:entry.packSha256,
      technical:entry.technical,summary:summary(entry,scoped),standardCoverage:scoped,criteria:entry.criteria.map(item=>({...item,review:entry.ledger.reviews[item.id]||null})),ledger:entry.ledger,
      instructions:'All definitions are proposals until an identified human checks original pages, conditions, exceptions and verification evidence. Technical checks are automated. Final professional signoff requires an independent qualified reviewer; this packet does not determine project compliance.'};},
    command(frameworkId,input,{currentPermissions}={}){const entry=load(frameworkId),ledger=applyPolicyCoverageCommand({...entry,input,authorizeSignoff,currentPermissions});const bytes=Buffer.from(JSON.stringify(ledger,null,2)+'\n');if(bytes.length>policyReviewLimits.ledgerBytes)fail('The policy review exceeds its bounded storage size.',413);
      const temporary=`${entry.path}.${randomUUID()}.tmp`;writeFileSync(temporary,bytes,{mode:0o600,flag:'wx'});renameSync(temporary,entry.path);const updated={...entry,ledger},scoped=standardCoverage(updated,currentPermissions);return{revision:ledger.revision,summary:summary(updated,scoped),standardCoverage:scoped};},
    close(){}
  });
}
