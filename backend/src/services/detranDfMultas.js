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
 * @property {string|null} hora_infracao
 * @property {string|null} data_vencimento
 * @property {string|null} situacao
 * @property {string|null} orgao
 * @property {number|null} pontos
 * @property {string|null} natureza
 * @property {number|null} velocidade_aferida
 * @property {number|null} velocidade_permitida
 * @property {string|null} responsavel_infracao
 * @property {string|null} data_notificacao_autuacao
 */

/** Consulta de débitos IPVA/Licenciamento DETRAN. Docs: https://infosimples.com/consultas/detran-df-debitos/ */
const INFOSIMPLES_DEBITOS_CONSULTA =
  envStr('INFOSIMPLES_DETRAN_DF_DEBITOS_CONSULTA') || 'detran/df/debitos';
/** IPVA SEFAZ-DF. Docs: https://infosimples.com/consultas/sefaz-df-ipva/ */
const INFOSIMPLES_SEFAZ_IPVA_CONSULTA =
  envStr('INFOSIMPLES_SEFAZ_DF_IPVA_CONSULTA') || 'sefaz/df/ipva';
/** Infosimples: 0 funciona; 1 costuma retornar 612 (sem dados). */
const INFOSIMPLES_SEFAZ_IPVA_ANOS_ANTERIORES = (() => {
  const raw = envStr('INFOSIMPLES_SEFAZ_DF_IPVA_ANOS_ANTERIORES');
  if (raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
})();

function parseValor(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/R\$\s*/gi, '').trim();
  // Formato BR (1.234,56) vs decimal com ponto (1234.56)
  if (/,\d{1,2}$/.test(s) || /\d+\.\d{3},\d/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  s = s.replace(/[^\d.-]/g, '');
  const n = Number(s);
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

function parseHora(s) {
  if (s == null || s === '') return null;
  const t = String(s).trim();
  const m = t.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}${m[3] ? `:${m[3]}` : ''}`;
}

function mapInfracao(item, i) {
  const dataRaw =
    item.data_infracao ||
    item.data ||
    item.dataCometimento ||
    item.dataGoraInfracao ||
    item.dataInfracao ||
    null;
  const horaRaw =
    item.hora ||
    item.hora_infracao ||
    item.horaInfracao ||
    (typeof dataRaw === 'string' && /\d{1,2}:\d{2}/.test(dataRaw) ? dataRaw : null);

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
    data_infracao: parseDataBr(dataRaw),
    hora_infracao: parseHora(horaRaw),
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
    natureza:
      item.natureza ||
      item.grupo_infracao ||
      item.grupoInfracao ||
      item.grupo ||
      item.gravidade ||
      null,
    velocidade_aferida: parseValor(item.velocidade_aferida ?? item.velocidadeAferida),
    velocidade_permitida: parseValor(item.velocidade_permitida ?? item.velocidadePermitida),
    responsavel_infracao:
      item.responsavel_infracao ||
      item.responsavelInfracao ||
      item.responsavel ||
      item.nome_infrator ||
      item.nomeInfrator ||
      null,
    data_notificacao_autuacao: parseDataBr(
      item.data_notificacao_autuacao ||
        item.data_notificacao ||
        item.dataNotificacao ||
        item.dataNotificacaoAutuacao ||
        item.data_notificacao_autuacao ||
        null,
    ),
  };
}

function statusDebito({ quitado, isento, status }) {
  if (isento === true || /isento/i.test(String(status || ''))) return 'Isento';
  if (quitado === true || /quitad/i.test(String(status || ''))) return 'Quitado';
  if (/pago|paga/i.test(String(status || ''))) return 'Quitado';
  return 'Em Aberto';
}

function extrairBoleto(item) {
  if (!item || typeof item !== 'object') return null;
  const candidatos = [
    item.boleto_ipva,
    item.boletoIpva,
    item.boleto_licenciamento,
    item.boletoLicenciamento,
    item.boleto,
    item.boleto_pdf_url,
    item.boletoPdfUrl,
    item.url_boleto,
    item.urlBoleto,
    item.link_boleto,
    item.linkBoleto,
    item.linha_digitavel,
    item.linhaDigitavel,
    item.codigo_barras,
    item.codigoBarras,
  ];
  for (const c of candidatos) {
    if (c == null) continue;
    const s = String(c).trim();
    if (s) return s;
  }
  return null;
}

function mapLicenciamento(item, i) {
  const ano =
    item.ano_referencia ??
    item.anoReferencia ??
    item.ano_exercicio ??
    item.anoExercicio ??
    item.exercicio ??
    item.ano ??
    null;
  return {
    tipo: 'Licenciamento',
    ano_referencia: ano != null ? String(ano) : null,
    data_validade: parseDataBr(item.data_validade || item.dataValidade || item.validade),
    data_vencimento: parseDataBr(item.data_vencimento || item.dataVencimento || item.vencimento),
    valor_total: parseValor(item.valor_total ?? item.valorTotal ?? item.valor),
    valor_original: parseValor(item.valor_original ?? item.valorOriginal ?? item.valor_principal),
    valor_pago: parseValor(item.valor_pago ?? item.valorPago),
    valor_multa: parseValor(item.valor_multa ?? item.valorMulta),
    valor_mora: parseValor(item.valor_mora ?? item.valorMora ?? item.valor_juros),
    valor_outros: parseValor(item.valor_outros ?? item.valorOutros),
    valor_diferenca: parseValor(item.valor_diferenca ?? item.valorDiferenca),
    boleto: extrairBoleto(item),
    status: statusDebito({
      quitado: item.quitado,
      isento: item.isento,
      status: item.status || item.situacao,
    }),
    cota: item.cota != null ? String(item.cota) : null,
    razao_social: null,
    chave_unica: `LIC-${ano ?? i}-${item.data_vencimento || item.dataVencimento || ''}`,
  };
}

function mapIpvaItem(item, i, parentAno = null) {
  const ano =
    item.ano_referencia ??
    item.anoReferencia ??
    item.ano_exercicio ??
    item.anoExercicio ??
    item.exercicio ??
    item.ano ??
    parentAno ??
    null;
  const cota =
    item.cota_referencia ??
    item.cotaReferencia ??
    item.cota ??
    item.nome_cota ??
    null;
  const valorTotal = parseValor(
    item.valor_total ?? item.valorTotal ?? item.valor ?? item.valor_principal ?? item.valorPrincipal,
  );
  const valorOriginal = parseValor(
    item.valor_original ?? item.valorOriginal ?? item.valor_principal ?? item.valorPrincipal ?? item.valor,
  );
  return {
    tipo: 'IPVA',
    ano_referencia: ano != null ? String(ano) : null,
    data_validade: parseDataBr(item.data_validade || item.dataValidade || item.validade),
    data_vencimento: parseDataBr(item.data_vencimento || item.dataVencimento || item.vencimento),
    valor_total: valorTotal ?? valorOriginal,
    valor_original: valorOriginal,
    valor_pago: parseValor(item.valor_pago ?? item.valorPago),
    valor_multa: parseValor(item.valor_multa ?? item.valorMulta),
    valor_mora: parseValor(item.valor_mora ?? item.valorMora ?? item.valor_juros),
    valor_outros: parseValor(item.valor_outros ?? item.valorOutros),
    valor_diferenca: parseValor(item.valor_diferenca ?? item.valorDiferenca),
    boleto: extrairBoleto(item),
    status: statusDebito({
      quitado: item.quitado,
      isento: item.isento,
      status: item.status || item.situacao,
    }),
    cota: cota != null ? String(cota) : null,
    razao_social: null,
    chave_unica: `IPVA-${ano ?? i}-${cota ?? ''}-${item.data_vencimento || item.dataVencimento || ''}`,
  };
}

function extrairDebitos(payload) {
  const bloco = Array.isArray(payload?.data) ? payload.data[0] : payload?.data || payload;
  const debitos = bloco?.debitos && typeof bloco.debitos === 'object' ? bloco.debitos : bloco;
  if (!debitos || typeof debitos !== 'object') return [];

  const out = [];
  const licenca =
    debitos.licenciamentos ||
    debitos.debitos_licenciamento ||
    debitos.debitosLicenciamento ||
    debitos.licenciamento ||
    [];
  const listaLic = Array.isArray(licenca) ? licenca : licenca ? [licenca] : [];
  listaLic.forEach((item, i) => out.push(mapLicenciamento(item, i)));

  const ipva =
    debitos.debitos_ipva ||
    debitos.debitosIpva ||
    debitos.ipva ||
    [];
  const listaIpva = Array.isArray(ipva) ? ipva : ipva ? [ipva] : [];
  listaIpva.forEach((item, i) => {
    const cotas = item?.cotas || item?.parcelas;
    if (Array.isArray(cotas) && cotas.length) {
      const parentAno = item.ano_exercicio ?? item.anoExercicio ?? item.ano ?? null;
      const boletoPai = extrairBoleto(item);
      cotas.forEach((cota, j) => {
        const mapped = mapIpvaItem(
          { ...cota, boleto_ipva: extrairBoleto(cota) || boletoPai },
          j,
          parentAno,
        );
        out.push(mapped);
      });
    } else {
      out.push(mapIpvaItem(item, i));
    }
  });

  return out;
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
  const debitos = extrairDebitos(payload);

  return { placa, renavam, veiculo, multas, debitos, bruto: payload };
}

/** Normaliza payload Infosimples debitos (IPVA / Licenciamento). */
export function normalizarRespostaDebitos(payload, placa, renavam) {
  if (!payload || typeof payload !== 'object') {
    return { placa, renavam, veiculo: null, debitos: [], bruto: payload };
  }

  if (payload.message && payload.error) {
    const err = new Error(payload.message || 'Falha na consulta de débitos DETRAN-DF');
    err.detalhe = payload.error;
    throw err;
  }

  if (payload.code != null && ![200, 201].includes(Number(payload.code))) {
    const errs = Array.isArray(payload.errors) ? payload.errors.filter(Boolean) : [];
    const detalhe = errs.join('; ');
    const base = payload.code_message || `Infosimples retornou código ${payload.code}`;
    if (Number(payload.code) === 603 && detalhe) throw new Error(detalhe);
    throw new Error(detalhe || base);
  }

  return {
    placa,
    renavam,
    veiculo: extrairVeiculo(payload, placa, renavam),
    debitos: extrairDebitos(payload),
    bruto: payload,
  };
}

async function consultarInfosimples(opts = {}) {
  // Compat: consultarInfosimples(placa, renavam, path)
  if (typeof opts === 'string') {
    const placa = opts;
    const renavam = arguments[1];
    const path = arguments[2] || INFOSIMPLES_CONSULTA;
    return consultarInfosimples({ placa, renavam, path, requireGovLogin: /debitos/i.test(path) });
  }

  if (!INFOSIMPLES_TOKEN) {
    throw new Error('INFOSIMPLES_TOKEN não configurado no .env');
  }

  const path = opts.path || INFOSIMPLES_CONSULTA;
  const placa = opts.placa ? normalizarPlaca(opts.placa) : '';
  const renavam = opts.renavam ? normalizarRenavam(opts.renavam) : '';
  const requireGovLogin =
    opts.requireGovLogin != null ? Boolean(opts.requireGovLogin) : /debitos/i.test(path);

  const url = new URL(`${INFOSIMPLES_BASE}/${path}`);
  url.searchParams.set('token', INFOSIMPLES_TOKEN);
  if (placa) url.searchParams.set('placa', placa);
  if (renavam) url.searchParams.set('renavam', renavam);
  if (opts.anosAnteriores != null && opts.anosAnteriores !== '') {
    url.searchParams.set('anos_anteriores', String(opts.anosAnteriores));
  }

  if (requireGovLogin) {
    const loginCpf = envStr('INFOSIMPLES_LOGIN_CPF', 'DETRAN_DF_LOGIN_CPF', 'DETRAN_PORTAL_CPF').replace(
      /\D/g,
      '',
    );
    const loginSenha = envStr('INFOSIMPLES_LOGIN_SENHA', 'DETRAN_DF_LOGIN_SENHA', 'DETRAN_PORTAL_SENHA');
    if (!loginCpf || !loginSenha) {
      throw new Error(
        'Configure INFOSIMPLES_LOGIN_CPF e INFOSIMPLES_LOGIN_SENHA no .env (CPF e senha gov.br do portal DETRAN-DF) e reinicie o servidor',
      );
    }
    url.searchParams.set('login_cpf', loginCpf);
    url.searchParams.set('login_senha', loginSenha);
  }

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
      fn: () =>
        consultarInfosimples({
          path: INFOSIMPLES_CONSULTA,
          placa: placaN,
          renavam: renavamN,
          requireGovLogin: /debitos/i.test(INFOSIMPLES_CONSULTA),
        }),
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

/**
 * IPVA via Infosimples SEFAZ-DF (boleto PDF).
 * Docs: https://infosimples.com/consultas/sefaz-df-ipva/
 */
export async function consultarIpvaSefazDf({ renavam, placa, anosAnteriores } = {}) {
  const renavamN = normalizarRenavam(renavam);
  const placaN = placa ? normalizarPlaca(placa) : '';
  if (!renavamN || renavamN.length < 9) {
    throw new Error('RENAVAM inválido (informe no cadastro do veículo)');
  }
  if (!INFOSIMPLES_ENABLED || !INFOSIMPLES_TOKEN) {
    throw new Error('Infosimples não configurada para SEFAZ-DF IPVA');
  }

  const inicio = Date.now();
  const bruto = await consultarInfosimples({
    path: INFOSIMPLES_SEFAZ_IPVA_CONSULTA,
    renavam: renavamN,
    anosAnteriores:
      anosAnteriores != null ? anosAnteriores : INFOSIMPLES_SEFAZ_IPVA_ANOS_ANTERIORES,
    requireGovLogin: false,
  });

  if (bruto?.code != null && ![200, 201].includes(Number(bruto.code))) {
    const errs = Array.isArray(bruto.errors) ? bruto.errors.filter(Boolean) : [];
    const detalhe = errs.join('; ');
    const base = bruto.code_message || `Infosimples retornou código ${bruto.code}`;
    const msg = detalhe || base;
    // 612 / "nenhum registro" = veículo sem IPVA na fonte (não é falha de integração)
    if (
      Number(bruto.code) === 612 ||
      /nenhum registro|n[aã]o retornou dados|sem dados/i.test(msg)
    ) {
      logger.info('detran-df', `SEFAZ IPVA ${placaN || renavamN}: sem débitos (${msg})`);
      return {
        placa: placaN || null,
        renavam: renavamN,
        razao_social: null,
        modelo: null,
        debitos: [],
        fonte: 'infosimples-sefaz-ipva',
        consultado_em: new Date().toISOString(),
        bruto,
      };
    }
    if (Number(bruto.code) === 603 && detalhe) throw new Error(detalhe);
    throw new Error(msg);
  }

  const { debitos, razao_social, placa: placaApi, modelo } = extrairIpvaSefaz(bruto);
  logger.info(
    'detran-df',
    `SEFAZ IPVA ${placaN || renavamN} → ${debitos.length} cota(s) em ${Date.now() - inicio}ms`,
  );
  return {
    placa: placaN || placaApi || null,
    renavam: renavamN,
    razao_social,
    modelo,
    debitos,
    fonte: 'infosimples-sefaz-ipva',
    consultado_em: new Date().toISOString(),
    bruto,
  };
}

function extrairIpvaSefaz(payload) {
  const bloco = Array.isArray(payload?.data) ? payload.data[0] : payload?.data || payload;
  if (!bloco || typeof bloco !== 'object') {
    return { debitos: [], razao_social: null, placa: null, modelo: null };
  }
  const razao = bloco.razao_social || bloco.razaoSocial || null;
  const placa = bloco.placa ? normalizarPlaca(bloco.placa) : null;
  const modelo = bloco.modelo || null;
  const lista = Array.isArray(bloco.debitos) ? bloco.debitos : [];
  const debitos = lista.map((item, i) => {
    const ano = item.ano ?? item.ano_referencia ?? item.anoReferencia ?? null;
    const cota = item.cota != null ? String(item.cota) : null;
    const valorPrincipal = parseValor(item.valor_principal ?? item.valorPrincipal);
    const valorJuros = parseValor(item.valor_juros ?? item.valorJuros);
    const valorMulta = parseValor(item.valor_multa ?? item.valorMulta);
    const valorOutros = parseValor(item.valor_outros ?? item.valorOutros);
    let valorTotal = parseValor(item.valor_total ?? item.valorTotal);
    if (valorTotal == null) {
      const parts = [valorPrincipal, valorJuros, valorMulta, valorOutros].filter((n) => n != null);
      valorTotal = parts.length ? parts.reduce((a, b) => a + b, 0) : null;
    }
    return {
      tipo: 'IPVA',
      ano_referencia: ano != null ? String(ano) : null,
      data_validade: null,
      data_vencimento: null,
      valor_total: valorTotal,
      valor_original: valorPrincipal,
      valor_pago: null,
      valor_multa: valorMulta,
      valor_mora: valorJuros,
      valor_outros: valorOutros,
      valor_diferenca: null,
      boleto: item.boleto_pdf_url || item.boletoPdfUrl || extrairBoleto(item),
      status: statusDebito({
        quitado: item.quitado,
        isento: item.isento,
        status: item.status || item.situacao,
      }),
      cota,
      razao_social: razao,
      chave_unica: `IPVA-SEFAZ-${ano ?? 'x'}-${cota ?? 's'}-${valorTotal != null ? String(valorTotal) : i}`,
    };
  });
  return { debitos, razao_social: razao, placa, modelo };
}

/**
 * Licenciamento via Infosimples DETRAN-DF débitos (somente licenciamentos).
 * Docs: https://infosimples.com/consultas/detran-df-debitos/
 */
export async function consultarLicenciamentoDetranDf({ placa, renavam }) {
  const placaN = normalizarPlaca(placa);
  const renavamN = normalizarRenavam(renavam);
  if (!placaN || placaN.length < 7) throw new Error('Placa inválida');
  if (!renavamN || renavamN.length < 9) {
    throw new Error('RENAVAM inválido (informe no cadastro do veículo)');
  }
  if (!INFOSIMPLES_ENABLED || !INFOSIMPLES_TOKEN) {
    throw new Error('Infosimples não configurada para DETRAN-DF débitos');
  }

  const inicio = Date.now();
  const bruto = await consultarInfosimples({
    path: INFOSIMPLES_DEBITOS_CONSULTA,
    placa: placaN,
    renavam: renavamN,
    requireGovLogin: true,
  });
  const normalizado = normalizarRespostaDebitos(bruto, placaN, renavamN);
  const debitos = (normalizado.debitos || []).filter((d) => d.tipo === 'Licenciamento');
  logger.info(
    'detran-df',
    `${placaN} → ${debitos.length} licenciamento(s) em ${Date.now() - inicio}ms`,
  );
  return {
    ...normalizado,
    debitos,
    fonte: 'infosimples-detran-licenciamento',
    consultado_em: new Date().toISOString(),
  };
}

/**
 * @deprecated Preferir consultarIpvaSefazDf + consultarLicenciamentoDetranDf.
 * Mantido para compat: retorna IPVA (SEFAZ) + Licenciamento (DETRAN).
 */
export async function consultarDebitosDetranDf({ placa, renavam }) {
  const avisos = [];
  const debitos = [];
  let fonte = 'infosimples';
  let razao_social = null;

  try {
    const ipva = await consultarIpvaSefazDf({ placa, renavam });
    debitos.push(...(ipva.debitos || []));
    razao_social = ipva.razao_social || null;
    fonte = ipva.fonte || fonte;
  } catch (e) {
    avisos.push(`IPVA: ${e instanceof Error ? e.message : e}`);
  }

  try {
    const lic = await consultarLicenciamentoDetranDf({ placa, renavam });
    debitos.push(...(lic.debitos || []));
    fonte = `${fonte}+${lic.fonte || 'lic'}`;
  } catch (e) {
    avisos.push(`Licenciamento: ${e instanceof Error ? e.message : e}`);
  }

  if (!debitos.length && avisos.length) {
    throw new Error(avisos.join(' · '));
  }

  return {
    placa: normalizarPlaca(placa),
    renavam: normalizarRenavam(renavam),
    razao_social,
    debitos,
    avisos,
    fonte,
    consultado_em: new Date().toISOString(),
  };
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
