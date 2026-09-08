import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';
import type { DashboardAtencao } from '../../../api/client';
import { fmtInt } from './ccFormat';
import { CC_CRITICO, CC_INFO, CC_ORANGE, CC_RADIUS, CC_SURFACE_2, CC_WARN } from './ccTheme';
import { CcEmpty, CcPanel, CcSectionTitle, CcSkeleton } from './CcPanel';

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
    color: CC_CRITICO,
  },
  {
    key: 'ncs_vencidas',
    line1: 'NCs vencidas',
    line2: '+7 dias',
    to: '/nao-conformidades?status=Em+aberto',
    color: CC_ORANGE,
  },
  {
    key: 'aguardando_verificacao',
    line1: 'Aguardando',
    line2: 'verificação',
    to: '/nao-conformidades?status=Em+andamento',
    color: CC_WARN,
  },
  {
    key: 'lojas_sem_visita',
    line1: 'Lojas sem visita',
    line2: 'programada',
    to: '/visitas',
    color: CC_INFO,
  },
];

function Badge({ total }: { total: number }) {
  if (total <= 0) return null;
  return (
    <Box
      sx={{
        minWidth: 20,
        height: 20,
        px: 0.65,
        borderRadius: 999,
        bgcolor: CC_CRITICO,
        color: '#F5F5F5',
        fontSize: '0.65rem',
        fontWeight: 700,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
    >
      {fmtInt(Math.min(total, 99))}
    </Box>
  );
}

function Tiles({
  loading,
  data,
}: {
  loading?: boolean;
  data?: DashboardAtencao | null;
}) {
  if (loading) return <CcSkeleton height={72} />;
  if (!data) return <CcEmpty>Não foi possível carregar as prioridades.</CcEmpty>;

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 1,
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
              border: '1px solid rgba(255,255,255,0.08)',
              borderLeft: `3px solid ${item.color}`,
              bgcolor: CC_SURFACE_2,
              px: 1.15,
              py: 1.1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 0.5,
              '&:hover': { bgcolor: '#1C1C20' },
            }}
          >
            <Typography
              sx={{
                fontSize: '1.35rem',
                fontWeight: 750,
                color: item.color,
                lineHeight: 1,
              }}
            >
              {fmtInt(value)}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.6875rem',
                color: 'var(--ga-text-secondary)',
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
  );
}

export default function CcAtencao({
  loading,
  data,
  embedded,
}: {
  loading?: boolean;
  data?: DashboardAtencao | null;
  embedded?: boolean;
}) {
  const total = data
    ? data.ncs_criticas + data.ncs_vencidas + data.aguardando_verificacao + data.lojas_sem_visita
    : 0;

  if (embedded) {
    return (
      <Box>
        <CcSectionTitle
          title="Atenção necessária"
          action="Ver todas"
          actionTo="/nao-conformidades"
          badge={<Badge total={total} />}
        />
        <Tiles loading={loading} data={data} />
      </Box>
    );
  }

  return (
    <CcPanel
      title="Atenção necessária"
      action="Ver todas"
      actionTo="/nao-conformidades"
      badge={<Badge total={total} />}
    >
      <Tiles loading={loading} data={data} />
    </CcPanel>
  );
}
