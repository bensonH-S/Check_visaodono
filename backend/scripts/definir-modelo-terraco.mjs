/**
 * Define BURGER KING TERRAÇO como loja-modelo de estoque:
 * 1) Zera estoque (insumos, contagens, saldos, movimentos, break, vendas, produtos/fichas) nas demais lojas
 * 2) Importa a planilha de contagem do Terraço + cria conferência 01/08/2026 com CAIXA/PC/KG
 *
 * Uso:
 *   node backend/scripts/definir-modelo-terraco.mjs --db=dev --yes
 *   node backend/scripts/definir-modelo-terraco.mjs --db=dev --yes --arquivo="..."
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';
import {
  calcularQtdContagem,
  classificarUnidadeContagem,
  extrairFatoresFormula,
  normalizarDesc,
  num,
} from '../src/services/estoqueContagem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};
const yes = args.includes('--yes');
const dryRun = args.includes('--dry-run');
const comPrecos = args.includes('--com-precos');
const dbFlag = getArg('--db', 'dev');
const DB_NAME =
  dbFlag === 'prod'
    ? process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check'
    : process.env.DB_NAME_DEV || process.env.DB_NAME || 'vision_check_dev';
const arquivo = getArg(
  '--arquivo',
  'f:/Users/Benson/Downloads/Estoque 01 de agosto - TERRAÇO.xlsx',
);
const DATA_CONTAGEM = getArg('--data', '2026-08-01');

if (!yes && !dryRun) {
  console.error('Use --yes para confirmar (ou --dry-run).');
  process.exit(1);
}

function isCabecalho(desc) {
  const d = normalizarDesc(desc);
  if (!d) return true;
  return /^(CONGELADOS|REFRIGERANTES|BRINDES|LANCAMENTO|TOTAL GERAL|SECOS|LIMPEZA|EMBALAGENS)\b/.test(
    d,
  );
}

function parsePlanilha(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellFormula: true });
  const sheetName = wb.SheetNames.find((n) => /contagem/i.test(n)) || wb.SheetNames[0];
  const sh = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: true });
  const items = [];
  const codCount = new Map();

  for (let r = 6; r < rows.length; r++) {
    const rowNum = r + 1;
    const rawCod = String(rows[r][0] ?? '').trim();
    const desc = String(rows[r][1] ?? '').trim();
    if (!desc || isCabecalho(desc)) continue;

    const fD = sh[`D${rowNum}`]?.f || '';
    const fH = sh[`H${rowNum}`]?.f || '';
    const preco = num(rows[r][2]);
    if (!fD && !fH && !(preco > 0)) continue;

    const { und_convertida, und_parcial, temFatorPc } = extrairFatoresFormula(fD, fH);
    const unidade = classificarUnidadeContagem(desc, und_convertida);

    let codigo = /^\d+$/.test(rawCod) ? rawCod : '';
    if (!codigo) {
      const slug = normalizarDesc(desc)
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, 18);
      codigo = `TRC-${slug || rowNum}`;
    }
    const n = (codCount.get(codigo) || 0) + 1;
    codCount.set(codigo, n);
    if (n > 1) codigo = `${codigo}-${n}`;

    const caixaRaw = rows[r][4];
    const pcRaw = rows[r][5];
    const kgRaw = rows[r][6];
    const temCaixa = caixaRaw !== '' && caixaRaw != null;
    const temPc = pcRaw !== '' && pcRaw != null;
    const temKg = kgRaw !== '' && kgRaw != null;

    const contagem_caixa = temCaixa ? num(caixaRaw) : null;
    const contagem_pc_fd = temPc ? num(pcRaw) : null;
    const contagem_kg_und = temKg ? num(kgRaw) : null;
    const estoque_contado = calcularQtdContagem({
      contagem_caixa,
      contagem_pc_fd,
      contagem_kg_und,
      und_convertida,
      und_parcial: temFatorPc ? und_parcial : 1,
    });

    items.push({
      codigo,
      descricao: desc,
      unidade_contagem: unidade,
      und_convertida,
      und_parcial: temFatorPc ? und_parcial : 1,
      preco_caixa: preco,
      contagem_caixa,
      contagem_pc_fd,
      contagem_kg_und,
      estoque_contado,
      // se a planilha não digitou nada, conta 0 (conferência fechada)
      forcarZero: estoque_contado == null,
    });
  }
  return items;
}

async function zerarLoja(client, idLoja) {
  await client.query(`DELETE FROM estoque_venda_itens WHERE id_venda IN (
    SELECT id_venda FROM estoque_vendas WHERE id_loja = $1)`, [idLoja]);
  await client.query(`DELETE FROM estoque_vendas WHERE id_loja = $1`, [idLoja]);
  await client.query(`DELETE FROM estoque_break_itens WHERE id_break IN (
    SELECT id_break FROM estoque_break WHERE id_loja = $1)`, [idLoja]);
  await client.query(`DELETE FROM estoque_break WHERE id_loja = $1`, [idLoja]);
  await client.query(`DELETE FROM estoque_movimentos WHERE id_loja = $1`, [idLoja]);
  await client.query(`DELETE FROM estoque_saldos WHERE id_loja = $1`, [idLoja]);
  await client.query(`DELETE FROM estoque_itens WHERE id_contagem IN (
    SELECT id_contagem FROM estoque_contagens WHERE id_loja = $1)`, [idLoja]);
  await client.query(`DELETE FROM estoque_contagens WHERE id_loja = $1`, [idLoja]);
  await client.query(`DELETE FROM estoque_sync_jobs WHERE id_loja = $1`, [idLoja]).catch(() => {});

  await client.query(`DELETE FROM ficha_tecnica_itens WHERE id_ficha IN (
    SELECT ft.id_ficha FROM ficha_tecnica ft
    JOIN produtos p ON p.id_produto = ft.id_produto
    WHERE p.id_loja = $1)`, [idLoja]);
  await client.query(`DELETE FROM ficha_tecnica WHERE id_produto IN (
    SELECT id_produto FROM produtos WHERE id_loja = $1)`, [idLoja]);
  await client.query(`DELETE FROM produtos WHERE id_loja = $1`, [idLoja]);
  await client.query(`DELETE FROM insumos WHERE id_loja = $1`, [idLoja]);
}

async function main() {
  if (!fs.existsSync(arquivo)) {
    console.error('Arquivo não encontrado:', arquivo);
    process.exit(1);
  }

  const items = parsePlanilha(arquivo);
  const byUnd = {};
  for (const it of items) byUnd[it.unidade_contagem] = (byUnd[it.unidade_contagem] || 0) + 1;
  const comValor = items.filter((i) => i.estoque_contado != null).length;

  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: DB_NAME,
    port: Number(process.env.DB_PORT || 5432),
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    const { rows: terracoRows } = await client.query(
      `SELECT id_loja, name, bk_number FROM lojas
       WHERE bk_number = '30797' OR name ILIKE '%TERRA%SHOPPING%' OR name ILIKE '%TERRAÇO%'
       ORDER BY id_loja LIMIT 1`,
    );
    if (!terracoRows.length) {
      throw new Error('Loja TERRAÇO não encontrada');
    }
    const terraco = terracoRows[0];
    const ID_TERRACO = Number(terraco.id_loja);

    const { rows: outras } = await client.query(
      `SELECT id_loja, name, bk_number FROM lojas
       WHERE id_loja <> $1
       ORDER BY id_loja`,
      [ID_TERRACO],
    );

    console.log('DB:', DB_NAME);
    console.log('Modelo:', ID_TERRACO, terraco.name, `bk=${terraco.bk_number}`);
    console.log('Planilha:', items.length, 'insumos', byUnd, `| com contagem digitada: ${comValor}`);
    console.log('Zerar lojas:', outras.length);

    if (dryRun) {
      console.log('Dry-run — nada gravado.');
      return;
    }

    await client.query('BEGIN');

    for (const loja of outras) {
      await zerarLoja(client, loja.id_loja);
      console.log('  zerada', loja.id_loja, loja.name);
    }

    // Terraço: limpa estoque operacional + insumos; mantém produtos/fichas se já existirem
    await client.query(`DELETE FROM estoque_venda_itens WHERE id_venda IN (
      SELECT id_venda FROM estoque_vendas WHERE id_loja = $1)`, [ID_TERRACO]);
    await client.query(`DELETE FROM estoque_vendas WHERE id_loja = $1`, [ID_TERRACO]);
    await client.query(`DELETE FROM estoque_break_itens WHERE id_break IN (
      SELECT id_break FROM estoque_break WHERE id_loja = $1)`, [ID_TERRACO]);
    await client.query(`DELETE FROM estoque_break WHERE id_loja = $1`, [ID_TERRACO]);
    await client.query(`DELETE FROM estoque_movimentos WHERE id_loja = $1`, [ID_TERRACO]);
    await client.query(`DELETE FROM estoque_saldos WHERE id_loja = $1`, [ID_TERRACO]);
    await client.query(`DELETE FROM estoque_itens WHERE id_contagem IN (
      SELECT id_contagem FROM estoque_contagens WHERE id_loja = $1)`, [ID_TERRACO]);
    await client.query(`DELETE FROM estoque_contagens WHERE id_loja = $1`, [ID_TERRACO]);
    await client.query(`DELETE FROM insumos WHERE id_loja = $1`, [ID_TERRACO]);

    for (const it of items) {
      const preco = comPrecos ? it.preco_caixa : 0;
      await client.query(
        `INSERT INTO insumos (
           id_loja, codigo, descricao, unidade_contagem,
           preco_caixa, und_convertida, und_parcial, ativo, atualizado_em
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW())`,
        [
          ID_TERRACO,
          it.codigo,
          it.descricao,
          it.unidade_contagem,
          preco,
          it.und_convertida,
          it.und_parcial,
        ],
      );
    }

    const { rows: cont } = await client.query(
      `INSERT INTO estoque_contagens (id_loja, data_contagem, titulo, status, observacao, finalizado_em)
       VALUES ($1, $2::date, $3, 'finalizada', $4, NOW())
       RETURNING id_contagem`,
      [
        ID_TERRACO,
        DATA_CONTAGEM,
        `Conferência Terraço 01/08/2026`,
        'Importada da planilha Estoque 01 de agosto - TERRAÇO.xlsx',
      ],
    );
    const idContagem = cont[0].id_contagem;

    const { rows: insumosDb } = await client.query(
      `SELECT id_insumo, codigo, und_convertida, und_parcial FROM insumos WHERE id_loja = $1`,
      [ID_TERRACO],
    );
    const byCod = new Map(insumosDb.map((r) => [r.codigo, r]));

    let itensInseridos = 0;
    for (const it of items) {
      const ins = byCod.get(it.codigo);
      if (!ins) continue;
      const contado = it.forcarZero ? 0 : it.estoque_contado;
      const caixa = it.forcarZero ? 0 : it.contagem_caixa;
      const pc = it.forcarZero ? null : it.contagem_pc_fd;
      const kg = it.forcarZero ? null : it.contagem_kg_und;

      await client.query(
        `INSERT INTO estoque_itens (
           id_contagem, id_insumo, estoque_sistema, estoque_contado,
           contagem_caixa, contagem_pc_fd, contagem_kg_und
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [idContagem, ins.id_insumo, contado ?? 0, contado ?? 0, caixa, pc, kg],
      );

      await client.query(
        `INSERT INTO estoque_saldos (id_loja, id_insumo, quantidade, atualizado_em)
         VALUES ($1,$2,$3,NOW())
         ON CONFLICT (id_loja, id_insumo) DO UPDATE SET
           quantidade = EXCLUDED.quantidade,
           atualizado_em = NOW()`,
        [ID_TERRACO, ins.id_insumo, contado ?? 0],
      );
      itensInseridos += 1;
    }

    await client.query('COMMIT');
    console.log('\nOK');
    console.log('  insumos Terraço:', items.length);
    console.log('  contagem #' + idContagem, DATA_CONTAGEM, 'itens:', itensInseridos);
    console.log('  demais lojas zeradas:', outras.length);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
