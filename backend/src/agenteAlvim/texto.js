import { generateText, llmKeyPresent } from './llm.js';
import { promptSistemaAlvim } from './persona.js';
import { logger } from '../logger.js';

export function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

export function juntarNomesPt(nomes) {
  const limpos = nomes.map((n) => String(n || '').trim()).filter(Boolean);
  if (!limpos.length) return '';
  if (limpos.length === 1) return limpos[0];
  if (limpos.length === 2) return `${limpos[0]} e ${limpos[1]}`;
  return `${limpos.slice(0, -1).join(', ')} e ${limpos[limpos.length - 1]}`;
}

export function nomeLojaCurto(nome) {
  let s = String(nome || '').trim();
  s = s.replace(/^(BURGER KING|BK)\s*[-–:]?\s*/i, '');
  const curto = tituloCurto(s) || s;
  return curto ? `BK ${curto}` : curto;
}

const ACENTOS = {
  pao: 'pão',
  lactea: 'láctea',
  pre: 'pré',
};

export function tituloCurto(valor) {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com']);
  return String(valor || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw, i) => {
      const w = raw.toLowerCase().replace(/[.]/g, '');
      const fix = ACENTOS[w] || w;
      if (i > 0 && small.has(fix)) return fix;
      return fix.charAt(0).toUpperCase() + fix.slice(1);
    })
    .join(' ');
}

export function nomeItemCurto(descricao) {
  let s = String(descricao || '').trim();
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\b(clean label|clean bk|uht|dis|novo[- ]?esupri)\b/gi, ' ');
  s = s.replace(/\bBK\b/gi, ' ');
  s = s.replace(/\bcx\s*(com\s*)?[\d.,]+\s*(und|un|kg|l)?\b/gi, ' ');
  s = s.replace(/\b[\d.,]+\s*(und|un|kg|l|mm)\b/gi, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return tituloCurto(s) || String(descricao || '').trim();
}

export function fmtQtdZap(qtd, unid = 'UND') {
  const n = Number(qtd);
  const u = String(unid || 'UND').trim() || 'UND';
  if (!Number.isFinite(n)) return `${qtd} ${u}`;
  const abs = Math.abs(n);
  if (abs < 0.05) return `0 ${u}`;
  if (u.toUpperCase() === 'UND' || Number.isInteger(n) || abs >= 10) {
    return `${Math.round(n)} ${u}`;
  }
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ` ${u}`;
}

function itensDaLoja(loja) {
  return (loja.itens || [])
    .map((item) => nomeItemCurto(item.descricao || item.item))
    .map((s) => String(s || '').trim())
    .filter(Boolean);
}

export function fatosParaRedacao(fatos) {
  const clone = JSON.parse(JSON.stringify(fatos || {}));
  delete clone.snapshot;
  if (clone.orientacao === 'ainda_nao_me_avisa' || clone.orientacao === 'comemorou') {
    delete clone.recado_anterior;
    clone.nao_repetir = true;
  }
  if (clone.regional) clone.regional = primeiroNome(clone.regional);
  if (Array.isArray(clone.lojas)) {
    clone.lojas = clone.lojas.map((l) => {
      const loja = nomeLojaCurto(l.loja || l.name);
      const itens = itensDaLoja(l);
      if (itens.length) return { loja, itens_zerados: itens };
      return { loja };
    });
  }
  return clone;
}

export function bolhasEstoqueZero({ nomeRegional, lojas }) {
  const quem = primeiroNome(nomeRegional) || 'time';
  const linhas = (lojas || []).map((loja) => {
    const nome = nomeLojaCurto(loja.loja || loja.name || 'loja');
    const itens = itensDaLoja(loja);
    return itens.length ? `${nome} — ${itens.join(', ')}` : nome;
  });
  return [
    `${quem}, passando pra avisar: tem item zerado na loja`,
    linhas.join('\n'),
    'ainda tão zerados hoje',
  ];
}

export function bolhasContagemFaltou({ nomeRegional, nomeRegiao, lojas }) {
  const quem = primeiroNome(nomeRegional) || nomeRegiao || 'time';
  const linhas = (lojas || []).map((l) => nomeLojaCurto(l.loja || l.name));
  return [
    `${quem}, passando pra avisar quem ainda não contou o estoque`,
    linhas.join('\n'),
    'ainda não tiveram estoque contado hoje',
  ];
}

export function bolhasEscalaSemana({ semanaInicio, semanaFim, grupos }) {
  const linhas = (grupos || []).map((g) => {
    const nomes = juntarNomesPt((g.tecnicos || []).map((t) => primeiroNome(t)));
    const regional = g.nome_regional ? primeiroNome(g.nome_regional) : '';
    const titulo = regional ? `${g.nome_regiao} (${regional})` : g.nome_regiao;
    return `${titulo}: ${nomes || 'sem técnico na grade'}`;
  });
  return [
    `Passando a escala da semana ${fmtBr(semanaInicio)} a ${fmtBr(semanaFim)}`,
    linhas.join('\n'),
  ];
}

export function templateEstoqueZero(opts) {
  return bolhasEstoqueZero(opts).join('\n\n');
}

export function templateContagemFaltou(opts) {
  return bolhasContagemFaltou(opts).join('\n\n');
}

export function templateEscalaSemana(opts) {
  return bolhasEscalaSemana(opts).join('\n\n');
}

function fmtBr(iso) {
  const [y, m, d] = String(iso || '').split('-');
  if (!d) return iso || '';
  return `${d}/${m}/${y}`;
}

export function parseMsgsJson(ai, { min = 1, max = 6 } = {}) {
  const r = parseRespostaAgente(ai, { min, max });
  return r.msgs;
}

export function parseRespostaAgente(ai, { min = 1, max = 6 } = {}) {
  if (!ai) return { agir: false, msgs: [] };
  try {
    const jsonMatch = String(ai).match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : ai);
    if (parsed?.agir === false) return { agir: false, msgs: [] };
    const msgs = (Array.isArray(parsed?.msgs) ? parsed.msgs : [])
      .map((m) => String(m || '').replace(/\n*—\s*Agente Alvim\s*$/i, '').trim())
      .filter(Boolean)
      .slice(0, max);
    if (msgs.length >= min || (parsed?.agir === true && msgs.length)) {
      return { agir: true, msgs, pedido: parsed?.pedido_monitoramento || null };
    }
  } catch {
    /* cai no fallback */
  }
  return { agir: false, msgs: [] };
}

function promptMissao(fatos) {
  const tipo = String(fatos?.tipo || fatos?.missao || '');
  if (tipo === 'estoque_zero' || fatos?.missao === 'avisar_item_zerado_na_loja') {
    return [
      'missao=avisar_item_zerado_na_loja',
      'Os nomes de loja e item JÁ vieram limpos. Loja com BK (BK Samambaia). Sem CAIXA ALTA, sem cx/und/kg.',
      'Bolha 1: chama o regional pelo nome e avisa que tem item zerado.',
      'Bolhas seguintes: uma loja por bolha, estilo “BK Ponte Alta — pão Supremo”.',
      'Se fizer sentido, fecha pedindo pra conferir a reposição — como quem trabalha junto, não como alerta.',
    ].join('\n');
  }
  if (tipo === 'contagem_faltou' || fatos?.missao === 'avisar_contagem_faltou') {
    return [
      'missao=avisar_contagem_faltou',
      'Chama o regional. Lista as lojas pelo nome curto. Pode citar prazo se veio nos fatos.',
      'Tom de quem cobra com o time, não de boletim.',
    ].join('\n');
  }
  if (tipo === 'responder_whatsapp' || fatos?.missao === 'responder_whatsapp') {
    return [
      'missao=responder_whatsapp',
      'Continua a conversa. consulta[] é o que o banco acabou de devolver. Use só isso.',
      'Se nada_mudou=true ou orientacao=silencio: {"agir":false,"msgs":[]}.',
      'Se orientacao=ainda_nao_me_avisa: 1 bolha. Você acabou de consultar. Ainda não está feito. Diz isso no seu tom e pede pra te avisarem quando fizerem. Invente o texto. Proibido copiar recado_anterior. Proibido frase pronta.',
      'Se orientacao=comemorou ou consulta.contagem=contou: comemora curto.',
      'Pergunta de estoque: responde com consulta.itens_zerados. Sem inventar item.',
      'Bom dia solto: agir=false.',
    ].join('\n');
  }
  return 'Escreve o recado em bolhas de WhatsApp.';
}

export async function redigirBolhasComLlm(config, fatos, fallbackBolhas) {
  const limpos = fatosParaRedacao(fatos);
  const raw = await generateText({
    system: promptSistemaAlvim(config),
    prompt: [promptMissao(fatos), '', 'Fatos (use só isso):', JSON.stringify(limpos, null, 2)].join('\n'),
    maxTokens: 900,
    temperature: 1.05,
    json: true,
    model: config?.ai_model,
  });
  const min = fatos?.tipo === 'responder_whatsapp' || fatos?.missao === 'responder_whatsapp' ? 1 : 2;
  const parsed = parseRespostaAgente(raw, { min: fatos?.silencio_ok ? 0 : min, max: 6 });
  if (fatos?.silencio_ok && parsed.agir === false) return [];
  if (parsed.msgs.length) return parsed.msgs;

  const soltas = String(raw || '')
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (soltas.length >= min && !soltas[0].startsWith('{')) return soltas;

  const fb = (Array.isArray(fallbackBolhas) ? fallbackBolhas : [fallbackBolhas])
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  if (fb.length) {
    logger.warn('agente-alvim', 'LLM não devolveu bolhas — uso o recado da ferramenta', {
      trecho: String(raw || '').slice(0, 160),
    });
    return fb;
  }
  if (llmKeyPresent() || String(process.env.AI_ENABLED || '').toLowerCase() === 'true') {
    throw new Error('LLM não redigiu o recado. Confira GEMINI_API_KEY, AI_PROVIDER e AI_MODEL.');
  }
  return fb;
}

export async function redigirComLlm(config, fatos, fallback) {
  const bolhas = await redigirBolhasComLlm(
    config,
    fatos,
    String(fallback || '')
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return bolhas.join('\n\n');
}
