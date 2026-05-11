// Service worker for the score-entry app shell.
//
// Caches the static assets the form needs to load and run with zero
// network — HTML, CSS, JS, fonts, design-system files, the
// supabase-js bundle. Supabase REST/Realtime requests are
// network-only (cache-busting them would defeat the queue model).
//
// Bump CACHE_NAME on every deploy that changes any of these files.

const CACHE_NAME = 'mmp-golf-v3';

const SHELL = [
  './score-entry.html',
  './score-entry.css',
  './styles.css',
  './supabase-config.js',
  './lib/queue.js',
  './lib/golf-data.js',
  '../design-system/tokens.css',
  '../design-system/components.css',
  '../design-system/assets/mmp-mark.svg',
  '../design-system/assets/mmp-lockup.svg',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll is all-or-nothing; one missing URL kills the install.
      // We tolerate misses to keep the worker resilient (e.g. if a
      // CDN URL changes between deploys).
      Promise.all(SHELL.map((url) =>
        cache.add(url).catch((err) => {
          console.warn('[sw] precache miss', url, err.message);
        })
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache Supabase REST / Realtime / auth — those need to be
  // live for queue draining and Realtime subscriptions.
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in')) {
    return;
  }

  // Cache-first for the precached app shell; stale-while-revalidate
  // for everything else within scope.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // Refresh in the background so the next visit gets newer assets.
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then((res) => {
        // Only cache successful, basic/cors responses.
        if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
