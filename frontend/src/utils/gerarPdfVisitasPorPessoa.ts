import { jsPDF } from 'jspdf';
import type { VisitaResumo } from '../api/client';
import { fmtData, fmtNota } from '../api/client';
import { assetUrl } from '../config/paths';

const MARGIN = 12;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 9;
const CONTENT_BOTTOM = FOOTER_Y - 4;

const NAVY = [11, 26, 59] as const;
const NAVY_MID = [27, 42, 107] as const;
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

type Rgb = readonly [number, number, number];
type LogoIcon = { dataUrl: string; w: number; h: number };

function setFill(doc: jsPDF, c: Rgb) {
  doc.setFillColor(c[0], c[1], c[2]);
}

function setStroke(doc: jsPDF, c: Rgb) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

function setText(doc: jsPDF, c: Rgb) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function novaPagina(doc: jsPDF): number {
  doc.addPage();
  return MARGIN + 1;
}

function garantirEspaco(doc: jsPDF, y: number, need: number): number {
  if (y + need > CONTENT_BOTTOM) return novaPagina(doc);
  return y;
}

function corNota(nota: number): Rgb {
  if (nota >= 85) return OK;
  if (nota >= 75) return ACCENT;
  return FAIL;
}

function mediaNotas(visitas: VisitaResumo[]): number | null {
  const vals = visitas
    .map((v) => (v.nota_final == null ? NaN : Number(v.nota_final)))
    .filter((n) => Number.isFinite(n));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40);
}

async function carregarIconeMarca(): Promise<LogoIcon | null> {
  try {
    const res = await fetch(assetUrl('favicon-32x32.png'));
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { dataUrl, w: 7, h: 7 };
  } catch {
    return null;
  }
}

function rodape(doc: jsPDF, nomePessoa: string, tipoChecklist: string) {
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
    doc.setLineWidth(0.2);
    doc.line(MARGIN, FOOTER_Y - 2.5, PAGE_W - MARGIN, FOOTER_Y - 2.5);
    setText(doc, MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      `${tipoChecklist} · ${nomePessoa} · gerado em ${gerado}`,
      MARGIN,
      FOOTER_Y,
    );
    doc.text(`${i}/${total}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

export type RelatorioVisitasPorPessoaOpts = {
  nomePessoa: string;
  tipoChecklistNome: string;
  tipoChecklistCodigo?: string;
  visitas: VisitaResumo[];
};

/** PDF resumo de um único tipo de checklist, notas em ordem decrescente. */
export async function gerarPdfVisitasPorPessoa(opts: RelatorioVisitasPorPessoaOpts): Promise<void> {
  const visitas = [...opts.visitas].sort((a, b) => {
    const na = a.nota_final == null ? -1 : Number(a.nota_final);
    const nb = b.nota_final == null ? -1 : Number(b.nota_final);
    if (nb !== na) return nb - na;
    return String(b.data_visita).localeCompare(String(a.data_visita));
  });

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logo = await carregarIconeMarca();
  let y = MARGIN;

  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 28, 'F');
  if (logo) {
    doc.addImage(logo.dataUrl, 'PNG', MARGIN, 8, logo.w, logo.h);
  }
  setText(doc, GRUPO_TXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('grupo', MARGIN + (logo ? logo.w + 2 : 0), 11.5);
  setText(doc, ACCENT);
  doc.text('alvim', MARGIN + (logo ? logo.w + 2 : 0) + doc.getTextWidth('grupo'), 11.5);

  setText(doc, [255, 255, 255]);
  doc.setFontSize(13);
  doc.text('RELATÓRIO DE VISITAS POR PESSOA', MARGIN, 19.5);
  setText(doc, SLATE_LIGHT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${opts.tipoChecklistNome} · notas em ordem decrescente`, MARGIN, 25);

  y = 34;
  setText(doc, NAVY_MID);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(opts.nomePessoa, MARGIN, y);
  y += 5.5;

  setText(doc, ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(opts.tipoChecklistNome, MARGIN, y);
  y += 6;

  const media = mediaNotas(visitas);
  setText(doc, SLATE);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const resumo = [
    `${visitas.length} visita(s)`,
    media != null ? `média ${fmtNota(media)}` : 'sem notas',
  ].join(' · ');
  doc.text(resumo, MARGIN, y);
  y += 8;

  const cols = {
    pos: MARGIN,
    loja: MARGIN + 10,
    data: MARGIN + 118,
    nota: PAGE_W - MARGIN,
  };
  const rowH = 7;

  const desenharCabecalho = () => {
    setFill(doc, HEADER_BG);
    doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    setText(doc, MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('#', cols.pos, y + 4.6);
    doc.text('Loja', cols.loja, y + 4.6);
    doc.text('Data', cols.data, y + 4.6);
    doc.text('Nota', cols.nota, y + 4.6, { align: 'right' });
    y += rowH;
  };

  desenharCabecalho();

  visitas.forEach((v, idx) => {
    y = garantirEspaco(doc, y, rowH + 1);
    if (y === MARGIN + 1) desenharCabecalho();

    if (idx % 2 === 1) {
      setFill(doc, ROW_ALT);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }

    const notaNum = v.nota_final == null ? null : Number(v.nota_final);
    setText(doc, SLATE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(String(idx + 1), cols.pos, y + 4.6);

    const lojaTxt = doc.splitTextToSize(
      `${v.name}${v.bk_number ? ` (BKN ${v.bk_number})` : ''}`,
      100,
    )[0] as string;
    doc.text(lojaTxt, cols.loja, y + 4.6);
    doc.text(fmtData(v.data_visita), cols.data, y + 4.6);

    if (notaNum != null && Number.isFinite(notaNum)) {
      setText(doc, corNota(notaNum));
      doc.setFont('helvetica', 'bold');
      doc.text(fmtNota(notaNum), cols.nota, y + 4.6, { align: 'right' });
    } else {
      setText(doc, MUTED);
      doc.text('—', cols.nota, y + 4.6, { align: 'right' });
    }
    y += rowH;
  });

  if (!visitas.length) {
    setText(doc, MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Nenhuma visita encontrada para este checklist.', MARGIN, y + 4);
  }

  rodape(doc, opts.nomePessoa, opts.tipoChecklistNome);
  const slugPessoa = slugify(opts.nomePessoa);
  const slugTipo = slugify(opts.tipoChecklistCodigo || opts.tipoChecklistNome);
  doc.save(`visitas-${slugTipo || 'checklist'}-${slugPessoa || 'pessoa'}.pdf`);
}
