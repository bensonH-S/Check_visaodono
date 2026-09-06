/**
 * Relatório da semana de baixa total (fácil de ler).
 *
 * Uso:
 *   node scripts/relatorio-baixa-semana.mjs
 *   node scripts/relatorio-baixa-semana.mjs --html
 *
 * Lê a janela em estoque_observacao_baixa (ativo). Se não houver, usa últimos 7 dias.
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

function fmt(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(d));
}

function pct(a, b) {
  if (!b) return '—';
  return `${((100 * a) / b).toFixed(1)}%`;
}

const MOTIVO_PT = {
  INSUMO_NAO_CADASTRADO: 'Insumo sem cadastro ativo na loja',
  CONVERSAO_NAO_VALIDADA: 'Falta fator de conversão (und↔kg etc.)',
  CONVERSAO_BLOQUEADA: 'Conversão bloqueada de propósito',
  QUANTIDADE_INVALIDA: 'Quantidade inválida',
  FORA_PILOTO: 'Fora do piloto (não deveria aparecer com piloto off)',
};

let janela;
try {
  const { rows } = await pool.query(`
    SELECT id, iniciado_em, previsto_fim, observacao
    FROM estoque_observacao_baixa
    WHERE ativo = TRUE
    ORDER BY id DESC LIMIT 1
  `);
  janela = rows[0] || null;
} catch {
  janela = null;
}

const desde = janela?.iniciado_em || new Date(Date.now() - 7 * 864e5);
const ate = new Date();

const { rows: piloto } = await pool.query(`
  SELECT
    COUNT(*)::int AS lojas,
    COUNT(*) FILTER (WHERE COALESCE(piloto_baixa, TRUE))::int AS em_piloto,
    COUNT(*) FILTER (WHERE piloto_baixa = FALSE)::int AS baixa_total
  FROM lojas_estoque_perfil
`);

const { rows: vendas } = await pool.query(
  `
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE status = 'processada')::int AS processada,
    COUNT(*) FILTER (WHERE status = 'parcial')::int AS parcial,
    COUNT(*) FILTER (WHERE status = 'erro')::int AS erro,
    COUNT(*) FILTER (WHERE status = 'pendente')::int AS pendente
  FROM estoque_vendas
  WHERE data_venda >= ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
`,
  [desde],
);

const { rows: porLoja } = await pool.query(
  `
  SELECT
    l.id_loja,
    COALESCE(l.name, 'Loja '||l.id_loja) AS loja,
    l.bk_number,
    COUNT(v.id_venda)::int AS vendas,
    COUNT(*) FILTER (WHERE v.status = 'processada')::int AS processada,
    COUNT(*) FILTER (WHERE v.status = 'parcial')::int AS parcial,
    COUNT(*) FILTER (WHERE v.status = 'erro')::int AS erro
  FROM lojas l
  LEFT JOIN estoque_vendas v
    ON v.id_loja = l.id_loja
   AND v.data_venda >= ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
  WHERE l.bk_number IS NOT NULL AND TRIM(l.bk_number::text) <> ''
  GROUP BY l.id_loja, l.name, l.bk_number
  ORDER BY parcial DESC, vendas DESC
`,
  [desde],
);

const { rows: motivos } = await pool.query(
  `
  SELECT motivo, COUNT(*)::int AS n, COUNT(DISTINCT codigo_insumo)::int AS skus
  FROM estoque_baixa_pendencias
  WHERE criado_em >= $1
  GROUP BY motivo
  ORDER BY n DESC
`,
  [desde],
);

const { rows: topSku } = await pool.query(
  `
  SELECT
    p.codigo_insumo,
    p.motivo,
    COALESCE(MAX(i.descricao), MAX(fi.observacao), '(sem nome)') AS descricao,
    COUNT(*)::int AS n,
    COUNT(DISTINCT p.id_loja)::int AS lojas
  FROM estoque_baixa_pendencias p
  LEFT JOIN insumos i ON i.id_insumo = p.id_insumo
  LEFT JOIN LATERAL (
    SELECT observacao FROM ficha_tecnica_itens
    WHERE codigo_insumo = p.codigo_insumo LIMIT 1
  ) fi ON TRUE
  WHERE p.criado_em >= $1
  GROUP BY p.codigo_insumo, p.motivo
  ORDER BY n DESC
  LIMIT 30
`,
  [desde],
);

const { rows: topLojaPend } = await pool.query(
  `
  SELECT
    p.id_loja,
    COALESCE(l.name, 'Loja '||p.id_loja) AS loja,
    l.bk_number,
    COUNT(*)::int AS n
  FROM estoque_baixa_pendencias p
  JOIN lojas l ON l.id_loja = p.id_loja
  WHERE p.criado_em >= $1
  GROUP BY p.id_loja, l.name, l.bk_number
  ORDER BY n DESC
  LIMIT 15
`,
  [desde],
);

const { rows: semFicha } = await pool.query(
  `
  SELECT COUNT(*)::int AS n
  FROM estoque_venda_itens vi
  JOIN estoque_vendas v ON v.id_venda = vi.id_venda
  WHERE v.data_venda >= ($1::timestamptz AT TIME ZONE 'America/Sao_Paulo')::date
    AND vi.sem_ficha = TRUE
`,
  [desde],
);

const v = vendas[0] || { total: 0, processada: 0, parcial: 0, erro: 0, pendente: 0 };
const totalPend = motivos.reduce((s, m) => s + m.n, 0);

const data = {
  gerado_em: new Date().toISOString(),
  janela: {
    desde,
    ate,
    previsto_fim: janela?.previsto_fim || null,
    observacao: janela?.observacao || 'Últimos 7 dias (sem marcador de observação)',
  },
  piloto: piloto[0],
  vendas: { ...v, taxa_processada: pct(v.processada, v.total) },
  pendencias: { total: totalPend, por_motivo: motivos, top_sku: topSku, top_loja: topLojaPend },
  sem_ficha: semFicha[0]?.n || 0,
  por_loja: porLoja,
};

// —— Markdown legível ——
const md = [];
md.push(`# Relatório — Baixa total de estoque`);
md.push(``);
md.push(`Gerado em **${fmt(data.gerado_em)}** (horário de Brasília).`);
md.push(``);
md.push(`## Janela da observação`);
md.push(`- **Início:** ${fmt(desde)}`);
md.push(`- **Agora:** ${fmt(ate)}`);
if (janela?.previsto_fim) md.push(`- **Revisão marcada:** ${fmt(janela.previsto_fim)}`);
md.push(`- ${data.janela.observacao}`);
md.push(``);
md.push(`## Piloto`);
md.push(
  `- Lojas com **baixa total** (piloto off): **${data.piloto.baixa_total}** / ${data.piloto.lojas}`,
);
if (data.piloto.em_piloto > 0) {
  md.push(`- ⚠️ Ainda em piloto: **${data.piloto.em_piloto}** — não era para sobrar nenhuma.`);
}
md.push(``);
md.push(`## Como está a venda → estoque`);
md.push(``);
md.push(`| Situação | Qtde | O que significa |`);
md.push(`|----------|------|-----------------|`);
md.push(`| Processada | ${v.processada} | Baixou tudo que deu da ficha |`);
md.push(`| Parcial | ${v.parcial} | Baixou parte; algum insumo falhou |`);
md.push(`| Erro | ${v.erro} | Não baixou |`);
md.push(`| Pendente | ${v.pendente} | Ainda na fila |`);
md.push(`| **Total** | **${v.total}** | Taxa processada: **${pct(v.processada, v.total)}** |`);
md.push(``);
md.push(`Itens sem ficha técnica no período: **${data.sem_ficha}**`);
md.push(``);
md.push(`## Por que não baixou (pendências)`);
md.push(`Total de registros de falha desde o início: **${totalPend}**`);
md.push(``);
if (!motivos.length) {
  md.push(`Nenhuma pendência ainda — ótimo, ou ainda não vendeu depois do corte.`);
} else {
  md.push(`| Motivo | Em português | Ocorrências | SKUs distintos |`);
  md.push(`|--------|--------------|-------------|----------------|`);
  for (const m of motivos) {
    md.push(
      `| ${m.motivo} | ${MOTIVO_PT[m.motivo] || m.motivo} | ${m.n} | ${m.skus} |`,
    );
  }
}
md.push(``);
md.push(`## Top 30 insumos que mais travam`);
md.push(``);
if (!topSku.length) {
  md.push(`(vazio)`);
} else {
  md.push(`| # | Código | Nome | Motivo | Vezes | Lojas |`);
  md.push(`|---|--------|------|--------|-------|-------|`);
  topSku.forEach((r, i) => {
    md.push(
      `| ${i + 1} | ${r.codigo_insumo} | ${String(r.descricao).slice(0, 50)} | ${MOTIVO_PT[r.motivo] || r.motivo} | ${r.n} | ${r.lojas} |`,
    );
  });
}
md.push(``);
md.push(`## Lojas com mais falha de baixa`);
md.push(``);
if (!topLojaPend.length) {
  md.push(`(vazio)`);
} else {
  md.push(`| Loja | BKN | Pendências |`);
  md.push(`|------|-----|------------|`);
  for (const r of topLojaPend) {
    md.push(`| ${r.loja} | ${r.bk_number || '—'} | ${r.n} |`);
  }
}
md.push(``);
md.push(`## Vendas por loja (no período)`);
md.push(``);
md.push(`| Loja | BKN | Vendas | Processada | Parcial | Erro |`);
md.push(`|------|-----|--------|------------|---------|------|`);
for (const r of porLoja) {
  if (!r.vendas) continue;
  md.push(
    `| ${r.loja} | ${r.bk_number || '—'} | ${r.vendas} | ${r.processada} | ${r.parcial} | ${r.erro} |`,
  );
}
md.push(``);
md.push(`---`);
md.push(`### Como usar na revisão daqui a 1 semana`);
md.push(`1. Olhar **taxa processada** — meta: subir todo dia.`);
md.push(`2. Atacar o **Top 30** (reativar / cadastrar / criar fator / alias).`);
md.push(`3. Lojas no topo de falha = prioridade operacional.`);
md.push(`4. Rodar de novo: \`node scripts/relatorio-baixa-semana.mjs\``);

const outDir = path.join(__dirname, '_out_relatorio_baixa');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
  new Date(),
);
const base = path.join(outDir, `baixa-semana-${stamp}`);
fs.writeFileSync(`${base}.json`, JSON.stringify(data, null, 2), 'utf8');
fs.writeFileSync(`${base}.md`, md.join('\n'), 'utf8');
fs.writeFileSync(path.join(outDir, 'ULTIMO.md'), md.join('\n'), 'utf8');

if (wantHtml) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Baixa total — ${stamp}</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;max-width:960px;margin:32px auto;padding:0 16px;color:#1a1a1a;line-height:1.45}
h1{font-size:1.6rem;margin-bottom:4px} h2{margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{border-collapse:collapse;width:100%;font-size:0.92rem;margin:12px 0}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left} th{background:#f4f4f4}
.muted{color:#666;font-size:0.9rem} .kpi{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}
.kpi div{background:#f7f7f7;padding:12px 16px;border-radius:6px;min-width:120px}
.kpi b{display:block;font-size:1.4rem}
</style></head><body>
<h1>Relatório — Baixa total de estoque</h1>
<p class="muted">Gerado em ${esc(fmt(data.gerado_em))} · janela desde ${esc(fmt(desde))}</p>
<div class="kpi">
  <div><span class="muted">Processada</span><b>${v.processada}</b>${pct(v.processada, v.total)}</div>
  <div><span class="muted">Parcial</span><b>${v.parcial}</b></div>
  <div><span class="muted">Pendências</span><b>${totalPend}</b></div>
  <div><span class="muted">Piloto off</span><b>${data.piloto.baixa_total}/${data.piloto.lojas}</b></div>
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
        piloto_off: data.piloto.baixa_total,
        vendas: v,
        pendencias: totalPend,
        top3: topSku.slice(0, 3).map((r) => ({
          codigo: r.codigo_insumo,
          nome: r.descricao,
          n: r.n,
          motivo: r.motivo,
        })),
      },
    },
    null,
    2,
  ),
);

await pool.end();
