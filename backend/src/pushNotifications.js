import webpush from 'web-push';
import { pool } from './db.js';
import { logger } from './logger.js';
import { tipoVisivelPushUsuario, urlPushChamado } from './notificacoesFiltro.js';

let pushAtivo = false;

export function initPushNotifications() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:support@grupoalvim.com.br';

  if (!publicKey || !privateKey) {
    logger.warn('push', 'VAPID ausente — push desativado');
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  pushAtivo = true;
  logger.info('push', 'Web Push inicializado');
  return true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

let _tabelaPushOk;

async function ensurePushSubscriptionsTable() {
  if (_tabelaPushOk) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id_subscription SERIAL PRIMARY KEY,
        id_usuario INT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (id_usuario, endpoint)
      );
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_usuario
        ON push_subscriptions(id_usuario);
    `);
    _tabelaPushOk = true;
    return true;
  } catch (e) {
    logger.error('push', 'Falha ao garantir tabela push_subscriptions', { error: e.message });
    return false;
  }
}

export function montarTituloPush({ tipo, mensagem, numero, loja }) {
  const num = Number(numero) || 0;
  const p = `Chamado #${num} - `;

  switch (tipo) {
    case 'resposta':
      return `Nova Mensagem Chamado #${num}`;
    case 'fechamento':
      return /cancelado/i.test(mensagem || '')
        ? `Chamado #${num} - Cancelado`
        : `Chamado #${num} - Concluído`;
    case 'novo_chamado': {
      const nomeLoja = loja?.trim() || '';
      return nomeLoja
        ? `Novo Chamado #${num} - Aberto (${nomeLoja})`
        : `Novo Chamado #${num} - Aberto`;
    }
    case 'anexo':
      return `Novo anexo adicionado no chamado #${num}`;
    case 'aguardando_aprovacao':
      return `Chamado #${num} - Aguardando aprovação do Orçamento`;
    case 'aprovacao':
      return `Chamado #${num} - Orçamento aprovado`;
    case 'recusa_aprovacao':
      return `Orçamento do chamado #${num} - Não Aprovado`;
    case 'assumido':
      return 'Ticket assumido!';
    case 'reabertura':
      return `Chamado #${num} - Reaberto`;
    default:
      return mensagem ? `${p}${mensagem}` : `Chamado #${num}`;
  }
}

/** Push segue as mesmas regras do sino conforme permissões do usuário logado. */
async function carregarPermissoesPushUsuario(idUsuario) {
  const uid = Number(idUsuario);
  if (!Number.isFinite(uid)) return null;
  try {
    const { rows } = await pool.query(
      `SELECT u.ativo,
              EXISTS (
                SELECT 1 FROM usuario_permissoes up
                WHERE up.id_usuario = u.id_usuario AND up.codigo = 'chamados.ver'
              ) AS pode_ver,
              EXISTS (
                SELECT 1 FROM usuario_permissoes up
                WHERE up.id_usuario = u.id_usuario AND up.codigo = 'chamados.assumir'
              ) AS pode_assumir,
              EXISTS (
                SELECT 1 FROM usuario_permissoes up
                WHERE up.id_usuario = u.id_usuario AND up.codigo = 'chamados.abrir'
              ) AS pode_abrir,
              EXISTS (
                SELECT 1 FROM usuario_permissoes up
                WHERE up.id_usuario = u.id_usuario AND up.codigo = 'chamados.aprovar'
              ) AS pode_aprovar
       FROM usuarios u
       WHERE u.id_usuario = $1`,
      [uid],
    );
    const u = rows[0];
    if (!u?.ativo) return null;
    return {
      podeVer: u.pode_ver === true,
      podeAssumir: u.pode_assumir === true,
      podeAbrir: u.pode_abrir === true,
      podeAprovar: u.pode_aprovar === true,
    };
  } catch {
    return null;
  }
}

export async function deveEnviarPushParaUsuario(idUsuario, tipo) {
  const uid = Number(idUsuario);
  if (!Number.isFinite(uid)) return false;

  const perms = await carregarPermissoesPushUsuario(uid);
  if (!perms) return false;
  if (!tipoVisivelPushUsuario(tipo, perms)) return false;

  return (await contarPushUsuario(uid)) > 0;
}

export async function enviarPushNotificacaoChamado(idUsuario, idChamado, tipo, mensagem) {
  const uid = Number(idUsuario);
  const cid = Number(idChamado);
  if (!Number.isFinite(uid) || !Number.isFinite(cid)) return;

  if (!(await deveEnviarPushParaUsuario(uid, tipo))) {
    logger.info('push', 'Envio ignorado — tipo ou usuário fora das regras do perfil', {
      idUsuario: uid,
      idChamado: cid,
      tipo,
    });
    return;
  }

  const perms = await carregarPermissoesPushUsuario(uid);

  if (!pushAtivo) {
    logger.warn('push', 'Envio ignorado — VAPID inativo', { idUsuario: uid, idChamado: cid, tipo });
    return;
  }

  await ensurePushSubscriptionsTable();

  try {
    const { rows: subs } = await pool.query(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions
       WHERE id_usuario = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [uid],
    );

    logger.info('push', 'Preparando envio push', {
      idUsuario: uid,
      idChamado: cid,
      tipo,
      inscricoes: subs.length,
    });

    if (!subs.length) {
      logger.warn('push', 'Usuário sem inscrição push', { idUsuario: uid, idChamado: cid, tipo });
      return;
    }

    const { rows: chamadoRows } = await pool.query(
      `SELECT c.numero, l.name AS loja
       FROM manut_chamados c
       LEFT JOIN lojas l ON l.id_loja = c.id_loja
       WHERE c.id_chamado = $1`,
      [cid],
    ).catch(() => ({ rows: [] }));
    const chamado = chamadoRows[0] || {};
    const title = montarTituloPush({
      tipo,
      mensagem,
      numero: chamado.numero,
      loja: chamado.loja,
    });

    const payload = JSON.stringify({
      title,
      body: mensagem || title,
      idChamado: cid,
      tipo,
      url: perms ? urlPushChamado(cid, tipo, perms) : `/chamados/mobile/${cid}`,
    });

    const invalidEndpoints = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        logger.info('push', 'Alerta enviado (2º plano OK)', {
          idUsuario: uid,
          idChamado: cid,
          tipo,
          endpoint: `${sub.endpoint.slice(0, 48)}…`,
        });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          logger.warn('push', 'Inscrição expirada — removendo', {
            idUsuario: uid,
            status: e.statusCode,
            endpoint: `${sub.endpoint.slice(0, 48)}…`,
          });
          invalidEndpoints.push(sub.endpoint);
        } else {
          logger.error('push', 'Falha ao enviar alerta (2º plano)', {
            idUsuario: uid,
            idChamado: cid,
            tipo,
            status: e.statusCode,
            error: e.message,
            endpoint: `${sub.endpoint.slice(0, 48)}…`,
          });
        }
      }
    }

    if (invalidEndpoints.length) {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE id_usuario = $1 AND endpoint = ANY($2::text[])`,
        [uid, invalidEndpoints],
      );
      logger.info('push', 'Inscrições inválidas removidas', {
        idUsuario: uid,
        removidas: invalidEndpoints.length,
      });
    }
  } catch (e) {
    logger.error('push', 'Erro ao enviar notificação', { error: e.message, idUsuario: uid, idChamado: cid, tipo });
  }
}

export async function contarPushUsuario(idUsuario) {
  await ensurePushSubscriptionsTable();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM push_subscriptions WHERE id_usuario = $1`,
    [idUsuario],
  );
  return rows[0]?.total ?? 0;
}

export async function consultarPushUsuario(idUsuario) {
  return (await contarPushUsuario(idUsuario)) > 0;
}

export async function resetarPushUsuario(idUsuario) {
  await ensurePushSubscriptionsTable();
  const uid = Number(idUsuario);
  if (!Number.isFinite(uid)) return 0;
  const antes = await contarPushUsuario(uid);
  await pool.query(`DELETE FROM push_subscriptions WHERE id_usuario = $1`, [uid]);
  logger.info('push', 'Inscrições push removidas do usuário', { idUsuario: uid, removidas: antes });
  return antes;
}

export async function salvarPushSubscription(idUsuario, subscription, userAgent) {
  await ensurePushSubscriptionsTable();
  const uid = Number(idUsuario);
  if (!Number.isFinite(uid)) {
    throw new Error('Usuário não identificado');
  }
  const keys = subscription?.keys;
  const endpoint = subscription?.endpoint;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Inscrição push inválida');
  }

  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
  await pool.query(`DELETE FROM push_subscriptions WHERE id_usuario = $1`, [uid]);
  await pool.query(
    `INSERT INTO push_subscriptions (id_usuario, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [uid, endpoint, keys.p256dh, keys.auth, userAgent || null],
  );
  logger.info('push', 'Inscrição vinculada ao usuário logado', { idUsuario: uid });
}

export async function removerPushSubscription(idUsuario, endpoint) {
  await ensurePushSubscriptionsTable();
  if (endpoint) {
    await pool.query(
      `DELETE FROM push_subscriptions WHERE id_usuario = $1 AND endpoint = $2`,
      [idUsuario, endpoint],
    );
    return;
  }
  await pool.query(`DELETE FROM push_subscriptions WHERE id_usuario = $1`, [idUsuario]);
}
