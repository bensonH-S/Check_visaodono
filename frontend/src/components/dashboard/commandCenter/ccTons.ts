/** Mesmos tons de status usados em Contas a pagar. */
export type Tom = { color: string; border: string; bg: string };

const CLARO: Record<string, Tom> = {
  neutro: { color: '#64748B', border: '#E2E8F0', bg: 'transparent' },
  azul: { color: '#1D4ED8', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.1)' },
  verde: { color: '#047857', border: 'rgba(16,185,129,0.45)', bg: 'rgba(16,185,129,0.12)' },
  vermelho: { color: '#B91C1C', border: 'rgba(239,68,68,0.45)', bg: 'rgba(239,68,68,0.08)' },
  ambar: { color: '#B45309', border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.12)' },
};

const ESCURO: Record<string, Tom> = {
  neutro: { color: '#94A3B8', border: '#1C3040', bg: 'transparent' },
  azul: { color: '#93C5FD', border: 'rgba(96,165,250,0.5)', bg: 'rgba(96,165,250,0.14)' },
  verde: { color: '#6EE7B7', border: 'rgba(52,211,153,0.45)', bg: 'rgba(52,211,153,0.14)' },
  vermelho: { color: '#FCA5A5', border: 'rgba(248,113,113,0.5)', bg: 'rgba(248,113,113,0.12)' },
  ambar: { color: '#FCD34D', border: 'rgba(251,191,36,0.5)', bg: 'rgba(251,191,36,0.12)' },
};

export type TomNome = keyof typeof CLARO;

export function tom(nome: TomNome, escuro: boolean): Tom {
  return (escuro ? ESCURO : CLARO)[nome];
}

export const chipSx = (t: Tom) => ({
  height: 20,
  fontSize: 11,
  fontWeight: 500,
  color: t.color,
  borderColor: t.border,
  bgcolor: t.bg,
});
