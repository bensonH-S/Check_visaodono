import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import RefreshIcon from '@mui/icons-material/Refresh'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { api, type AcessoItau } from '../api'
import { Erro, PainelLateral, quando, Resumo, Resumos, Secao, Selo, TabelaConfig, Titulo, type Coluna } from '../components/ConfigUi'
import { usePrefs } from '../prefs'

export function AcessoItauPage() {
  const { t } = usePrefs()
  const [cfg, setCfg] = useState<AcessoItau | null>(null)
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [coletando, setColetando] = useState(false)

  const carregar = () => api.acessoItau().then(setCfg).catch((err: unknown) => setErro(err instanceof Error ? err.message : t('Não carregou', 'Could not load')))

  useEffect(() => { carregar() }, [])

  const situacao = !cfg?.pronta
    ? <Selo texto={cfg?.servidor ? t('No servidor', 'On the server') : t('Sem acesso', 'No access')} tom={cfg?.servidor ? 'alerta' : 'neutro'} />
    : !cfg.ativo ? <Selo texto={t('Pausado', 'Paused')} tom="neutro" />
      : cfg.ultimo_ok === false ? <Selo texto={t('Com erro', 'Error')} tom="erro" />
        : cfg.ultimo_ok === true ? <Selo texto={t('Coletando', 'Collecting')} tom="ok" />
          : <Selo texto={t('Aguardando coleta', 'Waiting')} tom="ok" />

  const colunas: Coluna<AcessoItau>[] = [
    { titulo: t('Integração', 'Integration'), render: () => <Titulo texto="Itaú SFG" sub={t('Caixa postal da VAN', 'VAN mailbox')} /> },
    { titulo: t('Host', 'Host'), render: (c) => c.host || '—' },
    { titulo: t('Usuário', 'User'), render: (c) => c.usuario || '—' },
    { titulo: t('Chave', 'Key'), render: (c) => (c.chave_definida ? t('SSH carregada', 'SSH loaded') : c.senha_definida ? t('Senha salva', 'Password saved') : '—') },
    { titulo: t('Situação', 'Status'), render: () => situacao },
    {
      titulo: t('Última consulta', 'Last pull'),
      largura: 280,
      render: (c) => (c.ultima_coleta ? (
        <>
          <Typography sx={{ fontSize: 13 }}>{quando(c.ultima_coleta)}</Typography>
          <Typography sx={{ fontSize: 12, color: c.ultimo_ok === false ? 'error.main' : 'text.secondary', maxWidth: 280 }} noWrap title={c.ultima_mensagem}>
            {c.ultima_mensagem}
          </Typography>
        </>
      ) : '—'),
    },
    {
      titulo: ' ',
      align: 'right',
      render: () => (
        <Button size="small" onClick={(ev) => { ev.stopPropagation(); setEditando(true) }}>
          {cfg?.pronta ? t('Editar', 'Edit') : t('Configurar', 'Set up')}
        </Button>
      ),
    },
  ]

  const coletar = async () => {
    setColetando(true)
    try {
      await api.coletarItau()
      setAviso(t('Consulta iniciada. O status atualiza em instantes.', 'Pull started. Status updates shortly.'))
      setTimeout(() => { carregar(); setColetando(false) }, 6000)
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não iniciou a coleta', 'Could not start the pull'))
      setColetando(false)
    }
  }

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo={t('Acesso', 'Access')} valor={cfg?.pronta ? t('Configurado', 'Configured') : t('Pendente', 'Pending')} detalhe={t('uma caixa postal para o grupo', 'one mailbox for the group')} />
        <Resumo rotulo={t('Última consulta', 'Last pull')} valor={cfg?.ultima_coleta ? quando(cfg.ultima_coleta) : '—'} detalhe={cfg?.ultima_mensagem || t('nenhuma ainda', 'none yet')} />
        <Resumo rotulo={t('Frequência', 'Frequency')} valor="15 min" detalhe={t('coleta automática', 'automatic pull')} />
      </Resumos>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="outlined" startIcon={<RefreshIcon />} disabled={coletando || !cfg?.pronta} onClick={coletar}>
          {coletando ? t('Consultando…', 'Pulling…') : t('Consultar agora', 'Pull now')}
        </Button>
      </Stack>
      <Erro erro={erro} />
      <TabelaConfig colunas={colunas} linhas={cfg ? [cfg] : []} chave={() => 'itau'} vazio={t('Carregando…', 'Loading…')} onLinha={() => setEditando(true)} />
      {editando && cfg ? (
        <FormItau
          cfg={cfg}
          onFechar={() => setEditando(false)}
          onSalvo={(mensagem) => { setEditando(false); setAviso(mensagem); carregar() }}
        />
      ) : null}
      <Snackbar open={!!aviso} autoHideDuration={3600} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
    </Stack>
  )
}

function FormItau({ cfg, onFechar, onSalvo }: { cfg: AcessoItau; onFechar: () => void; onSalvo: (mensagem: string) => void }) {
  const { t } = usePrefs()
  const [form, setForm] = useState({
    host: cfg.host,
    porta: String(cfg.porta || 22),
    usuario: cfg.usuario,
    senha: '',
    frase: '',
    produto: cfg.produto,
    pasta: cfg.pasta,
    ativo: cfg.ativo,
  })
  const [chave, setChave] = useState({ conteudo: '', nome: '' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    setErro('')
    if (!cfg.senha_definida && !cfg.chave_definida && !form.senha && !chave.conteudo) {
      setErro(t('Informe a senha ou a chave SSH.', 'Enter the password or the SSH key.'))
      return
    }
    setSalvando(true)
    try {
      await api.salvarItau({
        ...form,
        porta: Number(form.porta),
        chave: chave.conteudo,
      })
      onSalvo(t('Acesso do Itaú salvo. A próxima coleta usa essa caixa postal.', 'Itaú access saved. The next pull uses this mailbox.'))
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não salvou', 'Could not save'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <PainelLateral
      aberto
      titulo="Itaú"
      subtitulo={t('Caixa postal SFG da VAN. Vale para o grupo inteiro.', 'SFG mailbox on the VAN. It covers the whole group.')}
      onFechar={onFechar}
      rodape={(
        <>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar}>{t('Cancelar', 'Cancel')}</Button>
          <Button variant="contained" disabled={salvando || !form.host || !form.usuario} onClick={salvar}>
            {salvando ? t('Salvando…', 'Saving…') : t('Salvar', 'Save')}
          </Button>
        </>
      )}
    >
      <Secao titulo={t('Servidor SFTP', 'SFTP server')}>
        <TextField label={t('Host', 'Host')} size="small" value={form.host} onChange={(ev) => setForm({ ...form, host: ev.target.value })} />
        <TextField label={t('Porta', 'Port')} size="small" value={form.porta} onChange={(ev) => setForm({ ...form, porta: ev.target.value })} />
        <TextField label={t('Usuário', 'User')} size="small" value={form.usuario} onChange={(ev) => setForm({ ...form, usuario: ev.target.value })} />
        <TextField
          label={t('Senha', 'Password')}
          type="password"
          size="small"
          autoComplete="new-password"
          value={form.senha}
          placeholder={cfg.senha_definida ? '••••••••' : ''}
          onChange={(ev) => setForm({ ...form, senha: ev.target.value })}
          helperText={cfg.senha_definida ? t('Já salva. Preencha só para trocar.', 'Already saved. Fill only to replace.') : t('Opcional se houver chave SSH.', 'Optional when an SSH key is set.')}
        />
      </Secao>
      <Divider />
      <Secao titulo={t('Chave SSH', 'SSH key')}>
        <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'var(--ga-canvas-alt)' }}>
          <UploadFileOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{t('Chave privada', 'Private key')}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
              {chave.nome || (cfg.chave_definida ? t('Já carregada. Escolha outra para trocar.', 'Already loaded. Choose another to replace.') : t('Nenhum arquivo', 'No file'))}
            </Typography>
          </Box>
          <Button size="small" variant="outlined" component="label">
            {t('Escolher', 'Choose')}
            <input
              hidden
              type="file"
              accept=".pem,.key,.txt"
              onChange={async (ev) => {
                const arquivo = ev.target.files?.[0]
                if (arquivo) setChave({ conteudo: await arquivo.text(), nome: arquivo.name })
                ev.target.value = ''
              }}
            />
          </Button>
        </Paper>
        <TextField
          label={t('Frase da chave', 'Key passphrase')}
          type="password"
          size="small"
          autoComplete="new-password"
          value={form.frase}
          placeholder={cfg.frase_definida ? '••••••••' : ''}
          onChange={(ev) => setForm({ ...form, frase: ev.target.value })}
          helperText={cfg.frase_definida ? t('Já salva. Preencha só para trocar.', 'Already saved. Fill only to replace.') : undefined}
        />
      </Secao>
      <Divider />
      <Secao titulo={t('Pastas do retorno', 'Return folders')}>
        <TextField label={t('Produto', 'Product')} size="small" value={form.produto} onChange={(ev) => setForm({ ...form, produto: ev.target.value })} helperText={t('Opcional. Nome da pasta do produto na VAN.', 'Optional. Product folder name on the VAN.')} />
        <TextField label={t('Pasta', 'Folder')} size="small" value={form.pasta} onChange={(ev) => setForm({ ...form, pasta: ev.target.value })} helperText={t('Opcional. Caminho completo, separado por vírgula se houver mais de um.', 'Optional. Full path. Separate several with commas.')} />
      </Secao>
      <FormControlLabel
        control={<Switch checked={form.ativo} onChange={(ev) => setForm({ ...form, ativo: ev.target.checked })} />}
        label={<Typography sx={{ fontSize: 13 }}>{t('Incluir na coleta automática', 'Include in the automatic pull')}</Typography>}
      />
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}
