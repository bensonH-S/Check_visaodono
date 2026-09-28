import { useEffect, useState, type CSSProperties } from 'react';
import EstoqueMobileListaPage from '../../pages/estoque/EstoqueMobileListaPage';
import InicioMobilePage from '../../pages/InicioMobilePage';

export type HubAba = 'inicio' | 'estoque';

export function hubAbaDePath(path: string): HubAba | null {
  if (path === '/inicio/mobile') return 'inicio';
  if (path === '/estoque/mobile' || path === '/estoque/mobile/nfes') return 'estoque';
  return null;
}

const pane: CSSProperties = {
  flex: 1,
  minHeight: 0,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#0b1721',
};

export default function HubKeepAlive({ aba }: { aba: HubAba | null }) {
  const [vivo, setVivo] = useState<Record<HubAba, boolean>>({
    inicio: false,
    estoque: false,
  });

  useEffect(() => {
    if (!aba) return;
    setVivo((atual) => (atual[aba] ? atual : { ...atual, [aba]: true }));
  }, [aba]);

  if (!aba) return null;
  if (!vivo.inicio && !vivo.estoque) return null;

  return (
    <div style={{ ...pane, display: 'flex' }}>
      {vivo.inicio ? (
        <div
          style={{
            ...pane,
            display: aba === 'inicio' ? 'flex' : 'none',
            pointerEvents: aba === 'inicio' ? 'auto' : 'none',
          }}
        >
          <InicioMobilePage />
        </div>
      ) : null}
      {vivo.estoque ? (
        <div
          style={{
            ...pane,
            display: aba === 'estoque' ? 'flex' : 'none',
            pointerEvents: aba === 'estoque' ? 'auto' : 'none',
          }}
        >
          <EstoqueMobileListaPage />
        </div>
      ) : null}
    </div>
  );
}
