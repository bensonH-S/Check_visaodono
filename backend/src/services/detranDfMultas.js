/**
 * Consulta multas DETRAN-DF com redundância:
 * 1) Infosimples
 * 2) api-multas self-host (MULTAS_API_URL) - https://github.com/APIBrasil/api-multas
 * 3) Direto api.detran.df.gov.br (mesmo endpoint do BRController)
 *
 * Docs Infosimples: https://infosimples.com/consultas/detran-df-veiculo-mobile/
 */
import { logger } from '../logger.js';

function envStr(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v == null) continue;
    let s = String(v).trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
    if (s) return s;
  }
  return '';
}

const INFOSIMPLES_TOKEN = envStr('INFOSIMPLES_TOKEN', 'INFOSIMPLES_API_TOKEN');
/** Desligado enquanto a conta Infosimples estiver em analise/aprovacao. */
const INFOSIMPLES_ENABLED = !/^(0|false|off|nao|não|no)$/i.test(
  envStr('INFOSIMPLES_ENABLED', 'INFOSIMPLES_ATIVO') || 'true',
);
const INFOSIMPLES_BASE = (
  envStr('INFOSIMPLES_API_BASE') || 'https://api.infosimples.com/api/v2/consultas'
).replace(/\/$/, '');
/** Ex.: detran/df/veiculo/mobile (infracoes) ou detran/df/debitos */
const INFOSIMPLES_CONSULTA =
  envStr('INFOSIMPLES_DETRAN_DF_CONSULTA') || 'detran/df/veiculo/mobile';
const INFOSIMPLES_TIMEOUT_MS = Number(envStr('INFOSIMPLES_TIMEOUT_MS') || 60000);
const DETRAN_DF_TIMEOUT_MS = Number(envStr('DETRAN_DF_TIMEOUT_MS') || 12000);

const DETRAN_DF_BASE =
  envStr('DETRAN_DF_API_URL') ||
  'https://api.detran.df.gov.br/app/vinculo-veiculo/area-publica/buscaVeiculo';
const DETRAN_DF_USER_KEY = envStr('DETRAN_DF_USER_KEY', 'BR_KEY');
const MULTAS_API_URL = envStr('MULTAS_API_URL').replace(/\/$/, '');
const MULTAS_API_TOKEN = envStr('MULTAS_API_TOKEN') || '1234567890';

export function normalizarPlaca(placa) {
  return String(placa || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

export function normalizarRenavam(renavam) {
  return String(renavam || '').replace(/\D/g, '');
}

/**
 * @typedef {object} MultaDetranDf
 * @property {string|null} auto
 * @property {string|null} descricao
 * @property {string|null} local
 * @property {number|null} valor
 * @property {number|null} valor_desconto
 * @property {string|null} data_infracao
 * @property {string|null} data_vencimento
 * @property {string|null} situacao
 * @property {string|null} orgao
 * @property {number|null} pontos
 */

function parseValor(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseDataBr(s) {
  if (!s) return null;
  const t = String(s).trim();
  const m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  return t;
}

function mapInfracao(item, i) {
  return {
    auto:
      item.ait ||
      item.numero_auto ||
      item.numeroAuto ||
      item.auto ||
      item.processo ||
      item.codigo_renainf ||
      String(i + 1),
    descricao:
      item.desc_infracao ||
      item.descricao ||
      item.descricaoInfracao ||
      item.descricaoResumoInfracao ||
      item.enquadramento ||
      item.regulamento ||
      null,
    local: item.local || item.local_multa || item.localMulta || item.localInfracao || null,
    valor: parseValor(item.valor ?? item.valorCorrigido ?? item.valor_com_correcao ?? item.valorOriginal),
    valor_desconto: parseValor(item.valorDesconto ?? item.valor_com_desconto),
    data_infracao: parseDataBr(
      item.data_infracao ||
        item.data ||
        item.dataCometimento ||
        item.dataGoraInfracao ||
        item.dataInfracao ||
        (item.data && item.hora ? `${item.data} ${item.hora}` : null),
    ),
    data_vencimento: parseDataBr(item.data_vencimento || item.vencimento || item.dataVencimento || item.data_penalidade),
    situacao: item.status || item.situacao || item.situacaoBordero || null,
    orgao: item.orgao_autuador || item.orgaoAutuador || item.siglaOrgaoAutuador || item.orgao || null,
    pontos:
      item.pontos != null
        ? Number(item.pontos)
        : item.pontos_infracao != null
          ? Number(item.pontos_infracao)
          : item.pontosInfracao != null
            ? Number(item.pontosInfracao)
            : null,
  };
}

function extrairInfracoes(payload) {
  if (!payload || typeof payload !== 'object') return [];

  // Infosimples: data[0].infracoes | data[0].debitos.infracoes_veiculo
  const bloco = Array.isArray(payload.data) ? payload.data[0] : payload.data || payload;

  if (!bloco || typeof bloco !== 'object') return [];

  if (Array.isArray(bloco.infracoes)) return bloco.infracoes;
  if (Array.isArray(bloco.multas)) return bloco.multas;
  if (Array.isArray(bloco.debitos?.infracoes_veiculo)) return bloco.debitos.infracoes_veiculo;
  if (Array.isArray(bloco.debitos?.infracoes)) return bloco.debitos.infracoes;
  if (Array.isArray(payload.infracoes)) return payload.infracoes;
  if (Array.isArray(payload.multas)) return payload.multas;
  if (Array.isArray(payload.debitos?.infracoes_veiculo)) return payload.debitos.infracoes_veiculo;
  return [];
}

function extrairVeiculo(payload, placa, renavam) {
  const bloco = Array.isArray(payload?.data) ? payload.data[0] : payload?.data || payload;
  const v = bloco?.veiculo && typeof bloco.veiculo === 'object' ? bloco.veiculo : bloco;
  if (!v || typeof v !== 'object') {
    return { placa, renavam, marca_modelo: null, situacao: null, ano_fabricacao: null };
  }
  return {
    placa: v.placa || v.placa_mercosul || v.placaMercosul || placa,
    renavam: v.renavam || renavam,
    marca_modelo:
      v.marca_modelo ||
      [v.marca, v.modelo].filter(Boolean).join(' ') ||
      v.marcaModelo ||
      null,
    situacao: v.situacao || v.situacao_veiculo || v.desc_situacao || null,
    ano_fabricacao: v.ano_fabricacao || v.anoFabricacao || v.ano || null,
  };
}

/** Normaliza payload Infosimples / DETRAN / api-multas para lista uniforme. */
export function normalizarRespostaDetran(payload, placa, renavam) {
  if (!payload || typeof payload !== 'object') {
    return { placa, renavam, veiculo: null, multas: [], bruto: payload };
  }

  if (payload.message && payload.error) {
    const err = new Error(payload.message || 'Falha na consulta DETRAN-DF');
    err.detalhe = payload.error;
    throw err;
  }

  // Infosimples: code != 200/201
  if (payload.code != null && ![200, 201].includes(Number(payload.code))) {
    const errs = Array.isArray(payload.errors) ? payload.errors.filter(Boolean) : [];
    const detalhe = errs.join('; ');
    const base = payload.code_message || `Infosimples retornou código ${payload.code}`;
    // 603 = serviço existe mas não está habilitado na conta
    if (Number(payload.code) === 603 && detalhe) {
      throw new Error(detalhe);
    }
    throw new Error(detalhe || base);
  }

  const lista = extrairInfracoes(payload);
  const multas = lista.map((item, i) => mapInfracao(item, i));
  const veiculo = extrairVeiculo(payload, placa, renavam);

  return { placa, renavam, veiculo, multas, bruto: payload };
}

async function consultarInfosimples(placa, renavam) {
  if (!INFOSIMPLES_TOKEN) {
    throw new Error('INFOSIMPLES_TOKEN não configurado no .env');
  }

  const url = new URL(`${INFOSIMPLES_BASE}/${INFOSIMPLES_CONSULTA}`);
  url.searchParams.set('token', INFOSIMPLES_TOKEN);
  url.searchParams.set('placa', placa);
  url.searchParams.set('renavam', renavam);

  // Credenciais opcionais do portal (consulta debitos autenticada)
  const loginCpf = envStr('INFOSIMPLES_LOGIN_CPF', 'DETRAN_DF_LOGIN_CPF', 'DETRAN_PORTAL_CPF');
  const loginSenha = envStr('INFOSIMPLES_LOGIN_SENHA', 'DETRAN_DF_LOGIN_SENHA', 'DETRAN_PORTAL_SENHA');
  if (loginCpf) url.searchParams.set('login_cpf', loginCpf);
  if (loginSenha) url.searchParams.set('login_senha', loginSenha);

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), INFOSIMPLES_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Meridian-Frota/1.0',
      },
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Infosimples retornou resposta inválida (HTTP ${res.status})`);
    }
    if (!res.ok && (data?.code == null || Number(data.code) === 200)) {
      throw new Error(data?.code_message || data?.message || `Infosimples HTTP ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

async function consultarViaApiMultas(placa, renavam) {
  const url = `${MULTAS_API_URL}/multas/br`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: MULTAS_API_TOKEN,
      token: MULTAS_API_TOKEN,
    },
    body: JSON.stringify({ placa, renavam }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`api-multas retornou resposta inválida (HTTP ${res.status})`);
  }
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `api-multas HTTP ${res.status}`);
  }
  return data;
}

async function consultarDiretoDetranDf(placa, renavam) {
  if (!DETRAN_DF_USER_KEY) {
    throw new Error('DETRAN_DF_USER_KEY não configurado');
  }
  const url = `${DETRAN_DF_BASE}/${encodeURIComponent(placa)}/${encodeURIComponent(renavam)}?user_key=${encodeURIComponent(DETRAN_DF_USER_KEY)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DETRAN_DF_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ac.signal,
      headers: {
        Connection: 'Keep-Alive',
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'okhttp/4.9.2',
        'Content-Type': 'application/json',
        'X-Application-Context': 'application:prod:8080',
      },
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`DETRAN-DF retornou resposta inválida (HTTP ${res.status})`);
    }
    if (!res.ok) {
      const msg =
        data?.message ||
        data?.mensagem ||
        data?.error ||
        data?.erro ||
        `DETRAN-DF HTTP ${res.status}`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    // api-multas às vezes devolve { message, error } com HTTP 200
    if (data?.message && data?.error && !data?.infracoes && !data?.veiculo && !Array.isArray(data?.data)) {
      throw new Error(data.message || data.error || 'Falha DETRAN-DF');
    }
    return data;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Consulta multas de um veículo no DETRAN-DF com redundância:
 * 1) Infosimples (se token)
 * 2) api-multas self-host (MULTAS_API_URL) — GitHub APIBrasil/api-multas
 * 3) Direto api.detran.df.gov.br (mesmo endpoint do BRController)
 */
export async function consultarMultasDetranDf({ placa, renavam }) {
  const placaN = normalizarPlaca(placa);
  const renavamN = normalizarRenavam(renavam);

  if (!placaN || placaN.length < 7) {
    throw new Error('Placa inválida');
  }
  if (!renavamN || renavamN.length < 9) {
    throw new Error('RENAVAM inválido (informe no cadastro do veículo)');
  }

  /** @type {{ fonte: string, fn: () => Promise<object> }[]} */
  const tentativas = [];
  if (INFOSIMPLES_ENABLED && INFOSIMPLES_TOKEN) {
    tentativas.push({
      fonte: 'infosimples',
      fn: () => consultarInfosimples(placaN, renavamN),
    });
  }
  if (MULTAS_API_URL) {
    tentativas.push({
      fonte: 'api-multas',
      fn: () => consultarViaApiMultas(placaN, renavamN),
    });
  }
  if (DETRAN_DF_USER_KEY) {
    tentativas.push({
      fonte: 'detran-df-direto',
      fn: () => consultarDiretoDetranDf(placaN, renavamN),
    });
  }

  if (!tentativas.length) {
    throw new Error(
      'Nenhuma fonte de multas ativa (Infosimples desligada ou sem DETRAN_DF_USER_KEY / MULTAS_API_URL)',
    );
  }

  const inicio = Date.now();
  const erros = [];

  for (const t of tentativas) {
    try {
      const bruto = await t.fn();
      const normalizado = normalizarRespostaDetran(bruto, placaN, renavamN);
      logger.info(
        'detran-df',
        `${placaN} → ${normalizado.multas.length} multa(s) em ${Date.now() - inicio}ms (${t.fonte})`,
      );
      return {
        ...normalizado,
        fonte: t.fonte,
        consultado_em: new Date().toISOString(),
      };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const cause = e?.cause?.code || e?.cause?.message || '';
      let msg = raw;
      if (/ECONNRESET|ETIMEDOUT|fetch failed|aborted|UND_ERR/i.test(`${raw} ${cause}`)) {
        msg = `Falha de rede/timeout em ${t.fonte}`;
      }
      erros.push(`${t.fonte}: ${msg}`);
      logger.warn('detran-df', `falha ${placaN} via ${t.fonte}: ${msg}`, {
        cause: cause || undefined,
      });
    }
  }

  throw new Error(erros.join(' · '));
}

export function infosimplesConfigurado() {
  return Boolean(INFOSIMPLES_ENABLED && INFOSIMPLES_TOKEN);
}

/** Alguma fonte de consulta de multas está disponível? */
export function fonteMultasConfigurada() {
  return Boolean(
    (INFOSIMPLES_ENABLED && INFOSIMPLES_TOKEN) || MULTAS_API_URL || DETRAN_DF_USER_KEY,
  );
}
