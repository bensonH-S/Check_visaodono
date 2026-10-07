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
import { Barra, cnpjFormatado, PainelLateral, quando, Resumo, Resumos, Secao, Selo, TabelaConfig, Titulo, type Coluna, type Tom } from '../components/ConfigUi'

function base64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binario)
}

function situacao(acesso: AcessoBb): { texto: string; tom: Tom } {
  if (!acesso.cadastrada) return { texto: 'Sem acesso', tom: 'neutro' }
  if (!acesso.pronta) return { texto: 'Incompleto', tom: 'alerta' }
  if (!acesso.ativo) return { texto: 'Pausado', tom: 'neutro' }
  if (acesso.ultimo_ok === false) return { texto: 'Com erro', tom: 'erro' }
  if (acesso.ultimo_ok === true) return { texto: 'Coletando', tom: 'ok' }
  return { texto: 'Aguardando coleta', tom: 'ok' }
}

export function AcessosBb() {
  const [acessos, setAcessos] = useState<AcessoBb[]>([])
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<AcessoBb | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [coletando, setColetando] = useState(false)

  const carregar = () => api.acessosBb().then(setAcessos).catch((err: unknown) => setErro(err instanceof Error ? err.message : 'Não carregou'))

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
      setAviso('Consulta iniciada. O status de cada empresa atualiza em instantes.')
      setTimeout(() => { carregar(); setColetando(false) }, 6000)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não iniciou a coleta')
      setColetando(false)
    }
  }

  const colunas: Coluna<AcessoBb>[] = [
    { titulo: 'Empresa', render: (a) => <Titulo texto={a.empresa} sub={a.razao_social} /> },
    { titulo: 'CNPJ', render: (a) => <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{cnpjFormatado(a.cnpj)}</Box> },
    { titulo: 'Ambiente', render: (a) => (a.cadastrada ? (a.ambiente === 'producao' ? 'Produção' : 'Homologação') : '—') },
    { titulo: 'Certificado', render: (a) => (a.certificado_definido ? (a.certificado_pasta ? 'A1 na pasta' : 'A1 carregado') : '—') },
    { titulo: 'Situação', render: (a) => { const s = situacao(a); return <Selo texto={s.texto} tom={s.tom} /> } },
    {
      titulo: 'Última consulta',
      largura: 280,
      render: (a) => (a.ultima_coleta ? (
        <>
          <Typography sx={{ fontSize: 13 }}>{quando(a.ultima_coleta)}</Typography>
          <Typography sx={{ fontSize: 12, color: a.ultimo_ok === false ? 'error.main' : 'text.secondary', maxWidth: 280 }} noWrap title={a.ultima_mensagem || ''}>
            {a.ultima_mensagem}
          </Typography>
        </>
      ) : '—'),
    },
    {
      titulo: ' ',
      align: 'right',
      render: (a) => <Button size="small" onClick={(ev) => { ev.stopPropagation(); setEditando(a) }}>{a.cadastrada ? 'Editar' : 'Configurar'}</Button>,
    },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo="Empresas com acesso" valor={`${prontas.length} de ${acessos.length}`} detalhe="entram na coleta automática" />
        <Resumo rotulo="Em produção" valor={String(producao.length)} detalhe="com certificado A1" />
        <Resumo rotulo="Com erro" valor={String(comErro.length)} detalhe="na última consulta" />
      </Resumos>

      <Barra busca={busca} onBusca={setBusca} placeholder="Buscar empresa ou CNPJ">
        <Button variant="outlined" startIcon={<RefreshIcon />} disabled={coletando || !prontas.length} onClick={coletar}>
          {coletando ? 'Consultando…' : 'Consultar agora'}
        </Button>
      </Barra>

      {erro ? <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert> : null}

      <TabelaConfig colunas={colunas} linhas={visiveis} chave={(a) => a.empresa_id} vazio="Nenhuma empresa encontrada." onLinha={setEditando} />

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
  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'var(--ga-canvas-alt)' }}>
      <UploadFileOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{rotulo}</Typography>
        <Typography sx={{ fontSize: 12, color: nome ? 'text.primary' : 'text.secondary' }} noWrap>
          {nome || (carregado ? 'Já carregado. Escolha outro para trocar.' : 'Nenhum arquivo')}
        </Typography>
      </Box>
      <Button size="small" variant="outlined" component="label">
        Escolher
        <input hidden type="file" accept={accept} onChange={(ev) => { const f = ev.target.files?.[0]; if (f) onEscolher(f); ev.target.value = '' }} />
      </Button>
    </Paper>
  )
}

function FormAcesso({ acesso, onFechar, onSalvo }: { acesso: AcessoBb; onFechar: () => void; onSalvo: (mensagem: string) => void }) {
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
    if (!acesso.segredo_definido && !form.client_secret) return setErro('Informe o client secret.')
    setSalvando(true)
    try {
      await api.salvarAcessoBb(acesso.empresa_id, {
        ...form,
        pfx: tipoCert === 'pfx' ? pfx.conteudo : '',
        cert_pem: tipoCert === 'pem' ? cert.conteudo : '',
        key_pem: tipoCert === 'pem' ? chave.conteudo : '',
      })
      onSalvo(`Acesso de ${acesso.empresa} salvo.`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não salvou')
    } finally {
      setSalvando(false)
    }
  }

  const remover = async () => {
    setRemovendo(true)
    try {
      await api.removerAcessoBb(acesso.empresa_id)
      onSalvo(`Acesso de ${acesso.empresa} removido.`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não removeu')
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
            <Button color="error" disabled={removendo || salvando} onClick={remover}>{removendo ? 'Removendo…' : 'Remover acesso'}</Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar}>Cancelar</Button>
          <Button variant="contained" disabled={salvando || !form.client_id || !form.app_key} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      )}
    >
      <Secao titulo="Aplicação no Portal Developers">
        <TextField select label="Ambiente" size="small" value={form.ambiente} onChange={(ev) => setForm({ ...form, ambiente: ev.target.value as AcessoBb['ambiente'] })}>
          <MenuItem value="homologacao">Homologação</MenuItem>
          <MenuItem value="producao">Produção</MenuItem>
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
          helperText={acesso.segredo_definido ? 'Já salvo. Preencha só para trocar.' : undefined}
        />
        <TextField label="Developer application key" size="small" value={form.app_key} onChange={(ev) => setForm({ ...form, app_key: ev.target.value })} helperText="gw-dev-app-key" />
      </Secao>

      <Divider />

      <Secao titulo="Certificado A1 da empresa">
        <TextField select label="Formato" size="small" value={tipoCert} onChange={(ev) => setTipoCert(ev.target.value as 'pfx' | 'pem')}>
          <MenuItem value="pfx">Arquivo .pfx / .p12</MenuItem>
          <MenuItem value="pem">Certificado e chave em PEM</MenuItem>
        </TextField>
        {tipoCert === 'pfx' ? (
          <Arquivo
            rotulo="Certificado A1"
            nome={pfx.nome}
            carregado={acesso.certificado_definido}
            accept=".pfx,.p12"
            onEscolher={async (f) => setPfx({ conteudo: base64(await f.arrayBuffer()), nome: f.name })}
          />
        ) : (
          <>
            <Arquivo rotulo="Certificado" nome={cert.nome} carregado={acesso.certificado_definido} accept=".pem,.crt,.cer" onEscolher={async (f) => setCert({ conteudo: await f.text(), nome: f.name })} />
            <Arquivo rotulo="Chave privada" nome={chave.nome} carregado={acesso.chave_definida} accept=".pem,.key" onEscolher={async (f) => setChave({ conteudo: await f.text(), nome: f.name })} />
          </>
        )}
        <TextField
          label="Senha do certificado"
          type="password"
          size="small"
          autoComplete="new-password"
          value={form.cert_pass}
          onChange={(ev) => setForm({ ...form, cert_pass: ev.target.value })}
          helperText={acesso.certificado_pasta
            ? 'A1 já está na pasta Certificados desta empresa. Só a senha, se for produção.'
            : 'Obrigatório em produção. Homologação consulta sem certificado.'}
        />
      </Secao>

      <Divider />

      <FormControlLabel
        control={<Switch checked={form.ativo} onChange={(ev) => setForm({ ...form, ativo: ev.target.checked })} />}
        label={<Typography sx={{ fontSize: 13 }}>Incluir esta empresa na coleta automática</Typography>}
      />

      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}
