/**
 * Terraço (loja 21): simplificar estoque via planilha.
 *
 * 1) Diff Contagem xlsx × insumos DB
 * 2) Custos: VL.CAIXA Contagem + gaps Custo_Insumos NE → custo_fonte=manual
 *    (não sobrescreve custo_fonte='nf')
 * 3) Relatório final de cobertura
 *
 * Uso:
 *   node backend/scripts/simplificar-estoque-terraco.mjs --db=dev
 *   node backend/scripts/simplificar-estoque-terraco.mjs --db=dev --apply
 *   node backend/scripts/simplificar-estoque-terraco.mjs --db=dev --apply --criar-faltantes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';
import {
  classificarUnidadeContagem,
  extrairFatoresFormula,
  normalizarDesc,
  num,
} from '../src/services/estoqueContagem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};
const apply = args.includes('--apply');
const criarFaltantes = args.includes('--criar-faltantes');
const forceProd = args.includes('--yes') || args.includes('--force-prod');
const ID_LOJA = Number(getArg('--loja', '21'));
const dbFlag = getArg('--db', 'dev');
const DB_NAME =
  dbFlag === 'prod'
    ? process.env.DB_NAME_PROD || 'vision_check'
    : process.env.DB_NAME_DEV || 'vision_check_dev';

if (dbFlag === 'prod' || (!/dev/i.test(DB_NAME) && dbFlag !== 'dev')) {
  if (!forceProd) {
    console.error('ABORT: produção exige --yes. DB:', DB_NAME);
    process.exit(1);
  }
  console.warn('ATENÇÃO: aplicando em PRODUÇÃO', DB_NAME);
}

const CONTAGEM_XLSX = getArg(
  '--contagem',
  'f:/Users/Benson/Downloads/Estoque 01 de agosto - TERRAÇO.xlsx',
);
const CMV_XLSM = getArg('--cmv', path.join(root, 'CMV_-_VERSAO_07_2026_visivel.xlsm'));
/** Coluna NE em Custo_Insumos (0-based) — igual importar-receitas-cmv-planilha */
const PRECO_COL_NE = 10;

function isCabecalho(desc) {
  const d = normalizarDesc(desc);
  if (!d) return true;
  return /^(CONGELADOS|REFRIGERANTES|BRINDES|LANCAMENTO|TOTAL GERAL|SECOS|LIMPEZA|EMBALAGENS)\b/.test(
    d,
  );
}

function parseContagem(filePath) {
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

    items.push({
      codigo,
      descricao: desc,
      unidade_contagem: unidade,
      und_convertida,
      und_parcial: temFatorPc ? und_parcial : 1,
      preco_caixa: preco > 0 ? preco : null,
      row: rowNum,
    });
  }
  return items;
}

function parseCustoInsumos(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer' });
  const custoRows = XLSX.utils.sheet_to_json(wb.Sheets['Custo_Insumos'], {
    header: 1,
    defval: '',
  });
  const custos = new Map();
  for (let i = 6; i < custoRows.length; i++) {
    const r = custoRows[i];
    const codigo = String(r[2] ?? '').trim();
    if (!/^\d+$/.test(codigo)) continue;
    const descricao = String(r[3] ?? '').trim();
    const peso = Number(r[6]) || 0;
    const preco = Number(r[PRECO_COL_NE]);
    if (!custos.has(codigo) && Number.isFinite(preco) && preco > 0) {
      custos.set(codigo, { descricao, peso, preco });
    }
  }
  return custos;
}

function normCod(c) {
  return String(c || '')
    .trim()
    .toUpperCase();
}

async function main() {
  console.log({
    loja: ID_LOJA,
    db: DB_NAME,
    apply,
    criarFaltantes,
    contagem: CONTAGEM_XLSX,
    cmv: CMV_XLSM,
  });

  if (!fs.existsSync(CONTAGEM_XLSX)) {
    console.error('Contagem não encontrada:', CONTAGEM_XLSX);
    process.exit(1);
  }
  if (!fs.existsSync(CMV_XLSM)) {
    console.error('CMV não encontrado:', CMV_XLSM);
    process.exit(1);
  }

  const contagem = parseContagem(CONTAGEM_XLSX);
  const custosCmv = parseCustoInsumos(CMV_XLSM);
  console.log(`Contagem: ${contagem.length} itens | Custo_Insumos NE: ${custosCmv.size}`);

  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: DB_NAME,
    port: Number(process.env.DB_PORT || 5432),
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    const loja = await client.query(
      `SELECT id_loja, name, bk_number FROM lojas WHERE id_loja = $1`,
      [ID_LOJA],
    );
    if (!loja.rows.length) throw new Error(`Loja ${ID_LOJA} não existe`);
    console.log('Loja:', loja.rows[0]);

    const { rows: dbIns } = await client.query(
      `SELECT id_insumo, codigo, descricao, unidade_contagem, und_convertida, und_parcial,
              preco_caixa, custo_fonte, ativo
       FROM insumos WHERE id_loja = $1`,
      [ID_LOJA],
    );
    const byCod = new Map(dbIns.map((r) => [normCod(r.codigo), r]));

    const soPlanilha = [];
    const ambos = [];
    for (const it of contagem) {
      const db = byCod.get(normCod(it.codigo));
      if (db) ambos.push({ planilha: it, db });
      else soPlanilha.push(it);
    }
    const codsPlanilha = new Set(contagem.map((i) => normCod(i.codigo)));
    const soApp = dbIns.filter((r) => r.ativo && !codsPlanilha.has(normCod(r.codigo)));

    console.log('\n=== DIFF CATÁLOGO ===');
    console.log({
      contagem: contagem.length,
      ativos_db: dbIns.filter((r) => r.ativo).length,
      nos_dois: ambos.length,
      so_planilha: soPlanilha.length,
      so_app: soApp.length,
    });
    if (soPlanilha.length) {
      console.log('\nSó na Contagem (faltam no app):');
      for (const it of soPlanilha.slice(0, 40)) {
        console.log(`  + ${it.codigo} | ${it.descricao} | R$ ${it.preco_caixa ?? '—'}`);
      }
      if (soPlanilha.length > 40) console.log(`  ... +${soPlanilha.length - 40}`);
    }

const SKIP_CRIAR = /PEPSI|LIPTON|ANTARTICA|ANTARCTICA|SODA LIMONADA/i;

    // --- Aplicar: criar faltantes da Contagem ---
    let criados = 0;
    if (apply && criarFaltantes) {
      for (const it of soPlanilha) {
        if (SKIP_CRIAR.test(it.descricao) || SKIP_CRIAR.test(it.codigo)) {
          console.log(`  skip (não CMV/free refill antigo): ${it.codigo}`);
          continue;
        }
        const { rows } = await client.query(
          `INSERT INTO insumos (
             id_loja, codigo, descricao, unidade_contagem,
             und_convertida, und_parcial, preco_caixa, custo_fonte, ativo, atualizado_em
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,NOW())
           ON CONFLICT (id_loja, codigo) DO UPDATE SET
             descricao = EXCLUDED.descricao,
             unidade_contagem = EXCLUDED.unidade_contagem,
             und_convertida = CASE WHEN EXCLUDED.und_convertida > 0 THEN EXCLUDED.und_convertida ELSE insumos.und_convertida END,
             und_parcial = EXCLUDED.und_parcial,
             ativo = TRUE,
             atualizado_em = NOW()
           RETURNING id_insumo, codigo`,
          [
            ID_LOJA,
            it.codigo,
            it.descricao,
            it.unidade_contagem,
            it.und_convertida || 1,
            it.und_parcial || 1,
            it.preco_caixa > 0 ? it.preco_caixa : 0,
            it.preco_caixa > 0 ? 'manual' : null,
          ],
        );
        byCod.set(normCod(rows[0].codigo), {
          ...it,
          id_insumo: rows[0].id_insumo,
          custo_fonte: it.preco_caixa > 0 ? 'manual' : null,
        });
        criados += 1;
      }
      console.log(`Criados/reativados da Contagem: ${criados}`);
    } else if (soPlanilha.length) {
      console.log('(dry) faltantes Contagem NÃO criados — use --apply --criar-faltantes');
    }

    // Refresh map after creates
    const { rows: dbIns2 } = await client.query(
      `SELECT id_insumo, codigo, descricao, preco_caixa, custo_fonte, ativo
       FROM insumos WHERE id_loja = $1`,
      [ID_LOJA],
    );
    const byCod2 = new Map(dbIns2.map((r) => [normCod(r.codigo), r]));

    // --- Custos: Contagem primeiro, depois Custo_Insumos nos buracos ---
    let updContagem = 0;
    let updCmv = 0;
    let skipNf = 0;
    let semPreco = 0;

    const updates = []; // { id, codigo, preco, fonte_origem }

    for (const it of contagem) {
      const db = byCod2.get(normCod(it.codigo));
      if (!db || !db.ativo) continue;
      if (db.custo_fonte === 'nf') {
        skipNf += 1;
        continue;
      }
      if (!(it.preco_caixa > 0)) continue;
      updates.push({
        id: db.id_insumo,
        codigo: db.codigo,
        preco: it.preco_caixa,
        origem: 'contagem',
      });
    }

    // Gaps: ativos sem nf e sem preço Contagem → Custo_Insumos
    // Também tenta match do código base (remove sufixo -N) e código numérico puro
    const jaNaFila = new Set(updates.map((u) => u.id));
    for (const db of dbIns2) {
      if (!db.ativo) continue;
      if (db.custo_fonte === 'nf') continue;
      if (db.custo_fonte === 'manual' && Number(db.preco_caixa) > 0) continue;
      if (jaNaFila.has(db.id_insumo)) continue;
      const raw = String(db.codigo);
      const base = raw.replace(/-\d+$/, '');
      const c =
        custosCmv.get(raw) ||
        custosCmv.get(base) ||
        ( /^\d+$/.test(base) ? custosCmv.get(base) : null);
      if (c && c.preco > 0) {
        updates.push({
          id: db.id_insumo,
          codigo: db.codigo,
          preco: c.preco,
          origem: 'custo_insumos_ne',
        });
        jaNaFila.add(db.id_insumo);
      }
    }

    console.log('\n=== CUSTOS A APLICAR ===');
    console.log({
      da_contagem: updates.filter((u) => u.origem === 'contagem').length,
      do_cmv_ne: updates.filter((u) => u.origem === 'custo_insumos_ne').length,
      skip_ja_nf: skipNf,
      total_updates: updates.length,
    });

    if (apply) {
      for (const u of updates) {
        await client.query(
          `UPDATE insumos
           SET preco_caixa = $2,
               custo_fonte = 'manual',
               atualizado_em = NOW()
           WHERE id_insumo = $1
             AND (custo_fonte IS DISTINCT FROM 'nf')`,
          [u.id, u.preco],
        );
        if (u.origem === 'contagem') updContagem += 1;
        else updCmv += 1;
      }
      console.log(`Aplicado: contagem=${updContagem} cmv=${updCmv}`);
    } else {
      console.log('(dry) nada gravado — rode com --apply');
    }

    // Cobertura final
    const { rows: cov } = await client.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE ativo)::int AS ativos,
        COUNT(*) FILTER (WHERE ativo AND custo_fonte = 'nf')::int AS custo_nf,
        COUNT(*) FILTER (WHERE ativo AND custo_fonte = 'manual')::int AS custo_manual,
        COUNT(*) FILTER (
          WHERE ativo AND custo_fonte IS DISTINCT FROM 'nf'
            AND custo_fonte IS DISTINCT FROM 'manual'
        )::int AS sem_custo
      FROM insumos WHERE id_loja = $1
    `,
      [ID_LOJA],
    );

    const { rows: aindaSem } = await client.query(
      `
      SELECT codigo, descricao, preco_caixa, custo_fonte
      FROM insumos
      WHERE id_loja = $1 AND ativo
        AND custo_fonte IS DISTINCT FROM 'nf'
        AND custo_fonte IS DISTINCT FROM 'manual'
      ORDER BY descricao
    `,
      [ID_LOJA],
    );
    semPreco = aindaSem.length;

    console.log('\n=== COBERTURA CUSTO ===');
    console.table(cov);
    if (aindaSem.length) {
      console.log(`Ainda sem custo (${aindaSem.length}):`);
      for (const r of aindaSem.slice(0, 50)) {
        console.log(`  - ${r.codigo} | ${r.descricao}`);
      }
      if (aindaSem.length > 50) console.log(`  ... +${aindaSem.length - 50}`);
    }

    // Export excel resumo
    const outDir = path.join(root, 'Logs');
    fs.mkdirSync(outDir, { recursive: true });
    const wbOut = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wbOut,
      XLSX.utils.json_to_sheet([
        { Metrica: 'Contagem planilha', Valor: contagem.length },
        { Metrica: 'Nos dois', Valor: ambos.length },
        { Metrica: 'Só Contagem', Valor: soPlanilha.length },
        { Metrica: 'Só app', Valor: soApp.length },
        { Metrica: 'Ativos DB', Valor: cov[0].ativos },
        { Metrica: 'Custo NF', Valor: cov[0].custo_nf },
        { Metrica: 'Custo manual', Valor: cov[0].custo_manual },
        { Metrica: 'Sem custo', Valor: cov[0].sem_custo },
        { Metrica: 'Modo', Valor: apply ? 'APPLY' : 'DRY-RUN' },
      ]),
      'Totais',
    );
    XLSX.utils.book_append_sheet(
      wbOut,
      XLSX.utils.json_to_sheet(
        soPlanilha.map((i) => ({
          Codigo: i.codigo,
          Produto: i.descricao,
          Preco: i.preco_caixa,
        })),
      ),
      'So Contagem',
    );
    XLSX.utils.book_append_sheet(
      wbOut,
      XLSX.utils.json_to_sheet(
        soApp.map((r) => ({
          Codigo: r.codigo,
          Produto: r.descricao,
          Fonte: r.custo_fonte,
          Preco: r.preco_caixa != null ? Number(r.preco_caixa) : null,
        })),
      ),
      'So App',
    );
    XLSX.utils.book_append_sheet(
      wbOut,
      XLSX.utils.json_to_sheet(
        aindaSem.map((r) => ({
          Codigo: r.codigo,
          Produto: r.descricao,
        })),
      ),
      'Ainda sem custo',
    );
    const outPath = path.join(outDir, 'terraco-simplificar-estoque.xlsx');
    XLSX.writeFile(wbOut, outPath);
    console.log('\nExcel:', outPath);
    console.log({ criados, updContagem, updCmv, skipNf, semPreco });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
