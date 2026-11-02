import fs from 'fs';
import { jsPDF } from 'jspdf';
import { pool } from '../db.js';
import { findBrandAsset } from '../projectPaths.js';
import { sendMail } from './mailer.js';
import { SQL_ORDEM_PLANILHA } from './estoqueContagem.js';
import { listarStatusContagemRede } from './estoqueCiclo.js';
import { LIDERANCA_EMAIL } from './timeCampoRegional.js';
import { montarEmailsRelatorio } from './emailRelatorioConfig.js';

const MARGIN = 10;
const PAGE_W = 297;
const PAGE_H = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 8;
const CONTENT_BOTTOM = FOOTER_Y - 4;
const INK = [12, 12, 14];
const NAVY = [11, 26, 59];
const ACCENT = [232, 82, 10];
const SLATE = [71, 85, 105];
const MUTED = [100, 116, 139];
const LINE = [226, 232, 240];
const ROW_ALT = [248, 250, 252];
const HEADER_BG = [241, 245, 249];

const COL = { item: 145, und: 18, qtd: 38, unit: 38, valor: 38 };

function paint(doc, fn, c) {
  doc[fn](c[0], c[1], c[2]);
}

function pdfTxt(valor) {
  return String(valor ?? '').replace(/\u2014/g, '-').replace(/\u00a0/g, ' ');
}

function brl(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function qtd(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function dataBr(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : '—';
}

function clip(doc, texto, maxW) {
  const t = pdfTxt(texto);
  if (doc.getTextWidth(t) <= maxW) return t;
  let s = t;
  while (s.length > 1 && doc.getTextWidth(`${s}...`) > maxW) s = s.slice(0, -1);
  return `${s}...`;
}

function mesAtualSp(agora = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(agora);
  const ano = partes.find((p) => p.type === 'year')?.value;
  const mes = partes.find((p) => p.type === 'month')?.value;
  return `${ano}-${mes}`;
}

function dataMensal(mes) {
  const m = String(mes || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m)) return `${mesAtualSp()}-01`;
  return `${m}-01`;
}

async function garantirTabelaEnvio() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estoque_contagem_envio (
      id_contagem INTEGER PRIMARY KEY,
      id_loja INTEGER NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'completa',
      data_contagem DATE,
      enviado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      id_usuario INTEGER,
      destinatarios TEXT
    )
  `);
}

export async function usuarioPodeEnviarRelatorio(user) {
  const id = Number(user?.sub || user?.id_usuario);
  if (!id) return false;
  const { rows } = await pool.query(
    `SELECT email, cargo_aprovacao, perfil::text AS perfil
     FROM usuarios WHERE id_usuario = $1 AND ativo = TRUE`,
    [id],
  );
  const row = rows[0];
  if (!row) return false;
  const email = String(row.email || '').trim().toLowerCase();
  const cargo = String(row.cargo_aprovacao || row.perfil || '').trim().toLowerCase();
  if (['ceo', 'diretor', 'ti', 'dono'].includes(cargo)) return true;
  return [
    LIDERANCA_EMAIL.ceo,
    LIDERANCA_EMAIL.diretor,
    LIDERANCA_EMAIL.ti,
    'ti@grupoalvim.com.br',
    'benson.henrique@grupoalvim.com.br',
  ].includes(email);
}

async function destinatariosLoja(idLoja) {
  const { emails } = await montarEmailsRelatorio('estoque', [idLoja]);
  return emails;
}

async function carregarContagemFinalizada(idContagem) {
  const { rows: cab } = await pool.query(
    `SELECT c.id_contagem, c.id_loja, c.status, COALESCE(c.tipo, 'completa') AS tipo,
            c.data_contagem::text AS data_contagem, c.titulo, c.criado_em, c.finalizado_em,
            l.name AS loja_nome, l.bk_number AS loja_codigo, u.nome AS criado_por_nome
     FROM estoque_contagens c
     JOIN lojas l ON l.id_loja = c.id_loja
     LEFT JOIN usuarios u ON u.id_usuario = c.criado_por
     WHERE c.id_contagem = $1`,
    [idContagem],
  );
  const contagem = cab[0];
  if (!contagem) {
    const err = new Error('Contagem não encontrada');
    err.status = 404;
    throw err;
  }
  if (contagem.tipo !== 'completa') {
    const err = new Error('O envio é só da contagem mensal');
    err.status = 400;
    throw err;
  }
  if (contagem.status !== 'finalizada') {
    const err = new Error('Essa loja ainda não finalizou a contagem mensal');
    err.status = 400;
    throw err;
  }
  const { rows: itens } = await pool.query(
    `SELECT i.estoque_contado, p.codigo, p.descricao, p.unidade_contagem,
            COALESCE(p.valor_unidade, 0) AS valor_unidade,
            COALESCE(NULLIF(BTRIM(p.secao_contagem), ''), 'OUTROS') AS secao_contagem
     FROM estoque_itens i
     JOIN insumos p ON p.id_insumo = i.id_insumo
     WHERE i.id_contagem = $1
     ORDER BY ${SQL_ORDEM_PLANILHA}, i.id_item`,
    [idContagem],
  );
  const linhas = itens.map((i) => {
    const contado = i.estoque_contado == null ? null : Number(i.estoque_contado);
    const unit = Number(i.valor_unidade) || 0;
    return {
      codigo: i.codigo,
      descricao: i.descricao,
      und: i.unidade_contagem || '',
      qtd: contado,
      unit,
      valor: contado == null ? 0 : Math.round(contado * unit * 100) / 100,
      secao: String(i.secao_contagem || 'OUTROS'),
    };
  });
  const valor = Math.round(linhas.reduce((s, i) => s + i.valor, 0) * 100) / 100;
  return { contagem, linhas, valor };
}

function lerLogo(nome, w, h) {
  const logoPath = findBrandAsset(nome);
  if (!logoPath) return null;
  const buf = fs.readFileSync(logoPath);
  return { data: `data:image/png;base64,${buf.toString('base64')}`, w, h };
}

function logosRelatorio() {
  return {
    ga: lerLogo('Logo_GA_Laranja.png', 420, 315),
    meridian: lerLogo('Logo_Meridian_Gestao.png', 640, 214),
  };
}

function desenharMarcas(doc, logos, x, y, altura) {
  let cursor = x;
  if (logos?.ga) {
    const w = altura * (logos.ga.w / logos.ga.h);
    doc.addImage(logos.ga.data, 'PNG', cursor, y, w, altura, 'marca-ga', 'FAST');
    cursor += w + 2.4;
  }
  if (logos?.meridian) {
    const h = altura * 0.72;
    const w = h * (logos.meridian.w / logos.meridian.h);
    doc.addImage(logos.meridian.data, 'PNG', cursor, y + (altura - h) / 2, w, h, 'marca-meridian', 'FAST');
    cursor += w;
  }
  return cursor > x;
}

function gerarPdfBuffer({ contagem, linhas, valor, logos }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const lojaTxt = [contagem.loja_codigo, contagem.loja_nome].filter(Boolean).join(' · ') || 'Loja';
  doc.setProperties({
    title: `Contagem mensal · ${lojaTxt}`,
    author: 'Meridian',
    subject: 'Posição de estoque contada',
  });

  const faixa = () => {
    paint(doc, 'setFillColor', INK);
    doc.rect(0, 0, PAGE_W, 16, 'F');
    paint(doc, 'setFillColor', ACCENT);
    doc.rect(0, 16, PAGE_W, 0.8, 'F');
    desenharMarcas(doc, logos, MARGIN, 2.6, 11);
    paint(doc, 'setTextColor', [255, 255, 255]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Contagem mensal', PAGE_W - MARGIN, 7.2, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    paint(doc, 'setTextColor', [210, 214, 220]);
    doc.text(clip(doc, lojaTxt, 160), PAGE_W - MARGIN, 12.2, { align: 'right' });
    return 20.5;
  };

  const cabecaTabela = (y) => {
    paint(doc, 'setFillColor', HEADER_BG);
    doc.rect(MARGIN, y, CONTENT_W, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    paint(doc, 'setTextColor', MUTED);
    const headers = [
      ['ITEM', COL.item, 'left'],
      ['UND', COL.und, 'center'],
      ['QTD CONTADA', COL.qtd, 'right'],
      ['VALOR UNIT.', COL.unit, 'right'],
      ['VALOR DO ESTOQUE', COL.valor, 'right'],
    ];
    let x = MARGIN;
    for (const [t, w, align] of headers) {
      const tx = align === 'left' ? x + 2 : align === 'right' ? x + w - 2 : x + w / 2;
      doc.text(t, tx, y + 4.1, { align });
      x += w;
    }
    return y + 6.2;
  };

  let y = faixa();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  paint(doc, 'setTextColor', SLATE);
  doc.text(
    clip(
      doc,
      `${dataBr(contagem.data_contagem)}   ·   ${contagem.criado_por_nome || 'Contagem finalizada'}   ·   ${brl(valor)}`,
      CONTENT_W,
    ),
    MARGIN,
    y + 3,
  );
  y += 6;
  y = cabecaTabela(y);

  const rowH = 5.4;
  let secao = '';
  const garantir = (need) => {
    if (y + need <= CONTENT_BOTTOM) return;
    doc.addPage();
    y = faixa();
    y = cabecaTabela(y);
  };
  const faixaSecao = (nome, continua) => {
    paint(doc, 'setFillColor', INK);
    doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    paint(doc, 'setFillColor', ACCENT);
    doc.rect(MARGIN, y, 1.4, rowH, 'F');
    const totalSecao = linhas
      .filter((i) => i.secao === nome)
      .reduce((s, i) => s + i.valor, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    paint(doc, 'setTextColor', [255, 255, 255]);
    doc.text(clip(doc, `${nome.toUpperCase()}${continua ? '  ·  continua' : ''}`, CONTENT_W - 52), MARGIN + 4, y + 3.6);
    doc.setFont('helvetica', 'normal');
    doc.text(brl(totalSecao), PAGE_W - MARGIN - 2, y + 3.6, { align: 'right' });
    y += rowH;
  };

  linhas.forEach((item, idx) => {
    if (item.secao !== secao) {
      garantir(rowH * 2);
      faixaSecao(item.secao, false);
      secao = item.secao;
    }
    const antes = y;
    garantir(rowH);
    if (y < antes) faixaSecao(item.secao, true);
    if (idx % 2 === 1) {
      paint(doc, 'setFillColor', ROW_ALT);
      doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
    }
    const nome = item.codigo ? `${item.codigo}  ${item.descricao}` : item.descricao;
    const base = y + 3.6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    paint(doc, 'setTextColor', NAVY);
    doc.text(clip(doc, nome, COL.item - 4), MARGIN + 2, base);
    doc.setFont('helvetica', 'normal');
    paint(doc, 'setTextColor', SLATE);
    doc.text(pdfTxt(item.und || '—'), MARGIN + COL.item + COL.und / 2, base, { align: 'center' });
    paint(doc, 'setTextColor', NAVY);
    doc.setFont('helvetica', 'bold');
    doc.text(qtd(item.qtd), MARGIN + COL.item + COL.und + COL.qtd - 2, base, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    paint(doc, 'setTextColor', item.unit > 0 ? SLATE : MUTED);
    doc.text(brl(item.unit), MARGIN + COL.item + COL.und + COL.qtd + COL.unit - 2, base, { align: 'right' });
    paint(doc, 'setTextColor', item.valor > 0 ? NAVY : MUTED);
    doc.setFont('helvetica', item.valor > 0 ? 'bold' : 'normal');
    doc.text(brl(item.valor), PAGE_W - MARGIN - 2, base, { align: 'right' });
    paint(doc, 'setDrawColor', LINE);
    doc.setLineWidth(0.12);
    doc.line(MARGIN, y + rowH, MARGIN + CONTENT_W, y + rowH);
    y += rowH;
  });

  if (y + 8 > CONTENT_BOTTOM) {
    doc.addPage();
    y = faixa();
  }
  paint(doc, 'setFillColor', INK);
  doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  paint(doc, 'setTextColor', [255, 255, 255]);
  doc.text(`TOTAL DO ESTOQUE  ·  ${linhas.length} itens`, MARGIN + 3, y + 4.6);
  doc.text(brl(valor), PAGE_W - MARGIN - 3, y + 4.6, { align: 'right' });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    paint(doc, 'setTextColor', ACCENT);
    doc.text('Meridian', MARGIN, FOOTER_Y);
    doc.setFont('helvetica', 'normal');
    paint(doc, 'setTextColor', MUTED);
    doc.text(pdfTxt(lojaTxt), PAGE_W / 2, FOOTER_Y, { align: 'center' });
    doc.text(`${i} / ${total}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' });
  }
  return Buffer.from(doc.output('arraybuffer'));
}

function htmlEmail(contagem, valor) {
  const loja = [contagem.loja_codigo, contagem.loja_nome].filter(Boolean).join(' · ');
  return `<div style="margin:0;padding:24px 12px;background:#F4F7FB;font-family:Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E6EDF5;border-radius:16px;overflow:hidden">
      <div style="background:#0C0C0E;padding:20px 24px">
        <p style="margin:0;color:#E8520A;font-size:11px;font-weight:700;letter-spacing:.08em">MERIDIAN</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:22px">Contagem mensal</h1>
        <p style="margin:6px 0 0;color:#CBD5E1;font-size:14px">${loja}</p>
      </div>
      <div style="padding:22px 24px;color:#0F172A">
        <p style="margin:0 0 8px;font-size:15px">Posição de estoque contada em ${dataBr(contagem.data_contagem)}.</p>
        <p style="margin:0 0 8px;font-size:15px">Valor do estoque: <strong>${brl(valor)}</strong></p>
        <p style="margin:0;color:#64748B;font-size:13px">O detalhe de quantidade e valor está no PDF anexo.</p>
      </div>
    </div>
  </div>`;
}

export async function painelEnvioMensal(user, mes, idsPermitidos = null) {
  await garantirTabelaEnvio();
  const data = dataMensal(mes);
  const rede = await listarStatusContagemRede({
    idsPermitidos,
    tipo: 'completa',
    data,
    leve: true,
  });
  const ids = rede.lojas.map((l) => Number(l.id_contagem)).filter((id) => id > 0);
  let marcas = new Map();
  if (ids.length) {
    const { rows } = await pool.query(
      `SELECT id_contagem, enviado_em
       FROM estoque_contagem_envio
       WHERE id_contagem = ANY($1::int[])`,
      [ids],
    );
    marcas = new Map(rows.map((r) => [Number(r.id_contagem), r.enviado_em]));
  }
  const lojas = rede.lojas.map((l) => {
    const contou = l.status === 'contou';
    const enviadoEm = contou ? marcas.get(Number(l.id_contagem)) || null : null;
    return {
      id_loja: l.id_loja,
      bk_number: l.bk_number,
      name: l.name,
      status: l.status,
      id_contagem: contou ? l.id_contagem : null,
      criado_por_nome: l.criado_por_nome,
      enviado: Boolean(enviadoEm),
      enviado_em: enviadoEm,
    };
  });
  return {
    mes: data.slice(0, 7),
    data,
    pode_enviar: await usuarioPodeEnviarRelatorio(user),
    contaram: lojas.filter((l) => l.status === 'contou').length,
    pendentes: lojas.filter((l) => l.status !== 'contou').length,
    enviados: lojas.filter((l) => l.enviado).length,
    lojas,
  };
}

export async function bufferRelatorioMensal(idContagem) {
  const dados = await carregarContagemFinalizada(idContagem);
  return { dados, pdf: gerarPdfBuffer({ ...dados, logos: logosRelatorio() }) };
}

export async function pdfRelatorioMensal(idContagem, idsPermitidos = null) {
  const { dados, pdf } = await bufferRelatorioMensal(idContagem);
  const idLoja = Number(dados.contagem.id_loja);
  if (Array.isArray(idsPermitidos) && idsPermitidos.length && !idsPermitidos.includes(idLoja)) {
    const err = new Error('Sem acesso a essa loja');
    err.status = 403;
    throw err;
  }
  const dia = String(dados.contagem.data_contagem).slice(0, 10);
  return {
    pdf,
    filename: `contagem-mensal-${dados.contagem.loja_codigo || idLoja}-${dia}.pdf`,
  };
}

async function enviarUma(user, idContagem) {
  if (!(await usuarioPodeEnviarRelatorio(user))) {
    const err = new Error('Sem permissão para enviar o relatório');
    err.status = 403;
    throw err;
  }
  const { dados, pdf } = await bufferRelatorioMensal(idContagem);
  const destinatarios = await destinatariosLoja(dados.contagem.id_loja);
  if (!destinatarios.length) {
    const err = new Error('Nenhum destinatário para essa loja');
    err.status = 400;
    throw err;
  }
  const loja = [dados.contagem.loja_codigo, dados.contagem.loja_nome].filter(Boolean).join(' ');
  await sendMail({
    to: destinatarios,
    subject: `Contagem mensal ${loja} · ${dataBr(dados.contagem.data_contagem)}`,
    html: htmlEmail(dados.contagem, dados.valor),
    attachments: [
      {
        filename: `contagem-mensal-${dados.contagem.loja_codigo || dados.contagem.id_loja}-${String(dados.contagem.data_contagem).slice(0, 10)}.pdf`,
        content: pdf,
        contentType: 'application/pdf',
      },
    ],
  });
  await pool.query(
    `INSERT INTO estoque_contagem_envio
       (id_contagem, id_loja, tipo, data_contagem, id_usuario, destinatarios, enviado_em)
     VALUES ($1, $2, 'completa', $3::date, $4, $5, NOW())
     ON CONFLICT (id_contagem) DO UPDATE SET
       enviado_em = NOW(),
       id_usuario = EXCLUDED.id_usuario,
       destinatarios = EXCLUDED.destinatarios`,
    [
      dados.contagem.id_contagem,
      dados.contagem.id_loja,
      dados.contagem.data_contagem,
      Number(user?.sub || user?.id_usuario) || null,
      destinatarios.join(', '),
    ],
  );
  return {
    id_contagem: dados.contagem.id_contagem,
    id_loja: dados.contagem.id_loja,
    loja: dados.contagem.loja_nome,
    destinatarios,
  };
}

export async function enviarRelatorioMensal(user, idContagem) {
  await garantirTabelaEnvio();
  return enviarUma(user, idContagem);
}

export async function enviarRelatoriosMensaisPendentes(user, mes, idsPermitidos = null, idsContagem = null) {
  await garantirTabelaEnvio();
  if (!(await usuarioPodeEnviarRelatorio(user))) {
    const err = new Error('Sem permissão para enviar o relatório');
    err.status = 403;
    throw err;
  }
  const painel = await painelEnvioMensal(user, mes, idsPermitidos);
  const escolhidos = Array.isArray(idsContagem) && idsContagem.length
    ? new Set(idsContagem.map((id) => Number(id)).filter((id) => id > 0))
    : null;
  const fila = painel.lojas.filter((l) => {
    if (l.status !== 'contou' || !l.id_contagem) return false;
    if (escolhidos) return escolhidos.has(Number(l.id_contagem));
    return !l.enviado;
  });
  const enviados = [];
  const falhas = [];
  for (const loja of fila) {
    try {
      enviados.push(await enviarUma(user, loja.id_contagem));
    } catch (e) {
      falhas.push({ id_loja: loja.id_loja, loja: loja.name, erro: e.message });
    }
  }
  return {
    mes: painel.mes,
    enviados: enviados.length,
    falhas,
    sem_contagem: painel.pendentes,
  };
}
