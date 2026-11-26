/**
 * Cliente da API oficial de vendas do BK Office.
 *
 * POST /BKOfficeAPI/Report/salePaymentComplete
 * Authorization: Basic ${BKOFFICE_API_TOKEN}  — lido só do ambiente, nunca logado.
 * Janela do dia civil D: dateInt D T12:00:00.000Z, dateEnd D T15:00:00.000Z.
 * Corpo: restaurant.cnpj, dateInt, dateEnd, pagination.page (string).
 * A resposta traz listPayment e transactionStatus. A página acaba quando listPayment vem vazio.
 */

export const URL_PADRAO =
  'https://bkoffice-franquia.burgerking.com.br/BKOfficeAPI/Report/salePaymentComplete';

export const TENTATIVAS_PADRAO = 5;
export const TIMEOUT_MS_PADRAO = 30000;

/** CNPJ confirmado quando o cadastro da loja ainda está vazio. Ceilândia não entra aqui. */
export const CNPJ_POR_NOME = [{ teste: /taquari/i, cnpj: '35252660000144' }];

export const DATAS_REIMPORT_PADRAO = [
  '2026-11-09',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
  '2026-11-14',
  '2026-11-16',
  '2026-11-17',
  '2026-11-20',
  '2026-11-21',
  '2026-11-22',
  '2026-11-23',
];

const USER_AGENT = 'grupo-alvim';

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000;
}

export function numeroApi(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function dataCivilSP(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function horaMinutoSP(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hora = String(parts.hour || '00').padStart(2, '0');
  const minuto = String(parts.minute || '00').padStart(2, '0');
  return `${hora}:${minuto}`;
}

export function addDiasISO(iso, delta) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function diaAnteriorCivil(iso) {
  return addDiasISO(iso, -1);
}

export function janelaDiaCivil(iso) {
  const dia = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
    throw Object.assign(new Error('Data civil inválida'), { status: 400 });
  }
  return {
    dateInt: `${dia}T12:00:00.000Z`,
    dateEnd: `${dia}T15:00:00.000Z`,
  };
}

export function deveDispararJobDiario({
  horaMinuto,
  diaCivil,
  ultimoDiaDisparado = null,
  horario = '05:00',
  limite = null,
} = {}) {
  if (!horaMinuto || !diaCivil || !horario) return false;
  if (String(horaMinuto) < String(horario)) return false;
  // Depois do limite não recupera o dia anterior (evita refazer baixa no meio do dia).
  if (limite && String(horaMinuto) >= String(limite)) return false;
  if (ultimoDiaDisparado === diaCivil) return false;
  return true;
}

export function lerTokenApi(env = process.env) {
  const token = String(env.BKOFFICE_API_TOKEN || '').trim();
  if (!token) {
    throw Object.assign(new Error('BKOFFICE_API_TOKEN não definida'), {
      status: 500,
      code: 'TOKEN_AUSENTE',
    });
  }
  if (/^basic\s+/i.test(token)) {
    throw Object.assign(
      new Error('BKOFFICE_API_TOKEN deve ser só o token, sem o prefixo Basic'),
      { status: 500, code: 'TOKEN_FORMATO' },
    );
  }
  return token;
}

export function semToken(texto, token) {
  const s = String(texto || '');
  if (!token) return s;
  return s.split(token).join('[redacted]');
}

export function cnpjDigitos(v) {
  return String(v || '').replace(/\D/g, '');
}

export function cnpjEfetivoLoja(loja) {
  const digits = cnpjDigitos(loja?.cnpj);
  if (digits.length === 14) return digits;
  const blob = `${loja?.name || ''} ${loja?.city || ''} ${loja?.neighborhood || ''}`;
  for (const regra of CNPJ_POR_NOME) {
    if (regra.teste.test(blob)) return regra.cnpj;
  }
  return digits;
}

export function classificarLojaBkOffice(loja) {
  const name = String(loja?.name || '');
  const norm = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/popeyes|popyes/.test(norm)) {
    return {
      incluir: false,
      motivo: 'popeyes',
      mensagem: 'Loja Popeyes fora da API BK Office',
    };
  }
  const cnpj = cnpjEfetivoLoja(loja);
  if (cnpj.length !== 14) {
    return {
      incluir: false,
      motivo: 'sem_cnpj',
      mensagem: 'Loja sem CNPJ',
    };
  }
  return { incluir: true, motivo: 'bk', cnpj, mensagem: null };
}

function semAcento(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function descricaoNaoAutorizado(description) {
  const n = semAcento(description);
  return n.includes('CNPJ INCORRETO OU USUARIO NAO AUTORIZADO');
}

function campo(obj, nome) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, nome)) return obj[nome];
  const alvo = nome.toLowerCase();
  const chave = Object.keys(obj).find((k) => k.toLowerCase() === alvo);
  return chave ? obj[chave] : undefined;
}

export function normalizarItemApi(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // codMerc vem com zeros à esquerda ('000000000007700076'); produtos.codigo é '7700076'.
  const codigo = String(
    raw.codMerc ?? raw.cod_merc ?? raw.codigo ?? raw.codigoProduto ?? raw.sku ?? '',
  )
    .trim()
    .replace(/^0+(?=\d)/, '');
  if (!codigo) return null;
  const qtde = numeroApi(raw.qtdVendidaItem ?? raw.qtde ?? raw.quantidade ?? raw.qtd);
  if (!(qtde > 0)) return null;
  const venda = numeroApi(
    raw.valorTotalItem ?? raw.valor_total_item ?? raw.valorTotal ?? raw.bruto ?? raw.venda_liquida,
  );
  const desconto = numeroApi(raw.desconto ?? raw.valorDesconto ?? raw.valor_desconto);
  const descricao = String(
    raw.descricao ?? raw.item ?? raw.descMerc ?? raw.descricaoMerc ?? raw.nome ?? raw.produto ?? '',
  ).trim();
  return {
    codigo,
    descricao,
    qtde,
    venda_liquida: venda == null ? 0 : venda,
    desconto: desconto == null ? 0 : desconto,
  };
}

function linhasDaLista(lista) {
  const out = [];
  for (const raw of lista) {
    if (!raw || typeof raw !== 'object') continue;
    if (normalizarItemApi(raw)) {
      out.push(raw);
      continue;
    }
    let aninhou = false;
    for (const valor of Object.values(raw)) {
      if (!Array.isArray(valor)) continue;
      for (const filho of valor) {
        if (normalizarItemApi(filho)) {
          out.push(filho);
          aninhou = true;
        }
      }
    }
    if (!aninhou) out.push(raw);
  }
  return out;
}

function checarTransactionStatus(body) {
  const statusTx = campo(body, 'transactionStatus') || {};
  const status = campo(statusTx, 'status');
  const description = String(campo(statusTx, 'description') || '');
  if (status === false && descricaoNaoAutorizado(description)) {
    throw erroNaoAutorizado();
  }
  if (status === false) {
    throw Object.assign(
      new Error(description || 'API BK Office recusou a consulta'),
      { code: 'API_RECUSADA', retryable: false },
    );
  }
}

export function extrairPaginaApiSales(body) {
  checarTransactionStatus(body);
  const vendas = campo(body, 'apiSales');
  if (vendas != null && !Array.isArray(vendas)) {
    throw Object.assign(new Error('apiSales da API BK Office não é uma lista'), {
      code: 'RESPOSTA_INVALIDA',
      retryable: false,
    });
  }
  const lista = vendas || [];
  const pag = campo(body, 'pagination') || {};
  const end = Number(campo(pag, 'end'));
  const total = Number(campo(pag, 'totalItens'));
  const itens = [];
  for (const venda of lista) {
    for (const raw of (venda && campo(venda, 'itens')) || []) {
      const item = normalizarItemApi(raw);
      if (item) itens.push(item);
    }
  }
  const temProxima =
    lista.length > 0 && Number.isFinite(end) && Number.isFinite(total) && end < total;
  return { itens, temProxima, vendas: lista.length, totalItens: Number.isFinite(total) ? total : null };
}

/**
 * Página oficial: listPayment + transactionStatus.
 * listPayment null ou [] encerra a paginação.
 * status false com "CNPJ INCORRETO OU USUÁRIO NÃO AUTORIZADO" é loja não autorizada.
 */
export function extrairPaginaVendas(body) {
  // Resposta real de /salePaymentComplete: listPayment sempre null; as vendas vêm em
  // apiSales[].itens[] e a paginação em pagination { initial, end, totalItens, page }.
  if (body && typeof body === 'object' && !Array.isArray(body) && campo(body, 'apiSales') !== undefined) {
    return extrairPaginaApiSales(body);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('listPayment' in body || 'ListPayment' in body)) {
    const temLista =
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      Object.keys(body).some((k) => k.toLowerCase() === 'listpayment');
    if (!temLista) {
      throw Object.assign(new Error('Resposta da API BK Office sem listPayment'), {
        code: 'RESPOSTA_INVALIDA',
        retryable: false,
      });
    }
  }

  const statusTx = campo(body, 'transactionStatus') || {};
  const status = campo(statusTx, 'status');
  const description = String(campo(statusTx, 'description') || '');
  if (status === false && descricaoNaoAutorizado(description)) {
    throw erroNaoAutorizado();
  }
  if (status === false) {
    throw Object.assign(
      new Error(description || 'API BK Office recusou a consulta'),
      { code: 'API_RECUSADA', retryable: false },
    );
  }

  const lista = campo(body, 'listPayment');
  if (lista == null) {
    return { itens: [], temProxima: false };
  }
  if (!Array.isArray(lista)) {
    throw Object.assign(new Error('listPayment da API BK Office não é uma lista'), {
      code: 'RESPOSTA_INVALIDA',
      retryable: false,
    });
  }
  if (!lista.length) {
    return { itens: [], temProxima: false };
  }

  const itens = [];
  for (const raw of linhasDaLista(lista)) {
    const item = normalizarItemApi(raw);
    if (item) itens.push(item);
  }
  return { itens, temProxima: true };
}

export function agregarItensVendaApi(itens) {
  const map = new Map();
  for (const raw of itens || []) {
    const n = raw?.codigo && raw?.qtde != null ? raw : normalizarItemApi(raw);
    if (!n || !(Number(n.qtde) > 0) || !n.codigo) continue;
    const prev = map.get(n.codigo);
    if (!prev) {
      map.set(n.codigo, {
        codigo: n.codigo,
        descricao: n.descricao || '',
        qtde: round4(n.qtde),
        venda_liquida: round2(n.venda_liquida || 0),
        desconto: round2(n.desconto || 0),
      });
      continue;
    }
    prev.qtde = round4(prev.qtde + Number(n.qtde));
    prev.venda_liquida = round2((prev.venda_liquida || 0) + (Number(n.venda_liquida) || 0));
    prev.desconto = round2((prev.desconto || 0) + (Number(n.desconto) || 0));
    if (!prev.descricao && n.descricao) prev.descricao = n.descricao;
  }
  return [...map.values()];
}

export function resumirItens(itens) {
  let qtde = 0;
  let bruto = 0;
  let desconto = 0;
  for (const i of itens || []) {
    qtde += Number(i.qtde) || 0;
    bruto += Number(i.venda_liquida) || 0;
    desconto += Number(i.desconto) || 0;
  }
  return {
    linhas: (itens || []).filter((i) => (Number(i.qtde) || 0) > 0 || i.codigo).length,
    qtde: round4(qtde),
    bruto: round2(bruto),
    desconto: round2(desconto),
  };
}

export function escolherFonteAtual(linhas) {
  const lista = linhas || [];
  const temApi = lista.some((l) => l.origem === 'bkoffice_api');
  if (temApi) return lista.filter((l) => l.origem === 'bkoffice_api');
  return lista.filter((l) => !l.origem || l.origem === 'bkoffice');
}

export function diffReimportacao(atuais, novos) {
  const antes = resumirItens(escolherFonteAtual(atuais));
  const depois = resumirItens(novos);
  return {
    antes,
    depois,
    linhas_delta: depois.linhas - antes.linhas,
    bruto_delta: round2(depois.bruto - antes.bruto),
    qtde_delta: round4(depois.qtde - antes.qtde),
  };
}

/**
 * Plano de substituição dos itens de um dia. A chave é o código:
 * reprocessar o mesmo payload não cria linha duplicada.
 */
export function montarPlanoItens(existentes, novos) {
  const porNovo = new Map();
  for (const n of agregarItensVendaApi(novos)) {
    porNovo.set(n.codigo, n);
  }
  const vistos = new Set();
  const acoes = [];
  for (const ex of existentes || []) {
    const codigo = String(ex.codigo || '').trim();
    if (!codigo) continue;
    const novo = porNovo.get(codigo);
    if (!novo) {
      acoes.push({
        acao: ex.processado ? 'zerar' : 'apagar',
        codigo,
        id_item: ex.id_item ?? null,
        qtdeAntes: Number(ex.qtde) || 0,
        processado: !!ex.processado,
      });
      continue;
    }
    vistos.add(codigo);
    const qtde = Number(novo.qtde) || 0;
    const qtdeAntes = Number(ex.qtde) || 0;
    acoes.push({
      acao: 'atualizar',
      codigo,
      id_item: ex.id_item ?? null,
      qtde,
      qtdeAntes,
      deltaQ: round4(qtde - qtdeAntes),
      venda_liquida: novo.venda_liquida ?? null,
      desconto: novo.desconto ?? null,
      descricao: novo.descricao || ex.descricao || '',
      processado: !!ex.processado,
    });
  }
  for (const [codigo, novo] of porNovo) {
    if (vistos.has(codigo)) continue;
    acoes.push({
      acao: 'inserir',
      codigo,
      qtde: Number(novo.qtde) || 0,
      venda_liquida: novo.venda_liquida ?? null,
      desconto: novo.desconto ?? null,
      descricao: novo.descricao || '',
      deltaQ: Number(novo.qtde) || 0,
      processado: false,
    });
  }
  return acoes;
}

export function aplicarPlanoItens(existentes, plano) {
  const map = new Map();
  for (const ex of existentes || []) {
    const codigo = String(ex.codigo || '').trim();
    if (codigo) map.set(codigo, { ...ex, codigo });
  }
  for (const a of plano || []) {
    if (a.acao === 'apagar' || a.acao === 'zerar') {
      map.delete(a.codigo);
      continue;
    }
    const prev = map.get(a.codigo);
    map.set(a.codigo, {
      codigo: a.codigo,
      qtde: a.qtde,
      venda_liquida: a.venda_liquida,
      desconto: a.desconto,
      descricao: a.descricao || '',
      processado: false,
      id_item: prev?.id_item ?? a.id_item ?? null,
    });
  }
  return [...map.values()].sort((x, y) => String(x.codigo).localeCompare(String(y.codigo)));
}

function erroNaoAutorizado() {
  return Object.assign(new Error('Loja não autorizada na API BK Office'), {
    code: 'NAO_AUTORIZADO',
    retryable: false,
  });
}

export function interpretarRespostaApi(status, text) {
  const corpo = String(text || '');
  if (status === 401 || status === 403) {
    throw Object.assign(new Error(`API BK Office recusou a autenticação (HTTP ${status})`), {
      code: 'AUTH_FALHOU',
      status,
      retryable: false,
    });
  }
  if (status === 429 || status >= 500) {
    throw Object.assign(new Error(`API BK Office HTTP ${status}`), {
      code: 'HTTP_TRANSITORIO',
      status,
      retryable: true,
    });
  }
  if (status < 200 || status >= 300) {
    throw Object.assign(new Error(`API BK Office HTTP ${status}`), {
      code: 'HTTP_ERRO',
      status,
      retryable: false,
    });
  }
  let json = {};
  if (corpo.trim()) {
    try {
      json = JSON.parse(corpo);
    } catch {
      throw Object.assign(new Error('API BK Office devolveu corpo inválido'), {
        code: 'RESPOSTA_INVALIDA',
        retryable: false,
      });
    }
  }
  return extrairPaginaVendas(json);
}

async function pedirPagina({ url, token, corpo, fetchImpl, timeoutMs }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${token}`,
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    const text = await res.text();
    return { status: res.status, text };
  } catch (e) {
    if (e?.name === 'AbortError') {
      throw Object.assign(new Error('timeout na API BK Office'), {
        retryable: true,
        code: 'TIMEOUT',
      });
    }
    throw Object.assign(new Error('falha de rede na API BK Office'), {
      retryable: true,
      code: 'REDE',
    });
  } finally {
    clearTimeout(timer);
  }
}

async function comRetry(fn, { tentativas, sleep, log, rotulo, token }) {
  let ultimo;
  for (let attempt = 1; attempt <= tentativas; attempt += 1) {
    try {
      return await fn();
    } catch (e) {
      ultimo = e;
      if (!e?.retryable || attempt >= tentativas) {
        if (e?.message) e.message = semToken(e.message, token);
        throw e;
      }
      const wait = Math.min(30000, 1000 * 2 ** (attempt - 1));
      log.warn(
        `[bkoffice-api] ${rotulo} falhou (${attempt}/${tentativas}): ${semToken(e.message, token)} — retry em ${wait}ms`,
      );
      await sleep(wait);
    }
  }
  throw ultimo;
}

/**
 * Baixa todas as páginas de um CNPJ em um dia civil e agrega por codMerc.
 */
export async function listarVendasDia({
  cnpj,
  data,
  token,
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  pageStart = 1,
  maxAttempts = TENTATIVAS_PADRAO,
  timeoutMs = TIMEOUT_MS_PADRAO,
  maxPages = 400,
  url = URL_PADRAO,
  log = console,
} = {}) {
  const cnpjOk = cnpjDigitos(cnpj);
  if (cnpjOk.length !== 14) {
    throw Object.assign(new Error('CNPJ inválido'), { status: 400, code: 'CNPJ_INVALIDO' });
  }
  const segredo = token || lerTokenApi();
  const janela = janelaDiaCivil(data);
  const brutos = [];
  let page = pageStart;
  let paginas = 0;
  let incompleto = false;

  while (paginas < maxPages) {
    const corpo = {
      restaurant: { cnpj: cnpjOk },
      dateInt: janela.dateInt,
      dateEnd: janela.dateEnd,
      pagination: { page: String(page) },
    };
    const pagina = await comRetry(
      async () => {
        const res = await pedirPagina({
          url,
          token: segredo,
          corpo,
          fetchImpl,
          timeoutMs,
        });
        return interpretarRespostaApi(res.status, res.text);
      },
      {
        tentativas: maxAttempts,
        sleep,
        log,
        rotulo: `CNPJ ${cnpjOk.slice(-4)} página ${page}`,
        token: segredo,
      },
    );
    paginas += 1;
    brutos.push(...pagina.itens);
    if (!pagina.temProxima) {
      incompleto = false;
      break;
    }
    incompleto = true;
    page += 1;
  }

  if (incompleto) {
    throw Object.assign(new Error('Paginação da API BK Office não terminou'), {
      code: 'PAGINACAO_INCOMPLETA',
    });
  }

  const itens = agregarItensVendaApi(brutos);
  return { itens, paginas, registros: brutos.length };
}

/**
 * Percorre lojas e datas. Falha de uma loja não interrompe as outras.
 * Autenticação inválida (token) interrompe o lote.
 */
export async function executarImportacaoLojas({ lojas, datas, buscarDia, onDia = null } = {}) {
  const relatorio = [];
  for (const loja of lojas || []) {
    const cls = classificarLojaBkOffice(loja);
    if (!cls.incluir) {
      relatorio.push({
        id_loja: loja.id_loja ?? null,
        name: loja.name || '',
        bk_number: loja.bk_number || null,
        data: null,
        status: cls.motivo,
        mensagem: cls.mensagem,
        itens: [],
      });
      continue;
    }
    for (const data of datas || []) {
      try {
        const bruto = await buscarDia({ loja, data, cnpj: cls.cnpj });
        const lista = Array.isArray(bruto) ? bruto : bruto?.itens || [];
        const itens = agregarItensVendaApi(lista);
        if (!itens.length) {
          // Segurança: API sem nenhum item não zera o dia nem desfaz baixa.
          relatorio.push({
            id_loja: loja.id_loja,
            name: loja.name || '',
            bk_number: loja.bk_number || null,
            cnpj: cls.cnpj,
            data,
            status: 'vazio',
            mensagem: 'API sem vendas no dia — mantido o que já existe',
            itens: [],
            linhas: 0,
          });
          continue;
        }
        if (onDia) await onDia({ loja, data, cnpj: cls.cnpj, itens });
        relatorio.push({
          id_loja: loja.id_loja,
          name: loja.name || '',
          bk_number: loja.bk_number || null,
          cnpj: cls.cnpj,
          data,
          status: 'ok',
          mensagem: null,
          linhas: itens.length,
          ...resumirItens(itens),
          itens,
        });
      } catch (e) {
        if (e?.code === 'AUTH_FALHOU' || e?.code === 'TOKEN_AUSENTE' || e?.code === 'TOKEN_FORMATO') {
          throw e;
        }
        relatorio.push({
          id_loja: loja.id_loja,
          name: loja.name || '',
          bk_number: loja.bk_number || null,
          cnpj: cls.cnpj,
          data,
          status: e?.code === 'NAO_AUTORIZADO' ? 'nao_autorizado' : 'erro',
          mensagem: e?.message || String(e),
          itens: [],
          linhas: 0,
        });
      }
    }
  }
  return relatorio;
}
