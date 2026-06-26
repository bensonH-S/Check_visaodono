import { pool } from '../db.js';
import { mensagemPorEvento } from '../textosNotificacaoChamado.js';
import { coletarDestinatariosPorEvento } from './destinatariosNotificacao.js';

const STATUS_ABERTOS = ['aberto', 'em_atendimento', 'em_aprovacao', 'aprovado'];
const INTERVALO_MS = 5 * 60 * 1000;

let timer = null;

async function eventoAtivo(codigo) {
  try {
    const { rows } = await pool.query(
      `SELECT ativo FROM manut_notificacao_eventos WHERE codigo = $1`,
      [codigo],
    );
    return rows[0]?.ativo !== false;
  } catch {
    return true;
  }
}

async function dispararNotificacaoSla(idChamado, codigo, mensagem, idAutorExcluir = null) {
  const { criarNotificacao } = await import('../routes/manutencao.js');
  const destinatarios = await coletarDestinatariosPorEvento(idChamado, codigo);
  if (idAutorExcluir != null) destinatarios.delete(Number(idAutorExcluir));

  let enviadas = 0;
  for (const idUsuario of destinatarios) {
    if (!Number.isFinite(idUsuario)) continue;
    const ok = await criarNotificacao({
      idUsuario,
      idChamado,
      tipo: codigo,
      mensagem,
      enviarPush: true,
    });
    if (ok) enviadas += 1;
  }
  return enviadas;
}

export async function processarAlertasSla() {
  try {
    const { rows } = await pool.query(
      `SELECT c.id_chamado, c.numero, c.aberto_em, c.prazo_sla,
              c.sla_notif_80_em, c.sla_notif_estourado_em,
              l.name AS nome_loja
       FROM manut_chamados c
       JOIN lojas l ON l.id_loja = c.id_loja
       WHERE c.status = ANY($1::manut_status_chamado[])
         AND c.fechado_em IS NULL
         AND (c.sla_notif_80_em IS NULL OR c.sla_notif_estourado_em IS NULL)`,
      [STATUS_ABERTOS],
    );

    const agora = Date.now();

    for (const c of rows) {
      const inicio = new Date(c.aberto_em).getTime();
      const fim = new Date(c.prazo_sla).getTime();
      const total = fim - inicio;
      if (!Number.isFinite(inicio) || !Number.isFinite(fim) || total <= 0) continue;

      const decorrido = agora - inicio;
      const pct = decorrido / total;
      const vars = { numero: c.numero, loja: c.nome_loja || 'Loja' };

      if (!c.sla_notif_80_em && pct >= 0.8 && agora < fim && (await eventoAtivo('sla_alerta_80'))) {
        const msg = await mensagemPorEvento('sla_alerta_80', vars);
        await dispararNotificacaoSla(c.id_chamado, 'sla_alerta_80', msg);
        await pool.query(
          `UPDATE manut_chamados SET sla_notif_80_em = NOW() WHERE id_chamado = $1`,
          [c.id_chamado],
        );
      }

      if (!c.sla_notif_estourado_em && agora >= fim && (await eventoAtivo('sla_estourado'))) {
        const msg = await mensagemPorEvento('sla_estourado', vars);
        await dispararNotificacaoSla(c.id_chamado, 'sla_estourado', msg);
        await pool.query(
          `UPDATE manut_chamados SET sla_notif_estourado_em = NOW() WHERE id_chamado = $1`,
          [c.id_chamado],
        );
      }
    }
  } catch (e) {
    console.error('[sla-notificacoes]', e.message);
  }
}

export function iniciarMonitorSlaNotificacoes() {
  if (timer) return;
  void processarAlertasSla();
  timer = setInterval(() => void processarAlertasSla(), INTERVALO_MS);
}
