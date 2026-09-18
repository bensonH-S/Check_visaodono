/**
 * Cliente LLM do Agente Alvim.
 * O modelo só redige. Número, loja e saldo vêm da ferramenta — nunca da cabeça.
 */
import { logger } from '../logger.js';

function envTrim(nome) {
  return String(process.env[nome] || '').trim();
}

export function openaiKey() {
  return envTrim('OPENAI_API_KEY');
}

export function geminiKey() {
  return envTrim('GEMINI_API_KEY') || envTrim('GOOGLE_API_KEY') || envTrim('GOOGLE_GEMINI_API_KEY');
}

export function llmKeyPresent() {
  return Boolean(geminiKey() || openaiKey());
}

export function aiEnabled() {
  const flag = envTrim('AI_ENABLED').toLowerCase();
  if (flag === 'false') return false;
  if (flag === 'true') return true;
  return llmKeyPresent();
}

export function aiProvider() {
  const explicit = envTrim('AI_PROVIDER').toLowerCase();
  if (explicit === 'gpt') return 'openai';
  if (explicit === 'google' || explicit === 'google-gemini') return 'gemini';
  if (explicit) return explicit;
  if (openaiKey()) return 'openai';
  if (geminiKey()) return 'gemini';
  return 'openai';
}

export const MODELOS_OPENAI = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'];

export function aiModel(override) {
  const explicit = String(override || '').trim() || envTrim('AI_MODEL') || envTrim('GEMINI_MODEL');
  const provider = aiProvider();
  if (provider === 'gemini') {
    if (explicit && !/^gpt-/i.test(explicit)) {
      return explicit.replace(/^models\//, '');
    }
    return 'gemini-3.7-flash';
  }
  if (explicit && /^gpt-/i.test(explicit)) return explicit;
  return explicit || 'gpt-4o-mini';
}

async function generateOpenAI({ system, prompt, maxTokens, temperature = 0.95, model, json = false }) {
  const key = openaiKey();
  if (!key) return null;
  const body = {
    model: model || aiModel(),
    temperature,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detalhe = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${detalhe.slice(0, 240)}`);
  }
  const data = await res.json();
  const texto = String(data?.choices?.[0]?.message?.content || '').trim();
  return texto || null;
}

function textoGemini(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => String(p?.text || '')).join('').trim();
}

const GEMINI_MODELOS_BARATOS = [
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

async function generateGeminiRequest({ key, model, system, prompt, maxTokens, temperature = 0.95, json = false }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const generationConfig = {
    temperature,
    maxOutputTokens: maxTokens,
  };
  if (json) generationConfig.responseMimeType = 'application/json';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const status = data?.error?.status || '';
    const msg = String(data?.error?.message || '').slice(0, 240);
    throw new Error(`Gemini ${res.status}${status ? ` ${status}` : ''}: ${msg}`);
  }
  const texto = textoGemini(data);
  return texto || null;
}

async function generateGeminiOnce(opts) {
  try {
    return await generateGeminiRequest(opts);
  } catch (e) {
    if (opts.json && /400|INVALID_ARGUMENT/i.test(e.message)) {
      return generateGeminiRequest({ ...opts, json: false });
    }
    throw e;
  }
}

async function generateGemini({ system, prompt, maxTokens, temperature, json, model }) {
  const key = geminiKey();
  if (!key) return null;
  const fila = [];
  const visto = new Set();
  for (const nome of [model, aiModel(), ...GEMINI_MODELOS_BARATOS]) {
    if (!nome || visto.has(nome)) continue;
    visto.add(nome);
    fila.push(nome);
  }
  let lastErr = null;
  for (const model of fila) {
    try {
      return await generateGeminiOnce({ key, model, system, prompt, maxTokens, temperature, json });
    } catch (e) {
      lastErr = e;
      if (!/404|NOT_FOUND|503|UNAVAILABLE|429/i.test(e.message)) throw e;
    }
  }
  throw lastErr || new Error('Gemini: nenhum modelo respondeu');
}

export async function generateText({
  system,
  prompt,
  maxTokens = 400,
  temperature = 0.95,
  json = false,
  model,
} = {}) {
  if (!aiEnabled()) return null;
  const provider = aiProvider();
  const escolhido = aiModel(model);
  try {
    if (provider === 'gemini') {
      return await generateGemini({ system, prompt, maxTokens, temperature, json, model: escolhido });
    }
    if (provider === 'openai') {
      return await generateOpenAI({ system, prompt, maxTokens, temperature, json, model: escolhido });
    }
    logger.warn('agente-alvim', `Provedor LLM não suportado: ${provider}`);
    return null;
  } catch (e) {
    logger.warn('agente-alvim', 'LLM falhou — uso o texto da ferramenta', { error: e.message });
    return null;
  }
}
