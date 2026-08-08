/**
 * Contagem estilo planilha Terraço:
 *   VL.UNIT = VL.CAIXA / und_convertida
 *   QTD     = CAIXA * und_convertida + PC/FD * und_parcial + KG/UND
 */

export function num(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function normalizarDesc(desc) {
  return String(desc || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Unidade de contagem do insumo (kg | und | L).
 * Regras de negócio (piloto Terraço / CMV):
 * - Bacon, filé, manteiga, mini filé, pedaços, peito, picles, queijo → kg
 * - Molhos bag / mostarda bag → kg
 * - Molho blister / mostarda sachet / Coca lata → und
 * - Coca bag / óleo → L
 */
export function classificarUnidadeContagem(descricao, undConvertida = null) {
  const d = normalizarDesc(descricao);
  const und = undConvertida != null && Number.isFinite(Number(undConvertida))
    ? Number(undConvertida)
    : null;

  if (!d) return 'UND';

  // Embalagens unitárias explícitas (lata, sache, blister, “… 6 UND”)
  if (/\b(LATA|SACHET|SACHE|BLISTER)\b/.test(d)) return 'UND';
  if (/\b\d+\s*UND\b|\bC\/\s*\d+\s*UND\b|\bCX\s+\d+\s*UND\b/.test(d) && !/\b(BAG|KG)\b/.test(d)) {
    return 'UND';
  }

  // Óleo a granel (não kit medidor)
  if (/\bOLEO\b/.test(d) && !/\b(KIT|MEDIDOR)\b/.test(d)) return 'L';

  // Refrigerante / chá em BAG ou litros → L
  if (
    /\bBAG\b/.test(d) &&
    /\b(COCA|PEPSI|SPRITE|FANTA|GUARANA|SODA|CHA|LIPTON|REFRIG|\bLT\b|LITRO)\b/.test(d)
  ) {
    return 'L';
  }
  if (/\b\d+[,.]?\d*\s*LT\b|\bLITRO|\b18[,.]?9\s*L\b/.test(d) && !/\bLATA\b/.test(d)) {
    return 'L';
  }

  // Mostarda bag = kg; sache já caiu em UND
  if (/\bMOSTARDA\b/.test(d)) return 'KG';

  // Insumos de peso (alimentos)
  if (
    /\b(BACON|CARNE|QUEIJO|ALFACE|TOMATE|CEBOLA|PEPINO|PICLES|FRANGO|FILE|PEITO|PEDACO|MANTEIGA|MOLHO|MAIONESE|KETCHUP|CALDA|NUTELLA|SORVETE|LACTEA|FRANDINHA|LEITE EM PO)\b/.test(
      d,
    ) ||
    (/\bBATATA\b/.test(d) && !/\b(CARTON|FUNDO)\b/.test(d))
  ) {
    return 'KG';
  }

  // Descarta utilidades / embalagens
  if (
    /\b(BRINDE|ETIQUETA|CANUDO|COPO|TAMPA|CARTON|PAZINHA|REDINHA|GUARDANAPO|COLHER|LAMINA|COROA|POTE|KIT|ZIPCLIP|BANDEJA|FUNDO DE|TEFLON|ORINGS|CESTO|PANO|MANTA)\b/.test(
      d,
    )
  ) {
    return 'UND';
  }

  if (und != null && und >= 40 && Number.isInteger(und)) return 'UND';
  if (und != null && und > 0 && und <= 30) return 'KG';
  return 'UND';
}

/** Última linha da planilha Terraço que entra no CMV: SUM(I7:I231). */
export const CMV_LINHA_FIM = 231;

/**
 * Célula preta (preenchimento sólido) na planilha = campo bloqueado.
 * Células editáveis vêm sem fill / patternType "none".
 */
export function celulaBloqueadaContagem(cell) {
  if (!cell || !cell.s) return false;
  return cell.s.patternType === 'solid';
}

/**
 * Calcula QTD a partir dos três campos da planilha.
 * Retorna null se nenhum campo habilitado foi informado (item pendente).
 */
export function calcularQtdContagem({
  contagem_caixa,
  contagem_pc_fd,
  contagem_kg_und,
  und_convertida = 1,
  und_parcial = 1,
  permite_contagem_caixa = true,
  permite_contagem_pc_fd = true,
  permite_contagem_kg_und = true,
}) {
  const usaCaixa = permite_contagem_caixa !== false;
  const usaPc = permite_contagem_pc_fd !== false;
  const usaKg = permite_contagem_kg_und !== false;

  const temCaixa =
    usaCaixa && contagem_caixa !== null && contagem_caixa !== undefined && contagem_caixa !== '';
  const temPc =
    usaPc && contagem_pc_fd !== null && contagem_pc_fd !== undefined && contagem_pc_fd !== '';
  const temKg =
    usaKg && contagem_kg_und !== null && contagem_kg_und !== undefined && contagem_kg_und !== '';
  if (!temCaixa && !temPc && !temKg) return null;

  const caixa = temCaixa ? num(contagem_caixa) : 0;
  const pc = temPc ? num(contagem_pc_fd) : 0;
  const kg = temKg ? num(contagem_kg_und) : 0;
  const base = num(und_convertida, 1) > 0 ? num(und_convertida, 1) : 1;
  const parcial = num(und_parcial, 1) > 0 ? num(und_parcial, 1) : 1;
  const qtd = caixa * base + pc * parcial + kg;
  return Math.round(qtd * 10000) / 10000;
}

/** Extrai und_convertida / und_parcial das fórmulas D e H da planilha. */
export function extrairFatoresFormula(fD, fH) {
  const mD = String(fD || '').match(/\/\s*([\d.,]+)/);
  const mE = String(fH || '').match(/E\d+\s*\*\s*([\d.,]+)/i);
  const mF = String(fH || '').match(/F\d+\s*\*\s*([\d.,]+)/i);
  const fromD = mD ? num(String(mD[1]).replace(',', '.')) : null;
  const fromE = mE ? num(String(mE[1]).replace(',', '.')) : null;
  const und_convertida = fromD && fromD > 0 ? fromD : fromE && fromE > 0 ? fromE : 1;
  const und_parcial = mF ? num(String(mF[1]).replace(',', '.'), 1) : 1;
  return {
    und_convertida: und_convertida > 0 ? und_convertida : 1,
    und_parcial: und_parcial > 0 ? und_parcial : 1,
    temFatorPc: Boolean(mF),
  };
}
