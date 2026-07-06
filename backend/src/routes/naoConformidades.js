import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requirePermissao } from '../permissoes.js';
import { filtroSqlLojas, usuarioPodeLoja } from '../lojasUsuario.js';
import {
  encryptAnexo,
  decryptAnexo,
  midiaPermitida,
} from '../fotos.js';
import { SQL_NC_CHECKLIST_FINALIZADO } from '../naoConformidadesChecklist.js';

const router = Router();
const APP_BASE_PATH = '/auditoria';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function midiaUrlNcAnexo(idAnexo) {
  return `${APP_BASE_PATH}/api/nao-conformidades/anexos/${idAnexo}/media`;
}

async function carregarNc(idNc) {
  const { rows } = await pool.query(
    `SELECT nc.*, l.name AS nome_loja, v.data_visita, v.nota_final, v.status AS status_visita
     FROM nao_conformidades nc
     JOIN lojas l ON l.id_loja = nc.id_loja
     LEFT JOIN visitas v ON v.id_visita = nc.id_visita
     WHERE nc.id_nc = $1`,
    [idNc],
  );
  return rows[0] || null;
}

router.get(
  '/anexos/:idAnexo/media',
  requirePermissao('ncs.ver', 'ncs.resolver', 'portal.dashboard.ver'),
  async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT a.arquivo_url, a.tipo_mime, nc.id_loja
         FROM nc_anexos a
         JOIN nao_conformidades nc ON nc.id_nc = a.id_nc
         WHERE a.id_anexo = $1`,
        [req.params.idAnexo],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Mídia não encontrada' });
      if (!usuarioPodeLoja(req.user, rows[0].id_loja)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      const { buffer, mime } = decryptAnexo(rows[0].arquivo_url);
      res.setHeader('Content-Type', rows[0].tipo_mime || mime);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/',
  requirePermissao('ncs.ver', 'ncs.resolver', 'portal.dashboard.ver'),
  async (req, res, next) => {
    try {
      const { status, loja } = req.query;
      let q = `
      SELECT nc.*, l.name, v.data_visita, v.nota_final,
             u.nome AS nome_resolvido_por
      FROM nao_conformidades nc
      JOIN lojas l ON l.id_loja = nc.id_loja
      ${SQL_NC_CHECKLIST_FINALIZADO}
      LEFT JOIN usuarios u ON u.id_usuario = nc.id_usuario_resolucao
      WHERE 1=1
    `;
      const params = [];
      if (status) {
        params.push(status);
        q += ` AND nc.status = $${params.length}::status_nc`;
      }
      if (loja) {
        params.push(loja);
        q += ` AND nc.id_loja = $${params.length}`;
      }
      q += filtroSqlLojas(req.user, 'nc', 'id_loja', params);
      q += ' ORDER BY v.data_visita DESC, nc.id_nc DESC';
      const { rows } = await pool.query(q, params);

      const statsParams = [];
      let statsQ = `
      SELECT
        COUNT(*) FILTER (WHERE nc.status = 'Em aberto') AS total_aberto,
        COUNT(*) FILTER (WHERE nc.status = 'Em aberto' AND nc.gravidade = 'Crítica') AS criticas,
        COUNT(DISTINCT nc.id_visita) FILTER (WHERE nc.status = 'Em aberto') AS visitas_pendentes
      FROM nao_conformidades nc
      ${SQL_NC_CHECKLIST_FINALIZADO}
      WHERE 1=1
    `;
      statsQ += filtroSqlLojas(req.user, 'nc', 'id_loja', statsParams);
      const stats = await pool.query(statsQ, statsParams);

      res.json({ items: rows, stats: stats.rows[0] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  '/:id',
  requirePermissao('ncs.ver', 'ncs.resolver', 'portal.dashboard.ver'),
  async (req, res, next) => {
    try {
      const nc = await carregarNc(req.params.id);
      if (!nc) return res.status(404).json({ error: 'NC não encontrada' });
      if (!usuarioPodeLoja(req.user, nc.id_loja)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      if (nc.status_visita && nc.status_visita !== 'Finalizada') {
        return res.status(404).json({ error: 'NC de checklist não finalizado' });
      }

      const anexos = await pool.query(
        `SELECT id_anexo, tipo_mime, created_at
         FROM nc_anexos WHERE id_nc = $1 ORDER BY created_at ASC`,
        [nc.id_nc],
      );

      res.json({
        ...nc,
        anexos: anexos.rows.map((a) => ({
          ...a,
          media_url: midiaUrlNcAnexo(a.id_anexo),
        })),
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  '/:id/resolver',
  requirePermissao('ncs.resolver', 'portal.dashboard.ver'),
  upload.array('fotos', 5),
  async (req, res, next) => {
    try {
      const idNc = Number(req.params.id);
      const observacao = String(req.body.observacao_resolucao || req.body.observacao || '').trim();
      const files = req.files || [];

      if (!observacao || observacao.length < 10) {
        return res.status(400).json({ error: 'Descreva o que foi feito (mínimo 10 caracteres).' });
      }
      if (!files.length) {
        return res.status(400).json({ error: 'Envie pelo menos uma foto da correção.' });
      }

      const nc = await carregarNc(idNc);
      if (!nc) return res.status(404).json({ error: 'NC não encontrada' });
      if (!usuarioPodeLoja(req.user, nc.id_loja)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      if (nc.status === 'Resolvida') {
        return res.status(400).json({ error: 'Esta não conformidade já foi resolvida.' });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        for (const file of files) {
          if (!midiaPermitida(file.mimetype) || !file.mimetype.startsWith('image/')) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Envie apenas imagens (foto da correção).' });
          }
          const criptografado = encryptAnexo(file.buffer);
          await client.query(
            `INSERT INTO nc_anexos (id_nc, id_usuario, nome_arquivo, arquivo_url, tipo_mime)
             VALUES ($1, $2, $3, $4, $5)`,
            [idNc, req.user.sub, file.originalname || 'foto.jpg', criptografado, file.mimetype],
          );
        }

        const { rows } = await client.query(
          `UPDATE nao_conformidades SET
             status = 'Resolvida',
             observacao_resolucao = $2,
             data_resolucao = NOW(),
             id_usuario_resolucao = $3
           WHERE id_nc = $1
           RETURNING *`,
          [idNc, observacao, req.user.sub],
        );

        await client.query('COMMIT');

        const anexos = await pool.query(
          `SELECT id_anexo, tipo_mime FROM nc_anexos WHERE id_nc = $1 ORDER BY created_at ASC`,
          [idNc],
        );

        res.json({
          ...rows[0],
          nome_loja: nc.nome_loja,
          anexos: anexos.rows.map((a) => ({
            ...a,
            media_url: midiaUrlNcAnexo(a.id_anexo),
          })),
        });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (e) {
      next(e);
    }
  },
);

router.post('/', requirePermissao('portal.dashboard.ver'), async (req, res, next) => {
  try {
    const {
      id_loja,
      id_visita,
      area,
      descricao,
      gravidade,
      prazo_resolucao,
      responsavel,
    } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO nao_conformidades
        (id_loja, id_visita, area, descricao, gravidade, prazo_resolucao, responsavel)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'Moderada')::gravidade_nc, $6, $7)
       RETURNING *`,
      [id_loja, id_visita, area, descricao, gravidade, prazo_resolucao, responsavel],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requirePermissao('portal.dashboard.ver', 'ncs.resolver'), async (req, res, next) => {
  try {
    const nc = await carregarNc(req.params.id);
    if (!nc) return res.status(404).json({ error: 'NC não encontrada' });
    if (!usuarioPodeLoja(req.user, nc.id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { status, gravidade, responsavel, prazo_resolucao } = req.body;
    const { rows } = await pool.query(
      `UPDATE nao_conformidades SET
         status = COALESCE($2::status_nc, status),
         gravidade = COALESCE($3::gravidade_nc, gravidade),
         responsavel = COALESCE($4, responsavel),
         prazo_resolucao = COALESCE($5, prazo_resolucao)
       WHERE id_nc = $1 RETURNING *`,
      [req.params.id, status, gravidade, responsavel, prazo_resolucao],
    );
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
