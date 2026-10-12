import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { api, leituraPedida, lojaCaixaSalva, mesCaixaAtual, urlCaixa, urlDespesas, urlEmpresas, urlNotas } from './api';
import { PrefsProvider } from './prefs';

function aquecer(url: string, pedir: () => Promise<unknown>) {
  if (!leituraPedida(url)) pedir().catch(() => undefined);
}

/** Páginas Azimut no shell Meridian — só idioma/prefs locais, sem Shell próprio. */
export default function FinanceiroOutlet() {
  useEffect(() => {
    const t = window.setTimeout(() => {
      aquecer(urlEmpresas(), () => api.empresas());
      aquecer(urlDespesas(), () => api.despesas());
      aquecer(urlNotas(), () => api.notasReceita());
      const loja = lojaCaixaSalva();
      if (loja) {
        const mes = mesCaixaAtual();
        aquecer(urlCaixa(mes, loja), () => api.caixaMes(mes, loja));
      }
    }, 800);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <PrefsProvider>
      <Outlet />
    </PrefsProvider>
  );
}
