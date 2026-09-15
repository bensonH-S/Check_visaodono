import { assetUrl } from '../config/paths';
import type { EscalaGestoresLinha } from '../api/client';
import { addDaysIso, DIAS_ABREV, fmtDataCurta, fmtSemanaCurta } from '../components/escalas/escalaVisitasUtils';
import { compartilharOuBaixar } from './gerarPngEscala';

const W = 3200;
const MARGIN = 56;
const HEADER_H = 150;
const ROW_H = 68;
const HEAD_H = 78;
const GROUP_H = 52;
const FOOTER_H = 64;
const NAVY = '#0b1a3b';
const ACCENT = '#e8520a';
const MUTED = '#475569';
const LINE = '#d8dee8';
const PAPER = '#eef1f6';
const CARD = '#ffffff';
const FOLGA_BG = '#fff4ea';
const FOLGA_FG = '#c2410c';

const TIPO_LABEL: Record<string, string> = {
  folga: 'Folga',
  ferias: 'Férias',
  falta: 'Falta',
  ausencia: 'Ausência',
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function periodoLongo(semanaInicio: string) {
  const fim = addDaysIso(semanaInicio, 6);
  const a = new Date(`${semanaInicio}T12:00:00`);
  const b = new Date(`${fim}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' };
  return `${a.toLocaleDateString('pt-BR', opts)} a ${b.toLocaleDateString('pt-BR', opts)}`;
}

function celulaTxt(d: EscalaGestoresLinha['dias'][number]) {
  if (d.tipo) return TIPO_LABEL[d.tipo] || d.tipo;
  if (d.hora_inicio && d.hora_fim) return `${d.hora_inicio} às ${d.hora_fim}`;
  return '—';
}

export async function gerarPngEscalaGestores({
  linhas,
  semanaInicio,
  semanaLabel,
  asShare = false,
}: {
  linhas: EscalaGestoresLinha[];
  semanaInicio: string;
  semanaLabel?: string | null;
  asShare?: boolean;
}) {
  const grupos = [
    { titulo: 'GESTORES', items: linhas.filter((l) => l.grupo !== 'campo') },
  ].filter((g) => g.items.length);
  const contentW = W - MARGIN * 2;
  const colBk = 150;
  const colNome = 380;
  const colFolga = 260;
  const colDia = (contentW - colBk - colNome - colFolga) / 7;
  const H =
    HEADER_H +
    24 +
    grupos.reduce((acc, g) => acc + GROUP_H + HEAD_H + g.items.length * ROW_H + 20, 0) +
    FOOTER_H;

  const [logo, logoBk] = await Promise.all([
    loadImageSafe(assetUrl('Logo_Alvim_Icone.png')),
    loadImageSafe(assetUrl('BK_logo.png')),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = Math.max(H, 1100);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível gerar a imagem');

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, HEADER_H);
  if (logo) ctx.drawImage(logo, MARGIN, 36, 72, 72);
  if (logoBk) ctx.drawImage(logoBk, W - MARGIN - 72, 40, 64, 64);
  ctx.fillStyle = '#fff';
  ctx.font = '700 22px "Segoe UI", Arial, sans-serif';
  ctx.fillText('AGENTE ALVIM', MARGIN + 92, 58);
  ctx.font = '800 42px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Escala dos gestores', MARGIN + 92, 108);
  ctx.textAlign = 'right';
  ctx.font = '700 22px "Segoe UI", Arial, sans-serif';
  ctx.fillText(semanaLabel || fmtSemanaCurta(semanaInicio), W - MARGIN - 88, 72);
  ctx.font = '600 18px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(periodoLongo(semanaInicio), W - MARGIN - 88, 102);
  ctx.textAlign = 'left';

  const hojeIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  let y = HEADER_H + 24;

  for (const grupo of grupos) {
    ctx.fillStyle = NAVY;
    roundRect(ctx, MARGIN, y, contentW, GROUP_H - 10, 12);
    ctx.fill();
    ctx.fillStyle = ACCENT;
    ctx.fillRect(MARGIN, y, 10, GROUP_H - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '800 22px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(grupo.titulo, MARGIN + 28, y + (GROUP_H - 10) / 2);
    y += GROUP_H;

    const headers = ['BKN', 'Gestor', ...DIAS_ABREV.map((d, i) => `${d} ${fmtDataCurta(addDaysIso(semanaInicio, i))}`), 'Folga'];
    const xs = [MARGIN, MARGIN + colBk, ...Array.from({ length: 7 }, (_, i) => MARGIN + colBk + colNome + i * colDia), MARGIN + colBk + colNome + 7 * colDia];
    const ws = [colBk, colNome, ...Array.from({ length: 7 }, () => colDia), colFolga];

    ctx.fillStyle = CARD;
    ctx.fillRect(MARGIN, y, contentW, HEAD_H);
    ctx.fillStyle = MUTED;
    ctx.font = '800 18px "Segoe UI", Arial, sans-serif';
    headers.forEach((h, i) => {
      ctx.textAlign = i < 2 ? 'left' : 'center';
      const tx = i < 2 ? xs[i] + 16 : xs[i] + ws[i] / 2;
      ctx.fillText(h.toUpperCase(), tx, y + HEAD_H / 2);
    });
    ctx.textAlign = 'left';
    y += HEAD_H;

    grupo.items.forEach((linha, idx) => {
      ctx.fillStyle = idx % 2 ? '#f7f8fb' : CARD;
      ctx.fillRect(MARGIN, y, contentW, ROW_H);
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN, y + ROW_H);
      ctx.lineTo(MARGIN + contentW, y + ROW_H);
      ctx.stroke();

      ctx.fillStyle = NAVY;
      ctx.font = '800 20px "Segoe UI", Arial, sans-serif';
      ctx.fillText(linha.bk_number || '—', xs[0] + 16, y + ROW_H / 2);
      ctx.fillText(linha.nome, xs[1] + 16, y + ROW_H / 2 - 8);
      ctx.fillStyle = MUTED;
      ctx.font = '600 16px "Segoe UI", Arial, sans-serif';
      ctx.fillText(linha.nome_loja ? String(linha.nome_loja).replace(/^BURGER KING\s*-?\s*/i, '') : '', xs[1] + 16, y + ROW_H / 2 + 14);

      ctx.textAlign = 'center';
      ctx.font = '700 18px "Segoe UI", Arial, sans-serif';
      linha.dias.forEach((d, i) => {
        const txt = celulaTxt(d);
        const off = Boolean(d.tipo);
        const hoje = addDaysIso(semanaInicio, d.dia) === hojeIso;
        if (off || hoje) {
          ctx.fillStyle = off ? FOLGA_BG : 'rgba(232,82,10,0.08)';
          roundRect(ctx, xs[2 + i] + 8, y + 12, ws[2 + i] - 16, ROW_H - 24, 10);
          ctx.fill();
        }
        ctx.fillStyle = off ? FOLGA_FG : NAVY;
        ctx.fillText(txt, xs[2 + i] + ws[2 + i] / 2, y + ROW_H / 2);
      });
      ctx.fillStyle = FOLGA_FG;
      ctx.font = '800 18px "Segoe UI", Arial, sans-serif';
      ctx.fillText(linha.folga_padrao || '—', xs[9] + ws[9] / 2, y + ROW_H / 2);
      ctx.textAlign = 'left';
      y += ROW_H;
    });
    y += 16;
  }

  ctx.fillStyle = MUTED;
  ctx.font = '600 16px "Segoe UI", Arial, sans-serif';
  ctx.fillText('Grupo Alvim · Visão do Dono  ·  Horário e folga conforme esta escala.', MARGIN, canvas.height - 28);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar PNG'))), 'image/png');
  });
  const texto =
    `*AGENTE ALVIM*\n\nEscala dos gestores — ${fmtSemanaCurta(semanaInicio)}\n\n` +
    'Horário e folga de cada loja precisam estar de acordo com esta escala. Desvio sem alinhamento é B.O.';
  await compartilharOuBaixar(
    blob,
    `escala-gestores-${fmtDataCurta(semanaInicio).replace('/', '-')}.png`,
    'Escala dos gestores',
    texto,
    asShare,
  );
}

function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
