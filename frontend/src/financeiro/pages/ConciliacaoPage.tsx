import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import LinkOffOutlinedIcon from '@mui/icons-material/LinkOffOutlined'
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import {
  api,
  emCache,
  lojaCaixaSalva,
  salvarLojaCaixa,
  urlEmpresas,
  type ConciliacaoDespesa,
  type ConciliacaoDia,
  type ConciliacaoDiaResumo,
  type ConciliacaoLancamento,
  type ConciliacaoLista,
  type ConciliacaoListaItem,
  type ConciliacaoSemana,
  type ContaExtrato,
  ContaNaoIdentificada,
  type Empresa,
} from '../api'
import FiltroMesFinanceiro from '../FiltroMesFinanceiro'
import { ordenarEmpresas } from '../ordemEmpresas'
import { usePrefs } from '../prefs'
import SeletorLojaFinanceiro from '../SeletorLojaFinanceiro'
import {
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_SURFACE_ALT,
  FIN_TEXT,
  finBtnContainedSx,
  finBtnOutlinedSx,
  finPageSx,
  finPaperSx,
} from '../temaFinanceiroEscuro'

function mesAtual() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()).slice(0, 7)
}

function hojeIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function limitesMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number)
  const fim = new Date(ano, m, 0)
  const ate = `${mes}-${String(fim.getDate()).padStart(2, '0')}`
  return { de: `${mes}-01`, ate }
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataBr(iso: string | null | undefined) {
  if (!iso) return '—'
  return iso.slice(0, 10).split('-').reverse().join('/')
}

function mesmoValor(a: number, b: number) {
  return Math.round(a * 100) === Math.round(b * 100)
}

function arquivoBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binario)
}

type StatusDia = 'ok' | 'pendente' | 'sem_extrato' | 'vazio' | 'futuro'

function statusDia(dia: ConciliacaoDiaResumo | null, hoje: string): StatusDia {
  if (!dia) return 'vazio'
  if (dia.data > hoje) return 'futuro'
  if (dia.qtd_extrato === 0 && dia.qtd_sistema === 0) return 'vazio'
  if (dia.qtd_extrato === 0) return 'sem_extrato'
  if (dia.ok || (dia.pendente_extrato === 0 && dia.pendente_sistema === 0)) return 'ok'
  return 'pendente'
}

const TOM: Record<StatusDia, { color: string; border: string; bg: string; label: [string, string] }> = {
  ok: { color: '#047857', border: 'rgba(16,185,129,0.45)', bg: 'rgba(16,185,129,0.12)', label: ['Conciliado', 'Matched'] },
  pendente: { color: '#B45309', border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.12)', label: ['Pendente', 'Open'] },
  sem_extrato: { color: '#B91C1C', border: 'rgba(239,68,68,0.45)', bg: 'rgba(239,68,68,0.08)', label: ['Sem extrato', 'No statement'] },
  vazio: { color: FIN_MUTED, border: FIN_BORDER, bg: 'transparent', label: ['—', '—'] },
  futuro: { color: FIN_MUTED, border: FIN_BORDER, bg: 'transparent', label: ['', ''] },
}

function gradeMes(mes: string, dias: ConciliacaoDiaResumo[]) {
  const [ano, mesNum] = mes.split('-').map(Number)
  const primeiro = new Date(ano, mesNum - 1, 1)
  const inicio = primeiro.getDay()
  const total = new Date(ano, mesNum, 0).getDate()
  const porDia = new Map(dias.map((d) => [d.data, d]))
  const celulas: Array<ConciliacaoDiaResumo | null> = []
  for (let i = 0; i < inicio; i += 1) celulas.push(null)
  for (let dia = 1; dia <= total; dia += 1) {
    const data = `${mes}-${String(dia).padStart(2, '0')}`
    celulas.push(porDia.get(data) || {
      data,
      total_extrato: 0,
      pendente_extrato: 0,
      qtd_extrato: 0,
      total_sistema: 0,
      pendente_sistema: 0,
      qtd_sistema: 0,
      ok: false,
    })
  }
  while (celulas.length % 7 !== 0) celulas.push(null)
  const semanas: Array<Array<ConciliacaoDiaResumo | null>> = []
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7))
  return semanas
}

export function ConciliacaoPage() {
  const { t, idioma } = usePrefs()
  const inputRef = useRef<HTMLInputElement>(null)
  const [empresas, setEmpresas] = useState<Empresa[]>(() => emCache<Empresa[]>(urlEmpresas()) ?? [])
  const [empresaId, setEmpresaId] = useState(lojaCaixaSalva)
  const [mes, setMes] = useState(mesAtual)
  const [mesDados, setMesDados] = useState<ConciliacaoSemana | null>(null)
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [diaAberto, setDiaAberto] = useState(false)
  const [diaDados, setDiaDados] = useState<ConciliacaoDia | null>(null)
  const [selBanco, setSelBanco] = useState<string | null>(null)
  const [selTitulo, setSelTitulo] = useState<string | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [carregarDia, setCarregarDia] = useState(false)
  const [escolherConta, setEscolherConta] = useState<{ file: File; mensagem: string; contas: ContaExtrato[] } | null>(null)
  const [listaAberta, setListaAberta] = useState(false)
  const [listaDados, setListaDados] = useState<ConciliacaoLista | null>(null)
  const [listaAba, setListaAba] = useState<'abertos' | 'conciliados'>('abertos')
  const [listaBusca, setListaBusca] = useState('')
  const [carregarLista, setCarregarLista] = useState(false)

  const lojas = useMemo(() => ordenarEmpresas(empresas.filter((e) => e.tipo === 'loja')), [empresas])
  const hoje = hojeIso()
  const { de, ate } = limitesMes(mes)
  const lojaAtual = lojas.find((l) => l.id === empresaId)

  useEffect(() => {
    api.empresas().then((lista) => {
      setEmpresas(lista)
      setEmpresaId((atual) => {
        if (atual && lista.some((e) => e.id === atual)) return atual
        const loja = lista.find((e) => e.tipo === 'loja')
        return loja?.id || ''
      })
    }).catch((err: unknown) => setErro(err instanceof Error ? err.message : t('Não carregou as lojas', 'Could not load stores')))
  }, [])

  const carregarMes = async () => {
    if (!empresaId || !mes) return
    setCarregando(true)
    try {
      const dados = await api.conciliacaoSemana(empresaId, de, ate)
      setMesDados(dados)
      setErro('')
      setSelecionado((atual) => {
        if (atual && atual.startsWith(mes)) return atual
        const doDia = dados.dias.find((d) => d.data === hoje)
          || dados.dias.find((d) => d.qtd_extrato > 0 || d.qtd_sistema > 0)
          || dados.dias[0]
        return doDia?.data || null
      })
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não carregou a conciliação.', 'Could not load reconciliation.'))
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (empresaId) salvarLojaCaixa(empresaId)
    void carregarMes()
  }, [empresaId, mes])

  const semanas = useMemo(() => gradeMes(mes, mesDados?.dias || []), [mes, mesDados])
  const diasSemana = idioma === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const diaResumo = (mesDados?.dias || []).find((d) => d.data === selecionado) || null
  const stPainel = statusDia(diaResumo, hoje)

  const totais = useMemo(() => {
    let ok = 0
    let pendente = 0
    let semExtrato = 0
    for (const d of mesDados?.dias || []) {
      const st = statusDia(d, hoje)
      if (st === 'ok') ok += 1
      else if (st === 'pendente') pendente += 1
      else if (st === 'sem_extrato') semExtrato += 1
    }
    return { ok, pendente, semExtrato }
  }, [mesDados, hoje])

  const abrirDia = async (data: string) => {
    setSelecionado(data)
    setDiaAberto(true)
    setCarregarDia(true)
    setSelBanco(null)
    setSelTitulo(null)
    try {
      const dados = await api.conciliacaoDia(empresaId, data)
      setDiaDados(dados)
      const aberto = dados.extrato.find((l) => !l.despesa_id && l.status !== 'sem_par')
      setSelBanco(aberto?.id || dados.extrato[0]?.id || null)
      if (aberto?.sugerido_despesa_id) setSelTitulo(aberto.sugerido_despesa_id)
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não carregou o dia.', 'Could not load the day.'))
      setDiaAberto(false)
    } finally {
      setCarregarDia(false)
    }
  }

  const refrescarDia = async () => {
    if (!selecionado) return
    const dados = await api.conciliacaoDia(empresaId, selecionado)
    setDiaDados(dados)
    await carregarMes()
  }

  const subirArquivo = async (file: File, contaUpload?: string) => {
    setOcupado(true)
    setAviso('')
    setEscolherConta(null)
    try {
      const base64 = arquivoBase64(await file.arrayBuffer())
      const r = await api.uploadExtrato(file.name, base64, contaUpload, empresaId || undefined)
      setAviso(
        r.ja_importado
          ? t(`${r.conta}: extrato já estava importado.`, `${r.conta}: statement already imported.`)
          : t(`${r.conta}: ${r.criadas} lançamento(s).`, `${r.conta}: ${r.criadas} entr${r.criadas === 1 ? 'y' : 'ies'}.`),
      )
      if (r.empresa_id) setEmpresaId(r.empresa_id)
      if (r.de) setMes(r.de.slice(0, 7))
      await carregarMes()
    } catch (err) {
      if (err instanceof ContaNaoIdentificada) {
        setEscolherConta({ file, mensagem: err.message, contas: err.contas })
      } else {
        setErro(err instanceof Error ? err.message : t('Não importou o extrato.', 'Could not import the statement.'))
      }
    } finally {
      setOcupado(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const confirmar = async (lancamentoId: string, despesaId: string) => {
    if (ocupado) return
    setOcupado(true)
    try {
      await api.confirmarConciliacao(lancamentoId, despesaId)
      setAviso(t('Conciliado.', 'Reconciled.'))
      setSelTitulo(null)
      await refrescarDia()
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não conciliou.', 'Could not reconcile.'))
    } finally {
      setOcupado(false)
    }
  }

  const desfazer = async (lancamentoId: string) => {
    if (ocupado) return
    setOcupado(true)
    try {
      await api.desfazerConciliacao(lancamentoId)
      await refrescarDia()
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não desfez.', 'Could not undo.'))
    } finally {
      setOcupado(false)
    }
  }

  const semPar = async (lancamentoId: string) => {
    if (ocupado) return
    setOcupado(true)
    try {
      await api.marcarSemPar(lancamentoId)
      await refrescarDia()
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não marcou.', 'Could not mark.'))
    } finally {
      setOcupado(false)
    }
  }

  const abrirLista = async (aba: 'abertos' | 'conciliados' = 'abertos') => {
    if (!empresaId) return
    setListaAba(aba)
    setListaAberta(true)
    setCarregarLista(true)
    setListaBusca('')
    try {
      const dados = await api.conciliacaoLista(empresaId, de, ate)
      setListaDados(dados)
      await carregarMes()
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não carregou a lista.', 'Could not load the list.'))
      setListaAberta(false)
    } finally {
      setCarregarLista(false)
    }
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const alvo = ev.target as HTMLElement | null
      const digitando = alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.isContentEditable)
      if (digitando) return
      if (ev.key === 'l' || ev.key === 'L') {
        if (diaAberto || escolherConta) return
        ev.preventDefault()
        void abrirLista(ev.shiftKey ? 'conciliados' : 'abertos')
      }
      if (ev.key === 'Escape' && listaAberta) setListaAberta(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [empresaId, de, ate, diaAberto, escolherConta, listaAberta])

  const itensLista = useMemo(() => {
    if (!listaDados) return [] as ConciliacaoListaItem[]
    const base = listaAba === 'abertos' ? listaDados.abertos : listaDados.conciliados
    const termo = listaBusca.trim().toLowerCase()
    if (!termo) return base
    return base.filter((i) => {
      const alvo = `${i.banco || ''} ${i.agenda || ''} ${i.data} ${i.valor}`.toLowerCase()
      return alvo.includes(termo)
    })
  }, [listaDados, listaAba, listaBusca])

  const dataPainel = selecionado
    ? new Date(`${selecionado}T12:00:00`).toLocaleDateString(idioma === 'en' ? 'en-US' : 'pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
    : ''

  return (
    <Stack spacing={2} sx={finPageSx}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
        <SeletorLojaFinanceiro
          lojas={lojas}
          value={empresaId}
          label={t('Loja', 'Store')}
          width={{ xs: '100%', md: 240 }}
          onChange={setEmpresaId}
        />
        <FiltroMesFinanceiro
          value={mes}
          onChange={setMes}
          label={t('Mês', 'Month')}
          idioma={idioma}
          width={200}
        />
        <Chip
          size="small"
          variant="outlined"
          label={carregando
            ? t('Carregando…', 'Loading…')
            : t(`${totais.pendente} pendente(s)`, `${totais.pendente} open`)}
          sx={{
            height: 28,
            fontSize: 11,
            fontWeight: 600,
            bgcolor: FIN_SURFACE,
            borderColor: totais.pendente > 0 ? 'rgba(245,158,11,0.5)' : 'rgba(16,185,129,0.45)',
            color: totais.pendente > 0 ? '#B45309' : '#047857',
          }}
        />
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          disabled={!empresaId || carregarLista}
          startIcon={carregarLista ? <CircularProgress size={14} /> : <ListAltOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => void abrirLista('abertos')}
          sx={{ ...finBtnOutlinedSx, height: 34, textTransform: 'none', fontWeight: 650 }}
          title={t('Atalho: L (Shift+L = conciliados)', 'Shortcut: L (Shift+L = matched)')}
        >
          {t('Lista · L', 'List · L')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".ofx,.qfx,.csv,.txt,.xlsx"
          hidden
          onChange={(ev) => {
            const file = ev.target.files?.[0]
            if (file) void subirArquivo(file)
          }}
        />
        <Button
          size="small"
          variant="contained"
          disabled={ocupado}
          startIcon={ocupado ? <CircularProgress size={14} color="inherit" /> : <UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => inputRef.current?.click()}
          sx={{ ...finBtnContainedSx, height: 34, textTransform: 'none', fontWeight: 650 }}
        >
          {t('Importar extrato', 'Import statement')}
        </Button>
      </Stack>

      {erro ? <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert> : null}
      {aviso ? <Alert severity="success" onClose={() => setAviso('')}>{aviso}</Alert> : null}

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...finPaperSx }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid', borderColor: FIN_BORDER, bgcolor: FIN_SURFACE_ALT }}>
            {diasSemana.map((nome) => (
              <Box key={nome} sx={{ px: 1.25, py: 1, borderRight: '1px solid', borderColor: FIN_BORDER, '&:last-child': { borderRight: 0 } }}>
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: FIN_MUTED }}>{nome}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateRows: `repeat(${Math.max(semanas.length, 1)}, minmax(92px, 1fr))` }}>
            {semanas.map((semana, si) => (
              <Box key={si} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid', borderColor: FIN_BORDER, '&:last-child': { borderBottom: 0 }, minHeight: 92 }}>
                {semana.map((dia, di) => {
                  if (!dia) {
                    return (
                      <Box
                        key={`vazio-${si}-${di}`}
                        sx={{ borderRight: '1px solid', borderColor: FIN_BORDER, bgcolor: FIN_SURFACE_ALT, '&:last-child': { borderRight: 0 } }}
                      />
                    )
                  }
                  const st = statusDia(dia, hoje)
                  const tom = TOM[st]
                  const ativo = selecionado === dia.data
                  const ehHoje = dia.data === hoje
                  return (
                    <Box
                      key={dia.data}
                      onClick={() => void abrirDia(dia.data)}
                      sx={{
                        borderRight: '1px solid',
                        borderColor: FIN_BORDER,
                        px: 1.25,
                        py: 1,
                        cursor: 'pointer',
                        bgcolor: ativo
                          ? 'rgba(27,110,243,0.1)'
                          : ehHoje
                            ? 'rgba(245,158,11,0.1)'
                            : 'transparent',
                        transition: 'background-color 120ms',
                        '&:hover': { bgcolor: ativo ? 'rgba(27,110,243,0.14)' : 'rgba(15,23,42,0.04)' },
                        '&:last-child': { borderRight: 0 },
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 92,
                      }}
                    >
                      <Typography sx={{ alignSelf: 'flex-end', fontSize: 13, fontWeight: 500, color: FIN_MUTED, lineHeight: 1 }}>
                        {Number(dia.data.slice(8, 10))}
                      </Typography>
                      {(dia.qtd_extrato > 0 || dia.qtd_sistema > 0) ? (
                        <>
                          <Typography sx={{ mt: 0.75, fontSize: 13, fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: FIN_TEXT, lineHeight: 1.2 }}>
                            {brl(dia.total_extrato || dia.total_sistema)}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: FIN_MUTED, mt: 0.2 }}>
                            {dia.qtd_extrato
                              ? t(`${dia.qtd_extrato} no banco`, `${dia.qtd_extrato} bank`)
                              : t(`${dia.qtd_sistema} na agenda`, `${dia.qtd_sistema} agenda`)}
                          </Typography>
                          {st !== 'vazio' && st !== 'futuro' && (
                            <Chip
                              size="small"
                              label={idioma === 'en' ? tom.label[1] : tom.label[0]}
                              variant="outlined"
                              sx={{
                                mt: 'auto',
                                alignSelf: 'flex-start',
                                height: 22,
                                fontSize: 11,
                                fontWeight: 600,
                                color: tom.color,
                                borderColor: tom.border,
                                bgcolor: tom.bg,
                              }}
                            />
                          )}
                        </>
                      ) : (
                        <Box sx={{ flex: 1 }} />
                      )}
                    </Box>
                  )
                })}
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ ...finPaperSx, p: 2, minHeight: 280, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: FIN_TEXT }}>
            {t('Resumo do dia', 'Day summary')}
          </Typography>
          <Typography sx={{ fontSize: 12, color: FIN_MUTED, mt: 0.25 }}>
            {lojaAtual?.apelido || '—'} · {dataPainel || t('Selecione um dia', 'Pick a day')}
          </Typography>

          {diaResumo ? (
            <Stack spacing={1.5} sx={{ mt: 2, flex: 1 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Metrica rotulo={t('Banco', 'Bank')} valor={brl(diaResumo.total_extrato)} />
                <Metrica rotulo={t('Agenda', 'Agenda')} valor={brl(diaResumo.total_sistema)} />
                <Metrica rotulo={t('Pendente banco', 'Open bank')} valor={brl(diaResumo.pendente_extrato)} alerta={diaResumo.pendente_extrato > 0} />
                <Metrica rotulo={t('Pendente agenda', 'Open agenda')} valor={brl(diaResumo.pendente_sistema)} alerta={diaResumo.pendente_sistema > 0} />
              </Box>
              <Chip
                size="small"
                variant="outlined"
                label={idioma === 'en' ? TOM[stPainel].label[1] || '—' : TOM[stPainel].label[0] || '—'}
                sx={{
                  alignSelf: 'flex-start',
                  height: 24,
                  fontWeight: 600,
                  color: TOM[stPainel].color,
                  borderColor: TOM[stPainel].border,
                  bgcolor: TOM[stPainel].bg,
                }}
              />
              <Box sx={{ flex: 1 }} />
              <Button
                variant="contained"
                onClick={() => selecionado && void abrirDia(selecionado)}
                sx={{ ...finBtnContainedSx, textTransform: 'none', fontWeight: 700 }}
              >
                {t('Abrir conciliação do dia', 'Open day reconciliation')}
              </Button>
            </Stack>
          ) : (
            <Typography sx={{ mt: 3, fontSize: 13, color: FIN_MUTED }}>
              {t('Clique num dia do calendário para conciliar.', 'Click a day on the calendar to reconcile.')}
            </Typography>
          )}
        </Paper>
      </Box>

      <Dialog
        open={diaAberto}
        onClose={() => setDiaAberto(false)}
        fullWidth
        maxWidth="lg"
        slotProps={{ paper: { sx: { height: { xs: '100%', md: 'min(86vh, 820px)' }, maxHeight: '100%', ...finPaperSx } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1, py: 1.25, borderBottom: `1px solid ${FIN_BORDER}` }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: FIN_TEXT }}>
              {t('Conciliação do dia', 'Day reconciliation')}
              {lojaAtual ? ` · ${lojaAtual.apelido}` : ''}
            </Typography>
            <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>
              {selecionado ? dataBr(selecionado) : ''} · {t('Agenda × extrato bancário', 'Agenda × bank statement')}
            </Typography>
          </Box>
          <IconButton onClick={() => setDiaAberto(false)} size="small" sx={{ color: FIN_MUTED }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: '0 !important', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {carregarDia || !diaDados ? (
            <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : (
            <PainelDia
              dados={diaDados}
              selBanco={selBanco}
              selTitulo={selTitulo}
              onSelBanco={setSelBanco}
              onSelTitulo={setSelTitulo}
              ocupado={ocupado}
              onConfirmar={confirmar}
              onDesfazer={desfazer}
              onSemPar={semPar}
              t={t}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={listaAberta}
        onClose={() => setListaAberta(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              ...finPaperSx,
              height: { xs: '90vh', md: '80vh' },
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1, py: 1.25, borderBottom: `1px solid ${FIN_BORDER}` }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 650 }}>
              {t('Lista do mês', 'Month list')} · {lojaAtual?.apelido || '—'}
            </Typography>
            <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>
              {t('Atalho L = abertos · Shift+L = conciliados', 'Shortcut L = open · Shift+L = matched')}
              {listaDados
                ? ` · ${listaDados.resumo.abertos_banco + listaDados.resumo.abertos_agenda} ${t('em aberto', 'open')} · ${listaDados.resumo.conciliados} ${t('conciliados', 'matched')}`
                : ''}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setListaAberta(false)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: '0 !important', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <Stack spacing={1.25} sx={{ px: 2, pt: 1.5, pb: 1, borderBottom: `1px solid ${FIN_BORDER}` }}>
            <Tabs
              value={listaAba}
              onChange={(_, v: 'abertos' | 'conciliados') => setListaAba(v)}
              sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 650 } }}
            >
              <Tab
                value="abertos"
                label={t(
                  `Em aberto (${(listaDados?.resumo.abertos_banco || 0) + (listaDados?.resumo.abertos_agenda || 0)})`,
                  `Open (${(listaDados?.resumo.abertos_banco || 0) + (listaDados?.resumo.abertos_agenda || 0)})`,
                )}
              />
              <Tab
                value="conciliados"
                label={t(`Conciliados (${listaDados?.resumo.conciliados || 0})`, `Matched (${listaDados?.resumo.conciliados || 0})`)}
              />
            </Tabs>
            <TextField
              size="small"
              placeholder={t('Buscar aluguel, fornecedor, valor…', 'Search rent, vendor, amount…')}
              value={listaBusca}
              onChange={(ev) => setListaBusca(ev.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: FIN_MUTED }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ maxWidth: 420 }}
            />
          </Stack>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', px: 2, py: 1.5 }}>
            {carregarLista ? (
              <Stack sx={{ py: 6, alignItems: 'center' }}><CircularProgress size={28} /></Stack>
            ) : itensLista.length === 0 ? (
              <Typography sx={{ py: 5, textAlign: 'center', color: FIN_MUTED, fontSize: 13 }}>
                {listaAba === 'abertos'
                  ? t('Nada em aberto neste mês.', 'Nothing open this month.')
                  : t('Nenhum item conciliado neste mês.', 'No matched items this month.')}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {itensLista.map((item) => (
                  <Box
                    key={`${item.tipo}-${item.id}`}
                    onClick={() => {
                      setListaAberta(false)
                      void abrirDia(item.data)
                    }}
                    sx={{
                      p: 1.25,
                      borderRadius: '10px',
                      border: `1px solid ${FIN_BORDER}`,
                      bgcolor: FIN_SURFACE,
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                      <Chip
                        size="small"
                        label={
                          item.tipo === 'banco' ? t('Banco', 'Bank')
                            : item.tipo === 'agenda' ? t('Agenda', 'Agenda')
                              : item.tipo === 'sem_par' ? t('Sem título', 'No bill')
                                : t('Conciliado', 'Matched')
                        }
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 650,
                          bgcolor: item.tipo === 'conciliado' || item.tipo === 'sem_par'
                            ? 'rgba(16,185,129,0.12)'
                            : 'rgba(245,158,11,0.12)',
                          color: item.tipo === 'conciliado' || item.tipo === 'sem_par' ? '#047857' : '#B45309',
                        }}
                      />
                      <Typography sx={{ fontSize: 12, color: FIN_MUTED, fontVariantNumeric: 'tabular-nums' }}>
                        {dataBr(item.data)}
                      </Typography>
                      <Box sx={{ flex: 1 }} />
                      <Typography sx={{ fontSize: 13, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                        {brl(item.valor)}
                      </Typography>
                    </Stack>
                    {item.agenda ? (
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{item.agenda}</Typography>
                    ) : null}
                    {item.banco ? (
                      <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>{item.banco}</Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog open={!!escolherConta} onClose={() => setEscolherConta(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 650 }}>
          {t('De qual conta é esse extrato?', 'Which account is this statement from?')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 12.5, color: FIN_MUTED, mb: 1.5 }}>{escolherConta?.mensagem}</Typography>
          <Stack spacing={0.75}>
            {(escolherConta?.contas || []).map((c) => (
              <Button
                key={c.id}
                variant="outlined"
                disabled={ocupado}
                onClick={() => escolherConta && void subirArquivo(escolherConta.file, c.id)}
                sx={{ ...finBtnOutlinedSx, justifyContent: 'space-between', textTransform: 'none' }}
              >
                <span>{c.rotulo}</span>
                <span style={{ color: FIN_MUTED, fontSize: 11 }}>{c.apelido}</span>
              </Button>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  )
}

function Metrica({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: alerta ? '#B91C1C' : FIN_MUTED }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: alerta ? '#B91C1C' : FIN_TEXT, lineHeight: 1.25 }}>
        {valor}
      </Typography>
    </Box>
  )
}

function PainelDia({
  dados,
  selBanco,
  selTitulo,
  onSelBanco,
  onSelTitulo,
  ocupado,
  onConfirmar,
  onDesfazer,
  onSemPar,
  t,
}: {
  dados: ConciliacaoDia
  selBanco: string | null
  selTitulo: string | null
  onSelBanco: (id: string | null) => void
  onSelTitulo: (id: string | null) => void
  ocupado: boolean
  onConfirmar: (lancamentoId: string, despesaId: string) => void
  onDesfazer: (lancamentoId: string) => void
  onSemPar: (lancamentoId: string) => void
  t: (pt: string, en: string) => string
}) {
  const [verFeitos, setVerFeitos] = useState(false)
  const ligadas = useMemo(() => new Set(dados.extrato.map((l) => l.despesa_id).filter(Boolean) as string[]), [dados])
  const sistemaPorId = useMemo(() => {
    const mapa = new Map<string, ConciliacaoDespesa>()
    for (const item of dados.sistema) mapa.set(item.id, item)
    return mapa
  }, [dados])

  const bancoAberto = (l: ConciliacaoLancamento) => !l.despesa_id && l.status !== 'sem_par' && l.status !== 'conciliado'
  const tituloAberto = (d: ConciliacaoDespesa) => d.status !== 'conciliada' && !ligadas.has(d.id)

  const bancoPendentes = dados.extrato.filter(bancoAberto)
  const bancoFeitos = dados.extrato.filter((l) => !bancoAberto(l))
  const agendaPendentes = dados.sistema.filter(tituloAberto)
  const agendaFeitos = dados.sistema.filter((d) => !tituloAberto(d))

  const listaBanco = verFeitos ? [...bancoPendentes, ...bancoFeitos] : bancoPendentes
  const listaAgenda = verFeitos ? [...agendaPendentes, ...agendaFeitos] : agendaPendentes

  const lanc = dados.extrato.find((l) => l.id === selBanco) || null
  const titulo = dados.sistema.find((d) => d.id === selTitulo) || null
  const podeCasar = !!(
    lanc && titulo && bancoAberto(lanc) && tituloAberto(titulo) && mesmoValor(lanc.valor, titulo.valor)
  )

  const somaBanco = bancoPendentes.reduce((s, l) => s + l.valor, 0)
  const somaAgenda = agendaPendentes.reduce((s, d) => s + d.valor, 0)
  const qtdFeitos = bancoFeitos.filter((l) => l.despesa_id || l.status === 'conciliado').length

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 2, py: 1.1, borderBottom: `1px solid ${FIN_BORDER}`, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 650, color: FIN_TEXT }}>
            {t(
              `${bancoPendentes.length} no banco sem casar · ${agendaPendentes.length} na agenda sem extrato`,
              `${bancoPendentes.length} unmatched on bank · ${agendaPendentes.length} unmatched on agenda`,
            )}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: FIN_MUTED, mt: 0.15 }}>
            {qtdFeitos
              ? t(`${qtdFeitos} já conciliado(s) automaticamente — escondidos abaixo.`, `${qtdFeitos} already auto-matched — hidden below.`)
              : t('Clique um de cada lado com o mesmo valor, ou ignore o que não é título.', 'Click one on each side with the same amount, or ignore non-bills.')}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={() => setVerFeitos((v) => !v)} sx={{ ...finBtnOutlinedSx, textTransform: 'none' }}>
          {verFeitos ? t('Só pendentes', 'Open only') : t('Ver conciliados', 'Show matched')}
        </Button>
        <Button
          size="small"
          variant="contained"
          disabled={ocupado || !podeCasar}
          onClick={() => lanc && titulo && onConfirmar(lanc.id, titulo.id)}
          sx={{ ...finBtnContainedSx, textTransform: 'none', fontWeight: 700 }}
        >
          {podeCasar ? t('Conciliar os dois', 'Match both') : t('Selecione os dois', 'Select both')}
        </Button>
        {lanc && bancoAberto(lanc) && (
          <Button
            size="small"
            variant="outlined"
            disabled={ocupado}
            startIcon={<LinkOffOutlinedIcon sx={{ fontSize: 16 }} />}
            onClick={() => onSemPar(lanc.id)}
            sx={{ ...finBtnOutlinedSx, textTransform: 'none' }}
          >
            {t('Não é título', 'Not a bill')}
          </Button>
        )}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
        <Coluna
          titulo={t('Agenda (a pagar)', 'Agenda (payables)')}
          meta={t(
            `${listaAgenda.length} listado(s) · ${brl(somaAgenda)} em aberto`,
            `${listaAgenda.length} listed · ${brl(somaAgenda)} open`,
          )}
        >
          {!listaAgenda.length && (
            <Typography sx={{ p: 2, fontSize: 12.5, color: FIN_MUTED }}>
              {verFeitos
                ? t('Nada neste dia.', 'Nothing this day.')
                : t('Nada pendente na agenda. Tudo que dava casou, ou não há título.', 'No open agenda items. Everything matched, or there is no bill.')}
            </Typography>
          )}
          {listaAgenda.map((item) => {
            const aberto = tituloAberto(item)
            const ativo = item.id === selTitulo
            const mesmo = !!(lanc && aberto && mesmoValor(lanc.valor, item.valor))
            return (
              <LinhaItem
                key={item.id}
                ativo={ativo}
                status={aberto ? (mesmo ? 'par' : 'aberto') : 'ok'}
                data={dataBr(item.vencimento)}
                nome={item.descricao}
                detalhe={[item.numero_nf && `NF ${item.numero_nf}`, item.forma_pagamento].filter(Boolean).join(' · ') || undefined}
                valor={brl(item.valor)}
                onClick={() => {
                  if (!aberto) return
                  onSelTitulo(item.id)
                  if (lanc && !mesmoValor(lanc.valor, item.valor)) {
                    const par = bancoPendentes.find((l) => mesmoValor(l.valor, item.valor))
                    if (par) onSelBanco(par.id)
                  }
                }}
              />
            )
          })}
        </Coluna>

        <Coluna
          titulo={t('Extrato do banco', 'Bank statement')}
          meta={t(
            `${listaBanco.length} listado(s) · ${brl(somaBanco)} em aberto`,
            `${listaBanco.length} listed · ${brl(somaBanco)} open`,
          )}
          borda
        >
          {!listaBanco.length && (
            <Typography sx={{ p: 2, fontSize: 12.5, color: FIN_MUTED }}>
              {verFeitos
                ? t('Nenhuma saída neste dia.', 'No outflows this day.')
                : t('Nada pendente no banco neste dia.', 'Nothing open on the bank this day.')}
            </Typography>
          )}
          {listaBanco.map((item) => {
            const aberto = bancoAberto(item)
            const sug = item.sugerido_despesa_id ? sistemaPorId.get(item.sugerido_despesa_id) : null
            const ativo = item.id === selBanco
            const status = !aberto
              ? (item.status === 'sem_par' ? 'ignorado' : 'ok')
              : sug
                ? 'par'
                : 'aberto'
            return (
              <LinhaItem
                key={item.id}
                ativo={ativo}
                status={status}
                data={dataBr(item.data_contabil)}
                nome={item.historico || '—'}
                detalhe={
                  !aberto
                    ? (item.status === 'sem_par'
                      ? t('Ignorado (não é título)', 'Ignored (not a bill)')
                      : `${t('Casado com', 'Matched to')}: ${item.despesa_descricao || '—'}`)
                    : sug
                      ? `${t('Mesmo valor que', 'Same amount as')}: ${sug.descricao}`
                      : undefined
                }
                valor={brl(item.valor)}
                onClick={() => {
                  if (!aberto) return
                  onSelBanco(item.id)
                  if (item.sugerido_despesa_id) onSelTitulo(item.sugerido_despesa_id)
                  else onSelTitulo(null)
                }}
                acao={!aberto && item.despesa_id ? (
                  <Button size="small" onClick={(ev) => { ev.stopPropagation(); void onDesfazer(item.id) }} sx={{ minWidth: 0, px: 0.5, fontSize: 11, textTransform: 'none', color: FIN_MUTED }}>
                    {t('Desfazer', 'Undo')}
                  </Button>
                ) : sug && aberto ? (
                  <Button
                    size="small"
                    variant="contained"
                    disabled={ocupado}
                    onClick={(ev) => { ev.stopPropagation(); void onConfirmar(item.id, sug.id) }}
                    sx={{ ...finBtnContainedSx, minWidth: 0, px: 1, fontSize: 11, textTransform: 'none', height: 26 }}
                  >
                    {t('Conciliar', 'Match')}
                  </Button>
                ) : null}
              />
            )
          })}
        </Coluna>
      </Box>

      <DialogActions sx={{ borderTop: `1px solid ${FIN_BORDER}`, px: 2, py: 1, justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>
          {t('Em aberto', 'Open')}: {t('agenda', 'agenda')} {brl(somaAgenda)} · {t('banco', 'bank')} {brl(somaBanco)}
        </Typography>
        <Chip
          size="small"
          label={ativoLegenda(t)}
          variant="outlined"
          sx={{ height: 24, fontSize: 11, borderColor: FIN_BORDER, color: FIN_MUTED }}
        />
      </DialogActions>
    </Box>
  )
}

function ativoLegenda(t: (pt: string, en: string) => string) {
  return t('Azul = selecionado · Laranja = em aberto · Verde = já casado', 'Blue = selected · Amber = open · Green = matched')
}

function Coluna({
  titulo,
  meta,
  children,
  borda,
}: {
  titulo: string
  meta: string
  children: ReactNode
  borda?: boolean
}) {
  return (
    <Box sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', borderLeft: borda ? { xs: 0, md: `1px solid ${FIN_BORDER}` } : 0 }}>
      <Box sx={{ px: 1.5, py: 1, bgcolor: FIN_SURFACE_ALT, borderBottom: `1px solid ${FIN_BORDER}` }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: FIN_TEXT }}>{titulo}</Typography>
        <Typography sx={{ fontSize: 11.5, color: FIN_MUTED }}>{meta}</Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</Box>
    </Box>
  )
}

function LinhaItem({
  data,
  nome,
  detalhe,
  valor,
  ativo,
  status,
  onClick,
  acao,
}: {
  data: string
  nome: string
  detalhe?: string
  valor: string
  ativo?: boolean
  status: 'aberto' | 'par' | 'ok' | 'ignorado'
  onClick?: () => void
  acao?: ReactNode
}) {
  const fundo = ativo
    ? 'rgba(27,110,243,0.12)'
    : status === 'par'
      ? 'rgba(245,158,11,0.1)'
      : status === 'ok'
        ? 'rgba(16,185,129,0.06)'
        : 'transparent'
  const chip = status === 'ok'
    ? { label: 'OK', color: '#047857', border: 'rgba(16,185,129,0.45)', bg: 'rgba(16,185,129,0.1)' }
    : status === 'ignorado'
      ? { label: '—', color: FIN_MUTED, border: FIN_BORDER, bg: FIN_SURFACE_ALT }
      : status === 'par'
        ? { label: '=', color: '#B45309', border: 'rgba(245,158,11,0.5)', bg: 'rgba(245,158,11,0.12)' }
        : { label: '?', color: '#B45309', border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.06)' }

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'grid',
        gridTemplateColumns: '76px 28px minmax(0, 1fr) auto',
        gap: 0.75,
        alignItems: 'center',
        px: 1.25,
        py: 0.9,
        borderBottom: `1px solid ${FIN_BORDER}`,
        cursor: onClick && status !== 'ok' && status !== 'ignorado' ? 'pointer' : 'default',
        bgcolor: fundo,
        opacity: status === 'ok' || status === 'ignorado' ? 0.72 : 1,
        boxShadow: ativo ? 'inset 3px 0 0 #1B6EF3' : 'none',
        '&:hover': onClick && status !== 'ok' && status !== 'ignorado' ? { bgcolor: 'rgba(27,110,243,0.06)' } : undefined,
      }}
    >
      <Typography sx={{ fontSize: 11.5, color: FIN_MUTED, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
        {data}
      </Typography>
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '6px',
          border: `1px solid ${chip.border}`,
          bgcolor: chip.bg,
          color: chip.color,
          fontSize: 11,
          fontWeight: 700,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {chip.label}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: ativo ? 700 : 550, color: FIN_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {nome}
        </Typography>
        {detalhe && (
          <Typography sx={{ fontSize: 11, color: FIN_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {detalhe}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        {acao}
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: FIN_TEXT, whiteSpace: 'nowrap' }}>
          {valor}
        </Typography>
      </Stack>
    </Box>
  )
}
