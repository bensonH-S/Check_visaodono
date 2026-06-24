import { useEffect, useState } from 'react';
import { api, type AppPublicConfig } from '../api/client';
import { buildVersion } from '../config/buildVersion';

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
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppPublicConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    api
      .publicConfig()
      .then((cfg) =>
        setConfig({
          ...cfg,
          version: cfg.version !== 'dev' ? cfg.version : BUNDLED_VERSION,
        })
      )
      .catch(() => setConfig(DEFAULT_CONFIG));
  }, []);

  return config;
}
