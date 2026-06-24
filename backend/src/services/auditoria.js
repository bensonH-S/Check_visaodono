import { pool } from '../db.js';
import { logger } from '../logger.js';

let tabelaOk = null;

const SQL_CRIAR_TABELA = `
CREATE TABLE IF NOT EXISTS sistema_auditoria (
  id_auditoria SERIAL PRIMARY KEY,
  id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  modulo VARCHAR(40) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  entidade VARCHAR(60),
  id_referencia VARCHAR(80),
  descricao TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_created ON sistema_auditoria(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_auditoria_modulo ON sistema_auditoria(modulo);
`;

async function garantirTabela() {
  if (tabelaOk != null) return tabelaOk;
  try {
    await pool.query(SQL_CRIAR_TABELA);
    tabelaOk = true;
  } catch (e) {
    logger.warn('auditoria', 'Tabela sistema_auditoria indisponível', { error: e.message });
    tabelaOk = false;
  }
  return tabelaOk;
}

/** Registra evento na trilha de auditoria (não bloqueia operação principal). */
export async function registrarAuditoria({
  idUsuario,
  modulo,
  acao,
  entidade = null,
  idReferencia = null,
  descricao,
  detalhes = null,
}) {
  if (!(await garantirTabela())) return;
  try {
    await pool.query(
      `INSERT INTO sistema_auditoria (id_usuario, modulo, acao, entidade, id_referencia, descricao, detalhes)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        idUsuario ?? null,
        String(modulo || 'sistema').slice(0, 40),
        String(acao || 'acao').slice(0, 40),
        entidade ? String(entidade).slice(0, 60) : null,
        idReferencia != null ? String(idReferencia).slice(0, 80) : null,
        String(descricao || '').slice(0, 4000),
        detalhes ? JSON.stringify(detalhes) : null,
      ],
    );
  } catch (e) {
    logger.warn('auditoria', 'Falha ao registrar evento', { error: e.message, modulo, acao });
  }
}

export async function initAuditoria() {
  return garantirTabela();
}

const LIMITE_MAX = 500;

export async function listarAuditoria({ limite = 100, offset = 0, modulo = null } = {}) {
  const take = Math.min(Math.max(Number(limite) || 100, 1), LIMITE_MAX);
  const skip = Math.max(Number(offset) || 0, 0);
  const filtroModulo = modulo ? String(modulo).trim().toLowerCase() : null;

  const params = [take, skip];
  let filtroSql = '';
  if (filtroModulo) {
    params.push(filtroModulo);
    filtroSql = `WHERE LOWER(sub.modulo) = $${params.length}`;
  }

  const temSistema = await garantirTabela();

  const partes = [];

  if (temSistema) {
    partes.push(`
      SELECT a.created_at, a.modulo, a.acao, a.entidade, a.id_referencia, a.descricao,
             u.nome AS usuario_nome, a.id_usuario
      FROM sistema_auditoria a
      LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
    `);
  }

  partes.push(`
    SELECT e.created_at, 'chamados'::varchar AS modulo, e.tipo AS acao, 'chamado'::varchar AS entidade,
           e.id_chamado::text AS id_referencia,
           COALESCE(NULLIF(TRIM(e.texto), ''), e.tipo) AS descricao,
           u.nome AS usuario_nome, e.id_usuario
    FROM manut_chamado_eventos e
    LEFT JOIN usuarios u ON u.id_usuario = e.id_usuario
  `);

  partes.push(`
    SELECT a.created_at, 'chamados'::varchar AS modulo, 'atualizacao'::varchar AS acao, 'chamado'::varchar AS entidade,
           a.id_chamado::text AS id_referencia, a.texto AS descricao,
           u.nome AS usuario_nome, a.id_usuario
    FROM manut_atualizacoes a
    LEFT JOIN usuarios u ON u.id_usuario = a.id_usuario
  `);

  partes.push(`
    SELECT fa.data_inicio AS created_at, 'frota'::varchar AS modulo, 'assumir_veiculo'::varchar AS acao,
           'veiculo'::varchar AS entidade, fa.id_veiculo::text AS id_referencia,
           (COALESCE(u.nome, 'Colaborador') || ' assumiu o veículo ' || COALESCE(v.placa, '')) AS descricao,
           u.nome AS usuario_nome, fa.id_usuario
    FROM frota_assuncoes fa
    JOIN frota_veiculos v ON v.id_veiculo = fa.id_veiculo
    LEFT JOIN usuarios u ON u.id_usuario = fa.id_usuario
  `);

  partes.push(`
    SELECT fa.data_fim AS created_at, 'frota'::varchar AS modulo, 'devolver_veiculo'::varchar AS acao,
           'veiculo'::varchar AS entidade, fa.id_veiculo::text AS id_referencia,
           (COALESCE(u.nome, 'Colaborador') || ' devolveu o veículo ' || COALESCE(v.placa, '')) AS descricao,
           u.nome AS usuario_nome, fa.id_usuario
    FROM frota_assuncoes fa
    JOIN frota_veiculos v ON v.id_veiculo = fa.id_veiculo
    LEFT JOIN usuarios u ON u.id_usuario = fa.id_usuario
    WHERE fa.data_fim IS NOT NULL
  `);

  partes.push(`
    SELECT v.created_at, 'visitas'::varchar AS modulo, 'iniciar_visita'::varchar AS acao,
           'visita'::varchar AS entidade, v.id_visita::text AS id_referencia,
           ('Visita iniciada — loja ' || COALESCE(l.name, '') || COALESCE(' (' || t.nome || ')', '')) AS descricao,
           u.nome AS usuario_nome, v.id_usuario
    FROM visitas v
    LEFT JOIN lojas l ON l.id_loja = v.id_loja
    LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
    LEFT JOIN tipos_checklist t ON t.id_tipo_checklist = v.id_tipo_checklist
  `);

  partes.push(`
    SELECT v.updated_at AS created_at, 'visitas'::varchar AS modulo, 'finalizar_visita'::varchar AS acao,
           'visita'::varchar AS entidade, v.id_visita::text AS id_referencia,
           ('Visita finalizada — loja ' || COALESCE(l.name, '') || ' (' || COALESCE(v.duracao_minutos::text, '?') || ' min)') AS descricao,
           u.nome AS usuario_nome, v.id_usuario
    FROM visitas v
    LEFT JOIN lojas l ON l.id_loja = v.id_loja
    LEFT JOIN usuarios u ON u.id_usuario = v.id_usuario
    WHERE v.status = 'Finalizada'
  `);

  partes.push(`
    SELECT h.created_at, 'checklist'::varchar AS modulo, 'nota_registrada'::varchar AS acao,
           'loja'::varchar AS entidade, h.id_loja::text AS id_referencia,
           ('Nota ' || h.nota::text || ' na loja ' || COALESCE(l.name, '')) AS descricao,
           NULL::varchar AS usuario_nome, NULL::int AS id_usuario
    FROM historico_notas h
    LEFT JOIN lojas l ON l.id_loja = h.id_loja
  `);

  const unionSql = partes.join('\nUNION ALL\n');

  const { rows } = await pool.query(
    `SELECT sub.created_at, sub.modulo, sub.acao, sub.entidade, sub.id_referencia, sub.descricao,
            sub.usuario_nome, sub.id_usuario
     FROM (${unionSql}) sub
     ${filtroSql}
     ORDER BY sub.created_at DESC
     LIMIT $1 OFFSET $2`,
    params,
  );

  return rows.map((r) => ({
    created_at: r.created_at,
    modulo: r.modulo,
    acao: r.acao,
    entidade: r.entidade,
    id_referencia: r.id_referencia,
    descricao: r.descricao,
    usuario_nome: r.usuario_nome,
    id_usuario: r.id_usuario != null ? Number(r.id_usuario) : null,
  }));
}
