import type { EstoqueItem } from '../../api/client';

/** Mesma sequência da planilha Terraço (e do app). */
const RANK_SECAO: { test: RegExp; rank: number }[] = [
  { test: /^CONGELADOS/i, rank: 1 },
  { test: /^RESFRIADOS/i, rank: 2 },
  { test: /^MOLHOS/i, rank: 3 },
  { test: /^SOBREMESA/i, rank: 4 },
  { test: /^EMBALAGENS/i, rank: 5 },
  { test: /^LIMPEZA/i, rank: 6 },
  { test: /^REFRIGERANTES/i, rank: 7 },
  { test: /^BRINDES/i, rank: 8 },
  { test: /^LAN/i, rank: 9 },
];

export function rankSecaoPlanilha(secao: string | null | undefined): number {
  const s = String(secao || '').trim();
  if (!s) return 99;
  const hit = RANK_SECAO.find((r) => r.test.test(s));
  return hit ? hit.rank : 99;
}

function numOrdem(v: number | null | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Ordena insumos como na planilha: faixa (CONGELADOS…), depois linha, depois nome. */
export function compararOrdemPlanilha(
  a: Pick<EstoqueItem, 'ordem_contagem' | 'secao_contagem' | 'descricao'>,
  b: Pick<EstoqueItem, 'ordem_contagem' | 'secao_contagem' | 'descricao'>,
): number {
  const ra = rankSecaoPlanilha(a.secao_contagem);
  const rb = rankSecaoPlanilha(b.secao_contagem);
  if (ra !== rb) return ra - rb;
  const oa = numOrdem(a.ordem_contagem);
  const ob = numOrdem(b.ordem_contagem);
  if (oa == null && ob != null) return 1;
  if (oa != null && ob == null) return -1;
  if (oa != null && ob != null && oa !== ob) return oa - ob;
  return String(a.descricao || '').localeCompare(String(b.descricao || ''), 'pt-BR');
}
