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

export function obterPosicaoAtual(timeoutMs = 15_000): Promise<GeolocationResult> {
  return new Promise((resolve, reject) => {
    if (!geolocalizacaoDisponivel()) {
      reject(new Error('Geolocalização não disponível neste dispositivo'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao_metros: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: timeoutMs },
    );
  });
}
