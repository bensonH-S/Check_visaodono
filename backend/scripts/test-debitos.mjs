import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
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

if (rows.length === 0) {
  console.log('Nenhum veículo encontrado');
  process.exit(0);
}

const v = rows[0];
const placa = String(v.placa).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const renavam = String(v.renavam).replace(/\D/g, '');

console.log(`Testando com veículo Placa: ${placa}, Renavam: ${renavam}`);

const url = new URL(`${base}/detran/df/debitos`);
url.searchParams.set('token', token);
url.searchParams.set('placa', placa);
url.searchParams.set('renavam', renavam);

const loginCpf = process.env.DETRAN_PORTAL_CPF || process.env.INFOSIMPLES_LOGIN_CPF || process.env.DETRAN_DF_LOGIN_CPF;
const loginSenha = process.env.DETRAN_PORTAL_SENHA || process.env.INFOSIMPLES_LOGIN_SENHA || process.env.DETRAN_DF_LOGIN_SENHA;
if (loginCpf) url.searchParams.set('login_cpf', loginCpf);
if (loginSenha) url.searchParams.set('login_senha', loginSenha);

import { normalizarRespostaDetran } from '../src/services/detranDfMultas.js';

const res = await fetch(url.toString(), {
  headers: { Accept: 'application/json', 'User-Agent': 'Meridian-Frota/1.0' },
});
console.log('Status HTTP:', res.status);
const data = await res.json();
console.log('Code:', data.code);
console.log('Code Message:', data.code_message);
console.log('Erros:', data.errors);
console.log('Total de registros:', data.data_count);
if (data.data && data.data[0]) {
  console.log('Keys do primeiro data:', Object.keys(data.data[0]));
  if (data.data[0].debitos) {
    console.log('Keys de debitos:', Object.keys(data.data[0].debitos));
    console.log('infracoes_veiculo length:', data.data[0].debitos.infracoes_veiculo?.length);
    console.log('infracoes length:', data.data[0].debitos.infracoes?.length);
    console.log('Primeira infracao bruta:', JSON.stringify(data.data[0].debitos.infracoes?.[0] || data.data[0].debitos.infracoes_veiculo?.[0], null, 2));
    
    // Test normalizer
    const norm = normalizarRespostaDetran(data, placa, renavam);
    console.log('\n--- Resultado Normalizado ---');
    console.log('Qtd Multas normalizadas:', norm.multas.length);
    console.log('Primeira multa normalizada:', JSON.stringify(norm.multas[0], null, 2));
    console.log('Dados Veículo:', JSON.stringify(norm.veiculo, null, 2));
  }
}
