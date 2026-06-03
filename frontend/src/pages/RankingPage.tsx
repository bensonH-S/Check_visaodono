import { useEffect, useState } from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RemoveIcon from '@mui/icons-material/Remove';
import { api, fmtNota, fmtData, scoreColor } from '../api/client';
import type { RankingLoja } from '../api/client';

export default function RankingPage() {
  const [rows, setRows] = useState<RankingLoja[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.ranking().then(setRows).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Typography color="error">{err}</Typography>;
  if (!rows.length) return <LinearProgress />;

  const trend = (atual: number, anterior: number | null) => {
    if (anterior == null) return <RemoveIcon fontSize="small" color="disabled" />;
    if (atual > anterior) return <TrendingUpIcon fontSize="small" sx={{ color: '#3B6D11' }} />;
    if (atual < anterior) return <TrendingDownIcon fontSize="small" sx={{ color: '#A32D2D' }} />;
    return <RemoveIcon fontSize="small" color="disabled" />;
  };

  return (
    <Paper>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>#</TableCell>
            <TableCell>Loja</TableCell>
            <TableCell>Cidade</TableCell>
            <TableCell>Última visita</TableCell>
            <TableCell>Nota atual</TableCell>
            <TableCell>Anterior</TableCell>
            <TableCell>Tendência</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id_loja}>
              <TableCell>{r.posicao_ranking}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.city}/{r.state}</TableCell>
              <TableCell>{fmtData(r.ultima_visita)}</TableCell>
              <TableCell>
                <strong style={{ color: scoreColor(Number(r.nota_atual)) }}>
                  {fmtNota(r.nota_atual)}
                </strong>
              </TableCell>
              <TableCell>{r.nota_anterior != null ? fmtNota(r.nota_anterior) : '—'}</TableCell>
              <TableCell>{trend(Number(r.nota_atual), r.nota_anterior != null ? Number(r.nota_anterior) : null)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
