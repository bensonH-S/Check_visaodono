import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SaveIcon from '@mui/icons-material/Save';
import { api, type EscalaVisitasGrade, type EscalaVisitasLinha } from '../../api/client';
import { podeGerenciarEscalaVisitas } from '../../lib/auth';
import { showToast } from '../../utils/toast';
import { tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';
import { atribuicoesDoDia, idsLojasDestinoDoDia, idsRegionaisDoDia, linhaDeliveryDaGrade } from '../../components/escalas/escalaVisitasModel';
import { agruparRegionaisEscala, primeiroNome } from '../../components/escalas/escalaVisitasUtils';

const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
/** Roxo da planilha Time de Campo para célula multi (ex.: I/R). */
const COR_ESCALA_MULTI = '#7030A0';
const COL_DIA_MIN_WIDTH = 108;
const COL_LOJA_MIN_WIDTH = 200;
const COL_BKN_WIDTH = 72;
const SELECT_CELULA_SX = {
  width: '100%',
  maxWidth: 132,
  fontSize: '0.72rem',
  '& .MuiSelect-select': { py: 0.75, whiteSpace: 'normal', lineHeight: 1.25 },
} as const;

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function segundaFeiraAtual() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function fmtDataCurta(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

type CelulaChave = string;
type PendingCelula =
  | { id_loja: number; dia: number; id_regionais: number[] }
  | { id_loja: number; dia: number; id_lojas_destino: number[] };
type PendingMap = Map<CelulaChave, PendingCelula>;

function chaveCelula(idLoja: number, dia: number) {
  return `${idLoja}-${dia}`;
}

export default function EscalaVisitasPage() {
  const [semanaInicio, setSemanaInicio] = useState(segundaFeiraAtual());
  const [idRegiao, setIdRegiao] = useState<number | ''>('');
  const [grade, setGrade] = useState<EscalaVisitasGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [pending, setPending] = useState<PendingMap>(new Map());
  const [aba, setAba] = useState<'visitas' | 'delivery'>('visitas');
  const podeEditar = podeGerenciarEscalaVisitas();

  const mapCorRegional = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of grade?.regionais ?? []) m.set(r.id_usuario, r.cor);
    for (const linha of grade?.linhas ?? []) {
      for (const d of linha.dias) {
        for (const a of atribuicoesDoDia(d)) {
          if (a.id_regional != null && a.cor) m.set(a.id_regional, a.cor);
        }
      }
    }
    return m;
  }, [grade?.regionais, grade?.linhas]);

  const mapNomeRegional = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of grade?.regionais ?? []) m.set(r.id_usuario, r.nome);
    for (const linha of grade?.linhas ?? []) {
      for (const d of linha.dias) {
        for (const a of atribuicoesDoDia(d)) {
          if (a.id_regional != null && a.nome_regional) m.set(a.id_regional, a.nome_regional);
        }
      }
    }
    return m;
  }, [grade?.regionais, grade?.linhas]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ semana_inicio: semanaInicio });
      if (idRegiao !== '') q.set('id_regiao', String(idRegiao));
      const data = await api.escalaVisitasSemana(q.toString());
      setGrade(data);
      setPending(new Map());
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao carregar escala', 'error');
    } finally {
      setLoading(false);
    }
  }, [semanaInicio, idRegiao]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function alterarCelulaRegional(idLoja: number, dia: number, idRegionais: number[]) {
    if (!podeEditar) return;
    setPending((prev) => {
      const next = new Map(prev);
      next.set(chaveCelula(idLoja, dia), { id_loja: idLoja, dia, id_regionais: idRegionais });
      return next;
    });
  }

  function alterarCelulaDelivery(idLoja: number, dia: number, idLojasDestino: number[]) {
    if (!podeEditar) return;
    setPending((prev) => {
      const next = new Map(prev);
      next.set(chaveCelula(idLoja, dia), { id_loja: idLoja, dia, id_lojas_destino: idLojasDestino });
      return next;
    });
  }

  function toggleLojaDelivery(dia: number, idLojaDestino: number) {
    const linhaDelivery = linhaDeliveryDaGrade(grade?.linhas);
    if (!linhaDelivery) return;
    const atual = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]);
    const next = atual.includes(idLojaDestino)
      ? atual.filter((id) => id !== idLojaDestino)
      : [...atual, idLojaDestino];
    alterarCelulaDelivery(linhaDelivery.id_loja, dia, next);
  }

  function toggleDiaDeliveryInteiro(dia: number) {
    const linhaDelivery = linhaDeliveryDaGrade(grade?.linhas);
    const lojas = grade?.lojas_destino ?? [];
    if (!linhaDelivery || !lojas.length) return;
    const atual = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]);
    const todasMarcadas = lojas.every((l) => atual.includes(l.id_loja));
    alterarCelulaDelivery(
      linhaDelivery.id_loja,
      dia,
      todasMarcadas ? [] : lojas.map((l) => l.id_loja),
    );
  }

  function valorCelulaRegional(idLoja: number, dia: number, original: EscalaVisitasLinha['dias'][number]) {
    const p = pending.get(chaveCelula(idLoja, dia));
    if (p && 'id_regionais' in p) return p.id_regionais;
    return idsRegionaisDoDia(original);
  }

  function valorCelulaDelivery(idLoja: number, dia: number, original: EscalaVisitasLinha['dias'][number]) {
    const p = pending.get(chaveCelula(idLoja, dia));
    if (p && 'id_lojas_destino' in p) return p.id_lojas_destino;
    return idsLojasDestinoDoDia(original);
  }

  async function salvar() {
    if (!pending.size) {
      showToast('Nada para salvar', 'info');
      return;
    }
    setSalvando(true);
    try {
      const q = new URLSearchParams({ semana_inicio: semanaInicio });
      if (idRegiao !== '') q.set('id_regiao', String(idRegiao));
      const data = await api.escalaVisitasSalvar({
        semana_inicio: semanaInicio,
        id_regiao: idRegiao === '' ? null : idRegiao,
        celulas: [...pending.values()],
      });
      setGrade(data);
      setPending(new Map());
      showToast('Escala salva', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao salvar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function copiarSemanaAnterior() {
    const origem = addDaysIso(semanaInicio, -7);
    setSalvando(true);
    try {
      const data = await api.escalaVisitasCopiar({ de: origem, para: semanaInicio });
      setGrade(data);
      setPending(new Map());
      showToast(`Copiado de ${fmtDataCurta(origem)}`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao copiar', 'error');
    } finally {
      setSalvando(false);
    }
  }

  const linhasComTotais = useMemo(() => {
    if (!grade) return [];
    return grade.linhas.map((linha: EscalaVisitasLinha) => {
      let total = 0;
      const ehDelivery = linha.tipo === 'delivery';
      const dias = linha.dias.map((d) => {
        const idsEfetivo = ehDelivery
          ? valorCelulaDelivery(linha.id_loja, d.dia, d)
          : valorCelulaRegional(linha.id_loja, d.dia, d);
        total += idsEfetivo.length;
        return ehDelivery
          ? { ...d, ids_loja_destino_efetivo: idsEfetivo }
          : { ...d, ids_regional_efetivo: idsEfetivo };
      });
      return { ...linha, dias, total_visitas_efetivo: total };
    });
  }, [grade, pending]);

  const linhasVisitasComTotais = useMemo(
    () => linhasComTotais.filter((linha) => linha.tipo !== 'delivery'),
    [linhasComTotais],
  );

  const linhaDelivery = useMemo(() => linhaDeliveryDaGrade(grade?.linhas), [grade?.linhas]);

  const lojasDelivery = grade?.lojas_destino ?? [];

  const deliveryLinhas = useMemo(() => {
    if (!linhaDelivery) return [];
    return lojasDelivery.map((loja) => {
      let total = 0;
      const dias = DIAS.map((_, dia) => {
        const marcada = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]).includes(loja.id_loja);
        if (marcada) total += 1;
        return { dia, marcada };
      });
      return { ...loja, dias, total };
    });
  }, [linhaDelivery, lojasDelivery, grade, pending]);

  const regionaisAgrupados = useMemo(
    () => agruparRegionaisEscala(grade?.regionais ?? []),
    [grade?.regionais],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minHeight: 0,
        flex: 1,
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Paper sx={{ px: 1.25, py: 1, borderRadius: 2, border: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <IconButton size="small" onClick={() => setSemanaInicio(addDaysIso(semanaInicio, -7))} aria-label="Semana anterior">
              <ChevronLeftIcon />
            </IconButton>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.15 }}>
                Semana {grade?.semana_label ?? fmtDataCurta(semanaInicio)}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setSemanaInicio(addDaysIso(semanaInicio, 7))} aria-label="Próxima semana">
              <ChevronRightIcon />
            </IconButton>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={aba}
              onChange={(_, v: 'visitas' | 'delivery' | null) => {
                if (v) setAba(v);
              }}
              sx={{
                ml: { sm: 0.5 },
                bgcolor: colors.canvasAlt,
                '& .MuiToggleButton-root': {
                  px: 1.75,
                  py: 0.45,
                  fontWeight: 700,
                  textTransform: 'none',
                  border: 'none',
                  fontSize: '0.82rem',
                },
                '& .Mui-selected': {
                  bgcolor: aba === 'delivery' ? 'rgba(232, 82, 10, 0.14)' : '#fff',
                  color: aba === 'delivery' ? colors.orange : colors.navy,
                  boxShadow: '0 1px 4px rgba(27, 42, 107, 0.12)',
                },
              }}
            >
              <ToggleButton value="visitas">Visitas</ToggleButton>
              <ToggleButton value="delivery">Delivery</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            {grade && grade.regioes.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Região</InputLabel>
                <Select
                  label="Região"
                  value={idRegiao === '' ? '' : idRegiao}
                  onChange={(e) => {
                    const v = e.target.value;
                    setIdRegiao(String(v) === '' ? '' : Number(v));
                  }}
                >
                  <MenuItem value="">
                    Todas as lojas
                  </MenuItem>
                  {grade.regioes.map((r: { id_regiao: number; nome: string }) => (
                    <MenuItem key={r.id_regiao} value={r.id_regiao}>
                      {r.nome}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {podeEditar && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  disabled={salvando}
                  onClick={() => void copiarSemanaAnterior()}
                >
                  Copiar semana anterior
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<SaveIcon />}
                  disabled={salvando || pending.size === 0}
                  onClick={() => void salvar()}
                >
                  Salvar{pending.size > 0 ? ` (${pending.size})` : ''}
                </Button>
              </>
            )}
          </Box>
        </Box>

        {grade && grade.regionais.length > 0 && aba === 'visitas' && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
            {regionaisAgrupados.flatMap((grupo, indexGrupo) => {
              const bloco: ReactNode[] = [];
              if (indexGrupo > 0) {
                bloco.push(
                  <Box
                    key={`sep-${indexGrupo}`}
                    aria-hidden
                    sx={{
                      width: '1px',
                      height: 18,
                      bgcolor: 'rgba(27, 42, 107, 0.16)',
                      alignSelf: 'center',
                      mx: 0.25,
                      flexShrink: 0,
                    }}
                  />,
                );
              }
              for (const r of grupo.items) {
                bloco.push(
                  <Chip
                    key={r.id_usuario}
                    size="small"
                    label={primeiroNome(r.nome)}
                    title={r.nome}
                    sx={{
                      bgcolor: `${r.cor}22`,
                      border: `1px solid ${r.cor}`,
                      fontWeight: 600,
                      '& .MuiChip-label': { color: colors.textPrimary },
                    }}
                  />,
                );
              }
              return bloco;
            })}
          </Box>
        )}
      </Paper>

      {(loading || salvando) && <LinearProgress />}

      {loading && !grade ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6, flex: 1 }}>
          <CircularProgress />
        </Box>
      ) : aba === 'delivery' ? (
        <Paper
          sx={{
            ...tablePaperSx,
            flex: 1,
            minHeight: { xs: 560, md: 0 },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {!linhaDelivery ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">Linha de delivery não configurada.</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
              <Table size="small" stickyHeader sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: COL_BKN_WIDTH, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: 0, zIndex: 3 }}>
                      BKN
                    </TableCell>
                    <TableCell sx={{ minWidth: COL_LOJA_MIN_WIDTH, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: COL_BKN_WIDTH, zIndex: 3 }}>
                      Loja
                    </TableCell>
                    {DIAS.map((label, dia) => {
                      const idsDia = valorCelulaDelivery(linhaDelivery.id_loja, dia, linhaDelivery.dias[dia]);
                      const todas = lojasDelivery.length > 0 && idsDia.length === lojasDelivery.length;
                      return (
                        <TableCell key={label} align="center" sx={{ minWidth: COL_DIA_MIN_WIDTH, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: colors.orange }}>
                            {label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {fmtDataCurta(addDaysIso(semanaInicio, dia))}
                          </Typography>
                          {podeEditar && lojasDelivery.length > 0 && (
                            <Button
                              size="small"
                              onClick={() => toggleDiaDeliveryInteiro(dia)}
                              sx={{
                                mt: 0.35,
                                minWidth: 0,
                                px: 0.75,
                                py: 0.15,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                textTransform: 'none',
                                color: todas ? colors.orange : 'text.secondary',
                              }}
                            >
                              {todas ? 'Limpar' : 'Todas'}
                            </Button>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ fontWeight: 700, minWidth: 48 }}>
                      DIAS
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deliveryLinhas.map((linha) => (
                    <TableRow key={linha.id_loja} hover>
                      <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: '#fff', zIndex: 1 }}>
                        {linha.bk_number || '—'}
                      </TableCell>
                      <TableCell sx={{ position: 'sticky', left: COL_BKN_WIDTH, bgcolor: '#fff', zIndex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={linha.nome}>
                          {linha.nome}
                        </Typography>
                      </TableCell>
                      {linha.dias.map((d) => (
                        <TableCell key={d.dia} align="center" sx={{ p: 0.5 }}>
                          <Checkbox
                            size="medium"
                            checked={d.marcada}
                            disabled={!podeEditar}
                            onChange={() => toggleLojaDelivery(d.dia, linha.id_loja)}
                            sx={{
                              p: 0.5,
                              color: colors.orange,
                              '&.Mui-checked': { color: colors.orange },
                            }}
                          />
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                        {linha.total}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!deliveryLinhas.length && (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">Nenhuma loja neste filtro.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      ) : (
        <Paper
          sx={{
            ...tablePaperSx,
            flex: 1,
            minHeight: { xs: 560, md: 0 },
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: COL_BKN_WIDTH, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: 0, zIndex: 3 }}>
                    BKN
                  </TableCell>
                  <TableCell sx={{ minWidth: COL_LOJA_MIN_WIDTH, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: COL_BKN_WIDTH, zIndex: 3 }}>
                    Loja
                  </TableCell>
                  {DIAS.map((label, i) => (
                    <TableCell key={label} align="center" sx={{ minWidth: COL_DIA_MIN_WIDTH, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                        {label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {fmtDataCurta(addDaysIso(semanaInicio, i))}
                      </Typography>
                    </TableCell>
                  ))}
                  <TableCell align="center" sx={{ fontWeight: 700, minWidth: 48 }}>
                    VIS
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {linhasVisitasComTotais.map((linha) => (
                  <TableRow key={linha.id_loja} hover>
                    <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: '#fff', zIndex: 1 }}>
                      {linha.bk_number || '—'}
                    </TableCell>
                    <TableCell sx={{ position: 'sticky', left: COL_BKN_WIDTH, bgcolor: '#fff', zIndex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={linha.nome}>
                        {linha.nome}
                      </Typography>
                      {linha.nome_regiao && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {linha.nome_regiao}
                        </Typography>
                      )}
                    </TableCell>
                    {linha.dias.map((d) => {
                      const idsReg = 'ids_regional_efetivo' in d ? d.ids_regional_efetivo : [];
                      const nomes = idsReg
                        .map((id) => mapNomeRegional.get(id))
                        .filter(Boolean)
                        .map((n) => primeiroNome(n!));
                      const tooltip = nomes.length ? nomes.join(', ') : 'Sem visita';
                      const cor = idsReg.length === 1 ? mapCorRegional.get(idsReg[0]) || '#64748B' : undefined;
                      return (
                        <TableCell key={d.dia} align="center" sx={{ p: 0.5, verticalAlign: 'top' }}>
                          {podeEditar ? (
                            <Select
                              multiple
                              size="small"
                              displayEmpty
                              value={idsReg}
                              input={<OutlinedInput />}
                              onChange={(e) => {
                                const v = e.target.value;
                                const lista = typeof v === 'string' ? v.split(',').map(Number) : (v as number[]);
                                alterarCelulaRegional(linha.id_loja, d.dia, lista);
                              }}
                              renderValue={(selected) => {
                                const ids = selected as number[];
                                if (!ids.length) return '—';
                                return ids
                                  .map((id) => primeiroNome(mapNomeRegional.get(id) ?? ''))
                                  .filter(Boolean)
                                  .join(', ');
                              }}
                              sx={{
                                ...SELECT_CELULA_SX,
                                bgcolor: cor
                                  ? `${cor}33`
                                  : idsReg.length > 1
                                    ? `${COR_ESCALA_MULTI}33`
                                    : undefined,
                              }}
                            >
                              {(grade?.regionais ?? []).map((r) => (
                                <MenuItem key={r.id_usuario} value={r.id_usuario} sx={{ py: 0.35 }}>
                                  <Checkbox
                                    size="small"
                                    checked={idsReg.includes(r.id_usuario)}
                                    sx={{ py: 0, mr: 0.5 }}
                                  />
                                  <ListItemText
                                    primary={r.nome}
                                    slotProps={{ primary: { sx: { fontSize: '0.82rem' } } }}
                                  />
                                </MenuItem>
                              ))}
                            </Select>
                          ) : (
                            <Tooltip title={tooltip}>
                              <Box
                                sx={{
                                  py: 0.65,
                                  px: 0.5,
                                  borderRadius: 1,
                                  bgcolor: cor
                                    ? `${cor}44`
                                    : idsReg.length
                                      ? `${COR_ESCALA_MULTI}33`
                                      : 'transparent',
                                  border: idsReg.length
                                    ? `1px solid ${cor ?? COR_ESCALA_MULTI}`
                                    : '1px dashed #e5e7eb',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  minHeight: 32,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 0.25,
                                }}
                              >
                                {nomes.length ? (
                                  nomes.map((n) => (
                                    <Box key={n} component="span" sx={{ lineHeight: 1.2 }}>
                                      {n}
                                    </Box>
                                  ))
                                ) : (
                                  '—'
                                )}
                              </Box>
                            </Tooltip>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      {linha.total_visitas_efetivo}
                    </TableCell>
                  </TableRow>
                ))}
                {!linhasVisitasComTotais.length && (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">Nenhuma loja neste filtro.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {!podeEditar && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, flexShrink: 0 }}>
          Modo leitura — somente o diretor pode editar a escala.
        </Typography>
      )}
    </Box>
  );
}
