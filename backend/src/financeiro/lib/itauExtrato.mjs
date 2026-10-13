import crypto from 'node:crypto'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', '013_itau_extrato.sql')

/** URLs de produção pedidas pelo Itaú no acompanhamento da API de Extrato. */
export const URLS_PRODUCAO = {
  token: 'https://sts.itau.com.br/as/token.oauth2',
  api: 'https://account-statement.api.itau.com.br/account-statement/v1',
}

const JANELA_DIAS = 7
const FOLGA_DIAS = 3
const tokens = new Map()

function texto(valor) {
  return String(valor ?? '').trim()
}

function digitos(valor) {
  return texto(valor).replace(/\D/g, '')
}

function centavos(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

export function urlsAmbiente(ambiente, env = process.env) {
  if (ambiente !== 'homologacao') return URLS_PRODUCAO
  const token = texto(env.ITAU_EXTRATO_HM_TOKEN_URL)
  const api = texto(env.ITAU_EXTRATO_HM_API_URL).replace(/\/$/, '')
  if (!token || !api) {
    throw new Error(
      'A homologação do extrato Itaú não tem URL no material enviado. Use a credencial de Produção, ou grave as URLs que o portal mostrar em ITAU_EXTRATO_HM_TOKEN_URL e ITAU_EXTRATO_HM_API_URL.',
    )
  }
  return { token, api }
}

/**
 * statementId da API de Extrato: agência (4) + 00 + conta (5) + DAC (1).
 * Se a conta já vier com 7 dígitos, o 00 já está nela e não é repetido.
 */
export function statementIdConta({ agencia, numero, digito }) {
  const ag = digitos(agencia).padStart(4, '0').slice(-4)
  const dac = digitos(digito).slice(-1)
  let conta = numeroSemDac(numero, dac)
  if (ag.length !== 4) throw new Error('Agência do Itaú precisa de 4 dígitos.')
  if (!dac) throw new Error('A conta Itaú precisa do DAC.')
  if (!conta) throw new Error('A conta Itaú precisa do número.')
  if (conta.length <= 5) conta = `00${conta.padStart(5, '0')}`
  else if (conta.length < 7) conta = conta.padStart(7, '0')
  else conta = conta.slice(-7)
  const id = `${ag}${conta}${dac}`
  if (id.length !== 12) throw new Error('O identificador do extrato Itaú precisa ter 12 caracteres.')
  return id
}

function numeroSemDac(numero, dac) {
  const bruto = texto(numero)
  const so = digitos(bruto)
  if (dac && /[-./]/.test(bruto) && so.endsWith(dac) && so.length > 1) return so.slice(0, -1)
  return so
}

function diaIso(valor) {
  const s = texto(valor).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function idEvento(evento, statementId) {
  const pronto = texto(evento?.id)
  if (pronto) return pronto
  const base = JSON.stringify([
    statementId,
    evento?.operation,
    evento?.date,
    evento?.amount,
    evento?.literal,
    evento?.origin,
  ])
  return crypto.createHash('sha256').update(base).digest('hex').slice(0, 40)
}

export function normalizarLancamento(evento, contexto) {
  const amount = evento?.amount || {}
  const date = evento?.date || {}
  const literal = evento?.literal || {}
  const counterpart = evento?.counterpart || {}
  const origin = evento?.origin || {}
  const valor = Number(amount.value)
  if (!Number.isFinite(valor)) return null
  const dataContabil = diaIso(date.accounting)
  const dataEvento = diaIso(date.event) || dataContabil
  return {
    conta_id: contexto.contaId,
    empresa_id: contexto.empresaId,
    credencial_id: contexto.credencialId,
    statement_id: contexto.statementId,
    evento_id: idEvento(evento, contexto.statementId),
    tipo: texto(evento?.type) || null,
    operacao: texto(evento?.operation).toUpperCase() || null,
    estorno: Boolean(evento?.reversal),
    data_evento: dataEvento,
    data_contabil: dataContabil,
    literal_codigo: texto(literal.code) || null,
    literal: texto(literal.complete || literal.shortened) || null,
    valor: Math.abs(valor),
    moeda: texto(amount.currency) || 'BRL',
    contraparte_nome: texto(counterpart.name) || null,
    contraparte_documento: texto(counterpart.document) || null,
    origem_tipo: texto(origin.type) || null,
    origem_identificador: texto(origin.identifier) || null,
    origem_operacao: texto(origin.operation) || null,
  }
}

export function achatarExtrato(corpo, contexto) {
  const blocos = Array.isArray(corpo?.data) ? corpo.data : []
  const lancamentos = []
  let saldo = null
  for (const bloco of blocos) {
    for (const evento of bloco?.events || []) {
      const linha = normalizarLancamento(evento, contexto)
      if (linha) lancamentos.push(linha)
    }
    const balances = bloco?.balances || []
    const disponivel = balances.find((item) => item?.type === 'saldo_disponivel') || balances.at(-1)
    if (disponivel?.amount && Number.isFinite(Number(disponivel.amount.value))) {
      saldo = {
        tipo: texto(disponivel.type) || null,
        valor: Number(disponivel.amount.value),
        data: diaIso(disponivel.date?.event || disponivel.date?.accounting),
      }
    }
  }
  const paginacao = corpo?.pagination || {}
  const total = Number(paginacao.total_pages ?? paginacao.totalPages ?? 1)
  return {
    lancamentos,
    saldo,
    pagina: Number(paginacao.page) || 1,
    totalPaginas: Number.isFinite(total) && total > 0 ? total : 1,
  }
}

function diferencaDias(a, b) {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 99
  return Math.round((da - db) / 86400000)
}

export function escolherDespesa(lancamento, despesas) {
  if (lancamento.operacao !== 'D' || lancamento.estorno) return null
  const valor = centavos(lancamento.valor)
  if (valor == null) return null
  const data = lancamento.data_contabil || lancamento.data_evento
  const abertas = despesas.filter((item) => {
    if (item.empresa_origem_id !== lancamento.empresa_id) return false
    if (['cancelada', 'conciliada', 'faltou'].includes(item.status)) return false
    return centavos(item.valor) === valor
  })
  const porDocumento = abertas.filter((item) => (
    lancamento.origem_identificador
    && item.documento_ref
    && item.documento_ref === lancamento.origem_identificador
  ))
  const porData = abertas.filter((item) => data && item.vencimento && Math.abs(diferencaDias(data, String(item.vencimento).slice(0, 10))) <= FOLGA_DIAS)
  const lista = porDocumento.length ? porDocumento : porData
  return lista.length === 1 ? lista[0].id : null
}

export function sugerirConciliacoes(lancamentos, despesas) {
  const ocupadas = new Set(lancamentos.map((item) => item.despesa_id).filter(Boolean))
  const livres = () => despesas.filter((item) => !ocupadas.has(item.id))
  const sugestoes = []
  const ordem = [...lancamentos].sort((a, b) => String(a.data_contabil || '').localeCompare(String(b.data_contabil || '')))
  for (const linha of ordem) {
    if (linha.despesa_id) continue
    const despesaId = escolherDespesa(linha, livres())
    if (!despesaId) continue
    ocupadas.add(despesaId)
    sugestoes.push({ conta_id: linha.conta_id, evento_id: linha.evento_id, despesa_id: despesaId })
  }
  return sugestoes
}

export function hojeSaoPaulo(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
}

export function periodoPadrao(agora = new Date()) {
  const fim = hojeSaoPaulo(agora)
  const [ano, mes, dia] = fim.split('-').map(Number)
  const inicioData = new Date(Date.UTC(ano, mes - 1, dia))
  inicioData.setUTCDate(inicioData.getUTCDate() - (JANELA_DIAS - 1))
  const inicio = inicioData.toISOString().slice(0, 10)
  return { inicio, fim }
}

function pedir(url, { method = 'GET', headers = {}, body = null, tls = null } = {}) {
  return new Promise((resolve, reject) => {
    const destino = new URL(url)
    const req = https.request({
      protocol: destino.protocol,
      hostname: destino.hostname,
      port: destino.port || 443,
      path: `${destino.pathname}${destino.search}`,
      method,
      headers,
      ...(tls || {}),
    }, (res) => {
      const partes = []
      res.on('data', (parte) => partes.push(parte))
      res.on('end', () => {
        const bruto = Buffer.concat(partes).toString('utf8')
        let json = {}
        try {
          json = bruto ? JSON.parse(bruto) : {}
        } catch {
          json = {}
        }
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json,
          bruto,
          correlation: res.headers['x-itau-correlationid'] || headers['x-itau-correlationID'] || '',
        })
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function tlsDe(config) {
  if (!config.cert_pem || !config.key_pem) return null
  return { cert: config.cert_pem, key: config.key_pem, minVersion: 'TLSv1.2' }
}

function mensagemItau(resposta) {
  const dados = resposta.json || {}
  const lista = dados.messages || dados.erros || dados.errors
  const primeiro = Array.isArray(lista) ? lista[0] : null
  return texto(
    primeiro?.mensagem
    || primeiro?.message
    || dados.mensagem
    || dados.message
    || dados.error_description
    || dados.error
    || resposta.bruto,
  ).replace(/\s+/g, ' ').slice(0, 280)
}

export function configPronta(config) {
  return Boolean(config?.ativo !== false && config.client_id && config.client_secret && config.cert_pem && config.key_pem)
}

async function tokenItau(config, pedirFn, env) {
  const cache = tokens.get(config.client_id)
  if (cache && cache.expira > Date.now() + 30000) return cache.token
  const urls = urlsAmbiente(config.ambiente, env)
  const tls = tlsDe(config)
  if (!tls) throw new Error('O extrato Itaú exige o certificado dinâmico e a chave privada.')
  const corpo = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.client_id,
    client_secret: config.client_secret,
  })
  const resposta = await pedirFn(urls.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: corpo.toString(),
    tls,
  })
  if (!resposta.ok || !resposta.json?.access_token) {
    throw new Error(mensagemItau(resposta) || `O Itaú recusou o token (${resposta.status}).`)
  }
  const segundos = Number(resposta.json.expires_in) || 300
  tokens.set(config.client_id, { token: resposta.json.access_token, expira: Date.now() + segundos * 1000 })
  return resposta.json.access_token
}

export async function consultarExtrato(config, statementId, opcoes = {}) {
  const pedirFn = opcoes.pedir || pedir
  const env = opcoes.env || process.env
  const periodo = {
    inicio: opcoes.inicio || periodoPadrao().inicio,
    fim: opcoes.fim || periodoPadrao().fim,
  }
  const urls = urlsAmbiente(config.ambiente, env)
  const tls = tlsDe(config)
  const token = await tokenItau(config, pedirFn, env)
  const lancamentos = []
  let saldo = null
  for (let pagina = 1; pagina <= 40; pagina += 1) {
    const url = new URL(`${urls.api}/statements/${encodeURIComponent(statementId)}`)
    url.searchParams.set('type', 'current_account')
    url.searchParams.set('start_date', periodo.inicio)
    url.searchParams.set('end_date', periodo.fim)
    url.searchParams.set('page', String(pagina))
    url.searchParams.set('page_size', '1000')
    const correlation = crypto.randomUUID()
    const resposta = await pedirFn(url, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        'x-itau-apikey': config.client_id,
        'x-itau-correlationID': correlation,
      },
      tls,
    })
    if (!resposta.ok) {
      const detalhe = mensagemItau(resposta)
      throw new Error(detalhe || `O Itaú recusou o extrato (${resposta.status}). Correlation ${correlation}.`)
    }
    const paginaAtual = achatarExtrato(resposta.json, {
      contaId: opcoes.contaId,
      empresaId: opcoes.empresaId,
      credencialId: opcoes.credencialId,
      statementId,
    })
    lancamentos.push(...paginaAtual.lancamentos)
    if (paginaAtual.saldo) saldo = paginaAtual.saldo
    if (pagina >= paginaAtual.totalPaginas) break
  }
  return { lancamentos, saldo, periodo }
}

export async function garantirSchemaExtratoItau(pool) {
  await pool.query(fs.readFileSync(schemaPath, 'utf8'))
}

function credencialDe(linha) {
  return {
    id: linha.id,
    nome: texto(linha.nome) || 'Extrato conta corrente',
    empresa_id: linha.empresa_id || null,
    ambiente: linha.ambiente === 'homologacao' ? 'homologacao' : 'producao',
    client_id: texto(linha.client_id),
    client_secret: texto(linha.client_secret),
    cert_pem: texto(linha.cert_pem),
    key_pem: texto(linha.key_pem),
    ativo: linha.ativo !== false,
  }
}

function publico(linha) {
  const credencial = credencialDe(linha)
  return {
    id: linha.id,
    nome: credencial.nome,
    empresa_id: credencial.empresa_id,
    empresa: linha.apelido || linha.razao_social || null,
    cnpj: linha.cnpj || null,
    ambiente: credencial.ambiente,
    client_id: credencial.client_id,
    segredo_definido: Boolean(credencial.client_secret),
    certificado_definido: Boolean(credencial.cert_pem),
    chave_definida: Boolean(credencial.key_pem),
    ativo: credencial.ativo,
    pronta: configPronta(credencial),
    ultima_coleta: linha.ultima_coleta || null,
    ultimo_ok: linha.ultimo_ok ?? null,
    ultima_mensagem: linha.ultima_mensagem || '',
  }
}

export async function listarCredenciaisExtrato(pool) {
  await garantirSchemaExtratoItau(pool)
  const { rows } = await pool.query(`
    select c.*, e.apelido, e.razao_social, e.cnpj
    from itau_extrato_credenciais c
    left join empresas e on e.id = c.empresa_id
    order by c.atualizado_em desc
  `)
  return rows.map(publico)
}

export async function salvarCredencialExtrato(pool, body) {
  await garantirSchemaExtratoItau(pool)
  const id = texto(body.id)
  const atual = id
    ? (await pool.query('select * from itau_extrato_credenciais where id = $1', [id])).rows[0]
    : null
  if (id && !atual) throw Object.assign(new Error('Credencial não encontrada.'), { status: 404 })
  const empresaId = texto(body.empresa_id) || null
  if (empresaId) {
    const empresa = await pool.query('select id from empresas where id = $1 and ativo', [empresaId])
    if (!empresa.rowCount) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 })
  }
  const novo = {
    nome: texto(body.nome) || atual?.nome || 'Extrato conta corrente',
    empresa_id: body.empresa_id === '' || body.empresa_id === null ? null : (empresaId || atual?.empresa_id || null),
    ambiente: body.ambiente === 'homologacao' ? 'homologacao' : 'producao',
    client_id: texto(body.client_id) || texto(atual?.client_id),
    client_secret: texto(body.client_secret) || texto(atual?.client_secret),
    cert_pem: texto(body.cert_pem) || texto(atual?.cert_pem),
    key_pem: texto(body.key_pem) || texto(atual?.key_pem),
    ativo: body.ativo === false ? false : true,
  }
  if (!novo.client_id) throw Object.assign(new Error('Informe o Client ID gerado no Developers.'), { status: 400 })
  const salvo = atual
    ? await pool.query(`
        update itau_extrato_credenciais
        set nome = $2, empresa_id = $3, ambiente = $4, client_id = $5, client_secret = $6,
            cert_pem = $7, key_pem = $8, ativo = $9, atualizado_em = now()
        where id = $1
        returning id
      `, [id, novo.nome, novo.empresa_id, novo.ambiente, novo.client_id, novo.client_secret, novo.cert_pem, novo.key_pem, novo.ativo])
    : await pool.query(`
        insert into itau_extrato_credenciais (
          nome, empresa_id, ambiente, client_id, client_secret, cert_pem, key_pem, ativo
        ) values ($1,$2,$3,$4,$5,$6,$7,$8)
        returning id
      `, [novo.nome, novo.empresa_id, novo.ambiente, novo.client_id, novo.client_secret, novo.cert_pem, novo.key_pem, novo.ativo])
  const { rows } = await pool.query(`
    select c.*, e.apelido, e.razao_social, e.cnpj
    from itau_extrato_credenciais c
    left join empresas e on e.id = c.empresa_id
    where c.id = $1
  `, [salvo.rows[0].id])
  return publico(rows[0])
}

export async function removerCredencialExtrato(pool, id) {
  await garantirSchemaExtratoItau(pool)
  await pool.query('delete from itau_extrato_credenciais where id = $1', [id])
}

async function credenciaisAtivas(pool) {
  const { rows } = await pool.query(`
    select c.*, e.cnpj
    from itau_extrato_credenciais c
    left join empresas e on e.id = c.empresa_id
    where c.ativo
    order by c.empresa_id nulls last
  `)
  return rows.map((linha) => ({ ...credencialDe(linha), cnpj: digitos(linha.cnpj) }))
}

async function contasDoExtrato(pool, credencial, exclusivas) {
  const params = []
  let filtro = ''
  if (credencial.empresa_id) {
    params.push(credencial.empresa_id)
    filtro = `and c.empresa_id = $${params.length}`
  } else if (exclusivas.length) {
    params.push(exclusivas)
    filtro = `and c.empresa_id <> all($${params.length}::uuid[])`
  }
  const { rows } = await pool.query(`
    select c.id, c.empresa_id, c.agencia, c.numero, c.digito, e.cnpj, e.apelido, e.razao_social
    from contas_bancarias c
    join empresas e on e.id = c.empresa_id
    where c.banco = 'itau' and c.ativa and e.ativo
    ${filtro}
    order by e.apelido
  `, params)
  return rows
}

async function gravarLancamentos(pool, linhas) {
  let novas = 0
  for (const linha of linhas) {
    const { rows } = await pool.query(`
      insert into itau_extrato_lancamentos (
        conta_id, empresa_id, credencial_id, statement_id, evento_id, tipo, operacao, estorno,
        data_evento, data_contabil, literal_codigo, literal, valor, moeda,
        contraparte_nome, contraparte_documento, origem_tipo, origem_identificador, origem_operacao
      ) values (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      )
      on conflict (conta_id, evento_id) do update set
        literal = excluded.literal,
        valor = excluded.valor,
        contraparte_nome = excluded.contraparte_nome,
        origem_tipo = excluded.origem_tipo,
        origem_identificador = excluded.origem_identificador,
        origem_operacao = excluded.origem_operacao,
        coletado_em = now()
      returning (xmax = 0) as inserido
    `, [
      linha.conta_id, linha.empresa_id, linha.credencial_id, linha.statement_id, linha.evento_id,
      linha.tipo, linha.operacao, linha.estorno, linha.data_evento, linha.data_contabil,
      linha.literal_codigo, linha.literal, linha.valor, linha.moeda, linha.contraparte_nome,
      linha.contraparte_documento, linha.origem_tipo, linha.origem_identificador, linha.origem_operacao,
    ])
    if (rows[0]?.inserido) novas += 1
  }
  return novas
}

async function aplicarSugestoes(pool, linhas) {
  const empresas = [...new Set(linhas.map((item) => item.empresa_id))]
  const datas = linhas.map((item) => item.data_contabil || item.data_evento).filter(Boolean).sort()
  if (!empresas.length || !datas.length) return 0
  const { rows: despesas } = await pool.query(`
    select id, empresa_origem_id, valor::float8 as valor, vencimento::text as vencimento, documento_ref, status
    from despesas
    where empresa_origem_id = any($1::uuid[])
      and status not in ('cancelada', 'conciliada', 'faltou')
      and vencimento between ($2::date - ${FOLGA_DIAS}) and ($3::date + ${FOLGA_DIAS})
  `, [empresas, datas[0], datas.at(-1)])
  const { rows: jaLigados } = await pool.query(`
    select conta_id, evento_id, despesa_id
    from itau_extrato_lancamentos
    where despesa_id is not null
      and empresa_id = any($1::uuid[])
  `, [empresas])
  const sugestoes = sugerirConciliacoes(
    [...jaLigados, ...linhas.map((item) => ({ ...item, despesa_id: null }))],
    despesas,
  )
  for (const item of sugestoes) {
    await pool.query(`
      update itau_extrato_lancamentos
      set despesa_id = $3
      where conta_id = $1 and evento_id = $2 and despesa_id is null
    `, [item.conta_id, item.evento_id, item.despesa_id])
  }
  return sugestoes.length
}

async function registrarColeta(pool, id, ok, mensagem) {
  await pool.query(
    'update itau_extrato_credenciais set ultima_coleta = now(), ultimo_ok = $2, ultima_mensagem = $3 where id = $1',
    [id, ok, texto(mensagem).slice(0, 500)],
  )
}

export async function coletarExtratoItau(pool, env = process.env) {
  await garantirSchemaExtratoItau(pool)
  const credenciais = (await credenciaisAtivas(pool)).filter(configPronta)
  if (!credenciais.length) {
    return {
      ok: false,
      codigo: 'itau_extrato_sem_credencial',
      mensagem: 'Credencial do extrato Itaú ainda não está pronta. Falta Client ID, Client Secret ou certificado dinâmico.',
      contas: 0,
      lancamentos: 0,
      sugestoes: 0,
    }
  }
  const exclusivas = credenciais.map((item) => item.empresa_id).filter(Boolean)
  let contas = 0
  let lancamentos = 0
  let sugestoes = 0
  const falhas = []
  for (const credencial of credenciais) {
    const daCredencial = await contasDoExtrato(pool, credencial, exclusivas)
    const partes = []
    const falhasConta = []
    try {
      if (!daCredencial.length) {
        await registrarColeta(pool, credencial.id, true, 'Nenhuma conta Itaú ativa para esta credencial.')
        continue
      }
      for (const conta of daCredencial) {
        try {
          const statementId = statementIdConta(conta)
          const extrato = await consultarExtrato(credencial, statementId, {
            env,
            contaId: conta.id,
            empresaId: conta.empresa_id,
            credencialId: credencial.id,
          })
          const novas = await gravarLancamentos(pool, extrato.lancamentos)
          const pares = await aplicarSugestoes(pool, extrato.lancamentos)
          contas += 1
          lancamentos += novas
          sugestoes += pares
          const nome = conta.apelido || conta.razao_social || statementId
          partes.push(`${nome}: ${extrato.lancamentos.length} lançamento(s), ${novas} novo(s)`)
        } catch (err) {
          const nome = conta.apelido || conta.razao_social || conta.numero
          falhasConta.push(`${nome}: ${err.message}`)
          falhas.push(`${nome}: ${err.message}`)
          partes.push(`${nome}: ${err.message}`)
        }
      }
      await registrarColeta(pool, credencial.id, falhasConta.length === 0, partes.join(' · ').slice(0, 500))
    } catch (err) {
      falhas.push(err.message)
      await registrarColeta(pool, credencial.id, false, err.message)
    }
  }
  const ok = falhas.length === 0
  return {
    ok,
    codigo: ok ? (lancamentos ? 'itau_extrato_resumo' : 'itau_extrato_vazio') : 'itau_extrato_erro',
    mensagem: ok
      ? `${contas} conta(s), ${lancamentos} lançamento(s) novo(s), ${sugestoes} sugestão(ões) de conciliação.`
      : falhas[0],
    contas,
    lancamentos,
    sugestoes,
    falhas: falhas.length,
  }
}

export async function listarLancamentosExtrato(pool, limite = 80) {
  await garantirSchemaExtratoItau(pool)
  const { rows } = await pool.query(`
    select l.id, l.statement_id, l.operacao, l.estorno, l.data_contabil::text as data_contabil,
           l.literal, l.valor::float8 as valor, l.contraparte_nome, l.origem_tipo, l.despesa_id,
           c.agencia, c.numero, c.digito,
           coalesce(e.apelido, e.razao_social) as empresa,
           d.descricao as despesa
    from itau_extrato_lancamentos l
    join contas_bancarias c on c.id = l.conta_id
    join empresas e on e.id = l.empresa_id
    left join despesas d on d.id = l.despesa_id
    order by l.data_contabil desc nulls last, l.coletado_em desc
    limit $1
  `, [Math.min(Math.max(Number(limite) || 80, 1), 200)])
  return rows
}
