const CACHE_NAME = "nuzlocke-cache-v1";
const PRECACHE_URLS = ["/", "/index.html", "/manifest.json", "/rayquaza_icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("/index.html").then(cached =>
        cached || fetch("/index.html").then(res =>
          caches.open(CACHE_NAME).then(cache => {
            cache.put("/index.html", res.clone());
            return res;
          })
        )
      )
    );
    return;
  }

  if (req.method === "GET") {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req).then((res) => {
            if (res.status === 200 && new URL(req.url).origin === self.location.origin) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
            }
            return res;
          }).catch(() => cached)
        );
      })
    );
  }
});