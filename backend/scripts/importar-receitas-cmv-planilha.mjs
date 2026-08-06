/**
 * Importa fichas + insumos + custos da planilha CMV oficial
 * (CMV_-_VERSAO_07_2026_visivel.xlsm → abas Receitas / Custo_Insumos / Incompleto).
 *
 * A planilha já traz quantidade na unidade de estoque (KG / UN).
 * Por padrão: só loja 7 (piloto). Só roda em DB *dev*.
 *
 * Uso:
 *   node backend/scripts/importar-receitas-cmv-planilha.mjs
 *   node backend/scripts/importar-receitas-cmv-planilha.mjs --loja=7 --regiao=ne
 *   node backend/scripts/importar-receitas-cmv-planilha.mjs --dry-run
 *   node backend/scripts/importar-receitas-cmv-planilha.mjs --so-sem-ficha
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import XLSX from 'xlsx';
import { qtdeReceitaParaEstoque } from '../src/services/fichaReceitaEstoque.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(__dirname, '../.env') });

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const soSemFicha = args.includes('--so-sem-ficha');
/** Por padrão NÃO grava preço da planilha (custo vem de NF). Use --com-precos só se souber o que está fazendo. */
const comPrecos = args.includes('--com-precos');
/** Marca custo_fonte=manual ao gravar preço (não sobrescreve nf). */
const marcarManual = args.includes('--marcar-manual') || comPrecos;
/** Importa todas as receitas da aba Receitas (não só Completo/vendidos). */
const todasReceitas = args.includes('--todas');
const lojaArg = args.find((a) => a.startsWith('--loja='));
const regiaoArg = args.find((a) => a.startsWith('--regiao='));
const dbArg = args.find((a) => a.startsWith('--db='));
const dbFlag = dbArg?.split('=')[1] || '';
if (dbFlag === 'dev') {
  process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev';
}
if (dbFlag === 'prod') {
  process.env.DB_NAME = process.env.DB_NAME_PROD || 'vision_check';
}
const ID_LOJA = Number(lojaArg?.split('=')[1] || 7);
/** Coluna de preço em Custo_Insumos (0-based a partir do código SP SN = col 7) */
const REGIAO = String(regiaoArg?.split('=')[1] || 'ne').toLowerCase();
const PRECO_COL = {
  sn: 7, // SP Simples
  lp: 8, // SP Lucro Presumido
  sul: 9,
  ne: 10, // N / NE / CO  ← DF / Brasília
  pb_dentro: 11,
  pb_fora: 12,
  pr_dentro: 13,
  pr_fora: 14,
  am: 15,
}[REGIAO] ?? 10;

const dbName = process.env.DB_NAME || '';
const forceProd = args.includes('--yes') || args.includes('--force-prod');
if (!/dev/i.test(dbName)) {
  if (!forceProd) {
    console.error('ABORT: só DB de desenvolvimento (DB_NAME com "dev"). Atual:', dbName);
    console.error('Para produção: acrescente --yes (ex.: --loja=21 --db=dev não; use DB_NAME_PROD + --yes)');
    process.exit(1);
  }
  console.warn('ATENÇÃO: gravando em banco NÃO-dev:', dbName);
}

const PLANILHA = path.join(root, 'CMV_-_VERSAO_07_2026_visivel.xlsm');
const CSV_30D = path.join(root, 'Logs/analise-fichas-30d-loja7.csv');

function normUm(um) {
  const u = String(um || 'UN')
    .trim()
    .toUpperCase();
  if (u === 'KG' || u === 'KILO') return 'kg';
  if (u === 'G' || u === 'GR' || u === 'GRS') return 'g';
  return 'und';
}

function parseCsv30d() {
  if (!fs.existsSync(CSV_30D)) return [];
  const lines = fs.readFileSync(CSV_30D, 'utf8').split(/\r?\n/).filter(Boolean).slice(1);
  return lines.map((l) => {
    const p = [];
    let cur = '';
    let inQ = false;
    for (const ch of l) {
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === ';' && !inQ) {
        p.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    p.push(cur);
    return {
      codigo: String(p[0] || '').trim(),
      nome: String(p[1] || '').trim(),
      qtd: Number(p[2]) || 0,
      status: String(p[3] || '').trim(),
    };
  });
}

function lerPlanilha() {
  if (!fs.existsSync(PLANILHA)) {
    console.error('Planilha não encontrada:', PLANILHA);
    process.exit(1);
  }
  const wb = XLSX.read(fs.readFileSync(PLANILHA), { type: 'buffer', cellDates: true });

  // Receitas: Material | nome | Item | SAP | Platlog | nomeInsumo | Qtd | UM | | qtdCx | UND | custoCx | custoNoProd
  const recRows = XLSX.utils.sheet_to_json(wb.Sheets['Receitas'], { header: 1, defval: '' });
  const recipes = new Map(); // material -> { nome, comps: [] }
  for (let i = 1; i < recRows.length; i++) {
    const r = recRows[i];
    const material = String(r[0] ?? '').trim();
    if (!/^\d+$/.test(material)) continue;
    const nome = String(r[1] ?? '').trim();
    const platlog = String(r[4] ?? '').trim();
    const nomeInsumo = String(r[5] ?? '').trim();
    const qtd = Number(r[6]);
    const um = normUm(r[7]);
    const qtdCx = Number(r[9]) || 0;
    const custoCx = Number(r[11]) || 0;
    if (!platlog || !Number.isFinite(qtd) || qtd <= 0) continue;
    if (!recipes.has(material)) recipes.set(material, { nome, comps: [] });
    recipes.get(material).comps.push({
      codigo: platlog,
      nome: nomeInsumo || platlog,
      qtd,
      um,
      qtdCx,
      custoCx,
    });
  }

  // Custo_Insumos: row 5 = header, data from row 6
  const custoRows = XLSX.utils.sheet_to_json(wb.Sheets['Custo_Insumos'], { header: 1, defval: '' });
  const custos = new Map(); // codigo -> { descricao, und, peso, preco }
  for (let i = 6; i < custoRows.length; i++) {
    const r = custoRows[i];
    const codigo = String(r[2] ?? '').trim();
    if (!/^\d+$/.test(codigo)) continue;
    const descricao = String(r[3] ?? '').trim();
    const und = String(r[5] ?? 'cx').trim().toLowerCase() || 'cx';
    const peso = Number(r[6]) || 0;
    const preco = Number(r[PRECO_COL]);
    if (!custos.has(codigo) && Number.isFinite(preco) && preco > 0) {
      custos.set(codigo, { descricao, und, peso, preco });
    }
  }

  // Incompleto = lista de insumos de contagem da loja
  const incRows = XLSX.utils.sheet_to_json(wb.Sheets['Incompleto'], { header: 1, defval: '' });
  const incompleto = new Map();
  for (let i = 6; i < incRows.length; i++) {
    const codigo = String(incRows[i][0] ?? '').trim();
    const descricao = String(incRows[i][1] ?? '').trim();
    if (/^\d+$/.test(codigo)) incompleto.set(codigo, descricao);
  }

  // Completo = produtos acabados do controle
  const compRows = XLSX.utils.sheet_to_json(wb.Sheets['Completo'], { header: 1, defval: '' });
  const completo = new Map();
  for (let i = 6; i < compRows.length; i++) {
    const codigo = String(compRows[i][0] ?? '').trim();
    const descricao = String(compRows[i][1] ?? '').trim();
    if (/^\d+$/.test(codigo)) completo.set(codigo, descricao);
  }

  return { recipes, custos, incompleto, completo };
}

/** Merge componentes iguais (mesmo código) somando qtd */
function mergeComps(comps) {
  const map = new Map();
  for (const c of comps) {
    const key = String(c.codigo);
    const prev = map.get(key);
    if (prev) {
      prev.qtd += c.qtd;
      if (c.qtdCx > prev.qtdCx) prev.qtdCx = c.qtdCx;
      if (c.custoCx > 0) prev.custoCx = c.custoCx;
      if (c.nome && c.nome.length > (prev.nome || '').length) prev.nome = c.nome;
    } else {
      map.set(key, { ...c });
    }
  }
  return [...map.values()];
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

async function upsertInsumo(client, { codigo, descricao, precoCaixa, undConvertida }) {
  // Preço: só com --com-precos. Com --marcar-manual (ou --com-precos), marca manual sem sobrescrever nf.
  const preco = comPrecos ? Number(precoCaixa) || 0 : 0;
  const und = Number(undConvertida) > 0 ? Number(undConvertida) : 1;
  const { rows } = await client.query(
    `INSERT INTO insumos (id_loja, codigo, descricao, unidade_contagem, preco_caixa, und_convertida, custo_fonte, ativo, atualizado_em)
     VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric,
             CASE WHEN $8::boolean AND $5::numeric > 0 THEN 'manual' ELSE NULL END,
             TRUE, NOW())
     ON CONFLICT (id_loja, codigo) DO UPDATE SET
       descricao = CASE WHEN EXCLUDED.descricao <> '' THEN EXCLUDED.descricao ELSE insumos.descricao END,
       preco_caixa = CASE
         WHEN $7::boolean AND EXCLUDED.preco_caixa > 0 AND (insumos.custo_fonte IS DISTINCT FROM 'nf')
           THEN EXCLUDED.preco_caixa
         ELSE insumos.preco_caixa
       END,
       und_convertida = CASE
         WHEN insumos.und_convertida IS NOT NULL AND insumos.und_convertida > 0 THEN insumos.und_convertida
         WHEN EXCLUDED.und_convertida > 0 THEN EXCLUDED.und_convertida
         ELSE insumos.und_convertida
       END,
       custo_fonte = CASE
         WHEN insumos.custo_fonte = 'nf' THEN insumos.custo_fonte
         WHEN $8::boolean AND $7::boolean AND EXCLUDED.preco_caixa > 0 THEN 'manual'
         ELSE insumos.custo_fonte
       END,
       ativo = TRUE,
       atualizado_em = NOW()
     RETURNING id_insumo, codigo, valor_unidade`,
    [ID_LOJA, codigo, descricao || codigo, 'und', preco, und, comPrecos, marcarManual],
  );
  return rows[0];
}

async function upsertProduto(client, codigo, descricao) {
  const { rows } = await client.query(
    `INSERT INTO produtos (id_loja, codigo, descricao, ativo, requer_ficha, atualizado_em)
     VALUES ($1, $2, $3, TRUE, TRUE, NOW())
     ON CONFLICT (id_loja, codigo) DO UPDATE SET
       descricao = CASE
         WHEN EXCLUDED.descricao <> '' THEN EXCLUDED.descricao ELSE produtos.descricao END,
       ativo = TRUE,
       atualizado_em = NOW()
     RETURNING id_produto, codigo, descricao, requer_ficha`,
    [ID_LOJA, codigo, descricao || codigo],
  );
  return rows[0];
}

async function upsertFicha(client, idProduto, comps, byInsumo) {
  const { rows: fr } = await client.query(
    `INSERT INTO ficha_tecnica (id_produto, ativo, observacao, atualizado_em)
     VALUES ($1, TRUE, $2, NOW())
     ON CONFLICT (id_produto) DO UPDATE SET
       ativo = TRUE,
       observacao = EXCLUDED.observacao,
       atualizado_em = NOW()
     RETURNING id_ficha`,
    [idProduto, 'Import CMV planilha VERSÃO 07/2026 (Receitas)'],
  );
  const idFicha = fr[0].id_ficha;
  await client.query('DELETE FROM ficha_tecnica_itens WHERE id_ficha = $1', [idFicha]);

  if (!comps.length) return 0;

  const values = [];
  const params = [];
  let i = 1;
  for (const c of comps) {
    const ins = byInsumo.get(String(c.codigo)) || {
      descricao: c.nome,
      und_convertida: c.qtdCx || 1,
    };
    const qEst =
      c.um === 'g' ? qtdeReceitaParaEstoque(c.qtd, 'g', ins) : Number(c.qtd);
    values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
    params.push(idFicha, String(c.codigo), Number(c.qtd), c.um, qEst, c.nome || null);
  }
  await client.query(
    `INSERT INTO ficha_tecnica_itens
       (id_ficha, codigo_insumo, quantidade, unidade_receita, qtde_estoque, observacao)
     VALUES ${values.join(',')}`,
    params,
  );
  return comps.length;
}

async function main() {
  console.log('DB:', dbName);
  console.log(
    'Loja:',
    ID_LOJA,
    '| região:',
    REGIAO,
    '| dry-run:',
    dryRun,
    '| só sem ficha:',
    soSemFicha,
    '| todas receitas:',
    todasReceitas,
    '| gravar preços planilha:',
    comPrecos,
    '| marcar manual:',
    marcarManual,
  );

  const { recipes, custos, incompleto, completo } = lerPlanilha();
  const vendas30d = parseCsv30d();
  const semFichaCsv = new Set(vendas30d.filter((v) => v.status === 'SEM_FICHA').map((v) => v.codigo));
  const vendidosCsv = new Map(vendas30d.map((v) => [v.codigo, v]));

  console.log('Planilha: receitas', recipes.size, '| custos', custos.size, '| incompleto', incompleto.size, '| completo', completo.size);

  const client = await pool.connect();
  try {
    const loja = await client.query(`SELECT id_loja, name, bk_number FROM lojas WHERE id_loja = $1`, [ID_LOJA]);
    if (!loja.rows.length) throw new Error(`Loja ${ID_LOJA} não existe`);
    console.log('Loja DB:', loja.rows[0]);

    // Quais produtos importar ficha
    const { rows: prodsExist } = await client.query(
      `SELECT p.id_produto, p.codigo, p.descricao, p.requer_ficha,
              (f.id_ficha IS NOT NULL) AS tem_ficha
       FROM produtos p
       LEFT JOIN ficha_tecnica f ON f.id_produto = p.id_produto AND f.ativo
       WHERE p.id_loja = $1`,
      [ID_LOJA],
    );
    const prodByCod = new Map(prodsExist.map((p) => [String(p.codigo), p]));

    const alvos = new Set();
    for (const [cod] of recipes) {
      if (todasReceitas) {
        alvos.add(cod);
        continue;
      }
      if (soSemFicha) {
        const p = prodByCod.get(cod);
        if (semFichaCsv.has(cod) || (p && !p.tem_ficha)) alvos.add(cod);
        else if (!p && vendidosCsv.has(cod) && vendidosCsv.get(cod).status === 'SEM_FICHA') alvos.add(cod);
      } else {
        // Importa: existentes, vendidos 30d, lista Completo da planilha
        if (prodByCod.has(cod) || vendidosCsv.has(cod) || completo.has(cod)) alvos.add(cod);
      }
    }

    console.log('Produtos-alvo para ficha:', alvos.size);

    // Insumos: prioridade 1) custo embutido na Receitas (bate com CMV teórico da planilha)
    //           2) aba Custo_Insumos (região)
    //           3) lista Incompleto (só cadastro)
    const insumosNeed = new Map(); // codigo -> {descricao, preco, und}
    for (const [cod, desc] of incompleto) {
      const c = custos.get(cod);
      insumosNeed.set(cod, {
        descricao: desc || c?.descricao || cod,
        preco: c?.preco || 0,
        und: c?.peso > 0 ? c.peso : 1,
        fonte: 'incompleto',
      });
    }
    for (const codProd of alvos) {
      const rec = recipes.get(codProd);
      if (!rec) continue;
      for (const c of mergeComps(rec.comps)) {
        const custoTab = custos.get(c.codigo);
        const prev = insumosNeed.get(c.codigo) || {};
        // Receitas.col "Custo do insumo" = preço da caixa usada no CMV oficial
        const precoReceita = Number(c.custoCx) > 0 ? Number(c.custoCx) : 0;
        const undReceita = Number(c.qtdCx) > 0 ? Number(c.qtdCx) : 0;
        insumosNeed.set(c.codigo, {
          descricao: c.nome || prev.descricao || custoTab?.descricao || c.codigo,
          preco: precoReceita || prev.preco || custoTab?.preco || 0,
          und: undReceita || prev.und || (custoTab?.peso > 0 ? custoTab.peso : 1) || 1,
          fonte: precoReceita ? 'receitas' : prev.fonte || 'custo',
        });
      }
    }

    console.log('Insumos a upsert:', insumosNeed.size);

    if (dryRun) {
      let importaveis = 0;
      let semReceita = 0;
      for (const cod of [...semFichaCsv].sort()) {
        if (recipes.has(cod)) {
          importaveis++;
          const v = vendidosCsv.get(cod);
          console.log('  +', cod, v?.qtd, v?.nome?.slice(0, 40), 'comps', recipes.get(cod).comps.length);
        } else {
          semReceita++;
          const v = vendidosCsv.get(cod);
          console.log('  ?', cod, v?.qtd, v?.nome?.slice(0, 40), '(sem receita na planilha)');
        }
      }
      console.log({ importaveis, semReceita, alvos: alvos.size, insumos: insumosNeed.size });
      return;
    }

    // Sem transação única gigante (DB remoto trava/timeout). Commit por lote.
    const byInsumo = new Map();
    let nInsumos = 0;
    const insList = [...insumosNeed.entries()];
    console.log('Upsert insumos...');
    for (let i = 0; i < insList.length; i++) {
      const [codigo, info] = insList[i];
      const row = await upsertInsumo(client, {
        codigo,
        descricao: info.descricao,
        precoCaixa: info.preco,
        undConvertida: info.und,
      });
      byInsumo.set(String(codigo), {
        ...row,
        descricao: info.descricao,
        und_convertida: info.und,
      });
      nInsumos += 1;
      if ((i + 1) % 25 === 0 || i + 1 === insList.length) {
        console.log(`  insumos ${i + 1}/${insList.length}`);
      }
    }

    const { rows: allIns } = await client.query(
      `SELECT codigo, descricao, und_convertida, valor_unidade FROM insumos WHERE id_loja = $1`,
      [ID_LOJA],
    );
    for (const i of allIns) byInsumo.set(String(i.codigo), i);

    let nProdutos = 0;
    let nFichas = 0;
    let nItens = 0;
    let nSkip = 0;

    const alvosList = [...alvos].sort();
    console.log('Upsert fichas...');
    for (let idx = 0; idx < alvosList.length; idx++) {
      const cod = alvosList[idx];
      const rec = recipes.get(cod);
      if (!rec) {
        nSkip += 1;
        continue;
      }
      const comps = mergeComps(rec.comps).filter((c) => c.qtd > 0);
      if (!comps.length) {
        nSkip += 1;
        continue;
      }

      const nome =
        rec.nome ||
        vendidosCsv.get(cod)?.nome ||
        completo.get(cod) ||
        prodByCod.get(cod)?.descricao ||
        cod;

      try {
        await client.query('BEGIN');
        const prod = await upsertProduto(client, cod, nome);
        nProdutos += 1;
        const itens = await upsertFicha(client, prod.id_produto, comps, byInsumo);
        nFichas += 1;
        nItens += itens;
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('  ERRO produto', cod, err.message);
        nSkip += 1;
      }

      if ((idx + 1) % 20 === 0 || idx + 1 === alvosList.length) {
        console.log(`  fichas ${idx + 1}/${alvosList.length} (ok ${nFichas})`);
      }
    }

    // Validação
    const check = await client.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE f.id_ficha IS NOT NULL) AS com_ficha,
        COUNT(*) FILTER (WHERE f.id_ficha IS NULL AND COALESCE(p.requer_ficha,true)) AS sem_ficha,
        COUNT(*) FILTER (WHERE COALESCE(p.requer_ficha,true)=false) AS unitarios
      FROM produtos p
      LEFT JOIN ficha_tecnica f ON f.id_produto = p.id_produto AND f.ativo
      WHERE p.id_loja = $1 AND p.ativo
    `,
      [ID_LOJA],
    );

    const amostra = await client.query(
      `
      SELECT pv.codigo, LEFT(pv.descricao,40) AS descricao,
             ROUND(SUM(COALESCE(i.qtde_estoque,0) * COALESCE(ins.valor_unidade,0))::numeric, 2) AS custo_teorico,
             COUNT(i.id_item)::int AS comps
      FROM produtos pv
      JOIN ficha_tecnica f ON f.id_produto = pv.id_produto AND f.ativo
      JOIN ficha_tecnica_itens i ON i.id_ficha = f.id_ficha
      LEFT JOIN insumos ins ON ins.id_loja = pv.id_loja AND UPPER(ins.codigo)=UPPER(i.codigo_insumo)
      WHERE pv.id_loja = $1
        AND pv.codigo = ANY($2::text[])
      GROUP BY 1,2
      ORDER BY 1
    `,
      [ID_LOJA, ['1050', '2100', '6012', '7300047', '7210474', '7210100', '7210378']],
    );

    const semCodes = vendas30d.filter((x) => x.status === 'SEM_FICHA').map((v) => v.codigo);
    const { rows: comFichaAgora } = await client.query(
      `SELECT p.codigo FROM produtos p
       JOIN ficha_tecnica f ON f.id_produto = p.id_produto AND f.ativo
       WHERE p.id_loja = $1 AND p.codigo = ANY($2::text[])`,
      [ID_LOJA, semCodes],
    );
    const okSet = new Set(comFichaAgora.map((r) => r.codigo));
    const aindaSem = vendas30d.filter((v) => v.status === 'SEM_FICHA' && !okSet.has(v.codigo));

    console.log('\n=== RESULTADO ===');
    console.log({ nInsumos, nProdutos, nFichas, nItens, nSkip });
    console.log('Status loja:', check.rows[0]);
    console.log('Amostra custos teóricos:');
    for (const r of amostra.rows) console.log(' ', r);
    console.log('Ainda SEM_FICHA no CSV 30d:', aindaSem.length);
    for (const v of aindaSem.slice(0, 20)) {
      console.log('  -', v.codigo, v.qtd, v.nome);
    }
  } catch (e) {
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
