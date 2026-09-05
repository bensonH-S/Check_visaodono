import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { colors } from '../theme/tokens';

/** Barra + texto de carregamento (padrão auditoria / checklist). */
export default function PageLoading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <Box sx={{ p: 2, width: '100%' }}>
      <LinearProgress sx={{ borderRadius: 1 }} />
      <Typography
        variant="body2"
        sx={{ mt: 1.5, textAlign: 'center', color: colors.textSecondary }}
      >
        {label}
      </Typography>
    </Box>
  );
}
