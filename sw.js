// Bump this version whenever you change the application files.
const CACHE = 'maply-shell-v1';
const SHELL = ['/', '/index.html', '/style.css', '/app.js', '/manifest.webmanifest', '/api/icon?size=192', '/api/icon?size=512'];
const LIBRARIES = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(async cache => {
    await cache.addAll(SHELL);
    await Promise.allSettled(LIBRARIES.map(url => cache.add(url)));
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('maply-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const local = url.origin === self.location.origin;
  const icon = local && url.pathname === '/api/icon';
  // Never intercept Supabase, configuration, or map tiles. No offline tile downloads.
  if (!icon && !LIBRARIES.includes(url.href) && !(local && (request.mode === 'navigate' || SHELL.includes(url.pathname)))) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok) {
        // Auth callback fragments and query parameters must never be persisted.
        const key = local && request.mode === 'navigate' ? '/' : request;
        await cache.put(key, response.clone());
      }
      return response;
    } catch {
      const saved = await cache.match(local && request.mode === 'navigate' ? '/' : request);
      return saved || new Response('Нет соединения. Открой Maply, когда появится интернет.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});
