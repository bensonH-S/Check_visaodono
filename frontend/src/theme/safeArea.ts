/** Insets para telas com borda curva, notch ou barra de gestos. */

export function safeAreaX(basePx = 16) {
  return {
    pl: `max(${basePx}px, env(safe-area-inset-left, 0px))`,
    pr: `max(${basePx}px, env(safe-area-inset-right, 0px))`,
  } as const;
}

/** Conteúdo abaixo do relógio/notch — fundo do header pode ir até o topo. */
export const SAFE_AREA_TOP = {
  pt: 'env(safe-area-inset-top, 0px)',
} as const;

/** Padding superior combinando safe area + espaço extra (evita sobrescrever pt depois do spread). */
export function safeAreaTopPadding(extraPx = 8) {
  return `calc(${extraPx}px + env(safe-area-inset-top, 0px))`;
}

export const SAFE_AREA_BOTTOM = {
  pb: 'env(safe-area-inset-bottom, 0px)',
} as const;

/** Padding inferior dentro de barra fixa (fundo da barra vai até a borda da tela). */
export const SAFE_AREA_BOTTOM_INSET = {
  pb: 'env(safe-area-inset-bottom, 0px)',
} as const;

export function safeAreaBottomCalc(basePx: number) {
  return `calc(${basePx}px + env(safe-area-inset-bottom, 0px))`;
}

export function safeAreaRightCalc(basePx: number) {
  return `calc(${basePx}px + env(safe-area-inset-right, 0px))`;
}

export function safeAreaLeftCalc(basePx: number) {
  return `calc(${basePx}px + env(safe-area-inset-left, 0px))`;
}

export const MOBILE_VIEWPORT = {
  width: '100%',
  height: ['100%', '100dvh'],
  minHeight: ['-webkit-fill-available', '100dvh'],
} as const;

export const MOBILE_PAGE_COLUMN = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  height: '100%',
  overflow: 'hidden',
} as const;

/** Área rolável dentro de página mobile (lista de cards, formulário, etc.). */
export const MOBILE_SCROLL_AREA = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
} as const;

/** Logo de fundo (marca d'água) — vmin escala com o menor lado da viewport (todos os telefones). */
export const MOBILE_WATERMARK_LOGO = {
  width: 'clamp(5.5rem, 32vmin, 12rem)',
  height: 'clamp(5.5rem, 32vmin, 12rem)',
} as const;

/** Mesma lógica da splash PWA (#pwa-splash em index.html) — referência para manter valores alinhados. */
export const MOBILE_SPLASH_LOGO = {
  width: 'clamp(3.25rem, 17vmin, 6.5rem)',
  height: 'clamp(3.25rem, 17vmin, 6.5rem)',
} as const;

/** Barra de abas fixa no rodapé — fundo branco até a borda física (iPhone / home indicator). */
export function mobileTabBarShellSx(bgcolor = '#fff', zIndex = 30) {
  return {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex,
    bgcolor,
    boxSizing: 'border-box' as const,
    borderTop: '1px solid rgba(27, 42, 107, 0.1)',
    ...safeAreaX(8),
    transform: 'translateZ(0)',
  };
}

/** Ícones alinhados embaixo; safe area fica abaixo dos ícones (home indicator). */
export function mobileTabBarNavSx(tabHeightPx: number) {
  return {
    display: 'flex',
    alignItems: 'flex-end',
    boxSizing: 'border-box' as const,
    pt: '6px',
    pb: 'max(4px, env(safe-area-inset-bottom, 0px))',
    minHeight: `calc(${tabHeightPx}px + 6px + env(safe-area-inset-bottom, 0px))`,
  } as const;
}

export function mobileTabBarItemSx(tabHeightPx: number) {
  return {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    height: `${tabHeightPx}px`,
    pb: 0.25,
    boxSizing: 'border-box' as const,
  };
}
