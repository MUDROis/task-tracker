const CACHE_NAME = 'task-tracker-v13';
const ASSETS = [
    './',
    './index.html',
    './style.css?v=13',
    './app.js?v=13',
    './js/helpers.js?v=13',
    './firebase-config.js?v=13',
    './manifest.json',
    './logo.png',
    './grifon.png',
    './grifon.ico',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'
];

self.addEventListener('install', function(e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(names) {
            return Promise.all(
                names.filter(function(n) { return n !== CACHE_NAME; })
                     .map(function(n) { return caches.delete(n); })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function(e) {
    var request = e.request;
    if (request.method !== 'GET') return; // POST (логин, Firebase) не трогаем
    var sameOrigin = request.url.indexOf(self.location.origin) === 0;

    // Сеть в приоритете для всех своих файлов (нет устаревшего кэша после обновлений),
    // кэш — только как оффлайн-фолбэк. Устаревший index.html/app.js на устройстве больше НЕ раздаётся.
    e.respondWith(
        fetch(request).then(function(response) {
            if (response.status === 200) {
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(request, clone);
                    if (request.mode === 'navigate') {
                        cache.put('./index.html', clone);
                    }
                });
            }
            return response;
        }).catch(function() {
            return caches.match(request).then(function(cached) {
                if (cached) return cached;
                if (!sameOrigin) {
                    // CDN: при установке кэшированы без query — ищем по базовому URL
                    return caches.match(String(request.url).replace(/[?#].*$/, ''));
                }
                if (request.mode === 'navigate') return caches.match('./index.html');
                // иначе отдаём индекс для не-навигационных запросов оффлайн
                return caches.match('./index.html');
            });
        })
    );
});