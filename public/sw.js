// Service worker СМУм: приложение открывается и без интернета.
// - Страница (index.html): сначала сеть (чтобы сразу получать обновления), при отсутствии связи — из кэша.
// - Файлы приложения (assets/, иконки): из кэша, при первом обращении — из сети с сохранением в кэш.
// - Иконки Font Awesome с cdnjs: из кэша, в фоне обновляются.
// - Запросы к Google Apps Script не кэшируются: данные хранит само приложение (localStorage и офлайн-очередь).
const CACHE = 'smum-v3';
const BASE = new URL('./', self.location).href; // папка приложения (на GitHub Pages — /MU_medical_app/)
const CDN = 'https://cdnjs.cloudflare.com/';
const NETWORK_TIMEOUT_MS = 5000; // слабая связь: не ждём страницу дольше — берём из кэша
// Скрипты приложения запрашиваются с заголовком Origin, а сохранялись без него; из-за «Vary»
// браузер не считал их совпадающими и шёл в сеть. Сравниваем только по адресу.
const MATCH = { ignoreVary: true, ignoreSearch: false };

const STATIC_FILES = ['manifest.webmanifest', 'logo.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']
  .map(path => new URL(path, BASE).href);

// Адреса скриптов и стилей, на которые ссылается index.html
function referencedUrls(html) {
  return [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => new URL(match[1], BASE).href)
    .filter(url => url.startsWith(BASE) || url.startsWith(CDN));
}

// Сохранить страницу и всё, что нужно для её запуска; удалить файлы прежних сборок
async function cachePage(response) {
  const cache = await caches.open(CACHE);
  const html = await response.clone().text();
  await cache.put(BASE, response);
  const urls = referencedUrls(html);
  await Promise.all(urls.map(url => cache.match(url, MATCH).then(hit => hit || cache.add(url)).catch(() => {})));
  const assetsDir = new URL('assets/', BASE).href;
  const keep = new Set(urls);
  for (const request of await cache.keys()) {
    if (request.url.startsWith(assetsDir) && !keep.has(request.url)) await cache.delete(request);
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(STATIC_FILES.map(url => cache.add(url).catch(() => {})));
    try {
      const response = await fetch(BASE, { cache: 'no-store' });
      if (response.ok) await cachePage(response);
    } catch { /* нет связи — страница сохранится при следующем открытии */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

async function handleNavigation(event) {
  // GitHub Pages разрешает хранить страницу в кэше браузера 10 минут, и после обновления
  // телефон ещё 10 минут открывал старую версию. «no-cache» — всегда спрашиваем сервер,
  // изменилась ли страница (если нет — ответ короткий, без повторной загрузки).
  const network = fetch(event.request.url, { cache: 'no-cache', credentials: 'same-origin' });
  try {
    const response = await withTimeout(network, NETWORK_TIMEOUT_MS);
    if (response.ok) {
      event.waitUntil(cachePage(response.clone()));
      return response;
    }
  } catch { /* нет сети или слишком долго */ }
  const cached = await caches.match(BASE, MATCH);
  if (cached) {
    // Страница из кэша показана; если сеть всё же ответит — сохраним свежую версию на следующий раз
    event.waitUntil(network.then(response => response.ok ? cachePage(response) : undefined).catch(() => {}));
    return cached;
  }
  return network;
}

async function cacheFirst(request) {
  const cached = await caches.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request, MATCH);
  const network = fetch(event.request)
    .then(response => { if (response.ok) cache.put(event.request, response.clone()); return response; });
  if (cached) {
    event.waitUntil(network.catch(() => {}));
    return cached;
  }
  return network;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = request.url;

  if (request.mode === 'navigate' && url.startsWith(BASE)) {
    event.respondWith(handleNavigation(event));
  } else if (url.startsWith(BASE)) {
    if (url === self.location.href) return; // сам sw.js — всегда из сети
    event.respondWith(cacheFirst(request));
  } else if (url.startsWith(CDN)) {
    event.respondWith(staleWhileRevalidate(event));
  }
  // Остальное (Google Apps Script и т. п.) — напрямую в сеть, без кэша
});
