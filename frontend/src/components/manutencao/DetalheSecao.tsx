import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

const NAVY = '#1B2A6B';

type Props = {
  titulo: string;
  icone?: ReactNode;
  children: ReactNode;
  /** Destaque para ações principais */
  destaque?: 'default' | 'sucesso' | 'alerta';
  /** Sem padding interno extra (ex.: timeline) */
  semPadding?: boolean;
};

const DESTAQUE_BORDA = {
  default: 'rgba(27, 42, 107, 0.12)',
  sucesso: '#22C55E',
  alerta: '#F59E0B',
};

export default function DetalheSecao({ titulo, icone, children, destaque = 'default', semPadding }: Props) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid rgba(27, 42, 107, 0.1)',
        borderTop: `3px solid ${DESTAQUE_BORDA[destaque]}`,
        overflow: 'hidden',
        bgcolor: '#fff',
        boxShadow: '0 1px 6px rgba(27, 42, 107, 0.06)',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'rgba(27, 42, 107, 0.03)',
          borderBottom: '1px solid rgba(27, 42, 107, 0.08)',
        }}
      >
        {icone}
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: NAVY, letterSpacing: '-0.01em' }}>
          {titulo}
        </Typography>
      </Box>
      <Box sx={semPadding ? undefined : { p: 2 }}>{children}</Box>
    </Paper>
  );
}
