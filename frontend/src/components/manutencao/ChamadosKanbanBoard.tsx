import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import type { ManutChamado } from '../../api/client';
import NotificacaoBadge from '../NotificacaoBadge';
import {
  KANBAN_COLUNAS,
  SlaBarraProgresso,
  tipoChamadoChip,
  urgenciaChip,
} from '../../utils/manutencaoUi';
import {
  kanbanBoardLayout,
  kanbanCardSx,
  kanbanChipRowSx,
  kanbanColumnBodySx,
  kanbanColumnLayout,
} from './kanbanLayout';

const NAVY = '#1B2A6B';

const URGENCIA_BORDA: Record<string, string> = {
  critica: '#EF4444',
  alta: '#F97316',
  media: '#3B82F6',
  baixa: '#9CA3AF',
};

type Props = {
  chamados: ManutChamado[];
};

export default function ChamadosKanbanBoard({ chamados }: Props) {
  const navigate = useNavigate();

  const porColuna = useMemo(() => {
    const map = new Map<string, ManutChamado[]>();
    for (const col of KANBAN_COLUNAS) map.set(col.status, []);
    for (const c of chamados) {
      const status = c.status === 'cancelado' ? 'concluido' : c.status;
      const lista = map.get(status);
      if (lista) lista.push(c);
    }
    return map;
  }, [chamados]);

  return (
    <Box sx={kanbanBoardLayout(KANBAN_COLUNAS.length, 'xl')}>
      {KANBAN_COLUNAS.map((col) => {
        const cards = porColuna.get(col.status) ?? [];
        return (
          <Box key={col.status} sx={kanbanColumnLayout('xl')}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 1,
                px: 0.25,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                {col.icon === 'check' ? (
                  <CheckCircleIcon sx={{ fontSize: 16, color: col.accent, flexShrink: 0 }} />
                ) : (
                  <ScheduleOutlinedIcon sx={{ fontSize: 16, color: col.accent, flexShrink: 0 }} />
                )}
                <Typography
                  sx={{
                    fontWeight: 700,
                    color: NAVY,
                    fontSize: { xs: '0.82rem', sm: '0.8rem', xl: '0.85rem' },
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {col.label}
                </Typography>
                <Chip
                  label={cards.length}
                  size="small"
                  sx={{
                    height: 18,
                    minWidth: 22,
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    bgcolor: 'rgba(27, 42, 107, 0.08)',
                    color: NAVY,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Box>
            </Box>

            <Box sx={kanbanColumnBodySx}>
              {cards.map((c) => {
                const borda = URGENCIA_BORDA[c.urgencia] || '#9CA3AF';
                return (
                  <Paper
                    key={c.id_chamado}
                    elevation={0}
                    onClick={() => navigate(`/chamados/${c.id_chamado}`)}
                    sx={{
                      ...kanbanCardSx,
                      position: 'relative',
                      borderLeft: `3px solid ${borda}`,
                    }}
                  >
                    {(c.notificacoes_nao_lidas ?? 0) > 0 && (
                      <Box
                        aria-label={`${c.notificacoes_nao_lidas} notificação(ões)`}
                        sx={{ position: 'absolute', top: 6, right: 6, zIndex: 1, transform: 'scale(0.9)' }}
                      >
                        <NotificacaoBadge count={c.notificacoes_nao_lidas} />
                      </Box>
                    )}
                    <Box sx={{ mb: 0.5, pr: (c.notificacoes_nao_lidas ?? 0) > 0 ? 1.5 : 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 700,
                          color: NAVY,
                          lineHeight: 1.3,
                          fontSize: { xs: '0.82rem', sm: '0.8rem', xl: '0.85rem' },
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {c.titulo}
                      </Typography>
                    </Box>

                    <Typography
                      color="text.secondary"
                      sx={{ display: 'block', mb: 0.5, fontSize: '0.68rem', lineHeight: 1.3 }}
                    >
                      #{c.numero} · {c.categoria}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75, minWidth: 0 }}>
                      <LocationOnOutlinedIcon sx={{ fontSize: 14, color: '#E8520A', flexShrink: 0 }} />
                      <Typography
                        sx={{
                          color: NAVY,
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          lineHeight: 1.25,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.loja}
                      </Typography>
                    </Box>

                    <Box sx={{ ...kanbanChipRowSx, mb: 0.75 }}>
                      {urgenciaChip(c.urgencia)}
                      {c.tipo_chamado === 'orcamento' && tipoChamadoChip('orcamento')}
                      {c.status === 'cancelado' && (
                        <Chip label="Cancelado" size="small" color="error" variant="outlined" />
                      )}
                    </Box>

                    <Box>
                      <SlaBarraProgresso
                        abertoEm={c.aberto_em}
                        prazoSla={c.prazo_sla}
                        status={c.status}
                        fechadoEm={c.fechado_em ?? undefined}
                        larguraTotal
                        compact
                      />
                    </Box>
                  </Paper>
                );
              })}

              {!cards.length && (
                <Typography
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: 3, px: 1, fontSize: '0.72rem' }}
                >
                  Nenhum chamado
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
