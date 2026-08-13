import fs from 'fs';
import { jsPDF } from 'jspdf';
import sizeOf from 'image-size';
import { countMidiaResposta, decryptMidiaResposta } from '../fotos.js';
import { findBrandAsset } from '../projectPaths.js';
import { fmtData, fmtNota, formatarHoraVisita, formatarLocalVisita } from '../utils/visitaFormat.js';

const MARGIN = 11;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 9;
const CONTENT_BOTTOM = FOOTER_Y - 4;

const NAVY = [11, 26, 59];
const NAVY_MID = [27, 42, 107];
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
const TOTAL_BG = [11, 26, 59];
const NC_BG = [254, 242, 242];
const NC_TXT = [153, 27, 27];

function setFill(doc, c) {
  doc.setFillColor(c[0], c[1], c[2]);
}

function setStroke(doc, c) {
  doc.setDrawColor(c[0], c[1], c[2]);
}

function setText(doc, c) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function novaPagina(doc) {
  doc.addPage();
  return MARGIN + 1;
}

function garantirEspaco(doc, y, need) {
  if (y + need > CONTENT_BOTTOM) return novaPagina(doc);
  return y;
}

function tituloRelatorio(visita) {
  if (visita.tipo_checklist_codigo === 'time_de_campo') return 'Time de Campo';
  if (visita.tipo_checklist_nome) return visita.tipo_checklist_nome;
  return 'Auditoria Operacional';
}

function rotuloVisita(v) {
  const hora = formatarHoraVisita(v.hora_inicio);
  const dataTxt = hora ? `${fmtData(v.data_visita)} às ${hora}` : fmtData(v.data_visita);
  return `${v.name}${v.bk_number ? ` · BKN ${v.bk_number}` : ''} · ${dataTxt}`;
}

function corNota(nota) {
  if (nota >= 85) return OK;
  if (nota >= 75) return ACCENT;
  return FAIL;
}

function formatarResposta(r) {
  if (r.nota_estrelas != null) return `${r.nota_estrelas} de 5 estrelas`;
  if (r.resposta) return r.resposta;
  return 'Sem resposta';
}

function estiloResposta(resposta, pergunta) {
  const invertida = pergunta
    ? pergunta.sim_indica_problema === true ||
      (pergunta.sim_indica_problema !== false && /possui alguma obstru/i.test(pergunta.texto || ''))
    : false;
  if (invertida) {
    if (resposta === 'Não') return { cor: OK, bg: [236, 253, 245] };
    if (resposta === 'Sim') return { cor: FAIL, bg: NC_BG };
  }
  if (resposta === 'Sim') return { cor: OK, bg: [236, 253, 245] };
  if (resposta === 'Não') return { cor: FAIL, bg: NC_BG };
  if (resposta === 'N/A') return { cor: MUTED, bg: ROW_ALT };
  return { cor: SLATE, bg: null };
}

function carregarPngPublico(...relPaths) {
  const logoPath = findBrandAsset(...relPaths);
  if (!logoPath) return null;
  try {
    const buffer = fs.readFileSync(logoPath);
    const dim = sizeOf(buffer);
    return {
      dataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
      w: dim.width || 1,
      h: dim.height || 1,
    };
  } catch {
    return null;
  }
}

function carregarIconeMarca() {
  return carregarPngPublico('Logo_Alvim_Icone.png', 'Logo_Icon-clear.png', 'Logo_GA.png');
}

function carregarLogoCiga() {
  return carregarPngPublico('CIGA.png', 'CIGA_email.png');
}

function desenharMarca(doc, logo, x, y, iconSize = 14) {
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
  return tx + w + doc.getTextWidth('alvim');
}

function rodape(doc, rotulo) {
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
    doc.text('  ·  MERIDIAN · CIGA', MARGIN + wGrupo + doc.getTextWidth('alvim'), FOOTER_Y);

    doc.text(rotulo, PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text(`${i} / ${total}  ·  ${gerado}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
}

function cabecalhoExecutivo(doc, dados, logo, ciga = null) {
  const v = dados.visita;
  const nota = Number(v.nota_final ?? 0);
  const titulo = tituloRelatorio(v);
  const rotulo = rotuloVisita(v);
  const headerH = ciga ? 34 : 26;

  setFill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, headerH, 'F');
  setFill(doc, ACCENT);
  doc.rect(0, headerH, PAGE_W, 0.9, 'F');

  const marcaEndX = desenharMarca(doc, logo, MARGIN, ciga ? 5 : 6, ciga ? 12 : 14);

  if (ciga) {
    const cigaH = 11;
    const cigaW = Math.min(52, (ciga.w / ciga.h) * cigaH);
    const cigaX = Math.max(marcaEndX + 6, MARGIN + 48);
    doc.addImage(ciga.dataUrl, 'PNG', cigaX, 5.5, cigaW, cigaH);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    setText(doc, [160, 176, 200]);
    doc.text('CIGA · Centro de Inteligência', cigaX, 5.5 + cigaH + 3.2);
  }

  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('RELATÓRIO DE VISITA', PAGE_W - MARGIN, ciga ? 10 : 9, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(titulo, PAGE_W - MARGIN, ciga ? 17.5 : 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 195, 220);
  const lojaLinha = doc.splitTextToSize(rotulo, ciga ? 88 : 110);
  doc.text(lojaLinha.slice(0, 2), PAGE_W - MARGIN, ciga ? 24 : 21.5, { align: 'right' });

  let y = headerH + 6;

  setFill(doc, ROW_ALT);
  setStroke(doc, LINE);
  doc.setLineWidth(0.2);
  doc.roundedRect(MARGIN, y, CONTENT_W, 10, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setText(doc, SLATE_LIGHT);
  doc.text('LOJA', MARGIN + 4, y + 3.8);
  doc.setFontSize(10);
  setText(doc, NAVY);
  doc.text(v.name, MARGIN + 4, y + 8.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setText(doc, SLATE_LIGHT);
  doc.text('AUDITOR', MARGIN + CONTENT_W * 0.42, y + 3.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setText(doc, SLATE);
  doc.text(v.nome_usuario, MARGIN + CONTENT_W * 0.42, y + 8.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  setText(doc, SLATE_LIGHT);
  doc.text('STATUS', MARGIN + CONTENT_W * 0.72, y + 3.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setText(doc, v.status === 'Finalizada' ? OK : ACCENT);
  doc.text(v.status, MARGIN + CONTENT_W * 0.72, y + 8.2);

  y += 13;

  const catsOk = dados.desempenho_categorias.filter((c) => Number(c.percentual) >= 80).length;
  const anterior = dados.historico_notas[1];
  const diff = anterior ? nota - Number(anterior.nota) : null;

  const cards = [
    {
      label: 'NOTA FINAL',
      value: fmtNota(v.nota_final),
      hint:
        nota >= 85
          ? 'excelente desempenho'
          : nota >= 75
            ? 'dentro da meta'
            : 'abaixo da meta',
      destaque: true,
    },
    {
      label: 'CATEGORIAS',
      value: String(dados.desempenho_categorias.length),
      hint: catsOk ? `${catsOk} acima de 80%` : 'avaliadas',
    },
    {
      label: 'RESPOSTAS',
      value: String(dados.respostas.length),
      hint: 'itens registrados',
    },
    {
      label: 'NCs',
      value: String(dados.nao_conformidades.length),
      hint: dados.nao_conformidades.length ? 'não conformidades' : 'nenhuma aberta',
    },
    {
      label: 'DURAÇÃO',
      value: v.duracao_minutos != null ? `${v.duracao_minutos} min` : '—',
      hint: diff != null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}p vs anterior` : 'tempo em loja',
    },
  ];

  const gap = 2.2;
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  const cardH = 15.5;

  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const x = MARGIN + i * (cardW + gap);
    const destaque = c.destaque;

    if (destaque) {
      setFill(doc, TOTAL_BG);
      doc.roundedRect(x, y, cardW, cardH, 1, 1, 'F');
      setFill(doc, corNota(nota));
      doc.rect(x, y, 1.3, cardH, 'F');
      setText(doc, GRUPO_TXT);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(c.label, x + 4.5, y + 4.2);
      setText(doc, [255, 255, 255]);
      doc.setFontSize(14);
      doc.text(c.value, x + 4.5, y + 10);
      if (c.hint) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        setText(doc, SLATE_LIGHT);
        doc.text(c.hint, x + 4.5, y + 13.2);
      }
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
      if (c.hint) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        setText(doc, MUTED);
        doc.text(c.hint, x + 4.5, y + 13.2);
      }
    }
  }

  y += cardH + 4;

  const meta = v.meta_visita ?? {};
  const detalhes = [];
  if (v.bk_number) detalhes.push(`BKN ${v.bk_number}`);
  detalhes.push(formatarLocalVisita(v));
  if (meta.gerente) detalhes.push(`Gerente: ${meta.gerente}`);
  if (meta.territorio) detalhes.push(`Território: ${meta.territorio}`);
  if (meta.time_total != null && meta.time_total !== '') detalhes.push(`Time: ${meta.time_total}`);
  const obs = v.observacoes_gerais?.trim();
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

function tituloSecao(doc, y, texto) {
  y = garantirEspaco(doc, y, 12);
  setFill(doc, NAVY);
  doc.roundedRect(MARGIN, y, CONTENT_W, 7.5, 0.8, 0.8, 'F');
  setFill(doc, ACCENT);
  doc.rect(MARGIN, y, 2, 7.5, 'F');
  setText(doc, [255, 255, 255]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(texto.toUpperCase(), MARGIN + 5.5, y + 5);
  return y + 9.5;
}

function desempenhoCategorias(
  doc,
  y,
  cats,
) {
  if (!cats.length) return y;

  y = tituloSecao(doc, y, 'Desempenho por categoria');

  const barH = 5;
  const rowH = 9.5;

  for (let i = 0; i < cats.length; i++) {
    const c = cats[i];
    y = garantirEspaco(doc, y, rowH);
    const pct = Number.isFinite(Number(c.percentual)) ? Number(c.percentual) : 0;
    const barColor = pct >= 80 ? OK : pct >= 60 ? ACCENT : NAVY_MID;

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

function medirAlturaBloco(doc, r, nFotos) {
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

function desenharFotos(doc, y, imagens) {
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
  doc,
  y,
  r,
  imagens,
  idx,
) {
  const altura = medirAlturaBloco(doc, r, imagens.length);
  y = garantirEspaco(doc, y, altura);
  const boxTop = y;

  setFill(doc, idx % 2 === 0 ? ([255, 255, 255]) : ROW_ALT);
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

  const urlsNaoImg = countMidiaResposta(r.foto_url) - imagens.length;
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

function corGravidade(gravidade) {
  const g = gravidade.toLowerCase();
  if (g.includes('crit') || g.includes('alta')) return { bg: [254, 226, 226], text: [153, 27, 27] };
  if (g.includes('méd') || g.includes('med')) return { bg: [255, 237, 213], text: [154, 52, 18] };
  return { bg: [254, 249, 195], text: [133, 77, 14] };
}

function desenharNaoConformidades(
  doc,
  ncs,
  visita,
) {
  if (!ncs.length) return;

  doc.addPage();
  let y = MARGIN + 2;

  setFill(doc, NC_BG);
  setStroke(doc, [252, 165, 165]);
  doc.setLineWidth(0.25);
  doc.roundedRect(MARGIN, y, CONTENT_W, 14, 1.2, 1.2, 'FD');
  setFill(doc, FAIL);
  doc.rect(MARGIN, y, 2, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  setText(doc, SLATE_LIGHT);
  doc.text('RESUMO', MARGIN + 6, y + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setText(doc, NC_TXT);
  doc.text(
    `${ncs.length} não conformidade${ncs.length > 1 ? 's' : ''} identificada${ncs.length > 1 ? 's' : ''}`,
    MARGIN + 6,
    y + 9.5,
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setText(doc, SLATE);
  const ctx = `${visita.name}${visita.bk_number ? ` · BKN ${visita.bk_number}` : ''} · Visita #${visita.id_visita}`;
  doc.text(ctx, PAGE_W - MARGIN - 4, y + 9.5, { align: 'right' });

  y += 18;
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

    const rowBg = i % 2 === 0 ? ([255, 255, 255]) : ROW_ALT;
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


async function carregarImagensResposta(r) {
  const imagens = [];
  if (!r.foto_url) return imagens;
  const n = countMidiaResposta(r.foto_url);
  for (let i = 0; i < n; i++) {
    try {
      const { buffer, mime } = decryptMidiaResposta(r.foto_url, i);
      if (!mime.startsWith('image/')) continue;
      const dim = sizeOf(buffer);
      imagens.push({
        dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
        mime,
        w: dim.width || 800,
        h: dim.height || 600,
      });
    } catch {
      /* ignora */
    }
  }
  return imagens;
}

export async function gerarPdfVisitaBuffer(dados) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const v = dados.visita;
  const logo = carregarIconeMarca();
  const ciga = carregarLogoCiga();
  const rotulo = rotuloVisita(v);

  let y = cabecalhoExecutivo(doc, dados, logo, ciga);
  y = desempenhoCategorias(doc, y, dados.desempenho_categorias);

  const porCategoria = new Map();
  for (const r of dados.respostas) {
    const cat = r.categoria || 'Outros';
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat).push(r);
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
        const imagens = await carregarImagensResposta(r);
        y = desenharBlocoResposta(doc, y, r, imagens, respIdx);
        respIdx += 1;
      }
      catIdx += 1;
      y += catIdx < porCategoria.size ? 2 : 0;
    }
  }

  desenharNaoConformidades(doc, dados.nao_conformidades, v);

  rodape(doc, rotulo);

  return Buffer.from(doc.output('arraybuffer'));
}
