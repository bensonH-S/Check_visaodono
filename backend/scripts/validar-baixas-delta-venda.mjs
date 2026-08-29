/**
 * Valida que re-sync do dia NÃO rebaixa o estoque inteiro — só delta.
 *
 * Fluxo:
 *   1) Snapshot (saldos + movimentos venda do dia)
 *   2) Sync loja (opcional --sync)
 *   3) Snapshot
 *   4) Sync de novo (--sync-2x)
 *   5) Snapshot final
 *
 * Esperado no 2º sync (sem venda nova no BK):
 *   - poucos/zero movimentos novos tipo venda
 *   - saldos estáveis (Δ ≈ 0)
 *
 *   node backend/scripts/validar-baixas-delta-venda.mjs --loja=12 --db=prod --sync-2x
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};
const idLoja = Number(getArg('--loja', '12'));
const dbFlag = getArg('--db', 'prod');
const doSync = args.includes('--sync') || args.includes('--sync-2x');
const doSync2x = args.includes('--sync-2x');

if (dbFlag === 'prod') {
  process.env.DB_NAME = process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check';
}

function hojeBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const { pool } = await import('../src/db.js');

async function snapshot(label) {
  const dia = hojeBR();
  const { rows: loja } = await pool.query(
    `SELECT id_loja, name, bk_number FROM lojas WHERE id_loja = $1`,
    [idLoja],
  );
  const { rows: venda } = await pool.query(
    `SELECT id_venda, status, data_venda, criado_em, processado_em
     FROM estoque_vendas
     WHERE id_loja = $1 AND data_venda = $2::date AND origem = 'bkoffice'
     LIMIT 1`,
    [idLoja, dia],
  );
  const idVenda = venda[0]?.id_venda || null;

  let itens = { total: 0, processados: 0, pendentes: 0, qtde_sum: 0 };
  if (idVenda) {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE processado)::int AS processados,
         COUNT(*) FILTER (WHERE NOT processado)::int AS pendentes,
         COALESCE(SUM(qtde),0)::float AS qtde_sum
       FROM estoque_venda_itens WHERE id_venda = $1`,
      [idVenda],
    );
    itens = rows[0];
  }

  const { rows: movs } = await pool.query(
    `SELECT COUNT(*)::int AS n, COALESCE(SUM(ABS(quantidade)),0)::float AS qtde_abs
     FROM estoque_movimentos
     WHERE id_loja = $1
       AND tipo = 'venda'
       AND criado_em::date = $2::date`,
    [idLoja, dia],
  );

  // Top insumos por |saldo| na loja (amostra)
  let saldos = [];
  {
    const { rows } = await pool.query(
      `SELECT i.codigo, i.descricao, s.quantidade::float AS saldo
       FROM estoque_saldos s
       JOIN insumos i ON i.id_insumo = s.id_insumo
       WHERE s.id_loja = $1
       ORDER BY ABS(s.quantidade) DESC NULLS LAST
       LIMIT 8`,
      [idLoja],
    );
    saldos = rows;
  }

  const snap = {
    label,
    em: new Date().toISOString(),
    dia,
    loja: loja[0] || null,
    venda: venda[0] || null,
    itens,
    movimentos_venda_hoje: movs[0],
    saldos_amostra: saldos,
  };
  console.log('\n=== SNAPSHOT', label, '===');
  console.log(JSON.stringify(snap, null, 2));
  return snap;
}

function diffSnaps(a, b) {
  const dMov = (b.movimentos_venda_hoje?.n || 0) - (a.movimentos_venda_hoje?.n || 0);
  const dQ = (b.itens?.qtde_sum || 0) - (a.itens?.qtde_sum || 0);
  const saldosMap = new Map((a.saldos_amostra || []).map((s) => [s.codigo, s.saldo]));
  const deltasSaldo = (b.saldos_amostra || []).map((s) => ({
    codigo: s.codigo,
    antes: saldosMap.get(s.codigo),
    depois: s.saldo,
    delta: saldosMap.has(s.codigo) ? Number((s.saldo - saldosMap.get(s.codigo)).toFixed(4)) : null,
  }));
  return { novos_movimentos_venda: dMov, delta_qtde_venda: Number(dQ.toFixed(4)), deltasSaldo };
}

async function syncOnce() {
  const dia = hojeBR();
  console.log(`\n>>> SYNC loja ${idLoja} ${dia}`);
  const { syncVendasBkOffice } = await import('../src/services/bkoffice/syncVendas.js');
  const r = await syncVendasBkOffice({
    id_loja: idLoja,
    data_inicio: dia,
    data_fim: dia,
    processar: true,
  });
  console.log('<<< SYNC OK', { linhas: r.linhas, duracao_ms: r.duracao_ms, id_job: r.id_job });
  return r;
}

try {
  const s0 = await snapshot('ANTES');
  if (!doSync) {
    console.log('\nSó snapshot. Para testar delta:');
    console.log(`  node backend/scripts/validar-baixas-delta-venda.mjs --loja=${idLoja} --db=prod --sync-2x`);
    process.exit(0);
  }

  await syncOnce();
  const s1 = await snapshot('DEPOIS_1o_SYNC');
  const d1 = diffSnaps(s0, s1);
  console.log('\n=== DIFF 0→1 ===');
  console.log(JSON.stringify(d1, null, 2));

  if (doSync2x) {
    console.log('\nAguardando 3s antes do 2º sync…');
    await new Promise((r) => setTimeout(r, 3000));
    await syncOnce();
    const s2 = await snapshot('DEPOIS_2o_SYNC');
    const d2 = diffSnaps(s1, s2);
    console.log('\n=== DIFF 1→2 (deve ser ~zero se BK não vendeu no intervalo) ===');
    console.log(JSON.stringify(d2, null, 2));

    const ok =
      d2.novos_movimentos_venda === 0 &&
      Math.abs(d2.delta_qtde_venda) < 0.0001 &&
      d2.deltasSaldo.every((x) => x.delta == null || Math.abs(x.delta) < 0.0001);

    if (ok) {
      console.log('\n✅ VALIDADO: 2º sync não gerou baixa repetida nem mudou saldos da amostra.');
      process.exit(0);
    }
    if (d2.novos_movimentos_venda > 0 || d2.deltasSaldo.some((x) => x.delta && Math.abs(x.delta) > 0.0001)) {
      // Pode ser venda real nova no BK entre syncs
      console.log(
        '\n⚠️ Houve mudança no 2º sync. Se a loja vendeu entre os dois syncs, delta é ESPERADO.',
      );
      console.log('Se NÃO vendeu nada e mesmo assim baixou, investigue bug.');
      process.exit(2);
    }
    console.log('\n⚠️ Resultado inconclusivo — revise o DIFF.');
    process.exit(2);
  }
  process.exit(0);
} catch (e) {
  console.error('\n=== ERRO ===');
  console.error(e.message || e);
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
