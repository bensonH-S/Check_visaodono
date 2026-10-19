import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { api, brl, type MascaraReuniao, type MascaraReuniaoLoja } from '../api'
import { usePrefs } from '../prefs'
import { FIN_BORDER, FIN_MUTED, FIN_SURFACE, FIN_TEXT, finCampoSx, finPageSx } from '../temaFinanceiroEscuro'

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

export function ReuniaoSemanalPage() {
  const { t } = usePrefs()
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
    <Stack spacing={1.25} sx={finPageSx}>
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
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
          <ResumoMini
            rotulo={t('Venda período', 'Period sales')}
            valor={brl(dados.total.venda)}
          />
          <ResumoMini
            rotulo={t('Venda proj. 30d', 'Proj. 30d sales')}
            valor={brl(dados.total.venda_projetada)}
          />
          <ResumoMini rotulo={t('Gasto CMV', 'COGS spend')} valor={brl(dados.total.gasto)} />
          <ResumoMini
            rotulo={t('CMV atual', 'Current COGS')}
            valor={pctTxt(dados.total.cmv_atual)}
            cor={cmvTom(dados.total.cmv_atual)}
          />
        </Stack>
      ) : null}

      <Paper
        variant="outlined"
        sx={{ borderColor: FIN_BORDER, bgcolor: FIN_SURFACE, overflow: 'hidden' }}
      >
        <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={th}>{t('Loja', 'Store')}</TableCell>
                <TableCell align="right" sx={th}>
                  {t('Venda', 'Sales')}
                  <Typography component="span" display="block" sx={thSub}>
                    {t('período', 'period')}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={th}>
                  {t('Venda', 'Sales')}
                  <Typography component="span" display="block" sx={thSub}>
                    {t('proj. 30 dias', 'proj. 30 days')}
                  </Typography>
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

      <Typography variant="caption" sx={{ color: FIN_MUTED }}>
        {t(
          'Traffic, ticket, ratings iFood/99 e R.E.V. entram na próxima versão — a planilha original já tem essas colunas.',
          'Traffic, ticket, iFood/99 ratings and R.E.V. come in the next version — the original sheet already has those columns.',
        )}
      </Typography>
    </Stack>
  )
}

function ResumoMini({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        flex: 1,
        minWidth: 0,
        px: 1.5,
        py: 1.1,
        borderColor: FIN_BORDER,
        bgcolor: FIN_SURFACE,
      }}
    >
      <Typography sx={{ fontSize: 11, color: FIN_MUTED, fontWeight: 600 }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: cor || FIN_TEXT, lineHeight: 1.2 }}>
        {valor}
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

const thSub = { fontSize: 9, fontWeight: 600, color: FIN_MUTED, textTransform: 'none' } as const
