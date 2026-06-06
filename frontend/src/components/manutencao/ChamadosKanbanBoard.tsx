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
    <Box
      sx={{
        display: 'flex',
        gap: { xs: 2, md: 2.5 },
        overflowX: 'auto',
        pb: 2,
        pt: 0.5,
        minHeight: 480,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {KANBAN_COLUNAS.map((col) => {
        const cards = porColuna.get(col.status) ?? [];
        return (
          <Box
            key={col.status}
            sx={{
              flex: '0 0 300px',
              minWidth: { xs: 280, sm: 300, md: 320 },
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                mb: 1.5,
                px: 0.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {col.icon === 'check' ? (
                  <CheckCircleIcon sx={{ fontSize: 20, color: col.accent }} />
                ) : (
                  <ScheduleOutlinedIcon sx={{ fontSize: 20, color: col.accent }} />
                )}
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: NAVY, fontSize: '0.95rem' }}>
                  {col.label}
                </Typography>
                <Chip
                  label={cards.length}
                  size="small"
                  sx={{
                    height: 22,
                    minWidth: 28,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    bgcolor: 'rgba(27, 42, 107, 0.08)',
                    color: NAVY,
                  }}
                />
              </Box>
            </Box>

            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                bgcolor: 'rgba(27, 42, 107, 0.04)',
                borderRadius: 2.5,
                p: 1.5,
                minHeight: 400,
                maxHeight: 'calc(100vh - 260px)',
                overflowY: 'auto',
              }}
            >
              {cards.map((c) => {
                const borda = URGENCIA_BORDA[c.urgencia] || '#9CA3AF';
                return (
                  <Paper
                    key={c.id_chamado}
                    elevation={0}
                    onClick={() => navigate(`/chamados/${c.id_chamado}`)}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      position: 'relative',
                      border: '1px solid rgba(27, 42, 107, 0.12)',
                      borderLeft: `5px solid ${borda}`,
                      bgcolor: '#fff',
                      transition: 'box-shadow 0.15s',
                      '&:hover': { boxShadow: '0 6px 20px rgba(27, 42, 107, 0.14)' },
                    }}
                  >
                    {(c.notificacoes_nao_lidas ?? 0) > 0 && (
                      <Box
                        aria-label={`${c.notificacoes_nao_lidas} notificação(ões)`}
                        sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                      >
                        <NotificacaoBadge count={c.notificacoes_nao_lidas} />
                      </Box>
                    )}
                    <Box sx={{ mb: 1, pr: (c.notificacoes_nao_lidas ?? 0) > 0 ? 2 : 0 }}>
                      <Typography
                        variant="body1"
                        sx={{
                          fontWeight: 700,
                          color: NAVY,
                          lineHeight: 1.4,
                          fontSize: '0.95rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {c.titulo}
                      </Typography>
                    </Box>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 1.25, fontSize: '0.8rem' }}
                    >
                      #{c.numero} · {c.categoria}
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                      <LocationOnOutlinedIcon sx={{ fontSize: 18, color: '#E8520A' }} />
                      <Typography variant="body2" sx={{ color: NAVY, fontWeight: 600, fontSize: '0.82rem' }}>
                        {c.loja}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5, alignItems: 'center' }}>
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
                      />
                    </Box>
                  </Paper>
                );
              })}

              {!cards.length && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: 6, px: 2 }}
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
