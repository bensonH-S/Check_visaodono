import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import type { RankingLoja } from '../../../api/client';
import { fmtPct, lojaLabel } from './ccFormat';
import { CC_BRAND_ORANGE, CC_CRITICO, CC_OK, CC_SURFACE_2, CC_TEXT } from './ccTheme';
import { CcEmpty, CcPanel, CcSectionTitle, CcSkeleton } from './CcPanel';

type Tab = 'melhores' | 'risco' | 'evolucao';

function barraNota(nota: number) {
  if (nota >= 85) return CC_OK;
  if (nota >= 75) return CC_BRAND_ORANGE;
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
      return base.sort((a, b) => a.posicao_ranking - b.posicao_ranking).slice(0, 3);
    }
    if (tab === 'risco') {
      return base
        .filter((r) => Number(r.nota_atual) < 75)
        .sort((a, b) => Number(a.nota_atual) - Number(b.nota_atual))
        .slice(0, 3);
    }
    return base
      .map((r) => ({ r, d: deltaNota(r) }))
      .filter((x) => x.d != null)
      .sort((a, b) => (b.d ?? 0) - (a.d ?? 0))
      .slice(0, 3)
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
          mb: 1.15,
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
                fontWeight: ativo ? 700 : 500,
                color: ativo ? CC_BRAND_ORANGE : 'var(--ga-text-muted)',
                borderBottom: '2px solid',
                borderColor: ativo ? CC_BRAND_ORANGE : 'transparent',
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                '&:hover': { color: ativo ? CC_BRAND_ORANGE : 'var(--ga-text-secondary)' },
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.85, flex: 1, minHeight: 0 }}>
          {lista.map((r, idx) => {
            const nota = Number(r.nota_atual);
            const d = deltaNota(r);
            const pos = tab === 'melhores' ? r.posicao_ranking : idx + 1;
            const barColor = tab === 'risco' ? barraNota(nota) : CC_BRAND_ORANGE;

            return (
              <Box key={r.id_loja} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    bgcolor: CC_SURFACE_2,
                    color: CC_BRAND_ORANGE,
                    border: '1px solid rgba(232, 82, 10, 0.28)',
                  }}
                >
                  {pos}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.3 }}>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: CC_TEXT,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                      }}
                    >
                      {lojaLabel(r.name)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: CC_TEXT }}>
                        {fmtPct(nota, 0)}
                      </Typography>
                      {d != null && (
                        <Typography
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
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
                      height: 3,
                      borderRadius: 4,
                      bgcolor: 'var(--ga-canvas-alt)',
                      '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: barColor },
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
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
        <CcSectionTitle title="Ranking de lojas" action="Ver ranking" actionTo="/ranking" />
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
