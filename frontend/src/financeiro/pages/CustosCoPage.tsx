import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
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
  type CustosCoOrigem,
  type CustosCoPainel,
  type Empresa,
} from '../api'
import { ordenarEmpresas } from '../ordemEmpresas'
import { usePrefs } from '../prefs'
import FiltroMesFinanceiro from '../FiltroMesFinanceiro'
import SeletorLojaFinanceiro from '../SeletorLojaFinanceiro'
import { finPageSx } from '../temaFinanceiroEscuro'

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
  return `${dia}/${MESES[mes]}`
}

function pctTxt(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return ''
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function pctDe(parte: number, base: number) {
  if (!base) return null
  return Math.round((parte / base) * 1000) / 10
}

/**
 * Três colunas independentes, na ordem de leitura da planilha.
 * Cada coluna empilha os seus blocos — a grade única deixava um vão
 * entre Impostos e Gimba porque a linha acompanhava o bloco mais alto.
 */
const COLUNAS_CO = [
  ['fixos', 'utilities', 'tarifas'],
  ['impostos', 'gimba', 'brasal', 'brindes', 'manutencao', 'outros'],
  ['cmp'],
]

const TOM: Record<string, { tinta: string; nome: string }> = {
  fixos: { tinta: '#C56A1A', nome: 'Custos fixos' },
  impostos: { tinta: '#C56A1A', nome: 'Impostos' },
  utilities: { tinta: '#2F7D57', nome: 'Utilities' },
  tarifas: { tinta: '#9A3412', nome: 'Tarifas' },
  cmp: { tinta: '#2F6FED', nome: 'Platlog' },
  gimba: { tinta: '#A16207', nome: 'Gimba' },
  brasal: { tinta: '#A16207', nome: 'Brasal' },
  brindes: { tinta: '#A16207', nome: 'Brindes' },
  manutencao: { tinta: '#8A5A2B', nome: 'Manutenção' },
  outros: { tinta: '#64748B', nome: 'Outros' },
}

const NOTAS = new Set(['cmp', 'gimba', 'brasal', 'brindes'])

const num = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const

/** Conta flexível; valor, vencimento e % cabem na coluna sem empurrar a página. */
const COLS = 'minmax(0, 1fr) minmax(0, 6.1rem) minmax(0, 2.9rem) minmax(0, 2.45rem)'

function Pct({ v, forte }: { v: number | null | undefined; forte?: boolean }) {
  const texto = pctTxt(v)
  if (!texto) return null
  return (
    <Typography noWrap sx={{ ...num, minWidth: 0, fontSize: 11, fontWeight: forte ? 700 : 500, color: forte ? '#7C5A12' : '#94A3B8', textAlign: 'right' }}>
      {texto}
    </Typography>
  )
}

function LinhaNota({
  item,
  venda,
  destoa,
  rotulo,
  aberto,
  onAbrir,
}: {
  item: CustosCoItem
  venda: number
  destoa: boolean
  rotulo: string
  aberto: boolean
  onAbrir: () => void
}) {
  return (
    <Box>
      <Box
        onClick={onAbrir}
        sx={{
          display: 'grid',
          gridTemplateColumns: COLS,
          columnGap: 0.75,
          alignItems: 'center',
          minHeight: 34,
          px: 1.25,
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
          cursor: 'pointer',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
          bgcolor: destoa ? '#FEF2F2' : 'transparent',
          '&:hover': { bgcolor: destoa ? '#FEF2F2' : 'rgba(15,23,42,0.03)' },
        }}
      >
        <Typography noWrap sx={{ minWidth: 0, fontSize: 13, color: destoa ? '#B42318' : '#0F172A', fontWeight: destoa ? 700 : 500 }}>
          {rotulo}
        </Typography>
        <Typography noWrap sx={{ ...num, minWidth: 0, fontSize: 12.5, fontWeight: 650, textAlign: 'right', color: destoa ? '#B42318' : '#0F172A' }}>
          {brl(item.valor)}
        </Typography>
        <Typography noWrap sx={{ ...num, minWidth: 0, fontSize: 12, textAlign: 'right', color: destoa ? '#B42318' : '#64748B' }}>
          {dataCurta(item.vencimento)}
        </Typography>
        <Pct v={pctDe(item.valor, venda)} />
      </Box>
      <Collapse in={aberto}>
        <Typography sx={{ px: 1.5, pb: 0.6, fontSize: 11.5, color: '#64748B' }}>
          {[item.fornecedor, item.descricao !== rotulo ? item.descricao : '', item.numero_nf ? `NF ${item.numero_nf}` : ''].filter(Boolean).join(' · ') || 'Sem detalhe'}
        </Typography>
      </Collapse>
    </Box>
  )
}

function LinhaConta({
  linha,
  venda,
  aberto,
  onAbrir,
}: {
  linha: CustosCoLinha
  venda: number
  aberto: boolean
  onAbrir: () => void
}) {
  const data = linha.itens.length === 1 ? dataCurta(linha.itens[0].vencimento) : ''
  return (
    <Box>
      <Box
        onClick={onAbrir}
        sx={{
          display: 'grid',
          gridTemplateColumns: COLS,
          columnGap: 0.75,
          alignItems: 'center',
          minHeight: 34,
          px: 1.25,
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
          cursor: 'pointer',
          borderBottom: '1px solid rgba(15,23,42,0.06)',
          '&:hover': { bgcolor: 'rgba(15,23,42,0.03)' },
        }}
      >
        <Typography noWrap sx={{ minWidth: 0, fontSize: 13, color: '#0F172A' }}>{linha.rotulo}</Typography>
        <Typography noWrap sx={{ ...num, minWidth: 0, fontSize: 12.5, fontWeight: 650, textAlign: 'right' }}>{brl(linha.valor)}</Typography>
        <Typography noWrap sx={{ ...num, minWidth: 0, fontSize: 12, textAlign: 'right', color: '#64748B' }}>{data}</Typography>
        <Pct v={linha.pct_venda ?? pctDe(linha.valor, venda)} />
      </Box>
      <Collapse in={aberto}>
        <Box sx={{ px: 1.5, pb: 0.75 }}>
          {linha.itens.map((item) => (
            <Box key={item.id} sx={{ display: 'grid', gridTemplateColumns: '46px minmax(0, 1fr) auto', gap: 1, py: 0.25 }}>
              <Typography sx={{ ...num, fontSize: 11.5, color: '#94A3B8' }}>{dataCurta(item.vencimento)}</Typography>
              <Typography noWrap sx={{ fontSize: 12, color: '#64748B' }}>{item.descricao}</Typography>
              <Typography sx={{ ...num, fontSize: 12, fontWeight: 600 }}>{brl(item.valor)}</Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}

function CartaoBloco({
  titulo,
  total,
  pct,
  tinta,
  children,
}: {
  titulo: string
  total: number
  pct: number | null
  tinta: string
  children: ReactNode
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid rgba(15,23,42,0.08)',
        borderRadius: '12px',
        overflow: 'hidden',
        bgcolor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: COLS,
          columnGap: 0.75,
          alignItems: 'center',
          minHeight: 40,
          px: 1.25,
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
          bgcolor: tinta,
        }}
      >
        <Typography noWrap sx={{ minWidth: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#fff' }}>
          {titulo}
        </Typography>
        <Typography noWrap sx={{ ...num, minWidth: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'right', color: 'rgba(255,255,255,0.82)' }}>Valor</Typography>
        <Typography noWrap sx={{ ...num, minWidth: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'right', color: 'rgba(255,255,255,0.82)' }}>Venc.</Typography>
        <Typography noWrap sx={{ ...num, minWidth: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'right', color: 'rgba(255,255,255,0.82)' }}>%</Typography>
      </Box>
      <Box sx={{ py: 0.25 }}>{children}</Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: COLS,
          columnGap: 0.75,
          alignItems: 'center',
          minHeight: 34,
          px: 1.25,
          minWidth: 0,
          width: '100%',
          overflow: 'hidden',
          bgcolor: '#FBF8EE',
          borderTop: '1px solid rgba(161,98,7,0.18)',
        }}
      >
        <Typography noWrap sx={{ minWidth: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7C5A12' }}>Total</Typography>
        <Typography noWrap sx={{ ...num, minWidth: 0, fontSize: 12.5, fontWeight: 700, textAlign: 'right' }}>{brl(total)}</Typography>
        <Box />
        <Pct v={pct} forte />
      </Box>
    </Paper>
  )
}

function maiorQueDestoa(itens: CustosCoItem[]) {
  if (itens.length < 2) return ''
  const ordenados = [...itens].sort((a, b) => b.valor - a.valor)
  const topo = ordenados[0]
  const segundo = ordenados[1]?.valor || 0
  if (topo.valor >= segundo * 1.8) return topo.id
  return ''
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
  const colunasCo = COLUNAS_CO.map((ids) =>
    ids.map((id) => porId.get(id)).filter((b): b is CustosCoBloco => !!b && b.qtd > 0),
  ).filter((coluna) => coluna.length > 0)
  const abrir = (chave: string) => setAberto((atual) => (atual === chave ? null : chave))

  const abas = [
    { id: 'co' as const, label: 'C_O_', tinta: '#C56A1A' },
    { id: 'despesas' as const, label: 'Despesas', tinta: '#475569' },
    { id: 'online' as const, label: 'Online', tinta: '#0F6E6E' },
  ]

  const blocoCard = (bloco: CustosCoBloco) => {
    const tom = TOM[bloco.id] || TOM.outros
    const notas = NOTAS.has(bloco.id)
    const itens = bloco.linhas?.flatMap((l) => l.itens) || bloco.itens || []
    const destoaId = bloco.id === 'cmp' ? maiorQueDestoa(itens) : ''
    return (
      <CartaoBloco
        key={bloco.id}
        titulo={bloco.titulo || tom.nome}
        total={bloco.total}
        pct={bloco.pct_venda}
        tinta={tom.tinta}
      >
        {notas
          ? [...itens]
              .sort((a, b) => a.vencimento.localeCompare(b.vencimento) || b.valor - a.valor)
              .map((item) => (
                <LinhaNota
                  key={item.id}
                  item={item}
                  venda={venda}
                  rotulo={tom.nome}
                  destoa={item.id === destoaId}
                  aberto={aberto === item.id}
                  onAbrir={() => abrir(item.id)}
                />
              ))
          : (bloco.linhas || []).map((linha) => {
              const chave = `${bloco.id}:${linha.rotulo}`
              return (
                <LinhaConta
                  key={chave}
                  linha={linha}
                  venda={venda}
                  aberto={aberto === chave}
                  onAbrir={() => abrir(chave)}
                />
              )
            })}
      </CartaoBloco>
    )
  }

  return (
    <Stack
      spacing={1.5}
      sx={{
        ...finPageSx,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        overflowX: 'clip',
        boxSizing: 'border-box',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 1,
          alignItems: 'center',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          sx={{ minWidth: 0, maxWidth: '100%' }}
        >
          <SeletorLojaFinanceiro
            lojas={lojas}
            value={empresaId}
            onChange={(id) => {
              setEmpresaId(id)
              salvarLojaCaixa(id)
            }}
            label={t('Loja', 'Store')}
            sx={{ flex: '1 1 140px', width: 'auto', maxWidth: 220, minWidth: 0 }}
          />
          <FiltroMesFinanceiro value={mes} onChange={setMes} width={140} />
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
                    bgcolor: ativo ? item.tinta : 'transparent',
                    color: ativo ? '#fff' : '#64748B',
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.02em', color: 'inherit', lineHeight: '28px' }}>
                    {item.label}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Stack>
        {resumo ? (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94A3B8' }}>
              Venda
            </Typography>
            <Typography sx={{ ...num, fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F172A' }}>
              {brl(venda)}
            </Typography>
          </Box>
        ) : (
          <Box />
        )}
      </Box>

      {loading ? <LinearProgress sx={{ borderRadius: 1, height: 2 }} /> : null}
      {erro ? <Alert severity="error">{erro}</Alert> : null}

      {aba === 'co' ? (
        <Box
          sx={{
            display: 'grid',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            gap: 1.5,
            alignItems: 'start',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: `repeat(${Math.max(colunasCo.length, 1)}, minmax(0, 1fr))`,
            },
          }}
        >
          {colunasCo.map((coluna) => (
            <Stack key={coluna.map((b) => b.id).join('-')} spacing={1.5} sx={{ minWidth: 0, width: '100%' }}>
              {coluna.map(blocoCard)}
            </Stack>
          ))}
          {!loading && dados && colunasCo.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: '#64748B', py: 3 }}>Nenhum lançamento de C_O_ neste mês.</Typography>
          ) : null}
        </Box>
      ) : null}

      {aba !== 'co' && dados ? (
        <MosaicoOrigem
          origem={aba === 'despesas' ? dados.despesas : dados.online}
          tinta={aba === 'despesas' ? '#475569' : '#0F6E6E'}
          aberto={aberto}
          onAbrir={abrir}
          venda={venda}
        />
      ) : null}
    </Stack>
  )
}

function MosaicoOrigem({
  origem,
  tinta,
  aberto,
  onAbrir,
  venda,
}: {
  origem: CustosCoOrigem | undefined
  tinta: string
  aberto: string | null
  onAbrir: (chave: string) => void
  venda: number
}) {
  const grupos = origem?.grupos || []
  if (!grupos.length) {
    return <Typography sx={{ fontSize: 13, color: '#64748B', py: 3 }}>Nada neste mês.</Typography>
  }
  const meio = Math.ceil(grupos.length / 2)
  const colunas = [grupos.slice(0, meio), grupos.slice(meio)].filter((coluna) => coluna.length > 0)
  return (
    <Box
      sx={{
        display: 'grid',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        gap: 1.5,
        alignItems: 'start',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          md: `repeat(${colunas.length}, minmax(0, 1fr))`,
        },
      }}
    >
      {colunas.map((coluna) => (
        <Stack key={coluna.map((g) => g.id).join('-')} spacing={1.5} sx={{ minWidth: 0, width: '100%' }}>
          {coluna.map((grupo) => (
            <CartaoBloco
              key={grupo.id}
              titulo={grupo.titulo}
              total={grupo.total}
              pct={pctDe(grupo.total, venda)}
              tinta={tinta}
            >
              {grupo.linhas.map((linha) => {
                const chave = `${grupo.id}:${linha.rotulo}`
                return (
                  <LinhaConta
                    key={chave}
                    linha={linha}
                    venda={venda}
                    aberto={aberto === chave}
                    onAbrir={() => onAbrir(chave)}
                  />
                )
              })}
            </CartaoBloco>
          ))}
        </Stack>
      ))}
    </Box>
  )
}
