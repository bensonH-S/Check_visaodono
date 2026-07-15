import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
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
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  api,
  type FrotaRegistroVelocidade,
  type FrotaVeiculo,
  type FrotaVeiculoVelocidadeRelatorio,
} from '../../api/client';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { periodoSemanaAtualKm } from '../../components/frota/FrotaVeiculosKmSemanaPanel';
import { rotuloVeiculoOpcao } from '../../constants/frotaVeiculo';
import { tableContainerSx, tablePaperSx, tableSx, tablePageLayoutSx, tableCellWrapSx } from '../../utils/tablePageLayout';
import { formatDataHoraBrasilia, formatarDuracaoMs } from '../../utils/dateBr';
import { geocodificarReversa } from '../../utils/geocodificarReversa';

dayjs.extend(isoWeek);

const colunasVelocidadeSx = {
  data: { width: '11%', minWidth: 128, whiteSpace: 'nowrap' },
  tecnico: { width: '13%', minWidth: 110, whiteSpace: 'nowrap' },
  velocidade: { width: '8%', minWidth: 88, whiteSpace: 'nowrap' },
  limite: { width: '7%', minWidth: 72, whiteSpace: 'nowrap' },
  excesso: { width: '10%', minWidth: 96, whiteSpace: 'nowrap', pr: 3 },
  status: { width: '13%', minWidth: 132, pl: 1 },
  endereco: { width: '38%', minWidth: 200 },
} as const;

function resumirEndereco(endereco: string): string {
  if (!endereco || endereco === 'Carregando…' || endereco === 'Endereço indisponível') return endereco;
  const partes = endereco.split(',').map((p) => p.trim()).filter(Boolean);
  return partes.slice(0, 4).join(', ') || endereco;
}

function CelulaEnderecoExcesso({ latitude, longitude }: { latitude: number; longitude: number }) {
  const [endereco, setEndereco] = useState('Carregando…');

  useEffect(() => {
    let ativo = true;
    setEndereco('Carregando…');
    void geocodificarReversa(latitude, longitude).then((txt) => {
      if (ativo) setEndereco(resumirEndereco(txt));
    });
    return () => {
      ativo = false;
    };
  }, [latitude, longitude]);

  return (
    <TableCell sx={{ ...colunasVelocidadeSx.endereco, ...tableCellWrapSx }} title={endereco}>
      {endereco}
    </TableCell>
  );
}

function listarExcessosVelocidade(relatorio: FrotaVeiculoVelocidadeRelatorio): FrotaRegistroVelocidade[] {
  const limite = relatorio.limite_kmh ?? 80;
  const daApi = relatorio.excessos ?? [];
  if (daApi.length) {
    return daApi.map((e) => ({
      ...e,
      limite: e.limite ?? limite,
      status: 'excesso' as const,
    }));
  }
  return (relatorio.registros ?? [])
    .filter((r) => r.status === 'excesso' || Number(r.velocidade) > limite)
    .map((r) => ({
      ...r,
      limite: r.limite ?? limite,
      status: 'excesso' as const,
    }));
}

function calcularTempoParadoFrontend(registros: FrotaRegistroVelocidade[]): number {
  const parados = registros
    .filter((r) => r.status === 'parado' && r.atualizado_em)
    .sort((a, b) => new Date(a.atualizado_em!).getTime() - new Date(b.atualizado_em!).getTime());
  let total = 0;
  for (let i = 0; i < parados.length - 1; i += 1) {
    const ta = new Date(parados[i].atualizado_em!).getTime();
    const tb = new Date(parados[i + 1].atualizado_em!).getTime();
    if (Number.isFinite(ta) && Number.isFinite(tb) && tb > ta) total += tb - ta;
  }
  return total;
}

export default function FrotaRelatorioVelocidadePage() {
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

  const excessos = useMemo(
    () => (relatorio ? listarExcessosVelocidade(relatorio) : []),
    [relatorio],
  );

  const tempoParadoMs =
    relatorio?.tempo_parado_ms ??
    (relatorio ? calcularTempoParadoFrontend(relatorio.registros ?? []) : 0);

  const velocidadeMedia = relatorio?.velocidade_media ?? 0;
  const velocidadeMaxima = relatorio?.velocidade_maxima ?? 0;
  const limiteKmh = relatorio?.limite_kmh ?? 80;
  const qtdExcessos = relatorio ? excessos.length : 0;

  return (
    <Box sx={{ ...tablePageLayoutSx, gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
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
          getOptionLabel={(v) => rotuloVeiculoOpcao(v)}
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
        <Alert severity="warning">
          Rastreamento Fulltrack desativado ou sem credenciais no servidor.
          Confira no .env: FULLTRACK_API_KEY (ou APIKEY) e FULLTRACK_SECRET_KEY (ou SECRETKEY),
          depois reinicie a API.
        </Alert>
      )}

      {loading && <LinearProgress sx={{ flexShrink: 0 }} />}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
          gap: 1.25,
          flexShrink: 0,
        }}
      >
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Velocidade média
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {velocidadeMedia.toLocaleString('pt-BR')} km/h
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Velocidade máxima
          </Typography>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              color: velocidadeMaxima > limiteKmh ? 'error.main' : 'text.primary',
            }}
          >
            {velocidadeMaxima.toLocaleString('pt-BR')} km/h
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Limite configurado
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {limiteKmh} km/h
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Excessos de velocidade
          </Typography>
          <Typography
            variant="h6"
            sx={{ fontWeight: 800, color: qtdExcessos > 0 ? 'error.main' : 'success.main' }}
          >
            {qtdExcessos}
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Tempo parado (GPS)
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {formatarDuracaoMs(tempoParadoMs)}
          </Typography>
        </Paper>
      </Box>

      <Paper elevation={0} sx={{ ...tablePaperSx, flex: 1, minHeight: 0 }}>
        <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 0.5, fontWeight: 700 }}>
          Excessos de velocidade
          {relatorio ? ` (${relatorio.veiculo.placa})` : ''} — {excessos.length}
        </Typography>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={{ ...tableSx, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={colunasVelocidadeSx.data}>Data/hora</TableCell>
                <TableCell sx={colunasVelocidadeSx.tecnico}>Técnico</TableCell>
                <TableCell align="right" sx={colunasVelocidadeSx.velocidade}>
                  Velocidade
                </TableCell>
                <TableCell align="right" sx={colunasVelocidadeSx.limite}>
                  Limite
                </TableCell>
                <TableCell align="right" sx={colunasVelocidadeSx.excesso}>
                  Excesso
                </TableCell>
                <TableCell sx={colunasVelocidadeSx.status}>Status</TableCell>
                <TableCell sx={colunasVelocidadeSx.endereco}>Endereço</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {excessos.map((r, idx) => (
                <TableRow
                  key={`${r.atualizado_em ?? idx}-${r.velocidade}`}
                  hover
                  sx={{ bgcolor: 'error.50', '&:hover': { bgcolor: 'error.100' } }}
                >
                  <TableCell sx={colunasVelocidadeSx.data}>
                    {r.atualizado_em ? formatDataHoraBrasilia(r.atualizado_em) : '—'}
                  </TableCell>
                  <TableCell sx={colunasVelocidadeSx.tecnico}>{r.nome_tecnico || '—'}</TableCell>
                  <TableCell align="right" sx={{ ...colunasVelocidadeSx.velocidade, fontWeight: 700, color: 'error.main' }}>
                    {r.velocidade} km/h
                  </TableCell>
                  <TableCell align="right" sx={colunasVelocidadeSx.limite}>
                    {r.limite} km/h
                  </TableCell>
                  <TableCell align="right" sx={{ ...colunasVelocidadeSx.excesso, fontWeight: 600 }}>
                    +{r.velocidade - r.limite} km/h
                  </TableCell>
                  <TableCell sx={colunasVelocidadeSx.status}>
                    <Chip
                      icon={<WarningAmberIcon sx={{ color: '#fff !important', fontSize: 18 }} />}
                      label="Ultrapassou"
                      size="small"
                      color="error"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <CelulaEnderecoExcesso latitude={Number(r.latitude)} longitude={Number(r.longitude)} />
                </TableRow>
              ))}
              {!excessos.length && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {relatorio
                      ? 'Nenhum excesso de velocidade no período.'
                      : 'Selecione veículo e período, depois clique em Consultar.'}
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
