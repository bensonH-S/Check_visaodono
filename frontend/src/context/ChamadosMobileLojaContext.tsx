import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { getUsuario, ehGestorLojaMobile, deveEscolherLojaNovoChamadoMobile } from '../lib/auth';

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
    const usuario = getUsuario();
    if (!usuario || deveEscolherLojaNovoChamadoMobile(usuario)) return;
    if (!ehGestorLojaMobile(usuario)) return;
    const lojas = usuario.lojas ?? [];
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
  const ctx = useChamadosMobileLojaOpcional();
  if (!ctx) {
    throw new Error('useChamadosMobileLoja deve ser usado dentro de ChamadosMobileLojaProvider');
  }
  return ctx;
}

export function useChamadosMobileLojaOpcional() {
  return useContext(ChamadosMobileLojaContext);
}
