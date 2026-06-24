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
  height: '100%',
  minHeight: '-webkit-fill-available',
} as const;

/** Barra de abas fixa no rodapé — fundo branco até a borda (iPhone / safe area). */
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

/** Ícones alinhados embaixo, ocupando também a área do gesto (home indicator). */
export function mobileTabBarNavSx(tabHeightPx: number) {
  return {
    display: 'flex',
    alignItems: 'stretch',
    minHeight: `calc(${tabHeightPx}px + env(safe-area-inset-bottom, 0px))`,
    boxSizing: 'border-box' as const,
  } as const;
}

export function mobileTabBarItemSx(tabHeightPx: number) {
  return {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    pt: 0.5,
    pb: 'max(6px, env(safe-area-inset-bottom, 0px))',
    minHeight: `calc(${tabHeightPx}px + env(safe-area-inset-bottom, 0px))`,
    boxSizing: 'border-box' as const,
  };
}
