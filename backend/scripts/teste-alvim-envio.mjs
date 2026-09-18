/**
 * Teste pontual do Alvim: estoque zero via GPT, só no telefone passado.
 * Não liga o scheduler. Não registra dedup.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.DB_USE_PROD = '1';
process.env.AGENTE_ALVIM_ENABLED = 'false';

const backendEnv = path.join(root, 'backend', '.env');
if (fs.existsSync(backendEnv)) {
  const local = dotenv.parse(fs.readFileSync(backendEnv));
  for (const [key, value] of Object.entries(local)) {
    if (value !== undefined && String(value).trim() !== '') process.env[key] = value;
  }
}
process.env.DB_USE_PROD = '1';
process.env.AGENTE_ALVIM_ENABLED = 'false';
process.env.WPP_HOST = 'http://localhost';
if (String(process.env.WPP_ENABLED || '').toLowerCase() !== 'true') {
  process.env.WPP_ENABLED = 'true';
}

const telefone = String(process.argv[2] || '').trim();
if (!telefone) {
  console.error('uso: node backend/scripts/teste-alvim-envio.mjs 61991094654');
  process.exit(1);
}

const { pool } = await import('../src/db.js');
const { aiEnabled, aiProvider, aiModel, llmKeyPresent } = await import('../src/agenteAlvim/llm.js');
const { executarTesteAgenteAlvim } = await import('../src/agenteAlvim/monitor.js');
const { carregarCredenciaisWpp } = await import('../src/services/wppSession.js');
const { verificarConexaoWpp, wppEnabled } = await import('../src/services/wppClient.js');

console.log(JSON.stringify({
  db: process.env.DB_NAME,
  wpp: wppEnabled(),
  ai: aiEnabled(),
  provider: aiProvider(),
  model: aiModel(),
  has_llm_key: llmKeyPresent(),
  scheduler: process.env.AGENTE_ALVIM_ENABLED,
}));

try {
  const cred = await carregarCredenciaisWpp();
  if (!cred?.token) {
    console.error(JSON.stringify({ ok: false, motivo: 'sem_token_wpp' }));
    process.exit(1);
  }
  const sess = await verificarConexaoWpp(cred.token);
  console.log(JSON.stringify({ wpp_conectado: sess.conectado }));
  if (!sess.conectado) {
    console.error(JSON.stringify({ ok: false, motivo: 'wpp_desconectado' }));
    process.exit(1);
  }

  const r = await executarTesteAgenteAlvim({ ferramenta: 'estoque', telefone });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok === false && !r.resultados?.length ? 1 : 0);
} finally {
  await pool.end().catch(() => {});
}
