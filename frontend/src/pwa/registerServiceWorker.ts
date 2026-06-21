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

export type DiagnosticoServiceWorker = {
  swUrl: string;
  scope: string;
  temServiceWorker: boolean;
  registroExiste: boolean;
  active: boolean;
  waiting: boolean;
  installing: boolean;
  controller: boolean;
  standalone: boolean;
  pushManager: boolean;
  erro?: string;
};

export function coletarDiagnosticoServiceWorker(erro?: string): DiagnosticoServiceWorker {
  const scope = escopoPwa();
  const swUrl = urlServiceWorker();
  const base: DiagnosticoServiceWorker = {
    swUrl,
    scope,
    temServiceWorker: 'serviceWorker' in navigator,
    registroExiste: false,
    active: false,
    waiting: false,
    installing: false,
    controller: !!navigator.serviceWorker?.controller,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    pushManager: false,
    erro,
  };
  if (registroResolvido) {
    base.registroExiste = true;
    base.active = !!registroResolvido.active;
    base.waiting = !!registroResolvido.waiting;
    base.installing = !!registroResolvido.installing;
    base.pushManager = 'pushManager' in registroResolvido;
  }
  return base;
}

async function registrarServiceWorkerExplicito(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  const scope = escopoPwa();
  const swUrl = urlServiceWorker();

  try {
    const existente = await navigator.serviceWorker.getRegistration(scope);
    if (existente) return existente;

    const reg = await navigator.serviceWorker.register(swUrl, {
      scope,
      updateViaCache: 'none',
    });
    return reg;
  } catch (e) {
    console.error('[pwa] Registro explícito falhou:', e);
    throw e;
  }
}

async function ativarWorkerPendente(reg: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (reg.active) return reg;

  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    await aguardarEstadoWorker(reg.waiting, 'activated', 6000);
  }

  if (reg.installing) {
    await aguardarEstadoWorker(reg.installing, 'activated', 10000);
  }

  return (await navigator.serviceWorker.getRegistration(escopoPwa())) ?? reg;
}

/** iOS: recarrega uma vez para o SW assumir controle. */
export async function recarregarParaAtivarServiceWorker(): Promise<boolean> {
  if (navigator.serviceWorker.controller) return false;

  try {
    if (localStorage.getItem(SW_RELOAD_KEY) === '1') return false;
    localStorage.setItem(SW_RELOAD_KEY, '1');
  } catch {
    return false;
  }

  const reg = registroResolvido ?? (await navigator.serviceWorker.getRegistration(escopoPwa()));
  if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

  window.location.reload();
  return true;
}

export function limparFlagRecargaServiceWorker() {
  try {
    localStorage.removeItem(SW_RELOAD_KEY);
  } catch {
    /* ignore */
  }
}

/** Inicia registro PWA no boot do app. */
export function iniciarServiceWorkerPwa(): void {
  if (registroIniciado || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  registroIniciado = true;

  registroPromise = (async () => {
    try {
      let reg = await registrarServiceWorkerExplicito();
      if (reg) {
        reg = await ativarWorkerPendente(reg);
        registroResolvido = reg;
      }
      return reg;
    } catch {
      return null;
    }
  })();
}

export async function obterRegistroServiceWorker(
  timeoutMs = 15000,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  iniciarServiceWorkerPwa();
  if (registroPromise) {
    await Promise.race([registroPromise, aguardar(Math.min(timeoutMs, 5000))]);
  }

  const scope = escopoPwa();
  const deadline = Date.now() + timeoutMs;
  let reg: ServiceWorkerRegistration | null | undefined =
    registroResolvido ?? (await navigator.serviceWorker.getRegistration(scope));

  if (!reg) {
    try {
      reg = await registrarServiceWorkerExplicito();
    } catch {
      return null;
    }
  }

  while (Date.now() < deadline) {
    if (!reg) break;

    reg = await ativarWorkerPendente(reg);
    registroResolvido = reg;

    if (reg.active && 'pushManager' in reg) return reg;
    if (reg.waiting && 'pushManager' in reg && isIosPush()) return reg;

    await aguardar(300);
    reg = (await navigator.serviceWorker.getRegistration(scope)) ?? reg;
  }

  if (reg?.active || reg?.waiting) return reg;

  try {
    const pronto = await Promise.race([
      navigator.serviceWorker.ready,
      aguardar(3000).then(() => null),
    ]);
    if (pronto) return pronto;
  } catch {
    /* ignore */
  }

  return reg ?? null;
}

function isIosPush(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export async function obterRegistroServiceWorkerRapido(): Promise<ServiceWorkerRegistration | null> {
  return obterRegistroServiceWorker(8000);
}

export function serviceWorkerControlando(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
}
