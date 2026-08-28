/**
 * Compara totais de venda por origem e por dia (diagnóstico vs BK Office).
 *
 *   node backend/scripts/diagnosticar-venda-loja.mjs --loja=21 --db=prod
 *   node backend/scripts/diagnosticar-venda-loja.mjs --bkn=19929 --de=2026-08-01
 */
import { pool } from '../src/db.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
  }),
);

const de = String(args.de || '2026-08-01').slice(0, 10);
const ate = String(args.ate || new Date().toISOString().slice(0, 10)).slice(0, 10);

async function main() {
  let idLoja = Number(args.loja);
  if (!idLoja && args.bkn) {
    const { rows } = await pool.query(
      `SELECT id_loja, name, bk_number FROM lojas WHERE bk_number = $1 OR bk_number::text = $1 LIMIT 1`,
      [String(args.bkn).trim()],
    );
    if (!rows.length) throw new Error(`Loja BKN ${args.bkn} não encontrada`);
    idLoja = rows[0].id_loja;
    console.log(`Loja: ${rows[0].name} (id=${idLoja}, BKN ${rows[0].bk_number})`);
  }
  if (!idLoja) throw new Error('Informe --loja= ou --bkn=');

  const { rows: porOrigem } = await pool.query(
    `
    SELECT v.origem,
           COUNT(DISTINCT v.data_venda)::int AS dias,
           COALESCE(SUM(vi.venda_liquida), 0)::numeric AS venda
    FROM estoque_vendas v
    JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
    WHERE v.id_loja = $1
      AND v.data_venda >= $2::date AND v.data_venda <= $3::date
    GROUP BY v.origem
    ORDER BY v.origem
    `,
    [idLoja, de, ate],
  );

  const { rows: porDia } = await pool.query(
    `
    SELECT v.data_venda::text AS dia,
           COALESCE(SUM(vi.venda_liquida), 0)::numeric AS venda_bkoffice
    FROM estoque_vendas v
    JOIN estoque_venda_itens vi ON vi.id_venda = v.id_venda
    WHERE v.id_loja = $1 AND v.origem = 'bkoffice'
      AND v.data_venda >= $2::date AND v.data_venda <= $3::date
    GROUP BY v.data_venda
    ORDER BY v.data_venda DESC
    LIMIT 10
    `,
    [idLoja, de, ate],
  );

  const totalBk = porOrigem
    .filter((r) => r.origem === 'bkoffice')
    .reduce((a, r) => a + Number(r.venda), 0);

  console.log(`\nPeríodo ${de} → ${ate}\n`);
  console.log('Por origem:');
  for (const r of porOrigem) {
    console.log(`  ${r.origem.padEnd(10)} dias=${r.dias}  venda=R$ ${Number(r.venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  console.log(`\nTotal bkoffice: R$ ${totalBk.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log('(Compare com a coluna Bruto no painel BK Office)\n');
  console.log('Últimos dias (bkoffice):');
  for (const r of porDia) {
    console.log(`  ${r.dia}  R$ ${Number(r.venda_bkoffice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  if (porOrigem.some((r) => r.origem !== 'bkoffice' && Number(r.venda) > 0)) {
    console.log('\n⚠ Há vendas upload/manual somadas — após deploy só conta bkoffice na tela.');
  }
}

main()
  .catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  })
  .finally(() => pool.end());
