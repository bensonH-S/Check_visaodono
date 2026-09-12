import { assetUrl } from '../config/paths';
import type { EscalaAgendaPessoa } from '../components/escalas/escalaAgendaModel';
import {
  addDaysIso,
  DIAS_ABREV,
  ehLojaDeliveryNome,
  fmtDataCurta,
  fmtSemanaCurta,
  rotuloBkLoja,
} from '../components/escalas/escalaVisitasUtils';

const W = 2480;
const MARGIN = 52;
const COL_PESSOA = 250;
const HEADER_H = 132;
const KPI_H = 88;
const DAY_H = 64;
const LINE_H = 40;
const ROW_PAD = 18;
const FOOTER_H = 56;

const NAVY = '#0b1a3b';
const NAVY_MID = '#1b2a6b';
const ACCENT = '#e8520a';
const GRUPO = '#a0b0c8';
const MUTED = '#64748b';
const LINE = '#e2e8f0';
const PAPER = '#ffffff';
const ROW_ALT = '#f8fafc';
const HEADER_BG = '#f1f5f9';
const TODAY_BG = '#fff7ed';

function hexRgb(hex?: string | null) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) {
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (h.length >= 6) return `#${h.slice(0, 6)}`;
  return NAVY_MID;
}

function periodoLongo(semanaInicio: string) {
  const fim = addDaysIso(semanaInicio, 6);
  const a = new Date(`${semanaInicio}T12:00:00`);
  const b = new Date(`${fim}T12:00:00`);
  const diaIni = a.toLocaleDateString('pt-BR', { day: 'numeric', timeZone: 'America/Sao_Paulo' });
  const fimTxt = b.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  });
  return `${diaIni} a ${fimTxt}`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function compartilharOuBaixar(
  blob: Blob,
  arquivo: string,
  title: string,
  text: string,
  asShare: boolean,
) {
  const file = new File([blob], arquivo, { type: 'image/png' });
  if (asShare && typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  baixarBlob(blob, arquivo);
}

export async function gerarPngEscala({
  pessoas,
  semanaInicio,
  semanaLabel,
  asShare = false,
}: {
  pessoas: EscalaAgendaPessoa[];
  semanaInicio: string;
  semanaLabel?: string | null;
  asShare?: boolean;
}) {
  const ativas = pessoas.filter((p) => p.total > 0);
  const [logo, logoBk] = await Promise.all([
    loadImage(assetUrl('Logo_Alvim_Icone.png')),
    loadImage(assetUrl('BK_logo.png')),
  ]);

  const periodo = periodoLongo(semanaInicio);
  const periodoCurto = semanaLabel || fmtSemanaCurta(semanaInicio);
  const hojeIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const dias = Array.from({ length: 7 }, (_, i) => fmtDataCurta(addDaysIso(semanaInicio, i)));
  const hojeIdx = dias.findIndex((_, i) => addDaysIso(semanaInicio, i) === hojeIso);

  const lojasUnicas = new Set<number>();
  let totalVisitas = 0;
  const linhas = ativas.map((p) => {
    const porDia = p.dias.map((d) =>
      d.lojas.map((l) => ({
        rotulo: rotuloBkLoja(l.bk, l.nome),
        marca: !ehLojaDeliveryNome(l.nome) && !/POPEYES|POPYES/i.test(l.nome || ''),
      })),
    );
    const maxLojas = Math.max(1, ...porDia.map((l) => l.length));
    totalVisitas += p.total;
    for (const d of p.dias) for (const l of d.lojas) lojasUnicas.add(l.id_loja);
    return { p, porDia, rowH: Math.max(76, ROW_PAD * 2 + maxLojas * LINE_H) };
  });

  const contentW = W - MARGIN * 2;
  const colDia = (contentW - COL_PESSOA) / 7;
  const gradeH = linhas.reduce((acc, r) => acc + r.rowH, 0);
  const H = HEADER_H + 28 + KPI_H + 28 + DAY_H + gradeH + 36 + FOOTER_H;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Math.max(H, 980);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível gerar a imagem');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, HEADER_H, W, 6);

  if (logo) ctx.drawImage(logo, MARGIN, 38, 56, 56);
  ctx.font = '700 34px "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GRUPO;
  const marcaX = MARGIN + (logo ? 72 : 0);
  ctx.fillText('grupo', marcaX, 68);
  const grupoW = ctx.measureText('grupo').width;
  ctx.fillStyle = ACCENT;
  ctx.fillText('alvim', marcaX + grupoW, 68);

  ctx.textAlign = 'right';
  ctx.fillStyle = GRUPO;
  ctx.font = '600 18px "Segoe UI", Arial, sans-serif';
  ctx.fillText('ESCALA DA SEMANA', W - MARGIN, 44);
  ctx.fillStyle = PAPER;
  ctx.font = '700 36px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Escala de visitas', W - MARGIN, 78);
  ctx.fillStyle = GRUPO;
  ctx.font = '500 20px "Segoe UI", Arial, sans-serif';
  ctx.fillText(periodo, W - MARGIN, 108);
  ctx.textAlign = 'left';

  const kpis = [
    { label: 'VISITAS', value: String(totalVisitas), hint: 'na semana', dark: true },
    { label: 'REGIONAIS', value: String(ativas.length), hint: 'em campo', dark: false },
    { label: 'LOJAS', value: String(lojasUnicas.size), hint: 'atendidas', dark: false },
    {
      label: 'MÉDIA / DIA',
      value: (totalVisitas / 7).toFixed(1).replace('.', ','),
      hint: 'visitas',
      dark: false,
    },
  ];
  const kpiY = HEADER_H + 28;
  const kpiGap = 16;
  const kpiW = (contentW - kpiGap * 3) / 4;
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (kpiW + kpiGap);
    if (kpi.dark) {
      ctx.fillStyle = NAVY;
      roundRect(ctx, x, kpiY, kpiW, KPI_H, 12);
      ctx.fill();
      ctx.fillStyle = ACCENT;
      ctx.fillRect(x, kpiY, 8, KPI_H);
      ctx.fillStyle = GRUPO;
      ctx.font = '700 14px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.label, x + 22, kpiY + 24);
      ctx.fillStyle = PAPER;
      ctx.font = '700 34px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.value, x + 22, kpiY + 54);
      ctx.fillStyle = GRUPO;
      ctx.font = '500 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.hint, x + 22, kpiY + 74);
    } else {
      ctx.fillStyle = ROW_ALT;
      roundRect(ctx, x, kpiY, kpiW, KPI_H, 12);
      ctx.fill();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, kpiY, kpiW, KPI_H, 12);
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = '700 14px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.label, x + 22, kpiY + 24);
      ctx.fillStyle = NAVY;
      ctx.font = '700 34px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.value, x + 22, kpiY + 54);
      ctx.fillStyle = MUTED;
      ctx.font = '500 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.hint, x + 22, kpiY + 74);
    }
  });

  let y = kpiY + KPI_H + 28;
  ctx.fillStyle = HEADER_BG;
  ctx.fillRect(MARGIN, y, contentW, DAY_H);
  ctx.fillStyle = NAVY;
  ctx.fillRect(MARGIN, y, 8, DAY_H);
  ctx.fillStyle = MUTED;
  ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('REGIONAL', MARGIN + 24, y + DAY_H / 2);

  for (let i = 0; i < 7; i += 1) {
    const x = MARGIN + COL_PESSOA + i * colDia;
    if (hojeIdx === i) {
      ctx.fillStyle = TODAY_BG;
      ctx.fillRect(x, y, colDia, DAY_H);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = hojeIdx === i ? ACCENT : MUTED;
    ctx.font = '700 15px "Segoe UI", Arial, sans-serif';
    ctx.fillText(DIAS_ABREV[i].toUpperCase(), x + colDia / 2, y + 22);
    ctx.fillStyle = hojeIdx === i ? ACCENT : NAVY;
    ctx.font = '700 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText(dias[i], x + colDia / 2, y + 46);
  }
  ctx.textAlign = 'left';
  y += DAY_H;

  if (!ativas.length) {
    ctx.fillStyle = MUTED;
    ctx.font = 'italic 22px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Nenhuma visita lançada nesta semana.', MARGIN + 16, y + 48);
  }

  linhas.forEach((linha, pi) => {
    const { p, porDia, rowH } = linha;
    if (pi % 2 === 0) {
      ctx.fillStyle = ROW_ALT;
      ctx.fillRect(MARGIN, y, contentW, rowH);
    }
    if (hojeIdx >= 0) {
      ctx.fillStyle = TODAY_BG;
      ctx.fillRect(MARGIN + COL_PESSOA + hojeIdx * colDia, y, colDia, rowH);
    }
    ctx.fillStyle = hexRgb(p.cor);
    ctx.fillRect(MARGIN, y, 8, rowH);

    ctx.fillStyle = NAVY;
    ctx.font = '700 22px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(fitText(ctx, p.primeiroNome, COL_PESSOA - 36), MARGIN + 24, y + 18);
    ctx.fillStyle = MUTED;
    ctx.font = '500 15px "Segoe UI", Arial, sans-serif';
    const meta = `${p.total} visita${p.total !== 1 ? 's' : ''}${p.grupo_nome ? ` · ${p.grupo_nome}` : ''}`;
    ctx.fillText(fitText(ctx, meta, COL_PESSOA - 36), MARGIN + 24, y + 46);

    for (let dia = 0; dia < 7; dia += 1) {
      const lojas = porDia[dia];
      const x = MARGIN + COL_PESSOA + dia * colDia + 14;
      if (!lojas.length) {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '500 22px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('—', x + (colDia - 28) / 2, y + rowH / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        continue;
      }
      lojas.forEach((loja, idx) => {
        const ly = y + ROW_PAD + idx * LINE_H;
        const icon = 26;
        if (loja.marca && logoBk) {
          ctx.drawImage(logoBk, x, ly + 2, icon, icon);
        }
        ctx.fillStyle = NAVY;
        ctx.font = '700 18px "Segoe UI", Arial, sans-serif';
        ctx.textBaseline = 'middle';
        const tx = loja.marca && logoBk ? x + icon + 10 : x;
        ctx.fillText(fitText(ctx, loja.rotulo, colDia - (tx - x) - 22), tx, ly + icon / 2 + 2);
      });
    }

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN, y + rowH);
    ctx.lineTo(W - MARGIN, y + rowH);
    ctx.stroke();
    y += rowH;
  });

  y += 28;
  ctx.fillStyle = MUTED;
  ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('LEGENDA', MARGIN, y);
  let lx = MARGIN + 110;
  for (const { p } of linhas) {
    ctx.fillStyle = hexRgb(p.cor);
    ctx.beginPath();
    ctx.arc(lx + 8, y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
    ctx.fillText(p.primeiroNome, lx + 24, y);
    lx += ctx.measureText(p.primeiroNome).width + 48;
  }

  const footerY = canvas.height - 28;
  ctx.strokeStyle = LINE;
  ctx.beginPath();
  ctx.moveTo(MARGIN, footerY - 16);
  ctx.lineTo(W - MARGIN, footerY - 16);
  ctx.stroke();
  ctx.font = '500 16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = GRUPO;
  ctx.fillText('grupo', MARGIN, footerY);
  const wGrupo = ctx.measureText('grupo').width;
  ctx.fillStyle = ACCENT;
  ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
  ctx.fillText('alvim', MARGIN + wGrupo, footerY);
  ctx.fillStyle = MUTED;
  ctx.font = '500 16px "Segoe UI", Arial, sans-serif';
  ctx.fillText('  ·  Vision Check', MARGIN + wGrupo + ctx.measureText('alvim').width, footerY);
  ctx.textAlign = 'center';
  ctx.fillText(`Escala de visitas  ·  ${periodoCurto}`, W / 2, footerY);
  ctx.textAlign = 'right';
  ctx.fillText(
    new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    W - MARGIN,
    footerY,
  );
  ctx.textAlign = 'left';

  const arquivo = `escala-visitas-${fmtDataCurta(semanaInicio).replace('/', '-')}.png`;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar PNG'))), 'image/png');
  });
  await compartilharOuBaixar(blob, arquivo, 'Escala de visitas', `Escala de visitas — ${periodo}`, asShare);
}

/** @deprecated use gerarPngEscala */
export const gerarPdfEscala = gerarPngEscala;
