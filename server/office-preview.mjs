import {inflateRawSync} from 'node:zlib';
import ExcelJS from 'exceljs';
import {JSDOM} from 'jsdom';

export const officePreviewLimits = Object.freeze({bytes: 64 * 1024 * 1024, entries: 512, expandedBytes: 32 * 1024 * 1024,
  entryBytes: 8 * 1024 * 1024, xmlElements: 100_000, sheets: 20, rows: 200, columns: 40, cellCharacters: 2000, textCharacters: 128_000});
const fail = message => Object.assign(new Error(message), {status: 422});
const clean = (value, maximum = officePreviewLimits.cellCharacters) => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ' ').slice(0, maximum);
export function isOfficeSource({filename = '', mediaType = ''} = {}) {
  return /\.(?:docx|xlsx)$/i.test(filename) || /application\/vnd\.openxmlformats-officedocument\.(?:wordprocessingml\.document|spreadsheetml\.sheet)(?:;|$)/i.test(mediaType);
}
const crcTable = Uint32Array.from({length: 256}, (_, n) => {for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n;});
function crc32(bytes) {let value = -1; for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ -1) >>> 0;}

// Validate the complete central directory before inflating anything or loading
// ExcelJS. Actual output lengths and CRCs are checked before library parsing.
export function boundedZip(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 22 || bytes.length > officePreviewLimits.bytes) throw fail('This Office file exceeds the bounded preview size or is incomplete.');
  bytes = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && (bytes.readUInt32LE(end) !== 0x06054b50 || end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length)) end--;
  if (end < Math.max(0, bytes.length - 65557) || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw fail('Office preview requires a complete, single-volume ZIP file.');
  const count = bytes.readUInt16LE(end + 10), directoryStart = bytes.readUInt32LE(end + 16), size = bytes.readUInt32LE(end + 12);
  if (count > officePreviewLimits.entries || count !== bytes.readUInt16LE(end + 8) || directoryStart + size !== end) throw fail('This Office file exceeds the ZIP directory preview limits.');
  const entries = new Map(), ranges = []; let at = directoryStart, expandedTotal = 0;
  for (let index = 0; index < count; index++) {
    if (at + 46 > end || bytes.readUInt32LE(at) !== 0x02014b50) throw fail('Invalid Office ZIP directory.');
    const flags = bytes.readUInt16LE(at + 8), method = bytes.readUInt16LE(at + 10), crc = bytes.readUInt32LE(at + 16), compressed = bytes.readUInt32LE(at + 20), expanded = bytes.readUInt32LE(at + 24), nameLength = bytes.readUInt16LE(at + 28), local = bytes.readUInt32LE(at + 42), mode = bytes.readUInt32LE(at + 38) >>> 16;
    const next = at + 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
    if (next > end || flags & 1 || ![0, 8].includes(method) || (mode & 0xf000) === 0xa000) throw fail('Encrypted, linked or unsupported ZIP entries cannot be previewed.');
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8'), key = name.toLowerCase();
    if (!name || name.length > 512 || /[\\\x00-\x1f\x7f\ufffd]/.test(name) || name.startsWith('/') || name.split('/').some(part => ['.', '..', '__proto__'].includes(part)) || entries.has(key)) throw fail('This Office file contains unsafe or duplicate ZIP entry names.');
    if (expanded > officePreviewLimits.entryBytes || (expandedTotal += expanded) > officePreviewLimits.expandedBytes || expanded > Math.max(1024 * 1024, compressed * 200)) throw fail('This Office file exceeds the ZIP expansion preview limits.');
    if (local + 30 > directoryStart || bytes.readUInt32LE(local) !== 0x04034b50 || bytes.readUInt16LE(local + 6) !== flags || bytes.readUInt16LE(local + 8) !== method) throw fail('Invalid Office ZIP local header.');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28), finish = start + compressed;
    if (finish > directoryStart || start < local || !bytes.subarray(local + 30, local + 30 + bytes.readUInt16LE(local + 26)).equals(bytes.subarray(at + 46, at + 46 + nameLength)) || ranges.some(([a, b]) => local < b && finish > a)) throw fail('Invalid or overlapping Office ZIP entry ranges.');
    ranges.push([local, finish]); entries.set(key, {name, start, finish, method, expanded, crc}); at = next;
  }
  if (at !== end) throw fail('Invalid Office ZIP directory length.');
  for (const [key, entry] of entries) {
    let content;
    try {content = entry.method === 0 ? bytes.subarray(entry.start, entry.finish) : inflateRawSync(bytes.subarray(entry.start, entry.finish), {maxOutputLength: officePreviewLimits.entryBytes});}
    catch {throw fail('An Office ZIP entry cannot be safely decompressed.');}
    if (content.length !== entry.expanded || crc32(content) !== entry.crc) throw fail('An Office ZIP entry failed its integrity check.');
    if (/\.(?:xml|rels)$/i.test(entry.name)) {
      const text = content.toString('utf8');
      if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw fail('Office previews do not load DTDs or external XML entities.');
      let elements = 0;
      for (let position = text.indexOf('<'); position !== -1; position = text.indexOf('<', position + 1)) {
        if (!['/', '!', '?'].includes(text[position + 1]) && ++elements > officePreviewLimits.xmlElements) throw fail('An Office XML part exceeds the element preview limit.');
      }
    }
    entries.set(key, {name: entry.name, bytes: content});
  }
  return entries;
}

function xmlDocument(bytes) {
  const dom = new JSDOM(bytes.toString('utf8'), {contentType: 'application/xml'});
  if (dom.window.document.getElementsByTagName('parsererror').length) {dom.window.close(); throw fail('The Office document XML cannot be read.');}
  return dom;
}
const children = (node, name) => [...node.children].filter(child => child.localName === name);
function wordParagraph(node) {
  let text = '';
  for (const element of node.getElementsByTagName('*')) {
    if (element.localName === 't') text += element.textContent;
    else if (element.localName === 'tab') text += '\t';
    else if (['br', 'cr'].includes(element.localName)) text += '\n';
    if (text.length >= officePreviewLimits.cellCharacters) break;
  }
  return clean(text);
}
function wordPreview(entries) {
  const main = entries.get('word/document.xml'); if (!main) throw fail('The Word document body is missing.');
  let dom;
  try {
    dom = xmlDocument(main.bytes); const body = dom.window.document.getElementsByTagNameNS('*', 'body')[0];
    if (!body) throw fail('The Word document body is missing.');
    const paragraphs = [], tables = []; let characters = 0, truncated = false, tableCount = 0;
    const retain = value => {const remaining = officePreviewLimits.textCharacters - characters, text = value.slice(0, Math.max(0, remaining)); characters += text.length; if (text.length < value.length) truncated = true; return text;};
    for (const node of body.children) {
      if (characters >= officePreviewLimits.textCharacters) {truncated = true; break;}
      if (node.localName === 'p') {
        if (paragraphs.length >= 2000) {truncated = true; continue;}
        const text = wordParagraph(node); if (text) paragraphs.push(retain(text));
      } else if (node.localName === 'tbl') {
        if (++tableCount > officePreviewLimits.sheets) {truncated = true; continue;}
        const rows = [], sourceRows = children(node, 'tr');
        for (const row of sourceRows.slice(0, officePreviewLimits.rows)) {
          const cells = children(row, 'tc');
          rows.push(cells.slice(0, officePreviewLimits.columns).map(cell => retain(clean(children(cell, 'p').map(wordParagraph).join('\n')))));
          if (cells.length > officePreviewLimits.columns) truncated = true;
        }
        if (sourceRows.length > officePreviewLimits.rows) truncated = true;
        tables.push({name: `Table ${tableCount}`, rows});
      }
    }
    const warnings = ['Word preview shows bounded paragraph and table text. Layout, images, comments, tracked-change history and embedded objects are not rendered.'];
    if (truncated) warnings.push('The Word preview is truncated; the original contains the complete document.');
    return {kind: tables.length ? 'table' : 'text', text: paragraphs.join('\n\n'), ...(tables.length ? {tables} : {}), detected: {format: 'DOCX', paragraphCount: dom.window.document.getElementsByTagNameNS('*', 'p').length, tableCount}, warnings};
  } catch (error) {if (error.status) throw error; throw fail('The Word document XML cannot be read.');}
  finally {dom?.window.close();}
}
function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : '';
  if (typeof value !== 'object') return clean(value);
  if ('formula' in value || 'sharedFormula' in value) {
    const formula = value.formula ?? `shared formula ${value.sharedFormula}`;
    return clean(`=${formula}${value.result !== undefined ? ` [cached: ${cellText(value.result)}]` : ' [no cached result]'}`);
  }
  if (Array.isArray(value.richText)) return clean(value.richText.map(run => run.text ?? '').join(''));
  if ('text' in value) return clean(value.text);
  if ('error' in value) return clean(value.error);
  return '[Unsupported cell value]';
}
// Some valid OOXML producers qualify every spreadsheet element (x:workbook,
// x:row, etc.). ExcelJS does not accept every such workbook. Read only the
// already-checked XML parts in that case; never rewrite the retained ZIP.
function namespaceSpreadsheetPreview(entries) {
  const documents = [];
  const parse = key => {
    const entry = entries.get(key); if (!entry) throw fail('A required Excel workbook part is missing.');
    const dom = xmlDocument(entry.bytes); documents.push(dom); return dom.window.document;
  };
  const textRuns = node => children(node, 't').map(part => part.textContent).join('') + children(node, 'r').map(run => children(run, 't').map(part => part.textContent).join('')).join('');
  const columnNumber = reference => {
    const match = /^([A-Z]{1,3})[1-9][0-9]{0,6}$/i.exec(reference || ''); if (!match) throw fail('The Excel cell reference cannot be read.');
    let number = 0; for (const letter of match[1].toUpperCase()) number = number * 26 + letter.charCodeAt(0) - 64;
    if (number > 16384) throw fail('The Excel cell reference exceeds worksheet bounds.'); return number;
  };
  try {
    const workbook = parse('xl/workbook.xml');
    if (workbook.documentElement.localName !== 'workbook') throw fail('The Excel workbook definition cannot be read.');
    const relationships = parse('xl/_rels/workbook.xml.rels'), targets = new Map();
    for (const relationship of relationships.getElementsByTagNameNS('*', 'Relationship')) {
      if (!/\/worksheet$/.test(relationship.getAttribute('Type') || '') || relationship.getAttribute('TargetMode') === 'External') continue;
      const target = relationship.getAttribute('Target') || '', key = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
      if (!/^xl\/worksheets\/[a-z0-9_. -]+\.xml$/i.test(key) || key.includes('..')) throw fail('The Excel worksheet relationship cannot be read safely.');
      const id = relationship.getAttribute('Id'); if (!id || targets.has(id)) throw fail('The Excel worksheet relationship is ambiguous.'); targets.set(id, key.toLowerCase());
    }
    const sheets = [...workbook.getElementsByTagNameNS('*', 'sheet')], shared = [];
    if (entries.has('xl/sharedstrings.xml')) for (const item of parse('xl/sharedstrings.xml').getElementsByTagNameNS('*', 'si')) shared.push(clean(textRuns(item)));
    const tables = [], names = sheets.slice(0, officePreviewLimits.sheets).map(sheet => clean(sheet.getAttribute('name'), 200));
    let characters = 0, truncated = sheets.length > officePreviewLimits.sheets;
    const retain = value => {const text = clean(value), bounded = text.slice(0, Math.max(0, officePreviewLimits.textCharacters - characters)); characters += bounded.length; if (bounded.length < text.length) truncated = true; return bounded;};
    for (const [sheetIndex, sheet] of sheets.slice(0, officePreviewLimits.sheets).entries()) {
      const relationshipId = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sheet.getAttributeNS('http://purl.oclc.org/ooxml/officeDocument/relationships', 'id');
      const key = targets.get(relationshipId); if (!key) throw fail('The Excel worksheet relationship is missing.');
      const document = parse(key); if (document.documentElement.localName !== 'worksheet') throw fail('The Excel worksheet cannot be read.');
      const storedRows = new Map(); let rowCount = 0, columnCount = 0, priorRow = 0;
      for (const row of document.getElementsByTagNameNS('*', 'row')) {
        const rawIndex = row.getAttribute('r'), index = rawIndex ? Number(rawIndex) : priorRow + 1;
        if (!Number.isSafeInteger(index) || index < 1 || index > 1048576 || index <= priorRow) throw fail('The Excel row reference cannot be read.');
        priorRow = index; rowCount = index; const values = new Map(); let priorColumn = 0;
        for (const cell of children(row, 'c')) {
          const reference = cell.getAttribute('r'), column = reference ? columnNumber(reference) : priorColumn + 1;
          if (column <= priorColumn || (reference && Number(reference.match(/[0-9]+$/)[0]) !== index)) throw fail('The Excel cell reference is inconsistent.');
          priorColumn = column; columnCount = Math.max(columnCount, column);
          if (index > officePreviewLimits.rows || column > officePreviewLimits.columns || characters >= officePreviewLimits.textCharacters) {truncated = true; continue;}
          const type = cell.getAttribute('t'), value = children(cell, 'v')[0]?.textContent ?? '', formula = children(cell, 'f')[0];
          let text;
          if (type === 's') {if (!/^[0-9]+$/.test(value) || Number(value) >= shared.length) throw fail('The Excel shared string reference cannot be read.'); text = shared[Number(value)];}
          else if (type === 'inlineStr') text = textRuns(children(cell, 'is')[0] || cell);
          else if (type === 'b') text = value === '1' ? 'true' : value === '0' ? 'false' : value;
          else text = value;
          if (formula) text = `=${clean(formula.textContent || `shared formula ${formula.getAttribute('si') || ''}`)}${children(cell, 'v').length ? ` [cached: ${clean(text)}]` : ' [no cached result]'}`;
          values.set(column, retain(text));
        }
        if (index <= officePreviewLimits.rows) storedRows.set(index, values);
      }
      const count = Math.min(rowCount, officePreviewLimits.rows), columns = Math.min(columnCount, officePreviewLimits.columns), rows = [];
      if (rowCount > count || columnCount > columns) truncated = true;
      for (let index = 1; index <= count; index++) rows.push(Array.from({length: columns}, (_, offset) => storedRows.get(index)?.get(offset + 1) || ''));
      tables.push({name: names[sheetIndex], rows});
    }
    const warnings = ['A namespace-aware OOXML reader was used. Preview shows stored cell text and cached formula results; formulas are never evaluated. Styling, table definitions, charts, macros, links and external connections are not loaded. Numeric date serials are shown as stored numbers.'];
    if (truncated) warnings.push('The spreadsheet preview is limited to 20 sheets, 200 rows, 40 columns and a bounded text budget. The original contains the complete workbook.');
    return {kind: 'table', text: '', tables, detected: {format: 'XLSX', reader: 'namespace-aware-ooxml', sheetCount: sheets.length, sheetNames: names}, warnings};
  } catch (error) {if (error.status) throw error; throw fail('The Excel workbook XML cannot be read on this device.');}
  finally {for (const dom of documents) dom.window.close();}
}
async function spreadsheetPreview(bytes, entries) {
  if (!entries.has('xl/workbook.xml')) throw fail('The Excel workbook definition is missing.');
  const workbook = new ExcelJS.Workbook();
  try {await workbook.xlsx.load(bytes, {ignoreNodes: ['drawing', 'picture', 'extLst']});}
  catch {return namespaceSpreadsheetPreview(entries);}
  const tables = [], warnings = ['Excel preview shows bounded stored cell values. Formulas are literal text with any cached result; they are never evaluated. Charts, formatting, macros and external data connections are not loaded.'];
  let characters = 0, truncated = workbook.worksheets.length > officePreviewLimits.sheets;
  for (const sheet of workbook.worksheets.slice(0, officePreviewLimits.sheets)) {
    const rows = [], count = Math.min(sheet.rowCount, officePreviewLimits.rows), columns = Math.min(sheet.columnCount, officePreviewLimits.columns);
    if (sheet.rowCount > count || sheet.columnCount > columns) truncated = true;
    for (let rowIndex = 1; rowIndex <= count; rowIndex++) {
      if (characters >= officePreviewLimits.textCharacters) {truncated = true; break;}
      const row = [], source = sheet.getRow(rowIndex);
      for (let column = 1; column <= columns; column++) {
        const text = cellText(source.getCell(column).value), bounded = text.slice(0, Math.max(0, officePreviewLimits.textCharacters - characters));
        row.push(bounded); characters += bounded.length; if (bounded.length < text.length) truncated = true;
      }
      rows.push(row);
    }
    tables.push({name: clean(sheet.name, 200), rows});
  }
  if (truncated) warnings.push('The spreadsheet preview is limited to 20 sheets, 200 rows, 40 columns and a bounded text budget. The original contains the complete workbook.');
  return {kind: 'table', text: '', tables, detected: {format: 'XLSX', sheetCount: workbook.worksheets.length, sheetNames: workbook.worksheets.map(sheet => clean(sheet.name, 200)).slice(0, officePreviewLimits.sheets)}, warnings};
}

/** Pure local OOXML excerpts: no links, embedded documents or macros execute. */
export async function buildOfficePreview(bytes, {filename = '', mediaType = ''} = {}) {
  const entries = boundedZip(bytes);
  const result = /\.xlsx$/i.test(filename) || /spreadsheetml\.sheet/i.test(mediaType) ? await spreadsheetPreview(bytes, entries) : wordPreview(entries);
  return {...result, previewProvenance: {method: 'ooxml-bounded-excerpt', status: 'excerpt', limits: officePreviewLimits}};
}
