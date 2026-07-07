import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { api, type FrotaTermoPortalResumo } from '../../api/client';
import FrotaTermoAssinadoModal from '../../components/frota/FrotaTermoAssinadoModal';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { dataDentroIntervalo } from '../../utils/frotaPortalFiltros';
import { tableCellWrapSx, tableContainerSx, tableSx } from '../../utils/tablePageLayout';

export default function FrotaTermosPortalPage() {
  const navigate = useNavigate();
  const [termos, setTermos] = useState<FrotaTermoPortalResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [termoModalId, setTermoModalId] = useState<number | null>(null);

  const carregar = useCallback(() => {
    setLoading(true);
    api
      .frotaTermosPortal()
      .then(setTermos)
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const termosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return termos.filter((t) => {
      if (!dataDentroIntervalo(t.assinado_em, dataInicio, dataFim)) return false;
      if (!q) return true;
      return t.nome_usuario.toLowerCase().includes(q);
    });
  }, [termos, busca, dataInicio, dataFim]);

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton size="small" onClick={() => navigate('/frota')} aria-label="Voltar">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" color="text.secondary">
          {termosFiltrados.length} de {termos.length} assinatura{termos.length !== 1 ? 's' : ''}
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
            <AssignmentTurnedInIcon />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Termos de ferramentas assinados</Typography>
            <Typography variant="body2" color="text.secondary">
              Consulte quem assinou o termo de compromisso e visualize o documento.
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
          <TextField
            size="small"
            label="Buscar colaborador"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ minWidth: 200, flex: '1 1 200px' }}
          />
          <FiltroIntervaloDatasFrota
            dataInicio={dataInicio}
            dataFim={dataFim}
            onChangeInicio={setDataInicio}
            onChangeFim={setDataFim}
          />
          {(busca.trim() || dataInicio || dataFim) && (
            <Button
              size="small"
              onClick={() => {
                setBusca('');
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
                  <TableCell>Colaborador</TableCell>
                  <TableCell>Região</TableCell>
                  <TableCell>Assinado em</TableCell>
                  <TableCell align="center" width={140}>
                    Termo assinado
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {termosFiltrados.map((t) => (
                  <TableRow key={t.id_termo} hover>
                    <TableCell sx={{ ...tableCellWrapSx, fontWeight: 600 }}>{t.nome_usuario}</TableCell>
                    <TableCell sx={tableCellWrapSx}>{t.nome_regiao || '—'}</TableCell>
                    <TableCell>{formatDataHoraBrasilia(t.assinado_em)}</TableCell>
                    <TableCell align="center">
                      <Button size="small" onClick={() => setTermoModalId(t.id_termo)}>
                        Ver termo
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {termosFiltrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      Nenhum termo assinado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <FrotaTermoAssinadoModal
        idTermo={termoModalId}
        open={termoModalId != null}
        onClose={() => setTermoModalId(null)}
      />
    </Box>
  );
}
