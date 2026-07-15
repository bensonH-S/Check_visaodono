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

/** Crítico do R.E.V.: 0 a 12 (planilha permite zero). */
export const OPCOES_CRITICO = [
  { value: '', label: '—' },
  ...Array.from({ length: 13 }, (_, i) => ({ value: String(i), label: String(i) })),
] as const;

/** Menor crítico primeiro; sem valor vai para o fim. */
export function ordenarLinhasPorCriticoAsc<T extends { critico?: number | null; posicao?: number | null }>(
  linhas: T[],
): T[] {
  return [...linhas].sort((a, b) => {
    const ca = a.critico;
    const cb = b.critico;
    if (ca == null && cb == null) return (a.posicao ?? 9999) - (b.posicao ?? 9999);
    if (ca == null) return 1;
    if (cb == null) return -1;
    if (ca !== cb) return ca - cb;
    return (a.posicao ?? 9999) - (b.posicao ?? 9999);
  });
}

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

  const factorPct = 10 ** decimais;
  // Entrada > 1: pontos percentuais (ex.: 4,99). Arredonda nessa escala e só então
  // converte para fração — senão 4,99 → 0,0499 → round(3) → 0,05 → 5%.
  if (Math.abs(n) > 1 && Math.abs(n) <= 100) {
    const pct = Math.round(n * factorPct) / factorPct;
    return { valor_numero: pct / 100, valor_texto: null };
  }

  // Já em fração (ex.: 0,0499): preserva as casas do percentual exibido (+2).
  const factorFrac = 10 ** (decimais + 2);
  const decimal = Math.round(n * factorFrac) / factorFrac;
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
