import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { temPermissao } from '../permissoes.js';
import { filtroSqlLojas, usuarioPodeLoja } from '../lojasUsuario.js';
import { encryptAnexo, decryptAnexo, midiaPermitida } from '../fotos.js';

const router = Router();
const APP_BASE_PATH = '/auditoria';

function ehGestorLojaEnergia(user) {
  const cargo = String(user?.cargo_aprovacao || user?.perfil || '').toLowerCase();
  return cargo === 'gerente' || cargo === 'coordenador';
}

function requireAcessoEnergia(abrir = false) {
  return (req, res, next) => {
    if (temPermissao(req.user, 'energia.abrir')) return next();
    if (!abrir && temPermissao(req.user, 'energia.ver')) return next();
    if (ehGestorLojaEnergia(req.user)) return next();
    return res.status(403).json({ error: 'Sem permissão para esta ação' });
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const STATUS_VALIDOS = new Set(['aberto', 'em_andamento', 'finalizado', 'cancelado']);
const STATUS_ABERTOS = new Set(['aberto', 'em_andamento']);
const TIPOS_OCORRENCIA = new Set([
  'falta_energia',
  'oscilacao',
  'surto',
  'equipamento_queimado',
  'outro',
]);

const SQL_LISTA = `
  SELECT c.id_chamado, c.numero, c.id_loja, c.protocolo, c.concessionaria,
         c.tipo_ocorrencia, c.descricao, c.status::text AS status,
         c.ocorrido_em, c.finalizado_em, c.observacao_final,
         c.created_at, c.updated_at,
         l.name AS nome_loja, l.bk_number,
         ua.nome AS nome_abriu,
         uf.nome AS nome_finalizou,
         (SELECT COUNT(*)::int FROM energia_anexos a WHERE a.id_chamado = c.id_chamado) AS qtd_fotos
  FROM energia_chamados c
  JOIN lojas l ON l.id_loja = c.id_loja
  JOIN usuarios ua ON ua.id_usuario = c.id_usuario_abriu
  LEFT JOIN usuarios uf ON uf.id_usuario = c.id_usuario_finalizou
`;

function midiaUrlEnergiaAnexo(idAnexo) {
  return `${APP_BASE_PATH}/api/energia/anexos/${idAnexo}/media`;
}

function normalizarTexto(v, max) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.slice(0, max);
}

function parseOcorridoEm(raw) {
  if (raw == null || raw === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

async function carregarChamado(idChamado) {
  const { rows } = await pool.query(`${SQL_LISTA} WHERE c.id_chamado = $1`, [idChamado]);
  return rows[0] || null;
}

async function anexosDoChamado(idChamado) {
  const { rows } = await pool.query(
    `SELECT id_anexo, tipo_mime, nome_arquivo, created_at
     FROM energia_anexos WHERE id_chamado = $1 ORDER BY created_at ASC, id_anexo ASC`,
    [idChamado],
  );
  return rows.map((a) => ({
    ...a,
    media_url: midiaUrlEnergiaAnexo(a.id_anexo),
  }));
}

function detalheJson(chamado, anexos) {
  return { ...chamado, anexos };
}

router.get(
  '/anexos/:idAnexo/media',
  requireAcessoEnergia(false),
  async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT a.arquivo_url, a.tipo_mime, c.id_loja
         FROM energia_anexos a
         JOIN energia_chamados c ON c.id_chamado = a.id_chamado
         WHERE a.id_anexo = $1`,
        [req.params.idAnexo],
      );
      if (!rows[0]) return res.status(404).json({ error: 'Mídia não encontrada' });
      if (!usuarioPodeLoja(req.user, rows[0].id_loja)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      const buffer = decryptAnexo(rows[0].arquivo_url);
      res.setHeader('Content-Type', rows[0].tipo_mime || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(buffer);
    } catch (e) {
      next(e);
    }
  },
);

router.get('/', requireAcessoEnergia(false), async (req, res, next) => {
  try {
    const { status, loja } = req.query;
    let q = `${SQL_LISTA} WHERE 1=1`;
    const params = [];
    if (status && STATUS_VALIDOS.has(String(status))) {
      params.push(status);
      q += ` AND c.status = $${params.length}::energia_status_chamado`;
    }
    if (loja) {
      params.push(Number(loja));
      q += ` AND c.id_loja = $${params.length}`;
    }
    q += filtroSqlLojas(req.user, 'c', 'id_loja', params);
    q += ' ORDER BY c.ocorrido_em DESC, c.id_chamado DESC';
    const { rows } = await pool.query(q, params);

    const statsParams = [];
    let statsQ = `
      SELECT
        COUNT(*) FILTER (WHERE c.status IN ('aberto', 'em_andamento'))::int AS total_aberto,
        COUNT(*) FILTER (WHERE c.status = 'finalizado')::int AS total_finalizado
      FROM energia_chamados c
      WHERE 1=1
    `;
    statsQ += filtroSqlLojas(req.user, 'c', 'id_loja', statsParams);
    const stats = await pool.query(statsQ, statsParams);

    res.json({ items: rows, stats: stats.rows[0] || { total_aberto: 0, total_finalizado: 0 } });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', requireAcessoEnergia(false), async (req, res, next) => {
  try {
    const chamado = await carregarChamado(Number(req.params.id));
    if (!chamado) return res.status(404).json({ error: 'Chamado de energia não encontrado' });
    if (!usuarioPodeLoja(req.user, chamado.id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    const anexos = await anexosDoChamado(chamado.id_chamado);
    res.json(detalheJson(chamado, anexos));
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAcessoEnergia(true), async (req, res, next) => {
  try {
    const idLoja = Number(req.body.id_loja);
    const protocolo = normalizarTexto(req.body.protocolo, 80);
    const concessionaria =
      normalizarTexto(req.body.concessionaria, 120) || 'Concessionária de energia';
    const tipo = String(req.body.tipo_ocorrencia || 'falta_energia');
    const descricao = normalizarTexto(req.body.descricao, 4000);
    const ocorridoEm = parseOcorridoEm(req.body.ocorrido_em) || new Date().toISOString();

    if (!idLoja) return res.status(400).json({ error: 'Selecione a loja.' });
    if (!usuarioPodeLoja(req.user, idLoja)) {
      return res.status(403).json({ error: 'Loja fora do seu acesso.' });
    }
    if (!protocolo) {
      return res.status(400).json({ error: 'Informe o protocolo gerado pela concessionária.' });
    }
    if (!TIPOS_OCORRENCIA.has(tipo)) {
      return res.status(400).json({ error: 'Tipo de ocorrência inválido.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO energia_chamados
         (id_loja, protocolo, concessionaria, tipo_ocorrencia, descricao, ocorrido_em, id_usuario_abriu)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id_chamado, numero`,
      [idLoja, protocolo, concessionaria, tipo, descricao || null, ocorridoEm, req.user.sub],
    );

    const chamado = await carregarChamado(rows[0].id_chamado);
    res.status(201).json(detalheJson(chamado, []));
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', requireAcessoEnergia(true), async (req, res, next) => {
  try {
    const idChamado = Number(req.params.id);
    const atual = await carregarChamado(idChamado);
    if (!atual) return res.status(404).json({ error: 'Chamado de energia não encontrado' });
    if (!usuarioPodeLoja(req.user, atual.id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (atual.status === 'finalizado' || atual.status === 'cancelado') {
      return res.status(400).json({ error: 'Chamado encerrado não pode ser editado.' });
    }

    const sets = [];
    const params = [];
    const push = (col, val) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (req.body.protocolo != null) {
      const protocolo = normalizarTexto(req.body.protocolo, 80);
      if (!protocolo) return res.status(400).json({ error: 'Protocolo não pode ficar vazio.' });
      push('protocolo', protocolo);
    }
    if (req.body.concessionaria != null) {
      push(
        'concessionaria',
        normalizarTexto(req.body.concessionaria, 120) || 'Concessionária de energia',
      );
    }
    if (req.body.tipo_ocorrencia != null) {
      if (!TIPOS_OCORRENCIA.has(String(req.body.tipo_ocorrencia))) {
        return res.status(400).json({ error: 'Tipo de ocorrência inválido.' });
      }
      push('tipo_ocorrencia', req.body.tipo_ocorrencia);
    }
    if (req.body.descricao != null) {
      push('descricao', normalizarTexto(req.body.descricao, 4000) || null);
    }
    if (req.body.ocorrido_em != null) {
      const ocorridoEm = parseOcorridoEm(req.body.ocorrido_em);
      if (!ocorridoEm) return res.status(400).json({ error: 'Data/hora inválida.' });
      push('ocorrido_em', ocorridoEm);
    }
    if (req.body.status != null) {
      const status = String(req.body.status);
      if (!STATUS_ABERTOS.has(status)) {
        return res.status(400).json({ error: 'Use finalizar para encerrar o chamado.' });
      }
      params.push(status);
      sets.push(`status = $${params.length}::energia_status_chamado`);
    }

    if (!sets.length) {
      const anexos = await anexosDoChamado(idChamado);
      return res.json(detalheJson(atual, anexos));
    }

    params.push(idChamado);
    await pool.query(
      `UPDATE energia_chamados SET ${sets.join(', ')}, updated_at = NOW() WHERE id_chamado = $${params.length}`,
      params,
    );

    const chamado = await carregarChamado(idChamado);
    const anexos = await anexosDoChamado(idChamado);
    res.json(detalheJson(chamado, anexos));
  } catch (e) {
    next(e);
  }
});

router.post(
  '/:id/fotos',
  requireAcessoEnergia(true),
  upload.array('fotos', 10),
  async (req, res, next) => {
    try {
      const idChamado = Number(req.params.id);
      const files = req.files || [];
      if (!files.length) return res.status(400).json({ error: 'Envie pelo menos uma foto.' });

      const atual = await carregarChamado(idChamado);
      if (!atual) return res.status(404).json({ error: 'Chamado de energia não encontrado' });
      if (!usuarioPodeLoja(req.user, atual.id_loja)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      if (!STATUS_ABERTOS.has(atual.status)) {
        return res.status(400).json({ error: 'Chamado encerrado não aceita novas fotos.' });
      }

      const existentes = await pool.query(
        'SELECT COUNT(*)::int AS n FROM energia_anexos WHERE id_chamado = $1',
        [idChamado],
      );
      if (existentes.rows[0].n + files.length > 10) {
        return res.status(400).json({ error: 'Limite de 10 fotos por chamado.' });
      }

      for (const file of files) {
        if (!midiaPermitida(file.mimetype) || !file.mimetype.startsWith('image/')) {
          return res.status(400).json({ error: 'Envie apenas imagens.' });
        }
        const criptografado = encryptAnexo(file.buffer);
        await pool.query(
          `INSERT INTO energia_anexos (id_chamado, id_usuario, nome_arquivo, arquivo_url, tipo_mime)
           VALUES ($1, $2, $3, $4, $5)`,
          [idChamado, req.user.sub, file.originalname || 'foto.jpg', criptografado, file.mimetype],
        );
      }

      const chamado = await carregarChamado(idChamado);
      const anexos = await anexosDoChamado(idChamado);
      res.status(201).json(detalheJson(chamado, anexos));
    } catch (e) {
      next(e);
    }
  },
);

router.post('/:id/finalizar', requireAcessoEnergia(true), async (req, res, next) => {
  try {
    const idChamado = Number(req.params.id);
    const atual = await carregarChamado(idChamado);
    if (!atual) return res.status(404).json({ error: 'Chamado de energia não encontrado' });
    if (!usuarioPodeLoja(req.user, atual.id_loja)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    if (!STATUS_ABERTOS.has(atual.status)) {
      return res.status(400).json({ error: 'Este chamado já foi encerrado.' });
    }
    if (!atual.qtd_fotos) {
      return res.status(400).json({ error: 'Anexe ao menos uma foto antes de finalizar.' });
    }

    const observacao = normalizarTexto(req.body.observacao_final, 2000) || null;

    await pool.query(
      `UPDATE energia_chamados SET
         status = 'finalizado',
         observacao_final = $2,
         id_usuario_finalizou = $3,
         finalizado_em = NOW(),
         updated_at = NOW()
       WHERE id_chamado = $1`,
      [idChamado, observacao, req.user.sub],
    );

    const chamado = await carregarChamado(idChamado);
    const anexos = await anexosDoChamado(idChamado);
    res.json(detalheJson(chamado, anexos));
  } catch (e) {
    next(e);
  }
});

export default router;
