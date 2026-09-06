/**
 * Terceiro campo da conferência: padrão UND; KG só sob demanda.
 * Preview só soma local quando a entrada está na unidade do saldo.
 */
import type { EstoqueItem } from '../../api/client';

export type ModoEntradaFracionada = 'und' | 'kg';

export type RascunhoContagem = {
  caixa: string;
  pc: string;
  kg: string;
  /** Como o operador está digitando o 3º campo. */
  modo?: ModoEntradaFracionada;
};

export type CamposPermitidosContagem = {
  caixa: boolean;
  pc: boolean;
  kg: boolean;
};

function normUnidade(u: string | null | undefined): string {
  const x = String(u || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['kg', 'kilo', 'kilos', 'kilograma', 'kilogramas'].includes(x)) return 'kg';
  if (['und', 'un', 'unid', 'unidade', 'unidades'].includes(x)) return 'und';
  return x;
}

export function unidadeFracionadaItem(item: Pick<EstoqueItem, 'unidade_fracionada' | 'unidade_contagem'>): string {
  return String(item.unidade_fracionada || item.unidade_contagem || 'UND').trim() || 'UND';
}

/** Saldo / preço canônico do item é em kg. */
export function unidadeContagemEhKg(
  item: Pick<EstoqueItem, 'unidade_contagem'>,
): boolean {
  return normUnidade(item.unidade_contagem) === 'kg';
}

/**
 * Itens tipicamente pesados: saldo em KG (carnes, mix, etc.).
 * Nesses o app oferece o atalho discreto “informar em kg?”.
 */
export function podeInformarKg(item: Pick<EstoqueItem, 'unidade_contagem' | 'permite_contagem_kg_und'>): boolean {
  return item.permite_contagem_kg_und !== false && unidadeContagemEhKg(item);
}

export function modoEntradaInicial(
  item: Pick<
    EstoqueItem,
    'unidade_fracionada' | 'unidade_contagem' | 'contagem_unidade_entrada' | 'contagem_kg_und' | 'estoque_contado'
  >,
): ModoEntradaFracionada {
  const saved = normUnidade(item.contagem_unidade_entrada);
  if (saved === 'kg') return 'kg';
  if (saved === 'und') return 'und';
  const temValor =
    item.contagem_kg_und != null ||
    (item.estoque_contado != null && Number.isFinite(Number(item.estoque_contado)));
  // Legado sem modo salvo: respeita o cadastro se já houver número.
  if (temValor && normUnidade(unidadeFracionadaItem(item)) === 'kg') return 'kg';
  // Item só cadastrado em KG (sem peça): abre em kg pra não travar.
  if (!temValor && normUnidade(unidadeFracionadaItem(item)) === 'kg') return 'kg';
  return 'und';
}

export function modoEntradaEfetivo(
  item: Pick<
    EstoqueItem,
    'unidade_fracionada' | 'unidade_contagem' | 'contagem_unidade_entrada' | 'contagem_kg_und' | 'estoque_contado'
  >,
  linha: RascunhoContagem | undefined,
): ModoEntradaFracionada {
  if (linha?.modo === 'kg' || linha?.modo === 'und') return linha.modo;
  return modoEntradaInicial(item);
}

/** Identidade: o terceiro campo já está na unidade do saldo. */
export function fracionadaIdentidade(
  item: Pick<
    EstoqueItem,
    'unidade_fracionada' | 'unidade_contagem' | 'contagem_unidade_entrada' | 'contagem_kg_und' | 'estoque_contado'
  >,
  linha?: RascunhoContagem,
): boolean {
  const dest = String(item.unidade_contagem || '').trim();
  if (!dest) return true;
  const modo = modoEntradaEfetivo(item, linha);
  const orig = modo === 'kg' ? 'KG' : modo === 'und' ? 'UND' : unidadeFracionadaItem(item);
  return normUnidade(orig) === normUnidade(dest);
}

export function rotuloCampoFracionado(
  unidade: string | null | undefined,
): string {
  const n = normUnidade(unidade);
  if (n === 'und') return 'UNIDADES';
  if (n === 'kg') return 'KG';
  if (n === 'l' || n === 'lt') return 'L';
  const raw = String(unidade || '').trim().toUpperCase();
  return raw || 'UNIDADES';
}

export function rotuloModoEntrada(modo: ModoEntradaFracionada): string {
  return modo === 'kg' ? 'KG' : 'UNIDADES';
}

/** Rótulo curto para o operador (UND / KG / L). */
export function rotuloUnidadeOperacional(unidade: string | null | undefined): string {
  const n = normUnidade(unidade);
  if (n === 'und') return 'UND';
  if (n === 'kg') return 'KG';
  if (n === 'l' || n === 'lt') return 'L';
  const raw = String(unidade || '').trim().toUpperCase();
  return raw || 'UND';
}

export function unidadeFisicaInsumo(item: {
  unidade_fracionada?: string | null;
  unidade_contagem?: string | null;
} | null | undefined): string {
  return rotuloUnidadeOperacional(item?.unidade_fracionada || item?.unidade_contagem || 'UND');
}

export function fracionadaInteira(unidade: string | null | undefined): boolean {
  return normUnidade(unidade) === 'und';
}

export function parseNumCampoContagem(raw: string): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Bloqueia negativo. UND = só inteiro. Vírgula/ponto permitidos em KG/L. */
export function sanitizarEntradaFracionada(raw: string, inteiro: boolean): string {
  const s = String(raw ?? '').replace(/-/g, '');
  if (inteiro) return s.replace(/[^\d]/g, '');
  let sep = 0;
  let out = '';
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      out += ch;
      continue;
    }
    if ((ch === ',' || ch === '.') && sep === 0) {
      out += ch;
      sep += 1;
    }
  }
  return out;
}

export function sanitizarEntradaNaoNegativa(raw: string): string {
  return String(raw ?? '').replace(/-/g, '');
}

export function permiteCamposItem(i: EstoqueItem): CamposPermitidosContagem {
  return {
    caixa: i.permite_contagem_caixa !== false,
    pc: i.permite_contagem_pc_fd !== false,
    kg: i.permite_contagem_kg_und !== false,
  };
}

export function temEntradaTerraco(
  linha: RascunhoContagem | undefined,
  permite?: CamposPermitidosContagem,
): boolean {
  if (!linha) return false;
  const p = permite || { caixa: true, pc: true, kg: true };
  return (
    (p.caixa && String(linha.caixa).trim() !== '') ||
    (p.pc && String(linha.pc).trim() !== '') ||
    (p.kg && String(linha.kg).trim() !== '')
  );
}

function parseCampo(raw: string): number {
  return parseNumCampoContagem(raw) ?? 0;
}

function qtdIdentidade(
  linha: RascunhoContagem,
  undConvertida: number,
  undParcial: number,
  permite?: CamposPermitidosContagem,
): number {
  const p = permite || { caixa: true, pc: true, kg: true };
  const caixa = p.caixa ? parseCampo(linha.caixa) : 0;
  const pc = p.pc ? parseCampo(linha.pc) : 0;
  const kg = p.kg ? parseCampo(linha.kg) : 0;
  const base = undConvertida > 0 ? undConvertida : 1;
  const parcial = undParcial > 0 ? undParcial : 1;
  return Math.round((caixa * base + pc * parcial + kg) * 10000) / 10000;
}

function numEq(a: number | null | undefined, raw: string, liberado: boolean): boolean {
  if (!liberado) return true;
  const parsed = parseNumCampoContagem(raw);
  if (parsed == null && (a == null || a === undefined)) return String(raw).trim() === '';
  if (parsed == null || a == null) return false;
  return Number(a) === parsed;
}

export function rascunhoIgualSalvo(item: EstoqueItem, linha: RascunhoContagem | undefined): boolean {
  const p = permiteCamposItem(item);
  const raw = linha || { caixa: '', pc: '', kg: '' };
  const modoSalvo = modoEntradaInicial(item);
  const modoLinha = modoEntradaEfetivo(item, linha);
  return (
    numEq(item.contagem_caixa, raw.caixa, p.caixa) &&
    numEq(item.contagem_pc_fd, raw.pc, p.pc) &&
    numEq(item.contagem_kg_und, raw.kg, p.kg) &&
    modoSalvo === modoLinha
  );
}

/**
 * QTD para preview. Identidade = soma local (CAIXA×und + PC×parcial + campo).
 * Unidades diferentes = só o estoque_contado já calculado pelo backend.
 */
export function qtdPreviewSeguro(
  item: EstoqueItem,
  linha: RascunhoContagem | undefined,
  permite?: CamposPermitidosContagem,
): number | null {
  const p = permite || permiteCamposItem(item);
  if (!temEntradaTerraco(linha, p)) return null;
  if (fracionadaIdentidade(item, linha)) {
    return qtdIdentidade(
      linha || { caixa: '', pc: '', kg: '' },
      Number(item.und_convertida) || 1,
      Number(item.und_parcial) || 1,
      p,
    );
  }
  if (rascunhoIgualSalvo(item, linha) && item.estoque_contado != null && Number.isFinite(Number(item.estoque_contado))) {
    return Number(item.estoque_contado);
  }
  return null;
}

export function rascunhoDeItemContagem(i: EstoqueItem): RascunhoContagem {
  const p = permiteCamposItem(i);
  const modo = modoEntradaInicial(i);
  const temTerraco =
    i.contagem_caixa != null || i.contagem_pc_fd != null || i.contagem_kg_und != null;
  if (temTerraco) {
    return {
      caixa: !p.caixa || i.contagem_caixa == null ? '' : String(i.contagem_caixa),
      pc: !p.pc || i.contagem_pc_fd == null ? '' : String(i.contagem_pc_fd),
      kg: !p.kg || i.contagem_kg_und == null ? '' : String(i.contagem_kg_und),
      modo,
    };
  }
  return {
    caixa: '',
    pc: '',
    kg: p.kg && i.estoque_contado != null ? String(i.estoque_contado) : '',
    modo,
  };
}
