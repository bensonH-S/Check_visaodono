import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { formatDataHoraBrasilia } from '../../../utils/dateBr';
import { lojaLabel } from './ccFormat';
import { CC_BORDER, CC_CRITICO, CC_MUTED, CC_ORANGE, CC_RADIUS, CC_SURFACE, CC_WARN } from './ccTheme';
import { CcEmpty, CcSkeleton } from './CcPanel';

type NcItem = {
  descricao: string;
  name: string;
  data_cadastro: string;
  gravidade: string;
};

function corGravidade(g: string) {
  if (g === 'Crítica') return CC_CRITICO;
  if (g === 'Moderada') return CC_ORANGE;
  return CC_WARN;
}

function horaCurta(iso: string) {
  const txt = formatDataHoraBrasilia(iso);
  const partes = txt.split(',');
  return (partes[1] || partes[0] || '').trim() || '—';
}

export default function CcNcsRecentes({
  loading,
  itens,
  totalAbertas,
}: {
  loading?: boolean;
  itens: NcItem[];
  totalAbertas: number;
}) {
  return (
    <Box
      sx={{
        bgcolor: CC_SURFACE,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        p: 1.5,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: '0.06em', color: '#F5F5F5' }}>
            NCs EM ABERTO
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.15 }}>
            {totalAbertas > 0 ? `${totalAbertas} na rede · as mais críticas` : 'Prioridade por gravidade'}
          </Typography>
        </Box>
        <Typography
          component={RouterLink}
          to="/nao-conformidades?status=Em+aberto"
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: CC_ORANGE,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Ver todas
        </Typography>
      </Box>

      {loading ? (
        <CcSkeleton height={120} />
      ) : !itens.length ? (
        <CcEmpty>Nenhuma NC em aberto.</CcEmpty>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.55, minHeight: 0, overflow: 'auto' }}>
          {itens.slice(0, 5).map((nc, i) => {
            const cor = corGravidade(nc.gravidade);
            return (
              <Box
                key={`${nc.data_cadastro}-${i}`}
                component={RouterLink}
                to="/nao-conformidades?status=Em+aberto"
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 0.85,
                  textDecoration: 'none',
                  color: 'inherit',
                  px: 0.35,
                  py: 0.4,
                  borderRadius: 1,
                  minWidth: 0,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                }}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: cor,
                    mt: 0.55,
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 0.75 }}>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        fontWeight: 650,
                        color: '#F5F5F5',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {lojaLabel(nc.name)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6rem', color: CC_MUTED, flexShrink: 0 }}>
                      {horaCurta(nc.data_cadastro)}
                    </Typography>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.65rem',
                      color: 'var(--ga-text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {nc.descricao || nc.gravidade}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
