/**
 * Validação operacional da Etapa 6 (fluxos + conversão canônica).
 * Banco: vision_check. Só cria/apaga Z_E6VAL_*.
 * Não altera 021403 / 35619 / 031777 nem cadastro real.
 *
 *   node scripts/validar-etapa6-operacional.mjs
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
const { MOTIVO_CONVERSAO, converterQuantidade } = await import('../src/services/estoqueConsumo.js');
const {
  lancarBreak,
  confirmarRecebimentoEmprestimo,
  obterSaldo,
} = await import('../src/services/estoqueMotor.js');

const TAG = `Z_E6VAL_${Date.now()}`;
const FATOR_CHEDDAR = 0.0115;
const results = [];
const cleanup = { idInsumos: [], idProdutos: [], idFichas: [], idBreaks: [] };
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
  const [saldos, movs, conv] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(quantidade),0)::numeric AS s
       FROM estoque_saldos`,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(quantidade),0)::numeric AS s,
              COALESCE(MAX(id_movimento),0)::bigint AS m
       FROM estoque_movimentos`,
    ),
    pool.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(fator),0)::numeric AS s
       FROM estoque_conversoes`,
    ),
  ]);
  return {
    saldos: { n: Number(saldos.rows[0].n), s: String(saldos.rows[0].s) },
    movs: {
      n: Number(movs.rows[0].n),
      s: String(movs.rows[0].s),
      m: String(movs.rows[0].m),
    },
    conv: { n: Number(conv.rows[0].n), s: String(conv.rows[0].s) },
  };
}

async function criarInsumo(idLoja, sufixo, { uc, uf, und = 1 }) {
  const { rows } = await pool.query(
    `INSERT INTO insumos (
       id_loja, codigo, descricao, unidade_contagem, unidade_fracionada,
       preco_caixa, und_convertida, und_parcial, ativo,
       permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
     ) VALUES ($1,$2,$3,$4,$5,0,$6,1,TRUE,TRUE,TRUE,TRUE)
     RETURNING id_insumo, codigo`,
    [idLoja, `${TAG}-${sufixo}`, `ETAPA6 ${sufixo}`, uc, uf, und],
  );
  cleanup.idInsumos.push(rows[0].id_insumo);
  return rows[0];
}

async function criarFator(idInsumo, orig, dest, fator) {
  await pool.query(
    `INSERT INTO estoque_conversoes
       (id_insumo, unidade_origem, unidade_destino, fator, origem_dado, status, validado_em)
     VALUES ($1,$2,$3,$4,'validacao_etapa6','validado',NOW())`,
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

async function criarProdutoFicha(idLoja, sufixo, itensFicha) {
  const { rows: pv } = await pool.query(
    `INSERT INTO produtos (id_loja, codigo, descricao, ativo, requer_ficha, atualizado_em)
     VALUES ($1,$2,$3,TRUE,TRUE,NOW())
     RETURNING id_produto, codigo`,
    [idLoja, `${TAG}-${sufixo}`, `ETAPA6 ${sufixo}`],
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
         (id_ficha, codigo_insumo, quantidade, unidade_receita, observacao)
       VALUES ($1,$2,$3,$4,$5)`,
      [f[0].id_ficha, it.codigo, it.quantidade, it.unidade, TAG],
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

async function limpar() {
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
    await pool.query(`DELETE FROM estoque_movimentos WHERE id_insumo = ANY($1::int[])`, [
      cleanup.idInsumos,
    ]);
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
}

function trackBreak(result) {
  const id = result?.break?.id_break;
  if (id) cleanup.idBreaks.push(Number(id));
  return result;
}

try {
  console.log('\n########## VALIDAÇÃO ETAPA 6 — FLUXOS OPERACIONAIS ##########');
  console.log(`Tag: ${TAG}`);

  const dbName = await pool.query('SELECT current_database() AS db');
  if (dbName.rows[0].db !== 'vision_check') {
    throw new Error(`Abortado: esperado vision_check, veio ${dbName.rows[0].db}`);
  }
  console.log(`Banco: ${dbName.rows[0].db}`);

  fpAntes = await fingerprint();
  console.log('Fingerprint antes:', JSON.stringify(fpAntes));

  const lojas = await pool.query(`
    SELECT id_loja, name, bk_number FROM lojas
    WHERE COALESCE(is_active, TRUE)
      AND bk_number IS NOT NULL
      AND TRIM(bk_number::text) <> ''
      AND name ~* 'burger king|popyes|popeyes'
    ORDER BY CASE WHEN name ILIKE '%VENANCIO%' THEN 0 ELSE 1 END, id_loja
    LIMIT 2
  `);
  if (lojas.rows.length < 2) throw new Error('Precisa de 2 lojas BK para empréstimo');
  const idLoja = Number(lojas.rows[0].id_loja);
  const idDest = Number(lojas.rows[1].id_loja);
  console.log(`Origem: ${lojas.rows[0].name} (${idLoja})  Destino: ${lojas.rows[1].name} (${idDest})`);

  const und = await criarInsumo(idLoja, 'UND', { uc: 'UND', uf: 'UND' });
  const kg = await criarInsumo(idLoja, 'KG', { uc: 'KG', uf: 'KG' });
  const lit = await criarInsumo(idLoja, 'L', { uc: 'L', uf: 'L' });
  const cheddar = await criarInsumo(idLoja, 'CHED', { uc: 'KG', uf: 'UND' });
  await criarFator(cheddar.id_insumo, 'und', 'kg', FATOR_CHEDDAR);
  const semFator = await criarInsumo(idLoja, 'NOCONV', { uc: 'KG', uf: 'UND' });
  const pao = await criarInsumo(idLoja, 'PAO', { uc: 'UND', uf: 'UND' });
  const carne = await criarInsumo(idLoja, 'CARNE', { uc: 'KG', uf: 'UND' });
  await criarFator(carne.id_insumo, 'und', 'kg', 0.113);

  const cheddarDest = await criarInsumo(idDest, 'CHED', { uc: 'KG', uf: 'UND' });
  await criarFator(cheddarDest.id_insumo, 'und', 'kg', FATOR_CHEDDAR);

  await setSaldo(idLoja, und.id_insumo, 100);
  await setSaldo(idLoja, kg.id_insumo, 100);
  await setSaldo(idLoja, lit.id_insumo, 100);
  await setSaldo(idLoja, cheddar.id_insumo, 10);
  await setSaldo(idLoja, semFator.id_insumo, 10);
  await setSaldo(idLoja, pao.id_insumo, 50);
  await setSaldo(idLoja, carne.id_insumo, 20);
  await setSaldo(idDest, cheddarDest.id_insumo, 1);

  const produto = await criarProdutoFicha(idLoja, 'WH', [
    { codigo: cheddar.codigo, quantidade: 2, unidade: 'UND' },
  ]);

  {
    const r = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_incompleto',
        turno: 'manha',
        motivo: 'teste',
        motivo_codigo: 'nivel_tempo_ret',
        itens: [{ codigo_insumo: und.codigo, quantidade: 4, unidade: 'UND' }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    const saldo = await obterSaldo(idLoja, und.id_insumo);
    record(
      '1. UND→UND',
      '-4 UND; saldo 96',
      { qtd: Number(mov[0]?.quantidade), saldo },
      mov.length === 1 && eq3(Number(mov[0].quantidade), -4) && eq3(saldo, 96),
    );
  }

  {
    const r = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_incompleto',
        turno: 'tarde',
        motivo: 'teste',
        motivo_codigo: 'nivel_tempo_ret',
        itens: [{ codigo_insumo: kg.codigo, quantidade: 3, unidade: 'KG' }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    const saldo = await obterSaldo(idLoja, kg.id_insumo);
    record(
      '2. KG→KG',
      '-3 KG; saldo 97',
      { qtd: Number(mov[0]?.quantidade), saldo },
      mov.length === 1 && eq3(Number(mov[0].quantidade), -3) && eq3(saldo, 97),
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
        itens: [{ codigo_insumo: lit.codigo, quantidade: 2, unidade: 'L' }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    const saldo = await obterSaldo(idLoja, lit.id_insumo);
    record(
      '3. L→L',
      '-2 L; saldo 98',
      { qtd: Number(mov[0]?.quantidade), saldo },
      mov.length === 1 && eq3(Number(mov[0].quantidade), -2) && eq3(saldo, 98),
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
        itens: [{ codigo_insumo: cheddar.codigo, quantidade: 2, unidade: 'UND' }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    const saldo = await obterSaldo(idLoja, cheddar.id_insumo);
    record(
      '4. UND→KG fator válido (2 UND → 0,023 KG)',
      '-0.023; saldo 9.977',
      { qtd: Number(mov[0]?.quantidade), saldo },
      mov.length === 1 &&
        almostEqual(Number(mov[0].quantidade), -0.023) &&
        almostEqual(saldo, 9.977),
    );
  }

  {
    const saldoAntes = await obterSaldo(idLoja, semFator.id_insumo);
    const movAntes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM estoque_movimentos WHERE id_insumo = $1`,
      [semFator.id_insumo],
    );
    let err = null;
    try {
      const r = await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_incompleto',
        turno: 'manha',
        motivo: 'teste',
        motivo_codigo: 'nivel_tempo_ret',
        itens: [{ codigo_insumo: semFator.codigo, quantidade: 2, unidade: 'UND' }],
      });
      trackBreak(r);
    } catch (e) {
      err = e;
    }
    const saldoDepois = await obterSaldo(idLoja, semFator.id_insumo);
    const movDepois = await pool.query(
      `SELECT COUNT(*)::int AS n FROM estoque_movimentos WHERE id_insumo = $1`,
      [semFator.id_insumo],
    );
    record(
      '5. UND→KG sem fator bloqueia',
      '400 conversao_nao_encontrada; saldo intacto',
      { status: err?.status, motivo: err?.motivo, msg: err?.message, saldoAntes, saldoDepois },
      err?.status === 400 &&
        err.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA &&
        String(err.message).includes('UND') &&
        String(err.message).includes(semFator.codigo) &&
        eq3(saldoAntes, saldoDepois) &&
        movAntes.rows[0].n === movDepois.rows[0].n,
    );
  }

  {
    const saldoC = await obterSaldo(idLoja, cheddar.id_insumo);
    const saldoS = await obterSaldo(idLoja, semFator.id_insumo);
    const breaksAntes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM estoque_break WHERE id_loja = $1`,
      [idLoja],
    );
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
          { codigo_insumo: semFator.codigo, quantidade: 1, unidade: 'UND' },
        ],
      });
      trackBreak(r);
    } catch (e) {
      err = e;
    }
    const saldoC2 = await obterSaldo(idLoja, cheddar.id_insumo);
    const saldoS2 = await obterSaldo(idLoja, semFator.id_insumo);
    const breaksDepois = await pool.query(
      `SELECT COUNT(*)::int AS n FROM estoque_break WHERE id_loja = $1`,
      [idLoja],
    );
    record(
      '6. Multi-item inválido → rollback',
      'nenhum saldo/documento',
      {
        motivo: err?.motivo,
        saldoC,
        saldoC2,
        breaks: [breaksAntes.rows[0].n, breaksDepois.rows[0].n],
      },
      err?.motivo === MOTIVO_CONVERSAO.NAO_ENCONTRADA &&
        eq3(saldoC, saldoC2) &&
        eq3(saldoS, saldoS2) &&
        breaksAntes.rows[0].n === breaksDepois.rows[0].n,
    );
  }

  {
    const saldoAntes = await obterSaldo(idLoja, cheddar.id_insumo);
    const r = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'refeicao',
        turno: 'manha',
        colaborador_nome: 'ETAPA6 TESTE',
        itens: [{ codigo_venda: produto.codigo, quantidade: 10 }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    const saldo = await obterSaldo(idLoja, cheddar.id_insumo);
    const esperado = -0.23;
    record(
      '7. Break / expediente completo (10 × 2 UND × 0,0115)',
      '-0.230 KG cheddar',
      { tipo: r.break.tipo, qtd: Number(mov[0]?.quantidade), saldoAntes, saldo },
      r.break.tipo === 'refeicao' &&
        mov.length === 1 &&
        almostEqual(Number(mov[0].quantidade), esperado) &&
        almostEqual(saldo, saldoAntes + esperado),
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
        itens: [{ codigo_venda: produto.codigo, quantidade: 1 }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    record(
      '8. Desperdício completo',
      '-0.023 KG',
      { tipo: r.break.tipo, qtd: Number(mov[0]?.quantidade) },
      r.break.tipo === 'desperdicio_completo' &&
        mov.length === 1 &&
        almostEqual(Number(mov[0].quantidade), -0.023),
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
        itens: [
          { codigo_insumo: carne.codigo, quantidade: 3, unidade: 'UND' },
          { codigo_insumo: cheddar.codigo, quantidade: 2, unidade: 'UND' },
        ],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    const qCarne = Number(mov.find((m) => Number(m.id_insumo) === carne.id_insumo)?.quantidade);
    const qChed = Number(mov.find((m) => Number(m.id_insumo) === cheddar.id_insumo)?.quantidade);
    record(
      '9/11. Desperdício incompleto / expediente incompleto',
      'carne -0.339 KG; cheddar -0.023 KG',
      { tipo: r.break.tipo, qCarne, qChed },
      r.break.tipo === 'desperdicio_incompleto' &&
        mov.length === 2 &&
        almostEqual(qCarne, -0.339) &&
        almostEqual(qChed, -0.023),
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
        itens: [{ codigo_insumo: pao.codigo, quantidade: 4, unidade: 'UND' }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    record(
      '10. Expediente completo (ficha) + pão 4 UND',
      'ficha no teste 7; pão -4 UND',
      { qtd: Number(mov[0]?.quantidade) },
      mov.length === 1 && eq3(Number(mov[0].quantidade), -4),
    );
  }

  {
    const saldoOrigemAntes = await obterSaldo(idLoja, cheddar.id_insumo);
    const saldoDestAntes = await obterSaldo(idDest, cheddarDest.id_insumo);
    const enviado = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'emprestimo',
        id_loja_destino: idDest,
        itens: [{ codigo_insumo: cheddar.codigo, contagem_kg_und: 20 }],
      }),
    );
    const movEnv = await movimentosDoBreak(enviado.break.id_break);
    const saldoOrigemMeio = await obterSaldo(idLoja, cheddar.id_insumo);
    record(
      '12. Empréstimo enviado',
      '-0.230 KG origem',
      { qtd: Number(movEnv[0]?.quantidade), saldoOrigemAntes, saldoOrigemMeio },
      enviado.break.tipo === 'emprestimo' &&
        movEnv.length === 1 &&
        almostEqual(Number(movEnv[0].quantidade), -0.23) &&
        almostEqual(saldoOrigemMeio, saldoOrigemAntes - 0.23),
    );

    const rec = await confirmarRecebimentoEmprestimo({
      id_break: enviado.break.id_break,
      id_loja_destino: idDest,
    });
    const saldoDest = await obterSaldo(idDest, cheddarDest.id_insumo);
    record(
      '13. Empréstimo recebido',
      '+0.230 KG destino',
      { entradas: rec.entradas, saldoDestAntes, saldoDest },
      almostEqual(saldoDest, saldoDestAntes + 0.23),
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
        itens: [{ codigo_insumo: kg.codigo, quantidade: 1.7, unidade: 'KG' }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    record(
      '14. Decimal KG 1,7',
      '-1.7 KG',
      { qtd: Number(mov[0]?.quantidade) },
      mov.length === 1 && almostEqual(Number(mov[0].quantidade), -1.7),
    );
  }

  {
    const r = trackBreak(
      await lancarBreak({
        id_loja: idLoja,
        tipo: 'desperdicio_incompleto',
        turno: 'tarde',
        motivo: 'teste',
        motivo_codigo: 'nivel_tempo_ret',
        itens: [{ codigo_insumo: lit.codigo, quantidade: 0.5, unidade: 'L' }],
      }),
    );
    const mov = await movimentosDoBreak(r.break.id_break);
    record(
      '15. Decimal L 0,5',
      '-0.5 L',
      { qtd: Number(mov[0]?.quantidade) },
      mov.length === 1 && almostEqual(Number(mov[0].quantidade), -0.5),
    );
  }

  {
    const real = await pool.query(
      `SELECT i.id_insumo, i.codigo, i.descricao, i.unidade_contagem,
              COALESCE(NULLIF(BTRIM(i.unidade_fracionada), ''), i.unidade_contagem) AS unidade_fracionada
       FROM insumos i
       JOIN lojas l ON l.id_loja = i.id_loja
       WHERE i.codigo IN ('35619', '021403', '031777')
         AND i.ativo = TRUE
         AND l.name ILIKE '%VENANCIO%'
       ORDER BY i.codigo, i.id_insumo`,
    );
    const byCod = new Map();
    for (const row of real.rows) {
      if (!byCod.has(row.codigo)) byCod.set(row.codigo, row);
    }

    const ched = byCod.get('35619');
    if (ched) {
      const conv = await converterQuantidade(pool, {
        idInsumo: ched.id_insumo,
        codigo: ched.codigo,
        quantidade: 2,
        unidadeOrigem: 'UND',
        unidadeDestino: ched.unidade_contagem,
      });
      record(
        'Real Cheddar 35619 2 UND → 0,023 KG',
        '0.023',
        { ok: conv.ok, qtd: conv.quantidade, orig: conv.unidade_origem, dest: conv.unidade_destino },
        conv.ok && almostEqual(conv.quantidade, 0.023),
      );
    } else {
      record('Real Cheddar 35619', 'encontrado na Venâncio', 'ausente', false);
    }

    for (const cod of ['021403', '031777']) {
      const ins = byCod.get(cod);
      if (ins) {
        const conv = await converterQuantidade(pool, {
          idInsumo: ins.id_insumo,
          codigo: ins.codigo,
          quantidade: 10,
          unidadeOrigem: ins.unidade_fracionada || 'UND',
          unidadeDestino: ins.unidade_contagem,
        });
        record(
          `Real ${cod} 10 ${ins.unidade_fracionada} → ${ins.unidade_contagem}`,
          'ok com fator validado ou identidade',
          { ok: conv.ok, qtd: conv.quantidade, motivo: conv.motivo, fator: conv.fatorAplicado },
          conv.ok === true,
        );
      } else {
        const ficha = await pool.query(
          `SELECT fi.codigo_insumo, fi.quantidade, fi.unidade_receita, i.id_insumo,
                  i.unidade_contagem, i.codigo
           FROM produtos p
           JOIN ficha_tecnica f ON f.id_produto = p.id_produto AND f.ativo
           JOIN ficha_tecnica_itens fi ON fi.id_ficha = f.id_ficha
           JOIN insumos i ON i.id_loja = p.id_loja AND i.codigo = fi.codigo_insumo AND i.ativo
           JOIN lojas l ON l.id_loja = p.id_loja
           WHERE p.codigo = $1 AND p.ativo AND l.name ILIKE '%VENANCIO%'
           ORDER BY fi.codigo_insumo
           LIMIT 8`,
          [cod],
        );
        let okAll = ficha.rows.length > 0;
        const detalhe = [];
        for (const it of ficha.rows) {
          const conv = await converterQuantidade(pool, {
            idInsumo: it.id_insumo,
            codigo: it.codigo,
            quantidade: Number(it.quantidade) * (cod === '021403' ? 10 : 1),
            unidadeOrigem: it.unidade_receita || 'UND',
            unidadeDestino: it.unidade_contagem,
          });
          detalhe.push({
            insumo: it.codigo,
            ok: conv.ok,
            qtd: conv.quantidade,
            motivo: conv.motivo,
          });
          if (!conv.ok) okAll = false;
        }
        record(
          `Real ${cod} via ficha (read-only)`,
          'todas as conversões da ficha ok',
          { n: ficha.rows.length, detalhe },
          okAll,
        );
      }
    }
  }
} catch (e) {
  console.error('\nERRO:', e);
  record('execucao', 'sem exceção', e.message, false);
}

try {
  await limpar();
  console.log(`\nCleanup ${TAG} concluído.`);
} catch (e) {
  console.error('Falha no cleanup:', e.message);
  record('cleanup', 'ok', e.message, false);
}

try {
  const fpDepois = await fingerprint();
  const iguais = JSON.stringify(fpAntes) === JSON.stringify(fpDepois);
  record(
    'Integridade fingerprints',
    JSON.stringify(fpAntes),
    fpDepois,
    iguais && fpAntes != null,
  );
} catch (e) {
  record('Integridade fingerprints', 'ok', e.message, false);
}

console.log('\n########## RESULTADO ETAPA 6 ##########\n');
for (const r of results) {
  console.log(`${r.teste}: ${r.status}`);
}
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.filter((r) => r.status === 'FAIL').length;
console.log(`\nTotal: ${results.length}  PASS: ${pass}  FAIL: ${fail}`);
if (fail > 0) process.exitCode = 1;

await pool.end();
