// Trusted foreground repository seam: the exact local lifecycle runs against
// pre-authorized state and selectively hydrated blobs. No durable files/network.
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {createClientTemplateStudio,clientTemplateLimits} from './client-template-studio.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status,statusCode:status});};
export function templateOperationBlobHashes({state,operation,body={}}={}){
 const hashes=new Set(),add=ref=>{if(ref?.sha256)hashes.add(ref.sha256);};
 const template=state?.templates.find(row=>row.id===body.templateId),report=state?.reports.find(row=>row.id===body.reportId),version=template?.versions.find(row=>row.version===Number(body.version||body.command?.version||template.versions.at(-1)?.version));
 if(['source','reference','template-command'].includes(operation)){
  if(operation==='source')add(template?.sources.find(row=>row.id===(body.sourceId||version?.sourceId)));
  if(operation==='reference') {if(body.format==='page')add(version?.reference?.pages.find(row=>row.page===Number(body.page||1)));else add(version?.reference?.pdf);}
  if(operation==='template-command'&&body.command?.type==='reference-render')add(template?.sources.find(row=>row.id===version?.sourceId));
 }
 if(operation==='render'){
  const owner=state?.templates.find(row=>row.id===report?.templateId),selected=owner?.versions.find(row=>row.version===report.templateVersion);add(owner?.sources.find(row=>row.id===selected?.sourceId));add(selected?.reference?.pdf);for(const ref of selected?.reference?.pages||[])add(ref);
 }
 if(operation==='artifact'){
  const artifact=report?.artifacts.find(row=>row.id===body.artifactId),format=body.format||'native';add(['native','pdf','reference','json','docx','xlsx'].includes(format)?artifact?.files[format]:artifact?.files[format]?.find(row=>row.page===Number(body.page||1)));
 }
 return [...hashes];
}
export async function evaluateClientTemplateOperation({accountId,state,files={},blobs=new Map(),project,engagement,operation,body={},actorId,native,mapping,approvalPolicy,assistant,now,newId}={}){
 const database=new DatabaseSync(':memory:');let studio;
 try{
  studio=createClientTemplateStudio({database,accountId,getProject:id=>{if(id!==project.id)fail('Template operation crossed its exact source project.',403);return structuredClone(project);},getEngagement:id=>{if(id!==engagement.id)fail('Template operation crossed its exact owning engagement.',403);return structuredClone(engagement);},native,mapping,approvalPolicy,assistant,...(now?{now}:{}),...(newId?{newId}:{})});
  if(state){if(state.accountId!==accountId)fail('Retained template state belongs to another account.',403);database.prepare('UPDATE client_template_state SET json=? WHERE id=1').run(JSON.stringify(state));}
  let total=0;for(const [sha256,manifest]of Object.entries(files)){
   if(sha256!==manifest.sha256||!Number.isSafeInteger(manifest.sizeBytes)||manifest.sizeBytes<1)fail('Invalid exact template blob manifest.');total+=manifest.sizeBytes;
   const bytes=blobs.get(sha256)||Buffer.alloc(0);if(bytes.length&&(bytes.length!==manifest.sizeBytes||hash(bytes)!==sha256))fail('Preloaded template bytes failed their exact checksum.');
   database.prepare('INSERT INTO client_template_blobs(sha256,size,bytes) VALUES(?,?,?)').run(sha256,manifest.sizeBytes,bytes);
  }if(total>clientTemplateLimits.totalBytes)fail('Retained template archive exceeds its bound.',413);
  let result;const envelope=command=>({expectedRevision:body.expectedRevision,actorId,command});
  switch(operation){
   case'list':result=studio.list();break;
   case'get-template':result=studio.getTemplate(body.templateId);break;
   case'import':result=await studio.importTemplate({...body,actorId});break;
   case'template-command':result=await studio.templateCommand(body.templateId,envelope(body.command));break;
   case'source':result=studio.readSource(body.templateId,body.sourceId);break;
   case'reference':result=studio.readReference(body.templateId,body.version,{format:body.format,page:body.page});break;
   case'list-reports':result=studio.listReports({engagementId:engagement.id,...(body.templateId?{templateId:body.templateId}:{})});break;
   case'get-report':result=studio.getReport(body.reportId);break;
   case'create-report':result=await studio.createReport({...body,actorId,engagementId:engagement.id});break;
   case'report-command':result=await studio.reportCommand(body.reportId,envelope(body.command));break;
   case'render':result=await studio.renderReport(body.reportId,{expectedRevision:body.expectedRevision,actorId});break;
   case'artifact':result=studio.readArtifact(body.reportId,body.artifactId,{format:body.format,page:body.page});break;
   case'learning':result=await studio.learning({engagementId:engagement.id});break;
   case'suggest-template':result=await studio.suggestTemplate(body.templateId,{expectedRevision:body.expectedRevision,version:body.version,fieldIds:body.fieldIds,actorId});break;
   case'suggest-report':result=await studio.suggestReport(body.reportId,{expectedRevision:body.expectedRevision,fieldIds:body.fieldIds,actorId});break;
   case'backup':result=studio.backup();break;
   case'restore':result=await studio.restore(body);break;
   default:fail('Choose an explicit supported template operation.',400);
  }
  const next=JSON.parse(database.prepare('SELECT json FROM client_template_state WHERE id=1').get().json),added=[];
  for(const row of database.prepare('SELECT sha256,size,bytes FROM client_template_blobs').all())if(!files[row.sha256]){const bytes=Buffer.from(row.bytes);if(bytes.length!==row.size||hash(bytes)!==row.sha256)fail('New template blob failed its exact staged checksum.');added.push({sha256:row.sha256,sizeBytes:row.size,bytes});}
  return {result,state:next,added,changed:next.revision!==(state?.revision||0)};
 }finally{if(studio)studio.close();else database.close();}
}
