/**
 * Command Center tokens.
 * Cores de superfície/texto seguem o tema do app via CSS vars.
 * Em `.cc-page` (dark) o CSS força a paleta preta da marca; no claro herda `:root`.
 */
export const CC_BG = 'var(--ga-canvas)';
export const CC_SIDEBAR = 'var(--ga-sidebar-bg)';
export const CC_SURFACE = 'var(--ga-surface)';
export const CC_SURFACE_2 = 'var(--ga-canvas-alt)';
export const CC_BORDER = 'var(--ga-border)';
export const CC_TEXT = 'var(--ga-text-primary)';
export const CC_TEXT_2 = 'var(--ga-text-secondary)';
export const CC_MUTED = 'var(--ga-text-muted)';
/** Accent geral do CC (azul via CSS em .cc-page). */
export const CC_ORANGE = 'var(--ga-orange)';
export const CC_ORANGE_HOVER = 'var(--ga-orange-hover)';
/** Laranja da marca — estoque, ranking e performance. */
export const CC_BRAND_ORANGE = '#E8520A';
export const CC_BRAND_ORANGE_SOFT = 'rgba(232, 82, 10, 0.14)';
/** Tijolo para críticos. */
export const CC_CRITICO = '#C4452D';
/** Oliva fechada. Verde lima briga com a marca. */
export const CC_OK = '#7D9270';
/** Âmbar derivado do laranja. */
export const CC_WARN = '#C47A2A';
export const CC_INFO = '#8A8580';
export const CC_PARADO = 'var(--ga-text-muted)';
export const CC_EXCESSO = '#C4452D';
export const CC_RADIUS = 10;
export const CC_GAP = 2;
export const CC_MIDDLE_H = 420;
export const CC_BOTTOM_H = 200;

/** Estilo compartilhado dos tooltips Recharts no Command Center. */
export const CC_TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--ga-surface)',
    border: '1px solid var(--ga-border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--ga-text-primary)',
  },
  labelStyle: { color: 'var(--ga-text-primary)' },
  itemStyle: { color: 'var(--ga-text-primary)' },
} as const;
