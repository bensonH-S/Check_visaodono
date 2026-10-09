/**
 * Casa boleto DDA com NF-e da Receita para não lançar a mesma compra duas vezes.
 */

function digitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

export function numeroNota(valor) {
  const base = String(valor ?? '').split(/[-/]/)[0]
  return digitos(base).replace(/^0+/, '')
}

function raizCnpj(valor) {
  return digitos(valor).slice(0, 8)
}

function diaIso(valor) {
  const dia = String(valor || '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia : ''
}

function diasEntre(a, b) {
  const da = diaIso(a)
  const db = diaIso(b)
  if (!da || !db) return null
  const ms = Date.parse(`${da}T12:00:00Z`) - Date.parse(`${db}T12:00:00Z`)
  if (!Number.isFinite(ms)) return null
  return Math.abs(Math.round(ms / 86400000))
}

export function mesmoValor(a, b, tolerancia = 0.05) {
  const va = Number(a)
  const vb = Number(b)
  if (!Number.isFinite(va) || !Number.isFinite(vb)) return false
  return Math.abs(va - vb) <= tolerancia
}

/**
 * Pontua um candidato DDA para uma parcela/nota.
 * >= 80 = casamento forte o bastante para unificar sozinho.
 */
export function pontuarDdaComNota(nota, despesa, parcela = null) {
  const empresaNota = digitos(nota.cnpj_empresa || nota.empresa_cnpj)
  const empresaDesp = digitos(despesa.cnpj_empresa || despesa.empresa_cnpj)
  if (empresaNota && empresaDesp && empresaNota !== empresaDesp) return 0
  if (nota.empresa_id && despesa.empresa_origem_id && String(nota.empresa_id) !== String(despesa.empresa_origem_id)) {
    return 0
  }

  const emit = raizCnpj(nota.emitente_cnpj)
  const cedente = raizCnpj(despesa.cnpj_cedente || despesa.cnpj_fornecedor)
  if (emit && cedente && emit !== cedente) return 0

  let pontos = 0
  if (emit && cedente && emit === cedente) pontos += 35
  if (empresaNota && empresaDesp && empresaNota === empresaDesp) pontos += 15
  if (nota.empresa_id && despesa.empresa_origem_id && String(nota.empresa_id) === String(despesa.empresa_origem_id)) {
    pontos += 15
  }

  const numNota = numeroNota(nota.numero)
  const numDesp = numeroNota(despesa.numero_nf || despesa.documento)
  if (numNota && numDesp && numNota !== numDesp) return 0
  if (numNota && numDesp && numNota === numDesp) pontos += 45

  const valor = parcela?.valor ?? nota.valor_total
  if (mesmoValor(valor, despesa.valor)) pontos += 25
  else if (!(numNota && numDesp && numNota === numDesp)) return 0

  const venc = parcela?.vencimento || nota.vencimento || nota.emissao
  const gap = diasEntre(venc, despesa.vencimento)
  if (gap == null) {
    /* sem data não atrapalha se o número já bateu */
  } else if (gap <= 3) pontos += 20
  else if (gap <= 10) pontos += 10
  else if (gap <= 45 && numNota && numDesp && numNota === numDesp) pontos += 5
  else if (gap > 45 && !(numNota && numDesp && numNota === numDesp)) return 0

  return pontos
}

/** Escolhe no máximo um DDA por nota/parcela quando o placar é único e forte. */
export function escolherDdaParaNota(nota, despesas, parcela = null) {
  const ranque = despesas
    .map((despesa) => ({ despesa, pontos: pontuarDdaComNota(nota, despesa, parcela) }))
    .filter((item) => item.pontos >= 80)
    .sort((a, b) => b.pontos - a.pontos)
  if (!ranque.length) return null
  if (ranque.length > 1 && ranque[0].pontos === ranque[1].pontos) return null
  return ranque[0].despesa
}

export function escolherNotaParaDda(despesa, notas) {
  const ranque = notas
    .map((nota) => ({ nota, pontos: pontuarDdaComNota(nota, despesa) }))
    .filter((item) => item.pontos >= 80)
    .sort((a, b) => b.pontos - a.pontos)
  if (!ranque.length) return null
  if (ranque.length > 1 && ranque[0].pontos === ranque[1].pontos) return null
  return ranque[0].nota
}

/** Pares únicos despesa↔nota a partir das listas. */
export function cruzarDdaComNotas(despesas, notas) {
  const usadosNota = new Set()
  const usadosDespesa = new Set()
  const pares = []
  const ordenadas = [...notas].sort((a, b) => {
    const ta = Date.parse(a.emissao || '') || 0
    const tb = Date.parse(b.emissao || '') || 0
    return tb - ta
  })
  for (const nota of ordenadas) {
    if (usadosNota.has(nota.id)) continue
    const livres = despesas.filter((d) => !usadosDespesa.has(d.id))
    const despesa = escolherDdaParaNota(nota, livres)
    if (!despesa) continue
    usadosNota.add(nota.id)
    usadosDespesa.add(despesa.id)
    pares.push({ despesa_id: despesa.id, nfe_recebida_id: nota.id, numero_nf: nota.numero || null })
  }
  return pares
}
