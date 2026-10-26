// Navigation loads only a public shell. The report stays behind the local API guard.
const path = /^\/reports\/([A-Za-z0-9_.:-]+)\/([A-Za-z0-9_.:-]+)$/.exec(location.pathname);
try {
  if (!path) throw new Error("Choose an issued report in your local project.");
  const response = await fetch(`/api/projects/${encodeURIComponent(path[1])}/reports/${encodeURIComponent(path[2])}?format=html`, {
    headers: {"X-ESIA-Workspace": "local", "X-ESIA-Account": new URLSearchParams(location.search).get("account") || "local-default"}, credentials: "omit", redirect: "error", cache: "no-store"
  });
  if (!response.ok) {
    let message = `The issued report could not be opened (${response.status}).`;
    try {const result = await response.json();if (typeof result.error === "string") message = result.error;} catch {}
    throw new Error(message);
  }
  const page = new DOMParser().parseFromString(await response.text(), "text/html");
  if (!page.querySelector("main.gap-report") || page.querySelector("script,iframe,object,embed,base")) throw new Error("The report response is invalid.");
  document.title = page.title;
  document.body.className = page.body.className;
  document.body.replaceChildren(...[...page.body.childNodes].map(node => document.importNode(node, true)));
} catch (error) {
  const message = document.querySelector('[role="status"]');
  if (message) {message.setAttribute("role", "alert");message.textContent = error.message || "The issued report could not be opened.";}
}
