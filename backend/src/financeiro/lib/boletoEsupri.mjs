import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function raizMeridian(root) {
  const candidatos = [
    path.resolve(root, '..', '..'),
    '/var/www/app/backend',
    '/var/www/vision-check/backend',
  ]
  return candidatos.find((dir) => fs.existsSync(path.join(dir, 'src', 'services', 'platlog', 'esupriClient.js')))
}

let fila = Promise.resolve()

function umPorVez(trabalho) {
  const vez = fila.then(trabalho, trabalho)
  fila = vez.then(() => {}, () => {})
  return vez
}

export function baixarBoletoDaDespesa({ root, env, pool, operacional, id }) {
  return umPorVez(() => baixar(root, env, pool, operacional, id))
}

async function baixar(root, env, pool, operacional, id, tipo = 'boleto') {
  const despesa = await pool.query(
    `select d.numero_nf, d.valor, d.nfe_id, eo.cnpj
     from despesas d
     join empresas eo on eo.id = d.empresa_origem_id
     where d.id = $1`,
    [id],
  )
  const row = despesa.rows[0]
  if (!row?.numero_nf) {
    throw Object.assign(new Error('Essa despesa não tem número de nota para achar o boleto.'), { status: 404 })
  }
  const base = raizMeridian(root)
  if (!base) {
    throw Object.assign(new Error('O cliente do eSupri não está neste computador.'), { status: 500 })
  }
  if (!env.ESUPRI_USER || !env.ESUPRI_PASS) {
    throw Object.assign(new Error('Falta o acesso ao eSupri neste computador.'), { status: 500 })
  }

  const lojasUrl = pathToFileURL(path.join(base, 'src', 'config', 'fornecedoresLojas.js')).href
  const clienteUrl = pathToFileURL(path.join(base, 'src', 'services', 'platlog', 'esupriClient.js')).href
  const { ESUPRI_LOJAS, findEsupriLojaByBk } = await import(lojasUrl)
  const { baixarBoletoEsupri, baixarDanfeEsupri } = await import(clienteUrl)

  const codigos = await codigosDaNota({ operacional, row, ESUPRI_LOJAS, findEsupriLojaByBk })
  const baixarArquivo = tipo === 'nota' ? baixarDanfeEsupri : baixarBoletoEsupri
  return baixarArquivo({
    user: env.ESUPRI_USER,
    pass: env.ESUPRI_PASS,
    baseUrl: env.ESUPRI_BASE_URL,
    headless: true,
    esupriLojaCodigos: codigos,
    numeroNota: row.numero_nf,
    valor: Number(row.valor),
  })
}

export function baixarNotaDaDespesa({ root, env, pool, operacional, id }) {
  return umPorVez(() => baixar(root, env, pool, operacional, id, 'nota'))
}

async function codigosDaNota({ operacional, row, ESUPRI_LOJAS, findEsupriLojaByBk }) {
  const todos = ESUPRI_LOJAS.map((loja) => loja.esupri_codigo)
  let preferido = ''
  if (row.nfe_id) {
    const loja = await operacional.query(
      `select l.bk_number
       from estoque_nfe n
       join lojas l on l.id_loja = n.id_loja
       where n.id_nfe = $1`,
      [row.nfe_id],
    )
    preferido = findEsupriLojaByBk(loja.rows[0]?.bk_number)?.esupri_codigo || ''
  }
  const cnpj = String(row.cnpj || '').replace(/\D/g, '')
  let daEmpresa = []
  if (cnpj) {
    const lojas = await operacional.query(
      `select bk_number
       from lojas
       where regexp_replace(coalesce(cnpj, ''), '\\D', '', 'g') = $1`,
      [cnpj],
    )
    daEmpresa = lojas.rows
      .map((item) => findEsupriLojaByBk(item.bk_number)?.esupri_codigo)
      .filter(Boolean)
  }
  return [...new Set([preferido, ...daEmpresa, ...todos].filter(Boolean))]
}
