// Explicitly installed local fieldwork shell. Never cache API replies, source
// originals, drafts, identities or project metadata; those need encrypted stores.
const cacheName = "esia-fieldwork-static-v7";
const assets = ["/fieldwork", "/start.js", "/local-fieldwork.js", "/engagement-field-context.js", "/field-capture.js", "/lib/field-drafts.js", "/lib/field-disclosure.js", "/lib/field-transfer.js", "/lib/field-record-details.js", "/lib/field-device-policy.js", "/lib/document-classification.js", "/monitoring-private.js", "/lib/monitoring-protection.js", "/offline-review.js", "/lib/offline-review.js", "/lib/engagement-domain.js",
  "/theme.css", "/local-workspace.css", "/framework-workspace.css", "/source-intake.css", "/project-documents.css", "/spatial-preview.css",
  "/publication-manager.css", "/publication-studio.css", "/publication-reader.css", "/file-viewer.css", "/licenses.css", "/oversight-workspace.css",
  "/oversight-consolidation.css", "/oversight-comparison.css", "/field-capture.css", "/engagement-workspace.css", "/compact-interface.css"];
self.addEventListener("install", event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  await cache.addAll(assets);
  await self.skipWaiting();
})()));
self.addEventListener("activate", event => event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith("esia-fieldwork-static-")&&name!==cacheName)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !assets.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    if (url.pathname === "/fieldwork") {
      try {return await fetch(event.request);} catch {return await cache.match("/fieldwork") || Response.error();}
    }
    return await cache.match(url.pathname) || fetch(event.request);
  })());
});
