/**
 * Script de Diagnóstico - Fulltrack API (Parte 2)
 * Investiga endpoints de posição e histórico
 */

const http = require('http');

const APIKEY = '52c9b6ed01d83c53fbd53c6f94bddcf307c0c58c';
const SECRETKEY = '85cef25d68ab612c2947eac7bcf06ab835facaa7';
const BASE_URL = 'ws.fulltrack2.com';
const VEHICLE_ID = '1442468'; // ID obtido do diagnóstico anterior

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function test(label, path) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 ${label}`);
  console.log(`   GET ${path}`);
  try {
    const res = await makeRequest({
      hostname: BASE_URL, port: 80, path, method: 'GET',
      headers: { 'Content-Type': 'application/json', 'apikey': APIKEY, 'secretkey': SECRETKEY }
    });
    console.log(`   Status: ${res.status}`);
    // Mostrar os primeiros 1000 chars do body
    let body = res.body.substring(0, 1000);
    try {
      const parsed = JSON.parse(res.body);
      if (parsed.data && Array.isArray(parsed.data) && parsed.data.length > 0) {
        console.log(`   ✅ Retornou ${parsed.data.length} registros.`);
        console.log(`   📋 Campos disponíveis: ${Object.keys(parsed.data[0]).join(', ')}`);
        console.log(`   📦 Primeiro registro: ${JSON.stringify(parsed.data[0], null, 2).substring(0, 800)}`);
      } else {
        console.log(`   Body: ${body}`);
      }
    } catch {
      console.log(`   Body: ${body}`);
    }
  } catch (err) {
    console.log(`   ERRO: ${err.message}`);
  }
}

async function run() {
  console.log('🚀 Diagnóstico 2 - Posição e Histórico de Veículo: ' + VEHICLE_ID);

  await test('Posição atual do veículo', `/vehicles/status/id/${VEHICLE_ID}`);
  await test('Todos veículos com posição', `/vehicles/all`);
  await test('Eventos telemetria', `/events/telemetry/id/${VEHICLE_ID}`);
  await test('Todos os eventos', `/events/all`);
  await test('Eventos por intervalo', `/events/interval/id/${VEHICLE_ID}/start/2026-05-14%2000:00:00/end/2026-05-15%2023:59:59`);
  await test('Referência pontos', `/referencepoints/all`);

  console.log('\n\n✅ Diagnóstico 2 concluído!');
}

run().catch(console.error);
