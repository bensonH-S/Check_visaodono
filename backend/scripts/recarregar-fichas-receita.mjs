/**
 * Recarrega fichas com quantidade de PRODUÇÃO (g/fatia/und) + qtde_estoque (kg/peça).
 * Estoque/compra continua em kg etc.; produto mostra a receita operacional.
 *
 * node backend/scripts/recarregar-fichas-receita.mjs
 */
import 'dotenv/config';
import pg from 'pg';
import { qtdeReceitaParaEstoque } from '../src/services/fichaReceitaEstoque.js';

const dbName = process.env.DB_NAME || '';
if (!/dev/i.test(dbName)) {
  console.error('ABORT: só DEV');
  process.exit(1);
}

/** [codigo_insumo, qtde_receita, unidade, obs] */
const FICHAS = {
  '1050': [
    ['38636', 1, 'und', 'Pão Whopper'],
    ['37967', 21, 'g', 'Maionese 21g'],
    ['25622', 21, 'g', 'Alface 21g'],
    ['35407', 14, 'g', 'Ketchup 14g'],
    ['35562', 14, 'g', 'Cebola 14g'],
    ['35835', 4, 'fatia', 'Picles 4 fatias'],
    ['34840', 1, 'und', 'Carne Whopper 1'],
    ['3029', 2, 'fatia', 'Queijo 2 fatias'],
    ['35046-2', 2, 'fatia', 'Tomate 2 fatias'],
  ],
  '1052': [
    ['38636', 1, 'und', 'Pão'],
    ['37967', 21, 'g', 'Maionese'],
    ['25622', 21, 'g', 'Alface'],
    ['35407', 14, 'g', 'Ketchup'],
    ['35562', 14, 'g', 'Cebola'],
    ['35835', 4, 'fatia', 'Picles'],
    ['34840', 2, 'und', '2 carnes'],
    ['3029', 2, 'fatia', 'Queijo'],
    ['35046-2', 2, 'fatia', 'Tomate'],
  ],
  '1600': [
    ['37967', 11, 'g', 'Maionese 11g'],
    ['25622', 11, 'g', 'Alface'],
    ['35407', 9, 'g', 'Ketchup'],
    ['35562', 7, 'g', 'Cebola'],
    ['35835', 2, 'fatia', 'Picles'],
    ['34840', 1, 'und', 'Carne'],
    ['3029', 1, 'fatia', 'Queijo'],
    ['35046-2', 1, 'fatia', 'Tomate'],
  ],
  '7100183': [
    ['37967', 11, 'g', 'Maionese'],
    ['25622', 11, 'g', 'Alface'],
    ['35407', 9, 'g', 'Ketchup'],
    ['35562', 7, 'g', 'Cebola'],
    ['35835', 2, 'fatia', 'Picles'],
    ['34840', 2, 'und', '2 carnes'],
    ['3029', 1, 'fatia', 'Queijo'],
    ['35046-2', 1, 'fatia', 'Tomate'],
  ],
  '1700': [
    ['38636', 1, 'und', 'Pão'],
    ['37967', 21, 'g', 'Maionese'],
    ['25622', 21, 'g', 'Alface'],
    ['38594', 14, 'g', 'Furioso'],
    ['36084', 4, 'fatia', 'Jalapeño'],
    ['34840', 1, 'und', 'Carne'],
    ['3029', 2, 'fatia', 'Queijo'],
    ['35046-2', 2, 'fatia', 'Tomate'],
    ['21317', 3, 'fatia', 'Bacon'],
    ['38635', 32, 'g', 'Onion 4 aros (~8g)'],
  ],
  '7100100': [
    ['38636', 1, 'und', 'Pão'],
    ['37967', 21, 'g', 'Maionese'],
    ['25622', 21, 'g', 'Alface'],
    ['35205-2', 14, 'g', 'BBQ'],
    ['35562', 14, 'g', 'Cebola'],
    ['35835', 4, 'fatia', 'Picles'],
    ['34840', 1, 'und', 'Carne'],
    ['3029', 2, 'fatia', 'Queijo'],
    ['35046-2', 2, 'fatia', 'Tomate'],
    ['21317', 3, 'fatia', 'Bacon'],
  ],
  '7100101': [
    ['38636', 1, 'und', 'Pão'],
    ['37967', 21, 'g', 'Maionese'],
    ['25622', 21, 'g', 'Alface'],
    ['35205-2', 14, 'g', 'BBQ'],
    ['34840', 1, 'und', 'Carne'],
    ['3029', 2, 'fatia', 'Queijo'],
    ['35046-2', 2, 'fatia', 'Tomate'],
    ['38635', 48, 'g', 'Onion 6 aros'],
  ],
  '7100088': [
    ['38636', 1, 'und', 'Pão'],
    ['37967', 21, 'g', 'Maionese'],
    ['25622', 21, 'g', 'Alface'],
    ['35407', 14, 'g', 'Ketchup'],
    ['35562', 14, 'g', 'Cebola'],
    ['35835', 4, 'fatia', 'Picles'],
    ['21403', 1, 'und', 'Rebel'],
    ['3029', 2, 'fatia', 'Queijo'],
    ['35046-2', 2, 'fatia', 'Tomate'],
  ],
  '7100023': [
    ['38638', 1, 'und', 'Pão Supremo'],
    ['35408', 22, 'g', 'Stacker 11+11g'],
    ['25622', 11, 'g', 'Alface'],
    ['34754', 2, 'und', '2 HB'],
    ['3029', 1, 'fatia', 'Queijo'],
    ['35835', 2, 'fatia', 'Picles'],
    ['35562', 7, 'g', 'Cebola'],
  ],
  '2100': [
    ['34754', 1, 'und', 'HB'],
    ['3029', 1, 'fatia', 'Queijo'],
    ['35835', 2, 'fatia', 'Picles'],
    ['35407', 9, 'g', 'Ketchup'],
    ['35740', 3, 'g', 'Mostarda'],
  ],
  '7100055': [
    ['34754', 2, 'und', '2 HB'],
    ['3029', 2, 'fatia', 'Queijo'],
    ['35835', 1, 'fatia', 'Picles'],
    ['35407', 9, 'g', 'Ketchup'],
    ['35740', 3, 'g', 'Mostarda'],
  ],
  '7100105': [
    ['34754', 2, 'und', '2 HB'],
    ['35408', 14, 'g', 'Stacker'],
    ['3029', 1, 'fatia', 'Queijo'],
    ['21317', 3, 'fatia', 'Bacon'],
  ],
  '2610': [
    ['38636', 1, 'und', 'Pão'],
    ['35408', 37, 'g', 'Stacker 37g'],
    ['34840', 2, 'und', '2 Whopper'],
    ['3029', 4, 'fatia', 'Queijo'],
    ['21317', 3, 'fatia', 'Bacon'],
  ],
  '2612': [
    ['38636', 1, 'und', 'Pão'],
    ['35408', 37, 'g', 'Stacker'],
    ['34840', 3, 'und', '3 Whopper'],
    ['3029', 6, 'fatia', 'Queijo'],
    ['21317', 5, 'fatia', 'Bacon'],
  ],
  '7100063': [
    ['38636', 1, 'und', 'Pão'],
    ['35408', 37, 'g', 'Stacker'],
    ['34840', 2, 'und', '2 Whopper'],
    ['35610', 6, 'volta', 'Cheddar'],
    ['21317', 3, 'fatia', 'Bacon'],
  ],
  '7100064': [
    ['38636', 1, 'und', 'Pão'],
    ['35408', 37, 'g', 'Stacker'],
    ['34840', 3, 'und', '3 Whopper'],
    ['35610', 9, 'volta', 'Cheddar'],
    ['21317', 5, 'fatia', 'Bacon'],
  ],
  '7100060': [
    ['38636', 1, 'und', 'Pão'],
    ['35408', 37, 'g', 'Stacker'],
    ['34840', 2, 'und', '2 Whopper'],
    ['35205-2', 14, 'g', 'BBQ'],
    ['38635', 48, 'g', 'Onion 6 aros'],
    ['21317', 3, 'fatia', 'Bacon'],
  ],
  '7100061': [
    ['38636', 1, 'und', 'Pão'],
    ['35408', 37, 'g', 'Stacker'],
    ['34840', 3, 'und', '3 Whopper'],
    ['35205-2', 14, 'g', 'BBQ'],
    ['38635', 48, 'g', 'Onion 6 aros'],
    ['21317', 5, 'fatia', 'Bacon'],
  ],
  '2064': [
    ['35221', 1, 'und', 'Chicken Jr'],
    ['37967', 11, 'g', 'Maionese'],
  ],
  '7100095': [
    ['35221', 2, 'und', '2 Chicken'],
    ['37967', 22, 'g', 'Maionese'],
    ['3029', 1, 'fatia', 'Queijo'],
  ],
  '19': [
    ['35221', 2, 'und', '2 Chicken'],
    ['37967', 22, 'g', 'Maionese'],
    ['3029', 1, 'fatia', 'Queijo'],
    ['21317', 2, 'fatia', 'Bacon'],
  ],
  '7100123': [
    ['BK-SEM-0003', 1, 'und', 'Brioche'],
    ['37967', 11, 'g', 'Maionese'],
    ['25622', 11, 'g', 'Alface'],
    ['38639', 1, 'und', 'Tender'],
  ],
  '7100161': [
    ['36252', 1, 'und', 'Gourmet'],
    ['35610', 14, 'g', 'Cheddar'],
    ['30489', 14, 'g', 'Cebola crispy'],
    ['BK-SEM-0003', 1, 'und', 'Pão'],
  ],
  '7100036': [
    ['34754', 1, 'und', 'HB'],
    ['37967', 11, 'g', 'Maionese'],
    ['3029', 1, 'fatia', 'Queijo'],
    ['38635', 24, 'g', 'Onion 3 aros'],
    ['35205-2', 14, 'g', 'BBQ'],
  ],
  '7100102': [
    ['34754', 2, 'und', '2 HB'],
    ['37967', 11, 'g', 'Maionese'],
    ['3029', 1, 'fatia', 'Queijo'],
    ['38635', 24, 'g', 'Onion 3 aros'],
    ['35205-2', 14, 'g', 'BBQ'],
  ],
  '7210461': [
    ['BK-SEM-0003', 1, 'und', 'Brioche'],
    ['38537', 3.5, 'volta', 'Baconese'],
    ['34840', 1, 'und', 'Whopper'],
    ['3029', 2, 'fatia', 'Queijo'],
    ['221000000418', 2, 'concha', 'Fraldinha'],
    ['38635', 24, 'g', 'Onion 3 aros'],
  ],
  '7210587': [
    ['BK-SEM-0003', 1, 'und', 'Brioche'],
    ['25622', 22, 'g', 'Alface'],
    ['221000000856', 3.5, 'volta', 'Sweet Spicy'],
    ['BK-PATTY-MUSS', 1, 'und', 'Patty'],
    ['34840', 1, 'und', 'Whopper'],
    ['35046-2', 2, 'fatia', 'Tomate'],
    ['3029', 2, 'fatia', 'Queijo'],
  ],
  '7210588': [
    ['BK-SEM-0003', 1, 'und', 'Brioche'],
    ['25622', 22, 'g', 'Alface'],
    ['221000000856', 3.5, 'volta', 'Sweet Spicy'],
    ['BK-PATTY-MUSS', 1, 'und', 'Patty'],
    ['38639', 1, 'und', 'Chicken'],
    ['35046-2', 2, 'fatia', 'Tomate'],
    ['3029', 2, 'fatia', 'Queijo'],
  ],
  '8500036': [
    ['35221', 2, 'und', '2 Chicken'],
    ['38594', 14, 'g', 'Furioso'],
    ['3029', 1, 'fatia', 'Queijo'],
  ],
  '8500037': [
    ['35221', 2, 'und', '2 Chicken'],
    ['37967', 22, 'g', 'Maionese'],
    ['3029', 1, 'fatia', 'Queijo'],
    ['21317', 2, 'fatia', 'Bacon'],
  ],
  '8500038': [
    ['35221', 2, 'und', '2 Chicken'],
    ['37967', 11, 'g', 'Maionese'],
    ['35205-2', 14, 'g', 'BBQ'],
    ['21317', 2, 'fatia', 'Bacon'],
  ],
  '7100107': [
    ['34754', 1, 'und', 'Carne'],
    ['3029', 1, 'fatia', 'Queijo'],
  ],
  '7100196': [
    ['32374', 1, 'und', 'Costela'],
    ['BK-SEM-0003', 1, 'und', 'Pão'],
    ['3029', 2, 'fatia', 'Queijo'],
  ],
  '6011': [['28582', 80, 'g', 'Batata P']],
  '6012': [['28582', 120, 'g', 'Batata M']],
  '14': [['28582', 160, 'g', 'Batata G']],
  '6013': [['28582', 80, 'g', 'Batata'], ['38594', 10, 'g', 'Furioso']],
  '6025': [['28582', 120, 'g', 'Batata'], ['38594', 14, 'g', 'Furioso']],
  '6027': [['28582', 160, 'g', 'Batata'], ['38594', 18, 'g', 'Furioso']],
  '6019': [['28582', 160, 'g', 'Suprema G']],
  '6020': [['28582', 120, 'g', 'Suprema M']],
  '7300014': [['28582', 400, 'g', 'Balde']],
  '6017': [['38635', 100, 'g', 'Onion M']],
  '6018': [['38635', 140, 'g', 'Onion G']],
  '7300005': [['38635', 80, 'g', 'Onion P']],
  '6508': [['38178', 4, 'und', '4 nuggets']],
  '7300052': [['38178', 10, 'und', '10 nuggets']],
  '7300024': [['38178', 6, 'und', '6 nuggets']],
  '6522': [['38178', 6, 'und', '6 nuggets'], ['35205-2', 28, 'g', 'Molho']],
  '7300001': [['38178', 10, 'und', '10 nuggets'], ['35205-2', 28, 'g', 'Molho']],

  '20000': [['38454', 1, 'und', 'Cone']],
  '20002': [['38454', 1, 'und', 'Cone']],
  '8000043': [['38454', 1, 'und', 'Cone'], ['38838', 1, 'concha', 'DL']],
  '8000177': [['38454', 1, 'und', 'Cone'], ['BK-SEM-0005', 1, 'concha', 'Nutella']],
  '8000001': [['38454', 1, 'und', 'Cone'], ['36243', 1, 'concha', 'Choco']],
  '8000007': [['38454', 1, 'und', 'Cone'], ['38838', 1, 'concha', 'DL']],
  '8000012': [['38454', 1, 'und', 'Cone'], ['BK-SEM-0006', 1, 'concha', 'Ovo']],
  '8000246': [['38454', 1, 'und', 'Cone'], ['BK-SEM-0006', 1, 'concha', 'Ovo']],
  '8000270': [['38454', 1, 'und', 'Cone'], ['31161', 1, 'concha', 'Pistache']],
  '6005261': [['38454', 1, 'und', 'Cone'], ['19909', 1, 'und', 'Água']],
  '20008': [['35144-2', 1, 'und', 'Copo'], ['36243', 2, 'concha', 'Choco']],
  '8000045': [['35144-2', 1, 'und', 'Copo'], ['38838', 2, 'concha', 'DL']],
  '8000081': [['35144-2', 1, 'und', 'Copo'], ['30153', 2, 'concha', 'Morango']],
  '8000013': [['35144-2', 1, 'und', 'Copo'], ['BK-SEM-0006', 2, 'concha', 'Ovo']],
  '8000176': [['29000', 1, 'und', 'Copo'], ['BK-SEM-0005', 2, 'concha', 'Nutella'], ['21215-2', 1, 'concha', 'Crumble']],
  '8000066': [['29000', 1, 'und', 'Copo'], ['38585', 50, 'g', 'Brownie']],
  '8000070': [['29000', 1, 'und', 'Copo'], ['BK-SEM-0006', 2, 'concha', 'Ovo']],
  '8000269': [['29000', 1, 'und', 'Copo'], ['31161', 2, 'concha', 'Pistache']],
  '8000274': [['29000', 1, 'und', 'Copo'], ['31161', 1, 'concha', 'Pistache'], ['38585', 50, 'g', 'Brownie']],
  '8000272': [['29000', 1, 'und', 'Copo'], ['31161', 1, 'concha', 'Pistache'], ['21215-2', 1, 'concha', 'Cookie']],
  '8000288': [['29000', 1, 'und', 'Copo'], ['35642', 20, 'g', 'Prestígio']],
  '8000046': [['35505', 1, 'und', 'Balde'], ['36243', 4, 'concha', 'Choco']],
  '8000061': [['35505', 1, 'und', 'Balde'], ['38838', 4, 'concha', 'DL']],
  '8000048': [['35505', 1, 'und', 'Balde'], ['30153', 4, 'concha', 'Morango']],
  '8000065': [['35505', 1, 'und', 'Balde'], ['38585', 100, 'g', 'Brownie']],
  '8000071': [['35505', 1, 'und', 'Balde'], ['BK-SEM-0006', 4, 'concha', 'Ovo']],
  '7700021': [['35144', 1, 'und', 'Copo'], ['38008', 80, 'g', 'Base']],
  '7700016': [['35144', 1, 'und', 'Copo'], ['36243', 2, 'concha', 'Choco'], ['38008', 80, 'g', 'Base']],
  '7700017': [['35144', 1, 'und', 'Copo'], ['38838', 2, 'concha', 'DL'], ['38008', 80, 'g', 'Base']],
  '7700019': [['35144', 1, 'und', 'Copo'], ['30153', 2, 'concha', 'Morango'], ['38008', 80, 'g', 'Base']],
  '7700072': [['35144', 1, 'und', 'Copo'], ['38585', 50, 'g', 'Brownie'], ['38008', 80, 'g', 'Base']],
  '7700076': [['35144', 1, 'und', 'Copo'], ['21215-2', 2, 'concha', 'Crumble'], ['38008', 80, 'g', 'Base']],
  '8000204': [['35144', 1, 'und', 'Copo'], ['BK-SEM-0005', 2, 'concha', 'Nutella'], ['38008', 80, 'g', 'Base']],
  '8000289': [['35144', 1, 'und', 'Copo'], ['35642', 20, 'g', 'Prestígio'], ['38008', 80, 'g', 'Base']],
  '21': [['35144', 1, 'und', 'Copo'], ['BK-SEM-0007', 30, 'g', 'Proteína'], ['38008', 80, 'g', 'Base']],

  '9049': [['19909', 1, 'und', 'Água']],
  '9052': [['37466', 1, 'und', 'H2OH']],
  '7500029': [['38021', 1, 'und', 'Suco']],
  '7500030': [['35959', 1, 'und', 'Suco']],
  '7500031': [['10138', 1, 'und', 'Suco']],

  '8700012': [['25622', 11, 'g', 'Alface']],
  '8700020': [['21317', 2, 'fatia', 'Bacon']],
  '8700054': [['21055', 15, 'g', 'Bacon cubos']],
  '27001': [['34754', 1, 'und', 'Carne']],
  '27002': [['34840', 1, 'und', 'Whopper']],
  '8700027': [['34754', 1, 'und', 'Carne']],
  '8700048': [['38639', 1, 'und', 'Tender']],
  '27006': [['35221', 1, 'und', 'Chicken']],
  '8700002': [['35407', 9, 'g', 'Ketchup']],
  '8700013': [['35562', 14, 'g', 'Cebola']],
  '8550015': [['30489', 14, 'g', 'Cebola crispy']],
  '8800015': [['36083', 11, 'g', 'Maio verde']],
  '8700052': [['21403', 1, 'und', 'Vegetal']],
  '8700007': [['36084', 4, 'fatia', 'Jalapeño']],
  '8700005': [['35205-2', 14, 'g', 'BBQ']],
  '8700004': [['35610', 11, 'g', 'Cheddar']],
  '8700006': [['38594', 14, 'g', 'Furioso']],
  '8700001': [['37967', 11, 'g', 'Maionese']],
  '8700009': [['35408', 14, 'g', 'Stacker']],
  '8700003': [['35740', 3, 'g', 'Mostarda']],
  '8700019': [['38635', 24, 'g', 'Onion 3 aros']],
  '8700010': [['35835', 2, 'fatia', 'Picles']],
  '8700017': [['3029', 1, 'fatia', 'Queijo']],
  '8700011': [['35046-2', 1, 'fatia', 'Tomate']],
  '8700022': [['38537', 3.5, 'volta', 'Baconese']],
  '8800008': [['10947', 1, 'und', 'Sachet']],
  '8700023': [['35205-2', 14, 'g', 'BBQ']],
  '8800002': [['38594', 14, 'g', 'Furioso']],
  '8800018': [['BK-SEM-0005', 1, 'concha', 'Nutella']],
  '8800019': [['21215-2', 1, 'concha', 'Farofa']],
  '8600002': [['BK-SEM-0006', 1, 'concha', 'Ovo']],
  '8600011': [['36243', 1, 'concha', 'Choco']],
  '8600010': [['38838', 1, 'concha', 'DL']],
  '8600009': [['30153', 1, 'concha', 'Morango']],
  '8600031': [['38585', 50, 'g', 'Brownie']],
  '8600016': [['35708', 1, 'concha', 'Calda']],
  '8700068': [['35642', 20, 'g', 'Prestígio']],
  '8700057': [['36252', 1, 'und', 'Especial']],
  '7100197': [['32374', 1, 'und', 'Costela']],
};

const COMBO_BASE = {
  '1051': '1050', '1053': '1052', '1601': '1600', '1701': '1700', '2101': '2100', '2065': '2064',
  '32': '19', '7100018': '7100023', '6002384': '7100095', '6005985': '7100055', '6002696': '7100102',
  '6004204': '7100105', '6001645': '7100088', '6006751': '7100161', '6005279': '7100161',
  '7000007': '7100036', '6006918': '7100183', '6002688': '7100101', '6002687': '7100100',
  '6000956': '7100063', '6000957': '7100064', '6007462': '7100061', '2611': '2610', '2613': '2612',
  '6008229': '7100095', '6007425': '7210587',
};

function receita(codigo) {
  if (FICHAS[codigo]) return FICHAS[codigo];
  const base = COMBO_BASE[codigo];
  if (base && FICHAS[base]) return [...FICHAS[base], ['28582', 120, 'g', 'Batata M combo']];
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
    await client.query(`
      ALTER TABLE ficha_tecnica_itens
        ADD COLUMN IF NOT EXISTS unidade_receita TEXT NOT NULL DEFAULT 'und';
    `);
    await client.query(`
      ALTER TABLE ficha_tecnica_itens
        ADD COLUMN IF NOT EXISTS qtde_estoque NUMERIC(14, 6)
    `);

    const { rows: lojasBk } = await client.query(`
      SELECT id_loja FROM lojas
      WHERE is_active IS DISTINCT FROM FALSE AND UPPER(name) LIKE 'BURGER KING%'
      ORDER BY id_loja
    `);

    const { rows: insumos } = await client.query(
      `SELECT codigo, descricao, und_convertida FROM insumos WHERE id_loja = $1`,
      [lojasBk[0].id_loja],
    );
    const byCod = new Map(insumos.map((i) => [i.codigo, i]));
    const ok = new Set(byCod.keys());

    await client.query('DELETE FROM ficha_tecnica_itens');
    await client.query('DELETE FROM ficha_tecnica');
    await client.query(`SELECT setval(pg_get_serial_sequence('ficha_tecnica','id_ficha'), 1, false)`);
    await client.query(`SELECT setval(pg_get_serial_sequence('ficha_tecnica_itens','id_item'), 1, false)`);

    let fichas = 0;
    let itensN = 0;

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
          [p.id_produto, 'Receita (g/fatia/und) + baixa estoque (kg/peça)'],
        );
        fichas += 1;
        for (const [cod, q, uni, obs] of itensOk) {
          const ins = byCod.get(String(cod)) || { descricao: '', und_convertida: 1 };
          const qEst = qtdeReceitaParaEstoque(q, uni, ins);
          await client.query(
            `INSERT INTO ficha_tecnica_itens
               (id_ficha, codigo_insumo, quantidade, unidade_receita, qtde_estoque, observacao)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [fr[0].id_ficha, String(cod), Number(q), uni, qEst, obs || null],
          );
          itensN += 1;
        }
      }
    }

    await client.query('COMMIT');

    const check = await pool.query(
      `
      SELECT pv.codigo, pv.descricao, pv.preco_venda,
             ROUND(SUM(COALESCE(i.qtde_estoque,0) * COALESCE(ins.valor_unidade,0))::numeric, 2) AS custo,
             json_agg(json_build_object(
               'cod', i.codigo_insumo, 'q', i.quantidade, 'u', i.unidade_receita, 'est', i.qtde_estoque
             ) ORDER BY i.codigo_insumo) AS itens
      FROM produtos pv
      JOIN ficha_tecnica f ON f.id_produto = pv.id_produto AND f.ativo
      JOIN ficha_tecnica_itens i ON i.id_ficha = f.id_ficha
      LEFT JOIN insumos ins ON ins.id_loja = pv.id_loja AND UPPER(ins.codigo)=UPPER(i.codigo_insumo)
      WHERE pv.id_loja = $1 AND pv.codigo = '1050'
      GROUP BY 1,2,3
    `,
      [lojasBk[0].id_loja],
    );

    console.log({ fichas, itens: itensN });
    console.log('Whopper amostra:', JSON.stringify(check.rows[0], null, 2));
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
