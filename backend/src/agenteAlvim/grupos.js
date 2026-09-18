import { pool } from '../db.js';
import { listarGruposWpp } from '../services/wppClient.js';
import { carregarCredenciaisWpp } from '../services/wppSession.js';
import { carregarConfigAlvim, salvarConfigAlvim } from './persona.js';
import { primeiroNome } from './texto.js';

export function normalizarNome(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function classificarNomeGrupo(nome) {
  const n = normalizarNome(nome);
  if (!n) return { tipo: 'outro' };
  if (/lideran/.test(n)) return { tipo: 'lideranca' };
  if (/\bgestores\b/.test(n) && !/regiao/.test(n)) return { tipo: 'gestores' };
  const m = n.match(/regiao\s+([a-z0-9]+)/);
  if (m && (/projeto|ti|regiao/.test(n))) {
    return { tipo: 'regiao', regional: m[1] };
  }
  return { tipo: 'outro' };
}

async function regionaisOperacao() {
  const { rows } = await pool.query(
    `
    SELECT DISTINCT
      r.id_regiao,
      r.nome AS nome_regiao,
      u.id_usuario,
      u.nome AS nome_regional
    FROM frota_regioes r
    LEFT JOIN usuarios u ON u.id_usuario = r.id_regional AND u.ativo = TRUE
    WHERE r.ativo = TRUE
    ORDER BY r.nome
    `,
  );
  return rows.map((r) => ({
    id_regiao: Number(r.id_regiao),
    nome_regiao: r.nome_regiao,
    id_usuario: r.id_usuario ? Number(r.id_usuario) : null,
    nome_regional: r.nome_regional,
    chave: normalizarNome(primeiroNome(r.nome_regional) || r.nome_regiao),
  }));
}

function casarRegional(chave, regionais) {
  if (!chave) return null;
  return regionais.find((r) => r.chave === chave || r.chave.startsWith(chave) || chave.startsWith(r.chave)) || null;
}

export function papelDoChat(chatId, config) {
  const id = String(chatId || '').trim();
  if (!id) return null;
  const grupos = config?.grupos || {};
  if (grupos.lideranca?.id === id || config?.grupo_whatsapp === id) {
    return { tipo: 'lideranca', id, nome: grupos.lideranca?.nome || 'Liderança' };
  }
  if (grupos.gestores?.id === id) {
    return { tipo: 'gestores', id, nome: grupos.gestores?.nome || 'Gestores' };
  }
  const reg = (grupos.regioes || []).find((g) => g.id === id);
  if (reg) return { tipo: 'regiao', ...reg };
  return null;
}

export function grupoZapDaRegiao(config, { id_regiao, nome_regional } = {}) {
  const regioes = config?.grupos?.regioes || [];
  const id = Number(id_regiao);
  if (id) {
    const hit = regioes.find((g) => Number(g.id_regiao) === id);
    if (hit?.id) return hit.id;
  }
  const chave = normalizarNome(primeiroNome(nome_regional));
  const hitNome = regioes.find((g) => normalizarNome(g.regional) === chave);
  return hitNome?.id || null;
}

export async function sincronizarGruposAlvim() {
  const cred = await carregarCredenciaisWpp();
  if (!cred?.token) return { ok: false, motivo: 'sessao_wpp', grupos: [] };
  const brutos = await listarGruposWpp(cred.token);
  const regionais = await regionaisOperacao();
  const classificados = brutos.map((g) => ({ ...g, ...classificarNomeGrupo(g.nome) }));

  const lideranca = classificados.find((g) => g.tipo === 'lideranca') || null;
  const gestores = classificados.find((g) => g.tipo === 'gestores') || null;
  const regioes = classificados
    .filter((g) => g.tipo === 'regiao')
    .map((g) => {
      const reg = casarRegional(g.regional, regionais);
      return {
        id: g.id,
        nome: g.nome,
        regional: g.regional,
        id_regiao: reg?.id_regiao || null,
        id_usuario: reg?.id_usuario || null,
        nome_regional: reg?.nome_regional || null,
      };
    });

  const grupos = {
    lideranca: lideranca ? { id: lideranca.id, nome: lideranca.nome } : null,
    gestores: gestores ? { id: gestores.id, nome: gestores.nome } : null,
    regioes,
  };

  await salvarConfigAlvim({
    grupos,
    grupo_whatsapp: lideranca?.id || undefined,
  });

  return {
    ok: true,
    grupos,
    descobertos: classificados,
  };
}

export async function listarGruposSalvos() {
  const config = await carregarConfigAlvim();
  return config.grupos || { lideranca: null, gestores: null, regioes: [] };
}
