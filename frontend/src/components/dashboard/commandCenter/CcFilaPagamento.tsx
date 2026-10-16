import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
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

type LojaFila = {
  loja: string;
  total: number;
  qtd: number;
  vencidas: number;
  autorizar: number;
  maiorTitulo: number;
};

const celulaSx = {
  py: '10px !important',
  verticalAlign: 'middle',
  borderColor: 'divider',
} as const;

function normalizaNome(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Fila por loja: maior saldo em aberto primeiro. Linha única — não corta em zoom 100%. */
export default function CcFilaPagamento({
  despesas,
  loading,
  erro,
  lojasRegiao,
  mostrarAgenda = true,
}: {
  despesas: Despesa[];
  loading: boolean;
  erro: string;
  /** Catálogo frota: nome da loja → região (gasto por região). */
  lojasRegiao?: Array<{ nome: string; regiao: string }>;
  mostrarAgenda?: boolean;
}) {
  const escuro = useTheme().palette.mode === 'dark';
  const hoje = hojeIso();

  const { filas, totalRede, lojasComSaldo, porRegiao } = useMemo(() => {
    const abertas = despesas.filter((d) => !FECHADAS.includes(d.status));
    const mapa = new Map<string, LojaFila>();
    for (const d of abertas) {
      const loja = (d.origem || 'Sem loja').trim() || 'Sem loja';
      const cur = mapa.get(loja) || { loja, total: 0, qtd: 0, vencidas: 0, autorizar: 0, maiorTitulo: 0 };
      const valor = Number(d.valor || 0);
      cur.total += valor;
      cur.qtd += 1;
      cur.maiorTitulo = Math.max(cur.maiorTitulo, valor);
      if (d.vencimento && d.vencimento < hoje) cur.vencidas += 1;
      if (d.status === 'pronta') cur.autorizar += 1;
      mapa.set(loja, cur);
    }
    const filas = [...mapa.values()].sort((a, b) => b.total - a.total || a.loja.localeCompare(b.loja, 'pt-BR'));

    const regMap = new Map<string, string>();
    for (const item of lojasRegiao || []) {
      const chave = normalizaNome(item.nome);
      if (chave) regMap.set(chave, item.regiao);
      const curto = item.nome.split(' - ').slice(1).join(' - ');
      if (curto) regMap.set(normalizaNome(curto), item.regiao);
    }
    const totReg = new Map<string, number>();
    for (const f of filas) {
      const n = normalizaNome(f.loja);
      let regiao = regMap.get(n) || '';
      if (!regiao) {
        for (const [k, v] of regMap) {
          if (n.includes(k) || k.includes(n)) {
            regiao = v;
            break;
          }
        }
      }
      const chave = regiao || 'Sem região';
      totReg.set(chave, (totReg.get(chave) || 0) + f.total);
    }
    const porRegiao = [...totReg.entries()]
      .map(([regiao, total]) => ({ regiao, total }))
      .sort((a, b) => b.total - a.total);

    return {
      filas,
      totalRede: filas.reduce((s, l) => s + l.total, 0),
      lojasComSaldo: filas.length,
      porRegiao,
    };
  }, [despesas, hoje, lojasRegiao]);

  const meta =
    !loading && !erro && filas.length
      ? `${fmtInt(lojasComSaldo)} lojas · ${fmtBrl(totalRede)} em aberto`
      : undefined;

  return (
    <CcCard
      title="A pagar por loja"
      meta={meta}
      action={mostrarAgenda ? 'Ver agenda' : undefined}
      actionTo={mostrarAgenda ? '/financeiro' : undefined}
    >
      {loading ? (
        <Box sx={{ p: 1.5 }}>
          <Skeleton variant="rounded" height={200} />
        </Box>
      ) : erro ? (
        <CcVazio>{erro}</CcVazio>
      ) : !filas.length ? (
        <CcVazio>Nenhuma despesa em aberto.</CcVazio>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {porRegiao.length > 1 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 1.5, pt: 1.25, pb: 0.5 }}>
              {porRegiao.map((r) => (
                <Chip
                  key={r.regiao}
                  size="small"
                  variant="outlined"
                  label={`${r.regiao}: ${fmtBrl(r.total)}`}
                  sx={{ height: 24, fontSize: 11, fontWeight: 650 }}
                />
              ))}
            </Box>
          ) : null}
          <Table
            size="medium"
            stickyHeader
            sx={{
              width: '100%',
              minWidth: 480,
              tableLayout: 'fixed',
              '& .MuiTableCell-head': {
                bgcolor: '#F8FAFC',
                color: '#64748B',
                fontWeight: 650,
                fontSize: 11,
              },
              '& .MuiTableCell-root': {
                overflow: 'visible',
                lineHeight: 1.35,
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...celulaSx, width: 40 }}>#</TableCell>
                <TableCell sx={{ ...celulaSx, width: '30%' }}>Loja</TableCell>
                <TableCell align="center" sx={{ ...celulaSx, width: 70 }}>Títulos</TableCell>
                <TableCell align="center" sx={{ ...celulaSx, width: 84 }}>Vencidas</TableCell>
                <TableCell align="center" sx={{ ...celulaSx, width: 88 }}>Autorizar</TableCell>
                <TableCell align="right" sx={{ ...celulaSx, width: '24%', pr: 2 }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filas.map((l, i) => {
                const tVenc = tom('vermelho', escuro);
                return (
                  <TableRow key={l.loja} hover>
                    <TableCell sx={{ ...celulaSx, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                      {i + 1}
                    </TableCell>
                    <TableCell sx={celulaSx}>
                      <Tooltip title={`Maior título: ${fmtBrl(l.maiorTitulo)}`} enterDelay={400}>
                        <Typography
                          noWrap
                          sx={{ fontSize: 13, fontWeight: 650, lineHeight: 1.3 }}
                        >
                          {l.loja}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center" sx={{ ...celulaSx, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                      {fmtInt(l.qtd)}
                    </TableCell>
                    <TableCell align="center" sx={celulaSx}>
                      {l.vencidas > 0 ? (
                        <Chip size="small" variant="outlined" label={fmtInt(l.vencidas)} sx={{ ...chipSx(tVenc), height: 22 }} />
                      ) : (
                        <Typography sx={{ fontSize: 13, color: 'text.disabled', lineHeight: 1.3 }}>0</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ ...celulaSx, fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                      {fmtInt(l.autorizar)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        ...celulaSx,
                        pr: 2,
                        fontWeight: 700,
                        fontSize: 13,
                        letterSpacing: '-0.02em',
                        fontVariantNumeric: 'tabular-nums',
                        color: 'text.primary',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtBrl(l.total)}
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
