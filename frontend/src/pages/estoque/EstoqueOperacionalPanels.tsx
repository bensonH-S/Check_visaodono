import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
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
import ChecklistRtlIcon from '@mui/icons-material/ChecklistRtl';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RemoveIcon from '@mui/icons-material/Remove';
import FreeBreakfastOutlinedIcon from '@mui/icons-material/FreeBreakfastOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  api,
  type EstoqueBreakResumo,
  type Loja,
  type EstoqueCmvReal,
  type EstoqueCmvTeorico,
  type EstoqueCmvVariancia,
  type EstoqueDisciplina,
  type EstoqueMetaVendas,
  type EstoqueNfeDetalhe,
  type EstoqueNfeResumo,
  type EstoquePedidoItem,
  type EstoquePedidoSugerido,
  type EstoqueSaldoItem,
  type FichaTecnicaDetalhe,
  type ProdutoEstoque,
  type ProdutoVendaEstoque,
} from '../../api/client';
import CampoDataFrota from '../../components/frota/CampoDataFrota';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import EstoqueInsumoAutocomplete from '../../components/estoque/EstoqueInsumoAutocomplete';
import EstoqueProdutoVendaAutocomplete from '../../components/estoque/EstoqueProdutoVendaAutocomplete';
import { custoLinhaReceita, UNIDADES_RECEITA, unidadeReceitaPadrao } from '../../utils/fichaReceitaEstoque';
import DialogTitleWithIcon from '../../components/DialogTitleWithIcon';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors, portalPanelSx } from '../../theme/tokens';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';

type AbaOp = 'cmv' | 'vendas' | 'break' | 'pedido' | 'fichas' | 'saldo';

function fmtNum(v: number | null | undefined, digitos = 2) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return Number(v).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digitos,
  });
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

function textoFrescorVenda(d: {
  dias_venda?: number | null;
  ultimo_sync_em?: string | null;
  hoje_ausente?: boolean;
  hoje_parcial?: boolean;
  ultima_data_venda?: string | null;
} | null | undefined) {
  const hora = fmtHoraBR(d?.ultimo_sync_em);
  if (d?.hoje_ausente) {
    return `hoje não entrou · último ${fmtDataBR(d.ultima_data_venda)}`;
  }
  if (d?.hoje_parcial) {
    return hora ? `hoje incompleto · kit ${hora}` : 'hoje incompleto · kit atrasado';
  }
  const dias = d?.dias_venda ?? 0;
  return hora ? `${dias} dias · kit ${hora}` : `${dias} dias · BK Office`;
}

function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Dia 01 do mês corrente (America/Sao_Paulo). */
function inicioMesISO() {
  const hoje = hojeISO();
  return `${hoje.slice(0, 8)}01`;
}

const campoBreakBaseSx = {
  minWidth: 0,
  '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
    borderRadius: 1,
    minHeight: 40,
    height: 40,
    alignItems: 'center',
  },
  '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
    borderRadius: 1,
  },
  '& .MuiSelect-select, & .MuiOutlinedInput-input, & .MuiPickersInputBase-input': {
    py: '8.5px',
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    fontSize: '0.875rem',
  },
} as const;

const campoBreakDataSx = {
  ...campoBreakBaseSx,
  flex: '1 1 100%',
} as const;

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
        bgcolor: bloqueio ? 'rgba(180, 35, 24, 0.08)' : 'rgba(232, 82, 10, 0.08)',
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
    .replace(/^Última semanal \(segunda\) há (\d+) dias \(meta ≤ 10\)\.?$/i, 'Semanal há $1 dias')
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
        '&:hover .nfe-num': { color: colors.navy },
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
  onIrFichas?: () => void;
  onSetHeaderActions?: (node: React.ReactNode) => void;
};

export type { AbaOp };

export default function EstoqueOperacionalPanels({
  aba,
  idLoja,
  produtos,
  onProdutosVendaCountChange,
  onInsumosReload,
  onIrFichas,
  onSetHeaderActions,
}: Props) {
  if (aba === 'cmv') {
    return <PainelCmv idLoja={idLoja} onIrFichas={onIrFichas} onSetHeaderActions={onSetHeaderActions} />;
  }
  if (aba === 'vendas') {
    return <PainelVendas idLoja={idLoja} onSetHeaderActions={onSetHeaderActions} />;
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

function PainelVendas({
  idLoja,
  onSetHeaderActions,
}: {
  idLoja: number;
  onSetHeaderActions?: (node: React.ReactNode) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<EstoqueMetaVendas | null>(null);

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
    return [...lista].reverse().slice(0, 14);
  }, [meta?.dias]);

  if (loading && !meta) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const vendaHoje = meta?.venda_hoje ?? 0;
  const corHoje =
    meta?.hoje_ausente || meta?.hoje_parcial ? colors.orange : colors.textPrimary;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, flex: 1, minHeight: 0, overflow: 'auto' }}>
      {meta?.aviso ? (
        <Paper
          sx={{
            px: 2,
            py: 1.25,
            bgcolor: meta.hoje_ausente ? 'rgba(180, 35, 24, 0.06)' : 'rgba(232, 82, 10, 0.08)',
            border: `1px solid ${meta.hoje_ausente ? 'rgba(180, 35, 24, 0.2)' : 'rgba(232, 82, 10, 0.25)'}`,
          }}
        >
          <Typography sx={{ fontSize: '0.84rem', color: colors.textPrimary }}>{meta.aviso}</Typography>
        </Paper>
      ) : null}

      <Box sx={{ ...portalPanelSx, p: { xs: 1.75, md: 2.25 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: { xs: 1.5, md: 0 },
          }}
        >
          {[
            {
              label: 'Venda hoje',
              value: fmtMoeda(vendaHoje),
              color: corHoje,
              sub: textoFrescorVenda(meta),
            },
            {
              label: `Venda ${meta?.mes_nome || 'mês'}`,
              value: fmtMoeda(meta?.venda_mtd ?? 0),
              color: colors.textPrimary,
              sub: `${meta?.dias_venda ?? 0} dias com sync · média ${fmtMoeda(meta?.media_dia)}`,
            },
            {
              label: 'Meta mês (+10%)',
              value: meta?.meta_mes != null ? fmtMoeda(meta.meta_mes) : 'Sem base 2025',
              color: colors.textPrimary,
              sub:
                meta?.atingimento_mtd_pct != null
                  ? `${fmtNum(meta.atingimento_mtd_pct, 1)}% do MTD · projeção ${fmtMoeda(meta.projecao_mes)}`
                  : `LY ${fmtMoeda(meta?.venda_ly_mes)}`,
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
                  fontWeight: 600,
                  fontSize: { xs: '1.4rem', md: '1.7rem' },
                  letterSpacing: '-0.035em',
                  color: k.color,
                  mt: 0.35,
                }}
              >
                {k.value}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: colors.textMuted, mt: 0.5 }}>{k.sub}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1.2fr 0.8fr' },
          gap: 1.75,
          minHeight: 0,
        }}
      >
        <Paper sx={{ ...portalPanelSx, p: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: colors.navy }}>
              Vendas por dia (BK Office)
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: colors.textMuted, mt: 0.25 }}>
              Atualiza sozinho a cada 45s · origem kit PC gerência
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small" sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Dia</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Venda
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {meta?.ano ? meta.ano - 1 : 'LY'}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {diasRecentes.map((d) => (
                  <TableRow key={d.data} hover>
                    <TableCell>
                      {fmtDataBR(d.data)}
                      {d.sem_sync ? (
                        <Chip
                          label="sem sync"
                          size="small"
                          sx={{ ml: 1, height: 20, fontSize: '0.65rem' }}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: d.data === meta?.ate ? 700 : 400 }}>
                      {fmtMoeda(d.venda)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: colors.textMuted }}>
                      {fmtMoeda(d.venda_ly)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper sx={{ ...portalPanelSx, p: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: colors.navy }}>
              Top produtos (mês)
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small" sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Produto</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    Venda
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(meta?.top_produtos || []).length ? (
                  meta!.top_produtos.map((p) => (
                    <TableRow key={p.codigo} hover>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }} noWrap title={p.descricao}>
                          {p.descricao || p.codigo}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: colors.textMuted }}>{p.codigo}</Typography>
                      </TableCell>
                      <TableCell align="right">{fmtMoeda(p.venda)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} sx={{ color: colors.textMuted, py: 3 }}>
                      Nenhuma venda no mês ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
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
          aria-label="Mais opções"
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
                  fontWeight: 600,
                  fontSize: { xs: '1.4rem', md: '1.7rem' },
                  letterSpacing: '-0.035em',
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
                    fontWeight: 600,
                    fontSize: { xs: '1.05rem', md: '1.15rem' },
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
              meta ≤ {metaPct}%
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
            <LedgerRow prefix="−" label="estoque final" value={fmtMoeda(real?.estoque_final ?? 0)} />
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
        ) : null}
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

function PainelSaldoKardex({
  idLoja,
  onSetHeaderActions,
}: {
  idLoja: number;
  onSetHeaderActions?: (node: ReactNode) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [itens, setItens] = useState<EstoqueSaldoItem[]>([]);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setLoading(true);
      try {
        const rows = await api.estoqueSaldos(idLoja, undefined, { diaria: true });
        setItens(rows);
      } catch (e) {
        if (!silencioso) {
          showToast(e instanceof Error ? e.message : 'Erro ao carregar saldo da diária', 'error');
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

  const rotuloGrupo = (g: string | null | undefined) => {
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
  };

  if (loading && !itens.length) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
      <Typography sx={{ fontSize: '0.8rem', color: colors.textMuted }}>
        Só os insumos da diária. O saldo cai quando a venda do kit explode a ficha.
      </Typography>
      <Paper sx={{ ...tablePaperSx, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
          <Table stickyHeader size="small" sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Grupo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Código</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Insumo</TableCell>
                <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Saldo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Atualizado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itens.map((r) => (
                <TableRow key={r.id_insumo || r.id_produto} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap', color: colors.textSecondary }}>
                    {rotuloGrupo(r.grupo_diario)}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
                    {r.codigo}
                  </TableCell>
                  <TableCell>{r.descricao}</TableCell>
                  <TableCell sx={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {fmtNum(r.quantidade, 2)} {r.unidade_contagem || ''}
                  </TableCell>
                  <TableCell sx={{ color: colors.textMuted, whiteSpace: 'nowrap' }}>
                    {r.atualizado_em ? fmtHoraBR(r.atualizado_em) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!itens.length ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ color: colors.textMuted, py: 4, textAlign: 'center' }}>
                    Nenhum insumo da diária nesta loja
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

function PainelPedido({ idLoja }: { idLoja: number }) {
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<EstoquePedidoSugerido | null>(null);
  const [itens, setItens] = useState<EstoquePedidoItem[]>([]);
  const [crescimento, setCrescimento] = useState('5');
  const [dias, setDias] = useState('7');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const cres = Number(String(crescimento).replace(',', '.')) / 100;
      const r = await api.estoquePedidoSugerido(idLoja, {
        crescimento: Number.isFinite(cres) ? cres : 0.05,
        dias: Number(dias) || 7,
        estoque_seguranca_dias: 1,
      });
      setDados(r);
      setItens(r.itens.map((i) => ({ ...i })));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao calcular pedido', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja, crescimento, dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const confirmar = () => {
    const linhas = itens
      .filter((i) => Number(i.pedido_ajustado) > 0)
      .map(
        (i) =>
          `${i.codigo}\t${i.descricao}\t${Number(i.pedido_ajustado).toLocaleString('pt-BR')}`,
      );
    const texto = ['Código\tInsumo\tPedido', ...linhas].join('\n');
    void navigator.clipboard?.writeText(texto);
    showToast(
      `${linhas.length} item(ns) copiados. Ajuste feito pelo gestor — envio automático ainda não.`,
      'success',
    );
  };

  if (loading && !dados) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}>
      <Paper sx={{ p: 2, border: `1px solid ${colors.border}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.navy }} gutterBottom>
          Pedido sugerido da semana
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Base: vendas dos últimos {dados?.periodo_dias ?? 7} dias × fichas − saldo atual. Você
          ajusta e confirma (o app não pede sozinho).
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            label="Crescimento %"
            value={crescimento}
            onChange={(e) => setCrescimento(e.target.value)}
            sx={{ width: 120 }}
          />
          <TextField
            size="small"
            label="Dias base"
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            sx={{ width: 100 }}
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void carregar()}>
            Recalcular
          </Button>
          <Button variant="contained" onClick={confirmar} disabled={!itens.length}>
            Copiar pedido ajustado
          </Button>
        </Box>
      </Paper>

      <Paper sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Insumo</TableCell>
                <TableCell align="right">Consumo proj.</TableCell>
                <TableCell align="right">Saldo</TableCell>
                <TableCell align="right">Sugerido</TableCell>
                <TableCell align="right">Ajustado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itens.map((i, idx) => (
                <TableRow key={i.codigo} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{i.codigo}</TableCell>
                  <TableCell>{i.descricao}</TableCell>
                  <TableCell align="right">{fmtNum(i.consumo_projetado, 3)}</TableCell>
                  <TableCell align="right">{fmtNum(i.saldo_atual, 3)}</TableCell>
                  <TableCell align="right">{fmtNum(i.pedido_sugerido, 3)}</TableCell>
                  <TableCell align="right" sx={{ minWidth: 110 }}>
                    <TextField
                      size="small"
                      value={String(i.pedido_ajustado)}
                      onChange={(e) => {
                        const next = [...itens];
                        next[idx] = {
                          ...next[idx],
                          pedido_ajustado: Number(String(e.target.value).replace(',', '.')) || 0,
                        };
                        setItens(next);
                      }}
                      slotProps={{ htmlInput: { style: { textAlign: 'right' } } }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!itens.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                      Sem vendas recentes ou fichas para montar o pedido. Importe vendas e confira
                      fichas.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

function PainelProdutos({
  idLoja,
  insumos,
  onCountChange,
  onInsumosReload,
}: {
  idLoja: number;
  insumos: ProdutoEstoque[];
  onCountChange?: (n: number) => void;
  onInsumosReload?: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<ProdutoVendaEstoque[]>([]);
  const [busca, setBusca] = useState('');
  /** Produtos = venda+ficha | Insumos = o que se conta no estoque físico */
  const [abaCadastro, setAbaCadastro] = useState<'produtos' | 'insumos'>('produtos');
  const [filtroInsumo, setFiltroInsumo] = useState<'todos' | 'com' | 'sem' | 'unitario'>('todos');
  /** Filtro da aba Insumos: custo automático (nf/catalogo/manual com valor). */
  const [filtroCusto, setFiltroCusto] = useState<'todos' | 'sem' | 'com'>('todos');
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
    // Abre na hora (a API às vezes demora ~1s e parecia que “não abria”)
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
  const comCustoCount = insumos.filter((i) => i.ativo !== false && temCustoAutomatico(i)).length;

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
      if (filtroCusto === 'sem') return !temCustoAutomatico(i);
      if (filtroCusto === 'com') return temCustoAutomatico(i);
      return true;
    });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          label={`Produtos (${lista.length})`}
          color={abaCadastro === 'produtos' ? 'primary' : 'default'}
          onClick={() => setAbaCadastro('produtos')}
          sx={{ fontWeight: 700 }}
        />
        <Chip
          label={`Insumos (${insumos.filter((i) => i.ativo !== false).length})`}
          color={abaCadastro === 'insumos' ? 'primary' : 'default'}
          onClick={() => setAbaCadastro('insumos')}
          sx={{ fontWeight: 700 }}
        />
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label={abaCadastro === 'produtos' ? 'Buscar produto' : 'Buscar insumo'}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          {abaCadastro === 'produtos' && (
            <>
              <Chip
                size="small"
                label={`Todos (${lista.length})`}
                color={filtroInsumo === 'todos' ? 'primary' : 'default'}
                onClick={() => setFiltroInsumo('todos')}
                sx={{ fontWeight: 600 }}
              />
              <Chip
                size="small"
                color={filtroInsumo === 'sem' ? 'warning' : 'default'}
                label={`Falta ficha (${semInsumos})`}
                onClick={() => setFiltroInsumo(filtroInsumo === 'sem' ? 'todos' : 'sem')}
                sx={{ fontWeight: 700 }}
              />
            </>
          )}
          {abaCadastro === 'insumos' && (
            <>
              <Chip
                size="small"
                label={`Todos (${insumos.filter((i) => i.ativo !== false).length})`}
                color={filtroCusto === 'todos' ? 'primary' : 'default'}
                onClick={() => setFiltroCusto('todos')}
                sx={{ fontWeight: 600 }}
              />
              <Chip
                size="small"
                color={filtroCusto === 'sem' ? 'warning' : 'default'}
                label={`Sem custo automático (${semCustoCount})`}
                onClick={() => setFiltroCusto(filtroCusto === 'sem' ? 'todos' : 'sem')}
                sx={{ fontWeight: 700 }}
              />
              <Chip
                size="small"
                color={filtroCusto === 'com' ? 'success' : 'default'}
                label={`Com custo (${comCustoCount})`}
                onClick={() => setFiltroCusto(filtroCusto === 'com' ? 'todos' : 'com')}
                sx={{ fontWeight: 600 }}
              />
              {semCustoCount > 0 && (
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
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
                        showToast(
                          e instanceof Error ? e.message : 'Erro ao promover preços',
                          'error',
                        );
                      } finally {
                        setPromovendo(false);
                      }
                    })();
                  }}
                >
                  {promovendo ? 'Aplicando…' : 'Usar preço da planilha no CMV'}
                </Button>
              )}
            </>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void carregar()}>
            Atualizar
          </Button>
          {abaCadastro === 'produtos' && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrirNovo()}>
              Novo produto
            </Button>
          )}
        </Box>
      </Box>

      {abaCadastro === 'insumos' ? (
        <Paper sx={tablePaperSx}>
          <TableContainer sx={tableContainerSx}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Descrição (insumo)</TableCell>
                  <TableCell align="center">Unidade</TableCell>
                  <TableCell align="center">Fonte</TableCell>
                  <TableCell align="right">R$/und</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {insumosFiltrados.map((i) => {
                  const okCusto = temCustoAutomatico(i);
                  return (
                    <TableRow key={i.id_insumo ?? i.id_produto} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{i.codigo}</TableCell>
                      <TableCell>{i.descricao}</TableCell>
                      <TableCell align="center">
                        {String(i.unidade_contagem || 'UND').toUpperCase()}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={rotuloFonte(i.custo_fonte)}
                          color={okCusto ? (i.custo_fonte === 'manual' ? 'default' : 'success') : 'warning'}
                          variant={okCusto ? 'outlined' : 'filled'}
                          sx={{ fontWeight: 700, minWidth: 72 }}
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
                    <TableCell colSpan={5}>
                      <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                        {filtroCusto === 'sem'
                          ? 'Nenhum insumo sem custo automático nesta loja.'
                          : filtroCusto === 'com'
                            ? 'Nenhum insumo com custo automático nesta loja.'
                            : 'Nenhum insumo nesta loja. A conferência usa esta lista para contar.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {filtroCusto !== 'com' && semCustoCount > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1 }}>
              * Preço da planilha sem fonte automática (NF/catálogo/manual) — o CMV em R$ ignora esses
              valores.
            </Typography>
          )}
        </Paper>
      ) : (
      <Paper sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table
            size="small"
            stickyHeader
            sx={{
              ...tableSx,
              tableLayout: 'fixed',
              '& th, & td': { verticalAlign: 'middle' },
            }}
          >
            <TableHead>
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
                      {unitario ? '—' : (p.itens_ficha != null ? `${p.itens_ficha} iten${p.itens_ficha !== 1 ? 's' : ''}` : '—')}
                    </TableCell>
                    <TableCell align="center">
                      {unitario ? (
                        <Chip
                          size="small"
                          label="Unitário"
                          color="info"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
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
                          <Box
                            component="span"
                            sx={{
                              display: 'inline-block',
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              cursor: 'help',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                          >
                            {p.itens_ficha ?? 0}
                          </Box>
                        </Tooltip>
                      ) : (
                        <Chip
                          size="small"
                          label="Falta ficha"
                          color="warning"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                    >
                      {p.valor_venda != null && Number(p.valor_venda) > 0
                        ? fmtMoeda(p.valor_venda)
                        : '—'}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={produtoAtivo ? 'Ativo' : 'Inativo'}
                        color={produtoAtivo ? 'success' : 'default'}
                        variant="outlined"
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

      <Dialog
        open={open}
        onClose={() => !carregandoFicha && setOpen(false)}
        fullWidth
        maxWidth="md"
        slotProps={{
          root: { sx: { zIndex: 15000 } },
          paper: { sx: { maxWidth: 720, zIndex: 15001 } },
        }}
      >
        <DialogTitleWithIcon plainIcon divider icon={<MenuBookOutlinedIcon />}>
          {idFicha ? 'Ficha do produto' : 'Novo produto'}
          {carregandoFicha ? ' …' : ''}
        </DialogTitleWithIcon>
        <DialogContent sx={{ ...dialogContentSx, overflow: 'auto', maxHeight: '70vh' }}>
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
              fullWidth={false}
              label="Código BK"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              disabled={!!idFicha}
              sx={{ width: { xs: '100%', sm: 140 }, flexShrink: 0 }}
            />
            <TextField
              {...dialogFieldProps}
              label="Nome"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: WHOPPER"
              sx={{ flex: 1, minWidth: { xs: '100%', sm: 0 } }}
            />
          </Box>
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
              label="Valor de venda"
              value={valorVenda != null && valorVenda > 0 ? fmtMoeda(valorVenda) : '—'}
              slotProps={{
                ...dialogFieldProps.slotProps,
                input: { readOnly: true },
              }}
              sx={{ flex: 1, minWidth: { xs: '100%', sm: 0 } }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ flex: 2, pt: 1 }}>
              Custo dos insumos não aparece aqui — só após lançar nota fiscal (evita preço errado de
              planilha).
            </Typography>
          </Box>
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
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
              mt: 0.5,
              mb: 0.5,
            }}
          >
            <Box sx={{ minWidth: 0, flex: '1 1 220px', pr: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                Insumos
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.25, lineHeight: 1.35, maxWidth: 420 }}
              >
                Quantidade na receita (g, fatia…). O custo usa a conversão para a unidade de compra.
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ChecklistRtlIcon />}
              onClick={abrirPickerInsumos}
              sx={{ flexShrink: 0, mt: 0.25 }}
            >
              Escolher da lista
            </Button>
          </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Este produto não usa composição. Cadastre o insumo com o mesmo código se quiser
              controlar o estoque físico (ex.: lata de Coca).
            </Typography>
          )}
          {requerFicha && (
          <>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
              pt: 0.75,
              ...(itens.length > 5
                ? {
                    maxHeight: 6 + 5 * 48 + 4 * 6, // pt + 5 linhas + gaps apertados
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pr: 0.75,
                  }
                : {}),
            }}
          >
            {itens.map((it, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-end',
                  flexWrap: 'nowrap',
                  height: 48,
                  minHeight: 48,
                  flexShrink: 0,
                  overflow: 'visible',
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
                  sx={{
                    flex: '1 1 auto',
                    minWidth: 0,
                    '& .MuiOutlinedInput-root': { height: 40, minHeight: 40 },
                  }}
                />
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
                    width: 82,
                    flexShrink: 0,
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
                    width: 100,
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
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Box sx={{ flex: 1 }} />
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
          <Button onClick={() => setOpen(false)}>Fechar</Button>
          <Button variant="contained" disabled={salvando} onClick={() => void salvar()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

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

function PainelBreak({ idLoja }: { idLoja: number }) {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<EstoqueBreakResumo[]>([]);
  const [produtosVenda, setProdutosVenda] = useState<ProdutoVendaEstoque[]>([]);
  const [insumos, setInsumos] = useState<ProdutoEstoque[]>([]);
  const [motivos, setMotivos] = useState<Array<{ codigo: string; nome: string }>>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
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
  const usaInsumo = kind === 'desperdicio_incompleto' || kind === 'emprestimo';
  const exigeColab = kind === 'refeicao';
  const exigeTurno = kind !== 'emprestimo';
  const exigeMotivo = kind === 'desperdicio_completo' || kind === 'desperdicio_incompleto';
  const colabDigitado = colaboradores.length === 0 || colabSelect === '__outro__';

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [breaks, cols, cat, lojasRows] = await Promise.all([
        api.estoqueBreaks(idLoja),
        api.estoqueBreakColaboradores(idLoja),
        api.estoqueBreakCatalogo(idLoja, 'refeicao'),
        api.estoqueLojas({ ativas: true, operacionais: true }).catch(() => [] as Loja[]),
      ]);
      setLista(breaks);
      setColaboradores(cols);
      setLojas(lojasRows);
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
    setDataBreak(hojeISO());
  };

  const ajustarQtde = (delta: number) => {
    const atual = Number(String(qtde).replace(',', '.'));
    const base = Number.isFinite(atual) ? atual : 0;
    const prox = Math.max(0, Math.round((base + delta) * 1000) / 1000);
    setQtde(String(prox));
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
    if (!codigo.trim() || !(quantidade > 0)) {
      showToast('Informe produto e quantidade', 'error');
      return;
    }
    setSalvando(true);
    try {
      const motivoNome = motivos.find((m) => m.codigo === motivoCodigo)?.nome;
      await api.estoqueLancarBreak({
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
            ? { codigo_insumo: codigo.trim(), quantidade }
            : { codigo_venda: codigo.trim(), quantidade },
        ],
      });
      showToast(`${labelTipoBreak(kind)} lançado — estoque baixado`, 'success');
      setOpen(false);
      resetForm();
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao lançar', 'error');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colors.navy, letterSpacing: '-0.01em' }}>
            Break
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, maxWidth: 560 }}>
            Consumo interno (break), desperdício completo e incompleto. Todos baixam o estoque; só o break entra no CMV.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            resetForm();
            setOpen(true);
          }}
          sx={{ bgcolor: colors.orange, '&:hover': { bgcolor: colors.orangeHover } }}
        >
          Lançar
        </Button>
      </Box>

      <Paper sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Turno</TableCell>
                <TableCell>Colaborador / destino</TableCell>
                <TableCell>Motivo</TableCell>
                <TableCell align="right">Itens</TableCell>
                <TableCell>Lançado por</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.map((b) => (
                <TableRow key={b.id_break} hover>
                  <TableCell>{fmtDataBR(b.data_break)}</TableCell>
                  <TableCell>{labelTipoBreak(b.tipo)}</TableCell>
                  <TableCell>{labelTurnoBreak(b.turno)}</TableCell>
                  <TableCell>
                    {b.tipo === 'emprestimo'
                      ? b.loja_destino_nome
                        ? `${b.loja_destino_bk ? `${b.loja_destino_bk} · ` : ''}${b.loja_destino_nome}`
                        : '—'
                      : b.colaborador_nome || '—'}
                  </TableCell>
                  <TableCell>{b.motivo || '—'}</TableCell>
                  <TableCell align="right">{b.itens ?? 0}</TableCell>
                  <TableCell>{b.criado_por_nome || '—'}</TableCell>
                </TableRow>
              ))}
              {!lista.length && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                      Nenhum break lançado
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { maxWidth: 440 } } }}
      >
        <DialogTitleWithIcon plainIcon divider icon={<FreeBreakfastOutlinedIcon />}>
          {labelTipoBreak(kind)}
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
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
          <Box sx={campoBreakDataSx}>
            <CampoDataFrota
              label="Data"
              value={dataBreak}
              onChange={setDataBreak}
              sx={{
                mb: 0,
                width: '100%',
                '& .MuiOutlinedInput-root, & .MuiPickersOutlinedInput-root': {
                  borderRadius: 1,
                  minHeight: 40,
                  height: 40,
                  alignItems: 'center',
                },
                '& .MuiOutlinedInput-notchedOutline, & .MuiPickersOutlinedInput-notchedOutline': {
                  borderRadius: 1,
                },
                '& .MuiOutlinedInput-input, & .MuiPickersInputBase-input': {
                  py: '8.5px',
                  boxSizing: 'border-box',
                  fontSize: '0.875rem',
                },
              }}
            />
          </Box>
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
            >
              <MenuItem value="">Selecione…</MenuItem>
              {lojas
                .filter((l) => l.id_loja !== idLoja)
                .map((l) => (
                  <MenuItem key={l.id_loja} value={String(l.id_loja)}>
                    {l.bk_number ? `${l.bk_number} · ${l.name}` : l.name}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              aria-label="Diminuir quantidade"
              disabled={salvando || Number(String(qtde).replace(',', '.')) <= 0}
              onClick={() => ajustarQtde(-1)}
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
            <TextField
              {...dialogFieldProps}
              size="small"
              label="Quantidade"
              value={qtde}
              onChange={(e) => setQtde(e.target.value)}
              sx={{
                ...campoBreakFieldSx,
                flex: 1,
                '& .MuiOutlinedInput-input': { textAlign: 'center' },
              }}
              slotProps={{
                ...dialogFieldProps.slotProps,
                htmlInput: { style: { textAlign: 'center' } },
              }}
            />
            <IconButton
              size="small"
              aria-label="Aumentar quantidade"
              disabled={salvando}
              onClick={() => ajustarQtde(1)}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={salvando} onClick={() => void lancar()}>
            Confirmar baixa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
