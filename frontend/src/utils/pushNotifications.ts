import { apiBasePath } from '../config/paths';
import { api } from '../api/client';
import {
  coletarDiagnosticoServiceWorker,
  iniciarServiceWorkerPwa,
  limparFlagRecargaServiceWorker,
  obterRegistroServiceWorker,
  obterRegistroServiceWorkerRapido,
  recarregarParaAtivarServiceWorker,
  registrarServiceWorkerNoClique,
} from '../pwa/registerServiceWorker';
import { showToast } from './toast';

const PUSH_OK_KEY = 'vision-check:push-ok';
const PUSH_AUTO_PEDIDO_KEY = 'vision-check:push-auto-pedido';
export const PUSH_ATUALIZADO_EVENT = 'vision-check:push-atualizado';

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

let conclusaoSegundoPlano: Promise<ResultadoPushRegistro> | null = null;
let pushRegistradoServidor = false;
let pushSyncConcluido = false;

export function pushRegistradoNoServidor(): boolean {
  return pushRegistradoServidor;
}

export function pushSyncFinalizado(): boolean {
  return pushSyncConcluido;
}

async function logPushDiagnostico(mensagem: string, extra?: Record<string, unknown>) {
  const diag = await coletarDiagnosticoServiceWorker(mensagem);
  try {
    await api.pushDiagnostico(mensagem, { ...diag, ...extra });
  } catch {
    /* ignore */
  }
}

function emitirPushAtualizado() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PUSH_ATUALIZADO_EVENT));
}

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
  emitirPushAtualizado();
}

function limparPushRegistradoLocal() {
  try {
    localStorage.removeItem(PUSH_OK_KEY);
  } catch {
    /* ignore */
  }
  emitirPushAtualizado();
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
  const fullscreenMedia = window.matchMedia('(display-mode: fullscreen)').matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standaloneMedia || fullscreenMedia || iosStandalone;
}

export function precisaInstalarIos(): boolean {
  return isIos() && !appInstalada();
}

export function requerHttpsParaPush(): boolean {
  if (typeof window === 'undefined') return false;
  return !window.isSecureContext;
}

/** Permissão OK mas inscrição push ainda não concluiu no servidor. */
export function pushPendenteConclusao(): boolean {
  return (
    pushSuportado() &&
    !requerHttpsParaPush() &&
    Notification.permission === 'granted' &&
    !pushJaRegistrado()
  );
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

/** Alinha estado local com o servidor (inscrição real no banco). */
export async function sincronizarEstadoPush(): Promise<boolean> {
  try {
    const status = await api.pushStatus();
    pushSyncConcluido = true;
    pushRegistradoServidor = Boolean(status.registered);
    if (status.registered) {
      marcarPushRegistrado();
      return true;
    }
    limparPushRegistradoLocal();
    return false;
  } catch {
    pushSyncConcluido = true;
    pushRegistradoServidor = false;
    limparPushRegistradoLocal();
    return false;
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
        'Notificações no celular exigem HTTPS. Use https://grupoalvim.com.br/auditoria/login/mobile',
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

function mapearErroInscricao(e: unknown): ResultadoPushRegistro {
  const msg = e instanceof Error ? e.message : String(e);

  if (msg.includes('Sessão expirada') || msg.includes('401')) {
    return {
      ok: false,
      codigo: 'servidor_falhou',
      mensagem: 'Sessão expirada. Faça login novamente.',
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
    mensagem: msg && msg.length < 120 ? msg : 'Não foi possível concluir a inscrição push.',
  };
}

async function inscreverNoPush(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<ResultadoPushRegistro> {
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api.pushSubscribe(subscription.toJSON());
  await sincronizarEstadoPush();

  if (!pushJaRegistrado()) {
    throw new Error('Inscrição não confirmada no servidor');
  }

  limparFlagRecargaServiceWorker();

  return {
    ok: true,
    codigo: 'ok',
    mensagem: 'Notificações ativadas com sucesso!',
  };
}

async function registrarPushCompleto(forcar = false): Promise<ResultadoPushRegistro> {
  const pre = validarPreRequisitos();
  if (pre) return pre;

  if (!forcar) {
    const sincronizado = await sincronizarEstadoPush();
    if (sincronizado) {
      return {
        ok: true,
        codigo: 'ja_registrado',
        mensagem: 'Notificações já estavam ativas.',
      };
    }
  }

  if (Notification.permission !== 'granted') {
    return {
      ok: false,
      codigo: 'permissao_negada',
      mensagem: 'Permissão de notificação não concedida.',
    };
  }

  await registrarServiceWorkerNoClique();

  const publicKey = await obterVapidPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      codigo: 'vapid_indisponivel',
      mensagem: 'Servidor de notificações não configurado. Avise o suporte (VAPID).',
    };
  }

  const registration = await obterRegistroServiceWorker(20000);
  if (!registration?.pushManager) {
    await logPushDiagnostico('service_worker_indisponivel_ao_concluir');
    if (isIos() && appInstalada() && Notification.permission === 'granted') {
      const recarregou = await recarregarParaAtivarServiceWorker();
      if (recarregou) {
        return {
          ok: false,
          codigo: 'service_worker_indisponivel',
          mensagem: 'Preparando o app… A tela vai recarregar. Toque em Ativar notificações novamente.',
        };
      }
    }
    return {
      ok: false,
      codigo: 'service_worker_indisponivel',
      mensagem:
        'Não foi possível preparar o app. Feche completamente (deslize para cima) e abra de novo pelo ícone Vision Check.',
    };
  }

  try {
    return await inscreverNoPush(registration, publicKey);
  } catch (e) {
    limparPushRegistradoLocal();
    await logPushDiagnostico('inscricao_falhou', { erro: e instanceof Error ? e.message : String(e) });
    return mapearErroInscricao(e);
  }
}

/** Conclui inscrição push em segundo plano. */
export function concluirPushEmSegundoPlano(forcar = true): Promise<ResultadoPushRegistro> {
  if (conclusaoSegundoPlano) return conclusaoSegundoPlano;

  conclusaoSegundoPlano = registrarPushCompleto(forcar).finally(() => {
    conclusaoSegundoPlano = null;
  });

  return conclusaoSegundoPlano.then((r) => {
    if (!r.ok && r.codigo !== 'ja_registrado' && !r.mensagem.includes('vai recarregar')) {
      showToast(r.mensagem, 'warning');
    }
    emitirPushAtualizado();
    return r;
  });
}

/** Prepara push ao abrir o app — no PWA instalado solicita permissão ao iOS/Android como antes. */
export async function prepararNotificacoesPush(): Promise<void> {
  if (typeof window === 'undefined') return;
  iniciarServiceWorkerPwa();
  if (!pushSuportado() || requerHttpsParaPush()) return;

  await sincronizarEstadoPush();
  if (pushRegistradoNoServidor()) return;

  if (isIos() && !appInstalada()) return;

  if (Notification.permission === 'default' && appInstalada()) {
    try {
      const jaPediu = sessionStorage.getItem(PUSH_AUTO_PEDIDO_KEY) === '1';
      if (!jaPediu) {
        sessionStorage.setItem(PUSH_AUTO_PEDIDO_KEY, '1');
        await ativarNotificacoesNoClique();
        return;
      }
    } catch {
      /* ignore */
    }
    return;
  }

  if (Notification.permission !== 'granted') return;

  void concluirPushEmSegundoPlano(true);
}

/** Clique em "Ativar/Concluir notificações". */
export async function ativarNotificacoesNoClique(): Promise<ResultadoPushRegistro> {
  const pre = validarPreRequisitos();
  if (pre) return pre;

  const sincronizado = await sincronizarEstadoPush();
  if (sincronizado) {
    return {
      ok: true,
      codigo: 'ja_registrado',
      mensagem: 'Notificações já estavam ativas!',
    };
  }

  const publicKey = await obterVapidPublicKey();
  if (!publicKey) {
    return {
      ok: false,
      codigo: 'vapid_indisponivel',
      mensagem: 'Servidor de notificações não configurado. Avise o suporte (VAPID).',
    };
  }

  let permission = Notification.permission;

  if (permission === 'denied') {
    return {
      ok: false,
      codigo: 'permissao_bloqueada',
      mensagem: isIos()
        ? 'Notificações bloqueadas. Ajustes → Vision Check → Notificações → Permitir.'
        : 'Notificações bloqueadas. Ative nas configurações do app.',
    };
  }

  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    return {
      ok: false,
      codigo: 'permissao_negada',
      mensagem: 'Permissão não concedida. Toque em Permitir quando o iOS solicitar.',
    };
  }

  await registrarServiceWorkerNoClique();

  const registration = await obterRegistroServiceWorkerRapido();
  if (registration?.pushManager) {
    try {
      return await inscreverNoPush(registration, publicKey);
    } catch (e) {
      const rapido = mapearErroInscricao(e);
      if (rapido.codigo !== 'service_worker_indisponivel') {
        /* continua tentativa completa */
      }
    }
  }

  return concluirPushEmSegundoPlano(true);
}

export async function registrarPushNotificacoes(forcar = false): Promise<ResultadoPushRegistro> {
  if (forcar && Notification.permission !== 'granted') {
    return ativarNotificacoesNoClique();
  }
  return registrarPushCompleto(forcar);
}

export async function cancelarPushNotificacoes(): Promise<void> {
  if (!pushSuportado()) return;
  const registration = await obterRegistroServiceWorkerRapido();
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe().catch(() => {});
    await api.pushUnsubscribe(endpoint).catch(() => {});
  }
  limparPushRegistradoLocal();
}

/** Exibir botão/banner de ativação push (fonte: servidor após sync). */
export function deveExibirAtivacaoPush(): boolean {
  if (requerHttpsParaPush()) return true;
  if (precisaInstalarIos()) return false;
  if (!pushSuportado()) return isIos() && appInstalada();
  if (Notification.permission === 'denied') return true;
  if (!pushSyncConcluido) return !pushJaRegistrado();
  return !pushRegistradoServidor;
}

export function notificacoesPrecisamAtivacao(): boolean {
  if (precisaInstalarIos()) return true;
  if (requerHttpsParaPush() && isIos()) return true;
  return deveExibirAtivacaoPush();
}
