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
const INK = [12, 12, 14] as const;
const ACCENT = [232, 82, 10] as const;
const GRUPO_TXT = [160, 176, 200] as const;
const SLATE = [71, 85, 105] as const;
const SLATE_LIGHT = [148, 163, 184] as const;
const LINE = [226, 232, 240] as const;
const ROW_ALT = [248, 250, 252] as const;
const HEADER_BG = [241, 245, 249] as const;
const MUTED = [100, 116, 139] as const;
const SECAO_BG = INK;
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

type MarcasPdf = { ga: LogoIcon | null; meridian: LogoIcon | null };

async function carregarIcone(arquivo: string, w: number, h: number): Promise<LogoIcon | null> {
  try {
    const res = await fetch(assetUrl(arquivo));
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    const passo = 0x2000;
    for (let i = 0; i < bytes.length; i += passo) {
      bin += String.fromCharCode(...bytes.subarray(i, i + passo));
    }
    return { dataUrl: `data:image/png;base64,${btoa(bin)}`, w, h };
  } catch {
    return null;
  }
}

async function carregarMarcas(): Promise<MarcasPdf> {
  const [ga, meridian] = await Promise.all([
    carregarIcone('Logo_GA_Laranja.png', 420, 315),
    carregarIcone('Logo_Meridian_Gestao.png', 640, 214),
  ]);
  return { ga, meridian };
}

function desenharLogo(doc: jsPDF, logo: LogoIcon, x: number, y: number, altura: number, alias: string) {
  const w = altura * (logo.w / logo.h);
  doc.addImage(logo.dataUrl, 'PNG', x, y, w, altura, alias, 'FAST');
  return w;
}

function desenharMarcas(doc: jsPDF, marcas: MarcasPdf, x: number, y: number, altura: number) {
  let cursor = x;
  if (marcas.ga) cursor += desenharLogo(doc, marcas.ga, cursor, y, altura, 'marca-ga') + 2.4;
  if (marcas.meridian) {
    const h = altura * 0.72;
    cursor += desenharLogo(doc, marcas.meridian, cursor, y + (altura - h) / 2, h, 'marca-meridian');
  }
  return cursor > x;
}

function desenharMarcaTexto(doc: jsPDF, x: number, y: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, GRUPO_TXT);
  doc.text('grupo', x, y);
  const w = doc.getTextWidth('grupo');
  setText(doc, ACCENT);
  doc.text('alvim', x + w, y);
}

function clipTexto(doc: jsPDF, texto: string, maxW: number) {
  const t = pdfTxt(texto);
  if (doc.getTextWidth(t) <= maxW) return t;
  let s = t;
  while (s.length > 1 && doc.getTextWidth(`${s}...`) > maxW) s = s.slice(0, -1);
  return `${s}...`;
}

function rotuloLojaPdf(
  contagem: EstoqueContagemDetalhe,
  loja: Loja | null | undefined,
) {
  if (loja) {
    return `${loja.bk_number ? `${loja.bk_number} · ` : ''}${loja.name}`;
  }
  return [contagem.loja_codigo, contagem.loja_nome].filter(Boolean).join(' · ') || 'Loja';
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

function faixaMarca(
  doc: jsPDF,
  marcas: MarcasPdf,
  titulo: string,
  subtitulo: string,
  altura = 16,
) {
  setFill(doc, INK);
  doc.rect(0, 0, PAGE_W, altura, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, altura, PAGE_W, 0.85, 'F');
  const logoH = Math.min(altura - 4, 11);
  if (!desenharMarcas(doc, marcas, MARGIN, (altura - logoH) / 2, logoH)) {
    desenharMarcaTexto(doc, MARGIN, altura / 2 + 1.2);
  }
  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(clipTexto(doc, titulo, 150), PAGE_W - MARGIN, altura * 0.42, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(196, 202, 212);
  doc.text(clipTexto(doc, subtitulo, 170), PAGE_W - MARGIN, altura * 0.74, { align: 'right' });
  return altura + 3.4;
}

function cardCapa(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  barra: Rgb,
  label: string,
  valor: string,
  sub: string,
  corValor: Rgb,
) {
  setFill(doc, [255, 255, 255]);
  setStroke(doc, LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 1.4, 1.4, 'FD');
  setFill(doc, barra);
  doc.rect(x + 1.5, y, w - 3, 1.15, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  setText(doc, SLATE_LIGHT);
  doc.text(label, x + 3.2, y + 6.4);
  doc.setFontSize(valor.length > 16 ? 10 : 12.5);
  setText(doc, corValor);
  doc.text(clipTexto(doc, valor, w - 6), x + 3.2, y + 14.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  setText(doc, MUTED);
  doc.text(clipTexto(doc, sub, w - 6), x + 3.2, y + 19.4);
}

function desenharCapa(
  doc: jsPDF,
  contagem: EstoqueContagemDetalhe,
  loja: Loja | null | undefined,
  marcas: MarcasPdf,
  itens: EstoqueItem[],
  resumo: { preenchidos: number; total: number; valor: number; divergencias: number },
) {
  const headerH = 30;
  setFill(doc, INK);
  doc.rect(0, 0, PAGE_W, headerH, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, headerH, PAGE_W, 1.15, 'F');
  if (!desenharMarcas(doc, marcas, MARGIN, 6, 18)) desenharMarcaTexto(doc, MARGIN, 16);

  const lojaTxt = rotuloLojaPdf(contagem, loja);
  const titulo = rotuloTipoRelatorio(contagem.tipo);
  setText(doc, [186, 196, 210]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('RELATÓRIO CONFIDENCIAL', PAGE_W - MARGIN, 8, { align: 'right' });
  setText(doc, [255, 255, 255]);
  doc.setFontSize(16);
  doc.text(titulo, PAGE_W - MARGIN, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(230, 232, 236);
  doc.text(clipTexto(doc, lojaTxt, 150), PAGE_W - MARGIN, 22.5, { align: 'right' });

  let y = headerH + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, SLATE);
  const meta = [
    fmtDataBR(contagem.data_contagem),
    contagem.status === 'finalizada' ? 'Finalizada' : 'Aberta',
    contagem.criado_por_nome || null,
    contagem.criado_em ? `iniciada ${fmtDataHora(contagem.criado_em)}` : null,
    contagem.finalizado_em ? `finalizada ${fmtDataHora(contagem.finalizado_em)}` : null,
  ]
    .filter(Boolean)
    .join('   ·   ');
  doc.text(clipTexto(doc, meta, CONTENT_W), MARGIN, y);
  y += 5;

  const gap = 3;
  const cardW = (CONTENT_W - gap * 2) / 3;
  const cardH = 23;
  const cards = [
    {
      barra: ACCENT,
      label: 'ESTOQUE CONTADO',
      valor: fmtBrl(resumo.valor),
      sub: 'posição da loja',
      cor: NAVY,
    },
    {
      barra: NAVY,
      label: 'ITENS CONFERIDOS',
      valor: String(resumo.preenchidos),
      sub:
        resumo.preenchidos === resumo.total
          ? 'contagem completa'
          : `${resumo.preenchidos} de ${resumo.total}`,
      cor: NAVY,
    },
    {
      barra: INK,
      label: 'DATA',
      valor: fmtDataBR(contagem.data_contagem),
      sub: contagem.status === 'finalizada' ? 'contagem finalizada' : 'contagem em aberto',
      cor: NAVY,
    },
  ] as const;
  cards.forEach((c, i) => {
    cardCapa(
      doc,
      MARGIN + i * (cardW + gap),
      y,
      cardW,
      cardH,
      c.barra,
      c.label,
      c.valor,
      c.sub,
      c.cor,
    );
  });
  y += cardH + 7;

  const grupos: { nome: string; valor: number; itens: number }[] = [];
  for (const item of itens) {
    const nome = nomeSecao(item);
    let g = grupos.find((x) => x.nome === nome);
    if (!g) {
      g = { nome, valor: 0, itens: 0 };
      grupos.push(g);
    }
    g.itens += 1;
    g.valor += item.valor_estoque ?? 0;
  }
  const limite = CONTENT_BOTTOM - 2;
  if (y + 8 > limite) return;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, NAVY);
  doc.text('ESTOQUE POR SEÇÃO', MARGIN, y);
  y += 3.2;
  const maxValor = Math.max(...grupos.map((g) => g.valor), 1);
  const rowH = Math.min(6.1, Math.max(4.4, (limite - y) / Math.max(grupos.length, 1)));
  for (const g of grupos) {
    if (y + rowH > limite) break;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(doc, NAVY);
    doc.text(clipTexto(doc, g.nome.toUpperCase(), 68), MARGIN, y + 3.6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setText(doc, MUTED);
    doc.text(`${g.itens} ${g.itens === 1 ? 'item' : 'itens'}`, MARGIN + 72, y + 3.6);
    const barX = MARGIN + 88;
    const barW = CONTENT_W - 88 - 32;
    const barY = y + 1.3;
    setFill(doc, HEADER_BG);
    doc.roundedRect(barX, barY, barW, 3.1, 0.6, 0.6, 'F');
    const preenchido = Math.max(0, Math.min(barW, (g.valor / maxValor) * barW));
    if (preenchido > 0.4) {
      setFill(doc, ACCENT);
      doc.roundedRect(barX, barY, preenchido, 3.1, 0.6, 0.6, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(doc, NAVY);
    doc.text(fmtBrl(g.valor), PAGE_W - MARGIN, y + 3.8, { align: 'right' });
    y += rowH;
  }
}

const COLS_CONTABIL = {
  item: 145,
  und: 18,
  qtd: 38,
  unit: 38,
  valor: 38,
} as const;

function cabecalho(
  doc: jsPDF,
  contagem: EstoqueContagemDetalhe,
  loja: Loja | null | undefined,
  marcas: MarcasPdf,
  resumo: { preenchidos: number; total: number; valor: number; divergencias: number },
  modo: ModoRelatorioContagem,
): number {
  const estrutura = modo === 'estrutura';
  const titulo = estrutura
    ? `Modelo — ${rotuloTipoRelatorio(contagem.tipo)}`
    : rotuloTipoRelatorio(contagem.tipo);
  const headerH = 26;
  setFill(doc, INK);
  doc.rect(0, 0, PAGE_W, headerH, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, headerH, PAGE_W, 0.9, 'F');

  if (!desenharMarcas(doc, marcas, MARGIN, 5.5, 15)) desenharMarcaTexto(doc, MARGIN, 15);

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
  doc.text(clipTexto(doc, lojaTxt, 160), PAGE_W - MARGIN, 21.2, { align: 'right' });

  let y = 32;
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
  return desenharLegenda(doc, y);
}

function desenharLegenda(doc: jsPDF, y: number) {
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

function desenharCabecalhoTabela(doc: jsPDF, y: number, contabil = false): number {
  const h = 6.2;
  setFill(doc, HEADER_BG);
  doc.rect(MARGIN, y, CONTENT_W, h, 'F');
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + h, MARGIN + CONTENT_W, y + h);

  const headers: Array<{ t: string; w: number; align: 'left' | 'right' | 'center' }> = contabil
    ? [
        { t: 'ITEM', w: COLS_CONTABIL.item, align: 'left' },
        { t: 'UND', w: COLS_CONTABIL.und, align: 'center' },
        { t: 'QTD CONTADA', w: COLS_CONTABIL.qtd, align: 'right' },
        { t: 'VALOR UNIT.', w: COLS_CONTABIL.unit, align: 'right' },
        { t: 'VALOR DO ESTOQUE', w: COLS_CONTABIL.valor, align: 'right' },
      ]
    : [
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
  _rowH: number,
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
  const align = opts.align ?? 'left';
  let size = opts.size ?? 7;
  const cru = pdfTxt(texto);
  const maxW = w - 3.2;
  doc.setFontSize(size);
  if (align === 'left') {
    while (size > 5.5 && doc.getTextWidth(cru) > maxW) {
      size -= 0.15;
      doc.setFontSize(size);
    }
  }
  setText(doc, opts.color ?? SLATE);
  const tx = align === 'left' ? x + 2 : align === 'right' ? x + w - 2 : x + w / 2;
  const clipped = doc.splitTextToSize(cru, maxW);
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
    doc.setFont('helvetica', 'bold');
    setText(doc, ACCENT);
    doc.text('Meridian', MARGIN, FOOTER_Y);
    const wMarca = doc.getTextWidth('Meridian');
    doc.setFont('helvetica', 'normal');
    setText(doc, SLATE_LIGHT);
    doc.text(`  ·  ${tipoLabel}`, MARGIN + wMarca, FOOTER_Y);
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
  const lojaTxt = rotuloLojaPdf(contagem, loja);
  doc.setProperties({
    title: `${tipoLabel} · ${lojaTxt}`,
    author: 'Meridian',
    subject: 'Relatório de contagem de estoque',
  });
  const marcas = await carregarMarcas();
  const resumo = {
    preenchidos,
    total: itens.length,
    valor,
    divergencias,
  };
  let y: number;
  const valorPorSecao = new Map<string, number>();
  if (!estrutura) {
    for (const item of itens) {
      const nome = nomeSecao(item);
      valorPorSecao.set(nome, (valorPorSecao.get(nome) || 0) + (item.valor_estoque ?? 0));
    }
    desenharCapa(doc, contagem, loja, marcas, itens, resumo);
    doc.addPage();
    y = faixaMarca(doc, marcas, tipoLabel, lojaTxt, 16);
  } else {
    y = cabecalho(doc, contagem, loja, marcas, resumo, modo);
  }

  y = desenharCabecalhoTabela(doc, y, !estrutura);
  const rowH = 5.6;
  let secaoAtual = '';
  let quebrou = false;
  const abrirTabela = () => {
    const topo = estrutura ? MARGIN + 1 : faixaMarca(doc, marcas, tipoLabel, lojaTxt, 14);
    return desenharCabecalhoTabela(doc, topo, !estrutura);
  };
  const garantir = (atual: number, need: number) => {
    if (atual + need <= CONTENT_BOTTOM) {
      quebrou = false;
      return atual;
    }
    doc.addPage();
    quebrou = true;
    return abrirTabela();
  };
  const faixaSecao = (yy: number, nome: string, continua: boolean) => {
    setFill(doc, SECAO_BG);
    doc.rect(MARGIN, yy, CONTENT_W, rowH, 'F');
    setFill(doc, ACCENT);
    doc.rect(MARGIN, yy, 1.6, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(doc, [255, 255, 255]);
    const nSecao = itens.filter((item) => nomeSecao(item) === nome).length;
    doc.text(
      clipTexto(doc, `${nome.toUpperCase()}${continua ? '  ·  continua' : ''}`, CONTENT_W - 52),
      MARGIN + 4,
      yy + 3.8,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 195, 220);
    const direitaSecao = estrutura
      ? `${nSecao} item(ns)`
      : fmtBrl(valorPorSecao.get(nome) || 0);
    doc.text(direitaSecao, PAGE_W - MARGIN - 3, yy + 3.8, { align: 'right' });
    return yy + rowH;
  };

  for (let idx = 0; idx < itens.length; idx++) {
    const i = itens[idx];
    const secao = nomeSecao(i);
    if (secao !== secaoAtual) {
      y = garantir(y, rowH * 2);
      y = faixaSecao(y, secao, quebrou);
      secaoAtual = secao;
    }

    y = garantir(y, rowH);
    if (quebrou) y = faixaSecao(y, secao, true);

    const preenchido = !estrutura && i.estoque_contado != null;
    const zebra = idx % 2 === 1;
    if (zebra) {
      setFill(doc, ROW_ALT);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }

    const nome = i.codigo ? `${i.codigo}  ${i.descricao}` : i.descricao;
    const baseline = y + 3.8;
    let x = MARGIN;
    if (!estrutura) {
      const semValor = !(Number(i.valor_estoque) > 0);
      celula(doc, x, baseline, COLS_CONTABIL.item, nome, { bold: true, color: NAVY, size: 7.2 });
      x += COLS_CONTABIL.item;
      celula(doc, x, baseline, COLS_CONTABIL.und, i.unidade_contagem || '—', {
        align: 'center',
        size: 6.5,
      });
      x += COLS_CONTABIL.und;
      celula(doc, x, baseline, COLS_CONTABIL.qtd, fmtNum(i.estoque_contado, 3), {
        align: 'right',
        bold: preenchido,
        color: NAVY,
      });
      x += COLS_CONTABIL.qtd;
      celula(doc, x, baseline, COLS_CONTABIL.unit, fmtBrl(i.valor_unidade), {
        align: 'right',
        color: Number(i.valor_unidade) > 0 ? SLATE : MUTED,
      });
      x += COLS_CONTABIL.unit;
      celula(doc, x, baseline, COLS_CONTABIL.valor, fmtBrl(i.valor_estoque), {
        align: 'right',
        bold: !semValor,
        color: semValor ? MUTED : NAVY,
      });
    } else {
      const permiteCx = i.permite_contagem_caixa !== false;
      const permitePc = i.permite_contagem_pc_fd !== false;
      const permiteKg = i.permite_contagem_kg_und !== false;
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
      campoContagem(doc, x, y, baseline, COLS.qtd, rowH, '—', {
        estrutura,
        bloqueado: false,
        align: 'center',
      });
      x += COLS.qtd;
      celula(doc, x, baseline, COLS.sist, fmtNum(i.estoque_sistema, 3), { align: 'center' });
      x += COLS.sist;
      celula(doc, x, baseline, COLS.dif, '—', { align: 'center', color: MUTED });
      x += COLS.dif;
      celula(doc, x, baseline, COLS.valor, '—', { align: 'right', color: MUTED });
    }

    setStroke(doc, LINE);
    doc.setLineWidth(0.12);
    doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
    y += rowH;
  }

  if (y + 8 > CONTENT_BOTTOM) {
    doc.addPage();
    y = estrutura ? MARGIN + 4 : faixaMarca(doc, marcas, tipoLabel, lojaTxt, 14);
  }
  setFill(doc, INK);
  doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, [255, 255, 255]);
  doc.text(
    estrutura
      ? `MODELO  ·  ${itens.length} itens`
      : `TOTAL DO ESTOQUE  ·  ${preenchidos} itens`,
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
