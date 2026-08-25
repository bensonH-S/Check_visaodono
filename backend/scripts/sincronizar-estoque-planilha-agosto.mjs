/**
 * Sobe a planilha Estoque 01/08/2026 (estrutura + preços) para todas as lojas BK.
 *
 * Os códigos da planilha estão deslocados — o casamento é pela descrição
 * (igual ao Recanto). Não altera código já existente (fichas técnicas).
 * Não sobrescreve custo_fonte='nf'.
 *
 *   node backend/scripts/sincronizar-estoque-planilha-agosto.mjs --dry-run
 *   node backend/scripts/sincronizar-estoque-planilha-agosto.mjs --yes
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';
import XLSX from 'xlsx';
import {
  CMV_LINHA_FIM,
  celulaBloqueadaContagem,
  classificarUnidadeContagem,
  extrairFatoresFormula,
  flagsContagemDiaria,
  normalizarDesc,
  num,
} from '../src/services/estoqueContagem.js';
import { chaveContagem as chaveBase } from './sincronizar-ordem-contagem-recanto.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};
const yes = args.includes('--yes');
const dryRun = args.includes('--dry-run');
const dbFlag = getArg('--db', 'prod');
const DB_NAME =
  dbFlag === 'dev'
    ? process.env.DB_NAME_DEV || process.env.DB_NAME || 'vision_check_dev'
    : process.env.DB_NAME_PROD || process.env.DB_NAME || 'vision_check';
const arquivo = getArg(
  '--arquivo',
  'f:/Users/Benson/Downloads/Estoque_01_de_Agosto_de_2026.xlsx',
);

if (!yes && !dryRun) {
  console.error('Use --yes ou --dry-run.');
  process.exit(1);
}

const SECAO_REFRI = 'REFRIGERANTES COCA-COLA - LATAS - CO2';

function secaoCanon(nome) {
  const n = String(nome || '').replace(/\s+/g, ' ').trim();
  if (/^REFRIGERANTES/i.test(n)) return SECAO_REFRI;
  return n;
}

export function chaveContagem(desc) {
  const d = normalizarDesc(desc);
  if (!d) return '';
  if (/ORING/.test(d) && /162/.test(d)) return 'kit-oring-162';
  if (/ORING/.test(d) && /336/.test(d)) return 'kit-oring-336';
  if (/ORING/.test(d) && /8754/.test(d)) return 'kit-oring';
  if (/KIT TEFLON/.test(d)) return 'kit-teflon';
  if (/TEFLON TOASTER/.test(d)) return 'teflon-toaster';
  if (/CASQUINHA/.test(d) && /BIJU/.test(d)) return 'casquinha-biju';
  if (/KETCHUP/.test(d) && /SACHE/.test(d) && /144/.test(d)) return 'ketchup-sache-144';
  if (/BEBIDA LACTEA/.test(d) && /BAUNILHA/.test(d) && /22/.test(d)) return 'lactea-baunilha-22';
  if (/COPO CORTESIA/.test(d) && /ALTA|2500/.test(d)) return 'copo-cortesia-alta';
  if (/QUEIJO CRISPY/.test(d)) return 'queijo-crispy';
  if (/TEMPERO SAL E PIMENTA/.test(d)) return 'tempero-sal-pimenta';
  if (/FUSILLI/.test(d)) return 'fusilli-bolonhesa';
  if (/PIZZAIOLO/.test(d)) return 'frango-pizzaiolo';
  if (/MARMITA/.test(d) && /PERNIL/.test(d)) return 'marmita-pernil';
  if (/LIMITADOR BOMBA/.test(d)) return 'limitador-bomba';
  if (/POTE BK/.test(d) && /MOLH/.test(d) && !/TAMPA/.test(d)) return 'pote-molhao';
  if (/SPRITE/.test(d) && /SEM ACUCAR|ZERO|DIET/.test(d) && /LATA/.test(d)) {
    return 'refri-sprite-zero-lata';
  }
  if (/FANTA GUARANA/.test(d) && /ZERO|DIET/.test(d) && /LATA/.test(d)) {
    return 'refri-guarana-zero-lata';
  }
  if (/COCA-COLA SEM ACUCAR/.test(d) && /BAG|BOX/.test(d) && !/LATA/.test(d)) {
    return 'refri-cola-zero-bag';
  }
  if (/SPRITE/.test(d) && /SACO IN BOX|BAG/.test(d)) return 'refri-sprite-bag';
  if (/FANTA LARANJA/.test(d) && /BOLSA IN BOX|BAG/.test(d) && !/LATA/.test(d)) {
    return 'refri-fanta-bag';
  }
  if (/FANTA GUARANA/.test(d) && /SACO IN BOX|BAG/.test(d) && !/ZERO|DIET|LATA/.test(d)) {
    return 'refri-guarana-bag';
  }
  if (/COCA-COLA/.test(d) && /BAG|BOX/.test(d) && !/ZERO|SEM ACUCAR|LATA/.test(d)) {
    return 'refri-cola-bag';
  }
  return chaveBase(desc);
}

function isLinhaSecao(sh, rowNum, rawCod, desc) {
  if (!desc) return false;
  const c = sh[`C${rowNum}`];
  const d = sh[`D${rowNum}`];
  const hasPrice = typeof c?.v === 'number' || typeof d?.v === 'number';
  if (hasPrice) return false;
  if (/^\d+$/.test(String(rawCod || '').trim())) return false;
  if (/^(CODIGO|DESCRICAO|TOTAL GERAL|CONTAGEM)\b/i.test(normalizarDesc(desc))) return false;
  return true;
}

function parsePlanilha(filePath) {
  const wb = XLSX.read(fs.readFileSync(filePath), {
    type: 'buffer',
    cellFormula: true,
    cellStyles: true,
  });
  const sheetName = wb.SheetNames.find((n) => /contagem/i.test(n)) || wb.SheetNames[0];
  const sh = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '', raw: true });
  const items = [];
  const secoes = [];
  let secaoAtual = 'OUTROS';
  let ordem = 0;
  const codCount = new Map();

  for (let r = 5; r < rows.length; r++) {
    const rowNum = r + 1;
    const rawCod = String(rows[r][0] ?? '').trim();
    const desc = String(rows[r][1] ?? '').trim();
    if (!desc) continue;

    if (isLinhaSecao(sh, rowNum, rawCod, desc)) {
      secaoAtual = secaoCanon(desc);
      if (!secoes.includes(secaoAtual)) secoes.push(secaoAtual);
      continue;
    }

    const fD = sh[`D${rowNum}`]?.f || '';
    const fH = sh[`H${rowNum}`]?.f || '';
    const preco = num(rows[r][2]);
    const vlUnit = num(rows[r][3]);
    if (!fD && !fH && !(preco > 0) && !(vlUnit > 0)) continue;

    const { und_convertida, und_parcial, temFatorPc } = extrairFatoresFormula(fD, fH);
    const unidade = classificarUnidadeContagem(desc, und_convertida);
    const diaria = flagsContagemDiaria(desc);

    let codigo = /^\d+$/.test(rawCod) ? rawCod : '';
    if (!codigo) {
      const slug = normalizarDesc(desc).replace(/[^A-Z0-9]+/g, '').slice(0, 18);
      codigo = `AUG-${slug || rowNum}`;
    }
    const n = (codCount.get(codigo) || 0) + 1;
    codCount.set(codigo, n);
    if (n > 1) codigo = `${codigo}-${n}`;

    ordem += 1;
    items.push({
      rowNum,
      codigo_planilha: codigo,
      descricao: desc,
      chave: chaveContagem(desc),
      secao_contagem: secaoAtual,
      ordem_contagem: ordem * 10,
      unidade_contagem: unidade,
      und_convertida,
      und_parcial: temFatorPc ? und_parcial : 1,
      preco_caixa: preco,
      permite_contagem_caixa: !celulaBloqueadaContagem(sh[`E${rowNum}`]),
      permite_contagem_pc_fd: !celulaBloqueadaContagem(sh[`F${rowNum}`]),
      permite_contagem_kg_und: !celulaBloqueadaContagem(sh[`G${rowNum}`]),
      entra_cmv: rowNum <= CMV_LINHA_FIM,
      contagem_diaria: diaria.contagem_diaria,
      grupo_diario: diaria.grupo_diario,
    });
  }
  return { items, secoes, sheetName };
}

function preferirInsumo(a, b, descNorm) {
  if ((a.custo_fonte === 'nf') !== (b.custo_fonte === 'nf')) {
    return a.custo_fonte === 'nf' ? -1 : 1;
  }
  if (descNorm) {
    const ae = normalizarDesc(a.descricao) === descNorm;
    const be = normalizarDesc(b.descricao) === descNorm;
    if (ae !== be) return ae ? -1 : 1;
  }
  const suf = (c) => /-\d+$/.test(String(c || ''));
  if (suf(a.codigo) !== suf(b.codigo)) return suf(a.codigo) ? 1 : -1;
  if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
  return String(a.codigo).localeCompare(String(b.codigo));
}

function matchInsumo(it, mapaDesc, mapaChave, usados) {
  const d = normalizarDesc(it.descricao);
  const seen = new Set();
  const cands = [];
  for (const x of [...(mapaDesc.get(d) || []), ...(mapaChave.get(it.chave) || [])]) {
    if (usados.has(x.id_insumo) || seen.has(x.id_insumo)) continue;
    seen.add(x.id_insumo);
    cands.push(x);
  }
  if (!cands.length) return null;
  return cands.sort((a, b) => preferirInsumo(a, b, d))[0];
}

function codigoLivre(base, usadosCod) {
  let c = base;
  let n = 2;
  while (usadosCod.has(c)) {
    c = `${base}-${n}`;
    n += 1;
  }
  usadosCod.add(c);
  return c;
}

function pool() {
  return new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: DB_NAME,
    port: Number(process.env.DB_PORT || 5432),
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
}

async function main() {
  if (!fs.existsSync(arquivo)) {
    console.error('Planilha não encontrada:', arquivo);
    process.exit(1);
  }
  const { items, secoes, sheetName } = parsePlanilha(arquivo);
  console.log(`DB ${DB_NAME} | aba ${sheetName} | itens ${items.length}`);
  console.log(`Seções (${secoes.length}): ${secoes.join(' | ')}`);
  console.log(
    `  pc bloqueado=${items.filter((i) => !i.permite_contagem_pc_fd).length}` +
      ` kg bloqueado=${items.filter((i) => !i.permite_contagem_kg_und).length}` +
      ` fora CMV=${items.filter((i) => !i.entra_cmv).length}` +
      ` com preço=${items.filter((i) => i.preco_caixa > 0).length}`,
  );

  const db = pool();
  try {
    const lojas = await db.query(
      `SELECT id_loja, name, bk_number FROM lojas
       WHERE COALESCE(is_active, TRUE) AND name ILIKE '%burger king%'
       ORDER BY id_loja`,
    );
    console.log(`Lojas BK: ${lojas.rows.length}`);

    const { rows: catAll } = await db.query(
      `SELECT id_insumo, id_loja, codigo, descricao, ativo, custo_fonte, preco_caixa
       FROM insumos
       WHERE id_loja = ANY($1::int[])`,
      [lojas.rows.map((l) => l.id_loja)],
    );
    const porLoja = new Map();
    for (const r of catAll) {
      if (!porLoja.has(r.id_loja)) porLoja.set(r.id_loja, []);
      porLoja.get(r.id_loja).push(r);
    }

    const modelo =
      lojas.rows.find((l) => /terrac/i.test(l.name)) ||
      lojas.rows.find((l) => l.id_loja === 21) ||
      lojas.rows[0];
    const catModelo = porLoja.get(modelo.id_loja) || [];
    const mapaDescM = new Map();
    const mapaChaveM = new Map();
    for (const r of catModelo) {
      const d = normalizarDesc(r.descricao);
      if (!mapaDescM.has(d)) mapaDescM.set(d, []);
      mapaDescM.get(d).push(r);
      const k = chaveContagem(r.descricao);
      if (!mapaChaveM.has(k)) mapaChaveM.set(k, []);
      mapaChaveM.get(k).push(r);
    }
    const usedModelo = new Set();
    let okModelo = 0;
    const missModelo = [];
    for (const it of items) {
      const hit = matchInsumo(it, mapaDescM, mapaChaveM, usedModelo);
      if (!hit) {
        missModelo.push(it);
        continue;
      }
      usedModelo.add(hit.id_insumo);
      okModelo += 1;
    }
    console.log(
      `Match ${modelo.name}: ${okModelo}/${items.length} | novos=${missModelo.length} | extras ativos=${
        catModelo.filter((r) => r.ativo && !usedModelo.has(r.id_insumo)).length
      }`,
    );
    if (missModelo.length) {
      console.log('Novos (serão criados):');
      for (const m of missModelo) {
        console.log(
          `  ${String(m.rowNum).padStart(3)} ${m.chave.padEnd(24)} ${m.descricao.slice(0, 58)} R$ ${m.preco_caixa}`,
        );
      }
    }

    const updates = [];
    const inserts = [];
    let skipNf = 0;
    let precoUpd = 0;
    let extraN = 0;
    const desativarIds = [];

    for (const loja of lojas.rows) {
      const cat = porLoja.get(loja.id_loja) || [];
      const mapaDesc = new Map();
      const mapaChave = new Map();
      const usadosCod = new Set(cat.map((r) => String(r.codigo)));
      for (const r of cat) {
        const d = normalizarDesc(r.descricao);
        if (!mapaDesc.has(d)) mapaDesc.set(d, []);
        mapaDesc.get(d).push(r);
        const k = chaveContagem(r.descricao);
        if (!mapaChave.has(k)) mapaChave.set(k, []);
        mapaChave.get(k).push(r);
      }
      const usados = new Set();
      const desativarDups = [];

      for (const it of items) {
        const hit = matchInsumo(it, mapaDesc, mapaChave, usados);
        if (hit) {
          usados.add(hit.id_insumo);
          const dupsChave = (mapaChave.get(it.chave) || []).filter(
            (x) => !usados.has(x.id_insumo) && x.ativo,
          );
          for (const extraDup of dupsChave) {
            usados.add(extraDup.id_insumo);
            desativarDups.push(extraDup.id_insumo);
          }
          const aplicaPreco = hit.custo_fonte !== 'nf' && it.preco_caixa > 0;
          if (hit.custo_fonte === 'nf') skipNf += 1;
          if (aplicaPreco) precoUpd += 1;
          updates.push({
            id_insumo: hit.id_insumo,
            descricao: it.descricao,
            unidade_contagem: it.unidade_contagem,
            und_convertida: it.und_convertida,
            und_parcial: it.und_parcial,
            secao_contagem: it.secao_contagem,
            ordem_contagem: it.ordem_contagem,
            permite_contagem_caixa: it.permite_contagem_caixa,
            permite_contagem_pc_fd: it.permite_contagem_pc_fd,
            permite_contagem_kg_und: it.permite_contagem_kg_und,
            entra_cmv: it.entra_cmv,
            contagem_diaria: it.contagem_diaria,
            grupo_diario: it.grupo_diario,
            preco_caixa: aplicaPreco ? it.preco_caixa : Number(hit.preco_caixa) || 0,
            aplica_preco: aplicaPreco,
          });
          continue;
        }
        inserts.push({
          id_loja: loja.id_loja,
          codigo: codigoLivre(it.codigo_planilha, usadosCod),
          descricao: it.descricao,
          unidade_contagem: it.unidade_contagem,
          und_convertida: it.und_convertida,
          und_parcial: it.und_parcial,
          secao_contagem: it.secao_contagem,
          ordem_contagem: it.ordem_contagem,
          permite_contagem_caixa: it.permite_contagem_caixa,
          permite_contagem_pc_fd: it.permite_contagem_pc_fd,
          permite_contagem_kg_und: it.permite_contagem_kg_und,
          entra_cmv: it.entra_cmv,
          contagem_diaria: it.contagem_diaria,
          grupo_diario: it.grupo_diario,
          preco_caixa: it.preco_caixa > 0 ? it.preco_caixa : 0,
          custo_fonte: it.preco_caixa > 0 ? 'manual' : null,
        });
      }
      extraN += cat.filter((r) => !usados.has(r.id_insumo)).length;
      desativarIds.push(...desativarDups);
    }

    console.log({
      updates: updates.length,
      inserts: inserts.length,
      precos_a_gravar: precoUpd,
      skip_nf: skipNf,
      dups_inativos: desativarIds.length,
      extras_mantidos: extraN,
    });

    if (dryRun) {
      if (desativarIds.length) {
        const { rows: dups } = await db.query(
          `SELECT codigo, LEFT(descricao, 55) AS descricao
           FROM insumos WHERE id_insumo = ANY($1::int[]) AND id_loja = $2
           ORDER BY descricao`,
          [desativarIds, modelo.id_loja],
        );
        console.log(`Dups a desativar na loja modelo (${dups.length}):`);
        for (const r of dups) console.log(`  ${String(r.codigo).padEnd(10)} ${r.descricao}`);
      }
      console.log('Dry-run — nada gravado.');
      return;
    }

    const client = await db.connect();
    const t0 = Date.now();
    try {
      await client.query('BEGIN');

      if (updates.length) {
        await client.query(
          `UPDATE insumos i SET
             descricao = t.descricao,
             unidade_contagem = t.unidade,
             und_convertida = t.und_cx,
             und_parcial = t.und_pc,
             secao_contagem = t.secao,
             ordem_contagem = t.ordem,
             permite_contagem_caixa = t.caixa,
             permite_contagem_pc_fd = t.pc,
             permite_contagem_kg_und = t.kg,
             entra_cmv = t.cmv,
             contagem_diaria = t.diaria,
             grupo_diario = NULLIF(t.grupo, ''),
             ativo = TRUE,
             preco_caixa = CASE WHEN t.aplica_preco THEN t.preco ELSE i.preco_caixa END,
             custo_fonte = CASE WHEN t.aplica_preco THEN 'manual' ELSE i.custo_fonte END,
             atualizado_em = NOW()
           FROM unnest(
             $1::int[], $2::text[], $3::text[], $4::numeric[], $5::numeric[],
             $6::text[], $7::int[], $8::bool[], $9::bool[], $10::bool[],
             $11::bool[], $12::bool[], $13::text[], $14::numeric[], $15::bool[]
           ) AS t(
             id_insumo, descricao, unidade, und_cx, und_pc,
             secao, ordem, caixa, pc, kg,
             cmv, diaria, grupo, preco, aplica_preco
           )
           WHERE i.id_insumo = t.id_insumo`,
          [
            updates.map((u) => u.id_insumo),
            updates.map((u) => u.descricao),
            updates.map((u) => u.unidade_contagem),
            updates.map((u) => u.und_convertida),
            updates.map((u) => u.und_parcial),
            updates.map((u) => u.secao_contagem),
            updates.map((u) => u.ordem_contagem),
            updates.map((u) => u.permite_contagem_caixa),
            updates.map((u) => u.permite_contagem_pc_fd),
            updates.map((u) => u.permite_contagem_kg_und),
            updates.map((u) => u.entra_cmv),
            updates.map((u) => u.contagem_diaria),
            updates.map((u) => u.grupo_diario || ''),
            updates.map((u) => u.preco_caixa),
            updates.map((u) => u.aplica_preco),
          ],
        );
      }

      if (inserts.length) {
        await client.query(
          `INSERT INTO insumos (
             id_loja, codigo, descricao, unidade_contagem,
             preco_caixa, und_convertida, und_parcial, ativo, custo_fonte,
             secao_contagem, ordem_contagem, entra_cmv,
             permite_contagem_caixa, permite_contagem_pc_fd, permite_contagem_kg_und,
             contagem_diaria, grupo_diario, atualizado_em
           )
           SELECT
             loja, codigo, descricao, unidade,
             preco, und_cx, und_pc, TRUE, NULLIF(fonte, ''),
             secao, ordem, cmv,
             caixa, pc, kg,
             diaria, NULLIF(grupo, ''), NOW()
           FROM unnest(
             $1::int[], $2::text[], $3::text[], $4::text[],
             $5::numeric[], $6::numeric[], $7::numeric[], $8::text[],
             $9::text[], $10::int[], $11::bool[],
             $12::bool[], $13::bool[], $14::bool[],
             $15::bool[], $16::text[]
           ) AS t(
             loja, codigo, descricao, unidade,
             preco, und_cx, und_pc, fonte,
             secao, ordem, cmv,
             caixa, pc, kg,
             diaria, grupo
           )
           ON CONFLICT (id_loja, codigo) DO UPDATE SET
             descricao = EXCLUDED.descricao,
             unidade_contagem = EXCLUDED.unidade_contagem,
             und_convertida = EXCLUDED.und_convertida,
             und_parcial = EXCLUDED.und_parcial,
             secao_contagem = EXCLUDED.secao_contagem,
             ordem_contagem = EXCLUDED.ordem_contagem,
             permite_contagem_caixa = EXCLUDED.permite_contagem_caixa,
             permite_contagem_pc_fd = EXCLUDED.permite_contagem_pc_fd,
             permite_contagem_kg_und = EXCLUDED.permite_contagem_kg_und,
             entra_cmv = EXCLUDED.entra_cmv,
             contagem_diaria = EXCLUDED.contagem_diaria,
             grupo_diario = EXCLUDED.grupo_diario,
             ativo = TRUE,
             preco_caixa = CASE
               WHEN insumos.custo_fonte IS DISTINCT FROM 'nf' AND EXCLUDED.preco_caixa > 0
               THEN EXCLUDED.preco_caixa ELSE insumos.preco_caixa END,
             custo_fonte = CASE
               WHEN insumos.custo_fonte IS DISTINCT FROM 'nf' AND EXCLUDED.preco_caixa > 0
               THEN 'manual' ELSE insumos.custo_fonte END,
             atualizado_em = NOW()`,
          [
            inserts.map((u) => u.id_loja),
            inserts.map((u) => u.codigo),
            inserts.map((u) => u.descricao),
            inserts.map((u) => u.unidade_contagem),
            inserts.map((u) => u.preco_caixa),
            inserts.map((u) => u.und_convertida),
            inserts.map((u) => u.und_parcial),
            inserts.map((u) => u.custo_fonte || ''),
            inserts.map((u) => u.secao_contagem),
            inserts.map((u) => u.ordem_contagem),
            inserts.map((u) => u.entra_cmv),
            inserts.map((u) => u.permite_contagem_caixa),
            inserts.map((u) => u.permite_contagem_pc_fd),
            inserts.map((u) => u.permite_contagem_kg_und),
            inserts.map((u) => u.contagem_diaria),
            inserts.map((u) => u.grupo_diario || ''),
          ],
        );
      }

      if (desativarIds.length) {
        await client.query(
          `UPDATE insumos
           SET ativo = FALSE, atualizado_em = NOW()
           WHERE id_insumo = ANY($1::int[])`,
          [desativarIds],
        );
        await client.query(
          `DELETE FROM estoque_itens ei
           USING estoque_contagens c
           WHERE ei.id_contagem = c.id_contagem
             AND ei.id_insumo = ANY($1::int[])
             AND c.status = 'aberta'`,
          [desativarIds],
        );
      }

      await client.query(`
        INSERT INTO estoque_itens (id_contagem, id_insumo, estoque_sistema, estoque_contado)
        SELECT c.id_contagem, p.id_insumo, COALESCE(s.quantidade, 0), NULL
        FROM estoque_contagens c
        JOIN insumos p ON p.id_loja = c.id_loja AND p.ativo
        LEFT JOIN estoque_saldos s ON s.id_insumo = p.id_insumo AND s.id_loja = p.id_loja
        WHERE c.status = 'aberta'
          AND COALESCE(c.tipo, 'completa') = 'completa'
          AND NOT EXISTS (
            SELECT 1 FROM estoque_itens x
            WHERE x.id_contagem = c.id_contagem AND x.id_insumo = p.id_insumo
          )
      `);

      await client.query('COMMIT');
      console.log(`OK ${Date.now() - t0}ms gravado em ${DB_NAME}.`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const { rows: cov } = await db.query(
      `SELECT l.id_loja, l.name,
              COUNT(*) FILTER (WHERE i.ativo)::int AS ativos,
              COUNT(*) FILTER (WHERE i.ativo AND i.custo_fonte = 'nf')::int AS nf,
              COUNT(*) FILTER (WHERE i.ativo AND i.custo_fonte = 'manual')::int AS manual
       FROM lojas l
       LEFT JOIN insumos i ON i.id_loja = l.id_loja
       WHERE l.id_loja = ANY($1::int[])
       GROUP BY l.id_loja, l.name
       ORDER BY l.id_loja`,
      [lojas.rows.map((l) => l.id_loja)],
    );
    console.log('\nCobertura:');
    for (const r of cov) {
      console.log(
        `${String(r.id_loja).padStart(3)} ativos=${String(r.ativos).padStart(3)} nf=${String(r.nf).padStart(3)} man=${String(r.manual).padStart(3)} ${String(r.name).slice(0, 40)}`,
      );
    }
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
