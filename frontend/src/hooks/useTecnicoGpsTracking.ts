import { useCallback, useEffect, useRef } from 'react';
import { deveRastrearGpsTecnico, getUsuario } from '../lib/auth';
import {
  GPS_ATUALIZADO_EVENT,
  geolocalizacaoDisponivel,
  monitorarPosicao,
  registrarSyncGpsRetry,
  solicitarWakeLock,
} from '../utils/geolocation';
import { enfileirarPosicaoGps, enviarPosicaoGps, flushGpsOutbox } from '../utils/gpsOutbox';

type GpsConfig = {
  gpsTecnicosEnabled?: boolean;
  gpsTecnicosIntervalMs?: number;
};

/**
 * Rastreamento contínuo do técnico (watchPosition + wake lock).
 * Com app minimizado continua enquanto o processo estiver vivo no Android.
 * Com app totalmente fechado, reenvia pendências ao reabrir (outbox + Background Sync).
 */
export function useTecnicoGpsTracking(config?: GpsConfig) {
  const enviando = useRef(false);
  const ultimoEnvio = useRef(0);
  const liberarWake = useRef<(() => void) | null>(null);

  const intervaloMs =
    config?.gpsTecnicosIntervalMs && config.gpsTecnicosIntervalMs >= 30_000
      ? config.gpsTecnicosIntervalMs
      : 120_000;

  const enviarPosicao = useCallback(
    async (pos: { latitude: number; longitude: number; precisao_metros: number | null }) => {
      if (enviando.current || !config?.gpsTecnicosEnabled) return;
      const user = getUsuario();
      if (!deveRastrearGpsTecnico(user)) return;

      const agora = Date.now();
      if (agora - ultimoEnvio.current < intervaloMs - 5_000) return;

      enviando.current = true;
      try {
        const ok = await enviarPosicaoGps(pos);
        if (!ok) {
          await enfileirarPosicaoGps(pos);
          await registrarSyncGpsRetry();
        } else {
          ultimoEnvio.current = agora;
        }
        window.dispatchEvent(new Event(GPS_ATUALIZADO_EVENT));
      } catch {
        await enfileirarPosicaoGps(pos).catch(() => {});
        window.dispatchEvent(new Event(GPS_ATUALIZADO_EVENT));
      } finally {
        enviando.current = false;
      }
    },
    [config?.gpsTecnicosEnabled, intervaloMs],
  );

  useEffect(() => {
    if (!config?.gpsTecnicosEnabled) return;
    if (!deveRastrearGpsTecnico(getUsuario())) return;
    if (!geolocalizacaoDisponivel()) return;

    void flushGpsOutbox();

    void solicitarWakeLock().then((release) => {
      liberarWake.current = release;
    });

    const pararWatch = monitorarPosicao(
      (pos) => {
        void enviarPosicao(pos);
      },
      () => {
        window.dispatchEvent(new Event(GPS_ATUALIZADO_EVENT));
      },
    );

    const onVisivel = () => {
      if (document.visibilityState === 'visible') {
        void flushGpsOutbox();
      }
    };
    const onPageHide = () => {
      void flushGpsOutbox();
    };

    document.addEventListener('visibilitychange', onVisivel);
    window.addEventListener('pagehide', onPageHide);

    const onSwMessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'GPS_FLUSH_OUTBOX') void flushGpsOutbox();
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    return () => {
      pararWatch();
      document.removeEventListener('visibilitychange', onVisivel);
      window.removeEventListener('pagehide', onPageHide);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      liberarWake.current?.();
      liberarWake.current = null;
    };
  }, [config?.gpsTecnicosEnabled, enviarPosicao]);

  return { enviarPosicao };
}
