import { logger } from '../logger.js';
import { pool } from '../db.js';
import { normalizarTelefoneBr } from '../utils/telefone.js';
import { carregarConfigAlvim } from './persona.js';
import { agruparPorRegional } from './regiao.js';
import { destinoEhGrupo } from './whatsapp.js';
import { papelDoChat } from './grupos.js';
import { montarConsulta, pedidosAtivos, salvarPedidoMonitoramento, snapshotOperacao } from './operacao.js';
import { conferirAfirmacao, marcarPediuAviso, resumoPendenciasParaFatos } from './pendencia.js';

let schemaOk = false;
const inboundBuffers = new Map();

async function garantirSchemaConversa() {
  if (schemaOk) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agente_alvim_conversas (
      telefone TEXT PRIMARY KEY,
      ferramenta TEXT,
      fatos JSONB NOT NULL DEFAULT '{}'::jsonb,
      bolhas JSONB NOT NULL DEFAULT '[]'::jsonb,
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  schemaOk = true;
}

function chaveTelefone(destino, telefone) {
  if (destino && typeof destino === 'object' && destino.id_usuario) {
    return `u:${destino.id_usuario}`;
  }
  const rawDest = String(destino || '').trim();
  if (destinoEhGrupo(rawDest)) return `g:${rawDest.replace(/\s/g, '')}`;
  if (telefone) {
    const n = normalizarTelefoneBr(telefone) || String(telefone).replace(/\D/g, '');
    if (n) return n;
  }
  if (destinoEhGrupo(telefone)) return `g:${String(telefone).trim()}`;
  const raw = String(destino || telefone || '').replace(/\D/g, '');
  return raw || null;
}

export async function salvarContextoAlvim({ destino = null, telefone = null, fatos, bolhas } = {}) {
  const key = chaveTelefone(destino, telefone);
  if (!key) return;
  await garantirSchemaConversa();
  await pool.query(
    `
    INSERT INTO agente_alvim_conversas (telefone, ferramenta, fatos, bolhas, atualizado_em)
    VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW())
    ON CONFLICT (telefone) DO UPDATE
    SET ferramenta = EXCLUDED.ferramenta,
        fatos = EXCLUDED.fatos,
        bolhas = EXCLUDED.bolhas,
        atualizado_em = NOW()
    `,
    [
      key,
      String(fatos?.tipo || fatos?.missao || ''),
      JSON.stringify(fatos || {}),
      JSON.stringify(bolhas || []),
    ],
  );
}

async function idsUsuarioPorTelefone(fromPhone) {
  const digits = String(fromPhone || '').replace(/\D/g, '');
  if (digits.length < 8) return [];
  try {
    const { rows } = await pool.query(
      `
      SELECT id_usuario
      FROM usuarios
      WHERE telefone_whatsapp IS NOT NULL
        AND RIGHT(regexp_replace(telefone_whatsapp, '[^0-9]', '', 'g'), 8)
          = RIGHT($1, 8)
      LIMIT 5
      `,
      [digits],
    );
    return rows.map((r) => Number(r.id_usuario)).filter(Boolean);
  } catch {
    return [];
  }
}

async function carregarContexto(fromPhone, chatId = null) {
  await garantirSchemaConversa();
  const digits = String(fromPhone || '').replace(/\D/g, '');
  const norm = normalizarTelefoneBr(fromPhone) || digits;
  const chaves = [];
  if (chatId && destinoEhGrupo(chatId)) chaves.push(`g:${String(chatId).trim()}`);
  if (norm) chaves.push(norm);
  if (digits) chaves.push(digits);
  const ids = await idsUsuarioPorTelefone(fromPhone);
  for (const id of ids) chaves.push(`u:${id}`);

  const { rows } = await pool.query(
    `
    SELECT telefone, ferramenta, fatos, bolhas, atualizado_em
    FROM agente_alvim_conversas
    WHERE atualizado_em > NOW() - INTERVAL '24 hours'
      AND (
        telefone = ANY($1::text[])
        OR (
          $2 <> '' AND RIGHT(regexp_replace(telefone, '[^0-9]', '', 'g'), 11)
            = RIGHT(regexp_replace($2, '[^0-9]', '', 'g'), 11)
        )
      )
    ORDER BY atualizado_em DESC
    LIMIT 1
    `,
    [chaves.filter(Boolean), digits],
  );
  return rows[0] || null;
}

function lojasDoGrupo(itens) {
  const porLoja = new Map();
  for (const item of itens || []) {
    const id = item.id_loja;
    if (!porLoja.has(id)) {
      porLoja.set(id, { id_loja: id, loja: item.loja, bk_number: item.bk_number, itens: [] });
    }
    if (item.descricao || item.item) {
      porLoja.get(id).itens.push({
        descricao: item.descricao || item.item,
        quantidade: item.quantidade,
        unidade: item.unidade,
      });
    }
  }
  return [...porLoja.values()];
}

function lojasDoContexto(ctx, fatos) {
  const nomes = [];
  for (const l of [...(fatos?.lojas || []), ...(ctx?.fatos?.lojas || [])]) {
    if (l?.loja || l?.name) nomes.push(l.loja || l.name);
  }
  for (const p of [...(fatos?.pendencias || []), ...(ctx?.fatos?.pendencias || [])]) {
    if (p?.loja) nomes.push(p.loja);
  }
  return [...new Set(nomes.filter(Boolean))];
}

async function fatosAtualizados(ctx) {
  const tipo = String(ctx?.ferramenta || ctx?.fatos?.tipo || '');
  if (tipo === 'estoque_zero' || ctx?.fatos?.missao === 'avisar_item_zerado_na_loja') {
    const { coletarEstoqueZero } = await import('./tools/estoqueZero.js');
    const coletados = await coletarEstoqueZero();
    const grupos = agruparPorRegional(coletados);
    const grupo = grupos[0] || { nome_regional: ctx?.fatos?.regional, itens: coletados };
    return {
      tipo: 'responder_whatsapp',
      missao: 'responder_whatsapp',
      regional: grupo.nome_regional || ctx?.fatos?.regional,
      lojas: lojasDoGrupo(grupo.itens || coletados),
      recado_anterior: ctx?.bolhas || [],
    };
  }
  if (tipo === 'contagem_faltou') {
    const { coletarContagemFaltou } = await import('./tools/contagemFaltou.js');
    const { itens } = await coletarContagemFaltou();
    const grupos = agruparPorRegional(itens);
    const grupo = grupos[0] || { nome_regional: ctx?.fatos?.regional, itens };
    return {
      tipo: 'responder_whatsapp',
      missao: 'responder_whatsapp',
      regional: grupo.nome_regional || ctx?.fatos?.regional,
      lojas: (grupo.itens || itens).map((i) => ({ loja: i.loja || i.name })),
      recado_anterior: ctx?.bolhas || [],
    };
  }
  return {
    tipo: 'responder_whatsapp',
    missao: 'responder_whatsapp',
    ...((ctx?.fatos && typeof ctx.fatos === 'object') ? ctx.fatos : {}),
    recado_anterior: ctx?.bolhas || [],
  };
}

export async function responderMensagemAlvim(fromPhone, bodyText, { chatId = null, nomePessoa = null } = {}) {
  const config = await carregarConfigAlvim();
  const papel = papelDoChat(chatId, config);
  const ctx = await carregarContexto(fromPhone, chatId);
  if (!ctx && !papel) return { handled: false, reason: 'sem_contexto' };

  const snapshot = await snapshotOperacao({
    idRegiao: papel?.tipo === 'regiao' ? papel.id_regiao : null,
  });
  const fatos = ctx ? await fatosAtualizados(ctx) : {
    tipo: 'responder_whatsapp',
    missao: 'responder_whatsapp',
  };
  fatos.tipo = 'responder_whatsapp';
  fatos.missao = 'responder_whatsapp';
  fatos.silencio_ok = true;
  fatos.mensagem_da_pessoa = String(bodyText || '').trim();
  if (nomePessoa) fatos.nome_pessoa = String(nomePessoa).trim();
  fatos.publico = papel?.tipo || 'privado';
  fatos.grupo_nome = papel?.nome || null;
  fatos.pedidos_monitoramento = await pedidosAtivos();

  const lojasContexto = lojasDoContexto(ctx, fatos);
  const conferencia = await conferirAfirmacao({
    texto: fatos.mensagem_da_pessoa,
    snapshot,
    regional: fatos.regional || papel?.nome_regional || null,
    nomePessoa,
    lojasContexto,
  });
  const consulta = montarConsulta({
    texto: fatos.mensagem_da_pessoa,
    snapshot,
    pendencias: conferencia.pendencias,
    lojasContexto,
  });
  fatos.consulta = consulta;
  fatos.pendencias = resumoPendenciasParaFatos(conferencia.pendencias);
  fatos.afirmacao_resolucao = conferencia.afirmacao;
  fatos.todas_resolvidas = conferencia.todas_resolvidas === true;
  fatos.nada_mudou = conferencia.nada_mudou === true;
  fatos.orientacao = conferencia.orientacao || (conferencia.todas_resolvidas ? 'comemorou' : null);

  const pergunta = /\?|pode |consegue |me (passa|informa|manda)|quais |quem |monitora|e o estoque/i
    .test(fatos.mensagem_da_pessoa);
  if (conferencia.afirmacao && !conferencia.deve_falar && !pergunta) {
    logger.info('agente-alvim', 'Zap silencioso — consultei e nada mudou', {
      lojas: consulta.lojas.map((l) => `${l.loja}:${l.contagem}`),
    });
    return { handled: true, reason: 'nada_mudou', msgs: 0 };
  }
  if (!conferencia.deve_falar && !pergunta && !consulta.lojas.length) {
    return { handled: true, reason: 'silencio', msgs: 0 };
  }

  const destino = (chatId && destinoEhGrupo(chatId)) ? chatId : fromPhone;
  const { enviarRecadoAlvim } = await import('./recado.js');
  const r = await enviarRecadoAlvim({
    config,
    destinos: [destino],
    fatos,
    fallbackBolhas: [],
  });
  logger.info('agente-alvim', r.silencioso ? 'Zap silencioso' : 'Respondeu Zap', {
    reason: r.silencioso ? 'silencio' : (r.ok ? 'respondeu' : r.motivo),
    msgs: r.bolhas?.length || 0,
  });
  if (r.silencioso) return { handled: true, reason: 'silencio', msgs: 0 };

  if (conferencia.orientacao === 'ainda_nao_me_avisa') {
    await marcarPediuAviso((conferencia.pendencias || []).map((p) => p.chave));
  }

  const textoPedido = /monitorar|1\s*cx|uma\s*caixa/i.test(fatos.mensagem_da_pessoa)
    ? fatos.mensagem_da_pessoa
    : null;
  if (textoPedido) {
    await salvarPedidoMonitoramento({
      texto: textoPedido,
      solicitadoPor: nomePessoa,
      grupo: chatId,
    });
  }

  return { handled: r.ok, reason: r.ok ? 'respondeu' : r.motivo, msgs: r.bolhas?.length || 0 };
}

function serializado(v) {
  if (!v) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v).trim();
  if (typeof v === 'object') {
    if (v._serialized) return String(v._serialized).trim();
    if (v.user && v.server) return `${v.user}@${v.server}`;
    if (v.user) return String(v.user);
    if (v.remote) return serializado(v.remote);
    if (v.id && v.id !== v) return serializado(v.id);
  }
  return '';
}

export function extractInboundFromWppWebhook(body) {
  const payload = body && typeof body === 'object' ? body : {};
  const root = payload.response || payload.data || payload.message || payload;
  const event = payload.event || payload.type || root?.event || '';
  const candidates = [
    root?.from,
    root?.chatId,
    root?.sender?.id,
    root?.sender?.id?._serialized,
    root?.id?.remote,
    payload?.from,
    root?.author,
    root?.participant,
  ]
    .map(serializado)
    .filter(Boolean);
  const chatId = serializado(root?.chatId)
    || serializado(root?.id?.remote)
    || candidates.find((c) => c.includes('@g.us'))
    || '';
  const author = serializado(root?.author || root?.participant || root?.sender?.id);
  const isGroup = Boolean(
    root?.isGroupMsg ||
    root?.isGroup ||
    chatId.includes('@g.us') ||
    candidates.some((c) => c.includes('@g.us')),
  );
  const from = isGroup
    ? (author || candidates.find((c) => c.includes('@c.us')) || candidates[0] || '')
    : (candidates.find((c) => c.includes('@c.us')) || candidates[0] || '');
  const text =
    root?.body ||
    root?.content ||
    root?.message?.body ||
    root?.text ||
    payload?.body ||
    '';
  const fromMe =
    root?.fromMe === true ||
    payload?.fromMe === true ||
    root?.id?.fromMe === true;
  const nomePessoa =
    root?.notifyName ||
    root?.sender?.pushname ||
    root?.sender?.name ||
    root?.sender?.verifiedName ||
    '';
  return {
    from,
    chatId: isGroup ? (chatId || from) : from,
    body: String(text || '').trim(),
    fromMe,
    event,
    isGroup,
    nomePessoa: String(nomePessoa || '').trim(),
  };
}

export function enqueueInboundAlvim(fromPhone, bodyText, { chatId = null, nomePessoa = null } = {}) {
  const key = [
    chatId && destinoEhGrupo(chatId) ? chatId : '',
    String(fromPhone || '').replace(/\D/g, '') || String(fromPhone || ''),
  ].filter(Boolean).join('|');
  if (!key || !bodyText) return Promise.resolve({ handled: false, reason: 'empty' });

  return new Promise((resolve) => {
    const prev = inboundBuffers.get(key) || { texts: [], timer: null, resolvers: [] };
    prev.texts.push(String(bodyText).trim());
    prev.resolvers.push(resolve);
    if (prev.timer) clearTimeout(prev.timer);
    prev.timer = setTimeout(async () => {
      inboundBuffers.delete(key);
      const merged = prev.texts.filter(Boolean).join('\n');
      let result = { handled: false, reason: 'error' };
      try {
        result = await responderMensagemAlvim(fromPhone, merged, { chatId, nomePessoa });
      } catch (e) {
        logger.warn('agente-alvim', 'Falha ao responder Zap', { error: e.message });
        result = { handled: false, reason: 'exception' };
      }
      for (const r of prev.resolvers) r(result);
    }, 3500);
    inboundBuffers.set(key, prev);
  });
}
