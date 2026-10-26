import {normalizePublicationContent} from "../lib/publication-records.js";
import {renderPublicationFragment, publicationReaderCss} from "../lib/publication-rendering.js";
import {publicationApiBase} from "../lib/publication-transport.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
const validId = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,191}(?![\s\S])/.test(value);
function publishedRecord(value, {catalog = false} = {}) {
  if (!value || !validId(value.id) || !validId(value.editionId) || !(catalog ? value.visibility === "public" : ["public", "unlisted"].includes(value.visibility)) ||
      typeof value.sha256 !== "string" || !/^[a-f0-9]{64}(?![\s\S])/.test(value.sha256) || typeof value.issuedAt !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z(?![\s\S])/.test(value.issuedAt) || !Number.isFinite(Date.parse(value.issuedAt))) throw new Error("The published edition identity is invalid.");
  return {...value, content: normalizePublicationContent(value.content)};
}
export function renderPublicationReader({invalidation, catalog = false} = {}) {
  const root = document.createElement("div");mountPublicationReader(root, {invalidation, catalog});return root;
}
export function mountPublicationReader(root, {invalidation, catalog = false, fetchImpl = globalThis.fetch, baseUrl} = {}) {
  const view = root.ownerDocument.defaultView, url = new URL(view.location.href), pathId = /^\/read\/([A-Za-z0-9_.:-]+)\/?$/.exec(url.pathname)?.[1];
  const publicationId = pathId || url.searchParams.get("publication"), token = new URLSearchParams(url.hash.slice(1)).get("token");
  const controller = new AbortController();let disposed = false, rows = [], cursor, apiBase;
  if (!root.ownerDocument.querySelector('[data-publication-reader-style],link[href="/publication-reader.css"]')) {const style = root.ownerDocument.createElement("style");style.dataset.publicationReaderStyle = "";style.textContent = publicationReaderCss;root.ownerDocument.head.append(style);}
  root.classList.add("publication-reader");root.innerHTML = '<p role="status">Loading published articles…</p>';
  async function request(path, body) {
    const response = await fetchImpl(`${apiBase}${path}`, {method: body ? "POST" : "GET", credentials: "omit", redirect: "error", cache: "no-store", signal: controller.signal,
      headers: body ? {"Content-Type": "application/json"} : {}, ...(body ? {body: JSON.stringify(body)} : {})});
    const result = await response.json();if (!response.ok) throw new Error(result.error || "This publication is unavailable or no longer shared.");return result;
  }
  function catalogMarkup(term = "") {
    const shown = rows.filter(row => [row.content.title, row.content.summary, ...row.content.authors, ...row.content.tags, ...row.content.subjects.map(subject => subject.name)].join(" ").toLowerCase().includes(term.toLowerCase().trim()));
    return shown.map(row => `<article class="pr-card"><p class="pr-kicker">${h(row.content.subjects.map(subject => `${subject.type}: ${subject.name}`).join(" · "))}</p><h2><a href="/read?publication=${encodeURIComponent(row.id)}">${h(row.content.title)}</a></h2>${row.content.subtitle ? `<p>${h(row.content.subtitle)}</p>` : ""}<p>${h(row.content.summary)}</p><p class="pr-byline">${h(row.content.authors.join(" · "))} · ${h(row.issuedAt.slice(0, 10))}</p><a class="pr-original-page" href="${h(apiBase)}/api/publication-pages/${encodeURIComponent(row.id)}">Open published web page</a></article>`).join("") || '<p>No public articles match.</p>';
  }
  function showCatalog() {
    root.innerHTML = `<header class="pr-header"><p class="pr-kicker">E&S publications</p><h1>Articles and publications</h1><p>Perspectives on clients, companies and projects.</p><a href="/publications">Open publication studio</a></header><label class="pr-search"><span>Find an article, company, client or project</span><input type="search" data-reader-search></label><div data-reader-list>${catalogMarkup()}</div>${cursor ? '<button type="button" data-reader-more>Load more publications</button>' : ""}`;
  }
  const ready = (async () => {
    apiBase = publicationApiBase(baseUrl ?? view.ESIA_API_BASE_URL ?? "", view.location.origin);
    if (catalog) {
      const result = await request("/api/publication-catalog");rows = result.publications.map(row => publishedRecord(row, {catalog: true}));cursor = result.hasMore ? result.nextCursor : null;
      if (!disposed) showCatalog();return;
    }
    if (!validId(publicationId) || token !== null && !/^[A-Za-z0-9_-]{43}(?![\s\S])/.test(token)) throw new Error("Open a complete publication link.");
    const result = await request("/api/publication-reads", {publicationId, ...(token ? {token} : {})}), publication = publishedRecord(result.publication);
    if (publication.id !== publicationId) throw new Error("The published edition identity is invalid.");
    const content = publication.content, digest = await view.crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(content)));
    if ([...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("") !== publication.sha256) throw new Error("The published edition failed its content integrity check.");
    if (disposed) return;
    view.document.title = `${content.title} | E&S publications`;
    if (publication.visibility === "unlisted") {const robots = root.ownerDocument.createElement("meta");robots.name = "robots";robots.content = "noindex,nofollow";root.ownerDocument.head.append(robots);}
    root.innerHTML = `<nav class="pr-navigation"><a href="/articles">All public publications</a><button type="button" data-reader-print>Print article</button></nav>${renderPublicationFragment(content, {id: publication.editionId, issuedAt: publication.issuedAt, sha256: publication.sha256})}`;
  })().catch(error => {if (!disposed && error.name !== "AbortError") {root.textContent = "";const message = root.ownerDocument.createElement("p");message.setAttribute("role", "alert");message.textContent = error.message;root.append(message);}});
  const onInput = event => {if (event.target.matches("[data-reader-search]")) root.querySelector("[data-reader-list]").innerHTML = catalogMarkup(event.target.value);};
  const onClick = async event => {
    if (event.target.matches("[data-reader-print]")) view.print();
    if (!event.target.matches("[data-reader-more]")) return;
    const button = event.target;button.disabled = true;
    try {const result = await request(`/api/publication-catalog?${new URLSearchParams({after: cursor})}`);if (disposed) return;
      rows.push(...result.publications.map(row => publishedRecord(row, {catalog: true})));cursor = result.hasMore ? result.nextCursor : null;
      root.querySelector("[data-reader-list]").innerHTML = catalogMarkup(root.querySelector("[data-reader-search]").value);if (!cursor) button.remove();}
    catch (error) {if (!disposed && error.name !== "AbortError") button.textContent = error.message || "Retry loading publications";}
    finally {if (!disposed) button.disabled = false;}
  };
  root.addEventListener("input", onInput);root.addEventListener("click", onClick);
  function dispose() {disposed = true;controller.abort();root.removeEventListener("input", onInput);root.removeEventListener("click", onClick);}
  if (invalidation?.then) invalidation.then(dispose, dispose);
  return {ready, dispose};
}
