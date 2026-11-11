// Gør, at Kogebog kan åbnes uden internet: nettet først, ellers den gemte kopi.
const LAGER = 'kogebog-v66';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith('http')) return;
  e.respondWith(
    fetch(r, { cache: 'no-cache' }).then(svar => {
      if (svar.ok || svar.type === 'opaque') { const kopi = svar.clone(); caches.open(LAGER).then(c => c.put(r, kopi)).catch(() => {}); }
      return svar;
    }).catch(() => caches.match(r, { ignoreVary: true }).then(gemt => gemt || Response.error()))
  );
});
