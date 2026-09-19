/**
 * Cliente Gimba Corporate (gimbaempresas.com.br).
 * Login do contrato + listagem de NF + XML em notasfiscais.gimba.com.br.
 */
import { chaveDentroDaJanela, dataDentroDaJanela } from '../estoquePersistirNfe.js';

const BASE = 'https://gimbaempresas.com.br';
const NF_URL = 'https://notasfiscais.gimba.com.br/notasfiscais.asp';

function cookieJar() {
  const jar = new Map();
  return {
    save(res) {
      const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
      for (const c of raw) {
        const [nv] = c.split(';');
        const eq = nv.indexOf('=');
        if (eq > 0) jar.set(nv.slice(0, eq).trim(), nv.slice(eq + 1).trim());
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

async function req(jar, url, { method = 'GET', body, accept } = {}) {
  const headers = {
    Cookie: jar.header(),
    Accept: accept || (method === 'POST' ? 'application/json, text/javascript, */*; q=0.01' : '*/*'),
    'X-Requested-With': 'XMLHttpRequest',
    Origin: BASE,
    Referer: `${BASE}/NotaFiscal/NotaFiscalListagem`,
  };
  if (method === 'POST') headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? new URLSearchParams(body).toString() : undefined,
    redirect: 'follow',
  });
  jar.save(res);
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, url: res.url, buf, text: buf.toString('utf8') };
}

function dataIso(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function loginGimba({ user, pass, onLog = () => {} } = {}) {
  if (!user || !pass) {
    throw Object.assign(new Error('Informe usuário e senha da Gimba'), { status: 400 });
  }
  const jar = cookieJar();
  await req(jar, `${BASE}/`);
  const login = await req(jar, `${BASE}/`, {
    method: 'POST',
    body: { Email: String(user).trim(), Senha: String(pass) },
  });
  let data;
  try {
    data = JSON.parse(login.text);
  } catch {
    throw Object.assign(new Error('Login Gimba: resposta inválida'), { status: 502 });
  }
  if (!data.success) {
    throw Object.assign(new Error(data.message || 'Login Gimba falhou — confira usuário e senha'), {
      status: 401,
    });
  }
  const idContrato = Number(data.model?.IdContrato) || 0;
  onLog(`login Gimba Corporate contrato=${idContrato || '?'}`);
  return { jar, idContrato, redirect: data.RedirectURL || '/PortalLogado/PainelControle?IndLogin=true' };
}

async function listarNotas({ jar, idContrato, dias = 90, onLog = () => {} } = {}) {
  const fim = new Date();
  const ini = new Date();
  ini.setDate(ini.getDate() - Number(dias || 90));
  const r = await req(jar, `${BASE}/NotaFiscal/NotaFiscalListagem_Pesquisa`, {
    method: 'POST',
    body: {
      IdContrato: String(idContrato || 0),
      IdContratoClienteSubGrupo: '0',
      Filtro_DtInicio: dataIso(ini),
      Filtro_DtFim: dataIso(fim),
      NumNF: '',
      draw: '1',
      start: '0',
      length: '200',
    },
  });
  let data;
  try {
    data = JSON.parse(r.text);
  } catch {
    throw Object.assign(new Error('Listagem de NF Gimba: JSON inválido'), { status: 502 });
  }
  if (data.success === false) {
    throw Object.assign(new Error(data.message || 'Listagem de NF Gimba falhou'), { status: 502 });
  }
  const lista = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
  onLog(`NFs Gimba=${lista.length}`);
  return lista;
}

async function baixarXml({ numero, cnpj }) {
  const qs = new URLSearchParams({
    nota: String(numero || '').replace(/\D/g, ''),
    cpfcnpj: String(cnpj || '').replace(/\D/g, ''),
    tipo: 'xml',
  });
  const res = await fetch(`${NF_URL}?${qs}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = buf.toString('utf8');
  if (!/infNFe|NFe/i.test(text)) {
    throw new Error(`XML Gimba inválido NF ${numero}`);
  }
  return text;
}

/**
 * @returns {Promise<Array<{ chave?: string, xml?: string, nfe: object }>>}
 */
export async function baixarNfesGimba({
  user,
  pass,
  dias = 90,
  meses = 3,
  limit = 80,
  onLog = () => {},
} = {}) {
  const { jar, idContrato } = await loginGimba({ user, pass, onLog });
  await req(jar, `${BASE}/NotaFiscal/NotaFiscalListagem`);
  const notas = await listarNotas({ jar, idContrato, dias, onLog });
  const alvo = Math.max(1, Number(limit) || 80);
  const downloads = [];
  const vistos = new Set();

  for (const row of notas) {
    if (downloads.length >= alvo) break;
    const numero = String(row.NumNF || row.numNF || '').replace(/\D/g, '');
    const cnpj = String(row.CNPJ || row.cnpj || '').replace(/\D/g, '');
    const chave = String(row.ChaveAcesso || row.chaveAcesso || '').replace(/\D/g, '');
    const emissao = String(row.DTEntSaida || row.DtEntSaida || row.DataEmissao || '').slice(0, 10);
    if (!numero && chave.length !== 44) continue;
    if (chave && !chaveDentroDaJanela(chave, meses)) continue;
    if (emissao && !dataDentroDaJanela(emissao, dias)) continue;
    const id = chave || `${numero}:${cnpj}`;
    if (vistos.has(id)) continue;
    vistos.add(id);

    let xml = '';
    try {
      xml = await baixarXml({ numero, cnpj });
    } catch (e) {
      onLog(`XML NF ${numero}: ${e.message}`);
    }
    downloads.push({
      chave: chave.length === 44 ? chave : '',
      xml,
      nfe: {
        numero,
        chave: chave.length === 44 ? chave : '',
        serie: String(row.Serie || ''),
        emissao,
        cnpjCliente: cnpj,
        emitenteNome: String(row.EmpresaRazaoSocial || 'GIMBA'),
        valor: Number(String(row.VlrTotalNF || '0').replace(/\./g, '').replace(',', '.')) || 0,
        pedido: '',
        itens: [],
      },
    });
    onLog(`NF Gimba ${numero || chave}`);
  }
  return downloads;
}
