import { pool } from '../db.js';
import { temPermissao } from '../permissoes.js';

export async function criarPortalNotificacao({
  idUsuario,
  tipo,
  titulo,
  mensagem = '',
  link = null,
  refTipo = null,
  refId = null,
}) {
  const uid = Number(idUsuario);
  if (!Number.isFinite(uid)) return null;
  const { rows } = await pool.query(
    `INSERT INTO portal_notificacoes
       (id_usuario, tipo, titulo, mensagem, link, ref_tipo, ref_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id_notificacao, id_usuario, tipo, titulo, mensagem, link, ref_tipo, ref_id, lida, created_at`,
    [
      uid,
      String(tipo || 'geral').slice(0, 40),
      String(titulo || '').trim().slice(0, 300) || 'Notificação',
      String(mensagem || ''),
      link,
      refTipo,
      refId != null ? String(refId) : null,
    ],
  );
  const n = mapNotif(rows[0]);
  try {
    const { enviarPushApp } = await import('../pushNotifications.js');
    await enviarPushApp(uid, {
      title: n.titulo,
      body: n.mensagem || n.titulo,
      url: n.link || '/auditoria/configuracoes/tickets',
    }).catch(() => {});
  } catch {
    /* push opcional */
  }
  return n;
}

function mapNotif(r) {
  if (!r) return null;
  return {
    id_notificacao: Number(r.id_notificacao),
    id_usuario: Number(r.id_usuario),
    tipo: r.tipo,
    titulo: r.titulo,
    mensagem: r.mensagem || '',
    resumo: r.resumo || null,
    link: r.link || null,
    ref_tipo: r.ref_tipo || null,
    ref_id: r.ref_id || null,
    lida: Boolean(r.lida),
    created_at: r.created_at,
    origem: r.origem || 'portal',
  };
}

async function listarPortalDb(idUsuario, { limite = 40 } = {}) {
  const { rows } = await pool.query(
    `SELECT id_notificacao, id_usuario, tipo, titulo, mensagem, link, ref_tipo, ref_id, lida, created_at,
            'portal'::text AS origem
     FROM portal_notificacoes
     WHERE id_usuario = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [idUsuario, limite],
  );
  return rows.map(mapNotif);
}

/** Pagamentos próximos (agenda) como alertas sintéticos para quem tem financeiro.ver. */
async function listarPagamentosProximos(user) {
  if (!temPermissao(user, 'financeiro.ver') && !temPermissao(user, 'lojas.todas')) {
    return [];
  }
  try {
    const { rows } = await pool.query(
      `SELECT d.id::text AS id,
              d.descricao,
              d.valor,
              to_char(d.vencimento, 'YYYY-MM-DD') AS vencimento,
              COALESCE(NULLIF(btrim(e.apelido), ''), e.razao_social, 'Empresa') AS empresa
       FROM finance.despesas d
       LEFT JOIN finance.empresas e ON e.id = d.empresa_origem_id
       WHERE d.status NOT IN ('paga', 'conciliada', 'cancelada')
         AND d.vencimento IS NOT NULL
         AND d.vencimento::date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '2 days')
       ORDER BY d.vencimento ASC, d.valor DESC NULLS LAST
       LIMIT 8`,
    );
    const hoje = new Date();
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    return rows.map((r) => {
      const venc = r.vencimento;
      const urgente = venc <= hojeIso;
      const valor = r.valor != null ? Number(r.valor) : null;
      const valorTxt =
        valor != null
          ? valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
          : '';
      const desc = String(r.descricao || '').trim();
      const descCurta = desc.length > 42 ? `${desc.slice(0, 40)}…` : desc;
      const vencFmt = venc
        ? (() => {
            const [y, m, d] = String(venc).slice(0, 10).split('-');
            return d && m ? `${d}/${m}` : venc;
          })()
        : '';
      const quando = urgente ? 'Hoje' : vencFmt ? `Vence ${vencFmt}` : 'Próximo';
      return {
        id_notificacao: `pag-${r.id}`,
        id_usuario: Number(user.sub),
        tipo: urgente ? 'pagamento_hoje' : 'pagamento_proximo',
        titulo: String(r.empresa || 'Pagamento').trim(),
        mensagem: [descCurta, valorTxt].filter(Boolean).join(' · '),
        resumo: quando,
        link: '/financeiro',
        ref_tipo: 'despesa',
        ref_id: r.id,
        lida: false,
        created_at: new Date().toISOString(),
        origem: 'pagamento',
      };
    });
  } catch (e) {
    console.error('[portalNotificacoes] pagamentos:', e.message);
    return [];
  }
}

export async function listarNotificacoesPortal(user) {
  const uid = user.sub;
  const [portal, pagamentos] = await Promise.all([
    listarPortalDb(uid),
    listarPagamentosProximos(user),
  ]);
  const lista = [...portal, ...pagamentos].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const naoLidas = lista.filter((n) => !n.lida).length;
  return { items: lista.slice(0, 50), nao_lidas: naoLidas };
}

export async function marcarLida(idUsuario, idNotificacao) {
  const id = Number(idNotificacao);
  if (!Number.isFinite(id)) return false;
  const { rowCount } = await pool.query(
    `UPDATE portal_notificacoes SET lida = TRUE
     WHERE id_usuario = $1 AND id_notificacao = $2`,
    [idUsuario, id],
  );
  return rowCount > 0;
}

export async function marcarTodasLidas(idUsuario) {
  await pool.query(
    `UPDATE portal_notificacoes SET lida = TRUE
     WHERE id_usuario = $1 AND lida = FALSE`,
    [idUsuario],
  );
  return true;
}
