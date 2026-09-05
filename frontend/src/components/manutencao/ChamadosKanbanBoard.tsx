import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import type { ManutChamado } from '../../api/client';
import { KANBAN_COLUNAS } from '../../utils/manutencaoUi';
import ChamadoCardResumo from './ChamadoCardResumo';
import { colors } from '../../theme/tokens';
import {
  kanbanBoardLayout,
  kanbanColumnBodySx,
  kanbanColumnHeaderSx,
  kanbanColumnLayout,
} from './kanbanLayout';

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
    <Box sx={kanbanBoardLayout(KANBAN_COLUNAS.length)}>
      {KANBAN_COLUNAS.map((col) => {
        const cards = porColuna.get(col.status) ?? [];
        return (
          <Box key={col.status} sx={kanbanColumnLayout()}>
            <Box sx={kanbanColumnHeaderSx(col.accent)}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                {col.icon === 'check' ? (
                  <CheckCircleIcon sx={{ fontSize: 18, color: col.accent, flexShrink: 0 }} />
                ) : (
                  <ScheduleOutlinedIcon sx={{ fontSize: 18, color: col.accent, flexShrink: 0 }} />
                )}
                <Typography
                  sx={{
                    fontWeight: 800,
                    color: colors.textPrimary,
                    fontSize: '0.85rem',
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
                    height: 22,
                    minWidth: 26,
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    bgcolor: `${col.accent}18`,
                    color: col.accent,
                    border: `1px solid ${col.accent}40`,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              </Box>
            </Box>

            <Box sx={kanbanColumnBodySx}>
              {cards.map((c) => (
                <ChamadoCardResumo
                  key={c.id_chamado}
                  chamado={c}
                  compact
                  hideStatus
                  showLoja
                  showSla
                  onClick={() => navigate(`/chamados/${c.id_chamado}`)}
                />
              ))}

              {!cards.length && (
                <Typography
                  sx={{
                    textAlign: 'center',
                    py: 4,
                    px: 1,
                    fontSize: '0.78rem',
                    color: colors.textSecondary,
                  }}
                >
                  Nenhum chamado nesta etapa
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
