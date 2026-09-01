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
  type EstoqueEmprestimoAReceber,
  type Loja,
  type ProdutoEstoque,
  type ProdutoVendaEstoque,
} from '../../api/client';
import CampoDataFrota, { dataHojeIso } from '../../components/frota/CampoDataFrota';
import EstoqueProdutoVendaAutocomplete from '../../components/estoque/EstoqueProdutoVendaAutocomplete';
import EstoqueInsumoAutocomplete from '../../components/estoque/EstoqueInsumoAutocomplete';
import CkMarkLogoMenu from '../../components/CkMarkLogoMenu';
import { getUsuario, lojaEstoqueTravadaMobile } from '../../lib/auth';
import { safeAreaRightCalc } from '../../theme/safeArea';
import { showToast } from '../../utils/toast';
import '../../components/visitas/visitas-mobile.css';
import '../../components/estoque/estoque-mobile.css';

const LOJA_STORAGE_KEY = 'estoque.id_loja';

type KindLanc = 'refeicao' | 'desperdicio_completo' | 'desperdicio_incompleto' | 'emprestimo';

const KINDS: Array<{ id: KindLanc; label: string }> = [
  { id: 'refeicao', label: 'Break' },
  { id: 'desperdicio_completo', label: 'Desperdício completo' },
  { id: 'desperdicio_incompleto', label: 'Desperdício incompleto' },
  { id: 'emprestimo', label: 'Empréstimo' },
];

const TURNOS = [
  { id: 'manha', label: 'Manhã' },
  { id: 'tarde', label: 'Tarde' },
  { id: 'noite', label: 'Noite' },
];

type BreakItemRascunho = {
  key: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  origem: 'venda' | 'insumo';
  caixa: string;
  pc: string;
  kg: string;
};

function parseCampoQtd(raw: string): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function permiteCamposInsumo(i?: ProdutoEstoque | null) {
  return {
    caixa: i?.permite_contagem_caixa !== false,
    pc: i?.permite_contagem_pc_fd !== false,
    kg: i?.permite_contagem_kg_und !== false,
  };
}

function itemEmprestimoPreenchido(item: BreakItemRascunho, ins?: ProdutoEstoque | null) {
  const p = permiteCamposInsumo(ins);
  return (
    (p.caixa && String(item.caixa).trim() !== '') ||
    (p.pc && String(item.pc).trim() !== '') ||
    (p.kg && String(item.kg).trim() !== '')
  );
}

function rotuloQtdEmprestimo(item: {
  quantidade?: number | null;
  contagem_caixa?: number | null;
  contagem_pc_fd?: number | null;
  contagem_kg_und?: number | null;
}) {
  const partes: string[] = [];
  if (item.contagem_caixa != null && Number(item.contagem_caixa) !== 0) {
    partes.push(`${item.contagem_caixa} cx`);
  }
  if (item.contagem_pc_fd != null && Number(item.contagem_pc_fd) !== 0) {
    partes.push(`${item.contagem_pc_fd} pct`);
  }
  if (item.contagem_kg_und != null && Number(item.contagem_kg_und) !== 0) {
    partes.push(`${item.contagem_kg_und} kg/und`);
  }
  if (partes.length) return partes.join(' · ');
  return item.quantidade != null ? String(item.quantidade) : '—';
}

function labelTipo(tipo?: string | null) {
  if (tipo === 'desperdicio_completo') return 'Desperdício completo';
  if (tipo === 'desperdicio_incompleto') return 'Desperdício incompleto';
  if (tipo === 'emprestimo') return 'Empréstimo';
  return 'Break';
}

function labelTurno(turno?: string | null) {
  if (turno === 'manha') return 'Manhã';
  if (turno === 'tarde') return 'Tarde';
  if (turno === 'noite') return 'Noite';
  return '';
}

function tituloForm(kind: KindLanc) {
  if (kind === 'desperdicio_completo') return 'DESPERDÍCIO COMPLETO';
  if (kind === 'desperdicio_incompleto') return 'DESPERDÍCIO INCOMPLETO';
  if (kind === 'emprestimo') return 'EMPRÉSTIMO';
  return 'NOVO BREAK';
}

function fmtBrl(v: number | null | undefined) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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
  const [lojasDestino, setLojasDestino] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(() => {
    const u = getUsuario();
    if (lojaEstoqueTravadaMobile(u) && u?.lojas?.[0]?.id_loja) return u.lojas[0].id_loja;
    if (u?.lojas?.length === 1) return u.lojas[0].id_loja;
    const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
    return Number.isFinite(saved) && saved > 0 ? saved : '';
  });
  const [produtosVenda, setProdutosVenda] = useState<ProdutoVendaEstoque[]>([]);
  const [insumos, setInsumos] = useState<ProdutoEstoque[]>([]);
  const [motivos, setMotivos] = useState<Array<{ codigo: string; nome: string }>>([]);
  const [colaboradores, setColaboradores] = useState<Array<{ id_usuario: number; nome: string }>>(
    [],
  );
  const [lista, setLista] = useState<EstoqueBreakResumo[]>([]);
  const [aReceber, setAReceber] = useState<EstoqueEmprestimoAReceber[]>([]);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [err, setErr] = useState('');
  const [dlgLoja, setDlgLoja] = useState(false);
  const [buscaLoja, setBuscaLoja] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | KindLanc>('todos');
  const [dlgTipo, setDlgTipo] = useState(false);
  const [resumoMes, setResumoMes] = useState<{
    valor_break_mes: number | null;
    valor_desperdicio_mes: number | null;
  } | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const [dataBreak, setDataBreak] = useState(dataHojeIso());
  const [kind, setKind] = useState<KindLanc>('refeicao');
  const [turno, setTurno] = useState('');
  const [motivoCodigo, setMotivoCodigo] = useState('');
  const [idLojaDestino, setIdLojaDestino] = useState<number | ''>('');
  const [colabSelect, setColabSelect] = useState('');
  const [idColaborador, setIdColaborador] = useState<number | ''>('');
  const [nomeColaborador, setNomeColaborador] = useState('');
  const [codigo, setCodigo] = useState('');
  const [itens, setItens] = useState<BreakItemRascunho[]>([]);
  const usaInsumo = kind === 'desperdicio_incompleto' || kind === 'emprestimo';
  const exigeColab = kind === 'refeicao';
  const exigeTurno = kind !== 'emprestimo';
  const exigeMotivo = kind === 'desperdicio_completo' || kind === 'desperdicio_incompleto';
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
    const porTipo =
      filtroTipo === 'todos'
        ? lista
        : lista.filter((b) => (b.tipo || 'refeicao') === filtroTipo);
    const q = busca.trim().toLowerCase();
    if (!q) return porTipo;
    return porTipo.filter(
      (b) =>
        String(b.motivo || '').toLowerCase().includes(q) ||
        String(b.colaborador_nome || '').toLowerCase().includes(q) ||
        String(b.criado_por_nome || '').toLowerCase().includes(q) ||
        labelTipo(b.tipo).toLowerCase().includes(q) ||
        labelTurno(b.turno).toLowerCase().includes(q) ||
        fmtDataBR(b.data_break).includes(q),
    );
  }, [lista, busca, filtroTipo]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [rows, destinos] = await Promise.all([
          api.estoqueLojas({ ativas: true, operacionais: true }),
          api.estoqueLojasDestinoEmprestimo().catch(() => [] as Loja[]),
        ]);
        if (cancel) return;
        setLojas(rows);
        setLojasDestino(destinos);
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
      const [breaks, cols, resumo, pendentes] = await Promise.all([
        api.estoqueBreaks(lojaId),
        api.estoqueBreakColaboradores(lojaId),
        api.estoqueResumoMes(lojaId).catch(() => null),
        api.estoqueEmprestimosAReceber(lojaId).catch(() => [] as EstoqueEmprestimoAReceber[]),
      ]);
      setLista(breaks);
      setColaboradores(cols);
      setAReceber(pendentes);
      setResumoMes(
        resumo
          ? { valor_break_mes: resumo.valor_break_mes, valor_desperdicio_mes: resumo.valor_desperdicio_mes }
          : null,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar break');
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarCatalogo = useCallback(async (lojaId: number, tipo: KindLanc) => {
    try {
      const cat = await api.estoqueBreakCatalogo(lojaId, tipo);
      setProdutosVenda((cat.produtos || []).filter((p) => p.ativo !== false));
      setInsumos((cat.insumos || []).filter((p) => p.ativo !== false));
      setMotivos(cat.motivos || []);
    } catch {
      setProdutosVenda([]);
      setInsumos([]);
      setMotivos([]);
    }
  }, []);

  useEffect(() => {
    if (!idLoja) return;
    setFormAberto(false);
    void carregar(idLoja);
  }, [idLoja, carregar]);

  useEffect(() => {
    if (!idLoja) return;
    void carregarCatalogo(idLoja, kind);
  }, [idLoja, kind, carregarCatalogo]);

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
  }, [dlgLoja, dlgTipo]);

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
    setTurno('');
    setMotivoCodigo('');
    setIdLojaDestino('');
  };

  const escolherKind = (prox: KindLanc) => {
    setKind(prox);
    setCodigo('');
    setItens([]);
    setMotivoCodigo('');
    setIdLojaDestino('');
  };

  const abrirForm = (tipo?: KindLanc) => {
    if (tipo) setKind(tipo);
    setDataBreak(dataHojeIso());
    limparForm();
    setDlgTipo(false);
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
          origem: 'venda' as const,
          caixa: '',
          pc: '',
          kg: '',
        },
      ];
    });
    // Limpa o campo pra já escolher o próximo.
    setCodigo('');
  };

  const adicionarInsumo = (cod: string) => {
    const codigoSel = String(cod || '').trim();
    if (!codigoSel) {
      setCodigo('');
      return;
    }
    const ins = insumos.find(
      (p) => String(p.codigo || '').trim().toUpperCase() === codigoSel.toUpperCase(),
    );
    const descricao = String(ins?.descricao || '').trim() || codigoSel;
    setItens((prev) => {
      const existe = prev.find((i) => i.codigo === codigoSel && i.origem === 'insumo');
      if (existe) {
        return prev;
      }
      return [
        ...prev,
        {
          key: `${codigoSel}-${Date.now()}`,
          codigo: codigoSel,
          descricao,
          quantidade: 1,
          origem: 'insumo',
          caixa: '',
          pc: '',
          kg: '',
        },
      ];
    });
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

  const setCampoItem = (key: string, campo: 'caixa' | 'pc' | 'kg', valor: string) => {
    setItens((prev) => prev.map((i) => (i.key === key ? { ...i, [campo]: valor } : i)));
  };

  const confirmarRecebimento = async (idBreak: number) => {
    if (!idLoja) return;
    setConfirmandoId(idBreak);
    try {
      await api.estoqueConfirmarRecebimentoEmprestimo(idBreak, idLoja);
      showToast('Recebimento confirmado — saldo atualizado');
      await carregar(idLoja);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível confirmar', 'error');
    } finally {
      setConfirmandoId(null);
    }
  };

  const lancar = async () => {
    if (!idLoja) return;
    if (exigeColab && !nomeColabAtual) {
      showToast('Informe o colaborador que pegará o break', 'error');
      return;
    }
    if (exigeTurno && !turno) {
      showToast('Informe o turno', 'error');
      return;
    }
    if (exigeMotivo && !motivoCodigo) {
      showToast('Informe o motivo do desperdício', 'error');
      return;
    }
    if (kind === 'emprestimo' && !idLojaDestino) {
      showToast('Informe a loja que vai receber', 'error');
      return;
    }
    if (kind === 'emprestimo') {
      const falta = itens.find((i) => {
        const ins = insumos.find(
          (p) => String(p.codigo || '').trim().toUpperCase() === i.codigo.toUpperCase(),
        );
        return !itemEmprestimoPreenchido(i, ins);
      });
      if (falta) {
        showToast('Em cada item informe caixa, pct ou kg/und', 'error');
        return;
      }
    }
    if (!itens.length) {
      showToast('Adicione pelo menos um produto', 'error');
      return;
    }
    setSalvando(true);
    try {
      const motivoNome = motivos.find((m) => m.codigo === motivoCodigo)?.nome || undefined;
      await api.estoqueLancarBreak({
        id_loja: idLoja,
        data_break: dataBreak,
        tipo: kind,
        turno: turno || undefined,
        motivo: motivoNome,
        motivo_codigo: motivoCodigo || undefined,
        id_colaborador: Number(idColaborador) > 0 ? Number(idColaborador) : undefined,
        colaborador_nome: nomeColabAtual || undefined,
        id_loja_destino: idLojaDestino || undefined,
        itens: itens.map((i) =>
          i.origem === 'insumo'
            ? {
                codigo_insumo: i.codigo,
                descricao: i.descricao,
                quantidade: i.quantidade,
                contagem_caixa: parseCampoQtd(i.caixa),
                contagem_pc_fd: parseCampoQtd(i.pc),
                contagem_kg_und: parseCampoQtd(i.kg),
              }
            : { codigo_venda: i.codigo, quantidade: i.quantidade, descricao: i.descricao },
        ),
      });
      showToast(
        kind === 'emprestimo'
          ? 'Empréstimo enviado — a outra loja confirma o recebimento'
          : kind === 'refeicao'
            ? `Break lançado — ${itens.length} item(ns) baixados`
            : `${labelTipo(kind)} lançado`,
        'success',
      );
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
            <h1 className="ck-estoque__contagem-title">{tituloForm(kind)}</h1>
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
              <div className="ck-estoque__seg" role="tablist" aria-label="Tipo de lançamento">
                {KINDS.map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    role="tab"
                    aria-selected={kind === k.id}
                    className={`ck-estoque__seg-btn${kind === k.id ? ' is-on' : ''}`}
                    disabled={salvando}
                    onClick={() => escolherKind(k.id)}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              <div className="ck-estoque__field ck-estoque__field--date">
                <CampoDataFrota label="Data" value={dataBreak} onChange={setDataBreak} />
              </div>

              {kind === 'emprestimo' && (
                <label className="ck-estoque__field">
                  <span>Loja que recebe</span>
                  <select
                    value={idLojaDestino === '' ? '' : String(idLojaDestino)}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setIdLojaDestino(Number.isFinite(n) && n > 0 ? n : '');
                    }}
                    disabled={salvando}
                  >
                    <option value="">Selecione a loja…</option>
                    {lojasDestino
                      .filter((l) => l.id_loja !== idLoja)
                      .map((l) => (
                        <option key={l.id_loja} value={l.id_loja}>
                          {rotuloLoja(l)}
                        </option>
                      ))}
                  </select>
                  <small style={{ display: 'block', marginTop: 6, color: 'rgba(15,26,69,0.55)' }}>
                    A loja destino confirma com OK — recebi. Só então o estoque entra.
                  </small>
                </label>
              )}

              {exigeTurno && (
                <div className="ck-estoque__field">
                  <span>Turno</span>
                  <div className="ck-estoque__turno">
                    {TURNOS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`ck-estoque__turno-btn${turno === t.id ? ' is-on' : ''}`}
                        disabled={salvando}
                        onClick={() => setTurno(t.id)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {exigeColab && colaboradores.length > 0 && (
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

              {exigeColab && colabDigitado && (
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

              {exigeMotivo && (
                <label className="ck-estoque__field">
                  <span>Motivo</span>
                  <select
                    value={motivoCodigo}
                    onChange={(e) => setMotivoCodigo(e.target.value)}
                    disabled={salvando}
                  >
                    <option value="">Selecione…</option>
                    {motivos.map((m) => (
                      <option key={m.codigo} value={m.codigo}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="ck-estoque__field">
                <span>{usaInsumo ? 'Mercadoria' : 'Produto'}</span>
                {usaInsumo ? (
                  <EstoqueInsumoAutocomplete
                    produtos={insumos}
                    value={codigo}
                    onChange={adicionarInsumo}
                    hideLabel
                    disabled={salvando}
                    placeholder="Digite ou escolha — já entra na lista"
                  />
                ) : (
                  <EstoqueProdutoVendaAutocomplete
                    produtos={produtosVenda}
                    value={codigo}
                    onChange={adicionarProduto}
                    hideLabel
                    disabled={salvando}
                    placeholder="Digite ou escolha — já entra na lista"
                  />
                )}
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
                    {kind === 'emprestimo' ? (
                      <div className="ck-estoque__row ck-estoque__row--tres">
                        {(
                          [
                            ['caixa', 'CAIXA', 'caixa'] as const,
                            ['pc', 'PCT', 'pc'] as const,
                            ['kg', 'KG / UND', 'kg'] as const,
                          ]
                        ).map(([campo, label, keyCampo]) => {
                          const ins = insumos.find(
                            (p) =>
                              String(p.codigo || '').trim().toUpperCase() ===
                              item.codigo.toUpperCase(),
                          );
                          const lib = permiteCamposInsumo(ins)[keyCampo];
                          return (
                            <div
                              key={campo}
                              className={`ck-estoque__field${lib ? '' : ' is-blocked'}`}
                            >
                              <label>{label}</label>
                              {!lib ? (
                                <div className="ck-estoque__blocked">—</div>
                              ) : (
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="any"
                                  min="0"
                                  placeholder="—"
                                  disabled={salvando}
                                  value={item[campo]}
                                  onChange={(e) => setCampoItem(item.key, campo, e.target.value)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
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
                    )}
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
              ? 'Enviando…'
              : kind === 'emprestimo'
                ? itens.length
                  ? `Enviar empréstimo · ${itens.length}`
                  : 'Enviar empréstimo'
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
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <p className="ck-visitas__mark-text">Grupo Alvim</p>
              <h1 className="ck-visitas__title">
                Break e perdas
              </h1>
              <p className="ck-visitas__sub">
                Registro de perdas operacionais, descarte e refeição da equipe.
              </p>
            </div>
            <CkMarkLogoMenu size={78} className="ck-visitas__mark-icon" />
          </div>
          <div className="ck-visitas__metrics ck-visitas__metrics--row ck-visitas__anim ck-visitas__anim--3" aria-live="polite">
            <div className="ck-visitas__metric ck-visitas__metric--accent">
              <strong style={{ fontSize: '0.95rem' }}>
                {loading ? '—' : fmtBrl(resumoMes?.valor_break_mes)}
              </strong>
              <span>break mês</span>
            </div>
            <div className="ck-visitas__metric">
              <strong style={{ fontSize: '0.95rem' }}>
                {loading ? '—' : fmtBrl(resumoMes?.valor_desperdicio_mes)}
              </strong>
              <span>desperdício</span>
            </div>
            <div className="ck-visitas__metric">
              <strong>{loading ? '—' : lista.length}</strong>
              <span>lançamentos</span>
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
            <div className="ck-visitas__seg" role="tablist" style={{ marginTop: 10 }}>
              {(
                [
                  ['todos', 'Todos'],
                  ['refeicao', 'Break'],
                  ['desperdicio_completo', 'Completo'],
                  ['desperdicio_incompleto', 'Incompleto'],
                  ['emprestimo', 'Empréstimo'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={filtroTipo === value}
                  className={`ck-visitas__seg-btn${filtroTipo === value ? ' is-on' : ''}`}
                  onClick={() => setFiltroTipo(value)}
                >
                  {label}
                </button>
              ))}
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
              {!loading && aReceber.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                  {aReceber.map((emp) => (
                    <div key={emp.id_break} className="ck-estoque__card" style={{ borderColor: '#E8520A' }}>
                      <div className="ck-estoque__card-top">
                        <strong>
                          Receber de{' '}
                          {emp.loja_origem_bk
                            ? `${emp.loja_origem_bk} · ${emp.loja_origem_nome}`
                            : emp.loja_origem_nome || 'outra loja'}
                        </strong>
                        <span className="ck-estoque__chip ck-estoque__chip--ok">
                          {(emp.itens || []).length} itens
                        </span>
                      </div>
                      <div className="ck-estoque__meta">
                        {fmtDataBR(emp.data_break)}
                        {emp.criado_por_nome ? ` · ${emp.criado_por_nome}` : ''}
                      </div>
                      {(emp.itens || []).map((it, idx) => (
                        <div key={`${emp.id_break}-${idx}`} className="ck-estoque__desc" style={{ marginTop: 6 }}>
                          {it.codigo} · {it.descricao} · {rotuloQtdEmprestimo(it)}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="ck-estoque__dock-cta ck-estoque__dock-cta--ok"
                        style={{ marginTop: 10, width: '100%', position: 'static' }}
                        disabled={confirmandoId === emp.id_break}
                        onClick={() => void confirmarRecebimento(emp.id_break)}
                      >
                        {confirmandoId === emp.id_break ? 'Confirmando…' : 'OK — recebi'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {!loading && !listaFiltrada.length && (
                <div className="ck-estoque__empty">
                  {busca.trim()
                    ? 'Nenhum lançamento encontrado na busca.'
                    : filtroTipo === 'desperdicio_completo'
                      ? 'Nenhum desperdício completo. Toque no + para lançar.'
                      : filtroTipo === 'desperdicio_incompleto'
                        ? 'Nenhum desperdício incompleto. Toque no + para lançar.'
                        : 'Nenhum lançamento nesta loja. Toque no + e escolha o tipo.'}
                </div>
              )}

              {!loading &&
                listaFiltrada.map((b) => (
                  <div key={b.id_break} className="ck-estoque__card">
                    <div className="ck-estoque__card-top">
                      <strong>
                        {b.tipo === 'emprestimo'
                          ? b.loja_destino_nome
                            ? `Para ${b.loja_destino_bk ? `${b.loja_destino_bk} · ` : ''}${b.loja_destino_nome}`
                            : 'Empréstimo'
                          : b.colaborador_nome || labelTipo(b.tipo)}
                      </strong>
                      <span className="ck-estoque__chip ck-estoque__chip--ok">
                        {b.itens ?? 0} itens
                      </span>
                    </div>
                    <div className="ck-estoque__meta">
                      {fmtDataBR(b.data_break)}
                      {labelTurno(b.turno) ? ` · ${labelTurno(b.turno)}` : ''}
                      {b.tipo && b.tipo !== 'refeicao' ? ` · ${labelTipo(b.tipo)}` : ''}
                      {b.motivo ? ` · ${b.motivo}` : ''}
                      {b.tipo === 'emprestimo' && b.recebimento_status === 'pendente'
                        ? ' · Aguardando a loja confirmar'
                        : b.tipo === 'emprestimo' && b.recebimento_status === 'recebido'
                          ? ' · Recebido'
                          : ''}
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
          aria-label="Novo lançamento"
          onClick={() => setDlgTipo(true)}
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

      {dlgTipo &&
        createPortal(
          <div className="ck-estoque">
            <div
              className="ck-estoque__loja-modal ck-estoque__modal--center"
              role="dialog"
              aria-modal="true"
              aria-label="Novo lançamento"
            >
              <button
                type="button"
                className="ck-estoque__loja-backdrop"
                aria-label="Fechar"
                onClick={() => setDlgTipo(false)}
              />
              <div className="ck-estoque__loja-panel ck-estoque__confirm">
                <div className="ck-estoque__loja-panel-head">
                  <strong>O que vai lançar?</strong>
                  <button type="button" className="ck-estoque__loja-fechar" onClick={() => setDlgTipo(false)}>
                    Fechar
                  </button>
                </div>
                <p className="ck-estoque__confirm-text">
                  Break é refeição da equipe. Desperdício completo e incompleto seguem o caderno BK. Empréstimo transfere para outra loja.
                </p>
                <div className="ck-estoque__confirm-actions" style={{ flexDirection: 'column' }}>
                  {KINDS.map((k) => (
                    <button
                      key={k.id}
                      type="button"
                      className={`ck-estoque__btn ${k.id === 'refeicao' ? 'ck-estoque__btn--primary' : 'ck-estoque__btn--ghost'}`}
                      onClick={() => abrirForm(k.id)}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {modalLoja}
    </div>
  );
}
