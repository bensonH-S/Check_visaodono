import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import EditIcon from '@mui/icons-material/Edit';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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
import { colors } from '../../theme/tokens';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import DialogTitleWithIcon from '../../components/DialogTitleWithIcon';
import EstoqueOperacionalPanels, { type AbaOp } from './EstoqueOperacionalPanels';
import EstoqueConferenciaDetalhe from './EstoqueConferenciaDetalhe';
import {
  rotuloTipoContagem,
  type TipoContagemEstoque,
} from '../../components/estoque/estoqueContagemTipo';
import { gerarPdfContagemDiaria } from '../../utils/gerarPdfContagemDiaria';

type AbaEstoque = 'cmv' | 'conferencia' | 'break' | 'pedido' | 'fichas' | 'saldo';

const ABAS_ESTOQUE: AbaEstoque[] = ['conferencia', 'break', 'saldo', 'fichas'];

/** URLs antigas → essenciais da validação */
const REDIRECT_ABA: Record<string, AbaEstoque> = {
  insumos: 'fichas',
  estoque: 'saldo',
  vendas: 'conferencia',
  produtos: 'fichas',
  ficha: 'fichas',
  kardex: 'saldo',
  nfe: 'conferencia',
  cmv: 'conferencia',
  pedido: 'conferencia',
  meta: 'conferencia',
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

const toggleRelatorioSx = {
  bgcolor: colors.canvasAlt,
  borderRadius: 2,
  p: 0.35,
  '& .MuiToggleButtonGroup-grouped': {
    border: 0,
    borderRadius: '8px !important',
    px: 1.25,
    py: 0.7,
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '0.8rem',
    color: colors.textSecondary,
    '&.Mui-selected': {
      bgcolor: colors.surface,
      color: colors.navy,
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      '&:hover': { bgcolor: colors.surface },
    },
  },
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
  return l.name.replace(/\s+-\s+/g, ' — ');
}

function subtituloLoja(l: Loja) {
  return [l.bk_number, l.city].filter(Boolean).join(' · ');
}

const ROTULO_ABA: Record<AbaEstoque, string> = {
  cmv: 'CMV',
  saldo: 'Saldo',
  conferencia: 'Conferência',
  break: 'Break',
  pedido: 'Pedido',
  fichas: 'Cadastro',
};

const emptyProdutoForm = {
  codigo: '',
  descricao: '',
  unidade_contagem: 'UND',
  preco_caixa: '',
  und_convertida: '1',
};

type ProdutoForm = typeof emptyProdutoForm;

const tdCenter = { textAlign: 'center' } as const;

type RascunhoLinha = { caixa: string; pc: string; kg: string };

function parseNumCampo(raw: string): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** QTD Terraço: CAIXA*base + PC*parcial + KG/UND */
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
  // legado: só QTD → joga em KG/UND
  return {
    caixa: '',
    pc: '',
    kg: i.estoque_contado == null ? '' : String(i.estoque_contado),
  };
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

export default function ControleEstoquePage() {
  usePageTitle('Estoque');
  const navigate = useNavigate();
  const { aba: abaParam } = useParams<{ aba: string }>();
  const user = getUsuario();
  const podeProdutos = podeProdutosEstoque(user);
  const podeConferencia = podeConferenciaEstoque(user);
  const podeOperacional = podeOperacionalEstoque(user);
  const podeBreak = podeBreakEstoque(user);
  const podeEditarConferencia = podeConferencia;
  const podeExcluir = podeExcluirEstoque(user);
  const podeReabrir = podeReabrirContagemEstoque(user);

  const aba: AbaEstoque = isAbaEstoque(abaParam) ? abaParam : abaInicialPermitida();

  const [headerActions, setHeaderActions] = useState<React.ReactNode>(null);

  const irParaAba = useCallback(
    (proxima: AbaEstoque) => {
      if (proxima === aba) return;
      setHeaderActions(null);
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
  const [relatorioModo, setRelatorioModo] = useState<'estrutura' | 'dados'>('estrutura');

  const lojaAtual = useMemo(
    () => lojas.find((l) => l.id_loja === idLoja) || null,
    [lojas, idLoja],
  );

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

  const selecionarLoja = (id: number) => {
    setIdLoja(id);
    localStorage.setItem(LOJA_STORAGE_KEY, String(id));
    setContagem(null);
    setListaContagens([]);
    setProdutos([]);
    setRascunhoItens({});
    setVerDetalhe(false);
  };

  const carregarProdutos = useCallback(async () => {
    if (!idLoja) return;
    const rows = await api.estoqueProdutos({ id_loja: idLoja });
    setProdutos(rows);
  }, [idLoja]);

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
    if (abaParam && REDIRECT_ABA[abaParam]) {
      navigate(`/estoque/${REDIRECT_ABA[abaParam]}`, { replace: true });
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
  }, [aba, abaParam, navigate, podeConferencia, podeProdutos, podeOperacional, podeBreak, verDetalhe, contagem?.status]);

  const iniciarSabado = async (tipo: TipoContagemEstoque = 'critica_semanal') => {
    if (!podeEditarConferencia || !idLoja) return;
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
        return {
          id_item: i.id_item,
          contagem_caixa: parseNumCampo(raw.caixa),
          contagem_pc_fd: parseNumCampo(raw.pc),
          contagem_kg_und: parseNumCampo(raw.kg),
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
    setRelatorioModo(modo || (tipo ? 'dados' : 'estrutura'));
    setDlgRelatorio(true);
  };

  const baixarRelatorioDiaria = async (opts?: {
    tipo?: TipoContagemEstoque;
    modo?: 'estrutura' | 'dados';
    detalhe?: EstoqueContagemDetalhe | null;
  }) => {
    if (baixandoRelatorio || !idLoja) return;
    const tipo = opts?.tipo || relatorioTipo;
    const modo = opts?.modo || relatorioModo;
    setBaixandoRelatorio(true);
    try {
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
      const undCx = Number(i.und_convertida) > 0 ? Number(i.und_convertida) : 1;
      const undPc = Number(i.und_parcial) > 0 ? Number(i.und_parcial) : 1;
      const contado = calcQtdTerraco(rascunhoItens[i.id_item], undCx, undPc);
      if (contado == null || !Number.isFinite(contado)) {
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
  const chromeCompacto = aba === 'saldo' || aba === 'conferencia';

  if (loadingLojas) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: chromeCompacto ? 1.75 : 2.5,
        height: '100%',
        minHeight: 0,
        overflow: chromeCompacto ? 'hidden' : 'auto',
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 240px' }}>
            <Typography
              sx={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: colors.textMuted,
                mb: chromeCompacto ? 0.5 : 0.75,
              }}
            >
              Estoque / {ROTULO_ABA[aba]}
            </Typography>
            {bloqueiaOutrasAbas ? (
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: { xs: '1.4rem', md: chromeCompacto ? '1.65rem' : '1.85rem' },
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  color: colors.textPrimary,
                }}
              >
                {lojaAtual ? tituloLoja(lojaAtual) : '—'}
              </Typography>
            ) : (
              <Select
                variant="standard"
                disableUnderline
                displayEmpty
                value={idLoja}
                onChange={(e) => selecionarLoja(Number(e.target.value))}
                IconComponent={KeyboardArrowDownIcon}
                renderValue={(v) => {
                  const l = lojas.find((x) => x.id_loja === Number(v));
                  return l ? tituloLoja(l) : 'Selecione a loja';
                }}
                MenuProps={{
                  slotProps: {
                    paper: { sx: { maxHeight: 360, overflowY: 'auto' } },
                  },
                }}
                sx={{
                  mt: 0,
                  maxWidth: '100%',
                  fontWeight: 600,
                  fontSize: { xs: '1.4rem', md: chromeCompacto ? '1.65rem' : '1.85rem' },
                  letterSpacing: '-0.03em',
                  color: colors.textPrimary,
                  '& .MuiSelect-select': {
                    py: 0,
                    pr: lojas.length > 1 ? '1.6rem !important' : '0 !important',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block',
                  },
                  '& .MuiSelect-icon': {
                    display: lojas.length > 1 ? 'block' : 'none',
                    color: colors.textMuted,
                    right: 0,
                    fontSize: 22,
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
            )}
            {lojaAtual ? (
              <Typography sx={{ mt: chromeCompacto ? 0.3 : 0.45, fontSize: '0.8rem', color: colors.textMuted }}>
                {subtituloLoja(lojaAtual) || '—'}
              </Typography>
            ) : null}
          </Box>
          {headerActions ? (
            <Box sx={{ display: 'flex', alignItems: 'center', pt: 0.15, ml: { md: 'auto' } }}>
              {headerActions}
            </Box>
          ) : null}
        </Box>
        <Tabs
          value={idLoja ? aba : false}
          onChange={(_e, v: AbaEstoque) => {
            if (bloqueiaOutrasAbas && v !== 'conferencia') return;
            irParaAba(v);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            mt: chromeCompacto ? 1.15 : 1.75,
            minHeight: 40,
            minWidth: 0,
            borderBottom: `1px solid ${colors.border}`,
            '& .MuiTab-root': {
              minHeight: 40,
              minWidth: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 600,
              fontSize: '0.72rem',
              color: colors.textMuted,
              px: { xs: 1.25, md: 1.75 },
            },
            '& .Mui-selected': { fontWeight: 700, color: `${colors.textPrimary} !important` },
            '& .MuiTabs-indicator': { height: 2, bgcolor: colors.orange },
          }}
        >
          {podeConferencia && (
            <Tab value="conferencia" label="Conferência" disabled={!idLoja} />
          )}
          {podeBreak && (
            <Tab value="break" label="Break" disabled={!idLoja || bloqueiaOutrasAbas} />
          )}
          {podeOperacional && (
            <Tab value="saldo" label="Saldo" disabled={!idLoja || bloqueiaOutrasAbas} />
          )}
          {podeOperacional && (
            <Tab value="fichas" label="Cadastro" disabled={!idLoja || bloqueiaOutrasAbas} />
          )}
        </Tabs>
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
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.navy }}>
                            Contagens
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                          {podeEditarConferencia && (
                            <>
                              <Button
                                variant="contained"
                                startIcon={<PlayArrowIcon />}
                                disabled={iniciando}
                                onClick={() => void iniciarSabado('diaria')}
                              >
                                Diária
                              </Button>
                              <Button
                                variant="outlined"
                                startIcon={<PlayArrowIcon />}
                                disabled={iniciando}
                                onClick={() => void iniciarSabado('critica_semanal')}
                              >
                                Semanal (segunda)
                              </Button>
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

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
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
                        abrirDlgRelatorio(
                          contagem.tipo === 'diaria' ||
                            contagem.tipo === 'critica_semanal' ||
                            contagem.tipo === 'completa'
                            ? contagem.tipo
                            : 'diaria',
                          'dados',
                        )
                      }
                      baixandoRelatorio={baixandoRelatorio}
                    />
                  ) : null}
                </Box>
              )}

              {((podeOperacional && (aba === 'saldo' || aba === 'fichas')) ||
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
                      onInsumosReload={() => void carregarProdutos()}
                      onIrFichas={() => irParaAba('fichas')}
                      onSetHeaderActions={setHeaderActions}
                    />
                  </Box>
                )}
            </Box>
          )}

      <Dialog
        open={dlgProduto}
        onClose={() => {
          setDlgProduto(false);
          setEditando(null);
        }}
        fullWidth
        maxWidth="sm"
      >
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
            Escolha o tipo e se o PDF vem em branco (só os itens) ou com a última contagem — aberta
            ou finalizada.
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
              <ToggleButton value="critica_semanal">Semanal</ToggleButton>
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
