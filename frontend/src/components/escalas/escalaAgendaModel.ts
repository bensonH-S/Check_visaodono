import type { EscalaVisitasDia, EscalaVisitasLinha, EscalaVisitasRegional } from '../../api/client';
import { idsRegionaisDoDia } from './escalaVisitasModel';
import { primeiroNome } from './escalaVisitasUtils';

export type EscalaAgendaLoja = {
  id_loja: number;
  bk?: string | null;
  nome: string;
};

export type EscalaAgendaDia = {
  dia: number;
  lojas: EscalaAgendaLoja[];
};

export type EscalaAgendaPessoa = {
  id_usuario: number;
  nome: string;
  primeiroNome: string;
  cor: string;
  grupo_nome?: string | null;
  dias: EscalaAgendaDia[];
  total: number;
};

type DiaComIds = EscalaVisitasDia & { ids_regional_efetivo?: number[] };

type LinhaAgenda = Pick<EscalaVisitasLinha, 'id_loja' | 'nome' | 'bk_number' | 'tipo'> & {
  dias: DiaComIds[];
};

function idsDoDia(d: DiaComIds): number[] {
  if (d.ids_regional_efetivo) return d.ids_regional_efetivo.map(Number);
  return idsRegionaisDoDia(d).map(Number);
}

/** Monta a escala no eixo pessoa × dia — leitura natural da semana. */
export function montarAgendaPorPessoa({
  linhas,
  regionais,
  mapNome,
  mapCor,
  idUsuario = null,
}: {
  linhas: LinhaAgenda[];
  regionais: EscalaVisitasRegional[];
  mapNome: Map<number, string>;
  mapCor: Map<number, string>;
  idUsuario?: number | null;
}): EscalaAgendaPessoa[] {
  const porPessoa = new Map<number, Map<number, EscalaAgendaLoja[]>>();

  for (const linha of linhas) {
    if (linha.tipo === 'delivery') continue;
    for (const d of linha.dias) {
      for (const id of idsDoDia(d)) {
        let dias = porPessoa.get(id);
        if (!dias) {
          dias = new Map();
          porPessoa.set(id, dias);
        }
        const lojas = dias.get(d.dia) ?? [];
        if (!lojas.some((l) => l.id_loja === linha.id_loja)) {
          lojas.push({
            id_loja: linha.id_loja,
            bk: linha.bk_number,
            nome: linha.nome,
          });
        }
        dias.set(d.dia, lojas);
      }
    }
  }

  const idsOrdem: number[] = [];
  const visto = new Set<number>();
  for (const r of regionais) {
    const id = Number(r.id_usuario);
    if (visto.has(id)) continue;
    visto.add(id);
    idsOrdem.push(id);
  }
  for (const id of porPessoa.keys()) {
    if (visto.has(id)) continue;
    visto.add(id);
    idsOrdem.push(id);
  }

  const pessoas = idsOrdem.map((id) => {
    const regional = regionais.find((r) => Number(r.id_usuario) === id);
    const nome = regional?.nome || mapNome.get(id) || String(id);
    const dias: EscalaAgendaDia[] = Array.from({ length: 7 }, (_, dia) => ({
      dia,
      lojas: porPessoa.get(id)?.get(dia) ?? [],
    }));
    return {
      id_usuario: id,
      nome,
      primeiroNome: primeiroNome(nome),
      cor: regional?.cor || mapCor.get(id) || '#64748B',
      grupo_nome: regional?.grupo_nome ?? null,
      dias,
      total: dias.reduce((n, d) => n + d.lojas.length, 0),
    };
  });

  if (idUsuario != null) {
    return pessoas.filter((p) => Number(p.id_usuario) === Number(idUsuario));
  }
  return pessoas;
}

const CORES_TECNICOS = [
  '#1B2A6B',
  '#E8520A',
  '#0F766E',
  '#6D28D9',
  '#BE185D',
  '#0369A1',
  '#B45309',
  '#334155',
];

export function corTecnicoEscala(idUsuario: number, index = 0) {
  const id = Number(idUsuario);
  if (Number.isFinite(id) && id > 0) return CORES_TECNICOS[id % CORES_TECNICOS.length];
  return CORES_TECNICOS[index % CORES_TECNICOS.length];
}

type TecnicoAgenda = {
  id_usuario: number;
  nome: string;
  grupo?: string | null;
  nome_regiao?: string | null;
  cor?: string | null;
};

type LojaAgendaManut = {
  id_loja: number;
  nome: string;
  bk_number?: string | null;
};

/** Semana dos técnicos no mesmo eixo pessoa × dia da escala dos regionais. */
export function montarAgendaManutencao({
  tecnicos,
  lojas,
  visitas,
  pending,
  idTecnico = null,
}: {
  tecnicos: TecnicoAgenda[];
  lojas: LojaAgendaManut[];
  visitas: Array<{ id_usuario: number; dia: number; id_loja: number }>;
  pending?: Map<string, { id_usuario: number; dia: number; id_lojas: number[] }>;
  idTecnico?: number | null;
}): EscalaAgendaPessoa[] {
  const lojaPorId = new Map(lojas.map((l) => [Number(l.id_loja), l]));

  function idsLojas(idUsuario: number, dia: number) {
    const p = pending?.get(`${idUsuario}-${dia}`);
    if (p) return p.id_lojas.map(Number);
    return visitas
      .filter((v) => Number(v.id_usuario) === Number(idUsuario) && Number(v.dia) === Number(dia))
      .map((v) => Number(v.id_loja));
  }

  const lista = tecnicos.map((t, i) => {
    const dias: EscalaAgendaDia[] = Array.from({ length: 7 }, (_, dia) => ({
      dia,
      lojas: idsLojas(t.id_usuario, dia)
        .map((id) => {
          const loja = lojaPorId.get(id);
          if (!loja) return null;
          return { id_loja: id, bk: loja.bk_number, nome: loja.nome };
        })
        .filter((l): l is EscalaAgendaLoja => l != null),
    }));
    return {
      id_usuario: t.id_usuario,
      nome: t.nome,
      primeiroNome: primeiroNome(t.nome),
      cor: t.cor || corTecnicoEscala(t.id_usuario, i),
      grupo_nome: t.nome_regiao || t.grupo || null,
      dias,
      total: dias.reduce((n, d) => n + d.lojas.length, 0),
    };
  });

  if (idTecnico != null) {
    return lista.filter((p) => Number(p.id_usuario) === Number(idTecnico));
  }
  return lista.filter((p) => p.total > 0);
}
