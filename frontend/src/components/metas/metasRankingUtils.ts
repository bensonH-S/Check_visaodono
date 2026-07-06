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

export function rankingDecimaisValor(codigo: string): number {
  return codigo === 'rank_rev' ? 4 : 3;
}

export const OPCOES_REV_CLASSE = [
  { value: '', label: '—' },
  { value: 'REV', label: 'REV' },
  { value: 'REC', label: 'REC' },
] as const;

export const OPCOES_REV_FAIXA = [
  { value: '', label: '—' },
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'DEMANDA', label: 'DEMANDA' },
] as const;

export const OPCOES_CRITICO = [
  { value: '', label: '—' },
  ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
] as const;

export function linhaRevDemanda(linha: { destaque?: string | null }): boolean {
  return String(linha.destaque || '').toUpperCase() === 'DEMANDA';
}

export function formatValorPercentualExibicao(
  valor_numero: number | null,
  valor_texto: string | null,
  decimais = 3,
): string {
  if (valor_texto && valor_texto.toUpperCase() !== 'DEMANDA') return valor_texto;
  if (valor_numero == null) return '';
  const abs = Math.abs(valor_numero);
  const pct = abs <= 1 ? valor_numero * 100 : valor_numero;
  return pct.toFixed(decimais).replace(/\.?0+$/, '').replace(/\.$/, '');
}

export function formatValorPercentualLeitura(
  valor_numero: number | null,
  valor_texto: string | null,
  codigo?: string,
): string {
  const decimais = codigo ? rankingDecimaisValor(codigo) : 3;
  const s = formatValorPercentualExibicao(valor_numero, valor_texto, decimais);
  if (!s || (valor_texto && valor_texto.toUpperCase() !== 'DEMANDA')) return s;
  return `${s}%`;
}

export function parseValorPercentual(
  input: string,
  decimais = 3,
): { valor_numero: number | null; valor_texto: string | null } {
  const s = input.trim().replace('%', '').trim();
  if (!s) return { valor_numero: null, valor_texto: null };
  const upper = s.toUpperCase();
  if (upper === 'DEMANDA') return { valor_numero: null, valor_texto: upper };
  const n = Number(s.replace(',', '.'));
  if (Number.isNaN(n)) return { valor_numero: null, valor_texto: s };
  let decimal: number;
  if (n > 1 && n <= 100) decimal = n / 100;
  else decimal = n;
  const factor = 10 ** decimais;
  decimal = Math.round(decimal * factor) / factor;
  return { valor_numero: decimal, valor_texto: null };
}

export function parsePontosRanking(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isNaN(n) ? null : Math.trunc(n);
}

/** Lojas com DEMANDA no ranking R.E.V. — não contabilizam no resumo. */
export function lojasRevDemanda(rankings: Array<{ codigo: string; linhas: Array<{ id_loja: number | null; destaque: string | null }> }>): Set<number> {
  const rev = rankings.find((g) => g.codigo === 'rank_rev');
  const set = new Set<number>();
  if (!rev) return set;
  for (const linha of rev.linhas) {
    if (linha.id_loja != null && linhaRevDemanda(linha)) set.add(linha.id_loja);
  }
  return set;
}
