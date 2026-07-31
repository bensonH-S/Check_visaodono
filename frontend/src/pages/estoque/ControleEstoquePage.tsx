import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import StorefrontIcon from '@mui/icons-material/Storefront';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { usePageTitle } from '../../hooks/usePageTitle';
import {
  api,
  type EstoqueContagemDetalhe,
  type EstoqueContagemResumo,
  type EstoqueItem,
  type Loja,
  type ProdutoEstoque,
} from '../../api/client';
import {
  getUsuario,
  podeBreakEstoque,
  podeConferenciaEstoque,
  podeExcluirEstoque,
  podeOperacionalEstoque,
  podeProdutosEstoque,
  podeReabrirContagemEstoque,
} from '../../lib/auth';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import DialogTitleWithIcon from '../../components/DialogTitleWithIcon';
import EstoqueOperacionalPanels, { type AbaOp } from './EstoqueOperacionalPanels';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import Tooltip from '@mui/material/Tooltip';

type AbaEstoque = 'conferencia' | 'insumos' | AbaOp;

const ABAS_ESTOQUE: AbaEstoque[] = ['conferencia', 'insumos', 'produtos', 'saldo', 'vendas', 'break'];

function isAbaEstoque(v: string | undefined): v is AbaEstoque {
  return !!v && (ABAS_ESTOQUE as string[]).includes(v);
}

function abaInicialPermitida(): AbaEstoque {
  if (podeConferenciaEstoque(getUsuario())) return 'conferencia';
  if (podeProdutosEstoque(getUsuario())) return 'insumos';
  if (podeOperacionalEstoque(getUsuario())) return 'saldo';
  if (podeBreakEstoque(getUsuario())) return 'break';
  return 'saldo';
}

const LOJA_STORAGE_KEY = 'estoque.id_loja';

const chipAbertaSx = {
  bgcolor: '#FEF08A',
  color: '#854D0E',
  fontWeight: 700,
  border: '1px solid #FACC15',
} as const;

const chipFinalizadaSx = {
  bgcolor: '#BBF7D0',
  color: '#166534',
  fontWeight: 700,
  border: '1px solid #86EFAC',
} as const;

/** Fundo opaco no sticky — rgba deixa células passarem por baixo do título */
const thCenter = {
  textAlign: 'center',
  fontWeight: 700,
  bgcolor: '#FFFFFF !important',
  backgroundImage: 'none !important',
  backgroundClip: 'padding-box',
  zIndex: 4,
  boxShadow: `inset 0 -1px 0 ${colors.border}`,
} as const;

const thLeft = {
  fontWeight: 700,
  bgcolor: '#FFFFFF !important',
  backgroundImage: 'none !important',
  backgroundClip: 'padding-box',
  zIndex: 4,
  boxShadow: `inset 0 -1px 0 ${colors.border}`,
} as const;

const thDiferencaSx = {
  ...thCenter,
  color: '#991b1b',
  bgcolor: '#FEE2E2 !important',
} as const;

function fmtMoeda(v: number | null | undefined) {
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
  if (Number.isNaN(d.getTime())) return fmtDataBR(iso);
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

const emptyProdutoForm = {
  codigo: '',
  descricao: '',
  unidade_contagem: 'UND',
  preco_caixa: '',
  und_convertida: '1',
};

type ProdutoForm = typeof emptyProdutoForm;

const tdCenter = { textAlign: 'center' } as const;

const linhaPreenchidaSx = {
  bgcolor: 'rgba(22, 163, 74, 0.1)',
  '&:hover': { bgcolor: 'rgba(22, 163, 74, 0.16)' },
} as const;

function diferencaSx(d: number | null) {
  if (d == null) return { ...tdCenter };
  if (d === 0) {
    return { ...tdCenter, color: '#166534', fontWeight: 600 };
  }
  return {
    ...tdCenter,
    color: '#991b1b',
    fontWeight: 700,
    bgcolor: 'rgba(220, 38, 38, 0.12)',
  };
}

const linhaDivergenciaSx = {
  bgcolor: 'rgba(220, 38, 38, 0.1)',
  '&:hover': { bgcolor: 'rgba(220, 38, 38, 0.16)' },
} as const;

function aplicarContagem(
  det: EstoqueContagemDetalhe | null,
  setContagem: (c: EstoqueContagemDetalhe | null) => void,
  setRascunho: (r: Record<number, string>) => void,
) {
  if (!det?.id_contagem) {
    setContagem(det?.meta ? det : null);
    setRascunho({});
    return;
  }
  setContagem(det);
  const draft: Record<number, string> = {};
  for (const i of det.itens || []) {
    draft[i.id_item] = i.estoque_contado == null ? '' : String(i.estoque_contado);
  }
  setRascunho(draft);
}

export default function ControleEstoquePage() {
  usePageTitle('Estoque');
  const navigate = useNavigate();
  const { aba: abaParam } = useParams<{ aba: string }>();
  const user = getUsuario();
  const podeProdutos = podeProdutosEstoque(user);
  const podeConferencia = podeConferenciaEstoque(user);
  const podeOperacional = podeOperacionalEstoque(user);
  const podeBreak = podeBreakEstoque(user);
  const podeEditarProdutos = podeProdutos;
  const podeEditarConferencia = podeConferencia;
  const podeExcluir = podeExcluirEstoque(user);
  const podeReabrir = podeReabrirContagemEstoque(user);

  const aba: AbaEstoque = isAbaEstoque(abaParam) ? abaParam : abaInicialPermitida();

  const irParaAba = useCallback(
    (proxima: AbaEstoque) => {
      if (proxima === aba) return;
      navigate(`/estoque/${proxima}`);
    },
    [aba, navigate],
  );

  const [lojas, setLojas] = useState<Loja[]>([]);
  const [idLoja, setIdLoja] = useState<number | ''>(() => {
    const saved = Number(localStorage.getItem(LOJA_STORAGE_KEY) || '');
    return Number.isFinite(saved) && saved > 0 ? saved : '';
  });
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [produtosVendaCount, setProdutosVendaCount] = useState(0);
  const [busca, setBusca] = useState('');
  const [listaContagens, setListaContagens] = useState<EstoqueContagemResumo[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'aberta' | 'finalizada'>('todas');
  const [contagem, setContagem] = useState<EstoqueContagemDetalhe | null>(null);
  const [verDetalhe, setVerDetalhe] = useState(false);
  const [iniciando, setIniciando] = useState(false);

  const [dlgProduto, setDlgProduto] = useState(false);
  const [editando, setEditando] = useState<ProdutoEstoque | null>(null);
  const [formProduto, setFormProduto] = useState<ProdutoForm>(emptyProdutoForm);
  const [salvandoProduto, setSalvandoProduto] = useState(false);

  const [rascunhoItens, setRascunhoItens] = useState<Record<number, string>>({});
  const [salvandoItens, setSalvandoItens] = useState(false);
  const [dlgExcluir, setDlgExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [dlgReabrir, setDlgReabrir] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);

  const lojaAtual = useMemo(
    () => lojas.find((l) => l.id_loja === idLoja) || null,
    [lojas, idLoja],
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingLojas(true);
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
        showToast(e instanceof Error ? e.message : 'Erro ao carregar lojas', 'error');
      } finally {
        if (!cancel) setLoadingLojas(false);
      }
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só no mount
  }, []);

  const selecionarLoja = (id: number) => {
    setIdLoja(id);
    localStorage.setItem(LOJA_STORAGE_KEY, String(id));
    setContagem(null);
    setListaContagens([]);
    setProdutos([]);
    setProdutosVendaCount(0);
    setRascunhoItens({});
    setVerDetalhe(false);
  };

  const carregarProdutos = useCallback(async () => {
    if (!idLoja) return;
    const rows = await api.estoqueProdutos({ id_loja: idLoja, q: busca || undefined });
    setProdutos(rows);
  }, [idLoja, busca]);

  const carregarListaContagens = useCallback(async () => {
    if (!idLoja) return [];
    const rows = await api.estoqueContagens(idLoja);
    setListaContagens(rows);
    return rows;
  }, [idLoja]);

  const abrirContagem = useCallback(async (id: number) => {
    const det = await api.estoqueContagem(id);
    aplicarContagem(det, setContagem, setRascunhoItens);
    setVerDetalhe(true);
    return det;
  }, []);

  const voltarLista = () => {
    setVerDetalhe(false);
    void carregarListaContagens();
  };

  const carregarProdutosVendaCount = useCallback(async () => {
    if (!idLoja || !podeOperacional) {
      setProdutosVendaCount(0);
      return;
    }
    try {
      const rows = await api.estoqueProdutosVenda({ id_loja: idLoja });
      setProdutosVendaCount(rows.length);
    } catch {
      setProdutosVendaCount(0);
    }
  }, [idLoja, podeOperacional]);

  const carregarTudo = useCallback(async () => {
    if (!idLoja) return;
    setLoading(true);
    try {
      const jobs: Promise<unknown>[] = [];
      if (podeProdutos || podeOperacional || podeBreak) jobs.push(carregarProdutos());
      if (podeOperacional) jobs.push(carregarProdutosVendaCount());
      if (podeConferencia) jobs.push(carregarListaContagens());
      await Promise.all(jobs);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar estoque', 'error');
    } finally {
      setLoading(false);
    }
  }, [
    idLoja,
    podeProdutos,
    podeOperacional,
    podeBreak,
    podeConferencia,
    carregarProdutos,
    carregarProdutosVendaCount,
    carregarListaContagens,
  ]);

  useEffect(() => {
    setVerDetalhe(false);
    setContagem(null);
    void carregarTudo();
  }, [idLoja]); // eslint-disable-line react-hooks/exhaustive-deps -- só ao trocar loja

  useEffect(() => {
    if (!idLoja || !(podeProdutos || podeOperacional || podeBreak)) return;
    void carregarProdutos();
  }, [carregarProdutos, idLoja, podeProdutos, podeOperacional, podeBreak]);

  useEffect(() => {
    setProdutosVendaCount(0);
  }, [idLoja]);

  useEffect(() => {
    // URL antiga /estoque/ficha → /estoque/produtos
    if (abaParam === 'ficha') {
      navigate('/estoque/produtos', { replace: true });
      return;
    }
    if (!isAbaEstoque(abaParam)) {
      navigate(`/estoque/${abaInicialPermitida()}`, { replace: true });
      return;
    }
    if (verDetalhe && contagem?.status === 'aberta' && aba !== 'conferencia') {
      navigate('/estoque/conferencia', { replace: true });
      return;
    }
    const abasOp: AbaOp[] = ['saldo', 'vendas', 'produtos'];
    let destino: AbaEstoque | null = null;
    if (aba === 'conferencia' && !podeConferencia) {
      destino = podeProdutos ? 'insumos' : podeOperacional ? 'saldo' : podeBreak ? 'break' : 'conferencia';
    } else if (aba === 'insumos' && !podeProdutos) {
      destino = podeConferencia ? 'conferencia' : podeOperacional ? 'saldo' : podeBreak ? 'break' : 'insumos';
    } else if (abasOp.includes(aba as AbaOp) && !podeOperacional) {
      destino = podeConferencia ? 'conferencia' : podeProdutos ? 'insumos' : podeBreak ? 'break' : 'saldo';
    } else if (aba === 'break' && !podeBreak) {
      destino = podeConferencia ? 'conferencia' : podeProdutos ? 'insumos' : podeOperacional ? 'saldo' : 'break';
    }
    if (destino && destino !== aba) {
      navigate(`/estoque/${destino}`, { replace: true });
    }
  }, [aba, abaParam, navigate, podeConferencia, podeProdutos, podeOperacional, podeBreak, verDetalhe, contagem?.status]);

  const iniciarSabado = async () => {
    if (!podeEditarConferencia || !idLoja) return;
    setIniciando(true);
    try {
      const det = await api.estoqueIniciarSabado({ id_loja: idLoja });
      await carregarListaContagens();
      aplicarContagem(det, setContagem, setRascunhoItens);
      setVerDetalhe(true);
      showToast(det.meta?.iniciada_agora ? 'Conferência iniciada' : 'Conferência aberta');
      irParaAba('conferencia');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao iniciar conferência', 'error');
    } finally {
      setIniciando(false);
    }
  };

  const abrirNovoProduto = () => {
    setEditando(null);
    setFormProduto(emptyProdutoForm);
    setDlgProduto(true);
  };

  const abrirEditarProduto = (p: ProdutoEstoque) => {
    setEditando(p);
    setFormProduto({
      codigo: p.codigo,
      descricao: p.descricao,
      unidade_contagem: String(p.unidade_contagem || 'UND').toUpperCase(),
      preco_caixa: String(p.preco_caixa ?? ''),
      und_convertida: String(p.und_convertida ?? 1),
    });
    setDlgProduto(true);
  };

  const salvarProduto = async () => {
    if (!idLoja) return;
    setSalvandoProduto(true);
    try {
      const body = {
        id_loja: idLoja,
        codigo: formProduto.codigo.trim(),
        descricao: formProduto.descricao.trim(),
        unidade_contagem: formProduto.unidade_contagem.toUpperCase(),
        preco_caixa: Number(String(formProduto.preco_caixa).replace(',', '.')),
        und_convertida: Number(String(formProduto.und_convertida).replace(',', '.')),
      };
      if (editando) {
        await api.estoqueAtualizarProduto(editando.id_produto, body);
        showToast('Insumo atualizado');
      } else {
        await api.estoqueCriarProduto(body);
        showToast('Insumo cadastrado nesta loja');
      }
      setDlgProduto(false);
      await carregarProdutos();
      if (contagem?.status === 'aberta' && contagem.id_contagem) {
        await abrirContagem(contagem.id_contagem);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar insumo', 'error');
    } finally {
      setSalvandoProduto(false);
    }
  };

  const salvarItens = async (silencioso = false) => {
    if (!contagem?.id_contagem) return null;
    setSalvandoItens(true);
    try {
      const itens = contagem.itens.map((i) => {
        const raw = rascunhoItens[i.id_item];
        const estoque_contado =
          raw === undefined || raw === '' ? null : Number(String(raw).replace(',', '.'));
        return { id_item: i.id_item, estoque_contado };
      });
      const det = await api.estoqueSalvarItens(contagem.id_contagem, itens);
      aplicarContagem(det, setContagem, setRascunhoItens);
      await carregarListaContagens();
      if (!silencioso) showToast('Rascunho salvo');
      return det;
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar contagem', 'error');
      throw e;
    } finally {
      setSalvandoItens(false);
    }
  };

  const finalizarContagem = async () => {
    if (!contagem?.id_contagem) return;
    try {
      await salvarItens(true);
      const det = await api.estoqueFinalizarContagem(contagem.id_contagem);
      aplicarContagem(det, setContagem, setRascunhoItens);
      await carregarListaContagens();
      showToast('Conferência finalizada');
      setVerDetalhe(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao finalizar', 'error');
    }
  };

  const confirmarReabrir = async () => {
    if (!contagem?.id_contagem) return;
    setReabrindo(true);
    try {
      const det = await api.estoqueReabrirContagem(contagem.id_contagem);
      aplicarContagem(det, setContagem, setRascunhoItens);
      await carregarListaContagens();
      setDlgReabrir(false);
      showToast('Conferência reaberta para edição', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível reabrir a conferência', 'error');
    } finally {
      setReabrindo(false);
    }
  };

  const excluirContagem = async () => {
    if (!contagem?.id_contagem || !podeExcluir) return;
    setExcluindo(true);
    try {
      await api.estoqueExcluirContagem(contagem.id_contagem);
      showToast('Conferência excluída');
      setDlgExcluir(false);
      setContagem(null);
      setVerDetalhe(false);
      setRascunhoItens({});
      await carregarListaContagens();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir', 'error');
    } finally {
      setExcluindo(false);
    }
  };

  const resumoLive = useMemo(() => {
    if (!contagem?.itens?.length) return null;
    let total = 0;
    let divergencias = 0;
    let pendentes = 0;
    let preenchidos = 0;
    for (const i of contagem.itens) {
      const raw = rascunhoItens[i.id_item];
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
      total += contado * i.valor_unidade;
      if (contado !== i.estoque_sistema) divergencias += 1;
    }
    return {
      total_valor: Math.round(total * 100) / 100,
      divergencias,
      pendentes,
      preenchidos,
      totalItens: contagem.itens.length,
    };
  }, [contagem, rascunhoItens]);

  const editavel = !!podeEditarConferencia && contagem?.status === 'aberta';
  /** Só bloqueia outras abas ao editar conferência aberta (não ao só visualizar finalizada). */
  const bloqueiaOutrasAbas = verDetalhe && contagem?.status === 'aberta';
  const abertasCount = listaContagens.filter((c) => c.status === 'aberta').length;
  const fechadasCount = listaContagens.filter((c) => c.status === 'finalizada').length;
  const listaFiltrada = useMemo(() => {
    if (filtroStatus === 'todas') return listaContagens;
    return listaContagens.filter((c) => c.status === filtroStatus);
  }, [listaContagens, filtroStatus]);
  const temAberta = abertasCount > 0;

  if (loadingLojas) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%', minHeight: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 2,
          flexWrap: 'wrap',
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <Tabs
          value={idLoja ? aba : false}
          onChange={(_e, v: AbaEstoque) => {
            if (bloqueiaOutrasAbas && v !== 'conferencia') return;
            irParaAba(v);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 40,
            minWidth: 220,
            flex: '0 1 auto',
          }}
        >
          {podeConferencia && (
            <Tab
              value="conferencia"
              label="Conferência"
              disabled={!idLoja}
              sx={{ minHeight: 40, textTransform: 'none', fontWeight: 600 }}
            />
          )}
          {podeProdutos && (
            <Tab
              value="insumos"
              label={`Insumos (${produtos.length})`}
              disabled={!idLoja || bloqueiaOutrasAbas}
              sx={{ minHeight: 40, textTransform: 'none' }}
            />
          )}
          {podeOperacional && (
            <Tab
              value="produtos"
              label={`Produtos (${produtosVendaCount})`}
              disabled={!idLoja || bloqueiaOutrasAbas}
              sx={{ minHeight: 40, textTransform: 'none' }}
            />
          )}
          {podeOperacional && (
            <Tab
              value="saldo"
              label="Saldo"
              disabled={!idLoja || bloqueiaOutrasAbas}
              sx={{ minHeight: 40, textTransform: 'none' }}
            />
          )}
          {podeOperacional && (
            <Tab
              value="vendas"
              label="Vendas"
              disabled={!idLoja || bloqueiaOutrasAbas}
              sx={{ minHeight: 40, textTransform: 'none' }}
            />
          )}
          {podeBreak && (
            <Tab
              value="break"
              label="Break"
              disabled={!idLoja || bloqueiaOutrasAbas}
              sx={{ minHeight: 40, textTransform: 'none' }}
            />
          )}
        </Tabs>
        {!bloqueiaOutrasAbas && (
          <FormControl size="small" sx={{ minWidth: 220, maxWidth: 320, mb: 0.75, flexShrink: 0 }}>
            <InputLabel shrink>Loja</InputLabel>
            <Select
              label="Loja"
              notched
              value={idLoja}
              displayEmpty
              onChange={(e) => selecionarLoja(Number(e.target.value))}
              MenuProps={{
                slotProps: {
                  paper: {
                    sx: {
                      maxHeight: 360,
                      overflowY: 'auto',
                    },
                  },
                },
              }}
            >
              {!idLoja && (
                <MenuItem value="" disabled>
                  Selecione a loja
                </MenuItem>
              )}
              {lojas.map((l) => (
                <MenuItem key={l.id_loja} value={l.id_loja}>
                  {rotuloLoja(l)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>

      {!idLoja ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">Selecione a loja para começar</Typography>
        </Paper>
      ) : loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <>
              {aba === 'conferencia' && podeConferencia && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
                  {!verDetalhe ? (
                    <>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 1.5,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Conferências da loja
                          </Typography>
                          {lojaAtual && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
                            >
                              <StorefrontIcon sx={{ fontSize: 18, color: colors.textSecondary }} />
                              {rotuloLoja(lojaAtual)}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                          {podeEditarConferencia && !temAberta && (
                            <Button
                              variant="contained"
                              startIcon={<PlayArrowIcon />}
                              disabled={iniciando}
                              onClick={() => void iniciarSabado()}
                            >
                              Iniciar conferência
                            </Button>
                          )}
                          <IconButton
                            onClick={() => void carregarListaContagens()}
                            aria-label="Atualizar"
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {(
                          [
                            ['todas', `Todas (${listaContagens.length})`],
                            ['aberta', `Abertas (${abertasCount})`],
                            ['finalizada', `Finalizadas (${fechadasCount})`],
                          ] as const
                        ).map(([value, label]) => {
                          const ativo = filtroStatus === value;
                          const sxFiltro =
                            value === 'aberta'
                              ? {
                                  ...chipAbertaSx,
                                  bgcolor: ativo ? '#FEF08A' : '#FEF9C3',
                                  opacity: ativo ? 1 : 0.92,
                                }
                              : value === 'finalizada'
                                ? {
                                    ...chipFinalizadaSx,
                                    bgcolor: ativo ? '#86EFAC' : '#DCFCE7',
                                    opacity: ativo ? 1 : 0.92,
                                  }
                                : ativo
                                  ? {
                                      bgcolor: colors.navyMuted,
                                      color: colors.navy,
                                      fontWeight: 700,
                                      border: `1px solid ${colors.navyBorder}`,
                                    }
                                  : undefined;
                          return (
                            <Chip
                              key={value}
                              label={label}
                              clickable
                              onClick={() => setFiltroStatus(value)}
                              variant="outlined"
                              sx={sxFiltro}
                            />
                          );
                        })}
                      </Box>

                      <Paper sx={tablePaperSx}>
                        <TableContainer sx={tableContainerSx}>
                          <Table stickyHeader size="small" sx={tableSx}>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={thCenter}>Status</TableCell>
                                <TableCell sx={thLeft}>Título</TableCell>
                                <TableCell sx={thLeft}>Realizado por</TableCell>
                                <TableCell sx={thCenter}>Iniciada</TableCell>
                                <TableCell sx={thCenter}>Finalizada</TableCell>
                                <TableCell sx={thCenter}>Itens</TableCell>
                                <TableCell sx={thCenter}>Pendentes</TableCell>
                                <TableCell sx={thCenter}>Divergências</TableCell>
                                <TableCell sx={thCenter}>Total R$</TableCell>
                                <TableCell sx={thCenter} width={48} />
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {listaFiltrada.map((c) => {
                                const aberta = c.status === 'aberta';
                                const divergencias = c.divergencias ?? 0;
                                return (
                                  <TableRow
                                    key={c.id_contagem}
                                    hover
                                    sx={{ cursor: 'pointer' }}
                                    onClick={() => void abrirContagem(c.id_contagem)}
                                  >
                                    <TableCell sx={tdCenter}>
                                      <Chip
                                        size="small"
                                        label={aberta ? 'Aberta' : 'Finalizada'}
                                        color={aberta ? undefined : 'success'}
                                        sx={
                                          aberta
                                            ? chipAbertaSx
                                            : {
                                                bgcolor: 'rgba(22, 163, 74, 0.15)',
                                                color: '#166534',
                                                fontWeight: 700,
                                              }
                                        }
                                      />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: aberta ? 700 : 500 }}>
                                      {c.titulo || `Conferência #${c.id_contagem}`}
                                    </TableCell>
                                    <TableCell sx={{ color: colors.textSecondary }}>
                                      {c.criado_por_nome || '—'}
                                    </TableCell>
                                    <TableCell sx={{ ...tdCenter, whiteSpace: 'nowrap' }}>
                                      {fmtDataHora(c.criado_em)}
                                    </TableCell>
                                    <TableCell sx={{ ...tdCenter, whiteSpace: 'nowrap' }}>
                                      {aberta ? '—' : fmtDataHora(c.finalizado_em)}
                                    </TableCell>
                                    <TableCell sx={tdCenter}>{c.itens_total ?? '—'}</TableCell>
                                    <TableCell sx={tdCenter}>{c.pendentes ?? 0}</TableCell>
                                    <TableCell
                                      sx={{
                                        ...tdCenter,
                                        fontWeight: divergencias ? 700 : 500,
                                        color: divergencias ? '#991b1b' : '#166534',
                                      }}
                                    >
                                      {divergencias}
                                    </TableCell>
                                    <TableCell sx={tdCenter}>{fmtMoeda(c.total_valor)}</TableCell>
                                    <TableCell sx={tdCenter}>
                                      <ChevronRightIcon fontSize="small" color="action" />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              {!listaFiltrada.length && (
                                <TableRow>
                                  <TableCell
                                    colSpan={10}
                                    align="center"
                                    sx={{ py: 4, color: colors.textSecondary }}
                                  >
                                    Nenhuma conferência nesta loja. Inicie uma para começar a
                                    contagem.
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>
                    </>
                  ) : (
                    <>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 1.5,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <IconButton onClick={voltarLista} aria-label="Voltar à lista">
                            <ArrowBackIcon />
                          </IconButton>
                          <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                              {contagem?.titulo || 'Conferência'}
                              {contagem?.criado_por_nome
                                ? ` · ${contagem.criado_por_nome}`
                                : ''}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}
                            >
                              {lojaAtual && (
                                <>
                                  <StorefrontIcon sx={{ fontSize: 18 }} />
                                  {rotuloLoja(lojaAtual)}
                                </>
                              )}
                              {contagem?.criado_em
                                ? ` · Iniciada ${fmtDataHora(contagem.criado_em)}`
                                : ''}
                              {contagem?.status === 'finalizada' && contagem.finalizado_em
                                ? ` · Finalizada ${fmtDataHora(contagem.finalizado_em)}`
                                : ''}
                            </Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {contagem?.status && (
                            <Chip
                              size="small"
                              label={contagem.status === 'finalizada' ? 'Finalizada' : 'Aberta'}
                              color={contagem.status === 'finalizada' ? 'success' : undefined}
                              sx={
                                contagem.status === 'finalizada'
                                  ? {
                                      bgcolor: 'rgba(22, 163, 74, 0.15)',
                                      color: '#166534',
                                      fontWeight: 700,
                                    }
                                  : chipAbertaSx
                              }
                            />
                          )}
                          {podeReabrir && contagem?.status === 'finalizada' && (
                            <Tooltip title="Reabrir">
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label="Reabrir conferência"
                                  disabled={reabrindo}
                                  onClick={() => setDlgReabrir(true)}
                                  sx={{ color: colors.navy }}
                                >
                                  {reabrindo ? (
                                    <CircularProgress size={18} />
                                  ) : (
                                    <LockOpenIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          <IconButton
                            onClick={() =>
                              contagem?.id_contagem
                                ? void abrirContagem(contagem.id_contagem)
                                : undefined
                            }
                            aria-label="Atualizar"
                          >
                            <RefreshIcon />
                          </IconButton>
                        </Box>
                      </Box>

                      {resumoLive && contagem?.id_contagem && (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={`${resumoLive.preenchidos}/${resumoLive.totalItens} contados`}
                            variant="outlined"
                          />
                          <Chip
                            label={`Pendentes: ${resumoLive.pendentes}`}
                            color={resumoLive.pendentes ? 'warning' : 'success'}
                          />
                          <Chip
                            label={`Divergências: ${resumoLive.divergencias}`}
                            variant="filled"
                            sx={
                              resumoLive.divergencias
                                ? {
                                    bgcolor: 'rgba(220, 38, 38, 0.14)',
                                    color: '#991b1b',
                                    fontWeight: 700,
                                  }
                                : {
                                    bgcolor: 'rgba(22, 163, 74, 0.14)',
                                    color: '#166534',
                                    fontWeight: 700,
                                  }
                            }
                          />
                          <Chip
                            label={`Total R$ estoque: ${fmtMoeda(resumoLive.total_valor)}`}
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      )}

                      <Paper sx={tablePaperSx}>
                        <TableContainer sx={tableContainerSx}>
                          <Table stickyHeader size="small" sx={tableSx}>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={thCenter}>Código</TableCell>
                                <TableCell sx={thLeft}>Descrição insumo</TableCell>
                                <TableCell sx={thCenter}>Unidade</TableCell>
                                <TableCell sx={thCenter}>Valor unid.</TableCell>
                                <TableCell sx={thCenter}>Estoque sistema</TableCell>
                                <TableCell sx={{ ...thCenter, minWidth: 130 }}>
                                  Estoque final
                                </TableCell>
                                <TableCell sx={thDiferencaSx}>Diferença</TableCell>
                                <TableCell sx={thCenter}>R$ Estoque</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(contagem?.itens as EstoqueItem[] | undefined)?.map((i) => {
                                const raw = rascunhoItens[i.id_item] ?? '';
                                const contado =
                                  raw === '' ? null : Number(String(raw).replace(',', '.'));
                                const preenchido = contado != null && Number.isFinite(contado);
                                const dif = !preenchido ? null : contado - i.estoque_sistema;
                                const valor = !preenchido
                                  ? null
                                  : Math.round(contado * i.valor_unidade * 100) / 100;
                                const comDivergencia = dif != null && dif !== 0;
                                return (
                                  <TableRow
                                    key={i.id_item}
                                    hover
                                    sx={
                                      comDivergencia
                                        ? linhaDivergenciaSx
                                        : preenchido
                                          ? linhaPreenchidaSx
                                          : undefined
                                    }
                                  >
                                    <TableCell
                                      sx={{ ...tdCenter, fontWeight: 600, whiteSpace: 'nowrap' }}
                                    >
                                      {i.codigo}
                                    </TableCell>
                                    <TableCell>{i.descricao}</TableCell>
                                    <TableCell sx={{ ...tdCenter, fontWeight: 600 }}>
                                      {String(i.unidade_contagem || '').toUpperCase()}
                                    </TableCell>
                                    <TableCell sx={tdCenter}>{fmtMoeda(i.valor_unidade)}</TableCell>
                                    <TableCell sx={tdCenter}>
                                      {fmtNum(i.estoque_sistema, 3)}
                                    </TableCell>
                                    <TableCell sx={tdCenter}>
                                      {editavel ? (
                                        <TextField
                                          size="small"
                                          value={raw}
                                          onChange={(e) =>
                                            setRascunhoItens((prev) => ({
                                              ...prev,
                                              [i.id_item]: e.target.value,
                                            }))
                                          }
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
                                              proximo.scrollIntoView({
                                                block: 'nearest',
                                                behavior: 'smooth',
                                              });
                                            }
                                          }}
                                          placeholder="0"
                                          slotProps={{
                                            htmlInput: {
                                              inputMode: 'decimal',
                                              style: { textAlign: 'center' },
                                              'data-estoque-final': '1',
                                            },
                                          }}
                                          sx={{ width: 110, mx: 'auto' }}
                                        />
                                      ) : (
                                        fmtNum(i.estoque_contado, 3)
                                      )}
                                    </TableCell>
                                    <TableCell sx={diferencaSx(dif)}>
                                      {dif == null ? '—' : fmtNum(dif, 3)}
                                    </TableCell>
                                    <TableCell sx={tdCenter}>{fmtMoeda(valor)}</TableCell>
                                  </TableRow>
                                );
                              })}
                              {!contagem?.itens?.length && (
                                <TableRow>
                                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                                    Esta loja ainda não tem insumos cadastrados
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Paper>

                      {editavel && (
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {podeExcluir && (
                            <IconButton
                              color="error"
                              onClick={() => setDlgExcluir(true)}
                              aria-label="Excluir conferência"
                              disabled={excluindo || salvandoItens}
                            >
                              <DeleteOutlineIcon />
                            </IconButton>
                          )}
                          <Button
                            variant="contained"
                            disabled={salvandoItens}
                            onClick={() => void salvarItens()}
                            sx={{
                              bgcolor: colors.orange,
                              '&:hover': { bgcolor: colors.orangeHover },
                            }}
                          >
                            Salvar (Rascunho)
                          </Button>
                          <Button
                            variant="contained"
                            disabled={salvandoItens}
                            onClick={() => void finalizarContagem()}
                          >
                            Finalizar conferência
                          </Button>
                        </Box>
                      )}
                      {!editavel && contagem?.id_contagem && (
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                          {podeReabrir && contagem.status === 'finalizada' && (
                            <Button
                              variant="outlined"
                              startIcon={
                                reabrindo ? <CircularProgress size={16} /> : <LockOpenIcon />
                              }
                              disabled={reabrindo}
                              onClick={() => setDlgReabrir(true)}
                              sx={{ fontWeight: 700 }}
                            >
                              Reabrir
                            </Button>
                          )}
                          {podeExcluir && (
                            <Button
                              color="error"
                              startIcon={<DeleteOutlineIcon />}
                              onClick={() => setDlgExcluir(true)}
                              disabled={excluindo}
                            >
                              Excluir conferência
                            </Button>
                          )}
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              )}

              {aba === 'insumos' && podeProdutos && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField
                      size="small"
                      placeholder="Buscar código ou descrição"
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void carregarProdutos();
                      }}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={{ minWidth: 260, flex: 1 }}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={() => void carregarProdutos()}
                    >
                      Buscar
                    </Button>
                    {podeEditarProdutos && (
                      <Button variant="contained" startIcon={<AddIcon />} onClick={abrirNovoProduto}>
                        Novo insumo
                      </Button>
                    )}
                  </Box>

                  <Paper sx={tablePaperSx}>
                    <TableContainer sx={tableContainerSx}>
                      <Table stickyHeader size="small" sx={tableSx}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={thCenter}>Código</TableCell>
                            <TableCell sx={thLeft}>Descrição insumo</TableCell>
                            <TableCell sx={thCenter}>Unidade</TableCell>
                            <TableCell sx={thCenter}>Preço caixa</TableCell>
                            <TableCell sx={thCenter}>UND convertida</TableCell>
                            <TableCell sx={thCenter}>Valor unid.</TableCell>
                            <TableCell sx={thCenter}>Status</TableCell>
                            {podeEditarProdutos && (
                              <TableCell sx={thCenter} align="center" width={56} />
                            )}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {produtos.map((p) => (
                            <TableRow key={p.id_produto} hover>
                              <TableCell sx={{ ...tdCenter, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {p.codigo}
                              </TableCell>
                              <TableCell>{p.descricao}</TableCell>
                              <TableCell sx={{ ...tdCenter, fontWeight: 600 }}>
                                {String(p.unidade_contagem || '').toUpperCase()}
                              </TableCell>
                              <TableCell sx={tdCenter}>{fmtMoeda(p.preco_caixa)}</TableCell>
                              <TableCell sx={tdCenter}>{fmtNum(p.und_convertida, 4)}</TableCell>
                              <TableCell sx={tdCenter}>{fmtMoeda(p.valor_unidade)}</TableCell>
                              <TableCell sx={tdCenter}>
                                <Chip
                                  size="small"
                                  label={p.ativo ? 'Ativo' : 'Inativo'}
                                  color={p.ativo ? 'success' : 'default'}
                                  variant="outlined"
                                />
                              </TableCell>
                              {podeEditarProdutos && (
                                <TableCell align="center">
                                  <IconButton
                                    size="small"
                                    onClick={() => abrirEditarProduto(p)}
                                    aria-label="Editar"
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                          {!produtos.length && (
                            <TableRow>
                              <TableCell
                                colSpan={8}
                                align="center"
                                sx={{ py: 4, color: colors.textSecondary }}
                              >
                                Nenhum insumo nesta loja — cadastre os itens dela
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Box>
              )}

              {((podeOperacional && (aba === 'saldo' || aba === 'vendas' || aba === 'produtos')) ||
                (podeBreak && aba === 'break')) &&
                typeof idLoja === 'number' && (
                  <EstoqueOperacionalPanels
                    aba={aba}
                    idLoja={idLoja}
                    produtos={produtos}
                    onProdutosVendaCountChange={setProdutosVendaCount}
                  />
                )}
            </>
          )}

      <Dialog open={dlgProduto} onClose={() => setDlgProduto(false)} fullWidth maxWidth="sm">
        <DialogTitleWithIcon
          plainIcon
          divider
          icon={editando ? <EditIcon /> : <Inventory2Icon />}
        >
          {editando ? 'Editar insumo' : 'Cadastrar insumo'}
        </DialogTitleWithIcon>
        <DialogContent sx={{ ...dialogContentSx, gap: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            Loja: {lojaAtual ? rotuloLoja(lojaAtual) : '—'}
          </Typography>
          <TextField
            label="Código"
            required
            {...dialogFieldProps}
            value={formProduto.codigo}
            onChange={(e) => setFormProduto((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
          />
          <TextField
            label="Descrição insumo"
            required
            {...dialogFieldProps}
            value={formProduto.descricao}
            onChange={(e) => setFormProduto((f) => ({ ...f, descricao: e.target.value }))}
            multiline
            minRows={2}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
              gap: 2,
              alignItems: 'stretch',
              '& .MuiFormControl-root': { height: '100%' },
              '& .MuiOutlinedInput-root': { minHeight: 56 },
            }}
          >
            <TextField
              select
              label="Unidade"
              {...dialogFieldProps}
              value={formProduto.unidade_contagem}
              onChange={(e) =>
                setFormProduto((f) => ({
                  ...f,
                  unidade_contagem: String(e.target.value).toUpperCase(),
                }))
              }
            >
              <MenuItem value="UND">UND</MenuItem>
              <MenuItem value="KG">KG</MenuItem>
              <MenuItem value="LT">LT</MenuItem>
              <MenuItem value="CX">CX</MenuItem>
            </TextField>
            <TextField
              label="Preço da caixa"
              {...dialogFieldProps}
              value={formProduto.preco_caixa}
              onChange={(e) => setFormProduto((f) => ({ ...f, preco_caixa: e.target.value }))}
              slotProps={{
                ...dialogFieldProps.slotProps,
                htmlInput: { inputMode: 'decimal' },
              }}
            />
            <TextField
              label="UND convertida"
              {...dialogFieldProps}
              value={formProduto.und_convertida}
              onChange={(e) => setFormProduto((f) => ({ ...f, und_convertida: e.target.value }))}
              slotProps={{
                ...dialogFieldProps.slotProps,
                htmlInput: { inputMode: 'decimal' },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDlgProduto(false)}>Cancelar</Button>
          <Button variant="contained" disabled={salvandoProduto} onClick={() => void salvarProduto()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dlgExcluir}
        onClose={() => !excluindo && setDlgExcluir(false)}
        fullWidth
        maxWidth="xs"
        sx={{
          '& .MuiDialog-container': { alignItems: 'center' },
        }}
      >
        <DialogTitleWithIcon plainIcon divider icon={<DeleteOutlineIcon color="error" />}>
          Excluir conferência?
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
          <Typography>
            Deseja excluir{' '}
            <strong>{contagem?.titulo || `a conferência #${contagem?.id_contagem}`}</strong>? Esta
            ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDlgExcluir(false)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={excluindo}
            onClick={() => void excluirContagem()}
          >
            Excluir
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={dlgReabrir}
        onClose={() => !reabrindo && setDlgReabrir(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitleWithIcon plainIcon divider icon={<LockOpenIcon />}>
          Reabrir conferência
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
          <Typography variant="body2" color="text.secondary">
            A conferência{' '}
            <strong>{contagem?.titulo || `#${contagem?.id_contagem}`}</strong> voltará para aberta e
            poderá ser editada. Ao finalizar de novo, o saldo será recalculado. Esta ação será
            registrada na auditoria.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDlgReabrir(false)} disabled={reabrindo}>
            Cancelar
          </Button>
          <Button variant="contained" disabled={reabrindo} onClick={() => void confirmarReabrir()}>
            {reabrindo ? 'Reabrindo…' : 'Reabrir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
