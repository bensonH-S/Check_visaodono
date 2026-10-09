import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { assetUrl, LOGO_MERIDIAN_LOCKUP } from '../config/paths';

type BrandLogoProps = {
  maxWidth?: number | { xs?: number; sm?: number; md?: number };
  sx?: SxProps<Theme>;
  /** Mantido por compatibilidade — as duas variantes usam o lockup Meridian. */
  variante?: 'full' | 'icone';
  /** Desliga o scale no hover (ex.: sidebar com crop). */
  disableHover?: boolean;
};

export default function BrandLogo({
  maxWidth = 200,
  sx,
  disableHover = false,
}: BrandLogoProps) {
  return (
    <Box
      component="img"
      src={`${assetUrl(LOGO_MERIDIAN_LOCKUP)}?v=oficial1`}
      alt="Meridian"
      sx={[
        {
          width: '100%',
          maxWidth,
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
          transition: 'transform 0.2s ease',
          ...(!disableHover ? { '&:hover': { transform: 'scale(1.06)' } } : null),
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    />
  );
}
