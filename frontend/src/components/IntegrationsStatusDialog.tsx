import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import { Activity } from 'lucide-react';
import type { IntegrationStatusGroup, IntegrationStatusItem } from '../api/client';
import { colors } from '../theme/tokens';

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

function StatusDot({ item }: { item: IntegrationStatusItem }) {
  const na = item.configured === false;
  const online = item.online;
  const label = na ? 'N/A' : online ? 'Online' : 'Offline';
  const color = na ? '#94a3b8' : online ? '#16a34a' : '#dc2626';
  const bg = na ? 'rgba(148, 163, 184, 0.18)' : online ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        flexShrink: 0,
        px: 1,
        py: 0.4,
        borderRadius: 999,
        fontSize: '0.7rem',
        fontWeight: 800,
        color,
        bgcolor: bg,
      }}
    >
      <Box
        component="span"
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: color,
          flexShrink: 0,
        }}
      />
      {label}
    </Box>
  );
}

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
  const tituloExibido =
    titulo || (contexto ? `Status API · ${groups[0]?.name || ''}`.replace(/\s·\s$/, '') : 'Status API');

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2.5,
            boxShadow: '0 16px 48px rgba(27, 42, 107, 0.18)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          color: colors.navy,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 1.5,
          px: 2,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Activity size={22} strokeWidth={2} color={colors.navy} aria-hidden />
        <Typography component="span" sx={{ fontWeight: 700, fontSize: '1.05rem', color: colors.navy, flex: 1 }}>
          {loading ? 'Status API' : tituloExibido || 'Status API'}
        </Typography>
        <IconButton
          size="small"
          aria-label="Atualizar"
          onClick={onAtualizar}
          disabled={loading}
          sx={{
            color: colors.navy,
            '&.Mui-disabled': { color: colors.navy, opacity: 0.85 },
          }}
        >
          <RefreshIcon
            fontSize="small"
            sx={
              loading
                ? {
                    animation: 'ck-status-spin 0.9s linear infinite',
                    '@keyframes ck-status-spin': {
                      from: { transform: 'rotate(0deg)' },
                      to: { transform: 'rotate(360deg)' },
                    },
                  }
                : undefined
            }
          />
        </IconButton>
        <IconButton size="small" aria-label="Fechar" onClick={onClose} sx={{ color: colors.navy }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: '20px !important', pb: 2.5, px: 2, minHeight: 160 }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              py: 5,
            }}
          >
            <CircularProgress size={22} thickness={4} sx={{ color: 'rgba(27, 42, 107, 0.45)' }} />
            <Typography sx={{ fontSize: '0.92rem', color: 'text.secondary', fontWeight: 500 }}>
              A verificar APIs...
            </Typography>
          </Box>
        ) : erro ? (
          <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', py: 2 }}>{erro}</Typography>
        ) : groups.length === 0 || groups.every((g) => g.apis.length === 0) ? (
          <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', py: 2 }}>
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
                        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: colors.navy }}>
                          {item.name}
                        </Typography>
                        <Typography
                          sx={{ fontSize: '0.75rem', color: 'text.secondary', fontWeight: 600 }}
                        >
                          {item.configured === false ? 'N/A' : item.detail}
                        </Typography>
                      </Box>
                      <StatusDot item={item} />
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
