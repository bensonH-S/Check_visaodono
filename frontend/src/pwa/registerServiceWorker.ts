import { registerSW } from 'virtual:pwa-register';

const SW_RELOAD_KEY = 'vision-check:sw-reload-once';

let registroIniciado = false;
let registroResolvido: ServiceWorkerRegistration | null = null;
let registroPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function escopoPwa(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

function urlServiceWorker(): string {
  return `${escopoPwa()}sw.js`.replace(/([^:]\/)\/+/g, '$1');
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function aguardarEstadoWorker(
  worker: ServiceWorker,
  estado: ServiceWorkerState,
  timeoutMs: number,
): Promise<boolean> {
  if (worker.state === estado) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    worker.addEventListener('statechange', () => {
      if (worker.state === estado) {
        clearTimeout(timer);
        resolve(true);
      }
    });
  });
}

/** Inicia o registro PWA (chamar uma vez no boot do app). */
export function iniciarServiceWorkerPwa(): void {
  if (registroIniciado || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  registroIniciado = true;

  registroPromise = new Promise((resolve) => {
    let concluido = false;
    const finalizar = (reg: ServiceWorkerRegistration | null) => {
      if (concluido) return;
      concluido = true;
      if (reg) registroResolvido = reg;
      resolve(reg);
    };

    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        finalizar(registration ?? null);
      },
      onRegisterError(error) {
        console.error('[pwa] Falha ao registrar service worker:', error);
        finalizar(null);
      },
    });

    void (async () => {
      await aguardar(8000);
      if (concluido) return;
      const reg = await navigator.serviceWorker.getRegistration(escopoPwa());
      finalizar(reg ?? null);
    })();
  });
}

async function registrarServiceWorkerExplicito(): Promise<ServiceWorkerRegistration | null> {
  const scope = escopoPwa();
  const swUrl = urlServiceWorker();

  try {
    return await navigator.serviceWorker.register(swUrl, { scope });
  } catch {
    try {
      return await navigator.serviceWorker.register(swUrl, { scope, type: 'module' as WorkerType });
    } catch (e) {
      console.error('[pwa] Registro explícito falhou:', e);
      return null;
    }
  }
}

async function ativarWorkerPendente(reg: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (reg.active) return reg;

  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    await aguardarEstadoWorker(reg.waiting, 'activated', 8000);
  }

  if (reg.installing) {
    await aguardarEstadoWorker(reg.installing, 'activated', 15000);
  }

  return (await navigator.serviceWorker.getRegistration(escopoPwa())) ?? reg;
}

/** iOS: na 1ª abertura do PWA o SW instala mas só controla após recarregar. */
async function recarregarUmaVezSeNecessario(reg: ServiceWorkerRegistration): Promise<boolean> {
  if (navigator.serviceWorker.controller) return false;

  try {
    if (localStorage.getItem(SW_RELOAD_KEY) === '1') return false;
  } catch {
    return false;
  }

  if (!reg.active && !reg.waiting && !reg.installing) return false;

  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 4000);
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer);
        try {
          localStorage.setItem(SW_RELOAD_KEY, '1');
        } catch {
          /* ignore */
        }
        window.location.reload();
        resolve(true);
      },
      { once: true },
    );
  });
}

/**
 * Obtém registro do service worker — no iOS aguarda instalação/ativação
 * (não depende só de navigator.serviceWorker.ready).
 */
export async function obterRegistroServiceWorker(
  timeoutMs = 45000,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  iniciarServiceWorkerPwa();
  if (registroPromise) {
    await Promise.race([registroPromise, aguardar(3000)]);
  }

  const scope = escopoPwa();
  const deadline = Date.now() + timeoutMs;
  let reg: ServiceWorkerRegistration | null | undefined =
    registroResolvido ?? (await navigator.serviceWorker.getRegistration(scope));

  if (!reg) {
    reg = await registrarServiceWorkerExplicito();
  }

  while (Date.now() < deadline) {
    if (!reg) {
      reg = await registrarServiceWorkerExplicito();
      await aguardar(400);
      continue;
    }

    reg = await ativarWorkerPendente(reg);

    if (reg.active || reg.waiting) {
      return reg;
    }

    await aguardar(350);
    reg = (await navigator.serviceWorker.getRegistration(scope)) ?? reg;
  }

  if (reg && !navigator.serviceWorker.controller) {
    const recarregou = await recarregarUmaVezSeNecessario(reg);
    if (recarregou) return null;
  }

  if (reg?.active || reg?.waiting) return reg;

  try {
    const pronto = await Promise.race([
      navigator.serviceWorker.ready,
      aguardar(5000).then(() => null),
    ]);
    if (pronto) return pronto;
  } catch {
    /* ignore */
  }

  return reg ?? null;
}

export function serviceWorkerControlando(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
}

/** Retorno imediato — no clique do botão (máx. ~2 s). */
export async function obterRegistroServiceWorkerRapido(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  iniciarServiceWorkerPwa();
  const scope = escopoPwa();
  let reg: ServiceWorkerRegistration | null | undefined =
    registroResolvido ?? (await navigator.serviceWorker.getRegistration(scope));

  if (reg?.active || reg?.waiting) return reg;

  if (reg?.installing) {
    await aguardarEstadoWorker(reg.installing, 'activated', 2000);
    reg = (await navigator.serviceWorker.getRegistration(scope)) ?? reg;
    if (reg?.active || reg?.waiting) return reg;
  }

  if (!reg) {
    try {
      reg = await registrarServiceWorkerExplicito();
      if (reg?.installing) {
        await aguardarEstadoWorker(reg.installing, 'activated', 2000);
      }
      reg = (await navigator.serviceWorker.getRegistration(scope)) ?? reg;
    } catch {
      return null;
    }
  }

  return reg?.active || reg?.waiting ? reg : null;
}
