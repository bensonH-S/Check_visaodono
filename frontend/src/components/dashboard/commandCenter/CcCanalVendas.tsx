import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import DeliveryDiningOutlinedIcon from '@mui/icons-material/DeliveryDiningOutlined';
import TwoWheelerOutlinedIcon from '@mui/icons-material/TwoWheelerOutlined';
import { fmtBrl, fmtInt, fmtPct } from './ccFormat';
import CcCard from './CcCard';

export type CanalId = 'cielo' | 'ifood' | 'noventaeneve';

type CanalConfig = {
  id: CanalId;
  titulo: string;
  subtitulo: string;
  accent: string;
  accentSoft: string;
  icon: ReactNode;
  vendido: number;
  liquido: number;
  taxas: number;
  taxaPct: number;
  detalhe: string;
};

const CANAIS: Record<CanalId, CanalConfig> = {
  cielo: {
    id: 'cielo',
    titulo: 'Cielo',
    subtitulo: 'Adquirente',
    accent: '#0B6BCB',
    accentSoft: 'rgba(11, 107, 203, 0.1)',
    icon: <CreditCardOutlinedIcon sx={{ fontSize: 18 }} />,
    vendido: 487_320,
    liquido: 462_854,
    taxas: 24_466,
    taxaPct: 5.02,
    detalhe: 'cartão · demo',
  },
  ifood: {
    id: 'ifood',
    titulo: 'iFood',
    subtitulo: 'Delivery',
    accent: '#EA1D2C',
    accentSoft: 'rgba(234, 29, 44, 0.1)',
    icon: <DeliveryDiningOutlinedIcon sx={{ fontSize: 18 }} />,
    vendido: 128_940,
    liquido: 102_050,
    taxas: 26_890,
    taxaPct: 20.9,
    detalhe: `${fmtInt(2847)} pedidos · demo`,
  },
  noventaeneve: {
    id: 'noventaeneve',
    titulo: '99Food',
    subtitulo: 'Delivery',
    accent: '#B8860B',
    accentSoft: 'rgba(184, 134, 11, 0.12)',
    icon: <TwoWheelerOutlinedIcon sx={{ fontSize: 18 }} />,
    vendido: 41_280,
    liquido: 33_024,
    taxas: 8_256,
    taxaPct: 20,
    detalhe: `${fmtInt(912)} pedidos · demo`,
  },
};

/** Canal em card Meridian — vendido / líquido / taxas, sem gráfico genérico. */
export default function CcCanalVendas({ canal }: { canal: CanalId }) {
  const c = CANAIS[canal];
  const liquidoPct = Math.round((c.liquido / c.vendido) * 100);

  return (
    <CcCard title={c.titulo} meta={c.subtitulo}>
      <Box sx={{ p: 1.35, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: c.accentSoft,
              color: c.accent,
              flexShrink: 0,
            }}
          >
            {c.icon}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 0.15 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
                Vendido
              </Typography>
              <Chip
                size="small"
                label="Demo"
                sx={{
                  height: 18,
                  fontSize: 9.5,
                  fontWeight: 650,
                  bgcolor: 'rgba(15,23,42,0.04)',
                  border: '1px solid',
                  borderColor: 'divider',
                  '& .MuiChip-label': { px: 0.55 },
                }}
              />
            </Stack>
            <Typography sx={{ fontSize: 20, fontWeight: 750, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {fmtBrl(c.vendido)}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.2 }}>{c.detalhe}</Typography>
          </Box>
        </Stack>

        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.35 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Líquido {fmtPct(liquidoPct, 0)}</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 650, color: c.accent }}>{fmtBrl(c.liquido)}</Typography>
          </Box>
          <Box sx={{ height: 6, borderRadius: 99, bgcolor: 'rgba(15,23,42,0.06)', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${liquidoPct}%`, bgcolor: c.accent, borderRadius: 99 }} />
          </Box>
        </Box>

        <Stack direction="row" spacing={1}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 650, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary' }}>
              Taxas
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
              {fmtBrl(c.taxas)}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 650, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary' }}>
              Taxa efetiva
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {fmtPct(c.taxaPct)}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </CcCard>
  );
}
