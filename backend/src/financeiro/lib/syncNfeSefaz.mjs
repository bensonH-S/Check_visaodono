/**
 * Puxa NF-e destinadas a cada CNPJ (Receita / Ambiente Nacional)
 * e entrega no inbox financeiro e no gestor de notas (estoque_nfe).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { pool as appPool } from '../../db.js'
import { persistirEstoqueNfe } from '../../services/estoquePersistirNfe.js'
import { casarItensNfe, parseNfeXml } from '../../services/nfeXml.js'
import { cnpjsDosCertificados, garantirSchemaBb, tlsDaCredencial } from './bbDda.mjs'
import { cruzarDdaComNotas, escolherDdaParaNota } from './cruzarDdaNfe.mjs'
import { acharFornecedor, competenciaDe } from './dda.mjs'
import { gerarDanfe } from './danfe.mjs'
import {
  consultarDistribuicao,
  consultarPorChave,
  cUfDe,
  interpretarDocumento,
  manifestarCiencia,
  notaDeEntrada,
  nsu15,
} from './sefazDfe.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(aqui, '..', 'db', '012_sefaz_dfe.sql')
const pastaXml = path.join(aqui, '..', '..', '..', '..', 'Logs', 'sefaz-nfe')

const MAX_PAGINAS = 40
const ESPERA_MS = 60 * 60 * 1000
const PAUSA_ENTRE_LOJAS_MS = 2000

let constraintPronta = false

function digitos(valor) {
  return String(valor ?? '').replace(/\D/g, '')
}

function recenteParaGestor(emissao) {
  if (!emissao) return true
  const data = new Date(`${String(emissao).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(data.getTime())) return true
  const corte = new Date()
  corte.setDate(corte.getDate() - 30)
  corte.setHours(0, 0, 0, 0)
  return data >= corte
}

function recente(iso) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < ESPERA_MS
}

export async function garantirSchemaSefaz(financePool) {
  await financePool.query(fs.readFileSync(schemaPath, 'utf8'))
}

async function garantirCancelada() {
  if (constraintPronta) return
  const { rows } = await appPool.query(
    `SELECT pg_get_constraintdef(oid) AS def
     FROM pg_constraint
     WHERE conname = 'chk_estoque_nfe_status_entrega'`,
  )
  const def = rows[0]?.def || ''
  if (!def.includes('cancelada')) {
    await appPool.query('ALTER TABLE estoque_nfe DROP CONSTRAINT IF EXISTS chk_estoque_nfe_status_entrega')
    await appPool.query(`
      ALTER TABLE estoque_nfe
      ADD CONSTRAINT chk_estoque_nfe_status_entrega
      CHECK (status_entrega IN (
        'aguardando_portal',
        'em_transito',
        'aguardando_conferencia',
        'conferida',
        'divergente',
        'cancelada'
      ))
    `)
  }
  constraintPronta = true
}

async function lojasPorCnpj() {
  const { rows } = await appPool.query(`
    SELECT id_loja, bk_number, state, name,
           regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') AS cnpj
    FROM lojas
  `)
  return rows
}

function acharLoja(lojas, cnpj, bk) {
  const hits = lojas.filter((loja) => loja.cnpj && loja.cnpj === cnpj)
  if (bk) {
    const porBk = hits.find((loja) => String(loja.bk_number || '') === String(bk))
    if (porBk) return porBk
  }
  return hits[0] || null
}

async function cursorDe(financePool, cnpj) {
  const { rows } = await financePool.query(
    'SELECT ult_nsu, max_nsu, consultado_em, ultimo_cstat FROM sefaz_dfe_cursor WHERE cnpj = $1',
    [cnpj],
  )
  return rows[0] || null
}

async function salvarCursor(financePool, cnpj, { ultNSU, maxNSU, cStat, erro }) {
  await financePool.query(
    `INSERT INTO sefaz_dfe_cursor (cnpj, ult_nsu, max_nsu, consultado_em, ultimo_cstat, ultimo_erro)
     VALUES ($1, $2, $3, now(), $4, $5)
     ON CONFLICT (cnpj) DO UPDATE SET
       ult_nsu = excluded.ult_nsu,
       max_nsu = excluded.max_nsu,
       consultado_em = now(),
       ultimo_cstat = excluded.ultimo_cstat,
       ultimo_erro = excluded.ultimo_erro`,
    [cnpj, nsu15(ultNSU), maxNSU ? nsu15(maxNSU) : null, cStat || null, erro || null],
  )
}

async function gravarFinance(financePool, nota) {
  const { rows } = await financePool.query(
    `INSERT INTO nfe_recebida (
       empresa_id, cnpj_empresa, chave, numero, serie, emissao,
       emitente_cnpj, emitente_nome, valor_total, situacao, tem_xml, nsu, xml
     ) VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (cnpj_empresa, chave) DO UPDATE SET
       numero = COALESCE(excluded.numero, nfe_recebida.numero),
       serie = COALESCE(excluded.serie, nfe_recebida.serie),
       emissao = COALESCE(excluded.emissao, nfe_recebida.emissao),
       emitente_cnpj = COALESCE(NULLIF(excluded.emitente_cnpj, ''), nfe_recebida.emitente_cnpj),
       emitente_nome = COALESCE(NULLIF(excluded.emitente_nome, ''), nfe_recebida.emitente_nome),
       valor_total = COALESCE(excluded.valor_total, nfe_recebida.valor_total),
       situacao = CASE
         WHEN nfe_recebida.situacao = 'cancelada' OR excluded.situacao = 'cancelada' THEN 'cancelada'
         ELSE excluded.situacao
       END,
       tem_xml = nfe_recebida.tem_xml OR excluded.tem_xml,
       nsu = COALESCE(excluded.nsu, nfe_recebida.nsu),
       xml = COALESCE(excluded.xml, nfe_recebida.xml),
       atualizado_em = now()
     RETURNING (criado_em = atualizado_em) AS inserida`,
    [
      nota.empresa_id,
      nota.cnpj_empresa,
      nota.chave,
      nota.numero || null,
      nota.serie || null,
      nota.emissao || null,
      nota.emitente_cnpj || null,
      nota.emitente_nome || null,
      nota.valor_total,
      nota.situacao || 'autorizada',
      nota.tem_xml === true,
      nota.nsu || null,
      nota.xml || null,
    ],
  )
  return rows[0]?.inserida === true
}

async function marcarCancelada(financePool, cnpj, chave) {
  await financePool.query(
    `UPDATE nfe_recebida
     SET situacao = 'cancelada', atualizado_em = now()
     WHERE cnpj_empresa = $1 AND chave = $2`,
    [cnpj, chave],
  )
  await garantirCancelada()
  await appPool.query(
    `UPDATE estoque_nfe
     SET status_entrega = 'cancelada',
         status_portal = 'Cancelada na Receita',
         atualizado_em = NOW()
     WHERE chave = $1`,
    [chave],
  )
}

async function gravarItensNaNota({ idNfe, idLoja, doc, xml }) {
  const dir = path.join(pastaXml, String(idLoja))
  fs.mkdirSync(dir, { recursive: true })
  const arquivo = path.join(dir, `${doc.chave}.xml`)
  fs.writeFileSync(arquivo, xml, 'utf8')
  const nfe = doc.nfe
  const { rows: insumos } = await appPool.query(
    `SELECT id_insumo, codigo, descricao, und_convertida, und_parcial, unidade_contagem
     FROM insumos WHERE id_loja = $1 AND ativo = TRUE`,
    [idLoja],
  )
  const linhas = casarItensNfe(nfe.itens || [], insumos)
  await appPool.query(
    `UPDATE estoque_nfe SET
       xml_path = $2,
       numero = COALESCE($3, numero),
       serie = COALESCE($4, serie),
       emissao = COALESCE($5::date, emissao),
       emitente_cnpj = COALESCE(NULLIF($6, ''), emitente_cnpj),
       emitente_nome = COALESCE(NULLIF($7, ''), emitente_nome),
       valor_total = COALESCE($8, valor_total),
       data_vencimento = COALESCE($9::date, data_vencimento),
       status_portal = 'Recebida na Receita Federal',
       atualizado_em = NOW()
     WHERE id_nfe = $1`,
    [
      idNfe,
      arquivo,
      nfe.numero || null,
      nfe.serie || null,
      nfe.emissao || null,
      nfe.emitente?.cnpj || doc.emitente_cnpj || '',
      nfe.emitente?.nome || doc.emitente_nome || '',
      nfe.valor_total ?? null,
      nfe.data_vencimento || null,
    ],
  )
  await appPool.query('DELETE FROM estoque_nfe_itens WHERE id_nfe = $1', [idNfe])
  for (const ln of linhas) {
    await appPool.query(
      `INSERT INTO estoque_nfe_itens (
         id_nfe, n_item, codigo_nf, ean, descricao, u_com, q_com, v_un_com, v_prod,
         id_insumo, match_tipo, preco_caixa_aplicado, qtd_estoque
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        idNfe,
        ln.nItem,
        ln.codigo,
        ln.ean || null,
        ln.descricao,
        ln.uCom,
        ln.qCom,
        ln.vUnCom,
        ln.vProd,
        ln.match?.id_insumo || null,
        ln.match_tipo,
        ln.match ? ln.sugerido.preco_caixa : null,
        ln.match ? ln.sugerido.qtd_estoque : null,
      ],
    )
  }
  return linhas.length
}

/**
 * Conferência da loja = mesmo fluxo do fornecedor: só entra nota com XML completo e produtos.
 * Resumo da Receita fica só no inbox financeiro até o XML chegar.
 */
async function gravarNoGestor({ idLoja, doc, xml }) {
  if (!idLoja || !doc.chave) return false
  if (doc.situacao === 'cancelada' || doc.situacao === 'denegada') return false
  if (doc.tipo !== 'completa' || !doc.nfe) return false
  const { rows } = await appPool.query(
    `SELECT id_nfe, entrada_registrada,
            (SELECT COUNT(*)::int FROM estoque_nfe_itens i WHERE i.id_nfe = estoque_nfe.id_nfe) AS itens
     FROM estoque_nfe
     WHERE id_loja = $1 AND chave = $2
     ORDER BY CASE WHEN lower(fornecedor) = 'sefaz' THEN 0 ELSE 1 END, id_nfe DESC
     LIMIT 1`,
    [idLoja, doc.chave],
  )
  const atual = rows[0]
  if (atual?.entrada_registrada) return false
  if (atual) {
    if (Number(atual.itens || 0) > 0) return false
    await gravarItensNaNota({ idNfe: atual.id_nfe, idLoja, doc, xml })
    return true
  }
  const dir = path.join(pastaXml, String(idLoja))
  fs.mkdirSync(dir, { recursive: true })
  const arquivo = path.join(dir, `${doc.chave}.xml`)
  fs.writeFileSync(arquivo, xml, 'utf8')
  const { rows: insumos } = await appPool.query(
    `SELECT id_insumo, codigo, descricao, und_convertida, und_parcial, unidade_contagem
     FROM insumos WHERE id_loja = $1 AND ativo = TRUE`,
    [idLoja],
  )
  const r = await persistirEstoqueNfe({
    idLoja,
    fornecedor: 'sefaz',
    nfe: doc.nfe,
    arquivoPath: arquivo,
    statusPortal: 'Recebida na Receita Federal',
    aplicar: true,
    registrarEntrada: false,
    insumos,
  })
  if (!r.ok) throw new Error(r.erro || 'Não gravou a nota no gestor.')
  return r.aplicado === true
}

async function aplicarDocumento(financePool, empresa, loja, doc, xml) {
  if (doc.tipo === 'cancelamento') {
    if (!doc.chave) return false
    await marcarCancelada(financePool, empresa.cnpj, doc.chave)
    return false
  }
  if (!notaDeEntrada(doc, empresa.cnpj) || !doc.chave) return false
  const nova = await gravarFinance(financePool, {
    empresa_id: empresa.empresa_id,
    cnpj_empresa: empresa.cnpj,
    chave: doc.chave,
    numero: doc.numero,
    serie: doc.serie,
    emissao: doc.emissao,
    emitente_cnpj: doc.emitente_cnpj,
    emitente_nome: doc.emitente_nome,
    valor_total: doc.valor_total,
    situacao: doc.situacao || 'autorizada',
    tem_xml: doc.tipo === 'completa',
    nsu: doc.nsu,
    xml: doc.tipo === 'completa' ? xml : null,
  })
  if (loja && doc.situacao !== 'cancelada' && doc.situacao !== 'denegada' && recenteParaGestor(doc.emissao)) {
    await gravarNoGestor({ idLoja: loja.id_loja, doc, xml })
  }
  return nova
}

async function empresasComCertificado(financePool) {
  await garantirSchemaBb(financePool)
  const { rows } = await financePool.query(`
    SELECT e.id AS empresa_id, e.apelido, e.razao_social, e.cnpj, e.bk_number,
           COALESCE(c.cert_pem, '') AS cert_pem,
           COALESCE(c.key_pem, '') AS key_pem,
           COALESCE(c.pfx, '') AS pfx,
           COALESCE(c.cert_pass, '') AS cert_pass
    FROM empresas e
    LEFT JOIN bb_credenciais c ON c.empresa_id = e.id AND c.ativo IS NOT FALSE
    WHERE e.ativo AND e.cnpj IS NOT NULL AND btrim(e.cnpj) <> ''
    ORDER BY e.apelido
  `)
  const porCnpj = new Map()
  for (const linha of rows) {
    const cnpj = digitos(linha.cnpj)
    if (cnpj.length !== 14 || porCnpj.has(cnpj)) continue
    porCnpj.set(cnpj, {
      empresa_id: linha.empresa_id,
      empresa: linha.apelido || linha.razao_social,
      cnpj,
      bk_number: linha.bk_number,
      tls: tlsDaCredencial({
        cnpj: linha.cnpj,
        cert_pem: linha.cert_pem,
        key_pem: linha.key_pem,
        pfx: linha.pfx,
        cert_pass: linha.cert_pass,
      }),
    })
  }
  for (const cnpj of cnpjsDosCertificados()) {
    const atual = porCnpj.get(cnpj)
    if (atual) {
      if (!atual.tls) atual.tls = tlsDaCredencial({ cnpj })
      continue
    }
    const tls = tlsDaCredencial({ cnpj })
    if (!tls) continue
    porCnpj.set(cnpj, {
      empresa_id: null,
      empresa: cnpj,
      cnpj,
      bk_number: null,
      tls,
    })
  }
  return [...porCnpj.values()]
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function coletarEmpresa(financePool, empresa, lojas, ambiente) {
  const loja = acharLoja(lojas, empresa.cnpj, empresa.bk_number)
  const cursor = await cursorDe(financePool, empresa.cnpj)
  if (cursor?.ultimo_cstat === '656' && recente(cursor.consultado_em)) {
    return { novas: 0, pulada: true, espera: true, empresa: empresa.empresa }
  }
  if (cursor && cursor.ult_nsu && cursor.max_nsu && cursor.ult_nsu === cursor.max_nsu && recente(cursor.consultado_em)) {
    return { novas: 0, pulada: true, empresa: empresa.empresa }
  }
  let ultNSU = nsu15(cursor?.ult_nsu)
  let novas = 0
  let paginas = 0
  await esperar(PAUSA_ENTRE_LOJAS_MS)
  while (paginas < MAX_PAGINAS) {
    paginas += 1
    console.log(`[sefaz] ${empresa.empresa} página ${paginas} a partir do NSU ${ultNSU}`)
    const ret = await consultarDistribuicao(empresa.tls, {
      cnpj: empresa.cnpj,
      cUF: cUfDe(loja?.state),
      ultNSU,
      ambiente,
    })
    console.log(`[sefaz] ${empresa.empresa} cStat ${ret.cStat} ${ret.documentos.length} documento(s) NSU ${ret.ultNSU}/${ret.maxNSU} ${ret.xMotivo || ''}`)
    if (ret.cStat === '656') {
      const proximo = ret.ultNSU && ret.ultNSU !== '000000000000000' ? ret.ultNSU : ultNSU
      await salvarCursor(financePool, empresa.cnpj, {
        ultNSU: proximo,
        maxNSU: cursor?.max_nsu && cursor.max_nsu !== '000000000000000' ? cursor.max_nsu : null,
        cStat: ret.cStat,
        erro: ret.xMotivo || 'Consulta em excesso. A Receita pede para esperar cerca de uma hora.',
      })
      throw new Error(ret.xMotivo || 'A Receita pediu para esperar antes de consultar de novo.')
    }
    if (ret.cStat !== '138' && ret.cStat !== '137') {
      await salvarCursor(financePool, empresa.cnpj, {
        ultNSU,
        maxNSU: cursor?.max_nsu,
        cStat: ret.cStat,
        erro: ret.xMotivo || `Status ${ret.cStat}`,
      })
      throw new Error(ret.xMotivo || `A Receita devolveu o status ${ret.cStat}.`)
    }
    for (const doc of ret.documentos) {
      const entrou = await aplicarDocumento(financePool, empresa, loja, doc, doc.xml)
      if (entrou) novas += 1
    }
    await salvarCursor(financePool, empresa.cnpj, {
      ultNSU: ret.ultNSU,
      maxNSU: ret.maxNSU,
      cStat: ret.cStat,
      erro: null,
    })
    if (ret.cStat === '137' || ret.ultNSU === ultNSU || ret.ultNSU === ret.maxNSU) break
    ultNSU = ret.ultNSU
  }
  return { novas, pulada: false, empresa: empresa.empresa, semLoja: !loja }
}

export async function coletarNotasReceita(financePool, { ambiente, cnpj } = {}) {
  await garantirSchemaSefaz(financePool)
  agendarCienciasPendentes(financePool)
  const amb = ambiente || (process.env.SEFAZ_DFE_AMBIENTE === 'homologacao' ? 'homologacao' : 'producao')
  const empresas = await empresasComCertificado(financePool)
  const alvo = digitos(cnpj)
  let comCert = empresas.filter((empresa) => empresa.tls && empresa.cnpj.length === 14)
  if (alvo) comCert = comCert.filter((empresa) => empresa.cnpj === alvo)
  if (!comCert.length && alvo) {
    const tls = tlsDaCredencial({ cnpj: alvo })
    if (tls) {
      comCert = [{
        empresa_id: null,
        empresa: `CNPJ ${alvo}`,
        cnpj: alvo,
        bk_number: null,
        tls,
      }]
    }
  }
  if (!comCert.length) {
    return {
      ok: false,
      novas: 0,
      mensagem: 'Nenhuma empresa com certificado A1. O mesmo certificado do DDA do Banco do Brasil serve para a Receita.',
    }
  }
  const lojas = await lojasPorCnpj()
  for (const empresa of comCert) {
    const loja = acharLoja(lojas, empresa.cnpj, empresa.bk_number)
    if (loja?.name && empresa.empresa === empresa.cnpj) empresa.empresa = loja.name
    if (loja?.bk_number && !empresa.bk_number) empresa.bk_number = loja.bk_number
  }
  console.log(`[sefaz] ${comCert.length} certificado(s)`)
  let novas = 0
  let falhas = 0
  let puladas = 0
  let esperas = 0
  let semLoja = 0
  let ultimoErro = ''
  for (const empresa of comCert) {
    try {
      const r = await coletarEmpresa(financePool, empresa, lojas, amb)
      novas += r.novas
      if (r.espera) esperas += 1
      else if (r.pulada) puladas += 1
      if (r.semLoja) semLoja += 1
      console.log(`[sefaz] ${empresa.empresa}: ${r.pulada ? 'já consultada nesta hora' : `${r.novas} nota(s) nova(s)`}`)
    } catch (err) {
      falhas += 1
      ultimoErro = err.message || 'Falha ao consultar a Receita Federal'
      console.error(`[sefaz] ${empresa.empresa}: ${ultimoErro}`)
    }
  }
  agendarCienciasPendentes(financePool)
  if (falhas === 0 && novas === 0 && esperas === comCert.length) {
    return {
      ok: true,
      novas: 0,
      mensagem: 'A Receita pediu para esperar uma hora. As notas que já chegaram continuam no inbox.',
    }
  }
  const partes = [`${comCert.length} empresa(s) na Receita`, `${novas} nota(s) nova(s)`]
  if (esperas) partes.push(`${esperas} em espera de uma hora`)
  if (puladas) partes.push(`${puladas} já consultada(s) nesta hora`)
  if (falhas) partes.push(`${falhas} com erro`)
  if (semLoja) partes.push(`${semLoja} sem loja com o mesmo CNPJ (ficam só no inbox)`)
  try {
    const unidos = await amarrarDdaComNotasReceita(financePool)
    if (unidos) partes.push(`${unidos} DDA+NF unidos`)
  } catch (err) {
    console.error(`[sefaz] união DDA+NF: ${err.message}`)
  }
  return {
    ok: falhas === 0,
    novas,
    mensagem: falhas === comCert.length && ultimoErro ? ultimoErro : `${partes.join(', ')}.`,
  }
}

/** Liga boleto DDA e NF-e da Receita na mesma despesa quando o casamento é forte. */
export async function amarrarDdaComNotasReceita(financePool) {
  await garantirSchemaSefaz(financePool)
  const [despesas, notas] = await Promise.all([
    financePool.query(`
      SELECT d.id, d.empresa_origem_id, d.numero_nf, d.documento_ref, d.cnpj_cedente,
             d.vencimento::text AS vencimento, d.valor::float8 AS valor,
             eo.cnpj AS cnpj_empresa,
             coalesce(f.cpf_cnpj, d.cnpj_cedente) AS cnpj_fornecedor
      FROM despesas d
      JOIN empresas eo ON eo.id = d.empresa_origem_id
      LEFT JOIN fornecedores f ON f.id = d.fornecedor_id
      WHERE d.status <> 'cancelada'
        AND (
          d.fonte = 'dda'
          OR d.documento_ref LIKE 'DDA|%'
          OR (d.forma_pagamento = 'boleto' AND d.documento_ref ~ '^\\d{44}$')
        )
        AND NOT EXISTS (
          SELECT 1 FROM nfe_recebida n WHERE n.despesa_id = d.id
        )
    `),
    financePool.query(`
      SELECT id, empresa_id, cnpj_empresa, numero, emitente_cnpj, emissao::text AS emissao,
             valor_total::float8 AS valor_total
      FROM nfe_recebida
      WHERE despesa_id IS NULL
        AND COALESCE(situacao, '') NOT IN ('cancelada', 'denegada')
      ORDER BY emissao DESC NULLS LAST
      LIMIT 2000
    `),
  ])
  const pares = cruzarDdaComNotas(despesas.rows, notas.rows)
  for (const par of pares) {
    await financePool.query(
      `UPDATE nfe_recebida
       SET despesa_id = $2, atualizado_em = now()
       WHERE id = $1 AND despesa_id IS NULL`,
      [par.nfe_recebida_id, par.despesa_id],
    )
    if (par.numero_nf) {
      await financePool.query(
        `UPDATE despesas
         SET numero_nf = COALESCE(NULLIF(btrim(numero_nf), ''), $2)
         WHERE id = $1`,
        [par.despesa_id, String(par.numero_nf)],
      )
    }
  }
  if (pares.length) console.log(`[sefaz] ${pares.length} DDA unidos com nota da Receita`)
  return pares.length
}

export async function listarNotasReceita(financePool, empresaId) {
  await garantirSchemaSefaz(financePool)
  amarrarDdaComNotasReceita(financePool).catch((err) => console.error(`[sefaz] união DDA+NF: ${err.message}`))
  const params = []
  let filtro = ''
  if (empresaId) {
    params.push(empresaId)
    filtro = `WHERE n.empresa_id = $1`
  }
  const { rows } = await financePool.query(
    `SELECT n.id, n.chave, n.numero, n.serie, n.emissao::text AS emissao,
            n.emitente_cnpj, n.emitente_nome, n.valor_total, n.situacao, n.tem_xml,
            n.cnpj_empresa, n.despesa_id, e.apelido AS origem,
            d.vencimento::text AS agenda_vencimento,
            d.fonte AS despesa_fonte,
            d.documento_ref AS despesa_documento_ref,
            (
              d.id IS NOT NULL AND (
                d.fonte = 'dda'
                OR d.documento_ref LIKE 'DDA|%'
                OR (d.forma_pagamento = 'boleto' AND COALESCE(d.documento_ref, '') ~ '^\\d{44}$')
              )
            ) AS tem_dda
     FROM nfe_recebida n
     LEFT JOIN empresas e ON e.id = n.empresa_id
     LEFT JOIN despesas d ON d.id = n.despesa_id
     ${filtro}
     ORDER BY n.emissao DESC NULLS LAST, n.criado_em DESC
     LIMIT 500`,
    params,
  )
  return rows.map((row) => ({
    ...row,
    valor_total: row.valor_total != null ? Number(row.valor_total) : null,
    tem_xml: row.tem_xml === true,
    tem_dda: row.tem_dda === true,
  }))
}

function erroStatus(status, message) {
  const err = new Error(message)
  err.status = status
  return err
}

function xmlEhNfe(xml) {
  return /<(?:\w+:)?NFe[\s>]|<(?:\w+:)?nfeProc[\s>]/i.test(String(xml || ''))
}

async function notaPorId(financePool, id) {
  const { rows } = await financePool.query(
    `SELECT id, empresa_id, cnpj_empresa, chave, numero, serie, emissao::text AS emissao,
            emitente_cnpj, emitente_nome, valor_total, situacao, tem_xml, xml, despesa_id,
            ciencia_em
     FROM nfe_recebida
     WHERE id = $1`,
    [id],
  )
  const nota = rows[0]
  if (!nota) return null
  return {
    ...nota,
    valor_total: nota.valor_total != null ? Number(nota.valor_total) : null,
  }
}

async function xmlNoDisco(chave) {
  const { rows } = await appPool.query(
    `SELECT xml_path FROM estoque_nfe
     WHERE chave = $1 AND xml_path IS NOT NULL AND btrim(xml_path) <> ''
     ORDER BY CASE WHEN lower(fornecedor) = 'sefaz' THEN 1 ELSE 0 END, id_nfe DESC
     LIMIT 1`,
    [chave],
  )
  const arquivo = rows[0]?.xml_path ? String(rows[0].xml_path).trim() : ''
  if (!arquivo || !fs.existsSync(arquivo)) return ''
  return fs.readFileSync(arquivo, 'utf8')
}

function idNotaValido(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))
}

async function guardarXml(financePool, nota, xml) {
  if (idNotaValido(nota.id)) {
    await financePool.query(
      `UPDATE nfe_recebida SET xml = $2, tem_xml = true, atualizado_em = now() WHERE id = $1`,
      [nota.id, xml],
    )
  }
  const doc = interpretarDocumento(xml)
  if (doc.tipo !== 'completa' || !doc.chave) return
  const { rows } = await appPool.query(
    `SELECT id_nfe, id_loja, entrada_registrada,
            (SELECT COUNT(*)::int FROM estoque_nfe_itens i WHERE i.id_nfe = estoque_nfe.id_nfe) AS itens
     FROM estoque_nfe
     WHERE chave = $1`,
    [doc.chave],
  )
  for (const atual of rows) {
    if (atual.entrada_registrada || Number(atual.itens || 0) > 0) continue
    await gravarItensNaNota({ idNfe: atual.id_nfe, idLoja: atual.id_loja, doc, xml })
  }
}

async function tlsDaEmpresa(financePool, cnpj) {
  const doc = digitos(cnpj)
  await garantirSchemaBb(financePool)
  const { rows } = await financePool.query(
    `SELECT COALESCE(c.cert_pem, '') AS cert_pem,
            COALESCE(c.key_pem, '') AS key_pem,
            COALESCE(c.pfx, '') AS pfx,
            COALESCE(c.cert_pass, '') AS cert_pass
     FROM empresas e
     LEFT JOIN bb_credenciais c ON c.empresa_id = e.id AND c.ativo IS NOT FALSE
     WHERE regexp_replace(COALESCE(e.cnpj, ''), '\\D', '', 'g') = $1
     LIMIT 1`,
    [doc],
  )
  const linha = rows[0] || {}
  return tlsDaCredencial({
    cnpj: doc,
    cert_pem: linha.cert_pem,
    key_pem: linha.key_pem,
    pfx: linha.pfx,
    cert_pass: linha.cert_pass,
  })
}

async function registrarCiencia(financePool, nota) {
  if (nota.ciencia_em) return 'A ciência dessa nota já estava registrada.'
  const tls = nota.tlsPronto || await tlsDaEmpresa(financePool, nota.cnpj_empresa)
  if (!tls?.cert || !tls?.key) return 'Sem certificado A1 para registrar a ciência.'
  try {
    const evento = await manifestarCiencia(tls, { cnpj: nota.cnpj_empresa, chave: nota.chave })
    if (evento.ok) {
      if (idNotaValido(nota.id)) {
        await financePool.query(
          'UPDATE nfe_recebida SET ciencia_em = now(), atualizado_em = now() WHERE id = $1',
          [nota.id],
        )
      }
      nota.ciencia_em = new Date().toISOString()
      return 'A ciência da operação foi registrada.'
    }
    return evento.xMotivo || 'A Receita não registrou a ciência.'
  } catch (err) {
    return err.message || 'A ciência da operação não foi registrada.'
  }
}

const xmlEmCurso = new Map()
const lojasXmlEmFila = new Set()

async function copiarProdutosDaNotaAntiga(nfe) {
  const { rows } = await appPool.query(
    `SELECT o.id_nfe, o.xml_path,
            (SELECT COUNT(*)::int FROM estoque_nfe_itens i WHERE i.id_nfe = o.id_nfe) AS itens
     FROM estoque_nfe o
     WHERE o.chave = $1 AND o.id_nfe <> $2 AND o.id_loja = $3
     ORDER BY (SELECT COUNT(*) FROM estoque_nfe_itens i WHERE i.id_nfe = o.id_nfe) DESC, o.id_nfe DESC`,
    [nfe.chave, nfe.id_nfe, nfe.id_loja],
  )
  const comProdutos = rows.find((row) => Number(row.itens) > 0)
  if (comProdutos) {
    await appPool.query(
      `INSERT INTO estoque_nfe_itens (
         id_nfe, n_item, codigo_nf, ean, descricao, u_com, q_com, v_un_com, v_prod,
         id_insumo, match_tipo, preco_caixa_aplicado, qtd_estoque
       )
       SELECT $1, n_item, codigo_nf, ean, descricao, u_com, q_com, v_un_com, v_prod,
              id_insumo, match_tipo, preco_caixa_aplicado, qtd_estoque
       FROM estoque_nfe_itens
       WHERE id_nfe = $2`,
      [nfe.id_nfe, comProdutos.id_nfe],
    )
    await appPool.query(
      `UPDATE estoque_nfe dst
       SET xml_path = COALESCE(NULLIF(btrim(dst.xml_path), ''), NULLIF(btrim(src.xml_path), '')),
           data_vencimento = COALESCE(dst.data_vencimento, src.data_vencimento),
           atualizado_em = NOW()
       FROM estoque_nfe src
       WHERE dst.id_nfe = $1 AND src.id_nfe = $2`,
      [nfe.id_nfe, comProdutos.id_nfe],
    )
    return Number(comProdutos.itens)
  }
  const comArquivo = rows.find((row) => row.xml_path && fs.existsSync(String(row.xml_path).trim()))
  if (!comArquivo) return 0
  const xml = fs.readFileSync(String(comArquivo.xml_path).trim(), 'utf8')
  const doc = interpretarDocumento(xml)
  if (doc.tipo !== 'completa' || !doc.nfe) return 0
  return gravarItensNaNota({ idNfe: nfe.id_nfe, idLoja: nfe.id_loja, doc, xml })
}

async function xmlJaGuardado(finance, nfe) {
  const arquivo = nfe.xml_path ? String(nfe.xml_path).trim() : ''
  if (arquivo && fs.existsSync(arquivo)) {
    const disco = fs.readFileSync(arquivo, 'utf8')
    const docDisco = interpretarDocumento(disco)
    if (docDisco.tipo === 'completa' && docDisco.nfe) return { doc: docDisco, xml: disco }
  }
  const deOutraNota = nfe.chave ? await xmlNoDisco(nfe.chave) : ''
  if (xmlEhNfe(deOutraNota)) {
    const docDisco = interpretarDocumento(deOutraNota)
    if (docDisco.tipo === 'completa' && docDisco.nfe) return { doc: docDisco, xml: deOutraNota }
  }
  if (!nfe.chave) return null
  const achada = await finance.query(
    `SELECT id, xml
     FROM nfe_recebida
     WHERE chave = $1 AND COALESCE(tem_xml, false) = true AND xml IS NOT NULL
     ORDER BY atualizado_em DESC
     LIMIT 1`,
    [nfe.chave],
  )
  const notaFin = achada.rows[0]
  if (!xmlEhNfe(notaFin?.xml)) return null
  const docBanco = interpretarDocumento(notaFin.xml)
  if (docBanco.tipo !== 'completa' || !docBanco.nfe) return null
  return { doc: docBanco, xml: notaFin.xml, notaId: notaFin.id }
}

/** Copia os produtos do XML que o portal já gravou em nfe_recebida para a nota da loja. */
export function completarXmlNotaEstoque(idNfe, { buscarPortal = true } = {}) {
  const id = Number(idNfe)
  if (!Number.isFinite(id)) return Promise.resolve({ ok: false })
  const chaveCurso = `${id}:${buscarPortal ? '1' : '0'}`
  if (xmlEmCurso.has(chaveCurso)) return xmlEmCurso.get(chaveCurso)
  const job = completarXmlNotaEstoqueAgora(id, buscarPortal).finally(() => xmlEmCurso.delete(chaveCurso))
  xmlEmCurso.set(chaveCurso, job)
  return job
}

async function completarXmlNotaEstoqueAgora(idNfe, buscarPortal) {
  const { rows } = await appPool.query(
    `SELECT n.id_nfe, n.id_loja, n.chave, n.fornecedor, n.xml_path, n.entrada_registrada,
            (SELECT COUNT(*)::int FROM estoque_nfe_itens i WHERE i.id_nfe = n.id_nfe) AS itens,
            regexp_replace(COALESCE(l.cnpj, ''), '\\D', '', 'g') AS cnpj,
            l.state
     FROM estoque_nfe n
     JOIN lojas l ON l.id_loja = n.id_loja
     WHERE n.id_nfe = $1`,
    [idNfe],
  )
  const nfe = rows[0]
  if (!nfe || String(nfe.fornecedor || '').toLowerCase() !== 'sefaz') return { ok: false, ignorada: true }
  if (nfe.entrada_registrada || Number(nfe.itens || 0) > 0) return { ok: true, ja: true }
  if (!nfe.chave) return { ok: false, motivo: 'Nota sem chave.' }
  const copiados = await copiarProdutosDaNotaAntiga(nfe)
  if (copiados > 0) {
    console.log(`[sefaz] NF ${nfe.id_nfe} reaproveitou ${copiados} produto(s) da nota já importada`)
    return { ok: true, itens: copiados }
  }
  const finance = poolFinanceiro()
  await garantirSchemaSefaz(finance)
  let guardado = await xmlJaGuardado(finance, nfe)
  if (!guardado && buscarPortal && String(nfe.cnpj || '').length === 14) {
    guardado = await buscarXmlNoPortal(finance, nfe)
  }
  if (!guardado) return { ok: false, motivo: 'O XML desta nota ainda não está no banco.' }
  const qtd = await gravarItensNaNota({
    idNfe: nfe.id_nfe,
    idLoja: nfe.id_loja,
    doc: guardado.doc,
    xml: guardado.xml,
  })
  console.log(`[sefaz] NF ${nfe.id_nfe} com ${qtd} produto(s)`)
  return { ok: true, itens: qtd }
}

async function buscarXmlNoPortal(finance, nfe) {
  const tls = await tlsDaEmpresa(finance, nfe.cnpj)
  if (!tls?.cert || !tls?.key) return null
  const achada = await finance.query(
    `SELECT id, ciencia_em FROM nfe_recebida WHERE chave = $1 ORDER BY atualizado_em DESC LIMIT 1`,
    [nfe.chave],
  )
  const notaFin = achada.rows[0]
  await registrarCiencia(finance, {
    id: notaFin?.id,
    cnpj_empresa: nfe.cnpj,
    chave: nfe.chave,
    ciencia_em: notaFin?.ciencia_em,
    tlsPronto: tls,
  })
  const ambiente = process.env.SEFAZ_DFE_AMBIENTE === 'homologacao' ? 'homologacao' : 'producao'
  let doc = null
  for (let tentativa = 0; tentativa < 2 && !doc; tentativa += 1) {
    if (tentativa) await esperar(2000)
    const ret = await consultarPorChave(tls, {
      cnpj: nfe.cnpj,
      cUF: cUfDe(nfe.state),
      chave: nfe.chave,
      ambiente,
    })
    if (ret.cStat === '656') return null
    doc = (ret.documentos || []).find((item) => item.tipo === 'completa' && item.nfe && item.xml) || null
  }
  if (!doc) return null
  if (notaFin?.id) {
    await finance.query(
      `UPDATE nfe_recebida SET xml = $2, tem_xml = true, atualizado_em = now() WHERE id = $1`,
      [notaFin.id, doc.xml],
    )
  }
  return { doc, xml: doc.xml, notaId: notaFin?.id }
}

/** Completa, em segundo plano, as notas da loja que ainda estão só com o resumo. */
export function agendarXmlPendentesLoja(idLoja) {
  const id = Number(idLoja)
  if (!id || lojasXmlEmFila.has(id)) return
  lojasXmlEmFila.add(id)
  ;(async () => {
    const { rows } = await appPool.query(
      `SELECT n.id_nfe
       FROM estoque_nfe n
       WHERE n.id_loja = $1
         AND lower(n.fornecedor) = 'sefaz'
         AND n.entrada_registrada = FALSE
         AND COALESCE(n.emissao, CURRENT_DATE) >= CURRENT_DATE - 30
         AND NOT EXISTS (SELECT 1 FROM estoque_nfe_itens i WHERE i.id_nfe = n.id_nfe)
       ORDER BY n.emissao DESC NULLS LAST
       LIMIT 80`,
      [id],
    )
    let buscas = 0
    for (const row of rows) {
      try {
        const antes = buscas < 4
        const r = await completarXmlNotaEstoque(row.id_nfe, { buscarPortal: antes })
        if (antes && !r?.ja && !r?.itens) buscas += 1
      } catch (err) {
        console.error(`[sefaz] xml da nota ${row.id_nfe}: ${err.message}`)
        buscas += 1
      }
    }
  })().catch((err) => {
    console.error(`[sefaz] fila de XML da loja ${id}: ${err.message}`)
  }).finally(() => {
    lojasXmlEmFila.delete(id)
  })
}

async function guardarXmlsDoDisco(financePool) {
  const { rows } = await financePool.query(
    `SELECT id, cnpj_empresa, chave
     FROM nfe_recebida
     WHERE COALESCE(tem_xml, false) = false
       AND chave ~ '^[0-9]{44}$'`,
  )
  let gravados = 0
  for (const nota of rows) {
    const xml = await xmlNoDisco(nota.chave)
    if (!xmlEhNfe(xml)) continue
    await guardarXml(financePool, nota, xml)
    gravados += 1
  }
  if (gravados) console.log(`[sefaz] ${gravados} XML gravado(s) no banco a partir do arquivo local`)
  return gravados
}

let cienciasEmCurso = null

async function registrarCienciasPendentes(financePool, pular) {
  const { rows } = await financePool.query(
    `SELECT id, cnpj_empresa, chave
     FROM nfe_recebida
     WHERE COALESCE(tem_xml, false) = false
       AND ciencia_em IS NULL
       AND COALESCE(situacao, '') NOT IN ('cancelada', 'denegada')
       AND chave ~ '^[0-9]{44}$'
       AND NOT (id = ANY($1::uuid[]))
     ORDER BY emissao DESC NULLS LAST
     LIMIT 20`,
    [pular.length ? pular : ['00000000-0000-0000-0000-000000000000']],
  )
  const tlsPorCnpj = new Map()
  let ok = 0
  const falhas = []
  for (const nota of rows) {
    if (!tlsPorCnpj.has(nota.cnpj_empresa)) {
      tlsPorCnpj.set(nota.cnpj_empresa, await tlsDaEmpresa(financePool, nota.cnpj_empresa))
    }
    nota.tlsPronto = tlsPorCnpj.get(nota.cnpj_empresa)
    const mensagem = await registrarCiencia(financePool, nota)
    if (nota.ciencia_em) ok += 1
    else {
      falhas.push(nota.id)
      console.error(`[sefaz] ciência da nota ${String(nota.chave).slice(0, 6)}…: ${mensagem}`)
    }
    await esperar(200)
  }
  if (rows.length) console.log(`[sefaz] ciência: ${ok} gravada(s) no banco, ${falhas.length} pendente(s) nesta leva`)
  return { ok, feitas: rows.length, falhas }
}

/** Registra a ciência sem consultar a distribuição, para a próxima busca trazer o XML e guardar no banco. */
export function agendarCienciasPendentes(financePool) {
  if (cienciasEmCurso) return cienciasEmCurso
  cienciasEmCurso = (async () => {
    await guardarXmlsDoDisco(financePool)
    const pular = []
    let total = 0
    for (let leva = 0; leva < 150; leva += 1) {
      const lote = await registrarCienciasPendentes(financePool, pular)
      total += lote.ok
      pular.push(...lote.falhas)
      if (!lote.feitas || !lote.ok) break
    }
    if (total) console.log(`[sefaz] ${total} ciência(s) registrada(s). O XML completo entra no banco na próxima consulta liberada.`)
  })().catch((err) => {
    console.error(`[sefaz] ciência: ${err.message}`)
  }).finally(() => {
    cienciasEmCurso = null
  })
  return cienciasEmCurso
}

async function xmlCompletoDaNota(financePool, nota) {
  if (xmlEhNfe(nota.xml)) return nota.xml
  const disco = await xmlNoDisco(nota.chave)
  if (xmlEhNfe(disco)) {
    await guardarXml(financePool, nota, disco)
    return disco
  }
  throw erroStatus(409, 'O XML dessa nota ainda está sendo gravado no banco. O DANFE abre quando o download automático terminar.')
}

export async function danfeNotaReceita(financePool, id) {
  await garantirSchemaSefaz(financePool)
  const nota = await notaPorId(financePool, id)
  if (!nota) throw erroStatus(404, 'Nota não encontrada.')
  const xml = await xmlCompletoDaNota(financePool, nota)
  try {
    return await gerarDanfe(xml)
  } catch (err) {
    throw erroStatus(422, err.message || 'Não gerou o DANFE.')
  }
}

function lerEnvArquivo(file) {
  if (!file || !fs.existsSync(file)) return {}
  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

function nomeBancoFinanceiro() {
  if (process.env.FINANCE_DB_NAME) return process.env.FINANCE_DB_NAME
  const raiz = path.join(aqui, '..', '..', '..', '..')
  const arquivo = {
    ...lerEnvArquivo(path.join(raiz, '.env')),
    ...lerEnvArquivo(path.join(raiz, 'backend', '.env')),
  }
  return arquivo.DB_NAME || 'vision_check'
}

let financeLazy = null

function poolFinanceiro() {
  if (financeLazy) return financeLazy
  financeLazy = new pg.Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: nomeBancoFinanceiro(),
    port: Number(process.env.DB_PORT || 5432),
    max: 2,
    ssl: process.env.DB_SSL === 'true' || process.env.DB_SSL === '1' ? { rejectUnauthorized: false } : undefined,
    options: '-c search_path=finance,public',
  })
  return financeLazy
}

/** DANFE do gestor, gerado com o XML já gravado no banco ou no disco. */
export async function danfeNotaEstoque(idNfe) {
  const { rows } = await appPool.query(
    `SELECT n.id_nfe, n.chave, n.xml_path,
            regexp_replace(COALESCE(l.cnpj, ''), '\\D', '', 'g') AS cnpj
     FROM estoque_nfe n
     JOIN lojas l ON l.id_loja = n.id_loja
     WHERE n.id_nfe = $1`,
    [idNfe],
  )
  const nfe = rows[0]
  if (!nfe) throw erroStatus(404, 'NF não encontrada.')
  const arquivo = nfe.xml_path ? String(nfe.xml_path).trim() : ''
  if (arquivo && fs.existsSync(arquivo)) {
    const bruto = fs.readFileSync(arquivo, 'utf8')
    if (xmlEhNfe(bruto)) return gerarDanfe(bruto)
  }
  const finance = poolFinanceiro()
  await garantirSchemaSefaz(finance)
  let nota = null
  if (nfe.chave) {
    const achada = await finance.query(
      `SELECT id FROM nfe_recebida WHERE chave = $1 ORDER BY atualizado_em DESC LIMIT 1`,
      [nfe.chave],
    )
    if (achada.rows[0]) nota = await notaPorId(finance, achada.rows[0].id)
  }
  if (!nota) {
    nota = {
      id: null,
      chave: nfe.chave,
      cnpj_empresa: nfe.cnpj,
      xml: null,
      ciencia_em: null,
    }
  }
  if (!nota.chave || String(nota.cnpj_empresa || '').length !== 14) {
    throw erroStatus(404, 'XML da NF não está disponível nesta loja.')
  }
  const xml = await xmlCompletoDaNota(finance, nota)
  try {
    return await gerarDanfe(xml)
  } catch (err) {
    throw erroStatus(422, err.message || 'Não gerou o DANFE.')
  }
}

let fonteNfePronta = false

async function garantirFonteNfe(financePool) {
  if (fonteNfePronta) return
  const { rows } = await financePool.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'despesas'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%fonte%'
  `)
  const atual = rows[0]
  if (!atual || !String(atual.def).includes("'nfe'")) {
    if (atual) {
      if (!/^[a-z_][a-z0-9_]*$/i.test(atual.conname)) throw new Error('Constraint de origem inválida.')
      await financePool.query(`ALTER TABLE despesas DROP CONSTRAINT ${atual.conname}`)
    }
    await financePool.query(`
      ALTER TABLE despesas ADD CONSTRAINT despesas_fonte_check
      CHECK (fonte IS NULL OR fonte IN ('dda', 'manual', 'nfe'))
    `)
  }
  fonteNfePronta = true
}

function dataAgenda(iso) {
  const dia = String(iso || '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dia)) return dia
  return new Date().toISOString().slice(0, 10)
}

function parcelasDaNota(nota) {
  if (xmlEhNfe(nota.xml)) {
    try {
      const parsed = parseNfeXml(nota.xml)
      const dups = (parsed.duplicatas || []).filter((dup) => Number(dup.valor) > 0)
      if (dups.length) {
        return dups.map((dup, indice) => ({
          valor: Number(dup.valor),
          vencimento: dataAgenda(dup.vencimento || parsed.data_vencimento || nota.emissao),
          ref: dups.length === 1
            ? `NF|${nota.chave}`
            : `NF|${nota.chave}|${String(dup.numero || indice + 1).replace(/\W/g, '').slice(0, 12) || indice + 1}`,
        }))
      }
      if (parsed.data_vencimento && nota.valor_total != null) {
        return [{
          valor: Number(nota.valor_total),
          vencimento: dataAgenda(parsed.data_vencimento),
          ref: `NF|${nota.chave}`,
        }]
      }
    } catch {
      /* resumo ou XML sem itens: lança pelo cabeçalho */
    }
  }
  if (nota.valor_total == null) return []
  return [{
    valor: Number(nota.valor_total),
    vencimento: dataAgenda(nota.emissao),
    ref: `NF|${nota.chave}`,
  }]
}

/** Grava XML de NF-e enviado pelo usuário e lança o(s) título(s) na agenda. */
export async function importarXmlNaAgenda(financePool, xmlBruto) {
  await garantirSchemaSefaz(financePool)
  await garantirFonteNfe(financePool)
  const parseada = parseNfeXml(xmlBruto)
  if (!parseada.chave || String(parseada.chave).length !== 44) {
    throw erroStatus(400, 'XML sem chave de acesso da NF-e.')
  }
  const cnpjDest = String(parseada.destinatario?.cnpj || '').replace(/\D/g, '')
  if (cnpjDest.length !== 14) {
    throw erroStatus(400, 'XML sem CNPJ do destinatário (loja).')
  }
  const empresa = await financePool.query(
    `SELECT id FROM empresas
     WHERE regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') = $1 AND ativo
     LIMIT 1`,
    [cnpjDest],
  )
  if (!empresa.rows[0]) {
    throw erroStatus(400, `Nenhuma empresa financeira para o CNPJ ${cnpjDest}.`)
  }
  await gravarFinance(financePool, {
    empresa_id: empresa.rows[0].id,
    cnpj_empresa: cnpjDest,
    chave: parseada.chave,
    numero: parseada.numero || null,
    serie: parseada.serie || null,
    emissao: parseada.emissao || null,
    emitente_cnpj: String(parseada.emitente?.cnpj || '').replace(/\D/g, '') || null,
    emitente_nome: parseada.emitente?.nome || null,
    valor_total: parseada.valor_total,
    situacao: 'autorizada',
    tem_xml: true,
    nsu: null,
    xml: String(xmlBruto || ''),
  })
  const achada = await financePool.query(
    `SELECT id FROM nfe_recebida WHERE chave = $1 ORDER BY atualizado_em DESC LIMIT 1`,
    [parseada.chave],
  )
  if (!achada.rows[0]) throw erroStatus(500, 'Não gravou a nota no financeiro.')
  return lancarNotaNaAgenda(financePool, achada.rows[0].id)
}

export async function lancarNotaNaAgenda(financePool, id) {
  await garantirSchemaSefaz(financePool)
  await garantirFonteNfe(financePool)
  const nota = await notaPorId(financePool, id)
  if (!nota) throw erroStatus(404, 'Nota não encontrada.')
  if (nota.situacao === 'cancelada' || nota.situacao === 'denegada') {
    throw erroStatus(400, 'Nota cancelada não entra na agenda de pagamento.')
  }
  let empresaId = nota.empresa_id
  if (!empresaId) {
    const achada = await financePool.query(
      `SELECT id FROM empresas
       WHERE regexp_replace(COALESCE(cnpj, ''), '\\D', '', 'g') = $1 AND ativo
       LIMIT 1`,
      [nota.cnpj_empresa],
    )
    empresaId = achada.rows[0]?.id || null
  }
  if (!empresaId) throw erroStatus(400, 'Essa nota não está ligada a uma empresa do financeiro.')

  const existentes = await financePool.query(
    `SELECT id, vencimento::text AS vencimento
     FROM despesas
     WHERE empresa_origem_id = $1
       AND status <> 'cancelada'
       AND (documento_ref = $2 OR documento_ref LIKE $3)
     ORDER BY vencimento NULLS LAST, created_at`,
    [empresaId, `NF|${nota.chave}`, `NF|${nota.chave}|%`],
  )
  if (existentes.rowCount) {
    const primeiro = existentes.rows[0]
    await financePool.query(
      'UPDATE nfe_recebida SET despesa_id = $2, atualizado_em = now() WHERE id = $1 AND despesa_id IS NULL',
      [nota.id, primeiro.id],
    )
    return {
      id: primeiro.id,
      vencimento: primeiro.vencimento,
      quantidade: existentes.rowCount,
      ja_existia: true,
      vinculou_dda: false,
    }
  }

  if (nota.despesa_id) {
    const ligada = await financePool.query(
      `SELECT id, vencimento::text AS vencimento,
              (fonte = 'dda' OR documento_ref LIKE 'DDA|%') AS tem_dda
       FROM despesas WHERE id = $1 AND status <> 'cancelada'`,
      [nota.despesa_id],
    )
    if (ligada.rows[0]) {
      return {
        id: ligada.rows[0].id,
        vencimento: ligada.rows[0].vencimento,
        quantidade: 1,
        ja_existia: true,
        vinculou_dda: ligada.rows[0].tem_dda === true,
      }
    }
  }

  if (!xmlEhNfe(nota.xml)) {
    const disco = await xmlNoDisco(nota.chave)
    if (xmlEhNfe(disco)) nota.xml = disco
  }
  const parcelas = parcelasDaNota(nota)
  if (!parcelas.length) throw erroStatus(400, 'Essa nota não tem valor para lançar.')

  const ddas = await financePool.query(
    `SELECT d.id, d.empresa_origem_id, d.numero_nf, d.documento_ref, d.cnpj_cedente,
            d.vencimento::text AS vencimento, d.valor::float8 AS valor,
            eo.cnpj AS cnpj_empresa,
            coalesce(f.cpf_cnpj, d.cnpj_cedente) AS cnpj_fornecedor
     FROM despesas d
     JOIN empresas eo ON eo.id = d.empresa_origem_id
     LEFT JOIN fornecedores f ON f.id = d.fornecedor_id
     WHERE d.empresa_origem_id = $1
       AND d.status <> 'cancelada'
       AND (
         d.fonte = 'dda'
         OR d.documento_ref LIKE 'DDA|%'
         OR (d.forma_pagamento = 'boleto' AND d.documento_ref ~ '^\\d{44}$')
       )
       AND NOT EXISTS (SELECT 1 FROM nfe_recebida n WHERE n.despesa_id = d.id)`,
    [empresaId],
  )
  const notaMatch = {
    ...nota,
    empresa_id: empresaId,
    cnpj_empresa: nota.cnpj_empresa,
  }
  const { rows: fornecedores } = await financePool.query(
    'SELECT id, nome, cpf_cnpj, plano_conta_id FROM fornecedores WHERE ativo',
  )
  const fornecedor = acharFornecedor(
    { cnpj_cedente: nota.emitente_cnpj, cedente: nota.emitente_nome },
    fornecedores,
  )
  const descricao = `NF ${nota.numero || nota.chave.slice(25, 34)} ${nota.emitente_nome || ''}`.replace(/\s+/g, ' ').trim().slice(0, 200)
  const ids = []
  const ddaUsados = new Set()
  let vinculouDda = false
  for (const parcela of parcelas) {
    const livres = ddas.rows.filter((d) => !ddaUsados.has(d.id))
    const dda = escolherDdaParaNota(notaMatch, livres, parcela)
    if (dda) {
      ddaUsados.add(dda.id)
      vinculouDda = true
      await financePool.query(
        `UPDATE despesas
         SET numero_nf = COALESCE(NULLIF(btrim(numero_nf), ''), $2),
             status = CASE
               WHEN status IN ('rascunho', 'classificada', 'bloqueada_duplicata') THEN 'pronta'
               ELSE status
             END
         WHERE id = $1`,
        [dda.id, nota.numero ? String(nota.numero) : null],
      )
      ids.push(dda.id)
      continue
    }
    const competencia = competenciaDe(parcela.vencimento)
    const { rows } = await financePool.query(
      `INSERT INTO despesas (
         descricao, fornecedor_id, empresa_origem_id, plano_conta_id,
         documento_ref, numero_nf, cnpj_cedente, competencia, vencimento, valor,
         status, fonte, nf_confirmada
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,$10,'pronta','nfe', false)
       RETURNING id`,
      [
        descricao,
        fornecedor?.id || null,
        empresaId,
        fornecedor?.plano_conta_id || null,
        parcela.ref,
        nota.numero || null,
        nota.emitente_cnpj || null,
        competencia,
        parcela.vencimento,
        parcela.valor,
      ],
    )
    ids.push(rows[0].id)
  }

  await financePool.query(
    'UPDATE nfe_recebida SET despesa_id = $2, atualizado_em = now() WHERE id = $1',
    [nota.id, ids[0]],
  )
  const venc = ddas.rows.find((d) => d.id === ids[0])?.vencimento || parcelas[0].vencimento
  return {
    id: ids[0],
    vencimento: venc,
    quantidade: ids.length,
    ja_existia: vinculouDda && ids.every((id) => ddaUsados.has(id)),
    vinculou_dda: vinculouDda,
  }
}
