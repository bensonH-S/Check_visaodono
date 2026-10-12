import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { assetUrl, LOGO_MERIDIAN_MARK_M } from '../config/paths';
import './meridian-route-curtain.css';

const MARK = `${assetUrl(LOGO_MERIDIAN_MARK_M)}?v=oficial3`;
const SHOW_MS = 480;

/**
 * Cortina curta com o símbolo M ao trocar de rota no portal.
 * Não bloqueia clique depois do fade; some sozinha.
 */
export default function MeridianRouteCurtain() {
  const { pathname } = useLocation();
  const primeiro = useRef(true);
  const [ativo, setAtivo] = useState(false);
  const [saida, setSaida] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (primeiro.current) {
      primeiro.current = false;
      return;
    }
    const id = ++seq.current;
    setSaida(false);
    setAtivo(true);
    const tHide = window.setTimeout(() => {
      if (seq.current !== id) return;
      setSaida(true);
    }, SHOW_MS);
    const tOff = window.setTimeout(() => {
      if (seq.current !== id) return;
      setAtivo(false);
      setSaida(false);
    }, SHOW_MS + 280);
    return () => {
      window.clearTimeout(tHide);
      window.clearTimeout(tOff);
    };
  }, [pathname]);

  if (!ativo) return null;

  return (
    <div
      className={`meridian-route-curtain${saida ? ' meridian-route-curtain--out' : ''}`}
      aria-hidden
    >
      <div className="meridian-route-curtain__glow" />
      <img className="meridian-route-curtain__mark" src={MARK} alt="" draggable={false} />
    </div>
  );
}
