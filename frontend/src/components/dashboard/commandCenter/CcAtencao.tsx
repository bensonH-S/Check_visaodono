import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import type { DashboardAtencao } from '../../../api/client';
import { fmtInt } from './ccFormat';
import { CC_RADIUS, CcEmpty, CcPanel, CcSkeleton } from './CcPanel';

const ITEMS: {
  key: keyof DashboardAtencao;
  line1: string;
  line2: string;
  to: string;
  color: string;
}[] = [
  {
    key: 'ncs_criticas',
    line1: 'NCs críticas',
    line2: 'abertas',
    to: '/nao-conformidades?status=Em+aberto&gravidade=Crítica',
    color: '#EF4444',
  },
  {
    key: 'ncs_vencidas',
    line1: 'NCs vencidas',
    line2: 'prazo expirado',
    to: '/nao-conformidades?status=Em+aberto',
    color: '#F97316',
  },
  {
    key: 'aguardando_verificacao',
    line1: 'Aguardando',
    line2: 'verificação',
    to: '/nao-conformidades?status=Em+andamento',
    color: '#EAB308',
  },
  {
    key: 'lojas_sem_visita',
    line1: 'Lojas sem visita',
    line2: 'há 30 dias',
    to: '/visitas',
    color: '#3B82F6',
  },
];

export default function CcAtencao({
  loading,
  data,
}: {
  loading?: boolean;
  data?: DashboardAtencao | null;
}) {
  const total = data
    ? data.ncs_criticas + data.ncs_vencidas + data.aguardando_verificacao + data.lojas_sem_visita
    : 0;

  return (
    <CcPanel
      title="Atenção necessária"
      action="Ver todas"
      actionTo="/nao-conformidades"
      badge={
        total > 0 ? (
          <Box
            sx={{
              minWidth: 22,
              height: 22,
              px: 0.75,
              borderRadius: 999,
              bgcolor: '#DC2626',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {fmtInt(Math.min(total, 99))}
          </Box>
        ) : undefined
      }
      minHeight={168}
    >
      {loading ? (
        <CcSkeleton height={88} />
      ) : !data ? (
        <CcEmpty>Não foi possível carregar as prioridades.</CcEmpty>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'nowrap',
            gap: { xs: 0.75, sm: 1, md: 1.25 },
            width: '100%',
            minWidth: 0,
          }}
        >
          {ITEMS.map((item) => {
            const value = data[item.key];
            return (
              <Box
                key={item.key}
                component={RouterLink}
                to={item.to}
                sx={{
                  flex: '1 1 0',
                  minWidth: 0,
                  textDecoration: 'none',
                  borderRadius: `${CC_RADIUS}px`,
                  border: `1px solid ${item.color}`,
                  bgcolor: 'transparent',
                  px: { xs: 1, sm: 1.25, md: 1.5 },
                  py: { xs: 1.25, md: 1.5 },
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 0.75,
                  transition: 'background-color 0.15s ease, transform 0.15s ease',
                  '&:hover': {
                    bgcolor: `${item.color}14`,
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: { xs: '1.35rem', sm: '1.5rem', md: '1.75rem' },
                    fontWeight: 750,
                    color: item.color,
                    lineHeight: 1,
                  }}
                >
                  {fmtInt(value)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: '0.62rem', sm: '0.68rem', md: '0.72rem' },
                    color: 'var(--ga-text-primary)',
                    lineHeight: 1.25,
                    fontWeight: 500,
                  }}
                >
                  {item.line1}
                  <br />
                  {item.line2}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </CcPanel>
  );
}
