import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { fmtInt } from './ccFormat';
import { CcEmpty, CcPanel, CcSkeleton } from './CcPanel';

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
  estoqueBaixo = 0,
}: {
  loading?: boolean;
  auditoriasHoje: number;
  ncsCriticas: number;
  lojasAbaixoMeta: number;
  veiculosAlerta: number | null;
  estoqueBaixo?: number | null;
}) {
  const items: Item[] = [
    {
      key: 'auditorias',
      label: 'Auditorias para realizar hoje',
      count: auditoriasHoje,
      to: '/escalas/visitas',
      icon: <EventNoteOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#F97316',
    },
    {
      key: 'ncs',
      label: 'NCs críticas para tratar',
      count: ncsCriticas,
      to: '/nao-conformidades?status=Em+aberto&gravidade=Crítica',
      icon: <WarningAmberOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#EF4444',
    },
    {
      key: 'lojas',
      label: 'Lojas abaixo da meta',
      count: lojasAbaixoMeta,
      to: '/ranking',
      icon: <StorefrontOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#EAB308',
    },
    {
      key: 'veiculos',
      label: 'Veículos com alerta',
      count: veiculosAlerta ?? 0,
      to: '/frota',
      icon: <LocalShippingOutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#94A3B8',
    },
    {
      key: 'estoque',
      label: 'Itens com estoque baixo',
      count: estoqueBaixo ?? 0,
      to: '/estoque',
      icon: <Inventory2OutlinedIcon sx={{ fontSize: 20 }} />,
      color: '#F97316',
    },
  ];

  return (
    <CcPanel title="Atividades pendentes" action="Ver todas" actionTo="/nao-conformidades" minHeight={260}>
      {loading ? (
        <CcSkeleton height={200} />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {items.map((item) => (
            <Box
              key={item.key}
              component={RouterLink}
              to={item.to}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 0.5,
                py: 1.15,
                textDecoration: 'none',
                color: 'inherit',
                borderRadius: 1,
                transition: 'background-color 0.15s ease',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: item.color,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Typography
                sx={{
                  flex: 1,
                  fontSize: '0.8125rem',
                  color: 'var(--ga-text-secondary)',
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {item.label}
              </Typography>
              <Box
                sx={{
                  minWidth: 28,
                  height: 28,
                  px: 0.75,
                  borderRadius: '50%',
                  bgcolor: 'rgba(232, 82, 10, 0.18)',
                  color: 'var(--ga-orange)',
                  fontSize: '0.75rem',
                  fontWeight: 750,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {fmtInt(item.count ?? 0)}
              </Box>
            </Box>
          ))}
          {!items.length && <CcEmpty>Nenhuma atividade pendente.</CcEmpty>}
        </Box>
      )}
    </CcPanel>
  );
}
