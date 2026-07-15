import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import BuildIcon from '@mui/icons-material/Build';
import { api, type FrotaManutencaoPortal, type FrotaVeiculo } from '../../api/client';
import { rotuloVeiculoLista } from '../../constants/frotaVeiculo';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { colors } from '../../theme/tokens';
import { dataDentroIntervalo, matchVeiculo } from '../../utils/frotaPortalFiltros';
import { tableCellWrapSx, tableContainerSx, tableSx } from '../../utils/tablePageLayout';

function fmtData(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

export default function FrotaManutencaoPortalPage() {
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [lista, setLista] = useState<FrotaManutencaoPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [buscaVeiculo, setBuscaVeiculo] = useState('');
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<FrotaVeiculo | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([api.frotaVeiculos(), api.frotaManutencoesPortal()])
      .then(([v, m]) => {
        setVeiculos(v);
        setLista(m);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const idVeiculoFiltro = veiculoSelecionado?.id_veiculo ?? null;

  const listaFiltrada = useMemo(
    () =>
      lista.filter(
        (m) =>
          matchVeiculo(m, idVeiculoFiltro, buscaVeiculo, veiculos) &&
          dataDentroIntervalo(m.data_manutencao, dataInicio, dataFim),
      ),
    [lista, idVeiculoFiltro, buscaVeiculo, veiculos, dataInicio, dataFim],
  );

  const filtrosAtivos = !!buscaVeiculo.trim() || veiculoSelecionado != null || !!dataInicio || !!dataFim;

  return (
    <Box sx={{ pb: 4, flex: 1, minHeight: 0, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {listaFiltrada.length} de {lista.length} manutenção{lista.length !== 1 ? 'ões' : ''}
        </Typography>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: colors.border,
          borderLeft: `4px solid ${colors.navy}`,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: '1px solid',
            borderColor: colors.border,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              bgcolor: 'rgba(27, 42, 107, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.navy,
              flexShrink: 0,
            }}
          >
            <BuildIcon />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Manutenções</Typography>
            <Typography variant="body2" color="text.secondary">
              Registros de manutenção, revisões e serviços realizados nos veículos.
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            p: 2,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'flex-end',
            borderBottom: '1px solid',
            borderColor: colors.border,
            bgcolor: 'rgba(27, 42, 107, 0.02)',
          }}
        >
          <Autocomplete
            size="small"
            options={veiculos}
            value={veiculoSelecionado}
            onChange={(_, v) => setVeiculoSelecionado(v)}
            getOptionLabel={(v) => rotuloVeiculoLista(v)}
            isOptionEqualToValue={(a, b) => a.id_veiculo === b.id_veiculo}
            renderInput={(params) => <TextField {...params} label="Veículo" placeholder="Todos" />}
            sx={{ minWidth: 200, flex: '1 1 200px' }}
            clearOnEscape
          />
          <TextField
            size="small"
            label="Buscar placa ou modelo"
            value={buscaVeiculo}
            onChange={(e) => setBuscaVeiculo(e.target.value)}
            disabled={!!veiculoSelecionado}
            sx={{ minWidth: 160, flex: '1 1 160px' }}
          />
          <FiltroIntervaloDatasFrota
            dataInicio={dataInicio}
            dataFim={dataFim}
            onChangeInicio={setDataInicio}
            onChangeFim={setDataFim}
          />
          {filtrosAtivos && (
            <Button
              size="small"
              onClick={() => {
                setBuscaVeiculo('');
                setVeiculoSelecionado(null);
                setDataInicio('');
                setDataFim('');
              }}
              sx={{ mb: 0.25 }}
            >
              Limpar filtros
            </Button>
          )}
        </Box>

        {loading ? (
          <LinearProgress />
        ) : (
          <TableContainer sx={{ ...tableContainerSx, maxHeight: 520 }}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
                  <TableCell>Placa</TableCell>
                  <TableCell>Descrição</TableCell>
                  <TableCell>Usuário</TableCell>
                  <TableCell align="right">KM</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Realizada</TableCell>
                  <TableCell>Próxima</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listaFiltrada.map((m) => (
                  <TableRow key={m.id_manutencao} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{m.placa}</TableCell>
                    <TableCell sx={tableCellWrapSx}>{m.descricao}</TableCell>
                    <TableCell sx={tableCellWrapSx}>{m.nome_usuario}</TableCell>
                    <TableCell align="right">
                      {m.km != null ? m.km.toLocaleString('pt-BR') : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {m.valor != null
                        ? `R$ ${m.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </TableCell>
                    <TableCell>{fmtData(m.data_manutencao)}</TableCell>
                    <TableCell>{fmtData(m.proxima_manutencao)}</TableCell>
                  </TableRow>
                ))}
                {listaFiltrada.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nenhuma manutenção encontrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
