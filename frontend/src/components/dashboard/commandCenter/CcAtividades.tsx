import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { fmtInt } from './ccFormat';
import { CC_BORDER, CC_CRITICO, CC_MUTED, CC_ORANGE, CC_PARADO, CC_RADIUS, CC_SURFACE, CC_WARN } from './ccTheme';
import { CcEmpty, CcSkeleton } from './CcPanel';

type Item = {
  key: string;
  label: string;
  count: number | null;
  to: string;
  icon: React.ReactNode;
  color: string;
};

export default function CcAtividades({
  loading,
  auditoriasHoje,
  ncsCriticas,
  lojasAbaixoMeta,
  veiculosAlerta,
}: {
  loading?: boolean;
  auditoriasHoje: number;
  ncsCriticas: number;
  lojasAbaixoMeta: number;
  veiculosAlerta: number | null;
}) {
  const items: Item[] = [
    {
      key: 'auditorias',
      label: 'Auditorias hoje',
      count: auditoriasHoje,
      to: '/escalas/visitas',
      icon: <EventNoteOutlinedIcon sx={{ fontSize: 18 }} />,
      color: CC_ORANGE,
    },
    {
      key: 'ncs',
      label: 'NCs críticas',
      count: ncsCriticas,
      to: '/nao-conformidades?status=Em+aberto&gravidade=Crítica',
      icon: <WarningAmberOutlinedIcon sx={{ fontSize: 18 }} />,
      color: CC_CRITICO,
    },
    {
      key: 'lojas',
      label: 'Lojas abaixo da meta',
      count: lojasAbaixoMeta,
      to: '/ranking',
      icon: <StorefrontOutlinedIcon sx={{ fontSize: 18 }} />,
      color: CC_WARN,
    },
    {
      key: 'veiculos',
      label: 'Veículos em alerta',
      count: veiculosAlerta ?? 0,
      to: '/frota',
      icon: <LocalShippingOutlinedIcon sx={{ fontSize: 18 }} />,
      color: CC_PARADO,
    },
  ];

  return (
    <Box
      sx={{
        bgcolor: CC_SURFACE,
        borderRadius: `${CC_RADIUS}px`,
        border: `1px solid ${CC_BORDER}`,
        p: 1.5,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, letterSpacing: '0.06em', color: '#F4F1EC' }}>
            PENDÊNCIAS
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.15 }}>
            O que precisa de ação hoje
          </Typography>
        </Box>
        <Typography
          component={RouterLink}
          to="/nao-conformidades?status=Em+aberto"
          sx={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            color: CC_ORANGE,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          Ver todas
        </Typography>
      </Box>

      {loading ? (
        <CcSkeleton height={120} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.15, minHeight: 0, overflow: 'auto' }}>
          {items.map((item) => (
            <Box
              key={item.key}
              component={RouterLink}
              to={item.to}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 0.35,
                py: 0.45,
                textDecoration: 'none',
                color: 'inherit',
                borderRadius: 1,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
              }}
            >
              <Box sx={{ color: item.color, display: 'flex', flexShrink: 0 }}>{item.icon}</Box>
              <Typography
                sx={{
                  flex: 1,
                  fontSize: '0.75rem',
                  color: CC_MUTED,
                  fontWeight: 500,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 750, color: '#F4F1EC', flexShrink: 0 }}>
                {fmtInt(item.count ?? 0)}
              </Typography>
            </Box>
          ))}
          {!items.length && <CcEmpty>Nenhuma pendência.</CcEmpty>}
        </Box>
      )}
    </Box>
  );
}
