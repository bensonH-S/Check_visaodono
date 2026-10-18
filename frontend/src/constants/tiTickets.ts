export const TI_TICKET_CATEGORIAS = [
  { value: 'geral', label: 'Geral', slaMinutos: 72 * 60 },
  { value: 'tecnologia', label: 'Tecnologia', slaMinutos: 24 * 60 },
  { value: 'financeiro', label: 'Financeiro', slaMinutos: 30 },
  { value: 'frota', label: 'Frota', slaMinutos: 24 * 60 },
  { value: 'operacoes', label: 'Operações', slaMinutos: 24 * 60 },
  { value: 'vendas', label: 'Vendas', slaMinutos: 30 },
  { value: 'estoque', label: 'Estoque', slaMinutos: 30 },
  { value: 'manutencao', label: 'Manutenção', slaMinutos: 24 * 60 },
  { value: 'rh', label: 'Recursos Humanos', slaMinutos: 6 * 60 },
] as const;

export function categoriaTicket(value: string) {
  return TI_TICKET_CATEGORIAS.find((categoria) => categoria.value === value) || TI_TICKET_CATEGORIAS[0];
}

/** Ex.: "30 minutos", "6 horas", "72 horas" */
export function formatarSlaDuracao(minutos: number) {
  const m = Math.max(0, Math.round(Number(minutos) || 0));
  if (m < 60) return `${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.round(m / 60);
  if (m % 60 === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  return `${horas}h ${resto}min`;
}

export function textoAlertaSla(categoria: string) {
  const cat = categoriaTicket(categoria);
  return `Prazo de resposta: ${formatarSlaDuracao(cat.slaMinutos)}.`;
}

/** ISO datetime do prazo de resposta a partir da abertura. */
export function calcularPrazoSlaTicket(categoria: string, dataBase: Date | string = new Date()) {
  const config = categoriaTicket(categoria);
  const data = new Date(dataBase);
  if (Number.isNaN(data.getTime())) return new Date().toISOString();
  data.setMinutes(data.getMinutes() + config.slaMinutos);
  return data.toISOString();
}

export function parsePrazoTicket(prazo: string | null | undefined): Date | null {
  if (!prazo) return null;
  const raw = String(prazo).trim();
  if (!raw) return null;
  // date-only legado
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T23:59:59`);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Valor para input datetime-local (fuso local). */
export function prazoParaInputLocal(prazo: string | null | undefined) {
  const d = parsePrazoTicket(prazo);
  if (!d) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function inputLocalParaPrazoIso(valor: string) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Texto vivo do countdown: "Faltam 2h 15min" / "Atrasado 40 min". */
export function textoPrazoRestante(prazo: string | null | undefined, agora = new Date()) {
  const d = parsePrazoTicket(prazo);
  if (!d) return null;
  const diffMs = d.getTime() - agora.getTime();
  const absMin = Math.round(Math.abs(diffMs) / 60000);
  const fmt = (mins: number) => {
    if (mins < 60) return `${mins} ${mins === 1 ? 'min' : 'min'}`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };
  if (diffMs >= 0) return { atrasado: false, label: `Faltam ${fmt(absMin)}`, minutos: absMin };
  return { atrasado: true, label: `Atrasado ${fmt(absMin)}`, minutos: absMin };
}
