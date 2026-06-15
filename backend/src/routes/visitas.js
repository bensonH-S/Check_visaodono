import { Router } from 'express';
import { pool } from '../db.js';
import {
  persistirFotos,
  midiaUrlsResposta,
  decryptMidiaResposta,
  countMidiaResposta,
} from '../fotos.js';
import { filtroSqlLojas, usuarioPodeLoja } from '../lojasUsuario.js';

const router = Router();

/** Garante data_visita como YYYY-MM-DD (evita ISO UTC no JSON). */
function dataVisitaIso(val) {
  if (val == null) return val;
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

function serializarVisita(row) {
  if (!row) return row;
  return { ...row, data_visita: dataVisitaIso(row.data_visita) };
}

router.get('/:idVisita/respostas/:idPergunta/media/:indice', async (req, res, next) => {
  try {
    const idVisita = Number(req.params.idVisita);
    const idPergunta = Number(req.params.idPergunta);
    const indice = Number(req.params.indice);

    const visita = await pool.query('SELECT id_loja FROM visitas WHERE id_visita = $1', [idVisita]);
    if (!visita.rows[0]) return res.status(404).json({ error: 'Visita não encontrada' });
    if (!usuarioPodeLoja(req.user, visita.rows[0].id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { rows } = await pool.query(
      `SELECT foto_url FROM respostas WHERE id_visita = $1 AND id_pergunta = $2`,
      [idVisita, idPergunta],
    );
    if (!rows[0]?.foto_url) return res.status(404).json({ error: 'Mídia não encontrada' });
    if (indice < 0 || indice >= countMidiaResposta(rows[0].foto_url)) {
      return res.status(404).json({ error: 'Mídia não encontrada' });
    }

    const { buffer, mime } = decryptMidiaResposta(rows[0].foto_url, indice);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (e) {
    next(e);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { loja, status } = req.query;
    let q = `
      SELECT v.*, l.name, l.bk_number, u.nome AS nome_usuario,
        (SELECT COUNT(*)::int FROM nao_conformidades nc
         WHERE nc.id_visita = v.id_visita AND nc.status = 'Em aberto') AS nc_abertas
      FROM visitas v
      JOIN lojas l ON l.id_loja = v.id_loja
      JOIN usuarios u ON u.id_usuario = v.id_usuario
      WHERE 1=1
    `;
    const params = [];
    if (loja) {
      params.push(loja);
      q += ` AND v.id_loja = $${params.length}`;
    }
    if (status) {
      params.push(status);
      q += ` AND v.status = $${params.length}::status_visita`;
    }
    q += filtroSqlLojas(req.user, 'v', 'id_loja', params);
    q += ' ORDER BY v.data_visita DESC, v.id_visita DESC';
    const { rows } = await pool.query(q, params);
    res.json(rows.map(serializarVisita));
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const visita = await pool.query(
      `SELECT v.*, l.name, l.bk_number, l.city, l.neighborhood, u.nome AS nome_usuario
       FROM visitas v
       JOIN lojas l ON l.id_loja = v.id_loja
       JOIN usuarios u ON u.id_usuario = v.id_usuario
       WHERE v.id_visita = $1`,
      [req.params.id]
    );
    if (!visita.rows[0]) return res.status(404).json({ error: 'Visita não encontrada' });

    const respostas = await pool.query(
      `SELECT r.*, p.codigo, p.texto, p.tipo_resposta, p.id_categoria, c.nome AS categoria
       FROM respostas r
       JOIN perguntas p ON p.id_pergunta = r.id_pergunta
       JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
       WHERE r.id_visita = $1
       ORDER BY c.ordem, p.ordem`,
      [req.params.id]
    );

    const porCategoria = await pool.query(
      `SELECT c.nome AS categoria,
        ROUND(AVG(
          CASE
            WHEN p.tipo_resposta IN ('estrelas', 'estrelas_foto') AND r.nota_estrelas IS NOT NULL
              THEN (r.nota_estrelas::numeric / 5.0) * 100
            WHEN r.resposta = 'Sim' THEN 100
            WHEN r.resposta = 'Não' THEN 0
            WHEN r.resposta = 'N/A' THEN 50
            ELSE NULL
          END * p.peso
        )::numeric, 0) AS percentual
       FROM respostas r
       JOIN perguntas p ON p.id_pergunta = r.id_pergunta
       JOIN categorias_checklist c ON c.id_categoria = p.id_categoria
       WHERE r.id_visita = $1
       GROUP BY c.id_categoria, c.nome, c.ordem
       ORDER BY c.ordem`,
      [req.params.id]
    );

    const ncs = await pool.query(
      `SELECT * FROM nao_conformidades WHERE id_visita = $1 ORDER BY data_cadastro DESC`,
      [req.params.id]
    );

    const historico = await pool.query(
      `SELECT nota, data_registro FROM historico_notas
       WHERE id_loja = $1 ORDER BY data_registro DESC LIMIT 2`,
      [visita.rows[0].id_loja]
    );

    const respostasPublicas = respostas.rows.map((r) => ({
      ...r,
      foto_url: undefined,
      midia_urls: midiaUrlsResposta(req.params.id, r.id_pergunta, r.foto_url),
      total_midias: countMidiaResposta(r.foto_url),
    }));

    res.json({
      visita: serializarVisita(visita.rows[0]),
      respostas: respostasPublicas,
      desempenho_categorias: porCategoria.rows,
      nao_conformidades: ncs.rows,
      historico_notas: historico.rows,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  const { id_loja, id_usuario, data_visita, hora_inicio } = req.body;
  if (!id_loja || !id_usuario) {
    return res.status(400).json({ error: 'Loja e auditor são obrigatórios' });
  }
  if (!usuarioPodeLoja(req.user, id_loja)) {
    return res.status(403).json({ error: 'Loja não vinculada ao seu usuário' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO visitas (id_loja, id_usuario, data_visita, hora_inicio, status)
       VALUES ($1, $2, COALESCE($3::date, (timezone('America/Sao_Paulo', now()))::date),
         COALESCE($4, (timezone('America/Sao_Paulo', now()))::time), 'Rascunho')
       RETURNING *`,
      [Number(id_loja), Number(id_usuario), data_visita ?? null, hora_inicio ?? null]
    );
    await client.query('COMMIT');
    res.status(201).json(serializarVisita(rows[0]));
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* conexão já fechada */
    }
    console.error('[visitas POST]', e.message);
    res.status(500).json({ error: e.message || 'Erro ao criar visita' });
  } finally {
    client.release();
  }
});

function normalizarResposta(r) {
  const resp = r.resposta;
  if (resp === 'Sim' || resp === 'Não' || resp === 'N/A') return resp;
  return null;
}

router.post('/:id/respostas', async (req, res, next) => {
  try {
    const { respostas } = req.body;
    if (!Array.isArray(respostas) || !respostas.length) {
      return res.status(400).json({ error: 'Lista de respostas obrigatória' });
    }
    const idVisita = Number(req.params.id);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of respostas) {
        const resposta = normalizarResposta(r);
        const nota =
          r.nota_estrelas != null && r.nota_estrelas !== ''
            ? Number(r.nota_estrelas)
            : null;
        const notaValida = nota != null && !Number.isNaN(nota) && nota >= 1 && nota <= 5;
        if (!resposta && !notaValida && !r.foto_url) {
          continue;
        }
        const fotoSalva = await persistirFotos(idVisita, r.id_pergunta, r.foto_url ?? null);
        await client.query(
          `INSERT INTO respostas (id_visita, id_pergunta, resposta, nota_estrelas, observacao, foto_url)
           VALUES ($1, $2, $3::resposta_checklist, $4, $5, $6)
           ON CONFLICT (id_visita, id_pergunta)
           DO UPDATE SET
             resposta = COALESCE(EXCLUDED.resposta, respostas.resposta),
             nota_estrelas = COALESCE(EXCLUDED.nota_estrelas, respostas.nota_estrelas),
             observacao = EXCLUDED.observacao,
             foto_url = EXCLUDED.foto_url`,
          [
            idVisita,
            r.id_pergunta,
            resposta,
            notaValida ? nota : null,
            r.observacao ?? null,
            fotoSalva,
          ]
        );
      }
      await client.query('COMMIT');
      const detail = await pool.query('SELECT * FROM visitas WHERE id_visita = $1', [idVisita]);
      res.json(serializarVisita(detail.rows[0]));
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('[respostas]', e.message);
      res.status(500).json({ error: e.message || 'Erro ao salvar respostas' });
      return;
    } finally {
      client.release();
    }
  } catch (e) {
    next(e);
  }
});

router.patch('/:id/finalizar', async (req, res, next) => {
  try {
    const { hora_fim, duracao_minutos, observacoes_gerais } = req.body;
    const { rows } = await pool.query(
      `UPDATE visitas SET
         status = 'Finalizada',
         hora_fim = COALESCE($2, hora_fim),
         duracao_minutos = COALESCE($3, duracao_minutos),
         observacoes_gerais = COALESCE($4, observacoes_gerais),
         updated_at = NOW()
       WHERE id_visita = $1
       RETURNING *`,
      [req.params.id, hora_fim, duracao_minutos, observacoes_gerais]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Visita não encontrada' });
    res.json(serializarVisita(rows[0]));
  } catch (e) {
    next(e);
  }
});

export default router;
