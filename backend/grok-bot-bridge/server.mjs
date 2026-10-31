/**
 * Ponte local para o Grok Bot revisar a sugestão.
 * Não altera quantidade. Se não houver chave ou o Grok não responder, devolve lista vazia.
 *
 * O app Grok Bot (0.75) não abre porta local: só sai para a nuvem.
 * Esta ponte escuta em 127.0.0.1 e chama a API do Grok quando GROK_API_KEY ou XAI_API_KEY existe.
 *
 *   node backend/grok-bot-bridge/server.mjs
 *
 * Variáveis:
 *   GROK_API_KEY ou XAI_API_KEY
 *   GROK_MODEL (padrão grok-4.7)
 *   GROK_BOT_URL (padrão https://api.x.ai/v1/responses)
 *   GROK_BOT_BRIDGE_PORT (padrão 8787)
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarPrompt, interpretarRevisao } from './prompt.js';

function carregarEnv() {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const arquivos = [path.resolve(aqui, '../../.env'), path.resolve(aqui, '../.env')];
  for (const arquivo of arquivos) {
    let texto = '';
    try {
      texto = fs.readFileSync(arquivo, 'utf8');
    } catch {
      continue;
    }
    for (const linha of texto.split(/\r?\n/)) {
      const m = linha.match(/^\s*(GROK_API_KEY|XAI_API_KEY)\s*=\s*(.*)$/);
      if (!m) continue;
      const valor = m[2].trim().replace(/^["']|["']$/g, '');
      if (valor && !String(process.env[m[1]] || '').trim()) process.env[m[1]] = valor;
    }
  }
}

carregarEnv();

const porta = Number(process.env.GROK_BOT_BRIDGE_PORT || 8787);
const urlGrok = String(process.env.GROK_BOT_URL || 'https://api.x.ai/v1/responses').trim();
const modelo = String(process.env.GROK_MODEL || 'grok-4.7').trim();

function chave() {
  return String(process.env.GROK_API_KEY || process.env.XAI_API_KEY || '').trim();
}

function textoResposta(json) {
  if (typeof json?.output_text === 'string' && json.output_text.trim()) return json.output_text;
  const partes = [];
  for (const item of json?.output || []) {
    if (item?.type && item.type !== 'message') continue;
    const conteudo = Array.isArray(item?.content) ? item.content : [];
    for (const bloco of conteudo) {
      if (bloco?.type === 'output_text' && bloco.text) partes.push(bloco.text);
    }
  }
  return partes.join('\n') || json?.choices?.[0]?.message?.content || '';
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    const pedacos = [];
    let tamanho = 0;
    req.on('data', (buf) => {
      tamanho += buf.length;
      if (tamanho > 1_000_000) {
        reject(new Error('corpo grande'));
        req.destroy();
        return;
      }
      pedacos.push(buf);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(pedacos).toString('utf8') || '{}'));
      } catch {
        reject(new Error('json inválido'));
      }
    });
    req.on('error', reject);
  });
}

function enviar(res, status, corpo) {
  const json = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

async function revisar(corpo) {
  const itens = Array.isArray(corpo?.itens) ? corpo.itens.slice(0, 60) : [];
  const codigos = itens.map((item) => item.codigo);
  const key = chave();
  if (!key || !itens.length) return { ok: false, chave: key ? 'ok' : 'ausente', itens: [] };
  const prompt = montarPrompt(corpo?.loja, itens);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const resposta = await fetch(urlGrok, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelo,
        store: false,
        input: [
          { role: 'system', content: 'Você só revisa. Não invente código e não mude a quantidade.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!resposta.ok) {
      const recusada = resposta.status === 401 || resposta.status === 403;
      let codigo = '';
      let mensagem = '';
      try {
        const bruto = await resposta.text();
        mensagem = bruto.replaceAll(key, '').slice(0, 400);
        const err = JSON.parse(bruto);
        codigo = String(err?.error?.code || err?.code || err?.error?.type || '').slice(0, 40);
        if (typeof err?.error === 'string') mensagem = err.error.slice(0, 400);
        else if (err?.error?.message) mensagem = String(err.error.message).slice(0, 400);
      } catch {
        codigo = '';
      }
      return { ok: false, chave: recusada ? 'recusada' : 'erro', http: resposta.status, erro: codigo, mensagem, itens: [] };
    }
    const json = await resposta.json();
    const texto = textoResposta(json);
    return { ok: true, chave: 'aceita', itens: interpretarRevisao(texto, codigos) };
  } catch {
    return { ok: false, chave: 'erro', itens: [] };
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/saude' || req.url === '/health')) {
    enviar(res, 200, { ok: true, grok: Boolean(chave()) });
    return;
  }
  if (req.method === 'POST' && req.url === '/revisar') {
    try {
      const corpo = await lerCorpo(req);
      enviar(res, 200, await revisar(corpo));
    } catch {
      enviar(res, 200, { ok: false, itens: [] });
    }
    return;
  }
  enviar(res, 404, { ok: false, itens: [] });
});

server.listen(porta, '127.0.0.1', () => {
  console.log(`Ponte Grok Bot em http://127.0.0.1:${porta}`);
});
