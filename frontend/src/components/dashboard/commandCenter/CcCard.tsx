import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

type Props = {
  title: string;
  meta?: React.ReactNode;
  action?: string;
  actionTo?: string;
  children: React.ReactNode;
};

/** Bloco padrão do Command Center: mesmo Paper/borda das telas do financeiro. */
export default function CcCard({ title, meta, action, actionTo, children }: Props) {
  return (
    <Paper
      variant="outlined"
      sx={{ height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.5,
          minHeight: 36,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{title}</Typography>
          {meta && (
            <Typography component="div" sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {meta}
            </Typography>
          )}
        </Box>
        {action && actionTo && (
          <Typography
            component={RouterLink}
            to={actionTo}
            sx={{ fontSize: 11.5, fontWeight: 500, color: 'primary.main', textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
          >
            {action}
          </Typography>
        )}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</Box>
    </Paper>
  );
}

/** Mensagem centralizada para estados vazio/erro dentro de um CcCard. */
export function CcVazio({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>{children}</Typography>
    </Box>
  );
}
