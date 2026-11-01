/**
 * C_O_ — mapa mensal de custos da loja (espelha a aba C_O_ da planilha de caixa).
 * Fonte: despesas do mês por vencimento. Pago = paga/conciliada.
 * Em aberto = título do mês ainda não pago, fora do inbox (rascunho/DDA/NF-e solta).
 */

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Palavra inteira. "GAS" não pode pegar "PRAGAS", nem "PIS" pegar "PISO". */
function tem(t, ...palavras) {
  const toks = t.split(' ').filter(Boolean)
  return palavras.some((p) => {
    const n = norm(p)
    if (!n) return false
    if (n.includes(' ')) return ` ${t} `.includes(` ${n} `)
    return toks.some((tok) => tok === n || (n.length >= 5 && tok.startsWith(n)))
  })
}

/** Aba ONLINE da planilha: gente, vales, rescisão. Não entra no C_O_. */
export function ehOnlinePlanilha({ descricao, fornecedor, plano }) {
  const t = norm(`${descricao || ''} ${fornecedor || ''} ${plano || ''}`)
  return tem(t, 'SALARIO', 'MENSALISTA', 'MAO DE OBRA', 'FOLHA', 'FERIAS', 'RESCISAO', '13 SALARIO', 'VALE', 'VALES', 'PSG', 'BENEFICIO')
}

export function grupoOnlinePlanilha(item) {
  const t = norm(`${item.descricao || ''} ${item.fornecedor || ''} ${item.plano || ''}`)
  if (tem(t, 'RESCISAO')) return 'Rescisões'
  if (tem(t, 'FERIAS')) return 'Férias'
  if (tem(t, 'VALE', 'VALES', 'PSG')) return 'Vales'
  if (tem(t, 'BENEFICIO')) return 'Benefícios'
  if (tem(t, 'MAO DE OBRA')) return 'Mão de obra'
  return 'Salários'
}

/** Aba DESPESAS da planilha: saída do caixa, em dois blocos. */
export function grupoDespesaCaixa({ descricao, fornecedor }) {
  const t = norm(`${descricao || ''} ${fornecedor || ''}`)
  if (tem(t, 'VALE', 'PSG', 'META', 'ATESTADO', 'LABOR', 'FREE')) return 'Labor'
  return 'Manutenções e despesas diversas'
}

/** Agrupa no mesmo espírito da aba C_O_. Online e caixa ficam de fora. */
export function classificarCustoCo({ descricao, fornecedor, plano }) {
  const t = norm(`${descricao || ''} ${fornecedor || ''} ${plano || ''}`)

  if (ehOnlinePlanilha({ descricao, fornecedor, plano })) return 'online'

  if (tem(t, 'FGTS', 'GPS', 'DARF', 'DARE', 'ICMS', 'PIS', 'COFINS', 'SEFAZ', 'INSS', 'IMPOSTO', 'TRIBUT', 'PARCELAMENTO', 'SIMPLES NACIONAL')) {
    return 'impostos'
  }
  if (tem(t, 'SUPERGAS', 'GAS', 'CONSIGAZ', 'EQUATORIAL', 'ENEL', 'ENERGIA', 'AGUA', 'DEMAE', 'CAESB', 'SANEAMENTO')) {
    return 'utilities'
  }
  if (tem(t, 'TARIFA', 'TAXA DE CARTAO', 'TAXA ADMINISTRATIVA DE CARTOES', 'TAXA DE ANTECIPACAO', 'AJUSTES A DEBITO DE CARTAO')) {
    return 'tarifas'
  }
  if (tem(t, 'GIMBA')) return 'gimba'
  if (tem(t, 'BRASAL', 'AMBEV')) return 'brasal'
  if (tem(t, 'BRINDE', 'COTLOG')) return 'brindes'
  if (tem(t, 'COLDMIX', 'CONSERTO', 'MANUTEN', 'REFRIGERACAO', 'COIFA', 'DESENTUP', 'MONTREAL', 'FACILIT')) {
    return 'manutencao'
  }
  if (tem(t, 'PLATLOG', 'ESUPRI', 'SMALLWARE')) return 'cmp'
  if (
    tem(
      t,
      'ALUGUEL',
      'SKYTEF',
      'E DEPLOY',
      'E-DEPLOY',
      'DEDETIZ',
      'PRAGA',
      'EVOLUCAO',
      'HITTELECON',
      'CONCIL',
      'ROYALT',
      'ZAMP',
      'WAY COM',
      'SYBRA',
      'PROTEGE',
      'VIDEOSOFT',
      'KING ASSESSORIA',
      'INTERNET',
      'TELEFONE',
      'TELECOM',
      'CONDOMINIO',
      'IPTU',
      'SEGURO',
      'CONTABIL',
    )
  ) {
    return 'fixos'
  }
  return 'outros'
}

/** Nome da linha na folha — junta IPTU + IPTU garagem, salários, royalties. */
export function rotuloContaCo({ descricao, fornecedor, plano }) {
  const t = norm(`${descricao || ''} ${fornecedor || ''} ${plano || ''}`)
  if (tem(t, 'SALARIO', 'MENSALISTA', 'MAO DE OBRA', 'FOLHA', 'FERIAS', 'RESCISAO')) return 'Folha'
  if (tem(t, 'ZAMP', 'ROYALT')) return 'Royalties'
  if (tem(t, 'ALUGUEL')) return 'Aluguel'
  if (tem(t, 'CONDOMINIO')) return 'Condomínio'
  if (tem(t, 'IPTU')) return 'IPTU'
  if (tem(t, 'PRAGA', 'DEDETIZ')) return 'Controle de pragas'
  if (tem(t, 'FGTS')) return 'FGTS'
  if (tem(t, 'INSS', 'GPS')) return 'INSS'
  if (tem(t, 'PARCELAMENTO')) return 'Parcelamento'
  if (tem(t, 'PIS', 'COFINS', 'ICMS', 'DARF', 'DARE')) return 'PIS / COFINS / ICMS'
  if (tem(t, 'ENERGIA', 'EQUATORIAL', 'ENEL')) return 'Energia'
  if (tem(t, 'GAS', 'CONSIGAZ', 'SUPERGAS')) return 'Gás'
  if (tem(t, 'AGUA', 'DEMAE', 'CAESB', 'SANEAMENTO')) return 'Água'
  if (tem(t, 'PLATLOG')) return 'Platlog'
  if (tem(t, 'GIMBA')) return 'Gimba'
  if (tem(t, 'BRASAL', 'AMBEV')) return 'Brasal'
  if (tem(t, 'TELECOM', 'INTERNET', 'TELEFONE')) return 'Telefone / internet'
  if (tem(t, 'CONTABIL', 'EVOLUCAO')) return 'Contabilidade'
  if (tem(t, 'PROTEGE')) return 'Coleta'
  const planoLimpo = String(plano || '').trim()
  if (planoLimpo) return planoLimpo
  const forn = String(fornecedor || '').trim()
  if (forn) return forn
  return String(descricao || 'Sem nome').trim()
}

export const BLOCOS_CO = [
  { id: 'fixos', titulo: 'Custos fixos', cor: '#1B6EF3' },
  { id: 'impostos', titulo: 'Impostos', cor: '#B45309' },
  { id: 'utilities', titulo: 'Utilities', cor: '#6D28D9' },
  { id: 'tarifas', titulo: 'Tarifas de cartão', cor: '#BE123C' },
  { id: 'cmp', titulo: 'Platlog', cor: '#047857' },
  { id: 'gimba', titulo: 'Gimba', cor: '#0F766E' },
  { id: 'brasal', titulo: 'Brasal', cor: '#A16207' },
  { id: 'brindes', titulo: 'Brindes', cor: '#9D174D' },
  { id: 'manutencao', titulo: 'Manutenção', cor: '#475569' },
  { id: 'outros', titulo: 'Outros', cor: '#64748B' },
]

function limitesMes(mes) {
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    const err = new Error('Informe o mês no formato AAAA-MM.')
    err.status = 400
    throw err
  }
  const [ano, m] = mes.split('-').map(Number)
  const fim = new Date(ano, m, 0)
  const ate = `${mes}-${String(fim.getDate()).padStart(2, '0')}`
  return { de: `${mes}-01`, ate }
}

function money(n) {
  return Math.round(Number(n || 0) * 100) / 100
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ mes: string, empresaId: string }} opts
 */
export async function montarCustosCo(pool, { mes, empresaId }) {
  if (!empresaId) {
    const err = new Error('Escolha a loja.')
    err.status = 400
    throw err
  }
  const { de, ate } = limitesMes(mes)

  const empresa = await pool.query(
    `select id::text, apelido, razao_social, bk_number
     from empresas where id = $1::uuid`,
    [empresaId],
  )
  if (!empresa.rows[0]) {
    const err = new Error('Loja não encontrada.')
    err.status = 404
    throw err
  }

  const { rows: despesas } = await pool.query(
    `
    select d.id::text,
           left(coalesce(nullif(btrim(d.descricao), ''), nullif(btrim(f.nome), ''), '?'), 120) as descricao,
           coalesce(nullif(btrim(f.nome), ''), '') as fornecedor,
           coalesce(nullif(btrim(p.nome), ''), '') as plano,
           d.valor::float8 as valor,
           d.status,
           d.fonte,
           to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           coalesce(d.numero_nf, '') as numero_nf
    from despesas d
    left join fornecedores f on f.id = d.fornecedor_id
    left join plano_contas p on p.id = d.plano_conta_id
    where d.empresa_origem_id = $1::uuid
      and d.vencimento between $2::date and $3::date
      and d.status <> 'cancelada'
      and (
        d.status in ('paga', 'conciliada')
        or (
          d.status not in ('paga', 'conciliada', 'rascunho', 'classificada', 'bloqueada_duplicata')
          and (
            d.status in ('pronta', 'autorizada', 'enviada')
            or d.fonte not in ('dda', 'nfe')
          )
          and not (d.fonte = 'manual' and coalesce(d.pendente_inbox, false))
        )
      )
    order by d.vencimento, d.valor desc
    `,
    [empresaId, de, ate],
  )

  const blocosMap = Object.fromEntries(BLOCOS_CO.map((b) => [b.id, { ...b, total: 0, qtd: 0, itens: [], abertos: [] }]))
  const onlineItens = []
  const onlineAbertos = []
  for (const d of despesas) {
    const item = {
      id: d.id,
      descricao: d.descricao,
      fornecedor: d.fornecedor,
      plano: d.plano,
      valor: money(d.valor),
      vencimento: d.vencimento,
      status: d.status,
      fonte: d.fonte,
      numero_nf: d.numero_nf,
    }
    const grupo = classificarCustoCo(d)
    const pago = d.status === 'paga' || d.status === 'conciliada'
    if (grupo === 'online') {
      if (pago) onlineItens.push(item)
      else onlineAbertos.push(item)
      continue
    }
    const bloco = blocosMap[grupo] || blocosMap.outros
    if (pago) {
      bloco.itens.push(item)
      bloco.total = money(bloco.total + Number(d.valor))
      bloco.qtd += 1
    } else {
      bloco.abertos.push(item)
    }
  }

  const { rows: caixaRows } = await pool.query(
    `
    select l.id::text,
           left(coalesce(nullif(btrim(l.descricao), ''), nullif(btrim(l.fornecedor_nome), ''), '?'), 120) as descricao,
           coalesce(nullif(btrim(l.fornecedor_nome), ''), '') as fornecedor,
           l.valor::float8 as valor,
           to_char(f.data, 'YYYY-MM-DD') as vencimento
    from fechamento_caixa_lancamentos l
    join fechamento_caixa f on f.id = l.fechamento_id
    where f.empresa_id = $1::uuid
      and l.tipo = 'despesa'
      and f.data between $2::date and $3::date
    order by f.data, l.valor desc
    `,
    [empresaId, de, ate],
  )
  const caixaItens = caixaRows.map((d) => ({
    id: d.id,
    descricao: d.descricao,
    fornecedor: d.fornecedor,
    plano: '',
    valor: money(d.valor),
    vencimento: d.vencimento,
    status: 'caixa',
    fonte: 'despesas',
    numero_nf: '',
  }))

  const vendasCx = await pool.query(
    `
    select
      coalesce(sum(coalesce(dinheiro,0)+coalesce(pix,0)+coalesce(debito,0)+coalesce(credito,0)+coalesce(cart_digital,0)),0)::float8 as inside,
      coalesce(sum(coalesce(ifood,0)+coalesce(azul,0)+coalesce(rappi,0)+coalesce(food99,0)),0)::float8 as delivery,
      coalesce(sum(coalesce(despesas_caixa,0)),0)::float8 as despesas_caixa
    from fechamento_caixa
    where empresa_id = $1::uuid
      and data between $2::date and $3::date
    `,
    [empresaId, de, ate],
  )

  const vendasBk = await pool.query(
    `
    select coalesce(sum(venda_liquida),0)::float8 as venda_liquida,
           coalesce(sum(venda_bruta),0)::float8 as venda_bruta
    from vendas_bk
    where empresa_id = $1::uuid
      and data_venda between $2::date and $3::date
    `,
    [empresaId, de, ate],
  )

  const inside = money(vendasCx.rows[0]?.inside)
  const delivery = money(vendasCx.rows[0]?.delivery)
  const vendaCaixa = money(inside + delivery)
  const vendaBk = money(vendasBk.rows[0]?.venda_liquida)
  const vendaBase = vendaCaixa > 0 ? vendaCaixa : vendaBk

  const despesaTotal = money(Object.values(blocosMap).reduce((s, b) => s + b.total, 0))
  const abertoTotal = money(Object.values(blocosMap).reduce((s, b) => s + b.abertos.reduce((a, item) => a + item.valor, 0), 0))
  const onlineTotal = money(onlineItens.reduce((s, i) => s + i.valor, 0))
  const caixaTotal = money(caixaItens.reduce((s, i) => s + i.valor, 0))
  const cmpTotal = money(blocosMap.cmp.total + blocosMap.gimba.total + blocosMap.brasal.total)
  const pct = (parte) => (vendaBase > 0 ? Math.round((parte / vendaBase) * 10000) / 100 : null)

  function agruparLinhas(itens) {
    const porRotulo = new Map()
    for (const item of itens) {
      const rotulo = rotuloContaCo(item)
      const atual = porRotulo.get(rotulo) || { rotulo, valor: 0, qtd: 0, itens: [] }
      atual.valor = money(atual.valor + item.valor)
      atual.qtd += 1
      atual.itens.push(item)
      porRotulo.set(rotulo, atual)
    }
    return [...porRotulo.values()]
      .map((linha) => ({ ...linha, pct_venda: pct(linha.valor) }))
      .sort((a, b2) => b2.valor - a.valor)
  }

  const blocos = BLOCOS_CO.map((meta) => {
    const b = blocosMap[meta.id]
    const aberto = money(b.abertos.reduce((s, item) => s + item.valor, 0))
    return {
      id: b.id,
      titulo: b.titulo,
      cor: b.cor,
      total: b.total,
      qtd: b.qtd,
      pct_venda: pct(b.total),
      aberto,
      qtd_aberto: b.abertos.length,
      aberto_pct: pct(aberto),
      linhas: agruparLinhas(b.itens),
      linhas_abertas: agruparLinhas(b.abertos),
      itens: b.itens,
      itens_abertos: b.abertos,
    }
  }).filter((b) => b.qtd > 0 || b.qtd_aberto > 0)

  function montarOrigem(titulo, itens, grupoDe) {
    const mapa = new Map()
    for (const item of itens) {
      const id = grupoDe(item)
      const atual = mapa.get(id) || { id, titulo: id, total: 0, qtd: 0, itens: [] }
      atual.itens.push(item)
      atual.total = money(atual.total + item.valor)
      atual.qtd += 1
      mapa.set(id, atual)
    }
    const grupos = [...mapa.values()].map((g) => {
      const porNome = new Map()
      for (const item of g.itens) {
        const rotulo = (item.fornecedor || item.descricao || 'Sem nome').trim()
        const atual = porNome.get(rotulo) || { rotulo, valor: 0, qtd: 0, itens: [] }
        atual.valor = money(atual.valor + item.valor)
        atual.qtd += 1
        atual.itens.push(item)
        porNome.set(rotulo, atual)
      }
      return {
        ...g,
        linhas: [...porNome.values()]
          .map((linha) => ({ ...linha, pct_venda: null }))
          .sort((a, b2) => b2.valor - a.valor),
      }
    })
    return {
      titulo,
      total: money(itens.reduce((s, i) => s + i.valor, 0)),
      qtd: itens.length,
      grupos,
    }
  }

  return {
    mes,
    de,
    ate,
    empresa: empresa.rows[0],
    blocos,
    online: montarOrigem('Online', onlineItens.concat(onlineAbertos), grupoOnlinePlanilha),
    despesas: montarOrigem('Despesas', caixaItens, grupoDespesaCaixa),
    resumo: {
      despesa_total: despesaTotal,
      aberto_total: abertoTotal,
      aberto_pct: pct(abertoTotal),
      cmp_total: cmpTotal,
      cmp_pct: pct(cmpTotal),
      despesa_pct: pct(despesaTotal),
      venda_inside: inside,
      venda_delivery: delivery,
      venda_total: vendaBase,
      venda_fonte: vendaCaixa > 0 ? 'caixa' : vendaBk > 0 ? 'bk' : null,
      inside_pct: pct(inside),
      delivery_pct: pct(delivery),
      despesas_caixa: caixaTotal || money(vendasCx.rows[0]?.despesas_caixa),
      online_total: onlineTotal,
      qtd_titulos: blocos.reduce((s, b) => s + b.qtd, 0),
    },
  }
}
