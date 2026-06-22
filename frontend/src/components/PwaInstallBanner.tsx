import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { showToast } from '../utils/toast';
import {
  PUSH_ATUALIZADO_EVENT,
  appInstalada,
  ativarNotificacoesNoClique,
  deveExibirAtivacaoPush,
  isIos,
  notificacoesPrecisamAtivacao,
  precisaInstalarIos,
  pushJaRegistrado,
  pushPendenteConclusao,
  requerHttpsParaPush,
  sincronizarEstadoPush,
} from '../utils/pushNotifications';
import { ehRotaPromptInstalar } from '../hooks/usePwaInstallPrompt';

const NAVY = '#1B2A6B';
const DISMISS_KEY = 'vision-check:pwa-banner-dismiss';

function bannerDispensado(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function dispensarBanner() {
  if (!pushJaRegistrado()) return;
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function PwaInstallBanner() {
  const [visivel, setVisivel] = useState(false);
  const [modo, setModo] = useState<'notif' | 'https' | 'sucesso'>('notif');
  const [ativando, setAtivando] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error' | 'info'; texto: string } | null>(
    null,
  );

  const atualizarEstado = useCallback(() => {
    if (bannerDispensado() && pushJaRegistrado()) {
      setVisivel(false);
      return;
    }

    // Instalação é tratada pelo popup PwaInstallDialog
    if (!appInstalada() && (precisaInstalarIos() || ehRotaPromptInstalar())) {
      setVisivel(false);
      return;
    }

    if (requerHttpsParaPush() && isIos()) {
      setModo('https');
      setVisivel(true);
      return;
    }

    if (deveExibirAtivacaoPush() || notificacoesPrecisamAtivacao()) {
      setModo('notif');
      setVisivel(true);
      return;
    }

    setVisivel(false);
  }, []);

  useEffect(() => {
    void sincronizarEstadoPush().finally(atualizarEstado);
  }, [atualizarEstado]);

  useEffect(() => {
    function onPushAtualizado() {
      atualizarEstado();
    }
    window.addEventListener(PUSH_ATUALIZADO_EVENT, onPushAtualizado);
    return () => window.removeEventListener(PUSH_ATUALIZADO_EVENT, onPushAtualizado);
  }, [atualizarEstado]);

  function fechar() {
    dispensarBanner();
    setVisivel(false);
    setFeedback(null);
  }

  async function ativarNotificacoes() {
    setAtivando(true);
    setFeedback(null);
    try {
      const resultado = await ativarNotificacoesNoClique();

      if (resultado.ok) {
        setModo('sucesso');
        setFeedback({ tipo: 'success', texto: resultado.mensagem });
        showToast(resultado.mensagem, 'success');
        setTimeout(() => fechar(), 1500);
        return;
      }

      const recarregando = resultado.mensagem.includes('vai recarregar');
      setFeedback({ tipo: recarregando ? 'info' : 'error', texto: resultado.mensagem });
      showToast(resultado.mensagem, recarregando ? 'info' : 'error');
    } finally {
      setAtivando(false);
      atualizarEstado();
    }
  }

  const pendente = pushPendenteConclusao();
  const tituloNotif = 'Ative as notificações';
  const textoNotif = pendente
    ? 'Você já permitiu alertas no iPhone. Toque abaixo para concluir o registro no app — depois disso os avisos chegam mesmo com o app fechado (não precisa ficar logado).'
    : isIos()
      ? 'Permita alertas para receber novidades dos chamados com o app fechado. Abra sempre pelo ícone na Tela de Início.'
      : 'Receba alertas de chamados mesmo com o app fechado.';
  const rotuloBotao = ativando ? 'Ativando…' : 'Ativar notificações';

  if (!visivel) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        mx: 0,
        mb: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: pendente ? '1px solid rgba(220, 38, 38, 0.35)' : '1px solid rgba(27, 42, 107, 0.15)',
        bgcolor: pendente ? 'rgba(220, 38, 38, 0.04)' : '#fff',
        boxShadow: '0 4px 16px rgba(27, 42, 107, 0.1)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {modo === 'https' && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY, mb: 0.5 }}>
                HTTPS necessário no iPhone
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                O iOS só permite notificações em conexão segura. Abra o app pelo endereço{' '}
                <strong>https://grupoalvim.com.br/auditoria/login/mobile</strong>.
              </Typography>
            </>
          )}

          {(modo === 'notif' || modo === 'sucesso') && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY, mb: 0.5 }}>
                {modo === 'sucesso' ? 'Notificações ativas' : tituloNotif}
              </Typography>
              {modo === 'notif' && (
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45, mb: 1 }}>
                  {textoNotif}
                </Typography>
              )}
              {modo === 'sucesso' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#15803d' }}>
                  <CheckCircleOutlinedIcon fontSize="small" />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Alertas habilitados — você receberá push com o app fechado.
                  </Typography>
                </Box>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  color={pendente ? 'warning' : 'primary'}
                  startIcon={<NotificationsActiveIcon />}
                  onClick={ativarNotificacoes}
                  disabled={ativando}
                  sx={{ fontWeight: 600 }}
                >
                  {rotuloBotao}
                </Button>
              )}
            </>
          )}

          {feedback && modo !== 'sucesso' && (
            <Alert severity={feedback.tipo === 'error' ? 'error' : feedback.tipo} sx={{ mt: 1.25, py: 0.25 }}>
              {feedback.texto}
            </Alert>
          )}
        </Box>
        {pushJaRegistrado() && (
          <IconButton size="small" aria-label="Fechar" onClick={fechar} sx={{ color: NAVY, mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
    </Paper>
  );
}
