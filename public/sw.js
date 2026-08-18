/**
 * Presence PWA Service Worker
 * Provides offline support and install capability.
 */

const CACHE_NAME = 'presence-v3';
const STATIC_ASSETS = ['/', '/index.html', '/app'];

// Install: cache static shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Push: show the notification delivered by the server (daily reminder / smart alert).
self.addEventListener('push', (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: 'Presence', body: event.data ? event.data.text() : '' };
    }
    const title = data.title || 'Presence';
    const options = {
        body: data.body || '',
        icon: '/icon192.png',
        badge: '/icon192.png',
        tag: data.tag || 'presence-reminder',
        data: { url: data.url || '/app' },
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click: focus an existing app window or open a new one.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = (event.notification.data && event.notification.data.url) || '/app';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) {
                if (client.url.includes(target) && 'focus' in client) return client.focus();
            }
            if (self.clients.openWindow) return self.clients.openWindow(target);
        })
    );
});

// Fetch: network-first for everything — ensures users always get fresh code.
// Falls back to cache only when offline.
self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // Skip Firebase/external API calls — always go to network
    const url = new URL(event.request.url);
    if (
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis.com') ||
        // Vercel Web Analytics — never cache the beacon or its script, or the
        // offline cache would start replaying stale analytics assets.
        url.pathname.startsWith('/_vercel/')
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cache successful same-origin responses for offline fallback
                if (
                    response.ok &&
                    response.type === 'basic' &&
                    event.request.url.startsWith(self.location.origin)
                ) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Network failed — serve from cache if available
                return caches.match(event.request);
            })
    );
});
