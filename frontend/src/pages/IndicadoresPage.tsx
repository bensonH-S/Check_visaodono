import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import BarChartIcon from '@mui/icons-material/BarChart';
import DeliveryDiningOutlinedIcon from '@mui/icons-material/DeliveryDiningOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
import { getUsuario, podeVerResumoFinanceiro } from '../lib/auth';
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
    <Box sx={{ width: 64, height: 28, flexShrink: 0 }}>
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

type Densidade = 'denso' | 'normal' | 'folgado';

function KpiCard({ icone, cor, titulo, sub, valor, delta, spark, sparkId, densidade }: {
  icone: ReactNode;
  cor: string;
  titulo: string;
  sub: string;
  valor: string;
  delta: ReactNode;
  spark?: number[];
  sparkId: string;
  densidade: Densidade;
}) {
  const denso = densidade === 'denso';
  const folgado = densidade === 'folgado';
  return (
    <Paper
      elevation={0}
      sx={{
        ...portalPanelSx,
        p: denso ? 1.35 : folgado ? 2 : 1.75,
        display: 'flex',
        flexDirection: 'column',
        gap: denso ? 0.7 : folgado ? 1.1 : 0.95,
        minWidth: 0,
      }}
    >
      <Stack direction="row" spacing={1.1} alignItems="center">
        <Box
          sx={{
            width: denso ? 32 : folgado ? 40 : 36,
            height: denso ? 32 : folgado ? 40 : 36,
            borderRadius: 1.75,
            display: 'grid',
            placeItems: 'center',
            bgcolor: `${cor}1A`,
            color: cor,
            flexShrink: 0,
            '& .MuiSvgIcon-root': { fontSize: denso ? 18 : folgado ? 22 : 20 },
          }}
        >
          {icone}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: denso ? 12.5 : folgado ? 14 : 13.5, fontWeight: 700, color: 'text.primary', lineHeight: 1.25 }} noWrap>{titulo}</Typography>
          <Typography sx={{ fontSize: denso ? 11 : folgado ? 12.5 : 12, color: 'text.secondary', lineHeight: 1.25 }} noWrap>{sub}</Typography>
        </Box>
        {spark ? <Sparkline data={spark} cor={cor} id={sparkId} /> : null}
      </Stack>
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={0.75}>
        <Typography
          sx={{
            fontSize: denso ? { xs: 19, lg: 21 } : folgado ? { xs: 22, lg: 26 } : { xs: 21, lg: 24 },
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            color: 'text.primary',
          }}
        >
          {valor}
        </Typography>
        {delta}
      </Stack>
    </Paper>
  );
}

function Painel({ icone, titulo, extra, children, densidade }: {
  icone: ReactNode;
  titulo: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  densidade: Densidade;
}) {
  const denso = densidade === 'denso';
  return (
    <Paper
      elevation={0}
      sx={{
        ...portalPanelSx,
        p: denso ? 1.5 : 1.85,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: denso ? 1 : 1.25, flexShrink: 0 }}>
        <Stack direction="row" spacing={0.85} alignItems="center" sx={{ minWidth: 0 }}>
          <Box sx={{ color: AZUL, display: 'flex', '& .MuiSvgIcon-root': { fontSize: denso ? 18 : 20 } }}>{icone}</Box>
          <Typography sx={{ fontSize: denso ? 13.5 : 14.5, fontWeight: 800, color: 'text.primary' }} noWrap>{titulo}</Typography>
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
  /** Desktop/tablet: dash preenche a viewport — scroll só dentro dos painéis. */
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  /** Altura da tela manda na densidade (não comprime em monitor alto). */
  const telaBaixa = useMediaQuery('(max-height: 800px)');
  const telaAlta = useMediaQuery('(min-height: 980px)');
  const densidade: Densidade = telaBaixa ? 'denso' : telaAlta ? 'folgado' : 'normal';
  const denso = densidade === 'denso';
  const folgado = densidade === 'folgado';
  const user = getUsuario();
  const podeCanais = podeVerResumoFinanceiro(user);

  const hoje = hojeIso();
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
  const [cidade, setCidade] = useState('');
  const [ordemCmv, setOrdemCmv] = useState<'desc' | 'asc'>('desc');
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
        venda: s.venda,
      };
    });
  }, [caixa, serie]);
  const temCaixaSerie = serieCanais.some((d) => d.cartoes + d.digitais + d.dinheiro + d.ifood + d.food99 > 0);
  const temVendaSerie = serie.some((s) => s.venda > 0);

  const serieEvolucao = useMemo(
    () => serie.map((s) => ({ dia: diaCurto(s.dia), venda: s.venda, cmv: s.cmv_pct })),
    [serie],
  );

  /** CMV % por loja — o painel que importa para decisão. */
  const cmvPorLojaChart = useMemo(() => {
    const lista = escopo
      .filter((l) => l.cmv != null || l.cmvGasto > 0 || l.venda > 0)
      .map((l) => ({
        id: l.id_loja,
        nome: l.nome.replace(/^BK\s*\d+\s*-\s*/i, '').slice(0, 16),
        nomeFull: l.nome,
        cmv: l.cmv ?? 0,
        semCmv: l.cmv == null,
        gasto: l.cmvGasto,
        meta: l.cmvMeta,
        venda: l.venda,
        estimativa: l.vendaEstimada,
      }));
    lista.sort((a, b) => (ordemCmv === 'desc' ? b.cmv - a.cmv : a.cmv - b.cmv));
    return lista;
  }, [escopo, ordemCmv]);

  const cidades = useMemo(() => [...new Set(todasLinhas.map((l) => l.cidade).filter((c) => c && c !== '—'))].sort(), [todasLinhas]);

  const linhasCards = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = escopo.filter((l) =>
      (!q || l.nome.toLowerCase().includes(q) || l.cidade.toLowerCase().includes(q))
      && (!cidade || l.cidade === cidade));
    return lista.sort((a, b) => {
      const ca = a.cmv ?? -1;
      const cb = b.cmv ?? -1;
      return ordemCmv === 'desc' ? cb - ca : ca - cb;
    });
  }, [escopo, busca, cidade, ordemCmv]);

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
  const eixo = { fontSize: denso ? 10 : folgado ? 12 : 11, fill: 'var(--ga-text-muted)' };
  const gapPagina = denso ? 0.9 : folgado ? 1.5 : 1.25;

  /** Colunas do grid de lojas — evita “buracos” quando a região tem poucas lojas. */
  const qtdLojas = linhasCards.length;
  const colsLojas = useMemo(() => {
    const n = qtdLojas;
    if (n <= 1) return 1;
    if (n <= 2) return 2;
    if (n <= 4) return 2;
    if (n <= 6) return 3;
    if (n <= 9) return 3;
    if (n <= 12) return 4;
    return 5;
  }, [qtdLojas]);
  const lojasEmLista = qtdLojas > 0 && qtdLojas <= 8;

  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        /** No desktop o scroll fica só nos painéis internos — tudo cabe no dash. */
        overflowY: desktop ? 'hidden' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: gapPagina,
        pb: desktop ? 0 : 1.5,
      }}
    >
      {/* Barra de filtros */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        alignItems={{ md: 'center' }}
        justifyContent="space-between"
        sx={{ flexShrink: 0 }}
      >
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
          Vendas e CMV em tempo real
          {idLoja === '' ? ` · ${todasLinhas.length} loja(s)` : ''}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ overflow: 'visible' }}>
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
            sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { height: 34, fontSize: 13, borderRadius: '10px' } }}
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
            sx={{ height: 34, borderRadius: '10px', bgcolor: AZUL, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}
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

      {/* KPIs — densidade conforme altura da tela */}
      <Box
        sx={{
          flexShrink: 0,
          display: 'grid',
          gap: gapPagina,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)', xl: 'repeat(5, 1fr)' },
        }}
      >
        <KpiCard
          densidade={densidade}
          sparkId="sp-venda"
          icone={<BarChartIcon />}
          cor={AZUL}
          titulo={idLoja === '' ? 'Vendas da rede' : 'Vendas da loja'}
          sub="Venda líquida acumulada"
          valor={brl(vendaAtual)}
          delta={<Delta atual={vendaAtual} anterior={vendaAnt || null} />}
          spark={serie.map((s) => s.venda)}
        />
        <KpiCard
          densidade={densidade}
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
          densidade={densidade}
          sparkId="sp-estimativa"
          icone={<ShowChartIcon />}
          cor="#0F766E"
          titulo="Estimativa do mês"
          sub={vendaProjSimples > 0 ? `Simples ${brl(vendaProjSimples)} · por weekday` : 'Projeção inteligente'}
          valor={brl(vendaEstimada)}
          delta={(
            <Typography sx={{ fontSize: denso ? 11 : 12, color: 'text.secondary' }}>
              Acum. {brl(vendaAtual)}
            </Typography>
          )}
          spark={serie.map((s) => s.venda)}
        />
        <KpiCard
          densidade={densidade}
          sparkId="sp-cmv"
          icone={<ShoppingCartOutlinedIcon />}
          cor="#EA580C"
          titulo="CMV"
          sub={`NFs confirmadas ÷ estimativa · meta ${META_CMV}%`}
          valor={pct(cmvAtual)}
          delta={<Delta atual={cmvAtual} anterior={cmvAntMedia} modo="pp" inverso />}
          spark={serie.map((s) => s.cmv_pct || 0)}
        />
        <KpiCard
          densidade={densidade}
          sparkId="sp-nota"
          icone={<StarBorderRoundedIcon />}
          cor="#4F46E5"
          titulo={idLoja === '' ? 'Nota média da rede' : 'Nota da loja'}
          sub="Avaliações das lojas"
          valor={notaMedia != null ? `${Math.round(notaMedia)}%` : '—'}
          delta={<Delta atual={notaMedia} anterior={notaMediaAnt} modo="pp" />}
          spark={notasOrdenadas}
        />
      </Box>

      {/* CMV por fornecedor */}
      <Paper elevation={0} sx={{ ...portalPanelSx, px: folgado ? 2 : 1.75, py: denso ? 1 : folgado ? 1.35 : 1.15, flexShrink: 0 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography sx={{ fontSize: denso ? 12 : 13, fontWeight: 800, whiteSpace: 'nowrap' }}>
            Fornecedores · {brl(gastoCmv)}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', display: { xs: 'none', md: 'block' } }}>
            só NF confirmada
          </Typography>
          {FORN_CMV.map((f) => {
            const valor = fornTotais[f.key];
            const share = gastoCmv > 0 ? (valor / gastoCmv) * 100 : 0;
            return (
              <Stack key={f.key} direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0, flex: '1 1 130px', maxWidth: 220 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: f.cor, flexShrink: 0 }} />
                <Typography sx={{ fontSize: denso ? 11 : 12, fontWeight: 700, color: f.cor }} noWrap>{f.label}</Typography>
                <Typography sx={{ fontSize: denso ? 11 : 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', ml: 'auto' }}>{brl(valor)}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 36, textAlign: 'right' }}>{num1(share)}%</Typography>
              </Stack>
            );
          })}
        </Stack>
      </Paper>

      {/* Gráficos — ocupam o espaço livre da tela */}
      <Box
        sx={{
          flex: desktop ? '1.2 1 0' : 'none',
          minHeight: desktop ? 0 : 300,
          display: 'grid',
          gap: gapPagina,
          gridTemplateColumns: { xs: '1fr', lg: '1.05fr 1fr 1fr' },
        }}
      >
        <Painel
          densidade={densidade}
          icone={<ShoppingCartOutlinedIcon sx={{ color: '#EA580C' }} />}
          titulo="CMV por loja"
          extra={(
            <Tooltip title="Ordena: maior CMV primeiro (críticos no topo) ou menor CMV primeiro.">
              <ToggleButtonGroup
                exclusive
                size="small"
                value={ordemCmv}
                onChange={(_e, v) => { if (v) setOrdemCmv(v); }}
                sx={{
                  '& .MuiToggleButton-root': { textTransform: 'none', fontSize: 10.5, fontWeight: 600, px: 0.75, py: 0.2, lineHeight: 1.2 },
                  '& .Mui-selected': { bgcolor: `${AZUL} !important`, color: '#fff !important' },
                }}
              >
                <ToggleButton value="desc">↑ CMV</ToggleButton>
                <ToggleButton value="asc">↓ CMV</ToggleButton>
              </ToggleButtonGroup>
            </Tooltip>
          )}
        >
          {cmvPorLojaChart.length === 0 ? (
            <Vazio texto="Sem CMV no período — confirme entradas de Platlog, Ambev/Coca, Gimba e Uniforme." />
          ) : (
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: denso ? 0.45 : 0.55,
              }}
            >
              <Typography sx={{ fontSize: 10.5, color: 'text.secondary', flexShrink: 0, mb: 0.25 }}>
                Meta {META_CMV}% · clique para filtrar
              </Typography>
              {cmvPorLojaChart.map((row) => {
                const cor = row.semCmv ? '#94A3B8' : row.cmv > row.meta ? '#DC2626' : row.cmv > row.meta - 5 ? '#EA580C' : '#16A34A';
                const maxEscala = Math.max(META_CMV + 10, ...cmvPorLojaChart.map((r) => r.cmv), 1);
                const pctBarra = Math.min(100, (row.cmv / maxEscala) * 100);
                const pctMeta = Math.min(100, (META_CMV / maxEscala) * 100);
                const ativo = row.id === idLoja;
                return (
                  <Box
                    key={row.id}
                    onClick={() => setIdLoja(ativo ? '' : row.id)}
                    sx={{
                      px: 1,
                      py: denso ? 0.55 : 0.7,
                      borderRadius: 1.25,
                      border: '1px solid',
                      borderColor: ativo ? AZUL : 'transparent',
                      bgcolor: ativo
                        ? (isDark ? 'rgba(27,110,243,0.12)' : 'rgba(27,110,243,0.06)')
                        : 'transparent',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.03)' },
                      flex: cmvPorLojaChart.length <= 8 ? '1 1 0' : '0 0 auto',
                      minHeight: denso ? 36 : 40,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 0.4,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                      <Typography sx={{ fontSize: denso ? 11.5 : 12.5, fontWeight: 700, minWidth: 0 }} noWrap title={row.nomeFull}>
                        {row.nome}
                      </Typography>
                      <Typography sx={{ fontSize: denso ? 12.5 : 13.5, fontWeight: 800, color: cor, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {row.semCmv ? '—' : pct(row.cmv)}
                      </Typography>
                    </Stack>
                    <Box sx={{ position: 'relative', height: denso ? 5 : 6, borderRadius: 99, bgcolor: grade }}>
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${pctBarra}%`,
                          borderRadius: 99,
                          bgcolor: cor,
                        }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          left: `${pctMeta}%`,
                          top: -2,
                          bottom: -2,
                          width: 2,
                          bgcolor: '#DC2626',
                          borderRadius: 1,
                          opacity: 0.85,
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Painel>

        <Painel
          densidade={densidade}
          icone={<BarChartIcon />}
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
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serieCanais} stackOffset={modoCanal === 'pct' ? 'expand' : 'none'} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={grade} />
                  <XAxis dataKey="dia" tick={eixo} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={eixo}
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    tickFormatter={(v: number) => (modoCanal === 'pct' ? `${Math.round(v * 100)}%` : brlCurto(v))}
                  />
                  <RTooltip
                    {...tooltipStyle}
                    formatter={(v: number, nome: string) => [brl(v), CANAIS_SERIE.find((c) => c.key === nome)?.label || nome]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(v: string) => CANAIS_SERIE.find((c) => c.key === v)?.label || v}
                  />
                  {CANAIS_SERIE.map((c, i) => (
                    <Bar
                      key={c.key}
                      dataKey={c.key}
                      stackId="a"
                      fill={c.cor}
                      radius={i === CANAIS_SERIE.length - 1 ? [3, 3, 0, 0] : 0}
                      maxBarSize={22}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
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
                    <YAxis tick={eixo} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => brlCurto(v)} />
                    <RTooltip {...tooltipStyle} formatter={(v: number) => [brl(v), 'Venda']} />
                    <Bar dataKey="venda" fill={AZUL} radius={[3, 3, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </>
          ) : (
            <Vazio texto="Sem vendas nem fechamento de caixa no período selecionado." />
          )}
        </Painel>

        <Painel densidade={densidade} icone={<ShowChartIcon />} titulo="Evolução vendas × CMV (gasto ÷ estimativa)">
          {temVendaSerie ? (
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serieEvolucao} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ev-venda" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AZUL} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={AZUL} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={grade} />
                  <XAxis dataKey="dia" tick={eixo} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis yAxisId="r" tick={eixo} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => brlCurto(v)} />
                  <YAxis yAxisId="p" orientation="right" tick={eixo} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => `${v}%`} />
                  <RTooltip
                    {...tooltipStyle}
                    formatter={(v: number | null, nome: string) => {
                      if (nome === 'venda') return [brl(v), 'Vendas'];
                      return [pct(v), 'CMV'];
                    }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(v: string) => (v === 'venda' ? 'Vendas (R$)' : 'CMV (%)')}
                  />
                  <Area yAxisId="r" type="monotone" dataKey="venda" stroke={AZUL} strokeWidth={2} fill="url(#ev-venda)" dot={{ r: 2.5 }} />
                  <Line yAxisId="p" type="monotone" dataKey="cmv" stroke="#DC2626" strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Vazio texto="Sem vendas registradas no estoque para o período." />
          )}
        </Painel>
      </Box>

      {/* Cards por loja — preenche o restante da viewport; scroll só aqui se precisar */}
      <Paper
        elevation={0}
        sx={{
          ...portalPanelSx,
          p: denso ? 1.25 : folgado ? 1.75 : 1.5,
          flex: desktop ? '1 1 0' : 'none',
          minHeight: desktop ? 0 : undefined,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          alignItems={{ md: 'center' }}
          justifyContent="space-between"
          sx={{ mb: denso ? 1 : 1.25, flexShrink: 0 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <StorefrontOutlinedIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
            <Typography sx={{ fontSize: denso ? 13 : 14.5, fontWeight: 800 }}>
              Lojas · CMV · vendas
              <Typography component="span" sx={{ fontSize: denso ? 11.5 : 12.5, color: 'text.secondary', fontWeight: 500, ml: 0.75 }}>
                {linhasCards.length} · clique para filtrar · meta {META_CMV}%
              </Typography>
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="Buscar loja..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> } }}
              sx={{ width: 190, '& .MuiOutlinedInput-root': { height: denso ? 30 : 34, fontSize: 12.5, borderRadius: '8px' } }}
            />
            <TextField
              select
              size="small"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              slotProps={{ select: { displayEmpty: true } }}
              sx={{ minWidth: 140, '& .MuiOutlinedInput-root': { height: denso ? 30 : 34, fontSize: 12.5, borderRadius: '8px' } }}
            >
              <MenuItem value="">Cidades</MenuItem>
              {cidades.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 16 }} />}
              onClick={exportar}
              disabled={!linhasCards.length}
              sx={{ height: denso ? 30 : 34, borderRadius: '8px', textTransform: 'none', fontWeight: 700, fontSize: 12.5, color: 'text.primary', borderColor: 'divider' }}
            >
              Excel
            </Button>
          </Stack>
        </Stack>

        {linhasCards.length === 0 ? (
          <Typography sx={{ py: 3, textAlign: 'center', fontSize: 12, color: 'text.secondary' }}>
            Nenhuma loja encontrada.
          </Typography>
        ) : lojasEmLista ? (
          /** Poucas lojas (região): lista full-width — sem buracos no grid. */
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: desktop ? 'auto' : 'visible',
              display: 'flex',
              flexDirection: 'column',
              gap: denso ? 0.5 : 0.65,
            }}
          >
            {linhasCards.map((l) => {
              const cmvAlto = l.cmv != null && l.cmv > l.cmvMeta;
              const corCmv = l.cmv == null ? '#64748B' : cmvAlto ? '#DC2626' : '#15803D';
              const barra = l.cmv == null ? 0 : Math.min(100, (l.cmv / Math.max(l.cmvMeta * 1.5, 1)) * 100);
              const ativo = l.id_loja === idLoja;
              return (
                <Box
                  key={l.id_loja}
                  onClick={() => setIdLoja(ativo ? '' : l.id_loja)}
                  sx={{
                    px: denso ? 1.25 : 1.5,
                    py: denso ? 0.85 : 1.05,
                    borderRadius: 1.75,
                    border: '1px solid',
                    borderColor: ativo ? AZUL : 'divider',
                    bgcolor: isDark ? 'rgba(148,163,184,0.04)' : 'rgba(15,23,42,0.015)',
                    cursor: 'pointer',
                    flex: desktop ? '1 1 0' : '0 0 auto',
                    minHeight: denso ? 52 : 58,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 0.55,
                    '&:hover': { borderColor: AZUL },
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Typography sx={{ fontSize: denso ? 12.5 : 13.5, fontWeight: 800, minWidth: 0, flex: 1 }} noWrap>
                      {l.nome}
                    </Typography>
                    <Typography sx={{ fontSize: denso ? 11.5 : 12.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {brl(l.venda)}
                    </Typography>
                    <Typography sx={{ fontSize: denso ? 11.5 : 12.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: 88, textAlign: 'right' }}>
                      est. {brl(l.vendaEstimada)}
                    </Typography>
                    <Typography sx={{ fontSize: denso ? 16 : 18, fontWeight: 800, letterSpacing: '-0.03em', color: corCmv, lineHeight: 1, flexShrink: 0, minWidth: 56, textAlign: 'right' }}>
                      {pct(l.cmv)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={barra}
                    sx={{
                      height: denso ? 4 : 5,
                      borderRadius: 99,
                      bgcolor: grade,
                      '& .MuiLinearProgress-bar': { bgcolor: corCmv, borderRadius: 99 },
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: desktop ? 'auto' : 'visible',
              display: 'grid',
              gap: denso ? 0.85 : folgado ? 1.15 : 1,
              alignContent: desktop ? 'stretch' : 'start',
              gridTemplateColumns: {
                xs: '1fr',
                sm: '1fr 1fr',
                md: `repeat(${Math.min(colsLojas, 3)}, 1fr)`,
                lg: `repeat(${colsLojas}, 1fr)`,
              },
              gridAutoRows: desktop ? '1fr' : 'auto',
            }}
          >
            {linhasCards.map((l) => {
              const cmvAlto = l.cmv != null && l.cmv > l.cmvMeta;
              const corCmv = l.cmv == null ? '#64748B' : cmvAlto ? '#DC2626' : '#15803D';
              const barra = l.cmv == null ? 0 : Math.min(100, (l.cmv / Math.max(l.cmvMeta * 1.5, 1)) * 100);
              return (
                <Box
                  key={l.id_loja}
                  onClick={() => setIdLoja(l.id_loja === idLoja ? '' : l.id_loja)}
                  sx={{
                    px: denso ? 1.15 : 1.35,
                    py: denso ? 1 : 1.2,
                    borderRadius: 1.75,
                    border: '1px solid',
                    borderColor: l.id_loja === idLoja ? AZUL : 'divider',
                    bgcolor: isDark ? 'rgba(148,163,184,0.04)' : 'rgba(15,23,42,0.015)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    minHeight: 0,
                    '&:hover': { borderColor: AZUL },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.75}>
                    <Typography sx={{ fontSize: denso ? 12 : 13, fontWeight: 800, minWidth: 0 }} noWrap>{l.nome}</Typography>
                    <Typography sx={{ fontSize: denso ? 16 : 18, fontWeight: 800, letterSpacing: '-0.03em', color: corCmv, lineHeight: 1, flexShrink: 0 }}>
                      {pct(l.cmv)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={barra}
                    sx={{
                      mt: 0.75,
                      height: denso ? 4 : 5,
                      borderRadius: 99,
                      bgcolor: grade,
                      '& .MuiLinearProgress-bar': { bgcolor: corCmv, borderRadius: 99 },
                    }}
                  />
                  <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
                    <Typography sx={{ fontSize: denso ? 11 : 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                      {brl(l.venda)}
                    </Typography>
                    <Typography sx={{ fontSize: denso ? 11 : 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                      est. {brl(l.vendaEstimada)}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>
    </Box>
  );
}
