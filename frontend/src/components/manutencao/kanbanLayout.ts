import type { SxProps, Theme } from '@mui/material/styles';

type GridBreakpoint = 'md' | 'lg' | 'xl';

/** Board kanban: grid igual no desktop (sem scroll horizontal); colunas rolam por dentro. */
export function kanbanBoardLayout(columnCount: number, gridAt: GridBreakpoint = 'lg'): SxProps<Theme> {
  return {
    display: { xs: 'flex', [gridAt]: 'grid' },
    gridTemplateColumns: { [gridAt]: `repeat(${columnCount}, minmax(0, 1fr))` },
    gap: { xs: 1.25, [gridAt]: 1.25 },
    overflowX: { xs: 'auto', [gridAt]: 'hidden' },
    overflowY: 'hidden',
    flex: 1,
    minHeight: 0,
    height: '100%',
    width: '100%',
    minWidth: 0,
    pb: { xs: 0.5, [gridAt]: 0 },
  };
}

export function kanbanColumnLayout(gridAt: GridBreakpoint = 'lg'): SxProps<Theme> {
  return {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    flex: {
      xs: '0 0 min(78vw, 260px)',
      sm: '0 0 260px',
      [gridAt]: 'unset',
    },
    width: {
      xs: 'min(78vw, 260px)',
      sm: 260,
      [gridAt]: 'auto',
    },
    maxWidth: '100%',
  };
}

export function kanbanColumnHeaderSx(accent: string): SxProps<Theme> {
  return {
    display: 'flex',
    alignItems: 'center',
    mb: 0.75,
    px: 1,
    py: 0.75,
    borderRadius: 1,
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    borderTop: `3px solid ${accent}`,
    flexShrink: 0,
  };
}

export const kanbanColumnBodySx: SxProps<Theme> = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  bgcolor: 'action.hover',
  borderRadius: 1.5,
  p: { xs: 0.75, sm: 1 },
  overflowY: 'auto',
  border: '1px solid',
  borderColor: 'divider',
};

export const kanbanCardSx: SxProps<Theme> = {
  p: { xs: 1, sm: 1.25 },
  borderRadius: 1,
  cursor: 'pointer',
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'background.paper',
  flexShrink: 0,
  transition: 'box-shadow 0.15s',
  '&:hover': { boxShadow: 1 },
};

export const kanbanChipRowSx: SxProps<Theme> = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.5,
  alignItems: 'center',
  '& .MuiChip-root': {
    height: 20,
    fontSize: '0.65rem',
    '& .MuiChip-label': { px: 0.65 },
  },
};
