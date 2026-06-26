import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import 'dayjs/locale/pt-br';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { api } from '../../api/client';
import FiltroIntervaloDatasFrota from './FiltroIntervaloDatasFrota';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { dataDentroIntervalo } from '../../utils/frotaPortalFiltros';
import { montarRegistrosKm, ROTULO_TIPO_KM, type RegistroKmFrota } from '../../utils/frotaKmRegistros';
import { tableCellWrapSx, tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';

dayjs.extend(isoWeek);
dayjs.locale('pt-br');

export function periodoSemanaAtualKm() {
  return {
    inicio: dayjs().startOf('isoWeek').format('YYYY-MM-DD'),
    fim: dayjs().format('YYYY-MM-DD'),
  };
}

const COR_TIPO: Record<RegistroKmFrota['tipo'], 'primary' | 'success' | 'warning'> = {
  assuncao: 'primary',
  abastecimento: 'success',
  manutencao: 'warning',
};

type Props = {
  ativo?: boolean;
  dataInicio?: string;
  dataFim?: string;
  onChangeInicio?: (value: string) => void;
  onChangeFim?: (value: string) => void;
  ocultarFiltro?: boolean;
};

export default function FrotaVeiculosKmSemanaPanel({
  ativo = true,
  dataInicio: dataInicioProp,
  dataFim: dataFimProp,
  onChangeInicio,
  onChangeFim,
  ocultarFiltro = false,
}: Props) {
  const semana = periodoSemanaAtualKm();
  const [registros, setRegistros] = useState<RegistroKmFrota[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dataInicioLocal, setDataInicioLocal] = useState(semana.inicio);
  const [dataFimLocal, setDataFimLocal] = useState(semana.fim);

  const dataInicio = dataInicioProp ?? dataInicioLocal;
  const dataFim = dataFimProp ?? dataFimLocal;
  const setDataInicio = onChangeInicio ?? setDataInicioLocal;
  const setDataFim = onChangeFim ?? setDataFimLocal;

  const carregar = useCallback(() => {
    setLoading(true);
    setErro('');
    Promise.all([
      api.frotaAssuncoes(),
      api.frotaAbastecimentosPortal(),
      api.frotaManutencoesPortal(),
      api.frotaVeiculos(),
    ])
      .then(([assuncoes, abastecimentos, manutencoes, veiculos]) => {
        const veiculosPorId = new Map(
          veiculos.map((v) => [v.id_veiculo, { marca: v.marca, modelo: v.modelo }]),
        );
        setRegistros(montarRegistrosKm(assuncoes, abastecimentos, manutencoes, undefined, veiculosPorId));
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar quilometragem'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (ativo) carregar();
  }, [ativo, carregar]);

  const registrosFiltrados = useMemo(
    () => registros.filter((r) => dataDentroIntervalo(r.data, dataInicio, dataFim)),
    [registros, dataInicio, dataFim],
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {erro && (
        <Alert severity="error" onClose={() => setErro('')}>
          {erro}
        </Alert>
      )}

      {!ocultarFiltro && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            flexShrink: 0,
            border: '1px solid',
            borderColor: colors.border,
            borderRadius: 2,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'flex-end',
          }}
        >
          <FiltroIntervaloDatasFrota
            dataInicio={dataInicio}
            dataFim={dataFim}
            onChangeInicio={setDataInicio}
            onChangeFim={setDataFim}
          />
          <Typography variant="body2" color="text.secondary" sx={{ pb: 0.5 }}>
            {registrosFiltrados.length} registro{registrosFiltrados.length !== 1 ? 's' : ''}
          </Typography>
        </Paper>
      )}

      {ocultarFiltro && (
        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
          {registrosFiltrados.length} registro{registrosFiltrados.length !== 1 ? 's' : ''}
        </Typography>
      )}

      <Paper elevation={0} sx={{ ...tablePaperSx, flex: 1, minHeight: 0 }}>
        {loading && <LinearProgress />}
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Placa</TableCell>
                <TableCell>Veículo</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Detalhe</TableCell>
                <TableCell>Usuário</TableCell>
                <TableCell align="right">KM</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {registrosFiltrados.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.placa}</TableCell>
                  <TableCell sx={tableCellWrapSx}>{r.veiculo}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDataHoraBrasilia(r.data)}</TableCell>
                  <TableCell>
                    <Chip
                      label={ROTULO_TIPO_KM[r.tipo]}
                      size="small"
                      color={COR_TIPO[r.tipo]}
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ ...tableCellWrapSx, maxWidth: 220 }}>{r.detalhe}</TableCell>
                  <TableCell sx={tableCellWrapSx}>{r.usuario}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {r.km != null ? r.km.toLocaleString('pt-BR') : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && registrosFiltrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Nenhum registro de quilometragem no período selecionado.
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
