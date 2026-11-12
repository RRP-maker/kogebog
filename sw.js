// Gør, at Kogebog kan åbnes uden internet: nettet først, ellers den gemte kopi.
// Versionen kommer fra adressen (sw.js?v=…), som index.html sætter. Den står kun i index.html.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'ukendt';
const LAGER = 'kogebog-' + VERSION;
const SKRIFTER = ['caveat-brush-latin-400-normal', 'patrick-hand-latin-400-normal', 'caveat-brush-latin-ext-400-normal', 'patrick-hand-latin-ext-400-normal'].map(n => 'skrifter/' + n + '.woff2');

// Skrifterne gemmes med det samme, så de også virker uden internet første gang
self.addEventListener('install', e => {
  e.waitUntil(caches.open(LAGER).then(c => Promise.all(SKRIFTER.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
// Gamle versioners kopier slettes
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(navne => Promise.all(navne.filter(n => n !== LAGER).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
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
