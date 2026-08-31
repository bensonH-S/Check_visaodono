import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import {
  api,
  type EstoqueContagemDetalhe,
  type EstoqueItem,
} from '../../api/client';
import { getUsuario, podeReabrirContagemEstoque } from '../../lib/auth';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';
import { compararOrdemPlanilha } from '../../components/estoque/estoqueOrdemPlanilha';

const AUTOSAVE_MS = 700;
const SECAO_OUTROS = 'OUTROS';

function fmtVl(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function fmtBrl(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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

type RascunhoLinha = { caixa: string; pc: string; kg: string };

type CamposPermitidos = {
  caixa: boolean;
  pc: boolean;
  kg: boolean;
};

function permiteCampos(i: EstoqueItem): CamposPermitidos {
  return {
    caixa: i.permite_contagem_caixa !== false,
    pc: i.permite_contagem_pc_fd !== false,
    kg: i.permite_contagem_kg_und !== false,
  };
}

function parseNumCampo(raw: string): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function calcQtdTerraco(
  linha: RascunhoLinha | undefined,
  undConvertida: number,
  undParcial: number,
  permite: CamposPermitidos,
): number | null {
  if (!linha) return null;
  const tem =
    (permite.caixa && String(linha.caixa).trim() !== '') ||
    (permite.pc && String(linha.pc).trim() !== '') ||
    (permite.kg && String(linha.kg).trim() !== '');
  if (!tem) return null;
  const caixa = permite.caixa ? parseNumCampo(linha.caixa) ?? 0 : 0;
  const pc = permite.pc ? parseNumCampo(linha.pc) ?? 0 : 0;
  const kg = permite.kg ? parseNumCampo(linha.kg) ?? 0 : 0;
  const base = undConvertida > 0 ? undConvertida : 1;
  const parcial = undParcial > 0 ? undParcial : 1;
  return Math.round((caixa * base + pc * parcial + kg) * 10000) / 10000;
}

function calcTotalLinha(qtd: number | null | undefined, valorUnidade: number): number | null {
  if (qtd == null || !Number.isFinite(qtd)) return null;
  return Math.round(qtd * (Number(valorUnidade) || 0) * 100) / 100;
}

function rascunhoDeItem(i: EstoqueItem): RascunhoLinha {
  const p = permiteCampos(i);
  const temTerraco =
    i.contagem_caixa != null || i.contagem_pc_fd != null || i.contagem_kg_und != null;
  if (temTerraco) {
    return {
      caixa: !p.caixa || i.contagem_caixa == null ? '' : String(i.contagem_caixa),
      pc: !p.pc || i.contagem_pc_fd == null ? '' : String(i.contagem_pc_fd),
      kg: !p.kg || i.contagem_kg_und == null ? '' : String(i.contagem_kg_und),
    };
  }
  return {
    caixa: '',
    pc: '',
    kg: p.kg && i.estoque_contado != null ? String(i.estoque_contado) : '',
  };
}

function rascunhoComZeros(
  itens: EstoqueItem[],
  draft: Record<number, RascunhoLinha>,
): Record<number, RascunhoLinha> {
  const next = { ...draft };
  for (const i of itens) {
    const p = permiteCampos(i);
    const undCx = Number(i.und_convertida) > 0 ? Number(i.und_convertida) : 1;
    const undPc = Number(i.und_parcial) > 0 ? Number(i.und_parcial) : 1;
    const line = next[i.id_item] || { caixa: '', pc: '', kg: '' };
    if (calcQtdTerraco(line, undCx, undPc, p) != null) continue;
    next[i.id_item] = {
      caixa: p.caixa ? (String(line.caixa).trim() === '' ? '0' : line.caixa) : '',
      pc: p.pc ? (String(line.pc).trim() === '' ? '0' : line.pc) : '',
      kg: p.kg ? (String(line.kg).trim() === '' ? '0' : line.kg) : '',
    };
  }
  return next;
}

function aplicarDraft(det: EstoqueContagemDetalhe) {
  const draft: Record<number, RascunhoLinha> = {};
  for (const i of det.itens || []) {
    draft[i.id_item] = rascunhoDeItem(i);
  }
  return draft;
}

function nomeSecao(i: EstoqueItem) {
  const s = String(i.secao_contagem || '').trim();
  return s || SECAO_OUTROS;
}

type LocationState = { contagemPreload?: EstoqueContagemDetalhe };

export default function EstoqueMobileConferenciaPage() {
  const { idContagem } = useParams<{ idContagem: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const id = Number(idContagem);
  const preload = (location.state as LocationState | null)?.contagemPreload;
  const podeReabrir = podeReabrirContagemEstoque(getUsuario());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [contagem, setContagem] = useState<EstoqueContagemDetalhe | null>(() =>
    preload?.id_contagem === id ? preload : null,
  );
  const [rascunho, setRascunho] = useState<Record<number, RascunhoLinha>>(() =>
    preload?.id_contagem === id ? aplicarDraft(preload) : {},
  );
  const [loading, setLoading] = useState(() => !(preload?.id_contagem === id));
  const [salvando, setSalvando] = useState(false);
  const [autoSalvando, setAutoSalvando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [dlgReabrir, setDlgReabrir] = useState(false);
  const [dlgFinalizar, setDlgFinalizar] = useState(false);
  const [busca, setBusca] = useState('');
  const [indiceSecao, setIndiceSecao] = useState(0);
  const [err, setErr] = useState('');

  const rascunhoRef = useRef(rascunho);
  const contagemRef = useRef(contagem);
  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvandoRef = useRef(false);

  useEffect(() => {
    rascunhoRef.current = rascunho;
  }, [rascunho]);
  useEffect(() => {
    contagemRef.current = contagem;
  }, [contagem]);

  const carregar = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return;
    setLoading(true);
    setErr('');
    try {
      const det = await api.estoqueContagem(id);
      setContagem(det);
      setRascunho(aplicarDraft(det));
      setIndiceSecao(0);
      dirtyRef.current = false;
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
      setIndiceSecao(0);
      setLoading(false);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    void carregar();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const editavel = contagem?.status === 'aberta';

  const secoes = useMemo(() => {
    const itens = [...(contagem?.itens || [])].sort(compararOrdemPlanilha);
    const ordem: string[] = [];
    const mapa = new Map<string, EstoqueItem[]>();
    for (const i of itens) {
      const nome = nomeSecao(i);
      if (!mapa.has(nome)) {
        mapa.set(nome, []);
        ordem.push(nome);
      }
      mapa.get(nome)!.push(i);
    }
    return ordem.map((nome) => ({ nome, itens: mapa.get(nome)! }));
  }, [contagem]);

  useEffect(() => {
    if (indiceSecao >= secoes.length && secoes.length > 0) {
      setIndiceSecao(secoes.length - 1);
    }
  }, [secoes.length, indiceSecao]);

  const buscando = busca.trim().length > 0;
  const secaoAtual = secoes[indiceSecao] || null;

  const itensVisiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q) {
      return [...(contagem?.itens || [])]
        .filter(
          (i) =>
            i.codigo.toLowerCase().includes(q) ||
            i.descricao.toLowerCase().includes(q) ||
            nomeSecao(i).toLowerCase().includes(q),
        )
        .sort(compararOrdemPlanilha);
    }
    return secaoAtual?.itens || [];
  }, [contagem, busca, secaoAtual]);

  const resumo = useMemo(() => {
    const itens = contagem?.itens || [];
    let pendentes = 0;
    let preenchidos = 0;
    let totalValor = 0;
    const porSecao = new Map<string, { pendentes: number; total: number }>();
    for (const i of itens) {
      const undCx = Number(i.und_convertida) > 0 ? Number(i.und_convertida) : 1;
      const undPc = Number(i.und_parcial) > 0 ? Number(i.und_parcial) : 1;
      const permite = permiteCampos(i);
      const contado = calcQtdTerraco(rascunho[i.id_item], undCx, undPc, permite);
      const nome = nomeSecao(i);
      const st = porSecao.get(nome) || { pendentes: 0, total: 0 };
      st.total += 1;
      if (contado == null || !Number.isFinite(contado)) {
        pendentes += 1;
        st.pendentes += 1;
      } else {
        preenchidos += 1;
        if (i.entra_cmv !== false) {
          totalValor += contado * (Number(i.valor_unidade) || 0);
        }
      }
      porSecao.set(nome, st);
    }
    return {
      pendentes,
      preenchidos,
      total: itens.length,
      totalValor: Math.round(totalValor * 100) / 100,
      porSecao,
    };
  }, [contagem, rascunho]);

  const pendentesSecaoAtual = secaoAtual
    ? resumo.porSecao.get(secaoAtual.nome)?.pendentes ?? 0
    : 0;
  const totalSecaoAtual = secaoAtual?.itens.length ?? 0;
  const preenchidosSecaoAtual = totalSecaoAtual - pendentesSecaoAtual;
  const ultimaSecao = secoes.length > 0 && indiceSecao >= secoes.length - 1;

  const montarPayload = useCallback((det: EstoqueContagemDetalhe, draft: Record<number, RascunhoLinha>) => {
    return det.itens.map((i) => {
      const raw = draft[i.id_item] || { caixa: '', pc: '', kg: '' };
      const p = permiteCampos(i);
      return {
        id_item: i.id_item,
        contagem_caixa: p.caixa ? parseNumCampo(raw.caixa) : null,
        contagem_pc_fd: p.pc ? parseNumCampo(raw.pc) : null,
        contagem_kg_und: p.kg ? parseNumCampo(raw.kg) : null,
      };
    });
  }, []);

  const persistir = useCallback(
    async (opts?: { silencioso?: boolean; forcar?: boolean }) => {
      const silencioso = opts?.silencioso === true;
      const det = contagemRef.current;
      if (!det?.id_contagem || det.status !== 'aberta') return null;
      if (!opts?.forcar && !dirtyRef.current) return det;
      if (salvandoRef.current) return null;

      salvandoRef.current = true;
      if (silencioso) setAutoSalvando(true);
      else setSalvando(true);

      const draftSnap = rascunhoRef.current;
      try {
        const itens = montarPayload(det, draftSnap);
        const saved = await api.estoqueSalvarItens(det.id_contagem, itens);
        if (!dirtyRef.current || opts?.forcar) {
          setContagem(saved);
          if (!silencioso || opts?.forcar) {
            setRascunho(aplicarDraft(saved));
          } else {
            setContagem((prev) =>
              prev
                ? {
                    ...prev,
                    total_valor: saved.total_valor,
                    valor_atual: saved.valor_atual,
                  }
                : saved,
            );
          }
          dirtyRef.current = false;
        } else {
          setContagem((prev) =>
            prev
              ? {
                  ...prev,
                  total_valor: saved.total_valor,
                  valor_atual: saved.valor_atual,
                }
              : saved,
          );
        }
        if (!silencioso) showToast('Rascunho salvo');
        return saved;
      } catch (e) {
        if (!silencioso) {
          showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
        }
        throw e;
      } finally {
        salvandoRef.current = false;
        setSalvando(false);
        setAutoSalvando(false);
      }
    },
    [montarPayload],
  );

  const agendarAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persistir({ silencioso: true }).catch(() => {});
    }, AUTOSAVE_MS);
  }, [persistir]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (dirtyRef.current && contagemRef.current?.status === 'aberta') {
        const det = contagemRef.current;
        const draft = rascunhoRef.current;
        if (det?.id_contagem) {
          void api.estoqueSalvarItens(det.id_contagem, montarPayload(det, draft)).catch(() => {});
        }
      }
    };
  }, [montarPayload]);

  const scrollTopo = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setCampo = (idItem: number, campo: keyof RascunhoLinha, valor: string) => {
    dirtyRef.current = true;
    setRascunho((prev) => ({
      ...prev,
      [idItem]: {
        caixa: prev[idItem]?.caixa ?? '',
        pc: prev[idItem]?.pc ?? '',
        kg: prev[idItem]?.kg ?? '',
        [campo]: valor,
      },
    }));
    agendarAutosave();
  };

  const irSecao = async (novoIndice: number) => {
    if (novoIndice < 0 || novoIndice >= secoes.length || novoIndice === indiceSecao) return;
    if (editavel && dirtyRef.current) {
      try {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        await persistir({ silencioso: true, forcar: true });
      } catch {
        showToast('Não foi possível salvar antes de trocar de seção', 'error');
        return;
      }
    }
    setBusca('');
    setIndiceSecao(novoIndice);
    scrollTopo();
  };

  const finalizar = async () => {
    if (!contagem?.id_contagem || !editavel) return;
    if (resumo.pendentes > 0 && !dlgFinalizar) {
      setDlgFinalizar(true);
      return;
    }
    setDlgFinalizar(false);
    setFinalizando(true);
    try {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      if (resumo.pendentes > 0) {
        const draft = rascunhoComZeros(contagem.itens, rascunhoRef.current);
        rascunhoRef.current = draft;
        setRascunho(draft);
        dirtyRef.current = true;
      }
      await persistir({ silencioso: true, forcar: true });
      dirtyRef.current = false;
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
      setIndiceSecao(0);
      dirtyRef.current = false;
      setDlgReabrir(false);
      showToast('Conferência reaberta para edição', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao reabrir', 'error');
    } finally {
      setReabrindo(false);
    }
  };

  const voltar = async () => {
    if (editavel && dirtyRef.current) {
      try {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        await persistir({ silencioso: true, forcar: true });
      } catch {
        /* ainda assim volta */
      }
    }
    navigate('/estoque/mobile');
  };

  return (
    <div className="ck-visitas ck-visitas--lista ck-estoque ck-estoque--contagem">
      <div className="ck-estoque__contagem-sticky">
        <div className="ck-estoque__contagem-banner" aria-live="polite">
          <button
            type="button"
            className="ck-estoque__contagem-back"
            aria-label="Voltar"
            onClick={() => void voltar()}
          >
            ←
          </button>
          <h1 className="ck-estoque__contagem-title">
            {contagem?.tipo === 'diaria' ? 'DIÁRIA' : 'CONTAGEM'}
          </h1>
          <div className="ck-estoque__contagem-total">
            <span>TOTAL</span>
            <strong>{loading ? '—' : fmtBrl(resumo.totalValor)}</strong>
          </div>
        </div>
        <p className="ck-estoque__contagem-sub">
          {contagem?.tipo === 'diaria'
            ? 'Produtos do estoque da loja'
            : contagem?.titulo || 'Contagem de insumos'}
          {contagem?.data_contagem
            ? ` · ${new Date(contagem.data_contagem + 'T12:00:00').toLocaleDateString('pt-BR')}`
            : ''}
          {contagem ? ` · ${resumo.preenchidos}/${resumo.total}` : ''}
          {editavel && (autoSalvando || salvando) ? ' · salvando…' : ''}
        </p>
        {!buscando && secaoAtual && (
          <div className="ck-estoque__secao-banner">
            <strong>{secaoAtual.nome}</strong>
            <span>
              {indiceSecao + 1}/{secoes.length} · {preenchidosSecaoAtual}/{totalSecaoAtual}
            </span>
          </div>
        )}
        {buscando && (
          <div className="ck-estoque__secao-banner ck-estoque__secao-banner--busca">
            <strong>BUSCA</strong>
            <span>{itensVisiveis.length} resultado(s)</span>
          </div>
        )}
        <div className="ck-estoque__busca-wrap">
          <input
            type="search"
            placeholder={
              contagem?.tipo === 'diaria'
                ? 'Buscar produto do estoque…'
                : 'Buscar em todas as seções…'
            }
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            disabled={loading || !contagem}
          />
        </div>
      </div>

      <div className="ck-visitas__scroll" ref={scrollRef}>
        <div className="ck-visitas__sheet ck-estoque__sheet-scroll">
          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}
          {loading && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          {!loading && contagem && (
            <>
              {itensVisiveis.map((i) => {
                const raw = rascunho[i.id_item] ?? { caixa: '', pc: '', kg: '' };
                const undCx = Number(i.und_convertida) > 0 ? Number(i.und_convertida) : 1;
                const undPc = Number(i.und_parcial) > 0 ? Number(i.und_parcial) : 1;
                const permite = permiteCampos(i);
                const contado = calcQtdTerraco(raw, undCx, undPc, permite);
                const totalLinha = calcTotalLinha(contado, Number(i.valor_unidade) || 0);
                const preenchido = contado != null && Number.isFinite(contado);
                const foraCmv = i.entra_cmv === false;
                return (
                  <div
                    key={i.id_item}
                    className={`ck-estoque__item ck-estoque__item--planilha${
                      preenchido ? ' is-ok' : ' is-pend'
                    }${foraCmv ? ' is-fora-cmv' : ''}`}
                  >
                    <div className="ck-estoque__item-head">
                      <span className="ck-estoque__cod">
                        {i.codigo || '—'}
                        {buscando ? ` · ${nomeSecao(i)}` : ''}
                        {foraCmv ? ' · fora CMV' : ''}
                      </span>
                      <span className="ck-estoque__linha-total">{fmtBrl(totalLinha)}</span>
                    </div>
                    <div className="ck-estoque__desc">{i.descricao}</div>

                    <div className="ck-estoque__vl-row" aria-label="Valores do sistema">
                      <div className="ck-estoque__vl">
                        <span>VL. CAIXA</span>
                        <strong>{fmtVl(i.preco_caixa)}</strong>
                      </div>
                      <div className="ck-estoque__vl">
                        <span>VL. UNIT.</span>
                        <strong>{fmtVl(i.valor_unidade)}</strong>
                      </div>
                    </div>

                    <div className="ck-estoque__row ck-estoque__row--tres">
                      {(
                        [
                          ['caixa', 'CAIXA', permite.caixa],
                          ['pc', 'PC / FD', permite.pc],
                          ['kg', 'KG / UND', permite.kg],
                        ] as const
                      ).map(([campo, label, liberado]) => (
                        <div
                          key={campo}
                          className={`ck-estoque__field${liberado ? '' : ' is-blocked'}`}
                        >
                          <label>{label}</label>
                          {!liberado ? (
                            <div className="ck-estoque__blocked" title="Não se aplica">
                              —
                            </div>
                          ) : editavel ? (
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
                              onFocus={(e) => {
                                e.target.select();
                                e.target.placeholder = '';
                              }}
                              onBlur={(e) => {
                                e.target.placeholder = '—';
                                if (dirtyRef.current) {
                                  if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
                                  void persistir({ silencioso: true }).catch(() => {});
                                }
                              }}
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
                  </div>
                );
              })}

              {!itensVisiveis.length && (
                <div className="ck-estoque__empty">
                  {buscando ? 'Nenhum insumo encontrado na busca.' : 'Nenhum insumo nesta seção.'}
                </div>
              )}

              {!editavel && podeReabrir && contagem.status === 'finalizada' && (
                <div className="ck-estoque__actions ck-estoque__actions--inline">
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

      {!loading && contagem && !buscando && secoes.length > 0 && (
        <nav className="ck-estoque__secao-dock" aria-label="Navegação das seções">
          <button
            type="button"
            className="ck-estoque__dock-side"
            disabled={indiceSecao <= 0 || salvando || finalizando}
            onClick={() => void irSecao(indiceSecao - 1)}
            aria-label="Seção anterior"
          >
            ←
          </button>
          {editavel && ultimaSecao ? (
            <button
              type="button"
              className="ck-estoque__dock-cta ck-estoque__dock-cta--ok"
              disabled={salvando || finalizando || autoSalvando}
              onClick={() => void finalizar()}
            >
              {finalizando ? 'Finalizando…' : 'Finalizar contagem'}
            </button>
          ) : (
            <button
              type="button"
              className="ck-estoque__dock-cta"
              disabled={ultimaSecao || salvando || finalizando}
              onClick={() => void irSecao(indiceSecao + 1)}
            >
              {secoes[indiceSecao + 1]?.nome
                ? `Próxima · ${secoes[indiceSecao + 1].nome}`
                : 'Próxima'}
            </button>
          )}
          <button
            type="button"
            className="ck-estoque__dock-side"
            disabled={ultimaSecao || salvando || finalizando}
            onClick={() => void irSecao(indiceSecao + 1)}
            aria-label="Próxima seção"
          >
            →
          </button>
        </nav>
      )}

      {dlgFinalizar && (
        <div className="ck-estoque__dlg-backdrop" role="presentation">
          <div className="ck-estoque__dlg" role="dialog" aria-modal="true">
            <h2>Finalizar com itens em branco?</h2>
            <p>
              {resumo.pendentes} insumo(s) sem número entram como 0. O restante que você
              preencheu permanece.
            </p>
            <div className="ck-estoque__dlg-actions">
              <button type="button" onClick={() => setDlgFinalizar(false)} disabled={finalizando} style={{ backgroundColor: 'transparent', color: '#64748b', border: '1px solid #cbd5e1' }}>
                Voltar
              </button>
              <button type="button" onClick={() => void finalizar()} disabled={finalizando} style={{ backgroundColor: '#B42318', color: '#fff', border: 'none', fontWeight: 600 }}>
                {finalizando ? 'Finalizando…' : 'Finalizar como 0'}
              </button>
            </div>
          </div>
        </div>
      )}

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
