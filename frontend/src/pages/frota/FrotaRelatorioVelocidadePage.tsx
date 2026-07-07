import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Button from '@mui/material/Button';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import SearchIcon from '@mui/icons-material/Search';
import { api, type FrotaVeiculo, type FrotaVeiculoVelocidadeRelatorio } from '../../api/client';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { periodoSemanaAtualKm } from '../../components/frota/FrotaVeiculosKmSemanaPanel';
import { tableContainerSx, tablePaperSx, tableSx, tablePageLayoutSx } from '../../utils/tablePageLayout';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

dayjs.extend(isoWeek);

export default function FrotaRelatorioVelocidadePage() {
  const navigate = useNavigate();
  const semana = periodoSemanaAtualKm();
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [veiculoSel, setVeiculoSel] = useState<FrotaVeiculo | null>(null);
  const [dataInicio, setDataInicio] = useState(semana.inicio);
  const [dataFim, setDataFim] = useState(semana.fim);
  const [relatorio, setRelatorio] = useState<FrotaVeiculoVelocidadeRelatorio | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .frotaVeiculos()
      .then(setVeiculos)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar veículos'));
  }, []);

  const veiculosOrdenados = useMemo(
    () => [...veiculos].sort((a, b) => a.placa.localeCompare(b.placa, 'pt-BR')),
    [veiculos],
  );

  const buscar = useCallback(() => {
    if (!veiculoSel) {
      setErro('Selecione um veículo');
      return;
    }
    const inicio = dataInicio || dataFim;
    const fim = dataFim || dataInicio;
    if (!inicio || !fim) {
      setErro('Selecione o período');
      return;
    }
    setLoading(true);
    setErro('');
    api
      .frotaVeiculoVelocidade(veiculoSel.id_veiculo, inicio, fim)
      .then(setRelatorio)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar velocidades'))
      .finally(() => setLoading(false));
  }, [veiculoSel, dataInicio, dataFim]);

  return (
    <Box sx={{ ...tablePageLayoutSx, gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <IconButton size="small" onClick={() => navigate('/frota')} aria-label="Voltar">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Relatório de velocidades
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 2,
          flexShrink: 0,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'flex-end',
        }}
      >
        <Autocomplete
          options={veiculosOrdenados}
          value={veiculoSel}
          onChange={(_, v) => setVeiculoSel(v)}
          getOptionLabel={(v) =>
            `${v.placa} — ${[v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo'}`
          }
          isOptionEqualToValue={(a, b) => a.id_veiculo === b.id_veiculo}
          sx={{ minWidth: 280, flex: 1 }}
          renderInput={(params) => <TextField {...params} label="Veículo" size="small" />}
        />
        <FiltroIntervaloDatasFrota
          dataInicio={dataInicio}
          dataFim={dataFim}
          onChangeInicio={setDataInicio}
          onChangeFim={setDataFim}
        />
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={() => void buscar()}
          disabled={!veiculoSel || loading}
        >
          Consultar
        </Button>
      </Paper>

      {erro && (
        <Alert severity="error" onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}

      {loading && <LinearProgress sx={{ flexShrink: 0 }} />}

      {relatorio && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
              gap: 1.25,
              flexShrink: 0,
            }}
          >
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Velocidade média
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {relatorio.velocidade_media.toLocaleString('pt-BR')} km/h
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Velocidade máxima
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: relatorio.velocidade_maxima > relatorio.limite_kmh ? 'error.main' : 'text.primary' }}>
                {relatorio.velocidade_maxima.toLocaleString('pt-BR')} km/h
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Limite configurado
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {relatorio.limite_kmh} km/h
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Excessos de velocidade
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: relatorio.qtd_excessos > 0 ? 'error.main' : 'success.main' }}>
                {relatorio.qtd_excessos}
              </Typography>
            </Paper>
          </Box>

          <Paper elevation={0} sx={{ ...tablePaperSx, flex: 1, minHeight: 0 }}>
            <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 700 }}>
              Registros acima do limite ({relatorio.veiculo.placa})
            </Typography>
            <TableContainer sx={tableContainerSx}>
              <Table size="small" stickyHeader sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Data/hora</TableCell>
                    <TableCell align="right">Velocidade</TableCell>
                    <TableCell align="right">Limite</TableCell>
                    <TableCell align="right">Excesso</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {relatorio.excessos.map((e, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {e.atualizado_em ? formatDataHoraBrasilia(e.atualizado_em) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>
                        {e.velocidade} km/h
                      </TableCell>
                      <TableCell align="right">{e.limite} km/h</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        +{e.velocidade - e.limite} km/h
                      </TableCell>
                      <TableCell>
                        <Chip label="Ultrapassou" size="small" color="error" variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!relatorio.excessos.length && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        Nenhum excesso de velocidade no período.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
}
