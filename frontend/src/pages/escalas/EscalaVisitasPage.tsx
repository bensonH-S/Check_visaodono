import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
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

const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

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
type PendingMap = Map<CelulaChave, { id_loja: number; dia: number; id_regional: number | null }>;

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
  const podeEditar = podeGerenciarEscalaVisitas();

  const mapCorRegional = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of grade?.regionais ?? []) m.set(r.id_usuario, r.cor);
    for (const linha of grade?.linhas ?? []) {
      for (const d of linha.dias) {
        if (d.id_regional != null && d.cor) {
          m.set(d.id_regional, d.cor);
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
        if (d.id_regional != null && d.nome_regional) {
          m.set(d.id_regional, d.nome_regional);
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

  function alterarCelula(idLoja: number, dia: number, idRegional: number | null) {
    if (!podeEditar) return;
    setPending((prev) => {
      const next = new Map(prev);
      next.set(chaveCelula(idLoja, dia), { id_loja: idLoja, dia, id_regional: idRegional });
      return next;
    });
  }

  function valorCelula(idLoja: number, dia: number, original: number | null) {
    const p = pending.get(chaveCelula(idLoja, dia));
    if (p) return p.id_regional;
    return original;
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
      const dias = linha.dias.map((d) => {
        const idReg = valorCelula(linha.id_loja, d.dia, d.id_regional);
        if (idReg) total += 1;
        return { ...d, id_regional_efetivo: idReg };
      });
      return { ...linha, dias, total_visitas_efetivo: total };
    });
  }, [grade, pending]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0, flex: 1 }}>
      <Paper sx={{ p: 2, borderRadius: 2, border: `1px solid ${colors.border}` }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => setSemanaInicio(addDaysIso(semanaInicio, -7))} aria-label="Semana anterior">
              <ChevronLeftIcon />
            </IconButton>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Semana {grade?.semana_label ?? fmtDataCurta(semanaInicio)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Escala de visitas — time de campo
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => setSemanaInicio(addDaysIso(semanaInicio, 7))} aria-label="Próxima semana">
              <ChevronRightIcon />
            </IconButton>
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

        {grade && grade.regionais.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            {grade.regionais.map((r) => (
              <Chip
                key={r.id_usuario}
                size="small"
                label={r.nome}
                sx={{
                  bgcolor: `${r.cor}22`,
                  border: `1px solid ${r.cor}`,
                  fontWeight: 600,
                  '& .MuiChip-label': { color: colors.textPrimary },
                }}
              />
            ))}
          </Box>
        )}
      </Paper>

      {(loading || salvando) && <LinearProgress />}

      {loading && !grade ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ ...tablePaperSx, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <TableContainer sx={{ ...tableContainerSx, flex: 1 }}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 72, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: 0, zIndex: 3 }}>
                    BKN
                  </TableCell>
                  <TableCell sx={{ minWidth: 200, fontWeight: 700, bgcolor: '#fff', position: 'sticky', left: 72, zIndex: 3 }}>
                    Loja
                  </TableCell>
                  {DIAS.map((label, i) => (
                    <TableCell key={label} align="center" sx={{ minWidth: 108, fontWeight: 700, whiteSpace: 'nowrap' }}>
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
                {linhasComTotais.map((linha) => (
                  <TableRow key={linha.id_loja} hover>
                    <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: '#fff', zIndex: 1 }}>
                      {linha.bk_number || '—'}
                    </TableCell>
                    <TableCell sx={{ position: 'sticky', left: 72, bgcolor: '#fff', zIndex: 1 }}>
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
                      const idReg = d.id_regional_efetivo;
                      const cor = idReg ? mapCorRegional.get(idReg) || '#64748B' : undefined;
                      const nome = idReg ? mapNomeRegional.get(idReg) || '—' : '';
                      const primeiroNome = nome.split(' ')[0] || '';
                      return (
                        <TableCell key={d.dia} align="center" sx={{ p: 0.5 }}>
                          {podeEditar ? (
                            <Select
                              size="small"
                              displayEmpty
                              value={idReg ?? ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                alterarCelula(linha.id_loja, d.dia, String(v) === '' ? null : Number(v));
                              }}
                              sx={{
                                width: '100%',
                                maxWidth: 120,
                                fontSize: '0.75rem',
                                bgcolor: cor ? `${cor}18` : undefined,
                                '& .MuiSelect-select': { py: 0.75 },
                              }}
                              renderValue={(v) => {
                                if (!v) return '—';
                                const n = mapNomeRegional.get(Number(v));
                                return n?.split(' ')[0] ?? '—';
                              }}
                            >
                              <MenuItem value="">
                                <em>Vazio</em>
                              </MenuItem>
                              {(grade?.regionais ?? []).map((r) => (
                                <MenuItem key={r.id_usuario} value={r.id_usuario}>
                                  {r.nome}
                                </MenuItem>
                              ))}
                            </Select>
                          ) : (
                            <Tooltip title={nome || 'Sem visita'}>
                              <Box
                                sx={{
                                  py: 0.75,
                                  px: 0.5,
                                  borderRadius: 1,
                                  bgcolor: cor ? `${cor}22` : 'transparent',
                                  border: cor ? `1px solid ${cor}` : '1px dashed #e5e7eb',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  minHeight: 32,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {primeiroNome || '—'}
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
                {!linhasComTotais.length && (
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
        <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
          Modo leitura — somente o diretor pode editar a escala.
        </Typography>
      )}
    </Box>
  );
}
