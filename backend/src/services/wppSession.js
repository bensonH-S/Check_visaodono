import { pool } from '../db.js';
import {
  erroRedeWppParaStatus,
  fecharSessaoWpp,
  gerarTokenWpp,
  iniciarSessaoWpp,
  isErroRedeWpp,
  obterEstadoSessaoWpp,
  obterQrCodeWpp,
  extrairQrcodeResposta,
  verificarConexaoWpp,
  wppConfig,
  wppEnabled,
} from './wppClient.js';

let _tabelaOk = false;

async function ensureWppSessaoTable() {
  if (_tabelaOk) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wpp_sessao (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      session_name VARCHAR(80) NOT NULL,
      token TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  _tabelaOk = true;
}

export async function carregarCredenciaisWpp() {
  if (!wppEnabled()) return null;
  await ensureWppSessaoTable();
  const { session } = wppConfig();
  const envToken = String(process.env.WPP_TOKEN || '').trim();

  const { rows } = await pool.query('SELECT session_name, token FROM wpp_sessao WHERE id = 1');
  if (rows[0]?.token) {
    return { session: rows[0].session_name || session, token: rows[0].token };
  }

  if (envToken) {
    await salvarCredenciaisWpp(session, envToken);
    return { session, token: envToken };
  }

  const token = await gerarTokenWpp();
  await salvarCredenciaisWpp(session, token);
  return { session, token };
}

export async function salvarCredenciaisWpp(sessionName, token) {
  await ensureWppSessaoTable();
  await pool.query(
    `INSERT INTO wpp_sessao (id, session_name, token, updated_at)
     VALUES (1, $1, $2, NOW())
     ON CONFLICT (id) DO UPDATE
     SET session_name = EXCLUDED.session_name, token = EXCLUDED.token, updated_at = NOW()`,
    [sessionName, token],
  );
}

export async function statusSessaoWpp() {
  if (!wppEnabled()) {
    return {
      enabled: false,
      conectado: false,
      session: wppConfig().session,
      message: 'WhatsApp desabilitado (WPP_ENABLED)',
    };
  }
  try {
    const cred = await carregarCredenciaisWpp();
    if (!cred) return { enabled: false, conectado: false, session: wppConfig().session };
    const { conectado, raw } = await verificarConexaoWpp(cred.token);
    const estado = conectado ? null : await obterEstadoSessaoWpp(cred.token);
    return {
      enabled: true,
      conectado,
      session: cred.session,
      message: raw?.message || (conectado ? 'Connected' : 'Disconnected'),
      sessionStatus: estado?.status || null,
    };
  } catch (err) {
    if (isErroRedeWpp(err)) return erroRedeWppParaStatus(err);
    throw err;
  }
}

export async function conectarSessaoWpp({ reiniciar = false } = {}) {
  let cred = await carregarCredenciaisWpp();
  if (!cred) throw new Error('WhatsApp não configurado');

  try {
    const status = await verificarConexaoWpp(cred.token);
    if (status.conectado) {
      return { conectado: true, qrcode: null, message: 'Sessão já conectada' };
    }

    const estadoAtual = await obterEstadoSessaoWpp(cred.token);
    if (!reiniciar && estadoAtual.qrcode) {
      return {
        conectado: false,
        qrcode: estadoAtual.qrcode,
        message: 'Escaneie o QR Code no WhatsApp (Aparelhos conectados)',
      };
    }

    const precisaIniciar =
      reiniciar ||
      estadoAtual.status === 'CLOSED' ||
      !estadoAtual.status ||
      estadoAtual.status === 'QRCODE';

    if (precisaIniciar) {
      await fecharSessaoWpp(cred.token);
      let start = await iniciarSessaoWpp(cred.token);
      if (start.status === 401 || start.status === 403) {
        const token = await gerarTokenWpp();
        await salvarCredenciaisWpp(cred.session, token);
        cred = { session: cred.session, token };
        start = await iniciarSessaoWpp(cred.token);
      }
      const qrStart = extrairQrcodeResposta(start.data);
      if (qrStart) {
        return {
          conectado: false,
          qrcode: qrStart,
          message: 'Escaneie o QR Code no WhatsApp (Aparelhos conectados)',
        };
      }
      if (!start.ok && start.status !== 409) {
        console.warn('[wpp] start-session:', start.status, start.data);
      }
    }

    const qr = await obterQrCodeWpp(cred.token, { tentativas: 30, intervaloMs: 3000 });
    const pos = await verificarConexaoWpp(cred.token);

    return {
      conectado: pos.conectado,
      qrcode: qr.qrcode,
      message: pos.conectado
        ? 'Conectado'
        : qr.qrcode
          ? 'Escaneie o QR Code no WhatsApp (Aparelhos conectados)'
          : 'QR ainda não disponível — o Chromium pode levar até 2 min. Clique em Atualizar.',
    };
  } catch (err) {
    if (isErroRedeWpp(err)) {
      const s = erroRedeWppParaStatus(err);
      throw new Error(s.message);
    }
    throw err;
  }
}

export async function obterQrSessaoWpp() {
  const cred = await carregarCredenciaisWpp();
  if (!cred) throw new Error('WhatsApp não configurado');

  const status = await verificarConexaoWpp(cred.token);
  if (status.conectado) return { conectado: true, qrcode: null };

  const estado = await obterEstadoSessaoWpp(cred.token);
  if (estado.qrcode) return { conectado: false, qrcode: estado.qrcode };

  if (estado.status === 'CLOSED' || !estado.status) {
    return conectarSessaoWpp({ reiniciar: true });
  }

  const qr = await obterQrCodeWpp(cred.token, { tentativas: 4, intervaloMs: 1500 });
  return { conectado: false, qrcode: qr.qrcode };
}
