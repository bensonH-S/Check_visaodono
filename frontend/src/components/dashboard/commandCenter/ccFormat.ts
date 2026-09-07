export function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return `${Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function fmtInt(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('pt-BR');
}

export function fmtDelta(n: number | null | undefined, digits = 1) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  const abs = Math.abs(Number(n)).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return { valor: abs, positivo: Number(n) >= 0, raw: Number(n) };
}

export function lojaLabel(name: string) {
  return (name || '').replace(/^BURGER\s+KING\s*[-–]?\s*/i, 'BURGER KING - ').trim();
}

export const LIMITE_VELOCIDADE_KMH = 80;
