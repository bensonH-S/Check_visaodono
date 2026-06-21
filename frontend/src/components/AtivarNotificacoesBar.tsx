import { useCallback, useEffect, useState } from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { showToast } from '../utils/toast';
import {
  PUSH_ATUALIZADO_EVENT,
  ativarNotificacoesNoClique,
  deveExibirAtivacaoPush,
  ehRotaMobileChamados,
  isIos,
  precisaInstalarIos,
  pushPendenteConclusao,
  pushRegistradoNoServidor,
  reativarNotificacoesPush,
  sincronizarEstadoPush,
} from '../utils/pushNotifications';

const FOOTER_H = 64;
const NAVY = '#1B2A6B';

export default function AtivarNotificacoesBar() {
  const [visivel, setVisivel] = useState(() => ehRotaMobileChamados());
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

  const pendente = pushPendenteConclusao();
  const bloqueado = typeof Notification !== 'undefined' && Notification.permission === 'denied';
  const precisaInstalar = precisaInstalarIos();
  const rotuloBotao = registrado
    ? ativando
      ? 'Reativando…'
      : 'Reativar notificações'
    : ativando
      ? 'Ativando…'
      : 'Ativar notificações';

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

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: `calc(${FOOTER_H}px + 8px + env(safe-area-inset-bottom, 0px))`,
        zIndex: 45,
        p: 1.5,
        borderRadius: 2,
        border: registrado
          ? '1px solid rgba(34, 197, 94, 0.4)'
          : '1px solid rgba(232, 82, 10, 0.35)',
        bgcolor: '#fff',
        boxShadow: '0 8px 24px rgba(27, 42, 107, 0.18)',
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY, mb: 0.5 }}>
        {bloqueado
          ? 'Notificações bloqueadas'
          : precisaInstalar
            ? 'Instale o app no iPhone'
            : registrado
              ? 'Notificações vinculadas'
              : 'Ative as notificações'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, lineHeight: 1.45 }}>
        {bloqueado
          ? isIos()
            ? 'Ajustes → Vision Check → Notificações → Permitir.'
            : 'Ative nas configurações do app/navegador.'
          : precisaInstalar
            ? 'Safari → Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone e toque no botão.'
            : registrado
              ? 'Toque em Reativar para remover o vínculo antigo e registrar de novo (útil se não recebe alertas).'
              : pendente
                ? 'Permissão já concedida. Toque abaixo para concluir o registro.'
                : 'Receba alertas de chamados com o app fechado (2º plano).'}
      </Typography>
      {!bloqueado && (
        <Button
          fullWidth
          variant="contained"
          color={registrado ? 'success' : pendente ? 'warning' : 'primary'}
          size="medium"
          startIcon={<NotificationsActiveIcon />}
          onClick={ativar}
          disabled={ativando}
          sx={{ fontWeight: 700, py: 1 }}
        >
          {rotuloBotao}
        </Button>
      )}
    </Paper>
  );
}
