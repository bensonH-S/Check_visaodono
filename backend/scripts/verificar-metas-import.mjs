/**
 * Confere períodos importados vs expectativa mínima.
 * Uso: node backend/scripts/verificar-metas-import.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
});

const PDFS = [
  { mes: 2, path: 'f:\\Users\\benson\\OneDrive\\Desktop\\metas fevereiro.pdf' },
  { mes: 3, path: 'f:\\Users\\benson\\OneDrive\\Desktop\\metas março.pdf' },
  { mes: 4, path: 'f:\\Users\\benson\\OneDrive\\Desktop\\metas abril.pdf' },
  { mes: 5, path: 'f:\\Users\\benson\\OneDrive\\Desktop\\metas maio.pdf' },
];

function parsePdf(pdfPath) {
  const helper = path.join(path.dirname(fileURLToPath(import.meta.url)), '_parse_metas_pdf.py');
  const r = spawnSync('python', [helper, pdfPath], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return JSON.parse(r.stdout)[0];
}

function statsPdf(periodo) {
  let celulas = 0;
  let ok = 0;
  let x = 0;
  for (const p of periodo.paineis) {
    for (const ind of p.indicadores) {
      for (const c of ind.celulas) {
        if (!c) continue;
        celulas += 1;
        if (c === 'OK') ok += 1;
        if (c === 'X') x += 1;
      }
    }
  }
  return { paineis: periodo.paineis.length, celulas, ok, x };
}

let erros = 0;

try {
  for (const { mes, path: pdfPath } of PDFS) {
    const pdf = parsePdf(pdfPath);
    const esperado = statsPdf(pdf);

    const { rows: per } = await pool.query(
      `SELECT id_periodo, titulo FROM metas_periodos WHERE ano = 2026 AND mes = $1`,
      [mes],
    );
    if (!per[0]) {
      console.log(`❌ Mês ${mes}: período não encontrado no banco`);
      erros += 1;
      continue;
    }
    const id = per[0].id_periodo;

    const { rows: paineis } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM metas_paineis WHERE id_periodo = $1`,
      [id],
    );
    const { rows: realizados } = await pool.query(
      `SELECT valor_texto, COUNT(*)::int AS n
       FROM metas_realizados WHERE id_periodo = $1
       GROUP BY valor_texto`,
      [id],
    );
    const { rows: lojasSemId } = await pool.query(
      `SELECT COUNT(*)::int AS n FROM metas_painel_lojas pl
       JOIN metas_paineis mp ON mp.id_painel = pl.id_painel
       WHERE mp.id_periodo = $1 AND pl.id_loja IS NULL`,
      [id],
    );

    const dbOk = realizados.find((r) => r.valor_texto === 'OK')?.n ?? 0;
    const dbX = realizados.find((r) => r.valor_texto === 'X')?.n ?? 0;
    const dbTotal = dbOk + dbX;

    const nome = per[0].titulo;
    console.log(`\n=== ${nome} ===`);
    console.log(`  Painéis: PDF ${esperado.paineis} | DB ${paineis[0].n} ${paineis[0].n === esperado.paineis ? '✓' : '❌'}`);
    console.log(`  Células OK+X: PDF ${esperado.celulas} (OK ${esperado.ok}, X ${esperado.x}) | DB ${dbTotal} (OK ${dbOk}, X ${dbX}) ${dbTotal === esperado.celulas ? '✓' : '❌'}`);
    console.log(`  Lojas sem vínculo: ${lojasSemId[0].n} ${lojasSemId[0].n === 0 ? '✓' : '⚠'}`);

    if (paineis[0].n !== esperado.paineis) erros += 1;
    if (dbTotal !== esperado.celulas) erros += 1;
    if (lojasSemId[0].n > 0) erros += 1;
  }

  // Spot-check fevereiro empresa G1 BK LAGO CMP=OK
  const { rows: spot } = await pool.query(
    `SELECT r.valor_texto, pl.rotulo_curto
     FROM metas_realizados r
     JOIN metas_paineis mp ON mp.id_painel = r.id_painel
     JOIN metas_painel_indicadores pi ON pi.id_painel = r.id_painel AND pi.id_indicador = r.id_indicador
     JOIN metas_indicadores i ON i.id_indicador = r.id_indicador
     JOIN metas_painel_lojas pl ON pl.id_painel = r.id_painel AND pl.id_loja = r.id_loja
     JOIN metas_periodos p ON p.id_periodo = mp.id_periodo
     WHERE p.ano = 2026 AND p.mes = 2 AND mp.codigo = 'empresa_grupo1'
       AND i.codigo = 'cmp_paga' AND pl.rotulo_curto = 'BK LAGO'`,
  );
  const cmpLago = spot[0]?.valor_texto;
  console.log(`\n=== Amostra (Fev/empresa G1, BK LAGO, CMP) ===`);
  console.log(`  Esperado: OK | Banco: ${cmpLago ?? '—'} ${cmpLago === 'OK' ? '✓' : '❌'}`);
  if (cmpLago !== 'OK') erros += 1;

  console.log(erros === 0 ? '\n✅ Conferência OK — dados batem com os PDFs.' : `\n⚠ ${erros} divergência(s) encontrada(s).`);
  process.exit(erros === 0 ? 0 : 1);
} catch (e) {
  console.error('Falha:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
