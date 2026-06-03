import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { api, fmtNota, fmtData } from '../api/client';
import type { VisitaResumo } from '../api/client';

export default function VisitasPage() {
  const [visitas, setVisitas] = useState<VisitaResumo[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.visitas().then(setVisitas).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Typography color="error">{err}</Typography>;
  if (!visitas.length)
    return (
      <Paper className="p-6 text-center">
        <Typography color="text.secondary">Nenhuma visita registrada ainda.</Typography>
        <Button component={Link} to="/checklist" variant="contained" sx={{ mt: 2 }}>
          Iniciar checklist
        </Button>
      </Paper>
    );

  return (
    <Paper>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Loja</TableCell>
            <TableCell>Data</TableCell>
            <TableCell>Duração</TableCell>
            <TableCell>Usuário</TableCell>
            <TableCell>Nota</TableCell>
            <TableCell>Status</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {visitas.map((v) => (
            <TableRow key={v.id_visita}>
              <TableCell>{v.name}</TableCell>
              <TableCell>{fmtData(v.data_visita)}</TableCell>
              <TableCell>{v.duracao_minutos ? `${v.duracao_minutos} min` : '—'}</TableCell>
              <TableCell>{v.nome_usuario}</TableCell>
              <TableCell>
                {v.nota_final != null ? (
                  <Chip label={fmtNota(v.nota_final)} size="small" color="warning" />
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                <Chip label={v.status} size="small" variant="outlined" />
              </TableCell>
              <TableCell>
                <Button component={Link} to={`/relatorio/visita/${v.id_visita}`} size="small">
                  Ver
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
