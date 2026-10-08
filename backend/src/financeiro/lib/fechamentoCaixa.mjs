import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = path.join(rootDir, 'db', '007_fechamento_caixa.sql')
const lancamentosPath = path.join(rootDir, 'db', '008_fechamento_caixa_lancamentos.sql')
const statusPath = path.join(rootDir, 'db', '009_caixa_bandeiras_status.sql')
const pastaComprovantes = path.join(rootDir, 'data', 'caixa', 'comprovantes')
const MAX_COMPROVANTE = 8 * 1024 * 1024
const MIME_COMPROVANTE = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const CAMPOS = [
  'dinheiro', 'pix', 'debito', 'credito', 'cart_digital',
  'ifood', 'azul', 'rappi', 'food99', 'despesas_caixa', 'depositos_caixa',
]

export async function garantirSchemaCaixa(pool) {
  await pool.query(fs.readFileSync(schemaPath, 'utf8'))
  await pool.query(fs.readFileSync(lancamentosPath, 'utf8'))
  await pool.query(fs.readFileSync(statusPath, 'utf8'))
}

function erro(mensagem, status = 400) {
  const falha = new Error(mensagem)
  falha.status = status
  return falha
}

function dinheiro(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

function statusValido(valor) {
  return ['rascunho', 'conferido', 'fechado'].includes(valor) ? valor : 'rascunho'
}

function dataIso(valor) {
  if (!valor) return ''
  if (typeof valor === 'string') return valor.slice(0, 10)
  const y = valor.getUTCFullYear()
  const m = String(valor.getUTCMonth() + 1).padStart(2, '0')
  const d = String(valor.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function uuidOuNulo(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(valor || ''))
    ? String(valor)
    : null
}

function lancamentoPublico(item) {
  return {
    id: item.id,
    tipo: item.tipo,
    valor: Number(item.valor) || 0,
    plano_conta_id: item.plano_conta_id,
    fornecedor_id: item.fornecedor_id,
    numero: item.numero || '',
    descricao: item.descricao || '',
    plano: item.plano || '',
    fornecedor: item.fornecedor || item.fornecedor_nome || '',
    comprovante_nome: item.comprovante_nome || '',
    tem_comprovante: Boolean(item.comprovante_arquivo),
  }
}

const SQL_LANCAMENTOS = `
  select l.id, l.fechamento_id, l.tipo, l.valor, l.plano_conta_id, l.fornecedor_id, l.numero, l.descricao,
         l.fornecedor_nome, l.comprovante_arquivo, l.comprovante_nome,
         p.nome as plano, coalesce(nullif(f.nome, ''), nullif(l.fornecedor_nome, '')) as fornecedor
  from fechamento_caixa_lancamentos l
  left join plano_contas p on p.id = l.plano_conta_id
  left join fornecedores f on f.id = l.fornecedor_id
`

function resolverComprovante(relativo) {
  if (!relativo) return null
  const abs = path.resolve(rootDir, relativo)
  const base = path.resolve(pastaComprovantes)
  const rel = path.relative(base, abs)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(abs)) return null
  return abs
}

function extensaoComprovante(nome, mime) {
  const doNome = path.extname(String(nome || '')).toLowerCase()
  if (MIME_COMPROVANTE[doNome]) return doNome
  const porMime = Object.entries(MIME_COMPROVANTE).find(([, tipo]) => tipo === mime)
  return porMime ? porMime[0] : ''
}

function gravarArquivoComprovante(id, arquivo) {
  const nome = String(arquivo?.nome || 'comprovante').slice(0, 180)
  const mime = String(arquivo?.mime || '')
  const ext = extensaoComprovante(nome, mime)
  if (!ext) throw erro('Comprovante precisa ser PDF, JPG, PNG ou WEBP.')
  let binario
  try {
    binario = Buffer.from(String(arquivo.base64 || ''), 'base64')
  } catch {
    throw erro('Comprovante inválido.')
  }
  if (!binario.length) throw erro('Comprovante vazio.')
  if (binario.length > MAX_COMPROVANTE) throw erro('Comprovante maior que 8 MB.')
  fs.mkdirSync(pastaComprovantes, { recursive: true })
  const relativo = `data/caixa/comprovantes/${id}${ext}`
  fs.writeFileSync(path.join(rootDir, relativo), binario)
  return { arquivo: relativo, nome: nome || `comprovante${ext}` }
}

function copiarComprovante(origemRel, novoId, nome) {
  const abs = resolverComprovante(origemRel)
  if (!abs) return { arquivo: null, nome: '' }
  const ext = path.extname(abs).toLowerCase() || extensaoComprovante(nome, '') || '.bin'
  fs.mkdirSync(pastaComprovantes, { recursive: true })
  const relativo = `data/caixa/comprovantes/${novoId}${ext}`
  const destino = path.join(rootDir, relativo)
  if (path.resolve(abs) !== path.resolve(destino)) fs.copyFileSync(abs, destino)
  return { arquivo: relativo, nome: nome || path.basename(abs) }
}

export async function lerComprovante(pool, id) {
  await garantirSchemaCaixa(pool)
  const lanId = uuidOuNulo(id)
  if (!lanId) throw erro('Lançamento inválido.', 404)
  const { rows } = await pool.query(
    `select comprovante_arquivo, comprovante_nome from fechamento_caixa_lancamentos where id = $1`,
    [lanId],
  )
  const abs = resolverComprovante(rows[0]?.comprovante_arquivo)
  if (!abs) throw erro('Sem comprovante neste lançamento.', 404)
  const ext = path.extname(abs).toLowerCase()
  const nome = rows[0].comprovante_nome || path.basename(abs)
  return {
    buffer: fs.readFileSync(abs),
    nome: String(nome).replace(/[^\w.-]+/g, '_'),
    mime: MIME_COMPROVANTE[ext] || 'application/octet-stream',
  }
}

function linhaPublica(linha) {
  return {
    id: linha.id,
    empresa_id: linha.empresa_id,
    empresa: linha.apelido || linha.razao_social,
    bk_number: linha.bk_number,
    data: dataIso(linha.data),
    dinheiro: Number(linha.dinheiro) || 0,
    pix: Number(linha.pix) || 0,
    debito: Number(linha.debito) || 0,
    credito: Number(linha.credito) || 0,
    cart_digital: Number(linha.cart_digital) || 0,
    ifood: Number(linha.ifood) || 0,
    azul: Number(linha.azul) || 0,
    rappi: Number(linha.rappi) || 0,
    food99: Number(linha.food99) || 0,
    despesas_caixa: Number(linha.despesas_caixa) || 0,
    depositos_caixa: Number(linha.depositos_caixa) || 0,
    bandeiras: Array.isArray(linha.bandeiras) ? linha.bandeiras : [],
    lancamentos: linha.lancamentos || [],
    observacao: linha.observacao || '',
    status: linha.status,
    atualizado_em: linha.atualizado_em,
  }
}

export async function listarFechamentos(pool, { mes, empresaId } = {}) {
  await garantirSchemaCaixa(pool)
  const params = []
  const filtros = []
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    params.push(`${mes}-01`)
    filtros.push(`f.data >= $${params.length}::date and f.data < ($${params.length}::date + interval '1 month')`)
  }
  if (empresaId) {
    params.push(empresaId)
    filtros.push(`f.empresa_id = $${params.length}`)
  }
  const where = filtros.length ? `where ${filtros.join(' and ')}` : ''
  const { rows } = await pool.query(`
    select f.*, e.apelido, e.razao_social, e.bk_number
    from fechamento_caixa f
    join empresas e on e.id = f.empresa_id
    ${where}
    order by f.data desc, e.apelido
  `, params)
  return rows.map(linhaPublica)
}

export async function mesFechamentos(pool, { mes, empresaId }) {
  await garantirSchemaCaixa(pool)
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) throw erro('Informe o mês no formato AAAA-MM.')
  if (!empresaId) throw erro('Informe a loja.')

  const empresa = (await pool.query(`
    select id, apelido, razao_social, bk_number, tipo
    from empresas where id = $1 and ativo
  `, [empresaId])).rows[0]
  if (!empresa) throw erro('Loja não encontrada.', 404)
  if (empresa.tipo !== 'loja') throw erro('Só loja fecha caixa.')

  const inicio = `${mes}-01`
  const { rows } = await pool.query(`
    select f.*, e.apelido, e.razao_social, e.bk_number
    from fechamento_caixa f
    join empresas e on e.id = f.empresa_id
    where f.empresa_id = $1
      and f.data >= $2::date
      and f.data < ($2::date + interval '1 month')
    order by f.data
  `, [empresaId, inicio])

  const ids = rows.map((linha) => linha.id)
  const porFechamento = new Map()
  if (ids.length) {
    const lans = await pool.query(`${SQL_LANCAMENTOS}
      where l.fechamento_id = any($1::uuid[])
      order by l.criado_em
    `, [ids])
    for (const item of lans.rows) {
      const lista = porFechamento.get(item.fechamento_id) || []
      lista.push(lancamentoPublico(item))
      porFechamento.set(item.fechamento_id, lista)
    }
  }

  const porDia = new Map(rows.map((linha) => {
    const pub = linhaPublica({ ...linha, lancamentos: porFechamento.get(linha.id) || [] })
    return [Number(pub.data.slice(8, 10)), pub]
  }))

  const [ano, mesNum] = mes.split('-').map(Number)
  const ultimo = new Date(ano, mesNum, 0).getDate()
  const dias = []
  for (let dia = 1; dia <= ultimo; dia += 1) {
    const salvo = porDia.get(dia)
    const data = `${mes}-${String(dia).padStart(2, '0')}`
    dias.push(salvo || {
      id: null,
      empresa_id: empresa.id,
      empresa: empresa.apelido || empresa.razao_social,
      bk_number: empresa.bk_number,
      data,
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      cart_digital: 0,
      ifood: 0,
      azul: 0,
      rappi: 0,
      food99: 0,
      despesas_caixa: 0,
      depositos_caixa: 0,
      bandeiras: [],
      lancamentos: [],
      observacao: '',
      status: 'rascunho',
      atualizado_em: null,
    })
  }

  const preenchidos = dias.filter((d) => d.id)
  const totais = CAMPOS.reduce((acc, campo) => {
    acc[campo] = Math.round(preenchidos.reduce((s, d) => s + (Number(d[campo]) || 0), 0) * 100) / 100
    return acc
  }, {})

  return {
    empresa: {
      id: empresa.id,
      apelido: empresa.apelido || empresa.razao_social,
      bk_number: empresa.bk_number,
    },
    mes,
    dias,
    totais,
    resumo: {
      dias_com_movimento: preenchidos.length,
      conferidos: preenchidos.filter((d) => d.status === 'conferido' || d.status === 'fechado').length,
      fechados: preenchidos.filter((d) => d.status === 'fechado').length,
      dinheiro_pix: Math.round((totais.dinheiro + totais.pix) * 100) / 100,
    },
    pdv: await statusLoja(pool, empresa.id),
  }
}

function normalizarBandeiras(lista) {
  if (!Array.isArray(lista)) return []
  return lista.slice(0, 40).map((item) => ({
    bandeira: String(item.bandeira || item.nome || 'Outros').slice(0, 40),
    tipo: ['credito', 'debito', 'voucher'].includes(item.tipo) ? item.tipo : 'outros',
    valor: dinheiro(item.valor),
  })).filter((item) => item.valor > 0)
}

async function statusLoja(pool, empresaId) {
  const { rows } = await pool.query(
    `select ultimo_ok, ultimo_dia, ultima_mensagem from caixa_loja_status where empresa_id = $1`,
    [empresaId],
  )
  const row = rows[0]
  if (!row?.ultimo_ok) {
    return { ok: false, ultimo_ok: null, ultimo_dia: null, atraso_horas: null, mensagem: '' }
  }
  const atrasoMin = (Date.now() - new Date(row.ultimo_ok).getTime()) / 60000
  return {
    ok: atrasoMin <= 26 * 60,
    ultimo_ok: row.ultimo_ok,
    ultimo_dia: dataIso(row.ultimo_dia),
    atraso_horas: Math.round((atrasoMin / 60) * 10) / 10,
    mensagem: row.ultima_mensagem || '',
  }
}

async function marcarStatusLoja(pool, empresa, { dia, mensagem }) {
  await pool.query(`
    insert into caixa_loja_status (empresa_id, bk_number, ultimo_ok, ultimo_dia, ultima_mensagem)
    values ($1, $2, now(), $3, $4)
    on conflict (empresa_id) do update set
      bk_number = excluded.bk_number,
      ultimo_ok = now(),
      ultimo_dia = coalesce(excluded.ultimo_dia, caixa_loja_status.ultimo_dia),
      ultima_mensagem = excluded.ultima_mensagem
  `, [empresa.id, empresa.bk_number, dia || null, String(mensagem || 'ok').slice(0, 200)])
}

async function empresaPorBk(pool, bk) {
  const { rows } = await pool.query(`
    select id, apelido, razao_social, bk_number, tipo
    from empresas
    where ativo and tipo = 'loja'
      and regexp_replace(coalesce(bk_number, ''), '\\D', '', 'g') = $1
  `, [bk])
  return rows[0]
}

export async function receberHeartbeat(pool, body, tokenEsperado, tokenRecebido) {
  if (!tokenEsperado) throw erro('Recepção do caixa ainda não tem chave.', 503)
  if (!tokenRecebido || tokenRecebido !== tokenEsperado) throw erro('Chave inválida.', 401)
  const bk = String(body.bk_number || '').replace(/\D/g, '')
  if (!bk) throw erro('Informe o número da loja.')
  const empresa = await empresaPorBk(pool, bk)
  if (!empresa) throw erro('Loja não cadastrada no Azimut.', 404)
  await garantirSchemaCaixa(pool)
  await marcarStatusLoja(pool, empresa, { mensagem: 'tamos conectado' })
  return { ok: true, mensagem: 'tamos conectado', empresa: empresa.apelido || empresa.razao_social, bk_number: bk }
}

export async function receberIngestao(pool, body, tokenEsperado, tokenRecebido) {
  if (!tokenEsperado) throw erro('Recepção do caixa ainda não tem chave.', 503)
  if (!tokenRecebido || tokenRecebido !== tokenEsperado) throw erro('Chave inválida.', 401)

  const bk = String(body.bk_number || '').replace(/\D/g, '')
  const data = String(body.data || '').trim()
  if (!bk || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw erro('Informe o número da loja e a data.')

  const empresa = await empresaPorBk(pool, bk)
  if (!empresa) throw erro('Loja não cadastrada no Azimut.', 404)

  return salvarFechamento(pool, {
    empresa_id: empresa.id,
    data,
    dinheiro: body.dinheiro,
    pix: body.pix,
    debito: body.debito,
    credito: body.credito,
    cart_digital: body.cart_digital,
    ifood: body.ifood,
    azul: body.azul,
    rappi: body.rappi,
    food99: body.food99,
    bandeiras: body.bandeiras,
    observacao: body.observacao || 'Enviado pelo servidor da loja.',
    status: 'rascunho',
    origem: 'pos',
  })
}

export async function salvarFechamento(pool, body) {
  await garantirSchemaCaixa(pool)
  const empresaId = String(body.empresa_id || '').trim()
  const data = String(body.data || '').trim()
  if (!empresaId || !/^\d{4}-\d{2}-\d{2}$/.test(data)) throw erro('Informe a loja e a data.')

  const empresa = (await pool.query(`select id, tipo, bk_number from empresas where id = $1 and ativo`, [empresaId])).rows[0]
  if (!empresa) throw erro('Loja não encontrada.', 404)
  if (empresa.tipo !== 'loja') throw erro('Só loja fecha caixa.')

  const atual = (await pool.query(`select * from fechamento_caixa where empresa_id = $1 and data = $2`, [empresaId, data])).rows[0]
  if (atual?.status === 'fechado' && body.origem !== 'pos') throw erro('Esse dia já está fechado.')

  const pos = body.origem === 'pos'
  const status = pos && atual?.status === 'fechado' ? 'fechado' : statusValido(body.status)
  const valores = Object.fromEntries(CAMPOS.map((campo) => [campo, dinheiro(body[campo])]))
  if (pos && atual) {
    valores.despesas_caixa = Number(atual.despesas_caixa) || 0
    valores.depositos_caixa = Number(atual.depositos_caixa) || 0
  }

  if (!pos && Array.isArray(body.lancamentos)) {
    const linhas = body.lancamentos.filter((item) => dinheiro(item.valor) > 0)
    valores.despesas_caixa = dinheiro(linhas.filter((item) => item.tipo === 'despesa').reduce((s, item) => s + dinheiro(item.valor), 0))
    valores.depositos_caixa = dinheiro(linhas.filter((item) => item.tipo === 'deposito').reduce((s, item) => s + dinheiro(item.valor), 0))
  }

  const observacao = pos && atual?.observacao
    ? atual.observacao
    : String(body.observacao || '').trim().slice(0, 2000)
  const bandeiras = pos
    ? JSON.stringify(normalizarBandeiras(body.bandeiras))
    : JSON.stringify(atual?.bandeiras || [])

  const { rows } = await pool.query(`
    insert into fechamento_caixa (
      empresa_id, data, dinheiro, pix, debito, credito, cart_digital,
      ifood, azul, rappi, food99, despesas_caixa, depositos_caixa, observacao, status, bandeiras, atualizado_em
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, now()
    )
    on conflict (empresa_id, data) do update set
      dinheiro = excluded.dinheiro,
      pix = excluded.pix,
      debito = excluded.debito,
      credito = excluded.credito,
      cart_digital = excluded.cart_digital,
      ifood = excluded.ifood,
      azul = excluded.azul,
      rappi = excluded.rappi,
      food99 = excluded.food99,
      despesas_caixa = excluded.despesas_caixa,
      depositos_caixa = excluded.depositos_caixa,
      observacao = excluded.observacao,
      status = excluded.status,
      bandeiras = excluded.bandeiras,
      atualizado_em = now()
    returning id
  `, [
    empresaId, data,
    valores.dinheiro, valores.pix, valores.debito, valores.credito, valores.cart_digital,
    valores.ifood, valores.azul, valores.rappi, valores.food99, valores.despesas_caixa, valores.depositos_caixa,
    observacao, status, bandeiras,
  ])

  const fechamentoId = rows[0].id
  if (pos) {
    await marcarStatusLoja(pool, empresa, { dia: data, mensagem: 'tamos conectado' })
  }
  if (!pos && Array.isArray(body.lancamentos)) {
    const antigos = (await pool.query(
      `select id, comprovante_arquivo, comprovante_nome from fechamento_caixa_lancamentos where fechamento_id = $1`,
      [fechamentoId],
    )).rows
    const porId = new Map(antigos.map((item) => [item.id, item]))
    await pool.query(`delete from fechamento_caixa_lancamentos where fechamento_id = $1`, [fechamentoId])
    for (const item of body.lancamentos) {
      if (dinheiro(item.valor) <= 0) continue
      const tipo = item.tipo === 'deposito' ? 'deposito' : 'despesa'
      const inserido = await pool.query(`
        insert into fechamento_caixa_lancamentos (
          fechamento_id, tipo, valor, plano_conta_id, fornecedor_id, numero, descricao, fornecedor_nome
        ) values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning id
      `, [
        fechamentoId,
        tipo,
        dinheiro(item.valor),
        uuidOuNulo(item.plano_conta_id),
        uuidOuNulo(item.fornecedor_id),
        String(item.numero || '').slice(0, 80),
        String(item.descricao || '').slice(0, 500),
        String(item.fornecedor || item.fornecedor_nome || '').slice(0, 200),
      ])
      const lanId = inserido.rows[0].id
      let comprovante = { arquivo: null, nome: '' }
      if (item.comprovante?.base64) {
        comprovante = gravarArquivoComprovante(lanId, item.comprovante)
      } else if (!item.remover_comprovante) {
        const antigo = porId.get(item.id)
        if (antigo?.comprovante_arquivo) {
          comprovante = copiarComprovante(antigo.comprovante_arquivo, lanId, antigo.comprovante_nome)
        }
      }
      if (comprovante.arquivo) {
        await pool.query(
          `update fechamento_caixa_lancamentos set comprovante_arquivo = $2, comprovante_nome = $3 where id = $1`,
          [lanId, comprovante.arquivo, comprovante.nome],
        )
      }
    }
  }

  const completo = (await pool.query(`
    select f.*, e.apelido, e.razao_social, e.bk_number
    from fechamento_caixa f
    join empresas e on e.id = f.empresa_id
    where f.id = $1
  `, [fechamentoId])).rows[0]
  const lans = (await pool.query(`${SQL_LANCAMENTOS}
    where l.fechamento_id = $1
    order by l.criado_em
  `, [fechamentoId])).rows.map(lancamentoPublico)
  return linhaPublica({ ...completo, lancamentos: lans })
}
