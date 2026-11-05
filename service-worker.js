const CACHE_NAME = "action-cards:v78";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./mountain.css",
  "./app.js",
  "./modules/activity.js",
  "./modules/swipe.js",
  "./modules/practice-selection.js",
  "./modules/card-import.js",
  "./modules/profile-backup.js",
  "./modules/workspace.js",
  "./modules/study-session.js",
  "./modules/text-library.js",
  "./journey.css",
  "./assets/themes/alpine.jpg",
  "./assets/themes/snow.jpg",
  "./assets/themes/forest.jpg",
  "./assets/themes/desert.jpg",
  "./assets/themes/moon.jpg",
  "./assets/themes/ocean.jpg",
  "./assets/themes/aurora.jpg",
  "./assets/themes/sunrise.jpg",
  "./assets/themes/stone.jpg",
  "./default-cards.json",
  "./manifest.webmanifest",
  "./icon.svg",
  "./assets/icons.svg",
];
const ASSET_SET = new Set(ASSETS);

self.addEventListener("install", (event) => {
  // Reload shell files so a previous HTML fallback cannot survive as a cached stylesheet.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS.map((asset) => new Request(new URL(asset, self.location), { cache: "reload" })))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("action-cards:v") && key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const downloadedImage = url.origin !== self.location.origin ? event.request.destination === "image" : url.pathname.startsWith("/images/") || url.pathname.startsWith("/assets/ai/");
  if (event.request.method === "GET" && downloadedImage) {
    event.respondWith((async () => await caches.match(event.request) || fetch(event.request).catch(() => new Response("Image not downloaded", { status: 503 })))());
    return;
  }
  if (event.request.method !== "GET" || !isStaticAssetRequest(event.request)) return;

  const refreshShell = url.pathname === "/" || /\.(?:html|css|js|webmanifest)$/.test(url.pathname);
  event.respondWith(
    fetch(event.request, { cache: refreshShell ? "no-cache" : "default" })
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
