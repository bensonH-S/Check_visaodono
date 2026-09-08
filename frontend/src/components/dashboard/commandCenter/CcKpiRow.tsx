import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import StoreIcon from '@mui/icons-material/Store';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import { fmtDelta, fmtInt, fmtPct } from './ccFormat';
import { CC_BORDER, CC_GAP, CC_RADIUS, CC_SURFACE } from './ccTheme';
import { CcSkeleton } from './CcPanel';

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const w = 64;
  const h = 24;
  const pts = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polygon points={area} fill="rgba(232, 82, 10, 0.18)" />
      <polyline points={pts} fill="none" stroke="var(--ga-orange)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KpiCard({
  title,
  value,
  subtext,
  icon,
  iconColor,
  iconBg,
  extra,
}: {
  title: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  extra?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        bgcolor: CC_SURFACE,
        border: `1px solid ${CC_BORDER}`,
        borderRadius: `${CC_RADIUS}px`,
        px: { xs: 1.25, md: 1.75 },
        py: 1.25,
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: 86,
        minWidth: 0,
        flex: '1 1 0',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontSize: '0.625rem',
            fontWeight: 700,
            color: 'var(--ga-text-muted)',
            mb: 0.55,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: '1.25rem', md: '1.5rem' },
            fontWeight: 700,
            color: 'var(--ga-text-primary)',
            lineHeight: 1,
            mb: 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </Typography>
        {subtext && (
          <Typography
            component="div"
            sx={{
              fontSize: '0.6875rem',
              color: 'var(--ga-text-secondary)',
              display: 'flex',
              alignItems: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtext}
          </Typography>
        )}
      </Box>
      {extra && (
        <Box sx={{ display: { xs: 'none', lg: 'flex' }, ml: 0.75, flexShrink: 0, alignItems: 'center' }}>
          {extra}
        </Box>
      )}
      {icon && (
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: iconBg,
            color: iconColor,
            flexShrink: 0,
            ml: { sm: 0.75, md: 1 },
          }}
        >
          {icon}
        </Box>
      )}
    </Box>
  );
}

export default function CcKpiRow({
  loading,
  mediaGeral,
  variacaoMes,
  sparkline,
  visitasMes,
  visitasPlanejadas,
  ncsAbertas,
  ncsCriticas,
  ncsModeradas,
  lojasRisco,
  veiculosAlerta,
}: {
  loading?: boolean;
  mediaGeral: number;
  variacaoMes?: number | null;
  sparkline?: number[];
  visitasMes: number;
  visitasPlanejadas?: number;
  ncsAbertas: number;
  ncsCriticas: number;
  ncsModeradas: number;
  lojasRisco: number;
  veiculosAlerta: number | null;
}) {
  const rowSx = {
    display: 'flex',
    flexWrap: 'nowrap' as const,
    gap: CC_GAP,
    width: '100%',
    minWidth: 0,
  };

  if (loading) {
    return (
      <Box sx={rowSx}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Box key={i} sx={{ flex: '1 1 0', minWidth: 0 }}>
            <CcSkeleton height={86} />
          </Box>
        ))}
      </Box>
    );
  }

  const delta = fmtDelta(variacaoMes);
  const planejadas = visitasPlanejadas && visitasPlanejadas > 0 ? visitasPlanejadas : null;

  return (
    <Box sx={rowSx}>
      <KpiCard
        title="Performance Geral"
        value={fmtPct(mediaGeral)}
        subtext={
          delta ? (
            <>
              {delta.positivo ? (
                <ArrowDropUpIcon sx={{ fontSize: 16, color: '#16A34A', mr: 0.25 }} />
              ) : (
                <ArrowDropDownIcon sx={{ fontSize: 16, color: '#DC2626', mr: 0.25 }} />
              )}
              <span style={{ color: delta.positivo ? '#16A34A' : '#DC2626', fontWeight: 600, marginRight: 4 }}>
                {delta.valor}%
              </span>
              <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                vs. mês anterior
              </Box>
            </>
          ) : (
            'Sem histórico'
          )
        }
        extra={sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} /> : undefined}
      />

      <KpiCard
        title="Visitas no Mês"
        value={planejadas ? `${fmtInt(visitasMes)}` : fmtInt(visitasMes)}
        subtext={planejadas ? `de ${fmtInt(planejadas)} planejadas` : 'Registradas neste mês'}
        icon={<CalendarMonthIcon fontSize="medium" />}
        iconColor="#3B82F6"
        iconBg="rgba(59, 130, 246, 0.15)"
      />

      <KpiCard
        title="NCs em Aberto"
        value={fmtInt(ncsAbertas)}
        subtext={`${fmtInt(ncsCriticas)} críticas • ${fmtInt(ncsModeradas)} moderadas`}
        icon={<WarningAmberIcon fontSize="medium" />}
        iconColor="#EF4444"
        iconBg="rgba(239, 68, 68, 0.15)"
      />

      <KpiCard
        title="Lojas em Risco"
        value={fmtInt(lojasRisco)}
        subtext="Abaixo de 75%"
        icon={<StoreIcon fontSize="medium" />}
        iconColor="#F59E0B"
        iconBg="rgba(245, 158, 11, 0.15)"
      />

      <KpiCard
        title="Veículos em Alerta"
        value={veiculosAlerta == null ? '—' : fmtInt(veiculosAlerta)}
        subtext={veiculosAlerta == null ? 'Sem acesso à frota' : 'Excesso de velocidade'}
        icon={<LocalShippingIcon fontSize="medium" />}
        iconColor="#8B5CF6"
        iconBg="rgba(139, 92, 246, 0.15)"
      />
    </Box>
  );
}
