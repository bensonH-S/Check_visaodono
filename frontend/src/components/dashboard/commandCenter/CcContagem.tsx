import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { EstoqueContagemRedeItem } from '../../../api/client';
import { fmtInt, lojaLabel } from './ccFormat';
import CcCard, { CcVazio } from './CcCard';

type Filtro = 'faltou' | 'contou' | 'todas';

function lojaCurta(name: string) {
  return lojaLabel(name).replace(/^BURGER KING\s*[-–]\s*/i, '').trim() || name;
}

function hora(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const ORDEM = { faltou: 0, aberta: 1, contou: 2 } as const;

const celulaSx = {
  py: '10px !important',
  px: '12px !important',
  verticalAlign: 'middle',
  borderColor: 'rgba(15, 23, 42, 0.08)',
  lineHeight: 1.35,
} as const;

function ResumoMini({
  rotulo,
  valor,
  accent,
  ativo,
  onClick,
}: {
  rotulo: string;
  valor: string;
  accent: string;
  ativo?: boolean;
  onClick: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        flex: 1,
        minWidth: 0,
        position: 'relative',
        pl: 1.5,
        pr: 1,
        py: 0.7,
        cursor: 'pointer',
        bgcolor: 'background.paper',
        borderColor: ativo ? accent : 'divider',
        transition: 'border-color 0.12s',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: accent,
          borderRadius: '2px 0 0 2px',
        },
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary' }}>
        {rotulo}
      </Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 750, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.15 }}>
        {valor}
      </Typography>
    </Paper>
  );
}

/** Contagem diária no padrão Inbox: quem contou / quem faltou. */
export default function CcContagem({ lojas, loading, erro }: { lojas: EstoqueContagemRedeItem[]; loading: boolean; erro: string }) {
  const contouN = lojas.filter((l) => l.status === 'contou').length;
  const faltouN = lojas.filter((l) => l.status === 'faltou').length;
  const pendentes = faltouN + lojas.filter((l) => l.status === 'aberta').length;

  const [filtro, setFiltro] = useState<Filtro>(() => (pendentes >= contouN ? 'faltou' : 'todas'));

  const linhas = useMemo(() => {
    const base = [...lojas].sort(
      (a, b) =>
        ORDEM[a.status] - ORDEM[b.status] ||
        lojaCurta(a.name).localeCompare(lojaCurta(b.name), 'pt-BR') ||
        (b.finalizado_em || b.contado_em || '').localeCompare(a.finalizado_em || a.contado_em || ''),
    );
    if (filtro === 'faltou') return base.filter((l) => l.status === 'faltou' || l.status === 'aberta');
    if (filtro === 'contou') return base.filter((l) => l.status === 'contou');
    return base;
  }, [lojas, filtro]);

  return (
    <CcCard
      title="Contagem diária"
      meta={!loading && lojas.length ? `${fmtInt(contouN)} de ${fmtInt(lojas.length)}` : undefined}
      action="Abrir estoque"
      actionTo="/estoque"
    >
      {loading ? (
        <Box sx={{ p: 1.5 }}><Skeleton variant="rounded" height={260} /></Box>
      ) : erro ? (
        <CcVazio>{erro}</CcVazio>
      ) : !lojas.length ? (
        <CcVazio>Nenhuma loja no escopo da data.</CcVazio>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ p: 1.25, pb: 1, flexShrink: 0 }}>
            <ResumoMini
              rotulo="Não contaram"
              valor={fmtInt(pendentes)}
              accent="#C4452D"
              ativo={filtro === 'faltou'}
              onClick={() => setFiltro('faltou')}
            />
            <ResumoMini
              rotulo="Contaram"
              valor={fmtInt(contouN)}
              accent="#7D9270"
              ativo={filtro === 'contou'}
              onClick={() => setFiltro('contou')}
            />
            <ResumoMini
              rotulo="Rede"
              valor={fmtInt(lojas.length)}
              accent="#0F172A"
              ativo={filtro === 'todas'}
              onClick={() => setFiltro('todas')}
            />
          </Stack>

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', borderTop: '1px solid', borderColor: 'divider' }}>
            {!linhas.length ? (
              <CcVazio>
                {filtro === 'faltou' ? 'Todas as lojas já contaram.' : filtro === 'contou' ? 'Ninguém contou ainda.' : 'Sem lojas.'}
              </CcVazio>
            ) : (
              <Table
                stickyHeader
                size="medium"
                sx={{
                  width: '100%',
                  tableLayout: 'fixed',
                  '& .MuiTableCell-head': {
                    bgcolor: '#F8FAFC',
                    color: '#64748B',
                    fontWeight: 650,
                    fontSize: 11,
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...celulaSx, width: '34%' }}>Loja</TableCell>
                    <TableCell sx={{ ...celulaSx, width: '22%' }}>Situação</TableCell>
                    <TableCell sx={{ ...celulaSx, width: '28%' }}>Responsável</TableCell>
                    <TableCell align="right" sx={{ ...celulaSx, width: '16%', pr: 2 }}>Horário</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linhas.map((l) => {
                    const faltou = l.status === 'faltou';
                    const andamento = l.status === 'aberta';
                    const ok = l.status === 'contou';
                    const quem = (l.criado_por_nome || l.ultima_por_nome || '').trim();
                    const rotulo = ok ? 'Contou' : andamento ? 'Em andamento' : 'Não contou';
                    const corChip = ok
                      ? { color: '#047857', border: 'rgba(16,185,129,0.45)', bg: 'transparent' }
                      : andamento
                        ? { color: '#B45309', border: 'rgba(245,158,11,0.5)', bg: 'transparent' }
                        : { color: '#C4452D', border: 'rgba(196,69,45,0.4)', bg: 'transparent' };
                    return (
                      <TableRow key={l.id_loja} hover>
                        <TableCell sx={celulaSx}>
                          <Typography noWrap title={lojaCurta(l.name)} sx={{ fontSize: 13, fontWeight: 650, color: '#0F172A' }}>
                            {lojaCurta(l.name)}
                          </Typography>
                        </TableCell>
                        <TableCell sx={celulaSx}>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={rotulo}
                            sx={{
                              height: 22,
                              fontSize: 11,
                              fontWeight: 600,
                              color: corChip.color,
                              borderColor: corChip.border,
                              bgcolor: corChip.bg,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={celulaSx}>
                          {ok || andamento ? (
                            <Typography noWrap title={quem || undefined} sx={{ fontSize: 12.5, fontWeight: 600, color: quem ? '#0F172A' : '#94A3B8' }}>
                              {quem || 'Sem nome'}
                            </Typography>
                          ) : (
                            <Typography sx={{ fontSize: 12.5, color: '#94A3B8' }}>Aguardando</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ ...celulaSx, pr: 2, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, color: '#64748B', whiteSpace: 'nowrap' }}>
                          {ok || andamento ? hora(l.finalizado_em || l.contado_em) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        </Box>
      )}
    </CcCard>
  );
}
