/**
 * Homologação no WhatsApp do Benson — nunca manda para regional/grupo.
 *   node backend/scripts/teste-alvim-homolog.mjs 61991094654
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
process.env.WPP_ENABLED = 'true';

const telefone = String(process.argv[2] || '61991094654').replace(/\D/g, '');

const { pool } = await import('../src/db.js');
const { executarTesteAgenteAlvim } = await import('../src/agenteAlvim/monitor.js');
const { responderMensagemAlvim } = await import('../src/agenteAlvim/conversa.js');
const { carregarCredenciaisWpp } = await import('../src/services/wppSession.js');
const { verificarConexaoWpp } = await import('../src/services/wppClient.js');
const { carregarConfigAlvim } = await import('../src/agenteAlvim/persona.js');

function pausa(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resumo(r) {
  const det = r.resultados?.[0]?.detalhes?.[0] || {};
  return {
    ok: r.ok,
    ferramenta: r.resultados?.[0]?.ferramenta,
    enviados: r.resultados?.[0]?.enviados,
    motivo: r.resultados?.[0]?.motivo || det.motivo,
    bolhas: det.bolhas,
    teste: det.teste,
  };
}

try {
  const cred = await carregarCredenciaisWpp();
  const sess = cred?.token ? await verificarConexaoWpp(cred.token) : { conectado: false };
  const cfg = await carregarConfigAlvim();
  console.log(JSON.stringify({
    db: process.env.DB_NAME,
    wpp: sess.conectado,
    destino: telefone,
    tom: String(cfg.tom || '').slice(0, 80),
    scheduler: process.env.AGENTE_ALVIM_ENABLED,
  }));
  if (!sess.conectado) {
    console.error(JSON.stringify({ ok: false, motivo: 'wpp_desconectado' }));
    process.exit(1);
  }

  console.log('1_estoque');
  const estoque = await executarTesteAgenteAlvim({ ferramenta: 'estoque', telefone });
  console.log(JSON.stringify(resumo(estoque)));

  await pausa(2500);

  console.log('2_contagem');
  const contagem = await executarTesteAgenteAlvim({ ferramenta: 'contagem', telefone });
  console.log(JSON.stringify(resumo(contagem)));

  await pausa(3500);

  console.log('3_conferir_afirmacao');
  const resposta = await responderMensagemAlvim(telefone, 'Samambaia está finalizado', {
    nomePessoa: 'Benson',
  });
  console.log(JSON.stringify(resposta));

  const ok = Boolean(estoque.ok !== false && contagem.ok !== false);
  process.exit(ok ? 0 : 1);
} finally {
  await pool.end().catch(() => {});
}
