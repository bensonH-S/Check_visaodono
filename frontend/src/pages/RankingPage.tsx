import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Grid from '@mui/material/Grid';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useTheme } from '@mui/material/styles';
import { api, fmtNota, fmtData, type RankingLoja, notaChipSx, scoreColor } from '../api/client';
import { tableCellWrapSx, tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../utils/tablePageLayout';
import { portalPanelSx } from '../theme/tokens';

const NAVY = '#1B2A6B';

function rankBadgeStyle(pos: number) {
  const base = {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 800,
    flexShrink: 0,
  };

  if (pos === 1) {
    return {
      ...base,
      background: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)',
      color: '#FFFFFF',
      boxShadow: '0 2px 8px rgba(217, 119, 6, 0.45)',
      border: '1.5px solid #F59E0B',
    };
  }
  if (pos === 2) {
    return {
      ...base,
      background: 'linear-gradient(135deg, #CBD5E1 0%, #64748B 100%)',
      color: '#FFFFFF',
      boxShadow: '0 2px 6px rgba(100, 116, 139, 0.35)',
      border: '1.5px solid #94A3B8',
    };
  }
  if (pos === 3) {
    return {
      ...base,
      background: 'linear-gradient(135deg, #F97316 0%, #B45309 100%)',
      color: '#FFFFFF',
      boxShadow: '0 2px 6px rgba(180, 83, 9, 0.35)',
      border: '1.5px solid #D97706',
    };
  }
  return {
    ...base,
    bgcolor: 'action.hover',
    color: 'text.secondary',
    border: '1px solid',
    borderColor: 'divider',
  };
}

export default function RankingPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  const [rows, setRows] = useState<RankingLoja[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'acima' | 'regular' | 'critica'>('todas');
  const [ordenacao, setOrdenacao] = useState<'posicao' | 'maior_nota' | 'menor_nota' | 'evolucao'>('posicao');

  const carregar = () => {
    setLoading(true);
    setErr('');
    api
      .ranking()
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Falha ao carregar ranking'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregar();
  }, []);

  // Estatísticas gerais
  const stats = useMemo(() => {
    const total = rows.length;
    if (!total) return { total: 0, mediaGeral: 0, acimaMeta: 0, regular: 0, criticas: 0 };
    const soma = rows.reduce((s, r) => s + (Number(r.nota_atual) || 0), 0);
    const mediaGeral = Math.round((soma / total) * 10) / 10;
    const acimaMeta = rows.filter((r) => Number(r.nota_atual) >= 85).length;
    const regular = rows.filter((r) => Number(r.nota_atual) >= 75 && Number(r.nota_atual) < 85).length;
    const criticas = rows.filter((r) => Number(r.nota_atual) < 75).length;
    return { total, mediaGeral, acimaMeta, regular, criticas };
  }, [rows]);

  // Top 3 Lojas (Pódio)
  const top3 = useMemo(() => {
    return [...rows].sort((a, b) => a.posicao_ranking - b.posicao_ranking).slice(0, 3);
  }, [rows]);

  // Lista filtrada e ordenada
  const rowsFiltradas = useMemo(() => {
    let list = [...rows];

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.city?.toLowerCase().includes(q) ||
          r.state?.toLowerCase().includes(q) ||
          String(r.id_loja).includes(q),
      );
    }

    if (filtroStatus === 'acima') {
      list = list.filter((r) => Number(r.nota_atual) >= 85);
    } else if (filtroStatus === 'regular') {
      list = list.filter((r) => Number(r.nota_atual) >= 75 && Number(r.nota_atual) < 85);
    } else if (filtroStatus === 'critica') {
      list = list.filter((r) => Number(r.nota_atual) < 75);
    }

    if (ordenacao === 'maior_nota') {
      list.sort((a, b) => Number(b.nota_atual) - Number(a.nota_atual));
    } else if (ordenacao === 'menor_nota') {
      list.sort((a, b) => Number(a.nota_atual) - Number(b.nota_atual));
    } else if (ordenacao === 'evolucao') {
      list.sort((a, b) => {
        const deltaA = a.nota_anterior != null ? Number(a.nota_atual) - Number(a.nota_anterior) : -999;
        const deltaB = b.nota_anterior != null ? Number(b.nota_atual) - Number(b.nota_anterior) : -999;
        return deltaB - deltaA;
      });
    } else {
      list.sort((a, b) => a.posicao_ranking - b.posicao_ranking);
    }

    return list;
  }, [rows, busca, filtroStatus, ordenacao]);

  const renderTrend = (atual: number, anterior: number | null) => {
    if (anterior == null) {
      return (
        <Tooltip title="Primeira auditoria registrada">
          <Chip
            size="small"
            icon={<RemoveIcon sx={{ fontSize: '14px !important' }} />}
            label="Novo"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.7rem', color: 'text.secondary', borderColor: 'divider' }}
          />
        </Tooltip>
      );
    }
    const delta = Math.round((atual - anterior) * 10) / 10;
    if (delta > 0) {
      return (
        <Tooltip title={`Evoluiu +${delta}% em relação à auditoria anterior`}>
          <Chip
            size="small"
            icon={<TrendingUpIcon sx={{ fontSize: '14px !important', color: '#16A34A !important' }} />}
            label={`+${delta}%`}
            sx={{
              height: 22,
              fontSize: '0.72rem',
              fontWeight: 700,
              bgcolor: isDark ? 'rgba(34, 197, 94, 0.16)' : 'rgba(22, 163, 74, 0.10)',
              color: isDark ? '#4ADE80' : '#15803D',
              border: '1px solid',
              borderColor: isDark ? 'rgba(34, 197, 94, 0.35)' : 'rgba(22, 163, 74, 0.25)',
            }}
          />
        </Tooltip>
      );
    }
    if (delta < 0) {
      return (
        <Tooltip title={`Reduziu ${delta}% em relação à auditoria anterior`}>
          <Chip
            size="small"
            icon={<TrendingDownIcon sx={{ fontSize: '14px !important', color: '#DC2626 !important' }} />}
            label={`${delta}%`}
            sx={{
              height: 22,
              fontSize: '0.72rem',
              fontWeight: 700,
              bgcolor: isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(220, 38, 38, 0.10)',
              color: isDark ? '#F87171' : '#B91C1C',
              border: '1px solid',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(220, 38, 38, 0.25)',
            }}
          />
        </Tooltip>
      );
    }
    return (
      <Tooltip title="Nota mantida estável">
        <Chip
          size="small"
          icon={<RemoveIcon sx={{ fontSize: '14px !important' }} />}
          label="0.0%"
          variant="outlined"
          sx={{ height: 22, fontSize: '0.7rem', color: 'text.secondary', borderColor: 'divider' }}
        />
      </Tooltip>
    );
  };

  return (
    <Box sx={tablePageLayoutSx}>
      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          flexShrink: 0,
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: isDark ? 'rgba(232, 82, 10, 0.35)' : 'divider',
          background: isDark
            ? 'linear-gradient(135deg, rgba(232, 82, 10, 0.28) 0%, rgba(249, 115, 22, 0.16) 100%)'
            : `linear-gradient(135deg, ${NAVY} 0%, #2a3d8f 100%)`,
          color: 'white',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(232, 82, 10, 0.25)' : 'rgba(255,255,255,0.15)',
                color: isDark ? '#FB923C' : '#FBBF24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <EmojiEventsIcon sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                Ranking Geral de Lojas
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                Desempenho consolidado das auditorias operacionais e conformidade
              </Typography>

              {/* Indicadores Resumo */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}>
                <Chip
                  label={`${stats.total} lojas ranqueadas`}
                  size="small"
                  sx={{ bgcolor: isDark ? 'rgba(232, 82, 10, 0.25)' : 'rgba(255,255,255,0.18)', color: 'white', fontWeight: 600, height: 24 }}
                />
                <Chip
                  label={`Média Geral: ${stats.mediaGeral}%`}
                  size="small"
                  sx={{
                    bgcolor: stats.mediaGeral >= 85 ? 'rgba(34, 197, 94, 0.28)' : 'rgba(234, 179, 8, 0.28)',
                    color: 'white',
                    fontWeight: 700,
                    height: 24,
                  }}
                />
                <Chip
                  label={`${stats.acimaMeta} no topo (≥ 85%)`}
                  size="small"
                  sx={{ bgcolor: 'rgba(34, 197, 94, 0.22)', color: 'white', fontWeight: 600, height: 24 }}
                />
                {stats.criticas > 0 && (
                  <Chip
                    label={`${stats.criticas} em atenção (< 75%)`}
                    size="small"
                    sx={{ bgcolor: 'rgba(239, 68, 68, 0.28)', color: 'white', fontWeight: 600, height: 24 }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Button
            size="small"
            variant="outlined"
            onClick={carregar}
            disabled={loading}
            startIcon={<RefreshIcon />}
            sx={{
              color: 'white',
              borderColor: isDark ? 'rgba(251, 146, 60, 0.5)' : 'rgba(255,255,255,0.45)',
              '&:hover': { borderColor: 'white', bgcolor: isDark ? 'rgba(232, 82, 10, 0.15)' : 'rgba(255,255,255,0.08)' },
            }}
          >
            Atualizar
          </Button>
        </Box>
      </Paper>

      {/* Pódio Top 3 Lojas */}
      {top3.length > 0 && (
        <Grid container spacing={2}>
          {top3.map((loja, idx) => {
            const pos = idx + 1;
            const nota = Number(loja.nota_atual);
            const coresPodio =
              pos === 1
                ? { borda: '#F59E0B', bg: isDark ? 'rgba(245, 158, 11, 0.10)' : 'rgba(254, 243, 199, 0.50)', titulo: '#D97706', label: '1º Lugar • Ouro' }
                : pos === 2
                ? { borda: '#94A3B8', bg: isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(241, 245, 249, 0.70)', titulo: '#64748B', label: '2º Lugar • Prata' }
                : { borda: '#D97706', bg: isDark ? 'rgba(217, 119, 6, 0.10)' : 'rgba(255, 237, 213, 0.50)', titulo: '#B45309', label: '3º Lugar • Bronze' };

            return (
              <Grid size={{ xs: 12, sm: 4 }} key={loja.id_loja}>
                <Paper
                  elevation={0}
                  sx={{
                    ...portalPanelSx,
                    p: 2,
                    border: '1.5px solid',
                    borderColor: coresPodio.borda,
                    bgcolor: coresPodio.bg,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={rankBadgeStyle(pos)}>{pos}</Box>
                      <Typography variant="caption" sx={{ fontWeight: 800, color: coresPodio.titulo, letterSpacing: '0.04em' }}>
                        {coresPodio.label}
                      </Typography>
                    </Box>
                    <WorkspacePremiumIcon sx={{ color: coresPodio.titulo, fontSize: 24 }} />
                  </Box>

                  <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, mb: 0.5 }}>
                    {loja.name}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', mb: 1.5 }}>
                    <LocationOnIcon sx={{ fontSize: 15 }} />
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>
                      {loja.city}/{loja.state}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      Nota Atual:
                    </Typography>
                    <Chip label={fmtNota(nota)} size="small" sx={{ ...notaChipSx(nota), fontWeight: 800 }} />
                  </Box>

                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, Math.max(0, nota))}
                    sx={{
                      height: 7,
                      borderRadius: 4,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: scoreColor(nota),
                        borderRadius: 4,
                      },
                    }}
                  />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary">
                      Última visita: {fmtData(loja.ultima_visita)}
                    </Typography>
                    {renderTrend(nota, loja.nota_anterior != null ? Number(loja.nota_anterior) : null)}
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Barra de Filtros e Busca */}
      <Paper elevation={0} sx={{ ...portalPanelSx, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Buscar loja ou cidade…"
            size="small"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ flex: { xs: '1 1 100%', sm: '1 1 240px' } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: busca ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setBusca('')}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />

          <FormControl size="small" sx={{ minWidth: 180, flex: { xs: '1 1 45%', sm: '0 0 auto' } }}>
            <InputLabel>Status da Nota</InputLabel>
            <Select
              label="Status da Nota"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as any)}
            >
              <MenuItem value="todas">Todas as Notas</MenuItem>
              <MenuItem value="acima">Acima da Meta (≥ 85%)</MenuItem>
              <MenuItem value="regular">Regular (75% a 84%)</MenuItem>
              <MenuItem value="critica">Abaixo da Meta (&lt; 75%)</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 170, flex: { xs: '1 1 45%', sm: '0 0 auto' } }}>
            <InputLabel>Ordenação</InputLabel>
            <Select
              label="Ordenação"
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as any)}
            >
              <MenuItem value="posicao">Posição no Ranking (#)</MenuItem>
              <MenuItem value="maior_nota">Maior Nota</MenuItem>
              <MenuItem value="menor_nota">Menor Nota</MenuItem>
              <MenuItem value="evolucao">Maior Evolução</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ ml: { sm: 'auto' }, fontWeight: 500 }}>
            {rowsFiltradas.length} {rowsFiltradas.length === 1 ? 'loja encontrada' : 'lojas encontradas'}
          </Typography>
        </Box>
      </Paper>

      {/* Estado de carregamento ou erro */}
      {loading && <LinearProgress />}
      {err && <Alert severity="error">{err}</Alert>}

      {/* Tabela do Ranking */}
      <Paper elevation={0} sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table stickyHeader sx={tableSx} size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 64, textAlign: 'center' }}>#</TableCell>
              <TableCell>Loja / Unidade</TableCell>
              <TableCell sx={{ minWidth: 130 }}>Localidade</TableCell>
              <TableCell sx={{ minWidth: 120 }}>Última Visita</TableCell>
              <TableCell sx={{ minWidth: 180 }}>Nota Atual</TableCell>
              <TableCell sx={{ minWidth: 100, textAlign: 'center' }}>Anterior</TableCell>
              <TableCell sx={{ minWidth: 110, textAlign: 'center' }}>Evolução</TableCell>
              <TableCell sx={{ width: 100, textAlign: 'right' }}>Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rowsFiltradas.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={8} sx={{ py: 6, textAlign: 'center', color: 'text.secondary' }}>
                  Nenhuma loja encontrada com os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              rowsFiltradas.map((r) => {
                const nota = Number(r.nota_atual);
                const anterior = r.nota_anterior != null ? Number(r.nota_anterior) : null;

                return (
                  <TableRow
                    key={r.id_loja}
                    hover
                    sx={{
                      cursor: 'pointer',
                      transition: 'background-color 0.15s',
                    }}
                    onClick={() => navigate(`/visitas?loja=${r.id_loja}`)}
                  >
                    {/* Posição */}
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <Box sx={rankBadgeStyle(r.posicao_ranking)}>{r.posicao_ranking}</Box>
                      </Box>
                    </TableCell>

                    {/* Nome da Loja */}
                    <TableCell sx={tableCellWrapSx}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {r.name}
                      </Typography>
                    </TableCell>

                    {/* Cidade e Estado */}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {r.city ? `${r.city}/${r.state}` : '—'}
                      </Typography>
                    </TableCell>

                    {/* Data da Última Visita */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CalendarMonthIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                        <Typography variant="body2" color="text.secondary">
                          {fmtData(r.ultima_visita)}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Nota Atual com Barra de Progresso */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 140 }}>
                        <Box sx={{ flex: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, Math.max(0, nota))}
                            sx={{
                              height: 6,
                              borderRadius: 3,
                              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: scoreColor(nota),
                                borderRadius: 3,
                              },
                            }}
                          />
                        </Box>
                        <Chip label={fmtNota(nota)} size="small" sx={{ ...notaChipSx(nota), flexShrink: 0 }} />
                      </Box>
                    </TableCell>

                    {/* Nota Anterior */}
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        {anterior != null ? fmtNota(anterior) : '—'}
                      </Typography>
                    </TableCell>

                    {/* Tendência / Evolução */}
                    <TableCell sx={{ textAlign: 'center' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        {renderTrend(nota, anterior)}
                      </Box>
                    </TableCell>

                    {/* Ações */}
                    <TableCell sx={{ textAlign: 'right' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<HistoryIcon />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/visitas?loja=${r.id_loja}`);
                        }}
                        sx={{
                          fontSize: '0.72rem',
                          textTransform: 'none',
                          whiteSpace: 'nowrap',
                          py: 0.25,
                        }}
                      >
                        Visitas
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
    </Box>
  );
}
