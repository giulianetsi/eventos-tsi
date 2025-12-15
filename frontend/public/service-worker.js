// Service Worker para notificações push
// Roda em uma thread separada da UI, não tem acesso ao DOM

console.log('Service Worker carregado');

const CACHE_NAME = 'tcc-cache-v1';
const API_CACHE = 'tcc-api-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/ifsul-logo.png'
];

self.addEventListener('install', function(event) {
  console.log('Service Worker: Instalado');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('Service Worker: Ativado');
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => { if (k !== CACHE_NAME && k !== API_CACHE) return caches.delete(k); }))
      await self.clients.claim();
    })()
  );
});

// Helper: estratégia network-first para requisições de API (fallback para cache)
async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    // Only cache successful JSON responses
    if (response && response.status === 200) {
      try { await cache.put(request, response.clone()); } catch (e) { /* ignore caching errors */ }
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

self.addEventListener('fetch', function(event) {
  const req = event.request;
  const url = new URL(req.url);

  // Lidar apenas com requisições GET
  if (req.method !== 'GET') return;

  // API: endpoints de eventos - estratégia network-first, com fallback para cache
  // evitar servir respostas antigas em cache
  // network-first para todas as rotas que começam com /api
  if (url.pathname.startsWith('/api') || url.pathname.includes('/api/')) {
    event.respondWith(
      networkFirst(req).catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Requisições de navegação (páginas HTML) - tentar rede, fallback para cache ou offline.html
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          try { await cache.put('/index.html', response.clone()); } catch (e) {}
          return response;
        } catch (err) {
          return (await caches.match('/index.html')) || (await caches.match('/offline.html'));
        }
      })()
    );
    return;
  }

  // Para outras requisições (assets estáticos) usar cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(async res => {
        // Cache the fetched asset for future offline use (avoid caching cross-origin opaque responses)
        try {
          const contentType = res.headers.get('content-type') || '';
          // Cachear apenas arquivos JS/CSS/HTML/JSON/imagens/fonts
          if (!res || res.type === 'opaque') return res;
          if (contentType.includes('javascript') || contentType.includes('css') || contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('image') || contentType.includes('font')) {
            const cache = await caches.open(CACHE_NAME);
            try { await cache.put(req, res.clone()); } catch (e) { /* ignore */ }
          }
        } catch (err) {
        }
        return res;
      }).catch(() => caches.match('/offline.html'));
    })
  );
});

// Notificações push: ignorar payloads de health-check e exibir as demais
self.addEventListener('push', function(event) {
  console.log('Push notification recebida:', event);
  event.waitUntil((async () => {
    let data = { title: 'Notificação', body: 'Você recebeu uma nova notificação' };
    if (event.data) {
      try {
        data = event.data.json();
        console.log('Payload JSON parseado:', data);
      } catch (e) {
        try {
          const text = event.data.text();
          console.log('Payload texto:', text);
          // Se o backend enviou a string 'health-check' bruta, ignorar
          if (text === 'health-check') {
            console.log('Health-check detectado, ignorando');
            return;
          }
          data.body = text;
        } catch (err) {
          console.log('Erro ao parsear dados da notificação:', err);
        }
      }
    }

    if (data && (data.type === 'health-check' || data.title === 'health-check' || data.body === 'health-check')) {
      console.log('Health-check detectado no data, ignorando');
      return;
    }

    // Tag única por notificação (timestamp) para evitar substituição silenciosa
    const timestamp = Date.now();
    const tag = (data && data.data && data.data.eventId) ? `event-${data.data.eventId}-${timestamp}` : `event-generic-${timestamp}`;
    
    const options = {
      body: data.body || 'Sem descrição',
      icon: '/ifsul-logo.png',
      badge: '/ifsul-logo.png',
      data: data,
      requireInteraction: true, // Força notificação a permanecer até interação
      silent: false,
      tag: tag,
      renotify: true, // Permite renotificar mesmo com tag similar
      vibrate: [200, 100, 200] // Vibração em dispositivos móveis
    };

    console.log('Exibindo notificação:', data.title, options);
    console.log('Tag gerada:', tag);
    
    try {
      await self.registration.showNotification(data.title || 'Notificação', options);
      console.log('Notificação exibida com sucesso');
      
      // Verificar se a notificação foi realmente criada
      const notifications = await self.registration.getNotifications();
      console.log('Total de notificações ativas:', notifications.length);
    } catch (showErr) {
      console.error('Erro ao exibir notificação:', showErr);
      try {
        const state = await self.registration.pushManager.permissionState({ userVisibleOnly: true });
        console.error('Permissão atual:', state);
      } catch (e) {
        console.error('Não foi possível verificar permissão');
      }
    }
  })());
});

self.addEventListener('notificationclick', function(event ) {
  console.log('Notificação clicada:', event);
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
  