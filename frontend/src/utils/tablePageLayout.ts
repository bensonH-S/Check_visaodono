export const tablePageLayoutSx = {
  width: '100%',
  height: { xs: 'calc(100dvh - 168px)', md: 'calc(100dvh - 148px)' },
  minHeight: 320,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
} as const;

export const tablePaperSx = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
} as const;

/** Rolagem só na vertical; a tabela usa toda a largura disponível. */
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
