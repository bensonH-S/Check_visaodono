import { jsPDF } from 'jspdf';
import type { EnergiaChamadoDetalhe } from '../api/client';
import { fetchMediaBlobAutenticada } from '../api/client';
import { assetUrl } from '../config/paths';
import { formatDataHoraBalaoMapa } from './dateBr';
import { rotuloStatusEnergia, rotuloTipoOcorrencia } from '../pages/energia/energiaConstants';

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 12;
const CONTENT_BOTTOM = FOOTER_Y - 6;

const NAVY = [11, 26, 59] as const;
const ACCENT = [232, 82, 10] as const;
const SLATE = [71, 85, 105] as const;
const SLATE_LIGHT = [148, 163, 184] as const;
const LINE = [226, 232, 240] as const;
const ROW_ALT = [248, 250, 252] as const;

type Rgb = readonly [number, number, number];

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
  return MARGIN + 4;
}

function garantirEspaco(doc: jsPDF, y: number, need: number): number {
  if (y + need > CONTENT_BOTTOM) return novaPagina(doc);
  return y;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function carregarLogo(): Promise<string | null> {
  try {
    const res = await fetch(assetUrl('Logo_Alvim_Icone.png'));
    if (!res.ok) return null;
    return blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

function campo(doc: jsPDF, y: number, label: string, valor: string, x = MARGIN, w = CONTENT_W): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setText(doc, SLATE_LIGHT);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setText(doc, NAVY);
  const linhas = doc.splitTextToSize(valor || '—', w);
  doc.text(linhas, x, y + 5);
  return y + 5 + linhas.length * 4.4 + 3;
}

function slug(s: string) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40);
}

export async function gerarPdfEnergia(chamado: EnergiaChamadoDetalhe): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logo = await carregarLogo();

  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 28, 'F');
  if (logo) doc.addImage(logo, 'PNG', MARGIN, 6, 14, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  setText(doc, [255, 255, 255]);
  doc.text('Relatório de ocorrência de energia', logo ? MARGIN + 18 : MARGIN, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(doc, [200, 210, 230]);
  doc.text('Meridian · Grupo Alvim', logo ? MARGIN + 18 : MARGIN, 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, ACCENT);
  doc.text(`#${chamado.numero}`, PAGE_W - MARGIN, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  setText(doc, [200, 210, 230]);
  doc.text(rotuloStatusEnergia(chamado.status), PAGE_W - MARGIN, 18, { align: 'right' });

  let y = 36;
  setFill(doc, ROW_ALT);
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 1.5, 1.5, 'FD');
  y = campo(doc, y + 5, 'Loja', `${chamado.nome_loja}${chamado.bk_number ? ` · BKN ${chamado.bk_number}` : ''}`, MARGIN + 4, CONTENT_W - 8);
  y += 6;

  const col = CONTENT_W / 2 - 2;
  const y0 = y;
  y = campo(doc, y0, 'Protocolo', chamado.protocolo, MARGIN, col);
  campo(doc, y0, 'Concessionária', chamado.concessionaria, MARGIN + col + 4, col);
  y = Math.max(y, y0 + 14);

  const y1 = y;
  y = campo(doc, y1, 'Data e hora da ocorrência', formatDataHoraBalaoMapa(chamado.ocorrido_em), MARGIN, col);
  campo(doc, y1, 'Tipo', rotuloTipoOcorrencia(chamado.tipo_ocorrencia), MARGIN + col + 4, col);
  y = Math.max(y, y1 + 14);

  y = campo(doc, y, 'Registrado por', chamado.nome_abriu);
  if (chamado.descricao) {
    y = garantirEspaco(doc, y, 20);
    y = campo(doc, y, 'Descrição do ocorrido', chamado.descricao);
  }
  if (chamado.status === 'finalizado') {
    y = campo(doc, y, 'Finalizado em', formatDataHoraBalaoMapa(chamado.finalizado_em));
    y = campo(doc, y, 'Finalizado por', chamado.nome_finalizou || '—');
    if (chamado.observacao_final) {
      y = campo(doc, y, 'Observação de encerramento', chamado.observacao_final);
    }
  }

  y = garantirEspaco(doc, y, 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setText(doc, NAVY);
  doc.text(`Evidências fotográficas (${chamado.anexos.length})`, MARGIN, y);
  y += 6;

  for (let i = 0; i < chamado.anexos.length; i++) {
    const anexo = chamado.anexos[i];
    try {
      const blob = await fetchMediaBlobAutenticada(anexo.media_url);
      const dataUrl = await blobToDataUrl(blob);
      const fmt = blob.type.includes('png') ? 'PNG' : 'JPEG';
      y = garantirEspaco(doc, y, 78);
      doc.addImage(dataUrl, fmt, MARGIN, y, CONTENT_W, 70, undefined, 'FAST');
      y += 73;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      setText(doc, SLATE_LIGHT);
      doc.text(
        `Foto ${i + 1} · ${formatDataHoraBalaoMapa(anexo.created_at)}`,
        MARGIN,
        y,
      );
      y += 6;
    } catch {
      y = garantirEspaco(doc, y, 10);
      doc.setFontSize(8);
      setText(doc, SLATE);
      doc.text(`Foto ${i + 1}: não foi possível carregar.`, MARGIN, y);
      y += 8;
    }
  }

  y = garantirEspaco(doc, y, 22);
  setFill(doc, [255, 247, 237]);
  setStroke(doc, ACCENT);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, 16, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, SLATE);
  const aviso = doc.splitTextToSize(
    'Documento comprobatório da ocorrência junto à concessionária de energia. As fotos e o protocolo foram registrados no Meridian para eventual comprovação de dano a equipamentos da unidade.',
    CONTENT_W - 8,
  );
  doc.text(aviso, MARGIN + 4, y + 6);

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, SLATE_LIGHT);
    doc.text(
      `Meridian · Grupo Alvim · chamado de energia #${chamado.numero} · gerado em ${formatDataHoraBalaoMapa(new Date().toISOString())}`,
      MARGIN,
      FOOTER_Y,
    );
    doc.text(`${p}/${total}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }

  const nome = `relatorio-energia-${slug(chamado.nome_loja)}-${slug(chamado.protocolo)}-${chamado.numero}.pdf`;
  doc.save(nome);
}
