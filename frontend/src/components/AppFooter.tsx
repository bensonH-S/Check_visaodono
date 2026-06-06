import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAppConfig } from '../hooks/useAppConfig';

type AppFooterProps = {
  compact?: boolean;
};

export default function AppFooter({ compact }: AppFooterProps) {
  const { version, environment } = useAppConfig();
  const versionLabel = version.startsWith('v') ? version : `v${version}`;

  return (
    <Box
      component="footer"
      sx={{
        py: compact ? 0.75 : 1.25,
        px: compact ? 1.25 : 2,
        textAlign: 'center',
        flexShrink: 0,
        bgcolor: 'rgba(27, 42, 107, 0.06)',
        borderTop: '1px solid rgba(27, 42, 107, 0.1)',
      }}
    >
      {compact ? (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', fontSize: '0.65rem', lineHeight: 1.4, px: 0.5 }}
          >
            ©2026 - GRUPO ALVIM - ALVIM PARTICIPAÇÕES E INVESTIMENTOS S/A
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', fontSize: '0.65rem', lineHeight: 1.4, mt: 0.25 }}
          >
            {versionLabel} - {environment}
          </Typography>
        </>
      ) : (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1.5, letterSpacing: 0.2 }}
        >
          ©2026 - GRUPO ALVIM - ALVIM PARTICIPAÇÕES E INVESTIMENTOS S/A | {versionLabel} - {environment}
        </Typography>
      )}
    </Box>
  );
}