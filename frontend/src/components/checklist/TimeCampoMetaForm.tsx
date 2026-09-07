import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { MetaVisitaTimeCampo } from '../../api/client';
import { colors } from '../../theme/tokens';

interface Props {
  value: MetaVisitaTimeCampo;
  onChange: (patch: Partial<MetaVisitaTimeCampo>) => void;
}

export default function TimeCampoMetaForm({ value, onChange }: Props) {
  const fieldSx = { '& .MuiOutlinedInput-root': { bgcolor: colors.surface } };
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        Dados da visita (Time de Campo)
      </Typography>
      <TextField
        fullWidth
        label="Gerente"
        value={value.gerente ?? ''}
        onChange={(e) => onChange({ gerente: e.target.value })}
        sx={{ mb: 1.5, ...fieldSx }}
        size="small"
      />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mb: 1.5 }}>
        <TextField
          label="Coordenador 1º dia"
          value={value.coordenador_1_dia ?? ''}
          onChange={(e) => onChange({ coordenador_1_dia: e.target.value })}
          size="small"
          sx={fieldSx}
        />
        <TextField
          label="Coordenador 2º dia"
          value={value.coordenador_2_dia ?? ''}
          onChange={(e) => onChange({ coordenador_2_dia: e.target.value })}
          size="small"
          sx={fieldSx}
        />
        <TextField
          label="Coordenador madrugada 1"
          value={value.coordenador_madrugada_1 ?? ''}
          onChange={(e) => onChange({ coordenador_madrugada_1: e.target.value })}
          size="small"
          sx={fieldSx}
        />
        <TextField
          label="Coordenador madrugada 2"
          value={value.coordenador_madrugada_2 ?? ''}
          onChange={(e) => onChange({ coordenador_madrugada_2: e.target.value })}
          size="small"
          sx={fieldSx}
        />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <TextField
          label="Time total"
          type="number"
          slotProps={{ htmlInput: { min: 0 } }}
          value={value.time_total ?? ''}
          onChange={(e) => onChange({ time_total: e.target.value })}
          size="small"
          sx={fieldSx}
        />
        <TextField
          label="Território"
          value={value.territorio ?? ''}
          onChange={(e) => onChange({ territorio: e.target.value })}
          size="small"
          sx={fieldSx}
        />
      </Box>
    </Box>
  );
}
