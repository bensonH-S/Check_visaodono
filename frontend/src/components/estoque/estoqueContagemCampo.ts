/**
 * Terceiro campo da conferência: rótulo e entrada pela unidade_fracionada.
 * Preview só soma local quando fracionada = canônica. Caso contrário usa
 * estoque_contado do backend (nunca inventa fator).
 */
import type { EstoqueItem } from '../../api/client';

export type RascunhoContagem = { caixa: string; pc: string; kg: string };

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

/** Identidade: o terceiro campo já está na unidade do saldo. */
export function fracionadaIdentidade(
  item: Pick<EstoqueItem, 'unidade_fracionada' | 'unidade_contagem'>,
): boolean {
  const dest = String(item.unidade_contagem || '').trim();
  const orig = String(item.unidade_fracionada || dest || '').trim();
  if (!orig || !dest) return true;
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
  return (
    numEq(item.contagem_caixa, raw.caixa, p.caixa) &&
    numEq(item.contagem_pc_fd, raw.pc, p.pc) &&
    numEq(item.contagem_kg_und, raw.kg, p.kg)
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
  if (fracionadaIdentidade(item)) {
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
