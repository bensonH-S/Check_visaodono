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
import type { Despesa } from '../../../financeiro/api';
import { fmtBrl, fmtInt } from './ccFormat';
import CcCard, { CcVazio } from './CcCard';
import { chipSx, tom } from './ccTons';

const FECHADAS = ['paga', 'conciliada', 'cancelada'];

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diasAte(venc: string, hoje: string) {
  const a = new Date(`${venc.slice(0, 10)}T00:00:00`);
  const b = new Date(`${hoje}T00:00:00`);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function ddmm(d: string | null) {
  if (!d) return '—';
  const [, m, dia] = d.slice(0, 10).split('-');
  return `${dia}/${m}`;
}

/** Fila de pagamento: vencidas, depois para autorizar, depois por vencimento. */
export default function CcFilaPagamento({ despesas, loading, erro }: { despesas: Despesa[]; loading: boolean; erro: string }) {
  const escuro = useTheme().palette.mode === 'dark';
  const hoje = hojeIso();

  const { fila, vencidas, prontas, semana } = useMemo(() => {
    const abertas = despesas.filter((d) => !FECHADAS.includes(d.status));
    const dias = (d: Despesa) => (d.vencimento ? diasAte(d.vencimento, hoje) : null);
    const peso = (d: Despesa) => {
      const n = dias(d);
      if (n != null && n < 0) return 0;
      if (d.status === 'pronta') return 1;
      return 2;
    };
    const ordenadas = [...abertas].sort((a, b) => {
      const pa = peso(a);
      const pb = peso(b);
      if (pa !== pb) return pa - pb;
      return (a.vencimento || '9999').localeCompare(b.vencimento || '9999') || Number(b.valor) - Number(a.valor);
    });
    return {
      fila: ordenadas.slice(0, 30),
      vencidas: abertas.filter((d) => peso(d) === 0).length,
      prontas: abertas.filter((d) => d.status === 'pronta').length,
      semana: abertas.filter((d) => {
        const n = dias(d);
        return n != null && n >= 0 && n <= 7;
      }).reduce((s, d) => s + Number(d.valor), 0),
    };
  }, [despesas, hoje]);

  const meta = !loading && !erro && fila.length ? `${fmtInt(vencidas)} vencidas · ${fmtInt(prontas)} para autorizar · ${fmtBrl(semana)} em 7 dias` : undefined;

  return (
    <CcCard title="Fila de pagamento" meta={meta} action="Ver contas a pagar" actionTo="/financeiro">
      {loading ? (
        <Box sx={{ p: 1.5 }}>
          <Skeleton variant="rounded" height={200} />
        </Box>
      ) : erro ? (
        <CcVazio>{erro}</CcVazio>
      ) : !fila.length ? (
        <CcVazio>Nenhuma despesa em aberto.</CcVazio>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 108 }}>Status</TableCell>
                <TableCell>Fornecedor</TableCell>
                <TableCell sx={{ width: 96 }}>Origem</TableCell>
                <TableCell sx={{ width: 64 }}>Venc.</TableCell>
                <TableCell align="right" sx={{ width: 104 }}>Valor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fila.map((d) => {
                const n = d.vencimento ? diasAte(d.vencimento, hoje) : null;
                const vencida = n != null && n < 0;
                const pronta = d.status === 'pronta';
                const t = vencida ? tom('vermelho', escuro) : pronta ? tom('azul', escuro) : tom('ambar', escuro);
                const rotulo = vencida ? `Vencida ${Math.abs(n!)}d` : pronta ? 'Para autorizar' : n === 0 ? 'Vence hoje' : 'A pagar';
                return (
                  <TableRow key={d.id} hover>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={rotulo} sx={chipSx(t)} />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(d.fornecedor || d.descricao || 'Sem descrição').trim()}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 96 }}>{d.origem}</TableCell>
                    <TableCell sx={{ color: vencida ? 'error.main' : 'inherit', fontVariantNumeric: 'tabular-nums' }}>{ddmm(d.vencimento)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtBrl(Number(d.valor))}
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
