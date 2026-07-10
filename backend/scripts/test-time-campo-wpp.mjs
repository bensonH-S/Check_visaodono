/**
 * Teste manual das notificações Time de Campo via WhatsApp.
 *
 * Uso:
 *   node scripts/test-time-campo-wpp.mjs status
 *   node scripts/test-time-campo-wpp.mjs usuario plinio@grupoalvim.com.br
 *   node scripts/test-time-campo-wpp.mjs visita 123
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env'), override: false });
dotenv.config({ path: path.join(projectRoot, 'backend', '.env'), override: false });

const [, , cmd, arg] = process.argv;

const { statusSessaoWpp } = await import('../src/services/wppSession.js');
const { enviarWhatsAppParaUsuario } = await import('../src/services/whatsappNotificacoes.js');
const { processarVisitaTimeCampoReprovada } = await import('../src/services/timeCampoNotificacoes.js');
const { pool } = await import('../src/db.js');

async function status() {
  const s = await statusSessaoWpp();
  console.log('WPP_ENABLED:', process.env.WPP_ENABLED);
  console.log('WPP_HOST:', process.env.WPP_HOST);
  console.log('WPP_PORT:', process.env.WPP_PORT);
  console.log('Status:', JSON.stringify(s, null, 2));
}

async function usuario(email) {
  const { rows } = await pool.query(
    `SELECT id_usuario, nome, email, telefone_whatsapp, notifica_whatsapp
     FROM usuarios WHERE LOWER(email) = LOWER($1) AND ativo = TRUE`,
    [email],
  );
  const u = rows[0];
  if (!u) {
    console.error('Usuário não encontrado:', email);
    process.exit(1);
  }
  if (!u.telefone_whatsapp) {
    console.error('Sem telefone_whatsapp cadastrado para', u.nome);
    process.exit(1);
  }
  if (u.notifica_whatsapp === false) {
    console.warn('AVISO: notifica_whatsapp está desativado para', u.nome);
  }
  const ok = await enviarWhatsAppParaUsuario(
    u.id_usuario,
    `✅ *Teste Vision Check — Time de Campo*\n\nOlá *${u.nome}*, notificação de teste para ${u.email}.`,
  );
  console.log(ok ? `Enviado para ${u.nome} (${u.telefone_whatsapp})` : 'Falha no envio — veja logs');
}

async function visita(idVisita) {
  const res = await processarVisitaTimeCampoReprovada(Number(idVisita));
  console.log('Resultado:', res);
}

try {
  if (cmd === 'status') await status();
  else if (cmd === 'usuario') {
    if (!arg) throw new Error('Informe o e-mail: node scripts/test-time-campo-wpp.mjs usuario plinio@...');
    await usuario(arg);
  } else if (cmd === 'visita') {
    if (!arg) throw new Error('Informe id_visita');
    await visita(arg);
  } else {
    console.log(`Comandos:
  status
  usuario <email>
  visita <id_visita>`);
  }
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
} finally {
  await pool.end();
}
