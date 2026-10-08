import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { EstoqueContagemRedeItem } from '../../../api/client';
import { fmtInt, lojaLabel } from './ccFormat';
import CcCard, { CcVazio } from './CcCard';
import { chipSx, tom } from './ccTons';

function lojaCurta(name: string) {
  return lojaLabel(name).replace(/^BURGER KING\s*[-–]\s*/i, '').trim() || name;
}

function hora(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const ORDEM = { faltou: 0, aberta: 1, contou: 2 } as const;

/** Contagem diária por loja: situação, quem contou e quando. */
export default function CcContagem({ lojas, loading, erro }: { lojas: EstoqueContagemRedeItem[]; loading: boolean; erro: string }) {
  const escuro = useTheme().palette.mode === 'dark';

  const linhas = useMemo(
    () =>
      [...lojas].sort(
        (a, b) =>
          ORDEM[a.status] - ORDEM[b.status] ||
          (b.finalizado_em || b.contado_em || '').localeCompare(a.finalizado_em || a.contado_em || '') ||
          lojaCurta(a.name).localeCompare(lojaCurta(b.name), 'pt-BR'),
      ),
    [lojas],
  );

  const contou = lojas.filter((l) => l.status === 'contou').length;
  const faltou = lojas.filter((l) => l.status === 'faltou').length;
  const meta = !loading && !erro && lojas.length ? `${fmtInt(contou)} de ${fmtInt(lojas.length)} fecharam${faltou ? ` · ${fmtInt(faltou)} não contaram` : ''}` : undefined;

  return (
    <CcCard title="Contagem diária" meta={meta} action="Ver estoque" actionTo="/estoque">
      {loading ? (
        <Box sx={{ p: 1.5 }}>
          <Skeleton variant="rounded" height={160} />
        </Box>
      ) : erro ? (
        <CcVazio>{erro}</CcVazio>
      ) : !linhas.length ? (
        <CcVazio>Nenhuma loja no escopo.</CcVazio>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Loja</TableCell>
                <TableCell sx={{ width: 116 }}>Situação</TableCell>
                <TableCell>Quem contou</TableCell>
                <TableCell align="right" sx={{ width: 56 }}>Hora</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {linhas.map((l) => {
                const t = l.status === 'contou' ? tom('verde', escuro) : l.status === 'aberta' ? tom('ambar', escuro) : tom('vermelho', escuro);
                const rotulo = l.status === 'contou' ? 'Fechada' : l.status === 'aberta' ? 'Em andamento' : 'Não contou';
                const quem = (l.criado_por_nome || l.ultima_por_nome || '').trim();
                return (
                  <TableRow key={l.id_loja} hover>
                    <TableCell sx={{ maxWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lojaCurta(l.name)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={rotulo} sx={chipSx(t)} />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 0, color: quem ? 'inherit' : 'text.disabled', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.status === 'contou' ? quem || '—' : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                      {l.status === 'contou' ? hora(l.finalizado_em || l.contado_em) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </CcCard>
  );
}
