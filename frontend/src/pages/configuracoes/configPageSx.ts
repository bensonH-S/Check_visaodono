import {
  FIN_BG,
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_SURFACE_ALT,
  FIN_TEXT,
  finBtnContainedSx,
  finBtnOutlinedSx,
  finCampoSx,
  finChipSx,
  finPaperSx,
} from '../../financeiro/temaFinanceiroEscuro';

/** Página de configuração no padrão visual da Agenda banco. */
export const configPageSx = {
  flex: 1,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25,
  bgcolor: FIN_BG,
  color: FIN_TEXT,
  boxSizing: 'border-box' as const,
} as const;

export const configToolbarSx = {
  display: 'flex',
  flexDirection: { xs: 'column', md: 'row' },
  alignItems: { md: 'center' },
  gap: 1.25,
  flexShrink: 0,
} as const;

export const configPaperSx = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderRadius: '10px',
  boxShadow: 'none',
  ...finPaperSx,
} as const;

export {
  FIN_BG,
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_SURFACE_ALT,
  FIN_TEXT,
  finBtnContainedSx,
  finBtnOutlinedSx,
  finCampoSx,
  finChipSx,
  finPaperSx,
};
