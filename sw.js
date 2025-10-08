/**
 * DonorDex Service Worker
 * Provides offline support and caching for PWA functionality
 */

const CACHE_NAME = 'donordex-v4';
const RUNTIME_CACHE = 'donordex-runtime-v4';

// Files to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/database.js',
    '/js/utils.js',
    '/js/search.js',
    '/js/filters.js',
    '/js/import-export.js',
    '/js/ui.js',
    '/js/app.js',
    '/lib/dexie.min.js',
    '/icon.svg',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim(); // Take control immediately
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Skip Chrome extension requests
    if (event.request.url.includes('chrome-extension://')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response if found
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Clone the request because it can only be used once
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest)
                    .then((response) => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response because it can only be used once
                        const responseToCache = response.clone();

                        // Cache the fetched response for future use
                        caches.open(RUNTIME_CACHE)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch((error) => {
                        console.error('[Service Worker] Fetch failed:', error);

                        // Return a custom offline page if available
                        return caches.match('/index.html');
                    });
            })
    );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                console.log('[Service Worker] All caches cleared');
                event.ports[0].postMessage({ success: true });
            })
        );
    }
});

// Periodic background sync (if supported)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        console.log('[Service Worker] Background sync triggered');
        // Could implement background data sync here if needed
    }
});

console.log('[Service Worker] Loaded');
