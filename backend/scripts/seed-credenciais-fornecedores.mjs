/**
 * Lê backend/config/credenciais-fornecedores.local.json (gitignored)
 * e grava no banco. Não versiona senha.
 *
 *   node backend/scripts/seed-credenciais-fornecedores.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: false });

const jsonPath = path.join(root, 'backend', 'config', 'credenciais-fornecedores.local.json');
if (!fs.existsSync(jsonPath)) {
  console.error('Arquivo ausente:', jsonPath);
  process.exit(1);
}

const { pool } = await import('../src/db.js');
const { gravarCredencial, recarregarCredenciaisFornecedor } =
  await import('../src/services/estoqueFornecedorCredencial.js');

const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const { rows: lojas } = await pool.query(
  `SELECT id_loja, name, regexp_replace(COALESCE(bk_number, ''), '\\D', '', 'g') AS bk
   FROM lojas`,
);
const porBk = new Map(lojas.map((l) => [l.bk, l]));

let gravadas = 0;
let semLoja = [];

if (raw.platlog?.user && raw.platlog?.pass) {
  await gravarCredencial({
    fornecedor: 'platlog',
    id_loja: null,
    portal: 'rede',
    usuario: raw.platlog.user,
    senha: raw.platlog.pass,
  });
  gravadas += 1;
}

for (const [bk, cfg] of Object.entries(raw.lojas || {})) {
  const loja = porBk.get(String(bk).replace(/\D/g, ''));
  if (!loja) {
    semLoja.push(`${bk} ${cfg.nome || ''}`);
    continue;
  }
  const pares = [
    ['platlog', 'loja', cfg.platlog_loja],
    ['coca', 'brasal', cfg.brasal],
    ['coca', 'cokenet', cfg.cokenet],
    ['gimba', 'gimba', cfg.gimba],
    ['idealwork', 'idealwork', cfg.idealwork],
  ];
  for (const [fornecedor, portal, cred] of pares) {
    if (!cred?.user || !cred?.pass) continue;
    await gravarCredencial({
      fornecedor,
      id_loja: loja.id_loja,
      portal,
      usuario: cred.user,
      senha: cred.pass,
    });
    gravadas += 1;
  }
}

await recarregarCredenciaisFornecedor();

const { rows: resumo } = await pool.query(
  `SELECT c.fornecedor, COUNT(*)::int AS n
   FROM estoque_fornecedor_credencial c
   WHERE c.usuario <> '' AND c.senha <> ''
   GROUP BY c.fornecedor
   ORDER BY c.fornecedor`,
);

console.log(`Gravadas ${gravadas} credenciais no banco.`);
if (semLoja.length) console.log('BK sem loja no cadastro:', semLoja.join(', '));
for (const r of resumo) console.log(`  ${r.fornecedor}: ${r.n}`);

await pool.end();
process.exit(0);
