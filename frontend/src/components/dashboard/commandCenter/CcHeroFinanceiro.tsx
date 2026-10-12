import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import type { Despesa } from '../../../financeiro/api';
import { fmtBrl, fmtInt } from './ccFormat';

const FECHADAS = ['paga', 'conciliada', 'cancelada'];

function hojeIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Semana de pagamento = sábado → sábado (igual Agenda banco / Inbox). */
function faixaSemana(hoje: string) {
  const inicio = new Date(`${hoje}T12:00:00`);
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 1) % 7));
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 7);
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { de: iso(inicio), ate: iso(fim) };
}

function Kpi({
  rotulo,
  valor,
  detalhe,
  accent,
  alerta,
  to,
  grande,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  accent: string;
  alerta?: boolean;
  to?: string;
  grande?: boolean;
}) {
  return (
    <Paper
      variant="outlined"
      component={to ? RouterLink : 'div'}
      {...(to ? { to } : {})}
      sx={{
        position: 'relative',
        flex: grande ? '1.25 1 0' : '1 1 0',
        minWidth: { xs: '100%', sm: 130 },
        pl: 1.5,
        pr: 1.15,
        py: 0.85,
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        bgcolor: 'background.paper',
        borderColor: 'divider',
        transition: 'border-color 0.15s, transform 0.15s',
        ...(to
          ? {
              '&:hover': {
                borderColor: accent,
                transform: 'translateY(-1px)',
              },
            }
          : {}),
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: alerta ? '#C4452D' : accent,
        },
      }}
    >
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          mb: 0.25,
        }}
      >
        {rotulo}
      </Typography>
      <Typography
        sx={{
          fontSize: grande ? { xs: 18, md: 20 } : { xs: 15, md: 17 },
          fontWeight: 750,
          letterSpacing: '-0.035em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
          color: alerta ? '#C4452D' : 'text.primary',
        }}
      >
        {valor}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, lineHeight: 1.25 }}>{detalhe}</Typography>
    </Paper>
  );
}

/** KPIs do caixa da semana + conciliação Itaú (dados reais das despesas). */
export default function CcHeroFinanceiro({
  despesas,
  loading,
  podeFinanceiro,
}: {
  despesas: Despesa[];
  loading: boolean;
  podeFinanceiro: boolean;
}) {
  const hoje = hojeIso();
  const { de, ate } = useMemo(() => faixaSemana(hoje), [hoje]);

  const nums = useMemo(() => {
    const abertas = despesas.filter((d) => !FECHADAS.includes(d.status));
    const naSemana = abertas.filter((d) => d.vencimento && d.vencimento >= de && d.vencimento <= ate);
    const vencidas = abertas.filter((d) => d.vencimento && d.vencimento < hoje);
    const autorizar = abertas.filter((d) => d.status === 'pronta');
    const pagas = despesas.filter((d) => d.status === 'paga');
    const conciliadas = despesas.filter((d) => d.status === 'conciliada');
    const soma = (rows: Despesa[]) => rows.reduce((s, d) => s + Number(d.valor || 0), 0);
    return {
      semanaValor: soma(naSemana),
      semanaQtd: naSemana.length,
      autorizarValor: soma(autorizar),
      autorizarQtd: autorizar.length,
      vencidaValor: soma(vencidas),
      vencidaQtd: vencidas.length,
      pagoValor: soma(pagas),
      pagoQtd: pagas.length,
      conciliadoValor: soma(conciliadas),
      conciliadoQtd: conciliadas.length,
    };
  }, [despesas, de, ate, hoje]);

  if (loading) {
    return (
      <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={84} sx={{ flex: 1, minWidth: 130 }} />
        ))}
      </Stack>
    );
  }

  const ok = podeFinanceiro;
  const sem = podeFinanceiro ? 'sem lançamentos' : 'sem acesso ao financeiro';
  const rotuloSemana = `${de.slice(8, 10)}/${de.slice(5, 7)}–${ate.slice(8, 10)}/${ate.slice(5, 7)}`;

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={0.5}
        sx={{ alignItems: { sm: 'baseline' }, justifyContent: 'space-between', mb: 0.85 }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#1B6EF3',
            }}
          >
            Visão financeira
          </Typography>
          <Typography sx={{ fontSize: { xs: 15, md: 16 }, fontWeight: 750, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Caixa da semana · Itaú · canais
          </Typography>
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Kpi
          grande
          rotulo="A pagar na semana"
          valor={ok ? fmtBrl(nums.semanaValor) : '—'}
          detalhe={ok ? `${fmtInt(nums.semanaQtd)} títulos · sáb ${rotuloSemana}` : sem}
          accent="#0F172A"
          to="/financeiro"
        />
        <Kpi
          rotulo="Para autorizar"
          valor={ok ? fmtBrl(nums.autorizarValor) : '—'}
          detalhe={ok ? `${fmtInt(nums.autorizarQtd)} prontas` : sem}
          accent="#E8520A"
          to="/financeiro"
        />
        <Kpi
          rotulo="Vencidas"
          valor={ok ? fmtBrl(nums.vencidaValor) : '—'}
          detalhe={ok ? `${fmtInt(nums.vencidaQtd)} atrasadas` : sem}
          accent="#C4452D"
          alerta={ok && nums.vencidaValor > 0}
          to="/financeiro"
        />
        <Kpi
          rotulo="Pago"
          valor={ok ? fmtBrl(nums.pagoValor) : '—'}
          detalhe={ok ? `${fmtInt(nums.pagoQtd)} baixadas` : sem}
          accent="#7D9270"
          to="/financeiro"
        />
        <Kpi
          rotulo="Conciliado Itaú"
          valor={ok ? fmtBrl(nums.conciliadoValor) : '—'}
          detalhe={ok ? `${fmtInt(nums.conciliadoQtd)} · conciliação automática` : sem}
          accent="#0F766E"
          to="/financeiro"
        />
      </Stack>
    </Box>
  );
}
