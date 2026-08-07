import { Link } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import type { RankingLoja } from '../../api/client';
import { fmtNota, notaChipSx } from '../../api/client';
import { dashboardPanelSx, dashboardPanelTitleSx, colors, notaBarColor, rankBadgeSx } from './dashboardCharts';

export default function DashboardRankingChart({
  ranking,
  onLojaClick,
}: {
  ranking: RankingLoja[];
  onLojaClick?: (idLoja: number) => void;
}) {
  const ordenado = [...ranking].sort((a, b) => a.posicao_ranking - b.posicao_ranking);

  return (
    <Paper elevation={0} sx={dashboardPanelSx}>
      <Typography sx={dashboardPanelTitleSx}>
        <EmojiEventsIcon sx={{ fontSize: 22, color: colors.orange }} />
        Top 5 Ranking de lojas
      </Typography>

      {!ordenado.length ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          Nenhuma loja com nota registrada.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
          {ordenado.map((r) => {
            const nota = Number(r.nota_atual);
            const barCor = notaBarColor(nota);
            return (
              <Box
                key={r.id_loja}
                onClick={onLojaClick ? () => onLojaClick(r.id_loja) : undefined}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1.25,
                  px: 0.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  cursor: onLojaClick ? 'pointer' : 'default',
                  borderRadius: 1,
                  '&:hover': onLojaClick
                    ? { bgcolor: 'rgba(27, 42, 107, 0.04)' }
                    : undefined,
                  '&:last-of-type': { borderBottom: 'none' },
                }}
              >
                <Box sx={rankBadgeSx(r.posicao_ranking)}>{r.posicao_ranking}</Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: { xs: '0.82rem', sm: '0.88rem' },
                        lineHeight: 1.3,
                        wordBreak: 'break-word',
                      }}
                    >
                      {r.name}
                    </Typography>
                    <Chip label={fmtNota(nota)} size="small" sx={{ ...notaChipSx(nota), flexShrink: 0 }} />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, nota))}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      bgcolor: 'rgba(27, 42, 107, 0.08)',
                      '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: barCor },
                    }}
                  />
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Button
        component={Link}
        to="/ranking"
        fullWidth
        size="small"
        variant="contained"
        sx={{ mt: 2, bgcolor: colors.navy, '&:hover': { bgcolor: colors.navyDark } }}
      >
        Ver ranking completo
      </Button>
    </Paper>
  );
}
