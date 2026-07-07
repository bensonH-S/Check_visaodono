/**
 * Script de Diagnóstico - Fulltrack API
 * Testa diferentes métodos de autenticação e endpoints
 * Rode com: node diagnose.js
 */

const https = require('https');
const http = require('http');

const APIKEY = '52c9b6ed01d83c53fbd53c6f94bddcf307c0c58c';
const SECRETKEY = '85cef25d68ab612c2947eac7bcf06ab835facaa7';
const BASE_URL = 'ws.fulltrack2.com';

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test(label, options, body = null) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 TESTE: ${label}`);
  console.log(`   Path: ${options.path}`);
  console.log(`   Headers: ${JSON.stringify(options.headers, null, 2)}`);
  try {
    const res = await makeRequest(options, body);
    console.log(`   Status: ${res.status}`);
    console.log(`   Body (primeiros 500 chars): ${res.body.substring(0, 500)}`);
  } catch (err) {
    console.log(`   ERRO: ${err.message}`);
  }
}

async function run() {
  console.log('🚀 Iniciando Diagnóstico da API Fulltrack...\n');

  // ---- Teste 1: Headers padrão como documentação genérica ----
  await test('Headers apikey + secretkey (GET /vehicles/all)', {
    hostname: BASE_URL,
    port: 80,
    path: '/vehicles/all',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': APIKEY,
      'secretkey': SECRETKEY,
    }
  });

  // ---- Teste 2: Headers com X- prefix ----
  await test('Headers X-API-KEY + X-SECRET-KEY (GET /vehicles/all)', {
    hostname: BASE_URL,
    port: 80,
    path: '/vehicles/all',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': APIKEY,
      'X-SECRET-KEY': SECRETKEY,
    }
  });

  // ---- Teste 3: Authorization Bearer ----
  await test('Authorization Bearer APIKEY (GET /vehicles/all)', {
    hostname: BASE_URL,
    port: 80,
    path: '/vehicles/all',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${APIKEY}`,
    }
  });

  // ---- Teste 4: Query string ----
  await test('Query String ?apikey=... (GET /vehicles/all)', {
    hostname: BASE_URL,
    port: 80,
    path: `/vehicles/all?apikey=${APIKEY}&secretkey=${SECRETKEY}`,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  // ---- Teste 5: POST /authorize ----
  const authBody = JSON.stringify({ apikey: APIKEY, secretkey: SECRETKEY });
  await test('POST /authorize com body JSON', {
    hostname: BASE_URL,
    port: 80,
    path: '/authorize',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(authBody),
    }
  }, authBody);

  // ---- Teste 6: POST /authorize/client ----
  await test('POST /authorize/client com body JSON', {
    hostname: BASE_URL,
    port: 80,
    path: '/authorize/client',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(authBody),
    }
  }, authBody);

  // ---- Teste 7: GET raiz ----
  await test('GET / para verificar endpoints disponíveis', {
    hostname: BASE_URL,
    port: 80,
    path: '/',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  console.log('\n\n✅ Diagnóstico concluído! Verifique os resultados acima.');
}

run().catch(console.error);
