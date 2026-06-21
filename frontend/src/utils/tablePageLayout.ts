import { colors } from '../theme/tokens';
import { pageFillLayoutSx } from '../utils/pageFillLayout';

export const tablePageLayoutSx = {
  ...pageFillLayoutSx,
} as const;

export const tablePaperSx = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  border: '1px solid',
  borderColor: colors.border,
  borderRadius: 2,
  bgcolor: colors.surface,
  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
} as const;

export const tableContainerSx = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
} as const;

export const tableSx = {
  width: '100%',
  tableLayout: 'auto',
} as const;

export const tableCellWrapSx = {
  whiteSpace: 'normal',
  wordBreak: 'break-word',
} as const;
