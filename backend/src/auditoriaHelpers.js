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

function pathCompleto(req) {
  return `${req.baseUrl || ''}${req.path || ''}`.replace(/\/+/g, '/');
}

function inferirModulo(path) {
  if (path.includes('/usuarios')) return 'usuarios';
  if (path.includes('/cargos')) return 'cargos';
  if (path.includes('/checklist')) return 'checklist';
  if (path.includes('/lojas')) return 'lojas';
  if (path.includes('/visitas')) return 'visitas';
  if (path.includes('/frota')) return 'frota';
  if (path.includes('/manutencao')) return 'configuracoes';
  if (path.includes('/wpp')) return 'configuracoes';
  if (path.includes('/auth')) return 'auth';
  if (path.includes('/nao-conformidades')) return 'checklist';
  if (path.includes('/push')) return 'sistema';
  return 'sistema';
}

/** Descrição genérica para mutações HTTP sem meta explícita. */
export function inferirAuditoriaHttp(req) {
  const path = pathCompleto(req);
  const modulo = inferirModulo(path);
  const acao = ACAO_HTTP[req.method] || req.method.toLowerCase();
  const partes = path.split('/').filter(Boolean);
  const entidade = partes[partes.length - 1] || 'recurso';

  return {
    modulo,
    acao,
    entidade,
    idReferencia: /^\d+$/.test(entidade) ? entidade : null,
    descricao: `${acao} em ${path}`,
    detalhes: { corpo: sanitizarCorpo(req.body) },
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
const IGNORAR_CHAMADOS = /\/manutencao\/chamados/i;

export function middlewareAuditoriaHttp(req, res, next) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();

  const path = pathCompleto(req);
  if (IGNORAR_PREFIXOS.some((p) => path.includes(p))) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    if (req.auditoriaRegistrada) return;
    if (IGNORAR_CHAMADOS.test(path)) return;

    const payload = req.auditoriaMeta || inferirAuditoriaHttp(req);
    void auditar(req, payload);
  });

  next();
}
