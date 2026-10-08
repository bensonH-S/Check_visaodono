import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import SftpClient from 'ssh2-sftp-client'

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', '006_itau_sfg.sql')

function texto(valor) {
  return String(valor ?? '').trim()
}

export function configSfg(env = process.env) {
  const host = texto(env.ITAU_SFG_HOST)
  const username = texto(env.ITAU_SFG_USER)
  const password = texto(env.ITAU_SFG_PASSWORD)
  const keyPath = texto(env.ITAU_SFG_KEY)
  const privateKey = keyPath && fs.existsSync(keyPath) ? fs.readFileSync(keyPath) : null
  if (!host || !username || (!password && !privateKey)) return null
  return {
    host,
    port: Number(env.ITAU_SFG_PORT || 22),
    username,
    password: password || undefined,
    privateKey: privateKey || undefined,
    passphrase: texto(env.ITAU_SFG_PASSPHRASE) || undefined,
    readyTimeout: 20000,
    produto: texto(env.ITAU_SFG_PRODUTO),
    pasta: texto(env.ITAU_SFG_PASTA),
  }
}

export async function garantirSchemaItau(pool) {
  await pool.query(fs.readFileSync(schemaPath, 'utf8'))
}

function publico(linha, servidor) {
  const host = texto(linha?.host)
  const usuario = texto(linha?.usuario)
  const senha = Boolean(texto(linha?.senha))
  const chave = Boolean(texto(linha?.chave))
  const ativo = linha ? linha.ativo !== false : true
  return {
    host,
    porta: Number(linha?.porta) || 22,
    usuario,
    senha_definida: senha,
    chave_definida: chave,
    frase_definida: Boolean(texto(linha?.frase)),
    produto: texto(linha?.produto),
    pasta: texto(linha?.pasta),
    ativo,
    pronta: Boolean(host && usuario && (senha || chave) && ativo),
    servidor,
    ultima_coleta: linha?.ultima_coleta || null,
    ultimo_ok: linha?.ultimo_ok ?? null,
    ultima_mensagem: linha?.ultima_mensagem || '',
  }
}

export async function lerItau(pool, env = process.env) {
  await garantirSchemaItau(pool)
  const { rows } = await pool.query('select * from itau_sfg where id = 1')
  return { linha: rows[0] || null, publico: publico(rows[0], Boolean(configSfg(env))) }
}

export function montarConfig(linha, env = process.env) {
  if (linha && linha.ativo === false) return null
  const host = texto(linha?.host)
  const usuario = texto(linha?.usuario)
  const senha = texto(linha?.senha)
  const chave = texto(linha?.chave)
  if (host && usuario && (senha || chave)) {
    return {
      host,
      port: Number(linha.porta) || 22,
      username: usuario,
      password: senha || undefined,
      privateKey: chave || undefined,
      passphrase: texto(linha.frase) || undefined,
      readyTimeout: 30000,
      tryKeyboard: true,
      // Itaú exige chave + senha. A chave vem primeiro; a senha completa o segundo fator.
      authHandler: chave && senha ? ['publickey', 'keyboard-interactive', 'password'] : undefined,
      produto: texto(linha.produto),
      pasta: texto(linha.pasta),
    }
  }
  return configSfg(env)
}

function erro(mensagem, status = 400) {
  const falha = new Error(mensagem)
  falha.status = status
  return falha
}

export async function salvarItau(pool, body) {
  await garantirSchemaItau(pool)
  const atual = (await pool.query('select * from itau_sfg where id = 1')).rows[0]
  const host = texto(body.host)
  const usuario = texto(body.usuario)
  if (!host || !usuario) throw erro('Informe o host e o usuário da VAN.')
  const porta = Number(body.porta || 22)
  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) throw erro('Porta inválida.')
  const senha = texto(body.senha) || texto(atual?.senha)
  const chave = body.chave == null || texto(body.chave) === '' ? texto(atual?.chave) : texto(body.chave)
  const frase = texto(body.frase) || texto(atual?.frase)
  if (chave.length > 32000) throw erro('A chave SSH passou do tamanho esperado.')
  if (!senha && !chave) throw erro('Informe a senha ou a chave SSH.')
  await pool.query(`
    insert into itau_sfg (id, host, porta, usuario, senha, chave, frase, produto, pasta, ativo, atualizado_em)
    values (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, now())
    on conflict (id) do update set
      host = excluded.host,
      porta = excluded.porta,
      usuario = excluded.usuario,
      senha = excluded.senha,
      chave = excluded.chave,
      frase = excluded.frase,
      produto = excluded.produto,
      pasta = excluded.pasta,
      ativo = excluded.ativo,
      atualizado_em = now()
  `, [host, porta, usuario, senha, chave, frase, texto(body.produto), texto(body.pasta), body.ativo !== false])
  return publico((await pool.query('select * from itau_sfg where id = 1')).rows[0], Boolean(configSfg()))
}

export async function registrarItau(pool, ok, mensagem) {
  await pool.query(`
    update itau_sfg
       set ultima_coleta = now(), ultimo_ok = $1, ultima_mensagem = $2
     where id = 1
  `, [ok, String(mensagem || '').slice(0, 500)])
}

export function raizesSfg(config) {
  if (config.pasta) return config.pasta.split(',').map((item) => item.trim()).filter(Boolean)
  const sufixo = config.produto ? `/${config.produto}` : ''
  return [
    `/RETORNO/PROD${sufixo}`,
    `/RECEIVED${sufixo}`,
    `/mailbox/${config.username}/RETORNO/PROD${sufixo}`,
    `/mailbox/${config.username}/RECEIVED${sufixo}`,
  ]
}

async function listarArquivos(client, pasta, produto) {
  let lista
  try {
    lista = await client.list(pasta)
  } catch (err) {
    return { ok: false, arquivos: [], erro: err.message || 'pasta indisponível' }
  }
  const arquivos = []
  for (const item of lista) {
    if (item.name === '.' || item.name === '..') continue
    if (item.type === 'd') {
      if (produto && item.name !== produto) continue
      let dentro = []
      try {
        dentro = await client.list(`${pasta}/${item.name}`)
      } catch {
        dentro = []
      }
      for (const arquivo of dentro) {
        if (arquivo.type === 'd' || arquivo.name === '.' || arquivo.name === '..') continue
        arquivos.push({ pasta: `${pasta}/${item.name}`, nome: arquivo.name })
      }
      continue
    }
    arquivos.push({ pasta, nome: item.name })
  }
  return { ok: true, arquivos }
}

export async function baixarRetornos(config, destino, jaBaixados = new Set()) {
  const client = new SftpClient()
  const baixados = []
  if (config.password) {
    client.on('keyboard-interactive', (_nome, _instrucao, _lang, prompts, finish) => {
      finish(prompts.map(() => config.password))
    })
  }
  try {
    await client.connect(config)
    const vistos = new Set(jaBaixados)
    const falhas = []
    let abriu = false
    for (const raiz of raizesSfg(config)) {
      const lista = await listarArquivos(client, raiz, config.produto)
      if (!lista.ok) {
        falhas.push(raiz)
        continue
      }
      abriu = true
      for (const arquivo of lista.arquivos) {
        const remoto = `${arquivo.pasta}/${arquivo.nome}`
        if (vistos.has(remoto)) continue
        vistos.add(remoto)
        const buffer = await client.get(remoto)
        const conteudo = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer)
        fs.mkdirSync(destino, { recursive: true })
        const local = path.join(destino, `${Date.now()}-${arquivo.nome.replace(/[^\w.-]+/g, '_')}`)
        fs.writeFileSync(local, conteudo)
        baixados.push({ remoto, nome: arquivo.nome, local, conteudo })
      }
    }
    if (!abriu) {
      throw new Error(`Nenhuma pasta de retorno abriu na VAN (${falhas.join(', ')}).`)
    }
  } finally {
    await client.end().catch(() => {})
  }
  return baixados
}
