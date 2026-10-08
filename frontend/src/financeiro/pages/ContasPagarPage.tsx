import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
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
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { api, brl, type Despesa, type Empresa, type Fornecedor } from '../api'
import { usePrefs } from '../prefs'

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

const TOM_ESCURO: Record<string, { color: string; border: string; bg: string }> = {
  rascunho: { color: '#94A3B8', border: '#1C3040', bg: 'transparent' },
  classificada: { color: '#93C5FD', border: 'rgba(27,110,243,0.45)', bg: 'rgba(27,110,243,0.16)' },
  pronta: { color: '#93C5FD', border: 'rgba(96,165,250,0.5)', bg: 'rgba(96,165,250,0.14)' },
  autorizada: { color: '#93C5FD', border: 'rgba(96,165,250,0.5)', bg: 'rgba(96,165,250,0.14)' },
  enviada: { color: '#93C5FD', border: 'rgba(96,165,250,0.5)', bg: 'rgba(96,165,250,0.14)' },
  paga: { color: '#6EE7B7', border: 'rgba(52,211,153,0.45)', bg: 'rgba(52,211,153,0.14)' },
  conciliada: { color: '#6EE7B7', border: 'rgba(52,211,153,0.45)', bg: 'rgba(52,211,153,0.14)' },
  bloqueada_duplicata: { color: '#FCA5A5', border: 'rgba(248,113,113,0.5)', bg: 'rgba(248,113,113,0.12)' },
  a_pagar: { color: '#FCD34D', border: 'rgba(251,191,36,0.5)', bg: 'rgba(251,191,36,0.12)' },
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

/** Uma linha só: fornecedor; se a descrição for outro assunto, usa ela. */
function rotuloDescricao(e: Despesa) {
  const desc = (e.descricao || '').trim()
  const forn = (e.fornecedor || '').trim()
  return forn || desc || ''
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

export function ContasPagarPage() {
  const navigate = useNavigate()
  const { t, modo, idioma } = usePrefs()
  const escuro = modo === 'escuro'
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loja, setLoja] = useState('')
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState(() => periodoAtual().de)
  const [ate, setAte] = useState(() => periodoAtual().ate)
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

  const carregar = (empresa = loja) => api.despesas(empresa || undefined).then((rows) => {
    setDespesas(rows)
    setErroBanco('')
  }).catch(() => {
    setDespesas([])
    setErroBanco(t(
      'Não carregou o financeiro (vision_check.finance). Confira se a API Finance está no ar (porta 5080) e se você tem a permissão financeiro.ver.',
      'Could not load finance (vision_check.finance). Check that the Finance API is up (port 5080) and that you have financeiro.ver.',
    ))
  })

  useEffect(() => {
    api.empresas().then((rows) => {
      setEmpresas(rows)
      if (rows.length) setErroBanco('')
    }).catch(() => {
      setEmpresas([])
      setErroBanco(t(
        'Não carregou o financeiro (vision_check.finance). Confira se a API Finance está no ar (porta 5080) e se você tem a permissão financeiro.ver.',
        'Could not load finance (vision_check.finance). Check that the Finance API is up (port 5080) and that you have financeiro.ver.',
      ))
    })
    carregar('')
  }, [])

  /** Agenda banco: DDA só depois de confirmado (status pronta+). Manual entra direto. */
  const naAgenda = useMemo(() => despesas.filter((e) => {
    if (e.fonte === 'dda') return ['pronta', 'autorizada', 'enviada', 'paga', 'conciliada'].includes(e.status)
    return true
  }), [despesas])

  const noPeriodo = useMemo(() => naAgenda.filter((e) => {
    const semana = e.competencia || e.vencimento
    if (!semana) return !de && !ate
    if (de && semana < de) return false
    if (ate && semana > ate) return false
    return true
  }), [naAgenda, de, ate])

  const linhas = useMemo(() => noPeriodo.filter((e) => {
    const texto = `${e.descricao} ${e.fornecedor ?? ''} ${e.origem} ${e.plano ?? ''}`.toLowerCase()
    if (busca && !texto.includes(busca.toLowerCase())) return false
    if (filtro === 'DDA') return e.fonte === 'dda'
    if (filtro === 'Boletos') return e.forma_pagamento === 'boleto'
    if (filtro === 'Para autorizar') return e.status === 'pronta'
    if (filtro === 'Vencidas') return aberta(e) && !!e.vencimento && e.vencimento < hoje
    if (filtro === 'NF confirmada') return e.nf_confirmada
    return true
  }), [noPeriodo, busca, filtro])

  useEffect(() => { setPagina(0) }, [busca, de, ate, loja, filtro])

  const visiveis = linhas.slice(pagina * porPagina, pagina * porPagina + porPagina)

  const soma = (pred: (e: Despesa) => boolean) => noPeriodo.filter(pred).reduce((a, e) => a + Number(e.valor), 0)
  const lojas = empresas.filter((e) => e.tipo === 'loja')
  const vencida = soma((e) => aberta(e) && !!e.vencimento && e.vencimento < hoje)

  return (
    <Stack spacing={1.25} sx={{ height: '100%', minHeight: 0 }}>
      {erroBanco && <Alert severity="warning" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: 12 } }}>{erroBanco}</Alert>}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' } }}>
        <TextField size="small" placeholder={t('Buscar lançamento', 'Search entry')} value={busca} onChange={(ev) => setBusca(ev.target.value)} sx={{ minWidth: 240, bgcolor: 'background.paper' }} />
        <TextField size="small" label={t('De', 'From')} type="date" value={de} onChange={(ev) => setDe(ev.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 138, bgcolor: 'background.paper' }} />
        <TextField size="small" label={t('Até', 'To')} type="date" value={ate} onChange={(ev) => setAte(ev.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 138, bgcolor: 'background.paper' }} />
        <TextField
          select
          size="small"
          label={t('Loja', 'Store')}
          value={loja}
          onChange={(ev) => { setLoja(ev.target.value); carregar(ev.target.value) }}
          sx={{ minWidth: 180, bgcolor: 'background.paper', '& .MuiOutlinedInput-notchedOutline': { borderColor: loja ? 'primary.main' : undefined } }}
        >
          <MenuItem value="">{t('Todas as lojas', 'All stores')}</MenuItem>
          {lojas.map((e) => <MenuItem key={e.id} value={e.id}>{e.apelido}</MenuItem>)}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" onClick={() => navigate('/financeiro/inbox')}>{t('Inbox DDA', 'DDA inbox')}</Button>
        <Button size="small" variant="outlined" onClick={() => navigate('/financeiro/integracoes')}>{t('Coletar DDA', 'Pull DDA')}</Button>
        <Button size="small" variant="contained" startIcon={<AddIcon sx={{ fontSize: 16 }} />} onClick={() => setAberto(true)}>{t('Nova despesa', 'New expense')}</Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Resumo rotulo={t('A pagar', 'To pay')} valor={brl(soma(aberta))} detalhe={t(`${noPeriodo.filter(aberta).length} em aberto`, `${noPeriodo.filter(aberta).length} open`)} />
        <Resumo rotulo={t('Pago', 'Paid')} valor={brl(soma((e) => e.status === 'paga' || e.status === 'conciliada'))} detalhe={t('já baixadas', 'already settled')} />
        <Resumo rotulo={t('Para autorizar', 'To authorize')} valor={brl(soma((e) => e.status === 'pronta'))} detalhe={t('aguardando o Felipe', 'waiting for Felipe')} />
        <Resumo rotulo={t('Vencida', 'Overdue')} valor={brl(vencida)} detalhe={t('sem pagar', 'unpaid')} alerta={vencida > 0} />
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
            sx={{
              height: 24,
              fontSize: 11,
              bgcolor: filtro === item ? (escuro ? 'rgba(27, 110, 243, 0.2)' : 'rgba(27, 110, 243, 0.1)') : 'background.paper',
              borderColor: filtro === item ? 'primary.main' : 'divider',
              color: filtro === item ? (escuro ? '#93C5FD' : '#0D4ECC') : 'text.secondary',
              fontWeight: filtro === item ? 600 : 500,
            }}
          />
        ))}
      </Stack>

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {[
                t('Status', 'Status'), t('Descrição', 'Description'), t('Origem', 'Source'), t('Nota fiscal', 'Invoice'),
                t('Forma de pagamento', 'Payment method'), t('Código', 'Code'), t('Vencimento', 'Due date'), t('Valor', 'Amount'), '',
              ].map((h, indice) => (
                <TableCell key={h || 'acao'} align={indice === 7 ? 'right' : indice === 3 ? 'center' : 'left'} sx={indice === 3 ? { width: 88 } : undefined}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow><TableCell colSpan={9} sx={{ color: 'text.secondary', py: 4 }}>{t('Nenhuma despesa nesse filtro.', 'No expenses in this filter.')}</TableCell></TableRow>
            )}
            {visiveis.map((e) => {
              const tomChave = situacao(e)
              const tom = (escuro ? TOM_ESCURO : TOM_CLARO)[tomChave] || (escuro ? TOM_ESCURO : TOM_CLARO).a_pagar
              const rotulo = ROTULO[tomChave] || ROTULO.a_pagar
              return (
              <TableRow key={e.id} hover>
                <TableCell>
                  <Chip size="small" label={idioma === 'en' ? rotulo[1] : rotulo[0]} variant="outlined" sx={{ height: 20, fontSize: 11, fontWeight: 500, color: tom.color, borderColor: tom.border, bgcolor: tom.bg }} />
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25 }}>
                    {rotuloDescricao(e) || t('Sem descrição', 'No description')}
                  </Typography>
                </TableCell>
                <TableCell>{e.origem}</TableCell>
                <TableCell align="center" sx={{ verticalAlign: 'middle', width: 88, px: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 24 }}>
                    {e.nf_confirmada
                      ? <Chip size="small" icon={<CheckIcon />} label={t('NF confirmada', 'Invoice confirmed')} sx={{ bgcolor: escuro ? 'rgba(52,211,153,0.14)' : 'rgba(16,185,129,0.12)', color: escuro ? '#6EE7B7' : '#047857', fontWeight: 600, '& .MuiChip-icon': { color: escuro ? '#6EE7B7' : '#047857' } }} />
                      : (
                        <Tooltip title={t('NF pendente', 'Invoice pending')}>
                          <AttachFileOutlinedIcon aria-label="NF pendente" sx={{ fontSize: 18, color: 'text.disabled', display: 'block' }} />
                        </Tooltip>
                      )}
                  </Box>
                </TableCell>
                <TableCell>
                  {e.fonte === 'dda' ? (
                    <Chip
                      size="small"
                      label="DDA"
                      sx={{
                        height: 20,
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        bgcolor: escuro ? 'rgba(27,110,243,0.22)' : 'rgba(27,110,243,0.12)',
                        color: escuro ? '#93C5FD' : '#0D4ECC',
                        border: '1px solid',
                        borderColor: escuro ? 'rgba(147,197,253,0.35)' : 'rgba(13,78,204,0.28)',
                      }}
                    />
                  ) : (
                    CODIGO[e.forma_pagamento || ''] || '—'
                  )}
                </TableCell>
                <TableCell><Codigo forma={e.forma_pagamento} pagamento={e.pagamento} /></TableCell>
                <TableCell sx={{ color: aberta(e) && e.vencimento && e.vencimento < hoje ? 'error.main' : 'inherit' }}>
                  {e.vencimento ? e.vencimento.split('-').reverse().join('/') : '—'}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{brl(Number(e.valor))}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setEditando(e)} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'transparent' } }}>{t('Abrir', 'Open')}</Button>
                  <Button size="small" onClick={() => { setErroExcluir(''); setExcluir(e) }} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: 'transparent' } }}>{t('Excluir', 'Delete')}</Button>
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
          sx={{
            flexShrink: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '& .MuiTablePagination-toolbar': { minHeight: 32, height: 32, pl: 1.5, pr: 0.5 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: 12, m: 0 },
            '& .MuiTablePagination-select': { fontSize: 12 },
            '& .MuiTablePagination-actions': { ml: 0.5 },
            '& .MuiTablePagination-actions .MuiIconButton-root': { p: 0.25 },
          }}
        />
      </Paper>

      <Dialog open={!!excluir} onClose={() => { if (!excluindo) setExcluir(null) }}>
        <DialogTitle>{t('Deseja excluir?', 'Delete this expense?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">{excluir?.descricao}</Typography>
          {erroExcluir && <Typography color="error" variant="body2" sx={{ mt: 1 }}>{erroExcluir}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExcluir(null)} disabled={excluindo}>{t('Cancelar', 'Cancel')}</Button>
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
      <Snackbar open={!!aviso} autoHideDuration={3200} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
    </Stack>
  )
}

function Codigo({ forma, pagamento }: { forma: string | null; pagamento: string | null }) {
  const texto = (pagamento || '').trim()
  if (forma === 'folha' || texto.toLowerCase() === 'folha') return <Typography sx={{ fontSize: 13 }}>—</Typography>
  if ((forma === 'chave_pix' || forma === 'boleto') && texto) return <Copia texto={texto} />
  return <Typography sx={{ fontSize: 13 }}>—</Typography>
}

function Copia({ texto }: { texto: string }) {
  const curto = texto.length > 22 ? `${texto.slice(0, 22)}…` : texto
  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>{curto}</Typography>
      <IconButton size="small" aria-label="Copiar para pagar" onClick={() => navigator.clipboard.writeText(texto)}>
        <ContentCopyIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Stack>
  )
}

function Resumo({ rotulo, valor, detalhe, alerta = false }: { rotulo: string; valor: string; detalhe: string; alerta?: boolean }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.25,
        py: 0.7,
        minWidth: 120,
        flex: 1,
        ...(alerta ? {
          borderColor: '#EF4444',
          bgcolor: 'rgba(239,68,68,0.06)',
          animation: 'vencida-pulso 2.6s ease-in-out infinite',
          '@keyframes vencida-pulso': {
            '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
            '50%': { boxShadow: '0 0 0 3px rgba(239,68,68,0.18)' },
          },
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        } : {}),
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: alerta ? 'error.main' : 'text.secondary' }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: alerta ? 'error.main' : 'inherit' }}>{valor}</Typography>
      <Typography sx={{ fontSize: 11, fontWeight: 400, color: alerta ? 'error.main' : 'text.secondary' }}>{detalhe}</Typography>
    </Paper>
  )
}

const lista = { listbox: { sx: { maxHeight: 240, fontSize: 14 } } }

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
  const [erro, setErro] = useState('')
  const [abrindoNota, setAbrindoNota] = useState(false)
  const [abrindoBoleto, setAbrindoBoleto] = useState(false)

  const pedeCodigo = forma === 'boleto' || forma === 'chave_pix'

  useEffect(() => {
    if (!aberto) return
    setErro('')
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
    if (q.trim().length < 2) { setHits([]); return }
    setHits(await api.fornecedores(q.trim()))
  }

  const escolherFornecedor = (item: Fornecedor | null) => {
    setFornecedor(item)
    setBuscaFor(item?.nome || '')
    setPlanoId(item?.plano_conta_id || '')
    setHits([])
  }

  const salvar = async () => {
    try {
      setErro('')
      const numero = parseMoeda(valor)
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
      setErro(err instanceof Error ? err.message : 'Não salvou')
    }
  }

  return (
    <Drawer anchor="right" open={aberto} onClose={onFechar} slotProps={{ paper: { sx: { width: 420 } } }}>
      <Stack spacing={1.5} sx={{ p: 3, overflow: 'auto' }}>
        <Typography variant="h6">{inicial ? t('Editar despesa', 'Edit expense') : t('Nova despesa', 'New expense')}</Typography>
          <TextField label={t('Descrição', 'Description')} size="small" value={descricao} onChange={(ev) => setDescricao(ev.target.value)} />
          <TextField
            label={t('Valor', 'Amount')}
            size="small"
            value={valor}
            placeholder="R$ 0,00"
            onChange={(ev) => setValor(aoDigitarValor(ev.target.value))}
            onBlur={() => setValor((atual) => atual && Number.isFinite(parseMoeda(atual)) ? brl(parseMoeda(atual)) : '')}
          />
          <TextField label={t('Vencimento', 'Due date')} size="small" type="date" value={vencimento} onChange={(ev) => setVencimento(ev.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label={t('Documento', 'Document')} size="small" value={documento} onChange={(ev) => setDocumento(ev.target.value)} />
          <Autocomplete
            size="small"
            options={lojas}
            getOptionLabel={(e) => e.apelido}
            value={lojas.find((e) => e.id === origem) || null}
            onChange={(_, item) => setOrigem(item?.id || '')}
            slotProps={lista}
            renderInput={(params) => <TextField {...params} label={t('Loja', 'Store')} />}
          />
          <Autocomplete
            size="small"
            options={hits}
            getOptionLabel={(item) => item.nome}
            filterOptions={(opcoes) => opcoes}
            inputValue={buscaFor}
            value={fornecedor}
            onInputChange={(_, texto, motivo) => { if (motivo === 'input') buscar(texto) }}
            onChange={(_, item) => escolherFornecedor(item)}
            slotProps={lista}
            renderInput={(params) => <TextField {...params} label={t('Fornecedor', 'Supplier')} placeholder={t('Buscar', 'Search')} />}
            renderOption={(props, item) => (
              <li {...props} key={item.id}>{item.nome}{item.plano ? ` · ${item.plano}` : ''}</li>
            )}
          />
          {fornecedor?.plano && <Typography variant="body2" color="text.secondary">{t('Plano de contas', 'Account')}: {fornecedor.plano}</Typography>}
          <TextField select label={t('Forma de pagamento', 'Payment method')} size="small" value={forma} onChange={(ev) => setForma(ev.target.value)}>
            {Object.entries(CODIGO).map(([id, nome]) => <MenuItem key={id} value={id}>{nome}</MenuItem>)}
          </TextField>
          {pedeCodigo && (
            <TextField
              label={forma === 'boleto' ? t('Código de barras do boleto', 'Boleto barcode') : t('Chave PIX', 'PIX key')}
              size="small"
              value={pagamento}
              onChange={(ev) => setPagamento(ev.target.value)}
              placeholder={t('Para copiar na hora de pagar', 'Copy this when paying')}
            />
          )}
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              disabled={!inicial?.numero_nf || abrindoNota}
              onClick={async () => {
                if (!inicial) return
                setAbrindoNota(true)
                setErro('')
                try { await api.abrirNota(inicial.id) }
                catch (err) { setErro(err instanceof Error ? err.message : 'Não abriu a nota') }
                finally { setAbrindoNota(false) }
              }}
            >
              {abrindoNota ? t('Abrindo nota…', 'Opening invoice…') : t('Ver nota fiscal', 'View invoice')}
            </Button>
            <Button
              variant="outlined"
              disabled={!inicial?.numero_nf || abrindoBoleto}
              onClick={async () => {
                if (!inicial) return
                setAbrindoBoleto(true)
                setErro('')
                try { await api.abrirBoleto(inicial.id) }
                catch (err) { setErro(err instanceof Error ? err.message : 'Não abriu o boleto') }
                finally { setAbrindoBoleto(false) }
              }}
            >
              {abrindoBoleto ? t('Abrindo boleto…', 'Opening boleto…') : t('Ver boleto', 'View boleto')}
            </Button>
          </Stack>
          {erro && <Typography color="error" variant="body2">{erro}</Typography>}
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', pt: 1 }}>
          <Button onClick={onFechar}>{t('Cancelar', 'Cancel')}</Button>
          <Button variant="contained" onClick={salvar}>{inicial ? t('Salvar', 'Save') : t('Criar rascunho', 'Create draft')}</Button>
        </Stack>
      </Stack>
    </Drawer>
  )
}
