import { jsPDF } from 'jspdf';
import type { EstoqueContagemDetalhe, EstoqueItem, Loja } from '../api/client';
import { compararOrdemPlanilha } from '../components/estoque/estoqueOrdemPlanilha';
import { assetUrl } from '../config/paths';

const MARGIN = 10;
const PAGE_W = 297;
const PAGE_H = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 8;
const CONTENT_BOTTOM = FOOTER_Y - 4;

const NAVY = [11, 26, 59] as const;
const ACCENT = [232, 82, 10] as const;
const GRUPO_TXT = [160, 176, 200] as const;
const SLATE = [71, 85, 105] as const;
const SLATE_LIGHT = [148, 163, 184] as const;
const LINE = [226, 232, 240] as const;
const ROW_ALT = [248, 250, 252] as const;
const HEADER_BG = [241, 245, 249] as const;
const OK = [21, 128, 61] as const;
const FAIL = [185, 28, 28] as const;
const MUTED = [100, 116, 139] as const;
const SECAO_BG = [11, 26, 59] as const;
const BLOQUEADO_BG = [226, 232, 240] as const;
const BLOQUEADO_BD = [203, 213, 225] as const;
const BLOQUEADO_TXT = [148, 163, 184] as const;

type Rgb = readonly [number, number, number];
type LogoIcon = { dataUrl: string; w: number; h: number };
export type RascunhoContagem = { caixa: string; pc: string; kg: string };
export type ModoRelatorioContagem = 'estrutura' | 'dados';

export function rotuloTipoRelatorio(tipo?: string | null) {
  if (tipo === 'diaria') return 'Contagem diária';
  if (tipo === 'critica_semanal') return 'Contagem semanal';
  return 'Contagem mensal';
}

export function slugTipoRelatorio(tipo?: string | null) {
  if (tipo === 'diaria') return 'diaria';
  if (tipo === 'critica_semanal') return 'semanal';
  return 'mensal';
}

const COLS = {
  item: 106,
  und: 12,
  caixa: 20,
  pc: 20,
  kg: 22,
  qtd: 24,
  sist: 24,
  dif: 22,
  valor: 27,
} as const;

function setFill(doc: jsPDF, c: Rgb) {
  doc.setFillColor(c[0], c[1], c[2]);
}

function setStroke(doc: jsPDF, c: Rgb) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

function setText(doc: jsPDF, c: Rgb) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function pdfTxt(valor: string) {
  return valor.replace(/\u2014/g, '-').replace(/\u00a0/g, ' ');
}

function parseNumCampo(raw: string): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function calcQtd(
  linha: RascunhoContagem | undefined,
  undConvertida: number,
  undParcial: number,
): number | null {
  if (!linha) return null;
  const tem =
    String(linha.caixa).trim() !== '' ||
    String(linha.pc).trim() !== '' ||
    String(linha.kg).trim() !== '';
  if (!tem) return null;
  const caixa = parseNumCampo(linha.caixa) ?? 0;
  const pc = parseNumCampo(linha.pc) ?? 0;
  const kg = parseNumCampo(linha.kg) ?? 0;
  const base = undConvertida > 0 ? undConvertida : 1;
  const parcial = undParcial > 0 ? undParcial : 1;
  return Math.round((caixa * base + pc * parcial + kg) * 10000) / 10000;
}

function fmtNum(v: number | null | undefined, digitos = 2) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digitos,
  });
}

function fmtBrl(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDataBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function fmtDataHora(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fmtDataBR(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nomeSecao(i: EstoqueItem) {
  return String(i.secao_contagem || '').trim() || 'OUTROS';
}

function aplicarRascunho(
  itens: EstoqueItem[],
  rascunho?: Record<number, RascunhoContagem>,
): EstoqueItem[] {
  return itens.map((i) => {
    const raw = rascunho?.[i.id_item];
    if (!raw) return i;
    const undCx = Number(i.und_convertida) > 0 ? Number(i.und_convertida) : 1;
    const undPc = Number(i.und_parcial) > 0 ? Number(i.und_parcial) : 1;
    const caixa = i.permite_contagem_caixa === false ? null : parseNumCampo(raw.caixa);
    const pc = i.permite_contagem_pc_fd === false ? null : parseNumCampo(raw.pc);
    const kg = i.permite_contagem_kg_und === false ? null : parseNumCampo(raw.kg);
    const qtd = calcQtd(
      {
        caixa: caixa == null ? '' : String(caixa),
        pc: pc == null ? '' : String(pc),
        kg: kg == null ? '' : String(kg),
      },
      undCx,
      undPc,
    );
    const valor = qtd == null ? null : Math.round(qtd * Number(i.valor_unidade || 0) * 100) / 100;
    const dif = qtd == null ? null : qtd - Number(i.estoque_sistema || 0);
    return {
      ...i,
      contagem_caixa: caixa,
      contagem_pc_fd: pc,
      contagem_kg_und: kg,
      estoque_contado: qtd,
      diferenca: dif,
      valor_estoque: valor,
    };
  });
}

async function carregarIconeMarca(): Promise<LogoIcon | null> {
  try {
    const res = await fetch(assetUrl('Logo_Alvim_Icone.png'));
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { dataUrl, w: 64, h: 64 };
  } catch {
    return null;
  }
}

function desenharMarca(doc: jsPDF, logo: LogoIcon | null, x: number, y: number, iconSize = 12) {
  if (logo) doc.addImage(logo.dataUrl, 'PNG', x, y, iconSize, iconSize);
  const tx = x + (logo ? iconSize + 3 : 0);
  const ty = y + iconSize / 2 + 1.1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, GRUPO_TXT);
  doc.text('grupo', tx, ty);
  const w = doc.getTextWidth('grupo');
  setText(doc, ACCENT);
  doc.text('alvim', tx + w, ty);
}

function novaPagina(doc: jsPDF): number {
  doc.addPage();
  return MARGIN + 1;
}

function garantirEspaco(doc: jsPDF, y: number, need: number): number {
  if (y + need > CONTENT_BOTTOM) return novaPagina(doc);
  return y;
}

function slug(v: string) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40);
}

function cabecalho(
  doc: jsPDF,
  contagem: EstoqueContagemDetalhe,
  loja: Loja | null | undefined,
  logo: LogoIcon | null,
  resumo: { preenchidos: number; total: number; valor: number; divergencias: number },
  modo: ModoRelatorioContagem,
): number {
  const estrutura = modo === 'estrutura';
  const titulo = estrutura
    ? `Modelo — ${rotuloTipoRelatorio(contagem.tipo)}`
    : rotuloTipoRelatorio(contagem.tipo);
  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 24, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, 24, PAGE_W, 0.85, 'F');

  desenharMarca(doc, logo, MARGIN, 6, 12);

  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('RELATÓRIO CONFIDENCIAL', PAGE_W - MARGIN, 8, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(titulo, PAGE_W - MARGIN, 14.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 220);
  const lojaTxt = loja
    ? `${loja.bk_number ? `${loja.bk_number} · ` : ''}${loja.name}`
    : [contagem.loja_codigo, contagem.loja_nome].filter(Boolean).join(' · ') || 'Loja';
  doc.text(lojaTxt, PAGE_W - MARGIN, 20, { align: 'right' });

  let y = 29;
  const barH = 12;
  setFill(doc, ROW_ALT);
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_W, barH, 1, 1, 'FD');

  const colW = CONTENT_W / 5;
  const cells = [
    { label: 'DATA', value: fmtDataBR(contagem.data_contagem) },
    {
      label: 'STATUS',
      value: estrutura
        ? 'Estrutura'
        : contagem.status === 'finalizada'
          ? 'Finalizada'
          : 'Aberta',
    },
    {
      label: 'REALIZADO POR',
      value: estrutura ? '—' : contagem.criado_por_nome || '—',
    },
    {
      label: 'ITENS',
      value: estrutura ? String(resumo.total) : `${resumo.preenchidos}/${resumo.total}`,
    },
    { label: 'VALOR', value: estrutura ? '—' : fmtBrl(resumo.valor) },
  ];
  cells.forEach((c, i) => {
    const x = MARGIN + i * colW + 3.5;
    if (i > 0) {
      setStroke(doc, LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN + i * colW, y + 2, MARGIN + i * colW, y + barH - 2);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    setText(doc, SLATE_LIGHT);
    doc.text(c.label, x, y + 3.6);
    doc.setFontSize(9);
    setText(doc, NAVY);
    doc.text(pdfTxt(c.value).slice(0, 28), x, y + 9);
  });

  y += barH + 2.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setText(doc, MUTED);
  const sub = estrutura
    ? `${resumo.total} itens do cadastro · preencha caixa, pc/fd e kg/und na loja`
    : [
        contagem.titulo,
        contagem.criado_em ? `iniciada ${fmtDataHora(contagem.criado_em)}` : null,
        contagem.finalizado_em ? `finalizada ${fmtDataHora(contagem.finalizado_em)}` : null,
        resumo.divergencias ? `${resumo.divergencias} divergência(s)` : 'sem divergência',
      ]
        .filter(Boolean)
        .join('  ·  ');
  doc.text(pdfTxt(sub), MARGIN, y);
  y += 4.2;
  const sw = 7.2;
  const sh = 3.4;
  setFill(doc, BLOQUEADO_BG);
  setStroke(doc, BLOQUEADO_BD);
  doc.setLineWidth(0.25);
  doc.roundedRect(MARGIN, y - 2.4, sw, sh, 0.5, 0.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  setText(doc, MUTED);
  const l1 = 'bloqueado (nao preenche)';
  doc.text(l1, MARGIN + sw + 1.6, y);
  const x2 = MARGIN + sw + 1.6 + doc.getTextWidth(l1) + 5;
  setFill(doc, [255, 255, 255]);
  setStroke(doc, LINE);
  doc.roundedRect(x2, y - 2.4, sw, sh, 0.5, 0.5, 'FD');
  doc.text('preenche neste campo', x2 + sw + 1.6, y);
  return y + 3.2;
}

function desenharCabecalhoTabela(doc: jsPDF, y: number): number {
  const h = 6.2;
  setFill(doc, HEADER_BG);
  doc.rect(MARGIN, y, CONTENT_W, h, 'F');
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + h, MARGIN + CONTENT_W, y + h);

  const headers: Array<{ t: string; w: number; align: 'left' | 'right' | 'center' }> = [
    { t: 'ITEM', w: COLS.item, align: 'left' },
    { t: 'UND', w: COLS.und, align: 'center' },
    { t: 'CAIXA', w: COLS.caixa, align: 'center' },
    { t: 'PC/FD', w: COLS.pc, align: 'center' },
    { t: 'KG/UND', w: COLS.kg, align: 'center' },
    { t: 'QTD', w: COLS.qtd, align: 'center' },
    { t: 'SIST.', w: COLS.sist, align: 'center' },
    { t: 'DIF.', w: COLS.dif, align: 'center' },
    { t: 'VALOR', w: COLS.valor, align: 'right' },
  ];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  setText(doc, MUTED);
  let x = MARGIN;
  for (const hcol of headers) {
    const tx = hcol.align === 'left' ? x + 2 : hcol.align === 'right' ? x + hcol.w - 2 : x + hcol.w / 2;
    doc.text(hcol.t, tx, y + 4.1, { align: hcol.align });
    x += hcol.w;
  }
  return y + h;
}

function campoContagem(
  doc: jsPDF,
  x: number,
  _yLinha: number,
  baseline: number,
  w: number,
  rowH: number,
  texto: string,
  opts: {
    estrutura: boolean;
    bloqueado: boolean;
    align?: 'left' | 'right' | 'center';
    color?: Rgb;
    bold?: boolean;
    size?: number;
  },
) {
  if (opts.bloqueado) {
    setFill(doc, BLOQUEADO_BG);
    setStroke(doc, BLOQUEADO_BD);
    doc.setLineWidth(0.25);
    doc.roundedRect(x + 2.2, baseline - 2.7, w - 4.4, 4, 0.5, 0.5, 'FD');
    celula(doc, x, baseline, w, '-', { align: 'center', color: BLOQUEADO_TXT, size: 7 });
    return;
  }
  if (opts.estrutura) {
    setStroke(doc, LINE);
    setFill(doc, [255, 255, 255]);
    doc.setLineWidth(0.2);
    doc.roundedRect(x + 2.2, baseline - 2.7, w - 4.4, 4, 0.4, 0.4, 'FD');
    return;
  }
  celula(doc, x, baseline, w, texto, {
    align: opts.align ?? 'center',
    color: opts.color,
    bold: opts.bold,
    size: opts.size,
  });
}

function celula(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  texto: string,
  opts: { align?: 'left' | 'right' | 'center'; color?: Rgb; bold?: boolean; size?: number },
) {
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size ?? 7);
  setText(doc, opts.color ?? SLATE);
  const align = opts.align ?? 'left';
  const tx = align === 'left' ? x + 2 : align === 'right' ? x + w - 2 : x + w / 2;
  const clipped = doc.splitTextToSize(pdfTxt(texto), w - 3);
  doc.text(Array.isArray(clipped) ? clipped[0] : clipped, tx, y, { align });
}

function rodape(doc: jsPDF, lojaLabel: string, tipoLabel: string) {
  const total = doc.getNumberOfPages();
  const gerado = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setStroke(doc, LINE);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, FOOTER_Y - 3.2, PAGE_W - MARGIN, FOOTER_Y - 3.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setText(doc, SLATE_LIGHT);
    doc.text('grupo', MARGIN, FOOTER_Y);
    const wGrupo = doc.getTextWidth('grupo');
    doc.setFont('helvetica', 'bold');
    setText(doc, ACCENT);
    doc.text('alvim', MARGIN + wGrupo, FOOTER_Y);
    doc.setFont('helvetica', 'normal');
    setText(doc, SLATE_LIGHT);
    doc.text(`  ·  MERIDIAN  ·  ${tipoLabel}`, MARGIN + wGrupo + doc.getTextWidth('alvim'), FOOTER_Y);
    doc.text(pdfTxt(lojaLabel), PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text(`${i} / ${total}  ·  ${gerado}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

export async function gerarPdfContagemDiaria(opts: {
  contagem: EstoqueContagemDetalhe;
  loja?: Loja | null;
  rascunho?: Record<number, RascunhoContagem>;
  modo?: ModoRelatorioContagem;
}): Promise<void> {
  const { contagem, loja, rascunho } = opts;
  const modo: ModoRelatorioContagem =
    opts.modo || (contagem.status === 'modelo' ? 'estrutura' : 'dados');
  const estrutura = modo === 'estrutura';
  const itens = (
    estrutura
      ? [...(contagem.itens || [])].map((i) => ({
          ...i,
          contagem_caixa: null,
          contagem_pc_fd: null,
          contagem_kg_und: null,
          estoque_contado: null,
          diferenca: null,
          valor_estoque: null,
        }))
      : aplicarRascunho([...(contagem.itens || [])], rascunho)
  ).sort(compararOrdemPlanilha);

  const preenchidos = itens.filter((i) => i.estoque_contado != null).length;
  const valor = itens.reduce((s, i) => s + (i.valor_estoque ?? 0), 0);
  const divergencias = itens.filter((i) => i.diferenca != null && i.diferenca !== 0).length;
  const tipoLabel = rotuloTipoRelatorio(contagem.tipo);

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const logo = await carregarIconeMarca();
  let y = cabecalho(
    doc,
    contagem,
    loja,
    logo,
    {
      preenchidos,
      total: itens.length,
      valor,
      divergencias,
    },
    modo,
  );

  y = desenharCabecalhoTabela(doc, y);
  const rowH = 5.6;
  let secaoAtual = '';

  for (let idx = 0; idx < itens.length; idx++) {
    const i = itens[idx];
    const secao = nomeSecao(i);
    if (secao !== secaoAtual) {
      y = garantirEspaco(doc, y, rowH + 1);
      if (y === MARGIN + 1) y = desenharCabecalhoTabela(doc, y);
      setFill(doc, SECAO_BG);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      setFill(doc, ACCENT);
      doc.rect(MARGIN, y, 1.6, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setText(doc, [255, 255, 255]);
      doc.text(secao.toUpperCase(), MARGIN + 4, y + 3.8);
      const nSecao = itens.filter((x) => nomeSecao(x) === secao).length;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(180, 195, 220);
      doc.text(`${nSecao} item(ns)`, PAGE_W - MARGIN - 3, y + 3.8, { align: 'right' });
      y += rowH;
      secaoAtual = secao;
    }

    y = garantirEspaco(doc, y, rowH);
    if (y === MARGIN + 1) {
      y = desenharCabecalhoTabela(doc, y);
      setFill(doc, SECAO_BG);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      setText(doc, [255, 255, 255]);
      doc.text(secao.toUpperCase(), MARGIN + 4, y + 3.8);
      y += rowH;
    }

    const preenchido = !estrutura && i.estoque_contado != null;
    const dif = estrutura ? null : i.diferenca;
    const zebra = idx % 2 === 1;
    if (dif != null && dif !== 0) {
      setFill(doc, [254, 242, 242]);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    } else if (zebra) {
      setFill(doc, ROW_ALT);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }

    const permiteCx = i.permite_contagem_caixa !== false;
    const permitePc = i.permite_contagem_pc_fd !== false;
    const permiteKg = i.permite_contagem_kg_und !== false;
    const nome = i.codigo ? `${i.codigo}  ${i.descricao}` : i.descricao;
    const baseline = y + 3.8;
    let x = MARGIN;
    celula(doc, x, baseline, COLS.item, nome, { bold: true, color: NAVY, size: 7 });
    x += COLS.item;
    celula(doc, x, baseline, COLS.und, i.unidade_contagem || '—', { align: 'center', size: 6.5 });
    x += COLS.und;
    campoContagem(doc, x, y, baseline, COLS.caixa, rowH, fmtNum(i.contagem_caixa, 3), {
      estrutura,
      bloqueado: !permiteCx,
      align: 'center',
    });
    x += COLS.caixa;
    campoContagem(doc, x, y, baseline, COLS.pc, rowH, fmtNum(i.contagem_pc_fd, 3), {
      estrutura,
      bloqueado: !permitePc,
      align: 'center',
    });
    x += COLS.pc;
    campoContagem(doc, x, y, baseline, COLS.kg, rowH, fmtNum(i.contagem_kg_und, 3), {
      estrutura,
      bloqueado: !permiteKg,
      align: 'center',
    });
    x += COLS.kg;
    campoContagem(doc, x, y, baseline, COLS.qtd, rowH, fmtNum(i.estoque_contado, 3), {
      estrutura,
      bloqueado: false,
      align: 'center',
      bold: preenchido,
      color: NAVY,
    });
    x += COLS.qtd;
    celula(doc, x, baseline, COLS.sist, fmtNum(i.estoque_sistema, 3), { align: 'center' });
    x += COLS.sist;
    const corDif: Rgb = !preenchido ? MUTED : dif === 0 ? OK : FAIL;
    celula(doc, x, baseline, COLS.dif, estrutura || !preenchido ? '—' : fmtNum(dif, 3), {
      align: 'center',
      bold: dif != null && dif !== 0,
      color: corDif,
    });
    x += COLS.dif;
    celula(doc, x, baseline, COLS.valor, estrutura ? '—' : fmtBrl(i.valor_estoque), {
      align: 'right',
      bold: !estrutura,
      color: NAVY,
    });

    setStroke(doc, LINE);
    doc.setLineWidth(0.12);
    doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
    y += rowH;
  }

  y = garantirEspaco(doc, y, 8);
  setFill(doc, NAVY);
  doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, [255, 255, 255]);
  doc.text(
    estrutura
      ? `MODELO  ·  ${itens.length} itens`
      : `TOTAL  ·  ${preenchidos} de ${itens.length} itens`,
    MARGIN + 3,
    y + 4.6,
  );
  doc.text(estrutura ? ' ' : fmtBrl(valor), PAGE_W - MARGIN - 3, y + 4.6, { align: 'right' });

  const lojaLabel = loja
    ? `${loja.bk_number || ''} ${loja.name}`.trim()
    : String(contagem.loja_nome || '');
  rodape(doc, lojaLabel, tipoLabel);

  const dataArq = String(contagem.data_contagem || '').slice(0, 10) || 'data';
  const bkn = loja?.bk_number || contagem.loja_codigo || slug(loja?.name || 'loja');
  const tipoSlug = slugTipoRelatorio(contagem.tipo);
  const prefixo = estrutura ? 'modelo' : 'contagem';
  doc.save(`${prefixo}-${tipoSlug}-${bkn}-${dataArq}.pdf`);
}
