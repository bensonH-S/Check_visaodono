import { apiBasePath, toAppPath } from '../config/paths';
import { api } from '../api/client';
import { getToken, getUsuario, temPermissao, type UsuarioSessao } from '../lib/auth';
import {
  coletarDiagnosticoServiceWorker,
  iniciarServiceWorkerPwa,
  limparFlagRecargaServiceWorker,
  obterRegistroServiceWorker,
  obterRegistroServiceWorkerRapido,
  pushDisponivelNoAmbiente,
  recarregarParaAtivarServiceWorker,
  registrarServiceWorkerNoClique,
  reiniciarServiceWorkerPwa,
} from '../pwa/registerServiceWorker';
import { showToast } from './toast';
import { APP_NAME } from '../config/brand';

async function removerPushNoServidor(endpoint: string, tokenSessao?: string | null): Promise<void> {
  const token = tokenSessao ?? (getUsuario() ? getToken() : null);
  if (!token) return;
  await fetch(`${apiBasePath}/push/subscribe`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
}

const PUSH_OK_KEY = 'vision-check:push-ok';
const PUSH_USER_KEY = 'vision-check:push-user';
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
    | 'ambiente_dev'
    | 'erro_desconhecido';
  mensagem: string;
};

let conclusaoSegundoPlano: Promise<ResultadoPushRegistro> | null = null;
let ativacaoEmAndamento: Promise<ResultadoPushRegistro> | null = null;
let pushRegistradoServidor = false;
let pushAtivoCompleto = false;
let pushSyncConcluido = false;
let syncEmAndamento: Promise<boolean> | null = null;
let prepararEmAndamento: Promise<void> | null = null;

export function pushRegistradoNoServidor(): boolean {
  return pushRegistradoServidor;
}

export function pushNotificacoesAtivas(): boolean {
  return pushAtivoCompleto;
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

function erroPushService(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /push service error|aborterror/i.test(msg);
}

async function logInscricaoFalhou(erro: unknown, publicKey?: string | null) {
  await logPushDiagnostico('inscricao_falhou', {
    erro: erro instanceof Error ? erro.message : String(erro),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    android: isAndroid(),
    vapidLen: publicKey?.length ?? null,
  });
}

function emitirPushAtualizado() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PUSH_ATUALIZADO_EVENT));
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizarChaveVapidPublica(key: string): string {
  return key.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const key = sanitizarChaveVapidPublica(base64String);
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

function validarChaveVapidPublica(publicKey: string): boolean {
  try {
    const bytes = urlBase64ToUint8Array(publicKey);
    return bytes.length === 65 && bytes[0] === 4;
  } catch {
    return false;
  }
}

export function isAndroid(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
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
    const uid = getUsuario()?.id_usuario;
    if (uid != null) localStorage.setItem(PUSH_USER_KEY, String(uid));
  } catch {
    /* ignore */
  }
  emitirPushAtualizado();
}

function limparPushRegistradoLocal() {
  try {
    localStorage.removeItem(PUSH_OK_KEY);
    localStorage.removeItem(PUSH_USER_KEY);
  } catch {
    /* ignore */
  }
  emitirPushAtualizado();
}

async function limparPushUsuarioDiferente(): Promise<boolean> {
  const usuario = getUsuario();
  if (!usuario) return false;
  const vinculo = localStorage.getItem(PUSH_USER_KEY);
  if (!vinculo || Number(vinculo) === usuario.id_usuario) return false;

  if (pushSuportado()) {
    const registration = await obterRegistroServiceWorkerRapido();
    const sub = registration?.pushManager
      ? await registration.pushManager.getSubscription().catch(() => null)
      : null;
    if (sub) await sub.unsubscribe().catch(() => {});
  }
  await removerPushNoServidor('');
  limparPushRegistradoLocal();
  pushRegistradoServidor = false;
  pushAtivoCompleto = false;
  return true;
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
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (iosStandalone) return true;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
  return false;
}

export function ehRotaMobileChamados(): boolean {
  if (typeof window === 'undefined') return false;
  const appPath = toAppPath(window.location.pathname);
  return appPath === '/chamados/mobile' || appPath.startsWith('/chamados/mobile/');
}

/** Técnicos no portal (/chamados) ou loja no fluxo mobile — rotas onde push é oferecido. */
export function usuarioAdministraChamados(usuario?: UsuarioSessao | null): boolean {
  const u = usuario ?? getUsuario();
  return temPermissao('chamados.ver', u) || temPermissao('chamados.assumir', u);
}

export function ehRotaComPush(): boolean {
  if (ehRotaMobileChamados()) return true;
  if (typeof window === 'undefined') return false;
  const appPath = toAppPath(window.location.pathname);
  if (
    appPath === '/chamados' ||
    (appPath.startsWith('/chamados/') &&
      !appPath.startsWith('/chamados/aprovacoes') &&
      appPath !== '/chamados/novo')
  ) {
    return usuarioAdministraChamados();
  }
  return false;
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
    const res = await fetch(`${apiBasePath}/public/push/vapid-key?_=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { publicKey?: string };
    const key = data.publicKey ? sanitizarChaveVapidPublica(data.publicKey) : '';
    return key && validarChaveVapidPublica(key) ? key : null;
  } catch {
    return null;
  }
}

async function sincronizarEstadoPushInterno(): Promise<boolean> {
  pushSyncConcluido = true;

  if (!pushSuportado() || requerHttpsParaPush()) {
    pushRegistradoServidor = false;
    pushAtivoCompleto = false;
    limparPushRegistradoLocal();
    return false;
  }

  if (await limparPushUsuarioDiferente()) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    pushRegistradoServidor = false;
    pushAtivoCompleto = false;
    limparPushRegistradoLocal();
    return false;
  }

  const registration = await obterRegistroServiceWorkerRapido();
  const localSub = registration?.pushManager
    ? await registration.pushManager.getSubscription().catch(() => null)
    : null;

  if (!localSub) {
    try {
      const status = await api.pushStatus();
      if (status.registered) {
        await api.pushReset().catch(() => {});
      }
    } catch {
      /* ignore */
    }
    pushRegistradoServidor = false;
    pushAtivoCompleto = false;
    limparPushRegistradoLocal();
    return false;
  }

  try {
    const status = await api.pushStatus();
    pushRegistradoServidor = Boolean(status.registered);
    if (!status.registered) {
      pushAtivoCompleto = false;
      limparPushRegistradoLocal();
      return false;
    }
    pushAtivoCompleto = true;
    marcarPushRegistrado();
    return true;
  } catch {
    pushRegistradoServidor = false;
    pushAtivoCompleto = false;
    limparPushRegistradoLocal();
    return false;
  }
}

/** Alinha estado local com o servidor (inscrição real no banco). */
export async function sincronizarEstadoPush(): Promise<boolean> {
  if (syncEmAndamento) return syncEmAndamento;
  syncEmAndamento = sincronizarEstadoPushInterno().finally(() => {
    syncEmAndamento = null;
  });
  return syncEmAndamento;
}

function ambienteLocal(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || import.meta.env.DEV;
}

function mensagemServiceWorkerIndisponivel(): string {
  if (ambienteLocal()) {
    return `Notificações em segundo plano não funcionam no ambiente local. Acesse https://grupoalvim.com.br/auditoria/login/mobile no celular (HTTPS). O sino continua mostrando alertas dentro do app.`;
  }
  if (isIos() && !appInstalada()) {
    return `No iPhone, instale o ${APP_NAME} na Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra pelo ícone antes de ativar notificações.`;
  }
  if (isIos() && appInstalada()) {
    return `Feche o ${APP_NAME} completamente (deslize para cima no multitarefa) e abra de novo pelo ícone na Tela de Início. Depois toque em Ativar notificações.`;
  }
  return 'Não foi possível preparar notificações. Recarregue a página e tente novamente.';
}

function validarPreRequisitos(): ResultadoPushRegistro | null {
  if (!pushDisponivelNoAmbiente() || ambienteLocal()) {
    return {
      ok: false,
      codigo: 'ambiente_dev',
      mensagem: mensagemServiceWorkerIndisponivel(),
    };
  }

  if (isIos() && !appInstalada() && !ehRotaComPush()) {
    return {
      ok: false,
      codigo: 'ios_nao_instalado',
      mensagem:
        `No iPhone, instale o app primeiro: Compartilhar → Adicionar à Tela de Início. Depois abra pelo ícone ${APP_NAME}.`,
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

  if (/push service error|aborterror/i.test(msg)) {
    return {
      ok: false,
      codigo: 'inscricao_falhou',
      mensagem: isAndroid()
        ? 'O Chrome não conseguiu registrar no Google (FCM). No celular: Chrome → ⋮ → Configurações → Configurações do site → grupoalvim.com.br → Limpar e redefinir. Abra o Meridian pelo ícone, toque em Ativar notificações uma vez e aguarde. Reinicie o celular se precisar.'
        : 'Falha no serviço de push do navegador. Limpe os dados do site e tente ativar novamente.',
    };
  }

  if (/chave vapid inválida/i.test(msg)) {
    return {
      ok: false,
      codigo: 'vapid_indisponivel',
      mensagem: 'Chave VAPID inválida no servidor. Avise o suporte para rodar npm run validate:vapid no .env.',
    };
  }

  return {
    ok: false,
    codigo: msg.toLowerCase().includes('subscribe') ? 'inscricao_falhou' : 'servidor_falhou',
    mensagem: msg && msg.length < 120 ? msg : 'Não foi possível concluir a inscrição push.',
  };
}

async function tentarReutilizarInscricaoLocal(
  registration: ServiceWorkerRegistration,
): Promise<ResultadoPushRegistro | null> {
  const existente = await registration.pushManager.getSubscription().catch(() => null);
  if (!existente) return null;
  try {
    await api.pushSubscribe(existente.toJSON());
    await sincronizarEstadoPush();
    if (!pushNotificacoesAtivas()) return null;
    limparFlagRecargaServiceWorker();
    return {
      ok: true,
      codigo: 'ok',
      mensagem: 'Notificações ativadas com sucesso!',
    };
  } catch {
    return null;
  }
}

async function subscribePushManager(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  const key = sanitizarChaveVapidPublica(publicKey);
  const applicationServerKey = urlBase64ToUint8Array(key);
  const opts: PushSubscriptionOptionsInit = {
    userVisibleOnly: true,
    applicationServerKey,
  };
  const tentativas = isAndroid() ? 4 : 2;
  let ultimoErro: unknown;

  for (let i = 0; i < tentativas; i += 1) {
    try {
      if (i > 0) await aguardar(900 * i);
      return await registration.pushManager.subscribe(opts);
    } catch (e) {
      ultimoErro = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/push service error|aborterror/i.test(msg) || i >= tentativas - 1) throw e;
    }
  }

  throw ultimoErro;
}

async function inscreverNoPushComRecuperacaoAndroid(
  registration: ServiceWorkerRegistration,
  publicKey: string,
  permitirReinicioSw: boolean,
): Promise<ResultadoPushRegistro> {
  try {
    return await inscreverNoPush(registration, publicKey);
  } catch (e) {
    if (!permitirReinicioSw || !isAndroid() || !erroPushService(e)) throw e;

    await logPushDiagnostico('inscricao_reiniciando_sw_android');
    const novoReg = await reiniciarServiceWorkerPwa();
    if (!novoReg?.pushManager) throw e;

    const pronto = await obterRegistroServiceWorker(20000);
    if (!pronto?.pushManager) throw e;

    await aguardar(1200);
    return inscreverNoPush(pronto, publicKey);
  }
}

async function inscreverNoPush(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<ResultadoPushRegistro> {
  const key = sanitizarChaveVapidPublica(publicKey);
  if (!validarChaveVapidPublica(key)) {
    throw new Error('Chave VAPID inválida no servidor');
  }

  const reutilizado = await tentarReutilizarInscricaoLocal(registration);
  if (reutilizado) return reutilizado;

  const existente = await registration.pushManager.getSubscription().catch(() => null);
  if (existente) {
    await existente.unsubscribe().catch(() => {});
    await aguardar(isAndroid() ? 1200 : 300);
  }

  const subscription = await subscribePushManager(registration, key);

  await api.pushSubscribe(subscription.toJSON());
  await sincronizarEstadoPush();

  if (!pushNotificacoesAtivas()) {
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
      mensagem: mensagemServiceWorkerIndisponivel(),
    };
  }

  try {
    return await inscreverNoPushComRecuperacaoAndroid(registration, publicKey, true);
  } catch (e) {
    limparPushRegistradoLocal();
    await logInscricaoFalhou(e, publicKey);
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

/** Prepara service worker e alinha estado — não pede permissão automaticamente. */
export async function prepararNotificacoesPush(): Promise<void> {
  if (typeof window === 'undefined' || !ehRotaComPush()) return;
  if (prepararEmAndamento) return prepararEmAndamento;

  prepararEmAndamento = (async () => {
    iniciarServiceWorkerPwa();
    await sincronizarEstadoPush();
    emitirPushAtualizado();
  })().finally(() => {
    prepararEmAndamento = null;
  });

  return prepararEmAndamento;
}

/** Clique em "Ativar notificações" — pede permissão, limpa vínculo antigo e registra. */
export async function ativarNotificacoesNoClique(): Promise<ResultadoPushRegistro> {
  if (ativacaoEmAndamento) return ativacaoEmAndamento;
  ativacaoEmAndamento = ativarNotificacoesNoCliqueInterno().finally(() => {
    ativacaoEmAndamento = null;
  });
  return ativacaoEmAndamento;
}

async function ativarNotificacoesNoCliqueInterno(): Promise<ResultadoPushRegistro> {
  const pre = validarPreRequisitos();
  if (pre) return pre;

  const ativo = await sincronizarEstadoPush();
  if (ativo && pushNotificacoesAtivas()) {
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
        ? `Notificações bloqueadas. Ajustes → ${APP_NAME} → Notificações → Permitir.`
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
      mensagem: 'Permissão não concedida. Toque em Permitir quando o celular solicitar.',
    };
  }

  await registrarServiceWorkerNoClique();

  const registration = await obterRegistroServiceWorker(isAndroid() ? 25000 : 20000);
  if (!registration?.pushManager) {
    return registrarPushCompleto(true);
  }

  const subLocal = await registration.pushManager.getSubscription().catch(() => null);
  const status = await api.pushStatus().catch(() => ({ registered: false, subscriptionCount: 0 }));

  if (status.registered || status.subscriptionCount > 0 || subLocal) {
    if (status.registered || status.subscriptionCount > 0) {
      await api.pushReset().catch(() => {});
    }
    if (subLocal) {
      await subLocal.unsubscribe().catch(() => {});
      await aguardar(isAndroid() ? 1200 : 300);
    }
  }

  limparPushRegistradoLocal();
  pushRegistradoServidor = false;
  pushAtivoCompleto = false;

  try {
    return await inscreverNoPushComRecuperacaoAndroid(registration, publicKey, true);
  } catch (e) {
    limparPushRegistradoLocal();
    await logInscricaoFalhou(e, publicKey);
    return mapearErroInscricao(e);
  }
}

export async function registrarPushNotificacoes(forcar = false): Promise<ResultadoPushRegistro> {
  if (forcar && Notification.permission !== 'granted') {
    return ativarNotificacoesNoClique();
  }
  return registrarPushCompleto(forcar);
}

export async function cancelarPushNotificacoes(tokenSessao?: string | null): Promise<void> {
  if (pushSuportado() && !import.meta.env.DEV) {
    const registration = await obterRegistroServiceWorkerRapido();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe().catch(() => {});
      }
    }
  }
  await removerPushNoServidor('', tokenSessao);
  limparPushRegistradoLocal();
  pushRegistradoServidor = false;
  pushAtivoCompleto = false;
  pushSyncConcluido = true;
  emitirPushAtualizado();
}

/** Remove inscrição no servidor e no celular para ativar de novo. */
export async function resetarPushCompleto(): Promise<number> {
  await logPushDiagnostico('reset_push_iniciado');
  if (pushSuportado()) {
    const registration = await obterRegistroServiceWorkerRapido();
    if (registration) {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe().catch(() => {});
      }
    }
  }
  let removidas = 0;
  try {
    const res = await api.pushReset();
    removidas = res.removidas ?? 0;
  } catch {
    await removerPushNoServidor('');
  }
  limparPushRegistradoLocal();
  pushRegistradoServidor = false;
  pushAtivoCompleto = false;
  pushSyncConcluido = true;
  await logPushDiagnostico('reset_push_concluido', { removidas });
  emitirPushAtualizado();
  return removidas;
}

/** Exibir botão de ativação no header — só enquanto push não estiver ativo. */
export function deveExibirAtivacaoPush(): boolean {
  if (!pushDisponivelNoAmbiente() || ambienteLocal()) return false;
  if (!ehRotaComPush()) return false;
  if (pushNotificacoesAtivas()) return false;
  if (precisaInstalarIos()) return true;
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return true;
  return true;
}

export function notificacoesPrecisamAtivacao(): boolean {
  if (precisaInstalarIos()) return true;
  if (requerHttpsParaPush() && isIos()) return true;
  return deveExibirAtivacaoPush();
}
