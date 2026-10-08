const CACHE_NAME = "action-cards:v69";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./modules/activity.js",
  "./modules/swipe.js",
  "./modules/practice-selection.js",
  "./default-cards.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/icons.svg",
];
const ASSET_SET = new Set(ASSETS);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !isStaticAssetRequest(event.request)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

function isStaticAssetRequest(request) {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/images/")) return false;

  const assetPath = url.pathname === "/" ? "./" : `.${url.pathname}`;
  return ASSET_SET.has(assetPath) || url.pathname.startsWith("/assets/");
}
