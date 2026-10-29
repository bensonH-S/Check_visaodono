import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Drawer from '@mui/material/Drawer';
import CloseIcon from '@mui/icons-material/Close';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChecklistRtlIcon from '@mui/icons-material/ChecklistRtl';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RemoveIcon from '@mui/icons-material/Remove';
import FreeBreakfastOutlinedIcon from '@mui/icons-material/FreeBreakfastOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  api,
  type EstoqueBreakDetalhe,
  type EstoqueBreakItem,
  type EstoqueBreakRedeItem,
  type EstoqueBreakResumo,
  type EstoqueEmprestimoAReceber,
  type Loja,
  type EstoqueCmvReal,
  type EstoqueCmvTeorico,
  type EstoqueCmvVariancia,
  type EstoqueDisciplina,
  type EstoqueMetaVendas,
  type EstoqueNfeDetalhe,
  type EstoqueNfeResumo,
  type EstoquePedidoRascunho,
  type EstoquePedidoRascunhoItem,
  type EstoquePedidosTabelaPeriodo,
  type EstoqueSituacaoPreco,
  type EstoqueMovimento,
  type EstoqueSaldoItem,
  type EstoqueSyncLojaStatus,
  type EstoqueContagemDiffs,
  type EstoqueContagemRedeItem,
  type EstoqueRegionalDiff,
  type FichaTecnicaDetalhe,
  type ProdutoEstoque,
  type ProdutoVendaEstoque,
} from '../../api/client';
import {
  finBtnContainedSx,
  finBtnOutlinedSx,
} from '../../financeiro/temaFinanceiroEscuro';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import EstoqueInsumoAutocomplete from '../../components/estoque/EstoqueInsumoAutocomplete';
import EstoqueProdutoVendaAutocomplete from '../../components/estoque/EstoqueProdutoVendaAutocomplete';
import {
  fracionadaInteira,
  rotuloCampoFracionado,
  sanitizarEntradaFracionada,
  unidadeFisicaInsumo,
} from '../../components/estoque/estoqueContagemCampo';
import { custoLinhaReceita, UNIDADES_RECEITA, unidadeReceitaPadrao } from '../../utils/fichaReceitaEstoque';
import DialogTitleWithIcon from '../../components/DialogTitleWithIcon';
import { nomeLojaCurto, resumirPedidosTabela } from '../../utils/precoTabelaResumo';
import Autocomplete from '@mui/material/Autocomplete';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { assetUrl } from '../../config/paths';
import { ehLojaPopeyes } from '../../components/escalas/escalaVisitasUtils';
import { finCampoSx, FIN_MUTED } from '../../financeiro/temaFinanceiroEscuro';
import { showToast } from '../../utils/toast';
import { getUsuario, podeReabrirConferenciaNfe } from '../../lib/auth';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors, portalPanelSx } from '../../theme/tokens';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';
import EstoquePilotoAuditoriaPanel from './EstoquePilotoAuditoriaPanel';
import {
  CabecalhoCartao,
  CampoBusca,
  PainelIndicadores,
  SeletorFiltro,
  Selo,
  cabecaTabelaSx,
  cartaoSx,
  corEstoque,
  linhasTabelaSx,
  rotuloSx as rotuloSxPadrao,
} from './estoquePadrao';
import LojaBkMarca from '../../components/escalas/LojaBkMarca';

type AbaOp = 'cmv' | 'vendas' | 'rede' | 'piloto' | 'break' | 'pedido' | 'fichas' | 'saldo';

function fmtNum(v: number | null | undefined, digitos = 2) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digitos,
  });
}

function partesEstoque(qtd: number | null | undefined, unidade?: string | null) {
  const und = String(unidade || 'und').trim().toUpperCase();
  const inteiro = und === 'UND' || und === 'UN' || und === 'CX';
  const n = Number(qtd);
  const digitos = inteiro ? 0 : Math.abs(n) >= 1 ? 1 : 3;
  return { qtd: fmtNum(qtd, digitos), unidade: und };
}

function fmtMoeda(v: number | null | undefined) {
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

function fmtHoraBR(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isoDiaSP(iso: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(typeof iso === 'string' ? new Date(iso) : iso);
}

/** 29/08 no ano corrente; 29/08/25 se for outro ano. */
function fmtDataCurta(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return y === hojeISO().slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

function fmtHoraCurta(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const hora = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
    return isoDiaSP(d) === hojeISO() ? hora : `${fmtDataCurta(isoDiaSP(d))} ${hora}`;
  } catch {
    return null;
  }
}

function textoFrescorVenda(d: {
  dias_venda?: number | null;
  ultimo_sync_em?: string | null;
  hoje_ausente?: boolean;
  hoje_parcial?: boolean;
  ultima_data_venda?: string | null;
} | null | undefined) {
  if (d?.hoje_ausente) {
    return `hoje não entrou · último ${fmtDataCurta(d.ultima_data_venda)}`;
  }
  if (d?.hoje_parcial) {
    const hora = fmtHoraCurta(d.ultimo_sync_em);
    return hora ? `hoje incompleto · sync ${hora}` : 'hoje incompleto';
  }
  const hora = fmtHoraCurta(d?.ultimo_sync_em);
  const dias = d?.dias_venda ?? 0;
  return hora ? `sync ${hora}` : `${dias} dias · BK Office`;
}

function deltaPct(atual: number | null | undefined, ly: number | null | undefined) {
  if (atual == null || ly == null || !Number.isFinite(atual) || !Number.isFinite(ly) || ly <= 0) {
    return null;
  }
  return ((atual - ly) / ly) * 100;
}

function fmtDelta(pct: number | null) {
  if (pct == null || Number.isNaN(pct)) return null;
  const sinal = pct > 0 ? '+' : '';
  return `${sinal}${pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
}

function weekdayCurto(iso: string | null | undefined) {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'short',
      timeZone: 'America/Sao_Paulo',
    })
      .format(new Date(`${String(iso).slice(0, 10)}T12:00:00`))
      .replace('.', '');
  } catch {
    return '';
  }
}

/** Dia 01 do mês corrente (America/Sao_Paulo). */
function inicioMesISO() {
  const hoje = hojeISO();
  return `${hoje.slice(0, 8)}01`;
}

const campoBreakFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1,
    minHeight: 40,
    height: 40,
  },
  '& .MuiSelect-select, & .MuiOutlinedInput-input': {
    py: '8.5px',
    fontSize: '0.875rem',
  },
} as const;

function PendenciaChip({
  tipo,
  children,
  onClick,
}: {
  tipo: 'bloqueio' | 'atencao';
  children: ReactNode;
  onClick?: () => void;
}) {
  const bloqueio = tipo === 'bloqueio';
  return (
    <Box
      component={onClick ? 'button' : 'div'}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.85,
        px: 1.15,
        py: 0.5,
        border: 'none',
        borderRadius: '8px',
        bgcolor: bloqueio ? 'rgba(180, 35, 24, 0.08)' : 'rgba(5, 72, 209, 0.08)',
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
        font: 'inherit',
      }}
    >
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: bloqueio ? '#B42318' : colors.orange,
          flexShrink: 0,
        }}
      />
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: bloqueio ? '#9F1F17' : colors.orange,
          letterSpacing: '-0.01em',
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}

function textoPendenciaCurto(texto: string) {
  return texto
    .replace(/^Falta a contagem completa no fim do período\.?$/i, 'Contagem final do período')
    .replace(/^Falta estoque final \(contagem completa no fim do período\)\.?$/i, 'Contagem final do período')
    .replace(/^Falta estoque inicial \(contagem completa no início do período\)\.?$/i, 'Contagem inicial do período')
    .replace(/^Contagem diária de hoje ainda não foi feita.*$/i, 'Diária de hoje')
    .replace(/^Última semanal \(segunda\) há (\d+) dias \(meta â‰¤ 10\)\.?$/i, 'Semanal há $1 dias')
    .replace(/^Nenhuma contagem semanal de segunda \(mix e latas\) finalizada\.?$/i, 'Semanal de segunda não feita')
    .replace(/^(\d+) produto\(s\) sem ficha — CMV teórico fica incompleto\.?$/i, '$1 produtos sem ficha');
}

function LedgerRow({
  prefix,
  label,
  value,
  strong,
}: {
  prefix?: string;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 2,
        py: 0.7,
        flexShrink: 0,
        borderTop: strong ? `1px solid ${colors.border}` : 'none',
        mt: strong ? 0.35 : 0,
        pt: strong ? 1 : 0.7,
      }}
    >
      <Typography sx={{ color: colors.textSecondary, fontSize: '0.84rem', fontWeight: strong ? 600 : 400 }}>
        {prefix ? `${prefix} ${label}` : label}
      </Typography>
      <Typography
        sx={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: '0.84rem',
          fontWeight: strong ? 650 : 500,
          color: colors.textPrimary,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function grupoFornecedorNfe(n: EstoqueNfeResumo) {
  const nome = `${n.emitente_nome || ''} ${n.fornecedor || ''}`.toUpperCase();
  if (nome.includes('PLATLOG')) return 'Platlog';
  if (nome.includes('BRASAL')) return 'Brasal';
  const cru = (n.emitente_nome || n.fornecedor || 'Outros').replace(/\s+/g, ' ').trim();
  return cru.replace(/\s+(LTDA|S\/A|S A|SA|EIRELI|ME)\.?$/i, '').trim() || 'Outros';
}

function NfeLinha({
  n,
  onClick,
}: {
  n: EstoqueNfeResumo;
  onClick: () => void;
}) {
  const valor =
    n.valor_total != null && Number.isFinite(Number(n.valor_total)) ? fmtMoeda(n.valor_total) : null;
  const venc = n.data_vencimento ? fmtDataBR(n.data_vencimento) : null;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 1.5,
        py: 0.7,
        cursor: 'pointer',
        '&:hover .nfe-num': { color: (theme: any) => theme.palette.mode === 'dark' ? '#F8FAFC' : colors.navy },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography className="nfe-num" sx={{ fontWeight: 600, fontSize: '0.84rem', letterSpacing: '-0.02em' }}>
          {n.numero || n.id_nfe}
        </Typography>
        {venc ? (
          <Typography sx={{ fontSize: '0.72rem', color: colors.textMuted, mt: 0.1 }}>{venc}</Typography>
        ) : null}
      </Box>
      {valor ? (
        <Typography
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '0.84rem',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}
        >
          {valor}
        </Typography>
      ) : null}
    </Box>
  );
}

function alertaDuplicaMotivo(texto: string, motivo: string | null) {
  if (!motivo) return false;
  const n = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const a = n(texto);
  const b = n(motivo);
  if (a === b) return true;
  const falaFinal = /estoque final|contagem completa no fim|contagem final|fim do periodo/;
  return falaFinal.test(a) && falaFinal.test(b);
}

type Props = {
  aba: AbaOp;
  idLoja: number;
  produtos: ProdutoEstoque[];
  onProdutosVendaCountChange?: (n: number) => void;
  onInsumosReload?: () => void;
  onNovoInsumo?: () => void;
  onEditarInsumo?: (insumo: ProdutoEstoque) => void;
  onIrFichas?: () => void;
  onIrRede?: () => void;
  onSelectLoja?: (id: number) => void;
  onSetHeaderActions?: (node: React.ReactNode) => void;
};

export type { AbaOp };

export function BarraSegmento({
  itens,
}: {
  itens: Array<{ id: string; label: string; qtd?: number; ativo: boolean; cor?: string; onClick: () => void }>;
}) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        flexShrink: 0,
        gap: '2px',
        p: '3px',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px',
        bgcolor: 'var(--ga-canvas-alt)',
      }}
    >
      {itens.map((f) => (
        <Box
          key={f.id}
          component="button"
          type="button"
          onClick={f.onClick}
          sx={{
            font: 'inherit',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.45,
            cursor: 'pointer',
            border: 0,
            borderRadius: '6px',
            bgcolor: f.ativo ? 'var(--ga-surface)' : 'transparent',
            boxShadow: f.ativo ? '0 1px 2px rgba(15, 23, 42, 0.06)' : 'none',
            '&:hover': { bgcolor: f.ativo ? 'var(--ga-surface)' : 'rgba(15, 23, 42, 0.04)' },
          }}
        >
          <Typography component="span" sx={{ fontSize: 11, fontWeight: 650, letterSpacing: '0.04em', textTransform: 'uppercase', color: f.ativo ? 'text.primary' : 'text.secondary' }}>
            {f.label}
          </Typography>
          {f.qtd != null ? (
            <Typography component="span" sx={{ fontSize: 13, fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: f.ativo ? f.cor || '#C47A2A' : 'text.secondary' }}>
              {f.qtd}
            </Typography>
          ) : null}
        </Box>
      ))}
    </Box>
  );
}

export const papelDrawerSx = {
  width: 440,
  maxWidth: '100%',
  bgcolor: 'var(--ga-canvas)',
  backgroundImage: 'none',
  borderLeft: '1px solid var(--ga-border)',
} as const;

const drawerSemTranco = {
  disableScrollLock: true,
  disableAutoFocus: true,
  disableRestoreFocus: true,
} as const;

export function CabecalhoDrawer({
  titulo,
  icone,
  onClose,
}: {
  titulo: string;
  icone: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'var(--ga-surface)', flexShrink: 0 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(27,110,243,0.12)', color: '#1B6EF3', flexShrink: 0 }}>
        {icone}
      </Box>
      <Typography sx={{ flex: 1, fontSize: 16, fontWeight: 650, letterSpacing: '-0.02em' }}>{titulo}</Typography>
      <IconButton size="small" onClick={onClose} aria-label="Fechar">
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export default function EstoqueOperacionalPanels({
  aba,
  idLoja,
  produtos,
  onProdutosVendaCountChange,
  onInsumosReload,
  onNovoInsumo,
  onEditarInsumo,
  onIrFichas,
  onIrRede,
  onSelectLoja,
  onSetHeaderActions,
}: Props) {
  if (aba === 'cmv') {
    return <PainelCmv idLoja={idLoja} onIrFichas={onIrFichas} onSetHeaderActions={onSetHeaderActions} />;
  }
  if (aba === 'vendas') {
    return <PainelVendas idLoja={idLoja} onIrRede={onIrRede} onSetHeaderActions={onSetHeaderActions} />;
  }
  if (aba === 'rede') {
    return (
      <PainelSyncRede
        idLoja={idLoja}
        onSelectLoja={onSelectLoja}
        onSetHeaderActions={onSetHeaderActions}
      />
    );
  }
  if (aba === 'piloto') {
    return (
      <EstoquePilotoAuditoriaPanel
        idLoja={idLoja}
        onSetHeaderActions={onSetHeaderActions}
        onIrFichas={onIrFichas}
      />
    );
  }
  if (aba === 'saldo') {
    return <PainelSaldoKardex idLoja={idLoja} onSetHeaderActions={onSetHeaderActions} />;
  }
  if (aba === 'pedido') return <PainelPedido idLoja={idLoja} />;
  if (aba === 'fichas') {
    return (
      <PainelProdutos
        idLoja={idLoja}
        insumos={produtos}
        onCountChange={onProdutosVendaCountChange}
        onInsumosReload={onInsumosReload}
        onNovoInsumo={onNovoInsumo}
        onEditarInsumo={onEditarInsumo}
      />
    );
  }
  return <PainelBreak idLoja={idLoja} />;
}

function severidadePeso(s: string | undefined) {
  if (s === 'alta') return 0;
  if (s === 'media') return 1;
  return 2;
}

const vendasThSx = {
  color: (theme: any) => (theme.palette.mode === 'dark' ? '#94A3B8' : colors.textSecondary),
  bgcolor: (theme: any) => (theme.palette.mode === 'dark' ? '#1e293b !important' : `${colors.canvasAlt} !important`),
  borderBottom: (theme: any) => `1px solid ${theme.palette.mode === 'dark' ? '#334155' : colors.border}`,
  fontWeight: 700,
  fontSize: '0.8rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  py: 1.15,
} as const;

const syncTableSx = {
  ...tableSx,
  '& .MuiTableCell-root': {
    fontSize: '0.95rem',
    py: 1.2,
  },
} as const;

function FiltroSublinhado({
  ativo,
  label,
  qtd,
  onClick,
}: {
  ativo: boolean;
  label: string;
  qtd?: number;
  onClick: () => void;
}) {
  return (
    <Button
      disableRipple
      onClick={onClick}
      sx={{
        textTransform: 'none',
        minWidth: 0,
        px: 1.1,
        py: 0.85,
        borderRadius: 0,
        fontWeight: ativo ? 700 : 600,
        fontSize: '0.95rem',
        color: ativo ? colors.textPrimary : colors.textSecondary,
        borderBottom: ativo ? `2px solid ${colors.orange}` : '2px solid transparent',
        bgcolor: 'transparent',
        '&:hover': { bgcolor: 'transparent', color: colors.textPrimary },
      }}
    >
      {label}
      {qtd != null ? (
        <Box
          component="span"
          sx={{
            ml: 0.85,
            px: 0.65,
            minWidth: 22,
            height: 20,
            borderRadius: '10px',
            bgcolor: colors.canvasAlt,
            color: colors.textMuted,
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {qtd}
        </Box>
      ) : null}
    </Button>
  );
}

function PainelVendas({
  idLoja,
  onSetHeaderActions,
}: {
  idLoja: number;
  onIrRede?: () => void;
  onSetHeaderActions?: (node: React.ReactNode) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<EstoqueMetaVendas | null>(null);
  const [vista, setVista] = useState<'dias' | 'produtos'>('dias');

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const m = await api.estoqueMetaVendas(idLoja, { crescimento: 0.1 });
      setMeta(m);
    } catch (e) {
      if (!silencioso) {
        showToast(e instanceof Error ? e.message : 'Erro ao carregar vendas', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [idLoja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const t = window.setInterval(() => void carregar(true), 45000);
    return () => window.clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    onSetHeaderActions?.(
      <IconButton size="small" aria-label="Atualizar vendas" onClick={() => void carregar()}>
        <RefreshIcon sx={{ fontSize: 18 }} />
      </IconButton>,
    );
    return () => {
      onSetHeaderActions?.(null);
    };
  }, [carregar, onSetHeaderActions]);

  const diasRecentes = useMemo(() => {
    const lista = meta?.dias || [];
    return [...lista].reverse().slice(0, 31);
  }, [meta?.dias]);

  const topProdutos = meta?.top_produtos || [];
  const temLy = Boolean(meta?.tem_base_ly);
  const anoLy = meta?.ano ? meta.ano - 1 : null;

  if (loading && !meta) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 1.25 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          flexWrap: 'wrap',
          flexShrink: 0,
          pb: 0.25,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        <FiltroSublinhado
          ativo={vista === 'dias'}
          label="Dias"
          qtd={diasRecentes.length}
          onClick={() => setVista('dias')}
        />
        <FiltroSublinhado
          ativo={vista === 'produtos'}
          label="Produtos"
          qtd={topProdutos.length}
          onClick={() => setVista('produtos')}
        />
      </Box>

      <Paper sx={{ ...tablePaperSx, flex: 1, minHeight: 0 }}>
        <TableContainer sx={tableContainerSx}>
          {vista === 'dias' ? (
            <Table stickyHeader sx={syncTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...vendasThSx, pl: 2.5, width: 140 }}>Dia</TableCell>
                  <TableCell align="right" sx={vendasThSx}>
                    Venda
                  </TableCell>
                  {temLy ? (
                    <TableCell align="right" sx={{ ...vendasThSx, pr: 2.5, width: 110 }}>
                      vs {anoLy}
                    </TableCell>
                  ) : (
                    <TableCell sx={{ ...vendasThSx, pr: 2.5, width: 24 }} />
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {diasRecentes.length ? (
                  diasRecentes.map((d) => {
                    const hojeLinha = d.data === meta?.ate;
                    const delta = temLy ? deltaPct(d.venda, d.venda_ly) : null;
                    return (
                      <TableRow
                        key={d.data}
                        hover
                        sx={hojeLinha ? { bgcolor: 'rgba(27, 42, 107, 0.04)' } : undefined}
                      >
                        <TableCell sx={{ pl: 2.5, fontWeight: hojeLinha ? 700 : 600, whiteSpace: 'nowrap' }}>
                          {fmtDataCurta(d.data)}
                          <Typography
                            component="span"
                            sx={{ ml: 0.85, fontSize: '0.75rem', fontWeight: 600, color: colors.textMuted, textTransform: 'capitalize' }}
                          >
                            {hojeLinha ? 'hoje' : weekdayCurto(d.data)}
                          </Typography>
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: hojeLinha ? 700 : 600,
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                            color: d.sem_sync ? colors.textMuted : colors.textPrimary,
                          }}
                        >
                          {d.sem_sync ? '—' : fmtMoeda(d.venda)}
                        </TableCell>
                        {temLy ? (
                          <TableCell
                            align="right"
                            sx={{
                              pr: 2.5,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              fontVariantNumeric: 'tabular-nums',
                              color: delta == null ? colors.textMuted : delta >= 0 ? '#127846' : '#B42318',
                            }}
                          >
                            {fmtDelta(delta) || '—'}
                          </TableCell>
                        ) : (
                          <TableCell />
                        )}
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ color: colors.textSecondary, py: 5, borderBottom: 0 }}>
                      Nenhuma venda no mês ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table stickyHeader sx={syncTableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...vendasThSx, width: 52, pl: 2.5 }}>#</TableCell>
                  <TableCell sx={vendasThSx}>Produto</TableCell>
                  <TableCell align="right" sx={{ ...vendasThSx, pr: 2.5, width: 140 }}>
                    Venda
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topProdutos.length ? (
                  topProdutos.map((p, i) => (
                    <TableRow key={p.codigo} hover>
                      <TableCell sx={{ pl: 2.5, fontWeight: 700, color: i < 3 ? colors.orange : colors.textMuted }}>
                        {i + 1}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.875rem' }}>
                        {nomeProdutoBreak(p.descricao) || p.descricao || p.codigo}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ pr: 2.5, fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {fmtMoeda(p.venda)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} sx={{ color: colors.textSecondary, py: 5, borderBottom: 0 }}>
                      Nenhuma venda no mês ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      </Paper>
    </Box>
  );
}

type VistaRede = 'vendas' | 'contou' | 'break' | 'completo' | 'incompleto' | 'emprestimo';

function corSyncVenda(status: string) {
  if (status === 'hoje') return '#127846';
  if (status === 'ontem') return '#C2410C';
  return '#B42318';
}

function tsSyncLoja(l: EstoqueSyncLojaStatus) {
  if (l.ultimo_sync_em) {
    const t = new Date(l.ultimo_sync_em).getTime();
    if (Number.isFinite(t)) return t;
  }
  if (l.minutos_sem_sync != null && Number.isFinite(l.minutos_sem_sync)) {
    return Date.now() - l.minutos_sem_sync * 60_000;
  }
  return 0;
}

type LojaUsoRede = {
  id_loja: number;
  id_break?: number | null;
  bk?: string | null;
  nome?: string | null;
  pessoa: string;
  quando: string | null;
  vezes: number;
  destBk?: string | null;
  destNome?: string | null;
  dataEmprestimo?: string | null;
  recebimento?: string | null;
};

function somarDiasISO(iso: string | null | undefined, dias: number) {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function rotuloRecebimento(status?: string | null, prazo?: string | null) {
  if (status === 'devolvido') return 'Devolvido';
  if (prazo && prazo < hojeISO() && status !== 'devolvido') return 'Atrasado';
  if (status === 'recebido') return 'Recebido';
  if (status === 'pendente') return 'Aguardando';
  return '—';
}

function pessoaLancamento(l: EstoqueBreakRedeItem) {
  return (l.colaborador_nome || l.criado_por_nome || '').trim() || '—';
}

function tsQuando(iso: string | null | undefined) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function pesoEmprestimo(status?: string | null) {
  if (status === 'pendente') return 0;
  if (status === 'recebido') return 1;
  if (status === 'devolvido') return 3;
  return 2;
}

function agregarUsoPorLoja(lista: EstoqueBreakRedeItem[]): LojaUsoRede[] {
  const mapa = new Map<number, LojaUsoRede>();
  for (const l of lista) {
    const atual = mapa.get(l.id_loja);
    const linha: LojaUsoRede = {
      id_loja: l.id_loja,
      id_break: l.id_break,
      bk: l.bk_number,
      nome: l.loja_nome,
      pessoa: pessoaLancamento(l),
      quando: l.criado_em || l.data_break || null,
      vezes: 1,
      destBk: l.loja_destino_bk,
      destNome: l.loja_destino_nome,
      dataEmprestimo: l.data_break || null,
      recebimento: l.recebimento_status || null,
    };
    if (!atual) {
      mapa.set(l.id_loja, linha);
      continue;
    }
    atual.vezes += 1;
    const trocaPorUrgencia =
      pesoEmprestimo(l.recebimento_status) < pesoEmprestimo(atual.recebimento) ||
      (pesoEmprestimo(l.recebimento_status) === pesoEmprestimo(atual.recebimento) &&
        String(l.data_break || '') < String(atual.dataEmprestimo || '9999'));
    const maisNovo = tsQuando(l.criado_em || l.data_break) > tsQuando(atual.quando);
    if (trocaPorUrgencia || (!atual.destNome && maisNovo)) {
      atual.id_break = linha.id_break;
      atual.pessoa = linha.pessoa;
      atual.quando = linha.quando;
      atual.destBk = linha.destBk;
      atual.destNome = linha.destNome;
      atual.dataEmprestimo = linha.dataEmprestimo;
      atual.recebimento = linha.recebimento;
    } else if (maisNovo) {
      atual.quando = linha.quando;
      atual.pessoa = linha.pessoa;
    }
  }
  return [...mapa.values()].sort((a, b) => tsQuando(b.quando) - tsQuando(a.quando));
}

function completarUsoLojas(
  todas: Array<{ id_loja: number; bk?: string | null; nome?: string | null }>,
  uso: LojaUsoRede[],
): LojaUsoRede[] {
  const porId = new Map(uso.map((u) => [u.id_loja, u]));
  return todas
    .map(
      (l) =>
        porId.get(l.id_loja) || {
          id_loja: l.id_loja,
          id_break: null,
          bk: l.bk,
          nome: l.nome,
          pessoa: '—',
          quando: null,
          vezes: 0,
          destBk: null,
          destNome: null,
          dataEmprestimo: null,
          recebimento: null,
        },
    )
    .sort((a, b) => {
      if ((a.vezes === 0) !== (b.vezes === 0)) return a.vezes === 0 ? -1 : 1;
      const d = tsQuando(b.quando) - tsQuando(a.quando);
      if (d !== 0) return d;
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
}

function CampoDrawer({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: '0.68rem',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: colors.textMuted,
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

const TITULO_SYNC: Record<VistaRede, string> = {
  vendas: 'Vendas',
  contou: 'Contagem',
  break: 'Break',
  completo: 'Desperdício completo',
  incompleto: 'Desperdício incompleto',
  emprestimo: 'Empréstimo',
};

type SyncAberto =
  | { kind: 'vendas'; loja: EstoqueSyncLojaStatus }
  | { kind: 'contou'; loja: EstoqueContagemRedeItem }
  | { kind: 'uso'; vista: Exclude<VistaRede, 'vendas' | 'contou'>; loja: LojaUsoRede };

function PainelSyncRede({
  idLoja,
  onSetHeaderActions,
}: {
  idLoja: number;
  onSelectLoja?: (id: number) => void;
  onSetHeaderActions?: (node: React.ReactNode) => void;
}) {
  const [vista, setVista] = useState<VistaRede>('vendas');
  const [loading, setLoading] = useState(true);
  const [syncLojas, setSyncLojas] = useState<EstoqueSyncLojaStatus[]>([]);
  const [contagens, setContagens] = useState<EstoqueContagemRedeItem[]>([]);
  const [lancamentos, setLancamentos] = useState<EstoqueBreakRedeItem[]>([]);
  const [aberto, setAberto] = useState<SyncAberto | null>(null);
  const [detalheEmp, setDetalheEmp] = useState<EstoqueBreakDetalhe | null>(null);
  const [carregandoEmp, setCarregandoEmp] = useState(false);
  const [diffContou, setDiffContou] = useState<EstoqueContagemDiffs | null>(null);
  const [carregandoDiff, setCarregandoDiff] = useState(false);
  const [regionais, setRegionais] = useState<EstoqueRegionalDiff[]>([]);
  const [filtroRegiao, setFiltroRegiao] = useState<number | 'todos'>('todos');
  const [baixandoDiff, setBaixandoDiff] = useState(false);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const [painel, cont, breaks] = await Promise.all([
        api.estoqueSyncLojas(),
        api.estoqueContagensRede({ tipo: 'diaria' }).catch(() => null),
        api.estoqueBreaksRede().catch(() => null),
      ]);
      setSyncLojas(painel?.lojas || []);
      setContagens(cont?.lojas || []);
      setLancamentos(breaks?.lancamentos || []);
    } catch (e) {
      if (!silencioso) {
        showToast(e instanceof Error ? e.message : 'Erro ao carregar o sync', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    api
      .estoqueRegionaisDiff()
      .then((r) => setRegionais(r.regionais || []))
      .catch(() => setRegionais([]));
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => void carregar(true), 45000);
    return () => window.clearInterval(t);
  }, [carregar]);

  const baixarDiffs = useCallback(async () => {
    setBaixandoDiff(true);
    try {
      await api.estoqueBaixarDiffsRede({
        id_regiao: filtroRegiao === 'todos' ? undefined : filtroRegiao,
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao gerar o relatório', 'error');
    } finally {
      setBaixandoDiff(false);
    }
  }, [filtroRegiao]);

  useEffect(() => {
    onSetHeaderActions?.(
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        {vista === 'contou' ? (
          <Tooltip
            title={
              filtroRegiao === 'todos'
                ? 'Baixar PDF da rede'
                : 'Baixar PDF do regional'
            }
          >
            <span>
              <IconButton
                size="small"
                aria-label="Baixar relatório em PDF"
                disabled={baixandoDiff}
                onClick={() => void baixarDiffs()}
              >
                {baixandoDiff ? (
                  <CircularProgress size={16} />
                ) : (
                  <PictureAsPdfOutlinedIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        <IconButton size="small" aria-label="Atualizar rede" onClick={() => void carregar()}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>,
    );
    return () => {
      onSetHeaderActions?.(null);
    };
  }, [baixarDiffs, baixandoDiff, carregar, filtroRegiao, onSetHeaderActions, vista]);

  useEffect(() => {
    setAberto(null);
    setDetalheEmp(null);
    setDiffContou(null);
  }, [vista]);

  const idBreakAberto = aberto?.kind === 'uso' ? aberto.loja.id_break : null;
  const idLojaAberto = aberto?.kind === 'uso' ? aberto.loja.id_loja : null;
  const idContagemAberta =
    aberto?.kind === 'contou'
      ? aberto.loja.id_contagem || aberto.loja.ultima_id_contagem || null
      : null;

  useEffect(() => {
    if (!idBreakAberto || !idLojaAberto) {
      setDetalheEmp(null);
      return;
    }
    let cancel = false;
    setCarregandoEmp(true);
    setDetalheEmp(null);
    api
      .estoqueBreakDetalhe(idBreakAberto, idLojaAberto)
      .then((d) => {
        if (!cancel) setDetalheEmp(d);
      })
      .catch(() => {
        if (!cancel) setDetalheEmp(null);
      })
      .finally(() => {
        if (!cancel) setCarregandoEmp(false);
      });
    return () => {
      cancel = true;
    };
  }, [idBreakAberto, idLojaAberto]);

  useEffect(() => {
    if (!idContagemAberta) {
      setDiffContou(null);
      return;
    }
    let cancel = false;
    setCarregandoDiff(true);
    setDiffContou(null);
    api
      .estoqueContagemDiffs(idContagemAberta)
      .then((d) => {
        if (!cancel) setDiffContou(d);
      })
      .catch(() => {
        if (!cancel) setDiffContou(null);
      })
      .finally(() => {
        if (!cancel) setCarregandoDiff(false);
      });
    return () => {
      cancel = true;
    };
  }, [idContagemAberta]);

  const todasLojas = useMemo(() => {
    const mapa = new Map<number, { id_loja: number; bk?: string | null; nome?: string | null }>();
    for (const l of syncLojas) {
      mapa.set(l.id_loja, { id_loja: l.id_loja, bk: l.bk_number, nome: l.name });
    }
    for (const l of contagens) {
      if (!mapa.has(l.id_loja)) {
        mapa.set(l.id_loja, { id_loja: l.id_loja, bk: l.bk_number, nome: l.name });
      }
    }
    return [...mapa.values()];
  }, [syncLojas, contagens]);

  const porTipo = useMemo(() => {
    const ehBreak = (t: string) => t === 'refeicao' || t === 'break';
    return {
      break: completarUsoLojas(
        todasLojas,
        agregarUsoPorLoja(lancamentos.filter((l) => ehBreak(String(l.tipo)))),
      ),
      completo: completarUsoLojas(
        todasLojas,
        agregarUsoPorLoja(lancamentos.filter((l) => l.tipo === 'desperdicio_completo')),
      ),
      incompleto: completarUsoLojas(
        todasLojas,
        agregarUsoPorLoja(lancamentos.filter((l) => l.tipo === 'desperdicio_incompleto')),
      ),
      emprestimo: completarUsoLojas(
        todasLojas,
        agregarUsoPorLoja(lancamentos.filter((l) => l.tipo === 'emprestimo')),
      ),
    };
  }, [lancamentos, todasLojas]);

  const lojasContagem = useMemo(() => {
    const porId = new Map(contagens.map((c) => [c.id_loja, c]));
    const lista: EstoqueContagemRedeItem[] = [...contagens];
    for (const l of todasLojas) {
      if (porId.has(l.id_loja)) continue;
      lista.push({
        id_loja: l.id_loja,
        bk_number: l.bk || null,
        name: l.nome || '',
        id_contagem: null,
        status: 'faltou',
        status_label: 'Não contou',
        titulo: null,
        tipo: 'diaria',
        data_contagem: null,
        criado_em: null,
        finalizado_em: null,
        contado_em: null,
        criado_por_nome: null,
        ultima_data: null,
        ultima_finalizado_em: null,
        ultima_id_contagem: null,
      });
    }
    const peso = (s: string) => (s === 'faltou' ? 0 : s === 'aberta' ? 1 : 2);
    return lista.sort((a, b) => {
      const d = peso(a.status) - peso(b.status);
      if (d !== 0) return d;
      const ta = tsQuando(a.ultima_data || a.ultima_finalizado_em);
      const tb = tsQuando(b.ultima_data || b.ultima_finalizado_em);
      if (ta !== tb) return ta - tb;
      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
    });
  }, [contagens, todasLojas]);

  const lojasSync = useMemo(
    () =>
      [...syncLojas].sort((a, b) => {
        const diff = tsSyncLoja(b) - tsSyncLoja(a);
        if (diff !== 0) return diff;
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      }),
    [syncLojas],
  );

  const idsRegiao = useMemo(() => {
    if (filtroRegiao === 'todos') return null;
    return new Set(regionais.find((r) => r.id_regiao === filtroRegiao)?.ids_lojas || []);
  }, [filtroRegiao, regionais]);

  const naRegiao = (id: number) => !idsRegiao || idsRegiao.has(id);

  const lojasSyncFiltradas = useMemo(
    () => lojasSync.filter((l) => naRegiao(l.id_loja)),
    [lojasSync, idsRegiao],
  );
  const lojasContagemFiltradas = useMemo(
    () => lojasContagem.filter((l) => naRegiao(l.id_loja)),
    [lojasContagem, idsRegiao],
  );

  const contouHoje = contagens.filter((l) => l.status === 'contou').length;
  const linhasUso = vista === 'vendas' || vista === 'contou' ? [] : porTipo[vista];
  const linhasUsoFiltradas = linhasUso.filter((l) => naRegiao(l.id_loja));
  const idAberto = aberto
    ? aberto.kind === 'uso'
      ? aberto.loja.id_loja
      : aberto.loja.id_loja
    : null;

  if (loading && !syncLojas.length && !contagens.length && !lancamentos.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 1.25 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          flexWrap: 'wrap',
          flexShrink: 0,
          pb: 0.25,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {(
          [
            { id: 'vendas' as const, label: 'Vendas', qtd: syncLojas.length },
            { id: 'contou' as const, label: 'Contou', qtd: contouHoje },
            { id: 'break' as const, label: 'Break', qtd: porTipo.break.filter((l) => l.vezes > 0).length },
            { id: 'completo' as const, label: 'Completo', qtd: porTipo.completo.filter((l) => l.vezes > 0).length },
            { id: 'incompleto' as const, label: 'Incompleto', qtd: porTipo.incompleto.filter((l) => l.vezes > 0).length },
            { id: 'emprestimo' as const, label: 'Empréstimo', qtd: porTipo.emprestimo.filter((l) => l.vezes > 0).length },
          ] as const
        ).map((f) => (
          <FiltroSublinhado
            key={f.id}
            ativo={vista === f.id}
            label={f.label}
            qtd={f.qtd}
            onClick={() => setVista(f.id)}
          />
        ))}
      </Box>

      {vista === 'contou' && regionais.length > 0 ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <FiltroSublinhado
            ativo={filtroRegiao === 'todos'}
            label="Todos"
            qtd={todasLojas.length}
            onClick={() => setFiltroRegiao('todos')}
          />
          {regionais.map((r) => (
            <FiltroSublinhado
              key={r.id_regiao}
              ativo={filtroRegiao === r.id_regiao}
              label={r.nome_regional || r.nome}
              qtd={r.ids_lojas.length}
              onClick={() => setFiltroRegiao(r.id_regiao)}
            />
          ))}
        </Box>
      ) : null}

      <Paper sx={{ ...tablePaperSx, flex: 1, minHeight: 0 }}>
        <TableContainer sx={tableContainerSx}>
          <Table stickyHeader sx={syncTableSx}>
            <TableHead>
              <TableRow>
                {vista === 'vendas' ? (
                  <>
                    <TableCell sx={{ ...vendasThSx, pl: 2.5 }}>Loja</TableCell>
                    <TableCell sx={vendasThSx}>Status</TableCell>
                    <TableCell sx={vendasThSx}>Último dia</TableCell>
                    <TableCell sx={vendasThSx}>Sync</TableCell>
                    <TableCell align="right" sx={vendasThSx}>
                      Mês
                    </TableCell>
                    <TableCell align="right" sx={{ ...vendasThSx, pr: 2.5 }}>
                      Hoje
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell sx={{ ...vendasThSx, pl: 2.5 }}>Loja</TableCell>
                    <TableCell sx={vendasThSx}>{vista === 'contou' ? 'Última' : 'Último'}</TableCell>
                    <TableCell sx={vendasThSx}>Quem</TableCell>
                    <TableCell sx={{ ...vendasThSx, pr: 2.5 }} align="right">
                      {vista === 'contou' ? 'Hoje' : 'Vezes'}
                    </TableCell>
                  </>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {vista === 'vendas' ? (
                lojasSyncFiltradas.length ? (
                  lojasSyncFiltradas.map((l) => {
                    const destaque = l.id_loja === idLoja;
                    const atrasada = l.status === 'atrasado' || l.status === 'sem_sync';
                    return (
                      <TableRow
                        key={l.id_loja}
                        hover
                        selected={idAberto === l.id_loja}
                        onClick={() => setAberto({ kind: 'vendas', loja: l })}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: destaque ? 'rgba(27, 42, 107, 0.06)' : undefined,
                          '&.Mui-selected': { bgcolor: 'rgba(15, 26, 69, 0.05)' },
                        }}
                      >
                        <TableCell sx={{ pl: 2.5, fontWeight: destaque ? 700 : 600 }}>
                          <LojaBkMarca bk={l.bk_number} nome={l.name} size={18} />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: corSyncVenda(l.status) }}>
                          {l.status_label}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDataCurta(l.ultima_data_venda)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: atrasada ? '#B42318' : colors.textSecondary }}>
                          {fmtHoraCurta(l.ultimo_sync_em) || '—'}
                          {atrasada && l.minutos_sem_sync != null ? ` · ${l.minutos_sem_sync} min` : ''}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {fmtMoeda(l.venda_mes)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{ pr: 2.5, fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {fmtMoeda(l.venda_hoje)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ color: colors.textSecondary, py: 5, borderBottom: 0 }}>
                      Nenhuma loja com sync de vendas.
                    </TableCell>
                  </TableRow>
                )
              ) : vista === 'contou' ? (
                lojasContagemFiltradas.length ? (
                  lojasContagemFiltradas.map((l) => {
                    const destaque = l.id_loja === idLoja;
                    const hojeOk = l.status === 'contou';
                    const ultima = l.ultima_data;
                    const quem = hojeOk
                      ? l.criado_por_nome || l.ultima_por_nome
                      : l.ultima_por_nome || l.criado_por_nome;
                    return (
                      <TableRow
                        key={l.id_loja}
                        hover
                        selected={idAberto === l.id_loja}
                        onClick={() => setAberto({ kind: 'contou', loja: l })}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: destaque ? 'rgba(27, 42, 107, 0.06)' : undefined,
                          '&.Mui-selected': { bgcolor: 'rgba(15, 26, 69, 0.05)' },
                        }}
                      >
                        <TableCell sx={{ pl: 2.5, fontWeight: destaque ? 700 : 600 }}>
                          <LojaBkMarca bk={l.bk_number} nome={l.name} size={18} />
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            color: hojeOk ? '#127846' : ultima ? colors.textPrimary : colors.textMuted,
                          }}
                        >
                          {hojeOk ? 'Hoje' : ultima ? fmtDataCurta(ultima) : 'Nunca'}
                        </TableCell>
                        <TableCell sx={{ color: colors.textSecondary }}>{quem || '—'}</TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            pr: 2.5,
                            fontWeight: 700,
                            color: hojeOk ? '#127846' : l.status === 'aberta' ? '#C2410C' : colors.textMuted,
                          }}
                        >
                          {hojeOk ? 'Contou' : l.status === 'aberta' ? 'Aberta' : 'Não'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} sx={{ color: colors.textSecondary, py: 5, borderBottom: 0 }}>
                      Nenhuma loja neste regional.
                    </TableCell>
                  </TableRow>
                )
              ) : linhasUsoFiltradas.length ? (
                linhasUsoFiltradas.map((l) => {
                  const destaque = l.id_loja === idLoja;
                  return (
                    <TableRow
                      key={l.id_loja}
                      hover
                      selected={idAberto === l.id_loja}
                      onClick={() =>
                        setAberto({
                          kind: 'uso',
                          vista: vista as Exclude<VistaRede, 'vendas' | 'contou'>,
                          loja: l,
                        })
                      }
                      sx={{
                        cursor: 'pointer',
                        bgcolor: destaque ? 'rgba(27, 42, 107, 0.06)' : undefined,
                        '&.Mui-selected': { bgcolor: 'rgba(15, 26, 69, 0.05)' },
                      }}
                    >
                      <TableCell sx={{ pl: 2.5, fontWeight: destaque ? 700 : 600 }}>
                        <LojaBkMarca bk={l.bk} nome={l.nome} size={18} />
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          color: l.vezes ? colors.textPrimary : colors.textMuted,
                        }}
                      >
                        {fmtHoraCurta(l.quando) || '—'}
                      </TableCell>
                      <TableCell sx={{ color: colors.textSecondary }}>{l.pessoa}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          pr: 2.5,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: l.vezes ? colors.textPrimary : colors.textMuted,
                        }}
                      >
                        {l.vezes || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} sx={{ color: colors.textSecondary, py: 5, borderBottom: 0 }}>
                    Nenhuma loja na rede.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Drawer
        anchor="right"
        open={!!aberto}
        onClose={() => {
          setAberto(null);
          setDetalheEmp(null);
        }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 420 },
              borderLeft: `1px solid ${colors.border}`,
              boxShadow: '-8px 0 24px rgba(15, 26, 69, 0.06)',
            },
          },
        }}
      >
        {aberto ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 1,
                px: 2.5,
                pt: 2.25,
                pb: 2,
                borderBottom: `1px solid ${colors.border}`,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ga-text-primary)', lineHeight: 1.25 }}>
                  {TITULO_SYNC[aberto.kind === 'uso' ? aberto.vista : aberto.kind]}
                </Typography>
                <Box sx={{ mt: 0.75 }}>
                  {aberto.kind === 'uso' ? (
                    <LojaBkMarca bk={aberto.loja.bk} nome={aberto.loja.nome} size={18} />
                  ) : (
                    <LojaBkMarca bk={aberto.loja.bk_number} nome={aberto.loja.name} size={18} />
                  )}
                </Box>
              </Box>
              <IconButton
                size="small"
                aria-label="Fechar"
                onClick={() => {
                  setAberto(null);
                  setDetalheEmp(null);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              {aberto.kind === 'vendas' ? (
                <>
                  <CampoDrawer label="Status">
                    <Typography sx={{ fontWeight: 700, color: corSyncVenda(aberto.loja.status) }}>
                      {aberto.loja.status_label}
                    </Typography>
                  </CampoDrawer>
                  <CampoDrawer label="Último dia">
                    <Typography sx={{ fontWeight: 600 }}>{fmtDataCurta(aberto.loja.ultima_data_venda)}</Typography>
                  </CampoDrawer>
                  <CampoDrawer label="Sync">
                    <Typography sx={{ fontWeight: 600 }}>
                      {fmtHoraCurta(aberto.loja.ultimo_sync_em) || '—'}
                      {aberto.loja.minutos_sem_sync != null &&
                      (aberto.loja.status === 'atrasado' || aberto.loja.status === 'sem_sync')
                        ? ` · ${aberto.loja.minutos_sem_sync} min`
                        : ''}
                    </Typography>
                  </CampoDrawer>
                  <CampoDrawer label="Mês">
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoeda(aberto.loja.venda_mes)}
                    </Typography>
                  </CampoDrawer>
                  <CampoDrawer label="Hoje">
                    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtMoeda(aberto.loja.venda_hoje)}
                    </Typography>
                  </CampoDrawer>
                </>
              ) : null}

              {aberto.kind === 'contou' ? (
                <>
                  <CampoDrawer label="Hoje">
                    <Typography
                      sx={{
                        fontWeight: 700,
                        color:
                          aberto.loja.status === 'contou'
                            ? '#127846'
                            : aberto.loja.status === 'aberta'
                              ? '#C2410C'
                              : colors.textMuted,
                      }}
                    >
                      {aberto.loja.status === 'contou'
                        ? 'Contou'
                        : aberto.loja.status === 'aberta'
                          ? 'Aberta'
                          : 'Não'}
                    </Typography>
                  </CampoDrawer>
                  <CampoDrawer label="Última">
                    <Typography sx={{ fontWeight: 600 }}>
                      {aberto.loja.status === 'contou'
                        ? 'Hoje'
                        : aberto.loja.ultima_data
                          ? fmtDataCurta(aberto.loja.ultima_data)
                          : 'Nunca'}
                    </Typography>
                  </CampoDrawer>
                  <CampoDrawer label="Quem">
                    <Typography sx={{ fontWeight: 600 }}>
                      {aberto.loja.status === 'contou'
                        ? aberto.loja.criado_por_nome || aberto.loja.ultima_por_nome || '—'
                        : aberto.loja.ultima_por_nome || aberto.loja.criado_por_nome || '—'}
                    </Typography>
                  </CampoDrawer>
                  <CampoDrawer label="Iniciou">
                    <Typography sx={{ fontWeight: 600 }}>{fmtHoraCurta(aberto.loja.criado_em) || '—'}</Typography>
                  </CampoDrawer>
                  <CampoDrawer label="Finalizou">
                    <Typography sx={{ fontWeight: 600 }}>
                      {fmtHoraCurta(aberto.loja.finalizado_em) || fmtHoraCurta(aberto.loja.ultima_finalizado_em) || '—'}
                    </Typography>
                  </CampoDrawer>
                  {carregandoDiff ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={22} />
                    </Box>
                  ) : diffContou ? (
                    <>
                      <Box sx={{ display: 'flex', gap: 2.5 }}>
                        <CampoDrawer label="Itens">
                          <Typography sx={{ fontWeight: 700 }}>{diffContou.itens_total}</Typography>
                        </CampoDrawer>
                        <CampoDrawer label="Pendentes">
                          <Typography sx={{ fontWeight: 700, color: diffContou.pendentes ? '#C2410C' : colors.textPrimary }}>
                            {diffContou.pendentes}
                          </Typography>
                        </CampoDrawer>
                        <CampoDrawer label="Diff">
                          <Typography sx={{ fontWeight: 700, color: diffContou.divergencias ? '#B42318' : '#127846' }}>
                            {diffContou.divergencias}
                          </Typography>
                        </CampoDrawer>
                      </Box>
                      {diffContou.diffs.length ? (
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', pb: 0.75, borderBottom: `1px solid ${colors.border}` }}>
                            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textMuted }}>
                              Item
                            </Typography>
                            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textMuted }}>
                              Diff
                            </Typography>
                          </Box>
                          {diffContou.diffs.map((d, idx) => (
                            <Box
                              key={`${d.descricao || 'item'}-${idx}`}
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'baseline',
                                gap: 2,
                                py: 1.15,
                                borderBottom: `1px solid ${colors.border}`,
                              }}
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: '0.9rem', color: colors.textPrimary }}>
                                  {nomeProdutoBreak(d.descricao) || d.descricao || 'Item'}
                                </Typography>
                                <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted }}>
                                  sistema {fmtNum(d.sistema, d.unidade === 'UND' ? 0 : 3)} · contou{' '}
                                  {fmtNum(d.contado, d.unidade === 'UND' ? 0 : 3)}
                                  {d.unidade ? ` ${d.unidade}` : ''}
                                </Typography>
                              </Box>
                              <Typography
                                sx={{
                                  fontSize: '0.9rem',
                                  fontWeight: 700,
                                  fontVariantNumeric: 'tabular-nums',
                                  color: d.diferenca > 0 ? '#127846' : '#B42318',
                                }}
                              >
                                {d.diferenca > 0 ? '+' : ''}
                                {fmtNum(d.diferenca, d.unidade === 'UND' ? 0 : 3)}
                                {d.unidade ? ` ${d.unidade}` : ''}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Typography sx={{ color: colors.textMuted, fontSize: '0.8125rem' }}>
                          Nenhuma diferença nesta diária.
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography sx={{ color: colors.textMuted, fontSize: '0.8125rem' }}>
                      Sem diária para abrir o detalhe.
                    </Typography>
                  )}
                </>
              ) : null}

              {aberto.kind === 'uso' ? (
                <>
                  {aberto.vista === 'emprestimo' ? (
                    <>
                      <CampoDrawer label="De">
                        <LojaBkMarca bk={aberto.loja.bk} nome={aberto.loja.nome} size={18} />
                      </CampoDrawer>
                      <CampoDrawer label="Para">
                        {aberto.loja.destNome ? (
                          <LojaBkMarca bk={aberto.loja.destBk} nome={aberto.loja.destNome} size={18} />
                        ) : (
                          <Typography sx={{ color: colors.textMuted }}>—</Typography>
                        )}
                      </CampoDrawer>
                      {(() => {
                        const prazo = somarDiasISO(aberto.loja.dataEmprestimo, 14);
                        const situacao = aberto.loja.vezes
                          ? rotuloRecebimento(aberto.loja.recebimento, prazo)
                          : '—';
                        return (
                          <>
                            <CampoDrawer label="Prazo">
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  color: situacao === 'Atrasado' ? '#B42318' : colors.textPrimary,
                                }}
                              >
                                {prazo ? fmtDataCurta(prazo) : '—'}
                                {prazo ? (
                                  <Typography component="span" sx={{ ml: 0.75, fontWeight: 600, color: colors.textMuted }}>
                                    14 dias
                                  </Typography>
                                ) : null}
                              </Typography>
                            </CampoDrawer>
                            <CampoDrawer label="Situação">
                              <Typography
                                sx={{
                                  fontWeight: 700,
                                  color:
                                    situacao === 'Atrasado'
                                      ? '#B42318'
                                      : situacao === 'Aguardando'
                                        ? '#C2410C'
                                        : situacao === 'Devolvido'
                                          ? '#127846'
                                          : colors.textSecondary,
                                }}
                              >
                                {situacao}
                              </Typography>
                            </CampoDrawer>
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <CampoDrawer label="Quem">
                        <Typography sx={{ fontWeight: 600 }}>{aberto.loja.pessoa}</Typography>
                      </CampoDrawer>
                      <CampoDrawer label="Último">
                        <Typography sx={{ fontWeight: 600 }}>{fmtHoraCurta(aberto.loja.quando) || '—'}</Typography>
                      </CampoDrawer>
                      <CampoDrawer label="Vezes">
                        <Typography sx={{ fontWeight: 700 }}>{aberto.loja.vezes || '—'}</Typography>
                      </CampoDrawer>
                    </>
                  )}
                  {aberto.loja.vezes && aberto.loja.id_break ? (
                    carregandoEmp ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                        <CircularProgress size={22} />
                      </Box>
                    ) : detalheEmp?.itens?.length ? (
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', pb: 0.75, borderBottom: `1px solid ${colors.border}` }}>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textMuted }}>
                            {aberto.vista === 'emprestimo' ? 'Mercadoria' : 'Pedido'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textMuted }}>
                            Qtd
                          </Typography>
                        </Box>
                        {(detalheEmp.itens as EstoqueBreakItem[]).map((it, idx) => (
                          <Box
                            key={`${it.codigo || 'item'}-${idx}`}
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'baseline',
                              gap: 2,
                              py: 1.15,
                              borderBottom: `1px solid ${colors.border}`,
                            }}
                          >
                            <Typography sx={{ fontSize: '0.9rem', color: colors.textPrimary }}>
                              {nomeProdutoBreak(it.descricao) || tituloItemBreak(it.descricao) || it.codigo || 'Item'}
                            </Typography>
                            <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                              {fmtQtdItemBreak(it)}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography sx={{ color: colors.textMuted, fontSize: '0.8125rem' }}>
                        Sem item gravado.
                      </Typography>
                    )
                  ) : (
                    <Typography sx={{ color: colors.textMuted, fontSize: '0.8125rem' }}>
                      Nenhum lançamento nesta loja.
                    </Typography>
                  )}
                </>
              ) : null}
            </Box>
          </Box>
        ) : null}
      </Drawer>
    </Box>
  );
}

function PainelCmv({
  idLoja,
  onIrFichas,
  onSetHeaderActions,
}: {
  idLoja: number;
  onIrFichas?: () => void;
  onSetHeaderActions?: (node: React.ReactNode) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [cmv, setCmv] = useState<EstoqueCmvTeorico | null>(null);
  const [real, setReal] = useState<EstoqueCmvReal | null>(null);
  const [variancia, setVariancia] = useState<EstoqueCmvVariancia | null>(null);
  const [disciplina, setDisciplina] = useState<EstoqueDisciplina | null>(null);
  const [nfes, setNfes] = useState<EstoqueNfeResumo[]>([]);
  const [metaVendas, setMetaVendas] = useState<EstoqueMetaVendas | null>(null);
  const [dataIni, setDataIni] = useState(() => inicioMesISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [faltaFicha, setFaltaFicha] = useState(0);
  const [nfeDet, setNfeDet] = useState<EstoqueNfeDetalhe | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    try {
      const [c, r, v, d, nf, pv, meta] = await Promise.all([
        api.estoqueCmvTeorico(idLoja, { de: dataIni, ate: dataFim }),
        api.estoqueCmvReal(idLoja, { de: dataIni, ate: dataFim }),
        api.estoqueCmvVariancia(idLoja, { de: dataIni, ate: dataFim, limit: 30 }),
        api.estoqueDisciplina(idLoja),
        api.estoqueNfes(idLoja, { conferir: true, limit: 30 }),
        api.estoqueProdutosVenda({ id_loja: idLoja }),
        api.estoqueMetaVendas(idLoja, { crescimento: 0.1 }).catch(() => null),
      ]);
      setCmv(c);
      setReal(r);
      setVariancia(v);
      setDisciplina(d);
      setNfes(nf);
      setMetaVendas(meta);
      setFaltaFicha(
        pv.filter((p) => p.requer_ficha !== false && !(p.id_ficha && (p.itens_ficha ?? 0) > 0))
          .length,
      );
    } catch (e) {
      if (!silencioso) showToast(e instanceof Error ? e.message : 'Erro ao carregar CMV', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja, dataIni, dataFim]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const t = window.setInterval(() => void carregar(true), 45000);
    return () => window.clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    onSetHeaderActions?.(
      <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
        <FiltroIntervaloDatasFrota
          variante="texto"
          dataInicio={dataIni}
          dataFim={dataFim}
          onChangeInicio={setDataIni}
          onChangeFim={setDataFim}
        />
        <IconButton size="small" aria-label="Atualizar" onClick={() => void carregar()}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Mais opçõeses"
          onClick={(e) => setMenuEl(e.currentTarget)}
        >
          <MoreVertIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>,
    );
    return () => {
      onSetHeaderActions?.(null);
    };
  }, [dataIni, dataFim, carregar, onSetHeaderActions]);

  const abrirConferir = async (idNfe: number) => {
    try {
      const det = await api.estoqueNfeDetalhe(idNfe);
      setNfeDet(det);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao abrir NF', 'error');
    }
  };

  const confirmarRecebimento = async (confirmarTodos: boolean) => {
    if (!nfeDet) return;
    setConferindo(true);
    try {
      const r = await api.estoqueNfeConferir(nfeDet.id_nfe, { confirmar_todos: confirmarTodos });
      showToast(
        r.divergente
          ? `NF conferida com divergência · estoque em ${fmtDataBR(r.data_entrega)}`
          : `Recebimento OK · estoque em ${fmtDataBR(r.data_entrega)}`,
        r.divergente ? 'warning' : 'success',
      );
      setNfeDet(null);
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao conferir NF', 'error');
    } finally {
      setConferindo(false);
    }
  };

  const conferirTodas = async () => {
    const prontos = nfes.filter((n) => n.status_entrega === 'aguardando_conferencia');
    if (!prontos.length) {
      showToast('Nenhuma NF pronta para conferir', 'info');
      return;
    }
    setConferindo(true);
    try {
      for (const n of prontos) {
        await api.estoqueNfeConferir(n.id_nfe, { confirmar_todos: true });
      }
      showToast(`${prontos.length} NF(s) conferidas`, 'success');
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao conferir NFs', 'error');
    } finally {
      setConferindo(false);
    }
  };

  const fecharMes = async () => {
    const anoMes = dataIni.slice(0, 7);
    setFechando(true);
    setMenuEl(null);
    try {
      await api.estoqueFecharMes({ id_loja: idLoja, ano_mes: anoMes });
      showToast(`Mês ${anoMes} fechado`, 'success');
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não fechou o mês', 'error');
    } finally {
      setFechando(false);
    }
  };

  const realPctPreview = real?.cmv_real_pct;
  const motivoRealCard =
    realPctPreview != null
      ? null
      : real?.estoque_final == null
        ? 'Falta estoque final (contagem completa no fim do período).'
        : real?.estoque_inicial == null
          ? 'Falta estoque inicial (contagem completa no início do período).'
          : real?.aviso || 'Ainda não dá para calcular o CMV real.';

  const alertasPriorizados = useMemo(() => {
    const msgs: { texto: string; peso: number; key: string }[] = [];
    const seen = new Set<string>();
    const push = (texto: string | null | undefined, peso: number, key: string) => {
      const t = (texto || '').trim();
      if (!t || seen.has(t)) return;
      if (motivoRealCard && t === motivoRealCard) return;
      if (alertaDuplicaMotivo(t, motivoRealCard)) return;
      seen.add(t);
      msgs.push({ texto: t, peso, key });
    };

    if (cmv?.cmv_teorico_pct != null && cmv.cmv_teorico_pct > 70) {
      push(
        `CMV teórico ${fmtNum(cmv.cmv_teorico_pct, 0)}% está absurdo (meta ${cmv.meta_pct ?? 38}%). Provável erro: preço de caixa sem converter para unidade na ficha.`,
        0,
        'custo-suspeito',
      );
    }

    for (const a of disciplina?.alertas || []) {
      if (a.tipo === 'nf_sem_entrega' || a.tipo?.startsWith('nf_')) continue;
      push(a.mensagem, severidadePeso(a.severidade), `d-${a.tipo}-${a.mensagem}`);
    }
    if (realPctPreview != null) {
      push(real?.aviso, 0, 'real-aviso');
    }
    for (const av of real?.avisos || []) {
      if (/NF\s*\(|sem conferência no estoque/i.test(av)) continue;
      push(av, 1, `real-${av}`);
    }
    if (faltaFicha > 0) {
      push(
        `${faltaFicha} produto(s) sem ficha — CMV teórico fica incompleto.`,
        1,
        'falta-ficha',
      );
    }

    return msgs.sort((a, b) => a.peso - b.peso).slice(0, motivoRealCard ? 2 : 3);
  }, [
    cmv?.cmv_teorico_pct,
    cmv?.meta_pct,
    disciplina?.alertas,
    real?.aviso,
    real?.avisos,
    faltaFicha,
    motivoRealCard,
    realPctPreview,
  ]);

  const nfesPorGrupo = useMemo(() => {
    const ordem = ['Platlog', 'Brasal'];
    const map = new Map<string, EstoqueNfeResumo[]>();
    for (const n of nfes) {
      const g = grupoFornecedorNfe(n);
      const arr = map.get(g) || [];
      arr.push(n);
      map.set(g, arr);
    }
    const principais = ordem.filter((k) => map.has(k)).map((k) => ({ nome: k, itens: map.get(k)! }));
    const outros = [...map.keys()]
      .filter((k) => !ordem.includes(k))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((k) => ({ nome: k, itens: map.get(k)! }));
    return [...principais, ...outros];
  }, [nfes]);

  if (loading && !cmv) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const metaPct = cmv?.meta_pct ?? real?.meta_pct ?? 38;
  // Sempre a venda do filtro de datas (BK Office) — não a janela do CMV real (que começa no dia após a EI).
  const venda = cmv?.venda_bruta ?? cmv?.venda_liquida ?? null;
  const teoricoPct = cmv?.cmv_teorico_pct;
  const custoTeorico = cmv?.custo_teorico;
  const realPct = realPctPreview;
  const motivoReal = motivoRealCard;

  const corPct = (pct: number | null | undefined) => {
    if (pct == null) return colors.orange;
    if (pct <= metaPct) return '#0F766E';
    if (pct <= metaPct + 2.5) return colors.orange;
    return '#B42318';
  };

  const motivoRealCurto =
    realPct != null
      ? null
      : real?.estoque_final == null
        ? 'falta contagem final'
        : real?.estoque_inicial == null
          ? 'falta contagem inicial'
          : 'pendente';

  const escalaMeta = Math.max(50, metaPct * 1.35, (teoricoPct ?? 0) * 1.2);
  const barraTeorico = teoricoPct != null ? Math.min(100, (teoricoPct / escalaMeta) * 100) : 0;
  const marcaMeta = Math.min(96, (metaPct / escalaMeta) * 100);

  const mesFechado = disciplina?.fechamento_mes?.status === 'fechado';
  const ofensores = variancia?.itens || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Menu
        anchorEl={menuEl}
        open={!!menuEl}
        onClose={() => setMenuEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          disabled={fechando || mesFechado}
          onClick={() => void fecharMes()}
        >
          <ListItemIcon>
            <LockOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={
              mesFechado
                ? `Mês ${disciplina?.fechamento_mes?.ano_mes} já fechado`
                : `Fechar mês ${dataIni.slice(0, 7)}`
            }
          />
        </MenuItem>
      </Menu>

      <Box sx={{ ...portalPanelSx, p: { xs: 1.75, md: 2.25 }, flexShrink: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: { xs: 1.5, md: 0 },
          }}
        >
          {[
            {
              label: 'Venda',
              value: fmtMoeda(venda ?? 0),
              color: cmv?.hoje_ausente || cmv?.hoje_parcial ? colors.orange : colors.textPrimary,
              sub: textoFrescorVenda(cmv),
            },
            {
              label: 'CMV teórico',
              value: teoricoPct != null ? `${fmtNum(teoricoPct, 1)}%` : '—',
              color: corPct(teoricoPct),
              sub: custoTeorico != null ? `custo ${fmtMoeda(custoTeorico)}` : `meta ${metaPct}%`,
            },
            {
              label: 'CMV real',
              value: realPct != null ? `${fmtNum(realPct, 1)}%` : '• Pendente',
              color: corPct(realPct),
              sub: motivoRealCurto || `consumo ${fmtMoeda(real?.consumo_real)}`,
            },
          ].map((k, i) => (
            <Box
              key={k.label}
              sx={{
                minWidth: 0,
                px: { md: 2 },
                pl: { md: i === 0 ? 0 : 2 },
                pr: { md: i === 2 ? 0 : 2 },
                borderLeft: { md: i === 0 ? 'none' : `1px solid ${colors.border}` },
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                }}
              >
                {k.label}
              </Typography>
              <Typography
                sx={{
                  fontWeight: 650,
                  fontSize: 15,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  color: k.color,
                  mt: 0.55,
                }}
              >
                {k.value}
              </Typography>
              <Typography sx={{ mt: 0.4, fontSize: '0.75rem', color: colors.textMuted }}>
                {k.sub}
              </Typography>
            </Box>
          ))}
        </Box>

        {dataIni === inicioMesISO() && dataFim === hojeISO() && metaVendas ? (
          <Box
            sx={{
              mt: 2,
              pt: 1.75,
              borderTop: `1px solid ${colors.border}`,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: { xs: 1.25, sm: 0 },
            }}
          >
            {[
              {
                label: `Meta +${metaVendas.crescimento_pct ?? 10}%`,
                value: metaVendas.meta_mtd != null ? fmtMoeda(metaVendas.meta_mtd) : 'Falta 2025',
                sub:
                  metaVendas.meta_mtd != null
                    ? `${fmtMoeda(metaVendas.venda_ly_mtd)} no ano passado`
                    : 'kit ainda não baixou o mesmo mês de 2025',
              },
              {
                label: 'Projeção restante',
                value: fmtMoeda(metaVendas.projecao_restante),
                sub: `média ${fmtMoeda(metaVendas.media_dia)} × ${metaVendas.dias_restantes ?? 0} dias`,
              },
              {
                label: 'Fecha o mês',
                value: fmtMoeda(metaVendas.projecao_mes),
                sub: 'venda até hoje + restante',
              },
            ].map((k, i) => (
              <Box
                key={k.label}
                sx={{
                  minWidth: 0,
                  px: { sm: 2 },
                  pl: { sm: i === 0 ? 0 : 2 },
                  pr: { sm: i === 2 ? 0 : 2 },
                  borderLeft: { sm: i === 0 ? 'none' : `1px solid ${colors.border}` },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: colors.textMuted,
                  }}
                >
                  {k.label}
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 650,
                    fontSize: 15,
                    letterSpacing: '-0.03em',
                    mt: 0.35,
                    color: colors.textPrimary,
                  }}
                >
                  {k.value}
                </Typography>
                <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: colors.textMuted }}>
                  {k.sub}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : null}

        <Box sx={{ mt: 2.25 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: colors.textMuted,
              }}
            >
              CMV teórico vs. meta
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: colors.textMuted }}>
              meta â‰¤ {metaPct}%
            </Typography>
          </Box>
          <Box sx={{ position: 'relative', height: 6, borderRadius: 99, bgcolor: colors.canvasAlt }}>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                width: `${barraTeorico}%`,
                borderRadius: 99,
                bgcolor: corPct(teoricoPct),
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: -3,
                bottom: -3,
                left: `${marcaMeta}%`,
                width: 0,
                borderLeft: `1.5px dashed ${colors.borderStrong}`,
              }}
            />
          </Box>
        </Box>

        {(() => {
          const itens: { key: string; tipo: 'bloqueio' | 'atencao'; texto: string; onClick?: () => void }[] = [];
          if (cmv?.hoje_ausente) {
            itens.push({
              key: 'venda-ausente',
              tipo: 'atencao',
              texto: `Venda de hoje ainda não entrou (último ${fmtDataBR(cmv.ultima_data_venda)})`,
            });
          } else if (cmv?.hoje_parcial) {
            itens.push({
              key: 'venda-parcial',
              tipo: 'atencao',
              texto: `Venda de hoje incompleta — ILR (Bruto) vai na frente até o kit rebaixar`,
            });
          }
          if (motivoReal) {
            itens.push({
              key: 'motivo',
              tipo: 'bloqueio',
              texto: textoPendenciaCurto(
                motivoRealCurto === 'falta contagem final'
                  ? 'Falta a contagem completa no fim do período.'
                  : motivoReal,
              ),
            });
          }
          for (const a of alertasPriorizados) {
            itens.push({
              key: a.key,
              tipo: a.peso === 0 ? 'bloqueio' : 'atencao',
              texto: textoPendenciaCurto(a.texto),
              onClick: a.key === 'falta-ficha' && onIrFichas ? () => onIrFichas() : undefined,
            });
          }
          if (!itens.length) return null;
          return (
            <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.85 }}>
              {itens.map((p) => (
                <PendenciaChip key={p.key} tipo={p.tipo} onClick={p.onClick}>
                  {p.texto}
                </PendenciaChip>
              ))}
            </Box>
          );
        })()}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: nfes.length > 0 ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)' },
          gap: 1.5,
          alignItems: 'stretch',
          flex: 1,
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            ...portalPanelSx,
            p: { xs: 1.75, md: 2.25 },
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.68rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: colors.textMuted,
              mb: 0.75,
              flexShrink: 0,
            }}
          >
            Composição do consumo
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <LedgerRow label="estoque inicial" value={fmtMoeda(real?.estoque_inicial ?? 0)} />
            <LedgerRow prefix="+" label="compras (NFs)" value={fmtMoeda(real?.compras ?? 0)} />
            <LedgerRow prefix="âˆ’" label="estoque final" value={fmtMoeda(real?.estoque_final ?? 0)} />
            <LedgerRow prefix="=" label="consumo" value={fmtMoeda(real?.consumo_real ?? 0)} strong />
          </Box>
        </Box>

        {nfes.length > 0 ? (
          <Box
            sx={{
              ...portalPanelSx,
              p: { xs: 1.75, md: 2.25 },
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75, flexShrink: 0 }}>
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: colors.textMuted,
                }}
              >
                Recebimentos
              </Typography>
              <Button
                size="small"
                disabled={conferindo}
                onClick={() => void conferirTodas()}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  color: colors.orange,
                  minWidth: 0,
                  p: 0,
                  '&:hover': { bgcolor: 'transparent', color: colors.orangeHover },
                }}
              >
                {conferindo ? 'Conferindo…' : 'Conferir todas'}
              </Button>
            </Box>
            <Box sx={{ overflowY: 'auto', flex: 1, minHeight: 0, mr: -0.75, pr: 0.75 }}>
              {nfesPorGrupo.map((grupo) => (
                <Box key={grupo.nome} sx={{ mb: 1.25, '&:last-child': { mb: 0 } }}>
                  <Typography
                    sx={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: colors.textMuted,
                      mb: 0.25,
                      pt: 0.35,
                      position: 'sticky',
                      top: 0,
                      bgcolor: colors.surface,
                      zIndex: 1,
                    }}
                  >
                    {grupo.nome}
                  </Typography>
                  {grupo.itens.map((n, i) => (
                    <Box
                      key={n.id_nfe}
                      sx={{ borderTop: i === 0 ? 'none' : `1px solid ${colors.border}` }}
                    >
                      <NfeLinha n={n} onClick={() => void abrirConferir(n.id_nfe)} />
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              ...portalPanelSx,
              p: { xs: 1.75, md: 2.25 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: 120,
            }}
          >
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
              Recebimentos
            </Typography>
            <Typography sx={{ fontSize: '0.88rem', color: colors.textMuted }}>
              Nenhuma NF aguardando conferência nesta loja. O sync Platlog precisa de ESUPRI_USER no
              .env da raiz do VPS e de uma execução (05:00 ou Rodar agora).
            </Typography>
          </Box>
        )}
      </Box>

      {ofensores.length > 0 && (
        <Box
          sx={{
            ...portalPanelSx,
            p: 0,
            overflow: 'hidden',
            flex: '0 1 180px',
            minHeight: 0,
            maxHeight: 180,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
            <Typography
              sx={{
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: colors.textMuted,
              }}
            >
              Onde o CMV estoura
            </Typography>
          </Box>
          <TableContainer sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {['Insumo', 'Real', 'Teórico', 'Gap UN', 'Gap R$'].map((h) => (
                    <TableCell
                      key={h}
                      align={h === 'Insumo' ? 'left' : 'right'}
                      sx={{
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: colors.textMuted,
                        borderColor: colors.border,
                        bgcolor: colors.surface,
                      }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {ofensores.map((it) => (
                  <TableRow key={it.id_insumo}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {it.codigo} · {it.descricao}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{fmtNum(it.qtd_real, 2)}</TableCell>
                    <TableCell align="right">{fmtNum(it.qtd_teorico, 2)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        color: it.gap_qtd > 0 ? '#b91c1c' : it.gap_qtd < 0 ? '#15803d' : undefined,
                      }}
                    >
                      {fmtNum(it.gap_qtd, 2)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        color:
                          it.gap_reais > 0 ? '#b91c1c' : it.gap_reais < 0 ? '#15803d' : undefined,
                      }}
                    >
                      {fmtMoeda(it.gap_reais)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      <Dialog open={!!nfeDet} onClose={() => setNfeDet(null)} maxWidth="md" fullWidth>
        <DialogTitleWithIcon icon={<ChecklistRtlIcon />} plainIcon divider>
          Conferir NF {nfeDet?.numero || nfeDet?.id_nfe}
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
          {nfeDet && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Portal: {nfeDet.status_portal || '—'} · Vencimento {fmtDataBR(nfeDet.data_vencimento)} ·
                Saída {fmtDataBR(nfeDet.data_saida)} · Emissão {fmtDataBR(nfeDet.emissao)}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item NF</TableCell>
                      <TableCell>Insumo</TableCell>
                      <TableCell align="right">Qtd NF</TableCell>
                      <TableCell align="right">Qtd estoque</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {nfeDet.itens.map((it) => (
                      <TableRow key={it.id_item}>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {it.codigo_nf || '—'} · {it.descricao}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {it.id_insumo
                            ? `${it.codigo_insumo} · ${it.descricao_insumo}`
                            : 'Sem match'}
                        </TableCell>
                        <TableCell align="right">{fmtNum(it.q_com, 2)}</TableCell>
                        <TableCell align="right">{fmtNum(it.qtd_estoque, 2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNfeDet(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={conferindo || !nfeDet}
            onClick={() => void confirmarRecebimento(true)}
          >
            {conferindo ? 'Lançando…' : 'Confirmar: todos os itens chegaram'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function rotuloGrupoSaldo(g: string | null | undefined) {
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
    brinde: 'Brinde',
  };
  return mapa[String(g || '')] || g || 'Outros';
}

function labelTipoMovimento(tipo?: string | null) {
  const t = String(tipo || '').toLowerCase();
  if (t === 'venda') return 'Venda';
  if (t === 'entrada') return 'Entrada';
  if (t === 'contagem') return 'Contagem';
  if (t === 'break') return 'Break';
  if (t === 'ajuste') return 'Ajuste';
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Movimento';
}

function fmtQtdSaldo(n: number | null | undefined, unidade?: string | null) {
  const q = fmtNum(n, 2);
  return unidade ? `${q} ${unidade}` : q;
}

function PainelSaldoKardex({
  idLoja,
  onSetHeaderActions,
}: {
  idLoja: number;
  onSetHeaderActions?: (node: ReactNode) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<EstoqueSaldoItem[]>([]);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | 'zerado'>('todos');
  const [aberto, setAberto] = useState<EstoqueSaldoItem | null>(null);
  const [movs, setMovs] = useState<EstoqueMovimento[]>([]);
  const [carregandoMovs, setCarregandoMovs] = useState(false);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoading(true);
      try {
        const rows = await api.estoqueSaldos(idLoja, undefined, { diaria: true });
        setItens(rows);
      } catch (e) {
        if (!silencioso) {
          showToast(e instanceof Error ? e.message : 'Erro ao carregar o saldo', 'error');
        }
      } finally {
        setLoading(false);
      }
    },
    [idLoja],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    const t = window.setInterval(() => void carregar(true), 45000);
    return () => window.clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    onSetHeaderActions?.(
      <IconButton size="small" aria-label="Atualizar" onClick={() => void carregar()}>
        <RefreshIcon sx={{ fontSize: 18 }} />
      </IconButton>,
    );
    return () => {
      onSetHeaderActions?.(null);
    };
  }, [carregar, onSetHeaderActions]);

  const qtdZerado = useMemo(() => itens.filter((i) => Number(i.quantidade) <= 0.001).length, [itens]);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrada = itens.filter((i) => {
      if (filtro === 'zerado' && Number(i.quantidade) > 0.001) return false;
      if (!q) return true;
      return [i.descricao, i.codigo, rotuloGrupoSaldo(i.grupo_diario)]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
    const mapa = new Map<string, EstoqueSaldoItem[]>();
    for (const i of filtrada) {
      const g = i.grupo_diario || 'outros';
      const arr = mapa.get(g) || [];
      arr.push(i);
      mapa.set(g, arr);
    }
    return [...mapa.entries()];
  }, [itens, busca, filtro]);

  useEffect(() => {
    const flat = grupos.flatMap(([, rows]) => rows);
    setAberto((atual) => {
      if (atual && flat.some((x) => (x.id_insumo || x.id_produto) === (atual.id_insumo || atual.id_produto))) {
        return atual;
      }
      return null;
    });
  }, [grupos]);

  useEffect(() => {
    const id = aberto?.id_insumo || aberto?.id_produto;
    if (!id) {
      setMovs([]);
      return;
    }
    let cancel = false;
    setCarregandoMovs(true);
    setMovs([]);
    api
      .estoqueMovimentos(idLoja, { id_insumo: id, limit: 40 })
      .then((rows) => {
        if (!cancel) setMovs(rows);
      })
      .catch((e) => {
        if (!cancel) showToast(e instanceof Error ? e.message : 'Não consegui abrir o histórico', 'error');
      })
      .finally(() => {
        if (!cancel) setCarregandoMovs(false);
      });
    return () => {
      cancel = true;
    };
  }, [aberto?.id_insumo, aberto?.id_produto, idLoja]);

  if (loading && !itens.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const qtdGrupos = new Set(itens.map((i) => i.grupo_diario || 'outros')).size;
  const ultimaAtualizacao = itens.reduce<string | null>((max, i) => {
    const t = i.atualizado_em ? String(i.atualizado_em) : '';
    return t && (!max || t > max) ? t : max;
  }, null);
  const comSaldo = itens.length - qtdZerado;
  const noRecorte = grupos.reduce((s, [, rows]) => s + rows.length, 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 1.25 }}>
      <PainelIndicadores
        itens={[
          {
            rotulo: 'Itens no saldo',
            valor: itens.length,
            sub: `${comSaldo} com saldo · ${qtdGrupos} ${qtdGrupos === 1 ? 'grupo' : 'grupos'}`,
            barra: itens.length ? comSaldo / itens.length : null,
            corBarra: qtdZerado ? corEstoque.laranja : corEstoque.verde,
          },
          { rotulo: 'Com saldo', valor: comSaldo, sub: 'disponível na loja', cor: corEstoque.verde },
          {
            rotulo: 'Zerados',
            valor: qtdZerado,
            sub: qtdZerado ? 'sem nada na loja' : 'nenhum item zerado',
            cor: qtdZerado ? corEstoque.vermelho : undefined,
          },
          { rotulo: 'Atualizado', valor: ultimaAtualizacao ? fmtHoraBR(ultimaAtualizacao) || '—' : '—', sub: 'última movimentação' },
        ]}
      />

      <Paper variant="outlined" sx={{ ...tablePaperSx, ...cartaoSx }}>
        <CabecalhoCartao titulo="Saldo" sub={`${noRecorte} ${noRecorte === 1 ? 'item' : 'itens'}`}>
          <SeletorFiltro
            valor={filtro}
            onChange={(v) => setFiltro(v as typeof filtro)}
            opcoes={[
              { id: 'todos', label: 'Todos', qtd: itens.length },
              { id: 'zerado', label: 'Zerados', qtd: qtdZerado },
            ]}
          />
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar insumo" largura={240} />
        </CabecalhoCartao>
        <TableContainer sx={tableContainerSx}>
          <Table stickyHeader sx={tableSx} size="small">
            <TableHead sx={cabecaTabelaSx}>
              <TableRow>
                <TableCell sx={{ ...vendasThSx, pl: 2.5 }}>Insumo</TableCell>
                <TableCell sx={{ ...vendasThSx, textAlign: 'right', pr: 2.5 }} width={160}>
                  Saldo
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!grupos.length ? (
                <TableRow>
                  <TableCell colSpan={2} sx={{ py: 5, color: colors.textMuted, borderBottom: 0 }}>
                    Nenhum item neste recorte.
                  </TableCell>
                </TableRow>
              ) : (
                grupos.map(([grupo, rows]) => (
                  <Fragment key={grupo}>
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        sx={{
                          py: 0.75,
                          pl: 2.5,
                          bgcolor: 'var(--ga-canvas)',
                          borderBottom: '1px solid var(--ga-border)',
                          fontSize: 11,
                          fontWeight: 650,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'text.secondary',
                        }}
                      >
                        {rotuloGrupoSaldo(grupo)}
                        <Box component="span" sx={{ ml: 1, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>
                          {rows.length}
                        </Box>
                      </TableCell>
                    </TableRow>
                    {rows.map((r) => {
                      const id = r.id_insumo || r.id_produto;
                      const ativo = (aberto?.id_insumo || aberto?.id_produto) === id;
                      const zerado = Number(r.quantidade) <= 0.001;
                      return (
                        <TableRow
                          key={id}
                          hover
                          selected={ativo}
                          onClick={() => setAberto(r)}
                          sx={{
                            cursor: 'pointer',
                            '& td': { borderBottom: '1px solid var(--ga-border)', py: 1.1 },
                            '&.Mui-selected': { bgcolor: 'rgba(27, 110, 243, 0.06)', boxShadow: 'inset 3px 0 0 #1B6EF3' },
                            '&.Mui-selected:hover': { bgcolor: 'rgba(27, 110, 243, 0.08)' },
                          }}
                        >
                          <TableCell sx={{ pl: 2.5, fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, bgcolor: zerado ? corEstoque.vermelho : corEstoque.verde }} />
                              {nomeProdutoBreak(r.descricao) || r.descricao}
                            </Box>
                          </TableCell>
                          <TableCell
                            sx={{
                              pr: 2.5,
                              textAlign: 'right',
                              fontSize: 13,
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              color: zerado ? corEstoque.vermelho : 'text.primary',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {fmtQtdSaldo(r.quantidade, r.unidade_contagem)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Drawer
        anchor="right"
        open={!!aberto}
        onClose={() => {
          setAberto(null);
          setMovs([]);
        }}
        {...drawerSemTranco}
        ModalProps={drawerSemTranco}
        slotProps={{ paper: { sx: papelDrawerSx } }}
      >
        {aberto ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <CabecalhoDrawer
              titulo="Histórico do item"
              icone={<ChecklistRtlIcon fontSize="small" />}
              onClose={() => {
                setAberto(null);
                setMovs([]);
              }}
            />
            <Box sx={{ px: 3, pt: 2.5, pb: 2, borderBottom: '1px solid var(--ga-border)', bgcolor: 'var(--ga-surface)' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                {nomeProdutoBreak(aberto.descricao) || aberto.descricao}
              </Typography>
              <Typography
                sx={{
                  fontSize: 28,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                  mt: 0.5,
                  color: Number(aberto.quantidade) <= 0.001 ? corEstoque.vermelho : 'text.primary',
                }}
              >
                {fmtQtdSaldo(aberto.quantidade, aberto.unidade_contagem)}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                {[
                  rotuloGrupoSaldo(aberto.grupo_diario),
                  aberto.atualizado_em ? `atualizado ${fmtHoraBR(aberto.atualizado_em)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
              {carregandoMovs ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                  <CircularProgress size={22} />
                </Box>
              ) : movs.length ? (
                <>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 88px 72px 80px', gap: 1, pb: 0.75, borderBottom: `1px solid ${colors.border}` }}>
                    {['Quando', 'Tipo', 'Qtd', 'Saldo'].map((h) => (
                      <Typography
                        key={h}
                        sx={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: colors.textMuted,
                          textAlign: h === 'Quando' || h === 'Tipo' ? 'left' : 'right',
                        }}
                      >
                        {h}
                      </Typography>
                    ))}
                  </Box>
                  {movs.map((m) => {
                    const qtd = Number(m.quantidade);
                    const saida = qtd < 0;
                    return (
                      <Box
                        key={m.id_movimento}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 88px 72px 80px',
                          gap: 1,
                          alignItems: 'baseline',
                          py: 1.05,
                          borderBottom: `1px solid ${colors.border}`,
                        }}
                      >
                        <Typography sx={{ fontSize: '0.78rem', color: colors.textSecondary }}>
                          {fmtHoraBR(m.data_movimento || m.criado_em) || '—'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: colors.textPrimary }}>
                          {labelTipoMovimento(m.tipo)}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: saida ? '#B42318' : '#127846',
                          }}
                        >
                          {qtd > 0 ? '+' : ''}
                          {fmtNum(qtd, 2)}
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {m.saldo_apos != null ? fmtNum(m.saldo_apos, 2) : '—'}
                        </Typography>
                      </Box>
                    );
                  })}
                </>
              ) : (
                <Typography sx={{ color: colors.textMuted, fontSize: '0.8125rem' }}>
                  Ainda não tem movimento neste item.
                </Typography>
              )}
            </Box>
          </Box>
        ) : null}
      </Drawer>
    </Box>
  );
}

const SELO_PRECO: Record<EstoqueSituacaoPreco, { label: string; cor: string; fundo: string }> = {
  acima: { label: 'Acima da tabela', cor: corEstoque.vermelho, fundo: 'rgba(196, 69, 45, 0.08)' },
  igual: { label: 'Na tabela', cor: corEstoque.verde, fundo: 'rgba(46, 125, 91, 0.08)' },
  abaixo: { label: 'Abaixo', cor: corEstoque.azul, fundo: 'rgba(27, 110, 243, 0.08)' },
  sem_tabela: { label: 'Fora da tabela', cor: corEstoque.cinza, fundo: 'rgba(100, 116, 139, 0.08)' },
  conferir_unidade: { label: 'Conferir unidade', cor: corEstoque.laranja, fundo: 'rgba(196, 122, 42, 0.1)' },
};

type OpcaoLojaFiltro = { id: string; nome: string; detalhe: string };

function MarcaLojaFiltro({ opcao, size }: { opcao: OpcaoLojaFiltro | null; size: number }) {
  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    bgcolor: 'var(--ga-canvas-alt)',
    border: '1px solid var(--ga-border)',
    overflow: 'hidden',
  } as const;
  if (!opcao || opcao.id === 'todas') {
    return (
      <Box sx={{ ...base, color: corEstoque.azul }}>
        <StorefrontOutlinedIcon sx={{ fontSize: size * 0.58 }} />
      </Box>
    );
  }
  return (
    <Box sx={base}>
      <img src={assetUrl(ehLojaPopeyes(opcao.nome) ? 'Popeyes.png' : 'BK_logo.png')} alt="" width={size * 0.7} height={size * 0.7} />
    </Box>
  );
}

function FiltroLojaPedidos({
  valor,
  opcoes,
  onChange,
}: {
  valor: string;
  opcoes: OpcaoLojaFiltro[];
  onChange: (id: string) => void;
}) {
  const selecionada = opcoes.find((o) => o.id === valor) || null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: 280 }}>
      <MarcaLojaFiltro opcao={selecionada} size={30} />
      <Autocomplete
        size="small"
        fullWidth
        disableClearable
        options={opcoes}
        value={selecionada ?? undefined}
        onChange={(_, o) => o && onChange(o.id)}
        getOptionLabel={(o) => o.nome}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        noOptionsText="Nenhuma loja"
        slotProps={{ listbox: { sx: { maxHeight: 320 } } }}
        renderOption={(props, o) => {
          const { key, ...rest } = props;
          return (
            <Box component="li" key={key ?? o.id} {...rest} sx={{ display: 'flex !important', alignItems: 'center', gap: 1, py: 0.75 }}>
              <MarcaLojaFiltro opcao={o} size={28} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{o.nome}</Typography>
                <Typography sx={{ fontSize: 11, color: FIN_MUTED, lineHeight: 1.2 }}>{o.detalhe}</Typography>
              </Box>
            </Box>
          );
        }}
        renderInput={(params) => <TextField {...params} label="Loja" placeholder="Buscar loja…" sx={finCampoSx} />}
      />
    </Box>
  );
}

/** Pedidos feitos no eSupri: preço cobrado × Tabela BKC, por loja ou da rede. */
function PainelPedidosPortal({ idLoja, alternar }: { idLoja: number; alternar: ReactNode }) {
  const [de, setDe] = useState(() => `${hojeISO().slice(0, 7)}-01`);
  const [ate, setAte] = useState(hojeISO);
  const [escopo, setEscopo] = useState(String(idLoja));
  const [dados, setDados] = useState<EstoquePedidosTabelaPeriodo | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('acima');
  const [aberto, setAberto] = useState<number | null>(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    setEscopo(String(idLoja));
  }, [idLoja]);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!de || !ate) return;
      if (!silencioso) setLoading(true);
      try {
        setDados(await api.estoquePedidosTabelaPeriodo({ de, ate }));
      } catch (e) {
        if (!silencioso) showToast(e instanceof Error ? e.message : 'Erro ao abrir pedidos do portal', 'error');
      } finally {
        if (!silencioso) setLoading(false);
      }
    },
    [de, ate],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!dados?.sincronizando) return;
    const t = window.setTimeout(() => void carregar(true), 15000);
    return () => window.clearTimeout(t);
  }, [dados, carregar]);

  const rede = escopo === 'todas';
  const idEscopo = rede ? null : Number(escopo);
  const lojaEscopo = idEscopo ? dados?.por_loja.find((l) => l.id_loja === idEscopo) || null : null;
  const nomeEscopo = rede
    ? `Rede · ${dados?.por_loja.length || 0} lojas`
    : lojaEscopo
      ? nomeLojaCurto(lojaEscopo.loja)
      : 'Esta loja';
  const pedidos = useMemo(
    () => (dados?.pedidos || []).filter((p) => idEscopo == null || p.id_loja === idEscopo),
    [dados, idEscopo],
  );
  const resumo = useMemo(() => resumirPedidosTabela(pedidos), [pedidos]);

  const detalheLoja = (pedidosQtd: number, valorAcima: number) =>
    `${pedidosQtd} pedido(s)${valorAcima > 0 ? ` · ${fmtMoeda(valorAcima)} a mais` : ''}`;
  const opcoesLoja: OpcaoLojaFiltro[] = [
    {
      id: 'todas',
      nome: 'Todas as lojas',
      detalhe: dados ? `${dados.por_loja.length} lojas · ${detalheLoja(dados.resumo.pedidos, dados.resumo.valor_acima)}` : 'Rede',
    },
    ...[...(dados?.por_loja || [])]
      .sort((a, b) => nomeLojaCurto(a.loja).localeCompare(nomeLojaCurto(b.loja)))
      .map((l) => ({ id: String(l.id_loja), nome: nomeLojaCurto(l.loja), detalhe: detalheLoja(l.pedidos, l.valor_acima) })),
  ];
  if (!rede && !lojaEscopo) opcoesLoja.splice(1, 0, { id: escopo, nome: 'Esta loja', detalhe: 'Sem pedidos no período' });

  const gerarPdf = async () => {
    if (!dados) return;
    setGerando(true);
    try {
      const { gerarPdfPrecoTabela } = await import('../../utils/gerarPdfPrecoTabela');
      await gerarPdfPrecoTabela({ dados, pedidos, escopo: nomeEscopo, rede });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao gerar o PDF', 'error');
    } finally {
      setGerando(false);
    }
  };

  const opcoes = [
    { id: 'acima', label: 'Acima da tabela', qtd: resumo.pedidos_acima },
    { id: 'todos', label: 'Todos', qtd: pedidos.length },
  ];
  const lista = filtro === 'acima' ? pedidos.filter((p) => p.preco.acima > 0) : pedidos;
  const pedidoAberto = pedidos.find((p) => p.id_pedido === aberto) || null;
  const ultimaLeitura = rede
    ? (dados?.por_loja || []).reduce<string | null>((m, l) => (l.sincronizado_em && (!m || l.sincronizado_em > m) ? l.sincronizado_em : m), null)
    : lojaEscopo?.sincronizado_em || null;
  const lidoEm = ultimaLeitura ? fmtHoraBR(ultimaLeitura) : null;
  const leituraAuto = dados?.sincronizando
    ? 'lendo o eSupri agora…'
    : dados?.leitura_automatica
      ? `próxima leitura às ${dados.leitura_automatica.proxima}`
      : null;
  const pctPedido = resumo.valor_pedidos ? resumo.valor_acima / resumo.valor_pedidos : 0;
  const maxLoja = Math.max(...resumo.por_loja.map((l) => l.valor_acima), 1);
  const nomeTabelas = (resumo.tabelas.length ? resumo.tabelas : dados?.tabelas || []).join(' / ') || dados?.tabela || '';
  const freteKg = (v: number | null | undefined) => (v != null ? `${fmtMoeda(v)}/kg` : '—');

  return (
    <Paper variant="outlined" sx={{ ...tablePaperSx, ...cartaoSx, minHeight: 0 }}>
      <CabecalhoCartao
        titulo={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25 }}>
            {alternar}
            Pedidos no portal
          </Box>
        }
        sub={
          dados
            ? `Preço cobrado pela Platlog × Tabela BKC ${nomeTabelas} de ${fmtDataBR(dados.vigencia_tabela)}${lidoEm ? ` · lido do eSupri ${lidoEm}` : ''}${leituraAuto ? ` · ${leituraAuto}` : ''}`
            : 'Carregando…'
        }
      >
        <FiltroIntervaloDatasFrota variante="texto" dataInicio={de} dataFim={ate} onChangeInicio={setDe} onChangeFim={setAte} />
        <FiltroLojaPedidos
          valor={escopo}
          opcoes={opcoesLoja}
          onChange={(v) => {
            setEscopo(v);
            setFiltro('acima');
          }}
        />
        {!rede ? <SeletorFiltro valor={filtro} onChange={setFiltro} opcoes={opcoes} largura={176} /> : null}
        <Button
          variant="outlined"
          startIcon={<PictureAsPdfOutlinedIcon sx={{ fontSize: 18 }} />}
          onClick={() => void gerarPdf()}
          disabled={gerando || !pedidos.length}
          sx={finBtnOutlinedSx}
        >
          {gerando ? 'Gerando…' : 'Relatório PDF'}
        </Button>
      </CabecalhoCartao>

      {dados ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderBottom: '1px solid var(--ga-border)', flexShrink: 0 }}>
          {[
            {
              rot: 'Cobrado a mais',
              val: fmtMoeda(resumo.valor_acima),
              sub: `${fmtNum(pctPedido * 100, 2)}% de ${fmtMoeda(resumo.valor_pedidos)} pedidos`,
              cor: resumo.valor_acima > 0 ? corEstoque.vermelho : 'text.primary',
            },
            {
              rot: 'Itens acima da tabela',
              val: `${fmtNum(resumo.acima, 0)} de ${fmtNum(resumo.itens_comparados, 0)}`,
              sub: resumo.conferir_unidade ? `${resumo.conferir_unidade} para conferir unidade (fora do total)` : 'itens comparados com a tabela',
              cor: 'text.primary',
            },
            {
              rot: 'Pedidos com cobrança a mais',
              val: `${resumo.pedidos_acima} de ${resumo.pedidos}`,
              sub: rede ? `${resumo.por_loja.filter((l) => l.valor_acima > 0).length} de ${resumo.por_loja.length} lojas` : `${fmtDataBR(de)} a ${fmtDataBR(ate)}`,
              cor: 'text.primary',
            },
            {
              rot: 'Frete cobrado na NF',
              val: resumo.frete.pedidos_com_nf ? fmtMoeda(resumo.frete.valor) : '—',
              sub: resumo.frete.pedidos_com_nf
                ? `${freteKg(resumo.frete.por_kg)} · ${fmtNum((resumo.frete.pct_nf || 0) * 100, 1)}% da NF · ${resumo.frete.pedidos_com_nf} de ${resumo.pedidos} faturados`
                : 'nenhum pedido faturado ainda',
              cor: 'text.primary',
            },
          ].map((c, idx) => (
            <Box key={c.rot} sx={{ px: 2, py: 1.25, borderLeft: idx ? '1px solid var(--ga-border)' : 0, minWidth: 0 }}>
              <Typography sx={rotuloSxPadrao}>{c.rot}</Typography>
              <Typography sx={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: c.cor, mt: 0.25 }}>{c.val}</Typography>
              <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{c.sub}</Typography>
            </Box>
          ))}
        </Box>
      ) : null}

      {rede ? (
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={{ ...tableSx, ...linhasTabelaSx }}>
            <TableHead sx={cabecaTabelaSx}>
              <TableRow>
                <TableCell sx={{ pl: 2 }}>Loja</TableCell>
                <TableCell align="right">Pedidos</TableCell>
                <TableCell align="right">Valor dos pedidos</TableCell>
                <TableCell align="right">Itens acima</TableCell>
                <TableCell sx={{ width: '24%' }}>Cobrado a mais</TableCell>
                <TableCell align="right">% do pedido</TableCell>
                <TableCell align="right" sx={{ pr: 2 }}>Frete na NF</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resumo.por_loja.map((l) => (
                <TableRow key={l.id_loja} hover onClick={() => setEscopo(String(l.id_loja))} sx={{ cursor: 'pointer' }}>
                  <TableCell sx={{ pl: 2 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 650 }}>{l.loja}</Typography>
                    {l.tabela ? <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Tabela {l.tabela}</Typography> : null}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {l.pedidos_acima} de {l.pedidos}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoeda(l.valor_pedidos)}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {fmtNum(l.acima, 0)} de {fmtNum(l.itens_comparados, 0)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'var(--ga-border)', overflow: 'hidden' }}>
                        <Box sx={{ width: `${(l.valor_acima / maxLoja) * 100}%`, height: '100%', bgcolor: corEstoque.vermelho, borderRadius: 3 }} />
                      </Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 650, color: corEstoque.vermelho, fontVariantNumeric: 'tabular-nums', minWidth: 96, textAlign: 'right' }}>
                        {fmtMoeda(l.valor_acima)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                    {l.valor_pedidos ? `${fmtNum((l.valor_acima / l.valor_pedidos) * 100, 2)}%` : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {l.frete.pedidos_com_nf ? (
                      <>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{fmtMoeda(l.frete.valor)}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{freteKg(l.frete.por_kg)}</Typography>
                      </>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!resumo.por_loja.length ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" align="center" sx={{ py: 3, fontSize: 13 }}>
                      {loading ? 'Carregando…' : 'Nenhum pedido no período.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
      <TableContainer sx={tableContainerSx}>
        <Table size="small" stickyHeader sx={{ ...tableSx, ...linhasTabelaSx }}>
          <TableHead sx={cabecaTabelaSx}>
            <TableRow>
              <TableCell sx={{ pl: 2 }}>Pedido</TableCell>
              <TableCell align="right">Valor do pedido</TableCell>
              <TableCell align="right">Itens acima da tabela</TableCell>
              <TableCell align="right">Cobrado a mais</TableCell>
              <TableCell align="right" sx={{ pr: 2 }}>Frete na NF</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lista.map((p) => (
              <TableRow key={p.id_pedido} hover onClick={() => setAberto(p.id_pedido)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ pl: 2 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{p.codigo}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{fmtDataBR(p.data_pedido)}</Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtMoeda(p.valor_total)}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {p.itens_lidos ? `${p.preco.acima} de ${p.itens.length}` : '—'}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 650, color: p.preco.valor_acima > 0 ? corEstoque.vermelho : 'text.secondary' }}>
                  {p.preco.valor_acima > 0 ? fmtMoeda(p.preco.valor_acima) : '—'}
                </TableCell>
                <TableCell align="right" sx={{ pr: 2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {p.frete ? (
                    <>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{fmtMoeda(p.frete.valor)}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{freteKg(p.frete.por_kg)}</Typography>
                    </>
                  ) : (
                    <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>sem NF ainda</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!lista.length ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography color="text.secondary" align="center" sx={{ py: 3, fontSize: 13 }}>
                    {loading
                      ? 'Carregando…'
                      : pedidos.length
                        ? 'Nenhum pedido neste filtro.'
                        : 'Nenhum pedido no período.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      <Drawer
        anchor="right"
        open={pedidoAberto != null}
        onClose={() => setAberto(null)}
        {...drawerSemTranco}
        ModalProps={drawerSemTranco}
        slotProps={{ paper: { sx: { ...papelDrawerSx, width: 640 } } }}
      >
        {pedidoAberto ? (
          (() => {
            const p = pedidoAberto;
            const itensOrd = [...p.itens].sort((a, b) => (b.diferenca_total || 0) - (a.diferenca_total || 0));
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <CabecalhoDrawer titulo={`Pedido ${p.codigo}`} icone={<ReceiptLongOutlinedIcon fontSize="small" />} onClose={() => setAberto(null)} />
                <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', border: '1px solid var(--ga-border)', borderRadius: '10px', bgcolor: 'var(--ga-surface)' }}>
                    {[
                      ['Valor do pedido', fmtMoeda(p.valor_total), 'text.primary'],
                      ['Itens acima da tabela', `${p.preco.acima} de ${p.itens.length}`, 'text.primary'],
                      ['Cobrado a mais', p.preco.valor_acima > 0 ? fmtMoeda(p.preco.valor_acima) : '—', p.preco.valor_acima > 0 ? corEstoque.vermelho : 'text.primary'],
                    ].map(([rot, val, cor], idx) => (
                      <Box key={rot} sx={{ px: 1.5, py: 1.1, borderLeft: idx ? '1px solid var(--ga-border)' : 0, minWidth: 0 }}>
                        <Typography sx={rotuloSxPadrao}>{rot}</Typography>
                        <Typography noWrap sx={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', mt: 0.25, color: cor }}>{val}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: -1 }}>
                    {nomeLojaCurto(p.loja)} · pedido feito em {fmtDataBR(p.data_pedido)}
                    {p.tabela ? ` · Tabela ${p.tabela}` : ''}
                    {p.frete
                      ? ` · frete na NF ${fmtMoeda(p.frete.valor)} (${freteKg(p.frete.por_kg)}, ${fmtNum((p.frete.pct_nf || 0) * 100, 1)}% da NF, ${fmtNum(p.frete.peso_kg, 0)} kg)`
                      : ' · ainda sem NF, frete aparece quando faturar'}
                  </Typography>

                  <Box>
                    <Typography sx={{ ...rotuloSxPadrao, mb: 1 }}>
                      Itens · preço cobrado × Tabela BKC
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={cabecaTabelaSx}>
                          <TableCell>Item</TableCell>
                          <TableCell align="right">Qtd</TableCell>
                          <TableCell align="right">Cobrado</TableCell>
                          <TableCell align="right">Tabela</TableCell>
                          <TableCell align="right">A mais</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {itensOrd.map((it, idx) => {
                          const sp = SELO_PRECO[it.situacao_preco];
                          const acima = it.situacao_preco === 'acima';
                          return (
                            <TableRow key={`${it.codigo}-${idx}`} sx={{ bgcolor: acima ? 'rgba(196, 69, 45, 0.035)' : undefined }}>
                              <TableCell sx={{ maxWidth: 220 }}>
                                <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 600 }} title={it.descricao}>{it.descricao}</Typography>
                                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{it.codigo}</Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtNum(it.quantidade, 0)}</TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtMoeda(it.valor_unitario)}</TableCell>
                              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                                {it.preco_tabela != null ? fmtMoeda(it.preco_tabela) : '—'}
                              </TableCell>
                              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                {acima ? (
                                  <Typography sx={{ fontSize: 12.5, fontWeight: 650, color: corEstoque.vermelho, fontVariantNumeric: 'tabular-nums' }}>
                                    +{fmtMoeda(it.diferenca_total)}
                                  </Typography>
                                ) : (
                                  <Selo label={sp.label} cor={sp.cor} fundo={sp.fundo} />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {!itensOrd.length ? (
                          <TableRow>
                            <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary', py: 2 }}>
                              Itens ainda não lidos. Entram na próxima leitura automática.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </Box>
                </Box>
              </Box>
            );
          })()
        ) : null}
      </Drawer>
    </Paper>
  );
}

function PainelPedido({ idLoja }: { idLoja: number }) {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<EstoquePedidoRascunho | null>(null);
  const [itens, setItens] = useState<EstoquePedidoRascunhoItem[]>([]);
  const [notas, setNotas] = useState<EstoqueNfeResumo[]>([]);
  const [filtroNota, setFiltroNota] = useState('entregue');
  const [notaAberta, setNotaAberta] = useState<number | null>(null);
  const [detalhesNota, setDetalhesNota] = useState<Record<number, EstoqueNfeDetalhe | 'carregando' | 'erro'>>({});

  const abrirNota = (idNfe: number) => {
    if (notaAberta === idNfe) {
      setNotaAberta(null);
      return;
    }
    setNotaAberta(idNfe);
    const atual = detalhesNota[idNfe];
    if (atual && atual !== 'erro') return;
    setDetalhesNota((d) => ({ ...d, [idNfe]: 'carregando' }));
    api
      .estoqueNfeDetalhe(idNfe)
      .then((det) => setDetalhesNota((d) => ({ ...d, [idNfe]: det })))
      .catch(() => setDetalhesNota((d) => ({ ...d, [idNfe]: 'erro' })));
  };
  const [dias, setDias] = useState('7');
  const [seguranca, setSeguranca] = useState('1');
  const [metaCmp, setMetaCmp] = useState('38');
  const [visao, setVisao] = useState<'rascunho' | 'portal'>('rascunho');
  const [montando, setMontando] = useState(false);
  const podeDevolverNf = podeReabrirConferenciaNfe(getUsuario());
  const [reabrindoNf, setReabrindoNf] = useState(false);
  const [devolverNf, setDevolverNf] = useState<{ id: number; numero: string } | null>(null);
  const [printCarrinho, setPrintCarrinho] = useState<{
    png: string;
    preenchidos: number;
    faltou: number;
    faltouCodigos: string[];
    valorPortal: string | null;
    valorLista: number;
    precos: Array<{ codigo: string; caixas: number; lista: number | null; portal: number | null }>;
  } | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const meta = Number(String(metaCmp).replace(',', '.')) / 100;
      const [r, nfs] = await Promise.all([
        api.estoquePedidoRascunho(idLoja, {
          dias: Number(dias) || 7,
          estoque_seguranca_dias: Number(seguranca) || 0,
          meta_cmp: Number.isFinite(meta) ? meta : 0.38,
        }),
        api.estoqueNfes(idLoja, { dias: 120, limit: 200 }).catch(() => [] as EstoqueNfeResumo[]),
      ]);
      setDados(r);
      setItens(r.itens.map((i) => ({ ...i })));
      setNotas(nfs.filter((n) => grupoFornecedorNfe(n) === 'Platlog'));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao calcular pedido', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja, dias, seguranca, metaCmp]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const visiveis = itens;
  const listaPedido = [...visiveis].sort((a, b) => {
    const pa = !a.bloqueado && Number(a.pedido_ajustado) > 0 ? 0 : 1;
    const pb = !b.bloqueado && Number(b.pedido_ajustado) > 0 ? 0 : 1;
    return pa - pb;
  });
  const valorAjustado = visiveis.reduce(
    (s, i) => s + Math.max(0, Number(i.pedido_ajustado) || 0) * Number(i.preco_caixa || 0),
    0,
  );

  const copiar = () => {
    const linhas = visiveis
      .filter((i) => Number(i.pedido_ajustado) > 0)
      .map(
        (i) =>
          `${i.codigo}\t${i.descricao}\t${Number(i.pedido_ajustado).toLocaleString('pt-BR')}`,
      );
    const texto = ['Código\tInsumo\tCaixas', ...linhas].join('\n');
    void navigator.clipboard?.writeText(texto);
    showToast(`${linhas.length} item(ns) copiados. O app não envia o pedido.`, 'success');
  };

  const montarCarrinho = async () => {
    if (dados?.piloto_carrinho_bloqueado) {
      showToast(`${dados.piloto_bloqueio || 'Esta loja'} fica fora do piloto.`, 'error');
      return;
    }
    const linhas = visiveis
      .filter((i) => i.fornecedor === 'platlog' && !i.bloqueado && i.vende_esupri !== false && Number(i.pedido_ajustado) > 0)
      .map((i) => ({
        codigo: i.codigo,
        caixas: Math.round(Number(i.pedido_ajustado)),
        preco: Number(i.preco_caixa) || 0,
      }));
    if (!linhas.length) {
      showToast('Nenhuma caixa Platlog para preencher.', 'error');
      return;
    }
    setMontando(true);
    try {
      const r = await api.estoquePedidoCarrinhoEsupri({ id_loja: idLoja, itens: linhas.slice(0, 40) });
      const faltou = r.nao_encontrados.length;
      setPrintCarrinho({
        png: r.png_base64,
        preenchidos: r.preenchidos.length,
        faltou,
        faltouCodigos: r.nao_encontrados.map((n) => n.codigo),
        valorPortal: r.valor_portal || null,
        valorLista: valorAjustado,
        precos: [
          ...r.preenchidos.map((p) => ({
            codigo: p.codigo,
            caixas: p.caixas,
            lista: p.preco_lista ?? null,
            portal: p.preco_portal ?? null,
          })),
          ...r.nao_encontrados.map((n) => {
            const origem = linhas.find((l) => l.codigo === n.codigo);
            return {
              codigo: n.codigo,
              caixas: origem?.caixas ?? 0,
              lista: origem?.preco ?? null,
              portal: null,
            };
          }),
        ],
      });
      showToast(
        r.preenchidos.length
          ? `${r.preenchidos.length} caixa(s) digitadas no print e depois apagadas. Pedido não enviado.`
          : 'O eSupri abriu, mas nenhuma quantidade foi digitada.',
        r.preenchidos.length ? 'success' : 'error',
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao abrir o eSupri', 'error');
    } finally {
      setMontando(false);
    }
  };

  if (loading && !dados) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const cmp = dados?.cmp;
  const brl = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlCurto = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const hoje = hojeISO();
  const em7 = (() => {
    const d = new Date(`${hoje}T12:00:00`);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const portalNota = (s?: string | null) => String(s || '').trim().toUpperCase();
  const vencNota = (n: EstoqueNfeResumo) => (n.data_vencimento ? String(n.data_vencimento).slice(0, 10) : '');
  const etapasNota = (
    [
      {
        id: 'entregue',
        label: 'Entregue',
        dica: 'Saiu da Platlog e o gestor ainda não conferiu. Cobrar a conferência.',
        cor: '#C47A2A',
        fundo: 'rgba(196, 122, 42, 0.08)',
        teste: (n: EstoqueNfeResumo) => n.status_entrega === 'aguardando_conferencia',
      },
      {
        id: 'atraso',
        label: 'Em atraso',
        dica: 'Título vencido no eSupri.',
        cor: '#C4452D',
        fundo: 'rgba(196, 69, 45, 0.07)',
        teste: (n: EstoqueNfeResumo) => !n.pago && portalNota(n.status_portal) === 'ATRASO',
      },
      {
        id: 'apagar',
        label: 'A pagar',
        dica: (() => {
          const semana = notas.filter((n) => {
            const v = vencNota(n);
            return !n.pago && portalNota(n.status_portal) === 'ABERTO' && Boolean(v) && v >= hoje && v <= em7;
          }).length;
          return semana
            ? `Em aberto e no prazo. ${semana} ${semana === 1 ? 'vence' : 'vencem'} nos próximos 7 dias.`
            : 'Em aberto e no prazo.';
        })(),
        cor: '#1B6EF3',
        fundo: 'rgba(27, 110, 243, 0.07)',
        teste: (n: EstoqueNfeResumo) => {
          const v = vencNota(n);
          return !n.pago && portalNota(n.status_portal) === 'ABERTO' && (!v || v >= hoje);
        },
      },
      {
        id: 'pago',
        label: 'Pago',
        dica: 'Título conciliado no financeiro.',
        cor: '#7C5CC4',
        fundo: 'rgba(124, 92, 196, 0.07)',
        teste: (n: EstoqueNfeResumo) => Boolean(n.pago),
      },
      {
        id: 'confirmada',
        label: 'Confirmada',
        dica: 'O gestor conferiu e a mercadoria entrou no estoque.',
        cor: '#2E7D5B',
        fundo: 'rgba(46, 125, 91, 0.07)',
        teste: (n: EstoqueNfeResumo) => n.status_entrega === 'conferida',
      },
      {
        id: 'divergente',
        label: 'Divergente',
        dica: 'O gestor conferiu e faltou quantidade.',
        cor: '#B42318',
        fundo: 'rgba(180, 35, 24, 0.06)',
        teste: (n: EstoqueNfeResumo) => n.status_entrega === 'divergente',
      },
    ] as const
  )
    .map((e) => {
      const lista = notas.filter(e.teste);
      return { ...e, qtd: lista.length, valor: lista.reduce((s, n) => s + (Number(n.valor_total) || 0), 0) };
    });
  const etapaAtiva =
    etapasNota.find((e) => e.id === filtroNota && e.qtd > 0) || etapasNota.find((e) => e.qtd > 0) || null;
  const notasLista = etapaAtiva
    ? notas.filter(etapaAtiva.teste).sort((a, b) => (vencNota(a) || '9999').localeCompare(vencNota(b) || '9999'))
    : [];

  const alvoDias = Number(dias) || 7;
  const comCaixa = visiveis.filter((i) => Number(i.pedido_ajustado) > 0 && !i.bloqueado).length;
  const deFora = visiveis.filter((i) => i.bloqueado).length;
  const horaGravada = dados?.simulacao?.criado_em
    ? new Date(dados.simulacao.criado_em).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : '';
  const diaCurto = (iso?: string) => {
    if (!iso || iso.length < 10) return '';
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  };
  const motivoLinha = (motivo: string | null) => {
    if (motivo === 'sem_preco') return 'Sem preço — ficou de fora';
    if (motivo === 'nao_vende') return 'Não vende no eSupri';
    if (motivo === 'ficha_zerada') return 'Ficha zerada — ficou de fora';
    if (motivo === 'quantidade_alta') return 'Quantidade alta — conferir a ficha';
    if (motivo === 'teto_cmp') return 'Cortado pelo teto';
    return '';
  };
  const definirCaixas = (codigo: string, valor: number) => {
    setItens((atual) =>
      atual.map((row) =>
        row.codigo === codigo && !row.bloqueado ? { ...row, pedido_ajustado: Math.max(0, valor) } : row,
      ),
    );
  };
  const cardSx = {
    border: '1px solid var(--ga-border)',
    borderRadius: '10px',
    bgcolor: 'var(--ga-surface)',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  } as const;
  const rotuloSx = {
    fontSize: 11,
    fontWeight: 650,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'text.secondary',
  } as const;
  const cabecaSx = {
    '& th': {
      fontSize: 11,
      fontWeight: 650,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'text.secondary',
      bgcolor: 'var(--ga-surface)',
      borderBottom: '1px solid var(--ga-border)',
      py: 1,
      whiteSpace: 'nowrap',
    },
  } as const;

  const estourou = cmp ? Math.max(0, cmp.compras_mes - cmp.teto_mes) : 0;
  const cmpAlto = Boolean(cmp && cmp.cmp_atual_pct != null && cmp.cmp_atual_pct > cmp.meta_pct);
  const usoTeto = cmp && cmp.teto_mes > 0 ? cmp.compras_mes / cmp.teto_mes : 0;
  const alternarVisao = (
    <BarraSegmento
      itens={[
        { id: 'rascunho', label: 'Sugestão', ativo: visao === 'rascunho', onClick: () => setVisao('rascunho') },
        { id: 'portal', label: 'No portal', ativo: visao === 'portal', onClick: () => setVisao('portal') },
      ]}
    />
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1, minHeight: 0, color: 'var(--ga-text-primary)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.9, borderRadius: '8px', bgcolor: 'rgba(196, 122, 42, 0.12)', flexShrink: 0 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#C47A2A', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 13, color: '#7A4E12' }}>
          Sugestão de teste. Esta lista não envia pedido.
          {horaGravada ? ` Gravada às ${horaGravada}.` : ''}
          {deFora ? ` ${deFora} ${deFora === 1 ? 'item ficou' : 'itens ficaram'} de fora.` : ''}
        </Typography>
      </Box>
      {cmp ? (
        <Paper
          variant="outlined"
          sx={{
            ...cardSx,
            flexShrink: 0,
            px: 2.25,
            py: 1.75,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'minmax(280px, 1.3fr) repeat(3, minmax(0, 1fr))' },
            columnGap: 2.5,
            rowGap: 1.5,
            alignItems: 'center',
          }}
        >
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <Typography sx={rotuloSx}>CMP do mês</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.25 }}>
              <Typography sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: cmpAlto ? '#C4452D' : 'text.primary' }}>
                {cmp.cmp_atual_pct != null ? `${fmtNum(cmp.cmp_atual_pct, 1)}%` : '—'}
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>meta {fmtNum(cmp.meta_pct, 0)}%</Typography>
            </Box>
            <Box sx={{ position: 'relative', height: 6, borderRadius: 3, bgcolor: 'var(--ga-border)', mt: 1, overflow: 'hidden' }}>
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: `${Math.min(1, usoTeto) * 100}%`,
                  borderRadius: 3,
                  bgcolor: usoTeto > 1 ? '#C4452D' : usoTeto > 0.85 ? '#C47A2A' : '#1B6EF3',
                }}
              />
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
              {brlCurto(cmp.compras_mes)} de {brlCurto(cmp.teto_mes)} de teto
            </Typography>
          </Box>
          {[
            { rotulo: 'Já comprado', valor: brl(cmp.compras_mes), sub: `Venda do mês ${brlCurto(cmp.venda_mes)}`, cor: 'text.primary' },
            estourou > 0
              ? { rotulo: 'Estourou', valor: brl(estourou), sub: `Acima do teto de ${fmtNum(cmp.meta_pct, 0)}%`, cor: '#C4452D' }
              : { rotulo: 'Ainda cabe', valor: brl(cmp.teto_restante), sub: `Teto ${brlCurto(cmp.teto_mes)}`, cor: '#2E7D5B' },
            {
              rotulo: 'Este pedido',
              valor: brl(valorAjustado),
              sub: comCaixa ? `${comCaixa} ${comCaixa === 1 ? 'item' : 'itens'} com caixa` : 'Nenhuma caixa',
              cor: valorAjustado > cmp.teto_restante && valorAjustado > 0 ? '#C4452D' : '#1B6EF3',
            },
          ].map((s) => (
            <Box key={s.rotulo} sx={{ borderLeft: { md: '1px solid var(--ga-border)' }, pl: { md: 2.5 }, minWidth: 0 }}>
              <Typography sx={rotuloSx}>{s.rotulo}</Typography>
              <Typography noWrap sx={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: s.cor, mt: 0.25 }}>
                {s.valor}
              </Typography>
              <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{s.sub}</Typography>
            </Box>
          ))}
          {cmp.teto_restante <= 0 && cmp.teto_aplicado ? (
            <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.9, borderRadius: '8px', bgcolor: 'rgba(196, 69, 45, 0.07)' }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#C4452D', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12.5, color: '#8F2F1D' }}>
                O mês já passou do teto de {fmtNum(cmp.meta_pct, 0)}%. As sugestões foram zeradas; o que entrar agora aumenta o estouro.
              </Typography>
            </Box>
          ) : null}
        </Paper>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 380px' },
          gridAutoRows: { xs: 'minmax(360px, auto)', lg: 'minmax(0, 1fr)' },
          gap: 1.25,
          flex: 1,
          minHeight: 0,
          overflow: { xs: 'auto', lg: 'visible' },
        }}
      >
        {visao === 'portal' ? (
          <PainelPedidosPortal idLoja={idLoja} alternar={alternarVisao} />
        ) : (
        <Paper variant="outlined" sx={{ ...tablePaperSx, ...cardSx, minHeight: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, borderBottom: '1px solid var(--ga-border)', flexShrink: 0, flexWrap: 'wrap' }}>
            {alternarVisao}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Pedido da semana</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                {dados?.janela_compra
                  ? `Pede ${dados.janela_compra.dias_pedido}, até ${dados.janela_compra.hora_limite}. O pedido de ${diaCurto(dados.janela_compra.proximo_pedido)} chega 7 dias depois, em ${diaCurto(dados.janela_compra.entrega_deste)}. A comida tem que durar até o caminhão seguinte, ${diaCurto(dados.janela_compra.entrega_seguinte)}.${dados.platlog_itens ? ` ${dados.platlog_itens} itens pedidos pelas lojas nos últimos 120 dias.` : ''}`
                  : 'Essa loja não está na planilha de entregas. A conta usa os dias ao lado.'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, height: 32, px: 1.25, ml: 1, border: '1px solid var(--ga-border)', borderRadius: '8px' }}>
                {(
                  [
                    ...(dados?.janela_compra ? [] : [['Dias', dias, setDias, ''] as const]),
                    ['Segurança', seguranca, setSeguranca, ''] as const,
                    ['Teto', metaCmp, setMetaCmp, '%'] as const,
                  ] satisfies ReadonlyArray<readonly [string, string, (valor: string) => void, string]>
                ).map(([rotulo, valor, definir, sufixo]) => (
                <Box key={rotulo} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap' }}>{rotulo}</Typography>
                  <TextField
                    variant="standard"
                    value={valor}
                    onChange={(e) => definir(e.target.value)}
                    slotProps={{ input: { disableUnderline: true } }}
                    sx={{
                      width: sufixo ? 22 : 18,
                      '& .MuiInputBase-input': { p: 0, textAlign: 'center', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
                    }}
                  />
                  {sufixo ? <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: -0.25 }}>{sufixo}</Typography> : null}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', ml: 'auto' }}>
              <Tooltip title="Recalcular">
                <IconButton size="small" onClick={() => void carregar()} sx={{ border: '1px solid var(--ga-border)', borderRadius: '8px', width: 32, height: 32 }}>
                  {loading ? <CircularProgress size={14} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
              <Button variant="outlined" onClick={copiar} disabled={!comCaixa} sx={finBtnOutlinedSx}>
                Copiar
              </Button>
              <Button
                variant="contained"
                disableElevation
                onClick={() => void montarCarrinho()}
                disabled={montando || Boolean(dados?.piloto_carrinho_bloqueado) || !comCaixa}
                sx={finBtnContainedSx}
              >
                {montando ? 'Abrindo eSupri…' : 'Montar no eSupri'}
              </Button>
            </Box>
          </Box>
          <TableContainer sx={tableContainerSx}>
            <Table size="small" stickyHeader sx={{ ...tableSx, '& td': { borderColor: 'var(--ga-border)', py: 1 } }}>
              <TableHead sx={cabecaSx}>
                <TableRow>
                  <TableCell sx={{ pl: 2 }}>Insumo</TableCell>
                  <TableCell align="right" sx={{ pl: '24px !important', pr: '48px !important', width: 168 }}>Estoque</TableCell>
                  <TableCell sx={{ pl: '32px !important' }}>Cobertura</TableCell>
                  <TableCell align="right">A caminho</TableCell>
                  <TableCell align="right">Sugestão</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell align="center" sx={{ pr: 2 }}>Caixas</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listaPedido.map((i) => {
                  const caixas = Math.max(0, Number(i.pedido_ajustado) || 0);
                  const valorLinha = caixas * Number(i.preco_caixa || 0);
                  const cob = i.cobertura_dias == null ? null : Math.max(0, Number(i.cobertura_dias));
                  const corCob = cob == null ? 'var(--ga-border)' : cob < alvoDias * 0.5 ? '#C4452D' : cob < alvoDias ? '#C47A2A' : '#2E7D5B';
                  const segurou = Boolean(i.bloqueado) && Number(i.caixas_calculo) > caixas;
                  const cortou = (i.cortado && Number(i.caixas_calculo) > Number(i.caixas_pedidas)) || segurou;
                  const est = partesEstoque(i.saldo_atual, i.unidade);
                  return (
                    <TableRow key={i.codigo} hover sx={{ bgcolor: i.bloqueado ? 'rgba(196, 122, 42, 0.06)' : caixas > 0 ? 'rgba(27, 110, 243, 0.035)' : undefined }}>
                      <TableCell sx={{ pl: 2, maxWidth: 360 }}>
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }} title={i.descricao}>
                          {i.descricao}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                          {i.codigo}
                          {motivoLinha(i.motivo) ? ` · ${motivoLinha(i.motivo)}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ pl: '24px !important', pr: '48px !important', width: 168, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: '8px' }}>
                          <Box component="span" sx={{ fontWeight: 650 }}>{est.qtd}</Box>
                          <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', letterSpacing: '0.04em' }}>{est.unidade}</Box>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ pl: '32px !important' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, ml: '8px' }}>
                          <Box sx={{ width: 64, height: 5, borderRadius: 3, bgcolor: 'var(--ga-border)', overflow: 'hidden', flexShrink: 0 }}>
                            <Box sx={{ width: `${cob == null ? 0 : Math.min(1, cob / (alvoDias * 2)) * 100}%`, height: '100%', bgcolor: corCob }} />
                          </Box>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: cob != null && cob < alvoDias ? corCob : 'text.secondary', whiteSpace: 'nowrap' }}>
                            {cob == null ? '—' : `${fmtNum(cob, 1)} d`}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                        {Number(i.a_caminho) > 0 ? fmtNum(i.a_caminho, 1) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {cortou ? (
                          <Tooltip title={segurou ? motivoLinha(i.motivo) : 'Cortado pelo teto do CMP'}>
                            <Box component="span">
                              <Box component="span" sx={{ textDecoration: 'line-through', color: 'text.secondary', mr: 0.75 }}>
                                {fmtNum(i.caixas_calculo, 0)}
                              </Box>
                              <Box component="span" sx={{ color: '#C4452D', fontWeight: 650 }}>{fmtNum(i.caixas_pedidas, 0)}</Box>
                            </Box>
                          </Tooltip>
                        ) : (
                          <Box component="span" sx={{ color: 'text.secondary' }}>{fmtNum(i.caixas_calculo, 0)}</Box>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: caixas > 0 ? 650 : 400, color: caixas > 0 ? 'text.primary' : 'text.secondary', whiteSpace: 'nowrap' }}>
                        {i.bloqueado
                          ? motivoLinha(i.motivo) || 'Fora'
                          : i.vende_esupri === false
                            ? 'Não vende'
                            : caixas > 0
                              ? brl(valorLinha)
                              : '—'}
                      </TableCell>
                      <TableCell align="center" sx={{ pr: 2, width: 128 }}>
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', height: 30, border: '1px solid', borderColor: caixas > 0 ? 'rgba(27, 110, 243, 0.45)' : 'var(--ga-border)', borderRadius: '8px', bgcolor: 'var(--ga-surface)' }}>
                          <IconButton size="small" disabled={i.bloqueado || caixas <= 0} onClick={() => definirCaixas(i.codigo, caixas - 1)} sx={{ width: 28, height: 28 }}>
                            <RemoveIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <TextField
                            variant="standard"
                            value={String(i.pedido_ajustado)}
                            onChange={(e) => definirCaixas(i.codigo, Number(String(e.target.value).replace(',', '.')) || 0)}
                            disabled={Boolean(i.bloqueado)}
                            slotProps={{ input: { disableUnderline: true } }}
                            sx={{
                              width: 34,
                              '& .MuiInputBase-input': { p: 0, textAlign: 'center', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: caixas > 0 ? '#1B6EF3' : 'text.secondary' },
                            }}
                          />
                          <IconButton size="small" disabled={Boolean(i.bloqueado)} onClick={() => definirCaixas(i.codigo, caixas + 1)} sx={{ width: 28, height: 28 }}>
                            <AddIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!listaPedido.length && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography color="text.secondary" align="center" sx={{ py: 3, fontSize: 13 }}>
                        Nenhum item precisa de caixa agora.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        )}

        <Paper variant="outlined" sx={{ ...cardSx, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid var(--ga-border)', flexShrink: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em' }}>Notas Platlog</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              {notas.length} {notas.length === 1 ? 'nota' : 'notas'} nos últimos 120 dias
            </Typography>
          </Box>
          {notas.length ? (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, p: 1.5, flexShrink: 0 }}>
                {etapasNota.map((e) => {
                  const ativo = etapaAtiva?.id === e.id;
                  const vazio = e.qtd === 0;
                  return (
                    <Box
                      key={e.id}
                      component="button"
                      type="button"
                      disabled={vazio}
                      onClick={() => setFiltroNota(e.id)}
                      sx={{
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
                        cursor: vazio ? 'default' : 'pointer',
                        opacity: vazio ? 0.45 : 1,
                        '&:disabled': { borderColor: 'var(--ga-border)' },
                        px: 1.25,
                        py: 1,
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: ativo ? e.cor : 'var(--ga-border)',
                        bgcolor: ativo ? e.fundo : 'transparent',
                        transition: 'border-color 120ms, background-color 120ms',
                        '&:hover': { borderColor: vazio ? 'var(--ga-border)' : e.cor },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: e.cor, flexShrink: 0 }} />
                        <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: ativo ? e.cor : 'text.secondary' }}>{e.label}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                        <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{e.qtd}</Typography>
                        <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{brlCurto(e.valor)}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
              {etapaAtiva ? (
                <Box sx={{ px: 2, py: 1, borderTop: '1px solid var(--ga-border)', borderBottom: '1px solid var(--ga-border)', bgcolor: etapaAtiva.fundo, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: 12, color: etapaAtiva.cor, fontWeight: 600 }}>{etapaAtiva.dica}</Typography>
                </Box>
              ) : null}
              <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {notasLista.map((n) => {
                  const venc = vencNota(n);
                  const vencida = Boolean(!n.pago && venc && venc < hoje && portalNota(n.status_portal) === 'ATRASO');
                  const aberta = notaAberta === n.id_nfe;
                  return (
                    <Box key={n.id_nfe} sx={{ borderBottom: '1px solid var(--ga-border)' }}>
                    <Box
                      component="button"
                      type="button"
                      onClick={() => abrirNota(n.id_nfe)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        width: '100%',
                        px: 2,
                        py: 1.1,
                        border: 0,
                        font: 'inherit',
                        color: 'inherit',
                        textAlign: 'left',
                        cursor: 'pointer',
                        bgcolor: aberta ? 'rgba(27, 110, 243, 0.06)' : 'transparent',
                        boxShadow: aberta ? 'inset 3px 0 0 #1B6EF3' : 'none',
                        '&:hover': { bgcolor: aberta ? 'rgba(27, 110, 243, 0.06)' : 'rgba(15, 23, 42, 0.03)' },
                        '&:hover .seta-nota': { opacity: 1, transform: 'translateX(2px)' },
                      }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>NF {n.numero || '—'}</Typography>
                        <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                          Emitida {fmtDataBR(n.emissao)}
                          {n.status_portal ? ` · ${n.status_portal.charAt(0).toUpperCase()}${n.status_portal.slice(1).toLowerCase()}` : ''}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>
                          {n.valor_total != null ? brl(Number(n.valor_total)) : '—'}
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums', color: vencida ? '#C4452D' : 'text.secondary' }}>
                          {n.pago ? `Pago · venceu ${fmtDataBR(venc)}` : venc ? `Vence ${fmtDataBR(venc)}` : 'Sem vencimento'}
                        </Typography>
                      </Box>
                      <ChevronRightIcon
                        className="seta-nota"
                        sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0, opacity: aberta ? 1 : 0.4, transition: 'opacity 120ms, transform 120ms' }}
                      />
                    </Box>
                    </Box>
                  );
                })}
              </Box>
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center' }}>
                Nenhuma nota Platlog desta loja nos últimos 120 dias.
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      <Drawer
        anchor="right"
        open={notaAberta != null}
        onClose={() => setNotaAberta(null)}
        {...drawerSemTranco}
        ModalProps={drawerSemTranco}
        slotProps={{ paper: { sx: { ...papelDrawerSx, width: 520 } } }}
      >
        {(() => {
          const n = notas.find((x) => x.id_nfe === notaAberta);
          if (!n) return null;
          const det = detalhesNota[n.id_nfe];
          const venc = vencNota(n);
          const entrega =
            n.status_entrega === 'divergente'
              ? { label: 'Divergente', cor: '#B42318', fundo: 'rgba(180, 35, 24, 0.08)' }
              : n.status_entrega === 'conferida'
                ? { label: 'Confirmada', cor: '#2E7D5B', fundo: 'rgba(46, 125, 91, 0.1)' }
                : n.status_entrega === 'aguardando_conferencia'
                  ? { label: 'Entregue · falta conferir', cor: '#C47A2A', fundo: 'rgba(196, 122, 42, 0.1)' }
                  : n.status_entrega === 'em_transito'
                    ? { label: 'Em trânsito', cor: '#3B6FD8', fundo: 'rgba(59, 111, 216, 0.1)' }
                    : { label: 'Pendente', cor: '#64748B', fundo: 'rgba(100, 116, 139, 0.1)' };
          const financeiro = n.pago
            ? { label: 'Pago', cor: '#7C5CC4', fundo: 'rgba(124, 92, 196, 0.1)' }
            : portalNota(n.status_portal) === 'ATRASO'
              ? { label: 'Em atraso', cor: '#C4452D', fundo: 'rgba(196, 69, 45, 0.1)' }
              : { label: 'A pagar', cor: '#1B6EF3', fundo: 'rgba(27, 110, 243, 0.1)' };
          const selo = (s: { label: string; cor: string; fundo: string }) => (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1, height: 24, borderRadius: '999px', bgcolor: s.fundo, color: s.cor, fontSize: 12, fontWeight: 650 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: s.cor }} />
              {s.label}
            </Box>
          );
          const linhas =
            det && det !== 'carregando' && det !== 'erro'
              ? det.itens
                  .map((it) => {
                    const nf = Number(it.qtd_estoque ?? it.q_com ?? 0);
                    const conf = it.qtd_conferida != null ? Number(it.qtd_conferida) : det.entrada_registrada ? nf : null;
                    const conferido = det.entrada_registrada && conf != null;
                    const falta = conferido ? Math.max(0, nf - (conf ?? 0)) : 0;
                    const valorFalta = nf > 0 ? (Number(it.v_prod) || 0) * (falta / nf) : 0;
                    return { it, nf, conf, conferido, falta, valorFalta };
                  })
                  .sort((a, b) => b.valorFalta - a.valorFalta)
              : [];
          const comFalta = linhas.filter((l) => l.falta > 0.0001);
          const certos = linhas.filter((l) => l.conferido && l.falta <= 0.0001).length;
          const valorFaltaTotal = comFalta.reduce((s, l) => s + l.valorFalta, 0);
          const conferida = Boolean(det && det !== 'carregando' && det !== 'erro' && det.entrada_registrada);

          return (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <CabecalhoDrawer titulo={`NF ${n.numero || '—'}`} icone={<ReceiptLongOutlinedIcon fontSize="small" />} onClose={() => setNotaAberta(null)} />
              <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }} noWrap>
                    {n.emitente_nome || 'Platlog'}
                  </Typography>
                  <Typography sx={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                    {n.valor_total != null ? brl(Number(n.valor_total)) : '—'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                    {selo(entrega)}
                    {selo(financeiro)}
                  </Box>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', border: '1px solid var(--ga-border)', borderRadius: '10px', bgcolor: 'var(--ga-surface)' }}>
                  {[
                    ['Emissão', fmtDataBR(n.emissao)],
                    ['Saída', fmtDataBR(n.data_saida)],
                    ['Entrada', fmtDataBR(n.data_entrega)],
                    ['Vencimento', fmtDataBR(venc)],
                  ].map(([rot, val], idx) => (
                    <Box key={rot} sx={{ px: 1.5, py: 1.1, borderLeft: idx ? '1px solid var(--ga-border)' : 0 }}>
                      <Typography sx={rotuloSx}>{rot}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', mt: 0.25, color: rot === 'Vencimento' && financeiro.label === 'Em atraso' ? '#C4452D' : 'text.primary' }}>
                        {val}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {det === 'carregando' || !det ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={22} />
                  </Box>
                ) : det === 'erro' ? (
                  <Typography sx={{ fontSize: 13, color: '#C4452D' }}>Não abriu os itens desta nota.</Typography>
                ) : (
                  <>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                      {[
                        { rot: 'Itens', val: String(linhas.length), cor: 'text.primary', sub: conferida ? 'conferidos' : 'na nota' },
                        { rot: 'Chegou certo', val: conferida ? String(certos) : '—', cor: '#2E7D5B', sub: conferida ? 'sem diferença' : 'aguardando o gestor' },
                        {
                          rot: 'Com falta',
                          val: conferida ? String(comFalta.length) : '—',
                          cor: comFalta.length ? '#C4452D' : 'text.secondary',
                          sub: comFalta.length ? brl(valorFaltaTotal) : conferida ? 'nada faltou' : 'aguardando o gestor',
                        },
                      ].map((c) => (
                        <Box key={c.rot} sx={{ px: 1.5, py: 1.25, border: '1px solid var(--ga-border)', borderRadius: '10px', bgcolor: 'var(--ga-surface)' }}>
                          <Typography sx={rotuloSx}>{c.rot}</Typography>
                          <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: c.cor, mt: 0.25 }}>{c.val}</Typography>
                          <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{c.sub}</Typography>
                        </Box>
                      ))}
                    </Box>

                    {(() => {
                      const acima = det.itens.filter((it) => it.situacao_preco === 'acima');
                      if (!acima.length) return null;
                      const total = acima.reduce((s, it) => s + Number(it.diferenca_total || 0), 0);
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderRadius: '8px', bgcolor: 'rgba(196, 69, 45, 0.07)' }}>
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: corEstoque.vermelho, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: 12.5, color: '#8F2F1D', fontVariantNumeric: 'tabular-nums' }}>
                            {acima.length} {acima.length === 1 ? 'item cobrado' : 'itens cobrados'} acima da Tabela BKC · {brl(total)} a mais
                            {det.pedido_esupri ? ` · pedido ${det.pedido_esupri}` : ''}
                          </Typography>
                        </Box>
                      );
                    })()}

                    {!conferida ? (
                      <Box sx={{ px: 1.5, py: 1, borderRadius: '8px', bgcolor: 'rgba(196, 122, 42, 0.1)' }}>
                        <Typography sx={{ fontSize: 12.5, color: '#8A5418' }}>
                          O gestor ainda não conferiu esta nota. As quantidades abaixo são as da nota.
                        </Typography>
                      </Box>
                    ) : null}

                    <Box>
                      <Typography sx={{ ...rotuloSx, mb: 1 }}>Itens da nota</Typography>
                      <Box sx={{ border: '1px solid var(--ga-border)', borderRadius: '10px', bgcolor: 'var(--ga-surface)', overflow: 'hidden' }}>
                        {linhas.map(({ it, nf, conf, conferido, falta, valorFalta }, idx) => {
                          const und = String(it.unidade_contagem || it.u_com || '').toUpperCase();
                          const temFalta = falta > 0.0001;
                          const cor = !conferido ? 'var(--ga-border-strong)' : temFalta ? '#C4452D' : '#2E7D5B';
                          const pct = !conferido ? 0 : nf > 0 ? Math.min(1, (conf ?? 0) / nf) : 1;
                          return (
                            <Box key={it.id_item} sx={{ px: 1.75, py: 1.25, borderTop: idx ? '1px solid var(--ga-border)' : 0, bgcolor: temFalta ? 'rgba(196, 69, 45, 0.035)' : undefined }}>
                              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }} title={it.descricao || ''}>
                                    {it.descricao || it.descricao_insumo || 'Item'}
                                  </Typography>
                                  <Typography noWrap sx={{ fontSize: 11.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                                    {[it.codigo_nf || it.codigo_insumo, it.v_prod != null ? brl(Number(it.v_prod)) : null].filter(Boolean).join(' · ')}
                                  </Typography>
                                  {it.preco_tabela != null && (it.situacao_preco === 'acima' || it.situacao_preco === 'conferir_unidade') ? (
                                    <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: SELO_PRECO[it.situacao_preco].cor }}>
                                      {it.situacao_preco === 'acima'
                                        ? `Cobrou ${brl(Number(it.v_un_com))} · tabela ${brl(it.preco_tabela)} · +${brl(Number(it.diferenca_total || 0))}`
                                        : `Cobrou ${brl(Number(it.v_un_com))} · tabela ${brl(it.preco_tabela)} · conferir unidade`}
                                    </Typography>
                                  ) : null}
                                </Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: temFalta ? '#C4452D' : conferido ? '#2E7D5B' : 'text.primary' }}>
                                  {conferido ? `${fmtNum(conf, 2)} / ${fmtNum(nf, 2)}` : fmtNum(nf, 2)}
                                  <Box component="span" sx={{ fontSize: 11.5, fontWeight: 500, color: 'text.secondary', ml: 0.5 }}>{und}</Box>
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
                                <Box sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: 'var(--ga-border)', overflow: 'hidden' }}>
                                  <Box sx={{ width: `${pct * 100}%`, height: '100%', bgcolor: cor }} />
                                </Box>
                                <Typography sx={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', color: !conferido ? 'text.secondary' : cor, fontVariantNumeric: 'tabular-nums' }}>
                                  {!conferido ? 'Não conferido' : temFalta ? `Faltou ${fmtNum(falta, 2)} · ${brl(valorFalta)}` : 'Chegou certo'}
                                </Typography>
                              </Box>
                              {!it.id_insumo ? (
                                <Typography sx={{ fontSize: 11.5, color: '#8A5418', mt: 0.5 }}>
                                  Sem insumo no cadastro. Foi conferido, mas não entrou no estoque.
                                </Typography>
                              ) : null}
                              {it.divergencia_obs ? (
                                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.5, fontStyle: 'italic' }}>{it.divergencia_obs}</Typography>
                              ) : null}
                            </Box>
                          );
                        })}
                        {!linhas.length ? (
                          <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 1.75, py: 2, textAlign: 'center' }}>Nota sem itens no XML.</Typography>
                        ) : null}
                      </Box>
                    </Box>
                  </>
                )}
              </Box>
              {n.tem_xml || (conferida && podeDevolverNf) ? (
                <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid var(--ga-border)', bgcolor: 'var(--ga-surface)', display: 'flex', justifyContent: 'flex-end', gap: 1, flexShrink: 0 }}>
                  {conferida && podeDevolverNf ? (
                    <Button
                      variant="outlined"
                      disabled={reabrindoNf}
                      sx={finBtnOutlinedSx}
                      onClick={() => setDevolverNf({ id: n.id_nfe, numero: String(n.numero || n.id_nfe) })}
                    >
                      Devolver à conferência
                    </Button>
                  ) : null}
                  {n.tem_xml ? (
                  <Button
                    variant="outlined"
                    startIcon={<PictureAsPdfOutlinedIcon />}
                    sx={finBtnOutlinedSx}
                    onClick={() => {
                      api
                        .estoqueNfeDanfePdf(n.id_nfe)
                        .then((blob) => window.open(URL.createObjectURL(blob), '_blank'))
                        .catch((e) => showToast(e instanceof Error ? e.message : 'Erro ao abrir DANFE', 'error'));
                    }}
                  >
                    Abrir DANFE
                  </Button>
                  ) : null}
                </Box>
              ) : null}
            </Box>
          );
        })()}
      </Drawer>

      <Dialog
        open={Boolean(devolverNf)}
        onClose={() => !reabrindoNf && setDevolverNf(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitleWithIcon plainIcon divider icon={<ReplayOutlinedIcon />}>
          Devolver à conferência
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
          <Typography variant="body2" color="text.secondary">
            A NF <strong>{devolverNf?.numero}</strong> volta para a fila. As marcas de “não chegou”
            saem e o gestor confere de novo, item a item.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDevolverNf(null)} disabled={reabrindoNf}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disableElevation
            disabled={reabrindoNf || !devolverNf}
            onClick={() => {
              if (!devolverNf) return;
              const id = devolverNf.id;
              setReabrindoNf(true);
              api
                .estoqueNfeReabrirConferencia(id)
                .then(async () => {
                  showToast('NF devolvida à conferência', 'success');
                  setDevolverNf(null);
                  const detNovo = await api.estoqueNfeDetalhe(id);
                  setDetalhesNota((d) => ({ ...d, [id]: detNovo }));
                  await carregar();
                })
                .catch((e) => showToast(e instanceof Error ? e.message : 'Não deu para devolver a NF', 'error'))
                .finally(() => setReabrindoNf(false));
            }}
          >
            {reabrindoNf ? 'Devolvendo…' : 'Devolver'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(printCarrinho)} onClose={() => setPrintCarrinho(null)} maxWidth="md" fullWidth>
        <DialogContent>
          {printCarrinho ? (
            <>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>
                {printCarrinho.preenchidos
                  ? `${printCarrinho.preenchidos} caixa(s) digitadas. Pedido não enviado.`
                  : 'Nada foi digitado. O eSupri abriu no catálogo vazio.'}
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'var(--ga-text-secondary)', mb: 1.5 }}>
                {`No eSupri essa lista fecha em ${brl(
                  printCarrinho.precos.reduce((s, p) => s + (p.portal || 0) * p.caixas, 0),
                )}. Aqui ela fecha em ${brl(printCarrinho.valorLista)}. O catálogo cobra o preço de hoje. A coluna R$ daqui é a última nota.`}
                {printCarrinho.faltou ? ` Fora do catálogo: ${printCarrinho.faltouCodigos.join(', ')}.` : ''}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell align="right">Caixas</TableCell>
                    <TableCell align="right">Nota</TableCell>
                    <TableCell align="right">Catálogo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {printCarrinho.precos.map((p) => {
                    const diferente = p.portal != null && p.lista != null && Math.abs(p.portal - p.lista) > 0.009;
                    return (
                      <TableRow key={p.codigo}>
                        <TableCell sx={{ fontWeight: 700 }}>{p.codigo}</TableCell>
                        <TableCell align="right">{p.caixas}</TableCell>
                        <TableCell align="right">{p.lista == null ? '—' : brl(p.lista)}</TableCell>
                        <TableCell align="right" sx={{ color: p.portal == null ? '#B42318' : diferente ? '#B45309' : undefined, fontWeight: 700 }}>
                          {p.portal == null ? 'não vende' : brl(p.portal)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrintCarrinho(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function PainelProdutos({
  idLoja,
  insumos,
  onCountChange,
  onInsumosReload,
  onNovoInsumo,
  onEditarInsumo,
}: {
  idLoja: number;
  insumos: ProdutoEstoque[];
  onCountChange?: (n: number) => void;
  onInsumosReload?: () => void;
  onNovoInsumo?: () => void;
  onEditarInsumo?: (insumo: ProdutoEstoque) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<ProdutoVendaEstoque[]>([]);
  const [busca, setBusca] = useState('');
  /** Produtos = venda+ficha | Insumos = o que se conta no estoque físico */
  const [abaCadastro, setAbaCadastro] = useState<'produtos' | 'insumos'>('produtos');
  const [filtroInsumo, setFiltroInsumo] = useState<'todos' | 'com' | 'sem' | 'unitario'>('todos');
  /** Filtro da aba Insumos: custo automático (nf/catalogo/manual com valor). */
  const [filtroCusto, setFiltroCusto] = useState<'todos' | 'nf' | 'catalogo' | 'manual' | 'sem'>('todos');
  const [promovendo, setPromovendo] = useState(false);
  const [open, setOpen] = useState(false);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [excluirAlvo, setExcluirAlvo] = useState<ProdutoVendaEstoque | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [pickerBusca, setPickerBusca] = useState('');
  const [pickerSelecionados, setPickerSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  /** true = precisa ficha; false = unitário (Coca, brinquedo…) */
  const [requerFicha, setRequerFicha] = useState(true);
  const [idFicha, setIdFicha] = useState<number | null>(null);
  const [valorVenda, setValorVenda] = useState<number | null>(null);
  type ItemFichaForm = {
    codigo_insumo: string;
    quantidade: string;
    unidade_receita: string;
  };
  const itemVazio = (): ItemFichaForm => ({
    codigo_insumo: '',
    quantidade: '1',
    unidade_receita: 'und',
  });
  const [itens, setItens] = useState<ItemFichaForm[]>([itemVazio()]);

  const nomeInsumo = (codigoInsumo: string) => {
    const p = insumos.find((i) => i.codigo.toUpperCase() === codigoInsumo.toUpperCase());
    return p?.descricao || codigoInsumo;
  };

  const custoItemForm = (i: ItemFichaForm) => {
    if (!i.codigo_insumo.trim()) return 0;
    const qtd = Number(String(i.quantidade).replace(',', '.')) || 0;
    const insumo = insumos.find((x) => x.codigo.toUpperCase() === i.codigo_insumo.trim().toUpperCase());
    return custoLinhaReceita(qtd, i.unidade_receita || 'und', insumo);
  };

  const rotuloUnidade = (u: string) =>
    UNIDADES_RECEITA.find((x) => x.value === (u || 'und').toLowerCase())?.label || u || 'Und';

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const pv = await api.estoqueProdutosVenda({ id_loja: idLoja });
      setLista(pv);
      onCountChange?.(pv.length);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar produtos', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja, onCountChange]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNovo = () => {
    setIdFicha(null);
    setCodigo('');
    setDescricao('');
    setAtivo(true);
    setRequerFicha(true);
    setValorVenda(null);
    setItens([itemVazio()]);
    setOpen(true);
  };

  const abrirProduto = async (p: ProdutoVendaEstoque) => {
    // Abre na hora (a API às vezes demora ~1s e parecia que "não abria")
    const fallbackItens =
      (p.insumos_ficha || []).length > 0
        ? (p.insumos_ficha || []).map((i) => ({
            codigo_insumo: i.codigo_insumo,
            quantidade: String(i.quantidade),
            unidade_receita: i.unidade_receita || 'und',
          }))
        : [itemVazio()];

    setCodigo(p.codigo);
    setDescricao(p.descricao || '');
    setAtivo(p.ativo !== false);
    setRequerFicha(p.requer_ficha !== false);
    setIdFicha(p.id_ficha != null ? Number(p.id_ficha) : null);
    setValorVenda(p.valor_venda != null ? Number(p.valor_venda) : null);
    setItens(fallbackItens);
    setOpen(true);

    if (p.requer_ficha === false || !p.id_ficha) return;

    setCarregandoFicha(true);
    try {
      const det: FichaTecnicaDetalhe = await api.estoqueFicha(Number(p.id_ficha));
      setDescricao(det.descricao || p.descricao || '');
      setIdFicha(det.id_ficha);
      setItens(
        det.itens?.length
          ? det.itens.map((i) => ({
              codigo_insumo: i.codigo_insumo,
              quantidade: String(i.quantidade),
              unidade_receita: i.unidade_receita || 'und',
            }))
          : fallbackItens,
      );
    } catch (e) {
      showToast(
        e instanceof Error
          ? `${e.message} — mostrando composição da lista`
          : 'Não deu pra recarregar a ficha; mostrando o que já estava na lista',
        'warning',
      );
    } finally {
      setCarregandoFicha(false);
    }
  };

  const pedirExcluirProduto = (p: ProdutoVendaEstoque) => {
    setExcluirAlvo(p);
  };

  const confirmarExcluirProduto = async () => {
    if (!excluirAlvo) return;
    const id = excluirAlvo.id_produto ?? excluirAlvo.id_produto_venda;
    if (!id) {
      showToast('Produto inválido', 'error');
      return;
    }
    setExcluindo(true);
    try {
      await api.estoqueExcluirProdutoVenda(id);
      showToast('Produto excluído', 'success');
      setExcluirAlvo(null);
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir produto', 'error');
    } finally {
      setExcluindo(false);
    }
  };

  const ajustarQtdItem = (idx: number, delta: number) => {
    setItens((prev) => {
      const next = [...prev];
      const atual = Number(String(next[idx]?.quantidade ?? '0').replace(',', '.'));
      const base = Number.isFinite(atual) ? atual : 0;
      const prox = Math.max(0, Math.round((base + delta) * 1000) / 1000);
      next[idx] = { ...next[idx], quantidade: String(prox) };
      return next;
    });
  };

  const abrirPickerInsumos = () => {
    const ja = new Set(
      itens.map((i) => i.codigo_insumo.trim().toUpperCase()).filter(Boolean),
    );
    setPickerSelecionados(ja);
    setPickerBusca('');
    setOpenPicker(true);
  };

  const confirmarPickerInsumos = () => {
    const existentes = new Map(
      itens
        .filter((i) => i.codigo_insumo.trim())
        .map((i) => [i.codigo_insumo.trim().toUpperCase(), i]),
    );
    const next: ItemFichaForm[] = [];
    for (const cod of pickerSelecionados) {
      const prev = existentes.get(cod);
      if (prev) {
        next.push(prev);
      } else {
        const ins = insumos.find((x) => x.codigo.toUpperCase() === cod.toUpperCase());
        next.push({
          codigo_insumo: cod,
          quantidade: '1',
          unidade_receita: unidadeReceitaPadrao(ins),
        });
      }
    }
    setItens(next.length ? next : [itemVazio()]);
    setOpenPicker(false);
  };

  const insumosPicker = insumos
    .filter((i) => i.ativo !== false)
    .filter((i) => {
      const q = pickerBusca.trim().toLowerCase();
      if (!q) return true;
      return (
        i.codigo.toLowerCase().includes(q) || (i.descricao || '').toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => (a.descricao || a.codigo).localeCompare(b.descricao || b.codigo, 'pt-BR'));

  const salvar = async () => {
    const mapped = itens
      .map((i) => ({
        codigo_insumo: i.codigo_insumo.trim().toUpperCase(),
        quantidade: Number(String(i.quantidade).replace(',', '.')),
        unidade_receita: (i.unidade_receita || 'und').trim().toLowerCase() || 'und',
      }))
      .filter((i) => i.codigo_insumo && i.quantidade > 0);
    if (!codigo.trim()) {
      showToast('Informe o código do produto', 'error');
      return;
    }
    if (requerFicha && !mapped.length) {
      showToast('Informe ao menos um insumo deste produto', 'error');
      return;
    }
    setSalvando(true);
    try {
      await api.estoqueSalvarFicha({
        id_loja: idLoja,
        codigo: codigo.trim(),
        descricao: descricao.trim(),
        ativo,
        requer_ficha: requerFicha,
        itens: requerFicha ? mapped : [],
      });
      showToast(
        requerFicha
          ? idFicha
            ? 'Produto atualizado'
            : 'Produto cadastrado com insumos'
          : 'Produto unitário salvo (sem ficha)',
        'success',
      );
      setOpen(false);
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar produto', 'error');
    } finally {
      setSalvando(false);
    }
  };

  if (loading && !lista.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const isUnitario = (p: ProdutoVendaEstoque) => p.requer_ficha === false;
  const temFicha = (p: ProdutoVendaEstoque) => !isUnitario(p) && !!p.id_ficha && (p.itens_ficha ?? 0) > 0;
  const faltaFicha = (p: ProdutoVendaEstoque) => !isUnitario(p) && !temFicha(p);
  const semInsumos = lista.filter(faltaFicha).length;
  const qBusca = busca.trim().toLowerCase();
  const listaFiltrada = lista.filter((p) => {
    if (filtroInsumo === 'com' && !temFicha(p)) return false;
    if (filtroInsumo === 'sem' && !faltaFicha(p)) return false;
    if (filtroInsumo === 'unitario' && !isUnitario(p)) return false;
    if (!qBusca) return true;
    return (
      p.codigo.toLowerCase().includes(qBusca) ||
      (p.descricao || '').toLowerCase().includes(qBusca)
    );
  });
  const temCustoAutomatico = (i: ProdutoEstoque) => {
    const fonte = String(i.custo_fonte || '').toLowerCase();
    return (
      (fonte === 'nf' || fonte === 'catalogo' || fonte === 'manual') &&
      Number(i.valor_unidade) > 0
    );
  };
  const rotuloFonte = (fonte?: string | null) => {
    const f = String(fonte || '').toLowerCase();
    if (f === 'nf') return 'NF';
    if (f === 'catalogo') return 'Catálogo';
    if (f === 'manual') return 'Manual';
    return '—';
  };
  const semCustoCount = insumos.filter((i) => i.ativo !== false && !temCustoAutomatico(i)).length;
  const qtdFonte = (fonte: string) =>
    insumos.filter(
      (i) => i.ativo !== false && temCustoAutomatico(i) && String(i.custo_fonte || '').toLowerCase() === fonte,
    ).length;

  const insumosFiltrados = insumos
    .filter((i) => i.ativo !== false)
    .filter((i) => {
      if (!qBusca) return true;
      return (
        i.codigo.toLowerCase().includes(qBusca) ||
        (i.descricao || '').toLowerCase().includes(qBusca)
      );
    })
    .filter((i) => {
      const fonte = String(i.custo_fonte || '').toLowerCase();
      if (filtroCusto === 'sem') return !temCustoAutomatico(i);
      if (filtroCusto === 'nf') return fonte === 'nf' && temCustoAutomatico(i);
      if (filtroCusto === 'catalogo') return fonte === 'catalogo' && temCustoAutomatico(i);
      if (filtroCusto === 'manual') return fonte === 'manual' && temCustoAutomatico(i);
      return true;
    });

  const qtdInsumos = insumos.filter((i) => i.ativo !== false).length;
  const modosCadastro = [
    { id: 'produtos', label: 'Produtos', qtd: lista.length, ativo: abaCadastro === 'produtos', onClick: () => setAbaCadastro('produtos') },
    { id: 'insumos', label: 'Insumos', qtd: qtdInsumos, ativo: abaCadastro === 'insumos', onClick: () => setAbaCadastro('insumos') },
  ];
  const filtrosCadastro = abaCadastro === 'produtos'
    ? [
        { id: 'com', label: 'Com ficha', qtd: lista.filter(temFicha).length, ativo: filtroInsumo === 'com', onClick: () => setFiltroInsumo(filtroInsumo === 'com' ? 'todos' : 'com') },
        { id: 'sem', label: 'Falta ficha', qtd: semInsumos, ativo: filtroInsumo === 'sem', onClick: () => setFiltroInsumo(filtroInsumo === 'sem' ? 'todos' : 'sem') },
        { id: 'unitario', label: 'Unitário', qtd: lista.filter(isUnitario).length, ativo: filtroInsumo === 'unitario', onClick: () => setFiltroInsumo(filtroInsumo === 'unitario' ? 'todos' : 'unitario') },
      ]
    : [
        { id: 'nf', label: 'Nota', qtd: qtdFonte('nf'), ativo: filtroCusto === 'nf', onClick: () => setFiltroCusto(filtroCusto === 'nf' ? 'todos' : 'nf') },
        { id: 'catalogo', label: 'Catálogo', qtd: qtdFonte('catalogo'), ativo: filtroCusto === 'catalogo', onClick: () => setFiltroCusto(filtroCusto === 'catalogo' ? 'todos' : 'catalogo') },
        { id: 'manual', label: 'Manual', qtd: qtdFonte('manual'), ativo: filtroCusto === 'manual', onClick: () => setFiltroCusto(filtroCusto === 'manual' ? 'todos' : 'manual') },
        { id: 'sem', label: 'Sem custo', qtd: semCustoCount, ativo: filtroCusto === 'sem', onClick: () => setFiltroCusto(filtroCusto === 'sem' ? 'todos' : 'sem') },
      ];
  const selectFiltro = (
    <SeletorFiltro
      valor={abaCadastro === 'produtos' ? filtroInsumo : filtroCusto}
      onChange={(v) => {
        if (abaCadastro === 'produtos') setFiltroInsumo(v as typeof filtroInsumo);
        else setFiltroCusto(v as typeof filtroCusto);
      }}
      opcoes={[
        { id: 'todos', label: 'Todos', qtd: abaCadastro === 'produtos' ? lista.length : qtdInsumos },
        ...filtrosCadastro.map((f) => ({ id: f.id, label: f.label, qtd: f.qtd })),
      ]}
    />
  );
  const qtdComFicha = lista.filter((p) => temFicha(p) || isUnitario(p)).length;
  const qtdComCusto = qtdInsumos - semCustoCount;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1, minHeight: 0 }}>
      <PainelIndicadores
        itens={[
          {
            rotulo: 'Produtos',
            valor: lista.length,
            sub: lista.length ? `${Math.round((qtdComFicha / lista.length) * 100)}% com ficha ou unitário` : 'nenhum produto',
            barra: lista.length ? qtdComFicha / lista.length : null,
            corBarra: semInsumos ? corEstoque.laranja : corEstoque.verde,
          },
          {
            rotulo: 'Falta ficha',
            valor: semInsumos,
            sub: semInsumos ? 'produto sem composição' : 'todos com ficha',
            cor: semInsumos ? corEstoque.laranja : corEstoque.verde,
          },
          { rotulo: 'Insumos', valor: qtdInsumos, sub: `${qtdComCusto} com custo válido` },
          {
            rotulo: 'Sem custo',
            valor: semCustoCount,
            sub: semCustoCount ? 'fora do CMV em R$' : 'todos com custo',
            cor: semCustoCount ? corEstoque.vermelho : corEstoque.verde,
          },
        ]}
      />
      {abaCadastro === 'insumos' ? (
        <Paper variant="outlined" sx={{ ...tablePaperSx, ...cartaoSx }}>
          <Box sx={{ display: 'flex', px: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            {modosCadastro.map((m) => (
              <Box
                key={m.id}
                component="button"
                type="button"
                onClick={m.onClick}
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 0.75,
                  px: 1.5,
                  py: 1.1,
                  border: 0,
                  borderBottom: '2px solid',
                  borderBottomColor: m.ativo ? '#1B6EF3' : 'transparent',
                  mb: '-1px',
                  bgcolor: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <Typography component="span" sx={{ fontSize: 13, fontWeight: m.ativo ? 650 : 550, color: m.ativo ? 'text.primary' : 'text.secondary' }}>{m.label}</Typography>
                <Typography component="span" sx={{ fontSize: 12, fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: m.ativo ? '#1B6EF3' : 'text.secondary' }}>{m.qtd}</Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 44, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1 }} />
            {selectFiltro}
            <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar insumo" />
            <Tooltip title="Atualizar">
              <IconButton
                size="small"
                onClick={() => void carregar()}
                aria-label="Atualizar"
                sx={{ border: '1px solid var(--ga-border)', borderRadius: '8px', width: 32, height: 32 }}
              >
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            {semCustoCount > 0 && (
              <Button
                size="small"
                variant="outlined"
                disabled={promovendo}
                onClick={() => {
                  void (async () => {
                    if (
                      !window.confirm(
                        `Usar o preço da planilha como custo válido no CMV para ${semCustoCount} insumo(s)?\n\nNão altera o valor — só marca como Manual. Itens com preço zero ficam de fora.`,
                      )
                    ) {
                      return;
                    }
                    setPromovendo(true);
                    try {
                      const r = await api.estoquePromoverPlanilha({ id_loja: idLoja });
                      showToast(
                        r.ainda_sem_preco.length
                          ? `${r.promovidos} promovido(s). ${r.ainda_sem_preco.length} ainda sem preço (zerados).`
                          : `${r.promovidos} preço(s) da planilha liberados no CMV.`,
                        r.ainda_sem_preco.length ? 'warning' : 'success',
                      );
                      setFiltroCusto('todos');
                      onInsumosReload?.();
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : 'Erro ao promover preços', 'error');
                    } finally {
                      setPromovendo(false);
                    }
                  })();
                }}
                sx={{ height: 32 }}
              >
                {promovendo ? 'Aplicando…' : 'Preço da planilha'}
              </Button>
            )}
            {onNovoInsumo ? (
              <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => onNovoInsumo()} sx={{ height: 32 }}>
                Novo insumo
              </Button>
            ) : null}
          </Box>
          <TableContainer sx={tableContainerSx}>
            <Table size="small" stickyHeader sx={{ ...tableSx, ...linhasTabelaSx }}>
              <TableHead sx={cabecaTabelaSx}>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Descrição (insumo)</TableCell>
                  <TableCell align="center">Saldo</TableCell>
                  <TableCell align="center">Fracionada</TableCell>
                  <TableCell align="center">Fonte</TableCell>
                  <TableCell align="right">R$/und</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {insumosFiltrados.map((i) => {
                  const okCusto = temCustoAutomatico(i);
                  return (
                    <TableRow
                      key={i.id_insumo ?? i.id_produto}
                      hover
                      onClick={onEditarInsumo ? () => onEditarInsumo(i) : undefined}
                      sx={onEditarInsumo ? { cursor: 'pointer' } : undefined}
                    >
                      <TableCell sx={{ fontWeight: 700 }}>{i.codigo}</TableCell>
                      <TableCell>{i.descricao}</TableCell>
                      <TableCell align="center">
                        {String(i.unidade_contagem || 'UND').toUpperCase()}
                      </TableCell>
                      <TableCell align="center">
                        {String(i.unidade_fracionada || i.unidade_contagem || 'UND').toUpperCase()}
                      </TableCell>
                      <TableCell align="center">
                        <Selo
                          label={okCusto ? rotuloFonte(i.custo_fonte) : 'Sem custo'}
                          cor={
                            !okCusto
                              ? corEstoque.vermelho
                              : i.custo_fonte === 'manual'
                                ? corEstoque.cinza
                                : i.custo_fonte === 'catalogo'
                                  ? corEstoque.roxo
                                  : corEstoque.verde
                          }
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {okCusto
                          ? fmtMoeda(i.valor_unidade)
                          : Number(i.valor_unidade) > 0
                            ? `${fmtMoeda(i.valor_unidade)}*`
                            : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!insumosFiltrados.length && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                        {filtroCusto === 'sem'
                          ? 'Nenhum insumo sem custo nesta loja.'
                          : filtroCusto === 'nf'
                            ? 'Nenhum insumo com custo vindo de nota.'
                            : filtroCusto === 'catalogo'
                              ? 'Nenhum insumo com custo do catálogo.'
                              : filtroCusto === 'manual'
                                ? 'Nenhum insumo com custo manual.'
                                : 'Nenhum insumo nesta loja. A conferência usa esta lista para contar.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {filtroCusto === 'todos' && semCustoCount > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1 }}>
              * Preço da planilha sem fonte automática (NF/catálogo/manual) — o CMV em R$ ignora esses
              valores.
            </Typography>
          )}
        </Paper>
      ) : (
      <Paper variant="outlined" sx={{ ...tablePaperSx, ...cartaoSx }}>
        <Box sx={{ display: 'flex', px: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          {modosCadastro.map((m) => (
            <Box
              key={m.id}
              component="button"
              type="button"
              onClick={m.onClick}
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 0.75,
                px: 1.5,
                py: 1.1,
                border: 0,
                borderBottom: '2px solid',
                borderBottomColor: m.ativo ? '#1B6EF3' : 'transparent',
                mb: '-1px',
                bgcolor: 'transparent',
                color: 'inherit',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              <Typography component="span" sx={{ fontSize: 13, fontWeight: m.ativo ? 650 : 550, color: m.ativo ? 'text.primary' : 'text.secondary' }}>{m.label}</Typography>
              <Typography component="span" sx={{ fontSize: 12, fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: m.ativo ? '#1B6EF3' : 'text.secondary' }}>{m.qtd}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 44, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1 }} />
          {selectFiltro}
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar produto" />
          <Tooltip title="Atualizar">
            <IconButton
              size="small"
              onClick={() => void carregar()}
              aria-label="Atualizar"
              sx={{ border: '1px solid var(--ga-border)', borderRadius: '8px', width: 32, height: 32 }}
            >
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Button variant="contained" disableElevation startIcon={<AddIcon />} onClick={() => abrirNovo()} sx={{ height: 32 }}>
            Novo produto
          </Button>
        </Box>
        <TableContainer sx={tableContainerSx}>
          <Table
            size="small"
            stickyHeader
            sx={{
              ...tableSx,
              ...linhasTabelaSx,
              tableLayout: 'fixed',
              '& th, & td': { verticalAlign: 'middle' },
            }}
          >
            <TableHead sx={cabecaTabelaSx}>
              <TableRow>
                <TableCell sx={{ width: '12%' }}>Código</TableCell>
                <TableCell sx={{ width: '36%' }}>Produto</TableCell>
                <TableCell align="center" sx={{ width: '14%' }}>
                  Composição
                </TableCell>
                <TableCell align="right" sx={{ width: '14%' }}>
                  Valor venda
                </TableCell>
                <TableCell align="center" sx={{ width: '12%' }}>
                  Status
                </TableCell>
                <TableCell align="right" sx={{ width: '12%' }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {listaFiltrada.map((p) => {
                const unitario = isUnitario(p);
                const comFicha = temFicha(p);
                const produtoAtivo = p.ativo !== false;
                return (
                  <TableRow
                    key={p.id_produto ?? p.id_produto_venda ?? p.codigo}
                    hover
                    sx={{ cursor: 'pointer', opacity: produtoAtivo ? 1 : 0.65 }}
                    onClick={() => void abrirProduto(p)}
                  >
                    <TableCell sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {p.codigo}
                    </TableCell>
                    <TableCell
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={p.descricao || undefined}
                    >
                      {p.descricao || '—'}
                    </TableCell>
                    <TableCell align="center">
                      {unitario ? (
                        <Selo label="Unitário" cor={corEstoque.azul} />
                      ) : comFicha ? (
                        <Tooltip
                          arrow
                          placement="left"
                          enterDelay={200}
                          title={
                            <Box sx={{ py: 0.5, maxWidth: 280 }}>
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}
                              >
                                Insumos deste produto
                              </Typography>
                              {(p.insumos_ficha || []).length ? (
                                (p.insumos_ficha || []).map((i) => (
                                  <Typography
                                    key={i.codigo_insumo}
                                    variant="caption"
                                    component="div"
                                    sx={{ lineHeight: 1.55 }}
                                  >
                                    {Number(i.quantidade).toLocaleString('pt-BR', {
                                      maximumFractionDigits: 3,
                                    })}
                                    {i.unidade_receita
                                      ? ` ${
                                          UNIDADES_RECEITA.find(
                                            (u) =>
                                              u.value ===
                                              String(i.unidade_receita).toLowerCase(),
                                          )?.label || i.unidade_receita
                                        }`
                                      : ''}{' '}
                                    × {nomeInsumo(i.codigo_insumo)}
                                  </Typography>
                                ))
                              ) : (
                                <Typography variant="caption">Sem itens na composição</Typography>
                              )}
                            </Box>
                          }
                        >
                          <Box component="span" sx={{ cursor: 'help' }}>
                            <Selo
                              label={`${p.itens_ficha ?? 0} iten${p.itens_ficha !== 1 ? 's' : ''}`}
                              cor={corEstoque.verde}
                            />
                          </Box>
                        </Tooltip>
                      ) : (
                        <Selo label="Falta ficha" cor={corEstoque.laranja} />
                      )}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                    >
                      {fmtMoeda(p.valor_venda ?? 0)}
                    </TableCell>
                    <TableCell align="center">
                      <Selo
                        label={produtoAtivo ? 'Ativo' : 'Inativo'}
                        cor={produtoAtivo ? corEstoque.verde : corEstoque.cinza}
                      />
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => void abrirProduto(p)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir produto">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => pedirExcluirProduto(p)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!listaFiltrada.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                      {filtroInsumo === 'sem'
                        ? 'Nenhum produto sem ficha nesta loja.'
                        : 'Nenhum produto listado. Cadastre um novo ou importe vendas para surgir o código BK.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      )}

      <Drawer
        anchor="right"
        open={open}
        onClose={() => !carregandoFicha && setOpen(false)}
        disableScrollLock
        disableAutoFocus
        disableRestoreFocus
        ModalProps={drawerSemTranco}
        slotProps={{ paper: { sx: { ...papelDrawerSx, width: 520 } } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CabecalhoDrawer
            titulo={`${idFicha ? 'Ficha do produto' : 'Novo produto'}${carregandoFicha ? ' …' : ''}`}
            icone={<MenuBookOutlinedIcon sx={{ fontSize: 22 }} />}
            onClose={() => !carregandoFicha && setOpen(false)}
          />
          <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {carregandoFicha && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CircularProgress size={18} />
              <Typography variant="caption" color="text.secondary">
                Carregando composição…
              </Typography>
            </Box>
          )}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              alignItems: 'flex-start',
              flexWrap: { xs: 'wrap', sm: 'nowrap' },
            }}
          >
            <TextField
              {...dialogFieldProps}
              size="small"
              fullWidth={false}
              label="Código BK"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              disabled={!!idFicha}
              sx={{ width: 128, flexShrink: 0 }}
            />
            <TextField
              {...dialogFieldProps}
              size="small"
              label="Nome"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: WHOPPER"
              sx={{ flex: 1, minWidth: 0 }}
            />
          </Box>
          <TextField
            {...dialogFieldProps}
            size="small"
            label="Valor de venda"
            value={valorVenda != null && valorVenda > 0 ? fmtMoeda(valorVenda) : '—'}
            slotProps={{
              ...dialogFieldProps.slotProps,
              input: { readOnly: true },
            }}
          />
          <Typography sx={{ fontSize: 12, lineHeight: 1.4, color: 'text.secondary', mt: -0.5 }}>
            Preço de venda do cardápio. O custo dos insumos só entra depois da nota fiscal.
          </Typography>
          <FormControlLabel
            sx={{ mt: 0.5, alignItems: 'flex-start', ml: 0 }}
            control={
              <Switch
                checked={!requerFicha}
                onChange={(_, checked) => setRequerFicha(!checked)}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Produto unitário (sem ficha técnica)
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Ex.: lata de refrigerante, brinquedo, sachet. Venda baixa 1:1 o insumo de mesmo
                  código (se existir).
                </Typography>
              </Box>
            }
          />
          {requerFicha ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 650 }}>Insumos da receita</Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ChecklistRtlIcon />}
                onClick={abrirPickerInsumos}
                sx={{ flexShrink: 0 }}
              >
                Escolher da lista
              </Button>
            </Box>
            <Typography sx={{ fontSize: 12, lineHeight: 1.4, color: 'text.secondary' }}>
              Quanto entra em uma unidade vendida. O custo usa a unidade de compra.
            </Typography>
          </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Este produto não usa composição. Cadastre o insumo com o mesmo código se quiser
              controlar o estoque físico (ex.: lata de Coca).
            </Typography>
          )}
          {requerFicha && (
          <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {itens.map((it, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                  pb: 1.25,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <EstoqueInsumoAutocomplete
                  produtos={insumos}
                  value={it.codigo_insumo}
                  onChange={(cod) => {
                    const next = [...itens];
                    const prevCod = next[idx].codigo_insumo.trim().toUpperCase();
                    const novoCod = String(cod || '').trim().toUpperCase();
                    const ins = insumos.find((x) => x.codigo.toUpperCase() === novoCod);
                    next[idx] = {
                      ...next[idx],
                      codigo_insumo: cod,
                      unidade_receita:
                        !prevCod || prevCod !== novoCod
                          ? unidadeReceitaPadrao(ins)
                          : next[idx].unidade_receita || unidadeReceitaPadrao(ins),
                    };
                    setItens(next);
                  }}
                  sx={{ width: '100%', '& .MuiOutlinedInput-root': { height: 40, minHeight: 40 } }}
                />
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  {...dialogFieldProps}
                  size="small"
                  label="Qtd"
                  value={it.quantidade}
                  onChange={(e) => {
                    const next = [...itens];
                    next[idx] = { ...next[idx], quantidade: e.target.value };
                    setItens(next);
                  }}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    '& .MuiOutlinedInput-root': { height: 40, minHeight: 40, px: 0.35 },
                    '& .MuiOutlinedInput-input': {
                      textAlign: 'center',
                      px: 0,
                      fontSize: '0.8rem',
                    },
                    '& .MuiInputAdornment-root': { mx: 0 },
                  }}
                  slotProps={{
                    ...dialogFieldProps.slotProps,
                    htmlInput: { style: { textAlign: 'center' } },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <IconButton
                            size="small"
                            aria-label="Diminuir quantidade"
                            disabled={Number(String(it.quantidade).replace(',', '.')) <= 0}
                            onClick={() => ajustarQtdItem(idx, -1)}
                            sx={{ p: 0.1 }}
                          >
                            <RemoveIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            aria-label="Aumentar quantidade"
                            onClick={() => ajustarQtdItem(idx, 1)}
                            sx={{ p: 0.1 }}
                          >
                            <AddIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <TextField
                  {...dialogFieldProps}
                  size="small"
                  select
                  label="Unid."
                  value={it.unidade_receita || 'und'}
                  onChange={(e) => {
                    const next = [...itens];
                    next[idx] = { ...next[idx], unidade_receita: e.target.value };
                    setItens(next);
                  }}
                  sx={{
                    width: 132,
                    flexShrink: 0,
                    '& .MuiOutlinedInput-root': { height: 40, minHeight: 40 },
                  }}
                >
                  {UNIDADES_RECEITA.map((u) => (
                    <MenuItem key={u.value} value={u.value}>
                      {u.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Tooltip
                  title={
                    it.codigo_insumo.trim()
                      ? 'Remover insumo'
                      : 'Selecione um insumo para poder remover'
                  }
                >
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="Remover insumo"
                      disabled={!it.codigo_insumo.trim()}
                      onClick={() => {
                        const next = itens.filter((_, i) => i !== idx);
                        setItens(next.length ? next : [itemVazio()]);
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                </Box>
              </Box>
            ))}
          </Box>
          {itens.some((i) => i.codigo_insumo) && (
            <Box sx={{ bgcolor: 'rgba(27,42,107,0.04)', borderRadius: 1, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                Resumo (custo da porção)
              </Typography>
              {itens
                .filter((i) => i.codigo_insumo)
                .map((i, idx) => {
                  const custo = custoItemForm(i);
                  return (
                    <Typography
                      key={`${i.codigo_insumo}-${idx}`}
                      variant="body2"
                      sx={{ lineHeight: 1.65, display: 'block' }}
                    >
                      <Box component="span" sx={{ color: 'text.secondary', mr: 0.75 }}>
                        •
                      </Box>
                      <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
                        {i.quantidade} {rotuloUnidade(i.unidade_receita)}
                      </Box>
                      {' × '}
                      {nomeInsumo(i.codigo_insumo)}
                      {custo > 0 ? (
                        <>
                          {' — '}
                          <Box component="span" sx={{ color: 'success.dark', fontWeight: 700 }}>
                            {fmtMoeda(custo)}
                          </Box>
                        </>
                      ) : i.codigo_insumo.trim() ? (
                        <Box component="span" sx={{ color: 'warning.main' }}>
                          {' — sem preço no cadastro'}
                        </Box>
                      ) : null}
                    </Typography>
                  );
                })}
            </Box>
          )}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setItens([...itens, itemVazio()])}
          >
            Adicionar insumo
          </Button>
          </>
          )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'var(--ga-surface)' }}>
          <FormControlLabel
            control={
              <Switch
                checked={ativo}
                onChange={(_, checked) => setAtivo(checked)}
                color="primary"
              />
            }
            label={ativo ? 'Ativo' : 'Inativo'}
          />
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
          <Button variant="contained" disableElevation disabled={salvando} onClick={() => void salvar()}>
            Salvar
          </Button>
          </Box>
        </Box>
      </Drawer>

      <Dialog
        open={!!excluirAlvo}
        onClose={() => !excluindo && setExcluirAlvo(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitleWithIcon plainIcon divider icon={<DeleteOutlineIcon color="error" />}>
          Excluir produto
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
          <Typography variant="body2">
            Tem certeza que deseja excluir o produto{' '}
            <strong>
              {excluirAlvo?.codigo}
              {excluirAlvo?.descricao ? ` — ${excluirAlvo.descricao}` : ''}
            </strong>
            ?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setExcluirAlvo(null)} disabled={excluindo}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={excluindo}
            onClick={() => void confirmarExcluirProduto()}
          >
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openPicker}
        onClose={() => setOpenPicker(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitleWithIcon plainIcon divider icon={<ChecklistRtlIcon />}>
          Marcar insumos
        </DialogTitleWithIcon>
        <DialogContent sx={{ ...dialogContentSx, overflow: 'hidden', maxHeight: '70vh' }}>
          <TextField
            {...dialogFieldProps}
            size="small"
            label="Buscar insumo"
            value={pickerBusca}
            onChange={(e) => setPickerBusca(e.target.value)}
            autoFocus
          />
          <Typography variant="caption" color="text.secondary">
            {pickerSelecionados.size} selecionado{pickerSelecionados.size === 1 ? '' : 's'}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
              maxHeight: 360,
              overflowY: 'auto',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              px: 1,
              py: 0.5,
            }}
          >
            {insumosPicker.map((ins) => {
              const cod = ins.codigo.toUpperCase();
              const checked = pickerSelecionados.has(cod);
              return (
                <FormControlLabel
                  key={ins.id_insumo ?? ins.id_produto ?? cod}
                  sx={{
                    m: 0,
                    px: 0.5,
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                  control={
                    <Checkbox
                      size="small"
                      checked={checked}
                      onChange={(_, on) => {
                        setPickerSelecionados((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(cod);
                          else next.delete(cod);
                          return next;
                        });
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ lineHeight: 1.35 }}>
                      <Box component="span" sx={{ fontWeight: 700, mr: 1 }}>
                        {ins.codigo}
                      </Box>
                      {ins.descricao || '—'}
                    </Typography>
                  }
                />
              );
            })}
            {!insumosPicker.length && (
              <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                Nenhum insumo encontrado.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setOpenPicker(false)}>Cancelar</Button>
          <Button variant="contained" onClick={confirmarPickerInsumos}>
            Adicionar selecionados
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function labelTipoBreak(tipo?: string | null) {
  if (tipo === 'desperdicio_completo') return 'Desperdício completo';
  if (tipo === 'desperdicio_incompleto') return 'Desperdício incompleto';
  if (tipo === 'emprestimo') return 'Empréstimo';
  return 'Break';
}

function labelTurnoBreak(turno?: string | null) {
  if (turno === 'manha') return 'Manhã';
  if (turno === 'tarde') return 'Tarde';
  if (turno === 'noite') return 'Noite';
  return '—';
}

function tituloItemBreak(raw?: string | null) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const siglas = new Set(['bbq', 'bk', 'kg', 'cx', 'und', 'pct']);
  return s
    .toLowerCase()
    .replace(/\b([a-z0-9][a-z0-9']*)/g, (word) => {
      if (siglas.has(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
}

function produtoEmprestimo(raw?: string | null) {
  const base = nomeProdutoBreak(raw);
  return base
    .replace(/\s*[-–]\s*cx\b.*$/i, '')
    .replace(/\s+cx\b.*$/i, '')
    .replace(/,\s*$/, '')
    .trim();
}

function nomeProdutoBreak(raw?: string | null, curto = false) {
  const titled = tituloItemBreak(raw);
  if (!titled) return '';
  const limpo = titled
    .replace(/\b(Estado Natural|Refricon)\b/gi, '')
    .replace(/\bCx\s*\d+\w*/gi, '')
    .replace(/\b\d+[kK][gG]\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const base = limpo || titled;
  if (!curto) return base;
  return base.split(' ').slice(0, 4).join(' ');
}

function corTipoBreak(tipo?: string | null) {
  if (String(tipo || '').startsWith('desperdicio')) return '#C4452D';
  if (tipo === 'emprestimo') return '#C47A2A';
  return '#E8520A';
}

function tipoCurtoBreak(tipo?: string | null) {
  if (String(tipo || '').startsWith('desperdicio')) return 'Desperdício';
  if (tipo === 'emprestimo') return 'Empréstimo';
  return 'Break';
}

function nomeLinhaBreak(b: EstoqueBreakResumo) {
  if (b.tipo === 'emprestimo') {
    const loja = b.loja_destino_nome
      ? `${b.loja_destino_bk ? `${b.loja_destino_bk} · ` : ''}${b.loja_destino_nome}`
      : 'Outra loja';
    if (b.recebimento_status === 'pendente') return `${loja} · aguardando`;
    if (b.recebimento_status === 'recebido') return `${loja} · recebido`;
    if (b.recebimento_status === 'devolvido') return `${loja} · devolvido`;
    return loja;
  }
  if (b.colaborador_nome) return b.colaborador_nome.trim();
  return nomeProdutoBreak(b.primeiro_item, true) || 'Lançamento';
}

function resumoItemBreak(b: EstoqueBreakResumo) {
  const produto = nomeProdutoBreak(b.primeiro_item, true);
  const extra = b.itens && b.itens > 1 ? ` +${b.itens - 1}` : '';
  if (String(b.tipo || '').startsWith('desperdicio')) {
    return [produto, b.motivo].filter(Boolean).join(' · ') || 'Desperdício';
  }
  return produto ? `${produto}${extra}` : extra.trim() || '—';
}

function fmtQtdItemBreak(it: {
  quantidade?: number | null;
  contagem_caixa?: number | null;
  contagem_pc_fd?: number | null;
  contagem_kg_und?: number | null;
  unidade?: string | null;
}) {
  const partes = [
    it.contagem_caixa != null ? `${fmtNum(it.contagem_caixa, 0)} cx` : null,
    it.contagem_pc_fd != null ? `${fmtNum(it.contagem_pc_fd, 0)} pct` : null,
    it.contagem_kg_und != null ? `${fmtNum(it.contagem_kg_und)} ${it.unidade || 'kg'}` : null,
  ].filter(Boolean);
  if (partes.length) return partes.join(' · ');
  if (it.quantidade != null) {
    const n = Number(it.quantidade);
    const q =
      Number.isFinite(n) && Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : fmtNum(n);
    return q;
  }
  return '—';
}

function rotuloDiaBreak(iso: string | null | undefined, longo = false) {
  const s = String(iso || '').slice(0, 10);
  if (!s) return '—';
  const hoje = hojeISO();
  const ontemDate = new Date(`${hoje}T12:00:00`);
  ontemDate.setDate(ontemDate.getDate() - 1);
  const ontem = ontemDate.toISOString().slice(0, 10);
  if (s === hoje) return 'Hoje';
  if (s === ontem) return 'Ontem';
  try {
    const txt = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: 'numeric',
      month: longo ? 'long' : 'short',
    }).format(new Date(`${s}T12:00:00`));
    return txt.replace('.', '');
  } catch {
    const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}` : s;
  }
}

function LinhaEmprestimoPendente({
  emp,
  modo,
  busy,
  onConfirm,
}: {
  emp: EstoqueEmprestimoAReceber;
  modo: 'receber' | 'devolver';
  busy: boolean;
  onConfirm: () => void;
}) {
  const item = (emp.itens || [])[0];
  const qtd = item ? fmtQtdItemBreak(item) : '';
  const nome = item ? produtoEmprestimo(item.descricao) || item.codigo || 'Empréstimo' : 'Empréstimo';
  const extra = (emp.itens || []).length > 1 ? ` +${(emp.itens || []).length - 1}` : '';
  const detalhe = [qtd && qtd !== '—' ? qtd : null, `${nome}${extra}`].filter(Boolean).join(' · ');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.7, borderTop: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ minWidth: 0, flex: 1, '& .ck-loja-bk': { display: 'flex', maxWidth: '100%' } }}>
        <LojaBkMarca bk={emp.loja_origem_bk} nome={emp.loja_origem_nome} size={20} />
        <Typography
          sx={{
            mt: 0.15,
            pl: '26px',
            fontSize: 12,
            lineHeight: 1.3,
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {detalhe}
        </Typography>
      </Box>
      <Button
        size="small"
        variant={modo === 'receber' ? 'contained' : 'outlined'}
        disableElevation
        disabled={busy}
        onClick={onConfirm}
        sx={{ height: 28, minWidth: 76, px: 1.25, fontSize: 12, flexShrink: 0 }}
      >
        {busy ? '…' : modo === 'receber' ? 'Recebi' : 'Devolver'}
      </Button>
    </Box>
  );
}

function PainelBreak({ idLoja }: { idLoja: number }) {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<EstoqueBreakResumo[]>([]);
  const [produtosVenda, setProdutosVenda] = useState<ProdutoVendaEstoque[]>([]);
  const [insumos, setInsumos] = useState<ProdutoEstoque[]>([]);
  const [motivos, setMotivos] = useState<Array<{ codigo: string; nome: string }>>([]);
  const [lojasDestino, setLojasDestino] = useState<Loja[]>([]);
  const [colaboradores, setColaboradores] = useState<Array<{ id_usuario: number; nome: string }>>(
    [],
  );
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dataBreak, setDataBreak] = useState(hojeISO());
  const [kind, setKind] = useState('refeicao');
  const [turno, setTurno] = useState('');
  const [motivoCodigo, setMotivoCodigo] = useState('');
  const [idLojaDestino, setIdLojaDestino] = useState<number | ''>('');
  const [colabSelect, setColabSelect] = useState('');
  const [idColaborador, setIdColaborador] = useState<number | ''>('');
  const [nomeColaborador, setNomeColaborador] = useState('');
  const [codigo, setCodigo] = useState('');
  const [qtde, setQtde] = useState('1');
  const [caixaEmp, setCaixaEmp] = useState('');
  const [pcEmp, setPcEmp] = useState('');
  const [kgEmp, setKgEmp] = useState('');
  const [aReceber, setAReceber] = useState<EstoqueEmprestimoAReceber[]>([]);
  const [aDevolver, setADevolver] = useState<EstoqueEmprestimoAReceber[]>([]);
  const [pendenciasAbertas, setPendenciasAbertas] = useState(false);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'refeicao' | 'desperdicio' | 'emprestimo'>('todos');
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<EstoqueBreakResumo | null>(null);
  const [detalhe, setDetalhe] = useState<EstoqueBreakDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const usaInsumo = kind === 'desperdicio_incompleto' || kind === 'emprestimo';
  const exigeColab = kind === 'refeicao';
  const exigeTurno = kind !== 'emprestimo';
  const exigeMotivo = kind === 'desperdicio_completo' || kind === 'desperdicio_incompleto';
  const colabDigitado = colaboradores.length === 0 || colabSelect === '__outro__';
  const insumoEmp = insumos.find(
    (p) => String(p.codigo || '').trim().toUpperCase() === codigo.trim().toUpperCase(),
  );
  const empCx = insumoEmp?.permite_contagem_caixa !== false;
  const empPc = insumoEmp?.permite_contagem_pc_fd !== false;
  const empKg = insumoEmp?.permite_contagem_kg_und !== false;
  const unidadeFisica = unidadeFisicaInsumo(insumoEmp);
  const qtdInteira = !usaInsumo || fracionadaInteira(insumoEmp?.unidade_fracionada || insumoEmp?.unidade_contagem);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [breaks, cols, cat, lojasRows, pendentes, devolver] = await Promise.all([
        api.estoqueBreaks(idLoja),
        api.estoqueBreakColaboradores(idLoja),
        api.estoqueBreakCatalogo(idLoja, 'refeicao'),
        api.estoqueLojasDestinoEmprestimo().catch(() => [] as Loja[]),
        api.estoqueEmprestimosAReceber(idLoja).catch(() => [] as EstoqueEmprestimoAReceber[]),
        api.estoqueEmprestimosADevolver(idLoja).catch(() => [] as EstoqueEmprestimoAReceber[]),
      ]);
      setLista(breaks);
      setColaboradores(cols);
      setLojasDestino(lojasRows);
      setAReceber(pendentes);
      setADevolver(devolver);
      setProdutosVenda((cat.produtos || []).filter((p) => p.ativo !== false));
      setInsumos((cat.insumos || []).filter((p) => p.ativo !== false));
      setMotivos(cat.motivos || []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar breaks', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const cat = await api.estoqueBreakCatalogo(idLoja, kind);
        setProdutosVenda((cat.produtos || []).filter((p) => p.ativo !== false));
        setInsumos((cat.insumos || []).filter((p) => p.ativo !== false));
        setMotivos(cat.motivos || []);
      } catch {
        setProdutosVenda([]);
        setInsumos([]);
        setMotivos([]);
      }
    })();
  }, [open, idLoja, kind]);

  const resetForm = () => {
    setKind('refeicao');
    setTurno('');
    setMotivoCodigo('');
    setIdLojaDestino('');
    setColabSelect('');
    setIdColaborador('');
    setNomeColaborador('');
    setCodigo('');
    setQtde('1');
    setCaixaEmp('');
    setPcEmp('');
    setKgEmp('');
    setDataBreak(hojeISO());
  };

  const ajustarQtde = (delta: number) => {
    const atual = Number(String(qtde).replace(',', '.'));
    const base = Number.isFinite(atual) ? atual : 0;
    const passo = qtdInteira ? 1 : 0.1;
    const prox = Math.max(0, Math.round((base + (delta < 0 ? -passo : passo)) * 1000) / 1000);
    setQtde(qtdInteira ? String(Math.round(prox)) : String(prox).replace('.', ','));
  };

  const lancar = async () => {
    const quantidade = Number(String(qtde).replace(',', '.'));
    const nome =
      (idColaborador
        ? colaboradores.find((c) => c.id_usuario === idColaborador)?.nome
        : null) || nomeColaborador.trim();
    if (exigeColab && !nome) {
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
    const parseCampo = (raw: string) => {
      if (!String(raw || '').trim()) return null;
      const n = Number(String(raw).replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    };
    if (kind === 'emprestimo') {
      if (!codigo.trim()) {
        showToast('Informe a mercadoria', 'error');
        return;
      }
      if (parseCampo(caixaEmp) == null && parseCampo(pcEmp) == null && parseCampo(kgEmp) == null) {
        showToast('Informe caixa, pct ou kg/und', 'error');
        return;
      }
    } else if (!codigo.trim() || !(quantidade > 0)) {
      showToast('Informe produto e quantidade', 'error');
      return;
    }
    setSalvando(true);
    try {
      const motivoNome = motivos.find((m) => m.codigo === motivoCodigo)?.nome;
      const result = await api.estoqueLancarBreak({
        id_loja: idLoja,
        data_break: dataBreak,
        tipo: kind,
        turno: turno || undefined,
        motivo: motivoNome,
        motivo_codigo: motivoCodigo || undefined,
        id_colaborador: Number(idColaborador) > 0 ? Number(idColaborador) : undefined,
        colaborador_nome: nome || undefined,
        id_loja_destino: idLojaDestino || undefined,
        itens: [
          usaInsumo
            ? kind === 'emprestimo'
              ? {
                  codigo_insumo: codigo.trim(),
                  contagem_caixa: parseCampo(caixaEmp),
                  contagem_pc_fd: parseCampo(pcEmp),
                  contagem_kg_und: parseCampo(kgEmp),
                  unidade: unidadeFisica,
                }
              : { codigo_insumo: codigo.trim(), quantidade, unidade: unidadeFisica }
            : { codigo_venda: codigo.trim(), quantidade },
        ],
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
            : `${labelTipoBreak(kind)} lançado — estoque baixado`,
          'success',
        );
      }
      setOpen(false);
      resetForm();
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao lançar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarRecebimento = async (idBreak: number) => {
    setConfirmandoId(idBreak);
    try {
      await api.estoqueConfirmarRecebimentoEmprestimo(idBreak, idLoja);
      showToast('Recebimento confirmado — saldo atualizado');
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível confirmar', 'error');
    } finally {
      setConfirmandoId(null);
    }
  };

  const confirmarDevolucao = async (idBreak: number) => {
    setConfirmandoId(idBreak);
    try {
      await api.estoqueDevolverEmprestimo(idBreak, idLoja);
      showToast('Devolução ok — saiu daqui e voltou pra loja de origem');
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Não foi possível devolver', 'error');
    } finally {
      setConfirmandoId(null);
    }
  };

  const qtdFiltro = useMemo(() => {
    const n = { todos: lista.length, refeicao: 0, desperdicio: 0, emprestimo: 0 };
    for (const b of lista) {
      if (b.tipo === 'emprestimo') n.emprestimo += 1;
      else if (String(b.tipo || '').startsWith('desperdicio')) n.desperdicio += 1;
      else n.refeicao += 1;
    }
    return n;
  }, [lista]);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrada = lista.filter((b) => {
      if (filtro === 'refeicao' && b.tipo && b.tipo !== 'refeicao') return false;
      if (filtro === 'desperdicio' && !String(b.tipo || '').startsWith('desperdicio')) return false;
      if (filtro === 'emprestimo' && b.tipo !== 'emprestimo') return false;
      if (!q) return true;
      return [b.colaborador_nome, b.primeiro_item, b.motivo, b.loja_destino_nome]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
    const mapa = new Map<string, EstoqueBreakResumo[]>();
    for (const b of filtrada) {
      const dia = String(b.data_break || '').slice(0, 10) || 'sem-data';
      const arr = mapa.get(dia) || [];
      arr.push(b);
      mapa.set(dia, arr);
    }
    return [...mapa.entries()];
  }, [lista, filtro, busca]);

  useEffect(() => {
    const flat = grupos.flatMap(([, rows]) => rows);
    setAberto((atual) => {
      if (atual && flat.some((x) => x.id_break === atual.id_break)) return atual;
      return null;
    });
  }, [grupos]);

  useEffect(() => {
    if (!aberto) {
      setDetalhe(null);
      return;
    }
    let cancel = false;
    setCarregandoDetalhe(true);
    setDetalhe(null);
    api
      .estoqueBreakDetalhe(aberto.id_break, idLoja)
      .then((d) => {
        if (!cancel) setDetalhe(d);
      })
      .catch((e) => {
        if (!cancel) showToast(e instanceof Error ? e.message : 'Não consegui abrir o lançamento', 'error');
      })
      .finally(() => {
        if (!cancel) setCarregandoDetalhe(false);
      });
    return () => {
      cancel = true;
    };
  }, [aberto?.id_break, idLoja]);

  useEffect(() => {
    if (!aReceber.length && !aDevolver.length) setPendenciasAbertas(false);
  }, [aReceber.length, aDevolver.length]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const hojeBreak = hojeISO();
  const lancadosHoje = lista.filter((b) => String(b.data_break || '').slice(0, 10) === hojeBreak).length;
  const pendentesEmp = aReceber.length + aDevolver.length;
  const noRecorteBreak = grupos.reduce((s, [, rows]) => s + rows.length, 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 1.25 }}>
      <PainelIndicadores
        itens={[
          {
            rotulo: 'Lançamentos',
            valor: qtdFiltro.todos,
            sub: lancadosHoje ? `${lancadosHoje} hoje` : 'nenhum lançamento hoje',
          },
          { rotulo: 'Break', valor: qtdFiltro.refeicao, sub: 'refeição de colaborador', cor: '#E8520A' },
          {
            rotulo: 'Desperdício',
            valor: qtdFiltro.desperdicio,
            sub: 'completo e incompleto',
            cor: qtdFiltro.desperdicio ? corEstoque.vermelho : undefined,
          },
          {
            rotulo: 'Empréstimos',
            valor: pendentesEmp,
            sub: pendentesEmp
              ? [aReceber.length ? `${aReceber.length} a receber` : null, aDevolver.length ? `${aDevolver.length} a devolver` : null]
                  .filter(Boolean)
                  .join(' · ')
              : 'nada pendente',
            cor: pendentesEmp ? corEstoque.laranja : undefined,
          },
        ]}
      />

      <Paper variant="outlined" sx={{ ...cartaoSx, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <CabecalhoCartao titulo="Lançamentos" sub={`${noRecorteBreak} ${noRecorteBreak === 1 ? 'lançamento' : 'lançamentos'}`}>
          {pendentesEmp > 0 ? (
            <Button
              variant="outlined"
              onClick={() => {
                setAberto(null);
                setDetalhe(null);
                setPendenciasAbertas(true);
              }}
              sx={{ ...finBtnOutlinedSx, color: corEstoque.laranja, borderColor: 'rgba(196, 122, 42, 0.45)' }}
            >
              {pendentesEmp} {pendentesEmp === 1 ? 'empréstimo pendente' : 'empréstimos pendentes'}
            </Button>
          ) : null}
          <SeletorFiltro
            valor={filtro}
            onChange={(v) => setFiltro(v as typeof filtro)}
            opcoes={[
              { id: 'todos', label: 'Todos', qtd: qtdFiltro.todos },
              { id: 'refeicao', label: 'Break', qtd: qtdFiltro.refeicao },
              { id: 'desperdicio', label: 'Desperdício', qtd: qtdFiltro.desperdicio },
              { id: 'emprestimo', label: 'Empréstimo', qtd: qtdFiltro.emprestimo },
            ]}
          />
          <CampoBusca valor={busca} onChange={setBusca} placeholder="Buscar colaborador ou pedido" largura={240} />
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
            sx={finBtnContainedSx}
          >
            Lançar
          </Button>
        </CabecalhoCartao>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {!grupos.length ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Nenhum lançamento neste recorte.</Typography>
            </Box>
          ) : (
            grupos.map(([dia, rows]) => (
              <Box key={dia}>
                <Box
                  sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    px: 2,
                    py: 0.75,
                    bgcolor: 'var(--ga-canvas)',
                    borderBottom: '1px solid var(--ga-border)',
                    fontSize: 11,
                    fontWeight: 650,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {rotuloDiaBreak(dia, true)}
                  <Box component="span" sx={{ ml: 1, fontWeight: 500, letterSpacing: 0, textTransform: 'none' }}>
                    {rows.length}
                  </Box>
                </Box>
                {rows.map((b) => {
                  const ativo = aberto?.id_break === b.id_break;
                  const turno = labelTurnoBreak(b.turno);
                  const cor = corTipoBreak(b.tipo);
                  return (
                    <Box
                      key={b.id_break}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setPendenciasAbertas(false);
                        setAberto(b);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPendenciasAbertas(false);
                          setAberto(b);
                        }
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 2,
                        py: 1.1,
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--ga-border)',
                        bgcolor: ativo ? 'rgba(27, 110, 243, 0.06)' : 'transparent',
                        '&:hover': { bgcolor: ativo ? 'rgba(27, 110, 243, 0.08)' : 'rgba(15, 23, 42, 0.03)' },
                      }}
                    >
                      <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 1, bgcolor: cor, flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 650 }}>
                          {nomeLinhaBreak(b)}
                        </Typography>
                        <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
                          {resumoItemBreak(b)}
                        </Typography>
                      </Box>
                      {turno !== '—' ? (
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', flexShrink: 0 }}>{turno}</Typography>
                      ) : null}
                      <Selo label={tipoCurtoBreak(b.tipo)} cor={cor} />
                      <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
                    </Box>
                  );
                })}
              </Box>
            ))
          )}
        </Box>
      </Paper>

      <Drawer
        anchor="right"
        open={pendenciasAbertas}
        onClose={() => setPendenciasAbertas(false)}
        disableScrollLock
        disableAutoFocus
        disableRestoreFocus
        slotProps={{
          paper: {
            sx: {
              width: 420,
              maxWidth: '100%',
              borderLeft: `1px solid ${colors.border}`,
              boxShadow: '-8px 0 24px rgba(15, 26, 69, 0.06)',
              bgcolor: 'var(--ga-surface)',
              backgroundImage: 'none',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, px: 2.5, pt: 2.25, pb: 2, borderBottom: `1px solid ${colors.border}` }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ga-text-primary)', lineHeight: 1.25 }}>
                Empréstimos
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, mt: 0.5 }}>
                {[
                  aReceber.length ? `${aReceber.length} a receber` : null,
                  aDevolver.length ? `${aDevolver.length} a devolver` : null,
                ].filter(Boolean).join('  ·  ')}
              </Typography>
            </Box>
            <IconButton size="small" aria-label="Fechar" onClick={() => setPendenciasAbertas(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {aReceber.length > 0 ? (
              <Paper variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, minHeight: 32 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 650, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#5C7052' }}>
                    Para receber
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{aReceber.length}</Typography>
                </Box>
                {aReceber.map((emp) => (
                  <LinhaEmprestimoPendente
                    key={emp.id_break}
                    emp={emp}
                    modo="receber"
                    busy={confirmandoId === emp.id_break}
                    onConfirm={() => void confirmarRecebimento(emp.id_break)}
                  />
                ))}
              </Paper>
            ) : null}
            {aDevolver.length > 0 ? (
              <Paper variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, minHeight: 32 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 650, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#C47A2A' }}>
                    Para devolver
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{aDevolver.length}</Typography>
                </Box>
                {aDevolver.map((emp) => (
                  <LinhaEmprestimoPendente
                    key={emp.id_break}
                    emp={emp}
                    modo="devolver"
                    busy={confirmandoId === emp.id_break}
                    onConfirm={() => void confirmarDevolucao(emp.id_break)}
                  />
                ))}
              </Paper>
            ) : null}
          </Box>
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={!!aberto}
        onClose={() => {
          setAberto(null);
          setDetalhe(null);
        }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 420 },
              borderLeft: `1px solid ${colors.border}`,
              boxShadow: '-8px 0 24px rgba(15, 26, 69, 0.06)',
            },
          },
        }}
      >
        {aberto ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, px: 2.5, pt: 2.25, pb: 2, borderBottom: `1px solid ${colors.border}` }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ga-text-primary)', lineHeight: 1.25 }}>
                  {aberto.colaborador_nome?.trim() || nomeLinhaBreak(aberto)}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: colors.textSecondary, mt: 0.5 }}>
                  {[
                    tipoCurtoBreak(aberto.tipo),
                    rotuloDiaBreak(aberto.data_break, true),
                    labelTurnoBreak(aberto.turno) !== '—' ? labelTurnoBreak(aberto.turno) : null,
                    aberto.motivo || null,
                  ]
                    .filter(Boolean)
                    .join('  ·  ')}
                </Typography>
              </Box>
              <IconButton
                size="small"
                aria-label="Fechar"
                onClick={() => {
                  setAberto(null);
                  setDetalhe(null);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
              {carregandoDetalhe ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                  <CircularProgress size={22} />
                </Box>
              ) : detalhe?.itens?.length ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pb: 0.75, borderBottom: `1px solid ${colors.border}` }}>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textMuted }}>
                      Pedido
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: colors.textMuted }}>
                      Qtd
                    </Typography>
                  </Box>
                  {(detalhe.itens as EstoqueBreakItem[]).map((it, idx) => (
                    <Box
                      key={`${it.codigo || 'item'}-${idx}`}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 2,
                        py: 1.15,
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      <Typography sx={{ fontSize: '0.9rem', color: colors.textPrimary }}>
                        {nomeProdutoBreak(it.descricao) || tituloItemBreak(it.descricao) || it.codigo || 'Item'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtQtdItemBreak(it)}
                      </Typography>
                    </Box>
                  ))}
                </>
              ) : (
                <Typography sx={{ color: colors.textMuted, fontSize: '0.8125rem' }}>
                  Este lançamento não tem item gravado.
                </Typography>
              )}
            </Box>
          </Box>
        ) : null}
      </Drawer>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        disableScrollLock
        disableAutoFocus
        disableRestoreFocus
        ModalProps={drawerSemTranco}
        slotProps={{ paper: { sx: papelDrawerSx } }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <CabecalhoDrawer
            titulo={labelTipoBreak(kind)}
            icone={<FreeBreakfastOutlinedIcon sx={{ fontSize: 22 }} />}
            onClose={() => setOpen(false)}
          />
          <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: 1.5 }}>
          <TextField
            {...dialogFieldProps}
            size="small"
            select
            label="Tipo"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setCodigo('');
              setMotivoCodigo('');
              setIdLojaDestino('');
            }}
            sx={campoBreakFieldSx}
          >
            <MenuItem value="refeicao">Break</MenuItem>
            <MenuItem value="desperdicio_completo">Desperdício completo</MenuItem>
            <MenuItem value="desperdicio_incompleto">Desperdício incompleto</MenuItem>
            <MenuItem value="emprestimo">Empréstimo</MenuItem>
          </TextField>
          <TextField
            {...dialogFieldProps}
            size="small"
            type="date"
            label="Data"
            value={dataBreak}
            onChange={(e) => setDataBreak(e.target.value.slice(0, 10))}
            sx={campoBreakFieldSx}
            slotProps={{
              ...dialogFieldProps.slotProps,
              htmlInput: { max: hojeISO() },
            }}
          />
          </Box>
          {kind === 'emprestimo' && (
            <TextField
              {...dialogFieldProps}
              size="small"
              select
              label="Loja que recebe"
              value={idLojaDestino === '' ? '' : String(idLojaDestino)}
              onChange={(e) => {
                const n = Number(e.target.value);
                setIdLojaDestino(Number.isFinite(n) && n > 0 ? n : '');
              }}
              sx={campoBreakFieldSx}
              required
              helperText="A loja destino confirma no app com OK — recebi. Só então o saldo entra."
            >
              <MenuItem value="">Selecione a loja…</MenuItem>
              {lojasDestino
                .filter((l) => l.id_loja !== idLoja)
                .map((l) => (
                  <MenuItem key={l.id_loja} value={String(l.id_loja)}>
                    {l.bk_number ? `${l.bk_number} · ${l.name}` : l.name}
                  </MenuItem>
                ))}
            </TextField>
          )}
          {exigeTurno && (
            <TextField
              {...dialogFieldProps}
              size="small"
              select
              label="Turno"
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              sx={campoBreakFieldSx}
              required
            >
              <MenuItem value="">Selecione…</MenuItem>
              <MenuItem value="manha">Manhã</MenuItem>
              <MenuItem value="tarde">Tarde</MenuItem>
              <MenuItem value="noite">Noite</MenuItem>
            </TextField>
          )}
          {exigeColab && colaboradores.length > 0 ? (
            <TextField
              {...dialogFieldProps}
              size="small"
              select
              label="Colaborador"
              value={colabSelect}
              onChange={(e) => {
                const v = e.target.value;
                setColabSelect(v);
                if (!v || v === '__outro__') {
                  setIdColaborador('');
                  setNomeColaborador('');
                  return;
                }
                const id = Number(v);
                const col = colaboradores.find((c) => c.id_usuario === id);
                setIdColaborador(id);
                setNomeColaborador(col?.nome || '');
              }}
              sx={campoBreakFieldSx}
            >
              <MenuItem value="">Selecione…</MenuItem>
              {colaboradores.map((c) => (
                <MenuItem key={c.id_usuario} value={String(c.id_usuario)}>
                  {c.nome}
                </MenuItem>
              ))}
              <MenuItem value="__outro__">Outro (digitar nome)</MenuItem>
            </TextField>
          ) : null}
          {exigeColab && colabDigitado && (
            <TextField
              {...dialogFieldProps}
              size="small"
              label="Nome do colaborador"
              value={nomeColaborador}
              onChange={(e) => {
                setIdColaborador('');
                setColabSelect(colaboradores.length ? '__outro__' : '');
                setNomeColaborador(e.target.value);
              }}
              placeholder="Quem pegará o break"
              sx={campoBreakFieldSx}
              required
            />
          )}
          {exigeMotivo && (
            <TextField
              {...dialogFieldProps}
              size="small"
              select
              label="Motivo"
              value={motivoCodigo}
              onChange={(e) => setMotivoCodigo(e.target.value)}
              sx={campoBreakFieldSx}
              required
            >
              <MenuItem value="">Selecione…</MenuItem>
              {motivos.map((m) => (
                <MenuItem key={m.codigo} value={m.codigo}>
                  {m.nome}
                </MenuItem>
              ))}
            </TextField>
          )}
          {usaInsumo ? (
            <EstoqueInsumoAutocomplete
              produtos={insumos}
              value={codigo}
              onChange={setCodigo}
              sx={campoBreakFieldSx}
              placeholder="Mercadoria do estoque"
            />
          ) : (
            <EstoqueProdutoVendaAutocomplete
              produtos={produtosVenda}
              value={codigo}
              onChange={setCodigo}
              sx={campoBreakFieldSx}
            />
          )}
          {kind === 'emprestimo' ? (
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <TextField
                {...dialogFieldProps}
                size="small"
                label="Caixa"
                value={caixaEmp}
                onChange={(e) => setCaixaEmp(e.target.value)}
                disabled={!empCx || !codigo}
                sx={{ ...campoBreakFieldSx, flex: 1 }}
              />
              <TextField
                {...dialogFieldProps}
                size="small"
                label="Pct"
                value={pcEmp}
                onChange={(e) => setPcEmp(e.target.value)}
                disabled={!empPc || !codigo}
                sx={{ ...campoBreakFieldSx, flex: 1 }}
              />
              <TextField
                {...dialogFieldProps}
                size="small"
                label={rotuloCampoFracionado(insumoEmp?.unidade_fracionada || insumoEmp?.unidade_contagem)}
                value={kgEmp}
                onChange={(e) =>
                  setKgEmp(
                    sanitizarEntradaFracionada(
                      e.target.value,
                      fracionadaInteira(insumoEmp?.unidade_fracionada || insumoEmp?.unidade_contagem),
                    ),
                  )
                }
                disabled={!empKg || !codigo}
                sx={{ ...campoBreakFieldSx, flex: 1 }}
              />
            </Box>
          ) : (
          <TextField
            {...dialogFieldProps}
            size="small"
            label="Quantidade"
            value={qtde}
            onChange={(e) => setQtde(sanitizarEntradaFracionada(e.target.value, qtdInteira))}
            sx={{
              ...campoBreakFieldSx,
              '& .MuiOutlinedInput-input': { textAlign: 'center' },
            }}
            slotProps={{
              ...dialogFieldProps.slotProps,
              htmlInput: { style: { textAlign: 'center' }, inputMode: qtdInteira ? 'numeric' : 'decimal' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <IconButton
                      size="small"
                      aria-label="Diminuir quantidade"
                      disabled={salvando || Number(String(qtde).replace(',', '.')) <= 0}
                      onClick={() => ajustarQtde(-1)}
                      sx={{ p: 0.25 }}
                    >
                      <RemoveIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {usaInsumo ? (
                      <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', mr: 0.25 }}>{unidadeFisica}</Box>
                    ) : null}
                    <IconButton
                      size="small"
                      aria-label="Aumentar quantidade"
                      disabled={salvando}
                      onClick={() => ajustarQtde(1)}
                      sx={{ p: 0.25 }}
                    >
                      <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          )}
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'var(--ga-surface)' }}>
          <Button onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>Cancelar</Button>
          <Button variant="contained" disableElevation disabled={salvando} onClick={() => void lancar()}>
            {kind === 'emprestimo' ? 'Enviar empréstimo' : 'Confirmar baixa'}
          </Button>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}




