/**
 * Etapa 8 — validação operacional final do motor de estoque.
 * Banco: vision_check. Só cria/apaga Z_E8VAL_*. Não mexe em SKU real.
 *
 *   node scripts/validar-etapa8-operacional.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const backendRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(backendRoot, '.env'), override: true });

process.env.NODE_ENV = 'production';
process.env.DB_NAME = 'vision_check';
if (!process.argv.includes('--production')) process.argv.push('--production');

const { pool } = await import('../src/db.js');
const {
  MOTIVO_CONVERSAO,
  converterQuantidade,
  aplicarConversaoUnidades,
} = await import('../src/services/estoqueConsumo.js');
const {
  lancarBreak,
  confirmarRecebimentoEmprestimo,
  obterSaldo,
  baixarPorProdutoVenda,
  processarVenda,
  registrarEntradas,
  aplicarMovimento,
  ajustarSaldoPorContagem,
} = await import('../src/services/estoqueMotor.js');
const {
  resolverQtdContagem,
  sqlFiltroItensContagem,
  validarUnidadeFracionadaCadastro,
  recomputarEstoqueContadoContagem,
} = await import('../src/services/estoqueContagem.js');

const TAG = `Z_E8VAL_${Date.now()}`;
const ID_VENANCIO = 6;
const FATOR_CHEDDAR = 0.0115;
const FATOR_WHOPPER = 0.11315789;
const results = [];
const cleanup = {
  idInsumos: [],
  idProdutos: [],
  idFichas: [],
  idBreaks: [],
  idVendas: [],
  idContagens: [],
};
let fpAntes = null;

function almostEqual(a, b, eps = 1e-4) {
  return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && Math.abs(Number(a) - Number(b)) <= eps;
}
function round3(n) {
  return Math.round(Number(n) * 1000) / 1000;
}
function eq3(a, b) {
  return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) && round3(a) === round3(b);
}
function record(nome, esperado, obtido, pass, extra = null) {
  const row = { teste: nome, esperado, obtido, status: pass ? 'PASS' : 'FAIL', extra };
  results.push(row);
  console.log(`\n[${row.status}] ${nome}`);
  console.log(`  esperado: ${esperado}`);
  console.log(`  obtido:   ${typeof obtido === 'string' ? obtido : JSON.stringify(obtido)}`);
  if (extra) console.log(`  extra:    ${typeof extra === 'string' ? extra : JSON.stringify(extra)}`);
  return pass;
}

async function fingerprint() {
  const q = async (sql) => (await pool.query(sql)).rows[0];
  const saldos = await q(
    `SELECT COUNT(*)::int n, COALESCE(SUM(quantidade),0)::numeric s FROM estoque_saldos`,
  );
  const movs = await q(
    `SELECT COUNT(*)::int n, COALESCE(SUM(quantidade),0)::numeric s, COALESCE(MAX(id_movimento),0)::bigint m
     FROM estoque_movimentos`,
  );
  const conv = await q(
    `SELECT COUNT(*)::int n, COALESCE(SUM(fator),0)::numeric s FROM estoque_conversoes`,
  );
  const cont = await q(
    `SELECT COUNT(*)::int n, COALESCE(MAX(id_contagem),0)::bigint m FROM estoque_contagens`,
  );
  const itens = await q(
    `SELECT COUNT(*)::int n, COALESCE(SUM(estoque_contado),0)::numeric s FROM estoque_itens`,
  );
  const vendas = await q(
    `SELECT COUNT(*)::int n, COALESCE(MAX(id_venda),0)::bigint m FROM estoque_vendas`,
  );
  const vItens = await q(`SELECT COUNT(*)::int n FROM estoque_venda_itens`);
  const brk = await q(
    `SELECT COUNT(*)::int n, COALESCE(MAX(id_break),0)::bigint m FROM estoque_break`,
  );
  const brkItens = await q(`SELECT COUNT(*)::int n FROM estoque_break_itens`);
  return {
    saldos: { n: Number(saldos.n), s: String(saldos.s) },
    movs: { n: Number(movs.n), s: String(movs.s), m: String(movs.m) },
    conv: { n: Number(conv.n), s: String(conv.s) },
    contagens: { n: Number(cont.n), m: String(cont.m) },
    itens: { n: Number(itens.n), s: String(itens.s) },
    vendas: { n: Number(vendas.n), m: String(vendas.m) },
    venda_itens: { n: Number(vItens.n) },
    breaks: { n: Number(brk.n), m: String(brk.m) },
    break_itens: { n: Number(brkItens.n) },
  };
}

async function criarInsumo(idLoja, sufixo, { uc, uf, und = 1, diaria = true, participa = true }) {
  const { rows } = await pool.query(
    `INSERT INTO insumos (
       id_loja, codigo, descricao, unidade_contagem, unidade_fracionada,
       preco_caixa, und_convertida, und_parcial, ativo,
       participa_contagem, contagem_diaria,
       permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
     ) VALUES ($1,$2,$3,$4,$5,0,$6,1,TRUE,$7,$8,TRUE,TRUE,TRUE)
     RETURNING id_insumo, codigo`,
    [idLoja, `${TAG}-${sufixo}`, `ETAPA8 ${sufixo}`, uc, uf, und, participa, diaria],
  );
  cleanup.idInsumos.push(rows[0].id_insumo);
  return rows[0];
}

async function criarFator(idInsumo, orig, dest, fator) {
  await pool.query(
    `INSERT INTO estoque_conversoes
       (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
     VALUES ($1,$2,$3,$4,'validacao_etapa8','validado',NOW())`,
    [idInsumo, orig, dest, fator],
  );
}

async function setSaldo(idLoja, idInsumo, qtd) {
  await pool.query(
    `INSERT INTO estoque_saldos (id_loja, id_insumo, quantidade, atualizado_em)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (id_loja, id_insumo) DO UPDATE
       SET quantidade = EXCLUDED.quantidade, atualizado_em = NOW()`,
    [idLoja, idInsumo, qtd],
  );
}

async function criarProdutoFicha(idLoja, sufixo, itensFicha, { qtdeEstoqueFake = null } = {}) {
  const { rows: pv } = await pool.query(
    `INSERT INTO produtos (id_loja, codigo, descricao, ativo, requer_ficha, atualizado_em)
     VALUES ($1,$2,$3,TRUE,TRUE,NOW())
     RETURNING id_produto, codigo`,
    [idLoja, `${TAG}-${sufixo}`, `ETAPA8 ${sufixo}`],
  );
  cleanup.idProdutos.push(pv[0].id_produto);
  const { rows: f } = await pool.query(
    `INSERT INTO ficha_tecnica (id_produto, ativo, observacao, atualizado_em)
     VALUES ($1, TRUE, $2, NOW())
     RETURNING id_ficha`,
    [pv[0].id_produto, TAG],
  );
  cleanup.idFichas.push(f[0].id_ficha);
  for (const it of itensFicha) {
    await pool.query(
      `INSERT INTO ficha_tecnica_itens
         (id_ficha, codigo_insumo, quantidade, unidade_receita, qtde_estoque, observacao)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        f[0].id_ficha,
        it.codigo,
        it.quantidade,
        it.unidade,
        qtdeEstoqueFake != null ? qtdeEstoqueFake : it.quantidade,
        TAG,
      ],
    );
  }
  return pv[0];
}

async function movimentosDoBreak(idBreak) {
  const { rows } = await pool.query(
    `SELECT id_movimento, id_insumo, tipo, quantidade, saldo_apos
     FROM estoque_movimentos
     WHERE referencia_tipo = 'estoque_break' AND referencia_id = $1
     ORDER BY id_movimento`,
    [idBreak],
  );
  return rows;
}

function trackBreak(result) {
  const id = result?.break?.id_break;
  if (id) cleanup.idBreaks.push(Number(id));
  return result;
}

async function insumoVenancio(codigo) {
  const { rows } = await pool.query(
    `SELECT id_insumo, codigo, descricao, unidade_contagem,
            COALESCE(NULLIF(BTRIM(unidade_fracionada), ''), unidade_contagem) AS unidade_fracionada,
            und_convertida, ativo, participa_contagem, contagem_diaria
     FROM insumos
     WHERE id_loja = $1 AND codigo = $2
     ORDER BY id_insumo LIMIT 1`,
    [ID_VENANCIO, codigo],
  );
  return rows[0] || null;
}

async function convUndKg(idInsumo, qtd) {
  const ins = { id_insumo: idInsumo };
  const { rows } = await pool.query(
    `SELECT unidade_contagem FROM insumos WHERE id_insumo = $1`,
    [idInsumo],
  );
  return converterQuantidade(pool, {
    idInsumo,
    quantidade: qtd,
    unidadeOrigem: 'UND',
    unidadeDestino: rows[0]?.unidade_contagem || 'KG',
  });
}

async function limpar() {
  if (cleanup.idVendas.length) {
    await pool.query(`DELETE FROM estoque_venda_itens WHERE id_venda = ANY($1::int[])`, [
      cleanup.idVendas,
    ]);
    await pool.query(`DELETE FROM estoque_vendas WHERE id_venda = ANY($1::int[])`, [
      cleanup.idVendas,
    ]);
  }
  if (cleanup.idContagens.length) {
    await pool.query(
      `DELETE FROM estoque_movimentos
       WHERE referencia_tipo = 'estoque_contagem' AND referencia_id = ANY($1::int[])`,
      [cleanup.idContagens],
    );
    await pool.query(`DELETE FROM estoque_itens WHERE id_contagem = ANY($1::int[])`, [
      cleanup.idContagens,
    ]);
    await pool.query(`DELETE FROM estoque_contagens WHERE id_contagem = ANY($1::int[])`, [
      cleanup.idContagens,
    ]);
  }
  if (cleanup.idBreaks.length) {
    await pool.query(
      `DELETE FROM estoque_movimentos
       WHERE referencia_tipo = 'estoque_break' AND referencia_id = ANY($1::int[])`,
      [cleanup.idBreaks],
    );
    await pool.query(`DELETE FROM estoque_break_itens WHERE id_break = ANY($1::int[])`, [
      cleanup.idBreaks,
    ]);
    await pool.query(`DELETE FROM estoque_break WHERE id_break = ANY($1::int[])`, [
      cleanup.idBreaks,
    ]);
  }
  if (cleanup.idInsumos.length) {
    await pool.query(
      `DELETE FROM estoque_baixa_pendencias WHERE id_insumo = ANY($1::int[])`,
      [cleanup.idInsumos],
    );
    await pool.query(
      `DELETE FROM estoque_baixa_auditoria WHERE id_insumo = ANY($1::int[])`,
      [cleanup.idInsumos],
    );
    await pool.query(
      `DELETE FROM estoque_movimentos WHERE id_insumo = ANY($1::int[]) OR observacao LIKE $2`,
      [cleanup.idInsumos, `%${TAG}%`],
    );
  }
  if (cleanup.idFichas.length) {
    await pool.query(`DELETE FROM ficha_tecnica_itens WHERE id_ficha = ANY($1::int[])`, [
      cleanup.idFichas,
    ]);
    await pool.query(`DELETE FROM ficha_tecnica WHERE id_ficha = ANY($1::int[])`, [
      cleanup.idFichas,
    ]);
  }
  if (cleanup.idProdutos.length) {
    await pool.query(`DELETE FROM produtos WHERE id_produto = ANY($1::int[])`, [
      cleanup.idProdutos,
    ]);
  }
  if (cleanup.idInsumos.length) {
    await pool.query(`DELETE FROM estoque_conversoes WHERE id_insumo = ANY($1::int[])`, [
      cleanup.idInsumos,
    ]);
    await pool.query(`DELETE FROM estoque_saldos WHERE id_insumo = ANY($1::int[])`, [
      cleanup.idInsumos,
    ]);
    await pool.query(`DELETE FROM estoque_itens WHERE id_insumo = ANY($1::int[])`, [
      cleanup.idInsumos,
    ]);
    await pool.query(`DELETE FROM insumos WHERE id_insumo = ANY($1::int[])`, [cleanup.idInsumos]);
  }
  await pool.query(`DELETE FROM insumos WHERE codigo LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM produtos WHERE codigo LIKE $1`, [`${TAG}%`]);
  await pool.query(
    `DELETE FROM estoque_venda_itens
     WHERE id_venda IN (SELECT id_venda FROM estoque_vendas WHERE arquivo_nome LIKE $1)`,
    [`${TAG}%`],
  );
  await pool.query(`DELETE FROM estoque_vendas WHERE arquivo_nome LIKE $1`, [`${TAG}%`]);
}

try {
  console.log('\n########## VALIDAÇÃO ETAPA 8 — MOTOR OPERACIONAL ##########');
  console.log(`Tag: ${TAG}`);

  const dbName = await pool.query('SELECT current_database() AS db');
  if (dbName.rows[0].db !== 'vision_check') {
    throw new Error(`Abortado: esperado vision_check, veio ${dbName.rows[0].db}`);
  }
  console.log(`Banco: ${dbName.rows[0].db}`);

  fpAntes = await fingerprint();
  console.log('Fingerprint inicial:', JSON.stringify(fpAntes));

  // --- 3. Unidade canônica ---
  {
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='estoque_saldos'`,
    );
    const names = cols.rows.map((r) => r.column_name);
    const paralelas = names.filter((c) => /saldo_kg|saldo_und|saldo_fracionado/i.test(c));
    const dup = await pool.query(
      `SELECT id_loja, id_insumo, COUNT(*)::int n
       FROM estoque_saldos GROUP BY 1,2 HAVING COUNT(*) > 1`,
    );
    record(
      'Unidade canônica: um saldo por SKU/loja',
      'sem colunas paralelas; sem duplicata',
      { cols: names, paralelas, dups: dup.rows.length },
      names.includes('quantidade') && paralelas.length === 0 && dup.rows.length === 0,
    );
  }

  // --- 4. Motor conversão (puro) ---
  {
    const id = aplicarConversaoUnidades({
      quantidade: 4,
      unidadeOrigem: 'UND',
      unidadeDestino: 'UND',
    });
    const kg = aplicarConversaoUnidades({
      quantidade: 1.7,
      unidadeOrigem: 'KG',
      unidadeDestino: 'KG',
    });
    const lit = aplicarConversaoUnidades({
      quantidade: 0.5,
      unidadeOrigem: 'L',
      unidadeDestino: 'L',
    });
    const silent = aplicarConversaoUnidades({
      quantidade: 2,
      unidadeOrigem: 'UND',
      unidadeDestino: 'KG',
    });
    record(
      'Motor: identidade UND/KG/L e sem fallback 1',
      '4; 1.7; 0.5; conversao_nao_encontrada',
      { id: id.quantidade, kg: kg.quantidade, lit: lit.quantidade, silent: silent.motivo },
      id.ok &&
        kg.ok &&
        lit.ok &&
        almostEqual(id.quantidade, 4) &&
        almostEqual(kg.quantidade, 1.7) &&
        almostEqual(lit.quantidade, 0.5) &&
        silent.ok === false &&
        silent.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA,
    );
  }

  // --- 5. SKUs reais (leitura) ---
  const specsReais = [
    { codigo: '35619', nome: 'Cheddar', qtd: 2, fator: 0.0115, esperado: 0.023, uf: 'UND', uc: 'KG' },
    { codigo: '021403', nome: 'Whopper', qtd: 10, fator: FATOR_WHOPPER, esperado: 1.1315789, uf: 'UND', uc: 'KG' },
    { codigo: '031777', nome: 'Chicken Jr', qtd: 1, fator: 0.065, esperado: 0.065 },
    { codigo: '34580', nome: 'Nuggets', qtd: 1, fator: 0.02040816, esperado: 0.02040816 },
    { codigo: '38178', nome: 'Rebel', qtd: 1, fator: 0.09836066, esperado: 0.09836066, uc: 'KG' },
  ];
  for (const spec of specsReais) {
    const ins = await insumoVenancio(spec.codigo);
    const conv = ins ? await convUndKg(ins.id_insumo, spec.qtd) : null;
    const { rows: fatorRow } = ins
      ? await pool.query(
          `SELECT fator, status FROM estoque_conversoes
           WHERE id_insumo = $1 AND LOWER(unidade_origem) IN ('und','un')
             AND LOWER(unidade_destino)='kg' LIMIT 1`,
          [ins.id_insumo],
        )
      : { rows: [] };
    const fatorOk =
      fatorRow[0]?.status === 'validado' && almostEqual(Number(fatorRow[0].fator), spec.fator, 1e-6);
    const cadOk =
      !spec.uc ||
      (String(ins?.unidade_contagem || '').toUpperCase() === spec.uc &&
        (!spec.uf || String(ins?.unidade_fracionada || '').toUpperCase() === spec.uf));
    record(
      `Real ${spec.nome} ${spec.codigo} ${spec.qtd} UND → KG`,
      `${spec.esperado}; fator ${spec.fator}`,
      {
        existe: Boolean(ins),
        uc: ins?.unidade_contagem,
        uf: ins?.unidade_fracionada,
        fator: fatorRow[0] ? Number(fatorRow[0].fator) : null,
        qtd: conv?.quantidade,
      },
      Boolean(ins) && cadOk && fatorOk && conv?.ok && almostEqual(conv.quantidade, spec.esperado, 1e-5),
    );
  }

  // --- 6. Fichas + saneamento E7 ---
  {
    const fatia3029 = await pool.query(
      `SELECT COUNT(*)::int n FROM ficha_tecnica_itens
       WHERE codigo_insumo='3029' AND LOWER(BTRIM(unidade_receita))='fatia'`,
    );
    const agua = await pool.query(
      `SELECT COUNT(*)::int n
       FROM ficha_tecnica_itens fi
       JOIN ficha_tecnica f ON f.id_ficha=fi.id_ficha
       JOIN produtos p ON p.id_produto=f.id_produto
       WHERE fi.codigo_insumo='3029' AND p.codigo='9049'`,
    );
    const remap = await pool.query(
      `SELECT COUNT(*)::int n FROM ficha_tecnica_itens
       WHERE codigo_insumo='35619' AND observacao LIKE '%etapa7: 3029→35619%'`,
    );
    const pistacheErr = await pool.query(
      `SELECT COUNT(*)::int n
       FROM ficha_tecnica_itens fi
       JOIN ficha_tecnica f ON f.id_ficha=fi.id_ficha
       JOIN produtos p ON p.id_produto=f.id_produto
       WHERE fi.codigo_insumo='38454' AND p.codigo='6005261'`,
    );
    const pistacheOk = await pool.query(
      `SELECT COUNT(*)::int n FROM ficha_tecnica_itens
       WHERE codigo_insumo='38454' AND LOWER(BTRIM(unidade_receita))='kg' AND quantidade=0.025`,
    );
    record(
      'Etapa 7 fichas (3029/35619/9049/38454)',
      'fatia 3029=0; 9049=19; remap=399; casquinha=0; pistache kg>0',
      {
        fatia3029: fatia3029.rows[0].n,
        agua: agua.rows[0].n,
        remap: remap.rows[0].n,
        pistacheErr: pistacheErr.rows[0].n,
        pistacheOk: pistacheOk.rows[0].n,
      },
      fatia3029.rows[0].n === 0 &&
        agua.rows[0].n === 19 &&
        remap.rows[0].n === 399 &&
        pistacheErr.rows[0].n === 0 &&
        pistacheOk.rows[0].n > 0,
    );

    const inexist = await pool.query(
      `SELECT COUNT(*)::int n
       FROM ficha_tecnica_itens fi
       JOIN ficha_tecnica f ON f.id_ficha=fi.id_ficha AND f.ativo
       JOIN produtos p ON p.id_produto=f.id_produto AND p.ativo AND p.id_loja=$1
       WHERE NOT EXISTS (
         SELECT 1 FROM insumos i WHERE i.id_loja=p.id_loja AND i.codigo=fi.codigo_insumo
       )`,
      [ID_VENANCIO],
    );
    const inativo = await pool.query(
      `SELECT COUNT(*)::int n
       FROM ficha_tecnica_itens fi
       JOIN ficha_tecnica f ON f.id_ficha=fi.id_ficha AND f.ativo
       JOIN produtos p ON p.id_produto=f.id_produto AND p.ativo AND p.id_loja=$1
       JOIN insumos i ON i.id_loja=p.id_loja AND i.codigo=fi.codigo_insumo
       WHERE i.ativo=FALSE`,
      [ID_VENANCIO],
    );
    const qtdRuim = await pool.query(
      `SELECT COUNT(*)::int n
       FROM ficha_tecnica_itens fi
       JOIN ficha_tecnica f ON f.id_ficha=fi.id_ficha AND f.ativo
       JOIN produtos p ON p.id_produto=f.id_produto AND p.ativo AND p.id_loja=$1
       WHERE fi.quantidade <= 0`,
      [ID_VENANCIO],
    );
    const semConv = await pool.query(
      `SELECT COUNT(*)::int n
       FROM ficha_tecnica_itens fi
       JOIN ficha_tecnica f ON f.id_ficha=fi.id_ficha AND f.ativo
       JOIN produtos p ON p.id_produto=f.id_produto AND p.ativo AND p.id_loja=$1
       JOIN insumos i ON i.id_loja=p.id_loja AND i.codigo=fi.codigo_insumo AND i.ativo
       WHERE LOWER(BTRIM(fi.unidade_receita)) NOT IN ('g','kg','l','lt')
         AND LOWER(BTRIM(fi.unidade_receita))
             IS DISTINCT FROM LOWER(BTRIM(i.unidade_contagem))
         AND NOT EXISTS (
           SELECT 1 FROM estoque_conversoes c
           WHERE c.id_insumo=i.id_insumo AND c.status='validado'
             AND (
               (LOWER(c.unidade_origem)=LOWER(BTRIM(fi.unidade_receita))
                 AND LOWER(c.unidade_destino)=LOWER(BTRIM(i.unidade_contagem)))
               OR (LOWER(BTRIM(fi.unidade_receita)) IN ('fatia','und','un')
                 AND LOWER(c.unidade_origem) IN ('und','un','fatia')
                 AND LOWER(c.unidade_destino)=LOWER(BTRIM(i.unidade_contagem)))
             )
         )
         AND NOT (
           LOWER(BTRIM(fi.unidade_receita)) IN ('g') AND LOWER(BTRIM(i.unidade_contagem))='kg'
         )`,
      [ID_VENANCIO],
    );
    console.log('\n[AUDITORIA FICHA VENÂNCIO]', {
      sku_inexistente: inexist.rows[0].n,
      insumo_inativo: inativo.rows[0].n,
      qtd_zero_neg: qtdRuim.rows[0].n,
      conv_necessaria_ausente: semConv.rows[0].n,
    });
    record(
      'Auditoria ficha Venâncio (relatório, sem auto-fix)',
      'sem quantidade <= 0; inexistente/inativo reportados',
      {
        inexistente: inexist.rows[0].n,
        inativo: inativo.rows[0].n,
        qtdRuim: qtdRuim.rows[0].n,
        semConv: semConv.rows[0].n,
      },
      qtdRuim.rows[0].n === 0,
    );
  }

  {
    const trc = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE participa_contagem)::int n_part,
              COUNT(*) FILTER (WHERE ativo)::int n_ativo
       FROM insumos WHERE codigo='TRC-OVOMALTINEBKABCX9K'`,
    );
    const ovo = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE ativo AND participa_contagem)::int n
       FROM insumos WHERE codigo='039300'`,
    );
    const molho = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE codigo='039642' AND ativo)::int a,
              COUNT(*) FILTER (WHERE codigo='35610' AND ativo)::int b,
              COUNT(*) FILTER (WHERE codigo='35610' AND participa_contagem)::int bpart
       FROM insumos WHERE codigo IN ('039642','35610')`,
    );
    const sem = await insumoVenancio('BK-SEM-0033');
    record(
      'Saneamento E7 cadastro',
      'TRC fora da contagem; 039300 operacional; molhos separados; SEM-0033 ativo fora',
      {
        trcPart: trc.rows[0].n_part,
        ovo: ovo.rows[0].n,
        molhoA: molho.rows[0].a,
        molhoB: molho.rows[0].b,
        molhoBpart: molho.rows[0].bpart,
        semAtivo: sem?.ativo,
        semPart: sem?.participa_contagem,
      },
      trc.rows[0].n_part === 0 &&
        ovo.rows[0].n > 0 &&
        molho.rows[0].a > 0 &&
        molho.rows[0].b > 0 &&
        molho.rows[0].bpart > 0 &&
        sem?.ativo === true &&
        sem?.participa_contagem === false,
    );
  }

  const lojas = await pool.query(
    `SELECT id_loja, name FROM lojas
     WHERE COALESCE(is_active, TRUE) AND bk_number IS NOT NULL AND TRIM(bk_number::text) <> ''
     ORDER BY CASE WHEN id_loja = $1 THEN 0 ELSE 1 END, id_loja
     LIMIT 2`,
    [ID_VENANCIO],
  );
  if (lojas.rows.length < 2) throw new Error('Precisa de 2 lojas BK');
  const idLoja = Number(lojas.rows[0].id_loja);
  const idDest = Number(lojas.rows[1].id_loja);
  console.log(`Origem: ${lojas.rows[0].name} (${idLoja})  Destino: ${lojas.rows[1].name} (${idDest})`);

  const und = await criarInsumo(idLoja, 'UND', { uc: 'UND', uf: 'UND' });
  const kg = await criarInsumo(idLoja, 'KG', { uc: 'KG', uf: 'KG' });
  const lit = await criarInsumo(idLoja, 'L', { uc: 'L', uf: 'L' });
  const cheddar = await criarInsumo(idLoja, 'CHED', { uc: 'KG', uf: 'UND' });
  await criarFator(cheddar.id_insumo, 'und', 'kg', FATOR_CHEDDAR);
  const carne = await criarInsumo(idLoja, 'CARNE', { uc: 'KG', uf: 'UND', und: 17.2 });
  await criarFator(carne.id_insumo, 'und', 'kg', FATOR_WHOPPER);
  const semFator = await criarInsumo(idLoja, 'NOCONV', { uc: 'KG', uf: 'UND' });
  const pao = await criarInsumo(idLoja, 'PAO', { uc: 'UND', uf: 'UND' });
  const bacon = await criarInsumo(idLoja, 'BACON', { uc: 'KG', uf: 'KG' });
  const cheddarDest = await criarInsumo(idDest, 'CHED', { uc: 'KG', uf: 'UND' });
  await criarFator(cheddarDest.id_insumo, 'und', 'kg', FATOR_CHEDDAR);
  const foraContagem = await criarInsumo(idLoja, 'FORA', {
    uc: 'UND',
    uf: 'UND',
    participa: false,
    diaria: false,
  });

  await setSaldo(idLoja, und.id_insumo, 100);
  await setSaldo(idLoja, kg.id_insumo, 100);
  await setSaldo(idLoja, lit.id_insumo, 100);
  await setSaldo(idLoja, cheddar.id_insumo, 10);
  await setSaldo(idLoja, carne.id_insumo, 20);
  await setSaldo(idLoja, semFator.id_insumo, 10);
  await setSaldo(idLoja, pao.id_insumo, 50);
  await setSaldo(idLoja, bacon.id_insumo, 5);
  await setSaldo(idDest, cheddarDest.id_insumo, 1);
  await setSaldo(idLoja, foraContagem.id_insumo, 7);

  const produtoChed = await criarProdutoFicha(
    idLoja,
    'WH',
    [{ codigo: cheddar.codigo, quantidade: 2, unidade: 'UND' }],
    { qtdeEstoqueFake: 999 },
  );
  const produtoMulti = await criarProdutoFicha(idLoja, 'COMBO', [
    { codigo: cheddar.codigo, quantidade: 2, unidade: 'UND' },
    { codigo: bacon.codigo, quantidade: 0.014, unidade: 'KG' },
    { codigo: pao.codigo, quantidade: 1, unidade: 'UND' },
  ]);
  const produtoKg = await criarProdutoFicha(idLoja, 'MOLHO', [
    { codigo: kg.codigo, quantidade: 0.05, unidade: 'KG' },
  ]);
  const produtoMixConv = await criarProdutoFicha(idLoja, 'MIXBAD', [
    { codigo: cheddar.codigo, quantidade: 2, unidade: 'UND' },
    { codigo: bacon.codigo, quantidade: 0.014, unidade: 'KG' },
    { codigo: semFator.codigo, quantidade: 1, unidade: 'UND' },
  ]);

  // KG→UND quando existe conversão (inverso)
  await criarFator(cheddar.id_insumo, 'kg', 'und', 1 / FATOR_CHEDDAR);
  {
    const r = await converterQuantidade(pool, {
      idInsumo: cheddar.id_insumo,
      quantidade: 0.023,
      unidadeOrigem: 'KG',
      unidadeDestino: 'UND',
    });
    record(
      'KG→UND com conversão válida (0,023 KG)',
      '~2 UND',
      { ok: r.ok, qtd: r.quantidade },
      r.ok && almostEqual(r.quantidade, 2, 1e-3),
    );
  }

  // --- 7. Venda ---
  {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rKg = await baixarPorProdutoVenda(client, {
        id_loja: idLoja,
        codigo_venda: produtoKg.codigo,
        quantidade: 2,
        tipo: 'venda',
        observacao: TAG,
      });
      const rUnd = await baixarPorProdutoVenda(client, {
        id_loja: idLoja,
        codigo_venda: produtoChed.codigo,
        quantidade: 1,
        tipo: 'venda',
        observacao: TAG,
      });
      const rMulti = await baixarPorProdutoVenda(client, {
        id_loja: idLoja,
        codigo_venda: produtoMulti.codigo,
        quantidade: 1,
        tipo: 'venda',
        observacao: TAG,
      });
      await client.query('COMMIT');
      const sChed = await obterSaldo(idLoja, cheddar.id_insumo);
      const sBacon = await obterSaldo(idLoja, bacon.id_insumo);
      const sPao = await obterSaldo(idLoja, pao.id_insumo);
      const sKg = await obterSaldo(idLoja, kg.id_insumo);
      record(
        'Venda: KG direto + UND→KG + múltiplos; qtde_estoque 999 ignorado',
        'cheddar -0.023 (não 999); bacon -0.014; pão -1; molho -0.10',
        {
          rKg: rKg.baixas,
          rUnd: rUnd.baixas,
          rMulti: rMulti.baixas,
          sChed,
          sBacon,
          sPao,
          sKg,
        },
        rKg.ok &&
          rUnd.ok &&
          rMulti.ok &&
          rUnd.baixas.length === 1 &&
          almostEqual(Number(rUnd.baixas[0].quantidade), -0.023) &&
          almostEqual(sChed, 10 - 0.023 - 0.023) &&
          almostEqual(sBacon, 5 - 0.014) &&
          eq3(sPao, 49) &&
          almostEqual(sKg, 99.9),
      );
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      record('Venda fixture', 'ok', e.message, false);
    } finally {
      client.release();
    }
  }

  {
    const { rows: vend } = await pool.query(
      `INSERT INTO estoque_vendas (id_loja, data_venda, origem, status, arquivo_nome)
       VALUES ($1, DATE '2099-12-31', 'manual', 'pendente', $2)
       RETURNING id_venda`,
      [idLoja, TAG],
    );
    cleanup.idVendas.push(vend[0].id_venda);
    await pool.query(
      `INSERT INTO estoque_venda_itens (id_venda, codigo, descricao, qtde, processado)
       VALUES ($1,$2,'ETAPA8 WH',1,FALSE)`,
      [vend[0].id_venda, produtoChed.codigo],
    );
    const saldoAntes = await obterSaldo(idLoja, cheddar.id_insumo);
    const proc = await processarVenda(vend[0].id_venda);
    const saldoDepois = await obterSaldo(idLoja, cheddar.id_insumo);
    record(
      'Venda processarVenda (documento)',
      'baixa -0.023 KG',
      { status: proc.status, saldoAntes, saldoDepois, delta: saldoDepois - saldoAntes },
      proc.status === 'processada' && almostEqual(saldoDepois, saldoAntes - 0.023),
    );
  }

  // --- 8/9. Break / desperdício / expediente ---
  {
    const r = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'refeicao',
        turno: 'manha',
        colaborador_nome: 'ETAPA8 TESTE',
        itens: [{ codigo_venda: produtoChed.codigo, quantidade: 1 }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    record(
      'Break / expediente completo',
      '-0.023 KG cheddar',
      { tipo: r.break.tipo, qtd: Number(mov[0]?.quantidade) },
      r.break.tipo === 'refeicao' && almostEqual(Number(mov[0]?.quantidade), -0.023),
    );
  }
  {
    const r = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_completo',
        turno: 'tarde',
        motivo: 'teste',
        motivo_codigo: 'erro_preparo',
        itens: [{ codigo_venda: produtoChed.codigo, quantidade: 1 }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    record(
      'Desperdício completo',
      '-0.023 KG',
      { qtd: Number(mov[0]?.quantidade) },
      almostEqual(Number(mov[0]?.quantidade), -0.023),
    );
  }
  {
    const r = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_incompleto',
        turno: 'noite',
        motivo: 'teste',
        motivo_codigo: 'nivel_tempo_ret',
        itens: [{ codigo_insumo: cheddar.codigo, quantidade: 2, unidade: 'UND' }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    record(
      'Desperdício incompleto 35619-like 2 UND',
      '-0.023 KG',
      { qtd: Number(mov[0]?.quantidade) },
      almostEqual(Number(mov[0]?.quantidade), -0.023),
    );
  }
  {
    const r = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_incompleto',
        turno: 'manha',
        motivo: 'teste',
        motivo_codigo: 'nivel_tempo_ret',
        itens: [
          { codigo_insumo: carne.codigo, quantidade: 1, unidade: 'UND' },
          { codigo_insumo: cheddar.codigo, quantidade: 2, unidade: 'UND' },
        ],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    const qCarne = Number(mov.find((m) => Number(m.id_insumo) === carne.id_insumo)?.quantidade);
    const qChed = Number(mov.find((m) => Number(m.id_insumo) === cheddar.id_insumo)?.quantidade);
    record(
      'Expediente incompleto: só itens informados',
      'carne ≈ -0,113 KG (3 casas do saldo); cheddar -0,023; 2 movimentos',
      { n: mov.length, qCarne, qChed },
      mov.length === 2 &&
        almostEqual(qCarne, -FATOR_WHOPPER, 5e-4) &&
        almostEqual(qChed, -0.023),
    );
  }

  // --- 10. Empréstimo ---
  {
    const sO = await obterSaldo(idLoja, cheddar.id_insumo);
    const sD = await obterSaldo(idDest, cheddarDest.id_insumo);
    const enviado = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'emprestimo',
        id_loja_destino: idDest,
        itens: [{ codigo_insumo: cheddar.codigo, contagem_kg_und: 20 }],
      }),
    );
    const movEnv = await movimentosDoBreak(enviado.break.id_break);
    await confirmarRecebimentoEmprestimo({
      id_break: enviado.break.id_break,
      id_loja_destino: idDest,
    });
    const sO2 = await obterSaldo(idLoja, cheddar.id_insumo);
    const sD2 = await obterSaldo(idDest, cheddarDest.id_insumo);
    record(
      'Empréstimo enviado/recebido 20 UND → 0,230 KG',
      '-0.230 origem; +0.230 destino',
      { env: Number(movEnv[0]?.quantidade), sO, sO2, sD, sD2 },
      almostEqual(Number(movEnv[0]?.quantidade), -0.23) &&
        almostEqual(sO2, sO - 0.23) &&
        almostEqual(sD2, sD + 0.23),
    );
  }

  // --- 11. Contagem CAIXA / PC / fracionado ---
  {
    const fatWh = {
      und_convertida: 17.2,
      unidade_contagem: 'KG',
      unidade_fracionada: 'UND',
      fator_fracionada: FATOR_WHOPPER,
      fator_fracionada_status: 'validado',
    };
    const r = resolverQtdContagem({
      contagem_caixa: 2,
      contagem_kg_und: 37,
      ...fatWh,
    });
    const esperado = Math.round((2 * 17.2 + 37 * FATOR_WHOPPER) * 10000) / 10000;
    record(
      'Contagem Whopper 2 caixas + 37 UND',
      esperado,
      { ok: r.ok, qtd: r.qtd },
      r.ok && almostEqual(r.qtd, esperado, 1e-4) && r.qtd !== 2 * 17.2 + 37,
    );
    const pc = resolverQtdContagem({
      contagem_pc_fd: 3,
      und_parcial: 2,
      unidade_contagem: 'UND',
      unidade_fracionada: 'UND',
    });
    record('Contagem PC/FD 3×2', '6', { qtd: pc.qtd }, pc.ok && eq3(pc.qtd, 6));
    const cx = resolverQtdContagem({
      contagem_caixa: 2,
      und_convertida: 10,
      unidade_contagem: 'UND',
      unidade_fracionada: 'UND',
    });
    record('Contagem CAIXA 2×10', '20', { qtd: cx.qtd }, cx.ok && eq3(cx.qtd, 20));
  }

  // GET/PUT/finalizar + snapshot
  {
    const snapInsumo = await criarInsumo(idLoja, 'SNAP', { uc: 'KG', uf: 'KG' });
    await setSaldo(idLoja, snapInsumo.id_insumo, 50);
    const { rows: cont } = await pool.query(
      `INSERT INTO estoque_contagens (id_loja, data_contagem, titulo, status, observacao, tipo)
       VALUES ($1, CURRENT_DATE, $2, 'aberta', $2, 'completa')
       RETURNING id_contagem`,
      [idLoja, TAG],
    );
    const idC = cont[0].id_contagem;
    cleanup.idContagens.push(idC);
    const { rows: item } = await pool.query(
      `INSERT INTO estoque_itens
         (id_contagem, id_insumo, estoque_sistema, estoque_contado, contagem_caixa, contagem_kg_und)
       VALUES ($1,$2,50,NULL,NULL,45)
       RETURNING id_item`,
      [idC, snapInsumo.id_insumo],
    );
    await recomputarEstoqueContadoContagem(pool, idC);
    const { rows: afterPut } = await pool.query(
      `SELECT estoque_sistema, estoque_contado FROM estoque_itens WHERE id_item=$1`,
      [item[0].id_item],
    );
    const tela = Number(afterPut[0].estoque_contado) - Number(afterPut[0].estoque_sistema);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await aplicarMovimento(client, {
        id_loja: idLoja,
        id_insumo: snapInsumo.id_insumo,
        tipo: 'venda',
        quantidade: -2,
        observacao: `${TAG} vivo 50→48`,
      });
      const vivo = await obterSaldo(idLoja, snapInsumo.id_insumo, client);
      const aj = await ajustarSaldoPorContagem(client, idC);
      const saldoFinal = await obterSaldo(idLoja, snapInsumo.id_insumo, client);
      const { rows: movAj } = await client.query(
        `SELECT quantidade FROM estoque_movimentos
         WHERE referencia_tipo='estoque_contagem' AND referencia_id=$1
         ORDER BY id_movimento DESC LIMIT 1`,
        [idC],
      );
      await client.query('COMMIT');
      record(
        'Snapshot × saldo vivo',
        'tela -5; ajuste -3; saldo 45',
        {
          tela,
          vivo,
          ajuste: Number(movAj[0]?.quantidade),
          saldoFinal,
          aj,
        },
        almostEqual(tela, -5) &&
          almostEqual(vivo, 48) &&
          almostEqual(Number(movAj[0]?.quantidade), -3) &&
          almostEqual(saldoFinal, 45),
      );
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      record('Snapshot × saldo vivo', 'ok', e.message, false);
    } finally {
      client.release();
    }
  }

  // Mensal: participa=false não entra
  {
    const filtroM = sqlFiltroItensContagem('completa');
    const { rows: c2 } = await pool.query(
      `INSERT INTO estoque_contagens (id_loja, data_contagem, titulo, status, observacao, tipo)
       VALUES ($1, CURRENT_DATE, $2, 'aberta', $2, 'completa')
       RETURNING id_contagem`,
      [idLoja, `${TAG}-M`],
    );
    cleanup.idContagens.push(c2[0].id_contagem);
    await pool.query(
      `INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
       SELECT $1, p.id_insumo, COALESCE(s.quantidade,0), NULL
       FROM insumos p
       LEFT JOIN estoque_saldos s ON s.id_insumo=p.id_insumo AND s.id_loja=p.id_loja
       WHERE p.ativo=TRUE AND p.id_loja=$2 ${filtroM}
         AND p.codigo LIKE $3`,
      [c2[0].id_contagem, idLoja, `${TAG}%`],
    );
    const { rows: presentes } = await pool.query(
      `SELECT i.codigo FROM estoque_itens ei
       JOIN insumos i ON i.id_insumo=ei.id_insumo
       WHERE ei.id_contagem=$1 ORDER BY i.codigo`,
      [c2[0].id_contagem],
    );
    const codigos = presentes.map((r) => r.codigo);
    record(
      'Contagem mensal: participa=false fora',
      'FORA ausente; CHED presente',
      codigos,
      !codigos.some((c) => c.endsWith('-FORA')) && codigos.some((c) => c.endsWith('-CHED')),
    );

    const { rows: diariaN } = await pool.query(
      `SELECT COUNT(*)::int n FROM insumos
       WHERE id_loja=$1 AND ativo AND participa_contagem AND contagem_diaria
         AND codigo NOT LIKE $2`,
      [ID_VENANCIO, `${TAG}%`],
    );
    const { rows: lojasDiaria } = await pool.query(
      `SELECT id_loja, COUNT(*)::int n FROM insumos
       WHERE ativo AND participa_contagem AND contagem_diaria
         AND codigo NOT LIKE $1
         AND id_loja IN (SELECT id_loja FROM lojas WHERE COALESCE(is_active,TRUE)
           AND bk_number IS NOT NULL AND TRIM(bk_number::text)<>'')
       GROUP BY id_loja ORDER BY id_loja`,
      [`${TAG}%`],
    );
    record(
      'Contagem diária 19 supercríticos (Venâncio)',
      '19',
      { venancio: diariaN[0].n, lojas: lojasDiaria },
      diariaN[0].n === 19,
    );
  }

  // --- 15. Atomicidade ---
  {
    const sC = await obterSaldo(idLoja, cheddar.id_insumo);
    const sB = await obterSaldo(idLoja, bacon.id_insumo);
    const sS = await obterSaldo(idLoja, semFator.id_insumo);
    const nBreakAntes = (await pool.query(`SELECT COUNT(*)::int n FROM estoque_break WHERE id_loja=$1`, [idLoja]))
      .rows[0].n;
    let err = null;
    try {
      const r = await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_incompleto',
        turno: 'manha',
        motivo: 'teste',
        motivo_codigo: 'nivel_tempo_ret',
        itens: [
          { codigo_insumo: cheddar.codigo, quantidade: 1, unidade: 'UND' },
          { codigo_insumo: bacon.codigo, quantidade: 0.1, unidade: 'KG' },
          { codigo_insumo: semFator.codigo, quantidade: 1, unidade: 'UND' },
        ],
      });
      trackBreak(r);
    } catch (e) {
      err = e;
    }
    const sC2 = await obterSaldo(idLoja, cheddar.id_insumo);
    const sB2 = await obterSaldo(idLoja, bacon.id_insumo);
    const sS2 = await obterSaldo(idLoja, semFator.id_insumo);
    const nBreakDepois = (await pool.query(`SELECT COUNT(*)::int n FROM estoque_break WHERE id_loja=$1`, [idLoja]))
      .rows[0].n;
    record(
      'Atomicidade break/expediente (A+B+C sem conv)',
      'rollback total',
      { motivo: err?.motivo, sC, sC2, nBreakAntes, nBreakDepois },
      err?.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA &&
        eq3(sC, sC2) &&
        eq3(sB, sB2) &&
        eq3(sS, sS2) &&
        nBreakAntes === nBreakDepois,
    );
  }
  {
    const client = await pool.connect();
    const sC = await obterSaldo(idLoja, cheddar.id_insumo);
    const sS = await obterSaldo(idLoja, semFator.id_insumo);
    try {
      await client.query('BEGIN');
      let err = null;
      try {
        await baixarPorProdutoVenda(client, {
          id_loja: idLoja,
          codigo_venda: produtoMixConv.codigo,
          quantidade: 1,
          tipo: 'venda',
          rigido: true,
          observacao: TAG,
        });
        await client.query('COMMIT');
      } catch (e) {
        err = e;
        await client.query('ROLLBACK');
      }
      const sC2 = await obterSaldo(idLoja, cheddar.id_insumo);
      const sS2 = await obterSaldo(idLoja, semFator.id_insumo);
      record(
        'Atomicidade venda rígida (ficha A+B+C)',
        'rollback; saldos iguais',
        { motivo: err?.motivo, sC, sC2 },
        err?.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA && eq3(sC, sC2) && eq3(sS, sS2),
      );
    } finally {
      client.release();
    }
  }

  // Contagem finalização atômica: item sem conversão
  {
    const a = await criarInsumo(idLoja, 'CTA', { uc: 'KG', uf: 'KG' });
    const b = await criarInsumo(idLoja, 'CTB', { uc: 'KG', uf: 'KG' });
    const c = await criarInsumo(idLoja, 'CTC', { uc: 'KG', uf: 'UND' });
    await setSaldo(idLoja, a.id_insumo, 1);
    await setSaldo(idLoja, b.id_insumo, 1);
    await setSaldo(idLoja, c.id_insumo, 1);
    const { rows: cc } = await pool.query(
      `INSERT INTO estoque_contagens (id_loja, data_contagem, titulo, status, observacao, tipo)
       VALUES ($1, CURRENT_DATE, $2, 'aberta', $2, 'completa') RETURNING id_contagem`,
      [idLoja, `${TAG}-AT`],
    );
    cleanup.idContagens.push(cc[0].id_contagem);
    for (const ins of [a, b]) {
      await pool.query(
        `INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado, contagem_kg_und)
         VALUES ($1,$2,1,NULL,2)`,
        [cc[0].id_contagem, ins.id_insumo],
      );
    }
    await pool.query(
      `INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado, contagem_kg_und)
       VALUES ($1,$2,1,NULL,2)`,
      [cc[0].id_contagem, c.id_insumo],
    );
    let err = null;
    try {
      await recomputarEstoqueContadoContagem(pool, cc[0].id_contagem);
    } catch (e) {
      err = e;
    }
    const sA = await obterSaldo(idLoja, a.id_insumo);
    record(
      'Atomicidade contagem (recompute) C sem conversão',
      'erro; saldo A intacto',
      { err: err?.message || err?.conversao, sA },
      Boolean(err) && eq3(sA, 1),
    );
  }

  // --- 16. Decimais ---
  {
    const rKg = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_incompleto',
        turno: 'tarde',
        motivo: 'teste',
        motivo_codigo: 'nivel_tempo_ret',
        itens: [{ codigo_insumo: kg.codigo, quantidade: 1.7, unidade: 'KG' }],
      }),
    );
    const rL = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_incompleto',
        turno: 'noite',
        motivo: 'teste',
        motivo_codigo: 'nivel_tempo_ret',
        itens: [{ codigo_insumo: lit.codigo, quantidade: 0.5, unidade: 'L' }],
      }),
    );
    const mKg = await movimentosDoBreak(rKg.break.id_break);
    const mL = await movimentosDoBreak(rL.break.id_break);
    record(
      'Decimais 1,700 KG e 0,500 L',
      '-1.7; -0.5',
      { kg: Number(mKg[0]?.quantidade), l: Number(mL[0]?.quantidade) },
      almostEqual(Number(mKg[0]?.quantidade), -1.7) && almostEqual(Number(mL[0]?.quantidade), -0.5),
    );
  }

  // --- 17. Configuração ---
  {
    const okId = await validarUnidadeFracionadaCadastro(pool, {
      unidadeFracionada: 'KG',
      unidadeContagem: 'KG',
    });
    const block = await validarUnidadeFracionadaCadastro(pool, {
      idInsumo: semFator.id_insumo,
      codigo: semFator.codigo,
      unidadeFracionada: 'UND',
      unidadeContagem: 'KG',
    });
    const okFator = await validarUnidadeFracionadaCadastro(pool, {
      idInsumo: cheddar.id_insumo,
      codigo: cheddar.codigo,
      unidadeFracionada: 'UND',
      unidadeContagem: 'KG',
    });
    record(
      'Configuração: bloqueia fracionada ≠ canônica sem fator',
      'identidade ok; NOCONV bloqueado; CHED ok',
      { okId: okId.ok, block: block.ok, blockMotivo: block.motivo, okFator: okFator.ok },
      okId.ok && block.ok === false && block.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA && okFator.ok,
    );
  }

  // --- 19. Pendência 039300 impede baixa? ---
  {
    const ovo = await insumoVenancio('039300');
    const conv = ovo
      ? await converterQuantidade(pool, {
          idInsumo: ovo.id_insumo,
          quantidade: 0.008,
          unidadeOrigem: 'kg',
          unidadeDestino: ovo.unidade_contagem,
        })
      : null;
    record(
      'Pendência 039300: ficha kg × estoque UND sem fator (não inventar)',
      'conversao_nao_encontrada — baixa bloqueada, sem fallback 1',
      { uc: ovo?.unidade_contagem, ok: conv?.ok, motivo: conv?.motivo },
      ovo &&
        String(ovo.unidade_contagem).toUpperCase() === 'UND' &&
        conv?.ok === false &&
        conv.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA,
    );
  }

  // --- 23. E2E ---
  {
    const e2e = await criarInsumo(idLoja, 'E2E', { uc: 'KG', uf: 'UND' });
    await criarFator(e2e.id_insumo, 'und', 'kg', FATOR_CHEDDAR);
    const prod = await criarProdutoFicha(idLoja, 'E2EWH', [
      { codigo: e2e.codigo, quantidade: 2, unidade: 'UND' },
    ]);
    const destE2e = await criarInsumo(idDest, 'E2E', { uc: 'KG', uf: 'UND' });
    await criarFator(destE2e.id_insumo, 'und', 'kg', FATOR_CHEDDAR);
    await setSaldo(idLoja, e2e.id_insumo, 10);
    await setSaldo(idDest, destE2e.id_insumo, 0);
    const steps = [{ ev: 'inicial', saldo: await obterSaldo(idLoja, e2e.id_insumo) }];
    await registrarEntradas({
      id_loja: idLoja,
      itens: [{ id_insumo: e2e.id_insumo, quantidade: 5 }],
      observacao: TAG,
    });
    steps.push({ ev: 'entrada+5', saldo: await obterSaldo(idLoja, e2e.id_insumo) });
    const cli = await pool.connect();
    try {
      await cli.query('BEGIN');
      await baixarPorProdutoVenda(cli, {
        id_loja: idLoja,
        codigo_venda: prod.codigo,
        quantidade: 10,
        tipo: 'venda',
        observacao: TAG,
      });
      await cli.query('COMMIT');
    } catch (e) {
      await cli.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      cli.release();
    }
    steps.push({ ev: 'venda 10×0.023', saldo: await obterSaldo(idLoja, e2e.id_insumo) });
    const br = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'refeicao',
        turno: 'tarde',
        colaborador_nome: 'ETAPA8 E2E',
        itens: [{ codigo_venda: prod.codigo, quantidade: 1 }],
      }),
    );
    steps.push({ ev: 'break -0.023', saldo: await obterSaldo(idLoja, e2e.id_insumo) });
    const emp = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'emprestimo',
        id_loja_destino: idDest,
        itens: [{ codigo_insumo: e2e.codigo, contagem_kg_und: 20 }],
      }),
    );
    await confirmarRecebimentoEmprestimo({
      id_break: emp.break.id_break,
      id_loja_destino: idDest,
    });
    steps.push({ ev: 'emprestimo -0.230', saldo: await obterSaldo(idLoja, e2e.id_insumo) });
    const esperado =
      10 + 5 - 10 * 0.023 - 0.023 - 0.23;
    const vivo = await obterSaldo(idLoja, e2e.id_insumo);
    const { rows: cE } = await pool.query(
      `INSERT INTO estoque_contagens (id_loja, data_contagem, titulo, status, observacao, tipo)
       VALUES ($1, CURRENT_DATE, $2, 'aberta', $2, 'completa') RETURNING id_contagem`,
      [idLoja, `${TAG}-E2E`],
    );
    cleanup.idContagens.push(cE[0].id_contagem);
    const contadoAlvo = Math.round((vivo - 0.1) * 1000) / 1000;
    await pool.query(
      `INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado, contagem_kg_und)
       VALUES ($1,$2,$3,$4,$4)`,
      [cE[0].id_contagem, e2e.id_insumo, vivo, contadoAlvo],
    );
    const cli2 = await pool.connect();
    try {
      await cli2.query('BEGIN');
      await ajustarSaldoPorContagem(cli2, cE[0].id_contagem);
      await cli2.query('COMMIT');
    } catch (e) {
      await cli2.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      cli2.release();
    }
    const final = await obterSaldo(idLoja, e2e.id_insumo);
    record(
      'E2E: entrada→venda→break→empréstimo→contagem',
      `vivo pré-contagem ~${esperado}; final=${contadoAlvo}`,
      { steps, vivo, esperado, final, br: br.break.id_break },
      almostEqual(vivo, esperado, 1e-3) && almostEqual(final, contadoAlvo, 1e-3),
    );
  }
} catch (e) {
  console.error('\nERRO:', e);
  record('execucao', 'sem exceção', e.message, false);
}

try {
  await limpar();
  const leftoverIns = await pool.query(`SELECT COUNT(*)::int n FROM insumos WHERE codigo LIKE $1`, [
    `${TAG}%`,
  ]);
  const leftoverProd = await pool.query(`SELECT COUNT(*)::int n FROM produtos WHERE codigo LIKE $1`, [
    `${TAG}%`,
  ]);
  const leftoverVend = await pool.query(`SELECT COUNT(*)::int n FROM estoque_vendas WHERE origem=$1`, [
    TAG,
  ]);
  const nLeft = leftoverIns.rows[0].n + leftoverProd.rows[0].n + leftoverVend.rows[0].n;
  record(
    'Cleanup fixtures',
    'zero resíduos TAG',
    { insumos: leftoverIns.rows[0].n, produtos: leftoverProd.rows[0].n, vendas: leftoverVend.rows[0].n },
    nLeft === 0,
  );
  console.log(`\nCleanup ${TAG} concluído.`);
} catch (e) {
  console.error('Falha no cleanup:', e.message);
  record('cleanup', 'ok', e.message, false);
}

try {
  const fpDepois = await fingerprint();
  const { rows: deltaMov } = await pool.query(
    `SELECT m.id_movimento, m.tipo, m.quantidade, m.observacao, m.id_loja, m.criado_em, i.codigo
     FROM estoque_movimentos m
     JOIN insumos i ON i.id_insumo=m.id_insumo
     WHERE m.id_movimento > $1
     ORDER BY m.id_movimento`,
    [fpAntes.movs.m],
  );
  const fixtureDelta = deltaMov.filter((r) => String(r.observacao || '').includes('Z_E8VAL'));
  const reais = deltaMov.filter((r) => !String(r.observacao || '').includes('Z_E8VAL'));
  console.log('\nFingerprint final:', JSON.stringify(fpDepois));
  console.log('Deltas movimento após max inicial:', deltaMov.length, 'reais:', reais.length, 'fixture leftover:', fixtureDelta.length);
  if (reais.length) console.log('Deltas reais:', JSON.stringify(reais.slice(0, 20)));
  record(
    'Fingerprint: sem resíduo de fixture',
    '0 movimentos TAG após cleanup',
    { fixtureDelta: fixtureDelta.length, reais: reais.length, fpAntes, fpDepois },
    fixtureDelta.length === 0,
  );
  record(
    'Conv/contagens históricas',
    'conv igual; max contagem <= inicial ou só se live',
    { convAntes: fpAntes.conv, convDepois: fpDepois.conv, contAntes: fpAntes.contagens, contDepois: fpDepois.contagens },
    fpAntes.conv.n === fpDepois.conv.n && fpAntes.conv.s === fpDepois.conv.s,
  );
} catch (e) {
  record('Fingerprint final', 'ok', e.message, false);
}

console.log('\n########## RESULTADO ETAPA 8 ##########\n');
for (const r of results) console.log(`${r.teste}: ${r.status}`);
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
console.log(`\nTotal: ${results.length}  PASS: ${pass}  FAIL: ${fail}`);
if (fail > 0) process.exitCode = 1;
await pool.end();
