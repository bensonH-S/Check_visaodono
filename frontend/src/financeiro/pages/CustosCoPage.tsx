import { Fragment, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import {
  api,
  brl,
  emCache,
  lojaCaixaSalva,
  salvarLojaCaixa,
  urlEmpresas,
  type CustosCoBloco,
  type CustosCoItem,
  type CustosCoLinha,
  type CustosCoPainel,
  type Empresa,
} from '../api'
import { ordenarEmpresas } from '../ordemEmpresas'
import { usePrefs } from '../prefs'
import FiltroMesFinanceiro from '../FiltroMesFinanceiro'
import SeletorLojaFinanceiro from '../SeletorLojaFinanceiro'
import { FIN_BORDER, FIN_MUTED, FIN_SURFACE_ALT, FIN_TEXT, finPageSx } from '../temaFinanceiroEscuro'

function mesAtual() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7)
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function dataCurta(iso?: string | null) {
  if (!iso || iso.length < 10) return ''
  const dia = Number(iso.slice(8, 10))
  const mes = Number(iso.slice(5, 7)) - 1
  if (!dia || mes < 0) return ''
  return `${String(dia).padStart(2, '0')}/${MESES[mes]}`
}

function pctTxt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return ''
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function pctDe(parte: number, base: number) {
  if (!base) return null
  return Math.round((parte / base) * 1000) / 10
}

/** C_O_ só entra com despesa paga ou conciliada. Caixa não tem status de agenda. */
function seloPago(status?: string | null) {
  if (status === 'paga' || status === 'conciliada') return 'Pago'
  return ''
}

const ORDEM = ['fixos', 'impostos', 'utilities', 'cmp', 'gimba', 'brasal', 'brindes', 'tarifas', 'manutencao', 'outros']

const TOM: Record<string, { nome: string }> = {
  fixos: { nome: 'Custos fixos' },
  impostos: { nome: 'Impostos' },
  utilities: { nome: 'Utilities' },
  tarifas: { nome: 'Tarifas' },
  cmp: { nome: 'Platlog' },
  gimba: { nome: 'Gimba' },
  brasal: { nome: 'Brasal' },
  brindes: { nome: 'Brindes' },
  manutencao: { nome: 'Manutenção' },
  outros: { nome: 'Outros' },
}

const NOTAS = new Set(['cmp', 'gimba', 'brasal', 'brindes'])

const num = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

const AZUL = '#1B6EF3'
const PAGO = '#17803D'
const PAGO_BG = '#E7F6EE'
const ABERTO = '#DC2626'
const ABERTO_BG = 'rgba(239, 68, 68, 0.12)'

type Recorte = 'todas' | 'aberto' | 'pago'

type LinhaVista = {
  chave: string
  rotulo: string
  valor: number
  venc: string
  pct: number | null
  selo: string
  itens: CustosCoItem[]
}

type ColunaFolha = {
  id: string
  titulo: string
  linhas: LinhaVista[]
  total: number
  pct: number | null
}

function rotuloNota(item: CustosCoItem, nome: string) {
  if (item.numero_nf) return `NF ${item.numero_nf}`
  const desc = (item.descricao || '').trim()
  if (desc && desc.toLowerCase() !== nome.toLowerCase()) return desc
  const forn = (item.fornecedor || '').trim()
  if (forn && forn.toLowerCase() !== nome.toLowerCase()) return forn
  return nome
}

function linhasDoBloco(bloco: CustosCoBloco, venda: number): LinhaVista[] {
  const tom = TOM[bloco.id] || TOM.outros
  if (NOTAS.has(bloco.id)) {
    const itens = bloco.linhas?.flatMap((l) => l.itens) || bloco.itens || []
    return [...itens]
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor)
      .map((item) => ({
        chave: item.id,
        rotulo: rotuloNota(item, tom.nome),
        valor: item.valor,
        venc: dataCurta(item.vencimento),
        pct: pctDe(item.valor, venda),
        selo: seloPago(item.status),
        itens: [],
      }))
  }
  return (bloco.linhas || []).map((linha) => ({
    chave: `${bloco.id}:${linha.rotulo}`,
    rotulo: linha.rotulo,
    valor: linha.valor,
    venc: linha.itens.length === 1 ? dataCurta(linha.itens[0].vencimento) : '',
    pct: linha.pct_venda ?? pctDe(linha.valor, venda),
    selo: linha.itens.length > 0 && linha.itens.every((item) => seloPago(item.status)) ? 'Pago' : '',
    itens: linha.itens.length > 1 ? linha.itens : [],
  }))
}

function linhasAbertasDoBloco(bloco: CustosCoBloco, venda: number): LinhaVista[] {
  const tom = TOM[bloco.id] || TOM.outros
  if (NOTAS.has(bloco.id)) {
    return [...(bloco.itens_abertos || [])]
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor)
      .map((item) => ({
        chave: `aberto:${item.id}`,
        rotulo: rotuloNota(item, tom.nome),
        valor: item.valor,
        venc: dataCurta(item.vencimento),
        pct: pctDe(item.valor, venda),
        selo: 'Em aberto',
        itens: [],
      }))
  }
  return (bloco.linhas_abertas || []).map((linha) => ({
    chave: `aberto:${bloco.id}:${linha.rotulo}`,
    rotulo: linha.rotulo,
    valor: linha.valor,
    venc: linha.itens.length === 1 ? dataCurta(linha.itens[0].vencimento) : '',
    pct: linha.pct_venda ?? pctDe(linha.valor, venda),
    selo: 'Em aberto',
    itens: linha.itens.length > 1 ? linha.itens : [],
  }))
}

function linhasDaOrigem(linha: CustosCoLinha, grupoId: string, venda: number): LinhaVista {
  const pago = linha.itens.length > 0 && linha.itens.every((item) => seloPago(item.status))
  return {
    chave: `${grupoId}:${linha.rotulo}`,
    rotulo: linha.rotulo,
    valor: linha.valor,
    venc: linha.itens.length === 1 ? dataCurta(linha.itens[0].vencimento) : '',
    pct: pctDe(linha.valor, venda),
    selo: pago ? 'Pago' : '',
    itens: linha.itens.length > 1 ? linha.itens : [],
  }
}

function estadoValor(selo: string): 'pago' | 'aberto' | 'neutro' {
  if (selo === 'Pago') return 'pago'
  if (selo === 'Em aberto') return 'aberto'
  return 'neutro'
}

function ValorCelula({ valor, selo }: { valor: number; selo: string }) {
  const estado = estadoValor(selo)
  const pago = estado === 'pago'
  const aberto = estado === 'aberto'
  return (
    <Box
      component="span"
      title={pago ? 'Pago' : aberto ? 'Em aberto' : undefined}
      sx={{
        ...num,
        justifySelf: 'end',
        px: 0.6,
        borderRadius: '4px',
        fontSize: 12.5,
        fontWeight: 700,
        lineHeight: 1.5,
        color: pago ? PAGO : aberto ? ABERTO : FIN_TEXT,
        WebkitTextFillColor: pago ? PAGO : aberto ? ABERTO : FIN_TEXT,
        bgcolor: pago ? PAGO_BG : aberto ? ABERTO_BG : 'transparent',
      }}
    >
      {brl(valor)}
    </Box>
  )
}

function RecorteContas({
  valor,
  abertos,
  onChange,
}: {
  valor: Recorte
  abertos: number
  onChange: (valor: Recorte) => void
}) {
  const opcoes: Array<{ id: Recorte; label: string }> = [
    { id: 'todas', label: 'Todas' },
    { id: 'aberto', label: abertos > 0 ? `Em aberto · ${abertos}` : 'Em aberto' },
    { id: 'pago', label: 'Pagas' },
  ]
  return (
    <Box
      sx={{
        display: 'flex',
        flexShrink: 0,
        height: 34,
        p: '3px',
        borderRadius: '10px',
        bgcolor: '#fff',
        border: '1px solid rgba(15,23,42,0.1)',
      }}
    >
      {opcoes.map((item) => {
        const ativo = valor === item.id
        return (
          <Box
            key={item.id}
            component="button"
            type="button"
            onClick={() => onChange(item.id)}
            sx={{
              border: 0,
              cursor: 'pointer',
              borderRadius: '8px',
              px: 1.25,
              bgcolor: ativo ? AZUL : 'transparent',
              color: ativo ? '#fff' : '#64748B',
            }}
          >
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'inherit', lineHeight: '28px', whiteSpace: 'nowrap' }}>
              {item.label}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

function vencDaLinha(linha: LinhaVista) {
  if (linha.itens.length > 1) {
    const datas = linha.itens.map((item) => item.vencimento).filter(Boolean).sort()
    const primeira = dataCurta(datas[0])
    return primeira ? `${primeira} · ${linha.itens.length}` : `${linha.itens.length} vencimentos`
  }
  return linha.venc || '—'
}

const celulaNum = {
  ...num,
  textAlign: 'right',
  width: 118,
  px: 1,
  py: 0.75,
  fontSize: 12.5,
  borderBottom: '1px solid rgba(15,23,42,0.06)',
} as const

const celulaMeio = {
  ...num,
  textAlign: 'center',
  width: 104,
  px: 0.5,
  py: 0.75,
  fontSize: 12.5,
  color: FIN_MUTED,
  borderBottom: '1px solid rgba(15,23,42,0.06)',
} as const

function pilhasEquilibradas(colunas: ColunaFolha[], n: number) {
  const marcado = colunas.map((coluna, ordem) => ({ coluna, ordem, peso: coluna.linhas.length + 3 }))
  const porTamanho = [...marcado].sort((a, b) => b.peso - a.peso)
  const grupos: typeof marcado[] = Array.from({ length: n }, () => [])
  const pesos = Array(n).fill(0)
  for (const item of porTamanho) {
    let destino = 0
    for (let i = 1; i < n; i += 1) if (pesos[i] < pesos[destino]) destino = i
    grupos[destino].push(item)
    pesos[destino] += item.peso
  }
  return grupos.map((grupo) => grupo.sort((a, b) => a.ordem - b.ordem).map((item) => item.coluna))
}

function ColunaConta({
  coluna,
  aberto,
  onAbrir,
  esticar,
}: {
  coluna: ColunaFolha
  aberto: string | null
  onAbrir: (chave: string) => void
  esticar: boolean
}) {
  const emAberto = coluna.linhas.filter((linha) => linha.selo === 'Em aberto').length
  const temStatus = coluna.linhas.some((linha) => linha.selo === 'Pago' || linha.selo === 'Em aberto')
  const cabeca = { py: 0.6, px: 1, border: 0, fontSize: 11, fontWeight: 600, color: FIN_MUTED, bgcolor: FIN_SURFACE_ALT } as const
  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        flex: esticar ? '1 1 auto' : '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        border: `1px solid ${FIN_BORDER}`,
        borderTop: `3px solid ${AZUL}`,
        bgcolor: '#fff',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 36, px: 1.5, bgcolor: FIN_SURFACE_ALT }}>
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: FIN_TEXT }}>{coluna.titulo}</Typography>
        {temStatus && emAberto > 0 ? <Typography sx={{ fontSize: 12, fontWeight: 700, color: ABERTO }}>{emAberto} em aberto</Typography> : null}
        {temStatus && emAberto === 0 ? <Typography sx={{ fontSize: 12, fontWeight: 700, color: PAGO }}>Quitado</Typography> : null}
      </Box>
      <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
        <colgroup>
          <col />
          <col style={{ width: '7.6rem' }} />
          <col style={{ width: '6.4rem' }} />
          <col style={{ width: '3.6rem' }} />
        </colgroup>
        <TableBody>
          <TableRow>
            <TableCell sx={{ ...cabeca, textAlign: 'left' }}>Conta</TableCell>
            <TableCell sx={{ ...cabeca, textAlign: 'right' }}>Valor</TableCell>
            <TableCell sx={{ ...cabeca, textAlign: 'center' }}>Venc.</TableCell>
            <TableCell sx={{ ...cabeca, textAlign: 'center' }}>%</TableCell>
          </TableRow>
          {coluna.linhas.map((linha) => {
            const expansivel = linha.itens.length > 1
            return (
              <Fragment key={linha.chave}>
                <TableRow hover={expansivel} onClick={expansivel ? () => onAbrir(linha.chave) : undefined} sx={{ cursor: expansivel ? 'pointer' : 'default' }}>
                  <TableCell sx={{ ...celulaMeio, textAlign: 'left', width: 'auto', color: FIN_TEXT, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{linha.rotulo}</TableCell>
                  <TableCell sx={celulaNum}><ValorCelula valor={linha.valor} selo={linha.selo} /></TableCell>
                  <TableCell sx={celulaMeio}>{expansivel ? vencDaLinha(linha) : (linha.venc || '—')}</TableCell>
                  <TableCell sx={celulaMeio}>{pctTxt(linha.pct) || '—'}</TableCell>
                </TableRow>
                {expansivel && aberto === linha.chave
                  ? linha.itens.map((item) => {
                      const seloItem = linha.selo === 'Em aberto' ? 'Em aberto' : seloPago(item.status)
                      return (
                        <TableRow key={item.id}>
                          <TableCell sx={{ ...celulaMeio, textAlign: 'left', pl: 2.5, color: FIN_MUTED, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.descricao}</TableCell>
                          <TableCell sx={celulaNum}><ValorCelula valor={item.valor} selo={seloItem} /></TableCell>
                          <TableCell sx={celulaMeio}>{dataCurta(item.vencimento) || '—'}</TableCell>
                          <TableCell sx={celulaMeio} />
                        </TableRow>
                      )
                    })
                  : null}
              </Fragment>
            )
          })}
        </TableBody>
      </Table>
      {esticar ? <Box sx={{ flex: 1 }} /> : null}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 7.6rem 6.4rem 3.6rem',
          alignItems: 'center',
          minHeight: 36,
          bgcolor: FIN_SURFACE_ALT,
          borderTop: '1px solid rgba(15,23,42,0.06)',
        }}
      >
        <Typography sx={{ pl: 1, fontSize: 12.5, fontWeight: 700, color: FIN_TEXT }}>Total</Typography>
        <Typography sx={{ ...num, pr: 1, fontSize: 12.5, fontWeight: 700, color: FIN_TEXT, textAlign: 'right' }}>{brl(coluna.total)}</Typography>
        <Box />
        <Typography sx={{ ...num, fontSize: 12.5, fontWeight: 700, color: FIN_MUTED, textAlign: 'center' }}>{pctTxt(coluna.pct) || '—'}</Typography>
      </Box>
    </Paper>
  )
}

function LivroContas({
  colunas,
  aberto,
  onAbrir,
  vazio,
}: {
  colunas: ColunaFolha[]
  aberto: string | null
  onAbrir: (chave: string) => void
  vazio: string
}) {
  const tres = useMediaQuery('(min-width:1200px)', { noSsr: true })
  const duas = useMediaQuery('(min-width:800px)', { noSsr: true })
  const n = tres ? 3 : duas ? 2 : 1
  if (!colunas.length) {
    return <Typography sx={{ py: 3, fontSize: 14, color: FIN_MUTED }}>{vazio}</Typography>
  }
  const pilhas = pilhasEquilibradas(colunas, n)
  return (
    <Box sx={{ display: 'grid', width: '100%', gap: 1.5, alignItems: 'stretch', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {pilhas.map((pilha, indice) => (
        <Box key={indice} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0, height: '100%' }}>
          {pilha.map((coluna, ordem) => (
            <ColunaConta
              key={coluna.id}
              coluna={coluna}
              aberto={aberto}
              onAbrir={onAbrir}
              esticar={ordem === pilha.length - 1}
            />
          ))}
        </Box>
      ))}
    </Box>
  )
}

function montarColuna(id: string, titulo: string, linhas: LinhaVista[], venda: number): ColunaFolha {
  const total = linhas.reduce((soma, linha) => soma + linha.valor, 0)
  return { id, titulo, linhas, total, pct: pctDe(total, venda) }
}

export function CustosCoPage() {
  const { t } = usePrefs()
  const [mes, setMes] = useState(mesAtual)
  const [empresas, setEmpresas] = useState<Empresa[]>(() => emCache<Empresa[]>(urlEmpresas()) ?? [])
  const [empresaId, setEmpresaId] = useState(lojaCaixaSalva)
  const [dados, setDados] = useState<CustosCoPainel | null>(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [aberto, setAberto] = useState<string | null>(null)
  const [aba, setAba] = useState<'co' | 'despesas' | 'online'>('co')
  const [recorte, setRecorte] = useState<Recorte>('todas')

  const lojas = useMemo(() => ordenarEmpresas(empresas), [empresas])

  useEffect(() => {
    let vivo = true
    api.empresas().then((lista) => {
      if (!vivo) return
      setEmpresas(lista)
      const id = lojaCaixaSalva()
      if (id && lista.some((e) => e.id === id)) setEmpresaId(id)
      else if (lista[0]) setEmpresaId(lista[0].id)
    })
    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (!empresaId) return
    let vivo = true
    setAberto(null)
    setLoading(true)
    api
      .custosCo(mes, empresaId)
      .then((data) => {
        if (!vivo) return
        setDados(data)
        setErro('')
      })
      .catch((err) => {
        if (!vivo) return
        setDados(null)
        setErro(err instanceof Error ? err.message : t('Não montou o C_O_.', 'Could not build C_O_.'))
      })
      .finally(() => {
        if (vivo) setLoading(false)
      })
    return () => {
      vivo = false
    }
  }, [mes, empresaId, t])

  const resumo = dados?.resumo
  const venda = resumo?.venda_total || 0
  const porId = useMemo(() => new Map((dados?.blocos || []).map((b) => [b.id, b])), [dados])
  const blocosCo = ORDEM.map((id) => porId.get(id)).filter((b): b is CustosCoBloco => !!b && (b.qtd > 0 || (b.qtd_aberto || 0) > 0))
  const abrir = (chave: string) => setAberto((atual) => (atual === chave ? null : chave))

  const abas = [
    { id: 'co' as const, label: 'C_O_' },
    { id: 'despesas' as const, label: 'Despesas' },
    { id: 'online' as const, label: 'Online' },
  ]

  const colunasCo = useMemo(() => {
    return blocosCo.flatMap((bloco) => {
      const pagas = linhasDoBloco(bloco, venda)
      const abertas = linhasAbertasDoBloco(bloco, venda)
      const linhas = recorte === 'aberto' ? abertas : recorte === 'pago' ? pagas : [...abertas, ...pagas]
      if (!linhas.length) return []
      return [montarColuna(bloco.id, bloco.titulo || (TOM[bloco.id] || TOM.outros).nome, linhas, venda)]
    })
  }, [blocosCo, recorte, venda])

  const origem = aba === 'despesas' ? dados?.despesas : aba === 'online' ? dados?.online : undefined
  const colunasOrigem = useMemo(() => {
    return (origem?.grupos || []).map((grupo) =>
      montarColuna(
        grupo.id,
        grupo.titulo,
        grupo.linhas.map((linha) => linhasDaOrigem(linha, grupo.id, venda)),
        venda,
      ),
    )
  }, [origem, venda])

  const totalCo = resumo?.despesa_total || 0
  const abertoCo = resumo?.aberto_total || 0
  const qtdAberto = blocosCo.reduce((soma, bloco) => {
    const linhas = NOTAS.has(bloco.id) ? bloco.itens_abertos?.length || 0 : bloco.linhas_abertas?.length || 0
    return soma + linhas
  }, 0)
  const pctAberto = pctTxt(resumo?.aberto_pct ?? pctDe(abertoCo, venda))

  return (
    <Stack
      spacing={2.5}
      sx={{
        ...finPageSx,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        pb: 2,
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0, pt: 0.5, overflow: 'visible' }}>
        <SeletorLojaFinanceiro
          lojas={lojas}
          value={empresaId}
          onChange={(id) => {
            setEmpresaId(id)
            salvarLojaCaixa(id)
          }}
          label={t('Loja', 'Store')}
          width={260}
          sx={{ width: 260, flex: '0 0 auto' }}
        />
        <FiltroMesFinanceiro value={mes} onChange={setMes} width={156} />
        <Box
          sx={{
            display: 'flex',
            flex: '0 0 auto',
            height: 34,
            p: '3px',
            borderRadius: '10px',
            bgcolor: '#fff',
            border: '1px solid rgba(15,23,42,0.1)',
          }}
        >
          {abas.map((item) => {
            const ativo = aba === item.id
            return (
              <Box
                key={item.id}
                component="button"
                type="button"
                onClick={() => {
                  setAba(item.id)
                  setAberto(null)
                }}
                sx={{
                  border: 0,
                  cursor: 'pointer',
                  borderRadius: '8px',
                  px: 1.5,
                  bgcolor: ativo ? AZUL : 'transparent',
                  color: ativo ? '#fff' : '#64748B',
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', color: 'inherit', lineHeight: '28px', whiteSpace: 'nowrap' }}>
                  {item.label}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      {aba === 'co' && resumo ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.15fr) auto' },
            gap: { xs: 2, md: 5 },
            alignItems: 'end',
            width: '100%',
            pt: 1,
            pb: 0.5,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: FIN_MUTED }}>Venda</Typography>
            <Typography noWrap sx={{ ...num, mt: 0.5, fontSize: { xs: 26, md: 34 }, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: FIN_TEXT }}>{brl(venda)}</Typography>
            <Typography sx={{ mt: 0.75, fontSize: 13, color: FIN_MUTED }}>Base do mês</Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PAGO }}>Pago</Typography>
            <Typography noWrap sx={{ ...num, mt: 0.5, fontSize: { xs: 26, md: 34 }, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: PAGO }}>{brl(totalCo)}</Typography>
            <Typography sx={{ ...num, mt: 0.75, fontSize: 13, color: FIN_MUTED }}>{pctTxt(resumo.despesa_pct) ? `${pctTxt(resumo.despesa_pct)} da venda` : '—'}</Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: abertoCo > 0 ? ABERTO : PAGO }}>Em aberto</Typography>
            <Typography noWrap sx={{ ...num, mt: 0.5, fontSize: { xs: 26, md: 34 }, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: abertoCo > 0 ? ABERTO : PAGO }}>{brl(abertoCo)}</Typography>
            <Typography sx={{ ...num, mt: 0.75, fontSize: 13, color: FIN_MUTED }}>
              {abertoCo > 0
                ? `${qtdAberto} ${qtdAberto === 1 ? 'conta' : 'contas'}${pctAberto ? ` · ${pctAberto} da venda` : ''}`
                : 'Nada neste mês'}
            </Typography>
          </Box>
          <RecorteContas valor={recorte} abertos={qtdAberto} onChange={setRecorte} />
        </Box>
      ) : null}

      {loading ? <LinearProgress sx={{ borderRadius: 1, height: 2 }} /> : null}
      {erro ? <Alert severity="error">{erro}</Alert> : null}

      {aba === 'co' && dados ? (
        <LivroContas
          colunas={colunasCo}
          aberto={aberto}
          onAbrir={abrir}
          vazio={
            recorte === 'aberto'
              ? 'Nenhuma conta em aberto neste mês.'
              : recorte === 'pago'
                ? 'Nenhuma conta paga neste mês.'
                : 'Nenhum lançamento de C_O_ neste mês.'
          }
        />
      ) : null}

      {aba !== 'co' && dados ? (
        <LivroContas
          colunas={colunasOrigem}
          aberto={aberto}
          onAbrir={abrir}
          vazio="Nada neste mês."
        />
      ) : null}
    </Stack>
  )
}
