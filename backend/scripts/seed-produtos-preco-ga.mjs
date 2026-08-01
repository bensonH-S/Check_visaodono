/**
 * Recarrega produtos a partir de PRECO GA (Arquivos BK) em todas as lojas
 * exceto Popeyes, e amarra fichas técnicas (insumos → produtos) onde for possível.
 *
 * Pré-requisito: insumos BK já carregados (seed-estoque-bk-arquivos.mjs).
 * Uso: node backend/scripts/seed-produtos-preco-ga.mjs
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const extractDir = path.join(root, 'Arquivos BK', '_extract');

const dbName = process.env.DB_NAME || '';
if (!/dev/i.test(dbName)) {
  console.error(`ABORT: DB_NAME="${dbName}" não parece DEV.`);
  process.exit(1);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(extractDir, name), 'utf8'));
}

/** Receitas conhecidas (MONTAGEM / alertas / sobremesas) — codigo produto → insumos */
const FICHAS = {
  '1050': [
    ['38636', 1, 'Pão Whopper'],
    ['37967', 21, 'Maionese 21g'],
    ['25622', 21, 'Alface 21g'],
    ['35407', 14, 'Ketchup'],
    ['35562', 14, 'Cebola 14g'],
    ['35835', 4, 'Picles 4 fatias'],
    ['34840', 1, 'Carne Whopper'],
    ['3029', 2, 'Queijo 2 fatias'],
    ['35046-2', 2, 'Tomate 2 fatias'],
  ],
  '1052': [
    ['38636', 1, 'Pão Whopper'],
    ['37967', 21, 'Maionese'],
    ['25622', 21, 'Alface'],
    ['35407', 14, 'Ketchup'],
    ['35562', 14, 'Cebola'],
    ['35835', 4, 'Picles'],
    ['34840', 2, '2 carnes Whopper'],
    ['3029', 2, 'Queijo'],
    ['35046-2', 2, 'Tomate'],
  ],
  '1600': [
    ['37967', 11, 'Maionese 11g'],
    ['25622', 11, 'Alface'],
    ['35407', 9, 'Ketchup'],
    ['35562', 7, 'Cebola'],
    ['35835', 2, 'Picles'],
    ['34840', 1, 'Carne Whopper'],
    ['3029', 1, 'Queijo'],
    ['35046-2', 1, 'Tomate'],
  ],
  '1700': [
    ['38636', 1, 'Pão Whopper'],
    ['37967', 21, 'Maionese'],
    ['25622', 21, 'Alface'],
    ['38594', 14, 'Molho Furioso'],
    ['36084', 4, 'Jalapeño'],
    ['34840', 1, 'Carne Whopper'],
    ['3029', 2, 'Queijo'],
    ['35046-2', 2, 'Tomate'],
    ['21317', 3, 'Bacon'],
    ['38635', 4, 'Onion Rings'],
  ],
  '7100100': [
    ['38636', 1, 'Pão Whopper'],
    ['37967', 21, 'Maionese'],
    ['25622', 21, 'Alface'],
    ['35205-2', 14, 'BBQ'],
    ['35562', 14, 'Cebola'],
    ['35835', 4, 'Picles'],
    ['34840', 1, 'Carne Whopper'],
    ['3029', 2, 'Queijo'],
    ['35046-2', 2, 'Tomate'],
    ['21317', 3, 'Bacon'],
  ],
  '7100101': [
    ['38636', 1, 'Pão'],
    ['37967', 21, 'Maionese'],
    ['25622', 21, 'Alface'],
    ['35205-2', 14, 'BBQ'],
    ['34840', 1, 'Carne Whopper'],
    ['3029', 2, 'Queijo'],
    ['35046-2', 2, 'Tomate'],
    ['38635', 6, 'Onion Rings'],
  ],
  '7100088': [
    ['38636', 1, 'Pão Whopper'],
    ['37967', 21, 'Maionese'],
    ['25622', 21, 'Alface'],
    ['35407', 14, 'Ketchup'],
    ['35562', 14, 'Cebola'],
    ['35835', 4, 'Picles'],
    ['21403', 1, 'Rebel / plantas'],
    ['3029', 2, 'Queijo'],
    ['35046-2', 2, 'Tomate'],
  ],
  '7100023': [
    ['38638', 1, 'Pão Supremo'],
    ['35408', 22, 'Stacker 11+11g'],
    ['25622', 11, 'Alface'],
    ['34754', 2, '2 HB'],
    ['3029', 1, 'Queijo'],
    ['35835', 2, 'Picles'],
    ['35562', 2, 'Cebola'],
  ],
  '2100': [
    ['34754', 1, 'Carne HB'],
    ['3029', 1, 'Queijo'],
    ['35835', 2, 'Picles'],
    ['35407', 9, 'Ketchup'],
    ['35740', 3, 'Mostarda'],
  ],
  '7100055': [
    ['34754', 2, '2 HB'],
    ['3029', 2, 'Queijo'],
    ['35835', 1, 'Picles'],
    ['35407', 9, 'Ketchup'],
    ['35740', 3, 'Mostarda'],
  ],
  '7100105': [
    ['34754', 2, '2 HB'],
    ['35408', 14, 'Stacker'],
    ['3029', 1, 'Queijo'],
    ['21317', 3, 'Bacon'],
  ],
  '2610': [
    ['38636', 1, 'Pão'],
    ['35408', 37, 'Stacker 37g'],
    ['34840', 2, '2 Whopper'],
    ['3029', 4, 'Queijo'],
    ['21317', 3, 'Bacon'],
  ],
  '2064': [
    ['35221', 1, 'Chicken Jr'],
    ['37967', 11, 'Maionese'],
  ],
  '7100095': [
    ['35221', 2, '2 Chicken Jr'],
    ['37967', 22, 'Maionese'],
    ['3029', 1, 'Queijo'],
  ],
  '7100123': [
    ['BK-SEM-0003', 1, 'Pão brioche'],
    ['37967', 11, 'Maionese'],
    ['25622', 11, 'Alface'],
    ['38639', 1, 'Tender Crispy'],
  ],
  '7100161': [
    ['36252', 1, 'Carne gourmet'],
    ['35610', 14, 'Cheddar'],
    ['30489', 14, 'Cebola crispy'],
    ['BK-SEM-0003', 1, 'Pão brioche / HB'],
  ],
  '7210100': [
    ['34754', 1, 'Carne'],
    ['35610', 14, 'Cheddar'],
    ['35562', 3, 'Cebola'],
  ],
  '7100036': [
    ['34754', 1, 'Carne HB'],
    ['37967', 11, 'Maionese'],
    ['3029', 1, 'Queijo'],
    ['38635', 3, 'Onion Rings'],
    ['35205-2', 14, 'BBQ'],
  ],
  '7100102': [
    ['34754', 2, '2 HB'],
    ['37967', 11, 'Maionese'],
    ['3029', 1, 'Queijo'],
    ['38635', 3, 'Onion Rings'],
    ['35205-2', 14, 'BBQ'],
  ],
  '7210461': [
    ['BK-SEM-0003', 1, 'Pão brioche'],
    ['38537', 3.5, 'Baconese'],
    ['34840', 1, 'Carne Whopper'],
    ['3029', 2, 'Queijo'],
    ['221000000418', 2, 'Fraldinha'],
    ['38635', 3, 'Onion Rings'],
    ['BK-SEM-0032', 1, 'Caixa The Kings'],
  ],
  '7210587': [
    ['BK-SEM-0003', 1, 'Pão brioche'],
    ['25622', 22, 'Alface'],
    ['221000000856', 3.5, 'Sweet Spicy'],
    ['BK-PATTY-MUSS', 1, 'Patty mussarela'],
    ['34840', 1, 'Carne Whopper'],
    ['35046-2', 2, 'Tomate'],
    ['3029', 2, 'Queijo'],
    ['BK-SEM-0032', 1, 'Caixa The Kings'],
  ],
  '7210588': [
    ['BK-SEM-0003', 1, 'Pão brioche'],
    ['25622', 22, 'Alface'],
    ['221000000856', 3.5, 'Sweet Spicy'],
    ['BK-PATTY-MUSS', 1, 'Patty mussarela'],
    ['38639', 1, 'Chicken'],
    ['35046-2', 2, 'Tomate'],
    ['3029', 2, 'Queijo'],
    ['BK-SEM-0032', 1, 'Caixa The Kings'],
  ],
  '8500037': [
    ['35221', 2, '2 Chicken'],
    ['37967', 22, 'Maionese'],
    ['3029', 1, 'Queijo'],
    ['21317', 2, 'Bacon'],
  ],
  '8500038': [
    ['35221', 2, '2 Chicken'],
    ['37967', 11, 'Maionese'],
    ['35205-2', 14, 'BBQ'],
    ['21317', 2, 'Bacon'],
  ],
  '8500036': [
    ['35221', 2, '2 Chicken'],
    ['38594', 14, 'Furioso'],
    ['3029', 1, 'Queijo'],
  ],
  // Acompanhamentos
  '6011': [['28582', 0.08, 'Batata P']],
  '6012': [['28582', 0.12, 'Batata M']],
  '6013': [['28582', 0.16, 'Batata G']],
  '6017': [['38635', 0.1, 'Onion M']],
  '6018': [['38635', 0.14, 'Onion G']],
  '7300005': [['38635', 0.08, 'Onion P']],
  '6508': [['38178', 4, 'Nuggets 4un']],
  '7300052': [['38178', 10, 'Nuggets 10un']],
  // Sobremesas
  '20000': [['38454', 1, 'Cone']],
  '20002': [['38454', 1, 'Cone']],
  '8000177': [
    ['38454', 1, 'Cone'],
    ['BK-SEM-0005', 0.5, 'Nutella'],
  ],
  '8000007': [
    ['38454', 1, 'Cone'],
    ['38838', 0.5, 'Doce de leite'],
  ],
  '8000001': [
    ['38454', 1, 'Cone'],
    ['36243', 0.5, 'Chocolate'],
  ],
  '20008': [
    ['35144-2', 1, 'Copo sundae'],
    ['36243', 1, 'Chocolate'],
  ],
  '8000045': [
    ['35144-2', 1, 'Copo'],
    ['38838', 1, 'Doce de leite'],
  ],
  '8000081': [
    ['35144-2', 1, 'Copo'],
    ['30153', 1, 'Morango'],
  ],
  '8000176': [
    ['29000', 1, 'Copo mix'],
    ['BK-SEM-0005', 1, 'Nutella'],
    ['21215-2', 0.5, 'Crumble'],
  ],
  '8000066': [
    ['29000', 1, 'Copo'],
    ['38585', 1, 'Brownie'],
  ],
  '8000070': [
    ['29000', 1, 'Copo'],
    ['BK-SEM-0006', 1, 'Ovomaltine'],
  ],
  '8000204': [
    ['35144', 1, 'Copo shake'],
    ['BK-SEM-0005', 1, 'Nutella'],
    ['38008', 1, 'Base shake'],
  ],
  '7700019': [
    ['35144', 1, 'Copo'],
    ['30153', 1, 'Morango'],
    ['38008', 1, 'Base shake'],
  ],
  '7700017': [
    ['35144', 1, 'Copo'],
    ['38838', 1, 'Doce de leite'],
    ['38008', 1, 'Base shake'],
  ],
  '7700016': [
    ['35144', 1, 'Copo'],
    ['36243', 1, 'Chocolate'],
    ['38008', 1, 'Base shake'],
  ],
  '7700021': [
    ['35144', 1, 'Copo'],
    ['38008', 1, 'Base baunilha'],
  ],
  // Bebidas / sucos
  '7500029': [['38021', 1, 'Suco laranja']],
  '7500030': [['35959', 1, 'Suco uva']],
  '7500031': [['10138', 1, 'Suco maracujá']],
  // Extras comuns
  '8700001': [['37967', 11, 'Extra maionese']],
  '8700004': [['35610', 11, 'Extra cheddar']],
  '8700007': [['36084', 4, 'Extra jalapeño']],
  '27002': [['34840', 1, 'Extra carne Whopper']],
};

/** Combos: herdam ficha do sanduíche individual + batata média */
const COMBO_PARA_INDIVIDUAL = {
  '1051': '1050', // COMBO WHOPPER
  '1601': '1600',
  '2101': '2100',
  '2065': '2064',
  '7100018': '7100023',
  '6002384': '7100095',
  '6005985': '7100055',
  '6002696': '7100102',
  '6004204': '7100105',
  '6001645': '7100088',
  '6006751': '7100161',
  '7000007': '7100036',
};

function fichaDoProduto(codigo) {
  if (FICHAS[codigo]) return FICHAS[codigo];
  const base = COMBO_PARA_INDIVIDUAL[codigo];
  if (base && FICHAS[base]) {
    return [...FICHAS[base], ['28582', 0.12, 'Batata M (combo)']];
  }
  return null;
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('DB:', dbName);
  const produtos = readJson('produtos_preco_ga.json');
  console.log('Produtos PRECO GA:', produtos.length);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE produtos ADD COLUMN IF NOT EXISTS preco_venda NUMERIC(14, 2)
    `);

    const { rows: lojas } = await client.query(`
      SELECT id_loja, name
      FROM lojas
      WHERE is_active IS DISTINCT FROM FALSE
        AND UPPER(name) NOT LIKE '%POPEYE%'
        AND UPPER(name) NOT LIKE '%POPYES%'
      ORDER BY id_loja
    `);
    console.log('Lojas (exceto Popeyes):', lojas.length, lojas.map((l) => l.name).join(' | '));

    const { rows: lojasBk } = await client.query(`
      SELECT id_loja FROM lojas
      WHERE is_active IS DISTINCT FROM FALSE
        AND UPPER(name) LIKE 'BURGER KING%'
      ORDER BY id_loja
    `);
    const bkIds = new Set(lojasBk.map((l) => l.id_loja));

    console.log('Removendo produtos/fichas atuais…');
    await client.query('DELETE FROM ficha_tecnica_itens');
    await client.query('DELETE FROM ficha_tecnica');
    await client.query('UPDATE estoque_venda_itens SET id_produto = NULL');
    await client.query('UPDATE estoque_break_itens SET id_produto = NULL');
    await client.query('DELETE FROM produtos');
    await client.query(`SELECT setval(pg_get_serial_sequence('produtos','id_produto'), 1, false)`);
    await client.query(`SELECT setval(pg_get_serial_sequence('ficha_tecnica','id_ficha'), 1, false)`);
    await client.query(
      `SELECT setval(pg_get_serial_sequence('ficha_tecnica_itens','id_item'), 1, false)`,
    );

    console.log('Inserindo produtos…');
    const idMap = new Map();
    for (const loja of lojas) {
      const values = [];
      const params = [];
      let i = 1;
      for (const p of produtos) {
        const preco = p.preco_ga ?? p.preco_novo ?? null;
        values.push(`($${i++},$${i++},$${i++},TRUE,$${i++},NOW())`);
        params.push(String(p.codigo), String(p.descricao).slice(0, 500), loja.id_loja, preco);
      }
      const { rows } = await client.query(
        `INSERT INTO produtos (codigo, descricao, id_loja, ativo, preco_venda, atualizado_em)
         VALUES ${values.join(',')}
         RETURNING id_produto, codigo`,
        params,
      );
      for (const row of rows) {
        idMap.set(`${loja.id_loja}::${row.codigo}`, row.id_produto);
      }
    }

    // Códigos de insumo disponíveis (loja BK de referência)
    const amostraBk = lojasBk[0]?.id_loja;
    const { rows: insumosDisp } = await client.query(
      `SELECT DISTINCT codigo FROM insumos WHERE id_loja = $1`,
      [amostraBk],
    );
    const insumosOk = new Set(insumosDisp.map((r) => r.codigo));

    console.log('Criando fichas nas lojas BK…');
    let fichas = 0;
    let itens = 0;
    let produtosComFicha = new Set();
    for (const loja of lojas) {
      if (!bkIds.has(loja.id_loja)) continue;
      for (const p of produtos) {
        const receita = fichaDoProduto(String(p.codigo));
        if (!receita) continue;
        const idProduto = idMap.get(`${loja.id_loja}::${p.codigo}`);
        if (!idProduto) continue;

        const itensOk = receita.filter(([cod, q]) => insumosOk.has(String(cod)) && Number(q) > 0);
        if (!itensOk.length) continue;

        const { rows: fRows } = await client.query(
          `INSERT INTO ficha_tecnica (id_produto, ativo, observacao, atualizado_em)
           VALUES ($1, TRUE, $2, NOW()) RETURNING id_ficha`,
          [idProduto, 'Ficha PRECO GA + MONTAGEM/Arquivos BK'],
        );
        const idFicha = fRows[0].id_ficha;
        fichas += 1;
        produtosComFicha.add(p.codigo);
        for (const [cod, q, obs] of itensOk) {
          await client.query(
            `INSERT INTO ficha_tecnica_itens (id_ficha, codigo_insumo, quantidade, observacao)
             VALUES ($1,$2,$3,$4)`,
            [idFicha, String(cod), Number(q), obs || null],
          );
          itens += 1;
        }
      }
    }

    await client.query('COMMIT');

    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM produtos) AS produtos,
        (SELECT COUNT(DISTINCT id_loja)::int FROM produtos) AS lojas_produtos,
        (SELECT COUNT(*)::int FROM ficha_tecnica) AS fichas,
        (SELECT COUNT(*)::int FROM ficha_tecnica_itens) AS ficha_itens,
        (SELECT COUNT(*)::int FROM insumos) AS insumos
    `);
    console.log('OK', counts.rows[0]);
    console.log(
      `Produtos do cardápio com ficha (códigos únicos): ${produtosComFicha.size} / ${produtos.length}`,
    );
    console.log(`Fichas criadas: ${fichas} (${itens} itens)`);

    const sem = produtos.filter((p) => !produtosComFicha.has(String(p.codigo)));
    console.log(`Sem ficha ainda: ${sem.length} (ex.: ${sem.slice(0, 8).map((p) => p.codigo + ' ' + p.descricao).join(' ; ')})`);
  } catch (e) {
    await client.query('ROLLBACK');
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
