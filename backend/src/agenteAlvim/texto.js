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
  moida: 'moída',
  moída: 'moída',
};

export function tituloCurto(valor) {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'a']);
  return String(valor || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw, i) => {
      const w = raw.toLowerCase().replace(/[.]/g, '');
      const fix = ACENTOS[w] || w;
      if (i > 0 && small.has(fix)) return fix;
      if (fix === 'hb') return 'HB';
      return fix.charAt(0).toUpperCase() + fix.slice(1);
    })
    .join(' ');
}

export function nomeItemCurto(descricao) {
  let s = String(descricao || '').trim();
  s = s.replace(/\([^)]*\)/g, ' ');
  s = s.replace(/\b(clean label|clean bk|uht|dis|novo[- ]?esupri|mccain|dan vigor|vigor)\b/gi, ' ');
  s = s.replace(/\bcx\s*(com\s*)?[\d.,]+\s*(und|un|kg|l)?\b/gi, ' ');
  s = s.replace(/\b\d+[.,]?\d*\s*x\s*\d+[.,]?\d*\b/gi, ' ');
  s = s.replace(/\b[\d.,]+\s*(kg|g|ml|l|unb|und|un|mm)\b/gi, ' ');
  s = s.replace(/\bcx\d+x\d+\s*un\b/gi, ' ');
  s = s.replace(/\b(congelad[oa]s?|cong|cxg|bkc)\b/gi, ' ');
  s = s.replace(/\b(clean|cx|cl|nv|bk|unb|und|unid|kg)\b/gi, ' ');
  s = s.replace(/\s+x\s*$/i, '');
  s = s.replace(/\s+\b(de|da|do|das|dos|e|com|a)\s*$/i, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return tituloCurto(s) || String(descricao || '').trim();
}

function mesmoNomeItem(a, b) {
  const aa = String(a || '').toLowerCase();
  const bb = String(b || '').toLowerCase();
  if (!aa || !bb) return false;
  if (aa === bb) return true;
  return aa.startsWith(`${bb} `) || bb.startsWith(`${aa} `);
}

export function nomesItensUnicos(lista) {
  const limpos = (lista || []).map((n) => String(n || '').trim()).filter(Boolean);
  const saida = [];
  for (const nome of limpos) {
    const i = saida.findIndex((u) => mesmoNomeItem(u, nome));
    if (i < 0) {
      saida.push(nome);
      continue;
    }
    const [curto, longo] = nome.length < saida[i].length ? [nome, saida[i]] : [saida[i], nome];
    const extra = longo.slice(curto.length).trim();
    saida[i] = /^(x|jr|n[°o]?)$/i.test(extra) ? curto : longo;
  }
  return saida;
}

const LIMITE_ITENS_ZAP = 20;

export function resumoSemSaldo(lista) {
  const itens = nomesItensUnicos(lista);
  return { qtd: itens.length, itens: itens.slice(0, LIMITE_ITENS_ZAP) };
}

export function fmtQtdZap(qtd, unid = 'UND') {
  const n = Number(qtd);
  const u = String(unid || 'UND').trim() || 'UND';
  if (!Number.isFinite(n)) return `${qtd} ${u}`;
  const abs = Math.abs(n);
  if (abs < 0.05) return `0 ${u}`;
  if (u.toUpperCase() === 'UND' || u.toLowerCase() === 'cx' || u.toUpperCase() === 'CX' || Number.isInteger(n) || abs >= 10) {
    return `${Math.round(n)} ${u}`;
  }
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ` ${u}`;
}

/** Saldo do banco (KG/UND) → o que dá pra falar no Zap (cx/und). */
export function qtdFalaEmprestimo({ qtd, unid, und_convertida, pediu_cx } = {}) {
  const n = Number(qtd);
  const u = String(unid || 'UND').toUpperCase();
  const fator = Number(und_convertida);
  if (!Number.isFinite(n)) return { qtd: 0, unid: 'und' };
  if (pediu_cx && Number.isFinite(fator) && fator > 1.05) {
    return { qtd: Math.max(0, Math.round(n / fator)), unid: 'cx' };
  }
  if (u === 'UND' || u === 'UN' || u === 'CX') {
    return { qtd: Math.round(n), unid: u === 'CX' ? 'cx' : 'und' };
  }
  return {
    qtd: Math.round(n),
    unid: u.toLowerCase(),
    ...(pediu_cx ? { sem_fator_caixa: true } : {}),
  };
}

function itensDaLoja(loja) {
  return (loja.itens || [])
    .map((item) => nomeItemCurto(item.descricao || item.item))
    .map((s) => String(s || '').trim())
    .filter(Boolean);
}

function situacaoDaContagem(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'contou' || s === 'ok' || s === 'finalizada' || s === 'resolvida') return 'fechou no app';
  if (s === 'aberta') return 'começou e ainda não finalizou';
  if (s === 'faltou' || s === 'pendente') return 'ainda não apareceu no app';
  return null;
}

function falaLojaEmp(l) {
  if (!l) return null;
  const loja = nomeLojaCurto(l.loja);
  const qtd = l.qtd != null ? `${l.qtd} ${String(l.unid || 'cx').toLowerCase()}` : null;
  const km = l.km != null ? `${Math.round(Number(l.km))} km` : null;
  return [loja, qtd, km].filter(Boolean).join(', ');
}

export function pareceFalaDePainel(texto) {
  const t = String(texto || '');
  return (
    /—\s*(contagem|estoque)|:\s*(contou|faltou|aberta|ok)\b/i.test(t)
    || /\b(contou|faltou|DETECTADA|COBRADA|AGUARDANDO|CONFERINDO|RESOLVIDA|status_label|contagem_label)\b/.test(t)
    || /contagem di[aá]ria/i.test(t)
    || /a loja mais pr[oó]xima da regional/i.test(t)
    || /para emprestar é a/i.test(t)
  );
}

export function fatosParaRedacao(fatos) {
  const clone = JSON.parse(JSON.stringify(fatos || {}));
  const pergunta = String(clone.mensagem_da_pessoa || '');
  const falaDeContagem = /contagem|contei|contou|finaliz/i.test(pergunta)
    || clone.orientacao === 'comemorou'
    || clone.orientacao === 'ainda_nao_me_avisa';
  const falaDeEstoque = /zerad|supercrit|critico|sem saldo/i.test(pergunta);
  const emprestimo = clone.consulta_saldo && typeof clone.consulta_saldo === 'object'
    ? clone.consulta_saldo
    : null;

  if (emprestimo) {
    return {
      com_quem: primeiroNome(clone.nome_pessoa || clone.regional) || null,
      conversa_fria: clone.conversa_fria === true,
      historico: Array.isArray(clone.historico) ? clone.historico.slice(-10) : [],
      pergunta: pergunta || null,
      no_sistema: [{
        tipo: 'emprestimo',
        mais_perto: falaLojaEmp(emprestimo.mais_perto) || falaLojaEmp((emprestimo.lojas || [])[0]),
        tem_quantidade: (emprestimo.quem_tem_o_minimo || emprestimo.lojas || [])
          .map((l) => falaLojaEmp(l))
          .filter(Boolean),
        unica_longe: emprestimo.unica_longe === true,
        ...(emprestimo.aviso ? { aviso: emprestimo.aviso } : {}),
      }],
    };
  }

  const lojasConsulta = Array.isArray(clone.consulta?.lojas) ? clone.consulta.lojas : [];
  const lojasFato = Array.isArray(clone.lojas) ? clone.lojas : [];
  const no_sistema = [];
  for (const l of [...lojasConsulta, ...lojasFato]) {
    const loja = nomeLojaCurto(l.loja || l.name);
    const brutos = itensDaLoja(l).concat(
      (l.itens_zerados || []).map((n) => (
        typeof n === 'string' ? nomeItemCurto(n) : nomeItemCurto(n?.descricao || n?.item)
      )),
    );
    const itens = nomesItensUnicos(brutos);
    const sit = situacaoDaContagem(l.contagem || l.sistema || l.status);
    no_sistema.push({
      loja,
      ...(falaDeContagem && sit ? { contagem: sit } : {}),
      ...(falaDeEstoque ? { sem_saldo: resumoSemSaldo(itens) } : {}),
    });
  }

  return {
    com_quem: primeiroNome(clone.nome_pessoa || clone.regional) || null,
    conversa_fria: clone.conversa_fria === true,
    historico: Array.isArray(clone.historico) ? clone.historico.slice(-10) : [],
    pergunta: pergunta || null,
    no_sistema,
  };
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

export function juntarListaEmUmaBolha(msgs) {
  const linhas = [];
  for (const m of msgs || []) {
    for (const linha of String(m || '').split(/\n+/)) {
      const t = linha.trim();
      if (t) linhas.push(t);
    }
  }
  if (!linhas.length) return [];
  const numeradas = linhas.filter((l) => /^\d+[\).:-]\s+\S/.test(l));
  if (numeradas.length < 3) {
    return (msgs || []).map((s) => String(s || '').trim()).filter(Boolean);
  }
  return [linhas.join('\n')];
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
      'Tem item sem saldo. Avisa o regional pelo nome, uma loja por bolha, como colega. Loja com BK. Sem relatório.',
    ].join('\n');
  }
  if (tipo === 'contagem_faltou' || fatos?.missao === 'avisar_contagem_faltou') {
    return [
      'missao=avisar_contagem_faltou',
      'Tem loja que ainda não fechou a contagem. Cobra o regional pelo nome, como colega. Sem boletim.',
    ].join('\n');
  }
  if (tipo === 'responder_whatsapp' || fatos?.missao === 'responder_whatsapp') {
    return 'Zap. 1 ou 2 bolhas curtas, como colega. Não copia a pergunta. Se unica_longe, a longe não é a mais perto.';
  }
  return 'Escreve o recado em bolhas de WhatsApp, como colega do time. Sem relatório.';
}

function bolhasEmprestimoDosFatos(limpos) {
  const e = (limpos?.no_sistema || []).find((l) => l.tipo === 'emprestimo');
  if (!e) return [];
  const msgs = [];
  if (e.mais_perto) msgs.push(`Perto é ${e.mais_perto}`);
  const outro = (e.tem_quantidade || []).find((t) => t && t !== e.mais_perto);
  if (e.unica_longe && outro) msgs.push(`Mais de 5 cx só ${outro} — longe pra emprestar`);
  else if (e.aviso && !msgs.length) msgs.push('Não achei isso na região');
  return msgs.slice(0, 2);
}

export async function redigirBolhasComLlm(config, fatos, fallbackBolhas) {
  const limpos = fatosParaRedacao(fatos);
  const conversa = fatos?.tipo === 'responder_whatsapp' || fatos?.missao === 'responder_whatsapp';
  const listaEstoque = (limpos.no_sistema || []).some((l) => (l.sem_saldo?.qtd || 0) > 2);
  const emprestimo = (limpos.no_sistema || []).some((l) => l.tipo === 'emprestimo');
  logger.info('agente-alvim', 'Fatos pra redigir', {
    lojas: (limpos.no_sistema || []).map((l) => ({
      loja: l.loja,
      zerados: l.sem_saldo?.qtd ?? null,
      emprestimo: l.tipo === 'emprestimo' ? {
        mais_perto: l.mais_perto,
        tem_quantidade: l.tem_quantidade,
        unica_longe: l.unica_longe,
        aviso: l.aviso || null,
      } : null,
    })),
  });
  const raw = await generateText({
    system: promptSistemaAlvim(config),
    prompt: [promptMissao(fatos), '', 'Verdade (não copie, só use):', JSON.stringify(limpos, null, 2)].join('\n'),
    maxTokens: listaEstoque ? 1400 : 500,
    temperature: conversa ? 1.2 : 1.0,
    json: true,
    model: config?.ai_model,
  });
  const min = conversa ? 1 : 2;
  const parsed = parseRespostaAgente(raw, {
    min: fatos?.silencio_ok ? 0 : min,
    max: listaEstoque ? 24 : (conversa ? 2 : 6),
  });
  const cruas = (parsed.msgs || []).filter((m) => !pareceFalaDePainel(m));
  const limpas = listaEstoque && !emprestimo ? juntarListaEmUmaBolha(cruas) : cruas;
  if (fatos?.silencio_ok && parsed.agir === false) return [];
  if (limpas.length) {
    logger.info('agente-alvim', 'Bolhas prontas', {
      qtd: limpas.length,
      linhas: limpas[0]?.split('\n').length || 0,
    });
    return limpas;
  }
  const fbEmp = bolhasEmprestimoDosFatos(limpos);
  if (fbEmp.length) {
    logger.warn('agente-alvim', 'LLM travou no relatório — mando as bolhas do fato');
    return fbEmp;
  }
  if (parsed.msgs.length && !limpas.length) {
    logger.warn('agente-alvim', 'LLM falou como painel — descarto e não mando texto de sistema');
    return [];
  }

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
