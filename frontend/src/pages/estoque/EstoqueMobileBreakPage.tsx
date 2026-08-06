import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import {
  api,
  type EstoqueBreakResumo,
  type Loja,
  type ProdutoEstoque,
} from '../../api/client';
import CampoDataFrota, { dataHojeIso } from '../../components/frota/CampoDataFrota';
import EstoqueInsumoAutocomplete from '../../components/estoque/EstoqueInsumoAutocomplete';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';

const LOJA_STORAGE_KEY = 'estoque.id_loja';

function fmtDataBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function rotuloLoja(l: Loja) {
  return `${l.bk_number ? `${l.bk_number} · ` : ''}${l.name}`;
}

export default function EstoqueMobileBreakPage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(() => {
    const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
    return Number.isFinite(saved) && saved > 0 ? saved : '';
  });
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [lista, setLista] = useState<EstoqueBreakResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [err, setErr] = useState('');
  const [dlgLoja, setDlgLoja] = useState(false);
  const [buscaLoja, setBuscaLoja] = useState('');
  const [formAberto, setFormAberto] = useState(false);

  const [dataBreak, setDataBreak] = useState(dataHojeIso());
  const [motivo, setMotivo] = useState('');
  const [modo, setModo] = useState<'insumo' | 'venda'>('insumo');
  const [codigo, setCodigo] = useState('');
  const [qtde, setQtde] = useState('1');

  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;
  const lojasFiltradas = useMemo(() => {
    const q = buscaLoja.trim().toLowerCase();
    if (!q) return lojas;
    return lojas.filter((l) => rotuloLoja(l).toLowerCase().includes(q));
  }, [lojas, buscaLoja]);

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

  const carregar = useCallback(async (lojaId: number) => {
    setLoading(true);
    setErr('');
    try {
      const [breaks, prods] = await Promise.all([
        api.estoqueBreaks(lojaId),
        api.estoqueProdutos({ id_loja: lojaId }),
      ]);
      setLista(breaks);
      setProdutos(prods);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar break');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!idLoja) return;
    setFormAberto(false);
    void carregar(idLoja);
  }, [idLoja, carregar]);

  useEffect(() => {
    if (!dlgLoja) return;
    const scrollEl = document.querySelector('.ck-visitas__scroll') as HTMLElement | null;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    const prevScroll = scrollEl?.style.overflow ?? '';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (scrollEl) scrollEl.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      if (scrollEl) scrollEl.style.overflow = prevScroll;
    };
  }, [dlgLoja]);

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

  const abrirForm = () => {
    setDataBreak(dataHojeIso());
    setFormAberto(true);
  };

  const fecharForm = () => {
    setFormAberto(false);
    setMotivo('');
    setCodigo('');
    setQtde('1');
    setModo('insumo');
  };

  const ajustarQtde = (delta: number) => {
    const atual = Number(String(qtde).replace(',', '.'));
    const base = Number.isFinite(atual) ? atual : 0;
    const prox = Math.max(0, Math.round((base + delta) * 1000) / 1000);
    setQtde(String(prox));
  };

  const lancar = async () => {
    if (!idLoja) return;
    const quantidade = Number(String(qtde).replace(',', '.'));
    if (!codigo.trim() || !(quantidade > 0)) {
      showToast('Informe item e quantidade', 'error');
      return;
    }
    setSalvando(true);
    try {
      const item =
        modo === 'insumo'
          ? { codigo_insumo: codigo.trim().toUpperCase(), quantidade }
          : { codigo_venda: codigo.trim(), quantidade };
      await api.estoqueLancarBreak({
        id_loja: idLoja,
        data_break: dataBreak,
        motivo: motivo.trim() || undefined,
        itens: [item],
      });
      showToast('Break lançado — estoque baixado', 'success');
      fecharForm();
      await carregar(idLoja);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao lançar break', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const modalLoja =
    dlgLoja &&
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
    );

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
                  {formAberto ? (
                    <>
                      Novo
                      <br />
                      lançamento
                    </>
                  ) : (
                    <>
                      Break
                      <br />
                      de estoque
                    </>
                  )}
                </h1>
              </div>
              <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
            </div>
            <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
              {formAberto
                ? 'Preencha os dados e confirme a baixa no estoque.'
                : 'Consumo de colaboradores — baixa o estoque na hora.'}
            </p>
          </div>
        </div>

        <div className="ck-visitas__sheet ck-visitas__anim ck-visitas__anim--4">
          {err && (
            <p style={{ color: '#b91c1c', fontWeight: 600, fontSize: '0.85rem', margin: '0 0 12px' }}>
              {err}
            </p>
          )}

          <div className={`ck-estoque__loja${formAberto ? ' ck-estoque__loja--com-voltar' : ''}`}>
            {formAberto && (
              <button
                type="button"
                className="ck-estoque__voltar"
                aria-label="Voltar aos lançamentos"
                onClick={fecharForm}
              >
                ←
              </button>
            )}
            {formAberto ? (
              <div className="ck-estoque__loja-fix" aria-label="Loja selecionada">
                <StorefrontOutlinedIcon className="ck-estoque__loja-fix-icon" />
                <span>{lojaAtual ? rotuloLoja(lojaAtual) : 'Loja não selecionada'}</span>
              </div>
            ) : (
              <button type="button" className="ck-estoque__loja-btn" onClick={() => setDlgLoja(true)}>
                {lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}
                <span aria-hidden>▾</span>
              </button>
            )}
          </div>

          {!idLoja ? (
            <div className="ck-estoque__empty">Selecione a loja para ver e lançar break.</div>
          ) : formAberto ? (
            <div className="ck-estoque__break-form">
              <div className="ck-estoque__field ck-estoque__field--date">
                <CampoDataFrota label="Data" value={dataBreak} onChange={setDataBreak} />
              </div>
              <label className="ck-estoque__field">
                <span>Modo</span>
                <select
                  value={modo}
                  onChange={(e) => {
                    setModo(e.target.value as 'insumo' | 'venda');
                    setCodigo('');
                  }}
                >
                  <option value="insumo">Insumo direto</option>
                  <option value="venda">Produto de venda (via ficha)</option>
                </select>
              </label>
              {modo === 'insumo' ? (
                <div className="ck-estoque__field">
                  <span>Insumo</span>
                  <EstoqueInsumoAutocomplete
                    produtos={produtos}
                    value={codigo}
                    onChange={setCodigo}
                    hideLabel
                    disabled={salvando}
                  />
                </div>
              ) : (
                <label className="ck-estoque__field">
                  <span>Produto de venda (código BK)</span>
                  <input
                    type="text"
                    inputMode="text"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value)}
                    placeholder="Ex.: 1050"
                    autoComplete="off"
                  />
                </label>
              )}
              <div className="ck-estoque__field">
                <span>Quantidade</span>
                <div className="ck-estoque__qty">
                  <button
                    type="button"
                    className="ck-estoque__qty-btn"
                    aria-label="Diminuir quantidade"
                    disabled={salvando || Number(String(qtde).replace(',', '.')) <= 0}
                    onClick={() => ajustarQtde(-1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min="0"
                    value={qtde}
                    onChange={(e) => setQtde(e.target.value)}
                    aria-label="Quantidade"
                  />
                  <button
                    type="button"
                    className="ck-estoque__qty-btn"
                    aria-label="Aumentar quantidade"
                    disabled={salvando}
                    onClick={() => ajustarQtde(1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <label className="ck-estoque__field">
                <span>Motivo</span>
                <input
                  type="text"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Almoço colaborador…"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                className="ck-estoque__btn ck-estoque__btn--primary ck-estoque__btn--break-cta"
                disabled={salvando || loading}
                onClick={() => void lancar()}
              >
                {salvando ? 'Lançando…' : 'Confirmar baixa'}
              </button>
            </div>
          ) : (
            <>
              <p className="ck-visitas__section">Últimos lançamentos</p>
              {loading && <div className="ck-estoque__empty">Carregando…</div>}
              {!loading &&
                lista.map((b) => (
                  <div key={b.id_break} className="ck-estoque__card" style={{ cursor: 'default' }}>
                    <div className="ck-estoque__card-top">
                      <strong>
                        {fmtDataBR(b.data_break)} · {b.tipo}
                      </strong>
                      <span className="ck-estoque__chip ck-estoque__chip--ok">{b.itens ?? 0} itens</span>
                    </div>
                    <div className="ck-estoque__meta">
                      {b.motivo || 'Sem motivo'}
                      {b.criado_por_nome ? ` · ${b.criado_por_nome}` : ''}
                    </div>
                  </div>
                ))}
              {!loading && !lista.length && (
                <div className="ck-estoque__empty">Nenhum break lançado nesta loja.</div>
              )}

              <button
                type="button"
                className="ck-estoque__btn ck-estoque__btn--primary ck-estoque__btn--break-cta"
                disabled={loading}
                onClick={abrirForm}
              >
                Adicionar break
              </button>
            </>
          )}
        </div>
      </div>

      {modalLoja}
    </div>
  );
}
