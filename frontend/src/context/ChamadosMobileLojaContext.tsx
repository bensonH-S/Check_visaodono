import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getUsuario } from '../lib/auth';

const STORAGE_KEY = 'chamados_mobile_loja_id';

type ChamadosMobileLojaContextValue = {
  idLoja: number | null;
  setIdLoja: (id: number) => void;
};

const ChamadosMobileLojaContext = createContext<ChamadosMobileLojaContextValue | null>(null);

export function ChamadosMobileLojaProvider({ children }: { children: ReactNode }) {
  const [idLoja, setIdLojaState] = useState<number | null>(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  });

  const setIdLoja = useCallback((id: number) => {
    setIdLojaState(id);
    sessionStorage.setItem(STORAGE_KEY, String(id));
  }, []);

  useEffect(() => {
    const lojas = getUsuario()?.lojas ?? [];
    if (!lojas.length) return;
    const valido = idLoja != null && lojas.some((l) => l.id_loja === idLoja);
    if (!valido) setIdLoja(lojas[0].id_loja);
  }, [idLoja, setIdLoja]);

  return (
    <ChamadosMobileLojaContext.Provider value={{ idLoja, setIdLoja }}>
      {children}
    </ChamadosMobileLojaContext.Provider>
  );
}

export function useChamadosMobileLoja() {
  const ctx = useContext(ChamadosMobileLojaContext);
  if (!ctx) {
    throw new Error('useChamadosMobileLoja deve ser usado dentro de ChamadosMobileLojaProvider');
  }
  return ctx;
}
