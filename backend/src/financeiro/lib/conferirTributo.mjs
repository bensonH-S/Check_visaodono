/**
 * Cruzamento automático de despesas tributárias (IPTU, PIS, COFINS, ICMS…).
 * Valida linha digitável / código de barras de arrecadação (Febraban produto 8)
 * e PIX de guias (FGTS/Caixa); confere valor com a Agenda.
 *
 * Certificados A1 em /Certificados são usados pelo SEFAZ/DDA do financeiro;
 * o cruzamento da guia é local (DV + valor) — padrão oficial Febraban.
 */

import { classificarTributo } from './classificarTributo.mjs'
import { cnpjsDosCertificados } from './bbDda.mjs'

function soDigitos(v) {
  return String(v || '').replace(/\D/g, '')
}

function modulo10(bloco) {
  let soma = 0
  let peso = 2
  for (let i = bloco.length - 1; i >= 0; i -= 1) {
    let n = Number(bloco[i]) * peso
    if (n > 9) n = Math.floor(n / 10) + (n % 10)
    soma += n
    peso = peso === 2 ? 1 : 2
  }
  const resto = soma % 10
  return resto === 0 ? 0 : 10 - resto
}

function modulo11Arrecadacao(bloco) {
  let soma = 0
  let peso = 2
  for (let i = bloco.length - 1; i >= 0; i -= 1) {
    soma += Number(bloco[i]) * peso
    peso += 1
    if (peso > 9) peso = 2
  }
  const resto = soma % 11
  if (resto === 0 || resto === 1) return 0
  if (resto === 10) return 1
  return 11 - resto
}

function dvCampo(bloco, usaMod11) {
  return usaMod11 ? modulo11Arrecadacao(bloco) : modulo10(bloco)
}

/** Extrai 48 dígitos da linha (com ou sem espaços) ou 44 do código de barras. */
export function extrairCodigoTributo(texto) {
  const d = soDigitos(texto)
  if (d.length === 48) return d
  if (d.length === 44 && d[0] === '8') return d
  const m = String(texto || '').match(
    /(\d{11})\s*(\d)\s*(\d{11})\s*(\d)\s*(\d{11})\s*(\d)\s*(\d{11})\s*(\d)/,
  )
  if (m) return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}${m[7]}${m[8]}`
  return null
}

/** Linha 48 → código de barras 44 (remove DVs dos blocos). id 6/7 = mód.10; 8/9 = mód.11. */
export function linhaParaBarras(linha48) {
  const d = soDigitos(linha48)
  if (d.length === 44) return d
  if (d.length !== 48) return null
  const blocos = [
    d.slice(0, 11),
    d.slice(12, 23),
    d.slice(24, 35),
    d.slice(36, 47),
  ]
  const dvs = [d[11], d[23], d[35], d[47]]
  const idValor = blocos[0][2]
  const usaMod11 = idValor === '8' || idValor === '9'
  for (let i = 0; i < 4; i += 1) {
    if (String(dvCampo(blocos[i], usaMod11)) !== dvs[i]) return null
  }
  return blocos.join('')
}

/**
 * Decodifica boleto de arrecadação (produto 8).
 * Identificação valor efetivo: posições 5–15 do código de barras = valor em centavos.
 */
export function decodificarArrecadacao(codigo) {
  const bruto = soDigitos(codigo)
  const barras = bruto.length === 48 ? linhaParaBarras(bruto) : bruto
  if (!barras || barras.length !== 44) {
    return { ok: false, motivo: 'Código de barras/linha inválido (DV ou tamanho).' }
  }
  if (barras[0] !== '8') {
    return { ok: false, motivo: 'Não é guia de arrecadação (produto ≠ 8).' }
  }

  const idValor = barras[2]
  const valorCentavos = idValor >= '6' ? Number(barras.slice(4, 15)) : null
  const valor = valorCentavos != null && Number.isFinite(valorCentavos)
    ? Math.round(valorCentavos) / 100
    : null

  const semDv = barras.slice(0, 3) + barras.slice(4)
  const usaMod11 = idValor === '8' || idValor === '9'
  const dvGeral = String(dvCampo(semDv, usaMod11))
  const dvOk = dvGeral === barras[3]

  let vencimento = null
  const livre = barras.slice(19)
  const dataMatch = livre.match(/(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/)
  if (dataMatch) {
    vencimento = `${dataMatch[1]}-${dataMatch[2]}-${dataMatch[3]}`
  }

  return {
    ok: dvOk,
    motivo: dvOk ? null : 'Dígito verificador geral do código de barras inválido.',
    barras,
    valor,
    vencimento,
    produto: barras[0],
    segmento: barras[1],
    id_valor: idValor,
  }
}

/** Lê valor (tag 54) e CRC de PIX copia-e-cola. */
export function decodificarPix(texto) {
  const raw = String(texto || '').trim()
  if (!raw.startsWith('000201')) return null
  let i = 0
  let valor = null
  let nome = ''
  let crcOk = false
  while (i + 4 <= raw.length) {
    const tag = raw.slice(i, i + 2)
    const len = Number(raw.slice(i + 2, i + 4))
    if (!Number.isFinite(len) || len < 0) break
    const val = raw.slice(i + 4, i + 4 + len)
    i += 4 + len
    if (tag === '54') {
      const n = Number(val)
      if (Number.isFinite(n)) valor = n
    }
    if (tag === '59') nome = val
    if (tag === '63') {
      const corpo = raw.slice(0, i - 4 - len)
      // CRC-16/CCITT-FALSE sobre payload até antes do CRC
      let crc = 0xffff
      for (let k = 0; k < corpo.length + 4; k += 1) {
        // inclui "6304" no cálculo
        const ch = k < corpo.length ? corpo.charCodeAt(k) : '6304'.charCodeAt(k - corpo.length)
        crc ^= ch << 8
        for (let b = 0; b < 8; b += 1) {
          crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
        }
      }
      crcOk = crc.toString(16).toUpperCase().padStart(4, '0') === val.toUpperCase()
      break
    }
  }
  const oficial = /caixa|fgts|receita|fazenda|prefeitura/i.test(nome) || /pix-qrcode\.caixa\.gov\.br|bcb\.gov/i.test(raw)
  return { valor, nome, crcOk, oficial, raw: raw.slice(0, 80) }
}

function datasProximas(a, b, folgaDias = 5) {
  if (!a || !b) return false
  const ta = Date.parse(`${String(a).slice(0, 10)}T12:00:00Z`)
  const tb = Date.parse(`${String(b).slice(0, 10)}T12:00:00Z`)
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return false
  return Math.abs(ta - tb) <= folgaDias * 86400000
}

function valoresIguais(a, b, tol = 0.05) {
  const na = Number(a)
  const nb = Number(b)
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false
  return Math.abs(na - nb) <= tol
}

/**
 * Confere uma despesa tributária contra o código de pagamento.
 * @returns {{ status: 'conferido'|'pendente', detalhe: object }}
 */
export function conferirDespesaTributo(despesa) {
  const tipo = despesa.tributo_tipo || classificarTributo(despesa)
  if (!tipo) {
    return { status: null, detalhe: { motivo: 'Não é despesa tributária.' } }
  }

  const certs = (() => {
    try { return cnpjsDosCertificados() } catch { return [] }
  })()
  const cnpjLoja = soDigitos(despesa.cnpj_empresa || despesa.cnpj || '')
  const temCertLoja = cnpjLoja.length === 14 && certs.includes(cnpjLoja)

  const bruto = [
    despesa.dados_pagamento,
    despesa.pagamento,
    despesa.documento_ref,
    despesa.descricao,
  ].filter(Boolean).join(' ')

  const checks = {
    tributo_tipo: tipo,
    tem_codigo: false,
    dv_linha: false,
    valor_bate: false,
    vencimento_bate: false,
    tem_certificado_loja: temCertLoja,
    fonte: null,
  }

  // 1) PIX (FGTS / guias Caixa)
  const pix = decodificarPix(bruto)
  if (pix) {
    checks.fonte = 'pix'
    checks.tem_codigo = true
    checks.dv_linha = pix.crcOk || pix.oficial
    if (pix.valor != null && despesa.valor != null) {
      checks.valor_bate = valoresIguais(pix.valor, despesa.valor)
    } else if (pix.oficial && (tipo === 'fgts' || /GFD\|/i.test(String(despesa.documento_ref || '')))) {
      // PIX Caixa FGTS sem tag 54 (cobv) — documento GFD oficial + PIX gov = confirmado
      checks.valor_bate = true
      checks.fonte = 'pix_fgts_caixa'
    }
    if (checks.dv_linha && checks.valor_bate) {
      return {
        status: 'conferido',
        detalhe: {
          ...checks,
          motivo: pix.valor != null
            ? 'PIX oficial válido e valor bate com a Agenda.'
            : 'PIX FGTS/Caixa oficial vinculado à guia GFD.',
          pix_nome: pix.nome,
        },
      }
    }
    return {
      status: 'pendente',
      detalhe: {
        ...checks,
        motivo: !checks.valor_bate && pix.valor != null
          ? `Valor PIX R$ ${pix.valor} ≠ Agenda R$ ${despesa.valor}`
          : 'PIX incompleto para cruzar.',
      },
    }
  }

  const codigo = extrairCodigoTributo(bruto)
  checks.tem_codigo = !!codigo

  if (!codigo) {
    return {
      status: 'pendente',
      detalhe: {
        ...checks,
        fonte: 'sem_codigo',
        motivo: 'Sem código de barras/linha digitável/PIX na despesa.',
        portal: 'https://cav.receita.fazenda.gov.br/autenticacao/login',
      },
    }
  }

  const dec = decodificarArrecadacao(codigo)
  checks.fonte = 'linha_digitavel_arrecadacao'
  checks.dv_linha = !!dec.ok
  checks.barras = dec.barras || null
  checks.valor_codigo = dec.valor
  checks.vencimento_codigo = dec.vencimento

  if (!dec.ok) {
    return {
      status: 'pendente',
      detalhe: { ...checks, motivo: dec.motivo || 'Código inválido.' },
    }
  }

  if (dec.valor != null && despesa.valor != null) {
    checks.valor_bate = valoresIguais(dec.valor, despesa.valor)
  }
  if (dec.vencimento && despesa.vencimento) {
    checks.vencimento_bate = datasProximas(dec.vencimento, despesa.vencimento)
  }

  const valorOk = dec.valor == null || checks.valor_bate
  const vencOk = !dec.vencimento || checks.vencimento_bate

  if (checks.dv_linha && valorOk && vencOk) {
    return {
      status: 'conferido',
      detalhe: {
        ...checks,
        motivo: 'Linha digitável válida (Febraban) e dados batem com a Agenda.',
        certificados_disponiveis: certs.length,
      },
    }
  }

  const falhas = []
  if (!valorOk) falhas.push(`valor guia R$ ${dec.valor} ≠ Agenda R$ ${despesa.valor}`)
  if (!vencOk) falhas.push(`vencimento guia ${dec.vencimento} ≠ Agenda ${despesa.vencimento}`)
  return {
    status: 'pendente',
    detalhe: {
      ...checks,
      motivo: falhas.join('; ') || 'Divergência no cruzamento.',
    },
  }
}

/**
 * Classifica + confere em lote no banco finance.
 */
export async function sincronizarConferenciaTributos(financePool) {
  await financePool.query(`
    alter table despesas add column if not exists conferencia_status text;
    alter table despesas add column if not exists tributo_tipo text;
    alter table despesas add column if not exists conferencia_detalhe text;
  `).catch(() => {})

  const { rows } = await financePool.query(`
    select d.id::text as id, d.descricao, d.documento_ref, d.forma_pagamento, d.fonte,
           d.freecontrol_tipo, d.tributo_tipo, d.conferencia_status,
           d.dados_pagamento, d.valor::float8 as valor,
           to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           f.nome as fornecedor, p.nome as plano, eo.cnpj as cnpj_empresa
      from despesas d
      join empresas eo on eo.id = d.empresa_origem_id
      left join fornecedores f on f.id = d.fornecedor_id
      left join plano_contas p on p.id = d.plano_conta_id
     where d.status <> 'cancelada'
       and coalesce(d.fonte, '') <> 'freecontrol'
       and (
         d.tributo_tipo is not null
         or d.forma_pagamento = 'guia'
         or d.descricao ~* '(iptu|pis|cofins|icms|difal|iss|darf|fgts|gfd|inss|gps|irrf|das\\b|reten)'
         or coalesce(f.nome, '') ~* '(iptu|pis|cofins|fazenda|receita|prefeitura)'
         or coalesce(p.nome, '') ~* '(iptu|pis|cofins|icms|tribut)'
         or coalesce(d.dados_pagamento, '') ~ '^[0-9 ]{40,}|^000201'
       )
     limit 1200
  `)

  let classificados = 0
  let conferidos = 0
  let pendentes = 0
  let atualizados = 0

  for (const row of rows) {
    const tipo = row.tributo_tipo || classificarTributo(row)
    if (!tipo) continue
    classificados += 1

    const r = conferirDespesaTributo({ ...row, tributo_tipo: tipo })
    const status = r.status || 'pendente'

    // Não rebaixa conferido manual se o automático falhar sem código novo
    if (row.conferencia_status === 'conferido' && status === 'pendente' && !r.detalhe?.tem_codigo) {
      conferidos += 1
      continue
    }

    if (status === 'conferido') conferidos += 1
    else pendentes += 1

    if (
      row.tributo_tipo !== tipo
      || row.conferencia_status !== status
    ) {
      atualizados += 1
      await financePool.query(
        `update despesas set
           tributo_tipo = $2,
           conferencia_status = $3,
           conferencia_detalhe = $4
         where id = $1::uuid`,
        [row.id, tipo, status, JSON.stringify(r.detalhe)],
      )
    } else {
      await financePool.query(
        `update despesas set conferencia_detalhe = $2 where id = $1::uuid`,
        [row.id, JSON.stringify(r.detalhe)],
      )
    }
  }

  return {
    analisadas: rows.length,
    classificados,
    conferidos,
    pendentes,
    atualizados,
    certificados: cnpjsDosCertificados().length,
  }
}
