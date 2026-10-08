import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
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
import Typography from '@mui/material/Typography'
import { api, brl, type Despesa, type Empresa } from '../api'
import { ordenarEmpresas } from '../ordemEmpresas'
import { usePrefs } from '../prefs'

const INBOX_STATUS = new Set(['rascunho', 'classificada', 'bloqueada_duplicata'])
const FILTROS = ['Todas', 'Vencidas', 'NF confirmada', 'Aguardando NF'] as const
const hoje = new Date().toISOString().slice(0, 10)

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

function dataBr(iso: string | null) {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

function rotuloDescricao(e: Despesa) {
  return (e.fornecedor || e.descricao || '').trim() || 'Sem descrição'
}

/** Inbox: DDA (e, em breve, NF) antes de entrar na Agenda banco. */
export function InboxDdaPage() {
  const { t, modo } = usePrefs()
  const navigate = useNavigate()
  const escuro = modo === 'escuro'
  const [aba, setAba] = useState(0)
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loja, setLoja] = useState('')
  const [busca, setBusca] = useState('')
  const [de, setDe] = useState(() => periodoAtual().de)
  const [ate, setAte] = useState(() => periodoAtual().ate)
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('Todas')
  const [erro, setErro] = useState('')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(30)

  const carregar = (empresa = loja) =>
    api.despesas(empresa || undefined).then((rows) => {
      setDespesas(rows)
      setErro('')
    }).catch(() => {
      setDespesas([])
      setErro(t(
        'Não carregou o financeiro. Confira a permissão financeiro.ver.',
        'Could not load finance. Check the financeiro.ver permission.',
      ))
    })

  useEffect(() => {
    api.empresas().then(setEmpresas).catch(() => setEmpresas([]))
    carregar('')
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

  const linhas = useMemo(() => noPeriodo.filter((e) => {
    const texto = `${e.descricao} ${e.fornecedor ?? ''} ${e.origem} ${e.numero_nf ?? ''}`.toLowerCase()
    if (busca && !texto.includes(busca.toLowerCase())) return false
    if (filtro === 'Vencidas') return !!e.vencimento && e.vencimento < hoje
    if (filtro === 'NF confirmada') return e.nf_confirmada
    if (filtro === 'Aguardando NF') return !e.nf_confirmada
    return true
  }), [noPeriodo, busca, filtro])

  useEffect(() => { setPagina(0) }, [busca, de, ate, loja, filtro])

  const comNf = noPeriodo.filter((e) => e.nf_confirmada)
  const semNf = noPeriodo.filter((e) => !e.nf_confirmada)
  const vencidas = noPeriodo.filter((e) => e.vencimento && e.vencimento < hoje)
  const lojas = useMemo(() => ordenarEmpresas(empresas), [empresas])

  const visiveis = linhas.slice(pagina * porPagina, pagina * porPagina + porPagina)
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

  const abrirAgenda = () => {
    const q = new URLSearchParams()
    if (de) q.set('de', de)
    if (ate) q.set('ate', ate)
    if (loja) q.set('loja', loja)
    navigate(`/financeiro?${q.toString()}`)
  }

  const enviar = async (ids = [...marcadas]) => {
    if (!ids.length) return
    setEnviando(true)
    setErro('')
    try {
      const r = await api.entrarNaAgenda(ids)
      const ok = r.enviados.length
      const bloqueio = r.bloqueados.length
      if (bloqueio && !ok) {
        setErro(r.bloqueados[0]?.motivo || t('Nenhum título enviado.', 'Nothing sent.'))
        return
      }
      setMarcadas(new Set())
      abrirAgenda()
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não enviou', 'Could not send'))
    } finally {
      setEnviando(false)
    }
  }

  const chipNf = (ok: boolean) => (
    <Chip
      size="small"
      label={ok ? t('NF conferida', 'Invoice checked') : t('Aguardando NF', 'Awaiting invoice')}
      sx={{
        height: 20,
        fontSize: 11,
        fontWeight: 600,
        bgcolor: ok
          ? (escuro ? 'rgba(52,211,153,0.14)' : 'rgba(16,185,129,0.12)')
          : (escuro ? 'rgba(251,191,36,0.12)' : 'rgba(245,158,11,0.12)'),
        color: ok ? (escuro ? '#6EE7B7' : '#047857') : (escuro ? '#FCD34D' : '#B45309'),
      }}
    />
  )

  return (
    <Stack spacing={1.25} sx={{ height: '100%', minHeight: 0 }}>
      {erro && <Alert severity="warning" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: 12 } }}>{erro}</Alert>}

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
        <Button size="small" variant="outlined" onClick={() => navigate('/financeiro/integracoes')}>
          {t('Coletar DDA', 'Pull DDA')}
        </Button>
        <Button size="small" variant="outlined" onClick={abrirAgenda}>
          {t('Abrir Agenda banco', 'Open bank schedule')}
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={enviando || !marcadas.size}
          onClick={() => enviar()}
        >
          {enviando ? t('Enviando…', 'Sending…') : t(`Enviar para agenda (${marcadas.size})`, `Send to schedule (${marcadas.size})`)}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Resumo rotulo={t('No inbox', 'In inbox')} valor={String(noPeriodo.length)} detalhe={t('boletos DDA', 'DDA boletos')} />
        <Resumo rotulo={t('NF conferida', 'Invoice checked')} valor={String(comNf.length)} detalhe={t('prontos para agenda', 'ready for schedule')} />
        <Resumo rotulo={t('Aguardando NF', 'Awaiting invoice')} valor={String(semNf.length)} detalhe={t('gestor no app', 'manager in the app')} />
        <Resumo rotulo={t('Vencidas', 'Overdue')} valor={String(vencidas.length)} detalhe={t('no inbox', 'in inbox')} alerta={vencidas.length > 0} />
      </Stack>

      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
        {FILTROS.map((item) => (
          <Chip
            key={item}
            size="small"
            label={t(
              item === 'Todas' ? 'Todas' : item === 'Vencidas' ? 'Vencidas' : item === 'NF confirmada' ? 'NF confirmada' : 'Aguardando NF',
              item === 'Todas' ? 'All' : item === 'Vencidas' ? 'Overdue' : item === 'NF confirmada' ? 'Invoice confirmed' : 'Awaiting invoice',
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

      <Tabs
        value={aba}
        onChange={(_, v) => { setAba(v); setPagina(0) }}
        sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0, fontSize: 12, textTransform: 'none' } }}
      >
        <Tab label={t(`DDA (${linhas.length})`, `DDA (${linhas.length})`)} />
        <Tab
          label={t('Notas fiscais (em breve)', 'Invoices (soon)')}
          disabled
        />
      </Tabs>

      {aba === 0 && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={todasMarcadas} indeterminate={!!marcadas.size && !todasMarcadas} onChange={toggleTodas} />
                  </TableCell>
                  <TableCell>{t('NF', 'Invoice')}</TableCell>
                  <TableCell>{t('Fornecedor', 'Supplier')}</TableCell>
                  <TableCell>{t('Origem', 'Source')}</TableCell>
                  <TableCell>{t('Vencimento', 'Due date')}</TableCell>
                  <TableCell align="right">{t('Valor', 'Amount')}</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {!linhas.length && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ color: 'text.secondary', py: 4 }}>
                      {inbox.length
                        ? t('Nenhuma despesa nesse filtro.', 'No expenses in this filter.')
                        : t('Inbox limpo. Novos DDA da coleta aparecem aqui.', 'Inbox clear. New DDA from the pull show up here.')}
                    </TableCell>
                  </TableRow>
                )}
                {visiveis.map((e) => {
                  const vencida = !!e.vencimento && e.vencimento < hoje
                  const chave = e.id || `${e.documento_ref || ''}|${e.vencimento || ''}|${e.valor}`
                  return (
                    <TableRow key={chave} hover selected={!!e.id && marcadas.has(e.id)}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          disabled={!e.id}
                          checked={!!e.id && marcadas.has(e.id)}
                          onChange={() => { if (e.id) toggle(e.id) }}
                        />
                      </TableCell>
                      <TableCell>{chipNf(e.nf_confirmada)}</TableCell>
                      <TableCell>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25 }}>{rotuloDescricao(e)}</Typography>
                        {e.numero_nf && (
                          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>NF {e.numero_nf}</Typography>
                        )}
                      </TableCell>
                      <TableCell>{e.origem}</TableCell>
                      <TableCell sx={{ color: vencida ? 'error.main' : 'inherit' }}>{dataBr(e.vencimento)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{brl(Number(e.valor))}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          disabled={enviando}
                          onClick={() => enviar([e.id])}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'transparent' } }}
                        >
                          {t('Agenda', 'Schedule')}
                        </Button>
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
            sx={{
              flexShrink: 0,
              borderTop: '1px solid',
              borderColor: 'divider',
              '& .MuiTablePagination-toolbar': { minHeight: 32, height: 32, pl: 1.5, pr: 0.5 },
              '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: 12, m: 0 },
            }}
          />
        </Paper>
      )}

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
        ...(alerta ? { borderColor: '#EF4444', bgcolor: 'rgba(239,68,68,0.06)' } : {}),
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: alerta ? 'error.main' : 'text.secondary' }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15, color: alerta ? 'error.main' : 'inherit' }}>{valor}</Typography>
      <Typography sx={{ fontSize: 11, color: alerta ? 'error.main' : 'text.secondary' }}>{detalhe}</Typography>
    </Paper>
  )
}
