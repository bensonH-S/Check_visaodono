import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AMBIENTES = {
  homologacao: {
    token: 'https://oauth.hm.bb.com.br/oauth/token',
    // Doc BB: testes em api.hm; homologação/produção DDA exigem mTLS.
    api: 'https://api.hm.bb.com.br/dda/v1',
    mtls: 'https://dda.mtls.api.hm.bb.com.br/v1',
  },
  producao: {
    token: 'https://oauth.bb.com.br/oauth/token',
    api: 'https://dda.mtls.api.bb.com.br/v1',
    mtls: 'https://dda.mtls.api.bb.com.br/v1',
  },
}

function texto(valor) {
  return String(valor ?? '').trim()
}

function digitos(valor) {
  return texto(valor).replace(/\D/g, '')
}

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = path.join(rootDir, 'db', '005_bb_credenciais.sql')
const pastaCertificados = path.join(rootDir, 'Certificados')

function acharPfxNaPasta(cnpj) {
  const chave = digitos(cnpj)
  if (!chave || !fs.existsSync(pastaCertificados)) return ''
  let arquivos = []
  try {
    arquivos = fs.readdirSync(pastaCertificados)
  } catch {
    return ''
  }
  const nome = arquivos.find((item) => {
    const baixo = item.toLowerCase()
    if (!baixo.endsWith('.pfx') && !baixo.endsWith('.p12')) return false
    return digitos(item) === chave || digitos(item).includes(chave)
  })
  return nome ? path.join(pastaCertificados, nome) : ''
}

function pfxDaPasta(cnpj) {
  const arquivo = acharPfxNaPasta(cnpj)
  if (!arquivo) return ''
  return fs.readFileSync(arquivo).toString('base64')
}

function temA1(config) {
  if (config.pfx || (config.cert_pem && config.key_pem)) return true
  return Boolean(acharPfxNaPasta(config.cnpj))
}

export async function garantirSchemaBb(pool) {
  await pool.query(fs.readFileSync(schemaPath, 'utf8'))
}

function credencialDe(linha) {
  return {
    empresa_id: linha.empresa_id,
    ambiente: linha.ambiente === 'producao' ? 'producao' : 'homologacao',
    client_id: texto(linha.client_id),
    client_secret: texto(linha.client_secret),
    app_key: texto(linha.app_key),
    cert_pem: texto(linha.cert_pem),
    key_pem: texto(linha.key_pem),
    pfx: texto(linha.pfx),
    cert_pass: texto(linha.cert_pass),
    ativo: linha.ativo !== false,
    cnpj: digitos(linha.cnpj),
  }
}

export function configPronta(config) {
  if (!config.client_id || !config.client_secret || !config.app_key) return false
  // Produção DDA (doc BB): só via mTLS — precisa do A1 (PEM/PFX + senha ou pasta Certificados).
  if (config.ambiente === 'producao') {
    return Boolean(agenteTls(config) || temA1(config))
  }
  return true
}

export async function listarAcessosBb(pool) {
  await garantirSchemaBb(pool)
  const { rows } = await pool.query(`
    select e.id as empresa_id, e.apelido, e.razao_social, e.cnpj, e.tipo,
           c.ambiente, c.client_id, c.client_secret, c.app_key, c.cert_pem, c.key_pem, c.pfx, c.cert_pass,
           c.ativo, c.ultima_coleta, c.ultimo_ok, c.ultima_mensagem, c.atualizado_em,
           c.empresa_id is not null as cadastrada
    from empresas e
    left join bb_credenciais c on c.empresa_id = e.id
    where e.ativo
    order by e.tipo desc, e.apelido
  `)
  return rows.map((linha) => {
    const credencial = credencialDe(linha)
    return {
      empresa_id: linha.empresa_id,
      empresa: linha.apelido || linha.razao_social,
      razao_social: linha.razao_social,
      cnpj: linha.cnpj,
      cadastrada: linha.cadastrada,
      ambiente: linha.cadastrada ? credencial.ambiente : 'homologacao',
      client_id: credencial.client_id,
      app_key: credencial.app_key,
      segredo_definido: Boolean(credencial.client_secret),
      certificado_definido: temA1({ ...credencial, cnpj: linha.cnpj }),
      certificado_pasta: Boolean(acharPfxNaPasta(linha.cnpj)),
      chave_definida: Boolean(credencial.pfx || credencial.key_pem),
      ativo: linha.cadastrada ? credencial.ativo : false,
      pronta: linha.cadastrada && configPronta(credencial),
      ultima_coleta: linha.ultima_coleta,
      ultimo_ok: linha.ultimo_ok,
      ultima_mensagem: linha.ultima_mensagem,
    }
  })
}

export async function credenciaisAtivasBb(pool) {
  await garantirSchemaBb(pool)
  const { rows } = await pool.query(`
    select c.*, e.apelido, e.razao_social, e.cnpj
    from bb_credenciais c
    join empresas e on e.id = c.empresa_id
    where c.ativo and e.ativo
    order by e.apelido
  `)
  return rows.map((linha) => ({
    ...credencialDe(linha),
    empresa: linha.apelido || linha.razao_social,
    cnpj: digitos(linha.cnpj),
  }))
}

export async function salvarAcessoBb(pool, empresaId, body) {
  await garantirSchemaBb(pool)
  const empresa = await pool.query('select id, cnpj from empresas where id = $1 and ativo', [empresaId])
  if (!empresa.rowCount) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 })
  const atual = await pool.query('select * from bb_credenciais where empresa_id = $1', [empresaId])
  const antes = atual.rowCount ? credencialDe(atual.rows[0]) : credencialDe({})
  const novo = {
    ambiente: body.ambiente === 'producao' ? 'producao' : 'homologacao',
    client_id: texto(body.client_id),
    app_key: texto(body.app_key),
    client_secret: texto(body.client_secret) || antes.client_secret,
    cert_pass: texto(body.cert_pass) || antes.cert_pass,
    pfx: antes.pfx,
    cert_pem: antes.cert_pem,
    key_pem: antes.key_pem,
    ativo: body.ativo !== false,
    cnpj: digitos(empresa.rows[0].cnpj),
  }
  if (body.pfx) {
    novo.pfx = texto(body.pfx)
    novo.cert_pem = ''
    novo.key_pem = ''
  } else if (body.cert_pem || body.key_pem) {
    novo.pfx = ''
    if (body.cert_pem) novo.cert_pem = texto(body.cert_pem)
    if (body.key_pem) novo.key_pem = texto(body.key_pem)
  }
  if (!novo.client_id) throw Object.assign(new Error('Informe o client id.'), { status: 400 })
  if (!novo.client_secret) throw Object.assign(new Error('Informe o client secret.'), { status: 400 })
  if (!novo.app_key) throw Object.assign(new Error('Informe a developer application key.'), { status: 400 })
  if (novo.ambiente === 'producao' && !configPronta(novo)) {
    throw Object.assign(new Error('Produção exige o certificado A1 desta empresa.'), { status: 400 })
  }
  await pool.query(`
    insert into bb_credenciais (
      empresa_id, ambiente, client_id, client_secret, app_key, cert_pem, key_pem, pfx, cert_pass, ativo, atualizado_em
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
    on conflict (empresa_id) do update set
      ambiente = excluded.ambiente,
      client_id = excluded.client_id,
      client_secret = excluded.client_secret,
      app_key = excluded.app_key,
      cert_pem = excluded.cert_pem,
      key_pem = excluded.key_pem,
      pfx = excluded.pfx,
      cert_pass = excluded.cert_pass,
      ativo = excluded.ativo,
      atualizado_em = now()
  `, [
    empresaId, novo.ambiente, novo.client_id, novo.client_secret, novo.app_key,
    novo.cert_pem, novo.key_pem, novo.pfx, novo.cert_pass, novo.ativo,
  ])
  const lista = await listarAcessosBb(pool)
  return lista.find((item) => item.empresa_id === empresaId)
}

export async function removerAcessoBb(pool, empresaId) {
  await garantirSchemaBb(pool)
  await pool.query('delete from bb_credenciais where empresa_id = $1', [empresaId])
}

export async function registrarColetaBb(pool, empresaId, ok, mensagem) {
  await pool.query(
    'update bb_credenciais set ultima_coleta = now(), ultimo_ok = $2, ultima_mensagem = $3 where empresa_id = $1',
    [empresaId, ok, mensagem],
  )
}

function dataBb(data) {
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  // Doc BB (Primeiros Passos): dd.mm.aaaa ou dd/mm/aaaa — exemplo oficial usa ponto.
  return `${dia}.${mes}.${data.getFullYear()}`
}

function periodoConsulta() {
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 5)
  const fim = new Date()
  fim.setDate(fim.getDate() + 60)
  return { inicial: dataBb(inicio), final: dataBb(fim) }
}

function dataIso(valor) {
  const bruto = texto(valor)
  const br = bruto.match(/^(\d{2})[./](\d{2})[./](\d{4})$/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const iso = bruto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return ''
}

function documentoPessoa(tipo, numero) {
  const bruto = digitos(numero)
  if (!bruto || /^0+$/.test(bruto)) return ''
  const pessoa = texto(tipo).toUpperCase()
  if (pessoa === 'F' || pessoa === '1') return bruto.slice(-11).padStart(11, '0')
  return bruto.slice(-14).padStart(14, '0')
}

function primeiro(titulo, nomes) {
  for (const nome of nomes) {
    if (titulo[nome] != null && texto(titulo[nome]) !== '') return titulo[nome]
  }
  return ''
}

export function mapearBoletos(payload) {
  const pagador = documentoPessoa(payload.codigoTipoPessoaPagador, payload.numeroIdentificadorPagador)
  const lista = Array.isArray(payload.listaTitulo) ? payload.listaTitulo : []
  return lista.map((item) => {
    const titulo = item.objetoObrigacao || item
    const sacador = documentoPessoa(
      primeiro(titulo, ['codigoTipoPessoaSacadorAvalista', 'codigoTipoPessoaBeneficiarioFim']),
      primeiro(titulo, ['numeroIdentificadorSacadorAvalista', 'numeroIdentificadorBeneficiarioFim']),
    )
    const cedenteDoc = sacador || documentoPessoa(
      titulo.codigoTipoPessoaBeneficiario,
      titulo.numeroIdentificadorBeneficiario,
    )
    const nomeSacador = texto(primeiro(titulo, ['nomeSacadorAvalista', 'nomeBeneficiarioFimObrigacao']))
    const barras = digitos(primeiro(titulo, ['codigoBarrasObrigacao', 'textoCodigoBarrasObrigacao']))
    const valorBruto = primeiro(titulo, ['valorObrigacao', 'valorVencimentoObrigacao'])
    const valor = Number(valorBruto)
    return {
      cedente: sacador && nomeSacador ? nomeSacador : texto(primeiro(titulo, ['nomeBeneficiario', 'nomeBeneficiarioObrigacao'])),
      cnpj_cedente: cedenteDoc,
      sacado: '',
      cnpj_sacado: pagador,
      vencimento: dataIso(primeiro(titulo, ['dataVencimentoObrigacao'])),
      valor: Number.isFinite(valor) ? Math.round(valor * 100) / 100 : null,
      codigo: barras,
      situacao: 'A pagar',
      documento: texto(primeiro(titulo, ['codigoDocumentoObrigacao', 'codigoIdentificadorDocumentoCobranca'])),
    }
  })
}

function pemDaPasta(cnpj) {
  const chave = digitos(cnpj)
  if (!chave) return null
  const pastas = [
    path.join(rootDir, 'API BB', 'certs-rei'),
    path.join(rootDir, 'API BB', 'certs'),
  ]
  for (const pasta of pastas) {
    if (!fs.existsSync(pasta)) continue
    const crt = path.join(pasta, 'rei.crt')
    const key = path.join(pasta, 'rei.key')
    // REI CNPJ fixo — pasta certs-rei é do REI.
    if (chave === '26075154000136' && fs.existsSync(crt) && fs.existsSync(key)) {
      return { cert: fs.readFileSync(crt, 'utf8'), key: fs.readFileSync(key, 'utf8') }
    }
  }
  return null
}

function agenteTls(config) {
  if (config.cert_pem && config.key_pem) {
    return {
      cert: config.cert_pem,
      key: config.key_pem,
      passphrase: config.cert_pass || undefined,
      minVersion: 'TLSv1.2',
    }
  }
  const pem = pemDaPasta(config.cnpj)
  if (pem) {
    return { ...pem, minVersion: 'TLSv1.2' }
  }
  const pfx = config.pfx || pfxDaPasta(config.cnpj)
  if (pfx) {
    // A1 do Grupo Alvim (Diag2026) — senha padrão quando não está no banco.
    // Node às vezes rejeita PFX legado (RC2); preferir PEM quando existir.
    const senha = texto(config.cert_pass) || 'Diag2026'
    return {
      pfx: Buffer.from(pfx, 'base64'),
      passphrase: senha,
      minVersion: 'TLSv1.2',
    }
  }
  return null
}

function pedir(url, { method = 'GET', headers = {}, body = null, tls = null }) {
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
        })
      })
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function tokenBb(config) {
  const destino = AMBIENTES[config.ambiente]
  const corpo = new URLSearchParams({ grant_type: 'client_credentials', scope: 'dda-info' })
  const autorizacao = Buffer.from(`${config.client_id}:${config.client_secret}`).toString('base64')
  const resposta = await pedir(destino.token, {
    method: 'POST',
    headers: {
      authorization: `Basic ${autorizacao}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: corpo.toString(),
  })
  const dados = resposta.json
  if (!resposta.ok || !dados.access_token) {
    const mensagem = dados.error_description || dados.error || dados.message || `O Banco do Brasil recusou o token (${resposta.status}).`
    throw new Error(mensagem)
  }
  return dados.access_token
}

async function paginaBoletos(config, token, registro, dispatcher) {
  const destino = AMBIENTES[config.ambiente]
  // Produção DDA (doc BB): sempre mTLS. Homologação idem quando há certificado.
  const base = (config.ambiente === 'producao' || dispatcher) ? destino.mtls : destino.api
  if (config.ambiente === 'producao' && !dispatcher) {
    throw new Error('Produção do DDA exige o certificado A1 (mTLS), conforme documentação do BB.')
  }
  const periodo = periodoConsulta()
  const url = new URL(`${base}/boletos`)
  url.searchParams.set('gw-dev-app-key', config.app_key)
  url.searchParams.set('dataVencimentoInicial', periodo.inicial)
  url.searchParams.set('dataVencimentoFinal', periodo.final)
  url.searchParams.set('codigoEstadoObrigacao', '1')
  url.searchParams.set('numeroProximoRegistro', String(registro))
  const resposta = await pedir(url, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    tls: dispatcher,
  })
  const dados = resposta.json
  if (!resposta.ok) {
    const erro = Array.isArray(dados.erros) ? dados.erros[0] : null
    const mensagem = erro?.mensagemErro || erro?.message || dados.message || dados.error || ''
    // Homologação / conta sem DDA: o BB devolve erro em vez de lista vazia.
    if (/não localizado|nao localizado|nenhum.*boleto|sem t[ií]tulo/i.test(mensagem)) {
      return { listaTitulo: [], indicadorContinuidade: 'N', quantidadeRegistros: 0 }
    }
    throw new Error(
      mensagem
      || (texto(resposta.bruto).replace(/\s+/g, ' ').slice(0, 220))
      || `O Banco do Brasil recusou a consulta de DDA (${resposta.status}).`,
    )
  }
  return dados
}

export async function listarBoletosBb(config) {
  if (!configPronta(config)) {
    throw new Error('Acesso incompleto. Falta client id, secret ou developer application key.')
  }
  const dispatcher = agenteTls(config)
  const token = await tokenBb(config)
  const linhas = []
  let registro = 1
  for (let pagina = 0; pagina < 40; pagina += 1) {
    const dados = await paginaBoletos(config, token, registro, dispatcher)
    for (const linha of mapearBoletos(dados)) {
      if (!linha.cnpj_sacado && config.cnpj) linha.cnpj_sacado = config.cnpj
      if (!linha.sacado && config.empresa) linha.sacado = config.empresa
      linhas.push(linha)
    }
    if (texto(dados.indicadorContinuidade).toUpperCase() !== 'S') break
    const proximo = Number(dados.numeroProximoRegistro)
    if (!Number.isFinite(proximo) || proximo <= registro) break
    registro = proximo
  }
  return linhas
}
