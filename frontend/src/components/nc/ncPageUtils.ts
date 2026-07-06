import type { NcItem } from '../../api/client';

export interface NcVisitaGrupo {
  id_visita: number;
  loja: string;
  data_visita: string;
  nota_final: number | null;
  itens: NcItem[];
  porArea: Array<{ area: string; itens: NcItem[] }>;
  resumoGeral: NcItem | null;
  abertas: number;
  criticas: number;
}

export function parseNcDescricao(descricao: string) {
  const m = descricao.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!m) return { codigo: null as string | null, texto: descricao, obs: null as string | null };
  const resto = m[2];
  const obsIdx = resto.search(/\s—\s*Obs\.:\s*/);
  if (obsIdx === -1) return { codigo: m[1], texto: resto.trim(), obs: null };
  return {
    codigo: m[1],
    texto: resto.slice(0, obsIdx).trim(),
    obs: resto.slice(obsIdx).replace(/^\s—\s*Obs\.:\s*/, '').trim() || null,
  };
}

const ORDEM_GRAVIDADE: Record<string, number> = { Crítica: 0, Moderada: 1, Baixa: 2 };

function ordenarItens(a: NcItem, b: NcItem) {
  const ga = ORDEM_GRAVIDADE[a.gravidade] ?? 9;
  const gb = ORDEM_GRAVIDADE[b.gravidade] ?? 9;
  if (ga !== gb) return ga - gb;
  const pa = parseNcDescricao(a.descricao);
  const pb = parseNcDescricao(b.descricao);
  return (pa.codigo || '').localeCompare(pb.codigo || '', undefined, { numeric: true });
}

export function agruparNcsPorVisita(itens: NcItem[]): NcVisitaGrupo[] {
  const map = new Map<number, NcItem[]>();
  for (const nc of itens) {
    if (nc.id_visita == null) continue;
    const lista = map.get(nc.id_visita) || [];
    lista.push(nc);
    map.set(nc.id_visita, lista);
  }

  const grupos: NcVisitaGrupo[] = [];
  for (const [id_visita, lista] of map) {
    const ref = lista[0];
    const porAreaMap = new Map<string, NcItem[]>();
    let resumoGeral: NcItem | null = null;

    for (const nc of lista) {
      if (nc.area === 'Resultado geral') {
        resumoGeral = nc;
        continue;
      }
      const area = nc.area || 'Outros';
      const areaLista = porAreaMap.get(area) || [];
      areaLista.push(nc);
      porAreaMap.set(area, areaLista);
    }

    const porArea = [...porAreaMap.entries()]
      .map(([area, areaItens]) => ({
        area,
        itens: [...areaItens].sort(ordenarItens),
      }))
      .sort((a, b) => {
        const critA = a.itens.some((i) => i.gravidade === 'Crítica');
        const critB = b.itens.some((i) => i.gravidade === 'Crítica');
        if (critA !== critB) return critA ? -1 : 1;
        return a.area.localeCompare(b.area, 'pt-BR');
      });

    const abertas = lista.filter((i) => i.status === 'Em aberto').length;
    const criticas = lista.filter(
      (i) => i.status === 'Em aberto' && i.gravidade === 'Crítica',
    ).length;

    grupos.push({
      id_visita,
      loja: ref.name,
      data_visita: ref.data_visita || ref.data_cadastro,
      nota_final: ref.nota_final != null ? Number(ref.nota_final) : null,
      itens: lista,
      porArea,
      resumoGeral,
      abertas,
      criticas,
    });
  }

  return grupos.sort((a, b) => {
    const da = a.data_visita || '';
    const db = b.data_visita || '';
    if (da !== db) return db.localeCompare(da);
    return b.id_visita - a.id_visita;
  });
}
