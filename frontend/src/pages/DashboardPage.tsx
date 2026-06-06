import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { api, fmtNota, fmtData, scoreColor } from '../api/client';
import type { DashboardData } from '../api/client';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Paper
      sx={{
        p: { xs: 1.5, sm: 2 },
        height: '100%',
        ...(accent ? { borderTop: `3px solid ${NAVY}` } : undefined),
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontSize: { xs: '0.68rem', sm: '0.72rem' }, lineHeight: 1.3, display: 'block' }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontWeight: 600,
          my: 0.25,
          fontSize: { xs: '1.2rem', sm: '1.35rem', md: '1.45rem' },
          lineHeight: 1.2,
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
        >
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

function rankBadge(pos: number) {
  const top3 = pos <= 3;
  return {
    bgcolor: top3 ? ORANGE : '#E8EAED',
    color: top3 ? '#fff' : NAVY,
    fontWeight: 700,
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Typography color="error">{err}</Typography>;
  if (!data) return <LinearProgress />;

  const m = data.metricas;

  return (
    <Box sx={{ maxWidth: { xs: '100%', lg: 1100 }, mx: 'auto' }}>
      <Grid container spacing={{ xs: 1, sm: 1.25 }} sx={{ mb: { xs: 1.5, sm: 2 } }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Média geral das lojas" value={fmtNota(m.media_geral)} accent />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Visitas este mês" value={String(m.visitas_mes)} sub="registradas no mês" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard
            label="Não conformidades"
            value={String(m.total_ncs_abertas)}
            sub={`${m.ncs_criticas} críticas`}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard
            label="Lojas abaixo de 75%"
            value={String(m.lojas_abaixo_75)}
            sub={`de ${m.lojas_ativas} ativas`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 1.25, sm: 1.5 }} sx={{ mb: { xs: 1.5, sm: 2 } }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, mb: 1, fontSize: { xs: '0.8rem', sm: '0.85rem' } }}
            >
              Top 5 Ranking
            </Typography>
            {data.ranking.map((r, index) => (
              <Box
                key={r.id_loja}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: { xs: 0.75, sm: 1 },
                  borderBottom: index < data.ranking.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <Box
                  sx={{
                    width: { xs: 22, sm: 24 },
                    height: { xs: 22, sm: 24 },
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: { xs: '0.65rem', sm: '0.7rem' },
                    flexShrink: 0,
                    ...rankBadge(r.posicao_ranking),
                  }}
                >
                  {r.posicao_ranking}
                </Box>
                <Typography
                  sx={{ flex: 1, minWidth: 0, fontSize: { xs: '0.78rem', sm: '0.82rem' } }}
                  noWrap
                >
                  {r.name}
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 600,
                    color: scoreColor(Number(r.nota_atual)),
                    fontSize: { xs: '0.78rem', sm: '0.82rem' },
                  }}
                >
                  {fmtNota(r.nota_atual)}
                </Typography>
              </Box>
            ))}
            <Button
              component={Link}
              to="/ranking"
              fullWidth
              size="small"
              variant="contained"
              sx={{ mt: 1, fontSize: { xs: '0.75rem', sm: '0.8rem' }, py: 0.5 }}
            >
              Ver ranking completo
            </Button>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, mb: 1, fontSize: { xs: '0.8rem', sm: '0.85rem' } }}
            >
              NCs recentes em aberto
            </Typography>
            {data.ncs_recentes.map((nc, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  gap: 1,
                  py: { xs: 0.75, sm: 1 },
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-of-type': { borderBottom: 'none' },
                }}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    mt: 0.6,
                    flexShrink: 0,
                    bgcolor: nc.gravidade === 'Crítica' ? 'error.main' : 'warning.main',
                  }}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: { xs: '0.78rem', sm: '0.82rem' }, lineHeight: 1.35 }}>
                    {nc.descricao}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.68rem', sm: '0.72rem' } }}
                  >
                    {nc.name} · {fmtData(nc.data_cadastro)}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
