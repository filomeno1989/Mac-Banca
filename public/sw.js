/**
 * Service Worker — Gestão de Banca (PWA)
 * Estratégia conservadora:
 *  - Nunca intercepta a API (/api/) — vendas e stock precisam de dados reais
 *  - Network-first com cache de apoio para navegações e estáticos
 *  - Se ficar offline, serve a última página conhecida
 */
const CACHE = 'banca-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Mesma origem apenas; nunca cachear a API
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const cacheable =
    req.mode === 'navigate' ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico';

  if (!cacheable) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const home = await caches.match('/');
          if (home) return home;
          return new Response(
            '<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem ligação</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;color:#065f46"><div style="text-align:center"><h1>Sem ligação à internet</h1><p>Verifica os dados móveis e tenta outra vez.</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
        return new Response('', { status: 504 });
      })
  );
});
