import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../db/017_conciliacao_extrato.sql')
const FOLGA_DIAS = 7
const FOLGA_AUTO = 15

function texto(valor) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim()
}

function digitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

function documentoPessoa(valor) {
  const doc = digitos(valor)
  if (doc.length >= 12 && doc.length <= 14) return doc.padStart(14, '0')
  if (doc.length === 11) return doc
  return ''
}

/** Raiz do CNPJ (8 dígitos) — mesma empresa, filiais diferentes. */
function raizCnpj(valor) {
  const doc = documentoPessoa(valor)
  return doc.length === 14 ? doc.slice(0, 8) : ''
}

function mesmoCnpjEmpresa(a, b) {
  const da = documentoPessoa(a)
  const db = documentoPessoa(b)
  if (!da || !db) return false
  if (da === db) return true
  if (da.length === 14 && db.length === 14) return da.slice(0, 8) === db.slice(0, 8)
  return false
}

/** CNPJ do lançamento: campo dedicado, documento_ref ou texto do histórico (MEMO do OFX). */
function documentosDoLancamento(lancamento) {
  const docs = [
    ...cnpjsNoTexto(lancamento?.historico),
    ...cnpjsNoTexto(lancamento?.documento_ref),
    documentoPessoa(lancamento?.documento_ref),
  ].filter((d) => d.length === 14)
  return [...new Set(docs)]
}

function centavos(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}

function dinheiro(valor) {
  return Math.round(Number(valor) * 100) / 100
}

function diferencaDias(a, b) {
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 99
  return Math.round((da - db) / 86400000)
}

function dataOfx(valor) {
  const s = digitos(valor).slice(0, 8)
  if (s.length !== 8) return null
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

function dataBrParaIso(valor) {
  const t = texto(valor)
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    const dia = m[1].padStart(2, '0')
    const mes = m[2].padStart(2, '0')
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${ano}-${mes}-${dia}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return dataOfx(t)
}

function valorBr(valor) {
  const t = texto(valor).replace(/[R$\s]/g, '')
  if (!t) return null
  if (t.includes(',') && t.includes('.')) {
    return Number(t.replace(/\./g, '').replace(',', '.'))
  }
  if (t.includes(',')) return Number(t.replace(',', '.'))
  return Number(t)
}

function hashArquivo(buffer) {
  return createHash('sha1').update(buffer).digest('hex')
}

function decodeArquivo(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
  const utf8 = raw.toString('utf8')
  if (!utf8.includes('\uFFFD') && !/charset=ISO-8859|WINDOWS-1252/i.test(utf8)) return utf8
  return raw.toString('latin1')
}

function campoOfx(bloco, nome) {
  const re = new RegExp(`<${nome}>([^\\n<]+)`, 'i')
  const m = bloco.match(re)
  return m ? texto(m[1]) : ''
}

const BANCO_POR_CODIGO = { 341: 'itau', 1: 'banco_do_brasil' }

function contaAlfa(valor) {
  return String(valor ?? '').toUpperCase().replace(/[^0-9X]/g, '').replace(/^0+(?=.)/, '')
}

/** Banco, agência e conta declarados no cabeçalho do OFX. */
export function contaDoOfx(buffer) {
  const textoArquivo = decodeArquivo(buffer)
  const codigo = Number(digitos(campoOfx(textoArquivo, 'BANKID')))
  return {
    banco: BANCO_POR_CODIGO[codigo] || null,
    agencia: campoOfx(textoArquivo, 'BRANCHID'),
    conta: campoOfx(textoArquivo, 'ACCTID'),
  }
}

/** Itaú e BB exportam agência e conta nas linhas antes do cabeçalho do CSV. */
export function contaDoCsv(buffer) {
  return contaDoTexto(decodeArquivo(buffer).split(/\r?\n/).slice(0, 20).join('\n'))
}

/** Contas cadastradas que batem com o banco/agência/conta lidos do arquivo. */
export function acharConta(contas, info) {
  const lida = contaAlfa(info?.conta)
  if (!lida) return []
  const agLida = digitos(info?.agencia)
  return contas.filter((c) => {
    if (info.banco && c.banco && info.banco !== c.banco) return false
    const numero = contaAlfa(c.numero)
    if (!numero) return false
    const chaves = new Set([numero, contaAlfa(`${c.numero}${c.digito || ''}`)])
    const agConta = digitos(c.agencia)
    const agSemDv = agConta.length > 4 ? agConta.slice(0, 4) : agConta
    const variantes = new Set([lida])
    for (const ag of [agConta, agSemDv]) {
      if (ag && lida.startsWith(ag) && lida.length > ag.length) variantes.add(contaAlfa(lida.slice(ag.length)))
    }
    if (![...variantes].some((v) => chaves.has(v))) return false
    if (agLida && agConta && ![agConta, agSemDv].includes(agLida) && !agLida.startsWith(agSemDv)) return false
    return true
  })
}

/** Resolve a conta sozinho: número do arquivo, CNPJ da empresa ou loja do contexto. */
export function resolverConta(contas, info, { empresaId } = {}) {
  const porNumero = acharConta(contas, info)
  if (porNumero.length === 1) return porNumero
  if (porNumero.length > 1) return porNumero

  const cnpj = documentoPessoa(info?.cnpj)
  if (cnpj) {
    const porCnpj = contas.filter((c) => documentoPessoa(c.cnpj) === cnpj)
    if (porCnpj.length === 1) return porCnpj
    if (info?.banco) {
      const mesmoBanco = porCnpj.filter((c) => c.banco === info.banco)
      if (mesmoBanco.length === 1) return mesmoBanco
    }
    if (porCnpj.length > 1) return porCnpj
  }

  const empresa = String(empresaId || info?.empresa_id || '').trim()
  if (empresa) {
    const daLoja = contas.filter((c) => c.empresa_id === empresa)
    if (daLoja.length === 1) return daLoja
    if (info?.banco) {
      const mesmoBanco = daLoja.filter((c) => c.banco === info.banco)
      if (mesmoBanco.length === 1) return mesmoBanco
    }
    if (daLoja.length > 1) return daLoja
  }

  const apelido = normalizarNome(info?.apelido || '')
  if (apelido) {
    const porNome = contas.filter((c) => {
      const a = normalizarNome(c.apelido)
      return a === apelido || a.startsWith(`${apelido} `) || apelido.startsWith(a)
    })
    if (porNome.length === 1) return porNome
    if (info?.banco) {
      const mesmoBanco = porNome.filter((c) => c.banco === info.banco)
      if (mesmoBanco.length === 1) return mesmoBanco
    }
  }

  return []
}

/** Extrai banco/agência/conta/CNPJ de qualquer texto de cabeçalho. */
export function contaDoTexto(topo) {
  const textoTopo = String(topo || '')
  const agencia = textoTopo.match(/ag[eê]ncia\s*(?:\/\s*conta)?\D{0,8}(\d{3,5}(?:-\w)?)/i)?.[1]
    || textoTopo.match(/\bag\.?\s*[:=]?\s*(\d{3,5}(?:-\w)?)/i)?.[1]
    || ''
  const conta = textoTopo.match(/conta(?:\s+corrente)?\D{0,10}(\d[\d.\s]*-?[\dX])/i)?.[1]
    || textoTopo.match(/\bcc\.?\s*[:=]?\s*(\d[\d.\s]*-?[\dX])/i)?.[1]
    || ''
  const cnpj = documentoPessoa(textoTopo.match(/cnpj\D{0,8}([\d./-]{14,18})/i)?.[1] || '')
  let banco = null
  if (/ita[uú]/i.test(textoTopo) || /\b341\b/.test(textoTopo)) banco = 'itau'
  else if (/banco do brasil|\bbb\b|\b001\b/i.test(textoTopo)) banco = 'banco_do_brasil'
  return {
    banco,
    agencia: texto(agencia),
    conta: texto(conta).replace(/\s+/g, ''),
    cnpj,
  }
}

/** Lê OFX 1.x (SGML) dos bancos brasileiros. */
export function lerOfx(buffer) {
  const textoArquivo = decodeArquivo(buffer)
  if (!/<OFX|<STMTTRN/i.test(textoArquivo)) {
    throw new Error('Arquivo OFX inválido.')
  }
  const blocos = textoArquivo.split(/<STMTTRN>/i).slice(1)
  const linhas = []
  for (const pedaco of blocos) {
    const bloco = pedaco.split(/<\/STMTTRN>/i)[0] || pedaco
    const valorRaw = campoOfx(bloco, 'TRNAMT')
    const valorNum = Number(String(valorRaw).replace(',', '.'))
    if (!Number.isFinite(valorNum) || valorNum === 0) continue
    const data = dataOfx(campoOfx(bloco, 'DTPOSTED')) || dataOfx(campoOfx(bloco, 'DTUSER'))
    if (!data) continue
    const fitid = campoOfx(bloco, 'FITID') || `${data}|${valorNum}|${campoOfx(bloco, 'MEMO')}`
    const tipo = campoOfx(bloco, 'TRNTYPE').toUpperCase()
    const operacao = valorNum < 0 || /DEBIT|PAYMENT|DEPBIT/i.test(tipo) ? 'D' : 'C'
    const historico = campoOfx(bloco, 'MEMO') || campoOfx(bloco, 'NAME') || campoOfx(bloco, 'CHECKNUM') || tipo
    // OFX brasileiro traz o CNPJ no MEMO; CHECKNUM costuma ser só o FITID do banco.
    const cnpjMemo = cnpjsNoTexto(historico)[0] || ''
    const checknum = digitos(campoOfx(bloco, 'CHECKNUM')).slice(0, 48)
    linhas.push({
      evento_id: fitid.slice(0, 120),
      operacao,
      estorno: /REV|ESTORNO/i.test(tipo) || /ESTORNO/i.test(historico),
      data_contabil: data,
      data_evento: data,
      valor: dinheiro(Math.abs(valorNum)),
      historico: historico.slice(0, 240),
      documento_ref: cnpjMemo || checknum || null,
    })
  }
  if (!linhas.length) throw new Error('Nenhum lançamento no OFX.')
  return linhas
}

/** CSV simples: data;valor;histórico  ou data;débito;crédito;histórico */
export function lerCsvExtrato(buffer) {
  const textoArquivo = decodeArquivo(buffer)
  const todas = textoArquivo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const inicio = Math.max(0, todas.findIndex((l) => /^"?data\b/i.test(l)))
  const linhasTxt = todas.slice(inicio)
  if (linhasTxt.length < 2) throw new Error('CSV sem lançamentos.')
  const sep = linhasTxt[0].includes(';') ? ';' : ','
  const cab = linhasTxt[0].toLowerCase().split(sep).map((c) => c.replace(/"/g, '').trim())
  const idxData = cab.findIndex((c) => /data|date|dt/i.test(c))
  const idxDebito = cab.findIndex((c) => /d[eé]bito|saida|saída|debit/i.test(c))
  const idxCredito = cab.findIndex((c) => /cr[eé]dito|entrada|credit/i.test(c))
  const idxValor = cab.findIndex((c) => /valor|amount|vlr/i.test(c) && !/saldo/i.test(c))
  const idxHist = cab.findIndex((c) => /hist|memo|descri|lan[cç]|nome|texto/i.test(c))
  if (idxData < 0) throw new Error('CSV precisa da coluna de data.')

  const linhas = []
  for (const linha of linhasTxt.slice(1)) {
    const cols = linha.split(sep).map((c) => c.replace(/^"|"$/g, '').trim())
    const data = dataBrParaIso(cols[idxData])
    if (!data) continue
    let valor = null
    let operacao = 'D'
    if (idxDebito >= 0 || idxCredito >= 0) {
      const deb = idxDebito >= 0 ? valorBr(cols[idxDebito]) : null
      const cred = idxCredito >= 0 ? valorBr(cols[idxCredito]) : null
      if (deb && deb > 0) { valor = deb; operacao = 'D' }
      else if (cred && cred > 0) { valor = cred; operacao = 'C' }
      else continue
    } else {
      valor = valorBr(cols[idxValor >= 0 ? idxValor : 1])
      if (valor == null || !Number.isFinite(valor) || valor === 0) continue
      operacao = valor < 0 ? 'D' : 'C'
      valor = Math.abs(valor)
    }
    const historico = texto(cols[idxHist >= 0 ? idxHist : cols.length - 1]) || 'Lançamento'
    const evento = `${data}|${operacao}|${dinheiro(valor)}|${historico}`.slice(0, 120)
    linhas.push({
      evento_id: createHash('sha1').update(evento).digest('hex').slice(0, 40),
      operacao,
      estorno: /ESTORNO/i.test(historico),
      data_contabil: data,
      data_evento: data,
      valor: dinheiro(valor),
      historico: historico.slice(0, 240),
      documento_ref: digitos(historico).length >= 44 ? digitos(historico).slice(0, 48) : null,
    })
  }
  if (!linhas.length) throw new Error('Nenhum lançamento no CSV.')
  return linhas
}

function normalizarNome(valor) {
  return texto(valor).normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function dataCelula(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const y = valor.getFullYear()
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof valor === 'number' && valor > 20000 && valor < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return dataBrParaIso(valor)
}

function valorCelula(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (valor == null || valor === '') return null
  return valorBr(valor)
}

function gradePlanilha(buffer) {
  const livro = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const grades = []
  for (const nome of livro.SheetNames) {
    const grade = XLSX.utils.sheet_to_json(livro.Sheets[nome], { header: 1, raw: true, defval: null })
    if (grade.length) grades.push(grade)
  }
  return grades
}

function mapaCabecalhoExtrato(celulas) {
  const cab = (celulas || []).map((c) => normalizarNome(c))
  const idx = (re) => cab.findIndex((c) => re.test(c))
  const data = idx(/^DATA\b/)
  const valor = cab.findIndex((c) => /VALOR/.test(c) && !/SALDO/.test(c))
  if (data < 0 || (valor < 0 && idx(/DEBITO/) < 0 && idx(/CREDITO/) < 0)) return null
  return {
    data,
    tipo: idx(/LANCAMENTO|HISTORICO|DESCRICAO|MEMO/),
    razao: idx(/RAZAO|FAVORECIDO|BENEFICIARIO/),
    doc: idx(/CPF|CNPJ/),
    valor,
    debito: idx(/DEBITO|SAIDA/),
    credito: idx(/CREDITO|ENTRADA/),
  }
}

function contaCabecalhoPlanilha(grade) {
  const linhasTopo = (grade || []).slice(0, 30)
  const topo = linhasTopo.map((celulas) => (Array.isArray(celulas) ? celulas.map((c) => texto(c)).join(' ') : '')).join('\n')
  const lida = contaDoTexto(topo)
  for (const celulas of linhasTopo) {
    if (!Array.isArray(celulas)) continue
    for (let i = 0; i < celulas.length; i += 1) {
      const rotulo = normalizarNome(celulas[i])
      const valor = texto(celulas[i + 1])
      if (!valor) continue
      if (/^AGENCIA\b/.test(rotulo) && !lida.agencia) lida.agencia = valor
      if (/^CONTA\b/.test(rotulo) && !lida.conta) lida.conta = valor.replace(/\s+/g, '')
      if (/^(NOME|TITULAR|EMPRESA|CLIENTE)\b/.test(rotulo)) {
        if (/ITAU/.test(normalizarNome(valor))) lida.banco = 'itau'
        if (/BANCO DO BRASIL|\bBB\b/.test(normalizarNome(valor))) lida.banco = 'banco_do_brasil'
        if (!lida.apelido) lida.apelido = valor
      }
      if (/^CNPJ\b/.test(rotulo) && !lida.cnpj) lida.cnpj = documentoPessoa(valor)
    }
  }
  // "4739 / 97985-6" ou "Agência/Conta" na linha de cima
  if (!lida.conta) {
    const par = topo.match(/(\d{3,5})\s*\/\s*(\d[\d.]*-?[\dX])/i)
    if (par) {
      if (!lida.agencia) lida.agencia = par[1]
      lida.conta = par[2].replace(/\s+/g, '')
    }
  }
  return lida
}

/** Planilha de lançamentos do banco (exportação BB/Itaú: cabeçalho + Data/Valor). */
export function lerPlanilhaExtrato(buffer) {
  const grades = gradePlanilha(buffer)
  let conta = { banco: null, agencia: '', conta: '', cnpj: '', apelido: '' }
  let linhas = []
  for (const grade of grades) {
    const lida = contaCabecalhoPlanilha(grade)
    if (lida.agencia || lida.conta || lida.cnpj || lida.banco) {
      conta = {
        banco: lida.banco || conta.banco,
        agencia: lida.agencia || conta.agencia,
        conta: lida.conta || conta.conta,
        cnpj: lida.cnpj || conta.cnpj,
        apelido: lida.apelido || conta.apelido,
      }
    }
    let mapa = null
    const achadas = []
    for (const celulas of grade) {
      if (!Array.isArray(celulas)) continue
      if (!mapa) {
        const candidato = mapaCabecalhoExtrato(celulas)
        if (candidato) {
          mapa = candidato
          if (!conta.banco) conta.banco = /ita[uú]/i.test(JSON.stringify(grade.slice(0, 15))) ? 'itau' : 'banco_do_brasil'
        }
        continue
      }
      const data = dataCelula(celulas[mapa.data])
      if (!data) continue
      const tipo = mapa.tipo >= 0 ? texto(celulas[mapa.tipo]) : ''
      if (/SALDO\s+(ANTERIOR|DO DIA|FINAL|BLOQUEADO)/i.test(tipo)) continue
      const razao = mapa.razao >= 0 ? texto(celulas[mapa.razao]) : ''
      const doc = mapa.doc >= 0 ? documentoPessoa(celulas[mapa.doc]) : ''
      let valor = null
      let operacao = 'D'
      if (mapa.debito >= 0 || mapa.credito >= 0) {
        const deb = mapa.debito >= 0 ? valorCelula(celulas[mapa.debito]) : null
        const cred = mapa.credito >= 0 ? valorCelula(celulas[mapa.credito]) : null
        if (deb && deb !== 0) { valor = Math.abs(deb); operacao = 'D' }
        else if (cred && cred !== 0) { valor = Math.abs(cred); operacao = 'C' }
        else continue
      } else {
        valor = valorCelula(celulas[mapa.valor])
        if (valor == null || !Number.isFinite(valor) || valor === 0) continue
        operacao = valor < 0 ? 'D' : 'C'
        valor = Math.abs(valor)
      }
      const historico = [tipo, razao].filter(Boolean).join(' · ') || 'Lançamento'
      const documento = doc || null
      achadas.push({
        operacao,
        estorno: /ESTORNO/i.test(historico),
        data_contabil: data,
        data_evento: data,
        valor: dinheiro(valor),
        historico: historico.slice(0, 240),
        documento_ref: documento,
        contraparte_nome: razao || null,
      })
    }
    if (achadas.length) {
      linhas = achadas
      break
    }
  }
  if (!linhas.length) throw new Error('Não achei lançamentos nessa planilha. Use a exportação do banco, com data e valor.')
  const vistos = new Map()
  for (const linha of linhas) {
    const base = createHash('sha1').update(`${linha.data_contabil}|${linha.operacao}|${linha.valor}|${linha.historico}|${linha.documento_ref || ''}`).digest('hex').slice(0, 40)
    const n = vistos.get(base) || 0
    vistos.set(base, n + 1)
    linha.evento_id = n ? `${base}-${n}` : base
  }
  return { linhas, conta }
}

export function lerExtratoArquivo(buffer, nome) {
  const ext = String(nome || '').split('.').pop()?.toLowerCase() || ''
  if (ext === 'xlsx' || ext === 'xls') {
    const planilha = lerPlanilhaExtrato(buffer)
    return { formato: 'xlsx', linhas: planilha.linhas, conta: planilha.conta }
  }
  const amostra = decodeArquivo(buffer).slice(0, 200)
  const ofx = ext === 'ofx' || ext === 'qfx' || /<OFX|<STMTTRN/i.test(amostra) || /^OFXHEADER/i.test(amostra)
  if (ofx) return { formato: 'ofx', linhas: lerOfx(buffer), conta: contaDoOfx(buffer) }
  if (ext === 'csv' || ext === 'txt') return { formato: 'csv', linhas: lerCsvExtrato(buffer), conta: contaDoCsv(buffer) }
  throw new Error('Use a planilha do banco, OFX ou CSV.')
}

const PALAVRAS_BANCO = new Set([
  'PAGAMENTO', 'PAGAMENTOS', 'PAGO', 'PIX', 'ENVIADO', 'RECEBIDO', 'TED', 'DOC', 'BOLETO',
  'TARIFA', 'SALDO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'COMPRA', 'CARTAO', 'QR', 'CODE',
  'REF', 'AUT', 'MAIS', 'LIQ', 'LIQUIDACAO',
])

function tokensNome(valor) {
  const limpo = normalizarNome(valor)
    .replace(/\b(BOLETO|PAGO|PAGAMENTO|PIX|TED|DOC|QR|CODE|ENVIADO|RECEBIDO|COMPRA|CARTAO)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return limpo.split(' ').filter((t) => t.length >= 4 && !PALAVRAS_BANCO.has(t))
}

function nomeContraparte(lancamento) {
  if (lancamento.contraparte_nome) return normalizarNome(lancamento.contraparte_nome)
  const partes = texto(lancamento.historico).split('·').map((p) => texto(p)).filter(Boolean)
  return normalizarNome(partes.length > 1 ? partes.slice(1).join(' ') : partes[0] || '')
}

function nomeParece(lancamento, despesa) {
  const origem = tokensNome(nomeContraparte(lancamento))
  const alvo = normalizarNome([despesa.descricao, despesa.fornecedor, despesa.razao_social].filter(Boolean).join(' '))
  if (!origem.length || !alvo) return false
  return origem.some((t) => alvo.includes(t))
}

function mesmoDocumento(lancamento, despesa) {
  const docsLanc = documentosDoLancamento(lancamento)
  if (!docsLanc.length) return false
  const alvos = [despesa.cpf_cnpj, despesa.documento_ref].filter(Boolean)
  return docsLanc.some((doc) => alvos.some((alvo) => mesmoCnpjEmpresa(doc, alvo)))
}

function noDia(data, despesa) {
  return data && String(despesa.vencimento || '').slice(0, 10) === data
}

function naFolga(data, despesa, folga) {
  return data && despesa.vencimento && Math.abs(diferencaDias(data, String(despesa.vencimento).slice(0, 10))) <= folga
}

function unico(lista) {
  return lista.length === 1 ? lista[0] : null
}

function cnpjsNoTexto(valor) {
  const brutos = String(valor || '').match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{14}/g) || []
  return [...new Set(brutos.map((c) => documentoPessoa(c)).filter((c) => c.length === 14))]
}

/**
 * Entrada, tarifa, aplicação, IOF ou PIX/TED para CNPJ do próprio grupo
 * (transferência entre contas) — não é título a pagar.
 */
export function pareceNaoTitulo(lancamento, { cnpjsGrupo } = {}) {
  if (!lancamento) return false
  if (lancamento.operacao === 'C') return true
  if (lancamento.estorno) return true
  const historico = texto(lancamento.historico)
  const h = normalizarNome(historico)
  if (!h) return false
  if (/^(TARIFA|IOF|JUROS|ANUIDADE|ENCARGOS|APL|APLIC)\b/.test(h)
    || /\b(TARIFA|IOF|PACOTE DE SERVICOS|MENSALIDADE|APLICACAO|APLIC AUT|RESGATE|RENDIMENTO|CDB|FUNDO)\b/.test(h)
    || /\b(SISPAG|FOLHA DE PAGAMENTO|SALARIOS)\b/.test(h)
    || /\b(TRANSF|TED|PIX)\b.*\b(MESMA TITULARIDADE|ENTRE CONTAS|CONTAS PROPRIAS)\b/.test(h)) {
    return true
  }

  const grupo = new Set((cnpjsGrupo || []).map((c) => documentoPessoa(c)).filter((c) => c.length === 14))
  const raizesGrupo = new Set([...grupo].map((c) => c.slice(0, 8)))
  if (!grupo.size) return false

  const docs = documentosDoLancamento(lancamento)
  const paraOGrupo = docs.some((doc) => grupo.has(doc) || raizesGrupo.has(doc.slice(0, 8)))
  if (!paraOGrupo) return false

  // PIX/TED/DOC enviado ao CNPJ de loja do grupo = transferência interna.
  return /\b(PIX|TED|DOC|TRANSF)\b/.test(h)
    || /\b(ENVIADO|TRANSFERIDO|REMETIDO)\b/.test(h)
    || /\b(BURGER KING|POPEYES|ALVIM)\b/.test(h)
}

function prioridadeStatus(status) {
  const s = String(status || '')
  if (s === 'pronta' || s === 'paga' || s === 'agendada') return 0
  if (s === 'classificada') return 1
  if (s === 'rascunho') return 2
  if (s === 'conciliada') return 3
  return 4
}

function escolherEntre(candidatos, data, folgaDias) {
  if (!candidatos.length) return null
  if (candidatos.length === 1) return candidatos[0]
  const ordenados = [...candidatos].sort((a, b) => prioridadeStatus(a.status) - prioridadeStatus(b.status))
  return unico(ordenados.filter((item) => noDia(data, item)))
    || unico(ordenados.filter((item) => naFolga(data, item, folgaDias)))
    || unico(ordenados.filter((item) => prioridadeStatus(item.status) <= 1))
    || null
}

/**
 * Casa sozinho o que for óbvio — o usuário só mexe no que sobrar ambíguo.
 * Ordem: código de barras → CNPJ (MEMO/filial) → nome → mesmo dia → folga → valor único.
 * Aceita despesa já "conciliada" sem vínculo no extrato (religa o banco).
 */
export function escolherConciliacaoAutomatica(lancamento, despesas, folgaDias = FOLGA_AUTO, opts = {}) {
  if (lancamento.operacao !== 'D' || lancamento.estorno || lancamento.despesa_id) return null
  if (lancamento.status === 'sem_par' || lancamento.status === 'conciliado') return null
  if (pareceNaoTitulo(lancamento, opts)) return null
  const valor = centavos(lancamento.valor)
  if (valor == null) return null
  const data = String(lancamento.data_contabil || lancamento.data_evento || '').slice(0, 10)
  const mesmos = despesas.filter((item) => {
    if (item.empresa_origem_id && lancamento.empresa_id && item.empresa_origem_id !== lancamento.empresa_id) return false
    if (['cancelada', 'faltou'].includes(item.status)) return false
    return centavos(item.valor) === valor
  })
  if (!mesmos.length) return null

  const codigo = digitos(lancamento.documento_ref)
  if (codigo.length >= 44) {
    const porCodigo = mesmos.filter((item) => digitos(item.documento_ref) === codigo)
    const unicoCodigo = escolherEntre(porCodigo, data, folgaDias) || unico(porCodigo)
    if (unicoCodigo) return unicoCodigo
  }

  if (documentosDoLancamento(lancamento).length) {
    const porDoc = mesmos.filter((item) => mesmoDocumento(lancamento, item))
    const escolhidoDoc = escolherEntre(porDoc, data, folgaDias)
      || (porDoc.length === 1 ? porDoc[0] : null)
      || escolherEntre(porDoc.filter((item) => nomeParece(lancamento, item)), data, folgaDias)
    if (escolhidoDoc) return escolhidoDoc
  }

  const peloNome = mesmos.filter((item) => nomeParece(lancamento, item))
  const escolhidoNome = escolherEntre(peloNome, data, folgaDias) || (peloNome.length === 1 ? peloNome[0] : null)
  if (escolhidoNome) return escolhidoNome

  const doDia = mesmos.filter((item) => noDia(data, item))
  const escolhidoDia = escolherEntre(doDia, data, folgaDias) || (doDia.length === 1 ? doDia[0] : null)
  if (escolhidoDia) return escolhidoDia

  const perto = mesmos.filter((item) => naFolga(data, item, folgaDias))
  const escolhidoPerto = escolherEntre(perto, data, folgaDias) || (perto.length === 1 ? perto[0] : null)
  if (escolhidoPerto) return escolhidoPerto

  // Valor único na loja no período: fecha sem ficar pedindo casamento manual.
  if (mesmos.length === 1) return mesmos[0]
  return null
}

export function escolherDespesaPagar(lancamento, despesas, folgaDias = FOLGA_AUTO, opts = {}) {
  return escolherConciliacaoAutomatica(lancamento, despesas, folgaDias, opts)
}

export function sugerirPagar(lancamentos, despesas, folgaDias = FOLGA_AUTO, opts = {}) {
  const ocupadas = new Set([
    ...lancamentos.map((l) => l.despesa_id).filter(Boolean),
    ...lancamentos.map((l) => l.sugerido_despesa_id).filter(Boolean),
  ])
  const livres = () => despesas.filter((d) => !ocupadas.has(d.id))
  const sugestoes = []
  const ordem = [...lancamentos]
    .filter((l) => l.operacao === 'D' && !l.despesa_id && l.status !== 'sem_par' && !pareceNaoTitulo(l, opts))
    .sort((a, b) => String(a.data_contabil).localeCompare(String(b.data_contabil)) || Number(b.valor) - Number(a.valor))
  for (const linha of ordem) {
    const despesa = escolherConciliacaoAutomatica(linha, livres(), folgaDias, opts)
    if (!despesa) continue
    ocupadas.add(despesa.id)
    sugestoes.push({ lancamento_id: linha.id, despesa_id: despesa.id })
  }
  return sugestoes
}

/** Totais do extrato da conta. Estorno entra no líquido pelo sinal; não entra na fila em aberto. */
export function resumoExtrato(linhas) {
  let entradas = 0
  let saidas = 0
  let conciliados = 0
  let emAberto = 0
  let valorAberto = 0
  for (const linha of linhas) {
    const valor = Number(linha.valor) || 0
    if (linha.operacao === 'C') entradas += valor
    else saidas += valor
    if (linha.status === 'conciliado' || linha.despesa_id) conciliados += 1
    else if (linha.status !== 'sem_par' && !linha.estorno) {
      emAberto += 1
      valorAberto += valor
    }
  }
  return {
    entradas: dinheiro(entradas),
    saidas: dinheiro(saidas),
    liquido: dinheiro(entradas - saidas),
    qtd: linhas.length,
    conciliados,
    em_aberto: emAberto,
    valor_aberto: dinheiro(valorAberto),
  }
}

let schemaConciliacaoOk = false
export async function garantirSchemaConciliacao(pool) {
  if (schemaConciliacaoOk) return
  await pool.query(fs.readFileSync(schemaPath, 'utf8'))
  schemaConciliacaoOk = true
}

function inboxSql() {
  return `
    not (
      d.status in ('rascunho', 'classificada', 'bloqueada_duplicata')
      and (
        d.fonte in ('dda', 'nfe')
        or (coalesce(d.fonte, 'manual') = 'manual' and coalesce(d.pendente_inbox, false))
      )
    )
  `
}

function rotuloConta(c) {
  const banco = c.banco === 'itau' ? 'Itaú' : c.banco === 'banco_do_brasil' ? 'BB' : 'Conta'
  return `${banco} · ${c.nome || c.apelido}`
}

async function contasCorrente(pool) {
  const { rows } = await pool.query(`
    select c.id::text as id, c.empresa_id::text as empresa_id, c.nome, c.banco,
           c.agencia, c.numero, c.digito, e.apelido, e.cnpj
    from contas_bancarias c
    join empresas e on e.id = c.empresa_id
    where c.ativa and coalesce(c.tipo, 'corrente') = 'corrente'
  `)
  return rows
}

function erroConta(mensagem, contas) {
  const err = new Error(mensagem)
  err.codigo = 'conta_nao_identificada'
  err.contas = contas.map((c) => ({ id: c.id, rotulo: rotuloConta(c), apelido: c.apelido }))
  return err
}

async function cnpjsDoGrupo(pool) {
  const { rows } = await pool.query(`
    select cnpj from empresas
    where coalesce(ativo, true)
      and cnpj is not null
      and length(regexp_replace(cnpj, '\\D', '', 'g')) = 14
  `)
  return rows.map((r) => documentoPessoa(r.cnpj)).filter(Boolean)
}

export async function conciliarAutomatico(pool, { contaId, empresaId, de, ate }) {
  const linhas = await pool.query(`
    select id::text as id, empresa_id::text as empresa_id, operacao, estorno,
           valor::float8 as valor, to_char(data_contabil, 'YYYY-MM-DD') as data_contabil,
           historico, documento_ref, status, despesa_id::text as despesa_id
    from extrato_lancamentos
    where conta_id = $1::uuid
      and empresa_id = $2::uuid
      and data_contabil between $3::date and $4::date
      and despesa_id is null
      and status in ('pendente', 'sugerido')
    order by case when operacao = 'D' then 0 else 1 end, data_contabil, valor desc
  `, [contaId, empresaId, de, ate])
  if (!linhas.rows.length) return 0

  const cnpjsGrupo = await cnpjsDoGrupo(pool)
  const opts = { cnpjsGrupo }
  let semPar = 0
  for (const linha of linhas.rows) {
    if (!pareceNaoTitulo(linha, opts)) continue
    try {
      await marcarSemPar(pool, { lancamentoId: linha.id })
      semPar += 1
    } catch {
      // já conciliado ou sumiu
    }
  }

  const abertas = linhas.rows.filter((l) => l.operacao === 'D' && !l.estorno && !pareceNaoTitulo(l, opts))
  if (!abertas.length) return semPar

  const despesas = await pool.query(`
    select d.id::text as id,
           d.empresa_origem_id::text as empresa_origem_id,
           d.descricao,
           d.valor::float8 as valor,
           to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           d.status,
           d.documento_ref,
           f.nome as fornecedor,
           f.razao_social,
           f.cpf_cnpj
    from despesas d
    left join fornecedores f on f.id = d.fornecedor_id
    where d.empresa_origem_id = $1::uuid
      and d.status not in ('cancelada', 'faltou')
      and d.vencimento between ($2::date - ${FOLGA_AUTO}) and ($3::date + ${FOLGA_AUTO})
      and (
        -- títulos da agenda (inclui DDA classificado: o banco confirma o boleto)
        (
          d.status <> 'conciliada'
          and not (
            d.status in ('rascunho', 'bloqueada_duplicata')
            and (
              d.fonte in ('dda', 'nfe')
              or (coalesce(d.fonte, 'manual') = 'manual' and coalesce(d.pendente_inbox, false))
            )
          )
        )
        -- já marcada conciliada na agenda, mas sem linha de extrato ligada
        or (
          d.status = 'conciliada'
          and not exists (
            select 1 from extrato_lancamentos x where x.despesa_id = d.id
          )
        )
      )
  `, [empresaId, de, ate])
  const jaLigadas = await pool.query(`
    select d.id::text as id,
           d.empresa_origem_id::text as empresa_origem_id,
           d.descricao,
           d.valor::float8 as valor,
           to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           d.status,
           d.documento_ref,
           f.nome as fornecedor,
           f.razao_social,
           f.cpf_cnpj
    from despesas d
    left join fornecedores f on f.id = d.fornecedor_id
    where d.empresa_origem_id = $1::uuid
      and d.status = 'conciliada'
      and d.vencimento between ($2::date - ${FOLGA_AUTO}) and ($3::date + ${FOLGA_AUTO})
      and exists (select 1 from extrato_lancamentos x where x.despesa_id = d.id)
  `, [empresaId, de, ate])

  const ocupadas = new Set()
  let conciliadas = 0
  for (const linha of abertas) {
    const livres = despesas.rows.filter((d) => !ocupadas.has(d.id))
    const despesa = escolherConciliacaoAutomatica(linha, livres, FOLGA_AUTO, opts)
    if (despesa) {
      try {
        await confirmarConciliacao(pool, { lancamentoId: linha.id, despesaId: despesa.id })
        ocupadas.add(despesa.id)
        conciliadas += 1
        continue
      } catch {
        // valor ou vínculo divergente — tenta detectar duplicata abaixo
      }
    }

    // Mesmo pagamento já baixado em outra conta/linha → não fica “falso aberto”.
    const duplicata = escolherConciliacaoAutomatica(linha, jaLigadas.rows, FOLGA_AUTO, opts)
    if (!duplicata) continue
    try {
      await marcarSemPar(pool, { lancamentoId: linha.id })
      semPar += 1
    } catch {
      // ignore
    }
  }
  return conciliadas + semPar
}

export async function importarExtrato(pool, { contaId, empresaId, nome, base64 }) {
  const buffer = Buffer.from(String(base64 || ''), 'base64')
  if (!buffer.length) throw new Error('Arquivo vazio.')
  const { formato, linhas, conta: lida } = lerExtratoArquivo(buffer, nome)
  const contas = await contasCorrente(pool)

  let conta = contaId ? contas.find((c) => c.id === contaId) : null
  if (!conta) {
    const achadas = resolverConta(contas, lida, { empresaId })
    if (achadas.length !== 1) {
      const doBanco = lida.banco ? contas.filter((c) => c.banco === lida.banco) : contas
      const daLoja = empresaId ? contas.filter((c) => c.empresa_id === empresaId) : []
      throw erroConta(
        achadas.length > 1
          ? 'O arquivo bate com mais de uma conta. Escolha qual é.'
          : 'Não achei a conta deste extrato no cadastro. Escolha qual é.',
        achadas.length > 1 ? achadas : (daLoja.length ? daLoja : doBanco),
      )
    }
    conta = achadas[0]
  }

  const hash = hashArquivo(buffer)
  const ja = await pool.query(`select id, qtd_linhas, to_char(de, 'YYYY-MM-DD') as de, to_char(ate, 'YYYY-MM-DD') as ate from extrato_arquivos where conta_id = $1 and hash = $2`, [conta.id, hash])
  if (ja.rows[0]) {
    return {
      arquivo_id: ja.rows[0].id,
      criadas: 0,
      repetidas: ja.rows[0].qtd_linhas,
      de: ja.rows[0].de,
      ate: ja.rows[0].ate,
      ja_importado: true,
      conta: rotuloConta(conta),
      conta_id: conta.id,
      empresa_id: conta.empresa_id,
      conciliadas: 0,
    }
  }
  const datas = linhas.map((l) => l.data_contabil).sort()
  const de = datas[0]
  const ate = datas[datas.length - 1]
  const arquivo = await pool.query(`
    insert into extrato_arquivos (conta_id, nome_arquivo, formato, hash, de, ate, qtd_linhas)
    values ($1, $2, $3, $4, $5::date, $6::date, $7)
    returning id
  `, [conta.id, texto(nome).slice(0, 180) || 'extrato.ofx', formato, hash, de, ate, linhas.length])
  const arquivoId = arquivo.rows[0].id
  let criadas = 0
  let repetidas = 0
  const LOTE = 80
  for (let i = 0; i < linhas.length; i += LOTE) {
    const fatia = linhas.slice(i, i + LOTE)
    const params = []
    const values = fatia.map((linha, idx) => {
      const b = idx * 11
      params.push(
        conta.id,
        conta.empresa_id,
        arquivoId,
        linha.evento_id,
        linha.operacao,
        !!linha.estorno,
        linha.data_contabil,
        linha.data_evento || linha.data_contabil,
        linha.valor,
        linha.historico,
        linha.documento_ref,
      )
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}::date, $${b + 8}::date, $${b + 9}, $${b + 10}, $${b + 11})`
    })
    const r = await pool.query(`
      insert into extrato_lancamentos (
        conta_id, empresa_id, arquivo_id, evento_id, operacao, estorno,
        data_contabil, data_evento, valor, historico, documento_ref
      ) values ${values.join(',\n')}
      on conflict (conta_id, evento_id) do nothing
      returning id
    `, params)
    criadas += r.rowCount || 0
    repetidas += fatia.length - (r.rowCount || 0)
  }
  return {
    arquivo_id: arquivoId,
    criadas,
    repetidas,
    de,
    ate,
    ja_importado: false,
    formato,
    conta: rotuloConta(conta),
    conta_id: conta.id,
    empresa_id: conta.empresa_id,
    conciliadas: await conciliarAutomatico(pool, {
      contaId: conta.id,
      empresaId: conta.empresa_id,
      de,
      ate,
    }),
  }
}

const FOLGA_PERIODO = 15

function contaPeriodo(c) {
  return {
    id: c.id,
    empresa_id: c.empresa_id,
    apelido: c.apelido,
    nome: c.nome || null,
    banco: c.banco || null,
    agencia: c.agencia || null,
    numero: c.numero || null,
    digito: c.digito || null,
  }
}

/** Extrato inteiro de uma conta no período, com sugestão de título a pagar. */
export async function periodoConciliacao(pool, { contaId, de, ate }) {
  const contas = await pool.query(`
    select c.id::text as id, c.empresa_id::text as empresa_id, c.nome, c.banco,
           c.agencia, c.numero, c.digito, e.apelido
    from contas_bancarias c
    join empresas e on e.id = c.empresa_id
    where c.ativa and coalesce(c.tipo, 'corrente') = 'corrente'
    order by e.apelido, c.nome
  `)
  const lista = contas.rows.map(contaPeriodo)
  if (!contaId) {
    return {
      conta_id: null,
      de,
      ate,
      contas: lista,
      resumo: { ...resumoExtrato([]), sem_extrato: 0, valor_sem_extrato: 0 },
      extrato: [],
      sistema: [],
    }
  }
  const conta = lista.find((c) => c.id === contaId)
  if (!conta) throw new Error('Conta não encontrada.')

  await conciliarAutomatico(pool, { contaId, empresaId: conta.empresa_id, de, ate })

  const extrato = await pool.query(`
    select l.id::text as id,
           l.empresa_id::text as empresa_id,
           l.operacao,
           l.estorno,
           l.valor::float8 as valor,
           to_char(l.data_contabil, 'YYYY-MM-DD') as data_contabil,
           l.historico,
           l.documento_ref,
           l.status,
           l.despesa_id::text as despesa_id,
           l.sugerido_despesa_id::text as sugerido_despesa_id,
           d.descricao as despesa_descricao,
           c.nome as conta_nome,
           c.banco,
           e.apelido as loja
    from extrato_lancamentos l
    join contas_bancarias c on c.id = l.conta_id
    join empresas e on e.id = l.empresa_id
    left join despesas d on d.id = l.despesa_id
    where l.conta_id = $1::uuid
      and l.data_contabil between $2::date and $3::date
    order by l.data_contabil, l.operacao, l.valor desc, l.historico
  `, [contaId, de, ate])

  const sistema = await pool.query(`
    select d.id::text as id,
           d.descricao,
           d.valor::float8 as valor,
           to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           d.status,
           d.documento_ref,
           d.numero_nf,
           d.forma_pagamento,
           d.empresa_origem_id::text as empresa_origem_id,
           eo.apelido as loja
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    where d.empresa_origem_id = $1::uuid
      and d.status not in ('cancelada', 'faltou')
      and d.vencimento between ($2::date - 31) and ($3::date + 31)
      and (
        d.status <> 'conciliada'
        or d.id in (
          select despesa_id from extrato_lancamentos
          where conta_id = $4::uuid
            and data_contabil between $2::date and $3::date
            and despesa_id is not null
        )
      )
      and ${inboxSql()}
    order by d.vencimento, d.valor desc, d.descricao
    limit 500
  `, [conta.empresa_id, de, ate, contaId])

  const sugestoes = sugerirPagar(
    extrato.rows,
    sistema.rows.filter((d) => !['conciliada', 'faltou'].includes(d.status)),
    FOLGA_PERIODO,
  )
  const mapaSugestao = new Map(sugestoes.map((s) => [s.lancamento_id, s.despesa_id]))
  const linhas = extrato.rows.map((l) => ({
    ...l,
    sugerido_despesa_id: l.despesa_id ? null : (l.sugerido_despesa_id || mapaSugestao.get(l.id) || null),
  }))
  const ligadas = new Set(linhas.map((l) => l.despesa_id).filter(Boolean))
  const semExtrato = sistema.rows.filter((d) => {
    const venc = String(d.vencimento || '').slice(0, 10)
    return venc >= de && venc <= ate && d.status !== 'conciliada' && !ligadas.has(d.id)
  })
  return {
    conta_id: contaId,
    de,
    ate,
    contas: lista,
    resumo: {
      ...resumoExtrato(linhas),
      sem_extrato: semExtrato.length,
      valor_sem_extrato: dinheiro(semExtrato.reduce((soma, d) => soma + Number(d.valor || 0), 0)),
    },
    extrato: linhas,
    sistema: sistema.rows,
  }
}

function resumoLoja(extrato, sistema, de, ate) {
  const ligadas = new Set(extrato.map((l) => l.despesa_id).filter(Boolean))
  let debitos = 0
  let conciliados = 0
  let abertosBanco = 0
  let valorBanco = 0
  for (const linha of extrato) {
    if (linha.operacao !== 'D' || linha.estorno) continue
    debitos += 1
    if (linha.status === 'conciliado' || linha.despesa_id) conciliados += 1
    else if (linha.status !== 'sem_par') {
      abertosBanco += 1
      valorBanco += Number(linha.valor) || 0
    }
  }
  let abertosSistema = 0
  let valorSistema = 0
  for (const item of sistema) {
    const venc = String(item.vencimento || '').slice(0, 10)
    if (venc < de || venc > ate) continue
    if (item.status === 'conciliada' || ligadas.has(item.id)) continue
    abertosSistema += 1
    valorSistema += Number(item.valor) || 0
  }
  const temExtrato = extrato.length > 0
  return {
    tem_extrato: temExtrato,
    debitos,
    conciliados,
    abertos_banco: abertosBanco,
    abertos_sistema: abertosSistema,
    valor_banco: dinheiro(valorBanco),
    valor_sistema: dinheiro(valorSistema),
    bate: temExtrato && abertosBanco === 0 && abertosSistema === 0,
  }
}

/** Semana inteira, todas as lojas: extrato de um lado, agenda do outro. */
export async function painelConciliacao(pool, { de, ate }) {
  const pendentes = await pool.query(`
    select distinct conta_id::text as conta_id, empresa_id::text as empresa_id
    from extrato_lancamentos
    where data_contabil between $1::date and $2::date
      and operacao = 'D'
      and not estorno
      and despesa_id is null
      and status in ('pendente', 'sugerido')
  `, [de, ate])
  for (const row of pendentes.rows) {
    await conciliarAutomatico(pool, { contaId: row.conta_id, empresaId: row.empresa_id, de, ate })
  }

  const extrato = await pool.query(`
    select l.id::text as id,
           l.empresa_id::text as empresa_id,
           l.operacao,
           l.estorno,
           l.valor::float8 as valor,
           to_char(l.data_contabil, 'YYYY-MM-DD') as data_contabil,
           l.historico,
           l.documento_ref,
           l.status,
           l.despesa_id::text as despesa_id,
           d.descricao as despesa_descricao,
           c.nome as conta_nome,
           c.banco,
           e.apelido as loja
    from extrato_lancamentos l
    join contas_bancarias c on c.id = l.conta_id
    join empresas e on e.id = l.empresa_id
    left join despesas d on d.id = l.despesa_id
    where l.data_contabil between $1::date and $2::date
    order by l.data_contabil, l.valor desc, l.historico
  `, [de, ate])

  const sistema = await pool.query(`
    select d.id::text as id,
           d.descricao,
           d.valor::float8 as valor,
           to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           d.status,
           d.documento_ref,
           d.numero_nf,
           d.forma_pagamento,
           d.empresa_origem_id::text as empresa_id,
           eo.apelido as loja
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    where d.status not in ('cancelada', 'faltou')
      and ${inboxSql()}
      and (
        d.vencimento between ($1::date - 15) and ($2::date + 15)
        or d.id in (
          select despesa_id from extrato_lancamentos
          where data_contabil between $1::date and $2::date
            and despesa_id is not null
        )
      )
    order by d.vencimento, d.valor desc, d.descricao
  `, [de, ate])

  const porEmpresa = new Map()
  const garantir = (empresaId, apelido) => {
    if (!porEmpresa.has(empresaId)) {
      porEmpresa.set(empresaId, { empresa_id: empresaId, apelido: apelido || '', extrato: [], sistema: [] })
    }
    const loja = porEmpresa.get(empresaId)
    if (apelido && !loja.apelido) loja.apelido = apelido
    return loja
  }
  for (const linha of extrato.rows) garantir(linha.empresa_id, linha.loja).extrato.push(linha)
  for (const item of sistema.rows) {
    const venc = String(item.vencimento || '').slice(0, 10)
    if (venc >= de && venc <= ate) garantir(item.empresa_id, item.loja)
    const loja = porEmpresa.get(item.empresa_id)
    if (loja) loja.sistema.push(item)
  }

  const lojas = [...porEmpresa.values()].map((loja) => {
    const sugestoes = sugerirPagar(
      loja.extrato,
      loja.sistema.filter((d) => !['conciliada', 'faltou'].includes(d.status)),
      FOLGA_PERIODO,
    )
    const mapa = new Map(sugestoes.map((s) => [s.lancamento_id, s.despesa_id]))
    const linhas = loja.extrato.map((l) => ({
      ...l,
      sugerido_despesa_id: l.despesa_id ? null : (mapa.get(l.id) || null),
    }))
    const ficar = new Set([
      ...linhas.map((l) => l.despesa_id).filter(Boolean),
      ...linhas.map((l) => l.sugerido_despesa_id).filter(Boolean),
    ])
    const titulos = loja.sistema.filter((d) => {
      const venc = String(d.vencimento || '').slice(0, 10)
      return (venc >= de && venc <= ate) || ficar.has(d.id)
    })
    return {
      empresa_id: loja.empresa_id,
      apelido: loja.apelido,
      resumo: resumoLoja(linhas, titulos, de, ate),
      extrato: linhas,
      sistema: titulos,
    }
  })

  return { de, ate, lojas }
}

export async function semanaConciliacao(pool, { empresaId, de, ate }) {
  const empresa = empresaId || null
  const extrato = await pool.query(`
    select to_char(data_contabil, 'YYYY-MM-DD') as data,
           coalesce(sum(valor) filter (where operacao = 'D' and not estorno), 0)::float8 as total_extrato,
           coalesce(sum(valor) filter (
             where operacao = 'D' and not estorno and status in ('pendente', 'sugerido')
           ), 0)::float8 as pendente_extrato,
           count(*) filter (where operacao = 'D' and not estorno)::int as qtd_extrato
    from extrato_lancamentos
    where ($1::uuid is null or empresa_id = $1::uuid)
      and data_contabil between $2::date and $3::date
    group by data_contabil
  `, [empresa, de, ate])
  const sistema = await pool.query(`
    select to_char(d.vencimento, 'YYYY-MM-DD') as data,
           coalesce(sum(d.valor), 0)::float8 as total_sistema,
           coalesce(sum(d.valor) filter (where d.status <> 'conciliada'), 0)::float8 as pendente_sistema,
           count(*)::int as qtd_sistema
    from despesas d
    where ($1::uuid is null or d.empresa_origem_id = $1::uuid)
      and d.status <> 'cancelada'
      and d.vencimento between $2::date and $3::date
      and ${inboxSql()}
    group by d.vencimento
  `, [empresa, de, ate])
  const contas = await pool.query(`
    select distinct c.id::text as id, c.nome, c.banco, e.apelido
    from extrato_lancamentos l
    join contas_bancarias c on c.id = l.conta_id
    join empresas e on e.id = c.empresa_id
    where ($1::uuid is null or l.empresa_id = $1::uuid)
      and l.data_contabil between $2::date and $3::date
  `, [empresa, de, ate])

  const porData = new Map()
  const cursor = new Date(`${de}T12:00:00Z`)
  const fimSemana = new Date(`${ate}T12:00:00Z`)
  while (cursor <= fimSemana) {
    const data = cursor.toISOString().slice(0, 10)
    porData.set(data, {
      data,
      total_extrato: 0,
      pendente_extrato: 0,
      qtd_extrato: 0,
      total_sistema: 0,
      pendente_sistema: 0,
      qtd_sistema: 0,
      ok: false,
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  for (const row of extrato.rows) {
    const dia = porData.get(row.data)
    if (!dia) continue
    Object.assign(dia, {
      total_extrato: Number(row.total_extrato) || 0,
      pendente_extrato: Number(row.pendente_extrato) || 0,
      qtd_extrato: row.qtd_extrato || 0,
    })
  }
  for (const row of sistema.rows) {
    const dia = porData.get(row.data)
    if (!dia) continue
    Object.assign(dia, {
      total_sistema: Number(row.total_sistema) || 0,
      pendente_sistema: Number(row.pendente_sistema) || 0,
      qtd_sistema: row.qtd_sistema || 0,
    })
  }
  const dias = [...porData.values()].map((dia) => ({
    ...dia,
    ok: dia.pendente_extrato === 0 && dia.pendente_sistema === 0 && (dia.qtd_extrato > 0 || dia.qtd_sistema > 0),
  }))
  return {
    de,
    ate,
    contas: contas.rows.map((c) => ({ id: c.id, rotulo: rotuloConta(c), apelido: c.apelido })),
    dias,
  }
}

export async function diaConciliacao(pool, { empresaId, data }) {
  const empresa = empresaId || null
  const contas = await pool.query(`
    select distinct conta_id::text as conta_id, empresa_id::text as empresa_id
    from extrato_lancamentos
    where ($1::uuid is null or empresa_id = $1::uuid)
      and data_contabil = $2::date
      and operacao = 'D'
      and not estorno
      and despesa_id is null
      and status in ('pendente', 'sugerido')
  `, [empresa, data])
  for (const row of contas.rows) {
    await conciliarAutomatico(pool, {
      contaId: row.conta_id,
      empresaId: row.empresa_id,
      de: data,
      ate: data,
    })
  }
  const extrato = await pool.query(`
    select l.id::text as id,
           l.empresa_id::text as empresa_id,
           l.operacao,
           l.estorno,
           l.valor::float8 as valor,
           to_char(l.data_contabil, 'YYYY-MM-DD') as data_contabil,
           l.historico,
           l.documento_ref,
           l.status,
           l.despesa_id::text as despesa_id,
           l.sugerido_despesa_id::text as sugerido_despesa_id,
           d.descricao as despesa_descricao,
           c.nome as conta_nome,
           c.banco,
           e.apelido as loja
    from extrato_lancamentos l
    join contas_bancarias c on c.id = l.conta_id
    join empresas e on e.id = l.empresa_id
    left join despesas d on d.id = l.despesa_id
    where ($1::uuid is null or l.empresa_id = $1::uuid)
      and l.data_contabil = $2::date
      and l.operacao = 'D'
      and not l.estorno
    order by l.valor desc, l.historico
  `, [empresa, data])
  const sistema = await pool.query(`
    select d.id::text as id,
           d.descricao,
           d.valor::float8 as valor,
           to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           d.status,
           d.documento_ref,
           d.numero_nf,
           d.forma_pagamento,
           d.empresa_origem_id::text as empresa_origem_id,
           eo.apelido as loja,
           f.nome as fornecedor,
           f.razao_social,
           f.cpf_cnpj
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    left join fornecedores f on f.id = d.fornecedor_id
    where ($1::uuid is null or d.empresa_origem_id = $1::uuid)
      and d.status not in ('cancelada', 'faltou')
      and d.vencimento between ($2::date - ${FOLGA_AUTO}) and ($2::date + ${FOLGA_AUTO})
      and ${inboxSql()}
    order by d.valor desc, d.descricao
  `, [empresa, data])

  // Segunda passagem: o que o motor ainda achar óbvio, confirma de uma vez.
  const cnpjsGrupo = await cnpjsDoGrupo(pool)
  const optsNaoTitulo = { cnpjsGrupo }
  const abertas = extrato.rows.filter((l) => !l.despesa_id && l.status !== 'sem_par' && l.status !== 'conciliado')
  const despesasLivres = sistema.rows.filter((d) => d.status !== 'faltou')
  const ocupadas = new Set(extrato.rows.map((l) => l.despesa_id).filter(Boolean))
  for (const linha of abertas) {
    if (pareceNaoTitulo(linha, optsNaoTitulo)) {
      try { await marcarSemPar(pool, { lancamentoId: linha.id }) } catch { /* ok */ }
      continue
    }
    const despesa = escolherConciliacaoAutomatica(
      linha,
      despesasLivres.filter((d) => !ocupadas.has(d.id)),
      FOLGA_AUTO,
      optsNaoTitulo,
    )
    if (!despesa) continue
    try {
      await confirmarConciliacao(pool, { lancamentoId: linha.id, despesaId: despesa.id })
      ocupadas.add(despesa.id)
      linha.despesa_id = despesa.id
      linha.status = 'conciliado'
      linha.despesa_descricao = despesa.descricao
    } catch { /* deixa aberto */ }
  }

  const extratoFinal = await pool.query(`
    select l.id::text as id,
           l.empresa_id::text as empresa_id,
           l.operacao,
           l.estorno,
           l.valor::float8 as valor,
           to_char(l.data_contabil, 'YYYY-MM-DD') as data_contabil,
           l.historico,
           l.documento_ref,
           l.status,
           l.despesa_id::text as despesa_id,
           l.sugerido_despesa_id::text as sugerido_despesa_id,
           d.descricao as despesa_descricao,
           c.nome as conta_nome,
           c.banco,
           e.apelido as loja
    from extrato_lancamentos l
    join contas_bancarias c on c.id = l.conta_id
    join empresas e on e.id = l.empresa_id
    left join despesas d on d.id = l.despesa_id
    where ($1::uuid is null or l.empresa_id = $1::uuid)
      and l.data_contabil = $2::date
      and l.operacao = 'D'
      and not l.estorno
    order by
      case when l.despesa_id is null and l.status not in ('sem_par', 'conciliado') then 0 else 1 end,
      l.valor desc, l.historico
  `, [empresa, data])

  const sistemaFinal = await pool.query(`
    select d.id::text as id,
           d.descricao,
           d.valor::float8 as valor,
           to_char(d.vencimento, 'YYYY-MM-DD') as vencimento,
           d.status,
           d.documento_ref,
           d.numero_nf,
           d.forma_pagamento,
           d.empresa_origem_id::text as empresa_origem_id,
           eo.apelido as loja,
           f.nome as fornecedor,
           f.razao_social,
           f.cpf_cnpj
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    left join fornecedores f on f.id = d.fornecedor_id
    where ($1::uuid is null or d.empresa_origem_id = $1::uuid)
      and d.status not in ('cancelada', 'faltou')
      and d.vencimento between ($2::date - ${FOLGA_AUTO}) and ($2::date + ${FOLGA_AUTO})
      and ${inboxSql()}
    order by
      case when d.status = 'conciliada' then 1 else 0 end,
      d.valor desc, d.descricao
  `, [empresa, data])

  const sugestoes = sugerirPagar(
    extratoFinal.rows,
    sistemaFinal.rows.filter((d) => d.status !== 'faltou'),
    FOLGA_AUTO,
    optsNaoTitulo,
  )
  const mapaSugestao = new Map(sugestoes.map((s) => [s.lancamento_id, s.despesa_id]))
  const ligadas = new Set([
    ...sugestoes.map((s) => s.despesa_id),
    ...extratoFinal.rows.map((l) => l.despesa_id).filter(Boolean),
  ])
  const visiveis = empresa
    ? sistemaFinal.rows
    : sistemaFinal.rows.filter((d) => d.vencimento === data || ligadas.has(d.id))
  return {
    data,
    extrato: extratoFinal.rows.map((l) => ({
      ...l,
      sugerido_despesa_id: l.despesa_id ? null : (l.sugerido_despesa_id || mapaSugestao.get(l.id) || null),
    })),
    sistema: visiveis,
    sugestoes,
  }
}

export async function confirmarConciliacao(pool, { lancamentoId, despesaId }) {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const lanc = await cliente.query(`
      select id, conta_id, empresa_id, valor, status, despesa_id
      from extrato_lancamentos
      where id = $1
      for update
    `, [lancamentoId])
    const linha = lanc.rows[0]
    if (!linha) throw new Error('Lançamento do extrato não encontrado.')
    if (linha.despesa_id && linha.despesa_id !== despesaId) {
      throw new Error('Esse lançamento já está conciliado com outra despesa.')
    }
    const desp = await cliente.query(`
      select id, status, valor, empresa_origem_id, conta_saida_id
      from despesas
      where id = $1
      for update
    `, [despesaId])
    const despesa = desp.rows[0]
    if (!despesa) throw new Error('Despesa não encontrada.')
    if (despesa.status === 'cancelada') throw new Error('Despesa cancelada.')
    if (centavos(despesa.valor) !== centavos(linha.valor)) {
      throw new Error('Valor da despesa diferente do extrato.')
    }
    const outro = await cliente.query(`
      select id from extrato_lancamentos
      where despesa_id = $1 and id <> $2
      limit 1
    `, [despesaId, lancamentoId])
    if (outro.rows[0]) throw new Error('Essa despesa já está conciliada em outro lançamento.')

    await cliente.query(`
      update extrato_lancamentos
      set despesa_id = $2, sugerido_despesa_id = null, status = 'conciliado'
      where id = $1
    `, [lancamentoId, despesaId])
    await cliente.query(`
      update despesas
      set status = 'conciliada',
          pendente_inbox = false,
          conta_saida_id = coalesce(conta_saida_id, $2)
      where id = $1
    `, [despesaId, linha.conta_id])
    await cliente.query('commit')
    return { ok: true, lancamento_id: lancamentoId, despesa_id: despesaId }
  } catch (err) {
    await cliente.query('rollback')
    throw err
  } finally {
    cliente.release()
  }
}

export async function desfazerConciliacao(pool, { lancamentoId }) {
  const cliente = await pool.connect()
  try {
    await cliente.query('begin')
    const lanc = await cliente.query(`
      select id, despesa_id, status
      from extrato_lancamentos
      where id = $1
      for update
    `, [lancamentoId])
    const linha = lanc.rows[0]
    if (!linha) throw new Error('Lançamento do extrato não encontrado.')
    const despesaId = linha.despesa_id
    await cliente.query(`
      update extrato_lancamentos
      set despesa_id = null, sugerido_despesa_id = null, status = 'pendente'
      where id = $1
    `, [lancamentoId])
    if (despesaId) {
      await cliente.query(`
        update despesas
        set status = case when status = 'conciliada' then 'paga' else status end
        where id = $1
      `, [despesaId])
    }
    await cliente.query('commit')
    return { ok: true, lancamento_id: lancamentoId, despesa_id: despesaId }
  } catch (err) {
    await cliente.query('rollback')
    throw err
  } finally {
    cliente.release()
  }
}

export async function marcarSemPar(pool, { lancamentoId }) {
  const { rowCount } = await pool.query(`
    update extrato_lancamentos
    set despesa_id = null, sugerido_despesa_id = null, status = 'sem_par'
    where id = $1
      and despesa_id is null
  `, [lancamentoId])
  if (!rowCount) throw new Error('Lançamento não encontrado ou já conciliado.')
  return { ok: true, lancamento_id: lancamentoId }
}

/**
 * Lista do período para a loja: conciliados + em aberto (banco e agenda).
 * Roda a conciliação automática antes, para o OFX “fechar” o que der.
 */
export async function listaConciliacao(pool, { empresaId, de, ate }) {
  const empresa = String(empresaId || '').trim() || null

  const contas = await pool.query(`
    select id::text as id, empresa_id::text as empresa_id
    from contas_bancarias
    where coalesce(ativa, true)
      and ($1::uuid is null or empresa_id = $1::uuid)
  `, [empresa])
  for (const c of contas.rows) {
    await conciliarAutomatico(pool, { contaId: c.id, empresaId: c.empresa_id, de, ate })
  }

  const cnpjsGrupo = await cnpjsDoGrupo(pool)
  const opts = { cnpjsGrupo }

  const extrato = await pool.query(`
    select l.id::text as id,
           l.operacao,
           l.estorno,
           l.valor::float8 as valor,
           to_char(l.data_contabil, 'YYYY-MM-DD') as data,
           l.historico,
           l.documento_ref,
           l.status,
           l.despesa_id::text as despesa_id,
           d.descricao as despesa_descricao,
           f.nome as fornecedor,
           e.apelido as loja
    from extrato_lancamentos l
    join empresas e on e.id = l.empresa_id
    left join despesas d on d.id = l.despesa_id
    left join fornecedores f on f.id = d.fornecedor_id
    where ($1::uuid is null or l.empresa_id = $1::uuid)
      and l.data_contabil between $2::date and $3::date
      and l.operacao = 'D'
      and not l.estorno
    order by l.data_contabil, l.valor desc
  `, [empresa, de, ate])

  const sistema = await pool.query(`
    select d.id::text as id,
           d.descricao,
           d.valor::float8 as valor,
           to_char(d.vencimento, 'YYYY-MM-DD') as data,
           d.status,
           d.documento_ref,
           f.nome as fornecedor,
           f.cpf_cnpj,
           eo.apelido as loja,
           exists(
             select 1 from extrato_lancamentos x where x.despesa_id = d.id
           ) as ligada_extrato
    from despesas d
    join empresas eo on eo.id = d.empresa_origem_id
    left join fornecedores f on f.id = d.fornecedor_id
    where ($1::uuid is null or d.empresa_origem_id = $1::uuid)
      and d.status not in ('cancelada', 'faltou')
      and d.vencimento between $2::date and $3::date
      and ${inboxSql()}
    order by d.vencimento, d.valor desc
  `, [empresa, de, ate])

  const conciliados = []
  const abertosBanco = []
  for (const l of extrato.rows) {
    if (l.despesa_id || l.status === 'conciliado') {
      conciliados.push({
        tipo: 'conciliado',
        id: l.id,
        data: l.data,
        valor: l.valor,
        banco: l.historico,
        agenda: l.despesa_descricao || l.fornecedor || '—',
        status: 'conciliado',
        loja: l.loja || null,
      })
    } else if (l.status === 'sem_par' || pareceNaoTitulo(l, opts)) {
      conciliados.push({
        tipo: 'sem_par',
        id: l.id,
        data: l.data,
        valor: l.valor,
        banco: l.historico,
        agenda: 'Sem título (tarifa/aplicação/folha/transferência)',
        status: 'sem_par',
        loja: l.loja || null,
      })
    } else {
      abertosBanco.push({
        tipo: 'banco',
        id: l.id,
        data: l.data,
        valor: l.valor,
        banco: l.historico,
        agenda: null,
        status: l.status,
        loja: l.loja || null,
      })
    }
  }

  const ligadas = new Set(extrato.rows.map((l) => l.despesa_id).filter(Boolean))
  const abertosAgenda = sistema.rows
    .filter((d) => d.status !== 'conciliada' && !ligadas.has(d.id) && !d.ligada_extrato)
    .map((d) => ({
      tipo: 'agenda',
      id: d.id,
      data: d.data,
      valor: d.valor,
      banco: null,
      agenda: d.descricao || d.fornecedor || '—',
      status: d.status,
      loja: d.loja || null,
    }))

  return {
    de,
    ate,
    empresa_id: empresa,
    resumo: {
      conciliados: conciliados.filter((i) => i.tipo === 'conciliado').length,
      sem_par: conciliados.filter((i) => i.tipo === 'sem_par').length,
      abertos_banco: abertosBanco.length,
      abertos_agenda: abertosAgenda.length,
    },
    conciliados,
    abertos: [...abertosBanco, ...abertosAgenda].sort((a, b) => String(a.data).localeCompare(String(b.data)) || b.valor - a.valor),
  }
}
