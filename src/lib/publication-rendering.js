import {normalizePublicationContent} from "./publication-records.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
export const publicationRendererVersion = "esia-publication/1";
export const publicationReaderCss = `.publication-article{color-scheme:light;box-sizing:border-box;max-width:850px;margin:0 auto;padding:48px 46px;color:#21313a;background:#fff;font:17px/1.75 system-ui,sans-serif;overflow-wrap:anywhere}.publication-article *{box-sizing:border-box}.publication-article .pa-brand{color:#176147;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700}.publication-article h1{font-size:2.5em;line-height:1.15;margin:.4em 0}.publication-article h2,.publication-article h3{line-height:1.3;margin-top:1.6em}.publication-article .pa-subtitle{font-size:1.25em;color:#53646c}.publication-article .pa-byline,.publication-article .pa-edition{font-size:13px;color:#5b6c74}.publication-article .pa-summary{font-size:1.1em;border-left:4px solid #176147;padding:12px 20px;background:#f1f6f2;margin:30px 0}.publication-article .pa-subjects{display:flex;flex-wrap:wrap;gap:7px;padding:0;list-style:none}.publication-article .pa-subjects li{font-size:12px;background:#edf2f3;border-radius:4px;padding:4px 8px}.publication-article a{color:#0c6651;text-decoration:underline}.publication-article pre{padding:16px;white-space:pre-wrap;background:#f1f4f5;font-size:13px;overflow:auto}.publication-article code{font-size:.9em;background:#f1f4f5}.publication-article blockquote{margin-left:0;border-left:3px solid #9bb7aa;padding-left:20px}.publication-article .pa-citations{border-top:1px solid #d7e0df;margin-top:35px;padding-top:15px}.publication-article .pa-edition{border-top:1px solid #d7e0df;margin-top:35px;padding-top:15px;font-size:11px}.publication-article .pa-edition code{word-break:break-all}@media(max-width:620px){.publication-article{padding:28px 20px;font-size:16px}.publication-article h1{font-size:2em}}@media print{@page{size:A4;margin:18mm}.publication-article{padding:0;max-width:none;font-size:10.5pt}.publication-article h1{font-size:25pt}.publication-article h2,.publication-article h3{break-after:avoid}.publication-article p,.publication-article li{orphans:3;widows:3}.publication-article a{color:inherit}.publication-article pre{white-space:pre-wrap}}`;

function inline(value) {
  const source = String(value), pattern = /\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`/g;
  let result = "", offset = 0;
  for (const match of source.matchAll(pattern)) {
    result += h(source.slice(offset, match.index));offset = match.index + match[0].length;
    if (match[1]) {
      let url;
      try {url = new URL(match[2]);} catch {}
      result += url && ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
        ? `<a href="${h(url.href)}" rel="noopener noreferrer">${h(match[1])}</a>` : h(match[0]);
    } else result += match[3] ? `<strong>${h(match[3])}</strong>` : `<code>${h(match[4])}</code>`;
  }
  return result + h(source.slice(offset));
}
export function publicationBlocks(body) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n"), blocks = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {index++;continue;}
    if (/^```/.test(line)) {const content = [];index++;while (index < lines.length && !/^```/.test(lines[index])) content.push(lines[index++]);if (index < lines.length) index++;blocks.push({type: "code", text: content.join("\n")});continue;}
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {blocks.push({type: "heading", level: heading[1].length, text: heading[2]});index++;continue;}
    const list = /^(?:[-*]|\d+[.)])\s+(.+)$/.exec(line);
    if (list) {const ordered = /^\d/.test(line), items = [];while (index < lines.length) {const item = (ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*]\s+(.+)$/).exec(lines[index]);if (!item) break;items.push(item[1]);index++;}blocks.push({type: "list", ordered, items});continue;}
    if (/^>\s?/.test(line)) {blocks.push({type: "quote", text: line.replace(/^>\s?/, "")});index++;continue;}
    const content = [line];index++;
    while (index < lines.length && lines[index].trim() && !/^(?:#{1,4}\s|```|[-*]\s|\d+[.)]\s|>)/.test(lines[index])) content.push(lines[index++]);
    blocks.push({type: "paragraph", text: content.join("\n")});
  }
  return blocks;
}
export function renderPublicationFragment(value, edition = {}) {
  const content = normalizePublicationContent(value);
  const body = publicationBlocks(content.body).map(block => block.type === "heading" ? `<h${Math.min(block.level + 1, 5)}>${inline(block.text)}</h${Math.min(block.level + 1, 5)}>` :
    block.type === "list" ? `<${block.ordered ? "ol" : "ul"}>${block.items.map(item => `<li>${inline(item)}</li>`).join("")}</${block.ordered ? "ol" : "ul"}>` :
      block.type === "code" ? `<pre><code>${h(block.text)}</code></pre>` : block.type === "quote" ? `<blockquote>${inline(block.text)}</blockquote>` : `<p>${inline(block.text).replaceAll("\n", "<br>")}</p>`).join("\n");
  return `<article class="publication-article"><header><p class="pa-brand">E&amp;S publications</p><h1>${h(content.title)}</h1>${content.subtitle ? `<p class="pa-subtitle">${h(content.subtitle)}</p>` : ""}<p class="pa-byline">${h(content.authors.join(" · ") || "Author not recorded")}${edition.issuedAt ? ` · ${h(edition.issuedAt.slice(0, 10))}` : " · Draft preview"}</p>${content.subjects.length ? `<ul class="pa-subjects" aria-label="Publication subjects">${content.subjects.map(subject => `<li>${h(subject.type)}: ${subject.url ? `<a href="${h(subject.url)}" rel="noopener noreferrer">${h(subject.name)}</a>` : h(subject.name)}</li>`).join("")}</ul>` : ""}</header>${content.summary ? `<div class="pa-summary">${h(content.summary).replaceAll("\n", "<br>")}</div>` : ""}<div class="pa-body">${body || "<p>No publication body has been authored.</p>"}</div>${content.citations.length ? `<section class="pa-citations"><h2>References</h2><ol>${content.citations.map(citation => `<li><a href="${h(citation.url)}" rel="noopener noreferrer">${h(citation.title)}</a>${citation.locator ? ` — ${h(citation.locator)}` : ""}</li>`).join("")}</ol></section>` : ""}${content.tags.length ? `<p class="pa-byline">Topics: ${h(content.tags.join(" · "))}</p>` : ""}${edition.id ? `<footer class="pa-edition">Frozen edition <code>${h(edition.id)}</code>${edition.sha256 ? ` · Content SHA256 <code>${h(edition.sha256)}</code>` : ""}<br>Generated with ${publicationRendererVersion}. This article discloses its authored content and references; it does not grant access to project source files.</footer>` : ""}</article>`;
}
export function renderPublicationHtml(edition, {visibility = "private"} = {}) {
  const content = normalizePublicationContent(edition.content);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">${visibility !== "public" ? '<meta name="robots" content="noindex,nofollow">' : ""}<title>${h(content.title)}</title><meta name="description" content="${h(content.summary.slice(0, 300))}"><style>${publicationReaderCss}</style></head><body>${renderPublicationFragment(content, edition)}</body></html>`;
}

