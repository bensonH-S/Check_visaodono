import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import type { IntegrationStatusGroup } from '../api/client';

const NAVY = '#1B2A6B';

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  erro: string;
  groups: IntegrationStatusGroup[];
  /** Página com contexto filtrado (esconde nome do grupo). */
  contexto?: string;
  titulo?: string;
  onAtualizar: () => void;
};

export default function IntegrationsStatusDialog({
  open,
  onClose,
  loading,
  erro,
  groups,
  contexto,
  titulo,
  onAtualizar,
}: Props) {
  const tituloExibido = titulo || (contexto ? `Status API · ${groups[0]?.name || ''}`.replace(/\s·\s$/, '') : 'Status API');

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700, color: NAVY, pb: 0.5 }}>
        {loading ? 'Status API' : tituloExibido || 'Status API'}
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 1.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} sx={{ color: NAVY }} />
          </Box>
        ) : erro ? (
          <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>{erro}</Typography>
        ) : groups.length === 0 || groups.every((g) => g.apis.length === 0) ? (
          <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>
            {contexto ? 'Esta página não usa APIs externas.' : 'Nenhum status disponível.'}
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {groups.map((grupo) => (
              <Box key={grupo.id}>
                {!contexto ? (
                  <Typography
                    sx={{
                      mb: 0.85,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'rgba(27, 42, 107, 0.55)',
                    }}
                  >
                    {grupo.name}
                  </Typography>
                ) : null}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {grupo.apis.map((item) => (
                    <Box
                      key={`${grupo.id}-${item.id}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        px: 1.25,
                        py: 1.1,
                        borderRadius: 2,
                        border: '1px solid rgba(27, 42, 107, 0.12)',
                        bgcolor: 'rgba(27, 42, 107, 0.03)',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: NAVY }}>
                          {item.name}
                        </Typography>
                        <Typography
                          sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}
                        >
                          {item.detail}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          flexShrink: 0,
                          px: 1,
                          py: 0.35,
                          borderRadius: 999,
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          color: item.online ? '#14532d' : '#991b1b',
                          bgcolor: item.online ? '#bbf7d0' : '#fecaca',
                        }}
                      >
                        {item.online ? 'Online' : 'Offline'}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ fontWeight: 700 }}>
          Fechar
        </Button>
        <Button
          variant="contained"
          disabled={loading}
          onClick={onAtualizar}
          sx={{ fontWeight: 800, bgcolor: NAVY }}
        >
          Atualizar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
