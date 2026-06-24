import { colors } from '../theme/tokens';

export type EstiloChipPerfil = {
  bgcolor: string;
  color: string;
  borderColor: string;
};

/** Cores por código de cargo (Configurações → Cargos). */
const CORES_POR_CARGO: Record<string, EstiloChipPerfil> = {
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

const ESTILO_PADRAO: EstiloChipPerfil = {
  bgcolor: 'rgba(107, 114, 128, 0.08)',
  color: colors.textSecondary,
  borderColor: colors.border,
};

export function estiloChipPerfil(cargoCodigo?: string | null): EstiloChipPerfil {
  const codigo = String(cargoCodigo || '').toLowerCase();
  return CORES_POR_CARGO[codigo] ?? ESTILO_PADRAO;
}
