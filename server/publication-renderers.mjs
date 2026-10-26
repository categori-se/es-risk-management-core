import {normalizePublicationContent} from "../src/lib/publication-records.js";
import {publicationRendererVersion, publicationBlocks, renderPublicationHtml} from "../src/lib/publication-rendering.js";
export {publicationRendererVersion, publicationReaderCss, publicationBlocks, renderPublicationHtml, renderPublicationFragment} from "../src/lib/publication-rendering.js";

const crcTable = Array.from({length: 256}, (_, index) => {let value = index;for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;return value >>> 0;});
function zip(entries) {
  const chunks = [], central = [];let offset = 0;
  for (const [name, source] of Object.entries(entries)) {
    const filename = Buffer.from(name), bytes = Buffer.from(source);let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20, 4);local.writeUInt16LE(0x800, 6);local.writeUInt16LE(0x5021, 12);local.writeUInt32LE(crc, 14);local.writeUInt32LE(bytes.length, 18);local.writeUInt32LE(bytes.length, 22);local.writeUInt16LE(filename.length, 26);
    const header = Buffer.alloc(46);header.writeUInt32LE(0x02014b50);header.writeUInt16LE(20, 4);header.writeUInt16LE(20, 6);header.writeUInt16LE(0x800, 8);header.writeUInt16LE(0x5021, 14);header.writeUInt32LE(crc, 16);header.writeUInt32LE(bytes.length, 20);header.writeUInt32LE(bytes.length, 24);header.writeUInt16LE(filename.length, 28);header.writeUInt32LE(offset, 42);
    chunks.push(local, filename, bytes);central.push(header, filename);offset += local.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length / 2, 8);end.writeUInt16LE(central.length / 2, 10);end.writeUInt32LE(directory.length, 12);end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}
const xmlText = value => String(value ?? "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"}[character]));
const paragraph = (text, style = "Normal") => {
  const lines = String(text).replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)").split("\n");
  const runs = lines.map(line => {
    const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;let result = "", offset = 0;
    const run = (value, properties = "") => `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ""}<w:t xml:space="preserve">${xmlText(value)}</w:t></w:r>`;
    for (const match of line.matchAll(pattern)) {result += run(line.slice(offset, match.index)) + run(match[1] || match[2], match[1] ? "<w:b/>" : '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');offset = match.index + match[0].length;}
    return result + run(line.slice(offset));
  }).join("<w:r><w:br/></w:r>");
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runs}</w:p>`;
};
export function renderPublicationDocx(edition) {
  const content = normalizePublicationContent(edition.content), body = [paragraph(content.title, "Title"), ...(content.subtitle ? [paragraph(content.subtitle, "Subtitle")] : []),
    paragraph(`${content.authors.join(" · ") || "Author not recorded"} · ${String(edition.issuedAt || "").slice(0, 10)}`, "Subtitle"),
    ...(content.subjects.length ? [paragraph(content.subjects.map(subject => `${subject.type}: ${subject.name}`).join(" · "), "Subtitle")] : []),
    ...(content.summary ? [paragraph(content.summary, "Summary")] : []),
    ...publicationBlocks(content.body).flatMap(block => block.type === "list" ? block.items.map((item, index) => paragraph(`${block.ordered ? `${index + 1}.` : "•"} ${item}`)) : paragraph(block.text, block.type === "heading" ? `Heading${Math.min(block.level, 3)}` : block.type === "code" ? "Code" : "Normal")),
    ...(content.citations.length ? [paragraph("References", "Heading1"), ...content.citations.map((citation, index) => paragraph(`${index + 1}. ${citation.title}${citation.locator ? ` — ${citation.locator}` : ""}\n${citation.url}`))] : []),
    paragraph(`Frozen edition ${edition.id || ""} · SHA256 ${edition.sha256 || ""}`, "Provenance")].join("");
  const styles = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:color w:val="21313A"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${[["Normal", 22, "21313A", false], ["Title", 44, "174B40", true], ["Subtitle", 22, "53646C", false], ["Summary", 24, "174B40", false], ["Heading1", 30, "174B40", true], ["Heading2", 26, "174B40", true], ["Heading3", 23, "174B40", true], ["Code", 19, "21313A", false], ["Provenance", 17, "53646C", false]].map(([id, size, color, bold]) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/><w:pPr>${id.startsWith("Heading") || id === "Title" ? '<w:keepNext/>' : ""}<w:spacing w:before="${id.startsWith("Heading") ? 260 : 0}" w:after="160"/></w:pPr><w:rPr><w:sz w:val="${size}"/><w:color w:val="${color}"/>${bold ? '<w:b/>' : ""}${id === "Code" ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>' : ""}</w:rPr></w:style>`).join("")}</w:styles>`;
  return zip({"[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    "_rels/.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/_rels/document.xml.rels": '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    "word/styles.xml": styles,
    "word/document.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`});
}
export async function renderPublicationXlsx(edition) {
  const {default: ExcelJS} = await import("exceljs"), content = normalizePublicationContent(edition.content), workbook = new ExcelJS.Workbook();
  workbook.creator = "E&S publications";const date = new Date(edition.issuedAt || "2020-01-01T00:00:00Z");workbook.created = date;workbook.modified = date;
  for (const [name, rows] of [["Summary", [["PUBLICATION", content.title], ["Subtitle", content.subtitle], ["Authors", content.authors.join("; ")], ["Issued", edition.issuedAt], ["Edition", edition.id], ["Content SHA256", edition.sha256], ["Summary", content.summary], ["Topics", content.tags.join("; ")], ...content.subjects.map(subject => [subject.type, `${subject.name}${subject.url ? `\n${subject.url}` : ""}`])]],
    ["Article", [["Section / type", "Authored content"], ...publicationBlocks(content.body).flatMap(block => block.type === "list" ? block.items.map((item, index) => [block.ordered ? `${index + 1}.` : "•", item]) : [[block.type === "heading" ? `Heading ${block.level}` : block.type, block.text]])]],
    ["References", [["Reference / locator", "URL"], ...content.citations.map(citation => [`${citation.title}${citation.locator ? `\n${citation.locator}` : ""}`, citation.url])]]]) {
    const sheet = workbook.addWorksheet(name, {views: [{state: "frozen", ySplit: 1}], pageSetup: {paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1", margins: {left: .4, right: .4, top: .5, bottom: .5, header: .2, footer: .2}}});
    sheet.columns = [{width: 27}, {width: 88}];sheet.headerFooter.oddHeader = "&LE&S PUBLICATIONS";sheet.headerFooter.oddFooter = "&L" + name + "&RPage &P of &N";
    const split = (value, maximum) => {
      let rest = String(value ?? "");const parts = [];
      do {let end = Math.min(maximum, rest.length), lines = 0;for (let index = 0; index < end; index++) if (rest[index] === "\n" && ++lines === 8) {end = index + 1;break;}
        if (end > 0 && /[\uD800-\uDBFF]/.test(rest[end - 1]) && end < rest.length) end--;
        parts.push(rest.slice(0, end));rest = rest.slice(end);
      } while (rest.length);
      return parts;
    };
    const printableRows = rows.flatMap(values => {
      const left = split(values[0], 200), right = split(values[1], 450);
      return Array.from({length: Math.max(left.length, right.length)}, (_, index) => [left[index] || "", right[index] || ""]);
    });
    for (const [index, values] of printableRows.entries()) {
      const row = sheet.addRow(values.map(value => String(value ?? "")));row.alignment = {vertical: "top", wrapText: true};row.font = {name: "Aptos", size: 11, color: {argb: "FF21313A"}};
      row.height = Math.max(27, Math.min(390, Math.max(...values.map((value, column) => String(value ?? "").split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / (column ? 76 : 24))), 0))) * 16 + 14));
      if (index === 0) {row.fill = {type: "pattern", pattern: "solid", fgColor: {argb: "FF174B40"}};row.font = {name: "Aptos", size: 12, bold: true, color: {argb: "FFFFFFFF"}};}
    }
    sheet.pageSetup.printArea = `A$1:B$${sheet.rowCount}`;
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function publicationExport(edition, format) {
  if (format === "html") return {bytes: Buffer.from(renderPublicationHtml(edition)), mediaType: "text/html; charset=utf-8", extension: "html"};
  if (format === "docx") return {bytes: renderPublicationDocx(edition), mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extension: "docx"};
  if (format === "xlsx") return {bytes: await renderPublicationXlsx(edition), mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx"};
  if (format === "json") return {bytes: Buffer.from(JSON.stringify({format: "esia-publication-edition", schemaVersion: 1, rendererVersion: publicationRendererVersion, edition}, null, 2)), mediaType: "application/json; charset=utf-8", extension: "json"};
  throw Object.assign(new Error("Choose html, docx, xlsx or json publication format."), {status: 400, statusCode: 400});
}
