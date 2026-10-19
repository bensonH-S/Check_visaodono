/**
 * Máscara da reunião semanal — vendas + gasto CMV por loja.
 * CMV = Platlog + Ambev/Coca (Brasal) + Gimba + Ideal Work (uniforme).
 */

const CMV_RE =
  String.raw`PLATLOG|BRASAL|\bCOCA\b|COCA[\s-]?COLA|AMBEV|GIMBA|IDEAL\s*WORK`

function digitos(v) {
  return String(v ?? '').replace(/\D/g, '')
}

function dinheiro(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function pct(numerador, denominador) {
  const d = Number(denominador)
  if (!d) return null
  return Math.round((Number(numerador) / d) * 10000) / 10000
}

function isoHojeSp() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function classificarCmv(nome) {
  const n = String(nome || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
  if (/PLATLOG/.test(n)) return 'platlog'
  if (/BRASAL|\bCOCA\b|COCA[\s-]?COLA|AMBEV/.test(n)) return 'coca'
  if (/GIMBA/.test(n)) return 'gimba'
  if (/IDEAL\s*WORK/.test(n)) return 'uniforme'
  return null
}

/**
 * @param {import('pg').Pool|import('pg').Client} pool  finance pool (search_path finance,public)
 * @param {{ de?: string, ate?: string, dias?: number }} opts
 */
export async function montarMascaraReuniao(pool, opts = {}) {
  const ate = String(opts.ate || isoHojeSp()).slice(0, 10)
  let de = String(opts.de || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de)) {
    const dias = Math.min(Math.max(Number(opts.dias) || 30, 1), 90)
    const d = new Date(`${ate}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - (dias - 1))
    de = d.toISOString().slice(0, 10)
  }
  if (de > ate) throw Object.assign(new Error('Período inválido'), { status: 400 })

  const janelaDias =
    Math.round((new Date(`${ate}T12:00:00Z`) - new Date(`${de}T12:00:00Z`)) / 86400000) + 1

  const vendasQ = await pool.query(
    `
    select regexp_replace(coalesce(l.bk_number, ''), '\\D', '', 'g') as bk,
           max(l.name) as loja_nome,
           max(l.id_loja)::int as id_loja,
           count(distinct v.data_venda)::int as dias_venda,
           coalesce(sum(vi.venda_liquida), 0)::float8 as venda
    from public.estoque_vendas v
    join public.estoque_venda_itens vi on vi.id_venda = v.id_venda
    join public.lojas l on l.id_loja = v.id_loja
    where v.origem = 'bkoffice'
      and v.data_venda between $1::date and $2::date
      and regexp_replace(coalesce(l.bk_number, ''), '\\D', '', 'g') <> ''
    group by 1
    `,
    [de, ate],
  )
  const gastosQ = await pool.query(
    `
    select regexp_replace(coalesce(eo.bk_number, ''), '\\D', '', 'g') as bk,
           max(eo.apelido) as apelido,
           coalesce(nullif(btrim(f.nome), ''), nullif(btrim(d.descricao), ''), '') as fornecedor,
           sum(d.valor)::float8 as valor,
           count(*)::int as qtd
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    left join fornecedores f on f.id = d.fornecedor_id
    where d.status not in ('cancelada')
      and d.vencimento between $1::date and $2::date
      and regexp_replace(coalesce(eo.bk_number, ''), '\\D', '', 'g') <> ''
      and (
        upper(coalesce(f.nome, '')) ~ $3
        or upper(coalesce(d.descricao, '')) ~ $3
      )
    group by 1, 3
    `,
    [de, ate, CMV_RE],
  )
  const empresasQ = await pool.query(
    `
    select regexp_replace(coalesce(bk_number, ''), '\\D', '', 'g') as bk,
           max(apelido) as apelido,
           max(razao_social) as razao
    from empresas
    where ativo
      and tipo in ('loja', 'holding')
      and regexp_replace(coalesce(bk_number, ''), '\\D', '', 'g') <> ''
    group by 1
    `,
  )

  const porBk = new Map()
  for (const e of empresasQ.rows) {
    const bk = digitos(e.bk)
    if (!bk) continue
    porBk.set(bk, {
      bk,
      loja: e.apelido || e.razao || bk,
      id_loja: null,
      dias_venda: 0,
      venda: 0,
      venda_projetada: 0,
      gasto: 0,
      gasto_platlog: 0,
      gasto_coca: 0,
      gasto_gimba: 0,
      gasto_uniforme: 0,
      cmv_atual: null,
      cmv_projetado: null,
      trafego: null,
      ticket_medio: null,
      rating_ifood: null,
      rating_99: null,
      visita_meridian: null,
      rev: null,
    })
  }

  for (const v of vendasQ.rows) {
    const bk = digitos(v.bk)
    if (!bk) continue
    const cur = porBk.get(bk) || {
      bk,
      loja: v.loja_nome || bk,
      id_loja: v.id_loja,
      dias_venda: 0,
      venda: 0,
      venda_projetada: 0,
      gasto: 0,
      gasto_platlog: 0,
      gasto_coca: 0,
      gasto_gimba: 0,
      gasto_uniforme: 0,
      cmv_atual: null,
      cmv_projetado: null,
      trafego: null,
      ticket_medio: null,
      rating_ifood: null,
      rating_99: null,
      visita_meridian: null,
      rev: null,
    }
    cur.id_loja = v.id_loja
    if (v.loja_nome) cur.loja = v.loja_nome
    cur.dias_venda = Number(v.dias_venda) || 0
    cur.venda = dinheiro(v.venda)
    porBk.set(bk, cur)
  }

  for (const g of gastosQ.rows) {
    const bk = digitos(g.bk)
    if (!bk) continue
    const cur = porBk.get(bk) || {
      bk,
      loja: g.apelido || bk,
      id_loja: null,
      dias_venda: 0,
      venda: 0,
      venda_projetada: 0,
      gasto: 0,
      gasto_platlog: 0,
      gasto_coca: 0,
      gasto_gimba: 0,
      gasto_uniforme: 0,
      cmv_atual: null,
      cmv_projetado: null,
      trafego: null,
      ticket_medio: null,
      rating_ifood: null,
      rating_99: null,
      visita_meridian: null,
      rev: null,
    }
    if (!cur.loja && g.apelido) cur.loja = g.apelido
    const valor = dinheiro(g.valor)
    cur.gasto = dinheiro(cur.gasto + valor)
    const tipo = classificarCmv(g.fornecedor)
    if (tipo === 'platlog') cur.gasto_platlog = dinheiro(cur.gasto_platlog + valor)
    else if (tipo === 'coca') cur.gasto_coca = dinheiro(cur.gasto_coca + valor)
    else if (tipo === 'gimba') cur.gasto_gimba = dinheiro(cur.gasto_gimba + valor)
    else if (tipo === 'uniforme') cur.gasto_uniforme = dinheiro(cur.gasto_uniforme + valor)
    porBk.set(bk, cur)
  }

  // Planilha: "Venda projetada 30 dias" = venda_atual * 30 / dias_com_venda
  const DIAS_PROJETO = 30
  const lojas = [...porBk.values()]
    .filter((r) => r.venda > 0 || r.gasto > 0)
    .map((r) => {
      const dias = r.dias_venda > 0 ? r.dias_venda : janelaDias
      const vendaProjetada =
        r.venda > 0 ? dinheiro((r.venda * DIAS_PROJETO) / Math.max(dias, 1)) : 0
      return {
        ...r,
        venda_projetada: vendaProjetada,
        cmv_atual: pct(r.gasto, r.venda),
        cmv_projetado: pct(r.gasto, vendaProjetada),
      }
    })
    .sort((a, b) => a.bk.localeCompare(b.bk, 'pt-BR', { numeric: true }))

  const totVenda = dinheiro(lojas.reduce((s, r) => s + r.venda, 0))
  const totProjetada = dinheiro(lojas.reduce((s, r) => s + r.venda_projetada, 0))
  const totGasto = dinheiro(lojas.reduce((s, r) => s + r.gasto, 0))

  return {
    de,
    ate,
    janela_dias: janelaDias,
    cmv_fornecedores: ['Platlog', 'Ambev/Coca-Cola (Brasal)', 'Gimba', 'Ideal Work (uniforme)'],
    lojas,
    total: {
      bk: 'Total',
      loja: 'Total',
      dias_venda: null,
      venda: totVenda,
      venda_projetada: totProjetada,
      gasto: totGasto,
      gasto_platlog: dinheiro(lojas.reduce((s, r) => s + r.gasto_platlog, 0)),
      gasto_coca: dinheiro(lojas.reduce((s, r) => s + r.gasto_coca, 0)),
      gasto_gimba: dinheiro(lojas.reduce((s, r) => s + r.gasto_gimba, 0)),
      gasto_uniforme: dinheiro(lojas.reduce((s, r) => s + r.gasto_uniforme, 0)),
      cmv_atual: pct(totGasto, totVenda),
      cmv_projetado: pct(totGasto, totProjetada),
      trafego: null,
      ticket_medio: null,
      rating_ifood: null,
      rating_99: null,
      visita_meridian: null,
      rev: null,
    },
  }
}
