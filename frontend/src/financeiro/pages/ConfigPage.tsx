import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined'
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined'
import HubOutlinedIcon from '@mui/icons-material/HubOutlined'
import AddIcon from '@mui/icons-material/Add'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import { api, type ConfigBkoffice, type PlanoCompleto } from '../api'
import {
  Aviso, Barra, Erro, FiltroSituacao, mensagem, PainelLateral, porSituacao, quando, Resumo, Resumos, Secao, Selo, TabelaConfig, Titulo,
  useBusca, type Coluna, type Situacao,
} from '../components/ConfigUi'
import { usePrefs } from '../prefs'
import { AcessoItauPage } from './AcessoItau'
import { AcessosBb } from './AcessosBb'
import { Contas, Empresas, Fornecedores, POR_PAGINA } from './Cadastros'

const CARDS = [
  ['empresas', 'Empresas', 'Lojas e holdings. A loja entra com BK.', StorefrontOutlinedIcon],
  ['contas', 'Contas bancárias', 'Caixa, Banco do Brasil e Itaú, com o nome do cadastro.', AccountBalanceOutlinedIcon],
  ['plano', 'Plano de contas', 'Classificação do que é a pagar.', AccountTreeOutlinedIcon],
  ['fornecedores', 'Fornecedores', 'Cadastro financeiro e o plano padrão.', LocalShippingOutlinedIcon],
  ['formas', 'Formas de pagamento', 'Boleto e guia no geral. Folha, cadastro e PIX só no freelancer.', PaymentsOutlinedIcon],
  ['usuarios', 'Usuários', 'Quem prepara e quem autoriza.', PeopleOutlinedIcon],
  ['bkoffice', 'BK Office', 'Usuário, senha e endereço da API que traz as vendas.', HubOutlinedIcon],
  ['itau', 'Itaú', 'Caixa postal da VAN para o retorno de DDA.', AccountBalanceOutlinedIcon],
  ['bb', 'Banco do Brasil', 'Acesso da API de DDA, um por empresa.', AccountBalanceOutlinedIcon],
] as const

const CARDS_EN: Record<string, [string, string]> = {
  empresas: ['Companies', 'Stores and holdings. A store comes in with BK.'],
  contas: ['Bank accounts', 'Cash, Banco do Brasil and Itaú, with the record name.'],
  plano: ['Chart of accounts', 'How payables are classified.'],
  fornecedores: ['Suppliers', 'Financial record and default account.'],
  formas: ['Payment methods', 'Boleto and tax slip in general. Payroll, record and PIX only for freelancers.'],
  usuarios: ['Users', 'Who prepares and who authorizes.'],
  bkoffice: ['BK Office', 'User, password and API address that brings sales.'],
  itau: ['Itaú', 'VAN mailbox for the DDA return file.'],
  bb: ['Banco do Brasil', 'DDA API access, one per company.'],
}

export function ConfigPage() {
  const { idioma } = usePrefs()
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>
      {CARDS.map(([id, titulo, texto, Icon]) => (
        (() => {
          const en = CARDS_EN[id]
          const nome = idioma === 'en' ? en[0] : titulo
          const detalhe = idioma === 'en' ? en[1] : texto
          return (
        <Paper
          key={id}
          component={Link}
          to={`/financeiro/configuracoes/${id}`}
          variant="outlined"
          sx={{
            p: 2,
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
            transition: 'border-color 120ms',
            '&:hover': { borderColor: 'primary.main' },
          }}
        >
          <Box sx={{ width: 36, height: 36, borderRadius: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', flexShrink: 0 }}>
            <Icon fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 500, mb: 0.25 }}>{nome}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{detalhe}</Typography>
          </Box>
        </Paper>
          )
        })()
      ))}
    </Box>
  )
}

export function ConfigDetalhePage() {
  const { secao = '' } = useParams()
  const navigate = useNavigate()
  const { t } = usePrefs()

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0, overflow: 'auto', pb: 2 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/financeiro/configuracoes')} sx={{ alignSelf: 'flex-start' }}>{t('Voltar', 'Back')}</Button>
      {secao === 'empresas' && <Empresas />}
      {secao === 'contas' && <Contas />}
      {secao === 'plano' && <PlanoContas />}
      {secao === 'fornecedores' && <Fornecedores />}
      {secao === 'formas' && <Formas />}
      {secao === 'usuarios' && <Usuarios />}
      {secao === 'bkoffice' && <BkOffice />}
      {secao === 'itau' && <AcessoItauPage />}
      {secao === 'bb' && <AcessosBb />}
    </Stack>
  )
}

const textoPlano = (p: PlanoCompleto) => p.nome

function PlanoContas() {
  const [planos, setPlanos] = useState<PlanoCompleto[]>([])
  const [filtro, setFiltro] = useState<Situacao>('ativos')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<PlanoCompleto | 'novo' | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregar = () => api.planosTodos().then(setPlanos).catch((err) => setErro(mensagem(err)))
  useEffect(() => { carregar() }, [])

  const noFiltro = useMemo(() => porSituacao(planos, filtro, (p) => p.ativo), [planos, filtro])
  const { busca, setBusca, filtradas } = useBusca(noFiltro, textoPlano)
  useEffect(() => { setPagina(0) }, [busca, filtro])

  const ativos = planos.filter((p) => p.ativo)
  const semUso = ativos.filter((p) => !p.despesas && !p.fornecedores).length

  const colunas: Coluna<PlanoCompleto>[] = [
    { titulo: 'Plano', render: (p) => <Titulo texto={p.nome} sub={p.natureza === 'fixa' ? 'Fixa' : p.natureza === 'variavel' ? 'Variável' : undefined} /> },
    { titulo: 'Tipo', render: (p) => <Selo texto={p.tipo === 'a_pagar' ? 'A pagar' : 'A receber'} tom={p.tipo === 'a_pagar' ? 'neutro' : 'info'} /> },
    {
      titulo: 'Uso',
      render: (p) => (
        <Typography sx={{ fontSize: 13, color: p.despesas || p.fornecedores ? 'text.primary' : 'text.secondary' }}>
          {p.despesas} {p.despesas === 1 ? 'despesa' : 'despesas'} · {p.fornecedores} {p.fornecedores === 1 ? 'fornecedor' : 'fornecedores'}
        </Typography>
      ),
    },
    { titulo: 'Situação', render: (p) => <Selo texto={p.ativo ? 'Ativo' : 'Inativo'} tom={p.ativo ? 'ok' : 'neutro'} /> },
    { titulo: ' ', align: 'right', render: (p) => <Button size="small" onClick={(ev) => { ev.stopPropagation(); setEditando(p) }}>Editar</Button> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo="Planos ativos" valor={String(ativos.length)} detalhe="disponíveis para classificar" />
        <Resumo rotulo="Sem uso" valor={String(semUso)} detalhe="nenhuma despesa ou fornecedor" />
        <Resumo rotulo="Inativos" valor={String(planos.length - ativos.length)} detalhe="guardados pelo histórico" />
      </Resumos>
      <Barra busca={busca} onBusca={setBusca} placeholder="Buscar plano">
        <FiltroSituacao valor={filtro} onMudar={setFiltro} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('novo')}>Novo plano</Button>
      </Barra>
      <Erro erro={erro} />
      <TabelaConfig
        colunas={colunas}
        linhas={filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)}
        chave={(p) => p.id}
        vazio="Nenhum plano encontrado."
        onLinha={setEditando}
        paginacao={{ total: filtradas.length, pagina, por: POR_PAGINA, onPagina: setPagina }}
      />
      {editando ? (
        <FormPlano
          key={editando === 'novo' ? 'novo' : editando.id}
          plano={editando === 'novo' ? null : editando}
          onFechar={() => setEditando(null)}
          onSalvo={(texto) => { setEditando(null); setAviso(texto); carregar() }}
        />
      ) : null}
      <Aviso texto={aviso} onFechar={() => setAviso('')} />
    </Stack>
  )
}

function FormPlano({ plano, onFechar, onSalvo }: { plano: PlanoCompleto | null; onFechar: () => void; onSalvo: (texto: string) => void }) {
  const [form, setForm] = useState({
    nome: plano?.nome || '',
    tipo: plano?.tipo || 'a_pagar',
    natureza: plano?.natureza || '',
    codigo_obrigacao: plano?.codigo_obrigacao || '',
    codigo_provisao: plano?.codigo_provisao || '',
    ativo: plano ? plano.ativo : true,
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const emUso = Boolean(plano && (plano.despesas || plano.fornecedores))

  const salvar = async () => {
    setSalvando(true)
    setErro('')
    try {
      await api.salvarPlano(plano?.id || null, form)
      onSalvo(plano ? `Plano “${form.nome}” atualizado.` : `Plano “${form.nome}” criado.`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não salvou')
    } finally {
      setSalvando(false)
    }
  }

  const apagar = async () => {
    if (!plano) return
    if (!confirmando) { setConfirmando(true); return }
    setSalvando(true)
    try {
      const r = await api.apagarPlano(plano.id)
      onSalvo(r.inativado ? `Plano “${plano.nome}” inativado. Ele está em uso e fica no histórico.` : `Plano “${plano.nome}” apagado.`)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não apagou')
      setSalvando(false)
    }
  }

  return (
    <PainelLateral
      aberto
      titulo={plano ? plano.nome : 'Novo plano'}
      subtitulo={plano ? `${plano.despesas} despesas · ${plano.fornecedores} fornecedores usam este plano` : 'Classificação para as despesas'}
      onFechar={onFechar}
      rodape={(
        <>
          {plano ? (
            <Button color="error" disabled={salvando} onClick={apagar}>
              {confirmando ? (emUso ? 'Confirmar inativação' : 'Confirmar exclusão') : (emUso ? 'Inativar' : 'Apagar')}
            </Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar}>Cancelar</Button>
          <Button variant="contained" disabled={salvando || !form.nome.trim()} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </>
      )}
    >
      <Secao titulo="Plano">
        <TextField label="Nome" size="small" value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} autoFocus={!plano} />
        <TextField select label="Tipo" size="small" value={form.tipo} onChange={(ev) => setForm({ ...form, tipo: ev.target.value as PlanoCompleto['tipo'] })}>
          <MenuItem value="a_pagar">A pagar</MenuItem>
          <MenuItem value="a_receber">A receber</MenuItem>
        </TextField>
        <TextField select label="Natureza" size="small" value={form.natureza} onChange={(ev) => setForm({ ...form, natureza: ev.target.value })}>
          <MenuItem value="">Não informada</MenuItem>
          <MenuItem value="fixa">Fixa</MenuItem>
          <MenuItem value="variavel">Variável</MenuItem>
        </TextField>
      </Secao>
      <Secao titulo="Contábil">
        <TextField label="Código de obrigação" size="small" value={form.codigo_obrigacao} onChange={(ev) => setForm({ ...form, codigo_obrigacao: ev.target.value })} />
        <TextField label="Código de provisão" size="small" value={form.codigo_provisao} onChange={(ev) => setForm({ ...form, codigo_provisao: ev.target.value })} />
      </Secao>
      <FormControlLabel
        control={<Switch checked={form.ativo} onChange={(ev) => setForm({ ...form, ativo: ev.target.checked })} />}
        label={<Typography sx={{ fontSize: 13 }}>Disponível para classificar despesas</Typography>}
      />
      {confirmando ? (
        <Alert severity="warning">
          {emUso
            ? 'Este plano está em uso, então ele será inativado: some da classificação, mas continua nas despesas e fornecedores que já usam.'
            : 'Este plano não tem uso e será apagado de vez.'}
        </Alert>
      ) : null}
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}

type Forma = { id: string; forma: string; uso: 'geral' | 'freelancer'; detalhe: string }

const FORMAS: Forma[] = [
  { id: 'boleto', forma: 'Boleto', uso: 'geral', detalhe: 'Pago pelo código de barras. Pode chegar pelo DDA.' },
  { id: 'guia', forma: 'Guia', uso: 'geral', detalhe: 'Guia de recolhimento.' },
  { id: 'dinheiro', forma: 'Dinheiro', uso: 'geral', detalhe: 'Pago em espécie.' },
  { id: 'online', forma: 'Online', uso: 'geral', detalhe: 'Pago online.' },
  { id: 'folha', forma: 'Folha', uso: 'freelancer', detalhe: 'Pago junto da folha.' },
  { id: 'cadastro', forma: 'Cadastro', uso: 'freelancer', detalhe: 'Pago na conta do cadastro da pessoa, que fica no FreeControl.' },
  { id: 'pix', forma: 'Chave PIX', uso: 'freelancer', detalhe: 'Pago por chave PIX.' },
]

function Formas() {
  const colunas: Coluna<Forma>[] = [
    { titulo: 'Forma', render: (f) => <Titulo texto={f.forma} /> },
    { titulo: 'Uso', render: (f) => <Selo texto={f.uso === 'geral' ? 'Despesa em geral' : 'Freelancer e treinamento'} tom={f.uso === 'geral' ? 'neutro' : 'info'} /> },
    { titulo: 'Como funciona', render: (f) => <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{f.detalhe}</Typography> },
  ]
  const geral = FORMAS.filter((f) => f.uso === 'geral').length

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo="Despesa em geral" valor={String(geral)} detalhe="formas disponíveis" />
        <Resumo rotulo="Freelancer e treinamento" valor={String(FORMAS.length - geral)} detalhe="a pessoa continua no FreeControl" />
      </Resumos>
      <TabelaConfig colunas={colunas} linhas={FORMAS} chave={(f) => f.id} />
    </Stack>
  )
}

type Papel = { id: string; papel: string; quem: string; faz: string; move: boolean }

const PAPEIS: Papel[] = [
  { id: 'ia', papel: 'Assistente', quem: 'IA', faz: 'Lê DDA, notas e vendas e prepara o lançamento com plano sugerido.', move: false },
  { id: 'financeiro', papel: 'Financeiro', quem: 'Equipe financeira', faz: 'Revisa e completa o lançamento, do rascunho até deixar pronto.', move: false },
  { id: 'felipe', papel: 'Autorizador', quem: 'Felipe', faz: 'Autoriza o que está pronto. Sem essa autorização nada segue ao banco.', move: true },
]

function Usuarios() {
  const colunas: Coluna<Papel>[] = [
    { titulo: 'Papel', render: (p) => <Titulo texto={p.papel} sub={p.quem} /> },
    { titulo: 'O que faz', render: (p) => <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{p.faz}</Typography> },
    { titulo: 'Autoriza pagamento', render: (p) => <Selo texto={p.move ? 'Sim' : 'Não'} tom={p.move ? 'ok' : 'neutro'} /> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo="Etapas" valor="3" detalhe="IA prepara, financeiro revisa, Felipe autoriza" />
        <Resumo rotulo="Quem autoriza" valor="1" detalhe="nenhum pagamento sai sem o Felipe" />
      </Resumos>
      <TabelaConfig colunas={colunas} linhas={PAPEIS} chave={(p) => p.id} />
    </Stack>
  )
}

type SyncVendas = { mensagem: string; criado_em: string; ok: boolean } | null

function BkOffice() {
  const [cfg, setCfg] = useState<ConfigBkoffice | null>(null)
  const [sync, setSync] = useState<SyncVendas>(null)
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregar = () => {
    api.configBkoffice().then(setCfg).catch((err) => setErro(mensagem(err)))
    api.vendas(new Date().toLocaleDateString('sv-SE')).then((r) => setSync(r.ultimo_sync)).catch(() => undefined)
  }
  useEffect(carregar, [])

  const configurado = Boolean(cfg?.usuario && cfg?.senha_definida)
  const situacao = !configurado
    ? <Selo texto="Sem acesso" tom="neutro" />
    : sync === null ? <Selo texto="Aguardando coleta" tom="ok" /> : sync.ok ? <Selo texto="Coletando" tom="ok" /> : <Selo texto="Com erro" tom="erro" />

  const colunas: Coluna<ConfigBkoffice>[] = [
    { titulo: 'Integração', render: () => <Titulo texto="BK Office" sub="Vendas das lojas" /> },
    { titulo: 'Usuário', render: (c) => c.usuario || '—' },
    { titulo: 'Setor', render: (c) => c.setor || '—' },
    { titulo: 'Situação', render: () => situacao },
    {
      titulo: 'Última coleta',
      largura: 280,
      render: () => (sync ? (
        <>
          <Typography sx={{ fontSize: 13 }}>{quando(sync.criado_em)}</Typography>
          <Typography sx={{ fontSize: 12, color: sync.ok ? 'text.secondary' : 'error.main', maxWidth: 280 }} noWrap title={sync.mensagem}>{sync.mensagem}</Typography>
        </>
      ) : '—'),
    },
    { titulo: ' ', align: 'right', render: () => <Button size="small" onClick={(ev) => { ev.stopPropagation(); setEditando(true) }}>{configurado ? 'Editar' : 'Configurar'}</Button> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo="Acesso" valor={configurado ? 'Configurado' : 'Pendente'} detalhe="usuário e senha do portal" />
        <Resumo rotulo="Última coleta" valor={sync ? quando(sync.criado_em) : '—'} detalhe={sync ? (sync.ok ? 'sem erro' : 'com erro') : 'nenhuma hoje'} />
        <Resumo rotulo="Frequência" valor="3 min" detalhe="coleta automática" />
      </Resumos>
      <Erro erro={erro} />
      <TabelaConfig colunas={colunas} linhas={cfg ? [cfg] : []} chave={() => 'bkoffice'} vazio="Carregando…" onLinha={() => setEditando(true)} />
      {editando && cfg ? (
        <FormBkoffice
          cfg={cfg}
          onFechar={() => setEditando(false)}
          onSalvo={() => { setEditando(false); setAviso('Acesso do BK Office salvo. A próxima coleta usa esse acesso.'); carregar() }}
        />
      ) : null}
      <Snackbar open={!!aviso} autoHideDuration={3600} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
    </Stack>
  )
}

function FormBkoffice({ cfg, onFechar, onSalvo }: { cfg: ConfigBkoffice; onFechar: () => void; onSalvo: () => void }) {
  const [form, setForm] = useState({ usuario: cfg.usuario, senha: '', api: cfg.api, setor: cfg.setor || '1005196' })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    setSalvando(true)
    setErro('')
    try {
      await api.salvarBkoffice(form)
      onSalvo()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não salvou')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <PainelLateral
      aberto
      titulo="BK Office"
      subtitulo="Acesso ao portal que traz as vendas"
      onFechar={onFechar}
      rodape={(
        <>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar}>Cancelar</Button>
          <Button variant="contained" disabled={salvando || !form.usuario} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </>
      )}
    >
      <Secao titulo="Login do portal">
        <TextField label="Usuário" size="small" value={form.usuario} onChange={(ev) => setForm({ ...form, usuario: ev.target.value })} />
        <TextField
          label="Senha"
          type="password"
          size="small"
          autoComplete="new-password"
          value={form.senha}
          placeholder={cfg.senha_definida ? '••••••••' : ''}
          onChange={(ev) => setForm({ ...form, senha: ev.target.value })}
          helperText={cfg.senha_definida ? 'Já salva. Preencha só para trocar.' : undefined}
        />
      </Secao>
      <Secao titulo="Endereço">
        <TextField label="API" size="small" value={form.api} onChange={(ev) => setForm({ ...form, api: ev.target.value })} />
        <TextField label="Setor" size="small" value={form.setor} onChange={(ev) => setForm({ ...form, setor: ev.target.value })} />
      </Secao>
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}
