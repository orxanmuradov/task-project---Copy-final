const CACHE_NAME = 'task-manager-v1';
// Keşlənəcək faylların siyahısı (ehtiyac olarsa genişləndirilə bilər)
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Quraşdırma (Install) hadisəsi: Faylları keşləyirik
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Sorğu (Fetch) hadisəsi: Keşdən və ya şəbəkədən cavab veririk
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});