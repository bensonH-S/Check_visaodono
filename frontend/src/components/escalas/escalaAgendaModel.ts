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
