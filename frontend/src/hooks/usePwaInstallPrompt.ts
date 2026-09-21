import { useCallback, useEffect, useState } from 'react';
import { isMobileAppPath } from '../config/mobileRoutes';
import { appInstalada, isIos } from '../utils/pushNotifications';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** iPhone / Android telefone. Notebook, iPad e desktop não entram. */
export function ehTelefone(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return false;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !/iPhone|iPod/i.test(ua)) {
    return false;
  }
  return /iPhone|iPod/i.test(ua) || /Android.+Mobile/i.test(ua);
}

export function ehNavegadorMobile(): boolean {
  return ehTelefone();
}

export function ehRotaPromptInstalar(): boolean {
  return ehNavegadorMobile();
}

/** Vite / IP da rede: não trava, senão some o preview no celular. */
export function ehAmbientePreviewLocal(): boolean {
  if (typeof window === 'undefined') return true;
  if (import.meta.env.DEV) return true;
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  );
}

export function isIosChrome(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isIos() && /CriOS/i.test(navigator.userAgent);
}

export function deveExigirAppInstalado(): boolean {
  if (ehAmbientePreviewLocal()) return false;
  if (!ehTelefone()) return false;
  return !appInstalada();
}

export function deveBloquearComputadorNoApp(): boolean {
  if (ehAmbientePreviewLocal()) return false;
  if (ehTelefone()) return false;
  if (typeof window === 'undefined') return false;
  return isMobileAppPath(window.location.pathname);
}

export type ModoInstalacaoPwa = 'android' | 'android-manual' | 'ios' | 'computador';

export function usePwaInstallPrompt(rotaAtual?: string) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<ModoInstalacaoPwa>('ios');
  const [instalando, setInstalando] = useState(false);

  const avaliar = useCallback(() => {
    if (deveBloquearComputadorNoApp()) {
      setModo('computador');
      setAberto(true);
      return;
    }

    if (!deveExigirAppInstalado()) {
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

    setModo('android-manual');
    setAberto(true);
  }, [deferredPrompt, rotaAtual]);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('popstate', avaliar);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener('change', avaliar);
    const t = window.setTimeout(avaliar, 400);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('popstate', avaliar);
      mq.removeEventListener('change', avaliar);
      window.clearTimeout(t);
    };
  }, [avaliar]);

  useEffect(() => {
    avaliar();
  }, [avaliar]);

  const instalarAndroid = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalando(true);
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      // Recusou ou aceitou: só some quando o app estiver de fato na tela inicial.
    } finally {
      setInstalando(false);
    }
  }, [deferredPrompt]);

  return {
    aberto,
    modo,
    instalando,
    podeInstalarNativo: Boolean(deferredPrompt),
    instalarAndroid,
  };
}
