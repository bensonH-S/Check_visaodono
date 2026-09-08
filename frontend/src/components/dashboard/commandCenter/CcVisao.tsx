import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { CcPanel } from './CcPanel';

/** Dados fictícios — placeholder do piloto de visão computacional. */
const VISAO = {
  camerasAtivas: 42,
  camerasTotal: 48,
  eventosHoje: 12,
  revisao: 3,
  confianca: '97,2%',
  itens: [
    { label: 'Uniforme / EPI', count: 5, color: '#F97316' },
    { label: 'Fila no balcão', count: 4, color: '#3B82F6' },
    { label: 'NC visual', count: 3, color: '#EF4444' },
  ],
};

export default function CcVisao() {
  return (
    <CcPanel
      title="Visão computacional"
      action="Ver AutoREV"
      actionTo="/checklist"
      minHeight={0}
      badge={
        <Box
          sx={{
            px: 0.7,
            height: 18,
            borderRadius: 999,
            bgcolor: 'rgba(232, 82, 10, 0.16)',
            color: 'var(--ga-orange)',
            fontSize: '0.6rem',
            fontWeight: 750,
            letterSpacing: '0.04em',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          PILOTO
        </Box>
      }
    >
      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0, minWidth: 0 }}>
        <Box sx={{ flex: '0 0 auto' }}>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 750, color: 'var(--ga-text-primary)', lineHeight: 1 }}>
            {VISAO.camerasAtivas}
            <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ga-text-secondary)', ml: 0.5 }}>
              / {VISAO.camerasTotal}
            </Box>
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.4 }}>
            câmeras ativas
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: 'var(--ga-text-secondary)', mt: 0.85 }}>
            {VISAO.eventosHoje} eventos hoje · {VISAO.revisao} p/ revisão
          </Typography>
          <Typography sx={{ fontSize: '0.6875rem', color: '#22C55E', fontWeight: 650, mt: 0.35 }}>
            {VISAO.confianca} confiança
          </Typography>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.7, minWidth: 0 }}>
          {VISAO.itens.map((item) => (
            <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: item.color, flexShrink: 0 }} />
              <Typography
                sx={{
                  flex: 1,
                  fontSize: '0.75rem',
                  color: 'var(--ga-text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ga-text-primary)' }}>
                {item.count}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </CcPanel>
  );
}
