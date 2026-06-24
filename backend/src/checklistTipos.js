import { pool } from './db.js';
import { carregarPermissoesUsuario, temPermissao } from './permissoes.js';

let schemaTiposCache = null;

export async function schemaTiposChecklistAtivo() {
  if (schemaTiposCache != null) return schemaTiposCache;
  const { rows } = await pool.query(
    "SELECT to_regclass('public.tipos_checklist') IS NOT NULL AS ok",
  );
  schemaTiposCache = !!rows[0]?.ok;
  return schemaTiposCache;
}

export async function carregarCargoUsuario(idUsuario) {
  const { rows } = await pool.query(
    `SELECT u.cargo_aprovacao, u.perfil::text AS perfil
     FROM usuarios u WHERE u.id_usuario = $1`,
    [idUsuario],
  );
  return rows[0] || null;
}

export function cargoEfetivoUsuario(row) {
  if (!row) return null;
  return row.cargo_aprovacao || row.perfil || null;
}

export async function listarTiposChecklist({ apenasAtivos = true } = {}) {
  const { rows } = await pool.query(
    `SELECT id_tipo_checklist, codigo, nome, descricao, ordem, ativo
     FROM tipos_checklist
     ${apenasAtivos ? 'WHERE ativo = TRUE' : ''}
     ORDER BY ordem, nome`,
  );
  return rows;
}

export async function tiposChecklistDoUsuario(idUsuario) {
  const permissoes = await carregarPermissoesUsuario(idUsuario);
  const userCtx = { permissoes };
  if (!temPermissao(userCtx, 'checklist.ver') && !temPermissao(userCtx, 'checklist.executar')) {
    return [];
  }

  const row = await carregarCargoUsuario(idUsuario);
  const cargo = cargoEfetivoUsuario(row);
  if (!cargo) return [];

  const { rows } = await pool.query(
    `SELECT t.id_tipo_checklist, t.codigo, t.nome, t.descricao, t.ordem, t.ativo
     FROM tipos_checklist t
     JOIN cargo_checklist cc ON cc.id_tipo_checklist = t.id_tipo_checklist
     WHERE cc.cargo_codigo = $1 AND t.ativo = TRUE
     ORDER BY t.ordem, t.nome`,
    [cargo],
  );
  return rows;
}

export async function usuarioPodeTipoChecklist(idUsuario, idTipoChecklist) {
  const permitidos = await tiposChecklistDoUsuario(idUsuario);
  return permitidos.some((t) => t.id_tipo_checklist === Number(idTipoChecklist));
}

export async function resolverTipoChecklist(idUsuario, { codigo, id } = {}) {
  const permitidos = await tiposChecklistDoUsuario(idUsuario);
  if (!permitidos.length) {
    return { error: 'Nenhum tipo de checklist disponível para o seu perfil' };
  }

  if (codigo || id) {
    const alvo = permitidos.find(
      (t) =>
        (codigo && t.codigo === String(codigo)) ||
        (id != null && t.id_tipo_checklist === Number(id)),
    );
    if (!alvo) {
      return { error: 'Tipo de checklist não permitido para o seu perfil' };
    }
    return { tipo: alvo };
  }

  if (permitidos.length === 1) return { tipo: permitidos[0] };
  return { tipos: permitidos, error: 'Selecione o tipo de checklist' };
}

export async function obterTipoChecklistPorId(idTipoChecklist) {
  const { rows } = await pool.query(
    `SELECT id_tipo_checklist, codigo, nome, descricao, ordem, ativo
     FROM tipos_checklist WHERE id_tipo_checklist = $1`,
    [idTipoChecklist],
  );
  return rows[0] || null;
}

export async function obterTipoChecklistDaVisita(idVisita) {
  const { rows } = await pool.query(
    `SELECT t.id_tipo_checklist, t.codigo, t.nome, t.descricao
     FROM visitas v
     JOIN tipos_checklist t ON t.id_tipo_checklist = v.id_tipo_checklist
     WHERE v.id_visita = $1`,
    [idVisita],
  );
  return rows[0] || null;
}
