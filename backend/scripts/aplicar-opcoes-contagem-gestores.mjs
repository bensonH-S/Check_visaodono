/**
 * Só alinha Caixa / Pc/fd / Kg/und da planilha dos gestores.
 * Não mexe em produto, seção, diária ou semanal.
 *
 *   node backend/scripts/aplicar-opcoes-contagem-gestores.mjs --dry-run --db=dev
 *   node backend/scripts/aplicar-opcoes-contagem-gestores.mjs --yes --db=prod
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const dryRun = args.includes('--dry-run');
const dbFlag = args.find((a) => a.startsWith('--db='))?.slice(5) || 'prod';
const xlsxPath =
  args.find((a) => a.startsWith('--xlsx='))?.slice(7) ||
  'F:/Users/Benson/Downloads/lista-contagem-gestores-formatada ATL.xlsx';

const DB_NAME =
  dbFlag === 'dev' ? 'vision_check_dev' : dbFlag === 'prod' ? 'vision_check' : dbFlag;

if (!yes && !dryRun) {
  console.error('Use --dry-run ou --yes');
  process.exit(1);
}

function parseSim(v) {
  const s = String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (s === 'nao' || s === 'não' || s === 'n' || s === 'false' || s === '0') return false;
  if (s === 'sim' || s === 's' || s === 'true' || s === '1') return true;
  return null;
}

const wb = XLSX.readFile(xlsxPath);
const sheet = wb.Sheets.Todos || wb.Sheets[wb.SheetNames[0]];
const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
const porCodigo = new Map();
for (const r of linhas) {
  const codigo = String(r.Codigo || r.codigo || '').trim();
  if (!codigo) continue;
  const caixa = parseSim(r.Caixa ?? r.caixa);
  const pc = parseSim(r['Pc/fd'] ?? r['PC/FD'] ?? r.pc_fd);
  const kg = parseSim(r['Kg/und'] ?? r['KG/UND'] ?? r.kg_und);
  if (caixa == null || pc == null || kg == null) {
    console.warn('linha invalida', codigo, r.Caixa, r['Pc/fd'], r['Kg/und']);
    continue;
  }
  porCodigo.set(codigo, { caixa, pc, kg, descricao: String(r.Descricao || '') });
}

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});
await client.connect();
try {
  const { rows } = await client.query(`
    SELECT i.id_insumo, i.id_loja, i.codigo, i.descricao,
           COALESCE(i.permite_contagem_caixa, TRUE) AS caixa,
           COALESCE(i.permite_contagem_pc_fd, TRUE) AS pc,
           COALESCE(i.permite_contagem_kg_und, TRUE) AS kg,
           l.name
    FROM insumos i
    JOIN lojas l ON l.id_loja = i.id_loja
    WHERE i.ativo = TRUE
      AND COALESCE(l.is_active, TRUE)
      AND l.name ILIKE '%burger king%'
  `);

  const updates = [];
  const vistos = new Set();
  for (const r of rows) {
    const flags = porCodigo.get(String(r.codigo || '').trim());
    if (!flags) continue;
    vistos.add(String(r.codigo || '').trim());
    if (r.caixa === flags.caixa && r.pc === flags.pc && r.kg === flags.kg) continue;
    updates.push({
      id_insumo: r.id_insumo,
      id_loja: r.id_loja,
      loja: r.name,
      codigo: r.codigo,
      descricao: r.descricao,
      de: `${r.caixa ? 'S' : 'N'}${r.pc ? 'S' : 'N'}${r.kg ? 'S' : 'N'}`,
      para: `${flags.caixa ? 'S' : 'N'}${flags.pc ? 'S' : 'N'}${flags.kg ? 'S' : 'N'}`,
      caixa: flags.caixa,
      pc: flags.pc,
      kg: flags.kg,
    });
  }

  const semCadastro = [...porCodigo.keys()].filter((c) => !vistos.has(c));
  console.log(
    `banco=${DB_NAME} planilha=${porCodigo.size} casados=${vistos.size} a_alterar=${updates.length} sem_cadastro=${semCadastro.length}`,
  );
  for (const u of updates.slice(0, 25)) {
    console.log(`  ${u.de}->${u.para}  loja=${u.id_loja}  ${u.codigo}  ${String(u.descricao).slice(0, 48)}`);
  }
  if (semCadastro.length) {
    console.log('codigos da planilha sem insumo ativo BK:', semCadastro.slice(0, 20).join(', '));
  }

  if (dryRun) {
    console.log('dry-run: nada gravado');
    process.exit(0);
  }

  await client.query('BEGIN');
  for (const u of updates) {
    await client.query(
      `UPDATE insumos
       SET permite_contagem_caixa = $2,
           permite_contagem_pc_fd = $3,
           permite_contagem_kg_und = $4,
           atualizado_em = NOW()
       WHERE id_insumo = $1`,
      [u.id_insumo, u.caixa, u.pc, u.kg],
    );
  }
  await client.query('COMMIT');
  console.log(`ok gravado updates=${updates.length}`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}
