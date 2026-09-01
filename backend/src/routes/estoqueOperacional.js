import { Router } from 'express';
import multer from 'multer';
import { pool, hrPool } from '../db.js';
import { requirePermissao } from '../permissoes.js';
import { usuarioPodeLojaEstoque } from '../lojasUsuario.js';
import { auditar } from '../auditoriaHelpers.js';
import {
  importarVendasLoja,
  processarVenda,
  lancarBreak,
  listarLojasDestinoEmprestimo,
  listarEmprestimosAReceber,
  confirmarRecebimentoEmprestimo,
  garantirSchemaBreakCaderno,
  upsertProdutoVenda,
  registrarEntradas,
  calcularCmvTeorico,
  calcularPedidoSugerido,
  calcularMetaVendas,
  listarStatusSyncVendasLojas,
  atualizarCustoInsumo,
} from '../services/estoqueMotor.js';
import {
  calcularCmvReal,
  calcularVarianciaInsumos,
  confirmarEntradaNfe,
  conferirRecebimentoNfe,
  listarNfesEstoque,
  obterNfeDetalhe,
  statusDisciplinaEstoque,
  fecharMesEstoque,
  reabrirMesEstoque,
} from '../services/estoqueCmvReal.js';
import { parseVendasExcelBuffer } from '../services/bkoffice/parseVendasExcel.js';
import { syncVendasBkOffice, getBkOfficeStatus } from '../services/bkoffice/syncVendas.js';
import { statusKitParaPortal } from '../services/bkoffice/kitSyncLease.js';
import { qtdeReceitaParaEstoque } from '../services/fichaReceitaEstoque.js';
import {
  garantirSchemaPilotoBaixa,
  listarAuditoriaPiloto,
  linhasExcelAuditoriaPiloto,
} from '../services/estoqueConsumo.js';
import XLSX from 'xlsx';
import {
  TURNOS,
  filtrarPorCaderno,
  labelTipoLancamento,
  motivosDoTipo,
} from '../services/estoqueCadernos.js';
import {
  executarSyncFornecedor,
  listarSyncFornecedor,
  obterSyncPorId,
  upsertSyncFornecedor,
} from '../services/platlog/schedulerPlatlog.js';
import { calcularCiclo, listarStatusContagemRede } from '../services/estoqueCiclo.js';
import { parsePaginacaoOffset, montarEnvelopeOffset } from '../paginacao.js';
import fs from 'fs/promises';
import { parseNfeXml, renderDanfeHtml } from '../services/nfeXml.js';

const router = Router();
const permOp = requirePermissao('estoque.operacional');
/** Saldo da diária: loja consulta no app com permissão de conferência. */
const permSaldo = requirePermissao('estoque.operacional', 'estoque.conferencia');
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
  if (!usuarioPodeLojaEstoque(req.user, idLoja)) {
    return { status: 403, error: 'Sem acesso a esta loja' };
  }
  return null;
}

function userId(req) {
  return req.user?.id_usuario || req.user?.sub || null;
}

function normalizarNomeColab(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

async function usuariosLojaBreak(idLoja) {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.id_usuario, u.nome
     FROM usuarios u
     JOIN usuario_lojas ul ON ul.id_usuario = u.id_usuario AND ul.id_loja = $1
     WHERE u.ativo = TRUE
     ORDER BY u.nome`,
    [idLoja],
  );
  return rows;
}

async function colaboradoresHrTodos() {
  const { rows } = await hrPool.query(
    `SELECT id, full_name AS nome FROM employees ORDER BY full_name`,
  );
  return rows;
}

function montarColaboradoresBreak(hrRows, usuarioRows) {
  const porNome = new Map();
  for (const u of usuarioRows) {
    const k = normalizarNomeColab(u.nome);
    if (k && !porNome.has(k)) porNome.set(k, u);
  }
  const visto = new Set();
  const out = [];
  for (const e of hrRows) {
    const nome = String(e.nome || '').trim();
    const k = normalizarNomeColab(nome);
    if (!k || visto.has(k)) continue;
    visto.add(k);
    const match = porNome.get(k);
    const idHr = Number(e.id);
    out.push({
      id_usuario: match
        ? Number(match.id_usuario)
        : Number.isFinite(idHr) && idHr > 0
          ? -(idHr + 1_000_000)
          : 0,
      nome,
    });
  }
  for (const u of usuarioRows) {
    const k = normalizarNomeColab(u.nome);
    if (!k || visto.has(k)) continue;
    visto.add(k);
    out.push({ id_usuario: Number(u.id_usuario), nome: String(u.nome || '').trim() });
  }
  out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return out.filter((c) => c.nome);
}

// ── Ciclo de estoque (timestamp A → B) ─────────────────────────────────────

router.get('/ciclos/preview', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const idInicio = req.query.id_contagem_inicio
      ? Number(req.query.id_contagem_inicio)
      : null;
    const idFim = req.query.id_contagem_fim ? Number(req.query.id_contagem_fim) : null;
    const tipo = req.query.tipo ? String(req.query.tipo).trim() : null;
    const persistir =
      req.query.persistir === '1' ||
      req.query.persistir === 'true';

    const result = await calcularCiclo({
      id_loja: idLoja,
      id_contagem_inicio: Number.isFinite(idInicio) && idInicio > 0 ? idInicio : null,
      id_contagem_fim: Number.isFinite(idFim) && idFim > 0 ? idFim : null,
      tipo: tipo || null,
      persistir,
    });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

// ── Saldos / movimentos ────────────────────────────────────────────────────

router.get('/saldos', permSaldo, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const q = String(req.query.q || '').trim();
    const soDiaria =
      req.query.diaria === '1' ||
      req.query.diaria === 'true' ||
      String(req.query.escopo || '') === 'diaria';
    const params = [idLoja];
    let filtro = '';
    if (q) {
      params.push(`%${q}%`);
      filtro += ` AND (p.codigo ILIKE $${params.length} OR p.descricao ILIKE $${params.length})`;
    }
    if (soDiaria) {
      filtro += ' AND COALESCE(p.contagem_diaria, FALSE) = TRUE';
    }

    const { rows } = await pool.query(
      `SELECT p.id_insumo, p.codigo, p.descricao, p.unidade_contagem, p.grupo_diario,
              p.valor_unidade, COALESCE(s.quantidade, 0) AS quantidade,
              s.atualizado_em
       FROM insumos p
       LEFT JOIN estoque_saldos s
         ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
       WHERE p.id_loja = $1 AND p.ativo = TRUE ${filtro}
       ORDER BY
         CASE p.grupo_diario
           WHEN 'carne' THEN 1 WHEN 'frango' THEN 2 WHEN 'queijo' THEN 3
           WHEN 'bacon' THEN 4 WHEN 'pao' THEN 5 WHEN 'batata' THEN 6
           WHEN 'oleo' THEN 7 WHEN 'refil' THEN 8 WHEN 'vegetais' THEN 9
           WHEN 'mix_sobremesa' THEN 10 ELSE 99
         END,
         p.descricao`,
      params,
    );
    res.json(
      rows.map((r) => ({
        id_insumo: r.id_insumo,
        id_produto: r.id_insumo, // alias de transição
        codigo: r.codigo,
        descricao: r.descricao,
        unidade_contagem: r.unidade_contagem,
        grupo_diario: r.grupo_diario || null,
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

    const tipo = String(req.query.tipo || '').trim();
    const paginacao = parsePaginacaoOffset(req, { defaultPageSize: 100, maxPageSize: 500 });

    const params = [idLoja];
    let filtro = '';
    if (tipo) {
      params.push(tipo);
      filtro = `AND m.tipo = $${params.length}`;
    }

    // Sem paginate=1: mantém o comportamento antigo (limit via query, default 100, teto 500).
    if (!paginacao.ativo) {
      const limite = Math.min(Number(req.query.limit) || 100, 500);
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
      return res.json(
        rows.map((r) => ({
          ...r,
          id_insumo: r.id_insumo,
          id_produto: r.id_insumo,
          quantidade: num(r.quantidade),
          saldo_apos: r.saldo_apos != null ? num(r.saldo_apos) : null,
        })),
      );
    }

    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM estoque_movimentos m
       WHERE m.id_loja = $1 ${filtro}`,
      params,
    );
    params.push(paginacao.pageSize, paginacao.offset);
    const { rows } = await pool.query(
      `SELECT m.*, p.codigo, p.descricao, u.nome AS criado_por_nome
       FROM estoque_movimentos m
       JOIN insumos p ON p.id_insumo = m.id_insumo
       LEFT JOIN usuarios u ON u.id_usuario = m.criado_por
       WHERE m.id_loja = $1 ${filtro}
       ORDER BY m.criado_em DESC, m.id_movimento DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const mapeados = rows.map((r) => ({
      ...r,
      id_insumo: r.id_insumo,
      id_produto: r.id_insumo,
      quantidade: num(r.quantidade),
      saldo_apos: r.saldo_apos != null ? num(r.saldo_apos) : null,
    }));
    res.json(
      montarEnvelopeOffset(mapeados, {
        page: paginacao.page,
        pageSize: paginacao.pageSize,
        total: totalRows[0].total,
      }),
    );
  } catch (e) {
    next(e);
  }
});

router.get('/baixa-pendencias', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    await garantirSchemaPilotoBaixa(pool);
    const limite = Math.min(Number(req.query.limit) || 100, 500);
    const { rows } = await pool.query(
      `SELECT p.*, i.descricao AS insumo_descricao
       FROM estoque_baixa_pendencias p
       LEFT JOIN insumos i ON i.id_insumo = p.id_insumo
       WHERE p.id_loja = $1
       ORDER BY p.criado_em DESC, p.id_pendencia DESC
       LIMIT $2`,
      [idLoja, limite],
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/piloto-auditoria', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    await garantirSchemaPilotoBaixa(pool);
    const status = String(req.query.status || '').trim() || null;
    const codigo = String(req.query.codigo_insumo || '').trim() || null;
    const limite = Math.min(Number(req.query.limit) || 300, 2000);
    const rows = await listarAuditoriaPiloto(pool, {
      id_loja: idLoja,
      status,
      codigo_insumo: codigo,
      limit: limite,
    });
    const formato = String(req.query.formato || 'json').toLowerCase();
    if (formato !== 'xlsx') {
      return res.json({
        id_loja: idLoja,
        total: rows.length,
        itens: rows,
      });
    }
    const { rows: lojaRows } = await pool.query(
      `SELECT name, bk_number FROM lojas WHERE id_loja = $1`,
      [idLoja],
    );
    const loja = lojaRows[0] || {};
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(linhasExcelAuditoriaPiloto(rows)),
      'Auditoria',
    );
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const bkn = String(loja.bk_number || idLoja).replace(/\W+/g, '');
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
      new Date(),
    );
    const filename = `piloto-baixa-auditoria-${bkn}-${hoje}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
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

    const paginacao = parsePaginacaoOffset(req, { defaultPageSize: 100, maxPageSize: 200 });
    const limite = paginacao.ativo ? paginacao.pageSize : 100;
    const params = paginacao.ativo ? [idLoja, limite, paginacao.offset] : [idLoja];
    const clausulaLimit = paginacao.ativo ? 'LIMIT $2 OFFSET $3' : 'LIMIT 100';

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
       ${clausulaLimit}`,
      params,
    );

    if (!paginacao.ativo) return res.json(rows);

    const { rows: totalRows } = await pool.query(
      'SELECT COUNT(*)::int AS total FROM estoque_vendas WHERE id_loja = $1',
      [idLoja],
    );
    res.json(
      montarEnvelopeOffset(rows, {
        page: paginacao.page,
        pageSize: paginacao.pageSize,
        total: totalRows[0].total,
      }),
    );
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

router.get('/sync/status', permOp, async (req, res, next) => {
  try {
    const status = getBkOfficeStatus();
    const { rows: jobs } = await pool.query(
      `SELECT * FROM estoque_sync_jobs ORDER BY criado_em DESC LIMIT 10`,
    );
    let kit = null;
    const kitEnabled =
      process.env.BKOFFICE_KIT_ENABLED === '1' ||
      process.env.BKOFFICE_KIT_ENABLED === 'true';
    if (kitEnabled) {
      try {
        kit = await statusKitParaPortal();
      } catch {
        kit = null;
      }
    }
    res.json({ ...status, jobs, kit });
  } catch (e) {
    next(e);
  }
});

/** Status de sync BK Office por loja (último dia + bruto do mês). */
router.get('/sync/lojas', permOp, async (req, res, next) => {
  try {
    const idsEstoque = req.user?.lojas_ids_estoque;
    const ids =
      Array.isArray(idsEstoque) && idsEstoque.length
        ? idsEstoque.map(Number).filter((n) => n > 0)
        : null;
    const result = await listarStatusSyncVendasLojas(ids);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

/** Diária do dia por loja: quem já contou, quem está em andamento, quem falta. */
router.get('/contagens/rede', permOp, async (req, res, next) => {
  try {
    const idsEstoque = req.user?.lojas_ids_estoque;
    const ids =
      Array.isArray(idsEstoque) && idsEstoque.length
        ? idsEstoque.map(Number).filter((n) => n > 0)
        : null;
    const tipo = String(req.query.tipo || 'diaria').toLowerCase();
    const data = String(req.query.data || '').slice(0, 10) || null;
    const result = await listarStatusContagemRede({
      idsPermitidos: ids,
      tipo: ['diaria', 'critica_semanal', 'completa'].includes(tipo) ? tipo : 'diaria',
      data,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
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

router.get('/break/lojas-destino', permBreak, async (req, res, next) => {
  try {
    const rows = await listarLojasDestinoEmprestimo();
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/break/a-receber', permBreak, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    const rows = await listarEmprestimosAReceber(idLoja);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/break/:id/receber', permBreak, async (req, res, next) => {
  try {
    const idBreak = Number(req.params.id);
    const idLoja = parseIdLoja(req.body?.id_loja);
    if (!Number.isFinite(idBreak) || idBreak <= 0) {
      return res.status(400).json({ error: 'Empréstimo inválido' });
    }
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const result = await confirmarRecebimentoEmprestimo({
      id_break: idBreak,
      id_loja_destino: idLoja,
      recebido_por: userId(req),
    });
    await auditar(req, {
      modulo: 'estoque',
      acao: 'receber',
      entidade: 'estoque_break',
      idReferencia: idBreak,
      descricao: `Empréstimo #${idBreak} recebido na loja ${idLoja}`,
    });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.get('/break', permBreak, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    await garantirSchemaBreakCaderno(pool);

    const { rows } = await pool.query(
      `SELECT b.*, u.nome AS criado_por_nome,
              COALESCE(b.colaborador_nome, uc.nome) AS colaborador_nome,
              ld.name AS loja_destino_nome,
              ld.bk_number AS loja_destino_bk,
              (SELECT COUNT(*)::int FROM estoque_break_itens i WHERE i.id_break = b.id_break) AS itens
       FROM estoque_break b
       LEFT JOIN usuarios u ON u.id_usuario = b.criado_por
       LEFT JOIN usuarios uc ON uc.id_usuario = b.id_colaborador
       LEFT JOIN lojas ld ON ld.id_loja = b.id_loja_destino
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

router.get('/break/colaboradores', permBreak, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const usuarios = await usuariosLojaBreak(idLoja);
    let hrRows = [];
    try {
      hrRows = await colaboradoresHrTodos();
    } catch {
      hrRows = [];
    }
    res.json(montarColaboradoresBreak(hrRows, usuarios));
  } catch (e) {
    next(e);
  }
});

router.get('/break/catalogo', permBreak, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const tipo = String(req.query.tipo || 'refeicao').trim() || 'refeicao';
    const produtos = [];
    const insumos = [];

    if (tipo === 'desperdicio_incompleto' || tipo === 'emprestimo') {
      const { rows } = await pool.query(
        `SELECT id_insumo, id_loja, codigo, descricao, ativo,
                unidade_contagem,
                COALESCE(und_convertida, 1) AS und_convertida,
                COALESCE(und_parcial, 1) AS und_parcial,
                COALESCE(permite_contagem_caixa, TRUE) AS permite_contagem_caixa,
                COALESCE(permite_contagem_pc_fd, TRUE) AS permite_contagem_pc_fd,
                COALESCE(permite_contagem_kg_und, TRUE) AS permite_contagem_kg_und
         FROM insumos
         WHERE id_loja = $1 AND ativo = TRUE
         ORDER BY descricao`,
        [idLoja],
      );
      const mapped = rows.map((r) => ({
        id_insumo: r.id_insumo,
        id_produto: r.id_insumo,
        id_loja: r.id_loja,
        codigo: r.codigo,
        descricao: r.descricao,
        ativo: r.ativo !== false,
        unidade_contagem: r.unidade_contagem || 'UND',
        preco_caixa: 0,
        und_convertida: Number(r.und_convertida) || 1,
        und_parcial: Number(r.und_parcial) || 1,
        valor_unidade: 0,
        permite_contagem_caixa: r.permite_contagem_caixa !== false,
        permite_contagem_pc_fd: r.permite_contagem_pc_fd !== false,
        permite_contagem_kg_und: r.permite_contagem_kg_und !== false,
      }));
      // Lista curada (códigos); se vazia/sem match, cai no caderno antigo via filtrarPorCaderno.
      insumos.push(...filtrarPorCaderno(mapped, tipo));
    } else {
      const { rows } = await pool.query(
        `SELECT id_produto, codigo, descricao, ativo
         FROM produtos
         WHERE id_loja = $1 AND ativo = TRUE
         ORDER BY descricao
         LIMIT 800`,
        [idLoja],
      );
      const mapped = rows.map((r) => ({
        id_produto: r.id_produto,
        id_produto_venda: r.id_produto,
        codigo: r.codigo,
        descricao: r.descricao,
        ativo: r.ativo !== false,
      }));
      produtos.push(...filtrarPorCaderno(mapped, tipo === 'desperdicio_completo' ? tipo : 'refeicao'));
    }

    res.json({
      tipo,
      label: labelTipoLancamento(tipo),
      turnos: TURNOS,
      motivos: motivosDoTipo(tipo),
      produtos,
      insumos,
    });
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
    if (!itens.length) return res.status(400).json({ error: 'Informe os itens do lançamento' });

    const tipo = String(req.body?.tipo || 'refeicao').trim() || 'refeicao';
    const turno = req.body?.turno != null ? String(req.body.turno).trim() : '';
    const motivoCod =
      req.body?.motivo_codigo != null ? String(req.body.motivo_codigo).trim() : '';
    const idLojaDestino = parseIdLoja(req.body?.id_loja_destino);

    const idColab =
      req.body?.id_colaborador != null && req.body.id_colaborador !== ''
        ? Number(req.body.id_colaborador)
        : null;
    const nomeColab =
      req.body?.colaborador_nome != null ? String(req.body.colaborador_nome).trim() : '';

    if (tipo === 'refeicao' || tipo === 'outro') {
      if (!(Number.isFinite(idColab) && idColab !== 0) && !nomeColab) {
        return res.status(400).json({ error: 'Informe o colaborador que pegará o break' });
      }
    }

    const result = await lancarBreak({
      id_loja: idLoja,
      data_break: req.body?.data_break || null,
      tipo,
      turno: turno || null,
      motivo: req.body?.motivo != null ? String(req.body.motivo).trim() || null : null,
      motivo_codigo: motivoCod || null,
      id_colaborador: Number.isFinite(idColab) && idColab > 0 ? idColab : null,
      colaborador_nome: nomeColab || null,
      id_loja_destino: idLojaDestino,
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
    if (e.code === '23503') {
      return res.status(400).json({ error: 'Não foi possível lançar o break. Tente de novo.' });
    }
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

router.get('/meta-vendas', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const crescimento =
      req.query.crescimento != null ? Number(req.query.crescimento) : 0.1;
    const result = await calcularMetaVendas(idLoja, { crescimento });
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


router.get('/cmv/real', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const result = await calcularCmvReal(idLoja, {
      de: req.query.de ? String(req.query.de).slice(0, 10) : null,
      ate: req.query.ate ? String(req.query.ate).slice(0, 10) : null,
      meta: req.query.meta != null ? Number(req.query.meta) : 0.38,
      id_contagem_ei: req.query.id_contagem_ei ? Number(req.query.id_contagem_ei) : null,
      id_contagem_ef: req.query.id_contagem_ef ? Number(req.query.id_contagem_ef) : null,
    });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.get('/cmv/variancia', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const result = await calcularVarianciaInsumos(idLoja, {
      de: req.query.de ? String(req.query.de).slice(0, 10) : null,
      ate: req.query.ate ? String(req.query.ate).slice(0, 10) : null,
      id_contagem_ei: req.query.id_contagem_ei ? Number(req.query.id_contagem_ei) : null,
      id_contagem_ef: req.query.id_contagem_ef ? Number(req.query.id_contagem_ef) : null,
      limite: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.get('/nfes', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const rows = await listarNfesEstoque(idLoja, {
      pendentes: req.query.pendentes === '1' || req.query.pendentes === 'true',
      conferir: req.query.conferir === '1' || req.query.conferir === 'true',
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.get('/nfes/:id', permOp, async (req, res, next) => {
  try {
    const det = await obterNfeDetalhe(Number(req.params.id));
    if (!det) return res.status(404).json({ error: 'NF não encontrada' });
    const bloqueio = acessoLoja(req, det.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    res.json(det);
  } catch (e) {
    next(e);
  }
});

/** DANFE auxiliar (HTML) a partir do XML salvo no sync do fornecedor. */
router.get('/nfes/:id/danfe', permOp, async (req, res, next) => {
  try {
    const idNfe = Number(req.params.id);
    const { rows } = await pool.query(
      `SELECT id_nfe, id_loja, numero, chave, xml_path FROM estoque_nfe WHERE id_nfe = $1`,
      [idNfe],
    );
    if (!rows.length) return res.status(404).json({ error: 'NF não encontrada' });
    const nfe = rows[0];
    const bloqueio = acessoLoja(req, nfe.id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const xmlPath = nfe.xml_path ? String(nfe.xml_path).trim() : '';
    if (!xmlPath) {
      return res.status(404).json({ error: 'XML da NF não está disponível nesta loja' });
    }

    let html;
    try {
      const raw = await fs.readFile(xmlPath, 'utf8');
      if (/\.json$/i.test(xmlPath) || raw.trimStart().startsWith('{')) {
        const j = JSON.parse(raw);
        const det = await obterNfeDetalhe(idNfe);
        html = renderDanfeHtml({
          chave: j.chave || nfe.chave || '',
          numero: j.numero || nfe.numero || '',
          serie: j.serie || '',
          emissao: j.emissao || null,
          data_saida: j.data_saida || null,
          valor_total: j.valor_total ?? null,
          emitente: j.emitente || {
            cnpj: '',
            nome: det?.emitente_nome || 'Coca-Cola / Brasal',
          },
          destinatario: j.destinatario || { cnpj: '', nome: '' },
          itens: (det?.itens || []).map((it, idx) => ({
            nItem: it.n_item ?? idx + 1,
            codigo: it.codigo_nf || '',
            descricao: it.descricao || '',
            qCom: it.q_com ?? it.qtd_estoque ?? 0,
            uCom: it.u_com || it.unidade_contagem || '',
            vUnCom: it.v_un_com ?? null,
            vProd: it.v_prod ?? null,
          })),
        });
      } else {
        html = renderDanfeHtml(parseNfeXml(raw));
      }
    } catch (e) {
      // Fallback: monta DANFE com o que já está no banco
      const det = await obterNfeDetalhe(idNfe);
      if (!det) throw e;
      html = renderDanfeHtml({
        chave: det.chave || nfe.chave || '',
        numero: det.numero || '',
        serie: det.serie || '',
        emissao: det.emissao,
        data_saida: det.data_saida,
        valor_total: det.valor_total,
        emitente: { cnpj: det.emitente_cnpj || '', nome: det.emitente_nome || '' },
        destinatario: { cnpj: '', nome: '' },
        itens: (det.itens || []).map((it, idx) => ({
          nItem: it.n_item ?? idx + 1,
          codigo: it.codigo_nf || '',
          descricao: it.descricao || '',
          qCom: it.q_com ?? it.qtd_estoque ?? 0,
          uCom: it.u_com || it.unidade_contagem || '',
          vUnCom: it.v_un_com ?? null,
          vProd: it.v_prod ?? null,
        })),
      });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(html);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.post('/nfes/:id/conferir', permOp, async (req, res, next) => {
  try {
    const idNfe = Number(req.params.id);
    const { rows } = await pool.query(`SELECT id_loja FROM estoque_nfe WHERE id_nfe = $1`, [idNfe]);
    if (!rows.length) return res.status(404).json({ error: 'NF n├úo encontrada' });
    const bloqueio = acessoLoja(req, rows[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const result = await conferirRecebimentoNfe({
      id_nfe: idNfe,
      itens: Array.isArray(req.body?.itens) ? req.body.itens : null,
      confirmar_todos: !!req.body?.confirmar_todos,
      criado_por: userId(req),
    });

    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'estoque_nfe_conferencia',
      entidade_id: idNfe,
      descricao: `Conferiu NF #${idNfe} ┬À entrega ${result.data_entrega} ┬À ${result.status_entrega}`,
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.post('/nfes/:id/entrar', permOp, async (req, res, next) => {
  try {
    const idNfe = Number(req.params.id);
    const { rows } = await pool.query(`SELECT id_loja FROM estoque_nfe WHERE id_nfe = $1`, [idNfe]);
    if (!rows.length) return res.status(404).json({ error: 'NF n├úo encontrada' });
    const bloqueio = acessoLoja(req, rows[0].id_loja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const result = await confirmarEntradaNfe({
      id_nfe: idNfe,
      data_entrega: req.body?.data_entrega,
      criado_por: userId(req),
      forcar: !!req.body?.forcar,
    });

    await auditar(req, {
      modulo: 'estoque',
      acao: 'criar',
      entidade: 'estoque_nfe_entrada',
      entidade_id: idNfe,
      descricao: `Entrada NF #${idNfe} com data_entrega ${result.data_entrega} (emissao ${result.emissao || 'ÔÇö'})`,
    });
    res.status(201).json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.get('/disciplina', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.query.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });
    const result = await statusDisciplinaEstoque(idLoja);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post('/fechamento', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const row = await fecharMesEstoque({
      id_loja: idLoja,
      ano_mes: req.body?.ano_mes,
      criado_por: userId(req),
      observacao: req.body?.observacao || null,
      forcar: !!req.body?.forcar,
    });
    await auditar(req, {
      modulo: 'estoque',
      acao: 'atualizar',
      entidade: 'estoque_fechamento',
      entidade_id: row.id_fechamento,
      descricao: `Fechou CMV ${row.ano_mes} loja ${idLoja}`,
    });
    res.json(row);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

router.post('/fechamento/reabrir', permOp, async (req, res, next) => {
  try {
    const idLoja = parseIdLoja(req.body?.id_loja);
    const bloqueio = acessoLoja(req, idLoja);
    if (bloqueio) return res.status(bloqueio.status).json({ error: bloqueio.error });

    const row = await reabrirMesEstoque({
      id_loja: idLoja,
      ano_mes: req.body?.ano_mes,
      criado_por: userId(req),
    });
    await auditar(req, {
      modulo: 'estoque',
      acao: 'atualizar',
      entidade: 'estoque_fechamento',
      entidade_id: row.id_fechamento,
      descricao: `Reabriu CMV ${row.ano_mes} loja ${idLoja}`,
    });
    res.json(row);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    next(e);
  }
});

export default router;
