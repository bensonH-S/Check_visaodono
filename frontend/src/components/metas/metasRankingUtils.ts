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
  'rank_checklist_360',
]);

export function rankingValorPercentual(codigo: string): boolean {
  return RANKINGS_PERCENTUAL.has(codigo);
}

export function rankingColunaRevRec(codigo: string): boolean {
  return codigo === 'rank_rev';
}

export function rankingDecimaisValor(codigo: string): number {
  if (codigo === 'rank_rev') return 4;
  if (codigo === 'rank_delivery') return 2;
  if (codigo === 'rank_nps' || codigo === 'rank_ano_anterior' || codigo === 'rank_google') return 3;
  return 3;
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
  // Fração (0–1) → pontos percentuais; valores > 1 já estão em %.
  const pct = abs <= 1 ? valor_numero * 100 : valor_numero;
  // Mantém as casas da coluna (ex.: 86,00 → 86.0000 no R.E.V. com 4 dec.).
  return pct.toFixed(decimais);
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
  // Pontos percentuais (1 a 100, ex.: 86,00 / 4,99). Arredonda nessa escala e
  // converte para fração — senão 4,99 → 0,0499 → round(3) → 0,05 → 5%.
  // Inclui 1,00 (antes caía como fração e virava 100%).
  if (Math.abs(n) >= 1 && Math.abs(n) <= 100) {
    const pct = Math.round(n * factorPct) / factorPct;
    return { valor_numero: pct / 100, valor_texto: null };
  }

  // Já em fração (ex.: 0,0499): preserva as casas do percentual exibido (+2).
  const factorFrac = 10 ** (decimais + 2);
  const decimal = Math.round(n * factorFrac) / factorFrac;
  return { valor_numero: decimal, valor_texto: null };
}

/** Compara valores percentuais sem falhar por float (0.86 vs 0.8600000001). */
export function mesmosValoresPercentuais(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) < 1e-10;
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
