/**
 * Sync NF-e Platlog (eSupri VERONICA) → estoque_nfe.
 *
 *   npm run estoque:sync-platlog -- --loja=16 --limit=30 --apply --db=prod
 *   npm run estoque:sync-platlog -- --todas --limit=40 --apply --db=prod
 *
 * Credenciais: ESUPRI_USER / ESUPRI_PASS
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { credencialPlatlog, findEsupriLojaByBk } from '../src/config/fornecedoresLojas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};

const todas = args.includes('--todas') || args.includes('--all');
const idLoja = Number(getArg('--loja', '21'));
const limit = Number(getArg('--limit', todas ? '40' : '3'));
const aplicar = args.includes('--apply');
const registrarEntrada = args.includes('--entrada');
const headed = args.includes('--headed');
const cred = credencialPlatlog();
const user = cred.user;
const pass = cred.pass;

const dbFlag = getArg('--db', '');
if (dbFlag === 'dev') process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev';
if (dbFlag === 'prod') {
  process.env.DB_NAME = process.env.DB_NAME_PROD || 'vision_check';
  process.env.NODE_ENV = 'production';
}

console.log({
  modo: todas ? 'todas as lojas' : `loja ${idLoja}`,
  limit,
  aplicar,
  registrar_entrada: registrarEntrada,
  db_host: process.env.DB_HOST,
  db: process.env.DB_NAME,
  user: user ? `${user.slice(0, 3)}***` : '(vazio)',
});

if (!user || !pass) {
  console.error('Defina ESUPRI_USER / ESUPRI_PASS no .env ou platlog no JSON local');
  process.exit(1);
}

const { pool } = await import('../src/db.js');
const { syncNfePlatlog } = await import('../src/services/platlog/syncNfePlatlog.js');
const { baixarNfesFinanceiroVariasLojasEsupri } = await import(
  '../src/services/platlog/esupriClient.js'
);

function imprimirResultado(result, rotulo) {
  console.log(`\n=== ${rotulo} ===`);
  console.log('baixadas', result.baixadas, '| pasta', result.outDir);
  for (const p of result.processadas) {
    const flag = p.pulada ? 'PULADA' : p.aplicado ? 'APLICADA' : p.ok ? 'PREVIEW' : 'ERRO';
    console.log(
      `- [${flag}] ${p.notaLabel || '?'} NF ${p.numero || ''} · casados ${p.casados ?? 0}/${p.itens ?? 0}` +
        (p.erro ? ` · ${p.erro}` : ''),
    );
  }
}

async function resolverAlvos() {
  if (!todas) {
    const { rows } = await pool.query(
      `SELECT id_loja, name, bk_number FROM lojas WHERE id_loja = $1`,
      [idLoja],
    );
    if (!rows[0]) throw new Error(`Loja ${idLoja} não encontrada`);
    const bk = rows[0].bk_number ? String(rows[0].bk_number).replace(/\D/g, '') : '';
    const esupri = findEsupriLojaByBk(bk);
    if (!esupri?.esupri_codigo) {
      throw new Error(`Loja ${idLoja} (BK ${bk || '?'}) sem código eSupri no mapeamento`);
    }
    return [
      {
        id_loja: rows[0].id_loja,
        name: rows[0].name,
        bk,
        codigo: esupri.esupri_codigo,
        label: `${rows[0].name} (${bk})`,
      },
    ];
  }

  const { rows } = await pool.query(
    `SELECT l.id_loja, l.name, l.bk_number,
            (SELECT COUNT(*)::int FROM estoque_nfe n WHERE n.id_loja = l.id_loja) AS nfes
     FROM lojas l
     WHERE COALESCE(l.is_active, TRUE)
     ORDER BY l.name`,
  );

  const alvos = [];
  for (const r of rows) {
    const bk = r.bk_number ? String(r.bk_number).replace(/\D/g, '') : '';
    const esupri = findEsupriLojaByBk(bk);
    if (!esupri?.esupri_codigo) continue;
    alvos.push({
      id_loja: r.id_loja,
      name: r.name,
      bk,
      nfes: r.nfes,
      codigo: esupri.esupri_codigo,
      label: `${r.name} (${bk})`,
    });
  }

  // 408 Sul primeiro, depois quem está zerado.
  alvos.sort((a, b) => {
    const prio = (x) => (x.bk === '18915' ? 0 : x.nfes === 0 ? 1 : 2);
    const d = prio(a) - prio(b);
    if (d) return d;
    return String(a.name).localeCompare(String(b.name), 'pt-BR');
  });
  return alvos;
}

const alvos = await resolverAlvos();
if (!alvos.length) {
  console.error('Nenhuma loja com mapeamento eSupri');
  process.exit(1);
}

console.log(
  `Lojas na fila (${alvos.length}):`,
  alvos.map((a) => `${a.id_loja}:${a.bk}`).join(', '),
);

let aplicadas = 0;
let erros = 0;

await baixarNfesFinanceiroVariasLojasEsupri({
  user,
  pass,
  lojas: alvos,
  limit,
  headless: !headed,
  onLog: (m) => console.log('[esupri]', m),
  onLoja: async (item) => {
    const downloads = item.downloads || [];
    console.log(`\n>>> ${item.label} · ${downloads.length} XML(s)`);
    try {
      const result = await syncNfePlatlog({
        id_loja: item.id_loja,
        user,
        pass,
        esupriLojaCodigo: item.codigo,
        downloads,
        limit,
        aplicar,
        registrar_entrada: registrarEntrada,
        headless: !headed,
      });
      imprimirResultado(result, item.label);
      aplicadas += (result.processadas || []).filter((p) => p.aplicado).length;
      erros += (result.processadas || []).filter((p) => !p.ok).length;
      if (aplicar) {
        const aplicadasLoja = (result.processadas || []).filter((p) => p.aplicado).length;
        const errosLoja = (result.processadas || []).filter((p) => !p.ok).length;
        await pool.query(
          `UPDATE estoque_sync_fornecedor
           SET ultimo_inicio = COALESCE(ultimo_inicio, NOW()),
               ultimo_fim = NOW(),
               ultimo_status = $2,
               ultimo_erro = $3,
               ultimo_resumo = $4::jsonb,
               ultima_execucao_dia = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
               atualizado_em = NOW()
           WHERE fornecedor = 'platlog' AND id_loja = $1`,
          [
            item.id_loja,
            errosLoja && aplicadasLoja ? 'parcial' : errosLoja ? 'erro' : 'ok',
            errosLoja ? (result.processadas || []).filter((p) => !p.ok).map((p) => p.erro).join('; ').slice(0, 500) : null,
            JSON.stringify({
              modo: 'nfe',
              baixadas: result.baixadas || 0,
              aplicadas: aplicadasLoja,
              erros: errosLoja,
            }),
          ],
        );
      }
    } catch (e) {
      erros += 1;
      console.error(`ERRO ${item.label}:`, e.message);
    }
  },
});

console.log(
  aplicar
    ? `\nOK: gravado no banco — aplicadas=${aplicadas} erros=${erros}`
    : `\nDry-run: nada gravado. Rode de novo com --apply. erros=${erros}`,
);

process.exit(erros && !aplicadas ? 1 : 0);
