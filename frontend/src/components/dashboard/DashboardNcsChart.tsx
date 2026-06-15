import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { GRAVIDADE_CORES, dashboardPanelSx, dashboardPanelTitleSx, NAVY } from './dashboardCharts';

type NcGravidade = { gravidade: string; total: number };

type TooltipPayload = {
  name?: string;
  value?: number;
  payload?: { gravidade: string; total: number };
};

function NcsTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const total = item.value ?? item.payload?.total ?? 0;
  const nome = item.name ?? item.payload?.gravidade ?? '';

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        px: 1.25,
        py: 0.75,
        boxShadow: 1,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 700 }}>
        {nome}: {total}
      </Typography>
    </Box>
  );
}

export default function DashboardNcsChart({
  ncsPorGravidade,
  totalAbertas,
}: {
  ncsPorGravidade: NcGravidade[];
  totalAbertas: number;
}) {
  const dados = useMemo(
    () =>
      ncsPorGravidade.map((n) => ({
        gravidade: n.gravidade,
        total: n.total,
        name: n.gravidade,
      })),
    [ncsPorGravidade],
  );

  return (
    <Paper elevation={0} sx={dashboardPanelSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography sx={{ ...dashboardPanelTitleSx, mb: 0 }}>
          <ReportProblemOutlinedIcon sx={{ fontSize: 22, color: '#DC2626' }} />
          NCs em aberto
        </Typography>
        <Chip
          label={totalAbertas}
          size="small"
          sx={{
            fontWeight: 800,
            bgcolor: totalAbertas > 0 ? '#FEE2E2' : '#F3F4F6',
            color: totalAbertas > 0 ? '#DC2626' : 'text.secondary',
          }}
        />
      </Box>

      {dados.length ? (
        <Box sx={{ flex: 1, minHeight: 200, display: 'flex', alignItems: 'center' }}>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={dados}
                dataKey="total"
                nameKey="gravidade"
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={3}
                stroke="none"
              >
                {dados.map((entry) => (
                  <Cell key={entry.gravidade} fill={GRAVIDADE_CORES[entry.gravidade] ?? '#9CA3AF'} />
                ))}
              </Pie>
              <Tooltip content={<NcsTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={32}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ fontSize: '0.75rem', color: '#555', fontWeight: 600 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Nenhuma não conformidade em aberto.
          </Typography>
        </Box>
      )}

      <Button
        component={Link}
        to="/nao-conformidades"
        fullWidth
        size="small"
        variant="outlined"
        sx={{ mt: 1.5, borderColor: NAVY, color: NAVY, fontWeight: 600 }}
      >
        Ver todas as NCs
      </Button>
    </Paper>
  );
}
