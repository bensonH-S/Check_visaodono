import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import GetAppIcon from '@mui/icons-material/GetApp';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { showToast } from '../utils/toast';
import {
  appInstalada,
  isIos,
  notificacoesPrecisamAtivacao,
  precisaInstalarIos,
  pushJaRegistrado,
  pushSuportado,
  registrarPushNotificacoes,
  requerHttpsParaPush,
} from '../utils/pushNotifications';

const NAVY = '#1B2A6B';
const DISMISS_KEY = 'vision-check:pwa-banner-dismiss';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function bannerDispensado(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function dispensarBanner() {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function PwaInstallBanner() {
  const [visivel, setVisivel] = useState(false);
  const [modo, setModo] = useState<'ios' | 'android' | 'notif' | 'https' | 'sucesso'>('ios');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ativandoNotif, setAtivandoNotif] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error' | 'info'; texto: string } | null>(
    null,
  );

  const atualizarEstado = useCallback(() => {
    if (bannerDispensado() && pushJaRegistrado()) {
      setVisivel(false);
      return;
    }

    if (precisaInstalarIos()) {
      setModo('ios');
      setVisivel(true);
      return;
    }

    if (requerHttpsParaPush() && isIos()) {
      setModo('https');
      setVisivel(true);
      return;
    }

    if (deferredPrompt) {
      setModo('android');
      setVisivel(true);
      return;
    }

    if (notificacoesPrecisamAtivacao()) {
      setModo('notif');
      setVisivel(true);
      return;
    }

    setVisivel(false);
  }, [deferredPrompt]);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    atualizarEstado();

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, [atualizarEstado]);

  useEffect(() => {
    atualizarEstado();
  }, [deferredPrompt, atualizarEstado]);

  useEffect(() => {
    if (!appInstalada() || !pushSuportado() || requerHttpsParaPush()) return;
    if (Notification.permission === 'granted' && !pushJaRegistrado()) {
      registrarPushNotificacoes(true).then((r) => {
        if (r.ok) atualizarEstado();
      });
    }
  }, [atualizarEstado]);

  function fechar() {
    dispensarBanner();
    setVisivel(false);
    setFeedback(null);
  }

  async function instalarAndroid() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    fechar();
  }

  async function ativarNotificacoes() {
    setAtivandoNotif(true);
    setFeedback(null);
    try {
      const resultado = await registrarPushNotificacoes(true);

      if (resultado.ok) {
        setModo('sucesso');
        setFeedback({ tipo: 'success', texto: resultado.mensagem });
        showToast(resultado.mensagem, 'success');
        setTimeout(() => fechar(), 2500);
        return;
      }

      setFeedback({ tipo: 'error', texto: resultado.mensagem });
      showToast(resultado.mensagem, 'error');
    } finally {
      setAtivandoNotif(false);
    }
  }

  if (!visivel) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        mx: 0,
        mb: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: '1px solid rgba(27, 42, 107, 0.15)',
        bgcolor: '#fff',
        boxShadow: '0 4px 16px rgba(27, 42, 107, 0.1)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {modo === 'ios' && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY, mb: 0.5 }}>
                Instale no iPhone/iPad
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                Para receber alertas com o app fechado no iOS, adicione à Tela de Início: toque em{' '}
                <IosShareIcon sx={{ fontSize: 16, verticalAlign: 'text-bottom', mx: 0.25 }} />
                Compartilhar → <strong>Adicionar à Tela de Início</strong>, depois abra o ícone
                Vision Check e toque em Ativar notificações.
              </Typography>
            </>
          )}

          {modo === 'https' && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY, mb: 0.5 }}>
                HTTPS necessário no iPhone
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                O iOS só permite notificações em conexão segura. Abra o app pelo endereço{' '}
                <strong>https://grupoalvim.com.br/auditoria/login/mobile</strong> (produção), não
                pelo IP local da rede Wi‑Fi.
              </Typography>
            </>
          )}

          {modo === 'android' && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY, mb: 0.5 }}>
                Instale o app de chamados
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45, mb: 1 }}>
                Instale na tela inicial para receber notificações mesmo com o app fechado.
              </Typography>
              <Button
                size="small"
                variant="contained"
                startIcon={<GetAppIcon />}
                onClick={instalarAndroid}
                sx={{ fontWeight: 600 }}
              >
                Instalar app
              </Button>
            </>
          )}

          {(modo === 'notif' || modo === 'sucesso') && (
            <>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: NAVY, mb: 0.5 }}>
                {modo === 'sucesso' ? 'Notificações ativas' : 'Ative as notificações'}
              </Typography>
              {modo === 'notif' && (
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45, mb: 1 }}>
                  {isIos()
                    ? 'Permita alertas para receber novidades dos chamados com o app fechado.'
                    : 'Receba alertas de chamados mesmo com o app fechado.'}
                </Typography>
              )}
              {modo === 'sucesso' ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#15803d' }}>
                  <CheckCircleOutlinedIcon fontSize="small" />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Tudo certo! Alertas habilitados neste aparelho.
                  </Typography>
                </Box>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<NotificationsActiveIcon />}
                  onClick={ativarNotificacoes}
                  disabled={ativandoNotif}
                  sx={{ fontWeight: 600 }}
                >
                  {ativandoNotif ? 'Ativando…' : 'Ativar notificações'}
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
        <IconButton size="small" aria-label="Fechar" onClick={fechar} sx={{ color: NAVY, mt: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}
