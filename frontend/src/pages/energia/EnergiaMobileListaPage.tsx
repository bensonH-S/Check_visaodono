import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import BoltIcon from '@mui/icons-material/Bolt';
import { api, type EnergiaChamado } from '../../api/client';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { formatDataHoraBalaoMapa } from '../../utils/dateBr';
import { rotuloStatusEnergia, rotuloTipoOcorrencia } from './energiaConstants';
import '../../components/visitas/visitas-mobile.css';
import '../../components/nc/nc-mobile.css';

type Aba = 'abertos' | 'finalizados';

export default function EnergiaMobileListaPage() {
  const navigate = useNavigate();
  const [aba, setAba] = useState<Aba>('abertos');
  const [itens, setItens] = useState<EnergiaChamado[]>([]);
  const [stats, setStats] = useState({ total_aberto: 0, total_finalizado: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    api
      .energiaChamados()
      .then((res) => {
        setStats(res.stats);
        setItens(
          aba === 'abertos'
            ? res.items.filter((i) => i.status === 'aberto' || i.status === 'em_andamento')
            : res.items.filter((i) => i.status === 'finalizado' || i.status === 'cancelado'),
        );
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [aba]);

  return (
    <div className="ck-visitas ck-nc ck-visitas--lista">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />
        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title">
                Energia
                <br />e protocolos
              </h1>
            </div>
            <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
          </div>
          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            Registre o protocolo da ligação (Neoenergia ou outra concessionária) com fotos.
          </p>
          <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3">
            <div className="ck-visitas__metric">
              <strong>{loading ? '—' : stats.total_aberto}</strong>
              <span>em aberto</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{loading ? '—' : stats.total_finalizado}</strong>
              <span>finalizados</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
        {err && (
          <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>{err}</p>
        )}
        <div className="ck-visitas__seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'abertos'}
            className={`ck-visitas__seg-btn${aba === 'abertos' ? ' is-on' : ''}`}
            onClick={() => setAba('abertos')}
          >
            Em aberto
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'finalizados'}
            className={`ck-visitas__seg-btn${aba === 'finalizados' ? ' is-on' : ''}`}
            onClick={() => setAba('finalizados')}
          >
            Finalizados
          </button>
        </div>

        <div className="ck-visitas__sheet-body">
          {loading ? (
            <LinearProgress />
          ) : !itens.length ? (
            <div className="ck-nc__empty">
              {aba === 'abertos'
                ? 'Nenhum protocolo em aberto. Toque em + para registrar a ligação.'
                : 'Nenhum chamado finalizado ainda.'}
            </div>
          ) : (
            itens.map((c) => (
              <button
                key={c.id_chamado}
                type="button"
                className="ck-nc__item"
                onClick={() => navigate(`/energia/mobile/${c.id_chamado}`)}
                style={{ borderRadius: 14, marginBottom: 8, border: '1px solid rgba(27,42,107,0.1)' }}
              >
                <span className="ck-nc__item-icon" aria-hidden>
                  <BoltIcon fontSize="small" sx={{ color: '#E8520A' }} />
                </span>
                <span className="ck-nc__item-copy">
                  <small>
                    #{c.numero} · {c.nome_loja}
                  </small>
                  <span>Protocolo {c.protocolo}</span>
                  <small>
                    {rotuloTipoOcorrencia(c.tipo_ocorrencia)} · {formatDataHoraBalaoMapa(c.ocorrido_em)} ·{' '}
                    {c.qtd_fotos} foto{c.qtd_fotos === 1 ? '' : 's'}
                  </small>
                </span>
                <span className="ck-nc__chip">{rotuloStatusEnergia(c.status)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
