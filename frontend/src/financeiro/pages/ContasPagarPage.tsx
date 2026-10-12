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
import IconButton from '@mui/material/IconButton'
import LinearProgress from '@mui/material/LinearProgress'
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
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { api, brl, emCache, urlDespesas, urlEmpresas, type Despesa, type Empresa, type Fornecedor } from '../api'
import { ordenarEmpresas, ordenarLancamentosPorEmpresa } from '../ordemEmpresas'
import { rotuloDespesa } from '../rotuloDespesa'
import { usePrefs } from '../prefs'
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota'
import { showToast } from '../../utils/toast'
import CampoDataFinanceiro from '../CampoDataFinanceiro'
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

function situacao(e: Despesa) {
  if (e.status === 'conciliada') return 'conciliada'
  if (e.status === 'paga') return 'paga'
  if (e.status === 'enviada') return 'enviada'
  if (e.status === 'autorizada') return 'autorizada'
  if (e.status === 'pronta') return 'pronta'
  if (e.status === 'bloqueada_duplicata') return 'bloqueada_duplicata'
  return 'a_pagar'
}
const CODIGO: Record<string, string> = {
  folha: 'Folha', cadastro: 'Cadastro', chave_pix: 'Chave PIX',
  boleto: 'Boleto', guia: 'Guia', dinheiro: 'Dinheiro', online: 'Online',
}
const FILTROS = ['Todas', 'DDA', 'Boletos', 'Para autorizar', 'Vencidas', 'NF confirmada'] as const

const TOM_CLARO: Record<string, { color: string; border: string; bg: string }> = {
  rascunho: { color: '#64748B', border: '#E2E8F0', bg: 'transparent' },
  classificada: { color: '#0D4ECC', border: 'rgba(27,110,243,0.35)', bg: 'rgba(27,110,243,0.08)' },
  pronta: { color: '#1D4ED8', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.1)' },
  autorizada: { color: '#1D4ED8', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.1)' },
  enviada: { color: '#1D4ED8', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.1)' },
  paga: { color: '#047857', border: 'rgba(16,185,129,0.45)', bg: 'rgba(16,185,129,0.12)' },
  conciliada: { color: '#047857', border: 'rgba(16,185,129,0.45)', bg: 'rgba(16,185,129,0.12)' },
  bloqueada_duplicata: { color: '#B91C1C', border: 'rgba(239,68,68,0.45)', bg: 'rgba(239,68,68,0.08)' },
  a_pagar: { color: '#B45309', border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.12)' },
}

const ROTULO: Record<string, [string, string]> = {
  conciliada: ['Conciliada', 'Reconciled'],
  paga: ['Paga', 'Paid'],
  enviada: ['Enviada', 'Sent'],
  autorizada: ['Autorizada', 'Authorized'],
  pronta: ['Para autorizar', 'To authorize'],
  bloqueada_duplicata: ['Duplicata', 'Duplicate'],
  a_pagar: ['A pagar', 'To pay'],
  rascunho: ['Rascunho', 'Draft'],
}

const aberta = (e: Despesa) => !['paga', 'conciliada', 'cancelada'].includes(e.status)
const hoje = new Date().toISOString().slice(0, 10)

function rotuloDescricao(e: Despesa) {
  return rotuloDespesa(e)
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
  const [empresas, setEmpresas] = useState<Empresa[]>(() => emCache<Empresa[]>(urlEmpresas()) ?? [])
  const [despesas, setDespesas] = useState<Despesa[]>(() => emCache<Despesa[]>(urlDespesas(params.get('loja') || undefined)) ?? [])
  const [loja, setLoja] = useState(() => params.get('loja') || '')
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState(() => params.get('de') || periodoAtual().de)
  const [ate, setAte] = useState(() => params.get('ate') || periodoAtual().ate)
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('Todas')
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(20)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Despesa | null>(null)
  const [excluir, setExcluir] = useState<Despesa | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [aviso, setAviso] = useState('')
  const [erroExcluir, setErroExcluir] = useState('')
  const [erroBanco, setErroBanco] = useState('')
  const [importarAberto, setImportarAberto] = useState(false)

  const carregar = (empresa = loja) => api.despesas(empresa || undefined).then((rows) => {
    setDespesas(rows)
    setErroBanco('')
  }).catch(() => {
    setErroBanco(t(
      'Não carregou o financeiro. Confira a permissão financeiro.ver.',
      'Could not load finance. Check the financeiro.ver permission.',
    ))
  })

  useEffect(() => {
    api.empresas().then((rows) => {
      setEmpresas(rows)
      if (rows.length) setErroBanco('')
    }).catch(() => {
      setErroBanco(t(
        'Não carregou o financeiro. Confira a permissão financeiro.ver.',
        'Could not load finance. Check the financeiro.ver permission.',
      ))
    })
    carregar(params.get('loja') || '')
  }, [])

  /** Agenda banco: DDA só depois de confirmado (status pronta+). Manual entra direto. */
  const naAgenda = useMemo(() => despesas.filter((e) => {
    if (e.fonte === 'dda') return ['pronta', 'autorizada', 'enviada', 'paga', 'conciliada'].includes(e.status)
    return true
  }), [despesas])

  const noPeriodo = useMemo(() => naAgenda.filter((e) => {
    const vencimento = (e.vencimento || '').slice(0, 10)
    if (!vencimento) return !de && !ate
    if (de && vencimento < de) return false
    if (ate && vencimento > ate) return false
    return true
  }), [naAgenda, de, ate])

  const linhas = useMemo(() => {
    const filtradas = noPeriodo.filter((e) => {
      const texto = `${e.descricao} ${e.fornecedor ?? ''} ${e.origem} ${e.plano ?? ''}`.toLowerCase()
      if (busca && !texto.includes(busca.toLowerCase())) return false
      if (filtro === 'DDA') return e.fonte === 'dda'
      if (filtro === 'Boletos') return e.forma_pagamento === 'boleto'
      if (filtro === 'Para autorizar') return e.status === 'pronta'
      if (filtro === 'Vencidas') return aberta(e) && !!e.vencimento && e.vencimento < hoje
      if (filtro === 'NF confirmada') return e.nf_confirmada
      return true
    })
    return ordenarLancamentosPorEmpresa(filtradas, empresas)
  }, [noPeriodo, busca, filtro, empresas])

  useEffect(() => { setPagina(0) }, [busca, de, ate, loja, filtro])

  const visiveis = linhas.slice(pagina * porPagina, pagina * porPagina + porPagina)

  const soma = (pred: (e: Despesa) => boolean) => noPeriodo.filter(pred).reduce((a, e) => a + Number(e.valor), 0)
  const lojas = useMemo(() => ordenarEmpresas(empresas), [empresas])
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
        <Button type="button" size="small" variant="outlined" onClick={() => navigate('/financeiro/inbox')} sx={finBtnOutlinedSx}>{t('Inbox', 'Inbox')}</Button>
        <Button type="button" size="small" variant="outlined" onClick={() => navigate('/financeiro/integracoes')} sx={finBtnOutlinedSx}>{t('Coletar DDA', 'Pull DDA')}</Button>
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
        <Button type="button" size="small" variant="contained" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => setAberto(true)} sx={finBtnContainedSx}>{t('Nova despesa', 'New expense')}</Button>
      </Stack>

      <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
        <Resumo cor="#F59E0B" rotulo={t('A pagar', 'To pay')} valor={brl(soma(aberta))} detalhe={t(`${noPeriodo.filter(aberta).length} em aberto`, `${noPeriodo.filter(aberta).length} open`)} />
        <Resumo cor="#10B981" rotulo={t('Pago', 'Paid')} valor={brl(soma((e) => e.status === 'paga' || e.status === 'conciliada'))} detalhe={t('já baixadas', 'already settled')} />
        <Resumo cor="#1B6EF3" rotulo={t('Para autorizar', 'To authorize')} valor={brl(soma((e) => e.status === 'pronta'))} detalhe={t('aguardando o Felipe', 'waiting for Felipe')} />
        <Resumo cor="#EF4444" rotulo={t('Vencida', 'Overdue')} valor={brl(vencida)} detalhe={t('sem pagar', 'unpaid')} alerta={vencida > 0} />
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
        {FILTROS.map((item) => (
          <Chip
            key={item}
            size="small"
            label={t(
              item === 'Todas' ? 'Todas' : item === 'DDA' ? 'DDA' : item === 'Boletos' ? 'Boletos' : item === 'Para autorizar' ? 'Para autorizar' : item === 'Vencidas' ? 'Vencidas' : 'NF confirmada',
              item === 'Todas' ? 'All' : item === 'DDA' ? 'DDA' : item === 'Boletos' ? 'Boletos' : item === 'Para autorizar' ? 'To authorize' : item === 'Vencidas' ? 'Overdue' : 'Invoice confirmed',
            )}
            variant="outlined"
            onClick={() => { setFiltro(item); setPagina(0) }}
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
                      ...(indice === 3 ? { width: 88 } : null),
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
                          'Clique em “Nova despesa” ou “Importar” para lançar na agenda. Os boletos do Inbox entram depois da NF conferida.',
                          'Click “New expense” or “Import” to add to the agenda. Inbox boletos appear after the invoice is checked.',
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
                <TableCell align="center" sx={{ verticalAlign: 'middle', width: 88, px: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24 }}>
                    {e.nf_confirmada
                      ? <Chip size="small" icon={<CheckIcon />} label={t('NF confirmada', 'Invoice confirmed')} sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#047857', fontWeight: 600, '& .MuiChip-icon': { color: '#047857' } }} />
                      : (
                        <Tooltip title={t('NF pendente', 'Invoice pending')}>
                          <AttachFileOutlinedIcon aria-label="NF pendente" sx={{ fontSize: 18, color: FIN_MUTED, display: 'block', opacity: 0.5 }} />
                        </Tooltip>
                      )}
                  </Box>
                </TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle' }}>
                  {e.fonte === 'dda' || e.fonte === 'nfe' ? (
                    <Chip
                      size="small"
                      label={e.fonte === 'nfe' ? 'NF' : 'DDA'}
                      sx={{
                        height: 20,
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        bgcolor: e.fonte === 'nfe' ? 'rgba(16,185,129,0.18)' : 'rgba(27,110,243,0.22)',
                        color: e.fonte === 'nfe' ? '#047857' : '#1D4ED8',
                        border: '1px solid',
                        borderColor: e.fonte === 'nfe' ? 'rgba(110,231,183,0.35)' : 'rgba(147,197,253,0.35)',
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
                <TableCell align="center" sx={{ verticalAlign: 'middle', fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{brl(Number(e.valor))}</TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle', width: 72, px: 0.5 }}>
                  <Stack direction="row" spacing={0.25} sx={{ justifyContent: 'center' }}>
                    <Tooltip title={t('Abrir', 'Open')}>
                      <IconButton
                        size="small"
                        onClick={() => setEditando(e)}
                        aria-label={t('Abrir', 'Open')}
                        sx={{ p: 0.35, color: FIN_MUTED, '&:hover': { color: '#1B6EF3', bgcolor: 'rgba(27,110,243,0.08)' } }}
                      >
                        <OpenInNewIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
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

      <DespesaForm
        aberto={aberto || !!editando}
        inicial={editando}
        empresas={empresas}
        onFechar={() => { setAberto(false); setEditando(null) }}
        onSalvou={(mensagem) => { setAberto(false); setEditando(null); carregar(); setAviso(mensagem) }}
      />
      <ImportarArquivosDialog
        aberto={importarAberto}
        onFechar={() => setImportarAberto(false)}
        onImportou={(mensagem) => {
          carregar()
          setAviso(mensagem)
        }}
      />
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
        'Tipo inválido. Use PDF (GFD, DARF/PGFN, TRCT, férias), DDA (xlsx, csv, ret, txt) ou XML de NF-e.',
        'Invalid type. Use PDF (GFD, DARF/PGFN, TRCT, vacation), DDA (xlsx, csv, ret, txt) or NF-e XML.',
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
                  'PDF (GFD, DARF, TRCT, férias), DDA ou XML de NF-e. A prévia abre na hora.',
                  'PDF (GFD, DARF, TRCT, vacation), DDA or NF-e XML. Preview opens right away.',
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
  if (forma === 'folha' || texto.toLowerCase() === 'folha') {
    return <Typography sx={{ fontSize: 13, textAlign: 'center' }}>—</Typography>
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
        minWidth: 120,
        flex: 1,
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

function DespesaForm({ aberto, inicial, empresas, onFechar, onSalvou }: {
  aberto: boolean
  inicial: Despesa | null
  empresas: Empresa[]
  onFechar: () => void
  onSalvou: (mensagem: string) => void
}) {
  const { t } = usePrefs()
  const lojas = empresas.filter((e) => e.tipo === 'loja')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [documento, setDocumento] = useState('')
  const [origem, setOrigem] = useState('')
  const [conta, setConta] = useState('')
  const [planoId, setPlanoId] = useState('')
  const [forma, setForma] = useState('boleto')
  const [fornecedor, setFornecedor] = useState<Fornecedor | null>(null)
  const [buscaFor, setBuscaFor] = useState('')
  const [hits, setHits] = useState<Fornecedor[]>([])
  const [pagamento, setPagamento] = useState('')
  const [erroCampos, setErroCampos] = useState({ descricao: false, valor: false, origem: false })
  const [abrindoNota, setAbrindoNota] = useState(false)
  const [abrindoBoleto, setAbrindoBoleto] = useState(false)

  const pedeCodigo = forma === 'boleto' || forma === 'chave_pix'

  useEffect(() => {
    if (!aberto) return
    setErroCampos({ descricao: false, valor: false, origem: false })
    setHits([])
    if (!inicial) {
      setDescricao(''); setValor(''); setVencimento(''); setDocumento('')
      setOrigem(empresas.find((e) => e.tipo === 'loja')?.id || '')
      setConta(''); setPlanoId(''); setForma('boleto')
      setFornecedor(null); setBuscaFor(''); setPagamento('')
      return
    }
    setDescricao(inicial.descricao)
    setValor(brl(Number(inicial.valor)))
    setVencimento(inicial.vencimento || '')
    setDocumento(inicial.documento_ref || '')
    setOrigem(inicial.origem_id)
    setConta(inicial.conta_saida_id || '')
    setPlanoId(inicial.plano_conta_id || '')
    setForma(inicial.forma_pagamento || 'boleto')
    setFornecedor(inicial.fornecedor_id ? { id: inicial.fornecedor_id, nome: inicial.fornecedor || '', plano_conta_id: inicial.plano_conta_id, plano: inicial.plano } : null)
    setBuscaFor(inicial.fornecedor || '')
    setPagamento(inicial.pagamento || '')
  }, [aberto, inicial, empresas])

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
    const numero = parseMoeda(valor)
    const faltaDesc = !descricao.trim()
    const faltaValor = !Number.isFinite(numero) || numero <= 0
    const faltaOrigem = !origem
    if (faltaDesc || faltaValor || faltaOrigem) {
      setErroCampos({ descricao: faltaDesc, valor: faltaValor, origem: faltaOrigem })
      showToast(
        t('Descrição, origem e valor são obrigatórios.', 'Description, store and amount are required.'),
        'error',
      )
      return
    }
    setErroCampos({ descricao: false, valor: false, origem: false })
    try {
      const corpo = {
        descricao: descricao.trim(),
        valor: numero,
        vencimento: vencimento || null,
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
      onSalvou(inicial ? t('Despesa atualizada.', 'Expense updated.') : t('Despesa cadastrada.', 'Expense created.'))
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
    }
  }

  return (
    <Drawer anchor="right" open={aberto} onClose={onFechar} slotProps={{ paper: { sx: drawerEscuroPaper } }}>
      <Stack spacing={1.5} sx={{ p: 3, overflow: 'auto', bgcolor: FIN_SURFACE_ALT, color: FIN_TEXT, minHeight: '100%' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
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
          <Typography variant="h6" sx={{ color: FIN_TEXT, fontWeight: 650, letterSpacing: '-0.02em' }}>
            {inicial ? t('Editar despesa', 'Edit expense') : t('Nova despesa', 'New expense')}
          </Typography>
        </Stack>
        <TextField
          label={t('Descrição', 'Description')}
          size="small"
          value={descricao}
          error={erroCampos.descricao}
          onChange={(ev) => {
            setDescricao(ev.target.value)
            if (erroCampos.descricao) setErroCampos((e) => ({ ...e, descricao: false }))
          }}
          sx={[finCampoSx, erroCampos.descricao ? finCampoErroSx : null]}
        />
        <TextField
          label={t('Valor', 'Amount')}
          size="small"
          value={valor}
          placeholder="R$ 0,00"
          error={erroCampos.valor}
          onChange={(ev) => {
            setValor(aoDigitarValor(ev.target.value))
            if (erroCampos.valor) setErroCampos((e) => ({ ...e, valor: false }))
          }}
          onBlur={() => setValor((atual) => atual && Number.isFinite(parseMoeda(atual)) ? brl(parseMoeda(atual)) : '')}
          sx={[finCampoSx, erroCampos.valor ? finCampoErroSx : null]}
        />
        <CampoDataFinanceiro
          label={t('Vencimento', 'Due date')}
          value={vencimento}
          onChange={setVencimento}
        />
        <TextField
          label={t('Documento', 'Document')}
          size="small"
          value={documento}
          onChange={(ev) => setDocumento(ev.target.value)}
          sx={finCampoSx}
        />
        <Autocomplete
          size="small"
          options={lojas}
          getOptionLabel={(e) => e.apelido}
          value={lojas.find((e) => e.id === origem) || null}
          onChange={(_, item) => {
            setOrigem(item?.id || '')
            if (erroCampos.origem) setErroCampos((e) => ({ ...e, origem: false }))
          }}
          slotProps={lista}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('Loja', 'Store')}
              error={erroCampos.origem}
              sx={[finCampoSx, erroCampos.origem ? finCampoErroSx : null]}
            />
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
          openOnFocus
          onOpen={() => { void carregarFornecedores() }}
          onInputChange={(_, texto, motivo) => { if (motivo === 'input') void buscar(texto) }}
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
            onChange={(ev) => setPagamento(ev.target.value)}
            placeholder={t('Para copiar na hora de pagar', 'Copy this when paying')}
            sx={finCampoSx}
          />
        )}
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DescriptionOutlinedIcon sx={{ fontSize: 16 }} />}
            disabled={!inicial?.numero_nf || abrindoNota}
            onClick={async () => {
              if (!inicial) return
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
              color: inicial?.numero_nf ? FIN_TEXT : FIN_MUTED,
              borderColor: inicial?.numero_nf ? 'rgba(27,110,243,0.45)' : FIN_BORDER,
              bgcolor: FIN_SURFACE,
            }}
          >
            {abrindoNota ? t('Abrindo nota…', 'Opening invoice…') : t('Ver nota fiscal', 'View invoice')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PictureAsPdfOutlinedIcon sx={{ fontSize: 16 }} />}
            disabled={!inicial?.numero_nf || abrindoBoleto}
            onClick={async () => {
              if (!inicial) return
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
              color: inicial?.numero_nf ? FIN_TEXT : FIN_MUTED,
              borderColor: inicial?.numero_nf ? 'rgba(27,110,243,0.45)' : FIN_BORDER,
              bgcolor: FIN_SURFACE,
            }}
          >
            {abrindoBoleto ? t('Abrindo boleto…', 'Opening boleto…') : t('Ver boleto', 'View boleto')}
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', pt: 1 }}>
          <Button onClick={onFechar} sx={{ color: FIN_MUTED }}>{t('Cancelar', 'Cancel')}</Button>
          <Button variant="contained" onClick={salvar} sx={finBtnContainedSx}>
            {inicial ? t('Salvar', 'Save') : t('Criar rascunho', 'Create draft')}
          </Button>
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
