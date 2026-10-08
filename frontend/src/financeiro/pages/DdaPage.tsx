import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { api, brl, type LinhaDda } from '../api'
import { usePrefs } from '../prefs'

function base64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binario)
}

function dataBr(iso: string) {
  if (!iso) return ''
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

type EstadoColeta = { ok: boolean; mensagem: string; criadas: number; em: string | null }

export function DdaPage() {
  const { t } = usePrefs()
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [linhas, setLinhas] = useState<LinhaDda[]>([])
  const [marcadas, setMarcadas] = useState<boolean[]>([])
  const [lendo, setLendo] = useState(false)
  const [subindo, setSubindo] = useState(false)
  const [coletando, setColetando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [sfg, setSfg] = useState<EstadoColeta | null>(null)
  const [bb, setBb] = useState<EstadoColeta | null>(null)

  const carregarEstados = () => {
    api.sfgDda().then(setSfg).catch(() => setSfg(null))
    api.bbDda().then(setBb).catch(() => setBb(null))
  }

  useEffect(() => {
    carregarEstados()
    const id = window.setInterval(carregarEstados, 8000)
    return () => window.clearInterval(id)
  }, [])

  const prontas = linhas.filter((linha, indice) => linha.pronto && marcadas[indice])

  const escolher = async (arquivo: File | undefined) => {
    if (!arquivo) return
    setErro('')
    setAviso('')
    setLendo(true)
    try {
      const previa = await api.previaDda(base64(await arquivo.arrayBuffer()))
      setLinhas(previa.linhas)
      setMarcadas(previa.linhas.map((linha) => linha.pronto))
    } catch (err) {
      setLinhas([])
      setMarcadas([])
      setErro(err instanceof Error ? err.message : t('Não leu o arquivo', 'Could not read the file'))
    } finally {
      setLendo(false)
      if (input.current) input.current.value = ''
    }
  }

  const subir = async () => {
    setSubindo(true)
    setErro('')
    try {
      const resultado = await api.importarDda(prontas)
      setAviso(resultado.criadas === 1 ? t('1 boleto importado.', '1 boleto imported.') : t(`${resultado.criadas} boletos importados.`, `${resultado.criadas} boletos imported.`))
      const previa = linhas.map((linha, indice) => (
        linha.pronto && marcadas[indice] ? { ...linha, pronto: false, motivo: 'Já lançado' } : linha
      ))
      setLinhas(previa)
      setMarcadas(previa.map(() => false))
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não importou', 'Import failed'))
    } finally {
      setSubindo(false)
    }
  }

  const puxarBb = async () => {
    setColetando(true)
    setErro('')
    try {
      await api.coletarBb()
      setAviso(t('Coleta do Banco do Brasil iniciada. Os títulos entram no Inbox DDA.', 'Banco do Brasil pull started. Titles land in the DDA inbox.'))
      window.setTimeout(carregarEstados, 2500)
      window.setTimeout(carregarEstados, 8000)
    } catch (err) {
      setErro(err instanceof Error ? err.message : t('Não iniciou a coleta', 'Could not start the pull'))
    } finally {
      setColetando(false)
    }
  }

  return (
    <Stack spacing={2} sx={{ height: '100%', minHeight: 0 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'flex-start' } }}>
        <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>
            {t(
              'Os boletos do DDA (Itaú e Banco do Brasil) entram no Inbox. Só vão para a Agenda banco depois da NF conferida.',
              'DDA boletos (Itaú and Banco do Brasil) land in the Inbox. They only move to the bank schedule after the invoice is checked.',
            )}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Itaú · </Box>
            {sfg?.mensagem || t('Aguardando a coleta.', 'Waiting for the next pull.')}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
            <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>BB · </Box>
            {bb?.mensagem || t('Aguardando a coleta.', 'Waiting for the next pull.')}
          </Typography>
        </Stack>
        <Button variant="outlined" onClick={() => navigate('/financeiro/inbox')}>
          {t('Abrir Inbox DDA', 'Open DDA inbox')}
        </Button>
        <Button variant="outlined" onClick={() => navigate('/financeiro/configuracoes')}>
          {t('Config BB / Itaú', 'BB / Itaú setup')}
        </Button>
        <Button variant="outlined" startIcon={<RefreshOutlinedIcon />} disabled={coletando} onClick={puxarBb}>
          {coletando ? t('Puxando BB…', 'Pulling BB…') : t('Puxar BB agora', 'Pull BB now')}
        </Button>
        <Button variant="contained" startIcon={<UploadFileOutlinedIcon />} disabled={lendo} onClick={() => input.current?.click()}>
          {lendo ? t('Lendo…', 'Reading…') : t('Escolher arquivo', 'Choose file')}
        </Button>
        <input ref={input} hidden type="file" accept=".xlsx,.xls,.csv,.ret,.txt,.rem" onChange={(ev) => escolher(ev.target.files?.[0])} />
      </Stack>

      {erro && <Alert severity="error">{erro}</Alert>}

      <Paper variant="outlined" sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>{t('Empresa', 'Company')}</TableCell>
              <TableCell>{t('Cedente', 'Payee')}</TableCell>
              <TableCell>{t('Vencimento', 'Due date')}</TableCell>
              <TableCell align="right">{t('Valor', 'Amount')}</TableCell>
              <TableCell>{t('Situação', 'Status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Box sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                    {t(
                      'Use “Puxar BB agora” ou suba um arquivo. Depois os títulos aparecem no Inbox DDA.',
                      'Use “Pull BB now” or upload a file. Titles then show in the DDA inbox.',
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {linhas.map((linha, indice) => (
              <TableRow key={`${linha.documento_ref}-${indice}`} hover selected={marcadas[indice]}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    disabled={!linha.pronto}
                    checked={!!marcadas[indice]}
                    onChange={(ev) => setMarcadas((atual) => atual.map((marcada, i) => i === indice ? ev.target.checked : marcada))}
                  />
                </TableCell>
                <TableCell>{linha.empresa || linha.sacado || '—'}</TableCell>
                <TableCell>
                  {linha.fornecedor || linha.cedente || '—'}
                  {linha.plano ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{linha.plano}</Typography> : null}
                </TableCell>
                <TableCell>{dataBr(linha.vencimento)}</TableCell>
                <TableCell align="right">{linha.valor == null ? '—' : brl(linha.valor)}</TableCell>
                <TableCell>
                  {linha.pronto && !linha.fornecedor_id
                    ? <Chip size="small" label={t('Sem fornecedor', 'No supplier')} variant="outlined" color="warning" sx={{ fontWeight: 500 }} />
                    : <Typography variant="body2" color={linha.pronto ? 'text.primary' : 'warning.main'}>{linha.pronto ? t('Fornecedor vinculado', 'Supplier linked') : linha.motivo}</Typography>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button variant="contained" disabled={!prontas.length || subindo} onClick={subir}>
          {subindo ? t('Subindo…', 'Importing…') : t(`Subir ${prontas.length} boleto${prontas.length === 1 ? '' : 's'}`, `Import ${prontas.length} boleto${prontas.length === 1 ? '' : 's'}`)}
        </Button>
      </Stack>

      <Snackbar open={!!aviso} autoHideDuration={4200} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
    </Stack>
  )
}
