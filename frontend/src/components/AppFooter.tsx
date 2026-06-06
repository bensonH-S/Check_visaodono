import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAppConfig } from '../hooks/useAppConfig';

type AppFooterProps = {
  /** Força layout extra-compacto (ex.: rodapé fixo no mobile). */
  compact?: boolean;
};

const COPYRIGHT_SHORT = '©2026 GRUPO ALVIM';
const COPYRIGHT_FULL = '©2026 - GRUPO ALVIM - ALVIM PARTICIPAÇÕES E INVESTIMENTOS S/A';

export default function AppFooter({ compact }: AppFooterProps) {
  const { version, environment } = useAppConfig();
  const versionLabel =
    version === 'dev'
      ? 'dev'
      : version.startsWith('v')
        ? version
        : `v${version}`;
  const versionLine = `${versionLabel} - ${environment}`;

  const textSx = compact
    ? { fontSize: '0.55rem', lineHeight: 1.25 }
    : {
        fontSize: { xs: '0.58rem', sm: '0.62rem', md: '0.65rem', lg: '0.68rem' },
        lineHeight: { xs: 1.25, md: 1.35 },
      };

  const versionSx = compact
    ? { fontSize: '0.52rem', lineHeight: 1.25, mt: 0.1 }
    : {
        fontSize: { xs: '0.55rem', sm: '0.58rem', md: '0.62rem' },
        lineHeight: 1.25,
        mt: { xs: 0.1, md: 0 },
      };

  return (
    <Box
      component="footer"
      sx={{
        py: compact ? 0.4 : { xs: 0.45, sm: 0.55, md: 0.75 },
        px: compact ? 1 : { xs: 0.75, sm: 1.25, md: 1.5 },
        textAlign: 'center',
        flexShrink: 0,
        bgcolor: 'rgba(27, 42, 107, 0.06)',
        borderTop: '1px solid rgba(27, 42, 107, 0.1)',
      }}
    >
      <Box sx={{ display: { xs: 'block', lg: 'none' } }}>
        <Typography variant="caption" color="text.secondary" sx={{ ...textSx, display: 'block' }}>
          <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
            {COPYRIGHT_SHORT}
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
            {COPYRIGHT_FULL}
          </Box>
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ...versionSx, display: 'block', opacity: 0.9 }}
        >
          {versionLine}
        </Typography>
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{
          display: { xs: 'none', lg: 'block' },
          fontSize: '0.68rem',
          lineHeight: 1.35,
          letterSpacing: 0.1,
        }}
      >
        {COPYRIGHT_FULL} | {versionLine}
      </Typography>
    </Box>
  );
}
