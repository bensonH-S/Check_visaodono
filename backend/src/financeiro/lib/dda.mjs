import XLSX from 'xlsx'

function texto(valor) {
  return String(valor ?? '').replace(/\s+/g, ' ').trim()
}

function normalizar(valor) {
  return texto(valor).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function digitos(valor) {
  return texto(valor).replace(/\D/g, '')
}

function dataLocal(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

export function competenciaDe(iso) {
  const [ano, mes, dia] = iso.split('-').map(Number)
  const data = new Date(ano, mes - 1, dia)
  data.setDate(data.getDate() - ((data.getDay() + 1) % 7))
  return dataLocal(data)
}

function dataIso(valor) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return dataLocal(new Date(valor.getFullYear(), valor.getMonth(), valor.getDate()))
  }
  if (typeof valor === 'number' && valor > 20000 && valor < 80000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000)
    return utc.toISOString().slice(0, 10)
  }
  const bruto = texto(valor)
  const br = bruto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  const iso = bruto.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  return ''
}

function valorNumero(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return Math.round(valor * 100) / 100
  const bruto = texto(valor)
  if (!bruto) return null
  const limpo = bruto.replace(/[R$\s]/g, '')
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo
  const numero = Number(normal)
  if (!Number.isFinite(numero) || numero < 0) return null
  return Math.round(numero * 100) / 100
}

const REGRAS = [
  ['cnpj_sacado', /(cnpj|cpf).*(pagador|sacado)|(pagador|sacado).*(cnpj|cpf)/],
  ['cnpj_cedente', /(cnpj|cpf).*(benefici|cedente|favorecido)|(benefici|cedente|favorecido).*(cnpj|cpf)/],
  ['sacado', /\b(pagador|sacado)\b/],
  ['cedente', /\b(beneficiario|cedente|favorecido)\b/],
  ['vencimento', /^venc$|vencimento/],
  ['valor', /^a pagar$|^valor( do (titulo|boleto|documento|nominal))?$/],
  ['codigo', /linha digitavel|codigo de barras|cod(igo)? barras/],
  ['situacao', /situacao|status/],
  ['documento', /^n doc$|seu numero|numero do documento|^documento$|^nf$/],
]

function rotulo(valor) {
  return normalizar(valor).replace(/[^a-z0-9]+/g, ' ').trim()
}

function contaDoArquivo(grade) {
  const textoGrade = grade.slice(0, 15).map((celulas) => (Array.isArray(celulas) ? texto(celulas[0]) : '')).join('\n')
  const cnpj = textoGrade.match(/CPF\/CNPJ:\s*([0-9./-]+)/i)
  const nome = textoGrade.match(/Nome da empresa:\s*(.+)/i)
  return {
    cnpj_sacado: cnpj ? digitos(cnpj[1]) : '',
    sacado: nome ? nome[1].trim() : '',
  }
}

function mapaColunas(cabecalho) {
  const mapa = {}
  const nomes = cabecalho.map((celula) => rotulo(celula))
  nomes.forEach((nome, indice) => {
    if (!nome || Object.values(mapa).includes(indice)) return
    const regra = REGRAS.find(([campo, regex]) => !(campo in mapa) && regex.test(nome))
    if (regra) mapa[regra[0]] = indice
  })
  const cnpjs = nomes
    .map((nome, indice) => ({ nome, indice }))
    .filter((item) => /^(cpf|cnpj|cpf cnpj)$/.test(item.nome) && !Object.values(mapa).includes(item.indice))
  for (const item of cnpjs) {
    const anterior = nomes[item.indice - 1] || ''
    if (!('cnpj_cedente' in mapa) && /benefici|cedente|favorecido/.test(anterior)) mapa.cnpj_cedente = item.indice
    else if (!('cnpj_sacado' in mapa) && /pagador|sacado/.test(anterior)) mapa.cnpj_sacado = item.indice
    else if (!('cnpj_cedente' in mapa)) mapa.cnpj_cedente = item.indice
    else if (!('cnpj_sacado' in mapa)) mapa.cnpj_sacado = item.indice
  }
  return mapa
}

function linhaDe(celulas, mapa) {
  const pegar = (campo) => (campo in mapa ? celulas[mapa[campo]] : '')
  const vencimento = dataIso(pegar('vencimento'))
  const valor = valorNumero(pegar('valor'))
  const codigo = texto(pegar('codigo'))
  const cedente = texto(pegar('cedente'))
  const sacado = texto(pegar('sacado'))
  if (!vencimento && valor == null && !cedente && !sacado && !codigo) return null
  return {
    cedente,
    cnpj_cedente: digitos(pegar('cnpj_cedente')),
    sacado,
    cnpj_sacado: digitos(pegar('cnpj_sacado')),
    vencimento,
    valor,
    codigo,
    situacao: texto(pegar('situacao')),
    documento: texto(pegar('documento')),
  }
}

function campo(linha, inicio, fim) {
  return linha.slice(inicio - 1, fim)
}

function dataDdmmaaaa(valor) {
  const bruto = digitos(valor)
  if (bruto.length !== 8 || bruto === '00000000' || bruto === '11111111' || bruto === '99999999') return ''
  const dia = Number(bruto.slice(0, 2))
  const mes = Number(bruto.slice(2, 4))
  const ano = bruto.slice(4, 8)
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return ''
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function documentoPessoa(tipo, numero) {
  const bruto = digitos(numero)
  if (!bruto || /^0+$/.test(bruto)) return ''
  if (tipo === '1') return bruto.slice(-11).padStart(11, '0')
  if (tipo === '2') return bruto.slice(-14).padStart(14, '0')
  const semZero = bruto.replace(/^0+/, '')
  if (semZero.length <= 11) return semZero.padStart(11, '0')
  return semZero.slice(-14).padStart(14, '0')
}

function valorInteiro(valor, decimais) {
  const bruto = digitos(valor)
  if (!bruto || /^0+$/.test(bruto)) return null
  const numero = Number(bruto) / 10 ** decimais
  if (!Number.isFinite(numero)) return null
  return Math.round(numero * 100) / 100
}

function registrosCnab(buffer) {
  const textoArquivo = buffer.toString('latin1').replace(/^\uFEFF/, '')
  const linhas = textoArquivo.split(/\r?\n/).map((linha) => linha.replace(/\r$/, '')).filter((linha) => linha.trim() !== '')
  if (linhas.length === 1 && linhas[0].length >= 480 && linhas[0].length % 240 === 0) {
    const blocos = []
    for (let i = 0; i < linhas[0].length; i += 240) blocos.push(linhas[0].slice(i, i + 240))
    return blocos
  }
  return linhas.filter((linha) => linha.length >= 240).map((linha) => linha.slice(0, 240))
}

function situacaoMovimento(codigo) {
  if (codigo === '01') return 'A pagar'
  if (codigo === '02' || codigo === '10' || codigo === '46') return 'Baixado'
  if (codigo === '06') return 'Vencimento alterado'
  return codigo ? `Movimento ${codigo}` : ''
}

function empresaDoLote(linha) {
  return {
    cnpj_sacado: documentoPessoa(campo(linha, 18, 18), campo(linha, 19, 33)),
    sacado: texto(campo(linha, 74, 103)),
  }
}

function empresaDoArquivo(linha) {
  return {
    cnpj_sacado: documentoPessoa(campo(linha, 18, 18), campo(linha, 19, 32)),
    sacado: texto(campo(linha, 73, 102)),
  }
}

function tituloDoSegmentoG(linha, empresa) {
  const barras = campo(linha, 18, 61).trim()
  const nominal = valorInteiro(campo(linha, 116, 130), 2)
  const impresso = valorInteiro(campo(linha, 27, 36), 2)
  return {
    cedente: texto(campo(linha, 78, 107)),
    cnpj_cedente: documentoPessoa(campo(linha, 62, 62), campo(linha, 63, 77)),
    sacado: empresa.sacado,
    cnpj_sacado: empresa.cnpj_sacado,
    vencimento: dataDdmmaaaa(campo(linha, 108, 115)),
    valor: nominal ?? impresso,
    codigo: digitos(barras).length >= 44 ? digitos(barras) : barras,
    situacao: situacaoMovimento(campo(linha, 16, 17)),
    documento: texto(campo(linha, 148, 162)),
  }
}

export function lerCnab240(buffer) {
  const registros = registrosCnab(buffer)
  if (!registros.length || registros[0][7] !== '0') {
    throw new Error('Arquivo CNAB 240 inválido.')
  }
  let empresa = empresaDoArquivo(registros[0])
  const linhas = []
  for (const registro of registros) {
    const tipo = registro[7]
    if (tipo === '1') empresa = empresaDoLote(registro)
    if (tipo === '3' && registro[13] === 'G') linhas.push(tituloDoSegmentoG(registro, empresa))
  }
  if (!linhas.length) {
    throw new Error('CNAB sem boleto de DDA. O retorno do Itaú traz o título no segmento G.')
  }
  return linhas
}

function ehCnab240(buffer) {
  const registros = registrosCnab(buffer)
  return registros.length > 0 && registros[0].length >= 240 && registros[0][7] === '0' && /^\d{3}/.test(registros[0].slice(0, 3))
}

export function lerArquivoDda(buffer) {
  if (ehCnab240(buffer)) return lerCnab240(buffer)
  return lerPlanilha(buffer)
}

export function lerPlanilha(buffer) {
  const livro = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const linhas = []
  for (const nome of livro.SheetNames) {
    const grade = XLSX.utils.sheet_to_json(livro.Sheets[nome], { header: 1, raw: true, defval: '' })
    const conta = contaDoArquivo(grade)
    let mapa = null
    for (const celulas of grade) {
      if (!Array.isArray(celulas) || celulas.every((item) => texto(item) === '')) continue
      if (!mapa) {
        const candidato = mapaColunas(celulas)
        if ('vencimento' in candidato && 'valor' in candidato) {
          mapa = candidato
          continue
        }
      }
      if (!mapa) continue
      const linha = linhaDe(celulas, mapa)
      if (!linha) continue
      if (!linha.cnpj_sacado && conta.cnpj_sacado) linha.cnpj_sacado = conta.cnpj_sacado
      if (!linha.sacado && conta.sacado) linha.sacado = conta.sacado
      linhas.push(linha)
    }
    if (linhas.length) break
  }
  if (!linhas.length) {
    throw new Error('Não achei vencimento e valor nessa planilha. Use a exportação de DDA do banco.')
  }
  return linhas
}

function chaveDocumento(linha) {
  const codigo = digitos(linha.codigo)
  if (codigo.length >= 44) return codigo
  if (linha.documento && linha.documento.length <= 40) return linha.documento
  return `DDA|${linha.cnpj_sacado}|${linha.cnpj_cedente}|${linha.vencimento}|${linha.valor}`
}

function pago(situacao) {
  const nome = normalizar(situacao)
  if (!nome) return false
  return /pago|liquid|baixad|cancel/.test(nome)
}

function acharEmpresa(linha, empresas) {
  const cnpj = linha.cnpj_sacado
  if (cnpj) {
    const porCnpj = empresas.find((empresa) => digitos(empresa.cnpj) === cnpj)
    if (porCnpj) return porCnpj
  }
  const nome = normalizar(linha.sacado)
  if (!nome) return null
  return empresas.find((empresa) => {
    const apelido = normalizar(empresa.apelido)
    const razao = normalizar(empresa.razao_social)
    return nome === apelido || nome === razao || (apelido && nome.includes(apelido)) || (razao && nome.includes(razao))
  }) || null
}

function primeiroNome(valor) {
  return normalizar(valor).split(' ').filter(Boolean)[0] || ''
}

export function descricaoDda(linha) {
  const nome = texto(linha.fornecedor || linha.cedente || linha.descricao)
  if (nome) return nome.slice(0, 200)
  const nf = texto(linha.documento || linha.numero_nf)
  if (nf) return `NF ${nf}`.slice(0, 200)
  return 'Boleto DDA'
}

export function acharFornecedor(linha, fornecedores) {
  const cnpj = digitos(linha.cnpj_cedente)
  const raiz = cnpj.slice(0, 8)
  if (cnpj) {
    const porCnpj = fornecedores.find((fornecedor) => digitos(fornecedor.cpf_cnpj) === cnpj)
    if (porCnpj) return porCnpj
    if (raiz.length === 8) {
      const porRaiz = fornecedores.filter((fornecedor) => digitos(fornecedor.cpf_cnpj).slice(0, 8) === raiz)
      const comPlano = porRaiz.find((fornecedor) => fornecedor.plano_conta_id)
      if (comPlano || porRaiz[0]) return comPlano || porRaiz[0]
    }
  }
  const nome = normalizar(linha.cedente || linha.descricao)
  const exato = fornecedores.find((fornecedor) => normalizar(fornecedor.nome) === nome)
  if (exato) return exato
  const token = primeiroNome(nome)
  if (token.length < 5) return null
  const parecidos = fornecedores.filter((fornecedor) => primeiroNome(fornecedor.nome) === token)
  return parecidos.find((fornecedor) => fornecedor.plano_conta_id) || parecidos[0] || null
}

export function classificar(linhas, { empresas, fornecedores, existentes }) {
  const vistos = new Set(existentes)
  return linhas.map((linha) => {
    const empresa = acharEmpresa(linha, empresas)
    const fornecedor = acharFornecedor(linha, fornecedores)
    const documento = chaveDocumento(linha)
    let motivo = ''
    if (pago(linha.situacao)) motivo = 'Pago ou baixado'
    else if (linha.valor == null || !linha.vencimento) motivo = 'Sem valor ou vencimento'
    else if (!empresa) motivo = 'Empresa não encontrada'
    else if (vistos.has(`${empresa.id}|${documento}`)) motivo = 'Já lançado'
    const pronto = !motivo
    if (pronto) vistos.add(`${empresa.id}|${documento}`)
    return {
      ...linha,
      documento_ref: documento,
      competencia: linha.vencimento ? competenciaDe(linha.vencimento) : '',
      empresa_id: empresa?.id || null,
      empresa: empresa?.apelido || '',
      fornecedor_id: fornecedor?.id || null,
      fornecedor: fornecedor?.nome || '',
      plano_conta_id: fornecedor?.plano_conta_id || null,
      plano: fornecedor?.plano || '',
      pronto,
      motivo,
    }
  })
}
