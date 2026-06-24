/** Insets para telas com borda curva, notch ou barra de gestos. */

export function safeAreaX(basePx = 16) {
  return {
    pl: `max(${basePx}px, env(safe-area-inset-left, 0px))`,
    pr: `max(${basePx}px, env(safe-area-inset-right, 0px))`,
  } as const;
}

export const SAFE_AREA_TOP = {
  pt: 'max(12px, env(safe-area-inset-top, 0px))',
} as const;

export const SAFE_AREA_BOTTOM = {
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
  minHeight: ['100dvh', '-webkit-fill-available'],
} as const;
