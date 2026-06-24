export type GeolocationResult = {
  latitude: number;
  longitude: number;
  precisao_metros: number | null;
};

export function geolocalizacaoDisponivel() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
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
