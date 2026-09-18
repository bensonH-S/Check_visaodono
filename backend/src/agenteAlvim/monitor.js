import { logger } from '../logger.js';
import { wppEnabled } from '../services/wppClient.js';
import { dataHojeSp, dentroJanela, jaPassouHora, weekdaySp } from './horario.js';
import { carregarConfigAlvim } from './persona.js';
import { aiEnabled, aiModel, aiProvider, MODELOS_OPENAI } from './llm.js';
import { executarEstoqueZero } from './tools/estoqueZero.js';
import { executarContagemFaltou } from './tools/contagemFaltou.js';
import { executarEscalaSemana } from './tools/escalaSemana.js';
import { executarMesaFinanceiro } from './tools/conferirPagamentos.js';

const INTERVALO_MS = 5 * 60 * 1000;
const FERRAMENTAS = new Set(['estoque', 'contagem', 'escala', 'financeiro']);

let timer = null;
let ultimoCiclo = null;

function envAlvimLigado() {
  const raw = process.env.AGENTE_ALVIM_ENABLED;
  if (raw == null || raw === '') return true;
  return String(raw).toLowerCase() === 'true';
}

export async function obterStatusAgenteAlvim() {
  const config = await carregarConfigAlvim();
  return {
    nome: config.nome,
    ativo: config.ativo && envAlvimLigado(),
    env_enabled: envAlvimLigado(),
    wpp: wppEnabled(),
    mesa_operacao: config.mesa_operacao,
    mesa_financeiro: config.mesa_financeiro,
    grupo_whatsapp: config.grupo_whatsapp,
    horario_inicio: config.horario_inicio,
    horario_fim: config.horario_fim,
    hora_estoque: config.hora_estoque,
    hora_contagem: config.hora_contagem,
    hora_escala: config.hora_escala,
    dias_ativos: config.dias_ativos,
    tom: config.tom,
    ai_model: config.ai_model || aiModel(),
    ai_model_salvo: config.ai_model,
    ai_provider: aiProvider(),
    ai_enabled: aiEnabled(),
    ai_modelos: MODELOS_OPENAI,
    grupos: config.grupos || { lideranca: null, gestores: null, regioes: [] },
    hoje_sp: dataHojeSp(),
    ultimo_ciclo: ultimoCiclo,
  };
}

export async function processarCicloAgenteAlvim({
  forcar = false,
  ferramenta = null,
  destinoOverride = null,
  dryRun = false,
} = {}) {
  const config = await carregarConfigAlvim();
  const agora = new Date();
  const resumo = {
    ok: true,
    agora: agora.toISOString(),
    hoje_sp: dataHojeSp(agora),
    resultados: [],
  };

  if (!envAlvimLigado() && !forcar) {
    resumo.ok = false;
    resumo.motivo = 'env_desligado';
    ultimoCiclo = resumo;
    return resumo;
  }
  if (!config.ativo && !forcar) {
    resumo.ok = false;
    resumo.motivo = 'agente_desligado';
    ultimoCiclo = resumo;
    return resumo;
  }
  if (!forcar && !dentroJanela(config, agora)) {
    resumo.ok = false;
    resumo.motivo = 'fora_janela';
    ultimoCiclo = resumo;
    return resumo;
  }

  const so = ferramenta ? String(ferramenta).toLowerCase() : null;
  const rodar = (nome) => !so || so === nome;

  try {
    if (config.mesa_operacao) {
      if (rodar('estoque') && (forcar || jaPassouHora(config.hora_estoque, agora))) {
        resumo.resultados.push(await executarEstoqueZero(config, { dryRun, destinoOverride }));
      }
      if (rodar('contagem') && (forcar || jaPassouHora(config.hora_contagem, agora))) {
        resumo.resultados.push(await executarContagemFaltou(config, { dryRun, destinoOverride }));
      }
      if (rodar('escala') && (forcar || (weekdaySp(agora) === 1 && jaPassouHora(config.hora_escala, agora)))) {
        resumo.resultados.push(await executarEscalaSemana(config, { dryRun, destinoOverride }));
      }
    } else if (so && ['estoque', 'contagem', 'escala'].includes(so)) {
      resumo.resultados.push({ ferramenta: so, enviados: 0, motivo: 'mesa_operacao_desligada' });
    }

    if (rodar('financeiro') && (config.mesa_financeiro || so === 'financeiro')) {
      resumo.resultados.push(await executarMesaFinanceiro(config));
    }
  } catch (e) {
    logger.exception('agente-alvim', e);
    resumo.ok = false;
    resumo.motivo = e.message;
  }

  ultimoCiclo = resumo;
  const enviados = resumo.resultados.reduce((n, r) => n + (Number(r.enviados) || 0), 0);
  if (enviados > 0) {
    logger.info('agente-alvim', `Ciclo enviou ${enviados} recado(s)`, { resultados: resumo.resultados });
  }
  return resumo;
}

export async function executarTesteAgenteAlvim({ ferramenta = 'estoque', telefone = null } = {}) {
  const dest = telefone ? String(telefone).trim() : null;
  const nome = FERRAMENTAS.has(String(ferramenta || '').toLowerCase())
    ? String(ferramenta).toLowerCase()
    : 'estoque';
  return processarCicloAgenteAlvim({
    forcar: true,
    ferramenta: nome,
    destinoOverride: dest,
  });
}

export function iniciarMonitorAgenteAlvim() {
  void import('./ouvido.js').then((m) => m.iniciarOuvidoAlvim()).catch((e) => {
    logger.warn('agente-alvim', 'Ouvido não iniciou', { error: e.message });
  });
  void import('./grupos.js').then(async (m) => {
    try {
      const r = await m.sincronizarGruposAlvim();
      if (r.ok) {
        logger.info('agente-alvim', 'Grupos do Zap sincronizados', {
          lideranca: Boolean(r.grupos?.lideranca?.id),
          gestores: Boolean(r.grupos?.gestores?.id),
          regioes: r.grupos?.regioes?.length || 0,
        });
      }
    } catch (e) {
      logger.warn('agente-alvim', 'Não deu para listar grupos agora', { error: e.message });
    }
  });
  if (timer) return;
  if (!envAlvimLigado()) {
    logger.info('agente-alvim', 'Disparo automático desligado (AGENTE_ALVIM_ENABLED=false). Ouvido continua.');
    return;
  }
  logger.info('agente-alvim', 'Monitor iniciado (intervalo 5 min, horário SP)');
  void processarCicloAgenteAlvim();
  timer = setInterval(() => void processarCicloAgenteAlvim(), INTERVALO_MS);
}
