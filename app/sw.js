const SHELL = "cartelera-shell-v1", IMGS = "cartelera-img-v1";
const FILES = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(clients.claim()); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.pathname.endsWith("cartelera.json")) { // datos: red primero, caché si no hay conexión
    e.respondWith(fetch(e.request).then((r) => { const k = r.clone(); caches.open(SHELL).then((c) => c.put(e.request, k)); return r; }).catch(() => caches.match(e.request)));
  } else if (u.origin !== location.origin) { // pósters: caché primero
    e.respondWith(caches.open(IMGS).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }).catch(() => Response.error())));
  } else { // app: caché primero, actualiza en segundo plano
    e.respondWith(caches.match(e.request).then((hit) => { const net = fetch(e.request).then((r) => { const k = r.clone(); caches.open(SHELL).then((c) => c.put(e.request, k)); return r; }); return hit || net; }));
  }
});
