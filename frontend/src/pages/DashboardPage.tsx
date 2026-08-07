import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { api } from '../api/client';
import type { DashboardData, DashboardSaudeLojasData } from '../api/client';
import DashboardMetricCards from '../components/dashboard/DashboardMetricCards';
import DashboardRankingChart from '../components/dashboard/DashboardRankingChart';
import DashboardNcsChart from '../components/dashboard/DashboardNcsChart';
import DashboardSaudeLojas from '../components/dashboard/DashboardSaudeLojas';
import { colors } from '../theme/tokens';

type Modo = 'rede' | 'loja';

export default function DashboardPage() {
  const [modo, setModo] = useState<Modo>('rede');
  const [data, setData] = useState<DashboardData | null>(null);
  const [saude, setSaude] = useState<DashboardSaudeLojasData | null>(null);
  const [err, setErr] = useState('');
  const [errSaude, setErrSaude] = useState('');
  const [loadingSaude, setLoadingSaude] = useState(false);
  const [idLojaFoco, setIdLojaFoco] = useState<number | null>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (modo !== 'loja') return;
    if (saude) return;
    setLoadingSaude(true);
    setErrSaude('');
    api
      .dashboardSaudeLojas()
      .then(setSaude)
      .catch((e) => setErrSaude(e.message || 'Não foi possível carregar a saúde das lojas.'))
      .finally(() => setLoadingSaude(false));
  }, [modo, saude]);

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
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={modo}
          onChange={(_e, v: Modo | null) => {
            if (v) setModo(v);
          }}
          sx={{
            bgcolor: colors.canvasAlt,
            borderRadius: 2,
            p: 0.35,
            '& .MuiToggleButtonGroup-grouped': {
              border: 0,
              borderRadius: '8px !important',
              px: 2,
              py: 0.6,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: colors.textSecondary,
              '&.Mui-selected': {
                bgcolor: colors.surface,
                color: colors.navy,
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                '&:hover': { bgcolor: colors.surface },
              },
            },
          }}
        >
          <ToggleButton value="rede">Rede</ToggleButton>
          <ToggleButton value="loja">Por loja</ToggleButton>
        </ToggleButtonGroup>

        {modo === 'loja' && saude && (
          <Typography variant="caption" color="text.secondary">
            {saude.resumo.criticas} críticas · {saude.resumo.atencao} atenção · {saude.resumo.ok} ok
          </Typography>
        )}
      </Box>

      {modo === 'rede' ? (
        <>
          <DashboardMetricCards metricas={m} />

          <Grid container spacing={{ xs: 1.5, sm: 2, lg: 2.5 }} sx={{ alignItems: 'stretch' }}>
            <Grid size={{ xs: 12, lg: 7 }}>
              <DashboardRankingChart
                ranking={data.ranking}
                onLojaClick={(id) => {
                  setIdLojaFoco(id);
                  setModo('loja');
                }}
              />
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
        </>
      ) : loadingSaude ? (
        <LinearProgress />
      ) : errSaude ? (
        <Typography color="error">{errSaude}</Typography>
      ) : saude ? (
        <DashboardSaudeLojas data={saude} idLojaFoco={idLojaFoco} />
      ) : null}
    </Box>
  );
}
