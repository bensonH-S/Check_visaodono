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
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import PageLoading from '../../components/PageLoading';
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
import { useAppTheme } from '../../context/ThemeContext';
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

function rotuloPeriodoCurto(p: MetasPeriodoResumo) {
  return `${MESES[p.mes]}/${p.ano}`;
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

function celulaSx(valor_texto: string | null, atingiu: boolean | null, escuro: boolean) {
  if (valor_texto === 'OK' || (atingiu === true && valor_texto !== 'X')) {
    return {
      bgcolor: escuro ? 'rgba(34, 197, 94, 0.18)' : 'rgba(22, 163, 74, 0.1)',
      fontWeight: 600,
      color: escuro ? '#86EFAC' : '#166534',
    };
  }
  if (valor_texto === 'X' || atingiu === false) {
    return {
      bgcolor: escuro ? 'rgba(251, 146, 60, 0.18)' : 'rgba(234, 88, 12, 0.1)',
      fontWeight: 600,
      color: escuro ? '#FDBA74' : '#9a3412',
    };
  }
  return {};
}

function subtotalRowSx(escuro: boolean) {
  return {
    bgcolor: escuro ? 'rgba(96, 165, 250, 0.14)' : 'rgba(59, 130, 246, 0.12)',
    '& td': {
      fontWeight: 700,
      color: escuro ? '#93C5FD' : '#1e3a8a',
      borderTop: `2px solid ${escuro ? 'rgba(96, 165, 250, 0.4)' : 'rgba(59, 130, 246, 0.35)'}`,
    },
  } as const;
}

function finalRowSx(escuro: boolean) {
  return {
    bgcolor: escuro ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.06)',
    outline: `2px dashed ${escuro ? 'rgba(74, 222, 128, 0.45)' : 'rgba(22, 163, 74, 0.45)'}`,
    outlineOffset: -2,
    '& td': {
      fontWeight: 700,
      color: escuro ? '#86EFAC' : '#166534',
      borderTop: `1px solid ${escuro ? 'rgba(74, 222, 128, 0.3)' : 'rgba(22, 163, 74, 0.25)'}`,
    },
  } as const;
}

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
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const stickyBg = colors.surface;
  const subtotalBg = escuro ? 'rgba(96, 165, 250, 0.14)' : 'rgba(59, 130, 246, 0.12)';
  const finalBg = escuro ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.06)';

  const valorPorLoja = useMemo(
    () => calcValorMetaPorLoja(painel, lojasRevReprovadas),
    [painel, lojasRevReprovadas],
  );

  const colDemandaSx = (idLoja: number) =>
    lojasRevReprovadas.has(idLoja)
      ? {
          bgcolor: escuro ? 'rgba(248, 113, 113, 0.18)' : 'rgba(220, 38, 38, 0.12)',
          color: escuro ? '#FCA5A5' : '#991b1b',
          fontWeight: 700,
        }
      : {};

  return (
    <Paper sx={{ ...tablePaperSx, mb: 2 }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${colors.border}` }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colors.textPrimary }}>
          {painel.titulo.replace(/\s*[—–―]\s*/g, ' - ')}
        </Typography>
        <Typography variant="caption" sx={{ color: colors.textSecondary }}>
          {painel.tipo === 'empresa' ? 'Metas da empresa por loja' : 'Metas dos gerentes por loja'}
        </Typography>
      </Box>
      <TableContainer sx={tableContainerSx}>
        <Table size="small" stickyHeader sx={tableSx}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 180, fontWeight: 700, bgcolor: stickyBg, position: 'sticky', left: 0, zIndex: 2 }}>
                Indicador
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, minWidth: 56, bgcolor: stickyBg, position: 'sticky', left: 180, zIndex: 2 }}>
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
                <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: stickyBg, zIndex: 1 }}>
                  {ind.nome}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, position: 'sticky', left: 180, bgcolor: stickyBg, zIndex: 1 }}>
                  {ind.peso}
                </TableCell>
                {ind.celulas.map((c) => {
                  const valorAtual = valorSelectResumo(c.valor_texto, c.atingiu);
                  return (
                    <TableCell
                      key={c.id_loja}
                      align="center"
                      sx={{
                        ...celulaSx(c.valor_texto, c.atingiu, escuro),
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
                            color: colors.textPrimary,
                            '& .MuiSelect-select': { py: 0.5, px: 0.75 },
                            bgcolor:
                              valorAtual === 'OK'
                                ? escuro
                                  ? 'rgba(34,197,94,0.18)'
                                  : 'rgba(22,163,74,0.12)'
                                : valorAtual === 'X'
                                  ? escuro
                                    ? 'rgba(251,146,60,0.18)'
                                    : 'rgba(234,88,12,0.12)'
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
            <TableRow sx={subtotalRowSx(escuro)}>
              <TableCell sx={{ position: 'sticky', left: 0, bgcolor: subtotalBg, zIndex: 1 }}>
                SUBTOTAL
              </TableCell>
              <TableCell align="center" sx={{ position: 'sticky', left: 180, bgcolor: subtotalBg, zIndex: 1 }}>
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
            <TableRow sx={finalRowSx(escuro)}>
              <TableCell sx={{ position: 'sticky', left: 0, bgcolor: finalBg, zIndex: 1 }}>
                FINAL
              </TableCell>
              <TableCell align="center" sx={{ position: 'sticky', left: 180, bgcolor: finalBg, zIndex: 1 }}>
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
  const { mode } = useAppTheme();
  const escuro = mode === 'dark';
  const acento = escuro ? '#E8520A' : colors.navy;
  const acentoHover = escuro ? '#c94508' : colors.navyDark;
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0, flex: 1 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={String(aba)}
          onChange={(_, v: string | null) => {
            if (v == null) return;
            (document.activeElement as HTMLElement | null)?.blur?.();
            setAba(Number(v));
          }}
          sx={{
            bgcolor: colors.surface,
            border: `1px solid ${colors.border}`,
            '& .MuiToggleButton-root': {
              px: 1.5,
              py: 0.4,
              minHeight: 32,
              fontWeight: 700,
              textTransform: 'none',
              border: 'none',
              fontSize: '0.8rem',
              color: colors.textSecondary,
            },
            '& .Mui-selected': {
              bgcolor: `${acento} !important`,
              color: '#fff !important',
              boxShadow: escuro ? '0 1px 4px rgba(0, 0, 0, 0.35)' : '0 1px 4px rgba(27, 42, 107, 0.22)',
            },
            '& .Mui-selected:hover': {
              bgcolor: `${acentoHover} !important`,
            },
          }}
        >
          <ToggleButton value="0">Resumo</ToggleButton>
          <ToggleButton value="1">Rankings</ToggleButton>
          <ToggleButton value="2">Prêmios</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {periodos.length > 0 && (
            <Select
              size="small"
              value={idPeriodo === '' ? '' : idPeriodo}
              onChange={(e) => setIdPeriodo(Number(e.target.value))}
              sx={{
                minWidth: 108,
                fontSize: '0.8rem',
                fontWeight: 700,
                bgcolor: colors.surface,
                '& .MuiSelect-select': { py: 0.65, px: 1.25 },
              }}
            >
              {periodos.map((p) => (
                <MenuItem key={p.id_periodo} value={p.id_periodo} sx={{ fontSize: '0.82rem' }}>
                  {rotuloPeriodoCurto(p)}
                </MenuItem>
              ))}
            </Select>
          )}
          {podeCriar && (
            <Tooltip title="Novo mês">
              <span>
                <IconButton
                  size="small"
                  onClick={abrirDialogNovo}
                  disabled={!periodos.length}
                  aria-label="Novo mês"
                  sx={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 1,
                    color: acento,
                    bgcolor: colors.surface,
                    '&:hover': {
                      borderColor: acento,
                      bgcolor: escuro ? 'rgba(232, 82, 10, 0.12)' : colors.navyMuted,
                    },
                  }}
                >
                  <AddIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {aba === 0 && dados ? (
            <Tooltip title={gerandoPdf ? 'Gerando…' : 'Gerar relatório PDF'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => void gerarRelatorio()}
                  disabled={gerandoPdf || !gruposResumo.length}
                  aria-label="Gerar relatório PDF"
                  sx={{
                    border: '1px solid transparent',
                    borderRadius: 1,
                    color: '#fff',
                    bgcolor: '#E8520A',
                    '&:hover': { bgcolor: '#c94508' },
                    '&.Mui-disabled': { bgcolor: 'rgba(232, 82, 10, 0.35)', color: '#fff' },
                  }}
                >
                  {gerandoPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
        </Box>
      </Box>

      {loading && !dados && <PageLoading />}

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
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setDialogNovo(false)}
            disabled={criando}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: colors.textSecondary,
              borderColor: colors.borderStrong,
              bgcolor: colors.surface,
              '&:hover': {
                borderColor: colors.borderStrong,
                bgcolor: colors.canvasAlt,
                color: colors.textPrimary,
              },
            }}
          >
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
            <Typography variant="body2" sx={{ color: colors.textSecondary, mb: 1.25 }}>
              As alterações nesta aba são salvas automaticamente ao sair do campo, pressionar Enter
              ou escolher uma opção na lista.
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            {dados.rankings.map((g, i) => {
              const ativo = rankingIdx === i;
              return (
                <Chip
                  key={g.codigo}
                  label={g.nome}
                  onClick={() => {
                    (document.activeElement as HTMLElement | null)?.blur?.();
                    setRankingIdx(i);
                  }}
                  variant={ativo ? 'filled' : 'outlined'}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    ...(ativo
                      ? {
                          bgcolor: acento,
                          color: '#fff',
                          border: '1px solid transparent',
                          '&:hover': { bgcolor: acentoHover },
                        }
                      : {
                          borderColor: colors.border,
                          color: colors.textPrimary,
                          bgcolor: colors.surface,
                          '&:hover': {
                            bgcolor: escuro ? 'rgba(232, 82, 10, 0.1)' : colors.navyMuted,
                            borderColor: acento,
                          },
                        }),
                  }}
                />
              );
            })}
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

    </Box>
  );
}
