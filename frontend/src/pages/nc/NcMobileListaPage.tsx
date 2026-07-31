import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { api, fmtData, fmtNota, scoreColor } from '../../api/client';
import type { NcItem } from '../../api/client';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { agruparNcsPorVisita, parseNcDescricao } from '../../components/nc/ncPageUtils';
import '../../components/visitas/visitas-mobile.css';
import '../../components/nc/nc-mobile.css';

type Aba = 'abertas' | 'resolvidas';

function gravTone(g: string): 'crit' | 'mod' | 'ok' {
  if (g === 'Crítica') return 'crit';
  if (g === 'Moderada') return 'mod';
  return 'ok';
}

export default function NcMobileListaPage() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>('abertas');
  const [itens, setItens] = useState<NcItem[]>([]);
  const [stats, setStats] = useState({ total_aberto: '0', criticas: '0', visitas_pendentes: '0' });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

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

  return (
    <div className="ck-visitas ck-nc">
      <div className="ck-visitas__scroll">
        <div className="ck-visitas__stage">
          <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
          <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
          <div className="ck-visitas__mesh" aria-hidden />

          <div className="ck-visitas__stage-inner">
            <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
              <div>
                <p className="ck-visitas__mark-text">Grupo Alvim</p>
                <h1 className="ck-visitas__title">
                  Não
                  <br />
                  conformidades
                </h1>
              </div>
              <CkMarkLogoMenu size={56} className="ck-visitas__mark-icon" />
            </div>

            <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
              Pendências do checklist na sua região — abra para registrar a correção.
            </p>

            <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
              <div className="ck-visitas__metric">
                <strong>{loading ? '—' : stats.visitas_pendentes}</strong>
                <span>visitas</span>
              </div>
              <div className="ck-visitas__metric">
                <strong>{loading ? '—' : stats.total_aberto}</strong>
                <span>em aberto</span>
              </div>
              <div className="ck-visitas__metric ck-visitas__metric--accent">
                <strong>{loading ? '—' : stats.criticas}</strong>
                <span>críticas</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}

          <div className="ck-visitas__seg" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'abertas'}
              className={`ck-visitas__seg-btn${aba === 'abertas' ? ' is-on' : ''}`}
              onClick={() => setAba('abertas')}
            >
              Em aberto
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={aba === 'resolvidas'}
              className={`ck-visitas__seg-btn${aba === 'resolvidas' ? ' is-on' : ''}`}
              onClick={() => setAba('resolvidas')}
            >
              Resolvidas
            </button>
          </div>

          {loading ? (
            <LinearProgress />
          ) : visitas.length === 0 ? (
            <div className="ck-nc__empty">
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

              return (
                <div key={visita.id_visita} className="ck-nc__visita">
                  <div className="ck-nc__visita-head">
                    <strong>{visita.loja}</strong>
                    <div className="ck-nc__chips">
                      <span className="ck-nc__chip">{fmtData(visita.data_visita)}</span>
                      {nota != null && (
                        <span
                          className="ck-nc__chip"
                          style={{ color: scoreColor(nota), borderColor: `${scoreColor(nota)}55` }}
                        >
                          Nota {fmtNota(nota)}
                        </span>
                      )}
                      {visita.criticas > 0 && aba === 'abertas' && (
                        <span className="ck-nc__chip ck-nc__chip--crit">
                          {visita.criticas} crítica(s)
                        </span>
                      )}
                    </div>
                  </div>

                  {lista.map((nc) => {
                    const { codigo, texto } = parseNcDescricao(nc.descricao);
                    const tone = gravTone(nc.gravidade);
                    const clicavel = aba === 'abertas';
                    return (
                      <button
                        key={nc.id_nc}
                        type="button"
                        className="ck-nc__item"
                        disabled={!clicavel}
                        onClick={() => clicavel && navigate(`/nc/mobile/${nc.id_nc}`)}
                      >
                        <span className="ck-nc__item-icon" aria-hidden>
                          <WarningAmberIcon
                            fontSize="small"
                            sx={{ color: tone === 'crit' ? '#d32f2f' : '#ed6c02' }}
                          />
                        </span>
                        <span className="ck-nc__item-copy">
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
                          <span className="ck-nc__item-go" aria-hidden>
                            ›
                          </span>
                        ) : (
                          <span className="ck-nc__chip" style={{ borderColor: 'rgba(46,125,50,0.35)', color: '#2e7d32' }}>
                            Resolvida
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
