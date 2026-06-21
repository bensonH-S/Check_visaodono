import { useCallback, useEffect, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { showToast } from '../utils/toast';
import {
  PUSH_ATUALIZADO_EVENT,
  ativarNotificacoesNoClique,
  deveExibirAtivacaoPush,
  pushRegistradoNoServidor,
  reativarNotificacoesPush,
  sincronizarEstadoPush,
} from '../utils/pushNotifications';

export default function AtivarPushHeaderButton() {
  const [visivel, setVisivel] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const [ativando, setAtivando] = useState(false);

  const atualizar = useCallback(() => {
    setVisivel(deveExibirAtivacaoPush());
    setRegistrado(pushRegistradoNoServidor());
  }, []);

  useEffect(() => {
    void sincronizarEstadoPush().finally(atualizar);
    window.addEventListener(PUSH_ATUALIZADO_EVENT, atualizar);
    return () => window.removeEventListener(PUSH_ATUALIZADO_EVENT, atualizar);
  }, [atualizar]);

  if (!visivel) return null;

  async function ativar() {
    setAtivando(true);
    try {
      const r = registrado ? await reativarNotificacoesPush() : await ativarNotificacoesNoClique();
      showToast(r.mensagem, r.ok ? 'success' : r.mensagem.includes('recarregar') ? 'info' : 'error');
      atualizar();
    } finally {
      setAtivando(false);
    }
  }

  const titulo = registrado
    ? ativando
      ? 'Reativando…'
      : 'Reativar notificações'
    : ativando
      ? 'Ativando…'
      : 'Ativar notificações push';

  return (
    <Tooltip title={titulo}>
      <IconButton
        size="small"
        aria-label="Ativar notificações"
        onClick={ativar}
        disabled={ativando}
        sx={{
          color: registrado ? '#22c55e' : '#E8520A',
          animation: ativando ? 'none' : 'pulse-push 2s ease-in-out infinite',
          '@keyframes pulse-push': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.55 },
          },
        }}
      >
        <NotificationsActiveIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
