import {mountPublicationManager} from "./publication-manager.js";
import {publicationReaderCss} from "../lib/publication-rendering.js";

const h = value => String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
export function renderPublicationStudio({invalidation} = {}) {
  const root = document.createElement("div");mountPublicationStudio(root, {invalidation});return root;
}
export function mountPublicationStudio(root, {invalidation} = {}) {
  const view = root.ownerDocument.defaultView, query = new URL(view.location.href).searchParams;
  const local = view.location.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(view.location.hostname);
  const drafts = new Map();let disposed = false, mounted, busy = false, accounts = [], selected = query.get("account") || "local-default", api;
  const controller = new AbortController();
  root.classList.add("publication-studio-shell");
  if (!local && !root.ownerDocument.querySelector("[data-publication-reader-style]")) {const style = root.ownerDocument.createElement("style");style.dataset.publicationReaderStyle = "";style.textContent = publicationReaderCss;root.ownerDocument.head.append(style);}
  const notifyError = error => {if (!disposed) root.querySelector("[data-studio-message]").textContent = error.message || "Publication service unavailable.";};
  function shell() {
    root.innerHTML = `<nav class="ps-navigation" aria-label="Publication navigation"><a href="${local ? '/?account=' + encodeURIComponent(selected) : '/project'}">Projects and evidence</a><a href="${local ? '/frameworks?account=' + encodeURIComponent(selected) : '/frameworks'}">Frameworks</a>${local ? "" : '<a href="/articles">Read publications</a>'}</nav><div class="ps-account"><label><span>${local ? "Local storage account" : "Publication workspace"}</span><select data-studio-account>${!accounts.some(account => account.id === selected) ? '<option value="">Select an available account</option>' : ""}${accounts.map(account => `<option value="${h(account.id)}"${account.id === selected ? " selected" : ""}>${h(account.name)}</option>`).join("")}</select></label><p data-studio-message role="status">${local ? "Author and export locally. Online sharing uses the authenticated hosted publication service." : "Private collaborators and published audiences are controlled by the hosted service."}</p></div><div data-studio-manager></div>`;
  }
  async function localRequest(path, {method = "GET", body, binary = false} = {}, runtimeId = selected) {
    const response = await fetch(path, {method, credentials: "omit", cache: "no-store", redirect: "error", signal: controller.signal,
      headers: {"X-ESIA-Workspace": "local", "X-ESIA-Account": runtimeId, ...(body === undefined ? {} : {"Content-Type": "application/json"})},
      ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    if (!response.ok) {let message;try {const result = await response.json();message = result.error?.message || result.error;} catch {}throw Object.assign(new Error(message || `Publication request failed (${response.status}).`), {status: response.status});}
    return binary ? response.blob() : response.json();
  }
  function mountAccount(initialPublication) {
    mounted?.dispose();shell();
    const account = accounts.find(item => item.id === selected);
    if (!account) {notifyError(new Error("Select an available storage account to open its publication studio."));return;}
    if (!drafts.has(selected)) drafts.set(selected, {});
    const runtimeId = selected, stableId = local ? account.custodyId : account.id;
    const request = local ? async (path, options) => {
      const result = await localRequest(path, options, runtimeId);
      return path === "/api/projects" ? result.map(project => ({...project, accountId: stableId})) : result;
    } : (path, options) => api.request(path, options);
    mounted = mountPublicationManager(root.querySelector("[data-studio-manager]"), {request, accountId: stableId,
      projectId: query.get("project") || "", initialPublication, mode: local ? "local" : "hosted", state: drafts.get(selected),
      identityIssuer: local ? undefined : account.identityIssuer,
      onBusyChange: value => {busy = value;const select = root.querySelector("[data-studio-account]");if (select) select.disabled = value;}});
  }
  const onChange = event => {
    if (!event.target.matches("[data-studio-account]")) return;
    if (busy) {event.target.value = selected;return;}
    selected = event.target.value;const url = new URL(view.location.href);url.searchParams.set("account", selected);url.searchParams.delete("project");url.searchParams.delete("publication");view.history.replaceState(null, "", url);
    query.delete("project");mountAccount();
  };
  root.addEventListener("change", onChange);shell();
  const ready = (async () => {
    if (local) {accounts = await localRequest("/api/storage-accounts");if (!disposed) mountAccount();return;}
    const [{loadAuthSession, beginSignIn}, {createEsiaApiClient}, {getCognitoAuthConfig}] = await Promise.all([
      import("../lib/cognito-auth.js"), import("../lib/access-api.js"), import("../lib/auth-config.js")]);
    const auth = await loadAuthSession();if (disposed) return;
    if (auth.status !== "authenticated") {
      root.querySelector("[data-studio-message]").textContent = "Sign in to manage private articles and publication access.";
      const button = root.ownerDocument.createElement("button");button.type = "button";button.textContent = "Sign in";button.addEventListener("click", () => beginSignIn());root.querySelector("[data-studio-manager]").append(button);return;
    }
    api = createEsiaApiClient({baseUrl: view.ESIA_API_BASE_URL || "", origin: view.location.origin, getSession: () => auth.session});
    await api.session();
    const config = getCognitoAuthConfig(), identityIssuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
    let initialPublication;
    if (query.get("publication")) initialPublication = (await api.request(`/api/publications/${encodeURIComponent(query.get("publication"))}`)).publication;
    const result = await api.request("/api/accounts");
    accounts = result.accounts.map(account => ({id: account.account_id, name: account.name, identityIssuer}));
    if (initialPublication && !accounts.some(account => account.id === initialPublication.accountId)) accounts.push({id: initialPublication.accountId, name: "Shared publication workspace", identityIssuer});
    selected = initialPublication?.accountId || (accounts.some(account => account.id === query.get("account")) ? query.get("account") : accounts[0]?.id || "");
    if (!disposed) mountAccount(initialPublication);
  })().catch(notifyError);
  function dispose() {disposed = true;controller.abort();mounted?.dispose();root.removeEventListener("change", onChange);}
  if (invalidation?.then) invalidation.then(dispose, dispose);
  return {ready, dispose};
}
