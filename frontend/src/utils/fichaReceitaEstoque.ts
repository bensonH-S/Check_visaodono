/**
 * Converte quantidade da receita de produção → unidade de estoque/compra.
 * Espelha backend/src/services/fichaReceitaEstoque.js
 */

const G_POR_FATIA: Record<string, number> = {
  queijo: 11,
  tomate: 25,
  picles: 6,
  bacon: 9,
  jalapeno: 4,
  default: 10,
};

const G_CONCHA = 14;
const G_VOLTA = 4;

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function descNorm(s: unknown): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export type InsumoConversao = {
  descricao?: string | null;
  und_convertida?: number | string | null;
  valor_unidade?: number | string | null;
};

/** Heurística: estoque em kg (granel) vs peça. */
export function estoqueEmKg(insumo: InsumoConversao | null | undefined): boolean {
  const d = descNorm(insumo?.descricao);
  const und = num(insumo?.und_convertida, 1);

  // Descartáveis / embalagens unitárias — sempre peça (mesmo com "SORVETE" no nome)
  if (
    /GUARDANAPO|COLHER|CANUDO|PAZINHA|TAMPA|SACHET|EMBALAGEM|PORTA COPO|PAPEL|COPO |COPO\b|CASQUINHA|CONE |CONE\b|BALDE PAPEL|BLISTER/.test(
      d,
    )
  ) {
    return false;
  }

  if (
    /\bKG\b|\bG\b|GRANEL|BAG|MOLHO|MAIONESE|KETCHUP|MOSTARDA|ALFACE|CEBOLA|TOMATE|CARNE|QUEIJO|BACON|PEPINO|BATATA|ONION|FRALDINHA|CALDA|BEBIDA LACT|NUTELLA|OVOMALT|CRUMBLE|BROWNIE|LEITE EM PO/.test(
      d,
    )
  ) {
    if (/PAO|PATTY|CAIXA THE KINGS/.test(d) && !/GRANEL|BAG|CX \d+X\d+KG|CX\d+X\d+KG/.test(d)) {
      return false;
    }
    if (/PAO |PAO\b/.test(d)) return false;
    return true;
  }
  if (und > 1 && !Number.isInteger(und)) return true;
  return false;
}

function gramasFatia(descricaoInsumo: string | null | undefined): number {
  const d = descNorm(descricaoInsumo);
  if (/QUEIJO|CHEDDAR|MUSSARELA/.test(d)) return G_POR_FATIA.queijo;
  if (/TOMATE/.test(d)) return G_POR_FATIA.tomate;
  if (/PEPINO|PICLES|PICKLE/.test(d)) return G_POR_FATIA.picles;
  if (/BACON/.test(d)) return G_POR_FATIA.bacon;
  if (/JALAPENO|JALAPEÑO/.test(d)) return G_POR_FATIA.jalapeno;
  return G_POR_FATIA.default;
}

export function qtdeReceitaParaEstoque(
  quantidadeReceita: number,
  unidadeReceita: string,
  insumo: InsumoConversao = {},
): number {
  const q = num(quantidadeReceita);
  if (q <= 0) return 0;
  const u = String(unidadeReceita || 'und').trim().toLowerCase();

  let gramas: number | null = null;
  if (u === 'g') gramas = q;
  else if (u === 'kg') return q;
  else if (u === 'concha') gramas = q * G_CONCHA;
  else if (u === 'volta') {
    const d = descNorm(insumo.descricao);
    if (/LACTEA|SORVETE|POLENGHI|OUROLAC|SOFT|MIX DE SORVETE|BEBIDA LACT/.test(d)) {
      gramas = q * 40;
    } else {
      gramas = q * G_VOLTA;
    }
  } else if (u === 'fatia') gramas = q * gramasFatia(insumo.descricao);
  else if (u === 'und' || u === 'un' || u === 'pc' || u === 'peça' || u === 'peca' || u === 'aro') {
    const d = descNorm(insumo.descricao);
    if (estoqueEmKg(insumo)) {
      if (/ONION|ANEIS|ANÉIS/.test(d)) return Number(((q * 8) / 1000).toFixed(6));
      if (/NUGGET/.test(d)) return Number(((q * 20) / 1000).toFixed(6));
      if (/CHICKEN|TENDER|FILE|FILÉ|JR/.test(d)) return Number(((q * 70) / 1000).toFixed(6));
      if (/HB|HAMBURGUER|CARNE HB|BKC/.test(d) && !/WHOPPER/.test(d)) {
        return Number(((q * 50) / 1000).toFixed(6));
      }
      if (/CARNE|WHOPPER|REBEL|COSTELA|FRALDINHA|GOURMET/.test(d)) {
        return Number(((q * 113) / 1000).toFixed(6));
      }
      return Number(((q * 10) / 1000).toFixed(6));
    }
    return q;
  } else {
    return q;
  }

  if (gramas != null) {
    if (estoqueEmKg(insumo)) return Number((gramas / 1000).toFixed(6));
    return Number((gramas / 1000).toFixed(6));
  }
  return q;
}

export function custoLinhaReceita(
  quantidadeReceita: number,
  unidadeReceita: string,
  insumo: InsumoConversao | null | undefined,
  qtdeEstoqueSalva?: number | null,
): number {
  const valor = num(insumo?.valor_unidade);
  if (valor <= 0) return 0;
  const qtdeEst =
    qtdeEstoqueSalva != null && Number(qtdeEstoqueSalva) > 0
      ? num(qtdeEstoqueSalva)
      : qtdeReceitaParaEstoque(quantidadeReceita, unidadeReceita, insumo || {});
  return qtdeEst * valor;
}

export function unidadeReceitaPadrao(insumo: InsumoConversao | null | undefined): string {
  return estoqueEmKg(insumo) ? 'g' : 'und';
}

export const UNIDADES_RECEITA = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'fatia', label: 'Fatia' },
  { value: 'und', label: 'Und' },
  { value: 'concha', label: 'Concha' },
  { value: 'volta', label: 'Volta' },
] as const;
