/**
 * Telemetria de auditoria: sessão ativa + cada troca de rota/aba.
 * Silencioso — falhas não afetam o uso do sistema.
 */
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { getToken } from '../lib/auth';
import {
  clearAuditoriaSessaoId,
  getAuditoriaSessaoId,
  setAuditoriaSessaoId,
} from '../lib/auditoriaSessao';
import { resolvePageTitle } from '../config/pageTitles';
import { normalizeAppRoute } from '../config/paths';

const PING_MS = 45_000;

async function garantirSessao(): Promise<number | null> {
  if (!getToken()) return null;
  const existente = getAuditoriaSessaoId();
  if (existente) return existente;
  try {
    const r = await api.auditoriaSessaoInicio({ origem: 'app' });
    if (r?.id_sessao) {
      setAuditoriaSessaoId(r.id_sessao);
      return r.id_sessao;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export default function AuditTracker() {
  const location = useLocation();
  const lastPath = useRef<string>('');
  const sessaoRef = useRef<number | null>(getAuditoriaSessaoId());

  // Inicia sessão + heartbeat
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    void (async () => {
      const id = await garantirSessao();
      if (cancelled || !id) return;
      sessaoRef.current = id;

      timer = window.setInterval(() => {
        const sid = sessaoRef.current || getAuditoriaSessaoId();
        if (!sid || !getToken()) return;
        void api.auditoriaSessaoPing(sid).catch(async (err) => {
          const msg = err instanceof Error ? err.message : '';
          if (/não encontrada|encerrada|404/i.test(msg)) {
            clearAuditoriaSessaoId();
            sessaoRef.current = null;
            const nova = await garantirSessao();
            if (nova) sessaoRef.current = nova;
          }
        });
      }, PING_MS);
    })();

    // No unload: só ping. Encerramento formal no logout (e órfãs >12h no backend).
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  // Cada navegação / troca de aba
  useEffect(() => {
    const rota = normalizeAppRoute(location.pathname + (location.search || ''));
    const pathOnly = normalizeAppRoute(location.pathname);
    if (!rota || rota === lastPath.current) return;
    lastPath.current = rota;

    let cancelled = false;
    void (async () => {
      const id = sessaoRef.current || (await garantirSessao());
      if (cancelled || !id) return;
      sessaoRef.current = id;
      const titulo = resolvePageTitle(pathOnly).title;
      try {
        const r = await api.auditoriaNavegacao({ id_sessao: id, rota, titulo });
        if (r?.id_sessao && r.id_sessao !== id) {
          setAuditoriaSessaoId(r.id_sessao);
          sessaoRef.current = r.id_sessao;
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  return null;
}
