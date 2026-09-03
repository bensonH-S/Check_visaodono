/** Design system — neutro primeiro, marca nos acertos certos */
export const colors = {
  navy: 'var(--ga-navy)',
  navyDark: 'var(--ga-navy-dark)',
  navyMuted: 'var(--ga-navy-muted)',
  navyBorder: 'var(--ga-navy-border)',
  orange: 'var(--ga-orange)',
  orangeHover: 'var(--ga-orange-hover)',
  orangeLight: 'var(--ga-orange-light)',
  surface: 'var(--ga-surface)',
  canvas: 'var(--ga-canvas)',
  canvasAlt: 'var(--ga-canvas-alt)',
  border: 'var(--ga-border)',
  borderStrong: 'var(--ga-border-strong)',
  textPrimary: 'var(--ga-text-primary)',
  textSecondary: 'var(--ga-text-secondary)',
  textMuted: 'var(--ga-text-muted)',
  sidebarBg: 'var(--ga-sidebar-bg)',
  sidebarBorder: 'var(--ga-sidebar-border)',
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
