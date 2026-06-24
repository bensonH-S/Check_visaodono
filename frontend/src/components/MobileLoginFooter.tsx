import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAppConfig } from '../hooks/useAppConfig';
import { formatMobileVersionNumber } from './MobileVersionBadge';
import { safeAreaX } from '../theme/safeArea';

const COPYRIGHT = '©2026 Grupo Alvim — Alvim Participações e Investimentos S/A';
const PAGE_BG = '#f5f5f3';

const captionSx = {
  display: 'block',
  fontSize: '0.625rem',
  lineHeight: 1.45,
  color: 'text.secondary',
} as const;

/** Rodapé da tela de login mobile: copyright e versão. */
export default function MobileLoginFooter() {
  const { version } = useAppConfig();
  const versao = formatMobileVersionNumber(version);

  return (
    <Box
      component="footer"
      sx={{
        flexShrink: 0,
        textAlign: 'center',
        pt: 1.25,
        pb: 'max(12px, env(safe-area-inset-bottom, 0px))',
        ...safeAreaX(16),
        borderTop: '1px solid rgba(27, 42, 107, 0.08)',
        bgcolor: PAGE_BG,
      }}
    >
      <Typography variant="caption" sx={{ ...captionSx, whiteSpace: 'normal' }}>
        {COPYRIGHT}
        {versao ? ` · ${versao}` : ''}
      </Typography>
    </Box>
  );
}
