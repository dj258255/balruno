/* Balruno service worker — Web Push notification handler.
 *
 * Subscribed in Profile Settings via Notification.requestPermission +
 * serviceWorker.pushManager.subscribe (with the VAPID public key the
 * backend exposes at /api/v1/notification/vapid-public-key).
 *
 * Backend POSTs an encrypted payload through the browser's native
 * push service (FCM / Mozilla Autopush / Apple Push) — the browser
 * decrypts and dispatches the push event below. We render a
 * notification + on click navigate to the inbox.
 */

self.addEventListener('install', () => {
  // Activate immediately on first install — no need for a separate
  // skipWaiting() prompt; the SW only ever does push handling.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const payload = parsePayload(event.data);
  const { title, body, url, icon } = payload;
  event.waitUntil(
    self.registration.showNotification(title || 'Balruno', {
      body: body || '',
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: url || '/inbox' },
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/inbox';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // Focus an existing tab pointing at the same origin if open.
      for (const client of allClients) {
        if (new URL(client.url).origin === self.location.origin) {
          if ('focus' in client) {
            await client.focus();
            await client.navigate(target);
            return;
          }
        }
      }
      // No matching tab — open a new one.
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});

function parsePayload(data) {
  if (!data) return {};
  try {
    return data.json();
  } catch {
    try {
      return JSON.parse(data.text());
    } catch {
      return { body: data.text() };
    }
  }
}
