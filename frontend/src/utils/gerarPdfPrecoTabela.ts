import { jsPDF } from 'jspdf';
import type { EstoquePedidoTabela, EstoquePedidosTabelaPeriodo } from '../api/client';
import { assetUrl } from '../config/paths';
import { nomeLojaCurto, resumirPedidosTabela } from './precoTabelaResumo';

const MARGIN = 12;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 8;
const CONTENT_BOTTOM = FOOTER_Y - 6;

type Rgb = readonly [number, number, number];

const NAVY: Rgb = [11, 26, 59];
const ACCENT: Rgb = [232, 82, 10];
const RED: Rgb = [185, 28, 28];
const RED_SOFT: Rgb = [254, 242, 242];
const GRUPO_TXT: Rgb = [160, 176, 200];
const SLATE: Rgb = [71, 85, 105];
const SLATE_LIGHT: Rgb = [148, 163, 184];
const MUTED: Rgb = [100, 116, 139];
const LINE: Rgb = [226, 232, 240];
const ROW_ALT: Rgb = [248, 250, 252];
const HEADER_BG: Rgb = [241, 245, 249];
const WHITE: Rgb = [255, 255, 255];

function txt(v: string) {
  return String(v ?? '').replace(/[\u2014\u2013]/g, '-').replace(/\u00a0/g, ' ').replace(/[\u2018\u2019]/g, "'");
}

function moeda(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '-';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function moedaCurta(n: number) {
  if (Math.abs(n) >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (Math.abs(n) >= 1e4) return `R$ ${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return moeda(n);
}

function inteiro(n: number) {
  return Math.round(n).toLocaleString('pt-BR');
}

function pct(n: number, casas = 1) {
  if (!Number.isFinite(n)) return '-';
  return `${(n * 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

function data(iso: string | null | undefined) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '-';
}

function fill(doc: jsPDF, c: Rgb) {
  doc.setFillColor(c[0], c[1], c[2]);
}
function stroke(doc: jsPDF, c: Rgb) {
  doc.setDrawColor(c[0], c[1], c[2]);
}
function color(doc: jsPDF, c: Rgb) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function cortar(doc: jsPDF, s: string, w: number) {
  const t = txt(s);
  if (doc.getTextWidth(t) <= w) return t;
  let out = t;
  while (out.length > 1 && doc.getTextWidth(`${out}...`) > w) out = out.slice(0, -1);
  return `${out.trimEnd()}...`;
}

async function carregarIcone(): Promise<string | null> {
  try {
    const res = await fetch(assetUrl('Logo_Alvim_Icone.png'));
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

type Coluna = { label: string; w: number; align?: 'left' | 'right' | 'center' };

function cabecalhoTabela(doc: jsPDF, y: number, cols: Coluna[]) {
  fill(doc, HEADER_BG);
  doc.rect(MARGIN, y, CONTENT_W, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.3);
  color(doc, SLATE);
  let x = MARGIN;
  for (const c of cols) {
    const tx = c.align === 'right' ? x + c.w - 2 : c.align === 'center' ? x + c.w / 2 : x + 2;
    doc.text(c.label, tx, y + 4.3, { align: c.align || 'left' });
    x += c.w;
  }
  return y + 6.5;
}

function linhaTabela(
  doc: jsPDF,
  y: number,
  cols: Coluna[],
  cel: Array<{ t: string; cor?: Rgb; bold?: boolean }>,
  h: number,
  zebra: boolean,
) {
  if (zebra) {
    fill(doc, ROW_ALT);
    doc.rect(MARGIN, y, CONTENT_W, h, 'F');
  }
  let x = MARGIN;
  doc.setFontSize(7);
  cols.forEach((c, i) => {
    const v = cel[i];
    doc.setFont('helvetica', v.bold ? 'bold' : 'normal');
    color(doc, v.cor || NAVY);
    const s = cortar(doc, v.t, c.w - 4);
    const tx = c.align === 'right' ? x + c.w - 2 : c.align === 'center' ? x + c.w / 2 : x + 2;
    doc.text(s, tx, y + h / 2 + 1.2, { align: c.align || 'left' });
    x += c.w;
  });
  stroke(doc, LINE);
  doc.setLineWidth(0.12);
  doc.line(MARGIN, y + h, PAGE_W - MARGIN, y + h);
  return y + h;
}

function tituloSecao(doc: jsPDF, y: number, titulo: string, sub?: string) {
  fill(doc, ACCENT);
  doc.rect(MARGIN, y, 1.4, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  color(doc, NAVY);
  doc.text(txt(titulo), MARGIN + 4, y + 4.6);
  if (sub) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    color(doc, MUTED);
    doc.text(txt(sub), PAGE_W - MARGIN, y + 4.6, { align: 'right' });
  }
  return y + 9.5;
}

export type OpcoesPdfPrecoTabela = {
  dados: EstoquePedidosTabelaPeriodo;
  pedidos: EstoquePedidoTabela[];
  escopo: string;
  rede: boolean;
};

/** Relatório de cobrança: pedidos do eSupri cobrados acima da Tabela BKC. */
export async function gerarPdfPrecoTabela({ dados, pedidos, escopo, rede }: OpcoesPdfPrecoTabela): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const icone = await carregarIcone();
  const r = resumirPedidosTabela(pedidos);
  const periodo = `${data(dados.de)} a ${data(dados.ate)}`;
  const nomeTabelas = (r.tabelas.length ? r.tabelas : dados.tabelas || [dados.tabela]).join(' / ');
  const pctValor = r.valor_pedidos ? r.valor_acima / r.valor_pedidos : 0;

  fill(doc, NAVY);
  doc.rect(0, 0, PAGE_W, 34, 'F');
  fill(doc, ACCENT);
  doc.rect(0, 34, PAGE_W, 1, 'F');
  if (icone) doc.addImage(icone, 'PNG', MARGIN, 8, 11, 11);
  const tx = MARGIN + (icone ? 14 : 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  color(doc, GRUPO_TXT);
  doc.text('grupo', tx, 15.4);
  color(doc, ACCENT);
  doc.text('alvim', tx + doc.getTextWidth('grupo'), 15.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  color(doc, GRUPO_TXT);
  doc.text('RELATÓRIO DE COBRANÇA  ·  CONFIDENCIAL', PAGE_W - MARGIN, 10, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  color(doc, WHITE);
  doc.text('Preço cobrado acima da Tabela BKC', PAGE_W - MARGIN, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(190, 204, 226);
  doc.text(txt(`Pedidos eSupri · Platlog  ·  ${escopo}  ·  ${periodo}`), PAGE_W - MARGIN, 24.5, { align: 'right' });
  doc.setFontSize(7);
  color(doc, GRUPO_TXT);
  doc.text(
    txt(`Tabela ${nomeTabelas}${dados.vigencia_tabela ? ` vigente desde ${data(dados.vigencia_tabela)}` : ''}`),
    PAGE_W - MARGIN,
    29.5,
    { align: 'right' },
  );

  let y = 44;

  const heroH = 40;
  fill(doc, RED_SOFT);
  doc.roundedRect(MARGIN, y, CONTENT_W, heroH, 2, 2, 'F');
  fill(doc, RED);
  doc.rect(MARGIN, y, 2, heroH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  color(doc, RED);
  doc.text('VALOR COBRADO ACIMA DO PREÇO ACORDADO', MARGIN + 7, y + 8);
  doc.setFontSize(30);
  doc.text(txt(moeda(r.valor_acima)), MARGIN + 7, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.6);
  color(doc, SLATE);
  const frase = `Em ${inteiro(r.pedidos_acima)} de ${inteiro(r.pedidos)} pedidos do período, a Platlog cobrou acima da Tabela BKC em ${inteiro(r.acima)} de ${inteiro(r.itens_comparados)} itens comparados. O excedente equivale a ${pct(pctValor, 2)} de tudo que foi pedido (${moeda(r.valor_pedidos)}).`;
  doc.text(doc.splitTextToSize(txt(frase), CONTENT_W - 14), MARGIN + 7, y + 28.5);
  y += heroH + 6;

  const cards = [
    { rot: 'PEDIDOS ANALISADOS', val: inteiro(r.pedidos), dica: moedaCurta(r.valor_pedidos) },
    { rot: 'PEDIDOS COM SOBREPREÇO', val: inteiro(r.pedidos_acima), dica: `${pct(r.pedidos ? r.pedidos_acima / r.pedidos : 0, 0)} dos pedidos` },
    { rot: 'ITENS ACIMA DA TABELA', val: inteiro(r.acima), dica: `${pct(r.itens_comparados ? r.acima / r.itens_comparados : 0, 0)} dos itens` },
    { rot: rede ? 'LOJAS AFETADAS' : 'MÉDIA POR PEDIDO', val: rede ? inteiro(r.por_loja.filter((l) => l.valor_acima > 0).length) : moedaCurta(r.pedidos_acima ? r.valor_acima / r.pedidos_acima : 0), dica: rede ? `de ${r.por_loja.length} lojas` : 'nos pedidos afetados' },
    {
      rot: 'FRETE NA NF',
      val: r.frete.pedidos_com_nf ? moedaCurta(r.frete.valor) : '—',
      dica: r.frete.pedidos_com_nf
        ? `${r.frete.por_kg != null ? `${moeda(r.frete.por_kg)}/kg · ` : ''}${pct(r.frete.pct_nf || 0, 1)} da NF`
        : 'sem NF no período',
    },
  ];
  const gap = 3;
  const cw = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cw + gap);
    fill(doc, WHITE);
    stroke(doc, LINE);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, cw, 19, 1.5, 1.5, 'FD');
    fill(doc, NAVY);
    doc.rect(x, y, 1.2, 19, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    color(doc, SLATE_LIGHT);
    doc.text(c.rot, x + 4, y + 5);
    doc.setFontSize(14);
    color(doc, NAVY);
    doc.text(txt(c.val), x + 4, y + 12.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    color(doc, MUTED);
    doc.text(txt(c.dica), x + 4, y + 16.4);
  });
  y += 19 + 9;

  if (rede && r.por_loja.length > 1) {
    y = tituloSecao(doc, y, 'Sobrepreço por loja', `${r.por_loja.length} lojas`);
    const max = Math.max(...r.por_loja.map((l) => l.valor_acima), 1);
    const nomeW = 44;
    const valW = 30;
    const pctW = 18;
    const barW = CONTENT_W - nomeW - valW - pctW;
    for (const l of r.por_loja) {
      if (y + 6 > CONTENT_BOTTOM) {
        doc.addPage();
        y = MARGIN + 4;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.3);
      color(doc, NAVY);
      doc.text(cortar(doc, l.loja, nomeW - 2), MARGIN, y + 3.4);
      fill(doc, HEADER_BG);
      doc.roundedRect(MARGIN + nomeW, y + 0.8, barW - 3, 3.6, 0.8, 0.8, 'F');
      const w = Math.max(((barW - 3) * l.valor_acima) / max, 0.6);
      fill(doc, l === r.por_loja[0] ? RED : ACCENT);
      doc.roundedRect(MARGIN + nomeW, y + 0.8, w, 3.6, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      color(doc, NAVY);
      doc.text(txt(moeda(l.valor_acima)), MARGIN + nomeW + barW + valW - 2, y + 3.4, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      color(doc, MUTED);
      doc.text(pct(l.valor_pedidos ? l.valor_acima / l.valor_pedidos : 0, 2), PAGE_W - MARGIN, y + 3.4, { align: 'right' });
      y += 6;
    }
    doc.setFontSize(6.3);
    color(doc, SLATE_LIGHT);
    doc.text('% = valor cobrado a mais sobre o valor total dos pedidos da loja', PAGE_W - MARGIN, y + 2.5, { align: 'right' });
    y += 9;
  }

  const topItens = r.por_item.slice(0, rede ? 20 : 15);
  if (topItens.length) {
    if (y + 30 > CONTENT_BOTTOM) {
      doc.addPage();
      y = MARGIN + 4;
    }
    y = tituloSecao(doc, y, 'Itens que mais pesaram', `${r.por_item.length} produto(s) acima da tabela`);
    const cols: Coluna[] = [
      { label: 'CÓDIGO', w: 16 },
      { label: 'PRODUTO', w: 62 },
      { label: 'TABELA', w: 21, align: 'right' },
      { label: 'COBRADO (MÉD.)', w: 23, align: 'right' },
      { label: 'DIF.', w: 13, align: 'right' },
      { label: 'QTD', w: 13, align: 'right' },
      { label: rede ? 'LOJAS' : 'PEDIDOS', w: 13, align: 'right' },
      { label: 'A MAIS', w: CONTENT_W - 161, align: 'right' },
    ];
    y = cabecalhoTabela(doc, y, cols);
    topItens.forEach((it, i) => {
      if (y + 6 > CONTENT_BOTTOM) {
        doc.addPage();
        y = cabecalhoTabela(doc, MARGIN + 4, cols);
      }
      const dif = it.preco_tabela ? it.preco_medio_cobrado / it.preco_tabela - 1 : 0;
      y = linhaTabela(
        doc,
        y,
        cols,
        [
          { t: it.codigo, cor: MUTED },
          { t: it.descricao },
          { t: moeda(it.preco_tabela), cor: SLATE },
          { t: moeda(it.preco_medio_cobrado) },
          { t: `+${pct(dif)}`, cor: RED },
          { t: inteiro(it.quantidade), cor: SLATE },
          { t: inteiro(rede ? it.lojas : it.pedidos), cor: SLATE },
          { t: moeda(it.valor_acima), cor: RED, bold: true },
        ],
        6,
        i % 2 === 1,
      );
    });
    y += 8;
  }

  const rankLoja = new Map(r.por_loja.map((l, i) => [l.id_loja, i]));
  const comSobre = pedidos
    .filter((p) => p.preco.acima > 0)
    .sort((a, b) =>
      rede
        ? (rankLoja.get(a.id_loja) ?? 0) - (rankLoja.get(b.id_loja) ?? 0) || a.data_pedido.localeCompare(b.data_pedido)
        : b.preco.valor_acima - a.preco.valor_acima,
    );
  if (rede && comSobre.length) {
    doc.addPage();
    y = MARGIN + 4;
    y = tituloSecao(doc, y, 'Pedidos com sobrepreço por loja', `${comSobre.length} pedido(s) · itens no relatório de cada loja`);
    const cols: Coluna[] = [
      { label: 'PEDIDO', w: 26 },
      { label: 'DATA', w: 24 },
      { label: 'VALOR DO PEDIDO', w: 36, align: 'right' },
      { label: 'ITENS ACIMA', w: 30, align: 'right' },
      { label: '% DO PEDIDO', w: 26, align: 'right' },
      { label: 'A MAIS', w: CONTENT_W - 142, align: 'right' },
    ];
    for (const l of r.por_loja) {
      const ps = comSobre.filter((p) => p.id_loja === l.id_loja);
      if (!ps.length) continue;
      if (y + 7.5 + 6.5 + 5.5 * Math.min(ps.length, 3) > CONTENT_BOTTOM) {
        doc.addPage();
        y = MARGIN + 4;
      }
      fill(doc, NAVY);
      doc.roundedRect(MARGIN, y, CONTENT_W, 7.5, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      color(doc, WHITE);
      doc.text(txt(l.loja), MARGIN + 3, y + 4.9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(190, 204, 226);
      doc.text(
        txt(`${l.pedidos_acima} de ${l.pedidos} pedidos  ·  ${inteiro(l.acima)} itens acima`),
        MARGIN + 3 + doc.getTextWidth(txt(l.loja)) + 14,
        y + 4.9,
      );
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 186, 150);
      doc.text(txt(`+ ${moeda(l.valor_acima)}`), PAGE_W - MARGIN - 3, y + 4.9, { align: 'right' });
      y += 7.5;
      y = cabecalhoTabela(doc, y, cols);
      ps.forEach((p, i) => {
        if (y + 5.5 > CONTENT_BOTTOM) {
          doc.addPage();
          y = cabecalhoTabela(doc, MARGIN + 4, cols);
        }
        y = linhaTabela(
          doc,
          y,
          cols,
          [
            { t: p.codigo, bold: true },
            { t: data(p.data_pedido), cor: SLATE },
            { t: moeda(p.valor_total) },
            { t: `${p.preco.acima} de ${p.itens.length}`, cor: SLATE },
            { t: pct(p.valor_total ? p.preco.valor_acima / p.valor_total : 0, 2), cor: SLATE },
            { t: moeda(p.preco.valor_acima), cor: RED, bold: true },
          ],
          5.5,
          i % 2 === 1,
        );
      });
      y += 5;
    }
  }

  if (!rede && comSobre.length) {
    doc.addPage();
    y = MARGIN + 4;
    y = tituloSecao(doc, y, 'Detalhamento por pedido', `${comSobre.length} pedido(s) · só itens acima da tabela`);
    const cols: Coluna[] = [
      { label: 'CÓDIGO', w: 16 },
      { label: 'PRODUTO', w: 70 },
      { label: 'QTD', w: 14, align: 'right' },
      { label: 'COBRADO', w: 22, align: 'right' },
      { label: 'TABELA', w: 22, align: 'right' },
      { label: 'DIF. UNIT.', w: 20, align: 'right' },
      { label: 'A MAIS', w: CONTENT_W - 164, align: 'right' },
    ];
    for (const p of comSobre) {
      const itens = p.itens.filter((i) => i.situacao_preco === 'acima').sort((a, b) => (b.diferenca_total || 0) - (a.diferenca_total || 0));
      if (y + 8 + 6.5 + 5.5 * Math.min(itens.length, 3) > CONTENT_BOTTOM) {
        doc.addPage();
        y = MARGIN + 4;
      }
      fill(doc, NAVY);
      doc.roundedRect(MARGIN, y, CONTENT_W, 7.5, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      color(doc, WHITE);
      doc.text(txt(`Pedido ${p.codigo}`), MARGIN + 3, y + 4.9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(190, 204, 226);
      const info = `${rede ? `${nomeLojaCurto(p.loja)}  ·  ` : ''}${data(p.data_pedido)}  ·  pedido ${moeda(p.valor_total)}  ·  ${p.preco.acima} de ${p.itens.length} itens acima`;
      doc.text(txt(info), MARGIN + 3 + doc.getTextWidth(`Pedido ${p.codigo}`) + 12, y + 4.9);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 186, 150);
      doc.text(txt(`+ ${moeda(p.preco.valor_acima)}`), PAGE_W - MARGIN - 3, y + 4.9, { align: 'right' });
      y += 7.5;
      y = cabecalhoTabela(doc, y, cols);
      itens.forEach((it, i) => {
        if (y + 5.5 > CONTENT_BOTTOM) {
          doc.addPage();
          y = cabecalhoTabela(doc, MARGIN + 4, cols);
        }
        y = linhaTabela(
          doc,
          y,
          cols,
          [
            { t: it.codigo, cor: MUTED },
            { t: it.descricao },
            { t: inteiro(it.quantidade), cor: SLATE },
            { t: moeda(it.valor_unitario) },
            { t: moeda(it.preco_tabela), cor: SLATE },
            { t: `+${moeda(it.diferenca_unit)}`, cor: RED },
            { t: moeda(it.diferenca_total), cor: RED, bold: true },
          ],
          5.5,
          i % 2 === 1,
        );
      });
      y += 5;
    }
  }

  if (y + 22 > CONTENT_BOTTOM) {
    doc.addPage();
    y = MARGIN + 4;
  }
  stroke(doc, LINE);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  color(doc, NAVY);
  doc.text('Como foi calculado', MARGIN, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  color(doc, MUTED);
  const nota = [
    `Preço unitário de cada item do pedido no portal eSupri comparado com o preço da Tabela BKC da região da loja (BB5 Franquia N/NE/CO para DF e GO, BB4 Franquia S/SDE para MG), vigente na data do pedido. Valor a mais = (preço cobrado - preço da tabela) x quantidade pedida.`,
    `Pedidos cancelados não entram. Diferenças acima de 50% indicam unidade diferente entre pedido e tabela e ficaram fora do total${r.conferir_unidade ? ` (${r.conferir_unidade} item(ns) para conferir)` : ''}.`,
    `Frete = vFrete das NFs Platlog vinculadas ao pedido (${inteiro(r.frete.pedidos_com_nf)} de ${inteiro(r.pedidos)} pedidos já faturados), por kg de peso bruto da NF; não entra no valor a mais.`,
  ];
  doc.text(doc.splitTextToSize(txt(nota.join(' ')), CONTENT_W), MARGIN, y + 9.5);

  const total = doc.getNumberOfPages();
  const gerado = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    stroke(doc, LINE);
    doc.setLineWidth(0.25);
    doc.line(MARGIN, FOOTER_Y - 3.5, PAGE_W - MARGIN, FOOTER_Y - 3.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    color(doc, SLATE_LIGHT);
    doc.text('grupo', MARGIN, FOOTER_Y);
    const wGrupo = doc.getTextWidth('grupo');
    doc.setFont('helvetica', 'bold');
    color(doc, ACCENT);
    doc.text('alvim', MARGIN + wGrupo, FOOTER_Y);
    const wAlvim = doc.getTextWidth('alvim');
    doc.setFont('helvetica', 'normal');
    color(doc, SLATE_LIGHT);
    doc.text(txt(`  ·  MERIDIAN  ·  ${escopo}  ·  ${periodo}`), MARGIN + wGrupo + wAlvim, FOOTER_Y);
    doc.text(`${i} / ${total}  ·  ${gerado}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }

  const slug = escopo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  doc.save(`cobranca-tabela-bkc-${slug}-${dados.de}-a-${dados.ate}.pdf`);
}
