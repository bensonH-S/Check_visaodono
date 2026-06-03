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
    <Paper className={`p-4 h-full ${accent ? 'border-t-[3px] border-[#E8520A]' : ''}`}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 600, my: 0.5 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  );
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
    <Box>
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
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

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper className="p-4">
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
              Top 5 — Ranking
            </Typography>
            {data.ranking.map((r) => (
              <Box key={r.id_loja} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0">
                <Box
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                  sx={{
                    bgcolor: r.posicao_ranking <= 3 ? 'primary.light' : 'grey.100',
                    color: r.posicao_ranking <= 3 ? 'primary.main' : 'text.secondary',
                  }}
                >
                  {r.posicao_ranking}
                </Box>
                <Typography variant="body2" className="flex-1">
                  {r.name}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: scoreColor(Number(r.nota_atual)) }}>
                  {fmtNota(r.nota_atual)}
                </Typography>
              </Box>
            ))}
            <Button component={Link} to="/ranking" fullWidth size="small" sx={{ mt: 1.5 }}>
              Ver ranking completo
            </Button>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper className="p-4">
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
              NCs recentes em aberto
            </Typography>
            {data.ncs_recentes.map((nc, i) => (
              <Box key={i} className="flex gap-2 py-2 border-b border-gray-100 last:border-0">
                <Box
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  sx={{ bgcolor: nc.gravidade === 'Crítica' ? 'error.main' : 'warning.main' }}
                />
                <Box>
                  <Typography variant="body2">{nc.descricao}</Typography>
                  <Typography variant="caption" color="text.secondary">
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
