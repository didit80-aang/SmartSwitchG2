// RelayFlow Pro - Service Worker v1.0
const CACHE_NAME = 'relayflow-pro-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/paho-mqtt/1.0.1/mqttws31.min.js'
];

// Install: cache semua asset statis
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching assets');
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => {
            console.log('[SW] Install complete');
            return self.skipWaiting();
        })
    );
});

// Activate: hapus cache lama
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => {
                    return name !== CACHE_NAME;
                }).map((name) => {
                    console.log('[SW] Deleting old cache:', name);
                    return caches.delete(name);
                })
            );
        }).then(() => {
            console.log('[SW] Activated');
            return self.clients.claim();
        })
    );
});

// Fetch: cache-first untuk static, network-first untuk MQTT WebSocket
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Jangan cache koneksi WebSocket MQTT
    if (url.hostname === 'broker.hivemq.com') {
        return;
    }
    
    // Jangan cache request POST atau API
    if (event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Kembalikan dari cache jika ada
            if (cachedResponse) {
                // Update cache di background (stale-while-revalidate)
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Network gagal, pakai cache
                    return cachedResponse;
                });
                
                // Kembalikan cache dulu
                return cachedResponse;
            }
            
            // Tidak ada di cache, fetch dari network
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200) {
                    return networkResponse;
                }
                
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                
                return networkResponse;
            }).catch(() => {
                // Offline fallback
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});

// Handle push notification (opsional)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'RelayFlow Pro';
    const options = {
        body: data.body || 'Perubahan status relay terdeteksi',
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        data: { url: './' }
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('./')
    );
});