/**
 * Documentos fiscais para o Mycto.
 * Compra: estoque_nfe + XML em disco (xml_path) ou finance.nfe_recebida.
 * Venda: o MERIDIAN não guarda XML de NFC-e/SAT. A resposta existe para o contrato,
 * sem inventar documento.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { pool } from '../db.js';
import { logger } from '../logger.js';
import { getLogsDir } from '../projectPaths.js';
import { resolverXmlNfe } from '../financeiro/lib/platlogNfes.mjs';

export const MOTIVO_VENDA_SEM_XML =
  'O MERIDIAN não armazena o XML da NFC-e, do SAT nem da NF-e de venda. ' +
  'As vendas entram só como totais por produto e dia: BK Office (API getReportSales e planilha) ' +
  'e lançamento manual, nas tabelas estoque_vendas e finance.vendas_bk. ' +
  'A distribuição DF-e da SEFAZ grava nota destinada à loja (compra). ' +
  'Nota em que a loja é a emitente é descartada de propósito e não fica em disco nem em nfe_recebida.';

const FONTES_DISCO = ['sefaz-nfe', 'esupri-nfe', 'idealwork-nfe', 'gimba-nfe'];

function erro(status, message) {
  return Object.assign(new Error(message), { status });
}

function digitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

function tag(xml, name) {
  const re = new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${name}>`, 'i');
  const m = String(xml || '').match(re);
  return m ? m[1].trim() : '';
}

export function xmlPareceNfe(xml) {
  return /<(?:\w+:)?NFe[\s>]|<(?:\w+:)?nfeProc[\s>]/i.test(String(xml || ''));
}

export function cnpjsDoXml(xml) {
  if (!xmlPareceNfe(xml)) return { emitente_cnpj: null, destinatario_cnpj: null };
  const emit = tag(xml, 'emit');
  const dest = tag(xml, 'dest');
  const limpo = (bloco) => digitos(tag(bloco, 'CNPJ') || tag(bloco, 'CPF')) || null;
  return { emitente_cnpj: limpo(emit), destinatario_cnpj: limpo(dest) };
}

export function encodeCursor(atualizadoEm, id) {
  const iso = new Date(atualizadoEm).toISOString();
  if (Number.isNaN(Date.parse(iso))) throw erro(400, 'cursor inválido');
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) throw erro(400, 'cursor inválido');
  return Buffer.from(`${iso}|${n}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (cursor == null || cursor === '') return null;
  let raw = '';
  try {
    raw = Buffer.from(String(cursor), 'base64url').toString('utf8');
  } catch {
    throw erro(400, 'cursor inválido');
  }
  const sep = raw.lastIndexOf('|');
  if (sep <= 0) throw erro(400, 'cursor inválido');
  const iso = raw.slice(0, sep);
  const id = Number(raw.slice(sep + 1));
  if (Number.isNaN(Date.parse(iso)) || !Number.isInteger(id) || id < 1) {
    throw erro(400, 'cursor inválido');
  }
  return { atualizado_em: new Date(iso).toISOString(), id };
}

function parseDataEmissao(valor, nome) {
  if (valor == null || valor === '') return null;
  const s = String(valor).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw erro(400, `${nome} deve ser YYYY-MM-DD`);
  return s;
}

function parseInstante(valor, nome) {
  if (valor == null || valor === '') return null;
  const s = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00-03:00`);
    if (Number.isNaN(d.getTime())) throw erro(400, `${nome} inválido`);
    return d.toISOString();
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw erro(400, `${nome} inválido`);
  return d.toISOString();
}

function parseInteiro(valor, nome, { max = 2_000_000_000 } = {}) {
  if (valor == null || valor === '') return null;
  if (!/^\d{1,10}$/.test(String(valor).trim())) throw erro(400, `${nome} inválido`);
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1 || n > max) throw erro(400, `${nome} inválido`);
  return n;
}

export function lerFiltros(query = {}) {
  const tipo = String(query.tipo || 'compra').trim().toLowerCase();
  if (tipo !== 'compra' && tipo !== 'venda') {
    throw erro(400, 'tipo deve ser compra ou venda');
  }
  const de = parseDataEmissao(query.de, 'de');
  const ate = parseDataEmissao(query.ate, 'ate');
  if (de && ate && de > ate) throw erro(400, 'de não pode ser maior que ate');

  const limit = parseInteiro(query.limit ?? 100, 'limit', { max: 200 }) || 100;
  const cursor = query.cursor ? decodeCursor(query.cursor) : null;
  const desde = cursor ? null : parseInstante(query.desde, 'desde');
  const desdeId = cursor ? null : parseInteiro(query.desde_id, 'desde_id');

  const idLoja = parseInteiro(query.id_loja, 'id_loja');
  const lojaBruta = String(query.loja || '').trim();
  if (lojaBruta && !/^[\w.-]{1,32}$/.test(lojaBruta)) throw erro(400, 'loja inválida');

  const incluirXml = query.incluir_xml === '1' || query.incluir_xml === 'true';

  return {
    tipo,
    de,
    ate,
    limit: Math.min(200, Math.max(1, limit)),
    cursor,
    desde,
    desde_id: desdeId,
    id_loja: idLoja,
    loja: lojaBruta || null,
    incluir_xml: incluirXml,
  };
}

export function classificarRef(ref) {
  const bruto = decodeURIComponent(String(ref || '')).trim();
  const dig = digitos(bruto);
  if (dig.length === 44) return { chave: dig, id: null };
  if (/^\d{1,9}$/.test(bruto)) {
    const id = Number(bruto);
    if (id > 0) return { chave: null, id };
  }
  throw erro(400, 'Informe o id da nota ou a chave de acesso (44 dígitos).');
}

export function respostaVenda(filtros) {
  return {
    tipo: 'venda',
    xml_disponivel: false,
    motivo: MOTIVO_VENDA_SEM_XML,
    limit: filtros.limit,
    documentos: [],
    tem_mais: false,
    proximo_cursor: null,
    proximo_desde_id: null,
  };
}

function dinheiro(valor) {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function documentoDeLinha(row, { temXml }) {
  return {
    id: String(row.id_nfe),
    tipo: 'compra',
    chave: digitos(row.chave) || null,
    numero: row.numero || null,
    serie: row.serie || null,
    emissao: row.emissao ? String(row.emissao).slice(0, 10) : null,
    atualizado_em: row.atualizado_em ? new Date(row.atualizado_em).toISOString() : null,
    valor_total: dinheiro(row.valor_total),
    emitente_cnpj: digitos(row.emitente_cnpj) || null,
    destinatario_cnpj: digitos(row.destinatario_cnpj) || null,
    id_loja: row.id_loja,
    loja: row.loja || null,
    bk_number: row.bk_number || null,
    fonte: row.fornecedor || null,
    tem_xml: !!temXml,
  };
}

const SELECT_NOTA = `
  SELECT
    n.id_nfe,
    n.chave,
    n.numero,
    n.serie,
    to_char(n.emissao, 'YYYY-MM-DD') AS emissao,
    n.atualizado_em,
    n.valor_total,
    n.emitente_cnpj,
    n.fornecedor,
    n.xml_path,
    n.id_loja,
    l.name AS loja,
    l.bk_number,
    regexp_replace(coalesce(l.cnpj, ''), '\\D', '', 'g') AS destinatario_cnpj
  FROM estoque_nfe n
  JOIN lojas l ON l.id_loja = n.id_loja
`;

function caminhoXmlDireto(row) {
  const direto = resolverXmlNfe(row?.xml_path);
  if (direto && /\.xml$/i.test(direto)) return direto;
  return null;
}

function caminhosConvencionais(row) {
  const chave = digitos(row?.chave);
  const idLoja = row?.id_loja;
  if (chave.length !== 44 || !idLoja) return [];
  const logs = getLogsDir();
  return FONTES_DISCO.map((pasta) => path.join(logs, pasta, String(idLoja), `${chave}.xml`));
}

function peekXml(caminho) {
  if (!caminho || !/\.xml$/i.test(caminho) || !fs.existsSync(caminho)) return false;
  let fd;
  try {
    fd = fs.openSync(caminho, 'r');
    const buf = Buffer.alloc(8192);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return xmlPareceNfe(buf.slice(0, n).toString('utf8'));
  } catch {
    return false;
  } finally {
    if (fd != null) fs.closeSync(fd);
  }
}

export function lerXmlArquivo(arquivo) {
  const caminho = String(arquivo || '');
  if (!peekXml(caminho)) return null;
  try {
    const xml = fs.readFileSync(caminho, 'utf8');
    return xmlPareceNfe(xml) ? xml : null;
  } catch {
    return null;
  }
}

/** Só indica presença. Não carrega o XML inteiro (a lista pode ter dezenas de notas). */
export function temXmlNoDisco(row) {
  if (peekXml(caminhoXmlDireto(row))) return true;
  return caminhosConvencionais(row).some((arquivo) => peekXml(arquivo));
}

export function xmlNoDiscoDaNota(row) {
  const direto = lerXmlArquivo(caminhoXmlDireto(row));
  if (direto) return direto;
  for (const arquivo of caminhosConvencionais(row)) {
    const xml = lerXmlArquivo(arquivo);
    if (xml) return xml;
  }
  return null;
}

let financePool = null;

function poolFinanceSeDistinto() {
  const nome = String(process.env.FINANCE_DB_NAME || '').trim();
  const atual = String(process.env.DB_NAME || '').trim();
  if (!nome || nome === atual) return null;
  if (!process.env.DB_HOST || !process.env.DB_USER) return null;
  if (!financePool) {
    financePool = new pg.Pool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: nome,
      port: Number(process.env.DB_PORT || 5432),
      max: 2,
      connectionTimeoutMillis: 8000,
      ssl:
        process.env.DB_SSL === 'true' || process.env.DB_SSL === '1'
          ? { rejectUnauthorized: false }
          : undefined,
      options: '-c search_path=finance,public',
    });
    financePool.on('error', (err) => {
      logger.warn('mycto', 'Pool do financeiro', { error: err.message });
    });
  }
  return financePool;
}

async function consultarFinance(sql, params) {
  const alvos = [pool];
  const extra = poolFinanceSeDistinto();
  if (extra) alvos.push(extra);
  let ultimo = null;
  for (const alvo of alvos) {
    try {
      return await alvo.query(sql, params);
    } catch (err) {
      ultimo = err;
      if (['42P01', '3F000', '42703'].includes(err?.code)) continue;
      logger.warn('mycto', 'Consulta ao XML da Receita falhou', { error: err.message });
    }
  }
  if (ultimo && !['42P01', '3F000', '42703'].includes(ultimo.code)) {
    logger.warn('mycto', 'XML da Receita indisponível', { error: ultimo.message });
  }
  return { rows: [] };
}

async function chavesComXmlFinance(chaves) {
  const lista = [...new Set(chaves.map(digitos).filter((c) => c.length === 44))];
  if (!lista.length) return new Set();
  const { rows } = await consultarFinance(
    `SELECT regexp_replace(coalesce(chave, ''), '\\D', '', 'g') AS chave
     FROM finance.nfe_recebida
     WHERE regexp_replace(coalesce(chave, ''), '\\D', '', 'g') = ANY($1::text[])
       AND length(coalesce(xml, '')) > 100
       AND xml ~* '<([A-Za-z0-9]+:)?(NFe|nfeProc)[ >]'`,
    [lista],
  );
  return new Set(rows.map((r) => r.chave));
}

async function xmlFinancePorChave(chave) {
  const dig = digitos(chave);
  if (dig.length !== 44) return null;
  const { rows } = await consultarFinance(
    `SELECT xml
     FROM finance.nfe_recebida
     WHERE regexp_replace(coalesce(chave, ''), '\\D', '', 'g') = $1
       AND length(coalesce(xml, '')) > 100
       AND xml ~* '<([A-Za-z0-9]+:)?(NFe|nfeProc)[ >]'
     ORDER BY atualizado_em DESC NULLS LAST
     LIMIT 1`,
    [dig],
  );
  const xml = rows[0]?.xml;
  return xmlPareceNfe(xml) ? String(xml) : null;
}

export async function xmlDaNota(row) {
  return xmlNoDiscoDaNota(row) || (await xmlFinancePorChave(row?.chave));
}

function enriquecerComXml(doc, xml) {
  if (!xml) return doc;
  const cnpjs = cnpjsDoXml(xml);
  return {
    ...doc,
    emitente_cnpj: cnpjs.emitente_cnpj || doc.emitente_cnpj,
    destinatario_cnpj: cnpjs.destinatario_cnpj || doc.destinatario_cnpj,
    tem_xml: true,
  };
}

async function listarCompras(filtros) {
  const cursor = filtros.cursor;
  const porId = filtros.desde_id != null && !cursor && !filtros.desde;
  const ordem = porId
    ? 'ORDER BY n.id_nfe ASC'
    : 'ORDER BY n.atualizado_em ASC, n.id_nfe ASC';
  const params = [
    filtros.id_loja,
    filtros.loja,
    filtros.de,
    filtros.ate,
    filtros.desde_id,
    cursor?.atualizado_em || filtros.desde,
    cursor?.id || 0,
    filtros.limit + 1,
  ];
  const { rows } = await pool.query(
    `${SELECT_NOTA}
     WHERE ($1::int IS NULL OR n.id_loja = $1)
       AND (
         $2::text IS NULL
         OR l.bk_number = $2
         OR regexp_replace(coalesce(l.bk_number, ''), '\\D', '', 'g') = regexp_replace($2, '\\D', '', 'g')
       )
       AND ($3::date IS NULL OR n.emissao >= $3::date)
       AND ($4::date IS NULL OR n.emissao <= $4::date)
       AND ($5::int IS NULL OR n.id_nfe > $5)
       AND (
         $6::timestamptz IS NULL
         OR n.atualizado_em > $6::timestamptz
         OR (n.atualizado_em = $6::timestamptz AND n.id_nfe > $7::int)
       )
     ${ordem}
     LIMIT $8`,
    params,
  );

  const pagina = rows.slice(0, filtros.limit);
  const temMais = rows.length > filtros.limit;
  const comXmlFinance = await chavesComXmlFinance(pagina.map((r) => r.chave));
  const documentos = pagina.map((row) => {
    const noDisco = temXmlNoDisco(row);
    const naReceita = comXmlFinance.has(digitos(row.chave));
    return documentoDeLinha(row, { temXml: noDisco || naReceita });
  });
  const ultimo = documentos[documentos.length - 1];

  return {
    tipo: 'compra',
    xml_disponivel: true,
    limit: filtros.limit,
    documentos,
    tem_mais: temMais,
    proximo_cursor: ultimo ? encodeCursor(ultimo.atualizado_em, ultimo.id) : filtros.cursor ? encodeCursor(filtros.cursor.atualizado_em, filtros.cursor.id) : null,
    proximo_desde_id: ultimo ? Number(ultimo.id) : filtros.desde_id,
  };
}

async function buscarNota(ref) {
  const alvo = classificarRef(ref);
  const { rows } = await pool.query(
    `${SELECT_NOTA}
     WHERE ($1::int IS NOT NULL AND n.id_nfe = $1)
        OR ($2::text IS NOT NULL AND regexp_replace(coalesce(n.chave, ''), '\\D', '', 'g') = $2)
     ORDER BY
       CASE WHEN n.xml_path IS NOT NULL AND btrim(n.xml_path) <> '' THEN 0 ELSE 1 END,
       n.id_nfe DESC
     LIMIT 1`,
    [alvo.id, alvo.chave],
  );
  return rows[0] || null;
}

export async function listarDocumentos(query) {
  const filtros = lerFiltros(query);
  if (filtros.tipo === 'venda') return respostaVenda(filtros);
  return listarCompras(filtros);
}

export async function detalheDocumento(ref, query = {}) {
  const filtros = lerFiltros({ ...query, tipo: 'compra' });
  const row = await buscarNota(ref);
  if (!row) throw erro(404, 'Documento não encontrado.');
  const xml = await xmlDaNota(row);
  const doc = enriquecerComXml(documentoDeLinha(row, { temXml: !!xml }), xml);
  if (!filtros.incluir_xml) return doc;
  return { ...doc, xml: xml || null };
}

export async function baixarXml(ref) {
  const row = await buscarNota(ref);
  if (!row) throw erro(404, 'Documento não encontrado.');
  const xml = await xmlDaNota(row);
  const doc = enriquecerComXml(documentoDeLinha(row, { temXml: !!xml }), xml);
  if (!xml) {
    throw Object.assign(erro(404, 'XML não disponível para este documento.'), {
      codigo: 'xml_indisponivel',
      documento: doc,
    });
  }
  const nome = `NFe-${doc.chave || doc.id}.xml`;
  return { xml, nome, documento: doc };
}
