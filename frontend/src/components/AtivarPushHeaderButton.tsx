import { useCallback, useEffect, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { showToast } from '../utils/toast';
import {
  PUSH_ATUALIZADO_EVENT,
  ativarNotificacoesNoClique,
  deveExibirAtivacaoPush,
  sincronizarEstadoPush,
} from '../utils/pushNotifications';

export default function AtivarPushHeaderButton() {
  const [visivel, setVisivel] = useState(false);
  const [ativando, setAtivando] = useState(false);

  const atualizar = useCallback(() => {
    setVisivel(deveExibirAtivacaoPush());
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
      const r = await ativarNotificacoesNoClique();
      showToast(r.mensagem, r.ok ? 'success' : r.mensagem.includes('recarregar') ? 'info' : 'error');
      atualizar();
    } finally {
      setAtivando(false);
    }
  }

  const titulo = ativando ? 'Ativando…' : 'Ativar notificações';

  return (
    <Tooltip title={titulo}>
      <IconButton
        size="small"
        aria-label="Ativar notificações"
        onClick={ativar}
        disabled={ativando}
        sx={{
          color: '#E8520A',
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
