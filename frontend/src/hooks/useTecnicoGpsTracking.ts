import { useCallback, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { getUsuario } from '../lib/auth';
import { obterPosicaoAtual, geolocalizacaoDisponivel } from '../utils/geolocation';

type GpsConfig = {
  gpsTecnicosEnabled?: boolean;
  gpsTecnicosIntervalMs?: number;
};

/**
 * Envia a posição do técnico periodicamente (padrão: 2 min).
 * Controlado por GPS_TECNICOS_ENABLED no servidor.
 */
export function useTecnicoGpsTracking(config?: GpsConfig) {
  const enviando = useRef(false);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const enviarPosicao = useCallback(async () => {
    if (enviando.current || !config?.gpsTecnicosEnabled) return;
    const user = getUsuario();
    if (!user || user.perfil !== 'tecnico') return;
    if (!geolocalizacaoDisponivel()) return;

    enviando.current = true;
    try {
      const pos = await obterPosicaoAtual();
      await api.frotaAtualizarPosicao({
        latitude: pos.latitude,
        longitude: pos.longitude,
        precisao_metros: pos.precisao_metros ?? undefined,
      });
    } catch {
      /* silencioso — não interrompe o técnico */
    } finally {
      enviando.current = false;
    }
  }, [config?.gpsTecnicosEnabled]);

  useEffect(() => {
    if (!config?.gpsTecnicosEnabled) return;
    const user = getUsuario();
    if (!user || user.perfil !== 'tecnico') return;

    void enviarPosicao();
    const ms = config.gpsTecnicosIntervalMs && config.gpsTecnicosIntervalMs >= 30_000
      ? config.gpsTecnicosIntervalMs
      : 120_000;

    intervaloRef.current = setInterval(() => {
      void enviarPosicao();
    }, ms);

    const onVisivel = () => {
      if (document.visibilityState === 'visible') void enviarPosicao();
    };
    document.addEventListener('visibilitychange', onVisivel);

    return () => {
      if (intervaloRef.current) clearInterval(intervaloRef.current);
      document.removeEventListener('visibilitychange', onVisivel);
    };
  }, [config?.gpsTecnicosEnabled, config?.gpsTecnicosIntervalMs, enviarPosicao]);

  return { enviarPosicao };
}
