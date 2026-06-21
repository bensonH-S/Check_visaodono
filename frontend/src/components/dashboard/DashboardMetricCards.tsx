import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import EventNoteIcon from '@mui/icons-material/EventNote';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { fmtNota } from '../../api/client';
import { colors, portalPanelSx } from '../../theme/tokens';
import { notaBarColor } from './dashboardCharts';

type Metricas = {
  media_geral: number;
  visitas_mes: number;
  total_ncs_abertas: number;
  ncs_criticas: number;
  lojas_abaixo_75: number;
  lojas_ativas: number;
};

const cardSx = {
  ...portalPanelSx,
  height: '100%',
  minHeight: 118,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

function MetricCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  iconColor,
  valueSx,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  valueSx?: object;
}) {
  return (
    <Paper elevation={0} sx={cardSx}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontWeight: 700,
              mt: 0.5,
              fontSize: { xs: '1.65rem', sm: '1.85rem' },
              lineHeight: 1.1,
              color: colors.navy,
              letterSpacing: '-0.02em',
              ...valueSx,
            }}
          >
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            bgcolor: iconBg,
            color: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            '& .MuiSvgIcon-root': { fontSize: 22 },
          }}
        >
          {icon}
        </Box>
      </Box>
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', mt: 1.25 }}>
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

export default function DashboardMetricCards({ metricas }: { metricas: Metricas }) {
  const media = metricas.media_geral;

  return (
    <Grid container spacing={{ xs: 1.25, sm: 1.5, lg: 2 }} sx={{ alignItems: 'stretch' }}>
      <Grid size={{ xs: 6, lg: 3 }}>
        <MetricCard
          label="Média geral"
          value={fmtNota(media)}
          sub="Índice operacional das lojas"
          icon={<TrendingUpIcon />}
          iconBg={colors.navyMuted}
          iconColor={colors.navy}
          valueSx={{ color: notaBarColor(media) }}
        />
      </Grid>
      <Grid size={{ xs: 6, lg: 3 }}>
        <MetricCard
          label="Visitas no mês"
          value={metricas.visitas_mes}
          sub="Registradas neste mês"
          icon={<EventNoteIcon />}
          iconBg="rgba(59, 130, 246, 0.1)"
          iconColor="#2563EB"
        />
      </Grid>
      <Grid size={{ xs: 6, lg: 3 }}>
        <MetricCard
          label="NCs em aberto"
          value={metricas.total_ncs_abertas}
          sub={`${metricas.ncs_criticas} crítica(s)`}
          icon={<WarningAmberIcon />}
          iconBg="rgba(220, 38, 38, 0.08)"
          iconColor="#DC2626"
          valueSx={metricas.total_ncs_abertas > 0 ? { color: '#DC2626' } : undefined}
        />
      </Grid>
      <Grid size={{ xs: 6, lg: 3 }}>
        <MetricCard
          label="Lojas abaixo de 75%"
          value={metricas.lojas_abaixo_75}
          sub={`De ${metricas.lojas_ativas} lojas ativas`}
          icon={<StorefrontIcon />}
          iconBg="rgba(234, 179, 8, 0.12)"
          iconColor="#A16207"
          valueSx={metricas.lojas_abaixo_75 > 0 ? { color: '#A16207' } : undefined}
        />
      </Grid>
    </Grid>
  );
}
