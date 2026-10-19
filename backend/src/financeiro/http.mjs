import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { acharFornecedor, classificar, descricaoDda, lerArquivoDda, lerCnab240 } from './lib/dda.mjs'
import { baixarRetornos, garantirSchemaItau, lerItau, montarConfig, registrarItau, salvarItau } from './lib/itauSfg.mjs'
import {
  coletarExtratoItau,
  garantirSchemaExtratoItau,
  listarCredenciaisExtrato,
  listarLancamentosExtrato,
  removerCredencialExtrato,
  salvarCredencialExtrato,
} from './lib/itauExtrato.mjs'
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
import { garantirSchemaCaixa, lerComprovante, mesFechamentos, receberHeartbeat, receberIngestao, resumoCanaisPeriodo, salvarFechamento } from './lib/fechamentoCaixa.mjs'
import { gerarDanfe } from './lib/danfe.mjs'
import { baixarBoletoDaDespesa, baixarNotaDaDespesa } from './lib/boletoEsupri.mjs'
import { sincronizarNfesConferidas } from './lib/nfEntrada.mjs'
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
import { montarPlanilhaBanco, nomeArquivoPlanilha } from './lib/planilhaBanco.mjs'
import { auditar } from '../auditoriaHelpers.js'

function metaFinanceiro(req, payload) {
  if (!req) return
  req.auditoriaMeta = {
    modulo: 'financeiro',
    ...payload,
  }
}
import {
  confirmarConciliacao,
  desfazerConciliacao,
  diaConciliacao,
  garantirSchemaConciliacao,
  importarExtrato,
  listaConciliacao,
  marcarSemPar,
  painelConciliacao,
  periodoConciliacao,
  semanaConciliacao,
} from './lib/conciliacaoExtrato.mjs'

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

/**
 * Banco do schema finance.
 * Em dev o portal usa vision_check_dev (DB_NAME); o financeiro fica em produção
 * (FINANCE_DB_NAME / DB_NAME_PROD / vision_check), onde existem empresas/despesas.
 */
function nomeBancoFinanceiro() {
  if (process.env.FINANCE_DB_NAME) return process.env.FINANCE_DB_NAME
  const arquivo = {
    ...lerEnvArquivo(path.join(portalRoot, '.env')),
    ...lerEnvArquivo(path.join(portalRoot, 'backend', '.env')),
  }
  return arquivo.FINANCE_DB_NAME || arquivo.DB_NAME_PROD || 'vision_check'
}

async function garantirSchemaFonte(db) {
  await db.query(fs.readFileSync(path.join(root, 'db', '010_despesa_fonte.sql'), 'utf8'))
  await db.query(fs.readFileSync(path.join(root, 'db', '015_despesa_pendente_inbox.sql'), 'utf8'))
  await db.query(fs.readFileSync(path.join(root, 'db', '016_despesa_acrescimos.sql'), 'utf8'))
  await db.query(fs.readFileSync(path.join(root, 'db', '017_despesa_conferencia.sql'), 'utf8'))
  try {
    const { garantirSchemaFreecontrol } = await import('./lib/importFreecontrol.mjs')
    await garantirSchemaFreecontrol(db)
  } catch (err) {
    console.error(`[financeiro] freecontrol schema: ${err.message}`)
  }
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

function dinheiroNaoNegativo(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return null
  return Math.round(v * 100) / 100
}

/** Valor de face + taxas. `valor` gravado é o total que entra na agenda. */
function lerAcrescimo(body) {
  const modo = body.modo_acrescimo === 'taxas' ? 'taxas' : 'total'
  const face = dinheiroNaoNegativo(body.valor_face != null && body.valor_face !== '' ? body.valor_face : body.valor)
  if (face == null) return { erro: 'Valor inválido.' }
  const multa = modo === 'taxas' ? (dinheiroNaoNegativo(body.multa) ?? 0) : 0
  const juros = modo === 'taxas' ? (dinheiroNaoNegativo(body.juros) ?? 0) : 0
  const outras = modo === 'taxas' ? (dinheiroNaoNegativo(body.outras_taxas) ?? 0) : 0
  const desconto = modo === 'taxas' ? (dinheiroNaoNegativo(body.desconto) ?? 0) : 0
  if ([multa, juros, outras, desconto].some((n) => n == null)) return { erro: 'Taxa inválida.' }
  const total = modo === 'taxas'
    ? Math.round((face + multa + juros + outras - desconto) * 100) / 100
    : dinheiroNaoNegativo(body.valor)
  if (total == null || total < 0) return { erro: 'Total inválido.' }
  const vencimentoOriginal = body.vencimento_original || null
  const vencimento = body.vencimento || vencimentoOriginal || null
  return { modo, face, multa, juros, outras, desconto, total, vencimento, vencimentoOriginal }
}

const sessao = { nome: 'Felipe', papel: 'Autoriza' }
let coletaVendas = null
let coletaSfg = null
let coletaBb = null
let coletaExtrato = null
let coletaSefaz = null
let estadoBb = {
  ok: false,
  mensagem: 'A coleta do Banco do Brasil ainda não rodou.',
  codigo: 'bb_nao_rodou',
  criadas: 0,
  empresas: 0,
  falhas: 0,
  em: null,
}
let estadoExtratoItau = {
  ok: false,
  mensagem: 'A coleta do extrato Itaú ainda não rodou.',
  codigo: 'itau_extrato_nao_rodou',
  contas: 0,
  lancamentos: 0,
  sugestoes: 0,
  em: null,
}
let estadoSfg = {
  ok: false,
  mensagem: 'A coleta da VAN do Itaú ainda não rodou.',
  codigo: 'itau_nao_rodou',
  criadas: 0,
  arquivos: 0,
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
  // Liga boletos ↔ NF; cria na Agenda as conferidas sem DDA (fonte=nfe).
  const { pool: portalPool } = await import('../db.js')
  const resumo = await sincronizarNfesConferidas({ financePool: pool, portalPool })
  if (resumo.ligadas || resumo.criadas || resumo.reativadas) {
    console.log(
      `[financeiro] NF → ligadas=${resumo.ligadas} criadas=${resumo.criadas} reativadas=${resumo.reativadas || 0} ignoradas=${resumo.ignoradas}`,
    )
  }
  return resumo
}

let sincronizandoNotas = null
let ultimoSyncNotas = 0
const INTERVALO_SYNC_NOTAS_MS = 90_000

function sincronizarNotasEmFundo() {
  if (sincronizandoNotas) return
  if (Date.now() - ultimoSyncNotas < INTERVALO_SYNC_NOTAS_MS) return
  ultimoSyncNotas = Date.now()
  sincronizandoNotas = (async () => {
    try { await vincularFornecedores() } catch (err) { console.error(err.message) }
    try { await amarrarNotas() } catch (err) { console.error(err.message) }
    try { await amarrarDdaComNotasReceita(pool) } catch (err) { console.error(err.message) }
  })().finally(() => { sincronizandoNotas = null })
}

async function empresaIdsPorLojas(lojaIds) {
  const ids = [...new Set((lojaIds || []).map(Number).filter((n) => n > 0))]
  if (!ids.length) return []

  // Lojas ficam no banco do portal; empresas no schema finance — cruza por BK/CNPJ/nome.
  let lojasPortal = []
  try {
    const { pool: portalPool } = await import('../db.js')
    const { rows } = await portalPool.query(
      `
      select id_loja, name, cnpj, bk_number::text as bk_number
      from lojas
      where id_loja = any($1::int[])
      `,
      [ids],
    )
    lojasPortal = rows
  } catch {
    lojasPortal = []
  }

  const bks = [...new Set(
    lojasPortal
      .map((l) => String(l.bk_number || '').replace(/\D/g, ''))
      .filter((b) => b.length > 0),
  )]
  const cnpjs = [...new Set(
    lojasPortal
      .map((l) => String(l.cnpj || '').replace(/\D/g, ''))
      .filter((c) => c.length === 14),
  )]
  const nomes = [...new Set(
    lojasPortal
      .map((l) => String(l.name || '').trim())
      .filter(Boolean),
  )]

  if (!bks.length && !cnpjs.length && !nomes.length) {
    // Fallback: se o finance tiver tabela lojas, tenta o join antigo.
    try {
      const { rows } = await pool.query(
        `
        select distinct e.id::text as id
        from empresas e
        join lojas l on l.id_loja = any($1::int[])
        where e.ativo
          and (
            (
              nullif(btrim(coalesce(e.bk_number, '')), '') is not null
              and regexp_replace(e.bk_number::text, '\\D', '', 'g')
                = regexp_replace(l.bk_number::text, '\\D', '', 'g')
            )
            or (
              length(regexp_replace(coalesce(e.cnpj, ''), '\\D', '', 'g')) = 14
              and regexp_replace(coalesce(e.cnpj, ''), '\\D', '', 'g')
                = regexp_replace(coalesce(l.cnpj, ''), '\\D', '', 'g')
            )
          )
        `,
        [ids],
      )
      return rows.map((r) => r.id)
    } catch {
      return []
    }
  }

  const { rows } = await pool.query(
    `
    select e.id::text as id, e.apelido, e.cnpj, e.bk_number
    from empresas e
    where e.ativo
    `,
  )
  const achados = new Set()
  for (const e of rows) {
    const eBk = String(e.bk_number || '').replace(/\D/g, '')
    const eCnpj = String(e.cnpj || '').replace(/\D/g, '')
    const eNome = String(e.apelido || '').toUpperCase()
    if (eBk && bks.includes(eBk)) {
      achados.add(e.id)
      continue
    }
    if (eCnpj.length === 14 && cnpjs.includes(eCnpj)) {
      achados.add(e.id)
      continue
    }
    if (eNome && nomes.some((n) => {
      const u = n.toUpperCase()
      return u === eNome || u.includes(eNome) || eNome.includes(u.split(' - ').pop() || u)
    })) {
      achados.add(e.id)
    }
  }
  return [...achados]
}

async function listarDespesas(empresaId, { empresaIds = null } = {}) {
  const params = []
  const wheres = []
  if (empresaId) {
    params.push(empresaId)
    wheres.push(`d.empresa_origem_id = $${params.length}`)
  }
  if (Array.isArray(empresaIds)) {
    if (!empresaIds.length) return []
    params.push(empresaIds)
    wheres.push(`d.empresa_origem_id::text = any($${params.length}::text[])`)
  }
  const where = wheres.length ? `where ${wheres.join(' and ')}` : ''
  const { rows } = await pool.query(`
    select d.id,
           coalesce(nullif(btrim(d.descricao), ''), nullif(btrim(f.nome), ''),
             case when nullif(btrim(d.numero_nf), '') is not null then 'NF ' || btrim(d.numero_nf) else 'Boleto DDA' end
           ) as descricao,
           d.valor::float8 as valor,
           coalesce(d.valor_face, d.valor)::float8 as valor_face,
           coalesce(d.multa, 0)::float8 as multa,
           coalesce(d.juros, 0)::float8 as juros,
           coalesce(d.outras_taxas, 0)::float8 as outras_taxas,
           coalesce(d.desconto, 0)::float8 as desconto,
           coalesce(d.modo_acrescimo, 'total') as modo_acrescimo,
           to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           to_char(d.vencimento_original, 'YYYY-MM-DD') as vencimento_original,
           to_char(d.competencia, 'YYYY-MM-DD') as competencia, d.forma_pagamento, d.status,
           d.documento_ref, d.numero_nf, d.nfe_id, d.nf_confirmada, coalesce(d.nf_divergente, false) as nf_divergente,
           coalesce(
             nullif(btrim(d.nf_ciclo), ''),
             case
               when coalesce(d.nf_confirmada, false) and coalesce(d.nf_divergente, false) then 'divergente'
               when coalesce(d.nf_confirmada, false) then 'confirmada'
               else null
             end
           ) as nf_ciclo,
           d.conferencia_status,
           d.tributo_tipo,
           d.empresa_origem_id as origem_id, eo.apelido as origem, eo.razao_social as origem_razao,
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
             when d.documento_ref like 'FC|%' then 'freecontrol'
             when d.documento_ref like 'ESTOQUE-NFE|%' then 'nfe'
             when d.forma_pagamento = 'boleto' and d.documento_ref ~ '^\\d{44}$' then 'dda'
             else 'manual'
           end) as fonte,
           d.freecontrol_tipo,
           nr.id as nfe_recebida_id,
           (nr.id is not null) as tem_nfe_receita,
           nr.chave as nfe_chave,
           nr.tem_xml as nfe_tem_xml,
           coalesce(d.pendente_inbox, false) as pendente_inbox
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    left join (
      select distinct on (despesa_id)
             despesa_id, id, chave, tem_xml
      from nfe_recebida
      where despesa_id is not null
      order by despesa_id, atualizado_em desc nulls last
    ) nr on nr.despesa_id = d.id
    left join contas_bancarias cs on cs.id = d.conta_saida_id
    left join empresas er on er.id = d.empresa_registro_id
    left join fornecedores f on f.id = d.fornecedor_id
    left join plano_contas p on p.id = d.plano_conta_id
    left join (
      select distinct on (fornecedor_id) fornecedor_id, chave_pix
      from fornecedor_pagamentos
      where meio = 'pix' and chave_pix is not null and chave_pix <> ''
      order by fornecedor_id
    ) pix on pix.fornecedor_id = d.fornecedor_id
    ${where}
    order by d.valor desc nulls last, d.vencimento nulls last, d.descricao
  `, params)
  setTimeout(sincronizarNotasEmFundo, 0)
  setTimeout(() => { classificarTributosEmFundo().catch(() => {}) }, 0)
  const { classificarTributo, rotuloTributo, portalTributo } = await import('./lib/classificarTributo.mjs')
  return rows.map((row) => {
    const fonte = String(row.fonte || '').toLowerCase()
    let conferencia_status = row.conferencia_status || null
    let tributo_tipo = row.tributo_tipo || null
    if (fonte === 'freecontrol' && !conferencia_status) conferencia_status = 'ok'
    if (!tributo_tipo) {
      tributo_tipo = classificarTributo({
        descricao: row.descricao,
        fornecedor: row.fornecedor,
        plano: row.plano,
        documento_ref: row.documento_ref,
        forma_pagamento: row.forma_pagamento,
        freecontrol_tipo: row.freecontrol_tipo,
        fonte: row.fonte,
      })
    }
    if (tributo_tipo && !conferencia_status && fonte !== 'freecontrol') {
      conferencia_status = 'pendente'
    }
    return {
      ...row,
      conferencia_status,
      tributo_tipo,
      tributo_rotulo: tributo_tipo ? rotuloTributo(tributo_tipo) : null,
      tributo_portal: tributo_tipo ? portalTributo(tributo_tipo) : null,
    }
  })
}

let classificandoTributos = null
async function classificarTributosEmFundo() {
  if (classificandoTributos) return
  classificandoTributos = (async () => {
    await pool.query(`
      alter table despesas add column if not exists conferencia_status text;
      alter table despesas add column if not exists tributo_tipo text;
      alter table despesas add column if not exists conferencia_detalhe text;
    `).catch(() => {})
    // Free Control sem status → OK
    await pool.query(`
      update despesas
         set conferencia_status = 'ok'
       where fonte = 'freecontrol'
         and status <> 'cancelada'
         and conferencia_status is null
    `)
    const { sincronizarConferenciaTributos } = await import('./lib/conferirTributo.mjs')
    const resumo = await sincronizarConferenciaTributos(pool)
    if (resumo.classificados || resumo.conferidos) {
      console.log(
        `[financeiro] tributos → classificados=${resumo.classificados} confirmados=${resumo.conferidos} pendentes=${resumo.pendentes}`,
      )
    }
  })().finally(() => { classificandoTributos = null })
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

/** Lote semanal Free Control → Contas a Pagar (Bearer FREECONTROL_MERIDIAN_TOKEN). */
export async function receberFreecontrolLote(req, res) {
  try {
    if (!req.body || typeof req.body !== 'object') {
      req.body = await readBody(req)
    }
    const { receberLoteFreecontrol } = await import('./lib/importFreecontrol.mjs')
    const resultado = await receberLoteFreecontrol(pool, req, env)
    void auditar(req, {
      idUsuario: null,
      modulo: 'financeiro',
      acao: 'importar',
      entidade: 'freecontrol_lote',
      idReferencia: resultado?.period_key || null,
      descricao: `Recebeu lote Free Control (${resultado?.period_from || '?'} a ${resultado?.period_to || '?'}) — criadas=${resultado?.criadas ?? 0} existentes=${resultado?.existentes ?? 0}`,
      detalhes: {
        period_key: resultado?.period_key,
        criadas: resultado?.criadas,
        existentes: resultado?.existentes,
        ignoradas: resultado?.ignoradas,
      },
    })
    return send(res, 200, JSON.stringify(resultado))
  } catch (err) {
    return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não importou o lote Free Control.' }))
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
      const { temPermissao, acessoTodasLojas } = await import('../permissoes.js')
      const user = req.user
      const soResumo = user
        && temPermissao(user, 'financeiro.resumo.ver')
        && !temPermissao(user, 'financeiro.ver')
      let empresaIds = null
      if (soResumo && !acessoTodasLojas(user)) {
        empresaIds = await empresaIdsPorLojas(user.lojas_ids || [])
      }
      return send(res, 200, JSON.stringify(await listarDespesas(url.searchParams.get('empresa') || '', { empresaIds })))
    }
    if (req.method === 'GET' && url.pathname === '/api/despesas/planilha-banco') {
      const de = String(url.searchParams.get('de') || '').slice(0, 10)
      const ate = String(url.searchParams.get('ate') || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
        return send(res, 400, JSON.stringify({ erro: 'Informe o período da agenda.' }))
      }
      const empresaId = String(url.searchParams.get('empresa') || '').trim()
      const params = [de, ate]
      if (empresaId) params.push(empresaId)
      const empresas = await pool.query(`
        select e.id::text as id, e.apelido, e.razao_social, e.tipo
        from empresas e
        where e.ativo
          ${empresaId ? 'and e.id = $1' : ''}
        order by e.apelido
      `, empresaId ? [empresaId] : [])
      const linhas = await pool.query(`
        select d.empresa_origem_id::text as origem_id,
               eo.apelido,
               d.descricao,
               f.nome as fornecedor,
               f.razao_social,
               d.valor::float8 as valor,
               to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
               d.numero_nf,
               d.forma_pagamento,
               coalesce(nullif(d.dados_pagamento, ''), pix.chave_pix) as pagamento,
               d.documento_ref,
               d.fonte,
               d.freecontrol_tipo,
               coalesce(d.nf_confirmada, false) as nf_confirmada,
               coalesce(d.nf_divergente, false) as nf_divergente,
               coalesce(
                 nullif(btrim(d.nf_ciclo), ''),
                 case
                   when coalesce(d.nf_confirmada, false) and coalesce(d.nf_divergente, false) then 'divergente'
                   when coalesce(d.nf_confirmada, false) then 'confirmada'
                   when coalesce(d.fonte, '') in ('dda', 'nfe')
                     or nullif(btrim(d.numero_nf), '') is not null then 'nao_confirmada'
                   else null
                 end
               ) as nf_ciclo,
               d.conferencia_status,
               d.tributo_tipo,
               p.nome as plano,
               er.apelido as registrado_em
        from despesas d
        join empresas eo on eo.id = d.empresa_origem_id
        left join empresas er on er.id = d.empresa_registro_id
        left join fornecedores f on f.id = d.fornecedor_id
        left join plano_contas p on p.id = d.plano_conta_id
        left join (
          select distinct on (fornecedor_id) fornecedor_id, chave_pix
          from fornecedor_pagamentos
          where meio = 'pix' and chave_pix is not null and chave_pix <> ''
          order by fornecedor_id
        ) pix on pix.fornecedor_id = d.fornecedor_id
        where d.status not in ('cancelada', 'paga', 'conciliada')
          and d.vencimento between $1::date and $2::date
          and not (
            d.status in ('rascunho', 'classificada', 'bloqueada_duplicata')
            and (
              d.fonte in ('dda', 'nfe')
              or (coalesce(d.fonte, 'manual') = 'manual' and coalesce(d.pendente_inbox, false))
            )
          )
          ${empresaId ? 'and d.empresa_origem_id = $3' : ''}
        order by d.valor desc, d.vencimento, coalesce(nullif(trim(d.descricao), ''), f.nome, d.numero_nf)
      `, params)
      const { classificarTributo } = await import('./lib/classificarTributo.mjs')
      const linhasPlanilha = linhas.rows.map((row) => {
        const fonte = String(row.fonte || '').toLowerCase()
        let conferencia_status = row.conferencia_status || null
        let tributo_tipo = row.tributo_tipo || null
        if (fonte === 'freecontrol' && !conferencia_status) conferencia_status = 'ok'
        if (!tributo_tipo) tributo_tipo = classificarTributo(row)
        if (tributo_tipo && !conferencia_status && fonte !== 'freecontrol') conferencia_status = 'pendente'
        return { ...row, conferencia_status, tributo_tipo }
      })
      const buffer = await montarPlanilhaBanco({ de, ate, empresas: empresas.rows, linhas: linhasPlanilha })
      const nome = nomeArquivoPlanilha(de, ate)
      metaFinanceiro(req, {
        acao: 'download',
        entidade: 'planilha_banco',
        idReferencia: `${de}_${ate}`,
        descricao: `Baixou planilha BANCO (${de} a ${ate}) — ${linhas.rows.length} linha(s)`,
        detalhes: { de, ate, linhas: linhas.rows.length, empresa: empresaId || null, arquivo: nome },
      })
      res.writeHead(200, {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${nome}"`,
        'cache-control': 'no-store',
      })
      return res.end(buffer)
    }
    if (req.method === 'GET' && url.pathname === '/api/conciliacao/periodo') {
      const contaId = String(url.searchParams.get('conta') || '').trim()
      const de = String(url.searchParams.get('de') || '').slice(0, 10)
      const ate = String(url.searchParams.get('ate') || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
        return send(res, 400, JSON.stringify({ erro: 'Informe o período.' }))
      }
      const dias = Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000)
      if (dias > 62) return send(res, 400, JSON.stringify({ erro: 'O período máximo é de 62 dias.' }))
      await garantirSchemaConciliacao(pool)
      try {
        return send(res, 200, JSON.stringify(await periodoConciliacao(pool, { contaId, de, ate })))
      } catch (err) {
        return send(res, 400, JSON.stringify({ erro: err.message || 'Não carregou a conciliação.' }))
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/conciliacao/painel') {
      const de = String(url.searchParams.get('de') || '').slice(0, 10)
      const ate = String(url.searchParams.get('ate') || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
        return send(res, 400, JSON.stringify({ erro: 'Informe a semana.' }))
      }
      const dias = Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000)
      if (dias > 21) return send(res, 400, JSON.stringify({ erro: 'A conciliação abre uma semana.' }))
      await garantirSchemaConciliacao(pool)
      try {
        return send(res, 200, JSON.stringify(await painelConciliacao(pool, { de, ate })))
      } catch (err) {
        return send(res, 400, JSON.stringify({ erro: err.message || 'Não carregou a conciliação.' }))
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/conciliacao/semana') {
      const empresaId = String(url.searchParams.get('empresa') || '').trim()
      const de = String(url.searchParams.get('de') || '').slice(0, 10)
      const ate = String(url.searchParams.get('ate') || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
        return send(res, 400, JSON.stringify({ erro: 'Informe a semana.' }))
      }
      await garantirSchemaConciliacao(pool)
      return send(res, 200, JSON.stringify(await semanaConciliacao(pool, { empresaId, de, ate })))
    }
    if (req.method === 'GET' && url.pathname === '/api/conciliacao/lista') {
      const empresaId = String(url.searchParams.get('empresa') || '').trim()
      const de = String(url.searchParams.get('de') || '').slice(0, 10)
      const ate = String(url.searchParams.get('ate') || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
        return send(res, 400, JSON.stringify({ erro: 'Informe o período.' }))
      }
      const dias = Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000)
      if (dias > 62) return send(res, 400, JSON.stringify({ erro: 'O período máximo é de 62 dias.' }))
      await garantirSchemaConciliacao(pool)
      try {
        return send(res, 200, JSON.stringify(await listaConciliacao(pool, { empresaId, de, ate })))
      } catch (err) {
        return send(res, 400, JSON.stringify({ erro: err.message || 'Não carregou a lista.' }))
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/conciliacao/dia') {
      const empresaId = String(url.searchParams.get('empresa') || '').trim()
      const data = String(url.searchParams.get('data') || '').slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        return send(res, 400, JSON.stringify({ erro: 'Informe o dia.' }))
      }
      await garantirSchemaConciliacao(pool)
      return send(res, 200, JSON.stringify(await diaConciliacao(pool, { empresaId, data })))
    }
    if (req.method === 'POST' && url.pathname === '/api/conciliacao/upload') {
      const body = await readBody(req)
      await garantirSchemaConciliacao(pool)
      try {
        return send(res, 201, JSON.stringify(await importarExtrato(pool, {
          contaId: String(body.conta_id || '').trim() || null,
          empresaId: String(body.empresa_id || '').trim() || null,
          nome: body.nome || 'extrato.ofx',
          base64: body.base64,
        })))
      } catch (err) {
        return send(res, err.codigo ? 422 : 400, JSON.stringify({
          erro: err.message || 'Não importou o extrato.',
          codigo: err.codigo || null,
          contas: err.contas || [],
        }))
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/conciliacao/confirmar') {
      const body = await readBody(req)
      await garantirSchemaConciliacao(pool)
      try {
        return send(res, 200, JSON.stringify(await confirmarConciliacao(pool, {
          lancamentoId: body.lancamento_id,
          despesaId: body.despesa_id,
        })))
      } catch (err) {
        return send(res, 400, JSON.stringify({ erro: err.message || 'Não conciliou.' }))
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/conciliacao/desfazer') {
      const body = await readBody(req)
      await garantirSchemaConciliacao(pool)
      try {
        return send(res, 200, JSON.stringify(await desfazerConciliacao(pool, {
          lancamentoId: body.lancamento_id,
        })))
      } catch (err) {
        return send(res, 400, JSON.stringify({ erro: err.message || 'Não desfez.' }))
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/conciliacao/sem-par') {
      const body = await readBody(req)
      await garantirSchemaConciliacao(pool)
      try {
        return send(res, 200, JSON.stringify(await marcarSemPar(pool, {
          lancamentoId: body.lancamento_id,
        })))
      } catch (err) {
        return send(res, 400, JSON.stringify({ erro: err.message || 'Não marcou.' }))
      }
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
      const { temPermissao, acessoTodasLojas } = await import('../permissoes.js')
      const user = req.user
      const soResumo = user
        && temPermissao(user, 'financeiro.resumo.ver')
        && !temPermissao(user, 'financeiro.ver')
      let idsFiltro = null
      if (soResumo && !acessoTodasLojas(user)) {
        idsFiltro = await empresaIdsPorLojas(user.lojas_ids || [])
        if (!idsFiltro.length) {
          return send(res, 200, JSON.stringify([]))
        }
      }
      const { rows } = await pool.query(`
        select id, apelido, razao_social, tipo, cnpj, bk_number
        from empresas
        where ativo
          ${idsFiltro ? 'and id::text = any($1::text[])' : ''}
        order by tipo, apelido
      `, idsFiltro ? [idsFiltro] : [])
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
      const limite = Math.min(Number(url.searchParams.get('limite')) || 40, 200)
      const digitos = q.replace(/\D/g, '')
      // Sem busca: lista os primeiros ativos (para abrir o autocomplete).
      // Com 1+ caracteres: filtra por nome, razão social ou CNPJ.
      const { rows } = q
        ? await pool.query(`
            select f.id, f.nome, f.cpf_cnpj, f.plano_conta_id, p.nome as plano
            from fornecedores f
            left join plano_contas p on p.id = f.plano_conta_id
            where f.ativo
              and (
                f.nome ilike $1
                or coalesce(f.razao_social, '') ilike $1
                or regexp_replace(coalesce(f.cpf_cnpj, ''), '\\D', '', 'g') like $2
              )
            order by f.nome
            limit $3
          `, [`%${q}%`, `%${digitos || '-'}%`, limite])
        : await pool.query(`
            select f.id, f.nome, f.cpf_cnpj, f.plano_conta_id, p.nome as plano
            from fornecedores f
            left join plano_contas p on p.id = f.plano_conta_id
            where f.ativo
            order by f.nome
            limit $1
          `, [limite])
      return send(res, 200, JSON.stringify(rows))
    }
    if (req.method === 'POST' && url.pathname === '/api/despesas/freecontrol-lote') {
      return receberFreecontrolLote(req, res)
    }
    if (req.method === 'POST' && url.pathname === '/api/despesas') {
      const body = await readBody(req)
      const acrescimo = lerAcrescimo(body)
      if (acrescimo.erro || !body.descricao || !body.empresa_origem_id) {
        return send(res, 400, JSON.stringify({ erro: acrescimo.erro || 'Descrição, origem e valor são obrigatórios.' }))
      }
      if (body.forma_pagamento && !FORMAS.has(body.forma_pagamento)) {
        return send(res, 400, JSON.stringify({ erro: 'Forma de pagamento inválida.' }))
      }
      // Idempotência: clique duplo no "Criar" em poucos segundos não gera 2ª despesa.
      const recent = await pool.query(`
        select id::text as id, status
        from despesas
        where fonte = 'manual'
          and status <> 'cancelada'
          and empresa_origem_id = $1
          and coalesce(fornecedor_id::text, '') = coalesce($2::text, '')
          and btrim(descricao) = btrim($3)
          and valor = $4::numeric
          and coalesce(vencimento::date, '1900-01-01'::date)
              = coalesce($5::date, '1900-01-01'::date)
          and created_at > now() - interval '15 seconds'
        order by created_at desc
        limit 1
      `, [
        body.empresa_origem_id,
        body.fornecedor_id || null,
        String(body.descricao).trim(),
        acrescimo.total,
        acrescimo.vencimento,
      ])
      if (recent.rowCount) {
        return send(res, 200, JSON.stringify(recent.rows[0]))
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
          documento_ref, competencia, vencimento, vencimento_original, valor, valor_face, multa, juros, outras_taxas, desconto, modo_acrescimo,
          forma_pagamento, dados_pagamento, status, fonte, pendente_inbox
        ) values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'manual', true)
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
        acrescimo.vencimento,
        acrescimo.vencimentoOriginal,
        acrescimo.total,
        acrescimo.face,
        acrescimo.multa,
        acrescimo.juros,
        acrescimo.outras,
        acrescimo.desconto,
        acrescimo.modo,
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
          `update despesas set status = 'pronta', pendente_inbox = false
           where id = any($1::uuid[])
             and status not in ('paga', 'conciliada', 'cancelada', 'pronta', 'autorizada', 'enviada')
           returning id::text as id, status`,
          [paraAtualizar],
        )
        enviados.push(...up.rows)
      }
      metaFinanceiro(req, {
        acao: 'autorizar',
        entidade: 'despesa',
        idReferencia: paraAtualizar[0] || enviados[0]?.id || null,
        descricao: `Enviou ${paraAtualizar.length || enviados.length} título(s) para a Agenda banco`,
        detalhes: { enviados: enviados.length, bloqueados: bloqueados.length, novos: paraAtualizar.length },
      })
      return send(res, 200, JSON.stringify({ enviados, bloqueados }))
    }
    /** Altera status da NF na Agenda (confirmada / parcial / não confirmada). */
    {
      const mNf = url.pathname.match(/^\/api\/despesas\/([0-9a-f-]{36})\/nf-status$/i)
      if (req.method === 'POST' && mNf) {
        const id = mNf[1]
        const body = await readBody(req)
        const ciclo = String(body?.ciclo || '').toLowerCase()
        if (!['confirmada', 'divergente', 'nao_confirmada'].includes(ciclo)) {
          return send(res, 400, JSON.stringify({
            erro: 'Ciclo inválido. Use confirmada, divergente ou nao_confirmada.',
          }))
        }
        const atual = await pool.query(
          `select id::text as id, nfe_id, fonte, numero_nf, status
             from despesas where id = $1`,
          [id],
        )
        if (!atual.rowCount) return send(res, 404, JSON.stringify({ erro: 'Despesa não encontrada.' }))
        const despesa = atual.rows[0]
        const fonte = String(despesa.fonte || '').toLowerCase()
        if (fonte === 'freecontrol' || fonte === 'manual') {
          return send(res, 400, JSON.stringify({ erro: 'Free Control / manual não cruzam NF da loja.' }))
        }

        let estoque = null
        if (ciclo === 'confirmada' && despesa.nfe_id) {
          try {
            const { conferirRecebimentoNfe } = await import('../services/estoqueCmvReal.js')
            estoque = await conferirRecebimentoNfe({
              id_nfe: Number(despesa.nfe_id),
              confirmar_todos: true,
              criado_por: req.user?.id_usuario || req.user?.sub || null,
            })
            if (estoque?.divergente) {
              // Conferência no estoque ficou divergente — respeita.
            }
          } catch (err) {
            // 409 = já lançada no estoque: só espelha selo na Agenda.
            if (err?.status && err.status !== 409) {
              return send(res, err.status, JSON.stringify({ erro: err.message }))
            }
          }
        }

        const cicloFinal =
          ciclo === 'confirmada' && estoque?.divergente ? 'divergente' : ciclo
        const confirmada = cicloFinal === 'confirmada' || cicloFinal === 'divergente'
        const divergente = cicloFinal === 'divergente'

        await pool.query(`
          alter table despesas add column if not exists nf_ciclo text
        `).catch(() => {})

        const up = await pool.query(
          `update despesas set
             nf_ciclo = $2,
             nf_confirmada = $3,
             nf_divergente = $4
           where id = $1
           returning id::text as id, nf_ciclo, nf_confirmada, nf_divergente, nfe_id`,
          [id, cicloFinal, confirmada, divergente],
        )
        metaFinanceiro(req, {
          acao: 'atualizar',
          entidade: 'despesa_nf',
          idReferencia: id,
          descricao: `Alterou status NF da despesa para ${cicloFinal}`,
          detalhes: { ciclo: cicloFinal, nfe_id: despesa.nfe_id, estoque: !!estoque },
        })
        return send(res, 200, JSON.stringify({ ...up.rows[0], estoque }))
      }
    }
    /** Conferência Free Control (ok/pendente) ou tributo (pendente/conferido). */
    {
      const mConf = url.pathname.match(/^\/api\/despesas\/([0-9a-f-]{36})\/conferencia$/i)
      if (req.method === 'POST' && mConf) {
        const id = mConf[1]
        const body = await readBody(req)
        const status = String(body?.status || '').toLowerCase()
        if (!['ok', 'pendente', 'conferido'].includes(status)) {
          return send(res, 400, JSON.stringify({ erro: 'Status inválido. Use ok, pendente ou conferido.' }))
        }
        await pool.query(`
          alter table despesas add column if not exists conferencia_status text;
          alter table despesas add column if not exists tributo_tipo text;
        `).catch(() => {})
        const atual = await pool.query(
          `select id::text as id, fonte, descricao, documento_ref, forma_pagamento, freecontrol_tipo,
                  tributo_tipo, f.nome as fornecedor, p.nome as plano
             from despesas d
             left join fornecedores f on f.id = d.fornecedor_id
             left join plano_contas p on p.id = d.plano_conta_id
            where d.id = $1`,
          [id],
        )
        if (!atual.rowCount) return send(res, 404, JSON.stringify({ erro: 'Despesa não encontrada.' }))
        const despesa = atual.rows[0]
        const { classificarTributo, rotuloTributo, portalTributo } = await import('./lib/classificarTributo.mjs')
        let tributoTipo = despesa.tributo_tipo || classificarTributo(despesa)
        const fonte = String(despesa.fonte || '').toLowerCase()
        if (fonte === 'freecontrol' && status === 'conferido') {
          return send(res, 400, JSON.stringify({ erro: 'Free Control usa ok ou pendente.' }))
        }
        if (tributoTipo && status === 'ok') {
          return send(res, 400, JSON.stringify({ erro: 'Tributo usa pendente ou conferido.' }))
        }
        const up = await pool.query(
          `update despesas set
             conferencia_status = $2,
             tributo_tipo = coalesce(tributo_tipo, $3)
           where id = $1
           returning id::text as id, conferencia_status, tributo_tipo`,
          [id, status, tributoTipo],
        )
        metaFinanceiro(req, {
          acao: 'atualizar',
          entidade: 'despesa_conferencia',
          idReferencia: id,
          descricao: `Conferência despesa → ${status}${tributoTipo ? ` (${tributoTipo})` : ''}`,
          detalhes: { status, tributo_tipo: tributoTipo, fonte },
        })
        const row = up.rows[0]
        return send(res, 200, JSON.stringify({
          ...row,
          tributo_rotulo: row.tributo_tipo ? rotuloTributo(row.tributo_tipo) : null,
          tributo_portal: row.tributo_tipo ? portalTributo(row.tributo_tipo) : null,
        }))
      }
    }
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/despesas/')) {
      const id = url.pathname.split('/').pop()
      const body = await readBody(req)
      const acrescimo = lerAcrescimo(body)
      if (acrescimo.erro || !body.descricao || !body.empresa_origem_id) {
        return send(res, 400, JSON.stringify({ erro: acrescimo.erro || 'Descrição, origem e valor são obrigatórios.' }))
      }
      if (body.forma_pagamento && !FORMAS.has(body.forma_pagamento)) {
        return send(res, 400, JSON.stringify({ erro: 'Forma de pagamento inválida.' }))
      }
      const updated = await pool.query(`
        update despesas set
          descricao = $1, fornecedor_id = $2, empresa_origem_id = $3, conta_saida_id = $4, plano_conta_id = $5,
          documento_ref = $6, vencimento = $7, vencimento_original = $8, valor = $9, valor_face = $10,
          multa = $11, juros = $12, outras_taxas = $13, desconto = $14, modo_acrescimo = $15,
          forma_pagamento = $16, dados_pagamento = $17,
          status = case when $19::text is null then status else $19 end,
          competencia = case when $20::date is null then competencia else $20::date end
        where id = $18
        returning id, status
      `, [
        String(body.descricao).trim(),
        body.fornecedor_id || null,
        body.empresa_origem_id,
        body.conta_saida_id || null,
        body.plano_conta_id || null,
        body.documento_ref || null,
        acrescimo.vencimento,
        acrescimo.vencimentoOriginal,
        acrescimo.total,
        acrescimo.face,
        acrescimo.multa,
        acrescimo.juros,
        acrescimo.outras,
        acrescimo.desconto,
        acrescimo.modo,
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
      metaFinanceiro(req, {
        acao: 'excluir',
        entidade: 'despesa',
        idReferencia: id,
        descricao: `Excluiu despesa #${String(id).slice(0, 8)}`,
        detalhes: { id },
      })
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
    if (req.method === 'GET' && url.pathname === '/api/caixa/canais') {
      try {
        const { temPermissao, acessoTodasLojas } = await import('../permissoes.js')
        const user = req.user
        const soResumo = user
          && temPermissao(user, 'financeiro.resumo.ver')
          && !temPermissao(user, 'financeiro.ver')
        let empresaIds = null
        const empresa = String(url.searchParams.get('empresa') || '').trim()
        if (empresa) {
          empresaIds = [empresa]
        } else if (soResumo && !acessoTodasLojas(user)) {
          empresaIds = await empresaIdsPorLojas(user.lojas_ids || [])
        }
        const de = url.searchParams.get('de') || ''
        const ate = url.searchParams.get('ate') || ''
        return send(res, 200, JSON.stringify(await resumoCanaisPeriodo(pool, { de, ate, empresaIds })))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não carregou os canais.' }))
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
      const paraAgenda = body.para_agenda === true
      const resultado = await lancarDda(selecionadas, { paraAgenda })
      metaFinanceiro(req, {
        acao: 'importar',
        entidade: 'dda',
        idReferencia: resultado?.ids?.[0] || null,
        descricao: paraAgenda
          ? `Importou DDA e liberou ${resultado?.criadas ?? 0} título(s) na Agenda`
          : `Importou DDA — ${resultado?.criadas ?? 0} título(s)`,
        detalhes: { criadas: resultado?.criadas, ignoradas: resultado?.ignoradas, para_agenda: paraAgenda },
      })
      return send(res, 201, JSON.stringify(resultado))
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
    if (req.method === 'GET' && url.pathname === '/api/config/itau-extrato') {
      return send(res, 200, JSON.stringify(await listarCredenciaisExtrato(pool)))
    }
    if (req.method === 'POST' && url.pathname === '/api/config/itau-extrato') {
      const body = await readBody(req)
      try {
        return send(res, 201, JSON.stringify(await salvarCredencialExtrato(pool, body)))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não salvou a credencial.' }))
      }
    }
    if (/^\/api\/config\/itau-extrato\/[^/]+$/.test(url.pathname) && (req.method === 'PUT' || req.method === 'DELETE')) {
      const id = url.pathname.split('/').pop()
      if (req.method === 'DELETE') {
        await removerCredencialExtrato(pool, id)
        return send(res, 200, JSON.stringify({ id }))
      }
      const body = await readBody(req)
      try {
        return send(res, 200, JSON.stringify(await salvarCredencialExtrato(pool, { ...body, id })))
      } catch (err) {
        return send(res, err.status || 400, JSON.stringify({ erro: err.message || 'Não salvou a credencial.' }))
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/itau/extrato') {
      const lancamentos = await listarLancamentosExtrato(pool, url.searchParams.get('limite'))
      return send(res, 200, JSON.stringify({ lancamentos, coleta: estadoExtratoItau }))
    }
    if (req.method === 'POST' && url.pathname === '/api/itau/extrato/coletar') {
      cicloExtratoItau().catch((err) => console.error(`[itau-extrato] ${err.message}`))
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
const intervaloExtratoItau = Number(process.env.ITAU_EXTRATO_MS || 900000)
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
      codigo: 'itau_sem_servidor',
      criadas: 0,
      arquivos: 0,
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
    estadoSfg = {
      ok: true,
      mensagem,
      codigo: baixados.length ? 'itau_resumo' : 'itau_vazio',
      criadas,
      arquivos: baixados.length,
      em: new Date().toISOString(),
    }
    await registrarItau(pool, true, mensagem).catch(() => {})
    console.log(`[sfg] ${mensagem}`)
  } catch (err) {
    const mensagem = err.message || 'Falha ao puxar a VAN do Itaú'
    estadoSfg = {
      ok: false,
      mensagem,
      codigo: /ainda não está neste servidor|caixa postal/i.test(mensagem) ? 'itau_sem_servidor' : 'itau_erro',
      criadas: 0,
      arquivos: 0,
      em: new Date().toISOString(),
    }
    await registrarItau(pool, false, mensagem).catch(() => {})
    console.error(`[sfg] ${mensagem}`)
  } finally {
    coletaSfg = null
  }
}

let avisouExtratoItau = false

async function cicloExtratoItau() {
  if (coletaExtrato) return
  coletaExtrato = coletarExtratoItau(pool, env)
  try {
    const resultado = await coletaExtrato
    estadoExtratoItau = { ...resultado, em: new Date().toISOString() }
    if (!resultado.ok && resultado.codigo === 'itau_extrato_sem_credencial') {
      if (!avisouExtratoItau) {
        console.log('[itau-extrato] sem Client ID, segredo e certificado dinâmico. A coleta espera a credencial.')
        avisouExtratoItau = true
      }
      return
    }
    console.log(`[itau-extrato] ${resultado.mensagem}`)
  } catch (err) {
    estadoExtratoItau = {
      ok: false,
      mensagem: err.message || 'Falha ao consultar o extrato Itaú',
      codigo: 'itau_extrato_erro',
      contas: 0,
      lancamentos: 0,
      sugestoes: 0,
      em: new Date().toISOString(),
    }
    console.error(`[itau-extrato] ${estadoExtratoItau.mensagem}`)
  } finally {
    coletaExtrato = null
  }
}

async function coletarEmpresasBb() {
  const credenciais = (await credenciaisAtivasBb(pool)).filter(configPronta)
  if (!credenciais.length) {
    estadoBb = {
      ok: false,
      mensagem: 'Nenhuma empresa com acesso do Banco do Brasil em Configuração.',
      codigo: 'bb_sem_acesso',
      criadas: 0,
      empresas: 0,
      falhas: 0,
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
    codigo: 'bb_resumo',
    criadas,
    empresas: credenciais.length,
    falhas,
    em: new Date().toISOString(),
  }
}

async function cicloBb() {
  if (coletaBb) return coletaBb
  coletaBb = coletarEmpresasBb()
  try {
    await coletaBb
  } catch (err) {
    estadoBb = {
      ok: false,
      mensagem: err.message || 'Falha na coleta do Banco do Brasil',
      codigo: 'bb_erro',
      criadas: 0,
      empresas: 0,
      falhas: 0,
      em: new Date().toISOString(),
    }
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

export function getFinancePool() {
  return pool
}

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
  garantirSchemaExtratoItau(pool).catch((err) => console.error(`[financeiro] itau extrato: ${err.message}`))
  garantirSchemaConciliacao(pool).catch((err) => console.error(`[financeiro] conciliacao: ${err.message}`))
  garantirSchemaCaixa(pool).catch((err) => console.error(`[financeiro] caixa: ${err.message}`))
  garantirSchemaSefaz(pool).catch((err) => console.error(`[financeiro] sefaz: ${err.message}`))
  // O que o Hermes ainda deixar no Azimut entra por esta ponte. O recebimento direto é /caixa/ingest.
  import('./lib/syncCaixaAzimut.mjs')
    .then(({ iniciarSyncCaixaAzimut }) => iniciarSyncCaixaAzimut(env))
    .catch((err) => console.warn(`[caixa] ponte Azimut: ${err.message}`))
  if (intervaloSefaz >= 60000) {
    setTimeout(cicloSefaz, 20000)
    setInterval(cicloSefaz, intervaloSefaz)
  }
  if (intervaloBb >= 60000) {
    setTimeout(cicloBb, 15000)
    setInterval(cicloBb, intervaloBb)
  }
  if (intervaloExtratoItau >= 60000) {
    setTimeout(cicloExtratoItau, 18000)
    setInterval(cicloExtratoItau, intervaloExtratoItau)
  }
  pool.query(`
    alter table despesas add column if not exists dados_pagamento text;
    alter table despesas add column if not exists numero_nf text;
    alter table despesas add column if not exists cnpj_cedente text;
    alter table despesas add column if not exists nfe_id text;
    alter table despesas add column if not exists nf_confirmada boolean not null default false;
    alter table despesas add column if not exists nf_divergente boolean not null default false;
    alter table despesas add column if not exists nf_ciclo text;
    alter table despesas add column if not exists boleto_arquivo text;
    alter table despesas add column if not exists nota_arquivo text;
    create index if not exists fornecedor_pagamentos_pix_idx
      on fornecedor_pagamentos (fornecedor_id)
      where meio = 'pix' and chave_pix is not null and chave_pix <> '';
  `).catch((err) => {
    console.error(`[financeiro] ${err.message}`)
  })
}
