/**
 * Preenche estoque_nfe.pedido_esupri (xPed "E-Supri: U50491") nas NFs Platlog já gravadas.
 * Lê o XML do disco (xml_path; /app/Logs vira <repo>/Logs) e, se não achar, finance.nfe_recebida.
 *
 * Uso: node scripts/backfill-pedido-esupri-nfe.mjs [--db-prod] [--aplicar]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '..', '.env'), override: false });
dotenv.config({ path: path.join(root, '.env'), override: false });
const { pool } = await import('../src/db.js');
const { pedidoEsupriDoXml } = await import('../src/services/nfeXml.js');
const aplicar = process.argv.includes('--aplicar');
const repo = path.join(root, '..');

function lerXml(p) {
  if (!p) return null;
  const candidatos = [p];
  if (p.startsWith('/app/')) candidatos.push(path.join(repo, p.slice(5)), path.join(root, p.slice(5)));
  for (const c of candidatos) {
    try {
      if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
    } catch {
      /* segue */
    }
  }
  return null;
}

const { rows } = await pool.query(
  `SELECT id_nfe, chave, xml_path FROM estoque_nfe
   WHERE pedido_esupri IS NULL AND emitente_cnpj LIKE '02229804%'`,
);
console.log(`${rows.length} NFs Platlog sem pedido`);

const financeiro = pool;

let doDisco = 0;
let doFinanceiro = 0;
let semXml = 0;
const atualizacoes = [];
for (const r of rows) {
  let xml = lerXml(r.xml_path);
  if (xml) doDisco += 1;
  if (!xml && financeiro && r.chave) {
    try {
      const q = await financeiro.query(
        `SELECT xml FROM finance.nfe_recebida WHERE chave = $1 AND xml IS NOT NULL LIMIT 1`,
        [r.chave],
      );
      xml = q.rows[0]?.xml || null;
      if (xml) doFinanceiro += 1;
    } catch {
      /* sem financeiro */
    }
  }
  if (!xml) {
    semXml += 1;
    continue;
  }
  const ped = pedidoEsupriDoXml(xml);
  if (ped) atualizacoes.push([r.id_nfe, ped]);
}
console.log({ doDisco, doFinanceiro, semXml, comPedido: atualizacoes.length });

if (aplicar) {
  for (const [id, ped] of atualizacoes) {
    await pool.query(`UPDATE estoque_nfe SET pedido_esupri = $2 WHERE id_nfe = $1 AND pedido_esupri IS NULL`, [id, ped]);
  }
  console.log('Gravado.');
} else {
  console.log('Simulação. Rode com --aplicar.');
}
await pool.end();
