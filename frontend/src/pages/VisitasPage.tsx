import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { api, fmtNota, fmtData, notaChipSx } from '../api/client';
import type { VisitaResumo } from '../api/client';
import { tableCellWrapSx, tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../utils/tablePageLayout';
import { colors } from '../theme/tokens';

const STATUS_VISITA = [
  { value: 'Rascunho', label: 'Rascunho', color: '#92400E', bg: '#FEF3C7', accent: '#F59E0B' },
  { value: 'Finalizada', label: 'Finalizada', color: '#166534', bg: '#DCFCE7', accent: '#22C55E' },
] as const;

function notaChip(nota: string | number | null | undefined) {
  if (nota == null) return '—';
  const valor = Number(nota);
  return <Chip label={fmtNota(valor)} size="small" sx={notaChipSx(valor)} />;
}

function statusChip(status: string) {
  const cfg = STATUS_VISITA.find((s) => s.value === status);
  if (!cfg) {
    return <Chip label={status} size="small" variant="outlined" />;
  }
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: '0.72rem',
        color: cfg.color,
        bgcolor: cfg.bg,
        border: `1px solid ${cfg.accent}40`,
      }}
    />
  );
}

export default function VisitasPage() {
  const [visitas, setVisitas] = useState<VisitaResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  useEffect(() => {
    api
      .visitas()
      .then(setVisitas)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const contagemPorStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of STATUS_VISITA) map.set(s.value, 0);
    for (const v of visitas) {
      map.set(v.status, (map.get(v.status) ?? 0) + 1);
    }
    return map;
  }, [visitas]);

  const visitasFiltradas = useMemo(
    () => (filtroStatus ? visitas.filter((v) => v.status === filtroStatus) : visitas),
    [visitas, filtroStatus],
  );

  if (loading) return <LinearProgress />;

  if (err) return <Typography color="error">{err}</Typography>;

  if (!visitas.length) {
    return (
      <Box sx={tablePageLayoutSx}>
        <Paper
          elevation={0}
          sx={{
            ...tablePaperSx,
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography color="text.secondary">Nenhuma visita registrada ainda.</Typography>
          <Button component={Link} to="/checklist" variant="contained" sx={{ mt: 2 }}>
            Iniciar checklist
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={tablePageLayoutSx}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {visitasFiltradas.length} de {visitas.length} visita(s)
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
        <Chip
          label={`Todos · ${visitas.length}`}
          onClick={() => setFiltroStatus('')}
          variant={filtroStatus === '' ? 'filled' : 'outlined'}
          sx={{
            fontWeight: 700,
            bgcolor: filtroStatus === '' ? colors.navy : 'white',
            color: filtroStatus === '' ? 'white' : colors.navy,
            borderColor: colors.navyBorder,
          }}
        />
        {STATUS_VISITA.map((st) => {
          const qtd = contagemPorStatus.get(st.value) ?? 0;
          const ativo = filtroStatus === st.value;
          return (
            <Chip
              key={st.value}
              label={`${st.label} · ${qtd}`}
              onClick={() => setFiltroStatus(ativo ? '' : st.value)}
              variant={ativo ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 600,
                fontSize: '0.78rem',
                bgcolor: ativo ? st.bg : 'white',
                color: ativo ? st.color : 'text.secondary',
                borderColor: `${st.accent}50`,
              }}
            />
          );
        })}
      </Box>

      <Paper elevation={0} sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>Loja</TableCell>
                <TableCell>Checklist</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>Duração</TableCell>
                <TableCell>Usuário</TableCell>
                <TableCell align="center">Nota</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center" width={88} />
              </TableRow>
            </TableHead>
            <TableBody>
              {visitasFiltradas.map((v) => (
                <TableRow key={v.id_visita} hover>
                  <TableCell sx={tableCellWrapSx}>{v.name}</TableCell>
                  <TableCell sx={tableCellWrapSx}>
                    {v.tipo_checklist_nome ?? 'Auditoria Operacional'}
                  </TableCell>
                  <TableCell>{fmtData(v.data_visita)}</TableCell>
                  <TableCell>{v.duracao_minutos ? `${v.duracao_minutos} min` : '—'}</TableCell>
                  <TableCell sx={tableCellWrapSx}>{v.nome_usuario}</TableCell>
                  <TableCell align="center">{notaChip(v.nota_final)}</TableCell>
                  <TableCell align="center">{statusChip(v.status)}</TableCell>
                  <TableCell align="center">
                    <Button component={Link} to={`/relatorio/visita/${v.id_visita}`} size="small">
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!visitasFiltradas.length && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Nenhuma visita com este status.
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
