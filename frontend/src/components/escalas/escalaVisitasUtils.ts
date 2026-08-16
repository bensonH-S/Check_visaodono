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

/** Próxima segunda-feira — semana que o time monta na escala. */
export function segundaFeiraSubsequente() {
  return addDaysIso(segundaFeiraAtual(), 7);
}

export function fmtDataCurta(iso: string) {
  const [, m, dd] = iso.split('-');
  return `${dd}/${m}`;
}

export function fmtEnvioQuando(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

export type GrupoRegionaisEscala<T extends { grupo_nome?: string | null }> = {
  nome: string | null;
  items: T[];
};

/** Agrupa regionais já ordenados para legenda e seletor da escala. */
export function agruparRegionaisEscala<T extends { grupo_nome?: string | null }>(
  regionais: T[],
): GrupoRegionaisEscala<T>[] {
  const grupos: GrupoRegionaisEscala<T>[] = [];
  for (const regional of regionais) {
    const nome = regional.grupo_nome ?? null;
    const ultimo = grupos[grupos.length - 1];
    if (!ultimo || ultimo.nome !== nome) {
      grupos.push({ nome, items: [regional] });
    } else {
      ultimo.items.push(regional);
    }
  }
  return grupos;
}
