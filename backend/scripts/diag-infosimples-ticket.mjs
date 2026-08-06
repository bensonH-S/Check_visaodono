/**
 * Captura resposta bruta Infosimples (para chamado de suporte).
 * Uso: node backend/scripts/diag-infosimples-ticket.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), override: true });

const token = process.env.INFOSIMPLES_TOKEN;
const base = (process.env.INFOSIMPLES_API_BASE || 'https://api.infosimples.com/api/v2/consultas').replace(
  /\/$/,
  '',
);

const c = new pg.Client({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 5432),
});
await c.connect();
const { rows } = await c.query(
  `SELECT placa, renavam, chassi
   FROM frota_veiculos
   WHERE ativo = TRUE AND renavam IS NOT NULL AND BTRIM(renavam) <> ''
   ORDER BY placa LIMIT 1`,
);
await c.end();

const v = rows[0];
const placa = String(v.placa).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const renavam = String(v.renavam).replace(/\D/g, '');
const chassi = v.chassi ? String(v.chassi).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

const testes = [
  {
    nome: 'detran/df/veiculo/mobile (infracoes - nosso path)',
    path: 'detran/df/veiculo/mobile',
    params: { placa, renavam },
  },
  {
    nome: 'detran/df/veiculo (descontinuada)',
    path: 'detran/df/veiculo',
    params: { placa, renavam },
  },
  {
    nome: 'detran/restricoes (unificada)',
    path: 'detran/restricoes',
    params: { placa, renavam, uf: 'DF', ...(chassi ? { chassi } : {}) },
  },
];

console.log('=== Diagnostico Infosimples para chamado ===');
console.log(JSON.stringify({
  quando: new Date().toISOString(),
  veiculo_teste: { placa, renavam, chassi: chassi || null },
  INFOSIMPLES_ENABLED: process.env.INFOSIMPLES_ENABLED,
  consulta_config: process.env.INFOSIMPLES_DETRAN_DF_CONSULTA,
}, null, 2));

for (const t of testes) {
  const url = new URL(`${base}/${t.path}`);
  url.searchParams.set('token', token);
  for (const [k, val] of Object.entries(t.params)) {
    if (val) url.searchParams.set(k, String(val));
  }
  const inicio = Date.now();
  let httpStatus = 0;
  let body = null;
  let erroRede = null;
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json', 'User-Agent': 'Meridian-Frota/1.0' },
      signal: AbortSignal.timeout(45000),
    });
    httpStatus = res.status;
    body = await res.json();
  } catch (e) {
    erroRede = e instanceof Error ? e.message : String(e);
  }
  console.log('\n---', t.nome, '---');
  console.log(JSON.stringify({
    path: t.path,
    ms: Date.now() - inicio,
    http_status: httpStatus || null,
    code: body?.code ?? null,
    code_message: body?.code_message ?? null,
    errors: body?.errors ?? null,
    data_count: body?.data_count ?? null,
    erro_rede: erroRede,
  }, null, 2));
}
