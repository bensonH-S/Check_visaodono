import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Link as RouterLink } from 'react-router-dom';
import { GRAVIDADE_CORES } from '../dashboardCharts';
import { fmtInt, fmtPct } from './ccFormat';
import { CcEmpty, CcPanel, CcSkeleton } from './CcPanel';

type NcGravidade = { gravidade: string; total: number };

const LABEL: Record<string, string> = {
  Crítica: 'Críticas',
  Moderada: 'Moderadas',
  Baixa: 'Leves',
  Leve: 'Leves',
};

export default function CcNcsDonut({
  loading,
  ncsPorGravidade,
  totalAbertas,
}: {
  loading?: boolean;
  ncsPorGravidade: NcGravidade[];
  totalAbertas: number;
}) {
  const dados = useMemo(
    () =>
      ncsPorGravidade.map((n) => ({
        ...n,
        name: LABEL[n.gravidade] || n.gravidade,
        pct: totalAbertas > 0 ? (n.total / totalAbertas) * 100 : 0,
      })),
    [ncsPorGravidade, totalAbertas],
  );

  return (
    <CcPanel
      title="Não conformidades por criticidade"
      action="Ver todas as NCs"
      actionTo="/nao-conformidades"
      minHeight={220}
      sx={{ p: { xs: 1.25, md: 2.25 } }}
    >
      {loading ? (
        <CcSkeleton height={160} />
      ) : !dados.length ? (
        <CcEmpty>Nenhuma não conformidade em aberto.</CcEmpty>
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, md: 2 },
            flex: 1,
            minHeight: { xs: 140, md: 180 },
            minWidth: 0,
          }}
        >
          <Box
            sx={{
              width: { xs: 88, sm: 110, md: 130, lg: 150 },
              height: { xs: 88, sm: 110, md: 130, lg: 150 },
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="total"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={3}
                  stroke="none"
                >
                  {dados.map((entry) => (
                    <Cell key={entry.gravidade} fill={GRAVIDADE_CORES[entry.gravidade] ?? '#9CA3AF'} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [fmtInt(Number(value)), 'NCs']}
                  contentStyle={{
                    background: 'var(--ga-surface)',
                    border: '1px solid var(--ga-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: '0.95rem', md: '1.25rem' },
                  fontWeight: 750,
                  color: 'var(--ga-text-primary)',
                  lineHeight: 1,
                }}
              >
                {fmtInt(totalAbertas)}
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.55rem', md: '0.65rem' }, color: 'var(--ga-text-muted)', mt: 0.25 }}>
                total
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: { xs: 0.65, md: 1.1 }, minWidth: 0 }}>
            {dados.map((d) => (
              <Box
                key={d.gravidade}
                component={RouterLink}
                to={`/nao-conformidades?status=Em+aberto&gravidade=${encodeURIComponent(d.gravidade)}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 0.75,
                  textDecoration: 'none',
                  color: 'inherit',
                  minWidth: 0,
                  '&:hover .cc-nc-name': { color: 'var(--ga-orange)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      bgcolor: GRAVIDADE_CORES[d.gravidade] ?? '#9CA3AF',
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    className="cc-nc-name"
                    sx={{
                      fontSize: { xs: '0.65rem', md: '0.78rem' },
                      color: 'var(--ga-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {d.name}
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    fontSize: { xs: '0.65rem', md: '0.78rem' },
                    fontWeight: 650,
                    color: 'var(--ga-text-primary)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {fmtInt(d.total)}
                  <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    {' '}
                    · {fmtPct(d.pct)}
                  </Box>
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </CcPanel>
  );
}
