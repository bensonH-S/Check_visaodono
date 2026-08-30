/**
 * Regenera planilha 4 abas com listas curadas (+ 3 itens Break).
 *   node backend/scripts/gerar-planilha-break-cadernos.mjs --db=prod
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};
if (getArg('--db', 'prod') === 'prod') process.env.NODE_ENV = 'production';

const { filtrarPorCaderno } = await import('../src/services/estoqueCadernos.js');
const { pool } = await import('../src/db.js');

function sheet(rows) {
  const cols = ['#', 'Codigo', 'Descricao'];
  const ws = XLSX.utils.json_to_sheet(rows, { header: cols });
  ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 56 }];
  return ws;
}

function fromRows(rows) {
  return (rows || []).map((r, i) => ({
    '#': i + 1,
    Codigo: r.codigo || '',
    Descricao: r.descricao || '',
  }));
}

try {
  const { rows: lojas } = await pool.query(
    `SELECT id_loja, name, bk_number FROM lojas WHERE bk_number = '30797' LIMIT 1`,
  );
  const loja = lojas[0];
  const idLoja = loja.id_loja;

  const { rows: produtos } = await pool.query(
    `SELECT codigo, descricao FROM produtos WHERE id_loja = $1 AND ativo = TRUE ORDER BY descricao`,
    [idLoja],
  );
  const { rows: insumos } = await pool.query(
    `SELECT codigo, descricao FROM insumos WHERE id_loja = $1 AND ativo = TRUE ORDER BY descricao`,
    [idLoja],
  );

  const breakRows = fromRows(filtrarPorCaderno(produtos, 'refeicao'));
  const dcRows = fromRows(filtrarPorCaderno(produtos, 'desperdicio_completo'));
  const diRows = fromRows(filtrarPorCaderno(insumos, 'desperdicio_incompleto'));
  const empRows = fromRows(filtrarPorCaderno(insumos, 'emprestimo'));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(breakRows), 'Break');
  XLSX.utils.book_append_sheet(wb, sheet(dcRows), 'Completo');
  XLSX.utils.book_append_sheet(wb, sheet(diRows), 'Incompleto');
  XLSX.utils.book_append_sheet(wb, sheet(empRows), 'Emprestimo');

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const filename = `break-completo-incompleto-emprestimo-30797-${hoje}.xlsx`;
  const outRoot = path.join(root, filename);
  const desktop = path.join('F:', 'Users', 'benson', 'OneDrive', 'Desktop', filename);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync(outRoot, buf);
  fs.writeFileSync(desktop, buf);

  const tem = (cod) => breakRows.some((r) => String(r.Codigo) === cod);
  console.log('OK', {
    arquivo: outRoot,
    desktop,
    Break: breakRows.length,
    Completo: dcRows.length,
    Incompleto: diRows.length,
    Emprestimo: empRows.length,
    novos_break: {
      '7100036_RODEIO': tem('7100036'),
      '7100161_CHEDDAR_DUPLO': tem('7100161'),
      '7210100_CHEDDAR_JR': tem('7210100'),
    },
  });
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
