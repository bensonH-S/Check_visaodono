import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import SearchIcon from '@mui/icons-material/Search';
import { api, type FrotaVeiculo, type FrotaVeiculoRotaDiaRelatorio } from '../../api/client';
import FrotaRotaDiaMap from '../../components/frota/FrotaRotaDiaMap';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { tableContainerSx, tablePaperSx, tableSx, tablePageLayoutSx } from '../../utils/tablePageLayout';
import { formatDataHoraBrasilia } from '../../utils/dateBr';

export default function FrotaRelatorioRotasPage() {
  const navigate = useNavigate();
  const hoje = dayjs().format('YYYY-MM-DD');
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [veiculoSel, setVeiculoSel] = useState<FrotaVeiculo | null>(null);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [relatorio, setRelatorio] = useState<FrotaVeiculoRotaDiaRelatorio | null>(null);
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
      .frotaVeiculoRotaDia(veiculoSel.id_veiculo, inicio, fim)
      .then(setRelatorio)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar rotas'))
      .finally(() => setLoading(false));
  }, [veiculoSel, dataInicio, dataFim]);

  const kmExibicao = relatorio?.km_odometro ?? relatorio?.km_gps ?? 0;

  return (
    <Box sx={{ ...tablePageLayoutSx, gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <IconButton size="small" onClick={() => navigate('/frota')} aria-label="Voltar">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Relatório de rotas do veículo
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

      {relatorio?.rastreamento_ativo === false && (
        <Alert severity="warning">Rastreamento Fulltrack desativado ou sem credenciais.</Alert>
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
                KM no período (GPS)
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {relatorio.km_gps.toLocaleString('pt-BR')} km
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                KM no período (odômetro)
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {relatorio.km_odometro != null
                  ? `${relatorio.km_odometro.toLocaleString('pt-BR')} km`
                  : '—'}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Rotas detectadas
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {relatorio.rotas.length}
              </Typography>
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Pontos GPS
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {relatorio.total_pontos}
              </Typography>
            </Paper>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
            {relatorio.veiculo.placa} — {relatorio.data_inicio}
            {relatorio.data_fim !== relatorio.data_inicio ? ` a ${relatorio.data_fim}` : ''} — melhor
            estimativa: <strong>{kmExibicao.toLocaleString('pt-BR')} km</strong>
          </Typography>

          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <FrotaRotaDiaMap
              rotas={relatorio.rotas}
              pontos={relatorio.pontos}
              altura="100%"
            />

            <Paper elevation={0} sx={{ ...tablePaperSx, flexShrink: 0, maxHeight: 220 }}>
              <TableContainer sx={tableContainerSx}>
                <Table size="small" stickyHeader sx={tableSx}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rota</TableCell>
                      <TableCell>Início</TableCell>
                      <TableCell>Fim</TableCell>
                      <TableCell align="right">KM</TableCell>
                      <TableCell align="right">Pontos</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {relatorio.rotas.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell sx={{ fontWeight: 600 }}>#{r.id}</TableCell>
                        <TableCell>{r.inicio ? formatDataHoraBrasilia(r.inicio) : '—'}</TableCell>
                        <TableCell>{r.fim ? formatDataHoraBrasilia(r.fim) : '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {r.km.toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell align="right">{r.pontos.length}</TableCell>
                      </TableRow>
                    ))}
                    {!relatorio.rotas.length && (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                          Nenhuma rota registrada no período.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        </>
      )}
    </Box>
  );
}
