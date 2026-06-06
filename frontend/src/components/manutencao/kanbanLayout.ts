import type { SxProps, Theme } from '@mui/material/styles';

type GridBreakpoint = 'lg' | 'xl';

/** Layout do board: scroll horizontal no mobile; grid em telas grandes. */
export function kanbanBoardLayout(columnCount: number, gridAt: GridBreakpoint = 'xl'): SxProps<Theme> {
  return {
    display: { xs: 'flex', [gridAt]: 'grid' },
    gridTemplateColumns: { [gridAt]: `repeat(${columnCount}, minmax(0, 1fr))` },
    gap: { xs: 1.25, sm: 1.5, [gridAt]: 2 },
    overflowX: { xs: 'auto', [gridAt]: 'visible' },
    WebkitOverflowScrolling: 'touch',
    pb: { xs: 1.5, [gridAt]: 0.5 },
    pt: 0.25,
    width: '100%',
    minWidth: 0,
    minHeight: { xs: 320, [gridAt]: 280 },
  };
}

/** Coluna do kanban: largura fixa no mobile; preenche o grid em telas grandes. */
export function kanbanColumnLayout(gridAt: GridBreakpoint = 'xl'): SxProps<Theme> {
  return {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: {
      xs: '0 0 min(88vw, 280px)',
      sm: '0 0 248px',
      md: '0 0 220px',
      [gridAt]: 'unset',
    },
    width: {
      xs: 'min(88vw, 280px)',
      sm: 248,
      md: 220,
      [gridAt]: '100%',
    },
    maxWidth: '100%',
  };
}

export const kanbanColumnBodySx: SxProps<Theme> = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  bgcolor: 'rgba(27, 42, 107, 0.04)',
  borderRadius: 1.5,
  p: { xs: 1, sm: 1.25 },
  minHeight: { xs: 260, sm: 280, md: 240 },
  maxHeight: { xs: 'calc(100vh - 260px)', md: 'calc(100vh - 220px)', xl: 'calc(100vh - 200px)' },
  overflowY: 'auto',
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
    height: 20,
    fontSize: '0.62rem',
    '& .MuiChip-label': { px: 0.75 },
  },
};
