import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardEvolucaoPonto } from '../../../api/client';
import { fmtDelta, fmtPct } from './ccFormat';
import { CcEmpty, CcPanel, CcSkeleton } from './CcPanel';

export default function CcEvolucao({
  loading,
  serie,
  mediaAtual,
  variacaoMes,
}: {
  loading?: boolean;
  serie: DashboardEvolucaoPonto[];
  mediaAtual: number;
  variacaoMes?: number | null;
}) {
  const dados = useMemo(
    () =>
      serie.map((p) => ({
        ...p,
        rotuloCurto: (p.rotulo || '').split('/')[0] || p.rotulo,
      })),
    [serie],
  );

  const ultimo = dados[dados.length - 1];
  const delta = fmtDelta(variacaoMes);

  return (
    <CcPanel
      title="Evolução da performance"
      subtitle="Últimos 6 meses"
      minHeight={260}
    >
      {loading ? (
        <CcSkeleton height={200} />
      ) : !dados.length ? (
        <CcEmpty>Sem histórico de performance para o período.</CcEmpty>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 750, color: 'var(--ga-text-primary)' }}>
              {fmtPct(ultimo?.media ?? mediaAtual)}
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'var(--ga-text-secondary)' }}>
              {ultimo?.rotulo || 'Período atual'}
            </Typography>
            {delta && (
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 650,
                  color: delta.positivo ? '#16A34A' : '#DC2626',
                }}
              >
                {delta.positivo ? '▲' : '▼'} {delta.valor}% vs. mês anterior
              </Typography>
            )}
          </Box>

          <Box sx={{ flex: 1, minHeight: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dados} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="ccPerfFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8520A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#E8520A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="rotuloCurto"
                  tick={{ fill: 'var(--ga-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tick={{ fill: 'var(--ga-text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value) => [fmtPct(Number(value)), 'Performance']}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.rotulo || String(label)}
                  contentStyle={{
                    background: 'var(--ga-surface)',
                    border: '1px solid var(--ga-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="media"
                  stroke="#E8520A"
                  strokeWidth={2.5}
                  fill="url(#ccPerfFill)"
                  dot={{ r: 3, fill: '#E8520A', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        </>
      )}
    </CcPanel>
  );
}
