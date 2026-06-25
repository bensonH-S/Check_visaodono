import { pool } from './db.js';

export const CATALOGO_PERMISSOES = [
  { codigo: 'portal.dashboard.ver', nome: 'Ver dashboard (início, ranking e NCs)', grupo: 'Início', ordem: 10 },
  { codigo: 'portal.visitas.ver', nome: 'Ver histórico de visitas', grupo: 'Visitas', ordem: 20 },
  { codigo: 'checklist.ver', nome: 'Acessar checklist em loja', grupo: 'Checklist', ordem: 26 },
  { codigo: 'checklist.executar', nome: 'Executar checklist e registrar visita', grupo: 'Checklist', ordem: 28 },
  { codigo: 'configuracoes.perguntas', nome: 'Perguntas do checklist', grupo: 'Configurações', ordem: 68 },
  { codigo: 'configuracoes.notificacoes', nome: 'Gerir notificações', grupo: 'Configurações', ordem: 69 },
  { codigo: 'configuracoes.ver', nome: 'Acessar configurações', grupo: 'Configurações', ordem: 70 },
  { codigo: 'configuracoes.auditoria', nome: 'Ver auditoria do sistema', grupo: 'Configurações', ordem: 71 },
  { codigo: 'portal.lojas.ver', nome: 'Ver cadastro de lojas', grupo: 'Configurações', ordem: 72 },
  { codigo: 'chamados.ver', nome: 'Ver chamados de manutenção', grupo: 'Manutenção', ordem: 80 },
  { codigo: 'chamados.abrir', nome: 'Abrir chamado de manutenção', grupo: 'Manutenção', ordem: 90 },
  { codigo: 'chamados.assumir', nome: 'Assumir chamado', grupo: 'Manutenção', ordem: 100 },
  { codigo: 'chamados.aprovar', nome: 'Aprovar orçamentos', grupo: 'Manutenção', ordem: 105 },
  { codigo: 'usuarios.listar', nome: 'Listar usuários (ex.: escolher auditor no checklist)', grupo: 'Usuários', ordem: 110 },
  { codigo: 'usuarios.gerenciar', nome: 'Gerenciar usuários e permissões', grupo: 'Usuários', ordem: 120 },
  { codigo: 'lojas.todas', nome: 'Acesso a todas as lojas', grupo: 'Lojas', ordem: 130 },
  { codigo: 'frota.regioes', nome: 'Gerenciar regiões de atuação', grupo: 'Lojas', ordem: 131 },
  { codigo: 'frota.usar', nome: 'Usar módulo de frota no app mobile', grupo: 'Frota', ordem: 140 },
  { codigo: 'frota.gerenciar', nome: 'Cadastrar veículos e gerenciar frota', grupo: 'Frota', ordem: 145 },
];

const PERMISSOES_DASHBOARD = new Set([
  'portal.dashboard.ver',
  'portal.ranking.ver',
  'portal.ncs.ver',
]);

let catalogoSyncPromise = null;

/** Garante que todas as permissões do catálogo existem na tabela permissoes (evita FK ao salvar usuário). */
export async function ensureCatalogoPermissoes() {
  if (!catalogoSyncPromise) {
    catalogoSyncPromise = (async () => {
      for (const p of CATALOGO_PERMISSOES) {
        await pool.query(
          `INSERT INTO permissoes (codigo, nome, grupo, ordem)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (codigo) DO UPDATE SET
             nome = EXCLUDED.nome,
             grupo = EXCLUDED.grupo,
             ordem = EXCLUDED.ordem`,
          [p.codigo, p.nome, p.grupo, p.ordem],
        );
      }
      codigosValidosCache = null;
    })().catch((e) => {
      catalogoSyncPromise = null;
      throw e;
    });
  }
  return catalogoSyncPromise;
}

let codigosValidosCache = null;

async function carregarCodigosValidos() {
  await ensureCatalogoPermissoes();
  if (!codigosValidosCache) {
    const { rows } = await pool.query('SELECT codigo FROM permissoes');
    codigosValidosCache = new Set(rows.map((r) => r.codigo));
  }
  return codigosValidosCache;
}

/** Catálogo efetivo (banco após sync), usado na tela de Usuários. */
export async function listarCatalogoPermissoes() {
  await ensureCatalogoPermissoes();
  const { rows } = await pool.query(
    'SELECT codigo, nome, grupo, ordem FROM permissoes ORDER BY ordem, codigo',
  );
  return rows.length ? rows : [...CATALOGO_PERMISSOES];
}

export async function carregarPermissoesUsuario(idUsuario) {
  const { rows } = await pool.query(
    `SELECT up.codigo
     FROM usuario_permissoes up
     JOIN permissoes p ON p.codigo = up.codigo
     WHERE up.id_usuario = $1
     ORDER BY p.ordem`,
    [idUsuario],
  );
  return rows.map((r) => r.codigo);
}

export async function normalizarPermissoes(codigos) {
  const validos = await carregarCodigosValidos();
  return [...new Set((codigos || []).filter((c) => validos.has(c)))];
}

/** Permissões efetivas do usuário (apenas as informadas explicitamente). */
export async function resolverPermissoesUsuario(_perfil, permissoes) {
  return normalizarPermissoes(permissoes);
}

export async function syncUsuarioPermissoes(idUsuario, codigos) {
  await ensureCatalogoPermissoes();
  const lista = await normalizarPermissoes(codigos);
  await pool.query('DELETE FROM usuario_permissoes WHERE id_usuario = $1', [idUsuario]);
  for (const codigo of lista) {
    await pool.query(
      `INSERT INTO usuario_permissoes (id_usuario, codigo) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [idUsuario, codigo],
    );
  }
  return lista;
}

export function temPermissao(user, codigo) {
  const perms = user?.permissoes || [];
  if (perms.includes(codigo)) return true;
  if (codigo === 'portal.dashboard.ver' && perms.some((p) => PERMISSOES_DASHBOARD.has(p))) {
    return true;
  }
  return false;
}

export function acessoTodasLojas(user) {
  return temPermissao(user, 'lojas.todas');
}

export async function attachPermissoesUsuario(req, _res, next) {
  if (!req.user?.sub) return next();
  try {
    req.user.permissoes = await carregarPermissoesUsuario(req.user.sub);
    next();
  } catch (e) {
    next(e);
  }
}

export function requirePermissao(...codigos) {
  return (req, res, next) => {
    if (!codigos.some((c) => temPermissao(req.user, c))) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}
