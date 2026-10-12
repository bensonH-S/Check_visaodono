import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import { api, type ConfigBkoffice, type PlanoCompleto } from '../api'
import {
  Aviso, Barra, BotaoEditar, Erro, FiltroSituacao, mensagem, PainelLateral, porSituacao, quando, Resumo, Resumos, Secao, Selo, TabelaConfig, Titulo,
  useBusca, type Coluna, type Situacao,
} from '../components/ConfigUi'
import { usePrefs } from '../prefs'
import { AcessoItauPage } from './AcessoItau'
import { AcessosBb } from './AcessosBb'
import { Contas, Empresas, Fornecedores, POR_PAGINA } from './Cadastros'

const BASE_CONFIG = '/configuracoes/financeiro'

/** URLs antigas `/financeiro/configuracoes/:secao` → Configurações. */
export function RedirectConfigFinanceiroAntiga() {
  const { secao } = useParams()
  return <Navigate to={secao ? `${BASE_CONFIG}/${secao}` : BASE_CONFIG} replace />
}

export function ConfigPage() {
  return <Navigate to={`${BASE_CONFIG}/empresas`} replace />
}

export function ConfigDetalhePage() {
  const { secao = '' } = useParams()

  return (
    <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, height: '100%', pb: 0.5 }}>
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
  const { t } = usePrefs()
  const [planos, setPlanos] = useState<PlanoCompleto[]>([])
  const [filtro, setFiltro] = useState<Situacao>('ativos')
  const [pagina, setPagina] = useState(0)
  const [editando, setEditando] = useState<PlanoCompleto | 'novo' | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregar = () => api.planosTodos().then(setPlanos).catch((err) => setErro(mensagem(err, t('Não carregou', 'Could not load'))))
  useEffect(() => { carregar() }, [])

  const noFiltro = useMemo(() => porSituacao(planos, filtro, (p) => p.ativo), [planos, filtro])
  const { busca, setBusca, filtradas } = useBusca(noFiltro, textoPlano)
  useEffect(() => { setPagina(0) }, [busca, filtro])

  const ativos = planos.filter((p) => p.ativo)
  const semUso = ativos.filter((p) => !p.despesas && !p.fornecedores).length

  const colunas: Coluna<PlanoCompleto>[] = [
    {
      titulo: t('Plano', 'Account'),
      render: (p) => (
        <Titulo
          texto={p.nome}
          sub={p.natureza === 'fixa' ? t('Fixa', 'Fixed') : p.natureza === 'variavel' ? t('Variável', 'Variable') : undefined}
        />
      ),
    },
    {
      titulo: t('Tipo', 'Type'),
      render: (p) => <Selo texto={p.tipo === 'a_pagar' ? t('A pagar', 'Payable') : t('A receber', 'Receivable')} tom={p.tipo === 'a_pagar' ? 'neutro' : 'info'} />,
    },
    {
      titulo: t('Uso', 'Usage'),
      render: (p) => (
        <Typography sx={{ fontSize: 13, color: p.despesas || p.fornecedores ? 'text.primary' : 'text.secondary' }}>
          {p.despesas} {p.despesas === 1 ? t('despesa', 'expense') : t('despesas', 'expenses')} · {p.fornecedores}{' '}
          {p.fornecedores === 1 ? t('fornecedor', 'supplier') : t('fornecedores', 'suppliers')}
        </Typography>
      ),
    },
    {
      titulo: t('Situação', 'Status'),
      render: (p) => <Selo texto={p.ativo ? t('Ativo', 'Active') : t('Inativo', 'Inactive')} tom={p.ativo ? 'ok' : 'neutro'} />,
    },
    { titulo: ' ', align: 'right', largura: 48, render: (p) => <BotaoEditar onClick={() => setEditando(p)} /> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo={t('Planos ativos', 'Active accounts')} valor={String(ativos.length)} detalhe={t('disponíveis para classificar', 'available for classification')} />
        <Resumo rotulo={t('Sem uso', 'Unused')} valor={String(semUso)} detalhe={t('nenhuma despesa ou fornecedor', 'no expense or supplier')} />
        <Resumo rotulo={t('Inativos', 'Inactive')} valor={String(planos.length - ativos.length)} detalhe={t('guardados pelo histórico', 'kept for history')} />
      </Resumos>
      <Barra busca={busca} onBusca={setBusca} placeholder={t('Buscar plano', 'Search account')}>
        <FiltroSituacao valor={filtro} onMudar={setFiltro} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando('novo')}>{t('Novo plano', 'New account')}</Button>
      </Barra>
      <Erro erro={erro} />
      <TabelaConfig
        colunas={colunas}
        linhas={filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)}
        chave={(p) => p.id}
        vazio={t('Nenhum plano encontrado.', 'No account found.')}
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
  const { t } = usePrefs()
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
      onSalvo(
        plano
          ? t(`Plano “${form.nome}” atualizado.`, `Account “${form.nome}” updated.`)
          : t(`Plano “${form.nome}” criado.`, `Account “${form.nome}” created.`),
      )
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não salvou', 'Could not save'))
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
      onSalvo(
        r.inativado
          ? t(`Plano “${plano.nome}” inativado. Ele está em uso e fica no histórico.`, `Account “${plano.nome}” deactivated. It is in use and stays in history.`)
          : t(`Plano “${plano.nome}” apagado.`, `Account “${plano.nome}” deleted.`),
      )
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não apagou', 'Could not delete'))
      setSalvando(false)
    }
  }

  return (
    <PainelLateral
      aberto
      titulo={plano ? plano.nome : t('Novo plano', 'New account')}
      subtitulo={plano
        ? t(`${plano.despesas} despesas · ${plano.fornecedores} fornecedores usam este plano`, `${plano.despesas} expenses · ${plano.fornecedores} suppliers use this account`)
        : t('Classificação para as despesas', 'Classification for expenses')}
      onFechar={onFechar}
      rodape={(
        <>
          {plano ? (
            <Button color="error" disabled={salvando} onClick={apagar}>
              {confirmando
                ? (emUso ? t('Confirmar inativação', 'Confirm deactivation') : t('Confirmar exclusão', 'Confirm delete'))
                : (emUso ? t('Inativar', 'Deactivate') : t('Apagar', 'Delete'))}
            </Button>
          ) : null}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar}>{t('Cancelar', 'Cancel')}</Button>
          <Button variant="contained" disabled={salvando || !form.nome.trim()} onClick={salvar}>
            {salvando ? t('Salvando…', 'Saving…') : t('Salvar', 'Save')}
          </Button>
        </>
      )}
    >
      <Secao titulo={t('Plano', 'Account')}>
        <TextField label={t('Nome', 'Name')} size="small" value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} autoFocus={!plano} />
        <TextField select label={t('Tipo', 'Type')} size="small" value={form.tipo} onChange={(ev) => setForm({ ...form, tipo: ev.target.value as PlanoCompleto['tipo'] })}>
          <MenuItem value="a_pagar">{t('A pagar', 'Payable')}</MenuItem>
          <MenuItem value="a_receber">{t('A receber', 'Receivable')}</MenuItem>
        </TextField>
        <TextField select label={t('Natureza', 'Nature')} size="small" value={form.natureza} onChange={(ev) => setForm({ ...form, natureza: ev.target.value })}>
          <MenuItem value="">{t('Não informada', 'Not set')}</MenuItem>
          <MenuItem value="fixa">{t('Fixa', 'Fixed')}</MenuItem>
          <MenuItem value="variavel">{t('Variável', 'Variable')}</MenuItem>
        </TextField>
      </Secao>
      <Secao titulo={t('Contábil', 'Accounting')}>
        <TextField label={t('Código de obrigação', 'Obligation code')} size="small" value={form.codigo_obrigacao} onChange={(ev) => setForm({ ...form, codigo_obrigacao: ev.target.value })} />
        <TextField label={t('Código de provisão', 'Provision code')} size="small" value={form.codigo_provisao} onChange={(ev) => setForm({ ...form, codigo_provisao: ev.target.value })} />
      </Secao>
      <FormControlLabel
        control={<Switch checked={form.ativo} onChange={(ev) => setForm({ ...form, ativo: ev.target.checked })} />}
        label={<Typography sx={{ fontSize: 13 }}>{t('Disponível para classificar despesas', 'Available to classify expenses')}</Typography>}
      />
      {confirmando ? (
        <Alert severity="warning">
          {emUso
            ? t(
              'Este plano está em uso, então ele será inativado: some da classificação, mas continua nas despesas e fornecedores que já usam.',
              'This account is in use, so it will be deactivated: it leaves classification, but stays on expenses and suppliers that already use it.',
            )
            : t('Este plano não tem uso e será apagado de vez.', 'This account is unused and will be deleted for good.')}
        </Alert>
      ) : null}
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}

type Forma = { id: string; formaPt: string; formaEn: string; uso: 'geral' | 'freelancer'; detalhePt: string; detalheEn: string }

const FORMAS: Forma[] = [
  { id: 'boleto', formaPt: 'Boleto', formaEn: 'Boleto', uso: 'geral', detalhePt: 'Pago pelo código de barras. Pode chegar pelo DDA.', detalheEn: 'Paid by barcode. May arrive via DDA.' },
  { id: 'guia', formaPt: 'Guia', formaEn: 'Tax slip', uso: 'geral', detalhePt: 'Guia de recolhimento.', detalheEn: 'Tax payment slip.' },
  { id: 'dinheiro', formaPt: 'Dinheiro', formaEn: 'Cash', uso: 'geral', detalhePt: 'Pago em espécie.', detalheEn: 'Paid in cash.' },
  { id: 'online', formaPt: 'Online', formaEn: 'Online', uso: 'geral', detalhePt: 'Pago online.', detalheEn: 'Paid online.' },
  { id: 'folha', formaPt: 'Folha', formaEn: 'Payroll', uso: 'freelancer', detalhePt: 'Pago junto da folha.', detalheEn: 'Paid with payroll.' },
  { id: 'cadastro', formaPt: 'Cadastro', formaEn: 'Registry', uso: 'freelancer', detalhePt: 'Pago na conta do cadastro da pessoa, que fica no FreeControl.', detalheEn: 'Paid to the person’s registry account in FreeControl.' },
  { id: 'pix', formaPt: 'Chave PIX', formaEn: 'PIX key', uso: 'freelancer', detalhePt: 'Pago por chave PIX.', detalheEn: 'Paid by PIX key.' },
]

function Formas() {
  const { t, idioma } = usePrefs()
  const colunas: Coluna<Forma>[] = [
    { titulo: t('Forma', 'Method'), render: (f) => <Titulo texto={idioma === 'en' ? f.formaEn : f.formaPt} /> },
    {
      titulo: t('Uso', 'Usage'),
      render: (f) => (
        <Selo
          texto={f.uso === 'geral' ? t('Despesa em geral', 'General expense') : t('Freelancer e treinamento', 'Freelancer and training')}
          tom={f.uso === 'geral' ? 'neutro' : 'info'}
        />
      ),
    },
    {
      titulo: t('Como funciona', 'How it works'),
      render: (f) => (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          {idioma === 'en' ? f.detalheEn : f.detalhePt}
        </Typography>
      ),
    },
  ]
  const geral = FORMAS.filter((f) => f.uso === 'geral').length

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo rotulo={t('Despesa em geral', 'General expense')} valor={String(geral)} detalhe={t('formas disponíveis', 'available methods')} />
        <Resumo rotulo={t('Freelancer e treinamento', 'Freelancer and training')} valor={String(FORMAS.length - geral)} detalhe={t('a pessoa continua no FreeControl', 'the person stays in FreeControl')} />
      </Resumos>
      <TabelaConfig colunas={colunas} linhas={FORMAS} chave={(f) => f.id} />
    </Stack>
  )
}

type Papel = { id: string; papelPt: string; papelEn: string; quemPt: string; quemEn: string; fazPt: string; fazEn: string; move: boolean }

const PAPEIS: Papel[] = [
  {
    id: 'ia',
    papelPt: 'Assistente',
    papelEn: 'Assistant',
    quemPt: 'IA',
    quemEn: 'AI',
    fazPt: 'Lê DDA, notas e vendas e prepara o lançamento com plano sugerido.',
    fazEn: 'Reads DDA, invoices and sales and prepares the entry with a suggested account.',
    move: false,
  },
  {
    id: 'financeiro',
    papelPt: 'Financeiro',
    papelEn: 'Finance',
    quemPt: 'Equipe financeira',
    quemEn: 'Finance team',
    fazPt: 'Revisa e completa o lançamento, do rascunho até deixar pronto.',
    fazEn: 'Reviews and completes the entry, from draft to ready.',
    move: false,
  },
  {
    id: 'felipe',
    papelPt: 'Autorizador',
    papelEn: 'Authorizer',
    quemPt: 'Felipe',
    quemEn: 'Felipe',
    fazPt: 'Autoriza o que está pronto. Sem essa autorização nada segue ao banco.',
    fazEn: 'Authorizes what is ready. Without this approval nothing goes to the bank.',
    move: true,
  },
]

function Usuarios() {
  const { t, idioma } = usePrefs()
  const colunas: Coluna<Papel>[] = [
    {
      titulo: t('Papel', 'Role'),
      render: (p) => <Titulo texto={idioma === 'en' ? p.papelEn : p.papelPt} sub={idioma === 'en' ? p.quemEn : p.quemPt} />,
    },
    {
      titulo: t('O que faz', 'What they do'),
      render: (p) => <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{idioma === 'en' ? p.fazEn : p.fazPt}</Typography>,
    },
    {
      titulo: t('Autoriza pagamento', 'Authorizes payment'),
      render: (p) => <Selo texto={p.move ? t('Sim', 'Yes') : t('Não', 'No')} tom={p.move ? 'ok' : 'neutro'} />,
    },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo
          rotulo={t('Etapas', 'Steps')}
          valor="3"
          detalhe={t('IA prepara, financeiro revisa, Felipe autoriza', 'AI prepares, finance reviews, Felipe authorizes')}
        />
        <Resumo
          rotulo={t('Quem autoriza', 'Who authorizes')}
          valor="1"
          detalhe={t('nenhum pagamento sai sem o Felipe', 'no payment leaves without Felipe')}
        />
      </Resumos>
      <TabelaConfig colunas={colunas} linhas={PAPEIS} chave={(p) => p.id} />
    </Stack>
  )
}

type SyncVendas = { mensagem: string; criado_em: string; ok: boolean } | null

function BkOffice() {
  const { t, idioma } = usePrefs()
  const [cfg, setCfg] = useState<ConfigBkoffice | null>(null)
  const [sync, setSync] = useState<SyncVendas>(null)
  const [editando, setEditando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')

  const carregar = () => {
    api.configBkoffice().then(setCfg).catch((err) => setErro(mensagem(err, t('Não carregou', 'Could not load'))))
    api.vendas(new Date().toLocaleDateString('sv-SE')).then((r) => setSync(r.ultimo_sync)).catch(() => undefined)
  }
  useEffect(carregar, [])

  const configurado = Boolean(cfg?.usuario && cfg?.senha_definida)
  const situacao = !configurado
    ? <Selo texto={t('Sem acesso', 'No access')} tom="neutro" />
    : sync === null
      ? <Selo texto={t('Aguardando coleta', 'Waiting')} tom="ok" />
      : sync.ok
        ? <Selo texto={t('Coletando', 'Collecting')} tom="ok" />
        : <Selo texto={t('Com erro', 'Error')} tom="erro" />

  const colunas: Coluna<ConfigBkoffice>[] = [
    { titulo: t('Integração', 'Integration'), render: () => <Titulo texto="BK Office" sub={t('Vendas das lojas', 'Store sales')} /> },
    { titulo: t('Usuário', 'User'), render: (c) => c.usuario || '—' },
    { titulo: t('Setor', 'Sector'), render: (c) => c.setor || '—' },
    { titulo: t('Situação', 'Status'), render: () => situacao },
    {
      titulo: t('Última coleta', 'Last pull'),
      largura: 280,
      render: () => (sync ? (
        <>
          <Typography sx={{ fontSize: 13 }}>{quando(sync.criado_em, idioma)}</Typography>
          <Typography sx={{ fontSize: 12, color: sync.ok ? 'text.secondary' : 'error.main', maxWidth: 280 }} noWrap title={sync.mensagem}>{sync.mensagem}</Typography>
        </>
      ) : '—'),
    },
    { titulo: ' ', align: 'right', largura: 48, render: () => <BotaoEditar onClick={() => setEditando(true)} configurar={!configurado} /> },
  ]

  return (
    <Stack spacing={2}>
      <Resumos>
        <Resumo
          rotulo={t('Acesso', 'Access')}
          valor={configurado ? t('Configurado', 'Configured') : t('Pendente', 'Pending')}
          detalhe={t('usuário e senha do portal', 'portal user and password')}
        />
        <Resumo
          rotulo={t('Última coleta', 'Last pull')}
          valor={sync ? quando(sync.criado_em, idioma) : '—'}
          detalhe={sync ? (sync.ok ? t('sem erro', 'no error') : t('com erro', 'with error')) : t('nenhuma hoje', 'none today')}
        />
        <Resumo rotulo={t('Frequência', 'Frequency')} valor="3 min" detalhe={t('coleta automática', 'automatic pull')} />
      </Resumos>
      <Erro erro={erro} />
      <TabelaConfig colunas={colunas} linhas={cfg ? [cfg] : []} chave={() => 'bkoffice'} vazio={t('Carregando…', 'Loading…')} onLinha={() => setEditando(true)} />
      {editando && cfg ? (
        <FormBkoffice
          cfg={cfg}
          onFechar={() => setEditando(false)}
          onSalvo={() => {
            setEditando(false)
            setAviso(t('Acesso do BK Office salvo. A próxima coleta usa esse acesso.', 'BK Office access saved. The next pull uses this access.'))
            carregar()
          }}
        />
      ) : null}
      <Snackbar open={!!aviso} autoHideDuration={3600} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
    </Stack>
  )
}

function FormBkoffice({ cfg, onFechar, onSalvo }: { cfg: ConfigBkoffice; onFechar: () => void; onSalvo: () => void }) {
  const { t } = usePrefs()
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
      setErro(err instanceof Error ? err.message : t('Não salvou', 'Could not save'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <PainelLateral
      aberto
      titulo="BK Office"
      subtitulo={t('Acesso ao portal que traz as vendas', 'Access to the portal that brings sales')}
      onFechar={onFechar}
      rodape={(
        <>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onFechar}>{t('Cancelar', 'Cancel')}</Button>
          <Button variant="contained" disabled={salvando || !form.usuario} onClick={salvar}>
            {salvando ? t('Salvando…', 'Saving…') : t('Salvar', 'Save')}
          </Button>
        </>
      )}
    >
      <Secao titulo={t('Login do portal', 'Portal login')}>
        <TextField label={t('Usuário', 'User')} size="small" value={form.usuario} onChange={(ev) => setForm({ ...form, usuario: ev.target.value })} />
        <TextField
          label={t('Senha', 'Password')}
          type="password"
          size="small"
          autoComplete="new-password"
          value={form.senha}
          placeholder={cfg.senha_definida ? '••••••••' : ''}
          onChange={(ev) => setForm({ ...form, senha: ev.target.value })}
          helperText={cfg.senha_definida ? t('Já salva. Preencha só para trocar.', 'Already saved. Fill only to replace.') : undefined}
        />
      </Secao>
      <Secao titulo={t('Endereço', 'Endpoint')}>
        <TextField label="API" size="small" value={form.api} onChange={(ev) => setForm({ ...form, api: ev.target.value })} />
        <TextField label={t('Setor', 'Sector')} size="small" value={form.setor} onChange={(ev) => setForm({ ...form, setor: ev.target.value })} />
      </Secao>
      {erro ? <Alert severity="error">{erro}</Alert> : null}
    </PainelLateral>
  )
}
