"""Bounded native template structure/population worker. No template code executes."""
import base64, copy, hashlib, html, io, json, math, os, posixpath, re, sys, zipfile
from lxml import etree as ET

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS = {'w': W, 's': S, 'r': R}
TOKEN = re.compile(r'\{\{\s*([A-Za-z][A-Za-z0-9_.-]{0,95})\s*\}\}')
XML_SPACE = '{http://www.w3.org/XML/1998/namespace}space'
def digest(value): return hashlib.sha256(value).hexdigest()
def stable(value): return json.dumps(value, sort_keys=True, separators=(',', ':'))
def field_id(anchor): return 'native-' + digest(stable(anchor).encode())[:24]
def local(node): return ET.QName(node).localname
def elements(node, name, ns=None): return node.xpath('.//*[local-name()=$name]', name=name) if not ns else node.findall('.//{%s}%s' % (ns, name))
def texts(node): return ''.join(node.itertext())
def word_text(node): return ''.join(t.text or '' for t in node.findall('.//{%s}t' % W))
def child_nodes(node, name): return [part for part in node if local(part) == name]
def fail(message): raise ValueError(message)
def parse(value):
    if b'<!DOCTYPE' in value.upper() or b'<!ENTITY' in value.upper(): fail('DTD and XML entity declarations are unsupported.')
    parser = ET.XMLParser(resolve_entities=False, load_dtd=False, no_network=True, huge_tree=False, remove_blank_text=False)
    root=ET.fromstring(value, parser)
    if root.getroottree().docinfo.doctype:fail('DTD declarations are unsupported, including non-UTF-8 XML sources.')
    return root
def xml_bytes(node): return ET.tostring(node, encoding='UTF-8', xml_declaration=True, standalone=True)
def safe_key(key): return bool(re.fullmatch(r'[A-Za-z][A-Za-z0-9_.-]{0,95}', key or ''))
def scalar(value):
    if value is None: return ''
    if isinstance(value, bool): return 'Yes' if value else 'No'
    if isinstance(value, (int, float)):
        if not math.isfinite(value): fail('Numeric values must be finite.')
        return str(value)
    if not isinstance(value, str) or len(value) > 100000 or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value): fail('A native field requires bounded text, date, number or boolean content.')
    return value
def candidate(anchor, label, type='text', **extra): return {'id':field_id(anchor),'label':label,'anchor':anchor,'type':type,'required':False,'reviewStatus':'unreviewed', **extra}
def relationship_target(part, target):
    if re.match(r'(?i)(?:[a-z][a-z0-9+.-]*:|//|\\)', target): fail('External or absolute document relationships are unsupported.')
    base=posixpath.dirname(posixpath.dirname(part)) if '/_rels/' in part else ''
    result=posixpath.normpath(posixpath.join(base,target)) if not target.startswith('/') else target[1:]
    if result.startswith('../') or result=='..': fail('A document relationship escapes its package.')
    return result
def open_package(data, format):
    archive=zipfile.ZipFile(io.BytesIO(data)); parts={item.filename:archive.read(item.filename) for item in archive.infolist()}
    roots={}
    functions={'SUM','SUMIF','SUMIFS','COUNT','COUNTA','COUNTIF','COUNTIFS','IF','IFS','IFERROR','AND','OR','NOT','AVERAGE','MIN','MAX','ROUND','ROUNDUP','ROUNDDOWN','ABS','CONCAT','CONCATENATE','TEXT','LEN','LEFT','RIGHT','MID','TRIM','LOWER','UPPER','ISBLANK','ISNUMBER','VLOOKUP','HLOOKUP','INDEX','MATCH','SUBTOTAL','DATE','YEAR','MONTH','DAY'}
    for name, content in parts.items():
        if '/media/' in name.lower():
            from PIL import Image
            if not re.search(r'\.(png|jpe?g|gif|bmp|tiff?)$',name,re.I):fail('Only bounded inert raster images are supported in native Office media.')
            image=Image.open(io.BytesIO(content))
            if image.width*image.height>20000000:fail('An Office image exceeds the 20 million pixel render limit.')
        if not re.search(r'\.(xml|rels|vml)$',name,re.I): continue
        root=parse(content);roots[name]=root
        for node in root.iter():
            if not isinstance(node.tag,str):continue
            if local(node).lower() in ['object','oleobject','altchunk','script']:fail('Active or embedded document elements are unsupported.')
            for key,value in node.attrib.items():
                if ET.QName(key).localname.lower()=='instr' and re.search(r'(?i)\b(DDE|DDEAUTO|INCLUDETEXT|INCLUDEPICTURE|DATABASE|LINK|HYPERLINK)\b',value):fail('Active Word field instructions are unsupported.')
                if ET.QName(key).localname.lower() in ['href','src'] and re.search(r'(?i)(?:^[a-z][a-z0-9+.-]*:|^//|^\\|\.\./)',value):fail('External inline image or VML references are unsupported.')
                if re.search(r'(?i)\burl\s*\(',value):fail('Inline CSS URL retrieval is unsupported in native templates.')
        if name.endswith('.rels'):
            ids=set()
            for rel in root:
                if rel.get('Id') in ids: fail('A native package relationship identity is duplicated.')
                ids.add(rel.get('Id'))
                if rel.get('TargetMode','').lower()=='external': fail('External document relationships must be removed before native processing.')
                target=relationship_target(name,rel.get('Target',''))
                if target not in parts and not target.endswith('/'): fail('A document relationship target is missing from its retained package.')
        for instruction in root.xpath('//*[local-name()="instrText"]'):
            if re.search(r'(?i)\b(DDE|DDEAUTO|INCLUDETEXT|INCLUDEPICTURE|DATABASE|LINK|HYPERLINK)\b',instruction.text or ''): fail('Active Word field instructions are unsupported.')
        if format=='xlsx':
            for f in root.xpath('//*[local-name()="f" or local-name()="formula" or local-name()="formula1" or local-name()="formula2"]'):
                expression=f.text or ''
                if re.search(r'\[|\]|://|\\|\|',expression): fail('External spreadsheet references are unsupported.')
                called=set(re.findall(r'([A-Za-z_][A-Za-z0-9_.]*)\s*\(',expression))
                if any(fn.upper() not in functions for fn in called): fail('A spreadsheet formula uses a function outside the bounded local calculation profile.')
    return parts, roots

def label_key(key): return re.sub(r'[_ .-]+',' ',key).strip().capitalize()
def describe_docx(parts, roots):
    fields=[];sections=[];paragraphs=[];tables=[];headings=[];styles=[];headers=[];footers=[];page_settings=[]
    for part,root in roots.items():
        if not re.fullmatch(r'word/(?:document|header\d*|footer\d*)\.xml',part): continue
        paras=root.findall('.//{%s}p'%W); table_nodes=root.findall('.//{%s}tbl'%W)
        handled_rows=set();handled_paragraphs=set()
        for ti,table in enumerate(table_nodes):
            rows=child_nodes(table,'tr'); table_record={'part':part,'index':ti,'rows':len(rows),'columns':max((len(child_nodes(row,'tc')) for row in rows),default=0),'mergedCells':len(table.findall('.//{%s}gridSpan'%W))+len(table.findall('.//{%s}vMerge'%W)),
                'cells':[{'row':ri,'cell':ci,'text':word_text(cell),'paragraphs':[paras.index(p) for p in cell.findall('.//{%s}p'%W)],'width':cell.find('./{%s}tcPr/{%s}tcW'%(W,W)).get('{%s}w'%W) if cell.find('./{%s}tcPr/{%s}tcW'%(W,W)) is not None else None,'merged':bool(cell.findall('.//{%s}gridSpan'%W) or cell.findall('.//{%s}vMerge'%W))} for ri,row in enumerate(rows) for ci,cell in enumerate(child_nodes(row,'tc'))]};tables.append(table_record)
            for ri,row in enumerate(rows):
                markers=TOKEN.findall(word_text(row)); groups=set(key.split('.')[0] for key in markers if '.' in key)
                if len(groups)==1 and markers and all('.' in key and key.split('.')[0] in groups for key in markers):
                    if row.findall('.//{%s}tbl'%W): fail('Nested tables inside a repeating row need a separate approved adapter.')
                    group=next(iter(groups));keys=list(dict.fromkeys(key.split('.',1)[1] for key in markers))
                    anchor={'kind':'docx_repeat_row','part':part,'table':ti,'row':ri,'group':group}
                    caption=table.find('./{%s}tblPr/{%s}tblCaption'%(W,W))
                    fields.append(candidate(anchor,caption.get('{%s}val'%W) if caption is not None else label_key(group),'repeat_table',repeat=True,columns=[{'key':key,'label':label_key(key),'type':'text'} for key in keys],behavior='repeating_collection'))
                    handled_rows.add(id(row)); handled_paragraphs.update(id(p) for p in row.findall('.//{%s}p'%W))
        for index,sdt in enumerate(root.findall('.//{%s}sdt'%W)):
            if any(id(p) in handled_paragraphs for p in sdt.findall('.//{%s}p'%W)): continue
            properties=sdt.find('{%s}sdtPr'%W); tag=properties.find('{%s}tag'%W) if properties is not None else None
            if tag is None: continue
            key=tag.get('{%s}val'%W,'')
            if not safe_key(key): continue
            if sdt.findall('.//{%s}sdt'%W): fail('Nested dynamic content controls need an explicit specialist adapter.')
            anchor={'kind':'docx_content_control','part':part,'index':index,'key':key}
            options=[node.get('{%s}value'%W,node.get('{%s}displayText'%W,'')) for node in properties.findall('.//{%s}listItem'%W)]
            alias=properties.find('{%s}alias'%W)
            fields.append(candidate(anchor,alias.get('{%s}val'%W) if alias is not None else label_key(key),'date' if properties.find('{%s}date'%W) is not None else 'text',behavior='direct',**({'allowedValues':options} if options else {})))
            handled_paragraphs.update(id(p) for p in sdt.findall('.//{%s}p'%W))
        for index,start in enumerate(root.findall('.//{%s}bookmarkStart'%W)):
            key=start.get('{%s}name'%W,'');identifier=start.get('{%s}id'%W)
            if key.startswith('_') or not safe_key(key): continue
            end=root.xpath('.//w:bookmarkEnd[@w:id=$identifier]',namespaces=NS,identifier=identifier)
            if len(end)!=1 or start.getparent() is not end[0].getparent(): fail('Editable bookmarks must have one matching end in the same paragraph.')
            if local(start.getparent())!='p': fail('Only paragraph-local Word bookmarks are editable.')
            anchor={'kind':'docx_bookmark','part':part,'index':index,'key':key,'bookmarkId':identifier}
            fields.append(candidate(anchor,label_key(key),behavior='direct'));handled_paragraphs.add(id(start.getparent()))
        for pi,p in enumerate(paras):
            value=word_text(p);style=p.find('./{%s}pPr/{%s}pStyle'%(W,W));style_name=style.get('{%s}val'%W) if style is not None else None
            paragraphs.append({'part':part,'index':pi,'text':value,'style':style_name,'inTable':any(local(parent)=='tc' for parent in p.iterancestors())})
            if style_name and re.search(r'(?i)heading|title',style_name): headings.append({'part':part,'paragraph':pi,'text':value,'style':style_name})
            if id(p) in handled_paragraphs: continue
            for occurrence,match in enumerate(TOKEN.finditer(value)):
                anchor={'kind':'docx_placeholder','part':part,'paragraph':pi,'key':match.group(1),'token':match.group(0),'occurrence':occurrence}
                fields.append(candidate(anchor,label_key(match.group(1)),behavior='direct'))
        page_settings.extend({'part':part,'xml':ET.tostring(node).decode()} for node in root.findall('.//{%s}sectPr'%W))
        if part.startswith('word/header'): headers.append(part)
        if part.startswith('word/footer'): footers.append(part)
    if 'word/styles.xml' in roots:
        styles=[{'id':node.get('{%s}styleId'%W),'type':node.get('{%s}type'%W)} for node in roots['word/styles.xml'].findall('{%s}style'%W)]
    for heading in headings: sections.append({'id':'section-'+str(len(sections)+1),'title':heading['text'],'anchor':{key:heading[key] for key in ['part','paragraph']},'fieldIds':[]})
    if not sections: sections=[{'id':'native-body','title':'Document body','fieldIds':[]}]
    for field in fields:
        anchor=field['anchor'];root=roots[anchor['part']];paragraph_nodes=root.findall('.//{%s}p'%W)
        if anchor['kind']=='docx_placeholder':position=anchor['paragraph']
        else:
            if anchor['kind']=='docx_repeat_row':container=child_nodes(root.findall('.//{%s}tbl'%W)[anchor['table']],'tr')[anchor['row']]
            elif anchor['kind']=='docx_content_control':container=root.findall('.//{%s}sdt'%W)[anchor['index']]
            else:container=root.findall('.//{%s}bookmarkStart'%W)[anchor['index']].getparent()
            paragraph=container if local(container)=='p' else next(iter(container.findall('.//{%s}p'%W)),None)
            position=paragraph_nodes.index(paragraph) if paragraph is not None else 0
        preceding=[s for s in sections if s.get('anchor',{}).get('part')==anchor['part'] and s['anchor']['paragraph']<=position]
        destination=preceding[-1] if preceding else sections[0];destination['fieldIds'].append(field['id'])
    return fields,sections,{'paragraphs':paragraphs,'tables':tables,'headings':headings,'styles':styles,'headers':headers,'footers':footers,'pageSettings':page_settings,'graphics':[name for name in parts if name.startswith('word/media/')],'numbering':'word/numbering.xml' in parts},[]

def cell_value(cell,shared):
    t=cell.get('t');v=cell.find('{%s}v'%S)
    if t=='s':
        try:return shared[int(v.text)]
        except Exception:fail('A shared-string cell has an invalid source index.')
    if t=='inlineStr':return ''.join(node.text or '' for node in cell.findall('.//{%s}t'%S))
    return v.text or '' if v is not None else ''
def range_parts(value):
    match=re.fullmatch(r"(?:'((?:[^']|'')+)'|([^'!]+))!\$?([A-Z]{1,3})\$?([1-9][0-9]*)(?::\$?([A-Z]{1,3})\$?([1-9][0-9]*))?",value or '')
    if not match:return None
    return {'sheet':(match.group(1) or match.group(2)).replace("''","'"),'column':match.group(3),'row':int(match.group(4)),'endColumn':match.group(5) or match.group(3),'endRow':int(match.group(6) or match.group(4))}
def cell_position(ref):
    match=re.fullmatch(r'([A-Z]{1,3})([1-9][0-9]{0,6})',ref or '')
    if not match:fail('An invalid spreadsheet cell address was supplied.')
    col=0
    for letter in match.group(1):col=col*26+ord(letter)-64
    if col>16384 or int(match.group(2))>1048576:fail('A spreadsheet input cell is outside worksheet limits.')
    return col,int(match.group(2))
def sheet_parts(roots):
    rels={r.get('Id'):relationship_target('xl/_rels/workbook.xml.rels',r.get('Target','')) for r in roots['xl/_rels/workbook.xml.rels']}
    return [(sheet.get('name'),rels.get(sheet.get('{%s}id'%R))) for sheet in roots['xl/workbook.xml'].findall('.//{%s}sheet'%S)]
def describe_xlsx(parts,roots):
    fields=[];sheets=[];formulas=[];tables=[];names=[];shared=[''.join(node.itertext()) for node in roots.get('xl/sharedStrings.xml',ET.Element('empty')).findall('{%s}si'%S)]
    named_inputs={}; sheet_list=sheet_parts(roots);sheet_by_name=dict(sheet_list)
    for name in roots['xl/workbook.xml'].findall('.//{%s}definedName'%S):
        key=name.get('name','');value=name.text or '';names.append({'name':key,'value':value,'localSheetId':name.get('localSheetId')})
        location=range_parts(value)
        if safe_key(key) and not key.startswith('_') and location and location['column']==location['endColumn'] and location['row']==location['endRow']:
            part=sheet_by_name.get(location['sheet']);ref=location['column']+str(location['row'])
            if part:named_inputs[(part,ref)]=key
    for sheet_name,part in sheet_list:
        if part not in roots:fail('A workbook worksheet is missing.')
        root=roots[part];cells=root.findall('.//{%s}c'%S);by_ref={c.get('r'):c for c in cells};repeated_cells=set()
        sheet_tables=[];rels_part=posixpath.dirname(part)+'/_rels/'+posixpath.basename(part)+'.rels'
        rels={rel.get('Id'):relationship_target(rels_part,rel.get('Target','')) for rel in roots.get(rels_part,[])}
        for table_ref in root.findall('.//{%s}tablePart'%S):
            target=rels.get(table_ref.get('{%s}id'%R));table=roots.get(target)
            if table is None:fail('A worksheet table relationship is missing.')
            table_range=table.get('ref');m=re.fullmatch(r'([A-Z]+)(\d+):([A-Z]+)(\d+)',table_range or '')
            if not m:fail('A worksheet table range is invalid.')
            start=int(m.group(2))+int(table.get('headerRowCount','1'));end=int(m.group(4))-int(table.get('totalsRowCount','0'))
            row_cells=[c for c in cells if cell_position(c.get('r'))[1]==start]
            tokens=[(c,match) for c in row_cells for match in TOKEN.finditer(cell_value(c,shared))]
            groups={match.group(1).split('.')[0] for c,match in tokens if '.' in match.group(1)}
            if tokens and len(groups)==1 and all('.' in match.group(1) for c,match in tokens):
                group=next(iter(groups));columns=[{'key':match.group(1).split('.',1)[1],'label':label_key(match.group(1).split('.',1)[1]),'column':re.match(r'[A-Z]+',c.get('r')).group(0),'type':'text'} for c,match in tokens]
                anchor={'kind':'xlsx_repeat_table','part':part,'tablePart':target,'group':group,'startRow':start,'endRow':end,'columns':columns}
                fields.append(candidate(anchor,label_key(group),'repeat_table',repeat=True,columns=columns,capacity=end-start+1,behavior='repeating_collection'))
                repeated_cells.update(c.get('r') for c,match in tokens)
            record={'part':target,'name':table.get('displayName'),'ref':table_range,'columns':[column.get('name') for column in table.findall('.//{%s}tableColumn'%S)]};sheet_tables.append(record);tables.append(record)
        display_cells=[]
        for cell in cells:
            ref=cell.get('r');cell_position(ref);value=cell_value(cell,shared);formula=cell.find('{%s}f'%S)
            if formula is not None:formulas.append({'part':part,'cell':ref,'formula':formula.text or '', 'attributes':dict(formula.attrib)})
            display_cells.append({'cell':ref,'text':value,'style':cell.get('s'),'formula':formula.text if formula is not None else None})
            if ref in repeated_cells:continue
            key=named_inputs.get((part,ref));matches=list(TOKEN.finditer(value))
            if key or matches:
                if formula is not None:fail('Formula cells cannot also be mapped native input fields.')
                if len(matches)>1:fail('Use one native input per spreadsheet cell.')
                anchor={'kind':'xlsx_cell','part':part,'cell':ref,'key':key or matches[0].group(1),'sourceText':value,**({'token':matches[0].group(0)} if matches else {})}
                fields.append(candidate(anchor,label_key(key or matches[0].group(1)),behavior='direct',sheetName=sheet_name,numberFormatStyle=cell.get('s')))
        dimension=root.find('{%s}dimension'%S)
        sheets.append({'name':sheet_name,'part':part,'dimension':dimension.get('ref') if dimension is not None else None,'protected':root.find('{%s}sheetProtection'%S) is not None,'cells':display_cells,'merges':[m.get('ref') for m in root.findall('.//{%s}mergeCell'%S)],'validations':[{'type':v.get('type'),'range':v.get('sqref'),'formula1':v.findtext('{%s}formula1'%S)} for v in root.findall('.//{%s}dataValidation'%S)],'printSettings':[ET.tostring(node).decode() for node in root if local(node) in ['pageMargins','pageSetup','printOptions','headerFooter','sheetPr']],'tables':sheet_tables})
    warnings=['Workbook formulas and caches are preserved in the editable native file. The pinned office renderer recalculates local formulas for the PDF. Repeating tables fill only their existing designed capacity; unrelated cells and all formula expressions remain unchanged.']
    return fields,[{'id':'sheet-'+str(i+1),'title':name,'fieldIds':[f['id'] for f in fields if f['anchor']['part']==part]} for i,(name,part) in enumerate(sheet_list)],{'sheets':sheets,'formulas':formulas,'namedRanges':names,'tables':tables,'charts':[name for name in parts if re.match(r'xl/charts/chart\d+\.xml',name)],'graphics':[name for name in parts if name.startswith('xl/media/')]},warnings

def pdf_reader(data):
    from pypdf import PdfReader
    import pypdf.filters as filters
    for key in ['ZLIB_MAX_OUTPUT_LENGTH','LZW_MAX_OUTPUT_LENGTH','RUN_LENGTH_MAX_OUTPUT_LENGTH','MAX_ARRAY_BASED_STREAM_OUTPUT_LENGTH','MAX_DECLARED_STREAM_LENGTH','JBIG2_MAX_OUTPUT_LENGTH']:
        if hasattr(filters,key):setattr(filters,key,min(getattr(filters,key),32*1024*1024))
    reader=PdfReader(io.BytesIO(data),strict=True)
    if reader.is_encrypted:fail('Encrypted PDFs require an explicitly decrypted source.')
    if len(reader.pages)>40:fail('Native PDF templates are bounded to 40 pages.')
    seen=set()
    def inspect(value,depth=0):
        if depth>50:fail('The PDF object graph exceeds the bounded nesting profile.')
        try:
            if hasattr(value,'idnum'):
                key=(value.idnum,value.generation)
                if key in seen:return
                seen.add(key);value=value.get_object()
            if isinstance(value,dict):
                if value.get('/S') in ['/JavaScript','/Launch','/URI','/GoToR','/SubmitForm','/ImportData'] or '/JS' in value or '/EmbeddedFiles' in value or '/XFA' in value:fail('PDF scripts, external actions, embedded files and XFA are unsupported.')
                if value.get('/FT')=='/Sig':fail('Signed or signature-field PDFs require a separate signature-preserving workflow.')
                if value.get('/Subtype')=='/Image' and int(value.get('/Width',0))*int(value.get('/Height',0))>20000000:fail('A PDF image exceeds the 20 million pixel render limit.')
                for k,v in value.items():
                    if k not in ['/Parent','/P']:inspect(v,depth+1)
            elif isinstance(value,list):
                for row in value:inspect(row,depth+1)
        except RecursionError:fail('The PDF object graph exceeds supported nesting.')
    inspect(reader.trailer)
    for page in reader.pages:
        width=float(page.mediabox.width);height=float(page.mediabox.height)
        if not all(math.isfinite(v) and 0<v<=4000 for v in [width,height]) or width*height>4000000:fail('A PDF page exceeds the bounded four-million-pixel reference-render geometry.')
    return reader
def describe_pdf(data):
    reader=pdf_reader(data);fields=[];pages=[];warnings=[];locations={}
    for pi,page in enumerate(reader.pages):
        pages.append({'page':pi+1,'width':float(page.mediabox.width),'height':float(page.mediabox.height),'text':(page.extract_text() or '')[:100000]})
        for ref in page.get('/Annots',[]):
            annotation=ref.get_object();name=annotation.get('/T')
            if name:locations[str(name)]={'page':pi+1,'rect':[float(v) for v in annotation.get('/Rect',[])]}
    for name,f in (reader.get_fields() or {}).items():
        kind=str(f.get('/FT','/Tx'));anchor={'kind':'pdf_form','key':str(name),**locations.get(str(name),{})}
        if kind not in ['/Tx','/Btn','/Ch']:fail('This PDF form field requires an unsupported native adapter.')
        fields.append(candidate(anchor,str(name),'boolean' if kind=='/Btn' else 'text',behavior='direct',required=bool(int(f.get('/Ff',0))&2),**({'allowedValues':[str(v) for v in f.get('/Opt',[])]} if f.get('/Opt') else {})))
    if not fields:warnings.append('This static/scanned PDF has no interactive fields. Add explicitly reviewed page regions for controlled text overlays. No editable Office reconstruction or automatic OCR interpretation is claimed.')
    return fields,[{'id':'pdf-page-'+str(p['page']),'title':'PDF page '+str(p['page']),'fieldIds':[f['id'] for f in fields if f['anchor'].get('page')==p['page']]} for p in pages],{'pages':pages,'interactive':bool(fields),'manualOverlaySupported':True,'scanned':not any(p['text'].strip() for p in pages)},warnings

def analyze(data,format):
    if format=='pdf':fields,sections,structure,warnings=describe_pdf(data);parts=[]
    else:
        contents,roots=open_package(data,format);fields,sections,structure,warnings=(describe_docx if format=='docx' else describe_xlsx)(contents,roots);parts=[{'name':name,'sha256':digest(value),'bytes':len(value)} for name,value in contents.items()]
    if len(fields)>1000:fail('This template exceeds 1000 native editable fields.')
    if len({f['id'] for f in fields})!=len(fields):fail('The source contains duplicate native anchor identities.')
    preview='<article class="native-source-preview"><p>Native '+format.upper()+' structure · select a detected input.</p>'+''.join('<button type="button" data-native-field="'+html.escape(f['id'])+'" data-template-field="'+html.escape(f['id'])+'">'+html.escape(f['label'])+'</button>' for f in fields)+'</article>'
    return {'format':format,'sourceSha256':digest(data),'sections':sections,'fields':fields,'previewHtml':preview,'structure':structure,'features':{'nativePopulation':True,'macros':False,'externalRelationships':False,'manualPdfOverlays':format=='pdf','manualNativeFields':format in ['docx','xlsx'],'repeatRows':format=='docx','fixedWorkbookTables':format=='xlsx'},'warnings':warnings,'parts':parts}

def exact_keys(value,required,optional=()):
    if not isinstance(value,dict) or set(value)-set(required)-set(optional) or set(required)-set(value):fail('A reviewed native anchor has unsupported or missing properties.')
def bounded_index(value,length):
    if isinstance(value,bool) or not isinstance(value,int) or value<0 or value>=length:fail('A reviewed native anchor is outside its exact source element.')
    return value
def same_or_contains(a,b):return a is b or a in b.iterancestors() or b in a.iterancestors()
def word_target(roots,anchor):
    root=roots[anchor['part']];kind=anchor['kind']
    if kind in ['docx_paragraph','docx_placeholder']:return root.findall('.//{%s}p'%W)[bounded_index(anchor['paragraph'],len(root.findall('.//{%s}p'%W)))]
    if kind in ['docx_table_cell','docx_manual_repeat_row','docx_repeat_row']:
        tables=root.findall('.//{%s}tbl'%W);table=tables[bounded_index(anchor['table'],len(tables))];rows=child_nodes(table,'tr');row=rows[bounded_index(anchor['row'],len(rows))]
        return child_nodes(row,'tc')[bounded_index(anchor['cell'],len(child_nodes(row,'tc')))] if kind=='docx_table_cell' else row
    if kind=='docx_content_control':return root.findall('.//{%s}sdt'%W)[anchor['index']]
    if kind=='docx_bookmark':return root.findall('.//{%s}bookmarkStart'%W)[anchor['index']].getparent()
    fail('Unsupported native Word target.')
def plain_word_target(target):
    forbidden={'tbl','sdt','bookmarkStart','bookmarkEnd','fldSimple','instrText','drawing','pict','object','hyperlink','commentRangeStart','commentRangeEnd','footnoteReference','endnoteReference','ins','del','moveFrom','moveTo'}
    if any(local(node) in forbidden for node in target.iter() if node is not target):fail('A manual Word target contains nested tables, controls, identities, tracked changes or graphics; select a plain source region.')
    if target.findall('.//{%s}gridSpan'%W) or target.findall('.//{%s}vMerge'%W):fail('Manual Word table targets cannot cross merged cells.')
def xlsx_range(value):
    parts=(value or '').replace('$','').split(':')
    if len(parts)>2:fail('A workbook source range is invalid.')
    start=cell_position(parts[0]);end=cell_position(parts[-1])
    if start[0]>end[0] or start[1]>end[1]:fail('A workbook source range is reversed.')
    return start,end
def range_contains(bounds,position):return bounds[0][0]<=position[0]<=bounds[1][0] and bounds[0][1]<=position[1]<=bounds[1][1]
def reviewed_source_cell(root,ref):
    position=cell_position(ref);found=root.xpath('.//s:c[@r=$ref]',namespaces=NS,ref=ref)
    if len(found)>1:fail('The workbook contains a duplicated reviewed cell reference.')
    if found:return found[0]
    dimension=root.find('{%s}dimension'%S)
    if dimension is None or not range_contains(xlsx_range(dimension.get('ref')),position):fail('A blank manual cell is outside the exact original worksheet dimension.')
    return None
def manual_native_targets(data,format,definition,original=None):
    # Validate against the complete original every time: at field registration,
    # backup restore and native population. Caller-provided analyses grant no authority.
    if definition.get('sourceSha256')!=digest(data):fail('The manual native definition does not identify the exact retained source.')
    fields=definition.get('fields',[])
    if not isinstance(fields,list) or len(fields)>1000:fail('Reviewed native fields exceed the 1000 field bound.')
    manual=[field for field in fields if field.get('manualNative') is True]
    if not manual:return {}
    if format not in ['docx','xlsx']:fail('Manual Office anchors require an exact DOCX or XLSX original.')
    original=original or analyze(data,format);parts,roots=open_package(data,format);targets={};occupied=[]
    if format=='docx' and 'word/settings.xml' in roots:
        for protection in roots['word/settings.xml'].findall('.//{%s}documentProtection'%W):
            if protection.get('{%s}enforcement'%W,'1').lower() not in ['0','false','off']:fail('Protected Word documents require an authorized editable source before manual targets can be defined.')
    shared=[''.join(node.itertext()) for node in roots.get('xl/sharedStrings.xml',ET.Element('empty')).findall('{%s}si'%S)]
    source_fields=original['fields']
    for field in manual:
        if not isinstance(field.get('id'),str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}',field['id']):fail('A manual native field requires a bounded identity.')
        if field['id'] in {source_field['id'] for source_field in source_fields}:fail('A manual native field cannot reuse a source-defined input identity.')
        anchor=field.get('anchor');kind=anchor.get('kind') if isinstance(anchor,dict) else None
        if anchor is None or anchor.get('sourceSha256')!=digest(data):fail('A manual native anchor must pin the complete original source hash.')
        repeated=kind in ['docx_manual_repeat_row','xlsx_manual_repeat_range']
        if field.get('type') not in (['repeat_table'] if repeated else ['text','number','integer','date','boolean']):fail('A manual native field has an unsupported scalar or repeated type.')
        check_manual_constraints(field)
        part=anchor.get('part')
        if format=='docx':
            if part not in roots or not re.fullmatch(r'word/(?:document|header\d*|footer\d*)\.xml',part or ''):fail('Select a retained Word document/header/footer XML part.')
            if kind=='docx_paragraph':exact_keys(anchor,['kind','part','paragraph','sourceText','sourceSha256'])
            elif kind=='docx_table_cell':exact_keys(anchor,['kind','part','table','row','cell','sourceText','sourceSha256'])
            elif kind=='docx_manual_repeat_row':exact_keys(anchor,['kind','part','table','row','sourceTexts','columns','sourceSha256'])
            else:fail('Select a supported reviewed Word paragraph, table cell or repeated row.')
            target=word_target(roots,anchor);plain_word_target(target)
            if kind=='docx_paragraph' and any(local(parent)=='tc' for parent in target.iterancestors()):fail('Use an exact table-cell anchor for a paragraph inside a Word table.')
            cells=child_nodes(target,'tc') if repeated else []
            actual=[word_text(cell) for cell in cells] if repeated else word_text(target)
            expected=anchor.get('sourceTexts') if repeated else anchor.get('sourceText')
            if actual!=expected:fail('The reviewed Word target text differs from the exact original.')
            if any(other['anchor'].get('part')==part and same_or_contains(target,word_target(roots,other['anchor'])) for other in source_fields):fail('A manual Word target overlaps an existing source-defined input.')
            region=[target]
            if repeated:
                if len(cells)>100 or any(local(parent)=='tbl' for parent in target.getparent().iterancestors()):fail('Manual repeated Word rows require one unnested table with at most 100 cells.')
                columns=anchor.get('columns');check_manual_columns(field,columns,'cell')
                if len(columns)!=len(cells) or {column['cell'] for column in columns}!=set(range(len(cells))):fail('Map every physical cell of the reviewed repeated row exactly once.')
            targets[field['id']]=target
        else:
            sheet_list=sheet_parts(roots)
            if part not in dict((p,n) for n,p in sheet_list) or part not in roots:fail('Select a retained worksheet XML part.')
            root=roots[part]
            if root.find('{%s}sheetProtection'%S) is not None:fail('Protected worksheets require the source owner to supply an authorized editable original.')
            if kind=='xlsx_cell':
                exact_keys(anchor,['kind','part','cell','sourceText','sourceSha256']);refs=[anchor['cell']]
                cell=reviewed_source_cell(root,anchor['cell'])
                if (cell_value(cell,shared) if cell is not None else '')!=anchor['sourceText']:fail('The reviewed workbook cell text differs from the exact original.')
            elif kind=='xlsx_manual_repeat_range':
                exact_keys(anchor,['kind','part','startRow','endRow','columns','sourceSha256']);check_manual_columns(field,anchor['columns'],'column')
                start,end=anchor['startRow'],anchor['endRow']
                if any(isinstance(v,bool) or not isinstance(v,int) for v in [start,end]) or not 1<=start<=end<=1048576 or end-start+1>500 or (end-start+1)*len(anchor['columns'])>2000:fail('A manual workbook repeated range is bounded to 500 rows and 2000 existing cells.')
                refs=[column['column']+str(row) for row in range(start,end+1) for column in anchor['columns']]
                for ref in refs:reviewed_source_cell(root,ref)
            else:fail('Select a reviewed workbook cell or fixed repeated range.')
            region=set(refs)
            rels_part=posixpath.dirname(part)+'/_rels/'+posixpath.basename(part)+'.rels'
            rels={rel.get('Id'):relationship_target(rels_part,rel.get('Target','')) for rel in roots.get(rels_part,[])}
            calculated_columns=[]
            for table_ref in root.findall('.//{%s}tablePart'%S):
                table=roots.get(rels.get(table_ref.get('{%s}id'%R)))
                if table is None:fail('A retained table relationship is missing.')
                bounds=xlsx_range(table.get('ref'))
                for offset,column in enumerate(table.findall('.//{%s}tableColumn'%S)):
                    if column.find('{%s}calculatedColumnFormula'%S) is not None:calculated_columns.append((bounds,offset+bounds[0][0]))
            for ref in refs:
                position=cell_position(ref);cell=reviewed_source_cell(root,ref)
                if cell is not None and cell.find('{%s}f'%S) is not None:fail('A manual workbook input cannot overwrite a formula.')
                if any(position[0]==column and range_contains(bounds,position) for bounds,column in calculated_columns):fail('A manual workbook input intersects a calculated table column.')
                for formula in root.findall('.//{%s}f'%S):
                    if formula.get('ref') and range_contains(xlsx_range(formula.get('ref')),position):fail('A manual workbook input intersects an array or shared formula range.')
                for merged in root.findall('.//{%s}mergeCell'%S):
                    bounds=xlsx_range(merged.get('ref'))
                    if range_contains(bounds,position) and (repeated or position!=bounds[0]):fail('A manual workbook input intersects an ambiguous merged region; use its top-left scalar cell.')
                for other in source_fields:
                    other_anchor=other['anchor']
                    if other_anchor.get('part')!=part:continue
                    if other_anchor['kind']=='xlsx_cell' and other_anchor['cell']==ref or other_anchor['kind']=='xlsx_repeat_table' and other_anchor['startRow']<=position[1]<=other_anchor['endRow'] and any(column['column']==re.match(r'[A-Z]+',ref).group(0) for column in other_anchor['columns']):fail('A manual workbook input overlaps an existing source-defined field.')
            targets[field['id']]=region
        for other_part,other_region in occupied:
            if other_part==part and (any(same_or_contains(a,b) for a in region for b in other_region) if format=='docx' else bool(region&other_region)):fail('Reviewed manual native fields overlap one another.')
        occupied.append((part,region))
    if len({field.get('id') for field in fields})!=len(fields):fail('A native definition repeats a field identity.')
    return targets

def check_manual_columns(field,columns,location):
    declared=field.get('columns')
    if not isinstance(columns,list) or not 1<=len(columns)<=100 or not isinstance(declared,list) or len(declared)!=len(columns):fail('A manual repeating input needs 1 to 100 typed source columns.')
    keys=[];locations=[]
    for column in columns:
        exact_keys(column,['key',location]);key=column['key']
        if not safe_key(key):fail('A repeated source column requires a safe bounded key.')
        if location=='cell' and (isinstance(column['cell'],bool) or not isinstance(column['cell'],int) or column['cell']<0):fail('A Word repeated column needs a physical cell index.')
        if location=='column' and not re.fullmatch(r'[A-Z]{1,3}',column['column'] or ''):fail('A workbook repeated column needs a native column letter.')
        keys.append(key);locations.append(column[location])
    if len(set(keys))!=len(keys) or len(set(locations))!=len(locations) or [column.get('key') for column in declared]!=keys or any(column.get('type','text') not in ['text','number','integer','date','boolean'] for column in declared):fail('Repeated source columns must have distinct locations, matching keys and scalar types.')
    for column in declared:check_manual_constraints(column)

def check_manual_constraints(field):
    if field.get('required') is not None and not isinstance(field['required'],bool):fail('A manual input required flag must be boolean.')
    if field.get('integer') is not None and not isinstance(field['integer'],bool):fail('A manual integer constraint must be boolean.')
    if ('minimum' in field or 'maximum' in field or field.get('integer') is True) and field.get('type','text') not in ['number','integer']:fail('Manual numeric bounds and whole-number constraints require a numeric source type.')
    for key in ['minimum','maximum']:
        if key in field and (isinstance(field[key],bool) or not isinstance(field[key],(int,float)) or not math.isfinite(field[key])):fail('Manual numeric bounds must be finite numbers.')
    if 'minimum' in field and 'maximum' in field and field['minimum']>field['maximum']:fail('Manual numeric bounds are reversed.')
    for key,limit in [('maxLength',50000),('maxRows',500),('capacity',500)]:
        if key in field and (isinstance(field[key],bool) or not isinstance(field[key],int) or not 1<=field[key]<=limit):fail('A manual source constraint exceeds its bounded native capacity.')
    if 'unit' in field and (not isinstance(field['unit'],str) or not field['unit'].strip() or len(field['unit'])>120 or re.search(r'[\x00-\x1f\x7f]',field['unit'])):fail('A manual source unit requires a bounded explicit label.')
    if 'allowedValues' in field and (not isinstance(field['allowedValues'],list) or not 1<=len(field['allowedValues'])<=100 or any(not isinstance(value,(str,int,float,bool)) or isinstance(value,(int,float)) and not math.isfinite(value) for value in field['allowedValues'])):fail('Manual allowed values must be a bounded scalar vocabulary.')

def check_manual_value(value,field):
    if value is None or value=='':
        if field.get('required'):fail('A required manual source value is missing.')
        if value is None:return
    kind=field.get('type','text')
    if kind in ['number','integer'] and (isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value)):fail('A manual numeric input requires a finite number.')
    if kind=='integer' or field.get('integer'):
        if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or int(value)!=value:fail('A manual source value requires a whole number.')
    if isinstance(value,(int,float)) and not isinstance(value,bool) and ('minimum' in field and value<field['minimum'] or 'maximum' in field and value>field['maximum']):fail('A manual source value is outside its reviewed numeric bounds.')
    if 'allowedValues' in field and not any(type(value) is type(item) and value==item or isinstance(value,(int,float)) and not isinstance(value,bool) and isinstance(item,(int,float)) and not isinstance(item,bool) and value==item for item in field['allowedValues']):fail('A manual source value is outside its reviewed vocabulary.')
    if kind=='boolean' and not isinstance(value,bool):fail('A manual boolean input requires a boolean.')
    if kind in ['text','date'] and not isinstance(value,str):fail('A manual text/date input requires scalar text.')
    if kind=='date':
        import datetime
        try:
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value):raise ValueError()
            datetime.date.fromisoformat(value)
        except Exception:fail('A manual date input requires a valid ISO date.')
    if kind=='repeat_table':
        if not isinstance(value,list) or len(value)>min(500,field.get('maxRows',500),field.get('capacity',500)):fail('A manual repeating input exceeds its reviewed row capacity.')
        keys={column['key'] for column in field['columns']}
        for row in value:
            if not isinstance(row,dict) or set(row)!=keys:fail('A manual repeated row must match every reviewed source column exactly.')
            for column in field['columns']:check_manual_value(row[column['key']],column)
    elif field.get('maxLength') and isinstance(value,str) and len(value)>field['maxLength']:fail('A manual source value exceeds its reviewed length bound.')

def preserve_text(node,value):
    node.text=value
    if value.startswith(' ') or value.endswith(' ') or '\n' in value:node.set(XML_SPACE,'preserve')
def replace_token(container,token,value,occurrence=0):
    nodes=container.findall('.//{%s}t'%W);combined=''.join(node.text or '' for node in nodes);matches=list(re.finditer(re.escape(token),combined))
    if occurrence>=len(matches):fail('A Word placeholder anchor is missing or changed.')
    match=matches[occurrence];offset=0
    for node in nodes:
        text=node.text or '';end=offset+len(text)
        if offset<match.end() and end>match.start():
            start=max(0,match.start()-offset);finish=min(len(text),match.end()-offset)
            preserve_text(node,text[:start]+(value if match.start()>=offset else '')+text[finish:])
        offset=end
def set_word_text(container,value):
    nodes=container.findall('.//{%s}t'%W)
    if not nodes:
        paragraph=container if local(container)=='p' else container.find('.//{%s}p'%W)
        if paragraph is None:paragraph=ET.SubElement(container,'{%s}p'%W)
        nodes=[ET.SubElement(ET.SubElement(paragraph,'{%s}r'%W),'{%s}t'%W)]
    for i,node in enumerate(nodes):preserve_text(node,value if i==0 else '')
def normalize_word_newlines(root):
    for node in list(root.findall('.//{%s}t'%W)):
        if '\n' not in (node.text or ''):continue
        segments=node.text.split('\n');preserve_text(node,segments[0]);parent=node.getparent();index=parent.index(node)+1
        for segment in segments[1:]:
            parent.insert(index,ET.Element('{%s}br'%W));index+=1;t=ET.Element('{%s}t'%W);preserve_text(t,segment);parent.insert(index,t);index+=1
def find_cell(root,ref,create=False):
    found=root.xpath('.//s:c[@r=$ref]',namespaces=NS,ref=ref)
    if len(found)>1:fail('The workbook contains a duplicated input cell reference.')
    if found:return found[0]
    if not create:fail('A mapped workbook input cell is missing.')
    col,row=cell_position(ref);sheet_data=root.find('{%s}sheetData'%S);rows=sheet_data.findall('{%s}row'%S);target=next((node for node in rows if node.get('r')==str(row)),None)
    if target is None:
        target=ET.Element('{%s}row'%S,r=str(row));following=next((node for node in rows if int(node.get('r'))>row),None)
        if following is None:sheet_data.append(target)
        else:sheet_data.insert(sheet_data.index(following),target)
    cell=ET.Element('{%s}c'%S,r=ref);following=next((node for node in target if local(node)=='c' and cell_position(node.get('r'))[0]>col),None)
    if following is None:target.append(cell)
    else:target.insert(target.index(following),cell)
    return cell
def set_cell(cell,value):
    if cell.find('{%s}f'%S) is not None:fail('Native population cannot overwrite a formula cell.')
    for child in list(cell):
        if local(child) in ['v','is']:cell.remove(child)
    if isinstance(value,(int,float)) and not isinstance(value,bool):
        if not math.isfinite(value):fail('Workbook numeric values must be finite.')
        cell.attrib.pop('t',None);ET.SubElement(cell,'{%s}v'%S).text=str(value)
    elif isinstance(value,bool):cell.set('t','b');ET.SubElement(cell,'{%s}v'%S).text='1' if value else '0'
    else:
        cell.set('t','inlineStr');text=ET.SubElement(ET.SubElement(cell,'{%s}is'%S),'{%s}t'%S);preserve_text(text,scalar(value))
def pdf_overlay(page,width,height,x,y,text,size):
    # Standard PDF Type1 font; all text is an inert string. No scripts/resources from templates.
    from pypdf import PdfReader
    escaped=text.replace('\\','\\\\').replace('(','\\(').replace(')','\\)')
    try:escaped=escaped.encode('cp1252')
    except UnicodeEncodeError:fail('Controlled PDF overlays currently require text representable in Windows-1252; use a DOCX source for other scripts.')
    stream=b'BT /F1 '+str(size).encode()+b' Tf 1 0 0 1 '+str(x).encode()+b' '+str(y).encode()+b' Tm ('+escaped+b') Tj ET'
    objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>'.encode(),b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',b'<< /Length '+str(len(stream)).encode()+b' >>\nstream\n'+stream+b'\nendstream']
    output=b'%PDF-1.4\n';offsets=[0]
    for index,obj in enumerate(objects,1):offsets.append(len(output));output+=str(index).encode()+b' 0 obj\n'+obj+b'\nendobj\n'
    xref=len(output);output+=b'xref\n0 6\n0000000000 65535 f \n'+b''.join(f'{v:010d} 00000 n \n'.encode() for v in offsets[1:])+f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()
    overlay=PdfReader(io.BytesIO(output));page.merge_page(overlay.pages[0])
def populate_pdf(data,fields,values):
    from pypdf import PdfWriter
    reader=pdf_reader(data);writer=PdfWriter();writer.clone_document_from_reader(reader);changes=[]
    for field in fields:
        if field['id'] not in values:continue
        value=values[field['id']];anchor=field['anchor']
        if anchor['kind']=='pdf_form':
            if isinstance(value,bool):value='/Yes' if value else '/Off'
            else:value=scalar(value)
            for page in writer.pages:writer.update_page_form_field_values(page,{anchor['key']:value},auto_regenerate=False)
        elif anchor['kind']=='pdf_overlay':
            pi=anchor.get('page',0)-1
            if pi<0 or pi>=len(writer.pages):fail('A controlled PDF overlay page is outside the retained source.')
            rect=anchor.get('rect');size=anchor.get('fontSize',10)
            if not isinstance(rect,list) or len(rect)!=4 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in rect) or not 6<=size<=36:fail('A PDF overlay requires a reviewed finite rectangle and font size.')
            x0,y0,x1,y1=rect;page=writer.pages[pi];width=float(page.mediabox.width);height=float(page.mediabox.height)
            if not(0<=x0<x1<=width and 0<=y0<y1<=height):fail('The PDF overlay rectangle is outside its page.')
            value=scalar(value);lines=value.split('\n');line_height=size*1.2
            if len(lines)*line_height>y1-y0 or any(len(line)*size*.6>x1-x0 for line in lines):fail('The proposed PDF overlay would overflow its approved rectangle.')
            for li,line in enumerate(lines):pdf_overlay(page,width,height,x0,y1-size-li*line_height,line,size)
        else:fail('Unsupported PDF anchor.')
        changes.append({'fieldId':field['id'],'anchor':anchor,'value':value,'kind':'direct'})
    output=io.BytesIO();writer.write(output);return output.getvalue(),changes

def populate(data,format,definition,values):
    original=analyze(data,format)
    if definition.get('sourceSha256')!=digest(data):fail('The mapping definition source hash differs from these exact source bytes.')
    manual_targets=manual_native_targets(data,format,definition,original)
    native={f['id']:f for f in original['fields']};fields=definition.get('fields',[])
    if not isinstance(values,dict) or len(values)>1000 or not isinstance(fields,list) or len(fields)>1000:fail('Native fields and resolved values exceed their bounded shape.')
    seen=set()
    for field in fields:
        fid=field.get('id');anchor=field.get('anchor')
        if fid in seen:fail('The definition contains a duplicate native field anchor.')
        seen.add(fid)
        if fid not in native:
            if fid not in manual_targets and (format!='pdf' or not isinstance(anchor,dict) or anchor.get('kind')!='pdf_overlay'):fail('A definition field no longer exists in the retained native source.')
        elif native[fid]['anchor']!=anchor:fail('The approved field anchor differs from the analyzed exact native source.')
        if field.get('manualNative'):
            if fid in native:fail('A manual native input cannot replace a source-defined field identity.')
            if fid in values:check_manual_value(values[fid],field)
        if field.get('required') and (fid not in values or values[fid] in [None,'',[]]):fail('A required native field has no resolved value.')
    if set(values)-seen:fail('Resolved native values include fields outside the approved definition.')
    if format=='pdf':
        output,changes=populate_pdf(data,fields,values);return {'bytes':base64.b64encode(output).decode(),'sourceSha256':digest(data),'outputSha256':digest(output),'changes':changes,'expectedExpansion':{'rowsAdded':0,'mode':'fixed_pdf_pages'},'structuralValidation':{'passed':True,'changedParts':['PDF form appearances or approved overlay streams'],'partsUnchanged':[],'preservedFeatures':{'pageGeometry':True},'requiresHumanReview':True}}
    parts,roots=open_package(data,format);changes=[];changed=set();rows_added=0;targets={}
    # Capture source nodes before any repeated row can move later paragraphs.
    for field in fields:
        anchor=field['anchor'];root=roots[anchor['part']];kind=anchor['kind']
        if kind in ['docx_paragraph','docx_table_cell','docx_manual_repeat_row']:targets[field['id']]=word_target(roots,anchor)
        elif kind=='docx_placeholder':targets[field['id']]=root.findall('.//{%s}p'%W)[anchor['paragraph']]
        elif kind=='docx_content_control':targets[field['id']]=root.findall('.//{%s}sdt'%W)[anchor['index']]
        elif kind=='docx_bookmark':targets[field['id']]=root.findall('.//{%s}bookmarkStart'%W)[anchor['index']]
        elif kind=='docx_repeat_row':
            table=root.findall('.//{%s}tbl'%W)[anchor['table']];targets[field['id']]=(table,child_nodes(table,'tr')[anchor['row']])
    # Descending source positions keep table and paragraph identities stable while rows expand.
    sortkey=lambda f:(f['anchor'].get('part',''),f['anchor'].get('table',-1),f['anchor'].get('row',-1),f['anchor'].get('paragraph',-1),f['anchor'].get('occurrence',-1))
    for field in sorted(fields,key=sortkey,reverse=True):
        fid=field['id']
        if fid not in values:continue
        value=values[fid];anchor=field['anchor'];part=anchor['part'];root=roots[part];kind=anchor['kind']
        if field.get('allowedValues') and value not in field['allowedValues']:fail('The resolved value is outside the native source allowed values.')
        if kind=='docx_manual_repeat_row':
            row=targets[fid];table=row.getparent();at=table.index(row)
            for item in value:
                clone=copy.deepcopy(row);cells=child_nodes(clone,'tc')
                for column in anchor['columns']:set_word_text(cells[column['cell']],scalar(item[column['key']]))
                table.insert(at,clone);at+=1
            table.remove(row);rows_added+=len(value)-1
            changes.append({'fieldId':fid,'anchor':anchor,'kind':'repeat_table','originalRows':1,'generatedRows':len(value),'columns':[c['key'] for c in field['columns']],'rows':value})
        elif kind in ['docx_paragraph','docx_table_cell']:
            set_word_text(targets[fid],scalar(value));changes.append({'fieldId':fid,'anchor':anchor,'kind':'direct','value':scalar(value)})
        elif kind=='docx_repeat_row':
            if not isinstance(value,list) or len(value)>500:fail('A native repeated table requires at most 500 typed rows.')
            table,row=targets[fid];at=table.index(row)
            for item in value:
                if not isinstance(item,dict):fail('Each repeated row must be a typed object keyed by the detected columns.')
                clone=copy.deepcopy(row)
                for p in clone.findall('.//{%s}p'%W):
                    matches=list(TOKEN.finditer(word_text(p)))
                    for match in reversed(matches):
                        key=match.group(1).split('.',1)[1]
                        if key not in item:fail('A repeated native row is missing a detected column value: '+key)
                        replace_token(p,match.group(0),scalar(item[key]))
                # Existing bookmark/content-control identities must remain unique after expansion.
                if clone.findall('.//{%s}bookmarkStart'%W) or clone.findall('.//{%s}sdt'%W):fail('Repeating rows containing native bookmark/control IDs need an explicit identity adapter.')
                table.insert(at,clone);at+=1
            table.remove(row);rows_added+=len(value)-1
            changes.append({'fieldId':fid,'anchor':anchor,'kind':'repeat_table','originalRows':1,'generatedRows':len(value),'columns':[c['key'] for c in field['columns']],'rows':value})
        elif kind=='docx_placeholder':
            p=targets[fid];matches=list(TOKEN.finditer(word_text(p)));index=anchor['occurrence']
            if index>=len(matches) or matches[index].group(1)!=anchor['key']:fail('A Word run placeholder is missing or changed.')
            match=matches[index];same=sum(1 for prior in matches[:index] if prior.group(0)==match.group(0));replace_token(p,match.group(0),scalar(value),same)
            changes.append({'fieldId':fid,'anchor':anchor,'kind':'direct','value':scalar(value)})
        elif kind=='docx_content_control':
            control=targets[fid];content=control.find('{%s}sdtContent'%W)
            if content is None:fail('The native content control has no editable content.')
            set_word_text(content,scalar(value));changes.append({'fieldId':fid,'anchor':anchor,'kind':'direct','value':scalar(value)})
        elif kind=='docx_bookmark':
            start=targets[fid];parent=start.getparent();end=parent.xpath('./w:bookmarkEnd[@w:id=$identifier]',namespaces=NS,identifier=anchor['bookmarkId'])[0]
            between=list(parent)[parent.index(start)+1:parent.index(end)]
            run=next((node for node in between if local(node)=='r'),None)
            if run is None:run=ET.Element('{%s}r'%W);parent.insert(parent.index(start)+1,run)
            set_word_text(run,scalar(value))
            for node in between:
                if node is not run:
                    for t in node.findall('.//{%s}t'%W):t.text=''
            changes.append({'fieldId':fid,'anchor':anchor,'kind':'direct','value':scalar(value)})
        elif kind=='xlsx_cell':
            cell=find_cell(root,anchor['cell'],field.get('manualNative') is True);actual=value
            if anchor.get('token'):actual=anchor['sourceText'].replace(anchor['token'],scalar(value)) if anchor['sourceText']!=anchor['token'] else value
            set_cell(cell,actual);changes.append({'fieldId':fid,'anchor':anchor,'kind':'direct','value':actual})
        elif kind in ['xlsx_repeat_table','xlsx_manual_repeat_range']:
            if not isinstance(value,list) or len(value)>min(500,anchor['endRow']-anchor['startRow']+1):fail('Repeated workbook data exceeds the original table input capacity; extend the source template explicitly.')
            for offset,rownum in enumerate(range(anchor['startRow'],anchor['endRow']+1)):
                item=value[offset] if offset<len(value) else {}
                if not isinstance(item,dict):fail('Each workbook table row must be a typed object.')
                for col in anchor['columns']:
                    if offset<len(value) and col['key'] not in item:fail('A repeated workbook row is missing a mapped column value.')
                    cell=find_cell(root,col['column']+str(rownum),True);set_cell(cell,item.get(col['key'],''))
            changes.append({'fieldId':fid,'anchor':anchor,'kind':'repeat_table','originalRows':anchor['endRow']-anchor['startRow']+1,'generatedRows':len(value),'capacity':anchor['endRow']-anchor['startRow']+1,'mode':'fixed_table_capacity','rows':value})
        else:fail('Unsupported native field anchor.')
        changed.add(part)
    for part in changed:
        if format=='docx':normalize_word_newlines(roots[part])
        parts[part]=xml_bytes(roots[part])
    calculation_policy=None
    if format=='xlsx' and changed:
        invalidated=0
        for part,root in roots.items():
            if not re.fullmatch(r'xl/worksheets/[^/]+\.xml',part):continue
            formula_cells=[cell for cell in root.findall('.//{%s}c'%S) if cell.find('{%s}f'%S) is not None]
            if not formula_cells:continue
            for cell in formula_cells:
                cached=cell.find('{%s}v'%S)
                if cached is not None:cell.remove(cached);invalidated+=1
            changed.add(part);parts[part]=xml_bytes(root)
        workbook=roots['xl/workbook.xml'];settings=workbook.find('{%s}calcPr'%S)
        if settings is None:settings=ET.SubElement(workbook,'{%s}calcPr'%S)
        for key,value in {'calcMode':'auto','fullCalcOnLoad':'1','forceFullCalc':'1'}.items():settings.set(key,value)
        changed.add('xl/workbook.xml');parts['xl/workbook.xml']=xml_bytes(workbook)
        calculation_policy={'formulaExpressionsPreserved':True,'invalidatedCachedValues':invalidated,'calcMode':'auto','fullCalcOnLoad':True,'forceFullCalc':True,'meaning':'Prior cached formula results were removed after native inputs changed. Editable clients must calculate the retained original expressions; the pinned PDF renderer performs a hard recalculation.'}
    output=io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as source,zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as target:
        for item in source.infolist():
            info=copy.copy(item);target.writestr(info,parts[item.filename])
    output=output.getvalue();after=analyze(output,format)
    unchanged=[{'name':p['name'],'sha256':p['sha256']} for p in original['parts'] if p['name'] not in changed]
    after_parts={p['name']:p for p in after['parts']}
    if any(after_parts[p['name']]['sha256']!=p['sha256'] for p in unchanged):fail('Native output unexpectedly modified a package member outside its bindings.')
    preserved={'unaffectedPackageMembers':True}
    if format=='docx':
        if original['structure']['pageSettings']!=after['structure']['pageSettings']:fail('Native population unexpectedly modified Word section/page configuration.')
        preserved.update({'styles':True,'headersFooters':not any(re.search('header|footer',part) for part in changed),'pageConfiguration':True,'graphics':True})
    else:
        before_static=copy.deepcopy(original['structure']);after_static=copy.deepcopy(after['structure'])
        for structure in [before_static,after_static]:
            for sheet in structure['sheets']:sheet.pop('cells',None)
        if before_static!=after_static:fail('Native population unexpectedly changed workbook formulas, merges, names, validations, charts or print configuration.')
        preserved.update({'formulas':True,'merges':True,'namedRanges':True,'validations':True,'charts':True,'printConfiguration':True,'styles':True})
    return {'bytes':base64.b64encode(output).decode(),'sourceSha256':digest(data),'outputSha256':digest(output),'changes':changes,'calculationPolicy':calculation_policy,'expectedExpansion':{'rowsAdded':rows_added,'mode':'content_driven_docx_rows' if format=='docx' else 'fixed_workbook_input_capacity','humanPageExpansionReviewRequired':True},'structuralValidation':{'passed':True,'changedParts':sorted(changed),'partsUnchanged':unchanged,'preservedFeatures':preserved,'fieldCount':len(changes),'requiresHumanReview':True}}

def pdf_layout(path,bounding_boxes=''):
    with open(path,'rb') as source:reader=pdf_reader(source.read())
    pages=[];fonts=set()
    for index,page in enumerate(reader.pages):
        resources=page.get('/Resources',{});resources=resources.get_object() if hasattr(resources,'get_object') else resources
        for ref in resources.get('/Font',{}).values():
            font=ref.get_object();fonts.add(str(font.get('/BaseFont','Unknown')))
        width=float(page.mediabox.width);height=float(page.mediabox.height)
        pages.append({'page':index+1,'width':width,'height':height})
    if bounding_boxes:
        document=parse(re.sub(r'<!DOCTYPE[^>]*>','',bounding_boxes).encode());bbox_pages=document.xpath('//*[local-name()="page"]')
        for page,bbox in zip(pages,bbox_pages):page['words']=[{'text':node.text or '',**{key:float(node.get(key,'0')) for key in ['xMin','yMin','xMax','yMax']}} for node in bbox.xpath('.//*[local-name()="word"]')]
    return {'pages':pages,'fonts':sorted(fonts)}
def visual_diff(input):
    from PIL import Image, ImageChops, ImageDraw
    directory=input['directory'];original=input['originalLayout']['pages'];generated=input['generatedLayout']['pages'];pages=[];total=0
    for index in range(max(len(original),len(generated))):
        number=index+1;a=os.path.join(directory,f'original-{number}.png');b=os.path.join(directory,f'generated-{number}.png')
        image_a=Image.open(a).convert('RGB') if os.path.exists(a) else None;image_b=Image.open(b).convert('RGB') if os.path.exists(b) else None
        width=max(image_a.width if image_a else 0,image_b.width if image_b else 0);height=max(image_a.height if image_a else 0,image_b.height if image_b else 0)
        if width*height>4000000:fail('A native visual comparison page exceeds its pixel limit.')
        canvas_a=Image.new('RGB',(width,height),'white');canvas_b=Image.new('RGB',(width,height),'white')
        if image_a:canvas_a.paste(image_a,(0,0))
        if image_b:canvas_b.paste(image_b,(0,0))
        difference=ImageChops.difference(canvas_a,canvas_b);mask=difference.convert('L').point(lambda value:255 if value>12 else 0);changed=sum(mask.histogram()[1:]);total+=changed
        expected_mask=Image.new('L',(width,height),0);draw=ImageDraw.Draw(expected_mask)
        phrase_cache=set();word_cache={}
        def mark_phrase(words,phrase):
            tokens=str(phrase).split()
            if not tokens:return
            target=re.sub(r'\s+','',str(phrase));cache_key=(id(words),target,len(tokens))
            if cache_key in phrase_cache:return
            phrase_cache.add(cache_key)
            if id(words) not in word_cache:word_cache[id(words)]=[re.sub(r'\s+','',word['text']) for word in words]
            keys=word_cache[id(words)]
            for at in range(len(words)):
                joined=''
                for length in range(1,min(len(words)-at,len(tokens)+4)+1):
                    joined+=keys[at+length-1]
                    # Appending further source characters cannot repair a
                    # mismatching prefix. This preserves the exact comparison.
                    if not target.startswith(joined):break
                    if target==joined:
                        for word in words[at:at+length]:draw.rectangle((math.floor(word['xMin'])-2,math.floor(word['yMin'])-2,math.ceil(word['xMax'])+2,math.ceil(word['yMax'])+2),fill=255)
                        break
        source_words=original[index].get('words',[]) if index<len(original) else []
        generated_words=generated[index].get('words',[]) if index<len(generated) else []
        for change in input.get('changes',[]):
            anchor=change['anchor']
            if anchor.get('token'):mark_phrase(source_words,anchor['token'])
            elif change['kind']=='repeat_table':
                for column in change.get('columns',anchor.get('columns',[])):
                    key=column.get('key') if isinstance(column,dict) else column
                    mark_phrase(source_words,'{{'+anchor.get('group','')+'.'+key+'}}')
            for value in ([change.get('value')] if change['kind']!='repeat_table' else [v for row in change.get('rows',[]) for v in row.values()]):
                if value is not None:mark_phrase(generated_words,value)
        expected_changed=ImageChops.multiply(mask,expected_mask);expected_pixels=sum(expected_changed.histogram()[1:])
        unexpected_mask=ImageChops.subtract(mask,expected_changed);unexpected_pixels=changed-expected_pixels
        overlay=canvas_b.copy();red=Image.new('RGB',(width,height),(230,40,55));overlay.paste(Image.blend(canvas_b,red,.65),mask=unexpected_mask)
        filename=f'diff-{number}.png';overlay.save(os.path.join(directory,filename))
        pages.append({'page':number,'file':filename,'width':width,'height':height,'changedPixels':changed,'expectedContentPixels':expected_pixels,'unexpectedChangedPixels':unexpected_pixels,'changedRatio':changed/(width*height),'differenceBounds':mask.getbbox(),'unexpectedDifferenceBounds':unexpected_mask.getbbox(),'classification':'remaining_layout_changes_require_review' if unexpected_pixels else 'expected_content_change' if changed else 'unchanged','originalPageAvailable':image_a is not None,'populatedPageAvailable':image_b is not None})
    font_changes=sorted(set(input['generatedLayout']['fonts'])-set(input['originalLayout']['fonts']))
    geometry_changed=any(a['width']!=b['width'] or a['height']!=b['height'] for a,b in zip(original,generated))
    return {'pages':pages,'totalChangedPixels':total,'originalPageCount':len(original),'populatedPageCount':len(generated),'pageCountChange':len(generated)-len(original),'fontChanges':font_changes,'pageGeometryChanged':geometry_changed,'automatedStructuralPass':input.get('structure',{}).get('passed',False),'expectedContentChanges':len(input.get('changes',[])),'unexpectedLayoutStatus':'requires_human_classification','meaning':'Red highlights exclude differences inside matched source placeholders and inserted value text boxes. Remaining differences include possible layout defects and legitimate downstream table growth, which must be classified during human review against the explicit row-expansion receipt. No page growth or pixel change is automatically approved.'}

try:
    with open(sys.argv[1],encoding='utf8') as request: input=json.load(request)
    operation=input.get('operation')
    if operation=='pdf-layout':result=pdf_layout(input['path'],input.get('boundingBoxes',''))
    elif operation=='diff':result=visual_diff(input)
    else:
        data=base64.b64decode(input['bytes'],validate=True)
        if operation=='analyze':result=analyze(data,input['format'])
        elif operation=='validate-fields':
            targets=manual_native_targets(data,input['format'],input['definition'])
            result={'sourceSha256':digest(data),'validatedManualFieldIds':list(targets),'humanMappingApprovalRequired':True}
        elif operation=='populate':result=populate(data,input['format'],input['definition'],input.get('resolvedValues',{}))
        else:fail('Unsupported native adapter operation.')
    print(json.dumps(result,ensure_ascii=False))
except Exception as error:
    print(json.dumps({'error':str(error)[:500] or type(error).__name__,'status':422}));sys.exit(1)
