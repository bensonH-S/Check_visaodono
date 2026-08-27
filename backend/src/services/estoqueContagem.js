/**
 * Contagem estilo planilha Terraço:
 *   VL.UNIT = VL.CAIXA / und_convertida
 *   QTD     = CAIXA * und_convertida + PC/FD * und_parcial + KG/UND
 */

/** Ordem das faixas da planilha Terraço (não é alfabética: CONGELADOS vem antes de BRINDES). */
export const SQL_ORDEM_PLANILHA = `
  CASE
    WHEN p.secao_contagem ILIKE 'CONGELADOS%' THEN 1
    WHEN p.secao_contagem ILIKE 'RESFRIADOS%' THEN 2
    WHEN p.secao_contagem ILIKE 'MOLHOS%' THEN 3
    WHEN p.secao_contagem ILIKE 'SOBREMESA%' THEN 4
    WHEN p.secao_contagem ILIKE 'EMBALAGENS%' THEN 5
    WHEN p.secao_contagem ILIKE 'LIMPEZA%' THEN 6
    WHEN p.secao_contagem ILIKE 'REFRIGERANTES%' THEN 7
    WHEN p.secao_contagem ILIKE 'BRINDES%' THEN 8
    WHEN p.secao_contagem ILIKE 'LAN%' THEN 9
    ELSE 99
  END,
  p.ordem_contagem NULLS LAST,
  p.descricao
`;

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

const GRUPOS_DIARIOS = [
  'carne',
  'frango',
  'queijo',
  'bacon',
  'pao',
  'batata',
  'oleo',
  'refil',
  'vegetais',
  'mix_sobremesa',
];

const MARCA_BAG_REFRI = /\b(PEPSI|COCA|GUARAN|SPRITE|FANTA|SUKITA|SODA|LIPTON|CHA |REFRI)\b/;

function ehBagRefrigerante(d) {
  return (
    /\bBAG\b/.test(d) &&
    MARCA_BAG_REFRI.test(d) &&
    !/\b(MAIONESE|BARBECUE|MOLHO|BRINDE|CART|MOSTARDA)\b/.test(d)
  );
}

function ehCocaColaClassica(d) {
  return /\bCOCA\b/.test(d) && !/\b(ZERO|SEM ACUCAR)\b/.test(d);
}

/** Litros do bag de refrigerante, ou null se o texto não traz volume. */
export function litrosBagRefri(descricao) {
  const d = normalizarDesc(descricao);
  if (/\b18000\s*ML\b/.test(d) || /\b18[,.]9\s*L/.test(d)) return 18;
  if (/\b18\s*(LT|L)\b/.test(d)) return 18;
  if (/\b10000\s*ML\b/.test(d) || /\b10\s*(LT|L)\b/.test(d) || /\b10L\b/.test(d)) return 10;
  return null;
}

/**
 * Mix da semanal: Coca-Cola clássica em bag 18 L; Zero / Fanta / Sprite / demais em 10 L.
 */
export function ehBagMixSemanal(descricao) {
  const d = normalizarDesc(descricao);
  if (!ehBagRefrigerante(d)) return false;
  const litros = litrosBagRefri(d);
  if (ehCocaColaClassica(d)) return litros === 18;
  return litros === 10;
}

/**
 * Volume correto no cadastro: Coca clássica 18 L, o resto 10 L.
 * Só Fanta / Sprite / Coca Zero-sem açúcar — não mexe em chá 18,9 L.
 */
export function corrigirVolumeBagMix(descricao, undAtual) {
  const d = normalizarDesc(descricao);
  if (!ehBagRefrigerante(d)) return null;
  if (/\bLIPTON\b/.test(d) || /\bCHA \b/.test(d)) return null;

  const alvo = ehCocaColaClassica(d) ? 18 : 10;
  let novaDesc = String(descricao || '');
  if (alvo === 10) {
    novaDesc = novaDesc
      .replace(/18\s*LT/gi, '10 LT')
      .replace(/18000\s*ML/gi, '10000ML');
  }
  const und = Number(undAtual);
  const undOk = Number.isFinite(und) && Math.abs(und - alvo) < 0.01;
  if (novaDesc === descricao && undOk) return null;
  return { descricao: novaDesc, und_convertida: alvo };
}

/**
 * Contagem diária: carne, frango, queijo, bacon, pão, batata, copos/xarope, mix.
 * Óleo, vegetais e casquinha ficam fora. Bags de mix ficam na semanal.
 */
export function classificarGrupoDiario(descricao) {
  const d = normalizarDesc(descricao);
  if (!d) return null;

  // Bags de refrigerante (Coca 18 L / demais 10 L) ficam só na semanal.
  if (ehBagRefrigerante(d)) return null;

  if (/\bCASQUINHA\b/.test(d)) return null;
  if (/\bOLEO\b/.test(d)) return null;
  if (/\b(ALFACE|TOMATE|CEBOLA)\b/.test(d)) return null;

  if (
    /\b(BAUNILHA|DOCE DE LEITE)\b/.test(d) &&
    (/\bBEBIDA LACTEA\b/.test(d) || /\bMIX\b/.test(d) || /\b(SORVETE|SOFT)\b/.test(d)) &&
    !/\b(NUTELLA|CASQUINHA|SUNDAE|COPO|BRINDE|CART|XAROPE|CONFEITARIA|MOCA)\b/.test(d)
  ) {
    return 'mix_sobremesa';
  }

  if (/\bBATATA\b/.test(d) && !/\b(CARTONAGEM|CART BATATA|FUNDO|TAMPA|SAQUINHO|EMBALAG)\b/.test(d)) {
    return 'batata';
  }
  if (/\bPAO\b/.test(d) && !/\b(CESTO|BRINDE|CART)\b/.test(d) && !/\b270\b/.test(d)) return 'pao';
  if (/\bQUEIJO\b/.test(d) && !/\bMOLHO\b/.test(d)) return 'queijo';
  if (/\bBACON\b/.test(d) && !/\b(MAIONESE|BACONESE|SACHET|MOLHO)\b/.test(d)) return 'bacon';
  if (
    /\b(CHICKEN|FRANGO)\b/.test(d) &&
    !/\b(LAMINA|SACO |CARTON|MARMITA|ESTROGONOFF|BRINDE)\b/.test(d)
  ) {
    return 'frango';
  }
  // Carne HB e Rebel (vegetariana).
  if (/\bREBEL\b/.test(d) && !/\b(LAMINA|BRINDE|CART|MARMITA)\b/.test(d)) return 'carne';
  if (/\bCARNE HB\b/.test(d) && !/\b(MARMITA|BRINDE|CART)\b/.test(d)) return 'carne';
  if (/\b(FRALDINHA|FRANDINHA)\b/.test(d)) return null;
  if (/\bCARNE\b/.test(d) && !/\b(MARMITA|BRINDE|CART|FRALDINHA|FRANDINHA)\b/.test(d)) return 'carne';
  // Só os copos genéricos 440 / 550. Campanha (Star Wars, Minions) não entra na diária.
  if (
    /\bCOPO\b/.test(d) &&
    /\bUNIVERSAL\b/.test(d) &&
    /\b(440|550)\b/.test(d) &&
    !/\b(SHAKE|SUNDAE|CORTESIA|MIX|MINIONS|PORTA|TAMPA)\b/.test(d)
  ) {
    return 'refil';
  }
  if (/\bFREE REFIL/.test(d) || /\bFREE REFILL/.test(d) || /\bXAROPE\b/.test(d)) {
    return 'refil';
  }
  return null;
}

export function flagsContagemDiaria(descricao) {
  const grupo = classificarGrupoDiario(descricao);
  if (!grupo || !GRUPOS_DIARIOS.includes(grupo)) {
    return { contagem_diaria: false, grupo_diario: null };
  }
  return { contagem_diaria: true, grupo_diario: grupo };
}

/**
 * Semanal de segunda: mix (Coca 18 L, demais bags 10 L) e latas.
 */
export function classificarGrupoCritico(descricao) {
  const d = normalizarDesc(descricao);
  if (!d) return null;

  if (
    /\bLATA\b/.test(d) &&
    /\b(COCA|PEPSI|GUARAN|SPRITE|FANTA|SUKITA|SODA|REFRI|ANTARCT)\b/.test(d) &&
    !/\b(BRINDE|CART|COPO|CANUDO|TAMPA)\b/.test(d)
  ) {
    return 'lata';
  }
  if (ehBagMixSemanal(d)) return 'mix';
  return null;
}

export function flagsContagemCritica(descricao) {
  const grupo = classificarGrupoCritico(descricao);
  if (!grupo) return { contagem_critica: false, grupo_critico: null };
  return { contagem_critica: true, grupo_critico: grupo };
}

export function rotuloGrupoContagem(grupo) {
  const mapa = {
    carne: 'Carne',
    frango: 'Frango',
    queijo: 'Queijo',
    bacon: 'Bacon',
    pao: 'Pao',
    batata: 'Batata',
    oleo: 'Oleo',
    refil: 'Refil / copo',
    vegetais: 'Vegetais',
    mix_sobremesa: 'Mix (baunilha / doce de leite)',
    mix: 'Mix (Coca 18L / demais 10L)',
    lata: 'Lata',
  };
  return mapa[String(grupo || '')] || grupo || '';
}

/** O que o app usa hoje, a partir das flags gravadas no cadastro. */
export function rotuloListaAtual({ contagem_diaria, contagem_critica }) {
  if (contagem_diaria && contagem_critica) return 'Supercritico e critico';
  if (contagem_diaria) return 'Supercritico (diario)';
  if (contagem_critica) return 'Critico (semanal)';
  return 'Fora';
}

/** Sugestao pelas regras de descricao (para o gestor confrontar com o cadastro). */
export function rotuloListaSugestao(descricao) {
  const diaria = flagsContagemDiaria(descricao);
  if (diaria.contagem_diaria) return 'Supercritico (diario)';
  const critica = flagsContagemCritica(descricao);
  if (critica.contagem_critica) return 'Critico (semanal)';
  return 'Fora';
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
