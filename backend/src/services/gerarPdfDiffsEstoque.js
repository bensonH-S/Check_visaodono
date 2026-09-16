import { jsPDF } from 'jspdf';

const MARGIN = 10;
const PAGE_W = 297;
const PAGE_H = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 8;
const CONTENT_BOTTOM = FOOTER_Y - 4;

const NAVY = [11, 26, 59];
const ACCENT = [232, 82, 10];
const GRUPO_TXT = [160, 176, 200];
const SLATE = [71, 85, 105];
const SLATE_LIGHT = [148, 163, 184];
const LINE = [226, 232, 240];
const ROW_ALT = [248, 250, 252];
const HEADER_BG = [241, 245, 249];
const OK = [21, 128, 61];
const FAIL = [185, 28, 28];
const MUTED = [100, 116, 139];

const COLS = {
  item: 152,
  und: 22,
  sist: 32,
  contou: 32,
  dif: 36,
};

function setFill(doc, c) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function setStroke(doc, c) {
  doc.setDrawColor(c[0], c[1], c[2]);
}
function setText(doc, c) {
  doc.setTextColor(c[0], c[1], c[2]);
}
function pdfTxt(valor) {
  return String(valor ?? '')
    .replace(/\u2014/g, '-')
    .replace(/\u00a0/g, ' ');
}

function fmtNum(v, digitos = 3) {
  if (v == null || Number.isNaN(Number(v))) return '-';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digitos,
  });
}

function fmtDataBR(iso) {
  if (!iso || iso === '-') return '-';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function desenharMarca(doc, x, y, iconSize = 12) {
  const ty = y + iconSize / 2 + 1.1;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, GRUPO_TXT);
  doc.text('grupo', x, ty);
  const w = doc.getTextWidth('grupo');
  setText(doc, ACCENT);
  doc.text('alvim', x + w, ty);
}

function cabecalho(doc, dados) {
  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 24, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, 24, PAGE_W, 0.85, 'F');

  desenharMarca(doc, MARGIN, 6, 12);

  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('RELATÓRIO CONFIDENCIAL', PAGE_W - MARGIN, 8, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Diferenças da contagem diária', PAGE_W - MARGIN, 14.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 220);
  doc.text(pdfTxt(dados.subtitulo), PAGE_W - MARGIN, 20, { align: 'right' });

  let y = 29;
  const barH = 12;
  setFill(doc, ROW_ALT);
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_W, barH, 1, 1, 'FD');

  const cells = [
    { label: 'REGIONAL', value: dados.regional },
    { label: 'LOJAS', value: String(dados.qtd_lojas) },
    { label: 'COM DIFERENÇA', value: String(dados.qtd_com_diff) },
    { label: 'ITENS', value: String(dados.qtd_itens) },
    { label: 'REFERÊNCIA', value: fmtDataBR(dados.ate) },
  ];
  const colW = CONTENT_W / cells.length;
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(doc, NAVY);
    doc.text(pdfTxt(c.value).slice(0, 32), x, y + 9);
  });

  y += barH + 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setText(doc, MUTED);
  doc.text(
    'Última contagem diária finalizada de cada loja. Diferença = contou - sistema.',
    MARGIN,
    y,
  );
  return y + 4;
}

function rotuloLoja(loja) {
  return pdfTxt(
    [loja.bk_number ? `BK ${loja.bk_number}` : null, loja.name].filter(Boolean).join(' · ') || 'Loja',
  );
}

function situacaoLoja(loja) {
  if (!loja.data) return 'Não contou';
  if (!loja.qtd_diffs) return 'Sem diferença';
  return `${loja.qtd_diffs} diferença${loja.qtd_diffs === 1 ? '' : 's'}`;
}

function barraCompacta(doc, dados, loja) {
  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 12, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, 12, PAGE_W, 0.7, 'F');
  desenharMarca(doc, MARGIN, 1.6, 8.5);
  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    loja ? rotuloLoja(loja) : 'Diferenças da contagem diária',
    PAGE_W - MARGIN,
    5.4,
    { align: 'right' },
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 195, 220);
  doc.text(pdfTxt(loja ? situacaoLoja(loja) : dados.subtitulo), PAGE_W - MARGIN, 9.8, {
    align: 'right',
  });
  return 16;
}

function cabecalhoContinuacao(doc, dados) {
  return barraCompacta(doc, dados, null);
}

function cabecalhoContinuacaoLoja(doc, dados, loja) {
  return barraCompacta(doc, dados, loja);
}

function garantirEspaco(doc, y, need, dados, loja) {
  if (y + need > CONTENT_BOTTOM) {
    doc.addPage();
    return loja ? cabecalhoContinuacaoLoja(doc, dados, loja) : cabecalhoContinuacao(doc, dados);
  }
  return y;
}

function cabecalhoLoja(doc, dados, loja) {
  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 24, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, 24, PAGE_W, 0.85, 'F');
  desenharMarca(doc, MARGIN, 6, 12);

  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('RELATÓRIO CONFIDENCIAL', PAGE_W - MARGIN, 8, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(rotuloLoja(loja).slice(0, 52), PAGE_W - MARGIN, 14.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 220);
  doc.text(pdfTxt(dados.regional || 'Rede'), PAGE_W - MARGIN, 20, { align: 'right' });

  let y = 29;
  const barH = 12;
  setFill(doc, ROW_ALT);
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_W, barH, 1, 1, 'FD');

  const cells = [
    { label: 'DATA', value: fmtDataBR(loja.data) },
    { label: 'QUEM CONTOU', value: loja.quem || '-' },
    { label: 'SITUAÇÃO', value: situacaoLoja(loja) },
    { label: 'ITENS', value: String(loja.qtd_diffs || 0) },
    { label: 'REGIONAL', value: loja.regional || dados.regional || '-' },
  ];
  const colW = CONTENT_W / cells.length;
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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(doc, NAVY);
    doc.text(pdfTxt(c.value).slice(0, 28), x, y + 9);
  });
  return y + barH + 5;
}

function rodape(doc) {
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
    doc.text('Estoque · Diferenças da diária', PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text(`${i} / ${total}  ·  ${gerado}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

function tituloSecao(doc, y, texto, dados) {
  y = garantirEspaco(doc, y, 10, dados);
  setFill(doc, NAVY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 7, 0.6, 0.6, 'F');
  setFill(doc, ACCENT);
  doc.rect(MARGIN, y, 1.4, 7, 'F');
  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(pdfTxt(texto), MARGIN + 5, y + 4.7);
  return y + 9;
}

function headerTabelaResumo(doc, y) {
  setFill(doc, HEADER_BG);
  doc.rect(MARGIN, y, CONTENT_W, 6, 'F');
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + 6, MARGIN + CONTENT_W, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setText(doc, SLATE_LIGHT);
  const cols = [
    [MARGIN + 3, 'LOJA'],
    [MARGIN + 92, 'REGIONAL'],
    [MARGIN + 148, 'DATA'],
    [MARGIN + 178, 'QUEM CONTOU'],
    [MARGIN + CONTENT_W - 3, 'DIFFS', 'right'],
  ];
  for (const [x, label, align] of cols) {
    doc.text(label, x, y + 4.1, align ? { align } : undefined);
  }
  return y + 6;
}

function headerTabelaDiff(doc, y) {
  setFill(doc, HEADER_BG);
  doc.rect(MARGIN, y, CONTENT_W, 6, 'F');
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + 6, MARGIN + CONTENT_W, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setText(doc, SLATE_LIGHT);
  let x = MARGIN + 3;
  doc.text('ITEM', x, y + 4.1);
  x += COLS.item;
  doc.text('UND', x, y + 4.1);
  x += COLS.und;
  doc.text('SISTEMA', x + COLS.sist - 2, y + 4.1, { align: 'right' });
  x += COLS.sist;
  doc.text('CONTOU', x + COLS.contou - 2, y + 4.1, { align: 'right' });
  x += COLS.contou;
  doc.text('DIFF', x + COLS.dif - 2, y + 4.1, { align: 'right' });
  return y + 6;
}

function desenharResumo(doc, y, dados) {
  y = tituloSecao(doc, y, 'Resumo por loja', dados);
  y = headerTabelaResumo(doc, y);
  const rowH = 6.2;
  dados.lojas.forEach((loja, i) => {
    y = garantirEspaco(doc, y, rowH + 1, dados);
    if (y <= 18) y = headerTabelaResumo(doc, y);
    if (i % 2 === 1) {
      setFill(doc, ROW_ALT);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }
    const temDiff = loja.qtd_diffs > 0;
    const semContagem = !loja.data;
    doc.setFont('helvetica', temDiff ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    setText(doc, NAVY);
    const nomeLoja = pdfTxt(
      [loja.bk_number ? String(loja.bk_number) : '', loja.name].filter(Boolean).join('  '),
    ).slice(0, 42);
    doc.text(nomeLoja, MARGIN + 3, y + 4.2);
    doc.setFont('helvetica', 'normal');
    setText(doc, SLATE);
    doc.text(pdfTxt(loja.regional || '-').slice(0, 22), MARGIN + 92, y + 4.2);
    doc.text(fmtDataBR(loja.data), MARGIN + 148, y + 4.2);
    doc.text(pdfTxt(loja.quem || '-').slice(0, 22), MARGIN + 178, y + 4.2);
    if (semContagem) {
      setText(doc, MUTED);
      doc.text('Não contou', MARGIN + CONTENT_W - 3, y + 4.2, { align: 'right' });
    } else {
      setText(doc, temDiff ? FAIL : OK);
      doc.setFont('helvetica', 'bold');
      doc.text(String(loja.qtd_diffs), MARGIN + CONTENT_W - 3, y + 4.2, { align: 'right' });
    }
    y += rowH;
  });
  return y + 5;
}

function desenharLoja(doc, dados, loja) {
  doc.addPage();
  let y = cabecalhoLoja(doc, dados, loja);

  if (!loja.data) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setText(doc, MUTED);
    doc.text('Esta loja ainda não finalizou a contagem diária.', MARGIN, y + 6);
    return;
  }

  if (!loja.itens.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setText(doc, MUTED);
    doc.text('Nenhuma diferença na última diária.', MARGIN, y + 6);
    return;
  }

  y = headerTabelaDiff(doc, y);
  const rowH = 6;
  loja.itens.forEach((item, i) => {
    y = garantirEspaco(doc, y, rowH + 1, dados, loja);
    if (y <= 18) y = headerTabelaDiff(doc, y);
    if (i % 2 === 1) {
      setFill(doc, ROW_ALT);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }
    let x = MARGIN + 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    setText(doc, NAVY);
    doc.text(pdfTxt(item.descricao).slice(0, 72), x, y + 4.1);
    x += COLS.item;
    setText(doc, SLATE);
    doc.text(pdfTxt(item.unidade || '-').slice(0, 8), x, y + 4.1);
    x += COLS.und;
    doc.text(fmtNum(item.sistema), x + COLS.sist - 2, y + 4.1, { align: 'right' });
    x += COLS.sist;
    doc.text(fmtNum(item.contado), x + COLS.contou - 2, y + 4.1, { align: 'right' });
    x += COLS.contou;
    const dif = Number(item.diff) || 0;
    setText(doc, dif < 0 ? FAIL : dif > 0 ? ACCENT : SLATE);
    doc.setFont('helvetica', 'bold');
    const sinal = dif > 0 ? '+' : '';
    doc.text(`${sinal}${fmtNum(dif)}`, x + COLS.dif - 2, y + 4.1, { align: 'right' });
    y += rowH;
  });
}

export function gerarPdfDiffsEstoque(dados) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  let y = cabecalho(doc, dados);
  desenharResumo(doc, y, dados);

  for (const loja of dados.lojas || []) {
    desenharLoja(doc, dados, loja);
  }

  rodape(doc);
  return Buffer.from(doc.output('arraybuffer'));
}
