import { logger } from '../logger.js';
import { carregarConfigAlvim } from './persona.js';
import { snapshotOperacao } from './operacao.js';
import { nomeLojaCurto } from './texto.js';
import { colherResolvidasNoSistema } from './pendencia.js';
import { enviarRecadoAlvim } from './recado.js';

const HOMOLOG = '5561991094654';
const INTERVALO_MS = 25000;

let timer = null;
let rodando = false;

export function iniciarAcompanhamentoAlvim() {
  if (timer) return;
  logger.info('agente-alvim', 'Acompanhamento ligado — confere pendência no banco a cada 25s');
  timer = setInterval(() => void varrerResolvidas(), INTERVALO_MS);
  void varrerResolvidas();
}

async function varrerResolvidas() {
  if (rodando) return;
  rodando = true;
  try {
    const snapshot = await snapshotOperacao();
    const resolvidas = await colherResolvidasNoSistema(snapshot);
    if (!resolvidas.length) return;

    const config = await carregarConfigAlvim();
    const r = await enviarRecadoAlvim({
      config,
      destinos: [HOMOLOG],
      fatos: {
        tipo: 'responder_whatsapp',
        missao: 'responder_whatsapp',
        silencio_ok: true,
        orientacao: 'comemorou',
        todas_resolvidas: true,
        nome_pessoa: 'Henrique',
        consulta: {
          hoje: snapshot.hoje,
          lojas: resolvidas.map((p) => ({
            loja: nomeLojaCurto(p.loja),
            status: 'finalizada',
          })),
        },
      },
      fallbackBolhas: [],
    });
    logger.info('agente-alvim', 'Acompanhamento fechou pendência', {
      lojas: resolvidas.map((p) => p.loja),
      msgs: r.bolhas?.length || 0,
      silencioso: r.silencioso === true,
    });
  } catch (e) {
    logger.warn('agente-alvim', 'Acompanhamento falhou', { error: e.message });
  } finally {
    rodando = false;
  }
}
