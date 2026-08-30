import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Fab from '@mui/material/Fab';
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import {
  api,
  type EstoqueContagemResumo,
  type Loja,
} from '../../api/client';
import { getUsuario, lojaEstoqueTravadaMobile, podeReabrirContagemEstoque } from '../../lib/auth';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { safeAreaRightCalc } from '../../theme/safeArea';
import { showToast } from '../../utils/toast';
import {
  ehContagemParcial,
  rotuloTipoContagem,
  type TipoContagemEstoque,
} from '../../components/estoque/estoqueContagemTipo';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';

function hojeIsoSp() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function labelIniciar(tipo: TipoContagemEstoque) {
  if (tipo === 'diaria') return 'Contagem diária';
  if (tipo === 'critica_semanal') return 'Contagem semanal (segunda)';
  return 'Contagem completa';
}

const LOJA_STORAGE_KEY = 'estoque.id_loja';

function fmtBrl(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function nomeLoja(l: Loja) {
  return String(l.name || '').trim() || 'Loja';
}

function rotuloLoja(l: Loja) {
  const nome = nomeLoja(l);
  return l.bk_number ? `${l.bk_number} · ${nome}` : nome;
}

function preferenciaLojaInicial(rows: Loja[]): number | null {
  if (!rows.length) return null;
  const user = getUsuario();
  const lojasUser = user?.lojas ?? [];
  if (lojaEstoqueTravadaMobile(user) && lojasUser.length) {
    const match = rows.find((l) => lojasUser.some((u) => u.id_loja === l.id_loja));
    if (match) return match.id_loja;
  }
  if (lojasUser.length === 1) {
    const match = rows.find((l) => l.id_loja === lojasUser[0].id_loja);
    if (match) return match.id_loja;
  }
  const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
  if (Number.isFinite(saved) && saved > 0 && rows.some((l) => l.id_loja === saved)) {
    return saved;
  }
  return rows[0].id_loja;
}

function travarScrollPagina(ativo: boolean) {
  const scrollEl = document.querySelector('.ck-visitas__scroll') as HTMLElement | null;
  if (!ativo) {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    if (scrollEl) scrollEl.style.overflow = '';
    return;
  }
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  if (scrollEl) scrollEl.style.overflow = 'hidden';
}

export default function EstoqueMobileListaPage() {
  const navigate = useNavigate();
  const user = getUsuario();
  const podeReabrir = podeReabrirContagemEstoque(user);
  const lojaTravada = lojaEstoqueTravadaMobile(user);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(() => {
    const u = getUsuario();
    if (lojaEstoqueTravadaMobile(u) && u?.lojas?.[0]?.id_loja) return u.lojas[0].id_loja;
    if (u?.lojas?.length === 1) return u.lojas[0].id_loja;
    const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
    return Number.isFinite(saved) && saved > 0 ? saved : '';
  });
  const [lista, setLista] = useState<EstoqueContagemResumo[]>([]);
  const [filtro, setFiltro] = useState<'todas' | 'aberta' | 'finalizada'>('todas');
  const [loading, setLoading] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const [reabrindoId, setReabrindoId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [dlgLoja, setDlgLoja] = useState(false);
  const [dlgTipo, setDlgTipo] = useState(false);
  const [reabrirAlvo, setReabrirAlvo] = useState<EstoqueContagemResumo | null>(null);

  const carregarLista = useCallback(async (lojaId: number) => {
    const rows = await api.estoqueContagens(lojaId);
    setLista(rows);
    return rows;
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const rows = await api.estoqueLojas({ ativas: true, operacionais: true });
        if (cancel) return;
        setLojas(rows);
        const preferida = preferenciaLojaInicial(rows);
        if (!preferida) return;
        if (!idLoja || !rows.some((l) => l.id_loja === idLoja)) {
          setIdLoja(preferida);
          localStorage.setItem(LOJA_STORAGE_KEY, String(preferida));
        } else if (lojaTravada && preferida !== idLoja) {
          setIdLoja(preferida);
          localStorage.setItem(LOJA_STORAGE_KEY, String(preferida));
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
        if (!cancel) setErr(e instanceof Error ? e.message : 'Erro ao carregar conferências');
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [idLoja, carregarLista]);

  const filtrada = useMemo(() => {
    if (filtro === 'todas') return lista;
    return lista.filter((c) => c.status === filtro);
  }, [lista, filtro]);
  const valorInicialMes = lista[0]?.valor_inicial_mes ?? null;
  const dataInicialMes = lista[0]?.data_inicial_mes ?? null;
  const valorAtualLoja = useMemo(() => {
    if (lista[0]?.valor_atual_loja != null) return lista[0].valor_atual_loja;
    const abertaCompleta = lista.find(
      (c) => c.status === 'aberta' && !ehContagemParcial(c.tipo),
    );
    if (abertaCompleta?.total_valor != null) return abertaCompleta.total_valor;
    const ultimaCompleta = lista.find(
      (c) => c.status === 'finalizada' && !ehContagemParcial(c.tipo),
    );
    return ultimaCompleta?.total_valor ?? null;
  }, [lista]);
  const diariaHoje = useMemo(() => {
    const hoje = hojeIsoSp();
    return lista.find((c) => c.tipo === 'diaria' && String(c.data_contagem || '').slice(0, 10) === hoje) || null;
  }, [lista]);
  const faltaDiariaHoje = Boolean(idLoja && (!diariaHoje || diariaHoje.status !== 'finalizada'));
  const valorBreakMes = lista[0]?.valor_break_mes ?? null;
  const valorDesperdicioMes = lista[0]?.valor_desperdicio_mes ?? null;
  const valorComprasMes = lista[0]?.valor_compras_mes ?? null;
  const cmvMes = lista[0]?.cmv_teorico_pct ?? null;
  const podeTrocarLoja = !lojaTravada && lojas.length > 1;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;


  useEffect(() => {
    if (!dlgLoja && !reabrirAlvo && !dlgTipo) {
      travarScrollPagina(false);
      return;
    }
    travarScrollPagina(true);
    return () => travarScrollPagina(false);
  }, [dlgLoja, reabrirAlvo, dlgTipo]);

  const iniciar = async (tipo: TipoContagemEstoque) => {
    if (!idLoja) return;
    if (tipo === 'diaria' && diariaHoje?.id_contagem) {
      setDlgTipo(false);
      navigate(`/estoque/mobile/${diariaHoje.id_contagem}`);
      if (diariaHoje.status === 'finalizada') {
        showToast('Diária de hoje já foi feita — consulta');
      }
      return;
    }
    setIniciando(true);
    setDlgTipo(false);
    try {
      const det = await api.estoqueIniciarSabado({ id_loja: idLoja, tipo });
      if (det.id_contagem) {
        navigate(`/estoque/mobile/${det.id_contagem}`, {
          state: { contagemPreload: det },
        });
      }
      if (det.meta?.ja_finalizada) {
        showToast('Diária de hoje já foi finalizada — consulta');
      } else {
        const label = labelIniciar(tipo);
        showToast(det.meta?.iniciada_agora ? `${label} iniciada` : `${label} aberta`);
      }
      await carregarLista(idLoja);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao iniciar', 'error');
    } finally {
      setIniciando(false);
    }
  };

  const confirmarReabrir = async () => {
    if (!reabrirAlvo) return;
    setReabrindoId(reabrirAlvo.id_contagem);
    try {
      const det = await api.estoqueReabrirContagem(reabrirAlvo.id_contagem);
      setReabrirAlvo(null);
      showToast('Conferência reaberta para edição', 'success');
      navigate(`/estoque/mobile/${det.id_contagem}`, {
        state: { contagemPreload: det },
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível reabrir', 'error');
    } finally {
      setReabrindoId(null);
    }
  };

  return (
    <div className="ck-visitas ck-visitas--lista ck-estoque">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />
        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title">
                Conferência
              </h1>
              <p className="ck-visitas__sub">
                Controle e auditoria de contagens físicas e apuração de CMV.
              </p>
            </div>
            <CkMarkLogoMenu size={78} className="ck-visitas__mark-icon" />
          </div>
            <div className="ck-estoque__kpis ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
              <div className="ck-estoque__kpi">
                <strong>{loading ? '—' : fmtBrl(valorInicialMes ?? 0)}</strong>
                <span>
                  Início
                  {dataInicialMes
                    ? ` ${new Date(dataInicialMes + 'T12:00:00').toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })}`
                    : ''}
                </span>
              </div>
              <div className="ck-estoque__kpi ck-estoque__kpi--accent">
                <strong>{loading ? '—' : fmtBrl(valorAtualLoja ?? 0)}</strong>
                <span>Valor atual</span>
              </div>
              <div className="ck-estoque__kpi">
                <strong>{loading ? '—' : fmtPct(cmvMes ?? 0)}</strong>
                <span>CMV do mês</span>
              </div>
              <div className="ck-estoque__kpi">
                <strong>{loading ? '—' : fmtBrl(valorBreakMes ?? 0)}</strong>
                <span>Break do mês</span>
              </div>
              <div className="ck-estoque__kpi">
                <strong>{loading ? '—' : fmtBrl(valorDesperdicioMes ?? 0)}</strong>
                <span>Desperdício</span>
              </div>
              <div className="ck-estoque__kpi">
                <strong>{loading ? '—' : fmtBrl(valorComprasMes ?? 0)}</strong>
                <span>Compras do mês</span>
              </div>
            </div>
        </div>
      </div>

      <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
        <div className="ck-estoque__sheet-head">
          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}

          {podeTrocarLoja ? (
            <div className="ck-estoque__loja" style={{ position: 'relative' }}>
              <button
                type="button"
                className="ck-estoque__loja-btn"
                onClick={() => setDlgLoja((v) => !v)}
              >
                <span>{lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}</span>
                <span aria-hidden>{dlgLoja ? '▴' : '▾'}</span>
              </button>
              {dlgLoja && (
                <>
                  <div
                    className="ck-estoque__dropdown-backdrop"
                    onClick={() => setDlgLoja(false)}
                  />
                  <div className="ck-estoque__loja-dropdown">
                    {lojas.map((l) => {
                      const ativa = l.id_loja === idLoja;
                      return (
                        <button
                          key={l.id_loja}
                          type="button"
                          className={`ck-estoque__loja-item${ativa ? ' is-on' : ''}`}
                          onClick={() => {
                            setIdLoja(l.id_loja);
                            localStorage.setItem(LOJA_STORAGE_KEY, String(l.id_loja));
                            setDlgLoja(false);
                          }}
                        >
                          {rotuloLoja(l)}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : lojaAtual ? (
            <div className="ck-estoque__loja">
              <div className="ck-estoque__loja-fix" aria-label="Loja">
                <StorefrontOutlinedIcon className="ck-estoque__loja-fix-icon" />
                <div className="ck-estoque__loja-fix-text">
                  {lojaAtual.bk_number ? <small>{lojaAtual.bk_number}</small> : null}
                  <strong>{nomeLoja(lojaAtual)}</strong>
                </div>
              </div>
            </div>
          ) : null}

          <div className="ck-visitas__seg" role="tablist">
            {(
              [
                ['todas', 'Todas'],
                ['aberta', 'Abertas'],
                ['finalizada', 'Finalizadas'],
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

          {idLoja ? (
            <>
              <button
                type="button"
                className={`ck-estoque-nfe__atalho${faltaDiariaHoje ? ' is-diario' : ''}`}
                style={{ marginBottom: '16px' }}
                disabled={iniciando}
                onClick={() => void iniciar('diaria')}
              >
                <span className="ck-estoque-nfe__atalho-main">
                  <strong>
                    {diariaHoje?.status === 'aberta'
                      ? 'Continuar contagem diária de hoje'
                      : diariaHoje?.status === 'finalizada'
                        ? 'Diária de hoje · consultar'
                        : 'Contagem diária de hoje'}
                  </strong>
                  <small>Rotina diária de insumos</small>
                </span>
                <span aria-hidden>›</span>
              </button>
              <div className="ck-estoque__atalhos-grid">
                <button
                  type="button"
                  className="ck-estoque__btn-grid-card"
                  onClick={() => navigate('/estoque/mobile/vendas')}
                >
                  <TrendingUpOutlinedIcon />
                  <strong>Vendas</strong>
                  <small>Tempo real</small>
                </button>
                <button
                  type="button"
                  className="ck-estoque__btn-grid-card"
                  onClick={() => navigate('/estoque/mobile/saldo')}
                >
                  <Inventory2OutlinedIcon />
                  <strong>Saldo</strong>
                  <small>Quantidades</small>
                </button>
                <button
                  type="button"
                  className="ck-estoque__btn-grid-card"
                  onClick={() => navigate('/estoque/mobile/nfes')}
                >
                  <LocalShippingOutlinedIcon />
                  <strong>Receber NF</strong>
                  <small>Conferência</small>
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="ck-visitas__sheet-body">
          {loading && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          {!loading && !filtrada.length && (
            <div className="ck-estoque__empty">
              {lojaAtual
                ? filtro !== 'todas' && lista.length > 0
                  ? 'Nenhuma conferência neste filtro.'
                  : 'Nenhuma conferência nesta loja. Toque em contagem diária para começar.'
                : 'Selecione a loja para começar.'}
            </div>
          )}

          {filtrada.map((c) => {
            const aberta = c.status === 'aberta';
            const parcial = ehContagemParcial(c.tipo);
            const divergencias = c.divergencias ?? 0;
            const pendentes = c.pendentes ?? 0;
            const mostrarReabrir = podeReabrir && !aberta;
            const valorPrincipal = fmtBrl(c.valor_atual ?? c.total_valor ?? 0);
            const dataCurta = (() => {
              const iso = aberta ? c.criado_em : c.finalizado_em || c.criado_em;
              if (!iso) return '';
              const d = new Date(iso);
              if (Number.isNaN(d.getTime())) return '';
              return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            })();
            return (
              <div
                key={c.id_contagem}
                className={`ck-estoque__card ck-estoque__card--lista${aberta ? ' is-aberta' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/estoque/mobile/${c.id_contagem}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/estoque/mobile/${c.id_contagem}`);
                  }
                }}
              >
                <div className="ck-estoque__card-top">
                  <div className="ck-estoque__card-title">
                    <strong>{c.titulo || `Conferência #${c.id_contagem}`}</strong>
                    <span className="ck-estoque__card-tipo">
                      {rotuloTipoContagem(c.tipo)}
                      {dataCurta ? ` · ${dataCurta}` : ''}
                    </span>
                  </div>
                  <span
                    className={`ck-estoque__status ${aberta ? 'is-aberta' : 'is-ok'}`}
                  >
                    {aberta ? 'Aberta' : 'Finalizada'}
                  </span>
                </div>

                <div className="ck-estoque__card-valor">
                  <strong>{valorPrincipal}</strong>
                  <span>{parcial ? 'Valor parcial' : 'Valor da contagem'}</span>
                </div>

                <div className="ck-estoque__card-foot">
                  <div className="ck-estoque__card-meta-left">
                    <span className="ck-estoque__card-who" title="Responsável pela conferência">
                      <PersonOutlinedIcon sx={{ fontSize: 16, color: 'var(--ck-navy)' }} />
                      <strong>{c.criado_por_nome || 'Não informado'}</strong>
                    </span>
                    {pendentes > 0 && (
                      <span className="ck-estoque__badge-pend">{pendentes} pendente{pendentes !== 1 ? 's' : ''}</span>
                    )}
                    {divergencias > 0 && (
                      <span className="ck-estoque__badge-div">{divergencias} divergência{divergencias !== 1 ? 's' : ''}</span>
                    )}
                    {!aberta && pendentes === 0 && (
                      <span className="ck-estoque__badge-ok">Conferido</span>
                    )}
                  </div>
                  {mostrarReabrir && (
                    <button
                      type="button"
                      className="ck-estoque__reabrir"
                      title="Reabrir"
                      aria-label="Reabrir conferência"
                      disabled={reabrindoId === c.id_contagem}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setReabrirAlvo(c);
                      }}
                    >
                      <LockOpenIcon fontSize="small" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {idLoja ? (
        <Fab
          aria-label="Nova contagem"
          onClick={() => setDlgTipo(true)}
          disabled={iniciando}
          sx={{
            position: 'fixed',
            right: safeAreaRightCalc(20),
            bottom: 'calc(16px + var(--app-tabbar-offset, 58px))',
            zIndex: 40,
            bgcolor: '#E8520A',
            color: '#fff',
            boxShadow: '0 6px 20px rgba(232, 82, 10, 0.42)',
            '&:hover': { bgcolor: '#d14a09' },
          }}
        >
          <AddIcon />
        </Fab>
      ) : null}

      {dlgTipo &&
        createPortal(
          <div className="ck-estoque">
            <div
              className="ck-estoque__loja-modal ck-estoque__modal--center"
              role="dialog"
              aria-modal="true"
              aria-label="Nova contagem"
            >
              <button
                type="button"
                className="ck-estoque__loja-backdrop"
                aria-label="Fechar"
                disabled={iniciando}
                onClick={() => setDlgTipo(false)}
              />
              <div className="ck-estoque__loja-panel ck-estoque__confirm">
                <div className="ck-estoque__loja-panel-head">
                  <strong>Nova contagem</strong>
                  <button
                    type="button"
                    className="ck-estoque__loja-fechar"
                    disabled={iniciando}
                    onClick={() => setDlgTipo(false)}
                  >
                    Fechar
                  </button>
                </div>
                <p className="ck-estoque__confirm-text">
                  Selecione o tipo de contagem que deseja realizar:
                </p>
                <div className="ck-estoque__confirm-actions" style={{ flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    className="ck-estoque__modal-action-btn ck-estoque__modal-action-btn--pri"
                    disabled={iniciando}
                    onClick={() => void iniciar('diaria')}
                  >
                    <strong>Contagem diária</strong>
                    <small>Carne, frango, queijo, bacon, pão, batata, copos e mix</small>
                  </button>
                  <button
                    type="button"
                    className="ck-estoque__modal-action-btn"
                    disabled={iniciando}
                    onClick={() => void iniciar('critica_semanal')}
                  >
                    <strong>Contagem semanal (segunda)</strong>
                    <small>Contagem específica de mix (Coca 18L, outros 10L) e latas</small>
                  </button>
                  <button
                    type="button"
                    className="ck-estoque__modal-action-btn"
                    disabled={iniciando}
                    onClick={() => void iniciar('completa')}
                  >
                    <strong>Contagem completa</strong>
                    <small>Inventário geral de todos os insumos cadastrados da loja</small>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}



      {reabrirAlvo &&
        createPortal(
          <div className="ck-estoque">
            <div
              className="ck-estoque__loja-modal ck-estoque__modal--center"
              role="dialog"
              aria-modal="true"
              aria-label="Reabrir conferência"
            >
              <button
                type="button"
                className="ck-estoque__loja-backdrop"
                aria-label="Fechar"
                disabled={reabrindoId != null}
                onClick={() => setReabrirAlvo(null)}
              />
              <div className="ck-estoque__loja-panel ck-estoque__confirm">
                <div className="ck-estoque__loja-panel-head">
                  <strong>Reabrir conferência</strong>
                  <button
                    type="button"
                    className="ck-estoque__loja-fechar"
                    disabled={reabrindoId != null}
                    onClick={() => setReabrirAlvo(null)}
                  >
                    Fechar
                  </button>
                </div>
                <p className="ck-estoque__confirm-text">
                  A conferência{' '}
                  <strong>{reabrirAlvo.titulo || `#${reabrirAlvo.id_contagem}`}</strong> voltará para
                  aberta e poderá ser editada.
                </p>
                <div className="ck-estoque__confirm-actions">
                  <button
                    type="button"
                    className="ck-estoque__btn ck-estoque__btn--ghost"
                    disabled={reabrindoId != null}
                    onClick={() => setReabrirAlvo(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="ck-estoque__btn ck-estoque__btn--primary"
                    disabled={reabrindoId != null}
                    onClick={() => void confirmarReabrir()}
                  >
                    {reabrindoId != null ? 'Reabrindo…' : 'Reabrir'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
