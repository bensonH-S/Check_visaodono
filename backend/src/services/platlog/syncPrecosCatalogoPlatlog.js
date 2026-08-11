/**
 * Sync de preços Platlog via catálogo Pedido do eSupri (não via NF-e).
 * Atualiza insumos.preco_caixa com custo_fonte='catalogo'.
 */
import { pool } from '../../db.js';
import { atualizarCustoInsumo } from '../estoqueMotor.js';
import { listarCatalogoPedidoEsupri } from './esupriClient.js';

function log(...a) {
  console.log('[platlog-catalogo]', ...a);
}

/** Normaliza código para casamento (remove zeros à esquerda). */
export function normalizarCodigo(cod) {
  const s = String(cod || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!s) return '';
  const semZeros = s.replace(/^0+/, '');
  return semZeros || '0';
}

function overlapDescricao(a, b) {
  const ta = String(a || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 3);
  const tb = String(b || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 3);
  if (!ta.length || !tb.length) return 0;
  const set = new Set(ta);
  return tb.filter((t) => set.has(t)).length;
}

/**
 * @param {object} opts
 * @param {number} opts.id_loja
 * @param {string} opts.user
 * @param {string} opts.pass
 * @param {boolean} [opts.aplicar=false]
 * @param {boolean} [opts.exigir_descricao=true] — só grava se descrição parecer o mesmo item
 * @param {boolean} [opts.headless=true]
 */
export async function syncPrecosCatalogoPlatlog({
  id_loja,
  user,
  pass,
  aplicar = false,
  exigir_descricao = true,
  headless = true,
  baseUrl,
} = {}) {
  const idLoja = Number(id_loja);
  if (!idLoja) throw Object.assign(new Error('id_loja obrigatório'), { status: 400 });

  const catalogo = await listarCatalogoPedidoEsupri({
    user,
    pass,
    headless,
    baseUrl,
    onLog: (...a) => log(...a),
  });

  const { rows: insumos } = await pool.query(
    `SELECT id_insumo, codigo, descricao, preco_caixa, valor_unidade, custo_fonte, ativo
     FROM insumos
     WHERE id_loja = $1 AND ativo = TRUE
     ORDER BY ordem_contagem NULLS LAST, descricao`,
    [idLoja],
  );

  const porExato = new Map();
  const porNorm = new Map();
  for (const c of catalogo) {
    const ex = String(c.codigo || '').trim().toUpperCase();
    const n = normalizarCodigo(c.codigo);
    if (ex && !porExato.has(ex)) porExato.set(ex, c);
    if (n && !porNorm.has(n)) porNorm.set(n, c);
  }

  function acharCatalogo(codigoInsumo) {
    const raw = String(codigoInsumo || '').trim().toUpperCase();
    if (!raw) return null;
    if (porExato.has(raw)) return { hit: porExato.get(raw), match: 'exato' };
    // tenta com zeros à esquerda comuns (5–6 dígitos)
    for (const len of [5, 6, 7]) {
      const padded = raw.replace(/\D/g, '').padStart(len, '0');
      if (porExato.has(padded)) return { hit: porExato.get(padded), match: 'pad' };
    }
    const n = normalizarCodigo(raw);
    if (porNorm.has(n)) return { hit: porNorm.get(n), match: 'norm' };
    return null;
  }

  const casados = [];
  const faltando = [];
  const atualizados = [];
  const semMudanca = [];
  const erros = [];
  const duvidas = [];

  for (const ins of insumos) {
    const found = acharCatalogo(ins.codigo);
    const hit = found?.hit;
    if (!hit) {
      faltando.push({
        id_insumo: ins.id_insumo,
        codigo: ins.codigo,
        descricao: ins.descricao,
        preco_caixa_atual: ins.preco_caixa != null ? Number(ins.preco_caixa) : null,
        custo_fonte: ins.custo_fonte,
      });
      continue;
    }

    const precoNovo = Number(hit.preco_caixa);
    const precoAntigo = ins.preco_caixa != null ? Number(ins.preco_caixa) : null;
    const mudou =
      precoAntigo == null || Math.abs(precoAntigo - precoNovo) > 0.0005 || ins.custo_fonte !== 'catalogo';

    const row = {
      id_insumo: ins.id_insumo,
      codigo: ins.codigo,
      descricao: ins.descricao,
      codigo_esupri: hit.codigo,
      descricao_esupri: hit.descricao,
      match: found.match,
      preco_caixa_antes: precoAntigo,
      preco_caixa_novo: precoNovo,
      unidade_esupri: hit.unidade,
    };
    const ov = overlapDescricao(ins.descricao, hit.descricao);
    row.overlap_desc = ov;
    casados.push(row);

    if (ov < 1) {
      duvidas.push(row);
      if (exigir_descricao) continue; // não aplica preço duvidoso
    }

    if (!aplicar) continue;
    if (!mudou) {
      semMudanca.push(row);
      continue;
    }
    try {
      const upd = await atualizarCustoInsumo(idLoja, {
        id_insumo: ins.id_insumo,
        preco_caixa: precoNovo,
        fonte: 'catalogo',
      });
      atualizados.push({ ...row, valor_unidade: upd.valor_unidade });
    } catch (e) {
      erros.push({ ...row, erro: e.message || String(e) });
    }
  }

  const soEsupri = catalogo.filter(
    (c) => !insumos.some((i) => normalizarCodigo(i.codigo) === normalizarCodigo(c.codigo)),
  );

  return {
    id_loja: idLoja,
    aplicar,
    catalogo_total: catalogo.length,
    insumos_total: insumos.length,
    casados,
    faltando,
    atualizados,
    sem_mudanca: semMudanca,
    erros,
    esupri_sem_insumo: soEsupri.map((c) => ({
      codigo: c.codigo,
      descricao: c.descricao,
      preco_caixa: c.preco_caixa,
    })),
    duvidas_descricao: duvidas,
  };
}
