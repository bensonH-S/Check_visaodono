import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { acharFornecedor, classificar, descricaoDda, lerArquivoDda, lerCnab240 } from './lib/dda.mjs'
import { baixarRetornos, garantirSchemaItau, lerItau, montarConfig, registrarItau, salvarItau } from './lib/itauSfg.mjs'
import {
  configPronta,
  credenciaisAtivasBb,
  garantirSchemaBb,
  listarAcessosBb,
  listarBoletosBb,
  registrarColetaBb,
  removerAcessoBb,
  salvarAcessoBb,
} from './lib/bbDda.mjs'
import { removerCadastro, salvarCadastro, usoDe } from './lib/cadastros.mjs'
import { garantirSchemaCaixa, lerComprovante, mesFechamentos, receberHeartbeat, receberIngestao, salvarFechamento } from './lib/fechamentoCaixa.mjs'
import { gerarDanfe } from './lib/danfe.mjs'
import { baixarBoletoDaDespesa, baixarNotaDaDespesa } from './lib/boletoEsupri.mjs'
import { cruzarNotas } from './lib/nfEntrada.mjs'
import { hojeBR, lerConfigBkoffice, registrarFalhaVendas, resumoVendas, salvarConfigBkoffice, sincronizarVendasBk } from './lib/bkofficeVendas.mjs'
import {
  amarrarDdaComNotasReceita,
  coletarNotasReceita,
  danfeNotaReceita,
  garantirSchemaSefaz,
  importarXmlNaAgenda,
  lancarNotaNaAgenda,
  listarNotasReceita,
} from './lib/syncNfeSefaz.mjs'
import { parsePdfDespesa } from './lib/importarPdfDespesa.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const portalRoot = path.resolve(root, '..', '..', '..')

function lerEnvArquivo(file) {
  if (!file || !fs.existsSync(file)) return {}
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

/** Banco do schema finance. Em dev o portal troca DB_NAME para vision_check_dev; o financeiro não segue isso. */
function nomeBancoFinanceiro() {
  if (process.env.FINANCE_DB_NAME) return process.env.FINANCE_DB_NAME
  const arquivo = {
    ...lerEnvArquivo(path.join(portalRoot, '.env')),
    ...lerEnvArquivo(path.join(portalRoot, 'backend', '.env')),
  }
  return arquivo.DB_NAME || 'vision_check'
}

async function garantirSchemaFonte(db) {
  await db.query(fs.readFileSync(path.join(root, 'db', '010_despesa_fonte.sql'), 'utf8'))
}

async function garantirSchemaDespesaId(db) {
  await db.query(fs.readFileSync(path.join(root, 'db', '011_despesa_id.sql'), 'utf8'))
}

const env = process.env
const dbPort = Number(env.DB_PORT || 5432)
const dbSsl = env.DB_SSL === 'true' || env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined
const financeDb = nomeBancoFinanceiro()
const pool = new pg.Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: financeDb,
  port: dbPort,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 8,
  ssl: dbSsl,
  options: '-c search_path=finance,public',
})

const operacional = new pg.Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: financeDb,
  port: dbPort,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
  max: 4,
  ssl: dbSsl,
})

pool.on('error', (err) => console.error(`[db] pool: ${err.message}`))
operacional.on('error', (err) => console.error(`[db] operacional: ${err.message}`))

const FORMAS = new Set(['dinheiro', 'online', 'boleto', 'guia', 'folha', 'cadastro', 'chave_pix'])

const sessao = { nome: 'Felipe', papel: 'Autoriza' }
let coletaVendas = null
let coletaSfg = null
let coletaBb = null
let coletaSefaz = null
let estadoBb = {
  ok: false,
  mensagem: 'A coleta do Banco do Brasil ainda não rodou.',
  criadas: 0,
  em: null,
}
let estadoSfg = {
  ok: false,
  mensagem: 'A coleta da VAN do Itaú ainda não rodou.',
  criadas: 0,
  em: null,
}
let estadoSefaz = {
  ok: false,
  mensagem: 'A consulta de notas na Receita Federal ainda não rodou.',
  novas: 0,
  em: null,
}

function versaoApp() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
      cwd: portalRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'dev'
  }
}

const versao = versaoApp()

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
  res.end(body)
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body)
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) } catch (err) { reject(err) }
    })
    req.on('error', reject)
  })
}

function urlFinanceiro(req) {
  const full = String(req.originalUrl || req.url || '/')
  const marca = '/financeiro'
  const i = full.indexOf(marca)
  const resto = i >= 0 ? full.slice(i + marca.length) || '/' : String(req.url || '/')
  const caminho = resto.startsWith('/') ? resto : `/${resto}`
  return new URL(`/api${caminho}`, 'http://127.0.0.1')
}

async function contextoDda() {
  const [empresas, fornecedores, existentes] = await Promise.all([
    pool.query(`select id, apelido, razao_social, cnpj from empresas where ativo`),
    pool.query(`
      select f.id, f.nome, f.cpf_cnpj, f.plano_conta_id, p.nome as plano
      from fornecedores f
      left join plano_contas p on p.id = f.plano_conta_id
      where f.ativo
    `),
    pool.query(`select empresa_origem_id, documento_ref from despesas where documento_ref is not null and status <> 'cancelada'`),
  ])
  return {
    empresas: empresas.rows,
    fornecedores: fornecedores.rows,
    existentes: existentes.rows.map((linha) => `${linha.empresa_origem_id}|${linha.documento_ref}`),
  }
}

async function empresaPorCnpj(cnpjBruto) {
  const digits = String(cnpjBruto || '').replace(/\D/g, '')
  if (digits.length < 8) return null
  if (digits.length === 14) {
    const exata = await pool.query(
      `SELECT id, apelido, cnpj FROM empresas
       WHERE ativo AND regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') = $1
       LIMIT 1`,
      [digits],
    )
    if (exata.rows[0]) return exata.rows[0]
  }
  const prefixo = digits.slice(0, 8)
  const { rows } = await pool.query(
    `SELECT id, apelido, cnpj FROM empresas
     WHERE ativo AND regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') LIKE $1
     ORDER BY CASE WHEN tipo = 'loja' THEN 0 ELSE 1 END, apelido
     LIMIT 1`,
    [`${prefixo}%`],
  )
  return rows[0] || null
}

/** Resolve loja pelo CNPJ do PDF; se faltar, tenta razão social/apelido (sem hardcode). */
async function empresaDoPdf(parsed) {
  const porCnpj = await empresaPorCnpj(parsed.cnpj)
  if (porCnpj) return porCnpj
  const nome = String(parsed.razao_social || '').trim()
  if (nome.length < 4) return null
  const chave = nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\b(LTDA|EIRELI|ME|EPP|SA|S\/A|COMERCIO|DE|ALIMENTOS|ASSESSORIA|CONSULTORIA|EMPRESARIAL)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (chave.length < 3) return null
  const { rows } = await pool.query(
    `SELECT id, apelido, cnpj FROM empresas
     WHERE ativo AND (
       upper(coalesce(apelido, '')) LIKE upper($1)
       OR upper(coalesce(razao_social, '')) LIKE upper($1)
       OR upper(coalesce(apelido, '')) LIKE upper($2)
       OR upper(coalesce(razao_social, '')) LIKE upper($2)
     )
     ORDER BY CASE WHEN tipo = 'loja' THEN 0 ELSE 1 END, length(apelido)
     LIMIT 1`,
    [`%${chave}%`, `%${nome}%`],
  )
  return rows[0] || null
}

async function previaPdf(buffer, nomeArquivo) {
  try {
    const parsed = await parsePdfDespesa(buffer, nomeArquivo)
    const empresa = await empresaDoPdf(parsed)
    let jaExistia = false
    if (empresa && parsed.documento_ref) {
      const dup = await pool.query(
        `SELECT id::text AS id FROM despesas
         WHERE empresa_origem_id = $1 AND documento_ref = $2 AND status <> 'cancelada'
         LIMIT 1`,
        [empresa.id, parsed.documento_ref],
      )
      jaExistia = !!dup.rows[0]
    }
    if (!empresa) {
      return {
        nome: nomeArquivo,
        ok: false,
        tipo: parsed.tipo,
        descricao: parsed.descricao,
        valor: parsed.valor,
        vencimento: parsed.vencimento,
        forma_pagamento: parsed.forma_pagamento,
        cnpj: parsed.cnpj,
        razao_social: parsed.razao_social,
        documento_ref: parsed.documento_ref,
        erro: parsed.cnpj
          ? `CNPJ ${parsed.cnpj} não cadastrado no financeiro.`
          : 'PDF sem CNPJ da empresa.',
      }
    }
    return {
      nome: nomeArquivo,
      ok: true,
      tipo: parsed.tipo,
      descricao: parsed.descricao,
      valor: parsed.valor,
      vencimento: parsed.vencimento,
      forma_pagamento: parsed.forma_pagamento,
      dados_pagamento: parsed.dados_pagamento
        ? String(parsed.dados_pagamento).slice(0, 48)
        : null,
      cnpj: parsed.cnpj,
      empresa: empresa.apelido,
      empresa_id: empresa.id,
      documento_ref: parsed.documento_ref,
      ja_existia: jaExistia,
      erro: jaExistia ? 'Já existe na agenda (não duplica).' : null,
    }
  } catch (err) {
    return { nome: nomeArquivo, ok: false, tipo: 'pdf', erro: err.message || 'Não leu o PDF.' }
  }
}

async function previaXml(xml, nomeArquivo) {
  try {
    const { parseNfeXml } = await import('../services/nfeXml.js')
    const parseada = parseNfeXml(xml)
    const cnpj = String(parseada.destinatario?.cnpj || '').replace(/\D/g, '')
    const empresa = cnpj.length >= 8 ? await empresaPorCnpj(cnpj) : null
    if (!parseada.chave || String(parseada.chave).length !== 44) {
      return { nome: nomeArquivo, ok: false, tipo: 'nfe_xml', erro: 'XML sem chave de acesso da NF-e.' }
    }
    if (!empresa) {
      return {
        nome: nomeArquivo,
        ok: false,
        tipo: 'nfe_xml',
        descricao: parseada.emitente?.nome || `NF ${parseada.numero || ''}`.trim(),
        valor: parseada.valor_total != null ? Number(parseada.valor_total) : null,
        vencimento: parseada.emissao || null,
        cnpj,
        erro: cnpj ? `CNPJ ${cnpj} não cadastrado no financeiro.` : 'XML sem CNPJ do destinatário.',
      }
    }
    return {
      nome: nomeArquivo,
      ok: true,
      tipo: 'nfe_xml',
      descricao: `${parseada.emitente?.nome || 'NF-e'} · NF ${parseada.numero || parseada.chave.slice(25, 34)}`.slice(0, 200),
      valor: parseada.valor_total != null ? Number(parseada.valor_total) : null,
      vencimento: parseada.emissao || null,
      empresa: empresa.apelido,
      empresa_id: empresa.id,
      cnpj,
      forma_pagamento: 'boleto',
      documento_ref: `NF|${parseada.chave}`,
    }
  } catch (err) {
    return { nome: nomeArquivo, ok: false, tipo: 'nfe_xml', erro: err.message || 'Não leu o XML.' }
  }
}

async function lancarPdfNaAgenda(buffer, nomeArquivo, { paraAgenda = true } = {}) {
  const parsed = await parsePdfDespesa(buffer, nomeArquivo)
  const empresa = await empresaDoPdf(parsed)
  if (!empresa) {
    const err = new Error(
      parsed.cnpj
        ? `CNPJ ${parsed.cnpj} do PDF não está cadastrado em empresas do financeiro${parsed.razao_social ? ` (${parsed.razao_social})` : ''}.`
        : 'PDF sem CNPJ da empresa. Cadastre a empresa no financeiro ou use um PDF com CNPJ legível.',
    )
    err.status = 400
    throw err
  }
  const status = paraAgenda ? 'pronta' : 'rascunho'
  if (parsed.documento_ref) {
    const dup = await pool.query(
      `SELECT id::text AS id, status FROM despesas
       WHERE empresa_origem_id = $1 AND documento_ref = $2 AND status <> 'cancelada'
       LIMIT 1`,
      [empresa.id, parsed.documento_ref],
    )
    if (dup.rows[0]) {
      return {
        criadas: 0,
        ja_existia: true,
        id: dup.rows[0].id,
        tipo: parsed.tipo,
        descricao: parsed.descricao,
        empresa: empresa.apelido,
      }
    }
  }
  const { rows } = await pool.query(`
    INSERT INTO despesas (
      id, descricao, empresa_origem_id, documento_ref, competencia, vencimento,
      valor, forma_pagamento, dados_pagamento, status, fonte
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual'
    )
    RETURNING id::text AS id
  `, [
    parsed.descricao,
    empresa.id,
    parsed.documento_ref,
    parsed.competencia,
    parsed.vencimento,
    parsed.valor,
    parsed.forma_pagamento,
    parsed.dados_pagamento,
    status,
  ])
  return {
    criadas: 1,
    ja_existia: false,
    id: rows[0].id,
    tipo: parsed.tipo,
    descricao: parsed.descricao,
    empresa: empresa.apelido,
  }
}

async function lancarDda(selecionadas, { paraAgenda = false } = {}) {
  const contexto = await contextoDda()
  const prontas = classificar(selecionadas, contexto).filter((linha) => linha.pronto)
  let criadas = 0
  const ids = []
  for (const linha of prontas) {
    const status = paraAgenda ? 'pronta' : (linha.fornecedor_id ? 'classificada' : 'rascunho')
    const descricao = descricaoDda(linha)
    const { rows } = await pool.query(`
      insert into despesas (
        id, descricao, fornecedor_id, empresa_origem_id, plano_conta_id,
        documento_ref, numero_nf, cnpj_cedente, competencia, vencimento, valor, forma_pagamento, dados_pagamento, status, fonte
      ) values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'boleto',$11,$12,'dda')
      returning id::text as id
    `, [
      descricao,
      linha.fornecedor_id,
      linha.empresa_id,
      linha.plano_conta_id,
      linha.documento_ref,
      linha.documento || null,
      linha.cnpj_cedente || null,
      linha.competencia,
      linha.vencimento,
      linha.valor,
      linha.codigo ? String(linha.codigo).trim() : null,
      status,
    ])
    if (rows[0]?.id) ids.push(rows[0].id)
    criadas += 1
  }
  return { criadas, ignoradas: selecionadas.length - criadas, ids }
}

function ledgerSfg() {
  const dir = path.join(root, 'data', 'sfg')
  const arquivo = path.join(dir, 'ledger.json')
  fs.mkdirSync(dir, { recursive: true })
  let itens = []
  try {
    itens = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
  } catch {
    itens = []
  }
  return {
    itens,
    recebidos: path.join(dir, 'recebidos'),
    gravar() {
      fs.writeFileSync(arquivo, JSON.stringify(itens, null, 2))
    },
  }
}

async function vincularFornecedores() {
  const [despesas, fornecedores] = await Promise.all([
    pool.query(`select id, descricao, cnpj_cedente from despesas where fornecedor_id is null and status <> 'cancelada'`),
    pool.query(`select id, nome, cpf_cnpj, plano_conta_id from fornecedores where ativo`),
  ])
  for (const despesa of despesas.rows) {
    const fornecedor = acharFornecedor({ cedente: despesa.descricao, cnpj_cedente: despesa.cnpj_cedente }, fornecedores.rows)
    if (!fornecedor) continue
    await pool.query(
      `update despesas
          set fornecedor_id = $2,
              plano_conta_id = coalesce(plano_conta_id, $3),
              descricao = case when btrim(coalesce(descricao, '')) = '' then $4 else descricao end
        where id = $1 and fornecedor_id is null`,
      [despesa.id, fornecedor.id, fornecedor.plano_conta_id, String(fornecedor.nome || '').trim().slice(0, 200) || 'Boleto DDA'],
    )
  }
}

async function amarrarNotas() {
  const despesas = await pool.query(`
    select d.id, d.numero_nf, coalesce(f.cpf_cnpj, d.cnpj_cedente) as cnpj_fornecedor, eo.cnpj as cnpj_empresa
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    left join fornecedores f on f.id = d.fornecedor_id
    where d.nf_confirmada = false and d.numero_nf is not null and d.status <> 'cancelada'
  `)
  if (despesas.rowCount) {
    const notas = await operacional.query(`
      select n.id_nfe::text as id, n.numero, n.emitente_cnpj, l.cnpj as cnpj_loja
      from estoque_nfe n
      join lojas l on l.id_loja = n.id_loja
      where n.status_entrega = 'conferida'
    `)
    for (const cruzamento of cruzarNotas(despesas.rows, notas.rows)) {
      // Gestor conferiu a NF no app → título vai sozinho para a Agenda banco (pronta).
      await pool.query(
        `update despesas set
           nf_confirmada = true,
           nfe_id = $2,
           status = case
             when status in ('rascunho', 'classificada', 'bloqueada_duplicata') then 'pronta'
             else status
           end
         where id = $1 and nf_confirmada = false`,
        [cruzamento.despesa_id, cruzamento.nfe_id],
      )
    }
  }
  // Já tinham NF conferida e ainda estavam no inbox (legado / corrida).
  await pool.query(`
    update despesas set status = 'pronta'
    where nf_confirmada = true
      and status in ('rascunho', 'classificada', 'bloqueada_duplicata')
  `)
}

let sincronizandoNotas = null

function sincronizarNotasEmFundo() {
  if (sincronizandoNotas) return
  sincronizandoNotas = (async () => {
    try { await vincularFornecedores() } catch (err) { console.error(err.message) }
    try { await amarrarNotas() } catch (err) { console.error(err.message) }
    try { await amarrarDdaComNotasReceita(pool) } catch (err) { console.error(err.message) }
  })().finally(() => { sincronizandoNotas = null })
}

async function listarDespesas(empresaId) {
  sincronizarNotasEmFundo()
  const params = []
  let where = ''
  if (empresaId) {
    params.push(empresaId)
    where = 'where d.empresa_origem_id = $1'
  }
  const { rows } = await pool.query(`
    select d.id,
           coalesce(nullif(btrim(d.descricao), ''), nullif(btrim(f.nome), ''),
             case when nullif(btrim(d.numero_nf), '') is not null then 'NF ' || btrim(d.numero_nf) else 'Boleto DDA' end
           ) as descricao,
           d.valor::float8 as valor, to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           to_char(d.competencia, 'YYYY-MM-DD') as competencia, d.forma_pagamento, d.status,
           d.documento_ref, d.numero_nf, d.nfe_id, d.nf_confirmada, d.empresa_origem_id as origem_id, eo.apelido as origem, eo.razao_social as origem_razao,
           er.apelido as registrado_em,
           d.fornecedor_id,
           coalesce(nullif(btrim(f.nome), ''), nullif(btrim(d.descricao), ''),
             case when nullif(btrim(d.numero_nf), '') is not null then 'NF ' || btrim(d.numero_nf) else 'Boleto DDA' end
           ) as fornecedor,
           d.plano_conta_id, p.nome as plano,
           d.conta_saida_id, cs.nome as conta_nome, cs.empresa_id as conta_empresa_id,
           coalesce(nullif(d.dados_pagamento, ''), pix.chave_pix) as pagamento,
           coalesce(d.fonte, case
             when d.documento_ref like 'DDA|%' then 'dda'
             when d.forma_pagamento = 'boleto' and d.documento_ref ~ '^\\d{44}$' then 'dda'
             else 'manual'
           end) as fonte,
           nr.id as nfe_recebida_id,
           (nr.id is not null) as tem_nfe_receita,
           nr.chave as nfe_chave,
           nr.tem_xml as nfe_tem_xml
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    left join lateral (
      select id, chave, tem_xml
      from nfe_recebida
      where despesa_id = d.id
      order by atualizado_em desc nulls last
      limit 1
    ) nr on true
    left join contas_bancarias cs on cs.id = d.conta_saida_id
    left join empresas ec on ec.id = cs.empresa_id
    left join empresas er on er.id = d.empresa_registro_id
    left join fornecedores f on f.id = d.fornecedor_id
    left join plano_contas p on p.id = d.plano_conta_id
    left join lateral (
      select chave_pix from fornecedor_pagamentos fp
      where fp.fornecedor_id = d.fornecedor_id and fp.meio = 'pix' and chave_pix is not null and chave_pix <> ''
      limit 1
    ) pix on true
    ${where}
    order by d.vencimento nulls last, d.descricao
  `, params)
  return rows
}

const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

function enviarPdf(res, pdf, nome) {
  res.writeHead(200, {
    'content-type': 'application/pdf',
    'content-disposition': `inline; filename="${nome}"`,
    'cache-control': 'no-store',
  })
  res.end(pdf)
}

function arquivoNoDisco(relativo, pasta) {
  const file = path.resolve(root, relativo)
  const base = path.resolve(root, 'data', pasta)
  if (!file.startsWith(base) || !fs.existsSync(file)) return null
  return file
}

async function arquivoSalvo(id, coluna) {
  if (coluna !== 'boleto_arquivo' && coluna !== 'nota_arquivo') return null
  const { rows } = await pool.query(`select ${coluna} as arquivo from despesas where id = $1`, [id])
  const relativo = rows[0]?.arquivo
  if (!relativo) return null
  const file = arquivoNoDisco(relativo, 'esupri')
  return file ? fs.readFileSync(file) : null
}

async function gravarDocumento(id, coluna, pasta, pdf) {
  if (coluna !== 'boleto_arquivo' && coluna !== 'nota_arquivo') return
  const dir = path.join(root, 'data', 'esupri', pasta)
  fs.mkdirSync(dir, { recursive: true })
  const relativo = `data/esupri/${pasta}/${id}.pdf`
  fs.writeFileSync(path.join(root, relativo), pdf)
  await pool.query(`update despesas set ${coluna} = $2 where id = $1`, [id, relativo])
}

function servirArquivo(res, file) {
  const ext = path.extname(file).toLowerCase()
  send(res, 200, fs.readFileSync(file), tipos[ext] || 'application/octet-stream')
}

export async function receberCaixaLoja(req, res) {
  const caminho = String(req.originalUrl || req.url || '')
  const pulso = caminho.includes('/heartbeat')
  const body = await readBody(req)
  const auth = String(req.headers.authorization || '')
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  const esperado = env.CAIXA_INGEST_TOKEN || process.env.CAIXA_INGEST_TOKEN
  try {
    const resultado = pulso
      ? await receberHeartbeat(pool, body, esperado, token)
      : await receberIngestao(pool, body, esperado, token)
    return send(res, 200, JSON.stringify(resultado))
  } catch (err) {
    return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não recebeu o caixa da loja.' }))
  }
}

export async function handleFinance(req, res) {
  const url = urlFinanceiro(req)
  try {
    if (req.method === 'GET' && url.pathname === '/api/sistema') {
      return send(res, 200, JSON.stringify({ versao, usuario: sessao }))
    }
    if (req.method === 'GET' && url.pathname === '/api/resumo') {
      const hoje = new Date().toISOString().slice(0, 10)
      const { rows } = await pool.query(
        `
        select
          coalesce(sum(case when status not in ('paga','conciliada','cancelada') then valor else 0 end), 0)::float8 as a_pagar,
          coalesce(sum(case when status in ('paga','conciliada') then valor else 0 end), 0)::float8 as pago,
          coalesce(sum(case when status = 'pronta' then valor else 0 end), 0)::float8 as para_autorizar,
          coalesce(sum(case
            when status not in ('paga','conciliada','cancelada')
             and vencimento is not null and vencimento < $1::date
            then valor else 0 end), 0)::float8 as vencida,
          count(*) filter (where status not in ('paga','conciliada','cancelada'))::int as qtd_abertas,
          count(*) filter (where status = 'pronta')::int as qtd_autorizar,
          count(*) filter (
            where status not in ('paga','conciliada','cancelada')
              and vencimento is not null and vencimento < $1::date
          )::int as qtd_vencidas
        from despesas
        `,
        [hoje],
      )
      return send(res, 200, JSON.stringify({ ...rows[0], banco: financeDb, schema: 'finance' }))
    }
    if (req.method === 'GET' && url.pathname === '/api/despesas') {
      return send(res, 200, JSON.stringify(await listarDespesas(url.searchParams.get('empresa') || '')))
    }
    if (req.method === 'GET' && /^\/api\/despesas\/[^/]+\/nota$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3]
      const salvo = await arquivoSalvo(id, 'nota_arquivo')
      if (salvo) return enviarPdf(res, salvo, `DANFE-${id}.pdf`)
      const despesa = await pool.query('select nfe_id, numero_nf from despesas where id = $1', [id])
      const nfeId = despesa.rows[0]?.nfe_id
      if (nfeId) {
        const nota = await operacional.query('select numero, xml_path from estoque_nfe where id_nfe = $1', [nfeId])
        const xmlPath = nota.rows[0]?.xml_path ? String(nota.rows[0].xml_path).trim() : ''
        if (xmlPath && fs.existsSync(xmlPath)) {
          try {
            const pdf = await gerarDanfe(fs.readFileSync(xmlPath, 'utf8'))
            await gravarDocumento(id, 'nota_arquivo', 'notas', pdf)
            return enviarPdf(res, pdf, `DANFE-NF-${nota.rows[0].numero || nfeId}.pdf`)
          } catch (err) {
            console.error(err.message)
          }
        }
      }
      try {
        const arquivo = await baixarNotaDaDespesa({ root, env, pool, operacional, id })
        await gravarDocumento(id, 'nota_arquivo', 'notas', arquivo.pdf)
        return enviarPdf(res, arquivo.pdf, `DANFE-${String(arquivo.nota || 'nota').replace(/[^\w.-]+/g, '_')}.pdf`)
      } catch (err) {
        return send(res, err.status || 404, JSON.stringify({ erro: err.message || 'Não achei a nota fiscal.' }))
      }
    }
    if (req.method === 'GET' && /^\/api\/despesas\/[^/]+\/boleto$/.test(url.pathname)) {
      const id = url.pathname.split('/')[3]
      const salvo = await arquivoSalvo(id, 'boleto_arquivo')
      if (salvo) return enviarPdf(res, salvo, `BOLETO-${id}.pdf`)
      let arquivo
      try {
        arquivo = await baixarBoletoDaDespesa({ root, env, pool, operacional, id })
      } catch (err) {
        return send(res, err.status || 502, JSON.stringify({ erro: err.message || 'Não abriu o boleto.' }))
      }
      await gravarDocumento(id, 'boleto_arquivo', 'boletos', arquivo.pdf)
      return enviarPdf(res, arquivo.pdf, `BOLETO-${String(arquivo.nota || 'nota').replace(/[^\w.-]+/g, '_')}.pdf`)
    }
    if (req.method === 'GET' && url.pathname === '/api/empresas') {
      const { rows } = await pool.query(`
        select id, apelido, razao_social, tipo, cnpj, bk_number from empresas where ativo order by tipo, apelido
      `)
      return send(res, 200, JSON.stringify(rows))
    }
    if (req.method === 'GET' && url.pathname === '/api/contas') {
      const { rows } = await pool.query(`
        select c.id, c.empresa_id, c.nome, c.tipo, e.apelido
        from contas_bancarias c
        join empresas e on e.id = c.empresa_id
        where c.ativa
        order by c.nome
      `)
      return send(res, 200, JSON.stringify(rows))
    }
    if (req.method === 'GET' && url.pathname === '/api/plano') {
      const { rows } = await pool.query(`
        select id, nome from plano_contas where ativo and tipo = 'a_pagar' order by nome
      `)
      return send(res, 200, JSON.stringify(rows))
    }
    if (req.method === 'GET' && url.pathname === '/api/cadastros/empresas') {
      const { rows } = await pool.query(`
        select id, apelido, razao_social, cnpj, bk_number, inscricao_estadual, endereco, cidade, cep, tipo, ativo
        from empresas
        order by ativo desc, tipo, apelido
      `)
      const uso = await usoDe(pool, 'empresas', rows.map((r) => r.id))
      return send(res, 200, JSON.stringify(rows.map((r) => ({ ...r, uso: uso[r.id] || 0 }))))
    }
    if (req.method === 'GET' && url.pathname === '/api/cadastros/contas') {
      const { rows } = await pool.query(`
        select c.id, c.empresa_id, c.nome, c.tipo, c.banco, c.agencia, c.numero, c.digito, c.ativa, e.apelido
        from contas_bancarias c
        join empresas e on e.id = c.empresa_id
        order by c.ativa desc, e.apelido, c.tipo, c.nome
      `)
      const uso = await usoDe(pool, 'contas', rows.map((r) => r.id))
      return send(res, 200, JSON.stringify(rows.map((r) => ({ ...r, uso: uso[r.id] || 0 }))))
    }
    if ((req.method === 'POST' && /^\/api\/cadastros\/[^/]+$/.test(url.pathname)) || (/^\/api\/cadastros\/[^/]+\/[^/]+$/.test(url.pathname) && (req.method === 'PUT' || req.method === 'DELETE'))) {
      const [, , , tipo, id = null] = url.pathname.split('/')
      try {
        if (req.method === 'DELETE') return send(res, 200, JSON.stringify(await removerCadastro(pool, tipo, id)))
        return send(res, 200, JSON.stringify(await salvarCadastro(pool, tipo, id, await readBody(req))))
      } catch (err) {
        if (!err.status) throw err
        return send(res, err.status, JSON.stringify({ erro: err.message }))
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/plano/todos') {
      const { rows } = await pool.query(`
        select p.id, p.nome, p.tipo, p.natureza, p.codigo_obrigacao, p.codigo_provisao, p.ativo,
               (select count(*)::int from despesas d where d.plano_conta_id = p.id) as despesas,
               (select count(*)::int from fornecedores f where f.plano_conta_id = p.id) as fornecedores
        from plano_contas p
        order by p.ativo desc, p.tipo, p.nome
      `)
      return send(res, 200, JSON.stringify(rows))
    }
    if ((req.method === 'POST' && url.pathname === '/api/plano') || (/^\/api\/plano\/[^/]+$/.test(url.pathname) && (req.method === 'PUT' || req.method === 'DELETE'))) {
      const id = req.method === 'POST' ? null : url.pathname.split('/').pop()
      if (req.method === 'DELETE') {
        const uso = await pool.query(`
          select (select count(*) from despesas where plano_conta_id = $1) + (select count(*) from fornecedores where plano_conta_id = $1) as total
        `, [id])
        if (Number(uso.rows[0].total) > 0) {
          await pool.query(`update plano_contas set ativo = false where id = $1`, [id])
          return send(res, 200, JSON.stringify({ id, inativado: true }))
        }
        await pool.query(`delete from plano_contas where id = $1`, [id])
        return send(res, 200, JSON.stringify({ id, apagado: true }))
      }
      const body = await readBody(req)
      const nome = String(body.nome || '').trim()
      if (!nome) return send(res, 400, JSON.stringify({ erro: 'Informe o nome do plano.' }))
      const tipo = body.tipo === 'a_receber' ? 'a_receber' : 'a_pagar'
      const natureza = ['fixa', 'variavel'].includes(body.natureza) ? body.natureza : null
      const valores = [nome, tipo, natureza, String(body.codigo_obrigacao || '').trim() || null, String(body.codigo_provisao || '').trim() || null, body.ativo !== false]
      try {
        const { rows } = id
          ? await pool.query(`
              update plano_contas set nome = $1, tipo = $2, natureza = $3, codigo_obrigacao = $4, codigo_provisao = $5, ativo = $6
              where id = $7 returning id
            `, [...valores, id])
          : await pool.query(`
              insert into plano_contas (nome, tipo, natureza, codigo_obrigacao, codigo_provisao, ativo)
              values ($1, $2, $3, $4, $5, $6) returning id
            `, valores)
        if (!rows.length) return send(res, 404, JSON.stringify({ erro: 'Plano não encontrado.' }))
        return send(res, 200, JSON.stringify(rows[0]))
      } catch (err) {
        if (err.code === '23505') return send(res, 409, JSON.stringify({ erro: 'Já existe um plano com esse nome.' }))
        throw err
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/fornecedores/lista') {
      const q = (url.searchParams.get('q') || '').trim()
      const por = Math.min(Math.max(Number(url.searchParams.get('por')) || 30, 1), 200)
      const pagina = Math.max(Number(url.searchParams.get('pagina')) || 0, 0)
      const digitos = q.replace(/\D/g, '')
      const situacao = url.searchParams.get('situacao')
      const params = []
      let where = situacao === 'todos' ? 'where true' : situacao === 'inativos' ? 'where not f.ativo' : 'where f.ativo'
      if (q) {
        params.push(`%${q}%`, digitos.length >= 3 ? `%${digitos}%` : '-')
        where += ` and (f.nome ilike $1 or f.razao_social ilike $1 or regexp_replace(coalesce(f.cpf_cnpj, ''), '\\D', '', 'g') like $2)`
      }
      const [contagem, linhas] = await Promise.all([
        pool.query(`
          select count(*)::int as total, count(f.plano_conta_id)::int as com_plano
          from fornecedores f ${where}
        `, params),
        pool.query(`
          select f.id, f.nome, f.razao_social, f.cpf_cnpj, f.plano_conta_id, p.nome as plano,
                 f.logradouro, f.numero, f.bairro, f.cidade, f.estado, f.cep, f.ativo
          from fornecedores f
          left join plano_contas p on p.id = f.plano_conta_id
          ${where}
          order by f.nome
          limit ${por} offset ${pagina * por}
        `, params),
      ])
      const uso = await usoDe(pool, 'fornecedores', linhas.rows.map((r) => r.id))
      return send(res, 200, JSON.stringify({ ...contagem.rows[0], linhas: linhas.rows.map((r) => ({ ...r, uso: uso[r.id] || 0 })) }))
    }
    if (req.method === 'GET' && url.pathname === '/api/fornecedores') {
      const q = (url.searchParams.get('q') || '').trim()
      if (q.length < 2) return send(res, 200, '[]')
      const { rows } = await pool.query(`
        select f.id, f.nome, f.cpf_cnpj, f.plano_conta_id, p.nome as plano
        from fornecedores f
        left join plano_contas p on p.id = f.plano_conta_id
        where f.nome ilike $1 or regexp_replace(coalesce(f.cpf_cnpj, ''), '\\D', '', 'g') like $2
        order by nome
        limit $3
      `, [`%${q}%`, `%${q.replace(/\D/g, '') || '-'}%`, Math.min(Number(url.searchParams.get('limite')) || 12, 200)])
      return send(res, 200, JSON.stringify(rows))
    }
    if (req.method === 'POST' && url.pathname === '/api/despesas') {
      const body = await readBody(req)
      const valor = Number(body.valor)
      if (!body.descricao || !body.empresa_origem_id || !Number.isFinite(valor) || valor < 0) {
        return send(res, 400, JSON.stringify({ erro: 'Descrição, origem e valor são obrigatórios.' }))
      }
      if (body.forma_pagamento && !FORMAS.has(body.forma_pagamento)) {
        return send(res, 400, JSON.stringify({ erro: 'Forma de pagamento inválida.' }))
      }
      let status = 'rascunho'
      if (body.documento_ref) {
        const dup = await pool.query(`
          select 1 from despesas
          where empresa_origem_id = $1 and documento_ref = $2 and status <> 'cancelada'
          limit 1
        `, [body.empresa_origem_id, body.documento_ref])
        if (dup.rowCount) status = 'bloqueada_duplicata'
      }
      const inserted = await pool.query(`
        insert into despesas (
          id, descricao, fornecedor_id, empresa_origem_id, empresa_registro_id, conta_saida_id, plano_conta_id,
          documento_ref, competencia, vencimento, valor, forma_pagamento, dados_pagamento, status, fonte
        ) values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'manual')
        returning id, status
      `, [
        String(body.descricao).trim(),
        body.fornecedor_id || null,
        body.empresa_origem_id,
        body.empresa_registro_id || null,
        body.conta_saida_id || null,
        body.plano_conta_id || null,
        body.documento_ref || null,
        body.competencia || null,
        body.vencimento || null,
        valor,
        body.forma_pagamento || null,
        body.dados_pagamento ? String(body.dados_pagamento).trim() : null,
        status,
      ])
      return send(res, 201, JSON.stringify(inserted.rows[0]))
    }
    if (req.method === 'POST' && url.pathname === '/api/despesas/agenda') {
      const body = await readBody(req)
      const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : []
      if (!ids.length) return send(res, 400, JSON.stringify({ erro: 'Informe ao menos um título.' }))
      const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      const validos = []
      const bloqueados = []
      for (const id of ids) {
        if (uuidOk.test(id)) validos.push(id)
        else bloqueados.push({ id, motivo: 'Título inválido.' })
      }
      if (!validos.length) return send(res, 200, JSON.stringify({ enviados: [], bloqueados }))
      const { rows } = await pool.query(
        `select id::text as id, status from despesas where id = any($1::uuid[])`,
        [validos],
      )
      const porId = new Map(rows.map((r) => [r.id, r]))
      const enviados = []
      const paraAtualizar = []
      for (const id of validos) {
        const d = porId.get(id)
        if (!d) {
          bloqueados.push({ id, motivo: 'Título não encontrado.' })
          continue
        }
        if (['paga', 'conciliada', 'cancelada'].includes(d.status)) {
          bloqueados.push({ id, motivo: `Já está ${d.status}.` })
          continue
        }
        if (['pronta', 'autorizada', 'enviada'].includes(d.status)) {
          enviados.push({ id, status: d.status })
          continue
        }
        paraAtualizar.push(id)
      }
      if (paraAtualizar.length) {
        const up = await pool.query(
          `update despesas set status = 'pronta'
           where id = any($1::uuid[])
             and status not in ('paga', 'conciliada', 'cancelada', 'pronta', 'autorizada', 'enviada')
           returning id::text as id, status`,
          [paraAtualizar],
        )
        enviados.push(...up.rows)
      }
      return send(res, 200, JSON.stringify({ enviados, bloqueados }))
    }
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/despesas/')) {
      const id = url.pathname.split('/').pop()
      const body = await readBody(req)
      const valor = Number(body.valor)
      if (!body.descricao || !body.empresa_origem_id || !Number.isFinite(valor) || valor < 0) {
        return send(res, 400, JSON.stringify({ erro: 'Descrição, origem e valor são obrigatórios.' }))
      }
      if (body.forma_pagamento && !FORMAS.has(body.forma_pagamento)) {
        return send(res, 400, JSON.stringify({ erro: 'Forma de pagamento inválida.' }))
      }
      const updated = await pool.query(`
        update despesas set
          descricao = $1, fornecedor_id = $2, empresa_origem_id = $3, conta_saida_id = $4, plano_conta_id = $5,
          documento_ref = $6, vencimento = $7, valor = $8, forma_pagamento = $9, dados_pagamento = $10,
          status = case when $12::text is null then status else $12 end,
          competencia = case when $13::date is null then competencia else $13::date end
        where id = $11
        returning id, status
      `, [
        String(body.descricao).trim(),
        body.fornecedor_id || null,
        body.empresa_origem_id,
        body.conta_saida_id || null,
        body.plano_conta_id || null,
        body.documento_ref || null,
        body.vencimento || null,
        valor,
        body.forma_pagamento || null,
        body.dados_pagamento ? String(body.dados_pagamento).trim() : null,
        id,
        body.status && ['rascunho', 'classificada', 'pronta'].includes(body.status) ? body.status : null,
        body.competencia || null,
      ])
      if (!updated.rowCount) return send(res, 404, JSON.stringify({ erro: 'Despesa não encontrada.' }))
      return send(res, 200, JSON.stringify(updated.rows[0]))
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/despesas/')) {
      const id = url.pathname.split('/').pop()
      const deleted = await pool.query('delete from despesas where id = $1 returning id', [id])
      if (!deleted.rowCount) return send(res, 404, JSON.stringify({ erro: 'Despesa não encontrada.' }))
      return send(res, 200, JSON.stringify(deleted.rows[0]))
    }
    if (req.method === 'GET' && url.pathname === '/api/config/bkoffice') {
      const cfg = await lerConfigBkoffice(pool, env)
      return send(res, 200, JSON.stringify({
        usuario: cfg.usuario,
        api: cfg.api,
        setor: cfg.setor,
        senha_definida: cfg.senha_definida,
      }))
    }
    if (req.method === 'PUT' && url.pathname === '/api/config/bkoffice') {
      const body = await readBody(req)
      try {
        return send(res, 200, JSON.stringify(await salvarConfigBkoffice(pool, body)))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não salvou a configuração.' }))
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/vendas') {
      return send(res, 200, JSON.stringify(await resumoVendas(pool, url.searchParams.get('dia') || '')))
    }
    if (req.method === 'GET' && url.pathname === '/api/caixa') {
      try {
        return send(res, 200, JSON.stringify(await mesFechamentos(pool, {
          mes: url.searchParams.get('mes') || '',
          empresaId: url.searchParams.get('empresa') || '',
        })))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não carregou o fechamento.' }))
      }
    }
    if (req.method === 'GET' && /^\/api\/caixa\/lancamentos\/[^/]+\/comprovante$/.test(url.pathname)) {
      try {
        const arquivo = await lerComprovante(pool, url.pathname.split('/')[4])
        res.writeHead(200, {
          'content-type': arquivo.mime,
          'content-disposition': `inline; filename="${arquivo.nome}"`,
          'cache-control': 'no-store',
        })
        return res.end(arquivo.buffer)
      } catch (err) {
        return send(res, err.status || 404, JSON.stringify({ erro: err.message || 'Não abriu o comprovante.' }))
      }
    }
    if (req.method === 'PUT' && url.pathname === '/api/caixa') {
      const body = await readBody(req)
      try {
        return send(res, 200, JSON.stringify(await salvarFechamento(pool, body)))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não salvou o fechamento.' }))
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/caixa/ingest') {
      const body = await readBody(req)
      const auth = String(req.headers.authorization || '')
      const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
      try {
        return send(res, 200, JSON.stringify(await receberIngestao(
          pool,
          body,
          env.CAIXA_INGEST_TOKEN || process.env.CAIXA_INGEST_TOKEN,
          token,
        )))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não recebeu o caixa da loja.' }))
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/caixa/heartbeat') {
      const body = await readBody(req)
      const auth = String(req.headers.authorization || '')
      const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
      try {
        return send(res, 200, JSON.stringify(await receberHeartbeat(
          pool,
          body,
          env.CAIXA_INGEST_TOKEN || process.env.CAIXA_INGEST_TOKEN,
          token,
        )))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não registrou o pulso da loja.' }))
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/vendas/sync') {
      if (coletaVendas) {
        return send(res, 409, JSON.stringify({ erro: 'Já tem uma coleta de vendas em andamento.' }))
      }
      const body = await readBody(req)
      coletaVendas = sincronizarVendasBk({ pool, env, inicio: body.inicio, fim: body.fim })
      try {
        return send(res, 200, JSON.stringify(await coletaVendas))
      } catch (err) {
        return send(res, err.status || 502, JSON.stringify({ erro: err.message || 'Não puxou as vendas.' }))
      } finally {
        coletaVendas = null
      }
    }
    if (req.method === 'POST' && (url.pathname === '/api/dda/previa' || url.pathname === '/api/dda/importar')) {
      const body = await readBody(req)
      const contexto = await contextoDda()
      if (url.pathname === '/api/dda/previa') {
        if (!body.arquivo) return send(res, 400, JSON.stringify({ erro: 'Envie a planilha ou o arquivo retorno de DDA.' }))
        let linhas
        try {
          linhas = classificar(lerArquivoDda(Buffer.from(body.arquivo, 'base64')), contexto)
        } catch (err) {
          return send(res, 400, JSON.stringify({ erro: err.message || 'Arquivo inválido.' }))
        }
        return send(res, 200, JSON.stringify({ linhas }))
      }
      const selecionadas = Array.isArray(body.linhas) ? body.linhas : []
      return send(res, 201, JSON.stringify(await lancarDda(selecionadas, { paraAgenda: body.para_agenda === true })))
    }
    if (req.method === 'POST' && (
      url.pathname === '/api/despesas/importar-arquivos'
      || url.pathname === '/api/despesas/importar-arquivos/previa'
    )) {
      const body = await readBody(req)
      const arquivos = Array.isArray(body.arquivos) ? body.arquivos : []
      if (!arquivos.length) {
        return send(res, 400, JSON.stringify({ erro: 'Envie ao menos um arquivo (PDF, DDA ou XML de NF-e).' }))
      }
      const soPrevia = url.pathname.endsWith('/previa')
      const paraAgenda = body.para_agenda !== false
      const contexto = await contextoDda()
      await garantirSchemaSefaz(pool)
      const resultados = []
      let criadas = 0
      for (const item of arquivos.slice(0, 30)) {
        const nome = String(item?.nome || 'arquivo').trim() || 'arquivo'
        const b64 = String(item?.base64 || '')
        if (!b64) {
          resultados.push({ nome, ok: false, erro: 'Arquivo vazio.', criadas: 0 })
          continue
        }
        const ext = nome.includes('.') ? nome.split('.').pop().toLowerCase() : ''
        try {
          if (ext === 'pdf') {
            if (soPrevia) {
              resultados.push(await previaPdf(Buffer.from(b64, 'base64'), nome))
              continue
            }
            const r = await lancarPdfNaAgenda(Buffer.from(b64, 'base64'), nome, { paraAgenda })
            criadas += r.criadas
            resultados.push({
              nome,
              ok: true,
              tipo: r.tipo || 'pdf',
              criadas: r.criadas,
              ja_existia: !!r.ja_existia,
              id: r.id,
              descricao: r.descricao,
              empresa: r.empresa,
            })
            continue
          }
          if (ext === 'xml') {
            if (soPrevia) {
              resultados.push(await previaXml(Buffer.from(b64, 'base64').toString('utf8'), nome))
              continue
            }
            const xml = Buffer.from(b64, 'base64').toString('utf8')
            const lancado = await importarXmlNaAgenda(pool, xml)
            const qtd = lancado.ja_existia ? 0 : (Number(lancado.quantidade) || 1)
            criadas += qtd
            resultados.push({
              nome,
              ok: true,
              tipo: 'nfe_xml',
              criadas: qtd,
              ja_existia: !!lancado.ja_existia,
              id: lancado.id,
            })
            continue
          }
          const linhas = classificar(lerArquivoDda(Buffer.from(b64, 'base64')), contexto)
          const prontas = linhas.filter((l) => l.pronto)
          if (soPrevia) {
            const total = linhas.reduce((a, l) => a + (Number(l.valor) || 0), 0)
            const prontasValor = prontas.reduce((a, l) => a + (Number(l.valor) || 0), 0)
            resultados.push({
              nome,
              ok: prontas.length > 0,
              tipo: 'dda',
              descricao: `${prontas.length} de ${linhas.length} linha(s) prontas`,
              valor: prontasValor || total || null,
              vencimento: prontas[0]?.vencimento || linhas[0]?.vencimento || null,
              empresa: prontas[0]?.empresa || linhas[0]?.empresa || null,
              forma_pagamento: 'boleto',
              linhas: linhas.length,
              prontas: prontas.length,
              erro: prontas.length ? null : 'Nenhuma linha pronta (confira colunas / CNPJ da loja).',
            })
            continue
          }
          if (!prontas.length) {
            resultados.push({
              nome,
              ok: false,
              tipo: 'dda',
              erro: 'Nenhuma linha pronta para lançar (confira colunas / CNPJ da loja).',
              criadas: 0,
              linhas: linhas.length,
            })
            continue
          }
          const r = await lancarDda(prontas, { paraAgenda })
          criadas += r.criadas
          resultados.push({
            nome,
            ok: true,
            tipo: 'dda',
            criadas: r.criadas,
            ignoradas: r.ignoradas,
            ids: r.ids,
          })
        } catch (err) {
          resultados.push({ nome, ok: false, erro: err.message || 'Não importou.', criadas: 0 })
        }
      }
      return send(res, soPrevia ? 200 : 201, JSON.stringify({ criadas, resultados }))
    }
    if (req.method === 'GET' && url.pathname === '/api/dda/sfg') {
      return send(res, 200, JSON.stringify(estadoSfg))
    }
    if (req.method === 'GET' && url.pathname === '/api/dda/bb') {
      return send(res, 200, JSON.stringify(estadoBb))
    }
    if (req.method === 'GET' && url.pathname === '/api/config/itau') {
      const acesso = await lerItau(pool, env)
      return send(res, 200, JSON.stringify(acesso.publico))
    }
    if (req.method === 'PUT' && url.pathname === '/api/config/itau') {
      const body = await readBody(req)
      try {
        return send(res, 200, JSON.stringify(await salvarItau(pool, body)))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não salvou o acesso.' }))
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/config/itau/coletar') {
      cicloSfg().catch((err) => console.error(`[sfg] ${err.message}`))
      return send(res, 202, JSON.stringify({ ok: true }))
    }
    if (req.method === 'GET' && url.pathname === '/api/config/bb') {
      return send(res, 200, JSON.stringify(await listarAcessosBb(pool)))
    }
    if (/^\/api\/config\/bb\/[^/]+$/.test(url.pathname) && (req.method === 'PUT' || req.method === 'DELETE')) {
      const empresaId = url.pathname.split('/').pop()
      if (req.method === 'DELETE') {
        await removerAcessoBb(pool, empresaId)
        return send(res, 200, JSON.stringify({ empresa_id: empresaId }))
      }
      const body = await readBody(req)
      try {
        return send(res, 200, JSON.stringify(await salvarAcessoBb(pool, empresaId, body)))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não salvou o acesso.' }))
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/config/bb/coletar') {
      cicloBb().catch((err) => console.error(`[bb] ${err.message}`))
      return send(res, 202, JSON.stringify({ ok: true }))
    }
    if (req.method === 'GET' && url.pathname === '/api/nfe/recebidas') {
      const notas = await listarNotasReceita(pool, url.searchParams.get('empresa') || '')
      return send(res, 200, JSON.stringify({ notas, coleta: estadoSefaz }))
    }
    if (req.method === 'GET' && /^\/api\/nfe\/recebidas\/[^/]+\/danfe$/.test(url.pathname)) {
      const id = url.pathname.split('/')[4]
      try {
        const pdf = await danfeNotaReceita(pool, id)
        return enviarPdf(res, pdf, `DANFE-${id}.pdf`)
      } catch (err) {
        return send(res, err.status || 502, JSON.stringify({ erro: err.message || 'Não abriu o DANFE.' }))
      }
    }
    if (req.method === 'POST' && /^\/api\/nfe\/recebidas\/[^/]+\/agenda$/.test(url.pathname)) {
      const id = url.pathname.split('/')[4]
      try {
        return send(res, 200, JSON.stringify(await lancarNotaNaAgenda(pool, id)))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não lançou na agenda.' }))
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/nfe/sefaz') {
      return send(res, 200, JSON.stringify(estadoSefaz))
    }
    if (req.method === 'POST' && url.pathname === '/api/nfe/coletar') {
      cicloSefaz().catch((err) => console.error(`[sefaz] ${err.message}`))
      return send(res, 202, JSON.stringify({ ok: true }))
    }
    send(res, 404, JSON.stringify({ erro: 'Não encontrado' }))
  } catch (err) {
    if (!res.headersSent) send(res, 500, JSON.stringify({ erro: 'Falha ao falar com o banco.' }))
    console.error(err)
  }
}

const intervaloVendas = Number(process.env.VENDAS_SYNC_MS || 180000)
const intervaloSfg = Number(process.env.ITAU_SFG_MS || 900000)
const intervaloBb = Number(process.env.BB_DDA_MS || 900000)
// Ambiente Nacional: com a fila em dia, a próxima consulta só depois de 1 hora.
// Menos que isso a Receita devolve consumo indevido e trava o CNPJ.
const intervaloSefaz = Number(process.env.SEFAZ_DFE_MS || 3600000)
let avisouSfg = false
let avisouBb = false

async function cicloSfg() {
  if (coletaSfg) return
  const acesso = await lerItau(pool, env).catch(() => null)
  const config = montarConfig(acesso?.linha, env)
  if (!config) {
    estadoSfg = {
      ok: false,
      mensagem: 'Caixa postal do Itaú ainda não está neste servidor.',
      criadas: 0,
      em: new Date().toISOString(),
    }
    if (!avisouSfg) {
      console.log('[sfg] sem host, usuário e chave. A coleta espera a caixa postal.')
      avisouSfg = true
    }
    return
  }
  const livro = ledgerSfg()
  coletaSfg = baixarRetornos(config, livro.recebidos, new Set(livro.itens.map((item) => item.remoto)))
  try {
    const baixados = await coletaSfg
    for (const item of baixados) {
      livro.itens.push({ remoto: item.remoto, local: item.local, situacao: 'pendente', criadas: 0 })
    }
    if (baixados.length) livro.gravar()
    let criadas = 0
    for (const item of livro.itens) {
      if (item.situacao !== 'pendente') continue
      try {
        const resultado = await lancarDda(lerCnab240(fs.readFileSync(item.local)))
        item.situacao = 'importado'
        item.criadas = resultado.criadas
        criadas += resultado.criadas
      } catch (err) {
        if (/sem boleto de DDA|CNAB 240 inválido/.test(err.message || '')) {
          item.situacao = 'ignorado'
          continue
        }
        throw err
      }
    }
    livro.gravar()
    const mensagem = baixados.length
      ? `${baixados.length} arquivo(s) da VAN, ${criadas} boleto(s) novo(s).`
      : 'VAN consultada. Nenhum retorno novo.'
    estadoSfg = { ok: true, mensagem, criadas, em: new Date().toISOString() }
    await registrarItau(pool, true, mensagem).catch(() => {})
    console.log(`[sfg] ${mensagem}`)
  } catch (err) {
    const mensagem = err.message || 'Falha ao puxar a VAN do Itaú'
    estadoSfg = { ok: false, mensagem, criadas: 0, em: new Date().toISOString() }
    await registrarItau(pool, false, mensagem).catch(() => {})
    console.error(`[sfg] ${mensagem}`)
  } finally {
    coletaSfg = null
  }
}

async function coletarEmpresasBb() {
  const credenciais = (await credenciaisAtivasBb(pool)).filter(configPronta)
  if (!credenciais.length) {
    estadoBb = {
      ok: false,
      mensagem: 'Nenhuma empresa com acesso do Banco do Brasil em Configuração.',
      criadas: 0,
      em: new Date().toISOString(),
    }
    if (!avisouBb) {
      console.log('[bb] nenhuma empresa com acesso completo. A coleta espera a configuração.')
      avisouBb = true
    }
    return
  }
  let criadas = 0
  let falhas = 0
  for (const credencial of credenciais) {
    try {
      const linhas = await listarBoletosBb(credencial)
      const resultado = await lancarDda(linhas)
      criadas += resultado.criadas
      const mensagem = linhas.length
        ? `${linhas.length} boleto(s), ${resultado.criadas} novo(s).`
        : 'Nenhum boleto a pagar no período.'
      await registrarColetaBb(pool, credencial.empresa_id, true, mensagem)
      console.log(`[bb] ${credencial.empresa}: ${mensagem}`)
    } catch (err) {
      falhas += 1
      const mensagem = err.message || 'Falha ao consultar o DDA do Banco do Brasil'
      await registrarColetaBb(pool, credencial.empresa_id, false, mensagem)
      console.error(`[bb] ${credencial.empresa}: ${mensagem}`)
    }
  }
  estadoBb = {
    ok: falhas === 0,
    mensagem: `${credenciais.length} empresa(s) consultada(s), ${criadas} boleto(s) novo(s)${falhas ? `, ${falhas} com erro` : ''}.`,
    criadas,
    em: new Date().toISOString(),
  }
}

async function cicloBb() {
  if (coletaBb) return coletaBb
  coletaBb = coletarEmpresasBb()
  try {
    await coletaBb
  } catch (err) {
    estadoBb = { ok: false, mensagem: err.message || 'Falha na coleta do Banco do Brasil', criadas: 0, em: new Date().toISOString() }
    console.error(`[bb] ${estadoBb.mensagem}`)
  } finally {
    coletaBb = null
  }
}

async function cicloSefaz() {
  if (coletaSefaz) return coletaSefaz
  coletaSefaz = coletarNotasReceita(pool)
  try {
    const resultado = await coletaSefaz
    estadoSefaz = {
      ok: resultado.ok,
      mensagem: resultado.mensagem,
      novas: resultado.novas,
      em: new Date().toISOString(),
    }
    console.log(`[sefaz] ${resultado.mensagem}`)
  } catch (err) {
    estadoSefaz = {
      ok: false,
      mensagem: err.message || 'Falha ao consultar notas na Receita Federal',
      novas: 0,
      em: new Date().toISOString(),
    }
    console.error(`[sefaz] ${estadoSefaz.mensagem}`)
  } finally {
    coletaSefaz = null
  }
}

async function cicloVendas() {
  if (coletaVendas) return
  const dia = hojeBR()
  coletaVendas = sincronizarVendasBk({ pool, env, inicio: dia, fim: dia })
  try {
    const resultado = await coletaVendas
    console.log(`[vendas] ${resultado.mensagem}`)
  } catch (err) {
    const mensagem = err.message || 'Falha na coleta de vendas'
    console.error(`[vendas] ${mensagem}`)
    await registrarFalhaVendas(pool, dia, dia, mensagem).catch((falha) => console.error(falha.message))
  } finally {
    coletaVendas = null
  }
}

let iniciado = false

export function iniciarFinanceiro() {
  if (iniciado) return
  iniciado = true
  console.log(`[financeiro] schema finance em ${financeDb}`)
  if (intervaloVendas >= 60000) {
    setTimeout(cicloVendas, 8000)
    setInterval(cicloVendas, intervaloVendas)
  }
  if (intervaloSfg >= 60000) {
    setTimeout(cicloSfg, 12000)
    setInterval(cicloSfg, intervaloSfg)
  }
  garantirSchemaFonte(pool).catch((err) => console.error(`[financeiro] fonte: ${err.message}`))
  garantirSchemaDespesaId(pool).catch((err) => console.error(`[financeiro] despesa.id: ${err.message}`))
  garantirSchemaBb(pool).catch((err) => console.error(`[financeiro] bb: ${err.message}`))
  garantirSchemaItau(pool).catch((err) => console.error(`[financeiro] sfg: ${err.message}`))
  garantirSchemaCaixa(pool).catch((err) => console.error(`[financeiro] caixa: ${err.message}`))
  garantirSchemaSefaz(pool).catch((err) => console.error(`[financeiro] sefaz: ${err.message}`))
  if (intervaloSefaz >= 60000) {
    setTimeout(cicloSefaz, 20000)
    setInterval(cicloSefaz, intervaloSefaz)
  }
  if (intervaloBb >= 60000) {
    setTimeout(cicloBb, 15000)
    setInterval(cicloBb, intervaloBb)
  }
  pool.query(`
    alter table despesas add column if not exists dados_pagamento text;
    alter table despesas add column if not exists numero_nf text;
    alter table despesas add column if not exists cnpj_cedente text;
    alter table despesas add column if not exists nfe_id text;
    alter table despesas add column if not exists nf_confirmada boolean not null default false;
    alter table despesas add column if not exists boleto_arquivo text;
    alter table despesas add column if not exists nota_arquivo text;
  `).catch((err) => {
    console.error(`[financeiro] ${err.message}`)
  })
}
