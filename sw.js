const CACHE = "nail-cut-mobile-v24";
const SHELL = [
  "./", "./index.html", "./ads-config.js?v=24", "./game-ads.js?v=24", "./background-settings.js?v=16", "./style.css?v=12", "./app.js?v=24", "./manifest.webmanifest",
  "./assets/couple-background.jpg", "./assets/elephant-nail.png", "./assets/fingernail-cursor.png",
  "./assets/icon-192.png", "./assets/icon-512.png",
  "./assets/icon-maskable-512.png", "./assets/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const path of SHELL) {
      // Reuse unchanged, versioned resources from the existing installed game.
      // Updated pages and settings code must always come from the new release.
      const fresh = path === "./" || path === "./index.html" || path.startsWith("./background-settings.js") || path.startsWith("./ads-config.js") || path.startsWith("./game-ads.js");
      const previous = fresh ? null : await caches.match(new URL(path, self.registration.scope).href);
      if (previous) await cache.put(path, previous);
      else await cache.add(path);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith("nail-cut-mobile-") && key !== CACHE).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match("./index.html")) || fetch(request)));
  } else {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request)) || fetch(request)));
  }
});
