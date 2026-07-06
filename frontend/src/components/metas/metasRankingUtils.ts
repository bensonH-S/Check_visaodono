/** Rankings cujo campo Valor é percentual (exibido com %). */
const RANKINGS_PERCENTUAL = new Set([
  'rank_cmp',
  'rank_saude',
  'rank_rev',
  'rank_misterioso',
  'rank_delivery',
  'rank_ano_anterior',
  'rank_nps',
  'rank_google',
]);

export function rankingValorPercentual(codigo: string): boolean {
  return RANKINGS_PERCENTUAL.has(codigo);
}

export function rankingColunaRevRec(codigo: string): boolean {
  return codigo === 'rank_rev';
}

export const OPCOES_REV_CLASSE = [
  { value: '', label: '—' },
  { value: 'REV', label: 'REV' },
  { value: 'REC_', label: 'REC_' },
] as const;

export function formatValorPercentualExibicao(valor_numero: number | null, valor_texto: string | null): string {
  if (valor_texto) return valor_texto;
  if (valor_numero == null) return '';
  const abs = Math.abs(valor_numero);
  const pct = abs <= 1 ? valor_numero * 100 : valor_numero;
  return String(Number(pct.toFixed(4).replace(/\.?0+$/, '')));
}

export function formatValorPercentualLeitura(valor_numero: number | null, valor_texto: string | null): string {
  const s = formatValorPercentualExibicao(valor_numero, valor_texto);
  if (!s || valor_texto) return s;
  return `${s}%`;
}

export function parseValorPercentual(input: string): { valor_numero: number | null; valor_texto: string | null } {
  const s = input.trim().replace('%', '').trim();
  if (!s) return { valor_numero: null, valor_texto: null };
  const upper = s.toUpperCase();
  if (upper === 'DEMANDA') return { valor_numero: null, valor_texto: upper };
  const n = Number(s.replace(',', '.'));
  if (Number.isNaN(n)) return { valor_numero: null, valor_texto: s };
  if (n > 1 && n <= 100) return { valor_numero: n / 100, valor_texto: null };
  return { valor_numero: n, valor_texto: null };
}

export function parsePontosRanking(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isNaN(n) ? null : Math.trunc(n);
}
