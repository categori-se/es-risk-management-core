import {inspectSource, sourceIntakeMaxBytes, sourceIntakeHtmlParseBytes} from "./source-intake.mjs";
import {buildSpatialPreview, isSpatialSource} from "./spatial-preview.mjs";
import {runPdfTool} from "./pdf-tools.mjs";
import {buildOfficePreview, isOfficeSource} from "./office-preview.mjs";
import {createHash} from "node:crypto";
import {indexEngagementSources, engagementExtractorVersion, engagementIndexLimits} from "./engagement-assistance.mjs";

export const documentPreviewLimits = Object.freeze({bytes: 64 * 1024 * 1024, imageDimension: 1200, text: 6000,
  rasterInlineBytes: 8 * 1024 * 1024, rasterDimension: 16384, rasterPixels: 32 * 1024 * 1024,
  tableBytes: 256 * 1024, rows: 200, columns: 40, cellCharacters: 2000, tableCharacters: 128_000});
const fail = message => Object.assign(new Error(message), {status: 400});
const clean = text => text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ");
function requestedPage(value) {
  const page = typeof value === "string" && /^[1-9][0-9]*(?![\s\S])/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(page) || page < 1) throw fail("Choose a positive, whole PDF page number.");
  return page;
}

const crcTable=Array.from({length:256},(_,index)=>{let value=index;for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
const crc32=bytes=>{let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;};
function rasterType(bytes){
  if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";
  if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return "image/jpeg";
  if(bytes.length>=12&&bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP")return "image/webp";
  return null;
}
// Structural sniffing never executes a decoder or extracts private EXIF fields.
// Browsers decode only a bounded, static raster through an <img> data URL.
function rasterDimensions(bytes,type){
  if(type==="image/png"){
    let at=8,dimensions,idat=false;
    for(let chunks=0;at+12<=bytes.length&&chunks<10000;chunks++){
      const size=bytes.readUInt32BE(at),end=at+12+size;if(end>bytes.length)return null;
      const kind=bytes.toString("ascii",at+4,at+8);if(!/^[A-Za-z]{4}$/.test(kind)||crc32(bytes.subarray(at+4,end-4))!==bytes.readUInt32BE(end-4)||["acTL","fcTL","fdAT"].includes(kind))return null;
      if(at===8){if(kind!=="IHDR"||size!==13||![1,2,4,8,16].includes(bytes[at+16])||![0,2,3,4,6].includes(bytes[at+17])||bytes[at+18]!==0||bytes[at+19]!==0||![0,1].includes(bytes[at+20]))return null;dimensions={width:bytes.readUInt32BE(at+8),height:bytes.readUInt32BE(at+12)};}
      else if(kind==="IHDR")return null;
      if(kind==="IDAT"&&size)idat=true;
      if(kind==="IEND")return size===0&&end===bytes.length&&idat?dimensions:null;
      at=end;
    }
    return null;
  }
  if(type==="image/jpeg"){
    if(bytes.length<12||bytes[bytes.length-2]!==255||bytes.at(-1)!==217)return null;
    let at=2,dimensions,scan=false;
    for(let markers=0;at<bytes.length&&markers<10000;markers++){
      if(bytes[at++]!==255)return null;while(bytes[at]===255)at++;const marker=bytes[at++];
      if(marker===217)return scan?dimensions:null;
      if(marker===0||marker===216)return null;
      if(marker===1||marker>=208&&marker<=215)continue;
      if(at+2>bytes.length)return null;const size=bytes.readUInt16BE(at);if(size<2||at+size>bytes.length)return null;
      if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(size<8)return null;const frame={height:bytes.readUInt16BE(at+3),width:bytes.readUInt16BE(at+5)};if(dimensions&&(dimensions.width!==frame.width||dimensions.height!==frame.height))return null;dimensions=frame;}
      at+=size;
      if(marker===218){scan=true;while(at<bytes.length){if(bytes[at]!==255){at++;continue;}const next=bytes[at+1];if(next===0||next>=208&&next<=215){at+=2;continue;}if(next===255){at++;continue;}break;}}
    }
    return null;
  }
  if(type==="image/webp"){
    if(bytes.readUInt32LE(4)+8!==bytes.length)return null;
    let at=12,dimensions,frame=false;
    for(let chunks=0;at+8<=bytes.length&&chunks<10000;chunks++){
      const kind=bytes.toString("ascii",at,at+4),size=bytes.readUInt32LE(at+4),start=at+8,end=start+size;if(end>bytes.length||["ANIM","ANMF"].includes(kind))return null;
      if(kind==="VP8X"){if(size!==10||bytes[start]&2)return null;dimensions={width:1+bytes.readUIntLE(start+4,3),height:1+bytes.readUIntLE(start+7,3)};}
      let frameDimensions;
      if(kind==="VP8 "){if(size<10||!bytes.subarray(start+3,start+6).equals(Buffer.from([157,1,42])))return null;frameDimensions={width:bytes.readUInt16LE(start+6)&16383,height:bytes.readUInt16LE(start+8)&16383};}
      if(kind==="VP8L"){if(size<5||bytes[start]!==47)return null;const bits=bytes.readUInt32LE(start+1);frameDimensions={width:1+(bits&16383),height:1+((bits>>>14)&16383)};}
      if(frameDimensions){if(frame||dimensions&&(dimensions.width!==frameDimensions.width||dimensions.height!==frameDimensions.height))return null;frame=true;dimensions=frameDimensions;}
      at=end+(size&1);
    }
    return at===bytes.length&&frame?dimensions:null;
  }
  return null;
}

// Parse only a bounded excerpt. Cells are inert strings, including formula-like
// values; there is no spreadsheet evaluation or assumed header row.
function delimitedTable(bytes, delimiter, name) {
  const text = clean(bytes.subarray(0, documentPreviewLimits.tableBytes).toString("utf8").replace(/^\uFEFF/, ""));
  const rows = []; let row = [], value = "", quoted = false, truncated = bytes.length > documentPreviewLimits.tableBytes, characters = 0;
  const cell = () => {
    if (row.length < documentPreviewLimits.columns) {
      const remaining = Math.max(0, documentPreviewLimits.tableCharacters - characters), bounded = value.slice(0, remaining);
      row.push(bounded); characters += bounded.length; if (bounded.length < value.length) truncated = true;
    } else truncated = true;
    value = "";
  };
  const finish = () => {cell(); if (rows.length < documentPreviewLimits.rows) rows.push(row); else truncated = true; row = [];};
  for (let at = 0; at < text.length; at++) {
    const character = text[at];
    if (character === '"') {
      if (quoted && text[at + 1] === '"') {if (value.length < documentPreviewLimits.cellCharacters) value += '"'; else truncated = true; at++;}
      else if (quoted || value === "") quoted = !quoted;
      else if (value.length < documentPreviewLimits.cellCharacters) value += character; else truncated = true;
    } else if (!quoted && character === delimiter) cell();
    else if (!quoted && (character === "\n" || character === "\r")) {
      finish(); if (character === "\r" && text[at + 1] === "\n") at++;
      if (rows.length === documentPreviewLimits.rows && at < text.length - 1) {truncated = true; break;}
    } else if (value.length < documentPreviewLimits.cellCharacters) value += character; else truncated = true;
  }
  if (value || row.length) finish();
  if (quoted) truncated = true;
  return {name, rows, delimiter, truncated};
}

function inspectOriginal(bytes, version, inspect) {
  const large = bytes.length > sourceIntakeMaxBytes;
  const isPdf = bytes.subarray(0, 5).toString() === "%PDF-";
  // Archive originals can exceed the intake limit. PDF metadata still reads the
  // complete exact original; other formats inspect a bounded inert excerpt.
  const sample = large ? bytes.subarray(0, isPdf ? 5 : sourceIntakeHtmlParseBytes) : bytes;
  const inspected = inspect({filename: version.filename, mediaType: version.mediaType, contentBase64: sample.toString("base64")}, large && isPdf ? {
    pdfInfo: (command, args, options) => runPdfTool(command, args, {...options, input: bytes, maxInputBytes: documentPreviewLimits.bytes})
  } : undefined);
  if (large) {
    inspected.metadata.extraction.sourceSha256 = version.sha256;
    if (!isPdf) inspected.metadata.extraction.warnings.push("This preview inspects a bounded excerpt of the original. Download the exact original for its complete content.");
  }
  return inspected;
}

/** Ephemeral derivatives of hash-verified originals; no source URL is fetched. */
export async function buildDocumentPreview({bytes, version}, {page = 1, raster = runPdfTool, inspect = inspectSource} = {}) {
  page = requestedPage(page);
  if (!(bytes instanceof Uint8Array) || bytes.length > documentPreviewLimits.bytes) throw Object.assign(new Error("Document previews support originals up to 64 MiB."), {status: 413});
  bytes = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!version || version.size !== bytes.length || createHash("sha256").update(bytes).digest("hex") !== version.sha256) throw Object.assign(new Error("The retained preview size or SHA256 does not match its exact source version."), {status: 409});
  const identity = {versionId: version.id, sha256: version.sha256, filename: version.filename, mediaType: version.mediaType, size: version.size};
  const isPdf = bytes.subarray(0, 5).toString() === "%PDF-";
  if (!isPdf && page !== 1) throw fail("Page selection is available for PDF documents.");
  const type=rasterType(bytes),claimedImage=/^image\/(?:png|jpe?g|webp|svg\+xml)(?:;|$)/i.test(version.mediaType||"")||/\.(?:png|jpe?g|webp|svg)$/i.test(version.filename||"");
  if(!isPdf&&(type||claimedImage)){
    if(version.size!==bytes.length||createHash("sha256").update(bytes).digest("hex")!==version.sha256)throw Object.assign(new Error("The retained image size or SHA256 does not match its source version."),{status:409});
    const limits={inlineBytes:documentPreviewLimits.rasterInlineBytes,maximumDimension:documentPreviewLimits.rasterDimension,maximumPixels:documentPreviewLimits.rasterPixels};
    const result={...identity,kind:"unsupported",text:"",detected:{mediaType:type},warnings:[],previewProvenance:{method:"exact-retained-raster",sourceSha256:version.sha256,detectedMediaType:type,status:"unavailable",limits}};
    if(bytes.length>limits.inlineBytes){result.warnings.push("Images over 8 MiB are not inlined. Download the exact retained original to inspect this photograph.");return result;}
    const dimensions=type?rasterDimensions(bytes,type):null;
    if(!dimensions||dimensions.width<1||dimensions.height<1||dimensions.width>limits.maximumDimension||dimensions.height>limits.maximumDimension||dimensions.width*dimensions.height>limits.maximumPixels){result.warnings.push("A bounded static PNG, JPEG or WebP could not be verified. SVG, animated, malformed and oversized rasters are not displayed; download the exact original for deliberate inspection.");return result;}
    Object.assign(result,{kind:"image",imageDataUrl:`data:${type};base64,${bytes.toString("base64")}`,imageDescription:"Exact retained source photograph. Original bytes and embedded metadata remain unchanged."});
    Object.assign(result.previewProvenance,{...dimensions,status:"retained_original"});result.detected={mediaType:type,...dimensions};
    if((version.mediaType||"").toLowerCase().split(";")[0]!==type)result.warnings.push("The raster MIME type was identified from retained bytes; the recorded source media type remains unchanged.");
    result.warnings.push("This preview includes exact original bytes. Embedded EXIF, GPS or other metadata is neither extracted nor removed; the photograph is not anonymized.");return result;
  }
  if (!isPdf && isOfficeSource(version)) {
    const office = await buildOfficePreview(bytes, version);
    return {...identity, ...office, previewProvenance: {...office.previewProvenance, sourceSha256: version.sha256}};
  }
  if (!isPdf && isSpatialSource({bytes, filename: version.filename, mediaType: version.mediaType})) {
    const spatial = await buildSpatialPreview(bytes, {filename: version.filename, mediaType: version.mediaType});
    return {...identity, kind: "spatial", text: "", detected: {}, warnings: spatial.warnings || [], spatial};
  }
  const inspected = inspectOriginal(bytes, version, inspect);
  const result = {...identity, kind: isPdf ? "pdf" : inspected.preview ? "text" : "unsupported",
    text: inspected.preview, detected: inspected.detected, extraction: inspected.metadata.extraction,
    warnings: [...inspected.metadata.extraction.warnings]};
  if (isPdf) {
    const count = Number(inspected.detected?.pageCount);
    const pageCount = Number.isSafeInteger(count) && count > 0 ? count : null;
    if (pageCount !== null && page > pageCount) throw fail(`This PDF contains ${pageCount} ${pageCount === 1 ? "page" : "pages"}. Choose a page within that range.`);
    result.pageNumber = page; result.pageCount = pageCount;
    result.previewProvenance = {method: "poppler-pdftoppm", sourceSha256: version.sha256, pageNumber: page, pageCount, maximumDimension: documentPreviewLimits.imageDimension, status: "unavailable"};
    if (pageCount === null) result.warnings.push("The PDF page count could not be determined on this device.");
    try {
      const png = Buffer.from(raster("pdftoppm", ["-f", String(page), "-singlefile", "-scale-to", String(documentPreviewLimits.imageDimension), "-png", "-"], {
        input: bytes, ...(bytes.length > sourceIntakeMaxBytes ? {maxInputBytes: documentPreviewLimits.bytes} : {}), timeout: 8000, maxBuffer: 6 * 1024 * 1024, windowsHide: true, stdio: ["pipe", "pipe", "pipe"]
      }));
      if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
          png.readUInt32BE(16) < 1 || png.readUInt32BE(20) < 1 || png.readUInt32BE(16) > documentPreviewLimits.imageDimension || png.readUInt32BE(20) > documentPreviewLimits.imageDimension) throw new Error("Invalid bounded raster.");
      result.imageDataUrl = `data:image/png;base64,${png.toString("base64")}`;
      result.imageDescription = `${page === 1 ? "First page" : `Page ${page}`} of the exact retained PDF. Raster preview; the original remains unchanged.`;
      Object.assign(result.previewProvenance, {status: "rendered", width: png.readUInt32BE(16), height: png.readUInt32BE(20)});
    } catch {result.warnings.push(`A ${page === 1 ? "first-page" : `page ${page}`} PDF image could not be generated on this device. Download the original for its complete content.`);}
  } else if (inspected.mediaType !== "text/html" && (/\.(csv|tsv)$/i.test(version.filename) || /^(text\/(?:csv|tab-separated-values)|application\/csv)$/.test(inspected.mediaType))) {
    const delimiter = /\.tsv$/i.test(version.filename) || inspected.mediaType === "text/tab-separated-values" ? "\t" : ",";
    const table = delimitedTable(bytes, delimiter, version.filename);
    result.kind = "table"; result.tables = [table]; result.text = table.rows.map(row => row.join("\t")).join("\n").slice(0, documentPreviewLimits.text);
    if (table.truncated) result.warnings.push("The table preview is limited to 200 rows, 40 columns and a bounded text excerpt. The original contains the complete data.");
    result.warnings.push("Table values and formula-like cells are displayed as text; formulas are not evaluated.");
  } else if (result.kind === "text" && (bytes.length > 24_000 || result.text.length === documentPreviewLimits.text)) {
    result.warnings.push("This text preview is a bounded excerpt. Download the exact original for its complete content.");
  }
  return result;
}

export const documentPassagePreviewLimits = Object.freeze({quoteCharacters:30000,locatorCharacters:4000,contextCharacters:1000,maxChoices:12,maxExcerptCharacters:32000});
const passageFail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const plainObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function normalizeDocumentPassageRequest(value){
 if(!plainObject(value)||Object.keys(value).some(key=>!['expectedSha256','anchor'].includes(key))||!/^[a-f0-9]{64}$/.test(value.expectedSha256||'')||!plainObject(value.anchor))passageFail('Choose the exact retained source SHA256 and a quoted passage.');
 const a=value.anchor,allowed=['quote','locator','page','range','extractorVersion'];if(Object.keys(a).some(key=>!allowed.includes(key))||typeof a.quote!=='string'||!a.quote.trim()||a.quote.length>documentPassagePreviewLimits.quoteCharacters||a.locator!==undefined&&(typeof a.locator!=='string'||a.locator.length>4000)||a.page!==undefined&&a.page!==null&&(!Number.isSafeInteger(a.page)||a.page<1)||a.extractorVersion!==undefined&&(typeof a.extractorVersion!=='string'||a.extractorVersion.length>200))passageFail('Use a bounded exact quote, source page and retained extraction context.');
 if(a.range!==undefined){const r=a.range;if(!plainObject(r)||Object.keys(r).length!==3||Object.keys(r).some(key=>!['start','end','basis'].includes(key))||r.basis!=='extracted_text_utf16_code_units'||!Number.isSafeInteger(r.start)||r.start<0||!Number.isSafeInteger(r.end)||r.end<=r.start||r.end-r.start!==a.quote.length)passageFail('The passage range must match the exact quote in extracted UTF-16 text.');}
 return structuredClone(value);
}

/** A foreground read of one exact original, using the same bounded extraction
 * as the evidence index. Offsets are never applied to raw bytes or another
 * parser's text. The complete original remains available separately. */
export async function buildDocumentPassagePreview(retained,input){
 const {expectedSha256,anchor}=normalizeDocumentPassageRequest(input),{version}=retained||{},value=retained?.bytes;
 if(!(value instanceof Uint8Array)||!version||version.sha256!==expectedSha256||version.size!==value.byteLength||createHash('sha256').update(value).digest('hex')!==expectedSha256)passageFail('The retained passage source differs from its exact version, size or SHA256.',409);
 const largePdf=value.byteLength>engagementIndexLimits.maxSourceBytes&&value.byteLength<=engagementIndexLimits.maximumSourceBytes&&anchor.page!==undefined&&anchor.page!==null&&(/\.pdf$/i.test(version.filename)||version.mediaType==='application/pdf');
 if(value.byteLength>engagementIndexLimits.maxSourceBytes&&!largePdf)passageFail('Passage extraction above 16 MiB requires one explicit PDF file page and supports originals up to 64 MiB. Open its exact page or download the original.',413);
 // Version 4 changes passage boundaries and page windows; version 3 uses the
 // same canonical text and page-local UTF-16 offsets. Revalidate its exact quote
 // against retained bytes without rewriting the historical citation binding.
 if(anchor.extractorVersion!==undefined&&![engagementExtractorVersion,'esia-engagement-extract-3'].includes(anchor.extractorVersion))passageFail('This citation uses an earlier extraction method. Review its exact original before preparing a new passage anchor.',409);
 const index=await indexEngagementSources({project:{id:'exact-source-reader',resources:[{id:version.resourceId||'exact-source',versions:[version]}]},readVersion:async()=>retained,maxDocuments:1,...(largePdf?{maxSourceBytes:engagementIndexLimits.maximumSourceBytes}:{}),...(anchor.page!==undefined&&anchor.page!==null&&(/\.pdf$/i.test(version.filename)||version.mediaType==="application/pdf")?{pageRanges:[{versionId:version.id,startPage:anchor.page,endPage:anchor.page}]}:{})}),document=index.documents[0];
 if(document.status!=='indexed'||!index.passages.length)passageFail('This original has no available bounded passage extraction. Open its exact page or download the original.',422);
 const runs=[];for(const passage of index.passages){const start=passage.extraction.range.start,last=runs.at(-1);if(last&&last.page===passage.page&&last.start+last.text.length===start)last.text+=passage.quote;else runs.push({page:passage.page,start,text:passage.quote,method:passage.method});}
 const found=[];for(const run of runs){if(anchor.page!==undefined&&anchor.page!==null&&anchor.page!==run.page)continue;if(anchor.range){const relative=anchor.range.start-run.start;if(relative>=0&&relative+anchor.quote.length<=run.text.length&&run.text.slice(relative,relative+anchor.quote.length)===anchor.quote)found.push({run,start:anchor.range.start,end:anchor.range.end});}
  else for(let position=run.text.indexOf(anchor.quote);position>=0;position=run.text.indexOf(anchor.quote,position+1)){found.push({run,start:run.start+position,end:run.start+position+anchor.quote.length});if(found.length>documentPassagePreviewLimits.maxChoices)break;}if(found.length>documentPassagePreviewLimits.maxChoices)break;}
 if(!found.length)passageFail('The quoted passage was not found at this source anchor within the bounded extraction. Inspect the exact original and correct the citation.',409);
 const identity={versionId:version.id,sha256:version.sha256,filename:version.filename,mediaType:version.mediaType,size:version.size},warnings=[...document.warnings];
 const choice=match=>{const start=Math.max(match.run.start,match.start-1000),end=Math.min(match.run.start+match.run.text.length,match.end+1000);return {page:match.run.page,range:{start:match.start,end:match.end,basis:'extracted_text_utf16_code_units'},text:match.run.text.slice(start-match.run.start,end-match.run.start),textRange:{start,end,basis:'extracted_text_utf16_code_units'},match:{start:match.start-start,end:match.end-start}};};
 if(found.length!==1)return {...identity,kind:'passage_choices',text:'',warnings,passage:{format:'esia-source-passage-preview',schemaVersion:1,status:'ambiguous',quote:anchor.quote,extractorVersion:engagementExtractorVersion,choices:found.slice(0,12).map(choice),truncated:found.length>12}};
 const matched=choice(found[0]),preview=found[0].run.page?await buildDocumentPreview(retained,{page:found[0].run.page}):{...identity,kind:'text',warnings:[]};
 return {...preview,...identity,text:matched.text,tables:[],warnings:[...new Set([...(preview.warnings||[]),...warnings])],passage:{format:'esia-source-passage-preview',schemaVersion:1,status:'matched',quote:anchor.quote,method:found[0].run.method,extractorVersion:engagementExtractorVersion,...matched}};
}
