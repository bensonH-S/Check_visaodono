import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { assetUrl } from '../../config/paths'
import { api, brl, type LinhaDda } from '../api'
import { usePrefs } from '../prefs'

const LOGO_ITAU = assetUrl('brands/itau.webp')
const LOGO_BB = assetUrl('brands/banco-do-brasil.png')
import {
  FIN_BORDER,
  FIN_MUTED,
  FIN_SURFACE,
  FIN_TEXT,
  finBtnContainedSx,
  finBtnOutlinedSx,
  finPageSx,
  finPaperSx,
} from '../temaFinanceiroEscuro'

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

type EstadoColeta = {
  ok: boolean
  mensagem: string
  criadas: number
  em: string | null
  codigo?: string
  empresas?: number
  falhas?: number
  arquivos?: number
}

type Traduzir = (pt: string, en: string) => string

function mensagemEstado(estado: EstadoColeta | null, t: Traduzir): string {
  if (!estado) return t('Aguardando a coleta.', 'Waiting for the next pull.')

  const codigo = estado.codigo
  if (codigo === 'bb_nao_rodou') {
    return t('A coleta do Banco do Brasil ainda não rodou.', 'Banco do Brasil pull has not run yet.')
  }
  if (codigo === 'bb_sem_acesso') {
    return t(
      'Nenhuma empresa com acesso do Banco do Brasil em Configuração.',
      'No company has Banco do Brasil access in Settings.',
    )
  }
  if (codigo === 'bb_resumo') {
    const empresas = estado.empresas ?? 0
    const boletos = estado.criadas ?? 0
    const falhas = estado.falhas ?? 0
    const base = t(
      `${empresas} empresa(s) consultada(s) · ${boletos} boleto(s) novo(s)`,
      `${empresas} compan${empresas === 1 ? 'y' : 'ies'} checked · ${boletos} new boleto${boletos === 1 ? '' : 's'}`,
    )
    if (falhas > 0) {
      return `${base}${t(` · ${falhas} com erro.`, ` · ${falhas} with error.`)}`
    }
    return `${base}.`
  }
  if (codigo === 'itau_nao_rodou') {
    return t('A coleta da VAN do Itaú ainda não rodou.', 'Itaú VAN pull has not run yet.')
  }
  if (codigo === 'itau_sem_servidor') {
    return t(
      'Caixa postal do Itaú ainda não está neste servidor.',
      'Itaú mailbox is not configured on this server yet.',
    )
  }
  if (codigo === 'itau_vazio') {
    return t('VAN consultada. Nenhum retorno novo.', 'VAN checked. No new returns.')
  }
  if (codigo === 'itau_resumo') {
    const arquivos = estado.arquivos ?? 0
    const boletos = estado.criadas ?? 0
    return t(
      `${arquivos} arquivo(s) da VAN · ${boletos} boleto(s) novo(s).`,
      `${arquivos} VAN file${arquivos === 1 ? '' : 's'} · ${boletos} new boleto${boletos === 1 ? '' : 's'}.`,
    )
  }
  if (codigo === 'bb_erro' || codigo === 'itau_erro') {
    return estado.mensagem || t('Falha na coleta.', 'Pull failed.')
  }

  // Fallback: mensagens antigas do backend ainda sem `codigo`
  const mBb = estado.mensagem.match(
    /^(\d+) empresa\(s\) consultada\(s\),\s*(\d+) boleto\(s\) novo\(s\)(?:,\s*(\d+) com erro)?\.?$/,
  )
  if (mBb) {
    return mensagemEstado(
      {
        ...estado,
        codigo: 'bb_resumo',
        empresas: Number(mBb[1]),
        criadas: Number(mBb[2]),
        falhas: Number(mBb[3] || 0),
      },
      t,
    )
  }
  const mItau = estado.mensagem.match(/^(\d+) arquivo\(s\) da VAN,\s*(\d+) boleto\(s\) novo\(s\)\.?$/)
  if (mItau) {
    return mensagemEstado(
      {
        ...estado,
        codigo: 'itau_resumo',
        arquivos: Number(mItau[1]),
        criadas: Number(mItau[2]),
      },
      t,
    )
  }
  const fixas: Record<string, [string, string]> = {
    'A coleta do Banco do Brasil ainda não rodou.': [
      'A coleta do Banco do Brasil ainda não rodou.',
      'Banco do Brasil pull has not run yet.',
    ],
    'A coleta da VAN do Itaú ainda não rodou.': [
      'A coleta da VAN do Itaú ainda não rodou.',
      'Itaú VAN pull has not run yet.',
    ],
    'Nenhuma empresa com acesso do Banco do Brasil em Configuração.': [
      'Nenhuma empresa com acesso do Banco do Brasil em Configuração.',
      'No company has Banco do Brasil access in Settings.',
    ],
    'Caixa postal do Itaú ainda não está neste servidor.': [
      'Caixa postal do Itaú ainda não está neste servidor.',
      'Itaú mailbox is not configured on this server yet.',
    ],
    'VAN consultada. Nenhum retorno novo.': [
      'VAN consultada. Nenhum retorno novo.',
      'VAN checked. No new returns.',
    ],
  }
  const par = fixas[estado.mensagem]
  if (par) return t(par[0], par[1])
  return estado.mensagem
}

function CardBanco({
  nome,
  mensagem,
  ok,
  logo,
}: {
  nome: string
  mensagem: string
  ok?: boolean
  logo: string
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        flex: 1,
        minWidth: 220,
        p: 1.5,
        bgcolor: FIN_SURFACE,
        borderColor: FIN_BORDER,
        color: FIN_TEXT,
        borderRadius: '10px',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '8px',
            bgcolor: '#fff',
            border: `1px solid ${FIN_BORDER}`,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            p: 0.4,
          }}
        >
          <Box
            component="img"
            src={logo}
            alt=""
            sx={{
              width: 22,
              height: 22,
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>
        <Typography sx={{ fontSize: 13, fontWeight: 650, color: FIN_TEXT }}>{nome}</Typography>
        <Chip
          size="small"
          label={ok ? 'OK' : '…'}
          sx={{
            height: 20,
            fontSize: 10,
            fontWeight: 700,
            ml: 'auto',
            bgcolor: ok ? 'rgba(16,185,129,0.12)' : 'rgba(15,23,42,0.04)',
            color: ok ? '#047857' : FIN_MUTED,
            border: '1px solid',
            borderColor: ok ? 'rgba(16,185,129,0.35)' : FIN_BORDER,
          }}
        />
      </Stack>
      <Typography sx={{ fontSize: 12, color: FIN_MUTED, lineHeight: 1.45 }}>{mensagem}</Typography>
    </Paper>
  )
}

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
        linha.pronto && marcadas[indice] ? { ...linha, pronto: false, motivo: t('Já lançado', 'Already posted') } : linha
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
    <Stack spacing={1.75} sx={finPageSx}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.25}
        sx={{ alignItems: { md: 'center' } }}
      >
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13, color: FIN_MUTED, lineHeight: 1.45 }}>
          {t(
            'Os boletos do DDA (Itaú e Banco do Brasil) entram no Inbox. Só vão para a Agenda banco depois da NF conferida.',
            'DDA boletos (Itaú and Banco do Brasil) land in the Inbox. They only move to the bank schedule after the invoice is checked.',
          )}
        </Typography>
        <Button
          type="button"
          size="small"
          variant="outlined"
          startIcon={<InboxOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/financeiro/inbox')}
          sx={finBtnOutlinedSx}
        >
          {t('Abrir inbox', 'Open inbox')}
        </Button>
        <Button
          type="button"
          size="small"
          variant="outlined"
          startIcon={<SettingsOutlinedIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/financeiro/configuracoes')}
          sx={finBtnOutlinedSx}
        >
          {t('Config BB / Itaú', 'BB / Itaú setup')}
        </Button>
        <Button
          type="button"
          size="small"
          variant="outlined"
          startIcon={<RefreshOutlinedIcon sx={{ fontSize: 16 }} />}
          disabled={coletando}
          onClick={puxarBb}
          sx={finBtnOutlinedSx}
        >
          {coletando ? t('Puxando BB…', 'Pulling BB…') : t('Puxar BB agora', 'Pull BB now')}
        </Button>
        <Button
          type="button"
          size="small"
          variant="contained"
          startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
          disabled={lendo}
          onClick={() => input.current?.click()}
          sx={finBtnContainedSx}
        >
          {lendo ? t('Lendo…', 'Reading…') : t('Escolher arquivo', 'Choose file')}
        </Button>
        <input ref={input} hidden type="file" accept=".xlsx,.xls,.csv,.ret,.txt,.rem" onChange={(ev) => escolher(ev.target.files?.[0])} />
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
        <CardBanco
          nome="Itaú"
          logo={LOGO_ITAU}
          ok={!!sfg?.ok}
          mensagem={mensagemEstado(sfg, t)}
        />
        <CardBanco
          nome="Banco do Brasil"
          logo={LOGO_BB}
          ok={!!bb?.ok}
          mensagem={mensagemEstado(bb, t)}
        />
      </Stack>

      {erro && (
        <Alert severity="error" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: 12 } }}>
          {erro}
        </Alert>
      )}

      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...finPaperSx,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ width: 48 }} />
                <TableCell align="center">{t('Empresa', 'Company')}</TableCell>
                <TableCell>{t('Cedente', 'Payee')}</TableCell>
                <TableCell align="center">{t('Vencimento', 'Due date')}</TableCell>
                <TableCell align="center">{t('Valor', 'Amount')}</TableCell>
                <TableCell align="center">{t('Situação', 'Status')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ border: 0, py: 0 }}>
                    <EstadoVazio
                      icone={<AccountBalanceWalletOutlinedIcon sx={{ fontSize: 40 }} />}
                      titulo={t('Nenhum arquivo na prévia', 'No file in preview')}
                      texto={t(
                        'Use “Puxar BB agora” ou suba um arquivo. Depois os títulos aparecem no Inbox DDA.',
                        'Use “Pull BB now” or upload a file. Titles then show in the DDA inbox.',
                      )}
                    />
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
                      onChange={(ev) => setMarcadas((atual) => atual.map((marcada, i) => (i === indice ? ev.target.checked : marcada)))}
                      sx={{
                        color: FIN_MUTED,
                        '&.Mui-checked': { color: '#1B6EF3' },
                        '&.Mui-disabled': { color: 'rgba(148,163,184,0.35)' },
                      }}
                    />
                  </TableCell>
                  <TableCell align="center" sx={{ color: FIN_TEXT }}>
                    {linha.empresa || linha.sacado || '—'}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: FIN_TEXT }}>
                      {linha.fornecedor || linha.cedente || '—'}
                    </Typography>
                    {linha.plano ? (
                      <Typography sx={{ fontSize: 11, color: FIN_MUTED, display: 'block' }}>{linha.plano}</Typography>
                    ) : null}
                  </TableCell>
                  <TableCell align="center" sx={{ fontVariantNumeric: 'tabular-nums', color: FIN_TEXT }}>
                    {dataBr(linha.vencimento)}
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: FIN_TEXT }}>
                    {linha.valor == null ? '—' : brl(linha.valor)}
                  </TableCell>
                  <TableCell align="center">
                    {linha.pronto && !linha.fornecedor_id ? (
                      <Chip
                        size="small"
                        label={t('Sem fornecedor', 'No supplier')}
                        variant="outlined"
                        sx={{
                          height: 22,
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#FDE68A',
                          borderColor: 'rgba(250,204,21,0.45)',
                          bgcolor: 'rgba(250,204,21,0.12)',
                        }}
                      />
                    ) : (
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: linha.pronto ? '#047857' : '#B45309',
                        }}
                      >
                        {linha.pronto ? t('Fornecedor vinculado', 'Supplier linked') : linha.motivo}
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        <Stack
          direction="row"
          spacing={1}
          sx={{
            flexShrink: 0,
            justifyContent: 'flex-end',
            alignItems: 'center',
            px: 1.5,
            py: 1.25,
            borderTop: '1px solid',
            borderColor: FIN_BORDER,
            bgcolor: FIN_SURFACE,
          }}
        >
          <Typography sx={{ fontSize: 12, color: FIN_MUTED, mr: 'auto' }}>
            {t(`${prontas.length} selecionado(s)`, `${prontas.length} selected`)}
          </Typography>
          <Button
            type="button"
            size="small"
            variant="contained"
            disabled={!prontas.length || subindo}
            onClick={subir}
            sx={finBtnContainedSx}
          >
            {subindo
              ? t('Subindo…', 'Importing…')
              : t(`Subir ${prontas.length} boleto${prontas.length === 1 ? '' : 's'}`, `Import ${prontas.length} boleto${prontas.length === 1 ? '' : 's'}`)}
          </Button>
        </Stack>
      </Paper>

      <Snackbar open={!!aviso} autoHideDuration={4200} onClose={() => setAviso('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAviso('')}>{aviso}</Alert>
      </Snackbar>
    </Stack>
  )
}

function EstadoVazio({
  icone,
  titulo,
  texto,
}: {
  icone: ReactNode
  titulo: string
  texto: string
}) {
  return (
    <Box
      sx={{
        py: 5.5,
        px: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1,
      }}
    >
      <Box sx={{ color: 'rgba(100,116,139,0.7)', display: 'flex', mb: 0.5 }}>{icone}</Box>
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: FIN_TEXT, letterSpacing: '-0.02em' }}>
        {titulo}
      </Typography>
      <Typography sx={{ fontSize: 13, color: FIN_MUTED, maxWidth: 460, lineHeight: 1.55 }}>
        {texto}
      </Typography>
    </Box>
  )
}
