import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Fab from '@mui/material/Fab';
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import {
  api,
  type EstoqueBreakResumo,
  type Loja,
  type ProdutoVendaEstoque,
} from '../../api/client';
import CampoDataFrota, { dataHojeIso } from '../../components/frota/CampoDataFrota';
import EstoqueProdutoVendaAutocomplete from '../../components/estoque/EstoqueProdutoVendaAutocomplete';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { getUsuario, lojaEstoqueTravadaMobile } from '../../lib/auth';
import { safeAreaRightCalc } from '../../theme/safeArea';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';

const LOJA_STORAGE_KEY = 'estoque.id_loja';

type BreakItemRascunho = {
  key: string;
  codigo: string;
  descricao: string;
  quantidade: number;
};

function fmtDataBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
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

export default function EstoqueMobileBreakPage() {
  const user = getUsuario();
  const lojaTravada = lojaEstoqueTravadaMobile(user);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(() => {
    const u = getUsuario();
    if (lojaEstoqueTravadaMobile(u) && u?.lojas?.[0]?.id_loja) return u.lojas[0].id_loja;
    if (u?.lojas?.length === 1) return u.lojas[0].id_loja;
    const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
    return Number.isFinite(saved) && saved > 0 ? saved : '';
  });
  const [produtosVenda, setProdutosVenda] = useState<ProdutoVendaEstoque[]>([]);
  const [colaboradores, setColaboradores] = useState<Array<{ id_usuario: number; nome: string }>>(
    [],
  );
  const [lista, setLista] = useState<EstoqueBreakResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [err, setErr] = useState('');
  const [dlgLoja, setDlgLoja] = useState(false);
  const [buscaLoja, setBuscaLoja] = useState('');
  const [busca, setBusca] = useState('');
  const [formAberto, setFormAberto] = useState(false);

  const [dataBreak, setDataBreak] = useState(dataHojeIso());
  const [colabSelect, setColabSelect] = useState('');
  const [idColaborador, setIdColaborador] = useState<number | ''>('');
  const [nomeColaborador, setNomeColaborador] = useState('');
  const [codigo, setCodigo] = useState('');
  const [itens, setItens] = useState<BreakItemRascunho[]>([]);
  const colabDigitado = colaboradores.length === 0 || colabSelect === '__outro__';

  const colabOptions = useMemo(() => {
    return [...colaboradores, { id_usuario: -1, nome: 'Outro (digitar nome)' }];
  }, [colaboradores]);

  const colabFilterOptions = useMemo(() => createFilterOptions<{ id_usuario: number; nome: string }>({
    stringify: (option) => option.nome || '',
  }), []);
  const nomeColabAtual =
    (idColaborador
      ? colaboradores.find((c) => c.id_usuario === idColaborador)?.nome
      : null) || nomeColaborador.trim();

  const podeTrocarLoja = !lojaTravada && lojas.length > 1;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;
  const lojasFiltradas = useMemo(() => {
    const q = buscaLoja.trim().toLowerCase();
    if (!q) return lojas;
    return lojas.filter((l) => rotuloLoja(l).toLowerCase().includes(q));
  }, [lojas, buscaLoja]);

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (b) =>
        String(b.motivo || '').toLowerCase().includes(q) ||
        String(b.colaborador_nome || '').toLowerCase().includes(q) ||
        String(b.criado_por_nome || '').toLowerCase().includes(q) ||
        fmtDataBR(b.data_break).includes(q),
    );
  }, [lista, busca]);

  const totalItens = useMemo(
    () => lista.reduce((s, b) => s + (Number(b.itens) || 0), 0),
    [lista],
  );

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

  const carregar = useCallback(async (lojaId: number) => {
    setLoading(true);
    setErr('');
    try {
      const [breaks, prods, cols] = await Promise.all([
        api.estoqueBreaks(lojaId),
        api.estoqueProdutosVenda({ id_loja: lojaId }),
        api.estoqueBreakColaboradores(lojaId),
      ]);
      setLista(breaks);
      setProdutosVenda(prods.filter((p) => p.ativo !== false));
      setColaboradores(cols);
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
    if (!podeTrocarLoja) return;
    setIdLoja(id);
    localStorage.setItem(LOJA_STORAGE_KEY, String(id));
    setDlgLoja(false);
    setBuscaLoja('');
  };

  const fecharDlgLoja = () => {
    setDlgLoja(false);
    setBuscaLoja('');
  };

  const limparForm = () => {
    setColabSelect('');
    setIdColaborador('');
    setNomeColaborador('');
    setCodigo('');
    setItens([]);
  };

  const abrirForm = () => {
    setDataBreak(dataHojeIso());
    limparForm();
    setFormAberto(true);
  };

  const fecharForm = () => {
    setFormAberto(false);
    limparForm();
  };

  const adicionarProduto = (cod: string, prod?: ProdutoVendaEstoque | null) => {
    const codigoSel = String(cod || '').trim();
    if (!codigoSel) {
      setCodigo('');
      return;
    }
    const descricao = String(prod?.descricao || '').trim() || codigoSel;
    setItens((prev) => {
      const existe = prev.find((i) => i.codigo === codigoSel);
      if (existe) {
        return prev.map((i) =>
          i.codigo === codigoSel
            ? { ...i, quantidade: Math.round((i.quantidade + 1) * 1000) / 1000 }
            : i,
        );
      }
      return [
        ...prev,
        {
          key: `${codigoSel}-${Date.now()}`,
          codigo: codigoSel,
          descricao,
          quantidade: 1,
        },
      ];
    });
    // Limpa o campo pra já escolher o próximo.
    setCodigo('');
  };

  const ajustarQtdeItem = (key: string, delta: number) => {
    setItens((prev) =>
      prev
        .map((i) => {
          if (i.key !== key) return i;
          const prox = Math.round((i.quantidade + delta) * 1000) / 1000;
          return { ...i, quantidade: prox };
        })
        .filter((i) => i.quantidade > 0),
    );
  };

  const removerItem = (key: string) => {
    setItens((prev) => prev.filter((i) => i.key !== key));
  };

  const lancar = async () => {
    if (!idLoja) return;
    if (!nomeColabAtual) {
      showToast('Informe o colaborador que pegará o break', 'error');
      return;
    }
    if (!itens.length) {
      showToast('Adicione pelo menos um produto', 'error');
      return;
    }
    setSalvando(true);
    try {
      await api.estoqueLancarBreak({
        id_loja: idLoja,
        data_break: dataBreak,
        id_colaborador: idColaborador || undefined,
        colaborador_nome: nomeColabAtual,
        itens: itens.map((i) => ({
          codigo_venda: i.codigo,
          quantidade: i.quantidade,
          descricao: i.descricao,
        })),
      });
      showToast(`Break lançado — ${itens.length} item(ns) baixados`, 'success');
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
    podeTrocarLoja &&
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

  if (formAberto) {
    return (
      <div className="ck-visitas ck-visitas--lista ck-estoque ck-estoque--contagem ck-estoque--break">
        <div className="ck-estoque__contagem-sticky">
          <div className="ck-estoque__contagem-banner" aria-live="polite">
            <button
              type="button"
              className="ck-estoque__contagem-back"
              aria-label="Voltar"
              onClick={fecharForm}
            >
              ←
            </button>
            <h1 className="ck-estoque__contagem-title">NOVO BREAK</h1>
            <div className="ck-estoque__contagem-total">
              <span>ITENS</span>
              <strong>{itens.length}</strong>
            </div>
          </div>
          <p className="ck-estoque__contagem-sub">
            {lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}
            {nomeColabAtual ? ` · ${nomeColabAtual}` : ''}
          </p>
        </div>

        <div className="ck-visitas__scroll">
          <div className="ck-visitas__sheet ck-estoque__sheet-scroll ck-estoque__break-form-sheet">
            <div className="ck-estoque__break-form ck-estoque__break-form--planilha">
              <div className="ck-estoque__field ck-estoque__field--date">
                <CampoDataFrota label="Data" value={dataBreak} onChange={setDataBreak} />
              </div>

              {colaboradores.length > 0 && (
                <label className="ck-estoque__field">
                  <span>Colaborador</span>
                  <Autocomplete
                    size="small"
                    options={colabOptions}
                    filterOptions={colabFilterOptions}
                    getOptionLabel={(option) => option.nome || ''}
                    isOptionEqualToValue={(option, value) => option.id_usuario === value.id_usuario}
                    renderOption={(props, option) => (
                      <li {...props} key={option.id_usuario}>
                        {option.nome}
                      </li>
                    )}
                    value={
                      colabSelect === '__outro__'
                        ? { id_usuario: -1, nome: 'Outro (digitar nome)' }
                        : colaboradores.find((c) => String(c.id_usuario) === String(colabSelect)) || null
                    }
                    onChange={(_e, val) => {
                      if (!val) {
                        setColabSelect('');
                        setIdColaborador('');
                        setNomeColaborador('');
                        return;
                      }
                      if (val.id_usuario === -1) {
                        setColabSelect('__outro__');
                        setIdColaborador('');
                        setNomeColaborador('');
                        return;
                      }
                      setColabSelect(String(val.id_usuario));
                      setIdColaborador(val.id_usuario);
                      setNomeColaborador(val.nome);
                    }}
                    disabled={salvando}
                    sx={{ width: '100%', mt: 0.5 }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Selecione ou digite..."
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                          }
                        }}
                      />
                    )}
                  />
                </label>
              )}

              {colabDigitado && (
                <label className="ck-estoque__field">
                  <span>Nome do colaborador</span>
                  <input
                    type="text"
                    value={nomeColaborador}
                    onChange={(e) => {
                      setIdColaborador('');
                      setColabSelect(colaboradores.length ? '__outro__' : '');
                      setNomeColaborador(e.target.value);
                    }}
                    placeholder="Quem pegará o break"
                    autoComplete="off"
                    disabled={salvando}
                  />
                </label>
              )}

              <div className="ck-estoque__field">
                <span>Produto</span>
                <EstoqueProdutoVendaAutocomplete
                  produtos={produtosVenda}
                  value={codigo}
                  onChange={adicionarProduto}
                  hideLabel
                  disabled={salvando}
                  placeholder="Digite ou escolha — já entra na lista"
                />
              </div>
            </div>

            {itens.length > 0 && (
              <div className="ck-estoque__break-itens">
                {itens.map((item) => (
                  <div
                    key={item.key}
                    className="ck-estoque__item ck-estoque__item--planilha is-ok"
                  >
                    <div className="ck-estoque__item-head">
                      <span className="ck-estoque__cod">{item.codigo}</span>
                      <button
                        type="button"
                        className="ck-estoque__break-remove"
                        aria-label="Remover item"
                        disabled={salvando}
                        onClick={() => removerItem(item.key)}
                      >
                        Remover
                      </button>
                    </div>
                    <div className="ck-estoque__desc">{item.descricao}</div>
                    <div className="ck-estoque__qty ck-estoque__qty--item">
                      <button
                        type="button"
                        className="ck-estoque__qty-btn"
                        aria-label="Diminuir"
                        disabled={salvando}
                        onClick={() => ajustarQtdeItem(item.key, -1)}
                      >
                        −
                      </button>
                      <span className="ck-estoque__qty-val" aria-label="Quantidade">
                        {item.quantidade}
                      </span>
                      <button
                        type="button"
                        className="ck-estoque__qty-btn"
                        aria-label="Aumentar"
                        disabled={salvando}
                        onClick={() => ajustarQtdeItem(item.key, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <nav className="ck-estoque__secao-dock" aria-label="Ações do break">
          <button
            type="button"
            className="ck-estoque__dock-side"
            disabled={salvando}
            onClick={fecharForm}
            aria-label="Cancelar"
          >
            ←
          </button>
          <button
            type="button"
            className="ck-estoque__dock-cta ck-estoque__dock-cta--ok"
            disabled={salvando || loading || !itens.length}
            onClick={() => void lancar()}
          >
            {salvando
              ? 'Lançando…'
              : itens.length
                ? `Confirmar baixa · ${itens.length}`
                : 'Confirmar baixa'}
          </button>
          <span className="ck-estoque__dock-side" aria-hidden style={{ visibility: 'hidden' }} />
        </nav>
      </div>
    );
  }

  return (
    <div className="ck-visitas ck-visitas--lista ck-estoque">
      <div className="ck-visitas__stage">
        <div className="ck-visitas__glow ck-visitas__glow--a" aria-hidden />
        <div className="ck-visitas__glow ck-visitas__glow--b" aria-hidden />
        <div className="ck-visitas__mesh" aria-hidden />
        <div className="ck-visitas__stage-inner">
          <div className="ck-visitas__hero-row ck-visitas__anim ck-visitas__anim--1">
            <div>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title">
                Break
                <br />
                da loja
              </h1>
            </div>
            <CkMarkLogoMenu size={72} className="ck-visitas__mark-icon" />
          </div>
          <p className="ck-visitas__sub ck-visitas__anim ck-visitas__anim--2">
            Informe o colaborador e o produto de venda. O estoque baixa na hora via ficha.
          </p>
          <div className="ck-visitas__metrics ck-visitas__metrics--row ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
            <div className="ck-visitas__metric">
              <strong>{loading ? '—' : lista.length}</strong>
              <span>lançamentos</span>
            </div>
            <div className="ck-visitas__metric ck-visitas__metric--accent">
              <strong>{loading ? '—' : totalItens}</strong>
              <span>itens baixados</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{lojaAtual?.bk_number || '—'}</strong>
              <span>loja</span>
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
            <div className="ck-estoque__loja">
              <button
                type="button"
                className="ck-estoque__loja-btn"
                onClick={() => setDlgLoja(true)}
              >
                <span>{lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}</span>
                <span aria-hidden>▾</span>
              </button>
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

          {idLoja ? (
            <div className="ck-estoque__busca-wrap" style={{ marginTop: 10 }}>
              <input
                type="search"
                placeholder="Buscar colaborador ou responsável…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                disabled={loading}
              />
            </div>
          ) : null}
        </div>

        <div className="ck-visitas__sheet-body">
          {loading && <LinearProgress sx={{ my: 1.5, borderRadius: 1 }} />}

          {!idLoja ? (
            <div className="ck-estoque__empty">Selecione a loja para começar.</div>
          ) : (
            <>
              {!loading && !listaFiltrada.length && (
                <div className="ck-estoque__empty">
                  {busca.trim()
                    ? 'Nenhum lançamento encontrado na busca.'
                    : 'Nenhum break nesta loja. Toque no + para lançar.'}
                </div>
              )}

              {!loading &&
                listaFiltrada.map((b) => (
                  <div key={b.id_break} className="ck-estoque__card">
                    <div className="ck-estoque__card-top">
                      <strong>{b.colaborador_nome || 'Colaborador não informado'}</strong>
                      <span className="ck-estoque__chip ck-estoque__chip--ok">
                        {b.itens ?? 0} itens
                      </span>
                    </div>
                    <div className="ck-estoque__meta">
                      {fmtDataBR(b.data_break)}
                      {b.motivo ? ` · ${b.motivo}` : ''}
                    </div>
                    <div className="ck-estoque__chips">
                      <span className="ck-estoque__chip">
                        {b.criado_por_nome ? `Por ${b.criado_por_nome}` : 'Lançado'}
                      </span>
                      {b.criado_em ? (
                        <span className="ck-estoque__chip">{fmtDataHora(b.criado_em)}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>

      {idLoja ? (
        <Fab
          aria-label="Novo break"
          onClick={abrirForm}
          disabled={loading}
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

      {modalLoja}
    </div>
  );
}
