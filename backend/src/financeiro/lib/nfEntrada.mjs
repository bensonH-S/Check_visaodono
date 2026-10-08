function digitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

export function chaveNota(valor) {
  const base = String(valor ?? '').split(/[-/]/)[0]
  return digitos(base).replace(/^0+/, '')
}

export function cruzarNotas(despesas, notas) {
  const porLoja = new Map()
  for (const nota of notas) {
    const numero = chaveNota(nota.numero)
    const loja = digitos(nota.cnpj_loja)
    if (!numero || !loja) continue
    const chave = `${loja}|${numero}`
    const lista = porLoja.get(chave) || []
    lista.push(nota)
    porLoja.set(chave, lista)
  }
  return despesas.flatMap((despesa) => {
    const numero = chaveNota(despesa.numero_nf)
    const loja = digitos(despesa.cnpj_empresa)
    if (!numero || !loja) return []
    const candidatas = porLoja.get(`${loja}|${numero}`) || []
    const emitente = digitos(despesa.cnpj_fornecedor)
    const nota = candidatas.length === 1
      ? candidatas[0]
      : candidatas.find((item) => digitos(item.emitente_cnpj) === emitente)
    if (!nota) return []
    return [{ despesa_id: despesa.id, nfe_id: String(nota.id) }]
  })
}
