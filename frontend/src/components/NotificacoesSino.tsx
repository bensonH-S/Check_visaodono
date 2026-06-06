import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { api, type ContextoNotificacoesManut, type ManutNotificacao } from '../api/client';
import { formatDataHoraBrasilia } from '../utils/dateBr';
import { NOTIFICACOES_REFRESH } from '../utils/notificacoesEvent';
import { tituloNotificacaoChamado } from '../utils/notificacoesTexto';
import NotificacaoBadge from './NotificacaoBadge';

const NAVY = '#1B2A6B';
const POLL_MS = 3000;

type Props = {
  variante: 'mobile' | 'portal';
  contexto: ContextoNotificacoesManut;
  idLoja?: number | null;
  /** Painel mais largo (ex.: detalhe desktop do chamado) */
  menuLargo?: boolean;
};

function filtrarPorLoja(notifs: ManutNotificacao[], idLoja?: number | null) {
  if (idLoja == null) return notifs;
  return notifs.filter((n) => n.id_loja === idLoja);
}

export default function NotificacoesSino({ variante, contexto, idLoja, menuLargo }: Props) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [lista, setLista] = useState<ManutNotificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [toast, setToast] = useState('');
  const ultimoIdVisto = useRef(0);
  const baselineOk = useRef(false);

  const tituloMenu =
    contexto === 'aprovacoes' ? 'Aprovações pendentes' : 'Notificações';
  const painelLargo =
    menuLargo || contexto === 'aprovacoes' || (variante === 'portal' && contexto === 'chamados');
  const larguraMenu = painelLargo ? 460 : variante === 'mobile' ? 320 : 360;

  const carregar = useCallback(() => {
    Promise.all([
      api.manutNotificacoes(contexto),
      api.manutNotificacoesNaoLidas({ idLoja, contexto }),
    ])
      .then(([notifs, contagem]) => {
        const filtradas = filtrarPorLoja(notifs, idLoja);
        setLista(filtradas);
        const total = contagem.total;
        const maxIdNaoLida = filtradas.filter((n) => !n.lida).reduce(
          (max, n) => Math.max(max, n.id_notificacao),
          0,
        );

        if (!baselineOk.current) {
          ultimoIdVisto.current = maxIdNaoLida;
          baselineOk.current = true;
        } else if (maxIdNaoLida > ultimoIdVisto.current) {
          const nova = filtradas.find((n) => n.id_notificacao === maxIdNaoLida);
          if (nova) setToast(tituloNotificacaoChamado(nova, { contexto }));
          ultimoIdVisto.current = maxIdNaoLida;
        }

        setNaoLidas(total);
      })
      .catch(() => {});
  }, [idLoja, contexto]);

  useEffect(() => {
    baselineOk.current = false;
  }, [idLoja, contexto]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, POLL_MS);

    function onRefresh() {
      carregar();
    }
    function onFocus() {
      carregar();
    }
    function onVisible() {
      if (document.visibilityState === 'visible') carregar();
    }

    window.addEventListener(NOTIFICACOES_REFRESH, onRefresh);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(t);
      window.removeEventListener(NOTIFICACOES_REFRESH, onRefresh);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [carregar]);

  function irDestino(idChamado: number) {
    if (contexto === 'aprovacoes') {
      navigate(`/chamados/aprovacoes/${idChamado}`);
    } else if (variante === 'mobile') {
      navigate(`/chamados/mobile/${idChamado}`);
    } else {
      navigate(`/chamados/${idChamado}`);
    }
    setAnchor(null);
  }

  async function abrirNotificacao(n: ManutNotificacao) {
    if (!n.lida) {
      await api.manutNotificacaoMarcarLida(n.id_notificacao).catch(() => {});
      setNaoLidas((v) => Math.max(0, v - 1));
    }
    irDestino(n.id_chamado);
  }

  async function marcarTodas() {
    await api.manutNotificacoesMarcarTodasLidas({ idLoja, contexto }).catch(() => {});
    setNaoLidas(0);
    setLista((prev) => prev.map((n) => ({ ...n, lida: true })));
  }

  return (
    <>
      <IconButton
        size="small"
        aria-label={tituloMenu}
        onClick={(e) => {
          setAnchor(e.currentTarget);
          carregar();
        }}
        sx={{ color: NAVY, position: 'relative' }}
      >
        <Badge
          badgeContent={naoLidas > 0 ? naoLidas : null}
          color="error"
          max={99}
          overlap="circular"
          sx={{
            '& .MuiBadge-badge': {
              backgroundColor: '#DC2626',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.65rem',
              minWidth: 18,
              height: 18,
              border: '2px solid #f5f5f3',
            },
          }}
        >
          <NotificationsNoneOutlinedIcon fontSize="small" />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { width: larguraMenu, maxWidth: '95vw', maxHeight: 400 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY }}>
              {tituloMenu}
            </Typography>
            <NotificacaoBadge count={naoLidas} />
          </Box>
          {naoLidas > 0 && (
            <Button size="small" onClick={marcarTodas}>
              Marcar lidas
            </Button>
          )}
        </Box>
        <Divider />
        {!lista.length && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {contexto === 'aprovacoes'
                ? 'Nenhuma aprovação pendente'
                : 'Nenhuma notificação de chamados'}
            </Typography>
          </MenuItem>
        )}
        {lista.map((n) => (
          <MenuItem
            key={n.id_notificacao}
            onClick={() => abrirNotificacao(n)}
            sx={{
              alignItems: 'flex-start',
              flexDirection: 'row',
              gap: 1,
              py: painelLargo ? 1.5 : 1.25,
              px: painelLargo ? 1.5 : 1,
              bgcolor: n.lida ? 'transparent' : 'rgba(27, 42, 107, 0.05)',
            }}
          >
            {!n.lida && (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#DC2626',
                  mt: 0.75,
                  flexShrink: 0,
                }}
              />
            )}
            <Box sx={{ flex: 1, minWidth: 0, pl: n.lida ? 1.75 : 0 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: n.lida ? 400 : 700,
                  lineHeight: 1.4,
                  fontSize: painelLargo ? '0.9rem' : undefined,
                }}
              >
                {tituloNotificacaoChamado(n, { contexto })}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDataHoraBrasilia(n.created_at)}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ zIndex: 9999 }}
      >
        <Alert severity="info" variant="filled" onClose={() => setToast('')} sx={{ width: '100%' }}>
          {toast}
        </Alert>
      </Snackbar>
    </>
  );
}
