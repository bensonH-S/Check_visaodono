import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
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
import Typography from '@mui/material/Typography';
import {
  api,
  type MetasPainel,
  type MetasPeriodoDetalhe,
  type MetasPeriodoResumo,
  type MetasRankingGrupo,
} from '../../api/client';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const OPCOES_STATUS_RESUMO = [
  { value: '', label: '—' },
  { value: 'X', label: 'X' },
  { value: 'OK', label: 'OK' },
] as const;

function valorSelectResumo(valor_texto: string | null, atingiu: boolean | null): string {
  if (valor_texto === 'X' || valor_texto === 'OK') return valor_texto;
  if (atingiu === true && !valor_texto) return 'OK';
  return '';
}

function rotuloPeriodo(p: MetasPeriodoResumo) {
  return p.titulo || `${MESES[p.mes]}/${p.ano}`;
}

function fmtValorCelula(valor_texto: string | null, valor_numero: number | null, atingiu: boolean | null) {
  if (valor_texto) return valor_texto;
  if (valor_numero != null) {
    if (valor_numero > 0 && valor_numero < 1) return valor_numero.toFixed(2).replace('.', ',');
    return String(valor_numero);
  }
  if (atingiu === true) return 'OK';
  if (atingiu === false) return '—';
  return '—';
}

function celulaSx(valor_texto: string | null, atingiu: boolean | null) {
  const ok = atingiu === true || valor_texto === 'X' || valor_texto === 'OK';
  if (!ok && !valor_texto && atingiu == null) return {};
  return {
    bgcolor: ok ? 'rgba(22, 163, 74, 0.1)' : 'rgba(234, 88, 12, 0.08)',
    fontWeight: 600,
    color: ok ? '#166534' : colors.textPrimary,
  };
}

function PainelResumoTable({
  painel,
  podeEditar,
  onAlterarCelula,
}: {
  painel: MetasPainel;
  podeEditar: boolean;
  onAlterarCelula: (idIndicador: number, idLoja: number, valor: string) => void;
}) {
  return (
    <Paper sx={{ ...tablePaperSx, mb: 2 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {painel.titulo}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {painel.tipo === 'empresa' ? 'Metas da empresa por loja' : 'Metas do gestor por loja'}
          </Typography>
        </Box>
        <Chip size="small" label={`Subtotal: ${painel.subtotal_peso} pts`} sx={{ fontWeight: 700 }} />
      </Box>
      <TableContainer sx={tableContainerSx}>
        <Table size="small" stickyHeader sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 180, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: 0, zIndex: 2 }}>
                Indicador
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, minWidth: 56, bgcolor: '#fff', position: 'sticky', left: 180, zIndex: 2 }}>
                Peso
              </TableCell>
              {painel.lojas.map((l) => (
                <TableCell key={l.id_loja} align="center" sx={{ fontWeight: 700, minWidth: 72, whiteSpace: 'nowrap' }}>
                  {l.rotulo_curto || l.nome_loja}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {painel.indicadores.map((ind) => (
              <TableRow key={ind.id_indicador} hover>
                <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: '#fff', zIndex: 1 }}>
                  {ind.nome}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, position: 'sticky', left: 180, bgcolor: '#fff', zIndex: 1 }}>
                  {ind.peso}
                </TableCell>
                {ind.celulas.map((c) => {
                  const valorAtual = valorSelectResumo(c.valor_texto, c.atingiu);
                  return (
                    <TableCell
                      key={c.id_loja}
                      align="center"
                      sx={{ ...celulaSx(c.valor_texto, c.atingiu), fontSize: '0.8rem', p: podeEditar ? 0.35 : undefined }}
                    >
                      {podeEditar ? (
                        <Select
                          size="small"
                          value={valorAtual}
                          onChange={(e) => onAlterarCelula(ind.id_indicador, c.id_loja, String(e.target.value))}
                          displayEmpty
                          sx={{
                            minWidth: 58,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            '& .MuiSelect-select': { py: 0.5, px: 0.75 },
                            bgcolor: valorAtual ? `${valorAtual === 'X' || valorAtual === 'OK' ? 'rgba(22,163,74,0.12)' : 'transparent'}` : 'transparent',
                          }}
                        >
                          {OPCOES_STATUS_RESUMO.map((op) => (
                            <MenuItem key={op.value || 'vazio'} value={op.value} sx={{ fontSize: '0.82rem' }}>
                              {op.label}
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        fmtValorCelula(c.valor_texto, c.valor_numero, c.atingiu)
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function RankingTable({ grupo }: { grupo: MetasRankingGrupo }) {
  return (
    <Paper sx={{ ...tablePaperSx, mb: 2 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border}` }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {grupo.nome}
        </Typography>
        {grupo.meta_minima != null && (
          <Typography variant="caption" color="text.secondary">
            Meta mínima: {grupo.meta_minima}
          </Typography>
        )}
      </Box>
      <TableContainer sx={tableContainerSx}>
        <Table size="small" sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 48 }}>Pos</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Loja</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>BKN</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Valor</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700 }}>Pts</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Classe</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {grupo.linhas.map((linha, idx) => (
              <TableRow key={`${linha.id_loja ?? 'x'}-${idx}`} hover>
                <TableCell>{linha.posicao ?? '—'}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{linha.nome_loja || linha.valor_texto || '—'}</TableCell>
                <TableCell>{linha.bk_number || '—'}</TableCell>
                <TableCell align="right">
                  {linha.valor_texto ?? (linha.valor_numero != null ? linha.valor_numero : '—')}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>
                  {linha.pontos ?? '—'}
                </TableCell>
                <TableCell>{linha.classe || '—'}</TableCell>
              </TableRow>
            ))}
            {!grupo.linhas.length && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">Sem dados neste ranking.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default function MetasPage() {
  const [periodos, setPeriodos] = useState<MetasPeriodoResumo[]>([]);
  const [idPeriodo, setIdPeriodo] = useState<number | ''>('');
  const [dados, setDados] = useState<MetasPeriodoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState(0);
  const [rankingIdx, setRankingIdx] = useState(0);

  const carregarPeriodos = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await api.metasPeriodos();
      setPeriodos(lista);
      if (lista.length) setIdPeriodo((atual) => (atual === '' ? lista[0].id_periodo : atual));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar períodos', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarPeriodo = useCallback(async () => {
    if (idPeriodo === '') return;
    setLoading(true);
    try {
      const data = await api.metasPeriodo(idPeriodo);
      setDados(data);
      setRankingIdx(0);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar metas', 'error');
    } finally {
      setLoading(false);
    }
  }, [idPeriodo]);

  useEffect(() => {
    void carregarPeriodos();
  }, [carregarPeriodos]);

  useEffect(() => {
    void carregarPeriodo();
  }, [carregarPeriodo]);

  const paineisEmpresa = useMemo(() => dados?.paineis.filter((p) => p.tipo === 'empresa') ?? [], [dados]);
  const paineisGestor = useMemo(() => dados?.paineis.filter((p) => p.tipo === 'gestor') ?? [], [dados]);
  const rankingAtual = dados?.rankings[rankingIdx] ?? null;

  const alterarCelulaResumo = useCallback(
    async (idPainel: number, idIndicador: number, idLoja: number, valor: string) => {
      if (!dados) return;
      const valor_texto = valor || null;
      const atingiu = valor === 'X' || valor === 'OK' ? true : null;
      try {
        await api.metasSalvarRealizado({
          id_painel: idPainel,
          id_indicador: idIndicador,
          id_loja: idLoja,
          valor_texto,
          valor_numero: null,
          atingiu,
        });
        setDados((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            paineis: prev.paineis.map((p) =>
              p.id_painel !== idPainel
                ? p
                : {
                    ...p,
                    indicadores: p.indicadores.map((ind) =>
                      ind.id_indicador !== idIndicador
                        ? ind
                        : {
                            ...ind,
                            celulas: ind.celulas.map((c) =>
                              c.id_loja !== idLoja
                                ? c
                                : { ...c, valor_texto, valor_numero: null, atingiu },
                            ),
                          },
                    ),
                  },
            ),
          };
        });
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
      }
    },
    [dados],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, flex: 1 }}>
      <Paper sx={{ p: 2, borderRadius: 2, border: `1px solid ${colors.border}` }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
              Metas
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Indicadores da empresa, gestores e rankings — espelho da planilha de metas
            </Typography>
          </Box>
          {periodos.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Período</InputLabel>
              <Select
                label="Período"
                value={idPeriodo === '' ? '' : idPeriodo}
                onChange={(e) => setIdPeriodo(Number(e.target.value))}
              >
                {periodos.map((p) => (
                  <MenuItem key={p.id_periodo} value={p.id_periodo}>
                    {rotuloPeriodo(p)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        <Tabs value={aba} onChange={(_, v) => setAba(v)} sx={{ mt: 2, minHeight: 40 }}>
          <Tab label="Resumo" sx={{ minHeight: 40, py: 0 }} />
          <Tab label="Rankings" sx={{ minHeight: 40, py: 0 }} />
          <Tab label="Prêmios" sx={{ minHeight: 40, py: 0 }} />
        </Tabs>
      </Paper>

      {loading && <LinearProgress />}

      {!loading && !periodos.length ? (
        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: `1px solid ${colors.border}` }}>
          <Typography color="text.secondary">
            Nenhum período de metas cadastrado. Execute a migration e o seed da planilha.
          </Typography>
        </Paper>
      ) : null}

      {!loading && dados && aba === 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Empresa
          </Typography>
          {paineisEmpresa.map((p) => (
            <PainelResumoTable
              key={p.id_painel}
              painel={p}
              podeEditar={!!dados.pode_editar}
              onAlterarCelula={(idInd, idLoja, valor) => void alterarCelulaResumo(p.id_painel, idInd, idLoja, valor)}
            />
          ))}
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, mt: 1 }}>
            Gestores
          </Typography>
          {paineisGestor.map((p) => (
            <PainelResumoTable
              key={p.id_painel}
              painel={p}
              podeEditar={!!dados.pode_editar}
              onAlterarCelula={(idInd, idLoja, valor) => void alterarCelulaResumo(p.id_painel, idInd, idLoja, valor)}
            />
          ))}
        </Box>
      )}

      {!loading && dados && aba === 1 && (
        <Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            {dados.rankings.map((g, i) => (
              <Chip
                key={g.codigo}
                label={g.nome}
                onClick={() => setRankingIdx(i)}
                color={rankingIdx === i ? 'primary' : 'default'}
                variant={rankingIdx === i ? 'filled' : 'outlined'}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Box>
          {rankingAtual ? <RankingTable grupo={rankingAtual} /> : null}
        </Box>
      )}

      {!loading && dados && aba === 2 && (
        <Paper sx={{ ...tablePaperSx }}>
          <TableContainer sx={tableContainerSx}>
            <Table size="small" sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Colaborador</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Saúde</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>R.E.V.</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Valor</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Subtotal</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dados.premios.map((p) => (
                  <TableRow key={p.id_premio} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{p.nome}</TableCell>
                    <TableCell align="center">{p.premio_saude ?? '—'}</TableCell>
                    <TableCell align="center">{p.premio_rev ?? '—'}</TableCell>
                    <TableCell align="right">
                      {p.valor_unitario != null ? p.valor_unitario.toLocaleString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {p.subtotal != null ? p.subtotal.toLocaleString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {p.total != null ? p.total.toLocaleString('pt-BR') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!dados.premios.length && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">Nenhum prêmio cadastrado neste período.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {loading && !dados && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}
