import { jsPDF } from 'jspdf';
import type { NcItem } from '../api/client';
import { assetUrl } from '../config/paths';

const MARGIN = 12;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 10;

const BLACK = [0, 0, 0] as const;
const INK = [6, 10, 18] as const;
const CARD = [12, 18, 32] as const;
const BLUE = [0, 132, 255] as const;
const BLUE_SOFT = [120, 180, 255] as const;
const WHITE = [255, 255, 255] as const;
const MUTED = [148, 163, 184] as const;
const FAIL = [255, 90, 90] as const;
const OK = [52, 211, 153] as const;

type Rgb = readonly [number, number, number];

export type PdfNcTotais = {
  titulo: string;
};

type LinhaLoja = {
  loja: string;
  abertas: number;
  criticas: number;
  fechadas: number;
  quem: Map<string, number>;
};

type Marca = { dataUrl: string; fmt: 'JPEG' | 'PNG' };

function fill(doc: jsPDF, c: Rgb) {
  doc.setFillColor(c[0], c[1], c[2]);
}

function text(doc: jsPDF, c: Rgb) {
  doc.setTextColor(c[0], c[1], c[2]);
}

async function carregarMarca(): Promise<Marca | null> {
  try {
    const res = await fetch(assetUrl('meridian-mark-m.jpg'));
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { dataUrl, fmt: 'JPEG' };
  } catch {
    return null;
  }
}

function resumir(itens: NcItem[]): LinhaLoja[] {
  const mapa = new Map<string, LinhaLoja>();
  for (const nc of itens) {
    const loja = nc.name?.trim() || 'Loja';
    const linha = mapa.get(loja) || { loja, abertas: 0, criticas: 0, fechadas: 0, quem: new Map() };
    if (nc.status === 'Resolvida') {
      linha.fechadas += 1;
      const quem = nc.nome_resolvido_por?.trim() || 'Não informado';
      linha.quem.set(quem, (linha.quem.get(quem) || 0) + 1);
    } else {
      linha.abertas += 1;
    }
    if (nc.gravidade === 'Crítica' && nc.status !== 'Resolvida') linha.criticas += 1;
    mapa.set(loja, linha);
  }
  return [...mapa.values()];
}

function quemTexto(quem: Map<string, number>, max = 3) {
  const lista = [...quem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  const topo = lista.slice(0, max).map(([nome, qtd]) => `${nome} ${qtd}`);
  const resto = lista.length - topo.length;
  return resto > 0 ? `${topo.join(' · ')} · +${resto}` : topo.join(' · ');
}

function fundo(doc: jsPDF) {
  fill(doc, BLACK);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
}

function rodape(doc: jsPDF) {
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    text(doc, WHITE);
    const w = doc.getTextWidth('MERIDIAN');
    doc.text('MERIDIAN', MARGIN, FOOTER_Y);
    doc.setFont('helvetica', 'normal');
    text(doc, MUTED);
    doc.text('  ·  Resumo de não conformidades', MARGIN + w, FOOTER_Y);
    doc.text(`${i} / ${total}  ·  ${gerado}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

function capa(doc: jsPDF, marca: Marca | null, titulo: string) {
  if (marca) doc.addImage(marca.dataUrl, marca.fmt, MARGIN - 2, 4, 26, 26);
  const tx = MARGIN + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  text(doc, WHITE);
  doc.text('MERIDIAN', tx, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  text(doc, BLUE_SOFT);
  doc.text('GESTÃO OPERACIONAL', tx, 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  text(doc, WHITE);
  doc.text('RESUMO', PAGE_W - MARGIN, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  text(doc, BLUE_SOFT);
  const linhas = doc.splitTextToSize(titulo, 78) as string[];
  doc.text(linhas.slice(0, 2), PAGE_W - MARGIN, 18, { align: 'right' });
  fill(doc, BLUE);
  doc.rect(0, 34, PAGE_W, 1.1, 'F');
}

function kpis(doc: jsPDF, y: number, valores: { label: string; value: string }[]) {
  const gap = 3;
  const cardW = (CONTENT_W - gap * (valores.length - 1)) / valores.length;
  valores.forEach((c, i) => {
    const x = MARGIN + i * (cardW + gap);
    fill(doc, CARD);
    doc.roundedRect(x, y, cardW, 16, 1.4, 1.4, 'F');
    fill(doc, BLUE);
    doc.rect(x, y, 1.4, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    text(doc, BLUE_SOFT);
    doc.text(c.label, x + 5, y + 6);
    doc.setFontSize(13);
    text(doc, WHITE);
    doc.text(c.value, x + 5, y + 12.2);
  });
  return y + 22;
}

function legenda(doc: jsPDF, y: number) {
  const itens: { cor: Rgb; label: string }[] = [
    { cor: BLUE, label: 'Em aberto' },
    { cor: OK, label: 'Fechados' },
    { cor: FAIL, label: 'Críticas' },
  ];
  let x = MARGIN;
  itens.forEach((item) => {
    fill(doc, item.cor);
    doc.roundedRect(x, y - 2.2, 6, 2.4, 0.4, 0.4, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    text(doc, MUTED);
    doc.text(item.label, x + 8, y);
    x += doc.getTextWidth(item.label) + 16;
  });
  return y + 5;
}

function graficoLojas(doc: jsPDF, y: number, linhas: LinhaLoja[], modo: 'mix' | 'fechado') {
  const labelW = 62;
  const numW = 22;
  const barW = CONTENT_W - labelW - numW;
  const rowH = 6.6;
  const max = Math.max(
    1,
    ...linhas.map((l) => (modo === 'fechado' ? l.fechadas : l.abertas + l.fechadas)),
  );

  linhas.forEach((linha) => {
    if (y + rowH > FOOTER_Y - 8) {
      doc.addPage();
      fundo(doc);
      y = MARGIN;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    text(doc, WHITE);
    const nome = (doc.splitTextToSize(linha.loja, labelW - 3) as string[])[0] || linha.loja;
    doc.text(nome, MARGIN, y + 4);

    const x = MARGIN + labelW;
    fill(doc, CARD);
    doc.roundedRect(x, y + 1.1, barW, 3.6, 0.6, 0.6, 'F');

    if (modo === 'mix') {
      const wAberto = (linha.abertas / max) * barW;
      const wFechado = (linha.fechadas / max) * barW;
      if (wAberto > 0.4) {
        fill(doc, BLUE);
        doc.rect(x, y + 1.1, wAberto, 3.6, 'F');
      }
      if (wFechado > 0.4) {
        fill(doc, OK);
        doc.rect(x + wAberto, y + 1.1, wFechado, 3.6, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      text(doc, linha.criticas > 0 ? FAIL : MUTED);
      doc.text(linha.criticas > 0 ? `${linha.criticas} crit.` : String(linha.abertas + linha.fechadas), PAGE_W - MARGIN, y + 4, {
        align: 'right',
      });
    } else {
      const w = (linha.fechadas / max) * barW;
      if (w > 0.4) {
        fill(doc, OK);
        doc.roundedRect(x, y + 1.1, Math.max(w, 1.2), 3.6, 0.6, 0.6, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      text(doc, OK);
      doc.text(String(linha.fechadas), PAGE_W - MARGIN, y + 4.2, { align: 'right' });
    }
    y += rowH;
  });
  return y;
}

function tabelaFechados(doc: jsPDF, y: number, linhas: LinhaLoja[]) {
  const cols = [78, 22, CONTENT_W - 100];
  const desenharTopo = (yy: number) => {
    fill(doc, CARD);
    doc.rect(MARGIN, yy, CONTENT_W, 7, 'F');
    fill(doc, OK);
    doc.rect(MARGIN, yy + 6.5, CONTENT_W, 0.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    text(doc, BLUE_SOFT);
    doc.text('LOJA', MARGIN + 3, yy + 4.6);
    doc.text('FECHADOS', MARGIN + cols[0] + cols[1] - 2, yy + 4.6, { align: 'right' });
    doc.text('QUEM FECHOU', MARGIN + cols[0] + cols[1] + 3, yy + 4.6);
    return yy + 7;
  };

  y = desenharTopo(y);
  linhas.forEach((linha) => {
    const quem = quemTexto(linha.quem);
    const quemLinhas = doc.splitTextToSize(quem || '—', cols[2] - 6) as string[];
    const h = Math.max(7.2, quemLinhas.length * 3.4 + 3);
    if (y + h > FOOTER_Y - 8) {
      doc.addPage();
      fundo(doc);
      y = desenharTopo(MARGIN);
    }
    fill(doc, INK);
    doc.rect(MARGIN, y, CONTENT_W, h, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    text(doc, WHITE);
    const nome = (doc.splitTextToSize(linha.loja, cols[0] - 6) as string[])[0] || linha.loja;
    doc.text(nome, MARGIN + 3, y + 4.6);
    text(doc, OK);
    doc.text(String(linha.fechadas), MARGIN + cols[0] + cols[1] - 2, y + 4.6, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    text(doc, MUTED);
    doc.text(quemLinhas, MARGIN + cols[0] + cols[1] + 3, y + 4.6);
    y += h;
  });
  return y;
}

export async function gerarPdfNaoConformidades(itens: NcItem[], totais: PdfNcTotais) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marca = await carregarMarca();
  const linhas = resumir(itens);
  const abertos = linhas.reduce((s, l) => s + l.abertas, 0);
  const criticas = linhas.reduce((s, l) => s + l.criticas, 0);
  const fechados = linhas.reduce((s, l) => s + l.fechadas, 0);
  const porVolume = [...linhas].sort(
    (a, b) => b.abertas + b.fechadas - (a.abertas + a.fechadas) || b.criticas - a.criticas || a.loja.localeCompare(b.loja, 'pt-BR'),
  );
  const porFechado = linhas
    .filter((l) => l.fechadas > 0)
    .sort((a, b) => b.fechadas - a.fechadas || a.loja.localeCompare(b.loja, 'pt-BR'));

  fundo(doc);
  capa(doc, marca, totais.titulo);
  let y = kpis(doc, 40, [
    { label: 'LOJAS', value: String(linhas.length) },
    { label: 'EM ABERTO', value: String(abertos) },
    { label: 'CRÍTICAS', value: String(criticas) },
    { label: 'FECHADOS', value: String(fechados) },
  ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  text(doc, WHITE);
  doc.text('EM ABERTO E FECHADOS POR LOJA', MARGIN, y);
  y = legenda(doc, y + 5);
  if (porVolume.length) y = graficoLojas(doc, y, porVolume, 'mix');
  else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    text(doc, MUTED);
    doc.text('Nenhuma loja neste filtro.', MARGIN, y + 4);
  }

  doc.addPage();
  fundo(doc);
  y = MARGIN + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  text(doc, WHITE);
  doc.text('LOJAS QUE FECHARAM', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  text(doc, MUTED);
  doc.text(
    porFechado.length
      ? `${porFechado.length} loja${porFechado.length === 1 ? '' : 's'} · ${fechados} NCs fechadas`
      : 'Nenhuma loja fechou NC neste recorte.',
    MARGIN,
    y + 5,
  );
  y += 10;

  if (porFechado.length) {
    y = graficoLojas(doc, y, porFechado, 'fechado');
    y += 4;
    if (y > FOOTER_Y - 24) {
      doc.addPage();
      fundo(doc);
      y = MARGIN;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    text(doc, WHITE);
    doc.text('QUEM FECHOU', MARGIN, y);
    y += 4;
    tabelaFechados(doc, y, porFechado);
  }

  rodape(doc);
  doc.save(`resumo-nao-conformidades-${new Date().toISOString().slice(0, 10)}.pdf`);
}
