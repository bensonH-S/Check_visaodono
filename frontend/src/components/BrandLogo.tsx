import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { assetUrl, LOGO_GRUPO_ALVIM } from '../config/paths';

type BrandLogoProps = {
  maxWidth?: number | { xs?: number; sm?: number; md?: number };
  sx?: SxProps<Theme>;
};

export default function BrandLogo({ maxWidth = 200, sx }: BrandLogoProps) {
  return (
    <Box
      component="img"
      src={assetUrl(LOGO_GRUPO_ALVIM)}
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
