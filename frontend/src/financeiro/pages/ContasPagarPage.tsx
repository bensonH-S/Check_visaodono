import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Drawer from '@mui/material/Drawer'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CheckIcon from '@mui/icons-material/Check'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { api, brl, ehFreeControl, emCache, estaNoInbox, linhaAcrescimo, urlDespesas, urlEmpresas, type Despesa, type Empresa, type Fornecedor } from '../api'
import { ordenarEmpresas, ordenarLancamentosPorEmpresa } from '../ordemEmpresas'
import { rotuloDespesa } from '../rotuloDespesa'
import { usePrefs } from '../prefs'
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota'
import { showToast } from '../../utils/toast'
import CampoDataFinanceiro from '../CampoDataFinanceiro'
import { getUsuario, podeVerFinanceiro } from '../../lib/auth'
import SeletorLojaFinanceiro from '../SeletorLojaFinanceiro'
import {
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_SURFACE_ALT,
  FIN_TEXT,
  finBtnContainedSx,
  finBtnOutlinedSx,
  finCalendarioWrapSx,
  finCampoErroSx,
  finCampoSx,
  finChipSx,
  finMenuSx,
  finPageSx,
  finPaperSx,
  finSelectMenu,
} from '../temaFinanceiroEscuro'

const dialogEscuroPaper = {
  bgcolor: FIN_SURFACE,
  color: FIN_TEXT,
  backgroundImage: 'none',
  border: `1px solid ${FIN_BORDER}`,
  borderRadius: '12px',
} as const

const drawerEscuroPaper = {
  width: { xs: '100%', sm: 440 },
  bgcolor: FIN_SURFACE_ALT,
  color: FIN_TEXT,
  backgroundImage: 'none',
  borderLeft: `1px solid ${FIN_BORDER}`,
} as const

const aberta = (e: Despesa) => !['paga', 'conciliada', 'cancelada'].includes(e.status)
const hoje = new Date().toISOString().slice(0, 10)

/** Agenda banco: só 3 cores — a pagar (azul), pago (verde), vencida (vermelho). */
function situacao(e: Despesa) {
  if (e.status === 'conciliada' || e.status === 'paga') return 'pago'
  if (e.status === 'bloqueada_duplicata') return 'bloqueada_duplicata'
  if (aberta(e) && e.vencimento && e.vencimento < hoje) return 'vencida'
  return 'a_pagar'
}

const CODIGO: Record<string, string> = {
  folha: 'Folha Pagamento', cadastro: 'Cadastro', chave_pix: 'Chave PIX',
  boleto: 'Boleto', guia: 'Guia', dinheiro: 'Dinheiro', online: 'Online',
}
const FILTROS = ['Todas', 'DDA', 'Free Control', 'Boletos', 'Para autorizar', 'Vencidas', 'NF confirmada', 'NF Parcial', 'NF Pendente'] as const

function cicloNf(e: Despesa): 'nao_confirmada' | 'confirmada' | 'divergente' | null {
  if (e.nf_ciclo === 'confirmada' || e.nf_ciclo === 'divergente') return e.nf_ciclo
  // em_transito e nao_confirmada → mesmo selo na Agenda
  if (e.nf_ciclo === 'nao_confirmada' || e.nf_ciclo === 'em_transito') return 'nao_confirmada'
  if (e.nf_confirmada && e.nf_divergente) return 'divergente'
  if (e.nf_confirmada) return 'confirmada'
  if (ehFreeControl(e) || e.fonte === 'manual') return null
  if (e.fonte === 'dda' || e.fonte === 'nfe' || e.numero_nf) return 'nao_confirmada'
  return null
}

const TOM_CLARO: Record<string, { color: string; border: string; bg: string }> = {
  a_pagar: { color: '#1D4ED8', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.1)' },
  pago: { color: '#047857', border: 'rgba(16,185,129,0.45)', bg: 'rgba(16,185,129,0.12)' },
  vencida: { color: '#B91C1C', border: 'rgba(239,68,68,0.5)', bg: 'rgba(239,68,68,0.1)' },
  bloqueada_duplicata: { color: '#B91C1C', border: 'rgba(239,68,68,0.45)', bg: 'rgba(239,68,68,0.08)' },
}

const ROTULO: Record<string, [string, string]> = {
  a_pagar: ['A pagar', 'To pay'],
  pago: ['Pago', 'Paid'],
  vencida: ['Vencida', 'Overdue'],
  bloqueada_duplicata: ['Duplicata', 'Duplicate'],
}

function rotuloDescricao(e: Despesa) {
  return rotuloDespesa(e)
}

function dataLocal(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dia}`
}

function ymdMaisDias(ymd: string, dias: number) {
  const [y, m, d] = String(ymd || '').slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return ''
  return dataLocal(new Date(y, m - 1, d + dias))
}

/** DDA/manual: vencimento na semana. Free Control: pagamento ou semana de serviço (seg–dom). */
function noRecorteAgenda(e: Despesa, de: string, ate: string, atrasados = false) {
  const vencimento = (e.vencimento || '').slice(0, 10)
  const competencia = (e.competencia || '').slice(0, 10)
  const dentro = (dia: string) => {
    if (!dia) return !de && !ate
    if (de && dia < de) return false
    if (ate && dia > ate) return false
    return true
  }
  if (!ehFreeControl(e)) return dentro(vencimento)
  if (dentro(vencimento) || dentro(competencia)) return true
  if (atrasados && de && vencimento && vencimento < de) return true
  if (competencia && de && ate) {
    const domingo = ymdMaisDias(competencia, 6)
    if (competencia <= ate && domingo >= de) return true
  }
  return false
}

function periodoAtual() {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 1) % 7))
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 7)
  return { de: dataLocal(inicio), ate: dataLocal(fim) }
}

/**
 * Agenda é sempre sáb→sáb. Free Control consolida seg→dom e vence na segunda
 * seguinte — essa segunda cai dentro do sáb→sáb atual da Agenda.
 */
function periodoFreeControl() {
  return periodoAtual()
}

function arquivoBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binario)
}

const EXT_OK = /\.(pdf|xlsx|xls|csv|ret|txt|rem|cnab|xml)$/i

export function ContasPagarPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { t, idioma } = usePrefs()
  const user = getUsuario()
  /** Sem financeiro.ver: só visualiza (abre detalhe sem salvar/excluir/importar). */
  const somenteLeitura = !podeVerFinanceiro(user)
  const [empresas, setEmpresas] = useState<Empresa[]>(() => emCache<Empresa[]>(urlEmpresas()) ?? [])
  const [despesas, setDespesas] = useState<Despesa[]>(() => emCache<Despesa[]>(urlDespesas(params.get('loja') || undefined)) ?? [])
  const [loja, setLoja] = useState(() => params.get('loja') || '')
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState(() => params.get('de') || periodoAtual().de)
  const [ate, setAte] = useState(() => params.get('ate') || periodoAtual().ate)
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('Todas')
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(20)
  const [editando, setEditando] = useState<Despesa | null>(null)
  const [excluir, setExcluir] = useState<Despesa | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erroExcluir, setErroExcluir] = useState('')
  const [erroBanco, setErroBanco] = useState('')
  const [importarAberto, setImportarAberto] = useState(false)
  const [baixandoExcel, setBaixandoExcel] = useState(false)
  const [baixandoDivergencias, setBaixandoDivergencias] = useState(false)
  const [menuNf, setMenuNf] = useState<{ despesa: Despesa; anchor: HTMLElement } | null>(null)
  const [menuConf, setMenuConf] = useState<{ despesa: Despesa; anchor: HTMLElement; modo: 'free' | 'tributo' } | null>(null)
  const [salvandoNf, setSalvandoNf] = useState(false)

  const alterarStatusNf = async (ciclo: 'confirmada' | 'divergente' | 'nao_confirmada') => {
    if (!menuNf || somenteLeitura) return
    const id = menuNf.despesa.id
    setSalvandoNf(true)
    try {
      const r = await api.alterarNfStatus(id, ciclo)
      setDespesas((prev) => prev.map((d) => (
        d.id === id
          ? {
            ...d,
            nf_ciclo: r.nf_ciclo as Despesa['nf_ciclo'],
            nf_confirmada: r.nf_confirmada,
            nf_divergente: r.nf_divergente,
          }
          : d
      )))
      showToast(
        ciclo === 'confirmada'
          ? t('NF confirmada.', 'Invoice confirmed.')
          : ciclo === 'divergente'
            ? t('Marcada como NF Parcial.', 'Marked as partial NF.')
            : t('Marcada como NF Pendente.', 'Marked as pending NF.'),
        'success',
      )
      setMenuNf(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('Não alterou o status.', 'Could not change status.'), 'error')
    } finally {
      setSalvandoNf(false)
    }
  }

  const alterarConferencia = async (status: 'ok' | 'pendente' | 'conferido') => {
    if (!menuConf || somenteLeitura) return
    const id = menuConf.despesa.id
    setSalvandoNf(true)
    try {
      const r = await api.alterarConferencia(id, status)
      setDespesas((prev) => prev.map((d) => (
        d.id === id
          ? {
            ...d,
            conferencia_status: r.conferencia_status as Despesa['conferencia_status'],
            tributo_tipo: r.tributo_tipo,
            tributo_rotulo: r.tributo_rotulo,
            tributo_portal: r.tributo_portal,
          }
          : d
      )))
      showToast(
        status === 'ok'
          ? t('Free Control OK.', 'Free Control OK.')
          : status === 'conferido'
            ? t('trib. confirmado.', 'tax confirmed.')
            : t('Marcado como pendente.', 'Marked as pending.'),
        'success',
      )
      setMenuConf(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('Não alterou a conferência.', 'Could not update check.'), 'error')
    } finally {
      setSalvandoNf(false)
    }
  }

  const baixarExcel = async () => {
    if (!de || !ate || de > ate) {
      showToast(t('Escolha o período da agenda.', 'Choose the agenda period.'), 'warning')
      return
    }
    setBaixandoExcel(true)
    try {
      await api.baixarPlanilhaBanco(de, ate, loja || undefined)
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('Não gerou a planilha.', 'Could not build the spreadsheet.'), 'error')
    } finally {
      setBaixandoExcel(false)
    }
  }

  const baixarDivergencias = async () => {
    setBaixandoDivergencias(true)
    try {
      await api.baixarDivergenciasNf({
        de: de || undefined,
        ate: ate || undefined,
      })
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : t('Não gerou o relatório de divergências.', 'Could not build the mismatch report.'),
        'error',
      )
    } finally {
      setBaixandoDivergencias(false)
    }
  }

  const carregar = (empresa = loja) => api.despesas(empresa || undefined).then((rows) => {
    setDespesas(rows)
    setErroBanco('')
  }).catch(() => {
    setErroBanco(t(
      'Não carregou o financeiro. Confira a permissão (financeiro.ver ou financeiro.resumo.ver).',
      'Could not load finance. Check financeiro.ver or financeiro.resumo.ver.',
    ))
  })

  useEffect(() => {
    api.empresas().then((rows) => {
      setEmpresas(rows)
      if (rows.length) setErroBanco('')
    }).catch(() => {
      setErroBanco(t(
        'Não carregou o financeiro. Confira a permissão (financeiro.ver ou financeiro.resumo.ver).',
        'Could not load finance. Check financeiro.ver or financeiro.resumo.ver.',
      ))
    })
    carregar(params.get('loja') || '')
  }, [])

  /**
   * Agenda banco: só o que ainda falta tratar na semana.
   * Paga/conciliada saem daqui (e do Inbox) — ficam só em Conciliadas.
   * DDA/manual nova só depois da confirmação no Inbox.
   */
  const naAgenda = useMemo(() => despesas.filter((e) => {
    if (estaNoInbox(e)) return false
    if (e.status === 'paga' || e.status === 'conciliada' || e.status === 'cancelada') return false
    if (e.fonte === 'dda' || e.fonte === 'nfe') {
      return ['pronta', 'autorizada', 'enviada'].includes(e.status)
    }
    return true
  }), [despesas])

  const noPeriodo = useMemo(() => naAgenda.filter((e) => {
    if (ehFreeControl(e)) return noRecorteAgenda(e, de, ate)
    const vencimento = (e.vencimento || '').slice(0, 10)
    if (!vencimento) return !de && !ate
    if (de && vencimento < de) return false
    if (ate && vencimento > ate) return false
    return true
  }), [naAgenda, de, ate])

  /** Total já baixado no período (não lista na tabela — só o card + Conciliadas). */
  const pagoNoPeriodo = useMemo(() => despesas.filter((e) => {
    if (e.status !== 'paga' && e.status !== 'conciliada') return false
    if (filtro === 'Free Control' && !ehFreeControl(e)) return false
    if (filtro === 'DDA' && e.fonte !== 'dda') return false
    const vencimento = (e.vencimento || '').slice(0, 10)
    if (!vencimento) return !de && !ate
    if (de && vencimento < de) return false
    if (ate && vencimento > ate) return false
    return true
  }).reduce((a, e) => a + Number(e.valor), 0), [despesas, de, ate, filtro])

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const qDigitos = q.replace(/\D/g, '')
    // Busca por texto/NF ignora o recorte semanal — senão a nota some quando o vencimento é outra semana.
    const base = filtro === 'Free Control'
      ? naAgenda.filter((e) => ehFreeControl(e) && (q || noRecorteAgenda(e, de, ate, true)))
      : (q ? naAgenda : noPeriodo)
    const filtradas = base.filter((e) => {
      if (q) {
        const texto = `${e.descricao} ${e.fornecedor ?? ''} ${e.origem} ${e.plano ?? ''} ${e.numero_nf ?? ''}`.toLowerCase()
        const nfDigitos = String(e.numero_nf || '').replace(/\D/g, '')
        const bateTexto = texto.includes(q)
        const bateNf = qDigitos.length >= 3 && nfDigitos.includes(qDigitos)
        if (!bateTexto && !bateNf) return false
      }
      if (filtro === 'DDA') return e.fonte === 'dda'
      if (filtro === 'Free Control') return true
      if (filtro === 'Boletos') return e.forma_pagamento === 'boleto'
      if (filtro === 'Para autorizar') return e.status === 'pronta'
      if (filtro === 'Vencidas') return aberta(e) && !!e.vencimento && e.vencimento < hoje
      if (filtro === 'NF confirmada') return cicloNf(e) === 'confirmada'
      if (filtro === 'NF Parcial') return cicloNf(e) === 'divergente'
      if (filtro === 'NF Pendente') return cicloNf(e) === 'nao_confirmada'
      return true
    })
    return ordenarLancamentosPorEmpresa(filtradas, empresas)
  }, [noPeriodo, naAgenda, busca, filtro, empresas, de, ate])

  useEffect(() => { setPagina(0) }, [busca, de, ate, loja, filtro])

  const visiveis = linhas.slice(pagina * porPagina, pagina * porPagina + porPagina)

  // Cards seguem o filtro ativo (ex.: Free Control = só o consolidado BANCO), não o total da agenda.
  const soma = (pred: (e: Despesa) => boolean) => linhas.filter(pred).reduce((a, e) => a + Number(e.valor), 0)
  const lojas = useMemo(
    () => ordenarEmpresas(empresas.filter((e) => e.tipo === 'loja' || e.tipo === 'holding')),
    [empresas],
  )
  const vencida = soma((e) => aberta(e) && !!e.vencimento && e.vencimento < hoje)

  return (
    <Stack spacing={1} sx={finPageSx}>
      {erroBanco && <Alert severity="warning" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: 12 } }}>{erroBanco}</Alert>}
      <Stack
        component="form"
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        sx={{ alignItems: { md: 'center' } }}
        onSubmit={(ev) => ev.preventDefault()}
      >
        <TextField
          size="small"
          placeholder={t('Buscar lançamento', 'Search entry')}
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
          onKeyDown={(ev) => { if (ev.key === 'Enter') ev.preventDefault() }}
          sx={{ width: { xs: '100%', md: 240 }, flexShrink: 0, ...finCampoSx }}
        />
        <Box sx={finCalendarioWrapSx}>
          <FiltroIntervaloDatasFrota
            compacto
            idioma={idioma}
            permitirFuturo
            dataInicio={de}
            dataFim={ate}
            onChangeInicio={setDe}
            onChangeFim={setAte}
          />
        </Box>
        <SeletorLojaFinanceiro
          lojas={lojas}
          value={loja}
          incluirTodas
          todasLabel={t('Todas as lojas', 'All stores')}
          label={t('Loja', 'Store')}
          onChange={(id) => {
            setLoja(id)
            carregar(id)
          }}
        />
        <Box sx={{ flex: 1 }} />
        {somenteLeitura ? (
          <Chip
            size="small"
            label={t('Somente visualização', 'View only')}
            sx={{ fontWeight: 600, bgcolor: 'rgba(27,110,243,0.1)', color: '#1B6EF3', border: '1px solid rgba(27,110,243,0.28)' }}
          />
        ) : (
          <Button type="button" size="small" variant="outlined" onClick={() => navigate('/financeiro/inbox')} sx={finBtnOutlinedSx}>{t('Inbox', 'Inbox')}</Button>
        )}
        <Button
          type="button"
          size="small"
          variant="outlined"
          startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
          disabled={baixandoExcel}
          onClick={baixarExcel}
          sx={finBtnOutlinedSx}
        >
          {t('Excel', 'Excel')}
        </Button>
        <Button
          type="button"
          size="small"
          variant="outlined"
          startIcon={<ReportProblemOutlinedIcon sx={{ fontSize: 16 }} />}
          disabled={baixandoDivergencias}
          onClick={() => void baixarDivergencias()}
          sx={finBtnOutlinedSx}
        >
          {baixandoDivergencias
            ? t('Gerando…', 'Building…')
            : t('Relatório NF', 'Invoice report')}
        </Button>
        {!somenteLeitura && (
          <Button
            type="button"
            size="small"
            variant="outlined"
            startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => setImportarAberto(true)}
            sx={finBtnOutlinedSx}
          >
            {t('Importar', 'Import')}
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1.25} sx={{ width: '100%', alignItems: 'stretch' }}>
        <Resumo
          cor="#1B6EF3"
          rotulo={t('A pagar', 'To pay')}
          valor={brl(soma((e) => aberta(e)))}
          detalhe={t('da semana', 'for the week')}
        />
        <Box
          onClick={() => navigate('/financeiro/conciliacao')}
          sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', cursor: 'pointer' }}
          title={t('Ver em Conciliadas', 'See in Reconciled')}
        >
          <Resumo
            cor="#10B981"
            rotulo={t('Pago', 'Paid')}
            valor={brl(pagoNoPeriodo)}
            detalhe={t('só em Conciliadas', 'only in Reconciled')}
          />
        </Box>
        <Resumo
          cor="#EF4444"
          rotulo={t('Vencida', 'Overdue')}
          valor={brl(vencida)}
          detalhe={t('passou do vencimento', 'past due')}
          alerta={vencida > 0}
        />
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
        {FILTROS.map((item) => (
          <Chip
            key={item}
            size="small"
            label={t(
              item === 'Todas' ? 'Todas'
                : item === 'DDA' ? 'DDA'
                : item === 'Free Control' ? 'Free Control'
                : item === 'Boletos' ? 'Boletos'
                : item === 'Para autorizar' ? 'Para autorizar'
                : item === 'Vencidas' ? 'Vencidas'
                : item === 'NF Parcial' ? 'NF Parcial'
                : item === 'NF Pendente' ? 'NF Pendente'
                : 'NF confirmada',
              item === 'Todas' ? 'All'
                : item === 'DDA' ? 'DDA'
                : item === 'Free Control' ? 'Free Control'
                : item === 'Boletos' ? 'Boletos'
                : item === 'Para autorizar' ? 'To authorize'
                : item === 'Vencidas' ? 'Overdue'
                : item === 'NF Parcial' ? 'Partial NF'
                : item === 'NF Pendente' ? 'Pending NF'
                : 'Invoice confirmed',
            )}
            variant="outlined"
            onClick={() => {
              setFiltro(item)
              setPagina(0)
              // Free Control é seg→dom; a Agenda abre em sáb→sáb.
              if (item === 'Free Control') {
                const fc = periodoFreeControl()
                setDe(fc.de)
                setAte(fc.ate)
                void api.syncFreecontrol()
                  .then(() => carregar())
                  .catch(() => undefined)
              }
            }}
            sx={finChipSx(filtro === item)}
          />
        ))}
      </Stack>

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...finPaperSx }}>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ '& .MuiTableCell-head': { verticalAlign: 'middle' } }}>
              {[
                t('Status', 'Status'), t('Descrição', 'Description'), t('Origem', 'Source'), t('Nota fiscal', 'Invoice'),
                t('Forma de pagamento', 'Payment method'), t('Código', 'Code'), t('Vencimento', 'Due date'), t('Valor', 'Amount'), '',
              ].map((h, indice) => {
                const centro = indice !== 1
                return (
                  <TableCell
                    key={h || 'acao'}
                    align={centro ? 'center' : 'left'}
                    sx={{
                      ...(indice === 3 ? { width: 148, minWidth: 148 } : null),
                      ...(indice === 8 ? { width: 72, px: 0.5 } : null),
                    }}
                  >
                    {h}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} sx={{ border: 0, py: 0 }}>
                  <EstadoVazio
                    icone={<PaymentsOutlinedIcon sx={{ fontSize: 40 }} />}
                    titulo={
                      noPeriodo.length
                        ? t('Nenhuma despesa neste filtro', 'No expenses in this filter')
                        : t('Nenhuma despesa na agenda', 'No expenses on the agenda')
                    }
                    texto={
                      noPeriodo.length
                        ? t(
                          'Ajuste o período, a loja ou o filtro acima para ver outros lançamentos.',
                          'Adjust the period, store or filter above to see other entries.',
                        )
                        : t(
                          'Crie a despesa no Inbox e confirme para ela entrar aqui. Importar ainda lança direto na agenda. Os boletos do Inbox entram depois da confirmação.',
                          'Create the expense in the Inbox and confirm it to land here. Import still posts straight to the agenda. Inbox boletos appear after confirmation.',
                        )
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {visiveis.map((e) => {
              const tomChave = situacao(e)
              const tom = TOM_CLARO[tomChave] || TOM_CLARO.a_pagar
              const rotulo = ROTULO[tomChave] || ROTULO.a_pagar
              return (
              <TableRow key={e.id} hover>
                <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
                  <Chip size="small" label={idioma === 'en' ? rotulo[1] : rotulo[0]} variant="outlined" sx={{ height: 20, fontSize: 11, fontWeight: 500, color: tom.color, borderColor: tom.border, bgcolor: tom.bg }} />
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, color: FIN_TEXT }}>
                    {rotuloDescricao(e) || t('Sem descrição', 'No description')}
                  </Typography>
                </TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle' }}>{e.origem}</TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle', width: 168, minWidth: 168, px: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 24 }}>
                    {(() => {
                      const chipClick = !somenteLeitura
                        ? { cursor: 'pointer', '&:hover': { filter: 'brightness(0.97)' } }
                        : null

                      // Free Control → selo curto por tipo (mesmas cores: confirmado / pendente)
                      if (ehFreeControl(e)) {
                        const ok = (e.conferencia_status || 'ok') !== 'pendente'
                        const tipo = e.freecontrol_tipo === 'treinamento'
                          ? t('Trein', 'Train')
                          : e.freecontrol_tipo === 'despesa'
                            ? t('Desp', 'Exp')
                            : t('free', 'free')
                        const label = ok
                          ? t(`${tipo} confirmado`, `${tipo} confirmed`)
                          : t(`${tipo} pendente`, `${tipo} pending`)
                        return (
                          <Tooltip title={somenteLeitura ? '' : t('Clique para alterar conferência Free Control', 'Click to change Free Control check')}>
                            <Chip
                              size="small"
                              icon={ok ? <CheckIcon /> : undefined}
                              label={label}
                              onClick={(ev) => {
                                if (somenteLeitura) return
                                ev.stopPropagation()
                                setMenuConf({ despesa: e, anchor: ev.currentTarget, modo: 'free' })
                              }}
                              sx={{
                                bgcolor: ok ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.14)',
                                color: ok ? '#047857' : '#475569',
                                fontWeight: 600,
                                '& .MuiChip-icon': { color: '#047857' },
                                ...chipClick,
                              }}
                            />
                          </Tooltip>
                        )
                      }

                      // Tributo — selo curto; tipo completo no tooltip
                      if (e.tributo_tipo || e.tributo_rotulo) {
                        const conferido = e.conferencia_status === 'conferido'
                        const tipoHint = e.tributo_rotulo ? ` (${e.tributo_rotulo})` : ''
                        return (
                          <Tooltip
                            title={
                              conferido
                                ? t(`trib. confirmado${tipoHint} — cruzamento automático ou manual`, `tax confirmed${tipoHint}`)
                                : t(`trib. pendente${tipoHint} — clique para ver / confirmar`, `tax pending${tipoHint}`)
                            }
                          >
                            <Chip
                              size="small"
                              icon={conferido ? <CheckIcon /> : undefined}
                              label={conferido ? t('trib. confirmado', 'tax confirmed') : t('trib. pendente', 'tax pending')}
                              onClick={(ev) => {
                                if (somenteLeitura) return
                                ev.stopPropagation()
                                setMenuConf({ despesa: e, anchor: ev.currentTarget, modo: 'tributo' })
                              }}
                              sx={{
                                bgcolor: conferido ? 'rgba(16,185,129,0.12)' : 'rgba(100,116,139,0.14)',
                                color: conferido ? '#047857' : '#475569',
                                fontWeight: 600,
                                '& .MuiChip-icon': { color: '#047857' },
                                ...chipClick,
                              }}
                            />
                          </Tooltip>
                        )
                      }

                      const ciclo = cicloNf(e)
                      const podeMudar = !somenteLeitura && (e.fonte === 'dda' || e.fonte === 'nfe' || !!e.numero_nf)
                      const abrirMenu = (ev: React.MouseEvent<HTMLElement>) => {
                        if (!podeMudar) return
                        ev.stopPropagation()
                        setMenuNf({ despesa: e, anchor: ev.currentTarget })
                      }
                      if (ciclo === 'divergente') {
                        return (
                          <Tooltip title={podeMudar ? t('Clique para alterar status', 'Click to change status') : t('Conferida com diferença de quantidade', 'Checked with quantity mismatch')}>
                            <Chip
                              size="small"
                              icon={<ReportProblemOutlinedIcon />}
                              label={t('NF Parcial', 'Partial NF')}
                              onClick={abrirMenu}
                              sx={{ bgcolor: 'rgba(245,158,11,0.14)', color: '#B45309', fontWeight: 600, '& .MuiChip-icon': { color: '#B45309' }, ...(podeMudar ? chipClick : null) }}
                            />
                          </Tooltip>
                        )
                      }
                      if (ciclo === 'confirmada') {
                        return (
                          <Tooltip title={podeMudar ? t('Clique para alterar status', 'Click to change status') : ''}>
                            <Chip
                              size="small"
                              icon={<CheckIcon />}
                              label={t('NF confirmada', 'Invoice confirmed')}
                              onClick={abrirMenu}
                              sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#047857', fontWeight: 600, '& .MuiChip-icon': { color: '#047857' }, ...(podeMudar ? chipClick : null) }}
                            />
                          </Tooltip>
                        )
                      }
                      if (ciclo === 'nao_confirmada') {
                        return (
                          <Tooltip title={podeMudar ? t('Clique para confirmar ou alterar', 'Click to confirm or change') : t('Aguardando confirmação', 'Awaiting confirmation')}>
                            <Chip
                              size="small"
                              icon={<AttachFileOutlinedIcon />}
                              label={t('NF Pendente', 'Pending NF')}
                              onClick={abrirMenu}
                              sx={{ bgcolor: 'rgba(100,116,139,0.14)', color: '#475569', fontWeight: 600, '& .MuiChip-icon': { color: '#64748B' }, ...(podeMudar ? chipClick : null) }}
                            />
                          </Tooltip>
                        )
                      }
                      return (
                        <Tooltip title={t('Sem cruzamento de NF', 'No invoice match')}>
                          <AttachFileOutlinedIcon aria-label="Sem NF" sx={{ fontSize: 18, color: FIN_MUTED, display: 'block', opacity: 0.35 }} />
                        </Tooltip>
                      )
                    })()}
                  </Box>
                </TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
                  {e.fonte === 'dda' || e.fonte === 'nfe' || ehFreeControl(e) ? (
                    <Chip
                      size="small"
                      label={
                        e.fonte === 'nfe'
                          ? 'NF'
                          : e.fonte === 'dda'
                            ? 'DDA'
                            : e.freecontrol_tipo === 'treinamento'
                              ? 'TREIN'
                              : e.freecontrol_tipo === 'despesa'
                                ? 'DESP'
                                : 'FREE'
                      }
                      sx={{
                        height: 20,
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        bgcolor:
                          e.fonte === 'nfe'
                            ? 'rgba(16,185,129,0.18)'
                            : e.fonte === 'dda'
                              ? 'rgba(27,110,243,0.22)'
                              : e.freecontrol_tipo === 'treinamento'
                                ? 'rgba(232,82,10,0.14)'
                                : e.freecontrol_tipo === 'despesa'
                                  ? 'rgba(100,116,139,0.16)'
                                  : 'rgba(13,148,136,0.16)',
                        color:
                          e.fonte === 'nfe'
                            ? '#047857'
                            : e.fonte === 'dda'
                              ? '#1D4ED8'
                              : e.freecontrol_tipo === 'treinamento'
                                ? '#C2410C'
                                : e.freecontrol_tipo === 'despesa'
                                  ? '#475569'
                                  : '#0F766E',
                        border: '1px solid',
                        borderColor:
                          e.fonte === 'nfe'
                            ? 'rgba(110,231,183,0.35)'
                            : e.fonte === 'dda'
                              ? 'rgba(147,197,253,0.35)'
                              : e.freecontrol_tipo === 'treinamento'
                                ? 'rgba(232,82,10,0.28)'
                                : e.freecontrol_tipo === 'despesa'
                                  ? 'rgba(100,116,139,0.28)'
                                  : 'rgba(13,148,136,0.35)',
                      }}
                    />
                  ) : (
                    CODIGO[e.forma_pagamento || ''] || '—'
                  )}
                </TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle' }}><Codigo forma={e.forma_pagamento} pagamento={e.pagamento} /></TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle', color: aberta(e) && e.vencimento && e.vencimento < hoje ? '#B91C1C' : FIN_TEXT }}>
                  {e.vencimento ? e.vencimento.split('-').reverse().join('/') : '—'}
                </TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle', fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{brl(Number(e.valor))}</Typography>
                  {linhaAcrescimo(e) ? (
                    <Typography sx={{ fontSize: 10.5, color: '#B45309', lineHeight: 1.2 }}>{linhaAcrescimo(e)}</Typography>
                  ) : null}
                </TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle', width: 72, px: 0.5 }}>
                  <Stack direction="row" spacing={0.25} sx={{ justifyContent: 'center' }}>
                    <Tooltip title={somenteLeitura ? t('Ver', 'View') : t('Abrir', 'Open')}>
                      <IconButton
                        size="small"
                        onClick={() => setEditando(e)}
                        aria-label={somenteLeitura ? t('Ver', 'View') : t('Abrir', 'Open')}
                        sx={{ p: 0.35, color: FIN_MUTED, '&:hover': { color: '#1B6EF3', bgcolor: 'rgba(27,110,243,0.08)' } }}
                      >
                        <OpenInNewIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    {!somenteLeitura && (
                      <Tooltip title={t('Excluir', 'Delete')}>
                        <IconButton
                          size="small"
                          onClick={() => { setErroExcluir(''); setExcluir(e) }}
                          aria-label={t('Excluir', 'Delete')}
                          sx={{ p: 0.35, color: FIN_MUTED, '&:hover': { color: '#B91C1C', bgcolor: 'rgba(239,68,68,0.08)' } }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
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
          onPageChange={(_, nova) => setPagina(nova)}
          rowsPerPage={porPagina}
          onRowsPerPageChange={(ev) => { setPorPagina(Number(ev.target.value)); setPagina(0) }}
          rowsPerPageOptions={[20, 50, 100]}
          labelRowsPerPage={t('Por página', 'Per page')}
          labelDisplayedRows={({ from, to, count }) => t(`${from}–${to} de ${count}`, `${from}–${to} of ${count}`)}
          slotProps={{ select: finSelectMenu }}
          sx={{
            flexShrink: 0,
            borderTop: '1px solid',
            borderColor: FIN_BORDER,
            bgcolor: FIN_SURFACE,
            color: FIN_MUTED,
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
              color: FIN_MUTED,
            },
            '& .MuiTablePagination-select': { fontSize: 12, color: FIN_TEXT, py: 0 },
            '& .MuiTablePagination-input': { color: FIN_TEXT, m: 0 },
            '& .MuiTablePagination-actions': { ml: 0.5 },
            '& .MuiTablePagination-actions .MuiIconButton-root': { p: 0.25 },
          }}
        />
      </Paper>

      <Dialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        slotProps={{ paper: { sx: dialogEscuroPaper } }}
      >
        <DialogTitle sx={{ color: FIN_TEXT }}>{t('Deseja excluir?', 'Delete this expense?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: FIN_MUTED }}>{excluir?.descricao}</Typography>
          {erroExcluir && <Typography color="error" variant="body2" sx={{ mt: 1 }}>{erroExcluir}</Typography>}
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setExcluir(null)} disabled={excluindo} sx={{ color: FIN_MUTED }}>{t('Cancelar', 'Cancel')}</Button>
          <Button
            color="error"
            variant="contained"
            disabled={excluindo}
            onClick={async () => {
              if (!excluir) return
              setExcluindo(true)
              try {
                await api.excluirDespesa(excluir.id)
                setExcluir(null)
                carregar()
                setAviso(t('Despesa excluída.', 'Expense deleted.'))
              } catch (err) {
                setErroExcluir(err instanceof Error ? err.message : 'Não excluiu')
              } finally {
                setExcluindo(false)
              }
            }}
          >
            {excluindo ? t('Excluindo…', 'Deleting…') : t('Excluir', 'Delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {editando ? (
        <DespesaForm
          key={editando.id}
          aberto
          inicial={editando}
          empresas={empresas}
          somenteLeitura={somenteLeitura}
          onFechar={() => setEditando(null)}
          onSalvou={(mensagem) => { setEditando(null); carregar(); setAviso(mensagem) }}
        />
      ) : null}
      {!somenteLeitura && (
        <ImportarArquivosDialog
          aberto={importarAberto}
          onFechar={() => setImportarAberto(false)}
          onImportou={(mensagem) => {
            carregar()
            setAviso(mensagem)
          }}
        />
      )}
      <Menu
        anchorEl={menuNf?.anchor ?? null}
        open={!!menuNf}
        onClose={() => { if (!salvandoNf) setMenuNf(null) }}
        slotProps={{ paper: { sx: finMenuSx } }}
      >
        <MenuItem disabled={salvandoNf} onClick={() => void alterarStatusNf('confirmada')}>
          {t('NF confirmada', 'Invoice confirmed')}
        </MenuItem>
        <MenuItem disabled={salvandoNf} onClick={() => void alterarStatusNf('divergente')}>
          {t('NF Parcial', 'Partial NF')}
        </MenuItem>
        <MenuItem disabled={salvandoNf} onClick={() => void alterarStatusNf('nao_confirmada')}>
          {t('NF Pendente', 'Pending NF')}
        </MenuItem>
      </Menu>
      <Menu
        anchorEl={menuConf?.anchor ?? null}
        open={!!menuConf}
        onClose={() => { if (!salvandoNf) setMenuConf(null) }}
        slotProps={{ paper: { sx: finMenuSx } }}
      >
        {menuConf?.modo === 'free' ? (
          <>
            <MenuItem disabled={salvandoNf} onClick={() => void alterarConferencia('ok')}>
              {t('Free Control confirmado', 'Free Control confirmed')}
            </MenuItem>
            <MenuItem disabled={salvandoNf} onClick={() => void alterarConferencia('pendente')}>
              {t('Free Control pendente', 'Free Control pending')}
            </MenuItem>
          </>
        ) : (
          <>
            <MenuItem disabled={salvandoNf} onClick={() => void alterarConferencia('conferido')}>
              {t('trib. confirmado', 'tax confirmed')}
            </MenuItem>
            <MenuItem disabled={salvandoNf} onClick={() => void alterarConferencia('pendente')}>
              {t('trib. pendente', 'tax pending')}
            </MenuItem>
            {menuConf?.despesa.tributo_portal ? (
              <MenuItem
                onClick={() => {
                  window.open(menuConf.despesa.tributo_portal!, '_blank', 'noopener,noreferrer')
                  setMenuConf(null)
                }}
              >
                {t('Abrir portal da Receita/Fazenda', 'Open tax authority portal')}
              </MenuItem>
            ) : null}
          </>
        )}
      </Menu>
      <Snackbar open={!!aviso} autoHideDuration={3200} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
    </Stack>
  )
}

type PreviaLinha = {
  nome: string
  ok: boolean
  tipo?: string
  descricao?: string | null
  valor?: number | null
  vencimento?: string | null
  empresa?: string | null
  forma_pagamento?: string | null
  cnpj?: string | null
  erro?: string | null
  ja_existia?: boolean
}

function ImportarArquivosDialog({
  aberto,
  onFechar,
  onImportou,
}: {
  aberto: boolean
  onFechar: () => void
  onImportou: (mensagem: string) => void
}) {
  const { t } = usePrefs()
  const input = useRef<HTMLInputElement>(null)
  const [arquivos, setArquivos] = useState<File[]>([])
  const [previa, setPrevia] = useState<PreviaLinha[]>([])
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({})
  const [lendo, setLendo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [resultado, setResultado] = useState<Array<{ nome: string; ok: boolean; texto: string }>>([])

  const reset = () => {
    setArquivos([])
    setPrevia([])
    setMarcadas({})
    setErro('')
    setSucesso('')
    setResultado([])
    setLendo(false)
    setEnviando(false)
    if (input.current) input.current.value = ''
  }

  useEffect(() => {
    if (!aberto) reset()
  }, [aberto])

  const lerPrevia = async (lista: File[]) => {
    if (!lista.length) {
      setPrevia([])
      setMarcadas({})
      return
    }
    setLendo(true)
    setErro('')
    setSucesso('')
    setResultado([])
    try {
      const payload = await Promise.all(
        lista.map(async (f) => ({
          nome: f.name,
          base64: arquivoBase64(await f.arrayBuffer()),
        })),
      )
      const r = await api.previaImportarArquivos(payload)
      const linhas = r.resultados || []
      setPrevia(linhas)
      const next: Record<string, boolean> = {}
      for (const linha of linhas) {
        next[linha.nome] = !!linha.ok && !linha.ja_existia
      }
      setMarcadas(next)
      if (!linhas.length) {
        setErro(t('Nada foi lido nos arquivos.', 'Nothing was read from the files.'))
      } else if (linhas.every((l) => !l.ok && !l.ja_existia)) {
        setErro(t('Nenhum arquivo pronto para gerar despesa.', 'No file ready to create an expense.'))
      }
    } catch (err) {
      setPrevia([])
      setMarcadas({})
      setErro(err instanceof Error ? err.message : t('Não leu os arquivos', 'Could not read the files'))
    } finally {
      setLendo(false)
    }
  }

  const escolher = (lista: FileList | null) => {
    if (!lista?.length) return
    const novos = Array.from(lista).filter((f) => EXT_OK.test(f.name))
    if (!novos.length) {
      setErro(t(
        'Tipo inválido. Use PDF (GFD, DARF/PGFN, parcelamento, TRCT, férias), DDA (xlsx, csv, ret, txt) ou XML de NF-e.',
        'Invalid type. Use PDF (GFD, DARF/PGFN, installment, TRCT, vacation), DDA (xlsx, csv, ret, txt) or NF-e XML.',
      ))
      return
    }
    const mesclados = (() => {
      const nomes = new Set(arquivos.map((f) => f.name))
      return [...arquivos, ...novos.filter((f) => !nomes.has(f.name))].slice(0, 30)
    })()
    setArquivos(mesclados)
    if (input.current) input.current.value = ''
    void lerPrevia(mesclados)
  }

  const remover = (nome: string) => {
    const resto = arquivos.filter((f) => f.name !== nome)
    setArquivos(resto)
    void lerPrevia(resto)
  }

  const selecionaveis = previa.filter((p) => p.ok && !p.ja_existia)
  const marcarQtd = selecionaveis.filter((p) => marcadas[p.nome]).length

  const confirmar = async () => {
    const escolhidos = arquivos.filter((f) => marcadas[f.name])
    if (!escolhidos.length) {
      setErro(t('Marque ao menos um arquivo pronto na prévia.', 'Select at least one ready file in the preview.'))
      return
    }
    setEnviando(true)
    setErro('')
    setSucesso('')
    setResultado([])
    try {
      const payload = await Promise.all(
        escolhidos.map(async (f) => ({
          nome: f.name,
          base64: arquivoBase64(await f.arrayBuffer()),
        })),
      )
      const r = await api.importarArquivosAgenda(payload)
      const linhas = (r.resultados || []).map((item) => ({
        nome: item.nome,
        ok: !!item.ok,
        texto: item.ok
          ? (item.ja_existia
            ? t('Já estava na agenda', 'Already on the agenda')
            : t(`${item.criadas || 0} despesa(s) · ${item.empresa || item.descricao || ''}`, `${item.criadas || 0} expense(s) · ${item.empresa || item.descricao || ''}`))
          : (item.erro || t('Falhou', 'Failed')),
      }))
      setResultado(linhas)
      if (r.criadas > 0) {
        const msg = r.criadas === 1
          ? t('1 despesa gerada na agenda.', '1 expense added to the agenda.')
          : t(`${r.criadas} despesas geradas na agenda.`, `${r.criadas} expenses added to the agenda.`)
        setSucesso(msg)
        onImportou(msg)
      } else if (linhas.some((l) => l.ok)) {
        const msg = t('Arquivos processados (já existiam).', 'Files processed (already existed).')
        setSucesso(msg)
        onImportou(msg)
      } else {
        setErro(t('Nenhuma despesa criada. Veja o detalhe abaixo.', 'No expense created. See details below.'))
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não importou', 'Import failed'))
    } finally {
      setEnviando(false)
    }
  }

  const dataBr = (iso?: string | null) => {
    if (!iso) return '—'
    const [a, m, d] = iso.slice(0, 10).split('-')
    return d && m && a ? `${d}/${m}/${a}` : iso
  }

  const rotuloTipo = (tipo?: string) => {
    const mapa: Record<string, [string, string]> = {
      ferias: ['Férias', 'Vacation'],
      gfd: ['GFD FGTS', 'GFD FGTS'],
      darf: ['DARF / PGFN', 'DARF / PGFN'],
      parcelamento: ['Parcelamento', 'Installment'],
      trct: ['Rescisão', 'Termination'],
      dda: ['DDA', 'DDA'],
      nfe_xml: ['NF-e', 'NF-e'],
      pdf: ['PDF', 'PDF'],
    }
    const par = mapa[(tipo || '').toLowerCase()]
    return par ? t(par[0], par[1]) : (tipo || 'DOC').toUpperCase()
  }

  const rotuloForma = (forma?: string | null) => {
    if (!forma) return null
    return CODIGO[forma] || forma
  }

  const prontos = previa.filter((p) => p.ok && !p.ja_existia).length
  const existentes = previa.filter((p) => p.ja_existia).length
  const comErro = previa.filter((p) => !p.ok && !p.ja_existia).length
  const totalMarcado = selecionaveis
    .filter((p) => marcadas[p.nome])
    .reduce((a, p) => a + (Number(p.valor) || 0), 0)

  return (
    <Dialog
      open={aberto}
      onClose={() => { if (!enviando && !lendo) onFechar() }}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { ...dialogEscuroPaper, borderRadius: 2.5 } } }}
    >
      <DialogTitle sx={{ pb: 0.5, fontWeight: 650, letterSpacing: '-0.02em', color: FIN_TEXT }}>
        {t('Importar para a agenda', 'Import to bank agenda')}
      </DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        <Stack spacing={1.75}>
          <input
            ref={input}
            type="file"
            hidden
            multiple
            accept=".pdf,.xlsx,.xls,.csv,.ret,.txt,.rem,.cnab,.xml,application/pdf,application/xml,text/xml"
            onChange={(ev) => escolher(ev.target.files)}
          />

          {previa.length === 0 && !lendo ? (
            <Box
              onClick={() => { if (!enviando) input.current?.click() }}
              onDragOver={(ev) => { ev.preventDefault(); ev.stopPropagation() }}
              onDrop={(ev) => {
                ev.preventDefault()
                if (!enviando) escolher(ev.dataTransfer.files)
              }}
              sx={{
                border: '1.5px dashed',
                borderColor: FIN_BORDER,
                borderRadius: 2,
                px: 2.5,
                py: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: FIN_SURFACE_ALT,
                transition: 'border-color .15s, background-color .15s',
                '&:hover': {
                  borderColor: '#1B6EF3',
                  bgcolor: 'rgba(27,110,243,0.1)',
                },
              }}
            >
              <UploadFileOutlinedIcon sx={{ fontSize: 32, color: '#1B6EF3', mb: 1, opacity: 0.9 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 650, letterSpacing: '-0.01em', color: FIN_TEXT }}>
                {t('Solte os arquivos aqui', 'Drop files here')}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: FIN_MUTED, mt: 0.5, maxWidth: 320, mx: 'auto', lineHeight: 1.45 }}>
                {t(
                  'PDF (GFD, DARF, parcelamento, TRCT, férias), DDA ou XML de NF-e. A prévia abre na hora.',
                  'PDF (GFD, DARF, installment, TRCT, vacation), DDA or NF-e XML. Preview opens right away.',
                )}
              </Typography>
              <Button size="small" variant="outlined" sx={{ mt: 1.75, ...finBtnOutlinedSx }} disabled={enviando}>
                {t('Escolher arquivos', 'Choose files')}
              </Button>
            </Box>
          ) : (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
                onClick={() => input.current?.click()}
                disabled={lendo || enviando}
                sx={finBtnOutlinedSx}
              >
                {t('Adicionar', 'Add more')}
              </Button>
              <Button size="small" disabled={lendo || enviando} onClick={() => reset()} sx={{ color: FIN_MUTED }}>
                {t('Limpar', 'Clear')}
              </Button>
              {previa.length > 0 && (
                <Typography sx={{ fontSize: 12, color: FIN_MUTED, ml: 'auto' }}>
                  {prontos > 0 && t(`${prontos} novo${prontos === 1 ? '' : 's'}`, `${prontos} new`)}
                  {existentes > 0 && (prontos > 0 ? ' · ' : '') + t(`${existentes} já na agenda`, `${existentes} already on agenda`)}
                  {comErro > 0 && ((prontos + existentes) > 0 ? ' · ' : '') + t(`${comErro} com erro`, `${comErro} with error`)}
                </Typography>
              )}
            </Stack>
          )}

          {(lendo || enviando) && (
            <LinearProgress
              sx={{
                borderRadius: 1,
                bgcolor: 'rgba(27,110,243,0.15)',
                '& .MuiLinearProgress-bar': { bgcolor: '#1B6EF3' },
              }}
            />
          )}
          {erro && <Alert severity="error" sx={{ py: 0.5 }}>{erro}</Alert>}
          {sucesso && <Alert severity="success" sx={{ py: 0.5 }}>{sucesso}</Alert>}

          {previa.length > 0 && (
            <Stack spacing={1.25} sx={{ maxHeight: 420, overflow: 'auto', pr: 0.25 }}>
              {previa.map((p) => {
                const pode = p.ok && !p.ja_existia
                const marcada = !!marcadas[p.nome]
                const pdf = p.nome.toLowerCase().endsWith('.pdf')
                const borda = p.ja_existia
                  ? 'rgba(245,158,11,0.45)'
                  : !p.ok
                    ? 'rgba(239,68,68,0.4)'
                    : marcada
                      ? '#1B6EF3'
                      : FIN_BORDER
                const fundo = p.ja_existia
                  ? 'rgba(245,158,11,0.08)'
                  : !p.ok
                    ? 'rgba(239,68,68,0.08)'
                    : marcada
                      ? 'rgba(27,110,243,0.12)'
                      : FIN_SURFACE_ALT
                return (
                  <Box
                    key={p.nome}
                    onClick={() => {
                      if (!pode || lendo || enviando) return
                      setMarcadas((m) => ({ ...m, [p.nome]: !m[p.nome] }))
                    }}
                    sx={{
                      position: 'relative',
                      border: '1px solid',
                      borderColor: borda,
                      bgcolor: fundo,
                      borderRadius: 2,
                      px: 1.75,
                      py: 1.5,
                      cursor: pode ? 'pointer' : 'default',
                      transition: 'border-color .12s, background-color .12s',
                    }}
                  >
                    <Stack direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1.25,
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          bgcolor: pdf ? 'rgba(220,38,38,0.18)' : 'rgba(27,110,243,0.18)',
                          color: pdf ? '#B91C1C' : '#1B6EF3',
                        }}
                      >
                        {pdf
                          ? <PictureAsPdfOutlinedIcon sx={{ fontSize: 22 }} />
                          : <DescriptionOutlinedIcon sx={{ fontSize: 22 }} />}
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 0.35 }}>
                          <Chip
                            size="small"
                            label={rotuloTipo(p.tipo)}
                            sx={{
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              letterSpacing: '0.02em',
                              bgcolor: 'rgba(15,23,42,0.06)',
                              color: FIN_TEXT,
                              border: 'none',
                            }}
                          />
                          {p.empresa && (
                            <Typography sx={{ fontSize: 12, fontWeight: 650, color: FIN_TEXT }}>
                              {p.empresa}
                            </Typography>
                          )}
                          {p.ja_existia && (
                            <Chip
                              size="small"
                              label={t('Já na agenda', 'Already on agenda')}
                              sx={{
                                height: 20,
                                fontSize: 10.5,
                                fontWeight: 600,
                                bgcolor: 'rgba(245,158,11,0.18)',
                                color: '#FBBF24',
                                border: 'none',
                              }}
                            />
                          )}
                          {!p.ok && !p.ja_existia && (
                            <Chip
                              size="small"
                              label={t('Não leu', 'Failed')}
                              sx={{
                                height: 20,
                                fontSize: 10.5,
                                fontWeight: 600,
                                bgcolor: 'rgba(239,68,68,0.1)',
                                color: '#B91C1C',
                                border: 'none',
                              }}
                            />
                          )}
                          {pode && marcada && (
                            <Chip
                              size="small"
                              icon={<CheckIcon sx={{ fontSize: '14px !important' }} />}
                              label={t('Selecionado', 'Selected')}
                              sx={{
                                height: 20,
                                fontSize: 10.5,
                                fontWeight: 600,
                                bgcolor: 'rgba(27,110,243,0.1)',
                                color: '#0D4ECC',
                                border: 'none',
                                '& .MuiChip-icon': { color: '#0D4ECC' },
                              }}
                            />
                          )}
                        </Stack>

                        <Typography sx={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.3, color: FIN_TEXT }}>
                          {p.descricao || t('Sem descrição', 'No description')}
                        </Typography>

                        <Stack direction="row" spacing={1.5} sx={{ mt: 0.65, flexWrap: 'wrap', color: FIN_MUTED }}>
                          <Typography sx={{ fontSize: 12 }}>
                            {t('Venc.', 'Due')} {dataBr(p.vencimento)}
                          </Typography>
                          {rotuloForma(p.forma_pagamento) && (
                            <Typography sx={{ fontSize: 12 }}>{rotuloForma(p.forma_pagamento)}</Typography>
                          )}
                          {p.cnpj && (
                            <Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                              CNPJ {p.cnpj.length === 14
                                ? p.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
                                : p.cnpj}
                            </Typography>
                          )}
                        </Stack>

                        <Typography
                          sx={{
                            fontSize: 11,
                            color: 'rgba(148,163,184,0.7)',
                            mt: 0.55,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={p.nome}
                        >
                          {p.nome}
                        </Typography>

                        {!p.ok && !p.ja_existia && p.erro && (
                          <Typography sx={{ fontSize: 12, color: '#B91C1C', mt: 0.6, lineHeight: 1.35 }}>
                            {p.erro}
                          </Typography>
                        )}
                        {p.ja_existia && (
                          <Typography sx={{ fontSize: 12, color: '#B45309', mt: 0.6, lineHeight: 1.35 }}>
                            {t('Esse lançamento já está na agenda — não será duplicado.', 'This entry is already on the agenda — it won’t be duplicated.')}
                          </Typography>
                        )}
                      </Box>

                      <Stack spacing={0.5} sx={{ alignItems: 'flex-end', flexShrink: 0, pl: 0.5 }}>
                        <Typography
                          sx={{
                            fontSize: 17,
                            fontWeight: 700,
                            letterSpacing: '-0.03em',
                            fontVariantNumeric: 'tabular-nums',
                            lineHeight: 1.15,
                            color: p.ok || p.ja_existia ? FIN_TEXT : FIN_MUTED,
                          }}
                        >
                          {p.valor != null && Number.isFinite(Number(p.valor)) ? brl(Number(p.valor)) : '—'}
                        </Typography>
                        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
                          {pode && (
                            <Checkbox
                              size="small"
                              checked={marcada}
                              disabled={lendo || enviando}
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) => setMarcadas((m) => ({ ...m, [p.nome]: ev.target.checked }))}
                              sx={{
                                p: 0.35,
                                color: FIN_MUTED,
                                '&.Mui-checked': { color: '#1B6EF3' },
                              }}
                            />
                          )}
                          <IconButton
                            size="small"
                            disabled={lendo || enviando}
                            aria-label={t('Remover', 'Remove')}
                            onClick={(ev) => { ev.stopPropagation(); remover(p.nome) }}
                            sx={{ color: FIN_MUTED, '&:hover': { color: FIN_TEXT } }}
                          >
                            <CloseIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Stack>
                      </Stack>
                    </Stack>
                  </Box>
                )
              })}
            </Stack>
          )}

          {resultado.length > 0 && (
            <Stack spacing={0.4} sx={{ pt: 0.25 }}>
              {resultado.map((d) => (
                <Typography key={d.nome} sx={{ fontSize: 12.5, color: d.ok ? '#047857' : '#B91C1C' }}>
                  {d.ok ? '✓' : '✗'} {d.texto || d.nome}
                </Typography>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1, justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 12.5, color: FIN_MUTED, fontVariantNumeric: 'tabular-nums' }}>
          {marcarQtd > 0
            ? t(`${marcarQtd} selecionada${marcarQtd === 1 ? '' : 's'} · ${brl(totalMarcado)}`, `${marcarQtd} selected · ${brl(totalMarcado)}`)
            : previa.length > 0
              ? t('Nada selecionado para gerar', 'Nothing selected to create')
              : ' '}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button onClick={onFechar} disabled={enviando} sx={{ color: FIN_MUTED }}>{t('Fechar', 'Close')}</Button>
          <Button
            variant="contained"
            onClick={confirmar}
            disabled={enviando || lendo || marcarQtd === 0}
            sx={finBtnContainedSx}
          >
            {enviando
              ? t('Gerando…', 'Creating…')
              : marcarQtd === 0
                ? t('Confirmar', 'Confirm')
                : t(`Gerar ${marcarQtd} despesa${marcarQtd === 1 ? '' : 's'}`, `Create ${marcarQtd} expense${marcarQtd === 1 ? '' : 's'}`)}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

function Codigo({ forma, pagamento }: { forma: string | null; pagamento: string | null }) {
  const texto = (pagamento || '').trim()
  const folha = forma === 'folha'
    || /^folha(\s+pagamento)?$/i.test(texto)
    || /^folha\s+cadastrada$/i.test(texto)
  if (folha) {
    return (
      <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', textAlign: 'center', color: FIN_TEXT }}>
        FOLHA PAGAMENTO
      </Typography>
    )
  }
  if ((forma === 'chave_pix' || forma === 'boleto') && texto) return <Copia texto={texto} />
  return <Typography sx={{ fontSize: 13, textAlign: 'center' }}>—</Typography>
}

function Copia({ texto }: { texto: string }) {
  const curto = texto.length > 22 ? `${texto.slice(0, 22)}…` : texto
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <Typography variant="caption" sx={{ wordBreak: 'break-all', textAlign: 'center' }}>{curto}</Typography>
      <IconButton size="small" aria-label="Copiar para pagar" onClick={() => navigator.clipboard.writeText(texto)}>
        <ContentCopyIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
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
        px: 1.35,
        py: 0.75,
        pl: 1.6,
        flex: '1 1 0',
        minWidth: 0,
        width: '100%',
        overflow: 'hidden',
        bgcolor: FIN_SURFACE,
        borderColor: FIN_BORDER,
        ...(alerta ? {
          bgcolor: 'rgba(239,68,68,0.12)',
          animation: 'vencida-pulso 2.6s ease-in-out infinite',
          '@keyframes vencida-pulso': {
            '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
            '50%': { boxShadow: '0 0 0 3px rgba(239,68,68,0.18)' },
          },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        } : {}),
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
      <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: alerta ? '#B91C1C' : FIN_MUTED }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: alerta ? '#B91C1C' : FIN_TEXT }}>{valor}</Typography>
      <Typography sx={{ fontSize: 11, fontWeight: 400, color: alerta ? '#B91C1C' : FIN_MUTED }}>{detalhe}</Typography>
    </Paper>
  )
}

const lista = {
  paper: { sx: { ...finMenuSx, zIndex: 1500 } },
  listbox: { sx: { maxHeight: 280, fontSize: 13, bgcolor: FIN_SURFACE, color: FIN_TEXT } },
  popper: { sx: { zIndex: 1500 } },
}

function aoDigitarValor(bruto: string) {
  const s = bruto.replace(/[^\d,]/g, '')
  const [a, b] = s.split(',')
  const inteiro = (a || '').replace(/^0+(?=\d)/, '')
  const grupo = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  if (!s) return ''
  if (s.includes(',')) return `R$ ${grupo || '0'},${(b || '').slice(0, 2)}`
  return `R$ ${grupo}`
}

function parseMoeda(texto: string) {
  const limpo = texto.replace(/[^\d,]/g, '').replace(/\./g, '').replace(',', '.')
  return Number(limpo)
}

function CampoMoeda({
  label,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string
  value: string
  onChange?: (texto: string) => void
  disabled?: boolean
  error?: boolean
}) {
  return (
    <TextField
      label={label}
      size="small"
      value={disabled && !value ? 'R$ 0,00' : value}
      disabled={disabled}
      error={error}
      placeholder="R$ 0,00"
      onChange={onChange ? (ev) => onChange(aoDigitarValor(ev.target.value)) : undefined}
      onBlur={() => {
        if (!onChange || !value) return
        const n = parseMoeda(value)
        if (Number.isFinite(n)) onChange(brl(n))
      }}
      sx={[finCampoSx, error ? finCampoErroSx : null]}
    />
  )
}

function centavos(n: number) {
  return Math.round(n * 100) / 100
}

export function DespesaForm({ aberto, inicial, empresas, onFechar, onSalvou, somenteLeitura = false }: {
  aberto: boolean
  inicial: Despesa | null
  empresas: Empresa[]
  onFechar: () => void
  onSalvou: (mensagem: string, criado?: { vencimento: string | null }) => void
  somenteLeitura?: boolean
}) {
  const { t } = usePrefs()
  /** Lojas + holdings (KING / SUPER KING / Alvim Participações pagam despesas também). */
  const lojas = useMemo(
    () => ordenarEmpresas(empresas.filter((e) => e.tipo === 'loja' || e.tipo === 'holding')),
    [empresas],
  )
  const primeiraLoja = lojas[0]?.id || ''
  const faceInicial = inicial ? Number(inicial.valor_face ?? inicial.valor) : null
  const [descricao, setDescricao] = useState(() => inicial?.descricao || '')
  const [valor, setValor] = useState(() => (faceInicial != null ? brl(faceInicial) : ''))
  const [modo, setModo] = useState<'total' | 'taxas'>(() => inicial?.modo_acrescimo === 'taxas' ? 'taxas' : 'total')
  const [multa, setMulta] = useState(() => (inicial?.multa ? brl(Number(inicial.multa)) : ''))
  const [juros, setJuros] = useState(() => (inicial?.juros ? brl(Number(inicial.juros)) : ''))
  const [outras, setOutras] = useState(() => (inicial?.outras_taxas ? brl(Number(inicial.outras_taxas)) : ''))
  const [desconto, setDesconto] = useState(() => (inicial?.desconto ? brl(Number(inicial.desconto)) : ''))
  const [total, setTotal] = useState(() => (inicial ? brl(Number(inicial.valor)) : ''))
  const [vencimentoOriginal, setVencimentoOriginal] = useState(() => inicial?.vencimento_original || inicial?.vencimento || '')
  const [pagarEm, setPagarEm] = useState(() => inicial?.vencimento || '')
  const [documento, setDocumento] = useState(() => inicial?.documento_ref || '')
  const [origem, setOrigem] = useState(() => inicial?.origem_id || primeiraLoja)
  const conta = inicial?.conta_saida_id || ''
  const [planoId, setPlanoId] = useState(() => inicial?.plano_conta_id || '')
  const [forma, setForma] = useState(() => inicial?.forma_pagamento || 'boleto')
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(() => (
    inicial?.fornecedor_id
      ? { id: inicial.fornecedor_id, nome: inicial.fornecedor || '', plano_conta_id: inicial.plano_conta_id, plano: inicial.plano }
      : null
  ))
  const [buscaFor, setBuscaFor] = useState(() => inicial?.fornecedor || '')
  const [hits, setHits] = useState<Fornecedor[]>([])
  const [pagamento, setPagamento] = useState(() => inicial?.pagamento || '')
  const [erroCampos, setErroCampos] = useState({ descricao: false, valor: false, origem: false })
  const [abrindoNota, setAbrindoNota] = useState(false)
  const [abrindoBoleto, setAbrindoBoleto] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const pedeCodigo = forma === 'boleto' || forma === 'chave_pix'
  const taxa = (texto: string) => {
    const n = parseMoeda(texto)
    return Number.isFinite(n) ? n : 0
  }
  const faceNum = Number.isFinite(parseMoeda(valor)) ? parseMoeda(valor) : 0
  const totalTaxas = centavos(faceNum + taxa(multa) + taxa(juros) + taxa(outras) - taxa(desconto))
  const totalExibido = modo === 'taxas' ? brl(totalTaxas) : total

  const aoMudarValor = (novo: string) => {
    const anterior = parseMoeda(valor)
    setValor(novo)
    if (modo === 'total' && (!total || parseMoeda(total) === anterior)) setTotal(novo)
  }

  const aoMudarModo = (proximo: 'total' | 'taxas') => {
    if (proximo === 'taxas' && !taxa(multa) && !taxa(juros) && !taxa(outras) && !taxa(desconto)) {
      const face = Number.isFinite(parseMoeda(valor)) ? parseMoeda(valor) : 0
      const alvo = total.trim() && Number.isFinite(parseMoeda(total)) ? parseMoeda(total) : face
      const diff = centavos(alvo - face)
      if (diff > 0) setJuros(brl(diff))
      else if (diff < 0) setDesconto(brl(-diff))
    }
    if (proximo === 'total') setTotal(brl(Math.max(totalTaxas, 0)))
    setModo(proximo)
  }

  // Monta com key=nova|id — sem resetar quando a lista de empresas refresca.

  const buscar = async (q: string) => {
    setBuscaFor(q)
    try {
      setHits(await api.fornecedores(q.trim()))
    } catch {
      setHits([])
    }
  }

  const carregarFornecedores = async () => {
    try {
      setHits(await api.fornecedores(buscaFor.trim()))
    } catch {
      setHits([])
    }
  }

  const escolherFornecedor = (item: Fornecedor | null) => {
    setFornecedor(item)
    setBuscaFor(item?.nome || '')
    setPlanoId(item?.plano_conta_id || '')
    setHits([])
  }

  const salvar = async () => {
    if (somenteLeitura || salvando) return
    const face = parseMoeda(valor)
    const totalNum = modo === 'taxas'
      ? totalTaxas
      : (total.trim() ? parseMoeda(total) : face)
    const faltaDesc = !descricao.trim()
    const faltaValor = !Number.isFinite(face) || face <= 0 || !Number.isFinite(totalNum) || totalNum < 0
    const faltaOrigem = !origem
    if (faltaDesc || faltaValor || faltaOrigem) {
      setErroCampos({ descricao: faltaDesc, valor: faltaValor, origem: faltaOrigem })
      showToast(
        faltaValor && Number.isFinite(face) && face > 0
          ? t('O total não pode ficar negativo.', 'The total cannot be negative.')
          : t('Descrição, origem e valor são obrigatórios.', 'Description, store and amount are required.'),
        'error',
      )
      return
    }
    setErroCampos({ descricao: false, valor: false, origem: false })
    setSalvando(true)
    try {
      const corpo = {
        descricao: descricao.trim(),
        valor: totalNum,
        valor_face: face,
        multa: modo === 'taxas' ? taxa(multa) : 0,
        juros: modo === 'taxas' ? taxa(juros) : 0,
        outras_taxas: modo === 'taxas' ? taxa(outras) : 0,
        desconto: modo === 'taxas' ? taxa(desconto) : 0,
        modo_acrescimo: modo,
        vencimento_original: vencimentoOriginal || null,
        vencimento: pagarEm || vencimentoOriginal || null,
        documento_ref: documento.trim() || null,
        forma_pagamento: forma,
        empresa_origem_id: origem,
        conta_saida_id: conta || null,
        plano_conta_id: fornecedor?.plano_conta_id || planoId || null,
        fornecedor_id: fornecedor?.id || null,
        dados_pagamento: pedeCodigo ? pagamento.trim() || null : null,
      }
      if (inicial) await api.atualizarDespesa(inicial.id, corpo)
      else await api.criarDespesa(corpo)
      onSalvou(
        inicial
          ? t('Despesa atualizada.', 'Expense updated.')
          : t('Despesa criada no inbox. Confirme para ela entrar na Agenda banco.', 'Expense created in the inbox. Confirm it to add it to the bank schedule.'),
        inicial ? undefined : { vencimento: pagarEm || vencimentoOriginal || null },
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('Não salvou', 'Could not save')
      showToast(msg, 'error')
      if (/descri|origem|valor|obrigat/i.test(msg)) {
        setErroCampos({
          descricao: /descri/i.test(msg) || /obrigat/i.test(msg),
          valor: /valor/i.test(msg) || /obrigat/i.test(msg),
          origem: /origem|loja|store/i.test(msg) || /obrigat/i.test(msg),
        })
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Drawer
      anchor="right"
      open={aberto}
      onClose={onFechar}
      keepMounted={false}
      ModalProps={{ keepMounted: false }}
      slotProps={{ paper: { sx: drawerEscuroPaper } }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: 'center',
            px: 3,
            py: 2,
            borderBottom: `1px solid ${FIN_BORDER}`,
            bgcolor: FIN_SURFACE,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'rgba(27,110,243,0.18)',
              color: '#1B6EF3',
              flexShrink: 0,
            }}
          >
            <AddIcon sx={{ fontSize: 22 }} />
          </Box>
          <Typography sx={{ flex: 1, fontSize: 16, fontWeight: 650, letterSpacing: '-0.02em', color: FIN_TEXT }}>
            {somenteLeitura
              ? t('Ver despesa', 'View expense')
              : inicial
                ? t('Editar despesa', 'Edit expense')
                : t('Nova despesa', 'New expense')}
          </Typography>
          <IconButton size="small" onClick={onFechar} sx={{ color: FIN_MUTED }} aria-label={t('Fechar', 'Close')}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Stack spacing={1.5} sx={{ p: 3, overflow: 'auto', flex: 1, bgcolor: FIN_SURFACE_ALT, color: FIN_TEXT }}>
          <TextField
            label={t('Descrição', 'Description')}
            size="small"
            autoFocus={!inicial && !somenteLeitura}
            value={descricao}
            error={erroCampos.descricao}
            disabled={somenteLeitura}
            onChange={(ev) => {
              setDescricao(ev.target.value)
              if (erroCampos.descricao) setErroCampos((e) => ({ ...e, descricao: false }))
            }}
            sx={[finCampoSx, erroCampos.descricao ? finCampoErroSx : null]}
          />
          <CampoMoeda
            label={t('Valor', 'Amount')}
            value={valor}
            error={erroCampos.valor}
            disabled={somenteLeitura}
            onChange={(texto) => {
              aoMudarValor(texto)
              if (erroCampos.valor) setErroCampos((e) => ({ ...e, valor: false }))
            }}
          />
          <RadioGroup
            row
            value={modo}
            onChange={(ev) => {
              if (somenteLeitura) return
              aoMudarModo(ev.target.value === 'taxas' ? 'taxas' : 'total')
            }}
            sx={{ px: 0.5, '& .MuiFormControlLabel-label': { fontSize: 13, color: FIN_TEXT } }}
          >
            <FormControlLabel disabled={somenteLeitura} value="total" control={<Radio size="small" sx={{ color: FIN_MUTED, '&.Mui-checked': { color: '#1B6EF3' } }} />} label={t('Informar Total', 'Enter total')} />
            <FormControlLabel disabled={somenteLeitura} value="taxas" control={<Radio size="small" sx={{ color: FIN_MUTED, '&.Mui-checked': { color: '#1B6EF3' } }} />} label={t('Informar Taxas', 'Enter fees')} />
          </RadioGroup>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <CampoMoeda label={t('Multa', 'Fine')} value={modo === 'taxas' ? multa : 'R$ 0,00'} disabled={somenteLeitura || modo !== 'taxas'} onChange={setMulta} />
            <CampoMoeda label={t('Juros', 'Interest')} value={modo === 'taxas' ? juros : 'R$ 0,00'} disabled={somenteLeitura || modo !== 'taxas'} onChange={setJuros} />
            <CampoMoeda label={t('Outras taxas', 'Other fees')} value={modo === 'taxas' ? outras : 'R$ 0,00'} disabled={somenteLeitura || modo !== 'taxas'} onChange={setOutras} />
            <CampoMoeda label={t('Desconto', 'Discount')} value={modo === 'taxas' ? desconto : 'R$ 0,00'} disabled={somenteLeitura || modo !== 'taxas'} onChange={setDesconto} />
          </Box>
          <CampoMoeda
            label={t('Total', 'Total')}
            value={totalExibido}
            disabled={somenteLeitura || modo === 'taxas'}
            error={modo === 'taxas' && totalTaxas < 0}
            onChange={modo === 'total' ? setTotal : undefined}
          />
          <CampoDataFinanceiro
            label={t('Vencimento', 'Due date')}
            value={vencimentoOriginal}
            disabled={somenteLeitura}
            onChange={setVencimentoOriginal}
          />
          <CampoDataFinanceiro
            label={t('Pagar em', 'Pay on')}
            value={pagarEm}
            disabled={somenteLeitura}
            onChange={setPagarEm}
          />
          <TextField
            label={t('Documento', 'Document')}
            size="small"
            value={documento}
            disabled={somenteLeitura}
            onChange={(ev) => setDocumento(ev.target.value)}
            sx={finCampoSx}
          />
          <Autocomplete
            size="small"
            options={lojas}
            getOptionLabel={(e) => e.apelido}
            value={lojas.find((e) => e.id === origem) || null}
            disabled={somenteLeitura}
            onChange={(_, item) => {
              setOrigem(item?.id || '')
              if (erroCampos.origem) setErroCampos((e) => ({ ...e, origem: false }))
            }}
            slotProps={lista}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('Empresa', 'Company')}
                error={erroCampos.origem}
                sx={[finCampoSx, erroCampos.origem ? finCampoErroSx : null]}
              />
            )}
            renderOption={(props, e) => (
              <li {...props} key={e.id}>
                <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 1 }}>
                  <Box component="span" sx={{ flex: 1 }}>{e.apelido}</Box>
                  {e.tipo === 'holding' ? (
                    <Typography component="span" sx={{ fontSize: 10, color: 'text.secondary' }}>
                      holding
                    </Typography>
                  ) : null}
                </Box>
              </li>
            )}
          />
          <Autocomplete
            size="small"
            options={hits}
            getOptionLabel={(item) => item.nome || ''}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            filterOptions={(opcoes) => opcoes}
            inputValue={buscaFor}
            value={fornecedor}
            disabled={somenteLeitura}
            onOpen={() => { if (!somenteLeitura) void carregarFornecedores() }}
            onInputChange={(_, texto, motivo) => { if (motivo === 'input' && !somenteLeitura) void buscar(texto) }}
            onChange={(_, item) => escolherFornecedor(item)}
            noOptionsText={t('Nenhum fornecedor', 'No suppliers')}
            loadingText={t('Buscando…', 'Searching…')}
            slotProps={lista}
            renderInput={(params) => (
              <TextField {...params} label={t('Fornecedor', 'Supplier')} placeholder={t('Buscar', 'Search')} sx={finCampoSx} />
            )}
            renderOption={(props, item) => (
              <li {...props} key={item.id}>{item.nome}{item.plano ? ` · ${item.plano}` : ''}</li>
            )}
          />
          {fornecedor?.plano && (
            <Typography variant="body2" sx={{ color: FIN_MUTED }}>
              {t('Plano de contas', 'Account')}: {fornecedor.plano}
            </Typography>
          )}
          <TextField
            select
            label={t('Forma de pagamento', 'Payment method')}
            size="small"
            value={forma}
            disabled={somenteLeitura}
            onChange={(ev) => setForma(ev.target.value)}
            sx={finCampoSx}
            slotProps={{ select: finSelectMenu }}
          >
            {Object.entries(CODIGO).map(([id, nome]) => <MenuItem key={id} value={id}>{nome}</MenuItem>)}
          </TextField>
          {pedeCodigo && (
            <TextField
              label={forma === 'boleto' ? t('Código de barras do boleto', 'Boleto barcode') : t('Chave PIX', 'PIX key')}
              size="small"
              value={pagamento}
              disabled={somenteLeitura}
              onChange={(ev) => setPagamento(ev.target.value)}
              placeholder={t('Para copiar na hora de pagar', 'Copy this when paying')}
              slotProps={somenteLeitura && pagamento ? {
                input: {
                  endAdornment: (
                    <IconButton
                      size="small"
                      aria-label={t('Copiar', 'Copy')}
                      onClick={() => {
                        void navigator.clipboard.writeText(pagamento).then(
                          () => showToast(t('Copiado.', 'Copied.'), 'success'),
                          () => showToast(t('Não copiou', 'Could not copy'), 'error'),
                        )
                      }}
                      sx={{ color: FIN_MUTED }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  ),
                },
              } : undefined}
              sx={finCampoSx}
            />
          )}
          {inicial ? (
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DescriptionOutlinedIcon sx={{ fontSize: 16 }} />}
                disabled={!inicial.numero_nf || abrindoNota}
                onClick={async () => {
                  setAbrindoNota(true)
                  try { await api.abrirNota(inicial.id) }
                  catch (err) {
                    showToast(err instanceof Error ? err.message : t('Não abriu a nota', 'Could not open invoice'), 'error')
                  }
                  finally { setAbrindoNota(false) }
                }}
                sx={{
                  ...finBtnOutlinedSx,
                  minWidth: 0,
                  flex: 1,
                  color: inicial.numero_nf ? FIN_TEXT : FIN_MUTED,
                  borderColor: inicial.numero_nf ? 'rgba(27,110,243,0.45)' : FIN_BORDER,
                  bgcolor: FIN_SURFACE,
                }}
              >
                {abrindoNota ? t('Abrindo nota…', 'Opening invoice…') : t('Ver nota fiscal', 'View invoice')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />}
                disabled={!inicial.numero_nf || abrindoBoleto}
                onClick={async () => {
                  setAbrindoBoleto(true)
                  try { await api.abrirBoleto(inicial.id) }
                  catch (err) {
                    showToast(err instanceof Error ? err.message : t('Não abriu o boleto', 'Could not open boleto'), 'error')
                  }
                  finally { setAbrindoBoleto(false) }
                }}
                sx={{
                  ...finBtnOutlinedSx,
                  minWidth: 0,
                  flex: 1,
                  color: inicial.numero_nf ? FIN_TEXT : FIN_MUTED,
                  borderColor: inicial.numero_nf ? 'rgba(27,110,243,0.45)' : FIN_BORDER,
                  bgcolor: FIN_SURFACE,
                }}
              >
                {abrindoBoleto ? t('Abrindo boleto…', 'Opening boleto…') : t('Ver boleto', 'View boleto')}
              </Button>
            </Stack>
          ) : null}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', px: 3, py: 2, borderTop: `1px solid ${FIN_BORDER}`, bgcolor: FIN_SURFACE }}>
          <Button onClick={onFechar} disabled={salvando} sx={{ color: FIN_MUTED }}>
            {somenteLeitura ? t('Fechar', 'Close') : t('Cancelar', 'Cancel')}
          </Button>
          {!somenteLeitura && (
            <Button variant="contained" onClick={() => void salvar()} disabled={salvando} sx={finBtnContainedSx}>
              {salvando
                ? t('Salvando…', 'Saving…')
                : inicial
                  ? t('Salvar', 'Save')
                  : t('Criar no inbox', 'Create in inbox')}
            </Button>
          )}
        </Stack>
      </Stack>
    </Drawer>
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
      <Box sx={{ color: 'rgba(100,116,139,0.7)', display: 'flex', mb: 0.5 }}>{icone}</Box>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: FIN_TEXT, letterSpacing: '-0.02em' }}>
        {titulo}
      </Typography>
      <Typography sx={{ fontSize: 13, color: FIN_MUTED, maxWidth: 460, lineHeight: 1.55 }}>
        {texto}
      </Typography>
    </Box>
  )
}
