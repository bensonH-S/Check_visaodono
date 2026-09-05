import { colors } from '../theme/tokens';

export type EstiloChipPerfil = {
  bgcolor: string;
  color: string;
  borderColor: string;
};

/** Cores por código de cargo (Configurações → Cargos) para tema claro. */
const CORES_POR_CARGO_CLARO: Record<string, EstiloChipPerfil> = {
  administrador: {
    bgcolor: colors.navyMuted,
    color: colors.navy,
    borderColor: colors.navyBorder,
  },
  ceo: {
    bgcolor: 'rgba(88, 28, 135, 0.1)',
    color: '#581C87',
    borderColor: 'rgba(88, 28, 135, 0.28)',
  },
  dono: {
    bgcolor: 'rgba(146, 64, 14, 0.1)',
    color: '#92400E',
    borderColor: 'rgba(146, 64, 14, 0.28)',
  },
  diretor: {
    bgcolor: 'rgba(49, 46, 129, 0.1)',
    color: '#312E81',
    borderColor: 'rgba(49, 46, 129, 0.28)',
  },
  financeiro: {
    bgcolor: 'rgba(15, 118, 110, 0.1)',
    color: '#0F766E',
    borderColor: 'rgba(15, 118, 110, 0.28)',
  },
  gerente: {
    bgcolor: 'rgba(29, 78, 216, 0.1)',
    color: '#1D4ED8',
    borderColor: 'rgba(29, 78, 216, 0.28)',
  },
  coordenador: {
    bgcolor: 'rgba(8, 145, 178, 0.1)',
    color: '#0891B2',
    borderColor: 'rgba(8, 145, 178, 0.28)',
  },
  supervisor_regional: {
    bgcolor: colors.orangeLight,
    color: colors.orange,
    borderColor: 'rgba(232, 82, 10, 0.35)',
  },
  regional: {
    bgcolor: 'rgba(217, 119, 6, 0.1)',
    color: '#D97706',
    borderColor: 'rgba(217, 119, 6, 0.28)',
  },
  tecnico: {
    bgcolor: 'rgba(22, 163, 74, 0.1)',
    color: '#16A34A',
    borderColor: 'rgba(22, 163, 74, 0.28)',
  },
  ti: {
    bgcolor: 'rgba(75, 85, 99, 0.1)',
    color: '#4B5563',
    borderColor: 'rgba(75, 85, 99, 0.28)',
  },
};

/** Cores por código de cargo para tema escuro (cores suaves/pastéis com ótimo contraste). */
const CORES_POR_CARGO_ESCURO: Record<string, EstiloChipPerfil> = {
  administrador: {
    bgcolor: 'rgba(232, 82, 10, 0.18)',
    color: '#FB923C',
    borderColor: 'rgba(232, 82, 10, 0.40)',
  },
  ceo: {
    bgcolor: 'rgba(192, 132, 252, 0.16)',
    color: '#C084FC',
    borderColor: 'rgba(192, 132, 252, 0.38)',
  },
  dono: {
    bgcolor: 'rgba(251, 191, 36, 0.16)',
    color: '#FBBF24',
    borderColor: 'rgba(251, 191, 36, 0.38)',
  },
  diretor: {
    bgcolor: 'rgba(165, 180, 252, 0.16)',
    color: '#A5B4FC',
    borderColor: 'rgba(165, 180, 252, 0.38)',
  },
  financeiro: {
    bgcolor: 'rgba(45, 212, 191, 0.16)',
    color: '#2DD4BF',
    borderColor: 'rgba(45, 212, 191, 0.38)',
  },
  gerente: {
    bgcolor: 'rgba(147, 197, 253, 0.16)',
    color: '#93C5FD',
    borderColor: 'rgba(147, 197, 253, 0.38)',
  },
  coordenador: {
    bgcolor: 'rgba(56, 189, 248, 0.16)',
    color: '#38BDF8',
    borderColor: 'rgba(56, 189, 248, 0.38)',
  },
  supervisor_regional: {
    bgcolor: 'rgba(249, 115, 22, 0.18)',
    color: '#FB923C',
    borderColor: 'rgba(249, 115, 22, 0.40)',
  },
  regional: {
    bgcolor: 'rgba(245, 158, 11, 0.18)',
    color: '#FBBF24',
    borderColor: 'rgba(245, 158, 11, 0.40)',
  },
  tecnico: {
    bgcolor: 'rgba(74, 222, 128, 0.16)',
    color: '#4ADE80',
    borderColor: 'rgba(74, 222, 128, 0.38)',
  },
  ti: {
    bgcolor: 'rgba(156, 163, 175, 0.16)',
    color: '#CBD5E1',
    borderColor: 'rgba(156, 163, 175, 0.38)',
  },
};

const ESTILO_PADRAO_CLARO: EstiloChipPerfil = {
  bgcolor: 'rgba(107, 114, 128, 0.08)',
  color: colors.textSecondary,
  borderColor: colors.border,
};

const ESTILO_PADRAO_ESCURO: EstiloChipPerfil = {
  bgcolor: 'rgba(255, 255, 255, 0.08)',
  color: '#E2E8F0',
  borderColor: 'rgba(255, 255, 255, 0.18)',
};

export function estiloChipPerfil(cargoCodigo?: string | null, isDark = false): EstiloChipPerfil {
  const codigo = String(cargoCodigo || '').toLowerCase();
  const mapa = isDark ? CORES_POR_CARGO_ESCURO : CORES_POR_CARGO_CLARO;
  const padrao = isDark ? ESTILO_PADRAO_ESCURO : ESTILO_PADRAO_CLARO;
  return mapa[codigo] ?? padrao;
}
