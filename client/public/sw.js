/* JeevanGrid service worker — official-warning push delivery only.
 * Every notification states JeevanGrid is RELAYING an official warning;
 * JeevanGrid never claims to have issued it. No caching/offline logic:
 * if push is unconfigured the app functions normally without this file. */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Official Disaster Alert (relayed by JeevanGrid)', body: 'A new official warning may affect your district. Open JeevanGrid Alerts to verify.' };
  }
  const title = payload.title || 'Official Disaster Alert (relayed by JeevanGrid)';
  const options = {
    body: payload.body || 'An official warning may affect your subscribed district.',
    tag: payload.tag || 'jeevangrid-official-alert',
    renotify: true,
    data: payload.data || { url: '/alerts' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/alerts';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
