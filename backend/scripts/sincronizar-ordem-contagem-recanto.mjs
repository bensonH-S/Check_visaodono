/**
 * Ordem e faixas da planilha Recanto (CONTAGEM julho).
 * Os códigos da planilha estão deslocados — o casamento é pela descrição.
 *
 *   node backend/scripts/sincronizar-ordem-contagem-recanto.mjs --dry-run
 *   node backend/scripts/sincronizar-ordem-contagem-recanto.mjs --yes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';
import { normalizarDesc } from '../src/services/estoqueContagem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: true });

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const dryRun = args.includes('--dry-run');
const arquivoArg = args.find((a) => a.startsWith('--arquivo='));
const arquivo = arquivoArg
  ? arquivoArg.slice(10)
  : fs.existsSync('f:/Users/BENSON/Downloads/Ficha Tecnica/CONTAGEM julho - Recanto.xlsx')
    ? 'f:/Users/BENSON/Downloads/Ficha Tecnica/CONTAGEM julho - Recanto.xlsx'
    : path.join(projectRoot, 'Arquivos BK', 'CONTAGEM julho - Recanto.xlsx');

if (!yes && !dryRun) {
  console.error('Use --yes ou --dry-run.');
  process.exit(1);
}

const SECAO_REFRI = 'REFRIGERANTES COCA-COLA - LATAS - CO2';

function secaoCanon(nome) {
  const n = String(nome || '').replace(/\s+/g, ' ').trim();
  if (/^REFRIGERANTES/i.test(n)) return SECAO_REFRI;
  return n;
}

/** Chave estável da linha da planilha / do catálogo (ignora CX, peso, BK). */
export function chaveContagem(desc) {
  const d = normalizarDesc(desc);
  if (!d) return '';

  if (/BACON/.test(d) && /CUBO/.test(d)) return 'bacon-cubos';
  if (/BACON/.test(d) && (/PRONTO/.test(d) || /TIRA/.test(d))) return 'bacon-pronto';
  if (/BATATA/.test(d) && !/CARTON|FUNDO|TAMPA|SACO|SAQUINHO|DLV/.test(d)) return 'batata';
  if (/BROWNIE/.test(d) && /PICADO/.test(d)) return 'brownie-picado';
  if (/BROWNIE/.test(d) && /BRIGADEIRO/.test(d)) return 'brownie-brigadeiro';

  if (/CARNE/.test(d) && /GOURMET/.test(d)) return 'carne-gourmet';
  if (/CARNE/.test(d) && /WHOPPER|MOIDA WHOPPER|17[,.]2/.test(d) && !/MARMITA/.test(d)) return 'carne-whopper';
  if (/CARNE HB|CARNE.*18[,.]7/.test(d)) return 'carne-hb';
  if (/REBEL/.test(d) && /PICANHA/.test(d)) return 'rebel-picanha';
  if (/FRANDINHA/.test(d) && /DEFUM/.test(d)) return 'frandinha-defumada';
  if (/FRANDINHA/.test(d)) return 'frandinha';

  if (/CHICKEN JR/.test(d)) return 'chicken-jr';
  if (/NUGGET/.test(d) || (/CHICKEN/.test(d) && /12 KG|588/.test(d) && !/JR|SACO|LAMINA/.test(d))) {
    return 'chicken';
  }
  if (/CHICKEN/.test(d) && !/SACO|LAMINA|MARMITA|ESTROGONOFF/.test(d)) return 'chicken';

  if (/MARMITA/.test(d) && /PANELA/.test(d)) return 'marmita-panela';
  if (/MARMITA/.test(d) && /MOIDA/.test(d)) return 'marmita-moida';
  if (/MARMITA/.test(d) && /COXA/.test(d)) return 'marmita-coxa';
  if (/MARMITA/.test(d) && /ESTROGONOFF/.test(d)) return 'marmita-estro';
  if (/MARMITA/.test(d) && /FEIJOADA/.test(d)) return 'marmita-feijoada';
  if (/MARMITA/.test(d) && /DESFIADO/.test(d)) return 'marmita-frango';
  if (/MARMITA/.test(d) && /PORK/.test(d)) return 'marmita-porks';

  if (/ONION/.test(d)) return 'onion';
  if (/TENDER|CRISPY FILE/.test(d)) return 'tender';

  if (/PAO/.test(d) && /SUPREMO/.test(d)) return 'pao-supremo';
  if (/PAO/.test(d) && /WHOPPER/.test(d)) return 'pao-whopper';
  if (/PAO/.test(d) && /BRIOCHE/.test(d) && /270/.test(d)) return 'pao-brioche-270';
  if (/PAO/.test(d) && /BRIOCHE/.test(d)) return 'pao-brioche';
  if (/PAO BK 5|PAO.*5 CL/.test(d)) return 'pao-bk5';
  if (/PAO BK 4|PAO.*4 CONG/.test(d)) return 'pao-bk4';

  if (/H2OH/.test(d)) return 'h2oh';
  if (/AGUA MINERAL/.test(d)) return 'agua-mineral';
  if (/AGUA COPO|AGUA.*200 ML/.test(d)) return 'agua-copo';
  if (/ALFACE/.test(d)) return 'alface';
  if (/TOMATE/.test(d)) return 'tomate';
  if (/CEBOLA BRANCA/.test(d)) return 'cebola-branca';
  if (/BEBIDA LACTEA/.test(d) && /DOCE/.test(d)) return 'lactea-doce';
  if (/BEBIDA LACTEA/.test(d) && /BAUNILHA/.test(d)) return 'lactea-baunilha';
  if (/MOLHO SABOR QUEIJO|MOLHO.*CHEDDAR/.test(d)) return 'molho-cheddar';
  if (/QUEIJO CHEDDAR/.test(d)) return 'queijo-cheddar';
  if (/SUCO/.test(d) && /MARACUJA/.test(d)) return 'suco-maracuja';
  if (/SUCO/.test(d) && /LARANJA/.test(d)) return 'suco-laranja';
  if (/SUCO/.test(d) && /UVA/.test(d) && /180/.test(d)) return 'suco-uva-180';
  if (/SUCO/.test(d) && /UVA/.test(d)) return 'suco-uva';

  if (/BACONESE/.test(d)) return 'baconese';
  if (/CEBOLA FRITA|CRISPY BENASSI/.test(d)) return 'cebola-frita';
  if (/COSTELA DESFIADA/.test(d)) return 'costela';
  if (/KETCHUP/.test(d) && /GRANEL/.test(d)) return 'ketchup-granel';
  if (/SACHE.*KETCHUP|SACHET CATCHUP|SACHE KETCHUP/.test(d)) return 'ketchup-sache';
  if (/MAIONESE GRANEL/.test(d)) return 'maionese-granel';
  if (/MAIONESE.*BACON/.test(d)) return 'maionese-bacon-sache';
  if (/MAIONESE VERDE/.test(d) && /SACH/.test(d)) return 'maionese-verde-sache';
  if (/MAIONESE VERDE/.test(d)) return 'maionese-verde';
  if (/SACHET MAIONESE|MAIONESE SACHET/.test(d) && !/VERDE|BACON/.test(d)) return 'maionese-sache';
  if (/BARBECUE/.test(d) && /BLISTER/.test(d)) return 'barbecue-blister';
  if (/BARBECUE/.test(d) && (/BAG|GRANEL|5[,.]5/.test(d))) return 'barbecue-granel';
  if (/MOLHO CEBOLA ROXA/.test(d)) return 'molho-cebola-roxa';
  if ((/FURIOSO/.test(d) && /BLISTER/.test(d)) || /MOLHO BLISTER MASTER/.test(d)) {
    return 'furioso-blister';
  }
  if (/FURIOSO/.test(d)) return 'furioso-granel';
  if (/STACKER BAG|MOLHO STACKER/.test(d)) return 'molho-stacker';
  if (/MOSTARDA/.test(d) && /SACHE/.test(d)) return 'mostarda-sache';
  if (/MOSTARDA/.test(d)) return 'mostarda-granel';
  if (/OLEO/.test(d) && !/KIT|MEDIDOR/.test(d)) return 'oleo';
  if (/PEPINO/.test(d)) return 'pepino';
  if (/JALAPENO/.test(d)) return 'jalapeno';
  if (/SAL/.test(d) && /10KG|10 KG|FD 10/.test(d) && !/SACHE/.test(d)) return 'sal-fd';
  if (/SAL REFINADO SACHE/.test(d)) return 'sal-sache';

  if (/BIS XTRA/.test(d)) return 'bis-xtra';
  if (/BISCOITO BIDCOFF|CRUMBLE BISCOFF/.test(d)) return 'biscoff';
  if (/PRESTIGIO/.test(d)) return 'prestigio';
  if (/CALDA DE PISTACHE/.test(d)) return 'calda-pistache';
  if (/CALDA MORANGO/.test(d)) return 'calda-morango';
  if (/CALDA DE BANANA/.test(d)) return 'calda-banana';
  if (/CASQUINHA/.test(d)) return 'casquinha';
  if (/COBERTURA CHOCO/.test(d)) return 'cobertura-choco';
  if (/CRUMBLE COOKIES|BISCOITO BAUNILHA GRANULADO/.test(d)) return 'crumble-cookies';
  if (/DOCE DE LEITE/.test(d)) return 'doce-leite';
  if (/LEITE EM PO NINHO/.test(d)) return 'ninho';
  if (/MISTURA MILK SHAKE|MILK SHAKE BAU/.test(d)) return 'mix-shake';
  if (/NUTELLA/.test(d)) return 'nutella';
  if (/OVOMALTINE/.test(d) && /RECHEIO/.test(d)) return 'recheio-ovomaltine';
  if (/OVOMALTINE/.test(d)) return 'ovomaltine';
  if (/PROTEINA SORO/.test(d)) return 'proteina-soro';

  if (/BALDE PAPEL|BALDE.*900/.test(d) && !/TAMPA/.test(d)) return 'balde-900';
  if (/BOBINA DSS|BIXOLON/.test(d)) return 'bobina-dss';
  if (/BOBINA TERMICA/.test(d)) return 'bobina-termica';
  if (/CANUDO/.test(d) && /MILK/.test(d)) return 'canudo-shake';
  if (/CANUDO/.test(d) && /REFRIG/.test(d)) return 'canudo-refri';
  if (/CARTONAGEM BATATA GRANDE/.test(d) && !/NARUTO|DLV/.test(d)) return 'carton-batata-gd';
  if (/CARTONAGEM BATATA MEDIA/.test(d)) return 'carton-batata-md';
  if (/CARTONAGEM BATATA/.test(d) && /NARUTO|DLV/.test(d)) return 'carton-batata-dlv';
  if (/CARTONAGEM FRITOS/.test(d)) return 'carton-fritos';
  if (/COPO/.test(d) && /550/.test(d) && !/PORTA|TAMPA/.test(d)) return 'copo-550';
  if (/COPO CORTESIA/.test(d)) return 'copo-cortesia';
  if (/COPO/.test(d) && /290/.test(d) && /STAR WARS|MINIONS/.test(d)) return 'copo-mix-campanha';
  if (/COPO/.test(d) && /290/.test(d)) return 'copo-mix';
  if (/COPO SHAKE/.test(d) && /BIO/.test(d)) return 'copo-shake-bio';
  if (/COPO SHAKE/.test(d)) return 'copo-shake';
  if (/COPO SUNDAE/.test(d) || /COPO.*180/.test(d) && /SUNDAE|POLIPAPEL/.test(d)) return 'copo-sundae';
  if (/COPO REFRIG/.test(d) && /440/.test(d) && /MINIONS/.test(d)) return 'copo-440-minions';
  if (/COPO REFRIG/.test(d) && /440/.test(d) && /STAR WARS/.test(d)) return 'copo-440-sw';
  if (/COPO REFRIG/.test(d) && /440/.test(d)) return 'copo-440';
  if (/COROA/.test(d) && /LGBT/.test(d)) return 'coroa-lgbt';
  if (/COROA/.test(d) && /NARUTO/.test(d)) return 'coroa-naruto';
  if (/COROA/.test(d) && /MINIONS/.test(d)) return 'coroa-minions';
  if (/COROA/.test(d) && /STAR/.test(d)) return 'coroa-star';
  if (/COROA/.test(d)) return 'coroa';
  if (/ETIQ LACRE|ETIQUETA.*LACRE/.test(d)) return 'etiq-lacre';
  if (/ETIQUETA \(DOMINGO\)/.test(d)) return 'etiq-domingo';
  if (/ETIQUETA \(SEGUNDA\)/.test(d)) return 'etiq-segunda';
  if (/ETIQUETA \(TERCA\)/.test(d)) return 'etiq-terca';
  if (/ETIQUETA \(QUARTA\)/.test(d)) return 'etiq-quarta';
  if (/ETIQUETA \(QUINTA\)/.test(d)) return 'etiq-quinta';
  if (/ETIQUETA \(SEXTA\)/.test(d)) return 'etiq-sexta';
  if (/ETIQUETA \(SABADO\)/.test(d)) return 'etiq-sabado';
  if (/FILME PELICULA|PVC 1000/.test(d)) return 'filme-pvc';
  if (/FILTRO/.test(d) && /PITCO/.test(d)) return 'filtro-pitco';
  if (/FILTRO/.test(d) && /FRITADEIRA/.test(d)) return 'filtro-fritadeira';
  if (/FUNDO BANDEJA INSTITUCIONAL|FUNDO DE BANDEJA INSTITUCIONAL/.test(d)) return 'fundo-bandeja';
  if (/FUNDO DE BANDEJA STAR WARS/.test(d)) return 'fundo-bandeja-sw';
  if (/FUNDO DE BANDEIJA/.test(d) && /MINIONS/.test(d)) return 'fundo-bandeja-minions';
  if (/FUNDO DE BANDEIJA/.test(d)) return 'fundo-bandeja-lanc';
  if (/FUNDO DE BATATA SUP GD|FUNDO DE BATATA SUP GRANDE/.test(d)) return 'fundo-batata-gd';
  if (/FUNDO DE BATATA SUP MD/.test(d)) return 'fundo-batata-md';
  if (/GARFO SOBREMESA/.test(d)) return 'garfo-sobremesa';
  if (/GUARDANAPO EMBALADO/.test(d)) return 'guard-embalado';
  if (/GUARDANAPO INTERFOLHADO/.test(d)) return 'guard-inter';
  if (/GUARDANAPO SORVETE/.test(d)) return 'guard-sorvete';
  if (/KIT GARFO/.test(d)) return 'kit-garfo';
  if (/LAMINA BIG KING/.test(d)) return 'lamina-bigking';
  if (/LAMINA CHICKEN|LAMINA SPECIAL CHICKEN/.test(d)) return 'lamina-chicken';
  if (/LAMINA KING OFERTAS/.test(d)) return 'lamina-ofertas';
  if (/LAMINA REBEL/.test(d)) return 'lamina-rebel';
  if (/LAMINA STACKER/.test(d)) return 'lamina-stacker';
  if (/LAMINA WHOPPER JR/.test(d)) return 'lamina-whopper-jr';
  if (/LAMINA WHOPPER/.test(d) && /NARUTO/.test(d)) return 'lamina-whopper-naruto';
  if (/LAMINA WHOPPER/.test(d)) return 'lamina-whopper';
  if (/LAPIS CERA/.test(d)) return 'lapis';
  if (/LUVA PLASTICA DESC/.test(d)) return 'luva-plastica';
  if (/LUVA TRANSP/.test(d) && / EG |TAM EG/.test(d)) return 'luva-eg';
  if (/LUVA TRANSP/.test(d)) return 'luva-unic';
  if (/PAZINHA SORVETE/.test(d)) return 'pazinha';
  if (/COLHER SORVETE/.test(d)) return 'colher-sorvete';
  if (/PETROGEL/.test(d)) return 'petrogel';
  if (/PORTA COPOS/.test(d)) return 'porta-copos';
  if (/REDINHA/.test(d) && /100/.test(d)) return 'redinha-100';
  if (/REDINHA/.test(d)) return 'redinha';
  if (/SACO BK CHICKEN|SACO CHICKEN/.test(d)) return 'saco-chicken';
  if (/SACO BK DELIVERY|SACO DELIVERY/.test(d)) return 'saco-delivery';
  if (/SACO DE KING JR/.test(d)) return 'saco-kingjr-old';
  if (/SACO KING JR/.test(d)) return 'saco-kingjr';
  if (/SACO VIAGEM 12/.test(d)) return 'saco-12';
  if (/SACO VIAGEM 6/.test(d)) return 'saco-6';
  if (/SACOLA P\/ VIAGEM|SACOLA P\/ VIAGEM/.test(d) || /SACOLA P\/ VIAGEM/.test(d)) return 'sacola-viagem';
  if (/SAQUINHO DE BATATA|SACO FRITAS/.test(d)) return 'saquinho-batata';
  if (/TAMPA BALDE/.test(d)) return 'tampa-balde';
  if (/TAMPA BATATA SUPREMA GRANDE/.test(d)) return 'tampa-batata-gd';
  if (/TAMPA BATATA SUPREMA MEDIA/.test(d)) return 'tampa-batata-md';
  if (/TAMPA REFRIGERANTE 440|TAMPA COPO 440/.test(d)) return 'tampa-440';
  if (/TAMPA SHAKE/.test(d)) return 'tampa-shake';
  if (/TAMPA SUNDAE/.test(d)) return 'tampa-sundae';
  if (/TAMPA POTE/.test(d)) return 'tampa-pote';

  if (/PAPEL HIGIENICO INTERFOLHADO/.test(d)) return 'papel-hig-inter';
  if (/PAPEL HIGIENICO/.test(d)) return 'papel-hig';
  if (/PAPEL TOALHA INTERFOLH/.test(d)) return 'papel-toalha-inter';
  if (/PAPEL TOALHA/.test(d)) return 'papel-toalha';
  if (/SACO P\/ LIXO 40|SACO P\/ LIXO 40/.test(d) || /SACO P\/ LIXO 40LT|SACO P\/ LIXO 40/.test(d)) return 'lixo-40';
  if (/LIXO 40/.test(d)) return 'lixo-40';
  if (/LIXO 100/.test(d)) return 'lixo-100';
  if (/LIXO 200/.test(d)) return 'lixo-200';
  if (/DETERGENTE/.test(d)) return 'detergente';
  if (/LUVA P\/ LIXO|LUVA.*CANO LONGO/.test(d)) return 'luva-lixo';
  if (/PANO MULTIUSO/.test(d) && /VERMELHO/.test(d)) return 'pano-vermelho';
  if (/PANO MULTIUSO/.test(d) && /AZUL/.test(d)) return 'pano-azul';
  if (/PANO MULTIUSO/.test(d) && /LARANJA/.test(d)) return 'pano-laranja';
  if (/PANO MULTIUSO/.test(d) && /VERDE/.test(d)) return 'pano-verde';
  if (/PANO MULTIUSO/.test(d) && /BRANCO/.test(d)) return 'pano-branco';

  if (/LIPTON/.test(d)) return 'lipton';
  if (/(PEPSI COLA BAG|COCA-COLA BAG)/.test(d) && !/ZERO/.test(d)) return 'refri-cola-bag';
  if (/(PEPSI ZERO BAG|COCA-COLA ZERO BAG)/.test(d)) return 'refri-cola-zero-bag';
  if (/PEPSI TWIST/.test(d)) return 'refri-twist-bag';
  if (/FANTA LARANJA BAG/.test(d)) return 'refri-fanta-bag';
  if (/(GUARANA ANTARTICA BAG|FANTA GUARANA BAG)/.test(d) && !/DIET/.test(d)) return 'refri-guarana-bag';
  if (/(GUARANA ANTARTICA DIET|SPRITE BAG)/.test(d) && /BAG/.test(d)) return 'refri-sprite-bag';
  if (/SODA LIMONADA BAG/.test(d)) return 'refri-soda-bag';
  if (/SUKITA BAG/.test(d)) return 'refri-sukita-bag';
  if (/(GUARANA  LATA|FANTA GUARANA.*LATA)/.test(d) && !/DIET/.test(d)) return 'refri-guarana-lata';
  if (/SPRITE/.test(d) && !/BAG/.test(d) && /LATA|310/.test(d)) return 'refri-sprite-lata';
  if (/(PEPSI LATA|COCA-COLA LATA)/.test(d) && !/DIET|ZERO/.test(d)) return 'refri-cola-lata';
  if (/(PEPSI DIET LATA|COCA-COLA ZERO LATA)/.test(d)) return 'refri-cola-zero-lata';
  if (/FANTA LARANJA LATA/.test(d)) return 'refri-fanta-lata';
  if (/DIOXIDO|CO2|CARBONO CIL/.test(d)) return 'co2';

  if (/BRINDE DIVERSOS/.test(d)) return 'brinde-diversos';
  if (/BRINDE SONIC/.test(d)) return 'brinde-sonic';
  if (/BRIND CARTON/.test(d)) return 'brinde-carton';
  if (/DEADPOL|DEADPOOL/.test(d)) return 'brinde-deadpool';
  if (/WARNER/.test(d)) return 'brinde-warner';
  if (/OVO DINO/.test(d)) return 'brinde-dino';
  if (/SMORF|SMURF/.test(d)) return 'brinde-smurf';
  if (/UNO DESAFIO/.test(d)) return 'brinde-uno';
  if (/NARUTO MIX|BRIND NARUTO/.test(d)) return 'brinde-naruto';
  if (/BOB ESPONJA/.test(d)) return 'brinde-bob';
  if (/TARTARUGA/.test(d)) return 'brinde-tartaruga';
  if (/BRINDE MINIONS/.test(d)) return 'brinde-minions';

  if (/MOLHO TERYAKI|MOLHO TERIYAKI/.test(d)) return 'teryaki';
  if (/BISCOITO AZUL GRANULADO/.test(d)) return 'biscoito-azul';
  if (/CAIXA/.test(d) && /ADULTO/.test(d)) return 'caixa-adulto';
  if (/CAIXA THE KINGS/.test(d)) return 'caixa-kings';
  if (/MOLHO SABOR DEFUMADO/.test(d)) return 'molho-defumado';
  if (/FAROFA CRUMB/.test(d)) return 'farofa';
  if (/KIT DE MANUTEN/.test(d) && /ORING/.test(d)) return 'kit-oring';
  if (/KIT MEDIDOR DE OLEO/.test(d)) return 'kit-medidor';
  if (/KIT TEFLON|TEFLON TOASTER/.test(d)) return 'teflon';
  if (/KIT DE ESCOVA/.test(d)) return 'kit-escova';
  if (/ZIPCLIPS/.test(d)) return 'zipclips';
  if (/BANDEJA PRETA/.test(d)) return 'bandeja-preta';
  if (/MANTA SUPERIOR DE TEFLON INFERIOR/.test(d)) return 'manta-inf';
  if (/MANTA SUPERIOR DE TEFLON/.test(d)) return 'manta-sup';
  if (/CESTO PARA PAO/.test(d)) return 'cesto-pao';
  if (/POTE BK MOLH/.test(d)) return 'pote-molhao';
  if (/BK COPA MAIONESE PURA/.test(d)) return 'copa-maionese-pura';
  if (/BK COPA MAIONESE CITR/.test(d)) return 'copa-maionese-citrica';
  if (/BK COPA MOLHO PAPRICA/.test(d)) return 'copa-paprica';
  if (/BK COPA MOLHO DE ALHO/.test(d)) return 'copa-alho';
  if (/SWEET CHILLI/.test(d)) return 'copa-chilli';
  if (/BANANA BARBECUE/.test(d)) return 'banana-bbq';

  return `txt:${d.replace(/[^A-Z0-9]+/g, '').slice(0, 28)}`;
}

function parsePlanilha(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellStyles: true });
  const sh = wb.Sheets[wb.SheetNames.find((n) => /contagem/i.test(n)) || wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: true });
  const items = [];
  const secoes = [];
  let secaoAtual = 'OUTROS';
  let ordem = 0;

  for (let r = 5; r < rows.length; r++) {
    const rowNum = r + 1;
    const rawCod = String(rows[r][0] ?? '').trim();
    const desc = String(rows[r][1] ?? '').trim();
    if (!desc) continue;
    const c = sh[`C${rowNum}`];
    const d = sh[`D${rowNum}`];
    const hasPrice = typeof c?.v === 'number' || typeof d?.v === 'number';
    const isHeader =
      !hasPrice &&
      !/^\d+$/.test(rawCod) &&
      !/^(CODIGO|DESCRICAO|TOTAL GERAL|CONTAGEM)\b/i.test(normalizarDesc(desc));
    if (isHeader) {
      secaoAtual = secaoCanon(desc);
      if (!secoes.includes(secaoAtual)) secoes.push(secaoAtual);
      continue;
    }
    ordem += 1;
    items.push({
      ordem,
      descricao: desc,
      secao: secaoCanon(secaoAtual),
      chave: chaveContagem(desc),
    });
  }
  return { items, secoes };
}

function preferirInsumo(a, b) {
  const suf = (c) => /-\d+$/.test(String(c || ''));
  if (suf(a.codigo) !== suf(b.codigo)) return suf(a.codigo) ? 1 : -1;
  if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
  return String(a.codigo).localeCompare(String(b.codigo));
}

function client() {
  return new pg.Client({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 5432),
  });
}

async function main() {
  if (!fs.existsSync(arquivo)) {
    console.error('Planilha não encontrada:', arquivo);
    process.exit(1);
  }
  const { items, secoes } = parsePlanilha(arquivo);
  console.log(`Planilha: ${items.length} itens`);
  console.log(`Seções: ${secoes.join(' | ')}`);

  const c = client();
  await c.connect();
  try {
    const lojas = await c.query(
      `SELECT id_loja, name, bk_number FROM lojas
       WHERE COALESCE(is_active, TRUE) AND name ILIKE '%burger king%'
       ORDER BY id_loja`,
    );
    console.log(`Lojas BK: ${lojas.rows.length}`);

    const { rows: amostra } = await c.query(
      `SELECT id_insumo, codigo, descricao, ativo FROM insumos WHERE id_loja = $1`,
      [lojas.rows.find((l) => l.id_loja === 16)?.id_loja || lojas.rows[0].id_loja],
    );
    const byChave = new Map();
    for (const r of amostra) {
      const k = chaveContagem(r.descricao);
      if (!byChave.has(k)) byChave.set(k, []);
      byChave.get(k).push(r);
    }
    const used = new Set();
    let ok = 0;
    const miss = [];
    for (const it of items) {
      const cands = (byChave.get(it.chave) || []).filter((x) => !used.has(x.id_insumo)).sort(preferirInsumo);
      if (!cands.length) {
        miss.push(it);
        continue;
      }
      used.add(cands[0].id_insumo);
      ok += 1;
    }
    console.log(`Match loja modelo: ${ok} | sem match: ${miss.length}`);
    if (miss.length) {
      console.log('Sem match:');
      for (const m of miss) console.log(`  ${String(m.ordem).padStart(3)} ${m.chave.padEnd(22)} ${m.descricao.slice(0, 60)}`);
    }
    const extras = amostra.filter((r) => r.ativo && !used.has(r.id_insumo));
    console.log(`Ativos fora da planilha: ${extras.length}`);
    for (const e of extras.slice(0, 40)) {
      console.log(`  ${chaveContagem(e.descricao).padEnd(22)} ${e.codigo} ${e.descricao.slice(0, 50)}`);
    }

    if (dryRun) {
      console.log('Dry-run — nada gravado.');
      return;
    }

    const t0 = Date.now();
    const { rows: catAll } = await c.query(
      `SELECT p.id_insumo, p.id_loja, p.codigo, p.descricao, p.secao_contagem, p.ativo
       FROM insumos p
       WHERE p.id_loja = ANY($1::int[])`,
      [lojas.rows.map((l) => l.id_loja)],
    );
    const porLoja = new Map();
    for (const r of catAll) {
      if (!porLoja.has(r.id_loja)) porLoja.set(r.id_loja, []);
      porLoja.get(r.id_loja).push(r);
    }

    const updIds = [];
    const updSecao = [];
    const updOrdem = [];
    const updAtivo = [];
    const insLoja = [];
    const insCod = [];
    const insDesc = [];
    const insSecao = [];
    const insOrdem = [];
    let upd = 0;
    let ins = 0;
    let extraN = 0;
    let dupOff = 0;

    for (const loja of lojas.rows) {
      const cat = porLoja.get(loja.id_loja) || [];
      const mapa = new Map();
      for (const r of cat) {
        const k = chaveContagem(r.descricao);
        if (!mapa.has(k)) mapa.set(k, []);
        mapa.get(k).push(r);
      }
      const usados = new Set();
      const maxPorSecao = new Map();
      for (const it of items) {
        maxPorSecao.set(it.secao, Math.max(maxPorSecao.get(it.secao) || 0, it.ordem * 10));
      }

      for (const it of items) {
        const cands = (mapa.get(it.chave) || [])
          .filter((x) => !usados.has(x.id_insumo))
          .sort(preferirInsumo);
        const hit = cands[0];
        const ordem = it.ordem * 10;
        if (hit) {
          usados.add(hit.id_insumo);
          updIds.push(hit.id_insumo);
          updSecao.push(it.secao);
          updOrdem.push(ordem);
          updAtivo.push(hit.ativo);
          upd += 1;
          for (const extraDup of cands.slice(1)) {
            usados.add(extraDup.id_insumo);
            updIds.push(extraDup.id_insumo);
            updSecao.push(it.secao);
            updOrdem.push(ordem + 1);
            updAtivo.push(false);
            dupOff += 1;
          }
          continue;
        }
        const slug = normalizarDesc(it.descricao).replace(/[^A-Z0-9]+/g, '').slice(0, 18);
        insLoja.push(loja.id_loja);
        insCod.push(`RCNT-${slug || it.ordem}`);
        insDesc.push(it.descricao);
        insSecao.push(it.secao);
        insOrdem.push(ordem);
        ins += 1;
      }

      for (const r of cat.filter((x) => !usados.has(x.id_insumo))) {
        const secao = secaoCanon(r.secao_contagem) || 'LANÇAMENTO';
        const next = (maxPorSecao.get(secao) || 9000) + 10;
        maxPorSecao.set(secao, next);
        updIds.push(r.id_insumo);
        updSecao.push(secao);
        updOrdem.push(next);
        updAtivo.push(r.ativo);
        extraN += 1;
      }
    }

    console.log(`Montado em ${Date.now() - t0}ms — gravando lote…`);
    await c.query('BEGIN');
    await c.query(`
      UPDATE insumos i
      SET secao_contagem = t.secao,
          ordem_contagem = t.ordem,
          ativo = t.ativo,
          atualizado_em = NOW()
      FROM unnest($1::int[], $2::text[], $3::int[], $4::bool[]) AS t(id_insumo, secao, ordem, ativo)
      WHERE i.id_insumo = t.id_insumo
    `, [updIds, updSecao, updOrdem, updAtivo]);

    if (insLoja.length) {
      await c.query(`
        INSERT INTO insumos (
          id_loja, codigo, descricao, unidade_contagem, preco_caixa,
          und_convertida, und_parcial, ativo,
          secao_contagem, ordem_contagem, entra_cmv, atualizado_em
        )
        SELECT loja, codigo, descricao, 'UND', 0, 1, 1, FALSE, secao, ordem, TRUE, NOW()
        FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::int[])
          AS t(loja, codigo, descricao, secao, ordem)
        ON CONFLICT (id_loja, codigo) DO UPDATE SET
          secao_contagem = EXCLUDED.secao_contagem,
          ordem_contagem = EXCLUDED.ordem_contagem,
          atualizado_em = NOW()
      `, [insLoja, insCod, insDesc, insSecao, insOrdem]);
    }

    // Duplicata fantasma do tomate (35046-2) sai da contagem aberta — o 019909 fica.
    await c.query(`
      DELETE FROM estoque_itens ei
      USING estoque_contagens c, insumos i
      WHERE ei.id_contagem = c.id_contagem
        AND ei.id_insumo = i.id_insumo
        AND c.status = 'aberta'
        AND i.codigo = '35046-2'
        AND i.descricao ILIKE '%tomate%'
    `);

    // Itens da planilha que acabamos de criar (inativos) entram nas completas abertas.
    await c.query(`
      INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
      SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
      FROM estoque_contagens c
      JOIN insumos p ON p.id_loja = c.id_loja
      LEFT JOIN estoque_saldos s ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
      WHERE c.status = 'aberta'
        AND COALESCE(c.tipo, 'completa') = 'completa'
        AND p.codigo LIKE 'RCNT-%'
        AND NOT EXISTS (
          SELECT 1 FROM estoque_itens x
          WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
        )
    `);

    await c.query('COMMIT');
    console.log(
      `OK ${Date.now() - t0}ms lojas=${lojas.rows.length} update=${upd} insert=${ins} extras=${extraN} dups_inativos=${dupOff}`,
    );
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    await c.end();
  }
}

const esteArquivo = fileURLToPath(import.meta.url);
const entrada = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (path.normalize(esteArquivo).toLowerCase() === path.normalize(entrada).toLowerCase()) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
