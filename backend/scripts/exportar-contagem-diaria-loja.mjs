/**
 * Exporta a última contagem diária da loja (ou um id_contagem) para Excel.
 * Uso: node scripts/exportar-contagem-diaria-loja.mjs --bkn=23531
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
};

const bkn = arg('bkn') || '23531';
const idContagemArg = arg('id');

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'vision_check',
  port: Number(process.env.DB_PORT || 5432),
  ssl: false,
});

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function qtdTerraco(caixa, pc, kg, undCx, undPc) {
  const base = undCx > 0 ? undCx : 1;
  const parcial = undPc > 0 ? undPc : 1;
  const c = num(caixa) ?? 0;
  const p = num(pc) ?? 0;
  const k = num(kg) ?? 0;
  if (caixa == null && pc == null && kg == null) return null;
  return Math.round((c * base + p * parcial + k) * 10000) / 10000;
}

function fmtData(iso) {
  if (!iso) return '';
  const s =
    iso instanceof Date ? iso.toISOString().slice(0, 10) : String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function fmtHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

try {
  const { rows: lojaRows } = await pool.query(
    `SELECT id_loja, name, bk_number FROM lojas
     WHERE bk_number::text = $1 OR id_loja::text = $1
     LIMIT 1`,
    [bkn],
  );
  if (!lojaRows.length) throw new Error(`Loja ${bkn} não encontrada`);
  const loja = lojaRows[0];

  const contagemSql = idContagemArg
    ? `SELECT c.*, u.nome AS criado_por_nome
       FROM estoque_contagens c
       LEFT JOIN usuarios u ON u.id_usuario = c.criado_por
       WHERE c.id_contagem = $1`
    : `SELECT c.*, u.nome AS criado_por_nome
       FROM estoque_contagens c
       LEFT JOIN usuarios u ON u.id_usuario = c.criado_por
       WHERE c.id_loja = $1 AND COALESCE(c.tipo, 'completa') = 'diaria'
       ORDER BY c.data_contagem DESC NULLS LAST, c.criado_em DESC, c.id_contagem DESC
       LIMIT 1`;

  const { rows: contagens } = await pool.query(
    contagemSql,
    [idContagemArg ? Number(idContagemArg) : loja.id_loja],
  );
  if (!contagens.length) throw new Error('Nenhuma contagem diária encontrada');
  const c = contagens[0];

  const { rows: itens } = await pool.query(
    `SELECT i.id_item, i.estoque_sistema, i.estoque_contado,
            i.contagem_caixa, i.contagem_pc_fd, i.contagem_kg_und,
            p.codigo, p.descricao, p.unidade_contagem, p.secao_contagem,
            p.ordem_contagem, p.preco_caixa, p.valor_unidade,
            COALESCE(p.und_convertida, 1) AS und_convertida,
            COALESCE(p.und_parcial, 1) AS und_parcial
     FROM estoque_itens i
     JOIN insumos p ON p.id_insumo = i.id_insumo
     WHERE i.id_contagem = $1
     ORDER BY COALESCE(p.secao_contagem, 'ZZZ'), COALESCE(p.ordem_contagem, 9999), p.descricao, i.id_item`,
    [c.id_contagem],
  );

  const { rows: vendas } = await pool.query(
    `SELECT MAX(v.data_venda)::text AS ultima_data,
            MAX(COALESCE(v.processado_em, v.criado_em)) AS ultimo_sync
     FROM estoque_vendas v
     WHERE v.id_loja = $1`,
    [loja.id_loja],
  );

  const linhas = [
    ['Loja', `${loja.bk_number} — ${loja.name}`],
    ['Contagem', c.titulo || `#${c.id_contagem}`],
    ['Tipo', c.tipo || 'diaria'],
    ['Status', c.status],
    ['Data', fmtData(c.data_contagem)],
    ['Iniciada', fmtHora(c.criado_em)],
    ['Finalizada', fmtHora(c.finalizado_em)],
    ['Realizado por', c.criado_por_nome || ''],
    [],
    [
      'Seção',
      'Código',
      'Item',
      'UND',
      'CAIXA',
      'PC/FD',
      'KG/UND',
      'QTD',
      'Sistema',
      'Diferença',
      'Valor un.',
      'Valor estoque',
    ],
  ];

  let totalValor = 0;
  let divergencias = 0;
  const resumoItens = [];
  for (const i of itens) {
    const undCx = Number(i.und_convertida) || 1;
    const undPc = Number(i.und_parcial) || 1;
    const qtd =
      i.estoque_contado != null
        ? num(i.estoque_contado)
        : qtdTerraco(i.contagem_caixa, i.contagem_pc_fd, i.contagem_kg_und, undCx, undPc);
    const sist = num(i.estoque_sistema) ?? 0;
    const dif = qtd == null ? null : Math.round((qtd - sist) * 10000) / 10000;
    const valorUn = num(i.valor_unidade) ?? 0;
    const valor = qtd == null ? null : Math.round(qtd * valorUn * 100) / 100;
    if (valor != null) totalValor += valor;
    if (dif != null && dif !== 0) divergencias += 1;
    resumoItens.push({
      codigo: i.codigo,
      item: i.descricao,
      caixa: num(i.contagem_caixa),
      pc: num(i.contagem_pc_fd),
      kg: num(i.contagem_kg_und),
      qtd,
      sistema: sist,
      dif,
    });
    linhas.push([
      i.secao_contagem || '',
      i.codigo || '',
      i.descricao || '',
      i.unidade_contagem || '',
      num(i.contagem_caixa),
      num(i.contagem_pc_fd),
      num(i.contagem_kg_und),
      qtd,
      sist,
      dif,
      valorUn,
      valor,
    ]);
  }

  linhas.push([]);
  linhas.push(['Itens', itens.length, 'Divergências', divergencias, 'Valor atual', Math.round(totalValor * 100) / 100]);

  const ws = XLSX.utils.aoa_to_sheet(linhas);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 12 },
    { wch: 42 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contagem');

  const data = fmtData(c.data_contagem).replace(/\//g, '-');
  const out = path.join(root, `contagem-diaria-${loja.bk_number}-${data}.xlsx`);
  XLSX.writeFile(wb, out);

  const v = vendas[0] || {};
  console.log(JSON.stringify({
    ok: true,
    arquivo: out,
    id_contagem: c.id_contagem,
    titulo: c.titulo,
    status: c.status,
    itens: itens.length,
    divergencias,
    valor_atual: Math.round(totalValor * 100) / 100,
    realizado_por: c.criado_por_nome,
    iniciada: fmtHora(c.criado_em),
    finalizada: fmtHora(c.finalizado_em),
    ultima_venda: v.ultima_data || null,
    ultimo_sync_venda: v.ultimo_sync || null,
    linhas: resumoItens,
  }, null, 2));
} finally {
  await pool.end();
}
