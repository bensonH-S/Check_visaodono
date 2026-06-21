/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/\/api\//],
  }),
);

type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  idChamado?: number;
};

function parsePushData(event: PushEvent): PushPayload {
  if (!event.data) return {};
  try {
    return event.data.json() as PushPayload;
  } catch {
    const text = event.data.text();
    return text ? { body: text } : {};
  }
}

self.addEventListener('push', (event) => {
  const data = parsePushData(event);
  const title = data.title || 'Vision Check';
  const options = {
    body: data.body || 'Nova atualização nos chamados',
    icon: `${self.registration.scope}Logo_Icon.png`,
    badge: `${self.registration.scope}Logo_Icon.png`,
    tag: data.idChamado ? `chamado-${data.idChamado}` : 'vision-check',
    renotify: true,
    data: {
      url: data.url || '/chamados/mobile',
    },
  } as NotificationOptions;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const relUrl = (event.notification.data?.url as string) || '/chamados/mobile';
  const targetUrl = new URL(relUrl.replace(/^\//, ''), self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && client.url.startsWith(self.registration.scope)) {
          const wc = client as WindowClient;
          if ('navigate' in wc && typeof wc.navigate === 'function') {
            void wc.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
