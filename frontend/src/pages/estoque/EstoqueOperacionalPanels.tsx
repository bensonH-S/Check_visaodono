import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
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
  type FichaTecnicaResumo,
  type ProdutoEstoque,
} from '../../api/client';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';
import { dialogFieldProps } from '../../utils/dialogForm';

type AbaOp = 'saldo' | 'vendas' | 'ficha' | 'break';

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

type Props = {
  aba: AbaOp;
  idLoja: number;
  produtos: ProdutoEstoque[];
};

export type { AbaOp };

export default function EstoqueOperacionalPanels({ aba, idLoja, produtos }: Props) {
  if (aba === 'saldo') return <PainelSaldo idLoja={idLoja} />;
  if (aba === 'vendas') return <PainelVendas idLoja={idLoja} />;
  if (aba === 'ficha') return <PainelFicha idLoja={idLoja} produtos={produtos} />;
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
                <TableCell>Produto</TableCell>
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
          <TextField
            size="small"
            type="date"
            label="Início"
            slotProps={{ inputLabel: { shrink: true } }}
            value={dataIni}
            onChange={(e) => setDataIni(e.target.value)}
          />
          <TextField
            size="small"
            type="date"
            label="Fim"
            slotProps={{ inputLabel: { shrink: true } }}
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadIcon />}
            disabled={syncing || !sync?.configurado}
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
          <Chip
            size="small"
            label={sync?.configurado ? 'Credenciais OK' : 'Configure BKOFFICE_USER/PASS no .env'}
            color={sync?.configurado ? 'success' : 'warning'}
            variant="outlined"
          />
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
                    <Chip size="small" label={v.status} />
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

function PainelFicha({ idLoja, produtos }: { idLoja: number; produtos: ProdutoEstoque[] }) {
  const [loading, setLoading] = useState(true);
  const [fichas, setFichas] = useState<FichaTecnicaResumo[]>([]);
  const [semFicha, setSemFicha] = useState<EstoqueVendaSemFicha[]>([]);
  const [open, setOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [itens, setItens] = useState<Array<{ codigo_insumo: string; quantidade: string }>>([
    { codigo_insumo: '', quantidade: '1' },
  ]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [f, sf] = await Promise.all([
        api.estoqueFichas(),
        api.estoqueVendasSemFicha(idLoja),
      ]);
      setFichas(f);
      setSemFicha(sf);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar fichas', 'error');
    } finally {
      setLoading(false);
    }
  }, [idLoja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const abrirNova = (prefill?: EstoqueVendaSemFicha) => {
    setCodigo(prefill?.codigo || '');
    setDescricao(prefill?.descricao || '');
    setItens([{ codigo_insumo: '', quantidade: '1' }]);
    setOpen(true);
  };

  const editar = async (id: number) => {
    try {
      const det: FichaTecnicaDetalhe = await api.estoqueFicha(id);
      setCodigo(det.codigo);
      setDescricao(det.descricao);
      setItens(
        det.itens.length
          ? det.itens.map((i) => ({
              codigo_insumo: i.codigo_insumo,
              quantidade: String(i.quantidade),
            }))
          : [{ codigo_insumo: '', quantidade: '1' }],
      );
      setOpen(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao abrir ficha', 'error');
    }
  };

  const salvar = async () => {
    const mapped = itens
      .map((i) => ({
        codigo_insumo: i.codigo_insumo.trim().toUpperCase(),
        quantidade: Number(String(i.quantidade).replace(',', '.')),
      }))
      .filter((i) => i.codigo_insumo && i.quantidade > 0);
    if (!codigo.trim()) {
      showToast('Informe o código do produto de venda', 'error');
      return;
    }
    if (!mapped.length) {
      showToast('Informe ao menos um insumo', 'error');
      return;
    }
    setSalvando(true);
    try {
      await api.estoqueSalvarFicha({
        codigo: codigo.trim(),
        descricao: descricao.trim(),
        itens: mapped,
      });
      showToast('Ficha salva', 'success');
      setOpen(false);
      await carregar();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar ficha', 'error');
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
          Cada produto vendido no BK (ex.: 1050 WHOPPER/Q) precisa da composição em insumos da loja.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrirNova()}>
          Nova ficha
        </Button>
      </Box>

      {semFicha.length > 0 && (
        <Paper sx={{ p: 2, bgcolor: '#FFFBEB', border: '1px solid #FCD34D' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} gutterBottom>
            Pendentes de cadastro
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {semFicha.slice(0, 30).map((s) => (
              <Chip
                key={s.codigo}
                size="small"
                label={`${s.codigo} ${s.descricao || ''}`.trim()}
                onClick={() => abrirNova(s)}
                clickable
              />
            ))}
          </Box>
        </Paper>
      )}

      <Paper sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Código venda</TableCell>
                <TableCell>Descrição</TableCell>
                <TableCell align="right">Insumos</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {fichas.map((f) => (
                <TableRow key={f.id_ficha} hover>
                  <TableCell>{f.codigo}</TableCell>
                  <TableCell>{f.descricao}</TableCell>
                  <TableCell align="right">{f.itens}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => void editar(f.id_ficha)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!fichas.length && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                      Nenhuma ficha cadastrada
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Ficha técnica</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField
            {...dialogFieldProps}
            label="Código produto venda (BK)"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <TextField
            {...dialogFieldProps}
            label="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
          <Typography variant="caption" color="text.secondary">
            Insumos (códigos do cadastro de produtos da loja)
          </Typography>
          {itens.map((it, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                {...dialogFieldProps}
                select
                label="Insumo"
                value={it.codigo_insumo}
                onChange={(e) => {
                  const next = [...itens];
                  next[idx] = { ...next[idx], codigo_insumo: e.target.value };
                  setItens(next);
                }}
                sx={{ flex: 2 }}
              >
                <MenuItem value="">Selecione</MenuItem>
                {produtos.map((p) => (
                  <MenuItem key={p.id_produto} value={p.codigo}>
                    {p.codigo} — {p.descricao}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                {...dialogFieldProps}
                label="Qtd"
                value={it.quantidade}
                onChange={(e) => {
                  const next = [...itens];
                  next[idx] = { ...next[idx], quantidade: e.target.value };
                  setItens(next);
                }}
                sx={{ width: 100 }}
              />
              <IconButton
                size="small"
                disabled={itens.length <= 1}
                onClick={() => setItens(itens.filter((_, i) => i !== idx))}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setItens([...itens, { codigo_insumo: '', quantidade: '1' }])}
          >
            Insumo
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={salvando} onClick={() => void salvar()}>
            Salvar
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
          Lançar break
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

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Lançar break</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          <TextField
            {...dialogFieldProps}
            type="date"
            label="Data"
            slotProps={{ inputLabel: { shrink: true } }}
            value={dataBreak}
            onChange={(e) => setDataBreak(e.target.value)}
          />
          <TextField
            {...dialogFieldProps}
            select
            label="Modo"
            value={modo}
            onChange={(e) => {
              setModo(e.target.value as 'insumo' | 'venda');
              setCodigo('');
            }}
          >
            <MenuItem value="insumo">Insumo direto</MenuItem>
            <MenuItem value="venda">Produto acabado (via ficha)</MenuItem>
          </TextField>
          {modo === 'insumo' ? (
            <TextField
              {...dialogFieldProps}
              select
              label="Insumo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
            >
              <MenuItem value="">Selecione</MenuItem>
              {produtos.map((p) => (
                <MenuItem key={p.id_produto} value={p.codigo}>
                  {p.codigo} — {p.descricao}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              {...dialogFieldProps}
              label="Código produto venda (BK)"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              helperText="Ex.: 1050 — precisa ter ficha técnica"
            />
          )}
          <TextField
            {...dialogFieldProps}
            label="Quantidade"
            value={qtde}
            onChange={(e) => setQtde(e.target.value)}
          />
          <TextField
            {...dialogFieldProps}
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Almoço colaborador..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" disabled={salvando} onClick={() => void lancar()}>
            Confirmar baixa
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
