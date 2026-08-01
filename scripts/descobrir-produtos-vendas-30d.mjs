/**
 * Puxa vendas BK Office (últimos N dias) da loja 706/7 em um único relatório
 * "Restaurante e Produto Venda" (sem agrupar por dia), cadastra SKUs novos
 * e lista o que falta ficha técnica — priorizado por volume.
 *
 *   node scripts/descobrir-produtos-vendas-30d.mjs
 *   node scripts/descobrir-produtos-vendas-30d.mjs --dias=30
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import pg from 'pg';
import fs from 'fs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });
process.env.NODE_ENV = 'development';
process.env.BKOFFICE_HEADLESS = '0';

const LOJA = 7;
const dias = Number((process.argv.find((a) => a.startsWith('--dias=')) || '--dias=30').slice(7)) || 30;

function isoBR(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}
function addDaysISO(iso, delta) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

const data_fim = isoBR(new Date());
const data_inicio = addDaysISO(data_fim, -(dias - 1));

console.log(`Loja ${LOJA} | ${data_inicio} → ${data_fim} (${dias} dias)`);
console.log('Relatório: Restaurante e Produto Venda (agregado no período)');
console.log('Chrome vai abrir — aguarde o Excel...\n');

const { syncVendasBkOffice } = await import(
  pathToFileURL(path.join(root, 'backend/src/services/bkoffice/syncVendas.js')).href
);

const sync = await syncVendasBkOffice({
  id_loja: LOJA,
  data_inicio,
  data_fim,
  processar: false,
  agruparPorDia: false,
});
console.log('Sync OK:', { linhas: sync.linhas, dias_import: sync.importResult?.dias });

const c = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: 'vision_check_dev',
  port: Number(process.env.DB_PORT || 5432),
});
await c.connect();

const resumo = await c.query(
  `
  WITH vendidos AS (
    SELECT i.codigo, MAX(i.descricao) AS descricao,
           SUM(i.qtde)::numeric AS qtde_periodo
    FROM estoque_venda_itens i
    JOIN estoque_vendas v ON v.id_venda = i.id_venda
    WHERE v.id_loja = $1
      AND v.data_venda >= $2::date
      AND v.data_venda <= $3::date
    GROUP BY i.codigo
  )
  SELECT
    vd.codigo,
    COALESCE(p.descricao, vd.descricao) AS descricao,
    vd.qtde_periodo,
    CASE
      WHEN p.id_produto IS NULL THEN 'novo_nao_cadastrado'
      WHEN NOT EXISTS (
        SELECT 1 FROM ficha_tecnica ft
        WHERE ft.id_produto = p.id_produto AND ft.ativo
          AND EXISTS (SELECT 1 FROM ficha_tecnica_itens x WHERE x.id_ficha = ft.id_ficha)
      ) THEN 'cadastrado_sem_ficha'
      ELSE 'ok_com_ficha'
    END AS status,
    (p.criado_em >= NOW() - INTERVAL '1 day') AS novo_hoje
  FROM vendidos vd
  LEFT JOIN produtos p ON p.id_loja = $1 AND p.codigo = vd.codigo AND p.ativo
  ORDER BY
    CASE
      WHEN p.id_produto IS NULL THEN 0
      WHEN NOT EXISTS (
        SELECT 1 FROM ficha_tecnica ft
        WHERE ft.id_produto = p.id_produto AND ft.ativo
          AND EXISTS (SELECT 1 FROM ficha_tecnica_itens x WHERE x.id_ficha = ft.id_ficha)
      ) THEN 1 ELSE 2
    END,
    vd.qtde_periodo DESC
  `,
  [LOJA, data_inicio, data_fim],
);

const por = { novo_nao_cadastrado: [], cadastrado_sem_ficha: [], ok_com_ficha: [] };
for (const r of resumo.rows) por[r.status]?.push(r);

const catAntesVs = {
  skus_vendidos: resumo.rows.length,
  ok_com_ficha: por.ok_com_ficha.length,
  sem_ficha: por.cadastrado_sem_ficha.length,
  novos_sem_cadastro: por.novo_nao_cadastrado.length,
  novos_hoje: por.cadastrado_sem_ficha.filter((r) => r.novo_hoje).length
    + por.ok_com_ficha.filter((r) => r.novo_hoje).length,
};

console.log('\n========== COMPARATIVO BASE vs VENDAS 30d ==========');
console.log(catAntesVs);

console.log('\n--- FALTAM FICHA (montar agora) — por volume ---');
console.table(
  por.cadastrado_sem_ficha.map((r) => ({
    codigo: r.codigo,
    descricao: r.descricao,
    qtde_30d: Number(r.qtde_periodo),
    novo: Boolean(r.novo_hoje),
  })),
);

const cat = await c.query(
  `SELECT COUNT(*)::int AS produtos,
          (SELECT COUNT(*)::int FROM ficha_tecnica ft
             JOIN produtos p ON p.id_produto = ft.id_produto
            WHERE p.id_loja = $1 AND ft.ativo) AS fichas
   FROM produtos WHERE id_loja = $1 AND ativo`,
  [LOJA],
);
console.log('\nCatálogo loja 7 agora:', cat.rows[0]);

const outDir = path.join(root, 'Logs');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `produtos-faltando-ficha-loja7-${data_fim}.json`);
fs.writeFileSync(
  outFile,
  JSON.stringify(
    {
      loja: LOJA,
      periodo: { data_inicio, data_fim, dias },
      sync: { linhas: sync.linhas },
      resumo: catAntesVs,
      sem_ficha: por.cadastrado_sem_ficha,
      catalogo: cat.rows[0],
    },
    null,
    2,
  ),
);
console.log('Relatório JSON:', outFile);

await c.end();
process.exit(0);
