/* 오프라인 캐시. 캐시가 있으면 바로 주고 뒤에서 새 걸 받아 갈아끼움.
   파일을 바꾸면 VERSION 을 올려서 옛 캐시를 지운다. */
const VERSION = 'lantern-deep-v3';
const ASSETS = ['./', './index.html', './style.css', './game.js', './icon.svg', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lantern-deep-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  e.respondWith(caches.open(VERSION).then((c) => c.match(key).then((hit) => {
    const fresh = fetch(req, { cache: 'no-cache' })
      .then((res) => { if (res && res.ok) c.put(key, res.clone()).catch(() => {}); return res; });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh;
  })));
});
