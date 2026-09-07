import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Link as RouterLink } from 'react-router-dom';
import type { RankingLoja } from '../../../api/client';
import { notaBarColor } from '../dashboardCharts';
import { fmtPct, lojaLabel } from './ccFormat';
import { CC_RADIUS, CcEmpty, CcPanel, CcSkeleton } from './CcPanel';

type Tab = 'melhores' | 'risco' | 'evolucao';

function deltaNota(r: RankingLoja) {
  if (r.nota_anterior == null || r.nota_anterior === '') return null;
  const atual = Number(r.nota_atual);
  const ant = Number(r.nota_anterior);
  if (!Number.isFinite(atual) || !Number.isFinite(ant)) return null;
  return Math.round((atual - ant) * 10) / 10;
}

export default function CcRanking({
  loading,
  ranking,
}: {
  loading?: boolean;
  ranking: RankingLoja[];
}) {
  const [tab, setTab] = useState<Tab>('melhores');

  const lista = useMemo(() => {
    const base = [...ranking];
    if (tab === 'melhores') {
      return base.sort((a, b) => a.posicao_ranking - b.posicao_ranking).slice(0, 5);
    }
    if (tab === 'risco') {
      return base
        .filter((r) => Number(r.nota_atual) < 75)
        .sort((a, b) => Number(a.nota_atual) - Number(b.nota_atual))
        .slice(0, 5);
    }
    return base
      .map((r) => ({ r, d: deltaNota(r) }))
      .filter((x) => x.d != null)
      .sort((a, b) => (b.d ?? 0) - (a.d ?? 0))
      .slice(0, 5)
      .map((x) => x.r);
  }, [ranking, tab]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'melhores', label: 'Melhores' },
    { id: 'risco', label: 'Em risco' },
    { id: 'evolucao', label: 'Maior evolução' },
  ];

  return (
    <CcPanel title="Ranking de lojas" minHeight={280}>
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 1.5, sm: 2.5 },
          mb: 2,
          borderBottom: '1px solid var(--ga-border)',
          minWidth: 0,
        }}
      >
        {tabs.map((t) => {
          const ativo = tab === t.id;
          return (
            <Box
              key={t.id}
              component="button"
              type="button"
              onClick={() => setTab(t.id)}
              sx={{
                border: 0,
                cursor: 'pointer',
                bgcolor: 'transparent',
                px: 0,
                pb: 1,
                mb: '-1px',
                fontSize: { xs: '0.72rem', sm: '0.8125rem' },
                fontWeight: ativo ? 650 : 500,
                color: ativo ? 'var(--ga-orange)' : 'var(--ga-text-secondary)',
                borderBottom: '2px solid',
                borderColor: ativo ? 'var(--ga-orange)' : 'transparent',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                transition: 'color 0.12s, border-color 0.12s',
                '&:hover': { color: ativo ? 'var(--ga-orange)' : 'var(--ga-text-primary)' },
              }}
            >
              {t.label}
            </Box>
          );
        })}
      </Box>

      {loading ? (
        <CcSkeleton height={180} />
      ) : !lista.length ? (
        <CcEmpty>
          {tab === 'risco'
            ? 'Nenhuma loja abaixo de 75%.'
            : tab === 'evolucao'
              ? 'Sem histórico comparável de evolução.'
              : 'Nenhuma loja com nota registrada.'}
        </CcEmpty>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
          {lista.map((r, idx) => {
            const nota = Number(r.nota_atual);
            const d = deltaNota(r);
            const pos = tab === 'melhores' ? r.posicao_ranking : idx + 1;
            const top3 = tab === 'melhores' ? pos <= 3 : idx < 3;
            // Mock: barras verdes no topo; a 5ª (e notas menores) em laranja
            const barColor =
              tab === 'melhores'
                ? idx < 4
                  ? '#16A34A'
                  : '#F97316'
                : notaBarColor(nota);

            return (
              <Box key={r.id_loja} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    bgcolor: top3 ? '#16A34A' : 'transparent',
                    color: top3 ? '#fff' : 'var(--ga-text-primary)',
                    border: top3 ? 'none' : '1px solid var(--ga-border-strong)',
                  }}
                >
                  {pos}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.6 }}>
                    <Typography
                      sx={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--ga-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lojaLabel(r.name)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.85, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--ga-text-primary)' }}>
                        {fmtPct(nota, 0)}
                      </Typography>
                      {d != null && (
                        <Typography
                          sx={{
                            fontSize: '0.72rem',
                            fontWeight: 650,
                            color: d >= 0 ? '#22C55E' : '#EF4444',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {d >= 0 ? '↑' : '↓'}{' '}
                          {Math.abs(d).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, nota))}
                    sx={{
                      height: 5,
                      borderRadius: 4,
                      bgcolor: 'rgba(148, 163, 184, 0.18)',
                      '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: barColor },
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Button
        component={RouterLink}
        to="/ranking"
        fullWidth
        variant="outlined"
        startIcon={<TrendingUpIcon sx={{ fontSize: 18 }} />}
        sx={{
          mt: 2,
          borderRadius: `${CC_RADIUS}px`,
          borderColor: 'var(--ga-orange)',
          color: 'var(--ga-orange)',
          textTransform: 'none',
          fontWeight: 650,
          fontSize: '0.8125rem',
          py: 1,
          bgcolor: 'transparent',
          '&:hover': {
            borderColor: 'var(--ga-orange)',
            bgcolor: 'rgba(232, 82, 10, 0.1)',
          },
        }}
      >
        Ver ranking completo
      </Button>
    </CcPanel>
  );
}
