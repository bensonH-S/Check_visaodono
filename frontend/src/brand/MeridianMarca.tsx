import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { assetUrl, LOGO_MERIDIAN_GESTAO, LOGO_MERIDIAN_MARK_M } from '../config/paths';

type Props = {
  /** mark = símbolo oficial | lockup = wordmark Gestão Operacional */
  variant?: 'mark' | 'lockup';
  sx?: SxProps<Theme>;
};

/** Marca Meridian oficial. */
export default function MeridianMarca({ variant = 'lockup', sx }: Props) {
  const src =
    variant === 'mark'
      ? `${assetUrl(LOGO_MERIDIAN_MARK_M)}?v=oficial3`
      : `${assetUrl(LOGO_MERIDIAN_GESTAO)}?v=oficial3`;

  return (
    <Box
      component="img"
      src={src}
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
