import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAppConfig } from '../hooks/useAppConfig';
import { formatMobileVersionNumber } from './MobileVersionBadge';
import { safeAreaX } from '../theme/safeArea';
import { colors } from '../theme/tokens';

const COPYRIGHT = '©2026 Grupo Alvim — Alvim Participações e Investimentos S/A';

const captionSx = {
  display: 'block',
  fontSize: '0.55rem',
  lineHeight: 1.45,
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
        pb: 'env(safe-area-inset-bottom, 0px)',
        ...safeAreaX(16),
        borderTop: `1px solid ${colors.border}`,
        bgcolor: colors.canvas,
      }}
    >
      <Typography variant="caption" sx={{ ...captionSx, whiteSpace: 'normal', color: colors.textMuted }}>
        {COPYRIGHT}
        {versao ? ` · ${versao}` : ''}
      </Typography>
    </Box>
  );
}
