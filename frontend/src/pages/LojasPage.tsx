import { useEffect, useState } from 'react';
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
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { api, fmtNota, notaChipSx } from '../api/client';
import type { Loja } from '../api/client';
import LojaEditDialog from '../components/lojas/LojaEditDialog';
import { colors } from '../theme/tokens';
import { tableCellWrapSx, tableContainerSx, tablePageLayoutSx, tablePaperSx, tableSx } from '../utils/tablePageLayout';

function notaChip(nota: number) {
  if (!nota) return <Chip label="—" size="small" />;
  return <Chip label={fmtNota(nota)} size="small" sx={notaChipSx(nota)} />;
}

function formatarCidadeUf(city?: string | null, state?: string | null): string {
  const cidade = city?.trim();
  const uf = state?.trim();
  if (cidade && uf) return `${cidade}-${uf}`;
  return cidade || uf || '—';
}

export default function LojasPage() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [lojaEditando, setLojaEditando] = useState<Loja | null>(null);

  useEffect(() => {
    api
      .lojas()
      .then(setLojas)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ width: '100%' }}>
        <LinearProgress />
      </Box>
    );
  }

  if (err) return <Typography color="error">{err}</Typography>;

  const operacionais = lojas.filter((l) => l.bk_number);

  return (
    <Box sx={tablePageLayoutSx}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {lojas.length} unidades cadastradas · {operacionais.length} lojas operacionais (com BKN)
      </Typography>

      <Paper elevation={0} sx={tablePaperSx}>
        <TableContainer sx={tableContainerSx}>
          <Table size="small" stickyHeader sx={tableSx}>
            <TableHead>
              <TableRow>
                <TableCell>BKN</TableCell>
                <TableCell>Nome</TableCell>
                <TableCell>Endereço</TableCell>
                <TableCell>Cidade</TableCell>
                <TableCell>Bairro</TableCell>
                <TableCell>Ativa</TableCell>
                <TableCell>Nota</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {lojas.map((l) => (
                <TableRow key={l.id_loja} sx={{ opacity: l.is_active ? 1 : 0.6 }}>
                  <TableCell>{l.bk_number || '—'}</TableCell>
                  <TableCell
                    sx={{
                      ...tableCellWrapSx,
                      cursor: 'pointer',
                      color: colors.navy,
                      fontWeight: 600,
                      '&:hover': { textDecoration: 'underline' },
                    }}
                    onClick={() => setLojaEditando(l)}
                  >
                    {l.name}
                  </TableCell>
                  <TableCell sx={tableCellWrapSx}>{l.address}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatarCidadeUf(l.city, l.state)}</TableCell>
                  <TableCell>{l.neighborhood}</TableCell>
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
        </TableContainer>
      </Paper>

      <LojaEditDialog
        open={lojaEditando != null}
        loja={lojaEditando}
        onClose={() => setLojaEditando(null)}
        onSalvo={(atualizada) => {
          setLojas((lista) => lista.map((item) => (item.id_loja === atualizada.id_loja ? { ...item, ...atualizada } : item)));
        }}
      />
    </Box>
  );
}
