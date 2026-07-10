import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import type { FrotaVeiculoPosicao, FrotaVeiculoRotaDiaRelatorio } from '../../api/client';
import { colors } from '../../theme/tokens';

type Props = {
  veiculo: FrotaVeiculoPosicao;
  relatorio: FrotaVeiculoRotaDiaRelatorio | null;
  carregando?: boolean;
  tituloTrajeto?: string;
  onClose: () => void;
};

function rotuloVeiculo(veiculo: FrotaVeiculoPosicao) {
  const modelo = [veiculo.marca, veiculo.modelo].filter(Boolean).join(' ');
  return modelo ? `${veiculo.placa} · ${modelo}` : veiculo.placa;
}

export default function VeiculoFocoPainel({
  veiculo,
  relatorio,
  carregando,
  tituloTrajeto = 'Trajeto de hoje',
  onClose,
}: Props) {
  const km = relatorio?.km_odometro ?? relatorio?.km_gps ?? null;
  const limite = relatorio?.limite_kmh ?? 80;

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
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'rgba(232, 82, 10, 0.12)',
              color: colors.orange,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <DirectionsCarIcon />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {tituloTrajeto}
              </Typography>
            </Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: colors.navy, lineHeight: 1.25 }}>
              {rotuloVeiculo(veiculo)}
            </Typography>
            {veiculo.nome_regiao && (
              <Typography variant="caption" color="text.secondary">
                {veiculo.nome_regiao}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35, lineHeight: 1.4 }}>
              {carregando
                ? 'Carregando rota do dia…'
                : relatorio
                  ? [
                      km != null ? `${km.toLocaleString('pt-BR')} km` : null,
                      relatorio.qtd_excessos ? `${relatorio.qtd_excessos} excesso(s)` : null,
                      relatorio.qtd_paradas ? `${relatorio.qtd_paradas} parada(s)` : null,
                      `limite ${limite} km/h`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : 'Sem dados de rota para hoje'}
            </Typography>
            {!carregando && relatorio && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                Vermelho = excesso · placas {limite} km/h · cinza = parada · toque na rota para detalhes
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} aria-label="Fechar trajeto">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}
