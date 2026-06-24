import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAppConfig } from '../hooks/useAppConfig';
import { buildVersion } from '../config/buildVersion';
import { safeAreaBottomCalc, safeAreaLeftCalc } from '../theme/safeArea';

type Props = {
  /** No header, abaixo do nome da página (Chamados, Checklist, etc.). */
  inline?: boolean;
  /** Distância acima da borda inferior — só com `inline={false}`. */
  bottomOffset?: number;
};

/** Versão no mobile: v + número (ex.: v1.2.0), sem ambiente. */
export function formatMobileVersionNumber(version: string): string {
  const bruta = version && version !== 'dev' ? version : buildVersion();
  const numero = bruta.replace(/^v/i, '');
  return numero ? `v${numero}` : '';
}

const textSx = {
  fontSize: '0.625rem',
  lineHeight: 1.2,
  color: 'text.disabled',
  opacity: 0.85,
} as const;

export default function MobileVersionBadge({ inline = false, bottomOffset = 8 }: Props) {
  const { version } = useAppConfig();
  const label = formatMobileVersionNumber(version);

  if (inline) {
    return (
      <Typography variant="caption" sx={{ ...textSx, display: 'block', mt: 0.15 }}>
        {label}
      </Typography>
    );
  }

  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        left: safeAreaLeftCalc(10),
        bottom: safeAreaBottomCalc(bottomOffset),
        zIndex: 20,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <Typography variant="caption" sx={textSx}>
        {label}
      </Typography>
    </Box>
  );
}
