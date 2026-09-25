/*! NAMARI service worker | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   Offline shell for the installed app (PWA). build.py fills in the
   cache name and the file list and writes it to /sw.js.
   - the app page: network first (always the newest when online),
     the cached copy only when offline
   - manifest / icons: cache first
   - anything else, and every request to another origin (the Gemini API),
     is not touched: API traffic never goes through this cache
   ============================================================ */
'use strict';
const CACHE = 'namari-@CACHE@';
const ASSETS = @ASSETS@;                 // relative to this file; './' is the app page
const scope = new URL(self.registration.scope);
const isAppPage = url => url.pathname === scope.pathname || url.pathname === scope.pathname + 'index.html';
const isAsset = url => ASSETS.includes(url.pathname.slice(scope.pathname.length));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('namari-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (isAppPage(url)) {
    event.respondWith(fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put('./', copy)); }
        return res;
      })
      .catch(() => caches.match('./').then(hit => hit || Response.error())));
    return;
  }
  if (isAsset(url)) event.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req)));
});
