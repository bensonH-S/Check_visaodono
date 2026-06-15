import type { SxProps, Theme } from '@mui/material/styles';

type GridBreakpoint = 'md' | 'lg' | 'xl';

/** Layout do board: scroll horizontal no celular; grid a partir de lg (desktop/tablet landscape). */
export function kanbanBoardLayout(columnCount: number, gridAt: GridBreakpoint = 'lg'): SxProps<Theme> {
  return {
    display: { xs: 'flex', [gridAt]: 'grid' },
    gridTemplateColumns: { [gridAt]: `repeat(${columnCount}, minmax(260px, 1fr))` },
    gap: { xs: 1.25, sm: 1.5, [gridAt]: 1.75 },
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    pb: { xs: 1.5, [gridAt]: 0.5 },
    pt: 0.25,
    width: '100%',
    minWidth: 0,
    minHeight: { xs: 360, [gridAt]: 320 },
  };
}

/** Coluna do kanban: largura fixa no scroll horizontal; preenche o grid em telas grandes. */
export function kanbanColumnLayout(gridAt: GridBreakpoint = 'lg'): SxProps<Theme> {
  return {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: {
      xs: '0 0 min(85vw, 300px)',
      sm: '0 0 300px',
      md: '0 0 280px',
      [gridAt]: 'unset',
    },
    width: {
      xs: 'min(85vw, 300px)',
      sm: 300,
      md: 280,
      [gridAt]: '100%',
    },
    maxWidth: '100%',
  };
}

export function kanbanColumnHeaderSx(accent: string): SxProps<Theme> {
  return {
    display: 'flex',
    alignItems: 'center',
    mb: 1,
    px: 1,
    py: 0.875,
    borderRadius: 1.5,
    bgcolor: 'white',
    border: '1px solid rgba(27, 42, 107, 0.08)',
    borderTop: `3px solid ${accent}`,
    boxShadow: '0 1px 4px rgba(27, 42, 107, 0.06)',
  };
}

export const kanbanColumnBodySx: SxProps<Theme> = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25,
  bgcolor: 'rgba(27, 42, 107, 0.03)',
  borderRadius: 2,
  p: { xs: 1, sm: 1.25 },
  minHeight: { xs: 280, sm: 300, md: 260 },
  maxHeight: { xs: 'calc(100vh - 280px)', md: 'calc(100vh - 240px)', xl: 'calc(100vh - 220px)' },
  overflowY: 'auto',
  border: '1px solid rgba(27, 42, 107, 0.06)',
};

export const kanbanCardSx: SxProps<Theme> = {
  p: { xs: 1.25, sm: 1.5 },
  borderRadius: 1.5,
  cursor: 'pointer',
  border: '1px solid rgba(27, 42, 107, 0.12)',
  bgcolor: '#fff',
  transition: 'box-shadow 0.15s',
  '&:hover': { boxShadow: '0 4px 14px rgba(27, 42, 107, 0.12)' },
};

export const kanbanChipRowSx: SxProps<Theme> = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.5,
  alignItems: 'center',
  '& .MuiChip-root': {
    height: 22,
    fontSize: '0.68rem',
    '& .MuiChip-label': { px: 0.75 },
  },
};
