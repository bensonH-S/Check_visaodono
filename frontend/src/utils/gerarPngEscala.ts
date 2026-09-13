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

const W = 3600;
const MARGIN = 64;
const HEADER_H = 168;
const KPI_H = 108;
const DAY_H = 54;
const NAME_BAR = 88;
const CHIP_H = 96;
const CHIP_GAP = 18;
const CARD_PAD = 22;
const PERSON_GAP = 36;
const FOOTER_H = 72;
const RAIL = 14;

const NAVY = '#0b1a3b';
const NAVY_MID = '#1b2a6b';
const ACCENT = '#e8520a';
const GRUPO = '#a0b0c8';
const MUTED = '#475569';
const LINE = '#d8dee8';
const PAPER = '#eef1f6';
const CARD = '#ffffff';
const HEADER_BG = '#f4f6fb';

function hexRgb(hex?: string | null) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
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

type LojaLinha = { rotulo: string; marca: boolean };
type PessoaLinha = { p: EscalaAgendaPessoa; porDia: LojaLinha[][]; rowH: number };

function montarLinhas(pessoas: EscalaAgendaPessoa[]) {
  const ativas = pessoas.filter((p) => p.total > 0);
  const lojasUnicas = new Set<number>();
  let totalVisitas = 0;
  const linhas: PessoaLinha[] = ativas.map((p) => {
    const porDia = p.dias.map((d) =>
      d.lojas.map((l) => ({
        rotulo: rotuloBkLoja(l.bk, l.nome),
        marca: !ehLojaDeliveryNome(l.nome) && !/POPEYES|POPYES/i.test(l.nome || ''),
      })),
    );
    const maxLojas = Math.max(1, ...porDia.map((l) => l.length));
    totalVisitas += p.total;
    for (const d of p.dias) for (const l of d.lojas) lojasUnicas.add(l.id_loja);
    return {
      p,
      porDia,
      rowH: NAME_BAR + DAY_H + CARD_PAD * 2 + maxLojas * CHIP_H + Math.max(0, maxLojas - 1) * CHIP_GAP,
    };
  });
  return { ativas, linhas, totalVisitas, lojasUnicas };
}

export function alturaPngEscala(pessoas: EscalaAgendaPessoa[]) {
  const { linhas } = montarLinhas(pessoas);
  const gradeH = linhas.reduce((acc, r) => acc + r.rowH + PERSON_GAP, 0);
  return HEADER_H + 36 + KPI_H + 40 + gradeH + FOOTER_H;
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
  const { ativas, linhas, totalVisitas, lojasUnicas } = montarLinhas(pessoas);
  const [logo, logoBk] = await Promise.all([
    loadImage(assetUrl('Logo_Alvim_Icone.png')),
    loadImage(assetUrl('BK_logo.png')),
  ]);

  const periodo = periodoLongo(semanaInicio);
  const periodoCurto = semanaLabel || fmtSemanaCurta(semanaInicio);
  const hojeIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const dias = Array.from({ length: 7 }, (_, i) => fmtDataCurta(addDaysIso(semanaInicio, i)));
  const hojeIdx = dias.findIndex((_, i) => addDaysIso(semanaInicio, i) === hojeIso);
  const contentW = W - MARGIN * 2;
  const colDia = contentW / 7;
  const H = Math.max(alturaPngEscala(pessoas), 1400);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível gerar a imagem');

  desenharEscala(ctx, {
    logo,
    logoBk,
    linhas,
    ativas,
    totalVisitas,
    lojas: lojasUnicas.size,
    periodo,
    periodoCurto,
    dias,
    hojeIdx,
    contentW,
    colDia,
  });

  const arquivo = `escala-visitas-${fmtDataCurta(semanaInicio).replace('/', '-')}.png`;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar PNG'))), 'image/png');
  });
  await compartilharOuBaixar(blob, arquivo, 'Escala de visitas', `Escala de visitas — ${periodo}`, asShare);
}

function desenharEscala(
  ctx: CanvasRenderingContext2D,
  {
    logo,
    logoBk,
    linhas,
    ativas,
    totalVisitas,
    lojas,
    periodo,
    periodoCurto,
    dias,
    hojeIdx,
    contentW,
    colDia,
  }: {
    logo: CanvasImageSource | null;
    logoBk: CanvasImageSource | null;
    linhas: PessoaLinha[];
    ativas: EscalaAgendaPessoa[];
    totalVisitas: number;
    lojas: number;
    periodo: string;
    periodoCurto: string;
    dias: string[];
    hojeIdx: number;
    contentW: number;
    colDia: number;
  },
) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, ctx.canvas.height);

  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, HEADER_H, W, 8);

  if (logo) ctx.drawImage(logo, MARGIN, 48, 72, 72);
  ctx.font = '700 42px "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GRUPO;
  const marcaX = MARGIN + (logo ? 92 : 0);
  ctx.fillText('grupo', marcaX, 86);
  const grupoW = ctx.measureText('grupo').width;
  ctx.fillStyle = ACCENT;
  ctx.fillText('alvim', marcaX + grupoW, 86);

  ctx.textAlign = 'right';
  ctx.fillStyle = GRUPO;
  ctx.font = '700 20px "Segoe UI", Arial, sans-serif';
  ctx.fillText('ESCALA DA SEMANA', W - MARGIN, 52);
  ctx.fillStyle = PAPER;
  ctx.font = '700 46px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Escala de visitas', W - MARGIN, 98);
  ctx.fillStyle = GRUPO;
  ctx.font = '500 24px "Segoe UI", Arial, sans-serif';
  ctx.fillText(periodo, W - MARGIN, 138);
  ctx.textAlign = 'left';

  const kpis = [
    { label: 'VISITAS', value: String(totalVisitas), hint: 'na semana', dark: true },
    { label: 'PESSOAS', value: String(ativas.length), hint: 'em campo', dark: false },
    { label: 'LOJAS', value: String(lojas), hint: 'atendidas', dark: false },
    {
      label: 'MÉDIA / DIA',
      value: (totalVisitas / 7).toFixed(1).replace('.', ','),
      hint: 'visitas',
      dark: false,
    },
  ];
  const kpiY = HEADER_H + 36;
  const kpiGap = 20;
  const kpiW = (contentW - kpiGap * 3) / 4;
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (kpiW + kpiGap);
    if (kpi.dark) {
      ctx.fillStyle = NAVY;
      roundRect(ctx, x, kpiY, kpiW, KPI_H, 16);
      ctx.fill();
      ctx.fillStyle = ACCENT;
      ctx.fillRect(x, kpiY, 10, KPI_H);
      ctx.fillStyle = GRUPO;
      ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.label, x + 28, kpiY + 30);
      ctx.fillStyle = PAPER;
      ctx.font = '700 42px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.value, x + 28, kpiY + 66);
      ctx.fillStyle = GRUPO;
      ctx.font = '500 18px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.hint, x + 28, kpiY + 90);
    } else {
      ctx.fillStyle = CARD;
      roundRect(ctx, x, kpiY, kpiW, KPI_H, 16);
      ctx.fill();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 2;
      roundRect(ctx, x, kpiY, kpiW, KPI_H, 16);
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.font = '700 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.label, x + 28, kpiY + 30);
      ctx.fillStyle = NAVY;
      ctx.font = '700 42px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.value, x + 28, kpiY + 66);
      ctx.fillStyle = MUTED;
      ctx.font = '500 18px "Segoe UI", Arial, sans-serif';
      ctx.fillText(kpi.hint, x + 28, kpiY + 90);
    }
  });

  let y = kpiY + KPI_H + 40;

  if (!ativas.length) {
    ctx.fillStyle = MUTED;
    ctx.font = 'italic 28px "Segoe UI", Arial, sans-serif';
    ctx.fillText('Nenhuma visita lançada nesta semana.', MARGIN + 16, y + 48);
  }

  linhas.forEach((linha) => {
    const { p, porDia, rowH } = linha;
    const cor = hexRgb(p.cor);

    ctx.fillStyle = CARD;
    roundRect(ctx, MARGIN, y, contentW, rowH, 20);
    ctx.fill();
    ctx.save();
    roundRect(ctx, MARGIN, y, contentW, rowH, 20);
    ctx.clip();
    ctx.fillStyle = cor;
    ctx.fillRect(MARGIN, y, RAIL, rowH);
    ctx.restore();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    roundRect(ctx, MARGIN, y, contentW, rowH, 20);
    ctx.stroke();

    ctx.fillStyle = NAVY;
    ctx.font = '800 40px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    const dot = 18;
    const nameX = MARGIN + 36;
    ctx.beginPath();
    ctx.arc(nameX + dot / 2, y + NAME_BAR / 2, dot / 2, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.fillText(fitText(ctx, p.primeiroNome.toUpperCase(), contentW * 0.62), nameX + dot + 18, y + NAME_BAR / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = MUTED;
    ctx.font = '600 22px "Segoe UI", Arial, sans-serif';
    const meta = `${p.total} visita${p.total !== 1 ? 's' : ''}${p.grupo_nome ? `  ·  ${p.grupo_nome}` : ''}`;
    ctx.fillText(meta, W - MARGIN - 36, y + NAME_BAR / 2);
    ctx.textAlign = 'left';

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN + RAIL + 16, y + NAME_BAR);
    ctx.lineTo(W - MARGIN - 16, y + NAME_BAR);
    ctx.stroke();

    const dayY = y + NAME_BAR;
    for (let i = 0; i < 7; i += 1) {
      const x = MARGIN + i * colDia;
      if (i > 0) {
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, dayY + 8);
        ctx.lineTo(x, y + rowH - 10);
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = hojeIdx === i ? ACCENT : MUTED;
      ctx.font = '700 15px "Segoe UI", Arial, sans-serif';
      ctx.fillText(DIAS_ABREV[i].toUpperCase(), x + colDia / 2, dayY + 16);
      ctx.fillStyle = hojeIdx === i ? ACCENT : NAVY;
      ctx.font = '700 22px "Segoe UI", Arial, sans-serif';
      ctx.fillText(dias[i], x + colDia / 2, dayY + 38);
    }
    ctx.textAlign = 'left';

    const bodyY = dayY + DAY_H;

    for (let dia = 0; dia < 7; dia += 1) {
      const lojasDia = porDia[dia];
      const x = MARGIN + dia * colDia + 16;
      const innerW = colDia - 32;
      if (!lojasDia.length) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 26px "Segoe UI", Arial, sans-serif';
        ctx.fillText('Sem visita', x + innerW / 2, bodyY + CARD_PAD + CHIP_H / 2);
        ctx.textAlign = 'left';
        continue;
      }
      lojasDia.forEach((loja, idx) => {
        const ly = bodyY + CARD_PAD + idx * (CHIP_H + CHIP_GAP);
        ctx.fillStyle = HEADER_BG;
        roundRect(ctx, x, ly, innerW, CHIP_H, 12);
        ctx.fill();
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 1.5;
        roundRect(ctx, x, ly, innerW, CHIP_H, 12);
        ctx.stroke();
        ctx.fillStyle = cor;
        ctx.fillRect(x + 10, ly + 22, 6, CHIP_H - 44);
        const icon = 52;
        if (loja.marca && logoBk) {
          ctx.drawImage(logoBk, x + 24, ly + (CHIP_H - icon) / 2, icon, icon);
        }
        ctx.fillStyle = NAVY;
        ctx.font = '800 36px "Segoe UI", Arial, sans-serif';
        ctx.textBaseline = 'middle';
        const tx = loja.marca && logoBk ? x + 24 + icon + 12 : x + 26;
        ctx.fillText(fitText(ctx, loja.rotulo, innerW - (tx - x) - 12), tx, ly + CHIP_H / 2);
      });
    }

    y += rowH + PERSON_GAP;
  });

  const footerY = ctx.canvas.height - 36;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, footerY - 20);
  ctx.lineTo(W - MARGIN, footerY - 20);
  ctx.stroke();
  ctx.font = '500 20px "Segoe UI", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GRUPO;
  ctx.fillText('grupo', MARGIN, footerY);
  const wGrupo = ctx.measureText('grupo').width;
  ctx.fillStyle = ACCENT;
  ctx.font = '700 20px "Segoe UI", Arial, sans-serif';
  ctx.fillText('alvim', MARGIN + wGrupo, footerY);
  ctx.fillStyle = MUTED;
  ctx.font = '500 20px "Segoe UI", Arial, sans-serif';
  ctx.fillText('  ·  Vision Check', MARGIN + wGrupo + ctx.measureText('alvim').width, footerY);
  ctx.textAlign = 'center';
  ctx.fillText(`Escala de visitas  ·  ${periodoCurto}`, W / 2, footerY);
  ctx.textAlign = 'right';
  ctx.fillText(
    new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    W - MARGIN,
    footerY,
  );
  ctx.textAlign = 'left';
}

/** @deprecated use gerarPngEscala */
export const gerarPdfEscala = gerarPngEscala;
