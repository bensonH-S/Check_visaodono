export const DIAS_ABREV = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const;
export const DIAS_LONGO = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'] as const;

export function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function segundaFeiraAtual() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function fmtDataCurta(iso: string) {
  const [, m, dd] = iso.split('-');
  return `${dd}/${m}`;
}

export function diaIndexNaSemana(semanaInicio: string, iso = new Date().toISOString().slice(0, 10)) {
  for (let i = 0; i < 7; i += 1) {
    if (addDaysIso(semanaInicio, i) === iso) return i;
  }
  return null;
}

export function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] || nome;
}
