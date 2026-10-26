import ExcelJS from 'exceljs';
import {oversightRecordDefinitions} from '../src/lib/oversight-model.js';
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const readable=value=>String(value??'').replaceAll('_',' ');
export function oversightReportSections(snapshot) {
  const rows=snapshot.portfolio.projects.map(project=>({...project,name:project.runtimeAccountId?`${project.name} · ${project.accountName||project.runtimeAccountId}`:project.name}));
  const products=rows.flatMap(project=>(project.workProducts||[]).map(record=>({project,record})));
  const narratives=type=>products.filter(({record})=>record.type===type).flatMap(({project,record})=>[
    [project.name,record.recordId,record.revision,'Review provenance',`${record.institution}; authored by ${record.author}; reviewed by ${record.decision?.actorId||'Reviewer not recorded'}; ${record.decision?.authority||'Authority not recorded'}; ${record.decision?.independentReview?'Different content reviewer recorded':'Self-review or independence not established'}`],
    [project.name,record.recordId,record.revision,'Content authorship',`${record.contentAuthor}; last saved ${record.updatedAt}`],
    ...(record.decision?[['Review action',record.decision.action],['Review date',record.decision.at],['Review rationale and qualifications',record.decision.note]].map(([label,value])=>[project.name,record.recordId,record.revision,label,value]):[]),
    ...oversightRecordDefinitions[type].fields.filter(field=>record.values[field.name]!==''&&record.values[field.name]!==undefined).map(field=>[project.name,record.recordId,record.revision,field.label,Array.isArray(record.values[field.name])?record.values[field.name].join(', '):record.values[field.name]]),
    ...(record.values.relatedIds||[]).map(id=>[project.name,record.recordId,record.revision,'Related oversight record',id])
  ]);
  return [
    {name:'Summary',headers:['Project','Institution','Country','Region','Sector','Performance rating','Overdue actions','Open complaints','Pending reviews'],rows:rows.map(p=>[p.name,p.profile.institution,p.profile.country,p.profile.region,p.profile.sector,p.latestRatings.filter(r=>r.dimension==='performance').map(r=>`${r.value} (${r.scaleName||r.scaleId}, ${r.scaleVersion}; ${r.asOf})`).join('; ')||'Not rated',p.overdueActions,p.grievanceSummary.open,p.pendingReviews])},
    {name:'Decisions',headers:['Section','Narrative'],rows:[['Full report title',snapshot.title],...(Array.isArray(snapshot.scopeProvenance)?[['Consolidation denominator',`${snapshot.portfolio.summary.projects} account records; ${snapshot.portfolio.summary.physicalProjects} known physical projects; ${snapshot.portfolio.summary.unlinkedRecords} unlinked records. Complaint and action counts describe account observations, not deduplicated incidents.`]]:[]),['Decisions and recommendations',snapshot.decisions],['Clearance',snapshot.clearance],...snapshot.portfolio.limitations.map(note=>['Limitations',note])]},
    {name:'Risks and mitigants',headers:['Project','Issue','Theme','Priority','Risk','Mitigants / corrective action','Responsible','Due','State','Progress'],rows:rows.flatMap(p=>p.issues.map(i=>[p.name,i.title,i.theme,i.severity,i.risk,i.mitigants,i.owner,i.dueDate,i.state,i.progress]))},
    {name:'Rating history',headers:['Project','Institution','Dimension','Scale','Version','Source','As of','Value','Record','Revision'],rows:rows.flatMap(p=>p.ratingHistory.map(r=>[p.name,r.institution,r.dimension,r.scaleName||r.scaleId,r.scaleVersion,r.scaleSource,r.asOf,r.value,r.recordId,r.revision]))},
    {name:'Supervision',headers:['Project','Responsible','Planned','Completed','Next visit','State','Review status'],rows:rows.flatMap(p=>p.visits.map(v=>[p.name,v.owner,v.plannedDate,v.completedDate,v.nextVisitDate,v.state,v.status]))},
    ...[['opinion','Technical opinions'],['review','Management reviews'],['program','Regional programs'],['visit','Visit findings'],['rating','Rating rationale'],['issue','Action verification']].map(([type,name])=>({name,headers:['Project','Record','Revision','Section','Narrative'],rows:narratives(type)})),
    {name:'Evidence pins',headers:['Project','Record','Revision','Resource','Source version','SHA256','Locator'],rows:products.flatMap(({project,record})=>(record.values.evidencePins||[]).map(pin=>[project.name,record.recordId,record.revision,pin.resourceId,pin.versionId,pin.sha256,pin.locator]))},
    ...(Array.isArray(snapshot.scopeProvenance)?[{name:'Selected source scope',headers:['Account / custody','Project / canonical identity','State','Oversight revision','Projection SHA256','Observed at'],rows:snapshot.scopeProvenance.map(source=>[`${source.accountName||source.accountId}\n${source.custodyId||'Unavailable custody'}\nRuntime: ${source.accountId}`,`${source.projectId}\n${source.canonicalProjectName||''}\n${source.canonicalProjectId||'No canonical link'}`,source.status,source.revision??'',source.sha256||'',source.observedAt||''])}]:[]),
    {name:'Source revisions',headers:['Account','Project','Oversight revision','Record','Type','Record revision','Review status'],rows:snapshot.sourceRevisions.flatMap(p=>p.records.map(r=>[p.accountId,p.projectId,p.revision,r.id,r.type,r.revision,r.status]))}
  ];
}
export function renderOversightReportHtml(snapshot) {
  const sections=oversightReportSections(snapshot);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(snapshot.title)}</title><style>
  :root{font:15px/1.5 system-ui;color:#172b29;background:white}body{max-width:1280px;margin:2rem auto;padding:1rem}h1,h2{color:#155846}table{border-collapse:collapse;width:100%;margin:1rem 0;table-layout:fixed}th,td{border:1px solid #c4d4ce;padding:.5rem;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#e2f0e9;text-align:left}thead{display:table-header-group}.note{border-left:4px solid #37745c;padding:.75rem;background:#f0f6f3}section{margin-top:2rem}p{white-space:pre-wrap}@page{size:A4 landscape;margin:12mm}@media print{body{max-width:none;margin:0;padding:0;font-size:9pt}section{break-before:page}tr{break-inside:avoid}h2{break-after:avoid}}
  </style><h1>${h(snapshot.title)}</h1><p>${h(readable(snapshot.kind))} · ${h(snapshot.periodStart)}–${h(snapshot.periodEnd)} · observations through ${h(snapshot.portfolio.asOf)}</p><p>Prepared ${h(snapshot.createdAt)} by ${h(snapshot.createdBy)} · snapshot ${h(snapshot.id)}</p><p class="note">${h(snapshot.clearance)}</p><h2>Decisions and recommendations</h2><p>${h(snapshot.decisions)}</p><ul>${snapshot.portfolio.limitations.map(v=>`<li>${h(v)}</li>`).join('')}</ul>${sections.map(s=>`<section><h2>${h(s.name)}</h2><table><thead><tr>${s.headers.map(v=>`<th scope="col">${h(v)}</th>`).join('')}</tr></thead><tbody>${s.rows.map(row=>`<tr>${row.map(v=>`<td>${h(v)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${s.headers.length}">No records in this snapshot.</td></tr>`}</tbody></table></section>`).join('')}<p>Content SHA256: ${h(snapshot.sha256||'Not supplied')}</p></html>`;
}
export async function renderOversightWorkbook(snapshot) {
  return renderOversightSectionsWorkbook({title:snapshot.title,subtitle:`${snapshot.periodStart}–${snapshot.periodEnd}; as of ${snapshot.portfolio.asOf}; snapshot ${snapshot.id}`,
    clearance:snapshot.clearance,note:'Full decisions and recommendations are retained on the Decisions tab.',sections:oversightReportSections(snapshot)});
}

/** The same bounded printable table layout serves packets and comparisons. */
export async function renderOversightSectionsWorkbook({title,subtitle,clearance,note,sections}) {
  const workbook=new ExcelJS.Workbook();workbook.creator='E&S professional workspace';workbook.title=title;
  for(const section of sections) {
    const sheet=workbook.addWorksheet(section.name,{views:[{state:'frozen',ySplit:5}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'5:5',margins:{left:.3,right:.3,top:.45,bottom:.45,header:.2,footer:.2}}});
    sheet.addRow([title.length>110?title.slice(0,107)+'…':title]);sheet.mergeCells(1,1,1,section.headers.length);sheet.getRow(1).height=60;sheet.getRow(1).font={name:'Calibri',size:16,bold:true,color:{argb:'FF155846'}};
    sheet.addRow([subtitle]);sheet.mergeCells(2,1,2,section.headers.length);sheet.getRow(2).height=40;
    sheet.addRow([clearance]);sheet.mergeCells(3,1,3,section.headers.length);sheet.getRow(3).height=40;
    sheet.addRow([note]);sheet.mergeCells(4,1,4,section.headers.length);sheet.getRow(4).height=30;
    sheet.addRow(section.headers);sheet.getRow(5).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(5).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF155846'}};
    for(let n=1;n<=section.headers.length;n++)sheet.getColumn(n).width=/Risk|Mitigant|Progress|Narrative/.test(section.headers[n-1])?40:24;
    // Continuation rows keep long, valid practitioner text printable instead
    // of relying on Excel's fixed-height clipping or manual autofit.
    for(const row of section.rows){
      const cells=row.map((value,index)=>printChunks(value,Math.max(16,Math.floor(sheet.getColumn(index+1).width)-3)));
      for(let part=0;part<Math.max(...cells.map(chunks=>chunks.length));part++){
        const chunks=cells.map(values=>values[part]),added=sheet.addRow(chunks.map(chunk=>chunk?.value??''));
        added.height=Math.max(32,Math.max(...chunks.map(chunk=>chunk?.lines||1))*14+8);
      }
    }
    sheet.eachRow((row,n)=>{row.alignment={vertical:'top',wrapText:true};if(n>5&&n%2===0)row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F6F3'}};});
    sheet.autoFilter={from:{row:5,column:1},to:{row:5,column:section.headers.length}};
    // ExcelJS supplies the column $ markers when serializing print areas.
    sheet.pageSetup.printArea=`A$1:${sheet.getColumn(section.headers.length).letter}$${Math.max(5,sheet.rowCount)}`;
    sheet.headerFooter.oddFooter='E&S oversight · &A · Page &P of &N';
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function printChunks(value,width) {
  if(typeof value==='number')return[{value,lines:1}];
  const text=String(value??''),lines=[],paragraphs=text.split('\n');
  for(const [index,paragraph]of paragraphs.entries()){
    let rest=Array.from(paragraph);
    if(!rest.length)lines.push(index<paragraphs.length-1?'\n':'');
    while(rest.length){let cut=Math.min(width,rest.length);if(cut<rest.length){const space=rest.slice(0,cut).lastIndexOf(' ');if(space>width/2)cut=space+1;}const piece=rest.splice(0,cut).join('');lines.push(piece+(!rest.length&&index<paragraphs.length-1?'\n':''));}
  }
  // Soft wrapping is a display calculation, never a change to a hash, ID or
  // quoted passage. Excel's wrapText handles those breaks inside each cell.
  const chunks=[];for(let offset=0;offset<lines.length;offset+=8){const part=lines.slice(offset,offset+8);chunks.push({value:part.join(''),lines:part.length});}
  return chunks.length?chunks:[{value:'',lines:1}];
}
