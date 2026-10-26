/** Explicit retained search and original-page attestations. Citations and
 * candidate passages never imply that a practitioner reviewed a complete page. */
export function renderSourceReviewWorkbench({document,engagement,index,actorId,query='',retrieval='lexical',selectedVersionId='',page=1,draft={},onSave,onOpenPage}={}){
 if(!document||!engagement||typeof onSave!=='function')throw new TypeError('Provide a source review document, engagement and save operation.');
 const el=(tag,text,props={})=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;Object.assign(node,props);return node;},root=el('section');root.className='ew-card';root.dataset.sourceReviewWorkbench='true';
 root.append(el('h3','Retain source search and page review'),el('p','Save the actual pages and passages searched, or attest to reviewing complete original PDF pages. Search results and individual citations do not establish complete page review.'));
 const allowed=[...(engagement.roles?.preparer||[]),...(engagement.roles?.reviewer||[])].includes(actorId),status=el('p','');status.setAttribute('role','status');
 const submit=async(button,command)=>{button.disabled=true;try{await onSave(command);delete draft[command.mode==='search'?'search':'full-page'];status.textContent='Source review saved with its exact original identity and practitioner attribution.';}catch(error){status.textContent=error.message;status.setAttribute('role','alert');button.disabled=!allowed;}};
 const uuid=()=>document.defaultView.crypto.randomUUID();
 if(index?.indexId){
  const form=el('form');form.dataset.sourceReviewForm='search';const label=el('label','Search query'),input=el('input',undefined,{type:'text',name:'sourceReviewQuery',value:query,maxLength:2000,required:true});label.append(input);
  const modeLabel=el('label','Retrieval'),mode=el('select',undefined,{name:'retrieval'});for(const value of ['lexical','semantic','hybrid'])mode.append(el('option',value,{value,selected:value===retrieval}));modeLabel.append(mode);
  const noteLabel=el('label','Search purpose and limits'),note=el('textarea',undefined,{name:'statement',required:true,minLength:20,maxLength:4000});noteLabel.append(note);const button=el('button','Run search and retain coverage',{type:'submit',disabled:!allowed});
  form.append(label,modeLabel,noteLabel,button);form.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();if(form.reportValidity())void submit(button,{type:'source-review-save',requestKey:uuid(),mode:'search',indexId:index.indexId,query:input.value,retrieval:mode.value,limit:40,statement:note.value});});root.append(form);
 }else root.append(el('p','Build or reopen an exact source index to retain a search. Original-page review is available independently of text extraction.'));
 const sources=(engagement.sourceVersions||[]).filter(source=>!source.restrictedAvailable&&source.availability!=='unavailable'&&(source.mediaType==='application/pdf'||/\.pdf$/i.test(source.filename||'')));
 if(sources.length){
  const form=el('form');form.dataset.sourceReviewForm='full-page';const sourceLabel=el('label','Exact PDF original'),source=el('select',undefined,{name:'versionId'});for(const version of sources)source.append(el('option',`${version.title||version.filename} · ${version.id}`,{value:version.id,selected:version.id===selectedVersionId}));sourceLabel.append(source);
  const startLabel=el('label','First file page'),start=el('input',undefined,{type:'number',name:'startPage',value:String(page),min:'1',required:true}),endLabel=el('label','Last file page'),end=el('input',undefined,{type:'number',name:'endPage',value:String(page),min:'1',required:true});startLabel.append(start);endLabel.append(end);
  const open=el('button','Open original page',{type:'button'});open.addEventListener('click',()=>{void Promise.resolve(onOpenPage?.(source.value,Number(start.value))).catch(error=>{status.textContent=error.message;status.setAttribute('role','alert');});});
  const attestationLabel=el('label'),attestation=el('input',undefined,{type:'checkbox',name:'fullPageOriginalReviewed',required:true});attestationLabel.append(attestation,document.createTextNode(' I reviewed every complete original file page in this range, including tables, figures and footnotes.'));
  const noteLabel=el('label','Review statement and limitations'),note=el('textarea',undefined,{name:'statement',required:true,minLength:20,maxLength:4000});noteLabel.append(note);const button=el('button','Retain original-page review',{type:'submit',disabled:!allowed});
  form.append(sourceLabel,startLabel,endLabel,open,attestationLabel,noteLabel,button);form.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();const version=sources.find(row=>row.id===source.value);if(form.reportValidity())void submit(button,{type:'source-review-save',requestKey:uuid(),mode:'full_page_review',versionId:version.id,sourceSha256:version.sha256,startPage:Number(start.value),endPage:Number(end.value),fullPageOriginalReviewed:attestation.checked,statement:note.value});});root.append(form);
  for(const field of [source,start,end])field.addEventListener('change',()=>{attestation.checked=false;});
 }
 const records=engagement.sourceReviews||[];root.append(el('h4',`Retained search and review history (${records.length})`));
 for(const record of [...records].reverse().slice(0,30)){
  const details=el('details'),summary=record.mode==='search'?`Search: ${record.search.query} · ${record.search.retrieval} · ${record.search.searchedPassages} passages searched · ${record.search.candidatePassageIds.length} candidates`:`Complete original-page review: ${record.review.pages.join(', ')}`;details.append(el('summary',summary),el('p',`${record.createdBy} · ${record.createdAt} · ${record.statement}`));
  if(record.review){const version=(engagement.sourceVersions||[]).find(row=>row.id===record.review.versionId&&row.sha256===record.review.sourceSha256);details.append(el('p',`${version?.title||version?.filename||record.review.versionId} · version ${record.review.versionId} · SHA256 ${record.review.sourceSha256}.`));}
  if(record.search)for(const source of record.search.sources){const version=(engagement.sourceVersions||[]).find(row=>row.id===source.versionId&&row.sha256===source.sourceSha256);details.append(el('p',`${version?.title||source.versionId}: searched pages ${source.searchedPages.join(', ')||'none'}; candidate pages ${source.candidatePages.join(', ')||'none'}; unreadable pages ${source.unreadablePages.join(', ')||'none'}; excluded ranges ${source.excludedRanges.map(row=>`${row.startPage}–${row.endPage}`).join(', ')||'none'}.`));}
  if(record.search)details.append(el('p',`Retained index ${record.search.indexId} · searched passage-set SHA256 ${record.search.passageSetSha256}.`));root.append(details);
 }
 for(const form of root.querySelectorAll('[data-source-review-form]')){
  const key=form.dataset.sourceReviewForm;
  for(const field of form.elements)if(field.name&&field.type!=='checkbox'&&draft[key]?.[field.name]!==undefined){const previous=draft[key][field.name];if(field.tagName!=='SELECT'||[...field.options].some(option=>option.value===previous))field.value=previous;}
  const remember=()=>{draft[key]=Object.fromEntries([...form.elements].filter(field=>field.name&&field.type!=='checkbox').map(field=>[field.name,field.value]));};form.addEventListener('input',remember);form.addEventListener('change',remember);
 }
 if(!allowed)root.append(el('p','An assigned preparer or reviewer may retain source review records.'));root.append(status);return root;
}
