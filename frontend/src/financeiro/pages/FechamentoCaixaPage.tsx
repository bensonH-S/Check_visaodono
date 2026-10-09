import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import AddIcon from '@mui/icons-material/Add'
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import CloseIcon from '@mui/icons-material/Close'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import DeliveryDiningOutlinedIcon from '@mui/icons-material/DeliveryDiningOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import QrCode2OutlinedIcon from '@mui/icons-material/QrCode2Outlined'
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined'
import { api, brl, type Empresa, type FechamentoDia, type Fornecedor, type LancamentoCaixa, type MesFechamento } from '../api'
import { ordenarEmpresas } from '../ordemEmpresas'
import { usePrefs } from '../prefs'

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

const TOM_CLARO: Record<string, { color: string; border: string; bg: string }> = {
  rascunho: { color: '#DC2626', border: 'rgba(220,38,38,0.55)', bg: 'rgba(220,38,38,0.06)' },
  conferido: { color: '#1D4ED8', border: 'rgba(59,130,246,0.45)', bg: 'rgba(59,130,246,0.08)' },
  fechado: { color: '#047857', border: 'rgba(16,185,129,0.45)', bg: 'rgba(16,185,129,0.08)' },
  aguardando: { color: '#CA8A04', border: 'rgba(234,179,8,0.5)', bg: 'rgba(234,179,8,0.1)' },
}

const TOM_ESCURO: Record<string, { color: string; border: string; bg: string }> = {
  rascunho: { color: '#FCA5A5', border: 'rgba(248,113,113,0.55)', bg: 'rgba(248,113,113,0.12)' },
  conferido: { color: '#93C5FD', border: 'rgba(96,165,250,0.5)', bg: 'rgba(96,165,250,0.14)' },
  fechado: { color: '#6EE7B7', border: 'rgba(52,211,153,0.45)', bg: 'rgba(52,211,153,0.14)' },
  aguardando: { color: '#FDE68A', border: 'rgba(250,204,21,0.5)', bg: 'rgba(250,204,21,0.12)' },
}

const ROTULO: Record<string, [string, string]> = {
  rascunho: ['Sem dados', 'No data'],
  conferido: ['Lançar despesa', 'Post expense'],
  fechado: ['Fechado', 'Closed'],
  aguardando: ['Aguardando', 'Waiting'],
}

function totalDia(d: FechamentoDia) {
  return Math.round((d.dinheiro + d.pix + d.debito + d.credito + d.cart_digital + d.ifood + d.azul + d.rappi + d.food99) * 100) / 100
}

function gate(d: FechamentoDia) {
  return Math.round((d.dinheiro + d.pix) * 100) / 100
}

function caixaGaveta(d: FechamentoDia) {
  return Math.round((d.dinheiro - (d.despesas_caixa || 0) - (d.depositos_caixa || 0)) * 100) / 100
}

function chegouDoPdv(d: FechamentoDia) {
  return totalDia(d) > 0
}

function dinheiroTexto(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function mascararMoeda(texto: string) {
  const soDigitosEVirgula = texto.replace(/[^\d,]/g, '')
  const [reais = '', ...resto] = soDigitosEVirgula.split(',')
  const centavos = resto.join('').slice(0, 2)
  if (soDigitosEVirgula.includes(',')) return `${reais},${centavos}`
  return reais
}

function lerDinheiro(texto: string) {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function gradeMes(mes: string, dias: FechamentoDia[], empresaId: string, empresa: string, bk: string | null) {
  const [ano, mesNum] = mes.split('-').map(Number)
  const primeiro = new Date(ano, mesNum - 1, 1)
  const inicio = primeiro.getDay()
  const total = new Date(ano, mesNum, 0).getDate()
  const porDia = new Map(dias.map((d) => [Number(d.data.slice(8, 10)), d]))
  const celulas: Array<FechamentoDia | null> = []
  for (let i = 0; i < inicio; i += 1) celulas.push(null)
  for (let dia = 1; dia <= total; dia += 1) {
    const data = `${mes}-${String(dia).padStart(2, '0')}`
    celulas.push(porDia.get(dia) || {
      id: null,
      empresa_id: empresaId,
      empresa,
      bk_number: bk,
      data,
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      cart_digital: 0,
      ifood: 0,
      azul: 0,
      rappi: 0,
      food99: 0,
      despesas_caixa: 0,
      depositos_caixa: 0,
      bandeiras: [],
      lancamentos: [],
      observacao: '',
      status: 'rascunho',
      atualizado_em: null,
    })
  }
  while (celulas.length % 7 !== 0) celulas.push(null)
  const semanas: Array<Array<FechamentoDia | null>> = []
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7))
  return semanas
}

function IconePagamento({ tipo }: { tipo: string }) {
  const sx = { fontSize: 16, color: 'inherit' }
  if (tipo === 'dinheiro') return <AccountBalanceWalletOutlinedIcon sx={sx} />
  if (tipo === 'pix') return <QrCode2OutlinedIcon sx={sx} />
  if (tipo === 'cartoes') return <CreditCardOutlinedIcon sx={sx} />
  if (tipo === 'ifood') return <RestaurantOutlinedIcon sx={sx} />
  if (tipo === 'food99') return <DeliveryDiningOutlinedIcon sx={sx} />
  return <PaymentsOutlinedIcon sx={sx} />
}

function LinhaPagamento({
  tipo,
  cor,
  rotulo,
  valor,
  abrir,
  aberto,
  onAbrir,
  filhos,
  denso,
}: {
  tipo: string
  cor: string
  rotulo: string
  valor: string
  abrir?: boolean
  aberto?: boolean
  onAbrir?: () => void
  filhos?: ReactNode
  denso?: boolean
}) {
  return (
    <Box>
      <Box
        onClick={abrir ? onAbrir : undefined}
        sx={{
          display: 'grid',
          gridTemplateColumns: '22px minmax(0, 1fr) max-content',
          columnGap: 1,
          alignItems: 'center',
          py: denso ? 0.35 : 0.55,
          cursor: abrir ? 'pointer' : 'default',
          userSelect: 'none',
        }}
      >
        <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: cor, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <IconePagamento tipo={tipo} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}>
          <Typography sx={{ fontSize: denso ? 12 : 13, color: 'text.secondary', lineHeight: 1.25 }}>{rotulo}</Typography>
          {abrir ? (
            <KeyboardArrowDownIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0, transform: aberto ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
          ) : null}
        </Box>
        <Typography sx={{ fontSize: denso ? 12 : 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>{valor}</Typography>
      </Box>
      {abrir ? <Collapse in={!!aberto}>{filhos}</Collapse> : null}
    </Box>
  )
}

function LinhaDebitoCredito({
  rotulo,
  valor,
  cor,
  bandeiras,
  aberto,
  onAbrir,
}: {
  rotulo: string
  valor: number
  cor: string
  bandeiras: Array<{ bandeira: string; tipo: string; valor: number }>
  aberto: boolean
  onAbrir: () => void
}) {
  const { t } = usePrefs()
  return (
    <LinhaPagamento
      tipo="cartoes"
      cor={cor}
      rotulo={rotulo}
      valor={brl(valor)}
      abrir
      aberto={aberto}
      onAbrir={onAbrir}
      filhos={(
        <Box sx={{ pb: 0.25 }}>
          {bandeiras.length ? bandeiras.map((item) => (
            <LinhaPagamento
              key={`${item.bandeira}-${item.tipo}`}
              tipo="cartoes"
              cor="#94A3B8"
              rotulo={item.bandeira}
              valor={brl(item.valor)}
              denso
            />
          )) : (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', pl: '30px', py: 0.35 }}>
              {t('A loja ainda não enviou as bandeiras.', 'The store has not sent card brands yet.')}
            </Typography>
          )}
        </Box>
      )}
    />
  )
}

function Metrica({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: alerta ? 'error.main' : 'text.secondary' }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: alerta ? 'error.main' : 'text.primary', lineHeight: 1.25 }}>
        {valor}
      </Typography>
    </Box>
  )
}

export function FechamentoCaixaPage() {
  const { t, modo, idioma } = usePrefs()
  const escuro = modo === 'escuro'
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaId] = useState('')
  const [mes, setMes] = useState(mesAtual)
  const [mesDados, setMesDados] = useState<MesFechamento | null>(null)
  const [selecionado, setSelecionado] = useState<FechamentoDia | null>(null)
  const [editando, setEditando] = useState<FechamentoDia | null>(null)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [debitoAberto, setDebitoAberto] = useState(false)
  const [creditoAberto, setCreditoAberto] = useState(false)

  const lojas = useMemo(() => ordenarEmpresas(empresas.filter((e) => e.tipo === 'loja')), [empresas])
  const hoje = hojeIso()

  useEffect(() => {
    api.empresas().then((lista) => {
      setEmpresas(lista)
      const loja = lista.find((e) => String(e.bk_number || '').replace(/\D/g, '') === '23531') || lista.find((e) => e.tipo === 'loja')
      if (loja) setEmpresaId((atual) => atual || loja.id)
    }).catch((err: unknown) => setErro(err instanceof Error ? err.message : t('Não carregou as lojas', 'Could not load stores')))
  }, [])

  const carregar = () => {
    if (!empresaId || !mes) return
    api.caixaMes(mes, empresaId)
      .then((dados) => {
        setMesDados(dados)
        setErro('')
        setSelecionado((atual) => {
          if (!atual) {
            const doDia = dados.dias.find((d) => d.data === hoje)
              || dados.dias.find((d) => chegouDoPdv(d))
              || dados.dias[0]
              || null
            return doDia
          }
          return dados.dias.find((d) => d.data === atual.data) || atual
        })
      })
      .catch((err: unknown) => setErro(err instanceof Error ? err.message : t('Não carregou o fechamento', 'Could not load cash closing')))
  }

  useEffect(() => { carregar() }, [empresaId, mes])

  const dias = mesDados?.dias ?? []
  const lojaAtual = lojas.find((l) => l.id === empresaId)
  const semanas = useMemo(
    () => gradeMes(mes, dias, empresaId, lojaAtual?.apelido || lojaAtual?.razao_social || '', mesDados?.empresa.bk_number ?? null),
    [mes, dias, empresaId, lojaAtual, mesDados],
  )
  const tomMap = escuro ? TOM_ESCURO : TOM_CLARO
  const diasSemana = idioma === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const diaPainel = selecionado || semanas.flat().find((d) => d?.data === hoje) || null
  const faltando = semanas.flat().filter((d) => d && d.data < hoje && !chegouDoPdv(d) && d.status !== 'fechado').length
  const fechados = (mesDados?.dias ?? []).filter((d) => d.status === 'fechado').length
  const dataPainel = diaPainel
    ? new Date(`${diaPainel.data}T12:00:00`).toLocaleDateString(idioma === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''

  const rotuloDia = (dia: FechamentoDia) => {
    if (dia.status === 'fechado' && dia.id) return 'fechado'
    if (chegouDoPdv(dia)) return 'conferido'
    if (dia.data === hoje) return 'aguardando'
    if (dia.data < hoje) return 'rascunho'
    return ''
  }

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
        <TextField
          select
          size="small"
          label={t('Loja', 'Store')}
          value={empresaId}
          onChange={(ev) => setEmpresaId(ev.target.value)}
          sx={{ minWidth: 220, bgcolor: 'background.paper' }}
        >
          {lojas.map((e) => <MenuItem key={e.id} value={e.id}>{e.apelido || e.razao_social}</MenuItem>)}
        </TextField>
        <TextField size="small" label={t('Mês', 'Month')} type="month" value={mes} onChange={(ev) => setMes(ev.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 170, bgcolor: 'background.paper' }} />
        <Tooltip
          title={mesDados?.pdv?.ultimo_ok
            ? `${t('Último heartbeat', 'Last heartbeat')} ${new Date(mesDados.pdv.ultimo_ok).toLocaleString(idioma === 'en' ? 'en-US' : 'pt-BR')}`
            : t('A loja ainda não enviou heartbeat.', 'The store has not sent a heartbeat yet.')}
        >
          <Chip
            size="small"
            color={mesDados?.pdv?.ok ? 'success' : 'warning'}
            variant="outlined"
            label={mesDados?.pdv?.ok
              ? t('PDV online', 'POS online')
              : t('PDV offline', 'POS offline')}
            sx={{ height: 32, fontWeight: 600 }}
          />
        </Tooltip>
      </Stack>

      {erro ? <Alert severity="error" onClose={() => setErro('')}>{erro}</Alert> : null}

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' }, gap: 2 }}>
        <Paper variant="outlined" sx={{ minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid', borderColor: 'divider' }}>
            {diasSemana.map((nome) => (
              <Box key={nome} sx={{ px: 1.25, py: 1, borderRight: '1px solid', borderColor: 'divider', '&:last-child': { borderRight: 0 } }}>
                <Typography sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}>{nome}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateRows: `repeat(${Math.max(semanas.length, 1)}, minmax(92px, 1fr))` }}>
            {semanas.map((semana, si) => (
              <Box key={si} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 0 }, minHeight: 92 }}>
                {semana.map((dia, di) => {
                  if (!dia) {
                    return (
                      <Box
                        key={`vazio-${si}-${di}`}
                        sx={{
                          borderRight: '1px solid',
                          borderColor: 'divider',
                          bgcolor: escuro ? 'rgba(255,255,255,0.015)' : '#FAFBFC',
                          '&:last-child': { borderRight: 0 },
                        }}
                      />
                    )
                  }
                  const chave = rotuloDia(dia)
                  const tom = tomMap[chave] || tomMap.rascunho
                  const rotulo = ROTULO[chave]
                  const valor = totalDia(dia)
                  const ehHoje = dia.data === hoje
                  const ativo = diaPainel?.data === dia.data
                  const temPdv = chegouDoPdv(dia)
                  return (
                    <Box
                      key={dia.data}
                      onClick={() => {
                        setSelecionado(dia)
                        setDebitoAberto(false)
                        setCreditoAberto(false)
                      }}
                      sx={{
                        borderRight: '1px solid',
                        borderColor: 'divider',
                        px: 1.25,
                        py: 1,
                        cursor: 'pointer',
                        bgcolor: ativo
                          ? (escuro ? 'rgba(27,110,243,0.18)' : 'rgba(219,234,254,0.9)')
                          : ehHoje
                            ? (escuro ? 'rgba(250,204,21,0.12)' : 'rgba(254,249,195,0.85)')
                            : 'transparent',
                        transition: 'background-color 120ms',
                        '&:hover': {
                          bgcolor: ativo
                            ? (escuro ? 'rgba(27,110,243,0.22)' : 'rgba(191,219,254,0.95)')
                            : (escuro ? 'rgba(255,255,255,0.04)' : 'rgba(248,250,252,1)'),
                        },
                        '&:last-child': { borderRight: 0 },
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 92,
                      }}
                    >
                      <Typography sx={{ alignSelf: 'flex-end', fontSize: 13, fontWeight: 500, color: 'text.secondary', lineHeight: 1 }}>
                        {Number(dia.data.slice(8, 10))}
                      </Typography>
                      {temPdv || chave ? (
                        <Box sx={{ mt: 0.75 }}>
                          {temPdv ? (
                            <>
                              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.2 }}>
                                {t('Total', 'Total')}
                              </Typography>
                              <Typography sx={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.25 }}>
                                {brl(valor)}
                              </Typography>
                              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.35 }}>
                                {t('Caixa', 'Cash')} {brl(caixaGaveta(dia))}
                              </Typography>
                            </>
                          ) : null}
                          {rotulo ? (
                            <Chip
                              size="small"
                              label={idioma === 'en' ? rotulo[1] : rotulo[0]}
                              variant="outlined"
                              sx={{
                                mt: 0.75,
                                height: 22,
                                fontSize: 11,
                                fontWeight: 500,
                                color: tom.color,
                                borderColor: tom.border,
                                bgcolor: tom.bg,
                              }}
                            />
                          ) : null}
                        </Box>
                      ) : null}
                    </Box>
                  )
                })}
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2.5, pb: 1.5, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
              {t('Resumo do dia', 'Day summary')}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>
              {lojaAtual?.apelido || lojaAtual?.razao_social || '—'}
              {dataPainel ? ` · ${dataPainel}` : ''}
            </Typography>
          </Box>

          <Box sx={{ px: 2.5, flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Metrica rotulo={t('Total', 'Total')} valor={brl(diaPainel ? totalDia(diaPainel) : 0)} />
            <Metrica rotulo={t('Dinheiro + PIX', 'Cash + PIX')} valor={brl(diaPainel ? gate(diaPainel) : 0)} />
            <Metrica rotulo={t('Sem dados', 'Missing days')} valor={String(faltando)} alerta={faltando > 0} />
            <Metrica rotulo={t('Fechados', 'Closed')} valor={String(fechados)} />
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('Por modalidade', 'By method')}
            </Typography>
            <LinhaPagamento tipo="dinheiro" cor="#3B82F6" rotulo={t('Dinheiro', 'Cash')} valor={brl(diaPainel?.dinheiro ?? 0)} />
            <LinhaPagamento tipo="pix" cor="#0EA5E9" rotulo="PIX" valor={brl(diaPainel?.pix ?? 0)} />
            <LinhaDebitoCredito
              rotulo={t('Débito', 'Debit')}
              valor={diaPainel?.debito ?? 0}
              cor="#8B5CF6"
              bandeiras={(diaPainel?.bandeiras || []).filter((item) => item.tipo === 'debito')}
              aberto={debitoAberto}
              onAbrir={() => setDebitoAberto((v) => !v)}
            />
            <LinhaDebitoCredito
              rotulo={t('Crédito', 'Credit')}
              valor={diaPainel?.credito ?? 0}
              cor="#4F46E5"
              bandeiras={(diaPainel?.bandeiras || []).filter((item) => item.tipo === 'credito')}
              aberto={creditoAberto}
              onAbrir={() => setCreditoAberto((v) => !v)}
            />
            {(diaPainel?.cart_digital || 0) > 0 ? (
              <LinhaPagamento tipo="cartoes" cor="#64748B" rotulo={t('Cartão digital', 'Digital card')} valor={brl(diaPainel?.cart_digital ?? 0)} />
            ) : null}
            <LinhaPagamento tipo="ifood" cor="#F59E0B" rotulo="iFood" valor={brl(diaPainel?.ifood ?? 0)} />
            <LinhaPagamento tipo="food99" cor="#FB7185" rotulo="99Food" valor={brl(diaPainel?.food99 ?? 0)} />
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1, pt: 1.25 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('Caixa', 'Cash drawer')}
              </Typography>
              <LinhaPagamento tipo="despesa" cor="#94A3B8" rotulo={t('Despesas', 'Expenses')} valor={brl(diaPainel?.despesas_caixa ?? 0)} />
              <LinhaPagamento tipo="deposito" cor="#22C55E" rotulo={t('Depósitos', 'Deposits')} valor={brl(diaPainel?.depositos_caixa ?? 0)} />
              <LinhaPagamento tipo="dinheiro" cor="#EAB308" rotulo={t('Dinheiro em caixa', 'Cash in drawer')} valor={brl(diaPainel ? caixaGaveta(diaPainel) : 0)} />
            </Box>
          </Box>
          </Box>

          <Box sx={{ flexShrink: 0, px: 2.5, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            {diaPainel && chegouDoPdv(diaPainel) && diaPainel.status === 'fechado' ? (
              <>
                <Chip size="small" label={t('Caixa fechado', 'Cash closed')} variant="outlined" sx={{ mb: 1, color: tomMap.fechado.color, borderColor: tomMap.fechado.border, bgcolor: tomMap.fechado.bg }} />
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                  {t('PDV travado. Despesas lançadas. Só consulta.', 'POS locked. Expenses posted. View only.')}
                </Typography>
              </>
            ) : diaPainel && chegouDoPdv(diaPainel) ? (
              <Button fullWidth variant="contained" onClick={() => setEditando(diaPainel)}>
                {t('Lançar despesa e fechar', 'Post expense and close')}
              </Button>
            ) : diaPainel && diaPainel.data < hoje ? (
              <Typography sx={{ fontSize: 13, color: 'error.main' }}>
                {t('O servidor não enviou as vendas deste dia.', 'The store did not send this day’s sales.')}
              </Typography>
            ) : (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                {t('Aguardando o envio do servidor da loja.', 'Waiting for the store server.')}
              </Typography>
            )}
          </Box>
        </Paper>
      </Box>

      {editando ? (
        <FormDespesa
          dia={editando}
          onFechar={() => setEditando(null)}
          onSalvo={(mensagem) => {
            const data = editando.data
            setEditando(null)
            setAviso(mensagem)
            api.caixaMes(mes, empresaId).then((dados) => {
              setMesDados(dados)
              setSelecionado(dados.dias.find((d) => d.data === data) || null)
            }).catch(() => carregar())
          }}
        />
      ) : null}

      <Snackbar open={!!aviso} autoHideDuration={3200} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
    </Stack>
  )
}

function novaLinha(tipo: 'despesa' | 'deposito'): LancamentoCaixa {
  return {
    tipo,
    valor: 0,
    valor_texto: '',
    plano_conta_id: null,
    fornecedor_id: null,
    numero: '',
    descricao: '',
    plano: '',
    fornecedor: '',
    comprovante_nome: '',
    tem_comprovante: false,
  }
}

function arquivoBase64(arquivo: File) {
  return new Promise<{ nome: string; mime: string; base64: string }>((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => {
      const texto = String(leitor.result || '')
      const base64 = texto.includes(',') ? texto.slice(texto.indexOf(',') + 1) : texto
      resolve({ nome: arquivo.name, mime: arquivo.type || 'application/octet-stream', base64 })
    }
    leitor.onerror = () => reject(new Error('Não leu o arquivo'))
    leitor.readAsDataURL(arquivo)
  })
}

function abrirBase64(arquivo: { nome: string; mime: string; base64: string }) {
  const binario = atob(arquivo.base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([bytes], { type: arquivo.mime }))
  window.open(url, '_blank', 'noopener')
}

function Kpi({
  rotulo,
  valor,
  icone,
  tom,
  alerta,
}: {
  rotulo: string
  valor: string
  icone: ReactNode
  tom: 'verde' | 'teal' | 'ambar'
  alerta?: boolean
}) {
  const paleta = {
    verde: { bg: 'rgba(16,185,129,0.12)', cor: '#059669', borda: 'rgba(16,185,129,0.28)' },
    teal: { bg: 'rgba(13,148,136,0.1)', cor: '#0F766E', borda: 'rgba(13,148,136,0.24)' },
    ambar: { bg: 'rgba(245,158,11,0.14)', cor: '#B45309', borda: 'rgba(245,158,11,0.4)' },
  }[tom]
  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{
        alignItems: 'center',
        px: 1.5,
        py: 1,
        minWidth: 148,
        borderRadius: 2,
        bgcolor: alerta ? 'rgba(220,38,38,0.08)' : paleta.bg,
        border: '1px solid',
        borderColor: alerta ? 'error.light' : paleta.borda,
      }}
    >
      <Box sx={{ color: alerta ? 'error.main' : paleta.cor, display: 'flex' }}>{icone}</Box>
      <Box>
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: alerta ? 'error.main' : paleta.cor }}>{rotulo}</Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, color: alerta ? 'error.main' : 'text.primary' }}>{valor}</Typography>
      </Box>
    </Stack>
  )
}

function FormDespesa({ dia, onFechar, onSalvo }: { dia: FechamentoDia; onFechar: () => void; onSalvo: (mensagem: string) => void }) {
  const { t, idioma, modo } = usePrefs()
  const escuro = modo === 'escuro'
  const [linhas, setLinhas] = useState<LancamentoCaixa[]>(
    (dia.lancamentos?.length ? dia.lancamentos : []).map((item) => ({
      ...item,
      valor_texto: item.valor ? dinheiroTexto(item.valor) : '',
    })),
  )
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [hits, setHits] = useState<Fornecedor[]>([])
  const [depositoAberto, setDepositoAberto] = useState(() => (dia.lancamentos || []).some((l) => l.tipo === 'deposito'))
  const [debitoAberto, setDebitoAberto] = useState(false)
  const [creditoAberto, setCreditoAberto] = useState(false)
  const fechado = dia.status === 'fechado'
  const dataBr = new Date(`${dia.data}T12:00:00`).toLocaleDateString(idioma === 'en' ? 'en-US' : 'pt-BR')
  const totalDespesas = linhas.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + (Number(l.valor) || 0), 0)
  const totalDepositos = linhas.filter((l) => l.tipo === 'deposito').reduce((s, l) => s + (Number(l.valor) || 0), 0)
  const saidas = Math.round((totalDespesas + totalDepositos) * 100) / 100
  const gaveta = Math.round((dia.dinheiro - saidas) * 100) / 100
  const campo = {
    width: '100%',
    '& .MuiInputBase-root': { height: 36 },
    '& .MuiInputBase-input': { fontSize: 13, py: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' },
  }
  const campoValor = {
    width: '100%',
    '& .MuiInputBase-root': { height: 36 },
    '& .MuiInputBase-input': { fontSize: 13, py: 0.75, fontVariantNumeric: 'tabular-nums', textAlign: 'right' },
  }

  const buscar = (texto: string) => {
    api.fornecedores(texto).then(setHits).catch(() => setHits([]))
  }

  const mudar = (indice: number, patch: Partial<LancamentoCaixa>) => {
    setLinhas((atual) => atual.map((item, i) => (i === indice ? { ...item, ...patch } : item)))
  }

  const anexar = async (indice: number, arquivo: File | undefined) => {
    if (!arquivo) return
    if (arquivo.size > 8 * 1024 * 1024) {
      setErro(t('Comprovante maior que 8 MB.', 'Receipt larger than 8 MB.'))
      return
    }
    try {
      const comprovante = await arquivoBase64(arquivo)
      mudar(indice, { comprovante, comprovante_nome: comprovante.nome, tem_comprovante: true, remover_comprovante: false })
    } catch {
      setErro(t('Não leu o comprovante.', 'Could not read the receipt.'))
    }
  }

  const payload = (status: 'rascunho' | 'fechado') => ({
    empresa_id: dia.empresa_id,
    data: dia.data,
    dinheiro: dia.dinheiro,
    pix: dia.pix,
    debito: dia.debito,
    credito: dia.credito,
    cart_digital: dia.cart_digital,
    ifood: dia.ifood,
    azul: dia.azul,
    rappi: dia.rappi,
    food99: dia.food99,
    lancamentos: linhas.map((item) => ({
      ...item,
      remover_comprovante: item.remover_comprovante === true,
    })),
    status,
  })

  const salvar = async (status: 'rascunho' | 'fechado') => {
    setErro('')
    setSalvando(true)
    try {
      await api.salvarCaixa(payload(status))
      onSalvo(status === 'fechado' ? t('Caixa fechado.', 'Cash closed.') : t('Lançamentos salvos.', 'Entries saved.'))
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não salvou', 'Could not save'))
    } finally {
      setSalvando(false)
    }
  }

  const modalidades = [
    ['dinheiro', t('Dinheiro', 'Cash'), dia.dinheiro, '#10B981'],
    ['pix', 'PIX', dia.pix, '#06B6D4'],
    ['ifood', 'iFood', dia.ifood, '#EF4444'],
    ['food99', '99Food', dia.food99, '#F59E0B'],
  ] as Array<[string, string, number, string]>
  const totalPdv = totalDia(dia)

  const abrirDeposito = () => {
    setDepositoAberto(true)
    setLinhas((atual) => (atual.some((l) => l.tipo === 'deposito') ? atual : [...atual, novaLinha('deposito')]))
  }

  const adicionar = (tipo: 'despesa' | 'deposito') => {
    if (tipo === 'deposito') setDepositoAberto(true)
    setLinhas((atual) => [...atual, novaLinha(tipo)])
  }

  const secao = (tipo: 'despesa' | 'deposito', titulo: string) => {
    const itens = linhas.map((item, indice) => ({ item, indice })).filter(({ item }) => item.tipo === tipo)
    const total = tipo === 'despesa' ? totalDespesas : totalDepositos
    const recolhido = tipo === 'deposito' && !depositoAberto
    return (
      <Paper variant="outlined" sx={{ overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
        <Stack
          direction="row"
          sx={{
            px: 1.75,
            py: 1.1,
            alignItems: 'center',
            borderBottom: recolhido ? 'none' : '1px solid',
            borderColor: 'divider',
            bgcolor: escuro ? 'rgba(255,255,255,0.03)' : '#FAFBFC',
          }}
        >
          {tipo === 'deposito' && !fechado ? (
            <IconButton
              size="small"
              onClick={() => (depositoAberto ? setDepositoAberto(false) : abrirDeposito())}
              aria-label={t('Preencher depósito', 'Fill deposit')}
              sx={{ mr: 0.5, transform: depositoAberto ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
            >
              <KeyboardArrowDownIcon fontSize="small" />
            </IconButton>
          ) : (
            <DescriptionOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary', mr: 1 }} />
          )}
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{titulo}</Typography>
          <Chip size="small" label={String(itens.length)} sx={{ ml: 1, height: 20, fontSize: 11 }} />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mr: 1 }}>{t('Total', 'Total')}</Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', mr: 1 }}>{brl(total)}</Typography>
          {!fechado ? (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => adicionar(tipo)}
            >
              {t('Adicionar', 'Add')}
            </Button>
          ) : null}
        </Stack>
        <Collapse in={!recolhido} unmountOnExit={false}>
          <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
            <TableHead>
              <TableRow>
                {tipo === 'despesa' ? (
                  <>
                    <TableCell sx={{ width: '36%' }}>{t('Fornecedor', 'Supplier')}</TableCell>
                    <TableCell sx={{ width: '40%' }}>{t('Descrição', 'Description')}</TableCell>
                  </>
                ) : (
                  <TableCell>{t('Descrição', 'Description')}</TableCell>
                )}
                <TableCell align="right" sx={{ width: 112 }}>{t('Valor', 'Amount')}</TableCell>
                {tipo === 'despesa' ? <TableCell align="center" sx={{ width: 44, px: 0 }}><AttachFileOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} /></TableCell> : null}
                <TableCell sx={{ width: 40, px: 0 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {!itens.length ? (
                <TableRow>
                  <TableCell colSpan={tipo === 'despesa' ? 5 : 3} sx={{ py: 4 }}>
                    <Stack spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                      <InsertDriveFileOutlinedIcon sx={{ fontSize: 32, opacity: 0.45 }} />
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        {tipo === 'despesa'
                          ? t('Nenhuma despesa registrada.', 'No expense recorded.')
                          : t('Nenhum depósito neste dia.', 'No deposits on this day.')}
                      </Typography>
                      <Typography sx={{ fontSize: 12 }}>
                        {tipo === 'despesa'
                          ? t('Clique em Adicionar para registrar uma despesa.', 'Click Add to record an expense.')
                          : t('Clique na seta ou em Adicionar para preencher o depósito.', 'Click the arrow or Add to fill the deposit.')}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : itens.map(({ item, indice }) => (
                <TableRow key={`${tipo}-${indice}`}>
                  {tipo === 'despesa' ? (
                    <>
                      <TableCell sx={{ py: 0.75, px: 1, width: '36%' }}>
                        <Autocomplete
                          size="small"
                          freeSolo
                          forcePopupIcon={false}
                          options={hits}
                          getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.nome}
                          filterOptions={(opcoes) => opcoes}
                          value={item.fornecedor || ''}
                          inputValue={item.fornecedor || ''}
                          onInputChange={(_, texto, motivo) => {
                            if (motivo === 'input') {
                              mudar(indice, { fornecedor: texto, fornecedor_id: null })
                              buscar(texto)
                            }
                          }}
                          onChange={(_, forn) => {
                            if (typeof forn === 'string') mudar(indice, { fornecedor: forn, fornecedor_id: null })
                            else mudar(indice, { fornecedor: forn?.nome || '', fornecedor_id: forn?.id || null })
                          }}
                          disabled={fechado}
                          renderInput={(params) => <TextField {...params} placeholder={t('Nome', 'Name')} sx={campo} />}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.75, px: 1, width: '40%' }}>
                        <TextField size="small" fullWidth value={item.descricao} disabled={fechado} onChange={(ev) => mudar(indice, { descricao: ev.target.value })} placeholder={t('O que foi pago', 'What was paid')} sx={campo} />
                      </TableCell>
                    </>
                  ) : (
                    <TableCell sx={{ py: 0.75, px: 1 }}>
                      <TextField size="small" fullWidth value={item.descricao} disabled={fechado} onChange={(ev) => mudar(indice, { descricao: ev.target.value })} placeholder={t('Sangria / depósito', 'Skim / deposit')} sx={campo} />
                    </TableCell>
                  )}
                  <TableCell align="right" sx={{ py: 0.75, px: 1, width: 112 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={item.valor_texto ?? (item.valor ? dinheiroTexto(item.valor) : '')}
                      disabled={fechado}
                      placeholder="0,00"
                      onChange={(ev) => {
                        const texto = mascararMoeda(ev.target.value)
                        mudar(indice, { valor_texto: texto, valor: lerDinheiro(texto) })
                      }}
                      onBlur={() => {
                        if (item.valor > 0) mudar(indice, { valor_texto: dinheiroTexto(item.valor) })
                      }}
                      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                      sx={campoValor}
                    />
                  </TableCell>
                  {tipo === 'despesa' ? (
                    <TableCell align="center" sx={{ py: 0.5, px: 0, width: 44 }}>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        <input
                          id={`comp-${indice}`}
                          type="file"
                          hidden
                          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                          onChange={(ev) => {
                            anexar(indice, ev.target.files?.[0])
                            ev.target.value = ''
                          }}
                        />
                        {item.tem_comprovante || item.comprovante ? (
                          <>
                            <Tooltip title={item.comprovante_nome || t('Comprovante', 'Receipt')}>
                              <Button
                                size="small"
                                onClick={() => {
                                  if (item.comprovante) abrirBase64(item.comprovante)
                                  else if (item.id) api.abrirComprovanteCaixa(item.id).catch((err) => setErro(err instanceof Error ? err.message : t('Não abriu', 'Could not open')))
                                }}
                                sx={{ minWidth: 0, px: 0.5, fontSize: 12, textTransform: 'none', maxWidth: 90 }}
                              >
                                {(item.comprovante_nome || t('Ver', 'View')).slice(0, 14)}
                              </Button>
                            </Tooltip>
                            {!fechado ? (
                              <IconButton
                                size="small"
                                onClick={() => mudar(indice, { comprovante: undefined, comprovante_nome: '', tem_comprovante: false, remover_comprovante: true })}
                                aria-label={t('Remover comprovante', 'Remove receipt')}
                              >
                                <CloseIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            ) : null}
                          </>
                        ) : !fechado ? (
                          <Tooltip title={t('Anexar comprovante', 'Attach receipt')}>
                            <IconButton size="small" onClick={() => document.getElementById(`comp-${indice}`)?.click()} aria-label={t('Anexar comprovante', 'Attach receipt')}>
                              <AttachFileOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>—</Typography>
                        )}
                      </Stack>
                    </TableCell>
                  ) : null}
                  <TableCell sx={{ py: 0.5, px: 0, width: 40 }}>
                    {!fechado ? (
                      <IconButton size="small" onClick={() => setLinhas((atual) => atual.filter((_, i) => i !== indice))} aria-label={t('Excluir', 'Delete')}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Collapse>
      </Paper>
    )
  }

  return (
    <Dialog open onClose={onFechar} maxWidth="xl" fullWidth slotProps={{ paper: { sx: { maxHeight: '92vh', maxWidth: 1280 } } }}>
      <DialogTitle sx={{ py: 1.75, px: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'primary.main', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <PointOfSaleOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.03em' }}>{t('Fechar caixa', 'Close cash')}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{dia.empresa} · {dataBr}</Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' } }}>
          <Kpi rotulo={t('Dinheiro PDV', 'POS cash')} valor={brl(dia.dinheiro)} tom="verde" icone={<CheckCircleOutlinedIcon fontSize="small" />} />
          <Kpi rotulo={t('Saídas', 'Outflows')} valor={brl(saidas)} tom="teal" icone={<TrendingUpIcon fontSize="small" />} />
          <Kpi rotulo={t('Dinheiro em caixa', 'Cash in drawer')} valor={brl(gaveta)} tom="ambar" alerta={gaveta < 0} icone={<AccountBalanceWalletOutlinedIcon fontSize="small" />} />
        </Stack>
        <IconButton onClick={onFechar}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: 2.5, py: 2, bgcolor: escuro ? 'background.default' : '#F4F6F8' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '340px minmax(0, 1fr)' }, gap: 1.5, alignItems: 'start' }}>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Stack direction="row" sx={{ px: 1.75, py: 1.15, alignItems: 'center', bgcolor: escuro ? 'primary.dark' : '#1B2A6B', color: '#fff' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('Vendas do PDV', 'POS sales')}</Typography>
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{brl(totalPdv)}</Typography>
            </Stack>
            <Box sx={{ px: 1.25, py: 0.75 }}>
              {modalidades.slice(0, 2).map(([tipo, nome, valor, cor]) => (
                <LinhaPagamento key={tipo} tipo={tipo} cor={cor} rotulo={nome} valor={brl(valor)} />
              ))}
              <LinhaDebitoCredito
                rotulo={t('Débito', 'Debit')}
                valor={dia.debito}
                cor="#8B5CF6"
                bandeiras={(dia.bandeiras || []).filter((item) => item.tipo === 'debito')}
                aberto={debitoAberto}
                onAbrir={() => setDebitoAberto((v) => !v)}
              />
              <LinhaDebitoCredito
                rotulo={t('Crédito', 'Credit')}
                valor={dia.credito}
                cor="#4F46E5"
                bandeiras={(dia.bandeiras || []).filter((item) => item.tipo === 'credito')}
                aberto={creditoAberto}
                onAbrir={() => setCreditoAberto((v) => !v)}
              />
              {dia.cart_digital > 0 ? (
                <LinhaPagamento tipo="cartoes" cor="#64748B" rotulo={t('Cartão digital', 'Digital card')} valor={brl(dia.cart_digital)} />
              ) : null}
              {modalidades.slice(2).map(([tipo, nome, valor, cor]) => (
                <LinhaPagamento key={tipo} tipo={tipo} cor={cor} rotulo={nome} valor={brl(valor)} />
              ))}
              <Box sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) max-content', columnGap: 1, alignItems: 'center', pt: 0.75, mt: 0.25, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box />
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('Total', 'Total')}</Typography>
                <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap' }}>{brl(totalPdv)}</Typography>
              </Box>
            </Box>
          </Paper>
          <Stack spacing={1.5}>
            {secao('despesa', t('Despesas de caixa', 'Cash expenses'))}
            {secao('deposito', t('Depósitos', 'Deposits'))}
            {fechado ? <Alert severity="info">{t('Dia fechado. Só consulta.', 'Day closed. View only.')}</Alert> : (
              <Alert icon={<InfoOutlinedIcon fontSize="inherit" />} severity="info" sx={{ py: 0.5 }}>
                {t('Revise as informações antes de fechar o caixa.', 'Review the information before closing the cash drawer.')}
              </Alert>
            )}
            {erro ? <Alert severity="error">{erro}</Alert> : null}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={onFechar}>{t('Cancelar', 'Cancel')}</Button>
        <Box sx={{ flex: 1 }} />
        {!fechado ? (
          <>
            <Button disabled={salvando} onClick={() => salvar('rascunho')}>{t('Salvar', 'Save')}</Button>
            <Button variant="contained" disabled={salvando} onClick={() => salvar('fechado')}>{t('Fechar caixa', 'Close cash')}</Button>
          </>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}
