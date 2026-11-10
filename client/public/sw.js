/* JeevanGrid service worker — official-warning push delivery AND offline browsing.
 *
 * Push: every notification states JeevanGrid is RELAYING an official warning;
 * JeevanGrid never claims to have issued it.
 *
 * Offline: only public, non-personal GET endpoints are cached. Cached API
 * responses carry X-JG-Cached-At so the UI can say how old the data is. User
 * reports and private dashboards are never cached.
 */

const CACHE_VERSION = 'jeevangrid-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;

const PRECACHE = ['/', '/index.html'];

const CACHEABLE_API_PREFIXES = [
  '/api/alerts',
  '/api/guides',
  '/api/resources',
  '/api/risk',
  '/api/languages',
  '/api/facilities',
  '/api/geo',
  '/api/earthquakes',
  '/api/weather',
  '/api/aqi',
  '/api/advisories',
];

function isPublicApi(url) {
  return CACHEABLE_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

function isPrivateApi(url) {
  return url.pathname.startsWith('/api/') && !isPublicApi(url);
}

function shouldCacheRequest(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@') || url.pathname.startsWith('/node_modules/')) {
    return false;
  }
  if (isPrivateApi(url)) return false;
  return true;
}

async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const body = await response.clone().text();
      const headers = new Headers(response.headers);
      const fetchedAt = new Date().toISOString();
      headers.set('X-JG-Cached-At', fetchedAt);
      const tagged = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, tagged.clone()).catch(() => undefined);
      return tagged;
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      const body = await cached.text();
      const headers = new Headers(cached.headers);
      headers.set('X-JG-Cache-Hit', '1');
      return new Response(body, {
        status: cached.status,
        statusText: cached.statusText,
        headers,
      });
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone()).catch(() => undefined);
      return response;
    })
    .catch(() => null);
  return cached || network || fetch(request);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('jeevangrid-') && key !== STATIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!shouldCacheRequest(request)) return;
  const url = new URL(request.url);

  // App navigation: try the network, fall back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches
            .open(STATIC_CACHE)
            .then((cache) => cache.put('/index.html', response.clone()))
            .catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(STATIC_CACHE);
          const shell = (await cache.match('/index.html')) || (await cache.match('/'));
          return (
            shell ||
            new Response(
              '<!doctype html><html><body style="font-family:system-ui;padding:2rem"><h1>JeevanGrid is offline</h1><p>This page was not cached yet. Reconnect to load it. For a life-threatening emergency call 112.</p></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
            )
          );
        })
    );
    return;
  }

  if (isPublicApi(url)) {
    event.respondWith(networkFirstWithCache(request, API_CACHE));
    return;
  }

  // Same-origin static assets (JS, CSS, icons, manifest).
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'Official Disaster Alert (relayed by JeevanGrid)',
      body: 'A new official warning may affect your district. Open JeevanGrid Alerts to verify.',
    };
  }
  const title = payload.title || 'Official Disaster Alert (relayed by JeevanGrid)';
  const options = {
    body: payload.body || 'An official warning may affect your subscribed district.',
    tag: payload.tag || 'jeevangrid-official-alert',
    renotify: true,
    data: payload.data || { url: '/alerts' },
    badge: '/favicon.svg',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/alerts';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});
