import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export type ChecklistMobileFaseUi = 'setup' | 'iniciada' | 'perguntas' | null;

type Ctx = {
  fase: ChecklistMobileFaseUi;
  setFase: (fase: ChecklistMobileFaseUi) => void;
  registrarVoltar: (handler: (() => void) | null) => void;
  dispararVoltar: () => boolean;
};

const ChecklistMobileUiContext = createContext<Ctx>({
  fase: null,
  setFase: () => undefined,
  registrarVoltar: () => undefined,
  dispararVoltar: () => false,
});

export function ChecklistMobileUiProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<ChecklistMobileFaseUi>(null);
  const voltarRef = useRef<(() => void) | null>(null);

  const registrarVoltar = useCallback((handler: (() => void) | null) => {
    voltarRef.current = handler;
  }, []);

  const dispararVoltar = useCallback(() => {
    if (!voltarRef.current) return false;
    voltarRef.current();
    return true;
  }, []);

  const value = useMemo(
    () => ({ fase, setFase, registrarVoltar, dispararVoltar }),
    [fase, registrarVoltar, dispararVoltar],
  );

  return (
    <ChecklistMobileUiContext.Provider value={value}>{children}</ChecklistMobileUiContext.Provider>
  );
}

export function useChecklistMobileUi() {
  return useContext(ChecklistMobileUiContext);
}
