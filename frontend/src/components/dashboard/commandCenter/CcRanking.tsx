import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { Link as RouterLink } from 'react-router-dom';
import type { RankingLoja } from '../../../api/client';
import { fmtPct, lojaLabel } from './ccFormat';
import { CC_CRITICO, CC_OK, CC_ORANGE, CC_RADIUS, CC_SURFACE_2 } from './ccTheme';
import { CcEmpty, CcPanel, CcSectionTitle, CcSkeleton } from './CcPanel';

type Tab = 'melhores' | 'risco' | 'evolucao';

function barraNota(nota: number) {
  if (nota >= 85) return CC_OK;
  if (nota >= 75) return CC_ORANGE;
  return CC_CRITICO;
}

function deltaNota(r: RankingLoja) {
  if (r.nota_anterior == null || r.nota_anterior === '') return null;
  const atual = Number(r.nota_atual);
  const ant = Number(r.nota_anterior);
  if (!Number.isFinite(atual) || !Number.isFinite(ant)) return null;
  return Math.round((atual - ant) * 10) / 10;
}

function RankingBody({
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
    <>
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          mb: 1.25,
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
                pb: 0.75,
                mb: '-1px',
                fontSize: '0.75rem',
                fontWeight: ativo ? 650 : 500,
                color: ativo ? 'var(--ga-orange)' : 'var(--ga-text-secondary)',
                borderBottom: '2px solid',
                borderColor: ativo ? 'var(--ga-orange)' : 'transparent',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                '&:hover': { color: ativo ? 'var(--ga-orange)' : 'var(--ga-text-primary)' },
              }}
            >
              {t.label}
            </Box>
          );
        })}
      </Box>

      {loading ? (
        <CcSkeleton height={140} />
      ) : !lista.length ? (
        <CcEmpty>
          {tab === 'risco'
            ? 'Nenhuma loja abaixo de 75%.'
            : tab === 'evolucao'
              ? 'Sem histórico comparável de evolução.'
              : 'Nenhuma loja com nota registrada.'}
        </CcEmpty>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1, flex: 1, minHeight: 0 }}>
          {lista.map((r, idx) => {
            const nota = Number(r.nota_atual);
            const d = deltaNota(r);
            const pos = tab === 'melhores' ? r.posicao_ranking : idx + 1;
            const top3 = tab === 'melhores' ? pos <= 3 : idx < 3;
            const barColor =
              tab === 'melhores'
                ? idx < 4
                  ? CC_OK
                  : CC_ORANGE
                : barraNota(nota);

            return (
              <Box key={r.id_loja} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    bgcolor: top3 ? CC_SURFACE_2 : 'transparent',
                    color: top3 ? CC_ORANGE : 'var(--ga-text-secondary)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {pos}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.4 }}>
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--ga-text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lojaLabel(r.name)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.65, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--ga-text-primary)' }}>
                        {fmtPct(nota, 0)}
                      </Typography>
                      {d != null && (
                        <Typography
                          sx={{
                            fontSize: '0.6875rem',
                            fontWeight: 650,
                            color: d >= 0 ? CC_OK : CC_CRITICO,
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
                      height: 4,
                      borderRadius: 4,
                      bgcolor: 'rgba(255, 255, 255, 0.06)',
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
        startIcon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
        sx={{
          mt: 1.25,
          borderRadius: `${CC_RADIUS}px`,
          borderColor: 'var(--ga-orange)',
          color: 'var(--ga-orange)',
          textTransform: 'none',
          fontWeight: 650,
          fontSize: '0.75rem',
          py: 0.7,
          bgcolor: 'transparent',
          '&:hover': {
            borderColor: 'var(--ga-orange)',
            bgcolor: 'rgba(232, 82, 10, 0.1)',
          },
        }}
      >
        Ver ranking completo
      </Button>
    </>
  );
}

export default function CcRanking({
  loading,
  ranking,
  embedded,
}: {
  loading?: boolean;
  ranking: RankingLoja[];
  embedded?: boolean;
}) {
  if (embedded) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, mt: 0.25 }}>
        <CcSectionTitle title="Ranking de lojas" />
        <RankingBody loading={loading} ranking={ranking} />
      </Box>
    );
  }

  return (
    <CcPanel title="Ranking de lojas">
      <RankingBody loading={loading} ranking={ranking} />
    </CcPanel>
  );
}
