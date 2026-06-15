import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { api } from '../api/client';
import type { DashboardData } from '../api/client';
import DashboardMetricCards from '../components/dashboard/DashboardMetricCards';
import DashboardRankingChart from '../components/dashboard/DashboardRankingChart';
import DashboardNcsChart from '../components/dashboard/DashboardNcsChart';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Typography color="error">{err}</Typography>;
  if (!data) return <LinearProgress />;

  const ncsPorGravidade =
    data.ncs_por_gravidade?.length
      ? data.ncs_por_gravidade
      : data.metricas.total_ncs_abertas > 0
        ? [
            { gravidade: 'Crítica', total: data.metricas.ncs_criticas },
            {
              gravidade: 'Moderada',
              total: Math.max(0, data.metricas.total_ncs_abertas - data.metricas.ncs_criticas),
            },
          ].filter((n) => n.total > 0)
        : [];

  const m = data.metricas;

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: { xs: 2, lg: 2.5 } }}>
      <DashboardMetricCards metricas={m} />

      <Grid container spacing={{ xs: 1.5, sm: 2, lg: 2.5 }} sx={{ alignItems: 'stretch' }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <DashboardRankingChart ranking={data.ranking} />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.5, sm: 2 }, height: '100%' }}>
            <DashboardNcsChart
              ncsPorGravidade={ncsPorGravidade}
              totalAbertas={m.total_ncs_abertas}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
