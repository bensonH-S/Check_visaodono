import { useMemo, useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import MenuItem from '@mui/material/MenuItem'
import Snackbar from '@mui/material/Snackbar'
import Chip from '@mui/material/Chip'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import { usePrefs } from '../prefs'

export function cnpjFormatado(valor: string | null | undefined) {
  const d = String(valor || '').replace(/\D/g, '')
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  return valor || '—'
}

export function quando(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const TONS = {
  ok: { color: '#047857', border: 'rgba(5,150,105,0.45)', bg: 'rgba(5,150,105,0.12)' },
  alerta: { color: '#C2410C', border: 'rgba(232,82,10,0.4)', bg: '#FFF7F3' },
  erro: { color: '#B91C1C', border: 'rgba(220,38,38,0.4)', bg: 'rgba(220,38,38,0.08)' },
  info: { color: '#1B2A6B', border: 'rgba(27,42,107,0.28)', bg: 'rgba(27,42,107,0.08)' },
  neutro: { color: '#4B5563', border: '#D1D5DB', bg: 'transparent' },
}

export type Tom = keyof typeof TONS

export function Selo({ texto, tom }: { texto: string; tom: Tom }) {
  const t = TONS[tom]
  return <Chip size="small" label={texto} variant="outlined" sx={{ color: t.color, borderColor: t.border, bgcolor: t.bg, fontWeight: 500 }} />
}

export function Resumo({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: '1 1 180px', minWidth: 180 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 500 }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', mt: 0.25 }}>{valor}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{detalhe}</Typography>
    </Paper>
  )
}

export function Resumos({ children }: { children: ReactNode }) {
  return <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>{children}</Stack>
}

export function Barra({ busca, onBusca, placeholder, children }: {
  busca?: string
  onBusca?: (valor: string) => void
  placeholder?: string
  children?: ReactNode
}) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'center' } }}>
      {onBusca ? (
        <TextField size="small" placeholder={placeholder} value={busca} onChange={(ev) => onBusca(ev.target.value)} sx={{ minWidth: 300, bgcolor: 'background.paper' }} />
      ) : null}
      <Box sx={{ flex: 1 }} />
      {children}
    </Stack>
  )
}

export type Coluna<T> = {
  titulo: string
  render: (linha: T) => ReactNode
  align?: 'left' | 'right'
  largura?: number | string
}

export function Titulo({ texto, sub }: { texto: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{texto}</Typography>
      {sub ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>{sub}</Typography> : null}
    </>
  )
}

export type Paginacao = { total: number; pagina: number; por: number; onPagina: (pagina: number) => void }

export function TabelaConfig<T>({ colunas, linhas, chave, vazio = 'Nada encontrado.', onLinha, rodape, paginacao }: {
  colunas: Coluna<T>[]
  linhas: T[]
  chave: (linha: T) => string
  vazio?: string
  onLinha?: (linha: T) => void
  rodape?: ReactNode
  paginacao?: Paginacao
}) {
  const { t } = usePrefs()
  return (
    <Paper variant="outlined" sx={{ overflow: 'auto' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {colunas.map((c) => <TableCell key={c.titulo} align={c.align} sx={{ width: c.largura }}>{c.titulo}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {linhas.length === 0 && (
            <TableRow>
              <TableCell colSpan={colunas.length}>
                <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>{vazio}</Box>
              </TableCell>
            </TableRow>
          )}
          {linhas.map((linha) => (
            <TableRow key={chave(linha)} hover sx={onLinha ? { cursor: 'pointer' } : undefined} onClick={onLinha ? () => onLinha(linha) : undefined}>
              {colunas.map((c) => <TableCell key={c.titulo} align={c.align}>{c.render(linha)}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {paginacao && paginacao.total > paginacao.por ? (
        <TablePagination
          component="div"
          count={paginacao.total}
          page={Math.min(paginacao.pagina, Math.max(Math.ceil(paginacao.total / paginacao.por) - 1, 0))}
          rowsPerPage={paginacao.por}
          rowsPerPageOptions={[paginacao.por]}
          onPageChange={(_, pagina) => paginacao.onPagina(pagina)}
          labelDisplayedRows={({ from, to, count }) => t(`${from}–${to} de ${count}`, `${from}–${to} of ${count}`)}
          labelRowsPerPage={t('Por página', 'Per page')}
          sx={{
            borderTop: '1px solid',
            borderColor: 'divider',
            '& .MuiTablePagination-toolbar': { minHeight: 32, height: 32, pl: 1.5, pr: 0.5 },
            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: 12, m: 0 },
            '& .MuiTablePagination-select': { fontSize: 12 },
            '& .MuiTablePagination-actions': { ml: 0.5 },
            '& .MuiTablePagination-actions .MuiIconButton-root': { p: 0.25 },
          }}
        />
      ) : null}
      {rodape ? (
        <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider', fontSize: 12, color: 'text.secondary' }}>{rodape}</Box>
      ) : null}
    </Paper>
  )
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Stack spacing={1.5}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary' }}>{titulo}</Typography>
      {children}
    </Stack>
  )
}

export function PainelLateral({ aberto, titulo, subtitulo, onFechar, rodape, children }: {
  aberto: boolean
  titulo: ReactNode
  subtitulo?: ReactNode
  onFechar: () => void
  rodape?: ReactNode
  children: ReactNode
}) {
  return (
    <Drawer anchor="right" open={aberto} onClose={onFechar} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 460 }, bgcolor: 'background.paper' } } }}>
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', px: 3, py: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{titulo}</Typography>
            {subtitulo ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{subtitulo}</Typography> : null}
          </Box>
          <IconButton size="small" onClick={onFechar}><CloseIcon fontSize="small" /></IconButton>
        </Stack>
        <Stack spacing={3} sx={{ flex: 1, overflow: 'auto', px: 3, py: 2.5 }}>{children}</Stack>
        {rodape ? (
          <Stack direction="row" spacing={1} sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>{rodape}</Stack>
        ) : null}
      </Stack>
    </Drawer>
  )
}

export function useBusca<T>(linhas: T[], texto: (linha: T) => string) {
  const [busca, setBusca] = useState('')
  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return linhas
    const numeros = termo.replace(/\D/g, '')
    return linhas.filter((l) => {
      const alvo = texto(l).toLowerCase()
      return alvo.includes(termo) || (numeros.length >= 3 && alvo.replace(/\D/g, '').includes(numeros))
    })
  }, [linhas, busca, texto])
  return { busca, setBusca, filtradas }
}

export function mensagem(err: unknown, padrao = 'Não carregou') {
  return err instanceof Error ? err.message : padrao
}

export function Erro({ erro }: { erro: string }) {
  return erro ? <Alert severity="error">{erro}</Alert> : null
}

export function Aviso({ texto, onFechar }: { texto: string; onFechar: () => void }) {
  return (
    <Snackbar open={!!texto} autoHideDuration={3600} onClose={onFechar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="success" variant="filled" onClose={onFechar}>{texto}</Alert>
    </Snackbar>
  )
}

export type Situacao = 'ativos' | 'inativos' | 'todos'

export function FiltroSituacao({ valor, onMudar }: { valor: Situacao; onMudar: (valor: Situacao) => void }) {
  const { t } = usePrefs()
  return (
    <TextField select size="small" value={valor} onChange={(ev) => onMudar(ev.target.value as Situacao)} sx={{ minWidth: 150, bgcolor: 'background.paper' }}>
      <MenuItem value="ativos">{t('Ativos', 'Active')}</MenuItem>
      <MenuItem value="inativos">{t('Inativos', 'Inactive')}</MenuItem>
      <MenuItem value="todos">{t('Todos', 'All')}</MenuItem>
    </TextField>
  )
}

export function porSituacao<T>(linhas: T[], situacao: Situacao, ativo: (linha: T) => boolean) {
  return linhas.filter((l) => situacao === 'todos' || (situacao === 'ativos' ? ativo(l) : !ativo(l)))
}

export function AcoesForm({ existe, emUso, salvando, podeSalvar, onSalvar, onExcluir, onFechar }: {
  existe: boolean
  emUso: boolean
  salvando: boolean
  podeSalvar: boolean
  onSalvar: () => void
  onExcluir: () => void
  onFechar: () => void
}) {
  const [confirmando, setConfirmando] = useState(false)
  const { t } = usePrefs()
  return (
    <Stack spacing={1.5} sx={{ flex: 1 }}>
      {confirmando ? (
        <Alert severity="warning" onClose={() => setConfirmando(false)}>
          {emUso
            ? t('Está em uso, então vai ser inativado: sai das listas e da escolha em novos lançamentos, mas continua no histórico.', 'It is in use, so it will be deactivated: it leaves the lists and new entries, but stays in history.')
            : t('Não tem uso e vai ser excluído de vez.', 'It is unused and will be deleted for good.')}
        </Alert>
      ) : null}
      <Stack direction="row" spacing={1}>
        {existe ? (
          <Button color="error" disabled={salvando} onClick={() => (confirmando ? onExcluir() : setConfirmando(true))}>
            {confirmando ? (emUso ? t('Confirmar inativação', 'Confirm deactivation') : t('Confirmar exclusão', 'Confirm delete')) : (emUso ? t('Inativar', 'Deactivate') : t('Excluir', 'Delete'))}
          </Button>
        ) : null}
        <Box sx={{ flex: 1 }} />
        <Button onClick={onFechar}>{t('Cancelar', 'Cancel')}</Button>
        <Button variant="contained" disabled={salvando || !podeSalvar} onClick={onSalvar}>{salvando ? t('Salvando…', 'Saving…') : t('Salvar', 'Save')}</Button>
      </Stack>
    </Stack>
  )
}

export function textoRemocao(nome: string, r: { inativado?: boolean }) {
  return r.inativado ? `“${nome}” inativado. Está em uso e fica no histórico.` : `“${nome}” excluído.`
}
