import { useCallback, useEffect, useState } from 'react';
import { api, type EstoqueContagemRedeItem } from '../../../api/client';
import {
  api as financeApi,
  emCache,
  urlDespesas,
  type Despesa,
  type ResumoFinanceiro,
} from '../../../financeiro/api';
import { dataHojeBrasilia } from '../../../utils/dateBr';

export type ItemZerado = { id_loja: number; loja: string; codigo: string };

export type CcData = {
  fin: ResumoFinanceiro | null;
  despesas: Despesa[];
  contagem: EstoqueContagemRedeItem[];
  zerados: ItemZerado[];
  baixa: number;
  valorEstoque: number | null;
  /** true só enquanto despesas ainda não chegaram (e não há cache). */
  loading: boolean;
  loadingContagem: boolean;
  erroFin: string;
  erroContagem: string;
  erroEstoque: string;
  recarregar: () => void;
};

type ContagemCache = { chave: string; lojas: EstoqueContagemRedeItem[]; em: number };

const CONTAGEM_TTL_MS = 45_000;
const SS_KEY = 'cc.contagem.diaria.v1';

let contagemMemoria: ContagemCache | null = null;
const contagemVoo = new Map<string, Promise<EstoqueContagemRedeItem[]>>();

function dataContagemNorm(data?: string) {
  const d = String(data || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dataHojeBrasilia();
}

function chaveContagem(data?: string) {
  return `diaria|${dataContagemNorm(data)}`;
}

function lerSession(): ContagemCache | null {
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContagemCache;
    if (!parsed?.chave || !Array.isArray(parsed.lojas) || !parsed.em) return null;
    return parsed;
  } catch {
    return null;
  }
}

function gravarSession(cache: ContagemCache) {
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(cache));
  } catch {
    /* quota / private mode */
  }
}

function hidratarMemoria() {
  if (contagemMemoria) return;
  const ss = lerSession();
  if (ss) contagemMemoria = ss;
}

hidratarMemoria();

function guardarContagem(ck: string, lojas: EstoqueContagemRedeItem[]) {
  const cache: ContagemCache = { chave: ck, lojas, em: Date.now() };
  contagemMemoria = cache;
  gravarSession(cache);
}

function cacheContagemFresca(data?: string) {
  hidratarMemoria();
  const ck = chaveContagem(data);
  if (!contagemMemoria || contagemMemoria.chave !== ck) return null;
  if (Date.now() - contagemMemoria.em > CONTAGEM_TTL_MS) return null;
  return contagemMemoria.lojas;
}

function cacheContagemQualquer(data?: string) {
  hidratarMemoria();
  const ck = chaveContagem(data);
  if (!contagemMemoria || contagemMemoria.chave !== ck) return null;
  return contagemMemoria.lojas;
}

function pedirContagem(data?: string, { forcar = false } = {}) {
  const dia = dataContagemNorm(data);
  const ck = chaveContagem(dia);
  if (!forcar) {
    const fresco = cacheContagemFresca(dia);
    if (fresco) return Promise.resolve(fresco);
  }
  const voo = contagemVoo.get(ck);
  if (voo) return voo;
  const promessa = api
    .estoqueContagensRede({ tipo: 'diaria', data: dia, leve: true })
    .then((cont) => {
      const lojas = cont?.lojas ?? [];
      guardarContagem(ck, lojas);
      return lojas;
    })
    .finally(() => {
      if (contagemVoo.get(ck) === promessa) contagemVoo.delete(ck);
    });
  contagemVoo.set(ck, promessa);
  return promessa;
}

/** Prefetch da contagem (PortalLayout) — mesma fila/chave do hook. */
export function aquecerContagemCc(data?: string) {
  return pedirContagem(data).catch(() => undefined);
}

/** Só o que o Command Center usa: despesas (+ cache) e contagem — em paralelo, sem travar a UI. */
export function useCcData({ podeFinanceiro, data }: { podeFinanceiro: boolean; data?: string }): CcData {
  const urlDesp = urlDespesas();
  const cacheDesp = podeFinanceiro ? emCache<Despesa[]>(urlDesp) : undefined;
  const cacheCont = cacheContagemQualquer(data);

  const [despesas, setDespesas] = useState<Despesa[]>(() => (cacheDesp ?? []).filter((d) => !d.pendente_inbox));
  const [contagem, setContagem] = useState<EstoqueContagemRedeItem[]>(() => cacheCont ?? []);
  const [loading, setLoading] = useState(() => podeFinanceiro && !cacheDesp);
  /** Só skeleton se não há nada pra mostrar. */
  const [loadingContagem, setLoadingContagem] = useState(() => !cacheCont);
  const [erroFin, setErroFin] = useState('');
  const [erroContagem, setErroContagem] = useState('');
  const [tick, setTick] = useState(0);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancel = false;

    if (podeFinanceiro) {
      if (!emCache<Despesa[]>(urlDesp)) setLoading(true);
      financeApi
        .despesas()
        .then((lista) => {
          if (cancel) return;
          setDespesas(lista.filter((d) => !d.pendente_inbox));
          setErroFin('');
          setLoading(false);
        })
        .catch(() => {
          if (cancel) return;
          if (!emCache<Despesa[]>(urlDesp)) setDespesas([]);
          setErroFin('Financeiro indisponível');
          setLoading(false);
        });
    } else {
      setDespesas([]);
      setErroFin('Sem acesso ao financeiro');
      setLoading(false);
    }

    const stale = cacheContagemQualquer(data);
    const fresco = cacheContagemFresca(data);
    if (stale) {
      setContagem(stale);
      setLoadingContagem(false);
    } else {
      setLoadingContagem(true);
    }

    if (fresco && tick === 0) {
      return () => {
        cancel = true;
      };
    }

    pedirContagem(data, { forcar: tick > 0 })
      .then((lojas) => {
        if (cancel) return;
        setContagem(lojas);
        setErroContagem('');
        setLoadingContagem(false);
      })
      .catch(() => {
        if (cancel) return;
        if (!cacheContagemQualquer(data)) setContagem([]);
        setErroContagem('Sem acesso às contagens');
        setLoadingContagem(false);
      });

    return () => {
      cancel = true;
    };
  }, [podeFinanceiro, data, tick, urlDesp]);

  return {
    fin: null,
    despesas,
    contagem,
    zerados: [],
    baixa: 0,
    valorEstoque: null,
    loading,
    loadingContagem,
    erroFin,
    erroContagem,
    erroEstoque: '',
    recarregar,
  };
}
