// Efuture Games - service worker: tiene i giochi sul telefono per giocare anche con poca rete.
// Quando aggiorni l'app, cambia il numero di versione qui sotto.
const CACHE = 'efuture-games-v26';
const ASSETS = [
  "./",
  "config.js",
  "fonts/ibm-plex-mono-latin-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-600-normal.woff2",
  "fonts/press-start-2p-latin-400-normal.woff2",
  "games/coretech/fonts/ibm-plex-mono-latin-400-normal.woff2",
  "games/coretech/fonts/ibm-plex-mono-latin-600-normal.woff2",
  "games/coretech/fonts/press-start-2p-latin-400-normal.woff2",
  "games/coretech/game.js",
  "games/coretech/icons/apple-touch-icon.png",
  "games/coretech/icons/favicon.png",
  "games/coretech/icons/icon-192.png",
  "games/coretech/icons/icon-512.png",
  "games/coretech/icons/icon-maskable-512.png",
  "games/coretech/img/coretech-logo.png",
  "games/coretech/img/efuture-white.png",
  "games/coretech/index.html",
  "games/inncloud/fonts/ibm-plex-mono-latin-400-normal.woff2",
  "games/inncloud/fonts/ibm-plex-mono-latin-600-normal.woff2",
  "games/inncloud/fonts/press-start-2p-latin-400-normal.woff2",
  "games/inncloud/game.js",
  "games/inncloud/icons/apple-touch-icon.png",
  "games/inncloud/icons/favicon.png",
  "games/inncloud/icons/icon-192.png",
  "games/inncloud/icons/icon-512.png",
  "games/inncloud/icons/icon-maskable-512.png",
  "games/inncloud/img/efuture-white.png",
  "games/inncloud/img/inncloud-logo.png",
  "games/inncloud/index.html",
  "games/sysadmin/fonts/ibm-plex-mono-latin-400-normal.woff2",
  "games/sysadmin/fonts/ibm-plex-mono-latin-500-normal.woff2",
  "games/sysadmin/fonts/ibm-plex-mono-latin-600-normal.woff2",
  "games/sysadmin/fonts/press-start-2p-latin-400-normal.woff2",
  "games/sysadmin/icons/apple-touch-icon.png",
  "games/sysadmin/icons/favicon.png",
  "games/sysadmin/icons/icon-192.png",
  "games/sysadmin/icons/icon-512.png",
  "games/sysadmin/icons/icon-maskable-512.png",
  "games/sysadmin/img/efuture-white.png",
  "games/sysadmin/img/logo-testa.png",
  "games/sysadmin/index.html",
  "games/timenet/fonts/ibm-plex-mono-latin-400-normal.woff2",
  "games/timenet/fonts/ibm-plex-mono-latin-600-normal.woff2",
  "games/timenet/fonts/press-start-2p-latin-400-normal.woff2",
  "games/timenet/game.js",
  "games/timenet/icons/apple-touch-icon.png",
  "games/timenet/icons/favicon.png",
  "games/timenet/icons/icon-192.png",
  "games/timenet/icons/icon-512.png",
  "games/timenet/icons/icon-maskable-512.png",
  "games/timenet/img/efuture-white.png",
  "games/timenet/img/timenet-logo.png",
  "games/timenet/img/delfino.png",
  "games/timenet/index.html",
  "hub.js",
  "backend.js",
  "classifica.html",
  "qr/qr-app.png",
  "fonts/poppins-latin-600-normal.woff2",
  "fonts/poppins-latin-400-normal.woff2",
  "fonts/poppins-latin-300-normal.woff2",
  "fonts/montserrat-latin-800-normal.woff2",
  "fonts/montserrat-latin-700-normal.woff2",
  "fonts/montserrat-latin-500-normal.woff2",
  "icons/apple-touch-icon.png",
  "icons/favicon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "img/efuture-logo-white.png",
  "img/efuture-logo.png",
  "img/efuture-white.png",
  "img/g-coretech.png",
  "img/g-inncloud.png",
  "img/g-sysadmin.png",
  "img/g-timenet.png",
  "index.html",
  "manifest.webmanifest",
  "vendor/591.supabase.js",
  "vendor/jsQR.js",
  "vendor/supabase.js"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // classifica e login vanno sempre in rete
  // pagine e script: sempre la versione più recente dalla rete (la copia salvata serve solo offline)
  if (e.request.mode === 'navigate' || /\.(html|js|webmanifest)$/.test(url.pathname)) {
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { const c = r.clone(); caches.open(CACHE).then((k) => k.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match('index.html'))));
  } else {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
  }
});
