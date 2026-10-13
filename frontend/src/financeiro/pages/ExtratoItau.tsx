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
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { api, type CredencialExtratoItau, type EmpresaCompleta, type LancamentoExtratoItau } from '../api'
import { Barra, BotaoEditar, cnpjFormatado, PainelLateral, quando, Resumo, Resumos, Secao, Selo, TabelaConfig, Titulo, type Coluna, type Tom } from '../components/ConfigUi'
import { usePrefs } from '../prefs'

const NOVA: CredencialExtratoItau = {
  id: '',
  nome: 'Extrato conta corrente',
  empresa_id: null,
  empresa: null,
  cnpj: null,
  ambiente: 'producao',
  client_id: '',
  segredo_definido: false,
  certificado_definido: false,
  chave_definida: false,
  ativo: true,
  pronta: false,
  ultima_coleta: null,
  ultimo_ok: null,
  ultima_mensagem: null,
}

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function situacao(acesso: CredencialExtratoItau, t: (pt: string, en: string) => string): { texto: string; tom: Tom } {
  if (!acesso.pronta) return { texto: t('Incompleta', 'Incomplete'), tom: 'alerta' }
  if (!acesso.ativo) return { texto: t('Pausada', 'Paused'), tom: 'neutro' }
  if (acesso.ultimo_ok === false) return { texto: t('Com erro', 'Error'), tom: 'erro' }
  if (acesso.ultimo_ok === true) return { texto: t('Coletando', 'Collecting'), tom: 'ok' }
  return { texto: t('Aguardando coleta', 'Waiting'), tom: 'ok' }
}

export function ExtratoItauPage() {
  const { t, idioma } = usePrefs()
  const [credenciais, setCredenciais] = useState<CredencialExtratoItau[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoExtratoItau[]>([])
  const [empresas, setEmpresas] = useState<EmpresaCompleta[]>([])
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<CredencialExtratoItau | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [coletando, setColetando] = useState(false)

  const carregar = () => {
    api.credenciaisExtratoItau().then(setCredenciais).catch((err: unknown) => setErro(err instanceof Error ? err.message : t('Não carregou', 'Could not load')))
    api.lancamentosExtratoItau().then((res) => setLancamentos(res.lancamentos || [])).catch(() => setLancamentos([]))
    api.empresasTodas().then(setEmpresas).catch(() => setEmpresas([]))
  }

  useEffect(() => { carregar() }, [])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return credenciais
    return credenciais.filter((item) => `${item.nome} ${item.empresa || ''} ${item.client_id}`.toLowerCase().includes(termo))
  }, [credenciais, busca])

  const prontas = credenciais.filter((item) => item.pronta && item.ativo)
  const comErro = credenciais.filter((item) => item.ultimo_ok === false)

  const coletar = async () => {
    setColetando(true)
    try {
      await api.coletarExtratoItau()
      setAviso(t('Consulta do extrato iniciada. Os lançamentos atualizam em instantes.', 'Statement pull started. Entries update shortly.'))
      setTimeout(() => { carregar(); setColetando(false) }, 6000)
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não iniciou a coleta', 'Could not start the pull'))
      setColetando(false)
    }
  }

  const colunas: Coluna<CredencialExtratoItau>[] = [
    { titulo: t('Credencial', 'Credential'), render: (item) => <Titulo texto={item.nome} sub={item.empresa || t('Grupo inteiro', 'Whole group')} /> },
    { titulo: t('Ambiente', 'Environment'), render: (item) => (item.ambiente === 'producao' ? t('Produção', 'Production') : t('Homologação', 'Sandbox')) },
    { titulo: 'Client ID', render: (item) => <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{item.client_id || '—'}</Box> },
    { titulo: t('Certificado', 'Certificate'), render: (item) => (item.certificado_definido && item.chave_definida ? t('Dinâmico', 'Dynamic') : '—') },
    { titulo: t('Situação', 'Status'), render: (item) => { const s = situacao(item, t); return <Selo texto={s.texto} tom={s.tom} /> } },
    {
      titulo: t('Última consulta', 'Last pull'),
      largura: 280,
      render: (item) => (item.ultima_coleta ? (
        <>
          <Typography sx={{ fontSize: 13 }}>{quando(item.ultima_coleta, idioma)}</Typography>
          <Typography sx={{ fontSize: 12, color: item.ultimo_ok === false ? 'error.main' : 'text.secondary', maxWidth: 280 }} noWrap title={item.ultima_mensagem || ''}>
            {item.ultima_mensagem}
          </Typography>
        </>
      ) : '—'),
    },
    { titulo: ' ', align: 'right', largura: 48, render: (item) => <BotaoEditar onClick={() => setEditando(item)} /> },
  ]

  const colunasLancamentos: Coluna<LancamentoExtratoItau>[] = [
    { titulo: t('Data', 'Date'), render: (item) => item.data_contabil || '—' },
    { titulo: t('Conta', 'Account'), render: (item) => <Titulo texto={item.empresa} sub={`${item.agencia} / ${item.numero}-${item.digito || ''}`} /> },
    { titulo: t('Lançamento', 'Entry'), render: (item) => <Titulo texto={item.literal || '—'} sub={[item.origem_tipo, item.contraparte_nome].filter(Boolean).join(' · ')} /> },
    { titulo: t('Valor', 'Amount'), align: 'right', render: (item) => `${item.operacao === 'D' ? '−' : '+'} ${reais(item.valor)}` },
    {
      titulo: t('Conciliação', 'Match'),
      render: (item) => (item.despesa_id
        ? <Selo texto={item.despesa || t('Despesa sugerida', 'Suggested bill')} tom="ok" />
        : <Selo texto={t('Sem par', 'Unmatched')} tom="neutro" />),
    },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo={t('Credenciais prontas', 'Ready credentials')} valor={`${prontas.length}`} detalhe={t('entram na coleta automática', 'included in the automatic pull')} />
        <Resumo rotulo={t('Com erro', 'With error')} valor={String(comErro.length)} detalhe={t('na última consulta', 'on the last pull')} />
        <Resumo rotulo={t('Lançamentos', 'Entries')} valor={String(lancamentos.length)} detalhe={t('últimos trazidos do extrato', 'latest pulled from the statement')} />
      </Resumos>

      <Alert severity="info">
        {t(
          'A conta consultada precisa ser do mesmo CNPJ da credencial. O identificador é agência (4) + 00 + conta (5) + DAC. O certificado é o dinâmico do Developers, não o A1 e-CNPJ.',
          'The account must belong to the same CNPJ as the credential. The id is branch (4) + 00 + account (5) + check digit. The certificate is the Developers dynamic cert, not the company A1.',
        )}
      </Alert>

      <Barra busca={busca} onBusca={setBusca} placeholder={t('Buscar credencial ou Client ID', 'Search credential or Client ID')}>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setEditando(NOVA)}>
          {t('Nova credencial', 'New credential')}
        </Button>
        <Button variant="outlined" startIcon={<RefreshIcon />} disabled={coletando || !prontas.length} onClick={coletar}>
          {coletando ? t('Consultando…', 'Pulling…') : t('Consultar agora', 'Pull now')}
        </Button>
      </Barra>

      {erro ? <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert> : null}

      <TabelaConfig colunas={colunas} linhas={visiveis} chave={(item) => item.id} vazio={t('Nenhuma credencial do extrato.', 'No statement credential.')} onLinha={setEditando} />

      <Typography sx={{ fontSize: 13, fontWeight: 650 }}>{t('Últimos lançamentos', 'Latest entries')}</Typography>
      <TabelaConfig colunas={colunasLancamentos} linhas={lancamentos} chave={(item) => item.id} vazio={t('Ainda não há lançamento coletado.', 'No statement entries yet.')} />

      {editando ? (
        <FormCredencial
          key={editando.id || 'nova'}
          credencial={editando}
          empresas={empresas}
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
        <Typography sx={{ fontSize: 13 }}>{rotulo}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
          {nome || (carregado ? t('Já salvo. Envie outro só para trocar.', 'Already saved. Upload only to replace.') : t('Nenhum arquivo', 'No file'))}
        </Typography>
      </Box>
      <Button size="small" variant="outlined" component="label">
        {t('Escolher', 'Choose')}
        <input hidden type="file" accept={accept} onChange={(ev) => { const arquivo = ev.target.files?.[0]; if (arquivo) onEscolher(arquivo); ev.target.value = '' }} />
      </Button>
    </Paper>
  )
}

function FormCredencial({ credencial, empresas, onFechar, onSalvo }: {
  credencial: CredencialExtratoItau
  empresas: EmpresaCompleta[]
  onFechar: () => void
  onSalvo: (mensagem: string) => void
}) {
  const { t } = usePrefs()
  const [form, setForm] = useState({
    nome: credencial.nome,
    empresa_id: credencial.empresa_id || '',
    ambiente: credencial.ambiente,
    client_id: credencial.client_id,
    client_secret: '',
    ativo: credencial.ativo,
  })
  const [cert, setCert] = useState({ conteudo: '', nome: '' })
  const [chave, setChave] = useState({ conteudo: '', nome: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(false)

  const salvar = async () => {
    setErro('')
    if (!credencial.segredo_definido && !form.client_secret) return setErro(t('Informe o Client Secret. Ele só aparece uma vez no portal.', 'Enter the Client Secret. The portal shows it only once.'))
    if (!credencial.certificado_definido && !cert.conteudo) return setErro(t('Envie o certificado dinâmico (.crt).', 'Upload the dynamic certificate (.crt).'))
    if (!credencial.chave_definida && !chave.conteudo) return setErro(t('Envie a chave privada usada no CSR.', 'Upload the private key used for the CSR.'))
    setSalvando(true)
    try {
      await api.salvarCredencialExtratoItau({
        id: credencial.id || undefined,
        ...form,
        empresa_id: form.empresa_id || null,
        cert_pem: cert.conteudo,
        key_pem: chave.conteudo,
      })
      onSalvo(t('Credencial do extrato salva.', 'Statement credential saved.'))
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não salvou', 'Could not save'))
    } finally {
      setSalvando(false)
    }
  }

  const remover = async () => {
    if (!credencial.id) return
    setRemovendo(true)
    try {
      await api.removerCredencialExtratoItau(credencial.id)
      onSalvo(t('Credencial removida.', 'Credential removed.'))
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não removeu', 'Could not remove'))
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <PainelLateral
      aberto
      titulo={credencial.id ? credencial.nome : t('Nova credencial', 'New credential')}
      subtitulo={t('API de Extrato Conta Corrente', 'Current-account statement API')}
      onFechar={onFechar}
      rodape={(
        <>
          {credencial.id ? (
            <Button color="error" disabled={removendo || salvando} onClick={remover}>
              {removendo ? t('Removendo…', 'Removing…') : t('Remover', 'Remove')}
            </Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar}>{t('Cancelar', 'Cancel')}</Button>
          <Button variant="contained" disabled={salvando || !form.client_id} onClick={salvar}>
            {salvando ? t('Salvando…', 'Saving…') : t('Salvar', 'Save')}
          </Button>
        </>
      )}
    >
      <Secao titulo={t('Aplicação no Itaú for Developers', 'App on Itaú for Developers')}>
        <TextField label={t('Nome', 'Name')} size="small" value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} />
        <TextField select label={t('Alcance', 'Scope')} size="small" value={form.empresa_id} onChange={(ev) => setForm({ ...form, empresa_id: ev.target.value })} helperText={t('Uma aplicação pode valer para um CNPJ ou para o grupo.', 'One app can cover one CNPJ or the whole group.')}>
          <MenuItem value="">{t('Todo o grupo', 'Whole group')}</MenuItem>
          {empresas.filter((item) => item.ativo).map((item) => (
            <MenuItem key={item.id} value={item.id}>{item.apelido || item.razao_social} · {cnpjFormatado(item.cnpj)}</MenuItem>
          ))}
        </TextField>
        <TextField select label={t('Ambiente', 'Environment')} size="small" value={form.ambiente} onChange={(ev) => setForm({ ...form, ambiente: ev.target.value as CredencialExtratoItau['ambiente'] })}>
          <MenuItem value="producao">{t('Produção', 'Production')}</MenuItem>
          <MenuItem value="homologacao">{t('Homologação', 'Sandbox')}</MenuItem>
        </TextField>
        <TextField label="Client ID" size="small" value={form.client_id} onChange={(ev) => setForm({ ...form, client_id: ev.target.value })} helperText={t('O banco pediu para devolver este Client ID no acompanhamento.', 'The bank asked for this Client ID in the follow-up.')} />
        <TextField
          label="Client Secret"
          type="password"
          size="small"
          autoComplete="new-password"
          value={form.client_secret}
          placeholder={credencial.segredo_definido ? '••••••••' : ''}
          onChange={(ev) => setForm({ ...form, client_secret: ev.target.value })}
          helperText={credencial.segredo_definido ? t('Já salvo. Preencha só para trocar.', 'Already saved. Fill only to replace.') : t('Copie na hora da criação. O portal não mostra de novo.', 'Copy it when it is created. The portal does not show it again.')}
        />
      </Secao>
      <Divider />
      <Secao titulo={t('Certificado dinâmico', 'Dynamic certificate')}>
        <Arquivo rotulo={t('Certificado (.crt)', 'Certificate (.crt)')} nome={cert.nome} carregado={credencial.certificado_definido} accept=".crt,.pem,.cer" onEscolher={async (arquivo) => setCert({ conteudo: await arquivo.text(), nome: arquivo.name })} />
        <Arquivo rotulo={t('Chave privada (.key)', 'Private key (.key)')} nome={chave.nome} carregado={credencial.chave_definida} accept=".key,.pem" onEscolher={async (arquivo) => setChave({ conteudo: await arquivo.text(), nome: arquivo.name })} />
      </Secao>
      <Divider />
      <FormControlLabel
        control={<Switch checked={form.ativo} onChange={(ev) => setForm({ ...form, ativo: ev.target.checked })} />}
        label={<Typography sx={{ fontSize: 13 }}>{t('Incluir na coleta automática', 'Include in the automatic pull')}</Typography>}
      />
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}
