/** Rastreamento GPS dos técnicos — controlado por variável de ambiente. */
export function gpsTecnicosAtivo() {
  const v = String(process.env.GPS_TECNICOS_ENABLED ?? 'true').trim().toLowerCase();
  return v !== 'false' && v !== '0' && v !== 'off' && v !== 'no';
}

export function gpsTecnicosIntervaloMs() {
  const n = Number(process.env.GPS_TECNICOS_INTERVAL_MS);
  if (Number.isFinite(n) && n >= 30_000) return Math.round(n);
  return 120_000;
}

export function gpsTecnicosConfigPublica() {
  return {
    gpsTecnicosEnabled: gpsTecnicosAtivo(),
    gpsTecnicosIntervalMs: gpsTecnicosIntervaloMs(),
  };
}
