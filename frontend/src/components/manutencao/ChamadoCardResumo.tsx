import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import type { ManutChamado } from '../../api/client';
import NotificacaoBadge from '../NotificacaoBadge';
import { KANBAN_COLUNAS, STATUS_CHAMADO, SlaBarraProgresso, urgenciaChip } from '../../utils/manutencaoUi';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

const NAVY = '#1B2A6B';

function statusAccent(status: string) {
  const col = KANBAN_COLUNAS.find((c) => c.status === status);
  if (col) return col.accent;
  if (status === 'cancelado') return '#EF4444';
  return '#9CA3AF';
}

type Props = {
  chamado: ManutChamado;
  onClick?: () => void;
  /** Card menor para histórico ou kanban denso */
  compact?: boolean;
  /** Exibe loja (portal com várias unidades) */
  showLoja?: boolean;
  /** Oculta chip de status (ex.: coluna do kanban) */
  hideStatus?: boolean;
  /** Barra de SLA no rodapé */
  showSla?: boolean;
};

export default function ChamadoCardResumo({
  chamado,
  onClick,
  compact = false,
  showLoja = false,
  hideStatus = false,
  showSla = false,
}: Props) {
  const st = STATUS_CHAMADO[chamado.status] || {
    label: chamado.status,
    color: '#4B5563',
    bg: '#F3F4F6',
  };
  const accent = statusAccent(chamado.status);

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        borderRadius: 2,
        border: '1px solid rgba(27, 42, 107, 0.1)',
        borderLeft: `4px solid ${accent}`,
        overflow: 'hidden',
        bgcolor: '#fff',
        boxShadow: compact
          ? '0 1px 4px rgba(27, 42, 107, 0.06)'
          : '0 2px 10px rgba(27, 42, 107, 0.08)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s ease, transform 0.12s ease',
        '&:hover': onClick
          ? { boxShadow: '0 6px 20px rgba(27, 42, 107, 0.14)', transform: 'translateY(-1px)' }
          : undefined,
        '&:active': onClick ? { transform: 'translateY(0)' } : undefined,
      }}
    >
      <Box sx={{ px: compact ? 1.5 : 2, py: compact ? 1.25 : 1.75 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
            <Box
              sx={{
                bgcolor: 'rgba(27, 42, 107, 0.08)',
                color: NAVY,
                fontWeight: 800,
                fontSize: compact ? '0.75rem' : '0.8125rem',
                px: 0.875,
                py: 0.35,
                borderRadius: 1,
                lineHeight: 1.2,
                flexShrink: 0,
              }}
            >
              #{chamado.numero}
            </Box>
            <NotificacaoBadge count={chamado.notificacoes_nao_lidas} />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {urgenciaChip(chamado.urgencia)}
          </Box>
        </Box>

        <Typography
          sx={{
            fontWeight: 700,
            lineHeight: 1.35,
            color: compact ? 'text.primary' : 'text.primary',
            fontSize: compact ? '0.875rem' : '1rem',
            mb: 0.5,
            display: '-webkit-box',
            WebkitLineClamp: compact ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {chamado.titulo}
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
          {chamado.categoria}
        </Typography>

        {showLoja && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, minWidth: 0 }}>
            <LocationOnOutlinedIcon sx={{ fontSize: 15, color: '#E8520A', flexShrink: 0 }} />
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {chamado.loja}
            </Typography>
          </Box>
        )}

        {!compact && chamado.total_fotos > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <PhotoCameraOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              {chamado.total_fotos} anexo{chamado.total_fotos > 1 ? 's' : ''}
            </Typography>
          </Box>
        )}

        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            mt: 1.25,
            flexWrap: 'wrap',
            alignItems: 'center',
            pt: 1,
            borderTop: '1px solid rgba(27, 42, 107, 0.08)',
          }}
        >
          {!hideStatus && (
            <Chip
              label={st.label}
              size="small"
              sx={{
                height: 26,
                fontWeight: 700,
                fontSize: '0.72rem',
                bgcolor: st.bg,
                color: st.color,
                border: `1px solid ${accent}40`,
              }}
            />
          )}
          {!compact && (
            <Chip
              icon={<ScheduleOutlinedIcon sx={{ fontSize: '14px !important', color: `${NAVY} !important` }} />}
              label={formatDataHoraBrasilia(chamado.aberto_em || chamado.prazo_sla)}
              size="small"
              variant="outlined"
              sx={{
                height: 26,
                fontSize: '0.72rem',
                fontWeight: 600,
                color: NAVY,
                borderColor: 'rgba(27, 42, 107, 0.2)',
                '& .MuiChip-icon': { ml: 0.75 },
              }}
            />
          )}
        </Box>

        {showSla && (
          <Box sx={{ mt: 1 }}>
            <SlaBarraProgresso
              abertoEm={chamado.aberto_em}
              prazoSla={chamado.prazo_sla}
              status={chamado.status}
              fechadoEm={chamado.fechado_em ?? undefined}
              larguraTotal
              compact
            />
          </Box>
        )}
      </Box>
    </Paper>
  );
}
