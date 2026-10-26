import ExcelJS from "exceljs";
import {createHash} from "node:crypto";

const BRAND = Object.freeze({navy: "FF17324D", green: "FF17664B", pale: "FFE8F1EB", ink: "FF21342C", muted: "FF58665F", line: "FFD4DFD8", white: "FFFFFFFF", stripe: "FFF5F8F6"});
const OUTCOMES = Object.freeze({gap: ["FFFBE6E3", "FF8C2923"], conforms: ["FFE4F1E8", "FF165C3A"], insufficient_evidence: ["FFFFF1D7", "FF795619"], not_applicable: ["FFEAEFF3", "FF435B6C"]});
const STANDARD_WIDTHS = [17, 27, 16, 28, 29, 28, 20];
const SUMMARY_WIDTHS = [27, 20, 12, 12, 15, 12, 16];
const COLUMNS = ["Clause / review reference", "Requirement / applicability", "Outcome", "Findings / uncertainty", "Evidence / provenance", "Corrective action / closure", "Responsibility / timing"];
const MAX_ROWS = 1048576;

// Cell values are always strings, never caller-supplied formula/hyperlink objects.
// XML-disallowed controls are displayed explicitly rather than silently lost.
function text(value) {
  const valueText = value == null ? "" : typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  return valueText.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, character => String.fromCodePoint(0x2400 + character.charCodeAt(0)));
}

function join(parts, separator = "\n") {return parts.filter(part => part !== undefined && part !== null && part !== "").map(text).join(separator);}
function visualWidth(value) {return Array.from(value).reduce((sum, character) => sum + (character === "\t" ? 4 : character.codePointAt(0) > 0x2e7f ? 2 : 1), 0);}
function lineCount(value, width) {return text(value).split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(visualWidth(line) / Math.max(7, width - 4))), 0);}

// Split by display size well below Excel's 32,767-character cell limit. Joining
// these chunks with no separator reconstructs the full displayed source value.
function chunks(value, width, maxLines = 10) {
  const characters = Array.from(text(value)), result = [];
  if (!characters.length) return [""];
  const limit = Math.max(7, Math.floor((width - 4) * .78));
  let start = 0, column = 0, row = 1;
  for (let index = 0; index < characters.length; index++) {
    const character = characters[index];
    if (character === "\n") {row++; column = 0;}
    else {
      column += visualWidth(character);
      if (column > limit) {row++; column = visualWidth(character);}
    }
    if (row > maxLines || index - start >= 15000) {
      const end = character === "\n" ? index + 1 : index;
      if (end > start) {result.push(characters.slice(start, end).join("")); start = end;}
      column = character === "\n" ? 0 : visualWidth(character); row = 1;
    }
  }
  if (start < characters.length) result.push(characters.slice(start).join(""));
  return result;
}

function fill(color) {return {type: "pattern", pattern: "solid", fgColor: {argb: color}};}
function styleCell(cell, {background, color = BRAND.ink, bold = false, size = 10, border = true} = {}) {
  cell.font = {name: "Aptos", size, color: {argb: color}, bold};
  cell.alignment = {vertical: "top", horizontal: "left", wrapText: true};
  cell.numFmt = "@";
  if (background) cell.fill = fill(background);
  if (border) cell.border = {bottom: {style: "hair", color: {argb: BRAND.line}}};
}

function addRow(sheet, values, options = {}) {
  if (sheet.rowCount >= MAX_ROWS) throw new RangeError("The report exceeds Excel's worksheet row limit; split the report before exporting.");
  const row = sheet.addRow(values.map(text));
  for (let column = 1; column <= 7; column++) styleCell(row.getCell(column), options);
  row.height = Math.max(26, Math.min(300, 14 * (Math.max(...values.map((value, index) => lineCount(value, sheet.getColumn(index + 1).width))) + 1)));
  return row;
}

function merged(sheet, value, {label = "", background, color, bold = false, size = 10} = {}) {
  // Summary metadata and prose use two label columns and five value columns.
  const width = [3, 4, 5, 6, 7].reduce((sum, column) => sum + sheet.getColumn(column).width, 0);
  const parts = chunks(value, width, 12);
  return parts.map((part, index) => {
    const row = addRow(sheet, [index ? `${label} · continued` : label, "", part, "", "", "", ""], {background, color, bold, size});
    sheet.mergeCells(row.number, 1, row.number, 2);
    sheet.mergeCells(row.number, 3, row.number, 7);
    row.height = Math.max(25, Math.min(300, 14 * (Math.max(lineCount(part, width), lineCount(index ? `${label} · continued` : label, sheet.getColumn(1).width + sheet.getColumn(2).width)) + 1)));
    return row;
  });
}

function band(sheet, value, color = BRAND.green) {
  const row = addRow(sheet, [value, "", "", "", "", "", ""], {background: color, color: BRAND.white, bold: true, size: 11});
  sheet.mergeCells(row.number, 1, row.number, 7);
  const width = sheet.columns.reduce((sum, column) => sum + column.width, 0) * 10 / 11 * .9;
  row.height = Math.max(26, Math.min(300, lineCount(value, width) * 15 + 10));
  return row;
}

function configureSheet(sheet, widths, paperSize, orientation, repeatedRows) {
  sheet.columns = widths.map(width => ({width}));
  sheet.properties.defaultRowHeight = 26;
  sheet.views = [{state: "frozen", xSplit: orientation === "landscape" ? 1 : 0, ySplit: repeatedRows, topLeftCell: `A${repeatedRows + 1}`, showGridLines: false, zoomScale: 90}];
  sheet.pageSetup = {paperSize: paperSize === "Letter" ? 1 : 9, orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    margins: {left: .3, right: .3, top: .45, bottom: .45, header: .15, footer: .2},
    printTitlesRow: `1:${repeatedRows}`, horizontalCentered: true, showGridLines: false, pageOrder: "downThenOver"};
  sheet.headerFooter.oddHeader = "&L&\"Aptos,Bold\"&9E&&S WORKSPACE&R&9FROZEN GAP ANALYSIS";
  sheet.headerFooter.oddFooter = "&L&9&A&C&9Page &P of &N&R&9Issued report";
}

function internalLink(sheetName, cell = "A1") {return `#'${sheetName.replaceAll("'", "''")}'!${cell}`;}

function stableZipDates(buffer) {
  // JSZip assigns wall-clock dates to every entry. Normalize only ZIP header
  // dates (1980-01-01); contents, compressed bytes and CRCs remain untouched.
  let end = buffer.length - 22;
  for (; end >= Math.max(0, buffer.length - 65557); end--) if (buffer.readUInt32LE(end) === 0x06054b50) break;
  if (end < 0) throw new Error("The generated workbook ZIP is incomplete.");
  const entries = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  for (let index = 0; index < entries; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("The generated workbook ZIP directory is invalid.");
    const local = buffer.readUInt32LE(offset + 42);
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error("The generated workbook ZIP entry is invalid.");
    buffer.writeUInt16LE(0, offset + 12); buffer.writeUInt16LE(33, offset + 14);
    buffer.writeUInt16LE(0, local + 10); buffer.writeUInt16LE(33, local + 12);
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return buffer;
}
function shortAuthority(authority) {
  const known = [[/world bank/i, "WB"], [/equator/i, "EP4"], [/international finance|\bIFC\b/i, "IFC"], [/asian development|\bADB\b/i, "ADB"], [/european investment|\bEIB\b/i, "EIB"], [/british international|\bBII\b/i, "BII"], [/development finance|\bDFC\b/i, "DFC"]];
  return known.find(([pattern]) => pattern.test(authority))?.[1] || authority;
}

function sheetNames(standards) {
  const used = new Set(["summary"]);
  return standards.map(standard => {
    const year = text(standard.edition).match(/\b(?:19|20)\d{2}\b/)?.[0] || "";
    const raw = join([shortAuthority(text(standard.authority)), standard.standard, year], " ");
    const cleaned = raw.replace(/[\[\]:*?/\\\u0000-\u001f]/g, " ").replace(/\s+/g, " ").replace(/^'+|'+$/g, "").trim() || "Standard";
    const suffix = createHash("sha256").update(text(standard.id)).digest("hex").slice(0, 6);
    let name = Array.from(cleaned).slice(0, 31).join("");
    if (Array.from(cleaned).length > 31 || used.has(name.toLowerCase())) name = Array.from(cleaned).slice(0, 24).join("") + " " + suffix;
    let sequence = 2;
    while (used.has(name.toLowerCase())) {name = Array.from(cleaned).slice(0, 20).join("") + ` ${suffix}-${sequence++}`;}
    used.add(name.toLowerCase());
    return name;
  });
}

function evidenceText(finding) {
  const evidence = (finding.evidence ?? []).map(item => join([`Evidence ${item.id}: ${item.title}`, item.locator, item.note,
    `Resource ${item.resourceId}; version ${item.versionId}`, item.filename && `File: ${item.filename}`, item.sha256 && `SHA-256: ${item.sha256}`,
    item.mode && `Custody: ${item.mode}`, item.source && `Source: ${text(item.source)}`, item.reference && `Reference: ${text(item.reference)}`]));
  const sources = (finding.sources ?? []).map(item => join([`Policy source: ${item.title}`, item.url, item.locator, item.sha256 && `SHA-256: ${item.sha256}`]));
  return join([...evidence, ...sources], "\n\n") || "No evidence cited.";
}

function preview(value, maximum = 150) {
  const original = text(value);
  if (original.length <= maximum) return original;
  const characters = Array.from(original), suffix = "… [detail below]";
  return characters.slice(0, maximum - suffix.length).join("").trimEnd() + suffix;
}

function findingValues(finding) {
  const actions = finding.actions ?? [];
  return [join([preview(finding.framework?.clause, 75), `Review ${finding.id}`]),
    join([preview(finding.requirement, 130), `Applicability: ${finding.applicability?.decision || "Not recorded"}`], "\n\n"),
    finding.conclusionLabel || finding.conclusion,
    join([preview(finding.rationale, 150), finding.riskSignificance && `Risk: ${preview(finding.riskSignificance, 40)}`], "\n\n"),
    join([`${finding.evidence?.length || 0} project citation(s); ${finding.sources?.length || 0} policy source(s)`, preview(evidenceText(finding), 145)], "\n\n"),
    actions.length ? preview(actions.map(action => join([`Action ${action.id}`, action.description])).join("\n\n"), 180) : "No corrective action recorded.",
    join([actions.length ? join([...actions.slice(0, 2).map(action => join([`Owner: ${preview(action.owner, 80)}`, `Due: ${action.dueDate} · ${action.status}${action.overdue ? " · Overdue at issue" : ""}`])),
      ...(actions.length > 2 ? [`${actions.length - 2} further action(s) [detail below]`] : [])]) : "No action recorded.",
      `Reviewed: ${text(finding.reviewedAt).slice(0, 10)}`, `By: ${preview(finding.reviewer, 28)}`])];
}

function appendMatrixFinding(sheet, finding, index) {
  const values = findingValues(finding), columns = values.map((value, column) => chunks(value, STANDARD_WIDTHS[column], 24));
  const count = Math.max(...columns.map(column => column.length));
  const [outcomeBackground, outcomeColor] = OUTCOMES[finding.conclusion] ?? [BRAND.pale, BRAND.ink];
  for (let part = 0; part < count; part++) {
    const rowValues = columns.map(column => column[part] ?? "");
    // Repeat identity and outcome on continuation rows so filtered/printed
    // rows remain attributable; the full original reference is preserved above.
    if (part) rowValues[0] = join([columns[0][part], `Review ${finding.id}\nContinued ${part + 1}/${count}`]);
    rowValues[2] = values[2];
    const row = addRow(sheet, rowValues, {background: index % 2 ? BRAND.stripe : BRAND.white});
    styleCell(row.getCell(3), {background: outcomeBackground, color: outcomeColor, bold: true});
  }
}

function appendFindingDetails(sheet, finding, index) {
  const [outcomeBackground, outcomeColor] = OUTCOMES[finding.conclusion] ?? [BRAND.pale, BRAND.ink];
  for (const block of finding.detailBlocks ?? []) {
    const width = STANDARD_WIDTHS.slice(3).reduce((sum, value) => sum + value, 0);
    const parts = chunks(block.value, width, 12);
    for (let part = 0; part < parts.length; part++) {
      const row = addRow(sheet, [`Review ${finding.id}`, join([block.label, parts.length > 1 ? `Part ${part + 1}/${parts.length}` : ""]), finding.conclusionLabel || finding.conclusion, parts[part], "", "", ""], {background: index % 2 ? BRAND.stripe : BRAND.white, size: 9});
      sheet.mergeCells(row.number, 4, row.number, 7);
      row.height = Math.max(29, Math.min(300, 13 * (Math.max(lineCount(parts[part], width), lineCount(`Review ${finding.id}`, STANDARD_WIDTHS[0]), lineCount(row.getCell(2).text, STANDARD_WIDTHS[1])) + 1)));
      row.getCell(2).font = {name: "Aptos", size: 9, bold: true, color: {argb: BRAND.muted}};
      styleCell(row.getCell(3), {background: outcomeBackground, color: outcomeColor, bold: true, size: 9});
    }
  }
}

function buildStandard(workbook, model, standard, name, paperSize) {
  const sheet = workbook.addWorksheet(name, {properties: {tabColor: {argb: BRAND.green}}});
  configureSheet(sheet, STANDARD_WIDTHS, paperSize, "landscape", 8);
  band(sheet, "E&S WORKSPACE  /  GAP ANALYSIS", BRAND.navy);
  band(sheet, standard.label || standard.standard);
  const identity = addRow(sheet, [join([standard.authority, standard.frameworkName, standard.edition], " · "), "", "", "", "", "", ""], {background: BRAND.pale, bold: true});
  sheet.mergeCells(identity.number, 1, identity.number, 7);
  identity.height = Math.max(30, Math.min(300, lineCount(identity.getCell(1).text, STANDARD_WIDTHS.reduce((sum, width) => sum + width, 0) * .9) * 14 + 8));
  const navigation = addRow(sheet, ["Return to Summary", "", "", "", "", "", ""], {color: BRAND.green});
  sheet.mergeCells(navigation.number, 1, navigation.number, 7);
  navigation.height = 22;
  navigation.getCell(1).value = {text: "Return to Summary", hyperlink: internalLink("Summary")};
  navigation.getCell(1).font = {name: "Aptos", size: 10, color: {argb: BRAND.green}, underline: true};
  const project = addRow(sheet, [join([model.project.name, model.project.client, `Issued ${model.issuedAt}`, `Revision ${model.project.revision}`], " · "), "", "", "", "", "", ""], {color: BRAND.muted, size: 9});
  sheet.mergeCells(project.number, 1, project.number, 7);
  project.height = Math.max(22, Math.min(300, lineCount(project.getCell(1).text, STANDARD_WIDTHS.reduce((sum, width) => sum + width, 0) * .95) * 13 + 7));
  const scope = addRow(sheet, [standard.scopeBasis === "retained_scope" ? "Coverage: standard retained in the issue-time review scope." : "Coverage: recorded assessments only; the full intended review scope is unknown.", "", "", "", "", "", ""], {color: BRAND.muted, size: 9});
  scope.getCell(1).value += " Matrix excerpts print by default; full retained text follows below the print area.";
  sheet.mergeCells(scope.number, 1, scope.number, 7); scope.height = 28;
  const counts = standard.counts ?? {};
  const totals = addRow(sheet, [`${standard.findings.length} assessment record(s) · Gaps ${counts.gap || 0} · Conforms ${counts.conforms || 0} · Insufficient evidence ${counts.insufficient_evidence || 0} · Not applicable ${counts.not_applicable || 0} · Actions ${standard.actions || 0}`, "", "", "", "", "", ""], {background: BRAND.pale, size: 9});
  sheet.mergeCells(totals.number, 1, totals.number, 7); totals.height = 22;
  const header = addRow(sheet, COLUMNS, {background: BRAND.navy, color: BRAND.white, bold: true}); header.height = 32;
  if (!standard.findings.length) {
    const empty = addRow(sheet, ["Unassessed — no assessment was recorded for this standard in the frozen report.", "", "", "", "", "", ""], {background: "FFFFF1D7", color: "FF795619", bold: true});
    sheet.mergeCells(empty.number, 1, empty.number, 7); empty.height = 34;
  } else standard.findings.forEach((finding, index) => appendMatrixFinding(sheet, finding, index));
  const matrixEnd = sheet.rowCount;
  sheet.autoFilter = `A8:G${Math.max(9, matrixEnd)}`;
  // ExcelJS prepends column '$' markers but leaves row markers to the caller.
  // Absolute rows are required for interoperable print areas in LibreOffice.
  sheet.pageSetup.printArea = `A$1:G$${matrixEnd}`;
  if (standard.findings.length) {
    band(sheet, "FULL RETAINED DETAIL  /  BELOW THE DEFAULT PRINT AREA", BRAND.navy);
    const note = addRow(sheet, ["All issue-time finding text, source context, evidence and action details are retained below. Matrix excerpts above are abbreviated for print. Select these rows explicitly if printing the full appendix.", "", "", "", "", "", ""], {background: BRAND.pale, color: BRAND.muted, size: 9});
    sheet.mergeCells(note.number, 1, note.number, 7);note.height = 32;
    standard.findings.forEach((finding, index) => appendFindingDetails(sheet, finding, index));
  }
  return sheet;
}

function buildSummary(workbook, model, standards, names, paperSize) {
  const sheet = workbook.addWorksheet("Summary", {properties: {tabColor: {argb: BRAND.navy}}});
  configureSheet(sheet, SUMMARY_WIDTHS, paperSize, "portrait", 2);
  band(sheet, "E&S WORKSPACE  /  GAP ANALYSIS", BRAND.navy);
  band(sheet, model.title || "Environmental and social gap analysis");
  merged(sheet, model.project.name, {label: "Project", bold: true});
  merged(sheet, model.project.client, {label: "Client"});
  merged(sheet, join([model.project.phase, model.project.period], " · "), {label: "Phase / period"});
  merged(sheet, join([model.issuedAt, model.reviewer], " · "), {label: "Issued / reviewer"});
  merged(sheet, `Report ${model.id}\nProject ${model.project.id}\nWorkspace ${model.project.workspaceId}\nRevision ${model.project.revision}\nRenderer ${model.rendererVersion}`, {label: "Frozen references", color: BRAND.muted, size: 9});
  if (model.narrative) merged(sheet, model.narrative, {label: "Executive narrative"});
  band(sheet, "REVIEW POSITION");
  const summary = model.summary, conclusions = summary.conclusions, actions = summary.actions;
  const metrics = [["Assessment records", summary.assessmentRecords], ["Check / scope references", summary.requirementReferences], ["Framework editions", summary.frameworkCount], ["Standards in this report", summary.standardCount],
    ["Gaps", conclusions.gap], ["Conforms", conclusions.conforms], ["Insufficient evidence", conclusions.insufficient_evidence], ["Not applicable", conclusions.not_applicable],
    ["Corrective actions", actions.total], ["Open / in progress / closed", `${actions.open} / ${actions.in_progress} / ${actions.closed}`], ["Overdue actions at issue", actions.overdue], ["Gaps without recorded actions", summary.gapsWithoutActions]];
  for (const [label, value] of metrics) {
    const rows = merged(sheet, text(value), {label, background: label === "Gaps" ? OUTCOMES.gap[0] : undefined, bold: ["Gaps", "Insufficient evidence", "Gaps without recorded actions"].includes(label)});
    if (typeof value === "number") {rows[0].getCell(3).value = value; rows[0].getCell(3).numFmt = "0";}
  }
  band(sheet, "STANDARD REGISTER  /  OPEN A TAB");
  const headerRow = addRow(sheet, ["Framework / edition", "Standard", "Gaps", "Conforms", "Insufficient evidence", "Not applicable", "Records / actions"], {background: BRAND.navy, color: BRAND.white, bold: true}); headerRow.height = 43;
  for (const [index, standard] of standards.entries()) {
    const counts = standard.counts ?? {};
    const row = addRow(sheet, [join([standard.authority, standard.frameworkName, standard.edition]), standard.standard + (standard.findings.length ? "" : "\nUnassessed"), counts.gap || 0, counts.conforms || 0, counts.insufficient_evidence || 0, counts.not_applicable || 0, `${standard.findings.length} / ${standard.actions || 0}`], {background: index % 2 ? BRAND.stripe : BRAND.white, size: 9});
    row.getCell(2).value = {text: text(standard.standard) + (standard.findings.length ? "" : "\nUnassessed"), hyperlink: internalLink(names[index])};
    row.getCell(2).font = {name: "Aptos", size: 9, underline: true, bold: true, color: {argb: BRAND.green}};
    row.height = Math.max(55, row.height);
    for (const column of [3, 4, 5, 6]) {row.getCell(column).value = [counts.gap, counts.conforms, counts.insufficient_evidence, counts.not_applicable][column - 3] || 0;row.getCell(column).numFmt = "0";}
  }
  if (!standards.length) merged(sheet, "No standards or reviewed assessments were recorded in this frozen report.", {label: "Scope"});
  band(sheet, "SCOPE AND READING NOTES");
  for (const note of model.notes ?? []) merged(sheet, note, {label: "Report note", color: BRAND.muted, size: 9});
  merged(sheet, "Counts describe the frozen assessment records. They are not a percentage compliance score. Outcome colours are accompanied by text. Standard tabs print concise matrices by default; full retained detail remains below each print area. All URLs are literal text; workbook navigation is internal. XML-disallowed controls are shown as visible control pictures.", {label: "Reading the workbook", color: BRAND.muted, size: 9});
  sheet.pageSetup.printArea = `A$1:G$${sheet.rowCount}`;
  return sheet;
}

export async function renderGapReportXlsx(model, {paperSize = model?.paperSize || "A4"} = {}) {
  if (!model || model.schemaVersion !== 1 || !Array.isArray(model.standards) || !model.project || !model.summary) throw new TypeError("A frozen gap report model is required.");
  if (!["A4", "Letter"].includes(paperSize)) throw new RangeError("Paper size must be A4 or Letter.");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "E&S Workspace"; workbook.lastModifiedBy = text(model.reviewer);
  workbook.title = text(model.title); workbook.subject = "Environmental and social gap analysis";
  workbook.description = `Frozen report ${text(model.id)}; project revision ${text(model.project.revision)}; ${text(model.rendererVersion)}`;
  const issued = new Date(model.issuedAt); workbook.created = workbook.modified = Number.isFinite(issued.getTime()) ? issued : new Date(0);
  const names = sheetNames(model.standards);
  buildSummary(workbook, model, model.standards, names, paperSize);
  model.standards.forEach((standard, index) => buildStandard(workbook, model, standard, names[index], paperSize));
  workbook.views = [{activeTab: 0, firstSheet: 0, visibility: "visible"}];
  return stableZipDates(Buffer.from(await workbook.xlsx.writeBuffer({useStyles: true, useSharedStrings: true, zip: {compression: "DEFLATE", compressionOptions: {level: 6}}})));
}
