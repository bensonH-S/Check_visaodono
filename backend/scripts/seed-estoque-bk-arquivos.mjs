/**
 * Reseta insumos/produtos no banco DEV e recarrega catálogo BK
 * a partir de Arquivos BK (Excel de contagem + fichas de montagem/alertas).
 *
 * Uso: node backend/scripts/seed-estoque-bk-arquivos.mjs
 * Só roda se DB_NAME contiver "dev".
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
  console.error(`ABORT: DB_NAME="${dbName}" não parece DEV. Use vision_check_dev.`);
  process.exit(1);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(extractDir, name), 'utf8'));
}

/** Aliases de receita → código de insumo do Excel / SAP dos alertas */
const INSUMO_EXTRA = [
  {
    codigo: '221000000418',
    descricao: 'CARNE FRALDINHA DESF DEFUMADA CX 4KG 4x1',
    categoria: 'MOLHOS E CONDIMENTOS',
    unidade_contagem: 'UND',
  },
  {
    codigo: '221000000856',
    descricao: 'BK COPA MOLHO THAI SWEET CHILI BK CX/3,3KG',
    categoria: 'MOLHOS E CONDIMENTOS',
    unidade_contagem: 'UND',
  },
  {
    codigo: 'BK-PATTY-MUSS',
    descricao: 'PATTY MUSSARELA EMPANADA (ALERTA OPS)',
    categoria: 'LANCAMENTO',
    unidade_contagem: 'UND',
  },
];

/**
 * Fichas: codigo_produto → itens { codigo_insumo, quantidade, obs? }
 * Quantidades em porções/unidade de baixa (g, fatia, peça) conforme material de apoio.
 */
const FICHAS = {
  // Whopper com queijo
  '1050': [
    { codigo_insumo: '38636', quantidade: 1, obs: 'Pão Whopper (coroa+base)' },
    { codigo_insumo: '37967', quantidade: 21, obs: 'Maionese 21g' },
    { codigo_insumo: '25622', quantidade: 21, obs: 'Alface 21g' },
    { codigo_insumo: '35407', quantidade: 14, obs: 'Ketchup ~14g' },
    { codigo_insumo: '35562', quantidade: 14, obs: 'Cebola 14g / 3 aros' },
    { codigo_insumo: '35835', quantidade: 4, obs: 'Picles 4 fatias' },
    { codigo_insumo: '34840', quantidade: 1, obs: 'Carne Whopper' },
    { codigo_insumo: '3029', quantidade: 2, obs: 'Queijo 2 fatias' },
    { codigo_insumo: '35046-2', quantidade: 2, obs: 'Tomate 2 fatias' },
  ],
  '1600': [
    { codigo_insumo: '34754', quantidade: 1, obs: 'Carne (base Jr usa carne Whopper no material; HB no cadastro)' },
    { codigo_insumo: '37967', quantidade: 11, obs: 'Maionese 11g' },
    { codigo_insumo: '25622', quantidade: 11, obs: 'Alface 11g' },
    { codigo_insumo: '35407', quantidade: 9, obs: 'Ketchup' },
    { codigo_insumo: '35562', quantidade: 7, obs: 'Cebola 7g' },
    { codigo_insumo: '35835', quantidade: 2, obs: 'Picles 2 fatias' },
    { codigo_insumo: '34840', quantidade: 1, obs: 'Carne Whopper' },
    { codigo_insumo: '3029', quantidade: 1, obs: 'Queijo 1 fatia' },
    { codigo_insumo: '35046-2', quantidade: 1, obs: 'Tomate 1 fatia' },
  ],
  '1700': [
    { codigo_insumo: '38636', quantidade: 1, obs: 'Pão Whopper' },
    { codigo_insumo: '37967', quantidade: 21, obs: 'Maionese 21g' },
    { codigo_insumo: '25622', quantidade: 21, obs: 'Alface' },
    { codigo_insumo: '38594', quantidade: 14, obs: 'Molho Furioso' },
    { codigo_insumo: '36084', quantidade: 4, obs: 'Jalapeño 4 fatias' },
    { codigo_insumo: '34840', quantidade: 1, obs: 'Carne Whopper' },
    { codigo_insumo: '3029', quantidade: 2, obs: 'Queijo 2 fatias' },
    { codigo_insumo: '35046-2', quantidade: 2, obs: 'Tomate 2 fatias' },
    { codigo_insumo: '21317', quantidade: 3, obs: 'Bacon 3 fatias' },
    { codigo_insumo: '38635', quantidade: 4, obs: 'Onion Rings 4 aros' },
  ],
  '7100100': [
    { codigo_insumo: '38636', quantidade: 1, obs: 'Pão Whopper' },
    { codigo_insumo: '37967', quantidade: 21, obs: 'Maionese 21g' },
    { codigo_insumo: '25622', quantidade: 21, obs: 'Alface' },
    { codigo_insumo: '35205-2', quantidade: 14, obs: 'Molho BBQ' },
    { codigo_insumo: '35562', quantidade: 14, obs: 'Cebola' },
    { codigo_insumo: '35835', quantidade: 4, obs: 'Picles 4 fatias' },
    { codigo_insumo: '34840', quantidade: 1, obs: 'Carne Whopper' },
    { codigo_insumo: '3029', quantidade: 2, obs: 'Queijo' },
    { codigo_insumo: '35046-2', quantidade: 2, obs: 'Tomate' },
    { codigo_insumo: '21317', quantidade: 3, obs: 'Bacon 3 fatias' },
  ],
  '7100101': [
    { codigo_insumo: '38636', quantidade: 1, obs: 'Pão Whopper' },
    { codigo_insumo: '37967', quantidade: 21, obs: 'Maionese' },
    { codigo_insumo: '25622', quantidade: 21, obs: 'Alface' },
    { codigo_insumo: '35205-2', quantidade: 14, obs: 'Molho BBQ' },
    { codigo_insumo: '34840', quantidade: 1, obs: 'Carne Whopper' },
    { codigo_insumo: '3029', quantidade: 2, obs: 'Queijo' },
    { codigo_insumo: '35046-2', quantidade: 2, obs: 'Tomate' },
    { codigo_insumo: '38635', quantidade: 6, obs: 'Onion Rings 6 aros' },
  ],
  '7100023': [
    { codigo_insumo: '38638', quantidade: 1, obs: 'Pão Supremo (+ central)' },
    { codigo_insumo: '35408', quantidade: 22, obs: 'Molho Stacker 11g+11g' },
    { codigo_insumo: '25622', quantidade: 11, obs: 'Alface' },
    { codigo_insumo: '34754', quantidade: 2, obs: '2 hambúrgueres HB' },
    { codigo_insumo: '3029', quantidade: 1, obs: 'Queijo' },
    { codigo_insumo: '35835', quantidade: 2, obs: 'Picles' },
    { codigo_insumo: '35562', quantidade: 2, obs: 'Cebola 2 aros' },
  ],
  '2100': [
    { codigo_insumo: '34754', quantidade: 1, obs: 'Carne HB' },
    { codigo_insumo: '3029', quantidade: 1, obs: 'Queijo' },
    { codigo_insumo: '35835', quantidade: 2, obs: 'Picles' },
    { codigo_insumo: '35407', quantidade: 9, obs: 'Ketchup 9g' },
    { codigo_insumo: '35740', quantidade: 3, obs: 'Mostarda 3g' },
  ],
  '7100055': [
    { codigo_insumo: '34754', quantidade: 2, obs: '2 carnes HB' },
    { codigo_insumo: '3029', quantidade: 2, obs: 'Queijo' },
    { codigo_insumo: '35835', quantidade: 1, obs: 'Picles' },
    { codigo_insumo: '35407', quantidade: 9, obs: 'Ketchup 9g' },
    { codigo_insumo: '35740', quantidade: 3, obs: 'Mostarda 3g' },
  ],
  '7100105': [
    { codigo_insumo: '34754', quantidade: 2, obs: '2 hambúrgueres' },
    { codigo_insumo: '35408', quantidade: 14, obs: 'Molho Stacker 14g' },
    { codigo_insumo: '3029', quantidade: 1, obs: 'Queijo' },
    { codigo_insumo: '21317', quantidade: 3, obs: 'Bacon 3 fatias' },
  ],
  '2610': [
    { codigo_insumo: '38636', quantidade: 1, obs: 'Pão Whopper' },
    { codigo_insumo: '35408', quantidade: 37, obs: 'Molho Stacker 37g' },
    { codigo_insumo: '34840', quantidade: 2, obs: '2 carnes Whopper' },
    { codigo_insumo: '3029', quantidade: 4, obs: 'Queijo 4 fatias' },
    { codigo_insumo: '21317', quantidade: 3, obs: 'Bacon 3 fatias' },
  ],
  '2064': [
    { codigo_insumo: '35221', quantidade: 1, obs: 'Chicken Jr' },
    { codigo_insumo: '37967', quantidade: 11, obs: 'Maionese 11g' },
  ],
  '7100095': [
    { codigo_insumo: '35221', quantidade: 2, obs: '2x Chicken Jr' },
    { codigo_insumo: '37967', quantidade: 22, obs: 'Maionese 11g+11g' },
    { codigo_insumo: '3029', quantidade: 1, obs: 'Queijo' },
  ],
  '7100123': [
    { codigo_insumo: 'BK-SEM-0003', quantidade: 1, obs: 'Pão brioche' },
    { codigo_insumo: '37967', quantidade: 11, obs: 'Maionese 11g' },
    { codigo_insumo: '25622', quantidade: 11, obs: 'Alface 11g' },
    { codigo_insumo: '38639', quantidade: 1, obs: 'Tender Crispy' },
  ],
  '7210100': [
    { codigo_insumo: '34754', quantidade: 1, obs: 'Carne HB / gourmet' },
    { codigo_insumo: '35610', quantidade: 14, obs: 'Molho Cheddar 14g' },
    { codigo_insumo: '35562', quantidade: 3, obs: 'Cebola salteada' },
  ],
  '7100036': [
    { codigo_insumo: '34754', quantidade: 1, obs: 'Carne HB' },
    { codigo_insumo: '37967', quantidade: 11, obs: 'Maionese 11g' },
    { codigo_insumo: '3029', quantidade: 1, obs: 'Queijo' },
    { codigo_insumo: '38635', quantidade: 3, obs: 'Onion Rings 3 aros' },
    { codigo_insumo: '35205-2', quantidade: 14, obs: 'Molho BBQ 14g' },
  ],
  '7100102': [
    { codigo_insumo: '34754', quantidade: 2, obs: '2 carnes HB' },
    { codigo_insumo: '37967', quantidade: 11, obs: 'Maionese 11g' },
    { codigo_insumo: '3029', quantidade: 1, obs: 'Queijo' },
    { codigo_insumo: '38635', quantidade: 3, obs: 'Onion Rings 3 aros' },
    { codigo_insumo: '35205-2', quantidade: 14, obs: 'Molho BBQ 14g' },
  ],
  '7100088': [
    { codigo_insumo: '38636', quantidade: 1, obs: 'Pão Whopper' },
    { codigo_insumo: '37967', quantidade: 21, obs: 'Maionese' },
    { codigo_insumo: '25622', quantidade: 21, obs: 'Alface' },
    { codigo_insumo: '35407', quantidade: 14, obs: 'Ketchup' },
    { codigo_insumo: '35562', quantidade: 14, obs: 'Cebola' },
    { codigo_insumo: '35835', quantidade: 4, obs: 'Picles' },
    { codigo_insumo: '21403', quantidade: 1, obs: 'Hambúrguer Rebel / vegetal' },
    { codigo_insumo: '3029', quantidade: 2, obs: 'Queijo' },
    { codigo_insumo: '35046-2', quantidade: 2, obs: 'Tomate' },
  ],
  // Campanhas (Arquivos BK)
  '7210461': [
    { codigo_insumo: 'BK-SEM-0003', quantidade: 1, obs: 'Pão brioche' },
    { codigo_insumo: '38537', quantidade: 3.5, obs: 'Baconese 3,5 voltas' },
    { codigo_insumo: '34840', quantidade: 1, obs: 'Carne Whopper' },
    { codigo_insumo: '3029', quantidade: 2, obs: 'Queijo cheddar' },
    { codigo_insumo: '221000000418', quantidade: 2, obs: 'Fraldinha 2 conchas ½ oz' },
    { codigo_insumo: '38635', quantidade: 3, obs: 'Onion Rings 3 aros' },
    { codigo_insumo: 'BK-SEM-0032', quantidade: 1, obs: 'Caixa The Kings' },
  ],
  '7210587': [
    { codigo_insumo: 'BK-SEM-0003', quantidade: 1, obs: 'Pão brioche' },
    { codigo_insumo: '25622', quantidade: 22, obs: 'Alface 22g' },
    { codigo_insumo: '221000000856', quantidade: 3.5, obs: 'Sweet Spicy 3,5 voltas' },
    { codigo_insumo: 'BK-PATTY-MUSS', quantidade: 1, obs: 'Patty mussarela empanada' },
    { codigo_insumo: '34840', quantidade: 1, obs: 'Carne Whopper' },
    { codigo_insumo: '35046-2', quantidade: 2, obs: 'Tomate 2 fatias' },
    { codigo_insumo: '3029', quantidade: 2, obs: 'Queijo cheddar' },
    { codigo_insumo: 'BK-SEM-0032', quantidade: 1, obs: 'Caixa The Kings' },
  ],
  '7210588': [
    { codigo_insumo: 'BK-SEM-0003', quantidade: 1, obs: 'Pão brioche' },
    { codigo_insumo: '25622', quantidade: 22, obs: 'Alface 22g' },
    { codigo_insumo: '221000000856', quantidade: 3.5, obs: 'Sweet Spicy' },
    { codigo_insumo: 'BK-PATTY-MUSS', quantidade: 1, obs: 'Patty mussarela' },
    { codigo_insumo: '38639', quantidade: 1, obs: 'Chicken / tender' },
    { codigo_insumo: '35046-2', quantidade: 2, obs: 'Tomate' },
    { codigo_insumo: '3029', quantidade: 2, obs: 'Queijo cheddar' },
    { codigo_insumo: 'BK-SEM-0032', quantidade: 1, obs: 'Caixa The Kings' },
  ],
  // Sobremesas (treinamento)
  '20000': [
    { codigo_insumo: '38454', quantidade: 1, obs: 'Cone casquinha' },
  ],
  '8000177': [
    { codigo_insumo: '38454', quantidade: 1, obs: 'Cone' },
    { codigo_insumo: 'BK-SEM-0005', quantidade: 0.5, obs: 'Nutella ½ oz' },
  ],
  '20008': [
    { codigo_insumo: '35144-2', quantidade: 1, obs: 'Copo sundae' },
    { codigo_insumo: '36243', quantidade: 1, obs: 'Cobertura chocolate' },
    { codigo_insumo: '21215-2', quantidade: 0.5, obs: 'Crumble cookies opcional' },
  ],
  '8000176': [
    { codigo_insumo: '29000', quantidade: 1, obs: 'Copo mix' },
    { codigo_insumo: 'BK-SEM-0005', quantidade: 1, obs: 'Nutella 2 tiros' },
    { codigo_insumo: '21215-2', quantidade: 0.5, obs: 'Farofa cookies' },
  ],
  '8000066': [
    { codigo_insumo: '29000', quantidade: 1, obs: 'Copo mix' },
    { codigo_insumo: '38585', quantidade: 1, obs: 'Brownie' },
  ],
  '8000070': [
    { codigo_insumo: '29000', quantidade: 1, obs: 'Copo mix' },
    { codigo_insumo: 'BK-SEM-0006', quantidade: 1, obs: 'Ovomaltine' },
  ],
  // Batata / onion (venda)
  '6011': [{ codigo_insumo: '28582', quantidade: 0.08, obs: 'Batata porção P (aprox.)' }],
  '6012': [{ codigo_insumo: '28582', quantidade: 0.12, obs: 'Batata porção M' }],
  '6013': [{ codigo_insumo: '28582', quantidade: 0.16, obs: 'Batata porção G' }],
  '6017': [{ codigo_insumo: '38635', quantidade: 0.1, obs: 'Onion Rings M' }],
  '6018': [{ codigo_insumo: '38635', quantidade: 0.14, obs: 'Onion Rings G' }],
};

function mergeInsumos(base, extras) {
  const byCode = new Map();
  for (const i of base) byCode.set(String(i.codigo), i);
  for (const e of extras) {
    if (!byCode.has(e.codigo)) byCode.set(e.codigo, e);
  }
  // Garante códigos referenciados nas fichas existam
  const needed = new Set();
  for (const itens of Object.values(FICHAS)) {
    for (const it of itens) needed.add(String(it.codigo_insumo));
  }
  for (const cod of needed) {
    if (!byCode.has(cod)) {
      byCode.set(cod, {
        codigo: cod,
        descricao: `INSUMO BK ${cod} (gerado p/ ficha)`,
        categoria: 'GERADO',
        unidade_contagem: 'UND',
      });
    }
  }
  return [...byCode.values()];
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
  console.log(`DB: ${dbName}`);

  const insumosRaw = readJson('insumos_bk.json');
  const produtos = readJson('produtos_atuais.json');
  const insumos = mergeInsumos(insumosRaw, INSUMO_EXTRA);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: lojasBk } = await client.query(
      `SELECT id_loja, name
       FROM lojas
       WHERE is_active IS DISTINCT FROM FALSE
         AND UPPER(name) LIKE 'BURGER KING%'
       ORDER BY id_loja`,
    );
    if (!lojasBk.length) throw new Error('Nenhuma loja Burger King ativa encontrada');
    console.log(`Lojas BK: ${lojasBk.length}`);

    // Limpa vínculos e tabelas (pedido: eliminar tudo em insumos e produtos)
    console.log('Limpando fichas, saldos, movimentos e vínculos…');
    await client.query('DELETE FROM ficha_tecnica_itens');
    await client.query('DELETE FROM ficha_tecnica');
    await client.query('UPDATE estoque_venda_itens SET id_produto = NULL');
    await client.query('UPDATE estoque_break_itens SET id_produto = NULL, id_insumo = NULL');
    await client.query('DELETE FROM estoque_itens');
    await client.query('DELETE FROM estoque_saldos');
    await client.query('DELETE FROM estoque_movimentos');
    await client.query('DELETE FROM produtos');
    await client.query('DELETE FROM insumos');

    // Reset sequences
    await client.query(`SELECT setval(pg_get_serial_sequence('insumos','id_insumo'), 1, false)`);
    await client.query(`SELECT setval(pg_get_serial_sequence('produtos','id_produto'), 1, false)`);
    await client.query(`SELECT setval(pg_get_serial_sequence('ficha_tecnica','id_ficha'), 1, false)`);
    await client.query(
      `SELECT setval(pg_get_serial_sequence('ficha_tecnica_itens','id_item'), 1, false)`,
    );

    console.log(`Inserindo ${insumos.length} insumos × ${lojasBk.length} lojas…`);
    for (const loja of lojasBk) {
      for (const ins of insumos) {
        await client.query(
          `INSERT INTO insumos (
             codigo, descricao, id_loja, unidade_contagem,
             preco_caixa, und_convertida, ativo, atualizado_em
           ) VALUES ($1,$2,$3,$4,$5,$6,TRUE,NOW())`,
          [
            String(ins.codigo),
            String(ins.descricao || '').slice(0, 500),
            loja.id_loja,
            String(ins.unidade_contagem || 'UND').slice(0, 20),
            Number(ins.preco_caixa) > 0 ? Number(ins.preco_caixa) : 0,
            ins.preco_caixa && ins.valor_unidade && Number(ins.valor_unidade) > 0
              ? Number(ins.preco_caixa) / Number(ins.valor_unidade)
              : 1,
          ],
        );
      }
    }

    console.log(`Inserindo ${produtos.length} produtos × ${lojasBk.length} lojas…`);
    const produtoIdByLojaCodigo = new Map();
    for (const loja of lojasBk) {
      for (const p of produtos) {
        const { rows } = await client.query(
          `INSERT INTO produtos (codigo, descricao, id_loja, ativo, atualizado_em)
           VALUES ($1,$2,$3,TRUE,NOW())
           RETURNING id_produto`,
          [String(p.codigo), String(p.descricao || '').slice(0, 500), loja.id_loja],
        );
        produtoIdByLojaCodigo.set(`${loja.id_loja}::${p.codigo}`, rows[0].id_produto);
      }
    }

    let fichas = 0;
    let itensFicha = 0;
    console.log('Criando fichas técnicas…');
    for (const loja of lojasBk) {
      for (const [codigoProduto, itens] of Object.entries(FICHAS)) {
        const idProduto = produtoIdByLojaCodigo.get(`${loja.id_loja}::${codigoProduto}`);
        if (!idProduto) continue;

        // valida códigos de insumo existentes na loja
        const itensOk = [];
        for (const it of itens) {
          const { rows: chk } = await client.query(
            `SELECT 1 FROM insumos WHERE id_loja = $1 AND codigo = $2 LIMIT 1`,
            [loja.id_loja, String(it.codigo_insumo)],
          );
          if (!chk.length) {
            console.warn(
              `  [loja ${loja.id_loja}] ficha ${codigoProduto}: falta insumo ${it.codigo_insumo}`,
            );
            continue;
          }
          if (!(Number(it.quantidade) > 0)) continue;
          itensOk.push(it);
        }
        if (!itensOk.length) continue;

        const { rows: fRows } = await client.query(
          `INSERT INTO ficha_tecnica (id_produto, ativo, observacao, atualizado_em)
           VALUES ($1, TRUE, $2, NOW())
           RETURNING id_ficha`,
          [idProduto, 'Importado Arquivos BK (MONTAGEM / alertas / sobremesas)'],
        );
        const idFicha = fRows[0].id_ficha;
        fichas += 1;
        for (const it of itensOk) {
          await client.query(
            `INSERT INTO ficha_tecnica_itens (id_ficha, codigo_insumo, quantidade, observacao)
             VALUES ($1,$2,$3,$4)`,
            [idFicha, String(it.codigo_insumo), Number(it.quantidade), it.obs || null],
          );
          itensFicha += 1;
        }
      }
    }

    await client.query('COMMIT');

    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM insumos) AS insumos,
        (SELECT COUNT(*)::int FROM produtos) AS produtos,
        (SELECT COUNT(*)::int FROM ficha_tecnica) AS fichas,
        (SELECT COUNT(*)::int FROM ficha_tecnica_itens) AS ficha_itens,
        (SELECT COUNT(DISTINCT id_loja)::int FROM insumos) AS lojas_insumos,
        (SELECT COUNT(DISTINCT id_loja)::int FROM produtos) AS lojas_produtos
    `);
    console.log('OK', counts.rows[0]);
    console.log(`Fichas criadas nesta execução: ${fichas} (${itensFicha} itens)`);
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
