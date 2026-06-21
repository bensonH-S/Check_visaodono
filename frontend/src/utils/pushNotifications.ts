import { apiBasePath } from '../config/paths';
import { api } from '../api/client';

const PUSH_OK_KEY = 'vision-check:push-ok';

export type ResultadoPushRegistro = {
  ok: boolean;
  codigo:
    | 'ok'
    | 'ja_registrado'
    | 'nao_suportado'
    | 'ios_nao_instalado'
    | 'requer_https'
    | 'vapid_indisponivel'
    | 'permissao_negada'
    | 'permissao_bloqueada'
    | 'service_worker_indisponivel'
    | 'inscricao_falhou'
    | 'servidor_falhou'
    | 'erro_desconhecido';
  mensagem: string;
};

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

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function appInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  const standaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneMedia || iosStandalone;
}

export function precisaInstalarIos(): boolean {
  return isIos() && !appInstalada();
}

export function requerHttpsParaPush(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.isSecureContext;
}

async function aguardarServiceWorker(timeoutMs = 20000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
  } catch {
    return null;
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

function validarPreRequisitos(): ResultadoPushRegistro | null {
  if (isIos() && !appInstalada()) {
    return {
      ok: false,
      codigo: 'ios_nao_instalado',
      mensagem:
        'No iPhone, instale o app primeiro: Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone Vision Check.',
    };
  }

  if (requerHttpsParaPush()) {
    return {
      ok: false,
      codigo: 'requer_https',
      mensagem:
        'Notificações no celular exigem HTTPS. Use o endereço de produção (grupoalvim.com.br/auditoria) ou um túnel seguro — IP local (http://192.168…) não funciona no iOS.',
    };
  }

  if (!pushSuportado()) {
    return {
      ok: false,
      codigo: 'nao_suportado',
      mensagem: isIos()
        ? 'Push não disponível neste dispositivo. Use iOS 16.4+ com o app instalado na Tela de Início.'
        : 'Seu navegador não suporta notificações push.',
    };
  }

  return null;
}

export async function registrarPushNotificacoes(forcar = false): Promise<ResultadoPushRegistro> {
  const pre = validarPreRequisitos();
  if (pre) return pre;

  if (!forcar && pushJaRegistrado()) {
    return {
      ok: true,
      codigo: 'ja_registrado',
      mensagem: 'Notificações já estavam ativas neste aparelho.',
    };
  }

  const publicKey = await obterVapidPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      codigo: 'vapid_indisponivel',
      mensagem: 'Servidor de notificações não configurado. Avise o suporte (chaves VAPID).',
    };
  }

  let permission = Notification.permission;

  if (permission === 'denied') {
    return {
      ok: false,
      codigo: 'permissao_bloqueada',
      mensagem: isIos()
        ? 'Notificações bloqueadas. Ajustes → Vision Check → Notificações → Permitir.'
        : 'Notificações bloqueadas. Ative nas configurações do navegador ou do app.',
    };
  }

  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return {
      ok: false,
      codigo: 'permissao_negada',
      mensagem: 'Permissão de notificação não concedida. Toque em Permitir quando o iOS solicitar.',
    };
  }

  const registration = await aguardarServiceWorker();
  if (!registration) {
    return {
      ok: false,
      codigo: 'service_worker_indisponivel',
      mensagem:
        'App ainda carregando. Feche e abra de novo pelo ícone na Tela de Início, depois tente outra vez.',
    };
  }

  try {
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.pushSubscribe(subscription.toJSON());
    marcarPushRegistrado();

    return {
      ok: true,
      codigo: 'ok',
      mensagem: 'Notificações ativadas com sucesso! Você receberá alertas mesmo com o app fechado.',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    if (msg.includes('Sessão expirada') || msg.includes('401')) {
      return {
        ok: false,
        codigo: 'servidor_falhou',
        mensagem: 'Sessão expirada. Faça login novamente e tente ativar as notificações.',
      };
    }

    if (msg.includes('Push notifications não configuradas') || msg.includes('503')) {
      return {
        ok: false,
        codigo: 'vapid_indisponivel',
        mensagem: 'Servidor de notificações não configurado. Avise o suporte.',
      };
    }

    return {
      ok: false,
      codigo: msg.toLowerCase().includes('subscribe') ? 'inscricao_falhou' : 'servidor_falhou',
      mensagem:
        msg && msg.length < 120
          ? msg
          : 'Não foi possível ativar. Verifique conexão e tente de novo.',
    };
  }
}

export async function cancelarPushNotificacoes(): Promise<void> {
  if (!pushSuportado()) return;
  const registration = await aguardarServiceWorker();
  if (!registration) return;
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

export function notificacoesPrecisamAtivacao(): boolean {
  if (precisaInstalarIos()) return true;
  if (requerHttpsParaPush()) return true;
  if (!pushSuportado()) return isIos() && appInstalada();
  if (Notification.permission === 'denied') return true;
  if (Notification.permission !== 'granted') return true;
  return !pushJaRegistrado();
}
