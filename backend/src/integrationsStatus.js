/**
 * Status das APIs externas por página/módulo (sem expor segredos).
 */
import { fulltrackStatus } from './services/fulltrackFleet.js';
import { smtpConfigurado } from './services/mailer.js';
import { wppEnabled, gerarTokenWpp, verificarConexaoWpp } from './services/wppClient.js';

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

async function statusFreeControl() {
  const base = freecontrolBaseUrl();
  const token = freecontrolToken();
  if (!base || !token) {
    return {
      id: 'freecontrol',
      name: 'FreeControl',
      online: false,
      detail: 'Não configurada',
      configurada: false,
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
    configurada: true,
  };
}

async function statusWhatsApp() {
  if (!wppEnabled()) {
    return {
      id: 'whatsapp',
      name: 'WhatsApp',
      online: false,
      detail: 'Desabilitado',
      configurada: false,
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
      configurada: true,
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
      configurada: true,
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
      detail: st.motivo === 'desabilitado_por_env' ? 'Desabilitada' : 'Não configurada',
      configurada: false,
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
      configurada: true,
    };
  } catch {
    return {
      id: 'fulltrack',
      name: 'FullTrack',
      online: false,
      detail: 'Indisponível',
      configurada: true,
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
      detail: 'Não configurado',
      configurada: false,
    };
  }
  return {
    id: 'smtp',
    name: 'E-mail (SMTP)',
    online: true,
    detail: 'Configurado',
    configurada: true,
  };
}

async function statusBkOffice() {
  if (!bkOfficeConfigurado()) {
    return {
      id: 'bkoffice',
      name: 'BK Office',
      online: false,
      detail: 'Não configurada',
      configurada: false,
    };
  }
  return {
    id: 'bkoffice',
    name: 'BK Office',
    online: true,
    detail: 'Configurada',
    configurada: true,
  };
}

async function statusInfoSimples() {
  const token = (process.env.INFOSIMPLES_TOKEN || '').trim();
  if (!token) {
    return {
      id: 'infosimples',
      name: 'InfoSimples (Detran)',
      online: false,
      detail: 'Não configurada (Token ausente)',
      configurada: false,
    };
  }
  const probe = await probeUrl('https://api.infosimples.com/');
  return {
    id: 'infosimples',
    name: 'InfoSimples (Detran)',
    online: probe.online,
    detail: probe.online ? 'Conectada (Pronta para consultas)' : 'Indisponível',
    configurada: true,
  };
}

/** Páginas e as APIs externas que cada uma usa. */
const PAGINAS = [
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
    integrations: PAGINAS.map((p) => ({ id: p.id, name: p.name })),
  };
}

function resolverContexto(contexto) {
  const c = String(contexto || '').trim().toLowerCase();
  if (!c) return null;
  return PAGINAS.find((p) => p.id === c) || null;
}

/**
 * @param {{ contexto?: string }} opts
 * contexto = id da página (freela, mapa, …). Sem contexto → todas as páginas.
 */
export async function obterIntegrationsStatus(opts = {}) {
  const [freecontrol, whatsapp, fulltrack, smtp, bkoffice, infosimples] = await Promise.all([
    statusFreeControl(),
    statusWhatsApp(),
    statusFullTrack(),
    statusSmtp(),
    statusBkOffice(),
    statusInfoSimples(),
  ]);

  const byId = { freecontrol, whatsapp, fulltrack, smtp, bkoffice, infosimples };

  const paginaFiltro = resolverContexto(opts.contexto);
  const paginas = paginaFiltro ? [paginaFiltro] : PAGINAS;

  const groups = paginas
    .map((pagina) => {
      const lista = pagina.apis.map((id) => byId[id]).filter(Boolean);
      return {
        id: pagina.id,
        name: pagina.name,
        apis: lista.map(({ id, name, online, detail }) => ({ id, name, online, detail })),
      };
    })
    // No hub: só páginas que têm API externa
    .filter((g) => (paginaFiltro ? true : g.apis.length > 0));

  // Flat para compatibilidade (primeira API de cada grupo)
  const items = groups.flatMap((g) =>
    g.apis.map((a) => ({
      ...a,
      id: `${g.id}:${a.id}`,
      name: `${g.name} · ${a.name}`,
    })),
  );

  return { groups, items, hasIntegrations: true, contexto: paginaFiltro?.id || null };
}
