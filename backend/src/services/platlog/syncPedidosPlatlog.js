/**
 * Espelho dos pedidos do eSupri em estoque_pedido_platlog (+ itens).
 * Só leitura no portal. Login da loja; sem login da loja cai no login da rede (também só leitura).
 */
import { pool } from '../../db.js';
import { lerPedidosEsupri } from './esupriPedidos.js';
import {
  credencialLoja,
  credencialPlatlog,
  findEsupriLojaByBk,
  findEsupriLojaByFantasia,
} from '../../config/fornecedoresLojas.js';
import { recarregarCredenciaisFornecedor } from '../estoqueFornecedorCredencial.js';

const STATUS_FINAIS = /entregue|cancelad/i;

async function pedidosConhecidos(idsLoja) {
  const { rows } = await pool.query(
    `SELECT id_loja, codigo, status, portal_atualizado_em, itens_lidos_em
     FROM estoque_pedido_platlog WHERE id_loja = ANY($1::int[])`,
    [idsLoja],
  );
  const m = new Map();
  for (const r of rows) m.set(`${r.id_loja}|${r.codigo}`, r);
  return m;
}

function tsPortal(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

async function gravarPedido(idLoja, p) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO estoque_pedido_platlog (
         id_loja, codigo, data_pedido, hora_pedido, valor_total, qtd_itens, peso_bruto,
         data_entrega, status, flag_status, observacao, portal_inserido_em, portal_atualizado_em,
         itens_lidos_em, sincronizado_em
       ) VALUES ($1,$2,$3::date,$4,$5,$6,$7,$8::date,$9,$10,$11,$12::timestamp,$13::timestamp,
         CASE WHEN $14 THEN NOW() ELSE NULL END, NOW())
       ON CONFLICT (id_loja, codigo) DO UPDATE SET
         data_pedido = EXCLUDED.data_pedido,
         hora_pedido = EXCLUDED.hora_pedido,
         valor_total = EXCLUDED.valor_total,
         qtd_itens = EXCLUDED.qtd_itens,
         peso_bruto = EXCLUDED.peso_bruto,
         data_entrega = COALESCE(EXCLUDED.data_entrega, estoque_pedido_platlog.data_entrega),
         status = EXCLUDED.status,
         flag_status = EXCLUDED.flag_status,
         observacao = EXCLUDED.observacao,
         portal_inserido_em = EXCLUDED.portal_inserido_em,
         portal_atualizado_em = EXCLUDED.portal_atualizado_em,
         itens_lidos_em = CASE WHEN $14 THEN NOW() ELSE estoque_pedido_platlog.itens_lidos_em END,
         sincronizado_em = NOW()
       RETURNING id_pedido`,
      [
        idLoja,
        p.codigo,
        p.data_pedido,
        p.hora_pedido,
        p.valor_total,
        p.qtd_itens,
        p.peso_bruto,
        p.data_entrega,
        p.status,
        p.flag_status,
        p.observacao,
        p.portal_inserido_em,
        p.portal_atualizado_em,
        Array.isArray(p.itens),
      ],
    );
    const idPedido = rows[0].id_pedido;
    if (Array.isArray(p.itens)) {
      await client.query(`DELETE FROM estoque_pedido_platlog_itens WHERE id_pedido = $1`, [idPedido]);
      for (const it of p.itens) {
        await client.query(
          `INSERT INTO estoque_pedido_platlog_itens
             (id_pedido, codigo, descricao, quantidade, unidade, valor_unitario, valor_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [idPedido, it.codigo, it.descricao, it.quantidade, it.unidade, it.valor_unitario, it.valor_total],
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * @param {object} [o]
 * @param {number|null} [o.idLoja] — null = todas as lojas com eSupri
 * @param {number} [o.dias]
 * @param {boolean} [o.forcarItens] — relê o recibo de todos os pedidos da janela
 */
export async function sincronizarPedidosPlatlog({ idLoja = null, dias = 60, forcarItens = false, onLog = () => {} } = {}) {
  await recarregarCredenciaisFornecedor();
  const { rows: lojas } = await pool.query(
    `SELECT id_loja, name, bk_number FROM lojas
     WHERE bk_number IS NOT NULL ${idLoja ? 'AND id_loja = $1' : ''}`,
    idLoja ? [Number(idLoja)] : [],
  );

  const porBk = new Map();
  const sessoesLoja = [];
  const viaRede = [];
  for (const l of lojas) {
    const esupri = findEsupriLojaByBk(l.bk_number);
    if (!esupri) continue;
    const bk = String(esupri.bk_number);
    porBk.set(bk, l);
    const cred = credencialLoja(bk, 'platlog_loja');
    if (cred.user && cred.pass) sessoesLoja.push({ loja: l, cred });
    else viaRede.push(l);
  }
  if (!porBk.size) {
    throw Object.assign(new Error('Loja sem cadastro no eSupri'), { status: 404 });
  }

  const sessoes = sessoesLoja.map((s) => ({ cred: s.cred, lojas: [s.loja], rotulo: s.loja.name }));
  if (viaRede.length) {
    const rede = credencialPlatlog(viaRede[0].bk_number);
    if (rede.user && rede.pass) sessoes.push({ cred: rede, lojas: viaRede, rotulo: 'login da rede' });
  }

  const conhecidos = await pedidosConhecidos([...porBk.values()].map((l) => l.id_loja));
  const resumo = { lojas: 0, pedidos: 0, novos: 0, itens_lidos: 0, erros: [] };

  for (const s of sessoes) {
    const idsSessao = new Set(s.lojas.map((l) => l.id_loja));
    const lojaDoPedido = (p) => {
      if (s.lojas.length === 1) return s.lojas[0];
      const e = findEsupriLojaByFantasia(p.fantasia);
      const l = e ? porBk.get(String(e.bk_number)) : null;
      return l && idsSessao.has(l.id_loja) ? l : null;
    };
    try {
      const pedidos = await lerPedidosEsupri({
        user: s.cred.user,
        pass: s.cred.pass,
        dias,
        onLog: (m) => onLog(`[${s.rotulo}] ${m}`),
        precisaItens: (p) => {
          const l = lojaDoPedido(p);
          if (!l) return false;
          if (forcarItens) return true;
          const ant = conhecidos.get(`${l.id_loja}|${p.codigo}`);
          if (!ant || !ant.itens_lidos_em) return true;
          if (tsPortal(ant.portal_atualizado_em) !== tsPortal(p.portal_atualizado_em)) return true;
          return !STATUS_FINAIS.test(String(p.status || ''));
        },
      });
      const lojasVistas = new Set();
      for (const p of pedidos) {
        const l = lojaDoPedido(p);
        if (!l) continue;
        lojasVistas.add(l.id_loja);
        if (!conhecidos.has(`${l.id_loja}|${p.codigo}`)) resumo.novos += 1;
        if (Array.isArray(p.itens)) resumo.itens_lidos += 1;
        await gravarPedido(l.id_loja, p);
        resumo.pedidos += 1;
      }
      resumo.lojas += s.lojas.length;
    } catch (e) {
      onLog(`[${s.rotulo}] erro: ${e.message}`);
      resumo.erros.push({ sessao: s.rotulo, erro: e.message });
    }
  }
  return resumo;
}
