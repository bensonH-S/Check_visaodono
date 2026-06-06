const TZ_BR = 'America/Sao_Paulo';

function temFusoHorario(s: string): boolean {
  return /Z$/i.test(s) || /[+-]\d{2}(:\d{2})?$/.test(s);
}

/** Converte timestamps da API para Date. Assume UTC quando não há fuso. */
export function parseDataApi(value: string | Date | null | undefined): Date {
  if (value == null || value === '') return new Date(NaN);
  if (value instanceof Date) return value;

  const s = String(value).trim();
  if (!s) return new Date(NaN);

  if (temFusoHorario(s)) {
    return new Date(s);
  }

  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso)) {
    return new Date(`${iso}Z`);
  }

  return new Date(s);
}

export function formatDataBrasilia(
  value: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  const d = parseDataApi(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    timeZone: TZ_BR,
    ...opts,
  });
}

export function formatDataHoraBrasilia(value: string | Date | null | undefined): string {
  return formatDataBrasilia(value, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDataSomenteData(value: string | Date | null | undefined): string {
  return formatDataBrasilia(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
