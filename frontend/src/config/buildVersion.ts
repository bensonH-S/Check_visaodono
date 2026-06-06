declare const __BUILD_VERSION__: string;

/** Versão gravada no build a partir da tag Git (scripts/write-version.js). */
export function buildVersion(): string {
  return typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev';
}
