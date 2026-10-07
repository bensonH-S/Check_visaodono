import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { api, brl, type ResumoVendas } from '../api'
import { usePrefs } from '../prefs'

function hoje() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function qtde(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function quando(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function VendasPage() {
  const { t } = usePrefs()
  const [dia, setDia] = useState(hoje)
  const [resumo, setResumo] = useState<ResumoVendas | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    const carregar = async () => {
      try {
        const data = await api.vendas(dia)
        if (!vivo) return
        setResumo(data)
        setErro('')
      } catch (err) {
        if (!vivo) return
        setErro(err instanceof Error ? err.message : t('Não carregou as vendas', 'Could not load sales'))
      }
    }
    carregar()
    const timer = setInterval(carregar, 20000)
    return () => {
      vivo = false
      clearInterval(timer)
    }
  }, [dia])

  const lojas = resumo?.lojas ?? []
  const sync = resumo?.ultimo_sync

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
        <TextField
          label={t('Dia', 'Day')}
          type="date"
          size="small"
          value={dia}
          onChange={(event) => setDia(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Box sx={{ flex: 1 }} />
        <Typography variant="body2" color="text.secondary">
          {lojas.length} {t('lojas', 'stores')} · {brl(resumo?.venda_bruta ?? 0)} {t('bruto', 'gross')}
          {sync?.criado_em ? ` · ${quando(sync.criado_em)}` : ''}
        </Typography>
      </Stack>

      {erro ? <Alert severity="error">{erro}</Alert> : null}
      {!erro && sync && !sync.ok ? <Alert severity="warning">{sync.mensagem}</Alert> : null}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>BKN</TableCell>
              <TableCell>{t('Loja', 'Store')}</TableCell>
              <TableCell align="right">{t('Produtos', 'Products')}</TableCell>
              <TableCell align="right">{t('Quantidade', 'Quantity')}</TableCell>
              <TableCell align="right">{t('Bruto', 'Gross')}</TableCell>
              <TableCell align="right">{t('Líquido', 'Net')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lojas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    {t('Nenhuma venda neste dia.', 'No sales on this day.')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : lojas.map((loja) => (
              <TableRow key={loja.bk_number} hover>
                <TableCell>{loja.bk_number}</TableCell>
                <TableCell>{loja.restaurante}</TableCell>
                <TableCell align="right">{loja.linhas}</TableCell>
                <TableCell align="right">{qtde(loja.quantidade)}</TableCell>
                <TableCell align="right">{brl(loja.venda_bruta)}</TableCell>
                <TableCell align="right">{brl(loja.venda_liquida)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  )
}
