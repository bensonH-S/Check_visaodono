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
  registrarEntradas,
  calcularCmvTeorico,
  calcularPedidoSugerido,
  atualizarCustoInsumo,
} from '../services/estoqueMotor.js';
import { parseVendasExcelBuffer } from '../services/bkoffice/parseVendasExcel.js';
import { syncVendasBkOffice, getBkOfficeStatus } from '../services/bkoffice/syncVendas.js';
import { qtdeReceitaParaEstoque } from '../services/fichaReceitaEstoque.js';
import {
  executarSyncFornecedor,
  listarSyncFornecedor,
  obterSyncPorId,
  upsertSyncFornecedor,
} from '../services/platlog/schedulerPlatlog.js';

const router = Router();
const permOp = requirePermissao('estoque.operacional');
const permBreak = requirePermissao('estoque.break', 'estoque.operacional');
const permConfig = requirePermissao('configuracoes.ver', 'estoque.operacional');
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
      `SELECT p.id_insumo, p.codigo, p.descricao, p.unidade_contagem,
              p.valor_unidade, COALESCE(s.quantidade, 0) AS quantidade,
              s.atualizado_em
       FROM insumos p
       LEFT JOIN estoque_saldos s
         ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
       WHERE p.id_loja = $1 AND p.ativo = TRUE ${filtro}
       ORDER BY p.descricao`,
      params,
    );
    res.json(
      rows.map((r) => ({
        id_insumo: r.id_insumo,
        id_produto: r.id_insumo, // alias de transição
        codigo: r.codigo,
        descricao: r.descricao,
        unidade_contagem: r.unidade_contagem,
        valor_unidade: num(r.valor_unidade),
        quantidade: num(r.quantidade),
        atualizado_em: r.atualizado_em,
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
       JOIN insumos p ON p.id_insumo = m.id_insumo
       LEFT JOIN usuarios u ON u.id_usuario = m.criado_por
       WHERE m.id_loja = $1 ${filtro}
       ORDER BY m.criado_em DESC, m.id_movimento DESC
       LIMIT $${params.length}`,
      params,
    );
    res.json(
      rows.map((r) => ({
        ...r,
        id_insumo: r.id_insumo,
        id_produto: r.id_insumo, // alias de transição
        quantidade: num(r.quantidade),
        saldo_apos: r.saldo_apos != null ? num(r.saldo_apos) : null,
      })),
    );
  } catch (e) {
    next(e);
  }
});

// ── Ficha técnica / produtos de venda (BK) ─────────────────────────────────

function mapProdutoVenda(row) {
  const id_produto = row.id_produto ?? row.id_produto_venda;
  const valorVenda =
    row.valor_venda != null
      ? num(row.valor_venda)
      : row.preco_venda != null
        ? num(row.preco_venda)
        : null;
  return {
    ...row,
    id_produto,
    id_produto_venda: id_produto, // alias de transição
    preco_venda: row.preco_venda != null ? num(row.preco_venda) : null,
    valor_venda: valorVenda,
    valor_insumos: num(row.valor_insumos),
    requer_ficha: row.requer_ficha !== false,
  };
}

router.get('/produtos-venda', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const q = String(req.query.q || '').trim();
    const semFicha = req.query.sem_ficha === '1';
    const params = [idLoja];
    const where = ['pv.id_loja = $1'];
    const ativos = req.query.ativos;
    if (ativos === '0') where.push('pv.ativo = FALSE');
    else if (ativos !== 'all') where.push('pv.ativo = TRUE');
    if (q) {
      params.push(`%${q}%`);
      where.push(`(pv.codigo ILIKE $${params.length} OR pv.descricao ILIKE $${params.length})`);
    }
    if (semFicha) {
      // Só produtos que PRECISAM de ficha e ainda não têm
      where.push(`COALESCE(pv.requer_ficha, TRUE) = TRUE`);
      where.push(`(f.id_ficha IS NULL OR NOT EXISTS (
        SELECT 1 FROM ficha_tecnica_itens i WHERE i.id_ficha = f.id_ficha
      ))`);
    }
    const { rows } = await pool.query(
      `SELECT pv.*, f.id_ficha, f.ativo AS ficha_ativa,
              (SELECT COUNT(*)::int FROM ficha_tecnica_itens i WHERE i.id_ficha = f.id_ficha) AS itens_ficha,
              COALESCE((
                SELECT json_agg(
                  json_build_object(
                    'codigo_insumo', i.codigo_insumo,
                    'quantidade', i.quantidade,
                    'unidade_receita', COALESCE(i.unidade_receita, 'und'),
                    'qtde_estoque', COALESCE(i.qtde_estoque, i.quantidade),
                    'valor_unidade', COALESCE(ins.valor_unidade, 0),
                    'custo_linha', ROUND(
                      (COALESCE(i.qtde_estoque, i.quantidade) * COALESCE(ins.valor_unidade, 0))::numeric,
                      4
                    )
                  )
                  ORDER BY i.codigo_insumo
                )
                FROM ficha_tecnica_itens i
                LEFT JOIN insumos ins
                  ON ins.id_loja = pv.id_loja
                 AND UPPER(ins.codigo) = UPPER(i.codigo_insumo)
                WHERE i.id_ficha = f.id_ficha
              ), '[]'::json) AS insumos_ficha,
              COALESCE((
                SELECT SUM(COALESCE(i.qtde_estoque, i.quantidade) * COALESCE(ins.valor_unidade, 0))
                FROM ficha_tecnica_itens i
                LEFT JOIN insumos ins
                  ON ins.id_loja = pv.id_loja
                 AND UPPER(ins.codigo) = UPPER(i.codigo_insumo)
                WHERE i.id_ficha = f.id_ficha
              ), 0) AS valor_insumos,
              (
                SELECT ROUND((vi.venda_liquida / NULLIF(vi.qtde, 0))::numeric, 2)
                FROM estoque_venda_itens vi
                INNER JOIN estoque_vendas v ON v.id_venda = vi.id_venda
                WHERE vi.id_produto = pv.id_produto
                  AND vi.venda_liquida IS NOT NULL
                  AND vi.qtde > 0
                ORDER BY v.data_venda DESC NULLS LAST, vi.id_item DESC
                LIMIT 1
              ) AS valor_venda
       FROM produtos pv
       LEFT JOIN ficha_tecnica f ON f.id_produto = pv.id_produto AND f.ativo = TRUE
       WHERE ${where.join(' AND ')}
       ORDER BY pv.ativo DESC, pv.descricao
       LIMIT 500`,
      params,
    );
    res.json(rows.map(mapProdutoVenda));
  } catch (e) {
    next(e);
  }
});

router.get('/fichas', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const { rows } = await pool.query(
      `SELECT f.*, pv.codigo, pv.descricao,
              (SELECT COUNT(*)::int FROM ficha_tecnica_itens i WHERE i.id_ficha = f.id_ficha) AS itens
       FROM ficha_tecnica f
       JOIN produtos pv ON pv.id_produto = f.id_produto
       WHERE f.ativo = TRUE AND pv.id_loja = $1
       ORDER BY pv.descricao`,
      [idLoja],
    );
    res.json(rows.map(mapProdutoVenda));
  } catch (e) {
    next(e);
  }
});

router.get('/fichas/:id', permOp, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT f.*, pv.codigo, pv.descricao, pv.id_loja
       FROM ficha_tecnica f
       JOIN produtos pv ON pv.id_produto = f.id_produto
       WHERE f.id_ficha = $1`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Ficha não encontrada' });
    const bloqueio = acessoLoja(req, rows[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const { rows: itens } = await pool.query(
      `SELECT * FROM ficha_tecnica_itens WHERE id_ficha = $1 ORDER BY codigo_insumo`,
      [id],
    );
    res.json({
      ...mapProdutoVenda(rows[0]),
      itens: itens.map((i) => ({
        ...i,
        quantidade: num(i.quantidade),
        unidade_receita: i.unidade_receita || 'und',
        qtde_estoque: num(i.qtde_estoque != null ? i.qtde_estoque : i.quantidade),
      })),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/fichas', permOp, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const codigo = String(req.body?.codigo || req.body?.codigo_venda || '').trim();
    const descricao = String(req.body?.descricao || '').trim();
    const observacao =
      req.body?.observacao != null ? String(req.body.observacao).trim() || null : null;
    const ativo =
      req.body?.ativo === undefined || req.body?.ativo === null
        ? true
        : req.body.ativo === true || req.body.ativo === 'true' || req.body.ativo === 1 || req.body.ativo === '1';
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    const requerFicha =
      req.body?.requer_ficha === undefined || req.body?.requer_ficha === null
        ? true
        : !(
            req.body.requer_ficha === false ||
            req.body.requer_ficha === 'false' ||
            req.body.requer_ficha === 0 ||
            req.body.requer_ficha === '0'
          );
    if (!codigo) return res.status(400).json({ error: 'Informe o código do produto de venda' });
    if (requerFicha && !itens.length) {
      return res.status(400).json({ error: 'Informe ao menos um insumo na ficha' });
    }

    await client.query('BEGIN');
    const pv = await upsertProdutoVenda(client, codigo, descricao, idLoja, {
      ativo,
      requer_ficha: requerFicha,
    });

    // Unitário: sem composição — remove ficha se existir
    if (!requerFicha) {
      await client.query(
        `UPDATE ficha_tecnica SET ativo = FALSE, atualizado_em = NOW() WHERE id_produto = $1`,
        [pv.id_produto],
      );
      await client.query('COMMIT');
      await auditar(req, {
        modulo: 'estoque',
        acao: 'salvar',
        entidade: 'produto_venda',
        idReferencia: pv.id_produto,
        descricao: `Produto unitário ${codigo} (loja ${idLoja})`,
      });
      return res.status(201).json({
        ...mapProdutoVenda(pv),
        id_ficha: null,
        itens_ficha: 0,
        itens: [],
      });
    }

    const { rows: fichaRows } = await client.query(
      `INSERT INTO ficha_tecnica (id_produto, ativo, observacao, atualizado_em)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (id_produto) DO UPDATE
         SET ativo = EXCLUDED.ativo, observacao = EXCLUDED.observacao, atualizado_em = NOW()
       RETURNING *`,
      [pv.id_produto, ativo, observacao],
    );
    const idFicha = fichaRows[0].id_ficha;
    await client.query('DELETE FROM ficha_tecnica_itens WHERE id_ficha = $1', [idFicha]);

    for (const it of itens) {
      const codInsumo = String(it.codigo_insumo || it.codigo || '').trim().toUpperCase();
      const qtde = num(it.quantidade);
      if (!codInsumo || qtde <= 0) continue;
      const unidade = String(it.unidade_receita || it.unidade || 'und').trim().toLowerCase() || 'und';
      const { rows: insRows } = await client.query(
        `SELECT codigo, descricao, und_convertida, valor_unidade
         FROM insumos WHERE id_loja = $1 AND UPPER(codigo) = $2 LIMIT 1`,
        [idLoja, codInsumo],
      );
      const insumo = insRows[0] || { descricao: '', und_convertida: 1 };
      const qtdeEst =
        it.qtde_estoque != null && Number(it.qtde_estoque) > 0
          ? num(it.qtde_estoque)
          : qtdeReceitaParaEstoque(qtde, unidade, insumo);
      await client.query(
        `INSERT INTO ficha_tecnica_itens
           (id_ficha, codigo_insumo, quantidade, unidade_receita, qtde_estoque, observacao)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          idFicha,
          codInsumo,
          qtde,
          unidade,
          qtdeEst,
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
      descricao: `Ficha técnica ${codigo} (loja ${idLoja})`,
    });

    const { rows: itensSalvos } = await pool.query(
      `SELECT * FROM ficha_tecnica_itens WHERE id_ficha = $1 ORDER BY codigo_insumo`,
      [idFicha],
    );
    res.status(201).json({
      ...mapProdutoVenda({ ...fichaRows[0], ...pv, requer_ficha: true }),
      codigo: pv.codigo,
      descricao: pv.descricao,
      id_loja: pv.id_loja,
      ativo: pv.ativo,
      requer_ficha: true,
      itens: itensSalvos.map((i) => ({ ...i, quantidade: num(i.quantidade) })),
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.delete('/produtos-venda/:id', permOp, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Produto inválido' });
    }
    const { rows } = await pool.query(
      `SELECT id_produto, id_loja, codigo, descricao FROM produtos WHERE id_produto = $1`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Produto não encontrado' });
    const bloqueio = acessoLoja(req, rows[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    await pool.query(
      `UPDATE ficha_tecnica SET ativo = FALSE, atualizado_em = NOW() WHERE id_produto = $1`,
      [id],
    );
    await pool.query(
      `UPDATE produtos SET ativo = FALSE, atualizado_em = NOW() WHERE id_produto = $1`,
      [id],
    );
    await auditar(req, {
      modulo: 'estoque',
      acao: 'excluir',
      entidade: 'produto_venda',
      idReferencia: id,
      descricao: `Produto ${rows[0].codigo} excluído (loja ${rows[0].id_loja})`,
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

router.delete('/fichas/:id', permOp, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT f.id_ficha, pv.id_loja, pv.id_produto
       FROM ficha_tecnica f
       JOIN produtos pv ON pv.id_produto = f.id_produto
       WHERE f.id_ficha = $1`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Ficha não encontrada' });
    const bloqueio = acessoLoja(req, rows[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    await pool.query(
      `UPDATE ficha_tecnica SET ativo = FALSE, atualizado_em = NOW() WHERE id_ficha = $1`,
      [id],
    );
    await pool.query(
      `UPDATE produtos SET ativo = FALSE, atualizado_em = NOW() WHERE id_produto = $1`,
      [rows[0].id_produto],
    );
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
         i.codigo, i.descricao, i.id_produto,
         i.id_produto AS id_produto_venda,
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
    const serverSync =
      process.env.BKOFFICE_SERVER_SYNC === '1' ||
      process.env.BKOFFICE_SERVER_SYNC === 'true';
    if (!serverSync) {
      return res.status(503).json({
        error:
          'Sync BK Office no servidor Meridian está desligado. ' +
          'As vendas entram pelo PC da gerência (serviço Windows) ou por Importar Excel.',
      });
    }

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

router.get('/break', permBreak, async (req, res, next) => {
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

router.post('/break', permBreak, async (req, res, next) => {
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

// ── Compras (entrada) + CMV teórico ────────────────────────────────────────

router.post('/entradas', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (!itens.length) return res.status(400).json({ error: 'Informe os itens da compra' });

    const result = await registrarEntradas({
      id_loja: idLoja,
      itens,
      observacao: req.body?.observacao != null ? String(req.body.observacao).trim() || null : null,
      criado_por: userId(req),
      referencia: req.body?.referencia != null ? String(req.body.referencia).trim() || null : null,
    });

    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'estoque_entrada',
      descricao: `Compra/entrada loja ${idLoja}: ${result.entradas.length} item(ns)`,
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.get('/cmv/teorico', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const de = req.query.de ? String(req.query.de).slice(0, 10) : null;
    const ate = req.query.ate ? String(req.query.ate).slice(0, 10) : null;
    const meta = req.query.meta != null ? Number(req.query.meta) : 0.38;

    const result = await calcularCmvTeorico(idLoja, { de, ate, meta });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get('/pedido-sugerido', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const crescimento =
      req.query.crescimento != null ? Number(req.query.crescimento) : 0.05;
    const dias = req.query.dias != null ? Number(req.query.dias) : 7;
    const estoque_seguranca_dias =
      req.query.estoque_seguranca_dias != null
        ? Number(req.query.estoque_seguranca_dias)
        : 1;

    const result = await calcularPedidoSugerido(idLoja, {
      crescimento,
      dias,
      estoque_seguranca_dias,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/insumos/custo', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const result = await atualizarCustoInsumo(idLoja, {
      id_insumo: req.body?.id_insumo,
      codigo: req.body?.codigo,
      preco_caixa: req.body?.preco_caixa,
      und_convertida: req.body?.und_convertida,
      fonte: req.body?.fonte || 'nf',
    });

    await auditar(req, {
      modulo: 'estoque',
      acao: 'atualizar',
      entidade: 'insumo_custo',
      idReferencia: result.id_insumo,
      descricao: `Custo ${result.custo_fonte} ${result.codigo} = ${result.preco_caixa}`,
    });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// ── Sync NF fornecedores (Platlog / Coca) — config + status ─────────────────

router.get('/sync-fornecedor', permConfig, async (_req, res, next) => {
  try {
    const itens = await listarSyncFornecedor();
    res.json({
      itens,
      agora_sp: new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date()),
    });
  } catch (e) {
    next(e);
  }
});

router.put('/sync-fornecedor', permConfig, async (req, res, next) => {
  try {
    const row = await upsertSyncFornecedor({
      fornecedor: req.body?.fornecedor,
      id_loja: req.body?.id_loja,
      ativo: req.body?.ativo,
      horario: req.body?.horario,
      limite: req.body?.limite,
    });
    await auditar(req, {
      modulo: 'estoque',
      acao: 'atualizar',
      entidade: 'estoque_sync_fornecedor',
      idReferencia: row.id_sync,
      descricao: `Sync ${row.fornecedor} loja ${row.id_loja}: ativo=${row.ativo} ${row.horario}`,
    });
    res.json(row);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.post('/sync-fornecedor/:id/rodar', permConfig, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cfg = await obterSyncPorId(id);
    if (!cfg) return res.status(404).json({ error: 'Configuração não encontrada' });
    if (cfg.ultimo_status === 'rodando') {
      return res.status(409).json({ error: 'Sync já em andamento' });
    }

    // Responde e roda em background (Playwright demora)
    res.status(202).json({ ok: true, message: 'Sync iniciado', id_sync: id });

    void executarSyncFornecedor(
      {
        id_sync: cfg.id_sync,
        fornecedor: cfg.fornecedor,
        id_loja: cfg.id_loja,
        limite: cfg.limite,
      },
      { forcar: !!req.body?.forcar },
    )
      .then(() => {
        console.log(`[platlog] sync manual #${id} concluído`);
      })
      .catch((err) => {
        console.error(`[platlog] sync manual #${id} falhou:`, err.message);
      });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export default router;
