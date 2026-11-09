const CACHE = 'chan-files-v2';
const DAY = 24 * 60 * 60 * 1000;

function cacheable(url) {
  const path = url.pathname.toLowerCase();
  if (path === '/sw.js' || path.endsWith('.json') || path.endsWith('.html') || path.endsWith('/')) return false;
  return /\.(jpe?g|png|gif|webp|avif|mp4|webm|mov|m4v|css|js|mjs|ico|svg|woff2?)$/.test(path);
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin || !cacheable(url)) return;
  event.respondWith(fromCache(req));
});

async function fromCache(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req.url);
  if (hit) {
    const at = Number(hit.headers.get('x-cached-at') || 0);
    if (at && Date.now() - at < DAY) return sliceRange(hit, req);
  }
  let res;
  try {
    res = await fetch(new Request(req.url, { method: 'GET', credentials: 'same-origin' }));
  } catch (e) {
    if (hit) return sliceRange(hit, req);
    throw e;
  }
  if (!res || !res.ok || res.status === 206) {
    if (hit) return sliceRange(hit, req);
    return res;
  }
  const headers = new Headers(res.headers);
  headers.set('x-cached-at', String(Date.now()));
  headers.set('Accept-Ranges', 'bytes');
  const stored = new Response(await res.clone().blob(), {
    status: res.status,
    statusText: res.statusText,
    headers: headers
  });
  const forPage = stored.clone();
  try { await cache.put(req.url, stored); } catch (e) {}
  return sliceRange(forPage, req);
}

async function sliceRange(response, req) {
  const range = req.headers.get('range');
  if (!range) return response;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  const buf = await response.clone().arrayBuffer();
  const size = buf.byteLength;
  if (!match) return response;
  let start = match[1] === '' ? NaN : Number(match[1]);
  let end = match[2] === '' ? size - 1 : Number(match[2]);
  if (Number.isNaN(start)) start = Math.max(0, size - (Number.isNaN(end) ? 0 : end));
  if (Number.isNaN(end) || end >= size) end = size - 1;
  if (start > end || start >= size) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': 'bytes */' + size }
    });
  }
  const body = buf.slice(start, end + 1);
  const headers = new Headers(response.headers);
  headers.delete('x-cached-at');
  headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
  headers.set('Content-Length', String(body.byteLength));
  headers.set('Accept-Ranges', 'bytes');
  return new Response(body, { status: 206, statusText: 'Partial Content', headers: headers });
}
