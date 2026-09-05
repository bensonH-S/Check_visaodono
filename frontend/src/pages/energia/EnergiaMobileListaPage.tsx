import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import PageLoading from '../../components/PageLoading';
import { api, type EnergiaChamado, type Loja } from '../../api/client';
import { getUsuario, lojaEstoqueTravadaMobile, podeAbrirEnergia } from '../../lib/auth';
import { EnergiaLojaHead, EnergiaMobileChrome, EnergiaMobileStage } from './EnergiaMobileShell';
import {
  idLojaInicialStorage,
  preferenciaLojaInicial,
  persistirLoja,
  travarScrollPagina,
} from './energiaMobileLoja';
import { rotuloStatusEnergia, rotuloTipoOcorrencia } from './energiaConstants';

type Filtro = 'todas' | 'abertos' | 'finalizados';

function classeStatus(status: string) {
  if (status === 'finalizado') return 'is-ok';
  if (status === 'em_andamento') return 'is-andamento';
  if (status === 'cancelado') return 'is-cancelado';
  return 'is-aberta';
}

function dataCurta(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function EnergiaMobileListaPage() {
  const navigate = useNavigate();
  const user = getUsuario();
  const lojaTravada = lojaEstoqueTravadaMobile(user);
  const podeAbrir = podeAbrirEnergia(user);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(idLojaInicialStorage);
  const [lista, setLista] = useState<EnergiaChamado[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [dlgLoja, setDlgLoja] = useState(false);

  const carregarLista = useCallback(async (lojaId: number) => {
    const res = await api.energiaChamados({ loja: lojaId });
    setLista(res.items);
    return res.items;
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await api.lojas({ ativas: true, operacionais: true });
        if (cancel) return;
        setLojas(rows);
        const preferida = preferenciaLojaInicial(rows);
        if (!preferida) return;
        if (!idLoja || !rows.some((l) => l.id_loja === idLoja)) {
          setIdLoja(preferida);
          persistirLoja(preferida);
        } else if (lojaTravada && preferida !== idLoja) {
          setIdLoja(preferida);
          persistirLoja(preferida);
        }
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Erro ao carregar lojas');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!idLoja) return;
    let cancel = false;
    setLoading(true);
    setErr('');
    carregarLista(idLoja)
      .catch((e) => {
        if (!cancel) setErr(e instanceof Error ? e.message : 'Erro ao carregar protocolos');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [idLoja, carregarLista]);

  useEffect(() => {
    if (!dlgLoja) {
      travarScrollPagina(false);
      return;
    }
    travarScrollPagina(true);
    return () => travarScrollPagina(false);
  }, [dlgLoja]);

  const filtrada = useMemo(() => {
    if (filtro === 'todas') return lista;
    if (filtro === 'abertos') {
      return lista.filter((c) => c.status === 'aberto' || c.status === 'em_andamento');
    }
    return lista.filter((c) => c.status === 'finalizado' || c.status === 'cancelado');
  }, [lista, filtro]);

  const kpiAberto = lista.filter((c) => c.status === 'aberto').length;
  const kpiAndamento = lista.filter((c) => c.status === 'em_andamento').length;
  const kpiFinalizado = lista.filter((c) => c.status === 'finalizado').length;
  const podeTrocarLoja = !lojaTravada && lojas.length > 1;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;

  return (
    <EnergiaMobileChrome>
      <EnergiaMobileStage
        title="Energia"
        sub="Protocolo da concessionária, fotos e status — evidência se queimar equipamento."
        kpis={
          <div className="ck-estoque__kpis ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
            <div className="ck-estoque__kpi ck-estoque__kpi--accent">
              <strong>{loading ? '—' : kpiAberto}</strong>
              <span>Abertos</span>
            </div>
            <div className="ck-estoque__kpi">
              <strong>{loading ? '—' : kpiAndamento}</strong>
              <span>Em andamento</span>
            </div>
            <div className="ck-estoque__kpi">
              <strong>{loading ? '—' : kpiFinalizado}</strong>
              <span>Finalizados</span>
            </div>
          </div>
        }
      />

      <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
        <div className="ck-estoque__sheet-head">
          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}

          <EnergiaLojaHead
            lojas={lojas}
            idLoja={idLoja}
            onChangeLoja={setIdLoja}
            podeTrocarLoja={podeTrocarLoja}
            lojaAtual={lojaAtual}
            dlgLoja={dlgLoja}
            setDlgLoja={setDlgLoja}
          />

          <div className="ck-visitas__seg" role="tablist">
            {(
              [
                ['todas', 'Todas'],
                ['abertos', 'Abertos'],
                ['finalizados', 'Finalizados'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filtro === value}
                className={`ck-visitas__seg-btn${filtro === value ? ' is-on' : ''}`}
                onClick={() => setFiltro(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {idLoja && podeAbrir ? (
            <button
              type="button"
              className="ck-estoque-nfe__atalho is-diario"
              style={{ marginBottom: '16px' }}
              onClick={() => navigate('/energia/mobile/novo')}
            >
              <span className="ck-estoque-nfe__atalho-main">
                <strong>Registrar protocolo</strong>
                <small>Ligação à concessionária com fotos</small>
              </span>
              <span aria-hidden>›</span>
            </button>
          ) : null}
        </div>

        <div className="ck-visitas__sheet-body">
          {loading && <PageLoading />}

          {!loading && !filtrada.length && (
            <div className="ck-estoque__empty">
              {lojaAtual
                ? filtro !== 'todas' && lista.length > 0
                  ? 'Nenhum protocolo neste filtro.'
                  : 'Nenhum protocolo nesta loja. Toque em registrar protocolo para começar.'
                : 'Selecione a loja para começar.'}
            </div>
          )}

          {filtrada.map((c) => {
            const aberto = c.status === 'aberto' || c.status === 'em_andamento';
            const quando = dataCurta(c.ocorrido_em);
            return (
              <div
                key={c.id_chamado}
                className={`ck-estoque__card ck-estoque__card--lista${aberto ? ' is-aberta' : ''}${
                  c.status === 'em_andamento' ? ' is-andamento' : ''
                }`}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/energia/mobile/${c.id_chamado}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/energia/mobile/${c.id_chamado}`);
                  }
                }}
              >
                <div className="ck-estoque__card-top">
                  <div className="ck-estoque__card-title">
                    <strong>Protocolo {c.protocolo}</strong>
                    <span className="ck-estoque__card-tipo">
                      {rotuloTipoOcorrencia(c.tipo_ocorrencia)}
                      {quando ? ` · ${quando}` : ''}
                    </span>
                  </div>
                  <span className={`ck-estoque__status ${classeStatus(c.status)}`}>
                    {rotuloStatusEnergia(c.status)}
                  </span>
                </div>

                <div className="ck-estoque__card-valor">
                  <strong>#{c.numero}</strong>
                  <span>{c.concessionaria}</span>
                </div>

                <div className="ck-estoque__card-foot">
                  <div className="ck-estoque__card-meta-left">
                    <span className="ck-estoque__card-who" title="Quem registrou">
                      <PersonOutlinedIcon sx={{ fontSize: 16, color: 'var(--ck-navy)' }} />
                      <strong>{c.nome_abriu || 'Não informado'}</strong>
                    </span>
                    {c.qtd_fotos > 0 ? (
                      <span className="ck-estoque__badge-ok">
                        {c.qtd_fotos} foto{c.qtd_fotos === 1 ? '' : 's'}
                      </span>
                    ) : (
                      <span className="ck-estoque__badge-pend">Sem fotos</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </EnergiaMobileChrome>
  );
}
