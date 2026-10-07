import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import { api as financeApi, type Despesa, type ResumoFinanceiro } from '../../../financeiro/api';
import { fmtBrl, fmtInt } from './ccFormat';
import { CC_BORDER, CC_CRITICO, CC_MUTED, CC_ORANGE, CC_RADIUS, CC_SURFACE, CC_TEXT, CC_WARN } from './ccTheme';
import { CcEmpty, CcSkeleton } from './CcPanel';

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: string;
}) {
  return (
    <Box
      sx={{
        minWidth: 0,
        px: 0.85,
        py: 0.6,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        bgcolor: 'var(--ga-canvas-alt)',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.5rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: CC_MUTED,
          mb: 0.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '0.88rem',
          fontWeight: 750,
          color: accent || CC_TEXT,
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {fmtBrl(value)}
      </Typography>
      <Typography sx={{ fontSize: '0.52rem', color: CC_MUTED, mt: 0.2, whiteSpace: 'nowrap' }}>{hint}</Typography>
    </Box>
  );
}

function vencLabel(d: string | null) {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  if (!y || !m || !day) return d;
  return `${day}/${m}`;
}

function pesoFila(d: Despesa, hoje: string) {
  const vencida = d.vencimento && d.vencimento < hoje && !['paga', 'conciliada', 'cancelada'].includes(d.status);
  if (vencida) return 0;
  if (d.status === 'pronta') return 1;
  return 2;
}

/** Contas a pagar — resumo + fila de prioridade. */
export default function CcFinanceiro() {
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    Promise.all([financeApi.resumo().catch(() => null), financeApi.despesas().catch(() => null)]).then(
      ([r, lista]) => {
        if (cancel) return;
        if (!r && !lista) {
          setErro('Financeiro indisponível');
          setResumo(null);
          setDespesas([]);
          setLoading(false);
          return;
        }
        setErro('');
        setResumo(r);
        setDespesas(lista ?? []);
        setLoading(false);
      },
    );
    return () => {
      cancel = true;
    };
  }, []);

  const hoje = new Date().toISOString().slice(0, 10);

  const fila = useMemo(() => {
    const abertas = despesas.filter((d) => !['paga', 'conciliada', 'cancelada'].includes(d.status));
    return [...abertas]
      .sort((a, b) => {
        const pa = pesoFila(a, hoje);
        const pb = pesoFila(b, hoje);
        if (pa !== pb) return pa - pb;
        const va = a.vencimento || '9999';
        const vb = b.vencimento || '9999';
        return va.localeCompare(vb) || b.valor - a.valor;
      })
      .slice(0, 8);
  }, [despesas, hoje]);

  return (
    <Box
      sx={{
        bgcolor: CC_SURFACE,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        p: 1.15,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: '0.06em', color: CC_TEXT }}>
            CONTAS A PAGAR
          </Typography>
          <Typography sx={{ fontSize: '0.625rem', color: 'var(--ga-text-secondary)', mt: 0.1 }}>
            Prioridade · autorizar · vencimento
          </Typography>
        </Box>
        <Typography
          component={RouterLink}
          to="/financeiro"
          sx={{
            fontSize: '0.625rem',
            fontWeight: 600,
            color: CC_ORANGE,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Abrir módulo
        </Typography>
      </Box>

      {loading ? (
        <CcSkeleton height={120} />
      ) : erro || !resumo ? (
        <CcEmpty>{erro || 'Sem dados financeiros.'}</CcEmpty>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0.5, mb: 0.75, flexShrink: 0 }}>
            <Metric label="A pagar" value={resumo.a_pagar} hint={`${fmtInt(resumo.qtd_abertas)} abertas`} />
            <Metric
              label="Autorizar"
              value={resumo.para_autorizar}
              hint={`${fmtInt(resumo.qtd_autorizar)} prontas`}
              accent={resumo.para_autorizar > 0 ? CC_ORANGE : undefined}
            />
            <Metric
              label="Vencida"
              value={resumo.vencida}
              hint={`${fmtInt(resumo.qtd_vencidas)} atrasadas`}
              accent={resumo.vencida > 0 ? CC_CRITICO : CC_WARN}
            />
            <Metric label="Pago" value={resumo.pago} hint="baixadas" />
          </Box>

          <Typography
            sx={{
              fontSize: '0.5rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: CC_MUTED,
              mb: 0.4,
              flexShrink: 0,
            }}
          >
            Fila
          </Typography>

          {!fila.length ? (
            <CcEmpty>Nada em aberto agora.</CcEmpty>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.35, minHeight: 0, overflow: 'auto', flex: 1 }}>
              {fila.map((d) => {
                const vencida =
                  Boolean(d.vencimento && d.vencimento < hoje) &&
                  !['paga', 'conciliada', 'cancelada'].includes(d.status);
                const autorizar = d.status === 'pronta';
                return (
                  <Box
                    key={d.id}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                      gap: 0.75,
                      alignItems: 'center',
                      px: 0.55,
                      py: 0.4,
                      borderRadius: '6px',
                      '&:hover': { bgcolor: 'var(--ga-canvas-alt)' },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: '0.68rem',
                          fontWeight: 650,
                          color: CC_TEXT,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.fornecedor || d.descricao || 'Sem fornecedor'}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.55rem',
                          color: CC_MUTED,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.origem_razao || d.origem || '—'}
                        {autorizar ? ' · autorizar' : ''}
                        {vencida ? ' · vencida' : ''}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.58rem',
                        fontWeight: 650,
                        color: vencida ? CC_CRITICO : CC_MUTED,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {vencLabel(d.vencimento)}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: autorizar ? CC_ORANGE : CC_TEXT,
                        whiteSpace: 'nowrap',
                        textAlign: 'right',
                      }}
                    >
                      {fmtBrl(d.valor)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
