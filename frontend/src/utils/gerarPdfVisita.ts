import { jsPDF } from 'jspdf';
import type { VisitaDetalhe } from '../api/client';
import { fmtData, fmtNota } from '../api/client';
import { getToken } from '../lib/auth';
import { formatarHoraVisita, formatarLocalVisita } from './visitaFormat';

const MARGIN = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 10;

const NAVY = [27, 42, 107] as const;
const ORANGE = [232, 82, 10] as const;
const GRAY_BG = [245, 245, 243] as const;
const GRAY_LINE = [220, 220, 218] as const;
const GREEN = [59, 109, 17] as const;
const RED = [163, 45, 45] as const;
const COLS_FOTO = 3;
const PAD_BLOCO = 5;

type ImagemPdf = { dataUrl: string; mime: string; w: number; h: number };

function novaPaginaSePreciso(doc: jsPDF, y: number, need = 20): number {
  if (y + need > FOOTER_Y - 4) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function rodape(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Vision Check · Página ${i} de ${total}`, MARGIN, FOOTER_Y);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, PAGE_W - MARGIN, FOOTER_Y, {
      align: 'right',
    });
  }
}

function tituloSecao(doc: jsPDF, y: number, texto: string): number {
  y = novaPaginaSePreciso(doc, y, 14);
  doc.setFillColor(...NAVY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(texto, MARGIN + 3, y + 5.5);
  doc.setTextColor(0, 0, 0);
  return y + 12;
}

function linhaTexto(
  doc: jsPDF,
  texto: string,
  x: number,
  y: number,
  maxW: number,
  size = 9,
  bold = false,
): number {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  const linhas = doc.splitTextToSize(texto, maxW);
  doc.text(linhas, x, y);
  return y + linhas.length * (size * 0.42) + 1.5;
}

function campoInfo(
  doc: jsPDF,
  rotulo: string,
  valor: string,
  x: number,
  y: number,
  colW: number,
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(rotulo.toUpperCase(), x, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  const linhas = doc.splitTextToSize(valor || '—', colW - 2);
  doc.text(linhas, x, y + 4.5);
  return y + 4.5 + linhas.length * 4.2 + 5;
}

async function carregarImagem(path: string): Promise<ImagemPdf | null> {
  const token = getToken();
  const url = path.startsWith('http') ? path : `${window.location.origin}${path}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;

  const mime = res.headers.get('content-type') || 'image/jpeg';
  if (!mime.startsWith('image/')) return null;

  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  return { dataUrl, mime, w: img.naturalWidth, h: img.naturalHeight };
}

function formatarResposta(r: VisitaDetalhe['respostas'][0]): string {
  if (r.nota_estrelas != null) return `${r.nota_estrelas} de 5 estrelas`;
  if (r.resposta) return r.resposta;
  return 'Sem resposta';
}

function corResposta(resposta: string | null | undefined): readonly [number, number, number] {
  if (resposta === 'Sim') return GREEN;
  if (resposta === 'Não') return RED;
  return [30, 30, 30];
}

function alturaTexto(doc: jsPDF, texto: string, maxW: number, size = 9): number {
  return doc.splitTextToSize(texto, maxW).length * (size * 0.42) + 1.5;
}

function desenharCaixa(
  doc: jsPDF,
  top: number,
  height: number,
  fill = true,
): void {
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.35);
  if (fill) {
    doc.setFillColor(252, 252, 251);
    doc.roundedRect(MARGIN, top, CONTENT_W, height, 2, 2, 'FD');
  } else {
    doc.roundedRect(MARGIN, top, CONTENT_W, height, 2, 2, 'S');
  }
}

function medirAlturaTextoBloco(doc: jsPDF, r: VisitaDetalhe['respostas'][0]): number {
  const cod = r.codigo?.trim();
  const textW = cod ? CONTENT_W - 22 : CONTENT_W - 10;
  let h = 6 + PAD_BLOCO;
  h += alturaTexto(doc, r.texto, textW, 9);
  h += 7;
  if (r.observacao?.trim()) {
    h += 4;
    h += alturaTexto(doc, r.observacao.trim(), CONTENT_W - PAD_BLOCO * 2, 9);
  }
  h += PAD_BLOCO;
  return h;
}

function desenharTextoBloco(
  doc: jsPDF,
  y: number,
  r: VisitaDetalhe['respostas'][0],
): number {
  const cod = r.codigo?.trim();
  let innerY = y + 6;

  if (cod) {
    doc.setFillColor(...ORANGE);
    doc.roundedRect(MARGIN + PAD_BLOCO, innerY - 3.5, 12, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(cod, MARGIN + PAD_BLOCO + 6, innerY + 0.5, { align: 'center' });
    doc.setTextColor(40, 40, 40);
    innerY = linhaTexto(doc, r.texto, MARGIN + 18, innerY, CONTENT_W - 22, 9, true);
  } else {
    innerY = linhaTexto(doc, r.texto, MARGIN + PAD_BLOCO, innerY, CONTENT_W - PAD_BLOCO * 2, 9, true);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('RESPOSTA', MARGIN + PAD_BLOCO, innerY + 1);

  const respTxt = formatarResposta(r);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...corResposta(r.resposta));
  doc.text(respTxt, MARGIN + 28, innerY + 1);
  doc.setTextColor(40, 40, 40);
  innerY += 7;

  if (r.observacao?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('OBSERVAÇÃO', MARGIN + PAD_BLOCO, innerY);
    innerY += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    innerY = linhaTexto(doc, r.observacao.trim(), MARGIN + PAD_BLOCO, innerY, CONTENT_W - PAD_BLOCO * 2, 9);
  }

  return innerY;
}

function desenharFotos(doc: jsPDF, y: number, imagens: ImagemPdf[]): number {
  if (!imagens.length) return y;

  const gap = 2;
  const colW = (CONTENT_W - PAD_BLOCO * 2 - gap * (COLS_FOTO - 1)) / COLS_FOTO;
  const maxH = Math.min(36, colW * 0.85);

  y = novaPaginaSePreciso(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('EVIDÊNCIAS', MARGIN + PAD_BLOCO, y);
  y += 5;

  for (let i = 0; i < imagens.length; i += COLS_FOTO) {
    const linha = imagens.slice(i, i + COLS_FOTO);
    y = novaPaginaSePreciso(doc, y, maxH + 8);

    let rowH = 0;
    for (let j = 0; j < linha.length; j++) {
      const img = linha[j];
      let w = colW;
      let h = (img.h / img.w) * w;
      if (h > maxH) {
        h = maxH;
        w = (img.w / img.h) * h;
      }

      const ix = MARGIN + PAD_BLOCO + j * (colW + gap);
      const formato = img.mime.includes('png') ? 'PNG' : 'JPEG';
      doc.setDrawColor(...GRAY_LINE);
      doc.setLineWidth(0.25);
      doc.roundedRect(ix, y, w, h, 1, 1, 'S');
      doc.addImage(img.dataUrl, formato, ix, y, w, h);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`Foto ${i + j + 1}`, ix, y + h + 3.5);
      rowH = Math.max(rowH, h + 7);
    }
    y += rowH;
  }

  return y;
}

function alturaCampo(doc: jsPDF, valor: string, colW: number): number {
  const linhas = doc.splitTextToSize(valor || '—', colW - 2);
  return 4.5 + linhas.length * 4.2 + 5;
}

function cabecalhoVisita(doc: jsPDF, dados: VisitaDetalhe): number {
  const v = dados.visita;

  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, PAGE_W, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Vision Check', MARGIN, 10);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatório de visita operacional', MARGIN, 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(fmtNota(v.nota_final), PAGE_W - MARGIN, 13, { align: 'right' });

  const boxTop = 28;
  const colW = CONTENT_W / 2 - 6;
  const x1 = MARGIN + 5;
  const x2 = MARGIN + CONTENT_W / 2 + 2;

  const hora = formatarHoraVisita(v.hora_inicio);
  const dataTxt = hora ? `${fmtData(v.data_visita)} às ${hora}` : fmtData(v.data_visita);

  const linhas: Array<{ rotulo: string; valor: string; col: 1 | 2 }> = [
    { rotulo: 'Loja', valor: v.name, col: 1 },
    { rotulo: 'BKN', valor: v.bk_number || '—', col: 2 },
    { rotulo: 'Data', valor: dataTxt, col: 1 },
    { rotulo: 'Auditor', valor: v.nome_usuario, col: 2 },
    { rotulo: 'Local', valor: formatarLocalVisita(v), col: 1 },
    { rotulo: 'Status', valor: v.status, col: 2 },
  ];

  const obs = (v as { observacoes_gerais?: string }).observacoes_gerais?.trim();

  doc.setFontSize(10);
  let y1 = boxTop + 8;
  let y2 = boxTop + 8;
  const pares: Array<{ col: 1 | 2; rotulo: string; valor: string; y: number; full?: boolean }> = [];

  for (const item of linhas) {
    if (item.col === 1) {
      pares.push({ ...item, y: y1 });
      y1 += alturaCampo(doc, item.valor, colW);
    } else {
      pares.push({ ...item, y: y2 });
      y2 += alturaCampo(doc, item.valor, colW);
    }
  }

  let yObs = Math.max(y1, y2);
  if (obs) {
    pares.push({ rotulo: 'Observações gerais', valor: obs, col: 1, y: yObs, full: true });
    yObs += alturaCampo(doc, obs, CONTENT_W - 10);
  }

  const boxH = yObs - boxTop + 2;
  doc.setFillColor(...GRAY_BG);
  doc.setDrawColor(...GRAY_LINE);
  doc.roundedRect(MARGIN, boxTop, CONTENT_W, boxH, 2, 2, 'FD');

  doc.setTextColor(0, 0, 0);
  for (const item of pares) {
    if (item.full) {
      campoInfo(doc, item.rotulo, item.valor, MARGIN + 5, item.y, CONTENT_W - 10);
    } else {
      const x = item.col === 1 ? x1 : x2;
      campoInfo(doc, item.rotulo, item.valor, x, item.y, colW);
    }
  }

  return boxTop + boxH + 8;
}

function tabelaCategorias(doc: jsPDF, y: number, cats: VisitaDetalhe['desempenho_categorias']): number {
  if (!cats.length) return y;

  y = tituloSecao(doc, y, 'Desempenho por categoria');

  for (const c of cats) {
    y = novaPaginaSePreciso(doc, y, 10);
    const pct = Number(c.percentual);
    const barColor = pct >= 80 ? [99, 153, 34] : pct >= 60 ? ORANGE : NAVY;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(c.categoria, MARGIN, y + 3);

    doc.setFont('helvetica', 'bold');
    doc.text(`${c.percentual}%`, PAGE_W - MARGIN, y + 3, { align: 'right' });

    doc.setFillColor(230, 230, 228);
    doc.roundedRect(MARGIN, y + 5, CONTENT_W, 4, 1, 1, 'F');
    doc.setFillColor(...(barColor as [number, number, number]));
    if (pct > 0) {
      doc.roundedRect(MARGIN, y + 5, Math.max((CONTENT_W * pct) / 100, 8), 4, 1, 1, 'F');
    }

    y += 14;
  }

  return y + 4;
}

function blocoPergunta(
  doc: jsPDF,
  y: number,
  r: VisitaDetalhe['respostas'][0],
  imagens: ImagemPdf[],
): number {
  const altTexto = medirAlturaTextoBloco(doc, r);
  y = novaPaginaSePreciso(doc, y, altTexto + 4);
  const boxTop = y;
  desenharCaixa(doc, boxTop, altTexto);
  desenharTextoBloco(doc, boxTop, r);
  y = boxTop + altTexto + 4;

  const urlsNaoImg = (r.midia_urls?.length ?? 0) - imagens.length;
  if (imagens.length) {
    y = desenharFotos(doc, y, imagens);
  }
  if (urlsNaoImg > 0) {
    y = novaPaginaSePreciso(doc, y, 8);
    y = linhaTexto(
      doc,
      `${urlsNaoImg} anexo(s) em vídeo (não exibido no PDF)`,
      MARGIN + PAD_BLOCO,
      y,
      CONTENT_W - PAD_BLOCO * 2,
      8,
    );
  }

  return y + 4;
}

export async function gerarPdfVisita(dados: VisitaDetalhe): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const v = dados.visita;
  let y = cabecalhoVisita(doc, dados);

  y = tabelaCategorias(doc, y, dados.desempenho_categorias);

  const porCategoria = new Map<string, VisitaDetalhe['respostas']>();
  for (const r of dados.respostas) {
    const cat = r.categoria || 'Outros';
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat)!.push(r);
  }

  if (porCategoria.size) {
    y = tituloSecao(doc, y, 'Respostas do checklist');

    for (const [categoria, items] of porCategoria) {
      y = novaPaginaSePreciso(doc, y, 12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...ORANGE);
      doc.text(categoria, MARGIN, y);
      doc.setDrawColor(...ORANGE);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, y + 2, PAGE_W - MARGIN, y + 2);
      doc.setTextColor(0, 0, 0);
      y += 8;

      for (const r of items) {
        const imagens: ImagemPdf[] = [];
        for (const url of r.midia_urls || []) {
          const img = await carregarImagem(url);
          if (img) imagens.push(img);
        }
        y = blocoPergunta(doc, y, r, imagens);
      }
      y += 3;
    }
  }

  if (dados.nao_conformidades.length) {
    y = tituloSecao(doc, y, 'Não conformidades');
    for (const nc of dados.nao_conformidades) {
      y = novaPaginaSePreciso(doc, y, 12);
      doc.setFillColor(255, 240, 240);
      doc.setDrawColor(211, 47, 47);
      const txt = `[${nc.gravidade}] ${nc.area}: ${nc.descricao}`;
      const linhas = doc.splitTextToSize(txt, CONTENT_W - 10);
      const h = linhas.length * 4.5 + 6;
      doc.roundedRect(MARGIN, y, CONTENT_W, h, 1, 1, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(linhas, MARGIN + 4, y + 5);
      y += h + 4;
    }
  }

  rodape(doc);

  const dataArq = fmtData(v.data_visita).replace(/\//g, '-');
  const bkn = v.bk_number || 'loja';
  doc.save(`visita-${v.id_visita}-${bkn}-${dataArq}.pdf`);
}
