import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import LogoutIcon from '@mui/icons-material/Logout';
import type { FrotaVeiculo } from '../../api/client';
import { rotuloVeiculoLista } from '../../constants/frotaVeiculo';

const NAVY = '#1B2A6B';
const ORANGE = '#E8520A';

type Props = {
  veiculo: FrotaVeiculo;
  salvando?: boolean;
  onDesassumir: () => void;
};

export default function FrotaVeiculoControleCard({ veiculo, salvando, onDesassumir }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        borderRadius: 2.5,
        border: '1px solid rgba(27, 42, 107, 0.12)',
        borderLeft: `4px solid ${NAVY}`,
        bgcolor: '#fff',
        boxShadow: '0 6px 20px rgba(27, 42, 107, 0.08)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -24,
          right: -24,
          width: 88,
          height: 88,
          borderRadius: '50%',
          bgcolor: 'rgba(232, 82, 10, 0.08)',
        }}
      />

      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', position: 'relative' }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            bgcolor: 'rgba(27, 42, 107, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: ORANGE,
          }}
        >
          <DirectionsCarIcon />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', letterSpacing: '0.08em', lineHeight: 1.2, display: 'block' }}
          >
            Veículo sob seu controle
          </Typography>
          <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '1.05rem', lineHeight: 1.3, mt: 0.25 }}>
            {rotuloVeiculoLista(veiculo)}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
            <Chip label="Em uso" size="small" color="success" variant="outlined" sx={{ fontWeight: 600 }} />
            {veiculo.km_atual != null && (
              <Chip
                label={`KM ${veiculo.km_atual.toLocaleString('pt-BR')}`}
                size="small"
                sx={{
                  bgcolor: 'rgba(27, 42, 107, 0.06)',
                  color: NAVY,
                  fontWeight: 600,
                  border: '1px solid rgba(27, 42, 107, 0.1)',
                }}
              />
            )}
          </Box>
        </Box>
      </Box>

      <Button
        fullWidth
        variant="outlined"
        size="medium"
        disabled={salvando}
        onClick={onDesassumir}
        startIcon={<LogoutIcon fontSize="small" />}
        sx={{
          mt: 2,
          minHeight: 42,
          borderRadius: 2,
          borderColor: 'rgba(232, 82, 10, 0.45)',
          color: ORANGE,
          fontWeight: 700,
          bgcolor: 'rgba(232, 82, 10, 0.04)',
          '&:hover': {
            borderColor: ORANGE,
            bgcolor: 'rgba(232, 82, 10, 0.1)',
          },
        }}
      >
        {salvando ? 'Liberando veículo…' : 'Desassumir veículo'}
      </Button>
    </Paper>
  );
}
