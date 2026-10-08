/**
 * Vendas do BK Office pela API (apifront), no lugar do kit do PC da gerência.
 * Relatório: Restaurante e Produto Venda, agrupado por dia. Setor Grupo Alvim = 1005196.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API_PADRAO = 'https://apifront.backoffice.ads.e-deploy.com.br'
const SETOR_PADRAO = '1005196'

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', '003_vendas_bk.sql')
const schemaConfigPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', '004_config_bkoffice.sql')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function hojeBR() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function isoParaBR(iso) {
  const [ano, mes, dia] = String(iso).slice(0, 10).split('-')
  if (!ano || !mes || !dia) return ''
  return `${dia}/${mes}/${ano}`
}

function dataIso(valor) {
  if (valor == null || valor === '') return null
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const data = new Date(valor)
    if (!Number.isNaN(data.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(data)
    }
  }
  const texto = String(valor).trim()
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  const iso = texto.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  return null
}

function num(valor) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

function dinheiro(valor) {
  return Math.round(num(valor) * 100) / 100
}

function guardarCookies(jar, res) {
  const lista = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  for (const bruto of lista) {
    const par = bruto.split(';')[0]
    const i = par.indexOf('=')
    if (i > 0) jar.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
  }
}

async function chamar(jar, url, { method = 'GET', body = null } = {}) {
  const headers = {
    Accept: 'application/json',
    Origin: 'https://backoffice.ads.e-deploy.com.br',
    Referer: 'https://backoffice.ads.e-deploy.com.br/',
  }
  if (body != null) headers['Content-Type'] = 'application/json'
  const cookie = [...jar.entries()].map(([nome, valor]) => `${nome}=${valor}`).join('; ')
  if (cookie) headers.Cookie = cookie
  const res = await fetch(url, { method, headers, body })
  guardarCookies(jar, res)
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* resposta não é JSON */ }
  return { status: res.status, json, text }
}

async function login(cfg) {
  const usuario = String(cfg.usuario || '').trim()
  const senha = String(cfg.senha || '')
  const api = String(cfg.api || API_PADRAO).replace(/\/$/, '')
  if (!usuario || !senha) {
    throw Object.assign(new Error('Informe usuário e senha do BK Office em Configuração.'), { status: 503 })
  }
  const jar = new Map()
  const res = await chamar(jar, `${api}/BKLoginAPI/User/login`, {
    method: 'POST',
    body: JSON.stringify({ login: usuario.toUpperCase(), password: senha }),
  })
  const status = res.json?.transactionStatus
  if (!status?.status) {
    throw Object.assign(
      new Error(status?.description || 'Login no BK Office falhou.'),
      { status: 401 },
    )
  }
  return jar
}

async function baixarRelatorio(jar, inicio, fim, cfg) {
  const api = String(cfg.api || API_PADRAO).replace(/\/$/, '')
  let corpo = {
    franchiseId: 'todos',
    colorId: null,
    estado: null,
    skuId: null,
    initialDate: isoParaBR(inicio),
    finalDate: isoParaBR(fim),
    grupoDia: true,
    sector: cfg.setor || SETOR_PADRAO,
    regional: 'todos',
    reportType: 'restaurantSku',
    benef: false,
    credPresumido: false,
    ncm: false,
  }
  for (let tentativa = 0; tentativa < 80; tentativa++) {
    const res = await chamar(jar, `${api}/BKOfficeAPI/Report/getReportSales`, {
      method: 'POST',
      body: JSON.stringify(corpo),
    })
    const status = res.json?.transactionStatus
    if (!res.json) {
      throw Object.assign(new Error('BK Office não devolveu o relatório.'), { status: 502 })
    }
    if (!status?.status) {
      throw Object.assign(new Error(status?.description || 'Falha no relatório de vendas.'), { status: 502 })
    }
    if (status.description === 'thread' || status.description === 'reprocess') {
      corpo = { reprocess: true, controlId: res.json.controlId }
      await sleep(3000)
      continue
    }
    if (!Array.isArray(res.json.report)) {
      throw Object.assign(new Error('Relatório veio sem a lista de lojas.'), { status: 502 })
    }
    return res.json.report
  }
  throw Object.assign(new Error('O relatório de vendas não ficou pronto a tempo.'), { status: 504 })
}

export function linhasDoRelatorio(report, dataPadrao) {
  const mapa = new Map()
  for (const loja of report) {
    const restaurante = loja.restaurant || {}
    const bk = String(restaurante.branchNumber ?? '').replace(/\D/g, '')
    const nome = String(restaurante.restaurantDescription || '').trim()
    for (const item of loja.values || []) {
      const codigo = String(item.sku?.skuId ?? '').trim()
      const data = dataIso(item.referenceDate) || dataPadrao
      if (!bk || !codigo || !data) continue
      const quantidade = num(item.quantity)
      const bruto = num(item.amount)
      if (quantidade === 0 && bruto === 0) continue
      const chave = `${data}|${bk}|${codigo}`
      const atual = mapa.get(chave) || {
        data_venda: data,
        bk_number: bk,
        restaurante: nome,
        codigo,
        descricao: String(item.sku?.sku || '').trim(),
        quantidade: 0,
        venda_bruta: 0,
        desconto: 0,
        imposto: 0,
        venda_liquida: 0,
      }
      atual.quantidade += quantidade
      atual.venda_bruta += bruto
      atual.desconto += num(item.discount)
      atual.imposto += num(item.tax)
      atual.venda_liquida += bruto - num(item.tax)
      mapa.set(chave, atual)
    }
  }
  return [...mapa.values()]
}

async function garantirSchema(pool) {
  await pool.query(fs.readFileSync(schemaPath, 'utf8'))
  await pool.query(fs.readFileSync(schemaConfigPath, 'utf8'))
}

export async function lerConfigBkoffice(pool, env = process.env) {
  await garantirSchema(pool)
  const { rows } = await pool.query(`
    select chave, valor from configuracoes
    where chave in ('bkoffice_user', 'bkoffice_pass', 'bkoffice_api', 'bkoffice_sector')
  `)
  const salvo = Object.fromEntries(rows.map((linha) => [linha.chave, linha.valor]))
  const senhaBanco = String(salvo.bkoffice_pass || '')
  const senhaEnv = String(env.BKOFFICE_PASS || '')
  return {
    usuario: String(salvo.bkoffice_user || env.BKOFFICE_USER || '').trim(),
    senha: senhaBanco || senhaEnv,
    api: String(salvo.bkoffice_api || env.BKOFFICE_API || API_PADRAO).replace(/\/$/, ''),
    setor: String(salvo.bkoffice_sector || env.BKOFFICE_SECTOR || SETOR_PADRAO).trim(),
    senha_definida: Boolean(senhaBanco || senhaEnv),
  }
}

export async function salvarConfigBkoffice(pool, body) {
  await garantirSchema(pool)
  const usuario = String(body.usuario || '').trim()
  const api = String(body.api || API_PADRAO).trim().replace(/\/$/, '')
  const setor = String(body.setor || SETOR_PADRAO).trim()
  if (!usuario) throw Object.assign(new Error('Informe o usuário do BK Office.'), { status: 400 })
  if (!api.startsWith('https://')) throw Object.assign(new Error('A API precisa ser um endereço https.'), { status: 400 })
  const pares = [
    ['bkoffice_user', usuario],
    ['bkoffice_api', api],
    ['bkoffice_sector', setor],
  ]
  const senha = String(body.senha || '')
  if (senha) pares.push(['bkoffice_pass', senha])
  for (const [chave, valor] of pares) {
    await pool.query(`
      insert into configuracoes (chave, valor) values ($1, $2)
      on conflict (chave) do update set valor = excluded.valor, atualizado_em = now()
    `, [chave, valor])
  }
  const atual = await lerConfigBkoffice(pool)
  return { usuario: atual.usuario, api: atual.api, setor: atual.setor, senha_definida: atual.senha_definida }
}

async function gravar(pool, linhas, inicio, fim) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query('delete from vendas_bk where data_venda between $1::date and $2::date', [inicio, fim])
    const lote = 300
    for (let i = 0; i < linhas.length; i += lote) {
      const parte = linhas.slice(i, i + lote)
      const params = []
      const values = parte.map((linha) => {
        const n = params.length
        params.push(
          linha.data_venda,
          linha.bk_number,
          linha.restaurante || null,
          linha.codigo,
          linha.descricao || null,
          linha.quantidade,
          dinheiro(linha.venda_bruta),
          dinheiro(linha.desconto),
          dinheiro(linha.imposto),
          dinheiro(linha.venda_liquida),
        )
        return `($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 5},$${n + 6},$${n + 7},$${n + 8},$${n + 9},$${n + 10})`
      })
      await client.query(`
        insert into vendas_bk (
          data_venda, bk_number, restaurante, codigo, descricao,
          quantidade, venda_bruta, desconto, imposto, venda_liquida
        ) values ${values.join(',')}
      `, params)
    }
    await client.query(`
      update vendas_bk v
      set empresa_id = e.id
      from empresas e
      where v.empresa_id is null
        and regexp_replace(coalesce(e.bk_number, ''), '\\D', '', 'g') = v.bk_number
        and v.data_venda between $1::date and $2::date
    `, [inicio, fim])
    await client.query('commit')
  } catch (err) {
    await client.query('rollback').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

function periodoValido(inicio, fim) {
  const de = String(inicio || '').slice(0, 10)
  const ate = String(fim || inicio || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || de > ate) {
    throw Object.assign(new Error('Informe o período em AAAA-MM-DD.'), { status: 400 })
  }
  return { de, ate }
}

export async function sincronizarVendasBk({ pool, env, inicio, fim }) {
  const { de, ate } = periodoValido(inicio || hojeBR(), fim || inicio || hojeBR())
  await garantirSchema(pool)
  const cfg = await lerConfigBkoffice(pool, env)
  const jar = await login(cfg)
  const report = await baixarRelatorio(jar, de, ate, cfg)
  const linhas = linhasDoRelatorio(report, de)
  await gravar(pool, linhas, de, ate)
  const lojas = new Set(linhas.map((linha) => linha.bk_number)).size
  const vendaBruta = dinheiro(linhas.reduce((soma, linha) => soma + linha.venda_bruta, 0))
  const mensagem = `${linhas.length} produtos em ${lojas} lojas`
  await pool.query(`
    insert into vendas_sync (de, ate, linhas, lojas, venda_bruta, ok, mensagem)
    values ($1, $2, $3, $4, $5, true, $6)
  `, [de, ate, linhas.length, lojas, vendaBruta, mensagem])
  return { de, ate, linhas: linhas.length, lojas, venda_bruta: vendaBruta, mensagem }
}

export async function registrarFalhaVendas(pool, inicio, fim, mensagem) {
  await garantirSchema(pool)
  const { de, ate } = periodoValido(inicio || hojeBR(), fim || inicio || hojeBR())
  await pool.query(`
    insert into vendas_sync (de, ate, linhas, lojas, venda_bruta, ok, mensagem)
    values ($1, $2, 0, 0, 0, false, $3)
  `, [de, ate, String(mensagem || 'Falha na coleta').slice(0, 500)])
}

export async function resumoVendas(pool, dia) {
  await garantirSchema(pool)
  const data = String(dia || hojeBR()).slice(0, 10)
  const [lojas, sync] = await Promise.all([
    pool.query(`
      select bk_number, max(restaurante) as restaurante, count(*)::int as linhas,
        sum(quantidade) as quantidade, sum(venda_bruta) as venda_bruta, sum(venda_liquida) as venda_liquida
      from vendas_bk
      where data_venda = $1::date
      group by bk_number
      order by bk_number
    `, [data]),
    pool.query(`
      select de, ate, linhas, lojas, venda_bruta, ok, mensagem, criado_em
      from vendas_sync
      order by criado_em desc
      limit 1
    `),
  ])
  const vendaBruta = dinheiro(lojas.rows.reduce((soma, linha) => soma + Number(linha.venda_bruta || 0), 0))
  return {
    dia: data,
    lojas: lojas.rows.map((linha) => ({
      ...linha,
      quantidade: Number(linha.quantidade),
      venda_bruta: Number(linha.venda_bruta),
      venda_liquida: Number(linha.venda_liquida),
    })),
    venda_bruta: vendaBruta,
    ultimo_sync: sync.rows[0] || null,
  }
}
