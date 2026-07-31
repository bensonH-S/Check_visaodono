import { useCallback, useEffect, useState } from 'react';
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
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
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
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import FreeBreakfastOutlinedIcon from '@mui/icons-material/FreeBreakfastOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  api,
  type EstoqueBreakResumo,
  type EstoqueMovimento,
  type EstoqueSaldoItem,
  type EstoqueSyncStatus,
  type EstoqueVendaResumo,
  type EstoqueVendaSemFicha,
  type FichaTecnicaDetalhe,
  type ProdutoEstoque,
  type ProdutoVendaEstoque,
} from '../../api/client';
import CampoDataFrota from '../../components/frota/CampoDataFrota';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import EstoqueInsumoAutocomplete from '../../components/estoque/EstoqueInsumoAutocomplete';
import DialogTitleWithIcon from '../../components/DialogTitleWithIcon';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';
import { dialogContentSx, dialogFieldProps } from '../../utils/dialogForm';

type AbaOp = 'saldo' | 'vendas' | 'produtos' | 'break';

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

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function labelStatusVenda(status: string | null | undefined) {
  const s = String(status || '').toLowerCase();
  const map: Record<string, string> = {
    pendente: 'Pendente',
    processada: 'Processada',
    parcial: 'Parcial',
    erro: 'Erro',
  };
  if (map[s]) return map[s];
  if (!s) return '—';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function chipSxStatusVenda(status: string | null | undefined) {
  const s = String(status || '').toLowerCase();
  if (s === 'processada') {
    return { bgcolor: '#DCFCE7', color: '#166534', fontWeight: 700 };
  }
  if (s === 'parcial') {
    return { bgcolor: '#FFEDD5', color: '#C2410C', fontWeight: 700 };
  }
  if (s === 'erro') {
    return { bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 700 };
  }
  return { bgcolor: '#FEF9C3', color: '#A16207', fontWeight: 700 };
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
  flex: '0 0 36%',
  maxWidth: '36%',
} as const;

const campoBreakModoSx = {
  ...campoBreakBaseSx,
  flex: '1 1 64%',
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

type Props = {
  aba: AbaOp;
  idLoja: number;
  produtos: ProdutoEstoque[];
  onProdutosVendaCountChange?: (n: number) => void;
};

export type { AbaOp };

export default function EstoqueOperacionalPanels({
  aba,
  idLoja,
  produtos,
  onProdutosVendaCountChange,
}: Props) {
  if (aba === 'saldo') return <PainelSaldo idLoja={idLoja} />;
  if (aba === 'vendas') return <PainelVendas idLoja={idLoja} />;
  if (aba === 'produtos') {
    return (
      <PainelProdutos
        idLoja={idLoja}
        insumos={produtos}
        onCountChange={onProdutosVendaCountChange}
      />
    );
  }
  return <PainelBreak idLoja={idLoja} produtos={produtos} />;
}

function PainelSaldo({ idLoja }: { idLoja: number }) {
  const [loading, setLoading] = useState(true);
  const [saldos, setSaldos] = useState<EstoqueSaldoItem[]>([]);
  const [movs, setMovs] = useState<EstoqueMovimento[]>([]);
  const [q, setQ] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m] = await Promise.all([
        api.estoqueSaldos(idLoja, q || undefined),
        api.estoqueMovimentos(idLoja, { limit: 80 }),
      ]);
      setSaldos(s);
      setMovs(m);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar saldos', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja, q]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label="Buscar insumo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <Button startIcon={<RefreshIcon />} onClick={() => void carregar()} size="small">
          Atualizar
        </Button>
      </Box>

      <Paper sx={tablePaperSx}>
        <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, fontWeight: 700 }}>
          Saldo atual
        </Typography>
        <TableContainer sx={{ ...tableContainerSx, maxHeight: 360 }}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell align="right">Qtd</TableCell>
                <TableCell align="right">Valor und.</TableCell>
                <TableCell align="right">Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {saldos.map((s) => (
                <TableRow key={s.id_produto} hover>
                  <TableCell>{s.codigo}</TableCell>
                  <TableCell>{s.descricao}</TableCell>
                  <TableCell align="right">{fmtNum(s.quantidade, 3)}</TableCell>
                  <TableCell align="right">{fmtMoeda(s.valor_unidade)}</TableCell>
                  <TableCell align="right">{fmtMoeda(s.valor_total)}</TableCell>
                </TableRow>
              ))}
              {!saldos.length && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                      Nenhum saldo. Finalize uma contagem ou importe vendas com ficha.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Paper sx={tablePaperSx}>
        <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, fontWeight: 700 }}>
          Últimos movimentos
        </Typography>
        <TableContainer sx={{ ...tableContainerSx, maxHeight: 280 }}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Quando</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Insumo</TableCell>
                <TableCell align="right">Qtd</TableCell>
                <TableCell align="right">Saldo</TableCell>
                <TableCell>Obs.</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movs.map((m) => (
                <TableRow key={m.id_movimento} hover>
                  <TableCell>{new Date(m.criado_em).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>
                    <Chip size="small" label={m.tipo} />
                  </TableCell>
                  <TableCell>
                    {m.codigo} — {m.descricao}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: m.quantidade < 0 ? '#b91c1c' : '#15803d', fontWeight: 600 }}
                  >
                    {fmtNum(m.quantidade, 3)}
                  </TableCell>
                  <TableCell align="right">{fmtNum(m.saldo_apos, 3)}</TableCell>
                  <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.observacao || '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!movs.length && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                      Sem movimentos ainda
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

function PainelVendas({ idLoja }: { idLoja: number }) {
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState<EstoqueVendaResumo[]>([]);
  const [semFicha, setSemFicha] = useState<EstoqueVendaSemFicha[]>([]);
  const [sync, setSync] = useState<EstoqueSyncStatus | null>(null);
  const [dataIni, setDataIni] = useState(hojeISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [v, sf, st] = await Promise.all([
        api.estoqueVendas(idLoja),
        api.estoqueVendasSemFicha(idLoja),
        api.estoqueSyncStatus(),
      ]);
      setVendas(v);
      setSemFicha(sf);
      setSync(st);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar vendas', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const syncBk = async () => {
    setSyncing(true);
    try {
      const r = await api.estoqueSyncVendas({
        id_loja: idLoja,
        data_inicio: dataIni,
        data_fim: dataFim,
      });
      showToast(`Sync OK: ${r.linhas} linhas importadas`, 'success');
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha no sync BK Office', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('arquivo', file);
      fd.append('id_loja', String(idLoja));
      fd.append('data_venda', dataIni);
      fd.append('processar', '1');
      const r = await api.estoqueImportarVendasExcel(fd);
      showToast(`Importados ${r.linhas} itens em ${r.dias} dia(s)`, 'success');
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Falha ao importar', 'error');
    } finally {
      setImporting(false);
    }
  };

  const reprocessar = async (id: number) => {
    try {
      const r = await api.estoqueProcessarVenda(id);
      showToast(`Venda #${id}: ${r.status} (${r.processados} ok, ${r.sem_ficha} sem ficha)`, 'info');
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao processar', 'error');
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
      <Paper sx={{ p: 2, border: `1px solid ${colors.border}` }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
          Sync BK Office / Importar Excel
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <FiltroIntervaloDatasFrota
            dataInicio={dataIni}
            dataFim={dataFim}
            onChangeInicio={setDataIni}
            onChangeFim={setDataFim}
          />
          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadIcon />}
            disabled={syncing || !sync?.configurado || !dataIni || !dataFim}
            onClick={() => void syncBk()}
          >
            Buscar no BK Office
          </Button>
          <Button
            variant="outlined"
            component="label"
            startIcon={importing ? <CircularProgress size={16} /> : <UploadFileIcon />}
            disabled={importing}
          >
            Importar Excel
            <input
              type="file"
              hidden
              accept=".xlsx,.xls"
              onChange={(e) => void onUpload(e.target.files?.[0] || null)}
            />
          </Button>
        </Box>
        {sync?.ultimo && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Último job: {sync.ultimo.status} — {sync.ultimo.mensagem}
          </Typography>
        )}
      </Paper>

      {semFicha.length > 0 && (
        <Paper sx={{ p: 2, bgcolor: '#FFFBEB', border: '1px solid #FCD34D' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
            Vendas sem ficha técnica ({semFicha.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Cadastre a composição na aba Ficha para baixar o estoque automaticamente.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {semFicha.slice(0, 40).map((s) => (
              <Chip
                key={s.codigo}
                size="small"
                label={`${s.codigo} ${s.descricao || ''}`.trim()}
                variant="outlined"
              />
            ))}
          </Box>
        </Paper>
      )}

      <Paper sx={tablePaperSx}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Vendas importadas
          </Typography>
          <IconButton size="small" onClick={() => void carregar()}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Origem</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Itens</TableCell>
                <TableCell align="right">Processados</TableCell>
                <TableCell align="right">Sem ficha</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {vendas.map((v) => (
                <TableRow key={v.id_venda} hover>
                  <TableCell>{fmtDataBR(v.data_venda)}</TableCell>
                  <TableCell>{v.origem}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={labelStatusVenda(v.status)}
                      sx={chipSxStatusVenda(v.status)}
                    />
                  </TableCell>
                  <TableCell align="right">{v.itens ?? 0}</TableCell>
                  <TableCell align="right">{v.processados ?? 0}</TableCell>
                  <TableCell align="right">{v.sem_ficha ?? 0}</TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => void reprocessar(v.id_venda)}>
                      Reprocessar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!vendas.length && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                      Nenhuma venda importada ainda
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
}: {
  idLoja: number;
  insumos: ProdutoEstoque[];
  onCountChange?: (n: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<ProdutoVendaEstoque[]>([]);
  const [semFicha, setSemFicha] = useState<EstoqueVendaSemFicha[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroInsumo, setFiltroInsumo] = useState<'todos' | 'com' | 'sem'>('todos');
  const [open, setOpen] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [excluirAlvo, setExcluirAlvo] = useState<ProdutoVendaEstoque | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [pickerBusca, setPickerBusca] = useState('');
  const [pickerSelecionados, setPickerSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [idFicha, setIdFicha] = useState<number | null>(null);
  const [valorVenda, setValorVenda] = useState<number | null>(null);
  const [itens, setItens] = useState<Array<{ codigo_insumo: string; quantidade: string }>>([
    { codigo_insumo: '', quantidade: '1' },
  ]);

  const nomeInsumo = (codigoInsumo: string) => {
    const p = insumos.find((i) => i.codigo.toUpperCase() === codigoInsumo.toUpperCase());
    return p?.descricao || codigoInsumo;
  };

  const valorInsumosTotal = itens.reduce((acc, i) => {
    if (!i.codigo_insumo.trim()) return acc;
    const ins = insumos.find(
      (x) => x.codigo.toUpperCase() === i.codigo_insumo.trim().toUpperCase(),
    );
    const qtd = Number(String(i.quantidade).replace(',', '.')) || 0;
    return acc + qtd * (ins?.valor_unidade ?? 0);
  }, 0);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [pv, sf] = await Promise.all([
        api.estoqueProdutosVenda({ id_loja: idLoja, q: busca || undefined }),
        api.estoqueVendasSemFicha(idLoja),
      ]);
      setLista(pv);
      setSemFicha(sf);
      onCountChange?.(pv.length);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar produtos', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja, busca, onCountChange]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNovo = (prefill?: EstoqueVendaSemFicha) => {
    setIdFicha(null);
    setCodigo(prefill?.codigo || '');
    setDescricao(prefill?.descricao || '');
    setAtivo(true);
    setValorVenda(null);
    setItens([{ codigo_insumo: '', quantidade: '1' }]);
    setOpen(true);
  };

  const abrirProduto = async (p: ProdutoVendaEstoque) => {
    setCodigo(p.codigo);
    setDescricao(p.descricao || '');
    setAtivo(p.ativo !== false);
    setIdFicha(p.id_ficha ?? null);
    setValorVenda(p.valor_venda != null ? Number(p.valor_venda) : null);
    if (p.id_ficha) {
      try {
        const det: FichaTecnicaDetalhe = await api.estoqueFicha(p.id_ficha);
        setDescricao(det.descricao || p.descricao || '');
        setItens(
          det.itens.length
            ? det.itens.map((i) => ({
                codigo_insumo: i.codigo_insumo,
                quantidade: String(i.quantidade),
              }))
            : [{ codigo_insumo: '', quantidade: '1' }],
        );
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Erro ao abrir produto', 'error');
        return;
      }
    } else {
      setItens([{ codigo_insumo: '', quantidade: '1' }]);
    }
    setOpen(true);
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
    const next: Array<{ codigo_insumo: string; quantidade: string }> = [];
    for (const cod of pickerSelecionados) {
      const prev = existentes.get(cod);
      next.push(prev || { codigo_insumo: cod, quantidade: '1' });
    }
    setItens(next.length ? next : [{ codigo_insumo: '', quantidade: '1' }]);
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
      }))
      .filter((i) => i.codigo_insumo && i.quantidade > 0);
    if (!codigo.trim()) {
      showToast('Informe o código do produto', 'error');
      return;
    }
    if (!mapped.length) {
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
        itens: mapped,
      });
      showToast(idFicha ? 'Produto atualizado' : 'Produto cadastrado com insumos', 'success');
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

  const comInsumos = lista.filter((p) => !!p.id_ficha).length;
  const semInsumos = lista.length - comInsumos;
  const listaFiltrada = lista.filter((p) => {
    if (filtroInsumo === 'com') return !!p.id_ficha;
    if (filtroInsumo === 'sem') return !p.id_ficha;
    return true;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 260px' }}>
          Produtos de venda desta loja (Whopper, menus…). Abra um item para ver e editar os insumos
          que ele consome.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Buscar produto"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void carregar();
            }}
            sx={{ minWidth: 200 }}
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void carregar()}>
            Atualizar
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrirNovo()}>
            Novo produto
          </Button>
        </Box>
      </Box>

      {semFicha.length > 0 && (
        <Paper sx={{ p: 2, bgcolor: '#FFFBEB', border: '1px solid #FCD34D' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
            Vendidos sem composição ({semFicha.length}) — clique para cadastrar os insumos
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {semFicha.slice(0, 40).map((s) => (
              <Chip
                key={s.codigo}
                size="small"
                label={`${s.codigo} ${s.descricao || ''}`.trim()}
                onClick={() => abrirNovo(s)}
                clickable
              />
            ))}
          </Box>
        </Paper>
      )}

      <Paper sx={tablePaperSx}>
        <Tabs
          value={filtroInsumo}
          onChange={(_, v: 'todos' | 'com' | 'sem') => setFiltroInsumo(v)}
          sx={{
            minHeight: 40,
            borderBottom: '1px solid',
            borderColor: 'divider',
            px: 1,
            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 },
          }}
        >
          <Tab value="todos" label={`Todos (${lista.length})`} />
          <Tab value="com" label={`Com insumos (${comInsumos})`} />
          <Tab value="sem" label={`Sem insumos (${semInsumos})`} />
        </Tabs>
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
                <TableCell sx={{ width: '10%' }}>Código</TableCell>
                <TableCell sx={{ width: '28%' }}>Produto</TableCell>
                <TableCell align="center" sx={{ width: '10%' }}>
                  Insumos
                </TableCell>
                <TableCell align="right" sx={{ width: '12%' }}>
                  Valor venda
                </TableCell>
                <TableCell align="right" sx={{ width: '12%' }}>
                  Valor insumos
                </TableCell>
                <TableCell align="center" sx={{ width: '12%' }}>
                  Status
                </TableCell>
                <TableCell align="right" sx={{ width: '10%' }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {listaFiltrada.map((p) => {
                const comFicha = !!p.id_ficha;
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
                      {comFicha ? (
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
                                    })}{' '}
                                    × {nomeInsumo(i.codigo_insumo)}
                                    {i.valor_unidade != null && Number(i.valor_unidade) > 0
                                      ? ` (${fmtMoeda(Number(i.quantidade) * Number(i.valor_unidade))})`
                                      : ''}
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
                          label="Sem insumo"
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
                    <TableCell
                      align="right"
                      sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                    >
                      {comFicha && Number(p.valor_insumos) > 0
                        ? fmtMoeda(p.valor_insumos)
                        : comFicha
                          ? fmtMoeda(0)
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
                  <TableCell colSpan={7}>
                    <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                      {filtroInsumo === 'com'
                        ? 'Nenhum produto com insumos nesta loja.'
                        : filtroInsumo === 'sem'
                          ? 'Nenhum produto sem insumos nesta loja.'
                          : 'Nenhum produto listado. Cadastre um novo ou importe vendas para surgir o código BK.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitleWithIcon plainIcon divider icon={<MenuBookOutlinedIcon />}>
          {idFicha ? 'Editar produto' : 'Novo produto'}
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
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
            <TextField
              {...dialogFieldProps}
              label="Valor total insumos"
              value={valorInsumosTotal > 0 ? fmtMoeda(valorInsumosTotal) : fmtMoeda(0)}
              slotProps={{
                ...dialogFieldProps.slotProps,
                input: { readOnly: true },
              }}
              sx={{ flex: 1, minWidth: { xs: '100%', sm: 0 } }}
            />
            <TextField
              {...dialogFieldProps}
              label="Lucro"
              value={
                valorVenda != null && valorVenda > 0
                  ? fmtMoeda(valorVenda - valorInsumosTotal)
                  : '—'
              }
              slotProps={{
                ...dialogFieldProps.slotProps,
                input: { readOnly: true },
              }}
              sx={{
                flex: 1,
                minWidth: { xs: '100%', sm: 0 },
                '& .MuiOutlinedInput-input': {
                  color:
                    valorVenda != null && valorVenda > 0
                      ? valorVenda - valorInsumosTotal >= 0
                        ? 'success.main'
                        : 'error.main'
                      : undefined,
                  fontWeight: 600,
                },
              }}
            />
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'wrap',
              mt: 0.5,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Insumos
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Quanto de cada item sai do estoque a cada venda.
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ChecklistRtlIcon />}
              onClick={abrirPickerInsumos}
            >
              Escolher da lista
            </Button>
          </Box>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              ...(itens.length > 5
                ? {
                    maxHeight: 280,
                    overflowY: 'auto',
                    pr: 0.5,
                    mr: -0.5,
                  }
                : {}),
            }}
          >
            {itens.map((it, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <EstoqueInsumoAutocomplete
                  produtos={insumos}
                  value={it.codigo_insumo}
                  onChange={(cod) => {
                    const next = [...itens];
                    next[idx] = { ...next[idx], codigo_insumo: cod };
                    setItens(next);
                  }}
                  sx={{ flex: '1 1 auto', minWidth: 0 }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    aria-label="Diminuir quantidade"
                    disabled={Number(String(it.quantidade).replace(',', '.')) <= 0}
                    onClick={() => ajustarQtdItem(idx, -1)}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <TextField
                    {...dialogFieldProps}
                    label="Qtd"
                    value={it.quantidade}
                    onChange={(e) => {
                      const next = [...itens];
                      next[idx] = { ...next[idx], quantidade: e.target.value };
                      setItens(next);
                    }}
                    sx={{
                      width: 72,
                      '& .MuiOutlinedInput-input': {
                        textAlign: 'center',
                      },
                    }}
                    slotProps={{
                      ...dialogFieldProps.slotProps,
                      htmlInput: { style: { textAlign: 'center' } },
                    }}
                  />
                  <IconButton
                    size="small"
                    aria-label="Aumentar quantidade"
                    onClick={() => ajustarQtdItem(idx, 1)}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
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
                        setItens(next.length ? next : [{ codigo_insumo: '', quantidade: '1' }]);
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
                Resumo
              </Typography>
              {itens
                .filter((i) => i.codigo_insumo)
                .map((i) => {
                  const ins = insumos.find(
                    (x) => x.codigo.toUpperCase() === i.codigo_insumo.trim().toUpperCase(),
                  );
                  const qtd = Number(String(i.quantidade).replace(',', '.')) || 0;
                  const custo = qtd * (ins?.valor_unidade ?? 0);
                  return (
                    <Typography key={i.codigo_insumo} variant="body2" sx={{ lineHeight: 1.6 }}>
                      {i.quantidade} × {nomeInsumo(i.codigo_insumo)}
                      {custo > 0 ? ` — ${fmtMoeda(custo)}` : ''}
                    </Typography>
                  );
                })}
            </Box>
          )}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setItens([...itens, { codigo_insumo: '', quantidade: '1' }])}
          >
            Adicionar insumo
          </Button>
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

function PainelBreak({ idLoja, produtos }: { idLoja: number; produtos: ProdutoEstoque[] }) {
  const [loading, setLoading] = useState(true);
  const [lista, setLista] = useState<EstoqueBreakResumo[]>([]);
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dataBreak, setDataBreak] = useState(hojeISO());
  const [motivo, setMotivo] = useState('');
  const [modo, setModo] = useState<'insumo' | 'venda'>('insumo');
  const [codigo, setCodigo] = useState('');
  const [qtde, setQtde] = useState('1');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setLista(await api.estoqueBreaks(idLoja));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar breaks', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ajustarQtde = (delta: number) => {
    const atual = Number(String(qtde).replace(',', '.'));
    const base = Number.isFinite(atual) ? atual : 0;
    const prox = Math.max(0, Math.round((base + delta) * 1000) / 1000);
    setQtde(String(prox));
  };

  const lancar = async () => {
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
      setOpen(false);
      setMotivo('');
      setCodigo('');
      setQtde('1');
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao lançar break', 'error');
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Consumo de colaboradores (refeição / break) — baixa o estoque na hora.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          Lançar Break
        </Button>
      </Box>

      <Paper sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Motivo</TableCell>
                <TableCell align="right">Itens</TableCell>
                <TableCell>Por</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lista.map((b) => (
                <TableRow key={b.id_break} hover>
                  <TableCell>{fmtDataBR(b.data_break)}</TableCell>
                  <TableCell>{b.tipo}</TableCell>
                  <TableCell>{b.motivo || '—'}</TableCell>
                  <TableCell align="right">{b.itens ?? 0}</TableCell>
                  <TableCell>{b.criado_por_nome || '—'}</TableCell>
                </TableRow>
              ))}
              {!lista.length && (
                <TableRow>
                  <TableCell colSpan={5}>
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
          Lançar Break
        </DialogTitleWithIcon>
        <DialogContent sx={dialogContentSx}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
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
            <TextField
              {...dialogFieldProps}
              size="small"
              select
              label="Modo"
              value={modo}
              onChange={(e) => {
                setModo(e.target.value as 'insumo' | 'venda');
                setCodigo('');
              }}
              sx={campoBreakModoSx}
            >
              <MenuItem value="insumo">Insumo direto</MenuItem>
              <MenuItem value="venda">Produto de venda (via ficha)</MenuItem>
            </TextField>
          </Box>
          {modo === 'insumo' ? (
            <EstoqueInsumoAutocomplete
              produtos={produtos}
              value={codigo}
              onChange={setCodigo}
              sx={campoBreakFieldSx}
            />
          ) : (
            <TextField
              {...dialogFieldProps}
              size="small"
              label="Produto de venda (código BK)"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
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
          <TextField
            {...dialogFieldProps}
            size="small"
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Almoço colaborador..."
            sx={campoBreakFieldSx}
          />
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
