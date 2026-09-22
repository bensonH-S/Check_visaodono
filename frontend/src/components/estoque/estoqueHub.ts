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

const THUMB_CODIGO: Record<string, string> = {};
for (const code of THUMB_DIARIA) {
  const path = `estoque-thumbs/${code}.png`;
  THUMB_CODIGO[code] = path;
  THUMB_CODIGO[code.replace(/^0+/, '')] = path;
}

const THUMB_GRUPO: Record<string, string> = {
  carne: 'estoque-thumbs/021403.png',
  bacon: 'estoque-thumbs/28582.png',
  pao: 'estoque-thumbs/034840.png',
  queijo: 'estoque-thumbs/35619.png',
  frango: 'estoque-thumbs/34580.png',
  batata: 'estoque-thumbs/21055.png',
  refil: 'estoque-thumbs/41962.png',
  mix_sobremesa: 'estoque-thumbs/41962.png',
};

export function thumbInsumo(item: { codigo?: string | null; descricao?: string | null; grupo_diario?: string | null }) {
  const codigo = String(item.codigo || '').replace(/^0+/, '') || String(item.codigo || '');
  const porCodigo = THUMB_CODIGO[String(item.codigo || '')] || THUMB_CODIGO[codigo];
  if (porCodigo) return porCodigo;

  const nome = String(item.descricao || '').toLowerCase();
  if (/nugget/i.test(nome)) return 'estoque-thumbs/34580.png';
  if (/chicken\s*jr|jr\s*clean/i.test(nome)) return 'estoque-thumbs/031777.png';
  if (/pizzaiolo/i.test(nome)) return 'estoque-thumbs/42297.png';
  if (/crispy/i.test(nome)) return 'estoque-thumbs/42284.png';
  if (/cheddar|queijo/i.test(nome)) return 'estoque-thumbs/35619.png';
  if (/bacon.*cub/i.test(nome)) return 'estoque-thumbs/21317.png';
  if (/bacon/i.test(nome)) return 'estoque-thumbs/28582.png';
  if (/brioche/i.test(nome)) return 'estoque-thumbs/038585.png';
  if (/supremo/i.test(nome)) return 'estoque-thumbs/036252.png';
  if (/p[aã]o.*\b5\b|\b5\b.*p[aã]o/i.test(nome)) return 'estoque-thumbs/034754.png';
  if (/p[aã]o/i.test(nome)) return 'estoque-thumbs/034840.png';
  if (/batata/i.test(nome)) return 'estoque-thumbs/21055.png';
  if (/doce\s*de\s*leite/i.test(nome)) return 'estoque-thumbs/028459.png';
  if (/baunilha|l[aá]ctea|bebida/i.test(nome)) return 'estoque-thumbs/41962.png';
  if (/rebel|picanha/i.test(nome)) return 'estoque-thumbs/38178.png';
  if (/gourmet/i.test(nome)) return 'estoque-thumbs/35221.png';
  if (/\bbkc\b|carne\s*hb/i.test(nome)) return 'estoque-thumbs/35622.png';
  if (/carne|hamburger|hamb[uú]rguer/i.test(nome)) return 'estoque-thumbs/021403.png';
  if (/chicken|frango/i.test(nome)) return 'estoque-thumbs/031777.png';

  return THUMB_GRUPO[String(item.grupo_diario || '')] || 'estoque-thumbs/insumo.svg';
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
