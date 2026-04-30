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
    vibrate: [200, 100, 200, 100, 200], // Stronger vibration
    tag: 'critical-alert', // Avoid duplicates
    renotify: true,
    requireInteraction: true, // Notification stays until user acts
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
