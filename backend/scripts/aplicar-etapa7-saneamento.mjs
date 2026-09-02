/**
 * Etapa 7 — diagnóstico + saneamento cadastral (vision_check).
 * Não cria movimento nem altera saldo.
 *
 *   node scripts/aplicar-etapa7-saneamento.mjs
 *   node scripts/aplicar-etapa7-saneamento.mjs --apply
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../..');
const backendRoot = path.join(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(backendRoot, '.env'), override: true });

process.env.NODE_ENV = 'production';
process.env.DB_NAME = 'vision_check';
if (!process.argv.includes('--production')) process.argv.push('--production');

const APPLY = process.argv.includes('--apply');
const ID_VENANCIO = 6;

const { pool } = await import('../src/db.js');

function j(v) {
  return JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x), 2);
}

const FP_SQL = {
  saldos: `SELECT COUNT(*)::int n, COALESCE(SUM(quantidade),0)::numeric s FROM estoque_saldos`,
  movs: `SELECT COUNT(*)::int n, COALESCE(SUM(quantidade),0)::numeric s, COALESCE(MAX(id_movimento),0)::bigint m
     FROM estoque_movimentos`,
  conv: `SELECT COUNT(*)::int n, COALESCE(SUM(fator),0)::numeric s FROM estoque_conversoes`,
  cont: `SELECT COUNT(*)::int n, COALESCE(MAX(id_contagem),0)::bigint m FROM estoque_contagens`,
  itens: `SELECT COUNT(*)::int n, COALESCE(SUM(estoque_contado),0)::numeric s FROM estoque_itens`,
};

function montarFp(saldos, movs, conv, cont, itens) {
  return {
    saldos: { n: Number(saldos.n), s: String(saldos.s) },
    movs: { n: Number(movs.n), s: String(movs.s), m: String(movs.m) },
    conv: { n: Number(conv.n), s: String(conv.s) },
    contagens: { n: Number(cont.n), m: String(cont.m) },
    itens: { n: Number(itens.n), s: String(itens.s) },
  };
}

async function fingerprintFrom(db) {
  const q = async (sql) => (await db.query(sql)).rows[0];
  return montarFp(
    await q(FP_SQL.saldos),
    await q(FP_SQL.movs),
    await q(FP_SQL.conv),
    await q(FP_SQL.cont),
    await q(FP_SQL.itens),
  );
}

async function fingerprint() {
  return fingerprintFrom(pool);
}

async function verificarSaneamento(db) {
  const uf = await db.query(
    `SELECT COUNT(*)::int n,
            COUNT(*) FILTER (
              WHERE UPPER(COALESCE(NULLIF(BTRIM(unidade_fracionada), ''), unidade_contagem)) = 'UND'
            )::int n_und
     FROM insumos WHERE codigo = '35619'`,
  );
  const fator = await db.query(
    `SELECT COUNT(*)::int n,
            COUNT(*) FILTER (WHERE c.fator = 0.0115::numeric AND c.status = 'validado')::int n_ok
     FROM estoque_conversoes c
     JOIN insumos i ON i.id_insumo = c.id_insumo
     WHERE i.codigo = '35619'
       AND LOWER(c.unidade_origem) IN ('und', 'un')
       AND LOWER(c.unidade_destino) = 'kg'`,
  );
  const trc = await db.query(
    `SELECT COUNT(*)::int n,
            COUNT(*) FILTER (WHERE participa_contagem)::int n_contagem
     FROM insumos WHERE codigo = 'TRC-OVOMALTINEBKABCX9K'`,
  );
  const ovoAtivo = await db.query(
    `SELECT COUNT(*) FILTER (WHERE ativo)::int n_ativo
     FROM insumos WHERE codigo IN ('039300', 'TRC-OVOMALTINEBKABCX9K')`,
  );
  const fatia3029 = await db.query(
    `SELECT COUNT(*)::int n FROM ficha_tecnica_itens
     WHERE codigo_insumo = '3029' AND LOWER(BTRIM(unidade_receita)) = 'fatia'`,
  );
  const agua3029 = await db.query(
    `SELECT COUNT(*)::int n
     FROM ficha_tecnica_itens fi
     JOIN ficha_tecnica f ON f.id_ficha = fi.id_ficha
     JOIN produtos p ON p.id_produto = f.id_produto
     WHERE fi.codigo_insumo = '3029' AND p.codigo = '9049'
       AND LOWER(BTRIM(fi.unidade_receita)) IN ('und', 'un')`,
  );
  const cheddarFatia = await db.query(
    `SELECT COUNT(*)::int n FROM ficha_tecnica_itens
     WHERE codigo_insumo = '35619' AND observacao LIKE '%etapa7: 3029→35619%'`,
  );
  const pistacheErr = await db.query(
    `SELECT COUNT(*)::int n
     FROM ficha_tecnica_itens fi
     JOIN ficha_tecnica f ON f.id_ficha = fi.id_ficha
     JOIN produtos p ON p.id_produto = f.id_produto
     WHERE fi.codigo_insumo = '38454' AND p.codigo = '6005261'`,
  );
  const pistacheOk = await db.query(
    `SELECT COUNT(*)::int n
     FROM ficha_tecnica_itens fi
     JOIN ficha_tecnica f ON f.id_ficha = fi.id_ficha
     JOIN produtos p ON p.id_produto = f.id_produto
     WHERE fi.codigo_insumo = '38454' AND LOWER(BTRIM(fi.unidade_receita)) = 'kg'`,
  );
  const cheddarMolho = await db.query(
    `SELECT COUNT(*) FILTER (WHERE codigo = '039642' AND ativo)::int n_039642,
            COUNT(*) FILTER (WHERE codigo = '35610' AND ativo)::int n_35610,
            COUNT(*) FILTER (WHERE codigo = '35610' AND participa_contagem)::int n_35610_contagem
     FROM insumos WHERE codigo IN ('039642', '35610')`,
  );

  const row = (ok, detalhe) => ({ ok, detalhe });
  return {
    uf_35619: row(uf.rows[0].n > 0 && uf.rows[0].n_und === uf.rows[0].n, `${uf.rows[0].n_und}/${uf.rows[0].n} UND`),
    fator_35619: row(
      fator.rows[0].n > 0 && fator.rows[0].n_ok === fator.rows[0].n,
      `${fator.rows[0].n_ok}/${fator.rows[0].n} validado 0,0115`,
    ),
    trc_ovo_fora_contagem: row(trc.rows[0].n_contagem === 0, `participa=${trc.rows[0].n_contagem}/${trc.rows[0].n}`),
    ovo_ativo: row(ovoAtivo.rows[0].n_ativo > 0, `ativos=${ovoAtivo.rows[0].n_ativo}`),
    ficha_3029_fatia: row(fatia3029.rows[0].n === 0, `fatia restante=${fatia3029.rows[0].n}`),
    ficha_9049_agua: row(agua3029.rows[0].n > 0, `9049+3029=${agua3029.rows[0].n}`),
    ficha_35619_remap: row(cheddarFatia.rows[0].n > 0, `remap=${cheddarFatia.rows[0].n}`),
    ficha_38454_casquinha: row(pistacheErr.rows[0].n === 0, `casquinha+agua=${pistacheErr.rows[0].n}`),
    ficha_38454_kg: row(pistacheOk.rows[0].n > 0, `pistache kg=${pistacheOk.rows[0].n}`),
    cheddar_molho_separado: row(
      cheddarMolho.rows[0].n_039642 > 0 &&
        cheddarMolho.rows[0].n_35610 > 0 &&
        cheddarMolho.rows[0].n_35610_contagem > 0,
      `039642 ativos=${cheddarMolho.rows[0].n_039642}; 35610 ativos=${cheddarMolho.rows[0].n_35610} participa=${cheddarMolho.rows[0].n_35610_contagem}`,
    ),
  };
}

async function perfilSku(codigos) {
  const { rows } = await pool.query(
    `SELECT i.id_insumo, i.id_loja, l.name AS loja, i.codigo, i.descricao, i.ativo,
            i.unidade_contagem,
            COALESCE(NULLIF(BTRIM(i.unidade_fracionada), ''), i.unidade_contagem) AS unidade_fracionada,
            i.preco_caixa, i.und_convertida, i.und_parcial, i.valor_unidade, i.custo_fonte,
            i.participa_contagem, i.contagem_diaria, i.contagem_critica,
            COALESCE(s.quantidade, 0) AS saldo
     FROM insumos i
     JOIN lojas l ON l.id_loja = i.id_loja
     LEFT JOIN estoque_saldos s ON s.id_loja = i.id_loja AND s.id_insumo = i.id_insumo
     WHERE i.codigo = ANY($1::text[])
     ORDER BY i.codigo, i.id_loja`,
    [codigos],
  );
  return rows;
}

async function deps(codigo, idLoja = null) {
  const lojaFiltroIns = idLoja != null ? 'AND i.id_loja = $2' : '';
  const params = idLoja != null ? [codigo, idLoja] : [codigo];
  const fichas = await pool.query(
    `SELECT COUNT(*)::int n,
            COUNT(*) FILTER (WHERE f.ativo)::int n_ativas,
            COUNT(DISTINCT p.codigo)::int produtos
     FROM ficha_tecnica_itens fi
     JOIN ficha_tecnica f ON f.id_ficha = fi.id_ficha
     JOIN produtos p ON p.id_produto = f.id_produto
     JOIN insumos i ON i.id_loja = p.id_loja AND i.codigo = $1
     WHERE fi.codigo_insumo = $1 ${idLoja != null ? 'AND p.id_loja = $2' : ''}`,
    params,
  );
  const fichasLoja = await pool.query(
    `SELECT p.codigo AS produto, p.descricao, fi.quantidade, fi.unidade_receita, f.ativo,
            p.id_loja, f.criado_em, f.atualizado_em
     FROM ficha_tecnica_itens fi
     JOIN ficha_tecnica f ON f.id_ficha = fi.id_ficha
     JOIN produtos p ON p.id_produto = f.id_produto
     WHERE fi.codigo_insumo = $1 ${idLoja != null ? 'AND p.id_loja = $2' : ''}
     ORDER BY p.id_loja, p.codigo
     LIMIT 40`,
    params,
  );
  const vendas = await pool.query(
    `SELECT COUNT(*)::int n, COALESCE(SUM(vi.qtde),0)::numeric qtde
     FROM estoque_venda_itens vi
     JOIN estoque_vendas v ON v.id_venda = vi.id_venda
     WHERE vi.codigo = $1 ${idLoja != null ? 'AND v.id_loja = $2' : ''}`,
    params,
  );
  const movs = await pool.query(
    `SELECT COUNT(*)::int n, COALESCE(SUM(m.quantidade),0)::numeric s,
            MIN(m.data_movimento) AS de, MAX(m.data_movimento) AS ate
     FROM estoque_movimentos m
     JOIN insumos i ON i.id_insumo = m.id_insumo
     WHERE i.codigo = $1 ${lojaFiltroIns}`,
    params,
  );
  const convs = await pool.query(
    `SELECT c.unidade_origem, c.unidade_destino, c.fator, c.status, i.id_loja, i.codigo
     FROM estoque_conversoes c
     JOIN insumos i ON i.id_insumo = c.id_insumo
     WHERE i.codigo = $1 ${lojaFiltroIns}
     ORDER BY i.id_loja, c.unidade_origem`,
    params,
  );
  const nfe = await pool.query(
    `SELECT COUNT(*)::int n, MAX(n.emissao) AS ultima,
            MAX(ni.codigo_nf) AS codigo_nf, MAX(ni.descricao) AS desc_nf
     FROM estoque_nfe_itens ni
     JOIN estoque_nfe n ON n.id_nfe = ni.id_nfe
     JOIN insumos i ON i.id_insumo = ni.id_insumo
     WHERE i.codigo = $1 ${lojaFiltroIns}`,
    params,
  );
  const nfeCodigo = await pool.query(
    `SELECT COUNT(*)::int n, MAX(ni.codigo_nf) codigo_nf, MAX(ni.descricao) desc_nf
     FROM estoque_nfe_itens ni
     WHERE ni.codigo_nf = $1 OR ni.codigo_nf = $1`,
    [codigo],
  );
  const contagem = await pool.query(
    `SELECT COUNT(*)::int n,
            COUNT(*) FILTER (WHERE c.status = 'finalizada')::int n_fin
     FROM estoque_itens ei
     JOIN estoque_contagens c ON c.id_contagem = ei.id_contagem
     JOIN insumos i ON i.id_insumo = ei.id_insumo
     WHERE i.codigo = $1 ${lojaFiltroIns}`,
    params,
  );
  return {
    fichas: fichas.rows[0],
    fichas_amostra: fichasLoja.rows,
    vendas: vendas.rows[0],
    movs: movs.rows[0],
    convs: convs.rows,
    nfe: nfe.rows[0],
    nfe_codigo: nfeCodigo.rows[0],
    contagem: contagem.rows[0],
  };
}

const db = await pool.query('SELECT current_database() AS db');
if (db.rows[0].db !== 'vision_check') {
  console.error('Abortado: esperado vision_check, veio', db.rows[0].db);
  process.exit(1);
}
console.log('Banco:', db.rows[0].db, 'APPLY=', APPLY);

const fpAntes = await fingerprint();
console.log('FP ANTES', j(fpAntes));

const diagnostico = {};

// --- SKUs alvo ---
const alvos = [
  '039300',
  'TRC-OVOMALTINEBKABCX9K',
  '039642',
  '35610',
  '35619',
  '3029',
  '9049',
  '38454',
  'BK-SEM-0030',
  'BK-SEM-0033',
  '010947',
  '29857',
  '38178',
];

diagnostico.perfis = await perfilSku(alvos);
for (const c of alvos) {
  diagnostico[c] = {
    venancio: await deps(c, ID_VENANCIO),
    rede: await deps(c, null),
  };
}

// Ovomaltine: NF match by description
const ovoNf = await pool.query(
  `SELECT n.id_loja, ni.codigo_nf, ni.descricao, ni.u_com, ni.q_com, ni.v_un_com, n.emissao,
          i.codigo AS insumo_codigo
   FROM estoque_nfe_itens ni
   JOIN estoque_nfe n ON n.id_nfe = ni.id_nfe
   LEFT JOIN insumos i ON i.id_insumo = ni.id_insumo
   WHERE ni.descricao ILIKE '%OVOMALTINE%'
      OR ni.codigo_nf ILIKE '%OVOMALTINE%'
      OR ni.codigo_nf IN ('039300','TRC-OVOMALTINEBKABCX9K')
   ORDER BY n.emissao DESC NULLS LAST
   LIMIT 20`,
);
diagnostico.ovomaltine_nf = ovoNf.rows;

const cheddarNf = await pool.query(
  `SELECT n.id_loja, ni.codigo_nf, ni.descricao, ni.u_com, ni.q_com, i.codigo AS insumo_codigo, n.emissao
   FROM estoque_nfe_itens ni
   JOIN estoque_nfe n ON n.id_nfe = ni.id_nfe
   LEFT JOIN insumos i ON i.id_insumo = ni.id_insumo
   WHERE ni.descricao ILIKE '%CHEDDAR%'
      OR ni.codigo_nf IN ('039642','35610','35619')
   ORDER BY n.emissao DESC NULLS LAST
   LIMIT 25`,
);
diagnostico.cheddar_nf = cheddarNf.rows;

const ficha3029 = await pool.query(
  `SELECT p.id_loja, p.codigo, p.descricao, fi.quantidade, fi.unidade_receita, f.ativo, f.atualizado_em
   FROM ficha_tecnica_itens fi
   JOIN ficha_tecnica f ON f.id_ficha = fi.id_ficha
   JOIN produtos p ON p.id_produto = f.id_produto
   WHERE fi.codigo_insumo = '3029' AND p.id_loja = $1
   ORDER BY p.codigo`,
  [ID_VENANCIO],
);
diagnostico.fichas_3029_venancio = ficha3029.rows;

const ficha38454 = await pool.query(
  `SELECT p.id_loja, p.codigo, p.descricao, fi.quantidade, fi.unidade_receita, f.ativo
   FROM ficha_tecnica_itens fi
   JOIN ficha_tecnica f ON f.id_ficha = fi.id_ficha
   JOIN produtos p ON p.id_produto = f.id_produto
   WHERE fi.codigo_insumo IN ('38454','BK-SEM-0030') AND p.id_loja = $1
   ORDER BY fi.codigo_insumo, p.codigo`,
  [ID_VENANCIO],
);
diagnostico.fichas_38454_venancio = ficha38454.rows;

const mov3029 = await pool.query(
  `SELECT m.data_movimento, m.tipo, m.quantidade, m.observacao, m.referencia_tipo, i.codigo, i.id_loja
   FROM estoque_movimentos m
   JOIN insumos i ON i.id_insumo = m.id_insumo
   WHERE i.codigo = '3029'
   ORDER BY m.data_movimento DESC, m.id_movimento DESC
   LIMIT 15`,
);
diagnostico.mov_3029 = mov3029.rows;

const mov38454 = await pool.query(
  `SELECT m.data_movimento, m.tipo, m.quantidade, m.observacao, m.referencia_tipo, i.codigo, i.id_loja
   FROM estoque_movimentos m
   JOIN insumos i ON i.id_insumo = m.id_insumo
   WHERE i.codigo IN ('38454','BK-SEM-0030','BK-SEM-0033')
   ORDER BY i.codigo, m.data_movimento DESC
   LIMIT 30`,
);
diagnostico.mov_38454_sem = mov38454.rows;

const custos = await pool.query(
  `SELECT i.id_loja, l.name, i.codigo, i.descricao, i.preco_caixa, i.und_convertida, i.valor_unidade,
          i.custo_fonte, i.unidade_contagem, i.unidade_fracionada
   FROM insumos i JOIN lojas l ON l.id_loja = i.id_loja
   WHERE i.codigo IN ('010947','29857','38178') AND i.id_loja = $1`,
  [ID_VENANCIO],
);
diagnostico.custos_venancio = custos.rows;

const nfCustos = await pool.query(
  `SELECT i.codigo, ni.codigo_nf, ni.descricao, ni.u_com, ni.q_com, ni.v_un_com, ni.v_prod,
          ni.preco_caixa_aplicado, n.emissao, n.numero
   FROM estoque_nfe_itens ni
   JOIN estoque_nfe n ON n.id_nfe = ni.id_nfe
   JOIN insumos i ON i.id_insumo = ni.id_insumo
   WHERE i.codigo IN ('010947','29857','38178') AND n.id_loja = $1
   ORDER BY i.codigo, n.emissao DESC NULLS LAST
   LIMIT 30`,
  [ID_VENANCIO],
);
diagnostico.nf_custos = nfCustos.rows;

const uf35619 = await pool.query(
  `SELECT i.id_loja, i.codigo, i.unidade_contagem, i.unidade_fracionada,
          c.fator, c.status, c.unidade_origem, c.unidade_destino
   FROM insumos i
   LEFT JOIN estoque_conversoes c
     ON c.id_insumo = i.id_insumo
    AND LOWER(c.unidade_origem) IN ('und','un')
    AND LOWER(c.unidade_destino) = 'kg'
   WHERE i.codigo = '35619'
   ORDER BY i.id_loja`,
);
diagnostico.uf_35619 = uf35619.rows;

// Duplicados evidentes (descrição normalizada, mesma loja, ambos ativos)
const dups = await pool.query(
  `WITH n AS (
     SELECT id_insumo, id_loja, codigo, descricao, unidade_contagem, ativo, participa_contagem,
            regexp_replace(upper(coalesce(descricao,'')), '[^A-Z0-9]+', '', 'g') AS chave
     FROM insumos
     WHERE ativo = TRUE AND id_loja = $1
   )
   SELECT a.codigo AS a, b.codigo AS b, a.descricao AS da, b.descricao AS db,
          a.unidade_contagem AS ua, b.unidade_contagem AS ub,
          a.participa_contagem AS pa, b.participa_contagem AS pb
   FROM n a
   JOIN n b ON b.id_loja = a.id_loja AND b.chave = a.chave AND b.id_insumo > a.id_insumo
   WHERE a.chave <> '' AND length(a.chave) >= 12
   ORDER BY a.chave
   LIMIT 40`,
  [ID_VENANCIO],
);
diagnostico.dups_venancio = dups.rows;

const resumo = (codigo) => {
  const rows = diagnostico.perfis.filter((p) => p.codigo === codigo);
  const v = rows.find((r) => Number(r.id_loja) === ID_VENANCIO);
  const d = diagnostico[codigo];
  return { n_lojas: rows.length, venancio: v, deps_v: d?.venancio, deps_rede: d?.rede };
};

console.log('\n===== RESUMO =====');
for (const c of alvos) {
  console.log('\n---', c, '---');
  console.log(j(resumo(c)));
}
console.log('\nOVOMALTINE NF', j(diagnostico.ovomaltine_nf));
console.log('\nCHEDDAR NF', j(diagnostico.cheddar_nf.slice(0, 15)));
console.log('\nFICHAS 3029', j(diagnostico.fichas_3029_venancio));
console.log('\nFICHAS 38454', j(diagnostico.fichas_38454_venancio));
console.log('\nMOV 3029', j(diagnostico.mov_3029));
console.log('\nMOV 38454/SEM', j(diagnostico.mov_38454_sem));
console.log('\nCUSTOS', j(diagnostico.custos_venancio));
console.log('\nNF CUSTOS', j(diagnostico.nf_custos));
console.log('\nUF 35619 sample', j(diagnostico.uf_35619.slice(0, 8)));
console.log('\nDUPS', j(diagnostico.dups_venancio));

if (!APPLY) {
  console.log('\nDry-run. Rode com --apply para aplicar saneamento.');
  await pool.end();
  process.exit(0);
}

const sqlPath = path.join(backendRoot, 'migrations/170_etapa7_saneamento_cadastro.sql');
const sql = fs
  .readFileSync(sqlPath, 'utf8')
  .replace(/\bBEGIN\s*;/gi, '')
  .replace(/\bCOMMIT\s*;/gi, '');

const client = await pool.connect();
let fpDepois;
let verificacao;
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  const fpTxAntes = await fingerprintFrom(client);
  await client.query(sql);
  const fpTxDepois = await fingerprintFrom(client);
  if (JSON.stringify(fpTxAntes) !== JSON.stringify(fpTxDepois)) {
    throw new Error(
      `Fingerprint mudou dentro da transação de cadastro: ${JSON.stringify({ fpTxAntes, fpTxDepois })}`,
    );
  }

  verificacao = await verificarSaneamento(client);
  const falhas = Object.entries(verificacao)
    .filter(([, v]) => v && v.ok === false)
    .map(([k, v]) => `${k}: ${v.detalhe || 'fail'}`);
  if (falhas.length) {
    throw new Error(`Verificação Etapa 7 falhou:\n${falhas.join('\n')}`);
  }

  await client.query('COMMIT');
  fpDepois = await fingerprint();
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  client.release();
  await pool.end();
  console.error('ABORTADO:', e.message);
  process.exit(1);
}
client.release();

console.log('\nFP DEPOIS', j(fpDepois));
console.log('VERIFICACAO', j(verificacao));
console.log('\nEtapa 7 aplicada. Saldos/movimentos/conversões/contagens intactos na transação.');
await pool.end();
