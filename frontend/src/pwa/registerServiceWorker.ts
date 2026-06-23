const SW_RELOAD_KEY = 'vision-check:sw-reload-once';

let registroIniciado = false;
let registroResolvido: ServiceWorkerRegistration | null = null;
let registroPromise: Promise<ServiceWorkerRegistration | null> | null = null;
let ultimoErroRegistro: string | null = null;

function escopoPwa(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? base : `${base}/`;
}

function urlServiceWorker(): string {
  const rel = `${escopoPwa()}sw.js`.replace(/([^:]\/)\/+/g, '$1');
  return new URL(rel, window.location.origin).href;
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

function paginaPronta(): boolean {
  return document.readyState === 'complete';
}

function aguardarPaginaPronta(): Promise<void> {
  if (paginaPronta()) return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener('load', () => resolve(), { once: true });
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
  totalRegistros: number;
  swAcessivel: boolean;
  swContentType?: string;
  swStatus?: number;
  erroRegistro?: string;
  erro?: string;
};

export function getUltimoErroRegistroServiceWorker(): string | null {
  return ultimoErroRegistro;
}

async function verificarSwAcessivel(): Promise<{
  ok: boolean;
  status?: number;
  contentType?: string;
}> {
  try {
    const res = await fetch(urlServiceWorker(), { cache: 'no-store' });
    const contentType = res.headers.get('content-type') || '';
    const ok = res.ok && (contentType.includes('javascript') || contentType.includes('ecmascript'));
    return { ok, status: res.status, contentType };
  } catch {
    return { ok: false };
  }
}

export async function coletarDiagnosticoServiceWorker(erro?: string): Promise<DiagnosticoServiceWorker> {
  const scope = escopoPwa();
  const swUrl = urlServiceWorker();
  const swCheck = await verificarSwAcessivel();

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
    totalRegistros: 0,
    swAcessivel: swCheck.ok,
    swContentType: swCheck.contentType,
    swStatus: swCheck.status,
    erroRegistro: ultimoErroRegistro || undefined,
    erro,
  };

  let reg = registroResolvido;
  if ('serviceWorker' in navigator) {
    try {
      const todos = await navigator.serviceWorker.getRegistrations();
      base.totalRegistros = todos.length;
      if (!reg) {
        reg =
          todos.find((r) => r.scope.endsWith(scope) || r.scope.includes('/auditoria')) ?? todos[0] ?? null;
      }
    } catch {
      /* ignore */
    }
    if (!reg) {
      try {
        reg = (await navigator.serviceWorker.getRegistration(scope)) ?? null;
      } catch {
        /* ignore */
      }
    }
  }

  if (reg) {
    base.registroExiste = true;
    base.active = !!reg.active;
    base.waiting = !!reg.waiting;
    base.installing = !!reg.installing;
    base.pushManager = 'pushManager' in reg;
  }

  return base;
}

async function registrarServiceWorkerExplicito(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  await aguardarPaginaPronta();

  const scope = escopoPwa();
  const swUrl = urlServiceWorker();

  try {
    const existentes = await navigator.serviceWorker.getRegistrations();
    const existente =
      existentes.find((r) => r.scope.endsWith(scope) || r.scope.includes('/auditoria')) ??
      (await navigator.serviceWorker.getRegistration(scope));
    if (existente) {
      ultimoErroRegistro = null;
      return existente;
    }

    const reg = await navigator.serviceWorker.register(swUrl, {
      scope,
      updateViaCache: 'none',
    });
    ultimoErroRegistro = null;
    return reg;
  } catch (e) {
    ultimoErroRegistro = e instanceof Error ? e.message : String(e);
    console.error('[pwa] Registro explícito falhou:', e);
    throw e;
  }
}

async function ativarWorkerPendente(reg: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (reg.active) return reg;

  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    await aguardarEstadoWorker(reg.waiting, 'activated', 8000);
  }

  if (reg.installing) {
    await aguardarEstadoWorker(reg.installing, 'activated', 12000);
  }

  const scope = escopoPwa();
  return (await navigator.serviceWorker.getRegistration(scope)) ?? reg;
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

  const scope = escopoPwa();
  const todos = await navigator.serviceWorker.getRegistrations();
  const reg =
    registroResolvido ??
    todos.find((r) => r.scope.endsWith(scope) || r.scope.includes('/auditoria')) ??
    null;
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

async function executarRegistroServiceWorker(): Promise<ServiceWorkerRegistration | null> {
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
}

/** Inicia registro PWA após a página carregar (necessário no iOS). Em dev, não registra SW. */
export function iniciarServiceWorkerPwa(): void {
  if (import.meta.env.DEV) return;
  if (registroIniciado || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  registroIniciado = true;

  registroPromise = (async () => {
    await aguardarPaginaPronta();
    return executarRegistroServiceWorker();
  })();
}

/** Registro forçado no clique do usuário (iOS exige interação para SW + push). */
export async function registrarServiceWorkerNoClique(): Promise<ServiceWorkerRegistration | null> {
  iniciarServiceWorkerPwa();
  return executarRegistroServiceWorker();
}

export async function obterRegistroServiceWorker(
  timeoutMs = 20000,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  await aguardarPaginaPronta();

  if (registroPromise) {
    await Promise.race([registroPromise, aguardar(Math.min(timeoutMs, 8000))]);
  }

  const scope = escopoPwa();
  const deadline = Date.now() + timeoutMs;
  let reg: ServiceWorkerRegistration | null | undefined = registroResolvido;

  if (!reg) {
    const todos = await navigator.serviceWorker.getRegistrations();
    reg =
      todos.find((r) => r.scope.endsWith(scope) || r.scope.includes('/auditoria')) ??
      (await navigator.serviceWorker.getRegistration(scope));
  }

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
    if (reg.installing && 'pushManager' in reg) return reg;

    await aguardar(300);
    const todos = await navigator.serviceWorker.getRegistrations();
    reg =
      todos.find((r) => r.scope.endsWith(scope) || r.scope.includes('/auditoria')) ??
      (await navigator.serviceWorker.getRegistration(scope)) ??
      reg;
  }

  if (reg && 'pushManager' in reg) return reg;

  try {
    const pronto = await Promise.race([
      navigator.serviceWorker.ready,
      aguardar(5000).then(() => null),
    ]);
    if (pronto && 'pushManager' in pronto) return pronto;
  } catch {
    /* ignore */
  }

  return reg ?? null;
}

function isIosPush(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export async function obterRegistroServiceWorkerRapido(): Promise<ServiceWorkerRegistration | null> {
  return obterRegistroServiceWorker(10000);
}

export function serviceWorkerControlando(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
}
