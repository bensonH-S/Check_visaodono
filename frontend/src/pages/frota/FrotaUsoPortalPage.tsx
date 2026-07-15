import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Divider from '@mui/material/Divider';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import { api, type FrotaAssuncao, type FrotaVeiculo } from '../../api/client';
import { rotuloVeiculoLista } from '../../constants/frotaVeiculo';
import FiltroIntervaloDatasFrota from '../../components/frota/FiltroIntervaloDatasFrota';
import { colors } from '../../theme/tokens';
import { formatDataHoraBrasilia } from '../../utils/dateBr';
import { dataDentroIntervalo, matchVeiculo, matchVeiculoObj } from '../../utils/frotaPortalFiltros';
import { tableCellWrapSx, tableContainerSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';

function SecaoTitulo({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, mt: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {children}
      </Typography>
      {extra}
    </Box>
  );
}

const COR_EM_USO = '#2e7d32';
const COR_LIVRE = '#546e7a';

function chipLivreSx() {
  return {
    fontWeight: 700,
    height: 22,
    bgcolor: 'rgba(84, 110, 122, 0.14)',
    color: COR_LIVRE,
    border: '1px solid rgba(84, 110, 122, 0.4)',
  } as const;
}

function VeiculoPortalCard({
  veiculo,
  variant,
}: {
  veiculo: FrotaVeiculo;
  variant: 'em_uso' | 'livre';
}) {
  const emUso = variant === 'em_uso';
  const corStatus = emUso ? COR_EM_USO : COR_LIVRE;
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        border: '1px solid',
        borderColor: emUso ? 'rgba(46, 125, 50, 0.25)' : 'rgba(84, 110, 122, 0.28)',
        borderLeft: `4px solid ${corStatus}`,
        borderRadius: 2,
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: emUso ? 'rgba(46, 125, 50, 0.1)' : 'rgba(84, 110, 122, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: corStatus,
          }}
        >
          <DirectionsCarIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 0.5, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography sx={{ fontWeight: 700 }}>{veiculo.placa}</Typography>
            <Chip
              label={emUso ? 'Em uso' : 'Livre'}
              size="small"
              color={emUso ? 'success' : undefined}
              variant={emUso ? 'outlined' : 'filled'}
              sx={emUso ? { fontWeight: 600, height: 22 } : chipLivreSx()}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.35 }}>
            {[veiculo.marca, veiculo.modelo].filter(Boolean).join(' ') || 'Veículo'}
          </Typography>
          {emUso && veiculo.nome_responsavel && (
            <Typography variant="body2" sx={{ mt: 0.75 }}>
              Responsável: <strong>{veiculo.nome_responsavel}</strong>
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {veiculo.km_atual != null ? `KM ${veiculo.km_atual.toLocaleString('pt-BR')}` : 'KM —'}
            {emUso && veiculo.assuncao_em ? ` · Desde ${formatDataHoraBrasilia(veiculo.assuncao_em)}` : ''}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default function FrotaUsoPortalPage() {
  const [veiculos, setVeiculos] = useState<FrotaVeiculo[]>([]);
  const [assuncoes, setAssuncoes] = useState<FrotaAssuncao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [buscaVeiculo, setBuscaVeiculo] = useState('');
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<FrotaVeiculo | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const carregar = useCallback(() => {
    setLoading(true);
    Promise.all([api.frotaVeiculos(), api.frotaAssuncoes()])
      .then(([v, a]) => {
        setVeiculos(v);
        setAssuncoes(a);
      })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const idVeiculoFiltro = veiculoSelecionado?.id_veiculo ?? null;

  const emUso = useMemo(
    () => veiculos.filter((v) => v.id_usuario_responsavel && matchVeiculoObj(v, idVeiculoFiltro, buscaVeiculo)),
    [veiculos, idVeiculoFiltro, buscaVeiculo],
  );

  const livres = useMemo(
    () => veiculos.filter((v) => !v.id_usuario_responsavel && matchVeiculoObj(v, idVeiculoFiltro, buscaVeiculo)),
    [veiculos, idVeiculoFiltro, buscaVeiculo],
  );

  const assuncoesFiltradas = useMemo(
    () =>
      assuncoes.filter(
        (a) =>
          matchVeiculo(a, idVeiculoFiltro, buscaVeiculo, veiculos) &&
          dataDentroIntervalo(a.data_inicio, dataInicio, dataFim),
      ),
    [assuncoes, idVeiculoFiltro, buscaVeiculo, veiculos, dataInicio, dataFim],
  );

  function limparFiltros() {
    setBuscaVeiculo('');
    setVeiculoSelecionado(null);
    setDataInicio('');
    setDataFim('');
  }

  const filtrosAtivos = !!buscaVeiculo.trim() || veiculoSelecionado != null || !!dataInicio || !!dataFim;

  return (
    <Box sx={{ pb: 4, flex: 1, minHeight: 0, overflow: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {emUso.length} em uso ·{' '}
          <Box component="span" sx={{ color: COR_LIVRE, fontWeight: 600 }}>
            {livres.length} livre{livres.length !== 1 ? 's' : ''}
          </Box>{' '}
          · {assuncoesFiltradas.length} assunç{assuncoesFiltradas.length !== 1 ? 'ões' : 'ão'}
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
          p: 2,
          mb: 2,
          border: '1px solid',
          borderColor: colors.border,
          borderRadius: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'flex-end',
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
          sx={{ minWidth: 220, flex: '1 1 220px' }}
          clearOnEscape
        />
        <TextField
          size="small"
          label="Buscar placa ou modelo"
          value={buscaVeiculo}
          onChange={(e) => setBuscaVeiculo(e.target.value)}
          disabled={!!veiculoSelecionado}
          sx={{ minWidth: 180, flex: '1 1 180px' }}
        />
        <FiltroIntervaloDatasFrota
          dataInicio={dataInicio}
          dataFim={dataFim}
          onChangeInicio={setDataInicio}
          onChangeFim={setDataFim}
        />
        {filtrosAtivos && (
          <Button size="small" onClick={limparFiltros} sx={{ mb: 0.25 }}>
            Limpar filtros
          </Button>
        )}
      </Paper>

      {loading ? (
        <LinearProgress />
      ) : (
        <>
          <SecaoTitulo extra={<Chip label={emUso.length} size="small" color="success" variant="outlined" />}>
            Em uso no momento
          </SecaoTitulo>
          {emUso.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum veículo em uso com os filtros atuais.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 1.5,
              }}
            >
              {emUso.map((v) => (
                <VeiculoPortalCard key={v.id_veiculo} veiculo={v} variant="em_uso" />
              ))}
            </Box>
          )}

          <SecaoTitulo
            extra={
              <Chip
                label={livres.length}
                size="small"
                variant="outlined"
                sx={{
                  color: COR_LIVRE,
                  borderColor: 'rgba(84, 110, 122, 0.45)',
                  bgcolor: 'rgba(84, 110, 122, 0.08)',
                  fontWeight: 700,
                }}
              />
            }
          >
            Veículos livres
          </SecaoTitulo>
          {livres.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhum veículo livre com os filtros atuais.
            </Typography>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 1.5,
              }}
            >
              {livres.map((v) => (
                <VeiculoPortalCard key={v.id_veiculo} veiculo={v} variant="livre" />
              ))}
            </Box>
          )}

          <Divider sx={{ mt: 3, mb: 0 }} />

          <SecaoTitulo
            extra={
              <Typography variant="caption" color="text.secondary">
                {assuncoesFiltradas.length} registro{assuncoesFiltradas.length !== 1 ? 's' : ''}
              </Typography>
            }
          >
            Histórico de assunções
          </SecaoTitulo>
          <Paper elevation={0} sx={{ ...tablePaperSx, maxHeight: 520 }}>
            <TableContainer sx={{ ...tableContainerSx, maxHeight: 520 }}>
              <Table size="small" stickyHeader sx={tableSx}>
                <TableHead>
                  <TableRow>
                    <TableCell>Placa</TableCell>
                    <TableCell>Usuário</TableCell>
                    <TableCell>Início</TableCell>
                    <TableCell>Fim</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">KM início</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {assuncoesFiltradas.map((a) => (
                    <TableRow key={a.id_assuncao} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{a.placa}</TableCell>
                      <TableCell sx={tableCellWrapSx}>{a.nome_usuario}</TableCell>
                      <TableCell>{formatDataHoraBrasilia(a.data_inicio)}</TableCell>
                      <TableCell>{a.data_fim ? formatDataHoraBrasilia(a.data_fim) : '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={a.data_fim ? 'Encerrado' : 'Atribuído'}
                          size="small"
                          color={a.data_fim ? 'error' : 'success'}
                          variant="filled"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {a.km_inicio != null ? a.km_inicio.toLocaleString('pt-BR') : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {assuncoesFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        Nenhuma assunção encontrada.
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
