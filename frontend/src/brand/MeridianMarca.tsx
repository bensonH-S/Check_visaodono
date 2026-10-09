import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { assetUrl, LOGO_MERIDIAN_LOCKUP } from '../config/paths';

type Props = {
  /** mark = sidebar | lockup = login / destaque */
  variant?: 'mark' | 'lockup';
  sx?: SxProps<Theme>;
};

/** Marca Meridian oficial (wordmark + tagline na arte). */
export default function MeridianMarca({ sx }: Props) {
  return (
    <Box
      component="img"
      src={`${assetUrl(LOGO_MERIDIAN_LOCKUP)}?v=oficial1`}
      alt="Meridian — Gestão financeira e operacional"
      sx={[
        {
          width: '100%',
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}
