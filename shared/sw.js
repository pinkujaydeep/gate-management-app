const CACHE_NAME = 'gate-keeper-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/firebase-config.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install Event
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(err => console.log('Cache error:', err))
    );
    
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
                        .map(name => caches.delete(name))
                );
            })
    );
    
    return self.clients.claim();
});

// Fetch Event - Network First Strategy for API, Cache First for Static Assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Chrome extensions and external requests
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    // Network first for Firebase and API calls
    if (url.hostname.includes('firebase') || url.hostname.includes('firestore')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Cache first for static assets
    event.respondWith(cacheFirst(request));
});

// Cache First Strategy
async function cacheFirst(request) {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    
    if (cached) {
        return cached;
    }
    
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const dynamicCache = await caches.open(DYNAMIC_CACHE);
            dynamicCache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Return offline page if available
        const offlineResponse = await cache.match('/index.html');
        return offlineResponse || new Response('Offline - Please check your internet connection', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Network First Strategy
async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cache = await caches.open(DYNAMIC_CACHE);
        const cached = await cache.match(request);
        return cached || new Response('Network error', {
            status: 408,
            statusText: 'Network timeout'
        });
    }
}

// Background Sync (if supported)
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync', event.tag);
    
    if (event.tag === 'sync-visitors') {
        event.waitUntil(syncVisitors());
    }
});

async function syncVisitors() {
    // Implement background sync logic if needed
    console.log('Syncing visitors data...');
}

// Push Notifications (if needed in future)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    
    const options = {
        body: data.body || 'New notification',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: data
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'GateKeeper', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});
