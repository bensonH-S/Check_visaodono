import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import SyncAltOutlinedIcon from '@mui/icons-material/SyncAltOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  api,
  type EstoqueContagemResumo,
  type EstoqueMovimento,
  type EstoqueNfeResumo,
  type EstoqueSaldoItem,
  type Loja,
} from '../../api/client';
import { getUsuario, lojaEstoqueTravadaMobile, logout, primeiraRotaMobileApp } from '../../lib/auth';
import { assetUrl, LOGO_GA_LOCKUP } from '../../config/paths';
import MobileUsuarioMenu from '../../components/MobileUsuarioMenu';
import NotificacoesSino from '../../components/NotificacoesSino';
import { showToast } from '../../utils/toast';
import {
  CONTAGEM_SEMANAL_ATIVA,
  type TipoContagemEstoque,
} from '../../components/estoque/estoqueContagemTipo';
import {
  type AbaEstoqueHub,
  type FiltroInsumoHub,
  buscaInsumo,
  ehInsumoDiario,
  fmtQtdHub,
  nomeInsumoCurto,
  nomeLojaCurta,
  passaFiltroInsumo,
  rotuloStatusSaldo,
  statusSaldo,
  thumbInsumo,
} from '../../components/estoque/estoqueHub';
import '../../components/estoque/estoque-mobile.css';
import '../../components/estoque/estoque-hub.css';

function hojeIsoSp() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function labelIniciar(tipo: TipoContagemEstoque) {
  if (tipo === 'diaria') return 'Contagem diária';
  if (tipo === 'critica_semanal') return 'Contagem semanal (segunda)';
  return 'Contagem completa';
}

const LOJA_STORAGE_KEY = 'estoque.id_loja';

const ABAS: { id: AbaEstoqueHub; label: string; icon: typeof VisibilityOutlinedIcon }[] = [
  { id: 'visao', label: 'Visão', icon: VisibilityOutlinedIcon },
  { id: 'insumos', label: 'Insumos', icon: Inventory2OutlinedIcon },
  { id: 'nf', label: 'NF', icon: DescriptionOutlinedIcon },
  { id: 'movimentos', label: 'Movimentações', icon: SyncAltOutlinedIcon },
];

const CHIPS: { id: FiltroInsumoHub; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'zerados', label: 'Zerados' },
  { id: 'abaixo', label: 'Abaixo do mínimo' },
];

function nomeLoja(l: Loja) {
  return String(l.name || '').trim() || 'Loja';
}

function rotuloLoja(l: Loja) {
  const nome = nomeLoja(l);
  return l.bk_number ? `${l.bk_number} · ${nome}` : nome;
}

type FiltroNfHub = 'todas' | 'platlog' | 'coca';

function rotuloFornecedorHub(codigo: string | null | undefined, emitente?: string | null) {
  const f = String(codigo || '').toLowerCase();
  if (f === 'coca') return 'Coca-Cola';
  if (f === 'platlog') return 'Platlog';
  return String(emitente || codigo || 'Fornecedor').trim();
}

function fmtDataNf(iso: string | null | undefined) {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}`;
}

function buscaNf(n: EstoqueNfeResumo, q: string) {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return (
    String(n.emitente_nome || '').toLowerCase().includes(t) ||
    String(n.fornecedor || '').toLowerCase().includes(t) ||
    String(n.numero || '').toLowerCase().includes(t) ||
    String(n.id_nfe).includes(t)
  );
}

function passaFiltroNf(n: EstoqueNfeResumo, filtro: FiltroNfHub) {
  if (filtro === 'todas') return true;
  return String(n.fornecedor || '').toLowerCase() === filtro;
}

function rotuloGrupoHub(g: string | null | undefined) {
  const mapa: Record<string, string> = {
    carne: 'Carne',
    frango: 'Frango',
    queijo: 'Queijo',
    bacon: 'Bacon',
    pao: 'Pão',
    batata: 'Batata',
    oleo: 'Óleo',
    refil: 'Copo / xarope',
    vegetais: 'Vegetais',
    mix_sobremesa: 'Mix',
  };
  return mapa[String(g || '')] || g || '—';
}

function fmtQuando(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function InsumoRow({
  item,
  onClick,
}: {
  item: EstoqueSaldoItem;
  onClick?: () => void;
}) {
  const st = statusSaldo(item);
  return (
    <button type="button" className="ck-estoque-hub__row" onClick={onClick} title={item.descricao}>
      <span className="ck-estoque-hub__item">
        <img className="ck-estoque-hub__thumb" src={assetUrl(thumbInsumo(item))} alt="" />
        <span className="ck-estoque-hub__copy">
          <strong>{nomeInsumoCurto(item.descricao)}</strong>
          <small>
            {item.codigo}
            {item.unidade_contagem ? ` · ${String(item.unidade_contagem).toUpperCase()}` : ''}
          </small>
        </span>
      </span>
      <span className="ck-estoque-hub__qtd">{fmtQtdHub(item.quantidade, item.unidade_contagem)}</span>
      <span className={`ck-estoque-hub__status is-${st}`}>
        <i />
        {rotuloStatusSaldo(st)}
      </span>
      <ChevronRightIcon className="ck-estoque-hub__chev" sx={{ fontSize: 16 }} />
    </button>
  );
}

export default function EstoqueMobileListaPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [lista, setLista] = useState<EstoqueContagemResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const [err, setErr] = useState('');
  const [dlgLoja, setDlgLoja] = useState(false);
  const [dlgTipo, setDlgTipo] = useState(false);
  const [aba, setAba] = useState<AbaEstoqueHub>('visao');
  useEffect(() => {
    const next = (location.state as { aba?: AbaEstoqueHub } | null)?.aba;
    if (next) setAba(next);
  }, [location.state]);
  const [filtroInsumo, setFiltroInsumo] = useState<FiltroInsumoHub>('todos');
  const [busca, setBusca] = useState('');
  const [filtroNf, setFiltroNf] = useState<FiltroNfHub>('todas');
  const [saldos, setSaldos] = useState<EstoqueSaldoItem[]>([]);
  const [nfes, setNfes] = useState<EstoqueNfeResumo[]>([]);
  const [movimentos, setMovimentos] = useState<EstoqueMovimento[]>([]);
  const [itemAberto, setItemAberto] = useState<EstoqueSaldoItem | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!idLoja) return;
    let cancel = false;
    (async () => {
      try {
        const [saldoRows, nfeRows] = await Promise.all([
          api.estoqueSaldos(idLoja),
          api.estoqueNfes(idLoja, { pendentes: true, limit: 80 }),
        ]);
        if (cancel) return;
        setSaldos(saldoRows);
        setNfes(nfeRows);
      } catch (e) {
        if (!cancel) showToast(e instanceof Error ? e.message : 'Erro ao carregar estoque', 'error');
      }
    })();
    return () => {
      cancel = true;
    };
  }, [idLoja]);

  useEffect(() => {
    if (!idLoja || aba !== 'movimentos') return;
    let cancel = false;
    api
      .estoqueMovimentos(idLoja, { limit: 40 })
      .then((rows) => {
        if (!cancel) setMovimentos(rows);
      })
      .catch(() => {
        if (!cancel) setMovimentos([]);
      });
    return () => {
      cancel = true;
    };
  }, [idLoja, aba]);

  const diariaHoje = useMemo(() => {
    const hoje = hojeIsoSp();
    return lista.find((c) => c.tipo === 'diaria' && String(c.data_contagem || '').slice(0, 10) === hoje) || null;
  }, [lista]);
  const podeTrocarLoja = !lojaTravada && lojas.length > 1;
  const lojaAtual = lojas.find((l) => l.id_loja === idLoja) || null;
  const saldosDiarios = useMemo(() => saldos.filter(ehInsumoDiario), [saldos]);
  const zerados = useMemo(() => saldosDiarios.filter((i) => statusSaldo(i) === 'zerado'), [saldosDiarios]);
  const abaixo = useMemo(() => saldosDiarios.filter((i) => statusSaldo(i) === 'abaixo'), [saldosDiarios]);
  const insumosFiltrados = useMemo(
    () => saldosDiarios.filter((i) => buscaInsumo(i, busca) && passaFiltroInsumo(i, filtroInsumo)),
    [saldosDiarios, busca, filtroInsumo],
  );
  const nfesFiltradas = useMemo(
    () => nfes.filter((n) => buscaNf(n, busca) && passaFiltroNf(n, filtroNf)),
    [nfes, busca, filtroNf],
  );
  const nfContagem = useMemo(() => {
    let platlog = 0;
    let coca = 0;
    for (const n of nfes) {
      const f = String(n.fornecedor || '').toLowerCase();
      if (f === 'platlog') platlog += 1;
      if (f === 'coca') coca += 1;
    }
    return { platlog, coca, todas: nfes.length };
  }, [nfes]);
  const rotuloLojaCurta = lojaAtual
    ? nomeLojaCurta(nomeLoja(lojaAtual), lojaAtual.bk_number)
    : 'Selecionar loja';

  const iniciar = async (tipo: TipoContagemEstoque) => {
    if (!idLoja) return;
    if (tipo === 'critica_semanal' && !CONTAGEM_SEMANAL_ATIVA) {
      showToast('Contagem semanal está desativada', 'error');
      return;
    }
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

  function irParaInsumos(filtro?: FiltroInsumoHub) {
    if (filtro) setFiltroInsumo(filtro);
    setAba('insumos');
    window.setTimeout(() => buscaRef.current?.focus(), 50);
  }

  function abrirBusca() {
    setAba('insumos');
    window.setTimeout(() => buscaRef.current?.focus(), 50);
  }

  const listaInsumos = insumosFiltrados;

  return (
    <div className="ck-estoque-hub">
      <div className="ck-estoque-hub__scroll">
      <header className="ck-estoque-hub__top">
        <div className="ck-estoque-hub__brand-row">
          <img className="ck-estoque-hub__mark" src={assetUrl(LOGO_GA_LOCKUP)} alt="Grupo Alvim" />
          <div className="ck-estoque-hub__actions">
            <button type="button" className="ck-estoque-hub__icon-btn" aria-label="Buscar" onClick={abrirBusca}>
              <SearchIcon sx={{ fontSize: 22 }} />
            </button>
            <NotificacoesSino variante="mobile" contexto="chamados-mobile" />
            <MobileUsuarioMenu
              user={user}
              onLogout={() => {
                logout();
                navigate('/login/mobile');
              }}
            />
          </div>
        </div>

        <div className="ck-estoque-hub__store-row">
          <h1>Estoque</h1>
          <div className="ck-estoque-hub__loja-drop">
            <button
              type="button"
              className="ck-estoque-hub__store"
              disabled={!podeTrocarLoja}
              onClick={() => podeTrocarLoja && setDlgLoja((v) => !v)}
            >
              <span className="ck-estoque-hub__store-name">{rotuloLojaCurta}</span>
              {podeTrocarLoja ? <ExpandMoreIcon sx={{ fontSize: 18, color: '#8d8d8d' }} /> : null}
            </button>
            {dlgLoja && podeTrocarLoja ? (
              <div className="ck-estoque-hub__loja-list" role="listbox">
                {lojas.map((l) => (
                  <button
                    key={l.id_loja}
                    type="button"
                    className={`ck-estoque-hub__loja-item${l.id_loja === idLoja ? ' is-on' : ''}`}
                    onClick={() => {
                      setIdLoja(l.id_loja);
                      localStorage.setItem(LOJA_STORAGE_KEY, String(l.id_loja));
                      setDlgLoja(false);
                    }}
                  >
                    {rotuloLoja(l)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <nav className="ck-estoque-hub__tabs" aria-label="Estoque">
          {ABAS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`ck-estoque-hub__tab${aba === tab.id ? ' is-on' : ''}`}
                onClick={() => setAba(tab.id)}
              >
                <Icon sx={{ fontSize: 16 }} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="ck-estoque-hub__body">
        {err ? <p className="ck-estoque-hub__err">{err}</p> : null}
        {loading ? <LinearProgress sx={{ mb: 2, borderRadius: 1, bgcolor: '#222' }} /> : null}

        {aba === 'visao' || aba === 'insumos' ? (
          <>
            {aba === 'visao' ? (
              <div className="ck-estoque-hub__atencao">
                <div className="ck-estoque-hub__sec-head">
                  <div>
                    <h2>Atenção agora</h2>
                    <p>Principais pendências da loja.</p>
                  </div>
                  <button type="button" onClick={() => irParaInsumos()}>
                    Ver todos →
                  </button>
                </div>
                <div className="ck-estoque-hub__kpis">
                  <button type="button" className="ck-estoque-hub__kpi ck-estoque-hub__kpi--zero" onClick={() => irParaInsumos('zerados')}>
                    <span className="ck-estoque-hub__kpi-top">
                      <Inventory2OutlinedIcon />
                      <strong>{zerados.length}</strong>
                      <ChevronRightIcon />
                    </span>
                    <span>Itens zerados</span>
                  </button>
                  <button type="button" className="ck-estoque-hub__kpi ck-estoque-hub__kpi--low" onClick={() => irParaInsumos('abaixo')}>
                    <span className="ck-estoque-hub__kpi-top">
                      <WarningAmberOutlinedIcon />
                      <strong>{abaixo.length}</strong>
                      <ChevronRightIcon />
                    </span>
                    <span>Abaixo do mínimo</span>
                  </button>
                  <button type="button" className="ck-estoque-hub__kpi ck-estoque-hub__kpi--nf" onClick={() => setAba('nf')}>
                    <span className="ck-estoque-hub__kpi-top">
                      <DescriptionOutlinedIcon />
                      <strong>{nfes.length}</strong>
                      <ChevronRightIcon />
                    </span>
                    <span>NF pendente</span>
                  </button>
                </div>
              </div>
            ) : null}

            <div className="ck-estoque-hub__lock">
              <div className="ck-estoque-hub__sec-head">
                <div>
                  <h2>Insumos</h2>
                  <p>Contagem diária da loja.</p>
                </div>
              </div>
              <label className="ck-estoque-hub__search">
                <SearchIcon sx={{ fontSize: 18, color: '#6b6b6b' }} />
                <input
                  ref={buscaRef}
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar insumo, código ou marca..."
                />
                <TuneIcon sx={{ fontSize: 18, color: '#6b6b6b' }} />
              </label>
              <div className="ck-estoque-hub__chips">
                {CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`ck-estoque-hub__chip${filtroInsumo === chip.id ? ' is-on' : ''}`}
                    onClick={() => setFiltroInsumo(chip.id)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ck-estoque-hub__table">
              <div className="ck-estoque-hub__cols">
                <span>Insumo</span>
                <span>Saldo</span>
                <span>Status</span>
                <span />
              </div>
              <div className="ck-estoque-hub__lista">
                {!loading && !listaInsumos.length ? (
                  <p className="ck-estoque-hub__empty">Nenhum insumo neste filtro.</p>
                ) : (
                  listaInsumos.map((item) => (
                    <InsumoRow
                      key={item.id_insumo || item.id_produto}
                      item={item}
                      onClick={() => setItemAberto(item)}
                    />
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}

        {aba === 'nf' ? (
          <>
            <div className="ck-estoque-hub__lock">
              <div className="ck-estoque-hub__sec-head">
                <div>
                  <h2>Notas fiscais</h2>
                  <p>Pendentes de conferência.</p>
                </div>
              </div>
              <label className="ck-estoque-hub__search">
                <SearchIcon sx={{ fontSize: 18, color: '#6b6b6b' }} />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar NF, fornecedor ou número..."
                />
                <TuneIcon sx={{ fontSize: 18, color: '#6b6b6b' }} />
              </label>
              <div className="ck-estoque-hub__chips">
                {(
                  [
                    ['todas', `Todas (${nfContagem.todas})`],
                    ['platlog', `Platlog (${nfContagem.platlog})`],
                    ['coca', `Coca-Cola (${nfContagem.coca})`],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`ck-estoque-hub__chip${filtroNf === id ? ' is-on' : ''}`}
                    onClick={() => setFiltroNf(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="ck-estoque-hub__table ck-estoque-hub__table--nf">
              <div className="ck-estoque-hub__cols">
                <span>Nota</span>
                <span>Itens</span>
                <span />
              </div>
              <div className="ck-estoque-hub__lista">
                {!nfesFiltradas.length ? (
                  <p className="ck-estoque-hub__empty">Nenhuma NF pendente neste filtro.</p>
                ) : (
                  nfesFiltradas.map((n) => (
                    <button
                      key={n.id_nfe}
                      type="button"
                      className="ck-estoque-hub__row"
                      onClick={() => navigate(`/estoque/mobile/nfes/${n.id_nfe}`)}
                    >
                      <span className="ck-estoque-hub__item">
                        <span className="ck-estoque-hub__thumb ck-estoque-hub__thumb--nf">
                          <DescriptionOutlinedIcon />
                        </span>
                        <span className="ck-estoque-hub__copy">
                          <strong>{rotuloFornecedorHub(n.fornecedor, n.emitente_nome)}</strong>
                          <small>
                            {n.numero ? `Nº ${n.numero}` : `NF ${n.id_nfe}`}
                            {fmtDataNf(n.emissao) ? ` · ${fmtDataNf(n.emissao)}` : ''}
                          </small>
                        </span>
                      </span>
                      <span className="ck-estoque-hub__nf-side">
                        <strong>{n.itens ?? '—'}</strong>
                        <span className="ck-estoque-hub__status is-abaixo">
                          <i />
                          Pendente
                        </span>
                      </span>
                      <ChevronRightIcon className="ck-estoque-hub__chev" sx={{ fontSize: 16 }} />
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}

        {aba === 'movimentos' ? (
          <>
            <div className="ck-estoque-hub__lock">
              <div className="ck-estoque-hub__sec-head">
                <div>
                  <h2>Movimentações</h2>
                  <p>Últimas entradas e saídas.</p>
                </div>
              </div>
            </div>
            <div className="ck-estoque-hub__lista">
              {!movimentos.length ? (
                <p className="ck-estoque-hub__empty">Nenhuma movimentação recente.</p>
              ) : (
                movimentos.map((m) => (
                  <div key={m.id_movimento} className="ck-estoque-hub__move">
                    <div>
                      <strong>{m.descricao}</strong>
                      <small>
                        {m.tipo}
                        {m.criado_em
                          ? ` · ${new Date(m.criado_em).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : ''}
                      </small>
                    </div>
                    <strong>{fmtQtdHub(m.quantidade)}</strong>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
      </div>

      <nav className="ck-estoque-hub__dock" aria-label="Estoque">
        <button
          type="button"
          onClick={() => {
            const dest = user ? primeiraRotaMobileApp(user) : '/checklist/mobile';
            navigate(dest.startsWith('/estoque') ? '/checklist/mobile' : dest);
          }}
        >
          <HomeOutlinedIcon />
          Início
        </button>
        <button
          type="button"
          className={aba === 'visao' || aba === 'insumos' ? 'is-on' : ''}
          onClick={() => setAba('visao')}
        >
          <Inventory2OutlinedIcon />
          Estoque
        </button>
        <button
          type="button"
          className="ck-estoque-hub__dock-plus"
          aria-label="Nova contagem"
          disabled={!idLoja || iniciando}
          onClick={() => setDlgTipo(true)}
        >
          <AddIcon />
        </button>
        <button type="button" className={aba === 'nf' ? 'is-on' : ''} onClick={() => setAba('nf')}>
          <ShoppingCartOutlinedIcon />
          Pedidos
        </button>
      </nav>

      {itemAberto &&
        createPortal(
          <div className="ck-estoque-hub ck-estoque-hub--sheet">
            <button
              type="button"
              className="ck-estoque-hub__sheet-back"
              aria-label="Fechar"
              onClick={() => setItemAberto(null)}
            />
            <div className="ck-estoque-hub__sheet" role="dialog" aria-modal="true" aria-label={itemAberto.descricao}>
              <div className="ck-estoque-hub__sheet-handle" />
              <div className="ck-estoque-hub__sheet-head">
                <img src={assetUrl(thumbInsumo(itemAberto))} alt="" />
                <div>
                  <strong>{itemAberto.descricao}</strong>
                  <small>
                    {itemAberto.codigo}
                    {itemAberto.unidade_contagem ? ` · ${itemAberto.unidade_contagem}` : ''}
                  </small>
                </div>
              </div>
              <div className="ck-estoque-hub__sheet-grid">
                <div>
                  <span>Saldo</span>
                  <b>{fmtQtdHub(itemAberto.quantidade, itemAberto.unidade_contagem)}</b>
                </div>
                <div>
                  <span>Status</span>
                  <b>{rotuloStatusSaldo(statusSaldo(itemAberto))}</b>
                </div>
                <div>
                  <span>Grupo</span>
                  <b>{rotuloGrupoHub(itemAberto.grupo_diario)}</b>
                </div>
                <div>
                  <span>Atualizado</span>
                  <b>{fmtQuando(itemAberto.atualizado_em)}</b>
                </div>
              </div>
              <button type="button" className="ck-estoque-hub__sheet-fechar" onClick={() => setItemAberto(null)}>
                Fechar
              </button>
            </div>
          </div>,
          document.body,
        )}

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
                <p className="ck-estoque__confirm-text">Selecione o tipo de contagem:</p>
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
                  {CONTAGEM_SEMANAL_ATIVA && (
                    <button
                      type="button"
                      className="ck-estoque__modal-action-btn"
                      disabled={iniciando}
                      onClick={() => void iniciar('critica_semanal')}
                    >
                      <strong>Contagem semanal (segunda)</strong>
                      <small>Mix e latas</small>
                    </button>
                  )}
                  <button
                    type="button"
                    className="ck-estoque__modal-action-btn"
                    disabled={iniciando}
                    onClick={() => void iniciar('completa')}
                  >
                    <strong>Contagem completa</strong>
                    <small>Inventário geral da loja</small>
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
