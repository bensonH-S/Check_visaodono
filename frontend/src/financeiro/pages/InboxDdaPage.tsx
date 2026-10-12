import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import { api, brl, emCache, urlDespesas, urlEmpresas, urlNotas, type Despesa, type Empresa, type NotaReceita } from '../api'
import { ordenarEmpresas, ordenarLancamentosPorEmpresa } from '../ordemEmpresas'
import { rotuloDespesa } from '../rotuloDespesa'
import { usePrefs } from '../prefs'
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota'
import SeletorLojaFinanceiro from '../SeletorLojaFinanceiro'

/** Conteúdo claro — alinhado ao temaFinanceiro (sidebar permanece escura no layout). */
const INBOX_BG = '#F4F7FB'
const INBOX_SURFACE = '#FFFFFF'
const INBOX_SURFACE_ALT = '#F8FAFC'
const INBOX_BORDER = 'rgba(15, 23, 42, 0.12)'
const INBOX_TEXT = '#0F172A'
const INBOX_MUTED = '#64748B'

const CAMPO_H = 32
const CAMPO_W = { xs: '100%', md: 220 } as const

const menuEscuroSx = {
  bgcolor: `${INBOX_SURFACE} !important`,
  backgroundColor: `${INBOX_SURFACE} !important`,
  color: INBOX_TEXT,
  backgroundImage: 'none',
  border: `1px solid ${INBOX_BORDER}`,
  maxHeight: 'min(70vh, 520px)',
  overflow: 'auto',
  '& .MuiMenuItem-root, & .MuiAutocomplete-option': {
    color: `${INBOX_TEXT} !important`,
    fontSize: 13,
    minHeight: 36,
    '&:hover, &[aria-selected="true"]': { bgcolor: 'rgba(27, 110, 243, 0.2) !important' },
    '&.Mui-focused': { bgcolor: 'rgba(27, 110, 243, 0.16) !important' },
  },
  '& .MuiList-root': { py: 0.5, maxHeight: 'none' },
} as const

const selectMenuEscuro = {
  MenuProps: {
    slotProps: {
      paper: { sx: menuEscuroSx },
      list: { dense: true, sx: { maxHeight: 'none', py: 0.5 } },
    },
  },
} as const

const campoInboxSx = {
  bgcolor: `${INBOX_SURFACE} !important`,
  borderRadius: '10px',
  '& .MuiOutlinedInput-root': {
    color: INBOX_TEXT,
    bgcolor: INBOX_SURFACE,
    minHeight: CAMPO_H,
    height: CAMPO_H,
    borderRadius: '10px !important',
    overflow: 'hidden',
    '& fieldset, & .MuiOutlinedInput-notchedOutline': {
      borderColor: INBOX_BORDER,
      borderRadius: '10px !important',
    },
    '&:hover fieldset, &:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(15, 23, 42, 0.28)',
    },
  },
  '& .MuiInputBase-input': {
    color: INBOX_TEXT,
    py: 0,
    height: CAMPO_H,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiInputLabel-root': { color: INBOX_MUTED },
  '& .MuiSelect-select': {
    py: '0 !important',
    display: 'flex',
    alignItems: 'center',
    minHeight: `${CAMPO_H}px !important`,
    height: CAMPO_H,
  },
  '& .MuiSelect-icon': { color: INBOX_MUTED },
} as const

const paperInboxSx = {
  bgcolor: INBOX_SURFACE,
  borderColor: INBOX_BORDER,
  color: INBOX_TEXT,
  '--ga-surface': INBOX_SURFACE_ALT,
  '--ga-text-muted': INBOX_MUTED,
  '--ga-border': INBOX_BORDER,
  '& .MuiTableCell-root': {
    borderColor: 'rgba(15, 23, 42, 0.08)',
    color: INBOX_TEXT,
  },
  '& .MuiTableHead-root .MuiTableCell-head, & .MuiTableCell-head, & .MuiTableCell-stickyHeader': {
    bgcolor: `${INBOX_SURFACE_ALT} !important`,
    backgroundColor: `${INBOX_SURFACE_ALT} !important`,
    color: `${INBOX_MUTED} !important`,
    fontWeight: 650,
    backgroundImage: 'none',
  },
  '& .MuiTablePagination-root, & .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
    color: INBOX_MUTED,
  },
  '& .MuiTablePagination-selectIcon': { color: INBOX_MUTED },
  '& .MuiIconButton-root': { color: INBOX_MUTED },
  '& .MuiTableRow-root.Mui-selected': {
    bgcolor: 'rgba(27, 110, 243, 0.1) !important',
  },
  '& .MuiTableRow-hover:hover': {
    bgcolor: 'rgba(15, 23, 42, 0.03)',
  },
} as const

const INBOX_STATUS = new Set(['rascunho', 'classificada', 'bloqueada_duplicata'])
const FILTROS = ['Todas', 'Vencidas', 'NF confirmada', 'Aguardando NF'] as const
const FILTROS_NF = ['Todas', 'Autorizadas', 'Canceladas', 'Com XML'] as const
const hoje = new Date().toISOString().slice(0, 10)

/** Checkbox da 1ª coluna: alinhado à esquerda, mesmo padding no thead e no tbody. */
const celulaCheckSx = {
  width: 44,
  minWidth: 44,
  maxWidth: 44,
  pl: '12px !important',
  pr: '4px !important',
  py: '6px !important',
  textAlign: 'left' as const,
  verticalAlign: 'middle' as const,
  lineHeight: 0,
}
const checkSx = {
  p: 0,
  m: 0,
  display: 'block',
  color: INBOX_MUTED,
  '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#1B6EF3' },
} as const
const celulaCentroSx = {
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}

function dataLocal(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

function periodoAtual() {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 1) % 7))
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 7)
  return { de: dataLocal(inicio), ate: dataLocal(fim) }
}

function periodoNotas() {
  const fim = new Date()
  const inicio = new Date()
  inicio.setDate(inicio.getDate() - 90)
  return { de: dataLocal(inicio), ate: dataLocal(fim) }
}

function dataBr(iso: string | null) {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

function rotuloDescricao(e: Despesa) {
  return rotuloDespesa(e)
}

/** Inbox: boletos DDA e notas destinadas ao CNPJ na Receita Federal. */
export function InboxDdaPage() {
  const { t, idioma } = usePrefs()
  const navigate = useNavigate()
  const [aba, setAba] = useState(0)
  const [empresas, setEmpresas] = useState<Empresa[]>(() => emCache<Empresa[]>(urlEmpresas()) ?? [])
  const [despesas, setDespesas] = useState<Despesa[]>(() => emCache<Despesa[]>(urlDespesas()) ?? [])
  const [loja, setLoja] = useState('')
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState(() => periodoAtual().de)
  const [ate, setAte] = useState(() => periodoAtual().ate)
  const [deNf, setDeNf] = useState(() => periodoNotas().de)
  const [ateNf, setAteNf] = useState(() => periodoNotas().ate)
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('Todas')
  const [erro, setErro] = useState('')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(30)
  const [notas, setNotas] = useState<NotaReceita[]>(() => emCache<{ notas: NotaReceita[] }>(urlNotas())?.notas ?? [])
  const [filtroNf, setFiltroNf] = useState<(typeof FILTROS_NF)[number]>('Todas')
  const [buscandoNf, setBuscandoNf] = useState(false)
  const [aviso, setAviso] = useState('')
  const [acaoNf, setAcaoNf] = useState<{ id: string; tipo: 'danfe' | 'agenda' } | null>(null)
  const [confirmacao, setConfirmacao] = useState<{
    titulo: string
    texto: string
    ids?: string[]
    notaId?: string
    modo: 'dda' | 'nf-dda' | 'nf-nova'
  } | null>(null)

  const carregarNotas = (empresa = loja) =>
    api.notasReceita(empresa || undefined).then((r) => {
      setNotas(r.notas)
    }).catch(() => undefined)

  const carregar = (empresa = loja) =>
    api.despesas(empresa || undefined).then((rows) => {
      setDespesas(rows)
      setErro('')
    }).catch(() => {
      setErro(t(
        'Não carregou o financeiro. Confira a permissão financeiro.ver.',
        'Could not load finance. Check the financeiro.ver permission.',
      ))
    })

  useEffect(() => {
    api.empresas().then(setEmpresas).catch(() => undefined)
    carregar('')
    carregarNotas('')
  }, [])

  const inbox = useMemo(
    () => despesas.filter((e) => e.fonte === 'dda' && INBOX_STATUS.has(e.status)),
    [despesas],
  )

  const noPeriodo = useMemo(() => inbox.filter((e) => {
    const vencimento = (e.vencimento || '').slice(0, 10)
    if (!vencimento) return !de && !ate
    if (de && vencimento < de) return false
    if (ate && vencimento > ate) return false
    return true
  }), [inbox, de, ate])

  const linhas = useMemo(() => {
    const filtradas = noPeriodo.filter((e) => {
      const texto = `${e.descricao} ${e.fornecedor ?? ''} ${e.origem} ${e.numero_nf ?? ''}`.toLowerCase()
      if (busca && !texto.includes(busca.toLowerCase())) return false
      if (filtro === 'Vencidas') return !!e.vencimento && e.vencimento < hoje
      if (filtro === 'NF confirmada') return e.nf_confirmada
      if (filtro === 'Aguardando NF') return !e.nf_confirmada
      return true
    })
    return ordenarLancamentosPorEmpresa(filtradas, empresas)
  }, [noPeriodo, busca, filtro, empresas])

  const notasNoPeriodo = useMemo(() => notas.filter((n) => {
    const emissao = (n.emissao || '').slice(0, 10)
    if (!emissao) return !deNf && !ateNf
    if (deNf && emissao < deNf) return false
    if (ateNf && emissao > ateNf) return false
    return true
  }), [notas, deNf, ateNf])

  const notasLinhas = useMemo(() => notasNoPeriodo.filter((n) => {
    const texto = `${n.emitente_nome ?? ''} ${n.numero ?? ''} ${n.origem ?? ''} ${n.chave}`.toLowerCase()
    if (busca && !texto.includes(busca.toLowerCase())) return false
    if (filtroNf === 'Autorizadas') return n.situacao === 'autorizada'
    if (filtroNf === 'Canceladas') return n.situacao === 'cancelada'
    if (filtroNf === 'Com XML') return n.tem_xml
    return true
  }), [notasNoPeriodo, busca, filtroNf])

  useEffect(() => { setPagina(0) }, [busca, de, ate, deNf, ateNf, loja, filtro, filtroNf, aba])

  const comNf = noPeriodo.filter((e) => e.nf_confirmada)
  const semNf = noPeriodo.filter((e) => !e.nf_confirmada)
  const vencidas = noPeriodo.filter((e) => e.vencimento && e.vencimento < hoje)
  const lojas = useMemo(() => ordenarEmpresas(empresas), [empresas])

  const notasAutorizadas = notasNoPeriodo.filter((n) => n.situacao === 'autorizada')
  const notasCanceladas = notasNoPeriodo.filter((n) => n.situacao === 'cancelada')
  const notasComXml = notasNoPeriodo.filter((n) => n.tem_xml)
  const visiveis = linhas.slice(pagina * porPagina, pagina * porPagina + porPagina)
  const visiveisNf = notasLinhas.slice(pagina * porPagina, pagina * porPagina + porPagina)
  const idsPagina = visiveis.map((e) => e.id)
  const todasMarcadas = idsPagina.length > 0 && idsPagina.every((id) => marcadas.has(id))

  const toggleTodas = () => {
    setMarcadas((atual) => {
      const next = new Set(atual)
      if (todasMarcadas) idsPagina.forEach((id) => next.delete(id))
      else idsPagina.forEach((id) => next.add(id))
      return next
    })
  }

  const toggle = (id: string) => {
    setMarcadas((atual) => {
      const next = new Set(atual)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const buscarReceita = async () => {
    setBuscandoNf(true)
    setErro('')
    try {
      await api.coletarNotasReceita()
      window.setTimeout(() => carregarNotas(loja), 3000)
      window.setTimeout(() => carregarNotas(loja), 8000)
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não consultou a Receita', 'Could not query Receita'))
    } finally {
      setBuscandoNf(false)
    }
  }

  const abrirDanfeLinha = async (n: NotaReceita) => {
    setAcaoNf({ id: n.id, tipo: 'danfe' })
    setErro('')
    setAviso('')
    try {
      await api.abrirDanfeNota(n.id)
      setNotas((lista) => lista.map((item) => (item.id === n.id ? { ...item, tem_xml: true } : item)))
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não abriu o DANFE', 'Could not open the DANFE'))
    } finally {
      setAcaoNf(null)
    }
  }

  const despesaNoInbox = (id: string | null | undefined) =>
    !!id && despesas.some((d) => d.id === id && INBOX_STATUS.has(d.status))

  const executarLancarNota = async (notaId: string) => {
    setAcaoNf({ id: notaId, tipo: 'agenda' })
    setErro('')
    setAviso('')
    try {
      const r = await api.lancarNotaAgenda(notaId)
      const nota = notas.find((item) => item.id === notaId)
      setNotas((lista) => lista.map((item) => (
        item.id === notaId
          ? {
            ...item,
            despesa_id: r.id,
            agenda_vencimento: r.vencimento,
            tem_dda: r.vinculou_dda || item.tem_dda,
          }
          : item
      )))
      const nome = nota?.numero ? `NF ${nota.numero}` : t('Nota', 'Invoice')
      const parcelas = r.quantidade > 1
        ? t(` Em ${r.quantidade} parcelas.`, ` In ${r.quantidade} installments.`)
        : ''
      const quando = r.vencimento ? t(` Vencimento ${dataBr(r.vencimento)}.`, ` Due ${dataBr(r.vencimento)}.`) : ''
      setAviso(
        (r.vinculou_dda
          ? t(`${nome} ficou unida ao boleto DDA.`, `${nome} is linked to the DDA boleto.`)
          : r.ja_existia
            ? t(`${nome} já estava na agenda.`, `${nome} was already on the agenda.`)
            : t(`${nome} entrou na agenda. A nota continua neste inbox.`, `${nome} is on the agenda. The invoice stays in this inbox.`))
        + parcelas
        + quando,
      )
      await carregar(loja)
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não lançou na agenda', 'Could not add to the agenda'))
    } finally {
      setAcaoNf(null)
    }
  }

  const lancarLinha = (n: NotaReceita) => {
    setErro('')
    setAviso('')
    if (n.tem_dda && n.despesa_id) {
      if (!despesaNoInbox(n.despesa_id)) {
        setAviso(t(
          `Esta nota já está unida ao boleto DDA e foi enviada à agenda.`,
          `This invoice is linked to the DDA boleto and already on the agenda.`,
        ))
        return
      }
      setConfirmacao({
        modo: 'nf-dda',
        ids: [n.despesa_id],
        notaId: n.id,
        titulo: t('Enviar boleto unido?', 'Send the linked boleto?'),
        texto: t(
          'Esta nota já está unida ao boleto DDA. Tem certeza que deseja enviar o boleto para a agenda de pagamento?',
          'This invoice is already linked to the DDA boleto. Send that boleto to the payment agenda?',
        ),
      })
      return
    }
    if (n.despesa_id) {
      setAviso(t(
        'Esta nota já está na agenda. Ela continua listada aqui.',
        'This invoice is already on the agenda. It stays listed here.',
      ))
      return
    }
    setConfirmacao({
      modo: 'nf-nova',
      notaId: n.id,
      titulo: t('Lançar na agenda?', 'Add to the agenda?'),
      texto: t(
        `Tem certeza que deseja lançar a NF ${n.numero || ''} na agenda? A nota continua neste inbox.`,
        `Send invoice ${n.numero || ''} to the agenda? The invoice stays in this inbox.`,
      ),
    })
  }

  const abrirAgenda = () => {
    const q = new URLSearchParams()
    if (de) q.set('de', de)
    if (ate) q.set('ate', ate)
    if (loja) q.set('loja', loja)
    navigate(`/financeiro?${q.toString()}`)
  }

  const executarEnvioDda = async (ids: string[]) => {
    if (!ids.length) return
    setEnviando(true)
    setErro('')
    setAviso('')
    try {
      const r = await api.entrarNaAgenda(ids)
      const ok = r.enviados.length
      const bloqueio = r.bloqueados.length
      if (bloqueio && !ok) {
        setErro(r.bloqueados[0]?.motivo || t('Nenhum título enviado.', 'Nothing sent.'))
        return
      }
      setMarcadas(new Set())
      setAviso(t(
        ok === 1
          ? 'Boleto enviado para a agenda. Ele sai deste inbox; a nota fiscal continua na outra aba.'
          : `${ok} boletos enviados para a agenda. Eles saem deste inbox; as notas fiscais continuam na outra aba.`,
        ok === 1
          ? 'Boleto sent to the agenda. It leaves this inbox; the invoice stays on the other tab.'
          : `${ok} boletos sent to the agenda. They leave this inbox; invoices stay on the other tab.`,
      ))
      await Promise.all([carregar(loja), carregarNotas(loja)])
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não enviou', 'Could not send'))
    } finally {
      setEnviando(false)
    }
  }

  const enviar = (ids = [...marcadas]) => {
    if (!ids.length) return
    const comNf = ids.filter((id) => {
      const d = despesas.find((item) => item.id === id)
      return !!(d?.tem_nfe_receita || d?.nfe_recebida_id)
    })
    if (comNf.length) {
      setConfirmacao({
        modo: 'dda',
        ids,
        titulo: t('Enviar para a agenda?', 'Send to the agenda?'),
        texto: comNf.length === ids.length
          ? t(
            'Este boleto já tem nota fiscal unida. Tem certeza que deseja enviar para a agenda?',
            'This boleto already has a linked invoice. Send it to the agenda anyway?',
          )
          : t(
            `${comNf.length} boleto(s) já têm nota fiscal. Tem certeza que deseja enviar para a agenda?`,
            `${comNf.length} boleto(s) already have an invoice. Send them to the agenda anyway?`,
          ),
      })
      return
    }
    void executarEnvioDda(ids)
  }

  const confirmarAcao = async () => {
    const pedido = confirmacao
    setConfirmacao(null)
    if (!pedido) return
    if (pedido.modo === 'nf-nova' && pedido.notaId) {
      await executarLancarNota(pedido.notaId)
      return
    }
    if ((pedido.modo === 'dda' || pedido.modo === 'nf-dda') && pedido.ids?.length) {
      await executarEnvioDda(pedido.ids)
    }
  }

  const verNotaDoDda = (e: Despesa) => {
    if (!e.nfe_recebida_id && !e.numero_nf && !e.nfe_chave) return
    setAba(1)
    setBusca(e.numero_nf || e.nfe_chave || '')
    setPagina(0)
  }

  const abrirDanfeDoDda = (e: Despesa) => {
    if (!e.nfe_recebida_id) return
    return abrirDanfeLinha({
      id: e.nfe_recebida_id,
      chave: e.nfe_chave || '',
      numero: e.numero_nf,
      serie: null,
      emissao: null,
      emitente_cnpj: null,
      emitente_nome: null,
      valor_total: null,
      situacao: 'autorizada',
      tem_xml: !!e.nfe_tem_xml,
      cnpj_empresa: '',
      origem: e.origem,
      despesa_id: e.id,
      agenda_vencimento: e.vencimento,
      tem_dda: true,
    })
  }

  return (
    <Stack
      spacing={1}
      sx={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        bgcolor: INBOX_BG,
        color: INBOX_TEXT,
        boxSizing: 'border-box',
        '--ga-surface': INBOX_SURFACE_ALT,
        '--ga-canvas': INBOX_BG,
        '--ga-canvas-alt': INBOX_SURFACE,
        '--ga-picker-paper': INBOX_SURFACE,
        '--ga-border': INBOX_BORDER,
        '--ga-text-primary': INBOX_TEXT,
        '--ga-text-secondary': INBOX_MUTED,
        '--ga-text-muted': INBOX_MUTED,
      }}
    >
      {erro && (
        <Alert
          severity={/gravado no banco|download automático/.test(erro) ? 'info' : 'warning'}
          sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: 12 } }}
        >
          {erro}
        </Alert>
      )}
      {aviso && <Alert severity="success" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: 12 } }}>{aviso}</Alert>}

      <Stack
        component="form"
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        sx={{ alignItems: { md: 'flex-end' } }}
        onSubmit={(ev) => ev.preventDefault()}
      >
        <TextField
          size="small"
          placeholder={t('Buscar lançamento', 'Search entry')}
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === 'Enter') ev.preventDefault() }}
          sx={{ width: CAMPO_W, flexShrink: 0, ...campoInboxSx }}
        />
        <Box
          sx={{
            width: CAMPO_W,
            flexShrink: 0,
            '& > .MuiBox-root': { width: '100%', minWidth: '0 !important', maxWidth: 'none !important', mb: 0 },
            '& .MuiTextField-root': { width: '100% !important', minWidth: '0 !important', maxWidth: 'none !important' },
            '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
              bgcolor: `${INBOX_SURFACE} !important`,
              color: INBOX_TEXT,
              minHeight: `${CAMPO_H}px !important`,
              height: `${CAMPO_H}px !important`,
              borderRadius: '10px !important',
              overflow: 'hidden',
              '& fieldset, & .MuiOutlinedInput-notchedOutline': {
                borderColor: INBOX_BORDER,
                borderRadius: '10px !important',
              },
              '&:hover fieldset, &:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(15, 23, 42, 0.28)',
              },
            },
            '& .MuiInputBase-input': {
              color: `${INBOX_TEXT} !important`,
              fontSize: '0.8125rem !important',
              py: '0 !important',
              height: `${CAMPO_H}px !important`,
              boxSizing: 'border-box',
            },
            '& .MuiInputLabel-root': {
              color: INBOX_MUTED,
              fontSize: '0.75rem',
              transform: 'translate(12px, -8px) scale(0.85)',
            },
            '& .MuiIconButton-root': { color: INBOX_MUTED, p: 0.25 },
          }}
        >
          <FiltroIntervaloDatasFrota
            compacto
            idioma={idioma}
            dataInicio={aba === 1 ? deNf : de}
            dataFim={aba === 1 ? ateNf : ate}
            onChangeInicio={aba === 1 ? setDeNf : setDe}
            onChangeFim={aba === 1 ? setAteNf : setAte}
          />
        </Box>
        <SeletorLojaFinanceiro
          lojas={lojas}
          value={loja}
          incluirTodas
          todasLabel={t('Todas as lojas', 'All stores')}
          label={t('Loja', 'Store')}
          width={CAMPO_W}
          onChange={(id) => {
            setLoja(id)
            carregar(id)
            carregarNotas(id)
          }}
          sx={{
            ...campoInboxSx,
            '& .MuiInputLabel-root': {
              color: INBOX_MUTED,
              fontSize: '0.75rem',
              transform: 'translate(12px, -8px) scale(0.85)',
            },
            '& .MuiInputLabel-root.MuiInputLabel-shrink': {
              transform: 'translate(12px, -8px) scale(0.85)',
            },
            '& .MuiSelect-select': {
              fontSize: '0.8125rem',
              py: '0 !important',
              minHeight: `${CAMPO_H}px !important`,
              height: CAMPO_H,
              display: 'flex',
              alignItems: 'center',
            },
          }}
        />
        <Box sx={{ flex: 1 }} />
        {aba === 0 ? (
          <>
            <Button
              type="button"
              size="small"
              variant="outlined"
              onClick={abrirAgenda}
              sx={{ color: INBOX_TEXT, borderColor: INBOX_BORDER, '&:hover': { borderColor: '#1B6EF3', bgcolor: 'rgba(27,110,243,0.1)' } }}
            >
              {t('Abrir Agenda banco', 'Open bank schedule')}
            </Button>
            <Button
              type="button"
              size="small"
              variant="contained"
              disabled={enviando || !marcadas.size}
              onClick={() => enviar()}
              sx={{
                color: '#fff',
                bgcolor: '#1B6EF3',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#0D4ECC', boxShadow: 'none' },
                '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)', opacity: 0.5, bgcolor: '#1B6EF3' },
              }}
            >
              {enviando ? t('Enviando…', 'Sending…') : t(`Enviar para agenda (${marcadas.size})`, `Send to schedule (${marcadas.size})`)}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="small"
            variant="contained"
            disabled={buscandoNf}
            onClick={() => buscarReceita()}
            sx={{
              color: '#fff',
              bgcolor: '#1B6EF3',
              boxShadow: 'none',
              '&:hover': { bgcolor: '#0D4ECC', boxShadow: 'none' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)', opacity: 0.5, bgcolor: '#1B6EF3' },
            }}
          >
            {buscandoNf ? t('Consultando…', 'Checking…') : t('Buscar na Receita', 'Pull from Receita')}
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {aba === 0 ? (
          <>
            <Resumo cor="#1B6EF3" rotulo={t('No inbox', 'In inbox')} valor={String(noPeriodo.length)} detalhe={t('boletos DDA', 'DDA boletos')} />
            <Resumo cor="#10B981" rotulo={t('NF conferida', 'Invoice checked')} valor={String(comNf.length)} detalhe={t('prontos para agenda', 'ready for schedule')} />
            <Resumo cor="#F59E0B" rotulo={t('Aguardando NF', 'Awaiting invoice')} valor={String(semNf.length)} detalhe={t('gestor no app', 'manager in the app')} />
            <Resumo cor="#EF4444" rotulo={t('Vencidas', 'Overdue')} valor={String(vencidas.length)} detalhe={t('no inbox', 'in inbox')} alerta={vencidas.length > 0} />
          </>
        ) : (
          <>
            <Resumo cor="#1B6EF3" rotulo={t('No período', 'In period')} valor={String(notasNoPeriodo.length)} detalhe={t('notas da Receita', 'Receita invoices')} />
            <Resumo cor="#10B981" rotulo={t('Autorizadas', 'Authorized')} valor={String(notasAutorizadas.length)} detalhe={t('no nome da empresa', 'issued to the company')} />
            <Resumo cor="#38BDF8" rotulo={t('Com XML', 'With XML')} valor={String(notasComXml.length)} detalhe={t('itens no gestor', 'items in the app')} />
            <Resumo cor="#EF4444" rotulo={t('Canceladas', 'Cancelled')} valor={String(notasCanceladas.length)} detalhe={t('na Receita', 'at Receita')} alerta={notasCanceladas.length > 0} />
          </>
        )}
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
        {(aba === 0 ? FILTROS : FILTROS_NF).map((item) => (
          <Chip
            key={item}
            size="small"
            label={rotuloFiltro(item, t)}
            variant="outlined"
            onClick={() => { if (aba === 0) setFiltro(item as (typeof FILTROS)[number]); else setFiltroNf(item as (typeof FILTROS_NF)[number]); setPagina(0) }}
            sx={{
              height: 24,
              fontSize: 11,
              bgcolor: (aba === 0 ? filtro : filtroNf) === item ? 'rgba(27, 110, 243, 0.1)' : INBOX_SURFACE,
              borderColor: (aba === 0 ? filtro : filtroNf) === item ? '#1B6EF3' : INBOX_BORDER,
              color: (aba === 0 ? filtro : filtroNf) === item ? '#0D4ECC' : INBOX_MUTED,
              fontWeight: (aba === 0 ? filtro : filtroNf) === item ? 600 : 500,
            }}
          />
        ))}
      </Stack>

      <Tabs
        value={aba}
        onChange={(_, v) => { setAba(v); setPagina(0) }}
        sx={{
          minHeight: 36,
          '& .MuiTabs-indicator': { bgcolor: '#1B6EF3' },
          '& .MuiTab-root': {
            minHeight: 36,
            py: 0,
            px: 1.5,
            fontSize: 13,
            textTransform: 'none',
            gap: 0.75,
            color: INBOX_MUTED,
            '&.Mui-selected': { color: INBOX_TEXT },
          },
          '& .MuiTab-iconWrapper': { mb: '0 !important', mr: 0 },
        }}
      >
        <Tab
          icon={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={t(`DDA (${linhas.length})`, `DDA (${linhas.length})`)}
        />
        <Tab
          icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={t(`Notas fiscais (${notasLinhas.length})`, `Invoices (${notasLinhas.length})`)}
        />
      </Tabs>

      {aba === 0 && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...paperInboxSx }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Table size="small" stickyHeader sx={{ width: '100%', minWidth: 720, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ '& .MuiTableCell-head': { verticalAlign: 'middle' } }}>
                  <TableCell sx={celulaCheckSx}>
                    <Checkbox
                      size="small"
                      checked={todasMarcadas}
                      indeterminate={!!marcadas.size && !todasMarcadas}
                      onChange={toggleTodas}
                      sx={checkSx}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ width: 120, ...celulaCentroSx }}>{t('Ações', 'Actions')}</TableCell>
                  <TableCell sx={{ width: '34%' }}>{t('Fornecedor', 'Supplier')}</TableCell>
                  <TableCell align="center" sx={{ width: '16%', ...celulaCentroSx }}>{t('Loja', 'Store')}</TableCell>
                  <TableCell sx={{ width: 108 }}>{t('Vencimento', 'Due date')}</TableCell>
                  <TableCell align="right" sx={{ width: 128, pr: 2.5 }}>{t('Valor', 'Amount')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!linhas.length && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ border: 0, py: 0 }}>
                      <EstadoVazio
                        icone={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 40 }} />}
                        titulo={
                          inbox.length
                            ? t('Nenhum boleto neste filtro', 'No boletos in this filter')
                            : t('Nenhum boleto DDA no período', 'No DDA boletos in this period')
                        }
                        texto={
                          inbox.length
                            ? t('Ajuste o período, a loja ou o filtro acima para ver outros títulos.', 'Adjust the period, store or filter above to see other titles.')
                            : t(
                              'A coleta DDA roda sozinha. Quando chegar título novo, confira a NF e envie para a agenda.',
                              'DDA pulls run automatically. When a new title arrives, check the invoice and send it to the schedule.',
                            )
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
                {visiveis.map((e) => {
                  const vencida = !!e.vencimento && e.vencimento < hoje
                  const chave = e.id || `${e.documento_ref || ''}|${e.vencimento || ''}|${e.valor}`
                  return (
                    <TableRow key={chave} hover selected={!!e.id && marcadas.has(e.id)}>
                      <TableCell sx={celulaCheckSx}>
                        <Checkbox
                          size="small"
                          disabled={!e.id}
                          checked={!!e.id && marcadas.has(e.id)}
                          onChange={() => { if (e.id) toggle(e.id) }}
                          sx={checkSx}
                        />
                      </TableCell>
                      <TableCell align="center" sx={{ ...celulaCentroSx, px: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <SimbolosDda
                            despesa={e}
                            vencida={vencida}
                            ocupado={enviando || acaoNf?.id === e.nfe_recebida_id}
                            t={t}
                            onNota={() => verNotaDoDda(e)}
                            onDanfe={() => { void abrirDanfeDoDda(e) }}
                            onAgenda={() => { if (e.id) void enviar([e.id]) }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell sx={{ overflow: 'hidden' }}>
                        <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 650, lineHeight: 1.25 }}>{rotuloDescricao(e)}</Typography>
                        {e.numero_nf && (
                          <Typography noWrap sx={{ fontSize: 11, color: INBOX_MUTED }}>NF {e.numero_nf}</Typography>
                        )}
                      </TableCell>
                      <TableCell align="center" sx={celulaCentroSx}>
                        <Typography noWrap sx={{ fontSize: 12, color: INBOX_TEXT }}>{e.origem || '—'}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: vencida ? '#B91C1C' : INBOX_TEXT, fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>
                        {dataBr(e.vencimento)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, pr: 2.5 }}>
                        {brl(Number(e.valor))}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
          <TablePagination
            component="div"
            count={linhas.length}
            page={pagina}
            onPageChange={(_, n) => setPagina(n)}
            rowsPerPage={porPagina}
            onRowsPerPageChange={(ev) => { setPorPagina(Number(ev.target.value)); setPagina(0) }}
            rowsPerPageOptions={[30, 50, 100]}
            labelRowsPerPage={t('Por página', 'Per page')}
            labelDisplayedRows={({ from, to, count }) => t(`${from}–${to} de ${count}`, `${from}–${to} of ${count}`)}
            slotProps={{
              select: selectMenuEscuro,
            }}
            sx={{
              flexShrink: 0,
              borderTop: '1px solid',
              borderColor: INBOX_BORDER,
              color: INBOX_MUTED,
              overflow: 'hidden',
              '& .MuiTablePagination-toolbar': {
                minHeight: '28px !important',
                height: 28,
                pl: 1.5,
                pr: 0.5,
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                fontSize: 12,
                lineHeight: 1,
                m: 0,
                color: INBOX_MUTED,
              },
              '& .MuiTablePagination-select': { color: INBOX_TEXT, py: 0 },
              '& .MuiTablePagination-input': { color: INBOX_TEXT, m: 0 },
              '& .MuiTablePagination-actions': { ml: 0.5 },
              '& .MuiTablePagination-actions .MuiIconButton-root': { p: 0.25 },
            }}
          />
        </Paper>
      )}

      {aba === 1 && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...paperInboxSx }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Table size="small" stickyHeader sx={{ width: '100%', minWidth: 760, tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ '& .MuiTableCell-head': { verticalAlign: 'middle' } }}>
                  <TableCell align="center" sx={{ width: 112, ...celulaCentroSx }}>{t('Ações', 'Actions')}</TableCell>
                  <TableCell sx={{ width: 120 }}>{t('Situação', 'Status')}</TableCell>
                  <TableCell sx={{ width: '32%' }}>{t('Emitente', 'Issuer')}</TableCell>
                  <TableCell align="center" sx={{ width: '15%', ...celulaCentroSx }}>{t('Loja', 'Store')}</TableCell>
                  <TableCell sx={{ width: 108 }}>{t('Emissão', 'Issue date')}</TableCell>
                  <TableCell align="right" sx={{ width: 128, pr: 2.5 }}>{t('Valor', 'Amount')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!notasLinhas.length && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ border: 0, py: 0 }}>
                      <EstadoVazio
                        icone={<ReceiptLongOutlinedIcon sx={{ fontSize: 40 }} />}
                        titulo={
                          notas.length
                            ? t('Nenhuma nota neste filtro', 'No invoices in this filter')
                            : t('Ainda não há notas da Receita', 'No Receita invoices yet')
                        }
                        texto={
                          notas.length
                            ? t('Mude o período, a loja ou o filtro para ver outras NF-e.', 'Change the period, store or filter to see other invoices.')
                            : t(
                              'Clique em “Buscar na Receita” para trazer as NF-e do CNPJ da empresa. Depois confira o XML e lance na agenda.',
                              'Click “Pull from Receita” to fetch NF-e for the company CNPJ. Then check the XML and post to the schedule.',
                            )
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
                {visiveisNf.map((n) => (
                  <TableRow key={n.id} hover>
                    <TableCell align="center" sx={{ ...celulaCentroSx, px: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <SimbolosNota
                          nota={n}
                          ocupado={acaoNf?.id === n.id}
                          t={t}
                          onDanfe={() => abrirDanfeLinha(n)}
                          onAgenda={() => lancarLinha(n)}
                        />
                      </Box>
                    </TableCell>
                    <TableCell>{chipSituacao(n.situacao, t, true)}</TableCell>
                    <TableCell sx={{ overflow: 'hidden' }}>
                      <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 650, lineHeight: 1.25 }}>{n.emitente_nome || '—'}</Typography>
                      <Typography noWrap sx={{ fontSize: 11, color: INBOX_MUTED }}>
                        {n.numero ? `NF ${n.numero}` : n.chave}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={celulaCentroSx}>
                      <Typography noWrap sx={{ fontSize: 12 }}>{n.origem || '—'}</Typography>
                    </TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>{dataBr(n.emissao)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, pr: 2.5 }}>
                      {n.valor_total != null ? brl(n.valor_total) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
          <TablePagination
            component="div"
            count={notasLinhas.length}
            page={pagina}
            onPageChange={(_, n) => setPagina(n)}
            rowsPerPage={porPagina}
            onRowsPerPageChange={(ev) => { setPorPagina(Number(ev.target.value)); setPagina(0) }}
            rowsPerPageOptions={[30, 50, 100]}
            labelRowsPerPage={t('Por página', 'Per page')}
            labelDisplayedRows={({ from, to, count }) => t(`${from}–${to} de ${count}`, `${from}–${to} of ${count}`)}
            slotProps={{
              select: selectMenuEscuro,
            }}
            sx={{
              flexShrink: 0,
              borderTop: '1px solid',
              borderColor: INBOX_BORDER,
              color: INBOX_MUTED,
              overflow: 'hidden',
              '& .MuiTablePagination-toolbar': {
                minHeight: '28px !important',
                height: 28,
                pl: 1.5,
                pr: 0.5,
              },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                fontSize: 12,
                lineHeight: 1,
                m: 0,
                color: INBOX_MUTED,
              },
              '& .MuiTablePagination-select': { color: INBOX_TEXT, py: 0 },
              '& .MuiTablePagination-input': { color: INBOX_TEXT, m: 0 },
              '& .MuiTablePagination-actions': { ml: 0.5 },
              '& .MuiTablePagination-actions .MuiIconButton-root': { p: 0.25 },
            }}
          />
        </Paper>
      )}

      <Dialog open={!!confirmacao} onClose={() => setConfirmacao(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 650 }}>{confirmacao?.titulo}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{confirmacao?.texto}</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button size="small" onClick={() => setConfirmacao(null)}>{t('Cancelar', 'Cancel')}</Button>
          <Button size="small" variant="contained" disabled={enviando || !!acaoNf} onClick={() => { void confirmarAcao() }}>
            {t('Sim, enviar', 'Yes, send')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

function Selo({
  rotulo,
  titulo,
  cor,
  onClick,
}: {
  rotulo: string
  titulo: string
  cor: string
  onClick?: () => void
}) {
  return (
    <Tooltip title={titulo}>
      <Box
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault()
            onClick()
          }
        } : undefined}
        sx={{
          width: 28,
          height: 22,
          borderRadius: '4px',
          border: 0,
          p: 0,
          bgcolor: cor,
          color: '#fff',
          fontSize: 9,
          fontWeight: 800,
          display: 'grid',
          placeItems: 'center',
          letterSpacing: '-0.03em',
          flexShrink: 0,
          cursor: onClick ? 'pointer' : 'default',
          outline: 'none',
        }}
      >
        {rotulo}
      </Box>
    </Tooltip>
  )
}

function SimbolosDda({
  despesa,
  vencida,
  ocupado,
  t,
  onNota,
  onDanfe,
  onAgenda,
}: {
  despesa: Despesa
  vencida: boolean
  ocupado: boolean
  t: (pt: string, en: string) => string
  onNota: () => void
  onDanfe: () => void
  onAgenda: () => void
}) {
  const temNf = !!despesa.tem_nfe_receita || !!despesa.nfe_recebida_id
  return (
    <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
      <Selo rotulo="DDA" titulo={t('Boleto DDA', 'DDA boleto')} cor="#0F766E" />
      <Selo
        rotulo="NFE"
        titulo={temNf
          ? t('Tem nota fiscal. Abrir na aba Notas', 'Has invoice. Open Invoices tab')
          : despesa.nf_confirmada
            ? t('NF conferida no gestor', 'Invoice checked in stock')
            : t('Aguardando nota fiscal', 'Awaiting invoice')}
        cor={temNf || despesa.nf_confirmada ? '#1D4ED8' : '#94A3B8'}
        onClick={temNf ? onNota : undefined}
      />
      <Tooltip title={temNf
        ? t('Abrir DANFE', 'Open DANFE')
        : t('DANFE quando a nota chegar', 'DANFE when the invoice arrives')}
      >
        <span>
          <IconButton
            size="small"
            disabled={ocupado || !despesa.nfe_recebida_id}
            onClick={onDanfe}
            sx={{ p: 0.25, color: despesa.nfe_tem_xml ? '#1D4ED8' : '#94A3B8' }}
          >
            <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={temNf
        ? t('Tem NF unida. Enviar pede confirmação', 'Linked invoice. Send asks for confirmation')
        : t('Enviar para a agenda', 'Send to the agenda')}
      >
        <span>
          <IconButton
            size="small"
            disabled={ocupado || !despesa.id}
            onClick={onAgenda}
            sx={{ p: 0.25, color: '#D97706' }}
          >
            <PaymentsOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
      {vencida ? (
        <Tooltip title={t('Boleto vencido', 'Overdue boleto')}>
          <WarningAmberOutlinedIcon
            sx={{
              fontSize: 18,
              color: '#DC2626',
              animation: 'inbox-vencido-pisca 1.4s ease-in-out infinite',
              '@keyframes inbox-vencido-pisca': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.28 },
              },
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }}
          />
        </Tooltip>
      ) : (
        <Box sx={{ width: 18, flexShrink: 0 }} />
      )}
    </Stack>
  )
}

function SimbolosNota({
  nota,
  ocupado,
  t,
  onDanfe,
  onAgenda,
}: {
  nota: NotaReceita
  ocupado: boolean
  t: (pt: string, en: string) => string
  onDanfe: () => void
  onAgenda: () => void
}) {
  const cancelada = nota.situacao === 'cancelada' || nota.situacao === 'denegada'
  const semLoja = !nota.origem
  const alerta = cancelada
    ? t('Nota cancelada na Receita', 'Invoice cancelled at Receita')
    : semLoja
      ? t('Sem loja com este CNPJ', 'No store for this CNPJ')
      : ''
  return (
    <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
      <Selo
        rotulo="NFE"
        titulo={cancelada ? t('NF-e cancelada', 'Cancelled NF-e') : t('Nota fiscal eletrônica', 'Electronic invoice')}
        cor={cancelada ? '#DC2626' : '#1D4ED8'}
      />
      {nota.tem_dda ? (
        <Selo rotulo="DDA" titulo={t('Tem boleto DDA', 'Has DDA boleto')} cor="#0F766E" />
      ) : null}
      <Tooltip title={t('Abrir DANFE', 'Open DANFE')}>
        <span>
          <IconButton size="small" disabled={ocupado} onClick={onDanfe} sx={{ p: 0.25, color: nota.tem_xml ? '#1D4ED8' : '#94A3B8' }}>
            <DescriptionOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={nota.tem_dda
        ? t('Unida ao boleto DDA', 'Linked to the DDA boleto')
        : nota.despesa_id
          ? t('Já enviada à agenda', 'Already sent to the agenda')
          : t('Lançar na agenda', 'Add to the agenda')}
      >
        <span>
          <IconButton
            size="small"
            disabled={ocupado || (cancelada && !nota.despesa_id)}
            onClick={onAgenda}
            sx={{ p: 0.25, color: nota.despesa_id ? '#D97706' : '#94A3B8' }}
          >
            <PaymentsOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
      {alerta ? (
        <Tooltip title={alerta}>
          <WarningAmberOutlinedIcon sx={{ fontSize: 18, color: '#EA580C' }} />
        </Tooltip>
      ) : (
        <Box sx={{ width: 18, flexShrink: 0 }} />
      )}
    </Stack>
  )
}

function rotuloFiltro(item: string, t: (pt: string, en: string) => string) {
  const mapa: Record<string, [string, string]> = {
    Todas: ['Todas', 'All'],
    Vencidas: ['Vencidas', 'Overdue'],
    'NF confirmada': ['NF confirmada', 'Invoice confirmed'],
    'Aguardando NF': ['Aguardando NF', 'Awaiting invoice'],
    Autorizadas: ['Autorizadas', 'Authorized'],
    Canceladas: ['Canceladas', 'Cancelled'],
    'Com XML': ['Com XML', 'With XML'],
  }
  const par = mapa[item] || [item, item]
  return t(par[0], par[1])
}

function chipSituacao(situacao: NotaReceita['situacao'], t: (pt: string, en: string) => string, escuro: boolean) {
  const cancelada = situacao === 'cancelada' || situacao === 'denegada'
  const rotulo = situacao === 'cancelada'
    ? t('Cancelada', 'Cancelled')
    : situacao === 'denegada'
      ? t('Denegada', 'Denied')
      : t('Autorizada', 'Authorized')
  return (
    <Chip
      size="small"
      label={rotulo}
      sx={{
        height: 20,
        fontSize: 11,
        fontWeight: 600,
        bgcolor: cancelada
          ? (escuro ? 'rgba(248,113,113,0.14)' : 'rgba(239,68,68,0.1)')
          : (escuro ? 'rgba(52,211,153,0.14)' : 'rgba(16,185,129,0.12)'),
        color: cancelada ? (escuro ? '#FCA5A5' : '#B91C1C') : (escuro ? '#6EE7B7' : '#047857'),
      }}
    />
  )
}

function Resumo({
  rotulo,
  valor,
  detalhe,
  alerta = false,
  cor = '#1B6EF3',
}: {
  rotulo: string
  valor: string
  detalhe: string
  alerta?: boolean
  cor?: string
}) {
  const faixa = alerta ? '#EF4444' : cor
  return (
    <Paper
      variant="outlined"
      sx={{
        position: 'relative',
        px: 1.25,
        py: 0.75,
        pl: 1.6,
        minWidth: 140,
        flex: 1,
        overflow: 'hidden',
        bgcolor: INBOX_SURFACE,
        borderColor: INBOX_BORDER,
        ...(alerta ? { bgcolor: 'rgba(239,68,68,0.12)' } : {}),
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: faixa,
          borderRadius: '2px 0 0 2px',
        },
      }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: alerta ? '#B91C1C' : INBOX_MUTED }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: alerta ? '#B91C1C' : INBOX_TEXT }}>{valor}</Typography>
      <Typography sx={{ fontSize: 12, color: alerta ? '#B91C1C' : INBOX_MUTED }}>{detalhe}</Typography>
    </Paper>
  )
}

function EstadoVazio({
  icone,
  titulo,
  texto,
}: {
  icone: ReactNode
  titulo: string
  texto: string
}) {
  return (
    <Box
      sx={{
        py: 5.5,
        px: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
      }}
    >
      <Box sx={{ color: 'rgba(148,163,184,0.7)', display: 'flex', mb: 0.5 }}>{icone}</Box>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: INBOX_TEXT, letterSpacing: '-0.02em' }}>
        {titulo}
      </Typography>
      <Typography sx={{ fontSize: 13, color: INBOX_MUTED, maxWidth: 460, lineHeight: 1.55 }}>
        {texto}
      </Typography>
    </Box>
  )
}
