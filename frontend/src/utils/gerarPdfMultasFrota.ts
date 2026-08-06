import { jsPDF } from 'jspdf';
import type { FrotaMultaDetran } from '../api/client';
import { assetUrl } from '../config/paths';

const MARGIN = 11;
const PAGE_W = 297;
const PAGE_H = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 8;
const CONTENT_BOTTOM = FOOTER_Y - 4;

const NAVY = [11, 26, 59] as const;
const ACCENT = [232, 82, 10] as const;
const SLATE = [71, 85, 105] as const;
const SLATE_LIGHT = [148, 163, 184] as const;
const LINE = [226, 232, 240] as const;
const ROW_ALT = [248, 250, 252] as const;
const HEADER_BG = [241, 245, 249] as const;
const MUTED = [100, 116, 139] as const;
const TOTAL_BG = [11, 26, 59] as const;
const OK = [21, 128, 61] as const;
const FAIL = [185, 28, 28] as const;
const OPEN = [2, 136, 209] as const;
const GRAVE = [230, 81, 0] as const;
const GRAVISSIMA = [183, 28, 28] as const;
const MEDIA = [245, 127, 23] as const;
const LEVE = [46, 125, 50] as const;

type Rgb = readonly [number, number, number];
type LogoIcon = { dataUrl: string; w: number; h: number };

export type MultasRelatorioFiltros = {
  veiculoLabel?: string | null;
  dataInicio?: string | null;
  dataFim?: string | null;
};

function pdfTxt(valor: string): string {
  return valor.replace(/\u2014/g, '-').replace(/\u00a0/g, ' ');
}

function setFill(doc: jsPDF, c: Rgb) {
  doc.setFillColor(c[0], c[1], c[2]);
}

function setStroke(doc: jsPDF, c: Rgb) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

function setText(doc: jsPDF, c: Rgb) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function fmtMoeda(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function fmtData(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = String(d).slice(0, 10).split('-');
  if (!y || !m || !day) return String(d);
  return `${day}/${m}/${y}`;
}

function fmtDataHora(d: string | null | undefined, h?: string | null): string {
  const data = fmtData(d);
  if (data === '—') return '—';
  const hora = h?.trim().slice(0, 5) || '00:00';
  return `${data} ${hora}`;
}

function placaModelo(m: FrotaMultaDetran): string {
  return m.modelo ? `${m.placa} - ${m.modelo}` : m.placa;
}

/** Carrega imagem em alta resolução para o PDF (evita reamostrar para baixo). */
async function carregarLogoParaPdf(
  nomeArquivo: string,
  opts?: { removerFundoClaro?: boolean },
): Promise<LogoIcon | null> {
  try {
    const res = await fetch(assetUrl(nomeArquivo));
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrlOrig = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('logo'));
      el.src = dataUrlOrig;
    });

    const maxEdge = Math.max(img.naturalWidth, img.naturalHeight);
    // Mantém resolução alta (≥1200 no maior lado) para texto fino nítido em A4
    const scale = maxEdge < 1200 ? 1200 / maxEdge : 1;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: dataUrlOrig, w: img.naturalWidth, h: img.naturalHeight };

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    if (opts?.removerFundoClaro) {
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        // Fundo off-white / cinza claro → transparente (cabeçalho navy)
        if (r > 230 && g > 230 && b > 230) {
          d[i + 3] = 0;
        } else if (r > 200 && g > 200 && b > 200) {
          const t = Math.min(r, g, b);
          d[i + 3] = Math.round(((255 - t) / 55) * 255);
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    return { dataUrl: canvas.toDataURL('image/png'), w, h };
  } catch {
    return null;
  }
}

function rodape(doc: jsPDF, periodoLabel: string) {
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
    doc.text('  ·  CIGA / Frota', MARGIN + wGrupo + doc.getTextWidth('alvim'), FOOTER_Y);

    doc.text(periodoLabel, PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text(`${i} / ${total}  ·  ${gerado}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

function garantirEspaco(doc: jsPDF, y: number, need: number): number {
  if (y + need > CONTENT_BOTTOM) {
    doc.addPage();
    return MARGIN + 1;
  }
  return y;
}

function rotuloFiltros(filtros: MultasRelatorioFiltros): string {
  const partes: string[] = [];
  if (filtros.veiculoLabel) partes.push(filtros.veiculoLabel);
  if (filtros.dataInicio || filtros.dataFim) {
    partes.push(`${fmtData(filtros.dataInicio || null)} — ${fmtData(filtros.dataFim || null)}`);
  }
  return partes.length ? partes.join(' · ') : 'Todos os veículos';
}

function statusEfetivo(m: FrotaMultaDetran, hoje: string): string {
  if (m.status === 'Paga') return 'Paga';
  if (m.status === 'Vencida') return 'Vencida';
  if (m.data_vencimento) {
    const venc = String(m.data_vencimento).slice(0, 10);
    if (venc && venc < hoje) return 'Vencida';
  }
  return m.status || 'Em Aberto';
}

function corStatus(status: string): Rgb {
  if (status === 'Paga') return OK;
  if (status === 'Vencida') return FAIL;
  return OPEN;
}

function corGravidade(natureza?: string | null): Rgb {
  const n = String(natureza || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/gravissima/.test(n)) return GRAVISSIMA;
  if (/grave/.test(n)) return GRAVE;
  if (/media/.test(n)) return MEDIA;
  if (/leve/.test(n)) return LEVE;
  return NAVY;
}

function desenharCards(
  doc: jsPDF,
  y: number,
  cards: Array<{ label: string; value: string; hint: string; destaque?: boolean }>,
): number {
  const gap = 2.2;
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const cardH = 15.5;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const x = MARGIN + i * (cardW + gap);
    const isLast = Boolean(c.destaque);

    if (isLast) {
      setFill(doc, TOTAL_BG);
      doc.roundedRect(x, y, cardW, cardH, 1, 1, 'F');
      setFill(doc, ACCENT);
      doc.rect(x, y, 1.3, cardH, 'F');
      setText(doc, [160, 176, 200]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(c.label, x + 4.5, y + 4.2);
      setText(doc, [255, 255, 255]);
      doc.setFontSize(10.5);
      doc.text(c.value, x + 4.5, y + 9.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      setText(doc, SLATE_LIGHT);
      doc.text(c.hint, x + 4.5, y + 13.2);
    } else {
      setFill(doc, [255, 255, 255]);
      setStroke(doc, LINE);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, cardW, cardH, 1, 1, 'FD');
      setFill(doc, NAVY);
      doc.rect(x, y, 1.3, cardH, 'F');
      setText(doc, SLATE_LIGHT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(c.label, x + 4.5, y + 4.2);
      setText(doc, NAVY);
      doc.setFontSize(11);
      doc.text(c.value, x + 4.5, y + 9.8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      setText(doc, MUTED);
      doc.text(c.hint, x + 4.5, y + 13.2);
    }
  }

  return y + cardH + 5;
}

/**
 * Relatório de multas DETRAN-DF no padrão visual do PDF de metas,
 * com logos CIGA + Grupo Alvim (Logo_Alvim_Icone.png).
 */
export async function gerarPdfMultasFrota(
  multas: FrotaMultaDetran[],
  filtros: MultasRelatorioFiltros = {},
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const [logoCiga, logoAlvim] = await Promise.all([
    carregarLogoParaPdf('CIGA.png'),
    carregarLogoParaPdf('Logo_Alvim_Icone.png'),
  ]);

  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 30, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, 30, PAGE_W, 0.9, 'F');

  let logoX = MARGIN;
  if (logoCiga) {
    // Maior no cabeçalho para o texto fino do CIGA ficar legível em A4
    const cigaH = 26;
    const cigaW = Math.min((logoCiga.w / Math.max(logoCiga.h, 1)) * cigaH, 78);
    const cigaY = (30 - cigaH) / 2;
    doc.addImage(logoCiga.dataUrl, 'PNG', logoX, cigaY, cigaW, cigaH, undefined, 'NONE');
    logoX += cigaW + 5;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    setText(doc, [255, 255, 255]);
    doc.text('CIGA', MARGIN, 18);
    logoX += 28;
  }

  if (logoAlvim) {
    const alvimSize = 22;
    const alvimY = (30 - alvimSize) / 2;
    doc.addImage(logoAlvim.dataUrl, 'PNG', logoX, alvimY, alvimSize, alvimSize, undefined, 'NONE');
  }

  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('RELATÓRIO CONFIDENCIAL', PAGE_W - MARGIN, 11, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Relatório de Multas', PAGE_W - MARGIN, 18.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 220);
  doc.text(rotuloFiltros(filtros), PAGE_W - MARGIN, 25, { align: 'right' });

  let y = 36;

  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const qtdVeiculos = new Set(multas.map((m) => m.id_veiculo || m.placa)).size;
  const emAberto = multas.filter((m) => statusEfetivo(m, hoje) === 'Em Aberto').length;
  const pagas = multas.filter((m) => statusEfetivo(m, hoje) === 'Paga').length;
  const vencidas = multas.filter((m) => statusEfetivo(m, hoje) === 'Vencida').length;
  const totalValor = multas.reduce((s, m) => s + (m.valor ?? 0), 0);

  y = desenharCards(doc, y, [
    { label: 'VEÍCULOS', value: String(qtdVeiculos), hint: 'com multas' },
    { label: 'EM ABERTO', value: String(emAberto), hint: 'pendentes' },
    { label: 'PAGAS', value: String(pagas), hint: 'quitadas' },
    { label: 'VENCIDAS', value: String(vencidas), hint: 'atrasadas' },
    { label: 'VALOR TOTAL', value: pdfTxt(fmtMoeda(totalValor)), hint: 'soma das multas', destaque: true },
  ]);

  setFill(doc, NAVY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 7.5, 0.8, 0.8, 'F');
  setFill(doc, ACCENT);
  doc.rect(MARGIN, y, 2, 7.5, 'F');
  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('MULTAS DETRAN-DF', MARGIN + 5.5, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 195, 220);
  doc.text(`${multas.length} registro(s)`, PAGE_W - MARGIN - 3, y + 5, { align: 'right' });
  y += 9.5;

  const cols = [
    { key: 'placa', label: 'PLACA', w: 40, headerAlign: 'left' as const, cellAlign: 'left' as const },
    { key: 'auto', label: 'Nº DO AUTO', w: 26, headerAlign: 'left' as const, cellAlign: 'left' as const },
    { key: 'data', label: 'DATA DA INFRAÇÃO', w: 32, headerAlign: 'center' as const, cellAlign: 'center' as const },
    { key: 'natureza', label: 'GRAVIDADE', w: 24, headerAlign: 'center' as const, cellAlign: 'center' as const },
    { key: 'valor', label: 'VALOR', w: 24, headerAlign: 'center' as const, cellAlign: 'center' as const },
    { key: 'venc', label: 'VENCIMENTO', w: 24, headerAlign: 'center' as const, cellAlign: 'center' as const },
    { key: 'status', label: 'STATUS', w: 22, headerAlign: 'center' as const, cellAlign: 'center' as const },
    {
      key: 'desc',
      label: 'DESCRIÇÃO',
      w: CONTENT_W - 40 - 26 - 32 - 24 - 24 - 24 - 22,
      headerAlign: 'center' as const,
      cellAlign: 'center' as const,
    },
  ];

  const rowH = 7;
  const headerH = 7.2;

  const desenharHeader = (yy: number) => {
    setFill(doc, HEADER_BG);
    doc.rect(MARGIN, yy, CONTENT_W, headerH, 'F');
    setStroke(doc, LINE);
    doc.setLineWidth(0.2);
    doc.rect(MARGIN, yy, CONTENT_W, headerH, 'S');
    setFill(doc, NAVY);
    doc.rect(MARGIN, yy, 1.2, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    setText(doc, SLATE);
    let x = MARGIN + 3;
    for (const col of cols) {
      if (col.headerAlign === 'center') {
        doc.text(col.label, x + col.w / 2 - 1.5, yy + 4.8, { align: 'center' });
      } else {
        doc.text(col.label, x, yy + 4.8);
      }
      x += col.w;
    }
    return yy + headerH;
  };

  y = desenharHeader(y);

  if (multas.length === 0) {
    y = garantirEspaco(doc, y, 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(doc, MUTED);
    doc.text('Nenhuma multa encontrada para o filtro selecionado.', MARGIN + 3, y + 8);
  } else {
    for (let i = 0; i < multas.length; i++) {
      const m = multas[i];
      y = garantirEspaco(doc, y, rowH + 1);
      if (y === MARGIN + 1) y = desenharHeader(y);

      if (i % 2 === 1) {
        setFill(doc, ROW_ALT);
        doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      }

      const st = statusEfetivo(m, hoje);
      const cells = [
        { txt: pdfTxt(placaModelo(m)).slice(0, 34), color: NAVY as Rgb },
        { txt: pdfTxt(m.auto || '—').slice(0, 16), color: NAVY as Rgb },
        { txt: fmtDataHora(m.data_multa, m.hora_multa), color: NAVY as Rgb },
        { txt: pdfTxt(m.natureza || '—').slice(0, 14), color: corGravidade(m.natureza) },
        { txt: pdfTxt(fmtMoeda(m.valor)), color: NAVY as Rgb },
        { txt: fmtData(m.data_vencimento), color: NAVY as Rgb },
        { txt: pdfTxt(st), color: corStatus(st) },
        { txt: pdfTxt(m.descricao || '—'), color: NAVY as Rgb },
      ];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      let x = MARGIN + 3;
      cells.forEach((cell, ci) => {
        const col = cols[ci];
        const lines = doc.splitTextToSize(cell.txt, col.w - 2.5);
        const line = lines.slice(0, 1);
        setText(doc, cell.color);
        if (col.cellAlign === 'center') {
          doc.text(line, x + col.w / 2 - 1.5, y + 4.6, { align: 'center' });
        } else {
          doc.text(line, x, y + 4.6);
        }
        x += col.w;
      });

      setStroke(doc, LINE);
      doc.setLineWidth(0.12);
      doc.line(MARGIN, y + rowH, PAGE_W - MARGIN, y + rowH);
      y += rowH;
    }
  }

  rodape(doc, rotuloFiltros(filtros));
  doc.save(`multas-frota-${new Date().toISOString().slice(0, 10)}.pdf`);
}
