import { Router } from 'express';
import { pool } from '../db.js';
import { SQL_NC_CHECKLIST_FINALIZADO } from '../naoConformidadesChecklist.js';
import { listarSaudeLojas } from '../services/dashboardSaudeLojas.js';

const router = Router();

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function rotuloMes(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  return `${MESES_PT[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

/** YYYY-MM-DD em America/Sao_Paulo. */
function hojeBrasilia() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function dataRefFromQuery(req) {
  const raw = String(req.query.data || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return hojeBrasilia();
}

function idRegiaoFromQuery(req) {
  const n = Number(req.query.id_regiao);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function safeQuery(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (e) {
    console.warn('[dashboard] query opcional falhou:', e.message);
    return { rows: [] };
  }
}

/**
 * Monta filtro de região com o índice de parâmetro correto.
 * @param {'l'|'nc'|'h'|'r'} alias
 * @param {number} idx
 */
function filtroRegiao(alias, idx, temRegiao) {
  if (!temRegiao) return '';
  const col =
    alias === 'nc' || alias === 'h' || alias === 'r' || alias === 'l'
      ? `${alias}.id_loja`
      : 'l.id_loja';
  return `AND EXISTS (
    SELECT 1 FROM frota_regiao_lojas frl
    WHERE frl.id_loja = ${col} AND frl.id_regiao = $${idx}::int
  )`;
}

router.get('/', async (req, res, next) => {
  try {
    const dataRef = dataRefFromQuery(req);
    const idRegiao = idRegiaoFromQuery(req);
    const temRegiao = idRegiao != null;

    // Convenção:
    // - queries só região → $1 = id_regiao, params = pRegiao
    // - queries data (+ região opcional) → $1 = data, $2 = id_regiao, params = pAll
    const pRegiao = temRegiao ? [idRegiao] : [];
    const pAll = temRegiao ? [dataRef, idRegiao] : [dataRef];
    const idxRegiaoEmAll = 2;

    const mediaQ = await pool.query(
      `
      SELECT
        ROUND(AVG(r.nota_atual)::numeric, 1) AS media_geral,
        COUNT(*) FILTER (WHERE r.nota_atual < 75)::int AS lojas_abaixo_75,
        COUNT(*)::int AS lojas_ativas
      FROM vw_ranking_lojas r
      WHERE 1=1 ${filtroRegiao('r', 1, temRegiao)}
      `,
      pRegiao,
    );

    const visitasMesQ = await pool.query(
      `
      SELECT COUNT(*)::int AS visitas_mes
      FROM visitas v
      JOIN lojas l ON l.id_loja = v.id_loja
      WHERE v.status = 'Finalizada'
        AND v.data_visita >= date_trunc('month', $1::date)::date
        AND v.data_visita < (date_trunc('month', $1::date) + INTERVAL '1 month')::date
        ${filtroRegiao('l', idxRegiaoEmAll, temRegiao)}
      `,
      pAll,
    );

    const metricas = {
      media_geral: Number(mediaQ.rows[0]?.media_geral) || 0,
      lojas_abaixo_75: Number(mediaQ.rows[0]?.lojas_abaixo_75) || 0,
      lojas_ativas: Number(mediaQ.rows[0]?.lojas_ativas) || 0,
      visitas_mes: Number(visitasMesQ.rows[0]?.visitas_mes) || 0,
    };

    const ranking = await pool.query(
      `
      SELECT r.*
      FROM vw_ranking_lojas r
      WHERE 1=1 ${filtroRegiao('r', 1, temRegiao)}
      ORDER BY r.posicao_ranking
      LIMIT 5
      `,
      pRegiao,
    );

    const ncsRecentes = await pool.query(
      `
      SELECT nc.*, l.name
      FROM nao_conformidades nc
      JOIN lojas l ON l.id_loja = nc.id_loja
      ${SQL_NC_CHECKLIST_FINALIZADO}
      WHERE nc.status = 'Em aberto'
        ${filtroRegiao('nc', 1, temRegiao)}
      ORDER BY
        CASE nc.gravidade WHEN 'Crítica' THEN 1 WHEN 'Moderada' THEN 2 ELSE 3 END,
        nc.data_cadastro DESC
      LIMIT 5
      `,
      pRegiao,
    );

    const ncsGravidade = await pool.query(
      `
      SELECT nc.gravidade, COUNT(*)::int AS total
      FROM nao_conformidades nc
      ${SQL_NC_CHECKLIST_FINALIZADO}
      WHERE nc.status = 'Em aberto'
        ${filtroRegiao('nc', 1, temRegiao)}
      GROUP BY nc.gravidade
      ORDER BY CASE nc.gravidade WHEN 'Crítica' THEN 1 WHEN 'Moderada' THEN 2 ELSE 3 END
      `,
      pRegiao,
    );

    const ncsAbertas = ncsGravidade.rows.reduce((s, r) => s + r.total, 0);
    const ncsCriticas = ncsGravidade.rows.find((r) => r.gravidade === 'Crítica')?.total ?? 0;
    const ncsModeradas = ncsGravidade.rows.find((r) => r.gravidade === 'Moderada')?.total ?? 0;
    const ncsLeves =
      ncsGravidade.rows.find((r) => r.gravidade === 'Baixa' || r.gravidade === 'Leve')?.total ??
      Math.max(0, ncsAbertas - ncsCriticas - ncsModeradas);

    const ncsVencidasQ = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM nao_conformidades nc
      ${SQL_NC_CHECKLIST_FINALIZADO}
      WHERE nc.status = 'Em aberto'
        AND nc.prazo_resolucao IS NOT NULL
        AND nc.prazo_resolucao < $1::date
        ${filtroRegiao('nc', idxRegiaoEmAll, temRegiao)}
      `,
      pAll,
    );

    const ncsEmAndamentoQ = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM nao_conformidades nc
      ${SQL_NC_CHECKLIST_FINALIZADO}
      WHERE nc.status = 'Em andamento'
        ${filtroRegiao('nc', 1, temRegiao)}
      `,
      pRegiao,
    );

    const lojasSemVisitaQ = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM lojas l
      WHERE l.is_active = TRUE
        AND l.bk_number IS NOT NULL
        ${filtroRegiao('l', idxRegiaoEmAll, temRegiao)}
        AND NOT EXISTS (
          SELECT 1
          FROM visitas v
          WHERE v.id_loja = l.id_loja
            AND v.status = 'Finalizada'
            AND v.data_visita >= ($1::date - INTERVAL '30 days')
            AND v.data_visita <= $1::date
        )
      `,
      pAll,
    );

    const visitasPlanejadasQ = await safeQuery(
      `
      SELECT COUNT(*)::int AS total
      FROM escala_visitas_celula c
      JOIN escala_visitas_semana s ON s.id_semana = c.id_semana
      JOIN lojas l ON l.id_loja = c.id_loja
      WHERE (s.semana_inicio + c.dia) >= date_trunc('month', $1::date)::date
        AND (s.semana_inicio + c.dia) < (date_trunc('month', $1::date) + INTERVAL '1 month')::date
        ${filtroRegiao('l', idxRegiaoEmAll, temRegiao)}
      `,
      pAll,
    );

    const auditoriasHojeQ = await safeQuery(
      `
      SELECT COUNT(*)::int AS total
      FROM escala_visitas_celula c
      JOIN escala_visitas_semana s ON s.id_semana = c.id_semana
      JOIN lojas l ON l.id_loja = c.id_loja
      WHERE (s.semana_inicio + c.dia) = $1::date
        ${filtroRegiao('l', idxRegiaoEmAll, temRegiao)}
      `,
      pAll,
    );

    const evolucaoQ = await pool.query(
      `
      SELECT
        date_trunc('month', h.data_registro)::date AS mes,
        ROUND(AVG(h.nota)::numeric, 1) AS media
      FROM historico_notas h
      WHERE h.data_registro >= (date_trunc('month', $1::date) - INTERVAL '5 months')::date
        AND h.data_registro <= $1::date
        ${filtroRegiao('h', idxRegiaoEmAll, temRegiao)}
      GROUP BY 1
      ORDER BY 1
      `,
      pAll,
    );

    const sparklineQ = await pool.query(
      `
      SELECT
        date_trunc('week', h.data_registro)::date AS semana,
        ROUND(AVG(h.nota)::numeric, 1) AS media
      FROM historico_notas h
      WHERE h.data_registro >= ($1::date - INTERVAL '10 weeks')
        AND h.data_registro <= $1::date
        ${filtroRegiao('h', idxRegiaoEmAll, temRegiao)}
      GROUP BY 1
      ORDER BY 1
      `,
      pAll,
    );

    const mediaAtual = Number(metricas.media_geral) || 0;
    const evolucao = evolucaoQ.rows.map((r) => ({
      mes: r.mes,
      rotulo: rotuloMes(r.mes),
      media: Number(r.media) || 0,
    }));

    const mesAnterior = evolucao.length >= 2 ? evolucao[evolucao.length - 2]?.media : null;
    const mediaMesAtualSerie = evolucao.length ? evolucao[evolucao.length - 1]?.media : mediaAtual;
    const variacaoMes =
      mesAnterior != null && Number.isFinite(mesAnterior)
        ? Math.round((Number(mediaMesAtualSerie) - Number(mesAnterior)) * 10) / 10
        : null;

    const sparkline = sparklineQ.rows.map((r) => Number(r.media) || 0);

    res.json({
      filtros: {
        data: dataRef,
        id_regiao: idRegiao,
      },
      metricas: {
        media_geral: mediaAtual,
        visitas_mes: Number(metricas.visitas_mes) || 0,
        visitas_planejadas: Number(visitasPlanejadasQ.rows[0]?.total) || 0,
        total_ncs_abertas: ncsAbertas,
        ncs_criticas: ncsCriticas,
        ncs_moderadas: ncsModeradas,
        ncs_leves: ncsLeves,
        lojas_abaixo_75: Number(metricas.lojas_abaixo_75) || 0,
        lojas_ativas: Number(metricas.lojas_ativas) || 0,
        variacao_mes: variacaoMes,
        sparkline,
      },
      atencao: {
        ncs_criticas: ncsCriticas,
        ncs_vencidas: Number(ncsVencidasQ.rows[0]?.total) || 0,
        aguardando_verificacao: Number(ncsEmAndamentoQ.rows[0]?.total) || 0,
        lojas_sem_visita: Number(lojasSemVisitaQ.rows[0]?.total) || 0,
      },
      atividades: {
        auditorias_hoje: Number(auditoriasHojeQ.rows[0]?.total) || 0,
        ncs_criticas: ncsCriticas,
        lojas_abaixo_meta: Number(metricas.lojas_abaixo_75) || 0,
      },
      evolucao_performance: evolucao,
      ranking: ranking.rows,
      ncs_recentes: ncsRecentes.rows,
      ncs_por_gravidade: ncsGravidade.rows,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/ranking', async (req, res, next) => {
  try {
    const idRegiao = idRegiaoFromQuery(req);
    const temRegiao = idRegiao != null;
    const params = temRegiao ? [idRegiao] : [];
    const { rows } = await pool.query(
      `
      SELECT r.*,
        hn.nota AS nota_anterior
      FROM vw_ranking_lojas r
      LEFT JOIN LATERAL (
        SELECT nota FROM historico_notas h
        WHERE h.id_loja = r.id_loja
        ORDER BY data_registro DESC
        OFFSET 1 LIMIT 1
      ) hn ON TRUE
      WHERE 1=1 ${filtroRegiao('r', 1, temRegiao)}
      ORDER BY r.posicao_ranking
      `,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** Ficha por loja: nota + NCs + chamados + CMV do mês (priorizado). */
router.get('/saude-lojas', async (req, res, next) => {
  try {
    const data = await listarSaudeLojas(req.query || {});
    res.json(data);
  } catch (e) {
    next(e);
  }
});

export default router;
