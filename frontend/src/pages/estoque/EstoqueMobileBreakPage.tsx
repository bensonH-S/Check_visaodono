import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
import { getUsuario, logout, lojaEstoqueTravadaMobile } from '../../lib/auth';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GA_LOCKUP } from '../../config/paths';
import MobileUsuarioMenu from '../../components/MobileUsuarioMenu';
import NotificacoesSino from '../../components/NotificacoesSino';
import AppHubDock from '../../components/hub/AppHubDock';
import { showToast } from '../../utils/toast';
import { iconeMarcaLojaPorNome } from '../../utils/marcaLojaMapa';
import { labelFixo, campoAlturaFrotaSx } from '../../constants/frotaVeiculo';
import {
  fracionadaInteira,
  rotuloCampoFracionado,
  sanitizarEntradaFracionada,
  unidadeFisicaInsumo,
} from '../../components/estoque/estoqueContagemCampo';
import '../../components/estoque/estoque-hub.css';
import '../../components/estoque/estoque-mobile.css';
import '../../components/estoque/break-hub.css';

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
  qtdRaw: string;
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
  if (kind === 'desperdicio_completo') return 'Desperdício completo';
  if (kind === 'desperdicio_incompleto') return 'Desperdício incompleto';
  if (kind === 'emprestimo') return 'Empréstimo';
  return 'Novo break';
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
  const navigate = useNavigate();
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
  const [aDevolver, setADevolver] = useState<EstoqueEmprestimoAReceber[]>([]);
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
  const colabFilterOptions = useMemo(
    () =>
      createFilterOptions<{ id_usuario: number; nome: string }>({
        stringify: (option) => option.nome || '',
      }),
    [],
  );
  const nomeColabAtual =
    (idColaborador
      ? colaboradores.find((c) => c.id_usuario === idColaborador)?.nome
      : null) || nomeColaborador.trim();

  const podeTrocarLoja = !lojaTravada && lojas.length > 0;
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
      const [breaks, cols, resumo, pendentes, devolver] = await Promise.all([
        api.estoqueBreaks(lojaId),
        api.estoqueBreakColaboradores(lojaId),
        api.estoqueResumoMes(lojaId).catch(() => null),
        api.estoqueEmprestimosAReceber(lojaId).catch(() => [] as EstoqueEmprestimoAReceber[]),
        api.estoqueEmprestimosADevolver(lojaId).catch(() => [] as EstoqueEmprestimoAReceber[]),
      ]);
      setLista(breaks);
      setColaboradores(cols);
      setAReceber(pendentes);
      setADevolver(devolver);
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
    if (podeTrocarLoja && !idLoja) {
      if (tipo) setKind(tipo);
      setDlgLoja(true);
      showToast('Escolha a loja para lançar', 'info');
      return;
    }
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
            ? { ...i, quantidade: Math.round((i.quantidade + 1) * 1000) / 1000, qtdRaw: String(Math.round((i.quantidade + 1) * 1000) / 1000) }
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
          qtdRaw: '1',
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
          qtdRaw: '1',
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
          const ins = insumos.find(
            (p) => String(p.codigo || '').trim().toUpperCase() === i.codigo.toUpperCase(),
          );
          const inteiro = i.origem === 'insumo' && fracionadaInteira(ins?.unidade_fracionada || ins?.unidade_contagem);
          const passo = inteiro ? 1 : Math.abs(delta) === 1 ? 0.1 : delta;
          const prox = Math.round((i.quantidade + (delta < 0 ? -passo : passo)) * 1000) / 1000;
          if (prox <= 0) return { ...i, quantidade: 0, qtdRaw: '' };
          const qtd = inteiro ? Math.round(prox) : prox;
          return { ...i, quantidade: qtd, qtdRaw: String(qtd).replace('.', ',') };
        })
        .filter((i) => i.quantidade > 0),
    );
  };

  const setQtdRawItem = (key: string, raw: string) => {
    setItens((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const ins = insumos.find(
          (p) => String(p.codigo || '').trim().toUpperCase() === i.codigo.toUpperCase(),
        );
        const inteiro =
          i.origem !== 'insumo' ||
          fracionadaInteira(ins?.unidade_fracionada || ins?.unidade_contagem);
        const limpo = sanitizarEntradaFracionada(raw, inteiro);
        const n = parseCampoQtd(limpo);
        return { ...i, qtdRaw: limpo, quantidade: n != null && n > 0 ? n : 0 };
      }),
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

  const confirmarDevolucao = async (idBreak: number) => {
    if (!idLoja) return;
    setConfirmandoId(idBreak);
    try {
      await api.estoqueDevolverEmprestimo(idBreak, idLoja);
      showToast('Devolvido — saiu daqui e voltou pra origem');
      await carregar(idLoja);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível devolver', 'error');
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
      const result = await api.estoqueLancarBreak({
        id_loja: idLoja,
        data_break: dataBreak,
        tipo: kind,
        turno: turno || undefined,
        motivo: motivoNome,
        motivo_codigo: motivoCodigo || undefined,
        id_colaborador: Number(idColaborador) > 0 ? Number(idColaborador) : undefined,
        colaborador_nome: nomeColabAtual || undefined,
        id_loja_destino: idLojaDestino || undefined,
        itens: itens.map((i) => {
          if (i.origem !== 'insumo') {
            return { codigo_venda: i.codigo, quantidade: i.quantidade, descricao: i.descricao };
          }
          const ins = insumos.find(
            (p) => String(p.codigo || '').trim().toUpperCase() === i.codigo.toUpperCase(),
          );
          const unidade = unidadeFisicaInsumo(ins);
          return {
            codigo_insumo: i.codigo,
            descricao: i.descricao,
            quantidade: i.quantidade,
            unidade,
            contagem_caixa: parseCampoQtd(i.caixa),
            contagem_pc_fd: parseCampoQtd(i.pc),
            contagem_kg_und: parseCampoQtd(i.kg),
          };
        }),
      });
      const avisos = result.avisos?.length ? result.avisos : result.erros || [];
      if (avisos.length) {
        showToast(
          `Lançado. Pendência de estoque: ${avisos[0]}${avisos.length > 1 ? ` (+${avisos.length - 1})` : ''}`,
          'warning',
          { autoClose: 6000 },
        );
      } else {
        showToast(
          kind === 'emprestimo'
            ? 'Empréstimo enviado — a outra loja confirma o recebimento'
            : kind === 'refeicao'
              ? `Break lançado — ${itens.length} item(ns) baixados`
              : `${labelTipo(kind)} lançado`,
          'success',
        );
      }
      fecharForm();
      await carregar(idLoja);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao lançar break', 'error');
    } finally {
      setSalvando(false);
    }
  };

  if (formAberto) {
    return (
      <div
        className="ck-estoque-hub ck-estoque-hub--hero ck-break-hub ck-estoque ck-estoque--contagem ck-estoque--break ck-break-hub--form"
        style={{ ['--ck-hero' as string]: `url(${assetUrl(LOGO_ALVIM_ICONE)})` }}
      >
        <div className="ck-estoque-hub__watermark" aria-hidden />

        <header className="ck-estoque-hub__top ck-estoque-hub__top--fixed">
          <div className="ck-estoque-hub__brand-row">
            <img
              className="ck-estoque-hub__mark ck-estoque-hub__mark--hero"
              src={assetUrl(LOGO_GA_LOCKUP)}
              alt="Grupo Alvim"
            />
            <div className="ck-estoque-hub__actions">
              <button
                type="button"
                className="ck-estoque-hub__icon-btn ck-break-hub__btn-voltar"
                aria-label="Voltar"
                onClick={fecharForm}
              >
                <ArrowBackIcon />
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
          <div className="ck-estoque-hub__hero-copy">
            <div className="ck-estoque-hub__store-row ck-estoque-hub__store-row--hero">
              <h1>{tituloForm(kind)}</h1>
              <div className="ck-break-hub__form-count" aria-live="polite">
                <strong>{itens.length}</strong>
                <span>itens</span>
              </div>
            </div>
            <p className="ck-break-hub__sub ck-break-hub__sub--loja">
              {lojaAtual ? (
                <img
                  className="ck-break-hub__loja-ico ck-break-hub__loja-ico--sm"
                  src={iconeMarcaLojaPorNome(lojaAtual)}
                  alt=""
                />
              ) : (
                <StorefrontOutlinedIcon className="ck-break-hub__loja-ico-fallback" fontSize="small" />
              )}
              <span>
                {lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}
                {nomeColabAtual ? ` · ${nomeColabAtual}` : ''}
              </span>
            </p>
          </div>
        </header>

        <div className="ck-break-hub__form-scroll">
          <nav className="ck-break-hub__form-tabs" role="tablist" aria-label="Tipo de lançamento">
            {(
              [
                ['refeicao', 'Break'],
                ['desperdicio_completo', 'Completo'],
                ['desperdicio_incompleto', 'Incompleto'],
                ['emprestimo', 'Empréstimo'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={kind === id}
                className={`ck-break-hub__form-tab${kind === id ? ' is-on' : ''}`}
                disabled={salvando}
                onClick={() => escolherKind(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="ck-break-hub__form-fields">
            <div className="ck-estoque__field ck-estoque__field--date">
              <CampoDataFrota
                label="Data"
                value={dataBreak}
                onChange={setDataBreak}
                sx={{ ...campoAlturaFrotaSx, mb: 0 }}
              />
            </div>

            {exigeTurno ? (
              <div className="ck-estoque__field ck-break-hub__field-turno">
                <span className="ck-break-hub__lbl">Turno</span>
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
            ) : null}

            {kind === 'emprestimo' ? (
              <div className="ck-break-hub__field-destino">
                <TextField
                  select
                  fullWidth
                  label="Loja que recebe"
                  value={idLojaDestino === '' ? '' : String(idLojaDestino)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setIdLojaDestino(Number.isFinite(n) && n > 0 ? n : '');
                  }}
                  disabled={salvando}
                  slotProps={{
                    inputLabel: labelFixo.inputLabel,
                    select: {
                      displayEmpty: true,
                      MenuProps: {
                        slotProps: {
                          paper: {
                            className: 'ck-break-hub__menu',
                            sx: {
                              maxHeight: 280,
                              bgcolor: '#1a222c',
                              color: '#f5f5f5',
                              backgroundImage: 'none',
                              border: '1px solid rgba(255,255,255,0.12)',
                            },
                          },
                        },
                      },
                    },
                  }}
                  sx={{
                    ...campoAlturaFrotaSx,
                    mb: 0,
                    width: '100%',
                    maxWidth: '100%',
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#2a3038',
                      color: '#f5f5f5',
                      minHeight: 40,
                      height: 40,
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.14)',
                    },
                    '& .MuiInputLabel-root': { color: '#8d8d8d' },
                    '& .MuiSelect-select': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                    '& .MuiSelect-icon': { color: '#8d8d8d' },
                  }}
                >
                  <MenuItem value="">
                    <em>Selecione a loja…</em>
                  </MenuItem>
                  {lojasDestino
                    .filter((l) => l.id_loja !== idLoja)
                    .map((l) => (
                      <MenuItem key={l.id_loja} value={String(l.id_loja)}>
                        {rotuloLoja(l)}
                      </MenuItem>
                    ))}
                </TextField>
                <span className="ck-break-hub__hint">
                  A loja destino confirma o recebimento depois.
                </span>
              </div>
            ) : null}

            {exigeColab && colaboradores.length > 0 ? (
              <div className="ck-break-hub__field-colab">
              <Autocomplete
                size="small"
                options={colabOptions}
                filterOptions={colabFilterOptions}
                getOptionLabel={(option) => option.nome || ''}
                isOptionEqualToValue={(option, value) => option.id_usuario === value.id_usuario}
                openOnFocus
                autoHighlight
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
                fullWidth
                slotProps={{
                  popper: {
                    sx: { zIndex: 14000 },
                  },
                  paper: {
                    className: 'ck-break-hub__menu',
                    sx: {
                      bgcolor: '#1a222c',
                      color: '#f5f5f5',
                      backgroundImage: 'none',
                      border: '1px solid rgba(255,255,255,0.12)',
                      maxHeight: 280,
                    },
                  },
                  listbox: {
                    sx: {
                      bgcolor: '#1a222c',
                      color: '#f5f5f5',
                      '& .MuiAutocomplete-option': {
                        color: '#f5f5f5',
                        minHeight: 40,
                      },
                      '& .MuiAutocomplete-option[aria-selected="true"]': {
                        bgcolor: 'rgba(254,108,34,0.16)',
                        color: '#ff9a5c',
                      },
                    },
                  },
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Colaborador"
                    placeholder="Digite para buscar…"
                    slotProps={{
                      ...params.slotProps,
                      inputLabel: {
                        ...(typeof params.slotProps?.inputLabel === 'object'
                          ? params.slotProps.inputLabel
                          : {}),
                        ...labelFixo.inputLabel,
                      },
                    }}
                    sx={{
                      ...campoAlturaFrotaSx,
                      mb: 0,
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: '#2a3038',
                        color: '#f5f5f5',
                        minHeight: 40,
                        height: 40,
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(255,255,255,0.14)',
                      },
                      '& .MuiInputLabel-root': { color: '#8d8d8d' },
                      '& .MuiInputBase-input': {
                        color: '#f5f5f5',
                        WebkitTextFillColor: '#f5f5f5',
                      },
                      '& .MuiInputBase-input::placeholder': {
                        color: '#8d8d8d',
                        opacity: 1,
                      },
                      '& .MuiSvgIcon-root': { color: '#8d8d8d' },
                    }}
                  />
                )}
              />
              </div>
            ) : null}

            {exigeColab && colabDigitado ? (
              <TextField
                fullWidth
                label="Nome do colaborador"
                placeholder="Digite o nome"
                value={nomeColaborador}
                onChange={(e) => {
                  setIdColaborador('');
                  setColabSelect(colaboradores.length ? '__outro__' : '');
                  setNomeColaborador(e.target.value);
                }}
                disabled={salvando}
                autoComplete="off"
                slotProps={{ inputLabel: labelFixo.inputLabel }}
                sx={{
                  ...campoAlturaFrotaSx,
                  mb: 0,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#2a3038',
                    color: '#f5f5f5',
                    minHeight: 40,
                    height: 40,
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.14)',
                  },
                  '& .MuiInputLabel-root': { color: '#8d8d8d' },
                }}
              />
            ) : null}

            {exigeMotivo ? (
              <div className="ck-break-hub__field-motivo">
              <TextField
                select
                fullWidth
                label="Motivo"
                value={motivoCodigo}
                onChange={(e) => setMotivoCodigo(e.target.value)}
                disabled={salvando}
                slotProps={{
                  inputLabel: labelFixo.inputLabel,
                  select: {
                    displayEmpty: true,
                    MenuProps: {
                      slotProps: {
                        paper: {
                          className: 'ck-break-hub__menu',
                          sx: {
                            bgcolor: '#1a222c',
                            color: '#f5f5f5',
                            backgroundImage: 'none',
                          },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  ...campoAlturaFrotaSx,
                  mb: 0,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: '#2a3038',
                    color: '#f5f5f5',
                    minHeight: 40,
                    height: 40,
                  },
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255,255,255,0.14)',
                  },
                  '& .MuiInputLabel-root': { color: '#8d8d8d' },
                }}
              >
                <MenuItem value="">
                  <em>Selecione…</em>
                </MenuItem>
                {motivos.map((m) => (
                  <MenuItem key={m.codigo} value={m.codigo}>
                    {m.nome}
                  </MenuItem>
                ))}
              </TextField>
              </div>
            ) : null}

            <div className="ck-break-hub__produto">
              {usaInsumo ? (
                <EstoqueInsumoAutocomplete
                  produtos={insumos}
                  value={codigo}
                  onChange={adicionarInsumo}
                  label="Produto"
                  disabled={salvando}
                  placeholder="Buscar e adicionar…"
                  sx={{
                    ...campoAlturaFrotaSx,
                    mb: 0,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#2a3038',
                      color: '#f5f5f5',
                      minHeight: 40,
                      height: 40,
                      borderRadius: '8px',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.14)',
                    },
                    '& .MuiInputLabel-root': { color: '#8d8d8d' },
                    '& .MuiInputBase-input': { color: '#f5f5f5', WebkitTextFillColor: '#f5f5f5' },
                    '& .MuiInputBase-input::placeholder': { color: '#8d8d8d', opacity: 1 },
                    '& .MuiSvgIcon-root': { color: '#8d8d8d' },
                  }}
                />
              ) : (
                <EstoqueProdutoVendaAutocomplete
                  produtos={produtosVenda}
                  value={codigo}
                  onChange={adicionarProduto}
                  label="Produto"
                  disabled={salvando}
                  placeholder="Buscar e adicionar…"
                  sx={{
                    ...campoAlturaFrotaSx,
                    mb: 0,
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#2a3038',
                      color: '#f5f5f5',
                      minHeight: 40,
                      height: 40,
                      borderRadius: '8px',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.14)',
                    },
                    '& .MuiInputLabel-root': { color: '#8d8d8d' },
                    '& .MuiInputBase-input': { color: '#f5f5f5', WebkitTextFillColor: '#f5f5f5' },
                    '& .MuiInputBase-input::placeholder': { color: '#8d8d8d', opacity: 1 },
                    '& .MuiSvgIcon-root': { color: '#8d8d8d' },
                  }}
                />
              )}
            </div>
          </div>

            {itens.length > 0 && (
              <div className="ck-estoque__break-itens">
                {itens.map((item) => (
                  <div key={item.key} className="ck-break-hub__item">
                    <div className="ck-break-hub__item-info">
                      <span className="ck-break-hub__item-cod">{item.codigo}</span>
                      <span className="ck-break-hub__item-nome">{item.descricao}</span>
                    </div>
                    {kind === 'emprestimo' ? (
                      <div className="ck-estoque__row ck-estoque__row--tres">
                        {(() => {
                          const ins = insumos.find(
                            (p) =>
                              String(p.codigo || '').trim().toUpperCase() ===
                              item.codigo.toUpperCase(),
                          );
                          const rotuloFrac = rotuloCampoFracionado(
                            ins?.unidade_fracionada || ins?.unidade_contagem,
                          );
                          return (
                            [
                              ['caixa', 'CAIXA', 'caixa'] as const,
                              ['pc', 'PCT', 'pc'] as const,
                              ['kg', rotuloFrac, 'kg'] as const,
                            ]
                          ).map(([campo, label, keyCampo]) => {
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
                                  type="text"
                                  inputMode={
                                    keyCampo === 'kg' &&
                                    fracionadaInteira(
                                      ins?.unidade_fracionada || ins?.unidade_contagem,
                                    )
                                      ? 'numeric'
                                      : 'decimal'
                                  }
                                  min="0"
                                  placeholder="—"
                                  disabled={salvando}
                                  value={item[campo]}
                                  onChange={(e) =>
                                    setCampoItem(
                                      item.key,
                                      campo,
                                      sanitizarEntradaFracionada(
                                        e.target.value,
                                        keyCampo === 'kg' &&
                                          fracionadaInteira(
                                            ins?.unidade_fracionada || ins?.unidade_contagem,
                                          ),
                                      ),
                                    )
                                  }
                                />
                              )}
                            </div>
                          );
                        });
                        })()}
                      </div>
                    ) : item.origem === 'insumo' ? (
                      <div className="ck-break-hub__item-qtd-input">
                        <input
                          type="text"
                          inputMode={
                            fracionadaInteira(
                              insumos.find(
                                (p) =>
                                  String(p.codigo || '').trim().toUpperCase() ===
                                  item.codigo.toUpperCase(),
                              )?.unidade_fracionada ||
                                insumos.find(
                                  (p) =>
                                    String(p.codigo || '').trim().toUpperCase() ===
                                    item.codigo.toUpperCase(),
                                )?.unidade_contagem,
                            )
                              ? 'numeric'
                              : 'decimal'
                          }
                          aria-label="Quantidade"
                          disabled={salvando}
                          value={item.qtdRaw}
                          onChange={(e) => setQtdRawItem(item.key, e.target.value)}
                        />
                        <small>
                          {unidadeFisicaInsumo(
                            insumos.find(
                              (p) =>
                                String(p.codigo || '').trim().toUpperCase() ===
                                item.codigo.toUpperCase(),
                            ),
                          )}
                        </small>
                      </div>
                    ) : (
                      <div className="ck-break-hub__item-qty">
                        <button
                          type="button"
                          aria-label="Diminuir"
                          disabled={salvando}
                          onClick={() => ajustarQtdeItem(item.key, -1)}
                        >
                          −
                        </button>
                        <span>{item.quantidade}</span>
                        <button
                          type="button"
                          aria-label="Aumentar"
                          disabled={salvando}
                          onClick={() => ajustarQtdeItem(item.key, 1)}
                        >
                          +
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="ck-break-hub__item-rm"
                      aria-label="Remover item"
                      disabled={salvando}
                      onClick={() => removerItem(item.key)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

          {!itens.length ? (
            <div className="ck-break-hub__empty-itens">Busque um produto acima para montar a lista.</div>
          ) : null}

          <button
            type="button"
            className="ck-break-hub__cta-confirm"
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
        </div>

        <AppHubDock
          ativo={null}
          plusLabel="Novo lançamento"
          plusDisabled
          onPlus={() => undefined}
        />
      </div>
    );
  }

  return (
    <div
      className="ck-estoque-hub ck-estoque-hub--hero ck-break-hub"
      style={{ ['--ck-hero' as string]: `url(${assetUrl(LOGO_ALVIM_ICONE)})` }}
    >
      <div className="ck-estoque-hub__watermark" aria-hidden />
      <header className="ck-estoque-hub__top ck-estoque-hub__top--fixed">
        <div className="ck-estoque-hub__brand-row">
          <img
            className="ck-estoque-hub__mark ck-estoque-hub__mark--hero"
            src={assetUrl(LOGO_GA_LOCKUP)}
            alt="Grupo Alvim"
          />
          <div className="ck-estoque-hub__actions">
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
        <div className="ck-estoque-hub__hero-copy">
          <div className="ck-estoque-hub__store-row ck-estoque-hub__store-row--hero">
            <h1>Break e perdas</h1>
          </div>
          <p className="ck-break-hub__sub">
            Registro de perdas operacionais, descarte e refeição da equipe.
          </p>
        </div>
        {idLoja ? (
          <nav className="ck-estoque-hub__tabs ck-break-hub__tabs" aria-label="Tipo de lançamento">
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
                className={`ck-estoque-hub__tab${filtroTipo === value ? ' is-on' : ''}`}
                onClick={() => setFiltroTipo(value)}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      <div className="ck-estoque-hub__panel">
        <div className="ck-break-hub__kpis" aria-live="polite">
          <div className="ck-break-hub__kpi is-on">
            <strong>{loading ? '—' : fmtBrl(resumoMes?.valor_break_mes)}</strong>
            <span>Break mês</span>
          </div>
          <div className="ck-break-hub__kpi">
            <strong>{loading ? '—' : fmtBrl(resumoMes?.valor_desperdicio_mes)}</strong>
            <span>Desperdício</span>
          </div>
          <div className="ck-break-hub__kpi">
            <strong>{loading ? '—' : lista.length}</strong>
            <span>Lançamentos</span>
          </div>
        </div>
      </div>

      <div className="ck-estoque-hub__scroll ck-break-hub__scroll">
        {err ? <p className="ck-break-hub__err">{err}</p> : null}

        {podeTrocarLoja ? (
          <div className="ck-break-hub__loja">
            <div className="ck-break-hub__loja-seletor">
              <button
                type="button"
                className="ck-break-hub__loja-btn"
                onClick={() => setDlgLoja((v) => !v)}
              >
                <span className="ck-break-hub__loja-btn-main">
                  {lojaAtual ? (
                    <img className="ck-break-hub__loja-ico" src={iconeMarcaLojaPorNome(lojaAtual)} alt="" />
                  ) : (
                    <StorefrontOutlinedIcon className="ck-break-hub__loja-ico-fallback" fontSize="small" />
                  )}
                  <span>{lojaAtual ? rotuloLoja(lojaAtual) : 'Selecione a loja'}</span>
                </span>
                <ExpandMoreIcon
                  className={`ck-break-hub__loja-chev${dlgLoja ? ' is-open' : ''}`}
                  fontSize="small"
                />
              </button>
              {dlgLoja ? (
                <>
                  <div className="ck-break-hub__dropdown-backdrop" onClick={fecharDlgLoja} />
                  <div className="ck-break-hub__loja-dropdown">
                    {lojasFiltradas.map((l) => {
                      const ativa = l.id_loja === idLoja;
                      return (
                        <button
                          key={l.id_loja}
                          type="button"
                          className={`ck-break-hub__loja-item${ativa ? ' is-on' : ''}`}
                          onClick={() => selecionarLoja(l.id_loja)}
                        >
                          <img className="ck-break-hub__loja-ico" src={iconeMarcaLojaPorNome(l)} alt="" />
                          <span>{rotuloLoja(l)}</span>
                        </button>
                      );
                    })}
                    {!lojasFiltradas.length ? (
                      <div className="ck-break-hub__empty" style={{ margin: 8 }}>
                        Nenhuma loja encontrada.
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : lojaAtual ? (
          <div className="ck-break-hub__loja">
            <div className="ck-break-hub__loja-fix" aria-label="Loja">
              <img className="ck-break-hub__loja-ico" src={iconeMarcaLojaPorNome(lojaAtual)} alt="" />
              <div>
                {lojaAtual.bk_number ? <small>{lojaAtual.bk_number}</small> : null}
                <strong>{nomeLoja(lojaAtual)}</strong>
              </div>
            </div>
          </div>
        ) : null}

        {idLoja ? (
          <div className="ck-break-hub__busca">
            <input
              type="search"
              placeholder="Buscar colaborador ou responsável…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              disabled={loading}
            />
          </div>
        ) : null}

        {loading ? (
          <LinearProgress
            sx={{
              my: 1.5,
              borderRadius: 1,
              backgroundColor: 'rgba(255,154,92,0.18)',
              '& .MuiLinearProgress-bar': { backgroundColor: '#ff9a5c' },
            }}
          />
        ) : null}

        {!idLoja ? (
          <div className="ck-break-hub__empty">Selecione a loja para começar.</div>
        ) : (
          <>
            {!loading && aReceber.length > 0 ? (
              <div className="ck-break-hub__stack">
                {aReceber.map((emp) => (
                  <div key={emp.id_break} className="ck-break-hub__card is-alerta">
                    <div className="ck-break-hub__card-top">
                      <strong>
                        Receber de{' '}
                        {emp.loja_origem_bk
                          ? `${emp.loja_origem_bk} · ${emp.loja_origem_nome}`
                          : emp.loja_origem_nome || 'outra loja'}
                      </strong>
                      <span className="ck-break-hub__chip is-ok">{(emp.itens || []).length} itens</span>
                    </div>
                    <p className="ck-break-hub__meta">
                      {fmtDataBR(emp.data_break)}
                      {emp.criado_por_nome ? ` · ${emp.criado_por_nome}` : ''}
                    </p>
                    {(emp.itens || []).map((it, idx) => (
                      <p key={`${emp.id_break}-${idx}`} className="ck-break-hub__desc">
                        {it.codigo} · {it.descricao} · {rotuloQtdEmprestimo(it)}
                      </p>
                    ))}
                    <button
                      type="button"
                      className="ck-break-hub__cta"
                      disabled={confirmandoId === emp.id_break}
                      onClick={() => void confirmarRecebimento(emp.id_break)}
                    >
                      {confirmandoId === emp.id_break ? 'Confirmando…' : 'OK — recebi'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && aDevolver.length > 0 ? (
              <div className="ck-break-hub__stack">
                {aDevolver.map((emp) => (
                  <div key={emp.id_break} className="ck-break-hub__card">
                    <div className="ck-break-hub__card-top">
                      <strong>
                        Devolver para{' '}
                        {emp.loja_origem_bk
                          ? `${emp.loja_origem_bk} · ${emp.loja_origem_nome}`
                          : emp.loja_origem_nome || 'origem'}
                      </strong>
                      <span className="ck-break-hub__chip">{(emp.itens || []).length} itens</span>
                    </div>
                    <p className="ck-break-hub__meta">
                      {fmtDataBR(emp.data_break)}
                      {emp.recebido_em ? ` · recebido ${fmtDataBR(emp.recebido_em)}` : ''}
                    </p>
                    {(emp.itens || []).map((it, idx) => (
                      <p key={`dev-${emp.id_break}-${idx}`} className="ck-break-hub__desc">
                        {it.codigo} · {it.descricao} · {rotuloQtdEmprestimo(it)}
                      </p>
                    ))}
                    <button
                      type="button"
                      className="ck-break-hub__cta is-ghost"
                      disabled={confirmandoId === emp.id_break}
                      onClick={() => void confirmarDevolucao(emp.id_break)}
                    >
                      {confirmandoId === emp.id_break ? 'Devolvendo…' : 'Devolver agora'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {!loading && !listaFiltrada.length ? (
              <div className="ck-break-hub__empty">
                {busca.trim()
                  ? 'Nenhum lançamento encontrado na busca.'
                  : filtroTipo === 'desperdicio_completo'
                    ? 'Nenhum desperdício completo. Toque no + para lançar.'
                    : filtroTipo === 'desperdicio_incompleto'
                      ? 'Nenhum desperdício incompleto. Toque no + para lançar.'
                      : 'Nenhum lançamento nesta loja. Toque no + e escolha o tipo.'}
              </div>
            ) : null}

            {!loading
              ? listaFiltrada.map((b) => (
                  <div key={b.id_break} className="ck-break-hub__card">
                    <div className="ck-break-hub__card-top">
                      <strong>
                        {b.tipo === 'emprestimo'
                          ? b.loja_destino_nome
                            ? `Para ${b.loja_destino_bk ? `${b.loja_destino_bk} · ` : ''}${b.loja_destino_nome}`
                            : 'Empréstimo'
                          : b.colaborador_nome || labelTipo(b.tipo)}
                      </strong>
                      <span className="ck-break-hub__chip is-ok">{b.itens ?? 0} itens</span>
                    </div>
                    <p className="ck-break-hub__meta">
                      {fmtDataBR(b.data_break)}
                      {labelTurno(b.turno) ? ` · ${labelTurno(b.turno)}` : ''}
                      {b.tipo && b.tipo !== 'refeicao' ? ` · ${labelTipo(b.tipo)}` : ''}
                      {b.motivo ? ` · ${b.motivo}` : ''}
                      {b.tipo === 'emprestimo' && b.recebimento_status === 'pendente'
                        ? ' · Aguardando a loja confirmar'
                        : b.tipo === 'emprestimo' && b.recebimento_status === 'recebido'
                          ? ' · Recebido (pode devolver na loja destino)'
                          : b.tipo === 'emprestimo' && b.recebimento_status === 'devolvido'
                            ? ' · Devolvido'
                            : ''}
                    </p>
                    <div className="ck-break-hub__chips">
                      <span className="ck-break-hub__chip">
                        {b.criado_por_nome ? `Por ${b.criado_por_nome}` : 'Lançado'}
                      </span>
                      {b.criado_em ? <span className="ck-break-hub__chip">{fmtDataHora(b.criado_em)}</span> : null}
                      {b.avisos_baixa ? (
                        <span className="ck-break-hub__chip is-warn">Estoque parcial — ver aba Baixa</span>
                      ) : null}
                    </div>
                    {b.avisos_baixa ? (
                      <p className="ck-break-hub__warn">{String(b.avisos_baixa).split('\n')[0]}</p>
                    ) : null}
                  </div>
                ))
              : null}
          </>
        )}
      </div>

      <AppHubDock
        ativo={null}
        plusLabel="Novo lançamento"
        plusDisabled={!idLoja || loading}
        onPlus={() => setDlgTipo(true)}
      />

      {dlgTipo &&
        createPortal(
          <div className="ck-estoque-hub ck-estoque-hub--sheet ck-break-hub">
            <div
              className="ck-estoque-hub__tipo-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Novo lançamento"
            >
              <button
                type="button"
                className="ck-estoque-hub__sheet-back"
                aria-label="Fechar"
                onClick={() => setDlgTipo(false)}
              />
              <div className="ck-estoque-hub__tipo-panel">
                <div className="ck-estoque-hub__sheet-tipo-head">
                  <strong>O que vai lançar?</strong>
                  <button
                    type="button"
                    className="ck-estoque-hub__sheet-tipo-fechar"
                    onClick={() => setDlgTipo(false)}
                  >
                    Fechar
                  </button>
                </div>
                <p className="ck-estoque-hub__sheet-tipo-text">
                  Break é refeição da equipe. Desperdício segue o caderno BK. Empréstimo transfere para outra loja.
                </p>
                <div className="ck-estoque-hub__sheet-tipo-actions">
                  {KINDS.map((k, i) => (
                    <button
                      key={k.id}
                      type="button"
                      className={`ck-estoque-hub__sheet-tipo-btn ${i % 2 === 0 ? 'is-pri' : 'is-cinza'}`}
                      onClick={() => abrirForm(k.id)}
                    >
                      <strong>{k.label}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );

}
