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
import { api, brl, type ColetaReceita, type Despesa, type Empresa, type NotaReceita } from '../api'
import { ordenarEmpresas, ordenarLancamentosPorEmpresa } from '../ordemEmpresas'
import { rotuloDespesa } from '../rotuloDespesa'
import { usePrefs } from '../prefs'

const INBOX_STATUS = new Set(['rascunho', 'classificada', 'bloqueada_duplicata'])
const FILTROS = ['Todas', 'Vencidas', 'NF confirmada', 'Aguardando NF'] as const
const FILTROS_NF = ['Todas', 'Autorizadas', 'Canceladas', 'Com XML'] as const
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
  const [deNf, setDeNf] = useState(() => periodoNotas().de)
  const [ateNf, setAteNf] = useState(() => periodoNotas().ate)
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>('Todas')
  const [erro, setErro] = useState('')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [enviando, setEnviando] = useState(false)
  const [pagina, setPagina] = useState(0)
  const [porPagina, setPorPagina] = useState(30)
  const [notas, setNotas] = useState<NotaReceita[]>([])
  const [coletaNf, setColetaNf] = useState<ColetaReceita | null>(null)
  const [filtroNf, setFiltroNf] = useState<(typeof FILTROS_NF)[number]>('Todas')
  const [buscandoNf, setBuscandoNf] = useState(false)
  const [aviso, setAviso] = useState('')
  const [acaoNf, setAcaoNf] = useState<{ id: string; tipo: 'danfe' | 'agenda' } | null>(null)

  const carregarNotas = (empresa = loja) =>
    api.notasReceita(empresa || undefined).then((r) => {
      setNotas(r.notas)
      setColetaNf(r.coleta)
    }).catch(() => {
      setNotas([])
    })

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

  const verNaAgenda = (vencimento: string | null) => {
    const dia = (vencimento || '').slice(0, 10)
    const q = new URLSearchParams()
    if (dia) {
      q.set('de', dia)
      q.set('ate', dia)
    }
    if (loja) q.set('loja', loja)
    navigate(`/financeiro?${q.toString()}`)
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

  const lancarLinha = async (n: NotaReceita) => {
    if (n.despesa_id) {
      verNaAgenda(n.agenda_vencimento)
      return
    }
    setAcaoNf({ id: n.id, tipo: 'agenda' })
    setErro('')
    setAviso('')
    try {
      const r = await api.lancarNotaAgenda(n.id)
      setNotas((lista) => lista.map((item) => (
        item.id === n.id ? { ...item, despesa_id: r.id, agenda_vencimento: r.vencimento } : item
      )))
      const nome = n.numero ? `NF ${n.numero}` : t('Nota', 'Invoice')
      const parcelas = r.quantidade > 1
        ? t(` Em ${r.quantidade} parcelas.`, ` In ${r.quantidade} installments.`)
        : ''
      const quando = r.vencimento ? t(` Vencimento ${dataBr(r.vencimento)}.`, ` Due ${dataBr(r.vencimento)}.`) : ''
      setAviso(
        (r.ja_existia
          ? t(`${nome} já estava na agenda.`, `${nome} was already on the agenda.`)
          : t(`${nome} entrou na agenda para pagamento.`, `${nome} is on the payment agenda.`))
        + parcelas
        + quando,
      )
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não lançou na agenda', 'Could not add to the agenda'))
    } finally {
      setAcaoNf(null)
    }
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
      {aviso && <Alert severity="success" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: 12 } }}>{aviso}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ alignItems: { md: 'center' } }}>
        <TextField size="small" placeholder={t('Buscar lançamento', 'Search entry')} value={busca} onChange={(ev) => setBusca(ev.target.value)} sx={{ minWidth: 240, bgcolor: 'background.paper' }} />
        <TextField size="small" label={t('De', 'From')} type="date" value={aba === 1 ? deNf : de} onChange={(ev) => (aba === 1 ? setDeNf(ev.target.value) : setDe(ev.target.value))} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 138, bgcolor: 'background.paper' }} />
        <TextField size="small" label={t('Até', 'To')} type="date" value={aba === 1 ? ateNf : ate} onChange={(ev) => (aba === 1 ? setAteNf(ev.target.value) : setAte(ev.target.value))} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 138, bgcolor: 'background.paper' }} />
        <TextField
          select
          size="small"
          label={t('Loja', 'Store')}
          value={loja}
          onChange={(ev) => { setLoja(ev.target.value); carregar(ev.target.value); carregarNotas(ev.target.value) }}
          sx={{ minWidth: 180, bgcolor: 'background.paper', '& .MuiOutlinedInput-notchedOutline': { borderColor: loja ? 'primary.main' : undefined } }}
        >
          <MenuItem value="">{t('Todas as lojas', 'All stores')}</MenuItem>
          {lojas.map((e) => <MenuItem key={e.id} value={e.id}>{e.apelido}</MenuItem>)}
        </TextField>
        <Box sx={{ flex: 1 }} />
        {aba === 0 ? (
          <>
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
          </>
        ) : (
          <Button size="small" variant="contained" disabled={buscandoNf} onClick={() => buscarReceita()}>
            {buscandoNf ? t('Consultando…', 'Checking…') : t('Buscar na Receita', 'Pull from Receita')}
          </Button>
        )}
      </Stack>

      {aba === 1 && coletaNf?.mensagem && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{coletaNf.mensagem}</Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {aba === 0 ? (
          <>
            <Resumo rotulo={t('No inbox', 'In inbox')} valor={String(noPeriodo.length)} detalhe={t('boletos DDA', 'DDA boletos')} />
            <Resumo rotulo={t('NF conferida', 'Invoice checked')} valor={String(comNf.length)} detalhe={t('prontos para agenda', 'ready for schedule')} />
            <Resumo rotulo={t('Aguardando NF', 'Awaiting invoice')} valor={String(semNf.length)} detalhe={t('gestor no app', 'manager in the app')} />
            <Resumo rotulo={t('Vencidas', 'Overdue')} valor={String(vencidas.length)} detalhe={t('no inbox', 'in inbox')} alerta={vencidas.length > 0} />
          </>
        ) : (
          <>
            <Resumo rotulo={t('No período', 'In period')} valor={String(notasNoPeriodo.length)} detalhe={t('notas da Receita', 'Receita invoices')} />
            <Resumo rotulo={t('Autorizadas', 'Authorized')} valor={String(notasAutorizadas.length)} detalhe={t('no nome da empresa', 'issued to the company')} />
            <Resumo rotulo={t('Com XML', 'With XML')} valor={String(notasComXml.length)} detalhe={t('itens no gestor', 'items in the app')} />
            <Resumo rotulo={t('Canceladas', 'Cancelled')} valor={String(notasCanceladas.length)} detalhe={t('na Receita', 'at Receita')} alerta={notasCanceladas.length > 0} />
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
              bgcolor: (aba === 0 ? filtro : filtroNf) === item ? (escuro ? 'rgba(27, 110, 243, 0.2)' : 'rgba(27, 110, 243, 0.1)') : 'background.paper',
              borderColor: (aba === 0 ? filtro : filtroNf) === item ? 'primary.main' : 'divider',
              color: (aba === 0 ? filtro : filtroNf) === item ? (escuro ? '#93C5FD' : '#0D4ECC') : 'text.secondary',
              fontWeight: (aba === 0 ? filtro : filtroNf) === item ? 600 : 500,
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
        <Tab label={t(`Notas fiscais (${notasLinhas.length})`, `Invoices (${notasLinhas.length})`)} />
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

      {aba === 1 && (
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Table size="small" stickyHeader sx={{ width: '100%', tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 110 }}>{t('Situação', 'Status')}</TableCell>
                  <TableCell>{t('Emitente', 'Issuer')}</TableCell>
                  <TableCell sx={{ width: 120 }}>{t('Loja', 'Store')}</TableCell>
                  <TableCell sx={{ width: 108 }}>{t('Emissão', 'Issue date')}</TableCell>
                  <TableCell align="right" sx={{ width: 110 }}>{t('Valor', 'Amount')}</TableCell>
                  <TableCell align="right" sx={{ width: 168 }}>{t('Documento', 'Document')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!notasLinhas.length && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ color: 'text.secondary', py: 4 }}>
                      {notas.length
                        ? t('Nenhuma nota nesse filtro.', 'No invoices in this filter.')
                        : t(
                          'Nenhuma nota ainda. Buscar na Receita traz as NF-e emitidas no nome da empresa, como o DDA faz com o boleto.',
                          'No invoices yet. Pull from Receita brings NF-e issued to the company, the same way DDA brings boletos.',
                        )}
                    </TableCell>
                  </TableRow>
                )}
                {visiveisNf.map((n) => (
                  <TableRow key={n.id} hover>
                    <TableCell>{chipSituacao(n.situacao, t, escuro)}</TableCell>
                    <TableCell sx={{ overflow: 'hidden' }}>
                      <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25 }}>{n.emitente_nome || '—'}</Typography>
                      <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary' }}>
                        {n.numero ? `NF ${n.numero}` : n.chave}
                      </Typography>
                    </TableCell>
                    <TableCell>{n.origem || '—'}</TableCell>
                    <TableCell>{dataBr(n.emissao)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {n.valor_total != null ? brl(n.valor_total) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={acaoNf?.id === n.id}
                        onClick={() => abrirDanfeLinha(n)}
                        sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 11, fontWeight: 700 }}
                      >
                        {acaoNf?.id === n.id && acaoNf.tipo === 'danfe' ? t('Abrindo…', 'Opening…') : 'DANFE'}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={acaoNf?.id === n.id || ((n.situacao === 'cancelada' || n.situacao === 'denegada') && !n.despesa_id)}
                        onClick={() => lancarLinha(n)}
                        sx={{ minWidth: 0, ml: 0.5, px: 1, py: 0.25, fontSize: 11, fontWeight: 700 }}
                      >
                        {acaoNf?.id === n.id && acaoNf.tipo === 'agenda'
                          ? t('Lançando…', 'Posting…')
                          : n.despesa_id
                            ? t('Na agenda', 'On agenda')
                            : t('Agenda', 'Agenda')}
                      </Button>
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
