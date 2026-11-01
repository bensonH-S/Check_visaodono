/** Guarda a semana em que a despesa foi informada e leva o mesmo lançamento para a semana nova. */

export async function arquivarSemanaAtual(db, id) {
  await db.query(
    `
    insert into despesa_aparicoes (despesa_id, vencimento, valor, valor_face, juros, multa, conta)
    select id, vencimento, valor, coalesce(valor_face, valor), coalesce(juros, 0), coalesce(multa, 0), false
    from despesas
    where id = $1::uuid and vencimento is not null
    on conflict (despesa_id, vencimento) do update
      set valor = excluded.valor,
          valor_face = excluded.valor_face,
          juros = excluded.juros,
          multa = excluded.multa,
          conta = false
    `,
    [id],
  )
}

export async function gravarAparicaoVigente(db, id) {
  await db.query(`update despesa_aparicoes set conta = false where despesa_id = $1::uuid`, [id])
  await db.query(
    `
    insert into despesa_aparicoes (despesa_id, vencimento, valor, valor_face, juros, multa, conta)
    select id, vencimento, valor, coalesce(valor_face, valor), coalesce(juros, 0), coalesce(multa, 0), true
    from despesas
    where id = $1::uuid and vencimento is not null
    on conflict (despesa_id, vencimento) do update
      set valor = excluded.valor,
          valor_face = excluded.valor_face,
          juros = excluded.juros,
          multa = excluded.multa,
          conta = true
    `,
    [id],
  )
}

/** Mesmo boleto em aberto: atualiza juros, multa e vencimento sem abrir outra despesa. */
export async function levarDespesa(db, id, acrescimo) {
  const atual = await db.query(
    `select to_char(vencimento, 'YYYY-MM-DD') as vencimento from despesas where id = $1::uuid`,
    [id],
  )
  const vencimentoAtual = atual.rows[0]?.vencimento || null
  if (vencimentoAtual && acrescimo.vencimento && vencimentoAtual !== acrescimo.vencimento) {
    await arquivarSemanaAtual(db, id)
  }
  await db.query(
    `
    update despesas set
      vencimento = $2::date,
      vencimento_original = coalesce(vencimento_original, $3::date, vencimento),
      valor = $4,
      valor_face = coalesce(valor_face, $5),
      multa = $6,
      juros = $7,
      outras_taxas = $8,
      desconto = $9,
      modo_acrescimo = $10
    where id = $1::uuid
    `,
    [
      id,
      acrescimo.vencimento,
      vencimentoAtual,
      acrescimo.total,
      acrescimo.face,
      acrescimo.multa,
      acrescimo.juros,
      acrescimo.outras,
      acrescimo.desconto,
      acrescimo.modo,
    ],
  )
  await gravarAparicaoVigente(db, id)
}

export async function acharParaLevar(db, { empresaId, documentoRef, numeroNf, fornecedorId }) {
  if (documentoRef) {
    const { rows } = await db.query(
      `
      select id::text as id, status, coalesce(excluida_manualmente, false) as excluida
      from despesas
      where empresa_origem_id = $1::uuid and documento_ref = $2
      order by created_at desc
      limit 1
      `,
      [empresaId, documentoRef],
    )
    const row = rows[0]
    if (row?.excluida) return { excluida: true, id: row.id }
    if (row && ['paga', 'conciliada'].includes(row.status)) return { paga: true, id: row.id }
    if (row && row.status !== 'cancelada') return { id: row.id }
  }
  const nf = String(numeroNf || '').trim()
  if (!nf) return null
  const { rows } = await db.query(
    `
    select id::text as id
    from despesas
    where empresa_origem_id = $1::uuid
      and btrim(coalesce(numero_nf, '')) = btrim($2)
      and ($3::text is null or coalesce(fornecedor_id::text, '') = $3::text)
      and status not in ('paga', 'conciliada', 'cancelada')
      and coalesce(excluida_manualmente, false) = false
    `,
    [empresaId, nf, fornecedorId || null],
  )
  if (rows.length === 1) return { id: rows[0].id }
  return null
}
