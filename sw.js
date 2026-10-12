/* 小狐狸邮局 V1.0 · 自托管离线应用壳。用户信件由 IndexedDB 单独保存。 */
const CACHE = 'little-fox-post-v1-20261012';
const SHELL = ['./','./index.html','./styles.css','./app.js','./png-export.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('little-fox-post-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if(response.ok && response.type === 'basic') {const clone = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, clone));}
    return response;
  })));
});
