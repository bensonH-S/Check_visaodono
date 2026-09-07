import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { colors } from '../../theme/tokens';
import { useAppTheme } from '../../context/ThemeContext';

type Props = {
  titulo: string;
  icone?: ReactNode;
  children: ReactNode;
  /** Destaque para ações principais */
  destaque?: 'default' | 'sucesso' | 'alerta';
  /** Sem padding interno extra (ex.: timeline) */
  semPadding?: boolean;
};

export default function DetalheSecao({ titulo, icone, children, destaque = 'default', semPadding }: Props) {
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const bordaTopo =
    destaque === 'sucesso' ? '#22C55E' : destaque === 'alerta' ? '#F59E0B' : escuro ? '#E8520A' : colors.navy;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: `1px solid ${colors.border}`,
        borderTop: `3px solid ${bordaTopo}`,
        overflow: 'hidden',
        bgcolor: colors.surface,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: escuro ? 'rgba(148, 163, 184, 0.08)' : 'rgba(27, 42, 107, 0.03)',
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {icone}
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 800, color: colors.textPrimary, letterSpacing: '-0.01em' }}
        >
          {titulo}
        </Typography>
      </Box>
      <Box sx={semPadding ? undefined : { p: 2 }}>{children}</Box>
    </Paper>
  );
}
