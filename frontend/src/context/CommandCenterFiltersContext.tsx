import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { dataHojeBrasilia } from '../utils/dateBr';

export type CommandCenterFilters = {
  data: string;
  setData: (data: string) => void;
  regiaoId: number | null;
  regiaoNome: string;
  setRegiao: (id: number | null, nome: string) => void;
};

const CommandCenterFiltersContext = createContext<CommandCenterFilters | null>(null);

export function CommandCenterFiltersProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(() => dataHojeBrasilia());
  const [regiaoId, setRegiaoId] = useState<number | null>(null);
  const [regiaoNome, setRegiaoNome] = useState('Todas as regiões');

  const value = useMemo<CommandCenterFilters>(
    () => ({
      data,
      setData,
      regiaoId,
      regiaoNome,
      setRegiao: (id, nome) => {
        setRegiaoId(id);
        setRegiaoNome(nome);
      },
    }),
    [data, regiaoId, regiaoNome],
  );

  return (
    <CommandCenterFiltersContext.Provider value={value}>{children}</CommandCenterFiltersContext.Provider>
  );
}

export function useCommandCenterFilters(): CommandCenterFilters {
  const ctx = useContext(CommandCenterFiltersContext);
  if (!ctx) {
    throw new Error('useCommandCenterFilters deve ser usado dentro de CommandCenterFiltersProvider');
  }
  return ctx;
}

/** Versão segura para páginas fora do provider (não quebra). */
export function useCommandCenterFiltersOptional(): CommandCenterFilters | null {
  return useContext(CommandCenterFiltersContext);
}
