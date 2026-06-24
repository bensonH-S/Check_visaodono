/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

type PushPayload = {
  title?: string;
  body?: string;
  url?: string;
  idChamado?: number;
  tipo?: string;
};

const API_BASE = `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}/api`.replace(/\/+/g, '/');

function registrarEventoSw(evento: string, meta: Record<string, unknown>): Promise<void> {
  return fetch(`${API_BASE}/public/push/sw-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: evento, meta }),
  })
    .then(() => undefined)
    .catch(() => undefined);
}

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
  const tipo = data.tipo;
  if (tipo && tipo !== 'chamado_urgente_regiao' && tipo !== 'assumido') {
    return;
  }

  const title = data.title || 'Vision Check';
  const tag = data.idChamado
    ? `chamado-${data.idChamado}-${data.tipo || 'evento'}`
    : 'vision-check';
  const options = {
    body: data.body || 'Nova atualização nos chamados',
    icon: `${self.registration.scope}Logo_Icon.png`,
    badge: `${self.registration.scope}Logo_Icon.png`,
    tag,
    renotify: false,
    data: {
      url: data.url || '/chamados/mobile',
    },
  } as NotificationOptions;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      registrarEventoSw('push_recebido_2plano', {
        title,
        body: options.body,
        idChamado: data.idChamado ?? null,
        tag: options.tag,
        scope: self.registration.scope,
      }),
    ]).catch((err) =>
      registrarEventoSw('push_erro_exibir', {
        erro: err instanceof Error ? err.message : String(err),
        idChamado: data.idChamado ?? null,
      }),
    ),
  );
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
