import { pool } from '../db.js';

let tabelaOk = null;

async function garantirTabela() {
  if (tabelaOk != null) return tabelaOk;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sistema_auditoria'`,
    );
    tabelaOk = rows.length > 0;
  } catch {
    tabelaOk = false;
  }
  return tabelaOk;
}

/** Registra evento na trilha de auditoria (ignora se tabela ainda não existir). */
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
  } catch {
    /* não bloqueia operação principal */
  }
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
