import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAppConfig } from '../hooks/useAppConfig';
import { colors } from '../theme/tokens';

type AppFooterProps = {
  compact?: boolean;
  fullText?: boolean;
};

const COPYRIGHT = '© 2026 Grupo Alvim';

export default function AppFooter({ compact, fullText }: AppFooterProps) {
  const { version, environment } = useAppConfig();
  const versionLabel =
    version === 'dev' ? 'dev' : version.startsWith('v') ? version : `v${version}`;

  return (
    <Box
      component="footer"
      sx={{
        py: compact ? 0.5 : 0.75,
        px: 1.5,
        textAlign: 'center',
        flexShrink: 0,
        bgcolor: colors.canvas,
        borderTop: '1px solid',
        borderColor: colors.navyBorder,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          fontSize: compact ? '0.6rem' : '0.65rem',
          lineHeight: 1.4,
          letterSpacing: '0.01em',
        }}
      >
        {fullText ? `${COPYRIGHT} · ${versionLabel} · ${environment}` : `${COPYRIGHT} · ${versionLabel}`}
      </Typography>
    </Box>
  );
}
