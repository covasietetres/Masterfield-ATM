// Service Worker for ATM Field Master
const CACHE_NAME = 'atm-master-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Alerta Técnica', body: 'Nueva notificación recibida' };
  try {
    data = event.data ? event.data.json() : data;
  } catch (e) {
    data = { title: 'Alerta Técnica', body: event.data.text() || data.body };
  }

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40], // SOS style vibration
    tag: 'critical-alert-' + Date.now(), // Unique tag to ensure it always sounds
    renotify: true,
    requireInteraction: true,
    silent: false,
    priority: 'high',
    data: {
      url: data.url || '/dashboard/team'
    },
    actions: [
      { action: 'open', title: 'Atender Ahora 🛠️' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
