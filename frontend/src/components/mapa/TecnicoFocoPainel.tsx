import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringIcon from '@mui/icons-material/Engineering';
import type { FrotaTecnicoPosicao } from '../../api/client';
import { colors } from '../../theme/tokens';
import { iniciaisNomeMapa } from '../../utils/mapaGeo';

type Props = {
  tecnico: FrotaTecnicoPosicao;
  onClose: () => void;
};

function formatarAtualizado(iso: string | null | undefined) {
  if (!iso) return 'Sem GPS recente';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Recente';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'GPS agora';
  if (diffMin < 60) return `GPS há ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `GPS há ${diffH}h`;
  return 'GPS hoje';
}

export default function TecnicoFocoPainel({ tecnico, onClose }: Props) {
  return (
    <Box
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      sx={{
        pointerEvents: 'auto',
        p: 1.5,
        borderRadius: 2.5,
        bgcolor: 'rgba(255,255,255,.98)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 10px 32px rgba(0,0,0,.2)',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', minWidth: 0 }}>
          <Avatar
            sx={{
              width: 48,
              height: 48,
              fontWeight: 800,
              fontSize: '0.85rem',
              bgcolor: colors.navy,
            }}
          >
            {iniciaisNomeMapa(tecnico.nome)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <EngineeringIcon sx={{ fontSize: 16, color: colors.navy }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Técnico no mapa
              </Typography>
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.navy, lineHeight: 1.25 }}>
              {tecnico.nome}
            </Typography>
            {tecnico.nome_regiao && (
              <Typography variant="caption" color="text.secondary">
                {tecnico.nome_regiao}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
              {formatarAtualizado(tecnico.atualizado_em)}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Fechar">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
