import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requirePermissao } from '../permissoes.js';
import { usuarioPodeLoja } from '../lojasUsuario.js';
import { auditar } from '../auditoriaHelpers.js';
import {
  importarVendasLoja,
  processarVenda,
  lancarBreak,
  upsertProdutoVenda,
} from '../services/estoqueMotor.js';
import { parseVendasExcelBuffer } from '../services/bkoffice/parseVendasExcel.js';
import { syncVendasBkOffice, getBkOfficeStatus } from '../services/bkoffice/syncVendas.js';

const router = Router();
const permOp = requirePermissao('estoque.operacional');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseIdLoja(src) {
  const id = Number(src);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function acessoLoja(req, idLoja) {
  if (!idLoja) return { status: 400, error: 'Selecione a loja' };
  if (!usuarioPodeLoja(req.user, idLoja)) {
    return { status: 403, error: 'Sem acesso a esta loja' };
  }
  return null;
}

function userId(req) {
  return req.user?.id_usuario || req.user?.sub || null;
}

// ── Saldos / movimentos ────────────────────────────────────────────────────

router.get('/saldos', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const q = String(req.query.q || '').trim();
    const params = [idLoja];
    let filtro = '';
    if (q) {
      params.push(`%${q}%`);
      filtro = `AND (p.codigo ILIKE $${params.length} OR p.descricao ILIKE $${params.length})`;
    }

    const { rows } = await pool.query(
      `SELECT p.id_produto, p.codigo, p.descricao, p.unidade_contagem,
              p.valor_unidade, COALESCE(s.quantidade, 0) AS quantidade,
              s.atualizado_em
       FROM produtos p
       LEFT JOIN estoque_saldos s
         ON s.id_produto = p.id_produto AND s.id_loja = p.id_loja
       WHERE p.id_loja = $1 AND p.ativo = TRUE ${filtro}
       ORDER BY p.descricao`,
      params,
    );
    res.json(
      rows.map((r) => ({
        ...r,
        quantidade: num(r.quantidade),
        valor_unidade: num(r.valor_unidade),
        valor_total: Math.round(num(r.quantidade) * num(r.valor_unidade) * 100) / 100,
      })),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/movimentos', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const limite = Math.min(Number(req.query.limit) || 100, 500);
    const tipo = String(req.query.tipo || '').trim();
    const params = [idLoja];
    let filtro = '';
    if (tipo) {
      params.push(tipo);
      filtro = `AND m.tipo = $${params.length}`;
    }
    params.push(limite);

    const { rows } = await pool.query(
      `SELECT m.*, p.codigo, p.descricao, u.nome AS criado_por_nome
       FROM estoque_movimentos m
       JOIN produtos p ON p.id_produto = m.id_produto
       LEFT JOIN usuarios u ON u.id_usuario = m.criado_por
       WHERE m.id_loja = $1 ${filtro}
       ORDER BY m.criado_em DESC, m.id_movimento DESC
       LIMIT $${params.length}`,
      params,
    );
    res.json(
      rows.map((r) => ({
        ...r,
        quantidade: num(r.quantidade),
        saldo_apos: r.saldo_apos != null ? num(r.saldo_apos) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

// ── Ficha técnica ──────────────────────────────────────────────────────────

router.get('/produtos-venda', permOp, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const semFicha = req.query.sem_ficha === '1';
    const params = [];
    const where = ['pv.ativo = TRUE'];
    if (q) {
      params.push(`%${q}%`);
      where.push(`(pv.codigo ILIKE $${params.length} OR pv.descricao ILIKE $${params.length})`);
    }
    if (semFicha) {
      where.push(`f.id_ficha IS NULL`);
    }
    const { rows } = await pool.query(
      `SELECT pv.*, f.id_ficha, f.ativo AS ficha_ativa,
              (SELECT COUNT(*)::int FROM ficha_tecnica_itens i WHERE i.id_ficha = f.id_ficha) AS itens_ficha
       FROM produtos_venda pv
       LEFT JOIN ficha_tecnica f ON f.id_produto_venda = pv.id_produto_venda AND f.ativo = TRUE
       WHERE ${where.join(' AND ')}
       ORDER BY pv.descricao
       LIMIT 500`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/fichas', permOp, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.*, pv.codigo, pv.descricao,
              (SELECT COUNT(*)::int FROM ficha_tecnica_itens i WHERE i.id_ficha = f.id_ficha) AS itens
       FROM ficha_tecnica f
       JOIN produtos_venda pv ON pv.id_produto_venda = f.id_produto_venda
       WHERE f.ativo = TRUE
       ORDER BY pv.descricao`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/fichas/:id', permOp, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT f.*, pv.codigo, pv.descricao
       FROM ficha_tecnica f
       JOIN produtos_venda pv ON pv.id_produto_venda = f.id_produto_venda
       WHERE f.id_ficha = $1`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Ficha não encontrada' });
    const { rows: itens } = await pool.query(
      `SELECT * FROM ficha_tecnica_itens WHERE id_ficha = $1 ORDER BY codigo_insumo`,
      [id],
    );
    res.json({
      ...rows[0],
      itens: itens.map((i) => ({ ...i, quantidade: num(i.quantidade) })),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/fichas', permOp, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const codigo = String(req.body?.codigo || req.body?.codigo_venda || '').trim();
    const descricao = String(req.body?.descricao || '').trim();
    const observacao =
      req.body?.observacao != null ? String(req.body.observacao).trim() || null : null;
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (!codigo) return res.status(400).json({ error: 'Informe o código do produto de venda' });
    if (!itens.length) return res.status(400).json({ error: 'Informe ao menos um insumo na ficha' });

    await client.query('BEGIN');
    const pv = await upsertProdutoVenda(client, codigo, descricao);
    const { rows: fichaRows } = await client.query(
      `INSERT INTO ficha_tecnica (id_produto_venda, ativo, observacao, atualizado_em)
       VALUES ($1, TRUE, $2, NOW())
       ON CONFLICT (id_produto_venda) DO UPDATE
         SET ativo = TRUE, observacao = EXCLUDED.observacao, atualizado_em = NOW()
       RETURNING *`,
      [pv.id_produto_venda, observacao],
    );
    const idFicha = fichaRows[0].id_ficha;
    await client.query('DELETE FROM ficha_tecnica_itens WHERE id_ficha = $1', [idFicha]);

    for (const it of itens) {
      const codInsumo = String(it.codigo_insumo || it.codigo || '').trim().toUpperCase();
      const qtde = num(it.quantidade);
      if (!codInsumo || qtde <= 0) continue;
      await client.query(
        `INSERT INTO ficha_tecnica_itens (id_ficha, codigo_insumo, quantidade, observacao)
         VALUES ($1, $2, $3, $4)`,
        [
          idFicha,
          codInsumo,
          qtde,
          it.observacao != null ? String(it.observacao).trim() || null : null,
        ],
      );
    }

    await client.query('COMMIT');
    await auditar(req, {
      modulo: 'estoque',
      acao: 'salvar',
      entidade: 'ficha_tecnica',
      idReferencia: idFicha,
      descricao: `Ficha técnica ${codigo}`,
    });

    const { rows: itensSalvos } = await pool.query(
      `SELECT * FROM ficha_tecnica_itens WHERE id_ficha = $1 ORDER BY codigo_insumo`,
      [idFicha],
    );
    res.status(201).json({
      ...fichaRows[0],
      codigo: pv.codigo,
      descricao: pv.descricao,
      itens: itensSalvos.map((i) => ({ ...i, quantidade: num(i.quantidade) })),
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.delete('/fichas/:id', permOp, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rowCount } = await pool.query(
      `UPDATE ficha_tecnica SET ativo = FALSE, atualizado_em = NOW() WHERE id_ficha = $1`,
      [id],
    );
    if (!rowCount) return res.status(404).json({ error: 'Ficha não encontrada' });
    await auditar(req, {
      modulo: 'estoque',
      acao: 'desativar',
      entidade: 'ficha_tecnica',
      idReferencia: id,
      descricao: `Ficha #${id} desativada`,
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

// ── Vendas ─────────────────────────────────────────────────────────────────

router.get('/vendas', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const { rows } = await pool.query(
      `SELECT v.*,
              (SELECT COUNT(*)::int FROM estoque_venda_itens i WHERE i.id_venda = v.id_venda) AS itens,
              (SELECT COUNT(*)::int FROM estoque_venda_itens i
               WHERE i.id_venda = v.id_venda AND i.processado) AS processados,
              (SELECT COUNT(*)::int FROM estoque_venda_itens i
               WHERE i.id_venda = v.id_venda AND i.sem_ficha AND NOT i.processado) AS sem_ficha
       FROM estoque_vendas v
       WHERE v.id_loja = $1
       ORDER BY v.data_venda DESC, v.id_venda DESC
       LIMIT 100`,
      [idLoja],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/vendas/sem-ficha', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = idLoja ? acessoLoja(req, idLoja) : null;
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const params = [];
    let filtroLoja = '';
    if (idLoja) {
      params.push(idLoja);
      filtroLoja = `AND v.id_loja = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT DISTINCT ON (i.codigo)
         i.codigo, i.descricao, i.id_produto_venda,
         COUNT(*) OVER (PARTITION BY i.codigo)::int AS ocorrencias
       FROM estoque_venda_itens i
       JOIN estoque_vendas v ON v.id_venda = i.id_venda
       WHERE i.sem_ficha = TRUE AND i.processado = FALSE ${filtroLoja}
       ORDER BY i.codigo, i.id_item DESC
       LIMIT 300`,
      params,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/vendas/:id', permOp, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(`SELECT * FROM estoque_vendas WHERE id_venda = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Venda não encontrada' });
    const bloqueio = acessoLoja(req, rows[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const { rows: itens } = await pool.query(
      `SELECT * FROM estoque_venda_itens WHERE id_venda = $1 ORDER BY descricao`,
      [id],
    );
    res.json({
      ...rows[0],
      itens: itens.map((i) => ({
        ...i,
        qtde: num(i.qtde),
        venda_liquida: i.venda_liquida != null ? num(i.venda_liquida) : null,
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/vendas/:id/processar', permOp, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(`SELECT id_loja FROM estoque_vendas WHERE id_venda = $1`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Venda não encontrada' });
    const bloqueio = acessoLoja(req, rows[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const result = await processarVenda(id, { criado_por: userId(req) });
    await auditar(req, {
      modulo: 'estoque',
      acao: 'processar',
      entidade: 'estoque_venda',
      idReferencia: id,
      descricao: `Processar venda #${id}: ${result.status}`,
    });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.post('/vendas/import', permOp, upload.single('arquivo'), async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Envie o arquivo Excel (campo arquivo)' });
    }

    const dataPadrao = String(req.body?.data_venda || '').slice(0, 10) || null;
    const parsed = parseVendasExcelBuffer(req.file.buffer, { dataPadrao });
    const itens = parsed
      .map((r) => ({ ...r, data_venda: r.data_venda || dataPadrao }))
      .filter((r) => r.data_venda && r.codigo && r.qtde > 0);

    if (!itens.length) {
      return res.status(422).json({ error: 'Nenhuma linha de venda reconhecida no Excel' });
    }

    const processar = req.body?.processar !== '0' && req.body?.processar !== false;
    const result = await importarVendasLoja({
      id_loja: idLoja,
      itens,
      origem: 'upload',
      arquivo_nome: req.file.originalname,
      criado_por: userId(req),
      processar,
    });

    await auditar(req, {
      modulo: 'estoque',
      acao: 'importar',
      entidade: 'estoque_venda',
      idReferencia: result.resultados?.[0]?.id_venda || null,
      descricao: `Import Excel vendas loja ${idLoja}: ${itens.length} linhas`,
    });
    res.status(201).json({ linhas: itens.length, ...result });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// ── Sync BK Office ─────────────────────────────────────────────────────────

router.get('/sync/status', permOp, async (req, res) => {
  const status = getBkOfficeStatus();
  const { rows: jobs } = await pool.query(
    `SELECT * FROM estoque_sync_jobs ORDER BY criado_em DESC LIMIT 10`,
  );
  res.json({ ...status, jobs });
});

router.post('/sync/vendas', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const data_inicio = String(req.body?.data_inicio || '').slice(0, 10);
    const data_fim = String(req.body?.data_fim || data_inicio).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(data_fim)) {
      return res.status(400).json({ error: 'Informe data_inicio e data_fim (YYYY-MM-DD)' });
    }

    const result = await syncVendasBkOffice({
      id_loja: idLoja,
      data_inicio,
      data_fim,
      termo_loja: req.body?.termo_loja || null,
      criado_por: userId(req),
      processar: req.body?.processar !== false,
    });

    await auditar(req, {
      modulo: 'estoque',
      acao: 'sync',
      entidade: 'bkoffice',
      idReferencia: result.id_job,
      descricao: `Sync BK Office loja ${idLoja} ${data_inicio}→${data_fim}`,
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// ── Break ──────────────────────────────────────────────────────────────────

router.get('/break', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const { rows } = await pool.query(
      `SELECT b.*, u.nome AS criado_por_nome,
              (SELECT COUNT(*)::int FROM estoque_break_itens i WHERE i.id_break = b.id_break) AS itens
       FROM estoque_break b
       LEFT JOIN usuarios u ON u.id_usuario = b.criado_por
       WHERE b.id_loja = $1
       ORDER BY b.data_break DESC, b.id_break DESC
       LIMIT 100`,
      [idLoja],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/break', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (!itens.length) return res.status(400).json({ error: 'Informe os itens do break' });

    const result = await lancarBreak({
      id_loja: idLoja,
      data_break: req.body?.data_break || null,
      tipo: req.body?.tipo || 'refeicao',
      motivo: req.body?.motivo != null ? String(req.body.motivo).trim() || null : null,
      itens,
      criado_por: userId(req),
    });

    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'estoque_break',
      idReferencia: result.break.id_break,
      descricao: `Break #${result.break.id_break} loja ${idLoja}`,
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export default router;
