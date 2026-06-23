const TZ_BR = 'America/Sao_Paulo';

const RE_SO_DATA = /^(\d{4})-(\d{2})-(\d{2})/;

function temFusoHorario(s: string): boolean {
  return /Z$/i.test(s) || /[+-]\d{2}(:\d{2})?$/.test(s);
}

/** Data civil de hoje em Brasília (YYYY-MM-DD). */
export function dataHojeBrasilia(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ_BR });
}

/** Normaliza data_visita da API para YYYY-MM-DD. */
export function normalizarDataVisita(val: string | null | undefined): string | null {
  if (val == null || val === '') return null;
  const s = String(val).trim();
  const m = RE_SO_DATA.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Formata colunas DATE da API (ex.: data_visita) sem deslocar o dia por fuso.
 * PostgreSQL DATE costuma vir como "YYYY-MM-DD" ou ISO em UTC meia-noite.
 */
export function formatDataCampoData(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '—';
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  const s = String(value).trim();
  if (!s) return '—';

  const m = RE_SO_DATA.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  return '—';
}

/** Converte timestamps da API para Date. Assume UTC quando não há fuso. */
export function parseDataApi(value: string | Date | null | undefined): Date {
  if (value == null || value === '') return new Date(NaN);
  if (value instanceof Date) return value;

  const s = String(value).trim();
  if (!s) return new Date(NaN);

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }

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
  if (value == null || value === '') return '—';
  const s = typeof value === 'string' ? value.trim() : '';
  if (s && RE_SO_DATA.test(s)) return formatDataCampoData(s);
  return formatDataBrasilia(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDataHoraVisita(
  data: string | null | undefined,
  hora: string | null | undefined,
): string {
  const dataFmt = formatDataCampoData(data);
  if (dataFmt === '—') return '—';
  if (!hora) return dataFmt;
  const hm = hora.trim().slice(0, 5);
  return `${dataFmt} às ${hm}`;
}

/** Duração em minutos entre hora_inicio e agora (Brasília). */
export function calcularDuracaoVisitaMinutos(
  dataVisita: string | null | undefined,
  horaInicio: string | null | undefined,
): number | undefined {
  if (!horaInicio?.trim()) return undefined;
  const dataBase = normalizarDataVisita(dataVisita) ?? dataHojeBrasilia();
  const [y, m, d] = dataBase.split('-').map(Number);
  const parts = horaInicio.trim().split(':').map(Number);
  const h = parts[0] ?? 0;
  const min = parts[1] ?? 0;
  const sec = parts[2] ?? 0;
  const inicio = new Date(y, m - 1, d, h, min, sec);
  const agoraStr = new Date().toLocaleString('en-US', { timeZone: TZ_BR });
  const fim = new Date(agoraStr);
  const diff = Math.round((fim.getTime() - inicio.getTime()) / 60000);
  if (diff < 1) return 1;
  if (diff > 24 * 60) return undefined;
  return diff;
}
