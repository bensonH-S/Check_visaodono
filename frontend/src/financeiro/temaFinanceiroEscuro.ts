/** Tokens do Financeiro (Agenda, Inbox, Caixa, Integrações) — conteúdo claro; sidebar fica escura no layout. */
export const FIN_BG = '#F4F7FB'
export const FIN_SURFACE = '#FFFFFF'
export const FIN_SURFACE_ALT = '#F8FAFC'
export const FIN_BORDER = 'rgba(15, 23, 42, 0.12)'
export const FIN_TEXT = '#0F172A'
export const FIN_MUTED = '#64748B'
export const FIN_HEADER = '#FFFFFF'
export const FIN_CAMPO_H = 34

export const finMenuSx = {
  bgcolor: `${FIN_SURFACE} !important`,
  backgroundColor: `${FIN_SURFACE} !important`,
  color: FIN_TEXT,
  backgroundImage: 'none',
  border: `1px solid ${FIN_BORDER}`,
  borderRadius: '10px',
  maxHeight: 'min(70vh, 520px)',
  overflow: 'auto',
  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
  '& .MuiMenuItem-root, & .MuiAutocomplete-option': {
    color: `${FIN_TEXT} !important`,
    fontSize: 13,
    minHeight: 36,
    '&:hover, &[aria-selected="true"]': { bgcolor: 'rgba(27, 110, 243, 0.1) !important' },
    '&.Mui-focused': { bgcolor: 'rgba(27, 110, 243, 0.08) !important' },
  },
  '& .MuiList-root': { py: 0.5, maxHeight: 'none' },
} as const

/** MUI v9: PaperProps/MenuListProps foram removidos — usar só slotProps. */
export const finSelectMenu = {
  MenuProps: {
    slotProps: {
      paper: { sx: finMenuSx },
      list: { dense: true, sx: { maxHeight: 'none', py: 0.5 } },
    },
  },
} as const

export const FIN_CAMPO_RADIUS = '10px'

export const finCampoSx = {
  bgcolor: `${FIN_SURFACE} !important`,
  borderRadius: FIN_CAMPO_RADIUS,
  '& .MuiOutlinedInput-root': {
    color: FIN_TEXT,
    bgcolor: FIN_SURFACE,
    minHeight: FIN_CAMPO_H,
    height: FIN_CAMPO_H,
    borderRadius: `${FIN_CAMPO_RADIUS} !important`,
    overflow: 'hidden',
    '& fieldset, & .MuiOutlinedInput-notchedOutline': {
      borderColor: FIN_BORDER,
      borderRadius: `${FIN_CAMPO_RADIUS} !important`,
    },
    '&:hover fieldset, &:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(15, 23, 42, 0.28)',
    },
    '&.Mui-focused fieldset, &.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#1B6EF3',
      borderWidth: 1,
    },
  },
  '& .MuiInputBase-input': {
    color: FIN_TEXT,
    py: 0,
    height: FIN_CAMPO_H,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiInputLabel-root': { color: FIN_MUTED },
  '& .MuiSelect-select': {
    py: '0 !important',
    display: 'flex',
    alignItems: 'center',
    minHeight: `${FIN_CAMPO_H}px !important`,
    height: FIN_CAMPO_H,
  },
  '& .MuiSelect-icon': { color: FIN_MUTED },
  '& .MuiAutocomplete-endAdornment .MuiSvgIcon-root': { color: FIN_MUTED },
} as const

export const finPaperSx = {
  bgcolor: FIN_SURFACE,
  borderColor: FIN_BORDER,
  color: FIN_TEXT,
  '--ga-surface': FIN_SURFACE_ALT,
  '--ga-text-muted': FIN_MUTED,
  '--ga-border': FIN_BORDER,
  '& .MuiTableCell-root': {
    borderColor: 'rgba(15, 23, 42, 0.08)',
    color: FIN_TEXT,
  },
  '& .MuiTableHead-root .MuiTableCell-head, & .MuiTableCell-head, & .MuiTableCell-stickyHeader': {
    bgcolor: `${FIN_SURFACE_ALT} !important`,
    backgroundColor: `${FIN_SURFACE_ALT} !important`,
    color: `${FIN_MUTED} !important`,
    fontWeight: 650,
    backgroundImage: 'none',
  },
  '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
    color: FIN_MUTED,
  },
  '& .MuiTablePagination-selectIcon': { color: FIN_MUTED },
  '& .MuiIconButton-root': { color: FIN_MUTED },
  '& .MuiTableRow-root.Mui-selected': {
    bgcolor: 'rgba(27, 110, 243, 0.1) !important',
  },
  '& .MuiTableRow-hover:hover': {
    bgcolor: 'rgba(15, 23, 42, 0.03)',
  },
} as const

export const finPageSx = {
  flex: 1,
  height: '100%',
  minHeight: 0,
  bgcolor: FIN_BG,
  color: FIN_TEXT,
  boxSizing: 'border-box' as const,
  '--ga-surface': FIN_SURFACE,
  '--ga-canvas': FIN_BG,
  '--ga-canvas-alt': FIN_SURFACE_ALT,
  '--ga-picker-paper': FIN_SURFACE,
  '--ga-border': FIN_BORDER,
  '--ga-text-primary': FIN_TEXT,
  '--ga-text-secondary': FIN_MUTED,
  '--ga-text-muted': FIN_MUTED,
} as const

export const finBtnContainedSx = {
  color: '#fff',
  bgcolor: '#1B6EF3',
  boxShadow: 'none',
  '&:hover': { bgcolor: '#0D4ECC', boxShadow: 'none' },
  '&.Mui-disabled': { color: 'rgba(255,255,255,0.85)', opacity: 0.5, bgcolor: '#1B6EF3' },
} as const

export const finBtnOutlinedSx = {
  color: FIN_TEXT,
  borderColor: FIN_BORDER,
  '&:hover': { borderColor: '#1B6EF3', bgcolor: 'rgba(27,110,243,0.06)' },
  '&.Mui-disabled': {
    color: 'rgba(15, 23, 42, 0.35)',
    borderColor: 'rgba(15, 23, 42, 0.12)',
    opacity: 1,
  },
} as const

/** Borda vermelha nos campos obrigatórios com falha de validação. */
export const finCampoErroSx = {
  '& .MuiOutlinedInput-root fieldset, & .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
    borderColor: '#EF4444 !important',
  },
  '& .MuiOutlinedInput-root:hover fieldset, & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#F87171 !important',
  },
  '& .MuiOutlinedInput-root.Mui-focused fieldset, & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#EF4444 !important',
  },
  '& .MuiInputLabel-root, & .MuiInputLabel-root.Mui-focused': {
    color: '#DC2626 !important',
  },
} as const

export const finChipSx = (ativo: boolean) => ({
  height: 24,
  fontSize: 11,
  bgcolor: ativo ? 'rgba(27, 110, 243, 0.1)' : FIN_SURFACE,
  borderColor: ativo ? '#1B6EF3' : FIN_BORDER,
  color: ativo ? '#0D4ECC' : FIN_MUTED,
  fontWeight: ativo ? 600 : 500,
  '&.Mui-focusVisible, &:focus': {
    bgcolor: ativo ? 'rgba(27, 110, 243, 0.1)' : FIN_SURFACE,
    borderColor: ativo ? '#1B6EF3' : FIN_BORDER,
  },
})

export const finCalendarioWrapSx = {
  width: { xs: '100%', md: 240 },
  flexShrink: 0,
  '& > .MuiBox-root': { width: '100%', minWidth: 0, maxWidth: 'none' },
  '& .MuiTextField-root': { width: '100% !important' },
  '& .MuiOutlinedInput-root': {
    bgcolor: FIN_SURFACE,
    color: FIN_TEXT,
    minHeight: `${FIN_CAMPO_H}px !important`,
    height: `${FIN_CAMPO_H}px !important`,
    borderRadius: `${FIN_CAMPO_RADIUS} !important`,
    overflow: 'hidden',
    '& fieldset, & .MuiOutlinedInput-notchedOutline': {
      borderColor: FIN_BORDER,
      borderRadius: `${FIN_CAMPO_RADIUS} !important`,
    },
    '&:hover fieldset, &:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(15, 23, 42, 0.28)',
    },
  },
  '& .MuiInputBase-input': {
    color: `${FIN_TEXT} !important`,
    fontSize: '0.875rem !important',
    py: '0 !important',
    height: `${FIN_CAMPO_H}px !important`,
    boxSizing: 'border-box',
  },
  '& .MuiInputLabel-root': { color: FIN_MUTED, fontSize: '0.875rem' },
  '& .MuiIconButton-root': { color: FIN_MUTED },
} as const
