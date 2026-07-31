/**
 * Corrige quantidades das fichas para a unidade de estoque (kg / peça),
 * conforme MONTAGEM.pdf e Treinamento de sobremesas 2025.
 *
 * Problema: gramas/fatias estavam gravadas como se fossem kg/caixas inteiras
 * (ex.: 21g de maionese → 21 UND de 1kg → custo absurdo).
 *
 * Uso (só DEV): node backend/scripts/corrigir-fichas-quantidades.mjs
 */
import 'dotenv/config';
import pg from 'pg';

const dbName = process.env.DB_NAME || '';
if (!/dev/i.test(dbName)) {
  console.error('ABORT: só DEV');
  process.exit(1);
}

/** g → kg */
const g = (n) => Number((n / 1000).toFixed(6));
/** fatia queijo ~11g */
const fatQueijo = (n) => g(n * 11);
/** fatia tomate ~25g */
const fatTomate = (n) => g(n * 25);
/** fatia picles ~6g */
const fatPicles = (n) => g(n * 6);
/** fatia bacon ~9g */
const fatBacon = (n) => g(n * 9);
/** fatia jalapeño ~4g */
const fatJal = (n) => g(n * 4);
/** carne Whopper ~113g */
const carneW = (n = 1) => g(n * 113);
/** carne HB ~50g */
const carneHb = (n = 1) => g(n * 50);
/** onion ring ~8g */
const onion = (n) => g(n * 8);
/** concha ½ oz ~14g */
const concha = (n = 1) => g(n * 14);
/** volta de molho ~4g */
const volta = (n) => g(n * 4);

/**
 * Receitas em UNIDADE DE ESTOQUE (kg para granel/kg; peça para pão/cone/copo).
 * Fonte: MONTAGEM + sobremesas 2025.
 */
const FICHAS = {
  // —— WHOPPER COM QUEIJO (MONTAGEM p.12): maio 21g, alface 21g, ketchup 14g, cebola 14g, picles 4, carne 1, queijo 2, tomate 2, pão 1
  '1050': [
    ['38636', 1, 'Pão Whopper 1 und'],
    ['37967', g(21), 'Maionese 21g'],
    ['25622', g(21), 'Alface 21g'],
    ['35407', g(14), 'Ketchup 14g'],
    ['35562', g(14), 'Cebola 14g'],
    ['35835', fatPicles(4), 'Picles 4 fatias'],
    ['34840', carneW(1), 'Carne Whopper 1'],
    ['3029', fatQueijo(2), 'Queijo 2 fatias'],
    ['35046-2', fatTomate(2), 'Tomate 2 fatias'],
  ],
  '1052': [
    ['38636', 1, 'Pão'],
    ['37967', g(21), 'Maionese 21g'],
    ['25622', g(21), 'Alface 21g'],
    ['35407', g(14), 'Ketchup'],
    ['35562', g(14), 'Cebola'],
    ['35835', fatPicles(4), 'Picles'],
    ['34840', carneW(2), '2 carnes'],
    ['3029', fatQueijo(2), 'Queijo'],
    ['35046-2', fatTomate(2), 'Tomate'],
  ],
  '1600': [
    ['37967', g(11), 'Maionese 11g'],
    ['25622', g(11), 'Alface 11g'],
    ['35407', g(9), 'Ketchup 9g'],
    ['35562', g(7), 'Cebola 7g'],
    ['35835', fatPicles(2), 'Picles 2'],
    ['34840', carneW(1), 'Carne'],
    ['3029', fatQueijo(1), 'Queijo 1'],
    ['35046-2', fatTomate(1), 'Tomate 1'],
  ],
  '7100183': [
    ['37967', g(11), 'Maionese'],
    ['25622', g(11), 'Alface'],
    ['35407', g(9), 'Ketchup'],
    ['35562', g(7), 'Cebola'],
    ['35835', fatPicles(2), 'Picles'],
    ['34840', carneW(2), '2 carnes'],
    ['3029', fatQueijo(1), 'Queijo'],
    ['35046-2', fatTomate(1), 'Tomate'],
  ],
  '1700': [
    ['38636', 1, 'Pão'],
    ['37967', g(21), 'Maionese'],
    ['25622', g(21), 'Alface'],
    ['38594', g(14), 'Furioso ~14g'],
    ['36084', fatJal(4), 'Jalapeño 4'],
    ['34840', carneW(1), 'Carne'],
    ['3029', fatQueijo(2), 'Queijo'],
    ['35046-2', fatTomate(2), 'Tomate'],
    ['21317', fatBacon(3), 'Bacon 3'],
    ['38635', onion(4), 'Onion 4 aros'],
  ],
  '7100100': [
    ['38636', 1, 'Pão'],
    ['37967', g(21), 'Maionese'],
    ['25622', g(21), 'Alface'],
    ['35205-2', g(14), 'BBQ 14g'],
    ['35562', g(14), 'Cebola'],
    ['35835', fatPicles(4), 'Picles'],
    ['34840', carneW(1), 'Carne'],
    ['3029', fatQueijo(2), 'Queijo'],
    ['35046-2', fatTomate(2), 'Tomate'],
    ['21317', fatBacon(3), 'Bacon 3'],
  ],
  '7100101': [
    ['38636', 1, 'Pão'],
    ['37967', g(21), 'Maionese'],
    ['25622', g(21), 'Alface'],
    ['35205-2', g(14), 'BBQ'],
    ['34840', carneW(1), 'Carne'],
    ['3029', fatQueijo(2), 'Queijo'],
    ['35046-2', fatTomate(2), 'Tomate'],
    ['38635', onion(6), 'Onion 6'],
  ],
  '7100088': [
    ['38636', 1, 'Pão'],
    ['37967', g(21), 'Maionese'],
    ['25622', g(21), 'Alface'],
    ['35407', g(14), 'Ketchup'],
    ['35562', g(14), 'Cebola'],
    ['35835', fatPicles(4), 'Picles'],
    ['21403', carneW(1), 'Rebel ~113g'],
    ['3029', fatQueijo(2), 'Queijo'],
    ['35046-2', fatTomate(2), 'Tomate'],
  ],
  '7100023': [
    ['38638', 1, 'Pão Supremo (+miolo ≈1 und cadastro)'],
    ['35408', g(22), 'Stacker 11+11g'],
    ['25622', g(11), 'Alface'],
    ['34754', carneHb(2), '2 HB'],
    ['3029', fatQueijo(1), 'Queijo'],
    ['35835', fatPicles(2), 'Picles'],
    ['35562', g(7), 'Cebola ~2 aros'],
  ],
  '2100': [
    ['34754', carneHb(1), 'HB'],
    ['3029', fatQueijo(1), 'Queijo'],
    ['35835', fatPicles(2), 'Picles'],
    ['35407', g(9), 'Ketchup 9g'],
    ['35740', g(3), 'Mostarda 3g'],
  ],
  '7100055': [
    ['34754', carneHb(2), '2 HB'],
    ['3029', fatQueijo(2), 'Queijo'],
    ['35835', fatPicles(1), 'Picles'],
    ['35407', g(9), 'Ketchup'],
    ['35740', g(3), 'Mostarda'],
  ],
  '7100105': [
    ['34754', carneHb(2), '2 HB'],
    ['35408', g(14), 'Stacker 14g'],
    ['3029', fatQueijo(1), 'Queijo'],
    ['21317', fatBacon(3), 'Bacon 3'],
  ],
  '2610': [
    ['38636', 1, 'Pão'],
    ['35408', g(37), 'Stacker 37g'],
    ['34840', carneW(2), '2 Whopper'],
    ['3029', fatQueijo(4), 'Queijo 4'],
    ['21317', fatBacon(3), 'Bacon 3'],
  ],
  '2612': [
    ['38636', 1, 'Pão'],
    ['35408', g(37), 'Stacker 37g'],
    ['34840', carneW(3), '3 Whopper'],
    ['3029', fatQueijo(6), 'Queijo 6'],
    ['21317', fatBacon(5), 'Bacon 5'],
  ],
  '7100063': [
    ['38636', 1, 'Pão'],
    ['35408', g(37), 'Stacker'],
    ['34840', carneW(2), '2 Whopper'],
    ['35610', volta(6), 'Cheddar ~6 voltas'],
    ['21317', fatBacon(3), 'Bacon'],
  ],
  '7100064': [
    ['38636', 1, 'Pão'],
    ['35408', g(37), 'Stacker'],
    ['34840', carneW(3), '3 Whopper'],
    ['35610', volta(9), 'Cheddar'],
    ['21317', fatBacon(5), 'Bacon'],
  ],
  '7100060': [
    ['38636', 1, 'Pão'],
    ['35408', g(37), 'Stacker'],
    ['34840', carneW(2), '2 Whopper'],
    ['35205-2', g(14), 'BBQ'],
    ['38635', onion(6), 'Onion'],
    ['21317', fatBacon(3), 'Bacon'],
  ],
  '7100061': [
    ['38636', 1, 'Pão'],
    ['35408', g(37), 'Stacker'],
    ['34840', carneW(3), '3 Whopper'],
    ['35205-2', g(14), 'BBQ'],
    ['38635', onion(6), 'Onion'],
    ['21317', fatBacon(5), 'Bacon'],
  ],
  '2064': [
    ['35221', g(70), 'Chicken Jr ~70g'],
    ['37967', g(11), 'Maionese 11g'],
  ],
  '7100095': [
    ['35221', g(140), '2x Chicken Jr'],
    ['37967', g(22), 'Maionese'],
    ['3029', fatQueijo(1), 'Queijo'],
  ],
  '19': [
    ['35221', g(140), '2 Chicken'],
    ['37967', g(22), 'Maionese'],
    ['3029', fatQueijo(1), 'Queijo'],
    ['21317', fatBacon(2), 'Bacon'],
  ],
  '7100123': [
    ['BK-SEM-0003', 1, 'Pão brioche'],
    ['37967', g(11), 'Maionese 11g'],
    ['25622', g(11), 'Alface 11g'],
    ['38639', g(100), 'Tender crispy ~100g'],
  ],
  '7100161': [
    ['36252', carneW(1), 'Carne gourmet'],
    ['35610', g(14), 'Cheddar 14g'],
    ['30489', g(14), 'Cebola crispy 14g'],
    ['BK-SEM-0003', 1, 'Pão'],
  ],
  '7100036': [
    ['34754', carneHb(1), 'HB'],
    ['37967', g(11), 'Maionese'],
    ['3029', fatQueijo(1), 'Queijo'],
    ['38635', onion(3), 'Onion 3'],
    ['35205-2', g(14), 'BBQ 14g'],
  ],
  '7100102': [
    ['34754', carneHb(2), '2 HB'],
    ['37967', g(11), 'Maionese'],
    ['3029', fatQueijo(1), 'Queijo'],
    ['38635', onion(3), 'Onion'],
    ['35205-2', g(14), 'BBQ'],
  ],
  '7210461': [
    ['BK-SEM-0003', 1, 'Brioche'],
    ['38537', volta(3.5), 'Baconese 3,5 voltas'],
    ['34840', carneW(1), 'Whopper'],
    ['3029', fatQueijo(2), 'Queijo'],
    ['221000000418', concha(2), 'Fraldinha 2 conchas'],
    ['38635', onion(3), 'Onion 3'],
  ],
  '7210587': [
    ['BK-SEM-0003', 1, 'Brioche'],
    ['25622', g(22), 'Alface 22g'],
    ['221000000856', volta(3.5), 'Sweet Spicy 3,5'],
    ['BK-PATTY-MUSS', 1, 'Patty 1 und'],
    ['34840', carneW(1), 'Whopper'],
    ['35046-2', fatTomate(2), 'Tomate'],
    ['3029', fatQueijo(2), 'Queijo'],
  ],
  '7210588': [
    ['BK-SEM-0003', 1, 'Brioche'],
    ['25622', g(22), 'Alface'],
    ['221000000856', volta(3.5), 'Sweet Spicy'],
    ['BK-PATTY-MUSS', 1, 'Patty'],
    ['38639', g(100), 'Chicken'],
    ['35046-2', fatTomate(2), 'Tomate'],
    ['3029', fatQueijo(2), 'Queijo'],
  ],
  '8500036': [
    ['35221', g(140), '2 Chicken'],
    ['38594', g(14), 'Furioso'],
    ['3029', fatQueijo(1), 'Queijo'],
  ],
  '8500037': [
    ['35221', g(140), '2 Chicken'],
    ['37967', g(22), 'Maionese'],
    ['3029', fatQueijo(1), 'Queijo'],
    ['21317', fatBacon(2), 'Bacon'],
  ],
  '8500038': [
    ['35221', g(140), '2 Chicken'],
    ['37967', g(11), 'Maionese'],
    ['35205-2', g(14), 'BBQ'],
    ['21317', fatBacon(2), 'Bacon'],
  ],
  '7100107': [
    ['34754', carneHb(1), 'Carne'],
    ['3029', fatQueijo(1), 'Queijo'],
  ],
  '7100196': [
    ['32374', g(80), 'Costela ~80g'],
    ['BK-SEM-0003', 1, 'Pão'],
    ['3029', fatQueijo(2), 'Queijo'],
  ],

  // batata / onion / nuggets (porção em kg do produto congelado)
  '6011': [['28582', g(80), 'Batata P ~80g']],
  '6012': [['28582', g(120), 'Batata M ~120g']],
  '14': [['28582', g(160), 'Batata G ~160g']],
  '6013': [['28582', g(80), 'Batata P'], ['38594', g(10), 'Furioso']],
  '6025': [['28582', g(120), 'Batata M'], ['38594', g(14), 'Furioso']],
  '6027': [['28582', g(160), 'Batata G'], ['38594', g(18), 'Furioso']],
  '6019': [['28582', g(160), 'Suprema G']],
  '6020': [['28582', g(120), 'Suprema M']],
  '7300014': [['28582', g(400), 'Balde ~400g']],
  '6017': [['38635', g(100), 'Onion M']],
  '6018': [['38635', g(140), 'Onion G']],
  '7300005': [['38635', g(80), 'Onion P']],
  '6508': [['38178', g(80), '4 nuggets ~80g']],
  '7300052': [['38178', g(200), '10 nuggets']],
  '7300024': [['38178', g(120), '6 nuggets']],
  '6522': [['38178', g(120), '6 nuggets'], ['35205-2', g(28), 'Molho blister']],
  '7300001': [['38178', g(200), '10 nuggets'], ['35205-2', g(28), 'Molho']],

  // sobremesas (treinamento 2025) — cone/copo = 1 peça; caldas em kg
  '20000': [['38454', 1, 'Cone 1']],
  '20002': [['38454', 1, 'Cone']],
  '8000043': [['38454', 1, 'Cone'], ['38838', concha(1), 'DL ½ oz']],
  '8000177': [['38454', 1, 'Cone'], ['BK-SEM-0005', concha(1), 'Nutella ½ oz']],
  '8000001': [['38454', 1, 'Cone'], ['36243', concha(1), 'Choco']],
  '8000007': [['38454', 1, 'Cone'], ['38838', concha(1), 'DL']],
  '8000012': [['38454', 1, 'Cone'], ['BK-SEM-0006', concha(1), 'Ovo']],
  '8000246': [['38454', 1, 'Cone'], ['BK-SEM-0006', concha(1), 'Ovo']],
  '8000270': [['38454', 1, 'Cone'], ['31161', concha(1), 'Pistache']],
  '6005261': [['38454', 1, 'Cone'], ['19909', 1, 'Água 1']],
  '20008': [['35144-2', 1, 'Copo sundae'], ['36243', concha(2), 'Choco 2 tiros']],
  '8000045': [['35144-2', 1, 'Copo'], ['38838', concha(2), 'DL']],
  '8000081': [['35144-2', 1, 'Copo'], ['30153', concha(2), 'Morango']],
  '8000013': [['35144-2', 1, 'Copo'], ['BK-SEM-0006', concha(2), 'Ovo']],
  '8000176': [['29000', 1, 'Copo mix'], ['BK-SEM-0005', concha(2), 'Nutella 2 tiros'], ['21215-2', concha(1), 'Crumble']],
  '8000066': [['29000', 1, 'Copo'], ['38585', g(50), 'Brownie ~50g']],
  '8000070': [['29000', 1, 'Copo'], ['BK-SEM-0006', concha(2), 'Ovo']],
  '8000269': [['29000', 1, 'Copo'], ['31161', concha(2), 'Pistache']],
  '8000274': [['29000', 1, 'Copo'], ['31161', concha(1), 'Pistache'], ['38585', g(50), 'Brownie']],
  '8000272': [['29000', 1, 'Copo'], ['31161', concha(1), 'Pistache'], ['21215-2', concha(1), 'Cookie']],
  '8000288': [['29000', 1, 'Copo'], ['35642', g(20), 'Prestígio']],
  '8000046': [['35505', 1, 'Balde'], ['36243', concha(4), 'Choco']],
  '8000061': [['35505', 1, 'Balde'], ['38838', concha(4), 'DL']],
  '8000048': [['35505', 1, 'Balde'], ['30153', concha(4), 'Morango']],
  '8000065': [['35505', 1, 'Balde'], ['38585', g(100), 'Brownie']],
  '8000071': [['35505', 1, 'Balde'], ['BK-SEM-0006', concha(4), 'Ovo']],
  '7700021': [['35144', 1, 'Copo shake'], ['38008', g(80), 'Base ~80g']],
  '7700016': [['35144', 1, 'Copo'], ['36243', concha(2), 'Choco'], ['38008', g(80), 'Base']],
  '7700017': [['35144', 1, 'Copo'], ['38838', concha(2), 'DL'], ['38008', g(80), 'Base']],
  '7700019': [['35144', 1, 'Copo'], ['30153', concha(2), 'Morango'], ['38008', g(80), 'Base']],
  '7700072': [['35144', 1, 'Copo'], ['38585', g(50), 'Brownie'], ['38008', g(80), 'Base']],
  '7700076': [['35144', 1, 'Copo'], ['21215-2', concha(2), 'Crumble'], ['38008', g(80), 'Base']],
  '8000204': [['35144', 1, 'Copo'], ['BK-SEM-0005', concha(2), 'Nutella'], ['38008', g(80), 'Base']],
  '8000289': [['35144', 1, 'Copo'], ['35642', g(20), 'Prestígio'], ['38008', g(80), 'Base']],
  '21': [['35144', 1, 'Copo'], ['BK-SEM-0007', g(30), 'Proteína'], ['38008', g(80), 'Base']],

  '9049': [['19909', 1, 'Água']],
  '9052': [['37466', 1, 'H2OH']],
  '7500029': [['38021', 1, 'Suco']],
  '7500030': [['35959', 1, 'Suco']],
  '7500031': [['10138', 1, 'Suco']],

  // extras — porções pequenas
  '8700012': [['25622', g(11), 'Alface']],
  '8700020': [['21317', fatBacon(2), 'Bacon']],
  '8700054': [['21055', g(15), 'Bacon cubos']],
  '27001': [['34754', carneHb(1), 'Carne']],
  '27002': [['34840', carneW(1), 'Whopper']],
  '8700027': [['34754', carneHb(1), 'Carne peq']],
  '8700048': [['38639', g(100), 'Tender']],
  '27006': [['35221', g(70), 'Chicken']],
  '8700002': [['35407', g(9), 'Ketchup']],
  '8700013': [['35562', g(14), 'Cebola']],
  '8550015': [['30489', g(14), 'Cebola crispy']],
  '8800015': [['36083', g(11), 'Maio verde']],
  '8700052': [['21403', carneW(1), 'Vegetal']],
  '8700007': [['36084', fatJal(4), 'Jalapeño']],
  '8700005': [['35205-2', g(14), 'BBQ']],
  '8700004': [['35610', g(11), 'Cheddar']],
  '8700006': [['38594', g(14), 'Furioso']],
  '8700001': [['37967', g(11), 'Maionese']],
  '8700009': [['35408', g(14), 'Stacker']],
  '8700003': [['35740', g(3), 'Mostarda']],
  '8700019': [['38635', onion(3), 'Onion']],
  '8700010': [['35835', fatPicles(2), 'Picles']],
  '8700017': [['3029', fatQueijo(1), 'Queijo']],
  '8700011': [['35046-2', fatTomate(1), 'Tomate']],
  '8700022': [['38537', volta(3.5), 'Baconese']],
  '8800008': [['10947', 1, 'Sachet 1']],
  '8700023': [['35205-2', g(14), 'BBQ']],
  '8800002': [['38594', g(14), 'Furioso']],
  '8800018': [['BK-SEM-0005', concha(1), 'Nutella']],
  '8800019': [['21215-2', concha(1), 'Farofa']],
  '8600002': [['BK-SEM-0006', concha(1), 'Ovo']],
  '8600011': [['36243', concha(1), 'Choco']],
  '8600010': [['38838', concha(1), 'DL']],
  '8600009': [['30153', concha(1), 'Morango']],
  '8600031': [['38585', g(50), 'Brownie']],
  '8600016': [['35708', concha(1), 'Calda ovo']],
  '8700068': [['35642', g(20), 'Prestígio']],
  '8700057': [['36252', carneW(1), 'Especial']],
  '7100197': [['32374', g(80), 'Costela']],
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
    return [...FICHAS[base], ['28582', g(120), 'Batata M combo ~120g']];
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
  console.log('DB', dbName);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: lojasBk } = await client.query(`
      SELECT id_loja FROM lojas
      WHERE is_active IS DISTINCT FROM FALSE AND UPPER(name) LIKE 'BURGER KING%'
      ORDER BY id_loja
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
        `SELECT id_produto, codigo FROM produtos WHERE id_loja = $1 AND ativo`,
        [loja.id_loja],
      );
      for (const p of prods) {
        const rec = receita(String(p.codigo));
        if (!rec) continue;
        const itensOk = rec.filter(([c, q]) => ok.has(String(c)) && Number(q) > 0);
        if (!itensOk.length) continue;
        const { rows: fr } = await client.query(
          `INSERT INTO ficha_tecnica (id_produto, ativo, observacao, atualizado_em)
           VALUES ($1, TRUE, $2, NOW()) RETURNING id_ficha`,
          [p.id_produto, 'Quantidades corrigidas (MONTAGEM / sobremesas) em kg ou peça'],
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

    const check = await pool.query(`
      SELECT pv.codigo, pv.descricao, pv.preco_venda,
             ROUND(SUM(i.quantidade * COALESCE(ins.valor_unidade,0))::numeric, 2) AS custo,
             COUNT(*)::int AS n
      FROM produtos pv
      JOIN ficha_tecnica f ON f.id_produto = pv.id_produto AND f.ativo
      JOIN ficha_tecnica_itens i ON i.id_ficha = f.id_ficha
      LEFT JOIN insumos ins ON ins.id_loja = pv.id_loja AND UPPER(ins.codigo)=UPPER(i.codigo_insumo)
      WHERE pv.id_loja = $1 AND pv.codigo IN ('1050','1600','1700','2100','7100123','8000176','20000','6012','7210461')
      GROUP BY 1,2,3 ORDER BY 1
    `, [lojasBk[0].id_loja]);

    console.log({ fichas, itens, codigos: comFicha.size });
    console.log('Amostra custos após correção:');
    for (const r of check.rows) {
      console.log(`  ${r.codigo} ${r.descricao} | venda ${r.preco_venda} | custo ${r.custo} | itens ${r.n}`);
    }
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
