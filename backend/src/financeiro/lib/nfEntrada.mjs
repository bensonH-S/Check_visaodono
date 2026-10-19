function digitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

function raizCnpj(valor) {
  const d = digitos(valor)
  return d.length >= 8 ? d.slice(0, 8) : d
}

export function chaveNota(valor) {
  const base = String(valor ?? '').split(/[-/]/)[0]
  return digitos(base).replace(/^0+/, '')
}

function mesmoEmitente(a, b) {
  const da = digitos(a)
  const db = digitos(b)
  if (!da || !db) return false
  if (da === db) return true
  return raizCnpj(da) === raizCnpj(db) && raizCnpj(da).length === 8
}

/**
 * Cruza despesas (boletos da Agenda/Inbox) com NFs conferidas no estoque.
 * 1) loja CNPJ + número
 * 2) fallback: emitente (CNPJ ou raiz) + número
 */
export function cruzarNotas(despesas, notas) {
  const porLoja = new Map()
  const porEmitente = new Map()
  const porRaiz = new Map()
  for (const nota of notas) {
    const numero = chaveNota(nota.numero)
    if (!numero) continue
    const loja = digitos(nota.cnpj_loja)
    const emitente = digitos(nota.emitente_cnpj)
    const raiz = raizCnpj(emitente)
    if (loja) {
      const chave = `${loja}|${numero}`
      const lista = porLoja.get(chave) || []
      lista.push(nota)
      porLoja.set(chave, lista)
    }
    if (emitente) {
      const chave = `${emitente}|${numero}`
      const lista = porEmitente.get(chave) || []
      lista.push(nota)
      porEmitente.set(chave, lista)
    }
    if (raiz.length === 8) {
      const chave = `${raiz}|${numero}`
      const lista = porRaiz.get(chave) || []
      lista.push(nota)
      porRaiz.set(chave, lista)
    }
  }

  const usados = new Set()
  const pares = []

  for (const despesa of despesas) {
    const numero = chaveNota(despesa.numero_nf)
    if (!numero) continue
    const loja = digitos(despesa.cnpj_empresa)
    const emitente = digitos(despesa.cnpj_fornecedor)
    const raiz = raizCnpj(emitente)

    let candidatas = loja ? (porLoja.get(`${loja}|${numero}`) || []) : []
    let nota =
      candidatas.length === 1
        ? candidatas[0]
        : candidatas.find((item) => mesmoEmitente(item.emitente_cnpj, emitente))

    if (!nota && emitente) {
      candidatas = porEmitente.get(`${emitente}|${numero}`) || []
      if (!candidatas.length && raiz.length === 8) {
        candidatas = porRaiz.get(`${raiz}|${numero}`) || []
      }
      nota =
        candidatas.length === 1
          ? candidatas[0]
          : candidatas.find((item) => digitos(item.cnpj_loja) === loja) || null
      if (!nota && candidatas.length === 1) nota = candidatas[0]
    }

    if (!nota) continue
    const nfeId = String(nota.id)
    if (usados.has(nfeId)) continue
    usados.add(nfeId)
    pares.push({ despesa_id: despesa.id, nfe_id: nfeId })
  }
  return pares
}

/**
 * Só marca nf_confirmada nas despesas que já existem (Agenda/Inbox).
 * Não cria lançamento novo — evita duplicata.
 */
export async function sincronizarNfesConferidas({ financePool, portalPool }) {
  const despesas = await financePool.query(`
    select d.id, d.numero_nf, d.status,
           coalesce(f.cpf_cnpj, d.cnpj_cedente) as cnpj_fornecedor,
           eo.cnpj as cnpj_empresa
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    left join fornecedores f on f.id = d.fornecedor_id
    where coalesce(d.nf_confirmada, false) = false
      and d.numero_nf is not null
      and btrim(d.numero_nf) <> ''
      and d.status <> 'cancelada'
      and coalesce(d.fonte, '') <> 'nfe'
  `)

  const notas = await portalPool.query(`
    select n.id_nfe::text as id, n.numero, n.emitente_cnpj,
           l.cnpj as cnpj_loja
    from estoque_nfe n
    join lojas l on l.id_loja = n.id_loja
    where n.status_entrega = 'conferida'
  `)

  let ligadas = 0
  for (const cruzamento of cruzarNotas(despesas.rows, notas.rows)) {
    // Agenda: só selo. Inbox (rascunho/classificada): sobe pra Agenda como já fazia.
    const up = await financePool.query(
      `update despesas set
         nf_confirmada = true,
         nfe_id = $2,
         status = case
           when status in ('rascunho', 'classificada', 'bloqueada_duplicata') then 'pronta'
           else status
         end,
         pendente_inbox = case
           when status in ('rascunho', 'classificada', 'bloqueada_duplicata') then false
           else pendente_inbox
         end
       where id = $1 and coalesce(nf_confirmada, false) = false
       returning id, status`,
      [cruzamento.despesa_id, cruzamento.nfe_id],
    )
    if (up.rowCount) ligadas += 1
  }

  return {
    ligadas,
    criadas: 0,
    ignoradas: Math.max(0, notas.rowCount - ligadas),
    conferidas: notas.rowCount,
  }
}

/** Cancela duplicatas ESTOQUE-NFE criadas por engano no Inbox. */
export async function cancelarDuplicatasNfeInbox(financePool) {
  const { rows } = await financePool.query(`
    update despesas
       set status = 'cancelada',
           pendente_inbox = false
     where fonte = 'nfe'
       and documento_ref like 'ESTOQUE-NFE|%'
       and status in ('rascunho', 'classificada', 'bloqueada_duplicata')
    returning id
  `)
  return rows.length
}
