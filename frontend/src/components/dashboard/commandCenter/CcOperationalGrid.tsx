import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { Link as RouterLink } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { EstoqueContagemRedeItem } from '../../../api/client';
import type { Despesa } from '../../../financeiro/api';
import { portalPanelSx } from '../../../theme/tokens';

const AZUL = '#1B6EF3';
const META_CMV = 40;
const FECHADAS = ['paga', 'conciliada', 'cancelada'];

export type OrdemLojas = 'cmv_desc' | 'cmv_asc' | 'venda' | 'estimativa';

export type LinhaOperacional = {
  id_loja: number;
  nome: string;
  cidade: string;
  venda: number;
  vendaEstimada: number;
  cmv: number | null;
  cmvMeta: number;
};

type Props = {
  linhas: LinhaOperacional[];
  idLoja: number | '';
  onSelectLoja: (id: number | '') => void;
  busca: string;
  onBusca: (valor: string) => void;
  ordem: OrdemLojas;
  onOrdem: (ordem: OrdemLojas) => void;
  onExportar: () => void;
  despesas: Despesa[];
  loadingFinanceiro: boolean;
  contagem: EstoqueContagemRedeItem[];
  loadingContagem: boolean;
  erroContagem: string;
  podeFinanceiro: boolean;
  podeEstoque: boolean;
  grade: string;
};

function brl(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function brlCompacto(valor: number) {
  if (Math.abs(valor) >= 1_000_000) return `R$ ${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(valor) >= 1_000) return `R$ ${(valor / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return brl(valor);
}

function valorGrafico(valor: number) {
  if (Math.abs(valor) >= 1_000_000) return `${(valor / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(valor) >= 1_000) return `${Math.round(valor / 1_000).toLocaleString('pt-BR')}k`;
  return Math.round(valor).toLocaleString('pt-BR');
}

function pct(valor: number | null | undefined) {
  if (valor == null || !Number.isFinite(valor)) return '—';
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

const chartTooltipSx = {
  background: 'var(--ga-surface)',
  border: '1px solid var(--ga-border)',
  borderRadius: 8,
  color: 'var(--ga-text-primary)',
  fontSize: 11,
} as const;

function hojeIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

function nomeCurto(nome: string) {
  return String(nome || '')
    .replace(/^BURGER KING\s*[-–]\s*/i, '')
    .replace(/^BK\s*\d+\s*-\s*/i, '')
    .trim() || nome;
}

function PanelHeader({
  icon,
  color,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  color: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.8, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 1.25, display: 'grid', placeItems: 'center', color, bgcolor: `${color}14`, flexShrink: 0 }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 850, letterSpacing: '-0.01em', lineHeight: 1.15 }} noWrap>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 10.5, color: 'text.secondary', lineHeight: 1.2 }} noWrap>
            {subtitle}
          </Typography>
        </Box>
      </Box>
      {action}
    </Box>
  );
}

export function CcStorePerformance({
  linhas,
  idLoja,
  onSelectLoja,
  busca,
  onBusca,
  onOrdem,
  onExportar,
}: Pick<Props, 'linhas' | 'idLoja' | 'onSelectLoja' | 'busca' | 'onBusca' | 'onOrdem' | 'onExportar'>) {
  const [metric, setMetric] = useState<'cmv' | 'venda'>('cmv');
  const [page, setPage] = useState(0);
  const critical = linhas.filter((row) => row.cmv != null && row.cmv > (row.cmvMeta || META_CMV)).length;
  const pageCount = Math.max(1, Math.ceil(linhas.length / 10));
  const pageStart = page * 10;
  const chartRows = linhas.slice(pageStart, pageStart + 10).map((row) => ({
    id: row.id_loja,
    loja: nomeCurto(row.nome).slice(0, 14),
    nomeCompleto: row.nome,
    cmv: row.cmv || 0,
    venda: row.venda,
    estimativa: row.vendaEstimada,
    color: row.cmv == null ? '#94A3B8' : row.cmv > (row.cmvMeta || META_CMV) ? '#DC2626' : row.cmv > (row.cmvMeta || META_CMV) - 5 ? '#EA580C' : '#16A34A',
  }));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
    if (pageCount <= 1) return undefined;
    const timer = window.setInterval(() => setPage((current) => (current + 1) % pageCount), 4500);
    return () => window.clearInterval(timer);
  }, [pageCount]);

  const action = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.45 }}>
      <TextField
        size="small"
        placeholder="Buscar"
        value={busca}
        onChange={(event) => onBusca(event.target.value)}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14 }} /></InputAdornment> } }}
        sx={{ width: 105, '& .MuiOutlinedInput-root': { height: 28, fontSize: 10.5, borderRadius: '7px' } }}
      />
      <Box sx={{ display: 'flex', p: 0.25, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        {(['cmv', 'venda'] as const).map((item) => (
          <Button
            key={item}
            size="small"
            onClick={() => {
              setMetric(item);
              onOrdem(item === 'cmv' ? 'cmv_desc' : 'venda');
            }}
            sx={{
              minWidth: 48,
              height: 23,
              px: 0.7,
              py: 0,
              borderRadius: 0.75,
              textTransform: 'none',
              fontSize: 9.5,
              fontWeight: 800,
              color: metric === item ? '#fff' : 'text.secondary',
              bgcolor: metric === item ? AZUL : 'transparent',
              '&:hover': { bgcolor: metric === item ? AZUL : 'action.hover' },
            }}
          >
            {item === 'cmv' ? 'CMV' : 'Vendas'}
          </Button>
        ))}
      </Box>
      {pageCount > 1 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.1 }}>
          <IconButton
            size="small"
            onClick={() => setPage((current) => (current - 1 + pageCount) % pageCount)}
            sx={{ width: 24, height: 24 }}
            aria-label="Lojas anteriores"
          >
            <ChevronLeftRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <Typography sx={{ minWidth: 22, textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'text.secondary' }}>
            {page + 1}/{pageCount}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setPage((current) => (current + 1) % pageCount)}
            sx={{ width: 24, height: 24 }}
            aria-label="Próximas lojas"
          >
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      ) : null}
      <Tooltip title="Exportar">
        <span>
          <IconButton size="small" disabled={!linhas.length} onClick={onExportar} sx={{ width: 28, height: 28, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <FileDownloadOutlinedIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );

  return (
    <Paper elevation={0} sx={{ ...portalPanelSx, p: 1.15, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PanelHeader
        icon={<StorefrontOutlinedIcon sx={{ fontSize: 17 }} />}
        color={AZUL}
        title="Performance das lojas"
        subtitle={metric === 'cmv'
          ? `${linhas.length ? pageStart + 1 : 0}–${Math.min(pageStart + 10, linhas.length)} de ${linhas.length} · ${critical} críticas · meta ${META_CMV}%`
          : `${linhas.length ? pageStart + 1 : 0}–${Math.min(pageStart + 10, linhas.length)} de ${linhas.length} · vendas acumuladas`}
        action={action}
      />
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {chartRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 12, right: 6, bottom: 10, left: 0 }}>
              <XAxis
                type="category"
                dataKey="loja"
                interval={0}
                height={40}
                tickLine={false}
                axisLine={false}
                angle={-22}
                textAnchor="end"
                tick={{ fontSize: 8.2, fill: 'var(--ga-text-secondary)', fontWeight: 700 }}
              />
              <YAxis
                type="number"
                domain={metric === 'cmv' ? [0, 'dataMax + 8'] : [0, (maximum: number) => maximum * 1.18]}
                width={43}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 8.2, fill: 'var(--ga-text-muted)' }}
                tickFormatter={(value: number) => metric === 'cmv' ? `${value}%` : valorGrafico(value)}
              />
              {metric === 'cmv' ? <ReferenceLine y={META_CMV} stroke="#DC2626" strokeDasharray="3 3" strokeWidth={1.5} /> : null}
              <ChartTooltip
                cursor={{ fill: 'rgba(27,110,243,.05)' }}
                contentStyle={chartTooltipSx}
                labelStyle={{ color: 'var(--ga-text-primary)', fontWeight: 800 }}
                formatter={(value: number) => metric === 'cmv' ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : brl(value)}
              />
              <Bar
                dataKey={metric}
                name={metric === 'cmv' ? 'CMV %' : 'Vendas'}
                radius={[5, 5, 0, 0]}
                maxBarSize={28}
                onClick={(entry) => {
                  const id = Number(entry?.payload?.id);
                  if (Number.isFinite(id)) onSelectLoja(id === idLoja ? '' : id);
                }}
              >
                {chartRows.map((row) => (
                  <Cell key={row.id} fill={row.id === idLoja ? AZUL : metric === 'cmv' ? row.color : AZUL} cursor="pointer" />
                ))}
                <LabelList
                  dataKey={metric}
                  position="top"
                  formatter={(value: number) => metric === 'cmv' ? `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : valorGrafico(value)}
                  style={{ fontSize: 8.5, fontWeight: 800, fill: 'var(--ga-text-primary)' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Nenhuma loja encontrada.</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

type PayableStore = { name: string; total: number; overdue: number; approval: number };

export function CcFinancePanel({ despesas, loading, grade }: Pick<Props, 'despesas' | 'grade'> & { loading: boolean }) {
  const [page, setPage] = useState(0);
  const today = hojeIso();
  const { rows, openTotal } = useMemo(() => {
    const open = despesas.filter((item) => !FECHADAS.includes(item.status));
    const map = new Map<string, PayableStore>();
    for (const item of open) {
      const name = (item.origem || 'Sem loja').trim() || 'Sem loja';
      const current = map.get(name) || { name, total: 0, overdue: 0, approval: 0 };
      const value = Number(item.valor || 0);
      current.total += value;
      if (item.vencimento && item.vencimento < today) {
        current.overdue += 1;
      } else if (item.status === 'pronta') {
        current.approval += 1;
      }
      map.set(name, current);
    }
    return {
      rows: [...map.values()].sort((a, b) => b.total - a.total),
      openTotal: open.reduce((sum, item) => sum + Number(item.valor || 0), 0),
    };
  }, [despesas, today]);
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const pageStart = page * 10;
  const financeChart = rows.slice(pageStart, pageStart + 10).map((row) => ({
    ...row,
    loja: nomeCurto(row.name).slice(0, 12),
    color: row.overdue > 0 ? '#DC2626' : row.approval > 0 ? '#EA580C' : AZUL,
  }));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
    if (pageCount <= 1) return undefined;
    const timer = window.setInterval(() => setPage((current) => (current + 1) % pageCount), 4500);
    return () => window.clearInterval(timer);
  }, [pageCount]);

  const action = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.1 }}>
      {pageCount > 1 ? (
        <>
          <IconButton size="small" onClick={() => setPage((current) => (current - 1 + pageCount) % pageCount)} sx={{ width: 24, height: 24 }} aria-label="Empresas anteriores">
            <ChevronLeftRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <Typography sx={{ minWidth: 22, textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'text.secondary' }}>{page + 1}/{pageCount}</Typography>
          <IconButton size="small" onClick={() => setPage((current) => (current + 1) % pageCount)} sx={{ width: 24, height: 24 }} aria-label="Próximas empresas">
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </>
      ) : null}
      <IconButton component={RouterLink} to="/financeiro" size="small" sx={{ width: 28, height: 28, color: 'text.secondary' }} aria-label="Abrir financeiro">
        <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Box>
  );

  return (
    <Paper elevation={0} sx={{ ...portalPanelSx, p: 1.15, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PanelHeader
        icon={<PaymentsOutlinedIcon sx={{ fontSize: 17 }} />}
        color="#EA580C"
        title="Pendências financeiras"
        subtitle={`${brl(openTotal)} em aberto · ${rows.length ? pageStart + 1 : 0}–${Math.min(pageStart + 10, rows.length)} de ${rows.length} empresas`}
        action={action}
      />
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {financeChart.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={financeChart} margin={{ top: 12, right: 6, bottom: 10, left: 0 }}>
              <CartesianGrid vertical={false} stroke={grade} strokeDasharray="3 3" />
              <XAxis
                type="category"
                dataKey="loja"
                interval={0}
                height={40}
                tickLine={false}
                axisLine={false}
                angle={-22}
                textAnchor="end"
                tick={{ fontSize: 8.2, fill: 'var(--ga-text-secondary)', fontWeight: 700 }}
              />
              <YAxis
                type="number"
                width={45}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 8.2, fill: 'var(--ga-text-muted)' }}
                tickFormatter={(value: number) => valorGrafico(value)}
              />
              <ChartTooltip
                contentStyle={chartTooltipSx}
                labelStyle={{ color: 'var(--ga-text-primary)', fontWeight: 800 }}
              />
              <Bar dataKey="total" name="Em aberto" radius={[5, 5, 0, 0]} maxBarSize={28}>
                {financeChart.map((row) => <Cell key={row.name} fill={row.color} />)}
                <LabelList
                  dataKey="total"
                  position="top"
                  formatter={(value: number) => valorGrafico(value)}
                  style={{ fontSize: 8.5, fontWeight: 800, fill: 'var(--ga-text-primary)' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{loading ? 'Carregando…' : 'Nenhuma pendência.'}</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export function CcCountPanel({ lojas, loading, error }: { lojas: EstoqueContagemRedeItem[]; loading: boolean; error: string }) {
  const [filter, setFilter] = useState<'todas' | 'contou' | 'pendente'>('pendente');
  const counted = lojas.filter((item) => item.status === 'contou').length;
  const pending = lojas.filter((item) => item.status === 'faltou' || item.status === 'aberta');
  const rows = (filter === 'contou' ? lojas.filter((item) => item.status === 'contou') : filter === 'pendente' ? pending : lojas).slice(0, 20);
  const progress = lojas.length ? (counted / lojas.length) * 100 : 0;

  const action = (
    <IconButton component={RouterLink} to="/estoque" size="small" sx={{ width: 28, height: 28, color: 'text.secondary' }} aria-label="Abrir estoque">
      <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />
    </IconButton>
  );

  return (
    <Paper elevation={0} sx={{ ...portalPanelSx, p: 1.15, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PanelHeader
        icon={<FactCheckOutlinedIcon sx={{ fontSize: 17 }} />}
        color="#0F766E"
        title="Contagem diária"
        subtitle={pending.length ? `${pending.length} lojas exigem atenção` : 'Rede em dia'}
        action={action}
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: '78px minmax(0,1fr)', gap: 1, mb: 0.65, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 27, fontWeight: 900, lineHeight: 1, letterSpacing: '-.045em', color: pending.length ? '#EA580C' : '#15803D' }}>
            {loading ? '…' : `${Math.round(progress)}%`}
          </Typography>
          <Typography sx={{ mt: 0.3, fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.04em' }}>
            concluído
          </Typography>
          <Typography sx={{ mt: 0.25, fontSize: 9, color: 'text.secondary' }}>{counted} de {lojas.length} lojas</Typography>
        </Box>
        <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.7 }}>
          <Box sx={{ display: 'flex', height: 11, borderRadius: 99, overflow: 'hidden', bgcolor: 'divider' }}>
            <Box
              onClick={() => setFilter('contou')}
              sx={{ width: `${progress}%`, bgcolor: '#16A34A', cursor: 'pointer', opacity: filter === 'pendente' ? 0.35 : 1 }}
            />
            <Box
              onClick={() => setFilter('pendente')}
              sx={{ flex: 1, bgcolor: pending.length ? '#DC2626' : 'divider', cursor: 'pointer', opacity: filter === 'contou' ? 0.35 : 1 }}
            />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 0.55 }}>
            {[
              { key: 'contou' as const, label: 'Contaram', value: counted, color: '#15803D', bg: 'rgba(22,163,74,.08)' },
              { key: 'pendente' as const, label: 'Pendentes', value: pending.length, color: '#DC2626', bg: 'rgba(220,38,38,.07)' },
            ].map((item) => (
              <Button
                key={item.key}
                size="small"
                onClick={() => setFilter(item.key)}
                sx={{
                  minWidth: 0,
                  height: 30,
                  px: 0.8,
                  borderRadius: 1,
                  justifyContent: 'space-between',
                  border: '1px solid',
                  borderColor: filter === item.key ? item.color : 'divider',
                  bgcolor: filter === item.key ? item.bg : 'transparent',
                  color: item.color,
                  textTransform: 'none',
                  fontSize: 9,
                  fontWeight: 800,
                  '&:hover': { bgcolor: item.bg },
                }}
              >
                <span>{item.label}</span>
                <span style={{ fontSize: 13 }}>{item.value}</span>
              </Button>
            ))}
            <Button
              size="small"
              onClick={() => setFilter('todas')}
              sx={{
                minWidth: 54,
                height: 30,
                px: 0.65,
                borderRadius: 1,
                border: '1px solid',
                borderColor: filter === 'todas' ? AZUL : 'divider',
                bgcolor: filter === 'todas' ? 'rgba(27,110,243,.07)' : 'transparent',
                color: filter === 'todas' ? AZUL : 'text.secondary',
                textTransform: 'none',
                fontSize: 9,
                fontWeight: 800,
              }}
            >
              Todas {lojas.length}
            </Button>
          </Box>
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Typography sx={{ position: 'sticky', top: 0, zIndex: 1, py: 0.25, bgcolor: 'background.paper', fontSize: 8.5, fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {filter === 'contou' ? 'Lojas que contaram' : filter === 'pendente' ? 'Lojas pendentes' : 'Todas as lojas'}
        </Typography>
        {error ? <Typography sx={{ py: 2, fontSize: 11, color: 'text.secondary', textAlign: 'center' }}>{error}</Typography> : null}
        {!error ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2,minmax(0,1fr))', md: 'repeat(4,minmax(0,1fr))' },
              gap: 0.35,
              alignContent: 'start',
            }}
          >
            {rows.map((row) => {
              const ok = row.status === 'contou';
              const who = row.criado_por_nome || row.ultima_por_nome || (ok ? 'Finalizada' : 'Aguardando');
              return (
                <Tooltip key={row.id_loja} title={`${nomeCurto(row.name)} · ${who} · ${ok ? 'Concluída' : 'Pendente'}`}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.45,
                      minWidth: 0,
                      height: 19,
                      px: 0.5,
                      borderRadius: 0.75,
                      bgcolor: ok ? 'rgba(22,163,74,.07)' : 'rgba(220,38,38,.06)',
                      border: '1px solid',
                      borderColor: ok ? 'rgba(22,163,74,.16)' : 'rgba(220,38,38,.14)',
                    }}
                  >
                    <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: ok ? '#16A34A' : '#DC2626', flexShrink: 0 }} />
                    <Typography sx={{ minWidth: 0, fontSize: 9.2, fontWeight: 800, lineHeight: 1 }} noWrap>
                      {nomeCurto(row.name)}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        ) : null}
      </Box>
    </Paper>
  );
}

export default function CcOperationalGrid(props: Props) {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          lg: props.podeFinanceiro && props.podeEstoque
            ? '1.55fr .72fr .72fr'
            : props.podeFinanceiro || props.podeEstoque
              ? '1.65fr .85fr'
              : '1fr',
        },
        gridTemplateRows: 'minmax(0, 1fr)',
        gap: 1.15,
        overflow: 'hidden',
      }}
    >
      <CcStorePerformance
        linhas={props.linhas}
        idLoja={props.idLoja}
        onSelectLoja={props.onSelectLoja}
        busca={props.busca}
        onBusca={props.onBusca}
        onOrdem={props.onOrdem}
        onExportar={props.onExportar}
      />
      {props.podeFinanceiro ? <CcFinancePanel despesas={props.despesas} loading={props.loadingFinanceiro} grade={props.grade} /> : null}
      {props.podeEstoque ? <CcCountPanel lojas={props.contagem} loading={props.loadingContagem} error={props.erroContagem} /> : null}
    </Box>
  );
}
