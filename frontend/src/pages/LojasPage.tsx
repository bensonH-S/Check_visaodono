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
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { api, fmtNota } from '../api/client';
import type { Loja } from '../api/client';

function notaChip(nota: number) {
  if (!nota) return <Chip label="—" size="small" />;
  const color = nota >= 85 ? 'success' : nota >= 75 ? 'warning' : 'error';
  return <Chip label={fmtNota(nota)} size="small" color={color} />;
}

export default function LojasPage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.lojas().then(setLojas).catch((e) => setErr(e.message));
  }, []);

  if (err) return <Typography color="error">{err}</Typography>;
  if (!lojas.length) return <LinearProgress />;

  const operacionais = lojas.filter((l) => l.bk_number);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {lojas.length} unidades cadastradas · {operacionais.length} lojas operacionais (com BKN)
      </Typography>
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Endereço</TableCell>
              <TableCell>CEP</TableCell>
              <TableCell>Cidade</TableCell>
              <TableCell>UF</TableCell>
              <TableCell>Bairro</TableCell>
              <TableCell>BKN</TableCell>
              <TableCell>CNPJ</TableCell>
              <TableCell>Razão social</TableCell>
              <TableCell>Ativa</TableCell>
              <TableCell>Nota</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {lojas.map((l) => (
              <TableRow key={l.id_loja} sx={{ opacity: l.is_active ? 1 : 0.6 }}>
                <TableCell sx={{ minWidth: 180 }}>{l.name}</TableCell>
                <TableCell sx={{ minWidth: 160 }}>{l.address}</TableCell>
                <TableCell>{l.zip_code}</TableCell>
                <TableCell>{l.city}</TableCell>
                <TableCell>{l.state}</TableCell>
                <TableCell>{l.neighborhood}</TableCell>
                <TableCell>{l.bk_number || '—'}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.cnpj}</TableCell>
                <TableCell sx={{ minWidth: 200 }}>{l.corporate_name}</TableCell>
                <TableCell>
                  <Chip
                    label={l.is_active ? 'Sim' : 'Não'}
                    size="small"
                    color={l.is_active ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>{notaChip(Number(l.nota_atual))}</TableCell>
                <TableCell>
                  {l.bk_number && (
                    <Button component={Link} to="/checklist" size="small" state={{ lojaId: l.id_loja }}>
                      Visita
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
