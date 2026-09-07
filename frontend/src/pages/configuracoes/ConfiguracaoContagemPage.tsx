import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SaveIcon from '@mui/icons-material/Save';
import {
  api,
  type ConfigContagemResumo,
  type ConversaoContagemStatus,
  type InsumoConfigContagem,
} from '../../api/client';
import { CONTAGEM_SEMANAL_ATIVA } from '../../components/estoque/estoqueContagemTipo';
import { showToast } from '../../utils/toast';
import {
  tableContainerSx,
  tablePageLayoutSx,
  tablePaperSx,
  tableSx,
} from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';

const UNIDADES = ['KG', 'UND', 'L'] as const;

type FiltroMatriz =
  | 'todos'
  | 'participam'
  | 'fora'
  | 'diaria'
  | 'critica'
  | 'conversao_pendente'
  | 'divergente';

type Draft = Pick<
  InsumoConfigContagem,
  | 'participa_contagem'
  | 'contagem_diaria'
  | 'contagem_critica'
  | 'permite_contagem_caixa'
  | 'permite_contagem_pc_fd'
  | 'permite_contagem_kg_und'
  | 'unidade_fracionada'
>;

const FILTROS: Array<{ id: FiltroMatriz; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'participam', label: 'Participam' },
  { id: 'fora', label: 'Fora da contagem' },
  { id: 'diaria', label: 'Diária' },
  ...(CONTAGEM_SEMANAL_ATIVA ? [{ id: 'critica' as const, label: 'Crítica' }] : []),
  { id: 'conversao_pendente', label: 'Conversão pendente' },
  { id: 'divergente', label: 'Fora do padrão' },
];

function rotuloConversao(status: ConversaoContagemStatus) {
  if (status === 'validada') return 'Validada';
  if (status === 'pendente' || status === 'bloqueada') return 'Pendente';
  return '—';
}

function linhaIgual(a: Draft, b: Draft) {
  return (
    a.participa_contagem === b.participa_contagem &&
    a.contagem_diaria === b.contagem_diaria &&
    a.contagem_critica === b.contagem_critica &&
    a.permite_contagem_caixa === b.permite_contagem_caixa &&
    a.permite_contagem_pc_fd === b.permite_contagem_pc_fd &&
    a.permite_contagem_kg_und === b.permite_contagem_kg_und &&
    a.unidade_fracionada === b.unidade_fracionada
  );
}

function draftDe(row: InsumoConfigContagem): Draft {
  return {
    participa_contagem: row.participa_contagem,
    contagem_diaria: row.contagem_diaria,
    contagem_critica: row.contagem_critica,
    permite_contagem_caixa: row.permite_contagem_caixa,
    permite_contagem_pc_fd: row.permite_contagem_pc_fd,
    permite_contagem_kg_und: row.permite_contagem_kg_und,
    unidade_fracionada: row.unidade_fracionada,
  };
}

function resumoLocal(originais: InsumoConfigContagem[], drafts: Record<number, Draft>): ConfigContagemResumo {
  const r: ConfigContagemResumo = {
    alterados: 0,
    entrando_contagem: 0,
    saindo_contagem: 0,
    caixa: 0,
    pc_fd: 0,
    kg_und: 0,
    diaria: 0,
    critica: 0,
    fracionada: 0,
  };
  for (const orig of originais) {
    const d = drafts[orig.id_insumo];
    if (!d || linhaIgual(draftDe(orig), d)) continue;
    r.alterados += 1;
    if (orig.participa_contagem !== d.participa_contagem) {
      if (d.participa_contagem) r.entrando_contagem += 1;
      else r.saindo_contagem += 1;
    }
    if (orig.permite_contagem_caixa !== d.permite_contagem_caixa) r.caixa += 1;
    if (orig.permite_contagem_pc_fd !== d.permite_contagem_pc_fd) r.pc_fd += 1;
    if (orig.permite_contagem_kg_und !== d.permite_contagem_kg_und) r.kg_und += 1;
    if (orig.contagem_diaria !== d.contagem_diaria) r.diaria += 1;
    if (orig.contagem_critica !== d.contagem_critica) r.critica += 1;
    if (orig.unidade_fracionada !== d.unidade_fracionada) r.fracionada += 1;
  }
  return r;
}

export default function ConfiguracaoContagemPage() {
  const [itens, setItens] = useState<InsumoConfigContagem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroMatriz>('todos');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [dlgResumo, setDlgResumo] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const resp = await api.estoqueConfiguracaoContagem();
      setItens(resp.itens || []);
      setDrafts({});
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o padrão da rede');
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const atualDe = useCallback(
    (row: InsumoConfigContagem): Draft => drafts[row.id_insumo] || draftDe(row),
    [drafts],
  );

  const patchLinha = (row: InsumoConfigContagem, campo: keyof Draft, valor: Draft[keyof Draft]) => {
    const base = atualDe(row);
    const next = { ...base, [campo]: valor };
    if (
      (campo === 'permite_contagem_caixa' ||
        campo === 'permite_contagem_pc_fd' ||
        campo === 'permite_contagem_kg_und') &&
      !next.permite_contagem_caixa &&
      !next.permite_contagem_pc_fd &&
      !next.permite_contagem_kg_und
    ) {
      showToast('Deixe pelo menos um campo de contagem liberado', 'error');
      return;
    }
    setDrafts((prev) => {
      const copy = { ...prev };
      if (linhaIgual(draftDe(row), next)) delete copy[row.id_insumo];
      else copy[row.id_insumo] = next;
      return copy;
    });
  };

  const resumo = useMemo(() => resumoLocal(itens, drafts), [itens, drafts]);
  const sujo = resumo.alterados > 0;

  const visiveis = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return itens.filter((row) => {
      const d = atualDe(row);
      if (q && !row.codigo.toUpperCase().includes(q) && !row.descricao.toUpperCase().includes(q)) {
        return false;
      }
      if (filtro === 'participam') return d.participa_contagem;
      if (filtro === 'fora') return !d.participa_contagem;
      if (filtro === 'diaria') return d.contagem_diaria;
      if (filtro === 'critica') return d.contagem_critica;
      if (filtro === 'conversao_pendente') {
        return row.conversao_status === 'pendente' || row.conversao_status === 'bloqueada';
      }
      if (filtro === 'divergente') return row.divergente === true;
      return true;
    });
  }, [itens, busca, filtro, atualDe]);

  const confirmarSalvar = async () => {
    if (!sujo) return;
    setSalvando(true);
    setErro('');
    try {
      const payload = itens
        .filter((row) => drafts[row.id_insumo] && !linhaIgual(draftDe(row), drafts[row.id_insumo]))
        .map((row) => ({ id_insumo: row.id_insumo, codigo: row.codigo, ...drafts[row.id_insumo] }));
      const resp = await api.estoqueSalvarConfiguracaoContagem({ itens: payload });
      await carregar();
      setDlgResumo(false);
      const extra = resp.resumo.replicados
        ? ` em ${resp.resumo.alterados + resp.resumo.replicados} cadastros`
        : '';
      showToast(`${resp.resumo.alterados} SKU(s) padronizado(s)${extra}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Box sx={tablePageLayoutSx}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <TextField
          size="small"
          label="Busca"
          placeholder="Código ou produto"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          sx={{ minWidth: 220, flex: 1 }}
        />
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!sujo || salvando || loading}
          onClick={() => setDlgResumo(true)}
        >
          Salvar alterações{sujo ? ` (${resumo.alterados})` : ''}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {FILTROS.map((f) => (
          <Chip
            key={f.id}
            size="small"
            label={f.label}
            variant={filtro === f.id ? 'filled' : 'outlined'}
            color={filtro === f.id ? 'primary' : 'default'}
            onClick={() => setFiltro(f.id)}
          />
        ))}
      </Box>

      <Typography variant="caption" sx={{ color: colors.textSecondary }}>
        Padrão BK: um SKU vale para todas as lojas, menos a Popeyes. Preço e saldo continuam por
        loja.
        {` ${visiveis.length} de ${itens.length} produtos.`}
        {sujo ? ` ${resumo.alterados} alteração(ões) não salva(s).` : ''}
      </Typography>

      {erro && <Alert severity="error">{erro}</Alert>}
      {loading && <LinearProgress />}

      <Box sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table stickyHeader size="small" sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Código</TableCell>
                <TableCell>Produto</TableCell>
                <TableCell align="center">Participa</TableCell>
                <TableCell align="center">Diária</TableCell>
                {CONTAGEM_SEMANAL_ATIVA && <TableCell align="center">Crítica</TableCell>}
                <TableCell align="center">Caixa</TableCell>
                <TableCell align="center">PC/FD</TableCell>
                <TableCell align="center">Fracionado</TableCell>
                <TableCell>Saldo</TableCell>
                <TableCell>Fracionada</TableCell>
                <TableCell>Conversão</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visiveis.map((row) => {
                const d = atualDe(row);
                const dirty = Boolean(drafts[row.id_insumo]);
                const conv = rotuloConversao(row.conversao_status);
                return (
                  <TableRow key={row.id_insumo} hover selected={dirty}>
                    <TableCell sx={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {row.codigo}
                    </TableCell>
                    <TableCell>
                      {row.descricao}
                      {row.divergente ? (
                        <Chip
                          size="small"
                          label="fora do padrão"
                          color="warning"
                          variant="outlined"
                          sx={{ ml: 1, height: 20 }}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell align="center" padding="checkbox">
                      <Switch
                        size="small"
                        checked={d.participa_contagem}
                        onChange={(e) => patchLinha(row, 'participa_contagem', e.target.checked)}
                      />
                    </TableCell>
                    <TableCell align="center" padding="checkbox">
                      <Switch
                        size="small"
                        checked={d.contagem_diaria}
                        onChange={(e) => patchLinha(row, 'contagem_diaria', e.target.checked)}
                      />
                    </TableCell>
                    {CONTAGEM_SEMANAL_ATIVA && (
                    <TableCell align="center" padding="checkbox">
                      <Switch
                        size="small"
                        checked={d.contagem_critica}
                        onChange={(e) => patchLinha(row, 'contagem_critica', e.target.checked)}
                      />
                    </TableCell>
                    )}
                    <TableCell align="center" padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={d.permite_contagem_caixa}
                        onChange={(e) => patchLinha(row, 'permite_contagem_caixa', e.target.checked)}
                      />
                    </TableCell>
                    <TableCell align="center" padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={d.permite_contagem_pc_fd}
                        onChange={(e) => patchLinha(row, 'permite_contagem_pc_fd', e.target.checked)}
                      />
                    </TableCell>
                    <TableCell align="center" padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={d.permite_contagem_kg_und}
                        onChange={(e) => patchLinha(row, 'permite_contagem_kg_und', e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>{row.unidade_contagem}</TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={d.unidade_fracionada}
                        onChange={(e) =>
                          patchLinha(row, 'unidade_fracionada', String(e.target.value).toUpperCase())
                        }
                        sx={{ minWidth: 84 }}
                      >
                        {UNIDADES.map((u) => (
                          <MenuItem key={u} value={u}>
                            {u}
                          </MenuItem>
                        ))}
                        {!UNIDADES.includes(d.unidade_fracionada as (typeof UNIDADES)[number]) && (
                          <MenuItem value={d.unidade_fracionada}>{d.unidade_fracionada}</MenuItem>
                        )}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="caption"
                        sx={{
                          color:
                            row.conversao_status === 'pendente' || row.conversao_status === 'bloqueada'
                              ? 'warning.main'
                              : colors.textSecondary,
                          fontWeight: row.conversao_status === 'validada' ? 600 : 400,
                        }}
                      >
                        {conv}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Dialog open={dlgResumo} onClose={() => !salvando && setDlgResumo(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Salvar padrão da rede</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>
            {resumo.alterados} SKU(s) — vale para todas as lojas com o mesmo código.
          </Typography>
          <Typography variant="body2">{resumo.entrando_contagem} entrando na contagem</Typography>
          <Typography variant="body2">{resumo.saindo_contagem} saindo da contagem</Typography>
          <Typography variant="body2">{resumo.caixa} mudanças em CAIXA</Typography>
          <Typography variant="body2">{resumo.pc_fd} mudanças em PC/FD</Typography>
          <Typography variant="body2">{resumo.kg_und} mudanças no campo fracionado</Typography>
          {resumo.diaria > 0 && (
            <Typography variant="body2">{resumo.diaria} mudanças na diária</Typography>
          )}
          {resumo.critica > 0 && (
            <Typography variant="body2">{resumo.critica} mudanças na crítica</Typography>
          )}
          {resumo.fracionada > 0 && (
            <Typography variant="body2">{resumo.fracionada} mudanças na unidade fracionada</Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: colors.textSecondary }}>
            O lote é aplicado numa transação. Se um SKU falhar, nada é gravado.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDlgResumo(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void confirmarSalvar()} disabled={salvando}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
