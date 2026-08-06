import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import {
  api,
  type EstoqueContagemResumo,
  type Loja,
} from '../../api/client';
import { getUsuario, podeReabrirContagemEstoque } from '../../lib/auth';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';

const LOJA_STORAGE_KEY = 'estoque.id_loja';

function fmtDataHora(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function rotuloLoja(l: Loja) {
  return `${l.bk_number ? `${l.bk_number} · ` : ''}${l.name}`;
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
  const podeReabrir = podeReabrirContagemEstoque(getUsuario());
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(() => {
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
  const [buscaLoja, setBuscaLoja] = useState('');
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
        const rows = await api.lojas({ ativas: true, operacionais: true });
        if (cancel) return;
        setLojas(rows);
        if (!idLoja && rows.length) {
          const plk = rows.find((l) => l.bk_number === '15022');
          const escolhida = plk?.id_loja ?? rows[0].id_loja;
          setIdLoja(escolhida);
          localStorage.setItem(LOJA_STORAGE_KEY, String(escolhida));
        } else if (idLoja && !rows.some((l) => l.id_loja === idLoja)) {
          const fallback = rows[0]?.id_loja;
          if (fallback) {
            setIdLoja(fallback);
            localStorage.setItem(LOJA_STORAGE_KEY, String(fallback));
          }
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

  const abertas = lista.filter((c) => c.status === 'aberta').length;
  const finalizadas = lista.filter((c) => c.status === 'finalizada').length;
  const temAberta = abertas > 0;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;
  const lojasFiltradas = useMemo(() => {
    const q = buscaLoja.trim().toLowerCase();
    if (!q) return lojas;
    return lojas.filter((l) => rotuloLoja(l).toLowerCase().includes(q));
  }, [lojas, buscaLoja]);

  const selecionarLoja = (id: number) => {
    setIdLoja(id);
    localStorage.setItem(LOJA_STORAGE_KEY, String(id));
    setDlgLoja(false);
    setBuscaLoja('');
  };

  const fecharDlgLoja = () => {
    setDlgLoja(false);
    setBuscaLoja('');
  };

  useEffect(() => {
    if (!dlgLoja && !reabrirAlvo) {
      travarScrollPagina(false);
      return;
    }
    travarScrollPagina(true);
    return () => travarScrollPagina(false);
  }, [dlgLoja, reabrirAlvo]);

  const iniciar = async () => {
    if (!idLoja || temAberta) return;
    setIniciando(true);
    try {
      const det = await api.estoqueIniciarSabado({ id_loja: idLoja });
      if (det.id_contagem) {
        navigate(`/estoque/mobile/${det.id_contagem}`, {
          state: { contagemPreload: det },
        });
      }
      showToast(det.meta?.iniciada_agora ? 'Conferência iniciada' : 'Conferência aberta');
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
    <div className="ck-visitas ck-estoque">
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
                  Conferência
                  <br />
                  de estoque
                </h1>
              </div>
              <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
            </div>
            <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
              Conte os insumos da loja, salve o rascunho e finalize a conferência.
            </p>
            <div className="ck-visitas__metrics ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
              <div className="ck-visitas__metric">
                <strong>{loading ? '—' : lista.length}</strong>
                <span>total</span>
              </div>
              <div className="ck-visitas__metric">
                <strong>{loading ? '—' : abertas}</strong>
                <span>abertas</span>
              </div>
              <div className="ck-visitas__metric ck-visitas__metric--accent">
                <strong>{loading ? '—' : finalizadas}</strong>
                <span>finalizadas</span>
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

          <div className="ck-estoque__loja">
            <button
              type="button"
              className="ck-estoque__loja-btn"
              onClick={() => setDlgLoja(true)}
            >
              {lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}
              <span aria-hidden>▾</span>
            </button>
          </div>

          {idLoja && !temAberta && (
            <div className="ck-estoque__cta">
              <button
                type="button"
                className="ck-estoque__btn ck-estoque__btn--primary"
                disabled={iniciando}
                onClick={() => void iniciar()}
              >
                {iniciando ? 'Iniciando…' : 'Iniciar conferência'}
              </button>
            </div>
          )}

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

          {loading && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          {!loading && !filtrada.length && (
            <div className="ck-estoque__empty">
              {lojaAtual
                ? 'Nenhuma conferência nesta loja.'
                : 'Selecione a loja para começar.'}
            </div>
          )}

          {filtrada.map((c) => {
            const aberta = c.status === 'aberta';
            const divergencias = c.divergencias ?? 0;
            const mostrarReabrir = podeReabrir && !aberta;
            return (
              <div
                key={c.id_contagem}
                className="ck-estoque__card"
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
                  <strong>{c.titulo || `Conferência #${c.id_contagem}`}</strong>
                  <span
                    className={`ck-estoque__chip ${aberta ? 'ck-estoque__chip--aberta' : 'ck-estoque__chip--ok'}`}
                  >
                    {aberta ? 'Aberta' : 'Finalizada'}
                  </span>
                </div>
                <div className="ck-estoque__meta">
                  {c.criado_por_nome ? `${c.criado_por_nome} · ` : ''}
                  Iniciada {fmtDataHora(c.criado_em)}
                  {!aberta && c.finalizado_em ? ` · Finalizada ${fmtDataHora(c.finalizado_em)}` : ''}
                </div>
                <div className="ck-estoque__chips">
                  <span className="ck-estoque__chip">{c.itens_total ?? 0} itens</span>
                  <span
                    className={`ck-estoque__chip ${
                      (c.pendentes ?? 0) > 0 ? 'ck-estoque__chip--pend' : 'ck-estoque__chip--ok'
                    }`}
                  >
                    Pend. {c.pendentes ?? 0}
                  </span>
                  <span
                    className={`ck-estoque__chip ${divergencias ? 'ck-estoque__chip--warn' : 'ck-estoque__chip--ok'}`}
                  >
                    Div. {divergencias}
                  </span>
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

      {dlgLoja &&
        createPortal(
          <div className="ck-estoque">
            <div
              className="ck-estoque__loja-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Selecionar loja"
            >
              <button
                type="button"
                className="ck-estoque__loja-backdrop"
                aria-label="Fechar"
                onClick={fecharDlgLoja}
              />
              <div className="ck-estoque__loja-panel">
                <div className="ck-estoque__loja-panel-head">
                  <strong>Escolher loja</strong>
                  <button type="button" className="ck-estoque__loja-fechar" onClick={fecharDlgLoja}>
                    Fechar
                  </button>
                </div>
                {lojas.length > 8 && (
                  <div className="ck-estoque__loja-busca">
                    <input
                      type="search"
                      placeholder="Buscar loja…"
                      value={buscaLoja}
                      onChange={(e) => setBuscaLoja(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
                <div className="ck-estoque__loja-lista">
                  {lojasFiltradas.map((l) => {
                    const ativa = l.id_loja === idLoja;
                    return (
                      <button
                        key={l.id_loja}
                        type="button"
                        className={`ck-estoque__loja-item${ativa ? ' is-on' : ''}`}
                        onClick={() => selecionarLoja(l.id_loja)}
                      >
                        {rotuloLoja(l)}
                      </button>
                    );
                  })}
                  {!lojasFiltradas.length && (
                    <div className="ck-estoque__empty">Nenhuma loja encontrada.</div>
                  )}
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
