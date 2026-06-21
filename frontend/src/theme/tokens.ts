/** Design system — neutro primeiro, marca nos acertos certos */
export const colors = {
  navy: '#1B2A6B',
  navyDark: '#152056',
  navyMuted: 'rgba(27, 42, 107, 0.06)',
  navyBorder: 'rgba(27, 42, 107, 0.1)',
  orange: '#E8520A',
  orangeHover: '#CF4909',
  orangeLight: '#FFF7F3',
  surface: '#FFFFFF',
  canvas: '#F9FAFB',
  canvasAlt: '#F3F4F6',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  sidebarBg: '#FFFFFF',
  sidebarBorder: '#E5E7EB',
} as const;

/** Largura da sidebar desktop */
export const layout = {
  sidebarWidth: 220,
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
  card: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
  cardHover: '0 4px 12px rgba(0, 0, 0, 0.08)',
  login: '0 4px 24px rgba(0, 0, 0, 0.06)',
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
} as const;

export const portalPanelSx = {
  p: { xs: 2, sm: 2.5 },
  borderRadius: `${radius.lg}px`,
  border: '1px solid',
  borderColor: colors.border,
  bgcolor: colors.surface,
  boxShadow: shadows.sm,
} as const;

export const portalCardSx = {
  ...portalPanelSx,
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  '&:hover': {
    borderColor: colors.borderStrong,
    boxShadow: shadows.card,
  },
} as const;

export const portalIconBoxSx = {
  width: 40,
  height: 40,
  borderRadius: `${radius.md}px`,
  bgcolor: colors.canvasAlt,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  color: colors.textSecondary,
} as const;

export const sectionLabelSx = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  color: colors.textMuted,
  mb: 1.5,
};
