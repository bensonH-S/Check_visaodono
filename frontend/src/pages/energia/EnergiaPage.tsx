import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import AddIcon from '@mui/icons-material/Add';
import BoltIcon from '@mui/icons-material/Bolt';
import { api, type EnergiaChamado } from '../../api/client';
import { getUsuario, podeAbrirEnergia } from '../../lib/auth';
import { formatDataHoraBalaoMapa } from '../../utils/dateBr';
import { tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../../utils/tablePageLayout';
import { colors } from '../../theme/tokens';
import {
  STATUS_ENERGIA,
  rotuloTipoOcorrencia,
  type EnergiaStatus,
} from './energiaConstants';

type Filtro = 'abertos' | 'finalizados' | 'todos';

export default function EnergiaPage() {
  const navigate = useNavigate();
  const podeAbrir = podeAbrirEnergia(getUsuario());
  const [itens, setItens] = useState<EnergiaChamado[]>([]);
  const [stats, setStats] = useState({ total_aberto: 0, total_finalizado: 0 });
  const [filtro, setFiltro] = useState<Filtro>('abertos');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    const status =
      filtro === 'abertos' ? undefined : filtro === 'finalizados' ? 'finalizado' : undefined;
    api
      .energiaChamados(status ? { status } : undefined)
      .then((res) => {
        const lista =
          filtro === 'abertos'
            ? res.items.filter((i) => i.status === 'aberto' || i.status === 'em_andamento')
            : res.items;
        setItens(lista);
        setStats(res.stats);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filtro]);

  const resumo = useMemo(
    () => [
      { label: 'Em aberto', valor: stats.total_aberto },
      { label: 'Finalizados', valor: stats.total_finalizado },
    ],
    [stats],
  );

  return (
    <Box sx={tablePageLayoutSx}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: colors.navy, display: 'flex', alignItems: 'center', gap: 1 }}>
            <BoltIcon sx={{ color: colors.orange }} />
            Chamados de energia
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Protocolo da concessionária, fotos e status — evidência se queimar equipamento.
          </Typography>
        </Box>
        {podeAbrir && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/energia/novo')}>
            Registrar ocorrência
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {resumo.map((r) => (
          <Paper key={r.label} variant="outlined" sx={{ px: 2, py: 1, minWidth: 120 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: colors.navy, lineHeight: 1.1 }}>
              {loading ? '—' : r.valor}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {r.label}
            </Typography>
          </Paper>
        ))}
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filtro}
        onChange={(_, v: Filtro | null) => v && setFiltro(v)}
      >
        <ToggleButton value="abertos">Em aberto</ToggleButton>
        <ToggleButton value="finalizados">Finalizados</ToggleButton>
        <ToggleButton value="todos">Todos</ToggleButton>
      </ToggleButtonGroup>

      {err && <Alert severity="error">{err}</Alert>}
      {loading && <LinearProgress />}

      <Paper sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Loja</TableCell>
                <TableCell>Protocolo</TableCell>
                <TableCell>Concessionária</TableCell>
                <TableCell>Ocorrência</TableCell>
                <TableCell>Quando</TableCell>
                <TableCell>Fotos</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!loading && !itens.length && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                      Nenhum chamado de energia neste filtro.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {itens.map((c) => {
                const st = STATUS_ENERGIA[c.status as EnergiaStatus];
                return (
                  <TableRow
                    key={c.id_chamado}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/energia/${c.id_chamado}`)}
                  >
                    <TableCell sx={{ fontWeight: 700, color: colors.navy }}>{c.numero}</TableCell>
                    <TableCell>{c.nome_loja}</TableCell>
                    <TableCell sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                      {c.protocolo}
                    </TableCell>
                    <TableCell>{c.concessionaria}</TableCell>
                    <TableCell>{rotuloTipoOcorrencia(c.tipo_ocorrencia)}</TableCell>
                    <TableCell>{formatDataHoraBalaoMapa(c.ocorrido_em)}</TableCell>
                    <TableCell>{c.qtd_fotos}</TableCell>
                    <TableCell>
                      <Chip size="small" label={st?.label ?? c.status} color={st?.color ?? 'default'} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
