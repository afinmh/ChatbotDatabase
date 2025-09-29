// Minimal service worker to avoid 404 logs. No-op install/activate and pass-through fetch.
self.addEventListener('install', (event) => {
  // Activate worker immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of uncontrolled clients immediately
  event.waitUntil(self.clients.claim());
});

// Simple fetch handler that forwards requests (no caching)
self.addEventListener('fetch', (event) => {
  // For now, just forward the request; useful for PWA shells that expect /sw.js
  event.respondWith(fetch(event.request));
});

/* Note: This service worker is intentionally minimal. Replace or extend with
   real caching/runtime logic if you plan to make a PWA. */
