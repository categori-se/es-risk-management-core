import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, writeFileSync, statSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {JSDOM} from "jsdom";
import {stableJson} from "../src/lib/engagement-domain.js";

const hash = value => createHash("sha256").update(value).digest("hex");
const fail = (message, status = 400) => {throw Object.assign(Error(message), {status});};
export const pdfDerivativeLimits = Object.freeze({sourceBytes: 64 * 1024 * 1024, rasterBytes: 8 * 1024 * 1024,
  rasterDimension: 2400, toolMilliseconds: 12000, totalMilliseconds: 35000, tsvBytes: 2 * 1024 * 1024,
  wordsPerPage: 5000, wordsPerWindow: 16000, textCharacters: 128000, tablesPerPage: 30, rowsPerTable: 200, columns: 40});
const tableWarning = "Table cells, header candidates and footnote associations are inferred from page coordinates. Merged cells, reading order and meanings require comparison with the exact original page.";
const coordinate = value => Math.round(value * 1000) / 1000;
const box = words => {
  const x = Math.min(...words.map(word => word.x)), y = Math.min(...words.map(word => word.y));
  return {x: coordinate(x), y: coordinate(y), width: coordinate(Math.max(...words.map(word => word.x + word.width)) - x), height: coordinate(Math.max(...words.map(word => word.y + word.height)) - y)};
};
function validWord(word, width, height) {
  return typeof word.text === "string" && word.text.trim() && word.text.length <= 2000 &&
    [word.x, word.y, word.width, word.height].every(Number.isFinite) && word.x >= 0 && word.y >= 0 && word.width > 0 && word.height > 0 &&
    word.x + word.width <= width + 1 && word.y + word.height <= height + 1;
}
function withSourceBounds(value, {width, height, coordinateBasis}, rasterWidth, rasterHeight, page) {
  const result = structuredClone(value), xScale = width / rasterWidth, yScale = height / rasterHeight;
  const visit = node => {
    if (!node || typeof node !== "object") return;
    const children = Object.entries(node).filter(([key]) => key !== "sourceBounds");
    if ([node.x, node.y, node.width, node.height].every(Number.isFinite)) node.sourceBounds = {
      page, coordinateBasis, x: coordinate(node.x * xScale), y: coordinate(node.y * yScale), width: coordinate(node.width * xScale), height: coordinate(node.height * yScale)};
    for (const [, child] of children) {if (Array.isArray(child)) child.forEach(visit);else visit(child);}
  };
  visit(result);return result;
}
function ocrPageGeometry(info,page,width,height) {
  const readBox=name=>{const match=new RegExp(`^(?:Page\\s+\\d+\\s+)?${name}:\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s*$`,'m').exec(info);return match?match.slice(1).map(Number):null;};
  const mediaBox=readBox('MediaBox'),cropBox=readBox('CropBox'),rawRotation=Number(/^(?:Page\s+\d+\s+)?rot:\s+(-?\d+)\s*$/m.exec(info)?.[1]),rotation=((rawRotation%360)+360)%360;
  if(!mediaBox||!cropBox||![...mediaBox,...cropBox].every(Number.isFinite)||![0,90,180,270].includes(rotation))fail('The exact OCR page crop and rotation could not be established.',422);
  const renderBox=[Math.max(mediaBox[0],cropBox[0]),Math.max(mediaBox[1],cropBox[1]),Math.min(mediaBox[2],cropBox[2]),Math.min(mediaBox[3],cropBox[3])],pointWidth=renderBox[2]-renderBox[0],pointHeight=renderBox[3]-renderBox[1];
  const displayWidth=rotation%180?pointHeight:pointWidth,displayHeight=rotation%180?pointWidth:pointHeight;
  if(![displayWidth,displayHeight].every(value=>Number.isFinite(value)&&value>0&&value<=100000)||Math.abs(width*displayHeight-height*displayWidth)>Math.max(displayWidth,displayHeight)*2)fail('The OCR page raster differs from its declared rotated crop geometry.',422);
  return {page,coordinateBasis:'rendered_crop_box_points_top_left',width:displayWidth,height:displayHeight,rotation,mediaBox,cropBox,renderBox};
}
function pageLines(words) {
  const lines = new Map();
  for (const word of words) {
    const key = word.lineKey;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(word);
  }
  return [...lines.values()].map(items => {
    items.sort((a, b) => a.x - b.x);
    return {text: items.map(word => word.text).join(" "), ...box(items), words: items.map(({lineKey, ...word}) => word)};
  }).sort((a, b) => a.y - b.y || a.x - b.x);
}
function lineCells(line) {
  const groups = [];
  for (const word of line.words) {
    const previous = groups.at(-1), last = previous?.at(-1);
    // Deliberately conservative: an ordinary space never establishes a cell.
    if (!last || word.x - last.x - last.width > Math.max(12, Math.min(word.height, last.height) * 1.35)) groups.push([word]);
    else previous.push(word);
  }
  return groups.map(words => ({text: words.map(word => word.text).join(" "), ...box(words), words}));
}
export function inferPageTables(lines, {page, coordinateBasis} = {}) {
  // Poppler may split one visual row into several lines/blocks. Coalesce only
  // their geometry for table detection; canonical extracted text is untouched.
  const visual = [];
  for (const line of lines) {
    const row = visual.find(candidate => Math.abs(candidate.y - line.y) <= Math.min(candidate.height, line.height) * .45);
    if (row) {row.words.push(...line.words);row.words.sort((a, b) => a.x - b.x);Object.assign(row, box(row.words));row.text = row.words.map(word => word.text).join(" ");}
    else visual.push({...line, words: [...line.words]});
  }
  visual.sort((a, b) => a.y - b.y || a.x - b.x);
  const candidates = visual.map((line, index) => ({line, index, cells: lineCells(line)})), tables = [];
  for (let at = 0; at < candidates.length && tables.length < pdfDerivativeLimits.tablesPerPage;) {
    const first = candidates[at];
    if (first.cells.length < 2 || first.cells.length > pdfDerivativeLimits.columns) {at++;continue;}
    const rows = [first];let next = at + 1;
    for (; next < candidates.length && rows.length < pdfDerivativeLimits.rowsPerTable; next++) {
      const candidate = candidates[next], previous = rows.at(-1);
      if (candidate.line.y - previous.line.y - previous.line.height > Math.max(24, previous.line.height * 2) || candidate.cells.length !== first.cells.length ||
          candidate.cells.some((cell, column) => Math.abs(cell.x - first.cells[column].x) > Math.max(12, first.line.height))) break;
      rows.push(candidate);
    }
    if (rows.length < 2) {at++;continue;}
    const rowCells = rows.map(row => row.cells), before = visual.slice(Math.max(0, at - 2), at), after = visual.slice(next, Math.min(next + 3, visual.length));
    const footnotes = after.filter(line => /^(?:[*†‡]|\(?\d{1,2}[).:]|note\b|source\b|footnote\b)/i.test(line.text.trim()));
    tables.push({page, coordinateBasis, status: "layout_candidate_for_human_review", ...box(rows.flatMap(row => row.line.words)),
      rows: rowCells, headerRowCandidate: 0, precedingContext: before.map(({text, x, y, width, height}) => ({text, x, y, width, height})),
      followingContext: after.map(({text, x, y, width, height}) => ({text, x, y, width, height})),
      footnoteCandidates: footnotes.map(({text, x, y, width, height}) => ({text, x, y, width, height})), warnings: [tableWarning]});
    at = next;
  }
  return tables;
}

/** Coordinates are a separate derivative. They never replace Poppler's
 * canonical -layout text or supply offsets for ordinary source quotations. */
export function parsePdfLayout(xml, {startPage = 1, expectedPages, maxWords = pdfDerivativeLimits.wordsPerWindow} = {}) {
  if (typeof xml !== "string" || Buffer.byteLength(xml) > 4 * 1024 * 1024 || !Number.isSafeInteger(startPage) || startPage < 1 ||
      !Number.isSafeInteger(maxWords) || maxWords < 1 || maxWords > pdfDerivativeLimits.wordsPerWindow) fail("Use a bounded PDF layout extraction.");
  let dom;
  try {dom = new JSDOM(xml, {contentType: "application/xml"});} catch {fail("The local PDF layout output is malformed.", 422);}
  try {
    const nodes = [...dom.window.document.querySelectorAll("page")];
    if (expectedPages !== undefined && nodes.length !== expectedPages) fail("The local PDF layout reader returned an incomplete page sequence.", 422);
    const pages = [];let count = 0, characters = 0, truncated = false;
    for (let offset = 0; offset < nodes.length; offset++) {
      const node = nodes[offset], width = Number(node.getAttribute("width")), height = Number(node.getAttribute("height"));
      if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 100000)) fail("The local PDF layout page coordinates are invalid.", 422);
      const words = [];let pageTruncated = false;
      for (const [lineIndex, line] of [...node.querySelectorAll("line")].entries()) for (const element of line.querySelectorAll("word")) {
        const x = Number(element.getAttribute("xMin")), y = Number(element.getAttribute("yMin")), word = {text: element.textContent,
          x, y, width: Number(element.getAttribute("xMax")) - x, height: Number(element.getAttribute("yMax")) - y, lineKey: lineIndex};
        if (!validWord(word, width, height)) fail("The local PDF layout word coordinates are invalid.", 422);
        if (words.length >= pdfDerivativeLimits.wordsPerPage || count >= maxWords || characters + word.text.length > pdfDerivativeLimits.textCharacters) {pageTruncated = true;continue;}
        words.push(word);count++;characters += word.text.length;
      }
      const page = startPage + offset, lines = pageLines(words), coordinateBasis = "pdf_points_top_left";
      pages.push({page, width, height, coordinateBasis, lines, tables: inferPageTables(lines, {page, coordinateBasis}), truncated: pageTruncated});
      truncated ||= pageTruncated;
    }
    return {format: "esia-pdf-layout-derivative", schemaVersion: 1, method: "poppler-pdftotext-bbox-layout", pages, truncated,
      warnings: [tableWarning, ...(truncated ? ["The bounded coordinate derivative is incomplete; inspect original pages and request a smaller page window."] : [])]};
  } finally {dom.window.close();}
}

export function parseTesseractTsv(tsv, {width, height, page} = {}) {
  if (typeof tsv !== "string" || Buffer.byteLength(tsv) > pdfDerivativeLimits.tsvBytes || ![width, height].every(value => Number.isSafeInteger(value) && value > 0 && value <= pdfDerivativeLimits.rasterDimension) || !Number.isSafeInteger(page) || page < 1) fail("Use bounded OCR text and raster coordinates.");
  const rows = tsv.trimEnd().split(/\r?\n/);
  if (rows.shift() !== "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext") fail("The local OCR reader returned an unsupported TSV schema.", 422);
  const words = [];let characters = 0, truncated = false;
  for (const row of rows) {
    const fields = row.split("\t");if (fields[0] !== "5") continue;
    const text = fields.slice(11).join("\t").trim();if (!text) continue;
    const confidence = Number(fields[10]), word = {text, x: Number(fields[6]), y: Number(fields[7]), width: Number(fields[8]), height: Number(fields[9]), confidence,
      lineKey: fields.slice(1, 5).join(":")};
    if (!validWord(word, width, height) || !Number.isFinite(confidence) || confidence < 0 || confidence > 100) fail("The local OCR word coordinates or confidence are invalid.", 422);
    if (words.length >= pdfDerivativeLimits.wordsPerPage || characters + text.length + 1 > pdfDerivativeLimits.textCharacters) {truncated = true;continue;}
    words.push(word);characters += text.length + 1;
  }
  const lines = pageLines(words), text = lines.map(line => line.text).join("\n"), coordinateBasis = "rendered_page_pixels_top_left";
  const confidence = words.length ? coordinate(words.reduce((sum, word) => sum + word.confidence * word.text.length, 0) / words.reduce((sum, word) => sum + word.text.length, 0)) : null;
  return {text, confidence, lowConfidenceWords: words.filter(word => word.confidence < 70).length, truncated,
    layout: {page, width, height, coordinateBasis, lines, tables: inferPageTables(lines, {page, coordinateBasis}), truncated}};
}

/** One manually requested foreground page, no network, worker, polling or
 * retries. The complete original is verified before any native tool runs. */
export function buildPdfOcrDerivative({bytes: value, version} = {}, {page, language = "eng", run = execFileSync, deadline = Date.now() + pdfDerivativeLimits.totalMilliseconds} = {}) {
  if (!(value instanceof Uint8Array) || !version || typeof version.id !== "string" || !version.id || version.id.length > 192 || value.byteLength > pdfDerivativeLimits.sourceBytes || value.byteLength !== version.size ||
      !/^[a-f0-9]{64}$/.test(version.sha256 || "") || hash(value) !== version.sha256) fail("The OCR original must match its exact retained version, size and SHA256.", 409);
  const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (bytes.subarray(0, 5).toString() !== "%PDF-" || !Number.isSafeInteger(page) || page < 1 || language !== "eng") fail("Select one positive PDF file page and the installed English OCR language.");
  const directory = mkdtempSync(join(tmpdir(), "esia-pdf-ocr-"));
  const execute = (command, args, options = {}) => {
    const remaining = Math.min(pdfDerivativeLimits.toolMilliseconds, deadline - Date.now());
    if (remaining <= 0) fail("The explicit OCR request exceeded its foreground time budget. Retry one page explicitly.", 504);
    try {return run(command, args, {timeout: remaining, maxBuffer: pdfDerivativeLimits.tsvBytes, env: {...process.env, LC_ALL: "C", OMP_THREAD_LIMIT: "1"}, stdio: ["ignore", "pipe", "pipe"], ...options});}
    catch (error) {
      if (error.code === "ENOENT") fail(`The optional local ${command} tool is not installed. Install Poppler and Tesseract to request OCR on this device.`, 422);
      if (error.code === "ETIMEDOUT" || error.signal === "SIGTERM") fail("The explicit OCR request exceeded its foreground time budget. Retry one page explicitly.", 504);
      fail("The local OCR tool failed for this exact page. Inspect the original; no citation was produced.", 422);
    }
  };
  try {
    const path = join(directory, "source.pdf"), prefix = join(directory, "page");writeFileSync(path, bytes, {mode: 0o600, flag: "wx"});
    const info = execute("pdfinfo", [path], {encoding: "utf8", maxBuffer: 256 * 1024}), totalPages = Number(/^Pages:\s+(\d+)\s*$/m.exec(info)?.[1]);
    if (!Number.isSafeInteger(totalPages) || totalPages < 1 || page > totalPages) fail("The selected OCR file page lies outside this exact original.");
    execute("pdftoppm", ["-f", String(page), "-l", String(page), "-singlefile", "-cropbox", "-scale-to", String(pdfDerivativeLimits.rasterDimension), "-png", path, prefix], {maxBuffer: 256 * 1024});
    const imagePath = `${prefix}.png`, stat = statSync(imagePath);
    if (!stat.isFile() || stat.size > pdfDerivativeLimits.rasterBytes) fail("The OCR page raster exceeds the bounded image budget.", 413);
    const image = readFileSync(imagePath), width = image.length >= 24 ? image.readUInt32BE(16) : 0, height = image.length >= 24 ? image.readUInt32BE(20) : 0;
    if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || ![width, height].every(value => Number.isSafeInteger(value) && value > 0 && value <= pdfDerivativeLimits.rasterDimension)) fail("The local PDF renderer returned an invalid OCR page raster.", 422);
    // PDF text bounding-box dimensions are unrotated on some Poppler versions.
    // Pin the actual rendered CropBox and rotation instead. These are display
    // point coordinates, explicitly distinct from unrotated PDF object space.
    const geometryInfo=execute('pdfinfo',['-f',String(page),'-l',String(page),'-box',path],{encoding:'utf8',maxBuffer:256*1024});
    const sourcePage=ocrPageGeometry(geometryInfo,page,width,height);
    const engineVersion = execute("tesseract", ["--version"], {encoding: "utf8", maxBuffer: 256 * 1024}).split(/\r?\n/)[0].trim();
    if (!/^tesseract [\w.+-]{1,100}$/.test(engineVersion)) fail("The local OCR tool could not establish its recognition version.", 422);
    const parsed = parseTesseractTsv(execute("tesseract", [imagePath, "stdout", "-l", language, "--psm", "3", "tsv"], {encoding: "utf8"}), {width, height, page});
    const content = {format: "esia-pdf-ocr-derivative", schemaVersion: 1, sourceVersionId: version.id, sourceSha256: version.sha256,
      page, totalPages, method: "tesseract-ocr-derivative", engine: "tesseract-tsv", engineVersion, pageSegmentationMode: 3, language, raster: {method: "poppler-pdftoppm", sha256: hash(image), width, height, maximumDimension: pdfDerivativeLimits.rasterDimension},
      sourcePage, text: parsed.text, textSha256: hash(parsed.text), confidence: parsed.confidence, lowConfidenceWords: parsed.lowConfidenceWords,
      truncated: parsed.truncated, layout: withSourceBounds(parsed.layout, sourcePage, width, height, page), citationEligibility: "requires_original_page_confirmation",
      warnings: ["OCR is a machine-recognized derivative, not verbatim PDF text. Compare every proposed quotation against the exact original page and record human confirmation before citing it.",
        "OCR confidence describes recognition only; it does not establish correctness, evidence adequacy or compliance.",
        "OCR source bounds use points from the top-left of the rendered, rotated CropBox; original MediaBox, CropBox and rotation are retained separately. They are not unrotated PDF object coordinates.", tableWarning,
        ...(parsed.truncated ? ["This OCR derivative is incomplete because its explicit word or character budget was reached."] : []),
        ...(!parsed.text ? ["No readable OCR words were returned; this does not establish absence of evidence."] : [])]};
    return {...content, derivativeSha256: hash(stableJson(content))};
  } finally {rmSync(directory, {recursive: true, force: true});}
}

export function validatePdfOcrDerivative(value, {versionId, sha256, page} = {}) {
  const keys = ["format", "schemaVersion", "sourceVersionId", "sourceSha256", "page", "totalPages", "method", "engine", "engineVersion", "pageSegmentationMode", "language", "raster", "sourcePage", "text", "textSha256", "confidence", "lowConfidenceWords", "truncated", "layout", "citationEligibility", "warnings", "derivativeSha256"];
  if (!value || Object.keys(value).length !== keys.length || Object.keys(value).some(key => !keys.includes(key)) || value.format !== "esia-pdf-ocr-derivative" || value.schemaVersion !== 1 || value.sourceVersionId !== versionId || value.sourceSha256 !== sha256 ||
      typeof versionId !== "string" || !versionId || !/^[a-f0-9]{64}$/.test(sha256 || "") || value.page !== page || !Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(value.totalPages) || value.totalPages < page || value.method !== "tesseract-ocr-derivative" || value.engine !== "tesseract-tsv" || !/^tesseract [\w.+-]{1,100}$/.test(value.engineVersion || "") || value.pageSegmentationMode !== 3 || value.language !== "eng" || value.citationEligibility !== "requires_original_page_confirmation" ||
      typeof value.text !== "string" || value.text.length > pdfDerivativeLimits.textCharacters || value.textSha256 !== hash(value.text) || typeof value.truncated !== "boolean" ||
      !Array.isArray(value.warnings) || value.warnings.length > 10 || value.warnings.some(warning => typeof warning !== "string" || warning.length > 2000)) fail("The retained OCR derivative differs from its exact source page or text.", 409);
  const {derivativeSha256, ...content} = value;
  if (derivativeSha256 !== hash(stableJson(content))) fail("The retained OCR derivative failed its SHA256 integrity check.", 409);
  const raster = value.raster, layout = value.layout, sourcePage = value.sourcePage;
  if (!raster || Object.keys(raster).sort().join(",") !== "height,maximumDimension,method,sha256,width" || raster.method !== "poppler-pdftoppm" || !/^[a-f0-9]{64}$/.test(raster.sha256 || "") || raster.maximumDimension !== pdfDerivativeLimits.rasterDimension ||
      ![raster.width, raster.height].every(dimension => Number.isSafeInteger(dimension) && dimension > 0 && dimension <= pdfDerivativeLimits.rasterDimension) ||
      !sourcePage || Object.keys(sourcePage).sort().join(",") !== "coordinateBasis,cropBox,height,mediaBox,page,renderBox,rotation,width" || sourcePage.page !== page || sourcePage.coordinateBasis !== "rendered_crop_box_points_top_left" || ![0,90,180,270].includes(sourcePage.rotation) || ![sourcePage.width, sourcePage.height].every(dimension => Number.isFinite(dimension) && dimension > 0 && dimension <= 100000) ||
      ![sourcePage.mediaBox,sourcePage.cropBox,sourcePage.renderBox].every(bounds=>Array.isArray(bounds)&&bounds.length===4&&bounds.every(Number.isFinite)) ||
      !layout || layout.page !== page || layout.width !== raster.width || layout.height !== raster.height || layout.coordinateBasis !== "rendered_page_pixels_top_left" || layout.truncated !== value.truncated ||
      !Array.isArray(layout.lines) || layout.lines.length > pdfDerivativeLimits.wordsPerPage || !Array.isArray(layout.tables) || layout.tables.length > pdfDerivativeLimits.tablesPerPage) fail("The retained OCR layout does not match its bounded source-page raster.", 409);
  let expectedSourcePage;try {expectedSourcePage=ocrPageGeometry(`MediaBox: ${sourcePage.mediaBox.join(' ')}\nCropBox: ${sourcePage.cropBox.join(' ')}\nrot: ${sourcePage.rotation}\n`,page,raster.width,raster.height);}catch{fail('The retained OCR rendered crop geometry is invalid.',409);}
  if(stableJson(sourcePage)!==stableJson(expectedSourcePage))fail('The retained OCR source bounds differ from their exact crop and rotation frame.',409);
  let words = 0, weight = 0, weightedConfidence = 0, lowConfidenceWords = 0;
  for (const line of layout.lines) {
    if (!Array.isArray(line.words) || !line.words.length || (words += line.words.length) > pdfDerivativeLimits.wordsPerPage) fail("The retained OCR layout exceeds its exact word budget.", 409);
    for (const word of line.words) {
      if (!validWord(word, raster.width, raster.height) || !Number.isFinite(word.confidence) || word.confidence < 0 || word.confidence > 100) fail("The retained OCR word coordinates or confidence are invalid.", 409);
      weight += word.text.length;weightedConfidence += word.text.length * word.confidence;if (word.confidence < 70) lowConfidenceWords++;
    }
    if (line.text !== line.words.map(word => word.text).join(" ") || stableJson({x: line.x, y: line.y, width: line.width, height: line.height}) !== stableJson(box(line.words))) fail("The retained OCR line differs from its word text or geometry.", 409);
  }
  const expectedLayout = withSourceBounds({...layout, tables: inferPageTables(layout.lines, {page, coordinateBasis: layout.coordinateBasis})}, sourcePage, raster.width, raster.height, page);
  if (layout.lines.map(line => line.text).join("\n") !== value.text || value.confidence !== (weight ? coordinate(weightedConfidence / weight) : null) || value.lowConfidenceWords !== lowConfidenceWords ||
      stableJson(layout) !== stableJson(expectedLayout)) fail("The retained OCR text, confidence, source coordinates or table context differs from its recognition words.", 409);
  return value;
}
