import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
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
import { api, brl, type Despesa } from '../api'
import { usePrefs } from '../prefs'

const INBOX_STATUS = new Set(['rascunho', 'classificada', 'bloqueada_duplicata'])
const hoje = new Date().toISOString().slice(0, 10)

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
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(30)

  const carregar = () =>
    api.despesas().then((rows) => {
      setDespesas(rows)
      setErro('')
    }).catch(() => {
      setDespesas([])
      setErro(t(
        'Não carregou o financeiro. Confira a API Finance (porta 5080).',
        'Could not load finance. Check the Finance API (port 5080).',
      ))
    })

  useEffect(() => { carregar() }, [])

  const inbox = useMemo(
    () => despesas.filter((e) => e.fonte === 'dda' && INBOX_STATUS.has(e.status)),
    [despesas],
  )

  const comNf = inbox.filter((e) => e.nf_confirmada)
  const semNf = inbox.filter((e) => !e.nf_confirmada)
  const vencidas = inbox.filter((e) => e.vencimento && e.vencimento < hoje)

  const visiveis = inbox.slice(pagina * porPagina, pagina * porPagina + porPagina)
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

  const enviar = async () => {
    const ids = [...marcadas]
    if (!ids.length) return
    setEnviando(true)
    setErro('')
    try {
      const r = await api.entrarNaAgenda(ids)
      const ok = r.enviados.length
      const bloqueio = r.bloqueados.length
      if (ok) setAviso(ok === 1 ? t('1 título na Agenda banco.', '1 title sent to bank schedule.') : t(`${ok} títulos na Agenda banco.`, `${ok} titles sent to bank schedule.`))
      if (bloqueio && !ok) setErro(r.bloqueados[0]?.motivo || t('Nenhum título enviado.', 'Nothing sent.'))
      else if (bloqueio) setAviso((m) => `${m} ${t(`${bloqueio} ficaram no inbox (NF pendente).`, `${bloqueio} stayed in inbox (invoice pending).`)}`)
      setMarcadas(new Set())
      await carregar()
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
        <Typography sx={{ fontSize: 13, color: 'text.secondary', flex: 1 }}>
          {t(
            'DDA entra aqui. Quando o gestor confere a NF no app, o título vai sozinho para a Agenda banco. Notas fiscais emitidas entram nesta aba em breve.',
            'DDA lands here. When the manager checks the invoice in the app, the title moves to the bank schedule by itself. Issued invoices will join this tab soon.',
          )}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => navigate('/financeiro/integracoes')}>
          {t('Coletar DDA', 'Pull DDA')}
        </Button>
        <Button size="small" variant="outlined" onClick={() => navigate('/financeiro')}>
          {t('Abrir Agenda banco', 'Open bank schedule')}
        </Button>
        <Tooltip title={marcadas.size && ![...marcadas].some((id) => inbox.find((e) => e.id === id)?.nf_confirmada) ? t('Marque títulos com NF conferida', 'Select titles with checked invoice') : ''}>
          <span>
            <Button
              size="small"
              variant="contained"
              disabled={enviando || !marcadas.size}
              onClick={enviar}
            >
              {enviando ? t('Enviando…', 'Sending…') : t(`Enviar para agenda (${marcadas.size})`, `Send to schedule (${marcadas.size})`)}
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Resumo rotulo={t('No inbox', 'In inbox')} valor={String(inbox.length)} detalhe={t('boletos DDA', 'DDA boletos')} />
        <Resumo rotulo={t('NF conferida', 'Invoice checked')} valor={String(comNf.length)} detalhe={t('prontos para agenda', 'ready for schedule')} />
        <Resumo rotulo={t('Aguardando NF', 'Awaiting invoice')} valor={String(semNf.length)} detalhe={t('gestor no app', 'manager in the app')} />
        <Resumo rotulo={t('Vencidas', 'Overdue')} valor={String(vencidas.length)} detalhe={t('no inbox', 'in inbox')} alerta={vencidas.length > 0} />
      </Stack>

      <Tabs
        value={aba}
        onChange={(_, v) => { setAba(v); setPagina(0) }}
        sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0, fontSize: 12, textTransform: 'none' } }}
      >
        <Tab label={t(`DDA (${inbox.length})`, `DDA (${inbox.length})`)} />
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
                {!inbox.length && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ color: 'text.secondary', py: 4 }}>
                      {t('Inbox limpo. Novos DDA da coleta aparecem aqui.', 'Inbox clear. New DDA from the pull show up here.')}
                    </TableCell>
                  </TableRow>
                )}
                {visiveis.map((e) => {
                  const vencida = !!e.vencimento && e.vencimento < hoje
                  return (
                    <TableRow key={e.id} hover selected={marcadas.has(e.id)}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={marcadas.has(e.id)} onChange={() => toggle(e.id)} />
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
                        <Tooltip title={!e.nf_confirmada ? t('Espere a conferência da NF no estoque', 'Wait for invoice check in inventory') : ''}>
                          <span>
                            <Button
                              size="small"
                              disabled={!e.nf_confirmada || enviando}
                              onClick={async () => {
                                setMarcadas(new Set([e.id]))
                                setEnviando(true)
                                try {
                                  const r = await api.entrarNaAgenda([e.id])
                                  if (r.enviados.length) {
                                    setAviso(t('Título na Agenda banco.', 'Title sent to bank schedule.'))
                                    await carregar()
                                  } else setErro(r.bloqueados[0]?.motivo || t('Não enviou', 'Could not send'))
                                } catch (err) {
                                  setErro(err instanceof Error ? err.message : t('Não enviou', 'Could not send'))
                                } finally {
                                  setEnviando(false)
                                  setMarcadas(new Set())
                                }
                              }}
                              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: 'transparent' } }}
                            >
                              {t('Agenda', 'Schedule')}
                            </Button>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
          <TablePagination
            component="div"
            count={inbox.length}
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

      <Snackbar open={!!aviso} autoHideDuration={3600} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
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
