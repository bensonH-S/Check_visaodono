import { Router } from 'express';
import {
  carregarMetasPeriodo,
  listarPeriodosMetas,
  podeVerMetas,
  salvarPremioMetas,
  salvarRankingMetas,
  salvarRealizadoMetas,
} from '../metas.js';
import { auditar } from '../auditoriaHelpers.js';
import { pool } from '../db.js';

const router = Router();

async function contextoRealizado({ id_painel, id_indicador, id_loja, id_periodo }) {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(per.titulo, LPAD(per.mes::text, 2, '0') || '/' || per.ano::text) AS periodo,
       per.id_periodo,
       COALESCE(i.nome, i.codigo, 'indicador #' || $2::text) AS indicador,
       COALESCE(l.name, 'loja #' || NULLIF($3::text, ''), 'sem loja') AS loja,
       l.bk_number
     FROM metas_paineis painel
     JOIN metas_periodos per ON per.id_periodo = painel.id_periodo
     LEFT JOIN metas_indicadores i ON i.id_indicador = $2
     LEFT JOIN lojas l ON l.id_loja = $3
     WHERE painel.id_painel = $1
     LIMIT 1`,
    [id_painel, id_indicador || null, id_loja || null],
  );
  if (rows[0]) return rows[0];
  if (id_periodo) {
    const { rows: per } = await pool.query(
      `SELECT COALESCE(titulo, LPAD(mes::text, 2, '0') || '/' || ano::text) AS periodo, id_periodo
       FROM metas_periodos WHERE id_periodo = $1`,
      [id_periodo],
    );
    return per[0] || null;
  }
  return null;
}

async function contextoRanking(id_ranking) {
  const { rows } = await pool.query(
    `SELECT
       r.id_ranking, r.id_periodo, r.ordem_linha,
       COALESCE(i.nome, i.codigo, 'ranking') AS indicador,
       COALESCE(per.titulo, LPAD(per.mes::text, 2, '0') || '/' || per.ano::text) AS periodo,
       COALESCE(l.name, r.nome_loja_planilha, r.nome_gestor, u.nome, 'linha #' || COALESCE(r.ordem_linha::text, r.id_ranking::text)) AS alvo,
       l.bk_number
     FROM metas_rankings r
     JOIN metas_periodos per ON per.id_periodo = r.id_periodo
     LEFT JOIN metas_indicadores i ON i.id_indicador = r.id_indicador
     LEFT JOIN lojas l ON l.id_loja = r.id_loja
     LEFT JOIN usuarios u ON u.id_usuario = r.id_gestor
     WHERE r.id_ranking = $1
     LIMIT 1`,
    [id_ranking],
  );
  return rows[0] || null;
}

async function contextoPremio(id_premio) {
  const { rows } = await pool.query(
    `SELECT
       p.id_premio, p.nome, p.id_periodo,
       COALESCE(per.titulo, LPAD(per.mes::text, 2, '0') || '/' || per.ano::text) AS periodo
     FROM metas_premios p
     JOIN metas_periodos per ON per.id_periodo = p.id_periodo
     WHERE p.id_premio = $1
     LIMIT 1`,
    [id_premio],
  );
  return rows[0] || null;
}

router.get('/periodos', async (req, res, next) => {
  try {
    if (!podeVerMetas(req.user)) {
      return res.status(403).json({ error: 'Sem permissão para ver metas' });
    }
    const periodos = await listarPeriodosMetas();
    res.json(periodos);
  } catch (e) {
    next(e);
  }
});

router.get('/periodos/:id', async (req, res, next) => {
  try {
    const data = await carregarMetasPeriodo(Number(req.params.id), req.user);
    res.json(data);
  } catch (e) {
    if (e.message.includes('Sem permissão') || e.message.includes('não encontrado')) {
      return res.status(e.message.includes('Sem permissão') ? 403 : 404).json({ error: e.message });
    }
    next(e);
  }
});

router.put('/realizados', async (req, res, next) => {
  try {
    const body = req.body || {};
    const row = await salvarRealizadoMetas(req.user, body);
    const ctx = await contextoRealizado({
      id_painel: body.id_painel ?? row?.id_painel,
      id_indicador: body.id_indicador ?? row?.id_indicador,
      id_loja: body.id_loja ?? row?.id_loja,
      id_periodo: row?.id_periodo,
    });
    const valor =
      body.valor_texto != null && String(body.valor_texto).trim() !== ''
        ? String(body.valor_texto).trim()
        : body.valor_numero != null
          ? String(body.valor_numero)
          : row?.valor_texto || row?.valor_numero || null;
    const periodo = ctx?.periodo || 'período';
    const indicador = ctx?.indicador || 'indicador';
    const loja = ctx?.loja || 'loja';
    await auditar(req, {
      modulo: 'metas',
      acao: 'salvar_realizado',
      entidade: 'meta_realizado',
      idReferencia: ctx?.id_periodo ?? row?.id_periodo ?? null,
      descricao: `Alterou realizado de metas — ${indicador} na loja ${loja} (${periodo})${valor != null ? `: ${valor}` : ''}`,
      detalhes: {
        id_periodo: ctx?.id_periodo ?? row?.id_periodo ?? null,
        periodo,
        indicador,
        loja,
        bk_number: ctx?.bk_number ?? null,
        valor,
        id_painel: body.id_painel ?? null,
        id_indicador: body.id_indicador ?? null,
        id_loja: body.id_loja ?? null,
      },
    });
    res.json(row);
  } catch (e) {
    if (e.message.includes('Sem permissão')) {
      return res.status(403).json({ error: e.message });
    }
    next(e);
  }
});

router.put('/rankings', async (req, res, next) => {
  try {
    const body = req.body || {};
    const row = await salvarRankingMetas(req.user, body);
    const ctx = await contextoRanking(body.id_ranking ?? row?.id_ranking);
    const periodo = ctx?.periodo || 'período';
    const alvo = ctx?.alvo || `ranking #${body.id_ranking || '?'}`;
    const indicador = ctx?.indicador ? `${ctx.indicador} · ` : '';
    const valor =
      body.valor_texto != null && String(body.valor_texto).trim() !== ''
        ? String(body.valor_texto).trim()
        : body.valor_numero != null
          ? String(body.valor_numero)
          : body.pontos != null
            ? `${body.pontos} pts`
            : null;
    await auditar(req, {
      modulo: 'metas',
      acao: 'salvar_ranking',
      entidade: 'meta_ranking',
      idReferencia: ctx?.id_periodo ?? null,
      descricao: `Alterou ranking de metas — ${indicador}${alvo} (${periodo})${valor != null ? `: ${valor}` : ''}`,
      detalhes: {
        id_periodo: ctx?.id_periodo ?? null,
        periodo,
        indicador: ctx?.indicador ?? null,
        alvo,
        id_ranking: body.id_ranking ?? null,
        valor,
        destaque: body.destaque ?? null,
      },
    });
    res.json(row);
  } catch (e) {
    if (e.message.includes('Sem permissão') || e.message.includes('não encontrado')) {
      return res.status(e.message.includes('Sem permissão') ? 403 : 404).json({ error: e.message });
    }
    next(e);
  }
});

router.put('/premios', async (req, res, next) => {
  try {
    const body = req.body || {};
    const row = await salvarPremioMetas(req.user, body);
    const ctx = await contextoPremio(body.id_premio ?? row?.id_premio);
    const periodo = ctx?.periodo || 'período';
    const nome = ctx?.nome || row?.nome || `prêmio #${body.id_premio || '?'}`;
    const partes = [];
    if (body.premio_saude != null) partes.push(`Saúde=${body.premio_saude}`);
    if (body.premio_rev != null) partes.push(`R.E.V.=${body.premio_rev}`);
    await auditar(req, {
      modulo: 'metas',
      acao: 'salvar_premio',
      entidade: 'meta_premio',
      idReferencia: ctx?.id_periodo ?? null,
      descricao: `Alterou prêmio de metas — ${nome} (${periodo})${partes.length ? `: ${partes.join(', ')}` : ''}`,
      detalhes: {
        id_periodo: ctx?.id_periodo ?? null,
        periodo,
        nome,
        id_premio: body.id_premio ?? null,
        premio_saude: body.premio_saude ?? null,
        premio_rev: body.premio_rev ?? null,
      },
    });
    res.json(row);
  } catch (e) {
    if (e.message.includes('Sem permissão') || e.message.includes('não encontrado')) {
      return res.status(e.message.includes('Sem permissão') ? 403 : 404).json({ error: e.message });
    }
    next(e);
  }
});

export default router;
