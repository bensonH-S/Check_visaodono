import { pool } from '../db.js';
import { indiceLiderGrupoEscala, rotuloGrupoEscala } from '../escalaVisitas.js';

/** Regionais supervisores — recebem só relatório das lojas da região deles. */
export const REGIONAIS_SUPERVISORES_EMAIL = [
  'barbara@grupoalvim.com.br',
  'fagno@grupoalvim.com.br',
  'plinio@grupoalvim.com.br',
];

export const LIDERANCA_EMAIL = {
  ceo: 'felipe@grupoalvim.com.br',
  diretor: 'frotadf@gmail.com',
  supervisor_geral: 'igor@grupoalvim.com.br',
  ti: 'benson.henriquesilva@gmail.com',
};

/** Destinatários fixos de todo relatório de visita (além do regional da loja). */
export const RELATORIO_EMAIL_SEMPRE = [
  { email: LIDERANCA_EMAIL.supervisor_geral, papel: 'supervisor_geral', nome: 'Igor' },
  { email: LIDERANCA_EMAIL.diretor, papel: 'diretor', nome: 'Diretor' },
  { email: LIDERANCA_EMAIL.ceo, papel: 'dono', nome: 'Felipe' },
  { email: LIDERANCA_EMAIL.ti, papel: 'ti', nome: 'Benson' },
];

/** Regionais vinculados à região da loja (frota_regiao_regionais + id_regional legado). */
export async function resolverRegionaisLoja(idLoja) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.id_usuario, u.nome, u.email, r.nome AS nome_regiao
     FROM frota_regiao_lojas rl
     JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
     LEFT JOIN frota_regiao_regionais rr ON rr.id_regiao = r.id_regiao
     JOIN usuarios u ON u.id_usuario = COALESCE(rr.id_usuario, r.id_regional)
     WHERE rl.id_loja = $1
       AND u.ativo = TRUE
       AND u.email IS NOT NULL
       AND TRIM(u.email) <> ''
     ORDER BY u.nome`,
    [idLoja],
  );
  return rows;
}

/** Supervisor regional da loja via frota (líder de grupo: Bárbara / Fagno / Plínio). */
export async function resolverSupervisorRegionalLoja(idLoja) {
  const { rows } = await pool.query(
    `SELECT u.id_usuario, u.nome, u.email, u.telefone_whatsapp, u.notifica_whatsapp,
            r.nome AS nome_regiao
     FROM frota_regiao_lojas rl
     JOIN frota_regioes r ON r.id_regiao = rl.id_regiao AND r.ativo = TRUE
     JOIN usuarios u ON u.id_usuario = r.id_regional AND u.ativo = TRUE
     WHERE rl.id_loja = $1
     ORDER BY r.nome
     LIMIT 1`,
    [idLoja],
  );
  const row = rows[0];
  if (!row) return null;

  const grupoIdx = indiceLiderGrupoEscala(row.nome);
  return {
    ...row,
    grupo_nome: rotuloGrupoEscala(row.nome) || row.nome,
    grupo_idx: grupoIdx,
  };
}

/** Próxima visita na escala semanal para a loja (a partir de hoje). Se idRegional informado, só visitas desse regional. */
export async function proximaVisitaEscalaLoja(idLoja, referencia = new Date(), idRegional = null) {
  const ref =
    referencia instanceof Date
      ? referencia.toISOString().slice(0, 10)
      : String(referencia).slice(0, 10);

  const { rows } = await pool.query(
    `SELECT c.id_celula, c.id_regional, u.nome AS nome_regional,
            s.semana_inicio, c.dia,
            (s.semana_inicio + c.dia)::date AS data_visita
     FROM escala_visitas_celula c
     JOIN escala_visitas_semana s ON s.id_semana = c.id_semana
     LEFT JOIN usuarios u ON u.id_usuario = c.id_regional
     WHERE c.id_loja = $1
       AND c.id_regional IS NOT NULL
       AND ($3::int IS NULL OR c.id_regional = $3)
       AND (s.semana_inicio + c.dia)::date >= $2::date
     ORDER BY (s.semana_inicio + c.dia)::date ASC, c.id_celula
     LIMIT 1`,
    [idLoja, ref, idRegional],
  );
  return rows[0] || null;
}

/** Visitas agendadas na escala para hoje com NCs em aberto de auditoria time de campo. */
export async function visitasEscalaHojeComPendencias() {
  const { rows } = await pool.query(
    `SELECT c.id_celula, c.id_regional, c.id_loja, c.dia,
            s.semana_inicio,
            (s.semana_inicio + c.dia)::date AS data_visita_escala,
            ur.nome AS nome_regional_escala,
            v.id_visita, v.nota_final, v.data_visita AS data_auditoria,
            l.name AS nome_loja, l.bk_number,
            ua.nome AS nome_auditor,
            (SELECT COUNT(*)::int FROM nao_conformidades nc
             WHERE nc.id_visita = v.id_visita AND nc.status = 'Em aberto') AS ncs_abertas,
            (SELECT COUNT(*)::int FROM nao_conformidades nc WHERE nc.id_visita = v.id_visita) AS ncs_total
     FROM escala_visitas_celula c
     JOIN escala_visitas_semana s ON s.id_semana = c.id_semana
     JOIN lojas l ON l.id_loja = c.id_loja
     LEFT JOIN usuarios ur ON ur.id_usuario = c.id_regional
     JOIN LATERAL (
       SELECT vis.id_visita, vis.nota_final, vis.data_visita, vis.id_usuario
       FROM visitas vis
       JOIN tipos_checklist tc ON tc.id_tipo_checklist = vis.id_tipo_checklist
       WHERE vis.id_loja = c.id_loja
         AND vis.status = 'Finalizada'
         AND tc.codigo = 'auditoria_operacional'
         AND vis.nota_final IS NOT NULL
         AND vis.nota_final::numeric < 80
         AND EXISTS (
           SELECT 1 FROM nao_conformidades nc
           WHERE nc.id_visita = vis.id_visita AND nc.status = 'Em aberto'
         )
       ORDER BY vis.data_visita DESC, vis.id_visita DESC
       LIMIT 1
     ) v ON TRUE
     JOIN usuarios ua ON ua.id_usuario = v.id_usuario
     WHERE c.id_regional IS NOT NULL
       AND (s.semana_inicio + c.dia)::date = (timezone('America/Sao_Paulo', now()))::date`,
  );
  return rows;
}

export async function carregarUsuariosLideranca() {
  const emails = [
    LIDERANCA_EMAIL.ceo,
    LIDERANCA_EMAIL.diretor,
    ...REGIONAIS_SUPERVISORES_EMAIL,
  ];
  const { rows } = await pool.query(
    `SELECT id_usuario, nome, email, telefone_whatsapp, notifica_whatsapp, cargo_aprovacao
     FROM usuarios
     WHERE ativo = TRUE AND LOWER(email) = ANY($1::text[])`,
    [emails.map((e) => e.toLowerCase())],
  );
  return rows;
}

export async function carregarCeoEDiretor() {
  const usuarios = await carregarUsuariosLideranca();
  return usuarios.filter((u) => ['ceo', 'diretor'].includes(u.cargo_aprovacao));
}
