/**
 * Recarrega fichas de sobremesas a partir do PDF
 * "Treinamento de sobremesas 2025" (sem apagar sanduíches).
 *
 * node backend/scripts/recarregar-fichas-sobremesas.mjs
 */
import 'dotenv/config';
import pg from 'pg';
import { qtdeReceitaParaEstoque } from '../src/services/fichaReceitaEstoque.js';

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
  sorveteBau: '28459',
  sorveteDl: '35620',
  nutella: 'BK-SEM-0005',
  leitePo: 'BK-SEM-0039',
  crumble: '21215-2',
  ovomaltCalda: '35708',
  ovomaltPo: 'BK-SEM-0006',
  brownie: 'BK-SEM-0001',
  browniePeca: '38585',
  pistache: '31161',
  choco: '36243',
  dl: '38838',
  morango: '30153',
  bis: '35912',
  shakeBase: '38008',
  proteina: 'BK-SEM-0007',
};

/** [codigo_insumo, qtde, unidade, obs] */
const mixBase = (extras) => [
  [I.copoMix, 1, 'und', 'Copo de Bk Mix'],
  [I.sorveteBau, 4.5, 'volta', '4,5 voltas de sorvete'],
  ...extras,
  [I.guardanapo, 1, 'und', 'Guardanapo'],
  [I.colher, 1, 'und', 'Colher'],
];

const casquinhaBase = (extras) => [
  [I.cone, 1, 'und', 'Cone de Casquinha'],
  ...extras,
  [I.sorveteBau, 3.5, 'volta', '3,5 voltas de sorvete'],
  [I.guardanapo, 1, 'und', 'Guardanapo'],
];

const sundaeBase = (caldaCod, caldaObs) => [
  [I.copoSundae, 1, 'und', 'Copo de Sundae'],
  [caldaCod, 1, 'concha', `${caldaObs} (baixo)`],
  [I.sorveteBau, 3.5, 'volta', '3,5 voltas de sorvete'],
  [caldaCod, 1, 'concha', `${caldaObs} (cima)`],
  [I.crumble, 1, 'concha', 'Crumble cookies (opcional)'],
  [I.guardanapo, 1, 'und', 'Guardanapo'],
  [I.colher, 1, 'und', 'Colher'],
];

const shakeBase = (extras) => [
  [I.copoShake, 1, 'und', 'Copo de Shake'],
  [I.sorveteBau, 7.5, 'volta', '7,5 voltas de sorvete'],
  ...extras,
  [I.canudo, 1, 'und', 'Canudo'],
];

/** codigo produto → itens */
const FICHAS = {
  // Casquinhas
  '20000': casquinhaBase([]), // baunilha simples
  '20002': casquinhaBase([]), // mista
  '8000043': casquinhaBase([]), // casquinha DL sabor
  '6005261': casquinhaBase([]),
  '8000177': casquinhaBase([[I.nutella, 1, 'concha', '1 concha Nutella ½ oz']]),
  '8000270': casquinhaBase([[I.pistache, 1, 'concha', '1 concha pistache ½ oz']]),
  '8000001': casquinhaBase([[I.choco, 1, 'concha', '1 tiro chocolate ½ oz']]),
  '8000007': casquinhaBase([[I.dl, 1, 'concha', '1 tiro doce de leite ½ oz']]),
  '8000246': casquinhaBase([[I.ovomaltPo, 1, 'concha', 'Ovomaltine']]),
  '8000012': casquinhaBase([[I.ovomaltPo, 1, 'concha', 'Ovomaltine']]),

  // Sundae
  '20008': sundaeBase(I.choco, 'Calda chocolate'),
  '8000045': sundaeBase(I.dl, 'Calda doce de leite'),
  '8000081': sundaeBase(I.morango, 'Calda morango'),
  '8000013': [
    [I.copoSundae, 1, 'und', 'Copo Sundae'],
    [I.ovomaltCalda, 1, 'concha', 'Calda Ovomaltine'],
    [I.sorveteBau, 3.5, 'volta', '3,5 voltas'],
    [I.ovomaltPo, 1, 'concha', 'Pó Ovomaltine'],
    [I.guardanapo, 1, 'und', 'Guardanapo'],
    [I.colher, 1, 'und', 'Colher'],
  ],

  // BK Mix — Treinamento sobremesas 2025
  '8000176': mixBase([
    [I.nutella, 2, 'concha', '2 tiros Nutella ½ oz'],
    [I.crumble, 1, 'concha', '1 concha farofa cookies'],
  ]),
  // Variante PDF p.9 — se existir produto com descrição leite em pó
  'BK-MIX-LEITE-NUTELLA': mixBase([
    [I.leitePo, 1, 'concha', '1 concha leite em pó ½ oz'],
    [I.nutella, 2, 'concha', '2 tiros Nutella ½ oz'],
  ]),
  '8000070': mixBase([
    [I.ovomaltCalda, 1, 'concha', '1 concha calda Ovomaltine'],
    [I.ovomaltPo, 2, 'concha', '2 conchas pó Ovomaltine'],
  ]),
  '8000115': mixBase([
    [I.ovomaltCalda, 1, 'concha', '1 concha calda Ovomaltine'],
    [I.ovomaltPo, 2, 'concha', '2 conchas pó Ovomaltine'],
  ]),
  '8000066': mixBase([
    [I.dl, 1, 'concha', '1 tiro doce de leite ½ oz'],
    [I.brownie, 1, 'concha', '1 concha brownie ½ oz'],
  ]),
  '8000116': mixBase([
    [I.dl, 1, 'concha', '1 tiro doce de leite ½ oz'],
    [I.brownie, 1, 'concha', '1 concha brownie ½ oz'],
  ]),
  '8000269': mixBase([[I.pistache, 1, 'concha', '1 concha calda pistache']]),
  '8000274': mixBase([
    [I.pistache, 1, 'concha', '1 concha calda pistache'],
    [I.brownie, 1, 'concha', '1 concha brownie picado'],
  ]),
  '8000272': mixBase([
    [I.pistache, 1, 'concha', '1 concha calda pistache'],
    [I.crumble, 1, 'concha', '1 concha crumble cookies'],
  ]),
  '8000288': mixBase([
    [I.choco, 1, 'concha', '1 concha chocolate'],
    ['35642', 1, 'concha', 'Prestígio'],
  ]),

  // Baldes
  '8000046': [
    [I.balde, 1, 'und', 'Balde'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.choco, 1, 'concha', '1 tiro chocolate'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.choco, 1, 'concha', '1 tiro chocolate'],
    [I.colher, 2, 'und', '2 colheres'],
  ],
  '8000048': [
    [I.balde, 1, 'und', 'Balde'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.morango, 1, 'concha', '1 tiro morango'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.morango, 1, 'concha', '1 tiro morango'],
    [I.colher, 2, 'und', '2 colheres'],
  ],
  '8000061': [
    [I.balde, 1, 'und', 'Balde'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.dl, 1, 'concha', '1 tiro doce de leite'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.dl, 1, 'concha', '1 tiro doce de leite'],
    [I.colher, 2, 'und', '2 colheres'],
  ],
  '8000065': [
    [I.balde, 1, 'und', 'Balde'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.dl, 2, 'concha', '2 tiros doce de leite'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.dl, 2, 'concha', '2 tiros doce de leite'],
    [I.brownie, 2, 'concha', '2 conchas brownie'],
    [I.colher, 2, 'und', '2 colheres'],
  ],
  '8000071': [
    [I.balde, 1, 'und', 'Balde'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.ovomaltCalda, 2, 'concha', '2 conchas calda Ovomaltine'],
    [I.ovomaltPo, 2, 'concha', '2 conchas pó Ovomaltine'],
    [I.sorveteBau, 5, 'volta', '5 voltas'],
    [I.ovomaltCalda, 2, 'concha', '2 conchas calda Ovomaltine'],
    [I.ovomaltPo, 2, 'concha', '2 conchas pó Ovomaltine'],
    [I.colher, 2, 'und', '2 colheres'],
  ],

  // Shakes
  '7700021': shakeBase([[I.shakeBase, 2, 'concha', 'Xarope/base baunilha']]),
  '7700016': shakeBase([
    [I.shakeBase, 2, 'concha', 'Base baunilha'],
    [I.choco, 2, 'concha', 'Cobertura chocolate'],
  ]),
  '7700017': shakeBase([
    [I.shakeBase, 2, 'concha', 'Base baunilha'],
    [I.dl, 2, 'concha', 'Cobertura doce de leite'],
  ]),
  '7700019': shakeBase([
    [I.shakeBase, 2, 'concha', 'Base baunilha'],
    [I.morango, 2, 'concha', 'Cobertura morango'],
  ]),
  '8000204': shakeBase([
    [I.shakeBase, 2, 'concha', 'Xarope baunilha'],
    [I.nutella, 2, 'concha', '2 tiros Nutella'],
  ]),
  '7700072': shakeBase([
    [I.shakeBase, 2, 'concha', 'Xarope baunilha'],
    [I.dl, 1, 'concha', '1 tiro doce de leite'],
    [I.brownie, 1, 'concha', '1 concha brownie'],
  ]),
  '8000289': shakeBase([['35642', 1, 'concha', 'Prestígio']]),
  '21': shakeBase([
    [I.shakeBase, 2, 'concha', 'Base'],
    [I.proteina, 3, 'concha', '3 conchas proteína'],
  ]),
};

function descNorm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function receitaPara(codigo, descricao) {
  const d = descNorm(descricao);
  if (/MIX/.test(d) && /LEITE/.test(d) && /NUTELLA/.test(d) && /PO|PO\b|NINHO/.test(d)) {
    return FICHAS['BK-MIX-LEITE-NUTELLA'];
  }
  if (/MIX/.test(d) && /NUTELLA/.test(d) && /LEITE.*PO|PO.*NUTELLA/.test(d)) {
    return FICHAS['BK-MIX-LEITE-NUTELLA'];
  }
  if (/MIX.*LEITE EM PO.*NUTELLA|LEITE EM PO COM NUTELLA/.test(d)) {
    return FICHAS['BK-MIX-LEITE-NUTELLA'];
  }
  return FICHAS[String(codigo)] || null;
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

async function upsertFicha(client, idProduto, itens, byCod, obs) {
  const { rows: fr } = await client.query(
    `INSERT INTO ficha_tecnica (id_produto, ativo, observacao, atualizado_em)
     VALUES ($1, TRUE, $2, NOW())
     ON CONFLICT (id_produto) DO UPDATE
       SET ativo = TRUE, observacao = EXCLUDED.observacao, atualizado_em = NOW()
     RETURNING id_ficha`,
    [idProduto, obs],
  );
  const idFicha = fr[0].id_ficha;
  await client.query('DELETE FROM ficha_tecnica_itens WHERE id_ficha = $1', [idFicha]);

  const merged = new Map();
  for (const [cod, q, uni, o] of itens) {
    if (!byCod.has(String(cod)) || !(Number(q) > 0)) continue;
    const key = `${cod}|${uni}`;
    const prev = merged.get(key);
    if (prev) {
      prev.q += Number(q);
      if (o && !prev.obs.includes(o)) prev.obs = `${prev.obs}; ${o}`;
    } else {
      merged.set(key, { cod: String(cod), q: Number(q), uni, obs: o || null });
    }
  }
  const rows = [...merged.values()];
  if (!rows.length) return 0;

  const values = [];
  const params = [];
  let i = 1;
  for (const it of rows) {
    const ins = byCod.get(it.cod) || { descricao: '', und_convertida: 1 };
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
  console.log('DB', dbName);
  const client = await pool.connect();
  try {
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('ficha_tecnica_itens', 'id_item'),
        GREATEST((SELECT COALESCE(MAX(id_item), 1) FROM ficha_tecnica_itens), 1)
      )
    `);
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('ficha_tecnica', 'id_ficha'),
        GREATEST((SELECT COALESCE(MAX(id_ficha), 1) FROM ficha_tecnica), 1)
      )
    `);

    const { rows: lojasBk } = await client.query(`
      SELECT id_loja FROM lojas
      WHERE is_active IS DISTINCT FROM FALSE AND UPPER(name) LIKE 'BURGER KING%'
      ORDER BY id_loja
    `);

    let fichas = 0;
    let itensN = 0;
    let skip = 0;

    for (const loja of lojasBk) {
      await client.query('BEGIN');
      try {
        const { rows: insumos } = await client.query(
          `SELECT codigo, descricao, und_convertida FROM insumos WHERE id_loja = $1`,
          [loja.id_loja],
        );
        const byCod = new Map(insumos.map((i) => [i.codigo, i]));

        if (!byCod.has(I.leitePo) && byCod.has('3841')) byCod.set(I.leitePo, byCod.get('3841'));
        if (!byCod.has(I.brownie) && byCod.has(I.browniePeca)) {
          byCod.set(I.brownie, byCod.get(I.browniePeca));
        }

        const { rows: prods } = await client.query(
          `SELECT id_produto, codigo, descricao FROM produtos WHERE id_loja = $1 AND ativo`,
          [loja.id_loja],
        );

        let lojaFichas = 0;
        for (const p of prods) {
          let rec = receitaPara(p.codigo, p.descricao);
          if (!rec) {
            const d = descNorm(p.descricao);
            if (/BK MIX/.test(d) && /LEITE/.test(d) && /NUTELLA/.test(d)) {
              rec = FICHAS['BK-MIX-LEITE-NUTELLA'];
            }
          }
          if (!rec) continue;

          const itensOk = rec.filter(([c, q]) => byCod.has(String(c)) && Number(q) > 0);
          if (!itensOk.length) {
            skip += 1;
            continue;
          }
          const n = await upsertFicha(
            client,
            p.id_produto,
            itensOk,
            byCod,
            'Receita Treinamento de sobremesas 2025',
          );
          fichas += 1;
          lojaFichas += 1;
          itensN += n;
        }
        await client.query('COMMIT');
        console.log(`loja ${loja.id_loja}: ${lojaFichas} fichas`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    const check = await pool.query(
      `
      SELECT pv.codigo, pv.descricao,
             json_agg(json_build_object(
               'cod', i.codigo_insumo,
               'q', i.quantidade,
               'u', i.unidade_receita,
               'nome', ins.descricao
             ) ORDER BY i.codigo_insumo) AS itens
      FROM produtos pv
      JOIN ficha_tecnica f ON f.id_produto = pv.id_produto AND f.ativo
      JOIN ficha_tecnica_itens i ON i.id_ficha = f.id_ficha
      LEFT JOIN insumos ins ON ins.id_loja = pv.id_loja AND UPPER(ins.codigo)=UPPER(i.codigo_insumo)
      WHERE pv.id_loja = $1 AND pv.codigo IN ('8000176','8000066','8000070','20000','8000177')
      GROUP BY 1,2
      ORDER BY 1
    `,
      [lojasBk[0].id_loja],
    );
    console.log('TOTAL fichas', fichas, 'itens', itensN, 'skip', skip);
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
