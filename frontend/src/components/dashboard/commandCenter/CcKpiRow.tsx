import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { api as financeApi, type ResumoFinanceiro } from '../../../financeiro/api';
import { api } from '../../../api/client';
import { fmtBrl, fmtInt } from './ccFormat';
import { CC_BORDER, CC_CRITICO, CC_GAP, CC_MUTED, CC_ORANGE, CC_RADIUS, CC_SURFACE, CC_WARN } from './ccTheme';
import { CcSkeleton } from './CcPanel';

const CC_ACCENT_SOFT = 'color-mix(in srgb, var(--ga-orange) 14%, transparent)';

function KpiCard({
  title,
  value,
  subtext,
  icon,
  iconColor,
  iconBg,
  accent,
}: {
  title: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
  accent?: string;
}) {
  return (
    <Box
      sx={{
        bgcolor: CC_SURFACE,
        border: `1px solid ${CC_BORDER}`,
        borderRadius: `${CC_RADIUS}px`,
        px: { xs: 1, md: 1.25 },
        py: 0.85,
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: 56,
        minWidth: 0,
        flex: '1 1 0',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontSize: '0.5625rem',
            fontWeight: 700,
            color: CC_MUTED,
            mb: 0.3,
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
            fontSize: { xs: '0.95rem', md: '1.05rem' },
            fontWeight: 750,
            color: accent || 'var(--ga-text-primary)',
            lineHeight: 1,
            mb: 0.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value}
        </Typography>
        {subtext && (
          <Typography
            component="div"
            sx={{
              fontSize: '0.625rem',
              color: 'var(--ga-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtext}
          </Typography>
        )}
      </Box>
      {icon && (
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '6px',
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: iconBg,
            color: iconColor,
            flexShrink: 0,
            ml: { sm: 0.5, md: 0.75 },
            '& .MuiSvgIcon-root': { fontSize: 16 },
          }}
        >
          {icon}
        </Box>
      )}
    </Box>
  );
}

/** KPIs do Command Center — contas a pagar + valor de estoque. */
export default function CcKpiRow({
  podeFinanceiro,
}: {
  podeFinanceiro: boolean;
}) {
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [valorEstoque, setValorEstoque] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      podeFinanceiro ? financeApi.resumo().catch(() => null) : Promise.resolve(null),
      api.estoqueSaldosRedeValor().catch(() => null),
    ]).then(([fin, est]) => {
      if (cancel) return;
      setResumo(fin);
      setValorEstoque(est?.valor_atual ?? null);
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, [podeFinanceiro]);

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
            <CcSkeleton height={56} />
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={rowSx}>
      <KpiCard
        title="A pagar"
        value={podeFinanceiro && resumo ? fmtBrl(resumo.a_pagar) : '—'}
        subtext={
          podeFinanceiro && resumo
            ? `${fmtInt(resumo.qtd_abertas)} em aberto`
            : 'Sem acesso ao financeiro'
        }
        icon={<AccountBalanceWalletOutlinedIcon />}
        iconColor={CC_ORANGE}
        iconBg={CC_ACCENT_SOFT}
      />

      <KpiCard
        title="Para autorizar"
        value={podeFinanceiro && resumo ? fmtBrl(resumo.para_autorizar) : '—'}
        subtext={
          podeFinanceiro && resumo
            ? `${fmtInt(resumo.qtd_autorizar)} aguardando Felipe`
            : '—'
        }
        accent={resumo && resumo.para_autorizar > 0 ? CC_ORANGE : undefined}
        icon={<HowToRegOutlinedIcon />}
        iconColor={CC_ORANGE}
        iconBg={CC_ACCENT_SOFT}
      />

      <KpiCard
        title="Vencidas"
        value={podeFinanceiro && resumo ? fmtBrl(resumo.vencida) : '—'}
        subtext={
          podeFinanceiro && resumo
            ? `${fmtInt(resumo.qtd_vencidas)} sem pagar`
            : '—'
        }
        accent={resumo && resumo.vencida > 0 ? CC_CRITICO : undefined}
        icon={<EventBusyOutlinedIcon />}
        iconColor={resumo && resumo.vencida > 0 ? CC_CRITICO : CC_WARN}
        iconBg={resumo && resumo.vencida > 0 ? 'rgba(196, 69, 45, 0.14)' : 'rgba(196, 122, 42, 0.14)'}
      />

      <KpiCard
        title="Pago"
        value={podeFinanceiro && resumo ? fmtBrl(resumo.pago) : '—'}
        subtext="já baixadas"
        icon={<PaidOutlinedIcon />}
        iconColor={CC_MUTED}
        iconBg="var(--ga-canvas-alt)"
      />

      <KpiCard
        title="Estoque rede"
        value={fmtBrl(valorEstoque)}
        subtext="valor atual"
        icon={<Inventory2OutlinedIcon />}
        iconColor={CC_ORANGE}
        iconBg={CC_ACCENT_SOFT}
      />
    </Box>
  );
}
