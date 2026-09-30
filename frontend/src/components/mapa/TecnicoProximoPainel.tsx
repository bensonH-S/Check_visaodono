import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import CloseIcon from '@mui/icons-material/Close';
import NearMeIcon from '@mui/icons-material/NearMe';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import type { FrotaRegiaoLoja, FrotaTecnicoPosicao } from '../../api/client';
import { colors } from '../../theme/tokens';
import { formatarDistanciaMapa, iniciaisNomeMapa } from '../../utils/mapaGeo';

type Props = {
  loja: FrotaRegiaoLoja;
  tecnico: FrotaTecnicoPosicao | null;
  distanciaKm: number | null;
  atualizadoEm?: string | null;
  mostrarTecnico?: boolean;
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

export default function TecnicoProximoPainel({
  loja,
  tecnico,
  distanciaKm,
  atualizadoEm,
  mostrarTecnico = true,
  onClose,
}: Props) {
  return (
    <Box
      className="ck-mapa__loja-painel"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      sx={{
        pointerEvents: 'auto',
        p: 1.5,
        borderRadius: 2.5,
        bgcolor: '#1a222c',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 10px 32px rgba(0,0,0,.35)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#f5f5f5',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.25 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', minWidth: 0 }}>
          <StorefrontOutlinedIcon sx={{ color: '#ff9a5c', fontSize: 20, mt: 0.25, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f5f5f5', lineHeight: 1.25 }}>
              {loja.name}
            </Typography>
            {loja.bk_number && (
              <Typography variant="caption" sx={{ color: '#8d8d8d' }}>
                BKN {loja.bk_number}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Fechar" sx={{ mt: -0.5, mr: -0.5, color: '#8d8d8d' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {mostrarTecnico && tecnico && distanciaKm != null ? (
        <Box
          sx={{
            display: 'flex',
            gap: 1.25,
            alignItems: 'center',
            p: 1.25,
            borderRadius: 2,
            bgcolor: '#333840',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Avatar
            sx={{
              width: 44,
              height: 44,
              fontWeight: 800,
              fontSize: '0.8rem',
              bgcolor: '#fe6c22',
              boxShadow: '0 4px 12px rgba(254,108,34,.28)',
            }}
          >
            {iniciaisNomeMapa(tecnico.nome)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', color: '#8d8d8d' }}>
              Técnico mais próximo
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#f5f5f5', lineHeight: 1.25 }}>
              {tecnico.nome}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.35 }}>
              <NearMeIcon sx={{ fontSize: 14, color: colors.orange }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: colors.orange }}>
                {formatarDistanciaMapa(distanciaKm)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#8d8d8d' }}>
                · {formatarAtualizado(atualizadoEm ?? tecnico.atualizado_em)}
              </Typography>
            </Box>
          </Box>
        </Box>
      ) : mostrarTecnico ? (
        <Box
          sx={{
            p: 1.25,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.16)',
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#8d8d8d' }}>
            Nenhum técnico da região desta loja com GPS ativo para calcular a distância.
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
