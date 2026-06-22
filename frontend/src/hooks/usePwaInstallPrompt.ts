import { useCallback, useEffect, useState } from 'react';
import { toAppPath } from '../config/paths';
import { appInstalada, isIos } from '../utils/pushNotifications';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTALL_DISMISS_KEY = 'vision-check:pwa-install-dismiss';

export function ehNavegadorMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    window.matchMedia('(max-width: 767px)').matches
  );
}

export function ehRotaPromptInstalar(): boolean {
  if (typeof window === 'undefined') return false;
  const appPath = toAppPath(window.location.pathname);
  return (
    appPath === '/login/mobile' ||
    appPath === '/chamados/mobile' ||
    appPath.startsWith('/chamados/mobile/')
  );
}

function promptInstalarDispensado(): boolean {
  try {
    return sessionStorage.getItem(INSTALL_DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dispensarPromptInstalar() {
  try {
    sessionStorage.setItem(INSTALL_DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

export type ModoInstalacaoPwa = 'android' | 'android-manual' | 'ios';

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<ModoInstalacaoPwa>('ios');
  const [instalando, setInstalando] = useState(false);

  const avaliar = useCallback(() => {
    if (!ehNavegadorMobile() || !ehRotaPromptInstalar()) {
      setAberto(false);
      return;
    }
    if (appInstalada() || promptInstalarDispensado()) {
      setAberto(false);
      return;
    }

    if (isIos()) {
      setModo('ios');
      setAberto(true);
      return;
    }

    if (deferredPrompt) {
      setModo('android');
      setAberto(true);
      return;
    }

    // Android sem evento nativo (critérios PWA ainda não atendidos ou browser limitado)
    setModo('android-manual');
    setAberto(true);
  }, [deferredPrompt]);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    const t = window.setTimeout(avaliar, 800);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.clearTimeout(t);
    };
  }, [avaliar]);

  useEffect(() => {
    avaliar();
  }, [avaliar]);

  const dispensar = useCallback(() => {
    dispensarPromptInstalar();
    setAberto(false);
  }, []);

  const instalarAndroid = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalando(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        setAberto(false);
      }
    } finally {
      setInstalando(false);
    }
  }, [deferredPrompt]);

  return {
    aberto,
    modo,
    instalando,
    podeInstalarNativo: Boolean(deferredPrompt),
    dispensar,
    instalarAndroid,
  };
}
