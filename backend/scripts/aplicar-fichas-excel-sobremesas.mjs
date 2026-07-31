/**
 * Aplica fichas de sobremesas a partir de
 * Arquivos BK/lista_insumos_produtos_BK.xlsx
 * (export do Treinamento de sobremesas).
 *
 * Não apaga sanduíches. Só DEV.
 *
 * node backend/scripts/aplicar-fichas-excel-sobremesas.mjs
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { qtdeReceitaParaEstoque } from '../src/services/fichaReceitaEstoque.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const dbName = process.env.DB_NAME || '';
if (!/dev/i.test(dbName)) {
  console.error('ABORT: só DEV');
  process.exit(1);
}

const I = {
  copoMix: '29000',
  copoSundae: '35144-2',
  copoShake: '35144',
  cone: '38454',
  balde: '35505',
  guardanapo: '32678',
  colher: '29017',
  canudo: '19555',
  sorvete: '28459',
  nutella: 'BK-SEM-0005',
  leitePo: 'BK-SEM-0039',
  leitePoAlt: '3841',
  crumble: '21215-2',
  ovomaltCalda: '35708',
  ovomaltPo: 'BK-SEM-0006',
  brownie: 'BK-SEM-0001',
  brownieAlt: '38585',
  pistache: '31161',
  choco: '36243',
  dl: '38838',
  morango: '30153',
  bis: '35912',
  shakeBase: '38008',
  proteina: 'BK-SEM-0007',
  prestigio: '35642',
};

/** Excel produto → códigos BK (e variantes de sabor) */
const PRODUTO_CODES = {
  'Casquinha Simples': ['20000', '20002', '8000043', '6005261'],
  'Casquinha Recheada de Nutella': ['8000177'],
  'Casquinha Recheada de Pistache': ['8000270'],
  'Casquinha Recheada de Chocolate e Doce de Leite': [
    { codigo: '8000001', sabor: 'choco' },
    { codigo: '8000007', sabor: 'dl' },
  ],
  'Sundae (Morango, Chocolate ou Doce de Leite)': [
    { codigo: '20008', sabor: 'choco' },
    { codigo: '8000045', sabor: 'dl' },
    { codigo: '8000081', sabor: 'morango' },
  ],
  'BK Mix de Nutella': ['8000176'],
  'BK Mix de Leite em Pó com Nutella': ['8000290'],
  'BK Mix de Ovomaltine': ['8000070', '8000115'],
  'BK Mix Brownie': ['8000066', '8000116'],
  'BK Mix Pistache': ['8000269'],
  'BK Mix Pistache com Brownie': ['8000274'],
  'BK Mix Pistache com Crumble': ['8000272'],
  'BK Mix Bis Xtra': ['8000291'],
  'Milk Shake Tradicional (Baunilha/Chocolate/Morango)': [
    { codigo: '7700021', sabor: 'bau' },
    { codigo: '7700016', sabor: 'choco' },
    { codigo: '7700019', sabor: 'morango' },
  ],
  'Milk Shake de Doce de Leite': ['7700017'],
  'Milk Shake de Ovomaltine': ['7700076'],
  'Milk Shake de Nutella': ['8000204'],
  'Milk Shake Brownie': ['7700072'],
  'BK Balde Ovomaltine': ['8000071'],
  'BK Balde Brownie': ['8000065'],
  'BK Balde de Chocolate': ['8000046'],
  'BK Balde de Morango': ['8000048'],
  'BK Balde Doce de Leite': ['8000061'],
  'BK Balde Bis Xtra': ['8000292'],
};

const PRODUTO_NOMES = {
  '8000290': 'BK MIX DE LEITE EM PÓ COM NUTELLA',
  '8000291': 'BK MIX BIS XTRA',
  '8000292': 'BK BALDE BIS XTRA',
};

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseQtd(qtdRaw) {
  if (qtdRaw == null || String(qtdRaw).trim() === '') return { q: 1, u: 'und' };
  let s = String(qtdRaw)
    .toLowerCase()
    .replace(/½|1\/2/g, '0.5')
    .replace(/,/g, '.')
    .trim();
  if (s.startsWith('+')) s = s.slice(1).trim();

  const volta = s.match(/([\d.]+)\s*voltas?/);
  if (volta) return { q: Number(volta[1]), u: 'volta' };
  const tiro = s.match(/([\d.]+)\s*tiros?/);
  if (tiro) return { q: Number(tiro[1]), u: 'concha' };
  const concha = s.match(/([\d.]+)\s*conchas?/);
  if (concha) return { q: Number(concha[1]), u: 'concha' };
  const g = s.match(/([\d.]+)\s*g\b/);
  if (g) return { q: Number(g[1]), u: 'g' };
  const fatia = s.match(/([\d.]+)\s*fatias?/);
  if (fatia) return { q: Number(fatia[1]), u: 'fatia' };
  const num = s.match(/^([\d.]+)$/);
  if (num) return { q: Number(num[1]), u: 'und' };
  return { q: 1, u: 'und' };
}

function saborCalda(sabor) {
  if (sabor === 'dl') return I.dl;
  if (sabor === 'morango') return I.morango;
  if (sabor === 'bau') return I.shakeBase;
  return I.choco;
}

/**
 * Converte linha do Excel → lista [codigo, q, uni, obs]
 */
function mapInsumoLinha(insumoNome, qtdRaw, obs, sabor) {
  const n = norm(insumoNome);
  const parsed = parseQtd(qtdRaw);
  const out = [];

  if (/PROTEINA|PROTEÍNA/.test(n) && /OPCIONAL/.test(n + ' ' + norm(obs || '') + ' ' + norm(qtdRaw || ''))) {
    return out; // opcional: não entra no custo padrão
  }
  if (/PROTEINA/.test(n) && String(qtdRaw || '').includes('+')) return out;

  if (/GUARDANAPO/.test(n) && /COLHER/.test(n)) {
    out.push([I.guardanapo, 1, 'und', 'Guardanapo']);
    out.push([I.colher, 1, 'und', 'Colher']);
    return out;
  }
  if (/GUARDANAPO/.test(n)) {
    out.push([I.guardanapo, parsed.q || 1, 'und', 'Guardanapo']);
    return out;
  }
  if (/COLHER/.test(n)) {
    out.push([I.colher, parsed.q || 1, 'und', 'Colher']);
    return out;
  }
  if (/CANUDO/.test(n)) {
    out.push([I.canudo, parsed.q || 1, 'und', 'Canudo']);
    return out;
  }
  if (/COPO DE BK MIX|COPO DE MIX|COPO MIX/.test(n)) {
    out.push([I.copoMix, 1, 'und', 'Copo de BK Mix']);
    return out;
  }
  if (/COPO DE SUNDAE|COPO SUNDAE/.test(n) && /SUPORTE/.test(n)) {
    // suporte não acompanha — não baixa estoque do produto
    return out;
  }
  if (/COPO DE SUNDAE|COPO SUNDAE/.test(n)) {
    out.push([I.copoSundae, 1, 'und', 'Copo Sundae']);
    return out;
  }
  if (/COPO DE SHAKE|COPO SHAKE/.test(n)) {
    out.push([I.copoShake, 1, 'und', 'Copo Shake']);
    return out;
  }
  if (/COPO DE BK BALDE|COPO\/?BALDE|BALDE|COPO DE BK BALDE/.test(n) || n === 'COPO DE BK BALDE') {
    out.push([I.balde, 1, 'und', 'Balde']);
    return out;
  }
  if (/CONE/.test(n) && /CASQUINHA/.test(n)) {
    out.push([I.cone, 1, 'und', 'Cone']);
    return out;
  }
  if (/SORVETE/.test(n)) {
    out.push([I.sorvete, parsed.q, parsed.u === 'volta' ? 'volta' : 'volta', 'Sorvete']);
    return out;
  }
  if (/NUTELLA/.test(n)) {
    out.push([I.nutella, parsed.q, 'concha', 'Nutella']);
    return out;
  }
  if (/LEITE EM PO|LEITE EM P/.test(n) || n === 'LEITE EM PO') {
    out.push([I.leitePo, parsed.q, 'concha', 'Leite em pó']);
    return out;
  }
  if (/FAROFA.*COOKIE|CRUMBLE/.test(n)) {
    out.push([I.crumble, parsed.q, 'concha', 'Crumble/Farofa cookies']);
    return out;
  }
  if (/CALDA OVOMALT/.test(n)) {
    out.push([I.ovomaltCalda, parsed.q, 'concha', 'Calda Ovomaltine']);
    return out;
  }
  if (/PO OVOMALT|OVOMALTINE EXTRA|OVOMALTINE/.test(n) && !/CALDA/.test(n)) {
    out.push([I.ovomaltPo, parsed.q, 'concha', 'Pó Ovomaltine']);
    return out;
  }
  if (/BROWNIE/.test(n)) {
    out.push([I.brownie, parsed.q, parsed.u === 'g' ? 'g' : 'concha', 'Brownie']);
    return out;
  }
  if (/PISTACHE/.test(n)) {
    out.push([I.pistache, parsed.q, 'concha', 'Pistache']);
    return out;
  }
  if (/BIS XTRA|BISXTRA/.test(n)) {
    out.push([I.bis, parsed.q, parsed.u === 'g' ? 'g' : 'concha', 'Bis Xtra']);
    return out;
  }
  if (/XAROPE BAUNILHA|XAROPE/.test(n)) {
    out.push([I.shakeBase, parsed.q, 'concha', 'Xarope/base baunilha']);
    return out;
  }
  if (/CALDA.*NUTELLA|CALDA NUTELLA/.test(n)) {
    out.push([I.nutella, parsed.q, 'concha', 'Calda Nutella']);
    return out;
  }
  if (/DOCE DE LEITE/.test(n) || (/CALDA/.test(n) && /DL|DOCE/.test(n))) {
    out.push([I.dl, parsed.q, 'concha', 'Doce de leite']);
    return out;
  }
  if (/MORANGO/.test(n)) {
    out.push([I.morango, parsed.q, 'concha', 'Morango']);
    return out;
  }
  if (/CHOCOLATE|CHOCO/.test(n)) {
    out.push([I.choco, parsed.q, 'concha', 'Chocolate']);
    return out;
  }
  if (/CALDA \(CHOCOLATE|CALDA \(CHOCOLATE\/DOCE|COBERTURA \(MORANGO/.test(n) || /CALDA.*OU.*MORANGO|COBERTURA \(/.test(n)) {
    out.push([saborCalda(sabor), parsed.q, 'concha', `Calda/cobertura (${sabor || 'choco'})`]);
    return out;
  }
  if (/COBERTURA/.test(n)) {
    out.push([saborCalda(sabor), parsed.q, 'concha', 'Cobertura']);
    return out;
  }
  if (/PRESTIGIO|PRESTÍGIO/.test(n)) {
    out.push([I.prestigio, parsed.q, 'concha', 'Prestígio']);
    return out;
  }

  console.warn('  ? insumo sem mapa:', insumoNome, qtdRaw);
  return out;
}

function montarItens(excelProduto, sabor) {
  const itens = [];
  for (const row of excelProduto.itens) {
    itens.push(...mapInsumoLinha(row.insumo, row.qtd, row.obs, sabor));
  }
  // merge same cod+uni
  const map = new Map();
  for (const [cod, q, uni, obs] of itens) {
    const key = `${cod}|${uni}`;
    const prev = map.get(key);
    if (prev) {
      prev.q += Number(q);
      if (obs && !prev.obs?.includes(obs)) prev.obs = prev.obs ? `${prev.obs}; ${obs}` : obs;
    } else {
      map.set(key, { cod, q: Number(q), uni, obs: obs || null });
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

async function ensureProduto(client, idLoja, codigo, descricao) {
  const { rows } = await client.query(
    `INSERT INTO produtos (id_loja, codigo, descricao, ativo)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (id_loja, codigo) DO UPDATE
       SET descricao = COALESCE(NULLIF(EXCLUDED.descricao,''), produtos.descricao),
           ativo = TRUE
     RETURNING id_produto, codigo, descricao`,
    [idLoja, codigo, descricao],
  );
  return rows[0];
}

async function upsertFicha(client, idProduto, itens, byCod) {
  const { rows: fr } = await client.query(
    `INSERT INTO ficha_tecnica (id_produto, ativo, observacao, atualizado_em)
     VALUES ($1, TRUE, $2, NOW())
     ON CONFLICT (id_produto) DO UPDATE
       SET ativo = TRUE, observacao = EXCLUDED.observacao, atualizado_em = NOW()
     RETURNING id_ficha`,
    [idProduto, 'lista_insumos_produtos_BK.xlsx (Treinamento sobremesas)'],
  );
  const idFicha = fr[0].id_ficha;
  await client.query('DELETE FROM ficha_tecnica_itens WHERE id_ficha = $1', [idFicha]);

  const rows = itens.filter((it) => byCod.has(it.cod) && it.q > 0);
  if (!rows.length) return 0;

  const values = [];
  const params = [];
  let i = 1;
  for (const it of rows) {
    const ins = byCod.get(it.cod);
    const qEst = qtdeReceitaParaEstoque(it.q, it.uni, ins);
    values.push(`($${i++},$${i++},$${i++},$${i++},$${i++},$${i++})`);
    params.push(idFicha, it.cod, it.q, it.uni, qEst, it.obs);
  }
  await client.query(
    `INSERT INTO ficha_tecnica_itens
       (id_ficha, codigo_insumo, quantidade, unidade_receita, qtde_estoque, observacao)
     VALUES ${values.join(',')}`,
    params,
  );
  return rows.length;
}

async function main() {
  const jsonPath = path.join(root, 'Arquivos BK/_extract/lista_insumos_produtos_BK.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Gere o JSON antes (python _tmp-read-excel-lista.py)');
    process.exit(1);
  }
  const lista = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const byNome = new Map(lista.map((p) => [p.produto, p]));

  console.log('DB', dbName);
  const client = await pool.connect();
  try {
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('ficha_tecnica_itens','id_item'),
        GREATEST((SELECT COALESCE(MAX(id_item),1) FROM ficha_tecnica_itens),1)
      )`);
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('ficha_tecnica','id_ficha'),
        GREATEST((SELECT COALESCE(MAX(id_ficha),1) FROM ficha_tecnica),1)
      )`);

    const { rows: lojas } = await client.query(`
      SELECT id_loja FROM lojas
      WHERE is_active IS DISTINCT FROM FALSE AND UPPER(name) LIKE 'BURGER KING%'
      ORDER BY id_loja`);

    let totalFichas = 0;
    let totalItens = 0;

    for (const loja of lojas) {
      await client.query('BEGIN');
      try {
        const { rows: insumos } = await client.query(
          `SELECT codigo, descricao, und_convertida FROM insumos WHERE id_loja = $1`,
          [loja.id_loja],
        );
        const byCod = new Map(insumos.map((i) => [i.codigo, i]));
        if (!byCod.has(I.leitePo) && byCod.has(I.leitePoAlt)) {
          byCod.set(I.leitePo, byCod.get(I.leitePoAlt));
        }
        if (!byCod.has(I.brownie) && byCod.has(I.brownieAlt)) {
          byCod.set(I.brownie, byCod.get(I.brownieAlt));
        }

        let lojaN = 0;
        for (const [nomeExcel, codes] of Object.entries(PRODUTO_CODES)) {
          const excelProd = byNome.get(nomeExcel);
          if (!excelProd) {
            console.warn('Excel sem produto:', nomeExcel);
            continue;
          }

          for (const entry of codes) {
            const codigo = typeof entry === 'string' ? entry : entry.codigo;
            const sabor = typeof entry === 'string' ? null : entry.sabor;
            const desc =
              PRODUTO_NOMES[codigo] ||
              (sabor
                ? `${nomeExcel} [${sabor}]`
                : nomeExcel.replace(/^BK Mix/i, 'BK MIX').toUpperCase());

            let prod = (
              await client.query(
                `SELECT id_produto, codigo, descricao FROM produtos
                 WHERE id_loja = $1 AND UPPER(codigo) = UPPER($2) LIMIT 1`,
                [loja.id_loja, codigo],
              )
            ).rows[0];

            if (!prod && PRODUTO_NOMES[codigo]) {
              prod = await ensureProduto(client, loja.id_loja, codigo, PRODUTO_NOMES[codigo]);
            }
            if (!prod) {
              // tenta por descrição (leite em pó)
              const d = norm(nomeExcel);
              if (/LEITE EM PO/.test(d) && /NUTELLA/.test(d)) {
                prod = await ensureProduto(
                  client,
                  loja.id_loja,
                  codigo,
                  PRODUTO_NOMES[codigo] || 'BK MIX DE LEITE EM PÓ COM NUTELLA',
                );
              } else {
                continue;
              }
            }

            const itens = montarItens(excelProd, sabor);
            const n = await upsertFicha(client, prod.id_produto, itens, byCod);
            if (n > 0) {
              lojaN += 1;
              totalFichas += 1;
              totalItens += n;
            }
          }
        }

        await client.query('COMMIT');
        console.log(`loja ${loja.id_loja}: ${lojaN} fichas`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    const check = await pool.query(
      `
      SELECT pv.codigo, pv.descricao,
             json_agg(json_build_object(
               'q', i.quantidade, 'u', i.unidade_receita, 'nome', COALESCE(ins.descricao, i.codigo_insumo)
             ) ORDER BY i.codigo_insumo) AS itens
      FROM produtos pv
      JOIN ficha_tecnica f ON f.id_produto = pv.id_produto AND f.ativo
      JOIN ficha_tecnica_itens i ON i.id_ficha = f.id_ficha
      LEFT JOIN insumos ins ON ins.id_loja = pv.id_loja AND UPPER(ins.codigo)=UPPER(i.codigo_insumo)
      WHERE pv.id_loja = $1
        AND pv.codigo IN ('8000176','8000290','8000066','8000070','8000177','20000')
      GROUP BY 1,2 ORDER BY 1
    `,
      [lojas[0].id_loja],
    );

    console.log('TOTAL', totalFichas, 'fichas,', totalItens, 'itens');
    console.log(JSON.stringify(check.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
