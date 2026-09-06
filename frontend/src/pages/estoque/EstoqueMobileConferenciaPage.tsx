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
import {
  fracionadaInteira,
  modoEntradaEfetivo,
  parseNumCampoContagem,
  permiteCamposItem,
  podeInformarKg,
  qtdPreviewSeguro,
  rascunhoDeItemContagem,
  rotuloModoEntrada,
  sanitizarEntradaFracionada,
  sanitizarEntradaNaoNegativa,
  temEntradaTerraco,
  type ModoEntradaFracionada,
  type RascunhoContagem,
} from '../../components/estoque/estoqueContagemCampo';

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

type RascunhoLinha = RascunhoContagem;

function permiteCampos(i: EstoqueItem) {
  return permiteCamposItem(i);
}

function parseNumCampo(raw: string): number | null {
  return parseNumCampoContagem(raw);
}

function calcTotalLinha(qtd: number | null | undefined, valorUnidade: number): number | null {
  if (qtd == null || !Number.isFinite(qtd)) return null;
  return Math.round(qtd * (Number(valorUnidade) || 0) * 100) / 100;
}

function rascunhoDeItem(i: EstoqueItem): RascunhoLinha {
  return rascunhoDeItemContagem(i);
}

function rascunhoComZeros(
  itens: EstoqueItem[],
  draft: Record<number, RascunhoLinha>,
): Record<number, RascunhoLinha> {
  const next = { ...draft };
  for (const i of itens) {
    const p = permiteCampos(i);
    const line = next[i.id_item] || { caixa: '', pc: '', kg: '' };
    if (temEntradaTerraco(line, p)) continue;
    next[i.id_item] = {
      caixa: p.caixa ? (String(line.caixa).trim() === '' ? '0' : line.caixa) : '',
      pc: p.pc ? (String(line.pc).trim() === '' ? '0' : line.pc) : '',
      kg: p.kg ? (String(line.kg).trim() === '' ? '0' : line.kg) : '',
      modo: line.modo,
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

type CampoContagem = 'caixa' | 'pc' | 'kg';

type TecladoAtivo = {
  idItem: number;
  campo: CampoContagem;
  inteiro: boolean;
  substituir: boolean;
};

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
  const [teclado, setTeclado] = useState<TecladoAtivo | null>(null);
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
      const permite = permiteCampos(i);
      const raw = rascunho[i.id_item];
      const tem = temEntradaTerraco(raw, permite);
      const contado = qtdPreviewSeguro(i, raw, permite);
      const nome = nomeSecao(i);
      const st = porSecao.get(nome) || { pendentes: 0, total: 0 };
      st.total += 1;
      if (!tem) {
        pendentes += 1;
        st.pendentes += 1;
      } else {
        preenchidos += 1;
        if (i.entra_cmv !== false && contado != null) {
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
      const modo = modoEntradaEfetivo(i, raw);
      return {
        id_item: i.id_item,
        contagem_caixa: p.caixa ? parseNumCampo(raw.caixa) : null,
        contagem_pc_fd: p.pc ? parseNumCampo(raw.pc) : null,
        contagem_kg_und: p.kg ? parseNumCampo(raw.kg) : null,
        unidade_entrada: (modo === 'kg' ? 'KG' : 'UND') as 'UND' | 'KG',
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

  const setCampo = (idItem: number, campo: CampoContagem, valor: string) => {
    dirtyRef.current = true;
    setRascunho((prev) => ({
      ...prev,
      [idItem]: {
        caixa: prev[idItem]?.caixa ?? '',
        pc: prev[idItem]?.pc ?? '',
        kg: prev[idItem]?.kg ?? '',
        modo: prev[idItem]?.modo,
        [campo]: valor,
      },
    }));
    agendarAutosave();
  };

  const camposEditaveisVisiveis = useMemo(() => {
    if (!editavel) return [] as Array<{ idItem: number; campo: CampoContagem; inteiro: boolean }>;
    const out: Array<{ idItem: number; campo: CampoContagem; inteiro: boolean }> = [];
    for (const i of itensVisiveis) {
      const raw = rascunho[i.id_item] ?? { caixa: '', pc: '', kg: '', modo: 'und' as const };
      const permite = permiteCampos(i);
      const modo = modoEntradaEfetivo(i, raw);
      const inteiroFrac = fracionadaInteira(modo === 'kg' ? 'KG' : 'UND');
      if (permite.caixa) out.push({ idItem: i.id_item, campo: 'caixa', inteiro: true });
      if (permite.pc) out.push({ idItem: i.id_item, campo: 'pc', inteiro: true });
      if (permite.kg) out.push({ idItem: i.id_item, campo: 'kg', inteiro: inteiroFrac });
    }
    return out;
  }, [editavel, itensVisiveis, rascunho]);

  const abrirTeclado = (idItem: number, campo: CampoContagem, inteiro: boolean) => {
    setTeclado({ idItem, campo, inteiro, substituir: true });
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-estoque-item="${idItem}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const fecharTeclado = () => {
    setTeclado(null);
    if (dirtyRef.current) {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      void persistir({ silencioso: true }).catch(() => {});
    }
  };

  const irCampoVizinho = (delta: number) => {
    if (!teclado) return;
    const idx = camposEditaveisVisiveis.findIndex(
      (c) => c.idItem === teclado.idItem && c.campo === teclado.campo,
    );
    const next = idx >= 0 ? camposEditaveisVisiveis[idx + delta] : null;
    if (!next) {
      fecharTeclado();
      return;
    }
    setTeclado({
      idItem: next.idItem,
      campo: next.campo,
      inteiro: next.inteiro,
      substituir: true,
    });
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[data-estoque-item="${next.idItem}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const valorTecladoAtual = () => {
    if (!teclado) return '';
    const line = rascunho[teclado.idItem];
    return String(line?.[teclado.campo] ?? '');
  };

  const aplicarTeclado = (proximo: string) => {
    if (!teclado) return;
    const limpo =
      teclado.campo === 'kg'
        ? sanitizarEntradaFracionada(proximo, teclado.inteiro)
        : sanitizarEntradaNaoNegativa(proximo);
    setCampo(teclado.idItem, teclado.campo, limpo);
    setTeclado((t) => (t ? { ...t, substituir: false } : t));
  };

  const onTecla = (tecla: string) => {
    if (!teclado) return;
    const atual = valorTecladoAtual();
    if (tecla === 'back') {
      if (teclado.substituir || !atual) {
        aplicarTeclado('');
        setTeclado((t) => (t ? { ...t, substituir: false } : t));
        return;
      }
      aplicarTeclado(atual.slice(0, -1));
      return;
    }
    if (tecla === 'clear') {
      aplicarTeclado('');
      setTeclado((t) => (t ? { ...t, substituir: true } : t));
      return;
    }
    if (tecla === ',' || tecla === '.') {
      if (teclado.inteiro) return;
      const base = teclado.substituir ? '' : atual;
      if (base.includes(',') || base.includes('.')) return;
      aplicarTeclado(`${base || '0'},`);
      return;
    }
    if (!/^\d$/.test(tecla)) return;
    const base = teclado.substituir ? '' : atual;
    aplicarTeclado(`${base}${tecla}`);
  };

  const rotuloCampo = (campo: CampoContagem, item: EstoqueItem | undefined) => {
    if (campo === 'caixa') return 'CAIXA';
    if (campo === 'pc') return 'PC / FD';
    if (!item) return 'UND';
    const raw = rascunho[item.id_item] ?? { caixa: '', pc: '', kg: '', modo: 'und' as const };
    return rotuloModoEntrada(modoEntradaEfetivo(item, raw));
  };

  const setModoEntrada = (idItem: number, modo: ModoEntradaFracionada) => {
    dirtyRef.current = true;
    setRascunho((prev) => ({
      ...prev,
      [idItem]: {
        caixa: prev[idItem]?.caixa ?? '',
        pc: prev[idItem]?.pc ?? '',
        kg: '',
        modo,
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
    <div
      className={`ck-visitas ck-visitas--lista ck-estoque ck-estoque--contagem${
        teclado ? ' is-numpad' : ''
      }`}
    >
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
                const raw = rascunho[i.id_item] ?? { caixa: '', pc: '', kg: '', modo: 'und' as const };
                const permite = permiteCampos(i);
                const modo = modoEntradaEfetivo(i, raw);
                const rotuloFrac = rotuloModoEntrada(modo);
                const inteiroFrac = fracionadaInteira(modo === 'kg' ? 'KG' : 'UND');
                const mostraAtalhoKg = editavel && permite.kg && podeInformarKg(i);
                const contado = qtdPreviewSeguro(i, raw, permite);
                const totalLinha = calcTotalLinha(contado, Number(i.valor_unidade) || 0);
                const preenchido = temEntradaTerraco(raw, permite);
                const foraCmv = i.entra_cmv === false;
                return (
                  <div
                    key={i.id_item}
                    data-estoque-item={i.id_item}
                    className={`ck-estoque__item ck-estoque__item--planilha${
                      preenchido ? ' is-ok' : ' is-pend'
                    }${foraCmv ? ' is-fora-cmv' : ''}${
                      teclado?.idItem === i.id_item ? ' is-digitando' : ''
                    }`}
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
                          ['caixa', 'CAIXA', permite.caixa, false],
                          ['pc', 'PC / FD', permite.pc, false],
                          ['kg', rotuloFrac, permite.kg, inteiroFrac],
                        ] as const
                      ).map(([campo, label, liberado, inteiro]) => (
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
                            <button
                              type="button"
                              className={`ck-estoque__tap${
                                teclado?.idItem === i.id_item && teclado.campo === campo
                                  ? ' is-active'
                                  : ''
                              }${raw[campo] ? '' : ' is-empty'}`}
                              data-estoque-campo={campo}
                              onClick={() => abrirTeclado(i.id_item, campo, inteiro)}
                            >
                              {raw[campo] || '—'}
                            </button>
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
                          {campo === 'kg' && mostraAtalhoKg && (
                            <button
                              type="button"
                              className="ck-estoque__kg-hint"
                              onClick={() => setModoEntrada(i.id_item, modo === 'kg' ? 'und' : 'kg')}
                            >
                              {modo === 'kg' ? 'voltar p/ und' : 'informar em kg?'}
                            </button>
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

      <div className="ck-estoque__bottom-stack">
        {teclado &&
          (() => {
            const itemAtivo = (contagem?.itens || []).find((x) => x.id_item === teclado.idItem);
            const valor = valorTecladoAtual();
            const teclas = teclado.inteiro
              ? (['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const)
              : (['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'] as const);
            return (
              <div className="ck-estoque__numpad" role="group" aria-label="Teclado de contagem">
                <div className="ck-estoque__numpad-head">
                  <div className="ck-estoque__numpad-meta">
                    <strong>{rotuloCampo(teclado.campo, itemAtivo)}</strong>
                    <span>{itemAtivo?.descricao || itemAtivo?.codigo || ''}</span>
                  </div>
                  <div className={`ck-estoque__numpad-valor${teclado.substituir ? ' is-sel' : ''}`}>
                    {valor || '0'}
                  </div>
                  <button
                    type="button"
                    className="ck-estoque__numpad-x"
                    onClick={fecharTeclado}
                    aria-label="Fechar teclado"
                  >
                    ✕
                  </button>
                </div>
                <div className="ck-estoque__numpad-grid">
                  {teclas.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`ck-estoque__numpad-key${
                        t === 'back' || t === 'clear' ? ' is-muted' : ''
                      }`}
                      onClick={() => onTecla(t === 'clear' ? 'clear' : t === 'back' ? 'back' : t)}
                    >
                      {t === 'back' ? '⌫' : t === 'clear' ? 'C' : t}
                    </button>
                  ))}
                </div>
                <div className="ck-estoque__numpad-actions">
                  <button type="button" className="ck-estoque__numpad-act" onClick={fecharTeclado}>
                    OK
                  </button>
                  <button
                    type="button"
                    className="ck-estoque__numpad-act is-primary"
                    onClick={() => irCampoVizinho(1)}
                  >
                    Próximo campo
                  </button>
                </div>
              </div>
            );
          })()}

        {!loading && contagem && !buscando && secoes.length > 0 && (
          <nav className="ck-estoque__secao-dock" aria-label="Navegação das seções">
            <button
              type="button"
              className="ck-estoque__dock-side"
              disabled={indiceSecao <= 0 || salvando || finalizando}
              onClick={() => {
                setTeclado(null);
                void irSecao(indiceSecao - 1);
              }}
              aria-label="Seção anterior"
            >
              ←
            </button>
            {editavel && ultimaSecao ? (
              <button
                type="button"
                className="ck-estoque__dock-cta ck-estoque__dock-cta--ok"
                disabled={salvando || finalizando || autoSalvando}
                onClick={() => {
                  setTeclado(null);
                  void finalizar();
                }}
              >
                {finalizando ? 'Finalizando…' : 'Finalizar contagem'}
              </button>
            ) : (
              <button
                type="button"
                className="ck-estoque__dock-cta"
                disabled={ultimaSecao || salvando || finalizando}
                onClick={() => {
                  setTeclado(null);
                  void irSecao(indiceSecao + 1);
                }}
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
              onClick={() => {
                setTeclado(null);
                void irSecao(indiceSecao + 1);
              }}
              aria-label="Próxima seção"
            >
              →
            </button>
          </nav>
        )}
      </div>

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
