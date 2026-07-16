import { registrarAuditoria } from './services/auditoria.js';

const CAMPOS_SENSIVEIS = new Set([
  'senha',
  'senha_hash',
  'password',
  'token',
  'accessToken',
  'authorization',
]);

/** Remove dados sensíveis antes de gravar na trilha. */
export function sanitizarCorpo(body) {
  if (!body || typeof body !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (CAMPOS_SENSIVEIS.has(k)) {
      if (v) out[k] = '[alterado]';
      continue;
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = sanitizarCorpo(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function resumirDiff(antes = {}, depois = {}, campos) {
  const alteracoes = {};
  for (const campo of campos) {
    const a = antes[campo];
    const d = depois[campo];
    const igual = JSON.stringify(a) === JSON.stringify(d);
    if (!igual) alteracoes[campo] = { de: a ?? null, para: d ?? null };
  }
  return Object.keys(alteracoes).length ? alteracoes : null;
}

export function snapshotUsuarioAuditoria(u) {
  if (!u) return null;
  return {
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    cargo_aprovacao: u.cargo_aprovacao,
    cargo_nome: u.cargo_nome || u.cargo,
    permissoes: u.permissoes || [],
    lojas_ids: u.lojas_ids || (u.lojas || []).map((l) => l.id_loja),
    acesso_todas_lojas: u.acesso_todas_lojas,
    telefone_whatsapp: u.telefone_whatsapp,
    notifica_whatsapp: u.notifica_whatsapp,
  };
}

const ACAO_HTTP = {
  POST: 'criar',
  PATCH: 'atualizar',
  PUT: 'atualizar',
  DELETE: 'excluir',
};

const VERBO_PT = {
  POST: 'Criou',
  PATCH: 'Alterou',
  PUT: 'Alterou',
  DELETE: 'Excluiu',
};

function pathCompleto(req) {
  return `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+/g, '/');
}

function pathCurto(path) {
  return String(path || '')
    .replace(/^\/auditoria\/api/i, '')
    .replace(/^\/api/i, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

export function inferirModulo(path) {
  const p = String(path || '').toLowerCase();
  if (p.includes('/usuarios')) return 'usuarios';
  if (p.includes('/cargos')) return 'cargos';
  if (p.includes('/checklist')) return 'checklist';
  if (p.includes('/lojas')) return 'lojas';
  if (p.includes('/visitas') && !p.includes('/escalas')) return 'visitas';
  if (p.includes('/escalas')) return 'escalas';
  if (p.includes('/metas')) return 'metas';
  if (p.includes('/frota')) return 'frota';
  if (p.includes('/manutencao/chamados')) return 'chamados';
  if (p.includes('/manutencao')) return 'configuracoes';
  if (p.includes('/wpp')) return 'configuracoes';
  if (p.includes('/auth')) return 'auth';
  if (p.includes('/nao-conformidades')) return 'checklist';
  if (p.includes('/push')) return 'sistema';
  if (p.includes('/auditoria')) return 'configuracoes';
  return 'sistema';
}

function extrairContextoBody(body) {
  if (!body || typeof body !== 'object') return [];
  const bits = [];
  const push = (label, v) => {
    if (v == null || v === '') return;
    const s = Array.isArray(v) ? v.join(', ') : String(v).trim();
    if (!s || s === '[object Object]') return;
    bits.push(label ? `${label} ${s}` : s);
  };
  if (body.placa) push('placa', body.placa);
  if (body.nome) push(null, `“${body.nome}”`);
  if (body.titulo) push(null, `“${body.titulo}”`);
  if (body.email) push(null, body.email);
  if (body.modelo) push('modelo', body.modelo);
  if (body.tipo) push('tipo', body.tipo);
  if (body.descricao && typeof body.descricao === 'string') push(null, `“${body.descricao.slice(0, 80)}”`);
  if (body.id_loja) push('loja', `#${body.id_loja}`);
  if (body.semana_inicio) push('semana', body.semana_inicio);
  if (body.id_periodo) push('período', `#${body.id_periodo}`);
  return bits.slice(0, 4);
}

function descricaoRecurso(path, method, body) {
  const p = pathCurto(path).toLowerCase();
  const verbo = VERBO_PT[method] || method;
  const ctx = extrairContextoBody(body);
  const sufixo = ctx.length ? ` — ${ctx.join(' · ')}` : '';

  // IDs no path: /veiculos/4/documentos/6
  const ids = [...p.matchAll(/\/(\d+)(?:\/|$)/g)].map((m) => m[1]);

  if (p.includes('/escalas/visitas') && p.includes('/copiar')) {
    return `${verbo} (cópia) a escala de visitas${sufixo}`;
  }
  if (p.includes('/escalas/visitas')) return `${verbo} a escala de visitas${sufixo}`;
  if (p.includes('/metas/realizados')) return `${verbo} realizado de metas${sufixo}`;
  if (p.includes('/metas/rankings')) return `${verbo} ranking de metas${sufixo}`;
  if (p.includes('/metas/premios')) return `${verbo} prêmio de metas${sufixo}`;
  if (p.includes('/metas')) return `${verbo} metas${sufixo}`;
  if (p.includes('/frota/veiculos') && p.includes('/documentos')) {
    const idVeiculo = ids[0];
    return `${verbo} documento do veículo${idVeiculo ? ` #${idVeiculo}` : ''}${sufixo}`;
  }
  if (p.includes('/frota/veiculos')) {
    const idVeiculo = ids[0];
    return `${verbo} veículo da frota${idVeiculo ? ` #${idVeiculo}` : ''}${sufixo}`;
  }
  if (p.includes('/frota/regioes')) return `${verbo} região da frota${sufixo}`;
  if (p.includes('/frota/abastecimentos')) return `${verbo} abastecimento${sufixo}`;
  if (p.includes('/frota') && p.includes('/assum')) return `${verbo} assunção de veículo${sufixo}`;
  if (p.includes('/frota')) return `${verbo} registro da frota${sufixo}`;
  if (p.includes('/visitas')) {
    const idVisita = ids[0];
    return `${verbo} visita${idVisita ? ` #${idVisita}` : ''}${sufixo}`;
  }
  if (p.includes('/checklist/perguntas')) {
    const id = ids[0];
    return `${verbo} pergunta do checklist${id ? ` #${id}` : ''}${sufixo}`;
  }
  if (p.includes('/checklist')) return `${verbo} checklist${sufixo}`;
  if (p.includes('/nao-conformidades')) return `${verbo} não conformidade${sufixo}`;
  if (p.includes('/usuarios')) {
    const id = ids[0];
    return `${verbo} usuário${id ? ` #${id}` : ''}${sufixo}`;
  }
  if (p.includes('/cargos')) return `${verbo} cargo${sufixo}`;
  if (p.includes('/lojas')) return `${verbo} loja${sufixo}`;
  if (p.includes('/manutencao') && p.includes('/sla')) return `${verbo} configuração de SLA${sufixo}`;
  if (p.includes('/manutencao') && p.includes('/categor')) return `${verbo} categoria de chamado${sufixo}`;
  if (p.includes('/wpp')) return `${verbo} configuração WhatsApp${sufixo}`;
  if (p.includes('/push')) return `${verbo} inscrição de notificações`;

  const recurso = pathCurto(path).replace(/^\//, '') || 'recurso';
  return `${verbo} ${recurso}${sufixo}`;
}

/** Descrição genérica para mutações HTTP sem meta explícita. */
export function inferirAuditoriaHttp(req) {
  const path = pathCompleto(req);
  const modulo = inferirModulo(path);
  const acao = ACAO_HTTP[req.method] || req.method.toLowerCase();
  const partes = path.split('/').filter(Boolean);
  const ultima = partes[partes.length - 1] || 'recurso';
  const idRef = /^\d+$/.test(ultima) ? ultima : partes.find((p) => /^\d+$/.test(p)) || null;
  const corpo = sanitizarCorpo(req.body);

  return {
    modulo,
    acao,
    entidade: /^\d+$/.test(ultima) ? partes[partes.length - 2] || 'recurso' : ultima,
    idReferencia: idRef,
    descricao: descricaoRecurso(path, req.method, req.body),
    detalhes: { caminho: pathCurto(path), corpo },
  };
}

/** Registra auditoria e marca a requisição para evitar duplicata no middleware. */
export function auditar(req, payload) {
  if (req) req.auditoriaRegistrada = true;
  return registrarAuditoria({
    idUsuario: req?.user?.sub ?? payload?.idUsuario ?? null,
    ...payload,
  });
}

const IGNORAR_PREFIXOS = ['/public/', '/health'];
/** Endpoints ruidosos (GPS, push, etc.) — nunca entram na trilha. */
const IGNORAR_PATHS = [
  /\/manutencao\/chamados/i,
  /\/frota\/posicao(?:\/|\?|$)/i,
  /\/frota\/rastreamento\/ajustar-rota/i,
  /\/push\/subscribe/i,
  /\/push\/unsubscribe/i,
];

function caminhoRequest(req) {
  return `${pathCompleto(req)} ${req.originalUrl || ''} ${req.url || ''}`;
}

function deveIgnorarAuditoria(req) {
  const caminho = caminhoRequest(req);
  if (IGNORAR_PREFIXOS.some((p) => caminho.includes(p))) return true;
  return IGNORAR_PATHS.some((re) => re.test(caminho));
}

export function middlewareAuditoriaHttp(req, res, next) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();

  if (deveIgnorarAuditoria(req)) {
    req.auditoriaRegistrada = true;
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    if (req.auditoriaRegistrada) return;
    if (deveIgnorarAuditoria(req)) return;

    const payload = req.auditoriaMeta || inferirAuditoriaHttp(req);
    void auditar(req, payload);
  });

  next();
}
