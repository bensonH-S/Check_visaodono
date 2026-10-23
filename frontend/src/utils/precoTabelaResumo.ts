import type { EstoquePedidoTabela } from '../api/client';

export type PrecoTabelaItemAgrupado = {
  codigo: string;
  descricao: string;
  unidade: string;
  preco_tabela: number | null;
  preco_medio_cobrado: number;
  quantidade: number;
  valor_acima: number;
  pedidos: number;
  lojas: number;
};

export type FreteAgrupado = {
  pedidos_com_nf: number;
  valor: number;
  valor_nf: number;
  peso_kg: number;
  pct_nf: number | null;
  por_kg: number | null;
};

export type PrecoTabelaLojaAgrupada = {
  id_loja: number;
  loja: string;
  tabela: string | null;
  pedidos: number;
  pedidos_acima: number;
  valor_pedidos: number;
  acima: number;
  itens_comparados: number;
  valor_acima: number;
  frete: FreteAgrupado;
};

export type PrecoTabelaResumo = {
  pedidos: number;
  pedidos_acima: number;
  valor_pedidos: number;
  itens_comparados: number;
  acima: number;
  valor_acima: number;
  conferir_unidade: number;
  frete: FreteAgrupado;
  tabelas: string[];
  por_loja: PrecoTabelaLojaAgrupada[];
  por_item: PrecoTabelaItemAgrupado[];
};

export function nomeLojaCurto(nome: string | null | undefined) {
  return String(nome || '').replace(/^BURGER KING\s*-\s*/i, '').trim() || String(nome || '');
}

const freteVazio = (): FreteAgrupado => ({ pedidos_com_nf: 0, valor: 0, valor_nf: 0, peso_kg: 0, pct_nf: null, por_kg: null });

function somarFrete(f: FreteAgrupado, p: EstoquePedidoTabela) {
  if (!p.frete) return;
  f.pedidos_com_nf += 1;
  f.valor += p.frete.valor;
  f.valor_nf += p.frete.valor_nf;
  f.peso_kg += p.frete.peso_kg;
  f.pct_nf = f.valor_nf > 0 ? f.valor / f.valor_nf : null;
  f.por_kg = f.peso_kg > 0 ? f.valor / f.peso_kg : null;
}

/** Totais, ranking de lojas e itens que mais pesaram a partir dos pedidos. */
export function resumirPedidosTabela(pedidos: EstoquePedidoTabela[]): PrecoTabelaResumo {
  const r: PrecoTabelaResumo = {
    pedidos: 0, pedidos_acima: 0, valor_pedidos: 0, itens_comparados: 0, acima: 0, valor_acima: 0,
    conferir_unidade: 0, frete: freteVazio(), tabelas: [], por_loja: [], por_item: [],
  };
  const tabelas = new Set<string>();
  const lojas = new Map<number, PrecoTabelaLojaAgrupada>();
  const itens = new Map<string, PrecoTabelaItemAgrupado & { cobrado: number; idsLoja: Set<number> }>();
  for (const p of pedidos) {
    const l = lojas.get(p.id_loja) || {
      id_loja: p.id_loja, loja: nomeLojaCurto(p.loja), tabela: p.tabela || null, pedidos: 0, pedidos_acima: 0,
      valor_pedidos: 0, acima: 0, itens_comparados: 0, valor_acima: 0, frete: freteVazio(),
    };
    if (p.tabela) tabelas.add(p.tabela);
    l.pedidos += 1;
    l.valor_pedidos += p.valor_total;
    l.valor_acima += p.preco.valor_acima;
    l.acima += p.preco.acima;
    if (p.preco.acima) l.pedidos_acima += 1;
    somarFrete(l.frete, p);
    somarFrete(r.frete, p);
    r.pedidos += 1;
    r.valor_pedidos += p.valor_total;
    r.valor_acima += p.preco.valor_acima;
    r.acima += p.preco.acima;
    if (p.preco.acima) r.pedidos_acima += 1;
    for (const it of p.itens) {
      if (it.situacao_preco !== 'sem_tabela') {
        r.itens_comparados += 1;
        l.itens_comparados += 1;
      }
      if (it.situacao_preco === 'conferir_unidade') r.conferir_unidade += 1;
      if (it.situacao_preco !== 'acima') continue;
      const cod = String(it.codigo).replace(/^0+/, '');
      const g = itens.get(cod) || {
        codigo: it.codigo, descricao: it.descricao, unidade: it.unidade, preco_tabela: it.preco_tabela,
        preco_medio_cobrado: 0, quantidade: 0, valor_acima: 0, pedidos: 0, lojas: 0, cobrado: 0, idsLoja: new Set<number>(),
      };
      if (g.preco_tabela !== it.preco_tabela) g.preco_tabela = null;
      g.quantidade += it.quantidade;
      g.cobrado += it.valor_unitario * it.quantidade;
      g.valor_acima += it.diferenca_total || 0;
      g.pedidos += 1;
      g.idsLoja.add(p.id_loja);
      itens.set(cod, g);
    }
    lojas.set(p.id_loja, l);
  }
  r.tabelas = [...tabelas].sort();
  r.por_loja = [...lojas.values()].sort((a, b) => b.valor_acima - a.valor_acima);
  r.por_item = [...itens.values()]
    .map(({ cobrado, idsLoja, ...g }) => ({
      ...g,
      preco_medio_cobrado: g.quantidade ? cobrado / g.quantidade : 0,
      lojas: idsLoja.size,
    }))
    .sort((a, b) => b.valor_acima - a.valor_acima);
  return r;
}
