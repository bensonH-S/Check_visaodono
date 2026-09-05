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
import {
  api,
  type FrotaVeiculo,
} from '../../api/client';
import FiltroIntervaloDatasFrota from './FiltroIntervaloDatasFrota';
import { colors } from '../../theme/tokens';
import { useAppTheme } from '../../context/ThemeContext';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { dataDentroIntervalo } from '../../utils/frotaPortalFiltros';
import { montarRegistrosKm, ROTULO_TIPO_KM, type RegistroKmFrota } from '../../utils/frotaKmRegistros';
import { tableCellWrapSx, tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';

dayjs.extend(isoWeek);
dayjs.locale('pt-br');

const COR_TIPO: Record<RegistroKmFrota['tipo'], 'primary' | 'success' | 'warning'> = {
  assuncao: 'primary',
  abastecimento: 'success',
  manutencao: 'warning',
};

function ResumoKm({ label, valor }: { label: string; valor: string }) {
  const { mode } = useAppTheme();
  const acento = mode === 'dark' ? '#E8520A' : colors.navy;
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        flex: 1,
        minWidth: 100,
        border: '1px solid',
        borderColor: colors.border,
        borderRadius: 2,
        borderTop: `3px solid ${acento}`,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: acento }}>{valor}</Typography>
    </Paper>
  );
}

type Props = {
  idVeiculo: number;
  ativo?: boolean;
  /** Dentro do modal de edição — limita altura da tabela. */
  emDialogo?: boolean;
  dataInicio?: string;
  dataFim?: string;
  onChangeInicio?: (value: string) => void;
  onChangeFim?: (value: string) => void;
  /** Filtro renderizado na barra de abas do modal. */
  ocultarFiltro?: boolean;
};

export default function FrotaVeiculoKmPanel({
  idVeiculo,
  ativo: _ativo = true,
  emDialogo = false,
  dataInicio: dataInicioProp,
  dataFim: dataFimProp,
  onChangeInicio,
  onChangeFim,
  ocultarFiltro = false,
}: Props) {
  const [veiculo, setVeiculo] = useState<FrotaVeiculo | null>(null);
  const [registros, setRegistros] = useState<RegistroKmFrota[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dataInicioLocal, setDataInicioLocal] = useState('');
  const [dataFimLocal, setDataFimLocal] = useState('');

  const dataInicio = dataInicioProp ?? dataInicioLocal;
  const dataFim = dataFimProp ?? dataFimLocal;
  const setDataInicio = onChangeInicio ?? setDataInicioLocal;
  const setDataFim = onChangeFim ?? setDataFimLocal;

  const carregar = useCallback(() => {
    if (!Number.isFinite(idVeiculo)) return;
    setLoading(true);
    setErro('');
    Promise.all([
      api.frotaVeiculo(idVeiculo),
      api.frotaAssuncoes(idVeiculo),
      api.frotaAbastecimentosPortal(),
      api.frotaManutencoesPortal(),
    ])
      .then(([v, assuncoes, abastecimentos, manutencoes]) => {
        setVeiculo(v);
        const veiculosPorId = new Map([[v.id_veiculo, { marca: v.marca, modelo: v.modelo }]]);
        setRegistros(montarRegistrosKm(assuncoes, abastecimentos, manutencoes, idVeiculo, veiculosPorId));
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar KM'))
      .finally(() => setLoading(false));
  }, [idVeiculo]);

  useEffect(() => {
    if (!Number.isFinite(idVeiculo)) return;
    carregar();
  }, [idVeiculo, carregar]);

  const registrosFiltrados = useMemo(
    () => registros.filter((r) => dataDentroIntervalo(r.data, dataInicio, dataFim)),
    [registros, dataInicio, dataFim],
  );

  const kmRodado = useMemo(() => {
    const ini = veiculo?.km_inicial ?? veiculo?.km_atual;
    const atual = veiculo?.km_atual;
    if (ini == null || atual == null || atual < ini) return null;
    return atual - ini;
  }, [veiculo]);

  const fmt = (n: number | null | undefined) =>
    n != null ? `${n.toLocaleString('pt-BR')} km` : '—';

  if (loading && !veiculo) return <LinearProgress sx={{ my: 1 }} />;

  const alturaTabela = emDialogo ? 320 : undefined;

  return (
    <Box sx={emDialogo ? { display: 'flex', flexDirection: 'column', minHeight: 0 } : undefined}>
      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <ResumoKm label="KM inicial" valor={fmt(veiculo?.km_inicial ?? veiculo?.km_atual)} />
        <ResumoKm label="KM atual" valor={fmt(veiculo?.km_atual)} />
        <ResumoKm label="KM rodado" valor={kmRodado != null ? fmt(kmRodado) : '—'} />
      </Box>

      {!ocultarFiltro && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            alignItems: 'flex-end',
            mb: 1.5,
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
        </Box>
      )}

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
        Histórico de quilometragem
      </Typography>

      {loading ? (
        <LinearProgress sx={{ mb: 1 }} />
      ) : (
        <Paper
          elevation={0}
          sx={{
            ...tablePaperSx,
            ...(emDialogo ? { flex: 1, minHeight: 0, maxHeight: alturaTabela } : {}),
          }}
        >
          <TableContainer sx={{ ...tableContainerSx, ...(alturaTabela ? { maxHeight: alturaTabela } : {}) }}>
            <Table size="small" stickyHeader sx={tableSx}>
              <TableHead>
                <TableRow>
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatDataHoraBrasilia(r.data)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ROTULO_TIPO_KM[r.tipo]}
                        size="small"
                        color={COR_TIPO[r.tipo]}
                        variant="outlined"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell sx={{ ...tableCellWrapSx, maxWidth: 180 }}>{r.detalhe}</TableCell>
                    <TableCell sx={tableCellWrapSx}>{r.usuario}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {r.km != null ? r.km.toLocaleString('pt-BR') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {registrosFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nenhum registro de KM no período selecionado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
