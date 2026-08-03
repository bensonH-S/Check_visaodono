import { apiBasePath } from '../config/paths';
import { buildId } from '../config/buildVersion';

export const PWA_UPDATE_DISPONIVEL = 'pwa:update-disponivel';

const BUILD_ID_KEY = 'vision-check:last-build-id';

let recarregando = false;
let listenersConfigurados = false;

function dispararUpdateDisponivel() {
  window.dispatchEvent(new Event(PWA_UPDATE_DISPONIVEL));
}

function escutarTrocaController() {
  if (listenersConfigurados || !('serviceWorker' in navigator)) return;
  listenersConfigurados = true;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });
}

export function configurarAtualizacaoServiceWorker(reg: ServiceWorkerRegistration) {
  escutarTrocaController();

  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state !== 'installed') return;
      if (!navigator.serviceWorker.controller) return;
      dispararUpdateDisponivel();
    });
  });

  if (reg.waiting && navigator.serviceWorker.controller) {
    dispararUpdateDisponivel();
  }
}

export async function verificarAtualizacaoServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const scope = import.meta.env.BASE_URL || '/';
    const registrations = await navigator.serviceWorker.getRegistrations();
    const reg =
      registrations.find((r) => r.scope.endsWith(scope) || r.scope.includes('/auditoria')) ??
      (await navigator.serviceWorker.getRegistration(scope));
    if (!reg) return;
    configurarAtualizacaoServiceWorker(reg);
    await reg.update();
  } catch {
    /* ignore */
  }
}

export async function aplicarAtualizacaoPwa(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }

  recarregando = true;
  try {
    const scope = import.meta.env.BASE_URL || '/';
    const registrations = await navigator.serviceWorker.getRegistrations();
    const reg =
      registrations.find((r) => r.scope.endsWith(scope) || r.scope.includes('/auditoria')) ??
      (await navigator.serviceWorker.getRegistration(scope));

    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      return;
    }

    await limparCachesPwa();
    window.location.reload();
  } catch {
    window.location.reload();
  }
}

async function limparCachesPwa() {
  if (!('caches' in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

/** Compara build embutido no JS com o servidor (detecta deploy sem mudar tag). */
export async function verificarBuildDesatualizado(): Promise<boolean> {
  if (import.meta.env.DEV) return false;

  const local = buildId();
  if (!local || local === 'dev') return false;

  try {
    const res = await fetch(`${apiBasePath}/public/config`, { cache: 'no-store' });
    if (!res.ok) return false;
    const cfg = (await res.json()) as { buildId?: string };
    if (!cfg.buildId || cfg.buildId === 'dev' || cfg.buildId === local) {
      try {
        localStorage.setItem(BUILD_ID_KEY, local);
      } catch {
        /* ignore */
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function iniciarVerificacaoPeriodicaPwa() {
  if (import.meta.env.DEV) return;

  escutarTrocaController();
  await verificarAtualizacaoServiceWorker();

  const desatualizado = await verificarBuildDesatualizado();
  if (desatualizado) {
    dispararUpdateDisponivel();
  }

  window.setInterval(() => {
    void verificarAtualizacaoServiceWorker();
    void verificarBuildDesatualizado().then((stale) => {
      if (stale) dispararUpdateDisponivel();
    });
  }, 5 * 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void verificarAtualizacaoServiceWorker();
    void verificarBuildDesatualizado().then((stale) => {
      if (stale) dispararUpdateDisponivel();
    });
  });
}
