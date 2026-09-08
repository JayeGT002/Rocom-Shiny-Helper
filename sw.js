/* ============================================================
 * RocoM Shiny Helper · Service Worker
 * 缓存策略：
 *  - HTML 文档：网络优先（在线永远拿最新，离线时回退缓存）
 *  - 静态资源（图片/字体/css/js/data）：缓存优先 + TTL，
 *    缓存未过期前不再请求网络，过期后重新拉取并更新缓存
 *  - 发布新内容（尤其 data/*.json 数据更新）后，把 CACHE_VERSION +1
 * ============================================================ */
const CACHE_VERSION = 'rocom-shiny-v2';
const SHELL_CACHE = CACHE_VERSION + '-shell';
const ASSET_CACHE = CACHE_VERSION + '-assets';

// 各类资源缓存时长
const TTL = {
  IMAGE: 30 * 24 * 60 * 60 * 1000, // 图片/字体 30 天
  CODE: 7 * 24 * 60 * 60 * 1000    // css/js/json 7 天
};

const IMG_RE = /\.(webp|png|ico|ttf|woff2?)$/;
const CODE_RE = /\.(css|js|json)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== ASSET_CACHE).map(k => caches.delete(k)))
      )
    ])
  );
});

const ttlOf = url =>
  IMG_RE.test(url.pathname) ? TTL.IMAGE : TTL.CODE;

const putMeta = async (cache, url, t) =>
  cache.put('__meta:' + url, new Response(JSON.stringify({ t })));

const getMeta = async (cache, url) => {
  const meta = await cache.match('__meta:' + url);
  if (!meta) return 0;
  try { return (await meta.json()).t || 0; } catch (e) { return 0; }
};

async function cacheFirst(req, ttl) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });
  if (cached) {
    const t = await getMeta(cache, req.url);
    if (Date.now() - t < ttl) return cached;
  }
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      await cache.put(req, res.clone());
      await putMeta(cache, req.url, Date.now());
    }
    return res;
  } catch (err) {
    return cached || Response.error();
  }
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      await cache.put(req, res.clone());
      await putMeta(cache, req.url, Date.now());
    }
    return res;
  } catch (err) {
    const cached = await cache.match(req, { ignoreSearch: true });
    return cached || Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 仅处理同源请求

  // HTML 文档走网络优先；其余静态资源走缓存优先 + TTL
  if (req.destination === 'document' || /\.html?$/.test(url.pathname)) {
    e.respondWith(networkFirst(req));
    return;
  }
  e.respondWith(cacheFirst(req, ttlOf(url)));
});
