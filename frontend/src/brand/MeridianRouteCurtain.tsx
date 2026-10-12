import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { assetUrl, LOGO_MERIDIAN_MARK_M } from '../config/paths';
import './meridian-route-curtain.css';

const MARK = `${assetUrl(LOGO_MERIDIAN_MARK_M)}?v=oficial3`;
/** Tempo mínimo entre aparições — evita “pisca” a cada clique. */
const COOLDOWN_MS = 14_000;
const SHOW_MS = 360;

/**
 * Área “de produto” (módulo). Trocas dentro da mesma área
 * (Inbox → Agenda, subpáginas de estoque) não disparam a marca.
 */
function areaDeRota(pathname: string): string {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  if (p === '/' || p === '/dashboard') return 'command-center';
  if (p.startsWith('/financeiro')) return 'financeiro';
  if (p.startsWith('/estoque')) return 'estoque';
  if (p.startsWith('/frota')) return 'frota';
  if (p.startsWith('/configuracoes') || p.startsWith('/usuarios')) return 'config';
  if (p.startsWith('/escalas')) return 'escalas';
  if (p.startsWith('/chamados') || p.startsWith('/manutencao')) return 'chamados';
  if (p.startsWith('/checklist')) return 'checklist';
  if (p.startsWith('/energia')) return 'energia';
  if (p.startsWith('/metas')) return 'metas';
  if (p.startsWith('/visitas') || p.startsWith('/nao-conformidades')) return 'campo';
  if (p.startsWith('/ranking')) return 'indicadores';
  const seg = p.split('/').filter(Boolean)[0];
  return seg || 'app';
}

/**
 * Marca Meridian só em salto de módulo, com cooldown —
 * presença de marca, não loading de toda página.
 *
 * Timers ficam em refs: redirect interno (ex.: /configuracoes → Empresas)
 * remonta o efeito e, se limpar o timeout no cleanup, a marca fica presa.
 */
export default function MeridianRouteCurtain() {
  const { pathname } = useLocation();
  const areaAnterior = useRef<string | null>(null);
  const ultimaVez = useRef(0);
  const seq = useRef(0);
  const timers = useRef<{ hide: number | null; off: number | null }>({ hide: null, off: null });
  const [ativo, setAtivo] = useState(false);
  const [saida, setSaida] = useState(false);

  useEffect(() => {
    return () => {
      if (timers.current.hide != null) window.clearTimeout(timers.current.hide);
      if (timers.current.off != null) window.clearTimeout(timers.current.off);
      timers.current.hide = null;
      timers.current.off = null;
    };
  }, []);

  useEffect(() => {
    const area = areaDeRota(pathname);
    if (areaAnterior.current == null) {
      areaAnterior.current = area;
      return;
    }
    if (area === areaAnterior.current) return;
    areaAnterior.current = area;

    const agora = Date.now();
    if (agora - ultimaVez.current < COOLDOWN_MS) return;
    ultimaVez.current = agora;

    if (timers.current.hide != null) window.clearTimeout(timers.current.hide);
    if (timers.current.off != null) window.clearTimeout(timers.current.off);

    const id = ++seq.current;
    setSaida(false);
    setAtivo(true);
    timers.current.hide = window.setTimeout(() => {
      if (seq.current !== id) return;
      setSaida(true);
    }, SHOW_MS);
    timers.current.off = window.setTimeout(() => {
      if (seq.current !== id) return;
      setAtivo(false);
      setSaida(false);
      timers.current.hide = null;
      timers.current.off = null;
    }, SHOW_MS + 240);
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
