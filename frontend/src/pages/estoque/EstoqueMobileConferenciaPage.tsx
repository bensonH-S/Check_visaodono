import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import {
  api,
  type EstoqueContagemDetalhe,
  type EstoqueItem,
} from '../../api/client';
import { getUsuario, podeReabrirContagemEstoque } from '../../lib/auth';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';

function fmtNum(v: number | null | undefined, digitos = 2) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digitos,
  });
}

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

function aplicarDraft(det: EstoqueContagemDetalhe) {
  const draft: Record<number, string> = {};
  for (const i of det.itens || []) {
    draft[i.id_item] = i.estoque_contado == null ? '' : String(i.estoque_contado);
  }
  return draft;
}

type LocationState = { contagemPreload?: EstoqueContagemDetalhe };

export default function EstoqueMobileConferenciaPage() {
  const { idContagem } = useParams<{ idContagem: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const id = Number(idContagem);
  const preload = (location.state as LocationState | null)?.contagemPreload;
  const podeReabrir = podeReabrirContagemEstoque(getUsuario());

  const [contagem, setContagem] = useState<EstoqueContagemDetalhe | null>(() =>
    preload?.id_contagem === id ? preload : null,
  );
  const [rascunho, setRascunho] = useState<Record<number, string>>(() =>
    preload?.id_contagem === id ? aplicarDraft(preload) : {},
  );
  const [loading, setLoading] = useState(() => !(preload?.id_contagem === id));
  const [salvando, setSalvando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [dlgReabrir, setDlgReabrir] = useState(false);
  const [busca, setBusca] = useState('');
  const [err, setErr] = useState('');

  const carregar = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return;
    setLoading(true);
    setErr('');
    try {
      const det = await api.estoqueContagem(id);
      setContagem(det);
      setRascunho(aplicarDraft(det));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao abrir conferência');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (preload?.id_contagem === id) {
      setContagem(preload);
      setRascunho(aplicarDraft(preload));
      setLoading(false);
      // limpa state da navegação p/ não reusar dados velhos no back
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    void carregar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editavel = contagem?.status === 'aberta';

  const itensFiltrados = useMemo(() => {
    const itens = contagem?.itens || [];
    const q = busca.trim().toLowerCase();
    if (!q) return itens;
    return itens.filter(
      (i) =>
        i.codigo.toLowerCase().includes(q) ||
        i.descricao.toLowerCase().includes(q),
    );
  }, [contagem, busca]);

  const resumo = useMemo(() => {
    const itens = contagem?.itens || [];
    let pendentes = 0;
    let divergencias = 0;
    let preenchidos = 0;
    for (const i of itens) {
      const raw = rascunho[i.id_item];
      if (raw === '' || raw == null) {
        pendentes += 1;
        continue;
      }
      const contado = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(contado)) {
        pendentes += 1;
        continue;
      }
      preenchidos += 1;
      if (contado !== i.estoque_sistema) divergencias += 1;
    }
    return { pendentes, divergencias, preenchidos, total: itens.length };
  }, [contagem, rascunho]);

  const salvar = async (silencioso = false) => {
    if (!contagem?.id_contagem || !editavel) return null;
    setSalvando(true);
    try {
      const itens = contagem.itens.map((i) => {
        const raw = rascunho[i.id_item];
        const estoque_contado =
          raw === undefined || raw === '' ? null : Number(String(raw).replace(',', '.'));
        return { id_item: i.id_item, estoque_contado };
      });
      const det = await api.estoqueSalvarItens(contagem.id_contagem, itens);
      setContagem(det);
      setRascunho(aplicarDraft(det));
      if (!silencioso) showToast('Rascunho salvo');
      return det;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
      throw e;
    } finally {
      setSalvando(false);
    }
  };

  const finalizar = async () => {
    if (!contagem?.id_contagem || !editavel) return;
    if (resumo.pendentes > 0) {
      showToast(`Ainda há ${resumo.pendentes} insumo(s) sem contagem`, 'error');
      return;
    }
    setFinalizando(true);
    try {
      await salvar(true);
      await api.estoqueFinalizarContagem(contagem.id_contagem);
      showToast('Conferência finalizada');
      navigate('/estoque/mobile', { replace: true });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao finalizar', 'error');
    } finally {
      setFinalizando(false);
    }
  };

  const confirmarReabrir = async () => {
    if (!contagem?.id_contagem || contagem.status !== 'finalizada') return;
    setReabrindo(true);
    try {
      const det = await api.estoqueReabrirContagem(contagem.id_contagem);
      setContagem(det);
      setRascunho(aplicarDraft(det));
      setDlgReabrir(false);
      showToast('Conferência reaberta para edição', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível reabrir', 'error');
    } finally {
      setReabrindo(false);
    }
  };

  const onChangeItem = (item: EstoqueItem, value: string) => {
    setRascunho((prev) => ({ ...prev, [item.id_item]: value }));
  };

  return (
    <div className="ck-visitas ck-estoque ck-estoque--detalhe">
      <div className="ck-visitas__stage ck-estoque__sticky-head">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />
        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title">
                Conferência
              </h1>
            </div>
            <div className="ck-estoque__hero-actions">
              {podeReabrir && contagem?.status === 'finalizada' && (
                <button
                  type="button"
                  className="ck-estoque__reabrir ck-estoque__reabrir--hero"
                  title="Reabrir"
                  aria-label="Reabrir conferência"
                  disabled={reabrindo}
                  onClick={() => setDlgReabrir(true)}
                >
                  <LockOpenIcon fontSize="small" />
                </button>
              )}
              <CkMarkLogoMenu size={56} className="ck-visitas__mark-icon" />
            </div>
          </div>
          <p className="ck-visitas__sub">
            {contagem?.titulo ? `${contagem.titulo} · ` : ''}
            {contagem?.criado_por_nome ? `${contagem.criado_por_nome} · ` : ''}
            {contagem?.criado_em ? `Iniciada ${fmtDataHora(contagem.criado_em)}` : ''}
            {contagem?.status === 'finalizada' && contagem.finalizado_em
              ? ` · Finalizada ${fmtDataHora(contagem.finalizado_em)}`
              : ''}
          </p>
          {!loading && contagem && (
            <div className="ck-visitas__metrics" aria-live="polite">
              <div className="ck-visitas__metric">
                <strong>
                  {resumo.preenchidos}/{resumo.total}
                </strong>
                <span>contados</span>
              </div>
              <div
                className={`ck-visitas__metric${resumo.pendentes ? ' ck-estoque__metric--pend' : ''}`}
              >
                <strong>{resumo.pendentes}</strong>
                <span>pendentes</span>
              </div>
              <div
                className={`ck-visitas__metric ck-visitas__metric--accent${
                  resumo.divergencias ? ' ck-estoque__metric--div' : ''
                }`}
              >
                <strong>{resumo.divergencias}</strong>
                <span>divergências</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ck-estoque__busca-fix">
        <button
          type="button"
          className="ck-estoque__back ck-estoque__back--busca"
          aria-label="Voltar"
          onClick={() => navigate('/estoque/mobile')}
        >
          ←
        </button>
        <input
          type="search"
          placeholder="Buscar código ou insumo…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          disabled={loading || !contagem}
        />
      </div>

      <div className="ck-visitas__scroll">
        <div className="ck-visitas__sheet ck-estoque__sheet-scroll">
          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}
          {loading && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          {!loading && contagem && (
            <>
              {itensFiltrados.map((i) => {
                const raw = rascunho[i.id_item] ?? '';
                const contado =
                  raw === '' ? null : Number(String(raw).replace(',', '.'));
                const preenchido = contado != null && Number.isFinite(contado);
                const dif = !preenchido ? null : contado - i.estoque_sistema;
                const comDiv = dif != null && dif !== 0;
                return (
                  <div
                    key={i.id_item}
                    className={`ck-estoque__item${
                      comDiv ? ' is-div' : preenchido ? ' is-ok' : ' is-pend'
                    }`}
                  >
                    <div className="ck-estoque__item-head">
                      <span className="ck-estoque__cod">{i.codigo}</span>
                      <span className="ck-estoque__und">
                        {String(i.unidade_contagem || '').toUpperCase()}
                      </span>
                    </div>
                    <div className="ck-estoque__desc">{i.descricao}</div>
                    <div className="ck-estoque__row">
                      <div className="ck-estoque__field">
                        <label>Sistema</label>
                        <div className="ck-estoque__sistema">{fmtNum(i.estoque_sistema, 3)}</div>
                      </div>
                      <div className="ck-estoque__field">
                        <label>Estoque final</label>
                        {editavel ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min="0"
                            enterKeyHint="next"
                            autoComplete="off"
                            value={raw}
                            placeholder="0"
                            data-estoque-final="1"
                            onChange={(e) => onChangeItem(i, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return;
                              e.preventDefault();
                              const inputs = Array.from(
                                document.querySelectorAll<HTMLInputElement>(
                                  'input[data-estoque-final="1"]',
                                ),
                              );
                              const idx = inputs.indexOf(e.target as HTMLInputElement);
                              const proximo = idx >= 0 ? inputs[idx + 1] : null;
                              if (proximo) {
                                proximo.focus();
                                proximo.select();
                              }
                            }}
                          />
                        ) : (
                          <div className="ck-estoque__sistema">{fmtNum(i.estoque_contado, 3)}</div>
                        )}
                      </div>
                    </div>
                    {dif != null && (
                      <div className={`ck-estoque__dif ${comDiv ? 'is-div' : 'is-zero'}`}>
                        Diferença: {fmtNum(dif, 3)}
                      </div>
                    )}
                  </div>
                );
              })}

              {!itensFiltrados.length && (
                <div className="ck-estoque__empty">Nenhum insumo encontrado.</div>
              )}

              {editavel && (
                <div className="ck-estoque__actions">
                  <div className="ck-estoque__actions-row">
                    <button
                      type="button"
                      className="ck-estoque__btn ck-estoque__btn--save"
                      disabled={salvando || finalizando}
                      onClick={() => void salvar()}
                    >
                      {salvando ? 'Salvando…' : 'Salvar rascunho'}
                    </button>
                    <button
                      type="button"
                      className="ck-estoque__btn ck-estoque__btn--done"
                      disabled={salvando || finalizando}
                      onClick={() => void finalizar()}
                    >
                      {finalizando ? 'Finalizando…' : 'Finalizar'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {dlgReabrir && (
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
            disabled={reabrindo}
            onClick={() => setDlgReabrir(false)}
          />
          <div className="ck-estoque__loja-panel ck-estoque__confirm">
            <div className="ck-estoque__loja-panel-head">
              <strong>Reabrir conferência</strong>
              <button
                type="button"
                className="ck-estoque__loja-fechar"
                disabled={reabrindo}
                onClick={() => setDlgReabrir(false)}
              >
                Fechar
              </button>
            </div>
            <p className="ck-estoque__confirm-text">
              A conferência{' '}
              <strong>{contagem?.titulo || `#${contagem?.id_contagem}`}</strong> voltará para
              aberta e poderá ser editada.
            </p>
            <div className="ck-estoque__confirm-actions">
              <button
                type="button"
                className="ck-estoque__btn ck-estoque__btn--ghost"
                disabled={reabrindo}
                onClick={() => setDlgReabrir(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="ck-estoque__btn ck-estoque__btn--primary"
                disabled={reabrindo}
                onClick={() => void confirmarReabrir()}
              >
                {reabrindo ? 'Reabrindo…' : 'Reabrir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
