/**
 * Relatório da semana de baixa total (CLI) — mesma fonte do portal.
 *
 * Uso:
 *   node scripts/relatorio-baixa-semana.mjs
 *   node scripts/relatorio-baixa-semana.mjs --html
 *
 * Gera JSON + markdown em backend/scripts/_out_relatorio_baixa/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(__dirname, '../.env'), override: true });
process.env.NODE_ENV = 'production';
process.env.DB_NAME = 'vision_check';
if (!process.argv.includes('--production')) process.argv.push('--production');

const wantHtml = process.argv.includes('--html');

const { pool } = await import('../src/db.js');
const { montarSaudeBaixa } = await import('../src/services/estoqueSaudeBaixa.js');

function fmt(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(d));
}

const data = await montarSaudeBaixa({ escopo: 'rede' });
const v = data.resumo;
const problemas = data.problemas || [];
const breaks = data.breaks_com_aviso || [];
const vendasProb = data.vendas_com_problema || [];

const md = [];
md.push(`# Relatório — Baixa total de estoque`);
md.push(``);
md.push(`Gerado em **${fmt(data.gerado_em)}** (horário de Brasília).`);
md.push(``);
md.push(`## Janela`);
md.push(`- **Início:** ${fmt(data.janela?.desde)}`);
md.push(`- **Revisão:** ${fmt(data.janela?.previsto_fim)}`);
md.push(`- Piloto desligado: **${data.piloto_desligado ? 'sim' : 'não'}**`);
md.push(``);
md.push(`## Vendas → estoque`);
md.push(`| Situação | Qtde |`);
md.push(`|----------|------|`);
md.push(`| Processada (OK) | ${v.processada} |`);
md.push(`| Parcial | ${v.parcial} |`);
md.push(`| Erro | ${v.erro} |`);
md.push(`| Taxa OK | ${v.taxa_processada_pct ?? '—'}% |`);
md.push(`| Sem ficha | ${v.sem_ficha} |`);
md.push(`| Pendências | ${v.pendencias} |`);
md.push(`| Breaks com aviso | ${v.breaks_com_aviso ?? breaks.length} |`);
md.push(``);
md.push(`## O que resolver (Top insumos)`);
md.push(``);
if (!problemas.length) {
  md.push(`(vazio)`);
} else {
  md.push(`| Código | Nome | Problema | O que fazer | Vezes |`);
  md.push(`|--------|------|----------|-------------|-------|`);
  for (const p of problemas.slice(0, 30)) {
    md.push(
      `| ${p.codigo} | ${String(p.nome).slice(0, 40)} | ${p.problema} | ${p.o_que_fazer} | ${p.vezes} |`,
    );
  }
}
md.push(``);
md.push(`## Break / desperdício com pendência`);
md.push(``);
if (!breaks.length) {
  md.push(`(vazio)`);
} else {
  md.push(`| Data | Break | Loja | Tipo | Aviso |`);
  md.push(`|------|-------|------|------|-------|`);
  for (const b of breaks) {
    const av = (b.avisos && b.avisos[0]) || b.avisos_texto || '';
    md.push(
      `| ${b.data_break} | #${b.id_break} | ${b.id_loja} | ${b.tipo} | ${String(av).slice(0, 80)} |`,
    );
  }
}
md.push(``);
md.push(`## Vendas com problema`);
md.push(``);
if (!vendasProb.length) {
  md.push(`(vazio)`);
} else {
  md.push(`| Data | Venda | Loja | Status | Erro |`);
  md.push(`|------|-------|------|--------|------|`);
  for (const x of vendasProb.slice(0, 40)) {
    md.push(
      `| ${x.data_venda} | #${x.id_venda} | ${x.id_loja} | ${x.status} | ${String(x.erros || '').slice(0, 60)} |`,
    );
  }
}

const outDir = path.join(__dirname, '_out_relatorio_baixa');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const base = path.join(outDir, `baixa-semana-${stamp}`);
fs.writeFileSync(`${base}.json`, JSON.stringify(data, null, 2), 'utf8');
fs.writeFileSync(`${base}.md`, md.join('\n'), 'utf8');
fs.writeFileSync(path.join(outDir, 'ULTIMO.md'), md.join('\n'), 'utf8');

if (wantHtml) {
  const esc = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Baixa ${stamp}</title>
<style>body{font-family:Segoe UI,sans-serif;max-width:960px;margin:32px auto;padding:0 16px;line-height:1.45}
table{border-collapse:collapse;width:100%;font-size:0.9rem}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f4f4f4}
.kpi{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.kpi div{background:#f7f7f7;padding:12px 16px;border-radius:6px}
.kpi b{display:block;font-size:1.4rem}.muted{color:#666}</style></head><body>
<h1>Baixa total — ${stamp}</h1>
<p class="muted">${esc(fmt(data.gerado_em))}</p>
<div class="kpi">
<div><span class="muted">Processada</span><b>${v.processada}</b></div>
<div><span class="muted">Parcial</span><b>${v.parcial}</b></div>
<div><span class="muted">Pendências</span><b>${v.pendencias}</b></div>
<div><span class="muted">Breaks aviso</span><b>${v.breaks_com_aviso ?? breaks.length}</b></div>
</div>
<pre style="white-space:pre-wrap;font-family:inherit">${esc(md.join('\n'))}</pre>
</body></html>`;
  fs.writeFileSync(`${base}.html`, html, 'utf8');
  fs.writeFileSync(path.join(outDir, 'ULTIMO.html'), html, 'utf8');
}

console.log(
  JSON.stringify(
    {
      ok: true,
      arquivos: {
        md: `${base}.md`,
        json: `${base}.json`,
        ultimo: path.join(outDir, 'ULTIMO.md'),
        html: wantHtml ? `${base}.html` : null,
      },
      resumo: {
        vendas: { processada: v.processada, parcial: v.parcial, pendencias: v.pendencias },
        breaks_com_aviso: v.breaks_com_aviso ?? breaks.length,
        top3: problemas.slice(0, 3).map((p) => ({ codigo: p.codigo, n: p.vezes })),
      },
    },
    null,
    2,
  ),
);

await pool.end();
