export const TZ_SP = 'America/Sao_Paulo';

const WEEKDAY_US = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function dataHojeSp(agora = new Date()) {
  return agora.toLocaleDateString('en-CA', { timeZone: TZ_SP });
}

export function horaMinutoSp(agora = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ_SP,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(agora);
  const hora = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minuto = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return {
    hora,
    minuto,
    hhmm: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`,
  };
}

export function weekdaySp(agora = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: TZ_SP, weekday: 'short' }).format(agora);
  return WEEKDAY_US[wd] ?? 0;
}

export function parseHora(valor) {
  const s = String(valor || '00:00').slice(0, 5);
  const [hRaw, mRaw] = s.split(':');
  const hora = Number(hRaw);
  const minuto = Number(mRaw);
  return {
    hora: Number.isFinite(hora) ? hora : 0,
    minuto: Number.isFinite(minuto) ? minuto : 0,
  };
}

export function minutosDoDia({ hora = 0, minuto = 0 } = {}) {
  return Number(hora) * 60 + Number(minuto);
}

export function dentroJanela(config, agora = new Date()) {
  const dias = Array.isArray(config?.dias_ativos) && config.dias_ativos.length
    ? config.dias_ativos.map(Number)
    : [1, 2, 3, 4, 5, 6];
  if (!dias.includes(weekdaySp(agora))) return false;
  const agoraM = minutosDoDia(horaMinutoSp(agora));
  const ini = minutosDoDia(parseHora(config?.horario_inicio || '07:00'));
  const fim = minutosDoDia(parseHora(config?.horario_fim || '22:00'));
  return agoraM >= ini && agoraM <= fim;
}

export function jaPassouHora(horaConfig, agora = new Date()) {
  return minutosDoDia(horaMinutoSp(agora)) >= minutosDoDia(parseHora(horaConfig));
}

export function segundaFeiraDaSemanaSp(agora = new Date()) {
  const iso = dataHojeSp(agora);
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
