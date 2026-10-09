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
import { parseNfeXml } from '../../services/nfeXml.js'
import { cnpjsDosCertificados, garantirSchemaBb, tlsDaCredencial } from './bbDda.mjs'
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
  xmlNfeDe,
} from './sefazDfe.mjs'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(aqui, '..', 'db', '012_sefaz_dfe.sql')
const pastaXml = path.join(aqui, '..', '..', '..', '..', 'Logs', 'sefaz-nfe')

const MAX_PAGINAS = 40
const ESPERA_MS = 55 * 60 * 1000
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
  corte.setDate(corte.getDate() - 90)
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

async function gravarNoGestor({ idLoja, doc, xml }) {
  if (!idLoja || !doc.chave) return false
  if (doc.situacao === 'cancelada' || doc.situacao === 'denegada') return false
  const { rows } = await appPool.query(
    `SELECT id_nfe, xml_path, entrada_registrada
     FROM estoque_nfe
     WHERE id_loja = $1 AND chave = $2
     LIMIT 1`,
    [idLoja, doc.chave],
  )
  const atual = rows[0]
  if (atual?.entrada_registrada) return false
  if (doc.tipo === 'completa' && doc.nfe) {
    if (atual?.xml_path) return false
    if (atual) {
      await appPool.query('DELETE FROM estoque_nfe WHERE id_nfe = $1', [atual.id_nfe])
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
  if (atual) return false
  await appPool.query(
    `INSERT INTO estoque_nfe (
       id_loja, fornecedor, chave, numero, serie, emissao,
       emitente_cnpj, emitente_nome, valor_total, status,
       status_portal, status_entrega
     ) VALUES ($1,'sefaz',$2,$3,$4,$5::date,$6,$7,$8,'importada',$9,'aguardando_conferencia')`,
    [
      idLoja,
      doc.chave,
      doc.numero || null,
      doc.serie || null,
      doc.emissao || null,
      doc.emitente_cnpj || null,
      doc.emitente_nome || null,
      doc.valor_total,
      'Resumo Receita Federal',
    ],
  )
  return true
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
  return {
    ok: falhas === 0,
    novas,
    mensagem: falhas === comCert.length && ultimoErro ? ultimoErro : `${partes.join(', ')}.`,
  }
}

export async function listarNotasReceita(financePool, empresaId) {
  await garantirSchemaSefaz(financePool)
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
            d.vencimento::text AS agenda_vencimento
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
  const loja = acharLoja(await lojasPorCnpj(), nota.cnpj_empresa, null)
  if (!loja) return
  const dir = path.join(pastaXml, String(loja.id_loja))
  fs.mkdirSync(dir, { recursive: true })
  const arquivo = path.join(dir, `${doc.chave}.xml`)
  fs.writeFileSync(arquivo, xml, 'utf8')
  await appPool.query(
    `UPDATE estoque_nfe SET xml_path = $3, atualizado_em = NOW()
     WHERE id_loja = $1 AND chave = $2 AND (xml_path IS NULL OR btrim(xml_path) = '')`,
    [loja.id_loja, doc.chave, arquivo],
  ).catch((err) => {
    console.error(`[sefaz] xml ${doc.chave}: ${err.message}`)
  })
}

async function minutosDeEspera(financePool, cnpj) {
  const cursor = await cursorDe(financePool, cnpj)
  if (!cursor || !recente(cursor.consultado_em)) return 0
  const emEspera = String(cursor.ultimo_cstat) === '656'
    || (cursor.ult_nsu && cursor.max_nsu && cursor.ult_nsu === cursor.max_nsu)
  if (!emEspera) return 0
  const falta = ESPERA_MS - (Date.now() - new Date(cursor.consultado_em).getTime())
  return Math.max(1, Math.ceil(falta / 60000))
}

async function registrarCiencia(financePool, nota) {
  if (nota.ciencia_em) return 'A ciência dessa nota já estava registrada.'
  const tls = tlsDaCredencial({ cnpj: nota.cnpj_empresa })
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

async function baixarXmlReceita(financePool, nota) {
  const tls = tlsDaCredencial({ cnpj: nota.cnpj_empresa })
  if (!tls?.cert || !tls?.key) {
    throw erroStatus(400, 'Não achei o certificado A1 dessa empresa para baixar o XML.')
  }
  const loja = acharLoja(await lojasPorCnpj(), nota.cnpj_empresa, null)
  const cUF = cUfDe(loja?.state)
  const primeira = await consultarPorChave(tls, { cnpj: nota.cnpj_empresa, cUF, chave: nota.chave })
  const xml1 = xmlNfeDe(primeira)
  if (xml1) return xml1
  if (primeira.cStat === '656') {
    throw erroStatus(429, primeira.xMotivo || 'A Receita pediu para esperar uma hora antes de baixar o XML.')
  }
  const ciencia = await registrarCiencia(financePool, nota)
  await esperar(1500)
  const segunda = await consultarPorChave(tls, { cnpj: nota.cnpj_empresa, cUF, chave: nota.chave })
  const xml2 = xmlNfeDe(segunda)
  if (xml2) return xml2
  if (segunda.cStat === '656') {
    throw erroStatus(429, `${segunda.xMotivo || 'A Receita pediu para esperar uma hora.'} ${ciencia}`)
  }
  throw erroStatus(404, `A Receita ainda só tem o resumo dessa nota. ${ciencia} O DANFE abre quando o XML completo chegar.`)
}

const baixandoXml = new Map()

async function xmlCompletoDaNota(financePool, nota) {
  if (xmlEhNfe(nota.xml)) return nota.xml
  const disco = await xmlNoDisco(nota.chave)
  if (xmlEhNfe(disco)) {
    await guardarXml(financePool, nota, disco)
    return disco
  }
  if (baixandoXml.has(nota.id)) return baixandoXml.get(nota.id)
  const promessa = (async () => {
    const falta = await minutosDeEspera(financePool, nota.cnpj_empresa)
    if (falta) {
      const ciencia = await registrarCiencia(financePool, nota)
      throw erroStatus(
        429,
        `A Receita pediu para esperar cerca de ${falta} min antes de baixar o XML. ${ciencia} O DANFE abre na próxima consulta.`,
      )
    }
    const xml = await baixarXmlReceita(financePool, nota)
    await guardarXml(financePool, nota, xml)
    return xml
  })().finally(() => baixandoXml.delete(nota.id))
  baixandoXml.set(nota.id, promessa)
  return promessa
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

/** DANFE do gestor. Sem XML no disco, baixa na Receita pela chave. */
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
    }
  }

  if (!xmlEhNfe(nota.xml)) {
    const disco = await xmlNoDisco(nota.chave)
    if (xmlEhNfe(disco)) nota.xml = disco
  }
  const parcelas = parcelasDaNota(nota)
  if (!parcelas.length) throw erroStatus(400, 'Essa nota não tem valor para lançar.')

  const { rows: fornecedores } = await financePool.query(
    'SELECT id, nome, cpf_cnpj, plano_conta_id FROM fornecedores WHERE ativo',
  )
  const fornecedor = acharFornecedor(
    { cnpj_cedente: nota.emitente_cnpj, cedente: nota.emitente_nome },
    fornecedores,
  )
  const descricao = `NF ${nota.numero || nota.chave.slice(25, 34)} ${nota.emitente_nome || ''}`.replace(/\s+/g, ' ').trim().slice(0, 200)
  const ids = []
  for (const parcela of parcelas) {
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
  return {
    id: ids[0],
    vencimento: parcelas[0].vencimento,
    quantidade: ids.length,
    ja_existia: false,
  }
}
