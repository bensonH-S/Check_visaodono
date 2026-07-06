import type { MetasCelulaRealizado, MetasPainel } from '../../api/client';

/** Meta batida: apenas OK contabiliza; X não entra na soma. */
export function celulaMetaBatida(c: MetasCelulaRealizado): boolean {
  if (c.valor_texto === 'OK') return true;
  if (c.valor_texto === 'X') return false;
  return c.atingiu === true;
}

/** Soma dos pesos (valor R$) por loja — só indicadores com OK. */
export function calcValorMetaPorLoja(painel: MetasPainel, lojasRevReprovadas?: Set<number>): Map<number, number> {
  const map = new Map<number, number>();
  for (const loja of painel.lojas) map.set(loja.id_loja, 0);
  for (const ind of painel.indicadores) {
    const peso = Number(ind.peso) || 0;
    for (const c of ind.celulas) {
      if (lojasRevReprovadas?.has(c.id_loja)) continue;
      if (celulaMetaBatida(c)) {
        map.set(c.id_loja, (map.get(c.id_loja) ?? 0) + peso);
      }
    }
  }
  return map;
}

export function fmtMoedaMeta(valor: number): string {
  if (valor <= 0) return 'R$ —';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export interface MetasGrupoResumo {
  grupo: number;
  titulo: string;
  empresa: MetasPainel | null;
  gestor: MetasPainel | null;
}

function numeroGrupoPainel(painel: MetasPainel): number {
  const m = painel.codigo.match(/grupo\s*(\d+)/i);
  if (m) return Number(m[1]);
  const m2 = painel.titulo.match(/grupo\s*(\d+)/i);
  if (m2) return Number(m2[1]);
  return painel.ordem;
}

export function agruparPaineisResumo(paineis: MetasPainel[]): MetasGrupoResumo[] {
  const map = new Map<number, MetasGrupoResumo>();

  for (const painel of [...paineis].sort((a, b) => a.ordem - b.ordem)) {
    const grupo = numeroGrupoPainel(painel);
    const atual = map.get(grupo) ?? {
      grupo,
      titulo: `Grupo ${grupo}`,
      empresa: null,
      gestor: null,
    };
    if (painel.tipo === 'empresa') atual.empresa = painel;
    else if (painel.tipo === 'gestor') atual.gestor = painel;
    map.set(grupo, atual);
  }

  return [...map.values()].sort((a, b) => a.grupo - b.grupo);
}
