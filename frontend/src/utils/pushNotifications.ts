import { apiBasePath } from '../config/paths';
import { api } from '../api/client';

const PUSH_OK_KEY = 'vision-check:push-ok';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSuportado(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushJaRegistrado(): boolean {
  try {
    return localStorage.getItem(PUSH_OK_KEY) === '1';
  } catch {
    return false;
  }
}

function marcarPushRegistrado() {
  try {
    localStorage.setItem(PUSH_OK_KEY, '1');
  } catch {
    /* ignore */
  }
}

export async function obterVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${apiBasePath}/public/push/vapid-key`);
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string };
    return data.publicKey || null;
  } catch {
    return null;
  }
}

export async function registrarPushNotificacoes(forcar = false): Promise<boolean> {
  if (!pushSuportado()) return false;
  if (!forcar && pushJaRegistrado()) return true;

  const publicKey = await obterVapidPublicKey();
  if (!publicKey) return false;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api.pushSubscribe(subscription.toJSON());
  marcarPushRegistrado();
  return true;
}

export async function cancelarPushNotificacoes(): Promise<void> {
  if (!pushSuportado()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => {});
    await api.pushUnsubscribe(endpoint).catch(() => {});
  }
  try {
    localStorage.removeItem(PUSH_OK_KEY);
  } catch {
    /* ignore */
  }
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export function appInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneMedia || iosStandalone;
}

export function precisaInstalarIos(): boolean {
  return isIos() && isSafari() && !appInstalada();
}
