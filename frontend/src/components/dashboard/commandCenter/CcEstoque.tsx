import { useMemo } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { fmtBrl, fmtInt, lojaLabel } from './ccFormat';
import CcCard, { CcVazio } from './CcCard';
import type { ItemZerado } from './useCcData';

function lojaCurta(name: string) {
  return lojaLabel(name).replace(/^BURGER KING\s*[-–]\s*/i, '').trim() || name;
}

/** Estoque: SKUs zerados por loja, com o total da rede no cabeçalho. */
export default function CcEstoque({
  zerados,
  baixa,
  valorAtual,
  loading,
  erro,
}: {
  zerados: ItemZerado[];
  baixa: number;
  valorAtual: number | null;
  loading: boolean;
  erro: string;
}) {
  const porLoja = useMemo(() => {
    const map = new Map<number, { loja: string; n: number }>();
    for (const z of zerados) {
      const cur = map.get(z.id_loja) || { loja: lojaCurta(z.loja), n: 0 };
      cur.n += 1;
      map.set(z.id_loja, cur);
    }
    return [...map.values()].sort((a, b) => b.n - a.n || a.loja.localeCompare(b.loja, 'pt-BR'));
  }, [zerados]);

  const total = zerados.length;
  const meta = !loading && !erro ? `${fmtBrl(valorAtual)} na rede · ${fmtInt(total)} zerados · ${fmtInt(baixa)} em baixa` : undefined;

  return (
    <CcCard title="Estoque" meta={meta} action="Ver estoque" actionTo="/estoque">
      {loading ? (
        <Box sx={{ p: 1.5 }}>
          <Skeleton variant="rounded" height={160} />
        </Box>
      ) : erro ? (
        <CcVazio>{erro}</CcVazio>
      ) : !porLoja.length ? (
        <CcVazio>Nenhum SKU zerado na rede.</CcVazio>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Loja</TableCell>
                <TableCell sx={{ width: '42%' }}>Participação</TableCell>
                <TableCell align="right" sx={{ width: 72 }}>Zerados</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {porLoja.map((l) => (
                <TableRow key={l.loja} hover>
                  <TableCell sx={{ maxWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.loja}</Typography>
                  </TableCell>
                  <TableCell>
                    <LinearProgress
                      variant="determinate"
                      value={total ? (l.n / total) * 100 : 0}
                      color={l.n === porLoja[0].n ? 'error' : 'primary'}
                      sx={{ height: 5, borderRadius: 5 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtInt(l.n)}
                    <Typography component="span" sx={{ fontSize: 10.5, color: 'text.secondary', ml: 0.5 }}>
                      {total ? `${Math.round((l.n / total) * 100)}%` : ''}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </CcCard>
  );
}
