const texto = (v) => String(v ?? '').trim() || null
const digitos = (v) => String(v ?? '').replace(/\D/g, '') || null

function falha(status, mensagem) {
  return Object.assign(new Error(mensagem), { status })
}

const CADASTROS = {
  fornecedores: {
    tabela: 'fornecedores',
    ativo: 'ativo',
    usos: [['despesas', 'fornecedor_id'], ['fornecedor_pagamentos', 'fornecedor_id']],
    montar(body) {
      const doc = digitos(body.cpf_cnpj)
      if (doc && doc.length !== 11 && doc.length !== 14) throw falha(400, 'CPF ou CNPJ incompleto.')
      const linha = {
        nome: texto(body.nome),
        razao_social: texto(body.razao_social),
        cpf_cnpj: doc,
        tipo_pessoa: doc ? (doc.length === 11 ? 'cpf' : 'cnpj') : null,
        plano_conta_id: texto(body.plano_conta_id),
        logradouro: texto(body.logradouro),
        numero: texto(body.numero),
        bairro: texto(body.bairro),
        cidade: texto(body.cidade),
        estado: texto(body.estado)?.toUpperCase().slice(0, 2) || null,
        cep: digitos(body.cep),
        ativo: body.ativo !== false,
      }
      if (!linha.nome) throw falha(400, 'Informe o nome do fornecedor.')
      return linha
    },
    duplicado: 'Já existe um fornecedor com esse CPF ou CNPJ.',
  },
  empresas: {
    tabela: 'empresas',
    ativo: 'ativo',
    usos: [['contas_bancarias', 'empresa_id'], ['despesas', 'empresa_origem_id'], ['despesas', 'empresa_registro_id'], ['vendas_bk', 'empresa_id']],
    montar(body) {
      const cnpj = digitos(body.cnpj)
      if (cnpj && cnpj.length !== 14) throw falha(400, 'CNPJ incompleto.')
      const linha = {
        apelido: texto(body.apelido),
        razao_social: texto(body.razao_social),
        cnpj,
        bk_number: texto(body.bk_number),
        inscricao_estadual: texto(body.inscricao_estadual),
        endereco: texto(body.endereco),
        cidade: texto(body.cidade),
        cep: digitos(body.cep),
        tipo: body.tipo === 'holding' ? 'holding' : 'loja',
        ativo: body.ativo !== false,
      }
      if (!linha.razao_social) throw falha(400, 'Informe a razão social.')
      return linha
    },
    duplicado: 'Já existe uma empresa com esse CNPJ ou número BK.',
  },
  contas: {
    tabela: 'contas_bancarias',
    ativo: 'ativa',
    usos: [['despesas', 'conta_saida_id']],
    montar(body) {
      const tipo = body.tipo === 'dinheiro' ? 'dinheiro' : 'corrente'
      const linha = {
        empresa_id: texto(body.empresa_id),
        nome: texto(body.nome),
        tipo,
        banco: tipo === 'corrente' ? (body.banco === 'banco_do_brasil' ? 'banco_do_brasil' : body.banco === 'itau' ? 'itau' : null) : null,
        agencia: tipo === 'corrente' ? texto(body.agencia) : null,
        numero: tipo === 'corrente' ? texto(body.numero) : null,
        digito: tipo === 'corrente' ? texto(body.digito) : null,
        ativa: body.ativa !== false,
      }
      if (!linha.empresa_id) throw falha(400, 'Escolha a empresa da conta.')
      if (!linha.nome) throw falha(400, 'Informe o nome da conta.')
      if (tipo === 'corrente' && (!linha.banco || !linha.agencia || !linha.numero)) throw falha(400, 'Conta corrente precisa de banco, agência e número.')
      return linha
    },
    duplicado: 'Essa agência e conta já estão cadastradas nesse banco.',
  },
}

export function cadastroDe(tipo) {
  const cadastro = CADASTROS[tipo]
  if (!cadastro) throw falha(404, 'Cadastro desconhecido.')
  return cadastro
}

export async function salvarCadastro(pool, tipo, id, body) {
  const cadastro = cadastroDe(tipo)
  const linha = cadastro.montar(body || {})
  const colunas = Object.keys(linha)
  const valores = Object.values(linha)
  try {
    const { rows } = id
      ? await pool.query(
          `update ${cadastro.tabela} set ${colunas.map((c, i) => `${c} = $${i + 1}`).join(', ')} where id = $${colunas.length + 1} returning id`,
          [...valores, id],
        )
      : await pool.query(
          `insert into ${cadastro.tabela} (${colunas.join(', ')}) values (${colunas.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
          valores,
        )
    if (!rows.length) throw falha(404, 'Registro não encontrado.')
    return rows[0]
  } catch (err) {
    if (err.code === '23505') throw falha(409, cadastro.duplicado)
    if (err.code === '23503') throw falha(400, 'Referência inválida.')
    throw err
  }
}

export async function removerCadastro(pool, tipo, id) {
  const cadastro = cadastroDe(tipo)
  const soma = cadastro.usos.map(([tabela, coluna]) => `(select count(*) from ${tabela} where ${coluna} = $1)`).join(' + ')
  const { rows } = await pool.query(`select ${soma} as total`, [id])
  if (Number(rows[0].total) > 0) {
    await pool.query(`update ${cadastro.tabela} set ${cadastro.ativo} = false where id = $1`, [id])
    return { id, inativado: true }
  }
  await pool.query(`delete from ${cadastro.tabela} where id = $1`, [id])
  return { id, apagado: true }
}

export async function usoDe(pool, tipo, ids) {
  const cadastro = cadastroDe(tipo)
  if (!ids.length) return {}
  const partes = cadastro.usos.map(([tabela, coluna]) => `select ${coluna} as id, count(*)::int as n from ${tabela} where ${coluna} = any($1) group by 1`)
  const { rows } = await pool.query(`select id, sum(n)::int as uso from (${partes.join(' union all ')}) x group by id`, [ids])
  return Object.fromEntries(rows.map((r) => [r.id, r.uso]))
}
