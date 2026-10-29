import type { EstoqueSaldoItem } from '../../api/client';

export type AbaEstoqueHub = 'visao' | 'insumos' | 'nf' | 'movimentos';
export type FiltroInsumoHub = 'todos' | 'zerados' | 'abaixo' | 'criticos' | 'supercriticos';
export type StatusSaldoHub = 'ok' | 'zerado' | 'abaixo';

export function qtdSaldo(item: EstoqueSaldoItem) {
  return Number(item.quantidade) || 0;
}

export function statusSaldo(item: EstoqueSaldoItem): StatusSaldoHub {
  const q = qtdSaldo(item);
  if (q <= 0.001) return 'zerado';
  if (q < 2) return 'abaixo';
  return 'ok';
}

export function rotuloStatusSaldo(status: StatusSaldoHub) {
  if (status === 'zerado') return 'Zero';
  if (status === 'abaixo') return 'Abaixo';
  return 'OK';
}

/** Itens da contagem diária (supercríticos). Semanal entra depois. */
export function ehInsumoDiario(item: EstoqueSaldoItem) {
  return Boolean(item.contagem_diaria);
}

export function passaFiltroInsumo(item: EstoqueSaldoItem, filtro: FiltroInsumoHub) {
  if (filtro === 'todos') return true;
  if (filtro === 'zerados') return statusSaldo(item) === 'zerado';
  if (filtro === 'abaixo') return statusSaldo(item) === 'abaixo';
  if (filtro === 'criticos') return Boolean(item.contagem_critica);
  if (filtro === 'supercriticos') return Boolean(item.contagem_diaria);
  return true;
}

export function buscaInsumo(item: EstoqueSaldoItem, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return (
    item.descricao.toLowerCase().includes(t) ||
    String(item.codigo || '').toLowerCase().includes(t)
  );
}

export function fmtQtdHub(v: number | null | undefined, unidade?: string | null) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const u = String(unidade || 'un').toLowerCase();
  return `${n} ${u}`;
}

export function iniciaisInsumo(descricao: string) {
  const limpo = descricao.replace(/[^A-Za-zÀ-ÿ0-9]/g, ' ').trim();
  const partes = limpo.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
  return (partes[0] || 'IN').slice(0, 2).toUpperCase();
}

/** Nome da loja sem "BURGER KING" / endereço longo. */
export function nomeLojaCurta(nome: string, bk?: string | null) {
  let n = String(nome || '')
    .replace(/burger\s*king/gi, '')
    .replace(/\bbk\b/gi, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  n = n.replace(/^(\d{2,5})\s+/, '');
  const partes = n.split(' ').filter(Boolean);
  const curto = partes.slice(-2).join(' ') || n || 'Loja';
  return bk ? `BK ${bk} · ${curto}` : curto;
}

/** Tira marca, caixa e peso do nome do insumo. */
export function nomeInsumoCurto(descricao: string) {
  let n = String(descricao || '');
  n = n
    .replace(/\bburger\s*king\b/gi, '')
    .replace(/\bbk\b/gi, '')
    .replace(/\bcong(?:elad[oa])?\b/gi, '')
    .replace(/\bcx\s*\d+[.,]?\d*\s*k?g?\b/gi, '')
    .replace(/\b\d+[.,]\d+\s*kg\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (n.length > 22) n = `${n.slice(0, 20).trim()}…`;
  return n || descricao;
}

const THUMB_DIARIA = [
  '021403',
  '35221',
  '35622',
  '38178',
  '031777',
  '34580',
  '42297',
  '35619',
  '42284',
  '21317',
  '28582',
  '034840',
  '034754',
  '036252',
  '038585',
  '21055',
  '41962',
  '028459',
] as const;

/** Fotos novas da sugestão de pedido. O arquivo é estoque-thumbs/{codigo}.png. */
const THUMB_PEDIDO = [
  '38577', '41963', '29857', '30482', '39059', '41948', '32375', '35959', '38021',
  '37709', '35046', '37967', '35083', '3029', '36234', '35740', '31896',
  '28999', '39300', '30489', '40366', '40365', '35293', '38829', '31161', '35407',
  '35708', '39642', '34298', '40364', '35835', '30153', '34862', '35531', '38643',
  '38810', '31543', '32387', '32997', '35144', '38742', '40367', '31192', '23119',
  '42299', '42137', '42293', '4330', '38641', '42295', '34638', '38851', '33290',
  '42342', '35079', '31439', '42242', '34600', '42288',
] as const;

const THUMB_CODIGO: Record<string, string> = {};
const FOTO_V = '?v=6';
function registrarThumb(code: string, ext: 'png' | 'jpg') {
  const arquivo = `estoque-thumbs/${code}.${ext}${FOTO_V}`;
  THUMB_CODIGO[code] = arquivo;
  const solto = code.replace(/^0+/, '');
  if (solto) THUMB_CODIGO[solto] = arquivo;
}
for (const code of THUMB_DIARIA) registrarThumb(code, 'png');
for (const code of THUMB_PEDIDO) registrarThumb(code, 'jpg');
for (const code of ['35622', '38178', '031777', '34580', '35619', '42284', '21317', '28582', '036252', '21055', '028459', '41962', '42297', '35221', '021403']) {
  registrarThumb(code, 'jpg');
}
const FOTO_PAO = `estoque-thumbs/036252.jpg${FOTO_V}`;
for (const code of ['034840', '34840', '034754', '34754', '038585', '38585', '36252']) {
  THUMB_CODIGO[code] = FOTO_PAO;
}
THUMB_CODIGO.alface = `estoque-thumbs/alface.jpg${FOTO_V}`;

/** Nome do produto → foto. O mais específico vem primeiro. */
const THUMB_NOME: Array<[RegExp, string]> = [
  [/caixa the kings/i, '38577'],
  [/bacon pronto assado|bacon.*tiras/i, '28582'],
  [/lamina rebel/i, '29857'],
  [/confeito chocolate/i, '30482'],
  [/biscoito baunilha granulado/i, '39059'],
  [/tampa domo/i, '41948'],
  [/nugget/i, '34580'],
  [/pepino fatiado/i, '32375'],
  [/queijo cheddar clean|cheddar clean bk/i, '35619'],
  [/carne hb|hamb[uú]rguer.*\bbkc\b/i, '35622'],
  [/rebel sabor picanha|hamb[uú]rguer rebel/i, '38178'],
  [/chicken jr/i, '031777'],
  [/suco de laranja integral|suco laranja 12/i, '35959'],
  [/batata cong pre frita|9mm/i, '21055'],
  [/maionese granel sabor bacon/i, '37709'],
  [/suco uva maca/i, '35046'],
  [/bacon bk ass cubos|bacon.*cubos/i, '21317'],
  [/molho stacker/i, '37967'],
  [/alface americana/i, 'alface'],
  [/jalapeno|jalape[nñ]o/i, '35083'],
  [/agua copo 200/i, '3029'],
  [/casquinha sorvete bk cx 300/i, '36234'],
  [/maionese verde sachet/i, '35740'],
  [/copo shake 440/i, '31896'],
  [/lamina stacker/i, '28999'],
  [/ovomaltine flocos/i, '39300'],
  [/ketchup a granel/i, '30489'],
  [/lamina chicken whopper/i, '40365'],
  [/lamina whopper bk/i, '40366'],
  [/cartonagem batata media -/i, '35293'],
  [/canudo papel milkshake/i, '38829'],
  [/doce de leite bk bisnaga/i, '31161'],
  [/mostarda heinz bk bag/i, '35407'],
  [/mistura milk shake/i, '35708'],
  [/molho sabor queijo cheddar/i, '39642'],
  [/brownie brigadeiro/i, '34298'],
  [/lamina king ofertas/i, '40364'],
  [/maionese sachet sabor bacon/i, '35835'],
  [/calda morango/i, '30153'],
  [/molho furioso bk ncm cx 144|blister 28g/i, '34862'],
  [/cebola frita crispy/i, '35531'],
  [/fundo batata suprema/i, '38643'],
  [/lamina chicken whopper/i, '40365'],
  [/onion rings/i, '38810'],
  [/garfo sobremesa/i, '31543'],
  [/maionese sachet - cx|sachet maionese clean/i, '32997'],
  [/saquinho de batata/i, '35144'],
  [/cart batata media dlv/i, '38742'],
  [/lamina big king nova/i, '40367'],
  [/cartonagem batata grande bk innovapack|cartonagem batata grande/i, '31192'],
  [/luva p\/ lixo cano longo/i, '23119'],
  [/estrogonoff/i, '42299'],
  [/tampa pote bk 240/i, '42137'],
  [/carne de panela/i, '42293'],
  [/etiqueta \(domingo\)/i, '4330'],
  [/tampa batata suprema grande/i, '38641'],
  [/coxa desossada/i, '42295'],
  [/molho furioso ncm bk 5/i, '34638'],
  [/sacola p\/ viagem/i, '38851'],
  [/sal refinado sache/i, '33290'],
  [/tempero sal e pimenta/i, '42342'],
  [/queijo crispy/i, '42284'],
  [/detergente bk/i, '35079'],
  [/tampa refrigerante 440/i, '31439'],
  [/copo refrig universal 550/i, '42242'],
  [/tampa shake bk 440/i, '34600'],
  [/pao bk supremo|p[aã]o bk supremo/i, '036252'],
  [/sweet chilli/i, '42288'],
];

export function thumbInsumo(item: { codigo?: string | null; descricao?: string | null; grupo_diario?: string | null }) {
  const codigo = String(item.codigo || '').replace(/^0+/, '') || String(item.codigo || '');
  const porCodigo = THUMB_CODIGO[String(item.codigo || '')] || THUMB_CODIGO[codigo];
  if (porCodigo) return porCodigo;

  const descricao = String(item.descricao || '');
  for (const [teste, code] of THUMB_NOME) {
    if (teste.test(descricao) && THUMB_CODIGO[code]) return THUMB_CODIGO[code];
  }

  return `estoque-thumbs/sem-foto.svg${FOTO_V}`;
}

export function dataHubPt(d = new Date()) {
  const raw = d.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  });
  return raw.replace('.', '');
}

export function horaHubPt(d = new Date()) {
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}
