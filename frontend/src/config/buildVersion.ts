declare const __BUILD_VERSION__: string;
declare const __BUILD_ID__: string;

/** Versão gravada no build a partir da tag Git (scripts/write-version.js). */
export function buildVersion(): string {
  return typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev';
}

/** Identificador único do build (commit Git) — muda a cada deploy. */
export function buildId(): string {
  return typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
}
