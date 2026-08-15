/**
 * Teste da paginação REST+JSON+JWT do estoque.
 * Chama as páginas em sequência (1 request por vez) — sem rajada paralela.
 *
 * Local:
 *   node backend/scripts/teste-paginacao-estoque-api.mjs --loja=21
 *
 * Produção (recomendado: token real do browser logado):
 *   node backend/scripts/teste-paginacao-estoque-api.mjs --base=https://grupoalvim.com.br --token=SEU_JWT --loja=21
 *
 * --base = origem do site (com ou sem /auditoria). API = {origem}/auditoria/api
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env'), override: false });
dotenv.config({ path: path.join(root, 'backend', '.env'), override: true });
process.env.DB_NAME = process.env.DB_NAME_DEV || 'vision_check_dev';

const args = process.argv.slice(2);
const getArg = (k, def) => {
  const hit = args.find((a) => a.startsWith(`${k}=`));
  return hit ? hit.slice(k.length + 1) : def;
};

const BASE = String(getArg('--base', 'http://localhost:5000'))
  .replace(/\/$/, '')
  .replace(/\/auditoria$/i, '');
const API = `${BASE}/auditoria/api`;
const ID_LOJA = Number(getArg('--loja', '21'));
const ID_USER = Number(getArg('--user', '3'));
const PAGE_SIZE = Number(getArg('--pageSize', '5'));
const TOKEN_ARG = getArg('--token', '');

let token = TOKEN_ARG;
if (!token) {
  const { signToken } = await import('../src/auth.js');
  token = signToken({
    id_usuario: ID_USER,
    sub: ID_USER,
    nome: 'Teste Paginacao',
  });
  console.log('JWT: gerado localmente (só funciona se JWT_SECRET for o mesmo do ambiente alvo)');
} else {
  console.log('JWT: usando --token informado');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(method, urlPath, authToken) {
  const started = Date.now();
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  const ms = Date.now() - started;
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, ms, data };
}

function isEnvelope(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.data) &&
    data.meta &&
    typeof data.meta.page === 'number' &&
    typeof data.meta.pageSize === 'number' &&
    typeof data.meta.total === 'number' &&
    typeof data.meta.hasMore === 'boolean'
  );
}

async function testarEndpoint(nome, pathBase, authToken) {
  console.log(`\n── ${nome} ──`);

  const legado = await api('GET', `${pathBase}`, authToken);
  assert(legado.ok, `${nome} legado HTTP ${legado.status}: ${JSON.stringify(legado.data)}`);
  assert(Array.isArray(legado.data), `${nome} legado deveria ser array`);
  console.log(`  legado: HTTP ${legado.status} array[${legado.data.length}] ${legado.ms}ms`);

  const p1 = await api(
    'GET',
    `${pathBase}${pathBase.includes('?') ? '&' : '?'}paginate=1&page=1&pageSize=${PAGE_SIZE}`,
    authToken,
  );
  assert(p1.ok, `${nome} page1 HTTP ${p1.status}: ${JSON.stringify(p1.data)}`);
  assert(isEnvelope(p1.data), `${nome} page1 sem envelope {data,meta} — paginação ainda não deployada?`);
  assert(p1.data.meta.page === 1, `${nome} page1 meta.page != 1`);
  assert(p1.data.meta.pageSize === PAGE_SIZE, `${nome} pageSize incorreto`);
  assert(p1.data.data.length <= PAGE_SIZE, `${nome} page1 retornou mais que pageSize`);
  console.log(
    `  page1: HTTP ${p1.status} data[${p1.data.data.length}] total=${p1.data.meta.total} hasMore=${p1.data.meta.hasMore} ${p1.ms}ms`,
  );

  if (p1.data.meta.hasMore) {
    const p2 = await api(
      'GET',
      `${pathBase}${pathBase.includes('?') ? '&' : '?'}paginate=1&page=2&pageSize=${PAGE_SIZE}`,
      authToken,
    );
    assert(p2.ok, `${nome} page2 HTTP ${p2.status}: ${JSON.stringify(p2.data)}`);
    assert(isEnvelope(p2.data), `${nome} page2 sem envelope`);
    assert(p2.data.meta.page === 2, `${nome} page2 meta.page != 2`);

    const ids1 = new Set(p1.data.data.map((r) => JSON.stringify(r)));
    const overlap = p2.data.data.filter((r) => ids1.has(JSON.stringify(r)));
    assert(overlap.length === 0, `${nome} page1 e page2 se sobrepõem`);
    console.log(
      `  page2: HTTP ${p2.status} data[${p2.data.data.length}] sem overlap com page1 ${p2.ms}ms`,
    );
  } else {
    console.log('  page2: pulada (hasMore=false)');
  }

  return { total: p1.data.meta.total, requests: p1.data.meta.hasMore ? 3 : 2 };
}

console.log(`Base: ${API}`);
console.log(`Loja: ${ID_LOJA} | user: ${ID_USER} | pageSize: ${PAGE_SIZE}`);
console.log('Modo: REST + JSON + JWT | requests SEQUENCIAIS (sem paralelismo)');

const health = await fetch(`${API}/public/config`).catch((e) => ({ ok: false, error: e }));
if (!health.ok) {
  console.error('\nAPI não respondeu em', API);
  console.error('Confira --base (ex.: https://grupoalvim.com.br)');
  process.exit(1);
}

let totalRequests = 0;
const resultados = [];

for (const [nome, pathBase] of [
  ['insumos', `/estoque/insumos?id_loja=${ID_LOJA}`],
  ['movimentos', `/estoque/movimentos?id_loja=${ID_LOJA}`],
  ['contagens', `/estoque/contagens?id_loja=${ID_LOJA}`],
  ['vendas', `/estoque/vendas?id_loja=${ID_LOJA}`],
]) {
  try {
    const r = await testarEndpoint(nome, pathBase, token);
    totalRequests += r.requests;
    resultados.push({ nome, ok: true, total: r.total });
  } catch (e) {
    console.error(`  FALHOU: ${e.message}`);
    resultados.push({ nome, ok: false, erro: e.message });
  }
}

console.log('\n══ Resumo ══');
for (const r of resultados) {
  console.log(r.ok ? `  ✓ ${r.nome} (total=${r.total})` : `  ✗ ${r.nome}: ${r.erro}`);
}
console.log(`Requests feitas (sequenciais): ~${totalRequests}+`);
const falhas = resultados.filter((r) => !r.ok);
if (falhas.length) {
  console.error(`\n${falhas.length} endpoint(s) falharam`);
  process.exit(1);
}
console.log('\nOK — paginação REST+JWT funcionando, sem rajada paralela.');
process.exit(0);
