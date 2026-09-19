import { useEffect, useState } from 'react';
import { api, type AppPublicConfig } from '../api/client';
import { buildVersion } from '../config/buildVersion';
import {
  gravarModulosCanalCache,
  lerModulosCanalCache,
  MODULOS_CANAL_EVENT,
  MODULOS_CANAL_PADRAO,
  normalizarModulosCanal,
} from '../config/modulosCanal';

const BUNDLED_VERSION = buildVersion();

const DEFAULT_CONFIG: AppPublicConfig = {
  version: BUNDLED_VERSION,
  environment: 'Development',
  support: {
    name: 'Benson Henrique',
    phone: '+55 61 9109-4654',
    email: 'benson.henrique@grupoalvim.com.br',
  },
  gpsTecnicosEnabled: true,
  gpsTecnicosIntervalMs: 120_000,
  hasIntegrations: true,
  integrations: [],
  modulos: MODULOS_CANAL_PADRAO,
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppPublicConfig>(() => ({
    ...DEFAULT_CONFIG,
    modulos: lerModulosCanalCache(),
  }));

  useEffect(() => {
    api
      .publicConfig()
      .then((cfg) => {
        const modulos = gravarModulosCanalCache(cfg.modulos);
        setConfig({
          ...cfg,
          version: cfg.version !== 'dev' ? cfg.version : BUNDLED_VERSION,
          modulos,
        });
      })
      .catch(() => setConfig({ ...DEFAULT_CONFIG, modulos: lerModulosCanalCache() }));
  }, []);

  useEffect(() => {
    function onUpdate(ev: Event) {
      const detail = (ev as CustomEvent).detail;
      setConfig((prev) => ({ ...prev, modulos: normalizarModulosCanal(detail || lerModulosCanalCache()) }));
    }
    window.addEventListener(MODULOS_CANAL_EVENT, onUpdate);
    return () => window.removeEventListener(MODULOS_CANAL_EVENT, onUpdate);
  }, []);

  return config;
}
