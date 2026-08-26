/**
 * Desliga duplicata de código (com/sem zero à frente) usando o catálogo oficial.
 * Não junta produtos diferentes que só compartilham o número (ex.: 028459 doce de leite × 28459 baunilha).
 *
 *   node backend/scripts/desligar-duplicatas-codigo.mjs --dry-run --db=dev
 *   node backend/scripts/desligar-duplicatas-codigo.mjs --yes --db=prod
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import { normalizarDesc, flagsContagemDiaria } from '../src/services/estoqueContagem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const yes = args.includes('--yes');
const dryRun = args.includes('--dry-run');
const dbFlag = args.find((a) => a.startsWith('--db='))?.slice(5) || 'prod';
const DB_NAME =
  dbFlag === 'dev' ? 'vision_check_dev' : dbFlag === 'prod' ? 'vision_check' : dbFlag;

if (!yes && !dryRun) {
  console.error('Use --dry-run ou --yes');
  process.exit(1);
}

const STOP = new Set([
  'CX', 'UND', 'UN', 'COM', 'PARA', 'BK', 'THE', 'PACK', 'NAC', 'CLEAN', 'LABEL',
  'ESTADO', 'NATURAL', 'CONG', 'PRE',
]);

function stripCodigo(c) {
  const s = String(c || '').trim();
  if (!/^\d+$/.test(s)) return null;
  return s.replace(/^0+/, '') || '0';
}

function tokens(desc) {
  return new Set(
    normalizarDesc(desc)
      .split(/[^A-Z0-9]+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

function conflitoSabor(a, b) {
  const da = normalizarDesc(a);
  const db = normalizarDesc(b);
  const pares = [
    ['BAUNILHA', 'DOCE DE LEITE'],
    ['BAUNILHA', 'DOCE'],
    ['STAR WARS', 'MINIONS'],
  ];
  for (const [x, y] of pares) {
    const ax = da.includes(x);
    const ay = da.includes(y);
    const bx = db.includes(x);
    const by = db.includes(y);
    if ((ax && by && !ay) || (ay && bx && !ax)) return true;
  }
  return false;
}

function mesmoProduto(a, b) {
  if (conflitoSabor(a, b)) return false;
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return false;
  const inter = [...A].filter((x) => B.has(x));
  const min = Math.min(A.size, B.size);
  if (inter.length < Math.min(2, min)) return false;
  return inter.length / min >= 0.45;
}

function parseOficial() {
  const raw = fs.readFileSync(
    path.join(__dirname, 'data', 'catalogo-oficial-bk.tsv'),
    'utf8',
  );
  const map = new Map();
  for (const line of raw.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const [codigo, , descricao] = line.split('\t');
    if (!codigo) continue;
    map.set(codigo.trim(), String(descricao || '').trim());
  }
  return map;
}

const oficial = parseOficial();
const porStrip = new Map();
for (const [codigo, desc] of oficial) {
  const k = stripCodigo(codigo);
  if (!k) continue;
  if (!porStrip.has(k)) porStrip.set(k, []);
  porStrip.get(k).push({ codigo, desc });
}

const client = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});
await client.connect();

try {
  const { rows: lojas } = await client.query(`
    SELECT id_loja, name FROM lojas
    WHERE COALESCE(is_active, TRUE) AND name ILIKE '%burger king%'
  `);
  const { rows: insumos } = await client.query(`
    SELECT id_insumo, id_loja, codigo, descricao, ativo,
           contagem_diaria, grupo_diario, contagem_critica,
           preco_caixa, und_convertida, und_parcial,
           permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und
    FROM insumos
    WHERE id_loja = ANY($1::int[])
  `, [lojas.map((l) => l.id_loja)]);

  const porLoja = new Map();
  for (const r of insumos) {
    if (!porLoja.has(r.id_loja)) porLoja.set(r.id_loja, []);
    porLoja.get(r.id_loja).push(r);
  }

  const desligar = [];
  const ativar = [];
  const copos = [];

  for (const loja of lojas) {
    const lista = porLoja.get(loja.id_loja) || [];
    const byId = new Map(lista.map((r) => [r.codigo, r]));

    for (const [strip, oficiais] of porStrip) {
      for (const off of oficiais) {
        const irmaos = lista.filter((r) => stripCodigo(r.codigo) === strip);
        const iguais = irmaos.filter((r) => mesmoProduto(r.descricao, off.desc));
        if (iguais.length < 2 && !iguais.some((r) => r.codigo !== off.codigo && r.ativo)) {
          const keeper = byId.get(off.codigo);
          if (keeper && !keeper.ativo) {
            ativar.push({ loja: loja.name, id_loja: loja.id_loja, ...keeper, dest: off.codigo });
          }
          continue;
        }
        const keeper =
          iguais.find((r) => r.codigo === off.codigo) ||
          iguais.find((r) => r.ativo) ||
          iguais[0];
        if (!keeper) continue;

        if (keeper.codigo !== off.codigo && byId.get(off.codigo)) {
          // Prefere o código oficial mesmo se estiver inativo.
        }
        const oficialRow = byId.get(off.codigo) || keeper;
        const keepId = oficialRow.id_insumo;
        if (!oficialRow.ativo) {
          ativar.push({
            loja: loja.name,
            id_loja: loja.id_loja,
            id_insumo: keepId,
            codigo: oficialRow.codigo,
            descricao: off.desc,
          });
        }
        for (const r of iguais) {
          if (r.id_insumo === keepId) continue;
          if (!r.ativo && !r.contagem_diaria) continue;
          desligar.push({
            loja: loja.name,
            id_loja: loja.id_loja,
            id_insumo: r.id_insumo,
            codigo: r.codigo,
            descricao: r.descricao,
            keep: oficialRow.codigo,
            keepId,
          });
        }
      }
    }

    const c440 = lista.filter(
      (r) =>
        r.ativo &&
        /COPO/.test(normalizarDesc(r.descricao)) &&
        /440/.test(r.descricao) &&
        !/SHAKE|SUNDAE|CORTESIA|TAMPA|PORTA/.test(normalizarDesc(r.descricao)),
    );
    const c550 = lista.filter(
      (r) =>
        r.ativo &&
        /COPO/.test(normalizarDesc(r.descricao)) &&
        /550/.test(r.descricao) &&
        !/PORTA|TAMPA/.test(normalizarDesc(r.descricao)),
    );
    copos.push({
      loja: loja.name,
      id_loja: loja.id_loja,
      c440: c440.map((r) => `${r.codigo}|${r.descricao.slice(0, 40)}|d=${r.contagem_diaria}`),
      c550: c550.map((r) => `${r.codigo}|${r.descricao.slice(0, 40)}|d=${r.contagem_diaria}`),
    });
  }

  console.log(`banco=${DB_NAME} desligar=${desligar.length} reativar=${ativar.length}`);
  for (const d of desligar.slice(0, 40)) {
    console.log(`  OUT ${d.codigo.padEnd(14)} → keep ${d.keep.padEnd(8)} ${d.loja}  ${d.descricao.slice(0, 42)}`);
  }
  if (desligar.length > 40) console.log(`  ... +${desligar.length - 40}`);

  const terraco = copos.find((c) => /terra/i.test(c.loja));
  console.log('amostra copos', copos[0]?.loja, copos[0]?.c440, copos[0]?.c550);
  if (terraco) {
    console.log('copos Terraço 440', terraco.c440);
    console.log('copos Terraço 550', terraco.c550);
  }

  if (dryRun) {
    console.log('dry-run: nada gravado');
    process.exit(0);
  }

  await client.query('BEGIN');
  for (const a of ativar) {
    const daily = flagsContagemDiaria(a.descricao || '');
    await client.query(
      `UPDATE insumos
       SET ativo = TRUE,
           descricao = COALESCE(NULLIF($2, ''), descricao),
           contagem_diaria = CASE WHEN $3 THEN TRUE ELSE contagem_diaria END,
           grupo_diario = COALESCE($4, grupo_diario),
           atualizado_em = NOW()
       WHERE id_insumo = $1`,
      [a.id_insumo, a.descricao || null, daily.contagem_diaria, daily.grupo_diario],
    );
  }

  for (const d of desligar) {
    await client.query(
      `UPDATE insumos
       SET ativo = FALSE, contagem_diaria = FALSE, contagem_critica = FALSE, atualizado_em = NOW()
       WHERE id_insumo = $1`,
      [d.id_insumo],
    );
    await client.query(
      `UPDATE estoque_itens i
       SET id_insumo = $2
       FROM estoque_contagens c
       WHERE i.id_contagem = c.id_contagem
         AND c.status = 'aberta'
         AND i.id_insumo = $1
         AND NOT EXISTS (
           SELECT 1 FROM estoque_itens x
           WHERE x.id_contagem = i.id_contagem AND x.id_insumo = $2
         )`,
      [d.id_insumo, d.keepId],
    );
    await client.query(
      `DELETE FROM estoque_itens i
       USING estoque_contagens c
       WHERE i.id_contagem = c.id_contagem
         AND c.status = 'aberta'
         AND i.id_insumo = $1`,
      [d.id_insumo],
    );
  }

  // Copos: um 440 e um 550 genéricos (códigos oficiais).
  const r440 = await client.query(
    `UPDATE insumos
     SET descricao = 'COPO REFRIG UNIVERSAL 440ML CX 900 UND',
         ativo = TRUE,
         contagem_diaria = TRUE,
         grupo_diario = 'refil',
         secao_contagem = 'EMBALAGENS E ESTOCAVEIS',
         atualizado_em = NOW()
     WHERE id_loja = ANY($1::int[]) AND codigo = '042241'
     RETURNING id_insumo`,
    [lojas.map((l) => l.id_loja)],
  );
  const r550 = await client.query(
    `UPDATE insumos
     SET descricao = 'COPO REFRIG UNIVERSAL 550ML CX 1200 UND',
         ativo = TRUE,
         contagem_diaria = TRUE,
         grupo_diario = 'refil',
         secao_contagem = 'EMBALAGENS E ESTOCAVEIS',
         atualizado_em = NOW()
     WHERE id_loja = ANY($1::int[]) AND codigo = '042242'
     RETURNING id_insumo`,
    [lojas.map((l) => l.id_loja)],
  );
  const campanha = await client.query(
    `UPDATE insumos
     SET contagem_diaria = FALSE, grupo_diario = NULL, atualizado_em = NOW()
     WHERE id_loja = ANY($1::int[])
       AND codigo IN ('10337', '35293', '042397', '042396', '042016', '024016')
       AND descricao ~* 'COPO'
     RETURNING id_insumo, codigo`,
    [lojas.map((l) => l.id_loja)],
  );

  const addCup = await client.query(
    `INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
     SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
     FROM estoque_contagens c
     JOIN insumos p ON p.id_loja = c.id_loja AND p.ativo AND p.codigo IN ('042241', '042242')
     LEFT JOIN estoque_saldos s ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
     WHERE c.status = 'aberta' AND COALESCE(c.tipo, '') = 'diaria'
       AND NOT EXISTS (
         SELECT 1 FROM estoque_itens x
         WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
       )`,
  );
  const remCup = await client.query(
    `DELETE FROM estoque_itens i
     USING estoque_contagens c, insumos p
     WHERE i.id_contagem = c.id_contagem
       AND i.id_insumo = p.id_insumo
       AND c.status = 'aberta'
       AND COALESCE(c.tipo, '') = 'diaria'
       AND p.codigo IN ('10337', '35293', '042397', '042396')`,
  );

  await client.query('COMMIT');
  console.log(
    `ok desligar=${desligar.length} reativar=${ativar.length} ` +
      `copo440=${r440.rowCount} copo550=${r550.rowCount} campanha_off=${campanha.rowCount} ` +
      `abertas +${addCup.rowCount} -${remCup.rowCount}`,
  );
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(e);
  process.exit(1);
} finally {
  await client.end();
}
