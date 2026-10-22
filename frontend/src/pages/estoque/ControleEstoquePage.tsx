import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
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
import { compararOrdemPlanilha } from '../../components/estoque/estoqueOrdemPlanilha';
import { assetUrl } from '../../config/paths';
import { ehLojaPopeyes } from '../../components/escalas/escalaVisitasUtils';
import { colors } from '../../theme/tokens';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import DialogTitleWithIcon from '../../components/DialogTitleWithIcon';
import PageLoading from '../../components/PageLoading';
import EstoqueOperacionalPanels, { BarraSegmento, CabecalhoDrawer, papelDrawerSx, type AbaOp } from './EstoqueOperacionalPanels';
import EstoqueConferenciaDetalhe from './EstoqueConferenciaDetalhe';
import {
  CONTAGEM_SEMANAL_ATIVA,
  ehDiaContagemCompletaObrigatoria,
  rotuloTipoContagem,
  type TipoContagemEstoque,
} from '../../components/estoque/estoqueContagemTipo';
import { gerarPdfContagemDiaria } from '../../utils/gerarPdfContagemDiaria';
import {
  modoEntradaEfetivo,
  rascunhoDeItemContagem,
} from '../../components/estoque/estoqueContagemCampo';
import {
  qtdPreviewSeguro,
  temEntradaTerraco,
} from '../../components/estoque/estoqueContagemCampo';

type AbaEstoque = 'cmv' | 'vendas' | 'rede' | 'piloto' | 'conferencia' | 'break' | 'pedido' | 'fichas' | 'saldo';

const ABAS_ESTOQUE: AbaEstoque[] = ['conferencia', 'vendas', 'rede', 'piloto', 'pedido', 'break', 'saldo', 'fichas'];

/** URLs antigas → essenciais da validação */
const REDIRECT_ABA: Record<string, AbaEstoque> = {
  insumos: 'fichas',
  estoque: 'saldo',
  produtos: 'fichas',
  ficha: 'fichas',
  kardex: 'saldo',
  nfe: 'conferencia',
  cmv: 'vendas',
  meta: 'vendas',
  sync: 'rede',
};

function isAbaEstoque(v: string | undefined): v is AbaEstoque {
  return !!v && (ABAS_ESTOQUE as string[]).includes(v);
}

function abaInicialPermitida(): AbaEstoque {
  if (podeConferenciaEstoque(getUsuario())) return 'conferencia';
  if (podeBreakEstoque(getUsuario())) return 'break';
  if (podeOperacionalEstoque(getUsuario())) return 'saldo';
  if (podeProdutosEstoque(getUsuario())) return 'fichas';
  return 'conferencia';
}

const LOJA_STORAGE_KEY = 'estoque.id_loja';

const chipAbertaSx = {
  height: 22,
  bgcolor: 'rgba(196, 122, 42, 0.14)',
  color: '#C47A2A',
  fontWeight: 650,
  fontSize: 11,
  border: '1px solid rgba(196, 122, 42, 0.35)',
} as const;

const chipFinalizadaSx = {
  height: 22,
  bgcolor: 'rgba(125, 146, 112, 0.16)',
  color: '#5C7052',
  fontWeight: 650,
  fontSize: 11,
  border: '1px solid rgba(125, 146, 112, 0.4)',
} as const;

const toggleRelatorioSx = {
  bgcolor: 'var(--ga-canvas-alt)',
  borderRadius: '8px',
  p: 0.35,
  '& .MuiToggleButtonGroup-grouped': {
    border: 0,
    borderRadius: '6px !important',
    px: 1.25,
    py: 0.45,
    textTransform: 'none',
    fontWeight: 600,
    fontSize: 13,
    color: 'var(--ga-text-secondary)',
    '&.Mui-selected': {
      bgcolor: 'var(--ga-surface)',
      color: 'var(--ga-text-primary)',
      boxShadow: 'none',
      '&:hover': { bgcolor: 'var(--ga-surface)' },
    },
  },
} as const;

/** Fundo opaco no sticky — adapta ao tema escuro e claro */
const thCenter = {
  textAlign: 'center',
  fontWeight: 650,
  fontSize: 11,
  letterSpacing: '0.02em',
  bgcolor: 'var(--ga-surface) !important',
  color: 'var(--ga-text-secondary)',
  backgroundImage: 'none !important',
  backgroundClip: 'padding-box',
  zIndex: 4,
  boxShadow: 'inset 0 -1px 0 var(--ga-border)',
} as const;

const thLeft = {
  fontWeight: 650,
  fontSize: 11,
  letterSpacing: '0.02em',
  bgcolor: 'var(--ga-surface) !important',
  color: 'var(--ga-text-secondary)',
  backgroundImage: 'none !important',
  backgroundClip: 'padding-box',
  zIndex: 4,
  boxShadow: 'inset 0 -1px 0 var(--ga-border)',
} as const;

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

function tituloLoja(l: Loja) {
  return l.name.replace(/\s+-\s+/g, ' · ');
}

function subtituloLoja(l: Loja) {
  const cidadeNoNome = l.city && l.name.toUpperCase().includes(l.city.toUpperCase());
  return [l.bk_number, cidadeNoNome ? null : l.city].filter(Boolean).join(' · ');
}

function MarcaLoja({ nome, size = 28 }: { nome?: string | null; size?: number }) {
  const icone = ehLojaPopeyes(nome) ? 'Popeyes.png' : 'BK_logo.png';
  return (
    <Box
      component="img"
      src={assetUrl(icone)}
      alt=""
      sx={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, borderRadius: '6px' }}
    />
  );
}

const ABAS_VENDAS = ['vendas', 'rede', 'piloto'] as const;

function abaDaBarra(aba: AbaEstoque): AbaEstoque {
  return (ABAS_VENDAS as readonly string[]).includes(aba) ? 'vendas' : aba;
}

const UNIDADES_FRACIONADAS = ['KG', 'UND', 'L'] as const;

const emptyProdutoForm = {
  codigo: '',
  descricao: '',
  unidade_contagem: 'UND',
  unidade_fracionada: 'UND',
  preco_caixa: '',
  und_convertida: '1',
  permite_contagem_caixa: true,
  permite_contagem_pc_fd: true,
  permite_contagem_kg_und: true,
};

type ProdutoForm = typeof emptyProdutoForm;

const tdCenter = { textAlign: 'center' } as const;

type RascunhoLinha = { caixa: string; pc: string; kg: string; modo?: 'und' | 'kg' };

function parseNumCampo(raw: string): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function rascunhoDeItem(i: EstoqueItem): RascunhoLinha {
  return rascunhoDeItemContagem(i);
}

function aplicarContagem(
  det: EstoqueContagemDetalhe | null,
  setContagem: (c: EstoqueContagemDetalhe | null) => void,
  setRascunho: (r: Record<number, RascunhoLinha>) => void,
) {
  if (!det?.id_contagem) {
    setContagem(det?.meta ? det : null);
    setRascunho({});
    return;
  }
  setContagem(det);
  const draft: Record<number, RascunhoLinha> = {};
  for (const i of det.itens || []) {
    draft[i.id_item] = rascunhoDeItem(i);
  }
  setRascunho(draft);
}

function AbasControleEstoque({
  value,
  onChange,
  bloqueiaOutrasAbas,
  podeConferencia,
  podeOperacional,
  podeBreak,
  idLoja,
  moduloVendas,
}: {
  value: AbaEstoque | false;
  onChange: (v: AbaEstoque) => void;
  bloqueiaOutrasAbas: boolean;
  podeConferencia: boolean;
  podeOperacional: boolean;
  podeBreak: boolean;
  idLoja: number | '';
  /** Módulo Vendas separado: só Números/Sync/Baixa (sem misturar com estoque). */
  moduloVendas?: boolean;
}) {
  const semLoja = !idLoja;

  if (moduloVendas) {
    return null;
  }

  return (
    <Tabs
      value={value}
      onChange={(_e, v: AbaEstoque) => {
        if (bloqueiaOutrasAbas && v !== 'conferencia') return;
        (document.activeElement as HTMLElement | null)?.blur?.();
        onChange(v);
      }}
      variant="scrollable"
      scrollButtons="auto"
      sx={{
        minHeight: 36,
        minWidth: 0,
        borderBottom: '1px solid var(--ga-border)',
        '& .MuiTabs-indicator': { display: 'none' },
        '& .MuiTab-root': {
          minHeight: 36,
          minWidth: 0,
          textTransform: 'none',
          letterSpacing: '-0.01em',
          fontWeight: 600,
          fontSize: 13,
          color: 'var(--ga-text-muted)',
          px: { xs: 1.1, md: 1.4 },
          '&.Mui-selected': {
            color: 'var(--ga-text-primary) !important',
          },
        },
      }}
    >
      {podeConferencia && (
        <Tab disableRipple value="conferencia" label="Conferência" disabled={semLoja} />
      )}
      {podeBreak && (
        <Tab disableRipple value="break" label="Break" disabled={semLoja || bloqueiaOutrasAbas} />
      )}
      {podeOperacional && (
        <Tab disableRipple value="saldo" label="Saldo" disabled={semLoja || bloqueiaOutrasAbas} />
      )}
      {podeOperacional && (
        <Tab disableRipple value="pedido" label="Pedido" disabled={semLoja || bloqueiaOutrasAbas} />
      )}
      {podeOperacional && (
        <Tab disableRipple value="fichas" label="Cadastro" disabled={semLoja || bloqueiaOutrasAbas} />
      )}
    </Tabs>
  );
}

export default function ControleEstoquePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { aba: abaParam } = useParams<{ aba: string }>();
  const moduloVendas = location.pathname.startsWith('/vendas');
  usePageTitle(moduloVendas ? 'Vendas' : 'Estoque');
  const user = getUsuario();
  const podeProdutos = podeProdutosEstoque(user);
  const podeConferencia = podeConferenciaEstoque(user);
  const podeOperacional = podeOperacionalEstoque(user);
  const podeBreak = podeBreakEstoque(user);
  const podeEditarConferencia = podeConferencia;
  const podeExcluir = podeExcluirEstoque(user);
  const podeReabrir = podeReabrirContagemEstoque(user);

  const abaRaw: AbaEstoque = isAbaEstoque(abaParam)
    ? abaParam
    : moduloVendas
      ? 'vendas'
      : abaInicialPermitida();
  const aba: AbaEstoque = moduloVendas && !(ABAS_VENDAS as readonly string[]).includes(abaRaw)
    ? 'vendas'
    : !moduloVendas && (ABAS_VENDAS as readonly string[]).includes(abaRaw)
      ? abaInicialPermitida()
      : abaRaw;

  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);
  const [lojaAnchor, setLojaAnchor] = useState<HTMLElement | null>(null);
  const [lojaBusca, setLojaBusca] = useState('');

  const irParaAba = useCallback(
    (proxima: AbaEstoque) => {
      if (proxima === aba) return;
      setHeaderActions(null);
      if ((ABAS_VENDAS as readonly string[]).includes(proxima)) {
        navigate(`/vendas/${proxima}`);
        return;
      }
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
  const [listaContagens, setListaContagens] = useState<EstoqueContagemResumo[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'aberta' | 'finalizada'>('todas');
  const [contagem, setContagem] = useState<EstoqueContagemDetalhe | null>(null);
  const [verDetalhe, setVerDetalhe] = useState(false);
  const [iniciando, setIniciando] = useState(false);

  const [dlgProduto, setDlgProduto] = useState(false);
  const [editando, setEditando] = useState<ProdutoEstoque | null>(null);
  const [formProduto, setFormProduto] = useState<ProdutoForm>(emptyProdutoForm);
  const [salvandoProduto, setSalvandoProduto] = useState(false);

  const [rascunhoItens, setRascunhoItens] = useState<Record<number, RascunhoLinha>>({});
  const [salvandoItens, setSalvandoItens] = useState(false);
  const [dlgExcluir, setDlgExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [dlgReabrir, setDlgReabrir] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [baixandoRelatorio, setBaixandoRelatorio] = useState(false);
  const [dlgRelatorio, setDlgRelatorio] = useState(false);
  const [relatorioTipo, setRelatorioTipo] = useState<TipoContagemEstoque>('diaria');
  const [relatorioModo, setRelatorioModo] = useState<'estrutura' | 'dados'>('dados');

  const lojaAtual = useMemo(
    () => lojas.find((l) => l.id_loja === idLoja) || null,
    [lojas, idLoja],
  );
  const lojasFiltradas = useMemo(() => {
    const q = lojaBusca.trim().toLowerCase();
    if (!q) return lojas;
    return lojas.filter((l) =>
      [l.name, l.bk_number, l.city, tituloLoja(l), subtituloLoja(l)].some((v) =>
        String(v || '').toLowerCase().includes(q),
      ),
    );
  }, [lojas, lojaBusca]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingLojas(true);
      try {
        const rows = await api.estoqueLojas({ ativas: true, operacionais: true });
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

  const selecionarLoja = useCallback((id: number) => {
    setIdLoja(id);
    localStorage.setItem(LOJA_STORAGE_KEY, String(id));
    setContagem(null);
    setListaContagens([]);
    setProdutos([]);
    setRascunhoItens({});
    setVerDetalhe(false);
  }, []);

  const carregarProdutos = useCallback(async () => {
    if (!idLoja) return;
    const rows = await api.estoqueProdutos({ id_loja: idLoja });
    setProdutos(rows);
  }, [idLoja]);

  const irParaFichas = useCallback(() => irParaAba('fichas'), [irParaAba]);
  const irParaRede = useCallback(() => navigate('/estoque/rede'), [navigate]);
  const recarregarInsumos = useCallback(() => {
    void carregarProdutos();
  }, [carregarProdutos]);

  const abrirNovoInsumo = () => {
    setEditando(null);
    setFormProduto({ ...emptyProdutoForm });
    setDlgProduto(true);
  };

  const abrirEditarInsumo = (p: ProdutoEstoque) => {
    const uc = String(p.unidade_contagem || 'UND').toUpperCase();
    const uf = String(p.unidade_fracionada || uc).toUpperCase();
    setEditando(p);
    setFormProduto({
      codigo: p.codigo || '',
      descricao: p.descricao || '',
      unidade_contagem: uc,
      unidade_fracionada: uf,
      preco_caixa: p.preco_caixa != null ? String(p.preco_caixa) : '',
      und_convertida: p.und_convertida != null ? String(p.und_convertida) : '1',
      permite_contagem_caixa: p.permite_contagem_caixa !== false,
      permite_contagem_pc_fd: p.permite_contagem_pc_fd !== false,
      permite_contagem_kg_und: p.permite_contagem_kg_und !== false,
    });
    setDlgProduto(true);
  };

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

  const carregarTudo = useCallback(async () => {
    if (!idLoja) return;
    setLoading(true);
    try {
      const jobs: Promise<unknown>[] = [];
      if (podeProdutos || podeOperacional || podeBreak) jobs.push(carregarProdutos());
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
    if (moduloVendas) {
      if (abaParam === 'pedido') {
        navigate('/estoque/pedido', { replace: true });
        return;
      }
      if (!isAbaEstoque(abaParam) || !(ABAS_VENDAS as readonly string[]).includes(abaParam || '')) {
        navigate('/vendas/vendas', { replace: true });
        return;
      }
      if (!podeOperacional) {
        navigate('/estoque/conferencia', { replace: true });
      }
      return;
    }
    if (abaParam && REDIRECT_ABA[abaParam]) {
      const dest = REDIRECT_ABA[abaParam];
      if ((ABAS_VENDAS as readonly string[]).includes(dest)) {
        navigate(`/vendas/${dest}`, { replace: true });
      } else {
        navigate(`/estoque/${dest}`, { replace: true });
      }
      return;
    }
    if (!isAbaEstoque(abaParam)) {
      navigate(`/estoque/${abaInicialPermitida()}`, { replace: true });
      return;
    }
    if ((ABAS_VENDAS as readonly string[]).includes(abaParam || '')) {
      navigate(`/vendas/${abaParam}`, { replace: true });
      return;
    }
    if (verDetalhe && contagem?.status === 'aberta' && aba !== 'conferencia') {
      navigate('/estoque/conferencia', { replace: true });
      return;
    }
    const abasOp: AbaEstoque[] = ['saldo', 'fichas'];
    let destino: AbaEstoque | null = null;
    if (aba === 'conferencia' && !podeConferencia) {
      destino = podeBreak ? 'break' : podeOperacional ? 'saldo' : 'fichas';
    } else if (aba === 'break' && !podeBreak) {
      destino = podeConferencia ? 'conferencia' : podeOperacional ? 'saldo' : 'fichas';
    } else if (abasOp.includes(aba) && !podeOperacional) {
      destino = podeConferencia ? 'conferencia' : podeBreak ? 'break' : 'fichas';
    }
    if (destino && destino !== aba) {
      navigate(`/estoque/${destino}`, { replace: true });
    }
  }, [aba, abaParam, moduloVendas, navigate, podeConferencia, podeProdutos, podeOperacional, podeBreak, verDetalhe, contagem?.status]);

  const iniciarSabado = async (tipo: TipoContagemEstoque = 'diaria') => {
    if (!podeEditarConferencia || !idLoja) return;
    if (tipo === 'critica_semanal' && !CONTAGEM_SEMANAL_ATIVA) {
      showToast('Contagem semanal está desativada', 'error');
      return;
    }
    setIniciando(true);
    try {
      const det = await api.estoqueIniciarSabado({ id_loja: idLoja, tipo });
      await carregarListaContagens();
      aplicarContagem(det, setContagem, setRascunhoItens);
      setVerDetalhe(true);
      const label =
        tipo === 'diaria'
          ? 'Contagem diária'
          : tipo === 'critica_semanal'
            ? 'Contagem semanal'
            : 'Contagem completa';
      if (det.meta?.ja_finalizada) {
        showToast('Diária de hoje já foi finalizada — abrindo consulta');
      } else {
        showToast(det.meta?.iniciada_agora ? `${label} iniciada` : `${label} aberta`);
      }
      irParaAba('conferencia');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao iniciar conferência', 'error');
    } finally {
      setIniciando(false);
    }
  };

  const setCampoContagemForm = (
    campo: 'permite_contagem_caixa' | 'permite_contagem_pc_fd' | 'permite_contagem_kg_und',
    checked: boolean,
  ) => {
    const next = { ...formProduto, [campo]: checked };
    if (!next.permite_contagem_caixa && !next.permite_contagem_pc_fd && !next.permite_contagem_kg_und) {
      showToast('Deixe pelo menos um campo de contagem liberado', 'error');
      return;
    }
    setFormProduto(next);
  };

  const salvarProduto = async () => {
    if (!idLoja) return;
    if (
      !formProduto.permite_contagem_caixa &&
      !formProduto.permite_contagem_pc_fd &&
      !formProduto.permite_contagem_kg_und
    ) {
      showToast('Deixe pelo menos um campo de contagem liberado', 'error');
      return;
    }
    setSalvandoProduto(true);
    try {
      const body = {
        id_loja: idLoja,
        codigo: formProduto.codigo.trim(),
        descricao: formProduto.descricao.trim(),
        unidade_contagem: formProduto.unidade_contagem.toUpperCase(),
        unidade_fracionada: formProduto.unidade_fracionada.toUpperCase(),
        preco_caixa: Number(String(formProduto.preco_caixa).replace(',', '.')),
        und_convertida: Number(String(formProduto.und_convertida).replace(',', '.')),
        permite_contagem_caixa: formProduto.permite_contagem_caixa,
        permite_contagem_pc_fd: formProduto.permite_contagem_pc_fd,
        permite_contagem_kg_und: formProduto.permite_contagem_kg_und,
      };
      if (editando) {
        await api.estoqueAtualizarProduto(editando.id_produto, body);
        showToast('Insumo atualizado');
      } else {
        await api.estoqueCriarProduto(body);
        showToast('Insumo cadastrado nesta loja');
      }
      setDlgProduto(false);
      setEditando(null);
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
        const raw = rascunhoItens[i.id_item] || { caixa: '', pc: '', kg: '' };
        const modo = modoEntradaEfetivo(i, raw);
        return {
          id_item: i.id_item,
          contagem_caixa: parseNumCampo(raw.caixa),
          contagem_pc_fd: parseNumCampo(raw.pc),
          contagem_kg_und: parseNumCampo(raw.kg),
          unidade_entrada: (modo === 'kg' ? 'KG' : 'UND') as 'UND' | 'KG',
        };
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

  const abrirDlgRelatorio = (tipo?: TipoContagemEstoque, modo?: 'estrutura' | 'dados') => {
    const t = tipo === 'diaria' || tipo === 'critica_semanal' || tipo === 'completa' ? tipo : 'diaria';
    setRelatorioTipo(t);
    setRelatorioModo(modo || 'dados');
    setDlgRelatorio(true);
  };

  const baixarRelatorioDiaria = async (opts?: {
    tipo?: TipoContagemEstoque;
    modo?: 'estrutura' | 'dados';
    detalhe?: EstoqueContagemDetalhe | null;
    id_contagem?: number;
  }) => {
    if (baixandoRelatorio || !idLoja) return;
    const tipo = opts?.tipo || relatorioTipo;
    const modo = opts?.modo || relatorioModo;
    setBaixandoRelatorio(true);
    try {
      if (opts?.id_contagem) {
        const detalhe = await api.estoqueContagem(opts.id_contagem);
        await gerarPdfContagemDiaria({
          contagem: detalhe,
          loja: lojaAtual,
          modo: 'dados',
        });
        showToast(
          detalhe.status === 'finalizada'
            ? 'Relatório com os dados da contagem'
            : 'Relatório com os dados da contagem aberta',
        );
        return;
      }
      const detalheAberto =
        opts?.detalhe ||
        (contagem?.tipo === tipo && verDetalhe ? contagem : null);
      if (modo === 'dados' && detalheAberto?.id_contagem && detalheAberto.tipo === tipo) {
        await gerarPdfContagemDiaria({
          contagem: detalheAberto,
          loja: lojaAtual,
          rascunho: rascunhoItens,
          modo: 'dados',
        });
        showToast(
          detalheAberto.status === 'finalizada'
            ? 'Relatório com os dados da contagem'
            : 'Relatório com os dados da contagem aberta',
        );
        setDlgRelatorio(false);
        return;
      }

      const resp = await api.estoqueRelatorioContagem({
        id_loja: idLoja,
        tipo,
        modo,
      });
      await gerarPdfContagemDiaria({
        contagem: resp.contagem,
        loja: lojaAtual,
        modo: resp.modo,
      });
      if (resp.usou_estrutura) {
        showToast('Não havia contagem desse tipo — baixei só a estrutura', 'warning');
      } else if (resp.modo === 'estrutura') {
        showToast('Modelo baixado (só a estrutura)');
      } else {
        showToast(
          resp.contagem.status === 'finalizada'
            ? 'Relatório com os dados da última contagem'
            : 'Relatório com os dados da contagem aberta',
        );
      }
      setDlgRelatorio(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao gerar relatório', 'error');
    } finally {
      setBaixandoRelatorio(false);
    }
  };

  const itensOrdenados = useMemo(
    () => [...(contagem?.itens || [])].sort(compararOrdemPlanilha),
    [contagem?.itens],
  );

  const resumoLive = useMemo(() => {
    if (!contagem?.itens?.length) return null;
    let total = 0;
    let divergencias = 0;
    let pendentes = 0;
    let preenchidos = 0;
    for (const i of contagem.itens) {
      const raw = rascunhoItens[i.id_item];
      if (!temEntradaTerraco(raw)) {
        pendentes += 1;
        continue;
      }
      preenchidos += 1;
      const contado = qtdPreviewSeguro(i, raw);
      if (contado != null && Number.isFinite(contado)) {
        total += contado * i.valor_unidade;
        if (contado !== i.estoque_sistema) divergencias += 1;
      }
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
  const chromeCompacto =
    aba === 'saldo' ||
    aba === 'conferencia' ||
    aba === 'vendas' ||
    aba === 'rede' ||
    aba === 'piloto' ||
    aba === 'pedido' ||
    aba === 'break' ||
    aba === 'fichas';
  const noGrupoVendas = moduloVendas || (ABAS_VENDAS as readonly string[]).includes(aba);

  if (loadingLojas) {
    return <PageLoading label="Carregando lojas…" />;
  }

  return (
    <Box
      className="cc-page-main"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        height: '100%',
        minHeight: 0,
        overflow: chromeCompacto ? 'hidden' : 'auto',
        '& .MuiButton-root': {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: 13,
          borderRadius: '8px',
          boxShadow: 'none',
        },
        '& .MuiButton-contained:hover': { boxShadow: 'none' },
        '& .MuiChip-root': { borderRadius: '6px' },
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ flex: '0 1 auto' }}>
            <Box
              component={lojas.length > 1 && !bloqueiaOutrasAbas ? 'button' : 'div'}
              type={lojas.length > 1 && !bloqueiaOutrasAbas ? 'button' : undefined}
              onClick={(e) => {
                if (bloqueiaOutrasAbas || lojas.length <= 1) return;
                setLojaBusca('');
                setLojaAnchor(e.currentTarget);
              }}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                border: 0,
                p: 0,
                bgcolor: 'transparent',
                color: 'inherit',
                font: 'inherit',
                cursor: !bloqueiaOutrasAbas && lojas.length > 1 ? 'pointer' : 'default',
                textAlign: 'left',
              }}
            >
              <MarcaLoja nome={lojaAtual?.name} size={18} />
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                  {lojaAtual ? tituloLoja(lojaAtual) : 'Selecione a loja'}
                </Typography>
                {lojaAtual ? (
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                    {subtituloLoja(lojaAtual)}
                  </Typography>
                ) : null}
              </Box>
              {!bloqueiaOutrasAbas && lojas.length > 1 ? (
                <KeyboardArrowDownIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              ) : null}
            </Box>
            <Popover
              open={Boolean(lojaAnchor)}
              anchorEl={lojaAnchor}
              onClose={() => setLojaAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              transformOrigin={{ vertical: 'top', horizontal: 'left' }}
              disableScrollLock
              slotProps={{
                paper: {
                  sx: {
                    mt: 0.75,
                    width: 360,
                    maxWidth: 'calc(100vw - 24px)',
                    borderRadius: '8px',
                    border: '1px solid var(--ga-border)',
                    bgcolor: 'var(--ga-surface)',
                    backgroundImage: 'none',
                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                    overflow: 'hidden',
                  },
                },
              }}
            >
              <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <TextField
                  autoFocus
                  size="small"
                  fullWidth
                  placeholder="Buscar loja…"
                  value={lojaBusca}
                  onChange={(e) => setLojaBusca(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { height: 32, fontSize: 13 } }}
                />
              </Box>
              <Box sx={{ maxHeight: 320, overflow: 'auto', py: 0.5 }}>
                {lojasFiltradas.map((l) => {
                  const ativa = l.id_loja === idLoja;
                  return (
                    <Box
                      key={l.id_loja}
                      component="button"
                      type="button"
                      onClick={() => {
                        selecionarLoja(l.id_loja);
                        setLojaAnchor(null);
                      }}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.25,
                        py: 0.75,
                        border: 0,
                        bgcolor: ativa ? 'var(--ga-canvas-alt)' : 'transparent',
                        color: 'inherit',
                        font: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'var(--ga-canvas-alt)' },
                      }}
                    >
                      <MarcaLoja nome={l.name} size={22} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                          {tituloLoja(l)}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2 }}>
                          {subtituloLoja(l) || '—'}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
                {!lojasFiltradas.length ? (
                  <Typography sx={{ px: 1.5, py: 1.5, fontSize: 13, color: 'text.secondary' }}>
                    Nenhuma loja
                  </Typography>
                ) : null}
              </Box>
            </Popover>
          </Box>
          {headerActions ? (
            <Box sx={{ display: 'flex', alignItems: 'center', ml: { md: 'auto' } }}>
              {headerActions}
            </Box>
          ) : null}
        </Box>
        <Box sx={{ mt: 1 }}>
          <AbasControleEstoque
            value={idLoja ? abaDaBarra(aba) : false}
            onChange={(proxima) => {
              if (proxima === 'vendas' && noGrupoVendas) return;
              irParaAba(proxima);
            }}
            bloqueiaOutrasAbas={bloqueiaOutrasAbas}
            podeConferencia={podeConferencia}
            podeOperacional={podeOperacional}
            podeBreak={podeBreak}
            idLoja={idLoja}
            moduloVendas={moduloVendas}
          />
          {idLoja && podeOperacional && noGrupoVendas && !bloqueiaOutrasAbas ? (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={aba}
              onChange={(_e, v: AbaEstoque | null) => {
                if (v) irParaAba(v);
              }}
              sx={{ ...toggleRelatorioSx, mt: 1 }}
            >
              <ToggleButton value="vendas">Números</ToggleButton>
              <ToggleButton value="rede">Sync</ToggleButton>
              <ToggleButton value="piloto">Baixa</ToggleButton>
            </ToggleButtonGroup>
          ) : null}
        </Box>
      </Box>

      {!idLoja ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: '8px' }}>
          <Typography color="text.secondary">Selecione a loja para começar</Typography>
        </Paper>
      ) : loading ? (
        <PageLoading label="Carregando dados do estoque…" />
      ) : (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: chromeCompacto ? 'hidden' : 'auto',
          }}
        >
          {aba === 'conferencia' && podeConferencia && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: verDetalhe ? 1 : 1.5, flex: 1, minHeight: 0, overflow: 'hidden' }}>
              {!verDetalhe ? (
                <>
                  <BarraSegmento
                    itens={[
                      { id: 'todas', label: 'Todas', qtd: listaContagens.length, ativo: filtroStatus === 'todas', onClick: () => setFiltroStatus('todas') },
                      { id: 'aberta', label: 'Abertas', qtd: abertasCount, ativo: filtroStatus === 'aberta', cor: '#C47A2A', onClick: () => setFiltroStatus('aberta') },
                      { id: 'finalizada', label: 'Finalizadas', qtd: fechadasCount, ativo: filtroStatus === 'finalizada', cor: '#5C7052', onClick: () => setFiltroStatus('finalizada') },
                    ]}
                  />

                  <Paper variant="outlined" sx={{ ...tablePaperSx, boxShadow: 'none', borderRadius: '8px', borderColor: 'var(--ga-border)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 44, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 650, letterSpacing: '-0.01em' }}>Contagens</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{listaFiltrada.length}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', ml: 'auto' }}>
                      {podeEditarConferencia && (
                        <>
                          {!ehDiaContagemCompletaObrigatoria() && (
                            <Button
                              variant="contained"
                              startIcon={<PlayArrowIcon />}
                              disabled={iniciando}
                              onClick={() => void iniciarSabado('diaria')}
                            >
                              Diária
                            </Button>
                          )}
                          {CONTAGEM_SEMANAL_ATIVA && (
                          <Button
                            variant="outlined"
                            startIcon={<PlayArrowIcon />}
                            disabled={iniciando}
                            onClick={() => void iniciarSabado('critica_semanal')}
                          >
                            Semanal (segunda)
                          </Button>
                          )}
                          <Button
                            variant="outlined"
                            startIcon={<PlayArrowIcon />}
                            disabled={iniciando}
                            onClick={() => void iniciarSabado('completa')}
                          >
                            Completa
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outlined"
                        startIcon={
                          baixandoRelatorio ? (
                            <CircularProgress size={16} />
                          ) : (
                            <FileDownloadOutlinedIcon />
                          )
                        }
                        disabled={baixandoRelatorio}
                        onClick={() => abrirDlgRelatorio()}
                      >
                        Baixar relatório
                      </Button>
                      <IconButton
                        onClick={() => void carregarListaContagens()}
                        aria-label="Atualizar"
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Box>
                  </Box>
                        <TableContainer sx={tableContainerSx}>
                          <Table stickyHeader size="small" sx={tableSx}>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={thCenter}>Status</TableCell>
                                <TableCell sx={thLeft}>Título</TableCell>
                                <TableCell sx={thLeft}>Realizado por</TableCell>
                                <TableCell sx={thCenter}>Iniciada</TableCell>
                                <TableCell sx={thCenter}>Finalizada</TableCell>
                                <TableCell sx={thCenter}>Valor atual</TableCell>
                                <TableCell sx={thCenter}>Itens</TableCell>
                                <TableCell sx={thCenter}>Pendentes</TableCell>
                                <TableCell sx={thCenter}>Divergências</TableCell>
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
                                      <Typography
                                        component="span"
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ ml: 1, fontWeight: 600 }}
                                      >
                                        {rotuloTipoContagem(c.tipo)}
                                      </Typography>
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
                                    <TableCell sx={{ ...tdCenter, whiteSpace: 'nowrap', fontWeight: 700 }}>
                                      {fmtBrl(c.valor_atual ?? c.total_valor)}
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
                                    <TableCell
                                      sx={tdCenter}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Tooltip title="Baixar relatório desta contagem">
                                        <span>
                                          <IconButton
                                            size="small"
                                            aria-label="Baixar relatório desta contagem"
                                            disabled={baixandoRelatorio}
                                            onClick={() =>
                                              void baixarRelatorioDiaria({
                                                id_contagem: c.id_contagem,
                                              })
                                            }
                                            sx={{ color: 'inherit' }}
                                          >
                                            {baixandoRelatorio ? (
                                              <CircularProgress size={16} />
                                            ) : (
                                              <FileDownloadOutlinedIcon fontSize="small" />
                                            )}
                                          </IconButton>
                                        </span>
                                      </Tooltip>
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
                  ) : contagem ? (
                    <EstoqueConferenciaDetalhe
                      contagem={contagem}
                      lojaAtual={lojaAtual}
                      itens={itensOrdenados}
                      rascunho={rascunhoItens}
                      setRascunho={setRascunhoItens}
                      editavel={editavel}
                      resumo={resumoLive}
                      salvando={salvandoItens}
                      excluindo={excluindo}
                      reabrindo={reabrindo}
                      podeExcluir={podeExcluir}
                      podeReabrir={podeReabrir}
                      onVoltar={voltarLista}
                      onAtualizar={() => {
                        if (contagem.id_contagem) void abrirContagem(contagem.id_contagem);
                      }}
                      onSalvar={() => void salvarItens()}
                      onFinalizar={() => void finalizarContagem()}
                      onExcluir={() => setDlgExcluir(true)}
                      onReabrir={() => setDlgReabrir(true)}
                      onBaixarRelatorio={() =>
                        void baixarRelatorioDiaria({
                          detalhe: contagem,
                          modo: 'dados',
                          tipo:
                            contagem.tipo === 'diaria' ||
                            contagem.tipo === 'critica_semanal' ||
                            contagem.tipo === 'completa'
                              ? contagem.tipo
                              : 'diaria',
                        })
                      }
                      baixandoRelatorio={baixandoRelatorio}
                    />
                  ) : null}
                </Box>
              )}

              {((podeOperacional && (aba === 'vendas' || aba === 'rede' || aba === 'piloto' || aba === 'pedido' || aba === 'saldo' || aba === 'fichas')) ||
                (podeBreak && aba === 'break')) &&
                typeof idLoja === 'number' && (
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: chromeCompacto ? 'hidden' : undefined,
                    }}
                  >
                    <EstoqueOperacionalPanels
                      aba={aba as AbaOp}
                      idLoja={idLoja}
                      produtos={produtos}
                      onInsumosReload={recarregarInsumos}
                      onNovoInsumo={podeProdutos ? abrirNovoInsumo : undefined}
                      onEditarInsumo={podeProdutos ? abrirEditarInsumo : undefined}
                      onIrFichas={irParaFichas}
                      onIrRede={irParaRede}
                      onSelectLoja={selecionarLoja}
                      onSetHeaderActions={setHeaderActions}
                    />
                  </Box>
                )}
            </Box>
          )}

      <Drawer
        anchor="right"
        open={dlgProduto}
        onClose={() => {
          setDlgProduto(false);
          setEditando(null);
        }}
        disableScrollLock
        disableAutoFocus
        disableRestoreFocus
        ModalProps={{ disableScrollLock: true, disableAutoFocus: true, disableRestoreFocus: true }}
        slotProps={{
          paper: { sx: papelDrawerSx },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CabecalhoDrawer
            titulo={editando ? 'Editar insumo' : 'Novo insumo'}
            icone={<AddIcon sx={{ fontSize: 22 }} />}
            onClose={() => {
              setDlgProduto(false);
              setEditando(null);
            }}
          />
          <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            {...dialogFieldProps}
            size="small"
            label="Código"
            required
            value={formProduto.codigo}
            onChange={(e) => setFormProduto((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))}
          />
          <TextField
            {...dialogFieldProps}
            size="small"
            label="Descrição"
            required
            value={formProduto.descricao}
            onChange={(e) => setFormProduto((f) => ({ ...f, descricao: e.target.value }))}
            placeholder="Nome como aparece na contagem"
            multiline
            minRows={2}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField
              {...dialogFieldProps}
              size="small"
              select
              label="Unidade do saldo"
              value={formProduto.unidade_contagem}
              onChange={(e) => {
                const next = String(e.target.value).toUpperCase();
                setFormProduto((f) => ({
                  ...f,
                  unidade_contagem: next,
                  unidade_fracionada: editando ? f.unidade_fracionada : next,
                }));
              }}
            >
              <MenuItem value="UND">UND</MenuItem>
              <MenuItem value="KG">KG</MenuItem>
              <MenuItem value="LT">LT</MenuItem>
              <MenuItem value="CX">CX</MenuItem>
            </TextField>
            <TextField
              {...dialogFieldProps}
              size="small"
              select
              label="Unidade avulsa"
              value={formProduto.unidade_fracionada}
              onChange={(e) =>
                setFormProduto((f) => ({
                  ...f,
                  unidade_fracionada: String(e.target.value).toUpperCase(),
                }))
              }
            >
              {UNIDADES_FRACIONADAS.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
              {formProduto.unidade_fracionada &&
                !(UNIDADES_FRACIONADAS as readonly string[]).includes(formProduto.unidade_fracionada) && (
                  <MenuItem value={formProduto.unidade_fracionada}>
                    {formProduto.unidade_fracionada}
                  </MenuItem>
                )}
            </TextField>
          </Box>
          <Typography sx={{ fontSize: 12, lineHeight: 1.4, color: 'text.secondary', mt: -0.5 }}>
            O saldo fica na unidade da esquerda. A da direita é a sobra que o gestor conta.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField
              {...dialogFieldProps}
              size="small"
              label="Preço da caixa"
              value={formProduto.preco_caixa}
              onChange={(e) => setFormProduto((f) => ({ ...f, preco_caixa: e.target.value }))}
              slotProps={{
                ...dialogFieldProps.slotProps,
                htmlInput: { inputMode: 'decimal' },
              }}
            />
            <TextField
              {...dialogFieldProps}
              size="small"
              label="Unid. na caixa"
              value={formProduto.und_convertida}
              onChange={(e) => setFormProduto((f) => ({ ...f, und_convertida: e.target.value }))}
              slotProps={{
                ...dialogFieldProps.slotProps,
                htmlInput: { inputMode: 'decimal' },
              }}
            />
          </Box>
          <Typography sx={{ fontSize: 12, lineHeight: 1.4, color: 'text.secondary', mt: -0.5 }}>
            Custo de uma unidade = preço da caixa dividido pelas unidades que vêm nela.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, border: '1px solid', borderColor: 'divider', borderRadius: 1, px: 1.5, py: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 650, color: 'text.secondary', mb: 0.25 }}>
              O gestor pode contar em
            </Typography>
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Checkbox
                  checked={formProduto.permite_contagem_caixa}
                  onChange={(e) => setCampoContagemForm('permite_contagem_caixa', e.target.checked)}
                  size="small"
                />
              }
              label="Caixa"
            />
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Checkbox
                  checked={formProduto.permite_contagem_pc_fd}
                  onChange={(e) => setCampoContagemForm('permite_contagem_pc_fd', e.target.checked)}
                  size="small"
                />
              }
              label="Pacote ou fardo"
            />
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Checkbox
                  checked={formProduto.permite_contagem_kg_und}
                  onChange={(e) => setCampoContagemForm('permite_contagem_kg_und', e.target.checked)}
                  size="small"
                />
              }
              label="Kg ou unidade avulsa"
            />
          </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'var(--ga-surface)' }}>
            <Button onClick={() => { setDlgProduto(false); setEditando(null); }} sx={{ color: 'text.secondary' }}>Cancelar</Button>
            <Button variant="contained" disableElevation disabled={salvandoProduto} onClick={() => void salvarProduto()}>
              Salvar
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Dialog
        open={dlgRelatorio}
        onClose={() => !baixandoRelatorio && setDlgRelatorio(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitleWithIcon plainIcon divider icon={<FileDownloadOutlinedIcon />}>
          Baixar relatório
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
          <Typography variant="body2" color="text.secondary">
            Escolha o tipo. Por padrão o PDF vem com a última contagem feita — aberta ou
            finalizada. Só estrutura gera a folha em branco.
          </Typography>
          <Box>
            <Typography
              sx={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: colors.textMuted,
                mb: 0.75,
              }}
            >
              Tipo
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={relatorioTipo}
              onChange={(_e, v: TipoContagemEstoque | null) => {
                if (v) setRelatorioTipo(v);
              }}
              sx={toggleRelatorioSx}
            >
              <ToggleButton value="diaria">Diário</ToggleButton>
              {CONTAGEM_SEMANAL_ATIVA && (
                <ToggleButton value="critica_semanal">Semanal</ToggleButton>
              )}
              <ToggleButton value="completa">Mensal</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Box>
            <Typography
              sx={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: colors.textMuted,
                mb: 0.75,
              }}
            >
              Conteúdo
            </Typography>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size="small"
              value={relatorioModo}
              onChange={(_e, v: 'estrutura' | 'dados' | null) => {
                if (v) setRelatorioModo(v);
              }}
              sx={toggleRelatorioSx}
            >
              <ToggleButton value="estrutura">Só estrutura</ToggleButton>
              <ToggleButton value="dados">Com dados</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {relatorioModo === 'estrutura'
                ? 'Folha com os itens da loja e campos em branco para preencher.'
                : 'Usa a última contagem desse tipo, mesmo se ainda estiver aberta.'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDlgRelatorio(false)} disabled={baixandoRelatorio}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={baixandoRelatorio}
            startIcon={
              baixandoRelatorio ? <CircularProgress size={16} /> : <FileDownloadOutlinedIcon />
            }
            onClick={() => void baixarRelatorioDiaria({ tipo: relatorioTipo, modo: relatorioModo })}
          >
            Baixar PDF
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
