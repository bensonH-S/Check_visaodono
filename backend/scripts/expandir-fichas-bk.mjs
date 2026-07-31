/**
 * Expande fichas técnicas (insumos ↔ produtos) no máximo possível
 * para produtos já cadastrados (PRECO GA). Só banco DEV / lojas BK.
 *
 * node backend/scripts/expandir-fichas-bk.mjs
 */
import 'dotenv/config';
import pg from 'pg';

const dbName = process.env.DB_NAME || '';
if (!/dev/i.test(dbName)) {
  console.error('ABORT: só DEV');
  process.exit(1);
}

/** codigo produto → [[codigo_insumo, qtde, obs], ...] */
const FICHAS = {
  // sanduíches principais (já existentes + extras)
  '1050': [['38636',1,'Pão'],['37967',21,'Maionese'],['25622',21,'Alface'],['35407',14,'Ketchup'],['35562',14,'Cebola'],['35835',4,'Picles'],['34840',1,'Carne Whopper'],['3029',2,'Queijo'],['35046-2',2,'Tomate']],
  '1052': [['38636',1,'Pão'],['37967',21,'Maionese'],['25622',21,'Alface'],['35407',14,'Ketchup'],['35562',14,'Cebola'],['35835',4,'Picles'],['34840',2,'2 Whopper'],['3029',2,'Queijo'],['35046-2',2,'Tomate']],
  '7100183': [['37967',11,'Maionese'],['25622',11,'Alface'],['35407',9,'Ketchup'],['35562',7,'Cebola'],['35835',2,'Picles'],['34840',2,'2 Whopper Jr'],['3029',1,'Queijo'],['35046-2',1,'Tomate']],
  '1600': [['37967',11,'Maionese'],['25622',11,'Alface'],['35407',9,'Ketchup'],['35562',7,'Cebola'],['35835',2,'Picles'],['34840',1,'Carne'],['3029',1,'Queijo'],['35046-2',1,'Tomate']],
  '1700': [['38636',1,'Pão'],['37967',21,'Maionese'],['25622',21,'Alface'],['38594',14,'Furioso'],['36084',4,'Jalapeño'],['34840',1,'Carne'],['3029',2,'Queijo'],['35046-2',2,'Tomate'],['21317',3,'Bacon'],['38635',4,'Onion']],
  '2610': [['38636',1,'Pão'],['35408',37,'Stacker'],['34840',2,'2 Whopper'],['3029',4,'Queijo'],['21317',3,'Bacon'],['38594',14,'Furioso']],
  '2612': [['38636',1,'Pão'],['35408',37,'Stacker'],['34840',3,'3 Whopper'],['3029',6,'Queijo'],['21317',5,'Bacon'],['38594',14,'Furioso']],
  '7100063': [['38636',1,'Pão'],['35408',37,'Stacker'],['34840',2,'2 Whopper'],['35610',6,'Cheddar voltas'],['21317',3,'Bacon']],
  '7100064': [['38636',1,'Pão'],['35408',37,'Stacker'],['34840',3,'3 Whopper'],['35610',9,'Cheddar'],['21317',5,'Bacon']],
  '7100060': [['38636',1,'Pão'],['35408',37,'Stacker'],['34840',2,'2 Whopper'],['35205-2',14,'BBQ'],['38635',6,'Onion'],['21317',3,'Bacon']],
  '7100061': [['38636',1,'Pão'],['35408',37,'Stacker'],['34840',3,'3 Whopper'],['35205-2',14,'BBQ'],['38635',6,'Onion'],['21317',5,'Bacon']],
  '7100100': [['38636',1,'Pão'],['37967',21,'Maionese'],['25622',21,'Alface'],['35205-2',14,'BBQ'],['35562',14,'Cebola'],['35835',4,'Picles'],['34840',1,'Carne'],['3029',2,'Queijo'],['35046-2',2,'Tomate'],['21317',3,'Bacon']],
  '7100101': [['38636',1,'Pão'],['37967',21,'Maionese'],['25622',21,'Alface'],['35205-2',14,'BBQ'],['34840',1,'Carne'],['3029',2,'Queijo'],['35046-2',2,'Tomate'],['38635',6,'Onion']],
  '7100088': [['38636',1,'Pão'],['37967',21,'Maionese'],['25622',21,'Alface'],['35407',14,'Ketchup'],['35562',14,'Cebola'],['35835',4,'Picles'],['21403',1,'Rebel'],['3029',2,'Queijo'],['35046-2',2,'Tomate']],
  '7100023': [['38638',1,'Pão Supremo'],['35408',22,'Stacker'],['25622',11,'Alface'],['34754',2,'2 HB'],['3029',1,'Queijo'],['35835',2,'Picles'],['35562',2,'Cebola']],
  '2100': [['34754',1,'HB'],['3029',1,'Queijo'],['35835',2,'Picles'],['35407',9,'Ketchup'],['35740',3,'Mostarda']],
  '7100055': [['34754',2,'2 HB'],['3029',2,'Queijo'],['35835',1,'Picles'],['35407',9,'Ketchup'],['35740',3,'Mostarda']],
  '7100105': [['34754',2,'2 HB'],['35408',14,'Stacker'],['3029',1,'Queijo'],['21317',3,'Bacon']],
  '2064': [['35221',1,'Chicken Jr'],['37967',11,'Maionese']],
  '7100095': [['35221',2,'2 Chicken'],['37967',22,'Maionese'],['3029',1,'Queijo']],
  '19': [['35221',2,'2 Chicken'],['37967',22,'Maionese'],['3029',1,'Queijo'],['21317',2,'Bacon']],
  '7100123': [['BK-SEM-0003',1,'Brioche'],['37967',11,'Maionese'],['25622',11,'Alface'],['38639',1,'Crispy']],
  '7100161': [['36252',1,'Gourmet'],['35610',14,'Cheddar'],['30489',14,'Cebola crispy'],['BK-SEM-0003',1,'Pão']],
  '7100036': [['34754',1,'HB'],['37967',11,'Maionese'],['3029',1,'Queijo'],['38635',3,'Onion'],['35205-2',14,'BBQ']],
  '7100102': [['34754',2,'2 HB'],['37967',11,'Maionese'],['3029',1,'Queijo'],['38635',3,'Onion'],['35205-2',14,'BBQ']],
  '7210461': [['BK-SEM-0003',1,'Brioche'],['38537',3.5,'Baconese'],['34840',1,'Whopper'],['3029',2,'Queijo'],['221000000418',2,'Fraldinha'],['38635',3,'Onion'],['BK-SEM-0032',1,'The Kings']],
  '7210587': [['BK-SEM-0003',1,'Brioche'],['25622',22,'Alface'],['221000000856',3.5,'Sweet Spicy'],['BK-PATTY-MUSS',1,'Patty'],['34840',1,'Whopper'],['35046-2',2,'Tomate'],['3029',2,'Queijo'],['BK-SEM-0032',1,'The Kings']],
  '7210588': [['BK-SEM-0003',1,'Brioche'],['25622',22,'Alface'],['221000000856',3.5,'Sweet Spicy'],['BK-PATTY-MUSS',1,'Patty'],['38639',1,'Chicken'],['35046-2',2,'Tomate'],['3029',2,'Queijo'],['BK-SEM-0032',1,'The Kings']],
  '8500036': [['35221',2,'Chicken'],['38594',14,'Furioso'],['3029',1,'Queijo']],
  '8500037': [['35221',2,'Chicken'],['37967',22,'Maionese'],['3029',1,'Queijo'],['21317',2,'Bacon']],
  '8500038': [['35221',2,'Chicken'],['37967',11,'Maionese'],['35205-2',14,'BBQ'],['21317',2,'Bacon']],
  '7100107': [['34754',1,'Carne'],['3029',1,'Queijo']],
  '7100196': [['32374',1,'Costela'],['BK-SEM-0003',1,'Pão'],['3029',2,'Queijo']],

  // batatas / onion / nuggets
  '6011': [['28582',0.08,'Batata P']],
  '6012': [['28582',0.12,'Batata M']],
  '14': [['28582',0.16,'Batata G']],
  '6013': [['28582',0.08,'Batata P furiosa'],['38594',10,'Furioso']],
  '6025': [['28582',0.12,'Batata M furiosa'],['38594',14,'Furioso']],
  '6027': [['28582',0.16,'Batata G furiosa'],['38594',18,'Furioso']],
  '6019': [['28582',0.16,'Suprema G']],
  '6020': [['28582',0.12,'Suprema M']],
  '7300014': [['28582',0.4,'Balde batata']],
  '6017': [['38635',0.1,'Onion M']],
  '6018': [['38635',0.14,'Onion G']],
  '7300005': [['38635',0.08,'Onion P']],
  '6508': [['38178',4,'Chicken 4']],
  '7300052': [['38178',10,'Chicken 10']],
  '7300024': [['38178',6,'Chicken 6']],
  '6522': [['38178',6,'Chicken 6'],['35205-2',1,'Molho']],
  '7300001': [['38178',10,'Chicken 10'],['35205-2',1,'Molho']],

  // sobremesas
  '20000': [['38454',1,'Cone']],
  '20002': [['38454',1,'Cone']],
  '8000043': [['38454',1,'Cone'],['38838',0.5,'DL']],
  '8000177': [['38454',1,'Cone'],['BK-SEM-0005',0.5,'Nutella']],
  '8000001': [['38454',1,'Cone'],['36243',0.5,'Choco']],
  '8000007': [['38454',1,'Cone'],['38838',0.5,'DL']],
  '8000012': [['38454',1,'Cone'],['BK-SEM-0006',0.5,'Ovo']],
  '8000246': [['38454',1,'Cone'],['BK-SEM-0006',0.5,'Ovo']],
  '8000270': [['38454',1,'Cone'],['31161',0.5,'Pistache']],
  '6005261': [['38454',1,'Cone'],['19909',1,'Água']],
  '20008': [['35144-2',1,'Copo'],['36243',1,'Choco']],
  '8000045': [['35144-2',1,'Copo'],['38838',1,'DL']],
  '8000081': [['35144-2',1,'Copo'],['30153',1,'Morango']],
  '8000013': [['35144-2',1,'Copo'],['BK-SEM-0006',1,'Ovo']],
  '8000176': [['29000',1,'Copo'],['BK-SEM-0005',1,'Nutella'],['21215-2',0.5,'Crumble']],
  '8000066': [['29000',1,'Copo'],['38585',1,'Brownie']],
  '8000070': [['29000',1,'Copo'],['BK-SEM-0006',1,'Ovo']],
  '8000269': [['29000',1,'Copo'],['31161',1,'Pistache']],
  '8000274': [['29000',1,'Copo'],['31161',1,'Pistache'],['38585',1,'Brownie']],
  '8000272': [['29000',1,'Copo'],['31161',1,'Pistache'],['21215-2',0.5,'Cookie']],
  '8000288': [['29000',1,'Copo'],['35642',1,'Prestígio']],
  '8000046': [['35505',1,'Balde'],['36243',2,'Choco']],
  '8000061': [['35505',1,'Balde'],['38838',2,'DL']],
  '8000048': [['35505',1,'Balde'],['30153',2,'Morango']],
  '8000065': [['35505',1,'Balde'],['38585',2,'Brownie']],
  '8000071': [['35505',1,'Balde'],['BK-SEM-0006',2,'Ovo']],
  '7700021': [['35144',1,'Copo'],['38008',1,'Base']],
  '7700016': [['35144',1,'Copo'],['36243',1,'Choco'],['38008',1,'Base']],
  '7700017': [['35144',1,'Copo'],['38838',1,'DL'],['38008',1,'Base']],
  '7700019': [['35144',1,'Copo'],['30153',1,'Morango'],['38008',1,'Base']],
  '7700072': [['35144',1,'Copo'],['38585',1,'Brownie'],['38008',1,'Base']],
  '7700076': [['35144',1,'Copo'],['21215-2',1,'Crumble'],['38008',1,'Base']],
  '8000204': [['35144',1,'Copo'],['BK-SEM-0005',1,'Nutella'],['38008',1,'Base']],
  '8000289': [['35144',1,'Copo'],['35642',1,'Prestígio'],['38008',1,'Base']],
  '21': [['35144',1,'Copo'],['BK-SEM-0007',1,'Proteína'],['38008',1,'Base']],

  // bebidas
  '9049': [['19909',1,'Água']],
  '9052': [['37466',1,'H2OH']],
  '7500029': [['38021',1,'Laranja']],
  '7500030': [['35959',1,'Uva']],
  '7500031': [['10138',1,'Maracujá']],

  // extras 1:1
  '8700012': [['25622',11,'Alface']],
  '8700020': [['21317',2,'Bacon']],
  '8700054': [['21055',1,'Bacon cubos']],
  '27001': [['34754',1,'Carne burger']],
  '27002': [['34840',1,'Carne Whopper']],
  '8700027': [['34754',1,'Carne peq']],
  '8700048': [['38639',1,'Tender crispy']],
  '27006': [['35221',1,'Chicken']],
  '8700002': [['35407',9,'Ketchup']],
  '8700013': [['35562',14,'Cebola']],
  '8550015': [['30489',14,'Cebola crispy']],
  '8800015': [['36083',11,'Maionese verde']],
  '8700052': [['21403',1,'Vegetal']],
  '8700007': [['36084',4,'Jalapeño']],
  '8700005': [['35205-2',14,'BBQ sand']],
  '8700004': [['35610',11,'Cheddar']],
  '8700006': [['38594',14,'Furioso sand']],
  '8700001': [['37967',11,'Maionese']],
  '8700009': [['35408',14,'Stacker']],
  '8700003': [['35740',3,'Mostarda']],
  '8700019': [['38635',3,'Onion ring']],
  '8700010': [['35835',2,'Picles']],
  '8700017': [['3029',1,'Queijo']],
  '8700011': [['35046-2',1,'Tomate']],
  '8700022': [['38537',3.5,'Baconese']],
  '8800008': [['10947',1,'Sachet maionese']],
  '8700023': [['35205-2',14,'BBQ']],
  '8800002': [['38594',14,'Furioso']],
  '8800018': [['BK-SEM-0005',0.5,'Nutella']],
  '8800019': [['21215-2',0.5,'Farofa cookies']],
  '8600002': [['BK-SEM-0006',0.5,'Ovomaltine']],
  '8600011': [['36243',0.5,'Chocolate']],
  '8600010': [['38838',0.5,'DL']],
  '8600009': [['30153',0.5,'Morango']],
  '8600031': [['38585',0.5,'Brownie']],
  '8600016': [['35708',0.5,'Calda ovo']],
  '8700068': [['35642',1,'Prestígio']],
  '8700057': [['36252',1,'Carne especial']],
  '7100197': [['32374',1,'Costela']],
};

const COMBO_BASE = {
  '1051': '1050',
  '1053': '1052',
  '1601': '1600',
  '1701': '1700',
  '2101': '2100',
  '2065': '2064',
  '32': '19',
  '7100018': '7100023',
  '6002384': '7100095',
  '6005985': '7100055',
  '6002696': '7100102',
  '6004204': '7100105',
  '6001645': '7100088',
  '6006751': '7100161',
  '6005279': '7100161',
  '7000007': '7100036',
  '6006918': '7100183',
  '6002688': '7100101',
  '6002687': '7100100',
  '6000956': '7100063',
  '6000957': '7100064',
  '6007462': '7100061',
  '2611': '2610',
  '2613': '2612',
  '6008229': '7100095',
  '6007425': '7210587',
};

function receita(codigo) {
  if (FICHAS[codigo]) return FICHAS[codigo];
  const base = COMBO_BASE[codigo];
  if (base && FICHAS[base]) {
    return [...FICHAS[base], ['28582', 0.12, 'Batata M combo']];
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: lojasBk } = await client.query(`
      SELECT id_loja FROM lojas
      WHERE is_active IS DISTINCT FROM FALSE AND UPPER(name) LIKE 'BURGER KING%'
    `);
    const { rows: insumos } = await client.query(
      `SELECT DISTINCT codigo FROM insumos WHERE id_loja = $1`,
      [lojasBk[0].id_loja],
    );
    const ok = new Set(insumos.map((r) => r.codigo));

    await client.query('DELETE FROM ficha_tecnica_itens');
    await client.query('DELETE FROM ficha_tecnica');
    await client.query(`SELECT setval(pg_get_serial_sequence('ficha_tecnica','id_ficha'), 1, false)`);
    await client.query(`SELECT setval(pg_get_serial_sequence('ficha_tecnica_itens','id_item'), 1, false)`);

    let fichas = 0;
    let itens = 0;
    const comFicha = new Set();

    for (const loja of lojasBk) {
      const { rows: prods } = await client.query(
        `SELECT id_produto, codigo FROM produtos WHERE id_loja = $1 AND ativo = TRUE`,
        [loja.id_loja],
      );
      for (const p of prods) {
        const rec = receita(String(p.codigo));
        if (!rec) continue;
        const itensOk = rec.filter(([c, q]) => ok.has(String(c)) && Number(q) > 0);
        if (!itensOk.length) continue;
        const { rows: fr } = await client.query(
          `INSERT INTO ficha_tecnica (id_produto, ativo, observacao, atualizado_em)
           VALUES ($1,TRUE,'Ficha expandida PRECO GA / Arquivos BK',NOW()) RETURNING id_ficha`,
          [p.id_produto],
        );
        fichas += 1;
        comFicha.add(p.codigo);
        for (const [c, q, obs] of itensOk) {
          await client.query(
            `INSERT INTO ficha_tecnica_itens (id_ficha, codigo_insumo, quantidade, observacao)
             VALUES ($1,$2,$3,$4)`,
            [fr[0].id_ficha, String(c), Number(q), obs || null],
          );
          itens += 1;
        }
      }
    }

    await client.query('COMMIT');
    const totProd = await pool.query(
      `SELECT COUNT(DISTINCT codigo)::int n FROM produtos WHERE id_loja = $1`,
      [lojasBk[0].id_loja],
    );
    console.log({
      fichas,
      itens,
      codigosComFicha: comFicha.size,
      produtosPorLoja: totProd.rows[0].n,
      cobertura: `${comFicha.size}/${totProd.rows[0].n}`,
    });
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
