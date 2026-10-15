import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { Bell, CheckCheck, CreditCard, Ticket } from 'lucide-react';
import { api, type PortalNotificacao } from '../api/client';
import { formatDataHoraBrasilia } from '../utils/dateBr';
import { colors } from '../theme/tokens';
import { NOTIFICACOES_REFRESH } from '../utils/notificacoesEvent';

const POLL_MS = 8000;

function iconeTipo(tipo: string) {
  if (tipo.startsWith('pagamento')) return <CreditCard size={16} strokeWidth={2} />;
  if (tipo.startsWith('ti_')) return <Ticket size={16} strokeWidth={2} />;
  return <Bell size={16} strokeWidth={2} />;
}

function corTipo(tipo: string) {
  if (tipo === 'pagamento_hoje') return '#dc2626';
  if (tipo.startsWith('pagamento')) return '#d97706';
  if (tipo === 'ti_atribuicao_enviada') return '#16a34a';
  if (tipo.startsWith('ti_')) return '#2563eb';
  return colors.navy;
}

type Props = { variante?: 'portal' | 'icone' };

export default function PortalSino({ variante = 'portal' }: Props) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [items, setItems] = useState<PortalNotificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const res = await api.portalNotificacoes();
      setItems(res.items || []);
      setNaoLidas(res.nao_lidas || 0);
    } catch {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    void carregar();
    const t = window.setInterval(() => void carregar(), POLL_MS);
    const onRefresh = () => void carregar();
    window.addEventListener(NOTIFICACOES_REFRESH, onRefresh);
    return () => {
      window.clearInterval(t);
      window.removeEventListener(NOTIFICACOES_REFRESH, onRefresh);
    };
  }, [carregar]);

  async function abrirItem(n: PortalNotificacao) {
    if (!n.lida && typeof n.id_notificacao === 'number') {
      try {
        await api.portalNotificacaoLida(n.id_notificacao);
      } catch {
        /* ignore */
      }
    }
    setAnchor(null);
    if (n.link) navigate(n.link);
    void carregar();
  }

  async function marcarTodas() {
    try {
      await api.portalNotificacoesLidas();
      void carregar();
    } catch {
      /* ignore */
    }
  }

  const size = variante === 'portal' ? 20 : 18;

  return (
    <>
      <Tooltip title="Notificações">
        <IconButton
          size="small"
          aria-label="Notificações"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{
            color: colors.textSecondary,
            '&:hover': { color: colors.navy, bgcolor: colors.navyMuted },
          }}
        >
          <Badge
            badgeContent={naoLidas > 99 ? '99+' : naoLidas || undefined}
            color="error"
            overlap="circular"
            sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16 } }}
          >
            <Bell size={size} strokeWidth={2} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 360,
              maxWidth: 'calcin(100vw - 24px)',
              mt: 1,
              borderRadius: 2,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 12px 40px rgba(15,23,42,0.12)',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Stack direction="row" sx={{ px: 1.75, py: 1.25, alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Notificações</Typography>
          {naoLidas > 0 ? (
            <Button
              size="small"
              startIcon={<CheckCheck size={14} />}
              onClick={() => void marcarTodas()}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              Limpar
            </Button>
          ) : null}
        </Stack>
        <Divider />
        <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <Typography sx={{ p: 2.5, fontSize: 13, color: 'text.secondary', textAlign: 'center' }}>
              Nenhuma notificação no momento.
            </Typography>
          ) : (
            items.map((n) => (
              <Box
                key={String(n.id_notificacao)}
                onClick={() => void abrirItem(n)}
                sx={{
                  px: 1.75,
                  py: 1.25,
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 1.25,
                  bgcolor: n.lida ? 'transparent' : 'rgba(37,99,235,0.06)',
                  borderBottom: `1px solid ${colors.border}`,
                  '&:hover': { bgcolor: 'rgba(15,23,42,0.04)' },
                }}
              >
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '10px',
                    bgcolor: `${corTipo(n.tipo)}14`,
                    color: corTipo(n.tipo),
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    mt: 0.15,
                  }}
                >
                  {iconeTipo(n.tipo)}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: n.lida ? 500 : 700, lineHeight: 1.3 }}>
                    {n.titulo}
                  </Typography>
                  {n.mensagem ? (
                    <Typography
                      sx={{
                        fontSize: 12,
                        color: 'text.secondary',
                        mt: 0.25,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {n.mensagem}
                    </Typography>
                  ) : null}
                  <Typography sx={{ fontSize: 10.5, color: 'text.disabled', mt: 0.4 }}>
                    {formatDataHoraBrasilia(n.created_at)}
                  </Typography>
                </Box>
                {!n.lida ? (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: corTipo(n.tipo),
                      mt: 0.75,
                      flexShrink: 0,
                    }}
                  />
                ) : null}
              </Box>
            ))
          )}
        </Box>
      </Popover>
    </>
  );
}
