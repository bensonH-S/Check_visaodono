import { acharFornecedor } from './dda.mjs'

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

function isoDate(valor) {
  if (!valor) return null
  const s = String(valor).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function competenciaDe(dataIso) {
  const s = isoDate(dataIso)
  return s ? `${s.slice(0, 7)}-01` : null
}

/**
 * Ciclo na Agenda (simples):
 * - em_transito → mercadoria ainda não chegou (portal / saída)
 * - nao_confirmada → chegou, loja ainda não conferiu (selo: NF Pendente)
 * - confirmada → conferida ok
 * - divergente → conferida com diferença (selo: NF Parcial)
 */
export function cicloNfDeStatus(statusEntrega) {
  const s = String(statusEntrega || '').toLowerCase()
  if (s === 'divergente') return 'divergente'
  if (s === 'conferida') return 'confirmada'
  if (s === 'aguardando_conferencia') return 'nao_confirmada'
  if (s === 'em_transito' || s === 'aguardando_portal') return 'em_transito'
  return 'em_transito'
}

/**
 * Cruza despesas (boletos da Agenda/Inbox) com NFs do estoque.
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
    const ciclo = cicloNfDeStatus(nota.status_entrega)
    pares.push({
      despesa_id: despesa.id,
      nfe_id: nfeId,
      status_entrega: nota.status_entrega,
      ciclo,
      divergente: ciclo === 'divergente',
      confirmada: ciclo === 'confirmada' || ciclo === 'divergente',
    })
  }
  return pares
}

async function garantirColunasNf(financePool) {
  await financePool.query(`
    alter table despesas add column if not exists nf_divergente boolean not null default false;
    alter table despesas add column if not exists nf_ciclo text;
  `)
}

function docRefNfe(nfeId) {
  return `ESTOQUE-NFE|${nfeId}`
}

/**
 * NFs conferidas no gestor sem boleto DDA → lança direto na Agenda (fonte nfe).
 * Reativa ESTOQUE-NFE canceladas se a mesma nota voltou a ser conferida.
 */
async function criarDespesasNfeSemDda({ financePool, notas, nfeIdsJaLigados }) {
  const conferidas = notas.filter((n) => {
    const ciclo = cicloNfDeStatus(n.status_entrega)
    return (ciclo === 'confirmada' || ciclo === 'divergente') && !nfeIdsJaLigados.has(String(n.id))
  })
  if (!conferidas.length) return { criadas: 0, reativadas: 0, sem_empresa: 0 }

  const { rows: empresas } = await financePool.query(
    `select id::text as id, apelido, cnpj, bk_number::text as bk
       from empresas where ativo`,
  )
  const porCnpj = new Map()
  for (const e of empresas) {
    const c = digitos(e.cnpj)
    if (c) porCnpj.set(c, e)
  }

  const { rows: fornecedores } = await financePool.query(
    `select id, nome, cpf_cnpj, plano_conta_id from fornecedores where ativo`,
  )

  const refs = conferidas.map((n) => docRefNfe(n.id))
  const idsNfe = conferidas.map((n) => String(n.id))
  const existentes = await financePool.query(
    `select id::text as id, documento_ref, nfe_id, status
       from despesas
      where documento_ref = any($1::text[])
         or nfe_id = any($2::text[])`,
    [refs, idsNfe],
  )
  const porRef = new Map()
  const porNfeId = new Map()
  for (const row of existentes.rows) {
    if (row.documento_ref) porRef.set(row.documento_ref, row)
    if (row.nfe_id) porNfeId.set(String(row.nfe_id), row)
  }

  let criadas = 0
  let reativadas = 0
  let semEmpresa = 0

  for (const nota of conferidas) {
    const nfeId = String(nota.id)
    const ref = docRefNfe(nfeId)
    const ciclo = cicloNfDeStatus(nota.status_entrega)
    const confirmada = true
    const divergente = ciclo === 'divergente'
    const vencimento =
      isoDate(nota.data_vencimento)
      || isoDate(nota.data_entrega)
      || isoDate(nota.emissao)
    if (!vencimento) continue

    const ja = porRef.get(ref) || porNfeId.get(nfeId)
    if (ja && ja.status !== 'cancelada') {
      // Já existe lançamento ativo (ex.: NF|chave da Receita) — só garante o selo.
      await financePool.query(
        `update despesas set
           nfe_id = $2,
           numero_nf = coalesce(nullif(btrim(numero_nf), ''), $3),
           nf_ciclo = $4,
           nf_confirmada = true,
           nf_divergente = $5,
           status = case
             when status in ('rascunho', 'classificada', 'bloqueada_duplicata') then 'pronta'
             else status
           end,
           pendente_inbox = false
         where id = $1::uuid`,
        [ja.id, nfeId, String(nota.numero || ''), ciclo, divergente],
      )
      nfeIdsJaLigados.add(nfeId)
      continue
    }

    const empresa = porCnpj.get(digitos(nota.cnpj_loja))
    if (!empresa) {
      semEmpresa += 1
      continue
    }

    const fornecedor = acharFornecedor(
      { cnpj_cedente: nota.emitente_cnpj, cedente: nota.emitente_nome },
      fornecedores,
    )
    const descricao = `NF ${nota.numero || nfeId} ${nota.emitente_nome || ''}`.replace(/\s+/g, ' ').trim().slice(0, 200)
    const competencia = competenciaDe(vencimento)
    const valor = Number(nota.valor_total)
    if (!Number.isFinite(valor) || valor <= 0) continue

    if (ja && ja.status === 'cancelada') {
      await financePool.query(
        `update despesas set
           status = 'pronta',
           pendente_inbox = false,
           descricao = $2,
           fornecedor_id = coalesce($3::uuid, fornecedor_id),
           plano_conta_id = coalesce($4::uuid, plano_conta_id),
           empresa_origem_id = $5::uuid,
           documento_ref = $6,
           numero_nf = $7,
           cnpj_cedente = $8,
           competencia = $9::date,
           vencimento = $10::date,
           valor = $11,
           nfe_id = $12,
           nf_ciclo = $13,
           nf_confirmada = true,
           nf_divergente = $14,
           fonte = 'nfe'
         where id = $1::uuid`,
        [
          ja.id,
          descricao,
          fornecedor?.id || null,
          fornecedor?.plano_conta_id || null,
          empresa.id,
          ref,
          String(nota.numero || ''),
          digitos(nota.emitente_cnpj) || null,
          competencia,
          vencimento,
          valor,
          nfeId,
          ciclo,
          divergente,
        ],
      )
      reativadas += 1
      nfeIdsJaLigados.add(nfeId)
      continue
    }

    await financePool.query(
      `insert into despesas (
         descricao, fornecedor_id, empresa_origem_id, plano_conta_id,
         documento_ref, numero_nf, cnpj_cedente, competencia, vencimento, valor,
         status, fonte, pendente_inbox, nfe_id, nf_ciclo, nf_confirmada, nf_divergente
       ) values (
         $1, $2::uuid, $3::uuid, $4::uuid,
         $5, $6, $7, $8::date, $9::date, $10,
         'pronta', 'nfe', false, $11, $12, true, $13
       )`,
      [
        descricao,
        fornecedor?.id || null,
        empresa.id,
        fornecedor?.plano_conta_id || null,
        ref,
        String(nota.numero || ''),
        digitos(nota.emitente_cnpj) || null,
        competencia,
        vencimento,
        valor,
        nfeId,
        ciclo,
        divergente,
      ],
    )
    criadas += 1
    nfeIdsJaLigados.add(nfeId)
  }

  return { criadas, reativadas, sem_empresa: semEmpresa }
}

/**
 * Atualiza selos da Agenda com o ciclo da NF no estoque.
 * Conferidas sem DDA → cria lançamento fonte=nfe direto na Agenda.
 */
export async function sincronizarNfesConferidas({ financePool, portalPool }) {
  await garantirColunasNf(financePool)

  // DDA (e similares) com número — para refletir trânsito x pendente x confirmada.
  const despesas = await financePool.query(`
    select d.id, d.numero_nf, d.status, d.nfe_id,
           coalesce(f.cpf_cnpj, d.cnpj_cedente) as cnpj_fornecedor,
           eo.cnpj as cnpj_empresa
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    left join fornecedores f on f.id = d.fornecedor_id
    where d.numero_nf is not null
      and btrim(d.numero_nf) <> ''
      and d.status <> 'cancelada'
      and coalesce(d.fonte, '') not in ('nfe', 'freecontrol', 'manual')
  `)

  const notas = await portalPool.query(`
    select n.id_nfe::text as id, n.numero, n.emitente_cnpj, n.emitente_nome,
           n.valor_total::float8 as valor_total,
           to_char(n.emissao, 'YYYY-MM-DD') as emissao,
           to_char(n.data_entrega, 'YYYY-MM-DD') as data_entrega,
           to_char(n.data_vencimento, 'YYYY-MM-DD') as data_vencimento,
           l.cnpj as cnpj_loja, n.status_entrega
    from estoque_nfe n
    join lojas l on l.id_loja = n.id_loja
    where n.status_entrega in (
      'conferida', 'divergente',
      'aguardando_conferencia', 'em_transito', 'aguardando_portal'
    )
  `)

  const pares = cruzarNotas(despesas.rows, notas.rows)
  const idsCruzados = new Set(pares.map((p) => String(p.despesa_id)))
  const nfeIdsJaLigados = new Set(pares.map((p) => String(p.nfe_id)))

  // Também marca NFs já ligadas por nfe_id (ex.: lançamentos fonte=nfe anteriores).
  const jaPorNfe = await financePool.query(`
    select nfe_id from despesas
     where status <> 'cancelada'
       and nullif(btrim(nfe_id), '') is not null
  `)
  for (const row of jaPorNfe.rows) nfeIdsJaLigados.add(String(row.nfe_id))

  // Lote: despesas cruzadas com estoque.
  let ciclos = 0
  let ligadas = 0
  if (pares.length) {
    const ids = pares.map((p) => p.despesa_id)
    const nfeIds = pares.map((p) => p.nfe_id)
    const ciclosArr = pares.map((p) => p.ciclo)
    const confArr = pares.map((p) => p.confirmada)
    const divArr = pares.map((p) => p.divergente)
    const up = await financePool.query(
      `update despesas d set
         nfe_id = v.nfe_id,
         nf_ciclo = v.ciclo,
         nf_confirmada = v.confirmada,
         nf_divergente = v.divergente,
         status = case
           when v.confirmada and d.status in ('rascunho', 'classificada', 'bloqueada_duplicata') then 'pronta'
           else d.status
         end,
         pendente_inbox = case
           when v.confirmada and d.status in ('rascunho', 'classificada', 'bloqueada_duplicata') then false
           else d.pendente_inbox
         end
       from (
         select *
         from unnest($1::uuid[], $2::text[], $3::text[], $4::boolean[], $5::boolean[])
           as t(id, nfe_id, ciclo, confirmada, divergente)
       ) v
       where d.id = v.id
         and (
           d.nfe_id is distinct from v.nfe_id
           or coalesce(d.nf_ciclo, '') is distinct from v.ciclo
           or coalesce(d.nf_confirmada, false) is distinct from v.confirmada
           or coalesce(d.nf_divergente, false) is distinct from v.divergente
         )
       returning d.id, v.confirmada`,
      [ids, nfeIds, ciclosArr, confArr, divArr],
    )
    ciclos = up.rowCount
    ligadas = up.rows.filter((r) => r.confirmada).length
  }

  // DDA com número de NF sem match no estoque → em_transito (selo Agenda: NF Pendente).
  const semMatchIds = despesas.rows
    .filter((d) => !idsCruzados.has(String(d.id)))
    .map((d) => d.id)
  let semMatch = 0
  if (semMatchIds.length) {
    const up = await financePool.query(
      `update despesas set
         nf_ciclo = 'em_transito',
         nf_confirmada = false,
         nf_divergente = false
       where id = any($1::uuid[])
         and (
           coalesce(nf_ciclo, '') is distinct from 'em_transito'
           or coalesce(nf_confirmada, false) = true
           or coalesce(nf_divergente, false) = true
         )
       returning id`,
      [semMatchIds],
    )
    semMatch = up.rowCount
  }

  const criacao = await criarDespesasNfeSemDda({
    financePool,
    notas: notas.rows,
    nfeIdsJaLigados,
  })

  const totais = await financePool.query(`
    select
      count(*) filter (where nf_ciclo = 'em_transito')::int as em_transito,
      count(*) filter (where nf_ciclo = 'nao_confirmada')::int as nao_confirmada,
      count(*) filter (where nf_ciclo = 'confirmada')::int as confirmada,
      count(*) filter (where nf_ciclo = 'divergente')::int as divergente
    from despesas
    where status <> 'cancelada'
      and coalesce(fonte, '') in ('dda', 'nfe')
  `)

  return {
    ligadas,
    criadas: criacao.criadas,
    reativadas: criacao.reativadas,
    sem_empresa: criacao.sem_empresa,
    ignoradas: Math.max(0, notas.rowCount - nfeIdsJaLigados.size),
    conferidas: notas.rowCount,
    ciclos_atualizados: ciclos,
    sem_match_transito: semMatch,
    totais: totais.rows[0],
    divergentes_total: totais.rows[0]?.divergente ?? 0,
  }
}

/** Cancela rascunhos ESTOQUE-NFE no Inbox (legado). Agenda usa status=pronta. */
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
