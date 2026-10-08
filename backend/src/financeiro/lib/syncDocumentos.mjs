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

function numeroNota(valor) {
  return String(valor || '').split(/[-/]/)[0].replace(/\D/g, '').replace(/^0+/, '')
}

function valorCentavos(valor) {
  const n = Number(String(valor).replace(/\./g, '').replace(',', '.'))
  if (Number.isFinite(n)) return Math.round(n * 100)
  const direto = Number(valor)
  return Number.isFinite(direto) ? Math.round(direto * 100) : null
}

export function pastaDocumentos(root) {
  return path.join(root, 'data', 'esupri')
}

export async function sincronizarDocumentos({ root, env, pool, operacional, dias = 60, onLog = console.log }) {
  const base = raizMeridian(root)
  if (!base) throw new Error('O cliente do eSupri não está neste computador.')
  if (!env.ESUPRI_USER || !env.ESUPRI_PASS) throw new Error('Falta o acesso ao eSupri neste computador.')

  await pool.query(`
    alter table despesas add column if not exists boleto_arquivo text;
    alter table despesas add column if not exists nota_arquivo text;
  `)

  const { rows } = await pool.query(`
    select d.id, d.numero_nf, d.valor::float8 as valor, d.boleto_arquivo, d.nota_arquivo
    from despesas d
    where d.status <> 'cancelada' and d.numero_nf is not null and d.numero_nf <> '' and d.numero_nf <> '0'
  `)
  const porChave = new Map()
  const porNumero = new Map()
  for (const row of rows) {
    const numero = numeroNota(row.numero_nf)
    const chave = `${numero}|${Math.round(Number(row.valor) * 100)}`
    if (!porChave.has(chave)) porChave.set(chave, row)
    const lista = porNumero.get(numero) || []
    lista.push(row)
    porNumero.set(numero, lista)
  }

  const lojasUrl = pathToFileURL(path.join(base, 'src', 'config', 'fornecedoresLojas.js')).href
  const clienteUrl = pathToFileURL(path.join(base, 'src', 'services', 'platlog', 'esupriClient.js')).href
  const { ESUPRI_LOJAS } = await import(lojasUrl)
  const { sincronizarDocumentosEsupri } = await import(clienteUrl)
  const pasta = pastaDocumentos(root)
  fs.mkdirSync(path.join(pasta, 'boletos'), { recursive: true })
  fs.mkdirSync(path.join(pasta, 'notas'), { recursive: true })

  const resumo = await sincronizarDocumentosEsupri({
    user: env.ESUPRI_USER,
    pass: env.ESUPRI_PASS,
    baseUrl: env.ESUPRI_BASE_URL,
    headless: true,
    esupriLojaCodigos: ESUPRI_LOJAS.map((loja) => loja.esupri_codigo),
    dias,
    onLog,
    pular: (titulo, tipo, lojaCodigo) => {
      const row = achar(porChave, porNumero, titulo)
      if (row) {
        const coluna = tipo === 'boleto' ? row.boleto_arquivo : row.nota_arquivo
        return Boolean(coluna && fs.existsSync(path.join(root, coluna)))
      }
      return fs.existsSync(caminhoSolto(root, titulo, tipo, lojaCodigo))
    },
    onDocumento: async ({ tipo, pdf, titulo, lojaCodigo }) => {
      const nome = tipo === 'boleto' ? 'boletos' : 'notas'
      const row = achar(porChave, porNumero, titulo)
      const relativo = row
        ? `data/esupri/${nome}/${row.id}.pdf`
        : caminhoSolto(root, titulo, tipo, lojaCodigo).slice(root.length + 1).split(path.sep).join('/')
      fs.writeFileSync(path.join(root, relativo), pdf)
      if (!row) {
        onLog(`guardado sem despesa ${titulo.MR_DOCUMENTO || ''}`)
        return
      }
      const coluna = tipo === 'boleto' ? 'boleto_arquivo' : 'nota_arquivo'
      await pool.query(`update despesas set ${coluna} = $2 where id = $1`, [row.id, relativo])
      row[coluna] = relativo
    },
  })
  return resumo
}

function caminhoSolto(root, titulo, tipo, lojaCodigo = '') {
  const doc = String(titulo.MR_DOCUMENTO || titulo.MR_NUNFIS || 'sem-nota').replace(/[^\w.-]+/g, '_')
  const nome = tipo === 'boleto' ? 'boletos' : 'notas'
  const loja = String(lojaCodigo || titulo.CL_CODIGO || 'loja')
  return path.join(root, 'data', 'esupri', nome, `${loja}-${doc}.pdf`)
}

function achar(porChave, porNumero, titulo) {
  const doc = String(titulo.MR_DOCUMENTO || '')
  const pedaco = doc.includes('/') ? doc.split('/').pop() : String(titulo.MR_NUNFIS || doc)
  const numero = numeroNota(pedaco)
  const centavos = valorCentavos(String(titulo.FMT_VALOR || titulo.FMT_VLORI || ''))
  if (!numero) return null
  if (centavos != null && porChave.has(`${numero}|${centavos}`)) return porChave.get(`${numero}|${centavos}`)
  const lista = porNumero.get(numero) || []
  return lista.length === 1 ? lista[0] : null
}
