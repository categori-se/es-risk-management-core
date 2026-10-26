// Original application-authored thirteen-section monitoring source. No institutional source text.
import {deflateRawSync} from 'node:zlib';

const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n;});
const crc32=bytes=>{let c=-1;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^-1)>>>0;};
export function createNativeOfficePackage(parts){
  const chunks=[],directory=[];let offset=0;
  for(const[name,value]of Object.entries(parts)){
    const filename=Buffer.from(name),bytes=Buffer.isBuffer(value)?value:Buffer.from(value),compressed=deflateRawSync(bytes),crc=crc32(bytes),local=Buffer.alloc(30),central=Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(filename.length,26);
    central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(8,10);central.writeUInt32LE(crc,16);central.writeUInt32LE(compressed.length,20);central.writeUInt32LE(bytes.length,24);central.writeUInt16LE(filename.length,28);central.writeUInt32LE(offset,42);
    chunks.push(local,filename,compressed);directory.push(central,filename);offset+=local.length+filename.length+compressed.length;
  }
  const central=Buffer.concat(directory),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(parts).length,8);end.writeUInt16LE(Object.keys(parts).length,10);end.writeUInt32LE(central.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...chunks,central,end]);
}
const w='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const p=(text,style='Normal')=>`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t>${String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}</w:t></w:r></w:p>`;
const cell=text=>`<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:shd w:fill="EEF4F1"/></w:tcPr>${p(text)}</w:tc>`;
const actionTable=group=>`<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8" w:color="2C5A45"/><w:left w:val="single" w:sz="8" w:color="2C5A45"/><w:bottom w:val="single" w:sz="8" w:color="2C5A45"/><w:right w:val="single" w:sz="8" w:color="2C5A45"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid><w:tr><w:trPr><w:tblHeader/></w:trPr>${['Commitment','Accountable owner','Progress'].map(cell).join('')}</w:tr><w:tr>${['description','owner','status'].map(key=>cell(`{{${group}.${key}}}`)).join('')}</w:tr></w:tbl>`;
export function createClientTemplateDocx(body,{header='E&S Review · practitioner monitoring report',footer='Confidential · professional review required before issue'}={}){
  const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${w}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rHeader"/><w:footerReference w:type="default" r:id="rFooter"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567"/></w:sectPr></w:body></w:document>`;
  return createNativeOfficePackage({
    '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rDoc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':document,
    'word/_rels/document.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
    'word/styles.xml':`<?xml version="1.0"?><w:styles xmlns:w="${w}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Liberation Sans" w:hAnsi="Liberation Sans"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="220" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="24503C"/><w:sz w:val="30"/></w:rPr></w:style></w:styles>`,
    'word/header1.xml':`<?xml version="1.0"?><w:hdr xmlns:w="${w}">${p(header)}</w:hdr>`,
    'word/footer1.xml':`<?xml version="1.0"?><w:ftr xmlns:w="${w}">${p(footer)}</w:ftr>`
  });
}
export function genericMonitoringDocx(){
  const sections=[['Report administration','Project: {{project_name}} · Period: {{monitoring_period}}'],['Executive summary','{{executive_summary}}'],['Project context','{{project_context}}'],['Scope and methodology','{{scope_methodology}}'],['Applicable requirements','{{applicable_requirements}}'],['E&S performance','{{performance_summary}}'],['ESAP and corrective actions',null],['Environmental monitoring','{{environmental_monitoring}}'],['Social monitoring','{{social_monitoring}}'],['Stakeholder engagement','{{stakeholder_engagement}}'],['Incidents and material changes','{{incident_summary}}'],['Conclusions and recommendations','{{conclusions}}'],['Annexes and evidence','{{evidence_register}}']];
  return createClientTemplateDocx(p('Environmental and social monitoring report','Heading1')+sections.map(([title,text],index)=>p(`${index+1}. ${title}`,'Heading1')+(text?p(text):actionTable('actions'))).join(''));
}
export const genericMonitoringTemplateSource=()=>({filename:"generic-monitoring.docx",mediaType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",bytes:genericMonitoringDocx()});

export const nativeWordParagraph=p,nativeActionTable=actionTable;
