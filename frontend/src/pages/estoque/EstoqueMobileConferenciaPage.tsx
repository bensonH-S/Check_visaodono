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

function fmtBrl(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

type RascunhoLinha = { caixa: string; pc: string; kg: string };

function parseNumCampo(raw: string): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function calcQtdTerraco(
  linha: RascunhoLinha | undefined,
  undConvertida: number,
  undParcial: number,
): number | null {
  if (!linha) return null;
  const tem =
    String(linha.caixa).trim() !== '' ||
    String(linha.pc).trim() !== '' ||
    String(linha.kg).trim() !== '';
  if (!tem) return null;
  const caixa = parseNumCampo(linha.caixa) ?? 0;
  const pc = parseNumCampo(linha.pc) ?? 0;
  const kg = parseNumCampo(linha.kg) ?? 0;
  const base = undConvertida > 0 ? undConvertida : 1;
  const parcial = undParcial > 0 ? undParcial : 1;
  return Math.round((caixa * base + pc * parcial + kg) * 10000) / 10000;
}

function rascunhoDeItem(i: EstoqueItem): RascunhoLinha {
  const temTerraco =
    i.contagem_caixa != null || i.contagem_pc_fd != null || i.contagem_kg_und != null;
  if (temTerraco) {
    return {
      caixa: i.contagem_caixa == null ? '' : String(i.contagem_caixa),
      pc: i.contagem_pc_fd == null ? '' : String(i.contagem_pc_fd),
      kg: i.contagem_kg_und == null ? '' : String(i.contagem_kg_und),
    };
  }
  return {
    caixa: '',
    pc: '',
    kg: i.estoque_contado == null ? '' : String(i.estoque_contado),
  };
}

function aplicarDraft(det: EstoqueContagemDetalhe) {
  const draft: Record<number, RascunhoLinha> = {};
  for (const i of det.itens || []) {
    draft[i.id_item] = rascunhoDeItem(i);
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
  const [rascunho, setRascunho] = useState<Record<number, RascunhoLinha>>(() =>
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
    let totalValor = 0;
    for (const i of itens) {
      const undCx = Number(i.und_convertida) > 0 ? Number(i.und_convertida) : 1;
      const undPc = Number(i.und_parcial) > 0 ? Number(i.und_parcial) : 1;
      const contado = calcQtdTerraco(rascunho[i.id_item], undCx, undPc);
      if (contado == null || !Number.isFinite(contado)) {
        pendentes += 1;
        continue;
      }
      preenchidos += 1;
      totalValor += contado * (Number(i.valor_unidade) || 0);
      if (contado !== i.estoque_sistema) divergencias += 1;
    }
    return {
      pendentes,
      divergencias,
      preenchidos,
      total: itens.length,
      totalValor: Math.round(totalValor * 100) / 100,
    };
  }, [contagem, rascunho]);

  const setCampo = (idItem: number, campo: keyof RascunhoLinha, valor: string) => {
    setRascunho((prev) => ({
      ...prev,
      [idItem]: {
        caixa: prev[idItem]?.caixa ?? '',
        pc: prev[idItem]?.pc ?? '',
        kg: prev[idItem]?.kg ?? '',
        [campo]: valor,
      },
    }));
  };

  const salvar = async (silencioso = false) => {
    if (!contagem?.id_contagem || !editavel) return null;
    setSalvando(true);
    try {
      const itens = contagem.itens.map((i) => {
        const raw = rascunho[i.id_item] || { caixa: '', pc: '', kg: '' };
        return {
          id_item: i.id_item,
          contagem_caixa: parseNumCampo(raw.caixa),
          contagem_pc_fd: parseNumCampo(raw.pc),
          contagem_kg_und: parseNumCampo(raw.kg),
        };
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
      showToast(e instanceof Error ? e.message : 'Erro ao reabrir', 'error');
    } finally {
      setReabrindo(false);
    }
  };

  return (
    <div className="ck-visitas ck-estoque">
      <header className="ck-visitas__topbar">
        <CkMarkLogoMenu />
        <div className="ck-estoque__top-info">
          <div className="ck-estoque__titulo-row">
            <button
              type="button"
              className="ck-estoque__back"
              aria-label="Voltar"
              onClick={() => navigate('/estoque/mobile')}
            >
              ←
            </button>
            <div>
              <h1>Conferência</h1>
              <p className="ck-estoque__sub">
                {contagem?.titulo || 'Contagem de insumos'}
                {contagem?.data_contagem
                  ? ` · ${new Date(contagem.data_contagem + 'T12:00:00').toLocaleDateString('pt-BR')}`
                  : ''}
              </p>
            </div>
          </div>
          {contagem && (
            <div className="ck-estoque__chips">
              <div className="ck-estoque__chip">
                <strong>{fmtBrl(contagem.valor_inicial_mes)}</strong>
                <span>
                  início do mês
                  {contagem.data_inicial_mes
                    ? ` · ${new Date(contagem.data_inicial_mes + 'T12:00:00').toLocaleDateString('pt-BR')}`
                    : ''}
                </span>
              </div>
              <div className="ck-estoque__chip">
                <strong>{fmtBrl(resumo.totalValor)}</strong>
                <span>valor atual</span>
              </div>
              <div className="ck-estoque__chip">
                <strong>{resumo.preenchidos}</strong>
                <span>preenchidos</span>
              </div>
              <div className="ck-estoque__chip">
                <strong>{resumo.pendentes}</strong>
                <span>pendentes</span>
              </div>
              <div className="ck-estoque__chip">
                <strong>{resumo.divergencias}</strong>
                <span>divergências</span>
              </div>
            </div>
          )}
        </div>
      </header>

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
                const raw = rascunho[i.id_item] ?? { caixa: '', pc: '', kg: '' };
                const undCx = Number(i.und_convertida) > 0 ? Number(i.und_convertida) : 1;
                const undPc = Number(i.und_parcial) > 0 ? Number(i.und_parcial) : 1;
                const contado = editavel
                  ? calcQtdTerraco(raw, undCx, undPc)
                  : i.estoque_contado;
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
                    <div className="ck-estoque__meta" style={{ marginTop: 0, marginBottom: 8 }}>
                      Valor:{' '}
                      {preenchido
                        ? fmtBrl(contado * (Number(i.valor_unidade) || 0))
                        : '—'}
                    </div>
                    <div className="ck-estoque__row">
                      <div className="ck-estoque__field">
                        <label>Sistema</label>
                        <div className="ck-estoque__sistema">{fmtNum(i.estoque_sistema, 3)}</div>
                      </div>
                      <div className="ck-estoque__field">
                        <label>QTD</label>
                        <div className="ck-estoque__sistema">
                          {preenchido ? fmtNum(contado, 3) : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="ck-estoque__row ck-estoque__row--tres">
                      {(
                        [
                          ['caixa', 'CAIXA'],
                          ['pc', 'PC/FD'],
                          ['kg', 'KG/UND'],
                        ] as const
                      ).map(([campo, label]) => (
                        <div key={campo} className="ck-estoque__field">
                          <label>{label}</label>
                          {editavel ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              min="0"
                              enterKeyHint="next"
                              autoComplete="off"
                              value={raw[campo]}
                              placeholder="—"
                              data-estoque-campo={campo}
                              onChange={(e) => setCampo(i.id_item, campo, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter') return;
                                e.preventDefault();
                                const inputs = Array.from(
                                  document.querySelectorAll<HTMLInputElement>(
                                    'input[data-estoque-campo]',
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
                            <div className="ck-estoque__sistema">
                              {fmtNum(
                                campo === 'caixa'
                                  ? i.contagem_caixa
                                  : campo === 'pc'
                                    ? i.contagem_pc_fd
                                    : i.contagem_kg_und,
                                3,
                              )}
                            </div>
                          )}
                        </div>
                      ))}
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
                      className="ck-estoque__btn ck-estoque__btn--ok"
                      disabled={salvando || finalizando || resumo.pendentes > 0}
                      onClick={() => void finalizar()}
                    >
                      {finalizando ? 'Finalizando…' : 'Finalizar'}
                    </button>
                  </div>
                </div>
              )}

              {!editavel && podeReabrir && contagem.status === 'finalizada' && (
                <div className="ck-estoque__actions">
                  <button
                    type="button"
                    className="ck-estoque__btn ck-estoque__btn--save"
                    disabled={reabrindo}
                    onClick={() => setDlgReabrir(true)}
                  >
                    <LockOpenIcon fontSize="small" style={{ marginRight: 6 }} />
                    Reabrir conferência
                  </button>
                </div>
              )}

              {contagem.finalizado_em && (
                <p className="ck-estoque__meta-foot">
                  Finalizada em {fmtDataHora(contagem.finalizado_em)}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {dlgReabrir && (
        <div className="ck-estoque__dlg-backdrop" role="presentation">
          <div className="ck-estoque__dlg" role="dialog" aria-modal="true">
            <h2>Reabrir conferência?</h2>
            <p>Você poderá editar CAIXA / PC/FD / KG-UND novamente.</p>
            <div className="ck-estoque__dlg-actions">
              <button type="button" onClick={() => setDlgReabrir(false)} disabled={reabrindo}>
                Cancelar
              </button>
              <button type="button" onClick={() => void confirmarReabrir()} disabled={reabrindo}>
                {reabrindo ? 'Reabrindo…' : 'Reabrir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
