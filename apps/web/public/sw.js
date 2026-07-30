/**
 * FreightX Service Worker
 * Handles: push notifications, notificationclick events
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'FreightX', body: event.data.text(), url: '/' };
  }

  const title = payload.title ?? 'FreightX';
  const options = {
    body: payload.body ?? '',
    icon: '/logo.svg',
    badge: '/logo.svg',
    data: { url: payload.url ?? '/' },
    tag: payload.tag ?? 'freightx',
    renotify: !!payload.tag,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
