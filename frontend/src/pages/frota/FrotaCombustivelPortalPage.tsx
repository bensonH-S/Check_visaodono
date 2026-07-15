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
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation';
import {
  api,
  fetchMediaAutenticada,
  type FrotaAbastecimentoPortal,
  type FrotaVeiculo,
} from '../../api/client';
import { rotuloVeiculoLista } from '../../constants/frotaVeiculo';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { dataDentroIntervalo } from '../../utils/frotaPortalFiltros';
import { tableCellWrapSx, tableContainerSx, tableSx } from '../../utils/tablePageLayout';

export default function FrotaCombustivelPortalPage() {
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [lista, setLista] = useState<FrotaAbastecimentoPortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<FrotaVeiculo | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([api.frotaVeiculos(), api.frotaAbastecimentosPortal()])
      .then(([v, ab]) => {
        setVeiculos(v);
        setLista(ab);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const listaFiltrada = useMemo(
    () =>
      lista.filter(
        (a) =>
          (!veiculoSelecionado || a.id_veiculo === veiculoSelecionado.id_veiculo) &&
          dataDentroIntervalo(a.data_abastecimento, dataInicio, dataFim),
      ),
    [lista, veiculoSelecionado, dataInicio, dataFim],
  );

  const total = listaFiltrada.reduce((s, a) => s + a.valor_abastecido, 0);
  const filtrosAtivos = veiculoSelecionado != null || !!dataInicio || !!dataFim;

  async function abrirComprovante(url: string) {
    try {
      const path = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      const blob = await fetchMediaAutenticada(path);
      window.open(blob, '_blank', 'noopener,noreferrer');
    } catch {
      /* ignore */
    }
  }

  return (
    <Box sx={{ pb: 4, flex: 1, minHeight: 0, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {listaFiltrada.length} de {lista.length} abastecimento{lista.length !== 1 ? 's' : ''}
          {listaFiltrada.length > 0 && ` · Total R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
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
            <LocalGasStationIcon />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Controle de combustível</Typography>
            <Typography variant="body2" color="text.secondary">
              Abastecimentos, valores, KM e comprovantes da frota.
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
            sx={{ minWidth: 240, flex: '1 1 240px' }}
            clearOnEscape
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
                  <TableCell>Usuário</TableCell>
                  <TableCell align="right">KM</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell align="center" width={120}>
                    Comprovante
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listaFiltrada.map((a) => (
                  <TableRow key={a.id_abastecimento} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{a.placa}</TableCell>
                    <TableCell sx={tableCellWrapSx}>{a.nome_usuario}</TableCell>
                    <TableCell align="right">{a.km_atual.toLocaleString('pt-BR')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: colors.navy }}>
                      R$ {a.valor_abastecido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{formatDataHoraBrasilia(a.data_abastecimento)}</TableCell>
                    <TableCell align="center">
                      {a.comprovante_url ? (
                        <Button size="small" onClick={() => void abrirComprovante(a.comprovante_url!)}>
                          Ver
                        </Button>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {listaFiltrada.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nenhum abastecimento encontrado.
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
