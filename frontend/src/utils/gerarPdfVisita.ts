import { jsPDF } from 'jspdf';
import type { VisitaDetalhe } from '../api/client';
import { fmtData, fmtNota } from '../api/client';
import { assetUrl } from '../config/paths';
import { getToken } from '../lib/auth';
import { formatarHoraVisita, formatarLocalVisita } from './visitaFormat';
import { simIndicaProblema } from './checklistRules';

const MARGIN = 11;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 9;
const CONTENT_BOTTOM = FOOTER_Y - 4;

const NAVY = [15, 23, 42] as const;
const NAVY_MID = [30, 58, 138] as const;
const INK = [5, 16, 23] as const;
const BLUE = [27, 110, 243] as const;
const ACCENT = [232, 82, 10] as const;
const SLATE = [71, 85, 105] as const;
const SLATE_LIGHT = [148, 163, 184] as const;
const LINE = [226, 232, 240] as const;
const ROW_ALT = [248, 250, 252] as const;
const HEADER_BG = [241, 245, 249] as const;
const OK = [21, 128, 61] as const;
const FAIL = [185, 28, 28] as const;
const MUTED = [100, 116, 139] as const;
const NC_BG = [254, 242, 242] as const;

type Rgb = readonly [number, number, number];
type LogoIcon = { dataUrl: string; w: number; h: number };
type ImagemPdf = { dataUrl: string; mime: string; w: number; h: number };

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

function tituloRelatorio(visita: VisitaDetalhe['visita']): string {
  if (visita.tipo_checklist_codigo === 'time_de_campo') return 'Time de Campo';
  if (visita.tipo_checklist_nome) return visita.tipo_checklist_nome;
  return 'Auditoria Operacional';
}

function rotuloVisita(v: VisitaDetalhe['visita']): string {
  const hora = formatarHoraVisita(v.hora_inicio);
  const dataTxt = hora ? `${fmtData(v.data_visita)} às ${hora}` : fmtData(v.data_visita);
  return `${v.name}${v.bk_number ? ` · BKN ${v.bk_number}` : ''} · ${dataTxt}`;
}

function corNota(nota: number): Rgb {
  if (nota >= 85) return OK;
  if (nota >= 75) return ACCENT;
  return FAIL;
}

function vereditoNota(nota: number): string {
  if (nota >= 85) return 'EXCELENTE';
  if (nota >= 75) return 'NA META';
  return 'ABAIXO DA META';
}

function formatarResposta(r: VisitaDetalhe['respostas'][0]): string {
  if (r.nota_estrelas != null) return `${r.nota_estrelas} de 5 estrelas`;
  if (r.resposta) return r.resposta;
  return 'Sem resposta';
}

function estiloResposta(
  resposta: string | null | undefined,
  pergunta?: { texto?: string; sim_indica_problema?: boolean },
): { cor: Rgb; bg: Rgb | null } {
  const invertida = pergunta ? simIndicaProblema(pergunta) : false;
  if (invertida) {
    if (resposta === 'Não') return { cor: OK, bg: [236, 253, 245] };
    if (resposta === 'Sim') return { cor: FAIL, bg: NC_BG };
  }
  if (resposta === 'Sim') return { cor: OK, bg: [236, 253, 245] };
  if (resposta === 'Não') return { cor: FAIL, bg: NC_BG };
  if (resposta === 'N/A') return { cor: MUTED, bg: ROW_ALT };
  return { cor: SLATE, bg: null };
}

async function carregarIconeMarca(): Promise<LogoIcon | null> {
  try {
    const res = await fetch(assetUrl('Simbolo_Meridian_Oficial.png'));
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    return { dataUrl, ...dims };
  } catch {
    return null;
  }
}

function desenharMarca(doc: jsPDF, logo: LogoIcon | null, x: number, y: number, iconSize = 14): void {
  if (logo) {
    doc.addImage(logo.dataUrl, 'PNG', x, y, iconSize, iconSize);
  }
  const tx = x + (logo ? iconSize + 3.5 : 0);
  const ty = y + iconSize / 2 + 1.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, [255, 255, 255]);
  doc.text('MERIDIAN', tx, ty - 1.4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  setText(doc, [148, 163, 184]);
  doc.text('GESTÃO OPERACIONAL', tx, ty + 2.6);
}

function rodape(doc: jsPDF, rotulo: string) {
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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    setText(doc, NAVY);
    const wMarca = doc.getTextWidth('MERIDIAN');
    doc.text('MERIDIAN', MARGIN, FOOTER_Y);
    doc.setFont('helvetica', 'normal');
    setText(doc, SLATE_LIGHT);
    doc.text('  ·  Gestão operacional', MARGIN + wMarca, FOOTER_Y);

    doc.text(rotulo, PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text(`${i} / ${total}  ·  ${gerado}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

function cabecalhoExecutivo(
  doc: jsPDF,
  dados: VisitaDetalhe,
  logo: LogoIcon | null,
): number {
  const v = dados.visita;
  const nota = Number(v.nota_final ?? 0);
  const titulo = tituloRelatorio(v);
  const rotulo = rotuloVisita(v);

  setFill(doc, INK);
  doc.rect(0, 0, PAGE_W, 26, 'F');
  setFill(doc, BLUE);
  doc.rect(0, 26, PAGE_W, 1.1, 'F');

  desenharMarca(doc, logo, MARGIN, 6, 14);

  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('RELATÓRIO DE VISITA', PAGE_W - MARGIN, 9, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(titulo, PAGE_W - MARGIN, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 220);
  const lojaLinha = doc.splitTextToSize(rotulo, 110);
  doc.text(lojaLinha.slice(0, 2), PAGE_W - MARGIN, 21.5, { align: 'right' });

  let y = 33;
  const heroH = 30;
  const scoreW = 42;
  const scoreX = MARGIN + CONTENT_W - scoreW;
  const nomeLinhas = doc.splitTextToSize(String(v.name || 'Loja'), CONTENT_W - scoreW - 8).slice(0, 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  setText(doc, NAVY);
  doc.text(nomeLinhas, MARGIN, y + 7);

  const catsOk = dados.desempenho_categorias.filter((c) => Number(c.percentual) >= 80).length;
  const anterior = dados.historico_notas[1];
  const diff = anterior ? nota - Number(anterior.nota) : null;
  const ncs = dados.nao_conformidades.length;
  const nCriticas = dados.nao_conformidades.filter((nc) => /crit/i.test(nc.gravidade || '')).length;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(doc, SLATE);
  const metaLinha = [
    fmtData(v.data_visita),
    v.nome_usuario,
    v.bk_number ? `BKN ${v.bk_number}` : '',
    v.status,
  ]
    .filter(Boolean)
    .join('   ·   ');
  doc.text(metaLinha, MARGIN, y + 8 + nomeLinhas.length * 6, { maxWidth: CONTENT_W - scoreW - 8 });

  const cor = corNota(nota);
  setFill(doc, cor);
  doc.roundedRect(scoreX, y, scoreW, heroH, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setText(doc, [255, 255, 255]);
  doc.text('NOTA DA VISITA', scoreX + scoreW / 2, y + 7, { align: 'center' });
  doc.setFontSize(22);
  doc.text(fmtNota(v.nota_final), scoreX + scoreW / 2, y + 17.5, { align: 'center' });
  doc.setFontSize(7.5);
  doc.text(vereditoNota(nota), scoreX + scoreW / 2, y + 24, { align: 'center' });

  y += heroH + 5;

  const cards: Array<{ label: string; value: string; hint?: string; alerta?: boolean }> = [
    {
      label: 'CATEGORIAS',
      value: String(dados.desempenho_categorias.length),
      hint: catsOk ? `${catsOk} acima de 80%` : 'avaliadas',
    },
    {
      label: 'RESPOSTAS',
      value: String(dados.respostas.length),
      hint: 'itens do checklist',
    },
    {
      label: 'NÃO CONFORMIDADES',
      value: String(ncs),
      hint: nCriticas ? `${nCriticas} crítica${nCriticas > 1 ? 's' : ''}` : ncs ? 'a tratar' : 'nenhuma aberta',
      alerta: ncs > 0,
    },
    {
      label: 'EVOLUÇÃO',
      value: diff != null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(0)} p` : v.duracao_minutos != null ? `${v.duracao_minutos} min` : '—',
      hint: diff != null ? 'versus visita anterior' : 'tempo em loja',
    },
  ];

  const gap = 2.4;
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const cardH = 16;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const x = MARGIN + i * (cardW + gap);
    const faixa = c.alerta ? FAIL : BLUE;
    setFill(doc, [255, 255, 255]);
    setStroke(doc, c.alerta ? ([252, 165, 165] as const) : LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, cardH, 1.2, 1.2, 'FD');
    setFill(doc, faixa);
    doc.rect(x, y, 1.6, cardH, 'F');
    setText(doc, SLATE_LIGHT);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.text(c.label, x + 4.5, y + 4.4);
    setText(doc, c.alerta ? FAIL : NAVY);
    doc.setFontSize(13);
    doc.text(c.value, x + 4.5, y + 10.2);
    if (c.hint) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      setText(doc, MUTED);
      doc.text(c.hint, x + 4.5, y + 13.6);
    }
  }

  y += cardH + 4;

  const meta = v.meta_visita ?? {};
  const detalhes: string[] = [];
  if (v.bk_number) detalhes.push(`BKN ${v.bk_number}`);
  detalhes.push(formatarLocalVisita(v));
  if (meta.gerente) detalhes.push(`Gerente: ${meta.gerente}`);
  if (meta.territorio) detalhes.push(`Território: ${meta.territorio}`);
  if (meta.time_total != null && meta.time_total !== '') detalhes.push(`Time: ${meta.time_total}`);
  const obs = (v as { observacoes_gerais?: string }).observacoes_gerais?.trim();
  if (obs) detalhes.push(`Obs.: ${obs}`);

  if (detalhes.length) {
    setFill(doc, [255, 255, 255]);
    setStroke(doc, LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN, y, CONTENT_W, 7, 1, 1, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, SLATE);
    doc.text(detalhes.join('   ·   '), MARGIN + 4, y + 4.5, { maxWidth: CONTENT_W - 8 });
    y += 9;
  }

  return y + 2;
}

function tituloSecao(doc: jsPDF, y: number, texto: string): number {
  y = garantirEspaco(doc, y, 12);
  setFill(doc, INK);
  doc.roundedRect(MARGIN, y, CONTENT_W, 7.5, 0.8, 0.8, 'F');
  setFill(doc, BLUE);
  doc.rect(MARGIN, y, 2.2, 7.5, 'F');
  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(texto.toUpperCase(), MARGIN + 5.5, y + 5);
  return y + 9.5;
}

function desempenhoCategorias(
  doc: jsPDF,
  y: number,
  cats: VisitaDetalhe['desempenho_categorias'],
): number {
  if (!cats.length) return y;

  y = tituloSecao(doc, y, 'Desempenho por categoria');

  const barH = 5;
  const rowH = 9.5;

  for (let i = 0; i < cats.length; i++) {
    const c = cats[i];
    y = garantirEspaco(doc, y, rowH);
    const pct = Number.isFinite(Number(c.percentual)) ? Number(c.percentual) : 0;
    const barColor: Rgb = pct >= 80 ? OK : pct >= 60 ? ACCENT : NAVY_MID;

    if (i % 2 === 1) {
      setFill(doc, ROW_ALT);
      doc.rect(MARGIN, y - 2, CONTENT_W, rowH, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(doc, [30, 41, 59]);
    doc.text(c.categoria, MARGIN + 2, y + 2.5, { maxWidth: CONTENT_W * 0.38 });

    const barX = MARGIN + CONTENT_W * 0.4;
    const barW = CONTENT_W * 0.48;
    setFill(doc, LINE);
    doc.roundedRect(barX, y, barW, barH, 1, 1, 'F');
    if (pct > 0) {
      setFill(doc, barColor);
      doc.roundedRect(barX, y, Math.max((barW * pct) / 100, 6), barH, 1, 1, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(doc, barColor);
    doc.text(`${pct}%`, PAGE_W - MARGIN - 2, y + 3.5, { align: 'right' });

    y += rowH;
  }

  return y + 3;
}

function medirAlturaBloco(doc: jsPDF, r: VisitaDetalhe['respostas'][0], nFotos: number): number {
  const innerW = CONTENT_W - 10;
  let h = 8;
  const cod = r.codigo?.trim();
  const textW = cod ? innerW - 16 : innerW;
  h += doc.splitTextToSize(r.texto, textW).length * 3.8 + 2;
  h += 7;
  if (r.observacao?.trim()) {
    h += 3 + doc.splitTextToSize(r.observacao.trim(), innerW).length * 3.6;
  }
  if (nFotos > 0) {
    h += 6;
    const cols = nFotos === 1 ? 1 : 2;
    const rows = Math.ceil(nFotos / cols);
    const gap = 3;
    const colW = cols === 1 ? innerW : (innerW - gap) / 2;
    const cellH = cols === 1 ? Math.min(72, colW * 0.65) : Math.min(52, colW * 0.75);
    h += rows * (cellH + gap + 4);
  }
  return h + 6;
}

function desenharFotos(doc: jsPDF, y: number, imagens: ImagemPdf[]): number {
  if (!imagens.length) return y;

  const innerW = CONTENT_W - 10;
  const gap = 3;
  const cols = imagens.length === 1 ? 1 : 2;
  const colW = cols === 1 ? innerW : (innerW - gap) / 2;
  const maxH = cols === 1 ? 72 : 52;

  y = garantirEspaco(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setText(doc, SLATE_LIGHT);
  doc.text('EVIDÊNCIAS FOTOGRÁFICAS', MARGIN + 5, y);
  y += 5;

  for (let i = 0; i < imagens.length; i += cols) {
    const linha = imagens.slice(i, i + cols);
    let rowH = 0;

    y = garantirEspaco(doc, y, maxH + 10);
    for (let j = 0; j < linha.length; j++) {
      const img = linha[j];
      let w = colW;
      let h = (img.h / img.w) * w;
      if (h > maxH) {
        h = maxH;
        w = (img.w / img.h) * h;
      }

      const ix = MARGIN + 5 + j * (colW + gap);
      const iy = y;

      setFill(doc, HEADER_BG);
      setStroke(doc, LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(ix - 0.5, iy - 0.5, colW + 1, h + 6, 1.2, 1.2, 'FD');

      const formato = img.mime.includes('png') ? 'PNG' : 'JPEG';
      const offsetX = ix + (colW - w) / 2;
      doc.addImage(img.dataUrl, formato, offsetX, iy, w, h);

      setFill(doc, NAVY);
      doc.roundedRect(ix, iy + h + 1, 14, 4.5, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      setText(doc, [255, 255, 255]);
      doc.text(`Foto ${i + j + 1}`, ix + 7, iy + h + 4, { align: 'center' });

      rowH = Math.max(rowH, h + 8);
    }
    y += rowH + 2;
  }

  return y;
}

function desenharBlocoResposta(
  doc: jsPDF,
  y: number,
  r: VisitaDetalhe['respostas'][0],
  imagens: ImagemPdf[],
  idx: number,
): number {
  const altura = medirAlturaBloco(doc, r, imagens.length);
  y = garantirEspaco(doc, y, altura);
  const boxTop = y;

  setFill(doc, idx % 2 === 0 ? ([255, 255, 255] as const) : ROW_ALT);
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, boxTop, CONTENT_W, altura, 1, 1, 'FD');

  let innerY = boxTop + 6;
  const innerX = MARGIN + 5;
  const innerW = CONTENT_W - 10;
  const cod = r.codigo?.trim();

  if (cod) {
    setFill(doc, ACCENT);
    doc.roundedRect(innerX, innerY - 3.5, 13, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setText(doc, [255, 255, 255]);
    doc.text(cod, innerX + 6.5, innerY + 0.5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(doc, NAVY);
    const linhas = doc.splitTextToSize(r.texto, innerW - 16);
    doc.text(linhas, innerX + 15, innerY);
    innerY += linhas.length * 3.8 + 2;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(doc, NAVY);
    const linhas = doc.splitTextToSize(r.texto, innerW);
    doc.text(linhas, innerX, innerY);
    innerY += linhas.length * 3.8 + 2;
  }

  const respTxt = formatarResposta(r);
  const st = estiloResposta(r.resposta, r);
  const badgeW = Math.min(doc.getTextWidth(respTxt) + 8, innerW * 0.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setText(doc, SLATE_LIGHT);
  doc.text('RESPOSTA', innerX, innerY + 1);

  if (st.bg) {
    setFill(doc, st.bg);
    doc.roundedRect(innerX + 22, innerY - 2.5, badgeW, 6, 1, 1, 'F');
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setText(doc, st.cor);
  doc.text(respTxt, innerX + 24, innerY + 1);
  innerY += 7;

  if (r.observacao?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    setText(doc, SLATE_LIGHT);
    doc.text('OBSERVAÇÃO', innerX, innerY);
    innerY += 3;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    setText(doc, SLATE);
    const obsLinhas = doc.splitTextToSize(r.observacao.trim(), innerW);
    doc.text(obsLinhas, innerX, innerY);
    innerY += obsLinhas.length * 3.6;
  }

  if (imagens.length) {
    innerY = desenharFotos(doc, innerY, imagens);
  }

  const urlsNaoImg = (r.midia_urls?.length ?? 0) - imagens.length;
  if (urlsNaoImg > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setText(doc, MUTED);
    doc.text(
      `${urlsNaoImg} anexo(s) em vídeo (não exibido no PDF)`,
      innerX,
      innerY + 2,
    );
  }

  return boxTop + altura + 3;
}

function corGravidade(gravidade: string): { bg: Rgb; text: Rgb } {
  const g = gravidade.toLowerCase();
  if (g.includes('crit') || g.includes('alta')) return { bg: [254, 226, 226], text: [153, 27, 27] };
  if (g.includes('méd') || g.includes('med')) return { bg: [255, 237, 213], text: [154, 52, 18] };
  return { bg: [254, 249, 195], text: [133, 77, 14] };
}

function desenharNaoConformidades(
  doc: jsPDF,
  ncs: VisitaDetalhe['nao_conformidades'],
  visita: VisitaDetalhe['visita'],
): void {
  if (!ncs.length) return;

  doc.addPage();
  const criticas = ncs.filter((nc) => /crit/i.test(nc.gravidade || '')).length;

  setFill(doc, [127, 29, 29]);
  doc.rect(0, 0, PAGE_W, 32, 'F');
  setFill(doc, FAIL);
  doc.rect(0, 32, PAGE_W, 1.4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setText(doc, [254, 202, 202]);
  doc.text('PLANO DE AÇÃO', MARGIN, 12);
  doc.setFontSize(15);
  setText(doc, [255, 255, 255]);
  doc.text(
    `${ncs.length} não conformidade${ncs.length > 1 ? 's' : ''} identificada${ncs.length > 1 ? 's' : ''}`,
    MARGIN,
    21,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setText(doc, [254, 202, 202]);
  const ctx = `${visita.name}${visita.bk_number ? ` · BKN ${visita.bk_number}` : ''} · Visita #${visita.id_visita}`;
  doc.text(ctx, MARGIN, 27);
  if (criticas) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setText(doc, [255, 255, 255]);
    doc.text(`${criticas} crítica${criticas > 1 ? 's' : ''}`, PAGE_W - MARGIN, 20, { align: 'right' });
  }

  let y = 40;
  y = tituloSecao(doc, y, 'Não conformidades');

  const colNum = 8;
  const colGrav = 24;
  const colArea = 32;
  const colDesc = CONTENT_W - colNum - colGrav - colArea;
  const headerH = 7;
  const rowPad = 3;

  const desenharHeaderTabela = () => {
    setFill(doc, HEADER_BG);
    doc.rect(MARGIN, y, CONTENT_W, headerH, 'F');
    setStroke(doc, LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + headerH, MARGIN + CONTENT_W, y + headerH);

    let x = MARGIN;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(doc, NAVY_MID);
    doc.text('#', x + 2.5, y + 4.8);
    x += colNum;
    doc.text('GRAVIDADE', x + 2, y + 4.8);
    x += colGrav;
    doc.text('ÁREA', x + 2, y + 4.8);
    x += colArea;
    doc.text('DESCRIÇÃO', x + 2, y + 4.8);
    y += headerH;
  };

  desenharHeaderTabela();

  for (let i = 0; i < ncs.length; i++) {
    const nc = ncs[i];
    const descLinhas = doc.splitTextToSize(nc.descricao, colDesc - 4);
    const rowH = Math.max(9, descLinhas.length * 3.8 + rowPad * 2);

    if (y + rowH > CONTENT_BOTTOM) {
      doc.addPage();
      y = MARGIN + 2;
      y = tituloSecao(doc, y, 'Não conformidades (continuação)');
      desenharHeaderTabela();
    }

    const rowBg: Rgb = i % 2 === 0 ? ([255, 255, 255] as const) : ROW_ALT;
    setFill(doc, rowBg);
    doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');

    let x = MARGIN;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setText(doc, SLATE);
    doc.text(String(i + 1), x + 2.5, y + rowPad + 3.5);
    x += colNum;

    const grav = corGravidade(nc.gravidade);
    setFill(doc, grav.bg);
    const badgeW = Math.min(colGrav - 3, doc.getTextWidth(nc.gravidade) + 6);
    doc.roundedRect(x + 1.5, y + rowPad, badgeW, 5.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setText(doc, grav.text);
    doc.text(nc.gravidade, x + 1.5 + badgeW / 2, y + rowPad + 3.8, { align: 'center' });
    x += colGrav;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setText(doc, NAVY);
    doc.text(nc.area, x + 2, y + rowPad + 3.5, { maxWidth: colArea - 4 });
    x += colArea;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setText(doc, SLATE);
    doc.text(descLinhas, x + 2, y + rowPad + 3.5);

    setStroke(doc, LINE);
    doc.setLineWidth(0.1);
    doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
    y += rowH;
  }

  y += 4;
  if (y + 10 < CONTENT_BOTTOM) {
    setFill(doc, ROW_ALT);
    setStroke(doc, LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1, 1, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    setText(doc, MUTED);
    doc.text(
      'NCs geradas automaticamente a partir das respostas do checklist com desvios identificados.',
      MARGIN + 4,
      y + 5,
    );
  }
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

export async function gerarPdfVisita(dados: VisitaDetalhe, opts?: { asShare?: boolean }): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const v = dados.visita;
  const logo = await carregarIconeMarca();
  const rotulo = rotuloVisita(v);

  let y = cabecalhoExecutivo(doc, dados, logo);
  y = desempenhoCategorias(doc, y, dados.desempenho_categorias);

  const porCategoria = new Map<string, VisitaDetalhe['respostas']>();
  for (const r of dados.respostas) {
    const cat = r.categoria || 'Outros';
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat)!.push(r);
  }

  if (porCategoria.size) {
    y = tituloSecao(doc, y, 'Respostas do checklist');

    let catIdx = 0;
    for (const [categoria, items] of porCategoria) {
      y = garantirEspaco(doc, y, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setText(doc, NAVY_MID);
      doc.text(categoria, MARGIN, y + 3);
      setStroke(doc, ACCENT);
      doc.setLineWidth(0.6);
      doc.line(MARGIN, y + 4.5, MARGIN + 28, y + 4.5);
      setStroke(doc, LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN + 28, y + 4.5, PAGE_W - MARGIN, y + 4.5);
      y += 8;

      let respIdx = 0;
      for (const r of items) {
        const imagens: ImagemPdf[] = [];
        for (const url of r.midia_urls || []) {
          const img = await carregarImagem(url);
          if (img) imagens.push(img);
        }
        y = desenharBlocoResposta(doc, y, r, imagens, respIdx);
        respIdx += 1;
      }
      catIdx += 1;
      y += catIdx < porCategoria.size ? 2 : 0;
    }
  }

  desenharNaoConformidades(doc, dados.nao_conformidades, v);

  rodape(doc, rotulo);

  const dataArq = fmtData(v.data_visita).replace(/\//g, '-');
  const bkn = v.bk_number || 'loja';
  const filename = `relatorio-visita-${v.id_visita}-${bkn}-${dataArq}.pdf`;
  const tituloShare = 'Relatório da Visita';
  const textoShare = `Relatório da visita - ${v.name || bkn}`;

  if (opts?.asShare && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const blob = doc.output('blob');
    const pdfBlob =
      blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    try {
      // Abre o sheet nativo (WhatsApp, Drive, e-mail, etc.)
      await navigator.share({
        files: [file],
        title: tituloShare,
        text: textoShare,
      });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      // Alguns browsers rejeitam files — tenta sheet sem arquivo + download do PDF
      try {
        await navigator.share({ title: tituloShare, text: `${textoShare}\n${filename}` });
      } catch (e2) {
        if ((e2 as Error).name === 'AbortError') return;
      }
    }
  }

  doc.save(filename);
}
