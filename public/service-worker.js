const CACHE_NAME = "nuzlocke-cache-v";

// Nur App-Shell pre-cachen (klein halten!)
const PRECACHE_URLS = ["/", "/index.html", "/manifest.json", "/rayquaza_icon.png"];

// --- Messages (für sofortiges Update) ---
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Helper: same-origin?
function isSameOrigin(req) {
  try {
    return new URL(req.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Nur GET anfassen
  if (req.method !== "GET") return;

  // Nur same-origin cachen (wichtig: keine pokeapi/githubusercontent in cache ziehen)
  if (!isSameOrigin(req)) return;

  // 1) NAVIGATION: network-first (damit Updates immer kommen)
  // 1) NAVIGATION: iOS-safe network-first (niemals Redirects aus SW)
if (req.mode === "navigate") {
  event.respondWith(
    (async () => {
      try {
        // iOS-safe: niemals fetch(req), sondern direkt index.html holen
        const fresh = await fetch("/index.html", { cache: "no-store" });

        const cache = await caches.open(CACHE_NAME);
        cache.put("/index.html", fresh.clone());

        return fresh;
      } catch {
        const cached = await caches.match("/index.html");
        return cached || Response.error();
      }
    })()
  );
  return;
}

  // 2) ASSETS: cache-first (schnell), aber mit Network-Fallback
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const res = await fetch(req);

        // Nur gute Responses cachen
        if (res && res.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        // Wenn offline und nichts im Cache: Fehler
        return cached || Response.error();
      }
    })()
  );
});
