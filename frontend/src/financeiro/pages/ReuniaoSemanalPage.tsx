import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined'
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import {
  api,
  brl,
  type MascaraReuniao,
  type MascaraReuniaoLoja,
  type PlatlogNfesExport,
  type PlatlogNfesLista,
} from '../api'
import { usePrefs } from '../prefs'
import {
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_TEXT,
  finBtnOutlinedSx,
  finCampoSx,
  finPageSx,
} from '../temaFinanceiroEscuro'

function hojeSp() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function dePadrao30() {
  const ate = hojeSp()
  const d = new Date(`${ate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 29)
  return d.toISOString().slice(0, 10)
}

function pctTxt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return '—'
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`
}

function numTxt(v: number | null | undefined, digitos = 0) {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('pt-BR', { maximumFractionDigits: digitos, minimumFractionDigits: digitos })
}

function cmvTom(v: number | null | undefined) {
  if (v == null) return FIN_MUTED
  if (v <= 0.32) return '#047857'
  if (v <= 0.4) return '#B45309'
  return '#B91C1C'
}

const tabsSx = {
  minHeight: 36,
  '& .MuiTabs-indicator': { bgcolor: '#1B6EF3' },
  '& .MuiTab-root': {
    minHeight: 36,
    py: 0,
    px: 1.5,
    fontSize: 13,
    textTransform: 'none',
    gap: 0.75,
    color: FIN_MUTED,
    alignItems: 'center',
    '&.Mui-selected': { color: FIN_TEXT },
  },
  '& .MuiTab-iconWrapper': { mb: '0 !important', mr: 0, display: 'inline-flex', alignItems: 'center' },
} as const

export function ReuniaoSemanalPage() {
  const { t } = usePrefs()
  const [aba, setAba] = useState(0)

  return (
    <Stack spacing={1.25} sx={finPageSx}>
      <Tabs value={aba} onChange={(_, v) => setAba(v)} sx={tabsSx}>
        <Tab
          icon={<AssessmentOutlinedIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={t('Máscara CMV', 'COGS mask')}
        />
        <Tab
          icon={<LocalShippingOutlinedIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={t('NFs Platlog', 'Platlog NFs')}
        />
      </Tabs>

      {aba === 0 ? <AbaMascara t={t} /> : null}
      {aba === 1 ? <AbaPlatlog t={t} /> : null}
    </Stack>
  )
}

function AbaMascara({ t }: { t: (pt: string, en: string) => string }) {
  const [de, setDe] = useState(dePadrao30)
  const [ate, setAte] = useState(hojeSp)
  const [dados, setDados] = useState<MascaraReuniao | null>(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let vivo = true
    setLoading(true)
    api
      .mascaraReuniao({ de, ate })
      .then((data) => {
        if (!vivo) return
        setDados(data)
        setErro('')
      })
      .catch((err) => {
        if (!vivo) return
        setDados(null)
        setErro(err instanceof Error ? err.message : t('Não carregou a máscara', 'Could not load the mask'))
      })
      .finally(() => {
        if (vivo) setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [de, ate, t])

  const linhas = useMemo(() => {
    if (!dados) return [] as MascaraReuniaoLoja[]
    return [...dados.lojas, dados.total]
  }, [dados])

  return (
    <Stack spacing={1.25}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
        <TextField
          size="small"
          type="date"
          label={t('De', 'From')}
          value={de}
          onChange={(ev) => setDe(ev.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ ...finCampoSx, width: 160 }}
        />
        <TextField
          size="small"
          type="date"
          label={t('Até', 'To')}
          value={ate}
          onChange={(ev) => setAte(ev.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ ...finCampoSx, width: 160 }}
        />
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" sx={{ color: FIN_MUTED, fontSize: 12 }}>
          {t(
            'CMV = Platlog + Coca/Brasal + Gimba + Ideal Work',
            'COGS = Platlog + Coke/Brasal + Gimba + Ideal Work',
          )}
        </Typography>
      </Stack>

      {loading ? <LinearProgress sx={{ borderRadius: 1 }} /> : null}
      {erro ? <Alert severity="error">{erro}</Alert> : null}

      {dados ? (
        <Stack direction="row" spacing={1.25} sx={{ width: '100%', alignItems: 'stretch' }}>
          <Resumo
            cor="#1B6EF3"
            rotulo={t('Venda período', 'Period sales')}
            valor={brl(dados.total.venda)}
            detalhe={t(`${dados.janela_dias} dias`, `${dados.janela_dias} days`)}
          />
          <Resumo
            cor="#6366F1"
            rotulo={t('Venda proj. 30d', 'Proj. 30d sales')}
            valor={brl(dados.total.venda_projetada)}
            detalhe={t('extrapolação', 'extrapolation')}
          />
          <Resumo
            cor="#B45309"
            rotulo={t('Gasto CMV', 'COGS spend')}
            valor={brl(dados.total.gasto)}
            detalhe={t('4 fornecedores', '4 suppliers')}
          />
          <Resumo
            cor={cmvTom(dados.total.cmv_atual) === FIN_MUTED ? '#1B6EF3' : cmvTom(dados.total.cmv_atual)}
            rotulo={t('CMV atual', 'Current COGS')}
            valor={pctTxt(dados.total.cmv_atual)}
            detalhe={t('gasto ÷ venda', 'spend ÷ sales')}
            alerta={dados.total.cmv_atual != null && dados.total.cmv_atual > 0.4}
          />
        </Stack>
      ) : null}

      <Paper
        variant="outlined"
        sx={{ borderColor: FIN_BORDER, bgcolor: FIN_SURFACE, overflow: 'hidden' }}
      >
        <TableContainer sx={{ maxHeight: 'calc(100vh - 320px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={th}>{t('Loja', 'Store')}</TableCell>
                <TableCell align="right" sx={th}>
                  {t('Venda', 'Sales')}
                  <Box component="span" sx={thSub}>
                    {t('período', 'period')}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={th}>
                  {t('Venda', 'Sales')}
                  <Box component="span" sx={thSub}>
                    {t('proj. 30 dias', 'proj. 30 days')}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={th}>
                  {t('Gasto CMV', 'COGS')}
                </TableCell>
                <TableCell align="right" sx={th}>
                  {t('CMV atual', 'COGS now')}
                </TableCell>
                <TableCell align="right" sx={th}>
                  {t('CMV proj.', 'COGS proj.')}
                </TableCell>
                <TableCell align="right" sx={th}>
                  Platlog
                </TableCell>
                <TableCell align="right" sx={th}>
                  Coca
                </TableCell>
                <TableCell align="right" sx={th}>
                  Gimba
                </TableCell>
                <TableCell align="right" sx={th}>
                  {t('Uniforme', 'Uniform')}
                </TableCell>
                <TableCell align="right" sx={th}>
                  {t('Dias', 'Days')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11}>
                    <Typography variant="body2" sx={{ color: FIN_MUTED, py: 2 }}>
                      {t('Sem dados no período.', 'No data in this period.')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
              {linhas.map((r) => {
                const total = r.bk === 'Total'
                return (
                  <TableRow
                    key={r.bk}
                    hover={!total}
                    sx={total ? { bgcolor: 'rgba(27,110,243,0.06)', '& td': { fontWeight: 700 } } : undefined}
                  >
                    <TableCell>
                      <Typography sx={{ fontSize: 13, fontWeight: total ? 800 : 600, color: FIN_TEXT }}>
                        {r.bk === 'Total' ? t('Total', 'Total') : r.bk}
                      </Typography>
                      {!total ? (
                        <Typography sx={{ fontSize: 11, color: FIN_MUTED }}>{r.loja}</Typography>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">{brl(r.venda)}</TableCell>
                    <TableCell align="right">{brl(r.venda_projetada)}</TableCell>
                    <TableCell align="right">{brl(r.gasto)}</TableCell>
                    <TableCell align="right" sx={{ color: cmvTom(r.cmv_atual), fontWeight: 700 }}>
                      {pctTxt(r.cmv_atual)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: cmvTom(r.cmv_projetado) }}>
                      {pctTxt(r.cmv_projetado)}
                    </TableCell>
                    <TableCell align="right">{brl(r.gasto_platlog)}</TableCell>
                    <TableCell align="right">{brl(r.gasto_coca)}</TableCell>
                    <TableCell align="right">{brl(r.gasto_gimba)}</TableCell>
                    <TableCell align="right">{brl(r.gasto_uniforme)}</TableCell>
                    <TableCell align="right">{numTxt(r.dias_venda)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  )
}

function AbaPlatlog({ t }: { t: (pt: string, en: string) => string }) {
  const [de, setDe] = useState('2026-08-01')
  const [ate, setAte] = useState('2026-10-31')
  const [dados, setDados] = useState<PlatlogNfesLista | null>(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(true)
  const [exportando, setExportando] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [resultado, setResultado] = useState<PlatlogNfesExport | null>(null)

  useEffect(() => {
    let vivo = true
    setLoading(true)
    setResultado(null)
    api
      .platlogNfes(de, ate)
      .then((data) => {
        if (!vivo) return
        setDados(data)
        setErro('')
      })
      .catch((err) => {
        if (!vivo) return
        setDados(null)
        setErro(err instanceof Error ? err.message : t('Não listou as NFs', 'Could not list NFs'))
      })
      .finally(() => {
        if (vivo) setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [de, ate, t])

  async function gerarPasta() {
    setExportando(true)
    setErro('')
    try {
      const r = await api.exportarPlatlogNfes(de, ate)
      setResultado(r)
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não exportou', 'Export failed'))
    } finally {
      setExportando(false)
    }
  }

  async function baixarZip() {
    setBaixando(true)
    setErro('')
    try {
      await api.baixarPlatlogNfesZip(de, ate)
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não baixou o ZIP', 'ZIP download failed'))
    } finally {
      setBaixando(false)
    }
  }

  return (
    <Stack spacing={1.25}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ alignItems: { sm: 'center' } }}>
        <TextField
          size="small"
          type="date"
          label={t('Emissão de', 'Issued from')}
          value={de}
          onChange={(ev) => setDe(ev.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ ...finCampoSx, width: 160 }}
        />
        <TextField
          size="small"
          type="date"
          label={t('Até', 'To')}
          value={ate}
          onChange={(ev) => setAte(ev.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ ...finCampoSx, width: 160 }}
        />
        <Box sx={{ flex: 1 }} />
        <Button
          type="button"
          size="small"
          variant="outlined"
          disabled={loading || exportando || !dados?.total}
          onClick={() => void gerarPasta()}
          sx={finBtnOutlinedSx}
        >
          {exportando
            ? t('Gerando DANFEs…', 'Building DANFEs…')
            : t('Gerar pasta DANFE', 'Build DANFE folder')}
        </Button>
        <Button
          type="button"
          size="small"
          variant="contained"
          disableElevation
          startIcon={<FolderZipOutlinedIcon sx={{ fontSize: 18 }} />}
          disabled={loading || baixando || !dados?.com_xml}
          onClick={() => void baixarZip()}
          sx={{ bgcolor: '#1B6EF3', textTransform: 'none', fontWeight: 600, '&:hover': { bgcolor: '#1558C4' } }}
        >
          {baixando
            ? t('Montando ZIP…', 'Building ZIP…')
            : t('Baixar DANFEs (ZIP)', 'Download DANFEs (ZIP)')}
        </Button>
      </Stack>

      {loading ? <LinearProgress sx={{ borderRadius: 1 }} /> : null}
      {erro ? <Alert severity="error">{erro}</Alert> : null}
      {resultado ? (
        <Alert severity="success">
          {t(
            `Pasta pronta: ${resultado.pasta} — ${resultado.copiados} DANFE(s) por loja (numero-loja-data.pdf)${resultado.faltando_xml ? `, ${resultado.faltando_xml} sem XML` : ''}.`,
            `Folder ready: ${resultado.pasta} — ${resultado.copiados} DANFE(s) per store${resultado.faltando_xml ? `, ${resultado.faltando_xml} missing XML` : ''}.`,
          )}
        </Alert>
      ) : null}

      {dados ? (
        <Stack direction="row" spacing={1.25} sx={{ width: '100%', alignItems: 'stretch' }}>
          <Resumo
            cor="#1B6EF3"
            rotulo={t('NFs cruzadas', 'Matched NFs')}
            valor={numTxt(dados.total)}
            detalhe={t(
              `eSupri∩Receita ${dados.cruzamento?.ambas ?? '—'}`,
              `eSupri∩Tax ${dados.cruzamento?.ambas ?? '—'}`,
            )}
          />
          <Resumo
            cor="#10B981"
            rotulo={t('Com XML', 'With XML')}
            valor={numTxt(dados.com_xml)}
            detalhe={t('prontos p/ DANFE', 'ready for DANFE')}
          />
          <Resumo
            cor={dados.sem_xml > 0 ? '#EF4444' : '#64748B'}
            rotulo={t('Sem XML', 'Missing XML')}
            valor={numTxt(dados.sem_xml)}
            detalhe={t('falta baixar', 'need download')}
            alerta={dados.sem_xml > 0}
          />
          <Resumo
            cor="#B45309"
            rotulo={t('Valor total', 'Total value')}
            valor={brl(dados.valor)}
            detalhe={t('soma das NFs', 'NF sum')}
          />
        </Stack>
      ) : null}

      {dados?.por_mes?.length ? (
        <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap' }}>
          {dados.por_mes.map((m) => (
            <Paper
              key={m.mes}
              variant="outlined"
              sx={{ px: 1.25, py: 0.65, borderColor: FIN_BORDER, bgcolor: FIN_SURFACE }}
            >
              <Typography sx={{ fontSize: 11, color: FIN_MUTED, fontWeight: 600 }}>{m.mes}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: FIN_TEXT }}>
                {m.qtd} NF · {brl(m.valor)}
              </Typography>
            </Paper>
          ))}
        </Stack>
      ) : null}

      <Paper
        variant="outlined"
        sx={{ borderColor: FIN_BORDER, bgcolor: FIN_SURFACE, overflow: 'hidden' }}
      >
        <TableContainer sx={{ maxHeight: 'calc(100vh - 360px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={th}>{t('Emissão', 'Issued')}</TableCell>
                <TableCell sx={th}>{t('NF', 'NF')}</TableCell>
                <TableCell sx={th}>{t('Loja', 'Store')}</TableCell>
                <TableCell align="right" sx={th}>
                  {t('Valor', 'Amount')}
                </TableCell>
                <TableCell sx={th}>XML</TableCell>
                <TableCell sx={th}>{t('Status', 'Status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && (!dados || dados.notas.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" sx={{ color: FIN_MUTED, py: 2 }}>
                      {t('Nenhuma NF Platlog no período.', 'No Platlog NFs in this period.')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
              {(dados?.notas || []).map((n) => (
                <TableRow key={n.id_nfe} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{n.emissao}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: FIN_TEXT }}>
                      {n.numero ?? '—'}
                    </Typography>
                    {n.chave ? (
                      <Typography sx={{ fontSize: 10, color: FIN_MUTED, fontFamily: 'ui-monospace, monospace' }}>
                        …{String(n.chave).slice(-12)}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: FIN_TEXT }}>
                      {n.bk || n.id_loja}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: FIN_MUTED }}>{n.loja}</Typography>
                  </TableCell>
                  <TableCell align="right">{brl(n.valor_total)}</TableCell>
                  <TableCell>
                    <Typography
                      sx={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: n.tem_xml ? '#047857' : '#B91C1C',
                      }}
                    >
                      {n.tem_xml ? t('OK', 'OK') : t('Falta', 'Missing')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12, color: FIN_MUTED }}>
                      {n.status_entrega || '—'}
                      {n.entrada_registrada ? ` · ${t('entrada', 'received')}` : ''}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
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
        ...(alerta
          ? {
              bgcolor: 'rgba(239,68,68,0.12)',
            }
          : {}),
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
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: alerta ? '#B91C1C' : FIN_MUTED,
        }}
      >
        {rotulo}
      </Typography>
      <Typography
        sx={{
          fontSize: 15,
          fontWeight: 650,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.15,
          color: alerta ? '#B91C1C' : FIN_TEXT,
        }}
      >
        {valor}
      </Typography>
      <Typography sx={{ fontSize: 11, fontWeight: 400, color: alerta ? '#B91C1C' : FIN_MUTED }}>
        {detalhe}
      </Typography>
    </Paper>
  )
}

const th = {
  bgcolor: '#F8FAFC',
  color: FIN_MUTED,
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  borderBottom: `1px solid ${FIN_BORDER}`,
} as const

const thSub = {
  display: 'block',
  fontSize: 9,
  fontWeight: 600,
  color: FIN_MUTED,
  textTransform: 'none',
} as const
