import { useEffect, useState } from 'react';
import { api, type AppPublicConfig } from '../api/client';

const DEFAULT_CONFIG: AppPublicConfig = {
  version: 'dev',
  environment: 'Development',
  support: {
    name: 'Benson Henrique',
    phone: '+55 61 9109-4654',
    email: 'benson.henrique@grupoalvim.com.br',
  },
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppPublicConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    api
      .publicConfig()
      .then(setConfig)
      .catch(() => setConfig(DEFAULT_CONFIG));
  }, []);

  return config;
}
