// オフライン用 service worker
// ゲームのファイルを更新したら VERSION を上げる。
// → 次にアプリを開いたとき裏で新しい版を取得し、その次の起動から新しい版に切り替わる。
// ファイルを増やしたら ASSETS にも足す（1つでも取得できないとインストールが失敗する）。
const VERSION = '1.7.2';
const CACHE = 'lootrunner-' + VERSION;
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js',
  'js/util.js',
  'js/data.js',
  'js/items.js',
  'js/save.js',
  'js/ui.js',
  'js/base.js',
  'js/settings.js',
  'js/offline.js',
  'js/run.js',
  'js/audio.js',
  'js/skills.js',
  'js/render.js',
  'js/meta.js',
  'js/hub.js',
  'js/icons.js',
  'js/hero.js',
  'js/camp.js',
  'js/title.js',
  'js/skillart.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // HTTP キャッシュを通さず、必ずサーバーから最新を取る
      .then(c => c.addAll(ASSETS.map(u => new Request(u, {cache:'reload'}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('lootrunner-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// キャッシュ優先。起動中のページは古い版のまま動き続け、新しい版は次の起動から使われる。
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, {ignoreSearch:true});
    if (hit) return hit;
    if (req.mode === 'navigate'){ const top = await c.match('index.html'); if (top) return top; }
    return fetch(req);
  })());
});
