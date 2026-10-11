import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import RefreshIcon from '@mui/icons-material/Refresh'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { api, type AcessoBb } from '../api'
import { Barra, BotaoEditar, cnpjFormatado, PainelLateral, quando, Resumo, Resumos, Secao, Selo, TabelaConfig, Titulo, type Coluna, type Tom } from '../components/ConfigUi'
import { usePrefs } from '../prefs'

function base64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

function situacao(acesso: AcessoBb, t: (pt: string, en: string) => string): { texto: string; tom: Tom } {
  if (!acesso.cadastrada) return { texto: t('Sem acesso', 'No access'), tom: 'neutro' }
  if (!acesso.pronta) return { texto: t('Incompleto', 'Incomplete'), tom: 'alerta' }
  if (!acesso.ativo) return { texto: t('Pausado', 'Paused'), tom: 'neutro' }
  if (acesso.ultimo_ok === false) return { texto: t('Com erro', 'Error'), tom: 'erro' }
  if (acesso.ultimo_ok === true) return { texto: t('Coletando', 'Collecting'), tom: 'ok' }
  return { texto: t('Aguardando coleta', 'Waiting'), tom: 'ok' }
}

function mensagemColeta(texto: string | null | undefined, t: (pt: string, en: string) => string) {
  if (!texto) return ''
  const m = texto.match(/^(\d+) boleto\(s\),\s*(\d+) novo\(s\)\.?$/)
  if (m) {
    return t(
      `${m[1]} boleto(s), ${m[2]} novo(s).`,
      `${m[1]} boleto${m[1] === '1' ? '' : 's'}, ${m[2]} new.`,
    )
  }
  const fixas: Record<string, [string, string]> = {
    'Nenhum boleto a pagar no período.': ['Nenhum boleto a pagar no período.', 'No boletos to pay in the period.'],
    'VAN consultada. Nenhum retorno novo.': ['VAN consultada. Nenhum retorno novo.', 'VAN checked. No new returns.'],
  }
  const par = fixas[texto]
  return par ? t(par[0], par[1]) : texto
}

export function AcessosBb() {
  const { t, idioma } = usePrefs()
  const [acessos, setAcessos] = useState<AcessoBb[]>([])
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<AcessoBb | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [coletando, setColetando] = useState(false)

  const carregar = () => api.acessosBb().then(setAcessos).catch((err: unknown) => setErro(err instanceof Error ? err.message : t('Não carregou', 'Could not load')))

  useEffect(() => { carregar() }, [])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return acessos
    return acessos.filter((a) => `${a.empresa} ${a.razao_social} ${a.cnpj || ''}`.toLowerCase().includes(termo))
  }, [acessos, busca])

  const prontas = acessos.filter((a) => a.pronta && a.ativo)
  const producao = prontas.filter((a) => a.ambiente === 'producao')
  const comErro = acessos.filter((a) => a.cadastrada && a.ultimo_ok === false)

  const coletar = async () => {
    setColetando(true)
    try {
      await api.coletarBb()
      setAviso(t('Consulta iniciada. O status de cada empresa atualiza em instantes.', 'Pull started. Each company status updates shortly.'))
      setTimeout(() => { carregar(); setColetando(false) }, 6000)
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não iniciou a coleta', 'Could not start the pull'))
      setColetando(false)
    }
  }

  const colunas: Coluna<AcessoBb>[] = [
    { titulo: t('Empresa', 'Company'), render: (a) => <Titulo texto={a.empresa} sub={a.razao_social} /> },
    { titulo: 'CNPJ', render: (a) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cnpjFormatado(a.cnpj)}</Box> },
    {
      titulo: t('Ambiente', 'Environment'),
      render: (a) => (a.cadastrada ? (a.ambiente === 'producao' ? t('Produção', 'Production') : t('Homologação', 'Sandbox')) : '—'),
    },
    {
      titulo: t('Certificado', 'Certificate'),
      render: (a) => (a.certificado_definido ? (a.certificado_pasta ? t('A1 na pasta', 'A1 on disk') : t('A1 carregado', 'A1 loaded')) : '—'),
    },
    { titulo: t('Situação', 'Status'), render: (a) => { const s = situacao(a, t); return <Selo texto={s.texto} tom={s.tom} /> } },
    {
      titulo: t('Última consulta', 'Last pull'),
      largura: 280,
      render: (a) => (a.ultima_coleta ? (
        <>
          <Typography sx={{ fontSize: 13 }}>{quando(a.ultima_coleta, idioma)}</Typography>
          <Typography sx={{ fontSize: 12, color: a.ultimo_ok === false ? 'error.main' : 'text.secondary', maxWidth: 280 }} noWrap title={a.ultima_mensagem || ''}>
            {mensagemColeta(a.ultima_mensagem, t)}
          </Typography>
        </>
      ) : '—'),
    },
    { titulo: ' ', align: 'right', largura: 48, render: (a) => <BotaoEditar onClick={() => setEditando(a)} configurar={!a.cadastrada} /> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo
          rotulo={t('Empresas com acesso', 'Companies with access')}
          valor={`${prontas.length} ${t('de', 'of')} ${acessos.length}`}
          detalhe={t('entram na coleta automática', 'included in the automatic pull')}
        />
        <Resumo rotulo={t('Em produção', 'In production')} valor={String(producao.length)} detalhe={t('com certificado A1', 'with A1 certificate')} />
        <Resumo rotulo={t('Com erro', 'With error')} valor={String(comErro.length)} detalhe={t('na última consulta', 'on the last pull')} />
      </Resumos>

      <Barra busca={busca} onBusca={setBusca} placeholder={t('Buscar empresa ou CNPJ', 'Search company or CNPJ')}>
        <Button variant="outlined" startIcon={<RefreshIcon />} disabled={coletando || !prontas.length} onClick={coletar}>
          {coletando ? t('Consultando…', 'Pulling…') : t('Consultar agora', 'Pull now')}
        </Button>
      </Barra>

      {erro ? <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert> : null}

      <TabelaConfig colunas={colunas} linhas={visiveis} chave={(a) => a.empresa_id} vazio={t('Nenhuma empresa encontrada.', 'No company found.')} onLinha={setEditando} />

      {editando ? (
        <FormAcesso
          key={editando.empresa_id}
          acesso={editando}
          onFechar={() => setEditando(null)}
          onSalvo={(mensagem) => { setEditando(null); setAviso(mensagem); carregar() }}
        />
      ) : null}

      <Snackbar open={!!aviso} autoHideDuration={3600} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
    </Stack>
  )
}

function Arquivo({ rotulo, nome, carregado, accept, onEscolher }: {
  rotulo: string
  nome: string
  carregado: boolean
  accept: string
  onEscolher: (arquivo: File) => void
}) {
  const { t } = usePrefs()
  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'var(--ga-canvas-alt)' }}>
      <UploadFileOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{rotulo}</Typography>
        <Typography sx={{ fontSize: 12, color: nome ? 'text.primary' : 'text.secondary' }} noWrap>
          {nome || (carregado ? t('Já carregado. Escolha outro para trocar.', 'Already loaded. Choose another to replace.') : t('Nenhum arquivo', 'No file'))}
        </Typography>
      </Box>
      <Button size="small" variant="outlined" component="label">
        {t('Escolher', 'Choose')}
        <input hidden type="file" accept={accept} onChange={(ev) => { const f = ev.target.files?.[0]; if (f) onEscolher(f); ev.target.value = '' }} />
      </Button>
    </Paper>
  )
}

function FormAcesso({ acesso, onFechar, onSalvo }: { acesso: AcessoBb; onFechar: () => void; onSalvo: (mensagem: string) => void }) {
  const { t } = usePrefs()
  const [form, setForm] = useState({
    ambiente: acesso.ambiente,
    client_id: acesso.client_id,
    client_secret: '',
    app_key: acesso.app_key,
    cert_pass: '',
    ativo: acesso.cadastrada ? acesso.ativo : true,
  })
  const [tipoCert, setTipoCert] = useState<'pfx' | 'pem'>('pfx')
  const [pfx, setPfx] = useState({ conteudo: '', nome: '' })
  const [cert, setCert] = useState({ conteudo: '', nome: '' })
  const [chave, setChave] = useState({ conteudo: '', nome: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(false)

  const salvar = async () => {
    setErro('')
    if (!acesso.segredo_definido && !form.client_secret) return setErro(t('Informe o client secret.', 'Enter the client secret.'))
    setSalvando(true)
    try {
      await api.salvarAcessoBb(acesso.empresa_id, {
        ...form,
        pfx: tipoCert === 'pfx' ? pfx.conteudo : '',
        cert_pem: tipoCert === 'pem' ? cert.conteudo : '',
        key_pem: tipoCert === 'pem' ? chave.conteudo : '',
      })
      onSalvo(t(`Acesso de ${acesso.empresa} salvo.`, `Access for ${acesso.empresa} saved.`))
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não salvou', 'Could not save'))
    } finally {
      setSalvando(false)
    }
  }

  const remover = async () => {
    setRemovendo(true)
    try {
      await api.removerAcessoBb(acesso.empresa_id)
      onSalvo(t(`Acesso de ${acesso.empresa} removido.`, `Access for ${acesso.empresa} removed.`))
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não removeu', 'Could not remove'))
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <PainelLateral
      aberto
      titulo={acesso.empresa}
      subtitulo={`${acesso.razao_social} · ${cnpjFormatado(acesso.cnpj)}`}
      onFechar={onFechar}
      rodape={(
        <>
          {acesso.cadastrada ? (
            <Button color="error" disabled={removendo || salvando} onClick={remover}>
              {removendo ? t('Removendo…', 'Removing…') : t('Remover acesso', 'Remove access')}
            </Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar}>{t('Cancelar', 'Cancel')}</Button>
          <Button variant="contained" disabled={salvando || !form.client_id || !form.app_key} onClick={salvar}>
            {salvando ? t('Salvando…', 'Saving…') : t('Salvar', 'Save')}
          </Button>
        </>
      )}
    >
      <Secao titulo={t('Aplicação no Portal Developers', 'App on the Developers Portal')}>
        <TextField select label={t('Ambiente', 'Environment')} size="small" value={form.ambiente} onChange={(ev) => setForm({ ...form, ambiente: ev.target.value as AcessoBb['ambiente'] })}>
          <MenuItem value="homologacao">{t('Homologação', 'Sandbox')}</MenuItem>
          <MenuItem value="producao">{t('Produção', 'Production')}</MenuItem>
        </TextField>
        <TextField label="Client id" size="small" value={form.client_id} onChange={(ev) => setForm({ ...form, client_id: ev.target.value })} />
        <TextField
          label="Client secret"
          type="password"
          size="small"
          autoComplete="new-password"
          value={form.client_secret}
          placeholder={acesso.segredo_definido ? '••••••••' : ''}
          onChange={(ev) => setForm({ ...form, client_secret: ev.target.value })}
          helperText={acesso.segredo_definido ? t('Já salvo. Preencha só para trocar.', 'Already saved. Fill only to replace.') : undefined}
        />
        <TextField label="Developer application key" size="small" value={form.app_key} onChange={(ev) => setForm({ ...form, app_key: ev.target.value })} helperText="gw-dev-app-key" />
      </Secao>

      <Divider />

      <Secao titulo={t('Certificado A1 da empresa', 'Company A1 certificate')}>
        <TextField select label={t('Formato', 'Format')} size="small" value={tipoCert} onChange={(ev) => setTipoCert(ev.target.value as 'pfx' | 'pem')}>
          <MenuItem value="pfx">{t('Arquivo .pfx / .p12', '.pfx / .p12 file')}</MenuItem>
          <MenuItem value="pem">{t('Certificado e chave em PEM', 'Certificate and key as PEM')}</MenuItem>
        </TextField>
        {tipoCert === 'pfx' ? (
          <Arquivo
            rotulo={t('Certificado A1', 'A1 certificate')}
            nome={pfx.nome}
            carregado={acesso.certificado_definido}
            accept=".pfx,.p12"
            onEscolher={async (f) => setPfx({ conteudo: base64(await f.arrayBuffer()), nome: f.name })}
          />
        ) : (
          <>
            <Arquivo rotulo={t('Certificado', 'Certificate')} nome={cert.nome} carregado={acesso.certificado_definido} accept=".pem,.crt,.cer" onEscolher={async (f) => setCert({ conteudo: await f.text(), nome: f.name })} />
            <Arquivo rotulo={t('Chave privada', 'Private key')} nome={chave.nome} carregado={acesso.chave_definida} accept=".pem,.key" onEscolher={async (f) => setChave({ conteudo: await f.text(), nome: f.name })} />
          </>
        )}
        <TextField
          label={t('Senha do certificado', 'Certificate password')}
          type="password"
          size="small"
          autoComplete="new-password"
          value={form.cert_pass}
          onChange={(ev) => setForm({ ...form, cert_pass: ev.target.value })}
          helperText={acesso.certificado_pasta
            ? t('A1 já está na pasta Certificados desta empresa. Só a senha, se for produção.', 'A1 is already in this company’s Certificates folder. Password only if production.')
            : t('Obrigatório em produção. Homologação consulta sem certificado.', 'Required in production. Sandbox can query without a certificate.')}
        />
      </Secao>

      <Divider />

      <FormControlLabel
        control={<Switch checked={form.ativo} onChange={(ev) => setForm({ ...form, ativo: ev.target.checked })} />}
        label={<Typography sx={{ fontSize: 13 }}>{t('Incluir esta empresa na coleta automática', 'Include this company in the automatic pull')}</Typography>}
      />

      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}
