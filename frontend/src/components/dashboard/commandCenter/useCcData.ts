import { useCallback, useEffect, useState } from 'react';
import { api, type EstoqueContagemRedeItem } from '../../../api/client';
import { api as financeApi, type Despesa, type ResumoFinanceiro } from '../../../financeiro/api';

export type ItemZerado = { id_loja: number; loja: string; codigo: string };

export type CcData = {
  fin: ResumoFinanceiro | null;
  despesas: Despesa[];
  contagem: EstoqueContagemRedeItem[];
  zerados: ItemZerado[];
  baixa: number;
  valorEstoque: number | null;
  loading: boolean;
  erroFin: string;
  erroContagem: string;
  erroEstoque: string;
  recarregar: () => void;
};

/** Carrega tudo do Command Center de uma vez (sem requests duplicados por card). */
export function useCcData({ podeFinanceiro, data }: { podeFinanceiro: boolean; data?: string }): CcData {
  const [fin, setFin] = useState<ResumoFinanceiro | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [contagem, setContagem] = useState<EstoqueContagemRedeItem[]>([]);
  const [zerados, setZerados] = useState<ItemZerado[]>([]);
  const [baixa, setBaixa] = useState(0);
  const [valorEstoque, setValorEstoque] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroFin, setErroFin] = useState('');
  const [erroContagem, setErroContagem] = useState('');
  const [erroEstoque, setErroEstoque] = useState('');
  const [tick, setTick] = useState(0);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      podeFinanceiro ? financeApi.resumo().catch(() => null) : Promise.resolve(null),
      podeFinanceiro ? financeApi.despesas().catch(() => null) : Promise.resolve(null),
      api.estoqueContagensRede({ tipo: 'diaria', data }).catch(() => null),
      api.estoqueSaldosRedeBaixo().catch(() => null),
      api.estoqueSaudeBaixa({ escopo: 'rede' }).catch(() => null),
      api.estoqueSaldosRedeValor().catch(() => null),
    ]).then(([resumo, lista, cont, baixo, saude, valor]) => {
      if (cancel) return;
      setFin(resumo);
      setDespesas(lista ?? []);
      setErroFin(podeFinanceiro ? (resumo || lista ? '' : 'Financeiro indisponível') : 'Sem acesso ao financeiro');
      setContagem(cont?.lojas ?? []);
      setErroContagem(cont ? '' : 'Sem acesso às contagens');
      setZerados((baixo?.itens ?? []) as ItemZerado[]);
      setBaixa(saude?.problemas?.length ?? 0);
      setValorEstoque(valor?.valor_atual ?? null);
      setErroEstoque(baixo || saude || valor ? '' : 'Sem acesso ao estoque');
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [podeFinanceiro, data, tick]);

  return { fin, despesas, contagem, zerados, baixa, valorEstoque, loading, erroFin, erroContagem, erroEstoque, recarregar };
}
