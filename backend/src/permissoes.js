import { pool } from './db.js';

export const CATALOGO_PERMISSOES = [
  { codigo: 'portal.dashboard.ver', nome: 'Ver dashboard (início)', grupo: 'Portal', ordem: 10 },
  { codigo: 'portal.ranking.ver', nome: 'Ver ranking de lojas', grupo: 'Portal', ordem: 20 },
  { codigo: 'portal.visitas.ver', nome: 'Ver histórico de visitas', grupo: 'Portal', ordem: 30 },
  { codigo: 'portal.lojas.ver', nome: 'Ver cadastro de lojas', grupo: 'Portal', ordem: 40 },
  { codigo: 'portal.ncs.ver', nome: 'Ver não conformidades', grupo: 'Portal', ordem: 50 },
  { codigo: 'checklist.ver', nome: 'Ver módulo de checklist', grupo: 'Checklist', ordem: 60 },
  { codigo: 'checklist.executar', nome: 'Executar checklist em loja', grupo: 'Checklist', ordem: 70 },
  { codigo: 'chamados.ver', nome: 'Ver chamados de manutenção', grupo: 'Manutenção', ordem: 80 },
  { codigo: 'chamados.abrir', nome: 'Abrir chamado de manutenção', grupo: 'Manutenção', ordem: 90 },
  { codigo: 'chamados.assumir', nome: 'Assumir chamado', grupo: 'Manutenção', ordem: 100 },
  { codigo: 'chamados.aprovar', nome: 'Aprovar orçamentos', grupo: 'Manutenção', ordem: 105 },
  { codigo: 'configuracoes.ver', nome: 'Acessar aba Configurações', grupo: 'Configurações', ordem: 75 },
  { codigo: 'usuarios.listar', nome: 'Listar usuários', grupo: 'Usuários', ordem: 110 },
  { codigo: 'usuarios.gerenciar', nome: 'Gerenciar usuários e permissões', grupo: 'Usuários', ordem: 120 },
  { codigo: 'lojas.todas', nome: 'Acesso a todas as lojas', grupo: 'Lojas', ordem: 130 },
];

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

export function normalizarPermissoes(codigos) {
  const validos = new Set(CATALOGO_PERMISSOES.map((p) => p.codigo));
  return [...new Set((codigos || []).filter((c) => validos.has(c)))];
}

export function permissoesPadraoTi() {
  return CATALOGO_PERMISSOES.map((p) => p.codigo);
}

/** TI recebe todas as funções quando nenhuma permissão foi informada. */
export function resolverPermissoesUsuario(perfil, permissoes) {
  const lista = normalizarPermissoes(permissoes);
  if (perfil === 'ti' && !lista.length) return permissoesPadraoTi();
  return lista;
}

export async function syncUsuarioPermissoes(idUsuario, codigos) {
  const lista = normalizarPermissoes(codigos);
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
  return (user?.permissoes || []).includes(codigo);
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
