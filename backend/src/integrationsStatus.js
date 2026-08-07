/**
 * Status das APIs externas por página/módulo (sem expor segredos).
 * Checks em paralelo (Promise.all) com o mesmo shape: { id, name, online, configured, detail }.
 */
import { pool } from './db.js';
import { fulltrackStatus } from './services/fulltrackFleet.js';
import { smtpConfigurado, verifySmtp } from './services/mailer.js';
import { wppEnabled, gerarTokenWpp, verificarConexaoWpp } from './services/wppClient.js';
import { obterSaudeVapidPublica } from './pushNotifications.js';

function withTimeout(promise, ms, label = 'Timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(label)), ms);
    }),
  ]);
}

function freecontrolBaseUrl() {
  return String(process.env.FREECONTROL_API_URL || '')
    .trim()
    .replace(/\/+$/, '');
}

function freecontrolToken() {
  return String(
    process.env.FREECONTROL_APPROVAL_TOKEN || process.env.REGIONAL_APPROVAL_API_TOKEN || '',
  ).trim();
}

function freecontrolConfigurado() {
  return Boolean(freecontrolBaseUrl() && freecontrolToken());
}

function bkOfficeConfigurado() {
  return Boolean(process.env.BKOFFICE_USER && process.env.BKOFFICE_PASS);
}

async function probeUrl(url, { headers, timeoutMs = 3500 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: ctrl.signal,
    });
    return { online: true, httpStatus: res.status };
  } catch {
    return { online: false, httpStatus: null };
  } finally {
    clearTimeout(t);
  }
}

async function statusPostgres() {
  try {
    await withTimeout(pool.query('SELECT 1'), 4000, 'Timeout PostgreSQL');
    return {
      id: 'postgres',
      name: 'PostgreSQL',
      online: true,
      configured: true,
      detail: 'Conectado',
    };
  } catch (e) {
    return {
      id: 'postgres',
      name: 'PostgreSQL',
      online: false,
      configured: true,
      detail: e instanceof Error ? e.message.slice(0, 120) : 'Indisponível',
    };
  }
}

async function statusFreeControl() {
  const base = freecontrolBaseUrl();
  const token = freecontrolToken();
  if (!base || !token) {
    return {
      id: 'freecontrol',
      name: 'FreeControl',
      online: false,
      detail: 'N/A',
      configured: false,
    };
  }
  const probe = await probeUrl(base, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-service-token': token,
    },
  });
  return {
    id: 'freecontrol',
    name: 'FreeControl',
    online: probe.online,
    detail: probe.online ? 'Conectada' : 'Indisponível',
    configured: true,
  };
}

async function statusWhatsApp() {
  if (!wppEnabled()) {
    return {
      id: 'whatsapp',
      name: 'WhatsApp',
      online: false,
      detail: 'N/A',
      configured: false,
    };
  }
  try {
    const token = await gerarTokenWpp();
    const { conectado } = await verificarConexaoWpp(token);
    return {
      id: 'whatsapp',
      name: 'WhatsApp',
      online: conectado,
      detail: conectado ? 'Sessão conectada' : 'Sessão desconectada',
      configured: true,
    };
  } catch {
    const host = (process.env.WPP_HOST || 'http://localhost').replace(/\/$/, '');
    const port = process.env.WPP_PORT || '21465';
    const probe = await probeUrl(`${host}:${port}`);
    return {
      id: 'whatsapp',
      name: 'WhatsApp',
      online: false,
      detail: probe.online ? 'Serviço sem sessão' : 'Serviço indisponível',
      configured: true,
    };
  }
}

async function statusFullTrack() {
  const st = fulltrackStatus();
  if (!st.ativo) {
    return {
      id: 'fulltrack',
      name: 'FullTrack',
      online: false,
      detail: 'N/A',
      configured: false,
    };
  }
  const apiKey = String(
    process.env.FULLTRACK_API_KEY || process.env.APIKEY || process.env.API_KEY || '',
  ).trim();
  const secretKey = String(
    process.env.FULLTRACK_SECRET_KEY || process.env.SECRETKEY || process.env.SECRET_KEY || '',
  ).trim();
  const baseUrl = String(st.base_url || '').replace(/\/$/, '');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`${baseUrl}/vehicles/all`, {
      headers: { apikey: apiKey, secretkey: secretKey },
      signal: ctrl.signal,
    });
    return {
      id: 'fulltrack',
      name: 'FullTrack',
      online: res.ok,
      detail: res.ok ? 'Rastreamento online' : `HTTP ${res.status}`,
      configured: true,
    };
  } catch {
    return {
      id: 'fulltrack',
      name: 'FullTrack',
      online: false,
      detail: 'Indisponível',
      configured: true,
    };
  } finally {
    clearTimeout(t);
  }
}

async function statusSmtp() {
  if (!smtpConfigurado()) {
    return {
      id: 'smtp',
      name: 'E-mail (SMTP)',
      online: false,
      detail: 'N/A',
      configured: false,
    };
  }
  const r = await verifySmtp(5000);
  return {
    id: 'smtp',
    name: 'E-mail (SMTP)',
    online: r.ok,
    detail: r.detail,
    configured: r.configured,
  };
}

async function statusWebPush() {
  const saude = obterSaudeVapidPublica();
  const configured = Boolean(saude.pushEnabled);
  if (!configured) {
    return {
      id: 'webpush',
      name: 'Web Push',
      online: false,
      detail: 'N/A',
      configured: false,
    };
  }
  return {
    id: 'webpush',
    name: 'Web Push',
    online: Boolean(saude.vapidAtivo),
    detail: saude.vapidAtivo ? 'VAPID ativo' : 'VAPID inválida',
    configured: true,
  };
}

async function statusBkOffice() {
  if (!bkOfficeConfigurado()) {
    return {
      id: 'bkoffice',
      name: 'BK Office',
      online: false,
      detail: 'N/A',
      configured: false,
    };
  }
<<<<<<< HEAD
  try {
    const { getBkOfficeStatus } = await import('./services/bkoffice/syncVendas.js');
    const st = getBkOfficeStatus();
    const sch = st.scheduler;
    let detail = 'Configurada';
    if (sch?.ativo) {
      const seg = Math.round((sch.intervalo_ms || 0) / 1000);
      detail = st.job_rodando
        ? `Ativa — sync em andamento (a cada ${seg}s, loja ${sch.id_loja})`
        : `Ativa — automática a cada ${seg}s (loja ${sch.id_loja})`;
    } else {
      detail = 'Configurada — automático desligado (BKOFFICE_SYNC_CRON_MS)';
    }
    return {
      id: 'bkoffice',
      name: 'BK Office',
      online: true,
      detail,
      configurada: true,
    };
  } catch {
    return {
      id: 'bkoffice',
      name: 'BK Office',
      online: true,
      detail: 'Configurada',
      configurada: true,
    };
  }
=======
  return {
    id: 'bkoffice',
    name: 'BK Office',
    online: true,
    detail: 'Configurada',
    configured: true,
  };
>>>>>>> 99b8bb8 (FIX: Melhoria no UI/UX e ajuste no status API)
}

async function statusInfoSimples() {
  const token = (process.env.INFOSIMPLES_TOKEN || '').trim();
  if (!token) {
    return {
      id: 'infosimples',
      name: 'InfoSimples (Detran/Sefaz)',
      online: false,
      detail: 'N/A',
      configured: false,
    };
  }
  const probe = await probeUrl('https://api.infosimples.com/');
  return {
    id: 'infosimples',
    name: 'InfoSimples (Detran/Sefaz)',
    online: probe.online,
    detail: probe.online ? 'Conectada (pronta para consultas)' : 'Indisponível',
    configured: true,
  };
}

/** Páginas e as APIs externas que cada uma usa. */
const PAGINAS = [
  {
    id: 'sistema',
    name: 'Infraestrutura',
    paths: [],
    apis: ['postgres', 'smtp', 'webpush'],
  },
  {
    id: 'freela',
    name: 'Freelancers',
    paths: ['/freelancers'],
    apis: ['freecontrol', 'whatsapp'],
  },
  {
    id: 'mapa',
    name: 'Mapa',
    paths: ['/mapa'],
    apis: ['fulltrack'],
  },
  {
    id: 'frota',
    name: 'Frota',
    paths: ['/frota'],
    apis: ['fulltrack', 'whatsapp', 'infosimples'],
  },
  {
    id: 'checklist',
    name: 'Checklist',
    paths: ['/checklist'],
    apis: ['whatsapp', 'smtp'],
  },
  {
    id: 'visitas',
    name: 'Visitas',
    paths: ['/visitas', '/relatorio'],
    apis: ['whatsapp', 'smtp'],
  },
  {
    id: 'chamados',
    name: 'Chamados',
    paths: ['/chamados'],
    apis: ['whatsapp'],
  },
  {
    id: 'ncs',
    name: 'NCs',
    paths: ['/nc'],
    apis: ['whatsapp'],
  },
  {
    id: 'estoque',
    name: 'Estoque',
    paths: ['/estoque'],
    apis: ['bkoffice'],
  },
  {
    id: 'escala',
    name: 'Escala',
    paths: ['/escalas'],
    apis: [],
  },
];

/** Sempre mostra Status API no menu. */
export function integrationsConfiguradasPublico() {
  return {
    hasIntegrations: true,
    integrations: PAGINAS.filter((p) => p.id !== 'sistema').map((p) => ({ id: p.id, name: p.name })),
  };
}

function resolverContexto(contexto) {
  const c = String(contexto || '').trim().toLowerCase();
  if (!c) return null;
  return PAGINAS.find((p) => p.id === c) || null;
}

function toPublicApi(svc) {
  return {
    id: svc.id,
    name: svc.name,
    online: Boolean(svc.online),
    configured: svc.configured !== false,
    detail: svc.configured === false ? 'N/A' : svc.detail,
  };
}

/**
 * @param {{ contexto?: string }} opts
 * contexto = id da página (freela, mapa, …). Sem contexto → todas as páginas.
 */
export async function obterIntegrationsStatus(opts = {}) {
  const checkedAt = new Date().toISOString();

  const [postgres, freecontrol, whatsapp, fulltrack, smtp, webpush, bkoffice, infosimples] =
    await Promise.all([
      statusPostgres(),
      statusFreeControl(),
      statusWhatsApp(),
      statusFullTrack(),
      statusSmtp(),
      statusWebPush(),
      statusBkOffice(),
      statusInfoSimples(),
    ]);

  const byId = {
    postgres,
    freecontrol,
    whatsapp,
    fulltrack,
    smtp,
    webpush,
    bkoffice,
    infosimples,
  };

  const paginaFiltro = resolverContexto(opts.contexto);
  const paginas = paginaFiltro
    ? [paginaFiltro]
    : PAGINAS.filter((p) => p.id === 'sistema' || p.apis.length > 0);

  const groups = paginas
    .map((pagina) => {
      const lista = pagina.apis.map((id) => byId[id]).filter(Boolean);
      return {
        id: pagina.id,
        name: pagina.name,
        apis: lista.map(toPublicApi),
      };
    })
    .filter((g) => (paginaFiltro ? true : g.apis.length > 0));

  const services = Object.values(byId).map(toPublicApi);

  const items = groups.flatMap((g) =>
    g.apis.map((a) => ({
      ...a,
      id: `${g.id}:${a.id}`,
      name: `${g.name} · ${a.name}`,
    })),
  );

  const apiCore = toPublicApi({
    id: 'api',
    name: 'API Meridian',
    online: postgres.online,
    configured: true,
    detail: postgres.online ? 'Online' : postgres.detail,
  });

  return {
    success: true,
    checked_at: checkedAt,
    api: apiCore,
    services,
    groups,
    items,
    hasIntegrations: true,
    contexto: paginaFiltro?.id || null,
  };
}
