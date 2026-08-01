/**
 * Converte quantidade da receita de produção → unidade de estoque/compra.
 *
 * Receita (produto): g, fatia, concha, volta, und
 * Estoque (compra/contagem): tipicamente kg (granel) ou peça (pão, copo, cone)
 */

const G_POR_FATIA = {
  queijo: 11,
  tomate: 25,
  picles: 6,
  bacon: 9,
  jalapeno: 4,
  default: 10,
};

const G_CONCHA = 14; // ½ oz
const G_VOLTA = 4;

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function descNorm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

/** Heurística: estoque em kg (granel) vs peça. */
export function estoqueEmKg(insumo) {
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
    if (
      /PAO|PATTY|CAIXA THE KINGS/.test(d) &&
      !/GRANEL|BAG|CX \d+X\d+KG|CX\d+X\d+KG/.test(d)
    ) {
      return false;
    }
    if (/PAO |PAO\b/.test(d)) return false;
    return true;
  }
  // und_convertida decimal típico de kg totais na caixa
  if (und > 1 && !Number.isInteger(und)) return true;
  return false;
}

function gramasFatia(descricaoInsumo) {
  const d = descNorm(descricaoInsumo);
  if (/QUEIJO|CHEDDAR|MUSSARELA/.test(d)) return G_POR_FATIA.queijo;
  if (/TOMATE/.test(d)) return G_POR_FATIA.tomate;
  if (/PEPINO|PICLES|PICKLE/.test(d)) return G_POR_FATIA.picles;
  if (/BACON/.test(d)) return G_POR_FATIA.bacon;
  if (/JALAPENO|JALAPEÑO/.test(d)) return G_POR_FATIA.jalapeno;
  return G_POR_FATIA.default;
}

/**
 * @param {number} quantidadeReceita
 * @param {string} unidadeReceita g|fatia|und|concha|volta|kg
 * @param {{ descricao?: string, und_convertida?: number }} insumo
 * @returns {number} quantidade na unidade de estoque
 */
export function qtdeReceitaParaEstoque(quantidadeReceita, unidadeReceita, insumo = {}) {
  const q = num(quantidadeReceita);
  if (q <= 0) return 0;
  const u = String(unidadeReceita || 'und').trim().toLowerCase();

  let gramas = null;
  if (u === 'g') gramas = q;
  else if (u === 'kg') return q; // já em kg
  else if (u === 'concha') gramas = q * G_CONCHA;
  else if (u === 'volta') {
    const d = descNorm(insumo.descricao);
    // Soft serve / mix de máquina: ~40g por volta. Cheddar/molho: 4g.
    if (/LACTEA|SORVETE|POLENGHI|OUROLAC|SOFT|MIX DE SORVETE|BEBIDA LACT/.test(d)) {
      gramas = q * 40;
    } else {
      gramas = q * G_VOLTA;
    }
  }
  else if (u === 'fatia') gramas = q * gramasFatia(insumo.descricao);
  else if (u === 'und' || u === 'un' || u === 'pc' || u === 'peça' || u === 'peca' || u === 'aro') {
    const d = descNorm(insumo.descricao);
    if (estoqueEmKg(insumo)) {
      if (/ONION|ANEIS|ANÉIS/.test(d)) return Number(((q * 8) / 1000).toFixed(6)); // ~8g/aro
      if (/NUGGET/.test(d)) return Number(((q * 20) / 1000).toFixed(6));
      if (/CHICKEN|TENDER|FILE|FILÉ|JR/.test(d)) return Number(((q * 70) / 1000).toFixed(6));
      if (/HB|HAMBURGUER|CARNE HB|BKC/.test(d) && !/WHOPPER/.test(d)) {
        return Number(((q * 50) / 1000).toFixed(6));
      }
      if (/CARNE|WHOPPER|REBEL|COSTELA|FRALDINHA|GOURMET/.test(d)) {
        return Number(((q * 113) / 1000).toFixed(6));
      }
      // granel sem peça clara: não tratar und como kg inteiro
      return Number(((q * 10) / 1000).toFixed(6));
    }
    return q;
  } else {
    return q;
  }

  if (gramas != null) {
    if (estoqueEmKg(insumo)) return Number((gramas / 1000).toFixed(6));
    // estoque em peça mas receita em g: não faz sentido; guarda g/1000 mesmo
    return Number((gramas / 1000).toFixed(6));
  }
  return q;
}

export function rotuloUnidadeReceita(u) {
  const x = String(u || 'und').toLowerCase();
  if (x === 'g') return 'g';
  if (x === 'kg') return 'kg';
  if (x === 'fatia') return 'fatia(s)';
  if (x === 'concha') return 'concha(s)';
  if (x === 'volta') return 'volta(s)';
  return 'und';
}
