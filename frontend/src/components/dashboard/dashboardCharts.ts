import type { SxProps, Theme } from '@mui/material/styles';
import { colors, portalPanelSx, sectionLabelSx } from '../../theme/tokens';

export { colors, shadows } from '../../theme/tokens';
export const NAVY = colors.navy;
export const ORANGE = colors.orange;

export const GRAVIDADE_CORES: Record<string, string> = {
  Crítica: '#DC2626',
  Moderada: '#F97316',
  Baixa: '#EAB308',
  Leve: '#EAB308',
};

export const dashboardPanelSx: SxProps<Theme> = {
  ...portalPanelSx,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

export const dashboardPanelTitleSx = {
  ...sectionLabelSx,
  fontSize: { xs: '0.72rem', sm: '0.75rem' },
  mb: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  color: colors.navy,
  textTransform: 'none' as const,
  letterSpacing: '-0.01em',
  fontWeight: 600,
};

export function rankBadgeSx(posicao: number) {
  const top3 = posicao <= 3;
  return {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 700,
    flexShrink: 0,
    bgcolor: top3 ? colors.orange : colors.canvasAlt,
    color: top3 ? '#fff' : colors.navy,
  };
}

export function notaBarColor(nota: number) {
  if (nota >= 85) return '#16A34A';
  if (nota >= 75) return '#EAB308';
  return '#DC2626';
}
