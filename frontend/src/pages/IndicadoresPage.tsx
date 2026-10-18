import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import BarChartIcon from '@mui/icons-material/BarChart';
import DeliveryDiningOutlinedIcon from '@mui/icons-material/DeliveryDiningOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import { useTheme } from '@mui/material/styles';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  api,
  type DashboardIndicadoresData,
  type RankingLoja,
} from '../api/client';
import { api as finApi } from '../financeiro/api';
import FiltroIntervaloDatasFrota from '../components/frota/FiltroIntervaloDatasFrota';
import {
  CcCountPanel,
  CcFinancePanel,
  CcStorePerformance,
  type OrdemLojas,
} from '../components/dashboard/commandCenter/CcOperationalGrid';
import { useCcData } from '../components/dashboard/commandCenter/useCcData';
import { getUsuario, podeVerEstoque, podeVerResumoFinanceiro } from '../lib/auth';
import { usePageTitle } from '../hooks/usePageTitle';
import { portalPanelSx } from '../theme/tokens';

const AZUL = '#1B6EF3';
const META_CMV = 40;

const FORN_CMV = [
  { key: 'platlog', label: 'Platlog', cor: '#1D4ED8' },
  { key: 'ambev_coca', label: 'Ambev/Coca', cor: '#EA1D2C' },
  { key: 'gimba', label: 'Gimba', cor: '#0F766E' },
  { key: 'uniforme', label: 'Uniforme', cor: '#7C3AED' },
] as const;

type SerieCaixa = { dia: string; cartoes: number; digitais: number; dinheiro: number; ifood: number; food99: number };
type Caixa = { total: number; canais: Array<{ id: string; valor: number }>; serie: SerieCaixa[] };
type Linha = {
  id_loja: number;
  nome: string;
  bk: string | null;
  cidade: string;
  venda: number;
  vendaAnt: number;
  vendaEstimada: number;
  vendaProjSimples: number;
  cmv: number | null;
  cmvGasto: number;
  cmvMeta: number;
  cmvConfiavel: boolean;
  cmvAnt: number | null;
  cmvForn: { platlog: number; ambev_coca: number; gimba: number; uniforme: number };
  ncs: number;
  ncsCriticas: number;
  ncsNovas: number;
  ncsNovasAnt: number;
  nota: number | null;
  nivel: 'critica' | 'atencao' | 'ok';
};

const CANAIS_SERIE = [
  { key: 'cartoes', label: 'Cartões', cor: '#1D4ED8' },
  { key: 'digitais', label: 'Pix e carteiras', cor: '#0F766E' },
  { key: 'dinheiro', label: 'Dinheiro', cor: '#7C3AED' },
  { key: 'ifood', label: 'iFood', cor: '#EA1D2C' },
  { key: 'food99', label: '99', cor: '#F59E0B' },
] as const;

function hojeIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function addDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function periodoAnterior(de: string, ate: string) {
  const dias = Math.max(1, Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000) + 1);
  const fim = addDias(de, -1);
  return { de: addDias(fim, -(dias - 1)), ate: fim };
}

function brl(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function brlCurto(n: number) {
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function num1(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function pct(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${num1(n)}%`;
}

function diaCurto(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function nomeLoja(nome: string, bk: string | null) {
  const base = String(nome || '')
    .replace(/burger\s*king/gi, '')
    .replace(/^[\s\-–·]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  return bk ? `BK ${bk} - ${base || 'LOJA'}` : base || 'LOJA';
}

/* ---------- peças ---------- */

function Delta({ atual, anterior, modo = 'pct', inverso = false }: {
  atual: number | null;
  anterior: number | null;
  modo?: 'pct' | 'pp';
  inverso?: boolean;
}) {
  let delta: number | null = null;
  if (atual != null && anterior != null) {
    if (modo === 'pp') delta = atual - anterior;
    else if (anterior > 0) delta = ((atual - anterior) / anterior) * 100;
  }
  if (delta == null || !Number.isFinite(delta)) {
    return <Typography sx={{ fontSize: 10.5, color: 'text.secondary' }}>sem base</Typography>;
  }
  const bom = inverso ? delta <= 0 : delta >= 0;
  const cor = bom ? '#15803D' : '#B91C1C';
  const Icone = delta >= 0 ? ArrowUpwardIcon : ArrowDownwardIcon;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.3,
        alignSelf: 'flex-start',
        px: 0.6,
        py: 0.1,
        borderRadius: 1,
        bgcolor: bom ? 'rgba(22,163,74,0.10)' : 'rgba(220,38,38,0.10)',
        color: cor,
      }}
      title="vs período anterior"
    >
      <Icone sx={{ fontSize: 12 }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: cor }}>
        {modo === 'pp' ? `${delta > 0 ? '+' : ''}${num1(delta)} p.p.` : `${num1(Math.abs(delta))}%`}
      </Typography>
    </Box>
  );
}

function Sparkline({ data, cor, id }: { data: number[]; cor: string; id: string }) {
  const pontos = data.map((v, i) => ({ i, v }));
  if (pontos.filter((p) => p.v > 0).length < 2) return null;
  return (
    <Box sx={{ width: 72, height: 28, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pontos} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={cor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={cor} strokeWidth={1.5} fill={`url(#${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

function KpiCard({ icone, cor, titulo, sub, valor, delta, spark, sparkId }: {
  icone: ReactNode;
  cor: string;
  titulo: string;
  sub: string;
  valor: string;
  delta: ReactNode;
  spark?: number[];
  sparkId: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...portalPanelSx,
        px: 1.5,
        py: 1.15,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.65,
        minWidth: 0,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: `${cor}1A`,
            color: cor,
            flexShrink: 0,
            '& .MuiSvgIcon-root': { fontSize: 18 },
          }}
        >
          {icone}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }} noWrap>{titulo}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.2 }} noWrap>{sub}</Typography>
        </Box>
        {spark ? <Sparkline data={spark} cor={cor} id={sparkId} /> : null}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Typography
          sx={{
            fontSize: { xs: 20, lg: 22 },
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: 'text.primary',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {valor}
        </Typography>
        {delta}
      </Stack>
    </Paper>
  );
}

function Painel({ icone, cor = AZUL, titulo, extra, children }: {
  icone: ReactNode;
  cor?: string;
  titulo: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...portalPanelSx,
        p: 1.4,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.8, flexShrink: 0 }}>
        <Stack direction="row" spacing={1.15} sx={{ alignItems: 'center', minWidth: 0 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.75,
              display: 'grid',
              placeItems: 'center',
              bgcolor: `${cor}1A`,
              color: cor,
              flexShrink: 0,
              '& .MuiSvgIcon-root': { fontSize: 20 },
            }}
          >
            {icone}
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: 'text.primary' }} noWrap>{titulo}</Typography>
        </Stack>
        {extra}
      </Stack>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>
    </Paper>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', minHeight: 120 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', maxWidth: 260 }}>{texto}</Typography>
    </Box>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: 'var(--ga-surface)',
    border: '1px solid var(--ga-border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--ga-text-primary)',
  },
  labelStyle: { color: 'var(--ga-text-primary)', fontWeight: 700 },
} as const;

/* ---------- página / bloco do Command Center ---------- */

type Props = {
  /** Embutido no Command Center: sem título de página próprio. */
  embedded?: boolean;
};

export default function IndicadoresPage({ embedded = false }: Props) {
  usePageTitle(embedded ? 'Command Center' : 'Indicadores');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const user = getUsuario();
  const podeCanais = podeVerResumoFinanceiro(user);
  const podeFinCc = podeVerResumoFinanceiro(user);
  const podeEstoqueCc = podeVerEstoque(user);

  const hoje = hojeIso();
  const ccOps = useCcData({ podeFinanceiro: podeFinCc, data: hoje });
  const [de, setDe] = useState(`${hoje.slice(0, 8)}01`);
  const [ate, setAte] = useState(hoje);
  const [idLoja, setIdLoja] = useState<number | ''>('');
  const [dados, setDados] = useState<DashboardIndicadoresData | null>(null);
  const [ranking, setRanking] = useState<RankingLoja[]>([]);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [caixaAnt, setCaixaAnt] = useState<Caixa | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [modoCanal, setModoCanal] = useState<'valor' | 'pct'>('valor');
  const [busca, setBusca] = useState('');
  const [ordemLojas, setOrdemLojas] = useState<OrdemLojas>('cmv_desc');
  const empresasRef = useRef<Array<{ id: string; bk_number?: string | null }> | null>(null);

  async function empresaDaLoja(bk: string | null | undefined) {
    if (!bk) return undefined;
    if (!empresasRef.current) empresasRef.current = await finApi.empresas().catch(() => []);
    const d = String(bk).replace(/\D/g, '');
    return empresasRef.current.find((e) => String(e.bk_number || '').replace(/\D/g, '') === d)?.id;
  }

  async function carregar() {
    if (!de || !ate || de > ate) return;
    setLoading(true);
    setErro('');
    try {
      const rkP = api.ranking().catch(() => [] as RankingLoja[]);
      let ind: DashboardIndicadoresData;
      try {
        ind = await api.dashboardIndicadores(de, ate, idLoja === '' ? null : idLoja);
      } catch (e) {
        /** Backend antigo sem /indicadores: cai no saude-lojas pra não ficar zerado. */
        const msg = e instanceof Error ? e.message : '';
        if (!/not found|404/i.test(msg)) throw e;
        const saude = await api.dashboardSaudeLojas();
        ind = {
          ...saude,
          anterior: {
            periodo: periodoAnterior(de, ate),
            venda_liquida: 0,
            compras_valor: 0,
            cmp_pct: null,
            cmv_medio_pct: null,
            por_loja: {},
          },
          serie: [],
        };
      }
      const rk = await rkP;
      setDados(ind);
      setRanking(rk);

      if (podeCanais) {
        const bk = idLoja === '' ? null : ind.lojas.find((l) => l.id_loja === idLoja)?.bk_number;
        const empresa = idLoja === '' ? undefined : await empresaDaLoja(bk);
        const ant = periodoAnterior(de, ate);
        const semCaixa = (): Caixa => ({ total: 0, canais: [], serie: [] });
        const [c, ca] = await Promise.all([
          finApi.caixaCanais(de, ate, empresa).then((r) => ({ total: r.total, canais: r.canais, serie: r.serie || [] })).catch(semCaixa),
          finApi.caixaCanais(ant.de, ant.ate, empresa).then((r) => ({ total: r.total, canais: r.canais, serie: r.serie || [] })).catch(semCaixa),
        ]);
        setCaixa(c);
        setCaixaAnt(ca);
      }
      setAtualizadoEm(new Date());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não carregou os indicadores');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [de, ate, idLoja]);

  /* ----- linhas por loja ----- */
  const rkMap = useMemo(() => new Map(ranking.map((r) => [Number(r.id_loja), r])), [ranking]);

  const todasLinhas: Linha[] = useMemo(() => {
    const ant = dados?.anterior?.por_loja || {};
    return (dados?.lojas || []).map((l) => {
      const rk = rkMap.get(l.id_loja);
      const nota = rk ? Number(rk.nota_atual) || null : l.nota_atual;
      const forn = l.cmv_por_fornecedor || { platlog: 0, ambev_coca: 0, gimba: 0, uniforme: 0 };
      return {
        id_loja: l.id_loja,
        nome: nomeLoja(l.name, l.bk_number),
        bk: l.bk_number,
        cidade: l.city || '—',
        venda: l.venda_acumulada ?? l.venda_liquida ?? 0,
        vendaAnt: ant[l.id_loja]?.venda_liquida || 0,
        vendaEstimada: l.venda_estimada || 0,
        vendaProjSimples: l.venda_proj_simples || 0,
        cmv: l.cmv_pct ?? l.cmv_teorico_pct ?? null,
        cmvGasto: l.cmv_gasto || 0,
        cmvMeta: l.cmv_meta_pct || dados?.cmv_meta_pct || META_CMV,
        cmvConfiavel: Boolean(l.cmv_confiavel),
        cmvAnt: ant[l.id_loja]?.cmv_pct ?? ant[l.id_loja]?.cmv_teorico_pct ?? null,
        cmvForn: forn,
        ncs: l.ncs_abertas,
        ncsCriticas: l.ncs_criticas,
        ncsNovas: l.ncs_novas || 0,
        ncsNovasAnt: ant[l.id_loja]?.ncs_novas || 0,
        nota,
        nivel: l.nivel,
      };
    });
  }, [dados, rkMap]);

  const escopo = idLoja === '' ? todasLinhas : todasLinhas.filter((l) => l.id_loja === idLoja);

  /* ----- KPIs ----- */
  const serie = dados?.serie || [];
  const vendaAtual = escopo.reduce((s, l) => s + l.venda, 0);
  const vendaAnt = escopo.reduce((s, l) => s + l.vendaAnt, 0);
  const gastoCmv = escopo.reduce((s, l) => s + l.cmvGasto, 0);
  const vendaEstimada = idLoja === ''
    ? (dados?.projecao?.projecao_inteligente || escopo.reduce((s, l) => s + l.vendaEstimada, 0))
    : (escopo[0]?.vendaEstimada || 0);
  const vendaProjSimples = idLoja === ''
    ? (dados?.projecao?.projecao_simples || escopo.reduce((s, l) => s + l.vendaProjSimples, 0))
    : (escopo[0]?.vendaProjSimples || 0);
  const cmvAtual = idLoja === '' && dados?.projecao?.cmv_pct != null
    ? dados.projecao.cmv_pct
    : (vendaEstimada > 0 && gastoCmv > 0 ? (gastoCmv / vendaEstimada) * 100 : null);
  const cmvsAnt = escopo.map((l) => l.cmvAnt).filter((v): v is number => v != null);
  const cmvAntMedia = cmvsAnt.length
    ? cmvsAnt.reduce((s, v) => s + v, 0) / cmvsAnt.length
    : (idLoja === '' ? dados?.anterior?.cmv_medio_pct ?? null : null);
  const fornTotais = {
    platlog: escopo.reduce((s, l) => s + l.cmvForn.platlog, 0),
    ambev_coca: escopo.reduce((s, l) => s + l.cmvForn.ambev_coca, 0),
    gimba: escopo.reduce((s, l) => s + l.cmvForn.gimba, 0),
    uniforme: escopo.reduce((s, l) => s + l.cmvForn.uniforme, 0),
  };

  const somaCanais = (c: Caixa | null, ids: string[]) =>
    (c?.canais || []).filter((x) => ids.includes(x.id)).reduce((s, x) => s + x.valor, 0);
  const delivery = somaCanais(caixa, ['ifood', 'food99', 'rappi']);
  const deliveryAnt = somaCanais(caixaAnt, ['ifood', 'food99', 'rappi']);

  const notasAtual = escopo.map((l) => l.nota).filter((n): n is number => n != null && n > 0);
  const notaMedia = notasAtual.length ? notasAtual.reduce((s, n) => s + n, 0) / notasAtual.length : null;
  const notasAnt = escopo
    .map((l) => Number(rkMap.get(l.id_loja)?.nota_anterior))
    .filter((n) => Number.isFinite(n) && n > 0);
  const notaMediaAnt = notasAnt.length ? notasAnt.reduce((s, n) => s + n, 0) / notasAnt.length : null;
  const notasOrdenadas = [...escopo]
    .sort((a, b) => (rkMap.get(a.id_loja)?.posicao_ranking ?? 999) - (rkMap.get(b.id_loja)?.posicao_ranking ?? 999))
    .map((l) => l.nota || 0)
    .reverse();

  /* ----- gráficos ----- */
  const serieCanais = useMemo(() => {
    const porDia = new Map((caixa?.serie || []).map((d) => [d.dia, d]));
    return serie.map((s) => {
      const c = porDia.get(s.dia);
      return {
        dia: diaCurto(s.dia),
        cartoes: c?.cartoes || 0,
        digitais: c?.digitais || 0,
        dinheiro: c?.dinheiro || 0,
        ifood: c?.ifood || 0,
        food99: c?.food99 || 0,
        totalCanal: (c?.cartoes || 0) + (c?.digitais || 0) + (c?.dinheiro || 0) + (c?.ifood || 0) + (c?.food99 || 0),
        venda: s.venda,
      };
    });
  }, [caixa, serie]);
  const temCaixaSerie = serieCanais.some((d) => d.cartoes + d.digitais + d.dinheiro + d.ifood + d.food99 > 0);
  const temVendaSerie = serie.some((s) => s.venda > 0);
  const mixCanais = useMemo(
    () => CANAIS_SERIE.map((canal) => ({
      ...canal,
      valor: serieCanais.reduce((total, dia) => total + Number(dia[canal.key] || 0), 0),
    })).filter((canal) => canal.valor > 0),
    [serieCanais],
  );
  const totalCanais = mixCanais.reduce((total, canal) => total + canal.valor, 0);

  const serieEvolucao = useMemo(
    () => serie.map((s) => ({ dia: diaCurto(s.dia), venda: s.venda, cmv: s.cmv_pct })),
    [serie],
  );

  const linhasCards = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = escopo.filter((l) => !q || l.nome.toLowerCase().includes(q) || l.cidade.toLowerCase().includes(q));
    return lista.sort((a, b) => {
      if (ordemLojas === 'venda') return (b.venda || 0) - (a.venda || 0);
      if (ordemLojas === 'estimativa') return (b.vendaEstimada || 0) - (a.vendaEstimada || 0);
      const ca = a.cmv ?? -1;
      const cb = b.cmv ?? -1;
      return ordemLojas === 'cmv_asc' ? ca - cb : cb - ca;
    });
  }, [escopo, busca, ordemLojas]);

  function exportar() {
    const cab = ['Loja', 'Cidade', 'Vendas', 'Estimativa', 'Gasto CMV', 'CMV %', 'NCs abertas', 'Nota'];
    const fmt = (n: number | null) => (n == null ? '' : n.toFixed(2).replace('.', ','));
    const linhas = linhasCards.map((l) => [
      l.nome, l.cidade, fmt(l.venda), fmt(l.vendaEstimada), fmt(l.cmvGasto), fmt(l.cmv), String(l.ncs), fmt(l.nota),
    ]);
    const csv = [cab, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `indicadores_${de}_${ate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grade = isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.07)';
  const eixo = { fontSize: 12, fill: 'var(--ga-text-muted)' };

  return (
    <Box
      sx={{
        flex: { xs: '0 0 auto', md: 1 },
        minHeight: { md: 0 },
        overflow: { xs: 'visible', md: 'hidden' },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      {/* Barra de filtros */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        useFlexGap
        sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between', flexShrink: 0 }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', letterSpacing: '-0.01em' }}>
          Vendas e CMV em tempo real
          <Typography component="span" sx={{ fontSize: 13, fontWeight: 500, color: 'text.secondary' }}>
            {idLoja === '' ? ` · ${todasLinhas.length} loja${todasLinhas.length === 1 ? '' : 's'}` : ''}
          </Typography>
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', overflow: 'visible' }}>
          <Box sx={{ width: 250, flexShrink: 0, overflow: 'visible' }}>
            <FiltroIntervaloDatasFrota
              compacto
              dataInicio={de}
              dataFim={ate}
              onChangeInicio={setDe}
              onChangeFim={setAte}
            />
          </Box>
          <TextField
            select
            size="small"
            value={idLoja === '' ? '' : String(idLoja)}
            onChange={(ev) => setIdLoja(ev.target.value === '' ? '' : Number(ev.target.value))}
            slotProps={{ select: { displayEmpty: true } }}
            sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { height: 36, fontSize: 13, borderRadius: '10px' } }}
          >
            <MenuItem value="">Todas as lojas</MenuItem>
            {todasLinhas.map((l) => (
              <MenuItem key={l.id_loja} value={String(l.id_loja)}>{l.nome}</MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            size="small"
            startIcon={<RefreshIcon sx={{ fontSize: 18 }} />}
            onClick={() => void carregar()}
            disabled={loading}
            title={atualizadoEm ? `Atualizado às ${atualizadoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : undefined}
            sx={{ height: 36, borderRadius: '10px', bgcolor: AZUL, fontWeight: 700, textTransform: 'none', boxShadow: 'none', px: 1.75 }}
          >
            Atualizar
          </Button>
        </Stack>
      </Stack>

      {loading && <LinearProgress sx={{ borderRadius: 1, height: 3 }} />}
      {erro && <Alert severity="error">{erro}</Alert>}
      {!loading && !erro && todasLinhas.length === 0 && (
        <Alert severity="warning">Nenhuma loja no seu perfil. Confira o vínculo de região ou as lojas do usuário.</Alert>
      )}

      <Box
        sx={{
          flexShrink: 0,
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', xl: 'repeat(5, 1fr)' },
        }}
      >
        <KpiCard
          sparkId="sp-venda"
          icone={<BarChartIcon />}
          cor={AZUL}
          titulo={idLoja === '' ? 'Vendas da rede' : 'Vendas da loja'}
          sub="Líquida no período"
          valor={brl(vendaAtual)}
          delta={<Delta atual={vendaAtual} anterior={vendaAnt || null} />}
          spark={serie.map((s) => s.venda)}
        />
        <KpiCard
          sparkId="sp-delivery"
          icone={<DeliveryDiningOutlinedIcon />}
          cor="#7C3AED"
          titulo="Delivery"
          sub="iFood + 99"
          valor={podeCanais ? brl(delivery) : '—'}
          delta={<Delta atual={delivery} anterior={deliveryAnt || null} />}
          spark={(caixa?.serie || []).map((d) => d.ifood + d.food99)}
        />
        <KpiCard
          sparkId="sp-estimativa"
          icone={<ShowChartIcon />}
          cor="#0F766E"
          titulo="Estimativa do mês"
          sub={vendaProjSimples > 0 ? `Simples ${brl(vendaProjSimples)}` : 'Projeção do mês'}
          valor={brl(vendaEstimada)}
          delta={(
            <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: 'text.secondary' }}>
              Acum. {brl(vendaAtual)}
            </Typography>
          )}
          spark={serie.map((s) => s.venda)}
        />
        <KpiCard
          sparkId="sp-cmv"
          icone={<ShoppingCartOutlinedIcon />}
          cor="#EA580C"
          titulo="CMV"
          sub={`Gasto confirmado sobre a estimativa · meta ${META_CMV}%`}
          valor={pct(cmvAtual)}
          delta={<Delta atual={cmvAtual} anterior={cmvAntMedia} modo="pp" inverso />}
          spark={serie.map((s) => s.cmv_pct || 0)}
        />
        <KpiCard
          sparkId="sp-nota"
          icone={<StarBorderRoundedIcon />}
          cor="#4F46E5"
          titulo={idLoja === '' ? 'Nota média da rede' : 'Nota da loja'}
          sub="Média das avaliações"
          valor={notaMedia != null ? `${Math.round(notaMedia)}%` : '—'}
          delta={<Delta atual={notaMedia} anterior={notaMediaAnt} modo="pp" />}
          spark={notasOrdenadas}
        />
      </Box>

      <Paper elevation={0} sx={{ ...portalPanelSx, px: 1.5, py: 1, flexShrink: 0 }}>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ minWidth: 0, mr: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary', lineHeight: 1.2 }}>
              Fornecedores
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
              {brl(gastoCmv)}
            </Typography>
          </Box>
          <Box sx={{ flex: '1 1 180px', minWidth: 140, height: 8, borderRadius: 99, bgcolor: grade, display: 'flex', overflow: 'hidden' }}>
            {FORN_CMV.map((f) => {
              const share = gastoCmv > 0 ? (fornTotais[f.key] / gastoCmv) * 100 : 0;
              if (share <= 0) return null;
              return <Box key={f.key} sx={{ width: `${share}%`, bgcolor: f.cor }} />;
            })}
          </Box>
          {FORN_CMV.map((f) => {
            const valor = fornTotais[f.key];
            const share = gastoCmv > 0 ? (valor / gastoCmv) * 100 : 0;
            return (
              <Stack key={f.key} direction="row" spacing={0.6} sx={{ alignItems: 'baseline', minWidth: 0 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: f.cor, alignSelf: 'center', flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: f.cor }} noWrap>{f.label}</Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }} noWrap>{brl(valor)}</Typography>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{num1(share)}%</Typography>
              </Stack>
            );
          })}
        </Stack>
      </Paper>

      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '1 1 0' },
          minHeight: { xs: 260, md: 0 },
          height: { xs: 280, md: 'auto' },
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          gridTemplateRows: 'minmax(0, 1fr)',
          overflow: 'hidden',
        }}
      >
        <Painel
          icone={<BarChartIcon />}
          cor={AZUL}
          titulo="Performance por canal"
          extra={temCaixaSerie ? (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={modoCanal}
              onChange={(_e, v) => { if (v) setModoCanal(v); }}
              sx={{
                '& .MuiToggleButton-root': { textTransform: 'none', fontSize: 12, fontWeight: 600, px: 1.25, py: 0.35 },
                '& .Mui-selected': { bgcolor: `${AZUL} !important`, color: '#fff !important' },
              }}
            >
              <ToggleButton value="valor">Vendas</ToggleButton>
              <ToggleButton value="pct">% Participação</ToggleButton>
            </ToggleButtonGroup>
          ) : null}
        >
          {!podeCanais && !temVendaSerie ? (
            <Vazio texto="Sem permissão de resumo financeiro para ver os canais do caixa." />
          ) : temCaixaSerie ? (
            <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 124px', gap: 0.75 }}>
              <Box sx={{ minWidth: 0, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={serieCanais} stackOffset={modoCanal === 'pct' ? 'expand' : 'none'} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={grade} strokeDasharray="3 3" />
                    <XAxis dataKey="dia" tick={{ ...eixo, fontSize: 9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis
                      tick={{ ...eixo, fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      width={55}
                      tickFormatter={(v: number) => (modoCanal === 'pct' ? `${Math.round(v * 100)}%` : brlCurto(v))}
                    />
                    <RTooltip
                      {...tooltipStyle}
                      formatter={(v, nome) => [
                        brl(Number(v)),
                        nome === 'totalCanal' ? 'Total do dia' : CANAIS_SERIE.find((c) => c.key === nome)?.label || String(nome),
                      ]}
                    />
                    {CANAIS_SERIE.map((c, i) => (
                      <Bar
                        key={c.key}
                        dataKey={c.key}
                        stackId="a"
                        fill={c.cor}
                        radius={i === CANAIS_SERIE.length - 1 ? [3, 3, 0, 0] : 0}
                        maxBarSize={30}
                      />
                    ))}
                    {modoCanal === 'valor' ? (
                      <Line type="monotone" dataKey="totalCanal" stroke="var(--ga-text-primary)" strokeWidth={1.6} dot={{ r: 2, fill: 'var(--ga-surface)' }} activeDot={{ r: 3 }} />
                    ) : null}
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ height: 100, position: 'relative', flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={mixCanais} dataKey="valor" nameKey="label" innerRadius="58%" outerRadius="86%" paddingAngle={2} stroke="none">
                        {mixCanais.map((canal) => <Cell key={canal.key} fill={canal.cor} />)}
                      </Pie>
                      <RTooltip {...tooltipStyle} formatter={(v) => brl(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
                    <Typography sx={{ fontSize: 7.5, fontWeight: 750, color: 'text.secondary', lineHeight: 1 }}>TOTAL</Typography>
                    <Typography sx={{ fontSize: 10, fontWeight: 900, lineHeight: 1.2 }}>{brlCurto(totalCanais)}</Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.3 }}>
                  {mixCanais.map((canal) => (
                    <Box key={canal.key} sx={{ display: 'grid', gridTemplateColumns: '6px 1fr auto', alignItems: 'center', gap: 0.35 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: canal.cor }} />
                      <Typography sx={{ fontSize: 8.5, fontWeight: 700, color: 'text.secondary' }} noWrap>{canal.label}</Typography>
                      <Typography sx={{ fontSize: 8.5, fontWeight: 850 }}>
                        {totalCanais > 0 ? `${Math.round((canal.valor / totalCanais) * 100)}%` : '0%'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          ) : temVendaSerie ? (
            <>
              <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mb: 1 }}>
                Sem fechamento de caixa no período — mostrando a venda do estoque por dia.
              </Typography>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serieCanais} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={grade} />
                    <XAxis dataKey="dia" tick={eixo} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={eixo} tickLine={false} axisLine={false} width={72} tickFormatter={(v: number) => brlCurto(v)} />
                    <RTooltip {...tooltipStyle} formatter={(v) => [brl(Number(v)), 'Venda']} />
                    <Bar dataKey="venda" fill={AZUL} radius={[3, 3, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </>
          ) : (
            <Vazio texto="Sem vendas nem fechamento de caixa no período selecionado." />
          )}
        </Painel>

        {podeFinCc ? (
          <CcFinancePanel despesas={ccOps.despesas} loading={ccOps.loading} grade={grade} />
        ) : (
          <Painel icone={<ShowChartIcon />} cor="#0F766E" titulo="Vendas × CMV">
            {temVendaSerie ? (
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={serieEvolucao} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={grade} />
                    <XAxis dataKey="dia" tick={eixo} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis yAxisId="r" tick={eixo} tickLine={false} axisLine={false} width={72} tickFormatter={(v: number) => brlCurto(v)} />
                    <YAxis yAxisId="p" orientation="right" tick={eixo} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${v}%`} />
                    <Area yAxisId="r" type="monotone" dataKey="venda" stroke={AZUL} strokeWidth={2} fill="rgba(27,110,243,.12)" />
                    <Line yAxisId="p" type="monotone" dataKey="cmv" stroke="#DC2626" strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            ) : <Vazio texto="Sem vendas registradas no período." />}
          </Painel>
        )}
      </Box>

      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '1 1 0' },
          minHeight: { xs: 420, md: 0 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: podeEstoqueCc ? '1fr 1fr' : '1fr' },
          gridTemplateRows: 'minmax(0,1fr)',
          gap: 1.15,
          overflow: 'hidden',
        }}
      >
        <CcStorePerformance
          linhas={linhasCards}
          idLoja={idLoja}
          onSelectLoja={setIdLoja}
          busca={busca}
          onBusca={setBusca}
          onOrdem={setOrdemLojas}
          onExportar={exportar}
        />
        {podeEstoqueCc ? (
          <CcCountPanel lojas={ccOps.contagem} loading={ccOps.loadingContagem} error={ccOps.erroContagem} />
        ) : null}
      </Box>
    </Box>
  );
}
