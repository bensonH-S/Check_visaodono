import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import AddIcon from '@mui/icons-material/Add';
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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  api,
  type MetasPainel,
  type MetasPeriodoDetalhe,
  type MetasPeriodoResumo,
} from '../../api/client';
import { getUsuario, podeGerenciarMetas } from '../../lib/auth';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';
import { agruparPaineisResumo, calcValorMetaPorLoja, fmtMoedaMeta } from '../../components/metas/metasPageUtils';
import MetasRankingTable from '../../components/metas/MetasRankingTable';
import MetasPremiosTable from '../../components/metas/MetasPremiosTable';
import { lojasRevDemanda } from '../../components/metas/metasRankingUtils';
import { gerarPdfMetasResumo } from '../../utils/gerarPdfMetasResumo';

const MESES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_COMPLETOS = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function proximoMesDisponivel(periodos: MetasPeriodoResumo[]) {
  if (!periodos.length) {
    const agora = new Date();
    return { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
  }
  const ordenados = [...periodos].sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  const ultimo = ordenados[ordenados.length - 1];
  if (ultimo.mes >= 12) return { ano: ultimo.ano + 1, mes: 1 };
  return { ano: ultimo.ano, mes: ultimo.mes + 1 };
}

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
  if (valor_texto === 'OK' || (atingiu === true && valor_texto !== 'X')) {
    return {
      bgcolor: 'rgba(22, 163, 74, 0.1)',
      fontWeight: 600,
      color: '#166534',
    };
  }
  if (valor_texto === 'X' || atingiu === false) {
    return {
      bgcolor: 'rgba(234, 88, 12, 0.1)',
      fontWeight: 600,
      color: '#9a3412',
    };
  }
  return {};
}

const subtotalRowSx = {
  bgcolor: 'rgba(59, 130, 246, 0.12)',
  '& td': { fontWeight: 700, color: '#1e3a8a', borderTop: '2px solid rgba(59, 130, 246, 0.35)' },
} as const;

const finalRowSx = {
  bgcolor: 'rgba(22, 163, 74, 0.06)',
  outline: '2px dashed rgba(22, 163, 74, 0.45)',
  outlineOffset: -2,
  '& td': { fontWeight: 700, color: '#166534', borderTop: '1px solid rgba(22, 163, 74, 0.25)' },
} as const;

function PainelResumoTable({
  painel,
  podeEditar,
  lojasRevReprovadas,
  onAlterarCelula,
}: {
  painel: MetasPainel;
  podeEditar: boolean;
  lojasRevReprovadas: Set<number>;
  onAlterarCelula: (idIndicador: number, idLoja: number, valor: string) => void;
}) {
  const valorPorLoja = useMemo(
    () => calcValorMetaPorLoja(painel, lojasRevReprovadas),
    [painel, lojasRevReprovadas],
  );

  const colDemandaSx = (idLoja: number) =>
    lojasRevReprovadas.has(idLoja)
      ? { bgcolor: 'rgba(220, 38, 38, 0.12)', color: '#991b1b', fontWeight: 700 }
      : {};

  return (
    <Paper sx={{ ...tablePaperSx, mb: 2 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border}` }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {painel.titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {painel.tipo === 'empresa' ? 'Metas da empresa por loja' : 'Metas dos gerentes por loja'}
        </Typography>
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
                <TableCell
                  key={l.id_loja}
                  align="center"
                  sx={{ fontWeight: 700, minWidth: 72, whiteSpace: 'nowrap', ...colDemandaSx(l.id_loja) }}
                >
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
                      sx={{
                        ...celulaSx(c.valor_texto, c.atingiu),
                        ...colDemandaSx(c.id_loja),
                        fontSize: '0.8rem',
                        p: podeEditar ? 0.35 : undefined,
                      }}
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
                            bgcolor:
                              valorAtual === 'OK'
                                ? 'rgba(22,163,74,0.12)'
                                : valorAtual === 'X'
                                  ? 'rgba(234,88,12,0.12)'
                                  : 'transparent',
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
            <TableRow sx={subtotalRowSx}>
              <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'rgba(59, 130, 246, 0.12)', zIndex: 1 }}>
                SUBTOTAL
              </TableCell>
              <TableCell align="center" sx={{ position: 'sticky', left: 180, bgcolor: 'rgba(59, 130, 246, 0.12)', zIndex: 1 }}>
                {painel.subtotal_peso}
              </TableCell>
              {painel.lojas.map((l) => {
                const reprovada = lojasRevReprovadas.has(l.id_loja);
                const total = valorPorLoja.get(l.id_loja) ?? 0;
                return (
                  <TableCell key={l.id_loja} align="center" sx={colDemandaSx(l.id_loja)}>
                    {reprovada ? '—' : total > 0 ? total : '—'}
                  </TableCell>
                );
              })}
            </TableRow>
            <TableRow sx={finalRowSx}>
              <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'rgba(22, 163, 74, 0.06)', zIndex: 1 }}>
                FINAL
              </TableCell>
              <TableCell align="center" sx={{ position: 'sticky', left: 180, bgcolor: 'rgba(22, 163, 74, 0.06)', zIndex: 1 }}>
                {fmtMoedaMeta(painel.subtotal_peso)}
              </TableCell>
              {painel.lojas.map((l) => {
                const reprovada = lojasRevReprovadas.has(l.id_loja);
                const total = valorPorLoja.get(l.id_loja) ?? 0;
                return (
                  <TableCell key={l.id_loja} align="center" sx={colDemandaSx(l.id_loja)}>
                    {reprovada ? 'R$ —' : fmtMoedaMeta(total)}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

export default function MetasPage() {
  const sessao = getUsuario();
  const podeCriar = podeGerenciarMetas(sessao);
  const [periodos, setPeriodos] = useState<MetasPeriodoResumo[]>([]);
  const [idPeriodo, setIdPeriodo] = useState<number | ''>('');
  const [dados, setDados] = useState<MetasPeriodoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState(0);
  const [rankingIdx, setRankingIdx] = useState(0);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [dialogNovo, setDialogNovo] = useState(false);
  const [criando, setCriando] = useState(false);
  const [novoAno, setNovoAno] = useState(new Date().getFullYear());
  const [novoMes, setNovoMes] = useState(new Date().getMonth() + 1);

  const abrirDialogNovo = () => {
    const sugestao = proximoMesDisponivel(periodos);
    setNovoAno(sugestao.ano);
    setNovoMes(sugestao.mes);
    setDialogNovo(true);
  };

  const criarPeriodo = async () => {
    if (!novoAno || !novoMes) {
      showToast('Informe ano e mês', 'warning');
      return;
    }
    setCriando(true);
    try {
      const criado = await api.metasCriarPeriodo({
        ano: Number(novoAno),
        mes: Number(novoMes),
      });
      showToast(`${rotuloPeriodo(criado)} criado com valores zerados`, 'success');
      setDialogNovo(false);
      const lista = await api.metasPeriodos();
      setPeriodos(lista);
      setIdPeriodo(criado.id_periodo);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao criar período', 'error');
    } finally {
      setCriando(false);
    }
  };

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

  const gruposResumo = useMemo(() => agruparPaineisResumo(dados?.paineis ?? []), [dados]);
  const lojasRevReprovadas = useMemo(() => lojasRevDemanda(dados?.rankings ?? []), [dados]);
  const rankingAtual = dados?.rankings[rankingIdx] ?? null;

  const alterarCelulaResumo = useCallback(
    async (idPainel: number, idIndicador: number, idLoja: number, valor: string) => {
      if (!dados) return;
      const valor_texto = valor || null;
      const atingiu = valor === 'OK' ? true : valor === 'X' ? false : null;
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

  const gerarRelatorio = useCallback(async () => {
    if (!dados) return;
    setGerandoPdf(true);
    try {
      await gerarPdfMetasResumo(dados);
      showToast('Relatório PDF gerado', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao gerar relatório', 'error');
    } finally {
      setGerandoPdf(false);
    }
  }, [dados]);

  const salvarLinhaRanking = useCallback(
    async (
      idRanking: number,
      patch: {
        valor_numero?: number | null;
        valor_texto?: string | null;
        pontos?: number | null;
        classe?: string | null;
        destaque?: string | null;
        critico?: number | null;
      },
    ) => {
      if (!dados) return;
      try {
        await api.metasSalvarRanking({ id_ranking: idRanking, ...patch });
        setDados((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            rankings: prev.rankings.map((grupo) => ({
              ...grupo,
              linhas: grupo.linhas.map((linha) =>
                linha.id_ranking !== idRanking
                  ? linha
                  : {
                      ...linha,
                      valor_numero: patch.valor_numero !== undefined ? patch.valor_numero : linha.valor_numero,
                      valor_texto: patch.valor_texto !== undefined ? patch.valor_texto : linha.valor_texto,
                      pontos: patch.pontos !== undefined ? patch.pontos : linha.pontos,
                      classe: patch.classe !== undefined ? patch.classe : linha.classe,
                      destaque: patch.destaque !== undefined ? patch.destaque : linha.destaque,
                      critico: patch.critico !== undefined ? patch.critico : linha.critico,
                    },
              ),
            })),
          };
        });
        showToast('Ranking salvo', 'success', { toastId: 'metas-ranking-salvo' });
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Erro ao salvar ranking', 'error');
      }
    },
    [dados],
  );

  const salvarLinhaPremio = useCallback(
    async (idPremio: number, patch: { premio_saude?: number; premio_rev?: number }) => {
      try {
        const atualizado = await api.metasSalvarPremio({ id_premio: idPremio, ...patch });
        setDados((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            premios: prev.premios.map((p) => (p.id_premio === idPremio ? { ...p, ...atualizado } : p)),
          };
        });
        showToast('Prêmio salvo', 'success', { toastId: 'metas-premio-salvo' });
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Erro ao salvar prêmio', 'error');
      }
    },
    [],
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
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
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
            {podeCriar && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={abrirDialogNovo}
                disabled={!periodos.length}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderColor: colors.navy,
                  color: colors.navy,
                  '&:hover': { borderColor: colors.navyDark, bgcolor: colors.navyMuted },
                }}
              >
                Novo mês
              </Button>
            )}
          </Box>
        </Box>
        <Tabs
          value={aba}
          onChange={(_, v) => {
            (document.activeElement as HTMLElement | null)?.blur?.();
            setAba(v);
          }}
          sx={{ mt: 2, minHeight: 40 }}
        >
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

      <Dialog open={dialogNovo} onClose={() => !criando && setDialogNovo(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Criar novo mês</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Cria o mês com a mesma estrutura e tudo zerado para lançar.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Mês</InputLabel>
              <Select
                label="Mês"
                value={novoMes}
                onChange={(e) => setNovoMes(Number(e.target.value))}
              >
                {MESES_COMPLETOS.slice(1).map((nome, idx) => (
                  <MenuItem key={nome} value={idx + 1}>
                    {nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Ano"
              type="number"
              value={novoAno}
              onChange={(e) => setNovoAno(Number(e.target.value))}
              slotProps={{ htmlInput: { min: 2020, max: 2100 } }}
              sx={{ width: 120 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogNovo(false)} disabled={criando} sx={{ textTransform: 'none' }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void criarPeriodo()}
            disabled={criando}
            startIcon={criando ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              bgcolor: colors.orange,
              '&:hover': { bgcolor: colors.orangeHover },
            }}
          >
            {criando ? 'Criando…' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {!loading && dados && aba === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              size="small"
              startIcon={gerandoPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
              onClick={() => void gerarRelatorio()}
              disabled={gerandoPdf || !gruposResumo.length}
              sx={{
                bgcolor: '#E8520A',
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: '#c94508' },
                '&.Mui-disabled': { bgcolor: 'rgba(232, 82, 10, 0.35)', color: '#fff' },
              }}
            >
              {gerandoPdf ? 'Gerando…' : 'Gerar relatório'}
            </Button>
          </Box>
          {gruposResumo.map((grupo) => (
            <Box key={grupo.grupo}>
              {grupo.empresa && (
                <PainelResumoTable
                  painel={grupo.empresa}
                  podeEditar={!!dados.pode_editar}
                  lojasRevReprovadas={lojasRevReprovadas}
                  onAlterarCelula={(idInd, idLoja, valor) =>
                    void alterarCelulaResumo(grupo.empresa!.id_painel, idInd, idLoja, valor)
                  }
                />
              )}
              {grupo.gestor && (
                <PainelResumoTable
                  painel={grupo.gestor}
                  podeEditar={!!dados.pode_editar}
                  lojasRevReprovadas={lojasRevReprovadas}
                  onAlterarCelula={(idInd, idLoja, valor) =>
                    void alterarCelulaResumo(grupo.gestor!.id_painel, idInd, idLoja, valor)
                  }
                />
              )}
            </Box>
          ))}
          {!gruposResumo.length && (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: `1px solid ${colors.border}` }}>
              <Typography color="text.secondary">Nenhum painel de resumo neste período.</Typography>
            </Paper>
          )}
        </Box>
      )}

      {!loading && dados && aba === 1 && (
        <Box>
          {dados.pode_editar && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
              Qualquer alteração nesta aba é salva automaticamente — ao sair do campo, pressionar Enter
              ou selecionar uma opção na lista.
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            {dados.rankings.map((g, i) => (
              <Chip
                key={g.codigo}
                label={g.nome}
                onClick={() => {
                  (document.activeElement as HTMLElement | null)?.blur?.();
                  setRankingIdx(i);
                }}
                color={rankingIdx === i ? 'primary' : 'default'}
                variant={rankingIdx === i ? 'filled' : 'outlined'}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Box>
          {rankingAtual ? (
            <MetasRankingTable
              grupo={rankingAtual}
              podeEditar={!!dados.pode_editar}
              onSalvarLinha={salvarLinhaRanking}
            />
          ) : null}
        </Box>
      )}

      {!loading && dados && aba === 2 && (
        <MetasPremiosTable
          premios={dados.premios}
          podeEditar={!!dados.pode_editar}
          onSalvar={salvarLinhaPremio}
        />
      )}

      {loading && !dados && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}
