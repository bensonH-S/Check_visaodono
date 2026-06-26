export type GeolocationResult = {
  latitude: number;
  longitude: number;
  precisao_metros: number | null;
};

export type PermissaoGps = 'granted' | 'denied' | 'prompt' | 'desconhecido';

export const GPS_ATUALIZADO_EVENT = 'vision-check:gps-atualizado';

export function geolocalizacaoDisponivel() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

export async function consultarPermissaoGps(): Promise<PermissaoGps> {
  if (!geolocalizacaoDisponivel()) return 'desconhecido';
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state as PermissaoGps;
  } catch {
    return 'desconhecido';
  }
}

export function mensagemErroGps(err: unknown): string {
  const code = (err as GeolocationPositionError | undefined)?.code;
  if (code === 1) {
    return 'Permissão de localização negada. Ative o GPS nas configurações do navegador ou do celular.';
  }
  if (code === 2) return 'Não foi possível obter a localização. Verifique se o GPS do celular está ligado.';
  if (code === 3) return 'Tempo esgotado ao obter a localização. Tente novamente.';
  return 'Não foi possível obter a localização.';
}

function posicaoParaResultado(pos: GeolocationPosition): GeolocationResult {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    precisao_metros: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
  };
}

export function obterPosicaoAtual(timeoutMs = 15_000): Promise<GeolocationResult> {
  return new Promise((resolve, reject) => {
    if (!geolocalizacaoDisponivel()) {
      reject(new Error('Geolocalização não disponível neste dispositivo'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(posicaoParaResultado(pos)),
      (err) => reject(err),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: timeoutMs },
    );
  });
}

/** Monitora GPS continuamente (melhor em segundo plano com app minimizado). */
export function monitorarPosicao(
  onPosicao: (pos: GeolocationResult) => void,
  onErro?: (err: GeolocationPositionError) => void,
): () => void {
  if (!geolocalizacaoDisponivel()) return () => {};

  const watchId = navigator.geolocation.watchPosition(
    (pos) => onPosicao(posicaoParaResultado(pos)),
    (err) => onErro?.(err),
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

export async function solicitarWakeLock(): Promise<(() => void) | null> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (!nav.wakeLock) return null;
    const lock = await nav.wakeLock.request('screen');
    return () => {
      void lock.release();
    };
  } catch {
    return null;
  }
}

export async function registrarSyncGpsRetry(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } })
      ?.sync;
    if (sync) await sync.register('gps-posicao-retry');
  } catch {
    /* Background Sync indisponível */
  }
}
