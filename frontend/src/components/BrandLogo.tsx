import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { assetUrl, LOGO_ALVIM_ICONE, LOGO_GRUPO_ALVIM } from '../config/paths';

type BrandLogoProps = {
  maxWidth?: number | { xs?: number; sm?: number; md?: number };
  sx?: SxProps<Theme>;
  /** `full` = wordmark; `icone` = Logo_Alvim_Icone (mobile/PWA). */
  variante?: 'full' | 'icone';
};

export default function BrandLogo({ maxWidth = 200, sx, variante = 'full' }: BrandLogoProps) {
  const src = assetUrl(variante === 'icone' ? LOGO_ALVIM_ICONE : LOGO_GRUPO_ALVIM);
  return (
    <Box
      component="img"
      src={src}
      alt="Grupo Alvim"
      sx={{
        width: '100%',
        maxWidth,
        height: 'auto',
        display: 'block',
        objectFit: 'contain',
        ...sx,
      }}
    />
  );
}
