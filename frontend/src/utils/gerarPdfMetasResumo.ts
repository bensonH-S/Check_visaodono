import { jsPDF } from 'jspdf';
import type { MetasPainel, MetasPeriodoDetalhe, MetasPeriodoResumo } from '../api/client';
import { assetUrl } from '../config/paths';
import {
  agruparPaineisResumo,
  calcValorMetaPorLoja,
  celulaMetaBatida,
  fmtMoedaMeta,
  type MetasGrupoResumo,
} from '../components/metas/metasPageUtils';
import { lojasRevDemanda } from '../components/metas/metasRankingUtils';

const MARGIN = 11;
const PAGE_W = 297;
const PAGE_H = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 8;
const CONTENT_BOTTOM = FOOTER_Y - 4;

/** Paleta alinhada à marca Grupo Alvim */
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
const DEMANDA_BG = [254, 242, 242] as const;
const DEMANDA_TXT = [153, 27, 27] as const;

const MESES = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

type Rgb = readonly [number, number, number];
type LogoIcon = { dataUrl: string; w: number; h: number };

function rotuloPeriodo(p: MetasPeriodoResumo): string {
  return p.titulo || `${MESES[p.mes]}/${p.ano}`;
}

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

function novaPagina(doc: jsPDF): number {
  doc.addPage();
  return MARGIN + 1;
}

function garantirEspaco(doc: jsPDF, y: number, need: number): number {
  if (y + need > CONTENT_BOTTOM) return novaPagina(doc);
  return y;
}

function metricasTabela(painel: MetasPainel) {
  const nLojas = painel.lojas.length;
  const colPeso = 11;
  const colInd = Math.min(52, CONTENT_W * 0.18);
  const colLoja = Math.max(10.5, (CONTENT_W - colInd - colPeso) / Math.max(nLojas, 1));
  const rowH = nLojas > 10 ? 4.7 : 5.0;
  const fontSize = nLojas > 14 ? 5.4 : nLojas > 10 ? 5.8 : 6.4;
  const headerH = 6.2;
  return { colPeso, colInd, colLoja, rowH, fontSize, headerH };
}

function alturaPainel(painel: MetasPainel): number {
  const { rowH, headerH } = metricasTabela(painel);
  // título + linha + header + indicadores + subtotal + final + gap
  return 7 + headerH + (painel.indicadores.length + 2) * rowH + 5;
}

function alturaGrupo(grupo: MetasGrupoResumo): number {
  let h = 10; // barra do grupo
  if (grupo.empresa) h += alturaPainel(grupo.empresa);
  if (grupo.gestor) h += alturaPainel(grupo.gestor);
  return h;
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
    doc.text('  ·  MERIDIAN', MARGIN + wGrupo + doc.getTextWidth('alvim'), FOOTER_Y);

    doc.text(periodoLabel, PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text(`${i} / ${total}  ·  ${gerado}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

async function carregarIconeMarca(): Promise<LogoIcon | null> {
  try {
    if (typeof window === 'undefined') {
      const { readFileSync, existsSync } = await import('fs');
      const { dirname, join } = await import('path');
      const { fileURLToPath } = await import('url');
      const png = join(dirname(fileURLToPath(import.meta.url)), '../../public/Logo_Alvim_Icone.png');
      if (!existsSync(png)) return null;
      const dataUrl = `data:image/png;base64,${readFileSync(png).toString('base64')}`;
      return { dataUrl, w: 64, h: 64 };
    }
    const res = await fetch(assetUrl('Logo_Alvim_Icone.png'));
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

/** Ícone + wordmark tipográfico — casam com o navy sem bloco preto do PNG full. */
function desenharMarca(
  doc: jsPDF,
  logo: LogoIcon | null,
  x: number,
  y: number,
  iconSize = 14,
): void {
  if (logo) {
    doc.addImage(logo.dataUrl, 'PNG', x, y, iconSize, iconSize);
  }

  const tx = x + (logo ? iconSize + 3.5 : 0);
  const ty = y + iconSize / 2 + 1.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setText(doc, GRUPO_TXT);
  doc.text('grupo', tx, ty);
  const w = doc.getTextWidth('grupo');
  setText(doc, ACCENT);
  doc.text('alvim', tx + w, ty);
}

interface ResumoExecutivo {
  lojasUnicas: number;
  lojasDemanda: number;
  metasAtingidas: number;
  metasAvaliadas: number;
  pctAtingimento: number;
}

function calcularResumo(
  dados: MetasPeriodoDetalhe,
  lojasRevReprovadas: Set<number>,
): ResumoExecutivo {
  const lojas = new Set<number>();
  let metasAtingidas = 0;
  let metasAvaliadas = 0;

  for (const painel of dados.paineis) {
    for (const l of painel.lojas) lojas.add(l.id_loja);

    for (const ind of painel.indicadores) {
      for (const c of ind.celulas) {
        if (lojasRevReprovadas.has(c.id_loja)) continue;
        const temValor =
          c.valor_texto != null || c.valor_numero != null || c.atingiu != null;
        if (!temValor) continue;
        metasAvaliadas += 1;
        if (celulaMetaBatida(c)) metasAtingidas += 1;
      }
    }
  }

  return {
    lojasUnicas: lojas.size,
    lojasDemanda: lojasRevReprovadas.size,
    metasAtingidas,
    metasAvaliadas,
    pctAtingimento: metasAvaliadas > 0 ? (metasAtingidas / metasAvaliadas) * 100 : 0,
  };
}

function cabecalhoExecutivo(
  doc: jsPDF,
  periodo: MetasPeriodoResumo,
  logo: LogoIcon | null,
  resumo: ResumoExecutivo,
): number {
  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 26, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, 26, PAGE_W, 0.9, 'F');

  desenharMarca(doc, logo, MARGIN, 6, 14);

  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('RELATÓRIO CONFIDENCIAL', PAGE_W - MARGIN, 9, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Painel de Metas', PAGE_W - MARGIN, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 220);
  doc.text(rotuloPeriodo(periodo), PAGE_W - MARGIN, 21.5, { align: 'right' });

  let y = 32;
  const barH = 13;
  const statsW = 72;
  const statsX = MARGIN + CONTENT_W - statsW;

  setFill(doc, ROW_ALT);
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_W, barH, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setText(doc, SLATE_LIGHT);
  doc.text('PERÍODO', MARGIN + 4, y + 3.8);
  doc.setFontSize(10);
  setText(doc, NAVY);
  doc.text(rotuloPeriodo(periodo), MARGIN + 4, y + 9.4);

  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.line(statsX, y + 2.2, statsX, y + barH - 2.2);

  const lojasHint = resumo.lojasDemanda ? `${resumo.lojasDemanda} em demanda` : 'avaliadas';
  const col1 = statsX + 5;
  const col2 = statsX + 36;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  setText(doc, SLATE_LIGHT);
  doc.text('LOJAS', col1, y + 3.8);
  doc.text('ATINGIMENTO', col2, y + 3.8);

  doc.setFontSize(10);
  setText(doc, NAVY);
  doc.text(String(resumo.lojasUnicas), col1, y + 8.4);
  doc.text(`${resumo.pctAtingimento.toFixed(0)}%`, col2, y + 8.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  setText(doc, MUTED);
  doc.text(lojasHint, col1, y + 11.2);
  doc.text(`${resumo.metasAtingidas} de ${resumo.metasAvaliadas}`, col2, y + 11.2);

  return y + barH + 4.5;
}

function tituloGrupo(doc: jsPDF, y: number, grupo: MetasGrupoResumo): number {
  setFill(doc, NAVY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 7.5, 0.8, 0.8, 'F');
  setFill(doc, ACCENT);
  doc.rect(MARGIN, y, 2, 7.5, 'F');

  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(grupo.titulo.toUpperCase(), MARGIN + 5.5, y + 5);

  const partes: string[] = [];
  if (grupo.empresa) partes.push('Empresa');
  if (grupo.gestor) partes.push('Gestores');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 195, 220);
  doc.text(partes.join('  ·  '), PAGE_W - MARGIN - 3, y + 5, { align: 'right' });

  return y + 9.5;
}

function fmtValorCelula(
  valor_texto: string | null,
  valor_numero: number | null,
  atingiu: boolean | null,
): string {
  if (valor_texto) return pdfTxt(valor_texto);
  if (valor_numero != null) {
    if (valor_numero > 0 && valor_numero < 1) return valor_numero.toFixed(2).replace('.', ',');
    return String(valor_numero);
  }
  if (atingiu === true) return 'OK';
  return '—';
}

function estiloStatus(
  valor_texto: string | null,
  atingiu: boolean | null,
  demanda: boolean,
): { fill: Rgb | null; text: Rgb; bold: boolean } {
  if (demanda) return { fill: DEMANDA_BG, text: DEMANDA_TXT, bold: true };
  if (valor_texto === 'OK' || (atingiu === true && valor_texto !== 'X')) {
    return { fill: null, text: OK, bold: true };
  }
  if (valor_texto === 'X' || atingiu === false) {
    return { fill: null, text: FAIL, bold: true };
  }
  return { fill: null, text: SLATE, bold: false };
}

function desenharPainel(
  doc: jsPDF,
  y: number,
  painel: MetasPainel,
  lojasRevReprovadas: Set<number>,
): number {
  const { colPeso, colInd, colLoja, rowH, fontSize, headerH } = metricasTabela(painel);
  const valorPorLoja = calcValorMetaPorLoja(painel, lojasRevReprovadas);

  const tipoLabel = painel.tipo === 'empresa' ? 'METAS EMPRESA' : 'METAS GESTORES';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setText(doc, NAVY);
  doc.text(painel.titulo, MARGIN, y + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  setText(doc, MUTED);
  doc.text(tipoLabel, PAGE_W - MARGIN, y + 3, { align: 'right' });

  y += 4.5;
  setStroke(doc, ACCENT);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + 24, y);
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 24, y, PAGE_W - MARGIN, y);
  y += 2;

  const x0 = MARGIN;

  const desenharHeader = () => {
    setFill(doc, HEADER_BG);
    doc.rect(x0, y, CONTENT_W, headerH, 'F');
    setStroke(doc, LINE);
    doc.setLineWidth(0.2);
    doc.line(x0, y + headerH, x0 + CONTENT_W, y + headerH);

    let x = x0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    setText(doc, NAVY_MID);
    doc.text('INDICADOR', x + 1.5, y + 4.1, { maxWidth: colInd - 2.5 });
    x += colInd;
    doc.text('PESO', x + colPeso / 2, y + 4.1, { align: 'center' });
    x += colPeso;

    for (const loja of painel.lojas) {
      const rotulo = loja.rotulo_curto || loja.nome_loja;
      const demanda = lojasRevReprovadas.has(loja.id_loja);
      if (demanda) {
        setFill(doc, DEMANDA_BG);
        doc.rect(x, y, colLoja, headerH, 'F');
        setText(doc, DEMANDA_TXT);
      } else {
        setText(doc, NAVY_MID);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(Math.min(fontSize, 6));
      doc.text(rotulo, x + colLoja / 2, y + 4.1, { align: 'center', maxWidth: colLoja - 1 });
      x += colLoja;
    }
  };

  desenharHeader();
  y += headerH;

  let rowIdx = 0;
  for (const ind of painel.indicadores) {
    // Dentro do bloco do grupo não quebramos a tabela — a página já foi reservada.
    let x = x0;
    const rowBg: Rgb = rowIdx % 2 === 0 ? ([255, 255, 255] as const) : ROW_ALT;
    setFill(doc, rowBg);
    doc.rect(x0, y, CONTENT_W, rowH, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    setText(doc, [30, 41, 59]);
    doc.text(ind.nome, x + 1.5, y + 3.4, { maxWidth: colInd - 3 });
    x += colInd;

    doc.setFont('helvetica', 'bold');
    setText(doc, SLATE);
    doc.text(String(ind.peso), x + colPeso / 2, y + 3.4, { align: 'center' });
    x += colPeso;

    for (const c of ind.celulas) {
      const demanda = lojasRevReprovadas.has(c.id_loja);
      const st = estiloStatus(c.valor_texto, c.atingiu, demanda);
      if (st.fill) {
        setFill(doc, st.fill);
        doc.rect(x, y, colLoja, rowH, 'F');
      }
      setText(doc, st.text);
      doc.setFont('helvetica', st.bold ? 'bold' : 'normal');
      const txt = fmtValorCelula(c.valor_texto, c.valor_numero, c.atingiu);
      doc.text(txt, x + colLoja / 2, y + 3.4, { align: 'center', maxWidth: colLoja - 1 });
      x += colLoja;
    }

    setStroke(doc, LINE);
    doc.setLineWidth(0.1);
    doc.line(x0, y + rowH, x0 + CONTENT_W, y + rowH);
    y += rowH;
    rowIdx += 1;
  }

  const desenharLinhaResumo = (
    rotulo: string,
    pesoTxt: string,
    valores: string[],
    estilo: 'subtotal' | 'final',
  ) => {
    let x = x0;
    if (estilo === 'subtotal') {
      setFill(doc, HEADER_BG);
      doc.rect(x0, y, CONTENT_W, rowH, 'F');
      setText(doc, NAVY);
    } else {
      setFill(doc, NAVY);
      doc.rect(x0, y, CONTENT_W, rowH, 'F');
      setText(doc, [255, 255, 255]);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize);
    doc.text(rotulo, x + 1.5, y + 3.4);
    x += colInd;
    doc.text(pesoTxt, x + colPeso / 2, y + 3.4, { align: 'center' });
    x += colPeso;

    for (let i = 0; i < painel.lojas.length; i++) {
      const loja = painel.lojas[i];
      const demanda = lojasRevReprovadas.has(loja.id_loja);
      if (demanda && estilo === 'subtotal') {
        setFill(doc, DEMANDA_BG);
        doc.rect(x, y, colLoja, rowH, 'F');
        setText(doc, DEMANDA_TXT);
      } else if (demanda && estilo === 'final') {
        setFill(doc, [80, 20, 20]);
        doc.rect(x, y, colLoja, rowH, 'F');
        setText(doc, [254, 202, 202]);
      } else if (estilo === 'final') {
        setText(doc, [255, 255, 255]);
      } else {
        setText(doc, NAVY);
      }
      doc.setFont('helvetica', 'bold');
      doc.text(pdfTxt(valores[i] ?? '—'), x + colLoja / 2, y + 3.4, { align: 'center' });
      x += colLoja;
    }
    y += rowH;
  };

  const subtotais = painel.lojas.map((l) => {
    if (lojasRevReprovadas.has(l.id_loja)) return '—';
    const total = valorPorLoja.get(l.id_loja) ?? 0;
    return total > 0 ? String(total) : '—';
  });
  desenharLinhaResumo('SUBTOTAL', String(painel.subtotal_peso), subtotais, 'subtotal');

  const finais = painel.lojas.map((l) => {
    if (lojasRevReprovadas.has(l.id_loja)) return 'R$ —';
    return pdfTxt(fmtMoedaMeta(valorPorLoja.get(l.id_loja) ?? 0));
  });
  desenharLinhaResumo('FINAL', pdfTxt(fmtMoedaMeta(painel.subtotal_peso)), finais, 'final');

  setText(doc, [0, 0, 0]);
  return y + 4.5;
}

function legenda(doc: jsPDF, y: number, temDemanda: boolean): number {
  y = garantirEspaco(doc, y, 11);

  setFill(doc, ROW_ALT);
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_W, 8.5, 1, 1, 'FD');

  const itens: Array<{ cor: Rgb; label: string }> = [
    { cor: OK, label: 'OK — meta atingida (contabiliza)' },
    { cor: FAIL, label: 'X — meta não atingida' },
  ];
  if (temDemanda) {
    itens.push({ cor: DEMANDA_TXT, label: 'Coluna vermelha — loja em DEMANDA no R.E.V.' });
  }

  let x = MARGIN + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);

  for (const item of itens) {
    setFill(doc, item.cor);
    doc.circle(x + 1.2, y + 4.2, 1.1, 'F');
    setText(doc, SLATE);
    doc.text(item.label, x + 4, y + 4.9);
    x += doc.getTextWidth(item.label) + 12;
  }

  return y + 11;
}

/** Reserva a página inteira para o grupo — empresa e gestor juntos. */
function desenharGrupoCompleto(
  doc: jsPDF,
  y: number,
  grupo: MetasGrupoResumo,
  lojasRevReprovadas: Set<number>,
): number {
  const need = alturaGrupo(grupo);
  // Se não cabe o bloco inteiro, vai para página nova (como o Grupo 3).
  if (y + need > CONTENT_BOTTOM) {
    y = novaPagina(doc);
  }

  y = tituloGrupo(doc, y, grupo);
  if (grupo.empresa) y = desenharPainel(doc, y, grupo.empresa, lojasRevReprovadas);
  if (grupo.gestor) y = desenharPainel(doc, y, grupo.gestor, lojasRevReprovadas);
  return y;
}

export async function gerarPdfMetasResumo(
  dados: MetasPeriodoDetalhe,
  opts?: { outputPath?: string },
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const logo = await carregarIconeMarca();
  const grupos = agruparPaineisResumo(dados.paineis);
  const lojasRevReprovadas = lojasRevDemanda(dados.rankings);
  const resumo = calcularResumo(dados, lojasRevReprovadas);
  const periodoLabel = rotuloPeriodo(dados.periodo);

  let y = cabecalhoExecutivo(doc, dados.periodo, logo, resumo);

  if (!grupos.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    setText(doc, MUTED);
    doc.text('Nenhum painel de resumo neste período.', MARGIN, y + 8);
  } else {
    for (const grupo of grupos) {
      y = desenharGrupoCompleto(doc, y, grupo, lojasRevReprovadas);
    }
    y = legenda(doc, y, lojasRevReprovadas.size > 0);
  }

  rodape(doc, periodoLabel);

  const periodoSlug = periodoLabel.replace(/[/\s]+/g, '-');
  if (opts?.outputPath) {
    const { writeFileSync } = await import('fs');
    writeFileSync(opts.outputPath, Buffer.from(doc.output('arraybuffer')));
    return;
  }
  doc.save(`metas-resumo-${periodoSlug}.pdf`);
}

export type { MetasGrupoResumo };
