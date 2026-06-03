import { useEffect, useState } from 'react';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import { api, fmtData } from '../api/client';
import type { NcResponse } from '../api/client';

export default function NcPage() {
  const [data, setData] = useState<NcResponse | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.naoConformidades().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Typography color="error">{err}</Typography>;
  if (!data) return <LinearProgress />;

  const gravColor = (g: string) =>
    g === 'Crítica' ? 'error' : g === 'Moderada' ? 'warning' : 'default';

  return (
    <div>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper className="p-4">
            <Typography variant="caption" color="text.secondary">
              Total em aberto
            </Typography>
            <Typography variant="h4">{data.stats.total_aberto}</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper className="p-4 border-t-[3px] border-[#E8520A]">
            <Typography variant="caption" color="text.secondary">
              Críticas
            </Typography>
            <Typography variant="h4" color="primary">
              {data.stats.criticas}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Área</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Loja</TableCell>
              <TableCell>Data</TableCell>
              <TableCell>Gravidade</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((nc) => (
              <TableRow key={nc.id_nc}>
                <TableCell>{nc.area}</TableCell>
                <TableCell>{nc.descricao}</TableCell>
                <TableCell>{nc.name}</TableCell>
                <TableCell>{fmtData(nc.data_cadastro)}</TableCell>
                <TableCell>
                  <Chip label={nc.gravidade} size="small" color={gravColor(nc.gravidade)} />
                </TableCell>
                <TableCell>
                  <Chip
                    label={nc.status}
                    size="small"
                    color={nc.status === 'Resolvida' ? 'success' : 'warning'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
}
