import { apiBasePath } from '../config/paths';
import { buildId } from '../config/buildVersion';

export const PWA_UPDATE_DISPONIVEL = 'pwa:update-disponivel';

const BUILD_ID_KEY = 'vision-check:last-build-id';
const FORCE_ATTEMPT_KEY = 'vision-check:force-reload-at';

let recarregando = false;
let listenersConfigurados = false;

function dispararUpdateDisponivel() {
  window.dispatchEvent(new Event(PWA_UPDATE_DISPONIVEL));
}

function recarregarAgora() {
  if (recarregando) return;
  recarregando = true;
  window.location.reload();
}

function tentouForcarAgora() {
  try {
    const at = Number(sessionStorage.getItem(FORCE_ATTEMPT_KEY) || 0);
    return Date.now() - at < 20_000;
  } catch {
    return false;
  }
}

function marcarTentativaForcar() {
  try {
    sessionStorage.setItem(FORCE_ATTEMPT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function escutarTrocaController() {
  if (listenersConfigurados || !('serviceWorker' in navigator)) return;
  listenersConfigurados = true;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    recarregarAgora();
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
      void forcarAtualizacaoPwaSeNecessario();
    });
  });

  if (reg.waiting && navigator.serviceWorker.controller) {
    void forcarAtualizacaoPwaSeNecessario();
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
    recarregarAgora();
    return;
  }

  try {
    const scope = import.meta.env.BASE_URL || '/';
    const registrations = await navigator.serviceWorker.getRegistrations();
    const reg =
      registrations.find((r) => r.scope.endsWith(scope) || r.scope.includes('/auditoria')) ??
      (await navigator.serviceWorker.getRegistration(scope));

    if (reg?.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.setTimeout(() => recarregarAgora(), 1200);
      return;
    }

    await limparCachesPwa();
    recarregarAgora();
  } catch {
    recarregarAgora();
  }
}

async function swTemWaiting(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.some((r) => Boolean(r.waiting));
  } catch {
    return false;
  }
}

/** Recarrega sozinho quando o servidor já está em outro build — sem pedir login de novo. */
export async function forcarAtualizacaoPwaSeNecessario(): Promise<void> {
  if (import.meta.env.DEV || recarregando || tentouForcarAgora()) return;
  const stale = await verificarBuildDesatualizado();
  const waiting = await swTemWaiting();
  if (!stale && !waiting) return;
  marcarTentativaForcar();
  dispararUpdateDisponivel();
  await aplicarAtualizacaoPwa();
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
  await forcarAtualizacaoPwaSeNecessario();

  window.setInterval(() => {
    void verificarAtualizacaoServiceWorker();
    void forcarAtualizacaoPwaSeNecessario();
  }, 60 * 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void verificarAtualizacaoServiceWorker();
    void forcarAtualizacaoPwaSeNecessario();
  });
}
