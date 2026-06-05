/**
 * Chamados de manutenção — vision_check (manut_* + lojas/usuarios)
 */
import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { uploadsRoot } from '../fotos.js';
import { authMiddleware } from '../auth.js';
import { requirePermissao, attachPermissoesUsuario } from '../permissoes.js';
import { attachLojasUsuario, filtroSqlLojas, usuarioPodeLoja } from '../lojasUsuario.js';

const router = Router();

router.use(authMiddleware, attachPermissoesUsuario, attachLojasUsuario);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
});

const APP_BASE = '/auditoria';

function prefixoUploads() {
  return `${APP_BASE}/api/uploads`.replace(/\/+/g, '/');
}

function calcularPrazoSla(abertoEm, slaHoras) {
  return new Date(abertoEm.getTime() + slaHoras * 60 * 60 * 1000);
}

router.get('/formulario', requirePermissao('chamados.abrir', 'chamados.ver'), async (req, res, next) => {
  try {
    const params = [];
    const lojaFiltro = filtroSqlLojas(req.user, null, 'id_loja', params);

    const [cats, lojas] = await Promise.all([
      pool.query(
        `SELECT id_categoria, nome, sla_horas, urgencia_padrao::text AS urgencia_padrao
         FROM manut_categorias WHERE ativo = TRUE ORDER BY nome`,
      ),
      pool.query(
        `SELECT id_loja, name AS nome, bk_number AS codigo_bkn
         FROM lojas WHERE is_active = TRUE ${lojaFiltro} ORDER BY name`,
        params,
      ),
    ]);
    res.json({ categorias: cats.rows, lojas: lojas.rows });
  } catch (e) {
    next(e);
  }
});

router.get('/chamados', requirePermissao('chamados.ver'), async (req, res, next) => {
  try {
    const params = [];
    const filtro = filtroSqlLojas(req.user, 'c', 'id_loja', params);

    const { rows } = await pool.query(
      `SELECT c.id_chamado, c.numero, c.titulo, c.status::text AS status,
              c.urgencia::text AS urgencia, c.prazo_sla, c.aberto_em,
              cat.nome AS categoria,
              l.name AS loja,
              (SELECT COUNT(*)::int FROM manut_anexos a WHERE a.id_chamado = c.id_chamado) AS total_fotos
       FROM manut_chamados c
       JOIN manut_categorias cat ON cat.id_categoria = c.id_categoria
       JOIN lojas l ON l.id_loja = c.id_loja
       WHERE 1=1 ${filtro}
       ORDER BY
         CASE c.urgencia::text
           WHEN 'critica' THEN 4 WHEN 'alta' THEN 3 WHEN 'media' THEN 2 ELSE 1
         END DESC,
         c.prazo_sla ASC`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/chamados', requirePermissao('chamados.abrir'), async (req, res, next) => {
  try {
    const { titulo, descricao, id_categoria, id_loja, local_detalhe, urgencia } = req.body;

    if (!titulo || !descricao || !id_categoria || !id_loja) {
      return res.status(400).json({ error: 'Campos obrigatórios incompletos' });
    }
    if (!usuarioPodeLoja(req.user, id_loja)) {
      return res.status(403).json({ error: 'Loja não vinculada ao seu usuário' });
    }

    const { rows: catRows } = await pool.query(
      `SELECT sla_horas, urgencia_padrao::text AS urgencia_padrao
       FROM manut_categorias WHERE id_categoria = $1 AND ativo`,
      [id_categoria],
    );
    if (!catRows.length) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    const cat = catRows[0];
    const abertoEm = new Date();
    const urg = urgencia || cat.urgencia_padrao;
    const prazoSla = calcularPrazoSla(abertoEm, cat.sla_horas);

    const { rows } = await pool.query(
      `INSERT INTO manut_chamados (
        titulo, descricao, urgencia, id_categoria, id_loja, id_solicitante,
        local_detalhe, aberto_em, prazo_sla
      ) VALUES ($1,$2,$3::manut_urgencia,$4,$5,$6,$7,$8,$9)
      RETURNING id_chamado, numero`,
      [
        titulo,
        descricao,
        urg,
        id_categoria,
        id_loja,
        req.user.sub,
        local_detalhe || null,
        abertoEm,
        prazoSla,
      ],
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post('/chamados/:id/fotos', upload.array('fotos', 10), async (req, res, next) => {
  try {
    const idChamado = Number(req.params.id);
    const idUsuario = req.user.sub;
    const files = req.files || [];

    if (!files.length) {
      return res.status(400).json({ error: 'Envie pelo menos uma foto' });
    }

    const dir = path.join(uploadsRoot(), `manut-chamado-${idChamado}`);
    fs.mkdirSync(dir, { recursive: true });

    const anexos = [];
    for (const file of files) {
      const ext = path.extname(file.originalname) || '.jpg';
      const nome = `${randomUUID()}${ext}`;
      fs.writeFileSync(path.join(dir, nome), file.buffer);
      const url = `${prefixoUploads()}/manut-chamado-${idChamado}/${nome}`;
      const { rows } = await pool.query(
        `INSERT INTO manut_anexos (id_chamado, id_usuario, nome_arquivo, arquivo_url, tipo_mime)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id_anexo, arquivo_url`,
        [idChamado, idUsuario, file.originalname || nome, url, file.mimetype],
      );
      anexos.push(rows[0]);
    }
    res.status(201).json(anexos);
  } catch (e) {
    next(e);
  }
});

router.patch('/chamados/:id/assumir', requirePermissao('chamados.assumir'), async (req, res, next) => {
  try {
    const idChamado = Number(req.params.id);
    const idTecnico = req.body.id_tecnico ?? req.user.sub;

    const chamado = await pool.query('SELECT id_loja FROM manut_chamados WHERE id_chamado = $1', [idChamado]);
    if (!chamado.rows[0]) return res.status(404).json({ error: 'Chamado não encontrado' });
    if (!usuarioPodeLoja(req.user, chamado.rows[0].id_loja)) {
      return res.status(403).json({ error: 'Chamado fora das lojas do seu usuário' });
    }

    const { rows } = await pool.query(
      `UPDATE manut_chamados
       SET id_tecnico = $1, status = 'em_atendimento', updated_at = NOW()
       WHERE id_chamado = $2
       RETURNING id_chamado, status::text AS status`,
      [idTecnico, idChamado],
    );
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

export default router;
