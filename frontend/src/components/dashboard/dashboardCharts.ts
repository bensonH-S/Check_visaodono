import type { SxProps, Theme } from '@mui/material/styles';

export const NAVY = '#1B2A6B';
export const ORANGE = '#E8520A';

export const GRAVIDADE_CORES: Record<string, string> = {
  Crítica: '#DC2626',
  Moderada: '#E8520A',
  Baixa: '#EAB308',
};

export const dashboardPanelSx: SxProps<Theme> = {
  p: { xs: 2, sm: 2.5 },
  height: '100%',
  borderRadius: 2,
  border: '1px solid rgba(27, 42, 107, 0.1)',
  bgcolor: '#fff',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 2px 14px rgba(27, 42, 107, 0.07)',
};

export const dashboardPanelTitleSx = {
  fontWeight: 800,
  fontSize: { xs: '0.9rem', sm: '0.95rem' },
  color: NAVY,
  mb: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
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
    fontWeight: 800,
    flexShrink: 0,
    bgcolor: top3 ? ORANGE : '#E8EAED',
    color: top3 ? '#fff' : NAVY,
  };
}

export function notaBarColor(nota: number) {
  if (nota >= 85) return '#16A34A';
  if (nota >= 75) return '#EAB308';
  return '#DC2626';
}
