import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { api, fmtData, fmtNota, scoreColorTema } from '../../api/client';
import type { NcItem } from '../../api/client';
import { agruparNcsPorVisita, parseNcDescricao } from '../../components/nc/ncPageUtils';
import { getUsuario, logout } from '../../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP } from '../../config/paths';
import MobileUsuarioMenu from '../../components/MobileUsuarioMenu';
import NotificacoesSino from '../../components/NotificacoesSino';
import AppHubDock from '../../components/hub/AppHubDock';
import '../../components/estoque/estoque-hub.css';
import '../../components/nc/nc-mobile.css';

type Aba = 'abertas' | 'resolvidas';

function gravTone(g: string): 'crit' | 'mod' | 'ok' {
  if (g === 'Crítica') return 'crit';
  if (g === 'Moderada') return 'mod';
  return 'ok';
}

export default function NcMobileListaPage() {
  const navigate = useNavigate();
  const user = getUsuario();
  const [aba, setAba] = useState<Aba>('abertas');
  const [itens, setItens] = useState<NcItem[]>([]);
  const [stats, setStats] = useState({ total_aberto: '0', criticas: '0', visitas_pendentes: '0' });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [abertasIds, setAbertasIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    setLoading(true);
    api
      .naoConformidades(aba === 'abertas' ? { status: 'Em aberto' } : undefined)
      .then((res) => {
        const lista =
          aba === 'resolvidas'
            ? res.items.filter((i) => i.status === 'Resolvida')
            : res.items;
        setItens(lista);
        setStats({
          total_aberto: res.stats.total_aberto,
          criticas: res.stats.criticas,
          visitas_pendentes: res.stats.visitas_pendentes ?? '0',
        });
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [aba]);

  const visitas = useMemo(() => agruparNcsPorVisita(itens), [itens]);

  useEffect(() => {
    setAbertasIds(new Set());
  }, [aba]);

  function alternarVisita(idVisita: number) {
    setAbertasIds((atual) => {
      const next = new Set(atual);
      if (next.has(idVisita)) next.delete(idVisita);
      else next.add(idVisita);
      return next;
    });
  }

  return (
    <div
      className="ck-estoque-hub ck-estoque-hub--hero ck-nc-hub"
      style={{ ['--ck-hero' as string]: `url(${assetUrl(LOGO_ALVIM_ICONE)})` }}
    >
      <div className="ck-estoque-hub__watermark" aria-hidden />
      <header className="ck-estoque-hub__top ck-estoque-hub__top--fixed">
        <div className="ck-estoque-hub__brand-row">
          <img
            className="ck-estoque-hub__mark ck-estoque-hub__mark--hero"
            src={assetUrl(LOGO_GA_LOCKUP)}
            alt="Grupo Alvim"
          />
          <div className="ck-estoque-hub__actions">
            <NotificacoesSino variante="mobile" contexto="chamados-mobile" />
            <MobileUsuarioMenu
              user={user}
              onLogout={() => {
                logout();
                navigate('/login/mobile');
              }}
            />
          </div>
        </div>

        <div className="ck-estoque-hub__hero-copy">
          <div className="ck-estoque-hub__store-row ck-estoque-hub__store-row--hero">
            <h1>NCs</h1>
          </div>
          <p className="ck-nc-hub__sub">
            Pendências do checklist na sua região. Toque para registrar a correção.
          </p>
        </div>

        <nav className="ck-estoque-hub__tabs" aria-label="Status das NCs">
          <button
            type="button"
            className={`ck-estoque-hub__tab${aba === 'abertas' ? ' is-on' : ''}`}
            onClick={() => setAba('abertas')}
          >
            Em aberto
          </button>
          <button
            type="button"
            className={`ck-estoque-hub__tab${aba === 'resolvidas' ? ' is-on' : ''}`}
            onClick={() => setAba('resolvidas')}
          >
            Resolvidas
          </button>
        </nav>
      </header>

      <div className="ck-estoque-hub__panel">
        <div className="ck-nc-hub__kpis" aria-live="polite">
          <div className="ck-nc-hub__kpi">
            <strong>{loading ? '—' : stats.visitas_pendentes}</strong>
            <span>Visitas</span>
          </div>
          <div className="ck-nc-hub__kpi is-on">
            <strong>{loading ? '—' : stats.total_aberto}</strong>
            <span>Em aberto</span>
          </div>
          <div className="ck-nc-hub__kpi is-crit">
            <strong>{loading ? '—' : stats.criticas}</strong>
            <span>Críticas</span>
          </div>
        </div>
      </div>

      <div className="ck-estoque-hub__scroll ck-nc-hub__scroll">
        {err ? <p className="ck-nc-hub__err">{err}</p> : null}

        {loading ? (
          <LinearProgress
            sx={{
              my: 1.5,
              borderRadius: 1,
              backgroundColor: 'rgba(255,154,92,0.18)',
              '& .MuiLinearProgress-bar': { backgroundColor: '#ff9a5c' },
            }}
          />
        ) : visitas.length === 0 ? (
          <div className="ck-nc-hub__empty">
            {aba === 'abertas'
              ? 'Nenhuma pendência de checklist na sua região.'
              : 'Nenhuma NC resolvida ainda.'}
          </div>
        ) : (
          visitas.map((visita) => {
            const nota = visita.nota_final;
            const pendentes = visita.itens.filter((i) => i.status === 'Em aberto');
            const lista =
              aba === 'abertas' ? pendentes : visita.itens.filter((i) => i.status === 'Resolvida');
            if (!lista.length) return null;
            const expandida = abertasIds.has(visita.id_visita);
            const notaBaixa = nota != null && nota < 75;

            return (
              <div
                key={visita.id_visita}
                className={`ck-nc-hub__visita${expandida ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="ck-nc-hub__visita-head"
                  aria-expanded={expandida}
                  onClick={() => alternarVisita(visita.id_visita)}
                >
                  <span className="ck-nc-hub__visita-main">
                    <strong>{visita.loja}</strong>
                    <span className="ck-nc-hub__meta-chips">
                      <span className="ck-nc-hub__chip">{fmtData(visita.data_visita)}</span>
                      {nota != null && (
                        <span
                          className={`ck-nc-hub__chip ck-nc-hub__nota${notaBaixa ? ' is-baixa' : ''}`}
                          style={
                            notaBaixa
                              ? undefined
                              : {
                                  color: scoreColorTema(nota, true),
                                  borderColor: `${scoreColorTema(nota, true)}66`,
                                }
                          }
                        >
                          Nota {fmtNota(nota)}
                        </span>
                      )}
                      {visita.criticas > 0 && aba === 'abertas' && (
                        <span className="ck-nc-hub__chip is-crit">
                          {visita.criticas} crítica(s)
                        </span>
                      )}
                    </span>
                  </span>
                  <ExpandMoreIcon
                    className={`ck-nc-hub__chev${expandida ? ' is-open' : ''}`}
                    aria-hidden
                  />
                </button>

                {expandida ? (
                  <div className="ck-nc-hub__visita-items">
                    {lista.map((nc) => {
                      const { codigo, texto } = parseNcDescricao(nc.descricao);
                      const tone = gravTone(nc.gravidade);
                      const clicavel = aba === 'abertas';
                      return (
                        <button
                          key={nc.id_nc}
                          type="button"
                          className="ck-nc-hub__item"
                          disabled={!clicavel}
                          onClick={() => clicavel && navigate(`/nc/mobile/${nc.id_nc}`)}
                        >
                          <span className="ck-nc-hub__item-icon" aria-hidden>
                            <WarningAmberIcon
                              fontSize="small"
                              sx={{ color: tone === 'crit' ? '#ff6b6b' : '#fe6c22' }}
                            />
                          </span>
                          <span className="ck-nc-hub__item-copy">
                            {nc.area === 'Resultado geral' ? (
                              <span>{nc.descricao}</span>
                            ) : (
                              <>
                                <small>
                                  {nc.area}
                                  {codigo ? ` · ${codigo}` : ''}
                                </small>
                                <span>{texto}</span>
                              </>
                            )}
                            {nc.area === 'Resultado geral' && (
                              <small style={{ marginTop: 4 }}>{nc.gravidade}</small>
                            )}
                          </span>
                          {aba === 'abertas' ? (
                            <span className="ck-nc-hub__item-go" aria-hidden>
                              ›
                            </span>
                          ) : (
                            <span className="ck-nc-hub__chip is-ok">Resolvida</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <AppHubDock
        ativo={null}
        plusLabel="Sem ação nesta tela"
        plusDisabled
        onPlus={() => {}}
      />
    </div>
  );
}
