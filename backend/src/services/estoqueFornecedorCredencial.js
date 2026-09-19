import { pool } from '../db.js';
import { hidratarCredenciaisDoBanco } from '../config/fornecedoresLojas.js';

export const FORNECEDORES_NF = ['platlog', 'coca', 'idealwork', 'gimba'];
export const JANELA_NF_DIAS = 90;

function bkOf(row) {
  return String(row.bk_number || '').replace(/\D/g, '');
}

export async function recarregarCredenciaisFornecedor() {
  try {
    const { rows } = await pool.query(
      `SELECT c.fornecedor, c.id_loja, c.portal, c.usuario, c.senha,
              l.bk_number
       FROM estoque_fornecedor_credencial c
       LEFT JOIN lojas l ON l.id_loja = c.id_loja`,
    );
    const rede = {};
    const lojas = {};
    for (const row of rows) {
      const item = {
        user: String(row.usuario || '').trim(),
        pass: String(row.senha || '').trim(),
      };
      if (!row.id_loja) {
        rede[row.fornecedor] = rede[row.fornecedor] || {};
        rede[row.fornecedor][row.portal || 'rede'] = item;
        continue;
      }
      const bk = bkOf(row);
      if (!bk) continue;
      lojas[bk] = lojas[bk] || {};
      const user = String(row.usuario || '').trim();
      const cocaEmail = row.fornecedor === 'coca' && /@/.test(user);
      const chave =
        row.fornecedor === 'platlog'
          ? 'platlog_loja'
          : cocaEmail || row.portal === 'cokenet'
            ? 'cokenet'
            : row.fornecedor === 'coca'
              ? 'brasal'
              : row.fornecedor;
      lojas[bk][chave] = item;
    }
    hidratarCredenciaisDoBanco({ rede, lojas });
    return { rede, lojas, total: rows.length };
  } catch (e) {
    console.warn('[fornecedores] credenciais no banco indisponíveis:', e.message);
    hidratarCredenciaisDoBanco({ rede: {}, lojas: {} });
    return { rede: {}, lojas: {}, total: 0 };
  }
}

export async function upsertCredencialFornecedor({
  fornecedor,
  id_loja = null,
  portal = '',
  usuario,
  senha,
}) {
  const forn = String(fornecedor || '').toLowerCase();
  if (!FORNECEDORES_NF.includes(forn)) {
    throw Object.assign(new Error('Fornecedor inválido'), { status: 400 });
  }
  const user = String(usuario || '').trim();
  const pass = String(senha || '').trim();
  if (!user || !pass) {
    throw Object.assign(new Error('Usuário e senha obrigatórios'), { status: 400 });
  }
  const idLoja = id_loja == null || id_loja === '' ? null : Number(id_loja);
  const port = String(portal || '').trim();

  if (idLoja) {
    await pool.query(
      `INSERT INTO estoque_fornecedor_credencial
         (fornecedor, id_loja, portal, usuario, senha, atualizado_em)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (fornecedor, id_loja, portal) WHERE id_loja IS NOT NULL
       DO UPDATE SET usuario = EXCLUDED.usuario, senha = EXCLUDED.senha, atualizado_em = NOW()`,
      [forn, idLoja, port, user, pass],
    );
  } else {
    await pool.query(
      `INSERT INTO estoque_fornecedor_credencial
         (fornecedor, id_loja, portal, usuario, senha, atualizado_em)
       VALUES ($1, NULL, $2, $3, $4, NOW())
       ON CONFLICT (fornecedor, portal) WHERE id_loja IS NULL
       DO UPDATE SET usuario = EXCLUDED.usuario, senha = EXCLUDED.senha, atualizado_em = NOW()`,
      [forn, port, user, pass],
    );
  }
}

/**
 * ON CONFLICT em índice parcial exige o predicado igual. Sem isso, usa upsert manual.
 */
export async function gravarCredencial({
  fornecedor,
  id_loja = null,
  portal = '',
  usuario,
  senha,
}) {
  const forn = String(fornecedor || '').toLowerCase();
  const user = String(usuario || '').trim();
  const pass = String(senha || '').trim();
  const idLoja = id_loja == null || id_loja === '' ? null : Number(id_loja);
  const port = String(portal || '').trim();
  if (!user || !pass) return null;

  const { rows: existing } = await pool.query(
    `SELECT id_credencial FROM estoque_fornecedor_credencial
     WHERE fornecedor = $1
       AND portal = $2
       AND id_loja IS NOT DISTINCT FROM $3
     LIMIT 1`,
    [forn, port, idLoja],
  );
  if (existing[0]) {
    await pool.query(
      `UPDATE estoque_fornecedor_credencial
       SET usuario = $1, senha = $2, atualizado_em = NOW()
       WHERE id_credencial = $3`,
      [user, pass, existing[0].id_credencial],
    );
    return existing[0].id_credencial;
  }
  const { rows } = await pool.query(
    `INSERT INTO estoque_fornecedor_credencial
       (fornecedor, id_loja, portal, usuario, senha, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id_credencial`,
    [forn, idLoja, port, user, pass],
  );
  return rows[0].id_credencial;
}

export function portalDaCredencial(fornecedor, usuario) {
  if (fornecedor === 'cokenet') return 'cokenet';
  if (fornecedor === 'coca') return /@/.test(String(usuario || '')) ? 'cokenet' : 'brasal';
  return '';
}

/**
 * Grava ou atualiza login da loja sem devolver a senha.
 * Senha vazia mantém a atual se o registro já existir.
 */
export async function gravarCredencialLoja({ fornecedor, id_loja, usuario, senha }) {
  const raw = String(fornecedor || '').toLowerCase();
  const isCokeNet = raw === 'cokenet';
  const forn = isCokeNet ? 'coca' : raw;
  if (!FORNECEDORES_NF.includes(forn)) {
    throw Object.assign(new Error('Fornecedor inválido'), { status: 400 });
  }
  const user = String(usuario || '').trim();
  const pass = String(senha || '').trim();
  const idLoja = Number(id_loja);
  if (!idLoja) throw Object.assign(new Error('Loja obrigatória'), { status: 400 });
  if (!user && !pass) return null;

  const portal = isCokeNet ? 'cokenet' : portalDaCredencial(forn, user);
  const { rows: existing } = await pool.query(
    `SELECT id_credencial, usuario, senha FROM estoque_fornecedor_credencial
     WHERE fornecedor = $1
       AND portal = $2
       AND id_loja IS NOT DISTINCT FROM $3
     LIMIT 1`,
    [forn, portal, idLoja],
  );

  if (!existing[0] && (!user || !pass)) {
    throw Object.assign(new Error('Informe usuário e senha para cadastrar o login'), { status: 400 });
  }

  const novoUser = user || existing[0]?.usuario || '';
  const novaSenha = pass || existing[0]?.senha || '';
  if (!novoUser || !novaSenha) {
    throw Object.assign(new Error('Informe usuário e senha'), { status: 400 });
  }

  await gravarCredencial({
    fornecedor: forn,
    id_loja: idLoja,
    portal,
    usuario: novoUser,
    senha: novaSenha,
  });
  await recarregarCredenciaisFornecedor();
  return { usuario: novoUser, tem_senha: true };
}
