const CACHE = 'zapominalka-v104';

// Файлы приложения меняются с каждой версией — при установке их всегда проверяем на сервере.
const APP_ASSETS = [
  './index.html',
  './fonts.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Начертания шрифтов между версиями не меняются: имя файла и есть его содержимое.
// Раньше они лежали внутри index.html строками base64, и каждое обновление
// заставляло телефон качать их заново вместе с приложением — 1.9 МБ вместо 0.7 МБ.
// Теперь при обновлении они просто переносятся из старого кэша.
const FONT_ASSETS = [
  './fonts/inter-400-cyrillic-ext.woff2',
  './fonts/inter-400-cyrillic.woff2',
  './fonts/inter-400-greek-ext.woff2',
  './fonts/inter-400-greek.woff2',
  './fonts/inter-400-latin-ext.woff2',
  './fonts/inter-400-latin.woff2',
  './fonts/inter-400-vietnamese.woff2',
  './fonts/inter-500-cyrillic-ext.woff2',
  './fonts/inter-500-cyrillic.woff2',
  './fonts/inter-500-greek-ext.woff2',
  './fonts/inter-500-greek.woff2',
  './fonts/inter-500-latin-ext.woff2',
  './fonts/inter-500-latin.woff2',
  './fonts/inter-500-vietnamese.woff2',
  './fonts/inter-600-cyrillic-ext.woff2',
  './fonts/inter-600-cyrillic.woff2',
  './fonts/inter-600-greek-ext.woff2',
  './fonts/inter-600-greek.woff2',
  './fonts/inter-600-latin-ext.woff2',
  './fonts/inter-600-latin.woff2',
  './fonts/inter-600-vietnamese.woff2',
  './fonts/inter-700-cyrillic-ext.woff2',
  './fonts/inter-700-cyrillic.woff2',
  './fonts/inter-700-greek-ext.woff2',
  './fonts/inter-700-greek.woff2',
  './fonts/inter-700-latin-ext.woff2',
  './fonts/inter-700-latin.woff2',
  './fonts/inter-700-vietnamese.woff2',
  './fonts/inter-800-cyrillic-ext.woff2',
  './fonts/inter-800-cyrillic.woff2',
  './fonts/inter-800-greek-ext.woff2',
  './fonts/inter-800-greek.woff2',
  './fonts/inter-800-latin-ext.woff2',
  './fonts/inter-800-latin.woff2',
  './fonts/inter-800-vietnamese.woff2',
  './fonts/space-grotesk-500-latin-ext.woff2',
  './fonts/space-grotesk-500-latin.woff2',
  './fonts/space-grotesk-500-vietnamese.woff2',
  './fonts/space-grotesk-700-latin-ext.woff2',
  './fonts/space-grotesk-700-latin.woff2',
  './fonts/space-grotesk-700-vietnamese.woff2'
];

const ASSETS = APP_ASSETS.concat(FONT_ASSETS);

async function copyFontsFromOldCache(cache) {
  const otherNames = (await caches.keys()).filter(name => name !== CACHE);
  const otherCaches = await Promise.all(otherNames.map(name => caches.open(name)));

  const missing = [];
  for (const asset of FONT_ASSETS) {
    let reused = false;
    for (const old of otherCaches) {
      const hit = await old.match(asset);
      if (hit) {
        await cache.put(asset, hit.clone());
        reused = true;
        break;
      }
    }
    if (!reused) missing.push(asset);
  }
  return missing;
}

async function fillCache(cache) {
  let fontsToFetch = FONT_ASSETS;
  try {
    fontsToFetch = await copyFontsFromOldCache(cache);
  } catch (e) {
    // Перенос — только ускорение. Если он почему-то не удался, качаем всё заново:
    // приложение должно установиться в любом случае, иначе офлайн перестанет быть.
  }

  // Файлы приложения — строго все: без любого из них приложение не откроется.
  //
  // Каждый — с проверкой на сервере (cache: 'no-cache'), а не через HTTP-кэш
  // браузера. GitHub Pages разрешает браузеру 10 минут держать файл у себя, и
  // обычный запрос в это окно отдавал прошлую копию: если две версии выходили
  // подряд, новый кэш получал старый index.html, и правка не появлялась до
  // следующей версии. При проверке неизменившийся файл (иконки, манифест)
  // сервер подтверждает ответом 304 без тела, так что лишнего трафика нет.
  await cache.addAll(APP_ASSETS.map(asset => new Request(asset, { cache: 'no-cache' })));
  // Шрифты — по одному и без фатальных ошибок: если какой-то не дошёл, его символы
  // отрисуются системным шрифтом, а приложение всё равно останется рабочим.
  await Promise.allSettled(fontsToFetch.map(asset => cache.add(asset)));
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(fillCache));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
